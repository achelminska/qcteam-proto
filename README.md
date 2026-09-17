# QCteam prototypes — local & hosted

## Run locally (Mac)
```bash
npm install
npm run server      # terminal 1 — shared state on :3001 (prints the phone URL)
npm run dev         # terminal 2 — app on :5173
```
- Portal (Head): http://localhost:5173/
- Phone app: http://<mac-ip>:5173/#mobile on a phone in the same Wi-Fi / your hotspot
  (iPhone: Share → Add to Home Screen → opens full-screen as "QCteam")

With the state server running, the portal and the phone share one live state (`server/state.json`).
Without it, each device keeps its own state in localStorage (use Menu → Data to import/export).

## Host it (no Mac needed afterwards)
- Front: `npm run build` → deploy `dist/` to Vercel / Netlify / GitHub Pages (static).
- State server: deploy `server/server.mjs` to Render / Railway / Fly (Node, no dependencies; start command `node server/server.mjs`, port from `PORT` env if set).
- Set `VITE_QC_SERVER=https://<your-state-server>` at build time (see `.env.example`), rebuild, redeploy the front.

## Files
- `src/Portal.jsx`, `src/Mobile.jsx` — the two prototypes (unchanged from the design sessions)
- `src/storage-shim.js` — `window.storage` → state server, falling back to localStorage
- `server/server.mjs` — the state server (GET/PUT/DELETE /storage/:key)
