#!/usr/bin/env bash
# Update the app from GitHub and rebuild on the latest Caddy image.
# Run manually, or automatically via the systemd timer setup-droplet.sh installs.
set -euo pipefail
cd "$(dirname "$0")"

# Match GitHub's main branch exactly, even if its history was rewritten.
# Local edits to tracked files are discarded; .env is untracked, so settings are kept.
git fetch origin main
git reset --hard origin/main
docker compose build --pull
docker compose up -d
docker image prune -f
