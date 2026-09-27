// Who is on the floor right now, and how many inspections the team finished today.
// Pure helpers — no React. Portal and phone share one answer so the Head and inspectors see the same pins.

import { countsAs } from "./format.js";

export const FLOOR_STALE_MS = 3 * 60 * 60 * 1000;

export const parseDock = loc => {
  const m = String(loc || "").trim().match(/^D[-\s]?0*(\d+)\s*([A-Z]?)$/i);
  return m ? { n: Number(m[1]), sub: (m[2] || "").toUpperCase() } : null;
};

export const dockZone = n => n >= 5 && n <= 14 ? "chilled" : (n >= 1 && n <= 3) || n === 0 ? "ambient" : null;

export const dockLabel = n => n === 0 ? "D-00" : String(n);

export const samePallet = (a, b) => {
  const x = String(a || "").replace(/\D/g, "").replace(/^0+/, "");
  const y = String(b || "").replace(/\D/g, "").replace(/^0+/, "");
  return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x));
};

export const lastActivityAt = insp => {
  const times = [insp?.startedAt, insp?.completedAt, ...(insp?.audit || []).map(a => a.at)].filter(Boolean);
  return times.sort().slice(-1)[0] || null;
};

const isFresh = (iso, now, staleMs) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !isNaN(t) && (now - t) <= staleMs;
};

const locateRow = row => {
  const parsed = parseDock(row?.location);
  if (parsed && dockZone(parsed.n)) return { dock: parsed.n, location: row.location || "" };
  if (row?.location) return { dock: "other", location: row.location };
  return { dock: null, location: "" };
};

const rowForHu = (rows, hu) => (rows || []).find(r => samePallet(r.hu, hu)) || null;

const productNameOf = (s, insp, row) => {
  const p = (s.products || []).find(x => x.id === insp?.productId);
  return p?.name || row?.name || "";
};

const fromInspection = (s, rows, insp) => {
  const hus = (insp.pallets || []).filter(Boolean);
  const row = hus.map(h => rowForHu(rows, h)).find(Boolean) || null;
  const loc = row ? locateRow(row) : { dock: null, location: "" };
  return {
    userId: insp.controllerId,
    dock: loc.dock,
    location: loc.location,
    source: "inspection",
    status: insp.status,
    productName: productNameOf(s, insp, row),
    article: row?.article || "",
    hu: (row?.hu || hus[0] || ""),
    at: lastActivityAt(insp),
    inspectionId: insp.id,
  };
};

const fromClaim = (s, row, claim) => {
  const loc = locateRow(row);
  const p = (s.products || []).find(x => x.articleId && x.articleId === row.article);
  return {
    userId: claim.userId,
    dock: loc.dock,
    location: loc.location,
    source: "claim",
    status: "taken",
    productName: p?.name || row.name || "",
    article: row.article || "",
    hu: row.hu || "",
    at: claim.at || null,
    inspectionId: null,
  };
};

// Live inspectors: a recent Draft / PendingReview, placed by the HU on the dock or blocked sheet.
// No HU match → unplaced (never guess a dock from the product alone). Taken claim is the fallback.
export function peopleOnFloor(s, rows, { now = Date.now(), staleMs = FLOOR_STALE_MS } = {}) {
  const users = (s.users || []).filter(u => u.active !== false);
  const open = (s.inspections || []).filter(i => ["Draft", "PendingReview"].includes(i.status));
  const claims = s.palletClaims || {};
  const people = [];

  users.forEach(u => {
    const mine = open.filter(i => i.controllerId === u.id)
      .map(i => ({ i, at: lastActivityAt(i) }))
      .filter(x => isFresh(x.at, now, staleMs))
      .sort((a, b) => (b.at || "").localeCompare(a.at || ""));
    if (mine[0]) { people.push(fromInspection(s, rows, mine[0].i)); return; }

    const taken = Object.entries(claims)
      .filter(([, c]) => c && c.userId === u.id && c.status === "taken" && isFresh(c.at, now, staleMs))
      .map(([k, c]) => {
        const row = k.startsWith("hu:")
          ? (rows || []).find(r => r.hu && samePallet(r.hu, k.slice(3)))
          : (rows || []).find(r => `${r.article}|${r.location}` === k);
        return row ? { row, c } : null;
      })
      .filter(Boolean)
      .sort((a, b) => (b.c.at || "").localeCompare(a.c.at || ""));
    if (taken[0]) people.push(fromClaim(s, taken[0].row, taken[0].c));
  });

  return people.sort((a, b) => (b.at || "").localeCompare(a.at || ""));
}

export const peopleAtDock = (people, n) => (people || []).filter(p => p.dock === n);
export const peopleUnplaced = people => (people || []).filter(p => p.dock == null);

export const floorWhere = p => {
  if (!p) return "location unknown";
  if (p.dock === "other") return p.location || "other location";
  if (p.dock === 0) return "D-00";
  if (typeof p.dock === "number") return `Dock ${p.dock}`;
  return "location unknown";
};

export const floorVerb = p => p?.source === "claim" ? "taken" : p?.status === "PendingReview" ? "awaiting Head" : "inspecting";

export function doneTodayCount(s, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  return (s.inspections || []).filter(i => i.status === "Completed" && countsAs(s, i) && (i.completedAt || "").slice(0, 10) === today).length;
}

export function doneTodayByUser(s, userId, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  return (s.inspections || []).filter(i => i.controllerId === userId && i.status === "Completed" && countsAs(s, i) && (i.completedAt || "").slice(0, 10) === today).length;
}
