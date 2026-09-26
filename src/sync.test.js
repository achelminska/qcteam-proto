import { describe, expect, it } from "vitest";
import { createSyncer, mergeForward } from "./sync.js";

const valid = p => p && Array.isArray(p.categories);
const norm = p => p;

function disk({ quota = Infinity } = {}) {
  const m = new Map();
  let used = 0;
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      const prev = m.has(k) ? m.get(k).length : 0;
      if (used - prev + String(v).length > quota) throw new Error("QuotaExceededError");
      used = used - prev + String(v).length;
      m.set(k, String(v));
    },
    removeItem(k) { if (m.has(k)) { used -= m.get(k).length; m.delete(k); } },
  };
}

function server(initial, version = "1") {
  let value = JSON.stringify(initial);
  let ver = version;
  let fail = false;
  return {
    fail(v) { fail = v; },
    replace(state, version) { value = JSON.stringify(state); ver = version; },
    async get() { return { value, version: ver }; },
    async getMeta() { return ver; },
    async setVersioned(_k, body, ifMatch) {
      if (fail) return { error: true };
      if (ifMatch !== ver) return { conflict: true, value, version: ver };
      value = body; ver = String(Number(ver) + 1);
      return { version: ver };
    },
    state() { return JSON.parse(value); },
    version() { return ver; },
  };
}

function syncer(st, d, onState = () => {}) {
  return createSyncer({ key: "k", normalize: norm, isValid: valid, initial: { categories: [], inspections: [] }, onState, storage: st, localStore: d });
}

const skip = { id: "skip1", status: "Completed", result: "Accepted", completedAt: "2026-09-26T12:45:00.000Z", startedAt: "2026-09-26T12:45:00.000Z", typeId: "skip", skipReason: "no time" };

describe("unconfirmed edits survive a reload", () => {
  it("puts a finished inspection back when the save never reached the server", async () => {
    const base = { categories: [], inspections: [], products: [{ id: "p", name: "Before" }] };
    const st = server(base);
    const d = disk();
    const a = syncer(st, d);
    await a.load();
    st.fail(true);
    a.apply(s => ({ ...s, products: [{ id: "p", name: "Edited" }], inspections: [...s.inspections, skip] }));
    await a.flush();
    expect(st.state().inspections).toEqual([]);
    expect(d.getItem("k:pending")).toBeTruthy();
    a.dispose();

    let shown = null;
    const b = syncer(st, d, s => { shown = s; });
    st.fail(false);
    await b.load();
    expect(shown.inspections.map(i => i.id)).toEqual(["skip1"]);
    expect(shown.products[0].name).toBe("Edited");
    await b.flush();
    b.dispose();
    expect(st.state().inspections.map(i => i.id)).toEqual(["skip1"]);
    expect(st.state().products[0].name).toBe("Edited");
    expect(d.getItem("k:pending")).toBe(null);
  });

  it("keeps the finished inspection when the server moved on before the reload", async () => {
    const base = { categories: [], inspections: [], products: [{ id: "p", name: "Server product" }] };
    const st = server(base);
    const d = disk();
    const a = syncer(st, d);
    await a.load();
    st.fail(true);
    a.apply(s => ({ ...s, inspections: [skip] }));
    await a.flush();
    a.dispose();
    st.fail(false);
    st.replace({
      categories: [],
      products: [{ id: "p", name: "Server product" }],
      inspections: [{ id: "other", status: "Completed", result: "Accepted", completedAt: "2026-09-26T10:12:00.000Z" }],
    }, "5");

    let shown = null;
    const b = syncer(st, d, s => { shown = s; });
    await b.load();
    await b.flush();
    b.dispose();
    const ids = st.state().inspections.map(i => i.id).sort();
    expect(ids).toEqual(["other", "skip1"]);
    expect(shown.products[0].name).toBe("Server product");
    expect(d.getItem("k:pending")).toBe(null);
  });
});

describe("a bulky warehouse state", () => {
  it("restores the finished inspection from a small outbox when the full state does not fit", async () => {
    const rawRows = Array.from({ length: 40 }, (_, i) => ["row" + i]);
    const base = { categories: [], inspections: [], products: [{ id: "p", name: "Server product" }], integrations: [{ id: "dock", rawRows, rows: [] }] };
    const st = server(base);
    const d = disk({ quota: 1200 });
    d.setItem("k", "y".repeat(900));
    const a = syncer(st, d);
    await a.load();
    st.fail(true);
    a.apply(s => ({ ...s, inspections: [...s.inspections, skip] }));
    await a.flush();
    expect(st.state().inspections).toEqual([]);
    const raw = d.getItem("k:pending");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw).v).toBe(2);
    expect(raw.length).toBeLessThan(1200);
    a.dispose();

    st.fail(false);
    let shown = null;
    const b = syncer(st, d, s => { shown = s; });
    await b.load();
    expect(shown.inspections.map(i => i.id)).toEqual(["skip1"]);
    expect(shown.products[0].name).toBe("Server product");
    expect(shown.integrations[0].rawRows).toHaveLength(40);
    await b.flush();
    b.dispose();
    expect(st.state().inspections.map(i => i.id)).toEqual(["skip1"]);
    expect(d.getItem("k:pending")).toBe(null);
  });

  it("keeps the outbox when the server answers without a stored version", async () => {
    const base = { categories: [], inspections: [] };
    const st = server(base);
    const real = st.setVersioned.bind(st);
    st.setVersioned = async () => ({ version: null });
    const d = disk();
    const a = syncer(st, d);
    await a.load();
    a.apply(s => ({ ...s, inspections: [skip] }));
    await a.flush();
    expect(st.state().inspections).toEqual([]);
    expect(d.getItem("k:pending")).toBeTruthy();
    a.dispose();
    st.setVersioned = real;
    const b = syncer(st, d);
    await b.load();
    await b.flush();
    b.dispose();
    expect(st.state().inspections.map(i => i.id)).toEqual(["skip1"]);
  });
});

describe("mergeForward", () => {
  it("prefers a completed local copy of a draft the server still has, and keeps server-only records", () => {
    const base = { categories: [], inspections: [
      { id: "draft", status: "Draft", startedAt: "2026-09-26T12:45:00.000Z", result: null },
      { id: "kept", status: "Completed", result: "Accepted", completedAt: "2026-09-26T10:00:00.000Z" },
    ] };
    const local = { categories: [], inspections: [
      { id: "draft", status: "Completed", result: "Accepted", startedAt: "2026-09-26T12:45:00.000Z", completedAt: "2026-09-26T12:45:01.000Z", skipReason: "no time" },
    ] };
    const merged = mergeForward(base, local);
    const draft = merged.inspections.find(i => i.id === "draft");
    expect(draft.status).toBe("Completed");
    expect(draft.skipReason).toBe("no time");
    expect(merged.inspections.map(i => i.id).sort()).toEqual(["draft", "kept"]);
  });
});
