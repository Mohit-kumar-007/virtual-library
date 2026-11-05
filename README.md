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

## Run with Docker (whole stack, one command)

```bash
cp .env.example .env     # fill in LIVEKIT_* values; set NODE_ENV/REDIS are overridden by compose
docker compose up -d --build
```
Open http://localhost:8080 (change with `WEB_PORT` in `.env`). Services: `web` (Nginx + built React app), `api` (Node), `redis`.
Useful: `docker compose logs -f api`, `docker compose ps`, `docker compose down`.

## Deploy (EC2 + Docker + LiveKit Cloud)

1. **LiveKit Cloud:** create a project, copy URL / API key / secret.
2. **EC2:** Ubuntu 22.04+, security group open for ports 22, 80, 443. Install Docker (`curl -fsSL https://get.docker.com | sh`).
3. Point your domain's DNS **A record** to the EC2 public IP.
4. `git clone` the repo, `cp .env.example .env` and set:
   `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CLIENT_ORIGIN=https://your-domain.com`, `ALLOW_MOCK_MEDIA=false`, `ADMIN_TOKEN=<long random>`, `DOMAIN=your-domain.com`.
5. `docker compose --profile https up -d --build` — Caddy obtains the HTTPS certificate automatically.
6. Open https://your-domain.com from two devices and join.

(Alternative without Docker for the web tier: `deploy/nginx.conf` is a host-level Nginx + certbot example, matching the architecture diagram.)

Frontend on Vercel/Cloudflare instead: deploy `client/` with build `npm run build`, output `dist`, env `VITE_API_URL=https://api.your-domain.com`, and set `CLIENT_ORIGIN` on the server to the frontend URL.

## Design notes

* **Server-authoritative timers:** `joinedAt` is set by the server; clients compute `now + serverOffset − joinedAt` every second.
* **Presence:** a participant is public only after their camera is published and the socket joined. Heartbeat every 5 s; socket drop → `reconnecting` + grace timer (45 s); overdue heartbeats are swept; expiry removes the session and broadcasts `participant:left`.
* **Privacy:** camera requested only after JOIN submit; mic is never requested and LiveKit tokens can't publish audio; nothing recorded; tokens are short-lived (10 min) and camera-publish-only.
* **Scale:** SFU (not mesh), simulcast + dynacast + adaptive stream, remote videos subscribed only for rendered tiles, tile cap of 30 (others listed as “+N more”), room capacity limit.
* **Not included in MVP:** MongoDB (optional in the diagram), Sentry, multiple rooms — see PRD roadmap.
