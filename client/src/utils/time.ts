const pad = (n: number) => String(n).padStart(2, "0");

/** HH:MM:SS */
export function formatHMS(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** 04h 32m (leaderboard) */
export function formatHM(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  return `${pad(Math.floor(mins / 60))}h ${pad(mins % 60)}m`;
}
