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

import { summarizeRejections, matchesRejectionFacets, filterRejectionsByFacets, rejectionTimeline } from "./rejections.js";
describe("summarizeRejections", () => {
  const rows = [
    { a: "1", n: "Avocado", d: "2026-10-05T10:00", tu: 10, reason: "Freq mold (12,5%)", cat: "Quality (according to list)", user: "Damian Mrowka" },
    { a: "1", n: "Avocado", d: "2026-10-06T10:00", tu: 5, reason: "Low brix", cat: "Quality (according to list)", user: "Snizhana Myshkina" },
    { a: "2", n: "Oranges", d: "2026-10-06T11:00", tu: 20, reason: "low brix", user: "Damian Mrowka" },
    { a: "3", n: "Grapes", d: "2026-10-07T11:00", user: "" },
  ];
  it("counts rejections and TU per product, reason and controller", () => {
    const s = summarizeRejections(rows);
    expect(s.total).toBe(4); expect(s.tu).toBe(35);
    expect(s.products[0]).toMatchObject({ label: "Avocado", count: 2, tu: 15 });
    expect(s.products[0].sub.map(x => x.label).sort()).toEqual(["Low brix", "Mold"]);
    expect(s.reasons.map(r => r.label)).toEqual(["Low brix", "Mold", "Not given"]);
    expect(s.users[0]).toMatchObject({ label: "Damian Mrowka", count: 2, tu: 30 });
    expect(s.users[0].sub.map(x => x.label)).toEqual(["Oranges", "Avocado"]);
    expect(s.users.at(-1).label).toBe("Unknown");
  });
  it("is empty for no rows", () => { expect(summarizeRejections([])).toMatchObject({ total: 0, tu: 0, products: [], reasons: [], users: [] }); });
});

import { reasonTheme } from "./rejections.js";
it("folds the free-text reason into a theme and never uses the sortable class", () => {
  expect(reasonTheme("Freq decay, mold (12,5%)")).toBe("Decay");
  expect(reasonTheme("Major remarks (mold)")).toBe("Mold");
  expect(reasonTheme("Decay/mold")).toBe("Decay");
  expect(reasonTheme("Underweight 16,6% (partial rejection)")).toBe("Underweight");
  expect(reasonTheme("Major remarks (insect damage)")).toBe("Insect damage");
  expect(reasonTheme("damaged pallet, risk to collapse")).toBe("Damaged pallet");
  expect(reasonTheme("low brix.")).toBe("Low brix");
  expect(reasonTheme("")).toBe("Not given");
});

it("keeps the sheet's own wording under each reason theme", () => {
  const s = summarizeRejections([{ a: "1", n: "A", reason: "Freq mold (12,5%)" }, { a: "1", n: "A", reason: "mold." }, { a: "2", n: "B", reason: "Mold " }]);
  expect(s.reasons[0].label).toBe("Mold");
  expect(s.reasons[0].sub.map(x => [x.label, x.count])).toEqual([["mold", 2], ["freq mold (12,5%)", 1]]);
});

describe("rejection facets", () => {
  const rows = [
    { a: "1", n: "Avocado", d: "2026-10-05T10:00", tu: 10, reason: "mold", user: "Damian Mrowka", group: "DC5-everest", outcome: "Picked up", sortable: true, cat: "Quality (according to list)" },
    { a: "2", n: "Oranges", d: "2026-10-06T11:00", tu: 20, reason: "decay", user: "Damian Mrowka", outcome: "Destroy", sortable: false },
    { a: "1", n: "Avocado", d: "2026-10-13T10:00", reason: "Freq mold", user: "Snizhana" },
  ];
  it("ANDs the selected facets", () => {
    expect(filterRejectionsByFacets(rows, { product: "1" }).length).toBe(2);
    expect(filterRejectionsByFacets(rows, { product: "1", user: "damian mrowka" }).length).toBe(1);
    expect(filterRejectionsByFacets(rows, { reason: "mold" }).length).toBe(2);
    expect(filterRejectionsByFacets(rows, { sortable: "unknown" }).map(r => r.d)).toEqual(["2026-10-13T10:00"]);
    expect(filterRejectionsByFacets(rows, { outcome: "destroy", group: "not given" }).length).toBe(1);
    expect(filterRejectionsByFacets(rows, {})).toBe(rows);
    expect(matchesRejectionFacets(rows[0], null)).toBe(true);
  });
  it("summarises suppliers, outcomes, sortable and days", () => {
    const s = summarizeRejections(rows);
    expect(s.groups[0]).toMatchObject({ label: "Not given", count: 2 });
    expect(s.outcomes.map(o => o.label).sort()).toEqual(["Destroy", "Not filled in", "Picked up"]);
    expect(s.sortables.find(x => x.key === "yes").sub[0].label).toBe("Quality (according to list)");
    expect(s.days.map(d => d.key)).toEqual(["2026-10-05", "2026-10-06", "2026-10-13"]);
  });
  it("buckets the timeline by week or by day with empty days filled in", () => {
    const s = summarizeRejections(rows);
    const weeks = rejectionTimeline(s.days, { byWeek: true, isoWeekOf: d => d < "2026-10-12" ? "2026-W41" : "2026-W42", weekLabel: w => w });
    expect(weeks.map(w => [w.key, w.count])).toEqual([["2026-W41", 2], ["2026-W42", 1]]);
    const days = rejectionTimeline(s.days, { fromDay: "2026-10-05", toDay: "2026-10-07" });
    expect(days.map(d => [d.label, d.count])).toEqual([["05.10", 1], ["06.10", 1], ["07.10", 0]]);
  });
});
