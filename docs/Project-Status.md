# Project Status - Web Motion Synthesis (WMS)

**Last audited:** 2026-07-19
**Audited against:** working tree based on commit `0f04e63`

## 1. What This Project Actually Is

WMS is a React 19/Vite 7 frontend plus FastAPI backend for RIFE video frame interpolation. The repo is organized as `frontend/` for the Vite app and `backend/` for the FastAPI/RIFE implementation. The production container is one process: `entrypoint.sh` renders `dist/config.js`, then runs `uvicorn app:app --host 0.0.0.0 --port 8000` from `/app/backend`. FastAPI serves API routes under `/api/*` and serves the prebuilt frontend from `/app/dist` in Docker or `frontend/dist` locally.

## 2. Current Implementation State

| Area | Current implementation | Evidence |
|---|---|---|
| Frontend package | Vite package moved under `frontend/`. | `frontend/package.json`, `frontend/vite.config.js`, `frontend/src/main.jsx` |
| Frontend build output | Vite default output directory, `frontend/dist`; Docker copies it to `/app/dist`. | `frontend/vite.config.js`, `Dockerfile` |
| Frontend base path | Runtime `window.__BASE_PATH__`; default `/`; integrated deployments can set `/wms/`. | `frontend/public/config.js`, `frontend/public/config.template.js`, `frontend/src/main.jsx` |
| Frontend API base | Runtime `window.__API_BASE_URL__` plus `/api`; `entrypoint.sh` derives it from `PORT` when `API_BASE_URL=auto`; integrated deployments can set `/wms`. | `entrypoint.sh`, `frontend/src/components/LiveDemo.jsx` |
| Backend entry point | `backend/app.py` creates `app = FastAPI()` and includes `APIRouter(prefix="/api")`. | `backend/app.py` |
| Static serving | API router is included first; SPA static mount is registered at `/` after routes. | `backend/app.py` |
| Container runtime | Multi-stage Docker build: Node 20 builds frontend; CUDA 13 runtime runs Python/FastAPI. | `Dockerfile` |
| Container port | Internal port is always `8000`; compose publishes `127.0.0.1:${PORT:-8000}:8000`, defaulting to localhost `8000`. | `entrypoint.sh`, `docker-compose.yml` |
| Inference isolation | Worker launches `backend/infer_job.py` per job; the subprocess loads RIFE and exits after completion. | `backend/app.py`, `backend/infer_job.py` |
| Parent CUDA usage | Parent checks device with `torch.cuda.is_available()` only and queries free VRAM through `nvidia-smi`. | `backend/app.py` |
| Model weights | Local `backend/train_log*` folders are required for local inference but are gitignored/untracked. | `.gitignore`, `backend/model_engine.py` |
| Storage | Runtime storage stays under `backend/storage/`; SQLite stays at `backend/app.db` when backend runs from `backend/`. | `backend/app.py`, `backend/database.py` |
| Auth/payments | Google token verification, JWT sessions, Razorpay order creation/verification, and non-admin credit spending are implemented. Empty `JWT_SECRET` boots with an ephemeral dev-only secret. | `backend/auth.py`, `backend/app.py` |
| Modal/rate envs | Modal, fallback, concurrency, rate-limit, and `DATABASE_URL` env vars are declared but not consumed by current backend code. | `.env.example`; `rg` found no backend usage for these keys |

## 3. Endpoints / API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/google?token=...` | Google ID token in query parameter | Verify Google token and return JWT, email, role. |
| GET | `/api/auth/me` | Bearer JWT | Return email, role, total credits, used credits. |
| POST | `/api/payments/create-order?num_credits=N` | Bearer JWT | Create Razorpay order for credits. |
| POST | `/api/payments/verify` | Bearer JWT | Verify Razorpay signature and add credits. |
| POST | `/api/upload?model_id=N&multiplier=N` | Bearer JWT | Upload one video, validate, debit credit for non-admin users, enqueue job. |
| GET | `/api/status/{job_id}` | None | Return job status, progress, model ID, and multiplier. |
| GET | `/api/download/{job_id}` | Bearer JWT | Return processed MP4 if the job belongs to the user. |
| GET | `/api/system` | None | Return active GPU job count, queue length, and free VRAM. |

## 4. Configuration

`.env.example` currently declares:

```env
PORT=8000
BASE_PATH=/
API_BASE_URL=auto
INFERENCE_BACKEND_MODAL=false
FALLBACK_TO_LOCAL=true
LOCAL_DEVICE=cuda
MODAL_ENDPOINT_URL=
MODAL_TOKEN=
MAX_CONCURRENCY=1
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
DATABASE_URL=sqlite:///./app.db
GOOGLE_CLIENT_ID=
JWT_SECRET=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Implemented effects: `PORT` is used by compose for host port publishing and by `entrypoint.sh` to derive `API_BASE_URL` when it is blank or `auto`; `BASE_PATH`, resolved `API_BASE_URL`, `GOOGLE_CLIENT_ID`, and `RAZORPAY_KEY_ID` are rendered into frontend runtime config by `entrypoint.sh`; `JWT_SECRET` is read by `backend/auth.py`; Razorpay backend keys are read by `backend/app.py`.

## 5. Known Gaps / Limitations

- Modal inference is not implemented yet; `INFERENCE_BACKEND_MODAL`, `MODAL_ENDPOINT_URL`, `MODAL_TOKEN`, and `FALLBACK_TO_LOCAL` are placeholders today.
- `LOCAL_DEVICE` is documented as `cuda` for local-GPU runs, but current code still auto-detects `cuda`/`cpu` with `torch.cuda.is_available()` and does not read this env var yet. `MAX_CONCURRENCY`, `RATE_WINDOW_SECONDS`, `RATE_MAX_REQUESTS`, and `DATABASE_URL` are also declared but not currently wired to backend behavior.
- Job status/progress is still in process memory.
- `/api/status/{job_id}` and `/api/system` are unauthenticated by current code.
- `docker compose up` requires the selected localhost `PORT` to be free. With `API_BASE_URL=auto`, changing `PORT` is enough for local host-origin changes.
- UI research PSNR/SSIM, dataset-size, hardware, and publication claims remain UNVERIFIED by local benchmark/report files.

## 6. Verification Snapshot

- `cd frontend && npm run build`: passed after the folder move; Vite still reports the existing >500 kB chunk warning.
- `python -m py_compile backend\\app.py backend\\auth.py backend\\infer_job.py`: passed after the folder move.
- `docker compose config`: passed after the folder move.
- GPU smoke container previously completed three upload/status/download runs through `/api/*`; downloaded MP4s opened with OpenCV.
- Forbidden tracked-path check returned empty output for `train_log`, `env_files`, `.env`, `app.db`, and `node_modules` after the folder move.