import { describe, expect, it } from "vitest";
import { normalizePo, poTokens } from "./po.js";

describe("normalizePo", () => {
  it("leaves a normal short PO alone", () => {
    expect(normalizePo("1293776")).toBe("1293776");
    expect(normalizePo("45001234")).toBe("45001234");
    expect(normalizePo("PO 1293776")).toBe("1293776");
  });

  it("cuts a PO written twice in the same cell", () => {
    expect(normalizePo("12937761293776")).toBe("1293776");
    expect(normalizePo("1293776 1293776")).toBe("1293776");
    expect(normalizePo("1293776/1293776")).toBe("1293776");
    expect(normalizePo("1293776,1293776")).toBe("1293776");
  });

  it("cuts two 7-digit POs glued with no separator — the live aardbeien cell", () => {
    expect(normalizePo("12927001293776")).toBe("1293776");
    expect(poTokens("12927001293776")).toEqual(["1293776"]);
  });

  it("cuts the glued 14-digit form the dock sheet uses as a default", () => {
    expect(normalizePo("12858501286618")).toBe("1286618");
  });

  it("does not split a real 8-digit PO in half", () => {
    expect(normalizePo("45001234")).toBe("45001234");
    expect(poTokens("45001234")).toEqual(["45001234"]);
  });

  it("handles empty and excel-ish values", () => {
    expect(normalizePo("")).toBe("");
    expect(normalizePo(null)).toBe("");
    expect(normalizePo("1293776.0")).toBe("1293776");
  });
});
