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

import { summarizeRejections } from "./rejections.js";
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
