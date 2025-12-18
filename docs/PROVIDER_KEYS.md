# Provider keys (per-user + admin defaults)

## What we want
- Each Open WebUI user can set their own provider keys.
- Admins can set defaults.
- Sidecar passes the right keys into the right opencode runner container.

## Where keys are stored (Open WebUI DB)
We use Open WebUI “Tools” as a settings UI:

1) Per-user keys tool (public)
- Tool id: `open_persona_provider_keys`
- Stores per-user keys in **User Valves**.

2) Admin defaults tool (restricted)
- Tool id: `open_persona_provider_defaults`
- Stores default keys in **Tool Valves**.
- Access-controlled to the `open_persona_admins` group.

## How keys flow
Open WebUI → sidecar headers:
- `x-openpersona-openai-api-key`
- `x-openpersona-anthropic-api-key`
- `x-openpersona-openrouter-api-key`

Sidecar → opencode runner env:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`

## Runner identity
Runner container name includes a `keySig` so rotating keys gets a new runner:
- `open-persona-runner-<workspaceHash>-<keySig>`

The runner also uses separate XDG state paths per keySig:
- `XDG_CONFIG_HOME=/data/config/<workspaceHash>/<keySig>`
- `XDG_STATE_HOME=/data/state/<workspaceHash>/<keySig>`
