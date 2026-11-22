import { SessionTimer } from "./SessionTimer";
import { VideoView } from "./VideoView";
import type { JoinForm } from "../utils/validation";

interface Props { info: JoinForm; timerText: string; stream: MediaStream | null; error: string | null; cols: number; onLeave: () => void; }

export function OwnStudyTile({ info, timerText, stream, error, cols, onLeave }: Props) {
  return (
    <article className="card enter flex flex-col overflow-hidden rounded-2xl border-2 !border-brass" style={{ gridColumn: `span ${Math.min(2, cols)}`, gridRow: `span ${cols >= 2 ? 2 : 1}` }} data-testid="own-tile">
      <div className="relative aspect-video overflow-hidden bg-sunken">
        <VideoView stream={stream} mirror />
        <span className="absolute left-2.5 top-2.5 rounded-full bg-brass px-2.5 py-0.5 text-xs font-bold tracking-wide text-brand-ink">YOU</span>
        {error && <div className="absolute inset-x-0 bottom-0 bg-danger/95 p-2 text-xs text-white" role="alert">{error}</div>}
      </div>
      <div className="space-y-2 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-serif text-lg font-semibold leading-tight">{info.name}</div>
            <div className="truncate text-xs text-muted">{info.title}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5 text-xs text-muted"><span className="live-dot h-2 w-2 rounded-full bg-live" />Studying for</div>
            <SessionTimer text={timerText} className="text-2xl font-bold" />
          </div>
        </div>
        <div className="break-words text-sm [overflow-wrap:anywhere]">{info.description}</div>
        <button onClick={onLeave} data-testid="leave-button" className="btn btn-danger w-full">LEAVE</button>
      </div>
    </article>
  );
}
