import { describe, expect, it } from "vitest";
import { matchesInspSearch } from "./format.js";
import { poRequiredOnReject, poSourceHint, sheetPoForInspection, suggestedPo } from "./rejection-po.js";

describe("matchesInspSearch", () => {
  const insp = { id: "yegdvnuw", pallets: ["3871"] };
  const product = { name: "Merkloos Bio witlof 500 gram", articleId: "12574277" };
  it("matches the report number printed on the PDF", () => {
    expect(matchesInspSearch(insp, product, "YEGDVNUW")).toBe(true);
    expect(matchesInspSearch(insp, product, "yegd")).toBe(true);
    expect(matchesInspSearch(insp, product, "witlof")).toBe(true);
    expect(matchesInspSearch(insp, product, "12574277")).toBe(true);
    expect(matchesInspSearch(insp, product, "nope")).toBe(false);
    expect(matchesInspSearch(insp, product, "")).toBe(true);
  });
});

describe("sheetPoForInspection", () => {
  const rows = [
    { hu: "187189630010059817", po: "45001234" },
    { hu: "187189630010059855", po: "45001234" },
    { hu: "999", po: "45009999" },
  ];
  it("pulls distinct POs from matching sheet pallets", () => {
    expect(sheetPoForInspection(rows, { pallets: ["187189630010059817"] })).toEqual({ fromSheet: true, pos: ["45001234"] });
    expect(sheetPoForInspection(rows, { pallets: ["187189630010059817", "999"] })).toEqual({ fromSheet: true, pos: ["45001234", "45009999"] });
    expect(sheetPoForInspection(rows, { pallets: [""] })).toEqual({ fromSheet: false, pos: [] });
    expect(sheetPoForInspection(rows, { pallets: ["not-on-sheet"] })).toEqual({ fromSheet: false, pos: [] });
  });
});

describe("suggestedPo / poRequiredOnReject", () => {
  it("keeps a typed PO and otherwise uses the sheet", () => {
    expect(suggestedPo({ po: "OWN" }, { pos: ["4500"] })).toBe("OWN");
    expect(suggestedPo({ po: "" }, { pos: ["4500"] })).toBe("4500");
    expect(suggestedPo({ po: "" }, { pos: ["A", "B"] })).toBe("A, B");
    expect(suggestedPo({ po: "" }, { pos: [] })).toBe("");
  });
  it("requires a PO only when the Head turned the option on and the result is Rejected", () => {
    expect(poRequiredOnReject(false, "Rejected", "")).toBe(false);
    expect(poRequiredOnReject(true, "Accepted", "")).toBe(false);
    expect(poRequiredOnReject(true, "Rejected", "")).toBe(true);
    expect(poRequiredOnReject(true, "Rejected", "4500")).toBe(false);
  });
  it("explains sheet vs typed", () => {
    expect(poSourceHint({ fromSheet: false, pos: [] })).toMatch(/not from the dock sheet/);
    expect(poSourceHint({ fromSheet: true, pos: ["4500"] })).toMatch(/dock sheet/i);
    expect(poSourceHint({ fromSheet: true, pos: [] })).toMatch(/no PO/);
  });
});
