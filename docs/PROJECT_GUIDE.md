# Virtual Library — Complete Project Guide

Everything you need to **explain**, **defend** and **promote** this project:

1. [What the project is (30-second pitch)](#1-what-the-project-is)
2. [How it was built, step by step](#2-how-it-was-built-step-by-step)
3. [How to explain it to someone (teacher walkthrough)](#3-how-to-explain-it-to-your-teacher)
4. [Errors and difficulties faced (real ones)](#4-errors-and-difficulties-faced)
5. [Teacher Q&A — likely questions with answers](#5-teacher-qa)
6. [YouTube video plan](#6-youtube-video-plan)
7. [YouTube Shorts ideas](#7-youtube-shorts-ideas)
8. [Demo checklist and cheat sheet](#8-demo-checklist-and-cheat-sheet)

> **Honesty tip:** this project was built with an AI coding assistant (Claude Code) from your PRD and diagram. Say so. Teachers respect "I designed the product, wrote the PRD and architecture, directed an AI to implement it, then tested and understood every part" far more than being caught. Everything below is written so you can genuinely understand and explain it.

---

## 1. What the project is

**One sentence:** Virtual Library is a website where anyone can join a silent, live "study room" with just a name, a title and what they're studying — no login — turn on their camera, and study alongside other people, each with a live timer.

**Why it exists:** studying near other people keeps you focused. Normal video calls add talking, chat and meeting overhead. This recreates the *feeling of a library*.

**Core flow:** Open site → click JOIN → fill name/title/description → allow camera → you appear in the grid with a timer → study silently → click LEAVE → you disappear.

**Key features**
- No login (temporary session identity only)
- Live camera tiles + continuous session timer (server-authoritative)
- Live "students studying now" counter
- Optional leaderboard (only people currently studying, by current session length)
- Reconnect grace period (survives short network loss)
- Privacy notice, no audio, no chat, nothing recorded
- Dark mode, responsive (desktop/tablet/mobile)
- Report button + admin removal hook (basic moderation)

---

## 2. How it was built, step by step

### Step 0 — Product thinking (what *you* did)
You wrote the PRD (`Virtual_Library_Study_Together_PRD_v1.1.docx`): vision, goals, **non-goals** (no chat/voice/profiles), user flow, data model, requirements matrix (FR-01…FR-12), acceptance tests (AT-01…AT-10). You also drew the architecture + sequence diagram (the PNG).

### Step 1 — Choose the architecture (from your diagram)
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript + Tailwind | Fast dev, typed, responsive styling |
| Realtime events | Socket.IO | Presence, join/leave broadcasts, heartbeats, auto-reconnect |
| Backend | Node.js + Express + TypeScript | Simple REST + WebSocket in one runtime |
| Ephemeral state | Redis | Fast, auto-disposable presence data — we don't need permanent storage |
| Video | **LiveKit Cloud (SFU)** + WebRTC | Mesh P2P doesn't scale; an SFU receives one stream per user and forwards it |
| Edge | Nginx on AWS EC2 | HTTPS/WSS termination, reverse proxy, serves the frontend |

**Key idea:** the API *never touches video*. It only creates sessions and hands out short-lived LiveKit tokens; the browser sends video straight to LiveKit.

### Step 2 — Project skeleton
- npm **workspaces** monorepo: `server/` and `client/` under one root `package.json`.
- `npm run dev` starts both (via `concurrently`); Vite proxies `/api` and `/socket.io` to the server so there are no CORS problems in dev.

### Step 3 — Backend (`server/src`)
1. `config.ts` — reads env vars (ports, LiveKit keys, grace seconds…).
2. `redis/store.ts` — a `SessionStore` interface with two implementations: **Redis** (production) and **in-memory** (dev/tests). Session = Redis hash (`sessionId, roomId, displayName, title, description, joinedAt, lastHeartbeat, connectionState, mediaState`) — exactly the PRD data model.
3. `services/validation.ts` — Zod schema: name ≤40, title ≤60, description ≤160; strips control/invisible characters.
4. `services/sessionService.ts` — the brain: create session, heartbeat, attach/detach (grace timer), end, stale sweeper, emits `joined/left/updated` events.
5. `media/livekit.ts` — makes a short-lived JWT: publish **camera only**, subscribe allowed, no data, no mic. Also can kick a user from LiveKit on leave/ban.
6. `api/routes.ts` — `POST /api/sessions`, `POST /api/sessions/:id/media-token`, `POST /api/sessions/:id/leave`, `POST /api/sessions/:id/report`, `GET /api/rooms/:id`, `GET /api/rooms/:id/participants`, `DELETE /api/admin/sessions/:id`, `GET /api/health`.
7. `realtime/socket.ts` — Socket.IO events: `spectate`, `join`, `heartbeat`, `media:state`, `leave`; broadcasts `participant:joined/left/updated`, `room:count`.
8. `middleware/security.ts` — rate limits (join: 10/min/IP), plus Helmet and CORS in `app.ts`.

### Step 4 — The join sequence (matches your sequence diagram)
1. Browser asks for the camera (after the user submits the form).
2. `POST /api/sessions` → server writes the Redis hash, returns `sessionId, roomId, joinedAt`.
3. `POST /api/sessions/:id/media-token` → short-lived LiveKit token + URL.
4. Browser connects to LiveKit and publishes the camera track.
5. Browser opens Socket.IO and emits `join {sessionId}`; then `media:state: publishing`.
6. Server broadcasts `participant:joined` to everyone → tile appears everywhere.
7. Every 5 s: heartbeat updates `lastHeartbeat` and cancels any grace timer.
8. Socket drops → state becomes *reconnecting*, 30–60 s grace timer starts.
9. Grace expires → session hash removed → `participant:left` broadcast.

### Step 5 — Frontend (`client/src`)
- **services/** — `api.ts` (fetch wrapper), `realtime.ts` (Socket.IO), `camera.ts` (getUserMedia, video only), `media.ts` (LiveKit room, lazy-loaded).
- **hooks/** — `useRoom` (the whole state machine: join, leave, socket events, heartbeat, teardown), `useNow` (single 1-second tick shared by all timers), `useSessionTimer`, `useMedia`.
- **components/** — Header, ActiveCount, JoinModal, PrivacyNotice, StudyGrid, StudyTile, OwnStudyTile, Leaderboard, SessionTimer, VideoView, LegalModal.
- **Timer maths:** `elapsed = (Date.now() + serverOffset) − joinedAt`. `serverOffset` is measured from the server's clock on every snapshot, so a wrong laptop clock or a refresh can't corrupt timers.
- **Scaling rules:** max 30 full video tiles; only subscribe to videos currently rendered; others shown as "+N more"; simulcast/adaptive stream so small tiles get low quality; LiveKit code is lazy-loaded so the page loads fast.

### Step 6 — Testing
- **Server integration tests (Vitest + supertest + socket.io-client):** validation, session create, token, public-list hiding, join→broadcast→heartbeat→leave, reconnect within grace, expiry after grace, stale sweep, silent network loss, rate limiting. *(10 tests)*
- **Client unit tests:** time formatting and form validation. *(3 tests)*
- **End-to-end (Playwright, real Chromium with a fake camera, two browsers):** runs your acceptance scenarios AT-01…AT-10 plus camera-denied, mobile and dark mode. *(~25 checks)* Run with `npm run e2e -w client`.
- Run against a **real Redis**, not just the in-memory store.

### Step 7 — Deployment files
`Dockerfile` (API), `docker-compose.yml` (API + Redis), `deploy/nginx.conf` (HTTPS, WebSocket upgrade, static frontend), `.env.example`, README with the EC2 steps.

---

## 3. How to explain it to your teacher

Suggested 8–10 minute walkthrough:

1. **Problem (1 min)** — "Studying alone is distracting; video calls are noisy. I wanted the silent presence of a library."
2. **Live demo (2 min)** — Open two browsers: join in one, show the tile + timer in the other, toggle the leaderboard, leave.
3. **Architecture diagram (2 min)** — Walk the diagram left→right: React → Nginx → Node API → Redis; video goes straight to LiveKit. Emphasise *why an SFU*.
4. **Sequence diagram (2 min)** — Walk the 13 numbered steps (see Step 4 above).
5. **Tricky parts (1–2 min)** — server-authoritative timer, heartbeat + grace period, privacy design.
6. **Testing (1 min)** — show the test output, mention the bug the E2E test caught.
7. **What's next (30 s)** — multiple rooms, Pomodoro, moderation, regional SFUs.

**Memorise these 5 sentences**
- "Presence and video are separate: Socket.IO carries *who is here*, LiveKit carries *the video*."
- "Time is calculated from the server's `joinedAt`, never counted on the client."
- "Redis holds only temporary data because a session should vanish when the person leaves."
- "An SFU forwards one upload to many viewers; peer-to-peer mesh would make each user upload N−1 videos."
- "No login means identity is a temporary random session ID."

---

## 4. Errors and difficulties faced

These are the **real** issues hit while building, with the fix — great material for "what challenges did you face?".

| # | Problem | Cause | Fix / lesson |
|---|---|---|---|
| 1 | Client dependencies (`livekit-client`) "not found" after `npm i` | Installed inside a workspace folder before the workspace was registered, so packages didn't save/hoist | Use `npm i -w client <pkg>` from the repo root |
| 2 | TypeScript error: `string \| string[]` not assignable to `string` (Express route params) | Express 5 types allow array params | Wrap with `String(req.params.id)` |
| 3 | Rate-limit test made later tests fail (`sessionId` undefined) | The limiter test ran first and used up the 10/min quota | Reorder tests so the rate-limit test runs last |
| 4 | **Real bug caught by E2E:** other users never saw "Reconnecting…" when someone lost internet | A silent network drop doesn't close the WebSocket; the server only noticed after ~45 s via ping timeout, and the sweeper deleted the session without ever marking it *reconnecting* | Sweeper now marks sessions *reconnecting* when the heartbeat is overdue, heartbeat marks them *connected* again, and Socket.IO ping reduced to 10 s/5 s. Added a unit test |
| 5 | Participants could appear before their video was ready | Session was created before camera/media was confirmed | A session stays "pending" (hidden, not counted) until media is published, then broadcast `joined` |
| 6 | Orphan sessions if camera permission was denied | Session created before camera was granted | Ask for the camera **first**, create the session after. Verified by an E2E check |
| 7 | JS bundle too big (LiveKit ≈ 530 kB) | LiveKit SDK is large | Lazy-load it with `import()` after the user joins; first page is ~90 kB gzip |
| 8 | Closing the tab left a ghost user for ~45 s | No explicit leave signal | `pagehide` → `navigator.sendBeacon` to `/leave`; heartbeat timeout is the fallback. Server accepts `text/plain` JSON for beacons |
| 9 | Video can't be fully tested locally | Needs a LiveKit server/credentials; the build environment blocked running a downloaded LiveKit binary | Added **mock-media (demo) mode** so presence/timers/leave/reconnect are testable without LiveKit; real video verified only with real keys (your job — see checklist) |
| 10 | Git push failed (403) | Claude GitHub App wasn't installed on the repo | Install the GitHub App / reconnect GitHub, then push |

**Honest limitations to admit:** real multi-user video was not load-tested; one room only; no persistent moderation/banning yet; Terms/Privacy are templates; no analytics/monitoring yet.

---

## 5. Teacher Q&A

### Product / idea
1. **What problem does it solve?** Lack of accountability and focus when studying alone, without the overhead of video calls.
2. **Why no login?** Frictionless joining is the whole point; a temporary session ID avoids collecting personal data and makes it privacy-friendly.
3. **How is it different from Zoom/Google Meet/Discord/Focusmate?** No audio, no chat, no meeting; many strangers silently present; continuous timers; zero setup.
4. **Why no chat/voice/likes?** Non-goals in the PRD: they turn it into a social network and break focus.
5. **How would you know it works (success metric)?** Do users stay focused longer? Track session duration, % reaching 25/50/90 minutes, concurrent users, join success, camera-denial rate.
6. **How would it make money?** Not before validation. Later: private/institution rooms, premium themes, personal analytics.

### Architecture
7. **Why WebRTC?** Browser-native low-latency video, no plugins.
8. **Why not pure peer-to-peer?** With N users each uploads N−1 streams → bandwidth/CPU explosion (N² connections). An SFU needs one upload each.
9. **What is an SFU?** Selective Forwarding Unit: a server that receives each participant's stream and forwards (without decoding) to subscribers.
10. **Why LiveKit?** Managed SFU, simulcast, token auth, good JS SDK; building mediasoup infra myself would be slow and costly for an MVP.
11. **Does your server handle video?** No. API only issues tokens; video goes browser↔LiveKit.
12. **Why Socket.IO as well as LiveKit?** LiveKit moves media; Socket.IO moves app state (who joined, counts, heartbeats) and gives auto-reconnect and fallbacks.
13. **Why Redis?** Presence data is short-lived and read/written constantly; Redis is fast, supports expiry and shared state across multiple server instances.
14. **Why not MongoDB/PostgreSQL?** Nothing needs to persist in the MVP. The diagram lists MongoDB as optional, for future analytics/config.
15. **What does Nginx do?** TLS termination (HTTPS/WSS), reverse proxy to Node, WebSocket upgrade, serves static frontend.
16. **Why TypeScript?** Catches bugs at compile time (it caught the Express param bug); shared shapes between layers.
17. **Why Vite + React + Tailwind?** Fast builds, component model for tiles/timers, utility CSS for responsive design and dark mode.
18. **Why a store interface with in-memory and Redis versions?** Easy local dev and fast tests without Redis; production swaps in Redis with no code change.

### Timers, presence, realtime
19. **How does the timer work?** Server stores `joinedAt`. Client shows `now + serverOffset − joinedAt` each second. Not an increment counter.
20. **Why not just count seconds on the client?** Tabs get throttled, clocks differ, refresh would reset it, and others must see the same value.
21. **What if the user's laptop clock is wrong?** `serverOffset` (server time − local time at sync) corrects it.
22. **How is the active count kept accurate?** It's the number of public sessions in Redis. Sessions are removed on leave, grace expiry, or stale heartbeat.
23. **What is the heartbeat?** Client emits every ~5 s; server updates `lastHeartbeat` and cancels any pending removal.
24. **What is the grace period?** On disconnect, wait 45 s (configurable 30–60) before removing the session, so brief Wi-Fi drops don't kick people out.
25. **What if the browser is closed abruptly?** `pagehide` beacon usually removes them; otherwise heartbeat/grace timeout does.
26. **What happens on page refresh?** Session state isn't persisted in the browser (by design), so a refresh ends that session; the old one is cleaned up and joining again starts a new timer. (Possible future improvement: store sessionId in sessionStorage to resume.)
27. **How does the leaderboard sort?** By server `joinedAt` ascending = longest continuous current session first. Only active users; leaving removes you.
28. **How do others see tiles instantly?** Server broadcasts `participant:joined/left/updated` events to the Socket.IO room.
29. **How do you handle duplicate names?** Allowed; identity is `sessionId`.

### Privacy / security / safety
30. **When is the camera activated?** Only after the user submits the join form and approves the browser prompt.
31. **Is video recorded?** No. There is no recording code or storage.
32. **Is the mic used?** Never requested; token grants don't allow audio; `audio:false`.
33. **How do you secure media access?** Short-lived (10 min) JWT, camera publish only, no data channel; API secret stays on server.
34. **How do you prevent abuse/spam?** Rate limiting, Zod validation/sanitising, room capacity cap, Report button, admin removal endpoint protected by a bearer token.
35. **How do you prevent XSS from names/descriptions?** React escapes text by default; server strips control chars and limits length; Helmet adds security headers.
36. **Why HTTPS?** Browsers only allow camera access on secure origins (localhost excepted); also protects tokens.
37. **What personal data do you store?** Only name/title/description typed by the user, temporarily, deleted on leave. No email/phone/location.
38. **What are the legal risks?** Public cameras need Terms, Privacy Policy, moderation and age considerations; current texts are templates needing review.

### Scalability
39. **How many users can it handle?** MVP room capacity is configurable (default 100). The SFU scales further; the UI caps at 30 rendered videos.
40. **What do you do for 1000+ users?** Multiple rooms, show a curated subset with total count, adaptive subscriptions, regional SFUs, Redis pub/sub adapter for several Node instances.
41. **How do you keep bandwidth low?** Low-res capture (640×360, 15 fps), simulcast, adaptive stream, subscribe only to visible tiles.
42. **Can you run multiple Node servers?** Presence is in Redis, but Socket.IO would need the Redis adapter for cross-instance broadcasts and timers/grace are per-instance. This is a known next step.
43. **What is the bottleneck?** Client CPU decoding many videos, and SFU bandwidth costs.

### Testing / engineering
44. **How did you test it?** Unit tests, API+socket integration tests, and a Playwright E2E suite that opens two real browsers with a fake camera.
45. **How do you test the camera without a camera?** Chromium flags `--use-fake-device-for-media-stream` and `--use-fake-ui-for-media-stream`.
46. **What bug did testing catch?** The silent-network-loss reconnect bug (see section 4, #4).
47. **What isn't tested?** Real multi-user LiveKit video and load testing.
48. **What would you improve?** Resume-on-refresh, Redis socket adapter, multiple rooms, Pomodoro, stronger moderation, monitoring (Sentry), analytics.

### AI-use questions (be ready)
49. **Did you write this code yourself?** Answer honestly: you wrote the PRD and architecture, directed an AI assistant to implement it step by step, reviewed, ran and tested it, and can explain every module. (Read through `useRoom.ts`, `sessionService.ts`, and `socket.ts` until you can walk through them.)
50. **What did you learn?** WebRTC vs SFU, realtime presence design, server-authoritative state, privacy-by-design, testing with fake media.

---

## 6. YouTube video plan

**Goal:** people instantly understand what it is, see it working, and watch to the end.

**Title options (pick one, keep < 60 chars):**
- "I Built a Virtual Library Where Strangers Study Together (Live Camera, No Login)"
- "I Built My Own Study With Me Website — Full Project Build"
- "How I Built a Real-Time Study Room with React, WebRTC & LiveKit"

**Thumbnail:** a grid of small webcam tiles with timers (use your screenshot), big text **"STUDY TOGETHER"** (max 3–4 words), green LIVE dot. High contrast, readable at phone size. Make 2 versions and A/B test.

**Length:** 8–12 minutes. Keep pace fast; cut every pause.

### Script / timeline
| Time | What to show | What to say |
|---|---|---|
| 0:00–0:20 **Hook** | Fast cuts: grid with many tiles, timers ticking, you clicking JOIN, leaderboard | "What if you could study with 200 strangers — no talking, no login — just silent focus? I built that. Here's how." |
| 0:20–1:00 **Problem + idea** | You alone at a desk → library footage/graphic | Studying alone = distraction. Zoom = noise. I wanted the feeling of a library. |
| 1:00–2:30 **Live demo** | Two browser windows side by side. Join in both, show tiles, timers, count, leaderboard, dark mode, leave | Walk the user flow exactly as in the PRD. Show it works on phone too. |
| 2:30–4:00 **Architecture** | Your diagram, animated step-by-step | "React talks to Node. Node uses Redis for who's here. Video goes to LiveKit, an SFU, so it scales." Explain why not peer-to-peer in one sentence with a simple N² drawing. |
| 4:00–6:00 **How I built it** | Screen recording of the repo, PRD, key files, AI-assisted workflow | Show PRD → diagram → build. Mention tech stack. Be honest about using AI. |
| 6:00–8:00 **Hard parts** | Code snippets of timer, heartbeat/grace | Server-authoritative timer, reconnect grace, the bug found by testing (section 4 #4) — people love bug stories. |
| 8:00–9:00 **Testing** | Terminal with tests passing, Playwright run | "I run two real browsers with a fake camera and test 25 scenarios automatically." |
| 9:00–10:00 **Deploy + results** | EC2/Nginx/domain, live site | How it's deployed, cost, what's next. |
| Last 20 s **CTA** | Link on screen | "Try it now (link below). Comment which room you want next: programming, exam, or night-owl." |

### Retention / reach tips
- **First 5 seconds = everything.** Start with the finished product, never with "Hi guys, welcome".
- **Show, don't tell.** Cut to the screen every few seconds; add zoom-ins on important UI.
- **Add captions** (many watch muted) and **chapters** (timestamps in the description).
- Put a **live link / GitHub link** in the first line of the description and pinned comment.
- **Title keywords:** "Study With Me", "React", "WebRTC", "Project", "Real-time". Use 5–8 tags and 3 hashtags (#studywithme #webrtc #reactjs).
- **Invite real users** during recording (friends joining live) — real people in the grid is far more convincing than just you.
- **Post when your audience is online** (evenings IST for Indian students), reply to every comment in the first hour.
- **Cross-post:** Shorts (below), Reddit (r/webdev, r/learnprogramming, r/GetStudying, r/IndianStudents), LinkedIn, Twitter/X, Discord study servers, college groups.
- **Two audiences:** students (use-it) and developers (build-it). Make the first half for both, the second half for developers; title/thumbnail for students *or* developers, not both.
- Make a **pinned comment with a question** ("What features should I add?") to boost comments.

---

## 7. YouTube Shorts ideas

Vertical 9:16, 20–45 s, text on screen, loop-friendly ending, link to the full video in the comment.

### Short 1 — "Study with 100 strangers (no talking)"
- **Show:** screen record of the grid filling up, timers running, you hitting JOIN.
- **Say / caption:** "I built a library you can join from your bed. No login. No talking. Just focus." → "Link in comments."
- **Hook (0–2 s):** the full grid with a big timer.

### Short 2 — "Why Zoom can't do this: P2P vs SFU"
- **Show:** simple animation — 5 people all connected to each other (messy lines) vs 5 people connected to one server (clean).
- **Say:** "5 users = 20 connections. 100 users = 9,900. That's why I used an SFU. One upload each."
- **End:** "Follow for more system design."

### Short 3 — "The bug my tests caught"
- **Show:** toggling Wi-Fi off (DevTools → Offline), the other window shows "Reconnecting…", then the user returns.
- **Say:** "My app didn't notice when someone lost internet. A test caught it. The fix: a heartbeat every 5 seconds and a 45-second grace period."
- **Hook:** "My app lied about who was online."

### Short 4 — "How the timer can't be cheated"
- **Show:** change your PC clock / refresh, the timer stays correct; code snippet `now + serverOffset − joinedAt`.
- **Say:** "Never trust the client's clock. The server stamps the start time; every screen does the maths."

### Short 5 — "I built this in a day with AI — here's the workflow"
- **Show:** PRD doc → diagram → terminal building → app running (speed-up).
- **Say:** "1) Write a PRD. 2) Draw the architecture. 3) Let AI build it step by step. 4) Test everything. Here's what I wrote vs what AI wrote."
- **Why it works:** AI-workflow Shorts get high reach; be honest about what you did yourself.

**Short-posting rhythm:** post 1 Short/day for 5 days *before or right after* the long video, each ending with "full build in my channel".

---

## 8. Demo checklist and cheat sheet

**Before recording / presenting**
- [ ] Add LiveKit keys (`.env`), run `npm run dev`, join from **two browsers/devices** — confirm real video appears in both.
- [ ] Remove the "Demo mode" banner by configuring LiveKit.
- [ ] Use a clean browser profile / good lighting for your own camera tile.
- [ ] Have 3–5 friends ready to join live during the demo.
- [ ] Run `npm test` and `npm run e2e -w client` once so you can show green output.
- [ ] Keep the diagram PNG and PRD open in tabs.

**Run commands**
```bash
npm install
cp .env.example server/.env     # add LiveKit keys
npm run dev                      # http://localhost:5173
npm test                         # unit + integration
npm run e2e -w client            # needs the app running
```

**Files to know by heart**
| File | One-line purpose |
|---|---|
| `server/src/services/sessionService.ts` | Session lifecycle, heartbeat, grace timer, sweeper |
| `server/src/realtime/socket.ts` | Socket.IO events and broadcasts |
| `server/src/media/livekit.ts` | Short-lived camera-only token |
| `server/src/redis/store.ts` | Redis / in-memory session storage |
| `client/src/hooks/useRoom.ts` | Client state machine: join, leave, reconnect |
| `client/src/services/media.ts` | LiveKit publish/subscribe, adaptive subscriptions |
| `client/e2e/run.mjs` | The end-to-end acceptance tests |
