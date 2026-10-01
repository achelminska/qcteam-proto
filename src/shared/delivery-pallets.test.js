import { describe, expect, it } from "vitest";
import { attachableSameDay, otherDeliveryDay, sameDeliveryRows } from "./delivery-pallets.js";

const rows = [
  { hu: "111", arrived: "2026-10-01", po: "A" },
  { hu: "222", arrived: "2026-10-01", po: "B" },
  { hu: "333", arrived: "2026-09-30", po: "A" },
];

describe("sameDeliveryRows", () => {
  it("keeps same-day pallets together even when the PO differs", () => {
    const list = sameDeliveryRows(rows, ["111"], "2026-10-01");
    expect(list.basis).toBe("sheet");
    expect(attachableSameDay(list).map(r => r.hu)).toEqual(["222"]);
    expect(attachableSameDay(list)[0].po).toBe("B");
    expect(otherDeliveryDay(list).map(r => r.hu)).toEqual(["333"]);
    expect(list.every(r => r.poMismatch == null)).toBe(true);
  });

  it("does not invent a delivery day until a pallet is on the report", () => {
    const list = sameDeliveryRows(rows, [], "2026-10-01");
    expect(list.basis).toBe("none");
    expect(list.every(r => r.sameDay === null)).toBe(true);
    expect(attachableSameDay(list)).toHaveLength(3);
  });

  it("assumes today when the sampled pallet is not on the sheet yet", () => {
    const list = sameDeliveryRows(rows, ["999"], "2026-10-01");
    expect(list.basis).toBe("today");
    expect(attachableSameDay(list).map(r => r.hu)).toEqual(["111", "222"]);
  });
});
