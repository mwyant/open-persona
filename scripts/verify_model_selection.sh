#!/bin/sh
# Simple verification script that posts a chat to the sidecar and prints the response.
# Usage: ./scripts/verify_model_selection.sh <user-id>
USER=${1:-smoketest}
URL=${SIDECAR_URL:-http://localhost:8000/v1/chat/completions}

cat <<'REQ' | curl -sS -X POST "$URL" -H 'content-type: application/json' -d @- -w "\nHTTP_CODE:%{http_code}\n"
{
  "model": "open-persona/build",
  "messages": [{"role":"user","content":"Model check"}],
  "user": "${USER}"
}
REQ

echo "\nRun 'docker compose logs open-persona-sidecar | rg model_selection -n' to inspect the model selection logs."
