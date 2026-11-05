import { useState } from "react";
import type { RemoteTrack } from "livekit-client";
import type { Participant } from "../types/participant";
import { SessionTimer } from "./SessionTimer";
import { VideoView } from "./VideoView";
import { api } from "../services/api";

interface Props { p: Participant; timerText: string; track?: RemoteTrack; }

export function StudyTile({ p, timerText, track }: Props) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const reconnecting = p.connectionState !== "connected";
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-[#18211c]" data-testid="tile" data-session={p.sessionId}>
      <div className="relative aspect-video bg-neutral-800">
        {track ? <VideoView track={track} /> : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-semibold text-white/70">{p.displayName.slice(0, 1).toUpperCase()}</div>
        )}
        {reconnecting && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">Reconnecting…</div>}
        <button onClick={async () => { if (!reported && confirm(`Report ${p.displayName} for inappropriate content?`)) { await api.report(p.sessionId).catch(() => {}); setReported(true); } }}
          className="absolute right-1 top-1 hidden rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white group-hover:block focus:block" aria-label={`Report ${p.displayName}`}>
          {reported ? "Reported" : "Report"}
        </button>
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="px-2.5 py-2 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-semibold" data-testid="tile-name">{p.displayName}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs"><span className="live-dot h-1.5 w-1.5 rounded-full bg-live" /><SessionTimer text={timerText} /></span>
        </div>
        <div className="truncate text-xs opacity-70">{p.title}</div>
        <div className={`text-xs opacity-90 ${open ? "" : "truncate"}`}>{p.description}</div>
      </button>
    </article>
  );
}
