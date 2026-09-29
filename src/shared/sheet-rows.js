// A dock/blocked row is usable as soon as we can tell *which* pallet it is.
// Arrival date is required in the Head's mapping, but the sheet blanks that
// column for minutes while formulas recalculate. Treating "arrived empty" as
// fatal hid brand-new pallets (they sat in the sheet, not in the app) and
// made the server throw away whole pushes ("kept last good data").
export const rowUsable = r => {
  if (!r) return false;
  const hu = String(r.hu || "").replace(/\D/g, "").replace(/^0+/, "");
  if (hu) return true;
  return !!(String(r.article || "").trim() && String(r.name || "").trim());
};

export const rowsUnusable = rows => (rows || []).filter(r => !rowUsable(r)).length;

// Mid-recalculation: most rows lose their identity (HU / article), right after
// a clean push. A push where only the date column went blank is not that —
// those rows still have HUs and must be applied so new pallets appear.
export const pushLooksLikeRecalc = (rows, prev) => {
  const next = rows || [], before = prev || [];
  const bad = rowsUnusable(next), prevBad = rowsUnusable(before);
  return next.length >= 5 && bad / next.length >= 0.5 && before.length >= 5 && prevBad / before.length < 0.2;
};
