// Pure helpers shared by the Head portal and the controller app. No React, no DOM — safe to unit-test.

export const hasV = v => v !== null && v !== undefined && v !== "";

// ProductSpecification: MinValue / MaxValue (at least one). The "bad when" direction follows from what is set.
export const specLabel = q => {
  const mn = hasV(q.min), mx = hasV(q.max);
  const core = mn && mx ? `${q.min}–${q.max}` : mn ? `min ${q.min}` : mx ? `max ${q.max}` : "—";
  return `${core} ${q.unit || ""}`.trim();
};

// `now` is injectable so the labels can be tested without freezing the clock.
export const dayLabel = (iso, now = new Date()) => {
  if (!iso) return "—";
  const d = new Date(iso), t = now instanceof Date ? now : new Date(now);
  const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(t) - day(d)) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

// Full "Parent › Child" label for a problem-type id.
export const problemPath = (problems, id) => {
  const node = problems.find(p => p.id === id);
  if (!node) return "";
  const parent = node.parentId ? problemPath(problems, node.parentId) : "";
  return parent ? `${parent} › ${node.name}` : node.name;
};

// List field vs the product/category property bound to the same list.
// `expected` is an attribute `{ value }` or a raw string. null = nothing to compare.
export const listCheck = (expected, value) => {
  const exp = expected && typeof expected === "object" ? expected.value : expected;
  if (!hasV(exp) || exp === "—" || !hasV(value)) return null;
  return { expected: String(exp), ok: String(value) === String(exp) };
};

const pctText = n => `${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`;

// Quality-status "Found": a zero-tolerance group is presence-only; everything else is a %.
// Nothing found used to print "—" — the report should say 0%.
export function foundDisplay(agg, { zeroTol = false, present = false } = {}) {
  if (zeroTol) return present ? "present" : "0%";
  return pctText(Number(agg) || 0);
}

// Group tolerance, or the distinct tolerances of remarks that were found under it
// (Quality problems often has no number of its own — print decay's 1%, not unused Minor 10%).
export function toleranceDisplay(ownTol, remarkTols = []) {
  if (hasV(ownTol) || ownTol === 0) return pctText(Number(ownTol));
  const seen = [];
  for (const t of remarkTols) {
    if (!hasV(t) && t !== 0) continue;
    const s = pctText(Number(t));
    if (!seen.includes(s)) seen.push(s);
  }
  return seen.length ? seen.join(" · ") : "—";
}

// Bar fill for Quality status: own tolerance, else the strictest remark/group tolerance under it.
export function statusBarRatio(agg, ownTol, remarkTols = []) {
  if (Number(ownTol) > 0) return Number(agg) / Number(ownTol);
  const nums = remarkTols.map(Number).filter(t => t > 0);
  if (!nums.length) return null;
  return (Number(agg) || 0) / Math.min(...nums);
}

export function reportStatusFields({ name, agg, ownTol, present, state, remarkTols = [] }) {
  return {
    name,
    found: foundDisplay(agg, { zeroTol: ownTol === 0, present }),
    tolerance: toleranceDisplay(ownTol, remarkTols),
    state,
    ratio: statusBarRatio(agg, ownTol, remarkTols),
  };
}

// Number field vs a product/category spec (by specId, or by the field's specName / label).
export function matchFieldSpec(specs, f) {
  const list = specs || [];
  if (f?.specId) {
    const hit = list.find(q => q.id === f.specId);
    if (hit) return hit;
  }
  const wanted = ((f?.specName || "").trim() || f?.label || "").toLowerCase();
  if (!wanted) return null;
  const same = list.filter(q => (q.name || "").trim().toLowerCase() === wanted);
  const basis = f?.measureBasis || "piece";
  return same.find(q => (q.basis || "piece") === basis) || same[0] || null;
}

// Average of the readings against min/max (already converted to the field's basis).
export function numberSpecCheck({ min, max, unit }, measurements) {
  const nums = (measurements || []).map(Number).filter(n => n === n);
  if (!nums.length || !(hasV(min) || hasV(max))) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  const ok = !(hasV(min) && avg < Number(min)) && !(hasV(max) && avg > Number(max));
  return { expected: specLabel({ min, max, unit: unit || "" }), ok };
}

export const typesOf = s => [...(s.inspectionTypes || [])].sort((a, b) => a.sort - b.sort);
export const typeById = (s, id) => (s.inspectionTypes || []).find(t => t.id === id) || null;
export const legacyTypeId = t => t === "Visual" ? "type-visual" : t === "Skip" ? "type-skip" : "type-full";
export const inspType = (s, insp) => typeById(s, insp.typeId || legacyTypeId(insp.type)) || { id: "type-full", name: "Full", color: "#1F5C3E", autoAccept: false, countsAsInspection: true, reason: "none" };
export const countsAs = (s, insp) => inspType(s, insp).countsAsInspection !== false;
