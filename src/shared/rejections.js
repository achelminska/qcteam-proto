// The DC5 rejections sheet — every pallet the team rejected through the official flow (Slack post → sheet row), with
// what Inbound and Finance did about it afterwards. QCteam does not own these rows and never writes them: they are
// context. The sheet is pushed to /sheet/rejections like the dock sheet; the server boils it down to a compact per-article
// digest (state.extRejections) because the raw sheet is thousands of wide rows and the phones carry the whole state.
//
// Where the digest shows up: the pallet / scan header ("rejected 3× on the dock in 90 days, last 12 Sep — mould"),
// the product profile (recent rows with the Slack thread), the shift-update cards (last 7 days), and the "rejected
// recently" risk flag on the rejection-window countdown. Plain JS, no DOM. Tested in rejections.test.js.

export const REJECTION_TARGETS = [
  ["article", "Product ID (article)", true],
  ["name", "Product name", false],
  ["tu", "TU rejected", false],
  ["reason", "Reason for rejection", false],
  ["sortClass", "Sortable yes / no (+ reason class)", false],
  ["user", "Reported by", false],
  ["time", "Time", false],
  ["po", "PO ID", false],
  ["outcome", "Pallet picked up / thrown away", false],
  ["orderGroup", "Order group (supplier)", false],
  ["link", "Slack link", false],
  ["ignore", "— ignore —", false],
];
// Merged into the shared ALIASES as a union per key (the dock sheet owns "article", "name", "po", "time" too).
export const REJECTION_ALIASES = {
  article: ["productid", "articleid", "article", "sku", "uomid", "artikel"],
  name: ["productname", "itemname", "name", "product"],
  tu: ["turejected", "rejectedtu", "tus", "tu", "pallets"],
  reason: ["reasonforrejection", "reason", "remarks", "why"],
  sortClass: ["sortableyesno", "sortable", "sorteerbaar"],
  user: ["user", "reportedby", "controller", "by"],
  time: ["time", "timestamp", "datetime", "tijd"],
  po: ["poid", "po", "ponumber", "order"],
  outcome: ["palletpickeduporthrownaway", "pickeduporthrownaway", "outcome", "pickedup"],
  orderGroup: ["ordergroup", "supplier", "group", "leverancier"],
  link: ["slacklink", "slack", "link", "thread"],
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
const pad = n => String(n).padStart(2, "0");
const iso = (y, mo, d, h = 0, mi = 0) => { const Y = Number(y), M = Number(mo), D = Number(d); if (!(Y > 1990 && M >= 0 && M < 12 && D >= 1 && D <= 31)) return null; return `${Y}-${pad(M + 1)}-${pad(D)}T${pad(h)}:${pad(mi)}`; };
// Sheets shows the timestamp two ways depending on who typed it: "Jan 1, 2026, 16:48:39" and "18/05/2026 16:43:47".
// ISO ("2026-01-01T16:48:39") comes through getValues(). Local wall-clock, no zone — the day is what matters.
export function parseRejectionTime(raw) {
  const v = String(raw ?? "").trim(); if (!v) return null; let m;
  if ((m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(v))) return iso(m[1], Number(m[2]) - 1, m[3], m[4] || 0, m[5] || 0);
  // Apps Script's getValues() dates arrive as Date.toString(): "Thu Jan 01 2026 16:48:39 GMT+0100 (Central European Standard Time)"
  if ((m = /^[A-Za-z]{3},? ([A-Za-z]{3}) (\d{1,2}) (\d{4})(?: (\d{2}):(\d{2}))?/.exec(v))) { const mo = MONTHS[m[1].toLowerCase()]; return mo == null ? null : iso(m[3], mo, m[2], m[4] || 0, m[5] || 0); }
  if ((m = /^([A-Za-z]{3,4})\.? (\d{1,2}),? (\d{4})(?:,? (\d{1,2}):(\d{2}))?/.exec(v))) { const mo = MONTHS[m[1].toLowerCase()]; return mo == null ? null : iso(m[3], mo, m[2], m[4] || 0, m[5] || 0); }
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:,? (\d{1,2}):(\d{2}))?/.exec(v))) return iso(m[3], Number(m[2]) - 1, m[1], m[4] || 0, m[5] || 0);
  return null;
}
// "Yes - Quality (according to list)" → { sortable: true, cat: "Quality (according to list)" }; "No - Overripe" → false/Overripe.
export function parseSortableCell(raw) {
  if (typeof raw === "boolean") return { sortable: raw, cat: "" }; // a mapping with the Yes/No transform already decided
  const v = String(raw ?? "").trim(); if (!v) return { sortable: null, cat: "" };
  const m = /^(yes|no|ja|nee|y|n)\b\s*[-–:]?\s*(.*)$/i.exec(v);
  if (!m) return { sortable: null, cat: v.slice(0, 40) };
  return { sortable: /^(yes|ja|y)$/i.test(m[1]), cat: m[2].replace(/\s*\(explain reason in thread\)\s*$/i, "").trim() };
}
export const normArticle = x => String(x || "").trim().replace(/^HE/i, "").split("-")[0].replace(/\D/g, "").replace(/^0+/, "");
const clean = (v, n) => { const s = String(v ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
// "@Wieneke Konings" → "Wieneke Konings"; "damian.mrowka@teampicnic.com" → "Damian Mrowka" (the sheet moved from Slack handles to e-mails).
export const personName = raw => { const v = String(raw || "").trim().replace(/^@/, ""); const m = /^([^@\s]+)@/.exec(v); if (!m) return v; return m[1].split(/[._-]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" "); };
const compact = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v != null));
const numOf = v => { const m = /-?\d+(?:[.,]\d+)?/.exec(String(v ?? "")); return m ? Number(m[0].replace(",", ".")) : null; };
const dayOf = t => t ? t.slice(0, 10) : "";
const daysBetween = (a, b) => Math.round((new Date(a + "T00:00").getTime() - new Date(b + "T00:00").getTime()) / 86400000);

// ── QC One inspection reports (PDFs in the Inbound "Rejections QR" Drive folder) ──
// File names follow "<QC One inspection id>_<PO>_<Product ID>.pdf" (e.g. "8628561_1150837_11295128.pdf"; a browser's
// "(1)" copy suffix may sit after the first number). PO + article ties a file to a sheet row. The same article off the
// same PO is occasionally rejected twice; when the counts match they are paired oldest-to-oldest, otherwise every row of
// the pair gets all of its files — never a silent wrong guess.
export function parseReportName(name) {
  const m = /^(\d{5,})(?:\s*\(\d+\))?_(\d{5,})_(?:HE)?(\d{5,})(?:-\d+)?\.pdf$/i.exec(String(name || "").trim());
  return m ? { inspId: m[1], po: m[2], article: normArticle(m[3]) } : null;
}
export const reportUrl = id => `https://drive.google.com/file/d/${id}/view`;
// reports: [{ id, name, created? }] as the Apps Script lists the folder → { "po:article": [{ id, inspId, created }] } sorted oldest first.
export function indexReports(reports) {
  const idx = {};
  for (const f of reports || []) { const p = parseReportName(f?.name); if (!p || !f.id) continue; (idx[`${p.po}:${p.article}`] ||= []).push({ id: String(f.id), inspId: p.inspId, created: f.created || "" }); }
  for (const k of Object.keys(idx)) idx[k].sort((a, b) => (a.created || "").localeCompare(b.created || "") || a.inspId.localeCompare(b.inspId, undefined, { numeric: true }));
  return idx;
}
const poDigits = cell => (String(cell || "").match(/\d{5,}/g) || []);   // "1095993 and 1096382" → both
// Mutates the digest: every entry (per-article recent rows and the latest list) that has a report gets `pdf` (one url)
// or `pdfs` (several, when the pairing is ambiguous). Returns how many entries were linked.
export function attachReports(digest, reports) {
  const idx = indexReports(reports); let linked = 0; if (!Object.keys(idx).length) return 0;
  const groups = {}; // "po:article" → entries, oldest first, so a 1:1 pairing lines up with the files
  const collect = (e, article) => { for (const po of poDigits(e.po)) { const k = `${po}:${article}`; if (idx[k]) (groups[k] ||= []).push(e); } };
  for (const [a, g] of Object.entries(digest.byArticle || {})) for (const e of g.recent || []) collect(e, a);
  for (const e of digest.latest || []) collect(e, e.a);
  for (const [k, entries] of Object.entries(groups)) {
    const files = idx[k];
    // the same sheet row appears in recent AND latest as two objects — dedupe by (d, po) before pairing
    const uniq = [...new Map(entries.map(e => [`${e.d}|${e.po}`, e])).values()].sort((x, y) => (x.d || "").localeCompare(y.d || ""));
    uniq.forEach((u, i) => { const urls = files.length === uniq.length ? [reportUrl(files[i].id)] : files.map(f => reportUrl(f.id));
      entries.filter(e => e.d === u.d && e.po === u.po).forEach(e => { if (urls.length === 1) e.pdf = urls[0]; else e.pdfs = urls; linked++; }); });
  }
  return linked;
}

// rows: already mapped by the integration (applyMapping): { article, name?, tu?, reason?, sortable?, user?, time?, po?, outcome?, orderGroup?, link?, _errors }.
// Returns the digest stored at state.extRejections. Rebuilt whole on every push — the sheet is the source, nothing accumulates here.
export function buildRejectionDigest(rows, { now = new Date().toISOString(), windowDays = 365, recentPerArticle = 3, latestCount = 60, reports = null } = {}) {
  const today = now.slice(0, 10); const cutoff = new Date(new Date(today + "T00:00").getTime() - windowDays * 86400000).toISOString().slice(0, 10);
  const byArticle = {}; let used = 0, skipped = 0, undated = 0, old = 0; let from = null, to = null;
  const all = [];
  for (const r of rows || []) {
    if (r?._errors?.length) { skipped++; continue; }
    const key = normArticle(r.article); if (!key) { skipped++; continue; }
    const t = parseRejectionTime(r.time); if (!t) { undated++; }
    const day = dayOf(t);
    if (day && day < cutoff) { old++; continue; }
    const { sortable, cat } = parseSortableCell(r.sortClass ?? r.sortable);
    const e = compact({ a: key, n: clean(r.name, 60), d: t || "", tu: numOf(r.tu), reason: clean(r.reason, 100), cat: clean(cat, 40), sortable, user: clean(personName(r.user), 40), po: clean(r.po, 24), outcome: clean(r.outcome, 48), group: clean(r.orderGroup, 48), link: /^https?:\/\//.test(String(r.link || "")) ? String(r.link).trim() : "" });
    all.push(e); used++;
    if (day) { if (!from || day < from) from = day; if (!to || day > to) to = day; }
  }
  // newest first; undated rows sink to the bottom (they still count)
  all.sort((x, y) => (y.d || "").localeCompare(x.d || ""));
  for (const e of all) {
    const g = byArticle[e.a] || (byArticle[e.a] = { name: e.n || "", count: 0, tu: 0, last: "", c30: 0, c90: 0, cats: {}, recent: [] });
    g.count++; g.tu += e.tu || 0; if (!g.name && e.n) g.name = e.n;
    if (e.d && (!g.last || e.d > g.last)) g.last = e.d;
    if (e.d) { const age = daysBetween(today, dayOf(e.d)); if (age <= 30) g.c30++; if (age <= 90) g.c90++; }
    if (e.cat) g.cats[e.cat] = (g.cats[e.cat] || 0) + 1;
    if (g.recent.length < recentPerArticle) { const { a, n, ...rest } = e; g.recent.push(rest); }
  }
  const latest = all.filter(e => e.d).slice(0, latestCount);
  const digest = { updatedAt: now, windowDays, rows: (rows || []).length, used, skipped, undated, old, from, to, articles: Object.keys(byArticle).length, byArticle, latest };
  if (reports) { digest.reports = (reports || []).length; digest.reportsLinked = attachReports(digest, reports); }
  return digest;
}

// ── Reading the digest ──────────────────────────────────────────────────────────────────────────────────────────
export const extRejectionsFor = (s, articleId) => { const k = normArticle(articleId); return k && s?.extRejections?.byArticle ? s.extRejections.byArticle[k] || null : null; };
export const extRejectedRecently = (s, articleId, days, nowMs = Date.now()) => { const g = extRejectionsFor(s, articleId); if (!g?.last) return false; return nowMs - new Date(g.last).getTime() <= days * 86400000; };
export const topCats = (g, n = 2) => Object.entries(g?.cats || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
// One line for the pallet header / scan result / product profile. The apps only care about the last 30 days: an article
// rejected in spring says nothing about today's pallet. Nothing in 30 days → null → nothing shown. (The Head's Integrations
// panel still sees the whole year in the digest.) Counted from the digest's 30-day count when its recent rows show the
// window is saturated (3 kept per article), otherwise from the recent rows themselves — so an aging digest never over-reports.
export const EXT_REJECTION_DAYS = 30;
export function extRejectionLine(s, articleId, nowMs = Date.now(), days = EXT_REJECTION_DAYS) {
  const g = extRejectionsFor(s, articleId); if (!g || !g.count) return null;
  const cutoff = nowMs - days * 86400000;
  const recent = (g.recent || []).filter(e => e.d && new Date(e.d).getTime() >= cutoff);
  if (!recent.length) return null;
  const count = recent.length >= (g.recent || []).length && g.c30 > recent.length ? g.c30 : recent.length;
  const catsMap = {}; recent.forEach(e => { if (e.cat) catsMap[e.cat] = (catsMap[e.cat] || 0) + 1; });
  const cats = topCats({ cats: catsMap }); const mostly = cats[0] && count > 1 && cats[0].count * 2 > recent.length ? `mostly ${cats[0].name}` : "";
  const tu = recent.reduce((a, e) => a + (e.tu || 0), 0);
  return { count, span: `${days} days`, total: count, tu, last: recent[0].d, cats, mostly, tail: mostly, recent, name: g.name, yearCount: g.count };
}
// Shift-update cards: sheet rejections from the last `days` days, newest first (latest holds the newest 60 rows).
export const extRejectionsRecent = (s, days = 7, nowMs = Date.now()) => (s?.extRejections?.latest || []).filter(e => e.d && nowMs - new Date(e.d).getTime() <= days * 86400000);
export const extRejectionKey = e => `${e.a}:${e.d}:${e.po || ""}`;
export const fmtRejectionDay = (t, now = new Date()) => { if (!t) return "—"; const d = new Date(t); const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); const diff = Math.round((day(now) - day(d)) / 86400000); return diff === 0 ? "today" : diff === 1 ? "yesterday" : diff < 7 ? `${diff} days ago` : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
export const reportUrls = e => e?.pdfs?.length ? e.pdfs : e?.pdf ? [e.pdf] : [];
export const linkLabel = url => /slack\.com/i.test(url || "") ? "Slack thread" : /drive\.google|docs\.google/i.test(url || "") ? "Attached file" : "Open link";
