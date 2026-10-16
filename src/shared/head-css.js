import { useEffect } from "react";

// Put app CSS in document.head. A <style> in the phone shell is painted by iOS
// WebKit as a stray "{" over the clock when the status bar is black-translucent.
export function applyHeadCss(id, css) {
  if (typeof document === "undefined" || !id) return null;
  const existing = document.getElementById(id);
  if (css == null || css === "") {
    existing?.remove();
    return null;
  }
  let el = existing;
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
  } else if (el.parentNode !== document.head) {
    document.head.appendChild(el);
  }
  if (el.textContent !== css) el.textContent = css;
  return el;
}

export function removeHeadCss(id) {
  if (typeof document === "undefined" || !id) return;
  document.getElementById(id)?.remove();
}

export function useHeadCss(id, css) {
  useEffect(() => { applyHeadCss(id, css); }, [id, css]);
  useEffect(() => () => removeHeadCss(id), [id]);
}
