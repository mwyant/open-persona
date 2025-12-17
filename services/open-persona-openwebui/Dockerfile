FROM ghcr.io/open-webui/open-webui:main

COPY patch_openai_router.py /tmp/patch_openai_router.py

RUN python /tmp/patch_openai_router.py \
  && rm -f /tmp/patch_openai_router.py
