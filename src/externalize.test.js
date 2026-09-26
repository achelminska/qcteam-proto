import { describe, expect, it } from "vitest";
import { photoFileName } from "../server/blobs.mjs";
import { externalizeState } from "./externalize.js";

describe("externalizeState", () => {
  it("uses the same photo file name as the server", async () => {
    const bytes = Buffer.from("x".repeat(180));
    const dataUrl = "data:image/jpeg;base64," + bytes.toString("base64");
    const state = { categories: [], products: [{ id: "p", photos: [{ id: "ph", dataUrl }] }] };
    const slim = await externalizeState(state);
    expect(slim).not.toBe(state);
    expect(slim.products[0].photos[0].dataUrl).toBe("/photos/" + photoFileName(bytes, "image/jpeg"));
    expect(state.products[0].photos[0].dataUrl).toBe(dataUrl);
  });

  it("returns the same object when there is nothing to move", async () => {
    const state = { categories: [], inspections: [{ id: "a" }] };
    expect(await externalizeState(state)).toBe(state);
  });
});
