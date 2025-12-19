# Open Persona docs

This folder is the human + AI-friendly documentation for this repo.

Start here:
- `docs/MENTAL_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md` (local dev, lint, tests)
- `docs/PROVIDER_KEYS.md` (provider key flow + security)
- `docs/PERSONAS.md`
- `docs/OPENWEBUI_INTEGRATION.md`
- `docs/AGENT_TASKS.md`
- `docs/COOKBOOK.md`

Developer setup quick notes:
- From the repo root run `npm install` to install dev tools and enable pre-commit hooks (Husky `prepare` script). The pre-commit hook runs lint-staged and a lightweight secret check.
- Run `cd services/open-persona-sidecar && npm run lint` to lint and `npm run test` to run unit tests (uses Vitest).
