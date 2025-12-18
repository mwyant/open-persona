# AGENTS.md (open-persona)

## Build / Lint / Test
- Stack (primary): `docker compose up --build`.
- Rebuild one service: `docker compose build open-persona-sidecar` / `docker compose build openwebui`.
- Sidecar (local): `npm install` then `npm run build|lint|test` in `services/open-persona-sidecar/`.
- Instrumentl MCP (local): `npm install` + `npm run build` in `services/instrumentl-mcp/`.
- Single test (sidecar): `npm test -- -t "name"` or `npm test -- src/index.test.ts`.

## Style / Conventions
- Keep changes minimal; don’t reformat unrelated code.
- TypeScript: explicit types at boundaries; avoid `any`; prefer `unknown` + narrowing.
- Naming: `camelCase` vars, `PascalCase` types, `SCREAMING_SNAKE_CASE` constants.
- Security: never log secrets; no multi-line secrets in headers (Open WebUI blocks CR/LF).
- Open WebUI patches must be backend-only and scoped to `open-persona-sidecar` URLs.
- Start from docs: `docs/ARCHITECTURE.md`, `docs/PROVIDER_KEYS.md`, `docs/PERSONAS.md`.
- Update `LICENSES.md` when adding dependencies/upstreams.
