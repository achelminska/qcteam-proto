import { describe, it, expect } from "vitest";
import { mergeDockLines, mergedLineCount } from "./dock-merge.js";

const line = (o = {}) => ({ hu: "384370050043892022", article: "90006060", name: "Merkloos Blauwe bessen 300 gram", quantity: 10, location: "D-08A", priority: "High risk", po: "12858501286618", arrived: "2026-10-10", arrivedTime: "07:41", blocking: "Yes", skippable: "No", ...o });

describe("one pallet split over several sheet lines", () => {
  it("adds the TU up instead of keeping the first line", () => {
    const [p] = mergeDockLines([line({ quantity: 10 }), line({ quantity: 60 })]);
    expect(p.quantity).toBe(70); expect(p.sheetLines).toBe(2); expect(p.lineQuantities).toEqual([10, 60]);
  });
  it("reads quantities written as text", () => {
    expect(mergeDockLines([line({ quantity: "10" }), line({ quantity: "60 TU" })])[0].quantity).toBe(70);
  });
  it("keeps every PO and flags a mixed pallet", () => {
    const [p] = mergeDockLines([line({ po: "1285850" }), line({ po: "1286618" })]);
    expect(p.pos).toEqual(["1285850", "1286618"]); expect(p.po).toBe("1285850");
  });
  it("takes the earliest arrival and the most urgent priority", () => {
    const [p] = mergeDockLines([line({ arrivedTime: "07:41", priority: "Inspection due" }), line({ arrivedTime: "07:40", priority: "Now needed" })]);
    expect(p.arrivedTime).toBe("07:40"); expect(p.priority).toBe("Now needed");
  });
  it("needed today if any line says so; skippable only if all do", () => {
    const [p] = mergeDockLines([line({ blocking: "No", skippable: "Yes" }), line({ blocking: "Yes", skippable: "No" })]);
    expect(p.blocking).toBe(true); expect(p.skippable).toBe(false);
  });
  it("matches HUs with and without leading zeros", () => {
    expect(mergeDockLines([line({ hu: "0087193280034476549" }), line({ hu: "87193280034476549" })])).toHaveLength(1);
  });
  it("leaves different pallets and HU-less lines alone", () => {
    const rows = [line({ hu: "1" }), line({ hu: "2" }), line({ hu: "" }), line({ hu: "", location: "D-02" })];
    expect(mergeDockLines(rows)).toHaveLength(4); expect(mergedLineCount(rows)).toBe(0);
  });
  it("counts the folded lines", () => { expect(mergedLineCount([line(), line(), line({ hu: "9" })])).toBe(1); });
});
