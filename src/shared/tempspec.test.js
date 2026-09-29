import { describe, expect, it } from "vitest";
import { activeTempForSpec, applyTempSpec, clearTempSpec, closeExpiredTempSpecs, tempSpecIsActive, tempUntilLabel, todayISO, upsertTempSpec } from "./tempspec.js";

const NOW = new Date("2026-09-29T10:00:00.000Z");

const row = (over = {}) => ({
  id: "t1", specId: "s-firm", specName: "Firmness", ownerKind: "category", ownerId: "cat-apples",
  min: "4", max: "6", unit: "Lb", note: "softer this week", expiresAt: "2026-10-15",
  createdAt: "2026-09-29T08:00:00.000Z", createdBy: "u-head",
  endedAt: null, endedHow: null, endedBy: null,
  ...over,
});

describe("todayISO", () => {
  it("formats a local calendar day", () => {
    expect(todayISO(new Date(2026, 8, 29, 8, 0, 0))).toBe("2026-09-29");
  });
});

describe("tempSpecIsActive", () => {
  it("is live when open-ended or the date is still ahead", () => {
    expect(tempSpecIsActive(row({ expiresAt: null }), "2026-09-29")).toBe(true);
    expect(tempSpecIsActive(row({ expiresAt: "2026-09-29" }), "2026-09-29")).toBe(true);
    expect(tempSpecIsActive(row({ expiresAt: "2026-10-01" }), "2026-09-29")).toBe(true);
  });
  it("is off after the date or once ended", () => {
    expect(tempSpecIsActive(row({ expiresAt: "2026-09-28" }), "2026-09-29")).toBe(false);
    expect(tempSpecIsActive(row({ endedAt: "2026-09-29T09:00:00.000Z" }), "2026-09-29")).toBe(false);
  });
});

describe("closeExpiredTempSpecs", () => {
  it("marks dated rows ended and leaves open-ended ones alone", () => {
    const dated = row({ id: "a", expiresAt: "2026-09-28" });
    const open = row({ id: "b", expiresAt: null });
    const next = closeExpiredTempSpecs([dated, open], NOW);
    expect(next.find(t => t.id === "a")).toMatchObject({ endedHow: "expired", endedBy: null });
    expect(next.find(t => t.id === "b").endedAt).toBe(null);
  });
  it("returns the same array when nothing expired", () => {
    const list = [row({ expiresAt: "2026-10-01" })];
    expect(closeExpiredTempSpecs(list, NOW)).toBe(list);
  });
});

describe("activeTempForSpec", () => {
  it("prefers a product override over the category one", () => {
    const cat = row({ id: "c", ownerKind: "category", ownerId: "cat", min: "5" });
    const prod = row({ id: "p", ownerKind: "product", ownerId: "prod-1", min: "3" });
    expect(activeTempForSpec([cat, prod], "s-firm", "prod-1", "2026-09-29").id).toBe("p");
    expect(activeTempForSpec([cat, prod], "s-firm", "prod-other", "2026-09-29").id).toBe("c");
  });
});

describe("applyTempSpec", () => {
  it("overrides limits and keeps the permanent pair", () => {
    const spec = { id: "s-firm", name: "Firmness", min: "5", max: "8", unit: "Lb" };
    const next = applyTempSpec(spec, row({ min: "4", max: "", unit: "Lb" }));
    expect(next.min).toBe("4");
    expect(next.max).toBe("8");
    expect(next.perm).toEqual({ min: "5", max: "8", unit: "Lb" });
    expect(next.temp.note).toBe("softer this week");
  });
});

describe("upsertTempSpec / clearTempSpec", () => {
  it("replaces an active row on the same spec+owner", () => {
    const first = row({ id: "old" });
    const next = upsertTempSpec([first], row({ id: "new", min: "2" }), NOW);
    expect(next.find(t => t.id === "old")).toMatchObject({ endedHow: "replaced" });
    expect(next.find(t => t.id === "new").min).toBe("2");
  });
  it("clears an active row by hand", () => {
    const next = clearTempSpec([row()], "t1", "u-head", NOW);
    expect(next[0]).toMatchObject({ endedHow: "cleared", endedBy: "u-head" });
  });
});

describe("tempUntilLabel", () => {
  it("names an open-ended override and a calendar end", () => {
    expect(tempUntilLabel(row({ expiresAt: null }))).toBe("until changed");
    expect(tempUntilLabel(row({ expiresAt: "2026-10-15" }))).toMatch(/until 15 Oct/);
  });
});
