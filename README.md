# Toothbrush Timer

A small, dependency-free web app that guides you through brushing your teeth zone by zone.

- **Brushing time**: 0:30 to 6:00 in 15-second steps (default 2:00)
- **Zones**: 2, 4, 6 or 8, split evenly between top and bottom (default 4: 2 top, 2 bottom)
- **Teeth diagram** that redraws for the chosen number of zones, numbers the brushing order, highlights the current zone and marks finished zones in green
- **Zone-change cues**:
  - Visual: a full-screen "Switch to …" flash
  - Audio: a two-tone chime, with soft ticks in the last 3 seconds of each zone
  - Optional spoken instructions and phone vibration
- 3-second lead-in, pause/resume (Space key works too), and it keeps the screen awake while brushing
- Settings are saved in the browser. Light and dark themes follow the system setting.

Brushing order: upper right → upper left, then lower left → lower right.

## Deploy to a DigitalOcean droplet

1. Create an Ubuntu droplet. The cheapest size is plenty. The "Docker on Ubuntu" Marketplace image skips the Docker install.
2. Copy this folder to the droplet:
   ```bash
   scp -r toothbrush-timer root@YOUR_DROPLET_IP:/opt/
   ```
3. On the droplet:
   ```bash
   cd /opt/toothbrush-timer
   sudo ./setup-droplet.sh
   ```
   This installs Docker if needed, opens ports 80 and 443 if `ufw` is active, and starts the app. Open `http://YOUR_DROPLET_IP/`.

The container restarts automatically after reboots (`restart: unless-stopped`).

### HTTPS with your own domain (recommended)

Point a DNS **A record** (e.g. `brush.example.com`) at the droplet's IP, then:

```bash
echo "SITE_ADDRESS=brush.example.com" > .env
docker compose up -d
```

Caddy gets and renews a Let's Encrypt certificate automatically. HTTPS is needed for the browser's keep-screen-awake feature. Everything else works over plain HTTP.

### Updating

After changing files, run `docker compose up -d --build`.

## Running locally

Docker isn't required. Any static file server works:

```bash
cd public && python3 -m http.server 8000
# open http://localhost:8000
```

## Notes

- Browsers only allow sound after you interact with the page, so the audio starts when you press **Start**.
- On iPhone, the ring/silent switch mutes web audio. Use the Voice option or the visual flash if your phone is on silent.
- Vibration works on Android browsers. iOS Safari doesn't support it, so the option is hidden there.

## Files

```
public/        the app (index.html, style.css, app.js, favicon.svg)
Caddyfile      web server config
Dockerfile     Caddy image with the app baked in
docker-compose.yml
setup-droplet.sh
```
