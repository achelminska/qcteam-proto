import { describe, expect, it } from "vitest";
import { dockFilter, dockMatches, dockSupplierText } from "./dock-search.js";

const row = {
  name: "Picnic Jonagold appels 1.5 kilo",
  article: "90006048",
  hu: "387175210024374956",
  location: "D-07A",
  transporter: "Fruitmasters 2",
  po: "1268342",
};

describe("dockMatches", () => {
  it("is a no-op when the box is empty", () => {
    expect(dockMatches(row, "")).toBe(true);
    expect(dockMatches(row, "   ")).toBe(true);
    expect(dockMatches(null, "")).toBe(true);
  });

  it("finds a product by part of its name, case-insensitively", () => {
    expect(dockMatches(row, "jonagold")).toBe(true);
    expect(dockMatches(row, "Appels")).toBe(true);
    expect(dockMatches(row, "banana")).toBe(false);
  });

  it("also matches article, HU, location, transporter, supplier and PO", () => {
    expect(dockMatches(row, "90006048")).toBe(true);
    expect(dockMatches(row, "374956")).toBe(true);
    expect(dockMatches(row, "d-07")).toBe(true);
    expect(dockMatches(row, "fruitmasters")).toBe(true);
    expect(dockMatches({ ...row, supplier: "El Ciruelo" }, "ciruelo")).toBe(true);
    expect(dockMatches(row, "1268342")).toBe(true);
  });

  it("finds a pallet by the product's assigned suppliers", () => {
    const s = {
      products: [{ id: "p1", articleId: "90006048", supplierIds: ["sup-e"] }],
      suppliers: [{ id: "sup-e", name: "El Ciruelo" }, { id: "sup-g", name: "Gartenfrisch" }],
    };
    expect(dockSupplierText(row, s)).toBe("El Ciruelo");
    expect(dockMatches(row, "ciruelo", s)).toBe(true);
    expect(dockMatches(row, "gartenfrisch", s)).toBe(false);
    expect(dockMatches({ ...row, article: "nope" }, "ciruelo", s)).toBe(false);
  });

  it("uses the grouped-SKU key as the article when the sheet field is missing", () => {
    expect(dockMatches({ name: "Basilicum", key: "10074782" }, "10074782")).toBe(true);
  });
});

describe("dockFilter", () => {
  it("keeps only matching rows", () => {
    const rows = [row, { name: "Merkloos Basilicum 15 gram", article: "10074782" }];
    expect(dockFilter(rows, "appel").map(r => r.article)).toEqual(["90006048"]);
    expect(dockFilter(rows, "").length).toBe(2);
  });
});
