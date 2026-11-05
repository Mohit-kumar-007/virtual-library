import { SessionTimer } from "./SessionTimer";
import { VideoView } from "./VideoView";
import type { JoinForm } from "../utils/validation";

interface Props { info: JoinForm; timerText: string; stream: MediaStream | null; error: string | null; onLeave: () => void; }

export function OwnStudyTile({ info, timerText, stream, error, onLeave }: Props) {
  return (
    <article className="col-span-2 flex flex-col overflow-hidden rounded-xl border-2 border-live bg-white shadow-md dark:bg-[#18211c]" data-testid="own-tile">
      <div className="relative aspect-video bg-neutral-800">
        <VideoView stream={stream} mirror />
        <span className="absolute left-2 top-2 rounded bg-live px-2 py-0.5 text-xs font-bold text-white">YOU</span>
        {error && <div className="absolute inset-x-0 bottom-0 bg-red-700/90 p-2 text-xs text-white" role="alert">{error}</div>}
      </div>
      <div className="space-y-1 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-semibold">{info.name}</div>
            <div className="truncate text-xs opacity-70">{info.title}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-1.5 text-xs opacity-80"><span className="live-dot h-2 w-2 rounded-full bg-live" />Studying for</div>
            <SessionTimer text={timerText} className="text-2xl font-bold" />
          </div>
        </div>
        <div className="text-xs">{info.description}</div>
        <button onClick={onLeave} data-testid="leave-button" className="mt-1 w-full rounded-md bg-red-600 py-1.5 text-sm font-semibold text-white hover:bg-red-700">LEAVE</button>
      </div>
    </article>
  );
}
