#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/start_admin_session.sh <workspaceKey> [ttlMinutes] [privateKeyOut]
# Example: ./scripts/start_admin_session.sh cb61ed2a6a9882ff 300 ~/.ssh/admin_cb61ed_key.pem

WORKSPACE_KEY=${1:-}
if [ -z "$WORKSPACE_KEY" ]; then
  echo "Usage: $0 <workspaceKey> [ttlMinutes] [privateKeyOut]" >&2
  exit 2
fi

TTL=${2:-300}
PRIVATE_OUT=${3:-"$HOME/.ssh/openpersona_admin_${WORKSPACE_KEY}_key.pem"}

# Call the sidecar admin endpoint
RESP_FILE=$(mktemp)
trap 'rm -f "$RESP_FILE"' EXIT

curl -sS -X POST http://localhost:8000/admin/start-session \
  -H 'content-type: application/json' \
  -d "{\"workspaceKey\": \"$WORKSPACE_KEY\", \"ttlMinutes\": $TTL, \"exposeDockerSocket\": true}" \
  -o "$RESP_FILE" || { echo "Request failed" >&2; cat "$RESP_FILE" >&2; exit 1; }

# Extract private key and connection info
PRIVATE_KEY=$(jq -r '.privateKey // empty' < "$RESP_FILE")
HOST=$(jq -r '.host // "127.0.0.1"' < "$RESP_FILE")
PORT=$(jq -r '.port // empty' < "$RESP_FILE")
CID=$(jq -r '.containerId // empty' < "$RESP_FILE")

if [ -z "$PRIVATE_KEY" ] || [ -z "$PORT" ] || [ -z "$CID" ]; then
  echo "Did not receive expected response from sidecar:" >&2
  cat "$RESP_FILE" >&2
  exit 1
fi

mkdir -p "$(dirname "$PRIVATE_OUT")"
printf '%s\n' "$PRIVATE_KEY" > "$PRIVATE_OUT"
chmod 600 "$PRIVATE_OUT"

cat <<EOF
Admin session started
workspace: $WORKSPACE_KEY
containerId: $CID
ssh: ssh -i $PRIVATE_OUT -p $PORT admin@$HOST
Private key written to: $PRIVATE_OUT (keep it secure)
Session TTL (minutes): $TTL
To stop: ./scripts/stop_admin_session.sh $WORKSPACE_KEY
EOF

# print small audit hint
echo "Session start recorded in workspace .open-persona/admin-audit.log"

exit 0
