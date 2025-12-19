# AGENTS.md (open-persona)

## 1. Build / Lint / Test

- **Docker Compose Build**
  ```bash
  docker compose up --build
  ```
- **Rebuild Individual Service**
  ```bash
  docker compose build open-persona-sidecar
  docker compose build openwebui
  ```
- **Local Development Commands**
  - *Sidecar*:
    ```bash
    cd services/open-persona-sidecar
    npm install
    npm run build      # compile TypeScript
    npm run lint       # linting (ESLint + Prettier)
    npm run test       # run all tests
    npm run test -- -t "test name"   # run a single test
    ```
  - *Instrumentl MCP*:
    ```bash
    cd services/instrumentl-mcp
    npm install
    npm run build
    npm run lint
    npm run test
    ```
- **CI/Lint Scripts (package.json)**
  ```json
  "scripts": {
    "build": "tsc -p .",
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "format": "prettier --write .",
    "test": "vitest run",
    "test:single": "vitest -t"
  }
  ```

## 2. Code Style / Conventions

- **Imports**
  - Use relative paths (`../..`) only when necessary; prefer absolute imports via `tsconfig.json` `paths`.
  - Group imports:
    ```ts
    import { Foo } from "./Foo";
    import { Bar } from "../Bar";
    import { Baz } from "../../Baz";
    ```
- **Formatting**
  - Run `npm run format` before committing.
  - Enforce `eslint` rules: no `any`, prefer `unknown` + narrowing, explicit types at module boundaries.
- **Naming Conventions**
  - Variables & functions: `camelCase`
  - Types / Interfaces: `PascalCase`
  - Constants: `SCREAMING_SNAKE_CASE`
  - Private class members: prefix with `_` (e.g., `_privateMethod`)
- **Error Handling**
  - Throw custom `AppError` with `statusCode` and `message`.
  - Centralized error middleware logs stack trace but returns only sanitized message to client.
- **Logging**
  - Use structured JSON logs (`pino` or `winston`).
  - Never log secrets or full request bodies; mask sensitive fields.
- **Security**
  - No multi‑line secrets in headers (Open WebUI blocks CR/LF).
  - All backend‑only patches must be scoped to `open-persona-sidecar` URLs.
  - Validate inputs with Zod/Yup before processing.
- **Testing**
  - Write unit tests for pure functions; integration tests for service interactions.
  - Use descriptive test titles (`should reject invalid token`).
  - Maintain >= 80% coverage on new code.

## 3. Documentation Review

- **Primary Docs**
  - `README.md` – ensure it contains:
    - Project overview
    - Quick start (`docker compose up --build`)
    - Development workflow (lint, test, rebuild)
    - Contributing guide
  - `docs/MENTAL_MODEL.md`
  - `docs/AGENT_TASKS.md`
  - `docs/COOKBOOK.md`
- **Review Process**
  - Run `npm run docs:link` (if available) to lint markdown links.
  - Verify code snippets compile.
  - Check for outdated diagrams; update `docs/diagrams/` as needed.
  - PR must be approved by at least one maintainer before merging.

## 4. GitHub Analysis / Private Data Safeguards

- **Secret Scanning**
  - Enable GitHub Secret Scanning for the repository.
  - Run `git secret detection` locally before push.
- **Dependency Vetting**
  - Use Dependabot / Renovate for automatic updates.
  - Run `npm audit` and `yarn audit` in CI; fail on high‑severity CVEs.
- **Private Data Check**
  - Ensure no `.env` files or config files containing credentials are committed.
  - Verify `.gitignore` excludes `*.secret`, `*.pem`, `credentials.json`.
  - Use `git grep -i "password\|secret\|key"` to double‑check.
- **License Compliance**
  - Update `LICENSES.md` when adding new dependencies.
  - Verify all new dependencies have an OSI‑approved license.

## 5. Dependency & Vulnerability Management

- **Audit Commands**
  ```bash
  npm audit --production
  yarn audit --check-scripts
  ```
- **CVE Monitoring**
  - Subscribe to security alerts via GitHub Dependabot.
  - Periodically run `snyk test` for deeper analysis.
- **Version Pinning**
  - Keep `package.json` dependencies with caret (`^`) or tilde (`~`) ranges, but lockfile (`yarn.lock`/`package-lock.json`) must be committed.

## 6. Release & Versioning

- **Tagging Strategy**
  - Use Semantic Versioning (`MAJOR.MINOR.PATCH`).
  - Create annotated tags: `git tag -a v1.2.3 -m "Release feature"`.
- **Changelog**
  - Generate via `github-changelog-generator` or `conventional-changelog`.
  - Keep `CHANGELOG.md` up‑to‑date.
- **CI/CD**
  - Build → Test → Lint → Security Scan → Deploy (if applicable).
  - Ensure all pipelines pass before merging to `main`.

## 7. Miscellaneous

- **Code of Conduct**
  - Follow the [Contributor Covenant v2.1](https://www.contributor-covenant.org).
- **Contribution Guide**
  - Fork → Branch (`feature/<name>`) → PR → CI checks → Review → Merge.
- **Backup & Recovery**
  - Regularly backup `data/` volumes; test restore procedures quarterly.
- **Monitoring**
  - Export metrics to Prometheus; set alerts for error rate > 1%.
- **Backup Documentation**
  - Store operational runbooks in `ops/runbooks/` and keep them version‑controlled.

---  
*This AGENTS.md serves as the central reference for all agents operating within the open‑persona repository. Update it whenever processes evolve or new tooling is introduced.* 