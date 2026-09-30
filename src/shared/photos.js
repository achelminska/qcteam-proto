// pickPhotos used to return an array. It now returns { out, failed }. Callers that
// still do `if (got.length)` silently drop every photo — remarks used that shape.
export const asPhotoList = v => Array.isArray(v) ? v : [];

export const pickedPhotos = res => Array.isArray(res) ? res : (res && Array.isArray(res.out) ? res.out : []);

export function replacePhoto(list, id, next) {
  if (!id || !next) return asPhotoList(list);
  return asPhotoList(list).map(p => p.id === id ? { ...p, ...next, id: p.id } : p);
}

export function replaceRemarkPhoto(remarks, remarkId, photoId, next) {
  return (remarks || []).map(q => q.id === remarkId ? { ...q, photos: replacePhoto(q.photos, photoId, next) } : q);
}

export function attachRemarkPhotos(remarks, remarkId, photos) {
  const add = pickedPhotos(photos);
  if (!remarkId || !add.length) return remarks || [];
  return (remarks || []).map(q => q.id === remarkId ? { ...q, photos: [...asPhotoList(q.photos), ...add] } : q);
}
