#!/bin/sh
set -eu

: "${WMS_MODE:=local-gpu}"
: "${HOST_PORT:=8000}"
: "${PORT:=${HOST_PORT}}"

# WMS_MODE selects the Docker target. The inference backend itself is controlled
# by INFERENCE_BACKEND_MODAL; WMS_MODE only supplies sane defaults when the
# explicit backend vars are omitted.
case "$WMS_MODE" in
  modal)
    : "${INFERENCE_BACKEND_MODAL:=true}"
    : "${FALLBACK_TO_LOCAL:=false}"
    : "${LOCAL_DEVICE:=cpu}"
    : "${MODEL_DOWNLOAD_ENABLED:=false}"
    ;;
  local-gpu|local_gpu|gpu)
    : "${INFERENCE_BACKEND_MODAL:=false}"
    : "${FALLBACK_TO_LOCAL:=true}"
    : "${LOCAL_DEVICE:=cuda}"
    : "${MODEL_DOWNLOAD_ENABLED:=true}"
    ;;
  *)
    echo "Invalid WMS_MODE='$WMS_MODE'. Use 'local-gpu' or 'modal'." >&2
    exit 2
    ;;
esac

# Frontend routing is intentionally self-detecting:
# - opened at /       -> BrowserRouter basename / and API /api
# - opened at /wms/   -> BrowserRouter basename /wms and API /wms/api
# API_BASE_URL and BASE_PATH are still accepted for unusual gateways, but not needed normally.
: "${BASE_PATH:=auto}"
: "${API_BASE_URL:=}"
if [ "$API_BASE_URL" = "auto" ]; then
  API_BASE_URL=""
fi
: "${GOOGLE_CLIENT_ID:=}"
: "${RAZORPAY_KEY_ID:=}"
: "${MODAL_APP_NAME:=wms-rife}"
: "${MODAL_FUNCTION_NAME:=interpolate}"
: "${MODAL_TOKEN_ID:=}"
: "${MODAL_TOKEN_SECRET:=}"
: "${MODEL_REPO_ID:=Anson-Saju-George/wms-rifev3-models-all-3}"
: "${MODEL_REVISION:=main}"


if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
  export JWT_SECRET
  echo "DEV-ONLY WARNING: JWT_SECRET is unset; generated an ephemeral startup secret. Sessions will be invalid after restart." >&2
fi

is_truthy() {
  case "$1" in
    1|true|TRUE|True|yes|YES|Yes|on|ON|On) return 0 ;;
    *) return 1 ;;
  esac
}

if is_truthy "$MODEL_DOWNLOAD_ENABLED"; then
  if is_truthy "${INFERENCE_BACKEND_MODAL:-false}" && ! is_truthy "${FALLBACK_TO_LOCAL:-false}"; then
    echo "Skipping local model download in Modal-only mode."
  elif [ -f /app/backend/download_models.py ]; then
    python /app/backend/download_models.py
  else
    echo "Model downloader not present; skipping local model download." >&2
  fi
fi

export API_BASE_URL BASE_PATH GOOGLE_CLIENT_ID RAZORPAY_KEY_ID
export INFERENCE_BACKEND_MODAL FALLBACK_TO_LOCAL LOCAL_DEVICE
export MODEL_REPO_ID MODEL_REVISION MODAL_APP_NAME MODAL_FUNCTION_NAME MODAL_TOKEN_ID MODAL_TOKEN_SECRET

envsubst < /app/dist/config.template.js > /app/dist/config.js

cd /app/backend
exec uvicorn app:app --host 0.0.0.0 --port 8000