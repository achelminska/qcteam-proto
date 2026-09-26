// Report photos keep the file the phone took. JPEG, PNG, WEBP and GIF are stored
// byte for byte. A format the page cannot keep (HEIC) is transcoded at the photo's
// own pixel size. The PDF then places that file inside a max box without cropping.

const DISPLAYABLE = new Set(["image/jpeg", "image/jpg", "image/pjpeg", "image/png", "image/webp", "image/gif"]);

export const readAsDataUrl = file => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => res(null);
  r.readAsDataURL(file);
});

export function keepsOriginalFile(file) {
  const t = String(file?.type || "").toLowerCase().split(";")[0].trim();
  if (t) return DISPLAYABLE.has(t);
  return /\.(jpe?g|png|webp|gif)$/i.test(String(file?.name || ""));
}

// Full-resolution bytes for formats the report can embed. Anything else (HEIC)
// is decoded at its natural pixel size — never scaled down to a thumbnail.
export function keepPhoto(file) {
  if (keepsOriginalFile(file)) return readAsDataUrl(file);
  return new Promise(res => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        if (!c.width || !c.height) { URL.revokeObjectURL(url); res(null); return; }
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", 0.92));
      } catch {
        URL.revokeObjectURL(url);
        res(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); res(null); };
    img.src = url;
  });
}

export function imageFormat(src) {
  const t = ((/^data:image\/([a-z0-9.+-]+)/i.exec(String(src || "")) || [])[1] || "").toLowerCase();
  if (t.includes("png")) return "PNG";
  if (t.includes("webp")) return "WEBP";
  if (t.includes("gif")) return "GIF";
  return "JPEG";
}

// Largest box of maxW × maxH that keeps the source aspect ratio. Null when the
// pixel size is unknown, so a photo is never stretched into a guessed rectangle.
export function fitWithin(px, maxW, maxH) {
  const aw = Number(px?.w) || 0, ah = Number(px?.h) || 0;
  if (!(aw > 0) || !(ah > 0) || !(maxW > 0) || !(maxH > 0)) return null;
  const k = Math.min(maxW / aw, maxH / ah);
  return { w: aw * k, h: ah * k };
}

export function imagePixels(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || img.width || 0, h: img.naturalHeight || img.height || 0 });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function canvasPng(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        if (!c.width || !c.height) return resolve(null);
        c.getContext("2d").drawImage(img, 0, 0);
        resolve(c.toDataURL("image/png"));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Embed the original bytes. jsPDF stores a JPEG as DCT; "NONE" skips a second
// lossy pass. WEBP/GIF that the library cannot embed are redrawn at full pixels.
export async function addImageNatural(doc, src, x, y, w, h) {
  const fmt = imageFormat(src);
  try {
    doc.addImage(src, fmt, x, y, w, h, undefined, "NONE");
  } catch (e) {
    if (fmt === "JPEG" || fmt === "PNG") throw e;
    const png = await canvasPng(src);
    if (!png) throw e;
    doc.addImage(png, "PNG", x, y, w, h, undefined, "NONE");
  }
}

// Head-uploaded result image on the right. The verdict and the report number
// sit to its left. Returns the left and bottom edges (mm) so the title and the rule clear the mark.
export async function drawResultMark(doc, { settings, insp, ok, R, OK, BAD, MUTED, photoData }) {
  const label = ok ? "ACCEPTED" : "REJECTED";
  const reportNo = `Report no. ${String(insp.id || "").toUpperCase()}`;
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  const labelW = doc.getTextWidth(label);
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  const noW = doc.getTextWidth(reportNo);
  const textW = Math.max(labelW, noW);
  const gap = 3;
  const top = 11;
  let src = null, iw = 0, ih = 0;
  const icon = settings?.resultIcons?.[insp.result];
  if (icon && photoData) {
    try {
      src = await photoData(icon);
      const box = src ? fitWithin(await imagePixels(src), 22, 16) : null;
      if (box) { iw = box.w; ih = box.h; } else src = null;
    } catch { src = null; iw = 0; ih = 0; }
  }
  const blockH = Math.max(ih, 12);
  let placed = false;
  const iconX = R - iw;
  if (src && iw) {
    try {
      await addImageNatural(doc, src, iconX, top + (blockH - ih) / 2, iw, ih);
      placed = true;
    } catch { /* words only, still on the right */ }
  }
  const textRight = placed ? iconX - gap : R;
  const linesTop = top + Math.max(0, (blockH - 10) / 2);
  doc.setFont(undefined, "bold");
  doc.setFontSize(11);
  doc.setTextColor(...(ok ? OK : BAD));
  doc.text(label, textRight, linesTop + 4.2, { align: "right" });
  doc.setFont(undefined, "normal");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text(reportNo, textRight, linesTop + 8.6, { align: "right" });
  return { left: textRight - textW, bottom: top + blockH };
}

// Place each photo at its own aspect ratio, wrapping the row and the page.
// Returns the y just under the last row.
export async function drawPhotoGroup(doc, { photos, photoData, x0, y0, right, maxW = 52, maxH = 52, gap = 4, pageBreak = 272, newPage }) {
  const items = [];
  for (const ph of photos || []) {
    try {
      const d = await photoData(ph);
      if (!d) continue;
      const box = fitWithin(await imagePixels(d), maxW, maxH);
      if (!box) continue;
      items.push({ d, w: box.w, h: box.h });
    } catch { /* a photo that cannot be read is left out of this page */ }
  }
  let x = x0, y = y0, rowH = 0;
  for (const im of items) {
    if (x > x0 && x + im.w > right + 0.1) { x = x0; y += rowH + gap; rowH = 0; }
    if (y + im.h > pageBreak) { newPage(); y = 16; x = x0; rowH = 0; }
    try { await addImageNatural(doc, im.d, x, y, im.w, im.h); }
    catch { continue; }
    x += im.w + gap;
    rowH = Math.max(rowH, im.h);
  }
  return y + rowH;
}
