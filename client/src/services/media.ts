import {
  Room, RoomEvent, Track, VideoQuality,
  type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant,
} from "livekit-client";

export type VideoTrackMap = Map<string, RemoteTrack>;

/** Wraps LiveKit: publishes one camera track, subscribes to a bounded set of remote video tracks. */
export class MediaConnection {
  private room: Room;
  private wanted = new Set<string>();
  private listeners = new Set<() => void>();
  tracks: VideoTrackMap = new Map();

  constructor() {
    this.room = new Room({ adaptiveStream: true, dynacast: true });
    const refresh = () => { this.applySubscriptions(); };
    this.room
      .on(RoomEvent.TrackPublished, refresh)
      .on(RoomEvent.ParticipantConnected, refresh)
      .on(RoomEvent.TrackSubscribed, (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (t.kind !== Track.Kind.Video) return;
        pub.setVideoQuality(VideoQuality.LOW); // tiles are small
        this.tracks = new Map(this.tracks).set(p.identity, t);
        this.emit();
      })
      .on(RoomEvent.TrackUnsubscribed, (t: RemoteTrack, _pub: RemoteTrackPublication, p: RemoteParticipant) => {
        if (this.tracks.get(p.identity) !== t) return;
        const m = new Map(this.tracks); m.delete(p.identity); this.tracks = m; this.emit();
      })
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        const m = new Map(this.tracks); m.delete(p.identity); this.tracks = m; this.emit();
      });
  }

  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private emit() { this.listeners.forEach((f) => f()); }

  get state() { return this.room.state; }
  onDisconnected(fn: () => void) { this.room.on(RoomEvent.Disconnected, fn); }

  async connect(url: string, token: string, camera: MediaStreamTrack) {
    await this.room.connect(url, token);
    await this.room.localParticipant.publishTrack(camera, { source: Track.Source.Camera, simulcast: true, name: "camera" });
    this.applySubscriptions();
  }

  /** Adaptive subscription: only subscribe to videos we render (see MAX_VIDEO_TILES). */
  setWanted(ids: string[]) { this.wanted = new Set(ids); this.applySubscriptions(); }

  private applySubscriptions() {
    this.room.remoteParticipants.forEach((p) => {
      p.trackPublications.forEach((pub) => {
        if (pub.kind !== Track.Kind.Video) return;
        const want = this.wanted.has(p.identity);
        if (want !== pub.isSubscribed) pub.setSubscribed(want);
      });
    });
  }

  async disconnect() {
    this.listeners.clear();
    this.tracks = new Map();
    await this.room.disconnect(true).catch(() => {});
  }
}
