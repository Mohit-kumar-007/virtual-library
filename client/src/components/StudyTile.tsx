import { useState } from "react";
import type { RemoteTrack } from "livekit-client";
import type { Participant } from "../types/participant";
import { SessionTimer } from "./SessionTimer";
import { VideoView } from "./VideoView";
import { IconFlag } from "./Icons";
import { api } from "../services/api";

interface Props { p: Participant; timerText: string; track?: RemoteTrack; }

export function StudyTile({ p, timerText, track }: Props) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const reconnecting = p.connectionState !== "connected";
  return (
    <article className="card tile-lift enter group relative flex flex-col overflow-hidden rounded-xl" data-testid="tile" data-session={p.sessionId}>
      <div className="relative aspect-video overflow-hidden bg-sunken">
        <div className="tile-video h-full w-full">
          {track ? <VideoView track={track} /> : (
            <div className="flex h-full w-full items-center justify-center bg-brand/90 font-serif text-4xl font-semibold text-brand-ink">{p.displayName.slice(0, 1).toUpperCase()}</div>
          )}
        </div>
        {reconnecting && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white">Reconnecting…</div>}
        <button onClick={async () => { if (!reported && confirm(`Report ${p.displayName} for inappropriate content?`)) { await api.report(p.sessionId).catch(() => {}); setReported(true); } }}
          className={`absolute right-1.5 top-1.5 items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-[10px] text-white ${open ? "flex" : "hidden group-hover:flex focus:flex"}`} aria-label={`Report ${p.displayName}`}>
          <IconFlag />{reported ? "Reported" : "Report"}
        </button>
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="px-3 py-2.5 text-left">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <span className="max-w-full truncate font-serif text-base font-semibold" data-testid="tile-name" title={p.displayName}>{p.displayName}</span>
          <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted"><span className="live-dot h-1.5 w-1.5 rounded-full bg-live" /><SessionTimer text={timerText} /></span>
        </div>
        <div className="truncate text-xs text-muted">{p.title}</div>
        <div className={`text-xs ${open ? "break-words [overflow-wrap:anywhere]" : "truncate"}`}>{p.description}</div>
      </button>
    </article>
  );
}
