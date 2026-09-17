// Drop-in window.storage for the prototypes. Import this in src/main.jsx BEFORE rendering:
//   import "./storage-shim.js";
// If a QCteam state server is reachable, both apps share one live state; otherwise it falls back to localStorage.
// Served by the state server itself (hosted, or `npm run preview` behind node server)? Then the API is same-origin. Under Vite dev it's on :3001/:3002.
const devPorts = ["5173", "4173"];
const SERVER = (import.meta.env && import.meta.env.VITE_QC_SERVER) || (devPorts.includes(location.port) ? `${location.protocol === "https:" ? "https" : "http"}://${location.hostname}:${location.protocol === "https:" ? 3002 : 3001}` : location.origin);
window.__qcServer = SERVER;
let remote = null; // null = unknown, true/false after the first probe
async function probe() { if (remote !== null) return remote; try { const r = await fetch(`${SERVER}/storage/__probe`, { method: "GET" }); remote = r.status === 200 || r.status === 404; } catch { remote = false; } console.log(remote ? `QCteam: using shared state at ${SERVER}` : "QCteam: server not reachable, using localStorage"); return remote; }
window.storage = {
  async get(key) {
    if (await probe()) { const r = await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`); if (r.status === 404) return null; const j = await r.json(); return { key, value: j.value }; }
    const v = localStorage.getItem(key); return v == null ? null : { key, value: v };
  },
  async set(key, value) {
    if (await probe()) { await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "PUT", headers: { "Content-Type": "text/plain" }, body: value }); return { key, value }; }
    localStorage.setItem(key, value); return { key, value };
  },
  async delete(key) { if (await probe()) { await fetch(`${SERVER}/storage/${encodeURIComponent(key)}`, { method: "DELETE" }); return { key, deleted: true }; } localStorage.removeItem(key); return { key, deleted: true }; },
};
// Live refresh: when the other device saves, pull the new state (poll every 3 s; the apps re-read on reload).
// The prototypes load state once on start, so a simple approach is to reload the page when the server's copy is newer.
let lastSeen = null;
setInterval(async () => { if (!(await probe())) return; try { const r = await fetch(`${SERVER}/storage/qcteam-portal-state-v2-clean`); if (r.status !== 200) return; const j = await r.json(); if (lastSeen && j.updatedAt && j.updatedAt > lastSeen && !document.hasFocus()) location.reload(); lastSeen = j.updatedAt || lastSeen; } catch {} }, 3000);
