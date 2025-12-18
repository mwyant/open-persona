# Open Persona (open-persona)

Open Persona merges:
- **Open WebUI**: a clean, configurable web UI for chat/workspaces/knowledge.
- **opencode**: a multi-agent, tool-using coding/automation engine.

Today this repo is a **working proof of concept**:
- Open WebUI speaks to a local provider endpoint (`open-persona-sidecar`) using the standard “OpenAI provider” workflow.
- The sidecar routes each Open WebUI user to an isolated opencode workspace (and runner container).
- Personas are Open WebUI Models; persona metadata is forwarded to opencode.

Start here:
- `docs/README.md`
- `docs/MENTAL_MODEL.md`
- `docs/COOKBOOK.md`

Milestones are tagged (`v0.x.y`).
