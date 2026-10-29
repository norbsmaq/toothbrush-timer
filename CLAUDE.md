# Notes for Claude

Toothbrush timer PWA. Static files in `public/`, served by Caddy in Docker. See README.md for features and deployment.

## Rules

- **Never write the site's real domain names into the repo** (code, docs, commits, examples). Use `example.com`. The repo is public. If you need the live URL, ask the owner.
- **Commit as** `norbsmaq <28984233+norbsmaq@users.noreply.github.com>`, never a personal email.
- **Pushing to `main` deploys to production.** The droplet runs `update.sh` daily (resets to `origin/main` + rebuild). Test before pushing; don't push half-finished work to `main`.
- **No build step, no dependencies.** Plain HTML/CSS/JS, no frameworks, CDNs or npm packages.
- **Content-Security-Policy** (in `Caddyfile`) allows only same-origin files: no inline `<script>`, no `style="..."` attributes, no external URLs. Setting `element.style.x` from JS is fine.

## Gotchas

- `public/sw.js` has an `ASSETS` list of files to cache for offline use. Update it when adding, renaming or removing files in `public/` (a missing file makes the service worker install fail), and bump `CACHE` (`toothbrush-timer-vN`) when the list changes.
- Site settings live in `.env` on the server (git-ignored): `SITE_ADDRESS`, `ENABLE_HSTS`, `REDIRECT_WWW`. `setup-droplet.sh` prompts for them. Keep defaults in `docker-compose.yml` and `.env.example` in sync.
- `setup-droplet.sh` must stay safe to re-run, because owners re-run it to change settings.
- Access logs go to `logs/` on the server (bind-mounted into Caddy, git-ignored). `stats.sh` reads them with GoAccess. Don't add a public stats page; the owner wants stats over SSH only.
- iOS: the home-screen icon is `public/apple-touch-icon.png` at the site root.

## Testing

- App: serve `public/` (`python3 -m http.server`) and drive it with Playwright/Chromium. Check for console errors, the teeth diagram, and zone switching (use a short duration).
- Server: `docker compose build && docker compose up -d`, then `curl -I` to check headers. Test settings with env vars, e.g. `REDIRECT_WWW=true docker compose up -d --force-recreate` and `curl -H "Host: www.example.com" localhost/`.
- In a fresh cloud container, start the Docker daemon first (`sudo dockerd &`).
