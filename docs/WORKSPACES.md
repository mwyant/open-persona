Workspaces (private)

Overview

- Per-user workspaces are private directories stored under the repository root at `./workspaces/<workspaceHash>`.
- These directories contain user files, project code, and potentially sensitive data. They should never be committed to the repository history.

Policy enforced by the repository

- The repo `.gitignore` contains `/workspaces/*` so by default workspace folders are ignored.
- There is a TEMPLATE folder `workspaces/TEMPLATE/` which is the only workspace folder allowed to be tracked and committed. It contains example files and instructions only (no private data).
- Pre-commit hooks will block commits that attempt to add or modify tracked files under `workspaces/` except for `workspaces/TEMPLATE/`.

Model precedence and subagent model selection

- Per-workspace `opencode.jsonc` (top-level fields) can provide model preferences:
  - `model` — main agent model (used by Open WebUI / main agents)
  - `small_model` — small model used by subagents (short tasks)
- Precedence order the sidecar follows when choosing models:
  1. `opencode.jsonc` in the workspace (if present and declares `model`/`small_model`)
  2. Template workspace (hash in `TEMPLATE_WORKSPACE_HASH`) `opencode.jsonc` values
  3. `.env` overrides: `DEFAULT_MAIN_MODEL` and `DEFAULT_SUBAGENT_MODEL`
  4. Hard-coded defaults (safe fallback)

- The sidecar will merge missing `model` and `small_model` fields into an existing `opencode.jsonc` (without overwriting other user content) so that missing keys can be filled automatically while preserving the owner's config.

- If you want all workspaces to inherit a specific model, set `DEFAULT_MAIN_MODEL` and `DEFAULT_SUBAGENT_MODEL` in your `.env`/`.env.launcher`.

Verification

- To verify selection for a workspace `X`:
  - POST to sidecar: `curl -X POST http://localhost:8000/v1/chat/completions -H 'content-type: application/json' -H 'x-openwebui-user-id: <user-id>' -d '{"model":"open-persona/build","messages":[{"role":"user","content":"Model check"}],"user":"<user-id>"}'`
  - Inspect sidecar logs: `docker compose logs open-persona-sidecar | rg model_selection -n` — the log shows `workspace`, `requestedModel`, `effectiveMainModel`, and `effectiveSubagentModel`.

How to create a new workspace (developer)

1. Create a new workspace using the template (local only):

```bash
cp -a workspaces/TEMPLATE workspaces/$(echo -n 'your-identifier' | sha256sum | awk '{print substr($1,1,16)}')
```

2. Edit files locally. Do not `git add` anything inside `workspaces/`.

If you need to copy files into a workspace from elsewhere (migration):

```bash
# Copy into existing workspace folder locally (keeps files private)
cp -a /path/to/local/files/* workspaces/<workspaceHash>/
chown -R $(id -u):$(id -g) workspaces/<workspaceHash>
```

Security notes

- Never commit API keys, credentials, certs or private data in `workspaces/`.
- If sensitive data is accidentally committed, rotate keys immediately and follow an approved repo-history purge plan (BFG/git-filter-repo). This is destructive and requires coordination.

Questions

- If you need a workspace to be shared in the repo (rare), move only non-sensitive example files into `workspaces/TEMPLATE/` or another `examples/` folder and commit those. Do not commit private projects or data.
