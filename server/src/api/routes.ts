import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { joinSchema } from "../services/validation.js";
import { RoomFullError, SessionService, toPublic } from "../services/sessionService.js";
import { issueMediaToken, removeFromSfu } from "../media/livekit.js";
import { joinLimiter, reportLimiter } from "../middleware/security.js";

export function createRouter(svc: SessionService) {
  const r = Router();

  r.get("/health", (_req, res) => res.json({ ok: true, time: Date.now() }));

  r.post("/sessions", joinLimiter, async (req, res) => {
    const parsed = joinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid input",
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])),
      });
    }
    try {
      const s = await svc.create(parsed.data);
      res.status(201).json({ sessionId: s.sessionId, roomId: s.roomId, joinedAt: s.joinedAt, serverNow: Date.now() });
    } catch (e) {
      if (e instanceof RoomFullError) return res.status(503).json({ error: e.message });
      throw e;
    }
  });

  r.post("/sessions/:id/media-token", async (req, res) => {
    const s = await svc.get(String(req.params.id));
    if (!s) return res.status(404).json({ error: "Session not found or expired" });
    try {
      res.json(await issueMediaToken(s));
    } catch (e) {
      res.status(503).json({ error: (e as Error).message });
    }
  });

  r.post("/sessions/:id/leave", async (req, res) => {
    const s = await svc.get(String(req.params.id));
    if (s) { await svc.end(s.sessionId, "leave"); void removeFromSfu(s); }
    res.json({ ok: true }); // idempotent (also used via sendBeacon on tab close)
  });

  const reportSchema = z.object({ reason: z.string().trim().max(200).optional() });
  r.post("/sessions/:id/report", reportLimiter, async (req, res) => {
    const target = await svc.get(String(req.params.id));
    if (!target) return res.status(404).json({ error: "Participant not found" });
    const body = reportSchema.safeParse(req.body);
    await svc.report({ targetSessionId: target.sessionId, targetName: target.displayName, reason: body.success ? body.data.reason ?? "" : "" });
    res.json({ ok: true });
  });

  r.get("/rooms/:roomId", async (req, res) => {
    const list = await svc.list(String(req.params.roomId));
    res.json({ roomId: String(req.params.roomId), capacity: config.roomCapacity, activeCount: list.length, serverNow: Date.now() });
  });

  r.get("/rooms/:roomId/participants", async (req, res) => {
    const list = await svc.list(String(req.params.roomId));
    res.json({ participants: list.map(toPublic), serverNow: Date.now() });
  });

  // Moderation hook: remove a participant. Requires ADMIN_TOKEN (server-side only).
  r.delete("/admin/sessions/:id", async (req, res) => {
    const auth = req.header("authorization") ?? "";
    if (!config.adminToken || auth !== `Bearer ${config.adminToken}`) return res.status(401).json({ error: "Unauthorized" });
    const s = await svc.get(String(req.params.id));
    if (!s) return res.status(404).json({ error: "Not found" });
    await svc.end(s.sessionId, "removed-by-admin");
    void removeFromSfu(s);
    res.json({ ok: true });
  });

  return r;
}
