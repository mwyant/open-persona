# AGENTS.md

## Build / Lint / Test
- Stack (primary): `docker compose up --build`.
- Rebuild one service: `docker compose build open-persona-sidecar` / `docker compose build openwebui`.
- Sidecar (local): `npm install` then `npm run build|lint|test` in `services/open-persona-sidecar/`.
- Instrumentl MCP (local): `npm install` + `npm run build` in `services/instrumentl-mcp/`.
- Single test (sidecar): `npm test -- -t "name"` or `npm test -- src/index.test.ts`.

## Style / Conventions
- Keep changes minimal; don't reformat unrelated code.
- TypeScript: explicit types at boundaries; avoid `any`; prefer `unknown` + narrowing.
- Naming: `camelCase` vars, `PascalCase` types, `SCREAMING_SNAKE_CASE` constants.
- Security: never log secrets; no multi-line secrets in headers (Open WebUI blocks CR/LF).
- Open WebUI patches must be backend-only and scoped to `open-persona-sidecar` URLs.
- Start from docs: `docs/MENTAL_MODEL.md`, `docs/AGENT_TASKS.md`, `docs/COOKBOOK.md`.
- Update `LICENSES.md` when adding dependencies/upstreams.

## Subagents
Sub-agentic processing is crucial. Create specialized subagents in `./agents/` folder with granular prompts (<400 tokens) for:
- yml expert agent
- bash expert agent
- docker expert agent
- python expert agent
- etc.

## Subagents
Sub-agentic processing is crucial. Create specialized subagents in `./agents/` folder with granular prompts (<400 tokens) for:
- yml expert agent
- bash expert agent
- docker expert agent
- python expert agent
- etc.