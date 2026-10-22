#!/usr/bin/env bash
# Update the app from GitHub and rebuild on the latest Caddy image.
# Run manually, or automatically via the systemd timer setup-droplet.sh installs.
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only
docker compose build --pull
docker compose up -d
docker image prune -f
