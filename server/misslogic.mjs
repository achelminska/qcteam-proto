// Unreported pallets: a pallet is on the dock sheet, then a later push no longer lists it — picked or moved on
// without QC ever touching it. Nobody would otherwise notice, because the dock sheet simply stops mentioning it.
// This runs on every dock push, server-side, independent of any open app — the same reason server/alertlogic.mjs
// runs there and not only in the browser.
//
// A pallet isn't logged the instant it goes missing: it first becomes a "candidate" (dockGoneCandidates, keyed by
// normalized HU). Only if it is STILL missing on a later push — i.e. it survived one full push cycle absent, not
// just one instant — does it get confirmed. This absorbs the sheet's own hiccups (a formula recalculating,
// IMPORTRANGE lag) that can drop a handful of rows for a single push without anything real having happened.
// A candidate that reappears before confirmation is dropped silently — it was never actually gone.
const norm = h => String(h || "").replace(/\D/g, "").replace(/^0+/, "");
const samePallet = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
// Rows with no HU have no stable identity to track disappearance by — they can't be told apart from one push to the next.
const cleanRows = rows => { const seen = new Set(); return (rows || []).filter(r => !r._errors?.length).map(r => ({
  hu: String(r.hu || "").trim(), article: String(r.article || ""), name: r.name || "", location: r.location || "",
  priority: r.priority || "", po: r.po || "", transporter: r.transporter || "", arrived: r.arrived || "", arrivedTime: r.arrivedTime || "", cusPerTu: r.cusPerTu || "",
})).filter(r => { const k = norm(r.hu); if (!k || seen.has(k)) return false; seen.add(k); return true; }); };
const dockRowsOf = st => (st.integrations || []).find(i => i.purpose === "Dock" && i.pushMode)?.rows || [];

// st: the app state AFTER this push was applied (so its Dock rows already reflect the outcome — including the
// "kept last good data" bail-outs in applyPushToState, which leave rows unchanged and so never produce a diff).
// prevDockRows: the Dock integration's rows as they were BEFORE this push (caller must capture this first).
// pushAt: this push's receivedAt, used both as the "first missed" timestamp and to recognise "was this the push
// that first noticed it, or a later one" without a separate counter.
export function computeMissingPalletUpdate(st, prevDockRows, pushAt) {
  const prevRows = cleanRows(prevDockRows), newRows = cleanRows(dockRowsOf(st));
  const newSet = new Set(newRows.map(r => norm(r.hu)));
  const candidates = { ...(st.dockGoneCandidates || {}) };
  const incidents = [...(st.unreportedPallets || [])];
  let changed = false;
  // Reappeared: back on the dock before confirmation — a false alarm, not a real disappearance.
  Object.keys(candidates).forEach(k => { if (newSet.has(k)) { delete candidates[k]; changed = true; } });
  // Missing for the first time this push: start the clock, but don't confirm yet.
  prevRows.forEach(r => { const k = norm(r.hu); if (!k || newSet.has(k) || candidates[k]) return; candidates[k] = { ...r, lastSeenAt: pushAt }; changed = true; });
  // Missing since a strictly earlier push (it survived a full cycle absent) → confirmed. Log it, unless a completed
  // report already covers this exact pallet (then the sheet just never removed it after QC handled it — not an incident).
  Object.entries(candidates).forEach(([k, c]) => {
    if (c.lastSeenAt === pushAt) return; // first noticed missing on THIS push — give it one more cycle
    const covered = (st.inspections || []).some(i => i.status === "Completed" && (i.pallets || []).some(h => samePallet(h, c.hu)));
    if (!covered) incidents.push({ id: `${k}-${pushAt}`, hu: c.hu, article: c.article, name: c.name, location: c.location, priority: c.priority, po: c.po, transporter: c.transporter, arrived: c.arrived, arrivedTime: c.arrivedTime, cusPerTu: c.cusPerTu, lastSeenAt: c.lastSeenAt, detectedAt: pushAt, reviewedAt: null, reviewedByUserId: null, reviewNote: "" });
    delete candidates[k]; changed = true;
  });
  if (!changed) return null;
  // Bounded log, like __pushlog/backups elsewhere in this server — an operational history, not an unbounded table.
  return { ...st, dockGoneCandidates: candidates, unreportedPallets: incidents.slice(-500) };
}
