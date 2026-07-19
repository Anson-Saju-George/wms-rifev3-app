# Web Motion Synthesis (WMS)

Web Motion Synthesis is a React 19/Vite 7 frontend plus FastAPI backend for RIFE-based video frame interpolation. The repo is split into `frontend/` for Vite and `backend/` for FastAPI/RIFE; the production container serves the built frontend and `/api/*` from one FastAPI process on internal port `8000`.

For audited implementation status and verification notes, see [docs/Project-Status.md](docs/Project-Status.md).

## Local Container Run

```bash
cp .env.example .env
docker compose up --build
```

Open `http://localhost:8000/` by default. `docker-compose.yml` publishes `127.0.0.1:${PORT:-8000}:8000`. With `API_BASE_URL=auto`, `entrypoint.sh` derives `http://localhost` when `PORT=80`; otherwise it derives `http://localhost:<PORT>`.

GPU inference requires an NVIDIA driver plus NVIDIA Container Toolkit. On a CPU-only host the app still boots and selects `DEVICE=cpu`, but local inference will be slow.

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

Use the same container behind the gateway. Set runtime config like this:

```env
BASE_PATH=/wms/
API_BASE_URL=/wms
```

The Vite production build uses `base: "/"`. In integrated mode the gateway strips `/wms` before proxying to the container, so browser requests to `/wms/api/*` reach the backend as `/api/*`.

## Environment

Copy `.env.example` to `.env`. `JWT_SECRET`, `GOOGLE_CLIENT_ID`, and Razorpay keys can be empty for a zero-config boot, but Google login/payments will not work until their real values are set. If `JWT_SECRET` is empty, startup generates an ephemeral dev-only secret and sessions reset on restart.

Current inference is local-only. Modal-related variables are placeholders for the next step; `FALLBACK_TO_LOCAL=true` is in the template, but Modal routing is not implemented yet.

## OAuth localhost mode

For Google OAuth origins that only allow plain `http://localhost`, set local `.env` to `PORT=80` and keep `API_BASE_URL=auto`. Compose will publish `127.0.0.1:80->8000`, and `config.js` will use `http://localhost`.
