# Personas

## Concepts
- **Persona**: user-facing identity/voice selected as an Open WebUI Model.
- **Agent**: background workers and tools used under the hood.

## Izzy (locked core)
- Izzy’s locked core prompt is injected by the sidecar.
- User-editable add-ons can be provided via the first system message.
- Memory (chat → persistent opencode session) is enabled only for Izzy.

## Persona meta channel
Open WebUI Model `meta.open_persona` is forwarded to the sidecar as base64 JSON.

Example:
```json
{
  "open_persona": {
    "persona": { "template": "izzy" },
    "integrations": { "instrumentl": { "enabled": true } },
    "memory": { "enabled": true, "self_reference_level": 0.35 }
  }
}
```

## Subagents (Izzy ritual)
When Izzy delegates to a specialist, the assistant first prints:
- `*<AGENTNAME> appears, <anachronism>. Hi there.*`

Then Izzy summarizes the specialist’s work; specialists never speak directly to the user.
