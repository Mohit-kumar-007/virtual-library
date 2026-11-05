import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { config, livekitConfigured } from "../config.js";
import type { Session } from "../types.js";

export interface MediaTokenResult {
  mock: boolean;
  token?: string;
  livekitUrl?: string;
  expiresInSeconds: number;
}

/** Issue a short-lived, publish-video-only token. Microphone is never allowed (PRD silent mode). */
export async function issueMediaToken(s: Session): Promise<MediaTokenResult> {
  if (!livekitConfigured()) {
    if (config.allowMockMedia) return { mock: true, expiresInSeconds: 0 };
    throw new Error("Media server not configured");
  }
  const ttl = config.livekit.tokenTtlSeconds;
  const at = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
    identity: s.sessionId,
    name: s.displayName,
    ttl,
  });
  at.addGrant({
    room: s.roomId,
    roomJoin: true,
    canPublish: true,
    canPublishSources: ["camera" as never], // camera only; no mic / screenshare
    canSubscribe: true,
    canPublishData: false,
  });
  return { mock: false, token: await at.toJwt(), livekitUrl: config.livekit.url, expiresInSeconds: ttl };
}

/** Best-effort: kick participant from SFU on leave/ban so media stops immediately. */
export async function removeFromSfu(s: { roomId: string; sessionId: string }) {
  if (!livekitConfigured()) return;
  try {
    const host = config.livekit.url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
    await new RoomServiceClient(host, config.livekit.apiKey, config.livekit.apiSecret)
      .removeParticipant(s.roomId, s.sessionId);
  } catch { /* participant may already be gone */ }
}
