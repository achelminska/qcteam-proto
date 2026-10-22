// A product can carry a CU (consumer pack) and/or a TU (box / case) barcode.
// The scanner matches on either. Article ID is not a barcode.

export function hasProductBarcode(p) {
  const cu = String(p?.barcodeCu || p?.barcode || "").trim();
  const tu = String(p?.barcodeTu || "").trim();
  return !!(cu || tu);
}

export function productsMissingBarcode(products, { includeInactive = false } = {}) {
  return (products || []).filter(p => (includeInactive || p.isActive !== false) && !hasProductBarcode(p));
}
