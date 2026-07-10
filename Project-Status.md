# Project Status - Web Motion Synthesis (WMS)

**Last audited:** 2026-07-10  
**Audited against commit:** `7c0a592`

## 1. What This Project Actually Is

This repository contains a React 19/Vite 7 frontend and a FastAPI backend for a web video frame interpolation demo. The frontend renders marketing/research pages and an authenticated live demo at the `/wms` base path; the backend accepts video uploads, queues local PyTorch/RIFE interpolation jobs, tracks status in process memory plus SQLite job/user rows, and returns processed MP4 files. Evidence: `package.json:6-10`, `package.json:21-23`, `vite.config.js:7-14`, `src/main.jsx:9-14`, `backend/app.py:65`, `backend/app.py:413-522`, `backend/model_engine.py:18-54`, `backend/core_engine.py:91-127`.

## 2. Current Implementation State

| Area | Current implementation | Evidence |
|---|---|---|
| Frontend entry point | Vite app from `index.html` to `src/main.jsx`; React Router basename is `/wms`. | `index.html`, `src/main.jsx:9-14` |
| Frontend routes | `/wms/` and `/wms/research`. | `src/App.jsx:1`, `src/App.jsx:23` |
| Frontend API base | Browser calls use `/wms/api`. | `src/components/LiveDemo.jsx:28` |
| Vite dev proxy | `/wms/api` proxies to `http://localhost:8000` and strips `/wms/api`. | `vite.config.js:11-14` |
| Backend entry point | `backend/app.py` creates `app = FastAPI()`. | `backend/app.py:65` |
| Backend run port | No backend port is bound in code; run scripts must choose one. The frontend config expects backend port `8000`. | `vite.config.js:12`; no Docker/compose files in `rg --files` inventory |
| Docker/compose/CI | No `Dockerfile`, `docker-compose*.yml`, or `.github` workflow files found in inventory. | `rg --files ...` and `Get-ChildItem -Force .github` returned no files |
| Inference backend | Local PyTorch inference. Device is `cuda` if available, else `cpu`; no Modal.com backend integration found. | `backend/app.py:49`, `backend/app.py:137`, `backend/model_engine.py:51-54`; `rg -n "\bModal\b|\bmodal\b|modal.com" backend src package.json vite.config.js` only found UI modal names |
| Model variants | IDs `0`, `1`, `2` load checkpoints from `backend/train_log`, `backend/train_log_wms`, and `backend/train_log_wms_custom_loss`. | `backend/app.py:46`, `backend/model_engine.py:18-36` |
| Interpolation multipliers | Supported backend multipliers are `2`, `3`, `4`; UI exposes `2x`, `3x`, `4x`. | `backend/app.py:47`, `src/components/LiveDemo.jsx:488-490` |
| Storage | Uploads and outputs are under `backend/storage/uploads` and `backend/storage/outputs`, created at startup and gitignored. | `backend/app.py:51-56`, `.gitignore` |
| Database | SQLite at `sqlite:///./app.db`, relative to backend process working directory. | `backend/database.py:4-8` |
| Auth | Google token verification and JWT sessions. Tokens expire after 30 days. | `backend/auth.py:15-20`, `backend/auth.py:54`, `backend/auth.py:60` |
| Admin role | One hard-coded admin email; other users default to `user`. | `backend/auth.py:22-24`, `backend/auth.py:75` |
| Payments/credits | Razorpay order creation and signature verification; non-admin users spend credits for uploads. | `backend/app.py:32-35`, `backend/app.py:359-408`, `backend/app.py:413-436` |
| Queue and workers | In-memory queue; max queue length 10; 3 worker threads; workers wait for fewer than 3 active GPU jobs and more than 1200 MB free VRAM. | `backend/app.py:40`, `backend/app.py:58-59`, `backend/app.py:197`, `backend/app.py:250` |
| Validation limits | 100 MB upload size, 5 minute duration, 4K resolution. | `backend/app.py:37-41`, `backend/app.py:174-177`, `backend/app.py:436` |
| Cleanup | Output/upload purge after 60 minutes idle; model offload after 20 minutes idle. | `backend/app.py:43-44`, `backend/app.py:283-287` |

## 3. Endpoints / API

The backend routes are unprefixed in FastAPI. The frontend reaches them through `/wms/api/*` in development because Vite rewrites the prefix.

| Method | Backend route | Auth | Purpose | Evidence |
|---|---|---|---|---|
| POST | `/auth/google?token=...` | Google ID token in query parameter | Verify Google token and return JWT, email, role. | `backend/app.py:313-329`, `src/components/LiveDemo.jsx:183-188` |
| GET | `/auth/me` | Bearer JWT | Return email, role, total credits, used credits. | `backend/app.py:346-354`, `src/components/LiveDemo.jsx:168-174` |
| POST | `/payments/create-order?num_credits=N` | Bearer JWT | Create Razorpay order for credits. | `backend/app.py:359-386`, `src/components/LiveDemo.jsx:204-208` |
| POST | `/payments/verify` | Bearer JWT | Verify Razorpay signature and add credits. | `backend/app.py:388-408`, `src/components/LiveDemo.jsx:217-225` |
| POST | `/upload?model_id=N&multiplier=N` | Bearer JWT | Upload one video, validate, debit credit, enqueue job. | `backend/app.py:413-484`, `src/components/LiveDemo.jsx:250-258` |
| GET | `/status/{job_id}` | None | Return in-memory status, progress, model ID, multiplier. | `backend/app.py:486-493`, `src/components/LiveDemo.jsx:291-296` |
| GET | `/download/{job_id}` | Bearer JWT | Return processed MP4 if job belongs to user. | `backend/app.py:495-514`, `src/components/LiveDemo.jsx:303-309` |
| GET | `/system` | None | Return active GPU job count, queue length, free VRAM. | `backend/app.py:517-523`, `src/components/LiveDemo.jsx:160-164` |

No `/api/upload`, `/api/status/{job_id}`, `/api/gpu_status`, or `/api/cancel/{job_id}` backend routes exist in `backend/app.py`; those names came from the archived master prompt.

## 4. Verified Metrics / Benchmarks

No benchmark report file was found that verifies the frontend's PSNR/SSIM claims. The current UI displays these values:

| Displayed model | Displayed PSNR | Displayed SSIM | Verification status | Evidence |
|---|---:|---:|---|---|
| Model 1 / Generic Baseline | 32.753 dB | 0.8739 | UNVERIFIED as benchmark result. | `src/pages/Research.jsx:203-207`, `src/components/ModelComparison.jsx` |
| Model 2 / Fine-tuned L1 | 34.373 dB | 0.8848 | UNVERIFIED as benchmark result. | `src/pages/Research.jsx:210-214`, `src/components/ModelComparison.jsx` |
| Model 3 / Custom Motion Loss | 34.423 dB | 0.8991 | UNVERIFIED as benchmark result. | `src/pages/Research.jsx:217-221`, `src/components/ModelComparison.jsx` |
| Claimed gain | +1.67 dB | n/a | UNVERIFIED as benchmark result. | `src/pages/Research.jsx:121`, `src/pages/Research.jsx:221` |

Training CSV files exist under `backend/train_log_wms/` and `backend/train_log_wms_custom_loss/`, but their headers are training losses (`epoch,global_step,lr,loss_total,loss_l1,loss_mw,loss_ssim,loss_smooth`), not PSNR/SSIM benchmark reports.

Other displayed research claims also remain UNVERIFIED by local source files: `94GB Dataset` / `94 GB (Cleaned)` (`src/pages/Research.jsx:79-85`, `src/pages/Research.jsx:176-177`), `NVIDIA RTX 5080 (16GB VRAM)` (`src/pages/Research.jsx:163-165`), `10 Epochs / Adaptive LR` (`src/pages/Research.jsx:171-173`), and publication/citation metadata (`src/pages/Research.jsx:238-244`).

## 5. Configuration

| Config item | Value/effect | Evidence |
|---|---|---|
| Frontend scripts | `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`. | `package.json:6-10` |
| Frontend base path | `/wms/`. | `vite.config.js:7` |
| Router basename | `/wms`. | `src/main.jsx:10` |
| Dev API proxy | `/wms/api` -> `http://localhost:8000`; prefix stripped. | `vite.config.js:11-14` |
| Google OAuth client ID | Hard-coded in frontend provider; backend also reads `GOOGLE_CLIENT_ID`. | `src/main.jsx:11`, `backend/auth.py:15` |
| JWT secret | Read from `JWT_SECRET`; no default. | `backend/auth.py:17` |
| Razorpay backend keys | Read from `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, defaulting to empty strings. | `backend/app.py:32-35` |
| Razorpay frontend key | Hard-coded in `LiveDemo.jsx`. | `src/components/LiveDemo.jsx:29`, `src/components/LiveDemo.jsx:211` |
| Database URL | Hard-coded SQLite URL `sqlite:///./app.db`. | `backend/database.py:4` |
| CORS origins | Local Vite origins plus `ansonsajugeorge.online` variants. | `backend/app.py:69-74` |
| Python dependencies | Split across root `requirements.txt` and `backend/requirements.txt`; backend app needs packages from both. | `requirements.txt`, `backend/requirements.txt` |
| `.env.example` | Not present in file inventory. | `rg --files -g ".env.example"` returned no file in config inventory |
| `env_files` | Present but intentionally not inspected because it may contain secret material. | Root `Get-ChildItem -Force` listed `env_files`; read attempt was rejected as secret risk |

## 6. Known Gaps / TODO / Limitations

- `npm run lint` fails with 16 errors and 1 warning. Main categories: unused `motion` imports across frontend files, empty catch/block statements in `LiveDemo.jsx`, unused caught variables, and Fast Refresh export warnings in UI component files.
- `npm run build` passes, but Vite reports one JS chunk above 500 kB after minification.
- Backend route `/status/{job_id}` and `/system` are unauthenticated; this is implemented behavior, not a recommendation.
- Job state/progress data is stored in process memory; restarting the backend loses queue/status dictionaries even though user/job rows are in SQLite.
- Payment and Google OAuth secrets are not represented by a safe `.env.example`; `env_files` was not read because it may contain secrets.
- No Docker, docker-compose, Nginx config, systemd unit, CI config, or deployment files were present in this repo inventory.
- Benchmark, dataset size, hardware, and publication claims displayed in the frontend are not backed by a local benchmark/report file found during this audit.

## 7. Discrepancies Found During Audit

| Claim | Source file | Reality from code/config | Verdict |
|---|---|---|---|
| Active docs include README images such as `docs/demo.gif` and `docs/screens/*.png`. | `README.md:34-54` | Inventory showed only `docs/Web Motion Synthesis.docx` and `docs/images/banner.png`; no `docs/demo.gif` or `docs/screens` files. | WRONG |
| Backend run command binds `127.0.0.1:8081`. | `README.md:186-188` | Backend code does not bind a port. Vite proxy expects `http://localhost:8000`. | WRONG |
| Repository structure includes `nginx/` and `frontend/`. | `README.md:132-153` | Root inventory has `src/`, `backend/`, `docs/`, `temp/`; no `nginx/` or `frontend/` directory. | WRONG |
| Storage path is `backend/storage/uploads` and `backend/storage/outputs`. | `README.md:138-142`, Word doc Chapter 11 | Code uses `backend/storage/uploads` and `backend/storage/outputs`. | CONFIRMED |
| Deployment uses Nginx, Cloudflare, GPU server, and systemd. | `README.md:117-122`, `README.md:206-211`, Word doc Chapter 15 | No Nginx, Cloudflare, or systemd config files were found in repo inventory. Could be external deployment, but not verified here. | UNVERIFIED |
| Maximum upload is 2 GB. | `README.md:221` | Backend checks `MAX_FILE_SIZE = 100 * 1024 * 1024`; UI also says max 100 MB. | WRONG |
| GPU is NVIDIA RTX 3060. | `README.md:218` | No hardware config verifies this. Frontend research page instead displays RTX 5080. Both are unverified by local implementation. | UNVERIFIED / STALE |
| GPU target VRAM is 6000 MB and `MAX_GPU_WORKERS = 2`. | Word doc Chapter 7 | Code sets `MAX_GPU_WORKERS = 3` and `MIN_FREE_VRAM_MB = 1200`; it queries actual GPU memory at runtime. | WRONG |
| Idle purge happens after 10 minutes. | Word doc Chapter 12 | Code sets `AUTO_PURGE_AFTER = 60 * 60` seconds. | WRONG |
| Model offload happens after 5 minutes. | Word doc Chapter 8 | Code sets `IDLE_TIMEOUT = 60 * 20` seconds. | WRONG |
| Upload validation limits are 10 minutes and 1920 x 1080. | Word doc Chapter 5 | Code limits duration to 5 minutes and resolution to 3840 x 2160. | WRONG |
| Possible job states include `waiting_gpu`. | Word doc Chapter 6 | Code uses `queued`, `processing`, `done`, `failed`, `failed_oom`; there is no `waiting_gpu` assignment. | STALE |
| Backend API assumptions include `POST /api/upload`, `GET /api/status/{job_id}`, `GET /api/gpu_status`, `POST /api/cancel/{job_id}`. | `old-master-prompt-domain-adaptive-vfi-webapp.md:246-252` | Actual backend routes are unprefixed `/upload`, `/status/{job_id}`, `/system`; no cancel route. Frontend reaches them through Vite's `/wms/api` rewrite. | WRONG |
| GPU capacity rules are multiplier-specific: 2x max 4, 4x max 2, 8x max 1. | `old-master-prompt-domain-adaptive-vfi-webapp.md` GPU Capacity System | Code has one global `MAX_GPU_WORKERS = 3`; backend does not support 8x. | WRONG |
| Time estimates use 2x=7x, 4x=12x, 8x=25x real-time. | `old-master-prompt-domain-adaptive-vfi-webapp.md` Time Estimation Model | No matching estimation logic found in backend or frontend. | UNVERIFIED / STALE |
| App should be TypeScript. | `old-master-prompt-domain-adaptive-vfi-webapp.md` Tech Stack | Current source files are `.jsx` and `.js`; `components.json` has `tsx: false`. | WRONG |
| Frontend uses React, Vite, Tailwind, Framer Motion, React Router. | `old-master-prompt-domain-adaptive-vfi-webapp.md` Tech Stack | Dependencies include these packages or Vite Tailwind plugin. | CONFIRMED |
| Source snapshot captures UI component files from `D:\main-projects\Final_Year_Project\App\src\components\ui`. | `source_report.txt` | Current repo has the same component filenames under `src/components/ui`, but `source_report.txt` is a generated historical snapshot from another absolute path. | DUPLICATE / STALE |
| Docs claim secure Google OAuth. | `README.md`, Word doc Chapter 9 | Backend verifies Google ID tokens and issues JWT; frontend wraps app in `GoogleOAuthProvider`. | CONFIRMED |
| Docs claim payment behavior only generally or not at all. | `README.md`, Word doc | Code implements Razorpay orders, payment verification, credits, and non-admin credit checks. | STALE / INCOMPLETE |
| Docs claim multiple interpolation models. | `README.md`, Word doc Chapter 4 | Code supports model IDs 0, 1, 2 and UI exposes three model labels. | CONFIRMED |
| Docs imply large video processing support. | `README.md:69` | Code enforces 100 MB and 5 minute upload limits. | STALE |
| Research metrics PSNR/SSIM and +1.67 dB gain. | `src/pages/Research.jsx`, `src/components/ModelComparison.jsx` | These values are displayed in current UI, but no local benchmark report verifies them. Training CSVs contain loss columns, not benchmark PSNR/SSIM. | UNVERIFIED |

## 8. How to Run

### Standalone frontend

```bash
npm install
npm run dev
```

The frontend dev server serves the Vite app. For API calls to work, a backend must be reachable at `http://localhost:8000` because of the proxy in `vite.config.js:11-14`.

### Integrated local demo

```bash
pip install -r requirements.txt -r backend/requirements.txt
cd backend
uvicorn app:app --host 127.0.0.1 --port 8000
```

Then run the frontend:

```bash
npm run dev
```

Set environment variables before backend startup: `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`. This repo has no safe `.env.example`; do not use `env_files` as documentation unless its contents are reviewed by the owner.

## 9. Audit Command Results

- `git rev-parse --short HEAD`: `7c0a592`
- Documentation inventory found: `README.md`, `old-master-prompt-domain-adaptive-vfi-webapp.md`, `source_report.txt`, `docs/Web Motion Synthesis.docx`, `docs/images/banner.png`.
- Config inventory found: `package.json`, `package-lock.json`, `vite.config.js`, `jsconfig.json`, `components.json`, `eslint.config.js`, root `requirements.txt`, `backend/requirements.txt`.
- `npm run build`: passed.
- `npm run lint`: failed with 16 errors and 1 warning before documentation edits.
- Backend syntax compilation was not run because `py_compile` writes `__pycache__` files and was rejected as inappropriate for a docs-only audit.
