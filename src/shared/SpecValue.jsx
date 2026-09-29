import { specLabel } from "./format.js";
import { applyTempSpec, tempUntilLabel } from "./tempspec.js";

// Permanent limit struck through, temporary one beside it in the soft red.
// A calendar end tucks in next to the new number; open-ended temps stay quiet.
export function SpecValue({ spec, temp, colors: C, extra }) {
  const t = temp || spec?.temp || null;
  if (!t) {
    return <span style={{ fontVariantNumeric: "tabular-nums" }}>{specLabel(spec)}{extra}</span>;
  }
  const applied = spec?.perm ? spec : applyTempSpec(spec, t);
  return (
    <span className="inline-flex items-baseline gap-1.5 flex-wrap justify-end" style={{ fontVariantNumeric: "tabular-nums" }}>
      <span style={{ color: C.muted, textDecoration: "line-through" }}>{specLabel(applied.perm)}</span>
      <span style={{ color: C.bad, fontWeight: 600 }}>{specLabel(applied)}</span>
      {t.expiresAt ? <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: C.bad }}>{tempUntilLabel(t)}</span> : null}
      {extra}
    </span>
  );
}
