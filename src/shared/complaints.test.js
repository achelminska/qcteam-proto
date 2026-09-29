import { describe, it, expect } from "vitest";
import { isoWeekOf, weekRange, shiftWeek, weekLabel, weekFromLabel, upsertSnapshot, latestSnapshot, previousInWeek, deltaRows, weekSeries, articleTrend, topArticles, subTypeMix, asLegacyMeta, migrateLegacy, snapshotTotal } from "./complaints.js";

// Jasper's posts, week 39 → 40 (Sept 2026), as pasted from the screenshots.
const w39a = { id: "a", week: "2026-W39", asOf: "2026-09-22", importedAt: "2026-09-22T10:20:00Z", byUserId: "u-head", rows: [
  { articleId: "10573488", name: "Merkloos komkommer (1 st)", count: 25, subType: "Spoiled", subCount: 23 },
  { articleId: "11295128", name: "Merkloos paprika mix (3 st)", count: 20, subType: "Spoiled", subCount: 21 },
  { articleId: "11539732", name: "Merkloos kiwibessen (125 gram)", count: 19, subType: "Overripe", subCount: 17 } ] };
const w39b = { id: "b", week: "2026-W39", asOf: "2026-09-24", importedAt: "2026-09-24T11:30:00Z", byUserId: "u-head", rows: [
  { articleId: "10573488", name: "Merkloos komkommer (1 st)", count: 39, subType: "Spoiled", subCount: 36 },
  { articleId: "11539732", name: "Merkloos kiwibessen (125 gram)", count: 36, subType: "Overripe", subCount: 35 },
  { articleId: "11295128", name: "Merkloos paprika mix (3 st)", count: 34, subType: "Spoiled", subCount: 35 } ] };
const w39c = { id: "c", week: "2026-W39", asOf: "2026-09-25", importedAt: "2026-09-25T14:12:00Z", byUserId: "u-head", rows: [
  { articleId: "11295128", name: "Merkloos paprika mix (3 st)", count: 56, subType: "Spoiled", subCount: 56 },
  { articleId: "10573488", name: "Merkloos komkommer (1 st)", count: 55, subType: "Spoiled", subCount: 52 },
  { articleId: "90006049", name: "Merkloos mango eetrijp (1 st)", count: 50, subType: "Underripe", subCount: 19 } ] };
const w40 = { id: "d", week: "2026-W40", asOf: "2026-09-29", importedAt: "2026-09-29T11:14:00Z", byUserId: "u-head", rows: [
  { articleId: "10468928", name: "Merkloos rode paprika (1 st)", count: 22, subType: "Spoiled", subCount: 22 },
  { articleId: "10573488", name: "Merkloos komkommer (1 st)", count: 17, subType: "Spoiled", subCount: 15 } ] };
const ALL = [w40, w39c, w39a, w39b]; // deliberately out of order

describe("ISO weeks", () => {
  it("29 Sept 2026 is week 40; the week runs Mon 28 Sep – Sun 4 Oct", () => {
    expect(isoWeekOf("2026-09-29")).toBe("2026-W40");
    expect(isoWeekOf("2026-09-22")).toBe("2026-W39");
    expect(weekRange("2026-W40")).toEqual({ from: "2026-09-28", to: "2026-10-04" });
    expect(isoWeekOf("2026-09-28")).toBe("2026-W40"); expect(isoWeekOf("2026-09-27")).toBe("2026-W39");
  });
  it("year boundaries follow ISO 8601", () => {
    expect(isoWeekOf("2027-01-01")).toBe("2026-W53"); // 2026 has 53 weeks
    expect(isoWeekOf("2025-12-29")).toBe("2026-W01");
    expect(shiftWeek("2026-W01", -1)).toBe("2025-W52");
    expect(shiftWeek("2026-W40", 1)).toBe("2026-W41");
  });
  it("labels and the label → week guess", () => {
    expect(weekLabel("2026-W40")).toBe("Week 40");
    expect(weekFromLabel("Week 38 · 15–21 Sept", 2026)).toBe("2026-W38");
    expect(weekFromLabel("Absolute complaints week 40", 2026)).toBe("2026-W40");
    expect(weekFromLabel("September", 2026)).toBe("");
  });
});

describe("snapshots", () => {
  it("latest is by 'as of' day, whatever the array order", () => { expect(latestSnapshot(ALL).id).toBe("d"); });
  it("re-pasting the same week + day replaces; a new day appends", () => {
    const fixed = { ...w39c, id: "c2", rows: [{ articleId: "11295128", name: "paprika", count: 57 }] };
    const out = upsertSnapshot(ALL, fixed);
    expect(out.map(x => x.id)).toEqual(["a", "b", "c2", "d"]);
    expect(upsertSnapshot(ALL, { ...w39c, id: "e", asOf: "2026-09-26" }).length).toBe(5);
  });
  it("the previous post in the week and the per-article delta", () => {
    expect(previousInWeek(ALL, w39c).id).toBe("b");
    expect(previousInWeek(ALL, w39a)).toBe(null);
    expect(previousInWeek(ALL, w40)).toBe(null);
    const d = Object.fromEntries(deltaRows(w39b, w39c).map(r => [r.articleId, r.delta]));
    expect(d["10573488"]).toBe(16); expect(d["11295128"]).toBe(22); expect(d["90006049"]).toBe(null); // mango was not on the earlier list
  });
  it("sub-type mix sums the sub-counts", () => { expect(subTypeMix(w39c)).toEqual([{ subType: "Spoiled", count: 108 }, { subType: "Underripe", count: 19 }]); });
});

describe("week series for analytics", () => {
  const series = weekSeries(ALL);
  it("one line per week, figures from the latest post, post count and days kept", () => {
    expect(series.map(w => w.week)).toEqual(["2026-W39", "2026-W40"]);
    expect(series[0].posts).toBe(3); expect(series[0].days).toEqual(["2026-09-22", "2026-09-24", "2026-09-25"]);
    expect(series[0].total).toBe(161); expect(series[0].top.articleId).toBe("11295128");
    expect(series[1].total).toBe(39); expect(series[1].range.from).toBe("2026-09-28");
  });
  it("an article's trend is null where it was not listed — never zero", () => {
    expect(articleTrend(series, "10573488").map(x => x.count)).toEqual([55, 17]);
    expect(articleTrend(series, "90006049").map(x => x.count)).toEqual([50, null]);
    expect(articleTrend(series, "HE10573488-36").map(x => x.count)).toEqual([55, 17]); // dock-sheet spelling matches too
  });
  it("top articles: most weeks on the list first", () => {
    expect(topArticles(series, 2).map(a => a.articleId)).toEqual(["10573488", "11295128"]);
  });
});

describe("what the rest of the app reads", () => {
  it("legacy shape from the latest post, with a readable period", () => {
    const m = asLegacyMeta(latestSnapshot(ALL), ALL);
    expect(m.period).toBe("Week 40 · as of 29 Sept");
    expect(m.rows).toBe(w40.rows); expect(m.updatedAt).toBe(w40.importedAt); expect(m.snapshotId).toBe("d");
    expect(asLegacyMeta(w39c, ALL).period).toBe("Week 39 · as of 25 Sept (3 posts)");
    expect(asLegacyMeta(null).rows).toEqual([]);
  });
  it("the old single list migrates into one snapshot, week read from its label", () => {
    const legacy = { period: "Week 39 · 22–28 Sept", updatedAt: "2026-09-25T14:12:00Z", byUserId: "u-head", rows: w39c.rows };
    const out = migrateLegacy(legacy, () => "m1");
    expect(out).toHaveLength(1); expect(out[0]).toMatchObject({ id: "m1", week: "2026-W39", asOf: "2026-09-25", byUserId: "u-head" });
    expect(snapshotTotal(out[0])).toBe(161);
    expect(migrateLegacy({ period: "", updatedAt: "2026-09-25T14:12:00Z", rows: w39c.rows }, () => "m2")[0].week).toBe("2026-W39"); // no label → from the date
    expect(migrateLegacy(null, () => "x")).toEqual([]); expect(migrateLegacy({ rows: [] }, () => "x")).toEqual([]);
  });
});
