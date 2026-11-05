import { nanoid } from "nanoid";
import { EventEmitter } from "node:events";
import { config } from "../config.js";
import type { SessionStore } from "../redis/store.js";
import type { PublicParticipant, Session } from "../types.js";
import type { JoinInput } from "./validation.js";

export const toPublic = (s: Session): PublicParticipant => ({
  sessionId: s.sessionId, displayName: s.displayName, title: s.title, description: s.description,
  joinedAt: s.joinedAt, connectionState: s.connectionState, mediaState: s.mediaState,
});

export class RoomFullError extends Error {}

/**
 * Owns session lifecycle: create, heartbeat, reconnect grace, stale cleanup.
 * Emits: "joined"(PublicParticipant), "left"(sessionId, reason), "updated"(PublicParticipant)
 */
export class SessionService extends EventEmitter {
  private graceTimers = new Map<string, NodeJS.Timeout>();
  private sweeper?: NodeJS.Timeout;

  constructor(private store: SessionStore, private now: () => number = Date.now) { super(); }

  startSweeper(intervalMs = 5000) {
    this.sweeper = setInterval(() => void this.sweepStale().catch(console.error), intervalMs);
    this.sweeper.unref?.();
  }

  stop() {
    if (this.sweeper) clearInterval(this.sweeper);
    this.graceTimers.forEach(clearTimeout);
    this.graceTimers.clear();
  }

  async create(input: JoinInput, roomId = config.roomId): Promise<Session> {
    const active = await this.store.list(roomId);
    if (active.length >= config.roomCapacity) throw new RoomFullError("Library is full right now");
    const t = this.now();
    const s: Session = {
      sessionId: nanoid(21), roomId, displayName: input.name, title: input.title,
      description: input.description, joinedAt: t, lastHeartbeat: t,
      connectionState: "connected", mediaState: "pending",
    };
    await this.store.put(s);
    // Not public until media is confirmed (see setMediaState). A session that never confirms is
    // removed by the sweeper once its heartbeat goes stale.
    return s;
  }

  get(id: string) { return this.store.get(id); }

  /** Public participants: only sessions whose media has been confirmed, oldest (longest studying) first. */
  async list(roomId = config.roomId) {
    return (await this.store.list(roomId))
      .filter((s) => s.mediaState !== "pending")
      .sort((a, b) => a.joinedAt - b.joinedAt);
  }

  async setMediaState(id: string, mediaState: Session["mediaState"]) {
    const prev = await this.store.get(id);
    if (!prev) return null;
    const s = await this.store.patch(id, { mediaState });
    if (s) this.emit(prev.mediaState === "pending" && mediaState !== "pending" ? "joined" : "updated", toPublic(s));
    return s;
  }

  async heartbeat(id: string) {
    this.clearGrace(id);
    const prev = await this.store.get(id);
    if (!prev) return null;
    const s = await this.store.patch(id, { lastHeartbeat: this.now(), connectionState: "connected" });
    if (s && prev.connectionState !== "connected" && s.mediaState !== "pending") this.emit("updated", toPublic(s));
    return s;
  }

  /** Socket attached/reattached to an existing session. */
  attach(id: string) { return this.heartbeat(id); }

  /** Socket dropped: mark reconnecting and start grace timer. */
  async detach(id: string) {
    const s = await this.store.patch(id, { connectionState: "reconnecting" });
    if (!s) return;
    if (s.mediaState !== "pending") this.emit("updated", toPublic(s));
    this.clearGrace(id);
    const t = setTimeout(() => void this.end(id, "grace-expired").catch(console.error), config.graceSeconds * 1000);
    t.unref?.();
    this.graceTimers.set(id, t);
  }

  async end(id: string, reason = "leave"): Promise<boolean> {
    this.clearGrace(id);
    const ok = await this.store.remove(id);
    if (ok) this.emit("left", id, reason);
    return ok;
  }

  async sweepStale(roomId = config.roomId) {
    const t = this.now();
    const cutoff = t - config.graceSeconds * 1000;
    // Silent network loss (no socket close): flag as reconnecting once heartbeats are overdue, remove after grace.
    const warnAfter = Math.min(15_000, (config.graceSeconds * 1000) / 2);
    for (const s of await this.store.list(roomId)) {
      if (s.lastHeartbeat < cutoff) await this.end(s.sessionId, "stale");
      else if (s.connectionState === "connected" && s.lastHeartbeat < t - warnAfter) {
        const u = await this.store.patch(s.sessionId, { connectionState: "reconnecting" });
        if (u && u.mediaState !== "pending") this.emit("updated", toPublic(u));
      }
    }
  }

  private clearGrace(id: string) {
    const t = this.graceTimers.get(id);
    if (t) { clearTimeout(t); this.graceTimers.delete(id); }
  }

  report(entry: Record<string, unknown>) { return this.store.addReport({ ...entry, at: this.now() }); }
}
