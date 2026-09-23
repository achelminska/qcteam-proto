import { useState, useEffect, useRef } from "react";
import { createSyncer, guardUnload } from "./sync.js";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Legend } from "recharts";
import { Clock, MessageCircle, Link2, List as ListIcon, BarChart3, Printer, SlidersHorizontal, SkipForward, LayoutDashboard, ClipboardList, Flag, Bell, FolderTree, ListTree, Package, LayoutTemplate, Truck, Globe, Megaphone, MessageSquare, Users, Search, Sun, Moon, Database, Home, Menu as MenuIcon, ScanLine, Plus, ChevronLeft, ChevronDown, ChevronRight, User, Camera, Image as ImageIcon, Paperclip, Send, Star, Pencil, Sparkles, HelpCircle, Download, Lock as LockIcon, AlertTriangle, Inbox, FileText, ShieldAlert, Tag, Layers, BookOpen, Filter, Check, X, Ruler, Boxes } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// QCteam — portal Head of Quality (mini-aplikacja, stan startowy pusty)
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
// Notification look: one lucide icon per type in a soft circle; legacy messages get their emoji stripped on display.
const NOTIF = { Exceeded: [AlertTriangle, "bad"], AcceptedDespite: [AlertTriangle, "warn"], Escalation: [HelpCircle, "warn"], Question: [MessageCircle, "info"], Answered: [MessageCircle, "ok"], Flag: [Flag, "warn"], Announcement: [Megaphone, "info"], EditedByOther: [Pencil, "info"], DeadlineWarning: [Clock, "warn"], DeadlineBreached: [AlertTriangle, "bad"], Lost: [Search, "warn"], Found: [Check, "ok"] };
const notifLook = t => { const [I, tone] = NOTIF[t] || [Bell, "info"]; const fg = tone === "bad" ? C.bad : tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.accent; const bg = tone === "bad" ? C.badBg : tone === "warn" ? C.warnBg : tone === "ok" ? C.okBg : C.accentSoft; return { I, fg, bg }; };
const cleanMsg = m => String(m || "").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
const NotifIcon = ({ type, size = 32 }) => { const { I, fg, bg } = notifLook(type); return <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: bg, color: fg }}><I size={Math.round(size * 0.5)} strokeWidth={2} /></span>; };
const Dot = ({ on }) => <span className="inline-block rounded-full ml-2 align-middle" style={{ width: 7, height: 7, background: on ? C.ok : C.line }} />;
const NAV_ICON = { blocked: LockIcon, lost: Search, unreported: ShieldAlert, integrations: Link2, lists: ListIcon, analytics: BarChart3, settings: SlidersHorizontal, dashboard: LayoutDashboard, inspections: ClipboardList, flags: Flag, notifications: Bell, categories: FolderTree, problems: ListTree, products: Package, forms: LayoutTemplate, suppliers: Truck, countries: Globe, announcements: Megaphone, messages: MessageSquare, users: Users, catalog: Package, home: Home, chat: MessageSquare, menu: MenuIcon };
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
  Photos: { label: "Photos", desc: "a named photo block — call it e.g. “Label”, “Pallet”, “Defects close-up”; the name shows in the form and in the report. Add as many as you need.", once: false },
  Escalate: { label: "Ask the Head", desc: "pauses the inspection (Status=Draft) and sends a notification", once: true },
};
const isSystem = t => !!SYSTEM_TYPES[t];
// A Photos block with its own name ("Label", "Pallet"…) is reported under that name; the generic default falls back to its module.
const photoBlockLabel = (f, t) => { const l = (f.label || "").trim(); return l && !/^(module )?photos$/i.test(l) ? l : `Module photos: ${(t.modules.find(m => m.id === f.moduleId) || {}).name || ""}`; };
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
const dayLabel = iso => { if (!iso) return "—"; const d = new Date(iso), t = new Date(); const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); const diff = Math.round((day(t) - day(d)) / 86400000); return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const truncate = (t, n = 90) => t && t.length > n ? t.slice(0, n).trimEnd() + "…" : t;

// ── Pomocnicze na drzewach ──────────────────────────────────────────────────
const byId = arr => Object.fromEntries(arr.map(x => [x.id, x]));
const kidsOf = (arr, id) => arr.filter(x => x.parentId === id);
const isLeaf = (arr, id) => kidsOf(arr, id).length === 0;
const depthOf = (arr, id) => { const m = byId(arr); let d = 0, n = m[id]; while (n?.parentId) { d++; n = m[n.parentId]; } return d; };
const pathOf = (arr, id) => { const m = byId(arr); const o = []; let n = m[id]; while (n) { o.unshift(n.name); n = m[n.parentId]; } return o.join(" › "); };
const subtree = (arr, id) => { const s = new Set([id]); let g = true; while (g) { g = false; arr.forEach(x => { if (x.parentId && s.has(x.parentId) && !s.has(x.id)) { s.add(x.id); g = true; } }); } return s; };

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
// Suggestions: problem names used in OTHER categories/products (not this scope, not global) that aren't already visible here.
const problemSuggestions = (s, scope, visible) => {
  if (scope.kind === "Global") return [];
  const visibleNames = new Set(visible.map(p => p.name.trim().toLowerCase()));
  const labelOf = p => p.productId ? s.products.find(x => x.id === p.productId)?.name : p.categoryId ? s.categories.find(x => x.id === p.categoryId)?.name : null;
  const map = new Map();
  s.problems.forEach(p => {
    if (!p.categoryId && !p.productId) return;
    if (p.categoryId === scope.id || p.productId === scope.id) return;
    const key = p.name.trim().toLowerCase();
    if (!key || visibleNames.has(key)) return;
    const label = labelOf(p);
    if (!label) return;
    if (!map.has(key)) map.set(key, { name: p.name.trim(), sources: new Set() });
    map.get(key).sources.add(label);
  });
  return [...map.values()].map(v => ({ name: v.name, sources: [...v.sources] })).sort((a, b) => a.name.localeCompare(b.name));
};
// Full "Parent › Child" label for a node id, and a tree-ordered flat list for a "pick a parent" dropdown.
const problemPath = (problems, id) => { const node = problems.find(p => p.id === id); if (!node) return ""; const parent = node.parentId ? problemPath(problems, node.parentId) : ""; return parent ? `${parent} › ${node.name}` : node.name; };
const problemParentOptions = problems => { const out = []; const walk = parentId => { problems.filter(p => (p.parentId || null) === parentId).forEach(p => { out.push({ id: p.id, label: problemPath(problems, p.id) }); walk(p.id); }); }; walk(null); return out; };
// Reference guide (knowledge base): a Head-curated note (description + photos) per product×problem-type, so controllers
// know what a given remark actually looks like. Only leaf problem types get notes — those are what's reported against.
const noteFor = (notes, problemId) => (notes || []).find(n => n.problemId === problemId);
const hasNoteContent = n => !!(n && (n.description || "").trim() || asPhotoList(n?.photos).length);
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
const settingsOf = s => ({ companyName: "Picnic Technologies", qcEmail: "qc@picnic.nl", rejectionWindowHours: 24, deadlineWarnHours: 6, deadlineWarnHoursRisky: 10, riskyLookbackDays: 14, resultIcons: {}, ...(s.settings || {}) });
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
  // Head-configured stamp/icon for this result (Settings → Report result icon), pinned to the sheet's top-right corner.
  const resultIcon = settings.resultIcons?.[insp.result]; if (resultIcon?.dataUrl) { try { doc.addImage(resultIcon.dataUrl, "JPEG", R - 11, 0, 11, 11); } catch (e) {} }
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
  const groups = []; (t.fields || []).forEach(f => { const ph = asPhotoList((insp.photos || {})[f.id]); if (ph.length) groups.push({ label: f.type === "Photos" ? photoBlockLabel(f, t) : f.label, photos: ph }); }); (insp.remarks || []).forEach(r => { const ph = asPhotoList(r.photos); if (ph.length) groups.push({ label: `Problem: ${pathOf(problems, r.leafId)}`, photos: ph }); });
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
        {alerts.map(a => { const left = a.deadlineAt - now; const urgent = left <= 3600000; const expired = left <= 0; return (
          <button key={a.key} onClick={() => onOpen(a)} className="text-left rounded-2xl px-3 py-2.5 flex-shrink-0 active:opacity-70" style={{ width: 150, background: expired || urgent ? C.badBg : C.warnBg, color: C.ink, border: `1px solid ${expired || urgent ? C.bad : C.warn}` }}>
            <p className="text-lg font-bold tracking-tight leading-none" style={{ color: expired || urgent ? C.bad : C.warn, fontVariantNumeric: "tabular-nums" }}>{fmtLeft(left)}</p>
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
// One pallet, two ways of writing its SSCC (with/without the AI prefix and leading zeros)
const samePallet = (a, b) => { const x = String(a || "").replace(/\D/g, "").replace(/^0+/, ""), y = String(b || "").replace(/\D/g, "").replace(/^0+/, ""); return !!x && !!y && (x === y || x.endsWith(y) || y.endsWith(x)); };
// The WMS dock sheet can lag behind — a pallet already reported still shows up "on dock" until the next push. This is
// what actually decides that, so it's surfaced wherever a pallet is browsed, not only when its exact code is scanned.
const completedInspectionFor = (s, hu) => (s.inspections || []).filter(i => i.status === "Completed" && (i.pallets || []).some(h => samePallet(h, hu))).sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0] || null;
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
// A drill-down selection (which item within a screen is open) that also rides the browser's history stack, so
// stepping "back" inside a screen — browser back, an edge-swipe, anything that fires popstate — undoes one level
// of drill-down instead of leaving the screen outright, the same way the top-level page switch does. `key` only
// needs to be unique among the useBackSel calls active on screen at once (a component can use more than one).
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
function IntegrationsPage({ s, set }) {
  const list = s.integrations || [];
  const [sel, setSel] = useBackSel("integSel", list[0]?.id || null); const it = list.find(i => i.id === sel);
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
                <p className="label-sm mb-1">Rejection window</p>
                <p className="text-xs mb-2" style={{ color: C.muted }}>A pallet can only be rejected within a fixed window after arrival. As it closes, the pallet shows up as a countdown tile on every dashboard until it is inspected — earlier for products rejected in the last {settingsOf(s).riskyLookbackDays} days.</p>
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
const contextLabel = (s, c) => { if (c.kind === "product") return { icon: Package, text: s.products.find(p => p.id === c.id)?.name || "product" }; if (c.kind === "inspection") { const i = s.inspections.find(x => x.id === c.id); const p = i && s.products.find(x => x.id === i.productId); return { icon: ClipboardList, text: i ? `${p?.name || "inspection"} · ${i.status === "Completed" ? (i.result || inspType(s, i).name) : STATUS[i.status]?.[0] || i.status} · ${fmtTime(i.completedAt || i.startedAt)}` : "inspection" }; } if (c.kind === "pallet") return { icon: Truck, text: `Pallet ${c.id}${c.label ? " · " + c.label : ""}` }; if (c.kind === "flag") { const f = s.flags.find(x => x.id === c.id); return { icon: Flag, text: f ? `Flag: ${(f.description || "").slice(0, 40)}` : "flag" }; } if (c.kind === "category") return { icon: FolderTree, text: s.categories.find(x => x.id === c.id)?.name || c.label || "category" }; return { icon: Tag, text: c.label || c.kind }; };
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
// Any number of devices and people can be signed in at once (portal + phones). Concurrent edits are merged by the
// shared syncer (src/sync.js): every edit is a function applied on top of the server's latest copy, never a blind overwrite.
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

// ═══════════════════ UI: prymitywy ═══════════════════
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

// ═══════════════════ SHELL: top bar + sidebar ═══════════════════
const NAV_HEAD = [
  { group: null, items: [["dashboard", "🏠", "Dashboard"], ["inspections", "📋", "Inspections"], ["blocked", "🔒", "Blocked pallets"], ["lost", "🔍", "Lost pallets"], ["unreported", "🛡️", "Unreported pallets"], ["analytics", "📊", "Analytics"], ["flags", "🚩", "Flags"], ["notifications", "🔔", "Notifications"]] },
  { group: "Catalog", items: [["categories", "📁", "Categories"], ["problems", "🌳", "Problem types"], ["products", "📦", "Products"], ["forms", "🧩", "Forms"]] },
  { group: "Dictionaries", items: [["suppliers", "🚚", "Suppliers"], ["lists", "📋", "Lists"]] },
  { group: "Communication", items: [["announcements", "📣", "Announcements"], ["messages", "💬", "Messages"]] },
  { group: "Administration", items: [["integrations", "🔗", "Integrations"], ["settings", "⚙️", "Settings"], ["users", "👤", "Users"]] },
];
const NAV_CONTROLLER = [
  { group: null, items: [["dashboard", "🏠", "Dashboard"], ["inspections", "📋", "Inspections"], ["catalog", "📦", "Products"], ["unreported", "🛡️", "Unreported pallets"], ["messages", "💬", "Messages"], ["flags", "🚩", "My flags"], ["notifications", "🔔", "Notifications"]] },
];

function Shell({ page, setPage, children, badge, topRight, users, user, setUser, onLogout, unread, onBell, onSearch }) {
  const [topQ, setTopQ] = useState("");
  const NAV = user.role === "Head" ? NAV_HEAD : NAV_CONTROLLER;
  return (
    <div className="qc min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <style>{GLOBAL_CSS()}</style>
      <div className="flex items-center gap-4 px-5" style={{ height: 56, background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div className="flex items-center gap-2.5" style={{ width: 190 }}><span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: C.accent, color: C.onDark }}>Q</span><span className="font-semibold text-[15px] tracking-tight">QCteam</span><span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: C.accentSoft, color: C.accent }}>{user.role}</span></div>
<SearchBox value={topQ} onChange={setTopQ} placeholder="Search products, inspections…" className="hidden md:block" style={{ width: 320 }} inputClass="rounded-xl" onKeyDown={e => { if (e.key === "Enter" && topQ.trim()) { onSearch && onSearch(topQ.trim()); } }} />
        <div className="flex-1" />
        {topRight}
        <button onClick={onBell} className="relative text-lg" title="notifications"><Ic i={Bell} s={18} mr={0} />{unread > 0 && <span className="absolute -top-1 -right-2 text-[10px] px-1.5 rounded-full" style={{ background: C.bad, color: C.onDark }}>{unread}</span>}</button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: C.accentSoft, color: C.accent }}>{user.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</div>
          <span className="text-sm font-medium">{user.name} · {user.role}</span><button onClick={onLogout} className="text-xs px-2 py-1 rounded-lg" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Log out</button>
        </div>
      </div>
      <div className="flex">
        <aside className="flex-shrink-0 px-3 py-4" style={{ width: 224, borderRight: `1px solid ${C.line}`, minHeight: "calc(100vh - 56px)", background: C.surface }}>
          {NAV.map((g, gi) => (
            <div key={gi} className="mb-4">
              {g.group && <p className="label-sm px-3 mb-1.5">{g.group}</p>}
              {g.items.map(([key, icon, label]) => {
                const on = page === key;
                return (
                  <button key={key} onClick={() => setPage(key)} className="w-full flex items-center gap-2.5 px-3 rounded-xl text-[13.5px] text-left mb-0.5" style={{ height: 38, background: on ? C.accentSoft : "transparent", color: on ? C.accent : C.ink, fontWeight: on ? 600 : 450 }}>
                    <span className="w-6 flex justify-center" style={{ opacity: on ? 1 : .85 }}>{NAV_ICON[key] ? <Ic i={NAV_ICON[key]} s={17} mr={0} /> : icon}</span><span className="flex-1">{label}</span>
                    {badge?.[key] > 0 && <span className="text-[10.5px] font-semibold min-w-[20px] text-center px-1.5 py-0.5 rounded-full" style={{ background: on ? C.accent : C.warnBg, color: on ? C.onDark : C.warn }}>{badge[key]}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        <main className="flex-1 px-8 py-7" style={{ maxWidth: 1120 }}>{children}</main>
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Dashboard ═══════════════════
// What the floor looks like right now, for the Head in the office: docks by priority, the blocked queue by state, who has
// what, lost pallets, and how fresh the sheets are. Same numbers the phones show — one source (the shared state).
const PRIO_ORDER = ["Now needed", "High risk", "High issues", "Late inspection", "Inspection due"];
const floorStats = (s, now = Date.now()) => { const today = new Date().toISOString().slice(0, 10);
  const dockAll = dockRowsLive(s); const dock = dockAll.filter(r => !lostOf(s, r)); const dockLost = dockAll.length - dock.length;
  const prio = Object.fromEntries(PRIO_ORDER.map(k => [k, dock.filter(r => r.priority === k).length]));
  const skippable = dock.filter(r => r.skippable).length; const blocking = dock.filter(r => r.blocking).length;
  const q = blockedQueue(s); const open = q.filter(b => b.status !== "Completed" && !b.lost); const bl = { open: open.length, taken: open.filter(b => b.claim?.status === "taken").length, stacked: open.filter(b => b.claim?.status === "stacked").length, lost: q.filter(b => b.lost && b.status !== "Completed").length, done: q.filter(b => b.status === "Completed").length };
  bl.unassigned = bl.open - bl.taken - bl.stacked;
  const lostOpen = Object.entries(s.lostPallets || {}).filter(([k]) => [...dockAll, ...blockedRowsLive(s)].some(r => lostKey(r) === k && lostOf(s, r))).length;
  const people = s.users.filter(u => u.active !== false && u.role !== "Head").map(u => {
    const claims = Object.entries(s.palletClaims || {}).filter(([, c]) => c.userId === u.id);
    const mine = claims.map(([k, c]) => { const row = [...dockAll, ...blockedRowsLive(s)].find(r => claimKey(r) === k); return row ? { ...row, claim: c } : null; }).filter(Boolean).filter(r => !lostOf(s, r));
    const inProgress = s.inspections.filter(i => i.controllerId === u.id && ["Draft", "PendingReview"].includes(i.status));
    const doneToday = s.inspections.filter(i => i.controllerId === u.id && i.status === "Completed" && (i.completedAt || "").slice(0, 10) === today);
    const lastAt = [...claims.map(([, c]) => c.at), ...s.inspections.filter(i => i.controllerId === u.id).map(i => i.completedAt || i.startedAt)].filter(Boolean).sort().slice(-1)[0] || null;
    return { user: u, taken: mine.filter(r => r.claim.status === "taken"), inProgress, doneToday: doneToday.length, lastAt };
  }).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
  const alerts = computeDeadlineAlerts(s, now);
  return { dock, dockLost, prio, skippable, blocking, skus: new Set(dock.map(r => r.article)).size, bl, lostOpen, people, alerts, fresh: sheetFreshness(s), doneToday: s.inspections.filter(i => i.status === "Completed" && (i.completedAt || "").slice(0, 10) === today).length, unreported: unreportedStats(s, now) };
};
const agoShort = t => { if (!t) return "—"; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtTime(t); };

function Dashboard({ s, setPage, seed, user, openProduct, onAssign, set }) {
  const [prioSel, setPrioSel] = useState(null); const [blSel, setBlSel] = useState(null);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const f = floorStats(s, now);
  const globalT = s.templates.find(t => t.scope === "Global");
  const steps = [
    { done: s.categories.length > 0, label: "Create categories", page: "categories", why: "a product must belong to a category" },
    { done: s.problems.length > 0, label: "Define the problem catalog", page: "problems", why: "forms pick problems from the catalog" },
    { done: s.products.length > 0, label: "Add products and their specifications", page: "products", why: "measurement fields link to product specifications" },
    { done: !!globalT, label: "Build the global template", page: "forms", why: "every product is composed from it + category and product layers" },
  ];
  const nextStep = steps.find(x => !x.done);
  const hasDock = (s.integrations || []).some(i => i.purpose === "Dock" && i.rows?.length);
  const prioRows = prioSel ? f.dock.filter(r => prioSel === "Skippable" ? r.skippable : prioSel === "Needed today" ? r.blocking : r.priority === prioSel).sort((a, b) => `${a.arrived} ${a.arrivedTime}`.localeCompare(`${b.arrived} ${b.arrivedTime}`)) : [];
  // Same collapse-by-SKU the phone uses: one row per article, "×N" when more than one pallet is on the dock.
  const prioGroups = (() => { const map = new Map(); prioRows.forEach(r => { const k = r.article || r.hu; if (!map.has(k)) map.set(k, []); map.get(k).push(r); });
    // The dock sheet still lists a pallet even once it's reported — it just hasn't refreshed yet — so count how many
    // of the group already have a completed report and flag it, instead of letting them look untouched.
    return [...map.values()].map(rows => { const sorted = [...rows].sort((a, b) => `${a.arrived} ${a.arrivedTime}`.localeCompare(`${b.arrived} ${b.arrivedTime}`)); const first = sorted[0]; const locs = new Set(rows.map(r => r.location).filter(Boolean));
      const mixedPO = new Set(rows.map(r => (r.po || "").trim()).filter(Boolean)).size > 1;
      // This table is filtered to one priority, so ×N here only ever counts pallets IN that priority — it's not the
      // SKU's total on the dock. The product page's "On the docks now" count (dockRowsForProduct) has no such
      // filter, so the two can legitimately differ; without this hint a lower number here reads as a bug instead of
      // the two views simply answering different questions.
      const totalOnDock = first.article ? f.dock.filter(x => x.article === first.article).length : rows.length;
      return { ...first, count: rows.length, totalOnDock, checked: rows.filter(x => completedInspectionFor(s, x.hu)).length, mixedPO, location: locs.size <= 1 ? first.location : `${locs.size} locations` }; }).sort((a, b) => `${a.arrived} ${a.arrivedTime}`.localeCompare(`${b.arrived} ${b.arrivedTime}`)); })();
  const Tile = ({ label, value, sub, color, onClick, active }) => <button onClick={onClick} disabled={!onClick} className="rounded-2xl p-4 text-left" style={{ background: active ? C.accentSoft : C.surface, border: `1px solid ${active ? C.accent : C.line}`, borderLeft: `3px solid ${color || C.line}`, cursor: onClick ? "pointer" : "default" }}><p className="text-xs" style={{ color: C.muted }}>{label}</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: value > 0 && color ? color : C.ink }}>{value}</p>{sub && <p className="text-[11px]" style={{ color: C.muted }}>{sub}</p>}</button>;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1"><h1>Floor now</h1><span className="text-xs" style={{ color: C.muted }}>{f.fresh.length ? f.fresh.map(x => `${x.purpose === "Dock" ? "dock" : "blocked"} sheet ${agoShort(x.at)}`).join(" · ") : "no sheets connected"}</span></div>
      <DeadlineBanner s={s} alerts={f.alerts} now={now} onOpen={a => a.productId && openProduct && openProduct(a.productId)} onMessage={onAssign} />

      <p className="label-sm mt-2 mb-1.5" style={{ color: C.muted }}>Docks · {f.dock.length} pallets · {f.skus} SKUs{f.blocking ? ` · ${f.blocking} needed today` : ""}{f.skippable ? ` · ${f.skippable} skippable` : ""}{f.dockLost ? ` · ${f.dockLost} lost` : ""}</p>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        <Tile label="Needed today" value={f.blocking} sub={f.blocking ? "blocks picking" : "nothing blocking"} color={f.blocking ? C.bad : C.muted} onClick={hasDock ? () => setPrioSel(prioSel === "Needed today" ? null : "Needed today") : undefined} active={prioSel === "Needed today"} />
        {PRIO_ORDER.map(k => <Tile key={k} label={k} value={f.prio[k]} color={k === "Now needed" || k === "High risk" ? C.bad : k === "High issues" || k === "Late inspection" ? C.warn : C.muted} onClick={hasDock ? () => setPrioSel(prioSel === k ? null : k) : undefined} active={prioSel === k} />)}
        <Tile label="Skippable" value={f.skippable} color={C.muted} onClick={hasDock ? () => setPrioSel(prioSel === "Skippable" ? null : "Skippable") : undefined} active={prioSel === "Skippable"} />
      </div>
      {prioSel && <Card style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2 mb-2"><p className="font-medium text-sm flex-1">{prioSel} · {prioRows.length} pallet{prioRows.length === 1 ? "" : "s"} · {prioGroups.length} product{prioGroups.length === 1 ? "" : "s"} · oldest first{prioSel === "Needed today" ? " · flagged on the dock sheet — picking waits for these" : ""}</p><button onClick={() => setPrioSel(null)} className="text-xs" style={{ color: C.muted }}>close</button></div>
        {prioRows.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing at this priority.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Product", ...(prioSel === "Needed today" ? ["Priority"] : []), "Article", "Location", "Arrived", "Transporter", "History"].map(h => <th key={h} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>{prioGroups.map(r => { const prod = s.products.find(p => p.articleId === r.article); const hist = recentProblemsFor(s, prod?.id); return (
            <tr key={r.article || r.hu} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-3">{prod ? <button onClick={() => openProduct(prod.id)} className="text-left font-medium" style={{ color: C.ink }}>{r.name || prod.name}</button> : <span>{r.name || r.article}<span className="text-[11px] ml-1" style={{ color: C.warn }}>no profile</span></span>}{r.count > 1 && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>×{r.count} on docks</span>}{r.totalOnDock > r.count && <span className="text-[10px] ml-1.5" style={{ color: C.muted }}>+{r.totalOnDock - r.count} elsewhere</span>}{r.mixedPO && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>⚠ mixed PO</span>}{r.checked > 0 && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>✓ {r.checked === r.count ? "already inspected" : `${r.checked}/${r.count} inspected`}</span>}{r.blocking && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded" style={{ background: C.badBg, color: C.bad }}>needed today</span>}</td>
              {prioSel === "Needed today" && <td className="py-1.5 pr-3 text-xs">{r.priority || "—"}</td>}<td className="py-1.5 pr-3 font-mono text-xs">{r.article}</td><td className="py-1.5 pr-3">{r.location}</td><td className="py-1.5 pr-3 text-xs">{r.arrived} {r.arrivedTime}</td><td className="py-1.5 pr-3 text-xs">{r.transporter}</td>
              <td className="py-1.5 text-xs" style={{ color: hist.count ? C.bad : C.muted }}>{hist.count ? `${hist.count} rejected · ${hist.problems.slice(0, 2).map(x => x.name).join(", ")}` : "clean"}</td>
            </tr>); })}</tbody>
        </table>}
      </Card>}

      <p className="label-sm mt-4 mb-1.5" style={{ color: C.muted }}>Blocked pallets</p>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        {[["open", "Open", f.bl.open, C.bad], ["unassigned", "Unassigned", f.bl.unassigned, C.warn], ["taken", "Taken", f.bl.taken, C.accent], ["stacked", "In stack", f.bl.stacked, C.muted], ["lost", "Lost", f.bl.lost, C.muted], ["done", "Done", f.bl.done, C.ok]].map(([k, l, v, col]) => <Tile key={k} label={l} value={v} color={col} onClick={() => setBlSel(blSel === k ? null : k)} active={blSel === k} />)}
      </div>
      {blSel && (() => { const q = blockedQueue(s); const pick = { open: b => b.status !== "Completed" && !b.lost, unassigned: b => b.status !== "Completed" && !b.lost && !b.claim, taken: b => b.status !== "Completed" && !b.lost && b.claim?.status === "taken", stacked: b => b.status !== "Completed" && !b.lost && b.claim?.status === "stacked", lost: b => !!b.lost && b.status !== "Completed", done: b => b.status === "Completed" }[blSel]; const order = { "Not started": 0, "Started": 1, "Completed": 2 }; const list = q.filter(pick).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.time || "").localeCompare(b.time || "")); const label = { open: "Open", unassigned: "Unassigned", taken: "Taken", stacked: "In stack", lost: "Lost", done: "Done" }[blSel]; return (
        <Card style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2 mb-1"><p className="font-medium text-sm flex-1">{label} · {list.length} pallet{list.length === 1 ? "" : "s"}</p><button onClick={() => setPage(blSel === "lost" ? "lost" : "blocked")} className="text-xs underline" style={{ color: C.accent }}>full page</button><button onClick={() => setBlSel(null)} className="text-xs ml-2" style={{ color: C.muted }}>close</button></div>
          {list.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing here.</p> : list.map(b => { const prod = s.products.find(p => p.articleId === b.article); return <QueueRow key={b.key} s={s} set={set} user={user} b={b} onOpen={() => prod && openProduct(prod.id)} />; })}
        </Card>); })()}
      {f.lostOpen > f.bl.lost && <p className="text-[11px] mb-3" style={{ color: C.muted }}>{f.lostOpen - f.bl.lost} more lost on the dock lists — see <button onClick={() => setPage("lost")} className="underline" style={{ color: C.accent }}>Lost pallets</button>.</p>}

      <p className="label-sm mt-4 mb-1.5 flex items-center" style={{ color: C.muted }}><Ic i={ShieldAlert} s={12} />Unreported pallets · left the dock without a report</p>
      <div className="grid gap-3 mb-1" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Tile label="Today" value={f.unreported.today} color={f.unreported.today ? C.bad : C.muted} onClick={() => setPage("unreported")} />
        <Tile label="This week" value={f.unreported.week} color={f.unreported.week ? C.warn : C.muted} onClick={() => setPage("unreported")} />
        <Tile label="Open (not reviewed)" value={f.unreported.open} color={f.unreported.open ? C.warn : C.muted} onClick={() => setPage("unreported")} />
      </div>
      {f.unreported.open > 0 && <p className="text-[11px] mb-3" style={{ color: C.muted }}>{f.unreported.open} pallet{f.unreported.open === 1 ? "" : "s"} left the dock without ever being inspected — see <button onClick={() => setPage("unreported")} className="underline" style={{ color: C.accent }}>Unreported pallets</button>.</p>}

      <p className="label-sm mt-4 mb-1.5" style={{ color: C.muted }}>Team · {f.doneToday} inspection{f.doneToday === 1 ? "" : "s"} done today</p>
      <Card style={{ marginBottom: 16 }}>
        {f.people.length === 0 ? <p className="text-xs py-2" style={{ color: C.muted }}>No controllers yet.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Controller", "Has now", "Inspecting", "Done today", "Last activity"].map(h => <th key={h} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>{f.people.map(p => (
            <tr key={p.user.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-2 pr-3"><span className="inline-flex items-center gap-2"><Avatar user={p.user} size={22} />{p.user.name}</span></td>
              {/* "In stack" isn't anyone's — it means the pallet can't be reached yet (buried under another), not that a controller
                  holds it — so it belongs to the Blocked-pallets status tiles above, not to a person's row here. */}
              <td className="py-2 pr-3 text-xs">{p.taken.length ? p.taken.map(r => <div key={claimKey(r)}>{r.name || r.article} <span style={{ color: C.muted }}>· {r.location}{r.zone ? ` · zone ${r.zone}` : ""}{r.priority ? ` · ${r.priority}` : " · blocked"}</span></div>) : <span style={{ color: C.muted }}>—</span>}</td>
              <td className="py-2 pr-3 text-xs">{p.inProgress.length ? p.inProgress.map(i => <div key={i.id}>{s.products.find(x => x.id === i.productId)?.name || `pallet ${(i.pallets || [])[0] || ""}`} <span style={{ color: C.muted }}>· {i.status === "PendingReview" ? "awaiting you" : "draft"}</span></div>) : <span style={{ color: C.muted }}>—</span>}</td>
              <td className="py-2 pr-3">{p.doneToday}</td>
              <td className="py-2 text-xs" style={{ color: C.muted }}>{agoShort(p.lastAt)}</td>
            </tr>))}</tbody>
        </table>}
      </Card>

      <div className="grid grid-cols-4 gap-3 mb-3">
        {[["Awaiting Head", s.inspections.filter(i => i.status === "PendingReview").length, "inspections"], ["Open flags", s.flags.filter(f => f.status === "Open").length, "flags"], ["Unread", s.notifications.filter(n => n.userId === user.id && !n.readAt).length, "notifications"], ["Products", s.products.length, "products"]].map(([l, v, pg]) => (
          <button key={l} onClick={() => setPage(pg)} className="rounded-2xl p-4 text-left" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${v > 0 && l !== "Products" ? C.warn : C.line}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: v > 0 && l !== "Products" ? C.warn : C.ink }}>{v}</p></button>
        ))}
      </div>
      {nextStep && <Card>
        <p className="font-medium mb-3">Getting started</p>
        {steps.map((x, i) => (
          <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs" style={{ background: x.done ? C.okBg : C.accentSoft, color: x.done ? C.ok : C.accent }}>{x.done ? "✓" : i + 1}</span>
            <div className="flex-1"><p className="text-sm font-medium" style={{ textDecoration: x.done ? "line-through" : "none", color: x.done ? C.muted : C.ink }}>{x.label}</p><p className="text-xs" style={{ color: C.muted }}>{x.why}</p></div>
            {!x.done && <Primary small onClick={() => setPage(x.page)}>Go</Primary>}
          </div>
        ))}
        <p className="text-xs mt-4" style={{ color: C.muted }}>Just want to see what it looks like configured? <button onClick={seed} className="underline" style={{ color: C.accent }}>Load sample data</button></p>
      </Card>}
    </div>
  );
}
function SpecForm({ specs, inherited, onAdd, onRemove, hint, excluded, onExclude, onRestore, sctx }) {
  const [sp, setSp] = useState({ name: "", unit: "", kind: "min", min: "", max: "", basis: "piece" });
  const reg = sctx ? specRegistry(sctx) : []; const near = sctx ? nearSpecName(sctx, sp.name) : null;
  const knownNames = new Set([...(specs || []), ...(inherited || [])].map(q => `${(q.name || "").toLowerCase()}|${specBasis(q)}`));
  const suggestions = reg.filter(e => !knownNames.has(`${e.name.toLowerCase()}|${sp.basis}`) && (!sp.name.trim() || e.name.toLowerCase().includes(sp.name.trim().toLowerCase()))).slice(0, 8);
  const add = () => { if (!sp.name.trim()) return; const min = sp.kind === "max" ? null : sp.min, max = sp.kind === "min" ? null : sp.max; if (!hasV(min) && !hasV(max)) return; onAdd({ id: uid(), basis: sp.basis, name: sctx ? canonicalSpecName(sctx, sp.name) : sp.name.trim(), unit: sp.unit.trim(), min: hasV(min) ? min : null, max: hasV(max) ? max : null }); setSp({ name: "", unit: "", kind: "min", min: "", max: "" }); };
  return (
    <>
      {hint && <p className="text-xs mb-3" style={{ color: C.muted }}>{hint}</p>}
      <div className="flex gap-1.5 mb-1.5">
        <input value={sp.name} onChange={e => setSp(x => ({ ...x, name: e.target.value }))} placeholder="e.g. Brix" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
        <input value={sp.unit} onChange={e => setSp(x => ({ ...x, unit: e.target.value }))} placeholder="%" className="w-14 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
        <select value={sp.basis} onChange={e => setSp(x => ({ ...x, basis: e.target.value }))} title="what the limits refer to — one piece or one consumer unit (CU)" className="text-xs" style={{ minHeight: 34, width: 96 }}><option value="piece">per piece</option><option value="cu">per CU</option></select>
      </div>
      {near && <p className="text-xs mb-1.5" style={{ color: C.warn }}>Did you mean <button onClick={() => setSp(x => ({ ...x, name: near.name, unit: x.unit || near.unit }))} className="underline font-semibold">{near.name}</button>? Different spellings become different specifications — inheritance and analytics won't match them.</p>}
      {suggestions.length > 0 && <div className="flex flex-wrap gap-1 mb-2 items-center"><span className="text-[11px]" style={{ color: C.muted }}>already used:</span>{suggestions.map(e => <button key={e.name} onClick={() => setSp(x => ({ ...x, name: e.name, unit: x.unit || e.unit }))} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{e.name}{e.unit ? <span style={{ color: C.muted }}> {e.unit}</span> : null}</button>)}</div>}
      <div className="flex gap-1.5 mb-3 items-center flex-wrap">
        {[["min", "Minimum"], ["max", "Maximum"], ["range", "Range"]].map(([k, l]) => <button key={k} onClick={() => setSp(x => ({ ...x, kind: k }))} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: sp.kind === k ? C.accent : C.accentSoft, color: sp.kind === k ? C.onDark : C.accent }}>{l}</button>)}
        {sp.kind !== "max" && <input type="number" value={sp.min} onChange={e => setSp(x => ({ ...x, min: e.target.value }))} placeholder={sp.kind === "range" ? "from" : "min"} className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
        {sp.kind === "range" && <span className="text-xs" style={{ color: C.muted }}>–</span>}
        {sp.kind !== "min" && <input type="number" value={sp.max} onChange={e => setSp(x => ({ ...x, max: e.target.value }))} onKeyDown={e => e.key === "Enter" && add()} placeholder={sp.kind === "range" ? "to" : "max"} className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
        <Primary small onClick={add}>+</Primary>
      </div>
      {specs.length === 0 && (!inherited || inherited.length === 0) && <p className="text-xs" style={{ color: C.muted }}>No specifications.</p>}
      {excluded && excluded.length > 0 && <div className="mt-2"><p className="label-sm mb-1">not inherited on this product</p>{excluded.map(n => <div key={n} className="flex items-center gap-2 text-xs py-1" style={{ color: C.muted }}><span className="flex-1 line-through">{n}</span><button onClick={() => onRestore(n)} className="text-xs" style={{ color: C.accent }}>restore</button></div>)}</div>}
      {specs.map(q => <div key={q.id} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{q.name}</span><span style={{ color: C.muted }}>{specLabel(q)}{basisTag(q)}</span><button onClick={() => onRemove(q.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>)}
      {inherited && inherited.length > 0 && <>
        <p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>inherited</p>
        {inherited.map(q => <div key={q.id} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}`, opacity: 0.65 }}><span className="flex-1">{q.name}</span><span style={{ color: C.muted }}>{specLabel(q)}{basisTag(q)} · {q.source}</span>{onExclude && <button onClick={() => onExclude(q.name)} className="text-xs px-1" style={{ color: C.muted }} title="don't inherit this specification on this product">exclude</button>}</div>)}
      </>}
    </>
  );
}

function ControllerDashboard({ s, user, setPage, setOpenId, openProduct }) {
  const alerts = computeDeadlineAlerts(s);
  const mine = s.inspections.filter(i => i.controllerId === user.id).sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  const open = mine.filter(i => ["Draft", "PendingReview"].includes(i.status));
  const [annOpen, setAnnOpen] = useState(null);
  const dashAnns = s.announcements.filter(a => a.showOnDashboard && annActive(a)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  // Product-scoped announcements already have a home — the product's profile card — so clicking one just opens that instead of a modal.
  const openAnn = a => (a.productId && openProduct) ? openProduct(a.productId) : setAnnOpen(a);
  return (
    <div>
      <h1 className="mb-1">Hi, {user.name.split(" ")[0]}</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>Controller view (on the phone this is the mobile app). Only what's yours.</p>
      {/* One gets its full preview text; several collapse to titles only so they don't take over the dashboard. */}
      {dashAnns.length > 0 && <Card style={{ marginBottom: 16, borderColor: C.accent }}><p className="text-xs font-medium mb-2" style={{ color: C.accent }}>📣 ANNOUNCEMENTS</p>{dashAnns.length === 1 ? <button onClick={() => openAnn(dashAnns[0])} className="w-full text-left py-2" style={{ borderTop: `1px solid ${C.line}` }}><p className="text-sm font-medium">{dashAnns[0].title}</p><p className="text-sm truncate" style={{ color: C.muted }}>{truncate(dashAnns[0].body)}</p><p className="text-xs" style={{ color: C.muted }}>{fmtTime(dashAnns[0].createdAt)}{dashAnns[0].validTo && ` · to ${dashAnns[0].validTo}`}</p></button> : dashAnns.map(a => <button key={a.id} onClick={() => openAnn(a)} className="w-full text-left py-2" style={{ borderTop: `1px solid ${C.line}` }}><p className="text-sm font-medium">{a.title}</p></button>)}</Card>}
      {/* Controllers see this too, not just the Head — a pallet that left without a report is something everyone on the floor should be aware of. */}
      {unreportedStats(s).open > 0 && <button onClick={() => setPage("unreported")} className="w-full flex items-center gap-2.5 text-left mb-4 rounded-xl px-3.5 py-2.5" style={{ background: C.warnBg, border: `1px solid ${C.warn}` }}><Ic i={ShieldAlert} s={16} style={{ color: C.warn }} /><span className="text-sm flex-1">{unreportedStats(s).open} pallet{unreportedStats(s).open === 1 ? "" : "s"} left the dock without a report</span><span className="text-xs underline" style={{ color: C.warn }}>see all</span></button>}
      <div className="mb-4"><Primary onClick={() => { setOpenId(null); setPage("inspections"); }}>+ New inspection</Primary></div>
      {open.length > 0 && <Card style={{ marginBottom: 16 }}><p className="font-medium text-sm mb-2">Unfinished</p>{open.map(i => <button key={i.id} onClick={() => { setOpenId(i.id); setPage("inspections"); }} className="w-full text-left flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}` }}><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: STATUS[i.status][2], color: STATUS[i.status][1] }}>{STATUS[i.status][0]}</span><span className="flex-1 text-sm">{s.products.find(p => p.id === i.productId)?.name}</span><span className="text-xs" style={{ color: C.muted }}>{fmtTime(i.startedAt)}</span></button>)}</Card>}
      <Card><p className="font-medium text-sm mb-2">My recent</p>{mine.filter(i => i.status === "Completed").slice(0, 8).map(i => <button key={i.id} onClick={() => { setOpenId(i.id); setPage("inspections"); }} className="w-full text-left flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}` }}><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: i.result === "Accepted" ? C.okBg : C.badBg, color: i.result === "Accepted" ? C.ok : C.bad }}>{i.result === "Accepted" ? "Accepted" : "Rejected"}</span><span className="flex-1 text-sm">{s.products.find(p => p.id === i.productId)?.name}</span><span className="text-xs" style={{ color: C.muted }}>{fmtTime(i.completedAt)}</span></button>)}{mine.filter(i => i.status === "Completed").length === 0 && <p className="text-xs" style={{ color: C.muted }}>Nothing yet.</p>}</Card>
      {annOpen && <AnnouncementModal a={annOpen} onClose={() => setAnnOpen(null)} />}
    </div>
  );
}
// Full announcement text, off the dashboard preview — dimmed backdrop, click outside or Close to dismiss.
function AnnouncementModal({ a, onClose }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(31,42,36,0.55)", zIndex: 50 }} onClick={onClose}>
      <div className="rounded-2xl p-6 max-w-md w-full" style={{ background: C.surface }} onClick={e => e.stopPropagation()}>
        <p className="text-xs font-medium mb-2 flex items-center" style={{ color: C.accent }}><Ic i={Megaphone} s={13} />Announcement</p>
        <p className="text-lg font-semibold mb-2">{a.title}</p>
        <p className="text-sm mb-4" style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
        <p className="text-xs mb-4" style={{ color: C.muted }}>{fmtTime(a.createdAt)}{a.validTo && ` · on the dashboard until ${a.validTo}`}</p>
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ background: C.ink, color: C.onDark }}>Close</button>
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Categories ═══════════════════
function CategoriesPage({ s, set, onMessage, onOpenProduct, presetSel, clearPresetSel }) {
  const [name, setName] = useState(""); const [parentId, setParentId] = useState(""); const [selCat, setSelCat] = useBackSel("selCat", null);
  const [addOpen, setAddOpen] = useState(false);
  const [prodListOpen, setProdListOpen] = useState(false);
  useEffect(() => { setProdListOpen(false); }, [selCat]);
  useEffect(() => { if (presetSel) { setSelCat(presetSel); clearPresetSel && clearPresetSel(); } }, [presetSel]);
  const cat = s.categories.find(c => c.id === selCat);
  const patchCat = p => set(x => ({ ...x, categories: x.categories.map(c => c.id === selCat ? { ...c, ...p } : c) }));
  const parentSpecs = cat?.parentId ? (s.categories.find(c => c.id === cat.parentId)?.specs || []).map(q => ({ ...q, source: `category ${s.categories.find(c => c.id === cat.parentId)?.name}` })) : [];
  const parentVars = cat?.parentId ? (s.categories.find(c => c.id === cat.parentId)?.varieties || []).map(v => ({ ...v, source: `category ${s.categories.find(c => c.id === cat.parentId)?.name}` })) : [];
  const [varName, setVarName] = useState(""); const [varOpen, setVarOpen] = useState(false);
  const [applyAsk, setApplyAsk] = useState(null);
  const productsUnder = cid => { const ids = new Set(s.categories.filter(c => c.id === cid || c.parentId === cid).map(c => c.id)); return s.products.filter(p => ids.has(p.categoryId)); };
  const applyDecision = () => { const skip = applyAsk.kids.filter(p => !applyAsk.chosen.has(p.id)); if (skip.length) set(x => ({ ...x, products: x.products.map(p => skip.some(k => k.id === p.id) ? { ...p, excludedSpecNames: [...new Set([...(p.excludedSpecNames || []), applyAsk.spec.name])] } : p) })); setApplyAsk(null); };
  const addCatVar = () => { if (!cat || !varName.trim()) return; patchCat({ varieties: [...(cat.varieties || []), { id: uid(), name: varName.trim() }] }); setVarName(""); };
  const roots = s.categories.filter(c => !c.parentId);
  const add = () => { if (!name.trim()) return; const id = uid(); set(x => ({ ...x, categories: [...x.categories, { id, name: name.trim(), parentId: parentId || null, specs: [], varieties: [] }] })); setName(""); setParentId(""); setAddOpen(false); setSelCat(id); };
  const used = id => s.products.some(p => p.categoryId === id) || s.categories.some(c => c.parentId === id);
  const remove = id => { set(x => ({ ...x, categories: x.categories.filter(c => c.id !== id) })); if (selCat === id) setSelCat(null); };
  const prodCount = id => s.products.filter(p => p.categoryId === id).length;
  // The info/editing panel lives at the top of the page — jump there whenever a different category is picked from the grid below.
  const selectCat = id => { setSelCat(id); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} };
  const CatCard = ({ c, sub }) => (
    <button onClick={() => selectCat(c.id)} className="rounded-2xl p-3 text-left flex items-center gap-2.5" style={{ background: selCat === c.id ? C.accentSoft : C.surface, border: `1px solid ${selCat === c.id ? C.accent : C.line}` }}>
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: sub ? C.bg : C.accentSoft, color: sub ? C.muted : C.accent }}>{sub ? "↳" : <Ic i={FolderTree} s={17} mr={0} />}</span>
      <span className="min-w-0">
        <span className="block text-sm font-medium truncate" style={{ color: selCat === c.id ? C.accent : C.ink }}>{c.name}</span>
        <span className="block text-[10px] truncate" style={{ color: C.muted }}>{prodCount(c.id)} product{prodCount(c.id) === 1 ? "" : "s"}{!sub && kidsOf(s.categories, c.id).length ? ` · ${kidsOf(s.categories, c.id).length} sub` : ""}{sub ? ` · in ${s.categories.find(x => x.id === c.parentId)?.name || "—"}` : ""}</span>
      </span>
    </button>
  );
  return (
    <div>
      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1"><h1>Categories</h1><p className="text-sm mt-0.5" style={{ color: C.muted, maxWidth: 640 }}>At most two levels. A product belongs to exactly one.</p></div>
        <button onClick={() => { setAddOpen(o => !o); }} className="text-sm px-3 py-2 rounded-xl inline-flex items-center" style={{ background: addOpen ? C.ink : C.surface, color: addOpen ? C.onDark : C.ink, border: `1px solid ${addOpen ? C.ink : C.line}` }}><Ic i={Plus} s={14} />New category</button>
      </div>

      {addOpen && <Card style={{ marginBottom: 16 }}>
        <p className="font-medium text-sm mb-3">New category</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <input autoFocus value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="e.g. Apples" className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
          <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }}>
            <option value="">None — top-level category</option>
            {roots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <p className="text-xs mt-1.5 mb-3" style={{ color: C.muted }}>Only a top-level category can be a parent.</p>
        <div className="flex gap-2"><Primary onClick={add} disabled={!name.trim()}>Create</Primary><button onClick={() => setAddOpen(false)} className="text-sm px-3" style={{ color: C.muted }}>Cancel</button></div>
      </Card>}

      {/* Selected category: info & editing panel, always on top */}
      <Card style={{ marginBottom: 16 }}>
        {!cat ? <Empty icon="📁" title="Select a category" hint="Pick one from the list below, or create a new one." /> : (
          <>
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.accentSoft, color: C.accent }}><Ic i={FolderTree} s={20} mr={0} /></span>
              <div className="flex-1 min-w-0">
                <input value={cat.name} onChange={e => patchCat({ name: e.target.value })} className="text-base font-semibold w-full outline-none bg-transparent" style={{ border: "none", padding: 0 }} />
                <p className="text-xs mt-1 flex items-center flex-wrap gap-1" style={{ color: C.muted }}>
                  <span>{cat.parentId ? `Sub-category of ${s.categories.find(c => c.id === cat.parentId)?.name || "—"}` : "Top-level category"} ·</span>
                  {prodCount(cat.id) > 0 ? (
                    <button onClick={() => setProdListOpen(o => !o)} className="inline-flex items-center" style={{ color: C.accent }}>
                      {prodCount(cat.id)} product{prodCount(cat.id) === 1 ? "" : "s"}<Ic i={prodListOpen ? ChevronDown : ChevronRight} s={12} mr={0} style={{ marginLeft: 2 }} />
                    </button>
                  ) : <span>0 products</span>}
                  {(cat.specs || []).length > 0 && <span>· {cat.specs.length} spec.</span>}
                </p>
                {prodListOpen && prodCount(cat.id) > 0 && (
                  <div className="mt-2 rounded-xl" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>
                    {s.products.filter(p => p.categoryId === cat.id).sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <button key={p.id} onClick={() => onOpenProduct && onOpenProduct(p.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left" style={{ borderTop: `1px solid ${C.line}` }}>
                        <span className="flex-1 min-w-0 text-sm truncate">{p.name}</span>
                        <span className="text-[11px] flex-shrink-0" style={{ color: C.muted }}>{p.articleId || "no ID"}</span>
                        {p.isBio && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: C.okBg, color: C.ok }}>bio</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {onMessage && <button onClick={() => onMessage({ kind: "category", id: cat.id, label: cat.name })} className="text-xs px-2.5 py-1 rounded-md inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={MessageSquare} s={13} />Message</button>}
                <button onClick={() => remove(cat.id)} disabled={used(cat.id)} className="text-xs px-2.5 py-1 rounded-md" style={{ color: used(cat.id) ? C.muted : C.bad, border: `1px solid ${C.line}`, opacity: used(cat.id) ? .5 : 1 }} title={used(cat.id) ? "Still used by products or subcategories" : ""}>Delete</button>
              </div>
            </div>
          </>
        )}
      </Card>

      {cat && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1">Allowed inspection types: {cat.name}</p>
          <PolicyEditor s={s} own={Array.isArray(cat.allowedTypeIds) ? cat.allowedTypeIds : null} inherited={effectivePolicy(s, { categoryId: cat.parentId || null }).typeIds} inheritedSource={effectivePolicy(s, { categoryId: cat.parentId || null }).source} onChange={v => patchCat({ allowedTypeIds: v })} hint="Inherited by every product and subcategory. Types are defined in Forms." />
        </Card>
      )}
      {cat && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1">Attributes from lists: {cat.name}</p>
          <AttributeForm s={s} own={cat.attributes || []} inherited={cat.parentId ? effectiveAttributes(s, { categoryId: cat.parentId, attributes: [] }) : []} onSet={a => patchCat({ attributes: [...(cat.attributes || []).filter(x => x.dictionaryId !== a.dictionaryId), a] })} onRemove={did => patchCat({ attributes: (cat.attributes || []).filter(x => x.dictionaryId !== did) })} hint="A value set here is inherited by every product in the category and pre-filled in any form field bound to the same list. A product can override it." />
        </Card>
      )}
      {cat && !(cat.varieties || []).length && !varOpen && <button onClick={() => setVarOpen(true)} className="text-xs mt-3" style={{ color: C.accent }}>+ add a variety list for this category (optional)</button>}
      {cat && ((cat.varieties || []).length > 0 || varOpen) && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1">Category varieties: {cat.name}</p>
          <p className="text-xs mb-2" style={{ color: C.muted }}>All products in this category see them in the “Variety” block. A product can add its own.</p>
          <div className="flex gap-1.5 mb-2"><input value={varName} onChange={e => setVarName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCatVar()} placeholder="e.g. Duke" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><Primary small onClick={addCatVar}>+</Primary></div>
          {(cat.varieties || []).length === 0 ? <p className="text-xs" style={{ color: C.muted }}>None.</p> : (cat.varieties || []).map(v => <div key={v.id} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{v.name}</span><button onClick={() => patchCat({ varieties: cat.varieties.filter(x => x.id !== v.id) })} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>)}
          {parentVars.length > 0 && <><p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>inherited</p>{parentVars.map(v => <div key={v.id} className="text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}`, opacity: 0.65 }}>{v.name} <span className="text-xs" style={{ color: C.muted }}>· {v.source}</span></div>)}</>}
        </Card>
      )}
      {cat && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1">Category specifications: {cat.name}</p>
          <SpecForm sctx={s} specs={cat.specs || []} inherited={parentSpecs} onAdd={q => { patchCat({ specs: [...(cat.specs || []), q] }); const kids = productsUnder(cat.id); if (kids.length) setApplyAsk({ spec: q, kids, chosen: new Set(kids.map(p => p.id)), choosing: false }); }} onRemove={id => patchCat({ specs: (cat.specs || []).filter(q => q.id !== id) })}
            hint="Inherited by all products in this category (by name). A product can override with its own spec of the same name. Set e.g. Brix or Firmness once for the whole category here." />
        </Card>
      )}

      {/* Below: every category, browsable like the mobile catalog's category grid */}
      <p className="label-sm mt-5 mb-2">All categories</p>
      {s.categories.length === 0 ? <Card><Empty icon="📁" title="No categories" hint="Start with the main ones, e.g. Apples, Tomatoes. Add subcategories by choosing a parent." /></Card> : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {roots.flatMap(r => [{ c: r, sub: false }, ...kidsOf(s.categories, r.id).map(k => ({ c: k, sub: true }))]).map(({ c, sub }) => <CatCard key={c.id} c={c} sub={sub} />)}
        </div>
      )}

      {applyAsk && (
        <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(20,26,22,.55)", zIndex: 60 }}>
          <div className="rounded-2xl p-5 w-full" style={{ maxWidth: 480, background: C.surface }}>
            <h2 className="mb-1">Apply “{applyAsk.spec.name}” to the products in this category?</h2>
            <p className="text-xs mb-3" style={{ color: C.muted }}>{applyAsk.kids.length} product{applyAsk.kids.length === 1 ? "" : "s"} inherit from “{cat?.name}”. Products you leave out get a “not inherited” mark you can undo later in their profile.</p>
            {applyAsk.choosing && <div className="rounded-xl mb-3" style={{ border: `1px solid ${C.line}`, maxHeight: 260, overflowY: "auto" }}>{applyAsk.kids.map(p => <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={applyAsk.chosen.has(p.id)} onChange={e => setApplyAsk(a => { const c = new Set(a.chosen); e.target.checked ? c.add(p.id) : c.delete(p.id); return { ...a, chosen: c }; })} /><span className="flex-1">{p.name}</span>{(p.specs || []).some(q => (q.name || "").trim().toLowerCase() === applyAsk.spec.name.trim().toLowerCase()) && <span className="text-[11px]" style={{ color: C.muted }}>has its own</span>}</label>)}</div>}
            <div className="flex gap-2 flex-wrap">
              {!applyAsk.choosing ? <>
                <Primary onClick={applyDecision}>All {applyAsk.kids.length}</Primary>
                <Ghost onClick={() => setApplyAsk(a => ({ ...a, choosing: true }))}>Choose which…</Ghost>
              </> : <>
                <Primary onClick={applyDecision}>Apply to {applyAsk.chosen.size} of {applyAsk.kids.length}</Primary>
                <Ghost onClick={() => setApplyAsk(a => ({ ...a, chosen: new Set(a.kids.map(p => p.id)), choosing: false }))}>Back</Ghost>
              </>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════ ANALYTICS ENGINE — derived on the fly from Inspections/Answers/Remarks; no analytics tables ═══════════════════
const metricSeries = (s, inspections) => {
  // one point per inspection per Number field: { key, label, product, supplier, when, avg, min, max, result }
  const out = [];
  inspections.forEach(i => { const t = i.template; if (!t) return; const p = s.products.find(x => x.id === i.productId); const specs = p ? effectiveSpecs(s, p) : [];
    (t.fields || []).filter(f => f.type === "Number").forEach(f => { const nums = (i.values?.[f.id]?.measurements || []).filter(x => x !== "").map(Number).filter(n => !isNaN(n)); if (!nums.length) return;
      const wantedN = (f.specName || f.label || "").trim().toLowerCase(); const sameN = specs.filter(q => (q.name || "").trim().toLowerCase() === wantedN);
      const spec = f.specId ? specs.find(q => q.id === f.specId) : (sameN.find(q => specBasis(q) === fieldBasis(f)) || sameN[0]);
      const lim = limitsFor(spec, f, i.sample?.piecesPerCu || p?.piecesPerCu);
      out.push({ key: metricKey(f) + (fieldBasis(f) === "cu" ? "_cu" : ""), label: f.label + (fieldBasis(f) === "cu" ? " (per CU)" : ""), productId: i.productId, product: p?.name || "?", supplier: i.supplier || "—", controllerId: i.controllerId, when: i.completedAt || i.startedAt, avg: nums.reduce((a, b) => a + b, 0) / nums.length, lo: Math.min(...nums), hi: Math.max(...nums), n: nums.length, min: hasV(lim.min) ? Number(lim.min) : null, max: hasV(lim.max) ? Number(lim.max) : null, unit: spec?.unit || "", result: i.result, id: i.id }); }); });
  return out.sort((a, b) => (a.when || "").localeCompare(b.when || ""));
};
// Insights: plain rules, each one a sentence a Head would say out loud. Cheap to compute, easy to explain, easy to extend.
const computeInsights = (s, cur, prev) => {
  const out = []; const full = cur.filter(i => isVerdictType(s, i) && countsAs(s, i)); const pm = byId(s.problems);
  const rate = arr => arr.length ? arr.filter(i => i.result === "Rejected").length / arr.length : 0;
  const overall = rate(full);
  // 1. supplier outliers
  const bySup = Object.entries(full.reduce((m, i) => { if (!i.supplier) return m; (m[i.supplier] = m[i.supplier] || []).push(i); return m; }, {}));
  bySup.forEach(([sup, arr]) => { const r = rate(arr); if (arr.length >= 3 && r >= 0.34 && r >= overall * 1.5) out.push({ tone: "bad", title: `${sup}: ${Math.round(r * 100)}% rejected`, body: `${arr.filter(i => i.result === "Rejected").length} of ${arr.length} full inspections, vs ${Math.round(overall * 100)}% overall.`, go: { page: "inspections" } }); });
  // 2. metrics drifting toward or beyond spec
  const series = metricSeries(s, full); const groups = {};
  series.forEach(pt => { (groups[`${pt.productId}|${pt.key}`] = groups[`${pt.productId}|${pt.key}`] || []).push(pt); });
  Object.values(groups).forEach(g => { if (g.length < 2) return; const last = g[g.length - 1], first = g[0]; const lim = last.min != null ? last.min : last.max; if (lim == null) return;
    const span = (last.max != null && last.min != null) ? (last.max - last.min) : Math.abs(lim) || 1;
    const dist = last.min != null && last.max != null ? Math.min(last.avg - last.min, last.max - last.avg) : last.min != null ? last.avg - last.min : last.max - last.avg;
    const trend = last.avg - first.avg; const heading = last.min != null && trend < 0 || last.max != null && last.min == null && trend > 0;
    if (dist < 0) out.push({ tone: "bad", title: `${last.product}: ${last.label} out of spec`, body: `Latest average ${fmt(last.avg)} ${last.unit} vs ${last.min != null ? `min ${last.min}` : ""}${last.min != null && last.max != null ? " / " : ""}${last.max != null ? `max ${last.max}` : ""} (${last.supplier}).`, go: { page: "inspections", id: last.id } });
    else if (dist / span < 0.15 && heading) out.push({ tone: "warn", title: `${last.product}: ${last.label} drifting toward the limit`, body: `From ${fmt(first.avg)} to ${fmt(last.avg)} ${last.unit} over ${g.length} inspections; limit ${last.min != null ? last.min : last.max}.`, go: { page: "analytics", metric: last.key, product: last.productId } }); });
  // 3. problems rising vs previous period
  const cnt = arr => arr.flatMap(i => i.remarks || []).reduce((m, r) => { m[r.leafId] = (m[r.leafId] || 0) + 1; return m; }, {});
  const now = cnt(full), before = cnt(prev.filter(i => isVerdictType(s, i) && countsAs(s, i)));
  Object.entries(now).forEach(([id, n]) => { const b = before[id] || 0; if (n >= 3 && n >= b * 2) out.push({ tone: "warn", title: `${pm[id]?.name || "?"} rising`, body: `${n} remarks this period vs ${b} in the previous one.`, go: { page: "analytics" } }); });
  // 4. skips on products that also get rejected
  const rejProducts = new Set(full.filter(i => i.result === "Rejected").map(i => i.productId));
  const skipsOnRisky = cur.filter(i => !countsAs(s, i) && rejProducts.has(i.productId));
  if (skipsOnRisky.length) out.push({ tone: "warn", title: `${skipsOnRisky.length} skip${skipsOnRisky.length === 1 ? "" : "s"} on products that were also rejected`, body: `Skipping a product with recent rejections hides risk — consider tightening its inspection policy.`, go: { page: "settings" } });
  // 5. controller outlier
  const byCtrl = Object.entries(full.reduce((m, i) => { (m[i.controllerId] = m[i.controllerId] || []).push(i); return m; }, {}));
  byCtrl.forEach(([cid, arr]) => { const r = rate(arr); if (arr.length >= 5 && (r >= overall * 2 || (overall > 0.1 && r <= overall / 3))) out.push({ tone: "info", title: `${s.users.find(u => u.id === cid)?.name}: ${Math.round(r * 100)}% rejections`, body: `Overall ${Math.round(overall * 100)}% — worth a calibration chat, not a verdict.`, go: { page: "analytics" } }); });
  // 6. delivery-day coverage: inspected products with several pallets on dock but only one pallet on the report
  full.forEach(i => { const p = s.products.find(x => x.id === i.productId); const rows = p ? dockRowsForProduct(p) : []; const mine = (i.pallets || []).filter(Boolean); if (rows.length >= 3 && mine.length === 1) out.push({ tone: "info", title: `${p.name}: 1 pallet inspected, ${rows.length} on the docks`, body: `Other pallets from the same delivery may still be uncovered.`, go: { page: "inspections", id: i.id } }); });
  return out.slice(0, 8);
};

// ═══════════════════ PAGE: Analytics (E3) ═══════════════════
function AnalyticsPage({ s, setPage, openInspection, initial }) {
  const [range, setRange] = useState("30"); const [cat, setCat] = useState(""); const [sup, setSup] = useState("");
  const [metric, setMetric] = useState(initial?.metric || ""); const [prodSel, setProdSel] = useState(initial?.product || "");
  const t = new Date(); const days = Number(range); const since = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (days - 1)); const prevSince = new Date(since.getFullYear(), since.getMonth(), since.getDate() - days);
  const inScope = i => { if (i.status !== "Completed") return false; const p = s.products.find(x => x.id === i.productId); if (cat) { const chain = []; let c = s.categories.find(x => x.id === p?.categoryId); while (c) { chain.push(c.id); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } if (!chain.includes(cat)) return false; } if (sup && i.supplier !== sup) return false; return true; };
  const all = s.inspections.filter(i => inScope(i) && new Date(i.completedAt || i.startedAt) >= since);
  const prev = s.inspections.filter(i => inScope(i) && new Date(i.completedAt || i.startedAt) >= prevSince && new Date(i.completedAt || i.startedAt) < since);
  const full = all.filter(i => isVerdictType(s, i) && countsAs(s, i)), visual = all.filter(i => !isVerdictType(s, i) && countsAs(s, i)), skips = all.filter(i => !countsAs(s, i));
  const pct1 = (a, b) => b ? Math.round(a / b * 100) : 0;
  const acc = full.filter(i => i.result === "Accepted").length, rej = full.filter(i => i.result === "Rejected").length;
  const prevFull = prev.filter(i => isVerdictType(s, i) && countsAs(s, i)); const prevRejRate = pct1(prevFull.filter(i => i.result === "Rejected").length, prevFull.length);
  const avgDur = avgActiveMinutes(full);
  const insights = computeInsights(s, all, prev);
  const series = metricSeries(s, full);
  const metrics = [...new Map(series.map(pt => [pt.key, pt.label])).entries()];
  const activeMetric = metric || metrics[0]?.[0] || "";
  const mSeries = series.filter(pt => pt.key === activeMetric && (!prodSel || pt.productId === prodSel));
  const productsForMetric = [...new Map(series.filter(pt => pt.key === activeMetric).map(pt => [pt.productId, pt.product])).entries()];
  const suppliersIn = [...new Set(mSeries.map(pt => pt.supplier))];
  const band = mSeries.find(pt => pt.min != null || pt.max != null);
  const chartData = mSeries.map((pt, i) => ({ i, when: new Date(pt.when).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }), ...Object.fromEntries(suppliersIn.map(su => [su, pt.supplier === su ? +pt.avg.toFixed(2) : null])), result: pt.result, product: pt.product, id: pt.id }));
  const palette = [C.accent, "#3A7BD5", "#B5651D", "#7A4FA3", "#2F8F9D", "#C24E7E"];
  // per day
  const perDay = []; for (let d = 0; d < days; d++) { const day = new Date(since.getFullYear(), since.getMonth(), since.getDate() + d); const key = day.toISOString().slice(0, 10); const of = all.filter(i => (i.completedAt || "").slice(0, 10) === key); perDay.push({ day: day.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" }), ...Object.fromEntries(typesOf(s).map(t => [t.name, of.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id).length])) }); }
  const pm = byId(s.problems);
  const byProblem = Object.values(full.flatMap(i => i.remarks || []).reduce((m, r) => { const n = pm[r.leafId]?.name || "?"; m[n] = m[n] || { name: n, count: 0 }; m[n].count++; return m; }, {})).sort((a, b) => b.count - a.count).slice(0, 8);
  // supplier scorecard
  const scorecard = Object.values(all.filter(i => i.supplier).reduce((m, i) => { const k = i.supplier; m[k] = m[k] || { name: k, full: 0, rej: 0, skip: 0, visual: 0, problems: {} }; if (!countsAs(s, i)) m[k].skip++; else if (!isVerdictType(s, i)) m[k].visual++; else { m[k].full++; if (i.result === "Rejected") m[k].rej++; (i.remarks || []).forEach(r => { const n = pm[r.leafId]?.name; if (n) m[k].problems[n] = (m[k].problems[n] || 0) + 1; }); } return m; }, {})).map(r => ({ ...r, rate: pct1(r.rej, r.full), top: Object.entries(r.problems).sort((a, b) => b[1] - a[1])[0]?.[0] || "—" })).sort((a, b) => b.rate - a.rate || b.full - a.full);
  const byCtrl = s.users.filter(u => u.role === "Controller").map(u => { const mine = all.filter(i => i.controllerId === u.id); const f = mine.filter(i => isVerdictType(s, i) && countsAs(s, i)); return { name: u.name, full: f.length, visual: mine.filter(i => !isVerdictType(s, i) && countsAs(s, i)).length, skip: mine.filter(i => !countsAs(s, i)).length, rejRate: pct1(f.filter(i => i.result === "Rejected").length, f.length), avg: avgActiveMinutes(f) }; }).filter(r => r.full + r.visual + r.skip);
  const Kpi = ({ l, v, sub, tone, delta }) => <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${tone || C.line}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold mt-0.5">{v}</p>{sub && <p className="text-[11px]" style={{ color: C.muted }}>{sub}{delta != null && <span style={{ color: delta > 0 ? C.bad : delta < 0 ? C.ok : C.muted }}> · {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)} pp vs previous</span>}</p>}</div>;
  const tip = { contentStyle: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, color: C.ink, fontSize: 12 } };
  const toneColor = { bad: C.bad, warn: C.warn, info: C.accent };
  const goTo = g => { if (!g) return; if (g.page === "inspections" && g.id && openInspection) openInspection(g.id); else if (g.page === "analytics") { if (g.metric) setMetric(g.metric); if (g.product) setProdSel(g.product); } else if (setPage) setPage(g.page); };
  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-1 flex-wrap"><h1>Analytics</h1><div className="flex gap-1.5 flex-wrap items-center">{[["7", "7 days"], ["30", "30 days"], ["90", "90 days"]].map(([k, l]) => <button key={k} onClick={() => setRange(k)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: range === k ? C.ink : "transparent", color: range === k ? C.onDark : C.ink, border: `1px solid ${range === k ? C.ink : C.line}` }}>{l}</button>)}<select value={cat} onChange={e => setCat(e.target.value)} className="text-xs" style={{ minHeight: 30 }}><option value="">all categories</option>{s.categories.filter(c => !c.parentId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><select value={sup} onChange={e => setSup(e.target.value)} className="text-xs" style={{ minHeight: 30 }}><option value="">all suppliers</option>{[...new Set(s.inspections.map(i => i.supplier).filter(Boolean))].sort().map(n => <option key={n} value={n}>{n}</option>)}</select></div></div>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 680 }}>Computed live from inspections, answers and remarks. Compared with the previous period of the same length. Skips never count as inspections.</p>
      {all.length === 0 ? <Card><Empty icon="📋" title="No completed inspections in this period" hint="Analytics appear once controllers finish inspections." /></Card> : <>
        {insights.length > 0 && (
          <div className="mb-5">
            <p className="label-sm mb-2">Needs attention</p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              {insights.map((x, i) => <button key={i} onClick={() => goTo(x.go)} className="text-left rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${toneColor[x.tone]}` }}><p className="text-sm font-semibold mb-0.5">{x.title}</p><p className="text-xs" style={{ color: C.muted }}>{x.body}</p></button>)}
            </div>
          </div>
        )}
        <p className="label-sm mb-2">By inspection type</p>
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {typesOf(s).map(t => { const mine = all.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id); const pmine = prev.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id); const r = mine.filter(i => i.result === "Rejected").length; const rate = pct1(r, mine.length), prate = pct1(pmine.filter(i => i.result === "Rejected").length, pmine.length); const dur = avgActiveMinutes(mine); return (
            <div key={t.id} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderTop: `3px solid ${t.color}` }}>
              <div className="flex items-center justify-between"><p className="text-sm font-semibold">{t.name}</p><span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>{t.countsAsInspection === false ? "trace" : t.autoAccept ? "auto" : "verdict"}</span></div>
              <p className="text-[26px] leading-tight font-semibold mt-1">{mine.length}<span className="text-xs font-normal ml-1" style={{ color: C.muted }}>{pmine.length ? `vs ${pmine.length}` : ""}</span></p>
              {t.autoAccept ? <p className="text-[11px]" style={{ color: C.muted }}>{mine.filter(i => (i.remarks || []).length).length} with remarks · {dur !== null ? `${fmt(dur)} min avg` : "—"}</p>
                : <p className="text-[11px]" style={{ color: C.muted }}><span style={{ color: r ? C.bad : C.ok, fontWeight: 600 }}>{mine.length ? `${rate}% rejected` : "—"}</span>{pmine.length ? <span style={{ color: rate > prate ? C.bad : rate < prate ? C.ok : C.muted }}> · {rate > prate ? "▲" : rate < prate ? "▼" : "="} {Math.abs(rate - prate)} pp</span> : null} · {dur !== null ? `${fmt(dur)} min avg` : "—"}</p>}
            </div>); })}
        </div>
        {metrics.length > 0 && (
          <Card style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-2 flex-wrap mb-1"><h2 className="flex-1">Measurement trend</h2><select value={activeMetric} onChange={e => { setMetric(e.target.value); setProdSel(""); }} className="text-xs" style={{ minHeight: 30 }}>{metrics.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select><select value={prodSel} onChange={e => setProdSel(e.target.value)} className="text-xs" style={{ minHeight: 30 }}><option value="">all products with this metric</option>{productsForMetric.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
            <p className="text-xs mb-3" style={{ color: C.muted }}>Average per inspection, one line per supplier{band ? `; shaded band = specification (${band.min != null ? `min ${band.min}` : ""}${band.min != null && band.max != null ? " – " : ""}${band.max != null ? `max ${band.max}` : ""}${band.unit ? " " + band.unit : ""})` : ""}. Select a single product to make the band exact.</p>
            <div style={{ height: 240 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData} margin={{ left: -10, right: 10 }}><CartesianGrid vertical={false} stroke={C.line} /><XAxis dataKey="when" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} domain={["auto", "auto"]} /><Tooltip {...tip} formatter={(v, n, p) => [v, n]} labelFormatter={(l, p) => p?.[0] ? `${l} · ${p[0].payload.product}` : l} />{band && band.min != null && band.max != null && <ReferenceArea y1={band.min} y2={band.max} fill={C.ok} fillOpacity={0.08} />}{band && band.min != null && <ReferenceLine y={band.min} stroke={C.ok} strokeDasharray="4 4" />}{band && band.max != null && <ReferenceLine y={band.max} stroke={C.ok} strokeDasharray="4 4" />}<Legend wrapperStyle={{ fontSize: 11 }} />{suppliersIn.map((su, i) => <Line key={su} type="monotone" dataKey={su} stroke={palette[i % palette.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer></div>
          </Card>
        )}
        <Card style={{ marginBottom: 16 }}>
          <h2 className="mb-3">Inspections per day</h2>
          <div style={{ height: 200 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={perDay} margin={{ left: -20, right: 4 }}><CartesianGrid vertical={false} stroke={C.line} /><XAxis dataKey="day" tick={{ fontSize: 11, fill: C.muted }} interval={days > 30 ? 9 : days > 7 ? 3 : 0} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} /><Tooltip {...tip} cursor={{ fill: C.bg }} />{typesOf(s).map((t, i, arr) => <Bar key={t.id} dataKey={t.name} stackId="a" fill={t.color} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} />)}<Legend wrapperStyle={{ fontSize: 11 }} /></BarChart></ResponsiveContainer></div>
        </Card>
        <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
          <Card>
            <h2 className="mb-1">Supplier scorecard</h2><p className="text-xs mb-3" style={{ color: C.muted }}>Sorted by rejection rate. “Top problem” is the most frequent remark for that supplier.</p>
            {scorecard.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>No supplier data.</p> : <table className="w-full text-sm"><thead><tr className="text-xs" style={{ color: C.muted }}><th className="text-left font-medium pb-2">Supplier</th><th className="text-right font-medium pb-2">Full</th><th className="text-right font-medium pb-2">Rejected</th><th className="text-left font-medium pb-2 pl-3">Top problem</th></tr></thead><tbody>{scorecard.map(r => <tr key={r.name} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-2">{r.name}{r.skip ? <span className="text-[11px] ml-1" style={{ color: C.muted }}>· {r.skip} skip</span> : null}</td><td className="py-2 text-right">{r.full}</td><td className="py-2 text-right font-medium" style={{ color: r.rate >= 34 ? C.bad : r.rate > 0 ? C.warn : C.ok }}>{r.full ? `${r.rate}%` : "—"}</td><td className="py-2 pl-3 text-xs" style={{ color: C.muted }}>{r.top}</td></tr>)}</tbody></table>}
          </Card>
          <Card>
            <h2 className="mb-1">Top problems</h2><p className="text-xs mb-3" style={{ color: C.muted }}>Remarks per problem type, full inspections only.</p>
            {byProblem.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>No remarks.</p> : <div style={{ height: 40 + byProblem.length * 28 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={byProblem} layout="vertical" margin={{ left: 10, right: 24 }}><XAxis type="number" hide allowDecimals={false} /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: C.ink }} axisLine={false} tickLine={false} /><Tooltip {...tip} cursor={{ fill: C.bg }} /><Bar dataKey="count" fill={C.accent} radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 11, fill: C.muted }} /></BarChart></ResponsiveContainer></div>}
          </Card>
        </div>
        <Card>
          <h2 className="mb-1">Controllers</h2><p className="text-xs mb-3" style={{ color: C.muted }}>Workload and calibration. A rejection rate far from the team's is a reason to talk, not a score.</p>
          <table className="w-full text-sm"><thead><tr className="text-xs" style={{ color: C.muted }}><th className="text-left font-medium pb-2">Controller</th><th className="text-right font-medium pb-2">Full</th><th className="text-right font-medium pb-2">Visual</th><th className="text-right font-medium pb-2">Skips</th><th className="text-right font-medium pb-2">Reject rate</th><th className="text-right font-medium pb-2">Avg. time</th></tr></thead><tbody>{byCtrl.map(r => <tr key={r.name} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-2">{r.name}</td><td className="py-2 text-right">{r.full}</td><td className="py-2 text-right">{r.visual}</td><td className="py-2 text-right" style={{ color: r.skip ? C.warn : C.ink }}>{r.skip}</td><td className="py-2 text-right" style={{ color: r.full && Math.abs(r.rejRate - pct1(rej, full.length)) > 25 ? C.warn : C.ink }}>{r.full ? `${r.rejRate}%` : "—"}</td><td className="py-2 text-right">{r.avg !== null ? `${fmt(r.avg)} min` : "—"}</td></tr>)}</tbody></table>
        </Card>
      </>}
    </div>
  );
}

// ═══════════════════ PDF report: print-optimised layout (in the real system rendered server-side, same structure) ═══════════════════
function PrintReport({ insp, s, onClose }) {
  const product = s.products.find(p => p.id === insp.productId), t = insp.template, problems = problemsFor(s, { kind: "Product", id: insp.productId }, new Set((t && t.suppressed) || []));
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const pm = byId(problems);
  const refs = t ? [...t.problemRefs].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean) : [];
  const ctrl = s.users.find(u => u.id === insp.controllerId)?.name;
  const fieldsAnswered = t ? t.fields.filter(f => !isSystem(f.type) && insp.values?.[f.id] !== undefined && insp.values?.[f.id] !== "").sort(bySort) : [];
  const valStr = (f, v) => f.type === "Number" ? (v?.measurements || []).filter(x => x !== "").join(" / ") : Array.isArray(v) ? v.join(", ") : String(v ?? "");
  const photoGroups = []; if (t) { t.fields.forEach(f => { const ph = asPhotoList((insp.photos || {})[f.id]); if (ph.length) photoGroups.push({ label: f.type === "Photos" ? photoBlockLabel(f, t) : f.label, photos: ph }); }); (insp.remarks || []).forEach(r => { const ph = asPhotoList(r.photos); if (ph.length) photoGroups.push({ label: `Problem: ${pathOf(problems, r.leafId)}`, photos: ph }); }); }
  useEffect(() => { const prev = document.title; document.title = `QC report — ${product?.name || ""} — ${(insp.completedAt || "").slice(0, 10)}`; return () => { document.title = prev; }; }, []);
  const resultColor = insp.result === "Accepted" ? "#1f7a45" : "#b23a3a";
  const resultIcon = settingsOf(s).resultIcons?.[insp.result];
  return (
    <div className="fixed inset-0 overflow-y-auto print-root" style={{ background: "#666", zIndex: 70 }}>
      <style>{`
        .print-root .sheet{background:#fff;color:#111;width:210mm;min-height:297mm;margin:16px auto;padding:16mm 16mm 20mm;box-shadow:0 10px 40px rgba(0,0,0,.4);font:11.5pt/1.4 -apple-system,"Segoe UI",Arial,sans-serif}
        .print-root table{width:100%;border-collapse:collapse}.print-root td,.print-root th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left;font-size:10.5pt;vertical-align:top}
        .print-root th{font-size:9.5pt;color:#555;font-weight:600}.print-root h1{font-size:18pt;margin:0}.print-root h2{font-size:12pt;margin:14px 0 6px;color:#222}
        .print-root .k{color:#666;font-size:9.5pt}.print-root .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-weight:700;font-size:10.5pt;color:#fff}
        .print-root .bar{height:8px;background:#e5e5e5;border-radius:4px;overflow:hidden}.print-root .bar>div{height:100%}
        @media print{ body>*:not(.print-host){display:none!important} .print-root{position:static!important;background:#fff!important} .print-root .sheet{box-shadow:none;margin:0;width:auto;min-height:auto;padding:0} .print-root .no-print{display:none!important} @page{size:A4;margin:14mm} }
      `}</style>
      <div className="no-print flex items-center gap-3 p-3" style={{ background: "#333", color: "#fff", position: "sticky", top: 0 }}>
        <span className="text-sm">Print preview — in the real system this layout is generated server-side as a PDF file (Inspections → PDF export).</span><div className="flex-1" />
        <button onClick={() => window.print()} className="text-sm px-4 py-2 rounded-lg" style={{ background: "#fff", color: "#111", fontWeight: 600 }}>Print / Save as PDF</button>
        <button onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ background: "#555", color: "#fff" }}>Close</button>
      </div>
      <div className="sheet">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 10 }}>
          <div><div className="k">{settingsOf(s).companyName} · Quality inspection report · {settingsOf(s).qcEmail}</div><h1>{product?.name || "—"}</h1><div className="k">Article {product?.articleId || "—"} · {s.categories.find(c => c.id === product?.categoryId)?.name || "—"}{product?.isBio && " · bio"}</div></div>
          <div style={{ textAlign: "right" }}>{resultIcon?.dataUrl && <img src={resultIcon.dataUrl} alt="" style={{ width: 40, height: 40, objectFit: "contain", marginBottom: 6 }} />}<div><span className="pill" style={{ background: resultColor }}>{insp.result === "Accepted" ? "ACCEPTED" : "REJECTED"}</span></div><div className="k" style={{ marginTop: 6 }}>Report no. {insp.id.toUpperCase()}</div></div>
        </div>
        <table style={{ marginTop: 10 }}><tbody>
          <tr><th style={{ width: "22%" }}>Inspected</th><td>{fmtTime(insp.completedAt)} by {ctrl}{insp.lastEditedBy && ` (edited ${fmtTime(insp.lastEditedAt)} by ${s.users.find(u => u.id === insp.lastEditedBy)?.name})`}</td><th style={{ width: "22%" }}>Date code</th><td>{insp.dateISO ? `${dateCode(insp.dateISO)} (${insp.dateISO})` : "—"}</td></tr>
          <tr><th>Supplier</th><td>{insp.supplier || "—"}</td><th>Country of origin</th><td>{insp.country || "—"}</td></tr>
          <tr><th>Pallets</th><td>{(insp.pallets || []).filter(Boolean).join(", ") || "—"}</td><th>Variety</th><td>{insp.variety || "—"}</td></tr>
          <tr><th>Sample</th><td colSpan={3}>{insp.sample?.tu || 0} TU × {insp.sample?.cusPerTu || 0} CU = <b>{totals.cu} CU</b>{totals.pieces ? ` · ${totals.pieces} pcs` : ""}{totals.weight ? ` · ${fmt(totals.weight)} g` : ""}</td></tr>
        </tbody></table>
        {refs.length > 0 && <>
          <h2>Quality status</h2>
          <table><thead><tr><th>Problem group</th><th style={{ width: 90 }}>Found</th><th style={{ width: 90 }}>Tolerance</th><th style={{ width: 180 }}></th><th style={{ width: 90 }}>Status</th></tr></thead><tbody>
            {refs.map(n => { const tol = effTol(problems, t.overrides, n.id), agg = aggregate(problems, insp.remarks || [], n.id, totals), pr = presenceIn(problems, insp.remarks || [], n.id), st = statusOf(problems, t.overrides, insp.remarks || [], n.id, totals); const col = st === "exceeded" ? "#b23a3a" : st === "flagged" ? "#9a6a12" : "#1f7a45"; const w = tol === 0 ? (pr ? 100 : 0) : tol ? Math.min(100, agg / tol * 100) : (agg > 0 ? 100 : 0); return <tr key={n.id}><td><b>{n.name}</b></td><td>{tol === 0 ? (pr ? "present" : "—") : `${fmt(agg)}%`}</td><td>{tol === null ? "—" : `${tol}%`}</td><td><div className="bar"><div style={{ width: `${w}%`, background: col }} /></div></td><td style={{ color: col, fontWeight: 700 }}>{st === "exceeded" ? "EXCEEDED" : st === "flagged" ? "within" : "clean"}</td></tr>; })}
          </tbody></table>
        </>}
        {(insp.remarks || []).length > 0 && <>
          <h2>Remarks — reason for the result</h2>
          <table><thead><tr><th>Problem</th><th style={{ width: 120 }}>Quantity</th><th style={{ width: 90 }}>% of sample</th><th style={{ width: 110 }}>Source</th></tr></thead><tbody>
            {(insp.remarks || []).map(r => <tr key={r.id}><td>{pathOf(problems, r.leafId)}</td><td>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</td><td>{r.mode === "Presence" ? "—" : `${fmt(pct(r, totals))}%`}</td><td className="k">{r.auto ? "measurement" : "manual"}</td></tr>)}
          </tbody></table>
        </>}
        {fieldsAnswered.length > 0 && <>
          <h2>Parameters</h2>
          <table><tbody>{fieldsAnswered.map(f => <tr key={f.id}><th style={{ width: "30%" }}>{fieldLabel(f)}</th><td>{valStr(f, insp.values[f.id])}{f.type === "Number" && f.measurementCount > 1 && (() => { const nums = (insp.values[f.id]?.measurements || []).filter(x => x !== "").map(Number); return nums.length ? ` — avg ${fmt(nums.reduce((a, b) => a + b, 0) / nums.length)}` : ""; })()}</td></tr>)}</tbody></table>
        </>}
        <h2>Comment</h2>
        <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", minHeight: 40 }}>{insp.comment || <span className="k">—</span>}</div>
        {photoGroups.length > 0 && <>
          <h2>Photos</h2>
          {photoGroups.map((g, gi) => <div key={gi} style={{ marginBottom: 8 }}><div className="k" style={{ marginBottom: 4 }}>{g.label}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{g.photos.map(ph => <img key={ph.id} src={ph.dataUrl} alt="" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 4, border: "1px solid #ddd" }} />)}</div></div>)}
        </>}
        <h2>Report history</h2>
        <table><tbody>{(insp.audit || []).map((a, i) => <tr key={i}><th style={{ width: "26%" }}>{a.action}</th><td>{fmtTime(a.at)} · {s.users.find(u => u.id === a.userId)?.name}{s.users.find(u => u.id === a.userId)?.email ? ` (${s.users.find(u => u.id === a.userId).email})` : ""}{a.details ? ` — ${a.details}` : ""}</td></tr>)}</tbody></table>
        <div className="k" style={{ marginTop: 18, borderTop: "1px solid #ddd", paddingTop: 8, display: "flex", justifyContent: "space-between" }}><span>{settingsOf(s).companyName} · {settingsOf(s).qcEmail} · generated by QCteam {new Date().toLocaleString("en-GB")}</span><span>Report {insp.id.toUpperCase()}</span></div>
      </div>
    </div>
  );
}

// ═══════════════════ PAGE: Problem catalog ═══════════════════
function CatalogNode({ node, problems, onPatch, onAdd, onRemove, s, isOwned, onHide, collapsed, onToggle }) {
  const owned = isOwned ? isOwned(node) : true;
  const d = depthOf(problems, node.id), inherited = effTol(problems, [], node.parentId);
  const own = node.tolerance !== null && node.tolerance !== "" && node.tolerance !== undefined;
  const eff = own ? Number(node.tolerance) : inherited;
  const kids = kidsOf(problems, node.id);
  const isCollapsed = collapsed.has(node.id);
  return (
    <div>
      <div className="row flex items-center gap-2 py-1.5 pr-2 rounded-lg flex-wrap" style={{ paddingLeft: d * 18, borderTop: `1px solid ${C.line}` }}>
        {kids.length > 0 ? <button onClick={() => onToggle(node.id)} className="flex-shrink-0 flex items-center justify-center" style={{ width: 18, height: 18, color: C.muted }} title={isCollapsed ? "expand" : "collapse"}><Ic i={isCollapsed ? ChevronRight : ChevronDown} s={13} mr={0} /></button> : <span style={{ width: 18, flexShrink: 0 }} />}
        {owned ? <input value={node.name} onChange={e => onPatch(node.id, { name: e.target.value })} className="flex-1 min-w-[6rem] text-sm bg-transparent outline-none" style={{ fontWeight: d === 0 ? 600 : d === 1 ? 500 : 400 }} />
          : <span className="flex-1 min-w-[6rem] text-sm" style={{ fontWeight: d === 0 ? 600 : d === 1 ? 500 : 400, color: C.muted }}>{node.name}</span>}
        {s && scopeTag(node, s) && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.warnBg, color: C.warn }}>{scopeTag(node, s)}</span>}
        {!owned && isOwned && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.line, color: C.muted }}>inherited</span>}
        {isCollapsed && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.line, color: C.muted }}>{kids.length} hidden</span>}
        <span className="flex items-center gap-1 text-xs" style={{ color: C.muted }}>
          tolerance {owned ? <input type="number" value={node.tolerance ?? ""} onChange={e => onPatch(node.id, { tolerance: e.target.value === "" ? null : e.target.value })} placeholder={inherited !== null ? `(${inherited})` : "—"} className="w-14 text-right rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: eff === 0 ? C.warn : C.line, color: own ? C.ink : C.muted }} /> : <span className="w-14 text-right inline-block">{eff !== null ? eff : "—"}</span>}%
          {eff === 0 && <span className="px-1.5 py-0.5 rounded" style={{ background: C.warnBg, color: C.warn }} title="presence alone = exceeded">⚡</span>}
        </span>
        <button onClick={() => onAdd(node.id)} className="text-xs px-1.5" style={{ color: C.accent }} title="add child in this scope">+</button>
        {owned ? <button onClick={() => onRemove(node.id)} className="text-xs px-1.5" style={{ color: C.muted }} title="delete with subtree">×</button>
          : (onHide && d > 0 && <button onClick={() => onHide(node.id)} className="text-[10px] px-1.5" style={{ color: C.muted }} title="hide in this scope (stays globally)">hide</button>)}
      </div>
      {!isCollapsed && kids.map(k => <CatalogNode key={k.id} node={k} problems={problems} onPatch={onPatch} onAdd={onAdd} onRemove={onRemove} s={s} isOwned={isOwned} onHide={onHide} collapsed={collapsed} onToggle={onToggle} />)}
    </div>
  );
}
function ProblemsPage({ s, set }) {
  const [scope, setScope] = useState({ kind: "Global" });
  const [collapsed, setCollapsed] = useState(new Set());
  const toggleCollapse = id => setCollapsed(c => { const next = new Set(c); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const visible = problemsFor(s, scope);
  const patch = (id, p) => set(x => ({ ...x, problems: x.problems.map(n => n.id === id ? { ...n, ...p } : n) }));
  const add = parentId => set(x => ({ ...x, problems: [...x.problems, { id: uid(), parentId, name: parentId ? "new problem" : "New problem type", tolerance: null, categoryId: scope.kind === "Category" ? scope.id : null, productId: scope.kind === "Product" ? scope.id : null }] }));
  const addSuggestion = (name, parentId) => set(x => ({ ...x, problems: [...x.problems, { id: uid(), parentId: parentId || null, name, tolerance: null, categoryId: scope.kind === "Category" ? scope.id : null, productId: scope.kind === "Product" ? scope.id : null }] }));
  const suggestions = problemSuggestions(s, scope, visible);
  const sourceLabel = list => list.length <= 2 ? list.join(", ") : `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
  const [addingSuggestion, setAddingSuggestion] = useState(null);
  const [addParent, setAddParent] = useState("");
  const parentOptions = problemParentOptions(visible);
  const catPath = c => { const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const isOwned = scope.kind === "Global" ? null : n => scope.kind === "Category" ? n.categoryId === scope.id : n.productId === scope.id;
  const holder = scope.kind === "Category" ? s.categories.find(c => c.id === scope.id) : scope.kind === "Product" ? s.products.find(p => p.id === scope.id) : null;
  const setHidden = ids => set(x => scope.kind === "Category" ? { ...x, categories: x.categories.map(c => c.id === scope.id ? { ...c, hiddenProblemIds: ids } : c) } : { ...x, products: x.products.map(p => p.id === scope.id ? { ...p, hiddenProblemIds: ids } : p) });
  const hide = id => setHidden([...new Set([...(holder?.hiddenProblemIds || []), id])]);
  const unhide = id => setHidden((holder?.hiddenProblemIds || []).filter(x => x !== id));
  const hiddenHere = (holder?.hiddenProblemIds || []).map(id => s.problems.find(p => p.id === id)).filter(Boolean);
  const remove = id => set(x => { const dead = subtree(x.problems, id); return { ...x, problems: x.problems.filter(n => !dead.has(n.id)), templates: x.templates.map(t => ({ ...t, problemRefs: t.problemRefs.filter(r => !dead.has(r.problemTypeId)), overrides: t.overrides.filter(o => !dead.has(o.problemTypeId)), fields: t.fields.map(f => ({ ...f, problemBelowId: dead.has(f.problemBelowId) ? null : f.problemBelowId, problemAboveId: dead.has(f.problemAboveId) ? null : f.problemAboveId })) })) }; });
  return (
    <div>
      <h1 className="mb-1">Problem types</h1>
      <p className="text-sm mb-3" style={{ color: C.muted }}>One catalog, but a node can have a scope. Choose who you're editing for: what you add is visible only in that scope (and below). Global nodes are visible everywhere.</p>
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        <button onClick={() => setScope({ kind: "Global" })} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: scope.kind === "Global" ? C.accent : C.accentSoft, color: scope.kind === "Global" ? C.onDark : C.accent }}><Ic i={Globe} s={13} />Global</button>
        <select value={scope.kind === "Category" ? scope.id : ""} onChange={e => e.target.value && setScope({ kind: "Category", id: e.target.value })} className="text-xs rounded px-2 py-1.5 outline-none" style={{ ...inp, background: scope.kind === "Category" ? C.accent : C.accentSoft, color: scope.kind === "Category" ? C.onDark : C.accent, border: "none" }}><option value="">for category…</option>{s.categories.map(c => <option key={c.id} value={c.id}>{catPath(c)}</option>)}</select>
        <select value={scope.kind === "Product" ? scope.id : ""} onChange={e => e.target.value && setScope({ kind: "Product", id: e.target.value })} className="text-xs rounded px-2 py-1.5 outline-none" style={{ ...inp, background: scope.kind === "Product" ? C.accent : C.accentSoft, color: scope.kind === "Product" ? C.onDark : C.accent, border: "none" }}><option value="">for product…</option>{s.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <span className="text-xs" style={{ color: C.muted }}>{scope.kind === "Global" ? "editing the global catalog" : "inherited nodes can only be hidden or extended; you delete and edit only what was added here"}</span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: suggestions.length > 0 ? "1fr 280px" : "1fr" }}>
        <Card>
          {visible.length === 0 ? <Empty icon="🌳" title="The catalog is empty" hint="Typically: “Quality problems” with Major/Minor subcategories, and “General problems” with pallet issues. Set tolerance on the subcategory and override on a specific problem only when needed." action={<Primary onClick={() => add(null)}>Add the first type</Primary>} /> : (
            <>
              {visible.filter(p => !p.parentId).map(r => <CatalogNode key={r.id} node={r} problems={visible} onPatch={patch} onAdd={add} onRemove={remove} s={s} isOwned={isOwned} onHide={scope.kind === "Global" ? null : hide} collapsed={collapsed} onToggle={toggleCollapse} />)}
              {hiddenHere.length > 0 && <div className="text-xs mt-3 flex flex-wrap gap-1.5 items-center" style={{ color: C.muted }}>hidden in this scope: {hiddenHere.map(h => <button key={h.id} onClick={() => unhide(h.id)} className="px-1.5 py-0.5 rounded line-through" style={{ background: C.line }} title="restore">{h.name}</button>)}</div>}
              <div className="mt-3"><Ghost onClick={() => add(null)}>+ Add problem type{scope.kind !== "Global" && " (in this scope)"}</Ghost></div>
            </>
          )}
        </Card>
        {suggestions.length > 0 && (
          <Card>
            <p className="font-medium text-sm mb-1 flex items-center gap-1"><Ic i={Sparkles} s={14} mr={0} />Suggestions</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>Used elsewhere, not yet here — click + to add.</p>
            {suggestions.map(sug => (
              <div key={sug.name} className="py-1.5 px-1 rounded-lg" style={{ borderTop: `1px solid ${C.line}` }}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm truncate">{sug.name}</span>
                    <span className="block text-[10px] truncate" style={{ color: C.muted }}>{sourceLabel(sug.sources)}</span>
                  </span>
                  {addingSuggestion === sug.name
                    ? <button onClick={() => setAddingSuggestion(null)} className="text-xs px-1.5 flex-shrink-0" style={{ color: C.muted }} title="cancel">×</button>
                    : <button onClick={() => { setAddingSuggestion(sug.name); setAddParent(""); }} className="text-xs px-1.5 flex-shrink-0" style={{ color: C.accent }} title="add here">+</button>}
                </div>
                {addingSuggestion === sug.name && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <select value={addParent} onChange={e => setAddParent(e.target.value)} className="flex-1 min-w-0 text-xs rounded px-1.5 py-1 outline-none" style={{ ...inp }}>
                      <option value="">— top level —</option>
                      {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                    <button onClick={() => { addSuggestion(sug.name, addParent); setAddingSuggestion(null); }} className="text-xs px-2 py-1 rounded flex-shrink-0" style={{ background: C.accent, color: C.onDark }}>Add</button>
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Dictionaries (Suppliers / Kraje) ═══════════════════
function DictionaryPage({ s, set, listKey, title, hint, placeholder, usageOf }) {
  const [name, setName] = useState(""); const [sel, setSel] = useBackSel("dictSel", null);
  const items = s[listKey] || [];
  const rich = listKey === "suppliers";
  const item = rich && items.find(i => i.id === sel);
  const patchItem = (id, ch) => set(x => ({ ...x, [listKey]: x[listKey].map(i => i.id === id ? { ...i, ...ch } : i) }));
  const FIELDS = [["contactPerson", "Contact person", "e.g. Jan de Vries"], ["email", "E-mail", "quality@supplier.com"], ["phone", "Phone", "+31 …"], ["address", "Address", "street, city, country"]];
  const add = () => { if (!name.trim()) return; set(x => ({ ...x, [listKey]: [...(x[listKey] || []), { id: uid(), name: name.trim() }] })); setName(""); };
  const remove = id => set(x => ({ ...x, [listKey]: x[listKey].filter(i => i.id !== id), products: listKey === "suppliers" ? x.products.map(p => ({ ...p, supplierIds: (p.supplierIds || []).filter(q => q !== id) })) : x.products }));
  return (
    <div>
      <h1 className="mb-1">{title}</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>{hint}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <Card>
          {items.length === 0 ? <Empty icon="📖" title="The list is empty" hint="Add entries on the right. This list is shared by the whole system." /> : items.map(i => { const u = usageOf ? usageOf(i.id) : 0; const on = sel === i.id; return <div key={i.id} onClick={() => rich && setSel(on ? null : i.id)} className={`flex items-center gap-2 py-2 px-2 rounded-lg ${rich ? "cursor-pointer row" : ""}`} style={{ borderTop: `1px solid ${C.line}`, background: on ? C.accentSoft : "transparent" }}><span className="flex-1 min-w-0"><span className="block text-sm truncate" style={{ color: on ? C.accent : C.ink }}>{i.name}</span>{rich && (i.contactPerson || i.email || i.phone) && <span className="block text-[11px] truncate" style={{ color: C.muted }}>{[i.contactPerson, i.email, i.phone].filter(Boolean).join(" · ")}</span>}</span>{usageOf && <span className="text-xs" style={{ color: C.muted }}>{u} prod.</span>}<button onClick={e => { e.stopPropagation(); remove(i.id); }} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>; })}
        </Card>
        {item ? (
          <Card>
            <p className="font-medium text-sm mb-1">{item.name}</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>Only the name is required — everything else is optional and can be filled in later. Used on the PDF report and for supplier claims.</p>
            <label className="text-xs" style={{ color: C.muted }}>Name<input value={item.name} onChange={e => patchItem(item.id, { name: e.target.value })} className="w-full text-sm mt-1 mb-2" /></label>
            {FIELDS.map(([k, l, ph]) => <label key={k} className="text-xs block" style={{ color: C.muted }}>{l}<input value={item[k] || ""} onChange={e => patchItem(item.id, { [k]: e.target.value })} placeholder={ph} className="w-full text-sm mt-1 mb-2" /></label>)}
            <div className="flex items-center gap-3 mt-1"><button onClick={() => setSel(null)} className="text-xs" style={{ color: C.muted }}>close</button><span className="text-[11px]" style={{ color: C.muted }}>{usageOf ? `${usageOf(item.id)} products` : ""}</span></div>
          </Card>
        ) : (
        <Card>
          <p className="font-medium text-sm mb-3">New entry</p>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder={placeholder} className="w-full text-sm rounded px-2 py-1.5 outline-none mb-3" style={{ ...inp }} />
          <Primary onClick={add}>Add</Primary>
          {rich && <p className="text-xs mt-3" style={{ color: C.muted }}>Click a supplier on the left to add contact details.</p>}
        </Card>
        )}
      </div>
    </div>
  );
}

// Plain styled input, plus the label/grid wrappers around it. All three are defined at module scope (not inside a
// component body) so they keep a stable identity across renders — a component re-created on every render gets
// remounted by React on every state change, which drops focus out of whatever field you're typing in. That applies
// just as much to a wrapper like Field/Group as to the input itself: if the wrapper's identity changes, React tears
// down everything inside it, input included, even though the input's own identity didn't change.
const Field = ({ label, hint, children, className = "" }) => <label className={`block min-w-0 ${className}`}><span className="block text-[11px] font-medium mb-1" style={{ color: C.muted, letterSpacing: ".01em" }}>{label}</span>{children}{hint && <span className="block text-[11px] mt-1" style={{ color: C.muted }}>{hint}</span>}</label>;
const Group = ({ title, children, cols = 3 }) => <div className="mb-4"><p className="text-[11px] font-semibold uppercase mb-2" style={{ color: C.muted, letterSpacing: ".06em" }}>{title}</p><div className="grid gap-x-3 gap-y-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{children}</div></div>;
const Input = props => <input {...props} className={`w-full text-[13px] rounded-md px-2 outline-none ${props.className || ""}`} style={{ ...inp, height: 32, ...(props.style || {}) }} />;
// Code fields (article ID, barcodes) are often filled by a handheld scanner, which "types" the whole code in a
// few milliseconds — far faster than a human. Binding straight to a per-keystroke commit would re-sort the whole
// catalog and queue a server sync on every single keystroke, and the app can't keep up: characters after the
// first get dropped. FastInput keeps keystrokes local (cheap) and only commits upstream after a short pause, on
// blur, or on Enter — so the scan lands intact, and manual typing still autosaves a moment after you stop.
// Also defined at module scope, for the same stable-identity reason as Input above.
const FastInput = ({ value, onCommit, ...props }) => {
  const [local, setLocal] = useState(value);
  const lastCommitted = useRef(value);
  const timerRef = useRef(null);
  useEffect(() => { if (value !== lastCommitted.current) { setLocal(value); lastCommitted.current = value; } }, [value]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const commit = v => { if (v !== lastCommitted.current) { lastCommitted.current = v; onCommit(v); } };
  return <Input {...props} value={local} onChange={e => { const v = e.target.value; setLocal(v); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => commit(v), 250); }} onBlur={e => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } commit(local); props.onBlur && props.onBlur(e); }} onKeyDown={e => { if (e.key === "Enter") { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } commit(local); e.currentTarget.blur(); } props.onKeyDown && props.onKeyDown(e); }} />;
};
// Same debounced-commit idea as FastInput, for a multi-line textarea (e.g. the reference-guide description).
const FastTextarea = ({ value, onCommit, className = "", ...props }) => {
  const [local, setLocal] = useState(value || "");
  const lastCommitted = useRef(value || "");
  const timerRef = useRef(null);
  useEffect(() => { if ((value || "") !== lastCommitted.current) { setLocal(value || ""); lastCommitted.current = value || ""; } }, [value]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const commit = v => { if (v !== lastCommitted.current) { lastCommitted.current = v; onCommit(v); } };
  return <textarea {...props} value={local} className={`w-full text-sm rounded-md px-2 py-1.5 outline-none ${className}`} style={{ ...inp, ...(props.style || {}) }} onChange={e => { const v = e.target.value; setLocal(v); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => commit(v), 250); }} onBlur={e => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } commit(local); props.onBlur && props.onBlur(e); }} />;
};

// ═══════════════════ STRONA: Products ═══════════════════
function ProductsPage({ s, set, sel, setSel, presetFilter, clearPreset, onMessage, onOpenInspection }) {
  const [d, setD] = useState({ name: "", articleId: "", categoryId: "", isBio: false, cusPerTu: "", piecesPerCu: "", weightPerCu: "" });
  const [filter, setFilter] = useState(""); const [importOpen, setImportOpen] = useState(false); const [importText, setImportText] = useState(""); const [importMsg, setImportMsg] = useState("");
  useEffect(() => { if (presetFilter) { setFilter(presetFilter); clearPreset && clearPreset(); } }, [presetFilter]);
  const [supQ, setSupQ] = useState("");
  const [tab, setTab] = useState("profile"); const [newOpen, setNewOpen] = useState(false);
  const [refPick, setRefPick] = useState(null);
  const [guideNew, setGuideNew] = useState(null); const [guidePick, setGuidePick] = useState(null); const [guideQ, setGuideQ] = useState("");
  const [refQ, setRefQ] = useState(""); const [refFilter, setRefFilter] = useState("all"); const [refShowHidden, setRefShowHidden] = useState(false);
  const [histResult, setHistResult] = useState("all"); const [histProblem, setHistProblem] = useState("");
  useEffect(() => { setTab("profile"); setRefPick(null); setHistResult("all"); setHistProblem(""); }, [sel]);
  const [varName, setVarName] = useState(""); const [varOpen, setVarOpen] = useState(false);
  const product = s.products.find(p => p.id === sel);
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "—"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const add = () => { if (!d.name.trim() || !d.categoryId) return; const id = uid(); set(x => ({ ...x, products: [...x.products, { id, name: d.name.trim(), articleId: d.articleId.trim(), categoryId: d.categoryId, isBio: d.isBio, cusPerTu: d.cusPerTu, piecesPerCu: d.piecesPerCu, weightPerCu: d.weightPerCu, specs: [], supplierIds: [], varieties: [] }] })); setD({ name: "", articleId: "", categoryId: "", isBio: false, cusPerTu: "", piecesPerCu: "", weightPerCu: "" }); setSel(id); };
  // Import of wklejonego arkusza: kolumna 1 = article ID, 2 = nazwa. Reszta celowo pomijana.
  const runImport = () => {
    const existing = new Set(s.products.map(p => p.articleId).filter(Boolean));
    const seen = new Set(); const rows = [];
    importText.split(/\r?\n/).forEach(line => {
      const cols = line.split("\t").map(c => c.trim());
      if (cols.length < 2 || !/^\d{5,}$/.test(cols[0])) return;
      const [id, name] = cols; if (!name || seen.has(id) || existing.has(id)) return;
      seen.add(id);
      rows.push({ id: uid(), articleId: id, name, categoryId: null, isBio: /\bbio\b/i.test(name), cusPerTu: "", piecesPerCu: "", weightPerCu: "", specs: [], supplierIds: [], varieties: [] });
    });
    set(x => ({ ...x, products: [...x.products, ...rows] }));
    setImportMsg(`Imported ${rows.length} products${existing.size ? ` (skipped ${[...seen].length - rows.length + 0} duplicates by ID)` : ""}. No category — assign them from the list.`);
    setImportText("");
  };
  const setCategory = (pid, cid) => set(x => ({ ...x, products: x.products.map(p => p.id === pid ? { ...p, categoryId: cid || null } : p) }));
  // Browse: category chips (a parent includes its children), bio / inactive toggles, sort. The bulk-assign below works on
  // whatever is visible, so "No category" + a search term + Assign is the fast way through a fresh import.
  const [catSel, setCatSel] = useState(""); const [onlyBio, setOnlyBio] = useState(false); const [showInactive, setShowInactive] = useState(false); const [sortBy, setSortBy] = useState("az");
  const inCat = (p, cid) => cid === "none" ? !p.categoryId : cid ? (p.categoryId === cid || s.categories.some(c => c.id === p.categoryId && c.parentId === cid)) : true;
  const roots = s.categories.filter(c => !c.parentId); const children = pid => s.categories.filter(c => c.parentId === pid);
  const countIn = cid => s.products.filter(p => inCat(p, cid) && (showInactive || p.isActive !== false)).length;
  const visible = s.products.filter(p => (showInactive || p.isActive !== false) && inCat(p, catSel) && (!onlyBio || p.isBio) && (!filter || (p.name + " " + (p.articleId || "")).toLowerCase().includes(filter.toLowerCase())))
    .sort((a, b) => sortBy === "az" ? a.name.localeCompare(b.name) : sortBy === "id" ? String(a.articleId || "").localeCompare(String(b.articleId || "")) : sortBy === "cat" ? catPath(a.categoryId).localeCompare(catPath(b.categoryId)) || a.name.localeCompare(b.name) : 0);
  const unassigned = s.products.filter(p => !p.categoryId).length;
  const [bulkCat, setBulkCat] = useState("");
  const visibleUnassigned = visible.filter(p => !p.categoryId);
  const assignVisible = () => { if (!bulkCat) return; const ids = new Set(visibleUnassigned.map(p => p.id)); set(x => ({ ...x, products: x.products.map(p => ids.has(p.id) ? { ...p, categoryId: bulkCat } : p) })); };
  // The profile panel lives at the top of the page — jump there whenever a different product is picked from the grid below.
  const selectProduct = id => { setSel(id); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} };
  const patchP = p => set(x => ({ ...x, products: x.products.map(q => q.id === product.id ? { ...q, ...p } : q) }));
  // Delete: always asks. History (inspections, flags) is never deleted with the product — it just loses the product name.
  const [confirmDel, setConfirmDel] = useState(false);
  const refsOf = pr => ({ inspections: s.inspections.filter(i => i.productId === pr.id).length, flags: (s.flags || []).filter(f => f.productId === pr.id).length, announcements: (s.announcements || []).filter(a => a.productId === pr.id).length });
  const deleteProduct = pr => { set(x => ({ ...x, products: x.products.filter(q => q.id !== pr.id), announcements: (x.announcements || []).filter(a => a.productId !== pr.id), templates: (x.templates || []).filter(t => !(t.scope === "Product" && t.productId === pr.id)) })); setConfirmDel(false); setSel(null); };
  useEffect(() => { setConfirmDel(false); }, [sel]);
  const removeSpec = id => set(x => ({ ...x, products: x.products.map(p => p.id === product.id ? { ...p, specs: p.specs.filter(q => q.id !== id) } : p), templates: x.templates.map(t => ({ ...t, fields: t.fields.map(f => f.specId === id ? { ...f, specId: null } : f) })) }));
  const toggleSup = id => patchP({ supplierIds: (product.supplierIds || []).includes(id) ? product.supplierIds.filter(x => x !== id) : [...(product.supplierIds || []), id] });
  const addVar = () => { if (!product || !varName.trim()) return; patchP({ varieties: [...(product.varieties || []), { id: uid(), name: varName.trim() }] }); setVarName(""); };
  const removeVar = id => patchP({ varieties: (product.varieties || []).filter(v => v.id !== id) });
  const allSup = s.suppliers || [];
  const visibleSup = allSup.filter(x => x.name.toLowerCase().includes(supQ.toLowerCase()));
  const thumb = pr => { const ph = asPhotoList(pr.photos)[0]; return ph ? <img src={ph.dataUrl} alt="" className="rounded-md object-cover flex-shrink-0" style={{ width: 30, height: 30 }} /> : <span className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: C.bg, color: C.muted }}><Ic i={Package} s={14} mr={0} /></span>; };
  const refCount = product ? (s.problemNotes || []).filter(n => n.productId === product.id && hasNoteContent(n)).length : 0;
  const histAll = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed" && countsAs(s, i)) : [];
  const histVerdict = histAll.filter(i => isVerdictType(s, i));
  const histInfo = histAll.filter(i => !isVerdictType(s, i));
  const tabs = product ? [["profile", "Profile"], ["photos", `Photos${asPhotoList(product.photos).length ? ` · ${asPhotoList(product.photos).length}` : ""}`], ["specs", `Specifications${effectiveSpecs(s, product).length ? ` · ${effectiveSpecs(s, product).length}` : ""}`], ["attrs", `Properties${effectiveAttributes(s, product).length ? ` · ${effectiveAttributes(s, product).length}` : ""}`], ["supply", `Suppliers${(product.supplierIds || []).length ? ` · ${(product.supplierIds || []).length}` : ""}`], ["reference", `Reference guide${refCount ? ` · ${refCount}` : ""}`], ["guide", `Encyclopedia${(product.guide || []).length ? ` · ${(product.guide || []).length}` : ""}`], ["history", `Inspection history${histAll.length ? ` · ${histAll.length}` : ""}`], ["policy", "Inspection types"]] : [];
  const missing = product ? [!product.articleId && "article ID", !product.barcodeCu && !product.barcodeTu && "barcode", !product.categoryId && "category", !asPhotoList(product.photos).length && "photo"].filter(Boolean) : [];
  return (
    <div>
      <div className="flex items-end gap-3 mb-4">
        <div className="flex-1"><h1>Products</h1><p className="text-sm mt-0.5" style={{ color: C.muted }}>{s.products.length} product{s.products.length === 1 ? "" : "s"}{unassigned ? ` · ${unassigned} without category` : ""} · changes save automatically</p></div>
        <button onClick={() => { setImportOpen(o => !o); setNewOpen(false); }} className="text-sm px-3 py-2 rounded-xl inline-flex items-center" style={{ background: importOpen ? C.ink : C.surface, color: importOpen ? C.onDark : C.ink, border: `1px solid ${importOpen ? C.ink : C.line}` }}><Ic i={Download} s={14} />Import list</button>
        <Primary onClick={() => { setNewOpen(o => !o); setImportOpen(false); }}><Ic i={Plus} s={14} />New product</Primary>
      </div>

      {newOpen && <Card style={{ marginBottom: 16 }}>
        <p className="font-medium text-sm mb-3">New product</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
          <Field label="Name *"><Input autoFocus value={d.name} onChange={e => setD(x => ({ ...x, name: e.target.value }))} placeholder="Merkloos Elstar appels 4 stuks" /></Field>
          <Field label="Article ID"><Input value={d.articleId} onChange={e => setD(x => ({ ...x, articleId: e.target.value }))} placeholder="90006122" className="font-mono" /></Field>
          <Field label="Category *"><select value={d.categoryId} onChange={e => setD(x => ({ ...x, categoryId: e.target.value }))} className="w-full text-[13px] rounded-md px-1.5 outline-none" style={{ ...inp, height: 32 }}><option value="">—</option>{s.categories.map(c => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}</select></Field>
        </div>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
          <Field label="CU per TU"><Input type="number" value={d.cusPerTu} onChange={e => setD(x => ({ ...x, cusPerTu: e.target.value }))} /></Field>
          <Field label="Pieces per CU"><Input type="number" value={d.piecesPerCu} onChange={e => setD(x => ({ ...x, piecesPerCu: e.target.value }))} /></Field>
          <Field label="Weight per CU (g)"><Input type="number" value={d.weightPerCu} onChange={e => setD(x => ({ ...x, weightPerCu: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-5"><input type="checkbox" checked={d.isBio} onChange={e => setD(x => ({ ...x, isBio: e.target.checked }))} />Bio</label>
        </div>
        <div className="flex gap-2 mt-4"><Primary onClick={() => { add(); setNewOpen(false); }} disabled={!d.name.trim() || !d.categoryId}>Create product</Primary><button onClick={() => setNewOpen(false)} className="text-sm px-3" style={{ color: C.muted }}>Cancel</button></div>
      </Card>}

      {importOpen && <Card style={{ marginBottom: 16 }}>
        <p className="font-medium text-sm mb-1">Import a product list</p>
        <p className="text-xs mb-2" style={{ color: C.muted }}>Paste rows from a sheet: <b>article ID</b> in the first column, <b>name</b> in the second (tab-separated). Existing IDs are skipped. For more columns (barcodes, CU/TU, category) use Integrations → product profiles sheet.</p>
        <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={6} placeholder={"90006058\tMerkloos Blauwe bessen 125 gram"} className="w-full text-xs rounded-lg px-2.5 py-2 outline-none font-mono mb-2" style={{ ...inp }} />
        <div className="flex items-center gap-2"><Primary small onClick={runImport} disabled={!importText.trim()}>Import</Primary><button onClick={() => setImportOpen(false)} className="text-xs px-2" style={{ color: C.muted }}>Close</button>{importMsg && <span className="text-xs" style={{ color: C.accent }}>{importMsg}</span>}</div>
      </Card>}

      {/* Selected product: full profile panel, always on top */}
      <div className="mb-4">
        {!product ? <Card><Empty icon="📦" title="Select a product" hint="Its profile, photos, specifications, suppliers and inspection types open here." /></Card> : (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div className="flex items-center gap-3 px-4 pt-4 pb-3">
                {asPhotoList(product.photos)[0] ? <img src={asPhotoList(product.photos)[0].dataUrl} alt="" className="rounded-lg object-contain flex-shrink-0" style={{ width: 52, height: 52, background: PHOTO_BG }} /> : <button onClick={() => setTab("photos")} className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, background: C.bg, color: C.muted, border: `1px dashed ${C.line}` }}><Ic i={ImageIcon} s={18} mr={0} /></button>}
                <div className="flex-1 min-w-0">
                  <h2 className="truncate" style={{ fontSize: 16 }}>{product.name}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{product.articleId || "no ID"}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}`, color: product.categoryId ? C.ink : C.warn }}>{product.categoryId ? catPath(product.categoryId) : "no category"}</span>
                    {product.isBio && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>bio</span>}
                    {product.isActive === false && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.line, color: C.muted }}>inactive</span>}
                    {missing.length > 0 && <span className="text-[11px]" style={{ color: C.warn }}>· missing: {missing.join(", ")}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {onMessage && <button onClick={() => onMessage({ kind: "product", id: product.id })} className="text-xs px-2.5 py-1 rounded-md inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={MessageSquare} s={13} />Message</button>}
                  <button onClick={() => patchP({ isActive: product.isActive === false })} className="text-xs px-2.5 py-1 rounded-md" style={{ border: `1px solid ${C.line}` }}>{product.isActive === false ? "Activate" : "Deactivate"}</button>
                  <button onClick={() => setConfirmDel(true)} className="text-xs px-2.5 py-1 rounded-md" style={{ color: C.bad, border: `1px solid ${C.line}` }}>Delete</button>
                </div>
              </div>
              {confirmDel && (() => { const r = refsOf(product); const any = r.inspections + r.flags + r.announcements; return (
                <div className="mx-5 mb-4 rounded-xl p-3" style={{ background: C.badBg, border: `1px solid ${C.bad}` }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: C.bad }}>Delete “{product.name}”?</p>
                  <p className="text-xs mb-2" style={{ color: C.ink }}>{any ? <>It has <b>{r.inspections} inspection{r.inspections === 1 ? "" : "s"}</b>, {r.flags} flag{r.flags === 1 ? "" : "s"} and {r.announcements} announcement{r.announcements === 1 ? "" : "s"}. Inspections and flags are kept for history but lose the product name; announcements are removed. If the product is just no longer stocked, <b>deactivating</b> keeps everything intact.</> : "Nothing else references it. This cannot be undone."}</p>
                  <div className="flex gap-2"><button onClick={() => deleteProduct(product)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.bad, color: C.onDark }}>Delete permanently</button>{any > 0 && product.isActive !== false && <button onClick={() => { patchP({ isActive: false }); setConfirmDel(false); }} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Deactivate instead</button>}<button onClick={() => setConfirmDel(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted }}>Cancel</button></div>
                </div>); })()}
              <div className="flex gap-0.5 px-4 overflow-x-auto" style={{ borderBottom: `1px solid ${C.line}` }}>
                {tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="text-[13px] px-2.5 py-2 -mb-px whitespace-nowrap" style={{ color: tab === k ? C.ink : C.muted, fontWeight: tab === k ? 600 : 400, borderBottom: `2px solid ${tab === k ? C.ink : "transparent"}` }}>{l}</button>)}
              </div>
              <div className="px-4 py-4">
                {tab === "profile" && <div style={{ maxWidth: 760 }}>
                  <Group title="Identity" cols={6}>
                    <Field label="Name" className="col-span-4"><FastInput value={product.name} onCommit={v => patchP({ name: v })} /></Field>
                    <Field label="Article ID"><FastInput value={product.articleId || ""} onCommit={v => patchP({ articleId: v })} className="font-mono" style={{ borderColor: product.articleId ? C.line : C.warn }} /></Field>
                    <Field label="Bio"><button onClick={() => patchP({ isBio: !product.isBio })} className="w-full text-[13px] rounded-md" style={{ height: 32, border: `1px solid ${product.isBio ? C.ok : C.line}`, background: product.isBio ? C.okBg : C.surface, color: product.isBio ? C.ok : C.muted }}>{product.isBio ? "bio" : "no"}</button></Field>
                    <Field label="Category" className="col-span-3"><select value={product.categoryId || ""} onChange={e => patchP({ categoryId: e.target.value || null })} className="w-full text-[13px] rounded-md px-1.5 outline-none" style={{ ...inp, height: 32, borderColor: product.categoryId ? C.line : C.warn }}><option value="">—</option>{s.categories.map(c => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}</select></Field>
                    <Field label="Consumer app link" className="col-span-3"><FastInput value={product.consumerAppUrl || ""} onCommit={v => patchP({ consumerAppUrl: v })} placeholder="https://…" /></Field>
                  </Group>
                  <Group title="Codes" cols={2}>
                    <Field label="Barcode CU · consumer pack"><FastInput value={product.barcodeCu || ""} onCommit={v => patchP({ barcodeCu: v })} className="font-mono" style={{ borderColor: product.barcodeCu || product.barcodeTu ? C.line : C.warn }} /></Field>
                    <Field label="Barcode TU · box / case"><FastInput value={product.barcodeTu || ""} onCommit={v => patchP({ barcodeTu: v })} className="font-mono" style={{ borderColor: product.barcodeCu || product.barcodeTu ? C.line : C.warn }} /></Field>
                    {!product.barcodeCu && !product.barcodeTu && <p className="text-[11px] col-span-2 -mt-1" style={{ color: C.warn }}>At least one barcode — the scanner matches on it.</p>}
                  </Group>
                  <Group title="Packaging" cols={3}>
                    <Field label="CU per TU"><FastInput type="number" value={product.cusPerTu || ""} onCommit={v => patchP({ cusPerTu: v })} /></Field>
                    <Field label="Pieces per CU"><FastInput type="number" value={product.piecesPerCu || ""} onCommit={v => patchP({ piecesPerCu: v })} /></Field>
                    <Field label="Weight per CU · g"><FastInput type="number" value={product.weightPerCu || ""} onCommit={v => patchP({ weightPerCu: v })} /></Field>
                  </Group>
                </div>}
                {tab === "photos" && <div style={{ maxWidth: 720 }}>
                  <p className="text-xs mb-3" style={{ color: C.muted }}>The first photo is the product's picture on the phone. Controllers compare the pallet to it.</p>
                  <PhotoStrip photos={product.photos} onAdd={got => patchP({ photos: [...asPhotoList(product.photos), ...got] })} onRemove={id => patchP({ photos: asPhotoList(product.photos).filter(x => x.id !== id) })} />
                </div>}
                {tab === "specs" && <div style={{ maxWidth: 720 }}>
                  <SpecForm sctx={s} specs={product.specs} inherited={effectiveSpecs(s, product).filter(q => q.source !== "product")} onAdd={q => patchP({ specs: [...product.specs, q] })} onRemove={removeSpec} excluded={product.excludedSpecNames || []} onExclude={n => patchP({ excludedSpecNames: [...(product.excludedSpecNames || []), n] })} onRestore={n => patchP({ excludedSpecNames: (product.excludedSpecNames || []).filter(x => x !== n) })} hint="Own specifications override inherited ones of the same name. Most belong on the category — only exceptions here." />
                </div>}
                {tab === "attrs" && <div style={{ maxWidth: 720 }}>
                  <AttributeForm s={s} own={product.attributes || []} inherited={effectiveAttributes(s, product).filter(a => a.source !== "product")} onSet={a => patchP({ attributes: [...(product.attributes || []).filter(x => x.dictionaryId !== a.dictionaryId), a] })} onRemove={did => patchP({ attributes: (product.attributes || []).filter(x => x.dictionaryId !== did) })} hint="Values from Lists. Own values override the category's; they pre-fill form fields bound to the same list." />
                </div>}
                {tab === "supply" && <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 1fr", maxWidth: 800 }}>
                  <div>
                    <p className="text-sm font-medium mb-1">Suppliers</p>
                    <p className="text-xs mb-2" style={{ color: C.muted }}>Narrows the choice during inspection. None assigned = all suppliers offered.</p>
                    {allSup.length === 0 ? <p className="text-xs" style={{ color: C.warn }}>The supplier list is empty — add them in Dictionaries → Suppliers.</p> : <>
                      {(product.supplierIds || []).length > 0 && <div className="flex flex-wrap gap-1.5 mb-2">{product.supplierIds.map(id => { const sup = allSup.find(x => x.id === id); return sup && <span key={id} className="text-xs px-2 py-1 rounded-full flex items-center gap-1" style={{ background: C.accentSoft, color: C.accent }}>{sup.name}<button onClick={() => toggleSup(id)} style={{ color: C.accent }}>×</button></span>; })}</div>}
                      <Input value={supQ} onChange={e => setSupQ(e.target.value)} placeholder="Search suppliers" className="mb-1.5" />
                      <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>{visibleSup.map(x => <label key={x.id} className="flex items-center gap-2 text-sm px-2.5 py-1.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={(product.supplierIds || []).includes(x.id)} onChange={() => toggleSup(x.id)} />{x.name}</label>)}</div>
                    </>}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Varieties</p>
                    <p className="text-xs mb-2" style={{ color: C.muted }}>Own varieties add to the category's.</p>
                    <div className="flex gap-1.5 mb-2"><Input value={varName} onChange={e => setVarName(e.target.value)} onKeyDown={e => e.key === "Enter" && addVar()} placeholder="e.g. Duke" /><Primary small onClick={addVar} disabled={!varName.trim()}>Add</Primary></div>
                    {(product.varieties || []).map(v => <div key={v.id} className="flex items-center gap-2 text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{v.name}</span><button onClick={() => removeVar(v.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>)}
                    {effectiveVarieties(s, product).filter(v => v.source !== "product").length > 0 && <><p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>inherited</p>{effectiveVarieties(s, product).filter(v => v.source !== "product").map(v => <div key={v.id} className="text-sm py-1.5" style={{ borderTop: `1px solid ${C.line}`, opacity: .65 }}>{v.name} <span className="text-xs" style={{ color: C.muted }}>· {v.source}</span></div>)}</>}
                  </div>
                </div>}
                {tab === "reference" && (() => {
                  // Scoped-to-this-product and scoped-to-its-category remarks are what the Head actually came here for —
                  // put them first, ahead of the (often much longer) global catalog, so they aren't buried in a wall of cards.
                  const chain = categoryChainIds(s, product.categoryId);
                  const refProblems = problemsFor(s, { kind: "Product", id: product.id });
                  const scopeRank = p => p.productId ? 0 : p.categoryId ? 1 : 2;
                  const scopeLabel = p => p.productId ? "this product" : p.categoryId ? `category: ${s.categories.find(c => c.id === p.categoryId)?.name || "?"}` : "global";
                  const leaves = refProblems.filter(p => isLeaf(refProblems, p.id))
                    .sort((a, b) => scopeRank(a) - scopeRank(b) || problemPath(refProblems, a.id).localeCompare(problemPath(refProblems, b.id)));
                  const counts = leaves.reduce((acc, p) => { const k = p.productId ? "product" : p.categoryId ? "category" : "global"; acc[k]++; return acc; }, { product: 0, category: 0, global: 0 });
                  // Anything hidden for this product OR anywhere in its category chain never reaches problemsFor at all (same
                  // rule that hides it from controllers during a real inspection) — surface it here so "it's missing" is never
                  // a mystery: it's either not scoped to this product/category, or it was explicitly hidden and can be restored.
                  const hiddenEntries = [];
                  chain.forEach(cid => { const cat = s.categories.find(c => c.id === cid); (cat?.hiddenProblemIds || []).forEach(id => { const node = s.problems.find(p => p.id === id); if (node && isLeaf(s.problems, node.id)) hiddenEntries.push({ node, holderType: "category", holderId: cid, holderName: cat.name }); }); });
                  (product.hiddenProblemIds || []).forEach(id => { const node = s.problems.find(p => p.id === id); if (node && isLeaf(s.problems, node.id)) hiddenEntries.push({ node, holderType: "product", holderId: product.id, holderName: product.name }); });
                  const unhideEntry = e => set(x => e.holderType === "category"
                    ? { ...x, categories: x.categories.map(c => c.id === e.holderId ? { ...c, hiddenProblemIds: (c.hiddenProblemIds || []).filter(id => id !== e.node.id) } : c) }
                    : { ...x, products: x.products.map(p => p.id === e.holderId ? { ...p, hiddenProblemIds: (p.hiddenProblemIds || []).filter(id => id !== e.node.id) } : p) });
                  const notes = (s.problemNotes || []).filter(n => n.productId === product.id);
                  const patchNote = (problemId, patch) => set(x => {
                    const list = x.problemNotes || [];
                    const idx = list.findIndex(n => n.productId === product.id && n.problemId === problemId);
                    if (idx === -1) return { ...x, problemNotes: [...list, { id: uid(), productId: product.id, problemId, description: "", photos: [], ...patch }] };
                    const next = [...list]; next[idx] = { ...next[idx], ...patch }; return { ...x, problemNotes: next };
                  });
                  const doneCount = leaves.filter(l => hasNoteContent(noteFor(notes, l.id))).length;
                  const selId = refPick && leaves.some(l => l.id === refPick) ? refPick : (leaves[0]?.id || null);
                  const selLeaf = leaves.find(l => l.id === selId);
                  const selNote = selLeaf ? noteFor(notes, selLeaf.id) : null;
                  const q = refQ.trim().toLowerCase();
                  const visible = leaves.filter(l => (!q || problemPath(refProblems, l.id).toLowerCase().includes(q)) && (refFilter === "all" || (refFilter === "done") === hasNoteContent(noteFor(notes, l.id))));
                  // Group the list by parent branch so 30 leaves read as a few short lists, not one long one.
                  const groups = []; visible.forEach(l => { const parent = l.parentId ? problemPath(refProblems, l.parentId) : "—"; let g = groups.find(x => x.key === parent); if (!g) { g = { key: parent, items: [] }; groups.push(g); } g.items.push(l); });
                  const idx = leaves.findIndex(l => l.id === selId); const prev = idx > 0 ? leaves[idx - 1] : null, next = idx >= 0 && idx < leaves.length - 1 ? leaves[idx + 1] : null;
                  const scopeChip = p => { const [bg, fg, l] = p.productId ? [C.okBg, C.ok, "this product"] : p.categoryId ? [C.accentSoft, C.accent, s.categories.find(c => c.id === p.categoryId)?.name || "category"] : [C.bg, C.muted, "global"]; return <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>{l}</span>; };
                  const pct = leaves.length ? Math.round(doneCount / leaves.length * 100) : 0;
                  return (
                    <div style={{ maxWidth: 960 }}>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <p className="text-xs" style={{ color: C.muted, maxWidth: 560 }}>What each problem looks like on <b>this product</b> — a short description and reference photos. Controllers see it during the inspection and on the phone's product profile.</p>
                        {leaves.length > 0 && <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: C.muted }}><span>{doneCount} of {leaves.length} filled in</span><span className="inline-block rounded-full overflow-hidden" style={{ width: 90, height: 6, background: C.line }}><span className="block h-full" style={{ width: `${pct}%`, background: C.ok }} /></span></div>}
                      </div>
                      {leaves.length === 0 ? <Empty icon="📖" title="No problem types apply to this product yet" hint="Add or scope them in Problem types (global, this category, or this product) — they will show up here to describe." /> : (
                        <div className="flex gap-4 items-start">
                          <aside className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 300, border: `1px solid ${C.line}`, background: C.surface }}>
                            <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                              <SearchBox value={refQ} onChange={setRefQ} placeholder="Search problem types" size={13} />
                              <div className="flex gap-1 mt-2">{[["all", `All · ${leaves.length}`], ["todo", `To fill · ${leaves.length - doneCount}`], ["done", `Filled · ${doneCount}`]].map(([k, l]) => <button key={k} onClick={() => setRefFilter(k)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: refFilter === k ? C.ink : C.bg, color: refFilter === k ? C.onDark : C.muted }}>{l}</button>)}</div>
                            </div>
                            <div style={{ maxHeight: 520, overflowY: "auto" }}>
                              {groups.length === 0 && <p className="text-xs p-3" style={{ color: C.muted }}>Nothing matches.</p>}
                              {groups.map(g => (
                                <div key={g.key}>
                                  <p className="label-sm px-3 pt-2.5 pb-1" style={{ color: C.muted }}>{g.key}</p>
                                  {g.items.map(l => { const n = noteFor(notes, l.id); const done = hasNoteContent(n); const ph = asPhotoList(n?.photos).length; const on = l.id === selId; return (
                                    <button key={l.id} onClick={() => setRefPick(l.id)} className="w-full text-left px-3 py-2 flex items-center gap-2" style={{ background: on ? C.accentSoft : "transparent", borderLeft: `3px solid ${on ? C.accent : "transparent"}` }}>
                                      <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 16, height: 16, background: done ? C.okBg : C.bg, color: done ? C.ok : C.line, border: `1px solid ${done ? C.ok : C.line}` }}>{done && <Check size={10} strokeWidth={3} />}</span>
                                      <span className="flex-1 min-w-0"><span className="block text-sm truncate" style={{ fontWeight: on ? 600 : 450 }}>{l.name}</span>{ph > 0 && <span className="block text-[10px]" style={{ color: C.muted }}><Ic i={Camera} s={10} mr={3} />{ph} photo{ph === 1 ? "" : "s"}</span>}</span>
                                      {scopeChip(l)}
                                    </button>); })}
                                </div>
                              ))}
                              {hiddenEntries.length > 0 && (
                                <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                                  <button onClick={() => setRefShowHidden(v => !v)} className="text-[11px]" style={{ color: C.muted }}>{hiddenEntries.length} hidden for this product {refShowHidden ? "▾" : "▸"}</button>
                                  {refShowHidden && <div className="mt-1.5 flex flex-col gap-1">{hiddenEntries.map(e => <div key={e.holderType + e.holderId + e.node.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate" style={{ color: C.muted }}>{e.node.name} <span className="text-[10px]">· hidden on {e.holderType === "category" ? e.holderName : "this product"}</span></span><button onClick={() => unhideEntry(e)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ border: `1px solid ${C.line}` }}>restore</button></div>)}</div>}
                                </div>
                              )}
                            </div>
                          </aside>
                          <div className="flex-1 min-w-0">
                            {selLeaf ? (
                              <div className="rounded-xl p-4" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
                                <div className="flex items-start gap-3 mb-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] mb-0.5 truncate" style={{ color: C.muted }}>{selLeaf.parentId ? problemPath(refProblems, selLeaf.parentId) : "Top level"}</p>
                                    <h3 className="text-lg font-semibold leading-tight">{selLeaf.name}</h3>
                                  </div>
                                  {scopeChip(selLeaf)}
                                </div>
                                <p className="label-sm mb-1" style={{ color: C.muted }}>How to recognise it on this product</p>
                                <FastTextarea key={selLeaf.id} value={selNote?.description || ""} onCommit={v => patchNote(selLeaf.id, { description: v })} rows={5} placeholder="What it looks like, where it usually appears, how to tell it from something harmless, when it is serious enough to reject…" className="mb-4" style={{ resize: "vertical" }} />
                                <p className="label-sm mb-1" style={{ color: C.muted }}>Reference photos {asPhotoList(selNote?.photos).length > 0 && `· ${asPhotoList(selNote?.photos).length}`}</p>
                                <PhotoStrip photos={selNote?.photos} onAdd={got => patchNote(selLeaf.id, { photos: [...asPhotoList(selNote?.photos), ...got] })} onRemove={id => patchNote(selLeaf.id, { photos: asPhotoList(selNote?.photos).filter(x => x.id !== id) })} size={96} />
                                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                                  <button onClick={() => prev && setRefPick(prev.id)} disabled={!prev} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line }}>← {prev ? prev.name : "previous"}</button>
                                  <button onClick={() => next && setRefPick(next.id)} disabled={!next} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line }}>{next ? next.name : "next"} →</button>
                                  <span className="flex-1" />
                                  {hasNoteContent(selNote) && <button onClick={() => { if (window.confirm(`Clear the description and photos for “${selLeaf.name}”?`)) patchNote(selLeaf.id, { description: "", photos: [] }); }} className="text-xs" style={{ color: C.muted }}>Clear entry</button>}
                                </div>
                              </div>
                            ) : <Empty icon="👈" title="Pick a problem type" hint="Choose one on the left to describe it." />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {tab === "guide" && (() => {
                  // Product encyclopedia: free-form knowledge about the product — what a good one looks like, packaging,
                  // label, ripeness stages, typical faults — as named entries with text and photos. Controllers read it on
                  // the phone (product profile). Same two-pane layout as the Reference guide: entries on the left, one
                  // editor on the right. Edits go through set(x => …) on the product id so they replay safely.
                  const entries = product.guide || [];
                  const updGuide = fn => set(x => ({ ...x, products: x.products.map(q => q.id === product.id ? { ...q, guide: fn(q.guide || []) } : q) }));
                  const addEntry = (title = "") => { const id = uid(); updGuide(g => [...g, { id, title, body: "", photos: [], createdAt: nowISO(), updatedAt: nowISO() }]); setGuidePick(id); setGuideNew(id); setGuideQ(""); };
                  const patchEntry = (id, ch) => updGuide(g => g.map(e => e.id === id ? { ...e, ...ch, updatedAt: nowISO() } : e));
                  const removeEntry = id => { const i = entries.findIndex(e => e.id === id); updGuide(g => g.filter(e => e.id !== id)); const rest = entries.filter(e => e.id !== id); setGuidePick(rest[Math.min(i, rest.length - 1)]?.id || null); };
                  const moveEntry = (id, dir) => updGuide(g => { const i = g.findIndex(e => e.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= g.length) return g; const n = [...g]; [n[i], n[j]] = [n[j], n[i]]; return n; });
                  const hasContent = e => !!((e.title || "").trim() || (e.body || "").trim() || asPhotoList(e.photos).length);
                  const photoTotal = entries.reduce((a, e) => a + asPhotoList(e.photos).length, 0);
                  const selId = guidePick && entries.some(e => e.id === guidePick) ? guidePick : (entries[0]?.id || null);
                  const sel = entries.find(e => e.id === selId);
                  const q = guideQ.trim().toLowerCase();
                  const visible = entries.filter(e => !q || `${e.title || ""} ${e.body || ""}`.toLowerCase().includes(q));
                  const idx = entries.findIndex(e => e.id === selId); const prev = idx > 0 ? entries[idx - 1] : null, next = idx >= 0 && idx < entries.length - 1 ? entries[idx + 1] : null;
                  const STARTERS = ["What a good pallet looks like", "Label and packaging", "Ripeness stages", "Storage and temperature", "Typical faults", "Calibre and sizing"];
                  const starters = STARTERS.filter(t => !entries.some(e => (e.title || "").trim().toLowerCase() === t.toLowerCase()));
                  const snippet = e => (e.body || "").replace(/\s+/g, " ").trim().slice(0, 70);
                  return (
                    <div style={{ maxWidth: 960 }}>
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <p className="text-xs" style={{ color: C.muted, maxWidth: 560 }}>Everything a controller should know about <b>this product</b> — what a good one looks like, packaging and label, ripeness, storage, typical faults. Each entry has a name, a description and photos; controllers read it on the phone's product profile and during the inspection.</p>
                        {entries.length > 0 && <span className="ml-auto text-xs" style={{ color: C.muted }}>{entries.length} entr{entries.length === 1 ? "y" : "ies"} · {photoTotal} photo{photoTotal === 1 ? "" : "s"}</span>}
                      </div>
                      {entries.length === 0 ? (
                        <div className="rounded-xl p-5" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
                          <Empty icon="📖" title="No encyclopedia entries yet" hint="Start with one of the usual topics or write your own." />
                          <div className="flex gap-1.5 flex-wrap justify-center mt-2">{starters.map(t => <button key={t} onClick={() => addEntry(t)} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}><Ic i={Plus} s={11} mr={3} />{t}</button>)}<button onClick={() => addEntry("")} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: C.ink, color: C.onDark }}><Ic i={Plus} s={11} mr={3} />Own entry</button></div>
                        </div>
                      ) : (
                        <div className="flex gap-4 items-start">
                          <aside className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 300, border: `1px solid ${C.line}`, background: C.surface }}>
                            <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
                              <div className="flex gap-2"><div className="flex-1 min-w-0"><SearchBox value={guideQ} onChange={setGuideQ} placeholder="Search entries" size={13} /></div><Primary small onClick={() => addEntry("")}><Ic i={Plus} s={13} />Add</Primary></div>
                            </div>
                            <div style={{ maxHeight: 520, overflowY: "auto" }}>
                              {visible.length === 0 && <p className="text-xs p-3" style={{ color: C.muted }}>Nothing matches.</p>}
                              {visible.map(e => { const ph = asPhotoList(e.photos).length; const on = e.id === selId; const n = entries.indexOf(e) + 1; return (
                                <button key={e.id} onClick={() => setGuidePick(e.id)} className="w-full text-left px-3 py-2 flex items-start gap-2" style={{ background: on ? C.accentSoft : "transparent", borderLeft: `3px solid ${on ? C.accent : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
                                  <span className="text-[10px] mt-0.5 flex-shrink-0 inline-flex items-center justify-center rounded-md" style={{ width: 18, height: 18, background: hasContent(e) ? C.bg : C.warnBg, color: hasContent(e) ? C.muted : C.warn, fontVariantNumeric: "tabular-nums" }}>{n}</span>
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm truncate" style={{ fontWeight: on ? 600 : 450, color: e.title ? C.ink : C.muted, fontStyle: e.title ? "normal" : "italic" }}>{e.title || "Untitled entry"}</span>
                                    {(snippet(e) || ph > 0) && <span className="block text-[11px] truncate" style={{ color: C.muted }}>{ph > 0 && <><Ic i={Camera} s={10} mr={3} />{ph}{snippet(e) ? " · " : ""}</>}{snippet(e)}</span>}
                                  </span>
                                </button>); })}
                              {starters.length > 0 && !q && (
                                <div className="px-3 py-2.5">
                                  <p className="label-sm mb-1.5" style={{ color: C.muted }}>Suggested topics</p>
                                  <div className="flex gap-1 flex-wrap">{starters.map(t => <button key={t} onClick={() => addEntry(t)} className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>+ {t}</button>)}</div>
                                </div>
                              )}
                            </div>
                          </aside>
                          <div className="flex-1 min-w-0">
                            {sel ? (
                              <div className="rounded-xl p-4" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
                                <div className="flex items-center gap-3 mb-3">
                                  <p className="text-[11px]" style={{ color: C.muted }}>Entry {idx + 1} of {entries.length}</p>
                                  <span className="flex-1" />
                                  <button onClick={() => moveEntry(sel.id, -1)} disabled={!prev} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line }} title="Move up in the list">↑ up</button>
                                  <button onClick={() => moveEntry(sel.id, 1)} disabled={!next} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line }} title="Move down in the list">↓ down</button>
                                </div>
                                <p className="label-sm mb-1" style={{ color: C.muted }}>Entry name</p>
                                <FastInput key={sel.id + ":t"} autoFocus={guideNew === sel.id} value={sel.title || ""} onCommit={v => patchEntry(sel.id, { title: v })} placeholder="e.g. Label and packaging" className="mb-3 text-base font-semibold" style={{ height: 38 }} />
                                <p className="label-sm mb-1" style={{ color: C.muted }}>Description</p>
                                <FastTextarea key={sel.id + ":b"} value={sel.body || ""} onCommit={v => patchEntry(sel.id, { body: v })} rows={7} placeholder="What to look for, how to judge it, what is normal and what is not…" className="mb-4" style={{ resize: "vertical" }} />
                                <p className="label-sm mb-1" style={{ color: C.muted }}>Photos {asPhotoList(sel.photos).length > 0 && `· ${asPhotoList(sel.photos).length}`}</p>
                                <PhotoStrip photos={sel.photos} onAdd={got => patchEntry(sel.id, { photos: [...asPhotoList(sel.photos), ...got] })} onRemove={pid => patchEntry(sel.id, { photos: asPhotoList(sel.photos).filter(x => x.id !== pid) })} size={96} />
                                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                                  <button onClick={() => prev && setGuidePick(prev.id)} disabled={!prev} className="text-xs px-3 py-1.5 rounded-lg truncate" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line, maxWidth: 200 }}>← {prev ? (prev.title || "Untitled") : "previous"}</button>
                                  <button onClick={() => next && setGuidePick(next.id)} disabled={!next} className="text-xs px-3 py-1.5 rounded-lg truncate" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line, maxWidth: 200 }}>{next ? (next.title || "Untitled") : "next"} →</button>
                                  <span className="flex-1" />
                                  {sel.updatedAt && <span className="text-[10px]" style={{ color: C.muted }}>updated {fmtTime(sel.updatedAt)}</span>}
                                  <button onClick={() => { if (!hasContent(sel) || window.confirm(`Delete “${sel.title || "this entry"}”?`)) removeEntry(sel.id); }} className="text-xs" style={{ color: C.bad }}>Delete entry</button>
                                </div>
                              </div>
                            ) : <Empty icon="👈" title="Pick an entry" hint="Choose one on the left to edit it." />}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
                {tab === "history" && (() => {
                  const pm = byId(s.problems);
                  const acceptedCount = histVerdict.filter(i => i.result === "Accepted").length;
                  const rejectedCount = histVerdict.filter(i => i.result === "Rejected").length;
                  const resultFiltered = histResult === "all" ? histVerdict : histVerdict.filter(i => i.result === histResult);
                  const problemTally = Object.values(resultFiltered.flatMap(i => i.remarks || []).reduce((m, r) => { const name = pm[r.leafId]?.name || "?"; m[name] = m[name] || { name, count: 0 }; m[name].count++; return m; }, {})).sort((a, b) => b.count - a.count);
                  const rows = (histProblem ? resultFiltered.filter(i => (i.remarks || []).some(r => (pm[r.leafId]?.name || "?") === histProblem)) : resultFiltered)
                    .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
                  return (
                    <div style={{ maxWidth: 720 }}>
                      <p className="text-xs mb-3" style={{ color: C.muted }}>{histVerdict.length} completed inspection{histVerdict.length === 1 ? "" : "s"} with a verdict for this product — {acceptedCount} accepted, {rejectedCount} rejected{histInfo.length ? ` · ${histInfo.length} more without a verdict (visual / auto-accept checks)` : ""}.</p>
                      {histVerdict.length === 0 ? (
                        <Empty icon="📋" title="No inspections yet" hint="They'll show up here once a controller completes one for this product." />
                      ) : (
                        <>
                          <div className="flex gap-1.5 mb-3 flex-wrap">
                            {[["all", `all · ${histVerdict.length}`], ["Accepted", `accepted · ${acceptedCount}`], ["Rejected", `rejected · ${rejectedCount}`]].map(([k, l]) => (
                              <button key={k} onClick={() => { setHistResult(k); setHistProblem(""); }} className="text-xs px-2.5 py-1 rounded-full" style={{ background: histResult === k ? C.accent : C.accentSoft, color: histResult === k ? C.onDark : C.accent }}>{l}</button>
                            ))}
                          </div>
                          {problemTally.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <button onClick={() => setHistProblem("")} className="text-[11px] px-2 py-1 rounded-full" style={{ background: !histProblem ? C.ink : "transparent", color: !histProblem ? C.onDark : C.ink, border: `1px solid ${C.line}` }}>all remark types</button>
                              {problemTally.map(pr => <button key={pr.name} onClick={() => setHistProblem(pr.name)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: histProblem === pr.name ? C.ink : "transparent", color: histProblem === pr.name ? C.onDark : C.ink, border: `1px solid ${C.line}` }}>{pr.name} · {pr.count}</button>)}
                            </div>
                          )}
                          {rows.length === 0 ? <p className="text-xs py-4" style={{ color: C.muted }}>Nothing matches.</p> : rows.map(i => {
                            const [fg, bg] = i.result === "Accepted" ? [C.ok, C.okBg] : [C.bad, C.badBg];
                            const rem = (i.remarks || []).map(r => pm[r.leafId]?.name).filter(Boolean);
                            return (
                              <button key={i.id} onClick={() => onOpenInspection && onOpenInspection(i.id)} className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg row" style={{ borderTop: `1px solid ${C.line}` }}>
                                <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg, fontWeight: 500 }}>{i.result}</span>
                                <span className="flex-1 text-xs min-w-0 truncate" style={{ color: rem.length ? C.ink : C.muted }}>{rem.length ? rem.join(", ") : "no remarks"}</span>
                                <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{s.users.find(u => u.id === i.controllerId)?.name} · {fmtTime(i.completedAt)}</span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })()}
                {tab === "policy" && <div style={{ maxWidth: 720 }}>
                  <p className="text-xs mb-3" style={{ color: C.muted }}>Which inspection types a controller can start on this product. Inherited from the category / type settings unless overridden here.</p>
                  <PolicyEditor s={s} own={Array.isArray(product.allowedTypeIds) ? product.allowedTypeIds : null} inherited={effectivePolicy(s, { ...product, allowedTypeIds: undefined }).typeIds} inheritedSource={effectivePolicy(s, { ...product, allowedTypeIds: undefined }).source} onChange={v => patchP({ allowedTypeIds: v })} />
                </div>}
              </div>
            </Card>
        )}
      </div>

      {/* Below: browse & search all products, catalog-style like the mobile app */}
      <Card style={{ padding: 12 }}>
        <SearchBox value={filter} onChange={setFilter} placeholder="Search name or article ID" className="mb-2" inputClass="rounded-lg" size={13} />
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <select value={catSel} onChange={e => setCatSel(e.target.value)} className="text-[13px] rounded-md px-2 outline-none" style={{ ...inp, height: 32, minWidth: 180 }}>
            <option value="">All categories · {countIn("")}</option>
            {unassigned > 0 && <option value="none">No category · {countIn("none")}</option>}
            {roots.map(c => <option key={c.id} value={c.id}>{c.name} · {countIn(c.id)}</option>)}
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-[13px] rounded-md px-1.5 outline-none flex-shrink-0" style={{ ...inp, height: 32, width: 92 }}><option value="az">A–Z</option><option value="id">by ID</option><option value="cat">by cat.</option></select>
          <label className="flex items-center gap-1 cursor-pointer text-xs ml-1" style={{ color: C.muted }}><input type="checkbox" checked={onlyBio} onChange={e => setOnlyBio(e.target.checked)} />bio</label>
          <label className="flex items-center gap-1 cursor-pointer text-xs" style={{ color: C.muted }}><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />inactive</label>
          <span className="text-xs ml-auto" style={{ color: C.muted }}>{visible.length} of {s.products.length}</span>
        </div>
        {catSel && catSel !== "none" && children(catSel).length > 0 && <div className="flex flex-wrap gap-1.5 mb-2" style={{ maxHeight: 64, overflowY: "auto" }}>{children(catSel).map(c => <button key={c.id} onClick={() => setCatSel(c.id)} className="text-[11px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{c.name} · {countIn(c.id)}</button>)}</div>}
        {catSel && catSel !== "none" && s.categories.find(c => c.id === catSel)?.parentId && <p className="text-[11px] mb-2" style={{ color: C.muted }}>{catPath(catSel)} · <button onClick={() => setCatSel(s.categories.find(c => c.id === catSel).parentId)} className="underline">up</button></p>}
        {unassigned > 0 && catSel !== "none" && <button onClick={() => setCatSel("none")} className="w-full text-left text-xs rounded-lg px-2.5 py-2 mb-2" style={{ background: C.warnBg, color: C.warn }}>{unassigned} product{unassigned === 1 ? "" : "s"} without a category — they get no category specs. Show them →</button>}
        {catSel === "none" && unassigned > 0 && <CategorySuggestPanel s={s} set={set} products={s.products.filter(p => !p.categoryId)} />}
        {visibleUnassigned.length > 0 && (
          <div className="flex items-center gap-2 mb-2 rounded-lg p-2" style={{ background: C.accentSoft }}>
            <span className="text-xs whitespace-nowrap" style={{ color: C.accent }}>{visibleUnassigned.length} shown →</span>
            <select value={bulkCat} onChange={e => setBulkCat(e.target.value)} className="text-xs rounded px-1.5 py-1 outline-none flex-1 min-w-0" style={{ ...inp }}><option value="">assign category…</option>{s.categories.map(c => <option key={c.id} value={c.id}>{catPath(c.id)}</option>)}</select>
            <Primary small onClick={assignVisible} disabled={!bulkCat}>Assign</Primary>
          </div>
        )}
        {s.products.length === 0 ? <Empty icon="📦" title="No products yet" hint="Create one, import a list, or map a product sheet in Integrations." /> : visible.length === 0 ? <p className="text-xs py-6 text-center" style={{ color: C.muted }}>Nothing matches.</p> : (
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
            {visible.map(p => (
              <button key={p.id} onClick={() => selectProduct(p.id)} className="rounded-2xl p-2.5 text-left" style={{ background: sel === p.id ? C.accentSoft : C.surface, border: `1px solid ${sel === p.id ? C.accent : C.line}`, opacity: p.isActive === false ? .55 : 1 }}>
                {asPhotoList(p.photos).length ? <img src={asPhotoList(p.photos)[0].dataUrl} alt="" className="w-full rounded-xl object-contain mb-2" style={{ height: 72, background: PHOTO_BG }} /> : <div className="w-full rounded-xl flex items-center justify-center mb-2" style={{ height: 72, background: C.bg, color: C.muted }}><Ic i={Package} s={20} mr={0} /></div>}
                <p className="text-xs font-medium leading-tight truncate" style={{ color: sel === p.id ? C.accent : C.ink }}>{p.name}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: C.muted }}>{p.articleId || "no ID"} · {p.categoryId ? catPath(p.categoryId) : <span style={{ color: C.warn }}>no category</span>}</p>
                <div className="flex items-center gap-1 mt-1">
                  {p.isBio && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>bio</span>}
                  {p.isActive === false && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: C.line, color: C.muted }}>inactive</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function FieldEditor({ f, onPatch, onRemove, onMove, problems, specs, specsHint, dictionaries, sctxForNames }) {
  const arrows = <><button onClick={() => onMove(-1)} className="text-xs px-1" style={{ color: C.muted }} title="up">↑</button><button onClick={() => onMove(1)} className="text-xs px-1" style={{ color: C.muted }} title="down">↓</button></>;
  const leaves = problems.filter(p => isLeaf(problems, p.id));
  const setOpts = v => onPatch({ options: v });
  if (isSystem(f.type)) {
    const st = SYSTEM_TYPES[f.type];
    return (
      <div className="rounded-lg p-2.5 mb-1.5 flex items-center gap-2" style={{ background: C.accentSoft, border: `1px solid ${C.accentSoft}` }}>
        <span className="label-sm px-1.5 py-0.5 rounded" style={{ background: C.accent, color: C.onDark }}>system</span>
        <input value={f.label} onChange={e => onPatch({ label: e.target.value })} className="text-sm font-medium bg-transparent outline-none w-44" style={{ color: C.accent }} />
        <span className="flex-1 text-xs" style={{ color: C.muted }}>{st.desc}</span>
        {arrows}
        <button onClick={onRemove} className="text-xs px-1" style={{ color: C.muted }}>×</button>
      </div>
    );
  }
  // Still the builder's placeholder text (and no specification name to fall back to) — this exact label is what
  // will show up in the "Parameters" section of the PDF report, so make it impossible to miss here.
  const unrenamed = fieldLabel(f) === "New field";
  return (
    <div className="rounded-lg p-2.5 mb-1.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      <div className="flex items-center flex-wrap gap-2 mb-1.5">
        <select value={f.type} onChange={e => onPatch({ type: e.target.value })} className="text-xs rounded px-1.5 py-1 outline-none" style={{ ...inp }}>{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input value={f.label} onChange={e => onPatch({ label: e.target.value })} placeholder="field name — shown in the PDF" title={unrenamed ? "Still the default \"New field\" label — this is what will print on the report" : undefined} className="flex-1 text-sm rounded px-2 py-1 outline-none" style={{ ...inp, fontWeight: 500, minWidth: 140, borderColor: unrenamed ? C.warn : C.line }} />
        {unrenamed && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }} title="Rename it — this is what prints on the PDF">⚠ unnamed</span>}
        <input value={f.helper || ""} onChange={e => onPatch({ helper: e.target.value })} placeholder="helper text for the controller (optional)" title="FormField.HelperText" className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp, minWidth: 160 }} />
        {f.type === "Number" && <select value={f.measureBasis || "piece"} onChange={e => onPatch({ measureBasis: e.target.value })} title="what the controller measures — one piece or a whole CU" className="text-xs" style={{ minHeight: 28 }}><option value="piece">measure per piece</option><option value="cu">measure per CU</option></select>}
        {f.type === "Number" && <input value={f.key || ""} onChange={e => onPatch({ key: slugKey(e.target.value) || null })} placeholder={`key: ${metricKey(f)}`} title="FormField.Key — stable metric key for analytics across templates (defaults to the specification name)" className="w-28 text-xs rounded px-2 py-1 outline-none font-mono" style={{ ...inp }} />}
        <label className="flex items-center gap-1 text-xs" style={{ color: C.muted }}><input type="checkbox" checked={!!f.required} onChange={e => onPatch({ required: e.target.checked })} />req.</label>
        <label className="flex items-center gap-1 text-xs" style={{ color: f.allowPhotos ? C.accent : C.muted }} title="the controller can attach photos to this answer (InspectionPhoto.AnswerId)"><input type="checkbox" checked={!!f.allowPhotos} onChange={e => onPatch({ allowPhotos: e.target.checked })} />📷</label>
        {arrows}
        <button onClick={onRemove} className="text-xs px-1" style={{ color: C.muted }}>×</button>
      </div>
      {f.type === "List" && <div className="flex items-center gap-2 mb-1"><span className="text-xs" style={{ color: C.muted }}>list:</span><select value={f.dictionaryId || ""} onChange={e => onPatch({ dictionaryId: e.target.value || null })} className="text-xs" style={{ minHeight: 28 }}><option value="">— pick a list —</option>{(dictionaries || []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.items.length})</option>)}</select>{!(dictionaries || []).length && <span className="text-xs" style={{ color: C.warn }}>no lists yet — Dictionaries → Lists</span>}</div>}
      {f.type === "SingleChoice" && <input value={f.optionsRaw ?? (f.options || []).join(", ")} onChange={e => onPatch({ optionsRaw: e.target.value, options: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} placeholder="options separated by commas, e.g. Spain, Morocco" className="w-full text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} />}
      {f.type === "MultiChoice" && (
        <div>
          <p className="text-xs mb-1" style={{ color: C.muted }}><Ic i={Flag} s={12} mr={4} />= ticking immediately flags the inspection (TriggersGeneralProblem)</p>
          {(f.options || []).map((o, i) => <div key={i} className="flex items-center gap-1.5 mb-1"><input value={o.value} onChange={e => setOpts(f.options.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} /><label className="text-xs flex items-center gap-1" style={{ color: o.trigger ? C.warn : C.muted }}><input type="checkbox" checked={!!o.trigger} onChange={e => setOpts(f.options.map((x, j) => j === i ? { ...x, trigger: e.target.checked } : x))} />🚩</label><button onClick={() => setOpts(f.options.filter((_, j) => j !== i))} className="text-xs" style={{ color: C.muted }}>×</button></div>)}
          <button onClick={() => setOpts([...(f.options || []), { value: "new option", trigger: false }])} className="text-xs" style={{ color: C.accent }}>+ option</button>
        </div>
      )}
      {f.type === "Scale" && <span className="text-xs flex items-center gap-1" style={{ color: C.muted }}>max. <input type="number" value={f.scaleMax ?? 5} onChange={e => onPatch({ scaleMax: Number(e.target.value) || 5 })} className="w-10 rounded px-1 py-0.5 outline-none" style={{ ...inp }} /></span>}
      {f.type === "Number" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1">measurements <input type="number" value={f.measurementCount ?? 1} onChange={e => onPatch({ measurementCount: Number(e.target.value) || 1 })} className="w-16 rounded px-1.5 py-0.5 outline-none" style={{ ...inp }} /></span>
          <span className="flex items-center gap-1">specification by name: <input list={"spec-names-" + f.id} value={f.specName ?? ""} onChange={e => { const v = e.target.value; const patch = { specName: v }; if (v.trim() && (!f.label || !f.label.trim() || f.label.trim().toLowerCase() === "new field")) patch.label = v; onPatch(patch); }} onBlur={e => { if (sctxForNames && e.target.value.trim() && !nearSpecName(sctxForNames, e.target.value)) onPatch({ specName: canonicalSpecName(sctxForNames, e.target.value) }); }} placeholder={f.label} className="w-24 rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: (f.specName || "").trim() ? C.ok : C.line }} title="matches the product specification with this name; empty = field label. Also fills the label above, if it's still the default." /><datalist id={"spec-names-" + f.id}>{(sctxForNames ? specRegistry(sctxForNames) : []).map(e => <option key={e.name} value={e.name} />)}</datalist>{(() => { const n = sctxForNames ? nearSpecName(sctxForNames, f.specName || "") : null; return n ? <button onClick={() => onPatch({ specName: n.name })} className="text-[11px] underline ml-1" style={{ color: C.warn }}>did you mean {n.name}?</button> : null; })()}</span>
          {specs && <span className="flex items-center gap-1">or explicitly: <select value={f.specId || ""} onChange={e => { const specId = e.target.value || null; const patch = { specId }; if (specId && (!f.label || !f.label.trim() || f.label.trim().toLowerCase() === "new field")) { const sp = specs.find(sq => sq.id === specId); if (sp) patch.label = sp.name; } onPatch(patch); }} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: f.specId ? C.ok : C.line }}>
              <option value="">— by name —</option>{specs.map(q => <option key={q.id} value={q.id}>{q.name} ({specLabel(q)})</option>)}
            </select></span>}
          <span className="flex items-center gap-1">or min <input type="number" value={f.min ?? ""} onChange={e => onPatch({ min: e.target.value === "" ? null : e.target.value })} className="w-12 rounded px-1 py-0.5 outline-none" style={{ ...inp }} /> max <input type="number" value={f.max ?? ""} onChange={e => onPatch({ max: e.target.value === "" ? null : e.target.value })} className="w-12 rounded px-1 py-0.5 outline-none" style={{ ...inp }} /></span>
          <span className="flex items-center gap-1">below raises: <select value={f.problemBelowId || ""} onChange={e => onPatch({ problemBelowId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: f.problemBelowId ? C.accent : C.line }}><option value="">— warning —</option>{leaves.map(l => <option key={l.id} value={l.id}>{pathOf(problems, l.id)}</option>)}</select></span>
          <span className="flex items-center gap-1">above raises: <select value={f.problemAboveId || ""} onChange={e => onPatch({ problemAboveId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: f.problemAboveId ? C.accent : C.line }}><option value="">— warning —</option>{leaves.map(l => <option key={l.id} value={l.id}>{pathOf(problems, l.id)}</option>)}</select></span>
        </div>
      )}
    </div>
  );
}
function RefTree({ node, problems, overrides, onOverride, onHide, hidden, s }) {
  const d = depthOf(problems, node.id), eff = effTol(problems, overrides, node.id);
  const ov = overrides.find(o => o.problemTypeId === node.id);
  const catalogEff = effTol(problems, [], node.id);
  return (
    <div>
      <div className="flex items-center gap-2 py-1 text-sm flex-wrap" style={{ paddingLeft: d * 14, borderTop: `1px solid ${C.line}` }}>
        <span className="flex-1" style={{ fontWeight: d === 0 ? 600 : d === 1 ? 500 : 400 }}>{node.name}{s && scopeTag(node, s) && <span className="text-[10px] ml-1.5 px-1 rounded" style={{ background: C.warnBg, color: C.warn }}>{scopeTag(node, s)}</span>}</span>
        {onHide && d > 0 && <button onClick={() => onHide(node.id)} className="text-[10px] px-1" style={{ color: C.muted }} title="hide ten problem w tej warstwie">hide</button>}
        <span className="flex items-center gap-1 text-xs" style={{ color: C.muted }}>
          tol. <input type="number" value={ov?.tolerance ?? ""} onChange={e => onOverride(node.id, e.target.value)} placeholder={catalogEff !== null ? `(${catalogEff})` : "—"} className="w-12 text-right rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: ov ? C.accent : C.line, color: ov ? C.ink : C.muted }} title="empty = from catalog; type to override in this template" />%
          {ov && <span className="text-[10px]" style={{ color: C.accent }}>nadpisane</span>}{eff === 0 && "⚡"}
        </span>
      </div>
      {kidsOf(problems, node.id).map(k => <RefTree key={k.id} node={k} problems={problems} overrides={overrides} onOverride={onOverride} onHide={onHide} hidden={hidden} s={s} />)}
    </div>
  );
}
function InheritedFieldOverride({ f, own, problems, specs, onOverride, onReset }) {
  const leaves = problems.filter(p => isLeaf(problems, p.id));
  const ov = own?.fieldOverrides?.[f.id] || {};
  const has = Object.keys(ov).length > 0;
  if (f.type !== "Number") return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: C.muted }}>
      <span className="px-1 rounded" style={{ background: has ? C.accentSoft : "transparent", color: C.accent }}>{has ? "overridden here:" : "override here:"}</span>
      {specs && <span className="flex items-center gap-1">specification <select value={f.specId || ""} onChange={e => onOverride({ specId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: ov.specId !== undefined ? C.accent : C.line }}><option value="">— by name —</option>{specs.map(q => <option key={q.id} value={q.id}>{q.name} ({specLabel(q)})</option>)}</select></span>}
      <span className="flex items-center gap-1">below <select value={f.problemBelowId || ""} onChange={e => onOverride({ problemBelowId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: ov.problemBelowId !== undefined ? C.accent : C.line }}><option value="">—</option>{leaves.map(l => <option key={l.id} value={l.id}>{pathOf(problems, l.id)}</option>)}</select></span>
      <span className="flex items-center gap-1">above <select value={f.problemAboveId || ""} onChange={e => onOverride({ problemAboveId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: ov.problemAboveId !== undefined ? C.accent : C.line }}><option value="">—</option>{leaves.map(l => <option key={l.id} value={l.id}>{pathOf(problems, l.id)}</option>)}</select></span>
      {has && <button onClick={onReset} className="underline" style={{ color: C.muted }}>undo overrides</button>}
    </div>
  );
}

// Builder of one layer: eff = composition up to this layer inclusive; own = this layer's template (may be null = preview only)
function Builder({ eff, own, setOwn, problems, specs, specsHint, readOnly, s, scope }) {
  const catalog = problemsFor(s, scope);
  const modules = [...eff.modules].sort(bySort);
  const isOwn = item => own && item.ownerId === own.id;
  const up = fn => setOwn(x => fn(x));
  const patchModule = (id, p) => up(x => ({ ...x, modules: x.modules.map(m => m.id === id ? { ...m, ...p } : m) }));
  const addModule = () => up(x => ({ ...x, modules: [...x.modules, { id: uid(), name: "New module", sort: (Math.max(-1, ...eff.allModules.map(m => m.sort)) + 1) }] }));
  const removeOwnModule = id => up(x => ({ ...x, modules: x.modules.filter(m => m.id !== id), fields: x.fields.filter(f => f.moduleId !== id), problemRefs: x.problemRefs.filter(r => r.moduleId !== id) }));
  const suppress = id => up(x => ({ ...x, suppressed: [...new Set([...(x.suppressed || []), id])] }));
  const unsuppress = id => up(x => ({ ...x, suppressed: (x.suppressed || []).filter(i => i !== id) }));
  const addField = mid => up(x => ({ ...x, fields: [...x.fields, { id: uid(), moduleId: mid, sort: Math.max(-1, ...eff.allFields.filter(f => f.moduleId === mid).map(f => f.sort)) + 1, type: "Text", label: "New field", required: false, measurementCount: 1, problemBelowId: null, problemAboveId: null, specId: null, min: null, max: null }] }));
  const patchField = (id, p) => up(x => ({ ...x, fields: x.fields.map(f => f.id === id ? { ...f, ...p } : f) }));
  const removeOwnField = id => up(x => ({ ...x, fields: x.fields.filter(f => f.id !== id) }));
  const addSystem = (mid, type) => type && up(x => ({ ...x, fields: [...x.fields, { id: uid(), moduleId: mid, sort: Math.max(-1, ...eff.allFields.filter(f => f.moduleId === mid).map(f => f.sort)) + 1, type, label: SYSTEM_TYPES[type].label, required: !["Photos", "Escalate"].includes(type) }] }));
  const addRef = (mid, pid) => pid && up(x => ({ ...x, problemRefs: [...x.problemRefs, { id: uid(), moduleId: mid, problemTypeId: pid, sort: Math.max(-1, ...eff.allRefs.map(r => r.sort)) + 1 }] }));
  const removeOwnRef = id => up(x => ({ ...x, problemRefs: x.problemRefs.filter(r => r.id !== id) }));
  const setOverride = (pid, v) => up(x => ({ ...x, overrides: v === "" ? x.overrides.filter(o => o.problemTypeId !== pid) : [...x.overrides.filter(o => o.problemTypeId !== pid), { problemTypeId: pid, tolerance: v }] }));
  const setFieldOverride = (fid, patch) => up(x => ({ ...x, fieldOverrides: { ...(x.fieldOverrides || {}), [fid]: { ...((x.fieldOverrides || {})[fid] || {}), ...patch } } }));
  const resetFieldOverride = fid => up(x => { const fo = { ...(x.fieldOverrides || {}) }; delete fo[fid]; return { ...x, fieldOverrides: fo }; });
  // Reordering works on own and inherited items: own → sort directly; inherited → sort in this layer's overrides
  const moveItem = (key, id, dir) => {
    const list = eff[key]; const item = list.find(i => i.id === id); if (!item) return;
    const sib = list.filter(i => key === "modules" ? true : i.moduleId === item.moduleId).sort(bySort);
    const i = sib.findIndex(q => q.id === id), j = i + dir; if (j < 0 || j >= sib.length) return;
    const reordered = [...sib]; [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    up(x => {
      let nx = { ...x, fieldOverrides: { ...(x.fieldOverrides || {}) } };
      reordered.forEach((it, idx) => {
        if (it.ownerId === own.id) nx[key] = nx[key].map(q => q.id === it.id ? { ...q, sort: idx } : q);
        else if (it.sort !== idx) nx.fieldOverrides[it.id] = { ...(nx.fieldOverrides[it.id] || {}), sort: idx };
      });
      return nx;
    });
  };
  const usedIds = new Set(eff.problemRefs.map(r => r.problemTypeId));
  const usedSystem = new Set(eff.fields.filter(f => isSystem(f.type) && SYSTEM_TYPES[f.type].once).map(f => f.type));
  const hasProblems = eff.problemRefs.length > 0, hasSample = eff.fields.some(f => f.type === "SampleSize");
  const referenced = new Set(eff.problemRefs.flatMap(r => [...subtree(problems, r.problemTypeId)]));
  const orphanLinks = eff.fields.flatMap(f => f.type === "Number" ? [f.problemBelowId, f.problemAboveId].filter(id => id && !referenced.has(id)).map(id => ({ f, id })) : []);
  const pm = byId(problems);
  const hiddenIn = mid => [...eff.allFields.filter(f => f.moduleId === mid && eff.suppressed.has(f.id)), ...eff.allRefs.filter(r => r.moduleId === mid && eff.suppressed.has(r.id)).map(r => ({ ...r, label: pm[r.problemTypeId]?.name, isRef: true }))];
  const hiddenModules = eff.allModules.filter(m => eff.suppressed.has(m.id));
  const Tag = ({ item }) => isOwn(item) ? <span className="text-[10px] px-1 rounded" style={{ background: C.accentSoft, color: C.accent }}>own</span> : <span className="text-[10px] px-1 rounded" style={{ background: C.line, color: C.muted }}>from: {item.ownerLabel}</span>;
  return (
    <div style={readOnly ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
      {modules.length === 0 && <Note>The template has no modules yet. A module is a tab in the inspection — put fields, system blocks and problem branches from the catalog into it.</Note>}
      {modules.length > 0 && !hasProblems && <Note tone="warn">The form has <b>no problem branch</b> — the controller won't be able to report anything.</Note>}
      {hasProblems && !hasSample && <Note tone="warn">There are problem branches but no <b>Sample size</b> block — the percentage engine will have no divisor.</Note>}
      {orphanLinks.map(({ f, id }) => <Note key={f.id + id} tone="warn">Field “{f.label}“ raises problem <b>{pm[id]?.name}</b>, but no branch containing it is attached to a module.</Note>)}
      {modules.map((m, i) => (
        <div key={m.id} className="rounded-xl p-3 mb-3" style={{ background: C.surface, border: `1px solid ${isOwn(m) ? C.accent : C.line}` }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.accentSoft, color: C.accent }}>{i + 1}</span>
            {isOwn(m) ? <input value={m.name} onChange={e => patchModule(m.id, { name: e.target.value })} className="flex-1 text-sm font-semibold rounded px-2 py-1 outline-none" style={{ ...inp }} /> : <span className="flex-1 text-sm font-semibold px-2">{m.name}</span>}
            <Tag item={m} />
            {own && <><button onClick={() => moveItem("modules", m.id, -1)} className="text-xs px-1" style={{ color: C.muted }}>↑</button><button onClick={() => moveItem("modules", m.id, 1)} className="text-xs px-1" style={{ color: C.muted }}>↓</button></>}
            {isOwn(m) ? <button onClick={() => removeOwnModule(m.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button>
              : own && <button onClick={() => suppress(m.id)} className="text-xs px-1.5" style={{ color: C.muted }} title="hide the whole module at this level">hide</button>}
          </div>
          {eff.fields.filter(f => f.moduleId === m.id).sort(bySort).map(f => isOwn(f)
            ? <FieldEditor key={f.id} f={f} onPatch={p => patchField(f.id, p)} onRemove={() => removeOwnField(f.id)} onMove={dir => moveItem("fields", f.id, dir)} problems={problems} specs={specs} specsHint={specsHint} dictionaries={s.dictionaries || []} sctxForNames={s} />
            : (
              <div key={f.id} className="rounded-lg p-2.5 mb-1.5" style={{ background: C.bg, border: `1px dashed ${C.line}` }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{isSystem(f.type) ? "system" : FIELD_TYPES.find(([k]) => k === f.type)?.[1]}</span>
                  <Tag item={f} />
                  {f.overriddenBy && <span className="text-[10px] px-1 rounded" style={{ background: C.accentSoft, color: C.accent }}>overridden: {f.overriddenLabel}</span>}
                  <div className="flex-1" />
                  {own && <><button onClick={() => moveItem("fields", f.id, -1)} className="text-xs px-1" style={{ color: C.muted }}>↑</button><button onClick={() => moveItem("fields", f.id, 1)} className="text-xs px-1" style={{ color: C.muted }}>↓</button><button onClick={() => suppress(f.id)} className="text-xs px-1.5" style={{ color: C.muted }} title="hide at this level">hide</button></>}
                </div>
                {own && <InheritedFieldOverride f={f} own={own} problems={problems} specs={specs} onOverride={p => setFieldOverride(f.id, p)} onReset={() => resetFieldOverride(f.id)} />}
              </div>
            ))}
          {eff.problemRefs.filter(r => r.moduleId === m.id).sort(bySort).map(r => pm[r.problemTypeId] && (
            <div key={r.id} className="rounded-lg px-2 pb-1 mb-1.5" style={{ background: C.bg, border: `1px ${isOwn(r) ? "solid" : "dashed"} ${C.line}` }}>
              <div className="flex items-center gap-2 pt-1.5"><span className="label-sm" style={{ color: C.muted }}>from catalog</span><Tag item={r} /><div className="flex-1" />
                {own && <><button onClick={() => moveItem("problemRefs", r.id, -1)} className="text-xs px-1" style={{ color: C.muted }}>↑</button><button onClick={() => moveItem("problemRefs", r.id, 1)} className="text-xs px-1" style={{ color: C.muted }}>↓</button></>}
                {isOwn(r) ? <button onClick={() => removeOwnRef(r.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button>
                  : own && <button onClick={() => suppress(r.id)} className="text-xs px-1.5" style={{ color: C.muted }}>hide</button>}
              </div>
              <RefTree node={pm[r.problemTypeId]} problems={catalog} overrides={eff.overrides} onOverride={own ? setOverride : () => {}} onHide={null} s={s} />
            </div>
          ))}
          {own && hiddenIn(m.id).length > 0 && (
            <div className="text-xs mt-1 flex flex-wrap gap-1.5 items-center" style={{ color: C.muted }}>hidden here: {hiddenIn(m.id).map(h => <button key={h.id} onClick={() => unsuppress(h.id)} className="px-1.5 py-0.5 rounded line-through" style={{ background: C.line }} title="restore">{h.label}</button>)}</div>
          )}
          {own && (
            <div className="flex gap-1.5 mt-1 items-center flex-wrap">
              <Ghost onClick={() => addField(m.id)}>+ field</Ghost>
              <Ghost onClick={() => addSystem(m.id, "Photos")}><Ic i={Camera} s={12} mr={4} />+ photos block</Ghost>
              <select value="" onChange={e => addSystem(m.id, e.target.value)} className="text-xs rounded px-2 py-1.5 outline-none" style={{ ...inp, background: C.accentSoft, color: C.accent, border: "none" }}>
                <option value="">+ system block…</option>
                {Object.entries(SYSTEM_TYPES).filter(([k]) => !usedSystem.has(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <select value="" onChange={e => addRef(m.id, e.target.value)} className="text-xs rounded px-2 py-1.5 outline-none" style={{ ...inp, background: C.accentSoft, color: C.accent, border: "none" }} disabled={problems.length === 0}>
                <option value="">{problems.length === 0 ? "problem catalog empty" : "+ problem branch from catalog…"}</option>
                {catalog.filter(p => !usedIds.has(p.id)).map(p => <option key={p.id} value={p.id}>{pathOf(catalog, p.id)}</option>)}
              </select>
            </div>
          )}
        </div>
      ))}
      {own && hiddenModules.length > 0 && <div className="text-xs mb-3 flex flex-wrap gap-1.5 items-center" style={{ color: C.muted }}>hidden modules: {hiddenModules.map(h => <button key={h.id} onClick={() => unsuppress(h.id)} className="px-1.5 py-0.5 rounded line-through" style={{ background: C.line }} title="restore">{h.name}</button>)}</div>}
      {own && <div className="flex items-center gap-3"><Primary small onClick={addModule}>+ Add module</Primary><span className="text-xs" style={{ color: C.muted }}>“Summary” is added automatically, at the end.</span></div>}
    </div>
  );
}
// Controller preview: the real runner on a throwaway inspection kept in local state — what the Head builds is what the controller gets.
function ControllerPreview({ s, typeId, scope, setScope }) {
  const products = s.products.filter(p => p.isActive !== false);
  const [pid, setPid] = useState(scope.kind === "Product" ? scope.id : (products[0]?.id || ""));
  const product = s.products.find(p => p.id === pid);
  const t = product ? resolveTemplate(s, product, typeId) : null;
  const [insp, setInsp] = useState(null);
  useEffect(() => { if (!product || !t) { setInsp(null); return; } setInsp({ id: "preview", typeId, productId: product.id, controllerId: s.users.find(u => u.role === "Controller")?.id, status: "Draft", result: null, startedAt: nowISO(), template: t, values: {}, remarks: [], photos: {}, pallets: [""], sample: { tu: "1", cusPerTu: product.cusPerTu || "", piecesPerCu: product.piecesPerCu || "", weightPerCu: product.weightPerCu || "" }, audit: [] }); }, [pid, typeId, s.templates, s.categories, s.products]);
  const problems = product ? problemsFor(s, { kind: "Product", id: product.id }, new Set((t && t.suppressed) || [])) : [];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap"><span className="text-xs" style={{ color: C.muted }}>Preview as the controller would see it for:</span><select value={pid} onChange={e => setPid(e.target.value)} className="text-sm">{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><span className="text-xs" style={{ color: C.muted }}>{t ? `composition: ${chainLabel(layerChain(s, { kind: "Product", id: pid }, typeId), s)}` : "no form for this type yet"}</span></div>
      {insp && t ? (
        <div className="rounded-3xl p-3 mx-auto" style={{ maxWidth: 420, background: C.bg, border: `1px solid ${C.line}` }}>
          <div className="rounded-2xl p-3" style={{ background: C.surface }}>
            <InspectionRunner key={typeId + pid + (t.id || "")} insp={insp} patch={fn => setInsp(prev => typeof fn === "function" ? fn(prev) : { ...prev, ...fn })} t={t} problems={problems} product={product} suppliers={s.suppliers || []} dictionaries={s.dictionaries || []} sctx={s} user={s.users.find(u => u.role === "Controller") || s.users[0]} onFinish={() => {}} onEscalate={() => {}} onRaiseFlag={() => {}} onCancel={() => {}} />
          </div>
          <p className="text-[11px] text-center mt-2" style={{ color: C.muted }}>Sandbox — nothing here is saved.</p>
        </div>
      ) : <Card><Empty icon="🧩" title="Nothing to preview" hint={product ? "This type has no global form yet — build it first." : "Add a product first."} /></Card>}
    </div>
  );
}

function FormsPage({ s, set }) {
  const [scope, setScope] = useState({ kind: "Global" });
  const types = typesOf(s); const [typeId, setTypeId] = useState(types[0]?.id || null); const [tab, setTab] = useState("build");
  useEffect(() => { if (!typeId && types[0]) setTypeId(types[0].id); }, [types.length]);
  const type = typeById(s, typeId) || types[0];
  const patchType = ch => set(x => ({ ...x, inspectionTypes: x.inspectionTypes.map(t => t.id === typeId ? { ...t, ...ch } : t) }));
  const addType = () => { const id = uid(); const first = !typesOf(s).length; set(x => ({ ...x, inspectionTypes: [...x.inspectionTypes, { id, name: first ? "Full" : "New type", color: first ? "#1F5C3E" : "#7A4FA3", sort: x.inspectionTypes.length, autoAccept: false, countsAsInspection: true, reason: "none", allowedByDefault: first, description: "" }] })); setTypeId(id); setTab("type"); };
  const deleteType = () => { if (s.inspections.some(i => (i.typeId || legacyTypeId(i.type)) === typeId)) return; set(x => ({ ...x, inspectionTypes: x.inspectionTypes.filter(t => t.id !== typeId), templates: x.templates.filter(t => t.typeId !== typeId) })); setTypeId(types.find(t => t.id !== typeId)?.id || "type-full"); setTab("build"); };
  const globalT = s.templates.find(t => t.scope === "Global" && (t.typeId || "type-full") === typeId);
  const own = ownTemplate(s, scope, typeId);
  const product = scope.kind === "Product" ? s.products.find(p => p.id === scope.id) : null;
  const chain = layerChain(s, scope, typeId);
  const eff = chain.length ? compose(s, chain) : null;
  const parentChain = own ? chain.filter(t => t.id !== own.id) : chain;
  const setOwn = fn => set(x => ({ ...x, templates: x.templates.map(t => t.id === own.id ? (typeof fn === "function" ? fn(t) : fn) : t) }));
  const create = () => set(x => ({ ...x, templates: [...x.templates, emptyTemplate(scope.kind, { typeId, ...(scope.kind === "Category" ? { categoryId: scope.id } : scope.kind === "Product" ? { productId: scope.id } : {}) })] }));
  const drop = () => set(x => ({ ...x, templates: x.templates.filter(t => t.id !== own.id) }));
  const catPath = c => { const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const specsHint = scope.kind === "Global" ? "specification — by name, or explicitly at product level" : scope.kind === "Category" ? "specification — by name, or explicitly at product level" : "";
  const ownCount = own ? (own.modules.length + own.fields.length + own.problemRefs.length + (own.suppressed || []).length + Object.keys(own.fieldOverrides || {}).length + own.overrides.length) : 0;
  return (
    <div>
      <h1 className="mb-1">Inspection types & forms</h1>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>Every inspection type has its own form, built in layers: global → category → product. Which types a product may use is set on the category or product (inherited).</p>
      {!type && <Card style={{ maxWidth: 640 }}><Empty icon="🧩" title="No inspection types yet" hint="Every inspection belongs to a type you define — its name, its form, and how the result is treated (verdict or auto-accept, counted or trace only). Start with the one you do most often." action={<Primary onClick={addType}>Create the first inspection type</Primary>} /></Card>}
      {type && <><div className="flex items-center gap-1.5 flex-wrap mb-3">{types.map(t => <button key={t.id} onClick={() => { setTypeId(t.id); setTab("build"); }} className="text-sm px-3.5 py-2 rounded-xl inline-flex items-center gap-2" style={{ background: t.id === typeId ? C.surface : "transparent", border: `1px solid ${t.id === typeId ? C.ink : C.line}`, fontWeight: t.id === typeId ? 600 : 450 }}><span className="inline-block rounded-full" style={{ width: 8, height: 8, background: t.color }} />{t.name}{t.autoAccept && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>auto</span>}</button>)}<button onClick={addType} className="text-sm px-3 py-2 rounded-xl" style={{ color: C.accent }}>+ new type</button></div>
      <div className="flex items-center gap-1 mb-4" style={{ borderBottom: `1px solid ${C.line}` }}>{[["build", "Build form"], ["preview", "Controller preview"], ["type", "Type settings"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="text-sm px-3 py-2" style={{ borderBottom: `2px solid ${tab === k ? C.accent : "transparent"}`, color: tab === k ? C.ink : C.muted, fontWeight: tab === k ? 600 : 450, marginBottom: -1 }}>{l}</button>)}</div>
      {tab === "type" && (
        <Card style={{ maxWidth: 640 }}>
          <div className="flex items-center gap-2 mb-3"><input type="color" value={type.color} onChange={e => patchType({ color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" style={{ minHeight: 0 }} /><input value={type.name} onChange={e => patchType({ name: e.target.value })} className="flex-1 text-base font-semibold" /></div>
          <input value={type.description || ""} onChange={e => patchType({ description: e.target.value })} placeholder="one line for controllers: what this type is for" className="w-full text-sm mb-4" />
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={!!type.autoAccept} onChange={e => patchType({ autoAccept: e.target.checked })} className="mt-1" /><span>Auto-accept on finish<span className="block text-xs" style={{ color: C.muted }}>No Accept / Reject buttons. Finishing records “Accepted”. Use for checks that only leave a trace (visual, skip).</span></span></label>
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={type.countsAsInspection !== false} onChange={e => patchType({ countsAsInspection: e.target.checked })} className="mt-1" /><span>Counts as an inspection<span className="block text-xs" style={{ color: C.muted }}>Included in “done today”, averages and analytics. Turn off for skips — a trace, not work.</span></span></label>
          <div className="flex items-center gap-3 text-sm py-2.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">Reason on finish<span className="block text-xs" style={{ color: C.muted }}>Quick reason chips in the summary (e.g. “no time”, “stable product”).</span></span><select value={type.reason || "none"} onChange={e => patchType({ reason: e.target.value })} className="text-sm"><option value="none">none</option><option value="optional">optional</option><option value="required">required</option></select></div>
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={!!type.allowedByDefault} onChange={e => patchType({ allowedByDefault: e.target.checked })} className="mt-1" /><span>Allowed by default<span className="block text-xs" style={{ color: C.muted }}>Products without their own policy (or category policy) may use this type.</span></span></label>
          <div className="flex items-center gap-3 text-sm py-2.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">Order in the scanner</span><div className="flex gap-1">{types.map(t => t.id === typeId ? null : null)}<button onClick={() => set(x => { const arr = typesOf(x); const i = arr.findIndex(t => t.id === typeId); if (i <= 0) return x; const a = arr[i - 1]; return { ...x, inspectionTypes: x.inspectionTypes.map(t => t.id === typeId ? { ...t, sort: a.sort } : t.id === a.id ? { ...t, sort: arr[i].sort } : t) }; })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }}>↑</button><button onClick={() => set(x => { const arr = typesOf(x); const i = arr.findIndex(t => t.id === typeId); if (i < 0 || i >= arr.length - 1) return x; const b = arr[i + 1]; return { ...x, inspectionTypes: x.inspectionTypes.map(t => t.id === typeId ? { ...t, sort: b.sort } : t.id === b.id ? { ...t, sort: arr[i].sort } : t) }; })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }}>↓</button></div></div>
          <div className="mt-4 flex items-center gap-3"><button onClick={deleteType} disabled={s.inspections.some(i => (i.typeId || legacyTypeId(i.type)) === typeId) || types.length <= 1} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.bad }}>Delete type</button><span className="text-[11px]" style={{ color: C.muted }}>{s.inspections.some(i => (i.typeId || legacyTypeId(i.type)) === typeId) ? "Used by existing inspections — cannot be deleted." : "Deletes its form layers too."}</span></div>
        </Card>
      )}
      {tab === "preview" && <ControllerPreview s={s} typeId={typeId} scope={scope} setScope={setScope} />}</>}
      {type && <div className="flex gap-4 items-start" style={{ display: tab === "build" ? "flex" : "none" }}>
        <aside className="w-52 flex-shrink-0">
          <p className="label-sm px-2 mb-1" style={{ color: C.muted }}>Layer</p>
          <button onClick={() => setScope({ kind: "Global" })} className="w-full text-left text-sm px-2.5 py-2 rounded-lg mb-0.5" style={{ background: scope.kind === "Global" ? C.accentSoft : "transparent", color: scope.kind === "Global" ? C.accent : C.ink }}><Ic i={Globe} s={14} />Global<Dot on={!!globalT} /></button>
          {s.categories.length > 0 && <p className="label-sm px-2 mb-1 mt-3" style={{ color: C.muted }}>Categories</p>}
          {s.categories.map(c => { const has = s.templates.some(t => t.scope === "Category" && t.categoryId === c.id); return <button key={c.id} onClick={() => setScope({ kind: "Category", id: c.id })} className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg mb-0.5" style={{ background: scope.id === c.id ? C.accentSoft : "transparent", color: scope.id === c.id ? C.accent : C.ink, paddingLeft: c.parentId ? 22 : 10 }}>{catPath(c)}<Dot on={has} /></button>; })}
          {s.products.length > 0 && <p className="label-sm px-2 mb-1 mt-3" style={{ color: C.muted }}>Products</p>}
          {s.products.map(p => { const has = s.templates.some(t => t.scope === "Product" && t.productId === p.id); return <button key={p.id} onClick={() => setScope({ kind: "Product", id: p.id })} className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg mb-0.5 truncate" style={{ background: scope.id === p.id ? C.accentSoft : "transparent", color: scope.id === p.id ? C.accent : C.ink }}>{p.name}<Dot on={has} /></button>; })}
        </aside>
        <div className="flex-1 min-w-0">
          {scope.kind === "Global" && !globalT && <Empty icon="🧩" title="No global template" hint="The starting point for every product. Build it once — modules, fields, problem branches from the catalog." action={<Primary onClick={create}>Create global template</Primary>} />}
          {scope.kind !== "Global" && !globalT && <Empty icon="🧩" title="Global template first" hint="Without a global template there is nothing to inherit from." action={<Primary onClick={() => setScope({ kind: "Global" })}>Go to global</Primary>} />}
          {globalT && scope.kind !== "Global" && !own && eff && (
            <>
              <div className="flex items-center gap-3 mb-3 flex-wrap"><Primary onClick={create}>Add own layer</Primary><span className="text-xs" style={{ color: C.muted }}>The inherited form below is read-only until this level has a layer of its own.</span></div>
              <Note tone="warn">This level <b>has no layer of its own</b> — you see the composition: {chainLabel(chain, s)}. Everything works as is. Add a layer only if you want to add, hide or override something here{scope.kind === "Product" ? " (e.g. explicitly link a field to this product's specification)" : ""}.</Note>
              <Builder eff={eff} own={null} setOwn={() => {}} problems={s.problems} specs={null} specsHint="—" readOnly s={s} scope={scope} />
            </>
          )}
          {own && eff && (
            <>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: C.okBg, color: C.ok }}>{scope.kind === "Global" ? "global layer" : `own layer · ${ownCount} changes vs: ${chainLabel(parentChain, s) || "—"}`}</span>
                {scope.kind !== "Global" && <button onClick={drop} className="text-xs" style={{ color: C.muted }}>Remove layer — back to pure inheritance</button>}
              </div>
              {scope.kind === "Product" && product?.specs.length === 0 && effectiveSpecs(s, product).length === 0 && <Note tone="warn">This product has no specifications, own or from the category — measurement fields will have no reference.</Note>}
              <Builder eff={eff} own={own} setOwn={setOwn} problems={s.problems} specs={scope.kind === "Product" ? product?.specs : null} specsHint={specsHint} s={s} scope={scope} />
            </>
          )}
        </div>
      </div>}
    </div>
  );
}

// ═══════════════════ PAGE: Inspection ═══════════════════
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
// Module-scoped (not defined inside SampleBlock): a component defined inside another component's render body gets a
// fresh function identity every render, so React treats it as a *different* component type on every keystroke and
// remounts it — tearing down the <input> (and its focus) instead of just updating it. Same class of bug as Field/
// FastInput above; SampleBlock's fields need the fix too.
const SampleField = ({ sample, setSample, k, label, unit }) => <label className="text-xs flex flex-col gap-1" style={{ color: C.muted }}>{label}<span className="flex items-center gap-1"><input type="number" value={sample[k]} onChange={e => setSample(x => ({ ...x, [k]: e.target.value }))} className="w-full text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /><span>{unit}</span></span></label>;
function SampleBlock({ sample, setSample, totals }) {
  // Fixed 2×2 grid, not 4-in-a-row: on a phone width, 4 columns forced "Pieces per CU" to wrap onto two lines while
  // the other labels stayed on one, so that column's row (all 4 stretch to the tallest cell) pushed its input down
  // and out of line with the rest. Two columns give every label enough room to stay on one line.
  return (
    <div className="rounded-lg p-3" style={{ background: C.accentSoft }}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 mb-2">
        <SampleField sample={sample} setSample={setSample} k="tu" label="Checked TU" unit="TU" /><SampleField sample={sample} setSample={setSample} k="cusPerTu" label="CU / TU" unit="CU" /><SampleField sample={sample} setSample={setSample} k="piecesPerCu" label="pcs / CU" unit="pcs" /><SampleField sample={sample} setSample={setSample} k="weightPerCu" label="CU weight" unit="g" />
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
                if (!d.items.length) return <p className="text-xs" style={{ color: C.warn }}>The list “{d.name}” is empty — fill it in Dictionaries → Lists.</p>;
                // Short lists stay one-tap pill buttons; longer ones (the Head can attach a 70-item list) become a real dropdown so it doesn't turn into a wall of buttons.
                const picker = d.items.length > 6
                  ? <select value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }}><option value="">— choose ({d.items.length} options) —</option>{d.items.map(o => <option key={o.id} value={o.value}>{o.value}</option>)}</select>
                  : <div className="flex flex-wrap gap-1.5">{d.items.map(o => <button key={o.id} onClick={() => setV(f.id, o.value)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: values[f.id] === o.value ? C.accent : C.accentSoft, color: values[f.id] === o.value ? C.onDark : C.accent }}>{o.value}</button>)}</div>;
                return <div>{picker}{preset && <p className="text-[11px] mt-1" style={{ color: C.muted }}>Pre-filled from the product profile ({preset.source}: {preset.value}){values[f.id] && values[f.id] !== preset.value ? " — changed on the dock" : ""}.</p>}</div>;
              })()}
              {f.type === "Pallet" && <div>{pallets.map((p, i) => <div key={i} className="flex gap-1.5 mb-1.5"><input value={p} onChange={e => setPallets(ps => ps.map((x, j) => j === i ? e.target.value : x))} placeholder={`pallet ${i + 1}`} className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><button className="text-xs px-2 rounded" style={{ background: C.line, color: C.muted }} title="camera scanning is only available in the phone app" disabled><Ic i={ScanLine} s={13} mr={0} /></button>{pallets.length > 1 && <button onClick={() => setPallets(ps => ps.filter((_, j) => j !== i))} className="text-xs px-1" style={{ color: C.muted }}>×</button>}</div>)}<button onClick={() => setPallets(ps => [...ps, ""])} className="text-xs" style={{ color: C.accent }}>+ another pallet</button><DeliveryPallets product={product} insp={insp} onAdd={hus => setPallets(ps => [...ps.filter(Boolean), ...hus.filter(h => !ps.includes(h))])} /></div>}
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
      {(() => { const groups = []; (t?.fields || []).forEach(f => { const ph = asPhotoList((insp.photos || {})[f.id]); if (ph.length) groups.push({ key: f.id, label: f.type === "Photos" ? photoBlockLabel(f, t) : f.label, photos: ph }); }); (insp.remarks || []).forEach(r => { const ph = asPhotoList(r.photos); if (ph.length) groups.push({ key: r.id, label: `Problem: ${pathOf(problems, r.leafId)}`, photos: ph }); }); return <div className="mt-4"><p className="label-sm mb-2">Photos</p>{groups.length ? groups.map(g => <div key={g.key} className="mb-2"><p className="text-xs mb-1" style={{ color: C.muted }}>{g.label}</p><PhotoStrip photos={g.photos} size={72} /></div>) : <p className="text-xs" style={{ color: C.muted }}>No photos in this inspection.</p>}</div>; })()}
      {(insp.audit || []).length > 0 && (
        <div className="mt-4">
          <p className="label-sm mb-1">Audit trail</p>
          {insp.audit.map((a, i) => <div key={i} className="text-xs py-1" style={{ borderTop: `1px solid ${C.line}`, color: C.muted }}>{fmtTime(a.at)} · <b style={{ color: C.ink }}>{s.users.find(u => u.id === a.userId)?.name}</b> · {a.action}{a.details ? ` — ${a.details}` : ""}</div>)}
        </div>
      )}
    </div>
  );
}

// ═══════════════════ PAGE: Inspections (list + new + details) ═══════════════════
function InspectionsPage({ s, set, user, notify, openId, setOpenId, preset, clearPreset }) {
  const [newProduct, setNewProduct] = useState(preset || "");
  useEffect(() => { if (preset) { setNewProduct(preset); clearPreset(); } }, [preset]); const [filter, setFilter] = useState("all"); const [editing, setEditing] = useState(false); const [peek, setPeek] = useState(false); useEffect(() => { setPeek(false); }, [openId]);
  const [q, setQ] = useState(""); const [adv, setAdv] = useState({ range: "all", result: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "" }); const [advOpen, setAdvOpen] = useState(false);
  const matchAdv = i => {
    const p = s.products.find(x => x.id === i.productId); const when = i.completedAt || i.startedAt || "";
    if (q.trim() && !((p?.name || "") + " " + (p?.articleId || "")).toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (adv.range !== "all") { const t = new Date(), since = new Date(t.getFullYear(), t.getMonth(), t.getDate() - (adv.range === "0" ? 0 : Number(adv.range) - 1)); if (adv.range === "custom") { if (adv.from && when.slice(0, 10) < adv.from) return false; if (adv.to && when.slice(0, 10) > adv.to) return false; } else if (new Date(when) < since) return false; }
    if (adv.result && i.result !== adv.result) return false; if (adv.supplier && i.supplier !== adv.supplier) return false; if (adv.controller && i.controllerId !== adv.controller) return false; if (adv.category && p?.categoryId !== adv.category) return false;
    if (adv.code.trim() && dateCode(i.dateISO) !== adv.code.trim()) return false; if (adv.packFrom && (!i.dateISO || i.dateISO < adv.packFrom)) return false; if (adv.packTo && (!i.dateISO || i.dateISO > adv.packTo)) return false;
    return true;
  };
  const advCount = ["result", "supplier", "controller", "category"].filter(k => adv[k]).length + (adv.range !== "all" ? 1 : 0) + ((adv.code.trim() || adv.packFrom || adv.packTo) ? 1 : 0);
  const insp = s.inspections.find(i => i.id === openId);
  const product = insp && s.products.find(p => p.id === insp.productId);
  const patchInsp = (id, fn) => set(x => ({ ...x, inspections: x.inspections.map(i => i.id === id ? (typeof fn === "function" ? fn(i) : { ...i, ...fn }) : i) }));
  const log = (id, action, details) => patchInsp(id, i => ({ ...i, audit: [...(i.audit || []), { at: nowISO(), userId: user.id, action, details }] }));

  const [collisionWarn, setCollisionWarn] = useState(null);
  const [newType, setNewType] = useState("type-full");
  const start = (force = false) => {
    const p = s.products.find(x => x.id === newProduct); if (!p) return;
    const typeId = allowedTypes(s, p).some(t => t.id === newType) ? newType : (allowedTypes(s, p)[0]?.id || "type-full");
    const t = resolveTemplate(s, p, typeId); if (!t) return;
    const collision = s.inspections.find(i => i.productId === p.id && ["Draft", "PendingReview"].includes(i.status) && i.controllerId !== user.id);
    if (collision && !force) { setCollisionWarn(collision); return; }
    setCollisionWarn(null);
    const id = uid();
    const snapshot = { id: t.id, modules: t.modules, fields: t.fields, problemRefs: t.problemRefs, overrides: t.overrides, suppressed: [...t.suppressed] };
    set(x => ({ ...x, inspections: [...x.inspections, { id, typeId, productId: p.id, controllerId: user.id, status: "Draft", result: null, startedAt: nowISO(), template: snapshot, values: {}, remarks: [], photos: {}, pallets: [""], sample: { tu: 1, cusPerTu: p.cusPerTu || "", piecesPerCu: p.piecesPerCu || "", weightPerCu: p.weightPerCu || "" }, audit: [{ at: nowISO(), userId: user.id, action: "Created" }] }] }));
    setOpenId(id); setNewProduct("");
  };
  const finish = ({ anyExceeded, generalFlag, autoAccept }) => {
    { const p = s.products.find(x => x.id === insp.productId); const hus = (insp.pallets || []).map(h => String(h).replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean); set(x => { const pc = { ...(x.palletClaims || {}) }; Object.keys(pc).forEach(k => { const mine = pc[k].userId === user.id; if (!mine) return; if (p?.articleId && k.startsWith(p.articleId + "|")) delete pc[k]; if (k.startsWith("hu:") && hus.some(h => k.slice(3).replace(/^0+/, "") === h)) delete pc[k]; }); return { ...x, palletClaims: pc }; }); }
    const wasCompleted = insp.status === "Completed";
    patchInsp(insp.id, i => ({ ...i, status: "Completed", completedAt: i.completedAt || nowISO(), lastEditedBy: wasCompleted ? user.id : i.lastEditedBy, lastEditedAt: wasCompleted ? nowISO() : i.lastEditedAt }));
    log(insp.id, wasCompleted ? "Edited completed report" : "Completed", `result: ${insp.result}`);
    if (wasCompleted && insp.controllerId !== user.id) notify("EditedByOther", `${user.name} edited report ${product.name} (author: ${s.users.find(u => u.id === insp.controllerId)?.name})`, "Inspection", insp.id, insp.controllerId);
    if (insp.result === "Accepted" && (anyExceeded || generalFlag)) notify("AcceptedDespite", `${product.name}: accepted despite exceeding tolerance (${user.name})`, "Inspection", insp.id);
    else if (anyExceeded || generalFlag) notify("Exceeded", `${product.name}: tolerance exceeded — ${insp.result === "Rejected" ? "rejected" : "result: " + insp.result}`, "Inspection", insp.id);
    setEditing(false);
  };
  const escalate = q => { patchInsp(insp.id, { status: "PendingReview", question: q, answer: null }); log(insp.id, "Escalation", q); notify("Escalation", `${user.name} asks about ${product.name}: „${q}"`, "Inspection", insp.id); };
  const answer = a => { patchInsp(insp.id, { status: "Draft", answer: a }); log(insp.id, "Head's answer", a); notify("Answered", `The Head answered re ${product.name}: „${a}"`, "Inspection", insp.id, insp.controllerId); };
  const raiseFlag = text => { set(x => ({ ...x, flags: [...x.flags, { id: uid(), productId: product.id, inspectionId: insp.id, raisedBy: user.id, description: text, status: "Open", createdAt: nowISO() }] })); notify("Flag", `${user.name}: ${product.name} — ${text}`, "ProductFlag", null); };
  const cancel = () => { patchInsp(insp.id, { status: "Cancelled" }); log(insp.id, "Cancelled"); setOpenId(null); };

  const list = s.inspections.filter(i => filter === "all" ? true : filter === "mine" ? i.controllerId === user.id : filter.startsWith("type:") ? (i.typeId || legacyTypeId(i.type)) === filter.slice(5) : i.status === filter).filter(matchAdv).sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
  const legacyLight = insp && !insp.template;
  const showRunner = insp && !legacyLight && (insp.status === "Draft" || insp.status === "PendingReview" || editing);

  return (
    <div>
      <h1 className="mb-1">Inspections</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>Statuses: Draft → (Awaiting Head) → Completed / Cancelled. Any controller can edit a completed report — with an audit trail.</p>
      {!insp ? (
        <>
          <Card style={{ marginBottom: 16 }}>
            <p className="font-medium text-sm mb-2">New inspection</p>
            <div className="flex gap-2"><select value={newProduct} onChange={e => { setNewProduct(e.target.value); setCollisionWarn(null); }} className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }}><option value="">— product —</option>{s.products.filter(p => p.isActive !== false).map(p => <option key={p.id} value={p.id}>{p.articleId ? p.articleId + " · " : ""}{p.name}</option>)}</select><select value={newType} onChange={e => setNewType(e.target.value)} className="text-sm" style={{ minHeight: 36 }}>{(newProduct ? allowedTypes(s, s.products.find(p => p.id === newProduct)) : typesOf(s)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><Primary onClick={() => start(false)} disabled={!newProduct || !(newProduct && resolveTemplate(s, s.products.find(p => p.id === newProduct), allowedTypes(s, s.products.find(p => p.id === newProduct)).some(t => t.id === newType) ? newType : allowedTypes(s, s.products.find(p => p.id === newProduct))[0]?.id))}>Start</Primary></div>
            {collisionWarn && <div className="mt-2"><Note tone="warn"><div className="flex items-center gap-3 flex-wrap"><span>{s.users.find(u => u.id === collisionWarn.controllerId)?.name} already has an open inspection of this product ({STATUS[collisionWarn.status][0]}).</span><button onClick={() => start(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Start anyway</button><button onClick={() => setCollisionWarn(null)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Never mind</button></div></Note></div>}
            {newProduct && !resolveTemplate(s, s.products.find(p => p.id === newProduct)) && <p className="text-xs mt-2" style={{ color: C.bad }}>This product has no form — no global template.</p>}
          </Card>
          <Card>
            <div className="flex gap-2 mb-2"><SearchBox value={q} onChange={setQ} placeholder="search by product name or article ID…" className="flex-1" inputClass="rounded" /><button onClick={() => setAdvOpen(o => !o)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: advCount ? C.accent : C.accentSoft, color: advCount ? C.onDark : C.accent }}>Filtry{advCount ? ` · ${advCount}` : ""}</button></div>
            {advOpen && (
              <div className="rounded-lg p-3 mb-3 grid gap-2" style={{ background: C.bg, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
                <label className="text-xs" style={{ color: C.muted }}>date range<select value={adv.range} onChange={e => setAdv(x => ({ ...x, range: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="all">everything</option><option value="0">today</option><option value="7">7 days</option><option value="30">30 days</option><option value="custom">custom</option></select></label>
                {adv.range === "custom" && <label className="text-xs" style={{ color: C.muted }}>from – to<div className="flex gap-1 mt-1"><input type="date" value={adv.from} onChange={e => setAdv(x => ({ ...x, from: e.target.value }))} className="flex-1 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={adv.to} onChange={e => setAdv(x => ({ ...x, to: e.target.value }))} className="flex-1 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /></div></label>}
                <label className="text-xs" style={{ color: C.muted }}>result<select value={adv.result} onChange={e => setAdv(x => ({ ...x, result: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="">all</option><option value="Accepted">accepted</option><option value="Rejected">rejected</option></select></label>
                <label className="text-xs" style={{ color: C.muted }}>supplier<select value={adv.supplier} onChange={e => setAdv(x => ({ ...x, supplier: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="">all</option>{[...new Set(s.inspections.map(i => i.supplier).filter(Boolean))].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
                <label className="text-xs" style={{ color: C.muted }}>controller<select value={adv.controller} onChange={e => setAdv(x => ({ ...x, controller: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="">all</option>{s.users.filter(u => u.role === "Controller").map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
                <label className="text-xs" style={{ color: C.muted }}>category<select value={adv.category} onChange={e => setAdv(x => ({ ...x, category: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="">all</option>{s.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="text-xs" style={{ color: C.muted }} title="packing date — a different axis than the inspection date">date code<div className="flex gap-1 mt-1 items-center"><input value={adv.code} onChange={e => setAdv(x => ({ ...x, code: e.target.value }))} placeholder="382" className="w-16 text-sm rounded px-2 py-1.5 outline-none font-mono" style={{ ...inp }} /><span className="text-[10px]">or</span><input type="date" value={adv.packFrom} onChange={e => setAdv(x => ({ ...x, packFrom: e.target.value }))} className="flex-1 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={adv.packTo} onChange={e => setAdv(x => ({ ...x, packTo: e.target.value }))} className="flex-1 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /></div></label>
                <div className="flex items-end"><button onClick={() => { setAdv({ range: "all", result: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "" }); setQ(""); }} className="text-xs underline" style={{ color: C.muted }}>clear all</button></div>
              </div>
            )}
            <div className="flex gap-1.5 mb-3 flex-wrap">{[["all", "all"], ["mine", "mine"], ...typesOf(s).map(t => ["type:" + t.id, t.name.toLowerCase()]), ["Draft", "drafts"], ["PendingReview", "awaiting Head"], ["Completed", "completed"], ["Cancelled", "cancelled"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: filter === k ? C.accent : C.accentSoft, color: filter === k ? C.onDark : C.accent }}>{l} {k === "PendingReview" && s.inspections.filter(i => i.status === "PendingReview").length > 0 && `(${s.inspections.filter(i => i.status === "PendingReview").length})`}</button>)}</div>
            {list.length === 0 ? <Empty icon="📋" title={s.inspections.length ? "Nothing matches" : "No inspections"} hint={s.inspections.length ? "Change the search or filters." : "Start the first one above."} /> : list.map(i => { const p = s.products.find(x => x.id === i.productId); const it = inspType(s, i); const vis = it.autoAccept, skp = !it.countsAsInspection; const [fg, bg] = i.status !== "Completed" ? [STATUS[i.status][1], STATUS[i.status][2]] : it.autoAccept ? [it.color, C.accentSoft] : i.result === "Accepted" ? [C.ok, C.okBg] : i.result === "Rejected" ? [C.bad, C.badBg] : [STATUS[i.status][1], STATUS[i.status][2]]; return (
              <button key={i.id} onClick={() => { setOpenId(i.id); setEditing(false); }} className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg row" style={{ borderTop: `1px solid ${C.line}` }}>
                <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 500 }}><span className="inline-block rounded-full" style={{ width: 7, height: 7, background: fg }} />{i.status !== "Completed" ? STATUS[i.status][0] : it.autoAccept ? it.name : (i.result === "Accepted" ? "Accepted" : "Rejected")}</span>{it.id !== "type-full" && i.status === "Completed" && !it.autoAccept && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>{it.name}</span>}
                <span className="flex-1 text-sm min-w-0 truncate">{p?.name || `Pallet ${(i.pallets || [])[0] || ""}`}</span>
                <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{i.dateISO && `DC ${dateCode(i.dateISO)} · `}{s.users.find(u => u.id === i.controllerId)?.name} · {fmtTime(i.startedAt)}{i.lastEditedBy && " · ✏️"}</span>
              </button>
            ); })}
          </Card>
        </>
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-3 gap-2">
            <button onClick={() => { setOpenId(null); setEditing(false); }} className="text-xs" style={{ color: C.accent }}>← list</button>
            {product && <button onClick={() => setPeek(true)} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center font-medium" style={{ background: C.accentSoft, color: C.accent }} title="Open the product profile in a side panel — the inspection stays open"><Ic i={BookOpen} s={13} mr={4} />Product profile</button>}
          </div>
          {peek && product && <ProductPeek s={s} product={product} onClose={() => setPeek(false)} />}
          {legacyLight ? (
            <div>
              <div className="rounded-xl p-4 mb-3" style={{ background: !countsAs(s, insp) ? C.bg : C.accentSoft }}>
                <p className="text-sm font-semibold flex items-center" style={{ color: !countsAs(s, insp) ? C.muted : C.accent }}>{!countsAs(s, insp) ? <><Ic i={SkipForward} s={16} />Pallet skipped — not inspected</> : <><Ic i={Check} s={16} />{inspType(s, insp).name} — done</>}</p>
                {insp.skipReason && <p className="text-xs mt-1" style={{ color: C.muted }}>reason: {insp.skipReason}</p>}
                <p className="text-sm mt-2">{product?.name || "no product"}</p>
                <p className="text-xs mt-1" style={{ color: C.muted }}>HU {(insp.pallets || []).filter(Boolean).join(", ") || "—"} · {s.users.find(u => u.id === insp.controllerId)?.name} · {fmtTime(insp.completedAt)}</p>
                {insp.comment && <p className="text-sm mt-2">„{insp.comment}"</p>}
              </div>
              <p className="text-xs" style={{ color: C.muted }}>Legacy entry recorded before inspection types had their own forms — trace only.</p>
            </div>
          ) : showRunner
            ? <InspectionRunner key={insp.id} insp={insp} patch={fn => patchInsp(insp.id, fn)} t={insp.template} problems={problemsFor(s, { kind: "Product", id: product.id }, new Set(insp.template.suppressed || []))} product={product} suppliers={s.suppliers || []} dictionaries={s.dictionaries || []} sctx={s} user={user} onFinish={finish} onEscalate={escalate} onRaiseFlag={raiseFlag} onCancel={cancel} />
            : <ReportView insp={insp} s={s} user={user} onEdit={() => setEditing(true)} onAnswer={answer} onMarkReference={() => set(x => ({ ...x, inspections: x.inspections.map(i => i.productId === insp.productId ? { ...i, isReference: i.id === insp.id ? !i.isReference : false } : i) }))} />}
        </Card>
      )}
    </div>
  );
}

// Read-only product profile in a side drawer, opened from inside an inspection. Everything the controller may want
// to double-check mid-inspection (photos, facts, specs, properties, suppliers, encyclopedia, reference guide,
// announcements, recent history) without leaving the form — the runner keeps its state underneath.
function ProductPeek({ s, product, onClose }) {
  const [tab, setTab] = useState("overview");
  const [zoom, setZoom] = useState(null);
  useEffect(() => { const h = e => { if (e.key === "Escape") { if (zoom) setZoom(null); else onClose(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [zoom, onClose]);
  const photos = asPhotoList(product.photos);
  const specs = effectiveSpecs(s, product), attrs = effectiveAttributes(s, product), varieties = effectiveVarieties(s, product);
  const suppliers = (product.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)).filter(Boolean);
  const guide = product.guide || [];
  const notes = (s.problemNotes || []).filter(n => n.productId === product.id && hasNoteContent(n));
  const anns = (s.announcements || []).filter(a => annMatchesProduct(s, a, product));
  const history = s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 8);
  const reference = s.inspections.find(i => i.productId === product.id && i.isReference);
  const cat = s.categories.find(c => c.id === product.categoryId);
  const catPath = id => { const out = []; let c = s.categories.find(x => x.id === id); while (c) { out.unshift(c.name); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } return out.join(" › "); };
  const tabs = [["overview", "Overview"], ["specs", `Specs${specs.length ? ` · ${specs.length}` : ""}`], ["attrs", `Properties${attrs.length ? ` · ${attrs.length}` : ""}`], ["guide", `Encyclopedia${guide.length ? ` · ${guide.length}` : ""}`], ["reference", `Reference guide${notes.length ? ` · ${notes.length}` : ""}`], ["history", `History${history.length ? ` · ${history.length}` : ""}`]];
  const Row = ({ k, v }) => v ? <div className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="text-right font-medium">{v}</span></div> : null;
  const H = ({ children }) => <p className="text-[11px] font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: C.muted }}>{children}</p>;
  const Photos = ({ list, size = 84 }) => list.length ? <div className="flex gap-2 flex-wrap">{list.map(ph => <button key={ph.id} onClick={() => setZoom(ph)} className="rounded-lg overflow-hidden" style={{ width: size, height: size, border: `1px solid ${C.line}`, background: C.bg }}><img src={ph.dataUrl || ph.url || ph.src} alt="" className="w-full h-full object-cover" /></button>)}</div> : null;
  return (
    <>
      <div onClick={onClose} className="fixed inset-0" style={{ background: "rgba(0,0,0,.28)", zIndex: 60 }} />
      <aside className="fixed top-0 right-0 bottom-0 flex flex-col" style={{ width: "min(560px, 100vw)", background: C.surface, borderLeft: `1px solid ${C.line}`, zIndex: 61, boxShadow: "-12px 0 40px rgba(0,0,0,.18)" }} role="dialog" aria-label="Product profile">
        <div className="px-5 pt-4 pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: C.muted }}>Product profile · inspection stays open</p>
              <p className="font-semibold text-lg truncate mt-0.5">{product.name}</p>
              <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}>{[product.articleId && `#${product.articleId}`, cat && catPath(cat.id), product.isBio && "bio"].filter(Boolean).join(" · ") || "—"}</p>
            </div>
            <button onClick={onClose} className="text-xs px-3 py-1.5 rounded-lg whitespace-nowrap inline-flex items-center font-medium" style={{ background: C.accent, color: C.onDark }}><Ic i={X} s={13} mr={4} />Back to inspection</button>
          </div>
          <div className="flex gap-1.5 flex-wrap mt-3">{tabs.map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: tab === k ? C.accent : C.accentSoft, color: tab === k ? C.onDark : C.accent }}>{l}</button>)}</div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-6">
          {tab === "overview" && <div>
            {anns.length > 0 && <div className="mt-4">{anns.map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b>{a.body && <> — {a.body}</>}</Note>)}</div>}
            {photos.length > 0 && <><H>Photos · {photos.length}</H><Photos list={photos} size={104} /></>}
            <H>Facts</H>
            <Row k="Article ID" v={product.articleId} />
            <Row k="Category" v={cat && catPath(cat.id)} />
            <Row k="Barcode CU" v={product.barcodeCu} />
            <Row k="Barcode TU" v={product.barcodeTu} />
            <Row k="CU per TU" v={product.cusPerTu} />
            <Row k="Pieces per CU" v={product.piecesPerCu} />
            <Row k="Weight per CU" v={product.weightPerCu && `${product.weightPerCu} g`} />
            <Row k="Bio" v={product.isBio ? "yes" : null} />
            <Row k="Inspection types" v={allowedTypes(s, product).map(t => t.name).join(", ")} />
            {(suppliers.length > 0 || varieties.length > 0) && <><H>Suppliers & varieties</H>
              {suppliers.length > 0 && <div className="flex gap-1.5 flex-wrap mb-2">{suppliers.map(x => <span key={x.id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}><Ic i={Truck} s={11} mr={4} />{x.name}{x.country ? ` · ${x.country}` : ""}</span>)}</div>}
              {varieties.length > 0 && <div className="flex gap-1.5 flex-wrap">{varieties.map((v, i) => <span key={v.id || i} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{v.name}</span>)}</div>}
            </>}
            {reference && <><H>Reference inspection</H><p className="text-sm"><Ic i={Star} s={13} mr={4} />{s.users.find(u => u.id === reference.controllerId)?.name} · {fmtTime(reference.completedAt)} · {reference.result || "—"}</p></>}
          </div>}
          {tab === "specs" && <div className="mt-3">{specs.length === 0 ? <Empty icon="📏" title="No specifications" hint="Nothing set on the product or its categories." /> : specs.map((q, i) => <div key={q.id || i} className="flex justify-between gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><div><span className="font-medium">{q.name}</span>{q.source !== "product" && <span className="text-[10px] ml-2" style={{ color: C.muted }}>{q.source}</span>}</div><span className="font-mono whitespace-nowrap">{specLabel(q)}</span></div>)}</div>}
          {tab === "attrs" && <div className="mt-3">{attrs.length === 0 ? <Empty icon="🏷️" title="No properties" hint="Nothing set on the product or its categories." /> : attrs.map(a => <div key={a.dictionaryId} className="flex justify-between gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><div><span style={{ color: C.muted }}>{a.list}</span>{a.source !== "product" && <span className="text-[10px] ml-2" style={{ color: C.muted }}>{a.source}</span>}</div><span className="font-medium text-right">{a.value}</span></div>)}</div>}
          {tab === "guide" && <div className="mt-3">{guide.length === 0 ? <Empty icon="📖" title="Encyclopedia is empty" hint="Fill it in on the product page (Products → Encyclopedia)." /> : guide.map(g => <div key={g.id} className="rounded-xl p-3 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="font-semibold text-sm mb-1">{g.title || "Untitled entry"}</p>{g.body && <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: C.ink }}>{g.body}</p>}<Photos list={asPhotoList(g.photos)} /></div>)}</div>}
          {tab === "reference" && <div className="mt-3">{notes.length === 0 ? <Empty icon="🧭" title="No reference notes" hint="Notes and photos per defect are filled in on the product page." /> : notes.map(n => <div key={n.id} className="rounded-xl p-3 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="font-semibold text-sm mb-1">{problemPath(s.problems, n.problemId) || "Defect"}</p>{n.description && <p className="text-sm whitespace-pre-wrap mb-2">{n.description}</p>}<Photos list={asPhotoList(n.photos)} /></div>)}</div>}
          {tab === "history" && <div className="mt-3">{history.length === 0 ? <Empty icon="📋" title="No completed inspections yet" /> : history.map(i => { const it = inspType(s, i); return <div key={i.id} className="flex items-center gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><span className="inline-block rounded-full" style={{ width: 8, height: 8, background: it.autoAccept ? it.color : i.result === "Accepted" ? C.ok : i.result === "Rejected" ? C.bad : C.muted }} /><span className="flex-1 min-w-0 truncate">{it.autoAccept ? it.name : (i.result || "—")}{i.supplier ? ` · ${i.supplier}` : ""}{i.isReference && <Ic i={Star} s={12} mr={0} />}</span><span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{i.dateISO && `DC ${dateCode(i.dateISO)} · `}{s.users.find(u => u.id === i.controllerId)?.name} · {fmtTime(i.completedAt)}</span></div>; })}</div>}
        </div>
      </aside>
      {zoom && <div onClick={() => setZoom(null)} className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", zIndex: 80, cursor: "zoom-out" }}><img src={zoom.dataUrl || zoom.url || zoom.src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 12 }} /></div>}
    </>
  );
}

// ═══════════════════ STRONA: Product catalog (controller, tylko odczyt) ═══════════════════
// A product carries up to two barcodes — CU (consumer pack) and TU (box/case); every product has at least one.
// codeKind tells the controller which one they just scanned.
const productCodes = p => [["article", p.articleId], ["CU", p.barcodeCu], ["TU", p.barcodeTu]].filter(([, v]) => v && String(v).trim());
const codeKind = (p, c) => (productCodes(p).find(([, v]) => String(v).trim() === String(c).trim()) || [null])[0];
const matchesCode = (p, c) => !!codeKind(p, c);
function CatalogPage({ s, set, user, notify, onStartInspection }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useBackSel("catalogSel", null); const [flagText, setFlagText] = useState(""); const [flagOpen, setFlagOpen] = useState(false); const [showRef, setShowRef] = useState(null);
  const [cat, setCat] = useBackSel("catalogCat", null); const [f, setF] = useState({ bio: "", supplier: "", flagged: false, sort: "name" });
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "uncategorised"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const catChain = id => { const out = []; let c = s.categories.find(x => x.id === id); while (c) { out.unshift(c); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } return out; };
  const lastInsp = pid => s.inspections.filter(i => i.productId === pid && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  const haystack = p => [p.name, p.articleId, p.barcodeCu, p.barcodeTu, ...catChain(p.categoryId).map(c => c.name), ...(p.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)?.name || ""), ...effectiveVarieties(s, p).map(v => v.name)].join(" ").toLowerCase();
  const qq = q.trim().toLowerCase();
  const visible = s.products.filter(p => p.isActive !== false).filter(p => (!cat || catChain(p.categoryId).some(c => c.id === cat)) && (!f.bio || (f.bio === "bio" ? p.isBio : !p.isBio)) && (!f.supplier || (p.supplierIds || []).includes(f.supplier)) && (!f.flagged || s.flags.some(x => x.productId === p.id && x.status === "Open")) && (!qq || haystack(p).includes(qq)))
    .sort((a, b) => f.sort === "recent" ? ((lastInsp(b.id)?.completedAt || "").localeCompare(lastInsp(a.id)?.completedAt || "")) : a.name.localeCompare(b.name, "en"));
  const topCats = s.categories.filter(c => !c.parentId);
  const countIn = cid => s.products.filter(p => catChain(p.categoryId).some(c => c.id === cid)).length;
  const Chip = ({ on, onClick, children }) => <button onClick={onClick} className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap" style={{ background: on ? C.ink : "transparent", color: on ? C.onDark : C.ink, border: `1px solid ${on ? C.ink : C.line}` }}>{children}</button>;
  const product = s.products.find(p => p.id === sel);
  const specs = product ? effectiveSpecs(s, product) : [];
  const assigned = product ? (product.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)).filter(Boolean) : [];
  const suppliers = assigned.length ? assigned : (s.suppliers || []);
  const history = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 5) : [];
  const openFlags = product ? s.flags.filter(f => f.productId === product.id && f.status === "Open") : [];
  const raise = () => { if (!flagText.trim()) return; set(x => ({ ...x, flags: [...x.flags, { id: uid(), productId: product.id, inspectionId: null, raisedBy: user.id, description: flagText.trim(), status: "Open", createdAt: nowISO() }] })); notify("Flag", `${user.name}: ${product.name} — ${flagText.trim()}`, "ProductFlag", null); setFlagText(""); setFlagOpen(false); };
  return (
    <div>
      <h1 className="mb-1">Products</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>Knowledge source on the dock: what the product is, its specs, who delivers it. Read-only — if something is off, raise a flag.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.3fr" }}>
        <Card>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="product, ID, category, supplier, variety…" autoFocus className="w-full text-sm mb-2" />
          <div className="flex gap-1.5 flex-wrap mb-2"><Chip on={!cat} onClick={() => setCat(null)}>Wszystkie · {s.products.length}</Chip>{topCats.map(c => <Chip key={c.id} on={cat === c.id} onClick={() => setCat(c.id)}>{c.name} · {countIn(c.id)}</Chip>)}</div>
          {cat && s.categories.some(c => c.parentId === cat) && <div className="flex gap-1.5 flex-wrap mb-2 pl-2">{s.categories.filter(c => c.parentId === cat).map(c => <Chip key={c.id} on={false} onClick={() => setCat(c.id)}>↳ {c.name} · {countIn(c.id)}</Chip>)}</div>}
          <div className="flex gap-1.5 flex-wrap mb-3 items-center text-xs" style={{ color: C.muted }}>
            <select value={f.bio} onChange={e => setF(x => ({ ...x, bio: e.target.value }))} className="text-xs" style={{ minHeight: 30 }}><option value="">bio and standard</option><option value="bio">bio only</option><option value="std">standard only</option></select>
            <select value={f.supplier} onChange={e => setF(x => ({ ...x, supplier: e.target.value }))} className="text-xs" style={{ minHeight: 30 }}><option value="">any supplier</option>{(s.suppliers || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
            <Chip on={f.flagged} onClick={() => setF(x => ({ ...x, flagged: !x.flagged }))}>with open flag</Chip>
            <select value={f.sort} onChange={e => setF(x => ({ ...x, sort: e.target.value }))} className="text-xs" style={{ minHeight: 30 }}><option value="name">A–Z</option><option value="recent">recently inspected</option></select>
          </div>
          {visible.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>Nothing matches.</p> : visible.slice(0, 60).map(p => { const li = lastInsp(p.id); const openFlag = s.flags.some(x => x.productId === p.id && x.status === "Open"); return (
            <button key={p.id} onClick={() => { setSel(p.id); setFlagOpen(false); setShowRef(null); }} className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg row" style={{ background: sel === p.id ? C.accentSoft : "transparent", borderTop: `1px solid ${C.line}` }}>
              {asPhotoList(p.photos).length ? <img src={asPhotoList(p.photos)[0].dataUrl} alt="" className="w-8 h-8 rounded-md object-contain" style={{ background: PHOTO_BG }} /> : <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: C.bg, color: C.muted }}><Ic i={ImageIcon} s={14} mr={0} /></span>}
              <span className="flex-1 min-w-0"><span className="block text-sm truncate" style={{ color: sel === p.id ? C.accent : C.ink }}>{p.name}{p.isBio && <span className="text-xs ml-1" style={{ color: C.ok }}>bio</span>}</span><span className="block text-[11px]" style={{ color: C.muted }}>{p.articleId || "—"} · {catPath(p.categoryId)}</span></span>
              {openFlag && <Ic i={Flag} s={12} mr={0} style={{ color: C.warn }} />}
              {li && <span className="inline-block rounded-full" title={`ostatnia: ${li.result === "Accepted" ? "accepted" : "rejected"}, ${fmtTime(li.completedAt)}`} style={{ width: 8, height: 8, background: li.result === "Accepted" ? C.ok : C.bad }} />}
            </button>
          ); })}
          {visible.length > 60 && <p className="text-xs mt-1" style={{ color: C.muted }}>…and {visible.length - 60} more — narrow the search.</p>}
        </Card>
        <Card>
          {!product ? <Empty icon="📦" title="Select a product" hint="You'll see the profile, specs, suppliers, varieties and recent inspections." /> : (
            <>
              <div className="flex items-start gap-3 mb-3">
                {asPhotoList(product.photos).length ? <img src={asPhotoList(product.photos)[0].dataUrl} alt="" className="w-16 h-16 rounded-lg object-contain" style={{ border: `1px solid ${C.line}`, background: PHOTO_BG }} /> : <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.muted }} title="ProductPhotos — reference photos"><Ic i={ImageIcon} s={24} mr={0} /></div>}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{product.name}{product.isBio && <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: C.okBg, color: C.ok }}>bio</span>}</p>
                  <p className="text-xs" style={{ color: C.muted }}>ID {product.articleId || "—"}{product.barcodeCu && ` · CU ${product.barcodeCu}`}{product.barcodeTu && ` · TU ${product.barcodeTu}`} · {catPath(product.categoryId)}{product.isActive === false && <span className="ml-2 px-1.5 py-0.5 rounded" style={{ background: C.line, color: C.muted }}>inactive</span>}</p>
                  <p className="text-xs mt-1" style={{ color: C.muted }}>{product.cusPerTu || "?"} CU/TU · {product.piecesPerCu || "?"} pcs/CU · {product.weightPerCu || "?"} g/CU</p>
                  {product.consumerAppUrl && <button className="text-xs mt-1 underline" style={{ color: C.accent }} title="ConsumerAppUrl — phone only">open in the consumer app ↗</button>}
                </div>
              </div>
              {s.announcements.filter(a => annMatchesProduct(s, a, product)).map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b> — {a.body}</Note>)}
              {openFlags.length > 0 && <Note tone="warn">🚩 {openFlags.length} open flag on this product — the Head hasn't resolved it yet.</Note>}
              {asPhotoList(product.photos).length > 1 && <div className="mb-3"><PhotoStrip photos={product.photos} size={56} /></div>}
              {effectiveAttributes(s, product).length > 0 && <div className="flex flex-wrap gap-1.5 mb-3">{effectiveAttributes(s, product).map(a => <span key={a.dictionaryId} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{a.list}:</span> <b>{a.value}</b></span>)}</div>}
              {(() => { const ref = s.inspections.find(i => i.productId === product.id && i.isReference); return ref ? <div className="rounded-lg p-2 mb-3 flex items-center gap-2" style={{ background: C.okBg }}><span className="text-sm inline-flex items-center" style={{ color: C.ok }}><Ic i={Star} s={14} />This product has a reference inspection</span><div className="flex-1" /><Ghost onClick={() => setShowRef(r => r ? null : ref.id)}>{showRef ? "hide" : "see how it should look"}</Ghost></div> : null; })()}
              {showRef && (() => { const ref = s.inspections.find(i => i.id === showRef); return ref ? <div className="rounded-lg p-3 mb-3" style={{ border: `1px solid ${C.ok}` }}><ReportView insp={ref} s={s} user={user} onEdit={() => {}} onAnswer={() => {}} /></div> : null; })()}
              <p className="label-sm mb-1" style={{ color: C.muted }}>Specs (specifications)</p>
              {specs.length === 0 ? <p className="text-xs mb-3" style={{ color: C.muted }}>None.</p> : specs.map(sp => <div key={sp.id} className="flex items-center gap-2 text-sm py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{sp.name}</span><span style={{ color: C.ink, fontWeight: 500 }}>{specLabel(sp)}</span><span className="text-[10px]" style={{ color: C.muted }}>{sp.source}</span></div>)}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div><p className="label-sm mb-1" style={{ color: C.muted }}>Dostawcy{assigned.length === 0 && suppliers.length > 0 && " (all)"}</p><div className="flex flex-wrap gap-1">{suppliers.length ? suppliers.map(x => <span key={x.id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{x.name}</span>) : <span className="text-xs" style={{ color: C.muted }}>none</span>}</div></div>
                <div><p className="label-sm mb-1" style={{ color: C.muted }}>Varieties</p><div className="flex flex-wrap gap-1">{effectiveVarieties(s, product).length ? effectiveVarieties(s, product).map(v => <span key={v.id} className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }} title={v.source}>{v.name}</span>) : <span className="text-xs" style={{ color: C.muted }}>none</span>}</div></div>
              </div>
              <p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>Recent inspections</p>
              {history.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>None yet.</p> : history.map(i => <div key={i.id} className="flex items-center gap-2 text-xs py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="px-2 py-0.5 rounded-full" style={{ background: i.result === "Accepted" ? C.okBg : C.badBg, color: i.result === "Accepted" ? C.ok : C.bad }}>{i.result === "Accepted" ? "Accepted" : "Rejected"}</span><span className="flex-1 truncate" style={{ color: C.muted }}>{i.comment || "—"}</span><span style={{ color: C.muted }}>{fmtTime(i.completedAt)}</span></div>)}
              <div className="flex gap-2 mt-4 flex-wrap">
                <Primary small onClick={() => onStartInspection(product.id)}><Ic i={ClipboardList} />Start inspection</Primary>
                <button onClick={() => setFlagOpen(o => !o)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.warnBg, color: C.warn }}><Ic i={Flag} />Something's off</button>
              </div>
              {flagOpen && <div className="flex gap-2 mt-2"><input value={flagText} onChange={e => setFlagText(e.target.value)} placeholder="e.g. supplier changed, spec outdated…" className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} /><Primary small onClick={raise}>Send</Primary></div>}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════ MODULE 4: Announcements (Head) ═══════════════════
// An announcement has CHANNELS, not a type — several can be on at once.
const CHANNELS = { blocking: ["Blocking", "the controller must acknowledge before doing anything (AnnouncementRecipient.AcknowledgedAt)"], dashboard: ["On the dashboard", "visible to controllers until the expiry date"], product: ["On the product", "in the catalog card and at the top of this product's inspection"], category: ["On a category", "on every product in that category (and its subcategories)"] };
const annActive = a => (!a.validTo || a.validTo >= new Date().toISOString().slice(0, 10));
const annChannels = a => [a.isBlocking && "blocking", a.showOnDashboard && "dashboard", a.productId && "product", a.categoryId && "category"].filter(Boolean);
const annMatchesProduct = (s, a, product) => (a.productId && a.productId === product.id) || (a.categoryId && product.categoryId && categoryChainIds(s, product.categoryId).includes(a.categoryId));
// Searchable product picker — a plain <select> is unusable once the catalog has hundreds of products.
function ProductPicker({ products, value, onChange, placeholder = "Search product by name or article ID…", invalid = false }) {
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const selected = products.find(p => p.id === value);
  const qq = q.trim().toLowerCase();
  const results = (qq ? products.filter(p => (p.name + " " + (p.articleId || "")).toLowerCase().includes(qq)) : products).slice(0, 8);
  if (selected && !open) return (
    <div className="flex items-center gap-2 rounded-md px-2" style={{ ...inp, height: 32 }}>
      <span className="flex-1 min-w-0 truncate text-[13px]">{selected.name}</span>
      <button onClick={() => { setQ(""); setOpen(true); }} className="text-xs flex-shrink-0" style={{ color: C.accent }}>change</button>
    </div>
  );
  return (
    <div className="relative">
      <input autoFocus={open} value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} className="w-full text-[13px] rounded-md px-2 outline-none" style={{ ...inp, height: 32, borderColor: invalid ? C.warn : C.line }} />
      {open && (
        <div className="absolute left-0 right-0 mt-1 rounded-md overflow-hidden z-10" style={{ background: C.surface, border: `1px solid ${C.line}`, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
          {results.length === 0 ? <p className="text-xs px-2.5 py-2" style={{ color: C.muted }}>No matches.</p> : results.map(p => (
            <button key={p.id} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(p.id); setQ(""); setOpen(false); }} className="w-full text-left px-2.5 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="block truncate text-[13px]">{p.name}</span>
              <span className="block truncate text-[11px]" style={{ color: C.muted }}>{p.articleId || "no ID"}</span>
            </button>
          ))}
          {products.length > results.length && !qq && <p className="text-[11px] px-2.5 py-1.5" style={{ color: C.muted, borderTop: `1px solid ${C.line}` }}>{products.length - results.length} more — keep typing to narrow it down</p>}
        </div>
      )}
    </div>
  );
}
// Searchable category picker — same pattern as ProductPicker, since the category tree can run to dozens of entries too.
function CategoryPicker({ categories, value, onChange, placeholder = "Search category…", invalid = false }) {
  const catPath = c => { const p = c.parentId && categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const [q, setQ] = useState(""); const [open, setOpen] = useState(false);
  const selected = categories.find(c => c.id === value);
  const qq = q.trim().toLowerCase();
  const results = (qq ? categories.filter(c => catPath(c).toLowerCase().includes(qq)) : categories).slice(0, 8);
  if (selected && !open) return (
    <div className="flex items-center gap-2 rounded-md px-2" style={{ ...inp, height: 32 }}>
      <span className="flex-1 min-w-0 truncate text-[13px]">{catPath(selected)}</span>
      <button onClick={() => { setQ(""); setOpen(true); }} className="text-xs flex-shrink-0" style={{ color: C.accent }}>change</button>
    </div>
  );
  return (
    <div className="relative">
      <input autoFocus={open} value={q} onChange={e => setQ(e.target.value)} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder={placeholder} className="w-full text-[13px] rounded-md px-2 outline-none" style={{ ...inp, height: 32, borderColor: invalid ? C.warn : C.line }} />
      {open && (
        <div className="absolute left-0 right-0 mt-1 rounded-md overflow-hidden z-10" style={{ background: C.surface, border: `1px solid ${C.line}`, maxHeight: 240, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
          {results.length === 0 ? <p className="text-xs px-2.5 py-2" style={{ color: C.muted }}>No matches.</p> : results.map(c => (
            <button key={c.id} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(c.id); setQ(""); setOpen(false); }} className="w-full text-left px-2.5 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="block truncate text-[13px]">{catPath(c)}</span>
            </button>
          ))}
          {categories.length > results.length && !qq && <p className="text-[11px] px-2.5 py-1.5" style={{ color: C.muted, borderTop: `1px solid ${C.line}` }}>{categories.length - results.length} more — keep typing to narrow it down</p>}
        </div>
      )}
    </div>
  );
}
function AnnouncementsPage({ s, set, user, notify }) {
  const [d, setD] = useState({ blocking: false, dashboard: true, product: false, category: false, title: "", body: "", productId: "", categoryId: "", validTo: "" });
  const controllers = s.users.filter(u => u.role === "Controller" && u.active !== false);
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "—"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const valid = d.title.trim() && d.body.trim() && (d.blocking || d.dashboard || d.product || d.category) && (!d.product || d.productId) && (!d.category || d.categoryId);
  const add = () => {
    if (!valid) return;
    const a = { id: uid(), isBlocking: d.blocking, showOnDashboard: d.dashboard, productId: d.product ? d.productId : null, categoryId: d.category ? d.categoryId : null, title: d.title.trim(), body: d.body.trim(), validTo: d.dashboard ? (d.validTo || null) : null, createdBy: user.id, createdAt: nowISO(), acks: {} };
    set(x => ({ ...x, announcements: [...x.announcements, a] }));
    if (a.isBlocking) controllers.forEach(c => notify("Announcement", `New blocking announcement: ${a.title}`, "Announcement", a.id, c.id));
    setD({ blocking: false, dashboard: true, product: false, category: false, title: "", body: "", productId: "", categoryId: "", validTo: "" });
  };
  const remove = id => set(x => ({ ...x, announcements: x.announcements.filter(a => a.id !== id) }));
  const list = [...s.announcements].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return (
    <div>
      <h1 className="mb-1">Announcements</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>One announcement, several channels — enable all of them to make sure it lands.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card>
          <p className="font-medium text-sm mb-3">New announcement</p>
          <p className="text-xs mb-1.5" style={{ color: C.muted }}>Channels — tick every one it should reach through:</p>
          {Object.entries(CHANNELS).map(([k, [l, desc]]) => <label key={k} className="flex items-start gap-2 text-sm mb-1.5 cursor-pointer"><input type="checkbox" checked={!!d[k]} onChange={e => setD(x => ({ ...x, [k]: e.target.checked }))} className="mt-1" /><span><b>{l}</b><span className="block text-xs" style={{ color: C.muted }}>{desc}</span></span></label>)}
          <div className="mb-2" />
          <input value={d.title} onChange={e => setD(x => ({ ...x, title: e.target.value }))} placeholder="title" className="w-full text-sm rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
          <textarea value={d.body} onChange={e => setD(x => ({ ...x, body: e.target.value }))} rows={3} placeholder="body" className="w-full text-sm rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
          {d.product && <div className="mb-2"><ProductPicker products={s.products} value={d.productId} onChange={id => setD(x => ({ ...x, productId: id }))} invalid={!d.productId} /></div>}
          {d.category && <div className="mb-2"><CategoryPicker categories={s.categories} value={d.categoryId} onChange={id => setD(x => ({ ...x, categoryId: id }))} invalid={!d.categoryId} /></div>}
          {d.dashboard && <label className="text-xs flex items-center gap-2 mb-2" style={{ color: C.muted }}>on the dashboard until <input type="date" value={d.validTo} onChange={e => setD(x => ({ ...x, validTo: e.target.value }))} className="text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /> (empty = no expiry)</label>}
          <Primary onClick={add} disabled={!valid}>Publish</Primary>
        </Card>
        <Card>
          {list.length === 0 ? <Empty icon="📣" title="No announcements" hint="Publish the first one on the left." /> : list.map(a => { const acked = Object.keys(a.acks || {}).length; return (
            <div key={a.id} className="py-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2 mb-1 flex-wrap">{annChannels(a).map(k => <span key={k} className="text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1.5" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.ink }}><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: k === "blocking" ? C.bad : k === "product" ? C.warn : k === "category" ? C.ok : C.accent }} />{CHANNELS[k][0]}</span>)}<span className="text-sm font-medium flex-1">{a.title}</span><button onClick={() => remove(a.id)} className="text-xs" style={{ color: C.muted }}>×</button></div>
              <p className="text-sm mb-1">{a.body}</p>
              <p className="text-xs" style={{ color: C.muted }}>{fmtTime(a.createdAt)}{a.productId && ` · ${s.products.find(p => p.id === a.productId)?.name}`}{a.categoryId && ` · ${catPath(a.categoryId)}`}{a.validTo && ` · dashboard until ${a.validTo}`}{a.showOnDashboard && !annActive(a) && " · expired on the dashboard"}</p>
              {a.isBlocking && (
                <div className="group relative inline-block mt-1">
                  <p className="text-xs cursor-help underline decoration-dotted" style={{ color: C.muted }}>acknowledged by {acked}/{controllers.length}</p>
                  <div className="hidden group-hover:block absolute left-0 top-full mt-1 rounded-lg p-2 z-10" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 4px 16px rgba(0,0,0,.08)", minWidth: 160 }}>
                    {controllers.map(c => <p key={c.id} className="text-xs whitespace-nowrap" style={{ color: a.acks?.[c.id] ? C.ok : C.muted }}>{c.name}{a.acks?.[c.id] ? " ✓" : " · not yet"}</p>)}
                  </div>
                </div>
              )}
            </div>
          ); })}
        </Card>
      </div>
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

// ═══════════════════ MODULE 4: Messages (1:1 and groups) ═══════════════════
const unreadIn = (conv, userId) => { const last = (conv.lastRead || {})[userId] || ""; return (conv.messages || []).filter(m => m.senderId !== userId && (m.at || "") > last).length; };
const convName = (conv, s, userId) => conv.name || conv.participantIds.filter(id => id !== userId).map(id => s.users.find(u => u.id === id)?.name).join(", ") || "(empty)";
function MessagesPage({ s, set, user, setPage, onOpenProduct, onOpenInspection, onOpenCategory, initialContext, clearInitialContext }) {
  const [open, setOpen] = useState(null); const [text, setText] = useState(""); const [creating, setCreating] = useState(false); const [pick, setPick] = useState([]); const [gname, setGname] = useState("");
  const mine = s.conversations.filter(c => c.participantIds.includes(user.id) && c.isActive !== false).sort((a, b) => ((b.messages?.slice(-1)[0]?.at) || b.createdAt || "").localeCompare((a.messages?.slice(-1)[0]?.at) || a.createdAt || ""));
  const conv = s.conversations.find(c => c.id === open);
  const others = s.users.filter(u => u.id !== user.id && u.active !== false);
  const markRead = id => set(x => ({ ...x, conversations: x.conversations.map(c => c.id === id ? { ...c, lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) }));
  const openConv = id => { setOpen(id); markRead(id); };
  const [pending, setPending] = useState({ attachments: [], contexts: initialContext ? [initialContext] : [] });
  useEffect(() => { if (initialContext) { setPending(p => ({ ...p, contexts: [...p.contexts.filter(c => !(c.kind === initialContext.kind && c.id === initialContext.id)), initialContext] })); clearInitialContext && clearInitialContext(); } }, [initialContext]);
  const send = () => { if ((!text.trim() && !pending.attachments.length && !pending.contexts.length) || !conv) return; set(x => ({ ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, messages: [...(c.messages || []), { id: uid(), senderId: user.id, text: text.trim(), at: nowISO(), attachments: pending.attachments, contexts: pending.contexts, productId: pending.contexts.find(k => k.kind === "product")?.id || null }], lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) })); setText(""); setPending({ attachments: [], contexts: [] }); };
  const openCtx = c => { if (c.kind === "product") { setPage && setPage("products"); onOpenProduct && onOpenProduct(c.id); } else if (c.kind === "inspection") { onOpenInspection && onOpenInspection(c.id); } else if (c.kind === "flag") { setPage && setPage("flags"); } else if (c.kind === "category") { setPage && setPage("categories"); onOpenCategory && onOpenCategory(c.id); } };
  const create = () => {
    if (!pick.length) return;
    const isGroup = pick.length > 1 || !!gname.trim();
    if (!isGroup) { const existing = s.conversations.find(c => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(user.id) && c.participantIds.includes(pick[0])); if (existing) { openConv(existing.id); setCreating(false); setPick([]); return; } }
    const id = uid();
    set(x => ({ ...x, conversations: [...x.conversations, { id, isGroup, name: isGroup ? (gname.trim() || null) : null, participantIds: [user.id, ...pick], createdBy: user.id, createdAt: nowISO(), messages: [], lastRead: { [user.id]: nowISO() }, isActive: true }] }));
    setOpen(id); setCreating(false); setPick([]); setGname("");
  };
  const leave = () => { if (!conv || !conv.isGroup) return; set(x => ({ ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, participantIds: c.participantIds.filter(id => id !== user.id), removed: { ...(c.removed || {}), [user.id]: nowISO() } } : c) })); setOpen(null); };
  return (
    <div>
      <h1 className="mb-1">Messages</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>1:1 and group conversations (Conversation + ConversationParticipant + Message). Unread counter from LastReadAt.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.6fr" }}>
        <Card>
          <div className="flex items-center justify-between mb-2"><p className="font-medium text-sm">Conversations</p><Ghost onClick={() => setCreating(o => !o)}>{creating ? "cancel" : "+ new"}</Ghost></div>
          {creating && (
            <div className="rounded-lg p-2 mb-2" style={{ background: C.bg }}>
              <p className="text-xs mb-1.5" style={{ color: C.muted }}>Pick people — one = 1:1 conversation, more = group.</p>
              {others.map(u => <label key={u.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer"><input type="checkbox" checked={pick.includes(u.id)} onChange={e => setPick(p => e.target.checked ? [...p, u.id] : p.filter(x => x !== u.id))} />{u.name}<span className="text-xs" style={{ color: C.muted }}>{u.role === "Head" ? "Head" : "Controller"}</span></label>)}
              {pick.length > 1 && <input value={gname} onChange={e => setGname(e.target.value)} placeholder="group name (optional)" className="w-full text-xs rounded px-2 py-1 outline-none my-1.5" style={{ ...inp }} />}
              <Primary small onClick={create} disabled={!pick.length}>Create</Primary>
            </div>
          )}
          {mine.length === 0 && !creating && <p className="text-xs" style={{ color: C.muted }}>No conversations.</p>}
          {mine.map(c => { const un = unreadIn(c, user.id); const last = (c.messages || []).slice(-1)[0]; return (
            <button key={c.id} onClick={() => openConv(c.id)} className="w-full text-left px-2 py-2 rounded-lg mb-0.5" style={{ background: open === c.id ? C.accentSoft : "transparent", borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-center gap-2"><span className="text-sm flex-1 truncate" style={{ fontWeight: un ? 600 : 400 }}>{c.isGroup ? <Ic i={Users} s={13} mr={5} /> : null}{convName(c, s, user.id)}</span>{un > 0 && <span className="text-[10px] px-1.5 rounded-full" style={{ background: C.bad, color: C.onDark }}>{un}</span>}</div>
              {last && <p className="text-xs truncate" style={{ color: C.muted }}>{s.users.find(u => u.id === last.senderId)?.name.split(" ")[0]}: {last.text}</p>}
            </button>
          ); })}
        </Card>
        <Card>
          {!conv ? <Empty icon="💬" title="Select a conversation" hint="Or start a new one on the left." /> : (
            <>
              <div className="flex items-center gap-2 mb-2"><p className="font-medium text-sm flex-1">{conv.isGroup ? <Ic i={Users} s={13} mr={5} /> : null}{convName(conv, s, user.id)}</p><span className="text-xs" style={{ color: C.muted }}>{conv.participantIds.map(id => s.users.find(u => u.id === id)?.name.split(" ")[0]).join(", ")}</span>{conv.isGroup && <button onClick={leave} className="text-xs" style={{ color: C.muted }}>leave</button>}</div>
              <div className="rounded-lg p-3 mb-2 overflow-y-auto" style={{ background: C.bg, minHeight: 220, maxHeight: 360 }}>
                {(conv.messages || []).length === 0 && <p className="text-xs" style={{ color: C.muted }}>Write the first message.</p>}
                {(conv.messages || []).map(m => { const me = m.senderId === user.id; return <div key={m.id} className={`flex mb-1.5 ${me ? "justify-end" : "justify-start"}`}><div className="rounded-xl px-3 py-1.5 max-w-[75%]" style={{ background: me ? C.accent : C.surface, color: me ? C.onDark : C.ink, border: me ? "none" : `1px solid ${C.line}` }}>{!me && conv.isGroup && <p className="text-[10px] font-medium" style={{ color: C.accent }}>{s.users.find(u => u.id === m.senderId)?.name}</p>}<ContextChips s={s} contexts={m.contexts?.length ? m.contexts : (m.productId ? [{ kind: "product", id: m.productId }] : [])} onOpen={openCtx} dark={me} /><AttachmentList attachments={m.attachments} dark={me} />{m.text && <p className="text-sm" style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>}<p className="text-[10px] mt-0.5" style={{ color: me ? C.onDarkMuted : C.muted }}>{fmtTime(m.at)}</p></div></div>; })}
              </div>
              <ComposerExtras s={s} user={user} pending={pending} setPending={setPending} />
              <div className="flex gap-1.5 items-end"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); } }} placeholder="message… (Enter for a new line, ⌘/Ctrl+Enter to send)" rows={1} className="flex-1 text-sm rounded px-2 py-1.5 outline-none resize-none" style={{ ...inp, maxHeight: 120 }} /><Primary small onClick={send}>Send</Primary></div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Product flags ═══════════════════
function FlagsPage({ s, set, user }) {
  const [res, setRes] = useState({});
  const resolve = id => set(x => ({ ...x, flags: x.flags.map(f => f.id === id ? { ...f, status: "Resolved", resolution: (res[id] || "").trim() || "resolved", resolvedBy: user.id, resolvedAt: nowISO() } : f) }));
  const list = [...s.flags].sort((a, b) => (a.status === "Open" ? 0 : 1) - (b.status === "Open" ? 0 : 1) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  return (
    <div>
      <h1 className="mb-1">Product flags</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>The controller reports from an inspection or the catalog that something in the profile is wrong (ProductFlag). The Head resolves it.</p>
      <Card>
        {list.length === 0 ? <Empty icon="🚩" title="No flags" hint="The controller can report a product profile issue with the 🚩 button during an inspection." /> : list.map(f => { const p = s.products.find(x => x.id === f.productId); return (
          <div key={f.id} className="py-3" style={{ borderTop: `1px solid ${C.line}`, opacity: f.status === "Resolved" ? 0.6 : 1 }}>
            <div className="flex items-center gap-2 mb-1"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: f.status === "Open" ? C.warnBg : C.okBg, color: f.status === "Open" ? C.warn : C.ok }}>{f.status === "Open" ? "open" : "resolved"}</span><span className="text-sm font-medium">{p?.name}</span><span className="text-xs" style={{ color: C.muted }}>{s.users.find(u => u.id === f.raisedBy)?.name} · {fmtTime(f.createdAt)}{f.inspectionId && " · from inspection"}</span></div>
            <p className="text-sm mb-2">„{f.description}"</p>
            {f.status === "Open" ? (user.role === "Head" ? <div className="flex gap-2"><input value={res[f.id] || ""} onChange={e => setRes(x => ({ ...x, [f.id]: e.target.value }))} placeholder="what was done?" className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} /><Primary small onClick={() => resolve(f.id)}>Resolve</Primary></div> : <p className="text-xs" style={{ color: C.muted }}>Awaiting the Head.</p>)
              : <p className="text-xs" style={{ color: C.muted }}>✓ {f.resolution} — {s.users.find(u => u.id === f.resolvedBy)?.name}, {fmtTime(f.resolvedAt)}</p>}
          </div>
        ); })}
      </Card>
    </div>
  );
}

// ═══════════════════ STRONA: Notifications ═══════════════════
function NotificationsPage({ s, set, user, setPage, setOpenId, setSelProduct }) {
  const mine = s.notifications.filter(n => n.userId === user.id).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const markRead = id => set(x => ({ ...x, notifications: x.notifications.map(n => n.id === id ? { ...n, readAt: n.readAt || nowISO() } : n) }));
  const markAll = () => set(x => ({ ...x, notifications: x.notifications.map(n => n.userId === user.id && !n.readAt ? { ...n, readAt: nowISO() } : n) }));
  return (
    <div>
      <div className="flex items-center justify-between mb-1"><h1>Notifications</h1>{mine.some(n => !n.readAt) && <Ghost onClick={markAll}>mark all as read</Ghost>}</div>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>One generic table (Notification) fed by: tolerance exceeded, accepted despite exceeding, escalation, answer, flag, editing someone else's report.</p>
      <Card>
        {mine.length === 0 ? <Empty icon="🔔" title="Quiet" hint="Nothing needs your attention." /> : mine.map(n => (
          <button key={n.id} onClick={() => { markRead(n.id); if (n.entityType === "Inspection" && n.entityId) { setOpenId(n.entityId); setPage("inspections"); } if (n.entityType === "ProductFlag") setPage("flags"); if (n.entityType === "Conversation") setPage("messages"); if (n.entityType === "Product" && n.entityId) { setSelProduct(n.entityId); setPage("products"); } }} className="w-full text-left flex items-center gap-3 px-2 py-2.5" style={{ borderTop: `1px solid ${C.line}`, background: n.readAt ? "transparent" : C.accentSoft }}>
            <NotifIcon type={n.type} />
            <span className="flex-1 min-w-0"><span className="block text-sm" style={{ fontWeight: n.readAt ? 400 : 500 }}>{cleanMsg(n.message)}</span><span className="block text-[11px]" style={{ color: C.muted }}>{fmtTime(n.createdAt)}</span></span>
            {!n.readAt && <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: C.accent }} />}
          </button>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════ PAGE: Blocked pallets — the shared work queue ═══════════════════
// Lost pallets: the hand-off list for whoever hunts them down (not QC). Everything marked lost, by whom and when, plus
// whether the sheet still lists it. Found here or on the phone clears it; a completed inspection on the pallet clears it too.
function LostPalletsPage({ s, set, user, setSel, setPage }) {
  const rows = [...dockRowsLive(s).map(r => ({ ...r, kind: "dock" })), ...blockedRowsLive(s).map(r => ({ ...r, kind: "blocked" }))];
  const marks = Object.entries(s.lostPallets || {}).map(([key, m]) => { const row = rows.find(r => lostKey(r) === key) || null; const live = row ? lostOf(s, row) : m; const by = s.users.find(u => u.id === m.byUserId); const product = s.products.find(p => p.articleId === (row?.article || m.article)); return { key, m, row, by, product, cleared: !live, name: row?.name || m.name || product?.name || m.article, article: row?.article || m.article, hu: row?.hu || m.hu, location: row?.location || m.location }; })
    .sort((a, b) => (a.cleared - b.cleared) || (b.m.at || "").localeCompare(a.m.at || ""));
  const open = marks.filter(x => !x.cleared);
  const forget = key => set(x => { const lp = { ...(x.lostPallets || {}) }; delete lp[key]; return { ...x, lostPallets: lp }; });
  return (
    <div>
      <h1 className="mb-1">Lost pallets</h1>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>Pallets a controller couldn't find on the docks — moved without a scan. QC stops chasing them; this is the list for whoever does. Marked ones stay in the app, dimmed, and raise no alerts.</p>
      {!marks.length ? <Card><Empty icon="🔍" title="Nothing marked lost" hint="Controllers mark a pallet lost from its screen on the phone." /></Card> : <Card>
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr style={{ color: C.muted }} className="text-xs text-left">{["Product", "Article", "HU", "Last seen", "List", "Marked by", "When", "Note", ""].map(h => <th key={h} className="py-2 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>
            {marks.map(x => (
              <tr key={x.key} style={{ opacity: x.cleared ? .5 : 1, borderBottom: `1px solid ${C.line}` }}>
                <td className="py-2 pr-3">{x.product ? <button onClick={() => { setSel(x.product.id); setPage("products"); }} className="underline text-left" style={{ color: C.accent }}>{x.name}</button> : x.name}</td>
                <td className="py-2 pr-3 font-mono text-xs">{x.article}</td>
                <td className="py-2 pr-3 font-mono text-xs">{x.hu ? `…${String(x.hu).slice(-8)}` : "—"}</td>
                <td className="py-2 pr-3">{x.location || "—"}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: C.muted }}>{x.row ? (x.row.kind === "blocked" ? "blocked sheet" : "dock sheet") : "off the sheets"}</td>
                <td className="py-2 pr-3">{x.by ? <span className="inline-flex items-center gap-1.5"><Avatar user={x.by} size={18} />{x.by.name}</span> : "?"}</td>
                <td className="py-2 pr-3 text-xs">{fmtTime(x.m.at)}</td>
                <td className="py-2 pr-3 text-xs" style={{ color: C.muted }}>{x.m.note || ""}</td>
                <td className="py-2 text-right whitespace-nowrap">{x.cleared ? <span className="text-xs" style={{ color: C.ok }}>found</span> : x.row ? <button onClick={() => markFound(set, x.row, user)} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Found</button> : <button onClick={() => forget(x.key)} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Clear</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {open.length > 0 && <p className="text-[11px] mt-3" style={{ color: C.muted }}>{open.length} still lost. Print or share this page with whoever tracks them; an outbound message (SV / WMS) can be hooked to markLost() later.</p>}
      </Card>}
    </div>
  );
}
// Unreported pallets: the audit trail for "who moved this without QC ever seeing it". Detected server-side on every
// dock push (server/misslogic.mjs) — a pallet lands here once it has been missing from the dock sheet for a full
// push cycle with no completed report covering it, so this page updates itself even with nobody's app open.
// Both roles can see it (the Head from here and Controllers from their own nav item / phone); only the Head can
// mark an incident reviewed — a permanent note, not a dismissal, since the point is a record, not a to-do list.
function UnreportedPalletsPage({ s, set, user, setSel, setPage }) {
  const [view, setView] = useState("open");
  const [notes, setNotes] = useState({});
  const isHead = user.role === "Head";
  const stats = unreportedStats(s);
  const shown = (view === "open" ? unreportedList(s).filter(x => !x.reviewedAt) : unreportedList(s));
  const groups = []; shown.forEach(x => { const k = dayLabel(x.detectedAt); let g = groups.find(g => g.k === k); if (!g) { g = { k, items: [] }; groups.push(g); } g.items.push(x); });
  const review = id => { reviewUnreported(set, id, user, notes[id] || ""); setNotes(n => { const { [id]: _, ...rest } = n; return rest; }); };
  return (
    <div>
      <h1 className="mb-1">Unreported pallets</h1>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>Pallets that dropped off the dock sheet — picked or moved on — before QC ever inspected them. Nobody scans a pallet that leaves this way, so without this list nobody would know it happened. Detected automatically from the dock pushes, independent of anyone having the app open; a pallet is only logged once it has stayed missing for a full push cycle, so a brief sheet hiccup (a formula recalculating) doesn't get logged as a real incident.</p>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {[["Today", stats.today, C.bad], ["This week", stats.week, C.warn], ["Open", stats.open, C.warn], ["Total logged", stats.total, C.muted]].map(([l, v, col]) => (
          <div key={l} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold">{v}</p></div>
        ))}
      </div>
      <div className="flex gap-1.5 mb-3">{[["open", "Open"], ["all", "All incl. reviewed"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: view === k ? C.ink : "transparent", color: view === k ? C.onDark : C.ink, border: `1px solid ${view === k ? C.ink : C.line}` }}>{l}</button>)}</div>
      {!shown.length ? <Card><Empty icon="🛡️" title={view === "open" ? "Nothing open" : "Nothing logged yet"} hint={view === "open" ? "Every disappearance so far has been reviewed." : "As soon as a pallet leaves the dock sheet without ever being reported, it shows up here."} /></Card> : groups.map(g => (
        <div key={g.k} className="mb-5">
          <p className="label-sm mb-2" style={{ color: C.muted }}>{g.k} · {g.items.length} pallet{g.items.length === 1 ? "" : "s"}</p>
          <Card>
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead><tr style={{ color: C.muted }} className="text-xs text-left">{["Product", "Article", "HU", "Location", "Priority", "PO", "Transporter", "Last seen", "Gone since", isHead ? "Review" : "Status"].map(h => <th key={h} className="py-2 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
              <tbody>
                {g.items.map(x => { const product = s.products.find(p => p.articleId === x.article); const reviewer = s.users.find(u => u.id === x.reviewedByUserId); return (
                  <tr key={x.id} style={{ borderBottom: `1px solid ${C.line}`, opacity: x.reviewedAt ? .6 : 1 }}>
                    <td className="py-2 pr-3">{product ? <button onClick={() => { setSel(product.id); setPage("products"); }} className="underline text-left" style={{ color: C.accent }}>{x.name || product.name}</button> : (x.name || x.article || "—")}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{x.article || "—"}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{x.hu ? `…${String(x.hu).slice(-8)}` : "—"}</td>
                    <td className="py-2 pr-3">{x.location || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{x.priority || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{x.po || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{x.transporter || "—"}</td>
                    <td className="py-2 pr-3 text-xs">{fmtTime(x.lastSeenAt)}</td>
                    <td className="py-2 pr-3 text-xs">{fmtTime(x.detectedAt)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      {x.reviewedAt ? <span className="text-xs"><span style={{ color: C.ok }}>✓ reviewed</span>{reviewer ? ` by ${reviewer.name.split(" ")[0]}` : ""}{x.reviewNote ? ` — “${x.reviewNote}”` : ""}{isHead && <button onClick={() => unreviewUnreported(set, x.id)} className="ml-2 underline" style={{ color: C.muted }}>undo</button>}</span>
                        : isHead ? <span className="inline-flex items-center gap-1"><input value={notes[x.id] || ""} onChange={e => setNotes(n => ({ ...n, [x.id]: e.target.value }))} onKeyDown={e => e.key === "Enter" && review(x.id)} placeholder="note (optional)" className="text-xs" style={{ width: 120, padding: "3px 6px" }} /><button onClick={() => review(x.id)} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Mark reviewed</button></span>
                          : <span className="text-xs" style={{ color: C.warn }}>open</span>}
                    </td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </Card>
        </div>
      ))}
    </div>
  );
}
function BlockedQueuePage({ s, set, user, setSel, setPage }) {
  const [view, setView] = useState("open");
  const q = blockedQueue(s); const order = { "Not started": 0, "Started": 1, "Completed": 2 };
  const list = q.filter(b => view === "all" ? true : view === "mine" ? b.claim?.userId === user.id : b.status !== "Completed").sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.time || "").localeCompare(b.time || ""));
  const open = q.filter(b => b.status !== "Completed"); const taken = open.filter(b => b.claim && b.claim.status === "taken"); const stacked = open.filter(b => b.claim?.status === "stacked");
  const sm = blockedSummary(s);
  return (
    <div>
      <h1 className="mb-1">Blocked pallets</h1>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>Pallets picking is waiting for, from the blocked-pallets sheet. Controllers take them from the queue so two people don't walk to the same pallet; “in stack” marks pallets that can't be reached yet.</p>
      {!q.length ? <Card><Empty icon="📋" title="No blocked pallets" hint={sm ? "The sheet reports nothing blocked." : "Connect the blocked-pallets sheet in Integrations."} /></Card> : <>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          {[["Open", open.length, C.bad], ["Taken", taken.length, C.accent], ["In stack", stacked.length, C.muted], ["Unassigned", open.length - taken.length - stacked.length, C.warn]].map(([l, v, col]) => <div key={l} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold">{v}</p></div>)}
        </div>
        <div className="flex gap-1.5 mb-3">{[["open", "Open"], ["mine", "Mine"], ["all", "All incl. done"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: view === k ? C.ink : "transparent", color: view === k ? C.onDark : C.ink, border: `1px solid ${view === k ? C.ink : C.line}` }}>{l}</button>)}</div>
        <Card>{list.length === 0 ? <p className="text-xs py-4" style={{ color: C.muted }}>Nothing here.</p> : list.map(b => { const prod = s.products.find(p => p.articleId === b.article); return <QueueRow key={b.key} s={s} set={set} user={user} b={b} onOpen={() => { if (prod) { setSel(prod.id); setPage("products"); } }} />; })}</Card>
      </>}
    </div>
  );
}

// ═══════════════════ PAGE: Lists (Dictionaries + DictionaryItems) — Head-defined value lists, attached to form fields ═══════════════════
function ListsPage({ s, set }) {
  const [sel, setSel] = useBackSel("listsSel", null); const [name, setName] = useState(""); const [item, setItem] = useState("");
  const lists = s.dictionaries || []; const cur = lists.find(d => d.id === sel);
  const patchList = (id, fn) => set(x => ({ ...x, dictionaries: x.dictionaries.map(d => d.id === id ? (typeof fn === "function" ? fn(d) : { ...d, ...fn }) : d) }));
  const addList = () => { if (!name.trim()) return; const id = uid(); set(x => ({ ...x, dictionaries: [...(x.dictionaries || []), { id, name: name.trim(), items: [], isActive: true }] })); setName(""); setSel(id); };
  const addItem = () => { if (!item.trim() || !cur) return; patchList(cur.id, d => ({ ...d, items: [...d.items, { id: uid(), value: item.trim() }] })); setItem(""); };
  const usage = id => s.templates.reduce((n, t) => n + (t.fields || []).filter(f => f.type === "List" && f.dictionaryId === id).length, 0);
  return (
    <div>
      <h1 className="mb-1">Lists</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>Your own value lists — countries, classes, brands, pack types, anything. Attach a list to a form field of type “Choice from list”; the same list can serve many fields and templates.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1.4fr" }}>
        <div>
          <Card style={{ marginBottom: 12 }}>
            {lists.length === 0 ? <Empty icon="📋" title="No lists yet" hint="Create the first one below — e.g. Countries." /> : lists.map(d => <button key={d.id} onClick={() => setSel(d.id)} className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg row" style={{ background: sel === d.id ? C.accentSoft : "transparent", borderTop: `1px solid ${C.line}` }}><span className="flex-1 text-sm" style={{ color: sel === d.id ? C.accent : C.ink }}>{d.name}</span><span className="text-xs" style={{ color: C.muted }}>{d.items.length} values · {usage(d.id)} fields</span></button>)}
          </Card>
          <Card>
            <p className="font-medium text-sm mb-2">New list</p>
            <div className="flex gap-1.5"><input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && addList()} placeholder="e.g. Pack types" className="flex-1 text-sm" /><Primary onClick={addList} small>Create</Primary></div>
          </Card>
        </div>
        {cur ? (
          <Card>
            <div className="flex items-center gap-2 mb-1"><input value={cur.name} onChange={e => patchList(cur.id, { name: e.target.value })} className="font-medium text-sm flex-1" /><button onClick={() => { set(x => ({ ...x, dictionaries: x.dictionaries.filter(d => d.id !== cur.id) })); setSel(null); }} className="text-xs px-2" style={{ color: C.muted }} title={usage(cur.id) ? "used by form fields — they will show an empty list" : "delete list"}>delete</button></div>
            <p className="text-xs mb-3" style={{ color: C.muted }}>{usage(cur.id)} form field{usage(cur.id) === 1 ? "" : "s"} use this list.</p>
            <div className="flex gap-1.5 mb-3"><input value={item} onChange={e => setItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} placeholder="new value" className="flex-1 text-sm" /><Ghost onClick={addItem}>Add</Ghost></div>
            {cur.items.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>No values yet.</p> : cur.items.map((it, i) => <div key={it.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><input value={it.value} onChange={e => patchList(cur.id, d => ({ ...d, items: d.items.map(x => x.id === it.id ? { ...x, value: e.target.value } : x) }))} className="flex-1 text-sm bg-transparent" style={{ border: "none", minHeight: 0, padding: 0 }} /><button onClick={() => patchList(cur.id, d => { const a = [...d.items]; if (i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...d, items: a }; })} className="text-xs px-1" style={{ color: C.muted }}>↑</button><button onClick={() => patchList(cur.id, d => { const a = [...d.items]; if (i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]]; return { ...d, items: a }; })} className="text-xs px-1" style={{ color: C.muted }}>↓</button><button onClick={() => patchList(cur.id, d => ({ ...d, items: d.items.filter(x => x.id !== it.id) }))} className="text-xs px-1" style={{ color: C.muted }}>×</button></div>)}
          </Card>
        ) : <Card><Empty icon="📋" title="Select a list" hint="Values are edited on this side. Lists are shared by the whole system." /></Card>}
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Settings system (SystemSettings) ═══════════════════
function SettingsPage({ s, set }) {
  const st = settingsOf(s);
  const put = p => set(x => ({ ...x, settings: { ...settingsOf(x), ...p } }));
  return (
    <div>
      <h1 className="mb-1">Settings</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>System-wide rules (SystemSettings, key–value). Categories and products can override what applies to them.</p>
      <Card style={{ marginBottom: 16 }}>
        <h2 className="mb-1">Inspection types</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Defined in Forms (each type has its own form layers). Here: which types products are allowed to use when neither the product nor its category says otherwise.</p>
        {typesOf(s).map(t => <label key={t.id} className="flex items-center gap-3 text-sm py-2 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={!!t.allowedByDefault} onChange={e => set(x => ({ ...x, inspectionTypes: x.inspectionTypes.map(y => y.id === t.id ? { ...y, allowedByDefault: e.target.checked } : y) }))} /><span className="inline-block rounded-full" style={{ width: 8, height: 8, background: t.color }} /><span className="flex-1">{t.name}<span className="block text-[11px]" style={{ color: C.muted }}>{t.autoAccept ? "auto-accept" : "verdict"} · {t.countsAsInspection ? "counts as inspection" : "trace only"} · reason {t.reason}</span></span><span className="text-xs" style={{ color: C.muted }}>{s.products.filter(p => policyAllows(effectivePolicy(s, p), t.id)).length} products allowed</span></label>)}
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h2 className="mb-1">Report header</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Printed on every page of the PDF — the supplier must know who sent it and where to reply.</p>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <label className="text-xs" style={{ color: C.muted }}>Company<input value={st.companyName} onChange={e => put({ companyName: e.target.value })} className="w-full text-sm mt-1" /></label>
          <label className="text-xs" style={{ color: C.muted }}>QC contact e-mail<input value={st.qcEmail} onChange={e => put({ qcEmail: e.target.value })} className="w-full text-sm mt-1" /></label>
        </div>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h2 className="mb-1">Report result icon</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Optional stamp pasted in the top-right corner of the PDF, picked by the inspection's result. Leave a result blank to show no icon for it.</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
          {["Accepted", "Rejected"].map(r => (
            <div key={r}>
              <p className="text-xs font-medium mb-1.5" style={{ color: r === "Accepted" ? C.ok : C.bad }}>{r}</p>
              <PhotoStrip photos={st.resultIcons?.[r] ? [st.resultIcons[r]] : []}
                onAdd={got => put({ resultIcons: { ...(st.resultIcons || {}), [r]: got[got.length - 1] } })}
                onRemove={() => put({ resultIcons: { ...(st.resultIcons || {}), [r]: null } })}
                size={56} addLabel="Add icon" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════ STRONA: Users (panel admina) ═══════════════════
function UsersPage({ s, set }) {
  const [d, setD] = useState({ name: "", email: "", role: "Controller" });
  const add = () => { if (!d.name.trim()) return; set(x => ({ ...x, users: [...x.users, { id: uid(), name: d.name.trim(), email: d.email.trim(), role: d.role, active: true }] })); setD({ name: "", email: "", role: "Controller" }); };
  const toggle = id => set(x => ({ ...x, users: x.users.map(u => u.id === id ? { ...u, active: !u.active } : u) }));
  return (
    <div>
      <h1 className="mb-1">Users</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>Accounts are created only by the Admin/Head (no public sign-up). Deactivation instead of deletion — inspection history stays.</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "1.2fr 1fr" }}>
        <Card>{s.users.map(u => <div key={u.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}`, opacity: u.active === false ? 0.5 : 1 }}><Avatar user={u} size={30} onPick={url => set(x => ({ ...x, users: x.users.map(q => q.id === u.id ? { ...q, photoUrl: url } : q) }))} /><span className="flex-1 text-sm">{u.name}<span className="text-xs ml-2" style={{ color: C.muted }}>{u.email}</span></span><input type="password" inputMode="numeric" value={u.pin || ""} onChange={e => set(x => ({ ...x, users: x.users.map(q => q.id === u.id ? { ...q, pin: e.target.value.replace(/\D/g, "").slice(0, 6) } : q) }))} placeholder="PIN" title="Sign-in PIN (4–6 digits). Empty = signs in without a PIN." className="text-xs font-mono" style={{ width: 64, minHeight: 28 }} /><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: u.role === "Head" ? C.accentSoft : C.line, color: u.role === "Head" ? C.accent : C.muted }}>{u.role === "Head" ? "Head" : "Controller"}</span><button onClick={() => toggle(u.id)} className="text-xs" style={{ color: C.muted }}>{u.active === false ? "activate" : "deactivate"}</button><button className="text-xs" style={{ color: C.muted }} title="sends a reset link (PasswordResetTokens)">reset password</button></div>)}</Card>
        <Card>
          <p className="font-medium text-sm mb-3">New account</p>
          <div className="flex gap-1.5 mb-2"><input value={d.firstName || ""} onChange={e => setD(x => ({ ...x, firstName: e.target.value, name: `${e.target.value} ${x.lastName || ""}`.trim() }))} placeholder="first name" className="flex-1 text-sm" /><input value={d.lastName || ""} onChange={e => setD(x => ({ ...x, lastName: e.target.value, name: `${x.firstName || ""} ${e.target.value}`.trim() }))} placeholder="last name" className="flex-1 text-sm" /></div>
          <input value={d.email} onChange={e => setD(x => ({ ...x, email: e.target.value }))} placeholder="email (login)" className="w-full text-sm rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
          <select value={d.role} onChange={e => setD(x => ({ ...x, role: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mb-3" style={{ ...inp }}><option value="Controller">Controller</option><option value="Head">Head of Quality</option></select>
          <Primary onClick={add}>Create account</Primary>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════ APLIKACJA ═══════════════════
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
const STORAGE_KEY = "qcteam-portal-state-v2-clean"; // clean start: a fresh key, so the previous test data stays untouched under v1
const CLEAN_START = true; // no dock mock until the Head maps a sheet in Integrations
// Ola's state from 15.09.2026 — embedded as initial/sample data
const OLA_STATE = {"categories": [{"id": "p4x8t0m", "name": "Blauwe bessen", "parentId": null, "specs": [], "varieties": []}, {"id": "mxqoe4k", "name": "Apples", "parentId": null, "specs": [{"id": "s4taab7", "name": "Brix", "unit": "", "min": "6", "max": "20"}], "varieties": []}, {"id": "drz3z6m", "name": "Mango", "parentId": null, "specs": [{"id": "g3n53rg", "name": "Firmness", "unit": "Lb", "min": "2", "max": "8"}, {"id": "4nj0j78", "name": "Brix", "unit": "%", "min": "10", "max": "25"}], "varieties": [{"id": "8dyx4cz", "name": "Kent"}]}], "problems": [{"id": "mtpphih", "parentId": null, "name": "Quality problems", "tolerance": "10"}, {"id": "70d42hr", "parentId": "mtpphih", "name": "Minor remarks", "tolerance": null}, {"id": "9eeirk1", "parentId": "mtpphih", "name": "Major remarks", "tolerance": "1"}, {"id": "jo6un9q", "parentId": null, "name": "General problems", "tolerance": "0"}, {"id": "z5ms2q7", "parentId": "jo6un9q", "name": "Pallet problems", "tolerance": null}, {"id": "eh9qntt", "parentId": "jo6un9q", "name": "Pallet appearance", "tolerance": null}, {"id": "3qmhz5q", "parentId": "70d42hr", "name": "Color defect", "tolerance": null}, {"id": "kj8t05r", "parentId": "70d42hr", "name": "Skin defect", "tolerance": null}, {"id": "5tey28b", "parentId": "70d42hr", "name": "Handling damage", "tolerance": null}, {"id": "bcznpkc", "parentId": "70d42hr", "name": "Shape defect", "tolerance": null}, {"id": "kxbg8ev", "parentId": "9eeirk1", "name": "Dacay", "tolerance": null}, {"id": "hd7t0nm", "parentId": "9eeirk1", "name": "Mold", "tolerance": null}, {"id": "n0xr3us", "parentId": "9eeirk1", "name": "Bleeding", "tolerance": null}, {"id": "ue6vk3a", "parentId": "9eeirk1", "name": "Dehydration", "tolerance": null}, {"id": "nbzoep3", "parentId": "z5ms2q7", "name": "Damage pallet", "tolerance": null}, {"id": "niq392o", "parentId": "z5ms2q7", "name": "Risk of collapse", "tolerance": null}, {"id": "n53sn7s", "parentId": "z5ms2q7", "name": "Wrong produce", "tolerance": null}, {"id": "m2bgia7", "parentId": "eh9qntt", "name": "Broken wood", "tolerance": null}, {"id": "vsvukid", "parentId": "eh9qntt", "name": "Tilled pallet", "tolerance": null}, {"id": "99gt51u", "parentId": "eh9qntt", "name": "Without strips", "tolerance": null}, {"id": "6msdxjn", "parentId": null, "name": "Underweight", "tolerance": "1"}, {"id": "occ4qpc", "parentId": null, "name": "Undersize", "tolerance": "1"}, {"id": "xz2pit0", "parentId": null, "name": "Low brix", "tolerance": "1"}, {"id": "sa9gyb1", "parentId": null, "name": "Low firmness", "tolerance": "1"}], "products": [{"id": "sajj87t", "name": "Merkloos bio blauwe bessen 125 gram", "categoryId": "p4x8t0m", "isBio": true, "cusPerTu": "6", "piecesPerCu": "1", "weightPerCu": "125", "specs": [{"id": "6memzhc", "name": "Weight", "unit": "g", "min": "125", "max": null}, {"id": "32pbe2z", "name": "Diameter", "unit": "mm", "min": "16", "max": null}, {"id": "g0kqidq", "name": "Firmness", "unit": "Lb", "min": "6", "max": null}, {"id": "pkrf6a9", "name": "Brix", "unit": "%", "min": "8", "max": null}], "supplierIds": ["s4czoc8", "fw2btrb", "4yjgb9v", "xrvjvdo"], "varieties": [], "articleId": ""}, {"id": "oqkaq3v", "name": "Merkloos blauwe bessen 500 gram", "categoryId": "p4x8t0m", "isBio": false, "cusPerTu": "12", "piecesPerCu": "1", "weightPerCu": "500", "specs": [{"id": "ekbj0cv", "name": "Diameter", "unit": "mm", "min": "16", "max": null}, {"id": "t0oyrlh", "name": "Weight", "unit": "g", "min": "500", "max": null}, {"id": "wnbgn60", "name": "Brix", "unit": "%", "min": "8", "max": "25"}], "supplierIds": [], "varieties": [{"id": "3jz4dwe", "name": "Arana"}, {"id": "hakj1l9", "name": "Bianca"}, {"id": "ujgs9j1", "name": "Sekoya Beauty"}, {"id": "s3vyfx4", "name": "Other"}], "articleId": ""}, {"id": "1r437px", "name": "Merkloos bio Gala 4 stuks", "categoryId": "mxqoe4k", "isBio": true, "cusPerTu": "16", "piecesPerCu": "4", "weightPerCu": "", "specs": [{"id": "4xfevi5", "name": "Diameter", "unit": "mm", "min": "60", "max": "70"}], "supplierIds": ["fw2btrb"], "varieties": [], "articleId": ""}, {"id": "ehz2lb3", "name": "Merkloos Mango eetrijp 1 stuk", "articleId": "90006049", "categoryId": "drz3z6m", "isBio": false, "cusPerTu": "18", "piecesPerCu": "", "weightPerCu": "", "specs": [], "supplierIds": ["4yjgb9v"], "varieties": []}], "templates": [{"id": "9fot67h", "scope": "Global", "modules": [{"id": "l952viw", "name": "Unit data", "sort": 0}, {"id": "5uojx0v", "name": "Parameters", "sort": 1}, {"id": "305o6wp", "name": "General Problems", "sort": 2}, {"id": "kxvfr40", "name": "Quality Problems", "sort": 3}], "fields": [{"id": "gxcunfg", "moduleId": "l952viw", "sort": 0, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "tpzofi2", "moduleId": "l952viw", "sort": 1, "type": "SingleChoice", "label": "Class", "required": false, "measurementCount": 1, "specId": null, "min": null, "max": null, "optionsRaw": "I, II, IND, N/A", "options": ["I", "II", "IND", "N/A"], "problemBelowId": null, "problemAboveId": null}, {"id": "ss6zusa", "moduleId": "l952viw", "sort": 2, "type": "Pallet", "label": "Pallet numbers", "required": true}, {"id": "bju9rx4", "moduleId": "l952viw", "sort": 3, "type": "DateCode", "label": "Packing date", "required": true}, {"id": "mkt2wvf", "moduleId": "l952viw", "sort": 10, "type": "Photos", "label": "Module photos", "required": true}, {"id": "iktrlnv", "moduleId": "5uojx0v", "sort": 7, "type": "CountryOfOrigin", "label": "Country of origin", "required": true}, {"id": "icmjzgg", "moduleId": "5uojx0v", "sort": 8, "type": "SingleChoice", "label": "Brand selection", "required": false, "measurementCount": 1, "specId": null, "min": null, "max": null, "optionsRaw": "Neutral Label, Private Label, Supplier Label", "options": ["Neutral Label", "Private Label", "Supplier Label"], "problemBelowId": null, "problemAboveId": null}, {"id": "mi53iht", "moduleId": "5uojx0v", "sort": 6, "type": "Supplier", "label": "Supplier", "required": true}, {"id": "oh7lyxk", "moduleId": "5uojx0v", "sort": 5, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "n5qj0e8", "moduleId": "5uojx0v", "sort": 13, "type": "Photos", "label": "Module photos", "required": false}, {"id": "ynbsae6", "moduleId": "l952viw", "sort": 4, "type": "SampleSize", "label": "Sample size", "required": true}, {"id": "q9800wu", "moduleId": "5uojx0v", "sort": 9, "type": "Number", "label": "Brix", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "xz2pit0", "problemAboveId": null}, {"id": "18keziq", "moduleId": "5uojx0v", "sort": 11, "type": "Number", "label": "Firmness", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "sa9gyb1", "problemAboveId": null}, {"id": "41r0zxb", "moduleId": "5uojx0v", "sort": 12, "type": "Number", "label": "Diameter", "required": true, "measurementCount": 5, "problemBelowId": "occ4qpc", "problemAboveId": null, "specId": null, "min": null, "max": null, "allowPhotos": true, "specName": "Diameter"}], "problemRefs": [{"id": "qodwbre", "moduleId": "305o6wp", "problemTypeId": "z5ms2q7", "sort": 0}, {"id": "v2m5hei", "moduleId": "305o6wp", "problemTypeId": "eh9qntt", "sort": 1}, {"id": "jdmg04b", "moduleId": "kxvfr40", "problemTypeId": "70d42hr", "sort": 2}, {"id": "8kx889l", "moduleId": "kxvfr40", "problemTypeId": "9eeirk1", "sort": 3}], "overrides": [], "suppressed": [], "fieldOverrides": {}, "layered": true}, {"id": "5bbak8o", "scope": "Product", "productId": "sajj87t", "modules": [], "fields": [], "problemRefs": [], "overrides": [], "suppressed": ["bhcx35m"], "fieldOverrides": {"q9800wu": {"specId": "pkrf6a9"}, "18keziq": {"specId": "g0kqidq"}}, "layered": true}, {"id": "olpoju6", "scope": "Category", "categoryId": "drz3z6m", "modules": [], "fields": [], "problemRefs": [], "overrides": [], "suppressed": [], "fieldOverrides": {}, "layered": true}], "suppliers": [{"id": "s4czoc8", "name": "SureExport"}, {"id": "fw2btrb", "name": "FruitMaster"}, {"id": "4yjgb9v", "name": "Nature's Pride"}, {"id": "xrvjvdo", "name": "The Greenery"}, {"id": "wn8w5in", "name": "Landjuweel"}], "countries": [{"id": "3hleofm", "name": "Spain"}, {"id": "oob57z6", "name": "Netherlad"}, {"id": "640yrjr", "name": "Greece"}, {"id": "chopix8", "name": "Colombia"}, {"id": "61xtqxf", "name": "Poland"}, {"id": "b5pc8if", "name": "South Africa"}], "users": [{"id": "u-head", "name": "Marta K.", "email": "marta@qc.local", "role": "Head", "active": true}, {"id": "u-anna", "name": "Anna K.", "email": "anna@qc.local", "role": "Controller", "active": true}, {"id": "u-jakub", "name": "Jakub M.", "email": "jakub@qc.local", "role": "Controller", "active": true}], "inspections": [{"id": "30624z8", "productId": "oqkaq3v", "controllerId": "u-anna", "status": "Completed", "result": "Accepted", "startedAt": "2026-09-15T19:19:17.961Z", "template": {"id": "9fot67h", "modules": [{"id": "l952viw", "name": "Unit data", "sort": 0, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "5uojx0v", "name": "Parameters", "sort": 1, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "305o6wp", "name": "General Problems", "sort": 2, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}, {"id": "kxvfr40", "name": "Quality Problems", "sort": 3, "ownerId": "9fot67h", "ownerLabel": "global", "level": 0}], "fields": [{"id": "gxcunfg", "moduleId": "l952viw", "sort": 0, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "tpzofi2", "moduleId": "l952viw", "sort": 1, "type": "SingleChoice", "label": "Class", "required": false, "options": ["I", "II", "IND", "N/A"], "problemBelowId": null, "problemAboveId": null}, {"id": "ss6zusa", "moduleId": "l952viw", "sort": 2, "type": "Pallet", "label": "Pallet numbers", "required": true}, {"id": "bju9rx4", "moduleId": "l952viw", "sort": 3, "type": "DateCode", "label": "Packing date", "required": true}, {"id": "mkt2wvf", "moduleId": "l952viw", "sort": 10, "type": "Photos", "label": "Module photos", "required": true}, {"id": "iktrlnv", "moduleId": "5uojx0v", "sort": 7, "type": "CountryOfOrigin", "label": "Country of origin", "required": true}, {"id": "icmjzgg", "moduleId": "5uojx0v", "sort": 8, "type": "SingleChoice", "label": "Brand selection", "required": false, "options": ["Neutral Label", "Private Label", "Supplier Label"], "problemBelowId": null, "problemAboveId": null}, {"id": "mi53iht", "moduleId": "5uojx0v", "sort": 6, "type": "Supplier", "label": "Supplier", "required": true}, {"id": "oh7lyxk", "moduleId": "5uojx0v", "sort": 5, "type": "ProductInfo", "label": "Product info", "required": true}, {"id": "n5qj0e8", "moduleId": "5uojx0v", "sort": 13, "type": "Photos", "label": "Module photos", "required": false}, {"id": "ynbsae6", "moduleId": "l952viw", "sort": 4, "type": "SampleSize", "label": "Sample size", "required": true}, {"id": "q9800wu", "moduleId": "5uojx0v", "sort": 9, "type": "Number", "label": "Brix", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "xz2pit0", "problemAboveId": null}, {"id": "18keziq", "moduleId": "5uojx0v", "sort": 11, "type": "Number", "label": "Firmness", "required": true, "measurementCount": 3, "specId": null, "min": null, "max": null, "allowPhotos": true, "problemBelowId": "sa9gyb1", "problemAboveId": null}, {"id": "41r0zxb", "moduleId": "5uojx0v", "sort": 12, "type": "Number", "label": "Diameter", "required": true, "measurementCount": 5, "problemBelowId": "occ4qpc", "problemAboveId": null, "specId": null, "min": null, "max": null, "allowPhotos": true, "specName": "Diameter"}], "problemRefs": [{"id": "qodwbre", "moduleId": "305o6wp", "problemTypeId": "z5ms2q7", "sort": 0}, {"id": "v2m5hei", "moduleId": "305o6wp", "problemTypeId": "eh9qntt", "sort": 1}, {"id": "jdmg04b", "moduleId": "kxvfr40", "problemTypeId": "70d42hr", "sort": 2}, {"id": "8kx889l", "moduleId": "kxvfr40", "problemTypeId": "9eeirk1", "sort": 3}], "overrides": [], "suppressed": []}, "values": {"tpzofi2": "I", "icmjzgg": "Neutral Label", "q9800wu": {"measurements": ["4.6", "5.6", "12"]}, "18keziq": {"measurements": ["5.6", "7.0", "8.9"]}, "41r0zxb": {"measurements": ["21", "17", "16", "15", "18"]}}, "remarks": [{"id": "oypemqd", "leafId": "xz2pit0", "mode": "DirectWeight", "raw": "45", "auto": true, "fieldId": "q9800wu"}, {"id": "ugn1a7k", "leafId": "kxbg8ev", "mode": "DirectWeight", "raw": "34"}], "photos": {"mkt2wvf": 5, "q9800wu": 10, "18keziq": 3, "41r0zxb": 6, "n5qj0e8": 3}, "pallets": ["3435454565656565"], "sample": {"tu": "3", "cusPerTu": "12", "piecesPerCu": "1", "weightPerCu": "500"}, "audit": [{"at": "2026-09-15T19:19:17.961Z", "userId": "u-anna", "action": "Created"}, {"at": "2026-09-15T19:24:29.040Z", "userId": "u-anna", "action": "Completed", "details": "result: Accepted"}], "dateISO": "2026-09-15", "supplier": "FruitMaster", "country": "South Africa", "comment": "Low brix 0,25%; Major remarks 0,19% (Dacay 0,19%) — but quality still acceptable.", "completedAt": "2026-09-15T19:24:29.040Z"}], "flags": [{"id": "doip2r0", "productId": "oqkaq3v", "inspectionId": null, "raisedBy": "u-anna", "description": "Barcode sie zmienił. No działa", "status": "Resolved", "createdAt": "2026-09-15T19:38:23.880Z", "resolution": "Już zaktualizowałem, dziękuję", "resolvedBy": "u-head", "resolvedAt": "2026-09-15T19:38:59.213Z"}], "notifications": [{"id": "90odnq1", "userId": "u-head", "type": "Flag", "message": "🚩 Anna K.: Merkloos blauwe bessen 500 gram — Barcode sie zmienił. No działa", "entityType": "ProductFlag", "entityId": null, "createdAt": "2026-09-15T19:38:23.881Z", "readAt": "2026-09-15T19:38:31.864Z"}, {"id": "urpk161", "userId": "u-anna", "type": "Announcement", "message": "📣 New blocking announcement: Buty ochronne", "entityType": "Announcement", "entityId": "5763oat", "createdAt": "2026-09-15T19:48:53.357Z", "readAt": "2026-09-15T19:49:22.923Z"}, {"id": "5og4q45", "userId": "u-jakub", "type": "Announcement", "message": "📣 New blocking announcement: Buty ochronne", "entityType": "Announcement", "entityId": "5763oat", "createdAt": "2026-09-15T19:48:53.357Z", "readAt": null}], "announcements": [{"id": "s5pwd4f", "title": "Nowa specification to średnicy", "body": "Od poniedziałku no specifications dla średnicy", "productId": "sajj87t", "validTo": null, "createdBy": "u-head", "createdAt": "2026-09-15T19:45:29.342Z", "acks": {}, "isBlocking": false, "showOnDashboard": false}, {"id": "cw8jnzk", "title": "Jutrzejsze zebranie", "body": "Jutrzejsze zebranie (16.09.2026) przełożone na godzine 12:00", "productId": null, "validTo": "2026-09-17", "createdBy": "u-head", "createdAt": "2026-09-15T19:47:06.757Z", "acks": {}, "isBlocking": false, "showOnDashboard": true}, {"id": "5763oat", "title": "Buty ochronne", "body": "Proszę wszystkich o zmienianie butów przed rozpoczęciem pracy", "productId": null, "validTo": null, "createdBy": "u-head", "createdAt": "2026-09-15T19:48:53.356Z", "acks": {"u-anna": "2026-09-15T19:49:04.906Z"}, "isBlocking": true, "showOnDashboard": false}], "conversations": []};
const olaState = () => normalize(JSON.parse(JSON.stringify(OLA_STATE)));


function DataPanel({ s, set, onClose }) {
  const [io, setIo] = useState("");
  const [msg, setMsg] = useState("");
  const [backups, setBackups] = useState(null);
  const loadBackups = async () => { if (!window.__qcServer) { setBackups([]); return; } try { const r = await fetch(`${window.__qcServer}/backups`); setBackups(r.ok ? await r.json() : []); } catch { setBackups([]); } };
  const restore = async name => { if (!window.confirm || window.confirm(`Restore ${name}? The current state is snapshotted first.`)) { try { const r = await fetch(`${window.__qcServer}/backups/${encodeURIComponent(name)}/restore`, { method: "POST" }); if (r.ok) { setMsg("Restored on the server — reloading…"); setTimeout(() => location.reload(), 800); } else setMsg("Restore failed: " + r.status); } catch (e) { setMsg("Restore failed: " + (e.message || e)); } } };
  const exportState = async () => {
    const json = JSON.stringify(s, null, 2);
    setIo(json);
    try { await navigator.clipboard.writeText(json); setMsg("Copied to clipboard — paste it to me in the chat."); } catch { setMsg("Automatic copy failed — select the field and copy manually."); }
  };
  const importState = () => {
    try {
      const parsed = JSON.parse(io);
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.problems)) throw new Error();
      set(normalize(parsed));
      setMsg("State loaded.");
    } catch { setMsg("This doesn't look like a valid state export."); }
  };
  const [confirmReset, setConfirmReset] = useState(false);
  const reset = () => { if (!confirmReset) { setConfirmReset(true); setMsg("Click again to clear ALL data — this cannot be undone."); return; } set(EMPTY, { force: true }); setIo(""); setMsg("Cleared."); setConfirmReset(false); };
  return (
    <Card style={{ marginBottom: 16, borderColor: C.accent }}>
      <div className="flex items-center justify-between mb-2"><p className="font-medium text-sm"><Ic i={Database} s={14} />Application data</p><button onClick={onClose} className="text-xs" style={{ color: C.muted }}>close</button></div>
      <p className="text-xs mb-3" style={{ color: C.muted }}>State is saved automatically after every change and survives refreshes and code updates. “Export” gives you JSON you can paste to me — then I will see exactly what you built.</p>
      <div className="flex gap-2 mb-2 flex-wrap"><Primary small onClick={exportState}>Export state</Primary><Ghost onClick={importState}>Import from the field below</Ghost><button onClick={reset} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.badBg, color: C.bad }}>Clear everything</button></div>
      {msg && <p className="text-xs mb-2" style={{ color: C.accent }}>{msg}</p>}
      <textarea value={io} onChange={e => setIo(e.target.value)} rows={6} placeholder="The export will appear here, or paste JSON to import" className="w-full text-xs rounded px-2 py-1.5 outline-none font-mono" style={{ ...inp }} />
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-1"><p className="font-medium text-sm">Server backups</p><button onClick={loadBackups} className="text-xs underline" style={{ color: C.accent }}>{backups ? "refresh" : "show"}</button></div>
        <p className="text-[11px] mb-2" style={{ color: C.muted }}>Snapshots of the whole state, taken on change (at most one per 10 minutes, last 48 kept). Restoring snapshots the current state first, so nothing is lost.</p>
        {backups && (backups.length === 0 ? <p className="text-xs" style={{ color: C.muted }}>No backups yet (or no server).</p> : <div className="rounded-xl" style={{ border: `1px solid ${C.line}`, maxHeight: 220, overflowY: "auto" }}>{backups.map(b => <div key={b.name} className="flex items-center gap-2 px-2 py-1.5 text-xs" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{new Date(b.at).toLocaleString("en-GB")}<span style={{ color: C.muted }}> · {b.categories} cat · {b.products} prod · {b.inspections} insp · {b.integrations} integr</span></span><button onClick={() => restore(b.name)} className="px-2 py-1 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Restore</button></div>)}</div>)}
      </div>
    </Card>
  );
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [s, setRaw] = useState(EMPTY);
  const [toastMsg, setToastMsg] = useState(""); useEffect(() => { if (!toastMsg) return; const t = setTimeout(() => setToastMsg(""), 4000); return () => clearTimeout(t); }, [toastMsg]);
  // All state changes go through the shared syncer (src/sync.js): it shows the edit at once, saves it with optimistic
  // concurrency, and merges in what other devices saved. `set(fn)` — fn is state → state; `set(obj)` replaces the whole
  // state (imports / demo seed / reset); `{ force: true }` lets a deliberate wipe through the server's size guard.
  const syncerRef = useRef(null);
  if (syncerRef.current === null) syncerRef.current = createSyncer({ key: STORAGE_KEY, normalize: p => sortState(normalize(p)), isValid: p => p && Array.isArray(p.categories), initial: EMPTY, onState: v => { _S = v; setRaw(v); }, onToast: m => setToastMsg(m) });
  const set = (fn, opts) => syncerRef.current.apply(typeof fn === "function" ? (x => sortState(fn(x))) : (() => sortState(fn)), opts);
  const [selProduct, setSelProduct] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [userId, setUserId] = useState(() => readSession());
  const [openInspId, setOpenInspId] = useState(null);
  // Browser/back-forward + swipe-back support: every screen change — a sidebar page, opening a product, opening an
  // inspection — pushes a history entry, and going back through them (however it's triggered) restores the matching
  // screen instead of leaving the app. skipPushRef swallows the one state update right after a pop (it's already
  // reflecting history — pushing it again would double it up) and the very first render (there's nothing to push yet).
  const skipPushRef = useRef(true);
  useEffect(() => {
    if (skipPushRef.current) { skipPushRef.current = false; return; }
    try { history.pushState({ __qcNav: true, page, selProduct, openInspId }, ""); } catch {}
  }, [page, selProduct, openInspId]);
  useEffect(() => {
    try { history.replaceState({ __qcNav: true, page, selProduct, openInspId }, ""); } catch {}
    const onPop = e => {
      skipPushRef.current = true; const st = e.state;
      setPage(st && st.__qcNav ? st.page : "dashboard");
      setSelProduct(st && st.__qcNav ? (st.selProduct ?? null) : null);
      setOpenInspId(st && st.__qcNav ? (st.openInspId ?? null) : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [presetProduct, setPresetProduct] = useState("");
  const [productsQuery, setProductsQuery] = useState("");
  const [presetCategory, setPresetCategory] = useState(null);
  const [pendingChatContext, setPendingChatContext] = useState(null);
  const bootIdRef = useRef(null); const [newVersion, setNewVersion] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { (async () => { try { if (window.storage) { const r = await window.storage.get(THEME_KEY); if (r?.value === "dark") { applyTheme(true); setDark(true); } } } catch (e) {} })(); }, []);
  const toggleTheme = () => { const d = !dark; applyTheme(d); setDark(d); (async () => { try { if (window.storage) await window.storage.set(THEME_KEY, d ? "dark" : "light"); } catch (e) {} })(); };
  useEffect(() => { if (!loaded) return; const tick = () => refreshPushedIntegrations(() => _S, set); tick(); const id = setInterval(tick, 60000); return () => clearInterval(id); }, [loaded]);
  // Load the shared state once; from then on the syncer owns saving, conflict merging and pulling other devices' changes.
  useEffect(() => { let alive = true; syncerRef.current.load().then(() => { if (alive) setLoaded(true); }); const off = guardUnload(syncerRef.current); return () => { alive = false; off(); }; }, []);
  // Cheap poll every ~5s: retry anything unsaved, otherwise pull when the server's version moved (someone else saved, or
  // the sheet pushed). Also notice a redeploy (bootId changed) and offer a refresh. Pull as well when the tab comes back to the front.
  useEffect(() => { if (!loaded) return; const tick = async () => {
    if (window.storage?.getBootId) { const b = await window.storage.getBootId(); if (b) { if (bootIdRef.current === null) bootIdRef.current = b; else if (b !== bootIdRef.current) setNewVersion(true); } }
    await syncerRef.current.tick();
  }; const id = setInterval(tick, 5000);
  const onVisible = () => { if (document.visibilityState === "visible") syncerRef.current.tick(); }; document.addEventListener("visibilitychange", onVisible); window.addEventListener("focus", onVisible);
  return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); }; }, [loaded]);

  const badge = { forms: s.products.filter(p => { const t = resolveTemplate(s, p); return t && t.fields.some(f => (f.problemBelowId || f.problemAboveId) && !f.specId && !p.specs.some(q => (q.name || "").trim().toLowerCase() === ((f.specName || "").trim() || f.label || "").toLowerCase())) && p.specs.length > 0; }).length };
  const dataButton = <><button onClick={toggleTheme} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: C.accentSoft, color: C.accent }} title="theme">{dark ? <><Ic i={Sun} s={13} />Light</> : <><Ic i={Moon} s={13} />Dark</>}</button><button onClick={() => setDataOpen(o => !o)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: dataOpen ? C.accent : C.accentSoft, color: dataOpen ? C.onDark : C.accent }}><Ic i={Database} s={13} />Data</button></>;
  if (!loaded) return <div className="min-h-screen flex items-center justify-center text-sm" style={{ background: C.bg, color: C.muted }}>Loading…</div>;
  const user = s.users.find(u => u.id === userId && u.active !== false) || null;
  if (!user) return <LoginScreen s={s} allowRoles={["Head", "Controller"]} onLogin={id => setUserId(id)} subtitle="QCteam portal — sign in" />;
  // Notification: to a specific user (toUserId) or to all Heads
  const notify = (type, message, entityType, entityId, toUserId) => set(x => { const targets = toUserId ? [toUserId] : x.users.filter(u => u.role === "Head").map(u => u.id); return { ...x, notifications: [...x.notifications, ...targets.map(uid_ => ({ id: uid(), userId: uid_, type, message, entityType, entityId, createdAt: nowISO(), readAt: null }))] }; });
  const unread = s.notifications.filter(n => n.userId === user.id && !n.readAt).length;
  const unreadMsgs = s.conversations.filter(c => c.participantIds.includes(user.id)).reduce((a, c) => a + unreadIn(c, user.id), 0);
  const guard = key => user.role === "Head" || NAV_CONTROLLER.some(g => g.items.some(([k]) => k === key));
  const safePage = guard(page) ? page : "dashboard";
  return (
    <Shell onSearch={q => { setProductsQuery(q); setPage("products"); }} onLogout={() => { writeSession(null); setUserId(null); }} page={safePage} setPage={setPage} badge={{ ...badge, messages: unreadMsgs, notifications: unread, flags: user.role === "Head" ? s.flags.filter(f => f.status === "Open").length : 0, inspections: user.role === "Head" ? s.inspections.filter(i => i.status === "PendingReview").length : 0 }} topRight={dataButton} users={s.users} user={user} setUser={id => { setUserId(id); setPage("dashboard"); setOpenInspId(null); }} unread={unread} onBell={() => setPage("notifications")}>
      <BlockingOverlay s={s} set={set} user={user} />
      {dataOpen && <DataPanel s={s} set={set} onClose={() => setDataOpen(false)} />}
      {toastMsg && <div className="fixed left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-xl" style={{ top: 12, zIndex: 90, background: C.ink, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>{toastMsg}</div>}
      {newVersion && <div className="fixed left-1/2 -translate-x-1/2 flex items-center gap-3 text-sm px-4 py-2.5 rounded-xl" style={{ top: 12, zIndex: 91, background: C.accent, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.3)" }}>A new version is live<button onClick={() => location.reload()} className="px-2.5 py-1 rounded-lg font-semibold" style={{ background: C.onDark, color: C.accent }}>Refresh</button></div>}
      {safePage === "dashboard" && (user.role === "Head" ? <Dashboard s={s} user={user} set={set} setPage={setPage} seed={() => set(olaState())} openProduct={id => { setSelProduct(id); setPage("products"); }} onAssign={a => { setPendingChatContext({ kind: "pallet", id: a.hu, label: `${a.name} · ${a.location}` }); setPage("messages"); }} /> : <ControllerDashboard s={s} user={user} setPage={setPage} setOpenId={setOpenInspId} openProduct={id => { setSelProduct(id); setPage("products"); }} />)}
      {safePage === "categories" && <CategoriesPage s={s} set={set} onMessage={ctx => { setPendingChatContext(ctx); setPage("messages"); }} onOpenProduct={id => { setSelProduct(id); setPage("products"); }} presetSel={presetCategory} clearPresetSel={() => setPresetCategory(null)} />}
      {safePage === "problems" && <ProblemsPage s={s} set={set} />}
      {safePage === "products" && <ProductsPage s={s} set={set} sel={selProduct} setSel={setSelProduct} presetFilter={productsQuery} clearPreset={() => setProductsQuery("")} onMessage={ctx => { setPendingChatContext(ctx); setPage("messages"); }} onOpenInspection={id => { setOpenInspId(id); setPage("inspections"); }} />}
      {safePage === "forms" && <FormsPage s={s} set={set} />}
      {safePage === "suppliers" && <DictionaryPage s={s} set={set} listKey="suppliers" title="Suppliers" hint="One global list of all suppliers (Suppliers). Assign to products in Products." placeholder="e.g. El Ciruelo" usageOf={id => s.products.filter(p => (p.supplierIds || []).includes(id)).length} />}
      {safePage === "lists" && <ListsPage s={s} set={set} />}
      {safePage === "blocked" && <BlockedQueuePage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} />}
      {safePage === "lost" && <LostPalletsPage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} />}
      {safePage === "unreported" && <UnreportedPalletsPage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} />}
      {safePage === "inspections" && <InspectionsPage s={s} set={set} user={user} notify={notify} openId={openInspId} setOpenId={setOpenInspId} preset={presetProduct} clearPreset={() => setPresetProduct("")} />}
      {safePage === "catalog" && <CatalogPage s={s} set={set} user={user} notify={notify} onStartInspection={pid => { setPresetProduct(pid); setOpenInspId(null); setPage("inspections"); }} />}
      {safePage === "flags" && <FlagsPage s={s} set={set} user={user} />}
      {safePage === "notifications" && <NotificationsPage s={s} set={set} user={user} setPage={setPage} setOpenId={setOpenInspId} setSelProduct={setSelProduct} />}
      {safePage === "analytics" && <AnalyticsPage s={s} setPage={setPage} openInspection={id => { setOpenInspId(id); setPage("inspections"); }} />}
      {safePage === "integrations" && <IntegrationsPage s={s} set={set} />}
      {safePage === "settings" && <SettingsPage s={s} set={set} />}
      {safePage === "users" && <UsersPage s={s} set={set} />}
      {safePage === "announcements" && <AnnouncementsPage s={s} set={set} user={user} notify={notify} />}
      {safePage === "messages" && <MessagesPage s={s} set={set} user={user} setPage={setPage} onOpenProduct={id => setSelProduct(id)} onOpenInspection={id => { setOpenInspId(id); setPage("inspections"); }} onOpenCategory={id => setPresetCategory(id)} initialContext={pendingChatContext} clearInitialContext={() => setPendingChatContext(null)} />}
    </Shell>
  );
}
