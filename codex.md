# Codex Handoff - WMS

## Current Layout

- `frontend/`: Vite/React app, including `public/config.template.js`, `src/`, `index.html`, package files, Vite/ESLint/jsconfig/shadcn config.
- `backend/`: FastAPI app and RIFE inference code. Internal backend imports were left unchanged.
- `docs/Project-Status.md`: active status/audit document.
- `secrets/`: local gitignored folder for future mounted credentials.
- Root keeps Docker/compose/entrypoint/env template/README.

## Runtime Facts

- Uvicorn target: `app:app` from `/app/backend` in Docker, or `backend/app.py` when run locally from `backend/`.
- Vite build output: default `dist`, now located at `frontend/dist` locally and copied to `/app/dist` in Docker.
- API routes are mounted under `/api/*`.
- FastAPI serves the SPA after the API router is registered.
- Local inference runs in `backend/infer_job.py` subprocesses; parent process keeps audio merge and API orchestration.
- Parent VRAM checks use `nvidia-smi`, not parent-side Torch CUDA memory calls.

## Local .env

Copy `.env.example` to `.env`. For zero-config local boot, all secret values can remain empty:

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

Notes: `JWT_SECRET` should be set for stable sessions; if empty, the backend generates an ephemeral dev-only secret at startup. Google/Razorpay can be empty for boot and interpolation testing, but their UI flows will not work until real values are added. Modal/rate/concurrency envs are declared for later and are not wired yet. `LOCAL_DEVICE=cuda` is the future-correct local-GPU value, but the current backend auto-detects CUDA and does not read it yet. Compose binds `127.0.0.1:${PORT:-8000}:8000`. Current local run uses `PORT=8000` and `API_BASE_URL=auto`, which entrypoint resolves to `http://localhost:8000`. Set `PORT=80` with `API_BASE_URL=auto` to resolve to `http://localhost`; port 80 must be free, and WSL nginx was stopped during local testing because it owned that port.

## Verification After Reorganization

- `cd frontend && npm run build`: passed; Vite still reports the existing >500 kB chunk warning.
- `python -m py_compile backend\app.py backend\auth.py backend\infer_job.py`: passed.
- `docker compose config`: passed.
- Forbidden tracked-path PowerShell check for `train_log`, `env_files`, `.env`, `app.db`, and `node_modules`: empty output.

## Earlier GPU/Upload Verification

- HF upload was run for `backend/train_log`, `backend/train_log_wms`, and `backend/train_log_wms_custom_loss` to `Anson-Saju-George/wms-rifev3-models-all-3`; CLI indicated remote files already matched.
- Previous CUDA 13 image smoke: `GET /` returned `200`; `GET /api/system` returned system JSON; three GPU upload/status/download jobs completed and produced valid MP4s.
- VRAM rose while the subprocess was active and compute-app entries disappeared after completion.
- Current local run is bound at `127.0.0.1:80->8000`; `GET http://localhost/` and `GET http://localhost/api/system` returned OK.