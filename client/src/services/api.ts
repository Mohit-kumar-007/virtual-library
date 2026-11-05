import type { MySession, Participant } from "../types/participant";

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  constructor(message: string, public status: number, public fields?: Record<string, string>) { super(message); }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError("Can't reach the library server. Please try again shortly.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.fields);
  return data as T;
}

export interface MediaToken { mock: boolean; token?: string; livekitUrl?: string; }

export const api = {
  createSession: (b: { name: string; title: string; description: string }) =>
    req<MySession & { serverNow: number }>("/api/sessions", { method: "POST", body: JSON.stringify(b) }),
  mediaToken: (id: string) => req<MediaToken>(`/api/sessions/${id}/media-token`, { method: "POST" }),
  leave: (id: string) => req<{ ok: boolean }>(`/api/sessions/${id}/leave`, { method: "POST" }),
  /** Fire-and-forget leave for tab close. */
  leaveBeacon: (id: string) => {
    try { navigator.sendBeacon(`${API_BASE}/api/sessions/${id}/leave`, new Blob(["{}"], { type: "text/plain" })); } catch { /* ignore */ }
  },
  report: (id: string, reason?: string) =>
    req<{ ok: boolean }>(`/api/sessions/${id}/report`, { method: "POST", body: JSON.stringify({ reason }) }),
  health: () => req<{ ok: boolean }>("/api/health"),
  participants: () => req<{ participants: Participant[]; serverNow: number }>("/api/rooms/main-library/participants"),
};
