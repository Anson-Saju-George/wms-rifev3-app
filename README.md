# Web Motion Synthesis (WMS)

Web Motion Synthesis is a React 19/Vite 7 frontend plus FastAPI backend for RIFE-based video frame interpolation. The production container serves the built frontend and `/api/*` from one FastAPI process on internal port `8000`.

An earlier implementation-status snapshot (now outdated) is archived at [docs/archive/Project-Status.md](docs/archive/Project-Status.md).

## Local Container Run

```bash
cp .env.example .env
docker compose up --build
```

`.env` starts with these local run knobs:

```env
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
MAX_FILE_SIZE_MB=100
MAX_VIDEO_SECONDS=300
MODAL_TIMEOUT_SECONDS=3600
INFERENCE_BACKEND_MODAL=
FALLBACK_TO_LOCAL=
```

`WMS_MODE=local-gpu` builds the CUDA/Torch target and downloads the three RIFE model folders from Hugging Face at startup if they are missing. `WMS_MODE=modal` builds the slim API/static target, with no CUDA/Torch/OpenCV/NumPy/imageio/model folders, while keeping `ffmpeg`/`ffprobe` for upload validation and audio postprocessing. Leave `INFERENCE_BACKEND_MODAL` and `FALLBACK_TO_LOCAL` blank to use the `WMS_MODE` defaults, or set them explicitly for deploys.

`HOST_PORT=8000` opens at `http://localhost:8000`. Use `HOST_PORT=80` for plain `http://localhost`; that port must be free. The container internal port is always `8000`.

`MAX_CONCURRENCY` controls backend worker threads and caps active local inference subprocesses. `RATE_WINDOW_SECONDS` and `RATE_MAX_REQUESTS` apply an in-memory upload limiter per authenticated user; set either rate value to `0` to disable it. The limiter resets on container restart.

`MAX_FILE_SIZE_MB` and `MAX_VIDEO_SECONDS` are enforced by `/api/upload` at container startup. `MODAL_TIMEOUT_SECONDS` is read by `backend/modal_app.py` during `modal run`/`modal deploy`; redeploy Modal after changing it.

GPU inference in local-GPU mode requires an NVIDIA driver plus NVIDIA Container Toolkit. Compose currently keeps the GPU reservation in the single service; if a no-GPU Modal host rejects that reservation, move the GPU device block to a local override/profile before deploying there.

Optional Google, Razorpay, JWT, and Modal token values can still be added as normal environment variables in `.env` or the host dashboard when those flows are needed. For Modal, set `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` after deploying `backend/modal_app.py`; `MODAL_APP_NAME` and `MODAL_FUNCTION_NAME` default to `wms-rife` and `interpolate` when blank. If `JWT_SECRET` is omitted, startup generates an ephemeral dev-only secret and sessions reset on restart.


## Modal Inference

One-time owner setup:

```bash
modal setup
modal volume put wms-rife-weights ./backend/train_log /train_log
modal volume put wms-rife-weights ./backend/train_log_wms /train_log_wms
modal volume put wms-rife-weights ./backend/train_log_wms_custom_loss /train_log_wms_custom_loss
modal run backend/modal_app.py --input backend/samples/video_1.mp4
modal deploy backend/modal_app.py
```

After the Modal app is deployed and token env vars are present, set:

```env
WMS_MODE=modal
INFERENCE_BACKEND_MODAL=true
FALLBACK_TO_LOCAL=false
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=
MODAL_APP_NAME=
MODAL_FUNCTION_NAME=
```

The `/api/upload`, `/api/status/{job_id}`, and `/api/download/{job_id}` contract stays unchanged. Modal jobs are dispatched asynchronously and `/api/status/{job_id}` writes the returned MP4 to local output storage when the Modal call completes.
## Local Dev Run

Backend:

```bash
pip install -r backend/requirements.txt
cd backend
uvicorn app:app --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Vite proxies both `/api/*` and `/wms/api/*` to the backend at `http://localhost:8000`.

## Integrated Gateway

The frontend and API base path are auto-detected from the browser URL. Opened at `/`, the app calls `/api`; opened at `/wms/`, it calls `/wms/api`. FastAPI serves the same SPA at both `/` and `/wms`, and accepts both `/api/*` and `/wms/api/*`.

For hosting panels, set the container/internal port to `8000`, not `3000`. The production image does not run the Vite dev server.