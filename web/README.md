# Simble Web UI

Single-page web app for Simble. Vanilla ES module + Vue 3 from CDN. No build step.

## Features
- Sign in / sign up
- Dashboard with usage stats
- Contact list + CSV import
- Campaign composer (select contacts, write message, send)
- Settings (profile, plan, device)

## Run
Served by `nginx:alpine` in `docker-compose.yml` on port 8080. Caddy fronts it on the public hostname.

## Files
- `index.html` — markup + Vue templates
- `app.js` — Vue 3 setup with state, routing, API calls
- `style.css` — minimal CSS
- `nginx.conf` — nginx config
- `Dockerfile` — builds the image

## API
The app talks to `/api/*` on the same origin. Caddy routes those to the `campaign-manager` service.
