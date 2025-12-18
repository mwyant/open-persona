# Agent tasks (for smaller coding agents)

This file lists common changes and exactly where to implement them.

## 1) Add a new Persona (Open WebUI Model)
Goal: user selects a Model → sidecar uses a matching opencode agent.

Steps:
- Create/update an Open WebUI Model with:
  - `base_model_id = open-persona/build` (routes through sidecar)
  - `meta.open_persona` payload for persona features
- Recommended `meta.open_persona` fields:
  - `persona.template`: selects locked core voice (eg. `izzy`, `grant-draft`)
  - `integrations.*.enabled`: toggles tools per persona (eg. instrumentl)
  - `memory.enabled`, `memory.self_reference_level`: only honored for Izzy

Where it’s implemented:
- Open WebUI patch forwards `meta.open_persona` → `x-openpersona-meta-b64`.
- Sidecar parses meta and writes per-user opencode config.

## 2) Add a new locked persona template
Goal: “swap Izzy for another person”.

Edit:
- `services/open-persona-sidecar/src/index.ts`
  - Add a new `PersonaTemplateId`
  - Add a new `*_CORE_PROMPT`
  - Update `personaTemplateFromRequest()`
  - Update `applyLockedPersonaCore()`

Rules:
- Keep locked core non-negotiable.
- Keep a clearly separated “user-editable settings” section.
- Only Izzy is allowed memory/session persistence.

## 3) Add an integration toggle (MCP tool)
Goal: persona enables/disables an integration without code changes.

Edit:
- Sidecar config generator:
  - `services/open-persona-sidecar/src/index.ts`
  - `buildOpencodeConfig()` should include MCP server and set tools disabled by default.
  - Per-persona `tools` enablement toggled by `meta.open_persona.integrations.<name>.enabled`.

Add service:
- `services/<name>-mcp/` and wire into `docker-compose.yml`.

## 4) Store a new per-user secret/setting with a UI
Preferred mechanism: Open WebUI Tools valves.

Pattern:
- Create a settings-only tool module (no callable tool functions):
  - Provide `UserValves` for per-user fields
  - Provide `Valves` for admin defaults (optional)
- Seed it with `open_persona_seed.py` so it exists automatically.
- Read it in `patch_openai_router.py` and forward only to the sidecar.

Files:
- `services/open-persona-openwebui/open_persona_seed.py`
- `services/open-persona-openwebui/patch_openai_router.py`

## 5) Change how opencode runners are isolated
Edit:
- `services/open-persona-sidecar/src/index.ts` (runner orchestration)

Notes:
- Runner container names are keyed by `(user workspace hash + provider keySig)`.
- XDG paths are also separated by keySig.

## 6) Debugging checklist
- Is Open WebUI up? `curl http://localhost:3000/api/version`
- Is sidecar up? `curl http://localhost:8000/healthz`
- Are provider keys set?
  - user tool: `open_persona_provider_keys`
  - admin tool: `open_persona_provider_defaults`
- Are runner containers created? `docker ps --filter 'name=open-persona-runner-'`
- Check logs:
  - `docker compose logs -f open-persona-sidecar`
  - `docker logs <runner>`
