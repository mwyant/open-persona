#!/bin/bash
set -e
if [ -f /tmp/authorized_key ]; then
  mkdir -p /home/admin/.ssh
  cat /tmp/authorized_key >> /home/admin/.ssh/authorized_keys
  chown -R admin:admin /home/admin/.ssh
  chmod 700 /home/admin/.ssh
  chmod 600 /home/admin/.ssh/authorized_keys
fi
# Ensure sshd config allows key auth
if ! grep -q "PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null; then
  echo "PermitRootLogin no" >> /etc/ssh/sshd_config
fi
if ! grep -q "PasswordAuthentication" /etc/ssh/sshd_config 2>/dev/null; then
  echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
fi
/usr/sbin/sshd -D
