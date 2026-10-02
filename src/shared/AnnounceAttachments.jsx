import { useState } from "react";
import { Paperclip } from "lucide-react";
import { ANNOUNCE_ACCEPT, addAnnounceFiles, announceFileHref, announceFilesOf, formatFileSize } from "./announce-files.js";

const Ic = ({ colors, s = 12 }) => <Paperclip size={s} strokeWidth={2} style={{ display: "inline-block", flexShrink: 0, color: colors?.muted }} />;

export function AnnounceFileList({ announcement, files, colors, onRemove, compact = false, stopNav = false, cta = false }) {
  const list = files || announceFilesOf(announcement);
  if (!list.length) return null;
  return (
    <div className={compact ? "flex flex-col gap-1 mt-1.5" : "flex flex-col gap-1.5 mt-2"} data-story-cta={cta ? "" : undefined} onClick={stopNav ? e => e.stopPropagation() : undefined}>
      {list.map(f => (
        <a
          key={f.id || f.path}
          href={announceFileHref(f)}
          target="_blank"
          rel="noreferrer"
          className="text-xs px-2 py-1.5 rounded-lg inline-flex items-center gap-2 min-w-0"
          style={{ background: colors.bg, border: `1px solid ${colors.line}`, color: colors.ink }}
        >
          <Ic colors={colors} />
          <span className="truncate flex-1 min-w-0">{f.name}</span>
          {f.size ? <span className="flex-shrink-0" style={{ color: colors.muted }}>{formatFileSize(f.size)}</span> : null}
          {onRemove && (
            <button
              type="button"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(f.id); }}
              className="flex-shrink-0 px-1"
              style={{ color: colors.muted }}
              aria-label={`Remove ${f.name}`}
            >×</button>
          )}
        </a>
      ))}
    </div>
  );
}

export function AnnounceAttachButton({ onAdd, disabled, colors }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pick = () => {
    if (disabled || busy) return;
    const i = document.createElement("input");
    i.type = "file";
    i.multiple = true;
    i.accept = ANNOUNCE_ACCEPT;
    i.onchange = async () => {
      const picked = Array.from(i.files || []);
      i.remove();
      if (!picked.length) return;
      setBusy(true);
      setErr("");
      const { added, errors } = await addAnnounceFiles(picked);
      if (added.length) onAdd(added);
      if (errors.length) setErr(errors[0]);
      setBusy(false);
    };
    i.click();
  };
  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={pick}
        disabled={disabled || busy}
        className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center"
        style={{ background: colors.bg, border: `1px solid ${colors.line}`, color: disabled || busy ? colors.muted : colors.ink }}
      >
        <Paperclip size={12} strokeWidth={2} style={{ marginRight: 6 }} />
        {busy ? "Uploading…" : "Attach a file"}
      </button>
      <p className="text-[11px] mt-1" style={{ color: colors.muted }}>PDF, PowerPoint, Word, Excel or an image — up to 20 MB each.</p>
      {err && <p className="text-[11px] mt-1" style={{ color: colors.bad }}>{err}</p>}
    </div>
  );
}
