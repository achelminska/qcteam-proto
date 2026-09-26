import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { slimStateJson, photoFileName } from "./blobs.mjs";

const dataUrl = (text) => "data:image/jpeg;base64," + Buffer.from(text).toString("base64");

describe("slimStateJson", () => {
  it("moves embedded images to files and leaves the inspection in place", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qc-photos-"));
    const url = dataUrl("x".repeat(180));
    const raw = JSON.stringify({
      categories: [],
      products: [{ id: "p", photos: [{ id: "ph", dataUrl: url }] }],
      inspections: [{ id: "cxfsfu1", status: "Completed", pallets: ["387154590006091086"], result: "Accepted" }],
    });
    const slim = slimStateJson(raw, dir);
    const state = JSON.parse(slim);
    expect(slim).not.toContain("data:image");
    expect(state.inspections[0].id).toBe("cxfsfu1");
    expect(state.inspections[0].pallets).toEqual(["387154590006091086"]);
    const photo = state.products[0].photos[0].dataUrl;
    expect(photo.startsWith("/photos/")).toBe(true);
    const name = photo.slice("/photos/".length);
    expect(fs.existsSync(path.join(dir, name))).toBe(true);
    expect(name).toBe(photoFileName(Buffer.from("x".repeat(180)), "image/jpeg"));
    // Same bytes reuse the file. A second slim of an already-path state is a no-op.
    expect(slimStateJson(slim, dir)).toBe(slim);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns the original string when there is no embedded image", () => {
    const raw = JSON.stringify({ categories: [], inspections: [{ id: "a" }] });
    expect(slimStateJson(raw, os.tmpdir())).toBe(raw);
  });
});
