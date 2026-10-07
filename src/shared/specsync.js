// Product specifications pushed from the commercial team's sheet ("min accepted spec" per article). One sheet, one
// direction: the sheet is the source of truth for the specs it carries; the Head's own specs are never overwritten.
// Plain JS, no DOM — used by the server (every push) and the portal (paste / preview). Tested in specsync.test.js.
//
// Model on the product:
//   product.specs[]  { id, name, unit, min, max, basis, origin: "sheet", sheetRaw, syncedAt }   ← written by the sheet
//   product.specs[]  { …no origin… }                                                             ← the Head's own, wins
//   product.sortable { value: true|false, origin: "sheet" }                                      ← "Product sortable?"
// Rules:
//   - a sheet spec is matched by (name, basis). It is created or updated only where the product has no spec of that
//     name, or the existing one is itself from the sheet. A Head spec of the same name is left alone; if the sheet
//     disagrees with it, that is reported as a conflict — the Head decides, not the sync.
//   - a cell that cannot be read (placeholder, empty, junk) never deletes a spec the sheet wrote before: the last
//     good value stays, and the cell is reported. The commercial team's "fill in min accepted spec" is exactly the
//     to-do list the Head wants to see.
//   - unknown article IDs can be added to the catalog (createMissing) — the sheet is the commercial master list.

// Columns the sheet has, what each becomes. `spec` targets carry the specification's default name / unit / basis.
export const SPEC_TARGETS = [
  ["articleId", "Article ID", true],
  ["cuName", "Product name (CU name)", false],
  ["sortable", "Product sortable? (Yes/No)", false],
  ["weight", "Weight per CU (g) → spec “CU weight”", false],
  ["pieceWeight", "Weight per piece (g) → spec “Piece weight”", false],
  ["caliber", "Size / caliber (mm) → spec “Caliber”", false],
  ["countPerPack", "Count per pack (pcs) → spec “Count per pack”", false],
  ["length", "Length (mm) → spec “Length”", false],
  ["thickness", "Thickness (mm) → spec “Thickness”", false],
  ["live", "Live value (temporary spec)", false],
  ["liveUntil", "Live until (week / date)", false],
  ["ignore", "— ignore —", false],
];
export const SPEC_COLUMNS = {
  weight: { name: "CU weight", unit: "g", basis: "cu" },
  pieceWeight: { name: "Piece weight", unit: "g", basis: "piece" },
  caliber: { name: "Caliber", unit: "mm", basis: "piece" },
  countPerPack: { name: "Count per pack", unit: "pcs", basis: "cu" },
  length: { name: "Length", unit: "mm", basis: "piece" },
  thickness: { name: "Thickness", unit: "mm", basis: "piece" },
};
export const SPEC_ALIASES = { cuName: ["cuname", "productname", "name", "article", "omschrijving"], sortable: ["productsortable", "sortable", "sorteerbaar"], weight: ["weight", "gewicht", "cuweight", "weightpercu"], pieceWeight: ["weightperpiece", "pieceweight", "gewichtperstuk", "perpiece"], caliber: ["sizecaliber", "caliber", "size", "kaliber", "maat", "diameter"], countPerPack: ["countperpack", "count", "aantal", "pieces", "stuks", "piecespercu"], length: ["length", "lengte"], thickness: ["thickness", "dikte", "width", "breedte"], live: ["livevalue", "live", "tijdelijk", "temporary", "tempspec"], liveUntil: ["liveuntil", "validuntil", "livetot", "until", "liveweek", "liveexpires"] };

// ── Reading one cell ────────────────────────────────────────────────────────────────────────────────────────────
// Returns { min, max, unit, note } or { issue, note } — never both. Numbers come back as numbers, unit already
// converted to the column's unit (cm → mm, kg → g).
const PLACEHOLDER = /fill in|requested at|^none$|^n\/?a$|^\?+$|\?\?\?|tbd|todo|later/i;
const num = s => { const m = /-?\d+(?:[.,]\d+)?/.exec(s); return m ? Number(m[0].replace(",", ".")) : null; };
const UNIT_FACTORS = { g: { g: 1, gr: 1, gram: 1, kg: 1000 }, mm: { mm: 1, cm: 10, m: 1000 }, pcs: {} };
export function parseSpecCell(raw, targetUnit) {
  const v = String(raw ?? "").trim();
  if (!v) return { issue: "empty" };
  if (PLACEHOLDER.test(v)) return { issue: "placeholder", note: v };
  const factors = UNIT_FACTORS[targetUnit] || {};
  const unitOf = txt => { const m = /(kg|gr|gram|g|mm|cm|m)\b/i.exec(txt); const u = m ? m[1].toLowerCase() : null; return u && factors[u] != null ? factors[u] : 1; };
  const approx = /gemiddeld|average|avg|ca\.|approx|afhankelijk/i.test(v);
  // "2-3 (84-92mm)" / "4-5 (73-88mm)": a trade class followed by the real measure in brackets — the bracket is the spec.
  const br = /\(([^)]*\d[^)]*)\)/.exec(v); const body = targetUnit === "mm" && br ? br[1] : v.replace(/\([^)]*\)/g, " ");
  const f = unitOf(body);
  let m;
  if ((m = /^<\s*(\d+(?:[.,]\d+)?)/.exec(body.trim()))) return { min: null, max: Number(m[1].replace(",", ".")) * f, unit: targetUnit };
  if ((m = /^max\.?\s*(\d+(?:[.,]\d+)?)/i.exec(body.trim()))) return { min: null, max: Number(m[1].replace(",", ".")) * f, unit: targetUnit };
  if ((m = /^min\.?\s*(\d+(?:[.,]\d+)?)/i.exec(body.trim()))) return { min: Number(m[1].replace(",", ".")) * f, max: null, unit: targetUnit };
  if ((m = /(\d+(?:[.,]\d+)?)\s*(?:[a-z]*\s*)?[-–]\s*(\d+(?:[.,]\d+)?)/i.exec(body))) { const a = Number(m[1].replace(",", ".")) * f, b = Number(m[2].replace(",", ".")) * f; return { min: Math.min(a, b), max: Math.max(a, b), unit: targetUnit, ...(approx ? { note: "approximate: " + v } : {}) }; }
  const n = num(body); if (n == null) return { issue: "unreadable", note: v };
  // "181g+" and "50g+ per stuk" mean at least; a bare number in a "min accepted spec" sheet means at least as well.
  return { min: n * f, max: null, unit: targetUnit, ...(approx ? { note: "approximate: " + v } : {}) };
}

// ── Live value: the commercial team's temporary spec ─────────────────────────────────────────────────────────────
// "400", "280" → the minimum CU weight (g) for a few weeks; "size 9 - 1200g" → 9 CU per TU and 1200 g; "no weight, min 4 fingers" →
// text only. The end is "until w42" / "max w 42" (in the cell itself or in the Live until column) → Sunday of that ISO week.
export const isoWeekEnd = (week, year) => {
  const jan4 = new Date(Date.UTC(year, 0, 4)); const monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86400000);
  return new Date(monday.getTime() + ((week - 1) * 7 + 6) * 86400000).toISOString().slice(0, 10);
};
const WEEK_RE = /(?:until|max\.?|t\/m|tot|to)?\s*\bw(?:eek|k)?\s*\.?\s*(\d{1,2})\b/i;
export function parseLiveCell(raw, untilRaw, now = new Date().toISOString()) {
  const text = String(raw ?? "").trim(); const until = String(untilRaw ?? "").trim();
  if (!text) return { empty: true };
  const today = now.slice(0, 10), year = Number(today.slice(0, 4));
  let expiresAt = null;
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(until) || /(\d{4}-\d{2}-\d{2})/.exec(text); if (iso) expiresAt = iso[1];
  else { const w = WEEK_RE.exec(until) || WEEK_RE.exec(text) || (/^\d{1,2}$/.test(until) ? [0, until] : null); if (w) { const wk = Number(w[1]); if (wk >= 1 && wk <= 53) { expiresAt = isoWeekEnd(wk, year); if (expiresAt < new Date(new Date(today + "T00:00Z").getTime() - 180 * 86400000).toISOString().slice(0, 10)) expiresAt = isoWeekEnd(wk, year + 1); } } }
  const body = text.replace(new RegExp(WEEK_RE.source, "ig"), " ").replace(/\s+/g, " ").trim();
  const size = /\bsize\s*(\d+)\b/i.exec(body); const cuPerTu = size ? Number(size[1]) : null;
  let minWeight = null; const g = /(\d+(?:[.,]\d+)?)\s*(kg|gram|gr|g)\b/i.exec(body.replace(/\bsize\s*\d+/i, " "));
  if (g) minWeight = Math.round(Number(g[1].replace(",", ".")) * (/^kg$/i.test(g[2]) ? 1000 : 1)); else if (/^\d+(?:[.,]\d+)?$/.test(body)) minWeight = Math.round(Number(body.replace(",", ".")));
  if (minWeight != null && /^(?:no\b|geen\b)/i.test(body)) minWeight = null;
  return { text, body, expiresAt, cuPerTu, minWeight, pureWeight: minWeight != null && cuPerTu == null && /^[\d.,\s]*(kg|gram|gr|g)?$/i.test(body) };
}
export const liveActive = (expiresAt, today = new Date().toISOString().slice(0, 10)) => !expiresAt || String(expiresAt) >= today;
// What the apps show on the product: the sheet's live note while it lasts.
export const liveNoteOf = (product, today = new Date().toISOString().slice(0, 10)) => { const n = product?.liveNote; return n && n.text && liveActive(n.until, today) ? n : null; };
export const parseYesNo = raw => { const v = String(raw ?? "").trim().toLowerCase(); return /^(yes|y|ja|true|1)$/.test(v) ? true : /^(no|n|nee|false|0)$/.test(v) ? false : null; };
// null/"" and null are the same limit; otherwise compare as numbers (specs typed by hand are strings).
const eqNum = (a, b) => { const A = a == null || a === "" ? null : Number(a), B = b == null || b === "" ? null : Number(b); return A === B; };
export const normArticleId = x => String(x || "").trim().replace(/^HE/i, "").split("-")[0].replace(/\D/g, "").replace(/^0+/, "");

// ── Applying a mapped push to the catalog ───────────────────────────────────────────────────────────────────────
// rows: already mapped by the integration (applyMapping): { articleId, cuName?, sortable?, weight?, … , _errors }.
// Returns { products, report } — products is a new array (untouched objects are the same references).
export function applySpecSheet(products, rows, { createMissing = true, now = new Date().toISOString(), uid = () => Math.random().toString(36).slice(2, 10), tempSpecs = [] } = {}) {
  let temps = tempSpecs || []; let liveChanged = 0; const today = now.slice(0, 10);
  const byArticle = new Map(products.map(p => [normArticleId(p.articleId), p]));
  const out = [...products]; const issues = []; const coverage = {}; let updated = 0, created = 0, unchanged = 0, skipped = 0;
  const specKeys = Object.keys(SPEC_COLUMNS);
  specKeys.forEach(k => { coverage[k] = { filled: 0, placeholder: 0, empty: 0, unreadable: 0 }; });
  const seen = new Set();
  for (const r of rows) {
    if (r._errors?.length) { skipped++; continue; }
    const key = normArticleId(r.articleId); if (!key || seen.has(key)) { if (key) issues.push({ articleId: r.articleId, kind: "duplicate", note: "article listed twice — second row ignored" }); skipped++; continue; }
    seen.add(key);
    let p = byArticle.get(key); const existed = !!p;
    if (!p) {
      if (!createMissing) { issues.push({ articleId: r.articleId, kind: "unknown", note: "not in the catalog" }); skipped++; continue; }
      p = { id: uid(), articleId: String(r.articleId).trim(), name: String(r.cuName || r.articleId).trim(), categoryId: null, isBio: /\bbio\b/i.test(String(r.cuName || "")), cusPerTu: "", piecesPerCu: "", weightPerCu: "", specs: [], supplierIds: [], varieties: [], photos: [], fromSpecSheet: true };
      out.push(p); byArticle.set(key, p); created++;
      issues.push({ articleId: p.articleId, kind: "created", note: `added to the catalog from the sheet: ${p.name}` });
    }
    let next = p; let changed = false;
    const patch = ch => { next = { ...next, ...ch }; changed = true; };
    if (r.sortable !== undefined && r.sortable !== "") { const v = typeof r.sortable === "boolean" ? r.sortable : parseYesNo(r.sortable); if (v === null) issues.push({ articleId: p.articleId, kind: "unreadable", column: "sortable", note: String(r.sortable) }); else if (p.sortable?.value !== v) patch({ sortable: { value: v, origin: "sheet", syncedAt: now } }); }
    if (r.cuName && !p.sheetName) patch({ sheetName: String(r.cuName).trim() }); else if (r.cuName && p.sheetName !== String(r.cuName).trim()) patch({ sheetName: String(r.cuName).trim() });
    for (const k of specKeys) {
      if (!(k in r)) continue;
      const def = SPEC_COLUMNS[k]; let cell = parseSpecCell(r[k], def.unit);
      // A bare number ("4", "12") in a mm column next to the Head's own spec in cm is almost always cm with the unit left
      // off — read it in the Head's unit rather than flagging 4 mm vs 4–8 cm as a conflict.
      if (!cell.issue && def.unit === "mm" && !/[a-z]/i.test(String(r[k] ?? ""))) { const own = (next.specs || []).find(q => (q.name || "").toLowerCase() === def.name.toLowerCase() && (q.basis || "piece") === def.basis && q.origin !== "sheet" && q.unit && q.unit !== def.unit); if (own) cell = { ...cell, unit: own.unit, note: `read as ${own.unit} (no unit in the sheet)` }; }
      if (cell.issue) { coverage[k][cell.issue]++; if (cell.issue !== "empty") issues.push({ articleId: p.articleId, kind: cell.issue, column: k, spec: def.name, note: cell.note || "" }); continue; }
      coverage[k].filled++;
      const specs = next.specs || []; const ix = specs.findIndex(q => (q.name || "").toLowerCase() === def.name.toLowerCase() && (q.basis || "piece") === def.basis);
      const ex = ix >= 0 ? specs[ix] : null;
      const same = ex && eqNum(ex.min, cell.min) && eqNum(ex.max, cell.max) && (ex.unit || "") === cell.unit;
      // The sheet is a list of minimums: "≥ 4 cm" doesn't contradict the Head's "4–8 cm".
      const within = ex && (ex.unit || "") === cell.unit && cell.max == null && cell.min != null && eqNum(ex.min, cell.min);
      if (ex && ex.origin !== "sheet") {
        // "Keep mine" in the portal pins the sheet's raw cell on the spec; the conflict comes back only if the sheet changes it.
        if (!same && !within && ex.sheetIgnored !== String(r[k]).trim()) issues.push({ articleId: p.articleId, kind: "conflict", column: k, spec: def.name, specId: ex.id, sheet: { min: cell.min, max: cell.max, unit: cell.unit, raw: String(r[k]).trim() }, note: `sheet says ${fmtRange(cell)}, the Head's own spec says ${fmtRange(ex)} — the Head's kept` });
        continue;
      }
      if (same && ex.sheetRaw === String(r[k]).trim()) continue;
      const spec = { ...(ex || { id: uid() }), name: def.name, unit: cell.unit, basis: def.basis, min: cell.min, max: cell.max, origin: "sheet", sheetRaw: String(r[k]).trim(), syncedAt: now, ...(cell.note ? { note: cell.note } : {}) };
      if (cell.note) issues.push({ articleId: p.articleId, kind: "approximate", column: k, spec: def.name, note: cell.note });
      patch({ specs: ix >= 0 ? specs.map((q, i) => i === ix ? spec : q) : [...specs, spec] });
    }
    // Live value → a temporary minimum on the CU weight spec (sheet-owned, never touches the Head's own temporary specs) and/or a note.
    if ("live" in r) {
      const L = parseLiveCell(r.live, r.liveUntil, now); const tid = `sheet-live-${p.id}`;
      const mine = temps.find(t => t.id === tid && !t.endedAt);
      const endMine = how => { if (mine) { temps = temps.map(t => t === mine ? { ...t, endedAt: now, endedHow: how, endedBy: null } : t); liveChanged++; } };
      const dropNote = () => { if (next.liveNote && next.liveNote.origin === "sheet") { const { liveNote, ...rest } = next; next = rest; changed = true; liveChanged++; } };
      if (L.empty) { endMine("sheet"); dropNote(); }
      else if (!liveActive(L.expiresAt, today)) { endMine("expired"); dropNote(); issues.push({ articleId: p.articleId, kind: "expired", column: "live", note: `“${L.text}” ended ${L.expiresAt}` }); }
      else {
        const cw = (next.specs || []).find(q => (q.name || "").toLowerCase() === SPEC_COLUMNS.weight.name.toLowerCase() && (q.basis || "piece") === SPEC_COLUMNS.weight.basis);
        const headTemp = cw && temps.find(t => t.specId === cw.id && t.ownerKind === "product" && t.ownerId === p.id && !t.endedAt && t.origin !== "sheet");
        let useTemp = L.minWeight != null && !!cw && !headTemp && !(cw.min != null && Number(cw.min) === L.minWeight);
        if (L.minWeight != null && headTemp) issues.push({ articleId: p.articleId, kind: "conflict", column: "live", spec: SPEC_COLUMNS.weight.name, note: `sheet live value ${L.minWeight} g, but the Head has their own temporary spec — the Head's kept` });
        if (L.minWeight != null && !cw && L.pureWeight) issues.push({ articleId: p.articleId, kind: "live-no-spec", column: "live", note: `live value ${L.minWeight} g but the product has no CU weight spec to override — shown as a note` });
        if (useTemp) {
          const row = { id: tid, specId: cw.id, specName: cw.name, ownerKind: "product", ownerId: p.id, min: L.minWeight, max: null, unit: "g", note: `Sheet live value: ${L.text}`, expiresAt: L.expiresAt || null, createdAt: mine?.createdAt || now, createdBy: null, endedAt: null, endedHow: null, endedBy: null, origin: "sheet" };
          const same = mine && mine.min === row.min && mine.expiresAt === row.expiresAt && mine.specId === row.specId;
          if (!same) { temps = mine ? temps.map(t => t === mine ? row : t) : [...temps, row]; liveChanged++; }
        } else endMine("sheet");
        if (L.cuPerTu != null && p.cusPerTu && Number(p.cusPerTu) !== L.cuPerTu) issues.push({ articleId: p.articleId, kind: "live-mismatch", column: "live", note: `live value says ${L.cuPerTu} CU per TU, the catalog says ${p.cusPerTu}` });
        const wantNote = !(useTemp && L.pureWeight);
        if (wantNote) { const n = { text: L.text, until: L.expiresAt || null, cuPerTu: L.cuPerTu, origin: "sheet", syncedAt: now }; const ex = next.liveNote; if (!ex || ex.text !== n.text || ex.until !== n.until) { patch({ liveNote: n }); liveChanged++; } }
        else dropNote();
      }
    }
    if (changed) { const i = out.indexOf(p); out[i] = next; byArticle.set(key, next); if (existed) updated++; } else if (existed) unchanged++;
  }
  return { products: out, tempSpecs: temps, report: { at: now, liveChanged, rows: rows.length, updated, created, unchanged, skipped, coverage, issues, conflicts: issues.filter(i => i.kind === "conflict").length, placeholders: issues.filter(i => i.kind === "placeholder").length } };
}
// Resolving a conflict from the portal. "sheet": the Head's spec becomes the sheet's (from now on the sheet maintains it);
// "mine": keep the Head's value and stop reporting this exact sheet cell.
export function resolveSpecConflict(products, issue, choice, now = new Date().toISOString()) {
  return products.map(p => { if (normArticleId(p.articleId) !== normArticleId(issue.articleId)) return p;
    const specs = (p.specs || []).map(q => { if (q.id !== issue.specId) return q;
      if (choice === "sheet") { const { sheetIgnored, ...rest } = q; return { ...rest, min: issue.sheet.min, max: issue.sheet.max, unit: issue.sheet.unit, origin: "sheet", sheetRaw: issue.sheet.raw, syncedAt: now }; }
      return { ...q, sheetIgnored: issue.sheet.raw }; });
    return { ...p, specs }; });
}
export const fmtRange = q => { const mn = q?.min != null && q.min !== "" ? Number(q.min) : null, mx = q?.max != null && q.max !== "" ? Number(q.max) : null; const u = q?.unit || ""; return mn != null && mx != null ? `${mn}–${mx} ${u}` : mn != null ? `≥ ${mn} ${u}` : mx != null ? `≤ ${mx} ${u}` : "—"; };
