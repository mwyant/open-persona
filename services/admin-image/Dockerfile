FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
  openssh-server python3 python3-pip nodejs npm git curl jq ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash admin && mkdir -p /home/admin/.ssh && chown -R admin:admin /home/admin
RUN mkdir -p /run/sshd
# Entrypoint: if /tmp/authorized_key exists, copy into admin authorized_keys
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 22
CMD ["/usr/local/bin/entrypoint.sh"]
