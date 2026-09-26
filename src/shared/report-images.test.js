import { describe, expect, it } from "vitest";
import { fitWithin, imageFormat, keepsOriginalFile } from "./report-images.js";

describe("keepsOriginalFile", () => {
  it("keeps jpeg, png, webp and gif bytes", () => {
    expect(keepsOriginalFile({ type: "image/jpeg" })).toBe(true);
    expect(keepsOriginalFile({ type: "IMAGE/PNG", name: "a.heic" })).toBe(true);
    expect(keepsOriginalFile({ type: "image/webp" })).toBe(true);
    expect(keepsOriginalFile({ type: "image/gif" })).toBe(true);
    expect(keepsOriginalFile({ type: "", name: "photo.PNG" })).toBe(true);
  });
  it("does not treat HEIC as a file the report can embed unchanged", () => {
    expect(keepsOriginalFile({ type: "image/heic", name: "a.jpg" })).toBe(false);
    expect(keepsOriginalFile({ type: "image/heic" })).toBe(false);
    expect(keepsOriginalFile({ type: "", name: "IMG.HEIC" })).toBe(false);
  });
});

describe("imageFormat", () => {
  it("reads the data URL type", () => {
    expect(imageFormat("data:image/jpeg;base64,xx")).toBe("JPEG");
    expect(imageFormat("data:image/png;base64,xx")).toBe("PNG");
    expect(imageFormat("data:image/webp;base64,xx")).toBe("WEBP");
    expect(imageFormat("data:image/gif;base64,xx")).toBe("GIF");
    expect(imageFormat("")).toBe("JPEG");
  });
});

describe("fitWithin", () => {
  it("fits a landscape photo inside the box and keeps the aspect ratio", () => {
    const box = fitWithin({ w: 4032, h: 3024 }, 86, 86);
    expect(box.w).toBeCloseTo(86, 5);
    expect(box.h).toBeCloseTo(86 * 3024 / 4032, 5);
    expect(box.w / box.h).toBeCloseTo(4032 / 3024, 5);
  });
  it("fits a portrait photo without forcing a 4:3 frame", () => {
    const box = fitWithin({ w: 3024, h: 4032 }, 40, 30);
    expect(box.h).toBeCloseTo(30, 5);
    expect(box.w).toBeCloseTo(30 * 3024 / 4032, 5);
    expect(box.w).not.toBeCloseTo(40, 0);
  });
  it("fits a wide result icon beside the report text", () => {
    const box = fitWithin({ w: 800, h: 300 }, 22, 16);
    expect(box.w).toBeCloseTo(22, 5);
    expect(box.h).toBeCloseTo(22 * 300 / 800, 5);
  });
  it("returns null when the pixel size is unknown", () => {
    expect(fitWithin(null, 86, 86)).toBe(null);
    expect(fitWithin({ w: 0, h: 100 }, 86, 86)).toBe(null);
  });
});
