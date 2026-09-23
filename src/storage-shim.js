// Drop-in window.storage for the prototypes. Import this in src/main.jsx BEFORE rendering:
//   import "./storage-shim.js";
// If a QCteam state server is reachable, both apps share one live state; otherwise it falls back to localStorage.
// Served by the state server itself (hosted, or `npm run preview` behind node server)? Then the API is same-origin. Under Vite dev it's on :3001/:3002.
const devPorts = ["5173", "4173"];
const SERVER = (import.meta.env && import.meta.env.VITE_QC_SERVER) || (devPorts.includes(location.port) ? `${location.protocol === "https:" ? "https" : "http"}://${location.hostname}:${location.protocol === "https:" ? 3002 : 3001}` : location.origin);
window.__qcServer = SERVER;
let remote = null; // null = unknown, true/false after the first probe
// A failed probe is not final: during a deploy the server is away for ~20 s. Re-probe on every call until it answers,
// and never treat a temporary outage as "this device is the source of truth".
let lastProbeAt = 0;
async function probe() { if (remote === true) return true; if (remote === false && Date.now() - lastProbeAt < 5000) return false; lastProbeAt = Date.now(); try { const r = await fetch(`${SERVER}/storage/__probe`, { method: "GET", cache: "no-store" }); remote = r.status === 200 || r.status === 404; } catch { remote = false; } if (remote) console.log(`QCteam: using shared state at ${SERVER}`); else console.log("QCteam: server not reachable right now — will retry"); return remote; }
// Every device keeps a local copy of what it saved. If the server comes back empty (free hosting restarts wipe its disk),
// the first device to open the app re-seeds the server from its copy. The sheet re-pushes its own data within minutes anyway.
const local = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
window.storage = {
  async get(key) {
    if (await probe()) {
      const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`);
      if (r.status === 404) { const mine = local.get(key); if (mine != null) { console.log("QCteam: server had no state — restoring from this device"); await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: mine }); return { key, value: mine }; } return null; }
      const j = await r.json(); j.version = j.updatedAt ? String(j.updatedAt) : null;
      // (Removed: "server state looks empty but this device has data → force-restore this device's copy". Whatever the
      // server holds IS the shared truth — after the Head cleared everything, the next phone to open the app used to
      // force its stale localStorage copy back over it, and the old data "came back from nowhere". Recovery from a
      // genuinely wiped server is the 404 branch above (no key at all) plus Data → Backups.)
      local.set(key, j.value); return { key, value: j.value, version: j.version };
    }
    const v = local.get(key); return v == null ? null : { key, value: v };
  },
  async set(key, value) {
    local.set(key, value);
    if (await probe()) { const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: value }); if (r.status === 409) console.warn("QCteam: server refused to overwrite a larger state with a smaller one — reload to get the server's copy"); }
    return { key, value };
  },
  // Cheap version check for fast polling (badges etc.) — does not pull the whole state.
  async getMeta(key) { if (!(await probe())) return null; try { const r = await fetch(`${SERVER}/meta/${encodeURIComponent(key)}`, { cache: "no-store" }); const j = await r.json(); if (j.sheets) window.__qcSheetFresh = j.sheets; return j.updatedAt ? String(j.updatedAt) : null; } catch { return null; } },
  // Changes when the server process restarts (every deploy) — used to notice a new build is live and offer a refresh.
  async getBootId() { if (!(await probe())) return null; try { const r = await fetch(`${SERVER}/boot`, { cache: "no-store" }); const j = await r.json(); return j.bootId || null; } catch { return null; } },
  // Versioned save: If-Match with the version we last saw. 409 → {conflict, value, version} (someone saved first) or {rejected} (size guard).
  // A network drop mid-request (flaky warehouse WiFi, a Render restart) must never look like a normal, versionless
  // "offline" save — that used to fall through as if nothing was wrong, so the caller cleared the edit from its
  // pending queue without it ever reaching the server. Report it as {error: true} so the caller knows to keep
  // retrying instead of quietly losing the edit.
  // `force`: an explicit, user-confirmed overwrite (e.g. Data → Clear everything) that the server's size guard must let through.
  async setVersioned(key, value, version, { force = false } = {}) {
    local.set(key, value);
    if (!(await probe())) return { error: true };
    try {
      const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8", ...(version ? { "If-Match": version } : {}), ...(force ? { "X-Force": "1" } : {}) }, body: value });
      if (r.status === 409) { const j = await r.json().catch(() => ({})); if (j.rejected) return { rejected: true }; return { conflict: true, value: j.value, version: j.updatedAt ? String(j.updatedAt) : null }; }
      const j = await r.json().catch(() => ({})); return { version: j.updatedAt ? String(j.updatedAt) : null };
    } catch (e) { return { error: true }; }
  },
  async delete(key) { if (await probe()) { await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "DELETE" }); return { key, deleted: true }; } localStorage.removeItem(key); return { key, deleted: true }; },
};
// (The old 3-second full-state poll that lived here is gone: it downloaded the whole state 28,800 times a day per open tab.
// The apps poll /meta — a few bytes — and pull the state only when its version changed.)
