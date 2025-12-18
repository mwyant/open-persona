# Licensing tracker (Open Persona)

This file tracks upstream licenses and any obligations for redistribution.
Not legal advice.

## Upstreams

### OpenCode (opencode)
- Upstream: https://github.com/sst/opencode
- License: MIT (per upstream repository)
- Notes: For PoC we may consume `ghcr.io/sst/opencode` and/or `opencode-ai` releases; confirm license/NOTICE requirements for any redistributed binaries/images.

### Open WebUI
- Upstream: https://github.com/open-webui/open-webui
- License: mixed; project states an "Open WebUI License" plus additional branding preservation requirements.
- Notes: For PoC we plan to run the official container image (`ghcr.io/open-webui/open-webui`) without modifying upstream. If/when we fork or ship derivative UI code, we must comply with branding and any other terms in upstream `LICENSE` / `LICENSE_HISTORY`.

## Planned third-party components (likely)

### marked (marked.js)
- Source: https://github.com/markedjs/marked
- Version: 12.0.2 (vendored)
- License: MIT

- Docker images and base OS layers (various licenses)
- Node/TypeScript runtime deps for `open-persona-sidecar` (incl. `dockerode`)
- Node/TypeScript runtime deps for `instrumentl-mcp` (incl. `@modelcontextprotocol/sdk`, `zod`)
- Docker Engine API access when `RUNNER_MODE=container` (via `/var/run/docker.sock` mount)

## TODO
- Record exact upstream versions/tags used in PoC.
- Add dependency/license scanning strategy once we have a build.
