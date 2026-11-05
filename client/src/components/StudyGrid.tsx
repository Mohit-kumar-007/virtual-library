import type { Participant, MySession } from "../types/participant";
import type { JoinForm } from "../utils/validation";
import type { RemoteTrack } from "livekit-client";
import { StudyTile } from "./StudyTile";
import { OwnStudyTile } from "./OwnStudyTile";
import { formatHMS } from "../utils/time";

/** Max participants rendered as full tiles (PRD §9/§23: never render unlimited video elements). */
export const MAX_VIDEO_TILES = 30;

interface Props {
  participants: Participant[]; me: MySession | null; myInfo: JoinForm | null; localStream: MediaStream | null;
  mediaError: string | null; now: number; serverOffset: number; tracks: Map<string, RemoteTrack>;
  onJoin: () => void; onLeave: () => void;
}

export function visibleParticipants(all: Participant[], meId: string | undefined) {
  const others = all.filter((p) => p.sessionId !== meId);
  return { shown: others.slice(0, MAX_VIDEO_TILES), hidden: others.slice(MAX_VIDEO_TILES) };
}

export function StudyGrid(p: Props) {
  const { shown, hidden } = visibleParticipants(p.participants, p.me?.sessionId);
  const timer = (j: number) => formatHMS(p.now + p.serverOffset - j);
  const empty = shown.length === 0 && !p.me;

  if (empty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center" data-testid="empty-library">
        <div className="text-5xl" aria-hidden>📖</div>
        <h2 className="font-serif text-2xl font-semibold">The library is quiet right now</h2>
        <p className="max-w-md opacity-70">Be the first one here. Others will join you — everyone studying silently, together.</p>
        <button onClick={p.onJoin} className="rounded-md bg-live px-6 py-2.5 font-bold text-white shadow hover:bg-green-700">JOIN</button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5">
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" data-testid="grid">
        {p.me && p.myInfo && (
          <OwnStudyTile info={p.myInfo} timerText={timer(p.me.joinedAt)} stream={p.localStream} error={p.mediaError} onLeave={p.onLeave} />
        )}
        {shown.map((x) => <StudyTile key={x.sessionId} p={x} timerText={timer(x.joinedAt)} track={p.tracks.get(x.sessionId)} />)}
      </div>
      {hidden.length > 0 && (
        <p className="mt-4 text-center text-sm opacity-70" data-testid="hidden-count">
          +{hidden.length} more studying quietly: {hidden.slice(0, 12).map((h) => h.displayName).join(", ")}{hidden.length > 12 ? "…" : ""}
        </p>
      )}
      <p className="mt-8 text-center text-xs opacity-50">Silent room · no chat · no audio · video isn't recorded</p>
    </div>
  );
}
