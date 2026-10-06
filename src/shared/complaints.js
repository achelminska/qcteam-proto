// Customer freshness complaints, as the Head of Quality posts them: a "top articles" table, re-posted most days with the
// week-to-date totals ("Absolute complaints week 40"). Each paste is kept as a snapshot — the week it belongs to, the day
// it is the state of, who pasted it and when, and the rows. The numbers in a post are CUMULATIVE within the week, so:
//   - the week's figure is its LATEST snapshot, not a sum;
//   - the change between two posts of the same week is the delta of their counts;
//   - a post lists the top N articles only: an article that drops out is "below the list", not zero. Everything here
//     returns null for "not listed" and leaves it to the UI to say so.
// Plain JS, no DOM — imported by the portal and covered by complaints.test.js.

export const normArticle = x => String(x || "").trim().replace(/^HE/i, "").split("-")[0].replace(/\D/g, "").replace(/^0+/, "");

// ── Reading the Head of Quality's table ──
// Pasted straight from the post / sheet, tab-, semicolon- or comma-separated. Two shapes are in use:
//   Article ID · Article · Freshness complaints · Top sub-type
//   Article ID · Article · Freshness complaints · Top sub-type · Freshness per 1k · Delivered items
// A header row and a leading row number are ignored; "Spoiled (29)" splits into the sub-type and its count. Columns after
// the sub-type are read by position: the complaint rate per 1 000 delivered items, then the items delivered. Unknown extra
// columns are kept out of the way rather than glued onto the sub-type.
const isInt = c => /^\d+$/.test(c);
const isNum = c => /^\d+([.,]\d+)?$/.test(c);
const num = c => Number(String(c).replace(",", "."));
export function parseComplaintRows(text) {
  const out = [];
  String(text || "").split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const sep = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
    let cells = line.split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
    if (cells.length >= 4 && /^\d{1,4}$/.test(cells[0]) && /^(HE)?\d{5,}/i.test(cells[1])) cells = cells.slice(1); // leading row number
    const idIx = cells.findIndex(c => /^(HE)?\d{5,}(-\d+)?$/i.test(c)); if (idIx < 0) return;              // header / junk line
    const articleId = cells[idIx]; const rest = cells.slice(idIx + 1);
    const countIx = rest.findIndex((c, i) => i > 0 && isInt(c));
    const name = rest.slice(0, countIx > 0 ? countIx : 1).join(" ").trim();
    const count = countIx > 0 ? Number(rest[countIx]) : Number(rest.find(isInt) || 0);
    const after = rest.slice(countIx > 0 ? countIx + 1 : 1).filter(c => c !== "");
    // the sub-type is the first non-numeric cell after the count ("Spoiled (29)", or just "Spoiled")
    const subIx = after.findIndex(c => !isNum(c));
    const subRaw = subIx >= 0 ? after[subIx] : ""; const m = subRaw.match(/^(.*?)\s*\((\d+)\)\s*$/);
    const nums = (subIx >= 0 ? after.slice(subIx + 1) : after).filter(isNum);
    let per1k = null, delivered = null;
    if (nums.length >= 2) { per1k = num(nums[0]); delivered = Math.round(num(nums[1])); }
    else if (nums.length === 1) { if (/[.,]/.test(nums[0])) per1k = num(nums[0]); else delivered = Number(nums[0]); }
    const row = { articleId, name, count: isFinite(count) ? count : 0, subType: m ? m[1].trim() : subRaw, subCount: m ? Number(m[2]) : null };
    if (per1k != null) row.per1k = per1k; if (delivered != null) row.delivered = delivered;
    out.push(row);
  });
  return out;
}
// "8.9 per 1k" — one decimal, as the Head's table shows it.
export const fmtPer1k = v => v == null || !isFinite(v) ? "" : `${Math.round(v * 10) / 10} per 1k`;

// ── ISO weeks (the same calendar as the date code on inspections: week 40 = 28 Sep – 4 Oct 2026) ──
const pad = n => String(n).padStart(2, "0");
export const dayISO = d => { const x = d instanceof Date ? d : new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const todayISO = () => dayISO(new Date());
export function isoWeekOf(dateISO) {
  const d = new Date(`${String(dateISO).slice(0, 10)}T12:00:00`); if (isNaN(d)) return "";
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(); const week = Math.ceil(((t - Date.UTC(y, 0, 1)) / 86400000 + 1) / 7);
  return `${y}-W${pad(week)}`;
}
export const parseWeek = w => { const m = /^(\d{4})-W(\d{1,2})$/.exec(String(w || "").trim()); return m ? { year: Number(m[1]), week: Number(m[2]) } : null; };
export const weekLabel = w => { const p = parseWeek(w); return p ? `Week ${p.week}` : String(w || ""); };
// Monday of an ISO week, and the Sunday after it.
export function weekRange(w) {
  const p = parseWeek(w); if (!p) return null;
  const jan4 = new Date(Date.UTC(p.year, 0, 4)); const day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4); monday.setUTCDate(jan4.getUTCDate() - day + 1 + (p.week - 1) * 7);
  const sunday = new Date(monday); sunday.setUTCDate(monday.getUTCDate() + 6);
  const iso = d => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday) };
}
export const shiftWeek = (w, n) => { const r = weekRange(w); if (!r) return w; const d = new Date(`${r.from}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 7 * n); return isoWeekOf(d.toISOString().slice(0, 10)); };
// "Week 40" or "week 40 · 28 Sep–4 Oct" typed as a period label → the ISO week, when it can be read.
export const weekFromLabel = (label, yearHint) => { const m = /\bweek\s*(\d{1,2})\b/i.exec(String(label || "")); if (!m) return ""; const y = yearHint || new Date().getFullYear(); return `${y}-W${pad(Number(m[1]))}`; };

// ── Snapshots ──
export const sortSnapshots = snaps => [...(snaps || [])].sort((a, b) => (a.asOf || "").localeCompare(b.asOf || "") || (a.importedAt || "").localeCompare(b.importedAt || ""));
export const latestSnapshot = snaps => { const s = sortSnapshots(snaps); return s.length ? s[s.length - 1] : null; };
export const snapshotTotal = snap => (snap?.rows || []).reduce((a, r) => a + (Number(r.count) || 0), 0);
export const rowFor = (snap, articleId) => { const k = normArticle(articleId); return k ? (snap?.rows || []).find(r => normArticle(r.articleId) === k) || null : null; };
// Same week + same "as of" day → the new paste replaces the old one (a correction), otherwise it is appended.
export function upsertSnapshot(snaps, snap) {
  const rest = (snaps || []).filter(x => !(x.week === snap.week && x.asOf === snap.asOf) && x.id !== snap.id);
  return sortSnapshots([...rest, snap]);
}
export const snapshotsOfWeek = (snaps, week) => sortSnapshots(snaps).filter(x => x.week === week);
// The post before this one within the same week, if any — what a "since 27 Sep" delta is measured against.
export const previousInWeek = (snaps, snap) => { const w = snapshotsOfWeek(snaps, snap?.week); const i = w.findIndex(x => x.id === snap?.id); return i > 0 ? w[i - 1] : null; };
// Per-article change between two posts of the same week. null = the article is not in the earlier post (new to the list).
export const deltaRows = (prev, next) => (next?.rows || []).map(r => { const p = rowFor(prev, r.articleId); return { ...r, delta: p ? (Number(r.count) || 0) - (Number(p.count) || 0) : null }; });
export function subTypeMix(snap) {
  const m = {}; (snap?.rows || []).forEach(r => { if (!r.subType) return; m[r.subType] = (m[r.subType] || 0) + (r.subCount != null ? Number(r.subCount) || 0 : 0); });
  return Object.entries(m).map(([subType, count]) => ({ subType, count })).sort((a, b) => b.count - a.count);
}

// One line per week: the latest post carries the figures; the others only say how often the Head posted.
export function weekSeries(snaps) {
  const byWeek = new Map();
  sortSnapshots(snaps).forEach(x => { if (!byWeek.has(x.week)) byWeek.set(x.week, []); byWeek.get(x.week).push(x); });
  return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, posts]) => {
    const latest = posts[posts.length - 1]; const rows = [...(latest.rows || [])].sort((a, b) => (Number(b.count) || 0) - (Number(a.count) || 0));
    return { week, label: weekLabel(week), range: weekRange(week), posts: posts.length, days: posts.map(p => p.asOf), asOf: latest.asOf, latest, total: snapshotTotal(latest), articles: rows.length, top: rows[0] || null, subTypes: subTypeMix(latest) };
  });
}
// An article's week-by-week count from the latest post of each week; null where it was not on the list.
export const articleTrend = (series, articleId) => series.map(w => { const r = rowFor(w.latest, articleId); return { week: w.week, label: w.label, count: r ? Number(r.count) || 0 : null }; });
// Articles worth a trend line: those that were on the list in the most weeks (then by their latest count).
export function topArticles(series, n = 8) {
  const seen = new Map();
  series.forEach(w => (w.latest.rows || []).forEach(r => { const k = normArticle(r.articleId); if (!k) return; const e = seen.get(k) || { key: k, articleId: r.articleId, name: r.name || "", weeks: 0, last: 0 }; e.weeks++; e.last = Number(r.count) || 0; if (r.name) e.name = r.name; seen.set(k, e); }));
  return [...seen.values()].sort((a, b) => b.weeks - a.weeks || b.last - a.last).slice(0, n);
}

// What the rest of the apps read (chips, product notes, the phone): the latest post in the old single-list shape,
// with a period label the floor can read. Written through into state so phones on an older build keep working.
const fmtDay = iso => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return isNaN(d) ? String(iso || "") : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
export function asLegacyMeta(snap, snaps) {
  if (!snap) return { period: "", updatedAt: null, byUserId: null, rows: [] };
  const posts = snaps ? snapshotsOfWeek(snaps, snap.week).length : 1;
  return { period: `${weekLabel(snap.week)} · as of ${fmtDay(snap.asOf)}${posts > 1 ? ` (${posts} posts)` : ""}`, updatedAt: snap.importedAt || null, byUserId: snap.byUserId || null, rows: snap.rows || [], week: snap.week, asOf: snap.asOf, snapshotId: snap.id };
}
// First run after this change: the one list that used to live in state becomes the first snapshot.
export function migrateLegacy(complaints, uid) {
  if (!complaints || !Array.isArray(complaints.rows) || !complaints.rows.length) return [];
  const asOf = dayISO(complaints.updatedAt || new Date()); const yearHint = Number(asOf.slice(0, 4));
  const week = weekFromLabel(complaints.period, yearHint) || isoWeekOf(asOf);
  return [{ id: uid(), week, asOf, importedAt: complaints.updatedAt || new Date().toISOString(), byUserId: complaints.byUserId || null, rows: complaints.rows }];
}
