import { describe, it, expect } from "vitest";
import { parseSpecCell, parseYesNo, applySpecSheet, SPEC_COLUMNS } from "./specsync.js";

describe("reading one cell — every format the commercial sheet uses today", () => {
  const g = v => parseSpecCell(v, "g"), mm = v => parseSpecCell(v, "mm"), pcs = v => parseSpecCell(v, "pcs");
  it("bare numbers and unit suffixes are minimums", () => {
    expect(g("800")).toEqual({ min: 800, max: null, unit: "g" });
    expect(g("350g")).toEqual({ min: 350, max: null, unit: "g" });
    expect(g("181g+")).toEqual({ min: 181, max: null, unit: "g" });
    expect(g("800gr")).toEqual({ min: 800, max: null, unit: "g" });
    expect(g("1,5 kg")).toEqual({ min: 1500, max: null, unit: "g" });
  });
  it("ranges, with unit conversion", () => {
    expect(g("450 - 500")).toEqual({ min: 450, max: 500, unit: "g" });
    expect(mm("80-100mm")).toEqual({ min: 80, max: 100, unit: "mm" });
    expect(mm("20-26cm")).toEqual({ min: 200, max: 260, unit: "mm" });
    expect(mm("120-180 mm")).toEqual({ min: 120, max: 180, unit: "mm" });
    expect(g("208-234gr")).toEqual({ min: 208, max: 234, unit: "g" });
    expect(pcs("4-5")).toEqual({ min: 4, max: 5, unit: "pcs" });
  });
  it("maximums: '<16' (berries) and 'max 3'", () => {
    expect(mm("<16")).toEqual({ min: null, max: 16, unit: "mm" });
    expect(mm("<12")).toEqual({ min: null, max: 12, unit: "mm" });
    expect(pcs("max 3")).toEqual({ min: null, max: 3, unit: "pcs" });
    expect(pcs("max 3 pieces")).toEqual({ min: null, max: 3, unit: "pcs" });
  });
  it("trade class + measure in brackets → the measure is the spec", () => {
    expect(mm("2-3 (84 - 92mm)")).toEqual({ min: 84, max: 92, unit: "mm" });
    expect(mm("4-5 (73-88mm)")).toEqual({ min: 73, max: 88, unit: "mm" });
  });
  it("approximate wording is read but flagged", () => {
    expect(g("gemiddeld 90g")).toMatchObject({ min: 90, max: null, note: expect.stringMatching(/approximate/) });
    expect(g("50g+ per stuk (afhankelijk van aantal)")).toMatchObject({ min: 50, note: expect.stringMatching(/approximate/) });
  });
  it("placeholders, empties and junk are issues, never values", () => {
    expect(g("fill in min accepted spec")).toEqual({ issue: "placeholder", note: "fill in min accepted spec" });
    expect(g("Requested at Edeka")).toEqual({ issue: "placeholder", note: "Requested at Edeka" });
    expect(g("None")).toMatchObject({ issue: "placeholder" });
    expect(pcs("?")).toMatchObject({ issue: "placeholder" });
    expect(g("170???")).toMatchObject({ issue: "placeholder" });
    expect(g("")).toEqual({ issue: "empty" }); expect(g(undefined)).toEqual({ issue: "empty" });
    expect(g("N/A")).toMatchObject({ issue: "placeholder" });
    expect(g("blue")).toEqual({ issue: "unreadable", note: "blue" });
  });
  it("Yes/No", () => { expect(parseYesNo("Yes")).toBe(true); expect(parseYesNo("no")).toBe(false); expect(parseYesNo("")).toBe(null); expect(parseYesNo("maybe")).toBe(null); });
});

describe("applying a push to the catalog", () => {
  const catalog = [
    { id: "p1", articleId: "10573488", name: "Merkloos komkommer (1 st)", specs: [] },
    { id: "p2", articleId: "10468928", name: "Merkloos rode paprika (1 st)", specs: [{ id: "h1", name: "CU weight", unit: "g", basis: "cu", min: 200, max: null }] },   // the Head's own
    { id: "p3", articleId: "90006132", name: "Merkloos bananen (5 st)", specs: [{ id: "s1", name: "Caliber", unit: "mm", basis: "piece", min: 30, max: 38, origin: "sheet", sheetRaw: "30-38" }] },
  ];
  const rows = [
    { articleId: "10573488", cuName: "Merkloos Komkommer 1 stuk", sortable: "Yes", weight: "350g", pieceWeight: "", caliber: "", countPerPack: "", length: "", thickness: "" },
    { articleId: "10468928", cuName: "Merkloos Rode paprika 1 stuk", sortable: "Yes", weight: "181g+", pieceWeight: "181g+", caliber: "80-100mm", countPerPack: "22", length: "N/A", thickness: "" },
    { articleId: "90006132", cuName: "Merkloos Bananen 5 of 6 stuks", sortable: "Yes", weight: "None", pieceWeight: "", caliber: "31-39", countPerPack: "5", length: "20-26cm", thickness: "" },
    { articleId: "12747877", cuName: "Merkloos Sweet lightning pompoen 1 stuk", sortable: "Yes", weight: "", pieceWeight: "", caliber: "", countPerPack: "", length: "", thickness: "" },
    { articleId: "10573488", cuName: "dup", sortable: "No", weight: "1", pieceWeight: "", caliber: "", countPerPack: "", length: "", thickness: "" },
    { articleId: "", _errors: ["missing article"] },
  ];
  const { products, report } = applySpecSheet(catalog, rows, { now: "2026-09-30T20:00:00Z", uid: () => "new" });
  const byId = Object.fromEntries(products.map(p => [p.articleId, p]));
  it("writes sheet specs where the product has none, with origin and the raw cell", () => {
    const k = byId["10573488"];
    expect(k.specs).toEqual([{ id: "new", name: "CU weight", unit: "g", basis: "cu", min: 350, max: null, origin: "sheet", sheetRaw: "350g", syncedAt: "2026-09-30T20:00:00Z" }]);
    expect(k.sortable).toEqual({ value: true, origin: "sheet", syncedAt: "2026-09-30T20:00:00Z" });
    expect(k.sheetName).toBe("Merkloos Komkommer 1 stuk"); expect(k.name).toBe("Merkloos komkommer (1 st)"); // catalog name untouched
  });
  it("never overwrites the Head's own spec — reports the conflict instead, and still adds the other columns", () => {
    const p = byId["10468928"]; const names = p.specs.map(q => q.name);
    expect(p.specs.find(q => q.name === "CU weight")).toEqual(catalog[1].specs[0]);
    expect(names).toEqual(expect.arrayContaining(["CU weight", "Piece weight", "Caliber", "Count per pack"]));
    expect(p.specs.find(q => q.name === "Caliber")).toMatchObject({ min: 80, max: 100, unit: "mm", origin: "sheet" });
    expect(report.issues.find(i => i.kind === "conflict")).toMatchObject({ articleId: "10468928", spec: "CU weight" });
    expect(report.conflicts).toBe(1);
  });
  it("updates a sheet spec in place and keeps the last good value when the cell went bad", () => {
    const b = byId["90006132"];
    expect(b.specs.find(q => q.name === "Caliber")).toMatchObject({ id: "s1", min: 31, max: 39, sheetRaw: "31-39" }); // same id, new values
    expect(b.specs.find(q => q.name === "Length")).toMatchObject({ min: 200, max: 260, unit: "mm" });
    expect(b.specs.find(q => q.name === "CU weight")).toBeUndefined(); // "None" writes nothing
    expect(report.issues).toContainEqual(expect.objectContaining({ articleId: "90006132", kind: "placeholder", column: "weight" }));
  });
  it("adds unknown articles to the catalog (the sheet is the commercial master list) and says so", () => {
    expect(byId["12747877"]).toMatchObject({ id: "new", name: "Merkloos Sweet lightning pompoen 1 stuk", fromSpecSheet: true, categoryId: null });
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "created", articleId: "12747877" }));
    const strict = applySpecSheet(catalog, rows, { createMissing: false, now: "x", uid: () => "n" });
    expect(strict.products.find(p => p.articleId === "12747877")).toBeUndefined();
    expect(strict.report.issues).toContainEqual(expect.objectContaining({ kind: "unknown", articleId: "12747877" }));
  });
  it("counts: duplicates and error rows are skipped, coverage per column", () => {
    expect(report).toMatchObject({ rows: 6, updated: 3, created: 1, skipped: 2 });
    expect(report.issues).toContainEqual(expect.objectContaining({ kind: "duplicate", articleId: "10573488" }));
    expect(report.coverage.weight).toEqual({ filled: 2, placeholder: 1, empty: 1, unreadable: 0 });
    expect(report.coverage.length).toEqual({ filled: 1, placeholder: 1, empty: 2, unreadable: 0 });
    expect(Object.keys(report.coverage)).toEqual(Object.keys(SPEC_COLUMNS));
  });
  it("is idempotent: the same push again changes nothing", () => {
    const again = applySpecSheet(products, rows, { now: "later", uid: () => "x" });
    expect(again.report.updated).toBe(0); expect(again.report.created).toBe(0);
    expect(again.products.find(p => p.articleId === "10573488")).toBe(byId["10573488"]); // same object, not even re-created
  });
  it("untouched products keep their identity", () => { expect(products[1]).not.toBe(catalog[1]); expect(products.length).toBe(4); });
});
