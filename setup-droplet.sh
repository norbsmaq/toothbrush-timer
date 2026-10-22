#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu/Debian droplet. Run from this folder as root:
#   sudo ./setup-droplet.sh
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
fi

[ -f .env ] || cp .env.example .env

docker compose up -d --build
echo
echo "Toothbrush Timer is running. Open http://$(curl -fsS4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
