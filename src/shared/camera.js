export function stopStream(stream) {
  try { stream?.getTracks?.().forEach(t => t.stop()); } catch { /* already stopped */ }
}

// Rear camera for barcode scans. Kept here so the FAB tap can open getUserMedia
// in the same user-activation as the navigation — iOS otherwise shows "Tap to scan".
export const SCAN_VIDEO = {
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
  audio: false,
};

let scanCamHold = null; // { stream } | { promise }

function cameraApiOk() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return false;
  if (typeof window === "undefined") return false;
  try {
    if (window.isSecureContext) return true;
    if (typeof location !== "undefined" && location.hostname === "localhost") return true;
  } catch { /* ignore */ }
  return false;
}

export function resetScanCameraHold() {
  const hold = scanCamHold;
  scanCamHold = null;
  if (hold?.stream) stopStream(hold.stream);
  if (hold?.promise) hold.promise.then(stopStream).catch(() => {});
}

export function primeScanCamera() {
  if (scanCamHold || !cameraApiOk()) return;
  let promise;
  try { promise = navigator.mediaDevices.getUserMedia(SCAN_VIDEO); }
  catch { return; }
  scanCamHold = { promise };
  promise.then(
    stream => { if (scanCamHold?.promise === promise) scanCamHold = { stream }; },
    () => { if (scanCamHold?.promise === promise) scanCamHold = null; },
  );
}

export async function takeScanCamera() {
  const hold = scanCamHold;
  scanCamHold = null;
  if (hold?.stream) return hold.stream;
  if (hold?.promise) return hold.promise;
  if (!cameraApiOk()) throw new Error("This browser exposes no camera API.");
  return navigator.mediaDevices.getUserMedia(SCAN_VIDEO);
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
