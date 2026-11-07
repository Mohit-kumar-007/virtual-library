import type { Participant } from "../types/participant";
import { formatHM } from "../utils/time";
import { IconClose } from "./Icons";

interface Props { participants: Participant[]; meId?: string; now: number; serverOffset: number; onClose: () => void; }

export function Leaderboard({ participants, meId, now, serverOffset, onClose }: Props) {
  const rows = [...participants].sort((a, b) => a.joinedAt - b.joinedAt); // earlier join = longer continuous session
  return (
    <aside className="enter fixed inset-y-0 right-0 z-30 flex w-72 max-w-[85vw] flex-col border-l border-line bg-surface shadow-card lg:sticky lg:top-[57px] lg:z-10 lg:h-[calc(100vh-57px)] lg:shadow-none" data-testid="leaderboard" aria-label="Current session leaderboard">
      <div className="flex items-center justify-between border-b border-line p-4">
        <div>
          <h2 className="font-serif text-lg font-semibold">Current sessions</h2>
          <p className="text-xs text-muted">Only people studying right now</p>
        </div>
        <button onClick={onClose} aria-label="Close leaderboard" className="btn btn-ghost p-1.5"><IconClose /></button>
      </div>
      <ol className="flex-1 overflow-auto p-2">
        {rows.length === 0 && <li className="p-3 text-sm text-muted">Nobody is studying yet.</li>}
        {rows.map((r, i) => (
          <li key={r.sessionId} data-testid="leaderboard-row"
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${r.sessionId === meId ? "bg-brass-soft font-semibold" : ""}`}>
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs tabnum ${i === 0 ? "bg-brass text-brand-ink font-bold" : "bg-sunken text-muted"}`}>{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{r.displayName}</span>
            <span className="tabnum text-muted">{formatHM(now + serverOffset - r.joinedAt)}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
