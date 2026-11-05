import { formatHMS } from "../utils/time";

/** Duration derived from server timestamps: (local clock + server offset) - joinedAt. Never an increment-only counter. */
export function useSessionTimer(joinedAt: number | null | undefined, now: number, serverOffset: number) {
  if (!joinedAt) return { ms: 0, text: "00:00:00" };
  const ms = Math.max(0, now + serverOffset - joinedAt);
  return { ms, text: formatHMS(ms) };
}
