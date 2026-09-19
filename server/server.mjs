// QCteam local state server — one file, no dependencies. Run: node server/server.mjs
// HTTP on :3001 and, if server/cert.pem + server/key.pem exist, HTTPS on :3002 (needed when the app itself runs over HTTPS —
// browsers block mixed content). Create the cert once:  npm run cert
import http from "node:http"; import https from "node:https"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { targetsFor, suggestMappings, applyMapping, detectTable, extractSummary } from "./sheetlogic.mjs";
import { applyDeadlineAlerts } from "./alertlogic.mjs";
const STATE_KEY = "qcteam-portal-state-v2-clean";
// Static hosting of the built app (dist/) so one service = API + portal + phone app. Any unknown path falls back to index.html.
const DIST = new URL("../dist/", import.meta.url).pathname;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".json": "application/json", ".ico": "image/x-icon", ".woff2": "font/woff2" };
const serveStatic = (req, res) => {
  if (!fs.existsSync(DIST)) return res.writeHead(404, cors).end("no dist/ — run npm run build");
  let p = decodeURIComponent(req.url.split("?")[0]); if (p === "/") p = "/index.html";
  let file = path.join(DIST, p); if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, "index.html");
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream", "Cache-Control": file.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" });
  fs.createReadStream(file).pipe(res);
};
const SYNC_KEY = process.env.QC_SYNC_KEY || "";
// Changes on every process start (every deploy restarts the process). Clients poll it to notice "the server changed under me" and offer a refresh.
const BOOT_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
// STATE_DIR: mount a persistent disk there (e.g. Render Disk at /data) so state survives deploys. Default: next to this file.
const STATE_DIR = process.env.STATE_DIR || null;
const PORT = Number(process.env.PORT) || 3001, FILE = STATE_DIR ? path.join(STATE_DIR, "state.json") : new URL("./state.json", import.meta.url);
if (STATE_DIR && !fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
const store = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
console.log(`state file: ${FILE}`);
const save = () => fs.writeFileSync(FILE, JSON.stringify(store));
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
// Server-side processing: apply the mapping the Head saved in the app state to every push, so the dashboard is current
// even when nobody has the app open. Mirrors refreshPushedIntegrations in the front-end.
const checkDeadlines = (reason) => {
  try {
    const raw = store[STATE_KEY]; if (!raw) return;
    const st = JSON.parse(raw); const next = applyDeadlineAlerts(st);
    if (!next) return;
    store[STATE_KEY] = JSON.stringify(next); (store.__meta = store.__meta || {})[STATE_KEY] = Date.now(); save();
    const added = (next.notifications || []).length - (st.notifications || []).length;
    if (added > 0) console.log(`[deadlines] ${reason}: ${added} notification(s) sent`);
  } catch (e) { console.log("[deadlines] check failed:", e.message); }
};
const applyPushToState = (purpose, sheet) => {
  try {
    const raw = store[STATE_KEY]; if (!raw) return " (no app state yet)";
    const st = JSON.parse(raw); const P = purpose === "dock" ? "Dock" : purpose === "blocked" ? "Blocked" : "Products";
    const targets = (st.integrations || []).filter(i => i.purpose === P && i.pushMode); if (!targets.length) return ` (no ${P} integration in push mode)`;
    const tg = targetsFor(P); let j = detectTable({ header: sheet.header, rows: sheet.rows }); let note = "";
    st.integrations = st.integrations.map(i => { if (!targets.some(t => t.id === i.id)) return i;
      const needed = (i.mappings || []).filter(m => m.target && m.target !== "ignore").map(m => m.source);
      let missing = needed.filter(c => !j.header.includes(c));
      // The header row is auto-detected. If the pick misses columns the Head mapped, the detector probably grabbed a data row
      // (side-panel text like "SKU on dock:" can out-score the real header) — try the first rows as header candidates instead.
      if (needed.length && missing.length) { const all = [sheet.header, ...sheet.rows]; for (let r = 0; r < Math.min(10, all.length); r++) { const h = all[r].map(c => String(c ?? "").trim()); let w = h.findIndex(c => !c); if (w < 0) w = h.length; const hdr = h.slice(0, w); if (!needed.every(c => hdr.includes(c))) continue; j = { header: hdr, rows: all.slice(r + 1).map(x => x.slice(0, w).map(c => String(c ?? "").trim())).filter(x => x.some(Boolean)) }; missing = []; note += ` (header found on row ${r + 1})`; break; } }
      // Still missing → the sheet's columns really changed (or this push is garbage mid-recalculation). Never wipe the dashboard
      // with a re-guessed mapping: keep the last good rows + the Head's mapping and say so; the Head re-maps in Integrations.
      if (needed.length && missing.length) { note += ` (kept last good data: ${missing.length} mapped column(s) missing — ${missing.slice(0, 3).join(", ")})`; return { ...i, rawHeader: sheet.header, rawRows: sheet.rows, lastPushAt: sheet.receivedAt, needsRemap: true, liveStatus: `Sheet columns changed — ${missing.length} mapped column(s) missing (${missing.slice(0, 3).join(", ")}). Keeping the last good data from ${i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleTimeString("en-GB") : "before"}; re-map here to apply new pushes.` }; }
      const mappings = i.mappings?.length && (i.header || []).join("|") === j.header.join("|") ? i.mappings : (needed.length ? i.mappings : suggestMappings(j.header, j.rows, tg));
      const rows = applyMapping({ ...i, mappings }, j.header, j.rows);
      return { ...i, header: j.header, sample: j.rows, rawHeader: sheet.header, rawRows: sheet.rows, mappings, needsRemap: false, rows: P !== "Products" ? rows : i.rows, summary: P !== "Products" ? extractSummary(sheet.header, sheet.rows) : i.summary, lastSyncAt: new Date().toISOString(), lastPushAt: sheet.receivedAt, liveStatus: `OK — ${j.rows.length} rows, pushed by the sheet at ${new Date(sheet.receivedAt).toLocaleTimeString("en-GB")} (applied on the server)` }; });
    store[STATE_KEY] = JSON.stringify(st); (store.__meta = store.__meta || {})[STATE_KEY] = Date.now();
    // Push log: enough to explain "the tiles vanished at 03:12" after the fact. /sheet/<purpose>/log returns the last 60 entries.
    try { const it = st.integrations.find(i => targets.some(t => t.id === i.id)); const hist = {}; (it?.rows || []).forEach(r => { const k = r.priority || (r.status ? `status:${r.status}` : "—"); hist[k] = (hist[k] || 0) + 1; }); const errs = (it?.rows || []).filter(r => r._errors?.length).length; (store.__pushlog = store.__pushlog || {})[purpose] = [...(store.__pushlog[purpose] || []).slice(-59), { at: sheet.receivedAt, raw: sheet.rows.length, table: j.rows.length, header: j.header.slice(0, 14), errors: errs, hist, note: note.trim() }]; } catch {}
    return " → applied to app state" + note;
  } catch (e) { return ` (apply failed: ${e.message})`; }
};
// Snapshots of the app state: at most one per 10 minutes on change, last 48 kept. Restorable from the portal (Data → Backups).
const BACKUP_DIR = STATE_DIR ? path.join(STATE_DIR, "backups") : new URL("./backups/", import.meta.url).pathname;
let lastSnapAt = 0;
const snapshot = (key, body) => { try { if (key !== STATE_KEY) return; if (store[key] === body || !store[key]) return; if (Date.now() - lastSnapAt < 10 * 60 * 1000) return; if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true }); const name = `state-${new Date().toISOString().replace(/[:.]/g, "-")}.json`; fs.writeFileSync(path.join(BACKUP_DIR, name), store[key]); lastSnapAt = Date.now(); const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("state-")).sort(); files.slice(0, Math.max(0, files.length - 48)).forEach(f => fs.unlinkSync(path.join(BACKUP_DIR, f))); } catch (e) { console.log("[backup] failed:", e.message); } };
const listBackups = () => { try { return fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("state-")).sort().reverse().map(f => { const st = fs.statSync(path.join(BACKUP_DIR, f)); let n = {}; try { const j = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, f), "utf8")); n = { categories: (j.categories || []).length, products: (j.products || []).length, inspections: (j.inspections || []).length, integrations: (j.integrations || []).length }; } catch {} return { name: f, at: st.mtime.toISOString(), size: st.size, ...n }; }); } catch { return []; } };
const handler = async (req, res) => {
  if (req.url.startsWith("/backups")) {
    if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
    const m = /^\/backups\/([^/?]+)(\/restore)?/.exec(req.url);
    if (!m) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify(listBackups())); }
    const file = path.join(BACKUP_DIR, path.basename(m[1])); if (!fs.existsSync(file)) return res.writeHead(404, cors).end();
    if (m[2] && req.method === "POST") { lastSnapAt = 0; snapshot(STATE_KEY, "__restore__"); store[STATE_KEY] = fs.readFileSync(file, "utf8"); (store.__meta = store.__meta || {})[STATE_KEY] = Date.now(); save(); console.log(`[backup] restored ${m[1]}`); res.writeHead(200, cors).end(JSON.stringify({ ok: true })); return; }
    res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return fs.createReadStream(file).pipe(res);
  }
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  // /proxy?url=…  — fetch a public sheet endpoint (Apps Script JSON or published CSV) server-side, so the browser's CORS rules don't apply
  if (req.url.startsWith("/proxy?")) { try { const url = new URL(req.url, "http://x").searchParams.get("url"); if (!/^https:\/\/(script\.google\.com|docs\.google\.com|script\.googleusercontent\.com)\//.test(url || "")) { res.writeHead(400, cors).end("only Google Sheets / Apps Script URLs"); return; } const r = await fetch(url, { redirect: "follow" }); const txt = await r.text(); res.writeHead(r.ok ? 200 : r.status, { ...cors, "Content-Type": r.headers.get("content-type") || "text/plain" }); res.end(txt); } catch (e) { res.writeHead(502, cors).end(String(e.message || e)); } return; }
  // /sheet/<purpose>  — PUSH from Google Apps Script (UrlFetchApp) and PULL by the apps. The sheet pushes {header, rows}; a shared key guards the POST.
  if (req.url.startsWith("/sheet/")) {
    const purpose = req.url.replace(/^\/sheet\//, "").split("?")[0].toLowerCase();
    if (req.method === "POST") { if (SYNC_KEY && req.headers["x-sync-key"] !== SYNC_KEY && req.headers["x-secret"] !== SYNC_KEY) { res.writeHead(401, cors).end("bad X-Sync-Key"); return; } const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => { const body = Buffer.concat(chunks).toString("utf8"); try { let j = JSON.parse(body);
        // Accept the priority-bot payload too: { rows: [{ articleId, articleName, zone, stock, sscc, ... }] } → header + array rows
        const pretty = { articleId: "Article_id", articleName: "Article_name", zone: "Reach zone", stock: "Stock", sscc: "SSCC", pickLocation: "Pick location", deadline: "Departure_deadline", status: "Status", externalReference: "External_reference" };
        if (Array.isArray(j.rows) && j.rows.length && !Array.isArray(j.rows[0]) && typeof j.rows[0] === "object") { const keys = [...new Set(j.rows.flatMap(r => Object.keys(r)))]; j = { header: keys.map(k => pretty[k] || k), rows: j.rows.map(r => keys.map(k => String(r[k] ?? ""))), from: j.from || "priority-bot payload" }; }
        // An EMPTY bot payload ({ rows: [] }) is a real message — "the sheet has no rows right now" (e.g. every blocked pallet was
        // resolved). It carries no header, so reuse the last one we saw for this purpose (or the bot's default). Rejecting it froze
        // the server on the last non-empty push and the phones kept showing pallets that were long gone.
        else if (Array.isArray(j.rows) && j.rows.length === 0 && !Array.isArray(j.header)) { const prev = store.__sheets?.[purpose]?.header; j = { header: prev && prev.length ? prev : Object.values(pretty), rows: [], from: j.from || "priority-bot payload (empty)" }; }
        if (!Array.isArray(j.header) || !Array.isArray(j.rows)) throw new Error("expected {header, rows}"); store.__sheets = store.__sheets || {}; store.__sheets[purpose] = { header: j.header, rows: j.rows, receivedAt: new Date().toISOString(), from: j.from || "" }; const applied = applyPushToState(purpose, store.__sheets[purpose]); save(); if (purpose === "dock") checkDeadlines("after dock push"); console.log(`[sheet] ${purpose}: ${j.rows.length} rows pushed at ${new Date().toLocaleTimeString()}${applied}`); res.writeHead(200, cors).end(JSON.stringify({ ok: true, rows: j.rows.length })); } catch (e) { res.writeHead(400, cors).end(String(e.message || e)); } }); return; }
    if (req.method === "GET" && purpose.endsWith("/log")) { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify(store.__pushlog?.[purpose.replace(/\/log$/, "")] || [])); }
    if (req.method === "GET") { const sh = store.__sheets?.[purpose]; res.writeHead(sh ? 200 : 404, { ...cors, "Content-Type": "application/json" }); return res.end(sh ? JSON.stringify(sh) : ""); }
  }
  // Cheap poll target: just the version, so the app can check "did anything change?" every few seconds without pulling the whole state.
  if (req.url === "/boot") { res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ bootId: BOOT_ID })); }
  if (req.url.startsWith("/meta/")) { const k = decodeURIComponent(req.url.replace(/^\/meta\//, "").split("?")[0]); res.writeHead(200, { ...cors, "Content-Type": "application/json" }); return res.end(JSON.stringify({ updatedAt: store.__meta?.[k] || null })); }
  const key = decodeURIComponent(req.url.replace(/^\/storage\//, "").split("?")[0]);
  if (!req.url.startsWith("/storage/")) return serveStatic(req, res);
  if (req.method === "GET") { const v = store[key]; res.writeHead(v == null ? 404 : 200, { ...cors, "Content-Type": "application/json" }); return res.end(v == null ? "" : JSON.stringify({ key, value: v, updatedAt: store.__meta?.[key] })); }
  if (req.method === "PUT") { const chunks = []; req.on("data", c => chunks.push(c)); req.on("end", () => { const body = Buffer.concat(chunks).toString("utf8");
      // Guard: an (almost) empty app state must not overwrite a populated one — a fresh device would otherwise wipe everyone's data.
      if (key === STATE_KEY && store[key] && !req.headers["x-force"]) { const size = v => { try { const j = JSON.parse(v); return (j.categories || []).length + (j.products || []).length + (j.inspections || []).length + (j.integrations || []).length + (j.templates || []).length; } catch { return 0; } }; const incoming = size(body), current = size(store[key]); if (incoming === 0 && current > 0 || incoming < current * 0.5 && current > 20) { console.log(`[state] rejected write: incoming ${incoming} objects vs current ${current}`); res.writeHead(409, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ rejected: true, reason: "incoming state is much smaller than the stored one", incoming, current })); return; } }
      // Optimistic concurrency: If-Match must equal the stored version (updatedAt); otherwise 409 with the current copy so the client can merge.
      const ifMatch = req.headers["if-match"]; const currentVersion = store.__meta?.[key] ? String(store.__meta[key]) : null;
      if (ifMatch && currentVersion && ifMatch !== currentVersion && !req.headers["x-force"]) { res.writeHead(409, { ...cors, "Content-Type": "application/json" }); res.end(JSON.stringify({ conflict: true, value: store[key], updatedAt: store.__meta[key] })); return; }
      snapshot(key, body); store[key] = body; const now = Math.max(Date.now(), (store.__meta?.[key] || 0) + 1); (store.__meta = store.__meta || {})[key] = now; save(); res.writeHead(200, { ...cors, "Content-Type": "application/json" }).end(JSON.stringify({ key, updatedAt: now })); }); return; }
  if (req.method === "DELETE") { delete store[key]; save(); return res.writeHead(200, cors).end(); }
  res.writeHead(405, cors).end();
};
const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === "IPv4" && !i.internal).map(i => i.address);
http.createServer(handler).listen(PORT, "0.0.0.0", () => console.log(`QCteam state server  http://localhost:${PORT}   phone: ${ips.map(ip => `http://${ip}:${PORT}`).join(" ")}`));
setInterval(() => checkDeadlines("timer"), 2 * 60 * 1000);
const certP = new URL("./cert.pem", import.meta.url), keyP = new URL("./key.pem", import.meta.url);
if (fs.existsSync(certP) && fs.existsSync(keyP)) https.createServer({ cert: fs.readFileSync(certP), key: fs.readFileSync(keyP) }, handler).listen(PORT + 1, "0.0.0.0", () => console.log(`                     https://localhost:${PORT + 1}  phone: ${ips.map(ip => `https://${ip}:${PORT + 1}`).join(" ")}`));
else console.log("(no server/cert.pem — HTTPS state server off; run: npm run cert)");
