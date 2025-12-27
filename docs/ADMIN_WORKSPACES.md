Admin Workspaces — Controlled elevated access

Overview

This document explains how to start a controlled, time-limited admin session for a workspace. Admin sessions provide temporary SSH access and development tooling (python3, pip, node, npm, git, curl, jq) inside an ephemeral container for a workspace. This capability is privileged and must be used with caution.

Design goals
- Least privilege: admin sessions mount only the workspace directory (and optionally the Docker socket) and do not mount host root.
- Audited: session start/stop events are recorded in the workspace `.open-persona/admin-audit.log`.
- Ephemeral: sessions automatically expire after a configured TTL (default 300 minutes) and containers are removed.
- Manual authorization: only pre-authorized workspace hashes (ADMIN_WORKSPACES or explicit list) may start sessions.

Starting an admin session (recommended via script)

1. Start session using helper script (the script calls the sidecar admin endpoint):

```bash
# start admin session for workspace (example)
./scripts/start_admin_session.sh cb61ed2a6a9882ff 300 ~/.ssh/admin_cb61ed_key.pem
```

2. The script will:
- Call the sidecar `/admin/start-session` endpoint for the workspace.
- Save the returned private SSH key to the specified path (permissions 600).
- Print the SSH command to use to connect (example: `ssh -i ~/.ssh/admin_cb61ed_key.pem -p 32770 admin@127.0.0.1`).

3. Use the SSH command to connect and run your tooling. Example test commands:

```bash
ssh -i ~/.ssh/admin_cb61ed_key.pem -p 32770 admin@127.0.0.1 'whoami; python3 --version; pip --version; node --version; npm --version; git --version; curl --version; jq --version'
```

Stopping a session

- Use the helper script to stop early:

```bash
./scripts/stop_admin_session.sh cb61ed2a6a9882ff
```

Audit log

- The sidecar records session START/STOP entries in:
  - `workspaces/<workspaceHash>/.open-persona/admin-audit.log`
- Entries include timestamp, container id, name, host port, TTL, and docker socket exposure flag.

Security considerations

- If `exposeDockerSocket: true` is used, the admin container has access to the Docker daemon via the socket. This effectively grants the session broad host-level capabilities; use sparingly.
- The generated SSH private key is returned once by the sidecar; protect it carefully and delete it locally when the session ends.
- The helper scripts do not commit any keys or workspace files to Git; ensure your local environment is secure.

Adding new admin workspaces

- To authorize a workspace in future, add its hash to the environment variable `ADMIN_WORKSPACES` (comma-separated) used by the sidecar or set the `admin: true` flag in `openwebui.config` (when supported). For now, only explicitly allowed workspace hashes can start sessions.

Cleanup

- Sessions auto-expire after TTL minutes; the container is removed and an EXPIRE audit entry is written.
- To manually clean up any leftover containers:

```bash
docker ps -a | rg openpersona-admin || true
docker rm -f <container-id>
```

Support

- If you need more permanent/approved admin capabilities (e.g., scheduled admin sessions, approval workflow), see TODO.md for the longer-term admin workspace feature plan.
