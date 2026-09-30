import { describe, expect, it } from "vitest";
import { fitWithin, imageFormat, jpegDataUrlFrameFirst, jpegFrameFirst, keepsOriginalFile, knockOutDarkBorder, mapPool, memoPdfPhoto, pdfPhotoMaxEdge, photoSrcCandidates } from "./report-images.js";

// What jsPDF 2.5.1 does with a JPEG header (its marker list includes C4).
const jsPdfJpegInfo = bytes => {
  const at = k => bytes[k];
  const markers = [192, 193, 194, 195, 196, 197, 198, 199];
  let blockLength = 256 * at(4) + at(5);
  for (let i = 4; i < bytes.length; i += 2) {
    i += blockLength;
    if (markers.includes(at(i + 1))) return { width: 256 * at(i + 7) + at(i + 8), height: 256 * at(i + 5) + at(i + 6), numcomponents: at(i + 9) };
    blockLength = 256 * at(i + 2) + at(i + 3);
  }
  return null;
};
const seg = (m, payload) => [0xFF, m, (payload.length + 2) >> 8, (payload.length + 2) & 255, ...payload];
const sof0 = (w, h) => seg(0xC0, [8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const dqt = seg(0xDB, [0, ...Array(64).fill(8)]);
const dht = seg(0xC4, [0, 1, 0, 2, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3]);
const sos = [0xFF, 0xDA, 0, 12, 3, 1, 0, 2, 0x11, 3, 0x11, 0, 63, 0, 0xAB, 0xCD, 0xFF, 0xD9];

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

describe("jpegFrameFirst", () => {
  it("moves Huffman tables behind the frame header so jsPDF reads the real size", () => {
    const tablesFirst = new Uint8Array([0xFF, 0xD8, ...dqt, ...dht, ...sof0(4032, 3024), ...sos]);
    expect(jsPdfJpegInfo(tablesFirst)).toEqual({ width: 515, height: 256, numcomponents: 1 });
    const fixed = jpegFrameFirst(tablesFirst);
    expect(fixed).not.toBe(tablesFirst);
    expect(fixed.length).toBe(tablesFirst.length);
    expect(jsPdfJpegInfo(fixed)).toEqual({ width: 4032, height: 3024, numcomponents: 3 });
    expect(Array.from(fixed.subarray(fixed.length - sos.length))).toEqual(sos);
  });
  it("leaves a camera JPEG (frame header before tables) untouched", () => {
    const frameFirst = new Uint8Array([0xFF, 0xD8, ...dqt, ...sof0(4032, 3024), ...dht, ...sos]);
    expect(jpegFrameFirst(frameFirst)).toBe(frameFirst);
    expect(jsPdfJpegInfo(frameFirst)).toEqual({ width: 4032, height: 3024, numcomponents: 3 });
  });
  it("rewrites only jpeg data URLs", () => {
    const tablesFirst = new Uint8Array([0xFF, 0xD8, ...dqt, ...dht, ...sof0(640, 480), ...sos]);
    const url = "data:image/jpeg;base64," + Buffer.from(tablesFirst).toString("base64");
    const out = jpegDataUrlFrameFirst(url);
    expect(out).not.toBe(url);
    const bytes = new Uint8Array(Buffer.from(out.split(",")[1], "base64"));
    expect(jsPdfJpegInfo(bytes)).toEqual({ width: 640, height: 480, numcomponents: 3 });
    expect(jpegDataUrlFrameFirst("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
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

describe("pdfPhotoMaxEdge", () => {
  it("caps a 56 mm report tile at about 180 dpi, not the phone's 12 MP", () => {
    expect(pdfPhotoMaxEdge(56, 180)).toBe(Math.round(56 / 25.4 * 180));
    expect(pdfPhotoMaxEdge(56, 180)).toBeLessThan(500);
    expect(pdfPhotoMaxEdge(56, 180)).toBeGreaterThan(300);
  });
});

describe("photoSrcCandidates", () => {
  it("prefers an in-memory data URL over a /photos path", () => {
    expect(photoSrcCandidates({ path: "/photos/dead.jpg", dataUrl: "data:image/jpeg;base64,xx" })).toEqual([
      "data:image/jpeg;base64,xx",
      "/photos/dead.jpg",
    ]);
  });
  it("accepts a bare /photos string left after the server rewrote a data URL", () => {
    expect(photoSrcCandidates("/photos/hash.jpg")).toEqual(["/photos/hash.jpg"]);
  });
});

describe("memoPdfPhoto", () => {
  it("loads a path once and reuses the same promise", async () => {
    let n = 0;
    const load = memoPdfPhoto(async src => { n++; return "ok:" + src; });
    const a = load({ path: "/photos/a.jpg" });
    const b = load({ path: "/photos/a.jpg" });
    expect(a).toBe(b);
    expect(await a).toBe("ok:/photos/a.jpg");
    expect(n).toBe(1);
  });
  it("falls through to dataUrl when the path does not load", async () => {
    const load = memoPdfPhoto(async src => src.startsWith("data:") ? src : null);
    expect(await load({ path: "/photos/missing.jpg", dataUrl: "data:image/jpeg;base64,xx" })).toBe("data:image/jpeg;base64,xx");
  });
});

describe("mapPool", () => {
  it("keeps order with a small worker pool", async () => {
    const out = await mapPool([1, 2, 3, 4], 2, async n => n * 10);
    expect(out).toEqual([10, 20, 30, 40]);
  });
});

describe("knockOutDarkBorder", () => {
  // 6×6: black background, a 4×4 logo in the middle with a white rim and a black letter inside it.
  const W = 6, H = 6;
  const paint = (rgba, x, y, [r, g, b]) => { const i = (y * W + x) * 4; rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255; };
  const make = () => {
    const rgba = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(rgba, x, y, [0, 0, 0]);
    for (let y = 1; y < 5; y++) for (let x = 1; x < 5; x++) paint(rgba, x, y, [255, 255, 255]);
    paint(rgba, 2, 2, [0, 150, 60]); paint(rgba, 3, 3, [10, 10, 10]);
    return rgba;
  };
  const alpha = (rgba, x, y) => rgba[(y * W + x) * 4 + 3];
  it("clears the black that touches the edge and keeps the logo, including black inside it", () => {
    const rgba = make();
    expect(knockOutDarkBorder(rgba, W, H)).toBe(20);
    expect(alpha(rgba, 0, 0)).toBe(0); expect(alpha(rgba, 5, 3)).toBe(0); expect(alpha(rgba, 2, 5)).toBe(0);
    expect(alpha(rgba, 1, 1)).toBe(255); expect(alpha(rgba, 2, 2)).toBe(255);
    expect(alpha(rgba, 3, 3)).toBe(255);
  });
  it("leaves a picture with a light background alone", () => {
    const rgba = make();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x === 0 || y === 0 || x === 5 || y === 5) paint(rgba, x, y, [250, 250, 250]);
    expect(knockOutDarkBorder(rgba, W, H)).toBe(0);
    expect(alpha(rgba, 3, 3)).toBe(255);
  });
  it("copes with garbage input", () => {
    expect(knockOutDarkBorder(null, 2, 2)).toBe(0);
    expect(knockOutDarkBorder(new Uint8ClampedArray(4), 2, 2)).toBe(0);
  });
});
