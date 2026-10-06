import { describe, it, expect } from "vitest";
import { parseRejectionTime, parseSortableCell, normArticle, buildRejectionDigest, extRejectionsFor, extRejectedRecently, extRejectionLine, extRejectionsRecent, topCats, personName, linkLabel } from "./rejections.js";

describe("reading one cell — the formats the DC5 sheet uses today", () => {
  it("both timestamp styles, ISO, and junk", () => {
    expect(parseRejectionTime("Jan 1, 2026, 16:48:39")).toBe("2026-01-01T16:48");
    expect(parseRejectionTime("Sept 30, 2026, 07:34:01")).toBe("2026-09-30T07:34");
    expect(parseRejectionTime("18/05/2026 16:43:47")).toBe("2026-05-18T16:43");
    expect(parseRejectionTime("Thu Jan 01 2026 16:48:39 GMT+0100 (Central European Standard Time)")).toBe("2026-01-01T16:48"); // Apps Script Date.toString()
    expect(parseRejectionTime("Sat Oct 03 2026 14:12:00 GMT+0200 (Central European Summer Time)")).toBe("2026-10-03T14:12");
    expect(parseRejectionTime("2026-05-18T16:43:47.000Z")).toBe("2026-05-18T16:43");
    expect(parseRejectionTime("2026-05-18")).toBe("2026-05-18T00:00");
    expect(parseRejectionTime("")).toBe(null); expect(parseRejectionTime("Time")).toBe(null); expect(parseRejectionTime("45/13/2026")).toBe(null);
  });
  it("sortable column carries yes/no plus the reason class", () => {
    expect(parseSortableCell("Yes - Quality (according to list)")).toEqual({ sortable: true, cat: "Quality (according to list)" });
    expect(parseSortableCell("No - Other (explain reason in thread)")).toEqual({ sortable: false, cat: "Other" });
    expect(parseSortableCell("Yes")).toEqual({ sortable: true, cat: "" });
    expect(parseSortableCell("")).toEqual({ sortable: null, cat: "" });
  });
  it("people: Slack handle or e-mail → a name; link labels", () => {
    expect(personName("@Wieneke Konings")).toBe("Wieneke Konings"); expect(personName("damian.mrowka@teampicnic.com")).toBe("Damian Mrowka"); expect(personName("")).toBe("");
    expect(linkLabel("https://teampicnic.slack.com/x")).toBe("Slack thread"); expect(linkLabel("https://drive.google.com/open?id=1")).toBe("Attached file");
  });
  it("article ids: plain, HE-prefixed, with CU suffix", () => {
    expect(normArticle("90006116")).toBe("90006116"); expect(normArticle("HE90006135-16")).toBe("90006135"); expect(normArticle("10074677-16")).toBe("10074677"); expect(normArticle("Product ID")).toBe("");
  });
});

const NOW = "2026-10-03T12:00:00.000Z";
const row = (o) => ({ article: "90006116", name: "Merkloos Andijvie 1 stuk", tu: "15", reason: "Major remarks (cold damage)", sortClass: "Yes - Quality (according to list)", user: "@Wieneke Konings", time: "Oct 1, 2026, 16:48:39", po: "1094749", outcome: "Picked up", orderGroup: "DC5-fruchtkontor-nl-primeale", link: "https://teampicnic.slack.com/archives/C08G96XNKH8/p1767286122147749", _errors: [], ...o });
const rows = [
  row({}),
  row({ time: "28/09/2026 09:11:53", tu: "20", reason: "Mold", sortClass: "No - Overripe", po: "1095000", user: "damian.mrowka@teampicnic.com", outcome: "", link: "" }),
  row({ time: "Jan 3, 2026, 07:56:09", tu: "5", reason: "old one", po: "1000001" }),
  row({ time: "Jan 3, 2025, 07:56:09", tu: "99", reason: "last year — outside the window", po: "999" }),
  row({ article: "HE11295128-16", name: "Merkloos Paprika mix 3 stuks", time: "Sep 30, 2026, 23:09:35", tu: "210", reason: "insect damages", sortClass: "Yes - Quality (according to list)", po: "1093779", outcome: "Thrown away (requested by supplier)" }),
  row({ article: "11295128", time: "", tu: "1", reason: "undated row", po: "" }),
  row({ article: "Product ID", name: "Product Name", time: "Time", tu: "TU rejected" }),   // the repeated header row in the middle of the sheet
  { article: "", _errors: ["article empty"] },
];

describe("building the digest", () => {
  const d = buildRejectionDigest(rows, { now: NOW });
  const s = { extRejections: d };
  it("counts rows, skips errors and the repeated header, drops rows older than the window, keeps undated ones", () => {
    expect(d).toMatchObject({ rows: 8, used: 5, skipped: 2, old: 1, undated: 1, articles: 2, from: "2026-01-03", to: "2026-10-01", windowDays: 365 });
  });
  it("per-article: counts, TU, last, 30/90-day counts, reason classes, newest-first recent rows", () => {
    const a = extRejectionsFor(s, "90006116");
    expect(a).toMatchObject({ name: "Merkloos Andijvie 1 stuk", count: 3, tu: 40, last: "2026-10-01T16:48", c30: 2, c90: 2 });
    expect(topCats(a)).toEqual([{ name: "Quality (according to list)", count: 2 }, { name: "Overripe", count: 1 }]);
    expect(a.recent.map(r => r.po)).toEqual(["1094749", "1095000", "1000001"]);
    expect(a.recent[0]).toMatchObject({ d: "2026-10-01T16:48", tu: 15, reason: "Major remarks (cold damage)", cat: "Quality (according to list)", sortable: true, user: "Wieneke Konings", outcome: "Picked up", group: "DC5-fruchtkontor-nl-primeale", link: expect.stringMatching(/^https:\/\/teampicnic/) });
    expect(a.recent[0]).not.toHaveProperty("a"); expect(a.recent[0]).not.toHaveProperty("n");
    expect(a.recent[1]).toMatchObject({ user: "Damian Mrowka", sortable: false, cat: "Overripe" }); expect(a.recent[1]).not.toHaveProperty("outcome"); expect(a.recent[1]).not.toHaveProperty("link"); // empty cells are not stored
  });
  it("HE-prefixed and plain ids land on the same article; lookups accept any spelling", () => {
    const p = extRejectionsFor(s, "HE11295128-8"); expect(p.count).toBe(2); expect(p.recent.length).toBe(2);
    expect(extRejectionsFor(s, "00011295128")).toBe(p); expect(extRejectionsFor(s, "nope")).toBe(null);
  });
  it("recently-rejected flag and the one-line summary", () => {
    const nowMs = new Date(NOW).getTime();
    expect(extRejectedRecently(s, "90006116", 14, nowMs)).toBe(true); expect(extRejectedRecently(s, "90006116", 1, nowMs)).toBe(false); expect(extRejectedRecently(s, "123", 14, nowMs)).toBe(false);
    const l = extRejectionLine(s, "90006116", nowMs);
    expect(l).toMatchObject({ count: 2, span: "30 days", total: 2, tu: 35, last: "2026-10-01T16:48", tail: "", yearCount: 3 });
    expect(l.recent.map(r => r.po)).toEqual(["1094749", "1095000"]); // the January row is not shown on the floor
    expect(extRejectionLine(s, "11295128", nowMs)).toMatchObject({ count: 1, span: "30 days", total: 1 });
    expect(extRejectionLine(s, "x", nowMs)).toBe(null);
    expect(extRejectionLine(s, "90006116", nowMs + 40 * 86400000)).toBe(null); // 40 days later: nothing in the window → nothing shown
  });
  it("latest list for the shift-update cards, newest first, dated only", () => {
    expect(d.latest.map(e => e.po)).toEqual(["1094749", "1093779", "1095000", "1000001"]);
    expect(extRejectionsRecent(s, 7, new Date(NOW).getTime()).map(e => e.a)).toEqual(["90006116", "11295128", "90006116"]);
  });
  it("is small: recent capped per article, the raw rows never copied", () => {
    const big = Array.from({ length: 50 }, (_, i) => row({ po: String(i), time: `Sep ${1 + (i % 28)}, 2026, 08:00:00` }));
    const g = extRejectionsFor({ extRejections: buildRejectionDigest(big, { now: NOW }) }, "90006116");
    expect(g.count).toBe(50); expect(g.recent.length).toBe(3); expect(g.recent[0].d >= g.recent[1].d).toBe(true);
    // window saturated (3 recent rows all inside 30 days) → the digest's 30-day count is used, not just the 3 kept rows
    expect(extRejectionLine({ extRejections: buildRejectionDigest(big, { now: NOW }) }, "90006116", new Date(NOW).getTime())).toMatchObject({ count: g.c30, tail: "mostly Quality (according to list)" });
    expect(buildRejectionDigest(big, { now: NOW, latestCount: 10 }).latest.length).toBe(10);
  });
  it("empty push → empty digest, nothing throws", () => {
    expect(buildRejectionDigest([], { now: NOW })).toMatchObject({ used: 0, articles: 0, from: null, latest: [] });
    expect(buildRejectionDigest(undefined, { now: NOW }).rows).toBe(0);
  });
});
