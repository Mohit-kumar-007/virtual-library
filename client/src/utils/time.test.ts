import { describe, expect, it } from "vitest";
import { formatHM, formatHMS } from "./time";
import { validateJoin } from "./validation";

describe("time", () => {
  it("formats HH:MM:SS", () => {
    expect(formatHMS(0)).toBe("00:00:00");
    expect(formatHMS(2 * 3600e3 + 14 * 60e3 + 36e3)).toBe("02:14:36");
    expect(formatHMS(-5)).toBe("00:00:00");
  });
  it("formats leaderboard", () => expect(formatHM(4 * 3600e3 + 32 * 60e3)).toBe("04h 32m"));
});
describe("validation", () => {
  it("requires fields and limits length", () => {
    expect(Object.keys(validateJoin({ name: "", title: " ", description: "x" }))).toEqual(["name", "title"]);
    expect(validateJoin({ name: "a", title: "b", description: "c".repeat(161) }).description).toBeTruthy();
    expect(validateJoin({ name: "a", title: "b", description: "c" })).toEqual({});
  });
});
