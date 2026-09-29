// Access control for the state server. One shared access key per deployment (QC_APP_TOKEN). A device presents it
// once (POST /auth/login) and gets an HttpOnly cookie back; from then on every request the app makes — state, photos
// loaded by <img>, backups, sheet dumps — carries the cookie without the app having to know. Scripts and curl can
// send the key directly as `Authorization: Bearer <key>` or `X-App-Key`.
//
// SameSite=Lax is what makes this safe against cross-site requests: a page on another origin cannot make the
// browser attach the cookie to a fetch/PUT/DELETE here. Same-site (the hosted app, or Vite on :5173 talking to
// :3001 on localhost) is allowed, which is exactly the two cases we have.
//
// No key configured → everything is open, as before (local development). The server says so loudly at boot.
import { createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE = "qc_session";
const YEAR = 365 * 24 * 3600;

// The cookie never carries the key itself, only a value derived from it: a leaked cookie grants access to this
// deployment but does not reveal a key the Head may have typed elsewhere. Rotating the key invalidates every cookie.
export const sessionFor = (token) => createHmac("sha256", String(token)).update("qcteam-session-v1").digest("hex");

export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? ""));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
};

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("="); if (i < 0) continue;
    const k = part.slice(0, i).trim(); if (!k) continue;
    out[k] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function bearerOf(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers?.authorization || "");
  return m ? m[1].trim() : null;
}

// Paths that need no key: the app shell and its assets (index.html, /assets, fonts, icons — nothing private in them),
// the login endpoint itself, and /boot (a random id that only says "the process restarted"). Everything that holds
// or changes data is behind the key.
const PRIVATE = /^\/(storage|meta|photos|sheet|backups|proxy|auth)(\/|$)/;
export function isPublic(url, method) {
  if (method === "OPTIONS") return true;
  const p = String(url || "").split("?")[0];
  if (p === "/auth/login" || p === "/boot") return true;
  return !PRIVATE.test(p);
}

export function isAuthorized(req, token) {
  if (!token) return true;
  const session = sessionFor(token);
  const cookie = parseCookies(req.headers?.cookie)[COOKIE];
  if (cookie && safeEqual(cookie, session)) return true;
  const bearer = bearerOf(req);
  if (bearer && safeEqual(bearer, token)) return true;
  const x = req.headers?.["x-app-key"];
  if (x && safeEqual(x, token)) return true;
  return false;
}

// Behind Render (and most hosts) the process sees plain HTTP; the original scheme arrives in X-Forwarded-Proto.
export const isSecure = (req) => !!(req.socket?.encrypted || /^https/i.test(String(req.headers?.["x-forwarded-proto"] || "")));

export const cookieHeader = (token, secure) => `${COOKIE}=${sessionFor(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${YEAR}${secure ? "; Secure" : ""}`;
export const clearCookieHeader = (secure) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;

// With credentials the browser refuses a wildcard origin, so echo the caller's origin back. The cookie's SameSite
// rule — not this header — is what keeps other sites out; echoing is safe because a cross-site page never gets
// the cookie attached in the first place.
const METHODS = "GET,PUT,POST,DELETE,OPTIONS";
const HEADERS = "Content-Type,If-Match,X-Force,X-Replace,X-Sync-Key,X-Secret,Authorization,X-App-Key";
export function corsFor(req) {
  const origin = req.headers?.origin;
  if (!origin) return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": METHODS, "Access-Control-Allow-Headers": HEADERS };
  return { "Access-Control-Allow-Origin": origin, "Vary": "Origin", "Access-Control-Allow-Credentials": "true", "Access-Control-Allow-Methods": METHODS, "Access-Control-Allow-Headers": HEADERS };
}
