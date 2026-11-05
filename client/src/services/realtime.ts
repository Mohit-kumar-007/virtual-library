import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./api";
import type { Participant } from "../types/participant";

export interface RoomSnapshot { participants: Participant[]; count: number; serverNow: number; }

export function createSocket(): Socket {
  return io(API_BASE || undefined, { path: "/socket.io", transports: ["websocket", "polling"], reconnectionDelayMax: 3000 });
}

export const emitAck = <T,>(s: Socket, ev: string, payload?: unknown): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), 8000);
    const cb = (r: T) => { clearTimeout(t); resolve(r); };
    if (payload === undefined) s.emit(ev, cb); else s.emit(ev, payload, cb);
  });
