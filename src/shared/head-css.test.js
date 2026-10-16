import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyHeadCss, removeHeadCss } from "./head-css.js";

function installDom() {
  const byId = new Map();
  const parent = () => {
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
  };
  const head = parent();
  const body = parent();
  const document = {
    head,
    body,
    getElementById(id) { return byId.get(id) || null; },
    createElement(tag) {
      const el = {
        tagName: String(tag).toUpperCase(),
        textContent: "",
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
  return document;
}

beforeEach(() => { installDom(); });
afterEach(() => { delete globalThis.document; });

describe("applyHeadCss", () => {
  it("puts the sheet in document.head, not the body", () => {
    const el = applyHeadCss("qc-test-css", ":root{color:red}");
    expect(el).toBeTruthy();
    expect(el.parentNode).toBe(document.head);
    expect(el.tagName).toBe("STYLE");
    expect(el.textContent).toBe(":root{color:red}");
    expect(document.body.contains(el)).toBe(false);
    expect(document.getElementById("qc-test-css")).toBe(el);
  });

  it("updates the same tag instead of adding a second one", () => {
    applyHeadCss("qc-test-css", "a{color:red}");
    applyHeadCss("qc-test-css", "a{color:blue}");
    expect(document.querySelectorAll("#qc-test-css")).toHaveLength(1);
    expect(document.getElementById("qc-test-css").textContent).toBe("a{color:blue}");
  });

  it("moves a stray body tag into head", () => {
    const stray = document.createElement("style");
    stray.id = "qc-test-css";
    stray.textContent = "old";
    document.body.appendChild(stray);
    const el = applyHeadCss("qc-test-css", "new{x:1}");
    expect(el.parentNode).toBe(document.head);
    expect(document.body.contains(el)).toBe(false);
    expect(el.textContent).toBe("new{x:1}");
  });

  it("removes the tag when css is empty", () => {
    applyHeadCss("qc-test-css", "a{}");
    applyHeadCss("qc-test-css", "");
    expect(document.getElementById("qc-test-css")).toBe(null);
  });
});
