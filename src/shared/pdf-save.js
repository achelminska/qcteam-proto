// Phones cannot save a client-made PDF the way a laptop can.
// iOS Safari ignores <a download> on blob: (and data:) URLs and just opens the
// viewer — or does nothing. The only reliable "put this file on the phone"
// path is the share sheet (Save to Files / Downloads), and that call must
// happen in a tap. Android Chrome does honour <a download> on a blob URL.

export function isAppleTouch(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (!nav) return false;
  const ua = nav.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports itself as Macintosh but has a touch screen.
  return nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1;
}

export function needsShareToSave(nav = typeof navigator !== "undefined" ? navigator : null) {
  return isAppleTouch(nav);
}

export function pdfFileFromBlob(blob, fileName) {
  if (blob instanceof File && blob.name === fileName && blob.type === "application/pdf") return blob;
  return new File([blob], fileName, { type: "application/pdf" });
}

export function triggerAnchorDownload(url, fileName, doc = typeof document !== "undefined" ? document : null) {
  if (!doc || !url) return false;
  const a = doc.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  doc.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}

// Returns:
//   "shared"     — the phone share sheet took the file
//   "downloaded" — a real <a download> click (desktop / Android)
//   "aborted"    — the user closed the share sheet
//   "needs-tap"  — share needs a fresh gesture; keep a Save button on screen
export async function savePdfFile(blob, fileName, { url, nav, doc } = {}) {
  if (!blob) return "needs-tap";
  const n = nav || (typeof navigator !== "undefined" ? navigator : null);
  const file = pdfFileFromBlob(blob, fileName);
  if (needsShareToSave(n)) {
    if (n && typeof n.canShare === "function") {
      try {
        if (n.canShare({ files: [file] })) {
          // iOS drops the file if title/text/url travel with it.
          await n.share({ files: [file] });
          return "shared";
        }
      } catch (e) {
        if (e && e.name === "AbortError") return "aborted";
        if (e && e.name === "NotAllowedError") return "needs-tap";
      }
    }
    return "needs-tap";
  }
  const href = url || (typeof URL !== "undefined" ? URL.createObjectURL(file) : "");
  triggerAnchorDownload(href, fileName, doc);
  return "downloaded";
}
