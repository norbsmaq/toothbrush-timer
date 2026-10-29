#!/usr/bin/env bash
# Show visitor stats from Caddy's access logs in the terminal with GoAccess.
#   sudo ./stats.sh                     interactive dashboard (q to quit)
#   sudo ./stats.sh --ignore-crawlers   any extra options are passed to goaccess
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v goaccess >/dev/null 2>&1; then
  echo "GoAccess isn't installed. Run: sudo apt-get install goaccess" >&2
  exit 1
fi

# The current log plus rotated (and gzipped) older ones.
shopt -s nullglob
logs=(logs/access*.log*)
if [ ${#logs[@]} -eq 0 ]; then
  echo "No access logs yet in $PWD/logs. They appear after the first visit." >&2
  exit 1
fi

# Caddy's JSON log format, spelled out because GoAccess's built-in CADDY format
# doesn't match current Caddy logs in older GoAccess (e.g. 1.5 on Ubuntu 22.04).
format='{ "ts": "%x.%^", "request": { "remote_ip": "%h", "proto": "%H", "method": "%m", "host": "%v", "uri": "%U", "headers": { "User-Agent": ["%u"], "Referer": ["%R"] }, "tls": { "cipher_suite": "%k", "proto": "%K" } }, "duration": "%T", "size": "%b", "status": "%s", "resp_headers": { "Content-Type": ["%M"] } }'

zcat -f "${logs[@]}" | goaccess - --log-format="$format" --date-format=%s --time-format=%s "$@"
