import { useState, useEffect, useRef } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Legend } from "recharts";
import { Clock, MessageCircle, Link2, List as ListIcon, BarChart3, Printer, SlidersHorizontal, SkipForward, LayoutDashboard, ClipboardList, Flag, Bell, FolderTree, ListTree, Package, LayoutTemplate, Truck, Globe, Megaphone, MessageSquare, Users, Search, Sun, Moon, Database, Home, Menu as MenuIcon, ScanLine, Plus, ChevronLeft, User, Camera, Image as ImageIcon, Paperclip, Send, Star, Pencil, Sparkles, HelpCircle, Download, Lock as LockIcon, AlertTriangle, Inbox, FileText, ShieldAlert, Tag, Layers, BookOpen, Filter, Check, X, Ruler, Boxes } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// QCteam — controller mobile app (prototype) — shares the state format with the Head portal
// Model: Categories (single-parent, 2 poziomy) · ProblemType (global katalog,
// self-ref, tolerance kaskadowa) · Products + ProductSpecification ·
// FormTemplate (Global/Category/Product) → FormModule → FormField / FormModuleProblem ·
// ProblemToleranceOverride per szablon · Summary zawsze ostatnie.
// ═══════════════════════════════════════════════════════════════════════════

const LIGHT = {
  bg: "#DEE4DA", surface: "#EBEFE8", ink: "#182219", muted: "#5C6960", line: "#C4CCC6",
  accent: "#1F5C3E", accentSoft: "rgba(31,92,62,.09)",
  warn: "#9C6A1E", warnBg: "rgba(156,106,30,.10)",
  ok: "#1F6B45", okBg: "rgba(31,107,69,.10)",
  bad: "#A63D3D", badBg: "rgba(166,61,61,.09)",
  onDark: "#FFFFFF", onDarkMuted: "rgba(255,255,255,.7)", onDarkSoft: "rgba(255,255,255,.2)", frameBg: "#D6DCD2",
};
const DARK = {
  bg: "#0F1512", surface: "#161D19", ink: "#E7ECE8", muted: "#8E9C93", line: "#263129",
  accent: "#8CD3A6", accentSoft: "rgba(140,211,166,.12)",
  warn: "#E2B76B", warnBg: "rgba(226,183,107,.12)",
  ok: "#8CD3A6", okBg: "rgba(140,211,166,.12)",
  bad: "#F0918A", badBg: "rgba(240,145,138,.12)",
  onDark: "#0E1411", onDarkMuted: "rgba(14,20,17,.7)", onDarkSoft: "rgba(14,20,17,.15)", frameBg: "#080B09",
};
const C = { ...LIGHT };
const applyTheme = dark => { Object.assign(C, dark ? DARK : LIGHT); };
const THEME_KEY = "qcteam-theme";
const PHOTO_BG = "#E9EDDE";

// Icons (lucide) — one size, one stroke width
const Ic = ({ i: I, s = 15, mr = 6, style }) => <I size={s} strokeWidth={2} style={{ display: "inline-block", verticalAlign: "-3px", marginRight: mr, flexShrink: 0, ...style }} />;
const Avatar = ({ user, size = 28, onPick }) => { const initials = (user?.name || "?").split(" ").map(x => x[0]).join("").slice(0, 2); const el = user?.photoUrl ? <img src={user.photoUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} /> : <div className="rounded-full flex items-center justify-center font-medium" style={{ width: size, height: size, background: C.accentSoft, color: C.accent, fontSize: size * .4 }}>{initials}</div>; return onPick ? <button onClick={async () => { const { out } = await pickPhotos(); if (out[0]) onPick(out[0].dataUrl); }} title="Users.PhotoUrl — change photo" className="relative">{el}<span className="absolute -bottom-1 -right-1 rounded-full flex items-center justify-center" style={{ width: 16, height: 16, background: C.ink, color: C.onDark }}><Ic i={Camera} s={9} mr={0} /></span></button> : el; };
// Search input with a properly centred icon (the icon lives inside the input's own box, not the padded container around it).
const SearchBox = ({ value, onChange, placeholder, className = "", style = {}, inputClass = "", autoFocus, onKeyDown, size = 15 }) => (
  <div className={`relative ${className}`} style={style}>
    <span className="absolute flex items-center justify-center pointer-events-none" style={{ left: 10, top: 0, bottom: 0, width: size, color: C.muted }}><Search size={size} strokeWidth={2} style={{ display: "block" }} /></span>
    <input autoFocus={autoFocus} value={value} onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown} placeholder={placeholder} className={`w-full text-sm ${inputClass}`} style={{ paddingLeft: size + 18 }} />
  </div>
);
// Searchable product picker — an alphabetical <select> of the whole catalog (hundreds of products) is unusable on a phone.
const MProductPicker = ({ products, value, onChange, placeholder = "Search product…" }) => {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const selected = products.find(p => p.id === value);
  const qq = q.trim().toLowerCase();
  const results = (qq ? products.filter(p => (p.name + " " + (p.articleId || "")).toLowerCase().includes(qq)) : products).slice(0, 8);
  if (selected && !open) return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ border: `1px solid ${C.line}` }}>
      <span className="text-sm truncate flex-1 min-w-0">{selected.name}</span>
      <button onClick={() => { setQ(""); setOpen(true); }} className="text-xs flex-shrink-0 ml-2" style={{ color: C.accent }}>change</button>
    </div>
  );
  return (
    <div>
      <SearchBox autoFocus={open} value={q} onChange={v => { setQ(v); setOpen(true); }} placeholder={placeholder} inputClass="rounded-xl py-2.5" />
      <div className="rounded-xl mt-1.5 overflow-hidden" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>
        {results.length === 0 ? <p className="text-xs px-3 py-2.5" style={{ color: C.muted }}>No matches.</p> : results.map(p => (
          <button key={p.id} onClick={() => { onChange(p.id); setQ(""); setOpen(false); }} className="w-full text-left px-3 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <span className="block text-sm truncate">{p.name}</span>
            <span className="block text-xs truncate" style={{ color: C.muted }}>{p.articleId || "no ID"}</span>
          </button>
        ))}
        {products.length > results.length && !qq && <p className="text-xs px-3 py-2" style={{ color: C.muted, borderTop: `1px solid ${C.line}` }}>{products.length - results.length} more — keep typing to narrow it down</p>}
      </div>
    </div>
  );
};
// Searchable category picker — same pattern as MProductPicker; the category tree runs to dozens of entries too.
const MCategoryPicker = ({ categories, value, onChange, placeholder = "Search category…" }) => {
  const catPath = c => { const p = c.parentId && categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const selected = categories.find(c => c.id === value);
  const qq = q.trim().toLowerCase();
  const results = (qq ? categories.filter(c => catPath(c).toLowerCase().includes(qq)) : categories).slice(0, 8);
  if (selected && !open) return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ border: `1px solid ${C.line}` }}>
      <span className="text-sm truncate flex-1 min-w-0">{catPath(selected)}</span>
      <button onClick={() => { setQ(""); setOpen(true); }} className="text-xs flex-shrink-0 ml-2" style={{ color: C.accent }}>change</button>
    </div>
  );
  return (
    <div>
      <SearchBox autoFocus={open} value={q} onChange={v => { setQ(v); setOpen(true); }} placeholder={placeholder} inputClass="rounded-xl py-2.5" />
      <div className="rounded-xl mt-1.5 overflow-hidden" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>
        {results.length === 0 ? <p className="text-xs px-3 py-2.5" style={{ color: C.muted }}>No matches.</p> : results.map(c => (
          <button key={c.id} onClick={() => { onChange(c.id); setQ(""); setOpen(false); }} className="w-full text-left px-3 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
            <span className="block text-sm truncate">{catPath(c)}</span>
          </button>
        ))}
        {categories.length > results.length && !qq && <p className="text-xs px-3 py-2" style={{ color: C.muted, borderTop: `1px solid ${C.line}` }}>{categories.length - results.length} more — keep typing to narrow it down</p>}
      </div>
    </div>
  );
};
// Notification look: one lucide icon per type in a soft circle; legacy messages get their emoji stripped on display.
const NOTIF = { Exceeded: [AlertTriangle, "bad"], AcceptedDespite: [AlertTriangle, "warn"], Escalation: [HelpCircle, "warn"], Question: [MessageCircle, "info"], Answered: [MessageCircle, "ok"], Flag: [Flag, "warn"], Announcement: [Megaphone, "info"], EditedByOther: [Pencil, "info"], DeadlineWarning: [Clock, "warn"], DeadlineBreached: [AlertTriangle, "bad"], Lost: [Search, "warn"], Found: [Check, "ok"] };
const notifLook = t => { const [I, tone] = NOTIF[t] || [Bell, "info"]; const fg = tone === "bad" ? C.bad : tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.accent; const bg = tone === "bad" ? C.badBg : tone === "warn" ? C.warnBg : tone === "ok" ? C.okBg : C.accentSoft; return { I, fg, bg }; };
const cleanMsg = m => String(m || "").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
const NotifIcon = ({ type, size = 32 }) => { const { I, fg, bg } = notifLook(type); return <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: bg, color: fg }}><I size={Math.round(size * 0.5)} strokeWidth={2} /></span>; };
const Dot = ({ on }) => <span className="inline-block rounded-full ml-2 align-middle" style={{ width: 7, height: 7, background: on ? C.ok : C.line }} />;
const NAV_ICON = { blocked: LockIcon, integrations: Link2, lists: ListIcon, analytics: BarChart3, settings: SlidersHorizontal, dashboard: LayoutDashboard, inspections: ClipboardList, flags: Flag, notifications: Bell, categories: FolderTree, problems: ListTree, products: Package, forms: LayoutTemplate, suppliers: Truck, countries: Globe, announcements: Megaphone, messages: MessageSquare, users: Users, catalog: Package, home: Home, chat: MessageSquare, menu: MenuIcon };
const EMPTY_ICON = { "📁": FolderTree, "🌳": ListTree, "📦": Package, "🧩": LayoutTemplate, "📖": BookOpen, "📏": Ruler, "📋": ClipboardList, "🚩": Flag, "🔔": Bell, "📣": Megaphone, "💬": MessageSquare, "🔒": LockIcon };


const GLOBAL_CSS = () => `
  :root{color-scheme:${C.bg === DARK.bg ? "dark" : "light"}}
  .qc *{box-sizing:border-box}
  .qc{font-family:"SF Pro Text","Segoe UI Variable",-apple-system,system-ui,"Helvetica Neue",Arial,sans-serif;font-size:14px;line-height:1.45;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
  .qc h1{font-size:22px;line-height:1.2;letter-spacing:-.015em;font-weight:650;margin:0}
  .qc h2{font-size:17px;line-height:1.3;letter-spacing:-.01em;font-weight:600;margin:0}
  .qc input:not([type=checkbox]):not([type=radio]),.qc select,.qc textarea{font:inherit;color:${C.ink};background:${C.surface};border:1px solid ${C.line};border-radius:10px;min-height:36px;padding:7px 10px;transition:border-color .12s,box-shadow .12s;outline:none;-webkit-appearance:none;appearance:none}
  .qc select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${encodeURIComponent(C.muted)}' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px}
  .qc input[type=checkbox],.qc input[type=radio]{-webkit-appearance:auto;appearance:auto;min-height:0;width:16px;height:16px;padding:0;accent-color:${C.accent};border-radius:4px}
  .qc input:focus,.qc select:focus,.qc textarea:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentSoft}}
  .qc input::placeholder,.qc textarea::placeholder{color:${C.muted};opacity:.9}
  .qc button{font:inherit;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s,transform .06s}
  .qc button:active{transform:translateY(1px)}
  .qc button:disabled{cursor:not-allowed;opacity:.6}
  .qc button:focus-visible,.qc a:focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
  .qc .label-sm{font-size:11.5px;font-weight:600;color:${C.muted};letter-spacing:0;text-transform:none}
  .qc .row:hover{background:${C.bg}}
  .qc ::-webkit-scrollbar{width:10px;height:10px}.qc ::-webkit-scrollbar-thumb{background:${C.line};border-radius:8px;border:2px solid transparent;background-clip:padding-box}
  @media (prefers-reduced-motion:reduce){.qc *{transition:none!important}}
`;

const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = n => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
const inp = { get border() { return `1px solid ${C.line}`; }, get backgroundColor() { return C.surface; }, get color() { return C.ink; } };
const FIELD_TYPES = [["Text", "Text"], ["Number", "Number"], ["SingleChoice", "Single choice"], ["List", "Choice from list"], ["MultiChoice", "Multiple choice"], ["Date", "Date"], ["Scale", "Scale"]];
// Klocki system: Head umieszcza je w module jak pola, ale nie konfiguruje — system renderuje i zapisuje w kolumnach Inspections/InspectionPallet/InspectionPhoto.
const SYSTEM_TYPES = {
  ProductInfo: { label: "Product info", desc: "read-only header: name, bio, specs — can sit at the top of every module", once: false },
  Supplier: { label: "Supplier", desc: "choice from suppliers assigned to the product → Inspections.SupplierId", once: true },
  Variety: { label: "Variety", desc: "choice from varieties defined on the product → Inspections.VarietyId", once: true },
  Pallet: { label: "Pallet numbers", desc: "one or more pallets → InspectionPallet (scanning in extension)", once: true },
  DateCode: { label: "Packing date", desc: "date → ISO week code + day → Inspections.DateCode", once: true },
  SampleSize: { label: "Sample size", desc: "TU × CU/TU × pcs/CU × weight — defaults from product, overridable → Inspections.Sample*", once: true },
  Photos: { label: "Module photos", desc: "camera, general photos of this module → InspectionPhoto.ModuleId", once: false },
  Escalate: { label: "Ask the Head", desc: "pauses the inspection (Status=Draft) and sends a notification", once: true },
};
const isSystem = t => !!SYSTEM_TYPES[t];
// Basis conversion: a spec may be per piece or per CU; a field may measure per piece or per CU. Limits are converted through pieces-per-CU.
const specBasis = q => q?.basis || "piece"; const fieldBasis = f => f?.measureBasis || "piece";
const limitsFor = (spec, f, piecesPerCu) => { const mn = spec ? spec.min : f.min, mx = spec ? spec.max : f.max; if (!spec) return { min: mn, max: mx, factor: 1, note: "" }; const sb = specBasis(spec), fb = fieldBasis(f); if (sb === fb) return { min: mn, max: mx, factor: 1, note: "" }; const n = Number(piecesPerCu) || 0; if (!n) return { min: mn, max: mx, factor: 1, note: `spec is per ${sb}, you measure per ${fb} — pieces per CU unknown, comparing as is` }; const factor = sb === "piece" && fb === "cu" ? n : 1 / n; const cv = v => hasV(v) ? String(Math.round(Number(v) * factor * 1000) / 1000) : v; return { min: cv(mn), max: cv(mx), factor, note: `spec ${specLabel(spec)}/${sb} → ${specLabel({ min: cv(mn), max: cv(mx), unit: spec.unit })} per ${fb} (${n} pcs/CU)` }; };
const slugKey = str => (str || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const metricKey = f => f.key || slugKey(f.specName || f.label);
// Fields created in the builder default to label "New field" until the Head renames them — easy to miss when they
// instead fill in "specification by name" and never touch the label box above it. Falls back to the spec name so the
// field still shows something meaningful on screen and in the PDF instead of the literal placeholder.
const fieldLabel = f => { const l = (f.label || "").trim(); return (l && l.toLowerCase() !== "new field") ? l : ((f.specName || "").trim() || l || "New field"); };
const STATUS = { Draft: ["Draft", C.muted, C.line], PendingReview: ["Awaiting Head", C.warn, C.warnBg], Completed: ["Completed", C.ok, C.okBg], Cancelled: ["Cancelled", C.muted, C.line] };
const nowISO = () => new Date().toISOString();
const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
const truncate = (t, n = 70) => t && t.length > n ? t.slice(0, n).trimEnd() + "…" : t;

// ── Pomocnicze na drzewach ──────────────────────────────────────────────────
const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
const kidsOf = (arr, id) => arr.filter(x => x.parentId === id);
const isLeaf = (arr, id) => kidsOf(arr, id).length === 0;
const depthOf = (arr, id) => { const m = byId(arr); let d = 0, n = m[id]; while (n?.parentId) { d++; n = m[n.parentId]; } return d; };
const pathOf = (arr, id) => { const m = byId(arr); const o = []; let n = m[id]; while (n) { o.unshift(n.name); n = m[n.parentId]; } return o.join(" › "); };
const subtree = (arr, id) => { const s = new Set([id]); let g = true; while (g) { g = false; arr.forEach(x => { if (x.parentId && s.has(x.parentId) && !s.has(x.id)) { s.add(x.id); g = true; } }); } return s; };
// Reference guide (knowledge base): a Head-curated note (description + photos) per product×problem-type, so controllers
// know what a given remark actually looks like. Only leaf problem types get notes — those are what's reported against.
const noteFor = (notes, problemId) => (notes || []).find(n => n.problemId === problemId);
const hasNoteContent = n => !!(n && (n.description || "").trim() || asPhotoList(n?.photos).length);

// Tolerancja: najpierw nadpisanie w szablonie, potem katalog; up drzewa.
const effTol = (problems, overrides, id) => {
  const m = byId(problems), ov = Object.fromEntries((overrides || []).map(o => [o.problemTypeId, o.tolerance]));
  let n = m[id];
  while (n) {
    if (ov[n.id] !== undefined && ov[n.id] !== null && ov[n.id] !== "") return Number(ov[n.id]);
    if (n.tolerance !== null && n.tolerance !== "" && n.tolerance !== undefined) return Number(n.tolerance);
    n = m[n.parentId];
  }
  return null;
};
const presenceIn = (problems, remarks, id) => { const sub = subtree(problems, id); return remarks.some(r => r.mode === "Presence" && sub.has(r.leafId)); };
const pct = (r, totals) => { if (r.mode === "Presence") return 0; const raw = Number(r.raw) || 0; const base = r.mode === "PieceCount" ? totals.pieces : r.mode === "DirectWeight" ? totals.weight : totals.cu; return base ? raw / base * 100 : 0; };
const aggregate = (problems, remarks, id, totals) => { const s = subtree(problems, id); return remarks.filter(r => s.has(r.leafId)).reduce((a, r) => a + pct(r, totals), 0); };
const statusOf = (problems, overrides, remarks, id, totals) => {
  const t = effTol(problems, overrides, id), a = aggregate(problems, remarks, id, totals), pr = presenceIn(problems, remarks, id);
  if (pr && t === 0) return "exceeded";
  if (t === null) {
    // An aggregate category with no tolerance of its own (e.g. "Quality problems", summing unrelated % types) used to
    // cap at "flagged" (orange) no matter how bad a child was — one leaf could be way over its own tolerance and the
    // category bar would still show orange, never red. It now inherits "exceeded" from any child that is.
    if (problems.some(k => k.parentId === id && statusOf(problems, overrides, remarks, k.id, totals) === "exceeded")) return "exceeded";
    return a > 0 || pr ? "flagged" : "clean";
  }
  return a > t ? "exceeded" : a > 0 || pr ? "flagged" : "clean";
};
const tone = s => s === "exceeded" ? [C.bad, C.badBg] : s === "flagged" ? [C.warn, C.warnBg] : [C.ok, C.okBg];

// ProductSpecification: MinValue / MaxValue (at least one). The "bad when" direction follows from what is set.
const hasV = v => v !== null && v !== undefined && v !== "";
const basisTag = q => q?.basis === "cu" ? " /CU" : "";
const specLabel = q => { const mn = hasV(q.min), mx = hasV(q.max); const core = mn && mx ? `${q.min}–${q.max}` : mn ? `min ${q.min}` : mx ? `max ${q.max}` : "—"; return `${core} ${q.unit || ""}`.trim(); };
// Specification cascade by name: product → category → parent category
const effectiveSpecs = (s, product) => {
  if (!product) return [];
  const out = (product.specs || []).map(q => ({ ...q, source: "product" }));
  const key = q => `${(q.name || "").trim().toLowerCase()}|${specBasis(q)}`;
  const seen = new Set(out.map(key));
  const excluded = new Set((product.excludedSpecNames || []).map(x => x.trim().toLowerCase()));
  let cat = s.categories.find(c => c.id === product.categoryId);
  while (cat) {
    (cat.specs || []).forEach(q => { const k = key(q); if (!seen.has(k)) { seen.add(k); if (!excluded.has((q.name || "").trim().toLowerCase())) out.push({ ...q, source: `category ${cat.name}` }); } });
    cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null;
  }
  return out;
};
// Problem nodes have a scope: none (global), categoryId or productId. Effective tree = global + category chain + product, minus hidden, no orphans.
const categoryChainIds = (s, categoryId) => { const out = []; let c = s.categories.find(x => x.id === categoryId); while (c) { out.push(c.id); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } return out; };
const annMatchesProduct = (s, a, product) => (a.productId && a.productId === product.id) || (a.categoryId && product.categoryId && categoryChainIds(s, product.categoryId).includes(a.categoryId));
const problemsFor = (s, scope, suppressed) => {
  const chain = scope.kind === "Product" ? categoryChainIds(s, s.products.find(p => p.id === scope.id)?.categoryId) : scope.kind === "Category" ? categoryChainIds(s, scope.id) : [];
  const pid = scope.kind === "Product" ? scope.id : null;
  const hidden = new Set(suppressed ? [...suppressed] : []);
  chain.forEach(cid => (s.categories.find(c => c.id === cid)?.hiddenProblemIds || []).forEach(id => hidden.add(id)));
  if (pid) (s.products.find(p => p.id === pid)?.hiddenProblemIds || []).forEach(id => hidden.add(id));
  let list = s.problems.filter(p => !hidden.has(p.id) && ((!p.categoryId && !p.productId) || (p.categoryId && chain.includes(p.categoryId)) || (p.productId && p.productId === pid)));
  let changed = true; while (changed) { const ids = new Set(list.map(p => p.id)); const next = list.filter(p => !p.parentId || ids.has(p.parentId)); changed = next.length !== list.length; list = next; }
  return list;
};
const scopeTag = (p, s) => p.productId ? `product: ${s.products.find(x => x.id === p.productId)?.name ?? "?"}` : p.categoryId ? `kat. ${s.categories.find(x => x.id === p.categoryId)?.name ?? "?"}` : null;
// Required inspection level: Full (raport) < Visual (visual is enough) < Skip (can be skipped). Product → category → system setting.
// Inspection types are Head-defined (InspectionTypes). Behaviour comes from flags, not from the name.
// No default inspection types: the Head defines them (Forms → + new type). Legacy ids below only keep old records readable.
const SEED_TYPES = () => [];
const SKIP_REASONS = ["no time", "stable product", "same delivery as earlier", "checked at the supplier"];
const typesOf = s => [...(s.inspectionTypes || [])].sort((a, b) => a.sort - b.sort);
const typeById = (s, id) => (s.inspectionTypes || []).find(t => t.id === id) || null;
const legacyTypeId = t => t === "Visual" ? "type-visual" : t === "Skip" ? "type-skip" : "type-full";
const inspType = (s, insp) => typeById(s, insp.typeId || legacyTypeId(insp.type)) || { id: "type-full", name: "Full", color: "#1F5C3E", autoAccept: false, countsAsInspection: true, reason: "none" };
const countsAs = (s, insp) => inspType(s, insp).countsAsInspection !== false;
const isVerdictType = (s, insp) => !inspType(s, insp).autoAccept;
const settingsOf = s => ({ companyName: "Picnic Technologies", qcEmail: "qc@picnic.nl", rejectionWindowHours: 24, deadlineWarnHours: 6, deadlineWarnHoursRisky: 10, riskyLookbackDays: 14, ...(s.settings || {}) });
// Policy = the set of allowed inspection types. Product → category chain → types allowed by default. A product always has one.
const effectivePolicy = (s, product) => {
  const dflt = typesOf(s).filter(t => t.allowedByDefault).map(t => t.id);
  if (!product) return { typeIds: dflt, source: "default" };
  if (Array.isArray(product.allowedTypeIds)) return { typeIds: product.allowedTypeIds, source: "product" };
  let cat = s.categories.find(c => c.id === product.categoryId);
  while (cat) { if (Array.isArray(cat.allowedTypeIds)) return { typeIds: cat.allowedTypeIds, source: `category ${cat.name}` }; cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null; }
  return { typeIds: dflt, source: "default (type settings)" };
};
const policyAllows = (pol, typeId) => (pol.typeIds || []).includes(typeId);
const allowedTypes = (s, product) => { const pol = effectivePolicy(s, product); return typesOf(s).filter(t => pol.typeIds.includes(t.id)); };
// Product attributes from lists (ProductAttribute: DictionaryId + DictionaryItemId, on category or product). Product overrides category; category chain upward.
const effectiveAttributes = (s, product) => {
  if (!product) return [];
  const dicts = byId(s.dictionaries || []); const out = []; const seen = new Set();
  const push = (a, source) => { if (seen.has(a.dictionaryId)) return; const d = dicts[a.dictionaryId]; const it = d?.items.find(x => x.id === a.itemId); if (!d) return; seen.add(a.dictionaryId); out.push({ dictionaryId: a.dictionaryId, itemId: a.itemId, list: d.name, value: it?.value || "—", source }); };
  (product.attributes || []).forEach(a => push(a, "product"));
  let cat = s.categories.find(c => c.id === product.categoryId);
  while (cat) { (cat.attributes || []).forEach(a => push(a, `category ${cat.name}`)); cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null; }
  return out;
};
// Specification name registry (SpecificationDefinitions): every name used on a category, product or measurement field,
// with its most common unit. Used to suggest, canonicalise spelling and catch near-duplicates ("Brixx" vs "Brix").
const specRegistry = s => {
  const m = new Map();
  const add = (name, unit) => { const k = (name || "").trim().toLowerCase(); if (!k) return; const e = m.get(k) || { name: name.trim(), units: {}, uses: 0 }; e.uses++; if (unit) e.units[unit] = (e.units[unit] || 0) + 1; m.set(k, e); };
  (s.categories || []).forEach(c => (c.specs || []).forEach(q => add(q.name, q.unit)));
  (s.products || []).forEach(p => (p.specs || []).forEach(q => add(q.name, q.unit)));
  (s.templates || []).forEach(t => (t.fields || []).forEach(f => { if (f.type === "Number") add(f.specName || f.label, null); }));
  return [...m.values()].map(e => ({ ...e, unit: Object.entries(e.units).sort((a, b) => b[1] - a[1])[0]?.[0] || "" })).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
};
const editDistance = (a, b) => { a = a.toLowerCase(); b = b.toLowerCase(); const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
const canonicalSpecName = (s, name) => { const k = (name || "").trim().toLowerCase(); const hit = specRegistry(s).find(e => e.name.toLowerCase() === k); return hit ? hit.name : (name || "").trim(); };
const nearSpecName = (s, name) => { const n = (name || "").trim(); if (n.length < 3) return null; const reg = specRegistry(s); if (reg.some(e => e.name.toLowerCase() === n.toLowerCase())) return null; return reg.find(e => editDistance(e.name, n) <= Math.max(1, Math.floor(n.length / 4))) || null; };
const effectiveVarieties = (s, product) => {
  if (!product) return [];
  const out = (product.varieties || []).map(v => ({ ...v, source: "product" }));
  const seen = new Set(out.map(v => (v.name || "").trim().toLowerCase()));
  let cat = s.categories.find(c => c.id === product.categoryId);
  while (cat) {
    (cat.varieties || []).forEach(v => { const k = (v.name || "").trim().toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push({ ...v, source: `category ${cat.name}` }); } });
    cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null;
  }
  return out;
};
const outOfRange = (avg, mn, mx) => (hasV(mn) && avg < Number(mn)) || (hasV(mx) && avg > Number(mx));

// Date code: ISO week (1–53) + weekday (Mon=1 … Sun=7), e.g. 2026-09-14 → "381"
const dateCode = iso => {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return null;
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${week}${day}`;
};

// Template cascade: product → category (and its parent) → global
// ── Template layers: global → parent category → category → product ─────
// No copying. Each level contributes only differences: own items, hidden
// parent items (suppressed) and overrides of parent fields (fieldOverrides).
const layerChain = (s, scope, typeId = "type-full") => {
  const T = s.templates.filter(t => (t.typeId || "type-full") === typeId), chain = [];
  const g = T.find(t => t.scope === "Global"); if (g) chain.push(g);
  let catId = scope.kind === "Category" ? scope.id : scope.kind === "Product" ? s.products.find(p => p.id === scope.id)?.categoryId : null;
  const cats = [];
  while (catId) { const c = s.categories.find(x => x.id === catId); if (!c) break; cats.unshift(c); catId = c.parentId; }
  cats.forEach(c => { const t = T.find(x => x.scope === "Category" && x.categoryId === c.id); if (t) chain.push(t); });
  if (scope.kind === "Product") { const t = T.find(x => x.scope === "Product" && x.productId === scope.id); if (t) chain.push(t); }
  return chain;
};
const ownTemplate = (s, scope, typeId = "type-full") => { const T = s.templates.filter(t => (t.typeId || "type-full") === typeId); return scope.kind === "Global" ? T.find(t => t.scope === "Global")
  : scope.kind === "Category" ? T.find(t => t.scope === "Category" && t.categoryId === scope.id)
  : T.find(t => t.scope === "Product" && t.productId === scope.id); };
const levelLabel = (t, s) => t.scope === "Global" ? "global" : t.scope === "Category" ? `kat. ${s.categories.find(c => c.id === t.categoryId)?.name ?? "?"}` : `product`;

// Composition: the result has the shape of a plain template + origin metadata.
const compose = (s, chain) => {
  const eff = { id: chain.map(t => t.id).join("+"), modules: [], fields: [], problemRefs: [], overrides: [], suppressed: new Set(), levels: chain.map(t => t.id) };
  chain.forEach((t, li) => {
    (t.suppressed || []).forEach(id => eff.suppressed.add(id));
    (t.modules || []).forEach(m => eff.modules.push({ ...m, ownerId: t.id, ownerLabel: levelLabel(t, s), level: li }));
    (t.fields || []).forEach(f => eff.fields.push({ ...f, ownerId: t.id, ownerLabel: levelLabel(t, s), level: li }));
    (t.problemRefs || []).forEach(r => eff.problemRefs.push({ ...r, ownerId: t.id, ownerLabel: levelLabel(t, s), level: li }));
    eff.overrides.push(...(t.overrides || []));
    Object.entries(t.fieldOverrides || {}).forEach(([fid, patch]) => { const it = eff.fields.find(x => x.id === fid) || eff.modules.find(x => x.id === fid) || eff.problemRefs.find(x => x.id === fid); if (it) { const { sort, ...rest } = patch; Object.assign(it, patch); if (Object.keys(rest).length) Object.assign(it, { overriddenBy: t.id, overriddenLabel: levelLabel(t, s) }); } });
  });
  const hidden = eff.suppressed;
  const visModules = eff.modules.filter(m => !hidden.has(m.id));
  const visModIds = new Set(visModules.map(m => m.id));
  eff.allModules = eff.modules; eff.allFields = eff.fields; eff.allRefs = eff.problemRefs;
  eff.modules = visModules;
  eff.fields = eff.fields.filter(f => !hidden.has(f.id) && visModIds.has(f.moduleId));
  eff.problemRefs = eff.problemRefs.filter(r => !hidden.has(r.id) && visModIds.has(r.moduleId));
  return eff;
};
const t_refsInModule = (eff, mid) => eff.problemRefs.filter(r => r.moduleId === mid);
const bySort = (a, b) => (a.sort - b.sort) || ((a.level ?? 0) - (b.level ?? 0)) || String(a.id).localeCompare(String(b.id));
const resolveTemplate = (s, product, typeId = "type-full") => { if (!product) return null; const chain = layerChain(s, { kind: "Product", id: product.id }, typeId); return chain.length ? compose(s, chain) : null; };
const scopeLabel = (t, categories, products) => !t ? "—" : t.scope === "Global" ? "szablon global" : t.scope === "Category" ? `category „${categories.find(c => c.id === t.categoryId)?.name}"` : `product „${products.find(p => p.id === t.productId)?.name}"`;
const chainLabel = (chain, s) => chain.map(t => levelLabel(t, s)).join(" + ");
const emptyTemplate = (scope, extra) => ({ id: uid(), scope, typeId: "type-full", ...extra, modules: [], fields: [], problemRefs: [], overrides: [], suppressed: [], fieldOverrides: {}, layered: true });

// ── Migration of old copies to layers: what matches the parent → inherited; the rest → own ──
const migrateLayered = s => {
  const T = s.templates || [];
  if (!T.length || T.every(t => t.layered)) return s;
  const norm = x => (x || "").trim().toLowerCase();
  const out = []; const done = [];
  const order = [...T.filter(t => t.scope === "Global"), ...T.filter(t => t.scope === "Category"), ...T.filter(t => t.scope === "Product")];
  for (const t of order) {
    if (t.layered) { out.push(t); done.push(t); continue; }
    if (t.scope === "Global") { out.push({ ...t, suppressed: [], fieldOverrides: {}, layered: true }); done.push(out[out.length - 1]); continue; }
    const tmp = { ...s, templates: done };
    const scope = t.scope === "Category" ? { kind: "Category", id: t.categoryId } : { kind: "Product", id: t.productId };
    const parent = compose(tmp, layerChain(tmp, scope));
    const nt = { ...t, modules: [], fields: [], problemRefs: [], suppressed: [], fieldOverrides: {}, layered: true };
    const modMap = {};
    (t.modules || []).forEach(m => { const pm = parent.modules.find(x => norm(x.name) === norm(m.name)); if (pm) modMap[m.id] = pm.id; else { modMap[m.id] = m.id; nt.modules.push(m); } });
    parent.modules.forEach(pm => { if (!(t.modules || []).some(m => norm(m.name) === norm(pm.name))) nt.suppressed.push(pm.id); });
    const usedParentFields = new Set(), usedParentRefs = new Set();
    (t.fields || []).forEach(f => {
      const mid = modMap[f.moduleId]; const pf = parent.fields.find(x => x.moduleId === mid && x.type === f.type && norm(x.label) === norm(f.label) && !usedParentFields.has(x.id));
      if (pf) { usedParentFields.add(pf.id); const patch = {}; ["specId", "specName", "problemBelowId", "problemAboveId", "required", "allowPhotos"].forEach(k => { if ((f[k] ?? null) !== (pf[k] ?? null) && f[k] !== undefined) patch[k] = f[k]; }); if (Object.keys(patch).length) nt.fieldOverrides[pf.id] = patch; }
      else nt.fields.push({ ...f, moduleId: mid });
    });
    parent.fields.forEach(pf => { if (!usedParentFields.has(pf.id) && !nt.suppressed.includes(pf.moduleId)) nt.suppressed.push(pf.id); });
    (t.problemRefs || []).forEach(r => { const mid = modMap[r.moduleId]; const pr = parent.problemRefs.find(x => x.moduleId === mid && x.problemTypeId === r.problemTypeId && !usedParentRefs.has(x.id)); if (pr) usedParentRefs.add(pr.id); else nt.problemRefs.push({ ...r, moduleId: mid }); });
    parent.problemRefs.forEach(pr => { if (!usedParentRefs.has(pr.id) && !nt.suppressed.includes(pr.moduleId)) nt.suppressed.push(pr.id); });
    out.push(nt); done.push(nt);
  }
  return { ...s, templates: out };
};

// ═══════════════════ PHOTOS: pick from disk, shrink, thumbnail strip ═══════════════════
// In the real system: file → upload to server → InspectionPhoto.FilePath; the UI shows a thumbnail once upload completes.
// In the prototype: file → shrink in browser → data URL in state. HEIC (iPhone) can't be decoded by canvas → original if small.
const readAsDataUrl = file => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(file); });
const shrinkImage = file => new Promise(res => {
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => { try { const max = 720, k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.72)); } catch (e) { URL.revokeObjectURL(url); res(null); } };
  img.onerror = () => { URL.revokeObjectURL(url); res(null); };
  img.src = url;
});
// iOS quirk: a detached <input type=file> can be garbage-collected while the picker converts several HEIC photos,
// so its change event never fires. Keep the input in the document (hidden) until the selection is processed.
let _pickerEl = null;
const mountPicker = i => { if (_pickerEl) _pickerEl.remove(); i.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0"; document.body.appendChild(i); _pickerEl = i; };
const unmountPicker = i => { i.remove(); if (_pickerEl === i) _pickerEl = null; };
const pickPhotos = (opts = {}) => new Promise(res => {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,.heic,.heif"; i.multiple = !opts.capture; if (opts.capture) i.setAttribute("capture", "environment");
  mountPicker(i);
  i.onchange = async () => {
    const out = [], failed = [];
    for (const f of Array.from(i.files || [])) {
      let d = await shrinkImage(f);
      if (!d && f.size <= 2.5 * 1024 * 1024) d = await readAsDataUrl(f);   // fallback: original (e.g. HEIC in Safari)
      if (d) out.push({ id: uid(), dataUrl: d, at: nowISO(), name: f.name, size: f.size }); else failed.push(f.name);
    }
    unmountPicker(i); res({ out, failed });
  };
  i.click();
});
const asPhotoList = v => Array.isArray(v) ? v : [];
function PhotoStrip({ photos, onAdd, onRemove, size = 64, addLabel = "Add photo" }) {
  const [view, setView] = useState(null); const [busy, setBusy] = useState(false);
  const list = asPhotoList(photos);
  const [err, setErr] = useState("");
  const add = async (capture) => { setBusy(true); setErr(""); try { const { out, failed } = await pickPhotos({ capture }); if (out.length) onAdd(out); if (failed.length) setErr(`Could not load: ${failed.join(", ")} — too large or unsupported format.`); } finally { setBusy(false); } };
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {list.map(ph => <div key={ph.id} className="relative"><img src={ph.dataUrl} alt="" onClick={() => setView(ph)} className="object-cover rounded-lg cursor-pointer" style={{ width: size, height: size, border: `1px solid ${C.line}` }} />{onRemove && <button onClick={() => onRemove(ph.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] leading-none" style={{ background: C.bad, color: C.onDark }} title="delete">×</button>}</div>)}
      {busy && <div className="rounded-lg flex items-center justify-center text-[10px]" style={{ width: size, height: size, background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>uploading…</div>}
      {onAdd && touch && <button onClick={() => add(true)} disabled={busy} className="rounded-lg flex flex-col items-center justify-center text-xs" style={{ width: size, height: size, border: `1px solid ${C.accent}`, color: C.onDark, background: C.accent, gap: 2 }}><Ic i={Camera} s={size >= 56 ? 18 : 14} mr={0} />{size >= 56 && <span className="text-[10px] leading-tight">Take photo</span>}</button>}
      {onAdd && <button onClick={() => add(false)} disabled={busy} className="rounded-lg flex flex-col items-center justify-center text-xs" style={{ width: size, height: size, border: `1px dashed ${C.line}`, color: C.accent, background: C.accentSoft, gap: 2 }}><Ic i={ImageIcon} s={size >= 56 ? 18 : 14} mr={0} />{size >= 56 && <span className="text-[10px] leading-tight">{touch ? "From library" : addLabel}</span>}</button>}
      {!onAdd && list.length === 0 && <span className="text-xs" style={{ color: C.muted }}>no photos</span>}
      {err && <span className="text-xs w-full" style={{ color: C.bad }}>{err}</span>}
      {view && <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", zIndex: 60 }} onClick={() => setView(null)}><img src={view.dataUrl} alt="" className="max-w-full max-h-full rounded-xl" /><button className="absolute top-4 right-5 text-2xl" style={{ color: "#fff" }}>×</button></div>}
    </div>
  );
}

const descendantIds = (problems, rootId) => { const kids = problems.filter(p => p.parentId === rootId).map(p => p.id); return kids.reduce((acc, k) => acc.concat([k], descendantIds(problems, k)), []); };
// ═══════════════════ PDF in the browser (jsPDF from cdnjs) — same sections as the server-side generator ═══════════════════
const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"][data-loaded]`)) return res(); const el = document.createElement("script"); el.src = src; const timer = setTimeout(() => rej(new Error("Loading the PDF library timed out — this sandbox may block scripts from cdnjs.cloudflare.com.")), 10000); el.onload = () => { clearTimeout(timer); el.setAttribute("data-loaded", "1"); res(); }; el.onerror = () => { clearTimeout(timer); rej(new Error("The sandbox blocked loading " + src)); }; document.head.appendChild(el); });
const ensureJsPdf = async () => { if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"); if (!window.jspdf?.jsPDF?.API?.autoTable) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"); return window.jspdf.jsPDF; };
const hexRgb = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [0, 0, 0]; };
async function buildReportPdf(insp, s) {
  const jsPDF = await ensureJsPdf();
  const settings = settingsOf(s), product = s.products.find(p => p.id === insp.productId) || {}, t = insp.template || { fields: [], modules: [], problemRefs: [], suppressed: [] };
  const problems = problemsFor(s, { kind: "Product", id: insp.productId }, new Set(t.suppressed || []));
  const users = byId(s.users), pm = byId(problems), ctrl = users[insp.controllerId] || {};
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const category = s.categories.find(c => c.id === product.categoryId)?.name || "—";
  const ok = insp.result === "Accepted"; const INK = [24, 34, 25], MUTED = [106, 119, 110], LINE = [221, 227, 222], OK = hexRgb("#1F6B45"), BAD = hexRgb("#A63D3D"), WARN = hexRgb("#9C6A1E");
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210, L = 16, R = 194; let y = 16;
  const pageFooter = () => { const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...MUTED); doc.text(`${settings.companyName} · ${settings.qcEmail} · generated by QCteam ${new Date().toLocaleString("en-GB")}`, L, 287); doc.text(`Report ${insp.id.toUpperCase()} · page ${i}/${n}`, R, 287, { align: "right" }); } };
  // header
  doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(`${settings.companyName} · ${inspType(s, insp).name} inspection report · ${settings.qcEmail}`, L, y);
  y += 7; doc.setFontSize(17); doc.setFont(undefined, "bold"); doc.setTextColor(...INK); doc.text(product.name || "—", L, y, { maxWidth: 120 });
  y += 6; doc.setFontSize(8.5); doc.setFont(undefined, "normal"); doc.setTextColor(...MUTED); doc.text(`Article ${product.articleId || "—"} · ${category}${product.isBio ? " · bio" : ""}`, L, y);
  doc.setFillColor(...(ok ? OK : BAD)); doc.roundedRect(148, 12, 46, 14, 2, 2, "F"); doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont(undefined, "bold"); doc.text(ok ? "ACCEPTED" : "REJECTED", 191, 18, { align: "right" }); doc.setFontSize(7.5); doc.setFont(undefined, "normal"); doc.text(`Report no. ${insp.id.toUpperCase()}`, 191, 23, { align: "right" });
  y += 4; doc.setDrawColor(...INK); doc.setLineWidth(0.5); doc.line(L, y, R, y); y += 3;
  const tableBase = { margin: { left: L, right: 16 }, styles: { font: "helvetica", fontSize: 9, textColor: INK, cellPadding: 1.6, lineColor: LINE, lineWidth: { bottom: 0.2 } }, headStyles: { fillColor: [255, 255, 255], textColor: MUTED, fontStyle: "bold", fontSize: 8 }, theme: "plain" };
  // facts — only rows with a value
  const edited = insp.lastEditedBy ? ` (edited ${fmtTime(insp.lastEditedAt)} by ${users[insp.lastEditedBy]?.name || ""})` : "";
  const facts = [["Inspected", `${fmtTime(insp.completedAt)} by ${ctrl.name || "—"}${edited}`]];
  if (insp.dateISO) facts.push(["Date code", `${dateCode(insp.dateISO)} (${insp.dateISO})`]);
  if (insp.supplier) facts.push(["Supplier", insp.supplier]); if (insp.country) facts.push(["Country of origin", insp.country]); if (insp.variety) facts.push(["Variety", insp.variety]);
  if ((insp.pallets || []).filter(Boolean).length) facts.push(["Pallets", insp.pallets.filter(Boolean).join(", ")]);
  facts.push(["Sample", `${insp.sample?.tu || 0} TU × ${insp.sample?.cusPerTu || 0} CU = ${fmt(cu)} CU${totals.pieces ? ` · ${fmt(totals.pieces)} pcs` : ""}${totals.weight ? ` · ${fmt(totals.weight)} g` : ""}`]);
  doc.autoTable({ ...tableBase, startY: y, body: facts, columnStyles: { 0: { cellWidth: 38, textColor: MUTED, fontStyle: "bold", fontSize: 8 } } }); y = doc.lastAutoTable.finalY + 4;
  const h2 = txt => { if (y > 265) { doc.addPage(); y = 16; } doc.setFontSize(10.5); doc.setFont(undefined, "bold"); doc.setTextColor(...INK); doc.text(txt, L, y + 4); doc.setFont(undefined, "normal"); y += 7; };
  // quality status (referenced branches + root-level problems raised from fields)
  const refs = [...(t.problemRefs || [])].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean);
  const covered = new Set(); refs.forEach(n => { covered.add(n.id); descendantIds(problems, n.id).forEach(i => covered.add(i)); });
  const extra = []; (insp.remarks || []).forEach(r => { if (!covered.has(r.leafId) && pm[r.leafId] && !extra.includes(r.leafId)) extra.push(r.leafId); });
  const rows = [...refs, ...extra.map(i => pm[i])];
  if (rows.length) {
    h2("Quality status");
    const body = rows.map(n => { const tol = effTol(problems, t.overrides || [], n.id), agg = aggregate(problems, insp.remarks || [], n.id, totals), pr = presenceIn(problems, insp.remarks || [], n.id), st = statusOf(problems, t.overrides || [], insp.remarks || [], n.id, totals); return [n.name, tol === 0 ? (pr ? "present" : "—") : `${fmt(agg)}%`, tol === null ? "—" : `${tol}%`, st]; });
    doc.autoTable({ ...tableBase, startY: y, head: [["Problem group", "Found", "Tolerance", "Status"]], body, columnStyles: { 0: { fontStyle: "bold" }, 3: { fontStyle: "bold" } },
      didParseCell: d => { if (d.section === "body" && d.column.index === 3) { const st = d.cell.raw; d.cell.text = [st === "exceeded" ? "OVER TOLERANCE" : st === "flagged" ? "within tolerance" : "clean"]; d.cell.styles.textColor = st === "exceeded" ? BAD : st === "flagged" ? WARN : OK; } } });
    y = doc.lastAutoTable.finalY + 4;
  }
  if ((insp.remarks || []).length) {
    h2("Remarks — reason for the result");
    const body = insp.remarks.map(r => { const unit = { PieceCount: "pcs", DirectWeight: "g", WholeUnitCount: "CU" }[r.mode] || ""; const p = r.mode === "Presence" ? null : pct(r, totals); return [pathOf(problems, r.leafId), r.mode === "Presence" ? "present" : `${r.raw} ${unit}`, p === null ? "—" : `${fmt(p)}%`, r.auto ? "measurement" : "manual"]; });
    doc.autoTable({ ...tableBase, startY: y, head: [["Problem", "Quantity", "% of sample", "Source"]], body, columnStyles: { 3: { textColor: MUTED, fontSize: 8 } } }); y = doc.lastAutoTable.finalY + 4;
  }
  const answered = (t.fields || []).filter(f => !isSystem(f.type) && insp.values?.[f.id] !== undefined && insp.values?.[f.id] !== "").sort(bySort);
  if (answered.length) {
    h2("Parameters");
    const body = answered.map(f => { const v = insp.values[f.id]; let txt; if (f.type === "Number") { const nums = (v?.measurements || []).filter(x => x !== "").map(Number); txt = nums.map(fmt).join(" / ") + (nums.length > 1 ? ` — avg ${fmt(nums.reduce((a, b) => a + b, 0) / nums.length)}` : ""); } else txt = Array.isArray(v) ? v.join(", ") : String(v ?? ""); return [fieldLabel(f), txt]; });
    doc.autoTable({ ...tableBase, startY: y, body, columnStyles: { 0: { cellWidth: 52, textColor: MUTED, fontStyle: "bold", fontSize: 8 } } }); y = doc.lastAutoTable.finalY + 4;
  }
  h2("Comment"); doc.setFontSize(9.5); doc.setTextColor(...INK); const lines = doc.splitTextToSize(insp.comment || "—", 178); doc.text(lines, L, y + 3); y += lines.length * 5 + 4;
  // photos
  const groups = []; (t.fields || []).forEach(f => { const ph = asPhotoList((insp.photos || {})[f.id]); if (ph.length) groups.push({ label: f.type === "Photos" ? `Module: ${(t.modules.find(m => m.id === f.moduleId) || {}).name || ""}` : f.label, photos: ph }); }); (insp.remarks || []).forEach(r => { const ph = asPhotoList(r.photos); if (ph.length) groups.push({ label: `Problem: ${pathOf(problems, r.leafId)}`, photos: ph }); });
  if (groups.length) { h2("Photos"); for (const g of groups) { if (y > 240) { doc.addPage(); y = 16; } doc.setFontSize(8); doc.setTextColor(...MUTED); doc.text(g.label, L, y + 3); y += 5; let x = L; for (const ph of g.photos) { if (x + 40 > R) { x = L; y += 32; } if (y > 250) { doc.addPage(); y = 16; x = L; } try { doc.addImage(ph.dataUrl, "JPEG", x, y, 40, 30); } catch (e) {} x += 43; } y += 34; } }
  if ((insp.audit || []).length) { h2("Report history"); doc.autoTable({ ...tableBase, startY: y, body: insp.audit.map(a => [a.action, `${fmtTime(a.at)} · ${users[a.userId]?.name || ""}${users[a.userId]?.email ? ` (${users[a.userId].email})` : ""}${a.details ? ` — ${a.details}` : ""}`]), columnStyles: { 0: { cellWidth: 38, textColor: MUTED, fontStyle: "bold", fontSize: 8 } } }); }
  pageFooter();
  return doc;
}
const ensurePdfJs = async () => { if (!window.pdfjsLib) { await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"); window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } return window.pdfjsLib; };
// Render the generated PDF to page images — works even where the sandbox refuses to show a PDF inline.
async function renderPdfPages(arrayBuffer, scale = 1.6) {
  const pdfjs = await ensurePdfJs(); const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise; const out = [];
  for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const vp = page.getViewport({ scale }); const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise; out.push(c.toDataURL("image/png")); }
  return out;
}
function PdfViewer({ insp, s, onClose }) {
  const [url, setUrl] = useState(null); const [err, setErr] = useState(""); const [doc, setDoc] = useState(null); const [pages, setPages] = useState(null); const [note, setNote] = useState("");
  const fileName = `QC_Report_${(s.products.find(p => p.id === insp.productId)?.name || "report").replace(/[^\w]+/g, "_")}_${insp.id.toUpperCase()}.pdf`;
  useEffect(() => { let alive = true; (async () => { try { const d = await buildReportPdf(insp, s); if (!alive) return; setDoc(d); setUrl(URL.createObjectURL(d.output("blob"))); try { const imgs = await renderPdfPages(d.output("arraybuffer")); if (alive) setPages(imgs); } catch (e) { if (alive) setNote("Preview renderer unavailable: " + (e.message || e)); } } catch (e) { setErr(String(e.message || e)); } })(); return () => { alive = false; }; }, [insp.id]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const download = () => { try { doc.save(fileName); } catch (e) { setErr("Download blocked in this sandbox — try 'Open in new tab' or the save button in the viewer toolbar."); } };
  const openTab = () => { try { const w = window.open(url, "_blank"); if (!w) setErr("Pop-up blocked — try the download link."); } catch (e) { setErr("Opening a new tab is blocked here."); } };
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "rgba(20,26,22,.92)", zIndex: 70 }}>
      <div className="flex items-center gap-3 px-4" style={{ height: 52, background: "#1a211d", color: "#fff" }}>
        <span className="text-sm font-medium">{fileName}</span><span className="text-xs" style={{ opacity: .7 }}>generated in the browser · in the real system this file comes from the server (Inspections.ReportFilePath)</span><div className="flex-1" />
        <button onClick={download} disabled={!doc} className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "#fff", color: "#111" }}>Download PDF</button>
        {url && <button onClick={openTab} className="text-sm px-3 py-2 rounded-lg" style={{ background: "#3a443d", color: "#fff" }}>Open in new tab</button>}
        {url && <a href={url} download={fileName} className="text-sm px-3 py-2 rounded-lg underline" style={{ color: "#fff" }}>direct link</a>}
        <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ background: "#3a443d", color: "#fff" }}>Close</button>
      </div>
      {err && <div className="px-4 py-2 text-sm" style={{ background: "#5a2a2a", color: "#fff" }}>{err}</div>}
      {url ? (
        <div className="flex-1 overflow-y-auto py-6" style={{ background: "#4a524d" }}>
          {pages ? pages.map((src, i) => <img key={i} src={src} alt={`page ${i + 1}`} className="block mx-auto mb-5" style={{ width: "min(210mm, 92vw)", boxShadow: "0 10px 40px rgba(0,0,0,.45)", background: "#fff" }} />) : <div className="text-center text-sm py-10" style={{ color: "#fff" }}>{note || `PDF ready (${doc ? doc.getNumberOfPages() : "…"} page(s)) — rendering preview…`}</div>}
        </div>
      ) : <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "#fff" }}>{err ? "" : "Generating PDF… (loading the library from cdnjs)"}</div>}
    </div>
  );
}

// ═══════════════════ PALLETS OF THE SAME DELIVERY (attach to this report) ═══════════════════
function DeliveryPallets({ product, insp, onAdd, compact }) {
  const rows = product ? sameDeliveryPallets(product, insp) : [];
  if (!rows.length) return null;
  const same = rows.filter(r => r.sameDay !== false && !r.poMismatch);
  const poMismatch = rows.filter(r => r.sameDay !== false && r.poMismatch);
  const other = rows.filter(r => r.sameDay === false);
  const sameDayAll = [...same, ...poMismatch];
  const known = rows.basis !== "none";
  return (
    <div className="rounded-xl mt-2 mb-2" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${sameDayAll.length ? C.accent : C.line}` }}>
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-2"><span style={{ color: C.accent }}><Ic i={Truck} s={14} mr={0} /></span><span className="text-sm flex-1"><b>More pallets of this product on the docks</b>{known ? ` — ${sameDayAll.length} from this delivery` : ""}</span>{known && sameDayAll.length > 1 && <button onClick={() => onAdd(sameDayAll.map(r => r.hu))} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>Add all {sameDayAll.length}</button>}</div>
      {rows.basis === "none" && <p className="px-3 pb-1 text-[11px]" style={{ color: C.muted }}>Enter or scan the pallet you sampled first — then I can tell which of these are from the same delivery.</p>}
      {rows.basis === "today" && <p className="px-3 pb-1 text-[11px]" style={{ color: C.muted }}>The sampled pallet isn't on the dock sheet yet — assuming today's delivery.</p>}
      {same.map(r => <div key={r.hu} className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1 min-w-0"><span className="block text-xs font-mono">HU {r.hu}</span><span className="block text-[11px]" style={{ color: C.muted }}>{r.location} · {r.onDock} on dock / {r.inBuffer} in buffer · arrived {r.arrived}{r.po ? ` · PO ${r.po}` : ""}</span></span>{known && <button onClick={() => onAdd([r.hu])} className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: C.ink, color: C.onDark }}>Add</button>}</div>)}
      {/* Same day, different PO — usually a separate order, so it's flagged rather than silently pooled in. But it's only
          a heads-up: the controller decides, and adding one is exactly as easy as any other same-day pallet. */}
      {poMismatch.length > 0 && <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}`, background: C.warnBg }}>
        <p className="text-[11px] mb-1 flex items-center" style={{ color: C.warn }}><Ic i={AlertTriangle} s={11} mr={4} />Same day, different PO ({rows.anchorPO || "?"} vs below) — likely a separate delivery:</p>
        {poMismatch.map(r => <div key={r.hu} className="flex items-center gap-2 py-1"><span className="flex-1 min-w-0"><span className="block text-xs font-mono">HU {r.hu}</span><span className="block text-[11px]" style={{ color: C.warn }}>{r.location} · PO {r.po} · arrived {r.arrived}</span></span>{known && <button onClick={() => onAdd([r.hu])} className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: C.surface, border: `1px solid ${C.warn}`, color: C.warn }}>Add</button>}</div>)}
      </div>}
      {other.length > 0 && <div className="px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><p className="text-[11px] mb-1" style={{ color: C.muted }}>Different delivery day — not part of this report:</p>{other.map(r => <p key={r.hu} className="text-[11px] font-mono" style={{ color: C.muted, opacity: .8 }}>HU {r.hu} · {r.location} · arrived {r.arrived}</p>)}</div>}
    </div>
  );
}

// ═══════════════════ INSPECTION POLICY — which types are allowed here (inherit or override) ═══════════════════
function PolicyEditor({ s, own, inherited, inheritedSource, onChange, hint }) {
  const types = typesOf(s); const overriding = Array.isArray(own); const cur = overriding ? own : inherited;
  return (
    <div>
      {hint && <p className="text-xs mb-2" style={{ color: C.muted }}>{hint}</p>}
      <div className="flex items-center gap-2 mb-2 text-xs"><span style={{ color: C.muted }}>{overriding ? "Own policy" : `Inherited — ${inheritedSource}`}</span>{overriding ? <button onClick={() => onChange(null)} className="underline" style={{ color: C.accent }}>back to inherited</button> : <button onClick={() => onChange([...inherited])} className="underline" style={{ color: C.accent }}>override here</button>}</div>
      <div className="flex flex-wrap gap-1.5">{types.map(t => { const on = cur.includes(t.id); return <button key={t.id} disabled={!overriding} onClick={() => onChange(on ? cur.filter(x => x !== t.id) : [...cur, t.id])} className="text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5" style={{ background: on ? C.surface : "transparent", color: on ? C.ink : C.muted, border: `1px solid ${on ? C.ink : C.line}`, opacity: overriding ? 1 : .8, textDecoration: on ? "none" : "line-through" }}><span className="inline-block rounded-full" style={{ width: 7, height: 7, background: t.color }} />{t.name}</button>; })}</div>
      {overriding && cur.length === 0 && <p className="text-xs mt-1" style={{ color: C.bad }}>No type allowed — controllers won't be able to inspect this at all.</p>}
    </div>
  );
}

// ═══════════════════ ATTRIBUTES FROM LISTS (category / product) ═══════════════════
function AttributeForm({ s, own, inherited, onSet, onRemove, hint }) {
  const [dictId, setDictId] = useState(""); const [itemId, setItemId] = useState("");
  const dicts = s.dictionaries || []; const d = dicts.find(x => x.id === dictId);
  const add = () => { if (!dictId || !itemId) return; onSet({ dictionaryId: dictId, itemId }); setDictId(""); setItemId(""); };
  const dictName = id => dicts.find(x => x.id === id)?.name || "?"; const itemValue = (did, iid) => dicts.find(x => x.id === did)?.items.find(i => i.id === iid)?.value || "—";
  return (
    <div>
      {hint && <p className="text-xs mb-2" style={{ color: C.muted }}>{hint}</p>}
      {dicts.length === 0 ? <p className="text-xs mb-2" style={{ color: C.warn }}>No lists yet — create one in Dictionaries → Lists (e.g. Class: I, II, IND).</p> : (
        <div className="flex gap-1.5 mb-2 flex-wrap"><select value={dictId} onChange={e => { setDictId(e.target.value); setItemId(""); }} className="text-sm" style={{ minWidth: 140 }}><option value="">— list —</option>{dicts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select><select value={itemId} onChange={e => setItemId(e.target.value)} disabled={!d} className="text-sm flex-1"><option value="">— value —</option>{(d?.items || []).map(i => <option key={i.id} value={i.id}>{i.value}</option>)}</select><Ghost onClick={add}>Set</Ghost></div>
      )}
      {(own || []).map(a => <div key={a.dictionaryId} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{dictName(a.dictionaryId)}</span><span className="font-medium">{itemValue(a.dictionaryId, a.itemId)}</span><button onClick={() => onRemove(a.dictionaryId)} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>)}
      {inherited && inherited.length > 0 && <><p className="label-sm mt-3 mb-1">inherited</p>{inherited.map(a => <div key={a.dictionaryId} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}`, opacity: .65 }}><span className="flex-1">{a.list}</span><span className="font-medium">{a.value}</span><span className="text-xs" style={{ color: C.muted }}>{a.source}</span></div>)}</>}
      {!(own || []).length && !(inherited || []).length && <p className="text-xs" style={{ color: C.muted }}>None.</p>}
    </div>
  );
}

// ═══════════════════ INTEGRATIONS — sheet column mapping (SheetIntegration + SheetColumnMapping) ═══════════════════
// The Head maps sheet columns to system targets once; the parser is data, not code. Transforms cover the messy bits.
const DOCK_TARGETS = [
  ["hu", "Handling Unit (pallet SSCC)", true], ["article", "Article ID", true], ["name", "Product name", false], ["location", "Location", false],
  ["priority", "Priority item", false], ["blocking", "Needed today (blocks picking)", false], ["skippable", "Skippable", false],
  ["arrived", "Arrival date", true], ["arrivedTime", "Arrival time", false], ["transporter", "Transporter", false], ["po", "PO ID", false],
  ["cusPerTu", "CU per TU", false], ["sortable", "Sortable", false], ["ignore", "— ignore —", false],
];
const BLOCKED_TARGETS = [["article", "Article ID (from batch / UOM)", true], ["name", "Product name", false], ["hu", "Pallet SSCC", false], ["location", "Dock location", false], ["zone", "Reach zone", false], ["pickLocation", "Pick location", false], ["deadline", "Departure deadline", false], ["wmsStatus", "WMS status", false], ["status", "QC status (Not started / Started / Completed)", false], ["date", "Date", false], ["time", "Time", false], ["ignore", "— ignore —", false]];
const targetsFor = purpose => purpose === "Products" ? PRODUCT_TARGETS : purpose === "Blocked" ? BLOCKED_TARGETS : DOCK_TARGETS;
const PRODUCT_TARGETS = [["articleId", "Article ID", true], ["name", "Product name", true], ["barcodeCu", "Barcode CU (consumer pack EAN)", false], ["barcodeTu", "Barcode TU (box / case)", false], ["cusPerTu", "CU per TU", false], ["piecesPerCu", "Pieces per CU", false], ["weightPerCu", "Weight per CU (g)", false], ["category", "Category name", false], ["ignore", "— ignore —", false]];
const TRANSFORMS = [
  ["none", "as is", v => v],
  ["number", "extract number", v => { const m = String(v).match(/-?\d+(?:[.,]\d+)?/); return m ? m[0].replace(",", ".") : ""; }],
  ["uom_article", "UOM → article (HE<id>-<n>)", v => { const m = /^[A-Z]*(\d+)-(\d+)$/.exec(String(v).trim()); return m ? m[1] : String(v).replace(/^[A-Z]+/, "").split("-")[0]; }],
  ["uom_cus", "UOM → CU per TU (after the dash)", v => { const m = /-(\d+)$/.exec(String(v).trim()); return m ? m[1] : ""; }],
  ["yesno", "Yes/No → true/false", v => /^(yes|y|true|1|tak)$/i.test(String(v).trim())],
  ["date_dmy", "date dd-mm-yyyy → ISO", v => { const m = /^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/.exec(String(v).trim()); return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : String(v).trim(); }],
  ["priority", "priority label → canonical", v => { const t = String(v).trim().toLowerCase(); if (!t) return ""; return t.startsWith("inspection due") ? "Inspection due" : t.startsWith("late") ? "Late inspection" : t.startsWith("high risk") ? "High risk" : t.startsWith("high issues") ? "High issues" : t.startsWith("now") ? "Now needed" : String(v).trim(); }],
  ["trim", "trim", v => String(v).trim()],
  ["date_iso", "ISO date-time → dd-mm-yyyy hh:mm", v => { const d = new Date(String(v).trim()); return isNaN(d) ? String(v).trim() : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }],
  ["status", "status → Not started / Started / Completed", v => { const t = String(v).trim().toLowerCase(); return t.startsWith("not") ? "Not started" : t.startsWith("start") ? "Started" : t.startsWith("compl") || t.startsWith("done") ? "Completed" : String(v).trim(); }],
];
const transformOf = k => TRANSFORMS.find(t => t[0] === k)?.[2] || (v => v);
const ALIASES = { hu: ["handlingunit", "hu", "sscc", "pallet", "palletid"], article: ["uomid", "uom", "articleid", "article", "sku", "artikel", "batch"], articleId: ["uomid", "uom", "articleid", "article", "sku", "artikel"], name: ["itemname", "productname", "name", "product", "omschrijving", "item"], location: ["location", "locatie", "stock", "dock"], priority: ["priorityitem", "priority", "prioriteit"], blocking: ["neededtoday", "urgent"], skippable: ["skippable", "skip"], arrived: ["arrivaldate", "arrival", "date", "datum"], arrivedTime: ["arrivaltime", "time", "tijd"], transporter: ["transporter", "carrier", "vervoerder"], po: ["poid", "po", "order", "ponumber"], cusPerTu: ["cupertu", "cus", "cu"], sortable: ["sortable", "sorteerbaar"], barcodeCu: ["barcodecu", "cubarcode", "eancu", "cuean", "consumerbarcode", "barcode", "ean", "gtin"], barcodeTu: ["barcodetu", "tubarcode", "eantu", "tuean", "boxbarcode", "casebarcode", "itf14", "itf", "gtin14", "tradeunitbarcode"], piecesPerCu: ["piecespercu", "pieces", "stuks"], weightPerCu: ["weightpercu", "weight", "gewicht"], category: ["category", "categorie"], status: ["qcstatus", "status", "state"], date: ["date", "datum"], time: ["time", "tijd"], zone: ["reachzone", "zone"], pickLocation: ["picklocation", "pick"], deadline: ["departuredeadline", "deadline", "departure"], wmsStatus: ["wmsstatus", "status"] };
// Two passes over the whole header: exact alias matches first (so "Priority item" beats "Priority score"), then loose matches on targets still free.
const suggestMappings = (header, rows, targets) => {
  const norm = h => h.toLowerCase().replace(/[^a-z0-9]/g, ""); const free = new Set(targets.map(t => t[0]).filter(k => k !== "ignore")); const out = header.map(h => ({ source: h, target: "ignore", transform: "none", required: false }));
  const assign = (i, k) => { const sample = rows[0]?.[i]; out[i] = { source: header[i], target: k, transform: suggestTransform(k, sample), required: !!targets.find(t => t[0] === k)?.[2] }; free.delete(k); };
  header.forEach((h, i) => { const c = norm(h); for (const k of free) if ((ALIASES[k] || []).some(a => a === c)) { assign(i, k); break; } });
  header.forEach((h, i) => { if (out[i].target !== "ignore") return; const c = norm(h); if (!c) return; for (const k of free) if ((ALIASES[k] || []).some(a => a.length > 2 && c.includes(a))) { assign(i, k); break; } });
  out.forEach((m, i) => { if (m.target === "status" && free.has("wmsStatus")) { const v = String(rows[0]?.[i] || ""); if (/^[A-Z0-9_]{6,}$/.test(v)) { out[i] = { ...m, target: "wmsStatus", transform: "none", required: false }; free.delete("wmsStatus"); free.add("status"); } } });
  return out;
};
const dedupeMappings = ms => { const seen = new Set(); return ms.map(m => { if (m.target === "ignore") return m; if (seen.has(m.target)) return { ...m, target: "ignore", required: false }; seen.add(m.target); return m; }); };
const suggestTransform = (target, sample) => target === "deadline" ? "date_iso" : target === "status" ? "status" : target === "article" || target === "articleId" ? (/^[A-Z]+\d+-\d+$/.test(String(sample || "").trim()) ? "uom_article" : "none") : target === "cusPerTu" ? (/-\d+$/.test(String(sample || "").trim()) ? "uom_cus" : "number") : target === "blocking" || target === "skippable" || target === "sortable" ? "yesno" : target === "arrived" ? "date_dmy" : target === "priority" ? "priority" : "none";
// Real sheets have a title row above the header and side panels to the right: find the header row (the one with the most
// non-empty cells among the first 10, preferring one that contains "Handling Unit"/"UOM"), then cut columns past the header's width.
const detectTable = ({ header, rows }) => {
  const all = [header, ...rows];
  let best = 0, bestScore = -1;
  all.slice(0, 10).forEach((r, i) => { const cells = r.map(c => String(c).trim()); const filled = cells.filter(Boolean).length; const bonus = cells.some(c => /handling unit|uom|item name|article|sku|ean/i.test(c) && !/:\s*$/.test(c)) ? 100 : 0; /* side-panel labels ("SKU on dock:") must not make a data row look like the header */ const score = filled + bonus; if (score > bestScore) { bestScore = score; best = i; } });
  const h = all[best].map(c => String(c).trim()); let width = h.findIndex(c => !c); if (width < 0) width = h.length; // the data table is the contiguous run of header cells from the left; side panels come after a gap
  const hdr = h.slice(0, width).map((c, i) => c || `col${i + 1}`);
  const body = all.slice(best + 1).map(r => r.slice(0, width).map(c => String(c ?? "").trim())).filter(r => r.some(Boolean));
  return { header: hdr, rows: body };
};
const parseTsv = txt => { const lines = txt.split(/\r?\n/).filter(l => l.trim()); if (!lines.length) return { header: [], rows: [] }; const sep = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ","; const header = lines[0].split(sep).map(h => h.trim()); const rows = lines.slice(1).map(l => l.split(sep)).filter(r => r.some(c => c.trim())); return { header, rows }; };
const applyMapping = (integration, header, rows) => rows.map(r => { const out = {}; const errs = []; integration.mappings.forEach(m => { if (!m.target || m.target === "ignore") return; const idx = header.indexOf(m.source); if (idx < 0) { errs.push(`missing column ${m.source}`); return; } let v; try { v = transformOf(m.transform)(r[idx] ?? ""); } catch (e) { errs.push(`${m.source}: ${e.message}`); v = ""; } if (m.required && (v === "" || v == null)) errs.push(`${m.target} empty`); out[m.target] = v; }); return { ...out, _errors: errs }; });
// rows mapped for the dock become the live PalletSnapshot; fall back to the built-in mock when nothing is mapped yet
// The sheet already computes its own totals in a side panel ("SKU on dock: 40"). Read them as they are — no re-counting with guessed rules.
const SUMMARY_LABELS = { notStarted: /^not started:?$/i, started: /^started:?$/i, completed: /^completed:?$/i, total: /^total:?$/i, urgentPallets: /^urgent pallets on dock/i, nonUrgentPallets: /^non urgent pallets on dock/i, urgentSkus: /^urgent sku on dock/i, skus: /^sku on dock/i, expected: /^sku still expected/i, skippableSkus: /^skus:?$/i, skippablePallets: /^pallets:?$/i };
const extractSummary = (header, rows) => {
  const all = [header, ...rows]; const out = {}; let skippableMode = false;
  const width = detectTable({ header, rows }).header.length; // only cells to the right of the data table are summary cells
  all.forEach(r => { r.forEach((c, i) => { if (i < width) return; const t = String(c || "").trim(); if (!t) return; if (/^skippable$/i.test(t)) { skippableMode = true; return; }
    for (const [k, re] of Object.entries(SUMMARY_LABELS)) { if (!re.test(t)) continue; if ((k === "skippableSkus" || k === "skippablePallets") && !skippableMode) continue; const val = r.slice(i + 1).map(x => String(x || "").trim()).find(x => /^\d+$/.test(x)); if (val != null && out[k] == null) out[k] = Number(val); } }); });
  return out;
};
// Rejection-deadline alerts: a pallet can only be rejected within `rejectionWindowHours` of arrival (Head-configurable,
// with a shorter/earlier threshold for products rejected recently). Pure read — no side effects; the server is what actually
// fires notifications (see server/alertlogic.mjs, kept in sync with this function by hand).
const computeDeadlineAlerts = (s, nowMs = Date.now()) => {
  const st = settingsOf(s); const out = [];
  dockRowsLive(s).forEach(r => {
    if (!r.arrived) return;
    const covered = !!completedInspectionFor(s, r.hu);
    if (covered || lostOf(s, r)) return;
    const arrivalMs = new Date(`${r.arrived}T${r.arrivedTime || "00:00"}:00`).getTime(); if (isNaN(arrivalMs)) return;
    const deadlineAt = arrivalMs + st.rejectionWindowHours * 3600000; const hoursLeft = (deadlineAt - nowMs) / 3600000;
    const product = s.products.find(p => p.articleId === r.article);
    const risky = product ? s.inspections.some(i => i.productId === product.id && i.status === "Completed" && isVerdictType(s, i) && i.result === "Rejected" && i.completedAt && (nowMs - new Date(i.completedAt).getTime()) <= st.riskyLookbackDays * 86400000) : false;
    const threshold = risky ? st.deadlineWarnHoursRisky : st.deadlineWarnHours;
    const level = hoursLeft <= 0 ? "breached" : hoursLeft <= threshold ? "warning" : null;
    if (!level) return;
    out.push({ key: `hu:${r.hu.replace(/\D/g, "").replace(/^0+/, "")}`, hu: r.hu, article: r.article, name: r.name || product?.name || r.article, location: r.location, arrivalMs, deadlineAt, hoursLeft, risky, level, productId: product?.id || null });
  });
  return out.sort((a, b) => a.hoursLeft - b.hoursLeft);
};
// Countdown tiles for pallets whose rejection window is closing: one tile per pallet, ticking, gone the moment the pallet
// is inspected (or marked lost). Tap → the pallet screen. No notifications — this IS the alert.
const fmtLeft = ms => { if (ms <= 0) return "EXPIRED"; const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`; };
function DeadlineBanner({ s, alerts, onOpen, onMessage, now = Date.now() }) {
  if (!alerts.length) return null;
  const breached = alerts.filter(a => a.level === "breached").length;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1.5"><p className="text-xs font-semibold flex items-center" style={{ color: C.bad }}><Ic i={Clock} s={13} />Rejection window closing · {alerts.length}{breached ? ` · ${breached} expired` : ""}</p></div>
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
        {alerts.map(a => { const left = a.deadlineAt - now; const urgent = left <= 3600000; return (
          <button key={a.key} onClick={() => onOpen(a)} className="text-left rounded-2xl px-3 py-2.5 flex-shrink-0 active:opacity-70" style={{ width: 150, background: left <= 0 ? C.bad : urgent ? C.badBg : C.warnBg, color: left <= 0 ? C.onDark : C.ink, border: `1px solid ${left <= 0 ? C.bad : urgent ? C.bad : C.warn}` }}>
            <p className="text-lg font-bold tracking-tight leading-none" style={{ color: left <= 0 ? C.onDark : urgent ? C.bad : C.warn, fontVariantNumeric: "tabular-nums" }}>{fmtLeft(left)}</p>
            <p className="text-xs font-medium mt-1.5 truncate">{a.name}</p>
            <p className="text-[11px] truncate" style={{ opacity: .75 }}>{a.location}{a.risky ? " · rejected recently" : ""}</p>
            {onMessage && <div className="flex items-center mt-1 text-[10px]" style={{ opacity: .85, minHeight: 14 }}><span onClick={e => { e.stopPropagation(); onMessage(a); }} className="ml-auto underline">assign</span></div>}
          </button>
        ); })}
      </div>
    </div>
  );
}
// Recent-problem history for a product: rejected Full inspections in the last `days`, with which problems came up and how often.
// This is what tells a controller "this pallet's article has been flagged before — here's what to look for."
const recentProblemsFor = (s, productId, nowMs = Date.now(), days = 14) => {
  if (!productId) return { count: 0, problems: [], lastAt: null };
  const insps = s.inspections.filter(i => i.productId === productId && i.status === "Completed" && isVerdictType(s, i) && i.result === "Rejected" && i.completedAt && (nowMs - new Date(i.completedAt).getTime()) <= days * 86400000);
  const tally = {};
  insps.forEach(i => (i.remarks || []).forEach(r => { const name = pathOf(s.problems, r.leafId).split(" › ").pop() || "?"; tally[name] = (tally[name] || 0) + 1; }));
  const problems = Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const lastAt = insps.length ? insps.map(i => i.completedAt).sort().slice(-1)[0] : null;
  return { count: insps.length, problems, lastAt };
};
// "How fresh is this?" — the sheet's own last-push time (not when this device last synced), so a stalled trigger shows up.
const sheetFreshness = s => { const live = (typeof window !== "undefined" && window.__qcSheetFresh) || {}; return (s.integrations || []).filter(i => (i.purpose === "Dock" || i.purpose === "Blocked") && (i.lastPushAt || live[i.purpose.toLowerCase()])).map(i => { const a = i.lastPushAt || "", b = live[i.purpose.toLowerCase()] || ""; return { purpose: i.purpose, at: a > b ? a : b }; }); };
const dockSummary = s => { const it = (s.integrations || []).find(i => i.purpose === "Dock" && i.rows?.length); return it?.summary || null; };
const blockedRowsLive = s => { const it = (s.integrations || []).find(i => i.purpose === "Blocked" && i.rows?.length); if (!it) return []; const seen = new Set(); return it.rows.filter(r => !r._errors?.length).map(r => ({ article: String(r.article || ""), name: r.name || "", hu: String(r.hu || "").replace(/\D/g, ""), location: r.location || "", zone: r.zone || "", pickLocation: r.pickLocation || "", deadline: r.deadline || "", wmsStatus: r.wmsStatus || "", status: r.status || "", date: r.date || "", time: r.time || "" })).filter(r => { const k = r.hu || `${r.article}|${r.location}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
const blockedSummary = s => { const it = (s.integrations || []).find(i => i.purpose === "Blocked" && i.rows?.length); return it?.summary || null; };
// Sheets repeat rows (same HU twice). One handling unit is one pallet: the first occurrence wins.
// One HU = one pallet, first occurrence wins. A row with no HU on the sheet isn't dropped — it gets a fallback key
// (article + location + arrival time) so it's still counted, just not individually scannable by SSCC.
const dedupeByHu = rows => { const seen = new Set(); return rows.filter(r => { const norm = String(r.hu || "").replace(/\D/g, "").replace(/^0+/, ""); const k = norm || `noHU:${r.article}|${r.location}|${r.arrivedTime}`; if (seen.has(k)) return false; seen.add(k); return true; }); };
const duplicateHuCount = rows => rows.length - dedupeByHu(rows).length;
// Blocked-pallet work queue (PalletClaim): who took which blocked batch, or flagged it as stacked/unreachable. Keyed by article + location
// because the blocked sheet has no handling units. Claims live in the shared state, so everyone sees them within a minute.
const claimKey = b => b.hu ? `hu:${b.hu}` : `${b.article}|${b.location}`;
const claimOf = (s, b) => (s.palletClaims || {})[claimKey(b)] || null;
const setClaim = (set, b, claim) => set(x => { const pc = { ...(x.palletClaims || {}) }; if (claim) pc[claimKey(b)] = claim; else delete pc[claimKey(b)]; return { ...x, palletClaims: pc }; });
// Lost pallets: someone moved it without scanning and nobody can find it. QC can't act until it turns up, so it stays in
// every list — dimmed, with a "lost" tag — and drops out of the deadline alerts and the big numbers. Internal for now;
// markLost() is the single place to hook an outbound message (SV / WMS) later.
const lostKey = b => { const n = String(b.hu || "").replace(/\D/g, "").replace(/^0+/, ""); return n ? `hu:${n}` : `${b.article}|${b.location}`; };
const lostOf = (s, b) => { const m = (s.lostPallets || {})[lostKey(b)]; if (!m) return null; const found = b.hu && (s.inspections || []).some(i => i.status === "Completed" && (i.completedAt || "") > m.at && (i.pallets || []).some(h => samePallet(h, b.hu))); return found ? null : m; };
const notifyHeads = (x, type, message, entityType, entityId, exceptUserId) => ({ ...x, notifications: [...(x.notifications || []), ...x.users.filter(u => u.role === "Head" && u.id !== exceptUserId).map(u => ({ id: uid(), userId: u.id, type, message, entityType, entityId, createdAt: nowISO(), readAt: null }))] });
const markLost = (set, b, user, note = "") => set(x => { const lp = { ...(x.lostPallets || {}) }; lp[lostKey(b)] = { byUserId: user.id, at: nowISO(), note: String(note || "").trim(), hu: b.hu || "", article: b.article || "", name: b.name || "", location: b.location || "" }; const pc = { ...(x.palletClaims || {}) }; delete pc[claimKey(b)]; return notifyHeads({ ...x, lostPallets: lp, palletClaims: pc }, "Lost", `${b.name || b.article} (${b.location || "?"}${b.hu ? `, HU …${String(b.hu).slice(-6)}` : ""}) marked lost by ${user.name.split(" ")[0]}${note ? ` — ${note}` : ""}`, "pallet", b.hu || lostKey(b), user.id); });
const markFound = (set, b, user) => set(x => { const lp = { ...(x.lostPallets || {}) }; if (!lp[lostKey(b)]) return x; delete lp[lostKey(b)]; return notifyHeads({ ...x, lostPallets: lp }, "Found", `${b.name || b.article} (${b.location || "?"}) found again by ${user.name.split(" ")[0]}`, "pallet", b.hu || lostKey(b), user.id); });
// Unreported pallets: left the dock sheet and were never covered by a completed report. Detected server-side
// (server/misslogic.mjs) on every dock push, independent of any open app — this client only reads and reviews the
// resulting log (s.unreportedPallets). "Reviewing" one is purely a Head record ("looked into it, here's why") —
// it never removes the incident, since the point is a permanent audit trail, not a to-do list to clear.
const unreportedList = s => [...(s.unreportedPallets || [])].sort((a, b) => (b.detectedAt || "").localeCompare(a.detectedAt || ""));
const unreportedStats = (s, now = Date.now()) => { const list = unreportedList(s); const today = new Date(now).toISOString().slice(0, 10); const weekAgo = now - 7 * 86400000;
  return { total: list.length, open: list.filter(x => !x.reviewedAt).length, today: list.filter(x => (x.detectedAt || "").slice(0, 10) === today).length, week: list.filter(x => new Date(x.detectedAt).getTime() >= weekAgo).length }; };
const reviewUnreported = (set, id, user, note = "") => set(x => ({ ...x, unreportedPallets: (x.unreportedPallets || []).map(u => u.id === id ? { ...u, reviewedAt: nowISO(), reviewedByUserId: user.id, reviewNote: String(note || "").trim() } : u) }));
const unreviewUnreported = (set, id) => set(x => ({ ...x, unreportedPallets: (x.unreportedPallets || []).map(u => u.id === id ? { ...u, reviewedAt: null, reviewedByUserId: null, reviewNote: "" } : u) }));
// QC status: from the sheet when it has one; otherwise derived from the queue (claim) and finished inspections of that pallet/article.
const blockedQueue = s => blockedRowsLive(s).map(b => { const claim = claimOf(s, b); let status = b.status; if (!status) { const done = s.inspections.some(i => i.status === "Completed" && ((b.hu && (i.pallets || []).some(h => String(h).replace(/\D/g, "").endsWith(b.hu.replace(/^0+/, "")))) || (!b.hu && (s.products.find(p => p.id === i.productId)?.articleId === b.article) && (i.completedAt || "") > (claim?.at || "1970")))); status = done ? "Completed" : claim?.status === "taken" ? "Started" : "Not started"; } return { ...b, claim, status, key: claimKey(b), lost: lostOf(s, b) }; });
const dockRowsLive = s => { const it = (s.integrations || []).find(i => i.purpose === "Dock" && i.rows?.length); if (!it) return CLEAN_START ? [] : SHEET.dock; return dedupeByHu(it.rows.filter(r => !r._errors?.length)).map(r => ({ hu: String(r.hu || "").trim(), article: String(r.article || ""), name: r.name || "", location: r.location || "", priority: r.priority || (r.skippable ? "Skippable" : "Inspection due"), blocking: !!r.blocking, skippable: !!r.skippable, arrived: r.arrived || "", arrivedTime: r.arrivedTime || "", transporter: r.transporter || "", po: r.po || "", cusPerTu: r.cusPerTu ? Number(r.cusPerTu) : null, sortable: !!r.sortable, onDock: 0, inBuffer: 0 })); };
// Shared: read what the sheet pushed to the server and refresh the matching integration inside the app state.
// Used by the portal (every 60 s on any page) and by the phone (on open / Sync now), so no device depends on the other.
const refreshPushedIntegrations = async (getState, set, force = false) => {
  if (!window.__qcServer) return;
  const s = getState(); const targets = (s.integrations || []).filter(i => i.pushMode);
  for (const target of targets) {
    try {
      const r = await fetch(`${window.__qcServer}/sheet/${target.purpose.toLowerCase()}`, { cache: "no-store" }); if (r.status !== 200) continue;
      const raw = await r.json(); if (!force && target.lastPushAt && raw.receivedAt === target.lastPushAt) continue;
      const tg = targetsFor(target.purpose); let j = detectTable({ header: raw.header, rows: raw.rows });
      // Same guard as the server (applyPushToState): if the auto-detected header lacks columns the Head mapped, try other rows
      // as the header; if still missing, keep the last good rows + mapping and flag it instead of re-guessing and wiping the dashboard.
      const needed = (target.mappings || []).filter(m => m.target && m.target !== "ignore").map(m => m.source); let missing = needed.filter(c => !j.header.includes(c));
      if (needed.length && missing.length) { const all = [raw.header, ...raw.rows]; for (let r = 0; r < Math.min(10, all.length); r++) { const h = all[r].map(c => String(c ?? "").trim()); let w = h.findIndex(c => !c); if (w < 0) w = h.length; const hdr = h.slice(0, w); if (!needed.every(c => hdr.includes(c))) continue; j = { header: hdr, rows: all.slice(r + 1).map(x => x.slice(0, w).map(c => String(c ?? "").trim())).filter(x => x.some(Boolean)) }; missing = []; break; } }
      if (needed.length && missing.length) { set(x => ({ ...x, integrations: x.integrations.map(i => i.id === target.id ? { ...i, rawHeader: raw.header, rawRows: raw.rows, lastPushAt: raw.receivedAt, needsRemap: true, liveStatus: `Sheet columns changed — ${missing.length} mapped column(s) missing (${missing.slice(0, 3).join(", ")}). Keeping the last good data; re-map here to apply new pushes.` } : i) })); continue; }
      const mappings = target.mappings.length && target.header.join("|") === j.header.join("|") ? target.mappings : (needed.length ? target.mappings : suggestMappings(j.header, j.rows, tg));
      const next = { ...target, header: j.header, sample: j.rows, mappings }; const rows = applyMapping(next, j.header, j.rows);
      // Same guard as the server: a push where (almost) every row lacks a required value right after a clean one is the sheet mid-recalculation — keep the last good rows.
      { const bad = rows.filter(r => r._errors?.length).length, prev = target.rows || [], prevBad = prev.filter(r => r._errors?.length).length; if (rows.length >= 5 && bad / rows.length >= 0.5 && prev.length >= 5 && prevBad / prev.length < 0.2) { set(x => ({ ...x, integrations: x.integrations.map(i => i.id === target.id ? { ...i, rawHeader: raw.header, rawRows: raw.rows, lastPushAt: raw.receivedAt, liveStatus: `Push at ${new Date(raw.receivedAt).toLocaleTimeString("en-GB")}: ${bad} of ${rows.length} rows had no usable value — the sheet was probably recalculating. Keeping the last good data.` } : i) })); continue; } }
      set(x => ({ ...x, integrations: x.integrations.map(i => i.id === target.id ? { ...i, header: j.header, sample: j.rows, rawHeader: raw.header, rawRows: raw.rows, mappings, needsRemap: false, rows: target.purpose !== "Products" ? rows : i.rows, summary: target.purpose !== "Products" ? extractSummary(raw.header, raw.rows) : i.summary, lastSyncAt: nowISO(), lastPushAt: raw.receivedAt, liveStatus: `OK — ${j.rows.length} rows, pushed by the sheet at ${new Date(raw.receivedAt).toLocaleTimeString("en-GB")}` } : i) }));
    } catch (e) { /* offline or server down — keep what we have */ }
  }
};
function IntegrationsPage({ s, set }) {
  const list = s.integrations || [];
  const [sel, setSel] = useState(list[0]?.id || null); const it = list.find(i => i.id === sel);
  const [paste, setPaste] = useState("");
  const targets = targetsFor(it?.purpose);
  const patchIt = ch => set(x => ({ ...x, integrations: x.integrations.map(i => i.id === sel ? { ...i, ...ch } : i) }));
  const create = purpose => { const id = uid(); set(x => ({ ...x, integrations: [...(x.integrations || []), { id, name: purpose === "Dock" ? "Dock sheet" : purpose === "Blocked" ? "Blocked pallets sheet" : "Product profiles sheet", purpose, sourceUrl: "", header: [], sample: [], mappings: [], rows: [], lastSyncAt: null, lastError: null }] })); setSel(id); };
  // accepts an Apps Script JSON endpoint ({header, rows}) or a "Publish to web" CSV/TSV link
  const parseCsv = txt => { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch; } if (cell !== "" || row.length) { row.push(cell); rows.push(row); } const nonEmpty = rows.filter(r => r.some(c => String(c).trim())); return { header: (nonEmpty[0] || []).map(h => h.trim()), rows: nonEmpty.slice(1) }; };
  const fetchPushed = async target => { if (!window.__qcServer) { patchIt({ liveStatus: "No state server — run `npm run server` locally." }); return; } patchIt({ liveStatus: "Fetching…" }); await refreshPushedIntegrations(() => _S, set, true); const after = (_S.integrations || []).find(i => i.id === target.id); if (!after?.lastPushAt) patchIt({ liveStatus: "Nothing pushed yet — the sheet has not sent data to this server (run pushToQCteam once in Apps Script and check QC_URL)." }); };
  const fetchLive = async target => { if (target?.pushMode) return fetchPushed(target); if (!target?.sourceUrl) return; patchIt({ liveStatus: "Fetching…" }); try { let r, txt; try { r = await fetch(target.sourceUrl); txt = await r.text(); } catch (direct) { if (!window.__qcServer) throw direct; r = await fetch(`${window.__qcServer}/proxy?url=${encodeURIComponent(target.sourceUrl)}`); if (!r.ok) throw new Error(`proxy ${r.status}: ${await r.text()}`); txt = await r.text(); } if (/^\s*<!doctype html|<html[\s>]/i.test(txt)) throw new Error(/sign in/i.test(txt) ? "Google returned a sign-in page — the Apps Script is restricted to your organisation (admin setting), so it can't be fetched anonymously. Use the paste box below instead, or deploy from a private Google account." : "the URL returned a web page, not data — check it's the /exec link (or a published CSV link)");
      if (/user_content_key=/.test(target.sourceUrl)) throw new Error("this is a one-time redirect URL from your browser, not the deployment link — paste the …/macros/s/…/exec address");
      let j; try { j = JSON.parse(txt); } catch { j = txt.includes("\t") && !txt.includes(",") ? parseTsv(txt) : parseCsv(txt); } if (!Array.isArray(j.header) || !Array.isArray(j.rows)) throw new Error("unexpected response — expected JSON {header, rows} or CSV"); const raw = { header: j.header, rows: j.rows }; j = detectTable(j); if (!j.header.some(h => /handling unit|uom|item name|article|sku|ean|name/i.test(h))) throw new Error("no recognisable header row (expected columns like Handling Unit, UOM ID, Item Name)"); const mappings = target.mappings.length && target.header.join("|") === j.header.join("|") ? target.mappings : suggestMappings(j.header, j.rows, targets); const next = { ...target, header: j.header, sample: j.rows, mappings }; const rows = applyMapping(next, j.header, j.rows); patchIt({ header: j.header, sample: j.rows, rawHeader: raw.header, rawRows: raw.rows, mappings, rows: target.purpose !== "Products" ? rows : target.rows, summary: target.purpose !== "Products" ? extractSummary(raw.header, raw.rows) : target.summary, lastSyncAt: nowISO(), liveStatus: `OK — ${j.rows.length} rows at ${new Date().toLocaleTimeString("en-GB")}` }); } catch (e) { const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname); patchIt({ liveStatus: local ? `Could not fetch (${e.message}). Most often the Apps Script deployment is not public: open the /exec link in an incognito window — if Google asks you to sign in, redeploy with “Who has access: Anyone”. Also make sure you copied the /exec link, not /dev.` : `Could not fetch (${e.message}). The Claude sandbox blocks cross-origin requests — run the prototype locally to test live.` }); } };
  useEffect(() => { if (!it?.autoRefresh || (!it?.sourceUrl && !it?.pushMode)) return; const id = setInterval(() => fetchLive(it), 60000); return () => clearInterval(id); }, [it?.id, it?.autoRefresh, it?.sourceUrl, it?.pushMode]);
  const loadPaste = () => { const { header, rows } = detectTable(parseTsv(paste)); if (!header.length) return; const rawT = parseTsv(paste); const mappings = suggestMappings(header, rows, targets); patchIt({ header, sample: rows.slice(0, 500), rawHeader: rawT.header, rawRows: rawT.rows, mappings, rows: [] }); setPaste(""); };
  const resuggest = () => { if (!it?.header.length) return; patchIt({ mappings: suggestMappings(it.header, it.sample, targets) }); };
  const preview = it && it.header.length ? applyMapping(it, it.header, it.sample) : [];
  const missingRequired = it ? targets.filter(t => t[2] && !it.mappings.some(m => m.target === t[0])) : [];
  const bad = preview.filter(r => r._errors.length).length;
  const apply = () => { if (!it) return; if (it.purpose === "Dock" || it.purpose === "Blocked") patchIt({ rows: preview, summary: extractSummary(it.rawHeader || it.header, it.rawRows || it.sample), lastSyncAt: nowISO(), lastError: bad ? `${bad} row(s) skipped` : null }); else { const good = preview.filter(r => !r._errors.length); set(x => { let products = [...x.products]; let added = 0, updated = 0; good.forEach(r => { const id = String(r.articleId || "").trim(); if (!id) return; const ex = products.find(p => p.articleId === id); const catId = r.category ? x.categories.find(c => c.name.toLowerCase() === String(r.category).toLowerCase())?.id : undefined; const patch = { name: r.name || ex?.name || id, barcodeCu: r.barcodeCu || ex?.barcodeCu || "", barcodeTu: r.barcodeTu || ex?.barcodeTu || "", cusPerTu: r.cusPerTu ? String(r.cusPerTu) : ex?.cusPerTu || "", piecesPerCu: r.piecesPerCu ? String(r.piecesPerCu) : ex?.piecesPerCu || "", weightPerCu: r.weightPerCu ? String(r.weightPerCu) : ex?.weightPerCu || "", ...(catId ? { categoryId: catId } : {}) }; if (ex) { products = products.map(p => p.id === ex.id ? { ...p, ...patch } : p); updated++; } else { products.push({ id: uid(), articleId: id, categoryId: catId || (categorySuggestion({ ...x, products }, { name: patch.name })?.conf >= 0.9 ? categorySuggestion({ ...x, products }, { name: patch.name }).categoryId : null), isBio: /\bbio\b/i.test(patch.name), specs: [], supplierIds: [], varieties: [], photos: [], attributes: [], excludedSpecNames: [], isActive: true, ...patch }); added++; } }); return { ...x, products, integrations: x.integrations.map(i => i.id === sel ? { ...i, rows: preview, lastSyncAt: nowISO(), lastError: bad ? `${bad} row(s) skipped` : null, lastResult: `${added} added, ${updated} updated` } : i) }; }); } };
  return (
    <div>
      <h1 className="mb-1">Integrations</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 680 }}>Map sheet columns to system fields once. In the real system the sheet pushes rows to the API and the server applies this mapping; here you paste rows to test it.</p>
      <div className="flex gap-4 items-start">
        <aside className="w-56 flex-shrink-0">
          {list.map(i => <button key={i.id} onClick={() => setSel(i.id)} className="w-full text-left text-sm px-3 rounded-xl mb-1 flex items-center gap-2" style={{ height: 40, background: sel === i.id ? C.accentSoft : "transparent", color: sel === i.id ? C.accent : C.ink }}><Ic i={i.purpose === "Dock" ? Truck : i.purpose === "Blocked" ? LockIcon : Package} s={15} mr={0} /><span className="flex-1 truncate">{i.name}</span>{i.rows?.length ? <span className="text-[10px]" style={{ color: C.muted }}>{i.rows.length}</span> : null}</button>)}
          <div className="mt-3 flex flex-col gap-1"><button onClick={() => create("Dock")} className="text-xs text-left px-3 py-1.5" style={{ color: C.accent }}>+ dock sheet (pallets)</button><button onClick={() => create("Blocked")} className="text-xs text-left px-3 py-1.5" style={{ color: C.accent }}>+ blocked pallets sheet</button><button onClick={() => create("Products")} className="text-xs text-left px-3 py-1.5" style={{ color: C.accent }}>+ product profiles sheet</button></div>
        </aside>
        <div className="flex-1 min-w-0">
          {!it ? <Card><Empty icon="📋" title="No integrations yet" hint="Add the dock sheet first — it feeds the dashboard, the scanner and same-delivery pallets." /></Card> : <>
            <Card style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-2 mb-2"><input value={it.name} onChange={e => patchIt({ name: e.target.value })} className="font-semibold text-sm flex-1" /><span className="text-[11px] px-2 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>{it.purpose}</span><button onClick={() => { set(x => ({ ...x, integrations: x.integrations.filter(i => i.id !== it.id) })); setSel(null); }} className="text-xs px-2" style={{ color: C.muted }}>delete</button></div>
              {it.purpose === "Dock" && <div className="rounded-xl p-3 mb-3" style={{ background: C.bg }}>
                <p className="label-sm mb-1">Rejection deadline alerts</p>
                <p className="text-xs mb-2" style={{ color: C.muted }}>A pallet can only be rejected within a fixed window after arrival. As that window closes, controllers and the Head get a notification — earlier for products rejected in the last {settingsOf(s).riskyLookbackDays} days.</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {[["rejectionWindowHours", "Reject within (hours of arrival)"], ["deadlineWarnHours", "Warn — hours before the window closes"], ["deadlineWarnHoursRisky", "Warn earlier for recently-rejected products (hours before)"], ["riskyLookbackDays", "“Recently rejected” = within (days)"]].map(([k, l]) => <label key={k} className="text-xs" style={{ color: C.muted }}>{l}<input type="number" min={0} value={settingsOf(s)[k]} onChange={e => set(x => ({ ...x, settings: { ...settingsOf(x), [k]: Math.max(0, Number(e.target.value) || 0) } }))} className="w-full text-sm mt-1" /></label>)}
                </div>
                {(() => { const al = computeDeadlineAlerts(s); return al.length ? <p className="text-xs mt-2" style={{ color: C.bad }}>{al.length} pallet{al.length === 1 ? "" : "s"} currently within the warning window.</p> : <p className="text-xs mt-2" style={{ color: C.muted }}>Nothing within the warning window right now.</p>; })()}
              </div>}
              <p className="label-sm mb-1">Live source (optional)</p>
              <div className="flex gap-1.5 mb-2">{[[false, "Pull from a URL"], [true, "Pushed by the sheet (recommended)"]].map(([m, l]) => <button key={String(m)} onClick={() => patchIt({ pushMode: m })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: !!it.pushMode === m ? C.ink : "transparent", color: !!it.pushMode === m ? C.onDark : C.ink, border: `1px solid ${!!it.pushMode === m ? C.ink : C.line}` }}>{l}</button>)}</div>
              {it.pushMode && <div className="rounded-xl p-3 mb-3" style={{ background: C.bg }}>
                <p className="text-xs mb-2" style={{ color: C.muted }}>The sheet's own script sends its rows to your server on a timer — this works even when the organisation blocks public Apps Script pages (outbound requests are allowed). Your server needs a public address for Google to reach it: run <span className="font-mono">cloudflared tunnel --url http://localhost:3001</span> (free, no account) and put the printed https://… address into the script.</p>
                <div className="flex items-center gap-2 mb-2"><button onClick={() => fetchLive(it)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.accent, color: C.onDark }}>Read pushed data</button><label className="text-xs flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={!!it.autoRefresh} onChange={e => patchIt({ autoRefresh: e.target.checked })} />re-read every 60 s</label>{it.liveStatus && <span className="text-xs" style={{ color: it.liveStatus.startsWith("OK") ? C.ok : C.warn }}>{it.liveStatus}</span>}</div>
                <details><summary className="text-xs cursor-pointer" style={{ color: C.accent }}>Apps Script to paste into the sheet (Extensions → Apps Script), then Triggers → time-driven → every 5 minutes → pushToQCteam</summary><pre className="text-[11px] rounded-lg p-2 mt-1 overflow-x-auto" style={{ background: C.surface }}>{`const QC_URL = "https://YOUR-TUNNEL.trycloudflare.com/sheet/${it.purpose.toLowerCase()}";
const QC_KEY = ""; // optional: same value as QC_SYNC_KEY on the server

function pushToQCteam() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sh.getDataRange().getDisplayValues();
  const payload = { header: rows[0], rows: rows.slice(1).filter(r => r.some(c => String(c).trim())), from: SpreadsheetApp.getActiveSpreadsheet().getName() };
  const res = UrlFetchApp.fetch(QC_URL, { method: "post", contentType: "application/json", headers: QC_KEY ? { "X-Sync-Key": QC_KEY } : {}, payload: JSON.stringify(payload), muteHttpExceptions: true });
  Logger.log(res.getResponseCode() + " " + res.getContentText());
}`}</pre></details>
              </div>}
              <p className="text-xs mb-1.5" style={{ color: C.muted }}>Easiest: in Google Sheets, File → Share → Publish to web → the tab → CSV → paste the link here. Alternative: an Apps Script web app returning JSON (script below). Works when the prototype runs locally; the Claude sandbox blocks cross-origin requests.</p>
              {!it.pushMode && <><div className="flex gap-1.5 mb-1"><input value={it.sourceUrl} onChange={e => patchIt({ sourceUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv  or  …/macros/s/…/exec" className="flex-1 text-sm font-mono" /><Ghost onClick={() => fetchLive(it)}>Fetch now</Ghost><label className="text-xs flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={!!it.autoRefresh} onChange={e => patchIt({ autoRefresh: e.target.checked })} />every 60 s</label></div>
              {it.liveStatus && <p className="text-xs mb-2" style={{ color: it.liveStatus.startsWith("OK") ? C.ok : C.warn }}>{it.liveStatus}</p>}
              <details className="mb-3"><summary className="text-xs cursor-pointer" style={{ color: C.accent }}>Apps Script for the sheet (copy into Extensions → Apps Script, deploy as web app: anyone)</summary><pre className="text-[11px] rounded-lg p-2 mt-1 overflow-x-auto" style={{ background: C.bg }}>{`function doGet() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sh.getDataRange().getValues();
  const header = rows[0].map(String), body = rows.slice(1).filter(r => r.some(c => String(c).trim()));
  return ContentService.createTextOutput(JSON.stringify({ header, rows: body.map(r => r.map(String)) }))
    .setMimeType(ContentService.MimeType.JSON);
}`}</pre></details></>}
              <p className="label-sm mb-1">1 · Source (paste)</p>
              <p className="text-xs mb-2" style={{ color: C.muted }}>Paste the header row plus some rows (tab-separated — copy straight from Google Sheets).</p>
              <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} placeholder={"PO ID\\tArrival date\\tArrival time\\tTransporter\\tNeeded today\\t…"} className="w-full text-xs font-mono mb-2" />
              <div className="flex items-center gap-3"><Ghost onClick={loadPaste}>Read columns</Ghost>{it.header.length > 0 && <span className="text-xs" style={{ color: C.muted }}>{it.header.length} columns · {it.sample.length} sample rows{it.lastSyncAt ? ` · applied ${fmtTime(it.lastSyncAt)}` : ""}{it.lastResult ? ` · ${it.lastResult}` : ""}</span>}</div>
            </Card>
            {it.header.length > 0 && (
              <Card style={{ marginBottom: 16 }}>
                <p className="label-sm mb-1">2 · Mapping</p>
                <p className="text-xs mb-3" style={{ color: C.muted }}>Suggested from column names — correct anything that's wrong. Transforms handle codes like <span className="font-mono">HE11413643-16</span> (article + CU per TU in one cell). <button onClick={resuggest} className="underline" style={{ color: C.accent }}>Re-suggest mapping</button></p>
                <table className="w-full text-sm"><thead><tr className="text-xs" style={{ color: C.muted }}><th className="text-left font-medium pb-2">Sheet column</th><th className="text-left font-medium pb-2">Sample</th><th className="text-left font-medium pb-2">→ System field</th><th className="text-left font-medium pb-2">Transform</th></tr></thead><tbody>
                  {it.mappings.map((m, i) => { const idx = it.header.indexOf(m.source); const sample = it.sample[0]?.[idx]; return <tr key={m.source} style={{ borderTop: `1px solid ${C.line}`, opacity: m.target === "ignore" ? .55 : 1 }}><td className="py-1.5 font-mono text-xs">{m.source}</td><td className="py-1.5 text-xs truncate" style={{ maxWidth: 160, color: C.muted }}>{String(sample ?? "")}</td><td className="py-1.5"><select value={m.target} onChange={e => patchIt({ mappings: it.mappings.map((x, j) => j === i ? { ...x, target: e.target.value, transform: suggestTransform(e.target.value, sample), required: !!targets.find(t => t[0] === e.target.value)?.[2] } : x) })} className="text-xs" style={{ minHeight: 28 }}>{targets.map(t => <option key={t[0]} value={t[0]}>{t[1]}{t[2] ? " *" : ""}</option>)}</select></td><td className="py-1.5"><select value={m.transform} onChange={e => patchIt({ mappings: it.mappings.map((x, j) => j === i ? { ...x, transform: e.target.value } : x) })} disabled={m.target === "ignore"} className="text-xs" style={{ minHeight: 28 }}>{TRANSFORMS.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></td></tr>; })}
                </tbody></table>
                {missingRequired.length > 0 && <Note tone="bad">Required fields not mapped: {missingRequired.map(t => t[1]).join(", ")}.</Note>}
                {(() => { const pm = it.mappings.find(m => m.target === "priority"); const idx = pm ? it.header.indexOf(pm.source) : -1; const vals = idx >= 0 ? it.sample.slice(0, 20).map(r => String(r[idx] || "").trim()).filter(Boolean) : []; return vals.length && vals.every(v => /^\d+$/.test(v)) ? <Note tone="warn">“Priority item” seems mapped to a numeric column ({pm.source}). Pick the column with labels like “High risk”, “Late inspection”.</Note> : null; })()}
              </Card>
            )}
            {it.header.length > 0 && (
              <Card>
                {(it.purpose === "Dock" || it.purpose === "Blocked") && (() => { const sm = extractSummary(it.rawHeader || it.header, it.rawRows || it.sample); return Object.keys(sm).length ? <Note tone="ok">Sheet totals found: {Object.entries(sm).map(([k, v]) => `${k} ${v}`).join(" · ")} — the phone dashboard uses these as they are.</Note> : <Note tone="warn">No summary cells found (“SKU on dock:”, “Non urgent pallets on dock:”…) — the dashboard will count rows instead.</Note>; })()}
                <div className="flex items-center gap-3 mb-2"><p className="label-sm">3 · Preview</p><span className="text-xs" style={{ color: bad ? C.warn : C.muted }}>{preview.length} rows · {bad} with errors{bad ? " (skipped on apply)" : ""}{it.purpose === "Dock" && duplicateHuCount(preview.filter(r => !r._errors.length)) > 0 ? ` · ${duplicateHuCount(preview.filter(r => !r._errors.length))} duplicate HU row(s) in the sheet — merged, one pallet each` : ""}</span><div className="flex-1" /><Primary onClick={apply} disabled={missingRequired.length > 0 || preview.length === 0}>{it.purpose === "Dock" ? "Apply as live dock data" : it.purpose === "Blocked" ? "Apply as live blocked pallets" : "Create / update products"}</Primary></div>
                <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.line}`, maxHeight: 320 }}>
                  <table className="text-xs" style={{ minWidth: 700 }}><thead><tr style={{ background: C.bg }}>{targets.filter(t => t[0] !== "ignore" && it.mappings.some(m => m.target === t[0])).map(t => <th key={t[0]} className="text-left font-medium px-2 py-1.5 whitespace-nowrap" style={{ color: C.muted }}>{t[1]}</th>)}<th className="px-2 py-1.5 text-left font-medium" style={{ color: C.muted }}>Issues</th></tr></thead><tbody>
                    {preview.slice(0, 60).map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: r._errors.length ? C.badBg : "transparent" }}>{targets.filter(t => t[0] !== "ignore" && it.mappings.some(m => m.target === t[0])).map(t => <td key={t[0]} className="px-2 py-1 whitespace-nowrap font-mono">{typeof r[t[0]] === "boolean" ? (r[t[0]] ? "yes" : "no") : String(r[t[0]] ?? "")}</td>)}<td className="px-2 py-1" style={{ color: C.bad }}>{r._errors.join("; ")}</td></tr>)}
                  </tbody></table>
                </div>
              </Card>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════ CATEGORY SUGGESTIONS (CategoryRules + similarity to already categorised products) ═══════════════════
const STOP = new Set(["merkloos", "picnic", "bio", "gram", "kilo", "kg", "g", "stuk", "stuks", "stuk(s)", "st", "x", "per", "de", "het", "en", "eetrijp", "los", "verpakt", "zak", "doos", "bakje", "tros", "bos", "bosje", "kids"]);
const tokens = name => String(name || "").toLowerCase().replace(/['’]s\b/g, "").split(/[^a-z0-9àâäéèêëïîôöùûüç]+/).filter(t => t && !STOP.has(t) && !/^\d+$/.test(t));
const stem = t => t.replace(/(s|en|es|jes|tjes)$/, "");
const categorySuggestion = (s, product) => {
  const name = String(product.name || "").toLowerCase();
  // 1. Head's rules: "appel|appels → Apples"
  for (const r of s.categoryRules || []) { const kws = String(r.pattern || "").toLowerCase().split("|").map(x => x.trim()).filter(Boolean); if (kws.some(k => name.includes(k))) return { categoryId: r.categoryId, conf: 0.95, why: `rule “${r.pattern}”` }; }
  const toks = tokens(product.name).map(stem);
  if (!toks.length) return null;
  // 2. category name appears in the product name
  for (const c of s.categories) { const ct = tokens(c.name).map(stem); if (ct.length && ct.every(t => toks.includes(t))) return { categoryId: c.id, conf: 0.9, why: `name contains “${c.name}”` }; }
  // 3. nearest categorised products (token overlap)
  const scores = {};
  s.products.filter(p => p.categoryId && p.id !== product.id).forEach(p => { const pt = tokens(p.name).map(stem); if (!pt.length) return; const inter = pt.filter(t => toks.includes(t)).length; if (!inter) return; const score = inter / Math.max(1, Math.min(pt.length, toks.length)); if (!scores[p.categoryId] || scores[p.categoryId].score < score) scores[p.categoryId] = { score, like: p.name }; });
  const best = Object.entries(scores).sort((a, b) => b[1].score - a[1].score)[0];
  if (best && best[1].score >= 0.34) return { categoryId: best[0], conf: Math.min(0.85, 0.4 + best[1].score * 0.5), why: `similar to “${best[1].like}”` };
  return null;
};
function CategorySuggestPanel({ s, set, products }) {
  const [pick, setPick] = useState({}); const [chosen, setChosen] = useState({}); const [rule, setRule] = useState({ pattern: "", categoryId: "" });
  const rows = products.map(p => { const sug = categorySuggestion(s, p); return { p, sug, cat: chosen[p.id] ?? sug?.categoryId ?? "" }; });
  const confident = rows.filter(r => r.sug && r.sug.conf >= 0.6);
  const apply = ids => { const map = Object.fromEntries(rows.filter(r => ids.includes(r.p.id) && r.cat).map(r => [r.p.id, r.cat])); set(x => ({ ...x, products: x.products.map(p => map[p.id] ? { ...p, categoryId: map[p.id] } : p) })); setPick({}); };
  const addRule = () => { if (!rule.pattern.trim() || !rule.categoryId) return; set(x => ({ ...x, categoryRules: [...(x.categoryRules || []), { id: uid(), ...rule, pattern: rule.pattern.trim() }] })); setRule({ pattern: "", categoryId: "" }); };
  const selected = Object.keys(pick).filter(k => pick[k]);
  const catName = id => s.categories.find(c => c.id === id)?.name || "—";
  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="flex items-center gap-3 mb-1 flex-wrap"><h2 className="flex-1">Suggested categories</h2><span className="text-xs" style={{ color: C.muted }}>{rows.filter(r => r.sug).length} of {rows.length} have a suggestion · {confident.length} confident</span></div>
      <p className="text-xs mb-3" style={{ color: C.muted }}>From your keyword rules, category names inside product names, and similarity to products you already categorised. Accept what's right; the rest you pick by hand — every accepted product makes the next suggestions better.</p>
      <div className="rounded-xl p-3 mb-3" style={{ background: C.bg }}>
        <p className="label-sm mb-1.5">Keyword rules (kept for future imports)</p>
        <div className="flex gap-1.5 flex-wrap mb-2">{(s.categoryRules || []).map(r => <span key={r.id} className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: C.surface, border: `1px solid ${C.line}` }}><span className="font-mono">{r.pattern}</span><span style={{ color: C.muted }}>→</span>{catName(r.categoryId)}<button onClick={() => set(x => ({ ...x, categoryRules: x.categoryRules.filter(q => q.id !== r.id) }))} className="text-xs" style={{ color: C.muted }}>×</button></span>)}{!(s.categoryRules || []).length && <span className="text-xs" style={{ color: C.muted }}>none yet — e.g. “appel|appels → Apples”</span>}</div>
        <div className="flex gap-1.5"><input value={rule.pattern} onChange={e => setRule(r => ({ ...r, pattern: e.target.value }))} placeholder="keywords, separated by | (e.g. appel|appels)" className="flex-1 text-sm font-mono" /><select value={rule.categoryId} onChange={e => setRule(r => ({ ...r, categoryId: e.target.value }))} className="text-sm" style={{ minWidth: 160 }}><option value="">— category —</option>{s.categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? "↳ " : ""}{c.name}</option>)}</select><Ghost onClick={addRule}>Add rule</Ghost></div>
      </div>
      <div className="flex items-center gap-2 mb-2 flex-wrap"><Primary small onClick={() => apply(confident.map(r => r.p.id))} disabled={!confident.length}>Accept all confident ({confident.length})</Primary><Ghost onClick={() => apply(selected)} disabled={!selected.length}>Accept selected ({selected.length})</Ghost><button onClick={() => setPick(Object.fromEntries(rows.filter(r => r.cat).map(r => [r.p.id, true])))} className="text-xs underline" style={{ color: C.muted }}>select all with a category</button></div>
      <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}`, maxHeight: 420, overflowY: "auto" }}>
        <table className="w-full text-sm"><thead><tr className="text-xs" style={{ color: C.muted, background: C.bg }}><th className="px-2 py-1.5 w-6"></th><th className="text-left font-medium px-2 py-1.5">Product</th><th className="text-left font-medium px-2 py-1.5">Category</th><th className="text-left font-medium px-2 py-1.5 w-40">Confidence</th></tr></thead><tbody>
          {rows.map(r => <tr key={r.p.id} style={{ borderTop: `1px solid ${C.line}` }}>
            <td className="px-2 py-1.5"><input type="checkbox" checked={!!pick[r.p.id]} onChange={e => setPick(x => ({ ...x, [r.p.id]: e.target.checked }))} /></td>
            <td className="px-2 py-1.5"><span className="block truncate" style={{ maxWidth: 320 }}>{r.p.name}</span><span className="text-[11px]" style={{ color: C.muted }}>{r.p.articleId || "—"}{r.sug ? ` · ${r.sug.why}` : ""}</span></td>
            <td className="px-2 py-1.5"><select value={r.cat} onChange={e => { setChosen(x => ({ ...x, [r.p.id]: e.target.value })); setPick(x => ({ ...x, [r.p.id]: !!e.target.value })); }} className="text-xs" style={{ minHeight: 28, minWidth: 150, borderColor: r.cat ? C.line : C.warn }}><option value="">— pick —</option>{s.categories.map(c => <option key={c.id} value={c.id}>{c.parentId ? "↳ " : ""}{c.name}</option>)}</select></td>
            <td className="px-2 py-1.5">{r.sug ? <div className="flex items-center gap-2"><div className="h-1.5 rounded-full flex-1" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${Math.round(r.sug.conf * 100)}%`, background: r.sug.conf >= 0.6 ? C.ok : C.warn }} /></div><span className="text-[11px] w-8 text-right" style={{ color: C.muted }}>{Math.round(r.sug.conf * 100)}%</span></div> : <span className="text-[11px]" style={{ color: C.muted }}>no guess</span>}</td>
          </tr>)}
        </tbody></table>
      </div>
    </Card>
  );
}

// ═══════════════════ CHAT: attachments (MessageAttachment) + system context (MessageContext) ═══════════════════
// A message can carry files/photos and references to system objects. Context chips are clickable and open the object.
const pickFiles = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = "image/*,.pdf,.csv,.xlsx,.txt,.json"; mountPicker(i); i.onchange = async () => { const out = []; for (const f of Array.from(i.files || [])) { if (f.type.startsWith("image/")) { const d = await shrinkImage(f); if (d) { out.push({ id: uid(), kind: "image", name: f.name, dataUrl: d, size: f.size }); continue; } } if (f.size > 2.5 * 1024 * 1024) { out.push({ id: uid(), kind: "file", name: f.name, size: f.size, tooBig: true }); continue; } const d = await readAsDataUrl(f); out.push({ id: uid(), kind: "file", name: f.name, size: f.size, dataUrl: d, mime: f.type }); } unmountPicker(i); res(out); }; i.click(); });
const contextLabel = (s, c) => { if (c.kind === "product") return { icon: Package, text: s.products.find(p => p.id === c.id)?.name || "product" }; if (c.kind === "inspection") { const i = s.inspections.find(x => x.id === c.id); const p = i && s.products.find(x => x.id === i.productId); return { icon: ClipboardList, text: i ? `${p?.name || "inspection"} · ${i.status === "Completed" ? (i.result || inspType(s, i).name) : STATUS[i.status]?.[0] || i.status} · ${fmtTime(i.completedAt || i.startedAt)}` : "inspection" }; } if (c.kind === "pallet") return { icon: Truck, text: `Pallet ${c.id}${c.label ? " · " + c.label : ""}` }; if (c.kind === "flag") { const f = s.flags.find(x => x.id === c.id); return { icon: Flag, text: f ? `Flag: ${(f.description || "").slice(0, 40)}` : "flag" }; } return { icon: Tag, text: c.label || c.kind }; };
function ContextChips({ s, contexts, onOpen, dark }) {
  if (!contexts?.length) return null;
  return <div className="flex flex-wrap gap-1 mb-1">{contexts.map((c, i) => { const { icon, text } = contextLabel(s, c); return <button key={i} onClick={() => onOpen && onOpen(c)} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center max-w-full" style={{ background: dark ? C.onDarkSoft : C.accentSoft, color: dark ? C.onDark : C.accent }}><Ic i={icon} s={11} mr={4} /><span className="truncate">{text}</span></button>; })}</div>;
}
function AttachmentList({ attachments, dark }) {
  const [view, setView] = useState(null);
  if (!attachments?.length) return null;
  return <div className="flex flex-wrap gap-1.5 mb-1">
    {attachments.map(a => a.kind === "image" ? <img key={a.id} src={a.dataUrl} alt={a.name} onClick={() => setView(a)} className="rounded-lg object-cover cursor-pointer" style={{ width: 96, height: 72 }} /> : <a key={a.id} href={a.tooBig ? undefined : a.dataUrl} download={a.name} className="text-[11px] px-2 py-1 rounded-lg inline-flex items-center" style={{ background: dark ? C.onDarkSoft : C.bg, color: dark ? C.onDark : C.ink, border: dark ? "none" : `1px solid ${C.line}` }}><Ic i={Paperclip} s={11} mr={4} />{a.name}{a.tooBig ? " (too large for the prototype)" : ` · ${Math.round(a.size / 1024)} KB`}</a>)}
    {view && <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", zIndex: 80 }} onClick={() => setView(null)}><img src={view.dataUrl} alt="" className="max-w-full max-h-full rounded-xl" /></div>}
  </div>;
}
// Composer add-ons: pending attachments + context picker (products, recent inspections, pallets on dock, open flags)
function ComposerExtras({ s, user, pending, setPending, compact }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [tab, setTab] = useState("product");
  const qq = q.trim().toLowerCase();
  const has = ctx => (pending.contexts || []).some(c => c.kind === ctx.kind && c.id === ctx.id);
  const add = ctx => { setPending(p => { const cur = p.contexts || []; const exists = cur.some(c => c.kind === ctx.kind && c.id === ctx.id); return { ...p, contexts: exists ? cur.filter(c => !(c.kind === ctx.kind && c.id === ctx.id)) : [...cur, ctx] }; }); };
  const [busy, setBusy] = useState(false);
  const addFiles = async () => { setBusy(true); try { const got = await pickFiles(); if (got.length) setPending(p => ({ ...p, attachments: [...(p.attachments || []), ...got] })); } finally { setBusy(false); } };
  const products = s.products.filter(p => p.isActive !== false && (!qq || (p.name + " " + (p.articleId || "")).toLowerCase().includes(qq))).slice(0, 8);
  const inspections = s.inspections.filter(i => i.status !== "Cancelled").sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || "")).filter(i => { const p = s.products.find(x => x.id === i.productId); return !qq || (p?.name || "").toLowerCase().includes(qq) || (i.pallets || []).some(h => String(h).includes(qq)); }).slice(0, 8);
  const urgentKeys = new Set(computeDeadlineAlerts(s).map(al => al.hu.replace(/\D/g, "").replace(/^0+/, "")));
  const pallets = dockRowsLive(s).filter(r => !qq || r.hu.includes(qq) || (r.name || "").toLowerCase().includes(qq)).sort((x, y) => (urgentKeys.has(y.hu.replace(/\D/g, "").replace(/^0+/, "")) ? 1 : 0) - (urgentKeys.has(x.hu.replace(/\D/g, "").replace(/^0+/, "")) ? 1 : 0)).slice(0, 8);
  const flags = s.flags.filter(f => f.status === "Open").filter(f => !qq || (f.description || "").toLowerCase().includes(qq)).slice(0, 8);
  const Row = ({ onClick, icon, main, sub, on }) => <button onClick={onClick} className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg row" style={{ borderTop: `1px solid ${C.line}`, background: on ? C.accentSoft : "transparent" }}><Ic i={icon} s={13} mr={0} /><span className="min-w-0 flex-1"><span className="block text-sm truncate" style={{ color: on ? C.accent : C.ink }}>{main}</span>{sub && <span className="block text-[11px] truncate" style={{ color: C.muted }}>{sub}</span>}</span>{on && <Ic i={Check} s={13} mr={0} />}</button>;
  return (
    <div>
      {((pending.contexts || []).length > 0 || (pending.attachments || []).length > 0) && <div className="flex flex-wrap gap-1 mb-1.5 items-center">
        {(pending.contexts || []).map((c, i) => { const { icon, text } = contextLabel(s, c); return <span key={"c" + i} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center" style={{ background: C.accentSoft, color: C.accent }}><Ic i={icon} s={11} mr={4} />{text}<button onClick={() => setPending(p => ({ ...p, contexts: p.contexts.filter((_, j) => j !== i) }))} className="ml-1">×</button></span>; })}
        {(pending.attachments || []).map(a => <span key={a.id} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{a.kind === "image" ? <img src={a.dataUrl} alt="" className="rounded mr-1" style={{ width: 18, height: 18, objectFit: "cover" }} /> : <Ic i={Paperclip} s={11} mr={4} />}{a.name}<button onClick={() => setPending(p => ({ ...p, attachments: p.attachments.filter(x => x.id !== a.id) }))} className="ml-1">×</button></span>)}
      </div>}
      <div className="flex gap-1.5 mb-1.5">
        <button onClick={addFiles} disabled={busy} className="text-[11px] px-2 py-1 rounded-lg inline-flex items-center" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }} title="MessageAttachment"><Ic i={Paperclip} s={12} mr={4} />{busy ? "Processing…" : "Attach"}</button>
        <button onClick={() => setOpen(o => !o)} className="text-[11px] px-2 py-1 rounded-lg inline-flex items-center" style={{ background: open ? C.ink : C.bg, border: `1px solid ${open ? C.ink : C.line}`, color: open ? C.onDark : C.ink }} title="MessageContext — link a product, inspection, pallet or flag"><Ic i={Tag} s={12} mr={4} />Add context</button>
      </div>
      {open && <div className="rounded-xl p-2 mb-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex gap-1 mb-1.5 flex-wrap">{[["product", "Products"], ["inspection", "Inspections"], ["pallet", "Pallets on dock"], ["flag", "Open flags"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: tab === k ? C.ink : "transparent", color: tab === k ? C.onDark : C.ink, border: `1px solid ${tab === k ? C.ink : C.line}` }}>{l}</button>)}</div>
        <div className="flex gap-1.5 mb-1"><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="search…" className="flex-1 text-sm" style={{ minHeight: 30 }} /><button onClick={() => { setOpen(false); setQ(""); }} className="text-xs px-3 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Done{(pending.contexts || []).length ? ` (${pending.contexts.length})` : ""}</button></div>
        <div style={{ maxHeight: 200, overflowY: "auto" }}>
          {tab === "product" && products.map(p => <Row key={p.id} icon={Package} main={p.name} sub={p.articleId} on={has({ kind: "product", id: p.id })} onClick={() => add({ kind: "product", id: p.id })} />)}
          {tab === "inspection" && inspections.map(i => { const p = s.products.find(x => x.id === i.productId); return <Row key={i.id} icon={ClipboardList} main={p?.name || "inspection"} sub={`${i.status === "Completed" ? (i.result || inspType(s, i).name) : i.status} · ${fmtTime(i.completedAt || i.startedAt)} · ${s.users.find(u => u.id === i.controllerId)?.name || ""}`} on={has({ kind: "inspection", id: i.id })} onClick={() => add({ kind: "inspection", id: i.id })} />; })}
          {tab === "pallet" && pallets.map(r => <Row key={r.hu} icon={Truck} main={r.name || r.article} sub={`HU ${r.hu} · ${r.location} · ${r.priority}`} on={has({ kind: "pallet", id: r.hu })} onClick={() => add({ kind: "pallet", id: r.hu, label: `${r.name || r.article} · ${r.location}` })} />)}
          {tab === "flag" && flags.map(f => <Row key={f.id} icon={Flag} main={(f.description || "").slice(0, 60)} sub={s.products.find(p => p.id === f.productId)?.name} on={has({ kind: "flag", id: f.id })} onClick={() => add({ kind: "flag", id: f.id })} />)}
          {((tab === "product" && !products.length) || (tab === "inspection" && !inspections.length) || (tab === "pallet" && !pallets.length) || (tab === "flag" && !flags.length)) && <p className="text-xs px-2 py-2" style={{ color: C.muted }}>Nothing matches.</p>}
        </div>
      </div>}
    </div>
  );
}

// ═══════════════════ LOGIN (prototype: PIN per user, session remembered on the device) ═══════════════════
// Identification, not security: passwords + JWT arrive with the backend. The Head sets PINs in Users.
const SESSION_KEY = "qcteam-session-user";
const readSession = () => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } };
const writeSession = id => { try { if (id) localStorage.setItem(SESSION_KEY, id); else localStorage.removeItem(SESSION_KEY); } catch {} };
function LoginScreen({ s, onLogin, allowRoles, subtitle }) {
  const [pick, setPick] = useState(null); const [pin, setPin] = useState(""); const [err, setErr] = useState("");
  const users = (s.users || []).filter(u => u.active !== false && (!allowRoles || allowRoles.includes(u.role)));
  const submit = u => { if (u.pin && u.pin !== pin) { setErr("Wrong PIN"); setPin(""); return; } writeSession(u.id); onLogin(u.id); };
  return (
    <div className="qc min-h-screen flex items-center justify-center p-6" style={{ background: C.bg }}>
      <style>{GLOBAL_CSS()}</style>
      <div className="w-full rounded-3xl p-6" style={{ maxWidth: 380, background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2 mb-1"><div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold" style={{ background: C.ink, color: C.onDark }}>Q</div><div><p className="font-semibold">QCteam</p><p className="text-[11px]" style={{ color: C.muted }}>{subtitle || "Who's inspecting today?"}</p></div></div>
        {!pick ? (
          <div className="mt-4">
            {users.length === 0 && <p className="text-sm" style={{ color: C.muted }}>No accounts yet — the Head creates them in the portal (Users).</p>}
            {users.map(u => <button key={u.id} onClick={() => { setPick(u); setPin(""); setErr(""); if (!u.pin) submit(u); }} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><Avatar user={u} size={36} /><span className="flex-1"><span className="block text-sm font-medium">{u.name}</span><span className="block text-[11px]" style={{ color: C.muted }}>{u.role}{u.pin ? " · PIN" : " · no PIN set"}</span></span></button>)}
          </div>
        ) : (
          <div className="mt-4">
            <div className="flex items-center gap-3 mb-4"><Avatar user={pick} size={40} /><div><p className="text-sm font-medium">{pick.name}</p><p className="text-[11px]" style={{ color: C.muted }}>{pick.role}</p></div><button onClick={() => setPick(null)} className="ml-auto text-xs underline" style={{ color: C.muted }}>not me</button></div>
            <p className="text-xs mb-2" style={{ color: C.muted }}>Enter your PIN</p>
            <input autoFocus type="password" inputMode="numeric" pattern="[0-9]*" value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(""); }} onKeyDown={e => e.key === "Enter" && submit(pick)} className="w-full text-center text-2xl tracking-[0.5em] font-mono" style={{ minHeight: 52 }} placeholder="••••" />
            {err && <p className="text-xs mt-2" style={{ color: C.bad }}>{err}</p>}
            <button onClick={() => submit(pick)} disabled={!pin} className="w-full py-3 rounded-xl text-sm font-medium mt-4" style={{ background: pin ? C.ink : C.line, color: pin ? C.onDark : C.muted }}>Sign in</button>
          </div>
        )}
        <p className="text-[10px] mt-5" style={{ color: C.muted }}>Prototype sign-in: identifies who works, it is not a security boundary. Real authentication comes with the backend.</p>
      </div>
    </div>
  );
}
// ═══════════════════ OPTIMISTIC CONCURRENCY — several devices, one shared state ═══════════════════
// Every change is a function "state → state". We save with the version we last saw; if someone else saved first,
// the server answers 409 with its current state, we re-apply our queued functions on top and save again.
const createSyncer = () => ({ version: null, pending: [], busy: false, again: false });
const flushState = async (syncer, key, getLocal, setLocal, normalizeFn, onConflictResolved) => {
  if (!window.storage?.setVersioned) { try { await window.storage.set(key, JSON.stringify(getLocal())); } catch {} return; }
  if (syncer.busy) { syncer.again = true; return; }
  syncer.busy = true;
  try {
    // `carried`: pending functions already reapplied in an EARLIER attempt of this same flush cycle. They must keep
    // being reapplied on every later conflict too — otherwise the 2nd (3rd, ...) consecutive conflict rebases onto
    // the server's fresh-but-still-pre-edit value with nothing left in that attempt's own `fns` to reapply (they were
    // only ever queued once, by the user's click), and the edit is silently reverted: it had looked saved locally
    // for a moment, then vanished again, even before any page reload. This is what actually made a delete "come
    // back" — not that the save never went out, but that a second sheet push landing right after the first one
    // undid it. Confirmed with a scripted repro against the old code: 2+ consecutive conflicting writes reverted
    // the change both locally and on the server, every time.
    let saved = false, carried = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      const fns = [...carried, ...syncer.pending.splice(0)];
      const res = await window.storage.setVersioned(key, JSON.stringify(getLocal()), syncer.version);
      if (!res) break;
      // A dropped connection mid-save (flaky warehouse WiFi, a Render restart) must not silently discard the edit:
      // put it back at the front of the queue so it isn't lost, and leave `pending` non-empty so the poll below
      // knows there's unsynced work and won't overwrite it with the server's (still pre-edit) copy in the meantime.
      // The poll retries this on its next tick; there's nothing more useful to do right now.
      if (res.error) { syncer.pending.unshift(...fns); break; }
      if (res.rejected) { console.warn("QCteam: server rejected this state as too small — keeping the server's copy"); const r = await window.storage.get(key); if (r?.value) { setLocal(normalizeFn(JSON.parse(r.value))); syncer.version = r.version || null; } break; }
      if (res.conflict) {
        let base = normalizeFn(JSON.parse(res.value)); syncer.version = res.version || null;
        for (const f of fns) { try { base = f(base); } catch (e) { console.warn("QCteam: could not re-apply a change after conflict", e); } }
        setLocal(base); onConflictResolved && onConflictResolved(fns.length);
        carried = fns; // keep reapplying these too if yet another conflict hits on the next attempt
        continue; // save the merged state with the new version
      }
      syncer.version = res.version || syncer.version; saved = true; break;
    }
    // Ran out of retries while the server kept moving out from under us (heavy, sustained concurrent writes) — the
    // edit is correctly merged into local state, but nothing is left in `pending` to ever save it. Requeue it so the
    // next poll tick (or the next edit) tries again with the latest version, instead of silently losing it.
    if (!saved && !syncer.pending.length) syncer.pending.push(...(carried.length ? carried : [x => x]));
  } finally { syncer.busy = false; if (syncer.again) { syncer.again = false; flushState(syncer, key, getLocal, setLocal, normalizeFn, onConflictResolved); } }
};

// ═══════════════════ BLOCKED PALLET QUEUE ROW (shared) ═══════════════════
function QueueRow({ s, set, user, b, onOpen }) {
  const c = b.claim; const me = c && c.userId === user.id; const who = c && s.users.find(u => u.id === c.userId);
  const done = b.status === "Completed"; const stacked = c?.status === "stacked"; const lost = b.lost; const lostBy = lost && s.users.find(u => u.id === lost.byUserId);
  const col = done ? C.ok : lost ? C.line : stacked ? C.muted : b.status === "Started" ? C.warn : C.bad;
  const take = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "taken" });
  const stack = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "stacked" });
  const release = () => setClaim(set, b, null);
  const ago = t => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };
  return (
    <div className="py-2.5" style={{ borderBottom: `1px solid ${C.line}`, opacity: done ? .5 : lost ? .45 : stacked ? .7 : 1 }}>
      <div className="flex items-center gap-2">
        <span className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: col }} />
        <button onClick={onOpen} className="text-sm flex-1 truncate font-medium text-left">{b.name || b.article}</button>
        {who && <span className="flex items-center gap-1 text-[11px]" style={{ color: me ? C.accent : C.muted }}><Avatar user={who} size={18} />{me ? "you" : who.name.split(" ")[0]} · {ago(c.at)}</span>}
        {stacked && !lost && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center" style={{ background: C.line, color: C.muted }}><Ic i={Layers} s={10} mr={3} />in stack</span>}
        {lost && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center" style={{ background: C.line, color: C.muted }}><Ic i={Search} s={10} mr={3} />lost · {lostBy ? lostBy.name.split(" ")[0] : "?"} · {ago(lost.at)}</span>}
      </div>
      <p className="text-xs mt-0.5 ml-4" style={{ color: C.muted }}>{[b.location, b.zone && `zone ${b.zone}`, b.pickLocation, b.deadline && `by ${b.deadline}`, b.time && `${b.time}`, b.hu && `HU …${b.hu.slice(-6)}`, b.article, b.status].filter(Boolean).join(" · ")}</p>
      {lost && !done && <div className="flex gap-1.5 mt-1.5 ml-4"><button onClick={() => markFound(set, b, user)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Found — back in queue</button>{lost.note && <span className="text-[11px] self-center" style={{ color: C.muted }}>{lost.note}</span>}</div>}
      {!done && !lost && <div className="flex gap-1.5 mt-1.5 ml-4">
        {!c && <><button onClick={take} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Take</button><button onClick={stack} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={12} />In stack</button></>}
        {c && me && <>{stacked ? <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Reachable now — take</button> : <button onClick={stack} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={12} />In stack</button>}<button onClick={release} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Release</button></>}
        {c && !me && <>{stacked ? <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Reachable now — take</button> : <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.warn, border: `1px solid ${C.line}` }}>Take over</button>}</>}
      </div>}
    </div>
  );
}


// ═══════════════════ SHARED WITH THE PORTAL (copied 1:1) ═══════════════════
const SHEET = {
  syncedAt: "18:05", source: "Inbound quality check prioritization (16-09-2026)",
  dock: [
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:51", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024377766", "uom": "HE90006052-16", "article": "90006052", "cusPerTu": 16, "name": "Merkloos Pink Lady appels 4 stuks", "location": "D-10A", "priorityScore": 2, "priority": "High risk", "skippable": false, "inBuffer": 1, "onDock": 1, "sortable": true},
    {"po": "1268124", "arrived": "2026-09-16", "arrivedTime": "10:22", "transporter": "The greenary /teboza /eosta", "blocking": false, "hu": "087205744101638635", "uom": "HE10074782-10", "article": "10074782", "cusPerTu": 10, "name": "Picnic Basilicum 15 gram", "location": "D-11A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": false},
    {"po": "1268124", "arrived": "2026-09-16", "arrivedTime": "10:23", "transporter": "The greenary /teboza /eosta", "blocking": false, "hu": "087205744101638628", "uom": "HE10074782-10", "article": "10074782", "cusPerTu": 10, "name": "Picnic Basilicum 15 gram", "location": "D-11A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": false},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:29", "transporter": "Toff", "blocking": false, "hu": "087193280039725772", "uom": "HE10556098-4", "article": "10556098", "cusPerTu": 4, "name": "Merkloos Bio rode kool 1 stuk", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:30", "transporter": "Toff", "blocking": false, "hu": "087193280039725765", "uom": "HE10556098-4", "article": "10556098", "cusPerTu": 4, "name": "Merkloos Bio rode kool 1 stuk", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1268178", "arrived": "2026-09-16", "arrivedTime": "07:27", "transporter": "Fossa Eugenia 16-09", "blocking": false, "hu": "387154590006064288", "uom": "HE11323867-14", "article": "11323867", "cusPerTu": 14, "name": "Merkloos Gele courgette 1 stuk", "location": "D-07A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:50", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024377933", "uom": "HE11389534-10", "article": "11389534", "cusPerTu": 10, "name": "Merkloos Pink Lady kids appels 8 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 3, "sortable": false},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:52", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024377711", "uom": "HE11389534-10", "article": "11389534", "cusPerTu": 10, "name": "Merkloos Pink Lady kids appels 8 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 3, "sortable": false},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:52", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024377735", "uom": "HE11389534-10", "article": "11389534", "cusPerTu": 10, "name": "Merkloos Pink Lady kids appels 8 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 3, "sortable": false},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:49", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378367", "uom": "HE11413643-16", "article": "11413643", "cusPerTu": 16, "name": "Picnic Gala appels 4 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268183", "arrived": "2026-09-16", "arrivedTime": "13:06", "transporter": "Nature's pride", "blocking": false, "hu": "187189630010023344", "uom": "HE11454890-12", "article": "11454890", "cusPerTu": 12, "name": "Merkloos Babymaïs 125 gram", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:28", "transporter": "Toff", "blocking": false, "hu": "087193280039725727", "uom": "HE11719748-16", "article": "11719748", "cusPerTu": 16, "name": "Merkloos Bio paprika duo 2 stuks", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268186", "arrived": "2026-09-16", "arrivedTime": "08:15", "transporter": "Friethoes 16-09", "blocking": false, "hu": "487192606100023049", "uom": "HE11743339-4", "article": "11743339", "cusPerTu": 4, "name": "Friethoes Voorgebakken verse friet 450 gram", "location": "D-05A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": false},
    {"po": "1268186", "arrived": "2026-09-16", "arrivedTime": "08:15", "transporter": "Friethoes 16-09", "blocking": false, "hu": "487192606100023049", "uom": "HE11743339-4", "article": "11743339", "cusPerTu": 4, "name": "Friethoes Voorgebakken verse friet 450 gram", "location": "D-05A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": false},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:46", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378336", "uom": "HE11988022-5", "article": "11988022", "cusPerTu": 5, "name": "Picnic Jonagold appels 2.5 kilo", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:46", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378329", "uom": "HE11988022-5", "article": "11988022", "cusPerTu": 5, "name": "Picnic Jonagold appels 2.5 kilo", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1268186", "arrived": "2026-09-16", "arrivedTime": "08:15", "transporter": "Friethoes 16-09", "blocking": false, "hu": "487192606100023056", "uom": "HE12330169-4", "article": "12330169", "cusPerTu": 4, "name": "Friethoes Voorgebakken verse kreukelfriet 450 gram", "location": "D-05A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": false},
    {"po": "1268177", "arrived": "2026-09-16", "arrivedTime": "12:34", "transporter": "Nature's pride", "blocking": false, "hu": "387142530814011277", "uom": "HE12429345-10", "article": "12429345", "cusPerTu": 10, "name": "Merkloos Zoete puntpaprika's 500 gram", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268177", "arrived": "2026-09-16", "arrivedTime": "12:38", "transporter": "Nature's pride", "blocking": false, "hu": "387142530814011260", "uom": "HE12429345-10", "article": "12429345", "cusPerTu": 10, "name": "Merkloos Zoete puntpaprika's 500 gram", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:49", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378343", "uom": "HE12472977-16", "article": "12472977", "cusPerTu": 16, "name": "Picnic Elstar appels 4 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:45", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024375656", "uom": "HE12474058-16", "article": "12474058", "cusPerTu": 16, "name": "Picnic Granny Smith appels 4 stuks", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268171", "arrived": "2026-09-16", "arrivedTime": "15:08", "transporter": "TNI", "blocking": false, "hu": "087193280039725925", "uom": "HE12570944-6", "article": "12570944", "cusPerTu": 6, "name": "Merkloos Snackpaprika's pitloos 300 gram", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 1, "onDock": 1, "sortable": true},
    {"po": "1268183", "arrived": "2026-09-16", "arrivedTime": "13:07", "transporter": "Nature's pride", "blocking": false, "hu": "187189630010023320", "uom": "HE12610325-33", "article": "12610325", "cusPerTu": 33, "name": "Merkloos Bio gember 120 gram", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:45", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024375670", "uom": "HE12732096-12", "article": "12732096", "cusPerTu": 12, "name": "Picnic Bio Elstar appel 1 kilo", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 2, "onDock": 1, "sortable": true},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:54", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378046", "uom": "HE12732319-12", "article": "12732319", "cusPerTu": 12, "name": "Picnic Bio kinder appels 1 kilo", "location": "D-10A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268183", "arrived": "2026-09-16", "arrivedTime": "13:06", "transporter": "Nature's pride", "blocking": false, "hu": "187189630010023337", "uom": "HE90006004-4", "article": "90006004", "cusPerTu": 4, "name": "Merkloos Jalapeno groene pepers 100 gram", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:38", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024374956", "uom": "HE90006048-8", "article": "90006048", "cusPerTu": 8, "name": "Picnic Jonagold appels 1.5 kilo", "location": "D-07A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 1, "onDock": 4, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:38", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024374970", "uom": "HE90006048-8", "article": "90006048", "cusPerTu": 8, "name": "Picnic Jonagold appels 1.5 kilo", "location": "D-07A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 1, "onDock": 4, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:38", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024375571", "uom": "HE90006051-10", "article": "90006051", "cusPerTu": 10, "name": "Picnic Conference peertjes 1 kilo", "location": "D-07A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:40", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024375588", "uom": "HE90006051-10", "article": "90006051", "cusPerTu": 10, "name": "Picnic Conference peertjes 1 kilo", "location": "D-07A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268183", "arrived": "2026-09-16", "arrivedTime": "13:06", "transporter": "Nature's pride", "blocking": false, "hu": "187189630010023306", "uom": "HE90006063-12", "article": "90006063", "cusPerTu": 12, "name": "Merkloos Rode cayennepepers 2 stuks", "location": "D-01A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:28", "transporter": "Toff", "blocking": false, "hu": "087193280039725703", "uom": "HE90006067-14", "article": "90006067", "cusPerTu": 14, "name": "Merkloos Bio komkommer 1 stuk", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:28", "transporter": "Toff", "blocking": false, "hu": "087193280039725710", "uom": "HE90006067-14", "article": "90006067", "cusPerTu": 14, "name": "Merkloos Bio komkommer 1 stuk", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1267256", "arrived": "2026-09-16", "arrivedTime": "14:28", "transporter": "Toff", "blocking": false, "hu": "087193280039725680", "uom": "HE90006068-32", "article": "90006068", "cusPerTu": 32, "name": "Merkloos Bio rode paprika 1 stuk", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:14", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369750", "uom": "HE90006080-12", "article": "90006080", "cusPerTu": 12, "name": "Merkloos Haricots verts 250 gram", "location": "D-07A", "priorityScore": 1, "priority": "Inspection due", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": false},
    {"po": "1268171", "arrived": "2026-09-16", "arrivedTime": "15:10", "transporter": "TNI", "blocking": false, "hu": "387142530811034996", "uom": "HE90006129-12", "article": "90006129", "cusPerTu": 12, "name": "Merkloos Zoete cherrytomaatjes 400 gram", "location": "D-02A", "priorityScore": 1, "priority": "Late inspection", "skippable": false, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:48", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378206", "uom": "HE10558518-6", "article": "10558518", "cusPerTu": 6, "name": "Merkloos Rode bessen 125 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 2, "onDock": 1, "sortable": true},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:48", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378237", "uom": "HE11413653-4", "article": "11413653", "cusPerTu": 4, "name": "Merkloos Frambozen & blauwe bessen 300 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 1, "sortable": false},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:47", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024377704", "uom": "HE11476583-14", "article": "11476583", "cusPerTu": 14, "name": "Merkloos Bio blauwe bessen 200 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:48", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378169", "uom": "HE11746506-10", "article": "11746506", "cusPerTu": 10, "name": "Merkloos Rode bessen 300 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 1, "sortable": false},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:16", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369934", "uom": "HE11843173-14", "article": "11843173", "cusPerTu": 14, "name": "Merkloos Bosui 1 bosje", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:16", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369941", "uom": "HE11843173-14", "article": "11843173", "cusPerTu": 14, "name": "Merkloos Bosui 1 bosje", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 2, "sortable": true},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:48", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378176", "uom": "HE11992700-10", "article": "11992700", "cusPerTu": 10, "name": "Merkloos Frambozen 225 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": false},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:47", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024379104", "uom": "HE12472989-12", "article": "12472989", "cusPerTu": 12, "name": "Picnic Bio Hollandse appeltjes 1 kilo", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:44", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378374", "uom": "HE12562481-8", "article": "12562481", "cusPerTu": 8, "name": "Picnic Granny Smith appels 1.5 kilo", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 1, "sortable": true},
    {"po": "1268344", "arrived": "2026-09-16", "arrivedTime": "15:48", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378220", "uom": "HE12721524-6", "article": "12721524", "cusPerTu": 6, "name": "Merkloos Bio rode bessen 125 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:13", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369781", "uom": "HE90006002-20", "article": "90006002", "cusPerTu": 20, "name": "Merkloos Sperziebonen 500 gram", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:15", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369774", "uom": "HE90006002-20", "article": "90006002", "cusPerTu": 20, "name": "Merkloos Sperziebonen 500 gram", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "", "arrived": "2026-09-16", "arrivedTime": "17:57", "transporter": "cayen", "blocking": false, "hu": "087193280039489902", "uom": "HE90006022-11", "article": "90006022", "cusPerTu": 11, "name": "Merkloos Groene asperges 450 gram", "location": "D-08A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 2, "onDock": 1, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:15", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369538", "uom": "HE90006025-7", "article": "90006025", "cusPerTu": 7, "name": "Merkloos Maïskolven 2 stuks", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:45", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024375663", "uom": "HE90006032-16", "article": "90006032", "cusPerTu": 16, "name": "Picnic Bio peren 500 gram", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:40", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024374963", "uom": "HE90006048-8", "article": "90006048", "cusPerTu": 8, "name": "Picnic Jonagold appels 1.5 kilo", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 4, "sortable": true},
    {"po": "1268342", "arrived": "2026-09-16", "arrivedTime": "15:40", "transporter": "fruitmasters", "blocking": false, "hu": "387175210024374949", "uom": "HE90006048-8", "article": "90006048", "cusPerTu": 8, "name": "Picnic Jonagold appels 1.5 kilo", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 1, "onDock": 4, "sortable": true},
    {"po": "1268183", "arrived": "2026-09-16", "arrivedTime": "17:23", "transporter": "cayen", "blocking": false, "hu": "087193280039752488", "uom": "HE90006063-12", "article": "90006063", "cusPerTu": 12, "name": "Merkloos Rode cayennepepers 2 stuks", "location": "D-01A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:14", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369743", "uom": "HE90006081-6", "article": "90006081", "cusPerTu": 6, "name": "Merkloos Peulen 200 gram", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268182", "arrived": "2026-09-16", "arrivedTime": "16:14", "transporter": "Scherpenhuizen", "blocking": false, "hu": "387193366301369767", "uom": "HE90006082-6", "article": "90006082", "cusPerTu": 6, "name": "Merkloos Sugarsnaps 200 gram", "location": "D-07A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 1, "sortable": true},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:55", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378022", "uom": "HE90006135-16", "article": "90006135", "cusPerTu": 16, "name": "Picnic Bio zoete appels 4 stuks", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 2, "sortable": true},
    {"po": "1268377", "arrived": "2026-09-16", "arrivedTime": "15:55", "transporter": "Fruitmasters 2", "blocking": false, "hu": "387175210024378039", "uom": "HE90006135-16", "article": "90006135", "cusPerTu": 16, "name": "Picnic Bio zoete appels 4 stuks", "location": "D-10A", "priorityScore": 0, "priority": "Skippable", "skippable": true, "inBuffer": 0, "onDock": 2, "sortable": true},
  ],
};

let _S = { integrations: [] }; // latest app state, for helpers that read the live dock rows without threading s everywhere

const blockingRows = () => dockRowsLive(_S).filter(r => r.blocking).sort((a, b) => (a.arrivedTime || "").localeCompare(b.arrivedTime || ""));

const dockRowsForProduct = product => product ? dockRowsLive(_S).filter(r => r.article === product.articleId) : [];
// Pallets of the same product that can be attached to this report: same delivery day only (a different day is a different delivery — possibly different quality).

const sameDeliveryPallets = (product, insp) => {
  const rows = dockRowsForProduct(product); const mine = (insp.pallets || []).map(x => String(x).trim()).filter(Boolean);
  const norm = v => String(v || "").replace(/\D/g, "").replace(/^0+/, ""); const same = (a, b) => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
  const anchorRow = rows.find(r => mine.some(m => same(m, r.hu)));
  // delivery day: from the sheet if the sampled pallet is on it; otherwise assume today's delivery (a fresh arrival); unknown if no pallet entered yet
  const day = anchorRow ? anchorRow.arrived : mine.length ? new Date().toISOString().slice(0, 10) : null;
  // Same day doesn't guarantee same delivery — a different PO usually means a separate order that just happened to land
  // the same day, so it's kept out of the one-tap "Add all" and flagged instead of silently pooled into this report.
  const anchorPO = (anchorRow?.po || "").trim();
  const list = rows.filter(r => !mine.some(m => same(m, r.hu))).map(r => ({ ...r, sameDay: day ? r.arrived === day : null, poMismatch: !!(anchorPO && r.po && r.po.trim() !== anchorPO) }));
  return Object.assign(list, { basis: anchorRow ? "sheet" : mine.length ? "today" : "none", anchorPO });
};

function Card({ children, style }) { return <section className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.line}`, ...style }}>{children}</section>; }

function Primary({ children, onClick, disabled, small }) { return <button onClick={onClick} disabled={disabled} className={`${small ? "text-xs px-3" : "text-sm px-4"} font-semibold rounded-xl inline-flex items-center justify-center`} style={{ height: small ? 30 : 38, background: disabled ? C.line : C.accent, color: disabled ? C.muted : C.onDark }}>{children}</button>; }

function Ghost({ children, onClick }) { return <button onClick={onClick} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 30, background: C.accentSoft, color: C.accent }}>{children}</button>; }

function Empty({ icon, title, hint, action }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.muted }}>{EMPTY_ICON[icon] ? <Ic i={EMPTY_ICON[icon]} s={22} mr={0} /> : <span className="text-2xl">{icon}</span>}</div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: C.muted }}>{hint}</p>
      {action}
    </div>
  );
}

function Note({ tone: t = "info", children }) {
  const [fg, bg] = t === "warn" ? [C.warn, C.warnBg] : t === "ok" ? [C.ok, C.okBg] : t === "bad" ? [C.bad, C.badBg] : [C.accent, C.accentSoft];
  return <div className="rounded-xl px-3.5 py-2.5 text-sm mb-3" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderLeft: `3px solid ${fg}` }}>{children}</div>;
}

function NumberInput({ f, problems, overrides, specs, totals, value, onChange, onRaise, raised, piecesPerCu }) {
  const n = f.measurementCount || 1, ms = value?.measurements || Array(n).fill("");
  const nums = ms.filter(x => x !== "").map(Number), avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  // Specification: explicit (specId) or by name (specName, defaults to field label)
  const wanted = ((f.specName || "").trim() || f.label || "").toLowerCase();
  const sameName = (specs || []).filter(q => (q.name || "").trim().toLowerCase() === wanted);
  const spec = (f.specId && specs?.find(q => q.id === f.specId)) || sameName.find(q => specBasis(q) === fieldBasis(f)) || sameName[0] || null;
  const byName = spec && !(f.specId && spec.id === f.specId);
  let side = null, ref = null;
  const lim = limitsFor(spec, f, piecesPerCu); const mn = lim.min, mx = lim.max;
  if (avg !== null && (hasV(mn) || hasV(mx))) { ref = specLabel({ min: mn, max: mx, unit: spec ? spec.unit : "" }) + (fieldBasis(f) === "cu" ? " per CU" : ""); side = hasV(mn) && avg < Number(mn) ? "below" : hasV(mx) && avg > Number(mx) ? "above" : null; }
  const bad = side !== null;
  const linkedId = side === "below" ? f.problemBelowId : side === "above" ? f.problemAboveId : null;
  const lp = linkedId && problems.find(p => p.id === linkedId);
  const zero = lp && effTol(problems, overrides || [], lp.id) === 0;
  const available = { PieceCount: totals.pieces > 0, DirectWeight: totals.weight > 0, WholeUnitCount: totals.cu > 0 };
  const firstMode = Object.keys(available).find(k => available[k]) || "WholeUnitCount";
  const [mode, setMode] = useState(firstMode);
  const [raw, setRaw] = useState("");
  const unit = mode === "PieceCount" ? "pcs" : mode === "DirectWeight" ? "g" : "CU";
  return (
    <div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>{ms.map((m, i) => <input key={i} type="number" value={m} onChange={e => onChange({ measurements: ms.map((x, j) => j === i ? e.target.value : x) })} placeholder={`pomiar ${i + 1}`} className="text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />)}</div>
      {lim.note && <p className="text-[11px] mt-1" style={{ color: C.muted }}>{lim.note}</p>}
      {avg !== null && <p className="text-xs mt-1.5" style={{ color: C.muted }}>average <b style={{ color: C.ink }}>{fmt(avg)}</b>{ref ? ` · reference ${ref}${byName ? ` (by name “${spec.name}"${spec.source !== "product" ? ", " + spec.source : ""})` : ""}` : (f.problemBelowId || f.problemAboveId) ? <span style={{ color: C.warn }}> · no reference — the product has no specification “{(f.specName || "").trim() || f.label}“ and the field has no min/max</span> : ""}</p>}
      {bad && !lp && <div className="rounded-lg px-3 py-1.5 mt-1.5 text-xs" style={{ background: C.warnBg, color: C.warn }}>Out of spec — warning only.</div>}
      {bad && lp && !raised && (
        <div className="rounded-lg p-2 mt-1.5" style={{ background: C.warnBg }}>
          <p className="text-xs mb-1.5" style={{ color: C.warn }}>Out of spec → problem <b>{lp.name}</b>.{zero ? " Tolerance 0% — presence alone is enough." : " How many are affected and in which unit?"}</p>
          {zero ? (
            <button onClick={() => onRaise(linkedId, "Presence", 1)} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.bad, color: C.onDark }}>Present</button>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {[["PieceCount", "pieces"], ["DirectWeight", "grams"], ["WholeUnitCount", "whole CU"]].map(([k, l]) => <button key={k} disabled={!available[k]} onClick={() => setMode(k)} title={available[k] ? "" : "no divisor — fill in the conversion in the sample"} className="text-xs px-2 py-1 rounded" style={{ background: !available[k] ? C.line : mode === k ? C.accent : C.surface, color: !available[k] ? C.muted : mode === k ? C.onDark : C.accent, border: `1px solid ${available[k] ? C.accent : C.line}` }}>{l}</button>)}
              <input type="number" value={raw} onChange={e => setRaw(e.target.value)} placeholder="how many" className="w-16 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} />
              <span className="text-xs self-center" style={{ color: C.muted }}>{unit}</span>
              <button onClick={() => { if (raw !== "") { onRaise(linkedId, mode, raw); setRaw(""); } }} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.accent, color: C.onDark }}>Report</button>
            </div>
          )}
        </div>
      )}
      {raised && <p className="text-xs mt-1.5" style={{ color: C.ok }}>✓ {lp?.name} reported from this field.</p>}
    </div>
  );
}

function ProblemTreeView({ root, problems, overrides, remarks, onReport, onDelete, onPhoto, onRemovePhoto, totals, disabled, notes }) {
  const [open, setOpen] = useState(null);
  const [refOpen, setRefOpen] = useState(null);
  const [mode, setMode] = useState(totals.pieces > 0 ? "PieceCount" : totals.weight > 0 ? "DirectWeight" : "WholeUnitCount");
  const [raw, setRaw] = useState("");
  const unitOf = m => m === "PieceCount" ? "pcs" : m === "DirectWeight" ? "g" : m === "Presence" ? "" : "CU";
  const submit = leafId => { onReport({ leafId, mode, raw }); setRaw(""); setOpen(null); };
  const render = node => {
    const dep = depthOf(problems, node.id) - depthOf(problems, root.id), leaf = isLeaf(problems, node.id);
    const s = statusOf(problems, overrides, remarks, node.id, totals), [fg, bg] = tone(s), t = effTol(problems, overrides, node.id);
    const mine = leaf ? remarks.filter(r => r.leafId === node.id) : [];
    const isOpen = open === node.id, zero = t === 0;
    const note = leaf ? noteFor(notes, node.id) : null, hasNote = hasNoteContent(note), refIsOpen = refOpen === node.id;
    return (
      <div key={node.id}>
        <div className="flex items-center gap-2 py-1 text-sm" style={{ paddingLeft: dep * 14, borderTop: `1px solid ${C.line}` }}>
          {leaf && !disabled
            ? <button onClick={() => { setOpen(isOpen ? null : node.id); setRaw(""); }} className="flex-1 text-left rounded px-1 -mx-1" style={{ color: isOpen ? C.accent : C.ink, fontWeight: isOpen ? 500 : 400, background: isOpen ? C.accentSoft : "transparent" }}>{node.name} <span className="text-xs" style={{ color: C.muted }}>{isOpen ? "▾" : "+"}</span></button>
            : <span className="flex-1" style={{ fontWeight: dep === 0 ? 600 : dep === 1 ? 500 : 400 }}>{node.name}</span>}
          {hasNote && <button onClick={() => setRefOpen(refIsOpen ? null : node.id)} className="inline-flex items-center rounded-full px-1.5 py-0.5" style={{ background: refIsOpen ? C.accent : C.accentSoft, color: refIsOpen ? C.onDark : C.accent }} title="reference guide — what this looks like"><Ic i={BookOpen} s={12} mr={0} /></button>}
          {t !== null && <span className="text-xs" style={{ color: C.muted }}>tol. {t}%{zero && "⚡"}</span>}
          <span className="text-xs px-2 py-0.5 rounded-full min-w-[3.2rem] text-center" style={{ background: bg, color: fg, fontWeight: 500 }}>{presenceIn(problems, remarks, node.id) && zero ? "present" : `${fmt(aggregate(problems, remarks, node.id, totals))}%`}</span>
        </div>
        {leaf && hasNote && refIsOpen && (
          <div className="rounded-lg p-2 my-1" style={{ marginLeft: dep * 14 + 12, background: C.accentSoft }}>
            {note.description && <p className="text-xs mb-1.5" style={{ color: C.ink }}>{note.description}</p>}
            {asPhotoList(note.photos).length > 0 && <PhotoStrip photos={note.photos} size={48} />}
          </div>
        )}
        {leaf && mine.map(r => (
          <div key={r.id} className="flex items-center gap-2 text-xs py-1" style={{ paddingLeft: dep * 14 + 12, color: C.muted }}>
            <span>↳ {r.mode === "Presence" ? "present" : `${r.raw} ${unitOf(r.mode)}`}{r.auto && " · of pomiaru"}</span>
            {r.mode !== "Presence" && <span className="font-medium" style={{ color: C.ink }}>{fmt(pct(r, totals))}%</span>}
            <button onClick={() => onPhoto && onPhoto(r.id)} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: asPhotoList(r.photos).length ? C.accentSoft : "transparent", color: C.accent, border: `1px solid ${asPhotoList(r.photos).length ? "transparent" : C.line}` }} title="photo of this problem (InspectionPhoto.RemarkId)"><Ic i={Camera} s={11} mr={0} />{asPhotoList(r.photos).length || "add"}</button>
            <button onClick={() => onDelete(r.id)} className="px-1" style={{ color: C.bad }} title="delete report">×</button>
          </div>
        ))}
        {leaf && mine.filter(r => asPhotoList(r.photos).length).map(r => (
          <div key={r.id + "-ph"} style={{ paddingLeft: dep * 14 + 12 }} className="mb-1"><PhotoStrip photos={r.photos} onRemove={onRemovePhoto ? pid => onRemovePhoto(r.id, pid) : null} size={44} /></div>
        ))}
        {leaf && isOpen && (
          <div className="rounded-lg p-2 my-1 flex items-center gap-1.5 flex-wrap" style={{ marginLeft: dep * 14 + 12, background: zero ? C.warnBg : C.bg }}>
            {zero ? (
              <><span className="text-xs" style={{ color: C.warn }}>⚡ tolerance 0% — presence alone is enough.</span><button onClick={() => { onReport({ leafId: node.id, mode: "Presence", raw: 1 }); setOpen(null); }} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.bad, color: C.onDark }}>Present</button></>
            ) : (
              <>
                {[["PieceCount", "pieces", totals.pieces > 0], ["DirectWeight", "grams", totals.weight > 0], ["WholeUnitCount", "whole CU", totals.cu > 0]].map(([k, l, ok]) => <button key={k} disabled={!ok} onClick={() => setMode(k)} title={ok ? "" : "no divisor — fill in the conversion in the sample"} className="text-xs px-2 py-1 rounded" style={{ background: !ok ? C.line : mode === k ? C.accent : C.surface, color: !ok ? C.muted : mode === k ? C.onDark : C.accent, border: `1px solid ${ok ? C.accent : C.line}` }}>{l}</button>)}
                <input type="number" autoFocus value={raw} onChange={e => setRaw(e.target.value)} onKeyDown={e => e.key === "Enter" && raw !== "" && submit(node.id)} placeholder="how many" className="w-16 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} />
                <span className="text-xs" style={{ color: C.muted }}>{unitOf(mode)}</span>
                <button onClick={() => raw !== "" && submit(node.id)} className="text-xs px-2 py-1 rounded font-medium" style={{ background: C.accent, color: C.onDark }}>Report</button>
              </>
            )}
          </div>
        )}
        {kidsOf(problems, node.id).map(render)}
      </div>
    );
  };
  return (
    <div className="mb-4">
      {render(root)}
      {disabled ? <p className="text-xs mt-2" style={{ color: C.bad }}>Reporting blocked — no sample size.</p> : <p className="text-xs mt-1.5" style={{ color: C.muted }}>Tap a problem name to report.</p>}
    </div>
  );
}

function SampleBlock({ sample, setSample, totals }) {
  // Fixed 2×2 grid, not 4-in-a-row: on a phone width, 4 columns forced "Pieces per CU" to wrap onto two lines while
  // the other labels stayed on one, so that column's row (all 4 stretch to the tallest cell) pushed its input down
  // and out of line with the rest. Two columns give every label enough room to stay on one line.
  const F = ({ k, label, unit }) => <label className="text-xs flex flex-col gap-1" style={{ color: C.muted }}>{label}<span className="flex items-center gap-1"><input type="number" value={sample[k]} onChange={e => setSample(x => ({ ...x, [k]: e.target.value }))} className="w-full text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /><span>{unit}</span></span></label>;
  return (
    <div className="rounded-lg p-3" style={{ background: C.accentSoft }}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-2">
        <F k="tu" label="Checked TU" unit="TU" /><F k="cusPerTu" label="CU / TU" unit="CU" /><F k="piecesPerCu" label="pcs / CU" unit="pcs" /><F k="weightPerCu" label="CU weight" unit="g" />
      </div>
      <p className="text-xs" style={{ color: C.accent, fontVariantNumeric: "tabular-nums" }}>Sample: <b>{totals.cu} CU · {totals.pieces} pcs · {fmt(totals.weight)} g</b> — the divisor for all percentages. Defaults from the product profile, can be overridden.</p>
    </div>
  );
}
// Comment from remarks: groups by leaf parent, gives sum and components, ends with a verdict.

const generateComment = (problems, overrides, remarks, totals, generalFlag) => {
  if (!remarks.length && !generalFlag) return "Good quality, no remarks.";
  const pm = byId(problems);
  const groups = new Map();
  remarks.forEach(r => { const leaf = pm[r.leafId]; if (!leaf) return; const key = leaf.parentId || leaf.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
  const parts = [];
  groups.forEach((rs, key) => {
    const node = pm[key], tol = effTol(problems, overrides, key), sum = rs.reduce((a, r) => a + pct(r, totals), 0);
    const byLeaf = new Map(); rs.forEach(r => byLeaf.set(r.leafId, (byLeaf.get(r.leafId) || 0) + pct(r, totals)));
    const inner = [...byLeaf.entries()].map(([id, v]) => tol === 0 ? pm[id].name : `${pm[id].name} ${fmt(v)}%`).join(", ");
    const isRootLeaf = !pm[key].parentId && isLeaf(problems, key);
    parts.push(tol === 0 ? `${node.name}: ${inner} (present)` : isRootLeaf ? `${node.name} ${fmt(sum)}%` : `${node.name} ${fmt(sum)}% (${inner})`);
  });
  if (generalFlag) parts.push("general problem flagged");
  const exceeded = problems.some(p => statusOf(problems, overrides, remarks, p.id, totals) === "exceeded") || generalFlag;
  return `${parts.join("; ")} ${exceeded ? "— rejection." : "— but quality still acceptable."}`;
};

function ProblemOverview({ t, problems, remarks, totals }) {
  const pm = byId(problems);
  const refs = [...t.problemRefs].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean);
  const covered = new Set(refs.flatMap(n => [...subtree(problems, n.id)]));
  const extra = [...new Set(remarks.map(r => r.leafId).filter(id => !covered.has(id)))].map(id => pm[id]).filter(Boolean);
  const rows = [...refs, ...extra];
  if (!rows.length) return null;
  const Bar = ({ node }) => {
    const tol = effTol(problems, t.overrides, node.id), agg = aggregate(problems, remarks, node.id, totals), pr = presenceIn(problems, remarks, node.id);
    const st = statusOf(problems, t.overrides, remarks, node.id, totals), [fg, bg] = tone(st);
    const width = tol === 0 ? (pr ? 100 : 0) : tol ? Math.min(100, agg / tol * 100) : agg > 0 ? 100 : 0;
    const label = tol === 0 ? (pr ? "present" : "none") : `${fmt(agg)}%${tol !== null ? ` / ${tol}%` : ""}`;
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1"><span className="font-medium">{node.name}</span><span style={{ color: fg, fontWeight: 500 }}>{label}{tol === 0 && " ⚡"}</span></div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${width}%`, background: fg, transition: "width .2s" }} /></div>
      </div>
    );
  };
  return (
    <div className="rounded-lg p-3 mb-4" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      <p className="label-sm mb-2">Problem overview — bars show tolerance usage</p>
      {rows.map(n => <Bar key={n.id} node={n} />)}
      {extra.length > 0 && <p className="text-[10px] mt-1" style={{ color: C.muted }}>The last {extra.length} are problems raised from measurement fields, not attached to any module.</p>}
    </div>
  );
}


// Runner pracuje na rekordzie inspekcji ze stanu aplikacji (Inspections + odpowiedzi + remarki), nie na customm stanie.

function InspectionRunner({ insp, patch, t, problems, product, suppliers, dictionaries, sctx, user, onFinish, onEscalate, onRaiseFlag, onCancel }) {
  const itype = sctx ? inspType(sctx, insp) : { autoAccept: false, reason: "none", name: "Full", color: C.accent };
  const modules = [...t.modules].sort(bySort);
  const [tab, setTab] = useState(0);
  const [question, setQuestion] = useState(""); const [flagText, setFlagText] = useState(""); const [flagOpen, setFlagOpen] = useState(false); const [askCancel, setAskCancel] = useState(false);
  const [scanPalletIdx, setScanPalletIdx] = useState(null);
  // Pre-fill "Choice from list" fields from the product's attributes (once, on open); the controller can still change them.
  useEffect(() => { if (!sctx || !product || !t) return; const attrs = effectiveAttributes(sctx, product); if (!attrs.length) return;
    patch(prev => { const v = { ...(prev.values || {}) }; let changed = false; (t.fields || []).forEach(f => { if (f.type !== "List" || v[f.id] !== undefined) return; const a = attrs.find(x => x.dictionaryId === f.dictionaryId); if (a && a.value !== "—") { v[f.id] = a.value; changed = true; } }); return changed ? { ...prev, values: v } : prev; }); }, [insp.id]);
  const values = insp.values || {}, remarks = insp.remarks || [], sample = insp.sample, photos = insp.photos || {}, pallets = insp.pallets || [""];
  const set = p => patch(prev => ({ ...prev, ...p }));
  const setV = (id, v) => patch(prev => ({ ...prev, values: { ...(prev.values || {}), [id]: v } }));
  const setRemarks = fn => patch(prev => ({ ...prev, remarks: fn(prev.remarks || []) }));
  const setPhotos = fn => patch(prev => ({ ...prev, photos: fn(prev.photos || {}) }));
  const addPhotos = (key, got) => setPhotos(p => ({ ...p, [key]: [...asPhotoList(p[key]), ...got] }));
  const removePhoto = (key, id) => setPhotos(p => ({ ...p, [key]: asPhotoList(p[key]).filter(x => x.id !== id) }));
  const setPallets = fn => patch(prev => ({ ...prev, pallets: fn(prev.pallets || [""]) }));
  const setSample = fn => patch(prev => ({ ...prev, sample: typeof fn === "function" ? fn(prev.sample) : fn }));
  const assigned = (product.supplierIds || []).map(id => suppliers.find(x => x.id === id)).filter(Boolean);
  const productSuppliers = assigned.length ? assigned : suppliers;
  const suppliersUnrestricted = assigned.length === 0 && suppliers.length > 0;
  const cu = (Number(sample.tu) || 0) * (Number(sample.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(sample.piecesPerCu) || 0), weight: cu * (Number(sample.weightPerCu) || 0) };
  const hasSampleBlock = t.fields.some(f => f.type === "SampleSize");
  const sampleReady = hasSampleBlock && totals.cu > 0;
  const pm = byId(problems);
  const generalFlag = t.fields.some(f => f.type === "MultiChoice" && (f.options || []).some(o => o.trigger && (values[f.id] || []).includes(o.value)));
  const anyExceeded = problems.some(p => statusOf(problems, t.overrides, remarks, p.id, totals) === "exceeded");
  const escalated = insp.status === "PendingReview";
  const isSummary = tab === modules.length, m = modules[tab];
  const specs = effectiveSpecs(sctx, product);
  const editingCompleted = insp.status === "Completed";
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap text-xs" style={{ color: C.muted }}>
        <span className="px-2 py-0.5 rounded-full" style={{ background: STATUS[insp.status][2], color: STATUS[insp.status][1], fontWeight: 500 }}>{STATUS[insp.status][0]}</span>
        <span>controller: <b style={{ color: C.ink }}>{sctx.users.find(u => u.id === insp.controllerId)?.name}</b></span>
        <span>start {fmtTime(insp.startedAt)}</span>
        {insp.lastEditedBy && <span>· edited by <b style={{ color: C.ink }}>{sctx.users.find(u => u.id === insp.lastEditedBy)?.name}</b> {fmtTime(insp.lastEditedAt)}</span>}
        <div className="flex-1" />
        <button onClick={() => setFlagOpen(o => !o)} className="px-2 py-1 rounded-lg" style={{ background: C.warnBg, color: C.warn }}><Ic i={Flag} />Report a profile issue</button>
        {insp.status !== "Completed" && <button onClick={() => setAskCancel(o => !o)} className="px-2 py-1 rounded-lg" style={{ background: C.line, color: C.muted }}>Cancel inspection</button>}
      </div>
      {askCancel && <Note tone="bad"><div className="flex items-center gap-3 flex-wrap"><span>Cancel this inspection? It stays in history as cancelled.</span><button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.bad, color: C.onDark }}>Yes, cancel</button><button onClick={() => setAskCancel(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Keep working</button></div></Note>}
      {flagOpen && <div className="rounded-lg p-2 mb-3 flex gap-2 items-center" style={{ background: C.warnBg }}><input value={flagText} onChange={e => setFlagText(e.target.value)} placeholder="what's wrong with this product profile? (wrong supplier, code, spec…)" className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} /><Primary small onClick={() => { if (flagText.trim()) { onRaiseFlag(flagText.trim()); setFlagText(""); setFlagOpen(false); } }}>Send to the Head</Primary></div>}
      {sctx.announcements.filter(a => annMatchesProduct(sctx, a, product)).map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b> — {a.body}</Note>)}
      {escalated && <Note tone="warn">⏸ Paused — question for the Head: <i>„{insp.question}"</i>. You can keep filling in; the result is locked until answered.</Note>}
      {insp.answer && insp.status !== "PendingReview" && <Note tone="ok">💬 Head's answer: <i>„{insp.answer}"</i></Note>}
      <div className="flex gap-1 mb-3 border-b flex-wrap" style={{ borderColor: C.line }}>{[...modules.map(x => x.name), "Summary"].map((name, i) => <button key={i} onClick={() => setTab(i)} className="text-xs px-3 py-2" style={{ borderBottom: tab === i ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === i ? C.ink : C.muted, fontWeight: tab === i ? 500 : 400, marginBottom: -1, fontStyle: i === modules.length ? "italic" : "normal" }}>{name}</button>)}</div>
      {generalFlag && <Note tone="bad">🚩 General problem reported — inspection flagged.</Note>}
      {!isSummary && m && (
        <div>
          {t.fields.filter(f => f.moduleId === m.id).sort(bySort).map(f => (
            <div key={f.id} className="mb-4">
              {f.type !== "ProductInfo" && <label className="block text-sm font-medium mb-1">{fieldLabel(f)}{f.required && !isSystem(f.type) && <span style={{ color: C.bad }}> *</span>}{f.helper && <span className="block text-xs font-normal" style={{ color: C.muted }}>{f.helper}</span>}</label>}
              {f.type === "ProductInfo" && <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="font-semibold">{product.name}{product.isBio && <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: C.okBg, color: C.ok }}>bio</span>}</p><p className="text-xs mt-1" style={{ color: C.muted }}>{specs.length ? specs.map(q => `${q.name}: ${specLabel(q)}${q.source !== "product" ? " (" + q.source + ")" : ""}`).join(" · ") : "no specifications"}</p></div>}
              {f.type === "Supplier" && (productSuppliers.length ? <div><div className="flex flex-wrap gap-1.5">{productSuppliers.map(x => <button key={x.id} onClick={() => set({ supplier: x.name })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: insp.supplier === x.name ? C.accent : C.accentSoft, color: insp.supplier === x.name ? C.onDark : C.accent }}>{x.name}</button>)}</div>{suppliersUnrestricted && <p className="text-[10px] mt-1" style={{ color: C.muted }}>product has no assigned suppliers — showing all</p>}</div> : <p className="text-xs" style={{ color: C.warn }}>The supplier list is empty — fill it in Dictionaries → Suppliers.</p>)}
              {f.type === "Variety" && (effectiveVarieties(sctx, product).length ? <div className="flex flex-wrap gap-1.5">{effectiveVarieties(sctx, product).map(v => <button key={v.id} onClick={() => set({ variety: v.name })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: insp.variety === v.name ? C.accent : C.accentSoft, color: insp.variety === v.name ? C.onDark : C.accent }}>{v.name}</button>)}</div> : <p className="text-xs" style={{ color: C.warn }}>No varieties — add them on the category or the product.</p>)}
              {f.type === "List" && (() => {
                const d = (dictionaries || sctx?.dictionaries || []).find(x => x.id === f.dictionaryId);
                const preset = sctx && product ? effectiveAttributes(sctx, product).find(a => a.dictionaryId === f.dictionaryId) : null;
                if (!d) return <p className="text-xs" style={{ color: C.warn }}>No list attached to this field — the Head must pick one in the form builder.</p>;
                if (!d.items.length) return <p className="text-xs" style={{ color: C.warn }}>The list "{d.name}" is empty — fill it in Dictionaries → Lists.</p>;
                // Short lists stay one-tap pill buttons; longer ones (the Head can attach a 70-item list) become a real dropdown so it doesn't turn into a wall of buttons.
                const picker = d.items.length > 6
                  ? <select value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }}><option value="">— choose ({d.items.length} options) —</option>{d.items.map(o => <option key={o.id} value={o.value}>{o.value}</option>)}</select>
                  : <div className="flex flex-wrap gap-1.5">{d.items.map(o => <button key={o.id} onClick={() => setV(f.id, o.value)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: values[f.id] === o.value ? C.accent : C.accentSoft, color: values[f.id] === o.value ? C.onDark : C.accent }}>{o.value}</button>)}</div>;
                return <div>{picker}{preset && <p className="text-[11px] mt-1" style={{ color: C.muted }}>Pre-filled from the product profile ({preset.source}: {preset.value}){values[f.id] && values[f.id] !== preset.value ? " — changed on the dock" : ""}.</p>}</div>;
              })()}
              {f.type === "Pallet" && <div>{pallets.map((p, i) => <div key={i} className="flex gap-1.5 mb-1.5"><input value={p} onChange={e => setPallets(ps => ps.map((x, j) => j === i ? e.target.value : x))} placeholder={`pallet ${i + 1}`} className="flex-1 text-sm rounded px-2 py-1.5 outline-none font-mono" style={{ ...inp }} /><button onClick={() => setScanPalletIdx(i)} className="text-xs px-2 rounded" style={{ background: C.accentSoft, color: C.accent }} title="scan pallet barcode (SSCC)"><Ic i={ScanLine} s={13} mr={0} /></button>{pallets.length > 1 && <button onClick={() => setPallets(ps => ps.filter((_, j) => j !== i))} className="text-xs px-1" style={{ color: C.muted }}>×</button>}</div>)}<button onClick={() => setPallets(ps => [...ps, ""])} className="text-xs" style={{ color: C.accent }}>+ another pallet</button><DeliveryPallets product={product} insp={insp} onAdd={hus => setPallets(ps => [...ps.filter(Boolean), ...hus.filter(h => !ps.includes(h))])} />
                {scanPalletIdx !== null && (
                  <Modal open>
                    <p className="text-sm font-semibold mb-2">Scan pallet {scanPalletIdx + 1}</p>
                    <LiveScanner onCode={code => { const sscc = extractSSCC(code); setPallets(ps => ps.map((x, j) => j === scanPalletIdx ? sscc : x)); setScanPalletIdx(null); }} />
                    <button onClick={() => setScanPalletIdx(null)} className="w-full py-2 text-sm" style={{ color: C.muted }}>Cancel</button>
                  </Modal>
                )}
              </div>}
              {f.type === "DateCode" && <div><input type="date" value={insp.dateISO || ""} onChange={e => set({ dateISO: e.target.value })} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />{insp.dateISO && <p className="text-xs mt-1.5" style={{ color: C.muted }}>saved as date code: <b style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{dateCode(insp.dateISO)}</b> (week {dateCode(insp.dateISO).slice(0, -1)}, day {dateCode(insp.dateISO).slice(-1)})</p>}</div>}
              {f.type === "SampleSize" && <SampleBlock sample={sample} setSample={setSample} totals={totals} />}
              {f.type === "Photos" && <PhotoStrip photos={photos[f.id]} onAdd={got => addPhotos(f.id, got)} onRemove={id => removePhoto(f.id, id)} />}
              {f.type === "Escalate" && (escalated ? <p className="text-xs" style={{ color: C.warn }}>⏸ Already paused.</p> : <div className="flex gap-1.5"><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="what to you want to ask the Head?" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><button onClick={() => { if (question.trim()) { onEscalate(question.trim()); setQuestion(""); } }} className="text-sm px-3 py-2 rounded-lg" style={{ background: C.warnBg, color: C.warn, border: `1px solid ${C.warn}` }}><Ic i={HelpCircle} />Ask the Head</button></div>)}
              {f.type === "Text" && <input value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
              {f.type === "Date" && <input type="date" value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
              {f.type === "SingleChoice" && <div className="flex flex-wrap gap-1.5">{(f.options || []).map(o => <button key={o} onClick={() => setV(f.id, o)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: values[f.id] === o ? C.accent : C.accentSoft, color: values[f.id] === o ? C.onDark : C.accent }}>{o}</button>)}</div>}
              {f.type === "MultiChoice" && <div className="flex flex-col gap-1">{(f.options || []).map(o => { const on = (values[f.id] || []).includes(o.value); return <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={on} onChange={e => setV(f.id, e.target.checked ? [...(values[f.id] || []), o.value] : (values[f.id] || []).filter(x => x !== o.value))} />{o.value}{o.trigger && " 🚩"}</label>; })}</div>}
              {f.type === "Scale" && <div className="flex gap-1">{Array.from({ length: f.scaleMax || 5 }, (_, i) => i + 1).map(k => <button key={k} onClick={() => setV(f.id, k)} className="w-8 h-8 rounded-lg text-sm" style={{ background: values[f.id] === k ? C.accent : C.accentSoft, color: values[f.id] === k ? C.onDark : C.accent }}>{k}</button>)}</div>}
              {f.type === "Number" && <NumberInput piecesPerCu={insp.sample?.piecesPerCu || product?.piecesPerCu} f={f} problems={problems} overrides={t.overrides} specs={specs} totals={totals} value={values[f.id]} onChange={v => setV(f.id, v)} onRaise={(leafId, mode, raw) => setRemarks(r => [...r, { id: uid(), leafId, mode, raw, auto: true, fieldId: f.id }])} raised={remarks.some(r => r.auto && r.fieldId === f.id)} />}
              {f.allowPhotos && !isSystem(f.type) && <div className="mt-1.5"><PhotoStrip photos={photos[f.id]} onAdd={got => addPhotos(f.id, got)} onRemove={id => removePhoto(f.id, id)} size={48} /></div>}
            </div>
          ))}
          {t.problemRefs.filter(r => r.moduleId === m.id).length > 0 && !sampleReady && <Note tone="bad">{hasSampleBlock ? "Sample size gives 0 CU — fill in the “Sample size” block to compute percentages." : "This template has no “Sample size” block — the Head must add it."}</Note>}
          {t.problemRefs.filter(r => r.moduleId === m.id).sort(bySort).map(r => pm[r.problemTypeId] && <ProblemTreeView key={r.id} root={pm[r.problemTypeId]} problems={problems} overrides={t.overrides} remarks={remarks} totals={totals} disabled={!sampleReady} notes={product ? (sctx.problemNotes || []).filter(n => n.productId === product.id) : []} onReport={rem => setRemarks(x => [...x, { id: uid(), ...rem }])} onDelete={id => setRemarks(x => x.filter(q => q.id !== id))} onPhoto={async id => { const got = await pickPhotos(); if (got.length) setRemarks(x => x.map(q => q.id === id ? { ...q, photos: [...asPhotoList(q.photos), ...got] } : q)); }} onRemovePhoto={(id, pid) => setRemarks(x => x.map(q => q.id === id ? { ...q, photos: asPhotoList(q.photos).filter(ph => ph.id !== pid) } : q))} />)}
          {t.fields.filter(f => f.moduleId === m.id).length + t.problemRefs.filter(r => r.moduleId === m.id).length === 0 && <p className="text-sm" style={{ color: C.muted }}>Empty module.</p>}
        </div>
      )}
      {isSummary && (
        <div>
          {(() => { const all = product ? sameDeliveryPallets(product, insp) : []; const left = all.basis === "none" ? [] : all.filter(r => r.sameDay !== false); return left.length ? <div className="mb-3"><p className="text-xs mb-1" style={{ color: C.muted }}>Before you finish:</p><DeliveryPallets product={product} insp={insp} onAdd={hus => setPallets(ps => [...ps.filter(Boolean), ...hus.filter(h => !ps.includes(h))])} /></div> : null; })()}
          <Note tone={escalated ? "warn" : anyExceeded || generalFlag ? "bad" : remarks.length ? "warn" : "ok"}>{escalated ? "Paused — awaiting the Head." : anyExceeded ? "Tolerance exceeded — the system suggests rejection." : generalFlag ? "General problem flagged — the system suggests rejection." : remarks.length ? "Problems within tolerance." : "No problems."}</Note>
          <ProblemOverview t={t} problems={problems} remarks={remarks} totals={totals} />
          <div className="text-xs mb-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>{insp.supplier && <span>supplier: <b style={{ color: C.ink }}>{insp.supplier}</b></span>}{insp.variety && <span>variety: <b style={{ color: C.ink }}>{insp.variety}</b></span>}{insp.country && <span>country: <b style={{ color: C.ink }}>{insp.country}</b></span>}{pallets.filter(Boolean).length > 0 && <span>pallets: <b style={{ color: C.ink }}>{pallets.filter(Boolean).join(", ")}</b></span>}{insp.dateISO && <span>date code: <b style={{ color: C.ink }}>{dateCode(insp.dateISO)}</b></span>}<span>sample: <b style={{ color: C.ink }}>{totals.cu} CU</b></span></div>
          {remarks.map(r => <div key={r.id} className="flex items-center gap-2 text-sm py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{pathOf(problems, r.leafId)}{r.auto && <span className="text-xs" style={{ color: C.muted }}> (from measurement)</span>}</span><span className="text-xs" style={{ color: C.muted }}>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</span><span>{r.mode === "Presence" ? "⚡" : `${fmt(pct(r, totals))}%`}</span><button onClick={() => setRemarks(x => x.filter(q => q.id !== r.id))} className="text-xs px-1" style={{ color: C.bad }} title="delete">×</button></div>)}
          <div className="flex items-center justify-between mt-4 mb-1"><label className="text-sm font-medium">Comment</label><Ghost onClick={() => set({ comment: generateComment(problems, t.overrides, remarks, totals, generalFlag) })}><Ic i={Sparkles} s={13} />Generate from remarks</Ghost></div>
          <textarea value={insp.comment || ""} onChange={e => set({ comment: e.target.value })} rows={3} placeholder="optional — or generate and edit" className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
          {itype.reason && itype.reason !== "none" && <div className="mt-4"><p className="text-sm font-medium mb-1">Reason {itype.reason === "required" ? <span style={{ color: C.bad }}>*</span> : <span className="text-xs font-normal" style={{ color: C.muted }}>(optional)</span>}</p><div className="flex flex-wrap gap-1.5">{SKIP_REASONS.map(r => <button key={r} onClick={() => set({ skipReason: insp.skipReason === r ? null : r })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: insp.skipReason === r ? C.ink : "transparent", color: insp.skipReason === r ? C.onDark : C.ink, border: `1px solid ${insp.skipReason === r ? C.ink : C.line}` }}>{r}</button>)}</div></div>}
          {itype.autoAccept && <Note tone="ok">{itype.name}: finishing records “Accepted” — no verdict needed. Problems you report still go to the Head.</Note>}
          {!itype.autoAccept && <div className="flex gap-2 mt-4">{[["Accepted", "Accept", C.ok, C.okBg], ["Rejected", "Reject", C.bad, C.badBg]].map(([v, l, fg, bg]) => <button key={v} onClick={() => !escalated && set({ result: v })} disabled={escalated} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: escalated ? C.line : insp.result === v ? fg : bg, color: escalated ? C.muted : insp.result === v ? C.onDark : fg }}>{l}</button>)}</div>}
          {insp.result === "Accepted" && (anyExceeded || generalFlag) && <p className="text-xs mt-2" style={{ color: C.warn }}>Accepted despite the numbers — the Head will be notified. Status and decision are independent axes.</p>}
          <div className="mt-4 flex items-center gap-3">
            <Primary onClick={() => { if (itype.autoAccept && !insp.result) set({ result: "Accepted" }); onFinish({ anyExceeded, generalFlag, autoAccept: itype.autoAccept }); }} disabled={escalated || (!itype.autoAccept && !insp.result) || (itype.reason === "required" && !insp.skipReason)}>{editingCompleted ? "Save changes (audited)" : itype.autoAccept ? `Finish — ${itype.name.toLowerCase()} done` : "Finish inspection"}</Primary>
            {!itype.autoAccept && !insp.result && !escalated && <span className="text-xs" style={{ color: C.muted }}>choose a result to finish</span>}
            {itype.reason === "required" && !insp.skipReason && <span className="text-xs" style={{ color: C.muted }}>pick a reason to finish</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function ReportView({ insp, s, onEdit, onAnswer, user, onMarkReference }) {
  const [printing, setPrinting] = useState(false);
  const product = s.products.find(p => p.id === insp.productId), t = insp.template, problems = problemsFor(s, { kind: "Product", id: insp.productId }, new Set((t && t.suppressed) || []));
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const [ans, setAns] = useState("");
  const [fg, bg] = insp.result === "Accepted" ? [C.ok, C.okBg] : insp.result === "Rejected" ? [C.bad, C.badBg] : [C.muted, C.line];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: STATUS[insp.status][2], color: STATUS[insp.status][1], fontWeight: 500 }}>{STATUS[insp.status][0]}</span>
        {insp.result && <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: bg, color: fg, fontWeight: 500 }}>{insp.result === "Accepted" ? "Accepted" : "Rejected"}</span>}
        <span className="text-sm font-semibold">{product?.name}</span>
        <div className="flex-1" />
        {insp.isReference && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}><Ic i={Star} s={12} mr={4} />reference</span>}
        {insp.status === "Completed" && user.role === "Head" && onMarkReference && <Ghost onClick={onMarkReference}>{insp.isReference ? <><Ic i={Star} s={13} />Unmark reference</> : <><Ic i={Star} s={13} />Mark as reference</>}</Ghost>}
        {insp.status === "Completed" && <Ghost onClick={() => setPrinting(true)}><Ic i={Printer} s={13} />Export PDF</Ghost>}
        {insp.status === "Completed" && <Ghost onClick={onEdit}><Ic i={Pencil} s={13} />Edit report</Ghost>}
      </div>
      {printing && <PdfViewer insp={insp} s={s} onClose={() => setPrinting(false)} />}
      <div className="text-xs mb-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>
        <span>controller <b style={{ color: C.ink }}>{s.users.find(u => u.id === insp.controllerId)?.name}</b></span><span>start {fmtTime(insp.startedAt)}</span>{insp.completedAt && <span>finished {fmtTime(insp.completedAt)}</span>}
        {insp.supplier && <span>supplier <b style={{ color: C.ink }}>{insp.supplier}</b></span>}{insp.variety && <span>variety <b style={{ color: C.ink }}>{insp.variety}</b></span>}{insp.country && <span>country <b style={{ color: C.ink }}>{insp.country}</b></span>}{(insp.pallets || []).filter(Boolean).length > 0 && <span>pallets <b style={{ color: C.ink }}>{insp.pallets.filter(Boolean).join(", ")}</b></span>}{insp.dateISO && <span>date code <b style={{ color: C.ink }}>{dateCode(insp.dateISO)}</b></span>}<span>sample <b style={{ color: C.ink }}>{totals.cu} CU</b></span>
      </div>
      {insp.status === "PendingReview" && (
        <div className="rounded-lg p-3 mb-3" style={{ background: C.warnBg }}>
          <p className="text-sm mb-2" style={{ color: C.warn }}><Ic i={HelpCircle} s={14} />Controller's question: <i>„{insp.question}"</i></p>
          {user.role === "Head" ? <div className="flex gap-2"><input value={ans} onChange={e => setAns(e.target.value)} placeholder="answer — goes back to the controller, inspection returns to draft" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><Primary small onClick={() => { if (ans.trim()) { onAnswer(ans.trim()); setAns(""); } }}>Answer</Primary></div> : <p className="text-xs" style={{ color: C.muted }}>Awaiting the Head's answer.</p>}
        </div>
      )}
      {insp.answer && <Note tone="ok">💬 Head's answer: <i>„{insp.answer}"</i></Note>}
      {t && <ProblemOverview t={t} problems={problems} remarks={insp.remarks || []} totals={totals} />}
      {(insp.remarks || []).map(r => <div key={r.id} className="flex items-center gap-2 text-sm py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{pathOf(problems, r.leafId)}{r.auto && <span className="text-xs" style={{ color: C.muted }}> (from measurement)</span>}</span><span className="text-xs" style={{ color: C.muted }}>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</span><span>{r.mode === "Presence" ? "⚡" : `${fmt(pct(r, totals))}%`}</span></div>)}
      {insp.comment && <div className="rounded-lg p-3 mt-3 text-sm" style={{ background: C.bg }}>{insp.comment}</div>}
      {(() => { const groups = []; (t?.fields || []).forEach(f => { const ph = asPhotoList((insp.photos || {})[f.id]); if (ph.length) groups.push({ key: f.id, label: f.type === "Photos" ? `Module photos: ${(t.modules.find(m => m.id === f.moduleId) || {}).name || ""}` : f.label, photos: ph }); }); (insp.remarks || []).forEach(r => { const ph = asPhotoList(r.photos); if (ph.length) groups.push({ key: r.id, label: `Problem: ${pathOf(problems, r.leafId)}`, photos: ph }); }); return <div className="mt-4"><p className="label-sm mb-2">Photos</p>{groups.length ? groups.map(g => <div key={g.key} className="mb-2"><p className="text-xs mb-1" style={{ color: C.muted }}>{g.label}</p><PhotoStrip photos={g.photos} size={72} /></div>) : <p className="text-xs" style={{ color: C.muted }}>No photos in this inspection.</p>}</div>; })()}
      {(insp.audit || []).length > 0 && (
        <div className="mt-4">
          <p className="label-sm mb-1">Audit trail</p>
          {insp.audit.map((a, i) => <div key={i} className="text-xs py-1" style={{ borderTop: `1px solid ${C.line}`, color: C.muted }}>{fmtTime(a.at)} · <b style={{ color: C.ink }}>{s.users.find(u => u.id === a.userId)?.name}</b> · {a.action}{a.details ? ` — ${a.details}` : ""}</div>)}
        </div>
      )}
    </div>
  );
}

function BlockingOverlay({ s, set, user }) {
  const pending = s.announcements.filter(a => a.isBlocking && user.role === "Controller" && !(a.acks || {})[user.id]);
  if (!pending.length) return null;
  const a = pending[0];
  const ack = () => set(x => ({ ...x, announcements: x.announcements.map(y => y.id === a.id ? { ...y, acks: { ...(y.acks || {}), [user.id]: nowISO() } } : y) }));
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(31,42,36,0.75)", zIndex: 50 }}>
      <div className="rounded-2xl p-6 max-w-md w-full" style={{ background: C.surface }}>
        <p className="text-xs font-semibold mb-2" style={{ color: C.bad }}><Ic i={Megaphone} s={13} />Blocking announcement · {pending.length > 1 ? `1 of ${pending.length}` : "requires acknowledgement"}</p>
        <p className="text-lg font-semibold mb-2">{a.title}</p>
        <p className="text-sm mb-4">{a.body}</p>
        <p className="text-xs mb-4" style={{ color: C.muted }}>{s.users.find(u => u.id === a.createdBy)?.name} · {fmtTime(a.createdAt)}</p>
        <Primary onClick={ack}>I have read and acknowledge</Primary>
      </div>
    </div>
  );
}

const unreadIn = (conv, userId) => { const last = (conv.lastRead || {})[userId] || ""; return (conv.messages || []).filter(m => m.senderId !== userId && (m.at || "") > last).length; };

const convName = (conv, s, userId) => conv.name || conv.participantIds.filter(id => id !== userId).map(id => s.users.find(u => u.id === id)?.name).join(", ") || "(empty)";

const SEED_USERS = () => [{ id: "u-head", name: "Aleksandra Chełmińska", firstName: "Aleksandra", lastName: "Chełmińska", email: "aleksandra.chelminska@qc.local", role: "Head", active: true }, { id: "u-anna", name: "Damian Mrówka", firstName: "Damian", lastName: "Mrówka", email: "damian.mrowka@qc.local", role: "Controller", active: true }, { id: "u-jakub", name: "Snizhana Myshkina", firstName: "Snizhana", lastName: "Myshkina", email: "snizhana.myshkina@qc.local", role: "Controller", active: true }];

const EMPTY = { categories: [], problems: [], problemNotes: [], products: [], templates: [], suppliers: [], countries: [], users: SEED_USERS(), inspections: [], flags: [], notifications: [], announcements: [], conversations: [], dictionaries: [], inspectionTypes: SEED_TYPES(), settings: { defaultPolicy: "Visual", skipReasonRequired: false } };

// Migration of older exports: product.suppliers as names → global list + supplierIds

const normalize = raw => {
  const s = { ...EMPTY, ...raw };
  s.suppliers = Array.isArray(s.suppliers) ? s.suppliers : [];
  s.users = Array.isArray(s.users) && s.users.length ? s.users : SEED_USERS();
  s.inspections = (Array.isArray(s.inspections) ? s.inspections : []).map(i => ({ ...i, type: i.type || "Full", photos: Object.fromEntries(Object.entries(i.photos || {}).map(([k, v]) => [k, asPhotoList(v)])), remarks: (i.remarks || []).map(r => ({ ...r, photos: asPhotoList(r.photos) })) }));
  s.flags = Array.isArray(s.flags) ? s.flags : [];
  s.notifications = Array.isArray(s.notifications) ? s.notifications : [];
  s.announcements = (Array.isArray(s.announcements) ? s.announcements : []).map(a => a.type ? (({ type, ...r }) => ({ ...r, isBlocking: type === "Blocking", showOnDashboard: type === "General", productId: type === "Product" ? r.productId : null }))(a) : a);
  s.conversations = Array.isArray(s.conversations) ? s.conversations : [];
  s.integrations = Array.isArray(s.integrations) ? s.integrations : [];
  { const seed = byId(SEED_USERS()); const placeholders = { "u-head": "Marta K.", "u-anna": "Anna K.", "u-jakub": "Jakub M." }; s.users = (s.users || []).map(u => placeholders[u.id] && u.name === placeholders[u.id] ? { ...u, ...seed[u.id] } : u); }
  s.categoryRules = Array.isArray(s.categoryRules) ? s.categoryRules : [];
  s.palletClaims = s.palletClaims && typeof s.palletClaims === "object" ? s.palletClaims : {};
  s.settings = settingsOf(s);
  s.inspectionTypes = Array.isArray(s.inspectionTypes) ? s.inspectionTypes : [];
  // Migration: drop the previously seeded types (and their auto-generated templates) when nothing uses them — the Head defines types from scratch.
  { const used = new Set((s.inspections || []).map(i => i.typeId || legacyTypeId(i.type)));
    const seededTpl = t => (t.typeId === "type-visual" || t.typeId === "type-skip") && t.scope === "Global" && (t.modules || []).length === 1 && ["Visual check", "Skip"].includes(t.modules[0]?.name) && (t.problemRefs || []).length === 0;
    s.templates = (s.templates || []).filter(t => !seededTpl(t));
    s.inspectionTypes = s.inspectionTypes.filter(t => !(["type-visual", "type-skip"].includes(t.id) && !used.has(t.id)) && !(t.id === "type-full" && !used.has(t.id) && !(s.templates || []).some(x => (x.typeId || "type-full") === "type-full"))); }
  s.templates = (s.templates || []).map(t => ({ ...t, typeId: t.typeId || "type-full" }));
  s.inspections = (s.inspections || []).map(i => ({ ...i, typeId: i.typeId || legacyTypeId(i.type) }));
  const fromEnum = lvl => lvl === "Full" ? ["type-full"] : lvl === "Visual" ? ["type-full", "type-visual"] : lvl === "Skip" ? ["type-full", "type-visual", "type-skip"] : null;
  s.categories = s.categories.map(c => c.inspectionPolicy && !Array.isArray(c.allowedTypeIds) ? { ...c, allowedTypeIds: fromEnum(c.inspectionPolicy), inspectionPolicy: undefined } : c);
  s.products = s.products.map(p => p.inspectionPolicy && !Array.isArray(p.allowedTypeIds) ? { ...p, allowedTypeIds: fromEnum(p.inspectionPolicy), inspectionPolicy: undefined } : p);

  s.categories = (s.categories || []).map(c => ({ ...c, specs: c.specs || [], varieties: c.varieties || [] }));
  s.problems = (s.problems || []).map(p => ({ ...p, categoryId: p.categoryId || null, productId: p.productId || null }));
  s.categories = s.categories.map(c => ({ ...c, hiddenProblemIds: c.hiddenProblemIds || [] }));
  // Reference guide: per-product notes (description + photos) on a problem type, written by the Head, shown to controllers.
  s.problemNotes = (Array.isArray(s.problemNotes) ? s.problemNotes : []).map(n => ({ ...n, photos: asPhotoList(n.photos), description: n.description || "" }));
  s.countries = Array.isArray(s.countries) ? s.countries : [];
  s.dictionaries = Array.isArray(s.dictionaries) ? s.dictionaries : [];
  if (!s.dictionaries.length && s.countries.length) s.dictionaries = [{ id: "dict-countries", name: "Countries", items: s.countries.map(c => ({ id: c.id, value: c.name })), isActive: true }];
  const countriesDict = s.dictionaries.find(d => d.name === "Countries");
  const migrateFields = fields => (fields || []).map(f => f.type === "CountryOfOrigin" ? { ...f, type: "List", dictionaryId: f.dictionaryId || countriesDict?.id || null } : f);
  s.templates = (s.templates || []).map(t => ({ ...t, fields: migrateFields(t.fields) }));
  s.inspections = (s.inspections || []).map(i => i.template ? { ...i, template: { ...i.template, fields: migrateFields(i.template.fields) } } : i);
  s.products = (s.products || []).map(p => {
    let q = p;
    if (Array.isArray(q.suppliers) && q.suppliers.length && typeof q.suppliers[0] === "string") {
      const ids = q.suppliers.map(name => { let sup = s.suppliers.find(x => x.name === name); if (!sup) { sup = { id: uid(), name }; s.suppliers.push(sup); } return sup.id; });
      const { suppliers: _, ...rest } = q;
      q = { ...rest, supplierIds: ids };
    }
    // Old specifications with a single "target" → minimum (all previous ones were "below = bad")
    const specs = (q.specs || []).map(sp => sp.target !== undefined && sp.min === undefined && sp.max === undefined ? { id: sp.id, name: sp.name, unit: sp.unit, min: sp.target, max: null } : sp);
    return { ...q, supplierIds: q.supplierIds || [], varieties: q.varieties || [], specs, articleId: q.articleId || "", hiddenProblemIds: q.hiddenProblemIds || [], photos: asPhotoList(q.photos), barcodeCu: q.barcodeCu || q.barcode || "", barcodeTu: q.barcodeTu || "", consumerAppUrl: q.consumerAppUrl || "", isActive: q.isActive !== false, excludedSpecNames: q.excludedSpecNames || [], attributes: q.attributes || [] };
  });
  s.templates = (s.templates || []).map(t => ({ ...t, fields: (t.fields || []).map(f => f.problemId !== undefined && f.problemBelowId === undefined ? (({ problemId, ...rest }) => ({ ...rest, problemBelowId: problemId || null, problemAboveId: null }))(f) : f) }));
  return sortState(migrateLayered(s));
};

const seedState = () => {
  const jab = uid(), tom = uid(), q = uid(), maj = uid(), min = uid(), g = uid(), pal = uid(), uw = uid();
  const els = uid(), gala = uid(), specE = uid(), specG = uid();
  const mPal = uid(), mPar = uid(), mQ = uid(), mG = uid();
  const supE = uid(), supG = uid(), supN = uid(), cES = uid(), cMA = uid(), cNL = uid();
  const seed = {
    users: SEED_USERS(), inspections: [], flags: [], notifications: [], announcements: [], conversations: [],
    categories: [{ id: jab, name: "Apples", parentId: null, specs: [{ id: uid(), name: "Firmness", unit: "Lb", min: 5, max: 8 }], varieties: [{ id: uid(), name: "Elstar" }, { id: uid(), name: "Gala" }] }, { id: tom, name: "Tomatoes", parentId: null, specs: [], varieties: [] }],
    suppliers: [{ id: supE, name: "El Ciruelo" }, { id: supG, name: "Gartenfrisch" }, { id: supN, name: "Nature's Pride" }],
    countries: [{ id: cES, name: "Spain" }, { id: cMA, name: "Morocco" }, { id: cNL, name: "Netherlands" }],
    problems: [
      { id: q, parentId: null, name: "Quality problems", tolerance: null }, { id: maj, parentId: q, name: "Major", tolerance: 1 }, { id: uid(), parentId: maj, name: "decay", tolerance: null }, { id: uw, parentId: maj, name: "underweight", tolerance: null },
      { id: min, parentId: q, name: "Minor", tolerance: 10 }, { id: uid(), parentId: min, name: "color defect", tolerance: null },
      { id: g, parentId: null, name: "General problems", tolerance: null }, { id: pal, parentId: g, name: "Pallet", tolerance: 5 }, { id: uid(), parentId: pal, name: "broken pallet", tolerance: 0 },
    ],
    products: [{ id: els, name: "Elstar apple 1kg", categoryId: jab, isBio: false, cusPerTu: 6, piecesPerCu: 8, weightPerCu: 1000, specs: [{ id: specE, name: "CU weight", unit: "g", min: 1000, max: null }, { id: uid(), name: "Firmness", unit: "Lb", min: 5, max: 8 }], supplierIds: [supE, supG], varieties: [] }, { id: gala, name: "Gala apple 1.5kg", categoryId: jab, isBio: true, cusPerTu: 4, piecesPerCu: 12, weightPerCu: 1500, specs: [{ id: specG, name: "CU weight", unit: "g", min: 1500, max: null }], supplierIds: [supN] }],
    templates: [{
      id: uid(), scope: "Global", layered: true, suppressed: [], fieldOverrides: {},
      modules: [{ id: mPal, name: "Pallet", sort: 0 }, { id: mPar, name: "Parameters", sort: 1 }, { id: mQ, name: "Quality problems", sort: 2 }, { id: mG, name: "Pallet problems", sort: 3 }],
      fields: [
        { id: uid(), moduleId: mPal, sort: 0, type: "ProductInfo", label: "Product info", required: true },
        { id: uid(), moduleId: mPal, sort: 1, type: "Supplier", label: "Supplier", required: true },
        { id: uid(), moduleId: mPal, sort: 2, type: "Pallet", label: "Pallet numbers", required: true },
        { id: uid(), moduleId: mPal, sort: 3, type: "DateCode", label: "Packing date", required: true },
        { id: uid(), moduleId: mPar, sort: 0, type: "CountryOfOrigin", label: "Country of origin", required: true },
        { id: uid(), moduleId: mPar, sort: 1, type: "Number", label: "Firmness", required: false, measurementCount: 3, min: 2, max: 8, problemBelowId: null, problemAboveId: null, specId: null },
        { id: uid(), moduleId: mPar, sort: 2, type: "Number", label: "CU weight", required: true, measurementCount: 3, min: null, max: null, problemBelowId: uw, problemAboveId: null, specId: null },
        { id: uid(), moduleId: mPar, sort: 3, type: "Photos", label: "Module photos", required: false },
        { id: uid(), moduleId: mQ, sort: 0, type: "SampleSize", label: "Sample size", required: true },
        { id: uid(), moduleId: mQ, sort: 1, type: "Escalate", label: "Ask the Head", required: false },
        { id: uid(), moduleId: mG, sort: 0, type: "MultiChoice", label: "General pallet issues", required: false, options: [{ value: "Dirty pallet", trigger: true }, { value: "Unreadable label", trigger: false }] },
      ],
      problemRefs: [{ id: uid(), moduleId: mQ, problemTypeId: q, sort: 0 }, { id: uid(), moduleId: mG, problemTypeId: g, sort: 1 }],
      overrides: [],
    }],
  };
  return normalize(seed);
};


// Alphabetical order for all dictionary lists — in one place, on every state change

const byName = (a, b) => (a?.name || "").localeCompare(b?.name || "", "en", { sensitivity: "base", numeric: true });

const sortState = s => ({
  ...s,
  categories: [...(s.categories || [])].sort(byName).map(c => ({ ...c, specs: [...(c.specs || [])].sort(byName), varieties: [...(c.varieties || [])].sort(byName) })),
  products: [...(s.products || [])].sort(byName).map(p => ({ ...p, specs: [...(p.specs || [])].sort(byName), varieties: [...(p.varieties || [])].sort(byName) })),
  suppliers: [...(s.suppliers || [])].sort(byName),
  countries: [...(s.countries || [])].sort(byName),
  dictionaries: [...(s.dictionaries || [])].sort(byName),
  users: [...(s.users || [])].sort(byName),
});

// Net inspection time: start → finish minus every "Awaiting Head" pause (escalation → answer), read from the audit trail.
// Durations above 3 h are treated as outliers (draft left open) and excluded from averages.

const activeMinutes = insp => {
  if (!insp.startedAt || !insp.completedAt) return null;
  let total = new Date(insp.completedAt) - new Date(insp.startedAt);
  let pausedAt = null;
  (insp.audit || []).forEach(a => { if (a.action === "Escalation") pausedAt = new Date(a.at); else if (a.action === "Head's answer" && pausedAt) { total -= (new Date(a.at) - pausedAt); pausedAt = null; } });
  if (pausedAt) total -= (new Date(insp.completedAt) - pausedAt);
  return Math.max(0, total / 60000);
};

const avgActiveMinutes = list => { const d = list.map(activeMinutes).filter(m => m !== null && m <= 180); return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null; };
// Mock of the Google Sheets sync (E5) — 1:1 copy of the real 'Inbound quality check prioritization' sheet (16-09-2026).
// Columns: PO ID, Arrival date/time, Transporter, Needed today (= blocks picking), Handling Unit (SSCC), UOM ID (HE<article>-<CU per TU>), Item Name, Location, Priority score/item, Skippable, Buffer, Dock, Sortable.

const STORAGE_KEY = "qcteam-portal-state-v2-clean"; // clean start: a fresh key, so the previous test data stays untouched under v1

const CLEAN_START = true; // no dock mock until the Head maps a sheet in Integrations
// Ola's state from 15.09.2026 — embedded as initial/sample data

const annActive = a => (!a.validTo || a.validTo >= new Date().toISOString().slice(0, 10));


// Alphabetical order for all dictionary lists — in one place, on every state change


// Net inspection time: start → finish minus every "Awaiting Head" pause (escalation → answer), read from the audit trail.
// Durations above 3 h are treated as outliers (draft left open) and excluded from averages.

const OLA_STATE = {"categories": [{"id": "p4x8t0m", "name": "Blauwe bessen", "parentId": null, "specs": [], "varieties": []}, {"id": "mxqoe4k", "name": "Apples", "parentId": null, "specs": [{"id": "s4taab7", "name": "Brix", "unit": "", "min": "6", "max": "20"}], "varieties": []}, {"id": "drz3z6m", "name": "Mango", "parentId": null, "specs": [{"id": "g3n53rg", "name": "Firmness", "unit": "Lb", "min": "2", "max": "8"}, {"id": "4nj0j78", "name": "Brix", "unit": "%", "min": "10", "max": "25"}], "varieties": [{"id": "8dyx4cz", "name": "Kent"}]}], "problems": [{"id": "mtpphih", "parentId": null, "name": "Quality problems", "tolerance": "10"}, {"id": "70d42hr", "parentId": "mtpphih", "name": "Minor remarks", "tolerance": null}, {"id": "9eeirk1", "parentId": "mtpphih", "name": "Major remarks", "tolerance": "1"}, {"id": "jo6un9q", "parentId": null, "name": "General problems", "tolerance": "0"}, {"id": "z5ms2q7", "parentId": "jo6un9q", "name": "Pallet problems", "tolerance": null}, {"id": "eh9qntt", "parentId": "jo6un9q", "name": "Pallet appearance", "tolerance": null}, {"id": "3qmhz5q", "parentId": "70d42hr", "name": "Color defect", "tolerance": null}, {"id": "kj8t05r", "parentId": "70d42hr", "name": "Skin defect", "tolerance": null}, {"id": "5tey28b", "parentId": "70d42hr", "name": "Handling damage", "tolerance": null}, {"id": "bcznpkc", "parentId": "70d42hr", "name": "Shape defect", "tolerance": null}, {"id": "kxbg8ev", "parentId": "9eeirk1", "name": "Dacay", "tolerance": null}, {"id": "hd7t0nm", "parentId": "9eeirk1", "name": "Mold", "tolerance": null}, {"id": "n0xr3us", "parentId": "9eeirk1", "name": "Bleeding", "tolerance": null}, {"id": "ue6vk3a", "parentId": "9eeirk1", "name": "Dehydration", "tolerance": null}, {"id": "nbzoep3", "parentId": "z5ms2q7", "name": "Damage pallet", "tolerance": null}, {"id": "niq392o", "parentId": "z5ms2q7", "name": "Risk of collapse", "tolerance": null}, {"id": "n53sn7s", "parentId": "z5ms2q7", "name": "Wrong produce", "tolerance": null}, {"id": "m2bgia7", "parentId": "eh9qntt", "name": "Broken wood", "tolerance": null}, {"id": "vsvukid", "parentId": "eh9qntt", "name": "Tilled pallet", "tolerance": null}, {"id": "99gt51u", "parentId": "eh9qntt", "name": "Without strips", "tolerance": null}, {"id": "6msdxjn", "parentId": null, "name": "Underweight", "tolerance": "1"}, {"id": "occ4qpc", "parentId": null, "name": "Undersize", "tolerance": "1"}, {"id": "xz2pit0", "parentId": null, "name": "Low brix", "tolerance": "1"}, {"id": "sa9gyb1", "parentId": null, "name": "Low firmness", "tolerance": "1"}], "products": [{"id": "sajj87t", "name": "Merkloos bio blauwe bessen 125 gram", "categoryId": "p4x8t0m", "isBio": true, "cusPerTu": "6", "piecesPerCu": "1", "weightPerCu": "125", "specs": [{"id": "6memzhc", "name": "Weight", "unit": "g", "min": "125", "max": null}, {"id": "32pbe2z", "name": "Diameter", "unit": "mm", "min": "16", "max": null}, {"id": "g0kqidq", "name": "Firmness", "unit": "Lb", "min": "6", "max": null}, {"id": "pkrf6a9", "name": "Brix", "unit": "%", "min": "8", "max": null}], "supplierIds": ["s4czoc8", "fw2btrb", "4yjgb9v", "xrvjvdo"], "varieties": [], "articleId": ""}, {"id": "oqkaq3v", "name": "Merkloos blauwe bessen 500 gram", "categoryId": "p4x8t0m", "isBio": false, "cusPerTu": "12", "piecesPerCu": "1", "weightPerCu": "500", "specs": [{"id": "ekbj0cv", "name": "Diameter", "unit": "mm", "min": "16", "max": null}, {"id": "t0oyrlh", "name": "Weight", "unit": "g", "min": "500", "max": null}, {"id": "wnbgn60", "name": "Brix", "unit": "%", "min": "8", "max": "25"}], "supplierIds": [], "varieties": [{"id": "3jz4dwe", "name": "Arana"}, {"id": "hakj1l9", "name": "Bianca"}, {"id": "ujgs9j1", "name": "Sekoya Beauty"}, {"id": "s3vyfx4", "name": "Other"}], "articleId": ""}, {"id": "1r437px", "name": "Merkloos bio Gala 4 stuks", "categoryId": "mxqoe4k", "isBio": true, "cusPerTu": "16", "piecesPerCu": "4", "weightPerCu": "", "specs": [{"id": "4xfevi5", "name": "Diameter", "unit": "mm", "min": "60", "max": "70"}], "supplierIds": ["fw2btrb"], "varieties": [], "articleId": ""}, {"id": "ehz2lb3", "name": "Merkloos Mango eetrijp 1 stuk", "articleId": "90006049", "categoryId": "drz3z6m", "isBio": false, "cusPerTu": "18", "piecesPerCu": "", "weightPerCu": "", "specs": [], "supplierIds": ["4yjgb9v"], "varieties": []}], "templates": [{"id": "9fot67h", "scope": "Global", "modules": [{"id": "l952viw", "name": "Unit data", "sort": 0}, {"id": "5uojx0v", "name": "Parameters", "sort": 1}, {"id": "305o6wp", "name": "General Problems", "sort": 2}, {"id": "kxvfr40", "name": "Quality Problems", "sort": 3}], "fields": [{"id": "gxcunfg", "moduleId": "l952viw", "sort": 0, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "tpzofi2", "moduleId": "l952viw", "sort": 1, "type": "SingleChoice", "label": "Class", "required": false, "measurementCount": 1, "specId": null, "min": null, "max": null, "optionsRaw": "I, II, IND, N/A", "options": ["I", "II", "IND", "N/A"], "problemBelowId": null, "problemAboveId": null}, {"id": "ss6zusa", "moduleId": "l952viw", "sort": 2, "type": "Pallet", "label": "Pallet numbers", "required": true}, {"id": "bju9rx4", "moduleId": "l952viw", "sort": 3, "type": "DateCode", "label": "Packing date", "required": true}, {"id": "mkt2wvf", "moduleId": "l952viw", "sort": 10, "type": "Photos", "label": "Module photos", "required": true}, {"id": "iktrlnv", "moduleId": "5uojx0v", "sort": 7, "type": "CountryOfOrigin", "label": "Country of origin", "required": true}, {"id": "icmjzgg", "moduleId": "5uojx0v", "sort": 8, "type": "SingleChoice", "label": "Brand selection", "required": false, "measurementCount": 1, "specId": null, "min": null, "max": null, "optionsRaw": "Neutral Label, Private Label, Supplier Label", "options": ["Neutral Label", "Private Label", "Supplier Label"], "problemBelowId": null, "problemAboveId": null}, {"id": "mi53iht", "moduleId": "5uojx0v", "sort": 6, "type": "Supplier", "label": "Supplier", "required": true}, {"id": "oh7lyxk", "moduleId": "5uojx0v", "sort": 5, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "n5qj0e8", "moduleId": "5uojx0v", "sort": 13, "type": "Photos", "label": "Module photos", "required": false}, {"id": "ynbsae6", "moduleId": "l952viw", "sort": 4, "type": "SampleSize", "label": "Sample size", "required": true}, {"id": "q9800wu", "moduleId": "5uojx0v", "sort": 9, "type": "Number", "label": "Brix", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "xz2pit0", "problemAboveId": null}, {"id": "18keziq", "moduleId": "5uojx0v", "sort": 11, "type": "Number", "label": "Firmness", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "sa9gyb1", "problemAboveId": null}, {"id": "41r0zxb", "moduleId": "5uojx0v", "sort": 12, "type": "Number", "label": "Diameter", "required": true, "measurementCount": 5, "problemBelowId": "occ4qpc", "problemAboveId": null, "specId": null, "min": null, "max": null, "allowPhotos": true, "specName": "Diameter"}], "problemRefs": [{"id": "qodwbre", "moduleId": "305o6wp", "problemTypeId": "z5ms2q7", "sort": 0}, {"id": "v2m5hei", "moduleId": "305o6wp", "problemTypeId": "eh9qntt", "sort": 1}, {"id": "jdmg04b", "moduleId": "kxvfr40", "problemTypeId": "70d42hr", "sort": 2}, {"id": "8kx889l", "moduleId": "kxvfr40", "problemTypeId": "9eeirk1", "sort": 3}], "overrides": [], "suppressed": [], "fieldOverrides": {}, "layered": true}, {"id": "5bbak8o", "scope": "Product", "productId": "sajj87t", "modules": [], "fields": [], "problemRefs": [], "overrides": [], "suppressed": ["bhcx35m"], "fieldOverrides": {"q9800wu": {"specId": "pkrf6a9"}, "18keziq": {"specId": "g0kqidq"}}, "layered": true}, {"id": "olpoju6", "scope": "Category", "categoryId": "drz3z6m", "modules": [], "fields": [], "problemRefs": [], "overrides": [], "suppressed": [], "fieldOverrides": {}, "layered": true}], "suppliers": [{"id": "s4czoc8", "name": "SureExport"}, {"id": "fw2btrb", "name": "FruitMaster"}, {"id": "4yjgb9v", "name": "Nature's Pride"}, {"id": "xrvjvdo", "name": "The Greenery"}, {"id": "wn8w5in", "name": "Landjuweel"}], "countries": [{"id": "3hleofm", "name": "Spain"}, {"id": "oob57z6", "name": "Netherlad"}, {"id": "640yrjr", "name": "Greece"}, {"id": "chopix8", "name": "Colombia"}, {"id": "61xtqxf", "name": "Poland"}, {"id": "b5pc8if", "name": "South Africa"}], "users": [{"id": "u-head", "name": "Marta K.", "email": "marta@qc.local", "role": "Head", "active": true}, {"id": "u-anna", "name": "Anna K.", "email": "anna@qc.local", "role": "Controller", "active": true}, {"id": "u-jakub", "name": "Jakub M.", "email": "jakub@qc.local", "role": "Controller", "active": true}], "inspections": [{"id": "30624z8", "productId": "oqkaq3v", "controllerId": "u-anna", "status": "Completed", "result": "Accepted", "startedAt": "2026-09-15T19:19:17.961Z", "template": {"id": "9fot67h", "modules": [{"id": "l952viw", "name": "Unit data", "sort": 0, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "5uojx0v", "name": "Parameters", "sort": 1, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "305o6wp", "name": "General Problems", "sort": 2, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "kxvfr40", "name": "Quality Problems", "sort": 3, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}], "fields": [{"id": "gxcunfg", "moduleId": "l952viw", "sort": 0, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "tpzofi2", "moduleId": "l952viw", "sort": 1, "type": "SingleChoice", "label": "Class", "required": false, "options": ["I", "II", "IND", "N/A"], "problemBelowId": null, "problemAboveId": null}, {"id": "ss6zusa", "moduleId": "l952viw", "sort": 2, "type": "Pallet", "label": "Pallet numbers", "required": true}, {"id": "bju9rx4", "moduleId": "l952viw", "sort": 3, "type": "DateCode", "label": "Packing date", "required": true}, {"id": "mkt2wvf", "moduleId": "l952viw", "sort": 10, "type": "Photos", "label": "Module photos", "required": true}, {"id": "iktrlnv", "moduleId": "5uojx0v", "sort": 7, "type": "CountryOfOrigin", "label": "Country of origin", "required": true}, {"id": "icmjzgg", "moduleId": "5uojx0v", "sort": 8, "type": "SingleChoice", "label": "Brand selection", "required": false, "options": ["Neutral Label", "Private Label", "Supplier Label"], "problemBelowId": null, "problemAboveId": null}, {"id": "mi53iht", "moduleId": "5uojx0v", "sort": 6, "type": "Supplier", "label": "Supplier", "required": true}, {"id": "oh7lyxk", "moduleId": "5uojx0v", "sort": 5, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "n5qj0e8", "moduleId": "5uojx0v", "sort": 13, "type": "Photos", "label": "Module photos", "required": false}, {"id": "ynbsae6", "moduleId": "l952viw", "sort": 4, "type": "SampleSize", "label": "Sample size", "required": true}, {"id": "q9800wu", "moduleId": "5uojx0v", "sort": 9, "type": "Number", "label": "Brix", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "xz2pit0", "problemAboveId": null}, {"id": "18keziq", "moduleId": "5uojx0v", "sort": 11, "type": "Number", "label": "Firmness", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "sa9gyb1", "problemAboveId": null}, {"id": "41r0zxb", "moduleId": "5uojx0v", "sort": 12, "type": "Number", "label": "Diameter", "required": true, "measurementCount": 5, "problemBelowId": "occ4qpc", "problemAboveId": null, "specId": null, "min": null, "max": null, "allowPhotos": true, "specName": "Diameter"}], "problemRefs": [{"id": "qodwbre", "moduleId": "305o6wp", "problemTypeId": "z5ms2q7", "sort": 0}, {"id": "v2m5hei", "moduleId": "305o6wp", "problemTypeId": "eh9qntt", "sort": 1}, {"id": "jdmg04b", "moduleId": "kxvfr40", "problemTypeId": "70d42hr", "sort": 2}, {"id": "8kx889l", "moduleId": "kxvfr40", "problemTypeId": "9eeirk1", "sort": 3}], "overrides": [], "suppressed": []}, "values": {"tpzofi2": "I", "icmjzgg": "Neutral Label", "q9800wu": {"measurements": ["4.6", "5.6", "12"]}, "18keziq": {"measurements": ["5.6", "7.0", "8.9"]}, "41r0zxb": {"measurements": ["21", "17", "16", "15", "18"]}}, "remarks": [{"id": "oypemqd", "leafId": "xz2pit0", "mode": "DirectWeight", "raw": "45", "auto": true, "fieldId": "q9800wu"}, {"id": "ugn1a7k", "leafId": "kxbg8ev", "mode": "DirectWeight", "raw": "34"}], "photos": {"mkt2wvf": 5, "q9800wu": 10, "18keziq": 3, "41r0zxb": 6, "n5qj0e8": 3}, "pallets": ["3435454565656565"], "sample": {"tu": "3", "cusPerTu": "12", "piecesPerCu": "1", "weightPerCu": "500"}, "audit": [{"at": "2026-09-15T19:19:17.961Z", "userId": "u-anna", "action": "Created"}, {"at": "2026-09-15T19:24:29.040Z", "userId": "u-anna", "action": "Completed", "details": "result: Accepted"}], "dateISO": "2026-09-15", "supplier": "FruitMaster", "country": "South Africa", "comment": "Low brix 0,25%; Major remarks 0,19% (Dacay 0,19%) — but quality still acceptable.", "completedAt": "2026-09-15T19:24:29.040Z"}], "flags": [{"id": "doip2r0", "productId": "oqkaq3v", "inspectionId": null, "raisedBy": "u-anna", "description": "Barcode sie zmienił. No działa", "status": "Resolved", "createdAt": "2026-09-15T19:38:23.880Z", "resolution": "Już zaktualizowałem, dziękuję", "resolvedBy": "u-head", "resolvedAt": "2026-09-15T19:38:59.213Z"}], "notifications": [{"id": "90odnq1", "userId": "u-head", "type": "Flag", "message": "🚩 Anna K.: Merkloos blauwe bessen 500 gram — Barcode sie zmienił. No działa", "entityType": "ProductFlag", "entityId": null, "createdAt": "2026-09-15T19:38:23.881Z", "readAt": "2026-09-15T19:38:31.864Z"}, {"id": "urpk161", "userId": "u-anna", "type": "Announcement", "message": "📣 New blocking announcement: Buty ochronne", "entityType": "Announcement", "entityId": "5763oat", "createdAt": "2026-09-15T19:48:53.357Z", "readAt": "2026-09-15T19:49:22.923Z"}, {"id": "5og4q45", "userId": "u-jakub", "type": "Announcement", "message": "📣 New blocking announcement: Buty ochronne", "entityType": "Announcement", "entityId": "5763oat", "createdAt": "2026-09-15T19:48:53.357Z", "readAt": null}], "announcements": [{"id": "s5pwd4f", "title": "Nowa specification to średnicy", "body": "Od poniedziałku no specifications dla średnicy", "productId": "sajj87t", "validTo": null, "createdBy": "u-head", "createdAt": "2026-09-15T19:45:29.342Z", "acks": {}, "isBlocking": false, "showOnDashboard": false}, {"id": "cw8jnzk", "title": "Jutrzejsze zebranie", "body": "Jutrzejsze zebranie (16.09.2026) przełożone na godzine 12:00", "productId": null, "validTo": "2026-09-17", "createdBy": "u-head", "createdAt": "2026-09-15T19:47:06.757Z", "acks": {}, "isBlocking": false, "showOnDashboard": true}, {"id": "5763oat", "title": "Buty ochronne", "body": "Proszę wszystkich o zmienianie butów przed rozpoczęciem pracy", "productId": null, "validTo": null, "createdBy": "u-head", "createdAt": "2026-09-15T19:48:53.356Z", "acks": {"u-anna": "2026-09-15T19:49:04.906Z"}, "isBlocking": true, "showOnDashboard": false}], "conversations": []};

const olaState = () => normalize(JSON.parse(JSON.stringify(OLA_STATE)));

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE — ramka telefonu, ekrany kontrolera
// ═══════════════════════════════════════════════════════════════════════════
const M = { pad: 18 };
// One sheet row = one pallet (Handling Unit). "SKU on dock" = distinct articles. Matches the summary block on the sheet itself.
// Totals come from the sheet's own summary cells when present; per-priority counts come from the rows.
const sheetStats = s => { const rows = dockRowsLive(s).filter(r => !lostOf(s, r)); const lost = dockRowsLive(s).length - rows.length; const sm = dockSummary(s) || {}; const has = k => sm[k] != null; const pallets = has("nonUrgentPallets") || has("urgentPallets") ? (sm.nonUrgentPallets || 0) + (sm.urgentPallets || 0) : rows.length; const skus = has("skus") ? sm.skus : new Set(rows.map(r => r.article)).size; const blocked = has("urgentPallets") ? sm.urgentPallets : rows.filter(r => r.blocking).length; // "Skippable" is a boolean flag on the sheet, not mutually exclusive with Priority item — count it by the flag, not the label.
  const prio = k => k === "Skippable" ? rows.filter(r => r.skippable).length : rows.filter(r => r.priority === k).length; return { pallets, skus, blocked, prio, lost, expected: sm.expected, skippableSkus: sm.skippableSkus, skippablePallets: sm.skippablePallets, fromSheet: Object.keys(sm).length > 0 }; };
const PRIORITY = { "Now needed": [C.bad, C.onDark, true], "High risk": [C.bad, C.badBg, false], "High issues": [C.warn, C.warnBg, false], "Late inspection": [C.warn, C.warnBg, false], "Inspection due": [C.muted, C.line, false], "Skippable": [C.muted, C.line, false] };
const dayLabel = iso => { if (!iso) return "—"; const d = new Date(iso), t = new Date(); const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); const diff = Math.round((day(t) - day(d)) / 86400000); return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
const ResultPill = ({ i, s }) => { const it = s ? inspType(s, i) : null; const [fg, bg, l] = i.status !== "Completed" ? [STATUS[i.status][1], STATUS[i.status][2], STATUS[i.status][0]] : it && it.autoAccept ? [it.color, C.accentSoft, it.name] : i.result === "Accepted" ? [C.ok, C.okBg, "Accepted"] : i.result === "Rejected" ? [C.bad, C.badBg, "Rejected"] : [STATUS[i.status][1], STATUS[i.status][2], STATUS[i.status][0]]; return <span className="text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap inline-flex items-center gap-1.5" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}><span className="inline-block rounded-full" style={{ width: 7, height: 7, background: fg }} />{l}</span>; };
const Lock = () => null;

// Real device (narrow screen or launched from the home screen): full-bleed, safe-area aware, no fake status bar.
// Wide screen (desktop preview): the phone frame.
const useRealDevice = () => { const [real, setReal] = useState(() => typeof window !== "undefined" && (window.matchMedia("(max-width: 560px)").matches || window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches)); useEffect(() => { const mq = window.matchMedia("(max-width: 560px)"); const h = () => setReal(mq.matches || window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches); mq.addEventListener ? mq.addEventListener("change", h) : mq.addListener(h); return () => { mq.removeEventListener ? mq.removeEventListener("change", h) : mq.removeListener(h); }; }, []); return real; };
function Phone({ children, nav, onNav, page, badges, fab, dark, onTheme, overlay }) {
  const items = [["home", "🏠", "Dashboard"], ["chat", "💬", "Chat"], ["catalog", "🧺", "Catalog"], ["menu", "☰", "Menu"]];
  const real = useRealDevice();
  const outer = real ? { background: C.surface, minHeight: "100dvh" } : { background: C.frameBg };
  const shell = real ? { width: "100%", height: "100dvh", background: C.surface, paddingTop: "env(safe-area-inset-top)", overscrollBehavior: "none" } : { width: 390, height: 844, background: C.surface, borderRadius: 44, border: `10px solid ${C.ink}`, overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,.28)" };
  return (
    <div className={`qc flex items-start justify-center ${real ? "" : "min-h-screen p-4 md:p-8"}`} style={outer}>
      <style>{GLOBAL_CSS() + (real ? " html,body{overscroll-behavior:none;background:" + C.surface + "} body{position:fixed;inset:0;} " : "")}</style>
      <div className="relative flex flex-col" style={shell}>
        {!real && <div className="flex items-center justify-between px-6 pt-3 pb-1 text-[11px] font-medium" style={{ color: C.ink }}><span>{new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span><span className="flex items-center gap-2"><button onClick={onTheme} title="theme" className="flex">{dark ? <Ic i={Sun} s={13} mr={0} /> : <Ic i={Moon} s={13} mr={0} />}</button>●●● ᯤ ▮</span></div>}
        <div className="flex-1 overflow-y-auto relative" style={{ color: C.ink }}>{children}</div>
        {overlay}
        {fab && (
          <div className="absolute flex flex-col items-end gap-3" style={{ right: 18, bottom: real ? `calc(${nav ? 78 : 22}px + env(safe-area-inset-bottom))` : (nav ? 78 : 22), zIndex: 30 }}>
            <button onClick={fab.scan} className="w-11 h-11 rounded-full flex items-center justify-center text-lg" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 6px 16px rgba(0,0,0,.15)" }} title="Scan code"><Ic i={ScanLine} s={20} mr={0} /></button>
            <button onClick={fab.add} className="w-14 h-14 rounded-full flex items-center justify-center text-2xl" style={{ background: C.ink, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }} title="New inspection"><Ic i={Plus} s={26} mr={0} /></button>
          </div>
        )}
        {nav && (
          <div className="flex justify-around pt-2.5" style={{ borderTop: `1px solid ${C.line}`, background: C.surface, paddingBottom: real ? "calc(10px + env(safe-area-inset-bottom))" : 10 }}>
            {items.map(([k, ic, l]) => <button key={k} onClick={() => onNav(k)} className="flex flex-col items-center gap-0.5 relative px-3" style={{ color: page === k ? C.accent : C.muted }}><span className="px-3 rounded-full flex items-center" style={{ background: page === k ? C.accentSoft : "transparent", height: 26 }}><Ic i={NAV_ICON[k]} s={19} mr={0} /></span><span className="text-[10px]" style={{ fontWeight: page === k ? 600 : 500 }}>{l}</span>{badges?.[k] > 0 && <span className="absolute -top-1 right-0 text-[9px] px-1 rounded-full" style={{ background: C.bad, color: C.onDark }}>{badges[k]}</span>}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}
const TopBar = ({ title, onBack, right }) => <div className="flex items-center gap-3 px-4 pt-2 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>{onBack && <button onClick={onBack} className="flex" style={{ color: C.ink }}><Ic i={ChevronLeft} s={22} mr={0} /></button>}<p className="text-base font-semibold flex-1 truncate">{title}</p>{right}</div>;
const Sheet = ({ open, onClose, title, children }) => !open ? null : (
  <div className="absolute inset-0 flex items-end" style={{ background: "rgba(31,42,36,.45)", zIndex: 40 }} onClick={onClose}>
    <div className="w-full rounded-t-3xl p-5" style={{ background: C.surface, maxHeight: "80%", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
      <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: C.line }} />
      {title && <p className="font-semibold text-base mb-3">{title}</p>}
      {children}
    </div>
  </div>
);
const Modal = ({ open, children }) => !open ? null : <div className="absolute inset-0 flex items-center justify-center p-6" style={{ background: "rgba(31,42,36,.55)", zIndex: 45 }}><div className="w-full rounded-2xl p-5" style={{ background: C.surface }}>{children}</div></div>;

function MBlocking({ s, set, user }) {
  const pending = s.announcements.filter(a => a.isBlocking && user.role === "Controller" && !(a.acks || {})[user.id]);
  if (!pending.length) return null;
  const a = pending[0];
  const ack = () => set(x => ({ ...x, announcements: x.announcements.map(y => y.id === a.id ? { ...y, acks: { ...(y.acks || {}), [user.id]: nowISO() } } : y) }));
  return (
    <div className="absolute inset-0 flex items-center justify-center p-5" style={{ background: "rgba(31,42,36,.78)", zIndex: 70, paddingTop: "calc(20px + env(safe-area-inset-top))", paddingBottom: "calc(20px + env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl p-5 w-full" style={{ background: C.surface, maxHeight: "100%", overflowY: "auto" }}>
        <p className="text-xs font-semibold mb-2" style={{ color: C.bad }}><Ic i={Megaphone} s={13} />Blocking announcement{pending.length > 1 ? ` · 1 of ${pending.length}` : ""}</p>
        <p className="text-lg font-semibold mb-2">{a.title}</p>
        <p className="text-sm mb-4">{a.body}</p>
        <button onClick={ack} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: C.ink, color: C.onDark }}>I have read and acknowledge</button>
      </div>
    </div>
  );
}

// ── Starting an inspection from the scanner: product pick (full) / product + packing date (visual) ──
function StartModal({ open, kind, s, pallet, presetProductId, onClose, onConfirm, askPallet }) {
  const ktype = typeById(s, kind) || { name: "Inspection", autoAccept: false, reason: "none", color: C.accent };
  const [q, setQ] = useState(""); const [pid, setPid] = useState(presetProductId || null); const [date, setDate] = useState(""); const [note, setNote] = useState(""); const [hu, setHu] = useState(pallet || "");
  const [reason, setReason] = useState("");
  useEffect(() => { setPid(presetProductId || null); setQ(""); setDate(""); setNote(""); setHu(pallet || ""); setReason(""); }, [open, presetProductId, pallet]);
  if (!open) return null;
  const qq = q.trim().toLowerCase();
  const list = s.products.filter(p => p.isActive !== false && (!qq || (p.name + " " + (p.articleId || "") + " " + (p.barcodeCu || "") + " " + (p.barcodeTu || "")).toLowerCase().includes(qq))).slice(0, 8);
  const chosen = s.products.find(p => p.id === pid);
  const isVisual = false, isSkip = false;
  const pol = chosen ? effectivePolicy(s, chosen) : null;
  const blocked = chosen && !policyAllows(pol, kind);
  const reasonRequired = false;
  const noForm = chosen && !resolveTemplate(s, chosen, kind);
  const canConfirm = !!pid && !blocked && !noForm && (!askPallet || hu.trim());
  return (
    <Modal open>
      <p className="font-semibold mb-0.5 flex items-center gap-2"><span className="inline-block rounded-full" style={{ width: 9, height: 9, background: ktype.color }} />{ktype.name} inspection</p>
      {askPallet ? <div className="mb-3"><p className="label-sm mb-1">Pallet number (HU)</p><input autoFocus value={hu} onChange={e => setHu(e.target.value)} placeholder="scan or type" className="w-full text-sm font-mono" /></div> : null}
      <p className="text-xs mb-3" style={{ color: C.muted }}>{askPallet ? "" : <>Pallet <span className="font-mono">{pallet}</span></>}{ktype.description ? ` — ${ktype.description}` : " — pick the product, the rest happens in the form."}</p>
      <p className="label-sm mb-1">Product</p>
      {chosen ? (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: C.accentSoft }}><span className="text-sm font-medium flex-1 truncate" style={{ color: C.accent }}>{chosen.name}</span><button onClick={() => setPid(null)} className="text-xs" style={{ color: C.accent }}>change</button></div>
      ) : (
        <div className="mb-3">
          <input autoFocus value={q} onChange={e => { const v = e.target.value; setQ(v); const hit = s.products.find(p => p.isActive !== false && (matchesCode(p, v) || (p.articleId && p.articleId === v.trim()))); if (hit) setPid(hit.id); }} placeholder="Scan the product code, or search by name…" className="w-full text-sm mb-1.5 font-mono" />
          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>
            {list.map(p => <button key={p.id} onClick={() => setPid(p.id)} className="w-full text-left flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${C.line}` }}><span className="text-xs w-16 flex-shrink-0" style={{ color: C.muted }}>{p.articleId || "—"}</span><span className="text-sm truncate">{p.name}</span></button>)}
            {list.length === 0 && <p className="text-xs px-3 py-3" style={{ color: C.muted }}>Nothing matches. The product isn't in the catalog — tell the Head.</p>}
          </div>
        </div>
      )}
      {blocked && <div className="rounded-xl px-3 py-2 mb-3 text-xs" style={{ background: C.badBg, color: C.bad }}>“{ktype.name}” is not allowed for this product ({pol.source}). Allowed: {allowedTypes(s, chosen).map(t => t.name).join(", ") || "none"}.</div>}
      {noForm && !blocked && <div className="rounded-xl px-3 py-2 mb-3 text-xs" style={{ background: C.warnBg, color: C.warn }}>“{ktype.name}” has no form yet — the Head must build it in Forms.</div>}
      {isVisual && <>
        <p className="label-sm mb-1">Packing date <span style={{ fontWeight: 400 }}>(optional)</span></p>
        <div className="flex gap-2 items-center mb-3"><input type="date" value={date} onChange={e => setDate(e.target.value)} className="flex-1 text-sm" />{date && <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: C.bg }}>DC {dateCode(date)}</span>}</div>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="note (optional)" className="w-full text-sm mb-3" />
      </>}
      <button onClick={() => onConfirm({ productId: pid, dateISO: date || null, note: note.trim(), reason, pallet: hu.trim() })} disabled={!canConfirm} className="w-full py-3 rounded-xl text-sm font-medium mb-2 inline-flex items-center justify-center" style={{ background: canConfirm ? C.ink : C.line, color: canConfirm ? C.onDark : C.muted }}>{ktype.autoAccept ? `Start ${ktype.name.toLowerCase()}` : "Go to the form"}</button>
      <button onClick={onClose} className="w-full py-2 text-sm" style={{ color: C.muted }}>Cancel</button>
    </Modal>
  );
}
function VisualView({ insp, s, go }) {
  const product = s.products.find(p => p.id === insp.productId);
  return (
    <div>
      <TopBar title={inspType(s, insp).name} onBack={() => go("home")} />
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4 mb-3" style={{ background: !countsAs(s, insp) ? C.bg : C.accentSoft, border: !countsAs(s, insp) ? `1px solid ${C.line}` : "none" }}>
          <p className="text-sm font-semibold flex items-center" style={{ color: !countsAs(s, insp) ? C.muted : C.accent }}>{!countsAs(s, insp) ? <><Ic i={SkipForward} s={16} />Pallet skipped — accepted without inspection</> : <><Ic i={Check} s={16} />{inspType(s, insp).name} — done</>}</p>
          {insp.skipReason && <p className="text-xs mt-1" style={{ color: C.muted }}>reason: {insp.skipReason}</p>}
          <p className="text-sm mt-2 font-medium">{product ? product.name : "—"}</p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>HU {(insp.pallets || []).filter(Boolean).join(", ") || "—"}{insp.dateISO && ` · DC ${dateCode(insp.dateISO)}`} · {s.users.find(u => u.id === insp.controllerId)?.name} · {dayLabel(insp.completedAt)}, {hhmm(insp.completedAt)}</p>
          {insp.comment && <p className="text-sm mt-2">„{insp.comment}"</p>}
        </div>
        <p className="text-xs" style={{ color: C.muted }}>Legacy entry recorded before inspection types had their own forms — trace only.</p>
        <button onClick={() => go("scan")} className="w-full py-3 rounded-xl text-sm font-medium mt-4 inline-flex items-center justify-center" style={{ background: C.ink, color: C.onDark }}><Ic i={ScanLine} s={15} />Scan next</button>
      </div>
    </div>
  );
}

// ── Dashboard ──
// Priority list: everything at this priority, pallets with a recent-rejection history bubbled to the top so a controller
// knows at a glance which ones are worth extra attention — and why. Tapping a row jumps straight into inspecting it.
// Focused info screen for one blocked pallet: the fields worth knowing (location, zone, deadline, who has it) and the
// actions that matter — take / in stack / release — with inspecting as an explicit, separate step, not the default tap.
function MBlockedInfo({ s, set, user, go, itemKey }) {
  const b = blockedQueue(s).find(x => x.key === itemKey);
  if (!b) return <div><TopBar title="Pallet" onBack={() => go("home")} /><div className="px-4 pt-10 text-center"><p className="text-sm" style={{ color: C.muted }}>Not found — it may already be done.</p></div></div>;
  const product = s.products.find(p => p.articleId === b.article);
  const c = b.claim; const me = c && c.userId === user.id; const who = c && s.users.find(u => u.id === c.userId); const stacked = c?.status === "stacked"; const done = b.status === "Completed";
  const take = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "taken" });
  const stack = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "stacked" });
  const release = () => setClaim(set, b, null);
  const fields = [["Article", b.article], ["Location", b.location], ["Zone", b.zone], ["Pick location", b.pickLocation], ["Needed by", b.deadline], ["WMS status", b.wmsStatus], b.hu ? ["Pallet", `…${b.hu.slice(-8)}`] : null].filter(x => x && x[1]);
  return (
    <div className="pb-4">
      <TopBar title="Blocked pallet" onBack={() => go("home")} />
      <div className="px-4 pt-3">
        <MProductHeader s={s} product={product} article={b.article} name={b.name} go={go} />
        {b.lost && <MLostControls s={s} set={set} user={user} row={b} />}
        <div className="flex items-center gap-2 mb-3"><span className="inline-block rounded-full" style={{ width: 9, height: 9, background: done ? C.ok : stacked ? C.muted : C.bad }} /><span className="text-sm font-medium">{done ? "Completed" : b.status}</span>{who && <span className="text-xs ml-auto flex items-center gap-1" style={{ color: me ? C.accent : C.muted }}><Avatar user={who} size={16} />{me ? "you" : who.name.split(" ")[0]}</span>}</div>
        <div className="rounded-2xl p-3.5 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
          {fields.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="font-medium text-right">{v}</span></div>)}
        </div>
        {!done && !b.lost && <div className="flex gap-2 mb-2">
          {!c && <><button onClick={take} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.ink, color: C.onDark }}>Take</button><button onClick={stack} className="flex-1 py-2.5 rounded-xl text-sm inline-flex items-center justify-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={13} />In stack</button></>}
          {c && me && <><button onClick={stacked ? take : stack} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.ink, color: C.onDark }}>{stacked ? "Reachable now — take" : "Mark in stack"}</button><button onClick={release} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Release</button></>}
          {c && !me && <button onClick={take} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: C.ink, color: C.onDark }}>{stacked ? "Reachable now — take" : "Take over"}</button>}
        </div>}
        <button onClick={() => go("scan", b.hu || "")} className="w-full py-3 rounded-xl text-sm font-medium mt-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>Inspect this pallet</button>
        {!done && !b.lost && <MLostControls s={s} set={set} user={user} row={b} />}
      </div>
    </div>
  );
}

// "Lost" controls for a pallet screen: a dimmed banner with Found when it's marked, a quiet "Can't find it?" otherwise.
function MLostControls({ s, set, user, row }) {
  const [ask, setAsk] = useState(false); const [note, setNote] = useState("");
  const lost = lostOf(s, row); const by = lost && s.users.find(u => u.id === lost.byUserId);
  if (lost) return (
    <div className="rounded-2xl px-3.5 py-3 mb-3" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
      <p className="text-sm font-semibold flex items-center" style={{ color: C.muted }}><Ic i={Search} s={14} />Marked lost · {by ? by.name.split(" ")[0] : "?"} · {dayLabel(lost.at)}, {hhmm(lost.at)}</p>
      {lost.note && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{lost.note}</p>}
      <button onClick={() => markFound(set, row, user)} className="mt-2 text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Found — it's back</button>
    </div>
  );
  if (!ask) return <button onClick={() => setAsk(true)} className="w-full py-2 text-xs mt-1" style={{ color: C.muted }}>Not on the docks? Mark it lost</button>;
  return (
    <div className="rounded-2xl px-3.5 py-3 mt-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      <p className="text-sm font-medium mb-1">Mark as lost</p>
      <input value={note} onChange={e => setNote(e.target.value)} placeholder="note (optional)" className="w-full text-sm rounded-xl px-3 py-2 mb-2 outline-none" style={{ background: C.surface, border: `1px solid ${C.line}` }} />
      <div className="flex gap-2"><button onClick={() => { markLost(set, row, user, note); setAsk(false); }} className="flex-1 py-2 rounded-xl text-sm font-semibold" style={{ background: C.ink, color: C.onDark }}>Mark lost</button><button onClick={() => setAsk(false)} className="flex-1 py-2 rounded-xl text-sm" style={{ border: `1px solid ${C.line}` }}>Cancel</button></div>
    </div>
  );
}

// Product-first header for pallet screens: what the controller is looking at (photo, name, basics, key attributes, recent
// rejections) before the pallet's own numbers. Tapping it opens the profile. Falls back to a "no profile yet" strip.
function MProductHeader({ s, product, article, name, go }) {
  if (!product) return <div className="rounded-2xl px-3.5 py-3 mb-3" style={{ background: C.warnBg }}><p className="text-sm font-semibold leading-tight">{name || article}</p><p className="text-xs mt-0.5" style={{ color: C.warn }}>Article {article} has no product profile yet.</p></div>;
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "uncategorised"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const photos = asPhotoList(product.photos); const attrs = effectiveAttributes(s, product).slice(0, 4); const hist = recentProblemsFor(s, product.id);
  return (
    <button onClick={() => go("catalog", product.id)} className="w-full text-left rounded-2xl p-3.5 mb-3 active:opacity-70" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      <div className="flex gap-3 items-start">
        {photos.length ? <img src={photos[0].dataUrl} alt="" className="w-20 h-20 rounded-xl object-contain flex-shrink-0" style={{ background: PHOTO_BG }} /> : <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.surface, color: C.muted }}><Ic i={ImageIcon} s={28} mr={0} /></div>}
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{product.name}</p>
          <p className="text-xs mt-1" style={{ color: C.muted }}>ID {product.articleId || "—"} · {catPath(product.categoryId)}{product.isBio && " · bio"}</p>
          <p className="text-xs" style={{ color: C.muted }}>{product.cusPerTu || "?"} CU/TU · {product.weightPerCu || "?"} g/CU</p>
          <p className="text-xs mt-1 underline" style={{ color: C.accent }}>Open product profile</p>
        </div>
      </div>
      {attrs.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2.5">{attrs.map(a => <span key={a.dictionaryId} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.surface, border: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{a.list}:</span> <b>{a.value}</b></span>)}</div>}
      {/* Wherever this header shows up — dock pallet, blocked pallet, scan result — the product is already identified, so
          any announcement about it belongs here, not only after tapping through to the full profile. */}
      {s.announcements.filter(a => annMatchesProduct(s, a, product)).map(a => <div key={a.id} className="rounded-xl px-3 py-2 mt-2.5" style={{ background: C.accentSoft }}><p className="text-xs font-semibold flex items-center" style={{ color: C.accent }}><Ic i={Megaphone} s={12} mr={4} />{a.title}</p><p className="text-xs mt-0.5" style={{ color: C.ink }}>{a.body}</p></div>)}
      {hist.count > 0 && <div className="rounded-xl px-3 py-2 mt-2.5" style={{ background: C.badBg }}><p className="text-xs font-semibold" style={{ color: C.bad }}>{hist.count} rejected recently · last {dayLabel(hist.lastAt)}</p><p className="text-xs" style={{ color: C.bad }}>{hist.problems.slice(0, 3).map(p => `${p.name} ×${p.count}`).join(", ")}{hist.problems.length > 3 ? "…" : ""}</p></div>}
    </button>
  );
}

// Focused info screen for one dock pallet: what matters (location, priority, arrival, recent-rejection history), with
// inspecting as an explicit next step rather than an automatic one.
function MPalletInfo({ s, set, user, go, hu, onAssign }) {
  const r = dockRowsLive(s).find(x => samePallet(x.hu, hu));
  if (!r) return <div><TopBar title="Pallet" onBack={() => go("home")} /><div className="px-4 pt-10 text-center"><p className="text-sm" style={{ color: C.muted }}>Not found — it may already be inspected or off the sheet.</p></div></div>;
  const product = s.products.find(p => p.articleId === r.article);
  const fields = [["Article", r.article], ["Location", r.location], ["Priority", r.priority], ["Transporter", r.transporter], ["Arrived", [r.arrived, r.arrivedTime].filter(Boolean).join(" ")], r.po && ["PO", r.po], ["Pallet", `…${r.hu.slice(-8)}`]].filter(x => x && x[1]);
  return (
    <div className="pb-4">
      <TopBar title="Pallet on dock" onBack={() => go("home")} />
      <div className="px-4 pt-3">
        <MProductHeader s={s} product={product} article={r.article} name={r.name} go={go} />
        {/* The dock sheet comes from the WMS and only refreshes on its own schedule — a pallet already reported can sit
            here for a while looking untouched. Surface that up front so nobody re-walks a pallet that's done. */}
        {(() => { const done = completedInspectionFor(s, r.hu); if (!done) return null; return (
          <div className="rounded-2xl p-3.5 mb-3" style={{ background: C.okBg }}>
            <p className="text-sm font-medium mb-1 flex items-center" style={{ color: C.ok }}><Ic i={Check} s={14} />Already inspected — the dock sheet just hasn't caught up yet</p>
            <p className="text-xs mb-2" style={{ color: C.ink }}>{s.users.find(u => u.id === done.controllerId)?.name} · {dayLabel(done.completedAt)}, {hhmm(done.completedAt)}{" · " + inspType(s, done).name.toLowerCase()}</p>
            <div className="flex items-center gap-2 mb-2 flex-wrap"><ResultPill i={done} s={s} />{done.comment && <span className="text-xs" style={{ color: C.muted }}>{done.comment}</span>}</div>
            <button onClick={() => go("inspection", done.id)} className="w-full py-2 rounded-xl text-sm" style={{ border: `1px solid ${C.line}`, background: C.surface }}>{done.template ? "View report" : "View entry"}</button>
          </div>
        ); })()}
        {lostOf(s, r) && <MLostControls s={s} set={set} user={user} row={r} />}
        {(() => { const al = computeDeadlineAlerts(s).find(a => samePallet(a.hu, r.hu)); if (!al) return null; return <div className="rounded-xl px-3 py-2 mb-3" style={{ background: C.badBg }}><p className="text-xs font-semibold flex items-center" style={{ color: C.bad }}><Ic i={AlertTriangle} s={13} />{al.level === "breached" ? "Rejection window expired" : `Rejection window closes in ${Math.max(0, Math.round(al.hoursLeft))} h`}</p><p className="text-[11px]" style={{ color: C.bad }}>{al.level === "breached" ? "Rejecting is no longer possible — inspect anyway and note it." : `Arrived ${r.arrived} ${r.arrivedTime}${al.risky ? " · this product was rejected recently, so it's flagged early" : ""}.`}</p></div>; })()}
        {r.blocking && !lostOf(s, r) && <div className="rounded-xl px-3 py-2 mb-3 text-xs font-semibold" style={{ background: C.badBg, color: C.bad }}>Needed today — picking is waiting for this pallet.</div>}
        {/* No take/in-stack claim here — dock pallets sit at a known location and duplicate inspections are already
            caught when someone starts one, so "taking" a pallet just to look at it would add a step without a payoff. */}
        {user.role === "Head" && onAssign && !lostOf(s, r) && <button onClick={() => onAssign(r)} className="w-full py-2 text-xs mb-2 inline-flex items-center justify-center" style={{ color: C.accent }}><Ic i={MessageSquare} s={12} />Assign to someone in chat</button>}
        <p className="label-sm mb-1" style={{ color: C.muted }}>This pallet</p>
        <div className="rounded-2xl p-3.5 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
          {fields.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="font-medium text-right">{v}</span></div>)}
        </div>
        <button onClick={() => go("scan", r.hu)} className="w-full py-3 rounded-xl text-sm font-medium" style={lostOf(s, r) ? { background: C.surface, border: `1px solid ${C.line}` } : { background: C.ink, color: C.onDark }}>{completedInspectionFor(s, r.hu) ? "Inspect again" : "Inspect this pallet"}</button>
        {!lostOf(s, r) && <MLostControls s={s} set={set} user={user} row={r} />}
      </div>
    </div>
  );
}

function MPriorityList({ s, user, go, priority }) {
  // "All" is the tile for the whole dock (SKUs / pallets on docks) rather than one priority — it gets its own two tabs
  // instead of a priority filter: the pallets that actually need inspecting, and the ones flagged skippable.
  const isAll = priority === "All";
  const [subTab, setSubTab] = useState("regular");
  // "Priorities" is the all-up list — it must include skippable pallets too, not hide them; "Skippable" is just a
  // filtered view of the same set, not a separate bucket that pulls items out of the main list.
  const liveAll = dockRowsLive(s);
  const allRows = isAll ? liveAll.filter(r => subTab === "skippable" ? r.skippable : true) : liveAll.filter(r => priority === "Skippable" ? r.skippable : r.priority === priority);
  const lostRows = allRows.filter(r => lostOf(s, r)); const rows = allRows.filter(r => !lostOf(s, r));
  // Sections by arrival day, oldest first — the 24h rejection window makes the oldest pallets the urgent ones. Inside a day the
  // same SKU collapses into one row (×N) and anything with a recent rejection floats to the top.
  const dayKey = r => /^\d{4}-\d{2}-\d{2}/.test(r.arrived || "") ? r.arrived.slice(0, 10) : "";
  const byDay = {}; rows.forEach(r => { const d = dayKey(r); (byDay[d] = byDay[d] || []).push(r); });
  const days = Object.keys(byDay).sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  const itemsFor = dayRows => { const groups = {}; dayRows.forEach(r => { const k = r.article || r.hu; (groups[k] = groups[k] || { rows: [] }).rows.push(r); });
    return Object.values(groups).map(g => { const first = g.rows[0]; const product = s.products.find(p => p.articleId === first.article); const hist = recentProblemsFor(s, product?.id);
      const locs = new Set(g.rows.map(r => r.location).filter(Boolean)); const earliest = [...g.rows].sort((x, y) => (x.arrivedTime || "99").localeCompare(y.arrivedTime || "99"))[0];
      // The dock sheet still lists these pallets even once they're reported — it just hasn't refreshed yet — so count
      // how many of the group already have a completed report and flag it, instead of letting them look untouched.
      const checked = g.rows.filter(x => completedInspectionFor(s, x.hu)).length;
      // Different PO numbers under the same SKU usually mean separate deliveries — worth a flag before assuming
      // every pallet here is the same batch.
      const mixedPO = new Set(g.rows.map(r => (r.po || "").trim()).filter(Boolean)).size > 1;
      // This view is filtered (by priority, or to just "skippable"), so ×N here only ever counts what's IN that
      // filter — it is not the SKU's total on the dock. The product page's "On the docks now" count (DockPresence,
      // dockRowsFor) has no such filter, so the two numbers can legitimately differ; without this hint that looks
      // like a bug (a lower number here) rather than the two views simply answering different questions.
      const totalOnDock = first.article ? liveAll.filter(r => r.article === first.article).length : g.rows.length;
      return { key: first.article || first.hu, name: first.name || product?.name || first.article, count: g.rows.length, totalOnDock, checked, mixedPO, hu: earliest.hu, productId: product?.id || null,
        location: locs.size <= 1 ? first.location : `${locs.size} locations`, transporter: earliest.transporter, arrivedTime: earliest.arrivedTime, blocking: g.rows.some(r => r.blocking), hist, priority: first.priority };
    // recent rejections first, then chronological by arrival time (oldest on top) — a ×N group counts as its earliest pallet
    }).sort((a, b) => (b.hist.count > 0) - (a.hist.count > 0) || (a.arrivedTime || "99").localeCompare(b.arrivedTime || "99")); };
  const dayTitle = d => { if (!d) return "Arrival date unknown"; const label = dayLabel(d + "T12:00:00"); const full = new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); return label === "Today" || label === "Yesterday" ? `${label} · ${full}` : full; };
  const ageDays = d => d ? Math.round((new Date().setHours(12, 0, 0, 0) - new Date(d + "T12:00:00").getTime()) / 86400000) : 0;
  const skus = new Set(rows.map(r => r.article || r.hu)).size;
  return (
    <div className="pb-4">
      <TopBar title={isAll ? "Pallets on docks" : priority} onBack={() => go("home")} />
      {isAll && <div className="flex gap-1 px-4 mt-2" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["regular", "Priorities"], ["skippable", "Skippable"]].map(([k, l]) => <button key={k} onClick={() => setSubTab(k)} className="px-1 py-2 text-sm" style={{ marginRight: 14, borderBottom: subTab === k ? `2px solid ${C.ink}` : "2px solid transparent", color: subTab === k ? C.ink : C.muted, fontWeight: subTab === k ? 500 : 400 }}>{l}</button>)}
      </div>}
      <div className="px-4 pt-3">
        <p className="text-xs mb-1" style={{ color: C.muted }}>{rows.length} pallet{rows.length === 1 ? "" : "s"} · {skus} SKU{skus === 1 ? "" : "s"} · oldest arrivals first</p>
        {rows.length === 0 && <p className="text-sm py-8 text-center" style={{ color: C.muted }}>{lostRows.length ? "Nothing findable here — only lost pallets below." : isAll ? (subTab === "skippable" ? "No skippable pallets on the docks right now." : "Nothing on the docks right now.") : "Nothing at this priority right now."}</p>}
        {days.map(d => { const items = itemsFor(byDay[d]); const n = byDay[d].length; const old = ageDays(d) >= 1; return (
          <div key={d || "none"} className="mt-3">
            <div className="flex items-center gap-2 py-1.5 sticky top-0" style={{ background: C.surface }}>
              <p className="text-xs font-semibold flex-1" style={{ color: old && d ? C.bad : C.ink }}>{dayTitle(d)}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: old && d ? C.badBg : C.bg, color: old && d ? C.bad : C.muted, border: old && d ? "none" : `1px solid ${C.line}` }}>{n} pallet{n === 1 ? "" : "s"}{old && d ? ` · ${ageDays(d)}d on dock` : ""}</span>
            </div>
            {items.map(it => (
              <button key={it.key} onClick={() => it.count > 1 && it.productId ? go("catalog", it.productId) : go("palletInfo", it.hu)} className="w-full text-left py-3 active:opacity-60" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2">{isAll && subTab === "regular" && it.priority && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: PRIORITY[it.priority]?.[1] || C.line, color: PRIORITY[it.priority]?.[0] || C.muted }}>{it.priority}</span>}<p className="text-sm font-medium flex-1 truncate">{it.name}</p>{it.count > 1 && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: C.accentSoft, color: C.accent }}>×{it.count} on docks</span>}{it.totalOnDock > it.count && <span className="text-[10px] flex-shrink-0" style={{ color: C.muted }}>+{it.totalOnDock - it.count} elsewhere</span>}{it.mixedPO && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1" style={{ background: C.warnBg, color: C.warn }}><Ic i={AlertTriangle} s={10} mr={0} />mixed PO</span>}{it.checked > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1" style={{ background: C.okBg, color: C.ok }}><Ic i={Check} s={10} mr={0} />{it.checked === it.count ? "already inspected" : `${it.checked}/${it.count} inspected`}</span>}{it.hist.count > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: C.badBg, color: C.bad }}>{it.hist.count} rejected recently</span>}</div>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{it.location} · {it.transporter} · {it.arrivedTime}{it.blocking ? " · needed today" : ""}</p>
                {it.hist.count > 0 && <p className="text-xs mt-1" style={{ color: C.bad }}>Was rejected for: {it.hist.problems.slice(0, 3).map(p => `${p.name} ×${p.count}`).join(", ")}{it.hist.problems.length > 3 ? "…" : ""} · last {dayLabel(it.hist.lastAt)}</p>}
              </button>
            ))}
          </div>); })}
        {lostRows.length > 0 && <div className="mt-4" style={{ opacity: .55 }}>
          <div className="flex items-center gap-2 py-1.5"><p className="text-xs font-semibold flex-1 flex items-center" style={{ color: C.muted }}><Ic i={Search} s={12} />Lost — not findable right now</p><span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>{lostRows.length}</span></div>
          {lostRows.map(r => { const m = lostOf(s, r); const by = s.users.find(u => u.id === m.byUserId); return (
            <button key={r.hu} onClick={() => go("palletInfo", r.hu)} className="w-full text-left py-3 active:opacity-60" style={{ borderBottom: `1px solid ${C.line}` }}>
              <p className="text-sm font-medium truncate">{r.name || r.article}</p>
              <p className="text-xs mt-0.5" style={{ color: C.muted }}>last seen {r.location} · {r.arrivedTime} · lost by {by ? by.name.split(" ")[0] : "?"} {dayLabel(m.at)}{m.note ? ` · ${m.note}` : ""}</p>
            </button>); })}
        </div>}
      </div>
    </div>
  );
}

// Full announcement text, off the dashboard preview — dimmed backdrop, tap outside or Close to dismiss.
function MAnnouncementModal({ a, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-5" style={{ background: "rgba(31,42,36,0.55)", zIndex: 50 }} onClick={onClose}>
      <div className="rounded-2xl p-5 max-w-sm w-full" style={{ background: C.surface }} onClick={e => e.stopPropagation()}>
        <p className="text-xs font-medium mb-2 flex items-center" style={{ color: C.accent }}><Ic i={Megaphone} s={13} />Announcement</p>
        <p className="text-base font-semibold mb-2">{a.title}</p>
        <p className="text-sm mb-4" style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
        <p className="text-xs mb-4" style={{ color: C.muted }}>{fmtTime(a.createdAt)}{a.validTo && ` · on the dashboard until ${a.validTo}`}</p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: C.ink, color: C.onDark }}>Close</button>
      </div>
    </div>
  );
}
function MDashboard({ s, set, user, go, dismissed, setDismissed, onAssign }) {
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const [annOpen, setAnnOpen] = useState(null);
  const [blockedView, setBlockedView] = useState("open");
  const [tab, setTab] = useState("history");
  const bottomPad = { paddingBottom: 96 };
  const mine = s.inspections.filter(i => i.status !== "Cancelled").sort((a, b) => (b.completedAt || b.startedAt || "").localeCompare(a.completedAt || a.startedAt || ""));
  const today = new Date().toISOString().slice(0, 10);
  const doneToday = s.inspections.filter(i => i.status === "Completed" && countsAs(s, i) && (i.completedAt || "").slice(0, 10) === today).length;
  // All of them at once — one gets its full preview text, several collapse to titles only so they don't take over the dashboard.
  const anns = s.announcements.filter(a => a.showOnDashboard && annActive(a) && !dismissed.includes(a.id)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const unread = s.notifications.filter(n => n.userId === user.id && !n.readAt).length;
  const groups = []; mine.slice(0, 30).forEach(i => { const k = dayLabel(i.completedAt || i.startedAt); let g = groups.find(x => x.k === k); if (!g) { g = { k, items: [] }; groups.push(g); } g.items.push(i); });
  return (
    <div style={bottomPad}>
      <div className="flex items-center justify-between px-5 pt-2 pb-2">
        <div><p className="text-xs" style={{ color: C.muted }}>{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p><p className="text-lg font-semibold">Hi, {user.name.split(" ")[0]}</p></div>
        <div className="flex items-center gap-3"><button onClick={() => go("notifications")} className="relative flex"><Ic i={Bell} s={22} mr={0} />{unread > 0 && <span className="absolute -top-1 -right-2 text-[9px] px-1 rounded-full" style={{ background: C.bad, color: C.onDark }}>{unread}</span>}</button><button onClick={() => go("profile")} className="flex"><Avatar user={user} size={36} /></button></div>
      </div>
      {(() => { const fr = sheetFreshness(s); if (!fr.length) return null; const now = Date.now(); const ago = t => { const m = Math.round((now - new Date(t).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; }; return (
        <div className="px-5 pb-2 flex items-center gap-3 flex-wrap">
          {fr.map(f => { const stale = now - new Date(f.at).getTime() > 10 * 60000; return <span key={f.purpose} className="text-[11px] flex items-center gap-1" style={{ color: stale ? C.warn : C.muted }}><Ic i={stale ? AlertTriangle : Clock} s={11} mr={0} />{f.purpose === "Dock" ? "Dock data" : "Blocked pallets"} · {ago(f.at)}</span>; })}
        </div>
      ); })()}
      <div className="px-5"><DeadlineBanner s={s} alerts={computeDeadlineAlerts(s, now)} now={now} onOpen={al => go("palletInfo", al.hu)} /></div>
      {anns.length === 1 && <button onClick={() => anns[0].productId ? go("catalog", anns[0].productId) : setAnnOpen(anns[0])} className="text-left mx-5 mb-3 rounded-xl px-3.5 py-2.5 flex items-start gap-2.5" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.accent}` }}><span style={{ color: C.accent, marginTop: 2 }}><Ic i={Megaphone} s={14} mr={0} /></span><p className="text-sm flex-1"><b>{anns[0].title}</b><span style={{ color: C.muted }}> — {truncate(anns[0].body)}</span></p><span onClick={e => { e.stopPropagation(); setDismissed(d => [...d, anns[0].id]); }} className="text-sm" style={{ color: C.muted }}>×</span></button>}
      {anns.length > 1 && <div className="mx-5 mb-3 rounded-xl overflow-hidden" style={{ background: C.surface, border: `1px solid ${C.line}` }}>{anns.map((a, i) => <button key={a.id} onClick={() => a.productId ? go("catalog", a.productId) : setAnnOpen(a)} className="w-full text-left px-3.5 py-2 flex items-center gap-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : "none", borderLeft: `3px solid ${C.accent}` }}><span style={{ color: C.accent }}><Ic i={Megaphone} s={13} mr={0} /></span><p className="text-sm flex-1 truncate"><b>{a.title}</b></p><span onClick={e => { e.stopPropagation(); setDismissed(d => [...d, a.id]); }} className="text-sm" style={{ color: C.muted }}>×</span></button>)}</div>}
      {annOpen && <MAnnouncementModal a={annOpen} onClose={() => setAnnOpen(null)} />}
      {user.role === "Head" && (() => { const esc = s.inspections.filter(i => i.status === "PendingReview").length, fl = s.flags.filter(f => f.status === "Open").length; return (
        <div className="px-5 mb-3">
          <p className="label-sm mb-1.5">Needs you</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => go("head-escalations")} className="rounded-2xl p-3 text-left" style={{ background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${esc ? C.warn : C.line}` }}><p className="text-[22px] leading-tight font-semibold" style={{ color: esc ? C.warn : C.ink }}>{esc}</p><p className="text-[11px]" style={{ color: C.muted }}>questions</p></button>
            <button onClick={() => go("head-flags")} className="rounded-2xl p-3 text-left" style={{ background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${fl ? C.warn : C.line}` }}><p className="text-[22px] leading-tight font-semibold" style={{ color: fl ? C.warn : C.ink }}>{fl}</p><p className="text-[11px]" style={{ color: C.muted }}>open flags</p></button>
            <button onClick={() => go("head-announce")} className="rounded-2xl p-3 text-left flex flex-col justify-between" style={{ background: C.accentSoft, border: `1px solid ${C.line}` }}><span style={{ color: C.accent }}><Ic i={Megaphone} s={18} mr={0} /></span><p className="text-[11px] font-medium" style={{ color: C.accent }}>announce</p></button>
          </div>
        </div>
      ); })()}
      <div className="grid grid-cols-2 gap-2 px-5">
        <div className="rounded-2xl p-3.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs" style={{ color: C.muted }}>Done today (team)</p><p className="text-[26px] leading-tight font-semibold mt-0.5">{doneToday}</p></div>
        {(() => { const bs = blockedSummary(s) || {}; const rows = blockedRowsLive(s); const lostN = blockedQueue(s).filter(b => b.lost && b.status !== "Completed").length; const open = Math.max(0, (bs.notStarted != null ? (bs.notStarted || 0) + (bs.started || 0) : rows.filter(r => r.status !== "Completed").length) - lostN); return <div className="rounded-2xl p-3.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs" style={{ color: C.muted }}>Blocked pallets</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: open ? C.bad : C.ink }}>{open}</p><p className="text-[10px]" style={{ color: C.muted }}>{(() => { const mine = blockedQueue(s).filter(b => b.status !== "Completed" && b.claim?.userId === user.id).length; const st = blockedQueue(s).filter(b => b.status !== "Completed" && b.claim?.status === "stacked").length; return rows.length ? `${mine} yours · ${st} in stack${lostN ? ` · ${lostN} lost` : ""}` : "no blocked-pallets sheet yet"; })()}</p></div>; })()}
        <button onClick={() => go("priority", "All")} className="rounded-2xl p-3.5 text-left transition-transform active:scale-95" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs" style={{ color: C.muted }}>SKUs on docks</p><p className="text-[26px] leading-tight font-semibold mt-0.5">{sheetStats(s).skus}</p><p className="text-[10px]" style={{ color: C.muted }}>{sheetStats(s).expected != null ? `${sheetStats(s).expected} still expected` : "distinct articles"}</p></button>
        <button onClick={() => go("priority", "All")} className="rounded-2xl p-3.5 text-left transition-transform active:scale-95" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs" style={{ color: C.muted }}>Pallets on docks</p><p className="text-[26px] leading-tight font-semibold mt-0.5">{sheetStats(s).pallets}</p><p className="text-[10px]" style={{ color: C.muted }}>{sheetStats(s).skippablePallets != null ? `${sheetStats(s).skippablePallets} skippable · ${sheetStats(s).skippableSkus ?? "—"} SKUs` : "in total"}</p></button>
      </div>
      <p className="label-sm px-5 mt-3 mb-1" style={{ color: C.muted }}>Dock priorities</p>
      {/* Skippable is a boolean flag, not a distinct priority — the "N skippable" figure above already covers it, so it's not a tile here. */}
      {/* Fixed set of tiles — a 0 is information too, and a glitchy push (0 rows, unknown labels) must not make the whole panel vanish. */}
      {sheetStats(s).prio("Now needed") > 0 && <button onClick={() => go("priority", "Now needed")} className="mx-5 mb-2 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98]" style={{ background: C.bad, color: C.onDark, width: "calc(100% - 40px)" }}><p className="text-2xl font-bold tracking-tight">{sheetStats(s).prio("Now needed")}</p><p className="text-sm font-semibold leading-tight">Now needed<br /><span className="text-[11px] font-normal opacity-80">picking is waiting — inspect first</span></p></button>}
      <div className="grid grid-cols-4 gap-2 px-5">
        {["High risk", "High issues", "Late inspection", "Inspection due"].map(l => { const n = sheetStats(s).prio(l); const fg = PRIORITY[l][0]; return (
          <button key={l} onClick={() => go("priority", l)} className="rounded-2xl py-3 text-center transition-transform active:scale-95" style={{ background: C.bg, border: `1px solid ${C.line}`, opacity: n ? 1 : 0.55 }}><p className="text-2xl font-bold tracking-tight" style={{ color: n ? fg : C.muted }}>{n}</p><p className="text-[10px] font-medium leading-tight mt-0.5" style={{ color: C.muted }}>{l}</p></button>
        ); })}
      </div>
      {sheetStats(s).lost > 0 && <p className="text-[11px] px-5 mt-1.5" style={{ color: C.muted }}>{sheetStats(s).lost} pallet{sheetStats(s).lost === 1 ? "" : "s"} marked lost — not counted above, listed at the bottom of each priority.</p>}
      {dockRowsLive(s).length === 0 && <p className="text-[11px] px-5 mt-1.5" style={{ color: C.warn }}>{(s.integrations || []).some(i => i.purpose === "Dock" && i.needsRemap) ? "Dock sheet columns changed — the Head needs to re-map it in the portal." : (s.integrations || []).some(i => i.purpose === "Dock" && i.pushMode) ? "The last push from the dock sheet had no usable rows — showing zeros until the next one." : "No dock sheet connected yet."}</p>}
      {/* Everyone sees this, not just the Head — a pallet that left without a report is something the whole floor should know about. */}
      {unreportedStats(s).open > 0 && <button onClick={() => go("unreported")} className="mx-5 mt-2.5 rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 text-left active:scale-[0.98]" style={{ background: C.warnBg, border: `1px solid ${C.warn}`, width: "calc(100% - 40px)" }}><Ic i={ShieldAlert} s={16} mr={0} style={{ color: C.warn }} /><span className="text-sm flex-1">{unreportedStats(s).open} pallet{unreportedStats(s).open === 1 ? "" : "s"} left the dock without a report</span><span style={{ color: C.muted }}>›</span></button>}
      <div className="flex gap-1 mx-5 mt-4" style={{ borderBottom: `1px solid ${C.line}` }}>
        {[["history", "History"], ["blocked", "Blocked pallets"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="px-1 py-2 text-sm" style={{ marginRight: 14, borderBottom: tab === k ? `2px solid ${C.ink}` : "2px solid transparent", color: tab === k ? C.ink : C.muted, fontWeight: tab === k ? 500 : 400 }}>{l}</button>)}
        <div className="flex-1" />
        {tab === "history" && <button onClick={() => go("history")} className="text-xs py-2" style={{ color: C.accent }}>all ›</button>}
      </div>
      <div className="px-5 pt-2">
        {tab === "blocked" && (() => { const q = blockedQueue(s); const order = { "Not started": 0, "Started": 1, "Completed": 2 }; const list = q.filter(b => blockedView === "mine" ? b.claim?.userId === user.id : blockedView === "all" ? true : b.status !== "Completed").sort((x, y) => (!!x.lost - !!y.lost) || (order[x.status] ?? 9) - (order[y.status] ?? 9) || (x.time || "").localeCompare(y.time || "")); return <div>
          <div className="flex items-center gap-1.5 py-2"><span className="text-xs flex-1" style={{ color: C.muted }}>Take a pallet before you walk to it — others see it's yours.</span>{[["open", "Open"], ["mine", "Mine"], ["all", "All"]].map(([k, l]) => <button key={k} onClick={() => setBlockedView(k)} className="text-[11px] px-2.5 py-1 rounded-full" style={{ background: blockedView === k ? C.ink : "transparent", color: blockedView === k ? C.onDark : C.ink, border: `1px solid ${blockedView === k ? C.ink : C.line}` }}>{l}</button>)}</div>
          {list.length === 0 && <p className="text-sm py-6 text-center" style={{ color: C.muted }}>{blockedView === "mine" ? "You haven't taken any pallet." : "Nothing blocked right now."}</p>}
          {list.map(b => <QueueRow key={b.key} s={s} set={set} user={user} b={b} onOpen={() => go("blockedInfo", b.key)} />)}
        </div>; })()}
        {tab === "history" && (s.products.length === 0 ? <div className="text-center py-6"><p className="text-sm font-medium mb-1">Nothing to inspect yet</p><p className="text-xs mb-3" style={{ color: C.muted }}>The Head hasn't set up products and forms yet. If you configured them in the portal, import the state here (Menu → Data).</p><button onClick={() => go("menu")} className="text-sm px-4 py-2 rounded-xl" style={{ background: C.ink, color: C.onDark }}>Menu → Data</button></div> : groups.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: C.muted }}>No inspections yet. Start with the plus button.</p> : groups.slice(0, 3).map(g => (
          <div key={g.k}><p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>{g.k}</p>{g.items.map(i => <button key={i.id} onClick={() => go("inspection", i.id)} className="w-full text-left flex items-center gap-2 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex-1 min-w-0"><p className="text-sm truncate">{s.products.find(p => p.id === i.productId)?.name || `Pallet ${(i.pallets || [])[0] || ""}`}</p><p className="text-xs" style={{ color: C.muted }}>{hhmm(i.completedAt || i.startedAt)}{i.supplier && ` · ${i.supplier}`}{i.controllerId !== user.id && ` · ${s.users.find(u => u.id === i.controllerId)?.name.split(" ")[0]}`}</p></div><ResultPill i={i} s={s} /></button>)}</div>
        )))}
      </div>
    </div>
  );
}

// A drill-down selection (which item within a screen is open) that also rides the browser's history stack, so
// stepping "back" inside a screen — browser back, hardware back, an edge-swipe, anything that fires popstate —
// undoes one level of drill-down instead of leaving the screen outright, the same way the top-level `go()` does.
// `key` only needs to be unique among the useBackSel calls active on screen at once (a component can use more than one).
function useBackSel(key, initial) {
  const read = () => { try { const st = history.state; return st && st.__qcSel && (key in st.__qcSel) ? st.__qcSel[key] : initial; } catch { return initial; } };
  const [sel, setSelRaw] = useState(read);
  const selRef = useRef(sel); selRef.current = sel;
  useEffect(() => {
    const onPop = () => { const v = read(); if (v !== selRef.current) setSelRaw(v); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const setSel = v => {
    setSelRaw(v);
    try { const cur = (history.state && history.state.__qcSel) || {}; history.pushState({ ...history.state, __qcSel: { ...cur, [key]: v } }, ""); } catch {}
  };
  return [sel, setSel];
}
// ── Wyszukiwarka produktu → karta → start ──
function MSearch({ s, user, go, onStart, setState, notify, onVisual }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useBackSel("searchSel", null);
  const list = s.products.filter(p => p.isActive !== false && (!q || (p.name + " " + (p.articleId || "") + " " + (p.barcodeCu || "") + " " + (p.barcodeTu || "")).toLowerCase().includes(q.toLowerCase())));
  const product = s.products.find(p => p.id === sel);
  if (product) return <MProductCard s={s} user={user} product={product} onBack={() => setSel(null)} onStart={typeId => onStart(product.id, null, typeId)} go={go} setState={setState} notify={notify} onVisual={onVisual} />;
  return (
    <div>
      <TopBar title="New inspection" onBack={() => go("home")} />
      <div className="px-4 pt-3"><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Product name or article ID…" className="w-full text-sm rounded-xl px-3 py-2.5 outline-none" style={{ ...inp, background: C.bg }} /></div>
      <div className="px-4 pt-2">{list.slice(0, 40).map(p => <button key={p.id} onClick={() => setSel(p.id)} className="w-full text-left flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>{asPhotoList(p.photos).length ? <img src={asPhotoList(p.photos)[0].dataUrl} alt="" className="w-10 h-10 rounded-lg object-contain" style={{ background: PHOTO_BG }} /> : <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.muted }}><Ic i={ImageIcon} s={18} mr={0} /></div>}<div className="flex-1 min-w-0"><p className="text-sm truncate">{p.name}</p><p className="text-xs" style={{ color: C.muted }}>{p.articleId || "no ID"}{p.isBio && " · bio"}</p></div><span style={{ color: C.muted }}>›</span></button>)}{list.length === 0 && <p className="text-sm py-6 text-center" style={{ color: C.muted }}>No results.</p>}</div>
    </div>
  );
}
function MProductCard({ s, user, product, onBack, onStart, go, setState, notify, onVisual }) {
  const [askOpen, setAskOpen] = useState(false); const [ask, setAsk] = useState("");
  const askHead = () => {
    if (!ask.trim() || !setState) return;
    const head = s.users.find(u => u.role === "Head" && u.active !== false); if (!head) return;
    setState(x => {
      let conv = x.conversations.find(c => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(user.id) && c.participantIds.includes(head.id));
      const msg = { id: uid(), senderId: user.id, text: ask.trim(), at: nowISO(), productId: product.id };
      if (conv) return { ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, messages: [...(c.messages || []), msg], lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) };
      return { ...x, conversations: [...x.conversations, { id: uid(), isGroup: false, name: null, participantIds: [user.id, head.id], createdBy: user.id, createdAt: nowISO(), messages: [msg], lastRead: { [user.id]: nowISO() }, isActive: true }] };
    });
    notify && notify("Question", `${user.name} asks about ${product.name}: „${ask.trim()}"`, "Conversation", null, head.id);
    setAsk(""); setAskOpen(false); go && go("chat");
  };
  const specs = effectiveSpecs(s, product), vars = effectiveVarieties(s, product);
  const last3 = s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 3);
  const anns = s.announcements.filter(a => annMatchesProduct(s, a, product));
  const ref = s.inspections.find(i => i.productId === product.id && i.isReference);
  const [flag, setFlag] = useState(""); const [flagOpen, setFlagOpen] = useState(false);
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "uncategorised"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const photos = asPhotoList(product.photos); const [photoIx, setPhotoIx] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const attrs = effectiveAttributes(s, product); const hist = recentProblemsFor(s, product.id);
  const suppliers = (product.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)?.name).filter(Boolean);
  const types = allowedTypes(s, product);
  const facts = [["CU / TU", product.cusPerTu], ["g / CU", product.weightPerCu], ["pcs / CU", product.piecesPerCu]].filter(([, v]) => v);
  const Section = ({ title, children, tone }) => <div className="rounded-2xl mb-3 overflow-hidden" style={{ background: C.surface, border: `1px solid ${tone === "bad" ? C.bad : C.line}` }}>{title && <p className="label-sm px-3.5 pt-3 pb-1" style={{ color: tone === "bad" ? C.bad : C.muted }}>{title}</p>}<div className="px-3.5 pb-3">{children}</div></div>;
  const Row = ({ k, v, last }) => <div className="flex items-baseline justify-between gap-3 py-2 text-sm" style={{ borderBottom: last ? "none" : `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="font-medium text-right">{v}</span></div>;
  return (
    <div className="pb-4">
      <TopBar title={catPath(product.categoryId)} onBack={onBack} />
      {/* Hero: the picture is the identity — a controller matches what's in front of them to it. */}
      <div className="px-4 pt-3">
        <div className="rounded-2xl overflow-hidden relative" style={{ background: C.bg, height: 220 }} onClick={() => photos.length && setZoomOpen(true)}>
          {photos.length ? <img src={photos[Math.min(photoIx, photos.length - 1)].dataUrl} alt="" className="w-full h-full object-contain" style={{ cursor: "zoom-in", background: PHOTO_BG }} /> : <div className="w-full h-full flex flex-col items-center justify-center" style={{ color: C.muted }}><Ic i={Package} s={44} mr={0} /><p className="text-[11px] mt-2">No photo yet</p></div>}
          {product.isBio && <span className="absolute top-2.5 left-2.5 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>bio</span>}
          {photos.length > 1 && <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-1.5">{photos.map((_, ix) => <button key={ix} onClick={e => { e.stopPropagation(); setPhotoIx(ix); }} className="rounded-full" style={{ width: 7, height: 7, background: ix === photoIx ? C.onDark : "rgba(255,255,255,.5)" }} />)}</div>}
        </div>
        {photos.length > 1 && <div className="flex gap-1.5 mt-2 overflow-x-auto">{photos.map((ph, ix) => <button key={ix} onClick={() => setPhotoIx(ix)} className="flex-shrink-0 rounded-lg overflow-hidden" style={{ width: 52, height: 52, outline: ix === photoIx ? `2px solid ${C.accent}` : "none" }}><img src={ph.dataUrl} alt="" className="w-full h-full object-cover" /></button>)}</div>}
        {zoomOpen && photos.length > 0 && (
          <div className="fixed inset-0 flex flex-col items-center justify-center p-4" style={{ background: "rgba(0,0,0,.9)", zIndex: 80 }} onClick={() => setZoomOpen(false)}>
            <img src={photos[Math.min(photoIx, photos.length - 1)].dataUrl} alt="" className="max-w-full max-h-full rounded-xl" style={{ objectFit: "contain" }} />
            <button onClick={() => setZoomOpen(false)} className="absolute top-4 right-5 text-2xl" style={{ color: "#fff" }}>×</button>
            {photos.length > 1 && <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5" onClick={e => e.stopPropagation()}>{photos.map((_, ix) => <button key={ix} onClick={() => setPhotoIx(ix)} className="rounded-full" style={{ width: 8, height: 8, background: ix === photoIx ? "#fff" : "rgba(255,255,255,.4)" }} />)}</div>}
          </div>
        )}

        <h2 className="mt-4 leading-tight" style={{ fontSize: 22, fontWeight: 650, letterSpacing: "-.01em" }}>{product.name}</h2>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: C.bg, border: `1px solid ${C.line}` }}>ID {product.articleId || "—"}</span>
          {suppliers.map(n => <span key={n} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}><Ic i={Truck} s={11} mr={4} />{n}</span>)}
          {vars.map(v => <span key={v.id} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{v.name}</span>)}
        </div>

        {facts.length > 0 && <div className="grid gap-2 mt-4" style={{ gridTemplateColumns: `repeat(${facts.length}, 1fr)` }}>
          {facts.map(([l, v]) => <div key={l} className="rounded-2xl px-3 py-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xl font-bold tracking-tight leading-none" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</p><p className="text-[10px] mt-1" style={{ color: C.muted }}>{l}</p></div>)}
        </div>}
        {(product.barcodeCu || product.barcodeTu) && <p className="text-[11px] mt-2 font-mono" style={{ color: C.muted }}>{product.barcodeCu && <>CU {product.barcodeCu}</>}{product.barcodeCu && product.barcodeTu && " · "}{product.barcodeTu && <>TU {product.barcodeTu}</>}</p>}

        {/* Inspect jumps straight into scanning that pallet, and Lost is handled right here — no detour through a
            separate pallet-info screen just to do either. */}
        <div className="mt-4"><DockPresence s={s} set={setState} user={user} product={product} onPickPallet={hu => go("scan", hu)} showLost /></div>
        {hist.count > 0 && <Section title={`${hist.count} rejected in the last 14 days`} tone="bad"><p className="text-sm" style={{ color: C.bad }}>{hist.problems.slice(0, 4).map(x => `${x.name} ×${x.count}`).join(", ")}{hist.problems.length > 4 ? "…" : ""}</p><p className="text-[11px] mt-0.5" style={{ color: C.muted }}>last {dayLabel(hist.lastAt)} — look for these first</p></Section>}
        {anns.map(a => <div key={a.id} className="rounded-2xl px-3.5 py-2.5 mb-3 text-sm" style={{ background: C.accentSoft, borderLeft: `3px solid ${C.accent}` }}><b>{a.title}</b><span style={{ color: C.muted }}> — {a.body}</span></div>)}
        {ref && <button onClick={() => go("inspection", ref.id)} className="w-full rounded-2xl px-3.5 py-3 mb-3 text-sm text-left flex items-center" style={{ background: C.okBg, color: C.ok }}><Ic i={Star} s={15} />Reference inspection — what a good pallet looks like<span className="ml-auto text-xs">open</span></button>}

        {specs.length > 0 && <Section title="Specifications">{specs.map((q, ix) => <Row key={q.id} k={q.name} v={specLabel(q)} last={ix === specs.length - 1} />)}</Section>}
        {attrs.length > 0 && <Section title="Properties">{attrs.map((a, ix) => <Row key={a.dictionaryId} k={a.list} v={a.value} last={ix === attrs.length - 1} />)}</Section>}
        {(() => {
          const refProblems = problemsFor(s, { kind: "Product", id: product.id }, new Set(product.hiddenProblemIds || []));
          const leafIds = new Set(refProblems.filter(p => isLeaf(refProblems, p.id)).map(p => p.id));
          const refNotes = (s.problemNotes || []).filter(n => n.productId === product.id && leafIds.has(n.problemId) && hasNoteContent(n));
          if (!refNotes.length) return null;
          return (
            <Section title="Reference guide"><div className="flex flex-col gap-3">
              {refNotes.map(n => (
                <div key={n.id}>
                  <p className="text-sm font-medium mb-1">{pathOf(refProblems, n.problemId)}</p>
                  {n.description && <p className="text-sm mb-1.5" style={{ color: C.muted }}>{n.description}</p>}
                  {asPhotoList(n.photos).length > 0 && <PhotoStrip photos={n.photos} size={56} />}
                </div>
              ))}
            </div></Section>
          );
        })()}
        {last3.length > 0 && <Section title="Recent inspections">{last3.map((i, ix) => <button key={i.id} onClick={() => go("inspection", i.id)} className="w-full flex items-center gap-2 py-2 text-left" style={{ borderBottom: ix === last3.length - 1 ? "none" : `1px solid ${C.line}` }}><span className="text-sm flex-1"><span>{dayLabel(i.completedAt)}, {hhmm(i.completedAt)}</span><span className="text-xs ml-1.5" style={{ color: C.muted }}>{s.users.find(u => u.id === i.controllerId)?.name.split(" ")[0]}</span></span><ResultPill i={i} s={s} /></button>)}</Section>}
        {product.consumerAppUrl && <a href={product.consumerAppUrl} className="block text-xs underline mb-3" style={{ color: C.accent }}>Open in the consumer app ↗</a>}

        <div className="mt-2 flex flex-col gap-2">
          {types.map((t, idx) => <button key={t.id} onClick={() => onStart(t.id)} className="w-full py-3 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2" style={idx === 0 ? { background: C.ink, color: C.onDark } : { background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}><span className="inline-block rounded-full" style={{ width: 8, height: 8, background: t.color }} />{t.name} inspection</button>)}
          {types.length === 0 && <p className="text-[11px] text-center" style={{ color: C.bad }}>{typesOf(s).length ? `No inspection type is allowed for this product (${effectivePolicy(s, product).source}).` : "The Head hasn't defined any inspection types yet (portal → Forms)."}</p>}
          <div className="flex gap-2 mt-1">
            <button onClick={() => { setAskOpen(o => !o); setFlagOpen(false); }} className="flex-1 py-2.5 rounded-xl text-sm inline-flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.line}`, color: askOpen ? C.accent : C.ink }}><Ic i={MessageSquare} s={14} />Ask the Head</button>
            <button onClick={() => { setFlagOpen(o => !o); setAskOpen(false); }} className="flex-1 py-2.5 rounded-xl text-sm inline-flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.line}`, color: flagOpen ? C.warn : C.ink }}><Ic i={Flag} s={14} />Report an issue</button>
          </div>
          {askOpen && <div className="flex gap-2"><input autoFocus value={ask} onChange={e => setAsk(e.target.value)} onKeyDown={e => e.key === "Enter" && askHead()} placeholder="e.g. is this calibre OK?" className="flex-1 text-sm rounded-xl px-3 py-2 outline-none" style={{ ...inp }} /><button onClick={askHead} className="px-3 rounded-xl text-sm" style={{ background: C.accent, color: C.onDark }}>Send</button></div>}
          {flagOpen && <div className="flex gap-2"><input autoFocus value={flag} onChange={e => setFlag(e.target.value)} placeholder="what's wrong in this profile?" className="flex-1 text-sm rounded-xl px-3 py-2 outline-none" style={{ ...inp }} /><button onClick={() => { if (flag.trim() && setState) { setState(x => ({ ...x, flags: [...x.flags, { id: uid(), productId: product.id, inspectionId: null, raisedBy: user.id, description: flag.trim(), status: "Open", createdAt: nowISO() }] })); notify && notify("Flag", `${user.name}: ${product.name} — ${flag.trim()}`, "ProductFlag", null); setFlag(""); setFlagOpen(false); } }} className="px-3 rounded-xl text-sm" style={{ background: C.accent, color: C.onDark }}>Send</button></div>}
        </div>
      </div>
    </div>
  );
}

function LiveScanner({ onCode }) {
  const [state, setState] = useState("idle"); const [err, setErr] = useState(""); const [decoder, setDecoder] = useState(""); const videoRef = useRef(null); const streamRef = useRef(null); const timerRef = useRef(null); const zxingRef = useRef(null);
  const secure = typeof window !== "undefined" && (window.isSecureContext || location.hostname === "localhost");
  const stop = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } try { zxingRef.current?.stopContinuousDecode?.(); zxingRef.current?.reset?.(); } catch (e) {} zxingRef.current = null; try { streamRef.current?.getTracks().forEach(t => t.stop()); } catch (e) {} streamRef.current = null; if (videoRef.current) videoRef.current.srcObject = null; setState("idle"); };
  const found = txt => { const code = String(txt || "").replace(/[^0-9A-Za-z]/g, ""); if (!code) return; stop(); onCode(code); };
  const start = async () => {
    setErr(""); if (!secure) { setErr("The camera only works over HTTPS (or localhost)."); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setErr("This browser exposes no camera API. Type the code below."); return; }
    setState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      streamRef.current = stream; const v = videoRef.current; v.srcObject = stream; v.setAttribute("playsinline", "true"); v.muted = true; await v.play(); setState("live");
      if (window.BarcodeDetector) {
        setDecoder("native"); const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "code_39", "itf", "qr_code"] });
        timerRef.current = setInterval(async () => { try { if (v.readyState < 2) return; const codes = await det.detect(v); if (codes.length) found(codes[0].rawValue); } catch (e) {} }, 250);
      } else if (window.ZXingBrowser?.BrowserMultiFormatReader) {
        setDecoder("zxing"); const reader = new window.ZXingBrowser.BrowserMultiFormatReader(); zxingRef.current = reader;
        reader.decodeFromVideoElement(v, (result) => { if (result) found(result.getText()); });
      } else { setDecoder("none"); }
    } catch (e) { setErr(e?.name === "NotAllowedError" ? "Camera permission denied — allow it in Settings → Safari → Camera." : e?.name === "NotFoundError" ? "No camera found." : String(e?.message || e)); stop(); }
  };
  useEffect(() => () => stop(), []);
  return (
    <div className="rounded-2xl overflow-hidden mb-3 relative" style={{ background: "#0b0f0d", minHeight: 220 }}>
      <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: 220, objectFit: "cover", display: state === "live" ? "block" : "none", background: "#000" }} />
      {state === "live" && <div className="absolute pointer-events-none" style={{ left: "8%", right: "8%", top: "30%", height: "40%", border: "2px solid rgba(255,255,255,.7)", borderRadius: 10 }} />}
      {state === "live" && <div className="absolute left-0 right-0 bottom-0 flex items-center gap-2 px-3 py-1.5 text-[11px]" style={{ color: "#fff", background: "rgba(0,0,0,.5)" }}><span className="flex-1">{decoder === "native" ? "Scanning (native)" : decoder === "zxing" ? "Scanning (ZXing)" : "Preview only — no decoder in this browser, type the code below"}</span><button onClick={stop} className="underline">stop</button></div>}
      {state !== "live" && <button onClick={start} className="absolute inset-0 w-full flex flex-col items-center justify-center" style={{ color: "#fff" }}><ScanLine size={40} strokeWidth={1.5} /><span className="text-sm mt-2 font-medium">{state === "starting" ? "Starting camera…" : "Tap to scan with the camera"}</span><span className="text-[11px] opacity-70 mt-0.5">pallet SSCC · product EAN</span></button>}
      {err && <p className="absolute left-0 right-0 top-0 text-[11px] px-3 py-2" style={{ color: "#fff", background: "#5a2a2a" }}>{err}</p>}
    </div>
  );
}
// Code classification: a pallet number (SSCC) is long (≥14 digits); a product code is an EAN (8/13) or an article ID.
const isPalletCode = code => /^\d{14,}$/.test(code.trim());
// GS1-128 pallet labels encode the SSCC behind application identifier "00" (often with more AIs concatenated):
// "00087205744101641093" → "087205744101641093". Sheets sometimes drop the leading zero, so matching is by suffix.
const extractSSCC = raw => { const d = String(raw || "").replace(/\D/g, ""); const m = /(?:^|\D)00(\d{18})/.exec(String(raw || "")) || (d.length >= 20 && d.startsWith("00") ? [null, d.slice(2, 20)] : null); if (m) return m[1]; if (d.length >= 18) return d.slice(0, 18); return d; };
const samePallet = (a, b) => { const x = String(a || "").replace(/\D/g, "").replace(/^0+/, ""), y = String(b || "").replace(/\D/g, "").replace(/^0+/, ""); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
// The WMS dock sheet can lag behind — a pallet already reported still shows up "on dock" until the next push. This is
// what actually decides that, so it's surfaced everywhere a pallet is browsed, not only when its exact code is scanned.
const completedInspectionFor = (s, hu) => (s.inspections || []).filter(i => i.status === "Completed" && (i.pallets || []).some(h => samePallet(h, hu))).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0] || null;
const dockRowsFor = product => product ? dockRowsLive(_S).filter(r => r.article === product.articleId) : [];
// showLost (only passed from the product profile, not from inside the scan flow) also renders Mark-as-lost inline per
// pallet, so acting on a specific pallet from here never needs a hop through a separate info screen first.
function DockPresence({ s, set, user, product, onPickPallet, showLost, compact }) {
  const rows = dockRowsFor(product); const [open, setOpen] = useState(false);
  const pallets = rows.length;
  const blocked = blockedRowsLive(_S).filter(b => b.article === product?.articleId && b.status !== "Completed");
  if (!rows.length && !blocked.length) return <div className="rounded-xl px-3 py-2 mb-2 text-xs flex items-center" style={{ background: C.bg, color: C.muted }}><Ic i={Truck} s={13} />Not on the docks right now.</div>;
  if (!rows.length) return <div className="rounded-xl px-3 py-2 mb-2 text-xs flex items-center" style={{ background: C.badBg, color: C.bad }}><Ic i={LockIcon} s={13} />Blocked for picking — {blocked.length} pallet{blocked.length === 1 ? "" : "s"} at {[...new Set(blocked.map(b => b.location))].join(", ")} ({blocked.map(b => b.status).join(", ")}).</div>;
  // Different PO numbers under the same product usually mean separate deliveries, possibly different quality — flagged
  // up front so it's seen before picking a pallet to inspect, not discovered later.
  const pos = [...new Set(rows.map(r => (r.po || "").trim()).filter(Boolean))];
  return (
    <div className="rounded-xl mb-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <span style={{ color: C.accent }}><Ic i={Truck} s={15} mr={0} /></span>
        <span className="text-sm flex-1"><b>On the docks now</b> — {pallets} pallet{pallets === 1 ? "" : "s"} · {rows.length} HU{(rows.some(r => r.blocking) || blocked.length) ? <span style={{ color: C.bad }}> · blocked for picking{blocked.length ? ` (${blocked.length})` : ""}</span> : ""}</span>
        <span className="text-xs" style={{ color: C.muted }}>{open ? "hide" : "where?"}</span>
      </button>
      {pos.length > 1 && <p className="mx-3 mb-2 px-2.5 py-1.5 rounded-lg text-[11px] flex items-center" style={{ background: C.warnBg, color: C.warn }}><Ic i={AlertTriangle} s={11} mr={4} />Different PO numbers on these pallets ({pos.join(", ")}) — likely separate deliveries, don't assume one inspection covers all.</p>}
      {open && <div className="px-3 pb-2">{rows.map(r => (
        <div key={r.hu} className="py-2" style={{ borderTop: `1px solid ${C.line}` }}>
          <button onClick={() => onPickPallet && onPickPallet(r.hu)} className="w-full text-left flex items-center gap-2">
            <span className="flex-1 min-w-0"><span className="block text-xs font-mono truncate">HU {r.hu}</span><span className="block text-[11px]" style={{ color: C.muted }}>{r.location} · {r.priority} · {r.transporter} {r.arrivedTime}{r.po ? ` · PO ${r.po}` : ""}{r.blocking ? " · needed today" : ""}</span></span>
            {onPickPallet && <span className="text-xs font-medium" style={{ color: C.accent }}>Inspect ›</span>}
          </button>
          {showLost && <MLostControls s={s} set={set} user={user} row={r} />}
        </div>
      ))}</div>}
    </div>
  );
}
function MScan({ s, user, go, onStart, onVisual, onSkip, setState, notify, preset }) {
  const [code, setCode] = useState(preset || ""); const [mode, setMode] = useState(null); const [confirmCollision, setConfirmCollision] = useState(null); const [starting, setStarting] = useState(null);
  const [pallet, setPallet] = useState(""); const [askInspect, setAskInspect] = useState(false);
  const scanned = code.trim();
  const byPallet = pallet ? s.inspections.filter(i => (i.pallets || []).some(x => samePallet(x, pallet)) && i.status !== "Cancelled") : [];
  const completed = byPallet.find(i => i.status === "Completed"), draft = byPallet.find(i => ["Draft", "PendingReview"].includes(i.status));
  const productByCode = c => s.products.find(p => p.isActive !== false && matchesCode(p, c));
  const product = mode === "product" ? productByCode(scanned) : null;
  const wms = pallet ? dockRowsLive(s).find(r => samePallet(r.hu, pallet)) || null : null;
  const blockedRow = pallet ? blockedQueue(s).find(b => b.hu && samePallet(b.hu, pallet)) || null : null;
  const wmsProduct = wms ? s.products.find(p => p.articleId === wms.article) : null;
  const scan = (given) => {
    const val = (given ?? scanned).trim(); if (given != null) setCode(val); if (!val) return; const scannedNow = val;
    if (isPalletCode(scannedNow)) { const sscc = extractSSCC(scannedNow); setPallet(sscc); setAskInspect(false); const lostRow = dockRowsLive(s).find(r => samePallet(r.hu, sscc)) || blockedRowsLive(s).find(r => samePallet(r.hu, sscc)); if (lostRow && lostOf(s, lostRow)) markFound(setState, lostRow, user); const done = s.inspections.find(i => (i.pallets || []).some(x => samePallet(x, sscc)) && i.status === "Completed"); setMode(done ? "done" : "pallet"); }
    else if (productByCode(scannedNow)) { setPallet(""); setMode("product"); }
    else setMode("unknown-product");
  };
  const start = (pid, typeId = "type-full") => { if (draft && draft.controllerId !== user.id) { setConfirmCollision({ draft, pid, typeId }); return; } onStart(pid, pallet || null, typeId); };
  const pickPalletOfProduct = hu => { setCode(hu); setPallet(hu); const done = s.inspections.find(i => (i.pallets || []).some(x => samePallet(x, hu)) && i.status === "Completed"); setMode(done ? "done" : "pallet"); };
  const Actions = () => { const known = wmsProduct || (completed && s.products.find(p => p.id === completed.productId)); const types = known ? allowedTypes(s, known) : typesOf(s); const pol = known ? effectivePolicy(s, known) : null; return (
    <div className="flex flex-col gap-2 mt-1">
      {types.map((t, idx) => <button key={t.id} onClick={() => setStarting({ kind: t.id })} className="w-full py-3 rounded-xl text-sm font-medium inline-flex items-center justify-center gap-2" style={idx === 0 ? { background: C.ink, color: C.onDark } : { background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}><span className="inline-block rounded-full" style={{ width: 8, height: 8, background: t.color }} />{t.name} inspection</button>)}
      {known && types.length === 0 && <p className="text-[11px] text-center" style={{ color: C.bad }}>{typesOf(s).length ? `No inspection type is allowed for this product (${pol.source}).` : "The Head hasn't defined any inspection types yet (portal → Forms)."}</p>}
      {!known && <p className="text-[11px] text-center" style={{ color: C.muted }}>Which types are allowed depends on the product you pick.</p>}
    </div>
  ); };
  const P = ({ label }) => { const [fg, bg, solid] = PRIORITY[label]; return <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5" style={{ background: solid ? C.ink : C.surface, color: solid ? C.onDark : C.ink, border: `1px solid ${solid ? C.ink : C.line}` }}><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: solid ? C.bad : fg }} />{label}</span>; };
  return (
    <div className="pb-4">
      <TopBar title="Scan code" onBack={() => go("home")} />
      <div className="px-4 pt-3">
        <LiveScanner onCode={code => scan(code)} />
        <p className="text-xs mb-1" style={{ color: C.muted }}>Pallet number (SSCC) or product code (EAN / article ID) — the scanner tells them apart by length</p>
        {pallet && scanned !== pallet && <p className="text-[11px] mb-1" style={{ color: C.muted }}>scanned <span className="font-mono">{scanned}</span> → SSCC <span className="font-mono">{pallet}</span></p>}
        <div className="flex gap-2 mb-3"><input value={code} onChange={e => { setCode(e.target.value); setMode(null); }} onKeyDown={e => e.key === "Enter" && scan()} placeholder="or type the code: 387175210024377766 / 11413643" className="flex-1 text-sm rounded-xl px-3 py-2.5 outline-none font-mono" style={{ ...inp }} /><button onClick={() => scan()} className="px-3 rounded-xl text-sm" style={{ background: C.accent, color: C.onDark }}>Scan</button></div>

        {mode === "unknown-product" && (
          <div className="rounded-2xl p-4" style={{ background: C.bg }}>
            <p className="text-sm font-medium mb-1 flex items-center" style={{ color: C.warn }}><Ic i={AlertTriangle} s={14} />Product code not in the catalog</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>No product has barcode or article ID <span className="font-mono">{scanned}</span>. Either the profile is missing this code, or the product isn't set up yet.</p>
            <button onClick={() => go("catalog")} className="w-full py-2.5 rounded-xl text-sm mb-2" style={{ border: `1px solid ${C.line}` }}>Find the product in the catalog</button>
            <button onClick={() => setMode(null)} className="w-full py-2 text-sm" style={{ color: C.muted }}>Cancel</button>
          </div>
        )}

        {mode === "product" && product && (
          <div>
            {(() => { const k = codeKind(product, scanned); return k && k !== "article" && <p className="text-xs mb-2 px-1" style={{ color: C.muted }}>Scanned the <b style={{ color: C.ink }}>{k === "TU" ? "TU barcode (box / case)" : "CU barcode (consumer pack)"}</b> · {scanned}</p>; })()}
            <DockPresence product={product} onPickPallet={pickPalletOfProduct} />
            <MProductCard s={s} user={user} product={product} onBack={() => setMode(null)} onStart={typeId => start(product.id, typeId)} go={go} setState={setState} notify={notify} onVisual={onVisual} />
          </div>
        )}

        {mode === "done" && completed && (
          <div className="rounded-2xl p-4" style={{ background: C.bg }}>
            <p className="text-sm font-medium mb-1 flex items-center" style={{ color: C.ok }}><Ic i={Check} s={14} />Pallet already inspected</p>
            <p className="text-sm mb-3">{completed.productId ? <button onClick={() => go("catalog", completed.productId)} className="font-semibold underline" style={{ color: C.accent }}>{s.products.find(p => p.id === completed.productId)?.name || "product"}</button> : "no product"} · {s.users.find(u => u.id === completed.controllerId)?.name} · {dayLabel(completed.completedAt)}, {hhmm(completed.completedAt)}{" · " + inspType(s, completed).name.toLowerCase()}</p>
            <div className="flex items-center gap-2 mb-3"><ResultPill i={completed} s={s} /><span className="text-xs" style={{ color: C.muted }}>{completed.comment}</span></div>
            <button onClick={() => go("inspection", completed.id)} className="w-full py-2.5 rounded-xl text-sm mb-1" style={{ border: `1px solid ${C.line}` }}>{completed.template ? "View report" : "View entry"}</button>
            <p className="text-xs mt-2 mb-1" style={{ color: C.muted }}>Inspect again?</p>
            <Actions />
          </div>
        )}

        {mode === "pallet" && wms && (<>
          <MProductHeader s={s} product={wmsProduct} article={wms.article} name={wms.name} go={go} />
          <div className="rounded-2xl p-4" style={{ background: C.bg }}>
            <div className="flex items-center justify-between mb-2"><span className="text-sm font-medium inline-flex items-center" style={{ color: C.ok }}><Ic i={Check} s={14} />Pallet on dock</span><P label={wms.priority} /></div>
            {wms.blocking && <div className="rounded-xl px-3 py-2 mb-2 text-xs" style={{ background: C.badBg, color: C.bad }}>Needed today — picking is waiting for this pallet.</div>}
            <div className="rounded-xl p-3 mb-2 text-sm" style={{ background: C.surface }}>
              {[["Handling Unit", pallet], ["Article", wms.article], ["Location", wms.location], ["Arrived", `${wms.arrived} ${wms.arrivedTime} · ${wms.transporter}`], ["PO", wms.po || "—"], ["CU per TU (from UOM)", wms.cusPerTu ?? "—"], ["Sortable", wms.sortable ? "yes" : "no"]].map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-1" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="font-medium text-right">{v}</span></div>)}
            </div>
            {(() => { const sameArt = dockRowsLive(s).filter(r => r.article === wms.article); const others = sameArt.filter(r => !samePallet(r.hu, pallet)); return <>
              <p className="text-xs mb-2" style={{ color: C.muted }}>{wmsProduct ? <>Product pre-selected.</> : <span style={{ color: C.warn }}>No profile — you'll pick the product manually.</span>} <span>This article has <b style={{ color: C.ink }}>{sameArt.length} pallet{sameArt.length === 1 ? "" : "s"}</b> on the docks{others.length ? ` — ${others.length} other${others.length === 1 ? "" : "s"} at ${[...new Set(others.map(r => r.location))].join(", ")}` : ""}.</span></p>
              {others.length > 0 && <DockPresence product={{ articleId: wms.article, name: wms.name }} onPickPallet={pickPalletOfProduct} />}
            </>; })()}
            <Actions />
            {draft && <div className="rounded-xl px-3 py-2 mt-2 text-xs" style={{ background: C.warnBg, color: C.warn }}>⏳ {s.users.find(u => u.id === draft.controllerId)?.name} has this pallet in progress ({STATUS[draft.status][0]})</div>}
            <button onClick={() => setMode(null)} className="w-full py-2.5 text-sm mt-1" style={{ color: C.muted }}>Cancel</button>
          </div>
        </>)}

        {mode === "pallet" && !wms && blockedRow && (
          <div className="rounded-2xl p-4 mb-3" style={{ background: C.badBg }}>
            <p className="text-sm font-medium mb-1 flex items-center" style={{ color: C.bad }}><Ic i={LockIcon} s={14} />Blocked for picking</p>
            <p className="text-xs mb-2" style={{ color: C.ink }}>{blockedRow.name || blockedRow.article} · {blockedRow.location}{blockedRow.zone ? ` · zone ${blockedRow.zone}` : ""}{blockedRow.deadline ? ` · needed by ${blockedRow.deadline}` : ""}</p>
            <QueueRow s={s} set={setState} user={user} b={blockedRow} onOpen={() => go("blockedInfo", blockedRow.key)} />
          </div>
        )}
        {mode === "pallet" && !wms && (
          <div className="rounded-2xl p-4" style={{ background: C.bg }}>
            <p className="text-sm font-medium mb-1 flex items-center" style={{ color: C.warn }}><Ic i={AlertTriangle} s={14} />{blockedRow ? "Not on the dock sheet" : "Unknown pallet"}</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>HU <span className="font-mono">{pallet}</span> is not on the docks and has never been inspected. It may be a fresh arrival not yet in the WMS.</p>
            {!askInspect ? (
              <>
                <button onClick={() => setAskInspect(true)} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: C.ink, color: C.onDark }}>Inspect it anyway</button>
                <button onClick={() => setMode(null)} className="w-full py-2.5 text-sm mt-1" style={{ color: C.muted }}>Cancel</button>
              </>
            ) : (
              <>
                <p className="text-xs mb-2" style={{ color: C.muted }}>Now scan the <b style={{ color: C.ink }}>product code</b> on the pack, or pick the product — then choose the inspection type.</p>
                <Actions />
                {draft && <div className="rounded-xl px-3 py-2 mt-2 text-xs" style={{ background: C.warnBg, color: C.warn }}>⏳ {s.users.find(u => u.id === draft.controllerId)?.name} has this pallet in progress ({STATUS[draft.status][0]})</div>}
                <button onClick={() => setMode(null)} className="w-full py-2.5 text-sm mt-1" style={{ color: C.muted }}>Cancel</button>
              </>
            )}
          </div>
        )}
      </div>
      <StartModal open={!!starting} kind={starting?.kind} s={s} pallet={pallet} presetProductId={wmsProduct?.id || completed?.productId || null} onClose={() => setStarting(null)} onConfirm={({ productId }) => { const k = starting.kind; setStarting(null); start(productId, k); }} />
      <Modal open={!!confirmCollision}>
        <p className="font-semibold mb-1">Someone is already on this pallet</p>
        <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>{confirmCollision && s.users.find(u => u.id === confirmCollision.draft.controllerId)?.name} has an open inspection ({confirmCollision && STATUS[confirmCollision.draft.status][0]}) since {confirmCollision && hhmm(confirmCollision.draft.startedAt)}. Two inspections of the same pallet waste time. Continue?</p>
        <button onClick={() => { onStart(confirmCollision.pid, pallet || null, confirmCollision.typeId); setConfirmCollision(null); }} className="w-full py-3 rounded-xl text-sm font-medium mb-2" style={{ background: C.ink, color: C.onDark }}>Yes, start anyway</button>
        <button onClick={() => setConfirmCollision(null)} className="w-full py-2.5 text-sm" style={{ color: C.muted }}>No, go back</button>
      </Modal>
    </div>
  );
}

// ── History of filtrami (dolny arkusz) ──
function MHistory({ s, user, go }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ range: "7", result: "", status: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "", type: "" });
  const [q, setQ] = useState("");
  const matchCode = i => { if (f.code.trim() && dateCode(i.dateISO) !== f.code.trim()) return false; if (f.packFrom && (!i.dateISO || i.dateISO < f.packFrom)) return false; if (f.packTo && (!i.dateISO || i.dateISO > f.packTo)) return false; return true; };
  const matchQ = i => { if (!q.trim()) return true; const p = s.products.find(x => x.id === i.productId); return ((p?.name || "") + " " + (p?.articleId || "")).toLowerCase().includes(q.trim().toLowerCase()); };
  const today = new Date(); const since = f.range === "custom" ? null : new Date(today.getFullYear(), today.getMonth(), today.getDate() - (f.range === "0" ? 0 : Number(f.range) - 1));
  const list = s.inspections.filter(i => i.status !== "Cancelled").filter(i => !f.type || (i.typeId || legacyTypeId(i.type)) === f.type).filter(matchQ).filter(matchCode).filter(i => { const d = new Date(i.completedAt || i.startedAt); if (since && d < since) return false; if (f.range === "custom") { if (f.from && (i.completedAt || i.startedAt).slice(0, 10) < f.from) return false; if (f.to && (i.completedAt || i.startedAt).slice(0, 10) > f.to) return false; } if (f.result && i.result !== f.result) return false; if (f.status && i.status !== f.status) return false; if (f.supplier && i.supplier !== f.supplier) return false; if (f.controller && i.controllerId !== f.controller) return false; if (f.category && s.products.find(p => p.id === i.productId)?.categoryId !== f.category) return false; return true; }).sort((a, b) => (b.completedAt || b.startedAt || "").localeCompare(a.completedAt || a.startedAt || ""));
  const groups = []; list.forEach(i => { const k = dayLabel(i.completedAt || i.startedAt); let g = groups.find(x => x.k === k); if (!g) { g = { k, items: [] }; groups.push(g); } g.items.push(i); });
  const active = ["result", "status", "supplier", "controller", "category"].filter(k => f[k]).length + (f.range !== "7" ? 1 : 0) + ((f.code.trim() || f.packFrom || f.packTo) ? 1 : 0);
  const Chip = ({ on, onClick, children }) => <button onClick={onClick} className="text-xs px-3 py-1.5 rounded-full" style={{ background: on ? C.ink : "transparent", color: on ? C.onDark : C.ink, border: `1px solid ${on ? C.ink : C.line}` }}>{children}</button>;
  const suppliers = [...new Set(s.inspections.map(i => i.supplier).filter(Boolean))];
  return (
    <div className="pb-4 relative" style={{ minHeight: "100%" }}>
      <TopBar title="Inspection history" onBack={() => go("home")} right={<button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-full" style={{ border: `1px solid ${active ? C.ink : C.line}`, fontWeight: active ? 500 : 400 }}>Filtry{active ? ` · ${active}` : ""}</button>} />
      <div className="px-4 pt-3"><SearchBox autoFocus value={q} onChange={setQ} placeholder="Search by product name or ID…" inputClass="rounded-xl py-2.5" /></div>
      <div className="px-4">{groups.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>Nothing matches.</p> : groups.map(g => <div key={g.k}><p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>{g.k}</p>{g.items.map(i => <button key={i.id} onClick={() => go("inspection", i.id)} className="w-full text-left flex items-center gap-2 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex-1 min-w-0"><p className="text-sm truncate">{s.products.find(p => p.id === i.productId)?.name || `Pallet ${(i.pallets || [])[0] || ""}`}</p><p className="text-xs" style={{ color: C.muted }}>{hhmm(i.completedAt || i.startedAt)}{i.dateISO && ` · DC ${dateCode(i.dateISO)}`}{i.supplier && ` · ${i.supplier}`} · {s.users.find(u => u.id === i.controllerId)?.name.split(" ")[0]}</p></div><ResultPill i={i} s={s} /></button>)}</div>)}</div>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filters">
        <div className="flex items-center justify-between mb-2"><span className="label-sm" style={{ color: C.muted }}>Date range</span><button onClick={() => setF({ range: "7", result: "", status: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "", type: "" })} className="text-xs" style={{ color: C.accent }}>Clear everything</button></div>
        <div className="flex flex-wrap gap-1.5 mb-3">{[["0", "Today"], ["7", "7 days"], ["30", "30 days"], ["custom", "Custom"]].map(([k, l]) => <Chip key={k} on={f.range === k} onClick={() => setF(x => ({ ...x, range: k }))}>{l}</Chip>)}</div>
        {f.range === "custom" && <div className="flex gap-2 mb-3"><input type="date" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inp }} /></div>}
        <p className="label-sm mb-1" style={{ color: C.muted }}>Date code (packing date)</p>
        <p className="text-[10px] mb-2" style={{ color: C.muted }}>A different axis than the inspection date — a pallet with code 372 may be inspected in week 38.</p>
        <div className="flex gap-2 mb-3 items-center"><input value={f.code} onChange={e => setF(x => ({ ...x, code: e.target.value }))} placeholder="code, e.g. 382" className="w-24 text-sm rounded-lg px-2 py-1.5 outline-none font-mono" style={{ ...inp }} /><span className="text-xs" style={{ color: C.muted }}>or</span><input type="date" value={f.packFrom} onChange={e => setF(x => ({ ...x, packFrom: e.target.value }))} className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={f.packTo} onChange={e => setF(x => ({ ...x, packTo: e.target.value }))} className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none" style={{ ...inp }} /></div>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Type</p>
        <div className="flex flex-wrap gap-1.5 mb-3">{[["", "all"], ...typesOf(s).map(t => [t.id, t.name.toLowerCase()])].map(([k, l]) => <Chip key={k} on={f.type === k} onClick={() => setF(x => ({ ...x, type: k }))}>{l}</Chip>)}</div>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Result</p>
        <div className="flex flex-wrap gap-1.5 mb-3">{[["", "all"], ["Accepted", "accepted"], ["Rejected", "rejected"]].map(([k, l]) => <Chip key={k} on={f.result === k} onClick={() => setF(x => ({ ...x, result: k }))}>{l}</Chip>)}</div>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Status</p>
        <div className="flex flex-wrap gap-1.5 mb-3">{[["", "all"], ["Completed", "completed"], ["Draft", "drafts"], ["PendingReview", "awaiting Head"]].map(([k, l]) => <Chip key={k} on={f.status === k} onClick={() => setF(x => ({ ...x, status: k }))}>{l}</Chip>)}</div>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Supplier</p>
        <select value={f.supplier} onChange={e => setF(x => ({ ...x, supplier: e.target.value }))} className="w-full text-sm rounded-lg px-2 py-2 outline-none mb-3" style={{ ...inp }}><option value="">all</option>{suppliers.map(n => <option key={n} value={n}>{n}</option>)}</select>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Controller</p>
        <select value={f.controller} onChange={e => setF(x => ({ ...x, controller: e.target.value }))} className="w-full text-sm rounded-lg px-2 py-2 outline-none mb-3" style={{ ...inp }}><option value="">all</option>{s.users.filter(u => u.role === "Controller").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <p className="label-sm mb-2" style={{ color: C.muted }}>Product category</p>
        <select value={f.category} onChange={e => setF(x => ({ ...x, category: e.target.value }))} className="w-full text-sm rounded-lg px-2 py-2 outline-none mb-4" style={{ ...inp }}><option value="">all</option>{s.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={() => setOpen(false)} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: C.ink, color: C.onDark }}>Show results ({list.length})</button>
      </Sheet>
    </div>
  );
}

// ── Catalog (baza wiedzy): kategorie → produkty, wyszukiwanie po wszystkim, filtry, recently inspected ──
// A product carries up to two barcodes — CU (consumer pack) and TU (box/case); every product has at least one.
// codeKind tells the controller which one they just scanned.
const productCodes = p => [["article", p.articleId], ["CU", p.barcodeCu], ["TU", p.barcodeTu]].filter(([, v]) => v && String(v).trim());
const codeKind = (p, c) => (productCodes(p).find(([, v]) => String(v).trim() === String(c).trim()) || [null])[0];
const matchesCode = (p, c) => !!codeKind(p, c);
function MCatalog({ s, user, go, onStart, setState, notify, onVisual, preset }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useBackSel("catalogSel", preset || null); const [cat, setCat] = useBackSel("catalogCat", null); const [fOpen, setFOpen] = useState(false);
  const [f, setF] = useState({ bio: "", supplier: "", flagged: false, reference: false, sort: "name" });
  const product = s.products.find(p => p.id === sel);
  if (product) return <MProductCard s={s} user={user} product={product} onBack={() => setSel(null)} onStart={typeId => onStart(product.id, null, typeId)} go={go} setState={setState} notify={notify} onVisual={onVisual} />;
  const supName = id => (s.suppliers || []).find(x => x.id === id)?.name || "";
  const catOf = id => s.categories.find(c => c.id === id);
  const catChain = id => { const out = []; let c = catOf(id); while (c) { out.unshift(c); c = c.parentId ? catOf(c.parentId) : null; } return out; };
  const lastInsp = pid => s.inspections.filter(i => i.productId === pid && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  const haystack = p => [p.name, p.articleId, p.barcodeCu, p.barcodeTu, ...catChain(p.categoryId).map(c => c.name), ...(p.supplierIds || []).map(supName), ...effectiveVarieties(s, p).map(v => v.name)].join(" ").toLowerCase();
  const qq = q.trim().toLowerCase();
  const inCat = p => !cat || catChain(p.categoryId).some(c => c.id === cat);
  const passF = p => (!f.bio || (f.bio === "bio" ? p.isBio : !p.isBio)) && (!f.supplier || (p.supplierIds || []).includes(f.supplier) || (p.supplierIds || []).length === 0 && false) && (!f.flagged || s.flags.some(x => x.productId === p.id && x.status === "Open")) && (!f.reference || s.inspections.some(i => i.productId === p.id && i.isReference));
  const sortP = arr => [...arr].sort((a, b) => f.sort === "recent" ? ((lastInsp(b.id)?.completedAt || "").localeCompare(lastInsp(a.id)?.completedAt || "")) : f.sort === "rejected" ? ((lastInsp(b.id)?.result === "Rejected") - (lastInsp(a.id)?.result === "Rejected")) : a.name.localeCompare(b.name, "en"));
  const products = sortP(s.products.filter(p => p.isActive !== false && inCat(p) && passF(p) && (!qq || haystack(p).includes(qq))));
  const matchingCats = qq ? s.categories.filter(c => c.name.toLowerCase().includes(qq)) : [];
  const recentIds = [...new Set(s.inspections.filter(i => i.controllerId === user.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).map(i => i.productId))].slice(0, 6);
  const recent = recentIds.map(id => s.products.find(p => p.id === id)).filter(Boolean);
  const topCats = s.categories.filter(c => !c.parentId), subCats = cat ? s.categories.filter(c => c.parentId === cat) : [];
  const countIn = cid => s.products.filter(p => catChain(p.categoryId).some(c => c.id === cid)).length;
  const fCount = (f.bio ? 1 : 0) + (f.supplier ? 1 : 0) + (f.flagged ? 1 : 0) + (f.reference ? 1 : 0) + (f.sort !== "name" ? 1 : 0);
  const Chip = ({ on, onClick, children }) => <button onClick={onClick} className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: on ? C.ink : "transparent", color: on ? C.onDark : C.ink, border: `1px solid ${on ? C.ink : C.line}` }}>{children}</button>;
  const Tile = ({ p }) => { const li = lastInsp(p.id); const openFlag = s.flags.some(x => x.productId === p.id && x.status === "Open"); return (
    <button onClick={() => setSel(p.id)} className="rounded-2xl p-2.5 text-left relative" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      {asPhotoList(p.photos).length ? <img src={asPhotoList(p.photos)[0].dataUrl} alt="" className="w-full h-20 rounded-xl object-contain mb-2" style={{ background: PHOTO_BG }} /> : <div className="w-full h-20 rounded-xl flex items-center justify-center mb-2" style={{ background: C.surface, color: C.muted }}><Ic i={ImageIcon} s={22} mr={0} /></div>}
      <p className="text-xs font-medium leading-tight" style={{ minHeight: 32 }}>{p.name}</p>
      <div className="flex items-center gap-1.5 mt-1.5"><span className="text-[10px]" style={{ color: C.muted }}>{p.articleId || "—"}</span>{p.isBio && <span className="text-[9px] px-1 rounded" style={{ background: C.okBg, color: C.ok }}>bio</span>}<div className="flex-1" />{openFlag && <Ic i={Flag} s={11} mr={0} style={{ color: C.warn }} />}{li && <span title={`ostatnia: ${li.result === "Accepted" ? "accepted" : "rejected"}, ${dayLabel(li.completedAt)}`} className="inline-block rounded-full" style={{ width: 8, height: 8, background: li.result === "Accepted" ? C.ok : C.bad }} />}</div>
    </button>
  ); };
  const Grid = ({ items }) => items.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: C.muted }}>Nothing matches.</p> : <div className="grid grid-cols-2 gap-2">{items.map(p => <Tile key={p.id} p={p} />)}</div>;
  return (
    <div className="pb-4 relative" style={{ minHeight: "100%" }}>
      <TopBar title="Product catalog" right={<button onClick={() => setFOpen(true)} className="text-xs px-3 py-1.5 rounded-full inline-flex items-center" style={{ border: `1px solid ${fCount ? C.ink : C.line}`, fontWeight: fCount ? 600 : 400 }}><Ic i={Filter} s={12} mr={4} />Filtry{fCount ? ` · ${fCount}` : ""}</button>} />
      <div className="px-4 pt-3"><SearchBox value={q} onChange={setQ} placeholder="Product, ID, category, supplier, variety…" inputClass="rounded-xl py-2.5" /></div>
      {qq ? (
        <div className="px-4 pt-3">
          {matchingCats.length > 0 && <><p className="label-sm mb-1.5">Categories</p><div className="flex flex-wrap gap-1.5 mb-4">{matchingCats.map(c => <Chip key={c.id} on={false} onClick={() => { setCat(c.id); setQ(""); }}>{c.name} · {countIn(c.id)}</Chip>)}</div></>}
          <p className="label-sm mb-1.5">Products · {products.length}</p>
          <Grid items={products} />
        </div>
      ) : cat ? (
        <div className="px-4 pt-3">
          <button onClick={() => setCat(catOf(cat)?.parentId || null)} className="text-xs mb-2 inline-flex items-center" style={{ color: C.accent }}><Ic i={ChevronLeft} s={14} mr={2} />{catOf(cat)?.parentId ? catOf(catOf(cat).parentId)?.name : "All categories"}</button>
          <h2 className="mb-1">{catOf(cat)?.name}</h2>
          <p className="text-xs mb-3" style={{ color: C.muted }}>{products.length} products{(catOf(cat)?.specs || []).length ? ` · category specs: ${catOf(cat).specs.map(x => `${x.name} ${specLabel(x)}`).join(", ")}` : ""}</p>
          {subCats.length > 0 && <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">{subCats.map(c => <Chip key={c.id} on={false} onClick={() => setCat(c.id)}>{c.name} · {countIn(c.id)}</Chip>)}</div>}
          <Grid items={products} />
        </div>
      ) : (
        <div className="px-4 pt-3">
          {recent.length > 0 && <><p className="label-sm mb-1.5">Recently inspected by you</p><div className="flex gap-2 overflow-x-auto pb-2 mb-3" style={{ marginRight: -16 }}>{recent.map(p => { const li = lastInsp(p.id); return <button key={p.id} onClick={() => setSel(p.id)} className="flex-shrink-0 rounded-xl px-3 py-2 text-left" style={{ width: 150, background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs font-medium leading-tight line-clamp-2">{p.name}</p><p className="text-[10px] mt-1 flex items-center gap-1" style={{ color: C.muted }}>{li && <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: li.result === "Accepted" ? C.ok : C.bad }} />}{li ? dayLabel(li.completedAt) : ""}</p></button>; })}</div></>}
          <p className="label-sm mb-1.5">Categories</p>
          <div className="grid grid-cols-2 gap-2 mb-4">{topCats.map(c => <button key={c.id} onClick={() => setCat(c.id)} className="rounded-2xl p-3 text-left flex items-center gap-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.accentSoft, color: C.accent }}><Ic i={FolderTree} s={17} mr={0} /></span><span className="min-w-0"><p className="text-sm font-medium truncate">{c.name}</p><p className="text-[10px]" style={{ color: C.muted }}>{countIn(c.id)} products</p></span></button>)}{topCats.length === 0 && <p className="text-xs col-span-2" style={{ color: C.muted }}>No categories.</p>}</div>
          {s.products.filter(p => !p.categoryId).length > 0 && <><p className="label-sm mb-1.5">Uncategorised</p><Grid items={sortP(s.products.filter(p => !p.categoryId && passF(p)))} /></>}
          {fCount > 0 && <><p className="label-sm mt-3 mb-1.5">All matching filters · {products.length}</p><Grid items={products} /></>}
        </div>
      )}
      <Sheet open={fOpen} onClose={() => setFOpen(false)} title="Filters and sorting">
        <div className="flex items-center justify-between mb-2"><span className="label-sm">Type</span><button onClick={() => setF({ bio: "", supplier: "", flagged: false, reference: false, sort: "name" })} className="text-xs" style={{ color: C.accent }}>Clear</button></div>
        <div className="flex gap-1.5 mb-3">{[["", "all"], ["bio", "bio only"], ["std", "standard only"]].map(([k, l]) => <Chip key={k} on={f.bio === k} onClick={() => setF(x => ({ ...x, bio: k }))}>{l}</Chip>)}</div>
        <p className="label-sm mb-2">Supplier</p>
        <select value={f.supplier} onChange={e => setF(x => ({ ...x, supplier: e.target.value }))} className="w-full text-sm mb-3"><option value="">all</option>{(s.suppliers || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        <p className="label-sm mb-2">Only</p>
        <div className="flex flex-wrap gap-1.5 mb-3"><Chip on={f.flagged} onClick={() => setF(x => ({ ...x, flagged: !x.flagged }))}>with open flag</Chip><Chip on={f.reference} onClick={() => setF(x => ({ ...x, reference: !x.reference }))}>with reference inspection</Chip></div>
        <p className="label-sm mb-2">Sort</p>
        <div className="flex flex-wrap gap-1.5 mb-4">{[["name", "alphabetically"], ["recent", "recently inspected"], ["rejected", "recently rejected"]].map(([k, l]) => <Chip key={k} on={f.sort === k} onClick={() => setF(x => ({ ...x, sort: k }))}>{l}</Chip>)}</div>
        <button onClick={() => setFOpen(false)} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: C.ink, color: C.onDark }}>Show ({products.length})</button>
      </Sheet>
    </div>
  );
}

// ── Chat ──
function MChat({ s, set, user, go, initialContext, clearInitialContext }) {
  const [open, setOpen] = useBackSel("chatOpen", null); const [text, setText] = useState(""); const [creating, setCreating] = useState(false); const [pick, setPick] = useState([]); const [gname, setGname] = useState("");
  const mine = s.conversations.filter(c => c.participantIds.includes(user.id) && c.isActive !== false).sort((a, b) => ((b.messages?.slice(-1)[0]?.at) || b.createdAt || "").localeCompare((a.messages?.slice(-1)[0]?.at) || a.createdAt || ""));
  const conv = s.conversations.find(c => c.id === open);
  const markRead = id => set(x => ({ ...x, conversations: x.conversations.map(c => c.id === id ? { ...c, lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) }));
  const [pending, setPending] = useState({ attachments: [], contexts: initialContext ? [initialContext] : [] });
  useEffect(() => { if (initialContext) { setPending(p => ({ ...p, contexts: [...p.contexts.filter(c => !(c.kind === initialContext.kind && c.id === initialContext.id)), initialContext] })); clearInitialContext && clearInitialContext(); } }, [initialContext]);
  const send = () => { if ((!text.trim() && !pending.attachments.length && !pending.contexts.length) || !conv) return; set(x => ({ ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, messages: [...(c.messages || []), { id: uid(), senderId: user.id, text: text.trim(), at: nowISO(), attachments: pending.attachments, contexts: pending.contexts, productId: pending.contexts.find(k => k.kind === "product")?.id || null }], lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) })); setText(""); setPending({ attachments: [], contexts: [] }); };
  const openCtx = c => { if (c.kind === "product") go("catalog", c.id); else if (c.kind === "inspection") go("inspection", c.id); else if (c.kind === "pallet") go("palletInfo", c.id); else if (c.kind === "flag") go(user.role === "Head" ? "head-flags" : "flags"); };
  const create = () => { if (!pick.length) return; const isGroup = pick.length > 1 || !!gname.trim(); if (!isGroup) { const ex = s.conversations.find(c => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(user.id) && c.participantIds.includes(pick[0])); if (ex) { setOpen(ex.id); markRead(ex.id); setCreating(false); setPick([]); return; } } const id = uid(); set(x => ({ ...x, conversations: [...x.conversations, { id, isGroup, name: isGroup ? (gname.trim() || null) : null, participantIds: [user.id, ...pick], createdBy: user.id, createdAt: nowISO(), messages: [], lastRead: { [user.id]: nowISO() }, isActive: true }] })); setOpen(id); setCreating(false); setPick([]); setGname(""); };
  if (conv) return (
    <div className="flex flex-col" style={{ height: "100%" }}>
      <TopBar title={convName(conv, s, user.id)} onBack={() => setOpen(null)} />
      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ background: C.bg }}>{(conv.messages || []).map(m => { const me = m.senderId === user.id; return <div key={m.id} className={`flex mb-1.5 ${me ? "justify-end" : "justify-start"}`}><div className="rounded-2xl px-3 py-2 max-w-[78%]" style={{ background: me ? C.accent : C.surface, color: me ? C.onDark : C.ink }}>{!me && conv.isGroup && <p className="text-[10px] font-medium" style={{ color: C.accent }}>{s.users.find(u => u.id === m.senderId)?.name}</p>}<ContextChips s={s} contexts={m.contexts?.length ? m.contexts : (m.productId ? [{ kind: "product", id: m.productId }] : [])} onOpen={openCtx} dark={me} /><AttachmentList attachments={m.attachments} dark={me} />{m.text && <p className="text-sm" style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>}<p className="text-[10px] mt-0.5" style={{ color: me ? C.onDarkMuted : C.muted }}>{hhmm(m.at)}</p></div></div>; })}</div>
      <div className="p-3" style={{ borderTop: `1px solid ${C.line}` }}><ComposerExtras s={s} user={user} pending={pending} setPending={setPending} compact /><div className="flex gap-2 items-end"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} placeholder="Message… (Enter = new line)" rows={1} className="flex-1 text-sm rounded-2xl px-3 py-2 outline-none resize-none" style={{ ...inp, background: C.bg, maxHeight: 120 }} /><button onClick={send} className="w-9 h-9 rounded-full flex-shrink-0" style={{ background: C.accent, color: C.onDark }}><Ic i={Send} s={16} mr={0} /></button></div></div>
    </div>
  );
  return (
    <div>
      <TopBar title="Chat" right={<button onClick={() => setCreating(o => !o)} className="text-sm" style={{ color: C.accent }}>{creating ? "cancel" : "+ new"}</button>} />
      {creating && <div className="px-4 pt-3"><div className="rounded-xl p-3" style={{ background: C.bg }}>{s.users.filter(u => u.id !== user.id && u.active !== false).map(u => <label key={u.id} className="flex items-center gap-2 text-sm py-1.5"><input type="checkbox" checked={pick.includes(u.id)} onChange={e => setPick(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))} />{u.name}<span className="text-xs" style={{ color: C.muted }}>{u.role === "Head" ? "Head" : "Controller"}</span></label>)}{pick.length > 1 && <input value={gname} onChange={e => setGname(e.target.value)} placeholder="group name" className="w-full text-sm rounded-lg px-2 py-1.5 outline-none my-2" style={{ ...inp }} />}<button onClick={create} disabled={!pick.length} className="w-full py-2.5 rounded-xl text-sm font-medium mt-2" style={{ background: pick.length ? C.ink : C.line, color: pick.length ? C.onDark : C.muted }}>Create</button></div></div>}
      <div className="px-4 pt-2">{mine.length === 0 && !creating && <p className="text-sm py-8 text-center" style={{ color: C.muted }}>No conversations.</p>}{mine.map(c => { const un = unreadIn(c, user.id), last = (c.messages || []).slice(-1)[0]; return <button key={c.id} onClick={() => { setOpen(c.id); markRead(c.id); }} className="w-full text-left flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.line}` }}><div className="w-10 h-10 rounded-full flex items-center justify-center text-sm" style={{ background: C.accentSoft, color: C.accent }}>{c.isGroup ? <Ic i={Users} s={16} mr={0} /> : convName(c, s, user.id).split(" ").map(x => x[0]).join("").slice(0, 2)}</div><div className="flex-1 min-w-0"><p className="text-sm truncate" style={{ fontWeight: un ? 600 : 400 }}>{convName(c, s, user.id)}</p>{last && <p className="text-xs truncate" style={{ color: C.muted }}>{last.text}</p>}</div>{un > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.bad, color: C.onDark }}>{un}</span>}</button>; })}</div>
    </div>
  );
}

// ── Menu / profile / notifications / announcements ──
function MMenu({ s, set, user, go, users, setUser, onLogout, dark, onTheme, simOffline, onSimOffline, onSync, syncMsg }) {
  const items = user.role === "Head" ? [["profile", User, "Profile and statistics"], ["head-escalations", HelpCircle, "Questions from controllers"], ["head-flags", Flag, "Flags to resolve"], ["head-announce", Megaphone, "New announcement"], ["announcements", Megaphone, "Announcements"], ["unreported", ShieldAlert, "Unreported pallets"], ["notifications", Bell, "Notifications"], ["history", ClipboardList, "Inspection history"]] : [["profile", User, "Profile and statistics"], ["announcements", Megaphone, "Announcements"], ["unreported", ShieldAlert, "Unreported pallets"], ["notifications", Bell, "Notifications"], ["flags", Flag, "My flags"], ["history", ClipboardList, "Inspection history"]];
  const [dataOpen, setDataOpen] = useState(false); const [io, setIo] = useState(""); const [msg, setMsg] = useState("");
  const exportState = async () => { const json = JSON.stringify(s, null, 2); setIo(json); try { await navigator.clipboard.writeText(json); setMsg("Copied."); } catch { setMsg("Copy manually from the field."); } };
  const importState = () => { try { const p = JSON.parse(io); if (!p || !Array.isArray(p.categories)) throw 0; set(normalize(p)); setMsg("Loaded — portal data is on the phone."); } catch { setMsg("Not a valid export."); } };
  return (
    <div>
      <TopBar title="Menu" />
      <div className="px-4 pt-2">{items.map(([k, I, l]) => <button key={k} onClick={() => go(k)} className="w-full flex items-center gap-3 py-3.5 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.accent }}><Ic i={I} s={17} mr={0} /></span><span className="text-sm flex-1">{l}</span><span style={{ color: C.muted }}>›</span></button>)}
        <button onClick={onSimOffline} className="w-full flex items-center gap-3 py-3.5 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: simOffline ? C.warn : C.accent }}><Ic i={AlertTriangle} s={17} mr={0} /></span><span className="text-sm flex-1">Simulate no connection<span className="block text-[11px]" style={{ color: C.muted }}>prototype only — shows the offline banner</span></span><span className="w-10 h-6 rounded-full relative" style={{ background: simOffline ? C.warn : C.line }}><span className="absolute top-0.5 w-5 h-5 rounded-full" style={{ background: C.surface, left: simOffline ? 18 : 2, transition: "left .15s" }} /></span></button>
        <button onClick={onTheme} className="w-full flex items-center gap-3 py-3.5 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.accent }}><Ic i={dark ? Sun : Moon} s={17} mr={0} /></span><span className="text-sm flex-1">{dark ? "Light theme" : "Dark theme"}</span><span className="w-10 h-6 rounded-full relative" style={{ background: dark ? C.accent : C.line }}><span className="absolute top-0.5 w-5 h-5 rounded-full" style={{ background: C.surface, left: dark ? 18 : 2, transition: "left .15s" }} /></span></button>
        <p className="label-sm mt-5 mb-2" style={{ color: C.muted }}>Signed in</p>
        <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}><Avatar user={user} size={32} /><span className="text-sm flex-1">{user.name}<span className="block text-[11px]" style={{ color: C.muted }}>{user.role}</span></span><button onClick={onLogout} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Log out</button></div>
        <p className="label-sm mt-5 mb-2" style={{ color: C.muted }}>Date</p>
        <button onClick={onSync} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.accent }}><Ic i={Download} s={17} mr={0} /></span><span className="text-sm flex-1">Sync now<span className="block text-[11px]" style={{ color: C.muted }}>{syncMsg || "pull the latest state from the server"}</span></span></button>
        <button onClick={() => setDataOpen(o => !o)} className="w-full flex items-center gap-3 py-3 text-left" style={{ borderBottom: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.accent }}><Ic i={Database} s={17} mr={0} /></span><span className="text-sm flex-1">Export / import state</span><span style={{ color: C.muted }}>{dataOpen ? "▾" : "›"}</span></button>
        {dataOpen && (
          <div className="rounded-xl p-3 mt-2" style={{ background: C.bg }}>
            <p className="text-xs mb-2" style={{ color: C.muted }}>If the phone started empty: in the portal 💾 Data → Export, paste here and Import. Same format both ways.</p>
            <div className="flex gap-2 mb-2 flex-wrap"><button onClick={exportState} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: C.accent, color: C.onDark }}>Export</button><button onClick={importState} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>Import from field</button><button onClick={() => { set(olaState()); setMsg("Sample loaded."); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>Sample data</button></div>
            {msg && <p className="text-xs mb-2" style={{ color: C.accent }}>{msg}</p>}
            <textarea value={io} onChange={e => setIo(e.target.value)} rows={5} placeholder="paste JSON from the portal" className="w-full text-[11px] rounded-lg px-2 py-1.5 outline-none font-mono" style={{ ...inp }} />
          </div>
        )}
        <p className="text-xs mt-4 mb-2" style={{ color: C.muted }}>The portal and the phone share the same state format — after importing, an inspection done here can be exported back to the portal.</p>
      </div>
    </div>
  );
}
function MProfile({ s, set, user, go }) {
  const allMine = s.inspections.filter(i => i.controllerId === user.id && i.status === "Completed");
  const mine = allMine.filter(i => countsAs(s, i)); const skips = allMine.filter(i => !countsAs(s, i)).length;
  const acc = mine.filter(i => i.result === "Accepted").length;
  const avg = avgActiveMinutes(mine);
  const week = mine.filter(i => (new Date() - new Date(i.completedAt)) < 7 * 86400000).length;
  const todayN = mine.filter(i => (i.completedAt || "").slice(0, 10) === new Date().toISOString().slice(0, 10)).length;
  const Tile = ({ l, v, sub }) => <div className="rounded-2xl p-3.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-2xl font-semibold">{v}</p>{sub && <p className="text-[10px]" style={{ color: C.muted }}>{sub}</p>}</div>;
  return (
    <div>
      <TopBar title="Profile" onBack={() => go("home")} />
      <div className="px-4 pt-4"><div className="flex items-center gap-3 mb-4"><Avatar user={user} size={56} onPick={url => set(x => ({ ...x, users: x.users.map(q => q.id === user.id ? { ...q, photoUrl: url } : q) }))} /><div><p className="font-semibold">{user.name}</p><p className="text-xs" style={{ color: C.muted }}>{user.email} · {user.role === "Head" ? "Head of Quality" : "Controller"}</p></div></div>
        <div className="grid grid-cols-2 gap-2"><Tile l="Today" v={todayN} /><Tile l="This week" v={week} /><Tile l="Total" v={mine.length} /><Tile l="Accepted" v={mine.length ? `${Math.round(acc / mine.length * 100)}%` : "—"} sub={`${acc} of ${mine.length}`} /><Tile l="Avg. active time" v={avg !== null ? `${fmt(avg)} min` : "—"} sub="excl. waiting for the Head" /><Tile l="Traces" v={skips} sub="types that don't count" /></div>
      <p className="label-sm mt-4 mb-1.5">By type</p><div className="grid grid-cols-2 gap-2">{typesOf(s).map(t => { const m = allMine.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id); return <div key={t.id} className="rounded-2xl p-3.5" style={{ background: C.bg, border: `1px solid ${C.line}`, borderTop: `3px solid ${t.color}` }}><p className="text-xs" style={{ color: C.muted }}>{t.name}</p><p className="text-[22px] leading-tight font-semibold">{m.length}</p>{!t.autoAccept && m.length > 0 && <p className="text-[10px]" style={{ color: C.muted }}>{Math.round(m.filter(i => i.result === "Rejected").length / m.length * 100)}% rejected</p>}</div>; })}</div>
      </div>
    </div>
  );
}
function MNotifications({ s, set, user, go }) {
  const mine = s.notifications.filter(n => n.userId === user.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const read = id => set(x => ({ ...x, notifications: x.notifications.map(n => n.id === id ? { ...n, readAt: n.readAt || nowISO() } : n) }));
  return <div><TopBar title="Notifications" onBack={() => go("home")} /><div className="px-4">{mine.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>Quiet.</p> : mine.map(n => <button key={n.id} onClick={() => { read(n.id); if (n.entityType === "Inspection" && n.entityId) go("inspection", n.entityId); else if (n.entityType === "ProductFlag") go(user.role === "Head" ? "head-flags" : "flags"); else if (n.entityType === "Conversation") go("chat"); else if (n.entityType === "Announcement") go("announcements"); else if (n.entityType === "Product" && n.entityId) go("catalog", n.entityId); }} className="w-full text-left flex items-center gap-3 py-3" style={{ borderBottom: `1px solid ${C.line}` }}><NotifIcon type={n.type} size={36} /><span className="flex-1 min-w-0"><span className="block text-sm" style={{ fontWeight: n.readAt ? 400 : 600 }}>{cleanMsg(n.message)}</span><span className="block text-xs" style={{ color: C.muted }}>{dayLabel(n.createdAt)}, {hhmm(n.createdAt)}</span></span>{!n.readAt && <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: C.accent }} />}</button>)}</div></div>;
}
function MAnnouncements({ s, set, user, go }) {
  const list = s.announcements.filter(a => a.showOnDashboard || a.isBlocking || a.productId || a.categoryId).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return null; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  // Same "×" as the web portal — Head can publish from the phone, so Head needs to be able to take one back from here too.
  const remove = id => set(x => ({ ...x, announcements: x.announcements.filter(a => a.id !== id) }));
  return <div><TopBar title="Announcements" onBack={() => go("home")} /><div className="px-4">{list.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>No announcements.</p> : list.map(a => <div key={a.id} className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex items-center gap-2 mb-1">{a.isBlocking && <span className="text-[10px] px-1.5 rounded" style={{ background: C.badBg, color: C.bad }}>blocking</span>}{a.productId && <span className="text-[10px] px-1.5 rounded" style={{ background: C.warnBg, color: C.warn }}>{s.products.find(p => p.id === a.productId)?.name}</span>}{a.categoryId && <span className="text-[10px] px-1.5 rounded" style={{ background: C.okBg, color: C.ok }}>{catPath(a.categoryId)}</span>}<p className="text-sm font-medium flex-1">{a.title}</p>{user.role === "Head" && <button onClick={() => remove(a.id)} className="text-sm px-1" style={{ color: C.muted }}>×</button>}</div><p className="text-sm">{a.body}</p><p className="text-xs" style={{ color: C.muted }}>{dayLabel(a.createdAt)}{(a.acks || {})[user.id] && " · acknowledged ✓"}</p></div>)}</div></div>;
}
// Unreported pallets: the audit trail for "who moved this without QC ever seeing it" — detected server-side on
// every dock push (server/misslogic.mjs), so this list updates itself even with nobody's app open. Both roles see
// it; only the Head can mark an incident reviewed (a permanent note, not a dismissal — the point is a record).
function MUnreported({ s, set, user, go }) {
  const [view, setView] = useState("open");
  const [notes, setNotes] = useState({}); const [noteFor, setNoteFor] = useState(null);
  const isHead = user.role === "Head";
  const stats = unreportedStats(s);
  const shown = view === "open" ? unreportedList(s).filter(x => !x.reviewedAt) : unreportedList(s);
  const groups = []; shown.forEach(x => { const k = dayLabel(x.detectedAt); let g = groups.find(g => g.k === k); if (!g) { g = { k, items: [] }; groups.push(g); } g.items.push(x); });
  const review = id => { reviewUnreported(set, id, user, notes[id] || ""); setNotes(n => { const { [id]: _, ...rest } = n; return rest; }); setNoteFor(null); };
  return (
    <div>
      <TopBar title="Unreported pallets" onBack={() => go("home")} />
      <div className="px-4 pt-3">
        <p className="text-sm mb-3" style={{ color: C.muted }}>Pallets that dropped off the dock sheet before QC ever inspected them — picked or moved on. Logged automatically once a pallet has stayed missing for a full push cycle, so a brief sheet hiccup doesn't count.</p>
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[["Today", stats.today], ["Week", stats.week], ["Open", stats.open], ["Total", stats.total]].map(([l, v]) => <div key={l} className="rounded-2xl p-2.5 text-center" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-lg font-semibold leading-tight">{v}</p><p className="text-[10px]" style={{ color: C.muted }}>{l}</p></div>)}
        </div>
        <div className="flex gap-1.5 mb-3">{[["open", "Open"], ["all", "All"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: view === k ? C.ink : "transparent", color: view === k ? C.onDark : C.ink, border: `1px solid ${view === k ? C.ink : C.line}` }}>{l}</button>)}</div>
        {!shown.length ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>{view === "open" ? "Nothing open — every disappearance so far has been reviewed." : "Nothing logged yet."}</p> : groups.map(g => (
          <div key={g.k} className="mb-4">
            <p className="label-sm mb-1.5" style={{ color: C.muted }}>{g.k} · {g.items.length} pallet{g.items.length === 1 ? "" : "s"}</p>
            {g.items.map(x => { const product = s.products.find(p => p.articleId === x.article); const reviewer = s.users.find(u => u.id === x.reviewedByUserId); return (
              <div key={x.id} className="py-2.5" style={{ borderTop: `1px solid ${C.line}`, opacity: x.reviewedAt ? .6 : 1 }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {product ? <button onClick={() => go("catalog", product.id)} className="text-sm font-medium underline text-left" style={{ color: C.accent }}>{x.name || product.name}</button> : <p className="text-sm font-medium">{x.name || x.article || "—"}</p>}
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{x.article || "—"}{x.location ? ` · ${x.location}` : ""}{x.priority ? ` · ${x.priority}` : ""}{x.hu ? ` · HU …${String(x.hu).slice(-8)}` : ""}</p>
                    <p className="text-xs" style={{ color: C.muted }}>last seen {fmtTime(x.lastSeenAt)} · gone since {fmtTime(x.detectedAt)}{x.po ? ` · PO ${x.po}` : ""}{x.transporter ? ` · ${x.transporter}` : ""}</p>
                  </div>
                  {x.reviewedAt ? <span className="text-xs flex-shrink-0" style={{ color: C.ok }}>✓ reviewed</span> : !isHead ? <span className="text-xs flex-shrink-0" style={{ color: C.warn }}>open</span> : null}
                </div>
                {x.reviewedAt && (x.reviewNote || reviewer) && <p className="text-xs mt-1" style={{ color: C.muted }}>{reviewer ? `by ${reviewer.name.split(" ")[0]}` : ""}{x.reviewNote ? ` — “${x.reviewNote}”` : ""}{isHead && <button onClick={() => unreviewUnreported(set, x.id)} className="ml-2 underline">undo</button>}</p>}
                {isHead && !x.reviewedAt && (noteFor === x.id ? (
                  <div className="flex gap-1.5 mt-1.5"><input autoFocus value={notes[x.id] || ""} onChange={e => setNotes(n => ({ ...n, [x.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && review(x.id)} placeholder="note (optional)" className="flex-1 text-xs" style={{ padding: "4px 8px" }} /><button onClick={() => review(x.id)} className="text-xs px-2.5 py-1 rounded-lg" style={{ background: C.ink, color: C.onDark }}>Mark reviewed</button></div>
                ) : <button onClick={() => setNoteFor(x.id)} className="text-xs mt-1.5 px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Mark reviewed</button>)}
              </div>
            ); })}
          </div>
        ))}
      </div>
    </div>
  );
}
function MFlags({ s, user, go }) {
  const mine = s.flags.filter(f => f.raisedBy === user.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return <div><TopBar title="My flags" onBack={() => go("home")} /><div className="px-4">{mine.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>You haven't raised any flags yet.</p> : mine.map(f => <div key={f.id} className="py-3" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex items-center gap-2 mb-1"><span className="text-[10px] px-1.5 rounded" style={{ background: f.status === "Open" ? C.warnBg : C.okBg, color: f.status === "Open" ? C.warn : C.ok }}>{f.status === "Open" ? "open" : "resolved"}</span><p className="text-sm font-medium">{s.products.find(p => p.id === f.productId)?.name}</p></div><p className="text-sm">„{f.description}"</p>{f.resolution && <p className="text-xs mt-1" style={{ color: C.ok }}>✓ {f.resolution}</p>}</div>)}</div></div>;
}

// ── Head on the phone: communication first (escalations, flags, announcements); inspections like any controller ──
function MHeadEscalations({ s, set, user, go, notify }) {
  const list = s.inspections.filter(i => i.status === "PendingReview").sort((a, b) => (a.escalatedAt || a.startedAt || "").localeCompare(b.escalatedAt || b.startedAt || ""));
  const [answers, setAnswers] = useState({});
  const answer = i => { const txt = (answers[i.id] || "").trim(); if (!txt) return;
    set(x => ({ ...x, inspections: x.inspections.map(q => q.id === i.id ? { ...q, status: "Draft", headAnswer: txt, answeredAt: nowISO(), audit: [...(q.audit || []), { at: nowISO(), userId: user.id, action: "Head's answer", details: txt }] } : q) }));
    notify && notify("Answered", `The Head answered re ${s.products.find(p => p.id === i.productId)?.name}: “${txt}”`, "Inspection", i.id, i.controllerId); setAnswers(a => ({ ...a, [i.id]: "" })); };
  return <div><TopBar title="Questions from controllers" onBack={() => go("home")} /><div className="px-4 pt-2">
    {list.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>Nothing is waiting for you.</p> : list.map(i => { const p = s.products.find(x => x.id === i.productId); const u = s.users.find(x => x.id === i.controllerId); return (
      <div key={i.id} className="rounded-2xl p-3.5 mb-3" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.warn}` }}>
        <p className="text-sm font-semibold">{p?.name}</p><p className="text-xs mb-2" style={{ color: C.muted }}>{u?.name} · {dayLabel(i.escalatedAt || i.startedAt)} {hhmm(i.escalatedAt || i.startedAt)} · inspection paused</p>
        <p className="text-sm mb-2">“{i.question}”</p>
        <div className="flex gap-2"><input value={answers[i.id] || ""} onChange={e => setAnswers(a => ({ ...a, [i.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && answer(i)} placeholder="your answer…" className="flex-1 text-sm" /><button onClick={() => answer(i)} className="px-3 rounded-xl text-sm" style={{ background: C.ink, color: C.onDark }}><Ic i={Send} s={14} mr={0} /></button></div>
        <button onClick={() => go("inspection", i.id)} className="text-xs mt-2" style={{ color: C.accent }}>open the inspection ›</button>
      </div>); })}
  </div></div>;
}
function MHeadFlags({ s, set, user, go, notify }) {
  const open = s.flags.filter(f => f.status === "Open").sort((a, b) => (a.createdAt || "").localeCompare(b.createdAt || ""));
  const [res, setRes] = useState({});
  const resolve = f => { const txt = (res[f.id] || "").trim(); if (!txt) return; set(x => ({ ...x, flags: x.flags.map(q => q.id === f.id ? { ...q, status: "Resolved", resolution: txt, resolvedBy: user.id, resolvedAt: nowISO() } : q) })); notify && notify("Flag", `Flag resolved: ${txt}`, "ProductFlag", f.id, f.raisedBy); };
  return <div><TopBar title="Flags to resolve" onBack={() => go("home")} /><div className="px-4 pt-2">
    {open.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>No open flags.</p> : open.map(f => { const p = s.products.find(x => x.id === f.productId); const u = s.users.find(x => x.id === f.raisedBy); return (
      <div key={f.id} className="rounded-2xl p-3.5 mb-3" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.warn}` }}>
        <p className="text-sm font-semibold">{p?.name || "product"}</p><p className="text-xs mb-2" style={{ color: C.muted }}>{u?.name} · {dayLabel(f.createdAt)} {hhmm(f.createdAt)}</p>
        <p className="text-sm mb-2">{f.description}</p>
        <div className="flex gap-2"><input value={res[f.id] || ""} onChange={e => setRes(r => ({ ...r, [f.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && resolve(f)} placeholder="what was done?" className="flex-1 text-sm" /><button onClick={() => resolve(f)} className="px-3 rounded-xl text-sm" style={{ background: C.ink, color: C.onDark }}><Ic i={Check} s={14} mr={0} /></button></div>
        {p && <button onClick={() => go("catalog", p.id)} className="text-xs mt-2" style={{ color: C.accent }}>open the product ›</button>}
      </div>); })}
  </div></div>;
}
function MHeadAnnounce({ s, set, user, go, notify }) {
  const [d, setD] = useState({ title: "", body: "", isBlocking: false, showOnDashboard: true, productId: "", categoryId: "", validTo: "" });
  const publish = () => { if (!d.title.trim()) return; const id = uid(); set(x => ({ ...x, announcements: [...x.announcements, { id, title: d.title.trim(), body: d.body.trim(), productId: d.productId || null, categoryId: d.categoryId || null, validTo: d.validTo || null, createdBy: user.id, createdAt: nowISO(), acks: {}, isBlocking: d.isBlocking, showOnDashboard: d.showOnDashboard }] })); if (d.isBlocking && notify) s.users.filter(u => u.role === "Controller" && u.active !== false).forEach(u => notify("Announcement", `New blocking announcement: ${d.title.trim()}`, "Announcement", id, u.id)); go("home"); };
  const Chip = ({ on, onClick, children }) => <button onClick={onClick} className="text-xs px-3 py-1.5 rounded-full" style={{ background: on ? C.ink : "transparent", color: on ? C.onDark : C.ink, border: `1px solid ${on ? C.ink : C.line}` }}>{children}</button>;
  return <div><TopBar title="New announcement" onBack={() => go("home")} /><div className="px-4 pt-3">
    <input value={d.title} onChange={e => setD(x => ({ ...x, title: e.target.value }))} placeholder="title" className="w-full text-sm mb-2" />
    <textarea value={d.body} onChange={e => setD(x => ({ ...x, body: e.target.value }))} placeholder="body" rows={4} className="w-full text-sm mb-3" />
    <p className="label-sm mb-1.5">Channels</p>
    <div className="flex flex-wrap gap-1.5 mb-3"><Chip on={d.showOnDashboard} onClick={() => setD(x => ({ ...x, showOnDashboard: !x.showOnDashboard }))}>Dashboard</Chip><Chip on={d.isBlocking} onClick={() => setD(x => ({ ...x, isBlocking: !x.isBlocking }))}>Blocking — must acknowledge</Chip></div>
    <div className="flex items-center justify-between mb-1.5"><p className="label-sm">Product (optional)</p>{d.productId && <button onClick={() => setD(x => ({ ...x, productId: "" }))} className="text-xs" style={{ color: C.muted }}>clear</button>}</div>
    <div className="mb-3"><MProductPicker products={s.products.filter(p => p.isActive !== false)} value={d.productId} onChange={id => setD(x => ({ ...x, productId: id, categoryId: id ? "" : x.categoryId }))} /></div>
    <div className="flex items-center justify-between mb-1.5"><p className="label-sm">Category (optional)</p>{d.categoryId && <button onClick={() => setD(x => ({ ...x, categoryId: "" }))} className="text-xs" style={{ color: C.muted }}>clear</button>}</div>
    <div className="mb-3"><MCategoryPicker categories={s.categories} value={d.categoryId} onChange={id => setD(x => ({ ...x, categoryId: id, productId: id ? "" : x.productId }))} /></div>
    <p className="label-sm mb-1.5">Dashboard until (optional)</p>
    <input type="date" value={d.validTo} onChange={e => setD(x => ({ ...x, validTo: e.target.value }))} className="w-full text-sm mb-4" />
    <button onClick={publish} disabled={!d.title.trim()} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: d.title.trim() ? C.ink : C.line, color: d.title.trim() ? C.onDark : C.muted }}>Publish</button>
  </div></div>;
}

// ── Inspekcja (runner) i raport w ramce ──
function MInspection({ s, set, user, inspId, go, notify }) {
  const insp = s.inspections.find(i => i.id === inspId);
  const [editing, setEditing] = useState(false);
  if (!insp) return <div><TopBar title="Inspection" onBack={() => go("home")} /><p className="text-sm p-4">No znaleziono.</p></div>;
  if (!insp.template) return <VisualView insp={insp} s={s} go={go} />;
  const product = s.products.find(p => p.id === insp.productId);
  const patchInsp = fn => set(x => ({ ...x, inspections: x.inspections.map(i => i.id === insp.id ? (typeof fn === "function" ? fn(i) : { ...i, ...fn }) : i) }));
  const log = (action, details) => patchInsp(i => ({ ...i, audit: [...(i.audit || []), { at: nowISO(), userId: user.id, action, details }] }));
  const finish = ({ anyExceeded, generalFlag, autoAccept }) => {
    { const p = s.products.find(x => x.id === insp.productId); const hus = (insp.pallets || []).map(h => String(h).replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean); set(x => { const pc = { ...(x.palletClaims || {}) }; Object.keys(pc).forEach(k => { const mine = pc[k].userId === user.id; if (!mine) return; if (p?.articleId && k.startsWith(p.articleId + "|")) delete pc[k]; if (k.startsWith("hu:") && hus.some(h => k.slice(3).replace(/^0+/, "") === h)) delete pc[k]; }); return { ...x, palletClaims: pc }; }); } const was = insp.status === "Completed"; patchInsp(i => ({ ...i, status: "Completed", completedAt: i.completedAt || nowISO(), lastEditedBy: was ? user.id : i.lastEditedBy, lastEditedAt: was ? nowISO() : i.lastEditedAt })); log(was ? "Edited completed report" : "Completed", `result: ${insp.result}`); if (was && insp.controllerId !== user.id) notify("EditedByOther", `${user.name} edited report ${product.name}`, "Inspection", insp.id, insp.controllerId); if (insp.result === "Accepted" && (anyExceeded || generalFlag)) notify("AcceptedDespite", `${product.name}: accepted despite exceeding tolerance (${user.name})`, "Inspection", insp.id); else if (anyExceeded || generalFlag) notify("Exceeded", `${product.name}: tolerance exceeded — ${insp.result}`, "Inspection", insp.id); setEditing(false); go("home"); };
  const escalate = q => { patchInsp({ status: "PendingReview", question: q, answer: null }); log("Escalation", q); notify("Escalation", `${user.name} asks about ${product.name}: „${q}"`, "Inspection", insp.id); };
  const raiseFlag = text => { set(x => ({ ...x, flags: [...x.flags, { id: uid(), productId: product.id, inspectionId: insp.id, raisedBy: user.id, description: text, status: "Open", createdAt: nowISO() }] })); notify("Flag", `${user.name}: ${product.name} — ${text}`, "ProductFlag", null); };
  const cancel = () => { patchInsp({ status: "Cancelled" }); log("Cancelled"); go("home"); };
  const runner = insp.status === "Draft" || insp.status === "PendingReview" || editing;
  const problems = problemsFor(s, { kind: "Product", id: product.id }, new Set(insp.template.suppressed || []));
  return (
    <div className="pb-4">
      <TopBar title={runner ? "Inspection" : "Report"} onBack={() => { setEditing(false); go("home"); }} />
      <div className="px-3 pt-2">
        {runner ? <InspectionRunner key={insp.id} insp={insp} patch={patchInsp} t={insp.template} problems={problems} product={product} suppliers={s.suppliers || []} dictionaries={s.dictionaries || []} sctx={s} user={user} onFinish={finish} onEscalate={escalate} onRaiseFlag={raiseFlag} onCancel={cancel} />
          : <ReportView insp={insp} s={s} user={user} onEdit={() => setEditing(true)} onAnswer={() => {}} />}
      </div>
    </div>
  );
}

// ═══════════════════ APLIKACJA MOBILNA ═══════════════════
export default function App() {
  const [s, setRaw] = useState(EMPTY);
  const set = fn => { const f = typeof fn === "function" ? (x => sortState(fn(x))) : (() => sortState(fn)); syncerRef.current.pending.push(f); setRaw(x => { const nx = f(x); _S = nx; return nx; }); if (typeof online !== "undefined" && !online) setPendingSync(n => n + 1); };
  useEffect(() => { _S = s; }, [s]);
  const [loaded, setLoaded] = useState(false);
  const [userId, setUserId] = useState(() => readSession());
  const syncerRef = useRef(createSyncer());
  const [pendingChatContext, setPendingChatContext] = useState(null);
  const bootIdRef = useRef(null); const [newVersion, setNewVersion] = useState(false);
  const [page, setPage] = useState("home"); const [param, setParam] = useState(null);
  // Browser/back-forward + swipe-back support: every screen change pushes a history entry, and going back through
  // them (hardware back, browser back, an edge-swipe — they all fire the same popstate event) restores the matching
  // screen instead of leaving the app. skipPushRef swallows the one page-state update right after a pop (it's
  // already reflecting history — pushing it again would double it up) and the very first render (nothing to push yet).
  const skipPushRef = useRef(true);
  useEffect(() => {
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    try { history.pushState({ __qcNav: true, page, param }, ""); } catch {}
  }, [page, param]);
  useEffect(() => {
    try { history.replaceState({ __qcNav: true, page, param }, ""); } catch {}
    const onPop = e => { skipPushRef.current = true; const st = e.state; setPage(st && st.__qcNav ? st.page : "home"); setParam(st && st.__qcNav ? (st.param ?? null) : null); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [dismissed, setDismissed] = useState([]);
  const [toast, setToast] = useState("");
  const [netOnline, setNetOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine !== false); const [simOffline, setSimOffline] = useState(false); const [pendingSync, setPendingSync] = useState(0);
  useEffect(() => { const on = () => setNetOnline(true), off = () => setNetOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  const online = netOnline && !simOffline;
  useEffect(() => { if (online) setPendingSync(0); }, [online]);
  const [pendingStart, setPendingStart] = useState(null);
  useEffect(() => { if (toast) { const id = setTimeout(() => setToast(""), 3500); return () => clearTimeout(id); } }, [toast]);
  const [dark, setDark] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const pullState = async (announce) => { try { if (!window.storage) return; const r = await window.storage.get(STORAGE_KEY); if (r?.version) syncerRef.current.version = r.version; if (r?.value && !syncerRef.current.pending.length) { const p = JSON.parse(r.value); if (p && Array.isArray(p.categories)) { setRaw(prev => { const next = sortState(normalize(p)); _S = next; return JSON.stringify(prev) === JSON.stringify(next) ? prev : next; }); } } await refreshPushedIntegrations(() => _S, set, !!announce); if (announce) setSyncMsg(`Synced ${new Date().toLocaleTimeString("en-GB")}`); } catch (e) { if (announce) setSyncMsg("Sync failed: " + (e.message || e)); } };
  useEffect(() => { if (!loaded) return; refreshPushedIntegrations(() => _S, set); const id = setInterval(() => refreshPushedIntegrations(() => _S, set), 120000); return () => clearInterval(id); }, [loaded]);
  // Fast, cheap poll while the app is open and in the foreground: check the version every ~5s, pull only when it changed and nothing local is unsaved.
  // iOS home-screen PWAs sometimes misreport document.visibilityState even while genuinely on screen, so this check
  // doesn't gate on visibility — the cost of an occasional background fetch is negligible for a prototype.
  useEffect(() => { if (!loaded) return; const id = setInterval(async () => {
    if (window.storage?.getBootId) { const b = await window.storage.getBootId(); if (b) { if (bootIdRef.current === null) bootIdRef.current = b; else if (b !== bootIdRef.current) setNewVersion(true); } }
    if (syncerRef.current.busy) return;
    // A save that failed to reach the server (dropped connection) leaves its edit sitting in `pending` rather than
    // losing it — retry it here so a brief blip self-heals within one poll tick instead of staying stuck until the
    // next change. Retrying always takes priority over pulling: never overwrite unsynced local edits with the
    // server's (still older) copy.
    if (syncerRef.current.pending.length) { flushState(syncerRef.current, STORAGE_KEY, () => _S, v => { _S = v; setRaw(v); }, p => sortState(normalize(p)), n => n && setToast(`Merged with changes from another device (${n} of yours re-applied)`)); return; }
    if (!window.storage?.getMeta) return; const v = await window.storage.getMeta(STORAGE_KEY); if (v && v !== syncerRef.current.version) pullState(false);
  }, 5000); return () => clearInterval(id); }, [loaded]);
  useEffect(() => { const h = () => { if (document.visibilityState === "visible") pullState(false); }; document.addEventListener("visibilitychange", h); window.addEventListener("focus", h); window.addEventListener("pageshow", h); return () => { document.removeEventListener("visibilitychange", h); window.removeEventListener("focus", h); window.removeEventListener("pageshow", h); }; }, []);
  useEffect(() => { (async () => { try { if (window.storage) { const r = await window.storage.get(THEME_KEY); if (r?.value === "dark") { applyTheme(true); setDark(true); } } } catch (e) {} })(); }, []);
  const toggleTheme = () => { const d = !dark; applyTheme(d); setDark(d); (async () => { try { if (window.storage) await window.storage.set(THEME_KEY, d ? "dark" : "light"); } catch (e) {} })(); };
  useEffect(() => { (async () => { try { if (window.storage) { const r = await window.storage.get(STORAGE_KEY); if (r?.version) syncerRef.current.version = r.version; if (r?.value) { const p = JSON.parse(r.value); if (p && Array.isArray(p.categories)) { const nx = sortState(normalize(p)); _S = nx; setRaw(nx); } } } } catch (e) {} setLoaded(true); })(); }, []);
  useEffect(() => { if (!loaded || !syncerRef.current.pending.length) return; flushState(syncerRef.current, STORAGE_KEY, () => _S, v => { _S = v; setRaw(v); }, p => sortState(normalize(p)), n => n && setToast(`Merged with changes from another device (${n} of yours re-applied)`)); }, [s, loaded]);
  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: C.muted }}>Loading…</div>;
  const user = s.users.find(u => u.id === userId && u.active !== false) || null;
  if (!user) return <LoginScreen s={s} onLogin={setUserId} />;
  const go = (p, prm = null) => { setPage(p); setParam(prm); };
  const notify = (type, message, entityType, entityId, toUserId) => set(x => { const targets = toUserId ? [toUserId] : x.users.filter(u => u.role === "Head").map(u => u.id); return { ...x, notifications: [...x.notifications, ...targets.map(t => ({ id: uid(), userId: t, type, message, entityType, entityId, createdAt: nowISO(), readAt: null }))] }; });
  const startInspection = (pid, palletNo, force = false, typeId = "type-full") => {
    const p = s.products.find(x => x.id === pid); const t = resolveTemplate(s, p, typeId); if (!p || !t) { setToast(`No form for “${typeById(s, typeId)?.name || "this type"}” — the Head must build it in Forms.`); return; }
    const collision = s.inspections.find(i => i.productId === p.id && ["Draft", "PendingReview"].includes(i.status) && i.controllerId !== user.id);
    if (collision && !force) { setPendingStart({ pid, palletNo, typeId, collision }); return; }
    if (!online) setToast("Offline: the claim on this product will reach the server when you reconnect.");
    const id = uid(); const snapshot = { id: t.id, modules: t.modules, fields: t.fields, problemRefs: t.problemRefs, overrides: t.overrides, suppressed: [...t.suppressed] };
    set(x => ({ ...x, inspections: [...x.inspections, { id, typeId, productId: p.id, controllerId: user.id, status: "Draft", result: null, startedAt: nowISO(), template: snapshot, values: {}, remarks: [], photos: {}, pallets: palletNo ? [palletNo] : [""], sample: { tu: 1, cusPerTu: p.cusPerTu || "", piecesPerCu: p.piecesPerCu || "", weightPerCu: p.weightPerCu || "" }, audit: [{ at: nowISO(), userId: user.id, action: "Created" }] }] }));
    go("inspection", id);
  };
  const visualInspection = ({ productId, pallet, dateISO, note }) => {
    const id = uid();
    set(x => ({ ...x, inspections: [...x.inspections, { id, type: "Visual", productId, controllerId: user.id, status: "Completed", result: "Accepted", startedAt: nowISO(), completedAt: nowISO(), dateISO: dateISO || null, template: null, values: {}, remarks: [], photos: {}, pallets: [pallet], sample: {}, comment: note || "", audit: [{ at: nowISO(), userId: user.id, action: "Visual inspection", details: `HU ${pallet}` }] }] }));
    go("inspection", id);
  };
  const skipInspection = ({ productId, pallet, reason }) => {
    const id = uid();
    set(x => ({ ...x, inspections: [...x.inspections, { id, type: "Skip", productId, controllerId: user.id, status: "Completed", result: "Accepted", startedAt: nowISO(), completedAt: nowISO(), skipReason: reason || null, template: null, values: {}, remarks: [], photos: {}, pallets: [pallet], sample: {}, comment: "", audit: [{ at: nowISO(), userId: user.id, action: "Skip", details: `HU ${pallet}${reason ? " · " + reason : ""}` }] }] }));
    go("inspection", id);
  };
  const navPage = ["home", "chat", "catalog", "menu"].includes(page) ? page : null;
  const unreadMsgs = s.conversations.filter(c => c.participantIds.includes(user.id)).reduce((a, c) => a + unreadIn(c, user.id), 0);
  const withNav = !["inspection", "scan", "search"].includes(page);
  return (
    <Phone overlay={<MBlocking s={s} set={set} user={user} />} nav={withNav} page={navPage} onNav={k => go(k)} badges={{ chat: unreadMsgs }} fab={page === "home" ? { scan: () => go("scan"), add: () => go("search") } : null} dark={dark} onTheme={toggleTheme}>
      {toast && <div className="absolute left-4 right-4 rounded-xl px-3.5 py-2.5 text-sm" style={{ top: 44, zIndex: 60, background: C.ink, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>{toast}</div>}
      {!online && <div className="absolute left-0 right-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold" style={{ top: 28, zIndex: 55, background: C.warn, color: "#fff" }}><Ic i={AlertTriangle} s={14} mr={0} /><span className="flex-1">No connection — working offline. {pendingSync ? `${pendingSync} change${pendingSync === 1 ? "" : "s"} waiting to sync.` : "Changes will sync when you're back online."} Others can't see what you're working on.</span></div>}
      {newVersion && <div className="absolute left-0 right-0 flex items-center gap-2 px-4 py-2 text-xs font-semibold" style={{ top: !online ? 54 : 28, zIndex: 56, background: C.accent, color: C.onDark }}><span className="flex-1">A new version is live</span><button onClick={() => location.reload()} className="px-2.5 py-1 rounded-lg" style={{ background: C.onDark, color: C.accent }}>Refresh</button></div>}
      <Modal open={!!pendingStart}>
        <p className="font-semibold mb-1">Someone is already on this product</p>
        <p className="text-sm mb-4" style={{ color: C.muted }}>{pendingStart && s.users.find(u => u.id === pendingStart.collision.controllerId)?.name} has an open inspection ({pendingStart && STATUS[pendingStart.collision.status][0]}). Continue anyway?</p>
        <button onClick={() => { const p = pendingStart; setPendingStart(null); startInspection(p.pid, p.palletNo, true, p.typeId); }} className="w-full py-3 rounded-xl text-sm font-medium mb-2" style={{ background: C.ink, color: C.onDark }}>Yes, start anyway</button>
        <button onClick={() => setPendingStart(null)} className="w-full py-2.5 text-sm" style={{ color: C.muted }}>No, go back</button>
      </Modal>
      {page === "home" && <MDashboard s={s} set={set} user={user} go={go} dismissed={dismissed} setDismissed={setDismissed} onAssign={al => { setPendingChatContext({ kind: "pallet", id: al.hu, label: `${al.name} · ${al.location}` }); go("chat"); }} />}
      {page === "search" && <MSearch s={s} user={user} go={go} onStart={(pid, palletNo, typeId) => startInspection(pid, palletNo, false, typeId)} setState={set} notify={notify} onVisual={visualInspection} />}
      {page === "scan" && <MScan key={param || "scan"} s={s} user={user} go={go} onStart={(pid, palletNo, typeId) => startInspection(pid, palletNo, false, typeId)} onVisual={visualInspection} onSkip={skipInspection} setState={set} notify={notify} preset={param} />}
      {page === "history" && <MHistory s={s} user={user} go={go} />}
      {page === "priority" && <MPriorityList s={s} user={user} go={go} priority={param} />}
      {page === "blockedInfo" && <MBlockedInfo s={s} set={set} user={user} go={go} itemKey={param} />}
      {page === "palletInfo" && <MPalletInfo s={s} set={set} user={user} go={go} hu={param} onAssign={r => { setPendingChatContext({ kind: "pallet", id: r.hu, label: `${r.name || r.article} · ${r.location}` }); go("chat"); }} />}
      {page === "catalog" && <MCatalog key={param || "catalog"} s={s} user={user} go={go} onStart={(pid, palletNo, typeId) => startInspection(pid, palletNo, false, typeId)} setState={set} notify={notify} onVisual={visualInspection} preset={param} />}
      {page === "chat" && <MChat s={s} set={set} user={user} go={go} initialContext={pendingChatContext} clearInitialContext={() => setPendingChatContext(null)} />}
      {page === "menu" && <MMenu s={s} set={set} user={user} go={go} users={s.users} setUser={id => { setUserId(id); go("home"); }} onLogout={() => { writeSession(null); setUserId(null); }} dark={dark} onTheme={toggleTheme} simOffline={simOffline} onSimOffline={() => setSimOffline(o => !o)} onSync={() => pullState(true)} syncMsg={syncMsg} />}
      {page === "profile" && <MProfile s={s} set={set} user={user} go={go} />}
      {page === "notifications" && <MNotifications s={s} set={set} user={user} go={go} />}
      {page === "announcements" && <MAnnouncements s={s} set={set} user={user} go={go} />}
      {page === "flags" && <MFlags s={s} user={user} go={go} />}
      {page === "unreported" && <MUnreported s={s} set={set} user={user} go={go} />}
      {page === "head-escalations" && <MHeadEscalations s={s} set={set} user={user} go={go} notify={notify} />}
      {page === "head-flags" && <MHeadFlags s={s} set={set} user={user} go={go} notify={notify} />}
      {page === "head-announce" && <MHeadAnnounce s={s} set={set} user={user} go={go} notify={notify} />}
      {page === "inspection" && <MInspection s={s} set={set} user={user} inspId={param} go={go} notify={notify} />}
    </Phone>
  );
}
