// QCteam local state server — one file, no dependencies. Run: node server/server.mjs
// HTTP on :3001 and, if server/cert.pem + server/key.pem exist, HTTPS on :3002 (needed when the app itself runs over HTTPS —
// browsers block mixed content). Create the cert once:  npm run cert
import http from "node:http"; import https from "node:https"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { targetsFor, suggestMappings, applyMapping, detectTable, extractSummary } from "./sheetlogic.mjs";
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
const applyPushToState = (purpose, sheet) => {
  try {
    const raw = store[STATE_KEY]; if (!raw) return " (no app state yet)";
    const st = JSON.parse(raw); const P = purpose === "dock" ? "Dock" : purpose === "blocked" ? "Blocked" : "Products";
    const targets = (st.integrations || []).filter(i => i.purpose === P && i.pushMode); if (!targets.length) return ` (no ${P} integration in push mode)`;
    const tg = targetsFor(P); const j = detectTable({ header: sheet.header, rows: sheet.rows });
    st.integrations = st.integrations.map(i => { if (!targets.some(t => t.id === i.id)) return i;
      const mappings = i.mappings?.length && (i.header || []).join("|") === j.header.join("|") ? i.mappings : suggestMappings(j.header, j.rows, tg);
      const rows = applyMapping({ ...i, mappings }, j.header, j.rows);
      return { ...i, header: j.header, sample: j.rows, rawHeader: sheet.header, rawRows: sheet.rows, mappings, rows: P !== "Products" ? rows : i.rows, summary: P !== "Products" ? extractSummary(sheet.header, sheet.rows) : i.summary, lastSyncAt: new Date().toISOString(), lastPushAt: sheet.receivedAt, liveStatus: `OK — ${j.rows.length} rows, pushed by the sheet at ${new Date(sheet.receivedAt).toLocaleTimeString("en-GB")} (applied on the server)` }; });
    store[STATE_KEY] = JSON.stringify(st); (store.__meta = store.__meta || {})[STATE_KEY] = Date.now();
    return " → applied to app state";
  } catch (e) { return ` (apply failed: ${e.message})`; }
};
const handler = async (req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, cors).end();
  // /proxy?url=…  — fetch a public sheet endpoint (Apps Script JSON or published CSV) server-side, so the browser's CORS rules don't apply
  if (req.url.startsWith("/proxy?")) { try { const url = new URL(req.url, "http://x").searchParams.get("url"); if (!/^https:\/\/(script\.google\.com|docs\.google\.com|script\.googleusercontent\.com)\//.test(url || "")) { res.writeHead(400, cors).end("only Google Sheets / Apps Script URLs"); return; } const r = await fetch(url, { redirect: "follow" }); const txt = await r.text(); res.writeHead(r.ok ? 200 : r.status, { ...cors, "Content-Type": r.headers.get("content-type") || "text/plain" }); res.end(txt); } catch (e) { res.writeHead(502, cors).end(String(e.message || e)); } return; }
  // /sheet/<purpose>  — PUSH from Google Apps Script (UrlFetchApp) and PULL by the apps. The sheet pushes {header, rows}; a shared key guards the POST.
  if (req.url.startsWith("/sheet/")) {
    const purpose = req.url.replace(/^\/sheet\//, "").split("?")[0].toLowerCase();
    if (req.method === "POST") { if (SYNC_KEY && req.headers["x-sync-key"] !== SYNC_KEY) { res.writeHead(401, cors).end("bad X-Sync-Key"); return; } let body = ""; req.on("data", c => body += c); req.on("end", () => { try { const j = JSON.parse(body); if (!Array.isArray(j.header) || !Array.isArray(j.rows)) throw new Error("expected {header, rows}"); store.__sheets = store.__sheets || {}; store.__sheets[purpose] = { header: j.header, rows: j.rows, receivedAt: new Date().toISOString(), from: j.from || "" }; const applied = applyPushToState(purpose, store.__sheets[purpose]); save(); console.log(`[sheet] ${purpose}: ${j.rows.length} rows pushed at ${new Date().toLocaleTimeString()}${applied}`); res.writeHead(200, cors).end(JSON.stringify({ ok: true, rows: j.rows.length })); } catch (e) { res.writeHead(400, cors).end(String(e.message || e)); } }); return; }
    if (req.method === "GET") { const sh = store.__sheets?.[purpose]; res.writeHead(sh ? 200 : 404, { ...cors, "Content-Type": "application/json" }); return res.end(sh ? JSON.stringify(sh) : ""); }
  }
  const key = decodeURIComponent(req.url.replace(/^\/storage\//, "").split("?")[0]);
  if (!req.url.startsWith("/storage/")) return serveStatic(req, res);
  if (req.method === "GET") { const v = store[key]; res.writeHead(v == null ? 404 : 200, { ...cors, "Content-Type": "application/json" }); return res.end(v == null ? "" : JSON.stringify({ key, value: v, updatedAt: store.__meta?.[key] })); }
  if (req.method === "PUT") { let body = ""; req.on("data", c => body += c); req.on("end", () => { store[key] = body; (store.__meta = store.__meta || {})[key] = Date.now(); save(); res.writeHead(200, cors).end(JSON.stringify({ key })); }); return; }
  if (req.method === "DELETE") { delete store[key]; save(); return res.writeHead(200, cors).end(); }
  res.writeHead(405, cors).end();
};
const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === "IPv4" && !i.internal).map(i => i.address);
http.createServer(handler).listen(PORT, "0.0.0.0", () => console.log(`QCteam state server  http://localhost:${PORT}   phone: ${ips.map(ip => `http://${ip}:${PORT}`).join(" ")}`));
const certP = new URL("./cert.pem", import.meta.url), keyP = new URL("./key.pem", import.meta.url);
if (fs.existsSync(certP) && fs.existsSync(keyP)) https.createServer({ cert: fs.readFileSync(certP), key: fs.readFileSync(keyP) }, handler).listen(PORT + 1, "0.0.0.0", () => console.log(`                     https://localhost:${PORT + 1}  phone: ${ips.map(ip => `https://${ip}:${PORT + 1}`).join(" ")}`));
else console.log("(no server/cert.pem — HTTPS state server off; run: npm run cert)");
