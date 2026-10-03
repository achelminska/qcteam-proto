import { describe, expect, it } from "vitest";
import {
  briefingAnnouncements,
  briefingComplaints,
  briefingDefaultTab,
  briefingRemark,
  briefingRejections,
  briefingTabDeck,
  briefingUnseen,
  liveBriefingFps,
} from "./briefing-cards.js";

const today = new Date().toISOString().slice(0, 10);
const s = {
  inspectionTypes: [{ id: "type-full", name: "Full", autoAccept: false, countsAsInspection: true }],
  problems: [{ id: "rot", name: "Rot", parentId: "qual" }, { id: "qual", name: "Quality" }],
  announcements: [
    { id: "a1", title: "Live", showOnDashboard: true, createdAt: "2026-10-01T10:00:00.000Z" },
    { id: "a2", title: "Old", showOnDashboard: true, validTo: "2020-01-01", createdAt: "2020-01-01T10:00:00.000Z" },
    { id: "a3", title: "Block", isBlocking: true, createdAt: "2026-10-01T11:00:00.000Z" },
  ],
  inspections: [
    { id: "r1", status: "Completed", typeId: "type-full", result: "Rejected", completedAt: "2026-10-01T12:00:00.000Z" },
    { id: "a-ok", status: "Completed", typeId: "type-full", result: "Accepted", completedAt: "2026-10-01T12:00:00.000Z" },
    { id: "draft", status: "Draft", typeId: "type-full", result: "Rejected" },
  ],
  complaints: { rows: [{ id: "c1", name: "Nectarine", count: 4, updatedAt: "t" }, { id: "c0", name: "Quiet", count: 0 }] },
  briefingSeen: [{ id: "u-anna:ann:a1", userId: "u-anna", fp: "ann:a1", at: "t" }],
};

describe("briefing decks", () => {
  it("keeps live notes, blocking notes and drops expired dashboard notes", () => {
    expect(briefingAnnouncements(s).map(a => a.id)).toEqual(["a3", "a1"]);
    expect(today).toBeTruthy();
  });

  it("lists verdict rejections only", () => {
    expect(briefingRejections(s).map(i => i.id)).toEqual(["r1"]);
  });

  it("lists complaint rows with a count", () => {
    expect(briefingComplaints(s).map(c => c.id)).toEqual(["c1"]);
  });

  it("splits unseen cards per user", () => {
    const anna = briefingUnseen(s, "u-anna");
    expect(anna.anns.map(a => a.id)).toEqual(["a3"]);
    expect(anna.rejs.map(i => i.id)).toEqual(["r1"]);
    expect(anna.complaints.map(c => c.id)).toEqual(["c1"]);
    expect(anna.total).toBe(3);
    expect(briefingDefaultTab(s, "u-anna")).toBe("notes");
    expect(briefingTabDeck(s, "rejections", "u-anna")).toEqual([{ kind: "rej", i: s.inspections[0] }]);
    expect(liveBriefingFps(s)).toEqual(["ann:a3", "ann:a1", "rej:r1", "comp:c1:4:t"]);
  });

  it("formats a remark the same way the shift-update card does", () => {
    expect(briefingRemark(s, { leafId: "rot", mode: "Presence" })).toBe("Rot");
    expect(briefingRemark(s, { leafId: "rot", mode: "PieceCount", raw: 3 })).toBe("Rot · 3 pcs");
  });
});

describe("rejections from the DC5 sheet in the deck", () => {
  const now = new Date(); const iso = d => new Date(now.getTime() - d * 86400000).toISOString().slice(0, 16);
  const s2 = { ...s, inspections: [{ id: "r1", status: "Completed", typeId: "type-full", result: "Rejected", completedAt: iso(2) + ":00.000Z" }],
    extRejections: { latest: [{ a: "90006116", n: "Andijvie", d: iso(1), po: "p1", tu: 15, reason: "cold damage" }, { a: "11295128", n: "Paprika", d: iso(1.5), po: "p2", tu: 2 }, { a: "x", n: "old", d: iso(20), po: "p3" }], byArticle: {} } };
  it("rows from the last 48 h become cards, merged with QCteam's own rejections newest first, with their own fingerprints", () => {
    const u = briefingUnseen(s2, "u-anna");
    expect(u.xrejs.map(x => x.po)).toEqual(["p1", "p2"]); expect(u.total).toBe(2 + 1 + 1 + 1);
    expect(briefingTabDeck(s2, "rejections", "u-anna").map(c => c.kind + ":" + (c.i?.id || c.x.po))).toEqual(["xrej:p1", "xrej:p2", "rej:r1"]);
    expect(liveBriefingFps(s2)).toContain(`xrej:90006116:${iso(1)}:p1`);
    const seen = { ...s2, briefingSeen: [{ id: "u-anna:x", userId: "u-anna", fp: `xrej:90006116:${iso(1)}:p1`, at: "t" }] };
    expect(briefingUnseen(seen, "u-anna").xrejs.map(x => x.po)).toEqual(["p2"]);
  });
  it("sheet rejections alone open the rejections tab", () => {
    expect(briefingDefaultTab({ ...s2, announcements: [], inspections: [], complaints: { rows: [] } }, "u-anna")).toBe("rejections");
  });
});
