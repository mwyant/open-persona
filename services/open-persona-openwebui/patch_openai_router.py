import pathlib

TARGET = pathlib.Path("/app/backend/open_webui/routers/openai.py")

text = TARGET.read_text(encoding="utf-8")

# Ensure required imports exist (we inject base64 encoding + os for env defaults).
if "import base64" not in text:
    text = text.replace("import json\n", "import json\nimport base64\n", 1) if "import json\n" in text else ("import base64\n" + text)

if "import os" not in text:
    # Open WebUI openai.py uses plain imports at the top.
    # Insert after the base64 import if present, else after json.
    if "import base64\n" in text:
        text = text.replace("import base64\n", "import base64\nimport os\n", 1)
    elif "import json\n" in text:
        text = text.replace("import json\n", "import json\nimport os\n", 1)
    else:
        text = "import os\n" + text

# Ensure the Tools model import exists for valve lookup.
if "from open_webui.models.tools import Tools" not in text:
    anchor = "from open_webui.models.users import UserModel\n"
    if anchor in text:
        text = text.replace(anchor, anchor + "from open_webui.models.tools import Tools\n", 1)

# 1) Preserve the original Open WebUI model id (Persona)
orig_model_line = "    model_id = form_data.get(\"model\")\n"
if orig_model_line not in text:
    raise SystemExit("Patch failed: model_id assignment not found")

if "open_persona_original_model_id" not in text:
    text = text.replace(
        orig_model_line,
        orig_model_line + "    open_persona_original_model_id = model_id\n",
        1,
    )

# 2b) Preserve Open Persona meta (ModelMeta allows extra fields)
# The indentation of this block can change across Open WebUI versions.
if "open_persona_model_meta" not in text:
    if "        if model_info:\n" in text:
        text = text.replace(
            "        if model_info:\n",
            "        if model_info:\n            open_persona_model_meta = model_info.meta.model_dump()\n",
            1,
        )
    elif "    if model_info:\n" in text:
        text = text.replace(
            "    if model_info:\n",
            "    if model_info:\n        open_persona_model_meta = model_info.meta.model_dump()\n",
            1,
        )
    else:
        raise SystemExit("Patch failed: model_info if-block not found")

# 3) Inject headers when forwarding to open-persona-sidecar
call_block = (
    "    headers, cookies = await get_headers_and_cookies(\n"
    "        request, url, key, api_config, metadata, user=user\n"
    "    )\n"
)

if call_block not in text:
    raise SystemExit("Patch failed: get_headers_and_cookies call block not found")

injection = '''
    # Open Persona: validate destination host strictly before forwarding any secrets.
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = (parsed.hostname or '').lower()
    except Exception:
        host = ''
    allowlist_csv = os.environ.get('OPEN_PERSONA_SIDECAR_ALLOWLIST', 'open-persona-sidecar,localhost,127.0.0.1')
    allowlist = set([h.strip().lower() for h in allowlist_csv.split(',') if h.strip()])

    def host_allowed(h):
        if not h:
            return False
        if h in allowlist:
            return True
        if h.endswith('.svc.cluster.local'):
            base = h.split('.')[0]
            if base in allowlist:
                return True
        return False

    if host_allowed(host):
        headers["x-openwebui-user-id"] = str(user.id)
        headers["x-openpersona-original-model-id"] = str(open_persona_original_model_id)
        try:
            # Only forward our extension meta to avoid leaking unrelated data.
            open_persona_ext = (open_persona_model_meta or {}).get("open_persona")
            if open_persona_ext is not None:
                headers["x-openpersona-meta-b64"] = base64.b64encode(json.dumps(open_persona_ext).encode()).decode()
        except Exception:
            import logging
            logging.getLogger(__name__).warning('open-persona: failed to forward open_persona_meta')

        # Open Persona: forward provider keys from the Open Persona tool valves.
        # - Tool Valves = admin defaults
        # - User Valves = per-user overrides
        # Keys are sanitized to avoid CR/LF in headers.
        try:
            user_tool_id = 'open_persona_provider_keys'
            admin_tool_id = 'open_persona_provider_defaults'
            tool_valves = Tools.get_tool_valves_by_id(admin_tool_id) or {}
            user_valves = Tools.get_user_valves_by_id_and_user_id(user_tool_id, str(user.id)) or {}

            def _clean(v):
                s = str(v).replace('\n', '').replace('\r', '').strip()
                # remove other control chars and enforce reasonable max length
                s = ''.join(ch for ch in s if ch.isprintable())[:4096]
                return s

            openai_key = _clean(user_valves.get('openai_api_key') or tool_valves.get('openai_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_OPENAI_API_KEY', ''))
            anthropic_key = _clean(user_valves.get('anthropic_api_key') or tool_valves.get('anthropic_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_ANTHROPIC_API_KEY', ''))
            openrouter_key = _clean(user_valves.get('openrouter_api_key') or tool_valves.get('openrouter_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_OPENROUTER_API_KEY', ''))

            if openai_key:
                headers['x-openpersona-openai-api-key'] = openai_key
            if anthropic_key:
                headers['x-openpersona-anthropic-api-key'] = anthropic_key
            if openrouter_key:
                headers['x-openpersona-openrouter-api-key'] = openrouter_key

            # clear sensitive variables from local scope to reduce accidental leakage
            try:
                del openai_key, anthropic_key, openrouter_key
            except Exception:
                pass
        except Exception:
            import logging
            logging.getLogger(__name__).warning('open-persona: failed to forward provider keys')
    else:
        import logging
        logging.getLogger(__name__).debug(f'open-persona: not forwarding keys to disallowed host: {host}')
'''

if "x-openpersona-original-model-id" not in text:
    text = text.replace(call_block, call_block + injection, 1)

TARGET.write_text(text, encoding="utf-8")
print("Patched Open WebUI openai router")
