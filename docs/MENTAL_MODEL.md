# Minimal mental model

Open Persona = Open WebUI UI + opencode engine, connected by a sidecar.

## What runs where
- Open WebUI (`openwebui`): authentication, chat UI, workspace Models (Personas), Prompts.
- Sidecar (`open-persona-sidecar`): OpenAI-compatible API, routing, per-user workspaces, runner containers.
- Opencode runners (`open-persona-runner-*`): `opencode serve` instances that execute tools and write to the user workspace.
- MCP services (eg. `instrumentl-mcp`): external tools exposed to opencode.

## The three “control planes”
1) **Open WebUI Models** (Personas)
- User picks a Model in the UI.
- Model `meta.open_persona` is the safe config channel we forward to the sidecar.

2) **Open WebUI Tools** (settings UI)
- We use Tools valves as a real UI for secrets/settings:
  - per-user provider keys: `open_persona_provider_keys` (User Valves)
  - admin defaults: `open_persona_provider_defaults` (Tool Valves; admin-group restricted)

3) **Opencode config** (execution)
- Sidecar writes per-user `opencode.jsonc` into the workspace.
- Sidecar chooses the agent name to run based on persona + build/plan.

## Routing keys
- **User identity**: `x-openwebui-user-id` (injected by Open WebUI patch; do not trust client-supplied IDs).
- **Chat identity**: `x-openwebui-chat-id` (used only for Izzy memory/session persistence).

## File ownership (where to make changes)
- UI-ish behavior / user data sources: Open WebUI derived image:
  - `services/open-persona-openwebui/patch_openai_router.py`
  - `services/open-persona-openwebui/open_persona_seed.py`
- Routing/execution/persona behavior: sidecar:
  - `services/open-persona-sidecar/src/index.ts`
- New external integrations: MCP service(s):
  - `services/<integration>-mcp/`
- Deployment wiring: `docker-compose.yml`

## Golden rules
- Never forward multi-line secrets via headers (Open WebUI rejects CR/LF).
- Only inject headers for requests to `open-persona-sidecar`.
- Never log secrets (provider keys, tokens).
- Treat Open WebUI chat content as untrusted input.
