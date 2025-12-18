FROM ghcr.io/open-webui/open-webui:main

COPY patch_openai_router.py /tmp/patch_openai_router.py
COPY patch_tools_router.py /tmp/patch_tools_router.py
COPY start.sh /app/backend/start.sh
COPY open_persona_seed.py /app/backend/open_persona_seed.py
COPY open_persona_provider_keys_tool.py /app/backend/open_persona_provider_keys_tool.py
COPY open_persona_provider_defaults_tool.py /app/backend/open_persona_provider_defaults_tool.py

RUN chmod +x /app/backend/start.sh \
  && python /tmp/patch_openai_router.py \
  && python /tmp/patch_tools_router.py \
  && rm -f /tmp/patch_openai_router.py /tmp/patch_tools_router.py
