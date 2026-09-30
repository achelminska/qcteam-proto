// URL / storage bucket for a sheet push. Dock and blocked bots have used a few names
// for the same integration; anything else stays as-is (and is treated as Products).
export const sheetKind = raw => {
  const p = String(raw || "").toLowerCase().replace(/_/g, "-");
  if (p === "dock" || p === "docks") return "dock";
  if (p === "blocked" || p === "blocked-pallets" || p === "blockedpallets" || p === "block") return "blocked";
  if (p === "products" || p === "product") return "products";
  return p;
};

export const sheetPurposeName = kind => kind === "dock" ? "Dock" : kind === "blocked" ? "Blocked" : "Products";

export const mergeSheetFresh = (prev, incoming) => ({ ...(prev || {}), ...(incoming || {}) });

// /meta lists last-received times keyed by the canonical kind, so a push to
// /sheet/blocked-pallets still moves the Blocked clock.
export function metaSheets(storeSheets) {
  const out = {};
  for (const [p, v] of Object.entries(storeSheets || {})) {
    const k = sheetKind(p);
    const at = v?.receivedAt || "";
    if (!out[k] || at > out[k]) out[k] = at;
  }
  return out;
}

// Identical mapped rows are not a document change (phones must not full-pull), but
// lastPushAt / liveStatus still have to move so the dashboard clock is honest.
export function stampUnchangedPush(stored, nextIntegrations, targetIds) {
  const byId = Object.fromEntries((nextIntegrations || []).map(i => [i.id, i]));
  return {
    ...stored,
    integrations: (stored.integrations || []).map(i => {
      const n = byId[i.id];
      if (!n || !targetIds.has(i.id)) return i;
      return { ...i, lastPushAt: n.lastPushAt, liveStatus: n.liveStatus, lastSyncAt: n.lastSyncAt };
    }),
  };
}
