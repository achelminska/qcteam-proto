// Same idea as server/blobs.mjs, on the device: a save must not upload the catalog's photos again.
// The file name is the sha256 of the bytes, which is what the server already wrote for each embedded image.
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

const extForMime = (mime) => mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";

function decodeDataUrl(dataUrl) {
  if (typeof dataUrl !== "string" || dataUrl.length < 200 || !dataUrl.startsWith("data:image")) return null;
  const m = DATA_URL.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[2].replace(/\s/g, ""));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime: m[1], bytes };
  } catch { return null; }
}

async function photoPath(decoded) {
  const digest = await crypto.subtle.digest("SHA-256", decoded.bytes);
  const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return `/photos/${hex}.${extForMime(decoded.mime)}`;
}

// A photo the server does not have yet (the upload-to-file step failed, so it is still a data URL).
// Historical catalog photos are already on disk under this name; the HEAD then does nothing.
function ensurePhoto(filePath, dataUrl) {
  if (typeof fetch !== "function") return;
  const base = filePath.slice(filePath.lastIndexOf("/") + 1).replace(/\.[^.]+$/, "");
  fetch(filePath, { method: "HEAD" }).then(r => {
    if (r.ok) return null;
    return fetch("/photos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, name: base }) });
  }).catch(() => {});
}

/**
 * @param {object} state
 * @param {{ upload?: boolean }} [opts]  upload missing files in the background (browser only)
 * @returns {Promise<object>} the same object when there is nothing to move
 */
export async function externalizeState(state, { upload = false } = {}) {
  let raw;
  try { raw = JSON.stringify(state); } catch { return state; }
  if (!raw.includes("data:image")) return state;
  const clone = JSON.parse(raw);
  const map = new Map();
  const swap = async (s) => {
    if (typeof s !== "string" || !s.startsWith("data:image") || s.length < 200) return s;
    if (map.has(s)) return map.get(s);
    const decoded = decodeDataUrl(s);
    if (!decoded) return s;
    const filePath = await photoPath(decoded);
    map.set(s, filePath);
    return filePath;
  };
  const walk = async (node) => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") node[i] = await swap(node[i]);
        else if (node[i] && typeof node[i] === "object") await walk(node[i]);
      }
      return;
    }
    if (node && typeof node === "object") {
      for (const k of Object.keys(node)) {
        if (typeof node[k] === "string") node[k] = await swap(node[k]);
        else if (node[k] && typeof node[k] === "object") await walk(node[k]);
      }
    }
  };
  await walk(clone);
  if (upload) for (const [dataUrl, filePath] of map) ensurePhoto(filePath, dataUrl);
  return clone;
}
