# Open Persona — Running Log (through v0.1.1)

## What this repo is (current PoC)
Open Persona is a proof-of-concept stack that plugs **Open WebUI** into **opencode** via a small **sidecar** that speaks an OpenAI-compatible API. The core goals implemented so far are:
- **Per-user isolation**: each Open WebUI user routes to a distinct opencode workspace (and optionally a distinct opencode runner container).
- **Per-chat continuity**: each Open WebUI chat can map to a persistent opencode session ID (so the “agent session” continues across messages).

## Architecture overview (Open WebUI + sidecar + opencode runners)
**Request flow**
1. User chats in Open WebUI (browser → Open WebUI backend).
2. Open WebUI calls its “OpenAI provider” with `/v1/chat/completions`.
3. That provider is configured to point at `open-persona-sidecar:8000`.
4. The sidecar:
   - derives a per-user workspace directory,
   - ensures an opencode runner exists (shared or per-user container),
   - creates or reuses an opencode session (per chat),
   - forwards the prompt to opencode’s `/session/:id/message`,
   - converts the response back into OpenAI-compatible JSON (and optional SSE streaming).

**Runner modes**
- `RUNNER_MODE=shared`: sidecar sends everything to the single `opencode` service.
- `RUNNER_MODE=container`: sidecar uses Docker to spawn one `opencode serve` container per workspace key (per user), attached to the Compose network.

## Key files (by responsibility)
- `docker-compose.yml` — main stack: Open WebUI, sidecar, opencode, volumes, ports.
- `services/open-persona-openwebui/Dockerfile` — builds Open WebUI image and applies patch.
- `services/open-persona-openwebui/patch_openai_router.py` — patches Open WebUI to forward user id.
- `services/open-persona-sidecar/src/index.ts` — sidecar server: routing, workspace hashing, session mapping, runner-container orchestration, OpenAI API surface.
- `services/open-persona-sidecar/package.json` — sidecar build/test scripts (tsc, eslint, vitest).
- `LICENSES.md` — upstream license tracking notes (Open WebUI + opencode).
- `AGENTS.md` — local build/test conventions for contributors.

## Docker Compose services, ports, volumes, env vars
**Service: `openwebui`**
- Image: built locally from `services/open-persona-openwebui/` (base `ghcr.io/open-webui/open-webui:main`).
- Port: `3000:8080` (Open WebUI UI on `http://localhost:3000`).
- Volume: `open-webui:/app/backend/data` (Open WebUI persistent state).
- Env:
  - `OPENAI_API_BASE_URLS=http://open-persona-sidecar:8000/v1` (points OpenAI provider at sidecar)
  - `OPENAI_API_KEYS=sk-open-persona` (placeholder key; used by Open WebUI provider config)
  - `ENABLE_OLLAMA_API=False` (disables Ollama polling unless needed)

**Service: `opencode`**
- Image: `ghcr.io/sst/opencode:latest`
- Command: `opencode serve --hostname 0.0.0.0 --port 4096`
- Volumes:
  - `opencode-data:/data` (opencode config/state)
  - `open-persona-workspaces:/workspace/open-persona` (workspace root)
- Env:
  - `XDG_CONFIG_HOME=/data/config`
  - `XDG_STATE_HOME=/data/state`
  - (provider keys are intended to be set at stack level as env vars)

**Service: `open-persona-sidecar`**
- Built from `services/open-persona-sidecar/` (Node/TS + Express + Dockerode).
- Ports: `8000:8000` (sidecar on `http://localhost:8000`)
- Volumes:
  - `open-persona-workspaces:/workspace/open-persona` (workspace root)
  - `/var/run/docker.sock:/var/run/docker.sock` (required for `RUNNER_MODE=container`)
- Env (core):
  - `PORT=8000`
  - `OPENCODE_BASE_URL=http://opencode:4096` (shared-runner fallback/target)
  - `WORKSPACE_ROOT=/workspace/open-persona`
  - `RUNNER_MODE=container` (or `shared`)
  - `LOG_WORKSPACE_ROUTING=0` (set `1` to log workspace routing hashes)
- Env (runner-container mode wiring):
  - `RUNNER_NETWORK=open-persona_default` (Compose network name to attach spawned runners)
  - `RUNNER_IMAGE=ghcr.io/sst/opencode:latest`
  - `WORKSPACE_VOLUME=open-persona_open-persona-workspaces`
  - `OPENCODE_DATA_VOLUME=open-persona_opencode-data`

**Named volumes**
- `open-webui` — Open WebUI backend data/config DB.
- `opencode-data` — opencode server state/config.
- `open-persona-workspaces` — shared workspace root containing per-user directories.

## How per-user workspaces are derived (sidecar)
Workspace identity is derived by `workspaceKeyForRequest()` in `services/open-persona-sidecar/src/index.ts`:
1. Prefer an explicit user identifier from headers:
   - `x-openwebui-user-id` (primary; injected by the Open WebUI patch for sidecar-bound requests)
   - plus several fallback header spellings (`x-open-webui-user-id`, `x-forwarded-user`, etc.)
2. Else use OpenAI request body `user` field (if provided).
3. Else use `Authorization: Bearer ...` token value (as a last-resort stable key).
4. Else fall back to `"anonymous"`.

The key is hashed as `sha256(key)` and truncated to 16 hex chars to form:
- workspace directory: `${WORKSPACE_ROOT}/${hash}` (e.g. `/workspace/open-persona/0123abcd...`)

On first use, the sidecar creates `opencode.jsonc` in that directory to set opencode permissions suitable for unattended operation:
- allows `edit`, `bash`, `webfetch`
- denies `external_directory`
- additionally locks down the `plan` agent (deny edit/bash)

## How per-chat session persistence works (sidecar)
The sidecar optionally uses a chat identifier (from Open WebUI) to keep an opencode session stable across messages:
- Reads chat id from headers:
  - `x-openwebui-chat-id` or `x-open-webui-chat-id`
- Stores a mapping file per workspace:
  - `${workspace}/.open-persona/openwebui-sessions.json`
  - JSON map: `{ "<chatId>": "<opencodeSessionId>", ... }`
- Uses an in-process lock (`withSessionLock`) keyed by `(workspace directory + chatId)` to prevent concurrent requests from racing and creating multiple sessions.

If a prompt fails because the session is missing (runner restart / session loss), the sidecar recreates the session once and updates the mapping.

## What the Open WebUI patch does (and why)
Patch location: `services/open-persona-openwebui/patch_openai_router.py`

Behavior:
- Modifies Open WebUI’s backend router at `/app/backend/open_webui/routers/openai.py`.
- When Open WebUI sends a request to an OpenAI base URL containing `"open-persona-sidecar"`, it injects:
  - `headers["x-openwebui-user-id"] = str(user.id)`

Purpose:
- Gives the sidecar a trustworthy, stable per-user identifier from Open WebUI auth.
- Limits header injection to the sidecar URL to avoid leaking user identifiers to arbitrary external providers.

How it’s applied:
- `services/open-persona-openwebui/Dockerfile` copies and runs the patch script at image build time.

## How to run (local)
- Start stack: `docker compose up --build`
- Open WebUI: `http://localhost:3000`
- Sidecar health: `http://localhost:8000/healthz`

Provider keys (optional):
- If you want opencode to reach external model providers, set env vars on the stack (recommended place: `open-persona-sidecar` and/or `opencode` service), e.g.:
  - `OPENAI_API_KEY=...`
  - `ANTHROPIC_API_KEY=...`
In `RUNNER_MODE=container`, the sidecar copies these keys into spawned runner containers.

Important note:
- Open WebUI persists provider configuration on first boot under `open-webui` volume; changing `OPENAI_API_BASE_URLS` after first initialization may not update already-saved settings without resetting Open WebUI config.

## How to verify (quick checks)
- Confirm sidecar models: `curl http://localhost:8000/v1/models`
  - should include `open-persona/build` and `open-persona/plan`
- Confirm Open WebUI routes to sidecar:
  - In Open WebUI, select the OpenAI provider pointed at the sidecar and send a message.
- Verify per-user workspace isolation:
  - Create two Open WebUI users, chat as each, and observe distinct workspace hashes (enable `LOG_WORKSPACE_ROUTING=1` on sidecar).
- Verify per-chat persistence (requires Open WebUI to send chat-id header):
  - Multiple messages in the same chat should reuse a single opencode session id in `.open-persona/openwebui-sessions.json`.

## Known limitations / caveats (current PoC)
- Sidecar implements only the minimal OpenAI surface (`/v1/models`, `/v1/chat/completions`); no embeddings, images, tool calling, etc.
- “Streaming” is simulated: the sidecar generates the full response, then emits SSE chunks (not true token streaming from the backend).
- Chat persistence depends on `x-openwebui-chat-id` being present; if Open WebUI doesn’t send it in your configuration, the sidecar will create a new opencode session per request.
- `RUNNER_MODE=container` requires:
  - Docker socket mount (`/var/run/docker.sock`)
  - correct `RUNNER_NETWORK` and volume names (compose-project-name sensitive)
  - a Docker environment where sidecar is allowed to create/manage sibling containers
- Authentication is currently trust-based (Open WebUI → sidecar inside the stack). The sidecar does not validate `OPENAI_API_KEYS`.
- Opencode runner containers restart when a new config is written (config is read on startup).

## Milestones / tags
- `v0.1.1` (commit `99a6e9a`)
  - Milestone summary: “PoC milestone: per-user runners + per-chat sessions”
  - Functional state at this tag:
    - Open WebUI → sidecar integration via OpenAI provider
    - Open WebUI patch to forward authenticated `user.id`
    - Sidecar workspace hashing + per-workspace opencode config
    - Optional per-user runner containers (`RUNNER_MODE=container`)
    - Per-chat opencode session persistence
