import { useEffect } from "react";

// App CSS must not live in a <style> node. iOS WebKit paints the first "{" of a
// <style> over the clock when the status bar is black-translucent — even if the
// tag sits in document.head. Constructable sheets (or a blob <link>) have no
// CSS text in the visual tree.
const registry = new Map();

function canAdopt() {
  try {
    return typeof CSSStyleSheet === "function"
      && typeof CSSStyleSheet.prototype.replaceSync === "function"
      && !!document.adoptedStyleSheets;
  } catch {
    return false;
  }
}

function canBlobLink() {
  try {
    return typeof Blob === "function"
      && typeof URL !== "undefined"
      && typeof URL.createObjectURL === "function";
  } catch {
    return false;
  }
}

function dropRecord(id) {
  const rec = registry.get(id);
  if (!rec) {
    if (typeof document !== "undefined") document.getElementById(id)?.remove();
    return;
  }
  if (rec.kind === "sheet" && document.adoptedStyleSheets) {
    document.adoptedStyleSheets = [...document.adoptedStyleSheets].filter(s => s !== rec.sheet);
  }
  if (rec.kind === "link") {
    rec.link?.remove();
    if (rec.url) {
      try { URL.revokeObjectURL(rec.url); } catch { /* already revoked */ }
    }
  }
  if (rec.kind === "style") rec.el?.remove();
  registry.delete(id);
}

export function applyHeadCss(id, css) {
  if (typeof document === "undefined" || !id) return null;
  if (css == null || css === "") {
    dropRecord(id);
    return null;
  }

  if (canAdopt()) {
    let rec = registry.get(id);
    if (!rec || rec.kind !== "sheet") {
      dropRecord(id);
      const sheet = new CSSStyleSheet();
      rec = { kind: "sheet", sheet };
      registry.set(id, rec);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    try {
      rec.sheet.replaceSync(css);
      document.getElementById(id)?.remove();
      return rec.sheet;
    } catch {
      dropRecord(id);
    }
  }

  if (canBlobLink()) {
    let rec = registry.get(id);
    if (!rec || rec.kind !== "link") {
      dropRecord(id);
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      rec = { kind: "link", link, url: null };
      registry.set(id, rec);
    }
    if (rec.url) {
      try { URL.revokeObjectURL(rec.url); } catch { /* already revoked */ }
    }
    rec.url = URL.createObjectURL(new Blob([css], { type: "text/css" }));
    rec.link.href = rec.url;
    return rec.link;
  }

  let rec = registry.get(id);
  if (!rec || rec.kind !== "style") {
    dropRecord(id);
    const el = document.createElement("style");
    el.id = id;
    document.head.appendChild(el);
    rec = { kind: "style", el };
    registry.set(id, rec);
  }
  if (rec.el.textContent !== css) rec.el.textContent = css;
  return rec.el;
}

export function removeHeadCss(id) {
  if (typeof document === "undefined" || !id) return;
  dropRecord(id);
}

export function useHeadCss(id, css) {
  useEffect(() => { applyHeadCss(id, css); }, [id, css]);
  useEffect(() => () => removeHeadCss(id), [id]);
}
