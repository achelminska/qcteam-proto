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
      const size = v => { try { const o = JSON.parse(v); return (o.categories || []).length + (o.products || []).length + (o.inspections || []).length + (o.integrations || []).length; } catch { return 0; } };
      const mine = local.get(key);
      if (mine != null && size(j.value) === 0 && size(mine) > 0) { console.log("QCteam: server state is empty but this device has data — restoring from this device"); await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8", "X-Force": "1" }, body: mine }); return { key, value: mine }; }
      local.set(key, j.value); return { key, value: j.value, version: j.version };
    }
    const v = local.get(key); return v == null ? null : { key, value: v };
  },
  async set(key, value) {
    local.set(key, value);
    if (await probe()) { const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8" }, body: value }); if (r.status === 409) console.warn("QCteam: server refused to overwrite a larger state with a smaller one — reload to get the server's copy"); }
    return { key, value };
  },
  // Versioned save: If-Match with the version we last saw. 409 → {conflict, value, version} (someone saved first) or {rejected} (size guard).
  async setVersioned(key, value, version) {
    local.set(key, value);
    if (!(await probe())) return { version: null };
    const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain; charset=utf-8", ...(version ? { "If-Match": version } : {}) }, body: value });
    if (r.status === 409) { const j = await r.json().catch(() => ({})); if (j.rejected) return { rejected: true }; return { conflict: true, value: j.value, version: j.updatedAt ? String(j.updatedAt) : null }; }
    const j = await r.json().catch(() => ({})); return { version: j.updatedAt ? String(j.updatedAt) : null };
  },
  async delete(key) { if (await probe()) { await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "DELETE" }); return { key, deleted: true }; } localStorage.removeItem(key); return { key, deleted: true }; },
};
// Live refresh: when the other device saves, pull the new state (poll every 3 s; the apps re-read on reload).
// The prototypes load state once on start, so a simple approach is to reload the page when the server's copy is newer.
let lastSeen = null;
setInterval(async () => { if (!(await probe())) return; try { const r = await fetch(`${SERVER}/storage/qcteam-portal-state-v2-clean`); if (r.status !== 200) return; const j = await r.json(); if (lastSeen && j.updatedAt && j.updatedAt > lastSeen && !document.hasFocus()) location.reload(); lastSeen = j.updatedAt || lastSeen; } catch {} }, 3000);
