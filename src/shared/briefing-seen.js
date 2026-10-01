// Shift-update "already seen" lives in the shared document, per user. A card viewed
// on one phone must stay seen on the next. localStorage was per-device and came back
// as new after a refresh, another handset, or a cleared browser.

export const briefingSeenId = (userId, fp) => `${userId}:${fp}`;

export function briefingFp(c) {
  if (!c) return null;
  if (c.kind === "ann") return `ann:${c.a.id}`;
  if (c.kind === "rej") return `rej:${c.i.id}`;
  if (c.kind === "complaint") return `comp:${c.c.id}:${c.c.count}:${c.c.updatedAt || ""}`;
  return null;
}

export function seenFingerprints(s, userId) {
  return new Set((s?.briefingSeen || []).filter(r => r && r.userId === userId).map(r => r.fp));
}

export function markBriefingSeen(s, userId, fp, at, liveFps) {
  if (!s || !userId || !fp) return s;
  const id = briefingSeenId(userId, fp);
  let list = Array.isArray(s.briefingSeen) ? s.briefingSeen : [];
  if (liveFps) {
    const live = new Set(liveFps);
    list = list.filter(r => !r || r.userId !== userId || live.has(r.fp) || r.fp === fp);
  }
  if (list.some(r => r.id === id)) return list === s.briefingSeen ? s : { ...s, briefingSeen: list };
  return { ...s, briefingSeen: [...list, { id, userId, fp, at: at || "" }] };
}

export function adoptLocalBriefingSeen(s, userId, fps, at) {
  if (!s || !userId || !fps?.length) return s;
  return fps.filter(fp => typeof fp === "string" && fp).reduce((acc, fp) => markBriefingSeen(acc, userId, fp, at), s);
}
