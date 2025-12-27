#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/stop_admin_session.sh <workspaceKey>
WORKSPACE_KEY=${1:-}
if [ -z "$WORKSPACE_KEY" ]; then
  echo "Usage: $0 <workspaceKey>" >&2
  exit 2
fi

curl -sS -X POST http://localhost:8000/admin/stop-session \
  -H 'content-type: application/json' \
  -d "{\"workspaceKey\": \"$WORKSPACE_KEY\"}" | jq -r '.'

echo "Requested stop for admin session $WORKSPACE_KEY"
