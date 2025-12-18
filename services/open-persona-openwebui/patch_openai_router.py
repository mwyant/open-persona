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

insertion = (
    call_block
    + "\n"
    + "    # Open Persona: forward user + persona to sidecar\n"
    + "    if \"open-persona-sidecar\" in url:\n"
    + "        headers[\"x-openwebui-user-id\"] = str(user.id)\n"
    + "        headers[\"x-openpersona-original-model-id\"] = str(open_persona_original_model_id)\n"
    + "        try:\n"
    + "            # Only forward our extension meta to avoid leaking unrelated data.\n"
    + "            open_persona_ext = (open_persona_model_meta or {}).get(\"open_persona\")\n"
    + "            if open_persona_ext is not None:\n"
    + "                headers[\"x-openpersona-meta-b64\"] = base64.b64encode(json.dumps(open_persona_ext).encode()).decode()\n"
    + "        except Exception:\n"
    + "            pass\n"
    + "\n"
    + "        # Open Persona: forward per-user provider keys (no newlines allowed in headers).\n"
    + "        try:\n"
    + "            settings = user.settings.model_dump() if getattr(user, 'settings', None) else {}\n"
    + "            open_persona_settings = (settings or {}).get('open_persona', {})\n"
    + "            provider_keys = (open_persona_settings or {}).get('provider_keys', {})\n"
    + "\n"
    + "            def _clean(v):\n"
    + "                return str(v).replace('\\n', '').replace('\\r', '').strip()\n"
    + "\n"
    + "            openai_key = _clean(provider_keys.get('openai_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_OPENAI_API_KEY', ''))\n"
    + "            anthropic_key = _clean(provider_keys.get('anthropic_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_ANTHROPIC_API_KEY', ''))\n"
    + "            openrouter_key = _clean(provider_keys.get('openrouter_api_key') or os.environ.get('OPEN_PERSONA_DEFAULT_OPENROUTER_API_KEY', ''))\n"
    + "\n"
    + "            if openai_key:\n"
    + "                headers['x-openpersona-openai-api-key'] = openai_key\n"
    + "            if anthropic_key:\n"
    + "                headers['x-openpersona-anthropic-api-key'] = anthropic_key\n"
    + "            if openrouter_key:\n"
    + "                headers['x-openpersona-openrouter-api-key'] = openrouter_key\n"
    + "        except Exception:\n"
    + "            pass\n"
)

if "x-openpersona-original-model-id" not in text:
    text = text.replace(call_block, insertion, 1)

TARGET.write_text(text, encoding="utf-8")
print("Patched Open WebUI openai router")
