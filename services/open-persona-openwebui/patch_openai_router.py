import pathlib

TARGET = pathlib.Path("/app/backend/open_webui/routers/openai.py")

text = TARGET.read_text(encoding="utf-8")

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

# 2) After model params extraction, preserve system prompt before it is applied
system_pop_line = "            system = params.pop(\"system\", None)\n"
if system_pop_line not in text:
    raise SystemExit("Patch failed: system pop not found")

if "open_persona_system_prompt" not in text:
    text = text.replace(
        system_pop_line,
        system_pop_line + "            open_persona_system_prompt = system\n",
        1,
    )

# 2b) Preserve Open Persona meta (ModelMeta allows extra fields)
model_info_line = "    if model_info:\n"
if model_info_line not in text:
    raise SystemExit("Patch failed: model_info if-block not found")

if "open_persona_model_meta" not in text:
    text = text.replace(
        model_info_line,
        model_info_line + "        open_persona_model_meta = model_info.meta.model_dump()\n",
        1,
    )

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
    + "        if \"open_persona_system_prompt\" in locals() and open_persona_system_prompt:\n"
    + "            headers[\"x-openpersona-system-prompt\"] = str(open_persona_system_prompt)\n"
)

if "x-openpersona-original-model-id" not in text:
    text = text.replace(call_block, insertion, 1)

TARGET.write_text(text, encoding="utf-8")
print("Patched Open WebUI openai router")
