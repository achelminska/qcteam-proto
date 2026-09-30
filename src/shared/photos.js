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

const byModuleSort = (a, b) => (Number(a?.sort) - Number(b?.sort)) || String(a?.id || "").localeCompare(String(b?.id || ""));

// Same walk as the form: module 1 fields + remarks, then module 2, …
export function photoGroupsByModule({ modules = [], fields = [], photos = {}, remarks = [], remarkModuleId, labelField, labelRemark }) {
  const groups = [];
  const usedFields = new Set(), usedRemarks = new Set();
  const pushField = f => {
    if (usedFields.has(f.id)) return;
    const ph = flattenPhotos(photos[f.id]);
    if (!ph.length) return;
    usedFields.add(f.id);
    groups.push({ key: f.id, label: labelField(f), photos: ph });
  };
  const pushRemark = r => {
    if (!r || usedRemarks.has(r.id)) return;
    const ph = flattenPhotos(r.photos);
    if (!ph.length) return;
    usedRemarks.add(r.id);
    groups.push({ key: r.id, label: labelRemark(r), photos: ph });
  };
  for (const m of [...modules].sort(byModuleSort)) {
    [...fields].filter(f => f.moduleId === m.id).sort(byModuleSort).forEach(pushField);
    (remarks || []).filter(r => remarkModuleId?.(r) === m.id).forEach(pushRemark);
  }
  [...fields].sort(byModuleSort).forEach(pushField);
  (remarks || []).forEach(pushRemark);
  return groups;
}
