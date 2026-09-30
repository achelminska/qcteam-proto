// Optional PO on a rejection. Off until the Head turns it on in Settings.
// From a dock-sheet pallet we try the sheet's PO ID; otherwise the controller types it.

import { samePallet } from "./floor.js";

export function sheetPoForInspection(dockRows, insp) {
  const hus = (insp?.pallets || []).map(h => String(h).trim()).filter(Boolean);
  const hits = (dockRows || []).filter(r => hus.some(hu => samePallet(r.hu, hu)));
  const pos = [];
  for (const r of hits) {
    const po = String(r.po || "").trim();
    if (po && !pos.includes(po)) pos.push(po);
  }
  return { fromSheet: hits.length > 0, pos };
}

export function suggestedPo(insp, sheet) {
  const own = String(insp?.po || "").trim();
  if (own) return own;
  if (!sheet?.pos?.length) return "";
  return sheet.pos.join(", ");
}

export function poRequiredOnReject(requirePo, result, po) {
  if (!requirePo) return false;
  if (result !== "Rejected") return false;
  return !String(po || "").trim();
}

export function poSourceHint(sheet) {
  if (!sheet?.fromSheet) return "This inspection is not from the dock sheet — enter the PO.";
  if (sheet.pos.length > 1) return `Dock sheet has ${sheet.pos.length} PO numbers on these pallets.`;
  if (sheet.pos.length === 1) return "Filled from the dock sheet. Edit if it is wrong.";
  return "This pallet is on the dock sheet but has no PO — enter it.";
}
