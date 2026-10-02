// Announcement attachments live as files on the server (`/files/…`), not as
// base64 inside the shared JSON — the same reason photos left the document.
// The announcement record keeps { id, name, path, mime, size }.

export const ANNOUNCE_MAX_BYTES = 20 * 1024 * 1024;

export const ANNOUNCE_TYPES = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
  potx: "application/vnd.openxmlformats-officedocument.presentationml.template",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  csv: "text/csv",
  txt: "text/plain",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  odp: "application/vnd.oasis.opendocument.presentation",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odt: "application/vnd.oasis.opendocument.text",
};

const INLINE_EXTS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "txt"]);

export const ANNOUNCE_ACCEPT = Object.keys(ANNOUNCE_TYPES).map(ext => `.${ext}`).join(",");

export function extOfName(name) {
  const m = /\.([a-z0-9]{2,8})$/i.exec(String(name || "").split(/[/\\]/).pop() || "");
  return m ? m[1].toLowerCase() : "";
}

export function mimeForExt(ext) {
  return ANNOUNCE_TYPES[String(ext || "").toLowerCase()] || "application/octet-stream";
}

export function isInlineExt(ext) {
  return INLINE_EXTS.has(String(ext || "").toLowerCase());
}

export function sanitizeFileName(name) {
  const base = String(name || "").split(/[/\\]/).pop() || "";
  const cleaned = base.replace(/[\u0000-\u001f<>:"|?*]/g, "").trim();
  return cleaned.slice(0, 180) || "file";
}

export function classifyAnnounceFile({ name, mime, size } = {}) {
  const clean = sanitizeFileName(name);
  const ext = extOfName(clean);
  if (!ext || !ANNOUNCE_TYPES[ext]) {
    return { ok: false, error: "That file type is not allowed. Use a PDF, PowerPoint, Word, Excel or image file." };
  }
  const n = Number(size) || 0;
  if (n <= 0) return { ok: false, error: "That file is empty." };
  if (n > ANNOUNCE_MAX_BYTES) return { ok: false, error: "That file is larger than 20 MB." };
  const declared = String(mime || "").split(";")[0].trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && !Object.values(ANNOUNCE_TYPES).includes(declared) && declared !== ANNOUNCE_TYPES[ext]) {
    // Trust the extension when Windows leaves the MIME blank or generic; refuse a known-bad MIME.
    if (declared.startsWith("text/html") || declared.includes("javascript") || declared.startsWith("application/x-msdownload")) {
      return { ok: false, error: "That file type is not allowed. Use a PDF, PowerPoint, Word, Excel or image file." };
    }
  }
  return { ok: true, name: clean, ext, mime: ANNOUNCE_TYPES[ext], size: n };
}

export function isAnnounceFile(f) {
  return !!(f && typeof f === "object" && f.path && String(f.path).startsWith("/files/") && f.name);
}

export function announceFilesOf(a) {
  return (Array.isArray(a?.attachments) ? a.attachments : []).filter(isAnnounceFile);
}

export function formatFileSize(n) {
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / (1024 * 1024)).toFixed(b >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function announceFileHref(f) {
  if (!f) return "";
  if (f.path && String(f.path).startsWith("/files/")) {
    const base = (typeof window !== "undefined" && window.__qcServer) || "";
    const q = f.name ? `?name=${encodeURIComponent(f.name)}` : "";
    return `${base}${f.path}${q}`;
  }
  return f.dataUrl || "";
}

const newId = () => Math.random().toString(36).slice(2, 9);

export async function uploadAnnounceFile(file) {
  const check = classifyAnnounceFile({ name: file?.name, mime: file?.type, size: file?.size });
  if (!check.ok) return { error: check.error };
  const base = (typeof window !== "undefined" && window.__qcServer) || "";
  try {
    const r = await fetch(`${base}/files`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-File-Name": encodeURIComponent(check.name),
        "X-File-Mime": check.mime,
      },
      body: file,
    });
    if (r.status === 413) return { error: "That file is larger than 20 MB." };
    if (!r.ok) return { error: "Could not upload the file." };
    const j = await r.json();
    if (!j?.path) return { error: "Could not upload the file." };
    return {
      file: {
        id: newId(),
        name: j.name || check.name,
        path: j.path,
        mime: j.mime || check.mime,
        size: j.size || check.size,
      },
    };
  } catch {
    return { error: "Could not upload the file." };
  }
}

export async function addAnnounceFiles(files) {
  const added = [];
  const errors = [];
  for (const file of files || []) {
    const r = await uploadAnnounceFile(file);
    if (r.error) errors.push(r.error);
    else if (r.file) added.push(r.file);
  }
  return { added, errors };
}
