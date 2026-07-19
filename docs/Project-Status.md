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

`.env.example` currently declares these active normal knobs:

```env
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

Implemented effects: `WMS_MODE` selects the Docker build target and `entrypoint.sh` sets local-GPU vs Modal-only runtime defaults; `HOST_PORT` is used by compose for localhost port publishing; `MAX_CONCURRENCY` controls backend worker thread count and caps active local inference subprocesses; `RATE_WINDOW_SECONDS` and `RATE_MAX_REQUESTS` enforce an in-memory upload rate limit per authenticated user. `BASE_PATH`, `API_BASE_URL`, `GOOGLE_CLIENT_ID`, and `RAZORPAY_KEY_ID` remain optional runtime frontend config values; `JWT_SECRET` is read by `backend/auth.py`; Razorpay backend keys are read by `backend/app.py`.

## 5. Known Gaps / Limitations

- Modal inference is not implemented yet; `MODAL_ENDPOINT_URL` and `MODAL_TOKEN` remain placeholders until the Modal adapter is added.
- The upload rate limiter is in-process memory only; counts reset on container restart and are not shared across multiple app replicas. `DATABASE_URL` remains hardcoded in `backend/database.py` rather than read from env.
- Job status/progress is still in process memory.
- `/api/status/{job_id}` and `/api/system` are unauthenticated by current code.
- `docker compose up` requires the selected localhost `HOST_PORT` to be free. `HOST_PORT=8000` maps to `http://localhost:8000`; `HOST_PORT=80` maps to plain `http://localhost`.
- UI research PSNR/SSIM, dataset-size, hardware, and publication claims remain UNVERIFIED by local benchmark/report files.

## 6. Verification Snapshot

- `cd frontend && npm run build`: passed after the folder move; Vite still reports the existing >500 kB chunk warning.
- `python -m py_compile backend\\app.py backend\\auth.py backend\\infer_job.py`: passed after the folder move.
- `docker compose config`: passed after the folder move.
- GPU smoke container previously completed three upload/status/download runs through `/api/*`; downloaded MP4s opened with OpenCV.
- Forbidden tracked-path check returned empty output for `train_log`, `.env`, `app.db`, and `node_modules`; earlier checks also covered the removed `env_files` convention.