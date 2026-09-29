# QCteam prototypes — local & hosted

Two prototypes sharing one live state: the Head portal (`/`) and the controller phone app (`/#mobile`), plus a
one-file Node state server that also serves the built app and receives pushes from the work Google Sheets.

## Run locally (Mac)
```bash
npm install
npm run server      # terminal 1 — state server on :3001 (prints the phone URL)
npm run dev         # terminal 2 — app on :5173 (any other port: set VITE_QC_SERVER, see .env.example)
npm test            # unit tests (vitest)
```
- Portal (Head): http://localhost:5173/
- Phone app: http://<mac-ip>:5173/#mobile on a phone in the same Wi-Fi / your hotspot
  (iPhone: Share → Add to Home Screen → opens full-screen as "QCteam")

With the state server running, the portal and the phone share one live state (`server/state.json`).
Without it, each device keeps its own state in localStorage (use Menu → Data to import/export).

## Host it (one service)
`npm run build`, then run `node server/server.mjs` with a persistent disk: the server serves `dist/` and the API on
the same origin, so no `VITE_QC_SERVER` is needed. On Render: build command `npm install && npm run build`, start
command `node server/server.mjs`, a Disk mounted at `/data` with `STATE_DIR=/data`, and the environment variables
from the section below.

## Access & security
The API — state, photos, backups, sheet dumps — is behind one **access key** per deployment:

- Set `QC_APP_TOKEN` on the server (24+ random characters). Without it the API is open; the server says so at boot.
- The first time a device opens the app it asks for the key. On success the server sets an `HttpOnly`,
  `SameSite=Lax` cookie valid for a year, so every later request (including photos loaded by `<img>`) carries it
  without the app doing anything. Scripts can send `Authorization: Bearer <key>` or `X-App-Key: <key>` instead.
- The Google Apps Script has no cookie: it identifies its pushes with `X-Sync-Key`, which must equal `QC_SYNC_KEY`
  on the server. Once `QC_APP_TOKEN` is set, `QC_SYNC_KEY` is required too or pushes are refused (401).
- To lock everyone out (a key leaked, a phone lost): change `QC_APP_TOKEN` and restart — every cookie was derived from
  the old key and stops working; each device asks for the new key on its next open.
- The app shell itself (`index.html`, `/assets`, fonts, icons) stays public; it contains no data.

What this does **not** do: it is one shared key, not per-user accounts — the PIN sign-in inside the app identifies
who is working, it is not a security boundary. Real authentication (per-user credentials, roles enforced by the
API) belongs to the production system, not the prototype.

## Files
- `src/Portal.jsx`, `src/Mobile.jsx` — the two prototypes
- `src/shared/` — logic both prototypes import (report PDF, images, formatting, floor status)
- `src/sync.js` — shared-state synchronisation (base + pending edits, versioned saves, conflict replay)
- `src/externalize.js` — keeps photos out of the state document on the device side (see `server/blobs.mjs`)
- `src/storage-shim.js` — `window.storage` → state server, falling back to localStorage; `src/access-gate.js` — the key prompt
- `public/sw.js` — offline app shell (never caches data)
- `server/server.mjs` — the state server: `/storage/:key` (GET/PUT/DELETE, `If-Match` versioning), `/meta`, `/photos`,
  `/sheet/<purpose>` (push + pull), `/backups`, `/auth/*`; `server/auth.mjs` — the access key;
  `server/sheetlogic.mjs`, `alertlogic.mjs`, `misslogic.mjs`, `retain.mjs`, `blobs.mjs` — server-side processing, each with tests
