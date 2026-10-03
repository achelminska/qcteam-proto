import { describe, expect, it } from "vitest";
import { blockedDockLocation, dockMapGroupKey, dockMapOpen, dockMapRows, isBlockedMapRow, isBlockedOnlyMapRow, openBlockedForMap, QUEUE_STATUS } from "./dock-map.js";

const dock = (over = {}) => ({
  hu: "387175210024374956",
  article: "90006048",
  name: "Picnic Jonagold",
  location: "D-07A",
  priority: "Inspection due",
  blocking: false,
  ...over,
});

const blocked = (over = {}) => ({
  article: "10074782",
  name: "Basilicum",
  hu: "111222333",
  location: "D-03B",
  pickLocation: "",
  status: "Not started",
  date: "2026-10-03",
  time: "08:15",
  key: "hu:111222333",
  lost: null,
  ...over,
});

describe("blockedDockLocation", () => {
  it("keeps a real dock code", () => {
    expect(blockedDockLocation({ location: "D-07A" })).toBe("D-07A");
    expect(blockedDockLocation({ location: "D07" })).toBe("D07");
  });

  it("normalises a bare dock number so parseDock can place it", () => {
    expect(blockedDockLocation({ location: "07A" })).toBe("D-07A");
    expect(blockedDockLocation({ location: "3" })).toBe("D-03");
  });

  it("falls back to pickLocation when location is not a dock", () => {
    expect(blockedDockLocation({ location: "", pickLocation: "D-02A" })).toBe("D-02A");
    expect(blockedDockLocation({ location: "BUFFER", pickLocation: "14" })).toBe("D-14");
  });

  it("returns the raw location when nothing looks like a dock", () => {
    expect(blockedDockLocation({ location: "BUFFER-A" })).toBe("BUFFER-A");
    expect(blockedDockLocation({})).toBe("");
  });
});

describe("openBlockedForMap", () => {
  it("drops completed and lost queue rows", () => {
    const rows = [
      blocked({ status: "Not started" }),
      blocked({ hu: "2", key: "hu:2", status: "Completed" }),
      blocked({ hu: "3", key: "hu:3", status: "Started", lost: { at: "x" } }),
    ];
    expect(openBlockedForMap(rows).map(r => r.hu)).toEqual(["111222333"]);
  });
});

describe("dockMapRows", () => {
  it("copies dock rows and leaves them as dock when the queue is empty", () => {
    const [row] = dockMapRows([dock()], []);
    expect(row.kind).toBe("dock");
    expect(isBlockedMapRow(row)).toBe(false);
  });

  it("marks a dock row that is also on the blocked sheet, without duplicating it", () => {
    const hu = "387175210024374956";
    const rows = dockMapRows([dock({ hu })], [blocked({ hu, key: `hu:${hu}`, location: "D-07A" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("blocked");
    expect(rows[0].blockedQueue).toBe(true);
    expect(rows[0].blockedOnly).toBeUndefined();
    expect(rows[0].mapKey).toBe(`hu:${hu}`);
    expect(isBlockedMapRow(rows[0])).toBe(true);
    expect(isBlockedOnlyMapRow(rows[0])).toBe(false);
  });

  it("matches HUs that differ only by leading zeros / AI prefix", () => {
    const rows = dockMapRows(
      [dock({ hu: "00387175210024374956" })],
      [blocked({ hu: "387175210024374956", key: "hu:387175210024374956" })],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].blockedQueue).toBe(true);
  });

  it("appends a blocked-only pallet on its dock", () => {
    const rows = dockMapRows([dock()], [blocked({ location: "D-03B" })]);
    expect(rows).toHaveLength(2);
    const extra = rows[1];
    expect(extra.blockedOnly).toBe(true);
    expect(extra.location).toBe("D-03B");
    expect(extra.arrived).toBe("2026-10-03");
    expect(extra.arrivedTime).toBe("08:15");
    expect(extra.mapKey).toBe("hu:111222333");
  });

  it("still draws the map when only the blocked sheet has data", () => {
    const rows = dockMapRows([], [blocked({ location: "07A" })]);
    expect(rows).toHaveLength(1);
    expect(rows[0].location).toBe("D-07A");
    expect(rows[0].blockedOnly).toBe(true);
  });

  it("keeps an unparseable location so it lands in Other locations", () => {
    const rows = dockMapRows([], [blocked({ location: "BUFFER-A", hu: "", key: "10074782|BUFFER-A" })]);
    expect(rows[0].location).toBe("BUFFER-A");
    expect(rows[0].mapKey).toBe("10074782|BUFFER-A");
  });

  it("does not treat two different HUs as the same pallet", () => {
    expect(dockMapRows([dock({ hu: "111" })], [blocked({ hu: "222", key: "hu:222" })])).toHaveLength(2);
  });
});

describe("dockMapGroupKey / dockMapOpen", () => {
  it("keeps a blocked-only SKU out of the dock-row group for the same article", () => {
    const a = dock({ article: "90006048" });
    const b = { ...dock({ article: "90006048", hu: "" }), blockedOnly: true, mapKey: "90006048|D-07A" };
    expect(dockMapGroupKey(a)).toBe("90006048");
    expect(dockMapGroupKey(b)).toBe("blocked:90006048");
    expect(dockMapGroupKey(a)).not.toBe(dockMapGroupKey(b));
  });

  it("opens a blocked-only group on the claim key", () => {
    const g = [{ blockedOnly: true, mapKey: "hu:111", hu: "111", article: "A" }];
    expect(dockMapOpen(g)).toEqual({ key: "hu:111", blockedOnly: true });
  });

  it("opens a dock group on the earliest HU", () => {
    const g = [
      dock({ hu: "later", arrived: "2026-10-03", arrivedTime: "12:00" }),
      dock({ hu: "earlier", arrived: "2026-10-03", arrivedTime: "07:00" }),
    ];
    expect(dockMapOpen(g)).toEqual({ key: "earlier", blockedOnly: false });
  });
});

describe("QUEUE_STATUS", () => {
  it("is the map key for blocked-queue pallets, not Needed today", () => {
    expect(QUEUE_STATUS).toBe("queue");
  });
});
