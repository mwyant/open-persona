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
Open WebUI → sidecar headers (forwarded only to allowlisted sidecar hosts):
- `x-openpersona-openai-api-key`
- `x-openpersona-anthropic-api-key`
- `x-openpersona-openrouter-api-key`

Sidecar → opencode runner env (sidecar maps headers to env vars inside the runner):
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENROUTER_API_KEY`

Security practices
- Do NOT commit provider keys to the repository. Use placeholders in examples and store real keys in secure locations:
  - Local development: keep keys in `~/.env` or a local secret manager (ensure `.env` is in `.gitignore`).
  - CI: use GitHub Actions secrets (`secrets.*`) and avoid putting keys in workflow files.
- The sidecar only forwards provider keys to hosts in `OPEN_PERSONA_SIDECAR_ALLOWLIST` (defaults: `open-persona-sidecar,localhost,127.0.0.1`). Configure this env var in the Open WebUI deployment to protect against accidental key exfiltration.
- Rotate keys immediately if they are ever committed to the repository or exposed.

## Runner identity
Runner container name includes a `keySig` so rotating keys gets a new runner:
- `open-persona-runner-<workspaceHash>-<keySig>`

The runner also uses separate XDG state paths per keySig:
- `XDG_CONFIG_HOME=/data/config/<workspaceHash>/<keySig>`
- `XDG_STATE_HOME=/data/state/<workspaceHash>/<keySig>`
