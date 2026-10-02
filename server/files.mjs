import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { classifyAnnounceFile, isInlineExt, mimeForExt, sanitizeFileName } from "../src/shared/announce-files.js";

export const FILE_NAME_RE = /^[a-f0-9]{32}\.[a-z0-9]{2,8}$/i;

export function filesDirOf(stateDir, fallbackDir) {
  return stateDir ? path.join(stateDir, "files") : path.join(fallbackDir, "files");
}

export function storeUploadedFile({ bytes, name, mime, dir }) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes || []);
  const info = classifyAnnounceFile({ name, mime, size: buf.length });
  if (!info.ok) return { error: info.error, status: 400 };
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 32);
  const stored = `${hash}.${info.ext}`;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, stored);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return { path: "/files/" + stored, name: info.name, mime: info.mime, size: buf.length };
}

export function resolveStoredFile(dir, urlPath, queryName) {
  const name = path.basename(decodeURIComponent(String(urlPath || "").split("?")[0].replace(/^\/files\/?/, "")));
  if (!FILE_NAME_RE.test(name)) return null;
  const root = path.resolve(dir);
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return null;
  if (!fs.existsSync(file)) return null;
  const ext = name.split(".").pop().toLowerCase();
  const wanted = sanitizeFileName(queryName || "");
  const download = extOfSafe(wanted, ext);
  return { file, mime: mimeForExt(ext), download, inline: isInlineExt(ext) };
}

function extOfSafe(name, ext) {
  if (!name) return `file.${ext}`;
  return name.toLowerCase().endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

export function contentDisposition(inline, filename) {
  const fallback = String(filename || "file").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "") || "file";
  return `${inline ? "inline" : "attachment"}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename || fallback)}`;
}
