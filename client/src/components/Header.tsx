import { ActiveCount } from "./ActiveCount";
import { SessionTimer } from "./SessionTimer";
import { IconClock, IconMoon, IconSun, IconTrophy, LogoMark } from "./Icons";

interface Props {
  count: number; joined: boolean; timerText: string; leaderboardOpen: boolean; dark: boolean;
  onToggleLeaderboard: () => void; onToggleDark: () => void; onJoin: () => void; onLeave: () => void;
}

export function Header(p: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1800px] h-14 items-center gap-3 px-3 sm:gap-5 sm:px-5">
        <a href="/" className="flex items-center gap-2.5 rounded-md" aria-label="Virtual Library home">
          <LogoMark />
          <span className="hidden font-serif text-xl font-semibold tracking-tight sm:inline">Virtual Library</span>
        </a>
        <ActiveCount count={p.count} />
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button onClick={p.onToggleLeaderboard} aria-pressed={p.leaderboardOpen} data-testid="leaderboard-toggle"
            className={`btn btn-ghost px-2.5 py-1.5 ${p.leaderboardOpen ? "bg-brass-soft text-brass" : ""}`}>
            <IconTrophy /><span className="hidden sm:inline">Leaderboard</span>
          </button>
          <button onClick={p.onToggleDark} aria-label="Toggle dark mode" data-testid="dark-toggle" className="btn btn-ghost px-2 py-1.5">
            {p.dark ? <IconSun /> : <IconMoon />}
          </button>
          {p.joined ? (
            <>
              <div className="hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted md:flex">
                <IconClock /><SessionTimer text={p.timerText} className="font-semibold text-ink" />
              </div>
              <button onClick={p.onLeave} data-testid="header-leave" className="btn btn-danger">Leave</button>
            </>
          ) : (
            <button onClick={p.onJoin} data-testid="join-button" className="btn btn-primary px-5 tracking-wide">JOIN</button>
          )}
        </div>
      </div>
    </header>
  );
}
