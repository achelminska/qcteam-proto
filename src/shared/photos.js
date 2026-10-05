// pickPhotos used to return an array. It now returns { out, failed }. Callers that
// still do `if (got.length)` silently drop every photo — remarks used that shape.
export const asPhotoList = v => Array.isArray(v) ? v : [];

export const pickedPhotos = res => Array.isArray(res) ? res : (res && Array.isArray(res.out) ? res.out : []);

export function flattenPhotos(v) {
  const out = [];
  const walk = item => {
    if (!item) return;
    if (typeof item === "string") { if (item.trim()) out.push(item.trim()); return; }
    if (Array.isArray(item)) { item.forEach(walk); return; }
    if (Array.isArray(item.out)) { item.out.forEach(walk); return; }
    if (item.path || item.dataUrl || item.src || item.url || item.id) out.push(item);
  };
  walk(v);
  return out;
}

export function replacePhoto(list, id, next) {
  if (!id || !next) return asPhotoList(list);
  return asPhotoList(list).map(p => {
    if (p.id !== id) return p;
    const merged = { ...p, ...next, id: p.id };
    // persistPicked drops dataUrl once a /photos path exists. A rotate/replace
    // that only sends `path` must not keep the old multi-MB data URL around —
    // the PDF used to prefer it and then fail to decode, hiding the file.
    if (next.path && next.dataUrl == null) delete merged.dataUrl;
    return merged;
  });
}

export function replaceRemarkPhoto(remarks, remarkId, photoId, next) {
  return (remarks || []).map(q => q.id === remarkId ? { ...q, photos: replacePhoto(q.photos, photoId, next) } : q);
}

export function attachRemarkPhotos(remarks, remarkId, photos) {
  const add = pickedPhotos(photos);
  if (!remarkId || !add.length) return remarks || [];
  return (remarks || []).map(q => q.id === remarkId ? { ...q, photos: [...asPhotoList(q.photos), ...add] } : q);
}

// Same comparator as the inspection tabs (`bySort` in Mobile/Portal).
export const byFormSort = (a, b) => (a.sort - b.sort) || ((a.level ?? 0) - (b.level ?? 0)) || String(a?.id || "").localeCompare(String(b?.id || ""));

// Same walk as the form: module 1 (Unit data) fields + remarks, then module 2 (Parameters), …
export function photoGroupsByModule({ modules = [], fields = [], photos = {}, remarks = [], remarkModuleId, labelField, labelRemark }) {
  const groups = [];
  const usedFields = new Set(), usedRemarks = new Set();
  const mods = [...modules].sort(byFormSort);
  const modOf = id => mods.find(m => m.id === id);
  const pushField = (f, m) => {
    if (!f || usedFields.has(f.id)) return;
    const ph = flattenPhotos(photos[f.id]);
    if (!ph.length) return;
    usedFields.add(f.id);
    groups.push({ key: f.id, label: labelField(f), module: (m || modOf(f.moduleId) || {}).name || "", photos: ph });
  };
  const pushRemark = (r, m) => {
    if (!r || usedRemarks.has(r.id)) return;
    const ph = flattenPhotos(r.photos);
    if (!ph.length) return;
    usedRemarks.add(r.id);
    groups.push({ key: r.id, label: labelRemark(r), module: (m || {}).name || "", photos: ph });
  };
  for (const m of mods) {
    [...fields].filter(f => f.moduleId === m.id).sort(byFormSort).forEach(f => pushField(f, m));
    (remarks || []).filter(r => remarkModuleId?.(r) === m.id).forEach(r => pushRemark(r, m));
  }
  [...fields]
    .filter(f => !usedFields.has(f.id))
    .sort((a, b) => byFormSort(modOf(a.moduleId) || { sort: 999, id: "" }, modOf(b.moduleId) || { sort: 999, id: "" }) || byFormSort(a, b))
    .forEach(f => pushField(f, modOf(f.moduleId)));
  (remarks || []).forEach(r => pushRemark(r, modOf(remarkModuleId?.(r))));
  for (const [k, v] of Object.entries(photos || {})) {
    if (usedFields.has(k)) continue;
    const ph = flattenPhotos(v);
    if (!ph.length) continue;
    usedFields.add(k);
    groups.push({ key: k, label: "Photos", module: "", photos: ph });
  }
  return groups;
}

// ── Thumbnails ──────────────────────────────────────────────────────────────────────────────────────────────────
// A photo is { id, path, thumb?, at, name }. `path` is the full picture (≤ 1600 px), `thumb` a ≤ 480 px copy for
// lists, tiles, headers and the card hero — a product screen used to pull 2–3 MB of full-size pictures to draw
// 44 px squares. The viewer, rotation and the PDF keep using `path`. Older photos have no thumb yet: they fall
// back to the full picture, and the Head can backfill them from the Data panel (thumbsMissing / withThumb).
export const THUMB_EDGE = 480;
export const thumbSrc = ph => (ph && (ph.thumb || ph.path || ph.dataUrl)) || "";
const isStoredPhoto = v => v && typeof v === "object" && !Array.isArray(v) && typeof v.path === "string" && v.path.startsWith("/photos/");
// Every stored photo object anywhere in the state that still has no thumbnail, with the path (keys) to reach it.
export function thumbsMissing(state, limit = Infinity) {
  const out = [];
  const walk = (node, trail) => {
    if (out.length >= limit || !node || typeof node !== "object") return;
    if (isStoredPhoto(node) && !node.thumb) { out.push({ trail, photo: node }); return; }
    if (Array.isArray(node)) node.forEach((x, i) => walk(x, [...trail, i]));
    else Object.keys(node).forEach(k => walk(node[k], [...trail, k]));
  };
  walk(state, []);
  return out;
}
// Returns a copy of `state` with the photo at `trail` given `thumb` (untouched branches keep their identity).
export function withThumb(state, trail, thumb) {
  const step = (node, i) => {
    if (i === trail.length) return { ...node, thumb };
    const k = trail[i]; const child = step(node[k], i + 1);
    if (Array.isArray(node)) { const copy = node.slice(); copy[k] = child; return copy; }
    return { ...node, [k]: child };
  };
  return step(state, 0);
}
