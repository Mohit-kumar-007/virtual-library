# 📚 Virtual Library — Study Together

A no-login, silent, camera-based virtual study room. Open → Join (name, title, description) → study silently with others → Leave.
Built from `Virtual_Library_Study_Together_PRD_v1.1.docx` and the architecture diagram.

**Stack:** React + Vite + TypeScript + Tailwind · Node/Express + Socket.IO · Redis (ephemeral presence) · LiveKit Cloud (WebRTC SFU) · Nginx on EC2.

```
React client ──HTTPS/WSS──▶ Nginx ──▶ Node API (Express + Socket.IO) ──▶ Redis
      └────── live video (WebRTC, direct) ──────▶ LiveKit Cloud ◀── token request ──┘
```

## Run locally

```bash
npm install
cp .env.example server/.env        # edit values (see below)
npm run dev                         # server :4000 + client :5173
```
Open http://localhost:5173 (localhost counts as a secure context, so the camera works).

* **No Redis?** Leave `REDIS_URL` empty → in-memory store (fine for dev, single instance).
* **No LiveKit keys?** With `ALLOW_MOCK_MEDIA=true` (default) the app runs in *demo mode*: presence, timers, leaderboard, leave, reconnect all work and you see your own camera, but other people's video isn't streamed. Add LiveKit keys for real video.

## Environment variables (server)

| Var | Required | Notes |
|---|---|---|
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | for real video | From LiveKit Cloud project settings |
| `REDIS_URL` | production | e.g. `redis://redis:6379` |
| `CLIENT_ORIGIN` | production | Your frontend origin(s), comma separated (CORS) |
| `ALLOW_MOCK_MEDIA` | – | Set `false` in production |
| `ADMIN_TOKEN` | optional | Enables `DELETE /api/admin/sessions/:id` with `Authorization: Bearer <token>` to remove a participant |
| `ROOM_CAPACITY` (100), `GRACE_SECONDS` (45), `JOIN_RATE_LIMIT_PER_MIN` (10) | – | Tunables |

Client: `VITE_API_URL` only if the frontend is hosted on a different origin than the API (e.g. Vercel). Leave empty when Nginx serves both.

## Tests

```bash
npm test                              # server integration tests + client unit tests
# End-to-end acceptance (PRD AT-01…AT-10) — needs server+client running, Playwright installed
npm run dev &                         # in mock-media mode
npm run e2e -w client
```
The E2E suite uses Chromium's fake camera. It covers join/leave, timers, presence across two browsers, leaderboard, reconnect grace, expiry, camera denied, mobile layout and dark mode.
Real SFU video can only be verified with real LiveKit credentials (see checklist below).

## Deploy (EC2 + Nginx + LiveKit Cloud)

1. **LiveKit Cloud:** create a project at https://cloud.livekit.io, copy URL / API key / secret.
2. **EC2:** Ubuntu, open ports 80/443. Install Docker, Nginx, certbot, Node 22.
3. `git clone` the repo, `cp .env.example .env`, fill in values (`ALLOW_MOCK_MEDIA=false`, `CLIENT_ORIGIN=https://your-domain.com`).
4. `docker compose up -d --build` (API on 127.0.0.1:4000 + Redis).
5. Build the frontend: `npm ci && npm run build -w client`, then `sudo mkdir -p /var/www/virtual-library && sudo cp -r client/dist/* /var/www/virtual-library/`.
6. Point your domain's DNS A record to the EC2 IP, get a cert (`sudo certbot certonly --nginx -d your-domain.com`), install `deploy/nginx.conf` (replace `your-domain.com`), `sudo nginx -t && sudo systemctl reload nginx`.
7. Open https://your-domain.com in two browsers and join from both.

Frontend on Vercel/Cloudflare instead: deploy `client/` with build `npm run build`, output `dist`, env `VITE_API_URL=https://api.your-domain.com`, and set `CLIENT_ORIGIN` on the server to the frontend URL.

## Design notes

* **Server-authoritative timers:** `joinedAt` is set by the server; clients compute `now + serverOffset − joinedAt` every second.
* **Presence:** a participant is public only after their camera is published and the socket joined. Heartbeat every 5 s; socket drop → `reconnecting` + grace timer (45 s); overdue heartbeats are swept; expiry removes the session and broadcasts `participant:left`.
* **Privacy:** camera requested only after JOIN submit; mic is never requested and LiveKit tokens can't publish audio; nothing recorded; tokens are short-lived (10 min) and camera-publish-only.
* **Scale:** SFU (not mesh), simulcast + dynacast + adaptive stream, remote videos subscribed only for rendered tiles, tile cap of 30 (others listed as “+N more”), room capacity limit.
* **Not included in MVP:** MongoDB (optional in the diagram), Sentry, multiple rooms — see PRD roadmap.
