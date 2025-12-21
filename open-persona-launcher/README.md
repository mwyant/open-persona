# open-persona-launcher

Lightweight Go launcher for the open-persona project. The launcher automates environment creation, starts the Docker Compose stack, waits for service healthchecks, and (optionally) opens the browser.

This folder contains the launcher source and documentation for building a single cross-platform binary.

Quick usage (after building):

- Build:
  - `go build -o open-persona-launcher ./` (builds a local binary)

- Run (defaults to the repository path `/mnt/h/CCI/open-persona`):
  - `./open-persona-launcher`
  - To specify the open-persona repo path: `./open-persona-launcher --project-dir /path/to/open-persona`

Flags:
- `--project-dir` Path to the open-persona repo (default: `../open-persona` when running inside the launcher folder)
- `--env-file` Path to write the generated env file (default: `<project-dir>/.env.launcher`)
- `--compose-file` Path to the docker-compose.yml (default: `<project-dir>/docker-compose.yml`)
- `--no-browser` Do not open the browser at the end
- `--timeout` Healthcheck timeout in seconds (default: 120)

What it does:
1. Verifies Docker and `docker compose` are available.
2. Generates a minimal `.env` (or uses existing) to avoid overwriting user files.
3. Runs `docker compose --project-directory <project-dir> --env-file <env-file> up --build -d`.
4. Polls health endpoints for Open WebUI and sidecar until ready or timeout.
5. Optionally opens the browser to `http://localhost:3000`.

Development notes and step-by-step docs are in `DEVELOPMENT.md`.
