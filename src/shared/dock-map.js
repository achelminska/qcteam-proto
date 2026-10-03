// Merge the blocked-pallet sheet onto the dock map so a pallet waiting in the
// blocked queue is drawn on the same dock bar as everything else standing there.
// "blocked" on the map already means Needed today (the dock sheet flag) — the
// queue uses QUEUE_STATUS ("queue") so the two colours stay distinct.

import { parseDock, samePallet } from "./floor.js";

export const QUEUE_STATUS = "queue";

export const isBlockedMapRow = r => r?.kind === "blocked" || !!r?.blockedQueue;
export const isBlockedOnlyMapRow = r => !!r?.blockedOnly;

const claimishKey = b => b?.key || (b?.hu ? `hu:${b.hu}` : `${b?.article || ""}|${b?.location || ""}`);

// Prefer a real dock code (D-07A). Bare "07A" / "7" from the blocked sheet is
// normalised so parseDock can place the pallet. pickLocation is the fallback
// when location is empty or not a dock.
export function blockedDockLocation(row) {
  for (const raw of [row?.location, row?.pickLocation]) {
    const loc = String(raw || "").trim();
    if (!loc) continue;
    if (parseDock(loc)) return loc;
    const bare = loc.match(/^0*(\d+)\s*([A-Z]?)$/i);
    if (bare) {
      const n = Number(bare[1]);
      const sub = (bare[2] || "").toUpperCase();
      return `D-${String(n).padStart(2, "0")}${sub}`;
    }
  }
  return String(row?.location || row?.pickLocation || "").trim();
}

export function openBlockedForMap(blockedQueueRows) {
  return (blockedQueueRows || []).filter(b => b.status !== "Completed" && !b.lost);
}

export function dockMapRows(dockRows, blockedOpen) {
  const out = (dockRows || []).map(r => ({ ...r, kind: r.kind || "dock" }));
  for (const b of blockedOpen || []) {
    const match = b.hu ? out.find(r => samePallet(r.hu, b.hu)) : null;
    if (match) {
      match.kind = "blocked";
      match.blockedQueue = true;
      match.mapKey = claimishKey(b);
      continue;
    }
    const location = blockedDockLocation(b);
    out.push({
      hu: b.hu || "",
      article: b.article || "",
      name: b.name || "",
      location,
      priority: "Inspection due",
      blocking: false,
      skippable: false,
      arrived: b.date || "",
      arrivedTime: b.time || "",
      transporter: "",
      supplier: "",
      po: "",
      cusPerTu: null,
      quantity: null,
      sortable: false,
      onDock: 0,
      inBuffer: 0,
      kind: "blocked",
      blockedQueue: true,
      blockedOnly: true,
      mapKey: claimishKey(b),
      deadline: b.deadline || "",
      zone: b.zone || "",
      pickLocation: b.pickLocation || "",
      wmsStatus: b.wmsStatus || "",
    });
  }
  return out;
}

// Blocked-only rows of the same article stay in their own group so a dock pallet
// of that SKU and a queue-only pallet do not collapse into one click target.
export function dockMapGroupKey(r) {
  if (r?.blockedOnly) return `blocked:${r.article || r.mapKey || r.hu || ""}`;
  return r?.article || r?.hu || r?.mapKey || "";
}

export function dockMapOpen(g) {
  const rows = g || [];
  const first = rows[0] || {};
  if (rows.length && rows.every(r => r.blockedOnly)) {
    return { key: first.mapKey || first.hu || first.article || "", blockedOnly: true };
  }
  const earliest = [...rows].sort((x, y) => `${x.arrived || ""}${x.arrivedTime || "99"}`.localeCompare(`${y.arrived || ""}${y.arrivedTime || "99"}`))[0] || first;
  return { key: earliest.hu || first.hu || first.article || "", blockedOnly: false };
}
