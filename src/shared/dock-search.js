// Match a dock pallet / SKU row against what someone types in the dock-list search box.
// Name is the usual query; article, HU, location, transporter and PO stay in so a paste still hits.

const FIELDS = ["name", "article", "articleId", "key", "hu", "location", "locations", "transporter", "po"];

export function dockMatches(row, q) {
  const qq = String(q || "").trim().toLowerCase();
  if (!qq) return true;
  if (!row) return false;
  return FIELDS.some(k => String(row[k] || "").toLowerCase().includes(qq));
}

export function dockFilter(rows, q) {
  return (rows || []).filter(r => dockMatches(r, q));
}
