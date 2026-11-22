import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { io as ioc, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/redis/store.js";
import { SessionService } from "../src/services/sessionService.js";
import { config } from "../src/config.js";

const store = new MemoryStore();
const { app, http, svc, io } = createApp(store);
let url = "";
const sockets: Socket[] = [];
const connect = () => { const s = ioc(url, { transports: ["websocket"], forceNew: true }); sockets.push(s); return s; };
const emitAck = <T = any>(s: Socket, ev: string, payload?: unknown) =>
  new Promise<T>((res) => (payload === undefined ? s.emit(ev, res) : s.emit(ev, payload, res)));
const once = <T = any>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));
const body = { name: "Mohit", title: "CSE Student", description: "Learning FastAPI" };

beforeAll(async () => {
  config.graceSeconds = 1;
  // Tests must not depend on a developer's real server/.env: start with no LiveKit configured (mock media).
  Object.assign(config.livekit, { url: "", apiKey: "", apiSecret: "" });
  config.allowMockMedia = true;
  await new Promise<void>((r) => http.listen(0, r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});
afterAll(async () => { sockets.forEach((s) => s.close()); svc.stop(); io.close(); http.close(); });

describe("REST", () => {
  it("validates join input", async () => {
    const r = await request(http).post("/api/sessions").send({ name: "", title: "x", description: "y".repeat(161) });
    expect(r.status).toBe(400);
    expect(r.body.fields.name).toBeTruthy();
    expect(r.body.fields.description).toMatch(/160/);
  });
  it("creates session, issues mock media token, hides pending from public list", async () => {
    const r = await request(http).post("/api/sessions").send(body);
    expect(r.status).toBe(201);
    expect(r.body.sessionId).toBeTruthy();
    const t = await request(http).post(`/api/sessions/${r.body.sessionId}/media-token`);
    expect(t.body.mock).toBe(true);
    const p = await request(http).get(`/api/rooms/${config.roomId}/participants`);
    expect(p.body.participants.find((x: any) => x.sessionId === r.body.sessionId)).toBeUndefined();
    await request(http).post(`/api/sessions/${r.body.sessionId}/leave`);
  });
  it("404s media token for unknown session; leave is idempotent", async () => {
    expect((await request(http).post("/api/sessions/nope/media-token")).status).toBe(404);
    expect((await request(http).post("/api/sessions/nope/leave")).status).toBe(200);
  });
  it("admin removal requires token", async () => {
    expect((await request(http).delete("/api/admin/sessions/x")).status).toBe(401);
  });
});

describe("realtime lifecycle", () => {
  it("join → broadcast → heartbeat → leave", async () => {
    const watcher = connect();
    await emitAck(watcher, "spectate");
    const { body: s } = await request(http).post("/api/sessions").send(body);
    const me = connect();
    const joinedP = once(watcher, "participant:joined");
    const j = await emitAck(me, "join", { sessionId: s.sessionId });
    expect(j.ok).toBe(true);
    me.emit("media:state", { state: "publishing" });
    const joined = await joinedP;
    expect(joined.displayName).toBe("Mohit");
    expect(joined.joinedAt).toBe(s.joinedAt);
    expect((await emitAck(me, "heartbeat")).ok).toBe(true);
    const count = (await request(http).get(`/api/rooms/${config.roomId}`)).body.activeCount;
    expect(count).toBe(1);
    const leftP = once(watcher, "participant:left");
    await request(http).post(`/api/sessions/${s.sessionId}/leave`);
    expect((await leftP).sessionId).toBe(s.sessionId);
    expect((await request(http).get(`/api/rooms/${config.roomId}`)).body.activeCount).toBe(0);
  });

  it("reconnect within grace keeps session; expiry removes it", async () => {
    const watcher = connect();
    await emitAck(watcher, "spectate");
    const { body: s } = await request(http).post("/api/sessions").send(body);
    let me = connect();
    await emitAck(me, "join", { sessionId: s.sessionId });
    me.emit("media:state", { state: "publishing" });
    await once(watcher, "participant:joined");

    me.close(); // network drop
    const upd = await once(watcher, "participant:updated");
    expect(upd.connectionState).toBe("reconnecting");
    me = connect();
    expect((await emitAck(me, "join", { sessionId: s.sessionId })).ok).toBe(true);
    await new Promise((r) => setTimeout(r, 1300)); // longer than grace
    expect((await svc.get(s.sessionId))?.connectionState).toBe("connected");

    const leftP = once(watcher, "participant:left");
    me.close();
    const left = await leftP;
    expect(left.reason).toBe("grace-expired");
  });

  it("sweeps stale sessions that never heartbeat", async () => {
    const { body: s } = await request(http).post("/api/sessions").send(body);
    await store.patch(s.sessionId, { lastHeartbeat: Date.now() - 60_000 });
    await svc.sweepStale();
    expect(await svc.get(s.sessionId)).toBeNull();
  });

  it("rejects join with bad session", async () => {
    expect((await emitAck(connect(), "join", { sessionId: "bad" })).ok).toBe(false);
  });
});

describe("silent network loss", () => {
  it("flags overdue heartbeats as reconnecting, then recovers on heartbeat", async () => {
    config.graceSeconds = 10;
    const { body: s } = await request(http).post("/api/sessions").send(body);
    await svc.setMediaState(s.sessionId, "publishing");
    await store.patch(s.sessionId, { lastHeartbeat: Date.now() - 6_000 });
    await svc.sweepStale();
    expect((await svc.get(s.sessionId))?.connectionState).toBe("reconnecting");
    await svc.heartbeat(s.sessionId);
    expect((await svc.get(s.sessionId))?.connectionState).toBe("connected");
    await svc.end(s.sessionId);
    config.graceSeconds = 1;
  });
});

describe("silent user is always shown as reconnecting before being dropped", () => {
  // With a short grace, a sweep interval that is too coarse can skip the "reconnecting" state entirely (flag at grace/2, remove at grace).
  it.each([0, 1000, 2500, 3500, 4900])("grace 6s, user goes silent %i ms into a sweep cycle", async (phase) => {
    vi.useFakeTimers();
    const saved = config.graceSeconds; config.graceSeconds = 6;
    const local = new SessionService(new MemoryStore());
    try {
      local.startSweeper(); // default interval follows the grace period
      await vi.advanceTimersByTimeAsync(phase);
      const s = await local.create({ name: "Silent", title: "t", description: "d" });
      await local.setMediaState(s.sessionId, "publishing"); // visible to others, then no more heartbeats
      let sawReconnecting = false, gone = false;
      for (let t = 0; t < 15000 && !gone; t += 100) {
        await vi.advanceTimersByTimeAsync(100);
        const cur = await local.get(s.sessionId);
        if (!cur) gone = true; else if (cur.connectionState === "reconnecting") sawReconnecting = true;
      }
      expect(gone).toBe(true);
      expect(sawReconnecting).toBe(true);
    } finally { local.stop(); config.graceSeconds = saved; vi.useRealTimers(); }
  });
});

describe("capacity", () => {
  it("turns away the next user when the room is full, then admits one after someone leaves", async () => {
    const saved = config.roomCapacity, ids: string[] = [];
    const join = (ip: string) => request(http).post("/api/sessions").set("X-Forwarded-For", ip).send(body);
    config.roomCapacity = (await store.list(config.roomId)).length + 2;
    try {
      for (const ip of ["203.0.113.1", "203.0.113.2"]) { const r = await join(ip); expect(r.status).toBe(201); ids.push(r.body.sessionId); }
      const full = await join("203.0.113.3");
      expect(full.status).toBe(503);
      expect(full.body.error).toMatch(/full/i);
      await request(http).post(`/api/sessions/${ids[0]}/leave`);
      const again = await join("203.0.113.4");
      expect(again.status).toBe(201); ids.push(again.body.sessionId);
    } finally {
      config.roomCapacity = saved;
      for (const id of ids) await request(http).post(`/api/sessions/${id}/leave`);
    }
  });
});

describe("rate limit identity behind proxies", () => {
  const attempts = config.joinRateLimitPerMin + 2;
  const run = async (hops: number, chain: (i: number) => string) => {
    app.set("trust proxy", hops);
    const statuses: number[] = [], ids: string[] = [];
    try {
      for (let i = 1; i <= attempts; i++) {
        const r = await request(http).post("/api/sessions").set("X-Forwarded-For", chain(i)).send(body);
        statuses.push(r.status); if (r.status === 201) ids.push(r.body.sessionId);
      }
    } finally {
      app.set("trust proxy", config.trustProxy);
      for (const id of ids) await request(http).post(`/api/sessions/${id}/leave`);
    }
    return statuses;
  };
  it("counts each visitor separately when TRUST_PROXY matches the chain (Caddy -> Nginx -> API)", async () => {
    expect((await run(2, (i) => `198.51.100.${i}, 172.30.0.9`)).every((s) => s === 201)).toBe(true);
  });
  it("shows the bug it prevents: trusting one hop behind two proxies makes everyone share one limit", async () => {
    const statuses = await run(1, (i) => `192.0.2.${i}, 172.30.0.8`);
    expect(statuses[statuses.length - 1]).toBe(429);
  });
});

describe("rate limiting", () => {
  it("limits session creation", async () => {
    let last = 0;
    for (let i = 0; i < config.joinRateLimitPerMin + 3; i++) last = (await request(http).post("/api/sessions").send(body)).status;
    expect(last).toBe(429);
  });
});


describe("livekit token", () => {
  it("issues a valid camera-only JWT when LiveKit is configured", async () => {
    const { issueMediaToken } = await import("../src/media/livekit.js");
    Object.assign(config.livekit, { url: "wss://x.livekit.cloud", apiKey: "devkey", apiSecret: "a-long-enough-secret-for-hs256-0123456789" });
    const r = await issueMediaToken({ sessionId: "s1", roomId: "main-library", displayName: "A", title: "t", description: "d", joinedAt: 1, lastHeartbeat: 1, connectionState: "connected", mediaState: "pending" });
    expect(r.mock).toBe(false);
    const claims = JSON.parse(Buffer.from(r.token!.split(".")[1], "base64url").toString());
    expect(claims.sub).toBe("s1");
    expect(claims.video.canPublishSources).toEqual(["camera"]);
    expect(claims.video.canPublishData).toBe(false);
    Object.assign(config.livekit, { url: "", apiKey: "", apiSecret: "" });
  });
});
