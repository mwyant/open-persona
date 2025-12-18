"""
name: Open Persona Provider Defaults
requirements:
"""

from pydantic import BaseModel, Field


def _desc(name: str) -> str:
    return (
        f"Default provider API key for {name}. Stored in Open WebUI DB. "
        "Forwarded only to the internal open-persona-sidecar service."
    )


class ProviderDefaultValves(BaseModel):
    openai_api_key: str | None = Field(default=None, description=_desc("OpenAI"))
    anthropic_api_key: str | None = Field(default=None, description=_desc("Anthropic"))
    openrouter_api_key: str | None = Field(default=None, description=_desc("OpenRouter"))


class Tools:
    """Admin-only defaults tool.

    This tool is access-controlled to the `open_persona_admins` group by the seeder.
    It exposes only admin (tool) valves.
    """

    Valves = ProviderDefaultValves
