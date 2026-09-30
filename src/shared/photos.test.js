import { describe, it, expect } from "vitest";
import { asPhotoList, pickedPhotos, attachRemarkPhotos } from "./photos.js";

const shot = (id) => ({ id, path: `/photos/${id}.jpg` });

describe("pickedPhotos", () => {
  it("unwraps the { out, failed } shape pickPhotos actually returns", () => {
    const out = [shot("a")];
    expect(pickedPhotos({ out, failed: ["x.jpg"] })).toEqual(out);
  });
  it("still accepts a bare array (PhotoStrip onAdd passes out directly)", () => {
    const out = [shot("a")];
    expect(pickedPhotos(out)).toEqual(out);
    expect(attachRemarkPhotos([{ id: "r1", photos: [] }], "r1", out)[0].photos).toEqual(out);
  });
  it("does not treat the result object itself as a photo list", () => {
    // The bug: `{ out, failed }.length` is undefined, so remarks never saved.
    const got = { out: [shot("a")], failed: [] };
    expect(got.length).toBeUndefined();
    expect(asPhotoList(got)).toEqual([]);
    expect(pickedPhotos(got)).toHaveLength(1);
  });
});

describe("attachRemarkPhotos", () => {
  const remarks = [
    { id: "r1", leafId: "p1", photos: [] },
    { id: "r2", leafId: "p2", photos: [shot("old")] },
  ];

  it("appends photos from the pickPhotos result onto that remark", () => {
    const next = attachRemarkPhotos(remarks, "r1", { out: [shot("new")], failed: [] });
    expect(next[0].photos).toEqual([shot("new")]);
    expect(next[1].photos).toEqual([shot("old")]);
  });
  it("keeps photos already on the remark", () => {
    const next = attachRemarkPhotos(remarks, "r2", { out: [shot("new")], failed: [] });
    expect(next[1].photos.map(p => p.id)).toEqual(["old", "new"]);
  });
  it("does nothing when the picker result is empty or the id is missing", () => {
    expect(attachRemarkPhotos(remarks, "r1", { out: [], failed: ["x"] })).toEqual(remarks);
    expect(attachRemarkPhotos(remarks, null, { out: [shot("a")], failed: [] })).toEqual(remarks);
  });
});
