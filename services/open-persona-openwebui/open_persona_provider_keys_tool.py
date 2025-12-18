"""
name: Open Persona Provider Keys
requirements:
"""

from pydantic import BaseModel, Field


def _desc(name: str) -> str:
    return (
        f"Provider API key for {name}. Stored in Open WebUI DB. "
        "Forwarded only to the internal open-persona-sidecar service."
    )


class ProviderKeyValves(BaseModel):
    # Admin defaults (global)
    openai_api_key: str | None = Field(default=None, description=_desc("OpenAI"))
    anthropic_api_key: str | None = Field(default=None, description=_desc("Anthropic"))
    openrouter_api_key: str | None = Field(default=None, description=_desc("OpenRouter"))


class ProviderKeyUserValves(BaseModel):
    # Per-user overrides
    openai_api_key: str | None = Field(default=None, description=_desc("OpenAI"))
    anthropic_api_key: str | None = Field(default=None, description=_desc("Anthropic"))
    openrouter_api_key: str | None = Field(default=None, description=_desc("OpenRouter"))


class Tools:
    """Settings-only tool.

    Open WebUI stores:
    - admin defaults in Tool Valves
    - per-user overrides in User Valves

    Open Persona reads these values server-side and forwards them only to the
    internal sidecar.

    This tool intentionally exposes no callable functions to the LLM.
    """

    Valves = ProviderKeyValves
    UserValves = ProviderKeyUserValves
