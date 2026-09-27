import { describe, expect, it } from "vitest";
import { doneTodayCount, doneTodayByUser, floorVerb, floorWhere, lastActivityAt, peopleAtDock, peopleOnFloor, peopleUnplaced } from "./floor.js";

const NOW = Date.parse("2026-09-27T14:00:00.000Z");
const hourAgo = "2026-09-27T13:00:00.000Z";
const fourHoursAgo = "2026-09-27T09:50:00.000Z";

const users = [
  { id: "u-anna", name: "Anna K.", role: "Controller", active: true },
  { id: "u-jakub", name: "Jakub M.", role: "Controller", active: true },
  { id: "u-head", name: "Marta K.", role: "Head", active: true },
];
const products = [{ id: "p-mango", name: "Merkloos mango", articleId: "90006049" }];
const rows = [
  { hu: "387193366301369750", article: "90006080", name: "Haricots verts", location: "D-07A" },
  { hu: "087193280039725680", article: "90006068", name: "Rode paprika", location: "D-02A" },
  { hu: "111", article: "90006049", name: "Merkloos mango", location: "BUFFER-A" },
];

const sBase = { users, products, inspections: [], palletClaims: {}, inspectionTypes: [{ id: "type-full", countsAsInspection: true }, { id: "type-skip", countsAsInspection: false }] };

describe("peopleOnFloor", () => {
  it("pins a live draft to the dock of its HU", () => {
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", productId: "p-mango", pallets: ["387193366301369750"], startedAt: hourAgo }] };
    const people = peopleOnFloor(s, rows, { now: NOW });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ userId: "u-anna", dock: 7, location: "D-07A", source: "inspection", status: "Draft", hu: "387193366301369750" });
    expect(peopleAtDock(people, 7)).toHaveLength(1);
    expect(peopleUnplaced(people)).toHaveLength(0);
  });

  it("does not guess a dock from the product when the HU is missing", () => {
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", productId: "p-mango", pallets: [""], startedAt: hourAgo }] };
    const people = peopleOnFloor(s, rows, { now: NOW });
    expect(people[0]).toMatchObject({ userId: "u-anna", dock: null, source: "inspection", productName: "Merkloos mango" });
    expect(peopleUnplaced(people)).toHaveLength(1);
  });

  it("does not guess a dock from other pallets of the same product", () => {
    const extra = [...rows, { hu: "999", article: "90006049", name: "Merkloos mango", location: "D-13A" }];
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", productId: "p-mango", pallets: ["888-not-on-sheet"], startedAt: hourAgo }] };
    const people = peopleOnFloor(s, extra, { now: NOW });
    expect(people[0].dock).toBe(null);
  });

  it("drops a draft older than the stale window", () => {
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", pallets: ["387193366301369750"], startedAt: fourHoursAgo, audit: [{ at: fourHoursAgo, action: "Created" }] }] };
    expect(peopleOnFloor(s, rows, { now: NOW })).toHaveLength(0);
  });

  it("keeps a long-running draft if someone typed recently", () => {
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", pallets: ["387193366301369750"], startedAt: fourHoursAgo, audit: [{ at: fourHoursAgo, action: "Created" }, { at: hourAgo, action: "Saved" }] }] };
    expect(peopleOnFloor(s, rows, { now: NOW })[0].userId).toBe("u-anna");
  });

  it("falls back to a taken claim when there is no live inspection", () => {
    const s = { ...sBase, palletClaims: { "hu:087193280039725680": { userId: "u-jakub", status: "taken", at: hourAgo } } };
    const people = peopleOnFloor(s, rows, { now: NOW });
    expect(people[0]).toMatchObject({ userId: "u-jakub", dock: 2, source: "claim", status: "taken" });
  });

  it("places a blocked-sheet claim keyed by article and location", () => {
    const blocked = [{ hu: "", article: "90006049", name: "Merkloos mango", location: "D-03B" }];
    const s = { ...sBase, palletClaims: { "90006049|D-03B": { userId: "u-anna", status: "taken", at: hourAgo } } };
    expect(peopleOnFloor(s, blocked, { now: NOW })[0]).toMatchObject({ userId: "u-anna", dock: 3, source: "claim" });
  });

  it("lets the live inspection win over a claim", () => {
    const s = {
      ...sBase,
      inspections: [{ id: "i1", controllerId: "u-anna", status: "PendingReview", pallets: ["387193366301369750"], startedAt: hourAgo }],
      palletClaims: { "hu:087193280039725680": { userId: "u-anna", status: "taken", at: hourAgo } },
    };
    const people = peopleOnFloor(s, rows, { now: NOW });
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ dock: 7, source: "inspection", status: "PendingReview" });
  });

  it("marks a non-dock location as other, not unplaced", () => {
    const s = { ...sBase, inspections: [{ id: "i1", controllerId: "u-anna", status: "Draft", pallets: ["111"], startedAt: hourAgo }] };
    expect(peopleOnFloor(s, rows, { now: NOW })[0]).toMatchObject({ dock: "other", location: "BUFFER-A" });
  });

  it("can put two inspectors on the same dock", () => {
    const extra = [...rows, { hu: "222", article: "x", name: "Other", location: "D-07C" }];
    const s = {
      ...sBase,
      inspections: [
        { id: "i1", controllerId: "u-anna", status: "Draft", pallets: ["387193366301369750"], startedAt: hourAgo },
        { id: "i2", controllerId: "u-jakub", status: "Draft", pallets: ["222"], startedAt: hourAgo },
      ],
    };
    expect(peopleAtDock(peopleOnFloor(s, extra, { now: NOW }), 7)).toHaveLength(2);
  });

  it("ignores stacked claims and completed inspections", () => {
    const s = {
      ...sBase,
      inspections: [{ id: "i1", controllerId: "u-anna", status: "Completed", pallets: ["387193366301369750"], startedAt: hourAgo, completedAt: hourAgo }],
      palletClaims: { "hu:087193280039725680": { userId: "u-jakub", status: "stacked", at: hourAgo } },
    };
    expect(peopleOnFloor(s, rows, { now: NOW })).toHaveLength(0);
  });
});

describe("floor labels", () => {
  it("names the dock, other locations, and the verb", () => {
    expect(floorWhere({ dock: 7 })).toBe("Dock 7");
    expect(floorWhere({ dock: 0 })).toBe("D-00");
    expect(floorWhere({ dock: "other", location: "BUFFER-A" })).toBe("BUFFER-A");
    expect(floorWhere({ dock: null })).toBe("location unknown");
    expect(floorVerb({ source: "inspection", status: "Draft" })).toBe("inspecting");
    expect(floorVerb({ source: "inspection", status: "PendingReview" })).toBe("awaiting Head");
    expect(floorVerb({ source: "claim" })).toBe("taken");
  });
  it("reads the latest audit as activity", () => {
    expect(lastActivityAt({ startedAt: "2026-01-01", audit: [{ at: "2026-01-02" }, { at: "2026-01-03" }] })).toBe("2026-01-03");
  });
});

describe("doneTodayCount", () => {
  const s = {
    inspectionTypes: [{ id: "type-full", countsAsInspection: true }, { id: "type-skip", countsAsInspection: false }],
    inspections: [
      { controllerId: "u-anna", status: "Completed", typeId: "type-full", completedAt: "2026-09-27T10:00:00.000Z" },
      { controllerId: "u-jakub", status: "Completed", typeId: "type-skip", completedAt: "2026-09-27T11:00:00.000Z" },
      { controllerId: "u-anna", status: "Completed", typeId: "type-full", completedAt: "2026-09-26T10:00:00.000Z" },
      { controllerId: "u-anna", status: "Draft", typeId: "type-full", startedAt: "2026-09-27T12:00:00.000Z" },
    ],
  };
  it("counts completed inspections that count, today only", () => {
    expect(doneTodayCount(s, NOW)).toBe(1);
    expect(doneTodayByUser(s, "u-anna", NOW)).toBe(1);
    expect(doneTodayByUser(s, "u-jakub", NOW)).toBe(0);
  });
});
