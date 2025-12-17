# AGENTS.md (open-persona)

## Build / Lint / Test
- Stack: `docker compose up --build` (Open WebUI on `:3000`, sidecar on `:8000`).
- Sidecar (local): `npm install` then `npm run build|lint|test` in `services/open-persona-sidecar/`.
- Single test (sidecar): `npm test -- -t "name"` or `npm test -- src/index.test.ts`.

## Style / Conventions
- Keep changes minimal and consistent with existing patterns.
- TypeScript: prefer explicit types at boundaries; avoid `any`; use `unknown` + narrowing.
- Imports: group (node/builtins → external → internal); keep sorted; avoid deep relative paths if aliases exist.
- Formatting: run project formatter (likely Prettier) and don’t reformat unrelated code.
- Naming: `camelCase` variables/functions, `PascalCase` types/classes/components, `SCREAMING_SNAKE_CASE` constants.
- Error handling: don’t swallow errors; add actionable context; return correct HTTP status codes; log once.
- Security: treat Open WebUI user input as untrusted; never log secrets; isolate per-user workspaces.
- Keep `LICENSES.md` updated when adding/updating upstreams or major dependencies.
