FROM node:20-slim AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS backend-modal

# Selected by WMS_MODE=modal. Slim API/static image: no CUDA, Torch, OpenCV, NumPy, imageio, or model folders.
# Keeps ffmpeg/ffprobe for parent-side upload validation and audio postprocessing; Modal inference wiring is added separately.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        ffmpeg \
        gettext-base \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    WMS_MODE=modal \
    INFERENCE_BACKEND_MODAL=true \
    FALLBACK_TO_LOCAL=false \
    LOCAL_DEVICE=cpu

WORKDIR /app

COPY backend/requirements-modal.txt ./backend-modal-requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r backend-modal-requirements.txt

COPY backend/app.py backend/auth.py backend/database.py backend/models.py backend/inference.py backend/__init__.py ./backend/
COPY --from=frontend /app/frontend/dist ./dist
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]

FROM nvidia/cuda:13.0.2-runtime-ubuntu24.04 AS backend-local-gpu

# Selected by WMS_MODE=local-gpu. Requires NVIDIA Container Toolkit on hosts that run with GPU;
# downloads RIFE model folders from Hugging Face at startup when they are missing.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ffmpeg \
        gettext-base \
        libgl1 \
        libglib2.0-0 \
        python-is-python3 \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    WMS_MODE=local-gpu

WORKDIR /app

COPY backend/requirements.txt ./backend-requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r backend-requirements.txt \
    && python -m pip install --no-cache-dir huggingface_hub

COPY backend ./backend
COPY --from=frontend /app/frontend/dist ./dist
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]