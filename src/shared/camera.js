export function stopStream(stream) {
  try { stream?.getTracks?.().forEach(t => t.stop()); } catch { /* already stopped */ }
}

export function grabFrame(video, quality = 0.92) {
  if (!video || typeof document === "undefined") return null;
  const w = video.videoWidth || 0, h = video.videoHeight || 0;
  if (!(w > 0) || !(h > 0)) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(video, 0, 0, w, h);
  return c.toDataURL("image/jpeg", quality);
}

export function torchCapable(stream) {
  try { return !!stream?.getVideoTracks?.()[0]?.getCapabilities?.()?.torch; } catch { return false; }
}

export async function setTorch(stream, on) {
  const track = stream?.getVideoTracks?.()[0];
  if (!track) return false;
  try { await track.applyConstraints({ advanced: [{ torch: !!on }] }); return true; } catch { return false; }
}
