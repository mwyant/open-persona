import pathlib

TARGET = pathlib.Path("/app/backend/open_webui/routers/openai.py")

needle = "    headers, cookies = await get_headers_and_cookies(\n"
insertion = (
    "    headers, cookies = await get_headers_and_cookies(\n"
    "        request, url, key, api_config, metadata, user=user\n"
    "    )\n\n"
    "    # Open Persona: forward authenticated user id to sidecar\n"
    "    # so the sidecar can isolate workspaces per Open WebUI user.\n"
    "    if \"open-persona-sidecar\" in url:\n"
    "        headers[\"x-openwebui-user-id\"] = str(user.id)\n"
)

text = TARGET.read_text(encoding="utf-8")

if needle not in text:
    raise SystemExit(f"Patch failed: needle not found in {TARGET}")

# Replace the exact call site block with our augmented version.
# We keep the original formatting around it.
text = text.replace(
    "    headers, cookies = await get_headers_and_cookies(\n        request, url, key, api_config, metadata, user=user\n    )\n",
    insertion,
    1,
)

TARGET.write_text(text, encoding="utf-8")
print("Patched Open WebUI openai router")
