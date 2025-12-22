Workspaces (private)

Overview

- Per-user workspaces are private directories stored under the repository root at `./workspaces/<workspaceHash>`.
- These directories contain user files, project code, and potentially sensitive data. They should never be committed to the repository history.

Policy enforced by the repository

- The repo `.gitignore` contains `/workspaces/*` so by default workspace folders are ignored.
- There is a TEMPLATE folder `workspaces/TEMPLATE/` which is the only workspace folder allowed to be tracked and committed. It contains example files and instructions only (no private data).
- Pre-commit hooks will block commits that attempt to add or modify tracked files under `workspaces/` except for `workspaces/TEMPLATE/`.

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
