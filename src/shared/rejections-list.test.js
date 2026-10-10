import { describe, it, expect } from "vitest";
import { extRejectionsEverything, filterRejectionsByPeriod, searchRejections } from "./rejections.js";

const s = { extRejections: { latest: [{ a: "1", n: "Kiwi", d: "2026-10-10T07:00", po: "P1", reason: "Mould" }, { a: "2", n: "Prei", d: "2026-10-03T07:00", po: "P2", reason: "Decay" }],
  byArticle: { "1": { name: "Kiwi", recent: [{ d: "2026-10-10T07:00", po: "P1", reason: "Mould" }, { d: "2026-09-20T07:00", po: "P9", reason: "Soft" }] }, "3": { name: "Appels", recent: [{ d: "2026-10-08T07:00", po: "P3", reason: "Bruising" }] } } } };

describe("everything the digest holds", () => {
  it("unions latest and per-article recents without duplicates, newest first", () => {
    const all = extRejectionsEverything(s);
    expect(all.map(e => `${e.n}:${e.d.slice(0, 10)}`)).toEqual(["Kiwi:2026-10-10", "Appels:2026-10-08", "Prei:2026-10-03", "Kiwi:2026-09-20"]);
  });
  it("filters by today and by a week", () => {
    const all = extRejectionsEverything(s);
    expect(filterRejectionsByPeriod(all, "today", { today: "2026-10-10" })).toHaveLength(1);
    expect(filterRejectionsByPeriod(all, "week", { weekRange: { from: "2026-10-05", to: "2026-10-11" } })).toHaveLength(2);
    expect(filterRejectionsByPeriod(all, "all")).toHaveLength(4);
  });
  it("searches every word across name, reason, controller and PO", () => {
    const all = extRejectionsEverything(s);
    expect(searchRejections(all, "kiwi mould")).toHaveLength(1);
    expect(searchRejections(all, "P3")).toHaveLength(1);
    expect(searchRejections(all, "")).toHaveLength(4);
  });
});
