import pathlib

TARGET = pathlib.Path("/app/backend/open_webui/routers/tools.py")

text = TARGET.read_text(encoding="utf-8")

# Open Persona: enforce access_control for tool valves endpoints.
#
# Open WebUI filters tool listing by access_control, but (in upstream) the valves endpoints
# did not enforce access_control. That meant a user could call valves endpoints if they knew
# the tool id, even when the tool was hidden.
#
# This patch is deliberately narrow: it only affects the *valves* endpoints.

def patch_endpoint(signature: str, mode: str) -> None:
    global text

    if signature not in text:
        raise SystemExit(f"Patch failed: endpoint signature not found: {signature}")

    marker = "    if tools:"
    start = text.index(signature)
    # limit search to a window after signature to avoid patching other functions
    window = text[start : start + 2000]

    if "Open Persona: enforce access_control for tool valves" in window:
        return

    idx = window.index(marker)
    injected = (
        marker
        + "\n"
        + "        # Open Persona: enforce access_control for tool valves\n"
        + "        user_group_ids = {group.id for group in Groups.get_groups_by_member_id(user.id)}\n"
        + f"        if not has_access(user.id, \"{mode}\", tools.access_control, user_group_ids, strict=True):\n"
        + "            raise HTTPException(\n"
        + "                status_code=status.HTTP_401_UNAUTHORIZED,\n"
        + "                detail=ERROR_MESSAGES.UNAUTHORIZED,\n"
        + "            )\n"
    )

    window = window.replace(marker, injected, 1)
    text = text[:start] + window + text[start + 2000 :]


# Read valves
patch_endpoint(
    "async def get_tools_valves_by_id(id: str, user=Depends(get_verified_user)):",
    "read",
)

# Read valves schema
patch_endpoint(
    "async def get_tools_valves_spec_by_id(\n    request: Request, id: str, user=Depends(get_verified_user)\n):",
    "read",
)

# Write/update valves
# This endpoint has more logic below; we enforce write access early.
patch_endpoint(
    "async def update_tools_valves_by_id(\n    request: Request, id: str, form_data: dict, user=Depends(get_verified_user)\n):",
    "write",
)

TARGET.write_text(text, encoding="utf-8")
print("Patched Open WebUI tools router (valves access_control)")
