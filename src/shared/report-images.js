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
// When the full-size POST to /photos fails (phone JPEG + base64 is often > Render's body limit),
// shrink to a still-usable still so the inspection can save a path instead of a multi-MB data URL.
export const rotatedSize = (w, h, turns) => {
  const q = ((Number(turns) % 4) + 4) % 4;
  return q % 2 === 1 ? { w: h, h: w } : { w, h };
};

// +1 = 90° clockwise, −1 = 90° counter-clockwise. Used by the photo preview.
export function rotateImage(src, turns = 1, quality = 0.92) {
  if (typeof document === "undefined" || !src) return Promise.resolve(src);
  const q = ((Number(turns) % 4) + 4) % 4;
  if (!q) return Promise.resolve(src);
  return new Promise(resolve => {
    const img = new Image();
    const url = absPhotoUrl(src);
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(src);
        const box = rotatedSize(w, h, q);
        const c = document.createElement("canvas");
        c.width = box.w;
        c.height = box.h;
        const ctx = c.getContext("2d");
        ctx.translate(box.w / 2, box.h / 2);
        ctx.rotate(q * Math.PI / 2);
        ctx.drawImage(img, -w / 2, -h / 2);
        resolve(c.toDataURL("image/jpeg", quality));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    if (url && !url.startsWith("data:") && !url.startsWith("blob:")) img.crossOrigin = "anonymous";
    img.src = url;
  });
}

export function shrinkPhoto(dataUrl, maxEdge = 1600, quality = 0.82) {
  if (typeof document === "undefined" || !dataUrl) return Promise.resolve(dataUrl);
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) { res(dataUrl); return; }
        const k = Math.min(1, maxEdge / Math.max(w, h));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL("image/jpeg", quality));
      } catch { res(dataUrl); }
    };
    img.onerror = () => res(dataUrl);
    img.src = dataUrl;
  });
}

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

const b64ToBytes = b64 => { const bin = atob(b64.replace(/\s/g, "")); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
const bytesToB64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 32768) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768)); return btoa(s); };

// jsPDF reads the picture size from the first C0..C7 marker it meets, and C4 (a
// Huffman table) is in that range. A JPEG whose tables come before the frame
// header is then filed as 1-component at a wrong size. Moving the tables behind
// the frame header changes no pixel: every table still precedes the scan.
export function jpegFrameFirst(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return bytes;
  const segs = [];
  let i = 2, sos = -1;
  while (i + 3 < bytes.length) {
    if (bytes[i] !== 0xFF) return bytes;
    const m = bytes[i + 1];
    if (m === 0xFF) { i++; continue; }
    if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { segs.push({ m, start: i, end: i + 2 }); i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (m === 0xDA) { sos = i; break; }
    segs.push({ m, start: i, end: i + 2 + len });
    i += 2 + len;
  }
  if (sos < 0) return bytes;
  const isFrame = m => m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC;
  const frameAt = segs.findIndex(s => isFrame(s.m));
  const firstTable = segs.findIndex(s => s.m === 0xC4);
  if (frameAt < 0 || firstTable < 0 || firstTable > frameAt) return bytes;
  const ordered = [...segs.filter(s => s.m !== 0xC4), ...segs.filter(s => s.m === 0xC4)];
  const out = new Uint8Array(bytes.length);
  out[0] = 0xFF; out[1] = 0xD8;
  let p = 2;
  for (const s of ordered) { out.set(bytes.subarray(s.start, s.end), p); p += s.end - s.start; }
  out.set(bytes.subarray(sos), p);
  return out;
}

export function jpegDataUrlFrameFirst(src) {
  const m = /^data:image\/jpe?g;base64,([\s\S]+)$/i.exec(String(src || ""));
  if (!m) return src;
  try {
    const bytes = b64ToBytes(m[1]);
    const fixed = jpegFrameFirst(bytes);
    return fixed === bytes ? src : "data:image/jpeg;base64," + bytesToB64(fixed);
  } catch { return src; }
}

// Embed the original pixels. A JPEG goes in as its own DCT stream, so "NONE"
// means no second lossy pass. PNG pixels are deflated ("FAST"), which is lossless
// and keeps the file from storing raw RGB. WEBP/GIF are redrawn at full pixels.
let pdfImageAlias = 0;

export async function addImageNatural(doc, src, x, y, w, h) {
  const fmt = imageFormat(src);
  const mode = fmt === "JPEG" ? "NONE" : "FAST";
  if (fmt === "JPEG") src = jpegDataUrlFrameFirst(src);
  // jsPDF reuses a previous picture when the alias is missing or collides. A
  // unique name per embed keeps Weight / module / remark shots from becoming
  // copies of whichever photo landed last.
  const alias = `qc${++pdfImageAlias}`;
  try {
    doc.addImage(src, fmt, x, y, w, h, alias, mode);
  } catch (e) {
    if (fmt === "JPEG" || fmt === "PNG") throw e;
    const png = await canvasPng(src);
    if (!png) throw e;
    doc.addImage(png, "PNG", x, y, w, h, `${alias}p`, "FAST");
  }
}

// Result images uploaded before 26 Sep went through a canvas and out as JPEG. A JPEG has no alpha, so the
// transparent background of a logo came out as solid black — the black frame around the mark on the report.
// The pixels that used to be transparent are the near-black ones that touch the edge of the picture; flood-fill
// from the border and clear them. Pure function over RGBA bytes so it can be tested without a canvas.
export function knockOutDarkBorder(rgba, w, h, dark = 48) {
  if (!rgba || !(w > 0) || !(h > 0) || rgba.length < w * h * 4) return 0;
  const isDark = i => rgba[i * 4] < dark && rgba[i * 4 + 1] < dark && rgba[i * 4 + 2] < dark && rgba[i * 4 + 3] > 0;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = i => { if (!seen[i] && isDark(i)) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  let n = 0;
  while (stack.length) {
    const i = stack.pop(); n++;
    rgba[i * 4 + 3] = 0;
    const x = i % w, y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return n;
}

// The result mark as a PNG with a real alpha channel. A PNG/WEBP/GIF keeps its own
// transparency; a JPEG gets the former-transparent black background knocked out.
export function transparentIcon(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        if (!c.width || !c.height) return resolve(src);
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        if (imageFormat(src) === "JPEG") {
          const px = ctx.getImageData(0, 0, c.width, c.height);
          if (knockOutDarkBorder(px.data, c.width, c.height)) ctx.putImageData(px, 0, 0);
          else return resolve(src);
        }
        resolve(c.toDataURL("image/png"));
      } catch { resolve(src); }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
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
      src = await transparentIcon(await photoData(icon));
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

// Print-size pixel cap for a photo drawn at `maxMm`. 180 dpi is sharp on screen
// and on a laser print; a 12 MP phone JPEG is ~10× larger than this box.
export const pdfPhotoMaxEdge = (maxMm, dpi = 180) => Math.max(1, Math.round(Number(maxMm) / 25.4 * dpi));

// One decode: if the file is already small enough and JPEG, keep the bytes;
// otherwise redraw to a JPEG that matches the print box. Returns {d, w, h}.
export function fitPhotoForPdf(src, maxEdge = 720, quality = 0.82) {
  if (typeof document === "undefined" || !src) return Promise.resolve(null);
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
        if (!w || !h) return resolve(null);
        const k = Math.min(1, maxEdge / Math.max(w, h));
        if (k === 1 && String(src).startsWith("data:") && imageFormat(src) === "JPEG") return resolve({ d: jpegDataUrlFrameFirst(src), w, h });
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(w * k));
        c.height = Math.max(1, Math.round(h * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve({ d: c.toDataURL("image/jpeg", quality), w: c.width, h: c.height });
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// A photo may be a leftover data URL, a /photos path, or a bare string after
// the server rewrote embedded images. Prefer an in-memory data: URL — field
// photos often keep one even when `path` 404s after a deploy.
export function photoSrcCandidates(ph) {
  if (!ph) return [];
  if (typeof ph === "string") return ph.trim() ? [ph.trim()] : [];
  const raw = [];
  const add = s => { s = String(s || "").trim(); if (s && !raw.includes(s)) raw.push(s); };
  add(ph.dataUrl);
  add(ph.path);
  add(ph.src);
  add(ph.url);
  const data = raw.filter(s => s.startsWith("data:"));
  return [...data, ...raw.filter(s => !s.startsWith("data:"))];
}

export function absPhotoUrl(src) {
  if (!src || src.startsWith("data:") || src.startsWith("blob:") || /^https?:\/\//i.test(src)) return src;
  const base = (typeof window !== "undefined" && window.__qcServer) || "";
  if (src.startsWith("/") && base) return base.replace(/\/$/, "") + src;
  return src;
}

export async function fetchPdfPhotoSrc(src) {
  src = absPhotoUrl(src);
  if (!src) return null;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  const r = await fetch(src);
  if (!r.ok) return null;
  const blob = await r.blob();
  const t = String(blob.type || "");
  if (t && !t.startsWith("image/") && t !== "application/octet-stream") return null;
  return URL.createObjectURL(blob);
}

// Cached per photo identity. Tries every candidate so a dead `path` still
// falls through to `dataUrl`.
export function memoPdfPhoto(load) {
  const cache = new Map();
  return ph => {
    const candidates = photoSrcCandidates(ph);
    if (!candidates.length) return Promise.resolve(null);
    const key = candidates.join("\n");
    if (cache.has(key)) return cache.get(key);
    const p = (async () => {
      for (const src of candidates) {
        try { const got = await load(src); if (got) return got; } catch { /* next */ }
      }
      return null;
    })();
    cache.set(key, p);
    return p;
  };
}

export async function mapPool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, n), Math.max(1, items.length)) }, worker));
  return out;
}

// Place each photo at its own aspect ratio, wrapping the row and the page.
// Returns the y just under the last row.
export async function drawPhotoGroup(doc, { photos, photoData, x0, y0, right, maxW = 52, maxH = 52, gap = 4, pageBreak = 272, newPage }) {
  const maxEdge = pdfPhotoMaxEdge(Math.max(maxW, maxH));
  const items = (await mapPool(photos || [], 2, async ph => {
    try {
      const raw = await photoData(ph);
      if (!raw) return null;
      const fitted = await fitPhotoForPdf(raw, maxEdge);
      if (!fitted) return null;
      const box = fitWithin({ w: fitted.w, h: fitted.h }, maxW, maxH);
      if (!box) return null;
      return { d: fitted.d, w: box.w, h: box.h };
    } catch { return null; }
  })).filter(Boolean);
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
