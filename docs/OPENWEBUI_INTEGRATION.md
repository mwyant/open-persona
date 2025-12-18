# Open WebUI integration

Open WebUI is intentionally kept as close to upstream as possible.
We build a tiny derived image that patches one backend router and adds a startup seeder.

## Patched behavior
File: `services/open-persona-openwebui/patch_openai_router.py`

When Open WebUI sends requests to a base URL that contains `open-persona-sidecar`:
- Adds `x-openwebui-user-id: <user.id>`
- Adds `x-openpersona-original-model-id: <selected model id>`
- Adds `x-openpersona-meta-b64: <base64(json(model.meta.open_persona))>`
- Adds provider key headers sourced from tool valves/user valves (see provider keys doc)

This is only applied for the sidecar URL to avoid leaking identifiers/secrets to other providers.

## Startup seeding
Files:
- `services/open-persona-openwebui/open_persona_seed.py`
- `services/open-persona-openwebui/start.sh`

The seeder ensures:
- An `open_persona_admins` group exists
- Admin-role users are added to it
- A public tool exists for per-user provider keys (user valves)
- An admin-only tool exists for default provider keys (tool valves)
