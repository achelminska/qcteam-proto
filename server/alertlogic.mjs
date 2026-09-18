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
// Notifies every active Controller and Head — once per level per pallet (warning, then again on breach), not every tick.
export function applyDeadlineAlerts(s) {
  const alerts = computeDeadlineAlerts(s);
  const known = s.deadlineAlerts || {};
  const nextKnown = {}; const newNotifs = []; const nowISO = new Date().toISOString();
  const targets = (s.users || []).filter(u => u.active !== false && (u.role === "Head" || u.role === "Controller"));
  for (const a of alerts) {
    const already = known[a.key];
    nextKnown[a.key] = { level: a.level, at: already?.level === a.level ? already.at : nowISO };
    if (already?.level === a.level) continue;
    const msg = a.level === "breached"
      ? `${a.name} at ${a.location}: past the rejection window — it can no longer be rejected.`
      : `${a.name} at ${a.location}: ${Math.max(0, Math.round(a.hoursLeft))}h left to inspect before the rejection window closes${a.risky ? " — rejected recently, treat as urgent" : ""}.`;
    for (const u of targets) newNotifs.push({ id: Math.random().toString(36).slice(2, 10), userId: u.id, type: a.level === "breached" ? "DeadlineBreached" : "DeadlineWarning", message: msg, entityType: "Product", entityId: a.productId, createdAt: nowISO, readAt: null });
  }
  const clearedSome = Object.keys(known).some(k => !nextKnown[k]);
  const sameCount = Object.keys(known).length === Object.keys(nextKnown).length;
  if (newNotifs.length === 0 && !clearedSome && sameCount) return null;
  return { ...s, deadlineAlerts: nextKnown, notifications: [...(s.notifications || []), ...newNotifs] };
}
