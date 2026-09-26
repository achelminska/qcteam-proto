import { describe, expect, it } from "vitest";
import { retainInspections } from "./retain.mjs";

const cur = JSON.stringify({ categories: [], inspections: [
  { id: "old", status: "Completed", result: "Accepted" },
  { id: "skip1", status: "Completed", result: "Accepted", skipReason: "no time" },
] });

describe("retainInspections", () => {
  it("puts back an inspection the incoming write dropped", () => {
    const incoming = JSON.stringify({ categories: [], inspections: [{ id: "old", status: "Completed", result: "Accepted" }] });
    const out = JSON.parse(retainInspections(cur, incoming));
    expect(out.inspections.map(i => i.id).sort()).toEqual(["old", "skip1"]);
  });

  it("leaves a write alone when it already has every inspection", () => {
    const incoming = JSON.stringify({ categories: [], inspections: [
      { id: "old", status: "Completed", result: "Accepted" },
      { id: "skip1", status: "Completed", result: "Accepted", skipReason: "no time" },
    ] });
    expect(retainInspections(cur, incoming)).toBe(incoming);
  });

  it("returns the incoming body unchanged when it is not state JSON", () => {
    expect(retainInspections(cur, "not json")).toBe("not json");
  });
});
