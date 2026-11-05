import { Redis } from "ioredis";
import type { Session } from "../types.js";

/** Storage abstraction: Redis in production, in-memory for local dev/tests. */
export interface SessionStore {
  put(s: Session): Promise<void>;
  get(id: string): Promise<Session | null>;
  patch(id: string, p: Partial<Session>): Promise<Session | null>;
  remove(id: string): Promise<boolean>;
  list(roomId: string): Promise<Session[]>;
  addReport(entry: Record<string, unknown>): Promise<void>;
  close(): Promise<void>;
}

export class MemoryStore implements SessionStore {
  private m = new Map<string, Session>();
  reports: Record<string, unknown>[] = [];
  async put(s: Session) { this.m.set(s.sessionId, { ...s }); }
  async get(id: string) { const s = this.m.get(id); return s ? { ...s } : null; }
  async patch(id: string, p: Partial<Session>) {
    const s = this.m.get(id); if (!s) return null;
    Object.assign(s, p); return { ...s };
  }
  async remove(id: string) { return this.m.delete(id); }
  async list(roomId: string) { return [...this.m.values()].filter((s) => s.roomId === roomId).map((s) => ({ ...s })); }
  async addReport(e: Record<string, unknown>) { this.reports.push(e); }
  async close() {}
}

const key = (id: string) => `session:${id}`;
const roomKey = (r: string) => `room:${r}:sessions`;

export class RedisStore implements SessionStore {
  constructor(private r: Redis) {}

  private enc(s: Session): Record<string, string> {
    return Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)]));
  }
  private dec(h: Record<string, string>): Session | null {
    if (!h.sessionId) return null;
    return {
      sessionId: h.sessionId, roomId: h.roomId, displayName: h.displayName, title: h.title,
      description: h.description, joinedAt: Number(h.joinedAt), lastHeartbeat: Number(h.lastHeartbeat),
      connectionState: h.connectionState as Session["connectionState"],
      mediaState: h.mediaState as Session["mediaState"],
    };
  }
  async put(s: Session) {
    await this.r.multi().hset(key(s.sessionId), this.enc(s)).sadd(roomKey(s.roomId), s.sessionId).exec();
  }
  async get(id: string) { return this.dec(await this.r.hgetall(key(id))); }
  async patch(id: string, p: Partial<Session>) {
    if (!(await this.r.exists(key(id)))) return null;
    const flat = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
    if (Object.keys(flat).length) await this.r.hset(key(id), flat);
    return this.get(id);
  }
  async remove(id: string) {
    const s = await this.get(id);
    if (!s) return false;
    await this.r.multi().del(key(id)).srem(roomKey(s.roomId), id).exec();
    return true;
  }
  async list(roomId: string) {
    const ids = await this.r.smembers(roomKey(roomId));
    if (!ids.length) return [];
    const p = this.r.pipeline();
    ids.forEach((i) => p.hgetall(key(i)));
    const res = (await p.exec()) ?? [];
    const out: Session[] = [];
    const stale: string[] = [];
    res.forEach(([, h], i) => {
      const s = this.dec(h as Record<string, string>);
      if (s) out.push(s); else stale.push(ids[i]);
    });
    if (stale.length) await this.r.srem(roomKey(roomId), ...stale);
    return out;
  }
  async addReport(e: Record<string, unknown>) {
    await this.r.multi().lpush("reports", JSON.stringify(e)).ltrim("reports", 0, 999).exec();
  }
  async close() { await this.r.quit(); }
}

export async function createStore(redisUrl: string, isProduction = false): Promise<SessionStore> {
  if (!redisUrl) {
    console.warn("[store] REDIS_URL not set — using in-memory store (single instance only)");
    return new MemoryStore();
  }
  // Probe once so a missing Redis gives a clear message instead of a crash loop.
  const probe = new Redis(redisUrl, { lazyConnect: true, retryStrategy: () => null, connectTimeout: 3000, maxRetriesPerRequest: 0 });
  probe.on("error", () => {});
  try {
    await probe.connect();
    await probe.quit();
  } catch {
    probe.disconnect();
    const msg = `Cannot reach Redis at ${redisUrl}`;
    if (isProduction) throw new Error(`${msg}. Start Redis or fix REDIS_URL.`);
    console.warn(`[store] ${msg} — falling back to the in-memory store (dev only). Clear REDIS_URL in server/.env to silence this.`);
    return new MemoryStore();
  }
  const r = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  r.on("error", (e: Error) => console.error("[redis]", e.message));
  return new RedisStore(r);
}
