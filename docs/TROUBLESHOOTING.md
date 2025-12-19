# Troubleshooting Open Persona + Open WebUI

This document lists checks and steps to diagnose "fetch failed" errors in the Open WebUI build when tools or tool servers do not load.

1) Check container logs
- `docker compose logs openwebui` and `docker compose logs open-persona-openwebui` for stack traces.
- Look for 4xx/5xx responses and trace the upstream URL.

2) Verify sidecar header forwarding
- The OpenWebUI patch injects headers only for allowed sidecar hosts (configurable).
- The patch uses a strict hostname allowlist; the allowlist can be configured via the environment variable `OPEN_PERSONA_SIDECAR_ALLOWLIST` on the Open WebUI side (comma-separated hosts, defaults: `open-persona-sidecar,localhost,127.0.0.1`).
- `services/open-persona-openwebui/patch_openai_router.py` performs the injection when the destination host matches the allowlist.
- Ensure the running Open WebUI image contains this patch (image built after Dockerfile changes). If you changed branch, rebuild the image.

3) Tool server connectivity
- If tools are external (TOOL_SERVER_CONNECTIONS), verify the connections and auth are configured in `config`.
- For OAuth tool servers, ensure sessions are created for the user.

4) Access control (valves)
- `patch_tools_router.py` enforces access_control for valves endpoints. If a UI client sees "fetch failed", check whether the request was blocked with 401/403.
- Confirm that the tool's `access_control` fields allow the requesting user/group.

5) Provider keys
- The sidecar forwards provider keys in custom headers (`x-openpersona-*-api-key`). If keys are empty, tools that rely on them will fail.
- Check tools `open_persona_provider_defaults_tool.py` and user valves for values.

6) CORS and browser errors
- If the browser reports CORS, confirm the Open WebUI backend permits the origin or uses same origin.

7) Quick checks
- Rebuild and restart Open WebUI image: `docker compose build open-persona-openwebui && docker compose up --no-deps open-persona-openwebui`
- Confirm environment variables (`BYPASS_ADMIN_ACCESS_CONTROL`, provider envs) are set in `docker-compose.yml` or runtime.

If you'd like, I can:
- Run these checks locally against your running stack (logs, env, network calls).
- Add automated integration tests to exercise the valve endpoints and provider key forwarding.

Next: I will update `services/open-persona-openwebui/patch_tools_router.py` to be configurable (done), and create an agent task list for system troubleshooting if you want me to run them now.