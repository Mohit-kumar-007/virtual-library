import { ActiveCount } from "./ActiveCount";
import { SessionTimer } from "./SessionTimer";

interface Props {
  count: number; joined: boolean; timerText: string; leaderboardOpen: boolean; dark: boolean;
  onToggleLeaderboard: () => void; onToggleDark: () => void; onJoin: () => void; onLeave: () => void;
}

export function Header(p: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-paper/90 backdrop-blur dark:border-white/10 dark:bg-[#0f1512]/90">
      <div className="mx-auto flex max-w-[1800px] items-center gap-3 px-3 py-2.5 sm:gap-5 sm:px-5">
        <a href="/" className="flex items-center gap-2 font-serif text-lg font-semibold" aria-label="Virtual Library home">
          <span aria-hidden>📚</span><span className="hidden sm:inline">Virtual Library</span>
        </a>
        <ActiveCount count={p.count} />
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button onClick={p.onToggleLeaderboard} aria-pressed={p.leaderboardOpen} data-testid="leaderboard-toggle"
            className={`rounded-md px-2.5 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10 ${p.leaderboardOpen ? "bg-black/10 dark:bg-white/15" : ""}`}>
            🏆 <span className="hidden sm:inline">Leaderboard</span>
          </button>
          <button onClick={p.onToggleDark} aria-label="Toggle dark mode" data-testid="dark-toggle"
            className="rounded-md px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">{p.dark ? "☀️" : "🌙"}</button>
          {p.joined ? (
            <>
              <div className="hidden items-center gap-1.5 text-sm md:flex">⏱ <SessionTimer text={p.timerText} className="font-semibold" /></div>
              <button onClick={p.onLeave} data-testid="header-leave" className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700">Leave</button>
            </>
          ) : (
            <button onClick={p.onJoin} data-testid="join-button" className="rounded-md bg-live px-4 py-1.5 text-sm font-bold tracking-wide text-white shadow hover:bg-green-700">JOIN</button>
          )}
        </div>
      </div>
    </header>
  );
}
