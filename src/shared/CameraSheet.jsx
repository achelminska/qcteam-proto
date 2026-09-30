import { useEffect, useRef, useState } from "react";
import { X, Zap, Image as ImageIcon } from "lucide-react";
import { grabFrame, setTorch, stopStream, torchCapable } from "./camera.js";

// In-app camera: the native <input capture> closes after every shot and asks
// "Use this photo?". This sheet keeps the preview up; shots land as thumbs on
// the bottom left; X is when the controller is done.
export function CameraSheet({ onShot, onClose, onLibrary }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [shots, setShots] = useState([]);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [flash, setFlash] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let dead = false;
    (async () => {
      const secure = typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost");
      if (!secure) { setErr("The camera only works over HTTPS."); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser has no camera API."); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1920 } },
          audio: false,
        });
        if (dead) { stopStream(stream); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) { stopStream(stream); return; }
        v.srcObject = stream;
        v.setAttribute("playsinline", "true");
        v.muted = true;
        await v.play();
        if (dead) { stopStream(stream); return; }
        setHasTorch(torchCapable(stream));
        setReady(true);
      } catch (e) {
        if (dead) return;
        setErr(e?.name === "NotAllowedError" ? "Camera permission denied — allow it in the browser settings." : e?.name === "NotFoundError" ? "No camera found." : String(e?.message || e));
      }
    })();
    const prev = typeof document !== "undefined" ? document.body.style.overflow : "";
    if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    return () => {
      dead = true;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (typeof document !== "undefined") document.body.style.overflow = prev;
    };
  }, []);

  const shoot = () => {
    if (busy) return;
    const d = grabFrame(videoRef.current);
    if (!d) return;
    setBusy(true);
    setShots(s => [...s, d]);
    try { onShot?.(d); } finally { setTimeout(() => setBusy(false), 180); }
  };

  const toggleFlash = async () => {
    const next = !flash;
    const ok = await setTorch(streamRef.current, next);
    if (ok) setFlash(next);
  };

  const last = shots[shots.length - 1];

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#000", zIndex: 80, color: "#fff" }}>
      <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", background: "#000" }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,.28) 0%, transparent 18%, transparent 78%, rgba(0,0,0,.4) 100%)" }} />

      <div className="relative z-10 flex items-center justify-end px-4" style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        {hasTorch && <button type="button" onClick={toggleFlash} className="mr-auto w-10 h-10 rounded-full flex items-center justify-center" style={{ background: flash ? "rgba(255,255,255,.22)" : "transparent", color: flash ? "#ffe08a" : "#fff" }} aria-label="Flash"><Zap size={20} strokeWidth={2} /></button>}
        <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.28)" }} aria-label="Done"><X size={22} strokeWidth={2} /></button>
      </div>

      {err && (
        <div className="relative z-10 mx-4 mt-3 rounded-xl px-3 py-2 text-sm" style={{ background: "#5a2a2a" }}>
          {err}
          <div className="flex gap-2 mt-2">
            {onLibrary && <button type="button" onClick={onLibrary} className="text-xs underline">From library</button>}
            <button type="button" onClick={onClose} className="text-xs underline">Close</button>
          </div>
        </div>
      )}

      <div className="relative z-10 mt-auto flex items-end justify-between px-5" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
        <div className="w-16 h-16 flex items-end">
          {last ? (
            <div className="relative">
              <img src={last} alt="" className="w-14 h-14 rounded-full object-cover" style={{ border: "2px solid #fff", boxShadow: "0 2px 10px rgba(0,0,0,.4)" }} />
              {shots.length > 1 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center" style={{ background: "#fff", color: "#111" }}>{shots.length}</span>}
            </div>
          ) : <span className="w-14 h-14" />}
        </div>
        <button type="button" onClick={shoot} disabled={!ready || !!err} className="w-[72px] h-[72px] rounded-full flex items-center justify-center" style={{ border: "4px solid #fff", background: "transparent", opacity: ready && !err ? 1 : .4 }} aria-label="Shutter">
          <span className="w-14 h-14 rounded-full" style={{ background: "#fff" }} />
        </button>
        <div className="w-16 h-16 flex items-end justify-end">
          {onLibrary && <button type="button" onClick={onLibrary} className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,.28)" }} aria-label="From library"><ImageIcon size={22} strokeWidth={2} /></button>}
        </div>
      </div>
    </div>
  );
}
