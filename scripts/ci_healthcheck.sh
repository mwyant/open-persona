#!/usr/bin/env bash
set -euo pipefail

# Simple healthcheck used by CI and locally.
# Usage: ./scripts/ci_healthcheck.sh

BASE_URL=${1:-http://localhost:8000}

echo "Checking sidecar health at ${BASE_URL}/healthz"
if ! curl -sSf ${BASE_URL}/healthz; then
  echo "Sidecar healthz failed"
  exit 2
fi

# Quick chat completion smoke test using env or header
if [ -n "${OPEN_PERSONA_DEFAULT_OPENAI_API_KEY:-}" ]; then
  echo "Running smoke POST using env-provided key"
  curl -sSf -X POST ${BASE_URL}/v1/chat/completions \
    -H 'Content-Type: application/json' \
    -H "x-openpersona-openai-api-key: ${OPEN_PERSONA_DEFAULT_OPENAI_API_KEY}" \
    -d '{"model":"gpt-3.5-turbo","messages":[{"role":"system","content":"You are a test."},{"role":"user","content":"hello"}] }' | jq -r '.choices[0].message.content'
else
  echo "OPEN_PERSONA_DEFAULT_OPENAI_API_KEY not set; skipping smoke POST"
fi
