# Cookbook

This file is intentionally copy/paste friendly.
Target readers:
- Developers who need quick commands
- Smaller AI agents that need explicit steps

## Start the stack
```bash
docker compose up --build
```

URLs:
- Open WebUI: `http://localhost:3000`
- Sidecar: `http://localhost:8000/healthz`
- Instrumentl MCP (stub): `http://localhost:7000/healthz`

## Authenticate (API)
Open WebUI auth returns JSON with a `token` field.

```bash
curl -sS -X POST http://localhost:3000/api/v1/auths/signin \
  -H 'content-type: application/json' \
  --data-raw '{"email":"<EMAIL>","password":"<PASSWORD>"}'
```

Export token (requires `python3`):
```bash
TOKEN=$(curl -sS -X POST http://localhost:3000/api/v1/auths/signin \
  -H 'content-type: application/json' \
  --data-raw '{"email":"<EMAIL>","password":"<PASSWORD>"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
```

## Provider keys UI (Tools)
We store provider keys in Open WebUI Tools via valves.

Tools:
- Per-user keys tool: `open_persona_provider_keys`
- Admin defaults tool (restricted): `open_persona_provider_defaults`

### Set admin defaults (tool valves)
```bash
curl -sS -X POST http://localhost:3000/api/v1/tools/id/open_persona_provider_defaults/valves/update \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  --data-raw '{"openai_api_key":"sk-...","anthropic_api_key":"sk-..."}'
```

### Set per-user keys (user valves)
```bash
curl -sS -X POST http://localhost:3000/api/v1/tools/id/open_persona_provider_keys/valves/user/update \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  --data-raw '{"openai_api_key":"sk-user-..."}'
```

### Verify valves schema exists
```bash
curl -sS http://localhost:3000/api/v1/tools/id/open_persona_provider_keys/valves/user/spec \
  -H "authorization: Bearer $TOKEN" | head
```

## Personas / Models

### Izzy model settings
Izzy is an Open WebUI Model (id: `izzy`) that routes to `open-persona/build`.

Key fields:
- `base_model_id`: must be `open-persona/build` for routing
- `meta.open_persona`: persona configuration channel forwarded to the sidecar

Update Izzy (example):
```bash
curl -sS http://localhost:3000/api/v1/models/model?id=izzy \
  -H "authorization: Bearer $TOKEN" > /tmp/izzy.json

python3 - <<'PY'
import json
p='/tmp/izzy.json'
with open(p,'r',encoding='utf-8') as f:
  m=json.load(f)

m['base_model_id']='open-persona/build'
meta=m.get('meta') or {}
meta['open_persona']={
  'persona': {'template':'izzy'},
  'integrations': {'instrumentl': {'enabled': True}},
  'memory': {'enabled': True, 'self_reference_level': 0.35}
}
m['meta']=meta

print(json.dumps({
  'id': m['id'],
  'base_model_id': m.get('base_model_id'),
  'name': m.get('name') or m['id'],
  'meta': m.get('meta') or {},
  'params': m.get('params') or {},
  'access_control': m.get('access_control'),
  'is_active': m.get('is_active', True)
}, indent=2))
PY > /tmp/izzy_update.json

curl -sS -X POST http://localhost:3000/api/v1/models/model/update \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  --data-binary @/tmp/izzy_update.json
```

### Create a new Persona model (example: No Nonsense Grant Draft)
This creates a workspace model that wraps `open-persona/build` but selects a different locked template.

1) Fetch a base model template (any existing model JSON) and edit:
- `id`: `grant-draft`
- `name`: `No Nonsense Grant Draft`
- `base_model_id`: `open-persona/build`
- `meta.open_persona.persona.template`: `grant-draft`

2) Submit via `/api/v1/models/model/update` (same pattern as above).

## Prompts
Seed prompt JSON exists:
- `seed/prompt.instrumentl-rfp-search.json`

For now, import it manually into Open WebUI prompts, or POST it to the prompts create endpoint once we add it here.

## Verification / Debug

### Confirm runner containers
```bash
docker ps --filter 'name=open-persona-runner-' --format '{{.Names}}'
```

### Confirm per-user workspace dirs
```bash
docker compose exec -T open-persona-sidecar sh -lc 'ls -1 /workspace/open-persona | head'
```

### Confirm which user is routing where
Set `LOG_WORKSPACE_ROUTING=1` on `open-persona-sidecar` in `docker-compose.yml` then:
```bash
docker compose logs -f open-persona-sidecar
```

### Common failure: empty responses
If providers are misconfigured, the sidecar may return an error block or a “No output” message.
Check:
- `docker compose logs -f open-persona-sidecar`
- `docker logs <runner-container>`
