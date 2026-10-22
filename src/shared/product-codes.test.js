import { describe, expect, it } from "vitest";
import { hasProductBarcode, productsMissingBarcode } from "./product-codes.js";

describe("hasProductBarcode", () => {
  it("is false when both codes are empty", () => {
    expect(hasProductBarcode({})).toBe(false);
    expect(hasProductBarcode({ barcodeCu: "", barcodeTu: "  " })).toBe(false);
  });

  it("accepts CU, TU, or the legacy barcode field", () => {
    expect(hasProductBarcode({ barcodeCu: "8719328001234" })).toBe(true);
    expect(hasProductBarcode({ barcodeTu: "8719328009999" })).toBe(true);
    expect(hasProductBarcode({ barcode: "8719328001234" })).toBe(true);
  });
});

describe("productsMissingBarcode", () => {
  const rows = [
    { id: "a", name: "Has CU", barcodeCu: "1", isActive: true },
    { id: "b", name: "Empty", barcodeCu: "", barcodeTu: "", isActive: true },
    { id: "c", name: "Inactive empty", isActive: false },
    { id: "d", name: "Has TU", barcodeTu: "2", isActive: true },
  ];

  it("counts active products with no CU and no TU", () => {
    expect(productsMissingBarcode(rows).map(p => p.id)).toEqual(["b"]);
  });

  it("can include inactive products", () => {
    expect(productsMissingBarcode(rows, { includeInactive: true }).map(p => p.id)).toEqual(["b", "c"]);
  });
});
