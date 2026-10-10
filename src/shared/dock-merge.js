// One pallet can arrive on the dock sheet as several lines — the WMS splits a handling unit when it is booked in parts
// (two lines for HU 384370050043892022: 10 TU and 60 TU, everything else identical). The pallet on the floor is one
// pallet with 70 TU, so the lines are merged, never picked from. Lines without an HU keep a fallback key and are left
// as they are (they cannot be told apart from each other anyway).
const PRIORITY_RANK = ["Now needed", "High risk", "High issues", "Late inspection", "Inspection due", "Skippable"];
const rank = p => { const i = PRIORITY_RANK.indexOf(String(p || "").trim()); return i < 0 ? PRIORITY_RANK.length : i; };
const num = v => { if (v == null || v === "") return null; const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", ".").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? n : null; };
const truthy = v => v === true || /^(yes|ja|true|1|y)$/i.test(String(v ?? "").trim());
const stamp = r => `${r.arrived || ""} ${r.arrivedTime || ""}`.trim();

export const huKey = r => { const norm = String(r?.hu || "").replace(/\D/g, "").replace(/^0+/, ""); return norm || `noHU:${r?.article}|${r?.location}|${r?.arrivedTime}`; };

export function mergeDockLines(rows) {
  const groups = new Map();
  for (const r of rows || []) { const k = huKey(r); const g = groups.get(k); if (g) g.push(r); else groups.set(k, [r]); }
  const out = [];
  for (const [k, lines] of groups) {
    if (lines.length === 1 || k.startsWith("noHU:")) { if (k.startsWith("noHU:")) out.push(lines[0]); else out.push(lines[0]); continue; }
    const first = lines[0];
    const qtys = lines.map(l => num(l.quantity)).filter(n => n != null);
    const pos = [...new Set(lines.map(l => String(l.po || "").trim()).filter(Boolean))];
    const locs = [...new Set(lines.map(l => String(l.location || "").trim()).filter(Boolean))];
    const earliest = lines.reduce((a, b) => (stamp(b) && (!stamp(a) || stamp(b) < stamp(a)) ? b : a), first);
    const best = lines.reduce((a, b) => (rank(b.priority) < rank(a.priority) ? b : a), first);
    out.push({
      ...first,
      quantity: qtys.length ? qtys.reduce((a, b) => a + b, 0) : first.quantity,
      po: pos.length ? pos[0] : first.po,
      pos,                                   // every PO the lines carried — more than one = a mixed pallet
      location: locs[0] || first.location,
      locations: locs,
      arrived: earliest.arrived, arrivedTime: earliest.arrivedTime,
      priority: best.priority || first.priority,
      blocking: lines.some(l => truthy(l.blocking)),
      skippable: lines.every(l => truthy(l.skippable)),
      sheetLines: lines.length,              // how many lines on the sheet make up this pallet
      lineQuantities: qtys,
    });
  }
  return out;
}
// How many sheet lines were folded into other pallets (the Sheets page reports it).
export const mergedLineCount = rows => (rows || []).length - mergeDockLines(rows).length;
