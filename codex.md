# Codex -> Claude Master Handoff - WMS RIFEv3 App

This handoff is intentionally detailed. It records the current pushed repo state, verification outputs, and the remaining decisions. Do not copy real secret values into this file.

## 0. Current Snapshot

- Repo root: `D:\main-projects\LIVE-ACTIVE\wms-rifev3-app`
- Runtime update commit covered by this handoff: `7e80ae5 feat: add runtime modes and upload controls`
- Latest pushed commits from this session:
  - `0f04e63 docs: audit + consolidate documentation`
  - `404d394 feat: containerize local gpu wms runtime`
  - `efa776d fix: support wms path-mounted frontend`
  - `7e80ae5 feat: add runtime modes and upload controls`
- `7e80ae5` committed the modal-slim Docker target, HF runtime model pull, five-variable env contract, `MAX_CONCURRENCY` wiring, in-memory upload rate limiter, `frontend/jsconfig.json` removal, README/status/handoff updates, and Option B cleanup.
- After pushing `7e80ae5`, the only remaining local artifact was untracked `docs/Modal-Architecture.md`, a design note with encoding issues that was intentionally not staged.
- Local `.env` exists but is gitignored. Do not print, stage, or commit it. It contains local runtime values/secrets/public OAuth/payment IDs.
- The user said they own the repo now and safe-directory caution is no longer needed, but still do not stage secrets, weights, databases, storage, or screenshots accidentally.

## 1. Repository Layout After Reorganization

The repo has been reorganized around one app root:

```text
wms-rifev3-app/
+-- Dockerfile
+-- docker-compose.yml
+-- entrypoint.sh
+-- .dockerignore
+-- .env                 # local only, gitignored
+-- .env.example         # committed template
+-- .gitignore
+-- frontend/
|   +-- public/
|   |   +-- config.js
|   |   +-- config.template.js
|   +-- src/
|   +-- index.html
|   +-- package.json
|   +-- package-lock.json
|   +-- vite.config.js
|   +-- eslint.config.js
|   +-- components.json
+-- backend/
|   +-- app.py
|   +-- infer_job.py
|   +-- core_engine.py
|   +-- model_engine.py
|   +-- auth.py
|   +-- database.py
|   +-- models.py
|   +-- __init__.py
|   +-- requirements.txt
|   +-- train_log*/      # local RIFE model folders/weights, gitignored as needed
|   +-- storage/         # runtime input/output, gitignored
|   +-- samples/
|   +-- model/
|   +-- app.db           # local SQLite DB, gitignored
+-- docs/
|   +-- Project-Status.md
|   +-- archive/
+-- codex.md
+-- README.md
```

Important: `backend/` internal structure was intentionally left mostly unchanged because local imports in the RIFE code are fragile. The frontend was moved from root to `frontend/`.

## 2. Work Completed And Committed

### 2.1 Documentation Audit And Consolidation - Commit `0f04e63`

User objective: audit all repo docs against source/config, consolidate into one accurate project-status document, keep only README and Project-Status active, archive everything else, and commit docs only.

What was done:

- Created/updated active status doc at `docs/Project-Status.md`.
- Kept `README.md` active.
- Moved stale/extra docs into `docs/archive/` rather than deleting them.
- Created `docs/archive/README.md` as an archive index.
- Archived files currently include:
  - `docs/archive/source_report.txt`
  - `docs/archive/old-master-prompt-domain-adaptive-vfi-webapp.md`
  - `docs/archive/docs/Web Motion Synthesis.docx`
  - `docs/archive/docs/images/banner.png`
- The audit treated source code/config as source of truth and marked unverifiable claims as such.
- The docs audit was committed with message `docs: audit + consolidate documentation`.

Caveat now: `docs/Project-Status.md` and parts of `README.md` became stale after the later `/wms` path fix and modal-slim experiment. See section 8 for exact stale points.

### 2.2 Containerize/Reorganize/Local GPU Runtime - Commit `404d394`

User objective: create a one-container FastAPI production runtime, move frontend under `frontend/`, keep backend internals, add env template, Dockerfile, compose, entrypoint runtime config injection, and local-GPU subprocess inference.

What was done:

- Frontend files moved under `frontend/`.
- Backend stayed under `backend/`.
- Added root `Dockerfile` multi-stage build:
  - Node 20 frontend build stage.
  - CUDA runtime Python backend stage for local GPU inference.
  - FastAPI serves prebuilt frontend and API from one process.
- Added `docker-compose.yml` single service `wms`.
- Compose binds host localhost only:
  - `127.0.0.1:${HOST_PORT:-8000}:8000`
  - Container internal port is always `8000`.
- Added `entrypoint.sh`:
  - Defaults `API_BASE_URL` to same-origin routing unless explicitly overridden.
  - Renders `/app/dist/config.js` from `/app/dist/config.template.js` using `envsubst`.
  - Generates an ephemeral JWT secret if `JWT_SECRET` is empty.
  - Runs `uvicorn app:app --host 0.0.0.0 --port 8000` from `/app/backend`.
- `.env.example` is now intentionally short: `WMS_MODE` and `HOST_PORT` only. Optional auth/payment/Modal values remain supported as normal env vars when needed.
- Added/updated `.gitignore` hardening for local-only material:
  - `.env`
  - `backend/train_log*/`
  - `backend/storage/`
  - `backend/app.db`
  - `node_modules/`
  - `__pycache__/`
  - `secrets/` as a defensive ignore only; it is not mounted or documented as the runtime secret path anymore.
- No `.gitkeep`, no official `secrets/` folder, and no `env_files` convention are required for Option B.
- Added runtime frontend config template:
  - `frontend/public/config.template.js`
  - Injects `window.__API_BASE_URL__`, `window.__BASE_PATH__`, `window.__GOOGLE_CLIENT_ID__`, `window.__RAZORPAY_KEY_ID__`.
- Frontend no longer bakes the API base/client IDs at build time:
  - `frontend/src/components/LiveDemo.jsx` reads `window.__API_BASE_URL__` and appends `/api`.
  - `frontend/src/components/LiveDemo.jsx` reads `window.__RAZORPAY_KEY_ID__`.
  - `frontend/src/main.jsx` reads `window.__BASE_PATH__` for `BrowserRouter basename`.
  - `frontend/src/main.jsx` reads `window.__GOOGLE_CLIENT_ID__`.
- FastAPI registers the existing routes under `/api/*`.
- FastAPI serves static frontend after API routes are registered.
- Added SPA fallback by subclassing `StaticFiles` so client-side routes resolve to `index.html`.

### 2.3 Per-Job Subprocess Inference - Included In `404d394`

User objective: make the FastAPI parent CUDA-free between jobs by moving inference into a subprocess that exits after each job.

What was done:

- Created `backend/infer_job.py` as the standalone CLI inference runner.
- `infer_job.py` arguments:
  - `--job-id`
  - `--model-id`
  - `--multiplier`
  - `--input`
  - `--output`
  - `--device`
  - `--progress-file`
- `infer_job.py` imports and uses:
  - `load_model` from `backend/model_engine.py`
  - `interpolate_video` from `backend/core_engine.py`
- `infer_job.py` writes progress percent atomically to the requested progress file.
- `infer_job.py` exit behavior:
  - `0` on success
  - `42` on CUDA OOM, prints `CUDA_OOM` to stderr
  - `1` on other exception, prints traceback to stderr
- `backend/app.py` worker flow now launches `infer_job.py` with `subprocess.Popen`.
- Parent polls the progress file and updates `job_progress[job_id]`.
- Parent keeps audio merge in parent process via ffmpeg after successful silent interpolation.
- Parent refunds credit for `failed_oom` and generic `failed` cases.
- Parent no longer uses a persistent in-process model cache in the worker path.
- Parent free-VRAM query uses `nvidia-smi --query-gpu=memory.free --format=csv,noheader,nounits` instead of Torch memory APIs.
- If `nvidia-smi` is unavailable, `gpu_free_mb()` returns a large fallback number so CPU/no-GPU boot still works.

Verification performed earlier:

- Three GPU upload/status/download jobs completed end to end.
- Downloaded outputs were valid MP4s readable/openable after download.
- `nvidia-smi` showed VRAM usage during subprocess inference.
- After each subprocess exited, compute-process entries disappeared and VRAM returned to idle baseline, removing the prior persistent FastAPI CUDA residency.

### 2.4 Hugging Face Model Folder Upload And Runtime Pull

User asked to upload only these three local folders:

- `backend/train_log`
- `backend/train_log_wms`
- `backend/train_log_wms_custom_loss`

Target repo:

- `Anson-Saju-George/wms-rifev3-models-all-3`

Upload command used from repo root:

```powershell
hf upload Anson-Saju-George/wms-rifev3-models-all-3 backend . --include "train_log/**" --include "train_log_wms/**" --include "train_log_wms_custom_loss/**" --commit-message "Upload WMS RIFE model folders"
```

Upload result:

```text
url=https://huggingface.co/Anson-Saju-George/wms-rifev3-models-all-3/commit/b32873667f63177978a4f84f67f7cf42b5f48bfb
Found 12 files to upload
Uploading... 12/12 files checked, 0/0 uploaded (0.00B transferred), 0 committed in 0 commit(s)
```

Meaning: the HF repo already had matching copies of the 12 files, so the CLI verified them and created no new commit.

Anonymous pull was checked with `HF_HUB_DISABLE_IMPLICIT_TOKEN=1` using `hf download` for `train_log/flownet.pkl`; it succeeded.

Runtime pull changes now in the uncommitted working tree:

- Added `backend/download_models.py`.
- Added `.dockerignore` entries so `backend/train_log*/` and `backend/.cache/` do not enter Docker build context.
- Added `.gitignore` entry for `backend/.cache/`.
- Local-GPU Docker target installs `huggingface_hub`.
- `entrypoint.sh` defaults:
  - `MODEL_DOWNLOAD_ENABLED=true`
  - `MODEL_REPO_ID=Anson-Saju-George/wms-rifev3-models-all-3`
  - `MODEL_REVISION=main`
- On startup, if local inference is enabled, entrypoint runs `python /app/backend/download_models.py` before uvicorn.
- The downloader verifies these required files:
  - `train_log/flownet.pkl`
  - `train_log/RIFE_HDv3.py`
  - `train_log/IFNet_HDv3.py`
  - `train_log_wms/flownet.pkl`
  - `train_log_wms_custom_loss/flownet.pkl`
- If files are missing, it downloads only `train_log/**`, `train_log_wms/**`, and `train_log_wms_custom_loss/**` from the HF model repo into `/app/backend`.
- In Modal-only mode (`INFERENCE_BACKEND_MODAL=true` and `FALLBACK_TO_LOCAL=false`), entrypoint skips local model download.

Verification of the updated image:

- Fresh build command: `docker build --target backend-local-gpu -t wms-rifev3-app-wms:hf-pull-test .`
- Build succeeded.
- Build context dropped to about `10.38kB`, confirming local model folders are excluded from context.
- Image size: `[wms-rifev3-app-wms:hf-pull-test] size=4877721990`.
- Previous local-GPU comparison image was about `4905299864`; net reduction is about 27.6 MB after removing about 40.6 MB of local model files and adding the HF download dependency.
- One-off image check with entrypoint overridden found no `/app/backend/train_log*` folders baked into the image.
- `huggingface_hub` version inside the local-GPU image: `1.24.0`.
- Runtime smoke container downloaded 12 files anonymously from HF, verified required files, and served `/api/system`:

```text
Missing WMS RIFE model files: train_log/flownet.pkl, train_log/RIFE_HDv3.py, train_log/IFNet_HDv3.py, train_log_wms/flownet.pkl, train_log_wms_custom_loss/flownet.pkl
Downloading model folders from Hugging Face repo Anson-Saju-George/wms-rifev3-models-all-3@main into /app/backend
WMS RIFE model folders are ready.
required ok
system {"active_gpu_jobs":0,"queue_length":0,"free_vram_mb":99999}
```

- Modal-slim target was rebuilt as `wms-rifev3-app-wms:modal-slim-hf-test` and still booted.
- Modal-slim boot log included `Skipping local model download in Modal-only mode.` and `/api/system` returned JSON.
Additional Modal-only slimming pass:

- Replaced parent `cv2` upload validation in `backend/app.py` with `ffprobe` JSON metadata parsing.
- Added `backend/requirements-modal.txt` with only API/static/auth/payment dependencies: FastAPI, uvicorn, python-dotenv, SQLAlchemy, google-auth, requests, python-multipart, python-jose, and razorpay.
- `backend-modal` no longer installs OpenCV, NumPy, imageio, imageio-ffmpeg, tqdm, gunicorn, psycopg2-binary, Torch, CUDA, or model download dependencies.
- It still installs Debian `ffmpeg`, which provides both `ffmpeg` and `ffprobe` for required parent-side preprocessing/postprocessing.
- Fresh build command: `docker build --target backend-modal -t wms-rifev3-app-wms:modal-ultraslim-test .`.
- New measured image size: `[wms-rifev3-app-wms:modal-ultraslim-test] size=285543826`.
- Dependency check inside image: `{'torch': False, 'cv2': False, 'numpy': False, 'imageio': False, 'cuda_dir': False}`.
- Tooling check inside image found `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`.
- `/opt/venv` inside image is about `83M`; largest Python packages are SQLAlchemy and cryptography.
- Boot smoke passed: `/` returned `200`; `/api/system` returned `{"active_gpu_jobs":0,"queue_length":0,"free_vram_mb":99999}`.
- `validate_video()` was tested inside the modal ultraslim image against a bundled demo MP4 and returned `validate_video ok`.- `WMS_MODE` is authoritative in `entrypoint.sh`; stale old internal vars in an existing `.env` cannot make `WMS_MODE=modal` attempt local CUDA inference.
- `API_BASE_URL=auto` from older `.env` files is normalized to blank so frontend API routing remains self-detecting.
- Stale-env smoke test passed with `WMS_MODE=modal`, `INFERENCE_BACKEND_MODAL=false`, `FALLBACK_TO_LOCAL=true`, `LOCAL_DEVICE=cuda`, and `API_BASE_URL=auto`; the running process had `INFERENCE_BACKEND_MODAL=true`, `FALLBACK_TO_LOCAL=false`, `LOCAL_DEVICE=cpu`, and generated `window.__API_BASE_URL__=""`.


### 2.5 `/wms` Path-Mounted Frontend Fix - Commit `efa776d`

Problem observed by user:

- Hosted/path-mounted setup showed a blue background but not the full app UI.
- Likely cause: production assets/config/API paths were not lining up under `/wms/`.

What was changed:

- `frontend/vite.config.js` now sets production asset base to `/wms/`.
- `frontend/index.html` loads config from `/wms/config.js`.
- `frontend/src/main.jsx` detects pathname and chooses basename `/wms` when the browser is opened under `/wms`.
- `frontend/src/components/LiveDemo.jsx` detects `/wms` in the current path and resolves the API base accordingly when runtime config is blank/auto.
- `backend/app.py` includes the API router twice:
  - normal `/api/*`
  - compatibility `/wms/api/*` by including the same router with prefix `/wms`
- `backend/app.py` mounts the same SPA twice when dist exists:
  - `/wms`
  - `/`
- This supports both plain local root testing and path-mounted `/wms/` hosting.

Verification after this fix:

- `http://localhost/wms/` returned `200`.
- `http://localhost/wms/config.js` returned `200`.
- `http://localhost/wms/api/system` returned `200` JSON.

## 3. Current Runtime Facts

### 3.1 Backend/Uvicorn

- Docker working directory before uvicorn: `/app/backend`.
- Uvicorn target: `app:app`.
- Command in `entrypoint.sh`: `uvicorn app:app --host 0.0.0.0 --port 8000`.
- Container internal port: always `8000`.
- Host port: configured by compose from `PORT`.

### 3.2 Frontend Build/Static Serving

- Frontend source root: `frontend/`.
- Vite build output: `frontend/dist` locally.
- Docker copies built frontend to `/app/dist`.
- Runtime config template source: `frontend/public/config.template.js`.
- Runtime generated config path in container: `/app/dist/config.js`.
- Static serving candidates in backend include:
  - `/app/dist` via `../dist` from `/app/backend`
  - local `frontend/dist` via `../frontend/dist`
- FastAPI serves SPA at `/wms` and `/` when dist exists.

### 3.3 API Routes

Current active routes, from backend code:

| Method | Route | Auth behavior | Notes |
|---|---|---|---|
| `POST` | `/api/auth/google?token=...` | Google ID token query param | Returns app JWT/user info. |
| `GET` | `/api/auth/me` | Bearer JWT | Returns current user info/credits. |
| `POST` | `/api/payments/create-order?num_credits=N` | Bearer JWT | Creates Razorpay order. |
| `POST` | `/api/payments/verify` | Bearer JWT | Verifies Razorpay signature and credits user. |
| `POST` | `/api/upload?model_id=N&multiplier=N` | Bearer JWT | Validates video, debits non-admin credit, queues inference. |
| `GET` | `/api/status/{job_id}` | no auth in current code | Returns status/progress/model/multiplier. |
| `GET` | `/api/download/{job_id}` | Bearer JWT | Returns MP4 only for owning user. |
| `GET` | `/api/system` | no auth in current code | Returns active jobs, queue length, free VRAM. |

Because of the path-mounted fix, the same API is also reachable under `/wms/api/*` in current code.

### 3.4 Auth/Payments/Credits

- Google OAuth is frontend `GoogleOAuthProvider` plus backend token verification.
- `GOOGLE_CLIENT_ID` is injected into frontend runtime config.
- JWT sessions use `JWT_SECRET`.
- If `JWT_SECRET` is unset/empty, `entrypoint.sh` creates a random ephemeral secret and prints a dev-only warning.
- Razorpay key ID is injected into frontend runtime config.
- Razorpay key secret is used by backend to create/verify payments.
- Empty Google/Razorpay values do not block boot, but those flows will not work until configured.
- Interpolation upload requires auth/current user by current backend route behavior.

### 3.5 Ports And Localhost OAuth Behavior

- Compose publishes `127.0.0.1:${HOST_PORT:-8000}:8000`.
- `HOST_PORT=8000` exposes the app at `http://localhost:8000`.
- `HOST_PORT=80` exposes the app at plain `http://localhost` if host port 80 is free.
- The frontend defaults to same-origin API calls: opened at `/` it calls `/api`; opened at `/wms/` it calls `/wms/api`.
- `BASE_PATH` and `API_BASE_URL` are optional advanced overrides; normal local testing should not need them.
- The user needed plain `http://localhost` for Google OAuth origin matching during one test. Port 80 conflict occurred because something else was bound to it, likely WSL nginx.
- For any hosting control panel asking for container/internal port, use `8000`, not `3000`. This app does not run Vite dev server or Node in production.

## 4. Current `.env.example` Contract

Current template after Option B plus the three operational knobs:

```env
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

Mode suggestions:

```env
# Local GPU container, current default
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

```env
# Slim Modal-only container experiment, no local CUDA/Torch in image
WMS_MODE=modal
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

Important: setting only runtime internals such as `INFERENCE_BACKEND_MODAL=true` does not remove CUDA/Torch from an already-built local-GPU image. Image slimness is a build-time Docker target choice. Compose uses `WMS_MODE` to select `backend-local-gpu` or `backend-modal` before building, or you can explicitly build with `docker build --target backend-modal ...`.
## 5. Modal-Slim And HF Runtime-Pull Work

User asked whether `Modal=true` and local GPU false in `.env` would avoid downloading CUDA libs and make the image slim. The tested answer was no for runtime flags alone, then yes with one Dockerfile using two build targets selected by a flag.

### 5.1 Initial Runtime-Env Test: Did NOT Slim The Image

Before changing Dockerfile targets, a test image was built with runtime-ish env/build args set for Modal/local false. Result:

- Existing local-GPU image size was approximately `4,905,299,785` bytes.
- The modal-env test image was approximately `4,905,299,667` bytes.
- The one-off container still contained:
  - `torch: 2.13.0+cu130`
  - `torch_cuda: 13.0`
  - CUDA directory present
  - libtorch CUDA files present
- Conclusion: runtime `.env` flags cannot slim the image because Docker layers and pip packages are already installed at build time.
- The temporary modal-env test image was removed.

### 5.2 Implemented Single Dockerfile With Two Build Targets

Current Dockerfile behavior:

- `frontend` stage:
  - `FROM node:20-slim AS frontend`
  - installs `frontend/package*.json` with `npm ci`
  - copies `frontend/`
  - runs `npm run build`
- `backend-modal` stage:
  - `FROM python:3.12-slim AS backend-modal`
  - installs runtime packages only: curl, ffmpeg, gettext-base, OpenCV shared libs
  - creates `/opt/venv`
  - sets env defaults: `INFERENCE_BACKEND_MODAL=true`, `FALLBACK_TO_LOCAL=false`, `LOCAL_DEVICE=cpu`
  - copies `backend/requirements.txt`
  - filters out `torch`, `torchvision`, `torchaudio` using `grep -Ev '^(torch|torchvision|torchaudio)$'`
  - installs remaining backend requirements
  - copies only API/auth/db model files into `./backend/`
  - copies frontend dist and entrypoint
  - exposes 8000 and uses `/app/entrypoint.sh`
- `backend-local-gpu` stage:
  - `FROM nvidia/cuda:13.0.2-runtime-ubuntu24.04 AS backend-local-gpu`
  - installs Python, ffmpeg, curl, gettext, OpenCV shared libs
  - installs full `backend/requirements.txt`, including Torch packages
  - copies full `backend/`, including inference code/model loader files
  - copies frontend dist and entrypoint
  - exposes 8000 and uses `/app/entrypoint.sh`
- Last stage in Dockerfile is `backend-local-gpu`, so plain `docker build .` remains local-GPU by default.

### 5.3 Compose Target Flag

Current `docker-compose.yml` has:

```yaml
services:
  wms:
    build:
      context: .
      target: backend-${WMS_MODE:-local-gpu}
```

This lets `.env` choose the build target with `WMS_MODE`:

- `WMS_MODE=local-gpu` -> CUDA/Torch image.
- `WMS_MODE=modal` -> slim Python image, no CUDA/Torch.

Caveat: the compose file still contains an unconditional NVIDIA GPU reservation block:

```yaml
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: all
          capabilities: [gpu]
```

This is fine for local-GPU mode and `docker compose config` accepts it for `WMS_MODE=modal`, but a no-GPU cloud host may still reject `docker compose up` because GPU reservation is unconditional. Next Claude decision: make GPU reservation optional via a compose profile/override, or split GPU compose config if the owner accepts it.

### 5.4 Backend App Lazy Torch Change

Current `backend/app.py` changes:

- Removed top-level `import torch`.
- Added env detection:
  - `INFERENCE_BACKEND_MODAL`
  - `FALLBACK_TO_LOCAL`
  - `LOCAL_DEVICE`
- Added `torch_cuda_available()` that imports Torch lazily only if local device detection needs it.
- Added `detect_device()`:
  - returns `modal` when `INFERENCE_BACKEND_MODAL=true` and `FALLBACK_TO_LOCAL=false`
  - returns `cpu` when `LOCAL_DEVICE=cpu`
  - returns `cuda` only when `LOCAL_DEVICE=cuda` and `torch.cuda.is_available()` succeeds
  - otherwise falls back to CPU
- `DEVICE = detect_device()`.
- Upload route now rejects Modal-only mode with a clear placeholder until Modal adapter is implemented:
  - HTTP status `501`
  - detail: `Modal inference backend is selected, but the Modal adapter is not wired yet.`

Reason for this guard: the modal-slim image intentionally does not copy `infer_job.py`, `core_engine.py`, `model_engine.py`, or local model folders. It can serve frontend/API/auth/system, but cannot do local inference. Upload must fail clearly rather than queueing a job that will crash later.

### 5.5 Modal-Slim Experiment Verification

Commands run and results:

```powershell
python -m py_compile backend\app.py backend\auth.py backend\infer_job.py
```

Result: passed, exit code 0.

```powershell
docker compose config --quiet
```

Result: passed, exit code 0.

```powershell
$env:WMS_MODE = 'modal'
$env:HOST_PORT = '8000'
docker compose config --quiet
```

Result: passed, exit code 0.

```powershell
cd frontend
npm run build
```

Result: passed. Vite output included existing non-fatal warnings:

- Some chunks are larger than 500 kB after minification.
- `<script src="/wms/config.js">` cannot be bundled without `type="module"`; this warning is expected because `config.js` is a runtime-injected non-module script.

```powershell
docker build --target backend-modal -t wms-rifev3-app-wms:modal-slim-test .
```

Result: passed.

```powershell
docker build --target backend-local-gpu -t wms-rifev3-app-wms:local-gpu-test .
```

Result: passed.

Image size comparison:

```text
[wms-rifev3-app-wms:local-gpu-test] size=4905299864
[wms-rifev3-app-wms:modal-slim-test] size=426767476
```

Modal slim dependency check:

```text
{'torch_present': False, 'cuda_dir': False}
```

Local GPU dependency check:

```text
{'torch': '2.13.0+cu130', 'cuda': '13.0', 'cuda_dir': True}
```

Modal slim boot smoke test used a temporary container with no host port mapping and env override:

```powershell
docker run -d --name <temp> --env-file .env -e WMS_MODE=modal wms-rifev3-app-wms:modal-slim-test
```

Inside the container:

```text
root 200
system {"active_gpu_jobs":0,"queue_length":0,"free_vram_mb":99999}
```

Temporary smoke-test container was removed afterward.

## 6. Current Localhost / Google OAuth Notes

The user hit Google OAuth `origin_mismatch` while switching between `http://localhost` and `http://localhost:8000` origins.

Current behavior:

- `HOST_PORT=8000` -> open `http://localhost:8000/`.
- `HOST_PORT=80` -> open `http://localhost/` if port 80 is free.
- The browser API base is same-origin by default; `API_BASE_URL` is an optional override, not a normal local-test requirement.
- `BASE_PATH=auto` is the default; opened at `/` the app uses basename `/`, opened at `/wms/` it uses basename `/wms`.
- The user changed Google client ID and confirmed login worked during local testing.

Do not hardcode real Google client IDs in source. They belong in `.env`/host environment and runtime `config.js`.
## 7. Cloud / Path-Mount Notes

For the user's cloud domain UI screenshot:

- External host shown: `ansonsajugeorge.online`
- External path shown: `/wms/`
- Internal path should generally be `/` if the platform forwards to the app root.
- Container/internal port should be `8000`, not `3000`.
- This app's production image does not run Vite dev server and does not listen on 3000.
- If the platform strips `/wms` before forwarding, browser requests under `/wms` should still load because frontend assets are built with `/wms/` and backend also accepts `/api`.
- If the platform does not strip `/wms`, current backend also accepts `/wms/api/*` and serves SPA at `/wms`.
- The earlier blue screen likely came from path/base/config asset mismatch. Commit `efa776d` was made specifically to handle `/wms` path-mounted frontend and API compatibility.

## 8. Known Stale Or Conflicting Docs After Latest Work

These are important for Claude if doing another docs pass:

- `README.md` currently says: `The Vite production build uses base: "/".`
  - Current code says `frontend/vite.config.js` uses `base: "/wms/"`.
  - The README integrated gateway section should be updated if the `/wms` base behavior remains.
- `docs/Project-Status.md` says audited against working tree based on `0f04e63`.
  - Current HEAD is `efa776d`, with additional uncommitted Docker/backend changes.
  - It should be updated after accepting/committing the modal-slim experiment.
- `docs/Project-Status.md` currently says Modal/env variables are placeholders and not consumed by backend.
  - After the uncommitted backend change, `INFERENCE_BACKEND_MODAL`, `FALLBACK_TO_LOCAL`, and `LOCAL_DEVICE` are consumed by `backend/app.py` for device/mode selection.
  - Modal adapter itself is still not implemented.
- `docs/Project-Status.md` currently says the Vite production build uses root/static behavior from the earlier containerization step.
  - Current code serves both `/` and `/wms` and builds assets under `/wms/`.

## 9. Verification History To Preserve

Keep these results in mind before changing behavior:

### Docs/forbidden-path checks

- A forbidden tracked-path check for `train_log`, `.env`, `app.db`, and `node_modules` returned empty output after the reorganization. Earlier checks also included `env_files`; Option B removed that convention.
- Current `git status --short` should show no tracked secrets/weights/db/node_modules; `image.png` is still an untracked screenshot artifact unless the owner removes it locally.

### Frontend build

- `npm run build` from `frontend/` passes.
- Vite version in output: `vite v7.3.1`.
- Non-fatal warnings remain:
  - large JS chunk over 500 kB
  - runtime `/wms/config.js` script warning because it is a non-module runtime config script.

### Python syntax

- `python -m py_compile backend\app.py backend\auth.py backend\infer_job.py` passed after both the local-GPU work and the modal-slim lazy-Torch edit.

### Compose

- `docker compose config --quiet` passed.
- Compose config with `WMS_MODE=modal HOST_PORT=8000` also passed.

### Local-GPU end to end

- Earlier current local-GPU container completed upload -> status done -> download valid MP4.
- VRAM was used by subprocess during inference and returned to idle baseline after subprocess exit.
- Parent FastAPI process did not retain persistent CUDA residency after job completion.

### Modal-slim target

- `backend-modal` target builds successfully.
- Current ultraslim modal image is about 285.5 MB; the earlier broad filtered modal image was about 427 MB.
- It contains no Torch, CUDA, OpenCV, NumPy, imageio, or baked model folders. It keeps `ffmpeg`/`ffprobe` for preprocessing/postprocessing.
- It boots FastAPI/static frontend and `/api/system` without CUDA/Torch.
- Upload is intentionally guarded with `501` because Modal adapter is not wired yet.

## 10. Commands Useful For Claude

Local GPU default build/run:

```powershell
cp .env.example .env
# edit .env with local values if needed
# WMS_MODE=local-gpu selects the local GPU image
docker compose up --build
```

Slim modal build target:

```powershell
$env:BUILD_TARGET = 'backend-modal'
docker compose build wms
```

Direct slim build:

```powershell
docker build --target backend-modal -t wms-rifev3-app-wms:modal-slim-test .
```

Direct local GPU build:

```powershell
docker build --target backend-local-gpu -t wms-rifev3-app-wms:local-gpu-test .
```

Check image sizes:

```powershell
docker image inspect wms-rifev3-app-wms:local-gpu-test wms-rifev3-app-wms:modal-slim-test --format "{{.RepoTags}} size={{.Size}}"
```

Check modal image has no Torch/CUDA:

```powershell
docker run --rm --entrypoint python wms-rifev3-app-wms:modal-slim-test -c "import importlib.util, os; print({'torch_present': importlib.util.find_spec('torch') is not None, 'cuda_dir': os.path.isdir('/usr/local/cuda')})"
```

Check local GPU image still has Torch/CUDA:

```powershell
docker run --rm --entrypoint python wms-rifev3-app-wms:local-gpu-test -c "import torch, os; print({'torch': torch.__version__, 'cuda': torch.version.cuda, 'cuda_dir': os.path.isdir('/usr/local/cuda')})"
```

Smoke-test modal image without host port collision:

```powershell
$name = 'wms-modal-slim-smoke-' + (Get-Random)
docker run -d --name $name --env-file .env -e WMS_MODE=modal -e HOST_PORT=8000 wms-rifev3-app-wms:modal-slim-test
docker exec $name sh -lc "printf 'root '; curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/; printf 'system '; curl -s http://localhost:8000/api/system; printf '\n'"
docker rm -f $name
```

Forbidden tracked-path check:

```powershell
git ls-files | Select-String -Pattern 'train_log|(^|/)\.env$|app\.db|node_modules'
```

Before committing anything:

```powershell
git status --short
git diff --stat
git diff -- .env.example Dockerfile backend/app.py docker-compose.yml codex.md
```

## 11. Recommended Next Steps

1. Modal adapter remains next.
   - The slim `backend-modal` target works as an API/static shell, but it does not implement Modal inference yet.
   - Upload returns a clean `501` in Modal-only mode until adapter work is done.
   - HF runtime pull keeps `backend/train_log*` out of the Docker build context for local-GPU mode.

2. Make GPU reservation optional before relying on `WMS_MODE=modal` on CPU/no-GPU cloud.
   - Current compose GPU reservation is unconditional.
   - Best likely approach, while preserving one primary compose file: use a Compose profile or a separate override only if user accepts it.
   - Do not create provider-specific config.

3. If committing the modal-slim experiment, stage only intended files.
   - Intended files:
     - `.env.example`
     - `Dockerfile`
     - `backend/app.py`
     - `docker-compose.yml`
     - `codex.md` if this handoff update should be committed
   - Do not stage:
     - `.env`
     - `image.png`
     - model weights/folders if untracked
     - `backend/storage/`
     - `backend/app.db`
     - `node_modules/`
     - `frontend/dist/` unless intentionally tracked already

4. Update stale active docs after the modal-slim decision.
   - `README.md` needs the `/wms/` Vite base correction.
   - `docs/Project-Status.md` needs a new audit timestamp/commit and updated Modal/env status.

5. Modal adapter remains out of scope/not done.
   - There is no real Modal upload/inference/download path in backend yet.
   - `MODAL_ENDPOINT_URL` and `MODAL_TOKEN` are still placeholders until adapter implementation.

## 12. Guardrails For The Next Agent

- Source code/config is source of truth.
- Do not fabricate benchmark numbers or claim Modal is implemented.
- Do not commit `.env`, secrets, model weights, local DB, storage, node_modules, or screenshot artifacts.
- Do not touch sibling apps or any master compose file.
- Internal container port remains `8000`.
- Production image runs one process: FastAPI/uvicorn serving static frontend and API. No Vite dev server in production.
- Local GPU inference must remain subprocess-isolated so FastAPI parent does not retain CUDA VRAM after each job.
- If changing Docker/compose mode behavior, re-run at minimum:
  - `python -m py_compile backend\app.py backend\auth.py backend\infer_job.py`
  - `cd frontend && npm run build`
  - `docker compose config --quiet`
  - modal target build/contents check if touching Dockerfile
  - local GPU target build/contents check if touching Dockerfile
## 13. Latest Simplified Env Contract Update

The user chose Option B plus three operational knobs. The active design is now five normal `.env` variables, no tracked `frontend/jsconfig.json`, no `secrets/` volume mount, no `env_files` convention, and no `.gitkeep` placeholder.

Active `.env.example` exposes these normal knobs:

```env
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

Meaning:

- `WMS_MODE=local-gpu` maps compose build target to `backend-local-gpu`, keeps CUDA/Torch, and downloads model folders from Hugging Face at startup when missing.
- `WMS_MODE=modal` maps compose build target to `backend-modal`, keeps the ~285 MB API/static image, skips local model download, and has no CUDA/Torch/OpenCV/NumPy/imageio/model folders.
- `HOST_PORT=8000` exposes `http://localhost:8000`; `HOST_PORT=80` exposes plain `http://localhost` if port 80 is free.
- Container internal port remains `8000` in every mode.
- `MAX_CONCURRENCY` is now wired to `backend/app.py` worker thread count and active local inference subprocess cap.
- `RATE_WINDOW_SECONDS` and `RATE_MAX_REQUESTS` are now wired to an in-memory upload limiter per authenticated user; either `0` disables the limiter, and counts reset on restart.

Optional advanced values are still normal environment variables, but intentionally not part of the short template. Add them only when needed in `.env`, the Compose environment, or the host dashboard:

```text
GOOGLE_CLIENT_ID
JWT_SECRET
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
MODAL_ENDPOINT_URL
MODAL_TOKEN
BASE_PATH
API_BASE_URL
```

`entrypoint.sh` now defaults missing frontend public values to blank, defaults `BASE_PATH=auto` and `API_BASE_URL=` for same-origin routing, and generates a dev-only ephemeral `JWT_SECRET` when no JWT secret is provided. There is no runtime read from `/app/secrets` anymore and `docker-compose.yml` does not mount `./secrets`.

`frontend/jsconfig.json` was removed because Vite already owns the `@` alias in `frontend/vite.config.js`. The app should continue to build as long as that alias remains in Vite config.

Frontend path/API behavior remains self-detecting by default:

- `API_BASE_URL` defaults to blank, so frontend calls same-origin `/api` or `/wms/api` depending on browser path.
- `BASE_PATH` defaults to `auto`, so React Router uses `/` or `/wms` depending on browser path.
- Advanced env overrides still work but are intentionally not listed as active template keys.

Dockerfile image-level mode defaults remain:

- `backend-modal`: `WMS_MODE=modal`
- `backend-local-gpu`: `WMS_MODE=local-gpu`

Verification after this Option B cleanup:

- `cd frontend && npm run build`: passed with Vite `v7.3.1` after deleting `frontend/jsconfig.json`; existing non-fatal warnings remain for `/wms/config.js` as a runtime non-module script and a JS chunk over 500 kB.
- `python -m py_compile backend\app.py backend\auth.py backend\download_models.py backend\infer_job.py`: passed.
- `docker compose config --quiet`: passed with default mode.
- `WMS_MODE=modal HOST_PORT=8000 docker compose config --quiet`: passed.
- `git ls-files | Select-String -Pattern 'train_log|(^|/)\.env$|app\.db|node_modules'`: empty output.
- `entrypoint.sh` line ending check: LF-only, no CRLF.

Not re-run in this cleanup: Docker image rebuild/smoke. Previous modal-slim and HF-pull Docker build/smoke results remain recorded above, but this exact entrypoint cleanup has not been image-rebuilt yet.

Caveat still present: the single `docker-compose.yml` keeps the NVIDIA GPU reservation block for local-GPU mode. Compose cannot conditionally remove that block from one service based on `WMS_MODE`; if a no-GPU Modal host rejects the reservation, move that block to a local override/profile or split services.