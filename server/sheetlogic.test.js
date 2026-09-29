import { describe, it, expect } from "vitest";
import { DOCK_TARGETS, suggestMappings, adoptNewColumns, applyMapping } from "./sheetlogic.mjs";

// The dock sheet's header as pushed on 2026-09-29, the day "Quantity" appeared between Item Name and Location.
const HEADER = ["PO ID", "Arrival date", "Arrival time", "Transporter", "Needed today", "Time needed", "Handling Unit", "UOM ID", "Item Name", "Quantity", "Location", "Priority score", "Priority item", "Skippable", "Buffer", "Dock", "Sortable"];
const ROW = ["1277525", "29-09-2026", "08:32", "Fossa Chilled", "Yes", "Now", "387154590006097712", "HE10467868-12", "Merkloos Paksoi 1 stuk", "10", "D-05A", "2", "High risk", "", "0", "1", "Yes"];
const OLD_HEADER = HEADER.filter(h => h !== "Quantity");
const byTarget = ms => Object.fromEntries(ms.filter(m => m.target !== "ignore").map(m => [m.target, m]));

describe("Quantity column", () => {
  it("is a dock target with a numeric transform, suggested from the real header", () => {
    expect(DOCK_TARGETS.find(t => t[0] === "quantity")).toBeTruthy();
    const m = byTarget(suggestMappings(HEADER, [ROW], DOCK_TARGETS));
    expect(m.quantity).toMatchObject({ source: "Quantity", transform: "number" });
    // and nothing else moved because of it
    expect(m.hu.source).toBe("Handling Unit"); expect(m.article.source).toBe("UOM ID"); expect(m.location.source).toBe("Location"); expect(m.priority.source).toBe("Priority item"); expect(m.name.source).toBe("Item Name");
  });
  it("lands on the mapped row as a number-like string", () => {
    const rows = applyMapping({ mappings: suggestMappings(HEADER, [ROW], DOCK_TARGETS) }, HEADER, [ROW]);
    expect(rows[0].quantity).toBe("10");
    expect(rows[0]._errors || []).toEqual([]);
  });
});

describe("adoptNewColumns — a column appears in a sheet the Head already mapped", () => {
  const before = suggestMappings(OLD_HEADER, [ROW.filter((_, i) => HEADER[i] !== "Quantity")], DOCK_TARGETS);
  it("keeps every existing mapping and adds the new one", () => {
    const after = adoptNewColumns(before, HEADER, [ROW], DOCK_TARGETS);
    expect(after).toHaveLength(HEADER.length);
    for (const m of before) expect(after.find(x => x.source === m.source)).toEqual(m);
    expect(byTarget(after).quantity).toMatchObject({ source: "Quantity", transform: "number" });
  });
  it("never overrides a target the Head chose by hand", () => {
    // The Head mapped some other column to "quantity" on purpose; the new "Quantity" column must stay ignored.
    const handMapped = before.map(m => m.source === "Buffer" ? { ...m, target: "quantity", transform: "number" } : m);
    const after = adoptNewColumns(handMapped, HEADER, [ROW], DOCK_TARGETS);
    expect(after.find(m => m.source === "Buffer").target).toBe("quantity");
    expect(after.find(m => m.source === "Quantity").target).toBe("ignore");
  });
  it("also fills a column that sat on ignore only because its target did not exist yet (same header)", () => {
    const savedAfterColumnAppeared = suggestMappings(HEADER, [ROW], DOCK_TARGETS).map(m => m.source === "Quantity" ? { ...m, target: "ignore", transform: "none", required: false } : m);
    const after = adoptNewColumns(savedAfterColumnAppeared, HEADER, [ROW], DOCK_TARGETS);
    expect(byTarget(after).quantity).toMatchObject({ source: "Quantity", transform: "number" });
    expect(adoptNewColumns(after, HEADER, [ROW], DOCK_TARGETS)).toEqual(after); // idempotent from then on
  });
  it("follows the new header order and drops mappings of vanished, unmapped columns", () => {
    const after = adoptNewColumns(before, HEADER.filter(h => h !== "Time needed"), [ROW], DOCK_TARGETS);
    expect(after.map(m => m.source)).toEqual(HEADER.filter(h => h !== "Time needed"));
  });
});
