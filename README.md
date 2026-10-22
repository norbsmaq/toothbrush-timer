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
- Installs on your phone's home screen as an app and works offline

Brushing order: upper right → upper left, then lower left → lower right.

## Deploy to a DigitalOcean droplet

1. Create an Ubuntu droplet. The cheapest size is plenty. The [Docker](https://marketplace.digitalocean.com/apps/docker) Marketplace image skips the Docker install.
2. SSH into the droplet and clone this repo:
   ```bash
   git clone https://github.com/norbsmaq/toothbrush-timer /opt/toothbrush-timer
   ```
3. Run the setup script:
   ```bash
   cd /opt/toothbrush-timer
   sudo ./setup-droplet.sh
   ```
   This installs Docker if needed, opens ports 80 and 443 if `ufw` is active, turns on automatic updates (see below), and starts the app. Open `http://YOUR_DROPLET_IP/`.

The container restarts automatically after reboots (`restart: unless-stopped`).

### HTTPS with your own domain (recommended)

Point a DNS **A record** (e.g. `brush.example.com`) at the droplet's IP, then:

```bash
sed -i 's/^SITE_ADDRESS=.*/SITE_ADDRESS=brush.example.com/' .env
docker compose up -d
```

Caddy gets and renews a Let's Encrypt certificate automatically. HTTPS is needed for the browser's keep-screen-awake feature and for installing the app on your phone. Everything else works over plain HTTP.

### HSTS

By default the site sends an [HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security) header. It tells browsers to always use HTTPS for your domain for the next year. Browsers ignore it over plain HTTP or an IP address, so it does no harm there.

If you're using a domain but might switch it back to plain HTTP later, turn it off in `.env`:

```bash
ENABLE_HSTS=false
```

Then run `docker compose up -d`. Turning it off doesn't undo HSTS in browsers that have already received it; they keep it until it expires.

### Automatic updates

`setup-droplet.sh` turns on three kinds of automatic updates:

| What | How | When |
| --- | --- | --- |
| Ubuntu security updates | `unattended-upgrades` | Daily. If an update needs a reboot, the droplet reboots at 04:00 and the app starts back up on its own. |
| Docker Engine | `unattended-upgrades`, from Docker's apt repository | Daily, along with the OS updates |
| The app and its Caddy web server | `toothbrush-timer-update.timer` runs `update.sh` | Daily around 03:30 |

`update.sh` pulls the latest code from GitHub, rebuilds on the newest Caddy image, restarts the container and removes old images. Anything pushed to `main` goes live on the next run.

To update right away, run `sudo ./update.sh`. To see when the update last ran and when it runs next:

```bash
systemctl list-timers toothbrush-timer-update.timer
journalctl -u toothbrush-timer-update.service -n 50
```

To turn off the app auto-update: `sudo systemctl disable --now toothbrush-timer-update.timer`

`.env` is git-ignored, so your settings are kept across updates.

## Install on your phone

The app is a Progressive Web App (PWA). Once installed, it opens full-screen from your home screen and works offline.

Installing requires **HTTPS**, so set up a domain first (see above). Over plain `http://IP` it still works in the browser, but it won't install.

- **Android (Chrome):** open the site, then tap **⋮ → Install app** (or **Add to Home screen**).
- **iPhone/iPad (Safari):** open the site, then tap **Share → Add to Home Screen**.

When you deploy a new version, an installed app picks it up the next time it's opened online.

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
public/        the app (index.html, style.css, app.js, icons)
  manifest.webmanifest  PWA manifest
  sw.js                 service worker (offline support)
Caddyfile      web server config
Dockerfile     Caddy image with the app baked in
docker-compose.yml
setup-droplet.sh   one-time droplet setup
update.sh          pull + rebuild (run daily by a systemd timer)
```
