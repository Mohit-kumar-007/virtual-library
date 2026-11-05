import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { config } from "../config.js";
import { SessionService, toPublic } from "../services/sessionService.js";

const roomName = (roomId: string) => `room:${roomId}`;

export function attachRealtime(http: HttpServer, svc: SessionService, origins: string[]) {
  const io = new Server(http, {
    cors: { origin: origins, methods: ["GET", "POST"] },
    path: "/socket.io",
    pingInterval: 10_000, // detect dead connections faster than the 25s default
    pingTimeout: 5_000,
  });

  async function snapshot(roomId = config.roomId) {
    const list = await svc.list(roomId);
    return { participants: list.map(toPublic), count: list.length, serverNow: Date.now() };
  }
  const broadcastCount = async () => {
    const snap = await snapshot();
    io.to(roomName(config.roomId)).emit("room:count", { count: snap.count });
  };

  svc.on("joined", (p) => { io.to(roomName(config.roomId)).emit("participant:joined", p); void broadcastCount(); });
  svc.on("updated", (p) => io.to(roomName(config.roomId)).emit("participant:updated", p));
  svc.on("left", (sessionId: string, reason: string) => {
    io.to(roomName(config.roomId)).emit("participant:left", { sessionId, reason });
    io.to(`session:${sessionId}`).emit("session:ended", { reason });
    void broadcastCount();
  });

  io.on("connection", (socket: Socket) => {
    let sessionId: string | null = null;

    // Spectators (not yet joined) receive room state so the landing page shows who's studying.
    socket.on("spectate", async (ack?: (r: unknown) => void) => {
      socket.join(roomName(config.roomId));
      ack?.(await snapshot());
    });

    // Diagram step 8: open socket, emit join with sessionId.
    socket.on("join", async (payload: { sessionId?: string }, ack?: (r: unknown) => void) => {
      const id = payload?.sessionId;
      const s = typeof id === "string" ? await svc.attach(id) : null;
      if (!s) return ack?.({ ok: false, error: "Session not found or expired" });
      sessionId = s.sessionId;
      socket.join(roomName(s.roomId));
      socket.join(`session:${s.sessionId}`);
      ack?.({ ok: true, ...(await snapshot(s.roomId)) });
    });

    socket.on("media:state", async (p: { state?: string }) => {
      if (!sessionId) return;
      if (p?.state === "publishing" || p?.state === "error") await svc.setMediaState(sessionId, p.state);
    });

    // Every ~5s: update lastHeartbeat and clear any pending grace timer.
    socket.on("heartbeat", async (ack?: (r: unknown) => void) => {
      if (!sessionId) return ack?.({ ok: false });
      const s = await svc.heartbeat(sessionId);
      ack?.({ ok: Boolean(s), serverNow: Date.now() });
    });

    socket.on("leave", async () => { if (sessionId) await svc.end(sessionId, "leave"); sessionId = null; });

    socket.on("disconnect", () => {
      if (sessionId) void svc.detach(sessionId);
    });
  });

  return io;
}
