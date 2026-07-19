# Web Motion Synthesis (WMS)

Web Motion Synthesis is a React 19/Vite 7 frontend plus FastAPI backend for RIFE-based video frame interpolation. The production container serves the built frontend and `/api/*` from one FastAPI process on internal port `8000`.

For audited implementation status and verification notes, see [docs/Project-Status.md](docs/Project-Status.md).

## Local Container Run

```bash
cp .env.example .env
docker compose up --build
```

`.env` intentionally has five normal knobs:

```env
WMS_MODE=local-gpu
HOST_PORT=8000
MAX_CONCURRENCY=3
RATE_WINDOW_SECONDS=3600
RATE_MAX_REQUESTS=20
```

`WMS_MODE=local-gpu` builds the CUDA/Torch target and downloads the three RIFE model folders from Hugging Face at startup if they are missing. `WMS_MODE=modal` builds the slim API/static target, with no CUDA/Torch/OpenCV/NumPy/imageio/model folders, while keeping `ffmpeg`/`ffprobe` for upload validation and audio postprocessing.

`HOST_PORT=8000` opens at `http://localhost:8000`. Use `HOST_PORT=80` for plain `http://localhost`; that port must be free. The container internal port is always `8000`.

`MAX_CONCURRENCY` controls backend worker threads and caps active local inference subprocesses. `RATE_WINDOW_SECONDS` and `RATE_MAX_REQUESTS` apply an in-memory upload limiter per authenticated user; set either rate value to `0` to disable it. The limiter resets on container restart.

GPU inference in local-GPU mode requires an NVIDIA driver plus NVIDIA Container Toolkit. Compose currently keeps the GPU reservation in the single service; if a no-GPU Modal host rejects that reservation, move the GPU device block to a local override/profile before deploying there.

Optional Google, Razorpay, JWT, and future Modal values can still be added as normal environment variables in `.env` or the host dashboard when those flows are needed. The default template keeps them out so local inference testing only needs the five normal knobs above. If `JWT_SECRET` is omitted, startup generates an ephemeral dev-only secret and sessions reset on restart.

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