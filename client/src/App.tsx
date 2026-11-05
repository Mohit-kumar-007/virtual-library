import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "./components/Header";
import { JoinModal } from "./components/JoinModal";
import { StudyGrid, visibleParticipants } from "./components/StudyGrid";
import { Leaderboard } from "./components/Leaderboard";
import { LegalModal } from "./components/LegalModal";
import { useRoom } from "./hooks/useRoom";
import { useNow } from "./hooks/useNow";
import { useRemoteTracks } from "./hooks/useMedia";
import { useSessionTimer } from "./hooks/useSessionTimer";

const safe = {
  get: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

export default function App() {
  const room = useRoom();
  const now = useNow();
  const tracks = useRemoteTracks(room.conn);
  const [showJoin, setShowJoin] = useState(false);
  const [legal, setLegal] = useState<null | "terms" | "privacy">(null);
  const [leaderboard, setLeaderboard] = useState(false);
  const [dark, setDark] = useState(() => safe.get("theme") ? safe.get("theme") === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); safe.set("theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { if (room.phase === "joined") setShowJoin(false); }, [room.phase]);

  // Adaptive subscriptions: only subscribe to videos we actually render.
  const meId = room.me?.sessionId;
  const wantedKey = useMemo(() => visibleParticipants(room.participants, meId).shown.map((p) => p.sessionId).join(","), [room.participants, meId]);
  useEffect(() => { room.conn?.setWanted(wantedKey ? wantedKey.split(",") : []); }, [room.conn, wantedKey, room.participants.length]);

  const timer = useSessionTimer(room.me?.joinedAt, now, room.serverOffset);
  const openJoin = useCallback(() => setShowJoin(true), []);

  return (
    <div className="flex min-h-full flex-col">
      <Header count={room.count} joined={room.phase === "joined"} timerText={timer.text} leaderboardOpen={leaderboard} dark={dark}
        onToggleLeaderboard={() => setLeaderboard((v) => !v)} onToggleDark={() => setDark((d) => !d)} onJoin={openJoin} onLeave={room.leave} />

      {!room.online && (
        <div className="bg-red-600 px-4 py-1.5 text-center text-sm text-white" role="status" data-testid="offline-banner">
          {room.phase === "joined" ? "Connection lost — reconnecting. Your session is kept for a short while." : "Library server unavailable. Retrying…"}
        </div>
      )}
      {room.notice && (
        <div className="flex items-center justify-center gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-900" role="status" data-testid="notice">
          {room.notice}<button onClick={room.dismissNotice} className="underline">Dismiss</button>
        </div>
      )}
      {room.mockMedia && room.phase === "joined" && (
        <div className="bg-sky-100 px-4 py-1.5 text-center text-xs text-sky-900" data-testid="mock-banner">
          Demo mode: video server not configured — other participants' video isn't streamed. Presence and timers are live.
        </div>
      )}

      <div className="flex flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <StudyGrid participants={room.participants} me={room.me} myInfo={room.myName} localStream={room.localStream}
            mediaError={room.mediaError} now={now} serverOffset={room.serverOffset} tracks={tracks} onJoin={openJoin} onLeave={room.leave} />
        </main>
        {leaderboard && <Leaderboard participants={room.participants} meId={meId} now={now} serverOffset={room.serverOffset} onClose={() => setLeaderboard(false)} />}
      </div>

      <footer className="px-4 py-3 text-center text-xs opacity-60">
        <button className="underline" onClick={() => setLegal("terms")}>Terms</button> · <button className="underline" onClick={() => setLegal("privacy")}>Privacy</button>
      </footer>

      {showJoin && room.phase !== "joined" && <JoinModal phase={room.phase} onSubmit={room.join} onClose={() => setShowJoin(false)} serverDown={!room.online} />}
      {legal && <LegalModal kind={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
