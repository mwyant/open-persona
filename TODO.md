TODO: Next Steps — Workspace openwebui.config, migration, and hardening

Goal

Provide a clear, step-by-step plan and actionable commands a smaller/less-capable LLM (or a human developer following the instructions) can follow to:

1. Back up existing Open WebUI runtime data and workspace volumes.
2. Migrate workspace and Open WebUI server data into the repository `./workspaces` and `./data/open-webui` (bind mounts).
3. Expand `openwebui.config` per-workspace schema to include richer user metadata.
4. Update the sidecar so it writes the expanded config reliably and ensure runners/opencode can read it.
5. Add small tests and CI checks to validate workspace mapping and config presence.

Each step below is written as a clear instruction with concrete commands and expected outcomes.

=== 1) Back up current Docker volumes (one-time, safe)

Why
- We will migrate named volumes into host bind mounts. Always back up before moving data.

Commands (run once):

- List relevant volumes:
  - `docker volume ls | rg open-persona || true`
  - Expect to see names like `open-persona_open-persona-workspaces`, `open-persona_open-webui`, `open-persona_opencode-data`.

- Create a compressed backup of each volume (example for `open-persona_open-webui`):

  ```bash
  mkdir -p backups
  docker run --rm -v open-persona_open-webui:/from -v "$(pwd)/backups":/to alpine \
    sh -c "cd /from && tar -czf /to/open-webui-backup-$(date +%Y%m%d%H%M).tgz ."
  ls -lh backups
  ```

- Repeat for `open-persona_open-persona-workspaces` and `open-persona_opencode-data`.

Expected result
- `backups/` contains `.tgz` files of the volume contents.

=== 2) Migrate data into repo bind mounts

Why
- Developer-controlled bind mounts allow easier inspection and versioned backups (not committing runtime data into git, but keeping them accessible in repo tree).

Commands

1. Create target directories (if not already present):

```bash
mkdir -p data/open-webui data/opencode workspaces
```

2. Copy Open WebUI volume into `./data/open-webui`:

```bash
docker run --rm -v open-persona_open-webui:/from -v "$(pwd)/data/open-webui":/to alpine \
  sh -c "mkdir -p /to && cp -a /from/. /to/ || true"
ls -la data/open-webui
```

3. Copy workspaces volume into `./workspaces`:

```bash
docker run --rm -v open-persona_open-persona-workspaces:/from -v "$(pwd)/workspaces":/to alpine \
  sh -c "mkdir -p /to && cp -a /from/. /to/ || true"
ls -la workspaces | sed -n '1,200p'
```

4. Copy opencode/data volume if needed:

```bash
docker run --rm -v open-persona_opencode-data:/from -v "$(pwd)/data/opencode":/to alpine \
  sh -c "mkdir -p /to && cp -a /from/. /to/ || true"
ls -la data/opencode
```

Expected result
- `./data/open-webui`, `./workspaces`, and `./data/opencode` contain the copied files with proper ownership. If ownership/permissions are wrong, run `chown -R $(id -u):$(id -g) workspaces data`.

Notes
- Do not commit the runtime data into git. Keep `data/` and `workspaces/` in `.gitignore` (already configured).

=== 3) Expand openwebui.config schema (suggested fields)

Goal
- Have `openwebui.config` per-workspace contain enough metadata to identify the Open WebUI user and provenance.

Suggested schema (JSON):

```json
{
  "openwebui_user": {
    "id": "<openwebui-user-id>",
    "username": "<username-or-email-or-null>",
    "email": "<email-or-null>",
    "source": "header|body|token|anonymous",
    "is_admin": false
  },
  "workspace": {
    "hash": "<workspaceHash>",
    "createdAt": 1766340000000,
    "updatedAt": 1766340000000
  },
  "notes": "optional freeform metadata"
}
```

Action for LLM/human
1. Update sidecar code that writes `openwebui.config` to write the expanded schema. Place this logic where the file is currently created (in ensureRunner or equivalent).
2. Ensure values are sanitized and do not include secrets. For `email` or `username`, prefer values from headers `x-openwebui-user` or `authorization` decoding if available; otherwise null.
3. Add a helper `openWebUIConfigPath(directory)` and `writeOpenWebUIConfig(directory, userMetadata)` with the above JSON.
4. Write with `fs.writeFileSync(..., { encoding: 'utf8' })` and ensure directory exists.

Expected behavior
- After a request that resolves a workspace (header/body/token), the workspace directory contains `openwebui.config` with the extended schema populated.

=== 4) Update sidecar behavior & runner consistency

Tasks

1. Decide runner mode for your environment:
   - For local dev: `RUNNER_MODE=shared` (opencode service mounts `./workspaces` and reads `openwebui.config`).
   - For containerized runners: ensure the runner containers mount the *same* data (use a named Docker volume or bind the repo path into the runner with absolute host path).

2. Implementation details (for LLM):
   - When ensureRunner is invoked, after computing `directory` and before starting/restarting a runner, call `writeOpenWebUIConfig(directory, userMetadata)` to ensure the file is present.
   - If using `container` runner mode and you want containers to see host `./workspaces`, do one of:
     - Use named Docker volumes and keep them in sync with host `./workspaces` (copy host → volume when you update), OR
     - Have the sidecar pass the absolute host path to Docker create as a bind mount (requires sidecar to be running with sufficient permissions and awareness of host paths).

3. For maximum compatibility I recommend `shared` mode for development and named-volume or host-bind for production, but keep a sync script to copy host → volume when needed.

=== 5) Add integration tests and CI checks (minimal)

Tests for LLM to add

1. `tests/smoke/workspace_config.test.sh` (bash script):
   - POST to sidecar `/v1/chat/completions` with `user` header/body token that maps to a workspace.
   - Wait a few seconds, then assert `workspaces/<hash>/openwebui.config` exists and contains `openwebui_user.id` equal to expected header value.

2. CI job (GitHub Actions) enhancement:
   - Add a job `integration:workspace-config` that runs in a small Docker runner (services: docker compose) and executes the smoke script.
   - Fail the job if file missing or invalid JSON.

=== 6) Migration script (optional but recommended)

Provide `scripts/migrate_volumes_to_bind.sh` with the following behavior:

1. Stop the stack: `docker compose down`
2. Backup volumes (same commands as in Section 1)
3. Copy each named volume into `./data` and `./workspaces` (commands in Section 2)
4. Ensure permissions: `chown -R $(id -u):$(id -g) data workspaces`
5. Start stack with the new compose: `docker compose up --build -d`

Script tip: check for `DOCKER_HOST` or remote Docker and fail early if running against a remote host.

=== 7) Testing / verification checklist (step-by-step)

1. Ensure `.env` or `.env.launcher` exists with desired `WORKSPACES_DIR` and other variables.
2. Run `./open-persona-launcher/openpersona-launcher --project-dir . --no-browser --timeout 180` to start the stack.
3. Run a smoke test:
   - `curl -sS -X POST http://localhost:8000/v1/chat/completions -H 'content-type: application/json' -d '{"model":"open-persona/build","messages":[{"role":"user","content":"smoke"}], "user":"testuser"}'`
   - Expect HTTP 200 and an assistant reply.
4. Confirm workspace file exists:
   - Compute hash locally: `echo -n 'testuser' | sha256sum | awk '{print substr($1,1,16)}'`
   - `cat ./workspaces/<hash>/openwebui.config` — ensure JSON includes `openwebui_user.id: "testuser"`.
5. Confirm opencode or runner sees the same file (shared mode):
   - `docker compose exec opencode sh -c 'cat /workspace/open-persona/<hash>/openwebui.config'` — should print contents.

=== 8) Rollback plan

If anything goes wrong after migration:

1. Stop stack: `docker compose down`
2. Restore backups from `backups/`:
   - `tar -xzf backups/open-webui-backup-<timestamp>.tgz -C /var/lib/docker/volumes/open-persona_open-webui/_data` (run in appropriate privileged container or on host)
3. Restart stack and verify previous state.

=== 9) Implementation notes for a lesser LLM

- Use exact shell commands; avoid using interactive editors.
- Check exit codes (`$?`) after critical steps like copy and docker run; if non-zero, print context and stop.
- Use `ls -la` + `cat` to verify files rather than assumptions.
- When writing JSON files (`openwebui.config`), always use `JSON.stringify(obj, null, 2) + '\n'` (trailing newline helps editors).
- Never log or write raw provider keys into `openwebui.config`. Only include identifiers (user id, email) and metadata.

---

If you want, I will now:

- (A) Create the `scripts/migrate_volumes_to_bind.sh` script and commit it.
- (B) Implement the expanded `openwebui.config` schema in the sidecar code (I already added a basic writer; I can extend it to the suggested schema and push the change).
- (C) Add the small smoke test script and CI job to `./.github/workflows/`.

Tell me which of (A)/(B)/(C) you want me to execute; I can do all three in sequence if you prefer. 