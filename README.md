# Open Persona (open-persona)

Open Persona merges:
- **Open WebUI**: a clean, configurable web UI for chat/workspaces/knowledge.
- **opencode**: a multi-agent, tool-using coding/automation engine.

Today this repo is a **working proof of concept**:
- Open WebUI speaks to a local provider endpoint (`open-persona-sidecar`) using the standard “OpenAI provider” workflow.
- The sidecar routes each Open WebUI user to an isolated opencode workspace (and runner container).
- Personas are Open WebUI Models; persona metadata is forwarded to opencode.

Start here:
- `docs/README.md`
- `docs/MENTAL_MODEL.md`
- `docs/COOKBOOK.md`

Milestones are tagged (`v0.x.y`).

## Quickstart

- Start the stack with Docker Compose:

```bash
docker compose up --build
```

- After the stack is running, open the web UI (default host/port depends on your Compose setup).

## Development

- Sidecar service (local development):

```bash
cd services/open-persona-sidecar
npm install
npm run build      # compile TypeScript
npm run lint       # run ESLint
npm run test       # run tests (Vitest)
```

- Run a single test (Vitest):

```bash
cd services/open-persona-sidecar
npm run test -- -t "runs tests"
# or run a single file
npx vitest run src/index.test.ts
```

- When contributing:
  - Fork → branch (`feature/<name>`) → PR
  - Ensure linting and tests pass locally before opening a PR

## Where to look next

- `docs/DEVELOPMENT.md` — detailed build & dev notes
- `services/open-persona-openwebui/` — Open WebUI integration helpers
- `services/open-persona-sidecar/` — sidecar runtime and routing logic

## Storage mounts and local persistence

By default, development uses local bind mounts under the repository. You can customize locations via environment variables (place them in `.env` or `.env.launcher`):

- `DATA_OPENWEBUI` (default `./data/open-webui`) — Open WebUI persistent data
- `DATA_OPENCODE` (default `./data/opencode`) — Opencode runtime data
- `WORKSPACES_DIR` (default `./workspaces`) — Sidecar per-user workspaces

To change mount locations:

1. Copy `.env.example` to `.env` or `.env.launcher` and edit the variables.
2. Restart the stack:

```bash
# Using docker compose directly
docker compose down && docker compose up --build -d

# Or use the Go launcher (recommended for dev):
./open-persona-launcher/openpersona-launcher --project-dir . --no-browser
```

Migrating existing workspace data from Docker volumes into the repo (one-time):

```bash
# Copy data from the Docker volume into ./workspaces
mkdir -p ./workspaces
docker run --rm -v open-persona_open-persona-workspaces:/from -v "$PWD/workspaces":/to alpine \
  sh -c "cp -a /from/. /to/"
```

Cleaning up workspaces:

```bash
# Remove local workspaces (destructive)
rm -rf ./workspaces/*
```

Note: bind mounts are convenient for development. For production deployments, consider using managed volumes or dedicated storage.

