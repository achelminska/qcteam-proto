import { afterEach, describe, expect, it, vi } from "vitest";
import { grabFrame, primeScanCamera, resetScanCameraHold, SCAN_VIDEO, stopStream, takeScanCamera, torchCapable } from "./camera.js";

afterEach(() => {
  resetScanCameraHold();
  vi.unstubAllGlobals();
});

function fakeStream() {
  const tracks = [{ stop: vi.fn() }];
  return { getTracks: () => tracks, tracks };
}

function stubCamera(gum) {
  vi.stubGlobal("window", { isSecureContext: true });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
}

describe("grabFrame", () => {
  it("returns null when the video has no pixels yet", () => {
    expect(grabFrame(null)).toBe(null);
    expect(grabFrame({ videoWidth: 0, videoHeight: 1080 })).toBe(null);
  });
});

describe("torchCapable", () => {
  it("is false when the stream has no torch capability", () => {
    expect(torchCapable(null)).toBe(false);
    expect(torchCapable({ getVideoTracks: () => [{ getCapabilities: () => ({}) }] })).toBe(false);
    expect(torchCapable({ getVideoTracks: () => [{ getCapabilities: () => ({ torch: true }) }] })).toBe(true);
  });
});

describe("stopStream", () => {
  it("stops every track and ignores a missing stream", () => {
    const stopped = [];
    stopStream({ getTracks: () => [{ stop: () => stopped.push(1) }, { stop: () => stopped.push(2) }] });
    expect(stopped).toEqual([1, 2]);
    stopStream(null);
  });
});

describe("primeScanCamera", () => {
  it("opens getUserMedia once so takeScanCamera can reuse the same stream", async () => {
    const stream = fakeStream();
    const gum = vi.fn(() => Promise.resolve(stream));
    stubCamera(gum);
    primeScanCamera();
    primeScanCamera();
    expect(gum).toHaveBeenCalledTimes(1);
    expect(gum).toHaveBeenCalledWith(SCAN_VIDEO);
    expect(await takeScanCamera()).toBe(stream);
    expect(gum).toHaveBeenCalledTimes(1);
    await takeScanCamera();
    expect(gum).toHaveBeenCalledTimes(2);
  });

  it("hands a still-pending getUserMedia to the scanner", async () => {
    let resolve;
    const gum = vi.fn(() => new Promise(r => { resolve = r; }));
    stubCamera(gum);
    primeScanCamera();
    const pending = takeScanCamera();
    const stream = fakeStream();
    resolve(stream);
    expect(await pending).toBe(stream);
    expect(gum).toHaveBeenCalledTimes(1);
  });
});
