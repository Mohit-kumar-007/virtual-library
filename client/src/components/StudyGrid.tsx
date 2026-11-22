import { useRef } from "react";
import type { Participant, MySession } from "../types/participant";
import type { JoinForm } from "../utils/validation";
import type { RemoteTrack } from "livekit-client";
import { StudyTile } from "./StudyTile";
import { OwnStudyTile } from "./OwnStudyTile";
import { ShelfIllustration } from "./Icons";
import { formatHMS } from "../utils/time";
import { useGridColumns } from "../hooks/useGridColumns";
import { maxTileWidth } from "../utils/gridLayout";

/** Max participants rendered as full tiles (PRD §9/§23: never render unlimited video elements). */
export const MAX_VIDEO_TILES = 30;

interface Props {
  participants: Participant[]; me: MySession | null; myInfo: JoinForm | null; localStream: MediaStream | null;
  mediaError: string | null; now: number; serverOffset: number; tracks: Map<string, RemoteTrack>;
  onJoin: () => void; onLeave: () => void;
}

/**
 * Who gets a tile. Up to MAX_VIDEO_TILES others are shown. In a bigger room each person sees the people closest
 * to them in join order (about half older, half newer) instead of everyone seeing the same oldest 30 - otherwise
 * everyone past the first 30 would be invisible to the whole room. People who have not joined yet see the oldest 30.
 * `all` is sorted by join time.
 */
export function visibleParticipants(all: Participant[], meId: string | undefined) {
  const others = all.filter((p) => p.sessionId !== meId);
  if (others.length <= MAX_VIDEO_TILES) return { shown: others, hidden: [] as Participant[] };
  const myRank = meId ? all.findIndex((p) => p.sessionId === meId) : -1;
  const start = myRank < 0 ? 0 : Math.min(Math.max(myRank - Math.floor(MAX_VIDEO_TILES / 2), 0), others.length - MAX_VIDEO_TILES);
  return { shown: others.slice(start, start + MAX_VIDEO_TILES), hidden: [...others.slice(0, start), ...others.slice(start + MAX_VIDEO_TILES)] };
}

export function StudyGrid(p: Props) {
  const { shown, hidden } = visibleParticipants(p.participants, p.me?.sessionId);
  const timer = (j: number) => formatHMS(p.now + p.serverOffset - j);
  const empty = shown.length === 0 && !p.me;
  const gridRef = useRef<HTMLDivElement>(null);
  const hasOwn = Boolean(p.me && p.myInfo);
  const cols = useGridColumns(gridRef, shown.length, hasOwn); // tiles grow for small groups and shrink as more join

  if (empty) {
    return (
      <div className="enter flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center" data-testid="empty-library">
        <ShelfIllustration />
        <h2 className="font-serif text-3xl font-semibold tracking-tight">The library is quiet right now</h2>
        <p className="max-w-md text-muted">Be the first one here. Others will join you — everyone studying silently, together.</p>
        <button onClick={p.onJoin} className="btn btn-primary px-8 py-2.5 text-base tracking-wide">JOIN</button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5">
      <div ref={gridRef} className="grid items-start justify-center gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, ${maxTileWidth(hasOwn)}px))` }} data-testid="grid">
        {p.me && p.myInfo && (
          <OwnStudyTile info={p.myInfo} timerText={timer(p.me.joinedAt)} stream={p.localStream} error={p.mediaError} cols={cols} onLeave={p.onLeave} />
        )}
        {shown.map((x) => <StudyTile key={x.sessionId} p={x} timerText={timer(x.joinedAt)} track={p.tracks.get(x.sessionId)} />)}
      </div>
      {hidden.length > 0 && (
        <p className="mt-4 text-center text-sm text-muted" data-testid="hidden-count">
          +{hidden.length} more studying quietly: {hidden.slice(0, 12).map((h) => h.displayName).join(", ")}{hidden.length > 12 ? "…" : ""}
        </p>
      )}
      <p className="mt-8 text-center font-serif text-sm italic text-muted">Silent room · no chat · no audio · video isn't recorded</p>
    </div>
  );
}
