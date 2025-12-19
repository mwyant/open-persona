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

