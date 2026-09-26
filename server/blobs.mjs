// Product photos, chat attachments and a few report icons were stored as data: URLs inside the one shared
// JSON document. That document is what every phone downloads and uploads on each save. At ~16 MB it does not
// fit on the phone, the save of a finished inspection never lands, and a refresh shows the pallet as never
// inspected. Images belong in /photos; the state keeps the path.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export function extForMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

// 32 hex chars of sha256. The phone computes the same name and can refer to a file this process already wrote.
export function photoFileName(bytes, mime) {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  return `${hash}.${extForMime(mime)}`;
}

// Mutates `value`. Returns how many data URLs were replaced with /photos/… paths.
export function extractDataUrls(value, dir) {
  let n = 0;
  const write = (dataUrl) => {
    if (typeof dataUrl !== "string" || dataUrl.length < 200 || !dataUrl.startsWith("data:image")) return null;
    const m = DATA_URL.exec(dataUrl);
    if (!m) return null;
    let bytes;
    try { bytes = Buffer.from(m[2].replace(/\s/g, ""), "base64"); } catch { return null; }
    if (!bytes.length) return null;
    const name = photoFileName(bytes, m[1]);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, name);
    if (!fs.existsSync(file)) fs.writeFileSync(file, bytes);
    n++;
    return "/photos/" + name;
  };
  const walk = (node) => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") { const p = write(node[i]); if (p) node[i] = p; }
        else if (node[i] && typeof node[i] === "object") walk(node[i]);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const k of Object.keys(node)) {
        if (typeof node[k] === "string") { const p = write(node[k]); if (p) node[k] = p; }
        else if (node[k] && typeof node[k] === "object") walk(node[k]);
      }
    }
  };
  walk(value);
  return n;
}

// Raw state JSON in, raw state JSON out. Unchanged (same string) when there is nothing to move.
export function slimStateJson(raw, dir) {
  if (typeof raw !== "string" || !raw.includes("data:image")) return raw;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  const n = extractDataUrls(parsed, dir);
  if (!n) return raw;
  return JSON.stringify(parsed);
}
