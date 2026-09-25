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

export const typesOf = s => [...(s.inspectionTypes || [])].sort((a, b) => a.sort - b.sort);
export const typeById = (s, id) => (s.inspectionTypes || []).find(t => t.id === id) || null;
export const legacyTypeId = t => t === "Visual" ? "type-visual" : t === "Skip" ? "type-skip" : "type-full";
export const inspType = (s, insp) => typeById(s, insp.typeId || legacyTypeId(insp.type)) || { id: "type-full", name: "Full", color: "#1F5C3E", autoAccept: false, countsAsInspection: true, reason: "none" };
export const countsAs = (s, insp) => inspType(s, insp).countsAsInspection !== false;
