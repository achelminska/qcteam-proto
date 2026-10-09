// Sign-in screen shared by the portal and the phone app. Built with a factory so each app passes its own theme,
// global CSS, icon helper and state helpers (they keep separate copies of those on purpose).
import { useState, useEffect, useRef } from "react";
import { QCWordmark } from "./brand.jsx";
import { Eye, EyeOff } from "lucide-react";

export function createLoginScreen({ DARK, GLOBAL_CSS, Ic, ChevronLeft, ChevronRight, Check, notifyHeads, nowISO, writeSession }) {
// Bump when public/login-hero.jpg changes: the service worker and the browser cache the old picture under the same URL.
const LOGIN_HERO_V = "8";
return function LoginScreen({ s, onLogin, allowRoles }) {
  // Always the prototype's dark theme, whatever the app is set to: the sign-in page is the front door, one look.
  const D = DARK;
  const [mode, setMode] = useState("login");   // login | create | forgot | sent
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [pw2, setPw2] = useState(""); const [err, setErr] = useState(""); const [show, setShow] = useState(false);
  const [hero, setHero] = useState(true);   // public/login-hero.jpg — optional photo behind the brand panel; the gradient alone when missing
  // Brand panel carousel: slide 0 is the inspection photo, slide 1 shows the app on phones. Arrows, dots, keys and swipe.
  const HERO_SLIDES = [
    { src: `/login-hero.jpg?v=${LOGIN_HERO_V}`, cls: "", title: "Quality control, as a team.", line: "One place for the whole crew — on the dock and in the office." },
    { src: `/login-hero-2.jpg?v=${LOGIN_HERO_V}`, cls: "screens", title: "Inspect anywhere.", line: "Scan, check, decide — right on the dock." },
    { src: `/login-hero-3.jpg?v=${LOGIN_HERO_V}`, cls: "screens", title: "See the whole floor.", line: "Everyone works from the same live picture." },
  ];
  useEffect(() => {
    const html = document.documentElement, body = document.body; const prev = [html.style.background, body.style.background];
    html.style.background = "#0D1410"; body.style.background = "#0D1410";
    let meta = document.querySelector('meta[name="theme-color"]'); const prevTheme = meta ? meta.getAttribute("content") : null;
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; document.head.appendChild(meta); }
    meta.setAttribute("content", "#0D1410");
    return () => { html.style.background = prev[0]; body.style.background = prev[1]; if (prevTheme != null) meta.setAttribute("content", prevTheme); else meta.remove(); };
  }, []);
  const [slide, setSlide] = useState(0); const touchX = useRef(null); const [paused, setPaused] = useState(false); const manual = useRef(false);
  const goSlide = (d, byUser = true) => { if (byUser) manual.current = true; setSlide(i => (i + d + HERO_SLIDES.length) % HERO_SLIDES.length); };
  useEffect(() => { if (!hero || paused || (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(max-width:860px)").matches)) return; const id = setInterval(() => { if (!manual.current) goSlide(1, false); }, 7000); return () => clearInterval(id); }, [hero, paused]);
  useEffect(() => { const k = e => { if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; if (e.key === "ArrowRight") goSlide(1); if (e.key === "ArrowLeft") goSlide(-1); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, []);
  const users = (s.users || []).filter(u => u.active !== false && (!allowRoles || allowRoles.includes(u.role)));
  const norm = v => String(v || "").trim().toLowerCase();
  const findUser = () => { const e = norm(email); if (!e) return null; return users.find(u => norm(u.email) === e) || users.find(u => norm(u.name) === e) || null; };
  const secretOf = u => u.password || u.pin || "";
  const submit = () => {
    const u = findUser(); if (!u) { setErr("No account with that e-mail. The Head of Quality creates accounts under Users."); return; }
    if (!secretOf(u)) { setMode("create"); setErr(""); setPw(""); setPw2(""); return; }   // first sign-in: choose a password
    if (pw !== secretOf(u)) { setErr("Wrong password."); setPw(""); return; }
    writeSession(u.id); onLogin(u.id);
  };
  const create = () => {
    const u = findUser(); if (!u) { setMode("login"); return; }
    if (pw.length < 4) { setErr("Use at least 4 characters."); return; }
    if (pw !== pw2) { setErr("The two passwords differ."); return; }
    // The password lives on the user record (prototype: shared state, not a security boundary — see the note in Users).
    s.__set && s.__set(x => ({ ...x, users: x.users.map(q => q.id === u.id ? { ...q, password: pw, resetRequestedAt: null } : q) }));
    writeSession(u.id); onLogin(u.id);
  };
  const forgot = () => {
    const u = findUser(); if (!u) { setErr("No account with that e-mail."); return; }
    // No mail server in the prototype: the request lands with every Head as a notification; they reset it under Users.
    s.__set && s.__set(x => notifyHeads({ ...x, users: x.users.map(q => q.id === u.id ? { ...q, resetRequestedAt: nowISO() } : q) }, "Password reset", `${u.name} asked for a password reset — open Users and press “Reset password”.`, "Users", u.id));
    setMode("sent"); setErr("");
  };
  const onKey = fn => e => { if (e.key === "Enter") fn(); };
  const green = "#0B2418", green2 = "#1A4A32";
  const field = (label, value, onChange, props = {}) => (
    <label className="block mb-4"><span className="lbl">{label}</span><input className="fld" value={value} onChange={e => { onChange(e.target.value); setErr(""); }} {...props} /></label>
  );
  return (
    <div className="qc min-h-screen qc-login" style={{ background: D.bg, color: D.ink }}>
      <style>{GLOBAL_CSS()}{`
        .qc-login{display:grid;grid-template-columns:minmax(380px,46%) minmax(0,1fr);min-height:100vh;color:${D.ink}}
        .qc-login-form{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:48px 32px;background:#0D1410}
        .qc-login-form>div{position:relative}
        .qc-login-brand{position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:44px 48px 28px;color:#EEF5F0;background:linear-gradient(160deg,${green2} 0%,${green} 70%)}
        .qc-login-brand .hero{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:55% 45%;opacity:0;filter:saturate(.85) contrast(1.03);transition:opacity .5s ease}
        .qc-login-brand .hero.on{opacity:.92}
        .qc-login-brand .hero.screens{object-position:50% 42%}
        .qc-login-brand .cap{transition:opacity .5s ease;left:0;right:0;bottom:44px}
        .qc-login-brand .nav{position:absolute;right:24px;bottom:18px;display:flex;align-items:center;gap:10px;z-index:2}
        .qc-login-brand .nav button{width:30px;height:30px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(11,36,24,.55);color:#EEF5F0;display:inline-flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);transition:background .12s}
        .qc-login-brand .nav button:hover{background:rgba(11,36,24,.85)}
        .qc-login-brand .dots{display:flex;gap:6px;margin:0 4px}
        .qc-login-brand .dots i{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.35);display:block;transition:background .2s,width .2s}
        .qc-login-brand .dots i.on{background:#EEF5F0;width:18px}
        .qc-login-brand .tint{position:absolute;inset:0;transition:background .5s;background:linear-gradient(180deg,rgba(11,36,24,.6) 0%,rgba(11,36,24,.2) 22%,rgba(11,36,24,.12) 50%,rgba(11,36,24,.55) 76%,rgba(11,36,24,.94) 100%),linear-gradient(90deg,rgba(11,36,24,.3),rgba(11,36,24,0) 60%)}
        .qc-login-brand .grain{position:absolute;inset:0;background:radial-gradient(1100px 600px at -10% -10%,rgba(255,255,255,.12),transparent 60%);pointer-events:none}
        .qc-login-brand .lines{position:absolute;inset:0;opacity:.06;background-image:linear-gradient(rgba(255,255,255,.9) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.9) 1px,transparent 1px);background-size:48px 48px;pointer-events:none}
        .qc-login .card{background:${D.surface};border:1px solid ${D.line};box-shadow:0 1px 0 rgba(255,255,255,.05) inset,0 16px 40px rgba(0,0,0,.45)}
        .qc-login.qc input.fld,.qc-login input.fld{width:100%;font-size:14px;min-height:40px;padding:0 12px;border-radius:8px;background:rgba(255,255,255,.025);border:1px solid rgba(140,211,166,.18);outline:none;color:${D.ink};transition:border-color .12s,background .12s;box-shadow:none}
        .qc-login.qc input.fld::placeholder{color:${D.muted};opacity:.7}
        .qc-login.qc input.fld:focus,.qc-login input.fld:focus{background:rgba(255,255,255,.04);border-color:rgba(140,211,166,.55);box-shadow:0 0 0 2px rgba(140,211,166,.08)}
        .qc-login .primary{width:100%;min-height:40px;border-radius:8px;font-weight:500;font-size:14px;letter-spacing:.01em;background:#26372D;color:#EEF5F0;border:1px solid rgba(140,211,166,.16);transition:background .12s,border-color .12s}
        .qc-login .primary:hover{background:#2F4438;border-color:rgba(140,211,166,.4)}
        .qc-login .primary:disabled{background:rgba(38,55,45,.55);border-color:rgba(140,211,166,.14);color:rgba(238,245,240,.45)}
        .qc-login .pwwrap{position:relative;display:block}
        .qc-login .eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);color:${D.muted};background:none;border:0;padding:4px;display:inline-flex;cursor:pointer}
        .qc-login .eye:hover{color:${D.ink}}
        .qc-login .link{color:#26372D;font-size:12px;background:none;border:0;padding:0}
        .qc-login .lbl{display:block;font-size:11px;font-weight:500;letter-spacing:.04em;text-transform:uppercase;color:${D.muted};margin-bottom:6px}
        .qc-login .link:hover{color:#2F4438;text-decoration:underline}
        @media (max-width:860px){
          .qc-login{grid-template-columns:1fr;grid-template-rows:auto 1fr;background:#0D1410!important;position:relative}
          .qc-login::before{content:"";position:fixed;inset:0;z-index:0;background:#0D1410 url(/login-mobile-bg.jpg?v=${LOGIN_HERO_V}) center bottom / 100% auto no-repeat}
          .qc-login>*{position:relative;z-index:1}
          .qc-login-brand{padding:56px 20px 0;min-height:0;background:transparent;align-items:center}
          .qc-login-brand .hero,.qc-login-brand .tint,.qc-login-brand .grain,.qc-login-brand .lines,.qc-login-brand .nav,.qc-login-brand .cap{display:none}
          .qc-login-brand .logo{margin:0 auto}
          .qc-login-brand .logo svg{width:240px;height:auto;color:#C4DCCB!important;opacity:.95}
          .qc-login-form{padding:8px 24px 40vh;align-items:flex-start;background:transparent}
          .qc-login-form h1{display:block;font-size:22px!important;margin:18px 0 12px!important;color:#C4DCCB!important;opacity:.95}.qc-login-form h1+p{display:none}
          .qc-login-form .link{color:${D.muted}}
        }
      `}</style>
      <aside className={`qc-login-brand${hero ? " photo" : ""}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onTouchStart={e => { touchX.current = e.touches[0].clientX; }} onTouchEnd={e => { const x0 = touchX.current; touchX.current = null; if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) goSlide(dx < 0 ? 1 : -1); }}>
        {hero && HERO_SLIDES.map((h, i) => <img key={h.src} className={`hero ${h.cls}${slide === i ? " on" : ""}`} src={h.src} alt="" onError={() => { if (i === 0) setHero(false); }} />)}
        {hero && <div className="tint" />}
        <div className="grain" />{!hero && <div className="lines" />}
        <div className="logo" style={{ position: "relative" }}><QCWordmark width={190} style={{ color: "#EEF5F0", display: "block" }} /></div>
        <div style={{ position: "relative", maxWidth: 460, paddingBottom: 44 }}>
          {hero ? HERO_SLIDES.map((h, i) => <div key={h.src} className="cap" style={{ opacity: slide === i ? 1 : 0, position: slide === i ? "relative" : "absolute", pointerEvents: slide === i ? "auto" : "none" }}><p className="text-[30px] leading-tight font-semibold" style={{ letterSpacing: "-.01em" }}>{h.title}</p><p className="text-[16px] mt-2" style={{ opacity: .82, lineHeight: 1.45 }}>{h.line}</p></div>)
            : <div><p className="text-[30px] leading-tight font-semibold">Quality control, as a team.</p><p className="text-[16px] mt-2" style={{ opacity: .82 }}>One place for the whole crew — on the dock and in the office.</p></div>}
        </div>
        {hero && <div className="nav" aria-label="Pictures"><button onClick={() => goSlide(-1)} title="Previous"><Ic i={ChevronLeft} s={15} mr={0} /></button><span className="dots">{HERO_SLIDES.map((_, i) => <i key={i} className={slide === i ? "on" : ""} onClick={() => setSlide(i)} style={{ cursor: "pointer" }} />)}</span><button onClick={() => goSlide(1)} title="Next"><Ic i={ChevronRight} s={15} mr={0} /></button></div>}
      </aside>
      <section className="qc-login-form">
        <div className="w-full" style={{ maxWidth: 400 }}>
          {mode === "login" && <div>
            <h1 className="text-[22px] leading-tight" style={{ color: D.ink, fontWeight: 600, marginBottom: 4 }}>Sign in</h1>
            <p className="text-[13px]" style={{ color: D.muted, marginBottom: 28 }}>Use the e-mail the Head of Quality registered for you.</p>
            {field("E-mail", email, setEmail, { type: "email", autoComplete: "username", autoFocus: true, onKeyDown: onKey(submit) })}
            <label className="block mb-2"><span className="lbl">Password</span><span className="pwwrap"><input className="fld" type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={e => { setPw(e.target.value); setErr(""); }} onKeyDown={onKey(submit)} style={{ paddingRight: 40 }} /><button type="button" className="eye" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"}><Ic i={show ? EyeOff : Eye} s={16} mr={0} /></button></span></label>
            <p className="text-xs" style={{ color: err ? D.bad : D.muted, minHeight: 18, marginBottom: 14 }}>{err || " "}</p>
            <button className="primary" onClick={submit} disabled={!email.trim()}>Sign in</button>
            <div style={{ marginTop: 18 }}><button className="link" onClick={() => { setMode("forgot"); setErr(""); }}>Forgot your password?</button></div>
          </div>}
          {mode === "create" && <div>
            <button onClick={() => { setMode("login"); setErr(""); }} className="text-xs inline-flex items-center mb-5" style={{ color: D.muted }}><Ic i={ChevronLeft} s={14} mr={2} />Back</button>
            <h1 className="text-[24px] leading-tight font-semibold" style={{ color: D.ink }}>Welcome, {findUser()?.name?.split(" ")[0]}</h1>
            <p className="text-sm mt-1 mb-6" style={{ color: D.muted }}>Your account has no password yet. Choose one to finish signing in.</p>
            {field("New password", pw, setPw, { type: "password", autoComplete: "new-password", autoFocus: true, onKeyDown: onKey(create) })}
            {field("Repeat it", pw2, setPw2, { type: "password", autoComplete: "new-password", onKeyDown: onKey(create) })}
            <p className="text-xs mb-4" style={{ color: err ? D.bad : D.muted, minHeight: 18 }}>{err || "At least 4 characters. You can change it later with the Head."}</p>
            <button className="primary" onClick={create} disabled={!pw || !pw2}>Save and sign in</button>
          </div>}
          {mode === "forgot" && <div>
            <button onClick={() => { setMode("login"); setErr(""); }} className="text-xs inline-flex items-center mb-5" style={{ color: D.muted }}><Ic i={ChevronLeft} s={14} mr={2} />Back to sign in</button>
            <h1 className="text-[24px] leading-tight font-semibold" style={{ color: D.ink }}>Reset your password</h1>
            <p className="text-sm mt-1 mb-6" style={{ color: D.muted }}>Enter the e-mail of your account. The Head of Quality gets the request and clears your password — next time you sign in you choose a new one.</p>
            {field("E-mail", email, setEmail, { type: "email", autoComplete: "username", autoFocus: true, onKeyDown: onKey(forgot) })}
            <p className="text-xs mb-4" style={{ color: err ? D.bad : D.muted, minHeight: 18 }}>{err || " "}</p>
            <button className="primary" onClick={forgot} disabled={!email.trim()}>Send the request</button>
          </div>}
          {mode === "sent" && <div>
            <div className="w-11 h-11 rounded-full flex items-center justify-center mb-4" style={{ background: D.accentSoft, color: D.accent }}><Ic i={Check} s={20} mr={0} /></div>
            <h1 className="text-[24px] leading-tight font-semibold" style={{ color: D.ink }}>Request sent</h1>
            <p className="text-sm mt-1 mb-6" style={{ color: D.muted }}>The Head of Quality has been notified. Once they reset your password, sign in with your e-mail and choose a new one.</p>
            <button className="primary" onClick={() => { setMode("login"); setPw(""); }}>Back to sign in</button>
          </div>}
        </div>
      </section>
    </div>
  );
}
}
