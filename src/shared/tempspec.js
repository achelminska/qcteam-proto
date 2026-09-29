// Temporary overrides on a catalog specification. The Head pins one onto a product
// or category spec: new min/max (optional), a note, and either a calendar end date
// or "until I change it". After the date the override stops applying by itself but
// stays in the list as expired so the Head can see what ran.
import { hasV } from "./format.js";

export const todayISO = (now = new Date()) => {
  const d = now instanceof Date ? now : new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const tempSpecIsActive = (t, today = todayISO()) => {
  if (!t || t.endedAt) return false;
  if (t.expiresAt && String(t.expiresAt) < today) return false;
  return true;
};

export const closeExpiredTempSpecs = (list, now = new Date()) => {
  const today = todayISO(now);
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  let changed = false;
  const next = (list || []).map(t => {
    if (!t || t.endedAt) return t;
    if (t.expiresAt && String(t.expiresAt) < today) {
      changed = true;
      return { ...t, endedAt: at, endedHow: "expired", endedBy: null };
    }
    return t;
  });
  return changed ? next : (list || []);
};

// Product-scoped override wins over a category one on the same spec id.
export const activeTempForSpec = (list, specId, productId, today = todayISO()) => {
  if (!specId) return null;
  const active = (list || []).filter(t => t.specId === specId && tempSpecIsActive(t, today));
  if (productId) {
    const own = active.find(t => t.ownerKind === "product" && t.ownerId === productId);
    if (own) return own;
  }
  return active.find(t => t.ownerKind === "category") || null;
};

export const applyTempSpec = (spec, temp) => {
  if (!spec || !temp) return spec;
  const next = { ...spec, temp, perm: { min: spec.min, max: spec.max, unit: spec.unit } };
  if (hasV(temp.min)) next.min = temp.min;
  if (hasV(temp.max)) next.max = temp.max;
  if (temp.unit) next.unit = temp.unit;
  return next;
};

export const upsertTempSpec = (list, incoming, now = new Date()) => {
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  const today = todayISO(now);
  const rows = list || [];
  const closed = rows.map(t => {
    if (t.id === incoming.id) return incoming;
    if (t.specId === incoming.specId && t.ownerKind === incoming.ownerKind && t.ownerId === incoming.ownerId && tempSpecIsActive(t, today)) {
      return { ...t, endedAt: at, endedHow: "replaced", endedBy: incoming.createdBy || null };
    }
    return t;
  });
  return closed.some(t => t.id === incoming.id) ? closed : [...closed, incoming];
};

export const clearTempSpec = (list, id, userId, now = new Date()) => {
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  return (list || []).map(t => (t.id === id && !t.endedAt ? { ...t, endedAt: at, endedHow: "cleared", endedBy: userId || null } : t));
};

export const tempUntilLabel = t => {
  if (!t) return "";
  if (!t.expiresAt) return "until changed";
  const d = new Date(`${t.expiresAt}T12:00:00`);
  if (Number.isNaN(d.getTime())) return `until ${t.expiresAt}`;
  return `until ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
};

export const tempOwnerLabel = (s, t) => {
  if (!t) return "—";
  if (t.ownerKind === "product") return s?.products?.find(p => p.id === t.ownerId)?.name || "product";
  if (t.ownerKind === "category") return s?.categories?.find(c => c.id === t.ownerId)?.name || "category";
  return t.ownerKind || "—";
};
