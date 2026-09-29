import { describe, expect, it } from "vitest";
import { pushLooksLikeRecalc, rowUsable, rowsUnusable } from "./sheet-rows.js";

const pallet = (hu, extra = {}) => ({ hu, article: "90006137", name: "Chiquita Bananen 1 kilo", arrived: "2026-09-29", ...extra });

describe("rowUsable", () => {
  it("keeps a new pallet that only lacks the arrival date", () => {
    expect(rowUsable(pallet("100749040918918812", { arrived: "", _errors: ["arrived empty"] }))).toBe(true);
  });
  it("keeps a blocked row identified by article + name", () => {
    expect(rowUsable({ hu: "", article: "90006137", name: "Chiquita Bananen 1 kilo", _errors: ["arrived empty"] })).toBe(true);
  });
  it("drops a row with no identity", () => {
    expect(rowUsable({ hu: "", article: "", name: "Chiquita Bananen 1 kilo", _errors: ["hu empty", "article empty"] })).toBe(false);
  });
});

describe("pushLooksLikeRecalc", () => {
  it("does not freeze the dock when every row only lost its arrival date", () => {
    const prev = [pallet("1"), pallet("2"), pallet("3"), pallet("4"), pallet("5")];
    const next = prev.map(r => ({ ...r, arrived: "", _errors: ["arrived empty"] }));
    expect(rowsUnusable(next)).toBe(0);
    expect(pushLooksLikeRecalc(next, prev)).toBe(false);
  });
  it("still ignores a push that wiped every HU", () => {
    const prev = [pallet("1"), pallet("2"), pallet("3"), pallet("4"), pallet("5")];
    const next = prev.map(r => ({ ...r, hu: "", article: "", name: "", _errors: ["hu empty"] }));
    expect(pushLooksLikeRecalc(next, prev)).toBe(true);
  });
});
