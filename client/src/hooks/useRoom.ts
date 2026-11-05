import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { api, ApiError } from "../services/api";
import { createSocket, emitAck, type RoomSnapshot } from "../services/realtime";
import { CameraError, getCameraStream } from "../services/camera";
import type { MediaConnection } from "../services/media";
import type { MySession, Participant } from "../types/participant";
import type { JoinForm } from "../utils/validation";

export type JoinPhase = "idle" | "camera" | "connecting" | "joined";
export interface JoinError { message: string; kind?: "denied" | "unavailable" | "unsupported" | "server" | "validation"; fields?: Record<string, string>; }

export function useRoom() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [count, setCount] = useState(0);
  const [serverOffset, setServerOffset] = useState(0);
  const [online, setOnline] = useState(true); // server reachable
  const [phase, setPhase] = useState<JoinPhase>("idle");
  const [me, setMe] = useState<MySession | null>(null);
  const [myName, setMyName] = useState<JoinForm | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [conn, setConn] = useState<MediaConnection | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mockMedia, setMockMedia] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const meRef = useRef<MySession | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const connRef = useRef<MediaConnection | null>(null);
  const hbRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applySnapshot = useCallback((s: RoomSnapshot) => {
    setParticipants(s.participants);
    setCount(s.count);
    setServerOffset(s.serverNow - Date.now());
  }, []);

  const teardown = useCallback(async () => {
    if (hbRef.current) { clearInterval(hbRef.current); hbRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLocalStream(null);
    const c = connRef.current; connRef.current = null; setConn(null);
    await c?.disconnect();
    meRef.current = null;
    setMe(null); setMyName(null); setPhase("idle"); setMediaError(null);
  }, []);

  // Spectator socket: always connected so the landing page is live.
  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;
    const joinOrSpectate = async () => {
      setOnline(true);
      try {
        const mine = meRef.current;
        if (mine) {
          const r = await emitAck<{ ok: boolean; error?: string } & RoomSnapshot>(socket, "join", { sessionId: mine.sessionId });
          if (!r.ok) { setNotice("Your session expired while you were offline. You can join again."); await teardown(); return; }
          applySnapshot(r);
          if (streamRef.current?.getVideoTracks().some((t) => t.readyState === "live")) socket.emit("media:state", { state: "publishing" });
        } else {
          applySnapshot(await emitAck<RoomSnapshot>(socket, "spectate"));
        }
      } catch { /* retried on next connect */ }
    };
    socket.on("connect", joinOrSpectate);
    socket.on("disconnect", () => { /* grace period handles reconnect; UI shows offline pill if we can't reconnect */ setOnline(false); });
    socket.on("connect_error", () => setOnline(false));
    socket.on("participant:joined", (p: Participant) =>
      setParticipants((l) => (l.some((x) => x.sessionId === p.sessionId) ? l : [...l, p].sort((a, b) => a.joinedAt - b.joinedAt))));
    socket.on("participant:updated", (p: Participant) => setParticipants((l) => l.map((x) => (x.sessionId === p.sessionId ? p : x))));
    socket.on("participant:left", ({ sessionId }: { sessionId: string }) => setParticipants((l) => l.filter((x) => x.sessionId !== sessionId)));
    socket.on("room:count", ({ count }: { count: number }) => setCount(count));
    socket.on("session:ended", ({ reason }: { reason: string }) => {
      if (reason === "leave") return;
      setNotice(reason === "removed-by-admin" ? "You were removed from the library by a moderator." : "Your session ended after a long connection loss.");
      void teardown();
    });
    return () => { socket.close(); };
  }, [applySnapshot, teardown]);

  // Leave when the tab closes so the user disappears promptly (heartbeat timeout is the fallback).
  useEffect(() => {
    const h = () => { if (meRef.current) api.leaveBeacon(meRef.current.sessionId); };
    window.addEventListener("pagehide", h);
    return () => window.removeEventListener("pagehide", h);
  }, []);

  const join = useCallback(async (form: JoinForm): Promise<JoinError | null> => {
    const socket = socketRef.current!;
    setNotice(null);
    let stream: MediaStream | null = null;
    try {
      // 1. Camera permission — only now, after explicit JOIN submit.
      setPhase("camera");
      stream = await getCameraStream();
      // 2. Server confirms session (timer starts at server joinedAt).
      setPhase("connecting");
      const s = await api.createSession({ name: form.name.trim(), title: form.title.trim(), description: form.description.trim() });
      meRef.current = s;
      streamRef.current = stream;
      // 3. Short-lived media token -> 4. publish camera to the SFU.
      let mc: MediaConnection | null = null;
      try {
        const t = await api.mediaToken(s.sessionId);
        setMockMedia(t.mock);
        if (!t.mock && t.token && t.livekitUrl) {
          const { MediaConnection: MC } = await import("../services/media"); // lazy: keeps LiveKit off the critical path
          mc = new MC();
          mc.onDisconnected(() => { if (connRef.current === mc) setMediaError("Lost connection to the video server. Trying to reconnect…"); });
          await mc.connect(t.livekitUrl, t.token, stream.getVideoTracks()[0]);
          connRef.current = mc; setConn(mc);
        }
      } catch (e) {
        console.error("[media] failed to connect:", e);
        await mc?.disconnect();
        const detail = e instanceof ApiError ? e.message : (e as Error)?.message;
        throw new ApiError(`Couldn't connect to the video server${detail ? ` (${detail})` : ""}. Check LIVEKIT_URL / keys and try again.`, 503);
      }
      // 5. Socket join -> presence broadcast.
      const r = await emitAck<{ ok: boolean; error?: string } & RoomSnapshot>(socket, "join", { sessionId: s.sessionId });
      if (!r.ok) throw new ApiError(r.error ?? "Could not join", 400);
      applySnapshot(r);
      socket.emit("media:state", { state: "publishing" });
      stream.getVideoTracks()[0].addEventListener("ended", () => {
        setMediaError("Your camera stopped working. Leave and rejoin to try again.");
        socket.emit("media:state", { state: "error" });
      });
      setLocalStream(stream);
      setMe(s); setMyName(form);
      hbRef.current = setInterval(() => { if (socket.connected) socket.emit("heartbeat"); }, 5000);
      setPhase("joined");
      return null;
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      const id = meRef.current?.sessionId;
      if (id) void api.leave(id).catch(() => {});
      meRef.current = null; streamRef.current = null;
      await connRef.current?.disconnect(); connRef.current = null; setConn(null);
      setPhase("idle");
      if (e instanceof CameraError) return { message: e.message, kind: e.kind };
      if (e instanceof ApiError) return { message: e.message, kind: e.status === 400 ? "validation" : "server", fields: e.fields };
      return { message: "Something went wrong. Please try again.", kind: "server" };
    }
  }, [applySnapshot]);

  const leave = useCallback(async () => {
    const id = meRef.current?.sessionId;
    socketRef.current?.emit("leave");
    if (id) await api.leave(id).catch(() => {});
    await teardown();
    // Refresh public view
    socketRef.current?.emit("spectate", (s: RoomSnapshot) => applySnapshot(s));
  }, [teardown, applySnapshot]);

  return { participants, count, serverOffset, online, phase, me, myName, localStream, conn, mediaError, notice, mockMedia, join, leave, dismissNotice: () => setNotice(null) };
}
