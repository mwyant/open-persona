# Integrations plan (Instrumentl, NY State, Federal)

This document outlines how we will integrate external grant sources into Open Persona.

## Guiding principles
- Integrate via opencode-native mechanisms first (tools/MCP), not bespoke UI.
- All integrations must be toggleable:
  - Admin defaults (system-wide)
  - Per-user overrides (user panel)
  - Per-persona enablement (Open WebUI Models)
- Avoid scraping behind logins unless there is explicit permission and a stable/legal method.

## Instrumentl (primary target)
### What we know
- Instrumentl offers an official API (plan-gated) and public API docs: https://www.instrumentl.com/api-docs
- Initial development uses stub responses until API credentials are available.

### v0.2.x (current scaffolding)
- Provide a remote MCP server `instrumentl-mcp` with placeholder tools:
  - `search_grants(criteria, limit)`
  - `get_grant(id)`
- Wire opencode config to include the MCP server and keep its tools disabled globally.
- Enable `instrumentl*` tools per persona via Open WebUI Model `meta.open_persona`.

### v0.3.x (real API wiring)
- Add user-level API key storage (Open WebUI user settings → forwarded to sidecar).
- Replace stub MCP tool implementations with real Instrumentl API calls.
- Add basic caching + rate limiting to the MCP server.

### v0.4.x (workflow UX)
- Ship the saved prompt `/instrumentl-rfp-search` (Open WebUI prompt) as the primary user entrypoint.
- Persona-backed workflow:
  - Search broadly, rank results, then fetch details for the top few.
  - Follow-up questions reuse the same Open WebUI chat id → same opencode session.

## NY State SFS Grants / Vendor Portal
- Unknown API availability. Assume portal login + human workflows.
- Plan:
  1) Identify official APIs / feeds (preferred).
  2) If none, evaluate integration via export/download formats (CSV/Excel/PDF) rather than automation.
  3) Only if explicitly permitted and stable, consider browser automation (Playwright) running in a locked-down worker.

## Federal grant sources
- Prefer official/public APIs:
  - Grants.gov (opportunity search)
  - SAM.gov (opportunities; if applicable)
- Implement as separate MCP tools/services, gated by persona enablement similar to Instrumentl.

## How personas enable integrations (proposed)
Open WebUI Models can store extra JSON in `meta` (ModelMeta is `extra=allow`).
Example:
```json
{
  "open_persona": {
    "integrations": {
      "instrumentl": { "enabled": true },
      "nys_sfs": { "enabled": false },
      "grants_gov": { "enabled": false }
    }
  }
}
```
The Open WebUI patch forwards this to the sidecar, which writes per-user opencode config to enable/disable MCP tools for that persona.
