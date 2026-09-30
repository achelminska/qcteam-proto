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
