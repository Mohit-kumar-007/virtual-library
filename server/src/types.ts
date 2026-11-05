export type ConnectionState = "connected" | "reconnecting" | "disconnected";

export interface Session {
  sessionId: string;
  roomId: string;
  displayName: string;
  title: string;
  description: string;
  joinedAt: number; // epoch ms, server clock
  lastHeartbeat: number;
  connectionState: ConnectionState;
  mediaState: "pending" | "publishing" | "error";
}

/** Public view of a session (no secrets, no heartbeat internals). */
export interface PublicParticipant {
  sessionId: string;
  displayName: string;
  title: string;
  description: string;
  joinedAt: number;
  connectionState: ConnectionState;
  mediaState: Session["mediaState"];
}
