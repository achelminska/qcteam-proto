import { describe, expect, it } from "vitest";
import { extractSSCC, isPalletCode, scanNavParam } from "./scan-nav.js";

describe("scanNavParam", () => {
  it("stores the SSCC for a pallet scan so profile back can restore the sheet", () => {
    expect(scanNavParam("387175210024377766")).toBe("387175210024377766");
    expect(scanNavParam("00087205744101641093")).toBe("087205744101641093");
  });

  it("keeps a product EAN / article ID as typed", () => {
    expect(scanNavParam("8719328001234")).toBe("8719328001234");
    expect(scanNavParam("11413643")).toBe("11413643");
  });

  it("clears an empty scan so Scan another is a fresh camera", () => {
    expect(scanNavParam("")).toBe(null);
    expect(scanNavParam("   ")).toBe(null);
    expect(scanNavParam(null)).toBe(null);
  });
});

describe("isPalletCode / extractSSCC", () => {
  it("treats 14+ digit strings as pallet codes", () => {
    expect(isPalletCode("387175210024377766")).toBe(true);
    expect(isPalletCode("11413643")).toBe(false);
    expect(isPalletCode("")).toBe(false);
  });

  it("strips the GS1 AI 00 prefix", () => {
    expect(extractSSCC("00087205744101641093")).toBe("087205744101641093");
    expect(extractSSCC("387175210024377766")).toBe("387175210024377766");
  });
});
