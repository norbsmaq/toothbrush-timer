#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu/Debian droplet. Run from this folder as root:
#   sudo ./setup-droplet.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
fi

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw allow 443/udp
fi

# Automatic OS and Docker Engine updates (security fixes daily, reboot at 04:00 if a kernel update needs it).
echo "Enabling automatic OS and Docker updates..."
apt-get update -q
apt-get install -y -q unattended-upgrades
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52toothbrush-timer-upgrades <<'CONF'
// Also upgrade Docker Engine from Docker's apt repository.
Unattended-Upgrade::Origins-Pattern {
  "origin=Docker";
};
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
CONF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true
systemctl enable docker >/dev/null 2>&1 || true

# Daily app + web server update: pulls this repo and rebuilds on the latest Caddy image.
echo "Installing daily app update timer..."
cat > /etc/systemd/system/toothbrush-timer-update.service <<UNIT
[Unit]
Description=Update Toothbrush Timer (git pull + rebuild on latest Caddy)
Wants=network-online.target
After=network-online.target docker.service

[Service]
Type=oneshot
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/update.sh
UNIT
cat > /etc/systemd/system/toothbrush-timer-update.timer <<'UNIT'
[Unit]
Description=Daily Toothbrush Timer update

[Timer]
OnCalendar=*-*-* 03:30
RandomizedDelaySec=30m
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now toothbrush-timer-update.timer

[ -f .env ] || cp .env.example .env

docker compose build --pull
docker compose up -d
echo
echo "Toothbrush Timer is running. Open http://$(curl -fsS4 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')/"
