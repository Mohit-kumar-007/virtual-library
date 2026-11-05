export type ConnectionState = "connected" | "reconnecting" | "disconnected";
export interface Participant {
  sessionId: string;
  displayName: string;
  title: string;
  description: string;
  joinedAt: number; // server epoch ms
  connectionState: ConnectionState;
  mediaState: "pending" | "publishing" | "error";
}
export interface MySession { sessionId: string; roomId: string; joinedAt: number; }
