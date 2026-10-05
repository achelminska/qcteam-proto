import { useRef } from "react";
import { RotateCcw, RotateCw, Trash2, X } from "lucide-react";

const srcOf = ph => (typeof ph === "string" ? ph : (ph && (ph.dataUrl || ph.path || ph.src)) || "");
const thumbOf = ph => (typeof ph === "string" ? ph : (ph && (ph.thumb || ph.dataUrl || ph.path || ph.src)) || "");

// Full-screen review: filmstrip, rotate left/right, optional delete. Used from
// the in-app camera (tap the last-shot thumb) and from every photo strip.
export function PhotoReview({ photos, index, onIndex, onClose, onRotate, onDelete, title = "Photos" }) {
  const touch = useRef(null);
  const n = (photos || []).length;
  const ix = n ? Math.min(Math.max(0, index), n - 1) : 0;
  const src = n ? srcOf(photos[ix]) : "";
  const step = d => n > 1 && onIndex((ix + d + n) % n);
  const stop = e => e.stopPropagation();
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#111417", zIndex: 90, color: "#fff" }}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1); }}>
      <div className="flex items-center px-4" style={{ height: 56, paddingTop: "env(safe-area-inset-top)" }}>
        <span className="text-[17px] font-medium flex-1">{title}</span>
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center" aria-label="Close"><X size={22} strokeWidth={2} /></button>
      </div>
      <div className="flex-1 flex items-center justify-center min-h-0 px-3">
        {src ? <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : null}
      </div>
      <div className="flex items-center px-6 py-3" onClick={stop}>
        {onRotate ? (
          <>
            <button type="button" onClick={() => onRotate(-1)} className="w-11 h-11 flex items-center justify-center" aria-label="Rotate left"><RotateCcw size={22} strokeWidth={2} /></button>
            <button type="button" onClick={() => onRotate(1)} className="w-11 h-11 flex items-center justify-center" aria-label="Rotate right"><RotateCw size={22} strokeWidth={2} /></button>
          </>
        ) : <span className="w-11" />}
        <span className="flex-1" />
        {onDelete && <button type="button" onClick={() => onDelete(ix)} className="w-11 h-11 flex items-center justify-center" aria-label="Delete"><Trash2 size={22} strokeWidth={2} /></button>}
      </div>
      {n > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-4" style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }} onClick={stop}>
          {photos.map((ph, k) => (
            <button type="button" key={ph.key || ph.id || k} onClick={() => onIndex(k)} className="flex-shrink-0 rounded-md overflow-hidden" style={{ width: 64, height: 64, outline: k === ix ? "2px solid #fff" : "none", outlineOffset: 1, background: "#000" }}>
              <img src={thumbOf(ph)} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
