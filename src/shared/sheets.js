// Dock and blocked sheets push on a timer. The shared state only stores a new document
// version when the mapped rows actually changed — identical pushes used to drop lastPushAt
// so phones did not re-download. Freshness then has to come from /meta (`window.__qcSheetFresh`).
import { useEffect, useState } from "react";
import { sheetKind } from "./sheet-kind.js";
export { sheetKind, sheetPurposeName, mergeSheetFresh, metaSheets, stampUnchangedPush } from "./sheet-kind.js";

export function sheetFreshness(s, live) {
  const L = live || (typeof window !== "undefined" && window.__qcSheetFresh) || {};
  return (s?.integrations || []).filter(i => (i.purpose === "Dock" || i.purpose === "Blocked") && (i.lastPushAt || L[i.purpose.toLowerCase()] || L[sheetKind(i.purpose)])).map(i => {
    const a = i.lastPushAt || "", b = L[i.purpose.toLowerCase()] || L[sheetKind(i.purpose)] || "";
    return { purpose: i.purpose, at: a > b ? a : b };
  });
}

export function useSheetFresh() {
  const [live, setLive] = useState(() => (typeof window !== "undefined" && window.__qcSheetFresh) || {});
  useEffect(() => {
    const h = e => setLive({ ...(e.detail || (typeof window !== "undefined" && window.__qcSheetFresh) || {}) });
    window.addEventListener("qc-sheet-fresh", h);
    return () => window.removeEventListener("qc-sheet-fresh", h);
  }, []);
  return live;
}
