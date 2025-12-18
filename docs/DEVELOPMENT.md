# Development

## Run locally
- Start stack: `docker compose up --build`
- Open WebUI: `http://localhost:3000`
- Sidecar: `http://localhost:8000/healthz`
- Instrumentl MCP: `http://localhost:7000/healthz`

## Rebuild one service
- `docker compose build open-persona-sidecar`
- `docker compose build openwebui`

## Local (non-docker) dev
Sidecar:
- `cd services/open-persona-sidecar`
- `npm install`
- `npm run build`
- `npm test`

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
