# Starting open-persona

This document explains how to start the project two ways: (A) the recommended Docker stack and (B) a manual/standalone setup for local development. It also documents the new Go-based launcher that automates the startup process and the branch created during development.

**Prerequisites**
- Docker Engine (20xx+) and Docker Compose (v2 recommended) for the Docker stack.
- Node 18+ and npm for local Node services (`services/open-persona-sidecar`, `services/instrumentl-mcp`).
- Python 3.10+ and required Python packages if running the Open WebUI backend locally.
- A terminal and network access to download images/dependencies.

**Files to know**
- `docker-compose.yml` (root) - main Docker stack definition.
- `services/open-persona-sidecar/package.json` - sidecar build/run scripts.
- `services/instrumentl-mcp/package.json` - instrumentl MCP build/run scripts.
- `services/open-persona-openwebui/start.sh` - webui entrypoint and seeding helper.
- `.env` - environment variables used by the Docker compose file.
- `open-persona-launcher/` - new Go launcher that automates stack startup (see below).

**A. Docker Stack (recommended)**
- Start the full stack (build images and run):
  - `docker compose up --build`
  - To run detached: `docker compose up --build -d`
- Rebuild a single service (example):
  - `docker compose build open-persona-sidecar`
  - `docker compose build openwebui`
- Ports and endpoints (defaults from `docker-compose.yml`):
  - Open WebUI: `http://localhost:3000`
  - Sidecar health: `http://localhost:8000/healthz`
  - Instrumentl MCP health: `http://localhost:7000/healthz`
- Important envs (set in `.env` or the compose environment):
  - `OPEN_PERSONA_DEFAULT_OPENAI_API_KEY`, `OPEN_PERSONA_DEFAULT_ANTHROPIC_API_KEY`, `OPEN_PERSONA_DEFAULT_OPENROUTER_API_KEY`
  - The compose file maps the Open WebUI provider to the sidecar: `OPENAI_API_BASE_URLS=http://open-persona-sidecar:8000/v1`.
- Volumes created by compose persist state:
  - `open-webui` holds Open WebUI data.
  - `opencode-data` and `open-persona-workspaces` used by `opencode` and the sidecar.
- Logs & debugging:
  - Tail logs: `docker compose logs -f openwebui` or `docker compose logs -f open-persona-sidecar`
  - List runner containers: `docker ps --filter 'name=open-persona-runner-'`

**B. Standalone / Manual (local dev)**
This is more manual but useful for debugging individual services.

1) Sidecar (Node service)
- `cd services/open-persona-sidecar`
- `npm install`
- `npm run build`
- `npm start` (runs `node dist/index.js`)
- To run in development mode (hot-run): `npm run dev` (requires `tsx`).

2) Instrumentl MCP (Node service)
- `cd services/instrumentl-mcp`
- `npm install`
- `npm run build`
- `npm start`

3) Open WebUI backend (Python)
- The Docker image is based on `ghcr.io/open-webui/open-webui:main` and `services/open-persona-openwebui/start.sh` seeds the DB and runs `uvicorn`.
- To run locally you must follow Open WebUI documentation to install the Python app + deps, then:
  - Ensure `WEBUI_SECRET_KEY` (or let `start.sh` generate `.webui_secret_key`).
  - Set envs (see `docker-compose.yml` / `.env`) so the webui talks to the sidecar: e.g. `OPENAI_API_BASE_URLS=http://localhost:8000/v1` and `OPENAI_API_KEYS=sk-open-persona`.
  - From `services/open-persona-openwebui` run `./start.sh` (ensure required Python deps are installed).
- Note: running Open WebUI locally requires installing its Python dependencies; the image hides that. See `services/open-persona-openwebui/Dockerfile` for applied patches.

4) Opencode
- The stack uses the `ghcr.io/sst/opencode:latest` image. For a standalone local dev flow you can run the opencode container independently and point `OPENCODE_BASE_URL` to `http://localhost:4096`.

5) Example minimal local flow
- Start opencode via Docker: `docker run --rm -p 4096:4096 -v $(pwd):/workspace ghcr.io/sst/opencode:latest serve --hostname 0.0.0.0 --port 4096`
- Start instrumentl/mcp and sidecar locally per steps above.
- Start Open WebUI locally via `./start.sh` and ensure envs point to `http://localhost:8000` and `http://localhost:4096`.

**Healthchecks & verification**
- Sidecar: `curl -fsS http://localhost:8000/healthz`
- WebUI: `curl -fsS http://localhost:3000/health`
- Instrumentl: `curl -fsS http://localhost:7000/healthz`
- If services do not respond, check process logs and ensure ports are free and envs are correct.

**Troubleshooting quick tips**
- If Open WebUI persisted provider config on first boot, changing ENV provider mappings afterward may not take effect; clear the `open-webui` volume to reinitialize (data loss).
- For runner containers the sidecar expects Docker socket access when `RUNNER_MODE=container` (see `docker-compose.yml`).
- Avoid embedding multi-line secrets in HTTP headers; Open WebUI rejects CR/LF.

**C. Go launcher (new)**
A lightweight Go launcher was added at `open-persona-launcher/`. It automates generating a minimal env file, starting the Docker Compose stack, waiting for health endpoints, and optionally opening a browser.

- Location: `open-persona-launcher/`
- Branch created during development: `feat/launcher-go` (local). To publish the branch: `git push -u origin feat/launcher-go` (requires a GitHub account with push access).

Build & run the launcher
- From the repo root:
  - `cd open-persona-launcher`
  - `go build -o open-persona-launcher ./`
  - `./open-persona-launcher --project-dir /absolute/path/to/open-persona`
- Flags:
  - `--project-dir` Path to the open-persona repo (default: `../open-persona` when running inside the launcher folder)
  - `--env-file` Path to write the generated env file (default: `<project-dir>/.env.launcher`)
  - `--compose-file` Path to the docker-compose.yml (default: `<project-dir>/docker-compose.yml`)
  - `--no-browser` Do not open the browser at the end
  - `--timeout` Healthcheck timeout in seconds (default: 120)

Notes about the launcher
- The launcher creates an env file only if one doesn't already exist, and it uses restrictive permissions (0600).
- It relies on `docker` and `docker compose` being available on PATH and will fail if Docker is not reachable.
- The launcher is intended as a cross-platform single-binary utility; see `open-persona-launcher/DEVELOPMENT.md` for build and packaging instructions.

**D. Sketch: Turn this project into a self-launching "app"**
(unchanged) See earlier sections for implementation options, systemd sketch, packaging, and security notes.

**Next steps / Recommended deliverables**
- Push the `feat/launcher-go` branch to `origin` (requires SSH key or HTTPS token). If you want, push access can be configured with the key at `~/.ssh/gcompute.ssh`.
- Optionally add `--install-service` support to the launcher to create systemd/launchd units.
- Add packaging CI to produce cross-platform binaries.

