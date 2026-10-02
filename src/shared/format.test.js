import { describe, expect, it } from "vitest";
import { applySpecEdit, countsAs, dayLabel, foundDisplay, hasV, legacyTypeId, listCheck, matchFieldSpec, numberSpecCheck, problemPath, reportStatusFields, specFieldsFromForm, specFormKind, specLabel, statusBarRatio, toleranceDisplay } from "./format.js";

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

describe("spec edit", () => {
  it("reads the form kind from which limits are set", () => {
    expect(specFormKind({ min: 6, max: 20 })).toBe("range");
    expect(specFormKind({ min: 6, max: null })).toBe("min");
    expect(specFormKind({ min: "", max: 8 })).toBe("max");
  });

  it("builds fields from the form and keeps the spec id when saving", () => {
    expect(specFieldsFromForm({ kind: "range", min: "11.6", max: "14", unit: "%", basis: "cu" }, "  Brix ")).toEqual({
      name: "Brix", unit: "%", basis: "cu", min: "11.6", max: "14",
    });
    expect(specFieldsFromForm({ kind: "min", min: "", max: "9", unit: "g" }, "Weight")).toBe(null);
    const sheet = { id: "s1", name: "Weight", unit: "g", min: 89, max: 103, basis: "piece", origin: "sheet", sheetRaw: "89-103g", syncedAt: "t" };
    const next = applySpecEdit(sheet, specFieldsFromForm({ kind: "range", min: "90", max: "100", unit: "g", basis: "piece" }, "Weight"));
    expect(next.id).toBe("s1");
    expect(next.min).toBe("90");
    expect(next.origin).toBeUndefined();
    expect(next.sheetRaw).toBeUndefined();
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

describe("matchFieldSpec", () => {
  const specs = [
    { id: "sw", name: "Weight", min: "250", max: "", unit: "gram" },
    { id: "sb", name: "Brix", min: "7", max: "14", unit: "%" },
  ];
  it("finds a spec by id or by the field label", () => {
    expect(matchFieldSpec(specs, { specId: "sw", label: "CU weight" }).id).toBe("sw");
    expect(matchFieldSpec(specs, { label: "Brix" }).id).toBe("sb");
    expect(matchFieldSpec(specs, { specName: "Weight", label: "Net" }).id).toBe("sw");
    expect(matchFieldSpec(specs, { label: "Temperature" })).toBe(null);
  });
});

describe("numberSpecCheck", () => {
  it("judges the average against min / max the way the form does", () => {
    expect(numberSpecCheck({ min: "250", max: "", unit: "gram" }, [263, 268, 264])).toEqual({ expected: "min 250 gram", ok: true });
    expect(numberSpecCheck({ min: "7", max: "14", unit: "%" }, [10.1, 1, 9.6])).toEqual({ expected: "7–14 %", ok: false });
    expect(numberSpecCheck({ min: "7", max: "14", unit: "%" }, [10.1, 9.6])).toEqual({ expected: "7–14 %", ok: true });
    expect(numberSpecCheck({ min: "", max: "" }, [10])).toBe(null);
    expect(numberSpecCheck({ min: "250", unit: "g" }, [])).toBe(null);
  });
});

describe("foundDisplay", () => {
  it("prints 0% when nothing was found, not a dash", () => {
    expect(foundDisplay(0)).toBe("0%");
    expect(foundDisplay(0, { zeroTol: true, present: false })).toBe("0%");
    expect(foundDisplay(0, { zeroTol: true, present: true })).toBe("present");
    expect(foundDisplay(13.89)).toBe("13.89%");
  });
});

describe("toleranceDisplay", () => {
  it("uses the group's own tolerance, else each remark's", () => {
    expect(toleranceDisplay(0)).toBe("0%");
    expect(toleranceDisplay(10)).toBe("10%");
    expect(toleranceDisplay(null, [1])).toBe("1%");
    expect(toleranceDisplay(null, [1, 1, 10])).toBe("1% · 10%");
    expect(toleranceDisplay(null, [])).toBe("—");
  });
});

describe("reportStatusFields", () => {
  it("prints 0% found and each remark tolerance when the group has none", () => {
    expect(reportStatusFields({ name: "General problems", agg: 0, ownTol: 0, present: false, state: "clean" }))
      .toEqual({ name: "General problems", found: "0%", tolerance: "0%", state: "clean", ratio: null });
    expect(reportStatusFields({ name: "Quality problems", agg: 13.89, ownTol: null, present: false, state: "exceeded", remarkTols: [1] }))
      .toEqual({ name: "Quality problems", found: "13.89%", tolerance: "1%", state: "exceeded", ratio: 13.89 });
  });
});

describe("statusBarRatio", () => {
  it("uses the strictest remark tolerance when the group has none", () => {
    expect(statusBarRatio(13.89, null, [1, 10])).toBe(13.89);
    expect(statusBarRatio(5, 10, [1])).toBe(0.5);
  });
});

describe("listCheck", () => {
  it("flags a list answer that differs from the product property", () => {
    expect(listCheck({ value: "I" }, "I")).toEqual({ expected: "I", ok: true });
    expect(listCheck({ value: "I" }, "II")).toEqual({ expected: "I", ok: false });
    expect(listCheck("Extra", "Extra")).toEqual({ expected: "Extra", ok: true });
  });
  it("does nothing when there is no spec or no answer", () => {
    expect(listCheck({ value: "I" }, "")).toBe(null);
    expect(listCheck({ value: "—" }, "II")).toBe(null);
    expect(listCheck(null, "II")).toBe(null);
    expect(listCheck(undefined, "II")).toBe(null);
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
