# Development notes — open-persona-launcher

This file documents the steps I followed to implement the Go launcher and how you can develop or extend it.

1) Initialize module
- `cd /mnt/h/CCI/open-persona-launcher`
- `go mod init github.com/your-username/open-persona-launcher` (the module name in this repo is kept generic)

2) Files created
- `main.go` — main application logic
- `README.md` — user-facing usage
- `DEVELOPMENT.md` — this file

3) Building locally
- `go build -o open-persona-launcher ./`
- Run with `./open-persona-launcher --project-dir /mnt/h/CCI/open-persona`

4) Cross-compilation examples
- Linux amd64: `GOOS=linux GOARCH=amd64 go build -o open-persona-launcher-linux-amd64 ./`
- macOS arm64: `GOOS=darwin GOARCH=arm64 go build -o open-persona-launcher-darwin-arm64 ./`

5) How the launcher works (summary)
- Checks that `docker` binary exists and that `docker compose version` runs.
- Generates an `.env.launcher` with safe permissions (0600) if no existing env file is provided.
- Calls `docker compose --project-directory <projectDir> --env-file <envFile> up --build -d`.
- Waits for health endpoints (Open WebUI `http://localhost:3000/health` and sidecar `http://localhost:8000/healthz`).
- Opens the default browser on success (unless `--no-browser` set).

6) Extending the launcher
- Add platform-specific installers (systemd unit or launchd plist) behind a `--install-service` flag.
- Add more sophisticated env templating and secret storage (use OS keystore integrations).
- Add progress reporting and incremental log tailing via `docker compose logs --follow`.

7) Security notes
- Generated env file uses restrictive permissions (0600).
- Launcher does not log secrets.

