import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { io as ioc, type Socket } from "socket.io-client";
import type { AddressInfo } from "node:net";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/redis/store.js";
import { config } from "../src/config.js";

const store = new MemoryStore();
const { http, svc, io } = createApp(store);
let url = "";
const sockets: Socket[] = [];
const connect = () => { const s = ioc(url, { transports: ["websocket"], forceNew: true }); sockets.push(s); return s; };
const emitAck = <T = any>(s: Socket, ev: string, payload?: unknown) =>
  new Promise<T>((res) => (payload === undefined ? s.emit(ev, res) : s.emit(ev, payload, res)));
const once = <T = any>(s: Socket, ev: string) => new Promise<T>((res) => s.once(ev, res));
const body = { name: "Mohit", title: "CSE Student", description: "Learning FastAPI" };

beforeAll(async () => {
  config.graceSeconds = 1;
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

describe("rate limiting", () => {
  it("limits session creation", async () => {
    let last = 0;
    for (let i = 0; i < config.joinRateLimitPerMin + 3; i++) last = (await request(http).post("/api/sessions").send(body)).status;
    expect(last).toBe(429);
  });
});

