import { describe, expect, it } from "vitest";
import { attributesToSpecs, listCheck, listSpecFor, numericSpecs, resolveListSpec, specKey } from "./specs.js";
import { specLabel } from "./format.js";

const dicts = [{ id: "d-ripe", name: "Ripe", items: [{ id: "i-yes", value: "Yes" }, { id: "i-no", value: "No" }] }];

describe("list specifications", () => {
  it("keys numeric specs by name + basis and list specs by their list", () => {
    expect(specKey({ name: " Brix ", basis: "cu" })).toBe("brix|cu");
    expect(specKey({ name: "Brix" })).toBe("brix|piece");
    expect(specKey({ kind: "list", dictionaryId: "d-ripe", itemId: "i-yes" })).toBe("list:d-ripe");
  });
  it("resolves the list name and expected value from the dictionaries", () => {
    const q = resolveListSpec(dicts, { id: "q1", kind: "list", dictionaryId: "d-ripe", itemId: "i-yes" });
    expect(q.name).toBe("Ripe"); expect(q.value).toBe("Yes"); expect(q.missing).toBe(false);
    expect(specLabel(q)).toBe("Yes");
    expect(resolveListSpec(dicts, { kind: "list", dictionaryId: "d-ripe", itemId: "gone" }).missing).toBe(true);
  });
  it("compares the controller's answer with the expected value", () => {
    const q = resolveListSpec(dicts, { kind: "list", dictionaryId: "d-ripe", itemId: "i-yes" });
    expect(listCheck(q, "Yes")).toEqual({ expected: "Yes", ok: true });
    expect(listCheck(q, "No")).toEqual({ expected: "Yes", ok: false });
    expect(listCheck(q, "")).toBeNull();
    expect(listCheck(null, "No")).toBeNull();
  });
  it("keeps numeric matching away from list specs", () => {
    const specs = [{ id: "a", name: "Brix", min: 10 }, { id: "b", kind: "list", dictionaryId: "d-ripe", itemId: "i-yes" }];
    expect(numericSpecs(specs).map(q => q.id)).toEqual(["a"]);
    expect(listSpecFor(specs, "d-ripe").id).toBe("b");
    expect(listSpecFor(specs, "other")).toBeNull();
  });
});

describe("attributesToSpecs", () => {
  let n = 0; const mkId = () => "id" + (++n);
  it("turns properties into list specs and drops the attributes key", () => {
    const out = attributesToSpecs({ id: "p", specs: [{ id: "a", name: "Brix", min: 10 }], attributes: [{ dictionaryId: "d-ripe", itemId: "i-yes" }] }, mkId);
    expect(out.attributes).toBeUndefined();
    expect(out.specs).toHaveLength(2);
    expect(out.specs[1]).toMatchObject({ kind: "list", dictionaryId: "d-ripe", itemId: "i-yes" });
  });
  it("lets an existing list spec win and leaves owners without attributes alone", () => {
    const owner = { id: "p", specs: [{ id: "b", kind: "list", dictionaryId: "d-ripe", itemId: "i-no" }], attributes: [{ dictionaryId: "d-ripe", itemId: "i-yes" }] };
    expect(attributesToSpecs(owner, mkId).specs).toEqual(owner.specs);
    const plain = { id: "c", specs: [] };
    expect(attributesToSpecs(plain, mkId)).toBe(plain);
  });
});
