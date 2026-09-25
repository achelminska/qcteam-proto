import { describe, expect, it } from "vitest";
import { countsAs, dayLabel, hasV, legacyTypeId, problemPath, specLabel } from "./format.js";

describe("specLabel", () => {
  it("renders a range, a one-sided limit, or an em dash", () => {
    expect(specLabel({ min: 1, max: 4, unit: "%" })).toBe("1–4 %");
    expect(specLabel({ min: 2, max: "", unit: "mm" })).toBe("min 2 mm");
    expect(specLabel({ min: null, max: 8, unit: "" })).toBe("max 8");
    expect(specLabel({ min: "", max: undefined })).toBe("—");
  });
  it("treats empty string as missing", () => {
    expect(hasV("")).toBe(false);
    expect(hasV(0)).toBe(true);
  });
});

describe("dayLabel", () => {
  const now = new Date(2026, 8, 25, 15, 0, 0);
  it("names today and yesterday, and formats older days", () => {
    expect(dayLabel("2026-09-25T08:00:00", now)).toBe("Today");
    expect(dayLabel("2026-09-24T23:00:00", now)).toBe("Yesterday");
    expect(dayLabel("", now)).toBe("—");
    expect(dayLabel(null, now)).toBe("—");
    expect(dayLabel("2026-09-01T10:00:00", now)).toMatch(/1 Sept?/);
  });
});

describe("problemPath", () => {
  const problems = [
    { id: "a", parentId: null, name: "Quality" },
    { id: "b", parentId: "a", name: "Major" },
    { id: "c", parentId: "b", name: "Rot" },
  ];
  it("joins ancestors with a chevron and returns nothing for an unknown id", () => {
    expect(problemPath(problems, "c")).toBe("Quality › Major › Rot");
    expect(problemPath(problems, "a")).toBe("Quality");
    expect(problemPath(problems, "missing")).toBe("");
  });
});

describe("countsAs", () => {
  const s = { inspectionTypes: [{ id: "type-skip", sort: 2, countsAsInspection: false }, { id: "type-full", sort: 0, countsAsInspection: true }] };
  it("drops skip-style types and keeps a full inspection", () => {
    expect(legacyTypeId("Skip")).toBe("type-skip");
    expect(countsAs(s, { type: "Skip" })).toBe(false);
    expect(countsAs(s, { typeId: "type-full" })).toBe(true);
    expect(countsAs({ inspectionTypes: [] }, { type: "Full" })).toBe(true);
  });
});
