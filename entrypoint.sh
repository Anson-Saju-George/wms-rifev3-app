#!/bin/sh
set -eu

: "${BASE_PATH:=/}"
: "${PORT:=8000}"
: "${API_BASE_URL:=auto}"
: "${GOOGLE_CLIENT_ID:=}"
: "${RAZORPAY_KEY_ID:=}"

# API_BASE_URL controls what the browser calls before appending /api.
# In local auto mode, PORT is the only knob:
#   PORT=80   -> http://localhost
#   PORT=8000 -> http://localhost:8000
# Set API_BASE_URL explicitly for integrated/gateway routing such as /wms.
if [ -z "$API_BASE_URL" ] || [ "$API_BASE_URL" = "auto" ]; then
  if [ "$PORT" = "80" ]; then
    API_BASE_URL="http://localhost"
  else
    API_BASE_URL="http://localhost:${PORT}"
  fi
fi

if [ -z "${JWT_SECRET:-}" ]; then
  JWT_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
  export JWT_SECRET
  echo "DEV-ONLY WARNING: JWT_SECRET is unset; generated an ephemeral startup secret. Sessions will be invalid after restart." >&2
fi

export API_BASE_URL BASE_PATH GOOGLE_CLIENT_ID RAZORPAY_KEY_ID

envsubst < /app/dist/config.template.js > /app/dist/config.js

cd /app/backend
exec uvicorn app:app --host 0.0.0.0 --port 8000