// Same-day pallets of this product can go on one report — including when they
// have different PO numbers. PO is an order / admin split, not a quality lot.
// The controller must be allowed to cover several POs with one sample. We never
// block, quarantine, or split a pallet just because its PO differs. A different
// arrival day is a different delivery (quality may differ).

import { samePallet } from "./floor.js";

export function sameDeliveryRows(dockRows, inspectedHus, todayISO) {
  const mine = (inspectedHus || []).map(x => String(x).trim()).filter(Boolean);
  const rows = dockRows || [];
  const leftover = rows.filter(r => !mine.some(m => samePallet(m, r.hu)));
  const anchor = rows.find(r => mine.some(m => samePallet(m, r.hu)));
  const day = anchor ? anchor.arrived : mine.length ? todayISO : null;
  const list = leftover.map(r => ({ ...r, sameDay: day == null ? null : r.arrived === day }));
  return Object.assign(list, {
    basis: anchor ? "sheet" : mine.length ? "today" : "none",
    day,
  });
}

export const attachableSameDay = rows => (rows || []).filter(r => r.sameDay !== false);
export const otherDeliveryDay = rows => (rows || []).filter(r => r.sameDay === false);
