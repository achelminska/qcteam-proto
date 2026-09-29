// Product names are Dutch on the sheet ("Bananen") while people type English or Polish
// ("banana", "banan", "bananna"). A plain substring miss looks like the pallet is missing.
export const foldText = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const matchesText = (hay, q) => {
  const qq = foldText(q).trim();
  if (!qq) return true;
  const h = foldText(hay);
  if (h.includes(qq)) return true;
  const words = h.split(/[^a-z0-9]+/).filter(Boolean);
  return words.some(w => {
    if (w.startsWith(qq) || (qq.startsWith(w) && w.length >= 4)) return true;
    return Math.min(w.length, qq.length) >= 5 && w.slice(0, 5) === qq.slice(0, 5);
  });
};
