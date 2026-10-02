// Shift-update card decks — same rules on the phone and the controller web panel.
import { inspType, problemPath } from "./format.js";
import { briefingFp, seenFingerprints } from "./briefing-seen.js";

export const briefingAnnActive = a => !a?.validTo || a.validTo >= new Date().toISOString().slice(0, 10);

export const briefingComplaintsMeta = s => s?.complaints || { period: "", updatedAt: null, byUserId: null, rows: [] };

export const briefingAnnouncements = s => (s?.announcements || [])
  .filter(a => (a.showOnDashboard || a.isBlocking || a.productId || a.categoryId) && (a.isBlocking || briefingAnnActive(a)))
  .sort((a, b) => (!!b.isBlocking - !!a.isBlocking) || (b.createdAt || "").localeCompare(a.createdAt || ""));

export const briefingRejections = s => (s?.inspections || [])
  .filter(i => i.status === "Completed" && !inspType(s, i).autoAccept && i.result === "Rejected" && i.completedAt)
  .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));

export const briefingComplaints = s => [...briefingComplaintsMeta(s).rows]
  .filter(r => r.count)
  .sort((a, b) => (b.count || 0) - (a.count || 0) || (a.name || "").localeCompare(b.name || ""));

export const liveBriefingFps = s => [
  ...briefingAnnouncements(s).map(a => briefingFp({ kind: "ann", a })),
  ...briefingRejections(s).map(i => briefingFp({ kind: "rej", i })),
  ...briefingComplaints(s).map(c => briefingFp({ kind: "complaint", c })),
].filter(Boolean);

export const briefingUnseen = (s, userId) => {
  const seen = seenFingerprints(s, userId);
  const anns = briefingAnnouncements(s).filter(a => !seen.has(briefingFp({ kind: "ann", a })));
  const rejs = briefingRejections(s).filter(i => !seen.has(briefingFp({ kind: "rej", i })));
  const complaints = briefingComplaints(s).filter(c => !seen.has(briefingFp({ kind: "complaint", c })));
  return { anns, rejs, complaints, total: anns.length + rejs.length + complaints.length };
};

export const briefingTabDeck = (s, tab, userId) => {
  const u = briefingUnseen(s, userId);
  if (tab === "complaints") return u.complaints.map(c => ({ kind: "complaint", c }));
  if (tab === "notes") return u.anns.map(a => ({ kind: "ann", a }));
  return u.rejs.map(i => ({ kind: "rej", i }));
};

export const briefingDefaultTab = (s, userId) => {
  const u = briefingUnseen(s, userId);
  if (u.anns.length) return "notes";
  if (u.rejs.length) return "rejections";
  if (u.complaints.length) return "complaints";
  return "rejections";
};

export const briefingRemark = (s, r) => {
  const name = (problemPath(s?.problems || [], r.leafId) || "").split(" › ").pop() || "?";
  if (r.mode === "Presence") return name;
  const unit = r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : r.mode === "WholeUnitCount" ? "CU" : "";
  return r.raw != null && r.raw !== "" ? `${name} · ${r.raw}${unit ? ` ${unit}` : ""}` : name;
};

export const briefingItemsKey = userId => `qcteam-briefing-items-${userId}`;
