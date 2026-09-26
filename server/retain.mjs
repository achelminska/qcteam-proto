// A client save is the whole shared state. A phone that never saw a just-finished inspection (its copy was
// taken before the save, or the save was dropped and a later write went through) must not erase that inspection.
// Explicit wipes (X-Force) and imports (X-Replace) opt out. Returns the raw body to store.
export function retainInspections(currentRaw, incomingRaw) {
  let cur, inc;
  try { cur = JSON.parse(currentRaw); inc = JSON.parse(incomingRaw); }
  catch { return incomingRaw; }
  if (!inc || !Array.isArray(inc.inspections) || !Array.isArray(cur?.inspections)) return incomingRaw;
  const ids = new Set(inc.inspections.map(i => i && i.id).filter(id => id != null));
  const keep = cur.inspections.filter(i => i && i.id != null && !ids.has(i.id));
  if (!keep.length) return incomingRaw;
  inc.inspections = [...inc.inspections, ...keep];
  return JSON.stringify(inc);
}
