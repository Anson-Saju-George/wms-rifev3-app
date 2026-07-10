# Web Motion Synthesis (WMS)

Web Motion Synthesis is a React/Vite frontend plus FastAPI backend for RIFE-based video frame interpolation. The live UI is mounted at `/wms`, and frontend API calls use `/wms/api`, which Vite rewrites to a backend expected at `http://localhost:8000`.

For the full audited implementation status, endpoint list, configuration notes, and documentation discrepancy table, see [Project-Status.md](Project-Status.md).

## Run Contract

### Standalone frontend

```bash
npm install
npm run dev
```

The Vite app uses `base: "/wms/"` and a `BrowserRouter basename="/wms"`. The dev server proxy maps `/wms/api/*` to `http://localhost:8000/*`.

### Backend for integrated demo

Install both Python requirement files, then run the backend from the `backend` directory so its local imports resolve:

```bash
pip install -r requirements.txt -r backend/requirements.txt
cd backend
uvicorn app:app --host 127.0.0.1 --port 8000
```

Required environment variables are read by code, not supplied by an `.env.example` in this repo:

- `GOOGLE_CLIENT_ID`
- `JWT_SECRET`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

The backend selects local PyTorch inference with `cuda` when available and `cpu` otherwise. No Modal.com inference integration was found during the audit; "Modal" occurrences in source are UI payment modal components.

## Verification Snapshot

- `npm run build`: passed during the audit.
- `npm run lint`: failed on existing frontend lint issues; details are in [Project-Status.md](Project-Status.md).
- Docker, docker-compose, CI, and `.env.example` files were not present in the repository inventory.
