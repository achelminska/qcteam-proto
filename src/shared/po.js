// Dock-sheet PO IDs. The WMS / Google Sheet often writes the number twice in one cell —
// "1293776 1293776", "1293776/1293776", or glued as 14 digits "12927001293776" (two 7-digit
// IDs with no separator). Controllers should see the short PO, not the doubled string.

const HALF = [6, 7, 8, 10];

function digits(s) {
  return String(s || "").replace(/\.0+$/, "").replace(/[\s-]/g, "");
}

function splitGlued(token) {
  const d = digits(token);
  if (!/^\d+$/.test(d)) return [String(token || "").trim()].filter(Boolean);
  if (d.length < 8) return [d];
  for (const h of HALF) {
    if (d.length !== h * 2) continue;
    const a = d.slice(0, h), b = d.slice(h);
    if (a === b) return [a];
    // Two typical-length POs stuck together (sheet concatenated two cells). Keep the
    // trailing one — that's the ID the other rows of the same article already show.
    return [b];
  }
  if (d.length >= 10 && d.length % 2 === 0) {
    const h = d.length / 2;
    if (d.slice(0, h) === d.slice(h)) return [d.slice(0, h)];
  }
  return [d];
}

export function poTokens(raw) {
  let s = String(raw ?? "").trim();
  if (!s) return [];
  s = s.replace(/^(?:PO|P\.?O\.?)\s*[:#.-]?\s*/i, "").trim();
  if (!s) return [];
  const parts = s.split(/[\s,;|/]+/).filter(Boolean);
  const out = [];
  for (const p of parts) {
    for (const t of splitGlued(p)) if (t && !out.includes(t)) out.push(t);
  }
  return out;
}

export function normalizePo(raw) {
  const t = poTokens(raw);
  return t.length ? t[t.length - 1] : "";
}
