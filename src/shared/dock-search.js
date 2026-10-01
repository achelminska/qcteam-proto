// Match a dock pallet / SKU row against what someone types in the dock-list search box.
// Name is the usual query; article, HU, location, transporter, supplier and PO stay in so a paste still hits.

const FIELDS = ["name", "article", "articleId", "key", "hu", "location", "locations", "transporter", "supplier", "po"];

export function dockSupplierText(row, s) {
  const bits = [];
  const push = v => { const t = String(v || "").trim(); if (t) bits.push(t); };
  push(row?.supplier);
  if (Array.isArray(row?.suppliers)) row.suppliers.forEach(push);
  const article = row?.article || row?.articleId || row?.key;
  if (s && article) {
    const product = (s.products || []).find(p => p.articleId === article);
    for (const id of product?.supplierIds || []) push((s.suppliers || []).find(x => x.id === id)?.name);
  }
  return [...new Set(bits)].join(" ");
}

export function dockMatches(row, q, s) {
  const qq = String(q || "").trim().toLowerCase();
  if (!qq) return true;
  if (!row) return false;
  const hay = { ...row, supplier: dockSupplierText(row, s) };
  return FIELDS.some(k => String(hay[k] || "").toLowerCase().includes(qq));
}

export function dockFilter(rows, q, s) {
  return (rows || []).filter(r => dockMatches(r, q, s));
}
