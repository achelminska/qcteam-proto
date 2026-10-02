import { describe, it, expect } from "vitest";
import { COOKIE, sessionFor, safeEqual, parseCookies, bearerOf, isPublic, isAuthorized, isSecure, cookieHeader, clearCookieHeader, corsFor } from "./auth.mjs";

const TOKEN = "correct-horse-battery-staple";
const req = (headers = {}, socket = {}) => ({ headers, socket });

describe("what is public", () => {
  it("app shell and assets need no key", () => {
    for (const p of ["/", "/index.html", "/assets/index-abc.js", "/fonts/Roboto-Regular.ttf", "/manifest.webmanifest", "/sw.js", "/icon.svg"]) expect(isPublic(p, "GET")).toBe(true);
  });
  it("login and boot are public, preflights always", () => {
    expect(isPublic("/auth/login", "POST")).toBe(true);
    expect(isPublic("/boot", "GET")).toBe(true);
    expect(isPublic("/storage/x", "OPTIONS")).toBe(true);
  });
  it("everything that holds data is private", () => {
    for (const p of ["/storage/qcteam-portal-state-v2-clean", "/meta/x", "/photos/abc.jpg", "/photos", "/files", "/files/abc.pdf", "/sheet/dock", "/sheet/dock/log", "/backups", "/backups/state-1.json/restore", "/proxy", "/auth/status", "/auth/logout"]) expect(isPublic(p, "GET")).toBe(false);
  });
  it("a query string does not change the verdict", () => {
    expect(isPublic("/storage/x?cb=1", "GET")).toBe(false);
    expect(isPublic("/photos-not-really", "GET")).toBe(true); // prefix must be a path segment
  });
});

describe("who is authorized", () => {
  it("no key configured → open", () => { expect(isAuthorized(req(), "")).toBe(true); });
  it("nothing presented → refused", () => { expect(isAuthorized(req(), TOKEN)).toBe(false); });
  it("the cookie the server issued → accepted", () => {
    expect(isAuthorized(req({ cookie: `theme=dark; ${COOKIE}=${sessionFor(TOKEN)}` }), TOKEN)).toBe(true);
  });
  it("a cookie made from another key → refused", () => {
    expect(isAuthorized(req({ cookie: `${COOKIE}=${sessionFor("other")}` }), TOKEN)).toBe(false);
  });
  it("Bearer and X-App-Key with the raw key → accepted; wrong → refused", () => {
    expect(isAuthorized(req({ authorization: `Bearer ${TOKEN}` }), TOKEN)).toBe(true);
    expect(isAuthorized(req({ authorization: "bearer  " + TOKEN + " " }), TOKEN)).toBe(true);
    expect(isAuthorized(req({ "x-app-key": TOKEN }), TOKEN)).toBe(true);
    expect(isAuthorized(req({ authorization: "Bearer nope" }), TOKEN)).toBe(false);
    expect(isAuthorized(req({ "x-app-key": TOKEN + "x" }), TOKEN)).toBe(false);
  });
  it("the session value never equals the key itself", () => {
    expect(sessionFor(TOKEN)).not.toBe(TOKEN);
    expect(sessionFor(TOKEN)).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionFor(TOKEN)).not.toBe(sessionFor(TOKEN + "1"));
    expect(isAuthorized(req({ authorization: `Bearer ${sessionFor(TOKEN)}` }), TOKEN)).toBe(false); // a leaked cookie value is not a key
  });
});

describe("helpers", () => {
  it("safeEqual: equal only for identical non-empty strings", () => {
    expect(safeEqual("a", "a")).toBe(true);
    expect(safeEqual("a", "b")).toBe(false);
    expect(safeEqual("", "")).toBe(false);
    expect(safeEqual(undefined, "")).toBe(false);
    expect(safeEqual("ab", "a")).toBe(false);
  });
  it("parseCookies handles spacing, empties and encoded values", () => {
    expect(parseCookies("a=1; b=two ;c=%20x")).toEqual({ a: "1", b: "two", c: " x" });
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("junk; =nokey; k=v=w")).toEqual({ k: "v=w" });
  });
  it("bearerOf", () => {
    expect(bearerOf(req({ authorization: "Bearer abc" }))).toBe("abc");
    expect(bearerOf(req({ authorization: "Basic abc" }))).toBe(null);
    expect(bearerOf(req())).toBe(null);
  });
  it("cookie header: HttpOnly, Lax, a year, Secure only over https", () => {
    const h = cookieHeader(TOKEN, false);
    expect(h).toContain(`${COOKIE}=${sessionFor(TOKEN)}`);
    expect(h).toContain("HttpOnly"); expect(h).toContain("SameSite=Lax"); expect(h).toContain("Max-Age=31536000"); expect(h).not.toContain("Secure");
    expect(cookieHeader(TOKEN, true)).toContain("; Secure");
    expect(clearCookieHeader(true)).toContain("Max-Age=0");
  });
  it("isSecure: TLS socket or X-Forwarded-Proto from the host's proxy", () => {
    expect(isSecure(req({}, { encrypted: true }))).toBe(true);
    expect(isSecure(req({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isSecure(req({ "x-forwarded-proto": "http" }))).toBe(false);
    expect(isSecure(req())).toBe(false);
  });
  it("corsFor: wildcard without Origin, echo + credentials with one", () => {
    expect(corsFor(req())["Access-Control-Allow-Origin"]).toBe("*");
    expect(corsFor(req())["Access-Control-Allow-Credentials"]).toBeUndefined();
    const c = corsFor(req({ origin: "http://localhost:5173" }));
    expect(c["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
    expect(c["Access-Control-Allow-Credentials"]).toBe("true");
    expect(c["Vary"]).toBe("Origin");
    expect(c["Access-Control-Allow-Headers"]).toMatch(/Authorization/);
    expect(c["Access-Control-Allow-Headers"]).toMatch(/X-Sync-Key/);
  });
});
