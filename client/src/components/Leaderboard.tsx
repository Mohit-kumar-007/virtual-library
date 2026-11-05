import type { Participant } from "../types/participant";
import { formatHM } from "../utils/time";

interface Props { participants: Participant[]; meId?: string; now: number; serverOffset: number; onClose: () => void; }

export function Leaderboard({ participants, meId, now, serverOffset, onClose }: Props) {
  const rows = [...participants].sort((a, b) => a.joinedAt - b.joinedAt); // earlier join = longer continuous session
  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-72 max-w-[85vw] flex-col border-l border-black/10 bg-white shadow-xl dark:border-white/10 dark:bg-[#141b17] lg:sticky lg:top-[53px] lg:z-10 lg:h-[calc(100vh-53px)] lg:shadow-none" data-testid="leaderboard" aria-label="Current session leaderboard">
      <div className="flex items-center justify-between border-b border-black/10 p-3 dark:border-white/10">
        <div>
          <h2 className="font-serif font-semibold">Current sessions</h2>
          <p className="text-xs opacity-60">Only people studying right now</p>
        </div>
        <button onClick={onClose} aria-label="Close leaderboard" className="rounded p-1 hover:bg-black/5 dark:hover:bg-white/10">✕</button>
      </div>
      <ol className="flex-1 overflow-auto p-2">
        {rows.length === 0 && <li className="p-3 text-sm opacity-60">Nobody is studying yet.</li>}
        {rows.map((r, i) => (
          <li key={r.sessionId} data-testid="leaderboard-row" className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${r.sessionId === meId ? "bg-live/15 font-semibold" : ""}`}>
            <span className="w-5 text-right tabnum opacity-60">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{r.displayName}</span>
            <span className="tabnum opacity-80">{formatHM(now + serverOffset - r.joinedAt)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
