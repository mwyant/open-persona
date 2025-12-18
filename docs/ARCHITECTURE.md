# Architecture

## Goal
Run Open WebUI as the UI, but use opencode as the agent engine (multi-agent, tool use, per-user workspaces).

## Services (docker compose)
- `openwebui` (Open WebUI backend + built UI)
- `open-persona-sidecar` (OpenAI-compatible API → opencode)
- `opencode` (shared `opencode serve` backend; optional)
- `instrumentl-mcp` (stub MCP server used by opencode)

## Request flow
1. Browser → Open WebUI (`openwebui`)
2. Open WebUI routes to its OpenAI provider base URL
3. Provider base URL points at `open-persona-sidecar:8000/v1`
4. Sidecar:
   - derives `workspaceKey` from `x-openwebui-user-id` (patched in Open WebUI)
   - chooses/creates an opencode runner (`RUNNER_MODE=container`)
   - creates/reuses an opencode session per chat id (Izzy only)
   - posts to `opencode serve` HTTP API
   - returns OpenAI-compatible JSON/SSE

## Isolation model
- Per-user workspace dir: `/workspace/open-persona/<sha256(user-id)[:16]>`
- Runner mode:
  - `shared`: all users talk to the single `opencode` service
  - `container`: sidecar spawns a runner container per `(user, provider-keys signature)`

## Key files
- `docker-compose.yml`
- `services/open-persona-sidecar/src/index.ts`
- `services/open-persona-openwebui/patch_openai_router.py`
- `services/open-persona-openwebui/open_persona_seed.py`
