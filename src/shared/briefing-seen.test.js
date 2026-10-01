import { describe, expect, it } from "vitest";
import { adoptLocalBriefingSeen, briefingFp, briefingSeenId, markBriefingSeen, seenFingerprints } from "./briefing-seen.js";

describe("briefingFp", () => {
  it("keys a rejection, a note, and a complaint count", () => {
    expect(briefingFp({ kind: "ann", a: { id: "n1" } })).toBe("ann:n1");
    expect(briefingFp({ kind: "rej", i: { id: "r1" } })).toBe("rej:r1");
    expect(briefingFp({ kind: "complaint", c: { id: "c1", count: 4, updatedAt: "t" } })).toBe("comp:c1:4:t");
    expect(briefingFp(null)).toBe(null);
  });
});

describe("markBriefingSeen", () => {
  it("stores one record per user and fingerprint in the shared list", () => {
    const once = markBriefingSeen({ briefingSeen: [] }, "u-anna", "rej:r1", "2026-10-01T12:00:00.000Z");
    expect(once.briefingSeen).toEqual([{ id: "u-anna:rej:r1", userId: "u-anna", fp: "rej:r1", at: "2026-10-01T12:00:00.000Z" }]);
    expect(markBriefingSeen(once, "u-anna", "rej:r1", "later")).toBe(once);
    const two = markBriefingSeen(once, "u-head", "rej:r1", "t");
    expect(seenFingerprints(two, "u-anna").has("rej:r1")).toBe(true);
    expect(seenFingerprints(two, "u-head").has("rej:r1")).toBe(true);
    expect(briefingSeenId("u-anna", "rej:r1")).toBe("u-anna:rej:r1");
  });

  it("drops this user's stale fingerprints when a live set is passed", () => {
    const start = {
      briefingSeen: [
        { id: "u-anna:rej:old", userId: "u-anna", fp: "rej:old", at: "a" },
        { id: "u-head:rej:old", userId: "u-head", fp: "rej:old", at: "a" },
      ],
    };
    const next = markBriefingSeen(start, "u-anna", "rej:new", "b", ["rej:new"]);
    expect(next.briefingSeen.map(r => r.id).sort()).toEqual(["u-anna:rej:new", "u-head:rej:old"]);
  });
});

describe("adoptLocalBriefingSeen", () => {
  it("moves a device list into the shared document without duplicates", () => {
    const s = adoptLocalBriefingSeen({ briefingSeen: [] }, "u-anna", ["ann:n1", "ann:n1", "rej:r1", 12, null], "t");
    expect(s.briefingSeen.map(r => r.fp).sort()).toEqual(["ann:n1", "rej:r1"]);
  });
});
