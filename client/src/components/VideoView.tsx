import { useEffect, useRef } from "react";
import type { RemoteTrack } from "livekit-client";

/** Renders either a local MediaStream or a LiveKit remote track. Always muted (no audio in MVP). */
export function VideoView({ stream, track, mirror = false }: { stream?: MediaStream | null; track?: RemoteTrack; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (stream) { el.srcObject = stream; void el.play().catch(() => {}); return () => { el.srcObject = null; }; }
    if (track) { track.attach(el); return () => { track.detach(el); }; }
  }, [stream, track]);
  return <video ref={ref} muted playsInline autoPlay className={`h-full w-full object-cover ${mirror ? "-scale-x-100" : ""}`} data-testid="video" />;
}
