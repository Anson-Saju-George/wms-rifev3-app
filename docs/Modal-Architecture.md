# Modal-Architecture.md — WMS RIFE GPU Inference on Modal

**Authoritative design spec.** Implement to this document; do not improvise the architecture.
Source of truth for how WMS routes GPU inference to Modal. Verified against Modal docs (2026-07).

---

## 1. Goal

Move RIFE frame-interpolation off the local GPU and onto **Modal** (serverless GPU), so:
- The WMS web container on the cloud box is **CPU-only and thin** (no torch/CUDA).
- GPU work runs in **ephemeral Modal containers** that exit after each job → **VRAM returns to 0** automatically (the platform-level version of the per-job subprocess we already built locally).
- A single env flag switches backends: `INFERENCE_BACKEND_MODAL=true` → Modal; `false` → the existing local subprocess (dev). `FALLBACK_TO_LOCAL=true` → fall back to local on Modal failure (only where a GPU exists).

WMS's existing **async job model** (upload → `job_id` → poll `/api/status` → `/api/download`) is preserved 1:1 — Modal's `.spawn()` + `FunctionCall` map directly onto it.

---

## 2. Big picture

```
WMS container (CPU, thin: FastAPI + modal client + opencv-headless; NO torch/CUDA)
   /api/upload   → validate → fn.spawn(job_id, video_bytes, model_id, multiplier)
                 → store the returned Modal call_id on the job
   /api/status   → FunctionCall.from_id(call_id).get(timeout=0)  +  progress_dict[job_id]
   /api/download → serve the returned MP4
        ▲  (authenticated by MODAL_TOKEN_ID / MODAL_TOKEN_SECRET)
        ▼
Modal App "wms-rife"  →  interpolate() @app.function(gpu="T4")
   ephemeral GPU container: mount weights (Volume) → RIFE interpolate + audio-merge
   → return final MP4 bytes → container EXITS (VRAM → 0)
```

---

## 3. Modal primitives we use

| Primitive | Choice | Why |
|---|---|---|
| `modal.App` | `App("wms-rife")` | one app, `modal deploy` unit |
| `modal.Image` | `debian_slim().apt_install("ffmpeg",…).pip_install("torch==2.6.0",…)` | **No nvidia/cuda base needed** — Modal hosts ship the NVIDIA driver + CUDA 13 runtime; standard cu12x torch works on T4/L4. (The `cu130`/`sm_120` issue was specific to the local RTX 5080.) |
| `@app.function(gpu="T4")` | the `interpolate` function | ephemeral GPU container per call; T4 = cheapest (16 GB, ~$0.59/hr, per-second) and ample for RIFE |
| `modal.Volume` | `wms-rife-weights` | holds RIFE weights (`flownet.pkl` / `train_log*`) — Modal recommends Volumes over baking |
| `modal.Dict` | `wms-rife-progress` | share per-job progress % from the function back to WMS (keeps the progress bar) |
| `.spawn()` + `FunctionCall` | async dispatch + poll | maps onto WMS's job/poll model |
| `@app.local_entrypoint()` | `main()` | `modal run backend/modal_app.py --input clip.mp4` local test |
| `modal deploy` / `modal serve` | deploy / dev live-reload | deploy the function WMS calls |
| Modal API token | `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` | authenticates the WMS container's lookups/spawns |

**Invocation choice:** `.spawn()` + `FunctionCall.from_id(call_id).get(timeout=0)`, **not** a web endpoint —
because it gives native async polling that fits WMS's existing queue. WMS needs only the lightweight
`modal` client (no torch), so the container stays thin.

---

## 4. `backend/modal_app.py` — reference design

```python
import modal

app = modal.App("wms-rife")

weights_vol   = modal.Volume.from_name("wms-rife-weights",  create_if_missing=True)
progress_dict = modal.Dict.from_name("wms-rife-progress",   create_if_missing=True)

WEIGHTS_DIR = "/weights"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install("torch==2.6.0", "numpy", "opencv-python-headless", "tqdm")  # pin to what RIFE needs
    # ship the RIFE inference code (NOT the weights) into the image:
    .add_local_dir("backend", "/root/backend", copy=True,
                   ignore=["train_log*", "storage", "*.db", "__pycache__", "samples", "temp"])
)

@app.function(gpu="T4", image=image, volumes={WEIGHTS_DIR: weights_vol}, timeout=900)
def interpolate(job_id: str, video_bytes: bytes, model_id: int, multiplier: int) -> bytes:
    # 1. write video_bytes to /tmp/in.mp4
    # 2. load RIFE model for model_id from WEIGHTS_DIR (flownet.pkl) — reuse model_engine.load_model,
    #    pointed at the mounted Volume path
    # 3. run core_engine.interpolate_video(...) with progress_callback:
    #        progress_dict[job_id] = pct
    # 4. ffmpeg audio-merge original+interpolated → /tmp/out.mp4
    # 5. return the final MP4 bytes
    ...

@app.local_entrypoint()
def main(input: str, model_id: int = 0, multiplier: int = 2):
    data = open(input, "rb").read()
    out = interpolate.remote("local-test", data, model_id, multiplier)
    open("out.mp4", "wb").write(out); print("wrote out.mp4")
```

Notes:
- The RIFE **code** (`core_engine`, `model_engine`, `train_log/*.py` model classes) ships **in the image**;
  the **weights** live in the **Volume** (they're the big, gitignored binary).
- `interpolate` does the *full* job (GPU interpolation **+** audio merge) and returns the final MP4, so
  the WMS container needs neither torch nor ffmpeg for the hot path.

---

## 5. Weights delivery (one-time)

Upload the RIFE weights to the Volume once (not in git, not in the image):
```bash
modal volume put wms-rife-weights ./backend/train_log            /
# (repeat for any model_id-specific weight dirs the app supports)
```
The function mounts the Volume at `/weights` and loads `flownet.pkl` from there.

---

## 6. Backend adapter — `INFERENCE_BACKEND_MODAL`

New module `backend/inference.py` (dispatch layer). The worker calls `dispatch()`; `/api/status` calls `poll()`.

```python
import os, modal
_USE_MODAL = os.getenv("INFERENCE_BACKEND_MODAL", "false").lower() in {"1","true","t","yes"}
_FALLBACK  = os.getenv("FALLBACK_TO_LOCAL",       "true").lower()  in {"1","true","t","yes"}
_progress  = None

def dispatch(job_id, input_path, model_id, multiplier):
    """Returns ('modal', call_id) or ('local', None). Local = existing subprocess path."""
    if _USE_MODAL:
        try:
            fn   = modal.Function.from_name("wms-rife", "interpolate")
            data = open(input_path, "rb").read()
            call = fn.spawn(job_id, data, model_id, multiplier)
            return ("modal", call.object_id)
        except Exception:
            if not _FALLBACK: raise
    return ("local", None)   # spawn the existing per-job subprocess

def poll(call_id):
    """Returns ('running', None) | ('done', mp4_bytes) | ('failed', reason)."""
    fc = modal.FunctionCall.from_id(call_id)
    try:    return ("done", fc.get(timeout=0))
    except TimeoutError:      return ("running", None)
    except Exception as e:    return ("failed", str(e))

def get_progress(job_id):
    global _progress
    if _progress is None:
        _progress = modal.Dict.from_name("wms-rife-progress", create_if_missing=True)
    return _progress.get(job_id, 0)
```

- **Worker** (`worker_loop`): call `dispatch()`. If `modal`, store `call_id` on the job and let the
  status poller drive completion (no local GPU work). If `local`, run the existing subprocess.
- **`/api/status`**: for a Modal job → `poll(call_id)` + `get_progress(job_id)`; map to
  `processing`/`done`/`failed(+refund)`; on `done`, write the returned bytes to
  `storage/output/{job_id}.mp4`.
- Keep the parent process **CUDA-free** (already true after the subprocess refactor). In Modal mode the
  parent never imports torch at all.

---

## 7. Config / env vars (WMS container)

| Var | Meaning | Prod | Local dev |
|---|---|---|---|
| `INFERENCE_BACKEND_MODAL` | route GPU to Modal | `true` | `false` |
| `FALLBACK_TO_LOCAL` | fall back to local subprocess on Modal error | `false` (no GPU on box) | `true` |
| `MODAL_TOKEN_ID` / `MODAL_TOKEN_SECRET` | authenticate the modal client | via secret mount | from `~/.modal.toml` or `.env` |
| `MODAL_APP_NAME` / `MODAL_FUNCTION_NAME` | override lookup names | `wms-rife` / `interpolate` | same |

Secrets arrive via **mount / env**, never git. Add `MODAL_TOKEN_*` to `.env.example` (names only).

---

## 8. Security

- Modal calls are **token-gated** (Modal API token). Token in `secrets/` (gitignored) / mounted at runtime.
- **No weights or secrets in git or the WMS image.** Weights live only in the Modal Volume + local disk.
- WMS keeps its existing JWT/Google-auth + rate limits on `/api/*`.

---

## 9. Thin production image (follow-up task)

Once Modal mode works, make the prod image drop torch/CUDA: a build arg (e.g. `INCLUDE_TORCH=0`) so
the Modal-backed prod image installs only `fastapi + modal + opencv-headless` (~300–500 MB, fits the
3.7 GB box), while the local-dev image keeps torch for the subprocess path.

## 10. Large-file path (follow-up task)

Modal args/endpoints cap ~4 GiB and bytes-as-arg is inefficient for big videos. For the 2 GB path,
upload the input to the **Volume / a cloud bucket** and pass a *reference* instead of bytes. First cut
handles normal demo clips inline.

---

## 11. Deploy + verify

```bash
pip install modal && modal setup                 # once (owner)
modal volume put wms-rife-weights ./backend/train_log /   # upload weights once
modal run backend/modal_app.py --input backend/samples/<clip>.mp4 # local test → out.mp4
modal deploy backend/modal_app.py                         # persistent; note the app/function names
```
Then in the WMS container set `INFERENCE_BACKEND_MODAL=true` + `MODAL_TOKEN_*`, and run the normal
upload → status → download flow. Expected: job dispatches to Modal, `/status` shows progress then
`done`, download returns a valid interpolated MP4, and **no GPU is used on the WMS host**.

## 12. Cost

T4 per-second billing, zero idle. A short clip ≈ 20–60 s ≈ **$0.003–$0.01/job**; ~100 jobs ≈ $0.50 —
effectively free within Modal's monthly credits.

## 13. Rollback

Set `INFERENCE_BACKEND_MODAL=false` → WMS reverts to the local per-job subprocess. No redeploy of Modal
needed. The Modal app can stay deployed idle at $0.
```

Notes:
- Reuse the existing `infer_job.py` / `core_engine.interpolate_video` logic inside the Modal function — do
  not rewrite the RIFE inference.
- Do not change the frontend or the `/api/*` contract; the switch is backend-internal.
