#!/usr/bin/env bash
# One-shot setup for a fresh Ubuntu/Debian droplet. Run from this folder as root:
#   sudo ./setup-droplet.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

# ---------- Site settings (.env) ----------

ENV_FILE="$APP_DIR/.env"
[ -f "$ENV_FILE" ] || cp .env.example "$ENV_FILE"

get_env() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed 's/^"\(.*\)"$/\1/'
}

set_env() {
  local tmp
  if grep -q "^$1=" "$ENV_FILE"; then
    tmp=$(mktemp)
    awk -v k="$1" -v v="$2" '$0 ~ "^" k "=" { if (!done) print k "=" v; done = 1; next } { print }' "$ENV_FILE" > "$tmp"
    cat "$tmp" > "$ENV_FILE" && rm -f "$tmp"
  else
    echo "$1=$2" >> "$ENV_FILE"
  fi
}

public_ip() {
  curl -fsS --max-time 2 http://169.254.169.254/metadata/v1/interfaces/public/0/ipv4/address 2>/dev/null ||
    curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null ||
    hostname -I | awk '{print $1}'
}

# Turns "Example.com, https://www.example.com/" into "example.com, www.example.com".
normalize_domains() {
  local d parts out=()
  IFS=', ' read -ra parts <<< "$1"
  for d in "${parts[@]}"; do
    [ -n "$d" ] || continue
    d=$(tr '[:upper:]' '[:lower:]' <<< "$d")
    d=${d#http://}; d=${d#https://}; d=${d%%/*}
    if ! [[ $d =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$ ]]; then
      echo "  '$d' isn't a valid domain name." >&2
      return 1
    fi
    [[ " ${out[*]} " == *" $d "* ]] || out+=("$d")
  done
  local IFS=,
  sed 's/,/, /g' <<< "${out[*]}"
}

check_dns() {
  local ip d resolved
  ip=$(public_ip)
  IFS=', ' read -ra domains <<< "$1"
  for d in "${domains[@]}"; do
    [ -n "$d" ] || continue
    resolved=$(getent ahostsv4 "$d" | awk '{print $1}' | sort -u | paste -sd' ' -)
    if [ -z "$resolved" ]; then
      echo "  Warning: $d doesn't resolve yet. Add a DNS A record pointing to $ip."
    elif ! grep -qw -- "$ip" <<< "$resolved"; then
      echo "  Warning: $d points to $resolved, not this droplet ($ip)."
    else
      echo "  $d -> $ip OK"
    fi
  done
  echo "  (If DNS isn't ready yet, Caddy keeps retrying and HTTPS starts working once it is.)"
}

site=$(get_env SITE_ADDRESS)
hsts=$(get_env ENABLE_HSTS)

if [ -t 0 ]; then
  echo "Which domain names should serve the app? Separate several with spaces or commas,"
  echo "for example: example.com www.example.com"
  echo "Enter 'none' to serve it over plain HTTP at the droplet's IP address."
  default=$([ -z "$site" ] || [ "$site" = ":80" ] && echo none || echo "$site")
  while true; do
    read -rp "Domains [$default]: " answer
    answer=${answer:-$default}
    if [ "$answer" = none ]; then
      site=":80"
      break
    fi
    if site=$(normalize_domains "$answer") && [ -n "$site" ]; then
      break
    fi
  done

  if [ "$site" = ":80" ]; then
    hsts=false
  else
    check_dns "$site"
    echo
    echo "HSTS makes browsers always use HTTPS for these domains for the next year."
    echo "Recommended unless you might switch back to plain HTTP."
    default=$([ "$hsts" = false ] && echo n || echo y)
    while true; do
      read -rp "Enable HSTS? (y/n) [$default]: " answer
      case "${answer:-$default}" in
        [Yy]*) hsts=true; break ;;
        [Nn]*) hsts=false; break ;;
      esac
    done
  fi

  if [ "$site" = ":80" ]; then
    set_env SITE_ADDRESS ":80"
  else
    set_env SITE_ADDRESS "\"$site\""
  fi
  set_env ENABLE_HSTS "$hsts"
  echo "Saved to .env."
  echo
else
  echo "No terminal, so not asking for settings; using what's in .env."
fi

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

docker compose build --pull
docker compose up -d
echo
echo "Toothbrush Timer is running. Open:"
if [ -z "$site" ] || [ "$site" = ":80" ]; then
  echo "  http://$(public_ip)/"
else
  IFS=', ' read -ra domains <<< "$site"
  for d in "${domains[@]}"; do [ -n "$d" ] && echo "  https://$d/"; done
fi
