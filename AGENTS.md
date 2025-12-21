# AGENTS.md (open-persona)

## Build / Lint / Test
- Stack (primary): `docker compose up --build` (from repo root).
- Rebuild one service: `docker compose build open-persona-sidecar` or `docker compose build openwebui`.
- Sidecar (local):
  - `cd services/open-persona-sidecar`
  - `npm install`
  - `npm run build`
  - `npm run lint`
  - `npm run test` (Vitest)
  - Run a single test: `npm run test -- -t "test name"` or `npx vitest run src/index.test.ts`.
- Instrumentl MCP (local): `cd services/instrumentl-mcp && npm install && npm run build`.

## Style / Conventions
- Keep changes minimal and focused; avoid reformatting unrelated files.
- TypeScript: prefer explicit types at public/module boundaries; avoid `any`; use `unknown` + narrowing when appropriate.
- Naming: `camelCase` for variables and functions; `PascalCase` for types/interfaces; `SCREAMING_SNAKE_CASE` for constants.
- Logging: use structured logs and never log secrets or full request bodies.
- Security: never forward multi-line secrets; Open WebUI rejects CR/LF in headers.
- When editing files touched by AGENTS.md instructions, follow this file and docs in `docs/`.

## Documentation & Docs Viewer
- Keep README.md quickstart up to date (docker compose, single-test example, dev setup).
- Documentation viewer (`Documentation.html`) sanitizes Markdown using DOMPurify and includes `docs/TROUBLESHOOTING.md`.
- When updating docs, ensure code snippets are copy/paste friendly and do not contain real secrets.

## Code Security Rules
- Provider keys: never commit. Use placeholders in docs (`sk-...`). Store real keys in CI secrets or local `.env` (ignored by git).
- Sidecar forwarding: keys forwarded only to hosts in `OPEN_PERSONA_SIDECAR_ALLOWLIST` (env var on Open WebUI). Default allowlist: `open-persona-sidecar,localhost,127.0.0.1`.
- Secrets scanning: pre-commit hooks and CI scan for obvious patterns. Add GitHub Advanced Security or Snyk for stronger checks.
- If a secret is committed: rotate immediately and, if needed, purge history (BFG/git-filter-repo) with explicit approval.

## Subagents
- Create focused subagents under `./agents/` with concise prompts (<400 tokens) for specialized tasks: YAML, bash, docker, Python, Go, docs, security scans, etc.

## CI & Automation
- Security Scan workflow: runs `npm install` + `npm audit` for each service and a guarded secret grep; fails on high severity or found secrets.
- Dependabot configured to update service dependencies and GitHub Actions weekly (`.github/dependabot.yml`).
- Pre-commit: Husky + lint-staged; contributors must run `npm install` to enable hooks.

## Tasks for Agents
- When asked to produce a change, agents should:
  - Run lint and tests locally for the affected service(s).
  - Add or update lockfiles (`package-lock.json`) when dependencies change.
  - Add unit/integration tests for security-sensitive code (eg. allowlist logic).
  - Avoid history-rewriting unless explicitly requested.

---
*This AGENTS.md is the authoritative guide for programmatic agents operating in this repo. Update it as the repository and processes evolve.*