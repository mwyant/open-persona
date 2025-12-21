# Development

## Run locally
- Start stack: `docker compose up --build`
- Open WebUI: `http://localhost:3000`
- Sidecar: `http://localhost:8000/healthz`
- Instrumentl MCP: `http://localhost:7000/healthz`

## Rebuild one service
- `docker compose build open-persona-sidecar`
- `docker compose build openwebui`

## Storage mounts (dev)
- By default the Compose file uses local bind mounts under the repository. You can override the locations with environment variables in your `.env` or `.env.launcher` file:

  - `DATA_OPENWEBUI` (default `./data/open-webui`) — Open WebUI persistent data
  - `DATA_OPENCODE` (default `./data/opencode`) — Opencode runtime data
  - `WORKSPACES_DIR` (default `./workspaces`) — Sidecar per-user workspaces

- If you edit these values, restart the stack (`docker compose down && docker compose up --build -d`) or use the Go launcher which respects the env file.

- See `.env.example` for a template of these variables.

## Local (non-docker) dev
Sidecar:
- `cd services/open-persona-sidecar`
- `npm install`
- `npm run build`
- `npm run lint`  # run ESLint
- `npm run test`  # runs Vitest (test runner)

Single-test example (Vitest):

```bash
# Run a single test by name
npm run test -- -t "runs tests"
# Or run a single file
npx vitest run src/index.test.ts
```

Pre-commit hooks (developer setup):

- Install repo dev tools and enable git hooks:

```bash
# from repo root
npm install
# Husky 'prepare' script runs automatically on install; otherwise run:
# npx husky install
```

- This will enable the pre-commit hook which runs lint-staged and a simple secret scan.

Instrumentl MCP:
- `cd services/instrumentl-mcp`
- `npm install`
- `npm run build`

## Debugging
- Logs:
  - `docker compose logs -f openwebui`
  - `docker compose logs -f open-persona-sidecar`
- List runner containers:
  - `docker ps --filter 'name=open-persona-runner-'`

## Known gotchas
- Never forward multi-line secrets in headers (Open WebUI rejects CR/LF).
- Open WebUI persists provider config on first boot in the `open-webui` volume.
