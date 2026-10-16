import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyHeadCss, removeHeadCss } from "./head-css.js";

function parent() {
  const kids = [];
  return {
    kids,
    appendChild(el) {
      if (el.parentNode && el.parentNode !== this) el.remove();
      el.parentNode = this;
      if (!kids.includes(el)) kids.push(el);
      return el;
    },
    contains(el) { return kids.includes(el); },
  };
}

function installDom({ adopt = false, blob = false } = {}) {
  const byId = new Map();
  const head = parent();
  const body = parent();
  const adopted = [];
  const document = {
    head,
    body,
    get adoptedStyleSheets() { return adopted.slice(); },
    set adoptedStyleSheets(v) { adopted.length = 0; adopted.push(...(v || [])); },
    getElementById(id) { return byId.get(id) || null; },
    createElement(tag) {
      const el = {
        tagName: String(tag).toUpperCase(),
        textContent: "",
        rel: "",
        href: "",
        parentNode: null,
        _id: "",
        get id() { return this._id; },
        set id(v) {
          if (this._id) byId.delete(this._id);
          this._id = v;
          if (v) byId.set(v, el);
        },
        remove() {
          if (this._id) byId.delete(this._id);
          if (!this.parentNode) return;
          const kids = this.parentNode.kids;
          const i = kids.indexOf(this);
          if (i >= 0) kids.splice(i, 1);
          this.parentNode = null;
        },
      };
      return el;
    },
    querySelectorAll(sel) {
      const id = sel.startsWith("#") ? sel.slice(1) : "";
      const el = byId.get(id);
      return el ? [el] : [];
    },
  };
  globalThis.document = document;

  delete globalThis.CSSStyleSheet;
  delete globalThis.Blob;
  if (globalThis.URL) {
    delete globalThis.URL.createObjectURL;
    delete globalThis.URL.revokeObjectURL;
  }

  if (adopt) {
    globalThis.CSSStyleSheet = class CSSStyleSheet {
      constructor() { this.css = ""; }
      replaceSync(css) { this.css = css; }
    };
  }
  if (blob) {
    globalThis.Blob = class Blob {
      constructor(parts) { this.parts = parts; }
    };
    globalThis.URL = globalThis.URL || function URL() {};
    let n = 0;
    globalThis.URL.createObjectURL = () => `blob:qc-${++n}`;
    globalThis.URL.revokeObjectURL = () => {};
  }
  return document;
}

beforeEach(() => {
  delete globalThis.document;
  delete globalThis.CSSStyleSheet;
});
afterEach(() => {
  try { removeHeadCss("qc-test-css"); } catch { /* no document */ }
  delete globalThis.document;
  delete globalThis.CSSStyleSheet;
});

describe("applyHeadCss", () => {
  it("adopts a constructable sheet and never creates a <style>", () => {
    const document = installDom({ adopt: true });
    const sheet = applyHeadCss("qc-test-css", ":root{color:red}");
    expect(sheet.css).toBe(":root{color:red}");
    expect(document.adoptedStyleSheets).toEqual([sheet]);
    expect(document.head.kids).toEqual([]);
    expect(document.getElementById("qc-test-css")).toBe(null);
    applyHeadCss("qc-test-css", "a{color:blue}");
    expect(document.adoptedStyleSheets).toHaveLength(1);
    expect(sheet.css).toBe("a{color:blue}");
  });

  it("uses a blob <link> when constructable sheets are missing", () => {
    const document = installDom({ blob: true });
    const link = applyHeadCss("qc-test-css", "a{color:red}");
    expect(link.tagName).toBe("LINK");
    expect(link.parentNode).toBe(document.head);
    expect(link.href).toMatch(/^blob:/);
    expect(document.body.contains(link)).toBe(false);
  });

  it("falls back to a head <style> only when nothing else is available", () => {
    const document = installDom();
    const el = applyHeadCss("qc-test-css", ":root{color:red}");
    expect(el.tagName).toBe("STYLE");
    expect(el.parentNode).toBe(document.head);
    expect(document.body.contains(el)).toBe(false);
    applyHeadCss("qc-test-css", "");
    expect(document.getElementById("qc-test-css")).toBe(null);
  });
});
