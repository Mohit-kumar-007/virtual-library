import { describe, expect, it } from "vitest";
import { MAX_VIDEO_TILES, visibleParticipants } from "./StudyGrid";
import type { Participant } from "../types/participant";

/** n people, oldest first (ids s0..s{n-1}). */
const room = (n: number): Participant[] =>
  Array.from({ length: n }, (_, i) => ({ sessionId: `s${i}`, displayName: `P${i}`, title: "t", description: "d", joinedAt: 1000 + i, connectionState: "connected", mediaState: "publishing" }));
const ids = (list: Participant[]) => list.map((p) => p.sessionId);

describe("visibleParticipants", () => {
  it("shows everyone while the room is small", () => {
    const r = visibleParticipants(room(10), "s3");
    expect(r.shown).toHaveLength(9);
    expect(r.hidden).toHaveLength(0);
    expect(ids(r.shown)).not.toContain("s3"); // never your own tile twice
  });
  it("shows a visitor who has not joined yet the oldest 30", () => {
    const r = visibleParticipants(room(100), undefined);
    expect(ids(r.shown)).toEqual(ids(room(30)));
    expect(r.hidden).toHaveLength(70);
  });
  it("shows someone in the middle about 15 older and 15 newer neighbours", () => {
    const r = visibleParticipants(room(100), "s50");
    expect(r.shown).toHaveLength(MAX_VIDEO_TILES);
    expect(ids(r.shown)).toContain("s35");
    expect(ids(r.shown)).toContain("s65");
    expect(ids(r.shown)).not.toContain("s34");
    expect(ids(r.shown)).not.toContain("s66");
    expect(r.hidden).toHaveLength(100 - 1 - MAX_VIDEO_TILES);
  });
  it("lets the newest person see the newest 30, and the oldest see the oldest", () => {
    expect(ids(visibleParticipants(room(100), "s99").shown)).toEqual(ids(room(99).slice(69)));
    expect(ids(visibleParticipants(room(100), "s0").shown)).toEqual(ids(room(31).slice(1)));
  });
  it("leaves nobody invisible: in a room of 100 every person is seen by at least 15 others", () => {
    const people = room(100), seenBy = new Map<string, number>();
    for (const viewer of people) for (const p of visibleParticipants(people, viewer.sessionId).shown) seenBy.set(p.sessionId, (seenBy.get(p.sessionId) ?? 0) + 1);
    expect(people.every((p) => (seenBy.get(p.sessionId) ?? 0) >= 15)).toBe(true);
  });
});
