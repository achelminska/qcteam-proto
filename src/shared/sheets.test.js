import { describe, it, expect } from "vitest";
import { sheetKind, sheetPurposeName, sheetFreshness, mergeSheetFresh, metaSheets, stampUnchangedPush } from "./sheets.js";

describe("sheetKind", () => {
  it("maps blocked aliases onto the same bucket as /sheet/blocked", () => {
    expect(sheetKind("blocked")).toBe("blocked");
    expect(sheetKind("blocked-pallets")).toBe("blocked");
    expect(sheetKind("BlockedPallets")).toBe("blocked");
    expect(sheetKind("block")).toBe("blocked");
    expect(sheetPurposeName("blocked")).toBe("Blocked");
  });
  it("maps dock aliases and leaves unknown names as-is", () => {
    expect(sheetKind("docks")).toBe("dock");
    expect(sheetKind("products")).toBe("products");
    expect(sheetKind("mystery")).toBe("mystery");
  });
});

describe("sheetFreshness", () => {
  const s = {
    integrations: [
      { purpose: "Dock", lastPushAt: "2026-09-30T08:40:00.000Z" },
      { purpose: "Blocked", lastPushAt: "2026-09-29T19:30:00.000Z" },
    ],
  };
  it("uses lastPushAt when /meta has nothing newer", () => {
    const fr = sheetFreshness(s, {});
    expect(fr.find(x => x.purpose === "Blocked").at).toBe("2026-09-29T19:30:00.000Z");
  });
  it("prefers a live /meta timestamp so an unchanged blocked push still reads as fresh", () => {
    const fr = sheetFreshness(s, { blocked: "2026-09-30T08:45:00.000Z", dock: "2026-09-30T08:40:00.000Z" });
    expect(fr.find(x => x.purpose === "Blocked").at).toBe("2026-09-30T08:45:00.000Z");
    expect(fr.find(x => x.purpose === "Dock").at).toBe("2026-09-30T08:40:00.000Z");
  });
});

describe("mergeSheetFresh", () => {
  it("keeps a blocked timestamp when the next /meta payload only has dock", () => {
    const next = mergeSheetFresh({ blocked: "2026-09-30T08:00:00.000Z", dock: "2026-09-30T07:00:00.000Z" }, { dock: "2026-09-30T08:40:00.000Z" });
    expect(next.blocked).toBe("2026-09-30T08:00:00.000Z");
    expect(next.dock).toBe("2026-09-30T08:40:00.000Z");
  });
});

describe("metaSheets", () => {
  it("collapses alias keys onto the canonical kind", () => {
    const sheets = metaSheets({
      dock: { receivedAt: "2026-09-30T08:40:00.000Z" },
      "blocked-pallets": { receivedAt: "2026-09-30T08:45:00.000Z" },
    });
    expect(sheets.blocked).toBe("2026-09-30T08:45:00.000Z");
    expect(sheets.dock).toBe("2026-09-30T08:40:00.000Z");
  });
});

describe("stampUnchangedPush", () => {
  it("writes lastPushAt without touching rows", () => {
    const stored = {
      integrations: [{ id: "b1", purpose: "Blocked", rows: [{ article: "1" }], lastPushAt: "2026-09-29T07:12:06.000Z", liveStatus: "old" }],
    };
    const next = [{ id: "b1", purpose: "Blocked", rows: [{ article: "1" }], lastPushAt: "2026-09-30T08:45:00.000Z", liveStatus: "OK — 0 rows", lastSyncAt: "2026-09-30T08:45:00.000Z" }];
    const out = stampUnchangedPush(stored, next, new Set(["b1"]));
    expect(out.integrations[0].lastPushAt).toBe("2026-09-30T08:45:00.000Z");
    expect(out.integrations[0].rows).toEqual([{ article: "1" }]);
  });
});
