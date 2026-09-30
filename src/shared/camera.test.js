import { describe, expect, it } from "vitest";
import { grabFrame, stopStream, torchCapable } from "./camera.js";

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
