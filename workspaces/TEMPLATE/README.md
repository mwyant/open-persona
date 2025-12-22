This folder is a template describing the expected structure of a workspace.

DO NOT put real workspace data here. The purpose of this directory is to document the layout and provide example files that developers can copy into a real workspace.

Structure

- opencode.jsonc — project config for Opencode (example)
- openwebui.config — per-workspace Open WebUI metadata (example)

Example usage

- To create a new workspace:
  1. Copy this TEMPLATE directory to a new folder with the workspace hash:
     `cp -a workspaces/TEMPLATE workspaces/<workspaceHash>`
  2. Edit `opencode.jsonc` and `openwebui.config` as needed.

Security note

- Do NOT commit actual workspace contents to the repo. The repository .gitignore excludes `workspaces/*` to prevent accidental commits of private data.
