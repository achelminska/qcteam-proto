// Specifications come in two kinds and live on categories and products alike:
//   numeric  { id, name, unit, min, max, basis }              — matched to Number fields by name (+ basis)
//   list     { id, kind: "list", dictionaryId, itemId }       — the expected answer for List fields bound to that list
// The old "Properties" (attributes: dictionaryId + itemId) were list specs without the check; they migrate 1:1.
import { hasV } from "./format.js";

export const isListSpec = q => !!q && q.kind === "list";
export const specBasisOf = q => q?.basis || "piece";
// Identity inside the inheritance chain: numeric specs by name + basis, list specs by the list they constrain.
export const specKey = q => isListSpec(q) ? `list:${q.dictionaryId}` : `${(q.name || "").trim().toLowerCase()}|${specBasisOf(q)}`;

// Item ids are stable while lists and values get renamed, so a list spec is resolved against the dictionaries on read.
export const resolveListSpec = (dictionaries, q) => {
  const d = (dictionaries || []).find(x => x.id === q.dictionaryId);
  const it = d?.items?.find(i => i.id === q.itemId);
  const name = d?.name || q.name || "?";
  return { ...q, name, list: name, value: it?.value ?? "—", missing: !d || !it };
};
export const numericSpecs = specs => (specs || []).filter(q => !isListSpec(q));
export const listSpecs = specs => (specs || []).filter(isListSpec);
export const listSpecFor = (specs, dictionaryId) => (specs || []).find(q => isListSpec(q) && q.dictionaryId === dictionaryId) || null;

// A List field's answer against its spec. null = nothing to compare (no spec, no answer, or the list item is gone).
export const listCheck = (spec, value) => {
  if (!spec || spec.missing || !hasV(value)) return null;
  return { expected: spec.value, ok: String(value) === String(spec.value) };
};

// Migration: attributes → list specs on the same owner (category or product). Existing list specs win; the
// attributes key disappears so nothing keeps reading it.
export const attributesToSpecs = (owner, mkId) => {
  if (!owner || owner.attributes === undefined) return owner;
  const { attributes, ...rest } = owner;
  const specs = [...(rest.specs || [])];
  (attributes || []).forEach(a => {
    if (!a?.dictionaryId || !a.itemId || listSpecFor(specs, a.dictionaryId)) return;
    specs.push({ id: mkId(), kind: "list", dictionaryId: a.dictionaryId, itemId: a.itemId });
  });
  return { ...rest, specs };
};
