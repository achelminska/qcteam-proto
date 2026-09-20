// Rejection-deadline alerts: a pallet can only be rejected within `rejectionWindowHours` of arrival, sooner for a product
// rejected recently. This is the server-side twin of computeDeadlineAlerts()/settingsOf() in Portal.jsx — kept in sync by
// hand. This module is what actually *fires* notifications: it runs on a timer, independent of anyone having the app open.
const norm = h => String(h || "").replace(/\D/g, "").replace(/^0+/, "");
const samePallet = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
const settingsOf = s => ({ rejectionWindowHours: 24, deadlineWarnHours: 6, deadlineWarnHoursRisky: 10, riskyLookbackDays: 14, ...(s.settings || {}) });
const dockRows = s => {
  const it = (s.integrations || []).find(i => i.purpose === "Dock" && i.rows?.length);
  if (!it) return [];
  const seen = new Set();
  return it.rows.filter(r => !r._errors?.length)
    .map(r => ({ hu: String(r.hu || "").trim(), article: String(r.article || ""), name: r.name || "", location: r.location || "", arrived: r.arrived || "", arrivedTime: r.arrivedTime || "" }))
    .filter(r => { const k = norm(r.hu); if (!k || seen.has(k)) return false; seen.add(k); return true; });
};
const typeIsVerdict = (s, insp) => { const t = (s.inspectionTypes || []).find(x => x.id === (insp.typeId || "type-full")); return t ? !t.autoAccept : !["Visual", "Skip"].includes(insp.type); };

export function computeDeadlineAlerts(s, nowMs = Date.now()) {
  const st = settingsOf(s); const out = [];
  for (const r of dockRows(s)) {
    if (!r.arrived) continue;
    const covered = (s.inspections || []).some(i => i.status === "Completed" && (i.pallets || []).some(h => samePallet(h, r.hu)));
    if (covered) continue;
    // marked lost (lostPallets, keyed hu:<normalized>) and not seen since → no alert; twin of lostOf() in Portal.jsx
    const lostMark = (s.lostPallets || {})[`hu:${norm(r.hu)}`]; if (lostMark && !(s.inspections || []).some(i => i.status === "Completed" && (i.completedAt || "") > lostMark.at && (i.pallets || []).some(h => samePallet(h, r.hu)))) continue;
    const arrivalMs = new Date(`${r.arrived}T${r.arrivedTime || "00:00"}:00`).getTime();
    if (isNaN(arrivalMs)) continue;
    const deadlineAt = arrivalMs + st.rejectionWindowHours * 3600000;
    const hoursLeft = (deadlineAt - nowMs) / 3600000;
    const product = (s.products || []).find(p => p.articleId === r.article);
    const risky = product ? (s.inspections || []).some(i => i.productId === product.id && i.status === "Completed" && typeIsVerdict(s, i) && i.result === "Rejected" && i.completedAt && (nowMs - new Date(i.completedAt).getTime()) <= st.riskyLookbackDays * 86400000) : false;
    const threshold = risky ? st.deadlineWarnHoursRisky : st.deadlineWarnHours;
    const level = hoursLeft <= 0 ? "breached" : hoursLeft <= threshold ? "warning" : null;
    if (!level) continue;
    out.push({ key: `hu:${norm(r.hu)}`, hu: r.hu, article: r.article, name: r.name || product?.name || r.article, location: r.location, hoursLeft, risky, level, productId: product?.id || null });
  }
  return out.sort((a, b) => a.hoursLeft - b.hoursLeft);
}

// Mutates nothing; returns a new state object if anything changed (new/escalated alerts, or stale entries to clear), else null.
// No notifications any more: the closing window is shown live on the dashboards (countdown tiles that disappear when the
// pallet is inspected). A notification for something already on screen was noise — one pallet fanned out to every
// controller and the Head, twice. This only sweeps the ones already sent.
export function applyDeadlineAlerts(s) {
  const junk = n => n.type === "DeadlineWarning" || n.type === "DeadlineBreached";
  const notifications = (s.notifications || []).filter(n => !junk(n));
  if (notifications.length === (s.notifications || []).length && !s.deadlineAlerts) return null;
  const { deadlineAlerts, ...rest } = s; return { ...rest, notifications };
}
