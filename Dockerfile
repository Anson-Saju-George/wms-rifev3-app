FROM node:20-slim AS frontend
WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nvidia/cuda:13.0.2-runtime-ubuntu24.04

# Local-GPU image. Requires NVIDIA Container Toolkit on hosts that run with GPU;
# the app still selects DEVICE=cpu when CUDA is unavailable.
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
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY backend/requirements.txt ./backend-requirements.txt
RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r backend-requirements.txt

COPY backend ./backend
COPY --from=frontend /app/frontend/dist ./dist
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]