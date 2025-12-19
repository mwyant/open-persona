# Contributing

Thanks for helping improve Open Persona. Quick setup and guidelines for contributors.

Developer setup

1. Clone the repo and install dev tools:

```bash
git clone git@github.com:mwyant/open-persona.git
cd open-persona
npm install
```

The `prepare` script will run `husky install` and enable the pre-commit hooks.

Pre-commit hooks

- The repo includes Husky + lint-staged to run linters and a simple secret scan before commits. If a hook fails, fix the issues, stage changes, and commit again.

Testing & linting

- Sidecar tests (Vitest):

```bash
cd services/open-persona-sidecar
npm install
npm run lint
npm run test
```

- To run a single test:

```bash
npm run test -- -t "test name"
# or run a single file
npx vitest run src/index.test.ts
```

Security

- Never commit real provider keys or secrets. Use GitHub Actions secrets for CI and `.env` (ignored) for local dev.
- If you accidentally commit a secret, rotate it immediately and notify maintainers.

Submitting changes

- Fork → branch (`feature/<name>` or `fix/<name>`) → PR.
- Ensure linting, tests, and the security scan pass locally.
- Mark in PR description if the change affects runner behavior, provider keys, or infrastructure.
