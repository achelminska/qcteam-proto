import { useState, useEffect, useRef, Fragment } from "react";
import { createSyncer, guardUnload } from "./sync.js";
import { applySpecEdit, hasV, specFieldsFromForm, specFormKind, specLabel, dayLabel, problemPath, typesOf, typeById, legacyTypeId, inspType, countsAs, listCheck, matchFieldSpec, numberSpecCheck, reportStatusFields, toleranceDisplay, matchesInspSearch } from "./shared/format.js";
import { SPEC_TARGETS, SPEC_ALIASES, SPEC_COLUMNS, applySpecSheet, fmtRange, liveNoteOf, fmtUntil, resolveSpecConflict } from "./shared/specsync.js";
import { REJECTION_TARGETS, REJECTION_ALIASES, buildRejectionDigest, extRejectionsFor, extRejectedRecently, extRejectionLine, extRejectionsAll, extRejectionsRecent, extRejectionKey, topCats, fmtRejectionDay, linkLabel, reportUrls } from "./shared/rejections.js";
import { normArticle, isoWeekOf, todayISO, weekLabel, weekRange, shiftWeek, sortSnapshots, latestSnapshot, snapshotTotal, upsertSnapshot, snapshotsOfWeek, previousInWeek, deltaRows, subTypeMix, weekSeries, articleTrend, topArticles, asLegacyMeta, migrateLegacy, rowFor, parseComplaintRows, fmtPer1k } from "./shared/complaints.js";
import { activeTempForSpec, applyTempSpec, tempSpecIsActive, clearTempSpec, closeExpiredTempSpecs, tempOwnerLabel, tempUntilLabel, upsertTempSpec } from "./shared/tempspec.js";
import { SpecValue } from "./shared/SpecValue.jsx";
import { peopleOnFloor, peopleAtDock, floorWhere, floorVerb, doneTodayCount, doneTodayByUser } from "./shared/floor.js";
import { attachableSameDay, otherDeliveryDay, sameDeliveryRows } from "./shared/delivery-pallets.js";
import { poRequiredOnReject, poSourceHint, sheetPoForInspection, suggestedPo } from "./shared/rejection-po.js";
import { dockMatches } from "./shared/dock-search.js";
import { dockMapGroupKey, dockMapOpen, dockMapRows, isBlockedMapRow, openBlockedForMap, QUEUE_STATUS } from "./shared/dock-map.js";
import { adoptLocalBriefingSeen, briefingFp, clearBriefingSeen, markBriefingSeen, seenFingerprints } from "./shared/briefing-seen.js";
import { briefingComplaintsMeta, briefingDefaultTab, briefingItemsKey, briefingRemark, briefingTabDeck, briefingUnseen, liveBriefingFps } from "./shared/briefing-cards.js";
import { announceFilesOf } from "./shared/announce-files.js";
import { AnnounceAttachButton, AnnounceFileList, AnnounceFileThumbs } from "./shared/AnnounceAttachments.jsx";
import { readAsDataUrl, keepPhoto, shrinkPhoto, memoPdfPhoto, fetchPdfPhotoSrc, rotateImage } from "./shared/report-images.js";
import { attachRemarkPhotos, photoGroupsByModule, pickedPhotos, replacePhoto, replaceRemarkPhoto, THUMB_EDGE, thumbSrc, thumbsMissing, withThumb } from "./shared/photos.js";
import { CameraSheet } from "./shared/CameraSheet.jsx";
import { PhotoReview } from "./shared/PhotoReview.jsx";
import { drawReportPdf } from "./shared/report-pdf.js";
import { needsShareToSave, savePdfFile, triggerAnchorDownload } from "./shared/pdf-save.js";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Legend } from "recharts";
import { GripVertical, Clock, MessageCircle, Link2, List as ListIcon, BarChart3, Printer, SlidersHorizontal, SkipForward, LayoutDashboard, ClipboardList, Flag, Bell, FolderTree, ListTree, Package, LayoutTemplate, Truck, Globe, Megaphone, MessageSquare, Users, Search, Sun, Moon, Database, Home, Menu as MenuIcon, ScanLine, Plus, ChevronLeft, ChevronDown, ChevronRight, User, Camera, Image as ImageIcon, Paperclip, Send, Star, Pencil, Sparkles, HelpCircle, Download, Lock as LockIcon, AlertTriangle, Inbox, FileText, ShieldAlert, Tag, Layers, BookOpen, Filter, Check, X, Ruler, Boxes, Warehouse, Snowflake, Thermometer, ThumbsDown, ClipboardPaste, Trash2, Eye, ExternalLink } from "lucide-react";

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
const applyTheme = dark => { Object.assign(C, dark ? DARK : LIGHT); C.isDark = !!dark; };
// Soft elevation: a hairline highlight on top + a drop shadow underneath. Enough to lift tiles off the page
// without the cartoon "floating block" look.
const lift = (n = 1) => C.isDark
  ? n >= 2
    ? "0 1px 0 rgba(255,255,255,.07) inset, 0 10px 22px rgba(0,0,0,.48), 0 2px 6px rgba(0,0,0,.32)"
    : "0 1px 0 rgba(255,255,255,.055) inset, 0 6px 16px rgba(0,0,0,.36), 0 1px 3px rgba(0,0,0,.24)"
  : n >= 2
    ? "0 1px 0 rgba(255,255,255,.9) inset, 0 8px 18px rgba(24,34,25,.14), 0 2px 5px rgba(24,34,25,.08)"
    : "0 1px 0 rgba(255,255,255,.75) inset, 0 5px 12px rgba(24,34,25,.10), 0 1px 2px rgba(24,34,25,.06)";
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
const NOTIF = { Exceeded: [AlertTriangle, "bad"], AcceptedDespite: [AlertTriangle, "warn"], Escalation: [HelpCircle, "warn"], Question: [MessageCircle, "info"], Answered: [MessageCircle, "ok"], Flag: [Flag, "warn"], Announcement: [Megaphone, "info"], EditedByOther: [Pencil, "info"], DeadlineWarning: [Clock, "warn"], DeadlineBreached: [AlertTriangle, "bad"], Lost: [Search, "warn"], Found: [Check, "ok"], MissingRequired: [AlertTriangle, "warn"], Complaints: [ThumbsDown, "warn"], Specs: [Database, "info"], Rejections: [AlertTriangle, "warn"] };
const notifLook = t => { const [I, tone] = NOTIF[t] || [Bell, "info"]; const fg = tone === "bad" ? C.bad : tone === "warn" ? C.warn : tone === "ok" ? C.ok : C.accent; const bg = tone === "bad" ? C.badBg : tone === "warn" ? C.warnBg : tone === "ok" ? C.okBg : C.accentSoft; return { I, fg, bg }; };
const cleanMsg = m => String(m || "").replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, "");
const NotifIcon = ({ type, size = 32 }) => { const { I, fg, bg } = notifLook(type); return <span className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: bg, color: fg }}><I size={Math.round(size * 0.5)} strokeWidth={2} /></span>; };
const Dot = ({ on }) => <span className="inline-block rounded-full ml-2 align-middle" style={{ width: 7, height: 7, background: on ? C.ok : C.line }} />;
const NAV_ICON = { blocked: LockIcon, lost: Search, unreported: ShieldAlert, integrations: Link2, lists: ListIcon, analytics: BarChart3, settings: SlidersHorizontal, dashboard: LayoutDashboard, inspections: ClipboardList, flags: Flag, notifications: Bell, categories: FolderTree, problems: ListTree, products: Package, forms: LayoutTemplate, suppliers: Truck, countries: Globe, announcements: Megaphone, messages: MessageSquare, users: Users, catalog: Package, home: Home, chat: MessageSquare, menu: MenuIcon, docks: Warehouse, complaints: ThumbsDown, tempspecs: Clock, briefing: BookOpen, profile: User };
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
  .qc button{font:inherit;cursor:pointer;transition:background-color .12s,color .12s,border-color .12s,box-shadow .12s,transform .06s}
  .qc button:active{transform:translateY(1px)}
  .qc-tile{box-shadow:${lift()}}
  .qc button.qc-elev:active,.qc button.qc-tile:active{box-shadow:0 1px 0 rgba(255,255,255,.03) inset,0 2px 6px rgba(0,0,0,.22)!important}
  .qc-led-halo{position:absolute;inset:-3px;border-radius:19px;pointer-events:none;z-index:0}
  .qc-led-halo::before{content:"";position:absolute;inset:0;border-radius:inherit;background:${C.accent};filter:blur(8px);opacity:${C.isDark ? .72 : .4}}
  .qc-led-halo::after{content:"";position:absolute;inset:1px;border-radius:17px;box-shadow:0 0 0 1px ${C.accent},0 0 10px ${C.accent};opacity:${C.isDark ? .88 : .58}}
  @media (prefers-reduced-motion:no-preference){.qc-led-halo::before,.qc-led-halo::after{animation:qc-led-breathe 2.6s ease-in-out infinite}}
  @keyframes qc-led-breathe{0%,100%{opacity:${C.isDark ? .55 : .32}}50%{opacity:${C.isDark ? .95 : .7}}}
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
// One-line explanations shown in the "+ field" type picker, so the Head chooses the right kind of field up front.
const FIELD_TYPE_HINTS = { Text: "free text, e.g. a remark", Number: "a measurement checked against the specification — weight, brix, size", SingleChoice: "pick one of a few options", List: "pick one entry from a shared list, e.g. country", MultiChoice: "tick everything that applies", Date: "e.g. a best-before date", Scale: "a rating from 1 up to a maximum you set" };
// Short facts shown on a collapsed field card, so a long form can be scanned without opening every field.
const fieldSummary = (f, dictionaries) => {
  const out = [];
  if (f.type === "Number") { const sp = (f.specName || "").trim(); if (sp) out.push(`spec: ${sp}`); else if (f.specId) out.push("spec: explicit"); else if (f.min != null && f.min !== "" || f.max != null && f.max !== "") out.push(`${f.min ?? "…"} – ${f.max ?? "…"}`); if (f.problemBelowId || f.problemAboveId) out.push("raises problem"); }
  else if (f.type === "List") { const d = (dictionaries || []).find(x => x.id === f.dictionaryId); out.push(d ? `list: ${d.name}` : "no list yet"); if (f.problemMismatchId) out.push("raises problem"); }
  else if (f.type === "SingleChoice" || f.type === "MultiChoice") out.push(`${(f.options || []).length} options`);
  else if (f.type === "Scale") out.push(`1 – ${f.scaleMax ?? 5}`);
  return out;
};
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
const photoGroupsOf = (t, insp, problems) => {
  const cover = new Map();
  (t?.problemRefs || []).forEach(r => {
    cover.set(r.problemTypeId, r.moduleId);
    descendantIds(problems, r.problemTypeId).forEach(id => cover.set(id, r.moduleId));
  });
  return photoGroupsByModule({
    modules: t?.modules || [], fields: t?.fields || [], photos: insp?.photos || {}, remarks: insp?.remarks || [],
    remarkModuleId: r => cover.get(r.leafId),
    labelField: f => f.type === "Photos" ? photoBlockLabel(f, t) : f.label,
    labelRemark: r => `Problem: ${pathOf(problems, r.leafId)}`,
  });
};
const parameterRow = (f, v, s, product, piecesPerCu) => {
  if (f.type === "Number") {
    const nums = (v?.measurements || []).filter(x => x !== "").map(Number);
    const txt = nums.map(fmt).join(" / ") + (nums.length > 1 ? ` — avg ${fmt(nums.reduce((a, b) => a + b, 0) / nums.length)}` : "");
    const spec = matchFieldSpec(effectiveSpecs(s, product), f);
    const lim = limitsFor(spec, f, piecesPerCu);
    const c = numberSpecCheck({ min: lim.min, max: lim.max, unit: spec ? spec.unit : "" }, nums);
    return c ? [fieldLabel(f), txt, c.expected, c.ok] : [fieldLabel(f), txt];
  }
  const txt = Array.isArray(v) ? v.join(", ") : String(v ?? "");
  if (f.type === "List" || f.type === "SingleChoice") {
    const c = listCheck(effectiveAttributes(s, product).find(a => a.dictionaryId === f.dictionaryId), v);
    if (c) return [fieldLabel(f), txt, c.expected, c.ok];
  }
  return [fieldLabel(f), txt];
};
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
// *bold* the way the Head types it in a note.
const richText = txt => String(txt || "").split(/(\*[^*\n]+\*)/g).map((part, i) => /^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : <Fragment key={i}>{part}</Fragment>);
const fmtTime = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); };
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
// Effective tolerance of remarks that were actually found under the group — not unused siblings
// (decay at 1% must not also print Minor remarks' 10% just because that node exists in the catalog).
const tolsUnder = (problems, overrides, remarks, id) => {
  const sub = subtree(problems, id);
  return (remarks || []).filter(r => sub.has(r.leafId)).map(r => effTol(problems, overrides, r.leafId));
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
const basisTag = q => q?.basis === "cu" ? " /CU" : "";
// Specification cascade by name: product → category → parent category
const effectiveSpecs = (s, product, opts) => {
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
  if (opts?.applyTemp === false) return out;
  return out.map(q => applyTempSpec(q, activeTempForSpec(s.tempSpecs, q.id, product.id)));
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
// Number fields can link a problem ("below raises X") that the product's effective catalog doesn't contain — scoped to
// another category, or hidden for this product. The form's explicit link wins: pull that node (and its ancestors) in, so
// the runner raises it and the verdict counts it, instead of silently downgrading to "warning only".
// …unless the catalog already has that problem under its own name: every category carries its own "Unripe" under
// "Major remarks", and a field on the Bananas form can easily end up pointing at the Avocado one. Pulling that in
// would show "Unripe" twice. The twin in scope (same name, same parent name) is the one the Head meant.
const linkedProblemId = (all, problems, id) => {
  if (!id || problems.some(p => p.id === id)) return id;
  const src = all.find(p => p.id === id); if (!src) return id;
  const srcParent = src.parentId ? all.find(p => p.id === src.parentId) : null;
  const twin = problems.find(p => p.name === src.name && !problems.some(k => k.parentId === p.id) && ((p.parentId ? problems.find(k => k.id === p.parentId)?.name : null) === (srcParent ? srcParent.name : null)));
  return twin ? twin.id : id;
};
const withLinkedProblems = (s, problems, t) => { if (!t) return problems; const have = new Set(problems.map(p => p.id)); const out = [...problems]; const addChain = id => { let n = s.problems.find(p => p.id === id); while (n && !have.has(n.id)) { have.add(n.id); out.push(n); n = n.parentId ? s.problems.find(p => p.id === n.parentId) : null; } }; (t.fields || t.allFields || []).forEach(f => { if (f.type === "Number") { if (f.problemBelowId) addChain(linkedProblemId(s.problems, problems, f.problemBelowId)); if (f.problemAboveId) addChain(linkedProblemId(s.problems, problems, f.problemAboveId)); } if (f.type === "List" && f.problemMismatchId) addChain(linkedProblemId(s.problems, problems, f.problemMismatchId)); }); return out; };
const scopeTag = (p, s) => p.productId ? `product: ${s.products.find(x => x.id === p.productId)?.name ?? "?"}` : p.categoryId ? `category ${s.categories.find(x => x.id === p.categoryId)?.name ?? "?"}` : null;
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
const problemParentOptions = problems => { const out = []; const walk = parentId => { problems.filter(p => (p.parentId || null) === parentId).forEach(p => { out.push({ id: p.id, label: problemPath(problems, p.id) }); walk(p.id); }); }; walk(null); return out; };
// Reference guide (knowledge base): a Head-curated note (description + photos) per product×problem-type, so controllers
// know what a given remark actually looks like. Only leaf problem types get notes — those are what's reported against.
const noteFor = (notes, problemId) => (notes || []).find(n => n.problemId === problemId);
const hasNoteContent = n => !!(n && (n.description || "").trim() || asPhotoList(n?.photos).length);
// Inheritance: notes and encyclopedia entries can live on a category too. A product sees its own first, then its
// category, then the parent category; a sub-category sees its parent's. Nearest owner wins for notes (same problem).
const inheritedNoteFor = (s, startCatId, problemId) => { let cat = s.categories.find(c => c.id === startCatId); while (cat) { const n = (s.problemNotes || []).find(x => x.categoryId === cat.id && x.problemId === problemId); if (hasNoteContent(n)) return { ...n, source: cat.name, inherited: true }; cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null; } return null; };
const effectiveNotesFor = (s, product) => {
  if (!product) return [];
  const out = new Map();
  (s.problemNotes || []).filter(n => n.productId === product.id && hasNoteContent(n)).forEach(n => out.set(n.problemId, { ...n, source: "product" }));
  let cat = s.categories.find(c => c.id === product.categoryId);
  while (cat) { const name = cat.name, cid = cat.id; (s.problemNotes || []).filter(n => n.categoryId === cid && hasNoteContent(n)).forEach(n => { if (!out.has(n.problemId)) out.set(n.problemId, { ...n, source: name, inherited: true }); }); cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null; }
  return [...out.values()];
};
// Encyclopedia entries of the category chain, nearest first. A category can hide entries it inherits from its parent
// (hiddenGuideIds) — those stay hidden for everything below it as well.
const guideChainFor = (s, startCatId) => { const out = []; const hidden = new Set(); let cat = s.categories.find(c => c.id === startCatId); while (cat) { (cat.guide || []).forEach(e => { if (!hidden.has(e.id)) out.push({ ...e, source: cat.name, categoryId: cat.id, inherited: true }); }); (cat.hiddenGuideIds || []).forEach(id => hidden.add(id)); cat = cat.parentId ? s.categories.find(c => c.id === cat.parentId) : null; } return out; };
const effectiveGuide = (s, product) => { if (!product) return []; const hidden = new Set(product.hiddenGuideIds || []); return [...(product.guide || []).map(e => ({ ...e, source: "product" })), ...guideChainFor(s, product.categoryId).filter(e => !hidden.has(e.id))]; };
// Required inspection level: Full (raport) < Visual (visual is enough) < Skip (can be skipped). Product → category → system setting.
// Inspection types are Head-defined (InspectionTypes). Behaviour comes from flags, not from the name.
// No default inspection types: the Head defines them (Forms → + new type). Legacy ids below only keep old records readable.
const SEED_TYPES = () => [];
// Reasons a controller can pick when finishing an inspection of a type whose "Reason on finish" is on. The Head edits the
// list per type in Forms → Type settings (type.reasons); a type that never had its list edited falls back to these defaults.
const DEFAULT_REASONS = ["no time", "stable product", "same delivery as earlier", "checked at the supplier"];
const typeReasons = t => Array.isArray(t?.reasons) ? t.reasons : DEFAULT_REASONS;
const isVerdictType = (s, insp) => !inspType(s, insp).autoAccept;
// One completed inspection per product is the reference report — what a good pallet looks like for controllers.
const toggleReferenceInspection = (set, productId, inspId) => set(x => ({ ...x, inspections: x.inspections.map(i => i.productId === productId ? { ...i, isReference: i.id === inspId ? !i.isReference : false } : i) }));
const referenceOf = (s, productId) => (s.inspections || []).find(i => i.productId === productId && i.isReference);
const settingsOf = s => ({ companyName: "Picnic Technologies", qcEmail: "qc@picnic.nl", rejectionWindowHours: 24, deadlineWarnHours: 6, deadlineWarnHoursRisky: 10, riskyLookbackDays: 14, requirePoOnReject: false, resultIcons: {}, ...(s.settings || {}) });
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
const levelLabel = (t, s) => t.scope === "Global" ? "global" : t.scope === "Category" ? `category ${s.categories.find(c => c.id === t.categoryId)?.name ?? "?"}` : `product`;

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
const scopeLabel = (t, categories, products) => !t ? "—" : t.scope === "Global" ? "global template" : t.scope === "Category" ? `category „${categories.find(c => c.id === t.categoryId)?.name}"` : `product „${products.find(p => p.id === t.productId)?.name}"`;
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
      if (pf) { usedParentFields.add(pf.id); const patch = {}; ["specId", "specName", "problemBelowId", "problemAboveId", "problemMismatchId", "required", "allowPhotos"].forEach(k => { if ((f[k] ?? null) !== (pf[k] ?? null) && f[k] !== undefined) patch[k] = f[k]; }); if (Object.keys(patch).length) nt.fieldOverrides[pf.id] = patch; }
      else nt.fields.push({ ...f, moduleId: mid });
    });
    parent.fields.forEach(pf => { if (!usedParentFields.has(pf.id) && !nt.suppressed.includes(pf.moduleId)) nt.suppressed.push(pf.id); });
    (t.problemRefs || []).forEach(r => { const mid = modMap[r.moduleId]; const pr = parent.problemRefs.find(x => x.moduleId === mid && x.problemTypeId === r.problemTypeId && !usedParentRefs.has(x.id)); if (pr) usedParentRefs.add(pr.id); else nt.problemRefs.push({ ...r, moduleId: mid }); });
    parent.problemRefs.forEach(pr => { if (!usedParentRefs.has(pr.id) && !nt.suppressed.includes(pr.moduleId)) nt.suppressed.push(pr.id); });
    out.push(nt); done.push(nt);
  }
  return { ...s, templates: out };
};

// ═══════════════════ PHOTOS: pick from disk, keep the original, thumbnail strip ═══════════════════
// In the real system: file → upload to server → InspectionPhoto.FilePath; the UI shows a thumbnail once upload completes.
// The file is stored at the camera's resolution. JPEG/PNG/WEBP/GIF stay byte for byte. HEIC is transcoded at full pixels.
// iOS quirk: a detached <input type=file> can be garbage-collected while the picker converts several HEIC photos,
// so its change event never fires. Keep the input in the document (hidden) until the selection is processed.
let _pickerEl = null;
const mountPicker = i => { if (_pickerEl) _pickerEl.remove(); i.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0"; document.body.appendChild(i); _pickerEl = i; };
const unmountPicker = i => { i.remove(); if (_pickerEl === i) _pickerEl = null; };
// Photos are files on the state server, not base64 inside the shared state — a photo is { id, path, at, name }.
// If the upload fails (offline, old server) the data URL stays in place, so nothing is ever lost.
const uploadPhoto = async dataUrl => { try { const base = (typeof window !== "undefined" && window.__qcServer) || ""; const r = await fetch(`${base}/photos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) }); if (!r.ok) return null; const j = await r.json(); return j.path || null; } catch { return null; } };
// Always shrink BEFORE uploading: a phone camera frame is 3–5 MB at full size and the whole app only ever shows it
// at ≤ 1600 px (the old code uploaded the original and shrank only when the upload failed — that is why product
// and inspection screens took seconds to paint). A ≤ 480 px thumb goes up alongside for lists, tiles and headers.
const persistPicked = async (d, name) => {
  const main = (await shrinkPhoto(d)) || d;
  const thumbData = (await shrinkPhoto(main, THUMB_EDGE, 0.74)) || null;
  const path = await uploadPhoto(main);
  if (!path) return { id: uid(), dataUrl: main, at: nowISO(), name, size: main.length };   // offline / old server: the data URL stays; the server moves it to /photos on save
  const thumb = thumbData && thumbData.length < main.length ? await uploadPhoto(thumbData) : null;
  return { id: uid(), path, ...(thumb ? { thumb } : {}), at: nowISO(), name };
};
const pickPhotos = (opts = {}) => new Promise(res => {
  const i = document.createElement("input"); i.type = "file"; i.accept = "image/*,.heic,.heif"; i.multiple = !opts.capture; if (opts.capture) i.setAttribute("capture", "environment");
  mountPicker(i);
  let done = false;
  const finish = v => { if (done) return; done = true; unmountPicker(i); res(v); };
  i.onchange = async () => {
    const out = [], failed = [];
    for (const f of Array.from(i.files || [])) {
      let d = await keepPhoto(f);
      if (!d) d = await readAsDataUrl(f);
      if (d) out.push(await persistPicked(d, f.name)); else failed.push(f.name);
    }
    finish({ out, failed });
  };
  i.addEventListener("cancel", () => finish({ out: [], failed: [] }));
  i.click();
});
const asPhotoList = v => Array.isArray(v) ? v : [];
const photoSrc = ph => (ph && (ph.path || ph.dataUrl)) || "";
const photoData = memoPdfPhoto(fetchPdfPhotoSrc);
function PhotoStrip({ photos, onAdd, onRemove, onReplace, size = 64, addLabel = "Add photo", label }) {
  const [view, setView] = useState(null); const [busy, setBusy] = useState(false);
  const [cam, setCam] = useState(false);
  const [peek, setPeek] = useState(false);
  const list = asPhotoList(photos);
  const [err, setErr] = useState("");
  const thumb = peek ? 240 : size;
  const add = async (capture) => {
    if (capture && navigator.mediaDevices?.getUserMedia) { setCam(true); return; }
    setBusy(true); setErr("");
    try { const { out, failed } = await pickPhotos({ capture: false }); if (out.length) onAdd(out); if (failed.length) setErr(`Could not load: ${failed.join(", ")} — too large or unsupported format.`); }
    finally { setBusy(false); }
  };
  const shot = async dataUrl => {
    const ph = await persistPicked(dataUrl, "photo.jpg");
    if (ph) onAdd([ph]);
    return ph;
  };
  const replace = async (id, dataUrl) => {
    const ph = await persistPicked(dataUrl, "photo.jpg");
    if (ph && onReplace) onReplace(id, ph);
    return ph;
  };
  const rotateView = async (turns) => {
    const ph = list[view]; if (!ph || !onReplace) return;
    const next = await rotateImage(photoSrc(ph), turns);
    await replace(ph.id, next);
  };
  const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const loupe = list.length > 0 && (
    <button type="button" onClick={() => setPeek(p => !p)} className="h-7 px-2.5 rounded-full inline-flex items-center gap-1 text-[11px] font-semibold flex-shrink-0" style={{ background: peek ? C.ink : C.bg, color: peek ? C.onDark : C.ink, border: `1px solid ${peek ? C.ink : C.line}` }} aria-label={peek ? "Shrink photos" : "Enlarge photos"} aria-pressed={peek} title={peek ? "Shrink photos" : "Enlarge photos"}>
      <Ic i={Search} s={13} mr={0} />{peek ? "Smaller" : "Larger"}
    </button>
  );
  return (
    <div>
      {(label || loupe) && <div className="flex items-center gap-2 mb-1.5">{label ? <p className="text-xs flex-1 min-w-0" style={{ color: C.muted }}>{label}</p> : <div className="flex-1" />}{loupe}</div>}
      <div className="flex flex-wrap gap-2 items-center">
      {list.map(ph => <div key={ph.id} className="relative"><img src={thumbSrc(ph)} loading="lazy" decoding="async" alt="" onClick={() => setView(list.indexOf(ph))} onError={e => { const fb = ph.dataUrl; if (fb && e.currentTarget.dataset.fb !== "1") { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }} className="rounded-lg cursor-pointer" style={{ width: thumb, height: thumb, objectFit: peek ? "contain" : "cover", background: peek ? C.surface : undefined, border: `1px solid ${C.line}` }} />{onRemove && <button onClick={() => onRemove(ph.id)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[10px] leading-none" style={{ background: C.bad, color: C.onDark }} title="delete">×</button>}</div>)}
      {busy && <div className="rounded-lg flex items-center justify-center text-[10px]" style={{ width: size, height: size, background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>uploading…</div>}
      {onAdd && touch && <button onClick={() => add(true)} disabled={busy} className="rounded-lg flex flex-col items-center justify-center text-xs" style={{ width: size, height: size, border: `1px solid ${C.accent}`, color: C.onDark, background: C.accent, gap: 2 }}><Ic i={Camera} s={size >= 56 ? 18 : 14} mr={0} />{size >= 56 && <span className="text-[10px] leading-tight">Take photo</span>}</button>}
      {onAdd && <button onClick={() => add(false)} disabled={busy} className="rounded-lg flex flex-col items-center justify-center text-xs" style={{ width: size, height: size, border: `1px dashed ${C.line}`, color: C.accent, background: C.accentSoft, gap: 2 }}><Ic i={ImageIcon} s={size >= 56 ? 18 : 14} mr={0} />{size >= 56 && <span className="text-[10px] leading-tight">{touch ? "From library" : addLabel}</span>}</button>}
      {!onAdd && list.length === 0 && <span className="text-xs" style={{ color: C.muted }}>no photos</span>}
      {err && <span className="text-xs w-full" style={{ color: C.bad }}>{err}</span>}
      {view != null && <PhotoReview title="Photos" photos={list} index={view} onIndex={setView} onClose={() => setView(null)} onRotate={onReplace ? rotateView : undefined} onDelete={onRemove ? () => { const ph = list[view]; if (!ph) return; onRemove(ph.id); if (list.length <= 1) setView(null); else setView(Math.min(view, list.length - 2)); } : undefined} />}
      {cam && <CameraSheet onShot={shot} onReplace={onReplace ? replace : undefined} onClose={() => setCam(false)} onLibrary={() => { setCam(false); add(false); }} />}
      </div>
    </div>
  );
}

const descendantIds = (problems, rootId) => { const kids = problems.filter(p => p.parentId === rootId).map(p => p.id); return kids.reduce((acc, k) => acc.concat([k], descendantIds(problems, k)), []); };
// ═══════════════════ PDF in the browser (jsPDF from cdnjs) — same sections as the server-side generator ═══════════════════
const loadScript = src => new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"][data-loaded]`)) return res(); const el = document.createElement("script"); el.src = src; const timer = setTimeout(() => rej(new Error("Loading the PDF library timed out — this sandbox may block scripts from cdnjs.cloudflare.com.")), 10000); el.onload = () => { clearTimeout(timer); el.setAttribute("data-loaded", "1"); res(); }; el.onerror = () => { clearTimeout(timer); rej(new Error("The sandbox blocked loading " + src)); }; document.head.appendChild(el); });
const ensureJsPdf = async () => { if (!window.jspdf) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"); if (!window.jspdf?.jsPDF?.API?.autoTable) await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"); return window.jspdf.jsPDF; };
async function buildReportPdf(insp, s) {
  const jsPDF = await ensureJsPdf();
  const settings = settingsOf(s), product = s.products.find(p => p.id === insp.productId) || {}, t = insp.template || { fields: [], modules: [], problemRefs: [], suppressed: [] };
  const problems = withLinkedProblems(s, problemsFor(s, { kind: "Product", id: insp.productId }, new Set(t.suppressed || [])), t);
  const users = byId(s.users), pm = byId(problems), ctrl = users[insp.controllerId] || {};
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const category = s.categories.find(c => c.id === product.categoryId)?.name || "—";
  // facts — only rows with a value
  const facts = [];
  if (insp.supplier) facts.push(["Supplier", insp.supplier]); if (insp.country) facts.push(["Country of origin", insp.country]); if (insp.variety) facts.push(["Variety", insp.variety]);
  if (insp.dateISO) facts.push(["Date code", `${dateCode(insp.dateISO)} (${insp.dateISO})`]);
  if ((insp.pallets || []).filter(Boolean).length) facts.push(["Pallets", insp.pallets.filter(Boolean).join(", ")]);
  if (insp.po) facts.push(["PO", insp.po]);
  facts.push(["Controller", ctrl.name || "—"]);
  // quality status (referenced branches + root-level problems raised from fields)
  const refs = [...(t.problemRefs || [])].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean);
  const covered = new Set(); refs.forEach(n => { covered.add(n.id); descendantIds(problems, n.id).forEach(i => covered.add(i)); });
  const extra = []; (insp.remarks || []).forEach(r => { if (!covered.has(r.leafId) && pm[r.leafId] && !extra.includes(r.leafId)) extra.push(r.leafId); });
  const status = [...refs, ...extra.map(i => pm[i])].map(n => {
    const tol = effTol(problems, t.overrides || [], n.id), agg = aggregate(problems, insp.remarks || [], n.id, totals), pr = presenceIn(problems, insp.remarks || [], n.id), st = statusOf(problems, t.overrides || [], insp.remarks || [], n.id, totals);
    return reportStatusFields({ name: n.name, agg, ownTol: tol, present: pr, state: st, remarkTols: tolsUnder(problems, t.overrides || [], insp.remarks || [], n.id) });
  });
  const remarks = (insp.remarks || []).map(r => { const unit = { PieceCount: "pcs", DirectWeight: "g", WholeUnitCount: "CU" }[r.mode] || ""; const p = r.mode === "Presence" ? null : pct(r, totals); return { problem: pathOf(problems, r.leafId), quantity: r.mode === "Presence" ? "present" : `${r.raw} ${unit}`, pct: p === null ? "—" : `${fmt(p)}%`, tolerance: toleranceDisplay(effTol(problems, t.overrides || [], r.leafId)), source: r.auto ? "measurement" : "reported" }; });
  const answered = (t.fields || []).filter(f => !isSystem(f.type) && insp.values?.[f.id] !== undefined && insp.values?.[f.id] !== "").sort(bySort);
  const parameters = answered.map(f => parameterRow(f, insp.values[f.id], s, product, insp.sample?.piecesPerCu));
  const photoGroups = photoGroupsOf(t, insp, problems);
  const audit = (insp.audit || []).map(a => [a.action, `${fmtTime(a.at)} · ${users[a.userId]?.name || ""}${users[a.userId]?.email ? ` (${users[a.userId].email})` : ""}${a.details ? ` — ${a.details}` : ""}`]);
  const model = {
    id: insp.id, ok: insp.result === "Accepted", result: insp.result, typeName: inspType(s, insp).name, company: settings.companyName, qcEmail: settings.qcEmail,
    generatedAt: new Date().toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }), icon: settings.resultIcons?.[insp.result] || null,
    product: { name: product.name || "—", articleId: product.articleId, category, isBio: !!product.isBio },
    inspectedAt: fmtTime(insp.completedAt), controller: ctrl.name || "—", edited: insp.lastEditedBy ? `edited ${fmtTime(insp.lastEditedAt)} by ${users[insp.lastEditedBy]?.name || ""}` : "",
    sample: { headline: `${fmt(cu)} CU`, detail: `${insp.sample?.tu || 0} TU × ${insp.sample?.cusPerTu || 0} CU${totals.pieces ? ` · ${fmt(totals.pieces)} pcs` : ""}${totals.weight ? ` · ${fmt(totals.weight)} g` : ""}` },
    facts, status, remarks, parameters, comment: insp.comment || "", photoGroups, audit,
  };
  return drawReportPdf(new jsPDF({ unit: "mm", format: "a4" }), model, photoData);
}
const pdfFileName = (insp, s) => `QC_Report_${(s.products.find(p => p.id === insp.productId)?.name || "report").replace(/[^\w]+/g, "_")}_${insp.id.toUpperCase()}.pdf`;
function PdfSaveOverlay({ phase, err, blob, url, fileName, onClose }) {
  const [busy, setBusy] = useState(false);
  const onSave = async () => {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const result = await savePdfFile(blob, fileName, { url });
      if (result === "shared" || result === "downloaded" || result === "aborted") onClose();
    } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "rgba(20,26,22,.92)", zIndex: 70 }}>
      <div className="flex items-center gap-3 px-4" style={{ height: 52, background: "#1a211d", color: "#fff" }}>
        <span className="text-sm font-medium truncate">Download PDF</span>
        <div className="flex-1" />
        <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ background: "#3a443d", color: "#fff" }}>Close</button>
      </div>
      {err && <div className="px-4 py-2 text-sm" style={{ background: "#5a2a2a", color: "#fff" }}>{err}</div>}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center text-sm" style={{ color: "#fff" }}>
        {phase === "generating" && !err && <p>Generating PDF…</p>}
        {phase === "ready" && (
          <>
            <p>Tap Save PDF to put the file on this phone.</p>
            <button type="button" onClick={onSave} disabled={busy} className="text-base px-6 py-3 rounded-2xl font-semibold" style={{ background: "#fff", color: "#111" }}>{busy ? "Saving…" : "Save PDF"}</button>
          </>
        )}
      </div>
    </div>
  );
}
function PdfViewer({ insp, s, onClose, intent = "open" }) {
  const [pack, setPack] = useState(null); const [err, setErr] = useState("");
  const fileName = pdfFileName(insp, s);
  useEffect(() => {
    let alive = true, created = null;
    (async () => { try { const d = await buildReportPdf(insp, s); if (!alive) return; const blob = d.output("blob"); created = URL.createObjectURL(blob); setPack({ blob, url: created }); } catch (e) { if (alive) setErr(String(e.message || e)); } })();
    return () => { alive = false; if (created) URL.revokeObjectURL(created); };
  }, [insp.id]);
  useEffect(() => {
    if (!pack) return;
    if (intent === "download") {
      if (needsShareToSave()) return;
      triggerAnchorDownload(pack.url, fileName);
      onClose();
      return;
    }
    const touch = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
    if (touch) { window.location.assign(pack.url); return; }
    const w = window.open(pack.url, "_blank", "noopener");
    if (w) onClose();
    else window.location.assign(pack.url);
  }, [pack, intent, fileName]);
  const onSave = async () => {
    if (!pack) return;
    const result = await savePdfFile(pack.blob, fileName, { url: pack.url });
    if (result === "shared" || result === "downloaded" || result === "aborted") onClose();
  };
  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "rgba(20,26,22,.92)", zIndex: 70 }}>
      <div className="flex items-center gap-3 px-4" style={{ height: 52, background: "#1a211d", color: "#fff" }}>
        <span className="text-sm font-medium truncate">{intent === "download" ? "Download PDF" : "Opening report"}</span>
        <div className="flex-1" />
        {pack && <button type="button" onClick={onSave} className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: "#fff", color: "#111" }}>Save PDF</button>}
        <button type="button" onClick={onClose} className="text-sm px-3 py-2 rounded-lg" style={{ background: "#3a443d", color: "#fff" }}>Close</button>
      </div>
      {err && <div className="px-4 py-2 text-sm" style={{ background: "#5a2a2a", color: "#fff" }}>{err}</div>}
      <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center text-sm" style={{ color: "#fff" }}>
        {!pack && !err && <p>Generating PDF…</p>}
        {pack && intent === "download" && needsShareToSave() && (
          <>
            <p>Tap Save PDF to put the file on this phone.</p>
            <button type="button" onClick={onSave} className="text-base px-6 py-3 rounded-2xl font-semibold" style={{ background: "#fff", color: "#111" }}>Save PDF</button>
          </>
        )}
        {pack && intent === "download" && !needsShareToSave() && <p>If the file did not start, tap Save PDF.</p>}
        {pack && intent !== "download" && <p>If the report did not open, tap Save PDF or Close.</p>}
      </div>
    </div>
  );
}

// ═══════════════════ PALLETS OF THE SAME DELIVERY (attach to this report) ═══════════════════
function DeliveryPallets({ product, insp, onAdd, compact }) {
  const rows = product ? sameDeliveryPallets(product, insp) : [];
  if (!rows.length) return null;
  const same = attachableSameDay(rows);
  const other = otherDeliveryDay(rows);
  const known = rows.basis !== "none";
  return (
    <div className="rounded-xl mt-2 mb-2" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${same.length ? C.accent : C.line}` }}>
      <div className="px-3 pt-2.5 pb-1 flex items-center gap-2"><span style={{ color: C.accent }}><Ic i={Truck} s={14} mr={0} /></span><span className="text-sm flex-1"><b>More pallets of this product on the docks</b>{known ? ` — ${same.length} from this delivery` : ""}</span>{known && same.length > 1 && <button onClick={() => onAdd(same.map(r => r.hu))} className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>Add all {same.length}</button>}</div>
      {rows.basis === "none" && <p className="px-3 pb-1 text-[11px]" style={{ color: C.muted }}>Enter or scan the pallet you sampled first — then I can tell which of these are from the same delivery.</p>}
      {rows.basis === "today" && <p className="px-3 pb-1 text-[11px]" style={{ color: C.muted }}>The sampled pallet isn't on the dock sheet yet — assuming today's delivery.</p>}
      {same.map(r => <div key={r.hu} className="flex items-center gap-2 px-3 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1 min-w-0"><span className="block text-xs font-mono">HU {r.hu}</span><span className="block text-[11px]" style={{ color: C.muted }}>{r.location} · {r.onDock} on dock / {r.inBuffer} in buffer · arrived {r.arrived}{r.po ? ` · PO ${r.po}` : ""}{r.quantity != null ? ` · ${r.quantity} TU` : ""}</span></span>{known && <button onClick={() => onAdd([r.hu])} className="text-xs font-medium px-2.5 py-1 rounded-lg" style={{ background: C.ink, color: C.onDark }}>Add</button>}</div>)}
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
  ["arrived", "Arrival date", true], ["arrivedTime", "Arrival time", false], ["transporter", "Transporter", false], ["supplier", "Supplier", false], ["po", "PO ID", false],
  ["cusPerTu", "CU per TU", false], ["quantity", "Quantity (TU on the pallet)", false], ["sortable", "Sortable", false], ["ignore", "— ignore —", false],
];
const BLOCKED_TARGETS = [["article", "Article ID (from batch / UOM)", true], ["name", "Product name", false], ["hu", "Pallet SSCC", false], ["location", "Dock location", false], ["zone", "Reach zone", false], ["pickLocation", "Pick location", false], ["deadline", "Departure deadline", false], ["wmsStatus", "WMS status", false], ["status", "QC status (Not started / Started / Completed)", false], ["date", "Date", false], ["time", "Time", false], ["ignore", "— ignore —", false]];
const targetsFor = purpose => purpose === "Products" ? PRODUCT_TARGETS : purpose === "Blocked" ? BLOCKED_TARGETS : purpose === "Specs" ? SPEC_TARGETS : purpose === "Rejections" ? REJECTION_TARGETS : DOCK_TARGETS;
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
const ALIASES = { hu: ["handlingunit", "hu", "sscc", "pallet", "palletid"], article: ["uomid", "uom", "articleid", "article", "sku", "artikel", "batch"], articleId: ["uomid", "uom", "articleid", "article", "sku", "artikel"], name: ["itemname", "productname", "name", "product", "omschrijving", "item"], location: ["location", "locatie", "stock", "dock"], priority: ["priorityitem", "priority", "prioriteit"], blocking: ["neededtoday", "urgent"], skippable: ["skippable", "skip"], arrived: ["arrivaldate", "arrival", "date", "datum"], arrivedTime: ["arrivaltime", "time", "tijd"], transporter: ["transporter", "carrier", "vervoerder"], supplier: ["supplier", "leverancier", "dostawca", "vendor", "grower"], po: ["poid", "po", "order", "ponumber"], cusPerTu: ["cupertu", "cus", "cu"], sortable: ["sortable", "sorteerbaar"], barcodeCu: ["barcodecu", "cubarcode", "eancu", "cuean", "consumerbarcode", "barcode", "ean", "gtin"], barcodeTu: ["barcodetu", "tubarcode", "eantu", "tuean", "boxbarcode", "casebarcode", "itf14", "itf", "gtin14", "tradeunitbarcode"], piecesPerCu: ["piecespercu", "pieces", "stuks"], weightPerCu: ["weightpercu", "weight", "gewicht"], category: ["category", "categorie"], status: ["qcstatus", "status", "state"], date: ["date", "datum"], time: ["time", "tijd"], zone: ["reachzone", "zone"], pickLocation: ["picklocation", "pick"], deadline: ["departuredeadline", "deadline", "departure"], wmsStatus: ["wmsstatus", "status"], quantity: ["quantity", "qty", "aantal", "tuonpallet", "tusonpallet", "units", "colli"] }
Object.assign(ALIASES, SPEC_ALIASES);
Object.entries(REJECTION_ALIASES).forEach(([k, v]) => { ALIASES[k] = [...new Set([...(ALIASES[k] || []), ...v])]; }); // union: the dock sheet owns some of these keys too
// Two passes over the whole header: exact alias matches first (so "Priority item" beats "Priority score"), then loose matches on targets still free.
const suggestMappings = (header, rows, targets) => {
  const norm = h => h.toLowerCase().replace(/[^a-z0-9]/g, ""); const free = new Set(targets.map(t => t[0]).filter(k => k !== "ignore")); const out = header.map(h => ({ source: h, target: "ignore", transform: "none", required: false }));
  const assign = (i, k) => { const sample = rows[0]?.[i]; out[i] = { source: header[i], target: k, transform: suggestTransform(k, sample), required: !!targets.find(t => t[0] === k)?.[2] }; free.delete(k); };
  header.forEach((h, i) => { const c = norm(h); for (const k of free) if ((ALIASES[k] || []).some(a => a === c)) { assign(i, k); break; } });
  header.forEach((h, i) => { if (out[i].target !== "ignore") return; const c = norm(h); if (!c) return; for (const k of free) if ((ALIASES[k] || []).some(a => a.length > 2 && c.includes(a))) { assign(i, k); break; } });
  out.forEach((m, i) => { if (m.target === "status" && free.has("wmsStatus")) { const v = String(rows[0]?.[i] || ""); if (/^[A-Z0-9_]{6,}$/.test(v)) { out[i] = { ...m, target: "wmsStatus", transform: "none", required: false }; free.delete("wmsStatus"); free.add("status"); } } });
  // A required article column with a blank header ("col1") cannot match by name — take the first unmapped column whose
  // values look like article IDs (the commercial spec sheet has exactly that).
  const artKey = free.has("articleId") ? "articleId" : free.has("article") ? "article" : null;
  if (artKey) { const looks = v => /^(HE)?\d{7,9}(-\d+)?$/i.test(String(v || "").trim()); const i = out.findIndex((m, ix) => m.target === "ignore" && rows.slice(0, 5).filter(r => r[ix] != null && String(r[ix]).trim()).length > 0 && rows.slice(0, 5).every(r => !String(r[ix] ?? "").trim() || looks(r[ix]))); if (i >= 0) assign(i, artKey); }
  return out;
};
// The sheet grew a column (Quantity arrived this way). Keep every mapping the Head made to a real target and, for header
// cells that are new or still on "ignore", take the suggestion — but only onto targets still free. A column the Head
// mapped somewhere is never touched; an ignored column is re-suggested because "ignore" is also what a column gets
// when its target did not exist yet (the mapping may have been saved after the column appeared but before the app
// knew the target), and the suggestion can only land on a target nobody uses.
const adoptNewColumns = (existing, header, rows, targets) => {
  const used = new Set(existing.map(m => m.target).filter(t => t && t !== "ignore"));
  const suggested = suggestMappings(header, rows, targets);
  return header.map((h, i) => { const cur = existing.find(m => m.source === h); if (cur && cur.target && cur.target !== "ignore") return cur; const s = suggested[i]; if (s && s.target !== "ignore" && !used.has(s.target)) { used.add(s.target); return s; } return cur || { source: h, target: "ignore", transform: "none", required: false }; });
};
const dedupeMappings = ms => { const seen = new Set(); return ms.map(m => { if (m.target === "ignore") return m; if (seen.has(m.target)) return { ...m, target: "ignore", required: false }; seen.add(m.target); return m; }); };
const suggestTransform = (target, sample) => target === "deadline" ? "date_iso" : target === "status" ? "status" : target === "article" || target === "articleId" ? (/^[A-Z]+\d+-\d+$/.test(String(sample || "").trim()) ? "uom_article" : "none") : target === "cusPerTu" ? (/-\d+$/.test(String(sample || "").trim()) ? "uom_cus" : "number") : target === "quantity" || target === "tu" ? "number" : target === "blocking" || target === "skippable" || target === "sortable" ? "yesno" : target === "arrived" ? "date_dmy" : target === "priority" ? "priority" : "none";
// Real sheets have a title row above the header and side panels to the right: find the header row (the one with the most
// non-empty cells among the first 10, preferring one that contains "Handling Unit"/"UOM"), then cut columns past the header's width.
const detectTable = ({ header, rows }, { bridgeGaps = false } = {}) => {
  const all = [header, ...rows];
  let best = 0, bestScore = -1;
  all.slice(0, 10).forEach((r, i) => { const cells = r.map(c => String(c).trim()); const filled = cells.filter(Boolean).length; const bonus = cells.some(c => /handling unit|uom|item name|article|sku|ean|cuname|sortable/i.test(c) && !/:\s*$/.test(c)) ? 100 : 0; /* side-panel labels ("SKU on dock:") must not make a data row look like the header */ const score = filled + bonus; if (score > bestScore) { bestScore = score; best = i; } });
  const h = all[best].map(c => String(c).trim()); const first = Math.max(0, h.findIndex(c => !!c)); let width = h.findIndex((c, i) => i > first && !c); if (width < 0) width = h.length;
  // The rejections sheet separates its "Inbound / DC5 / Finance to fill in" sections with one blank header column; bridgeGaps keeps the whole labelled run.
  if (bridgeGaps) { let last = -1; h.forEach((c, i) => { if (c) last = i; }); width = last + 1; } // a blank cell BEFORE the first label (the spec sheet's unnamed ID column) is part of the table // the data table is the contiguous run of header cells from the left; side panels come after a gap
  const hdr = h.slice(0, width).map((c, i) => c || `col${i + 1}`);
  const body = all.slice(best + 1).map(r => r.slice(0, width).map(c => String(c ?? "").trim())).filter(r => r.some(Boolean));
  return { header: hdr, rows: body };
};
// Quote-aware: a Google Sheets copy wraps multi-line cells (long rejection reasons) in quotes — splitting on newlines would break those rows.
const parseTsv = txt => { const first = txt.split(/\r?\n/).find(l => l.trim()) || ""; const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ","; const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"' && cell === "") q = true; else if (ch === sep) { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch; } if (cell !== "" || row.length) { row.push(cell); rows.push(row); } const nonEmpty = rows.filter(r => r.some(c => String(c).trim())); if (!nonEmpty.length) return { header: [], rows: [] }; return { header: nonEmpty[0].map(h => h.trim()), rows: nonEmpty.slice(1) }; };
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
    const risky = product ? s.inspections.some(i => i.productId === product.id && i.status === "Completed" && isVerdictType(s, i) && i.result === "Rejected" && i.completedAt && (nowMs - new Date(i.completedAt).getTime()) <= st.riskyLookbackDays * 86400000) || extRejectedRecently(s, r.article, st.riskyLookbackDays, nowMs) : extRejectedRecently(s, r.article, st.riskyLookbackDays, nowMs);
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
      <div className="flex gap-2 overflow-x-auto pt-0.5 pb-2.5" style={{ scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" }}>
        {alerts.map(a => { const left = a.deadlineAt - now; const urgent = left <= 3600000; const expired = left <= 0; return (
          <button key={a.key} onClick={() => onOpen(a)} className="qc-elev text-left rounded-2xl px-3 py-2.5 flex-shrink-0" style={{ width: 150, background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderLeft: `3px solid ${expired || urgent ? C.bad : C.warn}`, boxShadow: lift() }}>
            <p className="text-lg font-bold tracking-tight leading-none" style={{ color: expired || urgent ? C.bad : C.warn, fontVariantNumeric: "tabular-nums" }}>{fmtLeft(left)}</p>
            <p className="text-xs font-medium mt-1.5 truncate">{a.name}</p>
            <p className="text-[11px] truncate" style={{ color: C.muted }}>{a.location}{a.risky ? " · rejected recently" : ""}</p>
            {onMessage && <div className="flex items-center mt-1 text-[10px]" style={{ color: C.muted, minHeight: 14 }}><span onClick={e => { e.stopPropagation(); onMessage(a); }} className="ml-auto underline">assign</span></div>}
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
// Head-only reset of the log: wipes the incidents AND the server's pending "gone but not yet confirmed" candidates
// (otherwise the very next dock push would re-log pallets that vanished just before the reset). Keeps one line of
// audit (who / when / how many) so a suddenly empty list is explainable.
const clearUnreported = (set, user) => set(x => ({ ...x, unreportedPallets: [], dockGoneCandidates: {}, unreportedCleared: { at: nowISO(), byUserId: user.id, count: (x.unreportedPallets || []).length } }));
// QC status: from the sheet when it has one; otherwise derived from the queue (claim) and finished inspections of that pallet/article.
const blockedQueue = s => blockedRowsLive(s).map(b => { const claim = claimOf(s, b); let status = b.status; if (!status) { const done = s.inspections.some(i => i.status === "Completed" && ((b.hu && (i.pallets || []).some(h => String(h).replace(/\D/g, "").endsWith(b.hu.replace(/^0+/, "")))) || (!b.hu && (s.products.find(p => p.id === i.productId)?.articleId === b.article) && (i.completedAt || "") > (claim?.at || "1970")))); status = done ? "Completed" : claim?.status === "taken" ? "Started" : "Not started"; } return { ...b, claim, status, key: claimKey(b), lost: lostOf(s, b) }; });
// How much stands on the pallet, as the sheet gives it: "40 TU". (It used to multiply by CU/TU as well — nobody needs
// the CU total on the dock, it only made the chip longer.)
const palletQty = r => r?.quantity == null ? "" : `${r.quantity} TU`;
const dockRowsLive = s => { const it = (s.integrations || []).find(i => i.purpose === "Dock" && i.rows?.length); if (!it) return CLEAN_START ? [] : SHEET.dock; return dedupeByHu(it.rows.filter(r => !r._errors?.length)).map(r => ({ hu: String(r.hu || "").trim(), article: String(r.article || ""), name: r.name || "", location: r.location || "", priority: r.priority || (r.skippable ? "Skippable" : "Inspection due"), blocking: !!r.blocking, skippable: !!r.skippable, arrived: r.arrived || "", arrivedTime: r.arrivedTime || "", transporter: r.transporter || "", supplier: r.supplier || "", po: r.po || "", cusPerTu: r.cusPerTu ? Number(r.cusPerTu) : null, quantity: r.quantity !== undefined && r.quantity !== null && r.quantity !== "" && !isNaN(Number(r.quantity)) ? Number(r.quantity) : null, sortable: !!r.sortable, onDock: 0, inBuffer: 0 })); };
// Resolve a pallet key (HU, claimKey, lostKey, or unreported id) to a row the portal pallet sheet can render.
const findPalletRow = (s, key) => {
  if (!key) return null;
  const dock = dockRowsLive(s); const blocked = blockedRowsLive(s);
  const byHu = dock.find(r => samePallet(r.hu, key));
  if (byHu) {
    const alsoBlocked = blocked.find(r => r.hu && samePallet(r.hu, key));
    return { ...byHu, kind: alsoBlocked ? "blocked" : "dock", blockedQueue: !!alsoBlocked };
  }
  const byBlockedHu = blocked.find(r => r.hu && samePallet(r.hu, key)); if (byBlockedHu) return { ...byBlockedHu, kind: "blocked" };
  const byClaim = blocked.find(r => claimKey(r) === key); if (byClaim) return { ...byClaim, kind: "blocked" };
  const lostHit = Object.entries(s.lostPallets || {}).find(([k, m]) => k === key || samePallet(m.hu, key));
  if (lostHit) {
    const [lk, m] = lostHit;
    const row = [...dock, ...blocked].find(r => lostKey(r) === lk);
    if (row) return { ...row, kind: dock.some(r => lostKey(r) === lk) ? "dock" : "blocked" };
    return { hu: m.hu || "", article: m.article || "", name: m.name || "", location: m.location || "", kind: "lost-only" };
  }
  const unrep = (s.unreportedPallets || []).find(x => x.id === key || (x.hu && samePallet(x.hu, key)));
  if (unrep) return { hu: unrep.hu || "", article: unrep.article || "", name: unrep.name || "", location: unrep.location || "", arrived: "", arrivedTime: "", transporter: unrep.transporter || "", po: unrep.po || "", priority: unrep.priority || "", kind: "unreported" };
  const byArt = dock.find(r => r.article && String(r.article) === String(key)); if (byArt) return { ...byArt, kind: "dock" };
  return null;
};
// Shared: read what the sheet pushed to the server and refresh the matching integration inside the app state.
// Used by the portal (every 60 s on any page) and by the phone (on open / Sync now), so no device depends on the other.
const refreshPushedIntegrations = async (getState, set, force = false) => {
  if (!window.__qcServer) return;
  const s = getState(); const targets = (s.integrations || []).filter(i => i.pushMode && i.purpose !== "Specs" && i.purpose !== "Rejections");
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
      const mappings = target.mappings.length && needed.length ? adoptNewColumns(target.mappings, j.header, j.rows, tg) : suggestMappings(j.header, j.rows, tg);
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
function IntegrationsPage({ s, set, go }) {
  const list = s.integrations || [];
  const [sel, setSel] = useBackSel("integSel", list[0]?.id || null); const it = list.find(i => i.id === sel);
  const [paste, setPaste] = useState(""); const [specIssuesOpen, setSpecIssuesOpen] = useState(false);
  const targets = targetsFor(it?.purpose);
  const patchIt = ch => set(x => ({ ...x, integrations: x.integrations.map(i => i.id === sel ? { ...i, ...ch } : i) }));
  const create = purpose => { const id = uid(); set(x => ({ ...x, integrations: [...(x.integrations || []), { id, name: purpose === "Dock" ? "Dock sheet" : purpose === "Blocked" ? "Blocked pallets sheet" : purpose === "Specs" ? "Product specs sheet (commercial)" : purpose === "Rejections" ? "DC5 rejections sheet" : "Product profiles sheet", purpose, pushMode: true, ...(purpose === "Specs" ? { createMissing: false } : {}), sourceUrl: "", header: [], sample: [], mappings: [], rows: [], lastSyncAt: null, lastError: null }] })); setSel(id); };
  // accepts an Apps Script JSON endpoint ({header, rows}) or a "Publish to web" CSV/TSV link
  const parseCsv = txt => { const rows = []; let row = [], cell = "", q = false; for (let i = 0; i < txt.length; i++) { const ch = txt[i]; if (q) { if (ch === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"') q = true; else if (ch === ",") { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && txt[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += ch; } if (cell !== "" || row.length) { row.push(cell); rows.push(row); } const nonEmpty = rows.filter(r => r.some(c => String(c).trim())); return { header: (nonEmpty[0] || []).map(h => h.trim()), rows: nonEmpty.slice(1) }; };
  const fetchPushed = async target => { if (!window.__qcServer) { patchIt({ liveStatus: "No state server — run `npm run server` locally." }); return; } patchIt({ liveStatus: "Fetching…" }); await refreshPushedIntegrations(() => _S, set, true); const after = (_S.integrations || []).find(i => i.id === target.id); if (!after?.lastPushAt) patchIt({ liveStatus: "Nothing pushed yet — the sheet has not sent data to this server (run pushToQCteam once in Apps Script and check QC_URL)." }); };
  const fetchLive = async target => { if (target?.pushMode) return fetchPushed(target); if (!target?.sourceUrl) return; patchIt({ liveStatus: "Fetching…" }); try { let r, txt; try { r = await fetch(target.sourceUrl); txt = await r.text(); } catch (direct) { if (!window.__qcServer) throw direct; r = await fetch(`${window.__qcServer}/proxy?url=${encodeURIComponent(target.sourceUrl)}`); if (!r.ok) throw new Error(`proxy ${r.status}: ${await r.text()}`); txt = await r.text(); } if (/^\s*<!doctype html|<html[\s>]/i.test(txt)) throw new Error(/sign in/i.test(txt) ? "Google returned a sign-in page — the Apps Script is restricted to your organisation (admin setting), so it can't be fetched anonymously. Use the paste box below instead, or deploy from a private Google account." : "the URL returned a web page, not data — check it's the /exec link (or a published CSV link)");
      if (/user_content_key=/.test(target.sourceUrl)) throw new Error("this is a one-time redirect URL from your browser, not the deployment link — paste the …/macros/s/…/exec address");
      let j; try { j = JSON.parse(txt); } catch { j = txt.includes("\t") && !txt.includes(",") ? parseTsv(txt) : parseCsv(txt); } if (!Array.isArray(j.header) || !Array.isArray(j.rows)) throw new Error("unexpected response — expected JSON {header, rows} or CSV"); const raw = { header: j.header, rows: j.rows }; j = detectTable(j); if (!j.header.some(h => /handling unit|uom|item name|article|sku|ean|name/i.test(h))) throw new Error("no recognisable header row (expected columns like Handling Unit, UOM ID, Item Name)"); const mappings = target.mappings.length && target.header.join("|") === j.header.join("|") ? target.mappings : suggestMappings(j.header, j.rows, targets); const next = { ...target, header: j.header, sample: j.rows, mappings }; const rows = applyMapping(next, j.header, j.rows); patchIt({ header: j.header, sample: j.rows, rawHeader: raw.header, rawRows: raw.rows, mappings, rows: target.purpose !== "Products" ? rows : target.rows, summary: target.purpose !== "Products" ? extractSummary(raw.header, raw.rows) : target.summary, lastSyncAt: nowISO(), liveStatus: `OK — ${j.rows.length} rows at ${new Date().toLocaleTimeString("en-GB")}` }); } catch (e) { const local = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname); patchIt({ liveStatus: local ? `Could not fetch (${e.message}). Most often the Apps Script deployment is not public: open the /exec link in an incognito window — if Google asks you to sign in, redeploy with “Who has access: Anyone”. Also make sure you copied the /exec link, not /dev.` : `Could not fetch (${e.message}). The Claude sandbox blocks cross-origin requests — run the prototype locally to test live.` }); } };
  useEffect(() => { if (!it?.autoRefresh || (!it?.sourceUrl && !it?.pushMode)) return; const id = setInterval(() => fetchLive(it), 60000); return () => clearInterval(id); }, [it?.id, it?.autoRefresh, it?.sourceUrl, it?.pushMode]);
  const pasteFull = useRef(null); // Rejections: the whole pasted table stays here (thousands of rows) — the shared state only gets a sample
  const loadPaste = () => { const isRej = it?.purpose === "Rejections"; const rawT = parseTsv(paste); const { header, rows } = detectTable(rawT, { bridgeGaps: isRej }); if (!header.length) return; const mappings = suggestMappings(header, rows, targets); if (isRej) { pasteFull.current = { header, rows }; patchIt({ header, sample: rows.slice(0, 20), rawHeader: rawT.header, rawRows: rawT.rows.slice(0, 30), mappings, rows: [] }); } else patchIt({ header, sample: rows.slice(0, 500), rawHeader: rawT.header, rawRows: rawT.rows, mappings, rows: [] }); setPaste(""); };
  const resuggest = () => { if (!it?.header.length) return; patchIt({ mappings: suggestMappings(it.header, it.sample, targets) }); };
  const preview = it && it.header.length ? applyMapping(it, it.header, it.sample) : [];
  const missingRequired = it ? targets.filter(t => t[2] && !it.mappings.some(m => m.target === t[0])) : [];
  const bad = preview.filter(r => r._errors.length).length;
  const apply = (opts = {}) => { if (!it) return;
    if (it.purpose === "Rejections") { if (!(pasteFull.current && pasteFull.current.header.join("|") === it.header.join("|"))) return; /* never rebuild the digest from the 20-row sample */ const full = pasteFull.current.rows; const mapped = applyMapping(it, it.header, full); const digest = buildRejectionDigest(mapped, { now: nowISO() }); const { byArticle, latest, ...meta } = digest; set(x => ({ ...x, extRejections: digest, integrations: x.integrations.map(i => i.id === sel ? { ...i, rows: [], lastSyncAt: nowISO(), lastError: digest.skipped ? `${digest.skipped} row(s) skipped` : null, lastRejectionSync: meta, lastResult: `${digest.used} rejections, ${digest.articles} articles` } : i) })); return; }
    if (it.purpose === "Specs") { const res = applySpecSheet(s.products || [], preview, { createMissing: opts.createMissing ?? it.createMissing === true, now: nowISO(), uid, tempSpecs: s.tempSpecs || [] }); set(x => ({ ...x, products: res.products, ...(res.report.liveChanged ? { tempSpecs: res.tempSpecs } : {}), integrations: x.integrations.map(i => i.id === sel ? { ...i, rows: preview, lastSyncAt: nowISO(), lastError: bad ? `${bad} row(s) skipped` : null, lastSpecSync: { ...res.report, issues: res.report.issues.slice(0, 400) } } : i) })); return; }
    if (it.purpose === "Dock" || it.purpose === "Blocked") patchIt({ rows: preview, summary: extractSummary(it.rawHeader || it.header, it.rawRows || it.sample), lastSyncAt: nowISO(), lastError: bad ? `${bad} row(s) skipped` : null }); else { const good = preview.filter(r => !r._errors.length); set(x => { let products = [...x.products]; let added = 0, updated = 0; good.forEach(r => { const id = String(r.articleId || "").trim(); if (!id) return; const ex = products.find(p => p.articleId === id); const catId = r.category ? x.categories.find(c => c.name.toLowerCase() === String(r.category).toLowerCase())?.id : undefined; const patch = { name: r.name || ex?.name || id, barcodeCu: r.barcodeCu || ex?.barcodeCu || "", barcodeTu: r.barcodeTu || ex?.barcodeTu || "", cusPerTu: r.cusPerTu ? String(r.cusPerTu) : ex?.cusPerTu || "", piecesPerCu: r.piecesPerCu ? String(r.piecesPerCu) : ex?.piecesPerCu || "", weightPerCu: r.weightPerCu ? String(r.weightPerCu) : ex?.weightPerCu || "", ...(catId ? { categoryId: catId } : {}) }; if (ex) { products = products.map(p => p.id === ex.id ? { ...p, ...patch } : p); updated++; } else { products.push({ id: uid(), articleId: id, categoryId: catId || (categorySuggestion({ ...x, products }, { name: patch.name })?.conf >= 0.9 ? categorySuggestion({ ...x, products }, { name: patch.name }).categoryId : null), isBio: /\bbio\b/i.test(patch.name), specs: [], supplierIds: [], varieties: [], photos: [], attributes: [], excludedSpecNames: [], isActive: true, ...patch }); added++; } }); return { ...x, products, integrations: x.integrations.map(i => i.id === sel ? { ...i, rows: preview, lastSyncAt: nowISO(), lastError: bad ? `${bad} row(s) skipped` : null, lastResult: `${added} added, ${updated} updated` } : i) }; }); } };
  const [settingsOpen, setSettingsOpen] = useState(null); // null | "mapping" | "source" | "paste" | "dock"
  // ── What the Head sees: a health board, then "needs you", then the plumbing folded away ────────────────────────────────
  const PURPOSE_META = { Dock: { label: "Dock sheet", what: "pallets on the dock → dashboard, scanner, same-delivery pallets", icon: Truck }, Blocked: { label: "Blocked pallets sheet", what: "blocked pallets → Blocked pallets screen", icon: LockIcon }, Products: { label: "Product profiles sheet", what: "article list → product catalog", icon: Package }, Specs: { label: "Product specs sheet (commercial)", what: "minimum specs + live values → product specifications", icon: Package }, Rejections: { label: "DC5 rejections sheet", what: "official rejections → product history, scan result, shift cards", icon: AlertTriangle } };
  const STALE_MIN = 90; // a sheet script runs every 5–15 min; quiet for this long means the trigger died or the server moved
  const health = i => {
    if (!i) return { tone: "muted", title: "—" };
    const pushed = i.lastPushAt || i.lastSyncAt; const age = pushed ? (Date.now() - new Date(pushed).getTime()) / 60000 : null;
    if (i.needsRemap) return { tone: "bad", title: "Sheet columns changed", sub: "the last good data is kept — re-map the columns below", age };
    if (!i.header?.length && !pushed) return { tone: "muted", title: "Not connected yet", sub: "the sheet has not sent anything to the server", age };
    if (i.liveStatus && !/^OK|^Fetching/.test(i.liveStatus) && !pushed) return { tone: "warn", title: "Not receiving data", sub: i.liveStatus, age };
    if (age != null && age > STALE_MIN) return { tone: "warn", title: `No push for ${age < 120 ? `${Math.round(age)} min` : `${Math.round(age / 60)} h`}`, sub: "the sheet's script should send every few minutes — check its trigger in Apps Script", age };
    return { tone: "ok", title: "Up to date", sub: pushed ? `last push ${fmtTime(pushed)}` : "", age };
  };
  const toneCol = t => t === "ok" ? C.ok : t === "warn" ? C.warn : t === "bad" ? C.bad : C.muted;
  const Dot = ({ tone, s: sz = 8 }) => <span className="inline-block rounded-full flex-shrink-0" style={{ width: sz, height: sz, background: toneCol(tone) }} />;
  const rowCount = i => i.purpose === "Specs" ? i.lastSpecSync?.rows : i.purpose === "Rejections" ? i.lastRejectionSync?.rows : i.rows?.length;
  const notAdded = Object.keys(PURPOSE_META).filter(p => !list.some(i => i.purpose === p));
  const h = health(it);
  // Per-sheet "needs you" items: things only a person can settle. Each is { tone, text, action? }.
  const todo = (() => { if (!it) return []; const out = [];
    if (it.needsRemap) out.push({ tone: "bad", text: it.liveStatus || "Sheet columns changed — re-map them.", action: ["Open column mapping", () => setSettingsOpen("mapping")] });
    if (missingRequired.length && it.header.length) out.push({ tone: "bad", text: `Required fields not mapped: ${missingRequired.map(t => t[1]).join(", ")}.`, action: ["Open column mapping", () => setSettingsOpen("mapping")] });
    if (it.purpose === "Specs" && it.lastSpecSync) { const rep = it.lastSpecSync; const unknown = (rep.issues || []).filter(i => i.kind === "unknown").length;
      if (unknown && it.createMissing !== true) out.push({ tone: "info", text: `${unknown} article${unknown === 1 ? "" : "s"} in the sheet ${unknown === 1 ? "is" : "are"} not in the catalog, so their specs were skipped.`, action: ["Add them to the catalog", () => { patchIt({ createMissing: true }); apply({ createMissing: true }); }] });
      const live = (s.tempSpecs || []).filter(t => t.origin === "sheet" && !t.endedAt).length + (s.products || []).filter(p => p.liveNote?.origin === "sheet").length;
      if (live) out.push({ tone: "ok", text: `${live} live value${live === 1 ? "" : "s"} from the sheet ${live === 1 ? "is" : "are"} active (temporary minimums and notes on the products).`, action: go ? ["See temporary specs", () => go("tempspecs")] : null });
    }
    if (it.purpose === "Rejections" && it.lastRejectionSync?.skipped) out.push({ tone: "warn", text: `${it.lastRejectionSync.skipped} rows had no article number and were ignored.` });
    if ((it.purpose === "Dock" || it.purpose === "Blocked") && bad) out.push({ tone: "warn", text: `${bad} of ${preview.length} rows cannot be used (missing a required value) and are skipped.`, action: ["See which", () => setSettingsOpen("paste")] });
    if ((it.purpose === "Dock" || it.purpose === "Blocked") && it.header.length && !Object.keys(extractSummary(it.rawHeader || it.header, it.rawRows || it.sample)).length) out.push({ tone: "warn", text: "No summary cells found (“SKU on dock:”, “Non urgent pallets on dock:”…) — the dashboard counts rows instead." });
    return out; })();
  const toggleSettings = k => setSettingsOpen(o => o === k ? null : k);
  const specReport = it?.purpose === "Specs" ? it.lastSpecSync : null;
  const specConflicts = specReport ? (specReport.issues || []).filter(i => i.kind === "conflict") : [];
  const resolveConflict = (i, choice) => set(x => ({ ...x, products: resolveSpecConflict(x.products, i, choice, nowISO()), integrations: x.integrations.map(q => q.id === it.id && q.lastSpecSync ? { ...q, lastSpecSync: { ...q.lastSpecSync, issues: q.lastSpecSync.issues.filter(z => z !== i), conflicts: Math.max(0, (q.lastSpecSync.conflicts || 1) - 1) } } : q) }));
  const prodName = a => productForArticle(s, a)?.name || a;
  const settingsRow = (k, title, hint, children) => <div key={k} className="rounded-xl mb-2" style={{ border: `1px solid ${C.line}`, background: settingsOpen === k ? C.surface : "transparent" }}>
    <button type="button" onClick={() => toggleSettings(k)} className="w-full text-left px-4 py-3 flex items-center gap-3"><span className="text-xs" style={{ color: C.muted, transform: settingsOpen === k ? "rotate(90deg)" : "none", display: "inline-block" }}>▶</span><span className="text-sm font-medium flex-1">{title}</span>{hint && <span className="text-xs" style={{ color: C.muted }}>{hint}</span>}</button>
    {settingsOpen === k && <div className="px-4 pb-4">{children}</div>}
  </div>;
  const pushScript = purpose => `const QC_URL = "${window.__qcServer || "https://YOUR-SERVER"}/sheet/${purpose.toLowerCase()}";
const QC_KEY = ""; // same value as QC_SYNC_KEY on the server

function pushToQCteam() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sh.getDataRange().getDisplayValues();
  const payload = { header: rows[0], rows: rows.slice(1).filter(r => r.some(c => String(c).trim())), from: SpreadsheetApp.getActiveSpreadsheet().getName() };
  const res = UrlFetchApp.fetch(QC_URL, { method: "post", contentType: "application/json", headers: QC_KEY ? { "X-Sync-Key": QC_KEY } : {}, payload: JSON.stringify(payload), muteHttpExceptions: true });
  Logger.log(res.getResponseCode() + " " + res.getContentText());
}`;
  return (
    <div>
      <h1 className="mb-1">Sheets</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 680 }}>The Google Sheets the team already keeps feed QCteam on their own: each sheet's script sends its rows to the server every few minutes. This page shows whether that is working and what needs a decision from you.</p>
      <div className="flex gap-4 items-start">
        <aside className="w-64 flex-shrink-0">
          {list.map(i => { const hh = health(i); const n = rowCount(i); const M = PURPOSE_META[i.purpose] || PURPOSE_META.Products; return <button key={i.id} onClick={() => setSel(i.id)} className="qc-tile w-full text-left rounded-xl mb-1.5 px-3 py-2.5" style={{ background: sel === i.id ? C.accentSoft : C.surface, border: `1px solid ${sel === i.id ? C.accent : C.line}` }}>
            <div className="flex items-center gap-2"><Ic i={M.icon} s={14} mr={0} /><span className="text-sm font-medium flex-1 truncate" style={{ color: sel === i.id ? C.accent : C.ink }}>{i.name}</span><Dot tone={hh.tone} /></div>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: hh.tone === "ok" || hh.tone === "muted" ? C.muted : toneCol(hh.tone) }}>{hh.tone === "ok" ? `${hh.sub}${n ? ` · ${n} rows` : ""}` : hh.title}</p>
          </button>; })}
          {notAdded.length > 0 && <div className="mt-4"><p className="label-sm mb-1.5" style={{ color: C.muted }}>Add a sheet</p>{notAdded.map(p => <button key={p} onClick={() => create(p)} className="w-full text-left text-xs px-3 py-1.5 rounded-lg" style={{ color: C.accent }}>+ {PURPOSE_META[p].label}</button>)}</div>}
        </aside>
        <div className="flex-1 min-w-0">
          {!it ? <Card><Empty icon="📋" title="No sheets connected yet" hint="Start with the dock sheet — it feeds the dashboard, the scanner and same-delivery pallets." action={<Primary onClick={() => create("Dock")}>Add the dock sheet</Primary>} /></Card> : <>
            {/* 1 · Status */}
            <Card style={{ marginBottom: 16, borderLeft: `4px solid ${toneCol(h.tone)}` }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap"><Dot tone={h.tone} s={10} /><span className="text-lg font-semibold">{h.title}</span>{it.liveStatus === "Fetching…" && <span className="text-xs" style={{ color: C.muted }}>checking…</span>}</div>
                  <p className="text-sm mt-0.5" style={{ color: C.muted }}>{h.sub}{rowCount(it) ? ` · ${rowCount(it)} rows` : ""}{it.lastSyncAt && it.purpose !== "Specs" && it.purpose !== "Rejections" && it.lastSyncAt !== it.lastPushAt ? ` · applied ${fmtTime(it.lastSyncAt)}` : ""}</p>
                  <p className="text-xs mt-2" style={{ color: C.muted }}>{(PURPOSE_META[it.purpose] || {}).what}{it.pushMode ? " · the sheet's script pushes to the server" : it.sourceUrl ? " · the portal pulls from a published link" : " · no live source: paste rows to test"}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">{(it.pushMode || it.sourceUrl) && it.purpose !== "Specs" && it.purpose !== "Rejections" && <Ghost onClick={() => fetchLive(it)}>Check now</Ghost>}<button onClick={() => toggleSettings("source")} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 30, border: `1px solid ${C.line}`, color: C.ink }}>Settings</button></div>
              </div>
            </Card>
            {/* 2 · Needs you */}
            <Card style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-2 mb-3"><p className="font-semibold">Needs you</p>{specConflicts.length + todo.filter(t => t.tone !== "ok").length === 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>nothing to do</span>}</div>
              {specConflicts.length > 0 && <div className="rounded-xl p-3 mb-2" style={{ background: C.badBg }}>
                <p className="text-sm font-medium mb-1.5" style={{ color: C.bad }}>{specConflicts.length} specification{specConflicts.length === 1 ? "" : "s"} where the sheet disagrees with yours</p>
                <p className="text-xs mb-2" style={{ color: C.muted }}>Your own value is in force until you decide. “Use sheet value” hands that specification over to the sheet from now on; “Keep mine” hides this until the sheet changes the cell.</p>
                {specConflicts.slice(0, specIssuesOpen ? 999 : 8).map((i, ix) => <div key={ix} className="text-sm flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1 min-w-0"><b>{prodName(i.articleId)}</b> <span className="font-mono text-xs" style={{ color: C.muted }}>{i.articleId}</span><span className="block text-xs" style={{ color: C.muted }}>{i.spec}: {i.note}</span></span>{i.specId && i.sheet && <span className="inline-flex gap-1.5"><Primary small onClick={() => resolveConflict(i, "sheet")}>Use sheet value</Primary><button type="button" onClick={() => resolveConflict(i, "mine")} className="text-xs font-semibold px-3 rounded-xl" style={{ height: 30, border: `1px solid ${C.line}`, color: C.ink }}>Keep mine</button></span>}</div>)}
                {specConflicts.length > 8 && <button onClick={() => setSpecIssuesOpen(o => !o)} className="text-xs mt-1" style={{ color: C.accent }}>{specIssuesOpen ? "show fewer" : `show all ${specConflicts.length}`}</button>}
              </div>}
              {todo.map((t, ix) => <div key={ix} className="flex items-center gap-3 py-2 text-sm" style={{ borderTop: ix || specConflicts.length ? `1px solid ${C.line}` : "none" }}><Dot tone={t.tone === "info" ? "muted" : t.tone} /><span className="flex-1">{t.text}</span>{t.action && <Ghost onClick={t.action[1]}>{t.action[0]}</Ghost>}</div>)}
              {it.purpose === "Specs" && specReport && (() => { const ph = (specReport.issues || []).filter(i => i.kind === "placeholder"); const byArt = Object.entries(ph.reduce((m, i) => { (m[i.articleId] = m[i.articleId] || []).push(i.spec); return m; }, {})); return ph.length ? <details className="mt-2"><summary className="text-sm cursor-pointer py-1" style={{ color: C.warn }}>{byArt.length} products still say “fill in min accepted spec” — the commercial team's to-do, not yours</summary><div className="mt-1 max-h-64 overflow-y-auto">{byArt.map(([a, specs]) => <p key={a} className="text-xs py-0.5" style={{ color: C.ink }}>{prodName(a)} <span className="font-mono" style={{ color: C.muted }}>{a}</span> — {specs.join(", ")}</p>)}</div></details> : null; })()}
            </Card>
            {/* 3 · What the apps got from it */}
            {it.purpose === "Specs" && specReport && (() => { const cov = specReport.coverage || {}; const odd = (specReport.issues || []).filter(i => ["unreadable", "approximate", "duplicate"].includes(i.kind)); return <Card style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3 mb-3 flex-wrap"><p className="font-semibold">What the catalog got</p><span className="text-xs" style={{ color: C.muted }}>from the push at {fmtTime(specReport.at)}</span><div className="flex-1" /><Ghost onClick={() => apply()}>Re-apply now</Ghost></div>
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[["Products updated", specReport.updated, C.ink], ["Added to catalog", specReport.created, specReport.created ? C.accent : C.muted], ["Live values active", (s.tempSpecs || []).filter(t => t.origin === "sheet" && !t.endedAt).length + (s.products || []).filter(p => p.liveNote?.origin === "sheet").length, C.ink], ["Not in catalog", (specReport.issues || []).filter(i => i.kind === "unknown").length, C.muted]].map(([l, v, col]) => <div key={l} className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-[11px]" style={{ color: C.muted }}>{l}</p><p className="text-lg font-semibold" style={{ color: col }}>{v}</p></div>)}
              </div>
              <table className="w-full text-xs"><thead><tr className="text-left" style={{ color: C.muted }}>{["Specification", "Filled in", "Still “fill in”", "Empty", "Unreadable"].map(hh => <th key={hh} className="py-1 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{hh}</th>)}</tr></thead>
                <tbody>{Object.entries(SPEC_COLUMNS).map(([k, d]) => { const c = cov[k] || {}; const mapped = it.mappings.some(m => m.target === k); return <tr key={k} style={{ borderBottom: `1px solid ${C.line}`, opacity: mapped ? 1 : .45 }}><td className="py-1 pr-3"><b>{d.name}</b> <span style={{ color: C.muted }}>({d.unit}, per {d.basis === "cu" ? "CU" : "piece"})</span>{!mapped && <span className="ml-1" style={{ color: C.muted }}>not in the sheet</span>}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{c.filled ?? 0}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums", color: c.placeholder ? C.warn : C.muted }}>{c.placeholder ?? 0}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums", color: C.muted }}>{c.empty ?? 0}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums", color: c.unreadable ? C.bad : C.muted }}>{c.unreadable ?? 0}</td></tr>; })}</tbody></table>
              {odd.length > 0 && <details className="mt-2"><summary className="text-xs cursor-pointer" style={{ color: C.muted }}>{odd.length} cells read with doubt (approximate wording, duplicates, unreadable)</summary>{odd.slice(0, 60).map((i, ix) => <p key={ix} className="text-xs ml-3 py-0.5" style={{ color: C.ink }}>{prodName(i.articleId)} <span className="font-mono" style={{ color: C.muted }}>{i.articleId}</span>{i.spec ? ` · ${i.spec}` : ""}: {i.note}</p>)}</details>}
              <label className="text-xs flex items-center gap-1.5 mt-3" style={{ color: C.muted }}><input type="checkbox" checked={it.createMissing === true} onChange={e => patchIt({ createMissing: e.target.checked })} />Also add articles that are not in the catalog yet (no category — you assign it)</label>
            </Card>; })()}
            {it.purpose === "Rejections" && (() => { const rep = it.lastRejectionSync; const d = s.extRejections; const top = d ? Object.entries(d.byArticle).map(([a, g]) => ({ a, ...g })).sort((x, y) => y.c90 - x.c90 || y.count - x.count).slice(0, 8) : []; return rep ? <Card style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3 mb-1 flex-wrap"><p className="font-semibold">What the apps show</p><span className="text-xs" style={{ color: C.muted }}>applied {fmtTime(rep.updatedAt)} · {rep.rows} rows in the sheet{rep.from ? ` · ${rep.from} → ${rep.to}` : ""}</span></div>
              <p className="text-xs mb-3" style={{ color: C.muted }}>The team's official rejections, kept as context next to the article: scan result, pallet sheet, product profile, shift-update cards. QCteam never writes to this sheet.</p>
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>{[["Rejections (last year)", rep.used, C.ink], ["Articles", rep.articles, C.ink], ["Older than a year", rep.old, C.muted], ["Ignored rows", rep.skipped + (rep.undated ? ` (+${rep.undated} undated)` : ""), rep.skipped ? C.warn : C.muted]].map(([l, v, col]) => <div key={l} className="rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="text-[11px]" style={{ color: C.muted }}>{l}</p><p className="text-lg font-semibold" style={{ color: col }}>{v}</p></div>)}</div>
              {top.length > 0 && <table className="w-full text-xs"><thead><tr className="text-left" style={{ color: C.muted }}>{["Most rejected (90 days)", "90 d", "30 d", "Year", "TU", "Last", "Mostly"].map(hh => <th key={hh} className="py-1 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{hh}</th>)}</tr></thead>
                <tbody>{top.map(g => <tr key={g.a} style={{ borderBottom: `1px solid ${C.line}` }}><td className="py-1 pr-3">{productForArticle(s, g.a)?.name || g.name || g.a} <span className="font-mono" style={{ color: C.muted }}>{g.a}</span></td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{g.c90}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{g.c30}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{g.count}</td><td className="py-1 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{g.tu}</td><td className="py-1 pr-3">{fmtRejectionDay(g.last)}</td><td className="py-1 pr-3" style={{ color: C.muted }}>{topCats(g, 1).map(c => c.name).join("")}</td></tr>)}</tbody></table>}
            </Card> : null; })()}
            {(it.purpose === "Dock" || it.purpose === "Blocked") && it.header.length > 0 && (() => { const sm = extractSummary(it.rawHeader || it.header, it.rawRows || it.sample); return <Card style={{ marginBottom: 16 }}>
              <div className="flex items-center gap-3 mb-2 flex-wrap"><p className="font-semibold">What the apps show</p><span className="text-xs" style={{ color: C.muted }}>{(it.rows || []).length} {it.purpose === "Dock" ? "pallets on the dock" : "blocked pallets"}{bad ? ` · ${bad} rows skipped` : ""}</span></div>
              {Object.keys(sm).length > 0 && <div className="flex flex-wrap gap-2">{Object.entries(sm).map(([k, v]) => <span key={k} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span> <b>{v}</b></span>)}</div>}
            </Card>; })()}
            {/* 4 · Settings — the plumbing, folded */}
            <Card>
              <p className="font-semibold mb-3">Settings</p>
              {it.purpose === "Dock" && settingsRow("dock", "Rejection window", `${settingsOf(s).rejectionWindowHours} h after arrival`, <>
                <p className="text-xs mb-2" style={{ color: C.muted }}>A pallet can only be rejected within a fixed window after arrival. As it closes, the pallet shows up as a countdown tile on every dashboard until it is inspected — earlier for products rejected in the last {settingsOf(s).riskyLookbackDays} days.</p>
                <div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  {[["rejectionWindowHours", "Reject within (hours of arrival)"], ["deadlineWarnHours", "Warn — hours before the window closes"], ["deadlineWarnHoursRisky", "Warn earlier for recently-rejected products (hours before)"], ["riskyLookbackDays", "“Recently rejected” = within (days)"]].map(([k, l]) => <label key={k} className="text-xs" style={{ color: C.muted }}>{l}<input type="number" min={0} value={settingsOf(s)[k]} onChange={e => set(x => ({ ...x, settings: { ...settingsOf(x), [k]: Math.max(0, Number(e.target.value) || 0) } }))} className="w-full text-sm mt-1" /></label>)}
                </div>
                {(() => { const al = computeDeadlineAlerts(s); return <p className="text-xs mt-2" style={{ color: al.length ? C.bad : C.muted }}>{al.length ? `${al.length} pallet${al.length === 1 ? "" : "s"} currently within the warning window.` : "Nothing within the warning window right now."}</p>; })()}
                <label className="flex items-start gap-2 text-xs mt-3 cursor-pointer" style={{ color: C.ink }}><input type="checkbox" className="mt-0.5" checked={!!settingsOf(s).requirePoOnReject} onChange={e => set(x => ({ ...x, settings: { ...settingsOf(x), requirePoOnReject: e.target.checked } }))} /><span>Require a PO on rejection<span className="block" style={{ color: C.muted }}>Pull PO ID from this sheet when the pallet is on it. If the inspection is not from the sheet, the controller must type it.</span></span></label>
              </>)}
              {settingsRow("mapping", "Column mapping", it.header.length ? `${it.mappings.filter(m => m.target !== "ignore").length} of ${it.header.length} columns used · suggested automatically` : "no columns yet", <>
                {!it.header.length ? <p className="text-xs" style={{ color: C.muted }}>Columns appear after the first push (or after pasting rows below).</p> : <>
                  <p className="text-xs mb-3" style={{ color: C.muted }}>Suggested from the column names and re-checked on every push; you only need this when a column was matched wrongly. Transforms handle codes like <span className="font-mono">HE11413643-16</span> (article + CU per TU in one cell). <button onClick={resuggest} className="underline" style={{ color: C.accent }}>Re-suggest</button></p>
                  <table className="w-full text-sm"><thead><tr className="text-xs" style={{ color: C.muted }}><th className="text-left font-medium pb-2">Sheet column</th><th className="text-left font-medium pb-2">Sample</th><th className="text-left font-medium pb-2">→ QCteam field</th><th className="text-left font-medium pb-2">Transform</th></tr></thead><tbody>
                    {it.mappings.map((m, i) => { const idx = it.header.indexOf(m.source); const sample = it.sample[0]?.[idx]; return <tr key={m.source} style={{ borderTop: `1px solid ${C.line}`, opacity: m.target === "ignore" ? .55 : 1 }}><td className="py-1.5 font-mono text-xs">{m.source}</td><td className="py-1.5 text-xs truncate" style={{ maxWidth: 160, color: C.muted }}>{String(sample ?? "")}</td><td className="py-1.5"><select value={m.target} onChange={e => patchIt({ mappings: it.mappings.map((x, j) => j === i ? { ...x, target: e.target.value, transform: suggestTransform(e.target.value, sample), required: !!targets.find(t => t[0] === e.target.value)?.[2] } : x) })} className="text-xs" style={{ minHeight: 28 }}>{targets.map(t => <option key={t[0]} value={t[0]}>{t[1]}{t[2] ? " *" : ""}</option>)}</select></td><td className="py-1.5"><select value={m.transform} onChange={e => patchIt({ mappings: it.mappings.map((x, j) => j === i ? { ...x, transform: e.target.value } : x) })} disabled={m.target === "ignore"} className="text-xs" style={{ minHeight: 28 }}>{TRANSFORMS.map(t => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select></td></tr>; })}
                  </tbody></table>
                  {missingRequired.length > 0 && <Note tone="bad">Required fields not mapped: {missingRequired.map(t => t[1]).join(", ")}.</Note>}
                  {(() => { const pm = it.mappings.find(m => m.target === "priority"); const idx = pm ? it.header.indexOf(pm.source) : -1; const vals = idx >= 0 ? it.sample.slice(0, 20).map(r => String(r[idx] || "").trim()).filter(Boolean) : []; return vals.length && vals.every(v => /^\d+$/.test(v)) ? <Note tone="warn">“Priority item” seems mapped to a numeric column ({pm.source}). Pick the column with labels like “High risk”, “Late inspection”.</Note> : null; })()}
                  {it.needsRemap && <div className="mt-2"><Primary small onClick={() => { patchIt({ needsRemap: false }); fetchLive(it); }}>Mapping is right — apply the new pushes</Primary></div>}
                </>}
              </>)}
              {settingsRow("source", "How the sheet sends its data", it.pushMode ? "script in the sheet (recommended)" : it.sourceUrl ? "pulled from a link" : "not set up", <>
                <div className="flex items-center gap-2 mb-3"><span className="text-xs" style={{ color: C.muted }}>Name</span><input value={it.name} onChange={e => patchIt({ name: e.target.value })} className="text-sm flex-1" /><span className="text-[11px] px-2 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>{it.purpose}</span></div>
                <div className="flex gap-1.5 mb-3">{[[true, "Script in the sheet pushes (recommended)"], [false, "Portal pulls from a published link"]].map(([m, l]) => <button key={String(m)} onClick={() => patchIt({ pushMode: m })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: !!it.pushMode === m ? C.ink : "transparent", color: !!it.pushMode === m ? C.onDark : C.ink, border: `1px solid ${!!it.pushMode === m ? C.ink : C.line}` }}>{l}</button>)}</div>
                {it.pushMode ? <>
                  <p className="text-xs mb-2" style={{ color: C.muted }}>In the Google Sheet: Extensions → Apps Script → paste the script below → run it once (accept the permissions) → Triggers → time-driven → every 5–15 minutes. Works even when the organisation blocks public Apps Script pages. {window.__qcServer ? "The server address is already filled in." : "Replace YOUR-SERVER with the prototype's public address."}</p>
                  <pre className="text-[11px] rounded-lg p-2 mb-2 overflow-x-auto" style={{ background: C.bg }}>{pushScript(it.purpose)}</pre>
                  {it.liveStatus && !/^OK/.test(it.liveStatus) && <p className="text-xs" style={{ color: C.warn }}>{it.liveStatus}</p>}
                </> : <>
                  <p className="text-xs mb-1.5" style={{ color: C.muted }}>In Google Sheets: File → Share → Publish to web → the tab → CSV → paste the link here. Only works where the browser can reach Google (not from the sandbox).</p>
                  <div className="flex gap-1.5 mb-1"><input value={it.sourceUrl} onChange={e => patchIt({ sourceUrl: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv" className="flex-1 text-sm font-mono" /><Ghost onClick={() => fetchLive(it)}>Fetch now</Ghost><label className="text-xs flex items-center gap-1" style={{ color: C.muted }}><input type="checkbox" checked={!!it.autoRefresh} onChange={e => patchIt({ autoRefresh: e.target.checked })} />every 60 s</label></div>
                  {it.liveStatus && <p className="text-xs" style={{ color: it.liveStatus.startsWith("OK") ? C.ok : C.warn }}>{it.liveStatus}</p>}
                </>}
              </>)}
              {settingsRow("paste", "Test with pasted rows", "for trying a sheet before its script runs", <>
                <p className="text-xs mb-2" style={{ color: C.muted }}>Paste the header row plus some rows straight from Google Sheets (tab-separated). The columns are mapped like a real push; “Apply” writes them to the apps the same way the server does.</p>
                <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={4} placeholder={"PO ID\\tArrival date\\tArrival time\\tTransporter\\tNeeded today\\t…"} className="w-full text-xs font-mono mb-2" />
                <div className="flex items-center gap-3 mb-3"><Ghost onClick={loadPaste}>Read columns</Ghost>{it.header.length > 0 && <span className="text-xs" style={{ color: C.muted }}>{it.header.length} columns · {it.sample.length} rows{it.lastSyncAt ? ` · applied ${fmtTime(it.lastSyncAt)}` : ""}{it.lastResult ? ` · ${it.lastResult}` : ""}</span>}</div>
                {it.header.length > 0 && <>
                  <div className="flex items-center gap-3 mb-2"><p className="text-sm font-medium">Preview</p><span className="text-xs" style={{ color: bad ? C.warn : C.muted }}>{preview.length} rows · {bad} with errors{bad ? " (skipped on apply)" : ""}{it.purpose === "Dock" && duplicateHuCount(preview.filter(r => !r._errors.length)) > 0 ? ` · ${duplicateHuCount(preview.filter(r => !r._errors.length))} duplicate HU row(s) — merged, one pallet each` : ""}</span><div className="flex-1" /><Primary small onClick={() => apply()} disabled={missingRequired.length > 0 || preview.length === 0 || (it.purpose === "Rejections" && !(pasteFull.current && pasteFull.current.header.join("|") === it.header.join("|")))} title={it.purpose === "Rejections" && !pasteFull.current ? "Pushed data is applied on the server on every push — paste the full sheet here to apply it by hand." : undefined}>{it.purpose === "Dock" ? "Apply as live dock data" : it.purpose === "Blocked" ? "Apply as live blocked pallets" : it.purpose === "Specs" ? "Apply specs to the catalog" : it.purpose === "Rejections" ? "Apply as rejection history" : "Create / update products"}</Primary></div>
                  <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${C.line}`, maxHeight: 320 }}>
                    <table className="text-xs" style={{ minWidth: 700 }}><thead><tr style={{ background: C.bg }}>{targets.filter(t => t[0] !== "ignore" && it.mappings.some(m => m.target === t[0])).map(t => <th key={t[0]} className="text-left font-medium px-2 py-1.5 whitespace-nowrap" style={{ color: C.muted }}>{t[1]}</th>)}<th className="px-2 py-1.5 text-left font-medium" style={{ color: C.muted }}>Issues</th></tr></thead><tbody>
                      {preview.slice(0, 60).map((r, i) => <tr key={i} style={{ borderTop: `1px solid ${C.line}`, background: r._errors.length ? C.badBg : "transparent" }}>{targets.filter(t => t[0] !== "ignore" && it.mappings.some(m => m.target === t[0])).map(t => <td key={t[0]} className="px-2 py-1 whitespace-nowrap font-mono">{typeof r[t[0]] === "boolean" ? (r[t[0]] ? "yes" : "no") : String(r[t[0]] ?? "")}</td>)}<td className="px-2 py-1" style={{ color: C.bad }}>{r._errors.join("; ")}</td></tr>)}
                    </tbody></table>
                  </div>
                </>}
              </>)}
              <div className="flex justify-end mt-3"><button onClick={() => { if (!confirm(`Remove “${it.name}”? The apps keep what was already applied; nothing is deleted from the sheet.`)) return; set(x => ({ ...x, integrations: x.integrations.filter(i => i.id !== it.id) })); setSel(null); }} className="text-xs" style={{ color: C.muted }}>Remove this sheet</button></div>
            </Card>
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
const pickFiles = () => new Promise(res => { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.accept = "image/*,.pdf,.csv,.xlsx,.txt,.json"; mountPicker(i); i.onchange = async () => { const out = []; for (const f of Array.from(i.files || [])) { if (f.type.startsWith("image/")) { const d = await keepPhoto(f); if (d) { out.push({ id: uid(), kind: "image", name: f.name, dataUrl: d, size: f.size }); continue; } } if (f.size > 2.5 * 1024 * 1024) { out.push({ id: uid(), kind: "file", name: f.name, size: f.size, tooBig: true }); continue; } const d = await readAsDataUrl(f); out.push({ id: uid(), kind: "file", name: f.name, size: f.size, dataUrl: d, mime: f.type }); } unmountPicker(i); res(out); }; i.click(); });
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
    {view && <div className="fixed inset-0 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.85)", zIndex: 80 }} onClick={() => setView(null)}><img src={view.path || view.dataUrl} alt="" className="max-w-full max-h-full rounded-xl" /></div>}
  </div>;
}
// Composer add-ons: pending attachments + context picker (products, recent inspections, pallets on dock, open flags)
// `bar`: the input row (textarea + send). When given, the attach / context actions become round icon buttons sitting
// inline to the left of it — the chat composer look; without it the old labelled buttons render above whatever follows.
function ComposerExtras({ s, user, pending, setPending, compact, bar }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [tab, setTab] = useState("product");
  const qq = q.trim().toLowerCase();
  const has = ctx => (pending.contexts || []).some(c => c.kind === ctx.kind && c.id === ctx.id);
  const add = ctx => { setPending(p => { const cur = p.contexts || []; const exists = cur.some(c => c.kind === ctx.kind && c.id === ctx.id); return { ...p, contexts: exists ? cur.filter(c => !(c.kind === ctx.kind && c.id === ctx.id)) : [...cur, ctx] }; }); };
  const [busy, setBusy] = useState(false);
  const addFiles = async () => { setBusy(true); try { const got = await pickFiles(); if (got.length) setPending(p => ({ ...p, attachments: [...(p.attachments || []), ...got] })); } finally { setBusy(false); } };
  const products = s.products.filter(p => p.isActive !== false && (!qq || (p.name + " " + (p.articleId || "")).toLowerCase().includes(qq))).slice(0, 8);
  const inspections = s.inspections.filter(i => i.status !== "Cancelled").sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || "")).filter(i => { const p = s.products.find(x => x.id === i.productId); return !qq || matchesInspSearch(i, p, q) || (i.pallets || []).some(h => String(h).includes(qq)); }).slice(0, 8);
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
      {!bar && <div className="flex gap-1.5 mb-1.5">
        <button onClick={addFiles} disabled={busy} className="text-[11px] px-2 py-1 rounded-lg inline-flex items-center" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }} title="MessageAttachment"><Ic i={Paperclip} s={12} mr={4} />{busy ? "Processing…" : "Attach"}</button>
        <button onClick={() => setOpen(o => !o)} className="text-[11px] px-2 py-1 rounded-lg inline-flex items-center" style={{ background: open ? C.ink : C.bg, border: `1px solid ${open ? C.ink : C.line}`, color: open ? C.onDark : C.ink }} title="MessageContext — link a product, inspection, pallet or flag"><Ic i={Tag} s={12} mr={4} />Add context</button>
      </div>}
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
      {bar && <div className="flex items-end gap-1.5">
        <button onClick={addFiles} disabled={busy} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.bg, color: busy ? C.muted : C.ink, border: `1px solid ${C.line}` }} title="Attach a photo or file"><Ic i={Paperclip} s={16} mr={0} /></button>
        <button onClick={() => setOpen(o => !o)} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 relative" style={{ background: open ? C.ink : C.bg, color: open ? C.onDark : C.ink, border: `1px solid ${open ? C.ink : C.line}` }} title="Link a product, inspection, pallet or flag"><Ic i={Tag} s={16} mr={0} />{(pending.contexts || []).length > 0 && <span className="absolute -top-1 -right-1 text-[9px] font-semibold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center" style={{ background: C.accent, color: C.onDark }}>{pending.contexts.length}</span>}</button>
        {bar}
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
function QueueRow({ s, set, user, b, onOpen, tile }) {
  const c = b.claim; const me = c && c.userId === user.id; const who = c && s.users.find(u => u.id === c.userId);
  const done = b.status === "Completed"; const stacked = c?.status === "stacked"; const lost = b.lost; const lostBy = lost && s.users.find(u => u.id === lost.byUserId);
  const col = done ? C.ok : lost ? C.line : stacked ? C.muted : b.status === "Started" ? C.warn : C.bad;
  const take = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "taken" });
  const stack = () => setClaim(set, b, { userId: user.id, at: nowISO(), status: "stacked" });
  const release = () => setClaim(set, b, null);
  const ago = t => { const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min` : `${Math.round(m / 60)} h`; };
  return (
    <div className={tile ? "qc-tile rounded-xl px-3 py-2.5" : "py-2.5"} style={tile ? { background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}`, opacity: done ? .5 : lost ? .45 : stacked ? .7 : 1 } : { borderBottom: `1px solid ${C.line}`, opacity: done ? .5 : lost ? .45 : stacked ? .7 : 1 }}>
      <div className="flex items-center gap-2">
        {!tile && <span className="inline-block rounded-full flex-shrink-0" style={{ width: 8, height: 8, background: col }} />}
        <button onClick={onOpen} className="text-sm flex-1 truncate font-medium text-left">{b.name || b.article}</button>
        {who && <span className="flex items-center gap-1 text-[11px]" style={{ color: me ? C.accent : C.muted }}><Avatar user={who} size={18} />{me ? "you" : who.name.split(" ")[0]} · {ago(c.at)}</span>}
        {stacked && !lost && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center" style={{ background: C.line, color: C.muted }}><Ic i={Layers} s={10} mr={3} />in stack</span>}
        {lost && <span className="text-[10px] px-1.5 py-0.5 rounded inline-flex items-center" style={{ background: C.line, color: C.muted }}><Ic i={Search} s={10} mr={3} />lost · {lostBy ? lostBy.name.split(" ")[0] : "?"} · {ago(lost.at)}</span>}
      </div>
      <p className={tile ? "text-xs mt-0.5" : "text-xs mt-0.5 ml-4"} style={{ color: C.muted }}>{[b.location && `Dock ${b.location}`, b.deadline && `departure ${b.deadline}`, b.hu && `HU …${b.hu.slice(-6)}`].filter(Boolean).join(" · ")}</p>
      {lost && !done && <div className={tile ? "flex gap-1.5 mt-2 flex-wrap" : "flex gap-1.5 mt-1.5 ml-4"}><button onClick={() => markFound(set, b, user)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Found — back in queue</button>{lost.note && <span className="text-[11px] self-center" style={{ color: C.muted }}>{lost.note}</span>}</div>}
      {!done && !lost && <div className={tile ? "flex gap-1.5 mt-2 flex-wrap" : "flex gap-1.5 mt-1.5 ml-4"}>
        {!c && <><button onClick={take} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Take</button><button onClick={stack} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={12} />In stack</button></>}
        {c && me && <>{stacked ? <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Reachable now — take</button> : <button onClick={stack} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={12} />In stack</button>}<button onClick={release} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Release</button></>}
        {c && !me && <>{stacked ? <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Reachable now — take</button> : <button onClick={take} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.warn, border: `1px solid ${C.line}` }}>Take over</button>}</>}
      </div>}
    </div>
  );
}

// ═══════════════════ UI: prymitywy ═══════════════════
function Card({ children, style }) { return <section className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: lift(), ...style }}>{children}</section>; }
function Primary({ children, onClick, disabled, small }) { return <button onClick={onClick} disabled={disabled} className={`qc-elev qc-tile ${small ? "text-xs px-3" : "text-sm px-4"} font-semibold rounded-xl inline-flex items-center justify-center`} style={{ height: small ? 30 : 38, background: disabled ? C.line : C.accent, color: disabled ? C.muted : C.onDark, boxShadow: disabled ? "none" : lift() }}>{children}</button>; }
function Ghost({ children, onClick }) { return <button onClick={onClick} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 30, background: C.accentSoft, color: C.accent }}>{children}</button>; }
function Empty({ icon, title, hint, action }) {
  return (
    <div className="text-center py-10 px-4">
      <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.muted }}>{EMPTY_ICON[icon] ? <Ic i={EMPTY_ICON[icon]} s={22} mr={0} /> : typeof icon === "string" ? <span className="text-2xl">{icon}</span> : icon ? <Ic i={icon} s={22} mr={0} /> : null}</div>
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: C.muted }}>{hint}</p>
      {action}
    </div>
  );
}
function Note({ tone: t = "info", children }) {
  const [fg, bg] = t === "warn" ? [C.warn, C.warnBg] : t === "ok" ? [C.ok, C.okBg] : t === "bad" ? [C.bad, C.badBg] : [C.accent, C.accentSoft];
  return <div className="qc-tile rounded-xl px-3.5 py-2.5 text-sm mb-3" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}`, borderLeft: `3px solid ${fg}` }}>{children}</div>;
}

// A dropdown with a search box for lists that can grow without limit (categories, products, problem catalog).
// `options`: [{ value, label }]; `empty` is the blank option's label; `onChange` gets the value ("" = cleared).
// searchFrom: the search box appears once the list has at least this many options (0 = always).
function SearchSelect({ value, onChange, options, empty = "—", placeholder = "Search…", className = "", style = {}, size = "sm", searchFrom = 0 }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const ref = useRef(null);
  useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }; document.addEventListener("mousedown", h); return () => document.removeEventListener("mousedown", h); }, [open]);
  const chosen = options.find(o => o.value === value); const qq = q.trim().toLowerCase();
  const searchable = options.length >= searchFrom;
  const shown = qq ? options.filter(o => o.label.toLowerCase().includes(qq)) : options;
  const h = size === "xs" ? 26 : 32;
  return (
    <div ref={ref} className={`relative ${className}`} style={style}>
      <button type="button" onClick={() => { setOpen(o => !o); setQ(""); }} className="w-full text-left flex items-center gap-1 rounded-md px-2 outline-none" style={{ ...inp, height: h, fontSize: size === "xs" ? 12 : 13 }}><span className="flex-1 truncate" style={{ color: chosen ? C.ink : C.muted }}>{chosen ? chosen.label : empty}</span><Ic i={ChevronDown} s={12} mr={0} style={{ color: C.muted }} /></button>
      {open && <div className="absolute left-0 right-0 mt-1 rounded-xl p-1.5" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 10px 28px rgba(0,0,0,.28)", zIndex: 80, minWidth: 220 }}>
        {searchable && <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className="w-full text-xs rounded-lg px-2 py-1.5 outline-none mb-1" style={{ ...inp }} />}
        <div style={{ maxHeight: 280, overflowY: "auto" }}>
          {!qq && <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="w-full text-left text-xs px-2 py-1.5 rounded-md" style={{ color: C.muted }}>{empty}</button>}
          {shown.map(o => <button type="button" key={o.value} onClick={() => { onChange(o.value); setOpen(false); }} className="w-full text-left text-xs px-2 py-1.5 rounded-md truncate" style={{ background: o.value === value ? C.accentSoft : "transparent", color: o.value === value ? C.accent : o.tone || C.ink }}>{o.label}</button>)}
          {shown.length === 0 && <p className="text-xs px-2 py-2" style={{ color: C.muted }}>Nothing matches.</p>}
        </div>
      </div>}
    </div>
  );
}
// ═══════════════════ SHELL: top bar + sidebar ═══════════════════
const NAV_HEAD = [
  { group: null, items: [["dashboard", "🏠", "Dashboard"], ["docks", "🏭", "Dock map"], ["inspections", "📋", "Inspections"], ["complaints", "👎", "Complaints"], ["blocked", "🔒", "Blocked pallets"], ["lost", "🔍", "Lost pallets"], ["unreported", "🛡️", "Unreported pallets"], ["analytics", "📊", "Analytics"], ["flags", "🚩", "Flags"], ["notifications", "🔔", "Notifications"]] },
  { group: "Catalog", items: [["categories", "📁", "Categories"], ["problems", "🌳", "Problem types"], ["products", "📦", "Products"], ["tempspecs", "⏱️", "Temporary specs"], ["forms", "🧩", "Forms"]] },
  { group: "Dictionaries", items: [["suppliers", "🚚", "Suppliers"], ["lists", "📋", "Lists"]] },
  { group: "Communication", items: [["announcements", "📣", "Announcements"], ["messages", "💬", "Messages"]] },
  { group: "Administration", items: [["integrations", "🔗", "Sheets"], ["settings", "⚙️", "Settings"], ["users", "👤", "Users"]] },
];
const NAV_CONTROLLER = [
  { group: null, items: [["dashboard", "🏠", "Dashboard"], ["docks", "🏭", "Dock map"], ["catalog", "📦", "Products"], ["briefing", "📖", "Shift update"], ["inspections", "📋", "History"]] },
  { group: "Queues", items: [["unreported", "🛡️", "Unreported pallets"], ["lost", "🔍", "Lost pallets"], ["complaints", "👎", "Complaints"]] },
  { group: "Communication", items: [["announcements", "📣", "Announcements"], ["messages", "💬", "Messages"], ["flags", "🚩", "My flags"], ["notifications", "🔔", "Notifications"]] },
  { group: "Me", items: [["profile", "👤", "Profile"]] },
];

function Shell({ page, setPage, children, badge, topRight, users, user, setUser, onLogout, unread, onBell, onSearch }) {
  const [topQ, setTopQ] = useState("");
  const NAV = user.role === "Head" ? NAV_HEAD : NAV_CONTROLLER;
  // The menu is a rail of icons until someone opens it — a fixed 224px column on every page was eating the width the forms need.
  const [navOpen, setNavOpen] = useState(() => { try { return localStorage.getItem("qcteam-nav-open") !== "0"; } catch { return true; } });
  const toggleNav = () => setNavOpen(v => { const n = !v; try { localStorage.setItem("qcteam-nav-open", n ? "1" : "0"); } catch {} return n; });
  return (
    <div className="qc min-h-screen" style={{ background: C.bg, color: C.ink }}>
      <style>{GLOBAL_CSS()}</style>
      <div className="flex items-center gap-4 px-5 sticky top-0" style={{ height: 56, background: C.surface, borderBottom: `1px solid ${C.line}`, zIndex: 20 }}>
        <button onClick={toggleNav} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: C.ink }} title={navOpen ? "Collapse menu" : "Expand menu"} aria-label={navOpen ? "Collapse menu" : "Expand menu"}><Ic i={MenuIcon} s={18} mr={0} /></button>
        <div className="flex items-center gap-2.5"><span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold" style={{ background: C.accent, color: C.onDark }}>Q</span><span className="font-semibold text-[15px] tracking-tight">QCteam</span><span className="text-[11px] px-1.5 py-0.5 rounded-md" style={{ background: C.accentSoft, color: C.accent }}>{user.role}</span></div>
<SearchBox value={topQ} onChange={setTopQ} placeholder="Search products, inspections…" className="hidden md:block" style={{ width: 320 }} inputClass="rounded-xl" onKeyDown={e => { if (e.key === "Enter" && topQ.trim()) { onSearch && onSearch(topQ.trim()); } }} />
        <div className="flex-1" />
        {topRight}
        <button onClick={onBell} className="relative text-lg" title="notifications"><Ic i={Bell} s={18} mr={0} />{unread > 0 && <span className="absolute -top-1 -right-2 text-[10px] px-1.5 rounded-full" style={{ background: C.bad, color: C.onDark }}>{unread}</span>}</button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium" style={{ background: C.accentSoft, color: C.accent }}>{user.name.split(" ").map(x => x[0]).join("").slice(0, 2)}</div>
          <span className="text-sm font-medium hidden sm:inline">{user.name} · {user.role}</span><button onClick={onLogout} className="text-xs px-2 py-1 rounded-lg" style={{ color: C.muted, border: `1px solid ${C.line}` }}>Log out</button>
        </div>
      </div>
      <div className="flex">
        <aside className="flex-shrink-0 py-3 sticky self-start" style={{ width: navOpen ? 224 : 64, borderRight: `1px solid ${C.line}`, height: "calc(100vh - 56px)", overflowY: "auto", background: C.surface, top: 56, paddingLeft: navOpen ? 12 : 8, paddingRight: navOpen ? 12 : 8, transition: "width .15s ease", zIndex: 10 }}>
          {NAV.map((g, gi) => (
            <div key={gi} className="mb-3">
              {g.group && navOpen && <p className="label-sm px-3 mb-1.5">{g.group}</p>}
              {g.group && !navOpen && gi > 0 && <div className="mx-2 mb-2" style={{ borderTop: `1px solid ${C.line}` }} />}
              {g.items.map(([key, icon, label]) => {
                const on = page === key;
                return (
                  <button key={key} onClick={() => setPage(key)} title={label} className="w-full flex items-center gap-2.5 rounded-xl text-[13.5px] text-left mb-0.5 relative" style={{ height: 38, paddingLeft: navOpen ? 12 : 0, paddingRight: navOpen ? 12 : 0, justifyContent: navOpen ? "flex-start" : "center", background: on ? C.accentSoft : "transparent", color: on ? C.accent : C.ink, fontWeight: on ? 600 : 450 }}>
                    <span className="w-6 flex justify-center flex-shrink-0" style={{ opacity: on ? 1 : .85 }}>{NAV_ICON[key] ? <Ic i={NAV_ICON[key]} s={17} mr={0} /> : icon}</span>
                    {navOpen && <span className="flex-1 truncate">{label}</span>}
                    {badge?.[key] > 0 && (navOpen
                      ? <span className="text-[10.5px] font-semibold min-w-[20px] text-center px-1.5 py-0.5 rounded-full" style={{ background: on ? C.accent : C.warnBg, color: on ? C.onDark : C.warn }}>{badge[key]}</span>
                      : <span className="absolute top-1 right-1.5 w-2 h-2 rounded-full" style={{ background: C.warn }} title={String(badge[key])} />)}
                  </button>
                );
              })}
            </div>
          ))}
        </aside>
        <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

// ═══════════════════ PAGE: Complaints ═══════════════════
// Customer freshness complaints per article, keyed in by the Head (typed or pasted from the BI table) and shown to
// everyone: on this page, on the phones (Menu → Complaints) and as a line on every product profile. Article IDs are
// matched loosely — "HE10573488-36" (dock sheet), "10573488" (complaints table) and the catalog's article ID all normalise
// to the same key, so one entry lights up wherever that product appears.
// (normArticle lives in shared/complaints.js now — same rule, one copy.)
// Complaints are kept as dated snapshots (shared/complaints.js). Everything that only wants "the current numbers" —
// chips, product notes, the phone, Complaints vs QC — reads the latest snapshot through this in the old one-list shape.
const complaintSnapshots = s => Array.isArray(s.complaintSnapshots) ? s.complaintSnapshots : [];
const complaintsMeta = s => { const snaps = complaintSnapshots(s); return snaps.length ? asLegacyMeta(latestSnapshot(snaps), snaps) : (s.complaints || { period: "", updatedAt: null, byUserId: null, rows: [] }); };
const complaintsFor = (s, articleId) => { const k = normArticle(articleId); if (!k) return null; return complaintsMeta(s).rows.find(r => normArticle(r.articleId) === k) || null; };
const productForArticle = (s, articleId) => { const k = normArticle(articleId); return k ? s.products.find(p => normArticle(p.articleId) === k) || null : null; };
// Parses rows pasted from a spreadsheet: tab / semicolon / comma separated, optional header, optional leading row number.
// Expects: article id · article name · complaints count · top sub-type ("Spoiled (36)" or plain text).
// parseComplaintRows lives in shared/complaints.js (tested there).
// Save one post (a snapshot). Same week + same "as of" day replaces (a correction); otherwise it is added. The latest
// snapshot is also written through to `complaints`, so phones on an older build keep showing the current numbers.
// A change in the CURRENT numbers tells the whole team; editing an older post stays quiet.
const withComplaintsThrough = (x, snaps) => ({ ...x, complaintSnapshots: snaps, complaints: asLegacyMeta(latestSnapshot(snaps), snaps) });
const saveSnapshot = (set, user, snap) => set(x => {
  const before = complaintsMeta(x); const snaps = upsertSnapshot(complaintSnapshots(x), { ...snap, importedAt: nowISO(), byUserId: user.id });
  let out = withComplaintsThrough(x, snaps); const after = complaintsMeta(out);
  if (after.snapshotId === snap.id || latestSnapshot(snaps)?.id === snap.id) {
    const changed = after.rows.filter(r => { const o = before.rows.find(b => normArticle(b.articleId) === normArticle(r.articleId)); return !o || o.count !== r.count || (o.subType || "") !== (r.subType || ""); });
    const removed = before.rows.filter(b => !after.rows.some(r => normArticle(r.articleId) === normArticle(b.articleId))).length;
    const msg = changed.length ? `${user.name} updated complaints (${after.period}): ${changed.slice(0, 3).map(r => `${r.name || r.articleId} ${r.count}`).join(", ")}${changed.length > 3 ? ` +${changed.length - 3} more` : ""}` : removed ? `${user.name} removed ${removed} article${removed === 1 ? "" : "s"} from the complaints list` : null;
    if (msg) out = { ...out, notifications: [...(out.notifications || []), ...x.users.filter(u => u.active !== false && u.id !== user.id).map(u => ({ id: uid(), userId: u.id, type: "Complaints", message: msg, entityType: "Complaints", entityId: null, createdAt: nowISO(), readAt: null }))] };
  }
  return out; });
const deleteSnapshot = (set, user, id) => set(x => { const snaps = complaintSnapshots(x).filter(z => z.id !== id); const out = withComplaintsThrough(x, snaps); if (!snaps.length) { const b = complaintsMeta(x); if (b.rows.length) out.notifications = [...(out.notifications || []), ...x.users.filter(u => u.active !== false && u.id !== user.id).map(u => ({ id: uid(), userId: u.id, type: "Complaints", message: `${user.name} cleared the complaints list`, entityType: "Complaints", entityId: null, createdAt: nowISO(), readAt: null }))]; } return out; });
// "New" complaints for the sidebar badge = rows changed since this user last opened the page on this device.
const complaintsSeenKey = userId => `qcteam-complaints-seen-${userId}`;
const complaintsNewCount = (s, userId) => { const meta = complaintsMeta(s); if (!meta.rows.length) return 0; let seen = ""; try { seen = localStorage.getItem(complaintsSeenKey(userId)) || ""; } catch {} return meta.rows.filter(r => (r.updatedAt || meta.updatedAt || "") > seen).length; };
const markComplaintsSeen = userId => { try { localStorage.setItem(complaintsSeenKey(userId), nowISO()); } catch {} };
// Small "N complaints" chip for pallet / product rows.
const ComplaintChip = ({ s, articleId, size = "xs" }) => { const c = complaintsFor(s, articleId); if (!c || !c.count) return null; return <span className={`${size === "xs" ? "text-[10px]" : "text-[11px]"} px-1.5 py-0.5 rounded-full inline-flex items-center gap-1 flex-shrink-0 whitespace-nowrap`} style={{ background: C.badBg, color: C.bad }} title={`${c.count} freshness complaints${c.subType ? ` · mostly ${c.subType}` : ""}`}><Ic i={ThumbsDown} s={10} mr={0} />{c.count}</span>; };
// One-line summary used on product profiles (portal + phone share the wording).
const complaintsLine = (s, articleId) => { const c = complaintsFor(s, articleId); if (!c || !c.count) return null; const meta = complaintsMeta(s); return { count: c.count, sub: c.subType ? `${c.subType}${c.subCount != null ? ` (${c.subCount})` : ""}` : "", rate: fmtPer1k(c.per1k), delivered: c.delivered ?? null, period: meta.period || "" }; };
// What the DC5 rejections sheet says about this article: the team's official rejections (Slack → sheet), not QCteam reports.
function LiveNote({ product }) {
  const n = liveNoteOf(product); if (!n) return null;
  return <Note tone="warn"><span className="inline-flex items-center gap-1.5 flex-wrap"><Ic i={AlertTriangle} s={14} mr={0} /><b>Live spec</b><span>{n.text}</span>{n.until && <span style={{ color: C.muted }}>· until {fmtUntil(n.until)}</span>}<span style={{ color: C.muted }}>· from the specs sheet</span></span></Note>;
}
function RejectionLink({ href, label }) {
  const Icon = /^Inspection report/i.test(label) ? FileText : /slack\.com/i.test(href) ? MessageSquare : /drive\.google|docs\.google/i.test(href) ? Paperclip : ExternalLink;
  return (
    <a href={href} target="_blank" rel="noopener" className="qc-elev qc-tile inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2.5 no-underline" style={{ height: 28, background: C.ink, color: C.onDark }}>
      <Ic i={Icon} s={12} mr={0} />{label}
    </a>
  );
}
function ExtRejectionsNote({ s, articleId }) {
  const l = extRejectionLine(s, articleId); if (!l) return null;
  const [open, setOpen] = useState(false);
  const rows = extRejectionsAll(s, articleId);
  return <Note tone="bad"><span className="inline-flex items-center gap-1.5 flex-wrap"><Ic i={AlertTriangle} s={14} mr={0} /><b>Rejected on the dock {l.count}×</b><span>in {l.span}</span><span style={{ color: C.muted }}>· last {fmtRejectionDay(l.last)} · DC5 rejections sheet</span><button onClick={() => setOpen(v => !v)} className="underline text-xs" style={{ color: C.accent }}>{open ? "hide" : rows.length > 3 ? `all ${l.total}` : "recent rows"}</button></span>
    {open && <div className="mt-2 flex flex-col gap-2" style={{ color: C.ink }}>{(rows.length ? rows : l.recent).map((r, ix) => {
      const reason = String(r.reason || "Rejected").replace(/^./, c => c.toUpperCase());
      const reports = reportUrls(r);
      return <div key={ix} className="rounded-xl px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${C.bad}` }}>
        <p className="text-sm font-semibold leading-snug">{reason}</p>
        <p className="text-xs mt-0.5" style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{fmtRejectionDay(r.d)}{r.tu != null ? ` · ${r.tu} TU` : ""}</p>
        {(r.user || r.po) && <p className="text-xs mt-1" style={{ color: C.muted }}>{[r.user, r.po && `PO ${r.po}`].filter(Boolean).join(" · ")}</p>}
        {(reports.length > 0 || r.link) && <div className="flex flex-wrap gap-1.5 mt-2">
          {reports.map((u, i) => <RejectionLink key={u} href={u} label={reports.length > 1 ? `Inspection report ${i + 1}` : "Inspection report"} />)}
          {r.link && <RejectionLink href={r.link} label={linkLabel(r.link)} />}
        </div>}
      </div>;
    })}</div>}
  </Note>;
}
function ComplaintsNote({ s, articleId, onOpenList }) {
  const l = complaintsLine(s, articleId); if (!l) return null;
  return <Note tone="bad"><span className="inline-flex items-center gap-1.5 flex-wrap"><Ic i={ThumbsDown} s={14} mr={0} /><b>{l.count} freshness complaint{l.count === 1 ? "" : "s"}</b>{l.sub && <span>· mostly <b>{l.sub}</b></span>}{l.rate && <span>· {l.rate}</span>}{l.period && <span style={{ color: C.muted }}>· {l.period}</span>}{onOpenList && <button onClick={onOpenList} className="underline text-xs" style={{ color: C.accent }}>all complaints</button>}</span></Note>;
}
function ComplaintsPage({ s, set, user, openProduct }) {
  const isHead = user.role === "Head"; const snaps = complaintSnapshots(s);
  // Which post is on screen: the latest unless the Head picked an older one from the history list.
  const [selId, setSelId] = useState(null);
  const sel = (selId && snaps.find(x => x.id === selId)) || latestSnapshot(snaps);
  const meta = sel ? asLegacyMeta(sel, snaps) : complaintsMeta(s);
  const isLatest = !sel || latestSnapshot(snaps)?.id === sel.id;
  useEffect(() => { markComplaintsSeen(user.id); }, [meta.updatedAt]);
  const prev = sel ? previousInWeek(snaps, sel) : null;
  const rowsRaw = sel && prev ? deltaRows(prev, sel) : meta.rows.map(r => ({ ...r, delta: undefined }));
  const rows = [...rowsRaw].sort((a, b) => (b.count || 0) - (a.count || 0) || (a.name || "").localeCompare(b.name || ""));
  const [q, setQ] = useState(""); const qq = q.trim().toLowerCase();
  const shown = qq ? rows.filter(r => `${r.articleId} ${r.name} ${r.subType || ""}`.toLowerCase().includes(qq)) : rows;
  const hasRate = rows.some(r => r.per1k != null || r.delivered != null);
  // New post: the week and the day it is the state of. Default: this week, today — the case 9 times out of 10.
  const [week, setWeek] = useState(() => isoWeekOf(todayISO())); const [asOf, setAsOf] = useState(() => todayISO());
  const [paste, setPaste] = useState(""); const [pasteOpen, setPasteOpen] = useState(false); const [msg, setMsg] = useState("");
  const [draft, setDraft] = useState({ articleId: "", name: "", count: "", subType: "", subCount: "" });
  const [editId, setEditId] = useState(null); const [edit, setEdit] = useState(null); const [confirmDel, setConfirmDel] = useState(false);
  const total = rows.reduce((a, r) => a + (r.count || 0), 0); const max = Math.max(1, ...rows.map(r => r.count || 0));
  const prevTotal = prev ? snapshotTotal(prev) : null;
  const topSub = subTypeMix(sel)[0];
  const matched = rows.filter(r => productForArticle(s, r.articleId)).length;
  const by = meta.byUserId && s.users.find(u => u.id === meta.byUserId);
  const weekPosts = sel ? snapshotsOfWeek(snaps, sel.week) : []; const range = sel ? weekRange(sel.week) : null;
  const parsed = pasteOpen ? parseComplaintRows(paste) : [];
  const existingForDay = snaps.find(x => x.week === week && x.asOf === asOf);
  const fmtDay = iso => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return isNaN(d) ? String(iso || "") : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }); };
  const upsert = (list, incoming) => { const out = [...list]; incoming.forEach(n => { const k = normArticle(n.articleId); const ix = out.findIndex(r => normArticle(r.articleId) === k); const row = { id: ix >= 0 ? out[ix].id : uid(), articleId: n.articleId, name: n.name || productForArticle(s, n.articleId)?.name || out[ix]?.name || "", count: Number(n.count) || 0, subType: n.subType || "", subCount: n.subCount === "" || n.subCount == null ? null : Number(n.subCount), ...(n.per1k != null ? { per1k: Number(n.per1k) } : {}), ...(n.delivered != null ? { delivered: Number(n.delivered) } : {}) }; const same = ix >= 0 && out[ix].count === row.count && (out[ix].subType || "") === row.subType && (out[ix].subCount ?? null) === row.subCount && (out[ix].name || "") === row.name && (out[ix].per1k ?? null) === (row.per1k ?? null) && (out[ix].delivered ?? null) === (row.delivered ?? null); row.updatedAt = same ? out[ix].updatedAt : nowISO(); if (ix >= 0) out[ix] = row; else out.push(row); }); return out; };
  const saveRows = (snap, newRows) => saveSnapshot(set, user, { ...snap, rows: newRows });
  // "Save as post": the pasted table IS the post for that week + day (the Head's screenshot is complete in itself).
  const savePost = () => { if (!parsed.length) return; const snap = { id: existingForDay ? existingForDay.id : uid(), week, asOf, rows: upsert([], parsed) }; saveSnapshot(set, user, snap); setSelId(snap.id); setMsg(`${parsed.length} row${parsed.length === 1 ? "" : "s"} saved as the ${weekLabel(week)} post for ${fmtDay(asOf)}${existingForDay ? " — the earlier post for that day was replaced" : ""}.`); setPaste(""); setPasteOpen(false); };
  const mergeIntoSel = () => { if (!parsed.length || !sel) return; saveRows(sel, upsert(sel.rows, parsed)); setMsg(`${parsed.length} row${parsed.length === 1 ? "" : "s"} merged into the post shown.`); setPaste(""); setPasteOpen(false); };
  const addDraft = () => { if (!draft.articleId.trim() || draft.count === "") return; if (sel) saveRows(sel, upsert(sel.rows, [draft])); else saveSnapshot(set, user, { id: uid(), week, asOf, rows: upsert([], [draft]) }); setDraft({ articleId: "", name: "", count: "", subType: "", subCount: "" }); setMsg("Saved."); };
  const remove = id => sel && saveRows(sel, sel.rows.filter(r => r.id !== id));
  const commitEdit = () => { if (!edit || !sel) return; saveRows(sel, sel.rows.map(r => r.id === editId ? { ...r, name: edit.name, count: Number(edit.count) || 0, subType: edit.subType, subCount: edit.subCount === "" || edit.subCount == null ? null : Number(edit.subCount), updatedAt: nowISO() } : r)); setEditId(null); setEdit(null); };
  const onDraftId = v => { const p = productForArticle(s, v); setDraft(d => ({ ...d, articleId: v, name: d.name || (p ? p.name : "") })); };
  const weeksDesc = [...new Set(snaps.map(x => x.week))].sort().reverse();
  return (
    <div>
      <div className="flex items-center gap-3 mb-1"><h1 className="flex-1">Complaints</h1>
        {isHead && <button onClick={() => setPasteOpen(o => !o)} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ border: `1px solid ${pasteOpen ? C.accent : C.line}`, background: pasteOpen ? C.accentSoft : C.surface, color: pasteOpen ? C.accent : C.ink }}><Ic i={ClipboardPaste} s={13} mr={0} />New post from the BI table</button>}
        {isHead && sel && !confirmDel && <button onClick={() => setConfirmDel(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Delete this post</button>}
        {isHead && sel && confirmDel && <span className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5" style={{ background: C.badBg, color: C.bad }}>Delete the {weekLabel(sel.week)} post of {fmtDay(sel.asOf)} ({sel.rows.length} articles)?<button onClick={() => { deleteSnapshot(set, user, sel.id); setSelId(null); setConfirmDel(false); }} className="px-2.5 py-1 rounded-md font-medium" style={{ background: C.bad, color: C.onDark }}>Yes, delete</button><button onClick={() => setConfirmDel(false)} className="px-2 py-1" style={{ color: C.bad }}>Cancel</button></span>}
      </div>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 760 }}>Customer freshness complaints per article, as the Head of Quality posts them — a top list with the <b>week-to-date</b> totals, re-posted most days. Every post is kept, so the week's figure is its latest post and Analytics can follow articles across weeks. Everyone sees the same numbers here, in the phone app and on every product profile.{meta.updatedAt ? ` Post shown: entered ${fmtTime(meta.updatedAt)}${by ? ` by ${by.name}` : ""}.` : ""}</p>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {[["Complaints", total, C.bad, prev ? `${total - prevTotal >= 0 ? "+" : ""}${total - prevTotal} since ${fmtDay(prev.asOf)}` : (sel ? "first post this week" : "")],
          ["Articles", rows.length, C.ink, matched < rows.length ? `${rows.length - matched} not in the catalog` : rows.length ? "all matched to products" : ""],
          ["Top sub-type", topSub ? topSub.subType : "—", C.warn, topSub ? `${topSub.count} complaints` : ""],
          [sel ? weekLabel(sel.week) : "Period", sel ? `as of ${fmtDay(sel.asOf)}` : (meta.period || "—"), C.accent, sel ? `${range ? `${range.from.slice(8)}.${range.from.slice(5, 7)}–${range.to.slice(8)}.${range.to.slice(5, 7)} · ` : ""}${weekPosts.length} post${weekPosts.length === 1 ? "" : "s"} this week${isLatest ? "" : " · older post shown"}` : ""]].map(([l, v, col, sub]) => (
          <div key={l} className="qc-tile rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className={`${typeof v === "number" ? "text-[26px]" : "text-[17px]"} leading-tight font-semibold mt-0.5 truncate`} title={String(v)}>{v}</p>{sub && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</p>}</div>
        ))}
      </div>
      {isHead && <Card style={{ marginBottom: 12 }}>
        {pasteOpen && <div className="rounded-xl p-3 mb-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-xs font-medium">This post is</span>
            <span className="inline-flex items-center rounded-lg" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
              <button onClick={() => setWeek(w => shiftWeek(w, -1))} className="px-1.5 py-1" style={{ color: C.muted }} title="previous week"><Ic i={ChevronLeft} s={14} mr={0} /></button>
              <span className="text-sm font-medium px-1" style={{ minWidth: 72, textAlign: "center" }}>{weekLabel(week)}</span>
              <button onClick={() => setWeek(w => shiftWeek(w, 1))} className="px-1.5 py-1" style={{ color: C.muted }} title="next week"><Ic i={ChevronRight} s={14} mr={0} /></button>
            </span>
            <span className="text-xs" style={{ color: C.muted }}>{(() => { const r = weekRange(week); return r ? `${fmtDay(r.from)} – ${fmtDay(r.to)}` : ""; })()}</span>
            <span className="text-xs font-medium ml-2">as of</span>
            <input type="date" value={asOf} onChange={e => { const v = e.target.value; setAsOf(v); if (v) setWeek(isoWeekOf(v)); }} className="text-sm rounded-lg px-2 py-1 outline-none" style={{ ...inp }} />
            {existingForDay && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>a post for this day exists — saving replaces it</span>}
          </div>
          <p className="text-xs mb-2" style={{ color: C.muted }}>Paste the table (Article ID · Article · Freshness complaints · Top sub-type, optionally · Freshness per 1k · Delivered items). A header row and a leading row number are ignored; “Spoiled (36)” is split into the sub-type and its count.</p>
          <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={6} placeholder={"10573488\tMerkloos komkommer (1 st)\t39\tSpoiled (36)\n11539732\tMerkloos kiwibessen (125 gram)\t36\tOverripe (35)"} className="w-full text-xs rounded-lg px-2.5 py-2 outline-none font-mono" style={{ ...inp }} />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-xs flex-1" style={{ color: parsed.length ? C.ink : C.muted }}>{parsed.length ? `${parsed.length} row${parsed.length === 1 ? "" : "s"} recognised · ${parsed.filter(r => productForArticle(s, r.articleId)).length} matched to catalog products` : "Nothing recognised yet."}</span>
            {sel && <button onClick={mergeIntoSel} disabled={!parsed.length} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: parsed.length ? C.surface : C.line, color: parsed.length ? C.ink : C.muted, border: `1px solid ${C.line}` }} title="add or update these rows in the post shown below">Merge into the post shown</button>}
            <button onClick={savePost} disabled={!parsed.length} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: parsed.length ? C.accent : C.line, color: parsed.length ? C.onDark : C.muted }}>Save as the {weekLabel(week)} post for {fmtDay(asOf)}</button>
          </div>
        </div>}
        <p className="font-medium text-sm mb-2">Add or update an article{sel ? ` in the ${weekLabel(sel.week)} post of ${fmtDay(sel.asOf)}` : ""}</p>
        <div className="grid gap-2 items-end" style={{ gridTemplateColumns: "150px 1fr 110px 160px 90px auto" }}>
          <label className="text-[11px]" style={{ color: C.muted }}>Article ID<input list="qc-article-ids" value={draft.articleId} onChange={e => onDraftId(e.target.value)} placeholder="10573488" className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none mt-0.5 font-mono" style={{ ...inp }} /><datalist id="qc-article-ids">{s.products.filter(p => p.articleId).map(p => <option key={p.id} value={p.articleId}>{p.name}</option>)}</datalist></label>
          <label className="text-[11px]" style={{ color: C.muted }}>Article<input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder={productForArticle(s, draft.articleId)?.name || "name as in the complaints table"} className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none mt-0.5" style={{ ...inp }} /></label>
          <label className="text-[11px]" style={{ color: C.muted }}>Complaints<input type="number" min="0" value={draft.count} onChange={e => setDraft(d => ({ ...d, count: e.target.value }))} className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none mt-0.5" style={{ ...inp }} /></label>
          <label className="text-[11px]" style={{ color: C.muted }}>Top sub-type<input list="qc-subtypes" value={draft.subType} onChange={e => setDraft(d => ({ ...d, subType: e.target.value }))} placeholder="Spoiled" className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none mt-0.5" style={{ ...inp }} /><datalist id="qc-subtypes">{["Spoiled", "Overripe", "Underripe", "Mouldy", "Damaged", "Wrong product"].map(x => <option key={x} value={x} />)}</datalist></label>
          <label className="text-[11px]" style={{ color: C.muted }}>Sub-type #<input type="number" min="0" value={draft.subCount} onChange={e => setDraft(d => ({ ...d, subCount: e.target.value }))} className="w-full text-sm rounded-lg px-2.5 py-1.5 outline-none mt-0.5" style={{ ...inp }} /></label>
          <button onClick={addDraft} disabled={!draft.articleId.trim() || draft.count === ""} className="text-sm px-4 py-1.5 rounded-lg font-semibold" style={{ background: draft.articleId.trim() && draft.count !== "" ? C.accent : C.line, color: draft.articleId.trim() && draft.count !== "" ? C.onDark : C.muted, height: 34 }}>{sel && rowFor(sel, draft.articleId) ? "Update" : "Add"}</button>
        </div>
        {msg && <p className="text-xs mt-2" style={{ color: C.accent }}>{msg}</p>}
      </Card>}
      <div className="grid gap-4" style={{ gridTemplateColumns: snaps.length > 1 ? "1fr 300px" : "1fr" }}>
        <Card>
          <div className="flex items-center gap-3 mb-2"><p className="font-medium text-sm flex-1">Articles · {shown.length}{qq ? ` of ${rows.length}` : ""} · most complaints first{prev ? ` · change since ${fmtDay(prev.asOf)}` : ""}</p><SearchBox value={q} onChange={setQ} placeholder="Search article or ID" style={{ width: 260 }} inputClass="rounded-lg" size={13} /></div>
          {rows.length === 0 ? <Empty icon={ThumbsDown} title="No complaints entered yet" hint={isHead ? "Paste the Head of Quality's table as a new post." : "The Head hasn't entered this week's complaints yet."} /> : shown.length === 0 ? <p className="text-xs py-4" style={{ color: C.muted }}>Nothing matches “{q}”.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["#", "Article ID", "Article", "Complaints", prev ? "Δ" : null, "", "Top sub-type", hasRate ? "Per 1k" : null, hasRate ? "Delivered" : null, isHead ? "" : null].filter(h => h !== null).map((h, i) => <th key={i} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
              <tbody>{shown.map((r) => { const p = productForArticle(s, r.articleId); const editing = editId === r.id; return (
                <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}`, background: editing ? C.accentSoft : "transparent" }}>
                  <td className="py-1.5 pr-3 text-xs" style={{ color: C.muted, width: 28 }}>{rows.indexOf(r) + 1}</td>
                  <td className="py-1.5 pr-3 font-mono text-xs whitespace-nowrap">{r.articleId}</td>
                  <td className="py-1.5 pr-3">{editing ? <input value={edit.name} onChange={e => setEdit(x => ({ ...x, name: e.target.value }))} className="w-full text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /> : <>{p && openProduct ? <button onClick={() => openProduct(p.id)} className="text-left font-medium" style={{ color: C.ink }}>{r.name || p.name}</button> : <span>{r.name || "—"}</span>}{!p && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>not in catalog</span>}</>}</td>
                  <td className="py-1.5 pr-3 font-semibold" style={{ fontVariantNumeric: "tabular-nums", width: 90 }}>{editing ? <input type="number" min="0" value={edit.count} onChange={e => setEdit(x => ({ ...x, count: e.target.value }))} className="w-20 text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /> : r.count}</td>
                  {prev && <td className="py-1.5 pr-3 text-xs whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", color: r.delta == null ? C.muted : r.delta > 0 ? C.bad : C.ok, width: 70 }}>{r.delta == null ? "new on list" : r.delta > 0 ? `+${r.delta}` : r.delta}</td>}
                  <td className="py-1.5 pr-3" style={{ width: 160 }}><div className="h-2 rounded-full" style={{ background: C.bg }}><div className="h-2 rounded-full" style={{ width: `${Math.round((r.count || 0) / max * 100)}%`, background: C.bad, opacity: .85 }} /></div></td>
                  <td className="py-1.5 pr-3 text-xs">{editing ? <span className="inline-flex gap-1"><input value={edit.subType} onChange={e => setEdit(x => ({ ...x, subType: e.target.value }))} placeholder="sub-type" className="w-28 text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /><input type="number" min="0" value={edit.subCount ?? ""} onChange={e => setEdit(x => ({ ...x, subCount: e.target.value }))} placeholder="#" className="w-16 text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /></span> : r.subType ? <span className="px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>{r.subType}{r.subCount != null ? ` (${r.subCount})` : ""}</span> : <span style={{ color: C.muted }}>—</span>}</td>
                  {hasRate && <td className="py-1.5 pr-3 text-xs whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", width: 80 }}>{r.per1k != null ? Math.round(r.per1k * 10) / 10 : <span style={{ color: C.muted }}>—</span>}</td>}
                  {hasRate && <td className="py-1.5 pr-3 text-xs whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", color: C.muted, width: 90 }}>{r.delivered != null ? r.delivered.toLocaleString("en-GB") : "—"}</td>}
                  {isHead && <td className="py-1.5 text-right whitespace-nowrap" style={{ width: 120 }}>{editing ? <><button onClick={commitEdit} className="text-xs px-2.5 py-1 rounded-lg font-semibold mr-1" style={{ background: C.accent, color: C.onDark }}>Save</button><button onClick={() => { setEditId(null); setEdit(null); }} className="text-xs" style={{ color: C.muted }}>cancel</button></> : <><button onClick={() => { setEditId(r.id); setEdit({ name: r.name || "", count: r.count || 0, subType: r.subType || "", subCount: r.subCount ?? "" }); }} className="text-xs mr-2" style={{ color: C.accent }}>edit</button><button onClick={() => remove(r.id)} className="text-xs" style={{ color: C.muted }}>remove</button></>}</td>}
                </tr>
              ); })}</tbody>
            </table>
          )}
        </Card>
        {snaps.length > 1 && <Card>
          <p className="font-medium text-sm mb-1">Posts</p>
          <p className="text-[11px] mb-2" style={{ color: C.muted }}>Every post the Head entered. The last post of a week is the week's figure. Click one to see it.</p>
          {weeksDesc.map(w => { const posts = snapshotsOfWeek(snaps, w).reverse(); const r = weekRange(w); return (
            <div key={w} className="mb-2">
              <p className="text-xs font-medium mt-1" style={{ color: C.ink }}>{weekLabel(w)}<span className="font-normal ml-1.5" style={{ color: C.muted }}>{r ? `${r.from.slice(8)}.${r.from.slice(5, 7)}–${r.to.slice(8)}.${r.to.slice(5, 7)}` : ""} · {posts.length} post{posts.length === 1 ? "" : "s"}</span></p>
              {posts.map((x, i) => { const on = sel?.id === x.id; const u = s.users.find(z => z.id === x.byUserId); return (
                <button key={x.id} onClick={() => setSelId(x.id)} className="w-full text-left rounded-lg px-2.5 py-1.5 mt-1 flex items-center gap-2" style={{ background: on ? C.accentSoft : C.bg, border: `1px solid ${on ? C.accent : C.line}` }}>
                  <span className="flex-1 min-w-0"><span className="block text-xs font-medium">{fmtDay(x.asOf)}{i === 0 && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>week figure</span>}</span><span className="block text-[11px] truncate" style={{ color: C.muted }}>{snapshotTotal(x)} complaints · {x.rows.length} articles{u ? ` · ${u.name.split(" ")[0]}` : ""}</span></span>
                </button>
              ); })}
            </div>
          ); })}
        </Card>}
      </div>
    </div>
  );
}

// ═══════════════════ PAGE: Dock map ═══════════════════
// The dock line as it stands in the hall: dock 1 on the right, ambient docks 1–3, then chilled docks 5–13 going left. Across
// the aisle, facing that line: dock 14 opposite 13 (left end) and D-00 opposite dock 1 but further right (right end) — drawn
// mirrored (baseline on top, bar hanging down) so the two rows read as facing each other. The sheet's Location column
// ("D-07A") tells which dock each pallet stands on — the trailing letter is the spot within the dock; "D-00E" parses to
// dock 0. Anything else lands in "Other locations". Same drawing as the phone's Dock map (Mobile.jsx MDocks) — keep in step.
const DOCK_CHILLED = [13, 12, 11, 10, 9, 8, 7, 6, 5], DOCK_AMBIENT = [3, 2, 1];
const parseDock = loc => { const m = String(loc || "").trim().match(/^D[-\s]?0*(\d+)\s*([A-Z]?)$/i); return m ? { n: Number(m[1]), sub: (m[2] || "").toUpperCase() } : null; };
const dockZone = n => n >= 5 && n <= 14 ? "chilled" : (n >= 1 && n <= 3) || n === 0 ? "ambient" : null;
const dockLabel = n => n === 0 ? "D-00" : String(n);
// One colour per pallet status, most severe first. "Blocked" is the blocked-sheet queue (wine). "Needed today"
// (the dock sheet's blocking flag — picking waits for the pallet) is blood red; the rest follow the priority column.
// [key, label, bar colour, pill text colour, dark-theme bar colour, dark-theme text colour] — hues spread around the wheel
// so neighbours never blur together; the dark variants are lifted so they still read on the dark surfaces.
const DOCK_STATUS = [[QUEUE_STATUS, "Blocked", "#6b1533", "#6b1533", "#e07088", "#f4a8b4"], ["blocked", "Needed today", "#9b111e", "#9b111e", "#e05252", "#ff8a80"], ["Now needed", "Now needed", "#e0457b", "#b8265c", "#ff7aa8", "#ff9cbf"], ["High risk", "High risk", "#f28c28", "#b35e0a", "#ffa94d", "#ffb866"], ["High issues", "High issues", "#f2c531", "#7d6200", "#ffd75e", "#ffe07a"], ["Late inspection", "Late inspection", "#7c5cbf", "#5f42a3", "#b39ddb", "#c5b3e6"], ["Inspection due", "Inspection due", "#2a9d8f", "#1f7a6f", "#5fd0c2", "#7fe0d4"], ["Skippable", "Skippable", "#c3cad3", "#6b7480", "#4b5560", "#9aa5b1"]];
const dockStatus = r => isBlockedMapRow(r) ? QUEUE_STATUS : r.blocking ? "blocked" : DOCK_STATUS.some(([k]) => k === r.priority) ? r.priority : "Inspection due";
// Needed today (blocking flag) and the priority label are two columns. The bar paints the more severe one, but a
// legend click matches every status the pallet actually has — a Needed-today + Now-needed pallet stays blood-red
// on the map and still appears when someone taps Now needed. "Blocked" is the blocked-sheet queue, not the flag.
const dockHasStatus = (r, k) => {
  if (k === QUEUE_STATUS) return isBlockedMapRow(r);
  if (k === "blocked") return !!r.blocking;
  if (k === "Skippable") return r.priority === "Skippable" || !!r.skippable;
  if (DOCK_STATUS.some(([x]) => x === r.priority)) return r.priority === k;
  return !r.blocking && !isBlockedMapRow(r) && k === "Inspection due";
};
const dockStatusColor = k => { const e = DOCK_STATUS.find(x => x[0] === k); return e ? (C.isDark ? e[4] : e[2]) : (C.isDark ? "#5fd0c2" : "#2a9d8f"); };
const dockStatusText = k => { const e = DOCK_STATUS.find(x => x[0] === k); return e ? (C.isDark ? e[5] : e[3]) : dockStatusColor(k); };
const dockStatusRank = k => { const i = DOCK_STATUS.findIndex(x => x[0] === k); return i < 0 ? 99 : i; };
// Second lens on the same bars: how long each pallet has been standing on the dock.
const DOCK_AGE = [["old", "> 24 h on dock", "#9b111e", "#e05252"], ["day", "6–24 h", "#f2c531", "#ffd75e"], ["fresh", "< 6 h", "#2a9d8f", "#5fd0c2"], ["unknown", "no arrival time", "#c3cad3", "#4b5560"]];
const dockAgeHours = r => { if (!r.arrived) return null; const d = new Date(`${r.arrived}T${String(r.arrivedTime || "12:00").padStart(5, "0")}:00`); return isNaN(d) ? null : (Date.now() - d.getTime()) / 3600000; };
const dockAge = r => { const h = dockAgeHours(r); return h == null ? "unknown" : h > 24 ? "old" : h >= 6 ? "day" : "fresh"; };
const dockAgeColor = k => { const e = DOCK_AGE.find(x => x[0] === k); return e ? (C.isDark ? e[3] : e[2]) : (C.isDark ? "#4b5560" : "#c3cad3"); };
const dockUrgent = r => dockStatusRank(dockStatus(r)) <= 2;
function DockPins({ people, s, size = 22 }) {
  if (!people.length) return null;
  const show = people.slice(0, 3);
  return (
    <span className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none" style={{ bottom: -6, zIndex: 2 }}>
      {show.map((p, i) => { const u = s.users.find(x => x.id === p.userId); return (
        <span key={p.userId} title={`${u?.name || "?"} · ${floorVerb(p)} ${p.productName || "a pallet"}`} style={{ marginLeft: i ? -8 : 0, border: `2px solid ${C.surface}`, borderRadius: "50%", lineHeight: 0, background: C.surface }}><Avatar user={u} size={size} /></span>
      ); })}
      {people.length > 3 && <span className="text-[10px] font-semibold ml-0.5" style={{ color: C.ink }}>+{people.length - 3}</span>}
    </span>
  );
}
function FloorPeopleList({ people, s, user, sel, onPick, compact }) {
  if (!people.length) return null;
  return (
    <div className={compact ? "mt-3" : ""} style={compact ? undefined : { marginBottom: 12 }}>
      <p className="label-sm mb-1.5" style={{ color: C.muted }}>On the floor · {people.length}</p>
      <div className={compact ? "" : "rounded-2xl overflow-hidden"} style={compact ? undefined : { background: C.surface, border: `1px solid ${C.line}` }}>
        {people.map((p, i) => { const u = s.users.find(x => x.id === p.userId); const active = sel === p.dock; return (
          <button key={p.userId} onClick={() => p.dock != null && onPick(p.dock)} className={`w-full text-left flex items-center gap-2.5 ${compact ? "py-2" : "px-3 py-2.5"}`} style={{ borderTop: i && !compact ? `1px solid ${C.line}` : compact ? `1px solid ${C.line}` : "none", background: active ? C.accentSoft : "transparent" }}>
            <Avatar user={u} size={compact ? 28 : 26} />
            <span className="flex-1 min-w-0">
              <span className="text-sm font-medium">{(u?.name || "?").split(" ")[0]}{u?.id === user?.id ? <span className="ml-1.5 text-[11px] font-normal" style={{ color: C.accent }}>you</span> : null}</span>
              <span className="block text-[11px] truncate" style={{ color: C.muted }}>{floorWhere(p)} · {floorVerb(p)} {p.productName || p.hu || "a pallet"}</span>
            </span>
          </button>
        ); })}
      </div>
    </div>
  );
}
function DockMapPage({ s, user, openPallet }) {
  const all = dockMapRows(dockRowsLive(s), openBlockedForMap(blockedQueue(s))); const rows = all.filter(r => !lostOf(s, r)); const lostN = all.length - rows.length;
  const byDock = {}; const other = [];
  rows.forEach(r => { const d = parseDock(r.location); if (d && dockZone(d.n)) (byDock[d.n] = byDock[d.n] || []).push({ ...r, sub: d.sub }); else other.push(r); });
  const floorPeople = peopleOnFloor(s, [...all, ...blockedRowsLive(s)]);
  const [sel, setSel] = useState(null); const [quick, setQuick] = useState(false); const [q, setQ] = useState("");
  // Lens (status / age) and an optional legend filter: bars, counts and the selected dock's list follow both.
  const [mode, setMode] = useState("status"); const [filter, setFilter] = useState(null);
  const keyOf = r => mode === "age" ? dockAge(r) : dockStatus(r);
  const legend = mode === "age" ? DOCK_AGE.map(([k, l]) => [k, l]) : DOCK_STATUS.map(([k, l]) => [k, l]);
  const colorOf = k => mode === "age" ? dockAgeColor(k) : dockStatusColor(k);
  const vis = arr => filter ? arr.filter(r => mode === "age" ? keyOf(r) === filter : dockHasStatus(r, filter)) : arr;
  const max = Math.max(1, ...Object.values(byDock).map(a => vis(a).length));
  const skusOf = arr => new Set(arr.map(r => r.article || r.hu)).size;
  const counts = arr => { const c = {}; arr.forEach(r => { const k = keyOf(r); c[k] = (c[k] || 0) + 1; }); return c; };
  const zoneStats = ns => { const arr = ns.flatMap(n => byDock[n] || []); return { pallets: arr.length, skus: skusOf(arr), needed: arr.filter(r => r.blocking).length, queued: arr.filter(isBlockedMapRow).length, urgent: arr.filter(dockUrgent).length, docksUsed: ns.filter(n => (byDock[n] || []).length).length }; };
  const chilled = zoneStats([14, ...DOCK_CHILLED]), ambient = zoneStats([...DOCK_AMBIENT, 0]);
  const BAR_H = 150;
  const acrossArea = Math.min(BAR_H, Math.max(24, Math.round(Math.max((byDock[14] || []).length, (byDock[0] || []).length) / max * BAR_H)));
  // `flip` mirrors the column for the facing row: baseline on top, bar hanging outward (down), labels under it.
  const DockCol = ({ n, area = BAR_H, flip = false }) => { const arr = vis(byDock[n] || []); const c = counts(arr); const h = arr.length ? Math.min(area, Math.max(8, Math.round(arr.length / max * BAR_H))) : 0; const active = sel === n; const skus = skusOf(arr); const here = peopleAtDock(floorPeople, n);
    const segs = legend.map(([k]) => c[k] > 0 && <div key={k} style={{ flex: c[k], background: colorOf(k) }} />);
    const base = `2px solid ${C.ink}`;
    const inside = h >= 20;
    const skuTag = arr.length > 0 && <span className="qc-sku absolute left-0 right-0 text-center text-[11px] font-semibold pointer-events-none leading-none" style={inside ? { [flip ? "top" : "bottom"]: h / 2 - 6, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,.65)" } : { [flip ? "top" : "bottom"]: h + 3, color: C.ink }}>{skus} SKU{skus === 1 ? "" : "s"}</span>;
    return (
      <button onClick={() => setSel(active ? null : n)} className="qc-dock flex flex-col items-center min-w-0 rounded-xl pt-1.5 pb-2 px-1 transition-colors relative" style={{ background: active ? C.accentSoft : "transparent", outline: active ? `1px solid ${C.accent}` : "none", cursor: "pointer" }}>
        <div className="w-full px-1.5 flex flex-col relative order-1" style={{ height: area, justifyContent: flip ? "flex-start" : "flex-end", borderTop: flip ? base : "none", borderBottom: flip ? "none" : base }}>
          {h > 0 ? <div className="w-full flex flex-col overflow-hidden" style={{ height: h, borderRadius: flip ? "0 0 4px 4px" : "4px 4px 0 0", flexDirection: flip ? "column-reverse" : "column" }}>{segs}</div> : <div className="w-full" style={{ height: 3, background: C.line, borderRadius: flip ? "0 0 2px 2px" : "2px 2px 0 0" }} />}
          {skuTag}
          <DockPins people={here} s={s} />
        </div>
        <span className={`text-[13px] font-semibold leading-none ${flip ? "order-first mb-1.5" : "order-2 mt-1.5"}`} style={{ color: active ? C.accent : C.ink }}>{dockLabel(n)}</span>
        <span className={`text-[11px] leading-none ${flip ? "order-3 mt-1.5" : "order-first mb-1.5"}`} style={{ color: arr.length ? C.muted : C.line, fontVariantNumeric: "tabular-nums" }}>{arr.length ? `${arr.length} pallet${arr.length === 1 ? "" : "s"}` : "empty"}</span>
      </button>
    ); };
  const gridCols = `repeat(${DOCK_CHILLED.length}, minmax(0, 1fr)) 18px repeat(${DOCK_AMBIENT.length}, minmax(0, 1fr)) 18px minmax(0, 1fr)`;
  const lastCol = DOCK_CHILLED.length + DOCK_AMBIENT.length + 3;
  const selRows = vis(sel === "other" ? other : sel !== null ? (byDock[sel] || []) : []);
  const items = (() => { const groups = {}; selRows.forEach(r => { const k = dockMapGroupKey(r); (groups[k] = groups[k] || []).push(r); });
    return Object.values(groups).map(g => { const first = g[0]; const product = s.products.find(p => p.articleId === first.article); const checked = g.filter(x => x.hu && completedInspectionFor(s, x.hu)).length; const subs = [...new Set(g.map(r => r.sub).filter(Boolean))].sort(); const earliest = [...g].sort((x, y) => `${x.arrived || ""}${x.arrivedTime || "99"}`.localeCompare(`${y.arrived || ""}${y.arrivedTime || "99"}`))[0]; const pos = new Set(g.map(r => (r.po || "").trim()).filter(Boolean)); const open = dockMapOpen(g);
      return { key: dockMapGroupKey(first), hu: earliest.hu, openKey: open.key, blockedOnly: open.blockedOnly, name: first.name || product?.name || first.article, article: first.article, count: g.length, checked, subs, product, priority: first.priority, status: dockStatus(g.find(isBlockedMapRow) || g.find(r => r.blocking) || first), blocking: g.some(r => r.blocking), transporter: earliest.transporter, supplier: [...new Set(g.map(r => r.supplier).filter(Boolean))].join(" "), arrived: earliest.arrived, arrivedTime: earliest.arrivedTime, po: [...pos].join(", "), mixedPO: pos.size > 1, locations: [...new Set(g.map(r => r.location).filter(Boolean))].join(", ") };
    }).sort((a, b) => (dockStatusRank(a.status) - dockStatusRank(b.status)) || `${a.arrived || ""}${a.arrivedTime || "99"}`.localeCompare(`${b.arrived || ""}${b.arrivedTime || "99"}`)); })();
  const shown = items.filter(it => dockMatches(it, q, s));
  const searching = !!q.trim();
  const selZone = typeof sel === "number" ? dockZone(sel) : null;
  const quickRows = [14, ...DOCK_CHILLED, ...DOCK_AMBIENT, 0].map(n => ({ key: n, label: n === 14 || n === 0 ? `${dockLabel(n)} · across` : dockLabel(n), zone: dockZone(n), arr: byDock[n] || [] })).filter(q => q.arr.length).concat(other.length ? [{ key: "other", label: "Other locations", zone: null, arr: other }] : []);
  const ZoneCard = ({ icon, title, st, tint }) => (
    <Card>
      <div className="flex items-center gap-2 mb-2"><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: tint }}><Ic i={icon} s={16} mr={0} /></span><p className="font-medium text-sm flex-1">{title}</p>{st.queued > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: dockStatusColor(QUEUE_STATUS) + "1f", color: dockStatusColor(QUEUE_STATUS) }}>{st.queued} blocked</span>}{st.needed > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: dockStatusColor("blocked") + "1f", color: dockStatusColor("blocked") }}>{st.needed} needed today</span>}</div>
      <div className="grid grid-cols-4 gap-2">{[["Pallets", st.pallets], ["SKUs", st.skus], ["Urgent", st.urgent], ["Docks in use", st.docksUsed]].map(([l, v]) => <div key={l}><p className="text-[22px] leading-tight font-semibold" style={{ color: l === "Urgent" && v > 0 ? C.bad : C.ink }}>{v}</p><p className="text-[11px]" style={{ color: C.muted }}>{l}</p></div>)}</div>
    </Card>
  );
  const StatusPill = ({ k }) => <span className="px-1.5 py-0.5 rounded-full text-xs whitespace-nowrap" style={{ background: dockStatusColor(k) + "22", color: dockStatusText(k) }}>{DOCK_STATUS.find(x => x[0] === k)?.[1] || k}</span>;
  return (
    <div>
      <style>{`.qc-dock .qc-sku{opacity:0;transition:opacity .12s}.qc-dock:hover .qc-sku{opacity:1}`}</style>
      <div className="flex items-center gap-3 mb-4"><h1 className="flex-1">Dock map</h1>
        {all.length > 0 && <button onClick={() => setQuick(q => !q)} className="text-xs px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ border: `1px solid ${quick ? C.accent : C.line}`, background: quick ? C.accentSoft : C.surface, color: quick ? C.accent : C.ink }}><Ic i={ListIcon} s={13} mr={0} />Quick list</button>}
      </div>
      {all.length === 0 && <Empty icon={Warehouse} title="No dock data yet" hint="The map fills in as soon as the dock or blocked sheet syncs." />}
      {all.length === 0 && <FloorPeopleList people={floorPeople} s={s} user={user} sel={sel} onPick={d => setSel(sel === d ? null : d)} />}
      {all.length > 0 && <>
        <Card style={{ marginBottom: 12 }}>
          <div className="grid mb-3" style={{ gridTemplateColumns: gridCols }}>
            <div className="flex items-center gap-1.5 justify-center text-xs font-medium rounded-lg py-1" style={{ gridColumn: `1 / span ${DOCK_CHILLED.length}`, background: C.bg, color: C.accent }}><Ic i={Snowflake} s={13} mr={0} />Chilled</div>
            <span />
            <div className="flex items-center gap-1.5 justify-center text-xs font-medium rounded-lg py-1" style={{ gridColumn: `${DOCK_CHILLED.length + 2} / span ${DOCK_AMBIENT.length + 2}`, background: C.bg, color: C.warn }}><Ic i={Thermometer} s={13} mr={0} />Ambient</div>
          </div>
          <div className="grid items-end" style={{ gridTemplateColumns: gridCols }}>
            {DOCK_CHILLED.map(n => <DockCol key={n} n={n} />)}
            <div className="self-stretch mx-2" style={{ borderLeft: `1px dashed ${C.line}` }} />
            {DOCK_AMBIENT.map(n => <DockCol key={n} n={n} />)}
          </div>
          <div className="grid items-start mt-7" style={{ gridTemplateColumns: gridCols }}>
            <DockCol n={14} area={acrossArea} flip />
            <div className="self-start mx-2" style={{ gridColumn: `2 / ${lastCol}`, marginTop: 28, borderTop: `1px dashed ${C.line}` }} />
            <DockCol n={0} area={acrossArea} flip />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3">
            <div className="inline-flex rounded-lg overflow-hidden mr-1" style={{ border: `1px solid ${C.line}` }}>{[["status", "Status"], ["age", "Time on dock"]].map(([k, l]) => <button key={k} onClick={() => { setMode(k); setFilter(null); }} className="text-[11px] px-2.5 py-1" style={{ background: mode === k ? C.ink : "transparent", color: mode === k ? C.onDark : C.muted }}>{l}</button>)}</div>
            {legend.map(([k, l]) => <button key={k} onClick={() => setFilter(f => f === k ? null : k)} className="text-[11px] flex items-center gap-1.5 px-1.5 py-0.5 rounded-md" style={{ color: filter === k ? C.ink : C.muted, background: filter === k ? C.bg : "transparent", outline: filter === k ? `1px solid ${C.line}` : "none", opacity: filter && filter !== k ? .5 : 1 }} title={filter === k ? "Show all" : `Only ${l}`}><span className="inline-block w-3 h-3 rounded-[3px]" style={{ background: colorOf(k) }} />{l}</button>)}
            {filter && <button onClick={() => setFilter(null)} className="text-[11px] underline" style={{ color: C.accent }}>show all</button>}
            {lostN > 0 && <span className="text-[11px]" style={{ color: C.muted }}>· {lostN} lost pallet{lostN === 1 ? "" : "s"} not drawn</span>}
            {other.length > 0 && <button onClick={() => setSel(sel === "other" ? null : "other")} className="ml-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: sel === "other" ? C.accentSoft : C.bg, border: `1px solid ${sel === "other" ? C.accent : C.line}`, color: sel === "other" ? C.accent : C.ink }}><Ic i={Warehouse} s={13} mr={0} />Other locations <span style={{ color: C.muted }}>· {[...new Set(other.map(r => r.location || "no location"))].slice(0, 4).join(", ")}{new Set(other.map(r => r.location)).size > 4 ? "…" : ""}</span><span className="font-semibold">{other.length}</span></button>}
          </div>
        </Card>
        <FloorPeopleList people={floorPeople} s={s} user={user} sel={sel} onPick={d => setSel(sel === d ? null : d)} />
        {quick && <Card style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2 mb-2"><p className="font-medium text-sm flex-1">Quick list · every dock</p><button onClick={() => setQuick(false)} className="text-xs" style={{ color: C.muted }}>close</button></div>
          <table className="text-sm" style={{ minWidth: 360 }}>
            <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Dock", "Pallets", "SKUs"].map(h => <th key={h} className="py-1.5 pr-6 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {quickRows.map(q => <tr key={q.key} onClick={() => setSel(sel === q.key ? null : q.key)} style={{ borderBottom: `1px solid ${C.line}`, cursor: "pointer", background: sel === q.key ? C.accentSoft : "transparent", opacity: q.arr.length ? 1 : .5 }}>
                <td className="py-1.5 pr-6 font-medium"><span className="inline-flex items-center gap-1.5">{q.zone && <Ic i={q.zone === "chilled" ? Snowflake : Thermometer} s={11} mr={0} style={{ color: q.zone === "chilled" ? C.accent : C.warn }} />}{q.label}</span></td>
                <td className="py-1.5 pr-6" style={{ fontVariantNumeric: "tabular-nums" }}>{q.arr.length || "—"}</td>
                <td className="py-1.5 pr-6" style={{ fontVariantNumeric: "tabular-nums" }}>{q.arr.length ? skusOf(q.arr) : "—"}</td>
              </tr>)}
              <tr className="font-semibold"><td className="py-1.5 pr-6">Total</td><td className="py-1.5 pr-6" style={{ fontVariantNumeric: "tabular-nums" }}>{rows.length}</td><td className="py-1.5 pr-6" style={{ fontVariantNumeric: "tabular-nums" }}>{skusOf(rows)}</td></tr>
            </tbody>
          </table>
        </Card>}
        {sel === null && <div className="grid grid-cols-2 gap-3">
          <ZoneCard icon={Snowflake} title="Chilled hall" st={chilled} tint={C.accent} />
          <ZoneCard icon={Thermometer} title="Ambient hall" st={ambient} tint={C.warn} />
        </div>}
        {sel !== null && <Card>
          <div className="flex items-center gap-2 mb-2">
            <p className="font-medium text-sm">{sel === "other" ? "Other locations" : sel === 0 ? "D-00 · opposite dock 1" : `Dock ${sel}`}</p>
            {selZone && <span className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: C.bg, color: selZone === "chilled" ? C.accent : C.warn, border: `1px solid ${C.line}` }}><Ic i={selZone === "chilled" ? Snowflake : Thermometer} s={11} mr={0} />{selZone}</span>}
            <span className="text-xs flex-1" style={{ color: C.muted }}>· {selRows.length} pallet{selRows.length === 1 ? "" : "s"} · {items.length} SKU{items.length === 1 ? "" : "s"}{selRows.filter(isBlockedMapRow).length ? ` · ${selRows.filter(isBlockedMapRow).length} blocked` : ""}{selRows.filter(r => r.blocking).length ? ` · ${selRows.filter(r => r.blocking).length} needed today` : ""} · most urgent first</span>
            <SearchBox value={q} onChange={setQ} placeholder="Search name, article, supplier…" style={{ width: 260 }} inputClass="rounded-lg" size={13} />
            <button onClick={() => setSel(null)} className="text-xs" style={{ color: C.muted }}>close</button>
          </div>
          {(() => { const here = sel === "other" ? floorPeople.filter(p => p.dock === "other") : peopleAtDock(floorPeople, sel); if (!here.length) return null; return (
            <div className="rounded-xl px-3 py-2 mb-3 flex flex-col gap-1.5" style={{ background: C.accentSoft }}>
              {here.map(p => { const u = s.users.find(x => x.id === p.userId); return (
                <div key={p.userId} className="flex items-center gap-2 text-sm">
                  <Avatar user={u} size={22} />
                  <span><b>{(u?.name || "?").split(" ")[0]}</b> is {floorVerb(p)} {p.productName || p.hu || "a pallet"} here</span>
                </div>
              ); })}
            </div>
          ); })()}
          {shown.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>{searching ? "Nothing matches." : "Nothing standing here right now."}</p> : <table className="w-full text-sm">
            <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Product", "Pallets", sel === "other" ? "Location" : "Spot", "Status", "Article", "Arrived", "Transporter", "PO", "Report"].map(h => <th key={h} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{shown.map(it => <tr key={it.key} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-3"><span className="inline-flex items-center gap-2">{openPallet && (it.openKey || it.hu || it.article) ? <button onClick={() => openPallet(it.openKey || it.hu || it.article)} className="text-left font-medium" style={{ color: C.ink }}>{it.name}</button> : <span>{it.name}</span>}<ComplaintChip s={s} articleId={it.article} /></span></td>
              <td className="py-1.5 pr-3 text-xs">{it.count > 1 ? <span className="px-1.5 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>×{it.count}</span> : "1"}</td>
              <td className="py-1.5 pr-3 text-xs">{sel === "other" ? it.locations : (it.subs.join("/") || "—")}</td>
              <td className="py-1.5 pr-3 text-xs"><StatusPill k={it.status} />{it.blocking && it.priority && it.priority !== "Skippable" && <span className="ml-1 text-[10px]" style={{ color: C.muted }}>{it.priority}</span>}</td>
              <td className="py-1.5 pr-3 font-mono text-xs">{it.article}</td>
              <td className="py-1.5 pr-3 text-xs">{it.arrived ? `${dayLabel(it.arrived + "T12:00:00")} ` : ""}{it.arrivedTime}</td>
              <td className="py-1.5 pr-3 text-xs">{it.transporter || "—"}</td>
              <td className="py-1.5 pr-3 text-xs">{it.po || "—"}{it.mixedPO && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>mixed</span>}</td>
              <td className="py-1.5 pr-3 text-xs">{it.checked > 0 ? <span className="px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: C.okBg, color: C.ok }}><Ic i={Check} s={10} mr={0} />{it.checked === it.count ? "inspected" : `${it.checked}/${it.count} inspected`}</span> : <span style={{ color: C.muted }}>not yet</span>}</td>
            </tr>)}</tbody>
          </table>}
        </Card>}
      </>}
    </div>
  );
}

// Pallet screen for the portal — desk layout of the phone sheet: status, HU, location, PO, siblings.
// Product profile is a link, not the first hop. Inspections start on the phone, not here.
const palletTime = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
function PalletPage({ s, set, user, hu, onBack, onOpenProduct, onOpenInspection, onPickPallet, onAssign, onOpenAnnouncements, onOpenComplaints }) {
  const r = findPalletRow(s, hu);
  const [lostNote, setLostNote] = useState(""); const [lostAsk, setLostAsk] = useState(false); const [showRef, setShowRef] = useState(false);
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { setLostAsk(false); setLostNote(""); setShowRef(false); }, [hu]);
  if (!r) return (
    <div>
      <button type="button" onClick={onBack} className="text-sm inline-flex items-center mb-4" style={{ color: C.accent }}><Ic i={ChevronLeft} s={16} />Back</button>
      <Card><Empty icon={Package} title="Pallet not found" hint="It may already be inspected or off the sheet." /></Card>
    </div>
  );
  const st = settingsOf(s);
  const product = s.products.find(p => p.articleId === r.article) || productForArticle(s, r.article);
  const done = r.hu ? completedInspectionFor(s, r.hu) : null;
  const lost = lostOf(s, r);
  const draft = r.hu ? s.inspections.find(i => (i.pallets || []).some(x => samePallet(x, r.hu)) && ["Draft", "PendingReview"].includes(i.status)) : null;
  const al = r.hu ? computeDeadlineAlerts(s, now).find(a => samePallet(a.hu, r.hu)) : null;
  const claim = claimOf(s, r); const claimer = claim && s.users.find(u => u.id === claim.userId); const mine = claim && claim.userId === user.id;
  const status = dockStatus(r); const col = dockStatusColor(status); const statusLabel = DOCK_STATUS.find(x => x[0] === status)?.[1] || r.priority || (r.kind === "blocked" ? "Blocked" : r.kind === "unreported" ? "Unreported" : "Pallet");
  const dockAll = dockRowsLive(s).filter(x => !lostOf(s, x));
  const sameArt = r.article ? dockAll.filter(x => x.article === r.article) : [];
  const others = sameArt.filter(x => !(r.hu && samePallet(x.hu, r.hu)));
  const pos = [...new Set(sameArt.map(x => (x.po || "").trim()).filter(Boolean))];
  const byPo = !!String(r.po || "").trim();
  const sameDelivery = dockAll.filter(x => x.article !== r.article && !(r.hu && samePallet(x.hu, r.hu)) && (byPo ? (x.po || "").trim() === String(r.po).trim() : (r.transporter && r.arrived && x.transporter === r.transporter && x.arrived === r.arrived)));
  const sameDock = r.location ? dockAll.filter(x => x.location === r.location && !(r.hu && samePallet(x.hu, r.hu))) : [];
  const photos = product ? asPhotoList(product.photos) : [];
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return ""; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const arrivalMs = r.arrived ? new Date(`${r.arrived}T${r.arrivedTime || "00:00"}:00`).getTime() : NaN;
  const hoursOn = isNaN(arrivalMs) ? null : (now - arrivalMs) / 3600000;
  const windowLeft = isNaN(arrivalMs) ? null : arrivalMs + st.rejectionWindowHours * 3600000 - now;
  const arrived = `${r.arrived ? dayLabel(r.arrived + "T12:00:00") : ""}${r.arrivedTime ? ` ${r.arrivedTime}` : ""}`.trim();
  const hist = product ? recentProblemsFor(s, product.id, now) : { count: 0, problems: [] };
  const compl = complaintsLine(s, r.article);
  const ext = extRejectionLine(s, r.article, now);
  const anns = product ? s.announcements.filter(a => annActive(a) && annMatchesProduct(s, a, product)) : [];
  const specs = product ? effectiveSpecs(s, product) : [];
  const live = product ? liveNoteOf(product) : null;
  const history = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 5) : [];
  const ref = product ? s.inspections.find(i => i.productId === product.id && i.isReference) : null;
  const why = r.blocking ? "Flagged “Needed today” on the dock sheet — picking waits for this pallet." : r.priority === "High risk" ? "The dock sheet marks this product as high risk — recent rejections or a sensitive product." : r.priority === "High issues" ? "The dock sheet marks this product as high issues — problems were found on earlier deliveries." : r.priority === "Late inspection" ? "Standing on the dock longer than it should — inspect before the rejection window closes." : r.priority === "Now needed" ? "Needed now — the planner is waiting for this product." : r.priority === "Inspection due" ? "Due for a routine inspection." : r.skippable ? "Marked skippable on the dock sheet — a visual check is enough unless something looks off." : "";
  const take = () => setClaim(set, r, { userId: user.id, at: nowISO(), status: "taken" });
  const stack = () => setClaim(set, r, { userId: user.id, at: nowISO(), status: "stacked" });
  const release = () => setClaim(set, r, null);
  const Pill = ({ children, bg, fg }) => <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>{children}</span>;
  const Fact = ({ k, v, tone }) => <div className="min-w-0"><p className="label-sm mb-0.5">{k}</p><p className="text-sm font-semibold leading-snug" style={{ fontVariantNumeric: "tabular-nums", color: tone || C.ink }}>{v || "—"}</p></div>;
  const NoteRow = ({ icon: I, tone, children, onClick }) => {
    const fg = tone === "ok" ? C.ok : tone === "warn" ? C.warn : tone === "info" ? C.accent : C.bad;
    const bg = tone === "ok" ? C.okBg : tone === "warn" ? C.warnBg : tone === "info" ? C.accentSoft : C.badBg;
    const Tag = onClick ? "button" : "div";
    return <Tag type={onClick ? "button" : undefined} onClick={onClick} className="w-full text-left flex items-start gap-2 px-3 py-2 rounded-lg text-[13px] leading-snug" style={{ background: bg, color: fg }}><Ic i={I} s={13} mr={0} style={{ marginTop: 2 }} /><span className="min-w-0 flex-1">{children}</span>{onClick && <Ic i={ChevronRight} s={13} mr={0} style={{ marginTop: 2, opacity: .7 }} />}</Tag>;
  };
  const PalletChip = ({ x, hint }) => { const stt = dockStatus(x); const c2 = dockStatusColor(stt); const inspected = !!completedInspectionFor(s, x.hu); const p2 = s.products.find(p => p.articleId === x.article); return (
    <button type="button" onClick={() => onPickPallet && onPickPallet(x.hu)} className="qc-tile w-full text-left rounded-xl px-3 py-2 flex items-center gap-2.5" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${inspected ? C.ok : c2}` }}>
      <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium truncate leading-tight">{hint === "article" ? (x.name || p2?.name || x.article) : x.location || "—"}</span><span className="block text-[11px] truncate mt-0.5" style={{ color: C.muted }}>{hint === "article" ? `${x.location || "—"} · ` : ""}{DOCK_STATUS.find(d => d[0] === stt)?.[1] || stt}{x.po ? ` · PO ${x.po}` : ""}{x.quantity != null ? ` · ${palletQty(x)}` : ""}{inspected ? " · inspected" : ""}</span></span>
      <Ic i={ChevronRight} s={14} mr={0} style={{ color: C.muted }} />
    </button>); };
  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button type="button" onClick={onBack} className="text-sm inline-flex items-center" style={{ color: C.accent }}><Ic i={ChevronLeft} s={16} />Back</button>
        <h1 className="flex-1">Pallet</h1>
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <Pill bg={col + "22"} fg={dockStatusText(status)}>{statusLabel}</Pill>
          {r.blocking && status !== "blocked" && <Pill bg={dockStatusColor("blocked") + "22"} fg={dockStatusColor("blocked")}>Needed today</Pill>}
          {r.skippable && status !== "Skippable" && <Pill bg={C.line} fg={C.muted}>Skippable</Pill>}
          {lost && <Pill bg={C.line} fg={C.muted}>Lost</Pill>}
          {r.kind === "blocked" && <Pill bg={C.badBg} fg={C.bad}>Blocked queue</Pill>}
          {r.kind === "unreported" && <Pill bg={C.badBg} fg={C.bad}>Unreported</Pill>}
        </span>
        <span className="text-xs font-mono" style={{ color: C.muted }}>{r.hu ? `HU ${r.hu}` : "no HU"}</span>
      </div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px" }}>
        {/* ── Main column ── */}
        <div className="flex flex-col gap-4 min-w-0">
          <Card style={{ padding: 0, overflow: "hidden", opacity: lost ? .75 : 1 }}>
            <div className="px-5 py-4" style={{ borderLeft: `4px solid ${col}` }}>
              <div className="flex items-start gap-4">
                {photos.length ? <img src={thumbSrc(photos[0])} loading="lazy" decoding="async" alt="" className="rounded-xl object-contain flex-shrink-0" style={{ width: 72, height: 72, background: PHOTO_BG, border: `1px solid ${C.line}` }} /> : <div className="rounded-xl flex items-center justify-center flex-shrink-0" style={{ width: 72, height: 72, background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}><Ic i={ImageIcon} s={24} mr={0} /></div>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="leading-tight" style={{ fontSize: 18 }}>{product?.name || r.name || r.article}</h2>
                      {product ? <p className="text-xs mt-0.5 truncate" style={{ color: C.muted }}><span className="font-mono">ID {product.articleId}</span>{catPath(product.categoryId) ? ` · ${catPath(product.categoryId)}` : ""}{product.isBio ? " · bio" : ""}{product.cusPerTu ? ` · ${product.cusPerTu} CU/TU` : ""}</p> : <p className="text-xs mt-0.5" style={{ color: C.warn }}>Article {r.article} has no product profile yet.</p>}
                    </div>
                    {product && onOpenProduct && <button type="button" onClick={() => onOpenProduct(product.id)} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center flex-shrink-0" style={{ height: 30, background: C.accentSoft, color: C.accent }}>Product profile<Ic i={ChevronRight} s={13} mr={0} style={{ marginLeft: 2 }} /></button>}
                  </div>
                  {why && <p className="text-[13px] mt-2" style={{ color: dockStatusText(status) }}>{why}</p>}
                </div>
              </div>
              <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}>
                <Fact k="Location" v={r.location} />
                <Fact k="Arrived" v={arrived} />
                <Fact k="On the dock" v={hoursOn == null ? null : fmtHours(hoursOn)} tone={hoursOn != null && hoursOn > st.rejectionWindowHours ? C.bad : undefined} />
                <Fact k="Rejection window" v={windowLeft == null ? null : windowLeft <= 0 ? "expired" : `${fmtLeft(windowLeft)} left`} tone={windowLeft != null && (windowLeft <= 0 || al) ? C.bad : undefined} />
                <Fact k="PO" v={r.po} />
                <Fact k="Transporter" v={r.transporter} />
              </div>
              {(r.quantity != null || r.supplier || ("sortable" in r) || r.deadline) && <p className="text-[12px] mt-3 flex flex-wrap gap-x-3" style={{ color: C.muted }}>{r.quantity != null && <span><b style={{ color: C.ink }}>{palletQty(r)}</b> on the pallet</span>}{r.supplier && <span>supplier <b style={{ color: C.ink }}>{r.supplier}</b></span>}{"sortable" in r && <span>{r.sortable ? "sortable" : "not sortable"}</span>}{r.deadline && <span>departure <b style={{ color: C.ink }}>{r.deadline}</b></span>}</p>}
            </div>
            {(lost || al || done || draft) && <div className="px-5 pb-3 flex flex-col gap-1.5" style={{ borderTop: `1px solid ${C.line}`, paddingTop: 12 }}>
              {lost && <NoteRow icon={Search} tone="warn">Marked lost · {s.users.find(u => u.id === lost.byUserId)?.name.split(" ")[0] || "?"} · {dayLabel(lost.at)}{lost.at ? `, ${palletTime(lost.at)}` : ""}{lost.note ? ` — ${lost.note}` : ""}</NoteRow>}
              {done && <NoteRow icon={Check} tone="ok" onClick={onOpenInspection ? () => onOpenInspection(done.id) : undefined}><b>Already inspected</b> · {done.result || STATUS[done.status]?.[0]} · {s.users.find(u => u.id === done.controllerId)?.name.split(" ")[0] || "?"} · {dayLabel(done.completedAt)}{done.completedAt ? `, ${palletTime(done.completedAt)}` : ""}</NoteRow>}
              {al && !lost && !done && <NoteRow icon={Clock} tone="bad"><b>{al.level === "breached" ? "Rejection window expired" : `Rejection window closes in ${fmtLeft(al.deadlineAt - now)}`}</b>{al.risky ? " · product rejected recently, so the warning came earlier" : ""}</NoteRow>}
              {draft && <NoteRow icon={Clock} tone="warn" onClick={onOpenInspection ? () => onOpenInspection(draft.id) : undefined}><b>{s.users.find(u => u.id === draft.controllerId)?.name.split(" ")[0] || "Someone"} is inspecting this pallet</b> · {draft.status === "PendingReview" ? "awaiting the Head" : "draft"} since {palletTime(draft.startedAt)}</NoteRow>}
            </div>}
          </Card>
          {/* What to check */}
          <Card>
            <p className="font-semibold mb-3">What to check</p>
            {(anns.length || live || ext || compl || hist.count) ? <div className="flex flex-col gap-1.5 mb-4">
              {anns.map(a => <NoteRow key={a.id} icon={Megaphone} tone={a.isBlocking ? "bad" : "warn"} onClick={onOpenAnnouncements}><b>{a.title}</b>{a.body ? ` — ${a.body}` : ""}{a.isBlocking ? " · blocks acceptance" : ""}</NoteRow>)}
              {live && <NoteRow icon={AlertTriangle} tone="warn"><b>Live spec from the commercial team:</b> {live.text}{live.until ? ` · until ${fmtUntil(live.until)}` : ""}</NoteRow>}
              {ext && <NoteRow icon={AlertTriangle} tone="bad"><b>Rejected on the dock {ext.count}× in {ext.span}</b> · last {fmtRejectionDay(ext.last)}{ext.mostly ? ` · ${ext.mostly}` : ""}{ext.recent[0]?.reason ? ` — “${ext.recent[0].reason}”` : ""}</NoteRow>}
              {hist.count > 0 && <NoteRow icon={AlertTriangle} tone="bad"><b>{hist.count} rejected by the team in 14 days</b> · {hist.problems.slice(0, 3).map(x => `${x.name} ×${x.count}`).join(", ")}{hist.problems.length > 3 ? "…" : ""}</NoteRow>}
              {compl && <NoteRow icon={ThumbsDown} tone="bad" onClick={onOpenComplaints}><b>{compl.count} freshness complaint{compl.count === 1 ? "" : "s"}</b>{compl.sub ? <> · mostly <b>{compl.sub}</b></> : null}{compl.rate ? ` · ${compl.rate}` : ""}</NoteRow>}
            </div> : <p className="text-sm mb-4" style={{ color: C.ok }}>Nothing special on this product — no notes, no recent rejections, no complaints.</p>}
            <div className="grid gap-5" style={{ gridTemplateColumns: photos.length > 1 || ref ? "minmax(0, 1fr) 220px" : "1fr" }}>
              <div>
                <p className="label-sm mb-1" style={{ color: C.muted }}>Specifications</p>
                {!product ? <p className="text-sm" style={{ color: C.muted }}>No profile, so no specs — inspect by the general rules.</p> : specs.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>No specifications yet — inspect by the general rules for {catPath(product.categoryId) || "the category"}.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}><tbody>
                  {specs.map(sp => <tr key={sp.id} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-1.5 pr-3">{sp.name}{sp.basis && <span className="text-[11px] ml-1.5" style={{ color: C.muted }}>per {sp.basis === "cu" ? "CU" : sp.basis}</span>}</td><td className="py-1.5 text-right"><SpecValue spec={sp} colors={C} /></td><td className="py-1.5 pl-3 text-right text-[11px] whitespace-nowrap" style={{ color: C.muted, width: 110 }}>{sp.temp ? <span style={{ color: C.bad }}>temporary</span> : sp.origin === "sheet" ? "commercial sheet" : sp.source !== "product" ? sp.source : ""}</td></tr>)}
                </tbody></table>}
                {product && effectiveAttributes(s, product).length > 0 && <div className="flex flex-wrap gap-1.5 mt-3">{effectiveAttributes(s, product).map(a => <span key={a.dictionaryId} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{a.list}:</span> <b>{a.value}</b></span>)}</div>}
              </div>
              {(photos.length > 1 || ref) && <div>
                {photos.length > 1 && <><p className="label-sm mb-1" style={{ color: C.muted }}>How it should look</p><div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>{photos.slice(0, 4).map((ph, i) => <img key={i} src={thumbSrc(ph)} loading="lazy" decoding="async" alt="" className="w-full rounded-lg object-contain" style={{ aspectRatio: "1 / 1", background: PHOTO_BG, border: `1px solid ${C.line}` }} />)}</div></>}
                {ref && <button type="button" onClick={() => setShowRef(v => !v)} className="text-xs font-medium inline-flex items-center mt-2" style={{ color: C.ok }}><Ic i={Star} s={13} />{showRef ? "Hide the reference inspection" : "Open the reference inspection"}</button>}
              </div>}
            </div>
            {showRef && ref && <div className="rounded-xl p-3 mt-3" style={{ border: `1px solid ${C.ok}` }}><ReportView insp={ref} s={s} user={user} onEdit={() => {}} onAnswer={() => {}} /></div>}
          </Card>
          {(others.length > 0 || sameDelivery.length > 0) && <Card>
            {others.length > 0 && <div className={sameDelivery.length ? "mb-4" : ""}>
              <div className="flex items-center gap-2 mb-2 flex-wrap"><p className="font-semibold">Same product on the docks · {others.length}</p>{pos.length > 1 && <span className="text-[11px] inline-flex items-center" style={{ color: C.warn }}><Ic i={AlertTriangle} s={11} mr={4} />{pos.length} PO numbers ({pos.join(", ")}) — one report can still cover them if they arrived the same day</span>}</div>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>{others.map(x => <PalletChip key={x.hu} x={x} />)}</div>
            </div>}
            {sameDelivery.length > 0 && <div>
              <p className="font-semibold mb-0.5">Same delivery · {sameDelivery.length}</p>
              <p className="text-[12px] mb-2" style={{ color: C.muted }}>Other products {byPo ? `on the same PO ${r.po}` : `delivered by ${r.transporter} on the same day`} — worth checking in the same walk.</p>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>{sameDelivery.slice(0, 8).map(x => <PalletChip key={x.hu} x={x} hint="article" />)}</div>
            </div>}
          </Card>}
        </div>
        {/* ── Side column ── */}
        <aside className="flex flex-col gap-4">
          <Card>
            <p className="label-sm mb-1.5" style={{ color: C.muted }}>Status</p>
            {done ? <p className="text-sm font-semibold inline-flex items-center" style={{ color: C.ok }}><Ic i={Check} s={15} />Inspected · {done.result || "done"}</p>
            : lost ? <p className="text-sm font-semibold" style={{ color: C.muted }}>Marked lost</p>
            : draft ? <p className="text-sm font-semibold" style={{ color: C.accent }}>{s.users.find(u => u.id === draft.controllerId)?.name.split(" ")[0] || "Someone"} is inspecting it now</p>
            : claim?.status === "taken" ? <p className="text-sm font-semibold" style={{ color: mine ? C.accent : C.ink }}>{mine ? "You took this pallet" : `${claimer?.name.split(" ")[0] || "Someone"} took this pallet`} <span className="font-normal text-xs" style={{ color: C.muted }}>· {agoShort(claim.at)}</span></p>
            : claim?.status === "stacked" ? <p className="text-sm font-semibold" style={{ color: C.warn }}>In stack — not reachable <span className="font-normal text-xs" style={{ color: C.muted }}>· {claimer?.name.split(" ")[0] || "?"}, {agoShort(claim.at)}</span></p>
            : <p className="text-sm font-semibold" style={{ color: C.ink }}>Not inspected yet</p>}
            {!done && !lost && !draft && <div className="flex flex-wrap gap-1.5 mt-3">
              {!claim && <><button type="button" onClick={take} className="text-xs font-semibold px-3 rounded-xl" style={{ height: 32, background: C.ink, color: C.onDark }}>Take it</button><button type="button" onClick={stack} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 32, border: `1px solid ${C.line}`, color: C.ink }}><Ic i={Layers} s={12} />In stack</button></>}
              {claim && mine && <>{claim.status === "stacked" ? <button type="button" onClick={take} className="text-xs font-semibold px-3 rounded-xl" style={{ height: 32, background: C.ink, color: C.onDark }}>Reachable now — take it</button> : null}<button type="button" onClick={release} className="text-xs px-3 rounded-xl" style={{ height: 32, border: `1px solid ${C.line}`, color: C.muted }}>{claim.status === "stacked" ? "Not in stack anymore" : "Let it go"}</button></>}
              {claim && !mine && claim.status === "stacked" && <button type="button" onClick={take} className="text-xs font-semibold px-3 rounded-xl" style={{ height: 32, background: C.ink, color: C.onDark }}>Reachable now — take it</button>}
            </div>}
            {!done && !lost && <p className="text-[11px] mt-3 leading-snug" style={{ color: C.muted }}>The inspection itself starts on the phone: scan the pallet label{r.hu ? <> (HU <span className="font-mono">…{String(r.hu).slice(-8)}</span>)</> : null} or the CU barcode.</p>}
            <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              {onAssign && !lost && <button type="button" onClick={() => onAssign(r)} className="text-xs px-2.5 rounded-lg inline-flex items-center" style={{ height: 28, border: `1px solid ${C.line}`, color: C.ink }}><Ic i={MessageCircle} s={12} />{user.role === "Head" ? "Assign / message" : "Ask the Head"}</button>}
              {lost && <button type="button" onClick={() => markFound(set, r, user)} className="text-xs px-2.5 rounded-lg font-semibold" style={{ height: 28, background: C.ink, color: C.onDark }}>Found — it's back</button>}
              {!lost && !lostAsk && r.kind !== "unreported" && r.kind !== "lost-only" && <button type="button" onClick={() => setLostAsk(true)} className="text-xs px-2.5 rounded-lg" style={{ height: 28, color: C.muted, border: `1px solid ${C.line}` }}>Mark lost</button>}
            </div>
            {!lost && lostAsk && <div className="flex gap-1.5 mt-2 flex-wrap">
              <input value={lostNote} onChange={e => setLostNote(e.target.value)} placeholder="note (optional)" className="text-xs rounded-lg px-2 outline-none flex-1" style={{ ...inp, height: 28, minWidth: 120 }} />
              <button type="button" onClick={() => { markLost(set, r, user, lostNote); setLostAsk(false); setLostNote(""); }} className="text-xs px-2.5 rounded-lg font-semibold" style={{ height: 28, background: C.bad, color: C.onDark }}>Mark lost</button>
              <button type="button" onClick={() => setLostAsk(false)} className="text-xs px-2" style={{ color: C.muted }}>Cancel</button>
            </div>}
          </Card>
          {sameDock.length > 0 && <Card>
            <p className="font-semibold text-sm mb-0.5">Also at {r.location} · {sameDock.length}</p>
            <p className="text-[12px] mb-2" style={{ color: C.muted }}>Standing on the same dock — take them in one walk.</p>
            <div className="flex flex-col gap-1.5">{sameDock.slice(0, 6).map(x => <PalletChip key={x.hu} x={x} hint="article" />)}</div>
            {sameDock.length > 6 && <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>+{sameDock.length - 6} more on the dock map</p>}
          </Card>}
          {product && <Card>
            <div className="flex items-center mb-1"><p className="font-semibold text-sm flex-1">This product lately</p></div>
            {history.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>Not inspected by the team yet.</p> : history.map(i => { const who = s.users.find(u => u.id === i.controllerId); const rej = i.result === "Rejected"; return <button key={i.id} type="button" onClick={() => onOpenInspection && onOpenInspection(i.id)} className="w-full text-left flex items-center gap-2 py-1.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: rej ? C.bad : i.result === "Accepted" ? C.ok : C.muted }} /><span className="flex-1 min-w-0"><span className="text-sm block leading-tight">{rej ? "Rejected" : i.result || "Done"}{i.comment ? <span style={{ color: C.muted }}> — {i.comment}</span> : null}</span><span className="text-[11px] block" style={{ color: C.muted }}>{who ? `${who.name.split(" ")[0]} · ` : ""}{dayLabel(i.completedAt)}</span></span></button>; })}
          </Card>}
        </aside>
      </div>
    </div>
  );
}

// ═══════════════════ STRONA: Dashboard ═══════════════════
// What the floor looks like right now, for the Head in the office: docks by priority, the blocked queue by state, who has
// what, lost pallets, and how fresh the sheets are. Same numbers the phones show — one source (the shared state).
const PRIO_ORDER = ["Now needed", "High risk", "High issues", "Late inspection", "Inspection due"];
const floorStats = (s, now = Date.now()) => {
  const dockAll = dockRowsLive(s); const dock = dockAll.filter(r => !lostOf(s, r)); const dockLost = dockAll.length - dock.length;
  const prio = Object.fromEntries(PRIO_ORDER.map(k => [k, dock.filter(r => r.priority === k).length]));
  const skippable = dock.filter(r => r.skippable).length; const blocking = dock.filter(r => r.blocking).length;
  const q = blockedQueue(s); const open = q.filter(b => b.status !== "Completed" && !b.lost); const bl = { open: open.length, taken: open.filter(b => b.claim?.status === "taken").length, lost: q.filter(b => b.lost && b.status !== "Completed").length };
  // In stack is a floor-wide flag (dock sheet + blocked sheet), not a blocked-queue status.
  const stackedRows = []; const seenStack = new Set();
  [...dockAll, ...blockedRowsLive(s)].forEach(r => { const k = claimKey(r); if (seenStack.has(k) || lostOf(s, r)) return; if (claimOf(s, r)?.status === "stacked") { seenStack.add(k); stackedRows.push(r); } });
  const stacked = stackedRows.length;
  const lostOpen = Object.entries(s.lostPallets || {}).filter(([k]) => [...dockAll, ...blockedRowsLive(s)].some(r => lostKey(r) === k && lostOf(s, r))).length;
  const people = s.users.filter(u => u.active !== false && u.role !== "Head").map(u => {
    const claims = Object.entries(s.palletClaims || {}).filter(([, c]) => c.userId === u.id);
    const mine = claims.map(([k, c]) => { const row = [...dockAll, ...blockedRowsLive(s)].find(r => claimKey(r) === k); return row ? { ...row, claim: c } : null; }).filter(Boolean).filter(r => !lostOf(s, r));
    const inProgress = s.inspections.filter(i => i.controllerId === u.id && ["Draft", "PendingReview"].includes(i.status));
    const lastAt = [...claims.map(([, c]) => c.at), ...s.inspections.filter(i => i.controllerId === u.id).map(i => i.completedAt || i.startedAt)].filter(Boolean).sort().slice(-1)[0] || null;
    return { user: u, taken: mine.filter(r => r.claim.status === "taken"), inProgress, doneToday: doneTodayByUser(s, u.id, now), lastAt };
  }).sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
  const alerts = computeDeadlineAlerts(s, now);
  return { dock, dockLost, prio, skippable, blocking, skus: new Set(dock.map(r => r.article)).size, bl, stacked, stackedRows, lostOpen, people, alerts, fresh: sheetFreshness(s), doneToday: doneTodayCount(s, now), unreported: unreportedStats(s, now) };
};
const agoShort = t => { if (!t) return "—"; const m = Math.round((Date.now() - new Date(t).getTime()) / 60000); return m < 1 ? "now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : fmtTime(t); };

function Dashboard({ s, setPage, seed, user, openPallet, onAssign, set, openTodayInspections }) {
  const [prioSel, setPrioSel] = useState(null); const [blSel, setBlSel] = useState(null); const [prioQ, setPrioQ] = useState("");
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
  const prioShown = prioGroups.filter(r => dockMatches({ ...r, name: r.name || s.products.find(p => p.articleId === r.article)?.name }, prioQ, s));
  const Tile = ({ label, value, sub, color, onClick, active }) => <button onClick={onClick} disabled={!onClick} className="qc-elev qc-tile rounded-2xl p-4 text-left" style={{ background: active ? C.accentSoft : C.surface, border: `1px solid ${active ? C.accent : C.line}`, borderLeft: `3px solid ${color || C.line}`, cursor: onClick ? "pointer" : "default" }}><p className="text-xs" style={{ color: C.muted }}>{label}</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: value > 0 && color ? color : C.ink }}>{value}</p>{sub && <p className="text-[11px]" style={{ color: C.muted }}>{sub}</p>}</button>;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1"><h1>Floor now</h1><span className="text-xs" style={{ color: C.muted }}>{f.fresh.length ? f.fresh.map(x => `${x.purpose === "Dock" ? "dock" : "blocked"} sheet ${agoShort(x.at)}`).join(" · ") : "no sheets connected"}</span></div>
      <DeadlineBanner s={s} alerts={f.alerts} now={now} onOpen={a => a.hu && openPallet && openPallet(a.hu)} onMessage={onAssign} />

      <div className="flex items-center mt-2 mb-1.5"><p className="label-sm flex-1" style={{ color: C.muted }}>Docks · {f.dock.length} pallets · {f.skus} SKUs{f.blocking ? ` · ${f.blocking} needed today` : ""}{f.skippable ? ` · ${f.skippable} skippable` : ""}{f.dockLost ? ` · ${f.dockLost} lost` : ""}</p>{hasDock && <button onClick={() => setPage("docks")} className="text-xs inline-flex items-center gap-1" style={{ color: C.accent }}><Ic i={Warehouse} s={13} mr={0} />Dock map →</button>}</div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        <Tile label="Needed today" value={f.blocking} sub={f.blocking ? "blocks picking" : "nothing blocking"} color={f.blocking ? C.bad : C.muted} onClick={hasDock ? () => { setPrioQ(""); setPrioSel(prioSel === "Needed today" ? null : "Needed today"); } : undefined} active={prioSel === "Needed today"} />
        {PRIO_ORDER.map(k => <Tile key={k} label={k} value={f.prio[k]} color={k === "Now needed" || k === "High risk" ? C.bad : k === "High issues" || k === "Late inspection" ? C.warn : C.muted} onClick={hasDock ? () => { setPrioQ(""); setPrioSel(prioSel === k ? null : k); } : undefined} active={prioSel === k} />)}
        <Tile label="Skippable" value={f.skippable} color={C.muted} onClick={hasDock ? () => { setPrioQ(""); setPrioSel(prioSel === "Skippable" ? null : "Skippable"); } : undefined} active={prioSel === "Skippable"} />
      </div>
      {prioSel && <Card style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2 mb-2"><p className="font-medium text-sm flex-1">{prioSel} · {prioRows.length} pallet{prioRows.length === 1 ? "" : "s"} · {prioGroups.length} product{prioGroups.length === 1 ? "" : "s"} · oldest first{prioSel === "Needed today" ? " · flagged on the dock sheet — picking waits for these" : ""}</p><SearchBox value={prioQ} onChange={setPrioQ} placeholder="Search name, article, supplier…" style={{ width: 260 }} inputClass="rounded-lg" size={13} /><button onClick={() => setPrioSel(null)} className="text-xs" style={{ color: C.muted }}>close</button></div>
        {prioRows.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing at this priority.</p> : prioShown.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing matches.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Product", ...(prioSel === "Needed today" ? ["Priority"] : []), "Article", "Location", "Arrived", "Transporter", "History", ""].map(h => <th key={h || "act"} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>{prioShown.map(r => { const prod = s.products.find(p => p.articleId === r.article); const hist = recentProblemsFor(s, prod?.id); const stacked = claimOf(s, r)?.status === "stacked"; return (
            <tr key={r.article || r.hu} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-3">{(r.hu || r.article) && openPallet ? <button onClick={() => openPallet(r.hu || r.article)} className="text-left font-medium" style={{ color: C.ink }}>{r.name || prod?.name || r.article}</button> : <span>{r.name || r.article}{!prod && <span className="text-[11px] ml-1" style={{ color: C.warn }}>no profile</span>}</span>}<span className="ml-1.5 inline-flex align-middle"><ComplaintChip s={s} articleId={r.article} /></span>{r.count > 1 && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>×{r.count} on docks</span>}{r.totalOnDock > r.count && <span className="text-[10px] ml-1.5" style={{ color: C.muted }}>+{r.totalOnDock - r.count} elsewhere</span>}{r.mixedPO && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>⚠ mixed PO</span>}{r.checked > 0 && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>✓ {r.checked === r.count ? "already inspected" : `${r.checked}/${r.count} inspected`}</span>}{r.blocking && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded" style={{ background: C.badBg, color: C.bad }}>needed today</span>}{stacked && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded inline-flex items-center" style={{ background: C.line, color: C.muted }}><Ic i={Layers} s={10} mr={3} />in stack</span>}</td>
              {prioSel === "Needed today" && <td className="py-1.5 pr-3 text-xs">{r.priority || "—"}</td>}<td className="py-1.5 pr-3 font-mono text-xs">{r.article}</td><td className="py-1.5 pr-3">{r.location}</td><td className="py-1.5 pr-3 text-xs">{r.arrived} {r.arrivedTime}</td><td className="py-1.5 pr-3 text-xs">{r.transporter}</td>
              <td className="py-1.5 text-xs" style={{ color: hist.count ? C.bad : C.muted }}>{hist.count ? `${hist.count} rejected · ${hist.problems.slice(0, 2).map(x => x.name).join(", ")}` : "clean"}</td>
              <td className="py-1.5 text-right whitespace-nowrap">{stacked ? <button onClick={() => setClaim(set, r, null)} className="text-xs px-2.5 py-1 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Reachable</button> : <button onClick={() => setClaim(set, r, { userId: user.id, at: nowISO(), status: "stacked" })} className="text-xs px-2.5 py-1 rounded-lg inline-flex items-center" style={{ border: `1px solid ${C.line}` }}><Ic i={Layers} s={12} />In stack</button>}</td>
            </tr>); })}</tbody>
        </table>}
      </Card>}

      <p className="label-sm mt-4 mb-1.5" style={{ color: C.muted }}>Queue</p>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <Tile label="Blocked pallets" value={f.bl.open} sub={f.bl.taken ? `${f.bl.taken} taken` : (f.bl.open ? "waiting for a check" : "queue is clear")} color={f.bl.open ? C.bad : C.muted} onClick={() => setBlSel(blSel === "blocked" ? null : "blocked")} active={blSel === "blocked"} />
        <Tile label="In stack" value={f.stacked} sub={f.stacked ? "on docks and in the blocked queue" : "none buried"} color={C.muted} onClick={() => setBlSel(blSel === "stacked" ? null : "stacked")} active={blSel === "stacked"} />
        <Tile label="Unreported today" value={f.unreported.today} sub={f.unreported.open ? `${f.unreported.open} still open` : "left the dock without a report"} color={f.unreported.today ? C.bad : C.muted} onClick={() => setPage("unreported")} />
      </div>
      {blSel === "blocked" && (() => { const q = blockedQueue(s); const order = { "Not started": 0, "Started": 1, "Completed": 2 }; const list = q.filter(b => b.status !== "Completed" && !b.lost).sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || (a.time || "").localeCompare(b.time || "")); return (
        <Card style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2 mb-1"><p className="font-medium text-sm flex-1">Blocked pallets · {list.length} open{f.bl.taken ? ` · ${f.bl.taken} taken` : ""}</p><button onClick={() => setPage("blocked")} className="text-xs underline" style={{ color: C.accent }}>full page</button><button onClick={() => setBlSel(null)} className="text-xs ml-2" style={{ color: C.muted }}>close</button></div>
          {list.length === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing in the blocked queue.</p> : list.map(b => <QueueRow key={b.key} s={s} set={set} user={user} b={b} onOpen={() => openPallet && openPallet(b.hu || claimKey(b))} />)}
        </Card>); })()}
      {blSel === "stacked" && (
        <Card style={{ marginBottom: 12 }}>
          <div className="flex items-center gap-2 mb-1"><p className="font-medium text-sm flex-1">In stack · {f.stacked} pallet{f.stacked === 1 ? "" : "s"} · not reachable yet</p><button onClick={() => setBlSel(null)} className="text-xs" style={{ color: C.muted }}>close</button></div>
          {f.stacked === 0 ? <p className="text-xs py-3" style={{ color: C.muted }}>Nothing marked in stack.</p> : f.stackedRows.map(r => { const c = claimOf(s, r); const who = c && s.users.find(u => u.id === c.userId); return (
            <div key={claimKey(r)} className="py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <span className="inline-flex items-center" style={{ color: C.muted }}><Ic i={Layers} s={14} mr={0} /></span>
              <button onClick={() => openPallet && openPallet(r.hu || claimKey(r))} className="text-sm flex-1 truncate font-medium text-left">{r.name || r.article}</button>
              <span className="text-xs" style={{ color: C.muted }}>{r.location || "—"}{who ? ` · ${who.name.split(" ")[0]}` : ""}</span>
              <button onClick={() => setClaim(set, r, { userId: user.id, at: nowISO(), status: "taken" })} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Reachable now</button>
            </div>); })}
        </Card>
      )}
      {f.lostOpen > 0 && <p className="text-[11px] mb-3" style={{ color: C.muted }}>{f.lostOpen} lost pallet{f.lostOpen === 1 ? "" : "s"} — see <button onClick={() => setPage("lost")} className="underline" style={{ color: C.accent }}>Lost pallets</button>.</p>}

      <p className="label-sm mt-4 mb-1.5" style={{ color: C.muted }}>Team · {f.doneToday} inspection{f.doneToday === 1 ? "" : "s"} done today</p>
      <Card style={{ marginBottom: 16 }}>
        {f.people.length === 0 ? <p className="text-xs py-2" style={{ color: C.muted }}>No controllers yet.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Controller", "Inspecting", "Done today", "Last activity"].map(h => <th key={h} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
          <tbody>{f.people.map(p => (
            <tr key={p.user.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-2 pr-3"><span className="inline-flex items-center gap-2"><Avatar user={p.user} size={22} />{p.user.name}</span></td>
              <td className="py-2 pr-3 text-xs">{p.inProgress.length ? p.inProgress.map(i => <div key={i.id}>{s.products.find(x => x.id === i.productId)?.name || `pallet ${(i.pallets || [])[0] || ""}`} <span style={{ color: C.muted }}>· {i.status === "PendingReview" ? "awaiting you" : "draft"}</span></div>) : <span style={{ color: C.muted }}>—</span>}</td>
              <td className="py-2 pr-3">{p.doneToday}</td>
              <td className="py-2 text-xs" style={{ color: C.muted }}>{agoShort(p.lastAt)}</td>
            </tr>))}</tbody>
        </table>}
      </Card>

      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <button onClick={() => openTodayInspections ? openTodayInspections() : setPage("inspections")} className="qc-elev qc-tile rounded-2xl p-4 text-left" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${f.doneToday ? C.ok : C.line}` }}><p className="text-xs" style={{ color: C.muted }}>Inspections today</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: f.doneToday ? C.ok : C.ink }}>{f.doneToday}</p><p className="text-[11px]" style={{ color: C.muted }}>by the team</p></button>
        {[["Awaiting Head", s.inspections.filter(i => i.status === "PendingReview").length, "inspections"], ["Open flags", s.flags.filter(f => f.status === "Open").length, "flags"], ["Unread", s.notifications.filter(n => n.userId === user.id && !n.readAt).length, "notifications"], ["Products", s.products.length, "products"]].map(([l, v, pg]) => (
          <button key={l} onClick={() => setPage(pg)} className="qc-elev qc-tile rounded-2xl p-4 text-left" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${v > 0 && l !== "Products" ? C.warn : C.line}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold mt-0.5" style={{ color: v > 0 && l !== "Products" ? C.warn : C.ink }}>{v}</p></button>
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
function TempSpecEditor({ spec, ownerKind, ownerId, existing, s, set, user, onClose }) {
  const [d, setD] = useState({
    min: existing?.min ?? spec.min ?? "",
    max: existing?.max ?? spec.max ?? "",
    unit: existing?.unit || spec.unit || "",
    note: existing?.note || "",
    mode: existing?.expiresAt ? "until" : "open",
    expiresAt: existing?.expiresAt || "",
  });
  const save = () => {
    if (d.mode === "until" && !d.expiresAt) return;
    if (!hasV(d.min) && !hasV(d.max) && !d.note.trim()) return;
    const row = {
      id: existing?.id || uid(),
      specId: spec.id,
      specName: spec.name,
      ownerKind,
      ownerId,
      min: hasV(d.min) ? d.min : null,
      max: hasV(d.max) ? d.max : null,
      unit: (d.unit || "").trim(),
      note: d.note.trim(),
      expiresAt: d.mode === "until" ? d.expiresAt : null,
      createdAt: existing?.createdAt || nowISO(),
      createdBy: user.id,
      endedAt: null,
      endedHow: null,
      endedBy: null,
    };
    set(x => ({ ...x, tempSpecs: upsertTempSpec(x.tempSpecs, row) }));
    onClose();
  };
  const clear = () => {
    if (existing) set(x => ({ ...x, tempSpecs: clearTempSpec(x.tempSpecs, existing.id, user.id) }));
    onClose();
  };
  return (
    <div className="mt-2 mb-1 rounded-xl px-3 py-2.5" style={{ background: C.warnBg, border: `1px solid ${C.line}` }}>
      <p className="text-[11px] font-semibold mb-2" style={{ color: C.warn }}>Temporary spec · {spec.name}</p>
      <p className="text-[11px] mb-2" style={{ color: C.muted }}>Permanent stays {specLabel(spec)}. Controllers see the temporary limits{d.note.trim() ? " and the note" : ""} until it ends.</p>
      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        <input type="number" value={d.min} onChange={e => setD(x => ({ ...x, min: e.target.value }))} placeholder="min" className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
        <span className="text-xs" style={{ color: C.muted }}>–</span>
        <input type="number" value={d.max} onChange={e => setD(x => ({ ...x, max: e.target.value }))} placeholder="max" className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
        <input value={d.unit} onChange={e => setD(x => ({ ...x, unit: e.target.value }))} placeholder="unit" className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
      </div>
      <textarea value={d.note} onChange={e => setD(x => ({ ...x, note: e.target.value }))} rows={3} placeholder="What changed, and what not to reject on…" className="w-full text-sm mb-2" style={{ resize: "vertical" }} />
      <div className="flex gap-1.5 mb-2 flex-wrap items-center">
        {[["open", "Until I change it"], ["until", "Until a date"]].map(([k, l]) => <button key={k} type="button" onClick={() => setD(x => ({ ...x, mode: k }))} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: d.mode === k ? C.ink : C.surface, color: d.mode === k ? C.onDark : C.ink, border: `1px solid ${C.line}` }}>{l}</button>)}
        {d.mode === "until" && <input type="date" value={d.expiresAt} onChange={e => setD(x => ({ ...x, expiresAt: e.target.value }))} className="text-sm" />}
      </div>
      <div className="flex gap-2 flex-wrap">
        <Primary small onClick={save}>{existing ? "Update" : "Save temporary"}</Primary>
        {existing && <Ghost onClick={clear}>End it now</Ghost>}
        <button type="button" onClick={onClose} className="text-xs" style={{ color: C.muted }}>Cancel</button>
      </div>
    </div>
  );
}

function SpecForm({ specs, inherited, onAdd, onUpdate, onRemove, hint, excluded, onExclude, onRestore, sctx, set, user, ownerKind, ownerId }) {
  const blank = { name: "", unit: "", kind: "min", min: "", max: "", basis: "piece" };
  const [sp, setSp] = useState(blank);
  const [editingId, setEditingId] = useState(null);
  const [edit, setEdit] = useState(null);
  const reg = sctx ? specRegistry(sctx) : []; const near = sctx ? nearSpecName(sctx, sp.name) : null;
  const knownNames = new Set([...(specs || []), ...(inherited || [])].filter(q => q.id !== editingId).map(q => `${(q.name || "").toLowerCase()}|${specBasis(q)}`));
  const suggestions = editingId ? [] : reg.filter(e => !knownNames.has(`${e.name.toLowerCase()}|${sp.basis}`) && (!sp.name.trim() || e.name.toLowerCase().includes(sp.name.trim().toLowerCase()))).slice(0, 8);
  const resetForm = () => { setSp(blank); setEditingId(null); };
  const startEdit = q => {
    setSp({ name: q.name || "", unit: q.unit || "", kind: specFormKind(q), min: hasV(q.min) ? q.min : "", max: hasV(q.max) ? q.max : "", basis: specBasis(q) });
    setEditingId(q.id);
    setEdit(null);
  };
  const save = () => {
    const name = sctx ? canonicalSpecName(sctx, sp.name) : sp.name.trim();
    const fields = specFieldsFromForm(sp, name);
    if (!fields) return;
    if (editingId && onUpdate) { onUpdate(editingId, fields); resetForm(); return; }
    onAdd({ id: uid(), ...fields });
    resetForm();
  };
  const productId = ownerKind === "product" ? ownerId : null;
  const tempOf = q => sctx ? activeTempForSpec(sctx.tempSpecs, q.id, productId) : null;
  const canTemp = !!(set && user && ownerKind && ownerId);
  const Row = ({ q, inheritedRow }) => {
    const t = tempOf(q);
    const open = edit && edit.spec.id === q.id && edit.inherited === !!inheritedRow;
    return (
      <div style={{ borderTop: `1px solid ${C.line}` }}>
        <div className="flex items-baseline gap-2 text-sm py-1.5" style={{ opacity: inheritedRow && !t ? 0.65 : 1, background: !inheritedRow && editingId === q.id ? C.accentSoft : "transparent" }}>
          <span className="flex-1 min-w-0">{q.name}{q.origin === "sheet" && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full align-middle" style={{ background: C.accentSoft, color: C.accent }} title={`from the commercial spec sheet — cell: “${q.sheetRaw || ""}”${q.note ? ` · ${q.note}` : ""}. Edit it to take it over — the sheet then reports a conflict instead of overwriting.`}>from sheet</span>}</span>
          <SpecValue spec={q} temp={t} colors={C} extra={<span style={{ color: C.muted }}>{basisTag(q)}{inheritedRow && q.source ? ` · ${q.source}` : ""}</span>} />
          {!inheritedRow && onUpdate && <button type="button" onClick={() => editingId === q.id ? resetForm() : startEdit(q)} className="text-xs px-1.5" style={{ color: editingId === q.id ? C.ink : C.accent }}>{editingId === q.id ? "editing" : "edit"}</button>}
          {canTemp && <button type="button" onClick={() => { if (open) setEdit(null); else { setEdit({ spec: q, inherited: !!inheritedRow }); resetForm(); } }} className="text-xs px-1.5" style={{ color: t ? C.warn : C.accent }}>{t ? "edit temp" : "temp"}</button>}
          {inheritedRow && onExclude && <button type="button" onClick={() => onExclude(q.name)} className="text-xs px-1" style={{ color: C.muted }} title="don't inherit this specification on this product">exclude</button>}
          {!inheritedRow && <button type="button" onClick={() => onRemove(q.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button>}
        </div>
        {t && t.note && !open && <p className="text-[11px] pb-1.5 pl-0" style={{ color: C.bad }}>{t.note}</p>}
        {open && <TempSpecEditor spec={q} ownerKind={inheritedRow && ownerKind === "product" ? "product" : ownerKind} ownerId={ownerId} existing={t && t.ownerKind === (inheritedRow && ownerKind === "product" ? "product" : ownerKind) && t.ownerId === ownerId ? t : (inheritedRow ? null : t)} s={sctx} set={set} user={user} onClose={() => setEdit(null)} />}
      </div>
    );
  };
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
        {sp.kind !== "min" && <input type="number" value={sp.max} onChange={e => setSp(x => ({ ...x, max: e.target.value }))} onKeyDown={e => e.key === "Enter" && save()} placeholder={sp.kind === "range" ? "to" : "max"} className="w-16 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
        <Primary small onClick={save}>{editingId ? "Save" : "+"}</Primary>
        {editingId && <button type="button" onClick={resetForm} className="text-xs" style={{ color: C.muted }}>Cancel</button>}
      </div>
      {specs.length === 0 && (!inherited || inherited.length === 0) && <p className="text-xs" style={{ color: C.muted }}>No specifications.</p>}
      {excluded && excluded.length > 0 && <div className="mt-2"><p className="label-sm mb-1">not inherited on this product</p>{excluded.map(n => <div key={n} className="flex items-center gap-2 text-xs py-1" style={{ color: C.muted }}><span className="flex-1 line-through">{n}</span><button onClick={() => onRestore(n)} className="text-xs" style={{ color: C.accent }}>restore</button></div>)}</div>}
      {specs.map(q => <Row key={q.id} q={q} />)}
      {inherited && inherited.length > 0 && <>
        <p className="label-sm mt-3 mb-1" style={{ color: C.muted }}>inherited</p>
        {inherited.map(q => <Row key={q.id} q={q} inheritedRow />)}
      </>}
    </>
  );
}

function TempSpecsPage({ s, set, user, openProduct, openCategory }) {
  const [tab, setTab] = useState("active");
  useEffect(() => {
    const cur = s.tempSpecs || [];
    const next = closeExpiredTempSpecs(cur);
    if (next !== cur) set(x => ({ ...x, tempSpecs: closeExpiredTempSpecs(x.tempSpecs || []) }));
  }, [s.tempSpecs]);
  const list = s.tempSpecs || [];
  const active = list.filter(t => !t.endedAt).sort((a, b) => (a.expiresAt || "9999").localeCompare(b.expiresAt || "9999") || (b.createdAt || "").localeCompare(a.createdAt || ""));
  const ended = list.filter(t => t.endedAt).sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""));
  const rows = tab === "active" ? active : ended;
  const who = id => s.users.find(u => u.id === id)?.name.split(" ")[0];
  const openOwner = t => {
    if (t.ownerKind === "product" && openProduct) openProduct(t.ownerId);
    if (t.ownerKind === "category" && openCategory) openCategory(t.ownerId);
  };
  const endHow = t => t.endedHow === "expired" ? "expired on its date" : t.endedHow === "replaced" ? "replaced" : t.endedHow === "cleared" ? `ended${who(t.endedBy) ? ` by ${who(t.endedBy)}` : ""}` : "ended";
  return (
    <div>
      <h1 className="mb-1">Temporary specs</h1>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 640 }}>Overrides the Head pins on a specification — a different min/max and a note. Dated ones drop off the floor by themselves; open-ended ones stay until someone ends them here or on the spec.</p>
      <div className="inline-flex rounded-xl overflow-hidden mb-4" style={{ border: `1px solid ${C.line}` }}>
        {[["active", "Active", active.length], ["ended", "Expired", ended.length]].map(([id, label, n]) => (
          <button key={id} onClick={() => setTab(id)} className="text-sm px-3.5 py-1.5" style={{ background: tab === id ? C.ink : "transparent", color: tab === id ? C.onDark : C.ink }}>{label}{n ? ` · ${n}` : ""}</button>
        ))}
      </div>
      {rows.length === 0 ? <Card><Empty icon="📏" title={tab === "active" ? "No active temporary specs" : "Nothing has expired yet"} hint={tab === "active" ? "Add one from a product or category specification — the temp button on the row." : "Dated overrides land here after their day, and anything ended by hand stays here too."} /></Card> : (
        <Card>
          {rows.map(t => (
            <div key={t.id} className="py-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.specName || "Specification"} · {specLabel(t)}</p>
                  <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>
                    <button type="button" onClick={() => openOwner(t)} className="underline" style={{ color: C.accent }}>{tempOwnerLabel(s, t)}</button>
                    {t.ownerKind === "category" ? " · whole category" : " · this product only"}
                    {" · "}{tab === "active" ? tempUntilLabel(t) : endHow(t)}
                    {who(t.createdBy) ? ` · set by ${who(t.createdBy)}` : ""}
                  </p>
                  {t.note && <p className="text-[13px] mt-1.5" style={{ color: C.ink, whiteSpace: "pre-wrap" }}>{t.note}</p>}
                </div>
                {tab === "active" && <Ghost onClick={() => set(x => ({ ...x, tempSpecs: clearTempSpec(x.tempSpecs, t.id, user.id) }))}>End it</Ghost>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function ShiftUpdateBanner({ s, user, onOpen }) {
  const pulse = briefingUnseen(s, user.id);
  const seen = pulse.total === 0;
  const bits = [
    (pulse.rejs.length + pulse.xrejs.length) && `${pulse.rejs.length + pulse.xrejs.length} new rejection${pulse.rejs.length + pulse.xrejs.length === 1 ? "" : "s"}`,
    pulse.complaints.length && `${pulse.complaints.length} new complaint${pulse.complaints.length === 1 ? "" : "s"}`,
    pulse.anns.length && `${pulse.anns.length} note${pulse.anns.length === 1 ? "" : "s"} from the Head`,
  ].filter(Boolean);
  return (
    <div className="relative mb-4">
      {!seen && <span aria-hidden className="qc-led-halo" />}
      <button type="button" onClick={onOpen} className="qc-elev qc-tile w-full text-left rounded-2xl px-3.5 py-3 flex items-center gap-3 relative" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${seen ? C.line : C.accent}`, zIndex: 1 }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.accentSoft, color: C.accent }}><Ic i={BookOpen} s={18} mr={0} /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold">Shift update</span>
            {!seen && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: C.accentSoft, color: C.accent }}>open first</span>}
          </span>
          <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: C.muted }}>{bits.length ? bits.join(" · ") : "Nothing live — still worth a look"}</span>
        </span>
        <Ic i={ChevronRight} s={16} mr={0} style={{ color: C.muted }} />
      </button>
    </div>
  );
}

// The controller's desk: a worklist of what is standing on the dock and why it matters now, with the pallet one click
// away (spec, history, announcements) — the walk out and the inspection itself happen on the phone.
const URGENCY = { breached: 0, warning: 1, blocking: 2, "Now needed": 3, "High risk": 4, "High issues": 5, "Late inspection": 6, "Inspection due": 7, none: 8, skippable: 9 };
const urgencyTone = u => u <= 2 ? "bad" : u <= 3 ? "bad" : u <= 6 ? "warn" : u === 7 ? "info" : "muted";
const hoursOnDock = (r, now) => { if (!r.arrived) return null; const t = new Date(`${r.arrived}T${r.arrivedTime || "00:00"}:00`).getTime(); return isNaN(t) ? null : (now - t) / 3600000; };
const fmtHours = h => h == null ? "—" : h < 1 ? `${Math.max(0, Math.round(h * 60))} min` : h < 48 ? `${Math.round(h)} h` : `${Math.floor(h / 24)} d`;
function ControllerDashboard({ s, user, set, setPage, setOpenId, openProduct, openPallet }) {
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const [filter, setFilter] = useState("todo"); const [q, setQ] = useState(""); const [annOpen, setAnnOpen] = useState(null); const [blOpen, setBlOpen] = useState(false);
  const f = floorStats(s, now); const st = settingsOf(s);
  const hasDock = (s.integrations || []).some(i => i.purpose === "Dock" && i.rows?.length);
  const dashAnns = s.announcements.filter(a => a.showOnDashboard && annActive(a)).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const openAnn = a => (a.productId && openProduct) ? openProduct(a.productId) : setAnnOpen(a);
  const pulse = briefingUnseen(s, user.id); const pulseN = pulse.total;
  // ── One row per pallet, then grouped per product: the controller walks to a product, not to a SSCC.
  const alertsByHu = Object.fromEntries(f.alerts.map(a => [a.hu, a]));
  const pallets = f.dock.map(r => {
    const done = completedInspectionFor(s, r.hu); const draft = (s.inspections || []).find(i => ["Draft", "PendingReview"].includes(i.status) && (i.pallets || []).some(h => samePallet(h, r.hu)));
    const alert = alertsByHu[r.hu] || null; const claim = claimOf(s, r);
    const u = done ? 99 : alert ? URGENCY[alert.level] : r.blocking ? URGENCY.blocking : r.priority && URGENCY[r.priority] != null ? URGENCY[r.priority] : r.skippable ? URGENCY.skippable : URGENCY.none;
    return { ...r, done, draft, alert, claim, u, hours: hoursOnDock(r, now) };
  });
  const groups = (() => { const m = new Map(); pallets.forEach(p => { const k = p.article || p.hu; if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
    return [...m.values()].map(rows => { const product = s.products.find(p => p.articleId === rows[0].article); const open = rows.filter(r => !r.done);
      const u = Math.min(...rows.map(r => r.u)); const lead = rows.find(r => r.u === u) || rows[0];
      const locs = [...new Set(rows.map(r => r.location).filter(Boolean))]; const pos = [...new Set(rows.map(r => (r.po || "").trim()).filter(Boolean))];
      const ext = extRejectionLine(s, rows[0].article, now); const risky = rows.some(r => r.alert?.risky) || !!ext;
      const why = u === 0 ? "Rejection window expired" : u === 1 ? `Rejection window closes in ${fmtLeft(lead.alert.deadlineAt - now)}` : u === 2 ? "Needed today — blocks picking" : u <= 7 ? lead.priority : u === 9 ? "Skippable" : "";
      const whyPlus = ext ? `rejected ${ext.count}× in ${ext.span}` : "";
      return { key: rows[0].article || rows[0].hu, article: rows[0].article, name: rows[0].name || product?.name || rows[0].article, product, rows, open, u, lead, locs, pos, mixedPO: pos.length > 1, hours: Math.max(...rows.map(r => r.hours ?? -1)), why, whyPlus, risky, draft: rows.find(r => r.draft)?.draft || null, taken: rows.map(r => r.claim).find(c => c?.status === "taken") || null, earliest: rows.map(r => `${r.arrived} ${r.arrivedTime || ""}`).sort()[0] };
    }).sort((a, b) => a.u - b.u || (b.hours - a.hours)); })();
  const counts = { todo: groups.filter(g => g.open.length && g.u < 9).length, needed: groups.filter(g => g.u <= 2 && g.open.length).length, risky: groups.filter(g => g.risky && g.open.length).length, skippable: groups.filter(g => g.u === 9 && g.open.length).length, done: groups.filter(g => g.rows.some(r => r.done)).length, all: groups.length };
  const shown = groups.filter(g => filter === "all" ? true : filter === "done" ? g.rows.some(r => r.done) : filter === "needed" ? g.u <= 2 && g.open.length : filter === "risky" ? g.risky && g.open.length : filter === "skippable" ? g.u === 9 && g.open.length : filter === "deadline" ? g.rows.some(r => r.alert && !r.done) : PRIO_ORDER.includes(filter) ? g.rows.some(r => r.priority === filter && !r.done) : g.open.length && g.u < 9)
    .filter(g => g.rows.some(r => dockMatches({ ...r, name: g.name, locations: g.locs.join(" ") }, q, s)));
  const Chip = ({ id, label, n, tone }) => <button type="button" onClick={() => setFilter(id)} className="text-xs font-medium px-3 rounded-full inline-flex items-center gap-1.5" style={{ height: 30, background: filter === id ? C.ink : C.surface, color: filter === id ? C.onDark : C.ink, border: `1px solid ${filter === id ? C.ink : C.line}` }}>{label}<span className="font-semibold" style={{ color: filter === id ? C.onDark : tone && n ? tone : C.muted, fontVariantNumeric: "tabular-nums" }}>{n}</span></button>;
  const toneCol = t => t === "bad" ? C.bad : t === "warn" ? C.warn : t === "info" ? C.accent : C.muted;
  const myDone = doneTodayByUser(s, user.id, now); const myToday = (s.inspections || []).filter(i => i.controllerId === user.id && i.status === "Completed" && i.completedAt && dayLabel(i.completedAt) === "today");
  const myRejected = myToday.filter(i => i.result === "Rejected").length;
  const blockedOpen = blockedQueue(s).filter(b => b.status !== "Completed" && !b.lost).sort((a, b) => ({ "Not started": 0, "Started": 1 }[a.status] ?? 9) - ({ "Not started": 0, "Started": 1 }[b.status] ?? 9));
  const RowStatus = ({ g }) => { const done = g.rows.filter(r => r.done).length;
    if (done === g.rows.length) return <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: C.ok }}><Ic i={Check} s={13} mr={0} />inspected</span>;
    if (g.draft) { const who = s.users.find(u => u.id === g.draft.controllerId); return <span className="text-xs font-medium" style={{ color: C.accent }}>in progress{who ? ` · ${who.name.split(" ")[0]}` : ""}</span>; }
    if (g.taken) { const who = s.users.find(u => u.id === g.taken.userId); return <span className="text-xs" style={{ color: C.muted }}>taken{who ? ` by ${who.name.split(" ")[0]}` : ""}</span>; }
    if (done) return <span className="text-xs" style={{ color: C.muted }}>{done} of {g.rows.length} inspected</span>;
    return <span className="text-xs" style={{ color: C.muted }}>not yet</span>; };
  const worklist = useRef(null);
  const pick = id => { setFilter(f => f === id ? "todo" : id); setQ(""); setTimeout(() => worklist.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); };
  const Tile = ({ label, value, sub, color, onClick, active, accent }) => <button type="button" onClick={onClick} disabled={!onClick} className="qc-elev qc-tile rounded-2xl p-4 text-left" style={{ background: active ? C.accentSoft : C.surface, border: `1px solid ${active ? C.accent : C.line}`, borderLeft: `4px solid ${accent || (value ? color : C.line)}`, boxShadow: lift(), cursor: onClick ? "pointer" : "default" }}><p className="text-xs" style={{ color: C.muted }}>{label}</p><p className="text-2xl font-semibold leading-tight mt-0.5" style={{ color: value ? color : C.muted, fontVariantNumeric: "tabular-nums" }}>{value}</p>{sub && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</p>}</button>;
  const filterLabel = { todo: "To inspect", needed: "Needed today", risky: "Rejected recently", skippable: "Skippable", done: "Inspected", all: "All", deadline: "Rejection window closing" }[filter] || filter;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap"><h1>Hi, {user.name.split(" ")[0]}</h1><span className="text-xs" style={{ color: C.muted }}>{new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}{f.fresh.length ? ` · ${f.fresh.map(x => `${x.purpose === "Dock" ? "dock" : "blocked"} sheet ${agoShort(x.at)}`).join(" · ")}` : " · no dock sheet yet"}</span></div>
      <DeadlineBanner s={s} alerts={f.alerts} now={now} onOpen={a => a.hu && openPallet && openPallet(a.hu)} />
      {/* ── Docks: the same priority tiles the Head sees; a tap filters the worklist below ── */}
      <div className="flex items-center mt-1 mb-1.5"><p className="label-sm flex-1" style={{ color: C.muted }}>Docks · {f.dock.length} pallets · {f.skus} products{f.blocking ? ` · ${f.blocking} needed today` : ""}{f.skippable ? ` · ${f.skippable} skippable` : ""}</p><button type="button" onClick={() => setPage("docks")} className="text-xs font-medium inline-flex items-center" style={{ color: C.accent }}><Ic i={Warehouse} s={13} />Dock map →</button></div>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
        <Tile label="Needed today" value={f.blocking} sub={f.blocking ? "blocks picking" : "nothing blocking"} color={C.bad} onClick={hasDock ? () => pick("needed") : undefined} active={filter === "needed"} />
        {PRIO_ORDER.map(k => <Tile key={k} label={k} value={f.prio[k]} color={k === "Now needed" || k === "High risk" ? C.bad : k === "High issues" || k === "Late inspection" ? C.warn : C.accent} onClick={hasDock ? () => pick(k) : undefined} active={filter === k} />)}
        <Tile label="Skippable" value={f.skippable} color={C.muted} onClick={hasDock ? () => pick("skippable") : undefined} active={filter === "skippable"} />
      </div>
      {/* ── Queue + me ── */}
      <p className="label-sm mt-4 mb-1.5" style={{ color: C.muted }}>Queue</p>
      <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <Tile label="Blocked pallets" value={f.bl.open} sub={f.bl.taken ? `${f.bl.taken} taken` : f.bl.open ? "waiting for a check" : "queue is clear"} color={C.bad} onClick={() => setBlOpen(o => !o)} active={blOpen} />
        <Tile label="In stack" value={f.stacked} sub={f.stacked ? "buried behind other pallets" : "none buried"} color={C.warn} onClick={f.stacked ? () => setPage("docks") : undefined} />
        <Tile label="Rejection window" value={f.alerts.length} sub={f.alerts.length ? `${f.alerts.filter(a => a.level === "breached").length} expired` : "nothing closing"} color={C.bad} onClick={f.alerts.length ? () => pick("deadline") : undefined} active={filter === "deadline"} />
        <Tile label="Unreported today" value={f.unreported.today} sub={f.unreported.today ? "left the dock without a report" : "all reported"} color={C.warn} onClick={() => setPage("unreported")} />
        <Tile label="Done today" value={f.doneToday} sub={`${myDone} by you${myRejected ? ` · ${myRejected} rejected` : ""}`} color={C.ok} onClick={() => { setOpenId(null); setPage("inspections"); }} />
      </div>
      {blOpen && <Card style={{ marginBottom: 12, borderLeft: `4px solid ${C.bad}` }}>
        <div className="flex items-center gap-2 mb-1"><p className="font-semibold text-sm flex-1">Blocked pallets · {blockedOpen.length} waiting</p><button type="button" onClick={() => setBlOpen(false)} className="text-xs" style={{ color: C.muted }}>close</button></div>
        <p className="text-[12px] mb-2" style={{ color: C.muted }}>Picking is waiting for these. Take one to claim it, or mark it in stack if it can't be reached yet.</p>
        {blockedOpen.length === 0 ? <p className="text-sm py-3" style={{ color: C.muted }}>Nothing in the blocked queue.</p> : <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}>{blockedOpen.map(b => <QueueRow key={b.key} tile s={s} set={set} user={user} b={b} onOpen={() => openPallet && openPallet(b.hu || claimKey(b))} />)}</div>}
      </Card>}
      {/* ── What the Head sent + who is where ── */}
      <div className="grid gap-3 mb-3 mt-4" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.6fr) minmax(0,1.2fr)" }}>
        <button type="button" onClick={() => setPage("briefing")} className="qc-elev qc-tile text-left rounded-2xl p-4 flex items-start gap-3" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${pulseN ? C.accent : C.line}`, boxShadow: lift() }}>
          <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.accentSoft, color: C.accent }}><Ic i={BookOpen} s={17} mr={0} /></span>
          <span className="min-w-0 flex-1"><span className="text-xs block" style={{ color: C.muted }}>Shift update</span><span className="text-2xl font-semibold block leading-tight" style={{ color: pulseN ? C.accent : C.muted }}>{pulseN || "✓"}</span><span className="text-[11px] block mt-0.5" style={{ color: C.muted }}>{pulseN ? [pulse.rejs.length + pulse.xrejs.length ? `${pulse.rejs.length + pulse.xrejs.length} rejections` : "", pulse.complaints.length ? `${pulse.complaints.length} complaints` : "", pulse.anns.length ? `${pulse.anns.length} notes` : ""].filter(Boolean).join(" · ") : "you're up to date"}</span></span>
        </button>
        <div className="qc-elev rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: lift() }}>
          <p className="text-xs mb-1 flex items-center" style={{ color: C.muted }}><Ic i={Megaphone} s={13} />From the Head</p>
          {dashAnns.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>No announcements right now.</p> : dashAnns.slice(0, 2).map((a, i) => <button key={a.id} type="button" onClick={() => openAnn(a)} className="w-full text-left py-1" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}><span className="text-sm font-medium block leading-tight truncate">{a.title}</span>{a.body && <span className="text-[11px] block truncate" style={{ color: C.muted }}>{a.body}</span>}</button>)}
          {dashAnns.length > 2 && <button type="button" onClick={() => setPage("announcements")} className="text-[11px] mt-1" style={{ color: C.accent }}>+{dashAnns.length - 2} more</button>}
        </div>
        <div className="qc-elev rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: lift() }}>
          <p className="text-xs mb-1 flex items-center" style={{ color: C.muted }}><Ic i={Users} s={13} />On the floor</p>
          {f.people.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>Nobody yet.</p> : f.people.slice(0, 4).map(p => <div key={p.user.id} className="flex items-center gap-2 py-1 text-sm"><Avatar user={p.user} size={20} /><span className="flex-1 min-w-0 truncate">{p.user.id === user.id ? "You" : p.user.name.split(" ")[0]}{p.inProgress.length ? <span style={{ color: C.muted }}> · {s.products.find(x => x.id === p.inProgress[0].productId)?.name || "inspecting"}</span> : p.taken.length ? <span style={{ color: C.muted }}> · at {p.taken[0].location || "a pallet"}</span> : null}</span><span className="text-[11px] whitespace-nowrap" style={{ color: C.muted }}>{p.doneToday} done · {agoShort(p.lastAt)}</span></div>)}
        </div>
      </div>
      {/* ── Worklist ── */}
      <div ref={worklist} className="scroll-mt-4">
        <Card style={{ marginTop: 16 }}>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="font-semibold flex-1">On the dock <span className="font-normal text-xs ml-1" style={{ color: C.muted }}>{filter === "todo" ? "most urgent first" : filterLabel}{PRIO_ORDER.includes(filter) || ["needed", "deadline", "skippable"].includes(filter) ? <button type="button" onClick={() => setFilter("todo")} className="ml-2 underline" style={{ color: C.accent }}>show everything</button> : null}</span></p>
            <SearchBox value={q} onChange={setQ} placeholder="product, article, location, PO…" />
          </div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            <Chip id="todo" label="To inspect" n={counts.todo} tone={C.ink} />
            <Chip id="needed" label="Needed today" n={counts.needed} tone={C.bad} />
            <Chip id="risky" label="Rejected recently" n={counts.risky} tone={C.warn} />
            <Chip id="skippable" label="Skippable" n={counts.skippable} />
            <Chip id="done" label="Inspected" n={counts.done} tone={C.ok} />
            <Chip id="all" label="All" n={counts.all} />
          </div>
          {!hasDock ? <Empty icon={Truck} title="No dock sheet yet" hint="When the Head connects the dock sheet, every pallet standing on the dock shows up here, most urgent first." />
          : shown.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: C.muted }}>{q ? "Nothing matches." : filter === "todo" ? "Nothing left to inspect — the dock is clear." : "Nothing here."}</p>
          : <div>
            <div className="grid items-center px-3 pb-1.5 text-xs" style={{ gridTemplateColumns: "minmax(0, 2.4fr) 64px 120px 70px minmax(0, 1.4fr) minmax(0, 1fr) 64px", color: C.muted }}>{["Product", "Pallets", "Where", "On dock", "Priority", "Status", ""].map(h => <span key={h}>{h}</span>)}</div>
            <div className="flex flex-col gap-1.5">{shown.map(g => { const open = g.open.length > 0; const stt = open ? dockStatus(g.lead) : null; const col = stt ? dockStatusColor(stt) : C.line; const label = stt ? (DOCK_STATUS.find(d => d[0] === stt)?.[1] || stt) : "";
              const extra = !open ? "" : g.u === 0 ? "rejection window expired" : g.u === 1 ? `window closes in ${fmtLeft(g.lead.alert.deadlineAt - now)}` : g.u === 9 ? "skippable" : ""; return (
              <div key={g.key} className="qc-tile grid items-center rounded-xl px-3 py-2" style={{ gridTemplateColumns: "minmax(0, 2.4fr) 64px 120px 70px minmax(0, 1.4fr) minmax(0, 1fr) 64px", background: C.bg, border: `1px solid ${C.line}`, borderLeft: `3px solid ${open ? col : C.ok}`, opacity: open ? 1 : .7 }}>
                <div className="min-w-0 pr-3">
                  <button type="button" onClick={() => openPallet && openPallet(g.lead.hu || g.article)} className="text-left text-sm font-medium leading-tight truncate block max-w-full">{g.name}</button>
                  <span className="block text-[11px] truncate" style={{ color: C.muted }}><span className="font-mono">{g.article}</span>{g.product?.isBio ? " · bio" : ""}{g.mixedPO ? <span className="ml-1.5" style={{ color: C.warn }}>· {g.pos.length} POs</span> : g.pos[0] ? <span className="font-mono"> · PO {g.pos[0]}</span> : ""}</span>
                </div>
                <span className="text-sm whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>{g.rows.length}{g.rows.length > 1 && open && g.open.length < g.rows.length ? <span className="text-[11px]" style={{ color: C.muted }}> · {g.open.length} left</span> : null}</span>
                <span className="text-xs truncate pr-2">{g.locs.length <= 2 ? g.locs.join(", ") : `${g.locs[0]} +${g.locs.length - 1}`}</span>
                <span className="text-xs whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums", color: g.hours > st.rejectionWindowHours ? C.bad : C.ink }}>{fmtHours(g.hours)}</span>
                <span className="min-w-0 pr-2">{open && label && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: col + "22", color: dockStatusText(stt) }}>{label}</span>}{(extra || g.whyPlus) && <span className="block text-[11px] mt-0.5 leading-snug" style={{ color: g.u <= 1 ? C.bad : C.warn }}>{[extra, g.whyPlus].filter(Boolean).join(" · ")}</span>}</span>
                <span className="min-w-0 pr-2"><RowStatus g={g} /></span>
                <span className="text-right"><button type="button" onClick={() => openPallet && openPallet(g.lead.hu || g.article)} className="text-xs font-semibold px-2.5 rounded-lg inline-flex items-center" style={{ height: 28, background: C.accentSoft, color: C.accent }}>Open</button></span>
              </div>); })}</div>
          </div>}
          <p className="text-[11px] mt-3" style={{ color: C.muted }}>Open a product to see its spec, photos and recent history before walking out. The inspection itself is started on the phone at the pallet.</p>
        </Card>
      </div>
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
        <AnnounceFileList announcement={a} colors={C} />
        <p className="text-xs mb-4" style={{ color: C.muted }}>{fmtTime(a.createdAt)}{a.validTo && ` · on the dashboard until ${a.validTo}`}</p>
        <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={{ background: C.ink, color: C.onDark }}>Close</button>
      </div>
    </div>
  );
}

const hhmm = iso => { const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };

function BriefingPage({ s, set, user, go }) {
  const unseen = briefingUnseen(s, user.id);
  const [tab, setTab] = useState(() => briefingDefaultTab(s, user.id));
  // Snapshot of the unseen cards for this tab: marking one read keeps it on screen (ticked) until the tab changes.
  const [cards, setCards] = useState(() => briefingTabDeck(s, briefingDefaultTab(s, user.id), user.id));
  useEffect(() => { setCards(briefingTabDeck(s, tab, user.id)); }, [tab]);
  const n = cards.length;
  const seen = seenFingerprints(s, user.id);
  // Deck mode: one card at a time on a dimmed backdrop, like flipping through on the phone.
  const [deck, setDeck] = useState(null); // null | { ix, dir }
  const openDeck = (ix = 0) => setDeck({ ix: Math.max(0, Math.min(n - 1, ix)), dir: 0 });
  const stepDeck = d => setDeck(x => { if (!x) return x; const ix = x.ix + d; return ix < 0 || ix >= n ? x : { ix, dir: d }; });
  useEffect(() => { if (!deck) return; const onKey = e => { if (e.key === "Escape") setDeck(null); if (e.key === "ArrowRight") stepDeck(1); if (e.key === "ArrowLeft") stepDeck(-1); }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [deck, n]);
  useEffect(() => { if (!deck) return; const c = cards[deck.ix]; const fp = briefingFp(c); if (!fp || seen.has(fp)) return; const tm = setTimeout(() => set(x => markBriefingSeen(x, user.id, fp, nowISO(), liveBriefingFps(x))), 500); return () => clearTimeout(tm); }, [deck?.ix, cards]);
  useEffect(() => { if (deck && n === 0) setDeck(null); }, [n]);
  const markOne = c => { const fp = briefingFp(c); if (!fp || seen.has(fp)) return; set(x => markBriefingSeen(x, user.id, fp, nowISO(), liveBriefingFps(x))); };
  const markAll = () => { const fps = cards.map(briefingFp).filter(fp => fp && !seen.has(fp)); if (!fps.length) return; set(x => fps.reduce((acc, fp) => markBriefingSeen(acc, user.id, fp, nowISO(), liveBriefingFps(acc)), x)); };
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return null; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const who = id => s.users.find(u => u.id === id)?.name.split(" ")[0];
  const Cta = ({ children, onClick, ghost }) => <button type="button" data-story-cta onClick={onClick} className="px-3 py-2 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1" style={ghost ? { background: "transparent", color: C.ink, border: `1px solid ${C.line}` } : { background: C.ink, color: C.onDark }}>{children}</button>;
  const edge = c => c.kind === "rej" || c.kind === "xrej" ? C.bad : c.kind === "complaint" ? C.bad : c.kind === "ann" && c.a.isBlocking ? C.bad : C.accent;
  const Hero = ({ product, name, vertical }) => {
    const photo = product && asPhotoList(product.photos)[0];
    return (
      <div className="relative flex-shrink-0 overflow-hidden flex items-center justify-center" style={vertical ? { height: 200, background: PHOTO_BG } : { width: 120, background: PHOTO_BG }}>
        {photo && <img src={thumbSrc(photo)} loading="lazy" decoding="async" alt="" className="absolute inset-0 w-full h-full object-contain p-4" onError={e => { e.currentTarget.style.display = "none"; const el = e.currentTarget.parentElement?.querySelector("[data-letter]"); if (el) el.style.opacity = "1"; }} />}
        <span data-letter className={vertical ? "text-[56px] font-semibold leading-none" : "text-[40px] font-semibold leading-none"} style={{ color: "#8A9278", opacity: photo ? 0 : .55 }}>{(name || "?")[0]}</span>
      </div>
    );
  };
  const factsOf = p => {
    if (!p) return [];
    return [p.articleId && `ID ${p.articleId}`, catPath(p.categoryId), p.piecesPerCu && `${p.piecesPerCu} pcs / CU`, p.weightPerCu && `${p.weightPerCu} g / CU`].filter(Boolean);
  };
  const parts = (c, vertical) => {
    if (!c) return { hero: null, body: null };
    let hero = null, body = null;
    if (c.kind === "ann") {
      const a = c.a, prod = a.productId && s.products.find(p => p.id === a.productId);
      const author = s.users.find(u => u.id === a.createdBy);
      const files = announceFilesOf(a);
      hero = prod ? <Hero product={prod} name={prod.name} vertical={vertical} /> : null;
      body = <>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: a.isBlocking ? C.bad : C.accent }}>{a.isBlocking ? "Blocking note" : "From the Head"}</p>
            <p className="text-[17px] font-semibold leading-tight mt-1">{prod?.name || a.title}</p>
          </div>
          {!prod && author && <span className="flex-shrink-0 mt-0.5"><Avatar user={author} size={36} /></span>}
        </div>
        {prod && <p className="text-[12px] mt-1" style={{ color: C.muted }}>{factsOf(prod).join(" · ")}</p>}
        {prod && a.title !== prod.name && <p className="text-[15px] font-semibold mt-2">{a.title}</p>}
        {a.categoryId && !prod && <p className="text-[12px] mt-1" style={{ color: C.ok }}>{catPath(a.categoryId)}</p>}
        {a.body && <p className={`text-[14px] mt-2 leading-snug ${prod ? "line-clamp-2" : "line-clamp-5"}`} style={{ color: C.ink }}>{truncate(a.body, prod ? 140 : 280)}</p>}
        {files.length ? <AnnounceFileThumbs files={files} colors={C} cta /> : null}
        <p className="text-[12px] mt-2" style={{ color: C.muted }}>{dayLabel(a.createdAt)}{who(a.createdBy) ? ` · ${who(a.createdBy)}` : ""}</p>
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          {prod && <Cta ghost onClick={() => go("catalog", prod.id)}>Product profile<Ic i={ChevronRight} s={15} mr={0} /></Cta>}
          {!prod && <Cta ghost onClick={() => go("announcements")}>Read full note<Ic i={ChevronRight} s={15} mr={0} /></Cta>}
        </div>
      </>;
    } else if (c.kind === "rej") {
      const insp = c.i, prod = s.products.find(p => p.id === insp.productId);
      const remarks = (insp.remarks || []).map(r => briefingRemark(s, r)).filter(Boolean);
      hero = <Hero product={prod} name={prod?.name} vertical={vertical} />;
      body = <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.bad }}>Rejected · {dayLabel(insp.completedAt)}, {hhmm(insp.completedAt)}</p>
        <p className="text-[17px] font-semibold leading-tight mt-1">{prod?.name || "Product"}</p>
        {prod && <p className="text-[12px] mt-1" style={{ color: C.muted }}>{factsOf(prod).join(" · ")}</p>}
        <p className="text-[13px] mt-2.5" style={{ color: C.ink }}>by {who(insp.controllerId) || "controller"}{insp.supplier ? ` · ${insp.supplier}` : ""}{(insp.pallets || []).filter(Boolean).length ? ` · ${insp.pallets.filter(Boolean).join(", ")}` : ""}</p>
        {remarks.length > 0 && (
          <div className="mt-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: C.muted }}>Why</p>
            {remarks.slice(0, 4).map((line, ri) => <p key={ri} className="text-[13px] leading-snug py-0.5" style={{ color: C.ink }}>{line}</p>)}
            {remarks.length > 4 && <p className="text-[12px]" style={{ color: C.muted }}>+{remarks.length - 4} more</p>}
          </div>
        )}
        {insp.comment && <p className="text-[13px] mt-2 leading-relaxed" style={{ color: C.muted }}>{insp.comment}</p>}
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          <Cta onClick={() => go("inspection", insp.id)}>Open this rejection<Ic i={ChevronRight} s={15} mr={0} /></Cta>
        </div>
      </>;
    } else if (c.kind === "xrej") {
      // A row of the DC5 rejections sheet — the team's official rejection, not a QCteam report. Links to the Slack thread.
      const x = c.x, prod = productForArticle(s, x.a);
      hero = <Hero product={prod} name={prod?.name || x.n} vertical={vertical} />;
      body = <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.bad }}>Rejected on the dock · {dayLabel(x.d)}, {hhmm(x.d)}</p>
        <p className="text-[17px] font-semibold leading-tight mt-1">{prod?.name || x.n || x.a}</p>
        <p className="text-[12px] mt-1" style={{ color: C.muted }}>{[`ID ${x.a}`, x.tu != null && `${x.tu} TU`, x.po && `PO ${x.po}`, x.group].filter(Boolean).join(" · ")}</p>
        <p className="text-[13px] mt-2.5" style={{ color: C.ink }}>by {x.user || "the team"}{x.sortable != null ? ` · ${x.sortable ? "sortable" : "not sortable"}` : ""}</p>
        {x.reason && <div className="mt-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] mb-1" style={{ color: C.muted }}>Why</p><p className="text-[13px] leading-snug" style={{ color: C.ink }}>{x.reason}</p></div>}
        <p className="text-[11px] mt-2" style={{ color: C.muted }}>From the DC5 rejections sheet — not a QCteam report.</p>
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          {reportUrls(x).slice(0, 1).map(u => <Cta key={u} onClick={() => window.open(u, "_blank", "noopener")}>Inspection report<Ic i={ExternalLink} s={15} mr={0} /></Cta>)}{x.link && <Cta onClick={() => window.open(x.link, "_blank", "noopener")}>{linkLabel(x.link)}<Ic i={ExternalLink} s={15} mr={0} /></Cta>}
          {prod && <Cta ghost onClick={() => go("catalog", prod.id)}>Product profile<Ic i={ChevronRight} s={15} mr={0} /></Cta>}
        </div>
      </>;
    } else {
      const row = c.c, p = productForArticle(s, row.articleId);
      hero = <Hero product={p} name={row.name || p?.name} vertical={vertical} />;
      body = <>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: C.bad }}>Complaint{briefingComplaintsMeta(s).period ? ` · ${briefingComplaintsMeta(s).period}` : ""}</p>
        <p className="text-[17px] font-semibold leading-tight mt-1">{row.name || p?.name || row.articleId}</p>
        <p className="text-[12px] mt-1" style={{ color: C.muted }}>{[row.articleId && `ID ${row.articleId}`, p && catPath(p.categoryId)].filter(Boolean).join(" · ")}</p>
        <p className="text-[28px] font-semibold leading-none tracking-tight mt-2.5" style={{ color: C.bad, fontVariantNumeric: "tabular-nums" }}>{row.count}</p>
        <p className="text-[14px] mt-1" style={{ color: C.bad }}>freshness complaint{row.count === 1 ? "" : "s"}{row.subType ? ` · mostly ${row.subType}` : ""}</p>
        <p className="text-[13px] mt-2 leading-snug" style={{ color: C.muted }}>{p ? "Customers already noticed. Look closer today." : "No catalog profile yet."}</p>
        <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
          {p && <Cta ghost onClick={() => go("catalog", p.id)}>Product profile<Ic i={ChevronRight} s={15} mr={0} /></Cta>}
          {!p && <Cta onClick={() => go("complaints")}>See all complaints</Cta>}
        </div>
      </>;
    }
    return { hero, body };
  };
  const cardKey = c => `${c.kind}-${c.a?.id || c.i?.id || c.c?.id || (c.x && extRejectionKey(c.x)) || "x"}`;
  const renderCard = (c, ix) => {
    const { hero, body } = parts(c, false); const fp = briefingFp(c); const isSeen = fp && seen.has(fp);
    return (
      <div key={cardKey(c)} className="qc-elev flex overflow-hidden rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.line}`, borderTop: `3px solid ${edge(c)}`, boxShadow: lift(), opacity: isSeen ? .6 : 1, minHeight: 200 }}>
        {hero}
        <div className="flex-1 min-w-0 flex flex-col px-4 pt-3 pb-3">
          <div className="flex items-start gap-2"><div className="flex-1 min-w-0 flex flex-col">{body}</div>
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button type="button" data-story-cta onClick={() => markOne(c)} disabled={isSeen} title={isSeen ? "Read" : "Mark as read"} className="w-7 h-7 rounded-full inline-flex items-center justify-center" style={{ background: isSeen ? C.okBg : C.bg, color: isSeen ? C.ok : C.muted, border: `1px solid ${isSeen ? "transparent" : C.line}` }}><Ic i={Check} s={13} mr={0} /></button>
              <button type="button" data-story-cta onClick={() => openDeck(ix)} title="Open in the deck" className="w-7 h-7 rounded-full inline-flex items-center justify-center" style={{ background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}><Ic i={Layers} s={13} mr={0} /></button>
            </div></div>
        </div>
      </div>
    );
  };
  const renderDeck = () => {
    if (!deck || !cards[deck.ix]) return null;
    const c = cards[deck.ix]; const { hero, body } = parts(c, true); const fp = briefingFp(c); const isSeen = fp && seen.has(fp);
    const Arrow = ({ dir, disabled }) => <button type="button" onClick={e => { e.stopPropagation(); stepDeck(dir); }} disabled={disabled} className="w-12 h-12 rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ background: disabled ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.14)", color: disabled ? "rgba(255,255,255,.3)" : "#fff", border: "1px solid rgba(255,255,255,.18)", backdropFilter: "blur(6px)", cursor: disabled ? "default" : "pointer" }}><Ic i={dir < 0 ? ChevronLeft : ChevronRight} s={22} mr={0} /></button>;
    return (
      <div className="fixed inset-0 flex items-center justify-center gap-8 p-6" style={{ background: "rgba(14,20,16,.78)", zIndex: 60, backdropFilter: "blur(3px)" }} onClick={() => setDeck(null)}>
        <style>{`@keyframes qcDeckR{from{transform:translateX(56px) rotate(1.5deg);opacity:0}to{transform:none;opacity:1}}@keyframes qcDeckL{from{transform:translateX(-56px) rotate(-1.5deg);opacity:0}to{transform:none;opacity:1}}`}</style>
        <Arrow dir={-1} disabled={deck.ix === 0} />
        <div className="relative" style={{ width: 440, height: "min(680px, 86vh)" }} onClick={e => e.stopPropagation()}>
          <button type="button" onClick={() => setDeck(null)} className="absolute w-9 h-9 rounded-full inline-flex items-center justify-center" style={{ top: -14, right: -14, background: "#fff", color: "#1f2a24", zIndex: 5, boxShadow: "0 4px 14px rgba(0,0,0,.35)" }}><Ic i={X} s={16} mr={0} /></button>
          {cards[deck.ix + 1] && <div className="absolute inset-0 rounded-[26px]" style={{ background: C.surface, border: `1px solid ${C.line}`, transform: "translate(10px, 10px) rotate(1.2deg)", opacity: .55 }} />}
          {cards[deck.ix + 2] && <div className="absolute inset-0 rounded-[26px]" style={{ background: C.surface, border: `1px solid ${C.line}`, transform: "translate(20px, 20px) rotate(2.4deg)", opacity: .3 }} />}
          <div key={cardKey(c)} className="absolute inset-0 flex flex-col overflow-hidden rounded-[26px]" style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 24px 60px rgba(0,0,0,.45)", animation: `${deck.dir < 0 ? "qcDeckL" : "qcDeckR"} .32s cubic-bezier(.2,.8,.2,1)` }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: edge(c), zIndex: 2 }} />
            
            {hero}
            <div className="flex-1 min-h-0 flex flex-col px-5 pt-4 pb-4 overflow-y-auto">{body}</div>
            <div className="px-5 pb-3 flex items-center gap-2 text-[11px]" style={{ color: C.muted }}><span style={{ fontVariantNumeric: "tabular-nums" }}>{deck.ix + 1} / {n}</span><span className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ background: C.line }}><span className="block h-full rounded-full" style={{ width: `${Math.round((deck.ix + 1) / n * 100)}%`, background: C.ink }} /></span>{isSeen && <span style={{ color: C.ok }}>✓ read</span>}</div>
          </div>
        </div>
        <Arrow dir={1} disabled={deck.ix >= n - 1} />
      </div>
    );
  };
  const notesN = unseen.anns.length, rejN = unseen.rejs.length + unseen.xrejs.length, compN = unseen.complaints.length;
  const Tab = ({ id, label, count }) => <button type="button" onClick={() => setTab(id)} className="text-xs font-medium px-3 rounded-full inline-flex items-center gap-1.5" style={{ height: 30, background: tab === id ? C.ink : C.surface, color: tab === id ? C.onDark : C.ink, border: `1px solid ${tab === id ? C.ink : C.line}` }}>{label}<span className="font-semibold" style={{ color: tab === id ? C.onDark : count ? C.accent : C.muted, fontVariantNumeric: "tabular-nums" }}>{count}</span></button>;
  const emptyCopy = tab === "complaints" ? "No new complaints to review." : tab === "notes" ? "No new notes to review." : "No new rejections to review.";
  const unread = cards.filter(c => { const fp = briefingFp(c); return fp && !seen.has(fp); }).length;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-1 flex-wrap"><h1>Shift update</h1><span className="text-xs" style={{ color: C.muted }}>{unseen.total ? `${unseen.total} new since you last looked` : "you're up to date"}</span></div>
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>What changed since your last shift: notes from the Head, rejections on the dock and fresh complaints. Tick a card once you've read it — the team view of your shift shows what you've seen.</p>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        <Tab id="notes" label="Notes" count={notesN} />
        <Tab id="rejections" label="Rejections" count={rejN} />
        <Tab id="complaints" label="Complaints" count={compN} />
        <div className="flex-1" />
        {n > 0 && <button type="button" onClick={() => openDeck(Math.max(0, cards.findIndex(c => { const fp = briefingFp(c); return fp && !seen.has(fp); })))} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 30, border: `1px solid ${C.line}`, color: C.ink }}><Ic i={Layers} s={13} />Browse one by one</button>}
        {unread > 0 && <button type="button" onClick={markAll} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center" style={{ height: 30, background: C.accentSoft, color: C.accent }}><Ic i={Check} s={13} />Mark all {unread} as read</button>}
      </div>
      {n === 0 ? (
        <Card><Empty icon={BookOpen} title="You're up to date." hint={emptyCopy} /></Card>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
          {cards.map((c, ix) => renderCard(c, ix))}
        </div>
      )}
      {renderDeck()}
    </div>
  );
}

function ProfilePage({ s, set, user, openInspection }) {
  const allMine = s.inspections.filter(i => i.controllerId === user.id && i.status === "Completed");
  const mine = allMine.filter(i => countsAs(s, i)); const skips = allMine.filter(i => !countsAs(s, i)).length;
  const acc = mine.filter(i => i.result === "Accepted").length;
  const avg = avgActiveMinutes(mine);
  const todayISO = new Date().toISOString().slice(0, 10);
  const inToday = i => (i.completedAt || "").slice(0, 10) === todayISO;
  const inWeek = i => (new Date() - new Date(i.completedAt)) < 7 * 86400000;
  const todayN = mine.filter(inToday).length, week = mine.filter(inWeek).length;
  const [detail, setDetail] = useState(null);
  const typeOf = i => i.typeId || legacyTypeId(i.type);
  const openPeriod = (key, title) => { const pick = key === "today" ? inToday : key === "week" ? inWeek : () => true; setDetail({ title, items: mine.filter(pick), traces: allMine.filter(i => !countsAs(s, i)).filter(pick) }); };
  const splitSub = list => { const n = list.length; if (!n) return null; const a = list.filter(i => i.result === "Accepted").length; return `${a} accepted · ${n - a} rejected`; };
  const firstAt = allMine.map(i => i.completedAt).filter(Boolean).sort()[0];
  const drafts = s.inspections.filter(i => i.controllerId === user.id && ["Draft", "PendingReview"].includes(i.status));
  const myFlags = s.flags.filter(f => f.raisedBy === user.id && f.status === "Open").length;
  // Last 14 days, one bar per day: accepted on top of rejected.
  const days = [...Array(14)].map((_, k) => { const d = new Date(); d.setDate(d.getDate() - (13 - k)); const iso = d.toISOString().slice(0, 10); const list = mine.filter(i => (i.completedAt || "").slice(0, 10) === iso); return { iso, label: d.toLocaleDateString("en-GB", { weekday: "narrow" }), day: d.getDate(), a: list.filter(i => i.result === "Accepted").length, r: list.filter(i => i.result === "Rejected").length, list }; });
  const maxDay = Math.max(1, ...days.map(d => d.a + d.r));
  // Products this controller rejected most (all time) — what to be careful with.
  const rejBy = {}; mine.filter(i => i.result === "Rejected").forEach(i => { rejBy[i.productId] = (rejBy[i.productId] || 0) + 1; });
  const topRej = Object.entries(rejBy).map(([pid, n]) => ({ p: s.products.find(x => x.id === pid), n })).filter(x => x.p).sort((a, b) => b.n - a.n).slice(0, 5);
  const recent = [...allMine].sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 8);
  const Tile = ({ l, v, sub, onClick, color, active }) => { const T = onClick ? "button" : "div"; return (
    <T type={onClick ? "button" : undefined} onClick={onClick} className="qc-elev qc-tile rounded-2xl p-4 text-left flex flex-col" style={{ background: active ? C.accentSoft : C.surface, border: `1px solid ${active ? C.accent : C.line}`, borderLeft: `4px solid ${color || C.line}`, boxShadow: lift(), cursor: onClick ? "pointer" : "default" }}>
      <p className="text-xs" style={{ color: C.muted }}>{l}</p>
      <p className="text-2xl font-semibold leading-tight mt-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>{v}</p>{sub && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{sub}</p>}
    </T>
  ); };
  const shown = detail ? [...detail.items, ...detail.traces].sort((x, y) => (y.completedAt || "").localeCompare(x.completedAt || "")) : [];
  const Row = ({ i }) => { const it = inspType(s, i); const rej = i.result === "Rejected"; const p = s.products.find(x => x.id === i.productId); return <button type="button" onClick={() => openInspection && openInspection(i.id)} className="w-full text-left flex items-center gap-3 py-2" style={{ borderTop: `1px solid ${C.line}` }}><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: it.autoAccept ? it.color : rej ? C.bad : i.result === "Accepted" ? C.ok : C.muted }} /><span className="flex-1 min-w-0"><span className="text-sm block truncate leading-tight">{p?.name || `Pallet ${(i.pallets || [])[0] || ""}`}</span><span className="text-[11px] block" style={{ color: C.muted }}>{it.autoAccept ? it.name : (i.result || "done")}{i.comment ? ` — ${i.comment}` : ""}</span></span><span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{fmtTime(i.completedAt)}</span></button>; };
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4"><h1>Profile</h1><span className="text-xs" style={{ color: C.muted }}>your numbers from completed inspections · the web is view-only</span></div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0, 1fr) 360px" }}>
        <div className="flex flex-col gap-4 min-w-0">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar user={user} size={72} onPick={url => set(x => ({ ...x, users: x.users.map(q => q.id === user.id ? { ...q, photoUrl: url } : q) }))} />
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold leading-tight">{user.name}</p>
                <p className="text-xs mt-0.5" style={{ color: C.muted }}>{user.email} · Controller{firstAt ? ` · inspecting since ${new Date(firstAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {drafts.length > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{drafts.length} inspection{drafts.length === 1 ? "" : "s"} in progress</span>}
                  {myFlags > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>{myFlags} open flag{myFlags === 1 ? "" : "s"}</span>}
                  {skips > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.muted }}>{skips} trace{skips === 1 ? "" : "s"} (don't count)</span>}
                </div>
              </div>
            </div>
          </Card>
          <div>
            <p className="label-sm mb-1.5" style={{ color: C.muted }}>My inspections</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              <Tile l="Today" v={todayN} sub={splitSub(mine.filter(inToday)) || "nothing yet"} color={todayN ? C.ok : C.line} onClick={todayN ? () => openPeriod("today", "Today") : null} active={detail?.title === "Today"} />
              <Tile l="Last 7 days" v={week} sub={splitSub(mine.filter(inWeek)) || "none"} color={week ? C.accent : C.line} onClick={week ? () => openPeriod("week", "Last 7 days") : null} active={detail?.title === "Last 7 days"} />
              <Tile l="All time" v={mine.length} sub={splitSub(mine) || "no inspections yet"} color={mine.length ? C.ink : C.line} onClick={mine.length ? () => openPeriod("total", "All my inspections") : null} active={detail?.title === "All my inspections"} />
              <Tile l="Accepted" v={mine.length ? `${Math.round(acc / mine.length * 100)}%` : "—"} sub={`${acc} of ${mine.length}`} color={mine.length ? (acc / mine.length >= .7 ? C.ok : C.warn) : C.line} />
              <Tile l="Active time" v={avg !== null ? `${Math.round(avg)} min` : "—"} sub="average per inspection" color={avg !== null ? C.accent : C.line} />
            </div>
          </div>
          {typesOf(s).length > 0 && <div>
            <p className="label-sm mb-1.5" style={{ color: C.muted }}>By type</p>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, Math.min(5, typesOf(s).length))}, 1fr)` }}>{typesOf(s).map(tp => { const m = allMine.filter(i => typeOf(i) === tp.id); const rej = m.filter(i => i.result === "Rejected").length; return <Tile key={tp.id} l={tp.name} v={m.length} sub={tp.autoAccept ? "doesn't count as a verdict" : m.length ? `${Math.round(rej / m.length * 100)}% rejected` : "none yet"} color={tp.color || C.accent} onClick={m.length ? () => setDetail({ title: tp.name, items: tp.autoAccept ? [] : m, traces: tp.autoAccept ? m : [] }) : null} active={detail?.title === tp.name} />; })}</div>
          </div>}
          <Card>
            <div className="flex items-center mb-3"><p className="font-semibold text-sm flex-1">Last 14 days</p><span className="text-[11px] flex items-center gap-3" style={{ color: C.muted }}><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: C.ok }} />accepted</span><span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-sm" style={{ background: C.bad }} />rejected</span></span></div>
            <div className="flex items-end gap-1.5" style={{ height: 110 }}>{days.map(d => { const tot = d.a + d.r; return <button key={d.iso} type="button" disabled={!tot} onClick={() => setDetail({ title: new Date(d.iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }), items: d.list, traces: [] })} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={tot ? `${d.a} accepted · ${d.r} rejected` : "nothing"}>
              <span className="w-full flex flex-col justify-end rounded-md overflow-hidden" style={{ height: `${Math.max(4, tot / maxDay * 84)}px`, background: tot ? "transparent" : C.line }}>{tot > 0 && <><span style={{ flex: d.a, background: C.ok }} /><span style={{ flex: d.r, background: C.bad }} /></>}</span>
              <span className="text-[10px]" style={{ color: d.iso === todayISO ? C.ink : C.muted, fontWeight: d.iso === todayISO ? 600 : 400 }}>{d.day}</span>
            </button>; })}</div>
          </Card>
          {detail && <Card>
            <div className="flex items-center mb-2"><p className="font-semibold text-sm flex-1">{detail.title} · {shown.length}</p><button type="button" onClick={() => setDetail(null)} className="text-xs" style={{ color: C.muted }}>close</button></div>
            {shown.length === 0 ? <p className="text-xs py-2" style={{ color: C.muted }}>Nothing in this slice.</p> : shown.map(i => <Row key={i.id} i={i} />)}
          </Card>}
        </div>
        <aside className="flex flex-col gap-4">
          <Card>
            <p className="font-semibold text-sm mb-1">Latest</p>
            {recent.length === 0 ? <p className="text-sm py-2" style={{ color: C.muted }}>No inspections yet — they start on the phone.</p> : recent.map(i => <Row key={i.id} i={i} />)}
          </Card>
          {topRej.length > 0 && <Card>
            <p className="font-semibold text-sm mb-0.5">You rejected most</p>
            <p className="text-[12px] mb-2" style={{ color: C.muted }}>Products that gave you trouble — worth a closer look next time.</p>
            {topRej.map(({ p, n }) => <div key={p.id} className="flex items-center gap-3 py-1.5 text-sm" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1 min-w-0 truncate">{p.name}</span><span className="text-xs font-semibold" style={{ color: C.bad, fontVariantNumeric: "tabular-nums" }}>{n}×</span></div>)}
          </Card>}
        </aside>
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
    <button onClick={() => selectCat(c.id)} className="qc-elev qc-tile rounded-2xl p-3 text-left flex items-center gap-2.5" style={{ background: selCat === c.id ? C.accentSoft : C.surface, border: `1px solid ${selCat === c.id ? C.accent : C.line}` }}>
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
          <AttributeForm s={s} own={cat.attributes || []} inherited={cat.parentId ? effectiveAttributes(s, { categoryId: cat.parentId, attributes: [] }) : []} onSet={a => patchCat({ attributes: [...(cat.attributes || []).filter(x => x.dictionaryId !== a.dictionaryId), a] })} onRemove={did => patchCat({ attributes: (cat.attributes || []).filter(x => x.dictionaryId !== did) })} hint="A value set here is inherited by every product in the category and pre-filled in any form field bound to the same list. The form flags an answer that differs. A product can override it." />
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
          <SpecForm sctx={s} set={set} user={s.users.find(u => u.role === "Head")} ownerKind="category" ownerId={cat.id} specs={cat.specs || []} inherited={parentSpecs} onAdd={q => { patchCat({ specs: [...(cat.specs || []), q] }); const kids = productsUnder(cat.id); if (kids.length) setApplyAsk({ spec: q, kids, chosen: new Set(kids.map(p => p.id)), choosing: false }); }} onUpdate={(id, fields) => patchCat({ specs: (cat.specs || []).map(q => q.id === id ? applySpecEdit(q, fields) : q) })} onRemove={id => patchCat({ specs: (cat.specs || []).filter(q => q.id !== id) })}
            hint="Inherited by all products in this category (by name). A product can override with its own spec of the same name. Set e.g. Brix or Firmness once for the whole category here. Temp on a row applies to every product that inherits it. Edit keeps the same specification — forms stay linked." />
        </Card>
      )}

      {cat && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1 flex items-center"><Ic i={BookOpen} s={14} />Reference guide: {cat.name}</p>
          <ReferenceGuideEditor s={s} set={set} kind="category" owner={cat} onOpenCategory={id => selectCat(id)} />
        </Card>
      )}
      {cat && (
        <Card style={{ marginTop: 16 }}>
          <p className="font-medium text-sm mb-1 flex items-center"><Ic i={BookOpen} s={14} />Encyclopedia: {cat.name}</p>
          <EncyclopediaEditor s={s} set={set} kind="category" owner={cat} onOpenCategory={id => selectCat(id)} />
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
  const Kpi = ({ l, v, sub, tone, delta }) => <div className="qc-tile rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${tone || C.line}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold mt-0.5">{v}</p>{sub && <p className="text-[11px]" style={{ color: C.muted }}>{sub}{delta != null && <span style={{ color: delta > 0 ? C.bad : delta < 0 ? C.ok : C.muted }}> · {delta > 0 ? "▲" : delta < 0 ? "▼" : "="} {Math.abs(delta)} pp vs previous</span>}</p>}</div>;
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
              {insights.map((x, i) => <button key={i} onClick={() => goTo(x.go)} className="qc-elev qc-tile text-left rounded-2xl p-3.5" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${toneColor[x.tone]}` }}><p className="text-sm font-semibold mb-0.5">{x.title}</p><p className="text-xs" style={{ color: C.muted }}>{x.body}</p></button>)}
            </div>
          </div>
        )}
        <p className="label-sm mb-2">By inspection type</p>
        <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {typesOf(s).map(t => { const mine = all.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id); const pmine = prev.filter(i => (i.typeId || legacyTypeId(i.type)) === t.id); const r = mine.filter(i => i.result === "Rejected").length; const rate = pct1(r, mine.length), prate = pct1(pmine.filter(i => i.result === "Rejected").length, pmine.length); const dur = avgActiveMinutes(mine); return (
            <div key={t.id} className="qc-tile rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderTop: `3px solid ${t.color}` }}>
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
      {(() => { const series = weekSeries(complaintSnapshots(s)); if (series.length < 1) return null;
        // Complaints across weeks. Each week's figure is its LATEST post (the totals are week-to-date, not daily), and a
        // post lists the top articles only — so an article missing from a week is "below the list", shown as "–", never 0.
        const last = series.slice(-8); const tops = topArticles(last, 8);
        // The current week is still running: its figure only covers the days posted so far and must not read as a drop.
        const today = todayISO(); const running = w => !!(w.range && w.range.to >= today);
        const chart = last.map(w => ({ name: w.label.replace("Week ", "W") + (running(w) ? "*" : ""), total: w.total, articles: w.articles }));
        const subs = [...new Set(last.flatMap(w => w.subTypes.map(x => x.subType)))].slice(0, 5);
        return <Card style={{ marginTop: 16 }}>
          <div className="flex items-center gap-3 mb-1 flex-wrap"><h2 className="flex-1"><Ic i={ThumbsDown} s={16} />Complaints by week</h2><span className="text-xs" style={{ color: C.muted }}>last {last.length} week{last.length === 1 ? "" : "s"} · {series.reduce((a, w) => a + w.posts, 0)} posts kept</span></div>
          <p className="text-xs mb-3" style={{ color: C.muted }}>Week figures are the Head of Quality's <b>last post of the week</b> (the totals he posts are week-to-date). Posts list the top articles only, so “–” means <i>not on that week's list</i>, not zero.{last.some(running) ? <> A week marked <b>*</b> is still running — its figure covers the days posted so far, so a lower number is not yet a drop.</> : null}</p>
          <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)" }}>
            <div>
              <div style={{ height: 180 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={chart} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} allowDecimals={false} /><Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}`, background: C.surface, color: C.ink }} formatter={(v, k) => [v, k === "total" ? "complaints (top list)" : "articles listed"]} /><Line type="monotone" dataKey="total" stroke={C.bad} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div>
              <table className="w-full text-sm mt-2"><thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Week", "Posts", "Complaints", "Articles", "Top article", ...subs].map((h, i) => <th key={i} className="py-1 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
                <tbody>{[...last].reverse().map(w => <tr key={w.week} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td className="py-1.5 pr-3 whitespace-nowrap"><b>{w.label}</b>{running(w) && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>still running</span>}<span className="block text-[11px]" style={{ color: C.muted }}>{w.range ? `${w.range.from.slice(8)}.${w.range.from.slice(5, 7)}–${w.range.to.slice(8)}.${w.range.to.slice(5, 7)}` : ""} · as of {w.asOf.slice(8)}.{w.asOf.slice(5, 7)}</span></td>
                  <td className="py-1.5 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{w.posts}</td>
                  <td className="py-1.5 pr-3 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{w.total}</td>
                  <td className="py-1.5 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{w.articles}</td>
                  <td className="py-1.5 pr-3 text-xs">{w.top ? `${w.top.name || w.top.articleId} (${w.top.count})` : "—"}</td>
                  {subs.map(st => { const x = w.subTypes.find(y => y.subType === st); return <td key={st} className="py-1.5 pr-3 text-xs" style={{ fontVariantNumeric: "tabular-nums", color: x ? C.ink : C.muted }}>{x ? x.count : "–"}</td>; })}
                </tr>)}</tbody></table>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Articles most often on the list</p>
              <table className="w-full text-sm"><thead><tr className="text-xs text-left" style={{ color: C.muted }}><th className="py-1 pr-2 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>Article</th>{last.map(w => <th key={w.week} className="py-1 pr-2 font-medium text-right" style={{ borderBottom: `1px solid ${C.line}` }}>{w.label.replace("Week ", "W")}{running(w) ? "*" : ""}</th>)}</tr></thead>
                <tbody>{tops.map(a => { const tr = articleTrend(last, a.articleId); const p = productForArticle(s, a.articleId); return <tr key={a.key} style={{ borderBottom: `1px solid ${C.line}` }}>
                  <td className="py-1.5 pr-2 text-xs"><span className="block truncate" style={{ maxWidth: 200 }} title={a.name || a.articleId}>{p && setPage ? <button onClick={() => setPage("products")} className="text-left font-medium" style={{ color: C.ink }}>{a.name || p.name}</button> : (a.name || a.articleId)}</span><span className="block text-[10px] font-mono" style={{ color: C.muted }}>{a.articleId} · {a.weeks}/{last.length} wk</span></td>
                  {tr.map((t, i) => { const prevC = i > 0 ? tr[i - 1].count : null; const up = t.count != null && prevC != null ? t.count - prevC : null; return <td key={t.week} className="py-1.5 pr-2 text-right text-xs" style={{ fontVariantNumeric: "tabular-nums", color: t.count == null ? C.muted : C.ink }}>{t.count == null ? "–" : <><b>{t.count}</b>{up != null && up !== 0 && <span className="ml-1 text-[10px]" style={{ color: up > 0 ? C.bad : C.ok }}>{up > 0 ? `+${up}` : up}</span>}</>}</td>; })}
                </tr>; })}</tbody></table>
            </div>
          </div>
        </Card>; })()}
      {(() => { const meta = complaintsMeta(s); if (!meta.rows.length) return null;
        // Complaints vs QC: where customers complain but QC in this period let the article through (or never saw it).
        const rows = [...meta.rows].sort((a, b) => (b.count || 0) - (a.count || 0)).map(r => { const p = productForArticle(s, r.articleId); const ins = p ? s.inspections.filter(i => i.status === "Completed" && i.productId === p.id && isVerdictType(s, i) && countsAs(s, i) && new Date(i.completedAt || i.startedAt) >= since) : []; const rej = ins.filter(i => i.result === "Rejected").length; const rate = ins.length ? Math.round(rej / ins.length * 100) : null;
          const top = Object.values(ins.flatMap(i => i.remarks || []).reduce((m, x) => { const n = pm[x.leafId]?.name || "?"; m[n] = m[n] || { name: n, count: 0 }; m[n].count++; return m; }, {})).sort((a, b) => b.count - a.count)[0];
          const signal = !p ? ["Not in catalog", C.muted, C.line] : !ins.length ? ["No QC in period", C.warn, C.warnBg] : rate < 20 ? ["Passed QC — look closer", C.bad, C.badBg] : ["QC caught it", C.ok, C.okBg];
          return { ...r, p, ins: ins.length, rej, rate, top, signal }; });
        const maxC = Math.max(1, ...rows.map(r => r.count || 0)); const passed = rows.filter(r => r.signal[0].startsWith("Passed")).length, unseen = rows.filter(r => r.signal[0].startsWith("No QC")).length;
        return <Card style={{ marginTop: 16 }}>
          <div className="flex items-center gap-3 mb-1 flex-wrap"><h2 className="flex-1"><Ic i={ThumbsDown} s={16} />Complaints vs QC</h2><span className="text-xs" style={{ color: C.muted }}>{meta.period ? `complaints: ${meta.period} · ` : ""}QC: last {days} days</span></div>
          <p className="text-xs mb-3" style={{ color: C.muted }}>Customer freshness complaints next to what QC decided on the same article. <b style={{ color: C.bad }}>{passed}</b> article{passed === 1 ? "" : "s"} with complaints went through QC almost always accepted{unseen ? <>, <b style={{ color: C.warn }}>{unseen}</b> {unseen === 1 ? "was" : "were"} not inspected at all in this period</> : ""} — those are where the inspection or its form misses what the customer sees.</p>
          <table className="w-full text-sm"><thead><tr className="text-xs text-left" style={{ color: C.muted }}>{["Article", "Complaints", "", "Top sub-type", "QC inspections", "Rejected", "Rej. rate", "Top QC remark", "Signal"].map((h, i) => <th key={i} className="py-1.5 pr-3 font-medium" style={{ borderBottom: `1px solid ${C.line}` }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map(r => <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}` }}>
              <td className="py-1.5 pr-3">{r.p ? <button onClick={() => { setPage && setPage("products"); }} className="text-left font-medium" style={{ color: C.ink }}>{r.name || r.p.name}</button> : <span>{r.name || r.articleId}</span>}<span className="block text-[10px] font-mono" style={{ color: C.muted }}>{r.articleId}</span></td>
              <td className="py-1.5 pr-3 font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{r.count}</td>
              <td className="py-1.5 pr-3" style={{ width: 120 }}><div className="h-2 rounded-full" style={{ background: C.bg }}><div className="h-2 rounded-full" style={{ width: `${Math.round((r.count || 0) / maxC * 100)}%`, background: C.bad, opacity: .85 }} /></div></td>
              <td className="py-1.5 pr-3 text-xs">{r.subType ? <span className="px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }}>{r.subType}{r.subCount != null ? ` (${r.subCount})` : ""}</span> : "—"}</td>
              <td className="py-1.5 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{r.p ? r.ins : "—"}</td>
              <td className="py-1.5 pr-3" style={{ fontVariantNumeric: "tabular-nums" }}>{r.p ? r.rej : "—"}</td>
              <td className="py-1.5 pr-3" style={{ fontVariantNumeric: "tabular-nums", color: r.rate == null ? C.muted : r.rate < 20 ? C.bad : C.ink }}>{r.rate == null ? "—" : `${r.rate}%`}</td>
              <td className="py-1.5 pr-3 text-xs">{r.top ? `${r.top.name} ×${r.top.count}` : "—"}</td>
              <td className="py-1.5 pr-3 text-xs"><span className="px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: r.signal[2], color: r.signal[1] }}>{r.signal[0]}</span></td>
            </tr>)}</tbody></table>
        </Card>; })()}
    </div>
  );
}

// ═══════════════════ PDF report: print-optimised layout (in the real system rendered server-side, same structure) ═══════════════════
function PrintReport({ insp, s, onClose }) {
  const product = s.products.find(p => p.id === insp.productId), t = insp.template, problems = withLinkedProblems(s, problemsFor(s, { kind: "Product", id: insp.productId }, new Set((t && t.suppressed) || [])), t);
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const pm = byId(problems);
  const refs = t ? [...(t.problemRefs || [])].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean) : [];
  const ctrl = s.users.find(u => u.id === insp.controllerId)?.name;
  const fieldsAnswered = t ? t.fields.filter(f => !isSystem(f.type) && insp.values?.[f.id] !== undefined && insp.values?.[f.id] !== "").sort(bySort) : [];
  const valStr = (f, v) => f.type === "Number" ? (v?.measurements || []).filter(x => x !== "").join(" / ") : Array.isArray(v) ? v.join(", ") : String(v ?? "");
  const photoGroups = t ? photoGroupsOf(t, insp, problems) : [];
  useEffect(() => { const prev = document.title; document.title = `QC report — ${product?.name || ""} — ${(insp.completedAt || "").slice(0, 10)}`; return () => { document.title = prev; }; }, []);
  const resultColor = insp.result === "Accepted" ? "#1f7a45" : "#b23a3a";
  const resultIcon = settingsOf(s).resultIcons?.[insp.result];
  return (
    <div className="fixed inset-0 overflow-y-auto print-root" style={{ background: "#666", zIndex: 70 }}>
      <style>{`
        .print-root .sheet{background:#fff;color:#111;width:210mm;min-height:297mm;margin:16px auto;padding:16mm 16mm 20mm;box-shadow:0 10px 40px rgba(0,0,0,.4);font:11.5pt/1.4 -apple-system,"Segoe UI",Arial,sans-serif}
        .print-root table{width:100%;border-collapse:collapse}.print-root td,.print-root th{padding:4px 6px;border-bottom:1px solid #ddd;text-align:left;font-size:10.5pt;vertical-align:top}
        .print-root th{font-size:9.5pt;color:#555;font-weight:600}.print-root h1{font-size:18pt;margin:0}.print-root h2{font-size:12pt;margin:14px 0 6px;color:#222}
        .print-root .k{color:#666;font-size:9.5pt}
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
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ textAlign: "right" }}><div style={{ fontWeight: 700, fontSize: "12pt", color: resultColor, lineHeight: 1.15 }}>{insp.result === "Accepted" ? "ACCEPTED" : "REJECTED"}</div><div className="k">Report no. {insp.id.toUpperCase()}</div></div>{photoSrc(resultIcon) && <img src={photoSrc(resultIcon)} alt="" style={{ height: 48, width: "auto", maxWidth: 72, objectFit: "contain" }} />}</div>
        </div>
        <table style={{ marginTop: 10 }}><tbody>
          <tr><th style={{ width: "22%" }}>Inspected</th><td>{fmtTime(insp.completedAt)} by {ctrl}{insp.lastEditedBy && ` (edited ${fmtTime(insp.lastEditedAt)} by ${s.users.find(u => u.id === insp.lastEditedBy)?.name})`}</td><th style={{ width: "22%" }}>Date code</th><td>{insp.dateISO ? `${dateCode(insp.dateISO)} (${insp.dateISO})` : "—"}</td></tr>
          <tr><th>Supplier</th><td>{insp.supplier || "—"}</td><th>Country of origin</th><td>{insp.country || "—"}</td></tr>
          <tr><th>Pallets</th><td>{(insp.pallets || []).filter(Boolean).join(", ") || "—"}</td><th>Variety</th><td>{insp.variety || "—"}</td></tr>
          {insp.po && <tr><th>PO</th><td colSpan={3}>{insp.po}</td></tr>}
          <tr><th>Sample</th><td colSpan={3}>{insp.sample?.tu || 0} TU × {insp.sample?.cusPerTu || 0} CU = <b>{totals.cu} CU</b>{totals.pieces ? ` · ${totals.pieces} pcs` : ""}{totals.weight ? ` · ${fmt(totals.weight)} g` : ""}</td></tr>
        </tbody></table>
        {refs.length > 0 && <>
          <h2>Quality status</h2>
          <table><thead><tr><th>Problem group</th><th style={{ width: 90 }}>Found</th><th style={{ width: 90 }}>Tolerance</th><th style={{ width: 180 }}></th><th style={{ width: 90 }}>Status</th></tr></thead><tbody>
            {refs.map(n => { const row = reportStatusFields({ name: n.name, agg: aggregate(problems, insp.remarks || [], n.id, totals), ownTol: effTol(problems, t.overrides, n.id), present: presenceIn(problems, insp.remarks || [], n.id), state: statusOf(problems, t.overrides, insp.remarks || [], n.id, totals), remarkTols: tolsUnder(problems, t.overrides, insp.remarks || [], n.id) }); const col = row.state === "exceeded" ? "#b23a3a" : row.state === "flagged" ? "#9a6a12" : "#1f7a45"; const w = row.ratio === null ? (row.found === "present" ? 100 : 0) : Math.min(100, row.ratio * 100); return <tr key={n.id}><td><b>{row.name}</b></td><td>{row.found}</td><td>{row.tolerance}</td><td><div className="bar"><div style={{ width: `${w}%`, background: col }} /></div></td><td style={{ color: col, fontWeight: 700 }}>{row.state === "exceeded" ? "EXCEEDED" : row.state === "flagged" ? "within" : "clean"}</td></tr>; })}
          </tbody></table>
        </>}
        {(insp.remarks || []).length > 0 && <>
          <h2>Remarks — reason for the result</h2>
          <table><thead><tr><th>Problem</th><th style={{ width: 120 }}>Quantity</th><th style={{ width: 90 }}>% of sample</th><th style={{ width: 90 }}>Tolerance</th><th style={{ width: 110 }}>Source</th></tr></thead><tbody>
            {(insp.remarks || []).map(r => <tr key={r.id}><td>{pathOf(problems, r.leafId)}</td><td>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</td><td>{r.mode === "Presence" ? "—" : `${fmt(pct(r, totals))}%`}</td><td>{toleranceDisplay(effTol(problems, t.overrides, r.leafId))}</td><td className="k">{r.auto ? "measurement" : "manual"}</td></tr>)}
          </tbody></table>
        </>}
        {fieldsAnswered.length > 0 && <>
          <h2>Parameters</h2>
          <table><tbody>{fieldsAnswered.map(f => { const row = parameterRow(f, insp.values[f.id], s, product, insp.sample?.piecesPerCu); const spec = row.length > 2 ? row[2] : null; return <tr key={f.id}><th style={{ width: "30%" }}>{row[0]}</th><td>{row[1]}{spec ? <span className="k">{row[3] ? ` — matches spec ${spec}` : ` — doesn't match spec (expected ${spec})`}</span> : null}</td></tr>; })}</tbody></table>
        </>}
        <h2>Comment</h2>
        <div style={{ whiteSpace: "pre-wrap", border: "1px solid #ddd", borderRadius: 6, padding: "8px 10px", minHeight: 40 }}>{insp.comment || <span className="k">—</span>}</div>
        {photoGroups.length > 0 && <>
          <h2>Photos</h2>
          {photoGroups.map((g, gi) => <div key={gi} style={{ marginBottom: 8 }}><div className="k" style={{ marginBottom: 4 }}>{g.label}</div><div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "flex-start" }}>{g.photos.map(ph => <img key={ph.id} src={photoSrc(ph)} alt="" style={{ maxWidth: "52mm", maxHeight: "52mm", width: "auto", height: "auto", objectFit: "contain", borderRadius: 4, border: "1px solid #ddd" }} />)}</div></div>)}
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
  // The tree starts folded — a long catalog is a list of names until someone opens a branch.
  useEffect(() => { const vis = problemsFor(s, scope); setCollapsed(new Set(vis.filter(p => vis.some(k => k.parentId === p.id)).map(p => p.id))); }, [scope.kind, scope.id]);
  const visible = problemsFor(s, scope);
  const patch = (id, p) => set(x => ({ ...x, problems: x.problems.map(n => n.id === id ? { ...n, ...p } : n) }));
  const add = parentId => set(x => ({ ...x, problems: [...x.problems, { id: uid(), parentId, name: parentId ? "new problem" : "New problem type", tolerance: null, categoryId: scope.kind === "Category" ? scope.id : null, productId: scope.kind === "Product" ? scope.id : null }] }));
  const addSuggestion = (name, parentId) => set(x => ({ ...x, problems: [...x.problems, { id: uid(), parentId: parentId || null, name, tolerance: null, categoryId: scope.kind === "Category" ? scope.id : null, productId: scope.kind === "Product" ? scope.id : null }] }));
  const suggestions = problemSuggestions(s, scope, visible);
  const sourceLabel = list => list.length <= 2 ? list.join(", ") : `${list.slice(0, 2).join(", ")} +${list.length - 2}`;
  const [addingSuggestion, setAddingSuggestion] = useState(null);
  const [addParent, setAddParent] = useState("");
  const [sugQ, setSugQ] = useState("");
  useEffect(() => { setSugQ(""); setAddingSuggestion(null); }, [scope.kind, scope.id]);
  const sugQQ = sugQ.trim().toLowerCase();
  const shownSug = sugQQ ? suggestions.filter(x => `${x.name} ${x.sources.join(" ")}`.toLowerCase().includes(sugQQ)) : suggestions;
  const parentOptions = problemParentOptions(visible);
  const catPath = c => { const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const isOwned = scope.kind === "Global" ? null : n => scope.kind === "Category" ? n.categoryId === scope.id : n.productId === scope.id;
  const holder = scope.kind === "Category" ? s.categories.find(c => c.id === scope.id) : scope.kind === "Product" ? s.products.find(p => p.id === scope.id) : null;
  const setHidden = ids => set(x => scope.kind === "Category" ? { ...x, categories: x.categories.map(c => c.id === scope.id ? { ...c, hiddenProblemIds: ids } : c) } : { ...x, products: x.products.map(p => p.id === scope.id ? { ...p, hiddenProblemIds: ids } : p) });
  const hide = id => setHidden([...new Set([...(holder?.hiddenProblemIds || []), id])]);
  const unhide = id => setHidden((holder?.hiddenProblemIds || []).filter(x => x !== id));
  const hiddenHere = (holder?.hiddenProblemIds || []).map(id => s.problems.find(p => p.id === id)).filter(Boolean);
  const remove = id => set(x => { const dead = subtree(x.problems, id); return { ...x, problems: x.problems.filter(n => !dead.has(n.id)), templates: x.templates.map(t => ({ ...t, problemRefs: t.problemRefs.filter(r => !dead.has(r.problemTypeId)), overrides: t.overrides.filter(o => !dead.has(o.problemTypeId)), fields: t.fields.map(f => ({ ...f, problemBelowId: dead.has(f.problemBelowId) ? null : f.problemBelowId, problemAboveId: dead.has(f.problemAboveId) ? null : f.problemAboveId, problemMismatchId: dead.has(f.problemMismatchId) ? null : f.problemMismatchId })) })) }; });
  return (
    <div>
      <h1 className="mb-1">Problem types</h1>
      <p className="text-sm mb-3" style={{ color: C.muted }}>One catalog, but a node can have a scope. Choose who you're editing for: what you add is visible only in that scope (and below). Global nodes are visible everywhere.</p>
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        <button onClick={() => setScope({ kind: "Global" })} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ background: scope.kind === "Global" ? C.accent : C.accentSoft, color: scope.kind === "Global" ? C.onDark : C.accent }}><Ic i={Globe} s={13} />Global</button>
        <span style={{ minWidth: 180 }}><SearchSelect value={scope.kind === "Category" ? scope.id : ""} onChange={v => v && setScope({ kind: "Category", id: v })} options={s.categories.map(c => ({ value: c.id, label: catPath(c) }))} empty="for category…" placeholder="Search categories…" size="xs" /></span>
        <span style={{ minWidth: 180 }}><SearchSelect value={scope.kind === "Product" ? scope.id : ""} onChange={v => v && setScope({ kind: "Product", id: v })} options={s.products.map(p => ({ value: p.id, label: p.name }))} empty="for product…" placeholder="Search products…" size="xs" /></span>
        <span className="text-xs" style={{ color: C.muted }}>{scope.kind === "Global" ? "editing the global catalog" : "inherited nodes can only be hidden or extended; you delete and edit only what was added here"}</span>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: suggestions.length > 0 ? "1fr 280px" : "1fr" }}>
        <Card>
          {visible.length === 0 ? <Empty icon="🌳" title="The catalog is empty" hint="Typically: “Quality problems” with Major/Minor subcategories, and “General problems” with pallet issues. Set tolerance on the subcategory and override on a specific problem only when needed." action={<Primary onClick={() => add(null)}>Add the first type</Primary>} /> : (
            <>
              {visible.some(p => p.parentId) && <div className="flex justify-end gap-3 mb-1"><button type="button" onClick={() => setCollapsed(new Set())} className="text-xs" style={{ color: C.accent }}>Expand all</button><button type="button" onClick={() => setCollapsed(new Set(visible.filter(p => visible.some(k => k.parentId === p.id)).map(p => p.id)))} className="text-xs" style={{ color: C.muted }}>Collapse all</button></div>}
              {visible.filter(p => !p.parentId).map(r => <CatalogNode key={r.id} node={r} problems={visible} onPatch={patch} onAdd={add} onRemove={remove} s={s} isOwned={isOwned} onHide={scope.kind === "Global" ? null : hide} collapsed={collapsed} onToggle={toggleCollapse} />)}
              {hiddenHere.length > 0 && <div className="text-xs mt-3 flex flex-wrap gap-1.5 items-center" style={{ color: C.muted }}>hidden in this scope: {hiddenHere.map(h => <button key={h.id} onClick={() => unhide(h.id)} className="px-1.5 py-0.5 rounded line-through" style={{ background: C.line }} title="restore">{h.name}</button>)}</div>}
              <div className="mt-3"><Ghost onClick={() => add(null)}>+ Add problem type{scope.kind !== "Global" && " (in this scope)"}</Ghost></div>
            </>
          )}
        </Card>
        {suggestions.length > 0 && (
          <Card>
            <p className="font-medium text-sm mb-1 flex items-center gap-1"><Ic i={Sparkles} s={14} mr={0} />Suggestions</p>
            <p className="text-xs mb-2" style={{ color: C.muted }}>Used elsewhere, not yet here — click + to add.</p>
            <SearchBox value={sugQ} onChange={setSugQ} placeholder="Search suggestions" className="mb-2" inputClass="rounded-lg" size={13} />
            {shownSug.length === 0 && <p className="text-xs py-3" style={{ color: C.muted }}>Nothing matches “{sugQ}”.</p>}
            {shownSug.map(sug => (
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

// ═══════════════════ Knowledge editors: Reference guide + Encyclopedia (shared by product and category pages) ═══════════════════
// Both live on an owner (kind "product" | "category"). Inherited content is read-only where it's inherited — it's edited
// on the category that owns it. A product overrides a note by writing its own; it hides an inherited encyclopedia entry
// per entry. Same two-pane layout in both places: list on the left, one editor on the right.
const ownerPatcher = (set, kind, id) => fn => set(x => kind === "product" ? { ...x, products: x.products.map(q => q.id === id ? fn(q) : q) } : { ...x, categories: x.categories.map(c => c.id === id ? fn(c) : c) });
const InheritChip = ({ label }) => <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center" style={{ background: C.accentSoft, color: C.accent }}><Ic i={FolderTree} s={10} mr={3} />{label}</span>;

function ReferenceGuideEditor({ s, set, kind, owner, onOpenCategory }) {
  const [pick, setPick] = useState(null); const [q, setQ] = useState(""); const [filter, setFilter] = useState("all"); const [showHidden, setShowHidden] = useState(false); const [showInh, setShowInh] = useState(false);
  useEffect(() => { setPick(null); setQ(""); setFilter("all"); }, [owner.id]);
  const isProduct = kind === "product";
  const here = isProduct ? "this product" : "this category";
  const startCat = isProduct ? owner.categoryId : owner.parentId;
  const chain = categoryChainIds(s, isProduct ? owner.categoryId : owner.id);
  const refProblems = problemsFor(s, isProduct ? { kind: "Product", id: owner.id } : { kind: "Category", id: owner.id });
  const scopeRank = p => p.productId ? 0 : p.categoryId ? 1 : 2;
  const leaves = refProblems.filter(p => isLeaf(refProblems, p.id)).sort((a, b) => scopeRank(a) - scopeRank(b) || problemPath(refProblems, a.id).localeCompare(problemPath(refProblems, b.id)));
  const hiddenEntries = [];
  chain.forEach(cid => { const cat = s.categories.find(c => c.id === cid); (cat?.hiddenProblemIds || []).forEach(id => { const node = s.problems.find(p => p.id === id); if (node && isLeaf(s.problems, node.id)) hiddenEntries.push({ node, holderType: "category", holderId: cid, holderName: cat.name }); }); });
  if (isProduct) (owner.hiddenProblemIds || []).forEach(id => { const node = s.problems.find(p => p.id === id); if (node && isLeaf(s.problems, node.id)) hiddenEntries.push({ node, holderType: "product", holderId: owner.id, holderName: owner.name }); });
  const unhideEntry = e => set(x => e.holderType === "category"
    ? { ...x, categories: x.categories.map(c => c.id === e.holderId ? { ...c, hiddenProblemIds: (c.hiddenProblemIds || []).filter(id => id !== e.node.id) } : c) }
    : { ...x, products: x.products.map(p => p.id === e.holderId ? { ...p, hiddenProblemIds: (p.hiddenProblemIds || []).filter(id => id !== e.node.id) } : p) });
  const own = (s.problemNotes || []).filter(n => isProduct ? n.productId === owner.id : n.categoryId === owner.id);
  const inheritedFor = problemId => inheritedNoteFor(s, startCat, problemId);
  const patchNote = (problemId, patch) => set(x => {
    const list = x.problemNotes || [];
    const idx = list.findIndex(n => (isProduct ? n.productId === owner.id : n.categoryId === owner.id) && n.problemId === problemId);
    if (idx === -1) return { ...x, problemNotes: [...list, { id: uid(), ...(isProduct ? { productId: owner.id } : { categoryId: owner.id }), problemId, description: "", photos: [], ...patch }] };
    const next = [...list]; next[idx] = { ...next[idx], ...patch }; return { ...x, problemNotes: next };
  });
  const status = l => hasNoteContent(noteFor(own, l.id)) ? "own" : inheritedFor(l.id) ? "inherited" : "todo";
  const doneCount = leaves.filter(l => status(l) !== "todo").length, ownCount = leaves.filter(l => status(l) === "own").length, inhCount = doneCount - ownCount;
  const selId = pick && leaves.some(l => l.id === pick) ? pick : (leaves[0]?.id || null);
  const selLeaf = leaves.find(l => l.id === selId); const selOwn = selLeaf ? noteFor(own, selLeaf.id) : null; const selInh = selLeaf ? inheritedFor(selLeaf.id) : null;
  const qq = q.trim().toLowerCase();
  const visible = leaves.filter(l => (!qq || problemPath(refProblems, l.id).toLowerCase().includes(qq)) && (filter === "all" || (filter === "todo" ? status(l) === "todo" : filter === "own" ? status(l) === "own" : status(l) === "inherited")));
  const groups = []; visible.forEach(l => { const parent = l.parentId ? problemPath(refProblems, l.parentId) : "—"; let g = groups.find(x => x.key === parent); if (!g) { g = { key: parent, items: [] }; groups.push(g); } g.items.push(l); });
  const idx = leaves.findIndex(l => l.id === selId); const prev = idx > 0 ? leaves[idx - 1] : null, next = idx >= 0 && idx < leaves.length - 1 ? leaves[idx + 1] : null;
  const scopeChip = p => { const [bg, fg, l] = p.productId ? [C.okBg, C.ok, "this product"] : p.categoryId ? [C.accentSoft, C.accent, s.categories.find(c => c.id === p.categoryId)?.name || "category"] : [C.bg, C.muted, "global"]; return <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg }}>{l}</span>; };
  const pct = leaves.length ? Math.round(doneCount / leaves.length * 100) : 0;
  const Dot = ({ st }) => <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 16, height: 16, background: st === "own" ? C.okBg : st === "inherited" ? C.accentSoft : C.bg, color: st === "own" ? C.ok : st === "inherited" ? C.accent : C.line, border: `1px solid ${st === "own" ? C.ok : st === "inherited" ? C.accent : C.line}` }}>{st === "own" ? <Check size={10} strokeWidth={3} /> : st === "inherited" ? <FolderTree size={9} strokeWidth={2.5} /> : null}</span>;
  return (
    <div style={{ maxWidth: 960 }}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-xs" style={{ color: C.muted, maxWidth: 560 }}>{isProduct
          ? <>What each problem looks like on <b>this product</b> — a short description and reference photos. Notes written on the category apply here automatically; write one here to override it for this product only.</>
          : <>What each problem looks like for <b>every product in this category</b>{owner.parentId ? " (and notes inherited from the parent category)" : " and its sub-categories"}. Products inherit these notes and can override them one by one.</>}</p>
        {leaves.length > 0 && <div className="ml-auto flex items-center gap-2 text-xs" style={{ color: C.muted }}><span>{doneCount} of {leaves.length} covered{inhCount ? ` · ${inhCount} inherited` : ""}</span><span className="inline-block rounded-full overflow-hidden" style={{ width: 90, height: 6, background: C.line }}><span className="block h-full" style={{ width: `${pct}%`, background: C.ok }} /></span></div>}
      </div>
      {leaves.length === 0 ? <Empty icon="📖" title={`No problem types apply to ${here} yet`} hint="Add or scope them in Problem types (global, this category, or this product) — they will show up here to describe." /> : (
        <div className="flex gap-4 items-start">
          <aside className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 300, border: `1px solid ${C.line}`, background: C.surface }}>
            <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <SearchBox value={q} onChange={setQ} placeholder="Search problem types" size={13} />
              <div className="flex gap-1 mt-2 flex-wrap">{[["all", `All · ${leaves.length}`], ["todo", `To fill · ${leaves.length - doneCount}`], ["own", `Own · ${ownCount}`], ...(inhCount ? [["inherited", `Inherited · ${inhCount}`]] : [])].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="text-[11px] px-2 py-1 rounded-full" style={{ background: filter === k ? C.ink : C.bg, color: filter === k ? C.onDark : C.muted }}>{l}</button>)}</div>
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {groups.length === 0 && <p className="text-xs p-3" style={{ color: C.muted }}>Nothing matches.</p>}
              {groups.map(g => (
                <div key={g.key}>
                  <p className="label-sm px-3 pt-2.5 pb-1" style={{ color: C.muted }}>{g.key}</p>
                  {g.items.map(l => { const st = status(l); const n = st === "own" ? noteFor(own, l.id) : st === "inherited" ? inheritedFor(l.id) : null; const ph = asPhotoList(n?.photos).length; const on = l.id === selId; return (
                    <button key={l.id} onClick={() => setPick(l.id)} className="w-full text-left px-3 py-2 flex items-center gap-2" style={{ background: on ? C.accentSoft : "transparent", borderLeft: `3px solid ${on ? C.accent : "transparent"}` }}>
                      <Dot st={st} />
                      <span className="flex-1 min-w-0"><span className="block text-sm truncate" style={{ fontWeight: on ? 600 : 450 }}>{l.name}</span>{(ph > 0 || st === "inherited") && <span className="block text-[10px] truncate" style={{ color: C.muted }}>{st === "inherited" && <>from {n.source}{ph > 0 ? " · " : ""}</>}{ph > 0 && <><Ic i={Camera} s={10} mr={3} />{ph} photo{ph === 1 ? "" : "s"}</>}</span>}</span>
                      {scopeChip(l)}
                    </button>); })}
                </div>
              ))}
              {hiddenEntries.length > 0 && (
                <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => setShowHidden(v => !v)} className="text-[11px]" style={{ color: C.muted }}>{hiddenEntries.length} hidden for {here} {showHidden ? "▾" : "▸"}</button>
                  {showHidden && <div className="mt-1.5 flex flex-col gap-1">{hiddenEntries.map(e => <div key={e.holderType + e.holderId + e.node.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate" style={{ color: C.muted }}>{e.node.name} <span className="text-[10px]">· hidden on {e.holderType === "category" ? e.holderName : "this product"}</span></span><button onClick={() => unhideEntry(e)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ border: `1px solid ${C.line}` }}>restore</button></div>)}</div>}
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
                {selInh && !hasNoteContent(selOwn) && (
                  <div className="rounded-lg p-3 mb-4" style={{ background: C.accentSoft, border: `1px solid ${C.accent}` }}>
                    <div className="flex items-center gap-2 mb-1.5"><InheritChip label={`inherited from ${selInh.source}`} /><span className="flex-1" />{onOpenCategory && <button onClick={() => onOpenCategory(selInh.categoryId)} className="text-[11px] underline" style={{ color: C.accent }}>edit on {selInh.source}</button>}</div>
                    {selInh.description && <p className="text-sm whitespace-pre-wrap mb-2">{selInh.description}</p>}
                    {asPhotoList(selInh.photos).length > 0 && <PhotoStrip photos={selInh.photos} size={72} />}
                    <p className="text-[11px] mt-2" style={{ color: C.muted }}>Applies to {here} as long as nothing is written below.</p>
                  </div>
                )}
                {selInh && hasNoteContent(selOwn) && <div className="flex items-center gap-2 mb-2 text-[11px]" style={{ color: C.muted }}><InheritChip label={`overrides ${selInh.source}`} /><button onClick={() => setShowInh(v => !v)} className="underline">{showInh ? "hide" : "show"} the category note</button></div>}
                {selInh && hasNoteContent(selOwn) && showInh && <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{selInh.description && <p className="whitespace-pre-wrap mb-2">{selInh.description}</p>}{asPhotoList(selInh.photos).length > 0 && <PhotoStrip photos={selInh.photos} size={56} />}</div>}
                <p className="label-sm mb-1" style={{ color: C.muted }}>{selInh && !hasNoteContent(selOwn) ? `Override for ${here} (optional)` : `How to recognise it on ${here}`}</p>
                <FastTextarea key={selLeaf.id} value={selOwn?.description || ""} onCommit={v => patchNote(selLeaf.id, { description: v })} rows={5} placeholder="What it looks like, where it usually appears, how to tell it from something harmless, when it is serious enough to reject…" className="mb-4" style={{ resize: "vertical" }} />
                <p className="label-sm mb-1" style={{ color: C.muted }}>Reference photos {asPhotoList(selOwn?.photos).length > 0 && `· ${asPhotoList(selOwn?.photos).length}`}</p>
                <PhotoStrip photos={selOwn?.photos} onAdd={got => patchNote(selLeaf.id, { photos: [...asPhotoList(selOwn?.photos), ...got] })} onRemove={id => patchNote(selLeaf.id, { photos: asPhotoList(selOwn?.photos).filter(x => x.id !== id) })} onReplace={(id, next) => patchNote(selLeaf.id, { photos: replacePhoto(selOwn?.photos, id, next) })} size={96} />
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => prev && setPick(prev.id)} disabled={!prev} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line }}>← {prev ? prev.name : "previous"}</button>
                  <button onClick={() => next && setPick(next.id)} disabled={!next} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line }}>{next ? next.name : "next"} →</button>
                  <span className="flex-1" />
                  {hasNoteContent(selOwn) && <button onClick={() => { if (window.confirm(`Clear the description and photos for “${selLeaf.name}”${selInh ? ` — the note from ${selInh.source} will apply again` : ""}?`)) patchNote(selLeaf.id, { description: "", photos: [] }); }} className="text-xs" style={{ color: C.muted }}>Clear entry</button>}
                </div>
              </div>
            ) : <Empty icon="👈" title="Pick a problem type" hint="Choose one on the left to describe it." />}
          </div>
        </div>
      )}
    </div>
  );
}

function EncyclopediaEditor({ s, set, kind, owner, onOpenCategory }) {
  const [pick, setPick] = useState(null); const [q, setQ] = useState(""); const [fresh, setFresh] = useState(null); const [showHidden, setShowHidden] = useState(false);
  useEffect(() => { setPick(null); setQ(""); }, [owner.id]);
  const isProduct = kind === "product";
  const here = isProduct ? "this product" : "this category";
  const patchOwner = ownerPatcher(set, kind, owner.id);
  const entries = owner.guide || [];
  const updGuide = fn => patchOwner(o => ({ ...o, guide: fn(o.guide || []) }));
  const addEntry = (title = "") => { const id = uid(); updGuide(g => [...g, { id, title, body: "", photos: [], createdAt: nowISO(), updatedAt: nowISO() }]); setPick(id); setFresh(id); setQ(""); };
  const patchEntry = (id, ch) => updGuide(g => g.map(e => e.id === id ? { ...e, ...ch, updatedAt: nowISO() } : e));
  const removeEntry = id => { const i = entries.findIndex(e => e.id === id); updGuide(g => g.filter(e => e.id !== id)); const rest = entries.filter(e => e.id !== id); setPick(rest[Math.min(i, rest.length - 1)]?.id || null); };
  const moveEntry = (id, dir) => updGuide(g => { const i = g.findIndex(e => e.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= g.length) return g; const n = [...g]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const hiddenIds = new Set(owner.hiddenGuideIds || []);
  const setHidden = (id, on) => patchOwner(o => ({ ...o, hiddenGuideIds: on ? [...new Set([...(o.hiddenGuideIds || []), id])] : (o.hiddenGuideIds || []).filter(x => x !== id) }));
  const inheritedAll = guideChainFor(s, isProduct ? owner.categoryId : owner.parentId);
  const inherited = inheritedAll.filter(e => !hiddenIds.has(e.id)), hiddenList = inheritedAll.filter(e => hiddenIds.has(e.id));
  const hasContent = e => !!((e.title || "").trim() || (e.body || "").trim() || asPhotoList(e.photos).length);
  const photoTotal = [...entries, ...inherited].reduce((a, e) => a + asPhotoList(e.photos).length, 0);
  const all = [...entries, ...inherited];
  const selId = pick && all.some(e => e.id === pick) ? pick : (all[0]?.id || null);
  const sel = entries.find(e => e.id === selId); const selInh = inherited.find(e => e.id === selId);
  const qq = q.trim().toLowerCase(); const match = e => !qq || `${e.title || ""} ${e.body || ""}`.toLowerCase().includes(qq);
  const visible = entries.filter(match), visibleInh = inherited.filter(match);
  const idx = entries.findIndex(e => e.id === selId); const prev = idx > 0 ? entries[idx - 1] : null, next = idx >= 0 && idx < entries.length - 1 ? entries[idx + 1] : null;
  const STARTERS = ["What a good pallet looks like", "Label and packaging", "Ripeness stages", "Storage and temperature", "Typical faults", "Calibre and sizing"];
  const starters = STARTERS.filter(t => !all.some(e => (e.title || "").trim().toLowerCase() === t.toLowerCase()));
  const snippet = e => (e.body || "").replace(/\s+/g, " ").trim().slice(0, 70);
  const Row = ({ e, n, inh }) => { const ph = asPhotoList(e.photos).length; const on = e.id === selId; return (
    <button onClick={() => setPick(e.id)} className="w-full text-left px-3 py-2 flex items-start gap-2" style={{ background: on ? C.accentSoft : "transparent", borderLeft: `3px solid ${on ? C.accent : "transparent"}`, borderBottom: `1px solid ${C.line}` }}>
      <span className="text-[10px] mt-0.5 flex-shrink-0 inline-flex items-center justify-center rounded-md" style={{ width: 18, height: 18, background: inh ? C.accentSoft : hasContent(e) ? C.bg : C.warnBg, color: inh ? C.accent : hasContent(e) ? C.muted : C.warn, fontVariantNumeric: "tabular-nums" }}>{inh ? <FolderTree size={10} /> : n}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm truncate" style={{ fontWeight: on ? 600 : 450, color: e.title ? C.ink : C.muted, fontStyle: e.title ? "normal" : "italic" }}>{e.title || "Untitled entry"}</span>
        {(snippet(e) || ph > 0 || inh) && <span className="block text-[11px] truncate" style={{ color: C.muted }}>{inh && <>from {e.source}{ph > 0 || snippet(e) ? " · " : ""}</>}{ph > 0 && <><Ic i={Camera} s={10} mr={3} />{ph}{snippet(e) ? " · " : ""}</>}{snippet(e)}</span>}
      </span>
    </button>); };
  return (
    <div style={{ maxWidth: 960 }}>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <p className="text-xs" style={{ color: C.muted, maxWidth: 560 }}>{isProduct
          ? <>Everything a controller should know about <b>this product</b> — what a good one looks like, packaging and label, ripeness, storage, typical faults. Entries written on the category show here too; hide the ones that don't apply.</>
          : <>Knowledge shared by <b>every product in this category</b>{owner.parentId ? "" : " and its sub-categories"} — write what is true for all of them once, here. Each product adds its own entries on top and can hide single inherited ones.</>}</p>
        {all.length > 0 && <span className="ml-auto text-xs" style={{ color: C.muted }}>{entries.length} own{inherited.length ? ` · ${inherited.length} inherited` : ""} · {photoTotal} photo{photoTotal === 1 ? "" : "s"}</span>}
      </div>
      {all.length === 0 ? (
        <div className="rounded-xl p-5" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
          <Empty icon="📖" title="No encyclopedia entries yet" hint="Start with one of the usual topics or write your own." />
          <div className="flex gap-1.5 flex-wrap justify-center mt-2">{starters.map(t => <button key={t} onClick={() => addEntry(t)} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: C.accentSoft, color: C.accent }}><Ic i={Plus} s={11} mr={3} />{t}</button>)}<button onClick={() => addEntry("")} className="text-xs px-2.5 py-1.5 rounded-full" style={{ background: C.ink, color: C.onDark }}><Ic i={Plus} s={11} mr={3} />Own entry</button></div>
        </div>
      ) : (
        <div className="flex gap-4 items-start">
          <aside className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 300, border: `1px solid ${C.line}`, background: C.surface }}>
            <div className="p-2" style={{ borderBottom: `1px solid ${C.line}` }}>
              <div className="flex gap-2"><div className="flex-1 min-w-0"><SearchBox value={q} onChange={setQ} placeholder="Search entries" size={13} /></div><Primary small onClick={() => addEntry("")}><Ic i={Plus} s={13} />Add</Primary></div>
            </div>
            <div style={{ maxHeight: 520, overflowY: "auto" }}>
              {visible.length === 0 && visibleInh.length === 0 && <p className="text-xs p-3" style={{ color: C.muted }}>Nothing matches.</p>}
              {visible.length > 0 && inherited.length > 0 && <p className="label-sm px-3 pt-2.5 pb-1" style={{ color: C.muted }}>Own · {here}</p>}
              {visible.map(e => <Row key={e.id} e={e} n={entries.indexOf(e) + 1} />)}
              {visible.length === 0 && entries.length === 0 && !qq && <p className="text-xs px-3 py-2.5" style={{ color: C.muted }}>Nothing written for {here} yet — everything below is inherited.</p>}
              {visibleInh.length > 0 && <p className="label-sm px-3 pt-2.5 pb-1" style={{ color: C.muted }}>Inherited from categories</p>}
              {visibleInh.map(e => <Row key={e.id} e={e} inh />)}
              {hiddenList.length > 0 && !qq && (
                <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => setShowHidden(v => !v)} className="text-[11px]" style={{ color: C.muted }}>{hiddenList.length} inherited entr{hiddenList.length === 1 ? "y" : "ies"} hidden for {here} {showHidden ? "▾" : "▸"}</button>
                  {showHidden && <div className="mt-1.5 flex flex-col gap-1">{hiddenList.map(e => <div key={e.id} className="flex items-center gap-2 text-xs"><span className="flex-1 truncate" style={{ color: C.muted }}>{e.title || "Untitled"} <span className="text-[10px]">· from {e.source}</span></span><button onClick={() => setHidden(e.id, false)} className="text-[11px] px-1.5 py-0.5 rounded" style={{ border: `1px solid ${C.line}` }}>restore</button></div>)}</div>}
                </div>
              )}
              {starters.length > 0 && !qq && (
                <div className="px-3 py-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
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
                  <p className="text-[11px]" style={{ color: C.muted }}>Entry {idx + 1} of {entries.length} · {here}</p>
                  <span className="flex-1" />
                  <button onClick={() => moveEntry(sel.id, -1)} disabled={!prev} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line }} title="Move up in the list">↑ up</button>
                  <button onClick={() => moveEntry(sel.id, 1)} disabled={!next} className="text-xs px-2 py-1 rounded-lg" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line }} title="Move down in the list">↓ down</button>
                </div>
                <p className="label-sm mb-1" style={{ color: C.muted }}>Entry name</p>
                <FastInput key={sel.id + ":t"} autoFocus={fresh === sel.id} value={sel.title || ""} onCommit={v => patchEntry(sel.id, { title: v })} placeholder="e.g. Label and packaging" className="mb-3 text-base font-semibold" style={{ height: 38 }} />
                <p className="label-sm mb-1" style={{ color: C.muted }}>Description</p>
                <FastTextarea key={sel.id + ":b"} value={sel.body || ""} onCommit={v => patchEntry(sel.id, { body: v })} rows={7} placeholder="What to look for, how to judge it, what is normal and what is not…" className="mb-4" style={{ resize: "vertical" }} />
                <p className="label-sm mb-1" style={{ color: C.muted }}>Photos {asPhotoList(sel.photos).length > 0 && `· ${asPhotoList(sel.photos).length}`}</p>
                <PhotoStrip photos={sel.photos} onAdd={got => patchEntry(sel.id, { photos: [...asPhotoList(sel.photos), ...got] })} onRemove={pid => patchEntry(sel.id, { photos: asPhotoList(sel.photos).filter(x => x.id !== pid) })} onReplace={(id, next) => patchEntry(sel.id, { photos: replacePhoto(sel.photos, id, next) })} size={96} />
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => prev && setPick(prev.id)} disabled={!prev} className="text-xs px-3 py-1.5 rounded-lg truncate" style={{ border: `1px solid ${C.line}`, color: prev ? C.ink : C.line, maxWidth: 200 }}>← {prev ? (prev.title || "Untitled") : "previous"}</button>
                  <button onClick={() => next && setPick(next.id)} disabled={!next} className="text-xs px-3 py-1.5 rounded-lg truncate" style={{ border: `1px solid ${C.line}`, color: next ? C.ink : C.line, maxWidth: 200 }}>{next ? (next.title || "Untitled") : "next"} →</button>
                  <span className="flex-1" />
                  {sel.updatedAt && <span className="text-[10px]" style={{ color: C.muted }}>updated {fmtTime(sel.updatedAt)}</span>}
                  <button onClick={() => { if (!hasContent(sel) || window.confirm(`Delete “${sel.title || "this entry"}”?`)) removeEntry(sel.id); }} className="text-xs" style={{ color: C.bad }}>Delete entry</button>
                </div>
              </div>
            ) : selInh ? (
              <div className="rounded-xl p-4" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
                <div className="flex items-center gap-2 mb-3"><InheritChip label={`inherited from ${selInh.source}`} /><span className="flex-1" />{onOpenCategory && <button onClick={() => onOpenCategory(selInh.categoryId)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}><Ic i={Pencil} s={12} />Edit on {selInh.source}</button>}</div>
                <h3 className="text-lg font-semibold leading-tight mb-2">{selInh.title || "Untitled entry"}</h3>
                {selInh.body && <p className="text-sm whitespace-pre-wrap mb-3">{selInh.body}</p>}
                {asPhotoList(selInh.photos).length > 0 && <PhotoStrip photos={selInh.photos} size={96} />}
                <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
                  <span className="text-[11px]" style={{ color: C.muted }}>Read-only here — it belongs to the category and shows on every product in it.</span>
                  <span className="flex-1" />
                  <button onClick={() => setHidden(selInh.id, true)} className="text-xs" style={{ color: C.muted }}>Hide for {here}</button>
                </div>
              </div>
            ) : <Empty icon="👈" title="Pick an entry" hint="Choose one on the left to edit it." />}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductsPage({ s, set, sel, setSel, presetFilter, clearPreset, onMessage, onOpenInspection, onOpenCategory, user }) {
  const [d, setD] = useState({ name: "", articleId: "", categoryId: "", isBio: false, cusPerTu: "", piecesPerCu: "", weightPerCu: "" });
  const [filter, setFilter] = useState(""); const [importOpen, setImportOpen] = useState(false); const [importText, setImportText] = useState(""); const [importMsg, setImportMsg] = useState("");
  useEffect(() => { if (presetFilter) { setFilter(presetFilter); clearPreset && clearPreset(); } }, [presetFilter]);
  const [supQ, setSupQ] = useState("");
  const [tab, setTab] = useState("profile"); const [newOpen, setNewOpen] = useState(false);
  const [histResult, setHistResult] = useState("all"); const [histProblem, setHistProblem] = useState("");
  useEffect(() => { setTab("profile"); setHistResult("all"); setHistProblem(""); }, [sel]);
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
  const unassigned = s.products.filter(p => !p.categoryId).length;
  const catFilterOptions = [
    ...(unassigned > 0 ? [{ value: "none", label: `No category · ${countIn("none")}` }] : []),
    ...roots.map(c => ({ value: c.id, label: `${c.name} · ${countIn(c.id)}` })),
  ];
  if (catSel && catSel !== "none" && !catFilterOptions.some(o => o.value === catSel)) {
    const cur = s.categories.find(c => c.id === catSel);
    if (cur) catFilterOptions.push({ value: cur.id, label: `${cur.name} · ${countIn(cur.id)}` });
  }
  const visible = s.products.filter(p => (showInactive || p.isActive !== false) && inCat(p, catSel) && (!onlyBio || p.isBio) && (!filter || (p.name + " " + (p.articleId || "")).toLowerCase().includes(filter.toLowerCase())))
    .sort((a, b) => sortBy === "az" ? a.name.localeCompare(b.name) : sortBy === "id" ? String(a.articleId || "").localeCompare(String(b.articleId || "")) : sortBy === "cat" ? catPath(a.categoryId).localeCompare(catPath(b.categoryId)) || a.name.localeCompare(b.name) : 0);
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
  const thumb = pr => { const ph = asPhotoList(pr.photos)[0]; return ph ? <img src={thumbSrc(ph)} loading="lazy" decoding="async" alt="" className="rounded-md object-cover flex-shrink-0" style={{ width: 30, height: 30 }} /> : <span className="rounded-md flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: C.bg, color: C.muted }}><Ic i={Package} s={14} mr={0} /></span>; };
  const refCount = product ? effectiveNotesFor(s, product).length : 0;
  const histAll = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed" && countsAs(s, i)) : [];
  const histVerdict = histAll.filter(i => isVerdictType(s, i));
  const histInfo = histAll.filter(i => !isVerdictType(s, i));
  const refInsp = product ? referenceOf(s, product.id) : null;
  const markRef = id => product && toggleReferenceInspection(set, product.id, id);
  const completedForProduct = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")) : [];
  const tabs = product ? [["profile", "Profile"], ["photos", `Photos${asPhotoList(product.photos).length ? ` · ${asPhotoList(product.photos).length}` : ""}`], ["specs", `Specifications${effectiveSpecs(s, product).length ? ` · ${effectiveSpecs(s, product).length}` : ""}`], ["attrs", `Properties${effectiveAttributes(s, product).length ? ` · ${effectiveAttributes(s, product).length}` : ""}`], ["supply", `Suppliers${(product.supplierIds || []).length ? ` · ${(product.supplierIds || []).length}` : ""}`], ["reference", `Reference guide${refCount ? ` · ${refCount}` : ""}`], ["guide", `Encyclopedia${effectiveGuide(s, product).length ? ` · ${effectiveGuide(s, product).length}` : ""}`], ["history", `Inspection history${histAll.length ? ` · ${histAll.length}` : ""}`], ["refreport", "Reference report"], ["policy", "Inspection types"]] : [];
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
          <Field label="Category *"><SearchSelect value={d.categoryId} onChange={v => setD(x => ({ ...x, categoryId: v }))} options={s.categories.map(c => ({ value: c.id, label: catPath(c.id) }))} placeholder="Search categories…" /></Field>
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
                {asPhotoList(product.photos)[0] ? <img src={thumbSrc(asPhotoList(product.photos)[0])} loading="lazy" decoding="async" alt="" className="rounded-lg object-contain flex-shrink-0" style={{ width: 52, height: 52, background: PHOTO_BG }} /> : <button onClick={() => setTab("photos")} className="rounded-lg flex items-center justify-center flex-shrink-0" style={{ width: 52, height: 52, background: C.bg, color: C.muted, border: `1px dashed ${C.line}` }}><Ic i={ImageIcon} s={18} mr={0} /></button>}
                <div className="flex-1 min-w-0">
                  <h2 className="truncate" style={{ fontSize: 16 }}>{product.name}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-mono" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{product.articleId || "no ID"}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}`, color: product.categoryId ? C.ink : C.warn }}>{product.categoryId ? catPath(product.categoryId) : "no category"}</span>
                    {product.isBio && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.okBg, color: C.ok }}>bio</span>}
                    <button type="button" onClick={() => setTab("refreport")} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center" style={refInsp ? { background: C.okBg, color: C.ok } : { background: C.bg, border: `1px solid ${C.line}`, color: C.muted }} title={refInsp ? "Open the reference report" : "No reference report yet"}><Ic i={Star} s={11} mr={3} />{refInsp ? "Reference report" : "No reference report"}</button>
                    {product.sortable && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: product.sortable.value ? C.okBg : C.bg, color: product.sortable.value ? C.ok : C.muted, border: product.sortable.value ? "none" : `1px solid ${C.line}` }} title="from the commercial spec sheet">{product.sortable.value ? "sortable" : "not sortable"}</span>}
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
                  <div className="rounded-xl px-3 py-2.5 mb-4 flex items-center gap-2" style={refInsp ? { background: C.okBg } : { background: C.bg, border: `1px solid ${C.line}` }}>
                    <Ic i={Star} s={14} mr={0} style={{ color: refInsp ? C.ok : C.muted }} />
                    <div className="flex-1 min-w-0 text-sm" style={{ color: refInsp ? C.ok : C.ink }}>
                      {refInsp
                        ? <>Reference report · {s.users.find(u => u.id === refInsp.controllerId)?.name} · {fmtTime(refInsp.completedAt)} · {refInsp.result || "—"}</>
                        : <>No reference report yet — the example controllers open to see what a good pallet looks like.</>}
                    </div>
                    <button type="button" onClick={() => setTab("refreport")} className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0" style={{ color: refInsp ? C.ok : C.accent, border: `1px solid ${refInsp ? C.ok : C.line}` }}>{refInsp ? "Open" : "Set one"}</button>
                  </div>
                  <ComplaintsNote s={s} articleId={product.articleId} />
                  <LiveNote product={product} /><ExtRejectionsNote s={s} articleId={product.articleId} />
                  <Group title="Identity" cols={6}>
                    <Field label="Name" className="col-span-4"><FastInput value={product.name} onCommit={v => patchP({ name: v })} /></Field>
                    <Field label="Article ID"><FastInput value={product.articleId || ""} onCommit={v => patchP({ articleId: v })} className="font-mono" style={{ borderColor: product.articleId ? C.line : C.warn }} /></Field>
                    <Field label="Bio"><button onClick={() => patchP({ isBio: !product.isBio })} className="w-full text-[13px] rounded-md" style={{ height: 32, border: `1px solid ${product.isBio ? C.ok : C.line}`, background: product.isBio ? C.okBg : C.surface, color: product.isBio ? C.ok : C.muted }}>{product.isBio ? "bio" : "no"}</button></Field>
                    <Field label="Category" className="col-span-3"><SearchSelect value={product.categoryId || ""} onChange={v => patchP({ categoryId: v || null })} options={s.categories.map(c => ({ value: c.id, label: catPath(c.id) }))} placeholder="Search categories…" style={{ borderColor: product.categoryId ? C.line : C.warn }} /></Field>
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
                  <PhotoStrip photos={product.photos} onAdd={got => patchP({ photos: [...asPhotoList(product.photos), ...got] })} onRemove={id => patchP({ photos: asPhotoList(product.photos).filter(x => x.id !== id) })} onReplace={(id, next) => patchP({ photos: replacePhoto(product.photos, id, next) })} />
                </div>}
                {tab === "specs" && <div style={{ maxWidth: 720 }}>
                  <SpecForm sctx={s} set={set} user={s.users.find(u => u.role === "Head")} ownerKind="product" ownerId={product.id} specs={product.specs} inherited={effectiveSpecs(s, product, { applyTemp: false }).filter(q => q.source !== "product")} onAdd={q => patchP({ specs: [...product.specs, q] })} onUpdate={(id, fields) => patchP({ specs: product.specs.map(q => q.id === id ? applySpecEdit(q, fields) : q) })} onRemove={removeSpec} excluded={product.excludedSpecNames || []} onExclude={n => patchP({ excludedSpecNames: [...(product.excludedSpecNames || []), n] })} onRestore={n => patchP({ excludedSpecNames: (product.excludedSpecNames || []).filter(x => x !== n) })} hint="Own specifications override inherited ones of the same name. Most belong on the category — only exceptions here. Temp on a row is for this product only. Edit keeps the same specification — forms stay linked." />
                </div>}
                {tab === "attrs" && <div style={{ maxWidth: 720 }}>
                  <AttributeForm s={s} own={product.attributes || []} inherited={effectiveAttributes(s, product).filter(a => a.source !== "product")} onSet={a => patchP({ attributes: [...(product.attributes || []).filter(x => x.dictionaryId !== a.dictionaryId), a] })} onRemove={did => patchP({ attributes: (product.attributes || []).filter(x => x.dictionaryId !== did) })} hint="Values from Lists. Own values override the category's; they pre-fill form fields bound to the same list. An answer that differs is flagged on the form." />
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
                {tab === "reference" && <ReferenceGuideEditor s={s} set={set} kind="product" owner={product} onOpenCategory={onOpenCategory} />}
                {tab === "guide" && <EncyclopediaEditor s={s} set={set} kind="product" owner={product} onOpenCategory={onOpenCategory} />}
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
                          <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: problemTally.length ? "1fr 1fr" : "1fr", maxWidth: 520 }}>
                            <select value={histResult} onChange={e => { setHistResult(e.target.value); setHistProblem(""); }} className="text-sm rounded-md px-2 py-1.5 outline-none" style={{ ...inp }}>
                              <option value="all">all · {histVerdict.length}</option>
                              <option value="Accepted">accepted · {acceptedCount}</option>
                              <option value="Rejected">rejected · {rejectedCount}</option>
                            </select>
                            {problemTally.length > 0 && (
                              <select value={histProblem} onChange={e => setHistProblem(e.target.value)} className="text-sm rounded-md px-2 py-1.5 outline-none" style={{ ...inp }}>
                                <option value="">all remark types</option>
                                {problemTally.map(pr => <option key={pr.name} value={pr.name}>{pr.name} · {pr.count}</option>)}
                              </select>
                            )}
                          </div>
                          {rows.length === 0 ? <p className="text-xs py-4" style={{ color: C.muted }}>Nothing matches.</p> : rows.map(i => {
                            const [fg, bg] = i.result === "Accepted" ? [C.ok, C.okBg] : [C.bad, C.badBg];
                            const rem = (i.remarks || []).map(r => pm[r.leafId]?.name).filter(Boolean);
                            return (
                              <div key={i.id} className="flex items-center gap-2 px-2 py-2 rounded-lg" style={{ borderTop: `1px solid ${C.line}`, background: i.isReference ? C.okBg : "transparent" }}>
                                <button onClick={() => onOpenInspection && onOpenInspection(i.id)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                                  <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: bg, color: fg, fontWeight: 500 }}>{i.result}</span>
                                  <span className="flex-1 text-xs min-w-0 truncate" style={{ color: rem.length ? C.ink : C.muted }}>{i.isReference && <Ic i={Star} s={11} mr={4} style={{ color: C.ok }} />}{rem.length ? rem.join(", ") : "no remarks"}<span className="ml-1.5 font-mono" style={{ color: C.muted }}>{String(i.id).toUpperCase()}</span></span>
                                  <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{s.users.find(u => u.id === i.controllerId)?.name} · {fmtTime(i.completedAt)}</span>
                                </button>
                                <button type="button" onClick={() => markRef(i.id)} className="text-[11px] px-1.5 whitespace-nowrap" style={{ color: i.isReference ? C.ok : C.accent }}>{i.isReference ? "unmark" : "use as reference"}</button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })()}
                {tab === "refreport" && <div style={{ maxWidth: 760 }}>
                  <p className="text-xs mb-3" style={{ color: C.muted }}>The reference report is the example controllers open to see what a good pallet looks like. One per product — mark it here or on the inspection itself.</p>
                  {refInsp ? (
                    <ReportView insp={refInsp} s={s} user={user} onEdit={() => onOpenInspection && onOpenInspection(refInsp.id)} onAnswer={() => {}} onMarkReference={() => markRef(refInsp.id)} />
                  ) : (
                    <Empty icon={Star} title="No reference report" hint="Pick a completed inspection below, or open one and click Mark as reference." />
                  )}
                  {completedForProduct.length > 0 && (
                    <div className="mt-4">
                      <p className="label-sm mb-1">{refInsp ? "Use a different inspection" : "Completed inspections"}</p>
                      {completedForProduct.map(i => {
                        const [fg, bg] = i.result === "Accepted" ? [C.ok, C.okBg] : i.result === "Rejected" ? [C.bad, C.badBg] : [C.muted, C.line];
                        return (
                          <div key={i.id} className="flex items-center gap-2 py-2" style={{ borderTop: `1px solid ${C.line}` }}>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: bg, color: fg }}>{i.result || inspType(s, i).name}</span>
                            <span className="flex-1 text-xs min-w-0 truncate" style={{ color: C.muted }}>{s.users.find(u => u.id === i.controllerId)?.name} · {fmtTime(i.completedAt)}<span className="ml-1.5 font-mono">{String(i.id).toUpperCase()}</span></span>
                            <button type="button" onClick={() => markRef(i.id)} className="text-xs" style={{ color: i.isReference ? C.ok : C.accent }}>{i.isReference ? "unmark" : "use as reference"}</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>}
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
          <span style={{ minWidth: 220, display: "inline-block" }}><SearchSelect value={catSel} onChange={setCatSel} options={catFilterOptions} empty={`All categories · ${countIn("")}`} placeholder="Search categories…" searchFrom={6} /></span>
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
              <button key={p.id} onClick={() => selectProduct(p.id)} className="qc-elev qc-tile rounded-2xl p-2.5 text-left" style={{ background: sel === p.id ? C.accentSoft : C.surface, border: `1px solid ${sel === p.id ? C.accent : C.line}`, opacity: p.isActive === false ? .55 : 1 }}>
                {asPhotoList(p.photos).length ? <img src={thumbSrc(asPhotoList(p.photos)[0])} loading="lazy" decoding="async" alt="" className="w-full rounded-xl object-contain mb-2" style={{ height: 72, background: PHOTO_BG }} /> : <div className="w-full rounded-xl flex items-center justify-center mb-2" style={{ height: 72, background: C.bg, color: C.muted }}><Ic i={Package} s={20} mr={0} /></div>}
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

function FieldEditor({ f, onPatch, onRemove, problems, catalog, specs, specsHint, dictionaries, sctxForNames, grip, open, onToggle, justAdded }) {
  const leaves = problems.filter(p => isLeaf(problems, p.id));
  // catalog = what this form's scope actually sees; a linked problem outside it (other category, or hidden here) still fires — flag it so the Head knows.
  const inScope = id => !catalog || catalog.some(p => p.id === id);
  const scopeNote = id => id && !inScope(id) ? <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: C.warnBg, color: C.warn }} title="This problem type is not in this scope's catalog (scoped to another category or hidden here). The form links it explicitly, so it will still be raised.">outside this scope · still raised</span> : null;
  const setOpts = v => onPatch({ options: v });
  if (isSystem(f.type)) {
    const st = SYSTEM_TYPES[f.type];
    return (
      <div className="rounded-lg p-2.5 mb-1.5 flex items-center gap-2" style={{ background: C.accentSoft, border: `1px solid ${C.accentSoft}` }}>
        {grip}<span className="label-sm px-1.5 py-0.5 rounded" style={{ background: C.accent, color: C.onDark }}>system</span>
        <input value={f.label} onChange={e => onPatch({ label: e.target.value })} className="text-sm font-medium bg-transparent outline-none w-44" style={{ color: C.accent }} />
        <span className="flex-1 text-xs" style={{ color: C.muted }}>{st.desc}</span>
        <button onClick={onRemove} className="text-xs px-1" style={{ color: C.muted }}>×</button>
      </div>
    );
  }
  // Still the builder's placeholder text (and no specification name to fall back to) — this exact label is what
  // will show up in the "Parameters" section of the PDF report, so make it impossible to miss here.
  const unrenamed = fieldLabel(f) === "New field";
  const hasDetails = ["List", "SingleChoice", "MultiChoice", "Scale", "Number"].includes(f.type);
  const typeLabel = FIELD_TYPES.find(([k]) => k === f.type)?.[1] || f.type;
  // Collapsed: one scannable line — what it is, what it's called, the few settings that matter. Click to edit.
  if (!open) return (
    <div className="rounded-lg mb-1.5 flex items-center gap-2 px-2.5 py-2" style={{ background: C.bg, border: `1px solid ${unrenamed ? C.warn : C.line}` }}>
      {grip}
      <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: C.accentSoft, color: C.accent }}>{typeLabel}</span>
      <button type="button" onClick={onToggle} className="flex-1 min-w-0 text-left text-sm font-medium truncate" style={{ color: unrenamed ? C.warn : C.ink }} title={unrenamed ? "Still the default name — this prints on the PDF" : undefined}>{unrenamed ? "⚠ unnamed field — click to name it" : fieldLabel(f)}</button>
      {f.required && <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: C.warnBg, color: C.warn }}>required</span>}
      {f.allowPhotos && <span className="inline-flex items-center" style={{ color: C.accent }} title="the controller can attach photos"><Ic i={Camera} s={12} mr={0} /></span>}
      {fieldSummary(f, dictionaries).map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap hidden md:inline" style={{ background: C.line, color: C.muted }}>{t}</span>)}
      <button type="button" onClick={onToggle} className="text-xs px-2 py-1 rounded-lg" style={{ background: C.accentSoft, color: C.accent }}>edit</button>
      <button onClick={onRemove} className="text-xs px-1" style={{ color: C.muted }} title="delete field">×</button>
    </div>
  );
  // Expanded: grouped — identity first, then rules, then type-specific options and the rarely-needed extras.
  return (
    <div className="rounded-lg p-3 mb-1.5" style={{ background: C.surface, border: `1px solid ${C.accent}` }}>
      <div className="flex items-center gap-2 mb-2">
        {grip}
        <select value={f.type} onChange={e => onPatch({ type: e.target.value })} className="text-xs rounded px-1.5 py-1 outline-none" style={{ ...inp }} title="field type">{FIELD_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <input autoFocus={!!justAdded} onFocus={e => { if (justAdded) e.target.select(); }} value={f.label} onChange={e => onPatch({ label: e.target.value })} placeholder="field name — shown in the PDF" title={unrenamed ? "Still the default \"New field\" label — this is what will print on the report" : undefined} className="flex-1 text-sm rounded px-2 py-1 outline-none" style={{ ...inp, fontWeight: 500, minWidth: 140, borderColor: unrenamed ? C.warn : C.line }} />
        {unrenamed && <span className="text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap" style={{ background: C.warnBg, color: C.warn }} title="Rename it — this is what prints on the PDF">⚠ unnamed</span>}
        <button type="button" onClick={onToggle} className="text-xs px-2.5 py-1 rounded-lg font-semibold" style={{ background: C.accentSoft, color: C.accent }}>done</button>
        <button onClick={onRemove} className="text-xs px-1" style={{ color: C.muted }} title="delete field">×</button>
      </div>
      <input value={f.helper || ""} onChange={e => onPatch({ helper: e.target.value })} placeholder="helper text for the controller (optional)" title="FormField.HelperText" className="w-full text-xs rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 text-xs mb-1" style={{ color: C.muted }}>
        <label className="flex items-center gap-1.5" style={{ color: f.required ? C.ink : C.muted }}><input type="checkbox" checked={!!f.required} onChange={e => onPatch({ required: e.target.checked })} />Required</label>
        <label className="flex items-center gap-1.5" style={{ color: f.allowPhotos ? C.accent : C.muted }} title="the controller can attach photos to this answer (InspectionPhoto.AnswerId)"><input type="checkbox" checked={!!f.allowPhotos} onChange={e => onPatch({ allowPhotos: e.target.checked })} /><Ic i={Camera} s={12} mr={0} />Photos allowed</label>
        {f.type === "Number" && <select value={f.measureBasis || "piece"} onChange={e => onPatch({ measureBasis: e.target.value })} title="what the controller measures — one piece or a whole CU" className="text-xs" style={{ minHeight: 28 }}><option value="piece">measure per piece</option><option value="cu">measure per CU</option></select>}
      </div>
      {f.type === "Number" && <details className="text-xs mb-1" style={{ color: C.muted }}><summary className="cursor-pointer select-none">Advanced</summary><span className="flex items-center gap-2 mt-1.5">metric key <input value={f.key || ""} onChange={e => onPatch({ key: slugKey(e.target.value) || null })} placeholder={metricKey(f)} title="FormField.Key — stable metric key for analytics across templates (defaults to the specification name)" className="w-40 text-xs rounded px-2 py-1 outline-none font-mono" style={{ ...inp }} /></span></details>}
      {hasDetails && <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${C.line}` }}><>
      {f.type === "List" && <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mb-1 text-xs" style={{ color: C.muted }}>
        <span className="flex items-center gap-1">list: <select value={f.dictionaryId || ""} onChange={e => onPatch({ dictionaryId: e.target.value || null })} className="text-xs" style={{ minHeight: 28 }}><option value="">— pick a list —</option>{(dictionaries || []).map(d => <option key={d.id} value={d.id}>{d.name} ({d.items.length})</option>)}</select>{!(dictionaries || []).length && <span style={{ color: C.warn }}>no lists yet — Dictionaries → Lists</span>}</span>
        <span className="flex items-center gap-1 flex-wrap w-full" title="When the product (or its category) has a property from this list, an answer that differs from it raises this problem. Leave empty for a warning only.">doesn't match the specification → raises: <span style={{ flex: "1 1 180px", minWidth: 0 }}><SearchSelect size="xs" value={f.problemMismatchId || ""} onChange={v => onPatch({ problemMismatchId: v || null })} options={leaves.map(l => ({ value: l.id, label: pathOf(problems, l.id) + (inScope(l.id) ? "" : " · outside this scope") }))} empty="— warning —" placeholder="Search problems…" style={{ borderColor: f.problemMismatchId ? C.accent : C.line }} /></span>{scopeNote(f.problemMismatchId)}</span>
      </div>}
      {f.type === "SingleChoice" && <input value={f.optionsRaw ?? (f.options || []).join(", ")} onChange={e => onPatch({ optionsRaw: e.target.value, options: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} placeholder="options separated by commas, e.g. Spain, Morocco" className="w-full text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} />}
      {f.type === "MultiChoice" && (
        <div>
          <p className="text-xs mb-1" style={{ color: C.muted }}><Ic i={Flag} s={12} mr={4} />= ticking immediately flags the inspection (TriggersGeneralProblem)</p>
          {(f.options || []).map((o, i) => <div key={i} className="flex items-center gap-1.5 mb-1"><input value={o.value} onChange={e => setOpts(f.options.map((x, j) => j === i ? { ...x, value: e.target.value } : x))} className="flex-1 text-xs rounded px-2 py-1 outline-none" style={{ ...inp }} /><label className="text-xs flex items-center gap-1" style={{ color: o.trigger ? C.warn : C.muted }}><input type="checkbox" checked={!!o.trigger} onChange={e => setOpts(f.options.map((x, j) => j === i ? { ...x, trigger: e.target.checked } : x))} />🚩</label><button onClick={() => setOpts(f.options.filter((_, j) => j !== i))} className="text-xs" style={{ color: C.muted }}>×</button></div>)}
          <button onClick={() => setOpts([...(f.options || []), { value: "new option", trigger: false }])} className="text-xs" style={{ color: C.accent }}>+ option</button>
        </div>
      )}
      {f.type === "Scale" && <span className="text-xs flex items-center gap-1" style={{ color: C.muted }}>max. <input type="number" value={f.scaleMax ?? 5} onChange={e => onPatch({ scaleMax: Number(e.target.value) || 5 })} className="w-20 rounded px-2 py-1 text-sm outline-none" style={{ ...inp }} /></span>}
      {f.type === "Number" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs" style={{ color: C.muted }}>
          <span className="flex items-center gap-1">measurements <input type="number" value={f.measurementCount ?? 1} onChange={e => onPatch({ measurementCount: Number(e.target.value) || 1 })} className="w-20 rounded px-2 py-1 text-sm outline-none" style={{ ...inp }} /></span>
          <span className="flex items-center gap-1 w-full" title="Leave empty for a typed number. With values here the controller picks one from a dropdown (search from 11 values); the values outside the specification are labelled with the problem they raise.">answer from a list of values: <input value={f.choicesRaw ?? (f.choices || []).join(", ")} onChange={e => onPatch({ choicesRaw: e.target.value, choices: e.target.value.split(/[,;\s]+/).map(x => x.trim()).filter(x => x !== "" && !isNaN(Number(x))).map(Number).sort((a, b) => a - b).map(String) })} placeholder="empty = typed number · e.g. 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7" className="flex-1 rounded px-1.5 py-0.5 outline-none font-mono" style={{ ...inp, borderColor: (f.choices || []).length ? C.ok : C.line }} />{(f.choices || []).length > 0 && <span style={{ color: C.ok }}>{f.choices.length} values → dropdown</span>}</span>
          <span className="flex items-center gap-1">specification by name: <input list={"spec-names-" + f.id} value={f.specName ?? ""} onChange={e => { const v = e.target.value; const patch = { specName: v }; if (v.trim() && (!f.label || !f.label.trim() || f.label.trim().toLowerCase() === "new field")) patch.label = v; onPatch(patch); }} onBlur={e => { if (sctxForNames && e.target.value.trim() && !nearSpecName(sctxForNames, e.target.value)) onPatch({ specName: canonicalSpecName(sctxForNames, e.target.value) }); }} placeholder={f.label} className="w-40 rounded px-2 py-1 text-sm outline-none" style={{ ...inp, borderColor: (f.specName || "").trim() ? C.ok : C.line }} title="matches the product specification with this name; empty = field label. Also fills the label above, if it's still the default." /><datalist id={"spec-names-" + f.id}>{(sctxForNames ? specRegistry(sctxForNames) : []).map(e => <option key={e.name} value={e.name} />)}</datalist>{(() => { const n = sctxForNames ? nearSpecName(sctxForNames, f.specName || "") : null; return n ? <button onClick={() => onPatch({ specName: n.name })} className="text-[11px] underline ml-1" style={{ color: C.warn }}>did you mean {n.name}?</button> : null; })()}</span>
          {specs && <span className="flex items-center gap-1">or explicitly: <span style={{ minWidth: 160, display: "inline-block" }}><SearchSelect size="xs" value={f.specId || ""} onChange={v => { const specId = v || null; const patch = { specId }; if (specId && (!f.label || !f.label.trim() || f.label.trim().toLowerCase() === "new field")) { const sp = specs.find(sq => sq.id === specId); if (sp) patch.label = sp.name; } onPatch(patch); }} options={specs.map(q => ({ value: q.id, label: `${q.name} (${specLabel(q)})` }))} empty="— by name —" placeholder="Search specs…" style={{ borderColor: f.specId ? C.ok : C.line }} /></span></span>}
          <span className="flex items-center gap-1">or min <input type="number" value={f.min ?? ""} onChange={e => onPatch({ min: e.target.value === "" ? null : e.target.value })} className="w-20 rounded px-2 py-1 text-sm outline-none" style={{ ...inp }} /> max <input type="number" value={f.max ?? ""} onChange={e => onPatch({ max: e.target.value === "" ? null : e.target.value })} className="w-20 rounded px-2 py-1 text-sm outline-none" style={{ ...inp }} /></span>
          <span className="flex items-center gap-1">below raises: <span style={{ minWidth: 180, display: "inline-block" }}><SearchSelect size="xs" value={f.problemBelowId || ""} onChange={v => onPatch({ problemBelowId: v || null })} options={leaves.map(l => ({ value: l.id, label: pathOf(problems, l.id) + (inScope(l.id) ? "" : " · outside this scope") }))} empty="— warning —" placeholder="Search problems…" style={{ borderColor: f.problemBelowId ? C.accent : C.line }} /></span>{scopeNote(f.problemBelowId)}</span>
          <span className="flex items-center gap-1">above raises: <span style={{ minWidth: 180, display: "inline-block" }}><SearchSelect size="xs" value={f.problemAboveId || ""} onChange={v => onPatch({ problemAboveId: v || null })} options={leaves.map(l => ({ value: l.id, label: pathOf(problems, l.id) + (inScope(l.id) ? "" : " · outside this scope") }))} empty="— warning —" placeholder="Search problems…" style={{ borderColor: f.problemAboveId ? C.accent : C.line }} /></span>{scopeNote(f.problemAboveId)}</span>
        </div>
      )}
      </></div>}
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
  if (f.type === "List") return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mt-1" style={{ color: C.muted }}>
      <span className="px-1 rounded" style={{ background: has ? C.accentSoft : "transparent", color: C.accent }}>{has ? "overridden here:" : "override here:"}</span>
      <span className="flex items-center gap-1">doesn't match <select value={f.problemMismatchId || ""} onChange={e => onOverride({ problemMismatchId: e.target.value || null })} className="rounded px-1 py-0.5 outline-none" style={{ ...inp, borderColor: ov.problemMismatchId !== undefined ? C.accent : C.line }}><option value="">— warning —</option>{leaves.map(l => <option key={l.id} value={l.id}>{pathOf(problems, l.id)}</option>)}</select></span>
      {has && <button onClick={onReset} className="underline" style={{ color: C.muted }}>undo overrides</button>}
    </div>
  );
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
  const reveal = id => setOpenMods(c => { const n = new Set(c); n.add(id); return n; });
  const addModule = () => { const id = uid(); reveal(id); up(x => ({ ...x, modules: [...x.modules, { id, name: "New module", sort: (Math.max(-1, ...eff.allModules.map(m => m.sort)) + 1) }] })); };
  const removeOwnModule = id => up(x => ({ ...x, modules: x.modules.filter(m => m.id !== id), fields: x.fields.filter(f => f.moduleId !== id), problemRefs: x.problemRefs.filter(r => r.moduleId !== id) }));
  const suppress = id => up(x => ({ ...x, suppressed: [...new Set([...(x.suppressed || []), id])] }));
  const unsuppress = id => up(x => ({ ...x, suppressed: (x.suppressed || []).filter(i => i !== id) }));
  const addField = (mid, ftype = "Text") => { const nid_ = uid(); setJustAdded(nid_); setOpenFields(c => new Set(c).add(nid_)); reveal(mid); up(x => ({ ...x, fields: [...x.fields, { id: nid_, moduleId: mid, sort: Math.max(-1, ...eff.allFields.filter(f => f.moduleId === mid).map(f => f.sort)) + 1, type: ftype, label: "New field", required: false, measurementCount: 1, problemBelowId: null, problemAboveId: null, specId: null, min: null, max: null }] })); };
  const patchField = (id, p) => up(x => ({ ...x, fields: x.fields.map(f => f.id === id ? { ...f, ...p } : f) }));
  const removeOwnField = id => up(x => ({ ...x, fields: x.fields.filter(f => f.id !== id) }));
  const addSystem = (mid, type) => { if (!type) return; reveal(mid); up(x => ({ ...x, fields: [...x.fields, { id: uid(), moduleId: mid, sort: Math.max(-1, ...eff.allFields.filter(f => f.moduleId === mid).map(f => f.sort)) + 1, type, label: SYSTEM_TYPES[type].label, required: !["Photos", "Escalate"].includes(type) }] })); };
  const addRef = (mid, pid) => { if (!pid) return; reveal(mid); up(x => ({ ...x, problemRefs: [...x.problemRefs, { id: uid(), moduleId: mid, problemTypeId: pid, sort: Math.max(-1, ...eff.allRefs.map(r => r.sort)) + 1 }] })); };
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
    applyOrder(key, reordered);
  };
  const applyOrder = (key, reordered) => {
    up(x => {
      let nx = { ...x, fieldOverrides: { ...(x.fieldOverrides || {}) } };
      reordered.forEach((it, idx) => {
        if (it.ownerId === own.id) nx[key] = nx[key].map(q => q.id === it.id ? { ...q, sort: idx } : q);
        else if (it.sort !== idx) nx.fieldOverrides[it.id] = { ...(nx.fieldOverrides[it.id] || {}), sort: idx };
      });
      return nx;
    });
  };
  // Drag & drop reordering (fields within their module, modules among themselves). Only the grip is draggable, so
  // typing in a field never starts a drag; the card under the pointer shows an accent line where the item will land.
  const [openFields, setOpenFields] = useState(() => new Set()); const [justAdded, setJustAdded] = useState(null);
  const [pickerFor, setPickerFor] = useState(null); const [dragOver, setDragOver] = useState(null); const dragRef = useRef(null);
  const toggleField = id => setOpenFields(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const dropOn = (key, targetId) => {
    const d = dragRef.current; dragRef.current = null; setDragOver(null);
    if (!d || d.key !== key || d.id === targetId || !own) return;
    const list = eff[key]; const item = list.find(i => i.id === d.id), tgt = list.find(i => i.id === targetId); if (!item || !tgt) return;
    if (key !== "modules" && item.moduleId !== tgt.moduleId) return;
    const sib = list.filter(i => key === "modules" ? true : i.moduleId === item.moduleId).sort(bySort);
    const from = sib.findIndex(q => q.id === d.id), to = sib.findIndex(q => q.id === targetId); if (from < 0 || to < 0) return;
    const re = [...sib]; const [mv] = re.splice(from, 1); re.splice(to, 0, mv); applyOrder(key, re);
  };
  const grip = (key, id) => own ? <span draggable onDragStart={e => { dragRef.current = { key, id }; try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); const card = e.currentTarget.closest("[data-card]"); if (card) e.dataTransfer.setDragImage(card, 12, 12); } catch {} }} onDragEnd={() => { dragRef.current = null; setDragOver(null); }} className="flex-shrink-0 cursor-grab select-none inline-flex" style={{ color: C.muted }} title="drag to reorder"><Ic i={GripVertical} s={14} mr={0} /></span> : null;
  const dropProps = (key, id) => own ? { "data-card": "1", onDragOver: e => { if (dragRef.current?.key === key) { e.preventDefault(); if (dragOver !== id) setDragOver(id); } }, onDrop: e => { e.preventDefault(); dropOn(key, id); } } : {};
  const dropStyle = id => dragOver === id ? { boxShadow: `0 -3px 0 0 ${C.accent}` } : {};
  const usedIds = new Set(eff.problemRefs.map(r => r.problemTypeId));
  const usedSystem = new Set(eff.fields.filter(f => isSystem(f.type) && SYSTEM_TYPES[f.type].once).map(f => f.type));
  const hasProblems = eff.problemRefs.length > 0, hasSample = eff.fields.some(f => f.type === "SampleSize");
  const referenced = new Set(eff.problemRefs.flatMap(r => [...subtree(problems, r.problemTypeId)]));
  const orphanLinks = eff.fields.flatMap(f => f.type === "Number" ? [f.problemBelowId, f.problemAboveId].filter(id => id && !referenced.has(id)).map(id => ({ f, id })) : f.type === "List" ? [f.problemMismatchId].filter(id => id && !referenced.has(id)).map(id => ({ f, id })) : []);
  const pm = byId(problems);
  const hiddenIn = mid => [...eff.allFields.filter(f => f.moduleId === mid && eff.suppressed.has(f.id)), ...eff.allRefs.filter(r => r.moduleId === mid && eff.suppressed.has(r.id)).map(r => ({ ...r, label: pm[r.problemTypeId]?.name, isRef: true }))];
  const hiddenModules = eff.allModules.filter(m => eff.suppressed.has(m.id));
  const [openMods, setOpenMods] = useState(() => new Set());
  const toggleMod = id => setOpenMods(c => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const Tag = ({ item }) => isOwn(item) ? <span className="text-[10px] px-1 rounded" style={{ background: C.accentSoft, color: C.accent }}>own</span> : <span className="text-[10px] px-1 rounded" style={{ background: C.line, color: C.muted }}>from: {item.ownerLabel}</span>;
  return (
    <div style={readOnly ? { opacity: 0.6, pointerEvents: "none" } : undefined}>
      {modules.length === 0 && <Note>The template has no modules yet. A module is a tab in the inspection — put fields, system blocks and problem branches from the catalog into it.</Note>}
      {modules.length > 0 && !hasProblems && <Note tone="warn">The form has <b>no problem branch</b> — the controller won't be able to report anything.</Note>}
      {hasProblems && !hasSample && <Note tone="warn">There are problem branches but no <b>Sample size</b> block — the percentage engine will have no divisor.</Note>}
      {orphanLinks.map(({ f, id }) => <Note key={f.id + id} tone="warn">Field “{f.label}“ raises problem <b>{pm[id]?.name}</b>, but no branch containing it is attached to a module.</Note>)}
      {modules.length > 0 && <div className="flex justify-end gap-3 mb-2"><button type="button" onClick={() => setOpenMods(new Set(modules.map(m => m.id)))} className="text-xs" style={{ color: C.accent }}>Expand all</button><button type="button" onClick={() => setOpenMods(new Set())} className="text-xs" style={{ color: C.muted }}>Collapse all</button></div>}
      {modules.map((m, i) => (
        <div key={m.id} {...dropProps("modules", m.id)} className="rounded-xl p-3 mb-3" style={{ background: C.surface, border: `1px solid ${isOwn(m) ? C.accent : C.line}`, ...dropStyle(m.id) }}>
          <div className="flex items-center gap-2 mb-2">
            {grip("modules", m.id)}<button type="button" onClick={() => toggleMod(m.id)} className="flex-shrink-0" style={{ color: C.muted }} title={openMods.has(m.id) ? "collapse" : "expand"}><Ic i={openMods.has(m.id) ? ChevronDown : ChevronRight} s={14} mr={0} /></button>
            <span className="text-xs w-5 h-5 rounded-full flex items-center justify-center" style={{ background: C.accentSoft, color: C.accent }}>{i + 1}</span>
            {isOwn(m) ? <input value={m.name} onChange={e => patchModule(m.id, { name: e.target.value })} className="flex-1 text-sm font-semibold rounded px-2 py-1 outline-none" style={{ ...inp }} /> : <span className="flex-1 text-sm font-semibold px-2">{m.name}</span>}
            {!openMods.has(m.id) && <span className="text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap" style={{ background: C.line, color: C.muted }}>{eff.fields.filter(f => f.moduleId === m.id).length} fields · {eff.problemRefs.filter(r => r.moduleId === m.id).length} problems</span>}
            <Tag item={m} />
            {own && <><button onClick={() => moveItem("modules", m.id, -1)} className="text-xs px-1" style={{ color: C.muted }}>↑</button><button onClick={() => moveItem("modules", m.id, 1)} className="text-xs px-1" style={{ color: C.muted }}>↓</button></>}
            {isOwn(m) ? <button onClick={() => removeOwnModule(m.id)} className="text-xs px-1" style={{ color: C.muted }}>×</button>
              : own && <button onClick={() => suppress(m.id)} className="text-xs px-1.5" style={{ color: C.muted }} title="hide the whole module at this level">hide</button>}
          </div>
          {openMods.has(m.id) && <>
          {eff.fields.filter(f => f.moduleId === m.id).sort(bySort).map(f => isOwn(f)
            ? <div key={f.id} {...dropProps("fields", f.id)} style={dropStyle(f.id)}><FieldEditor f={f} grip={grip("fields", f.id)} open={openFields.has(f.id)} onToggle={() => toggleField(f.id)} justAdded={justAdded === f.id} onPatch={p => patchField(f.id, p)} onRemove={() => removeOwnField(f.id)} problems={problems} catalog={catalog} specs={specs} specsHint={specsHint} dictionaries={s.dictionaries || []} sctxForNames={s} /></div>
            : (
              <div key={f.id} {...dropProps("fields", f.id)} className="rounded-lg p-2.5 mb-1.5" style={{ background: C.bg, border: `1px dashed ${C.line}`, ...dropStyle(f.id) }}>
                <div className="flex items-center gap-2">
                  {grip("fields", f.id)}<span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs" style={{ color: C.muted }}>{isSystem(f.type) ? "system" : FIELD_TYPES.find(([k]) => k === f.type)?.[1]}</span>
                  <Tag item={f} />
                  {f.overriddenBy && <span className="text-[10px] px-1 rounded" style={{ background: C.accentSoft, color: C.accent }}>overridden: {f.overriddenLabel}</span>}
                  <div className="flex-1" />
                  {own && <><button onClick={() => suppress(f.id)} className="text-xs px-1.5" style={{ color: C.muted }} title="hide at this level">hide</button></>}
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
              <Ghost onClick={() => setPickerFor(pickerFor === m.id ? null : m.id)}>{pickerFor === m.id ? "× cancel" : "+ field"}</Ghost>
              <Ghost onClick={() => addSystem(m.id, "Photos")}><Ic i={Camera} s={12} mr={4} />+ photos block</Ghost>
              <select value="" onChange={e => addSystem(m.id, e.target.value)} className="text-xs rounded px-2 py-1.5 outline-none" style={{ ...inp, background: C.accentSoft, color: C.accent, border: "none" }}>
                <option value="">+ system block…</option>
                {Object.entries(SYSTEM_TYPES).filter(([k]) => !usedSystem.has(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              {problems.length === 0 ? <span className="text-xs" style={{ color: C.muted }}>problem catalog empty</span> : <span style={{ minWidth: 220, display: "inline-block" }}><SearchSelect size="xs" value="" onChange={v => v && addRef(m.id, v)} options={catalog.filter(p => !usedIds.has(p.id)).map(p => ({ value: p.id, label: pathOf(catalog, p.id) }))} empty="+ problem branch from catalog…" placeholder="Search problems…" /></span>}
            </div>
          )}
          {own && pickerFor === m.id && <div className="grid gap-1.5 mt-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>{FIELD_TYPES.map(([k, l]) => <button key={k} type="button" onClick={() => { addField(m.id, k); setPickerFor(null); }} className="text-left rounded-lg px-2.5 py-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span className="block text-sm font-medium">{l}</span><span className="block text-[11px]" style={{ color: C.muted }}>{FIELD_TYPE_HINTS[k]}</span></button>)}</div>}
          </>}
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
  const problems = product ? withLinkedProblems(s, problemsFor(s, { kind: "Product", id: product.id }, new Set((t && t.suppressed) || [])), t) : [];
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap"><span className="text-xs" style={{ color: C.muted }}>Preview as the controller would see it for:</span><span style={{ minWidth: 260, display: "inline-block" }}><SearchSelect value={pid} onChange={v => { if (v) setPid(v); }} options={products.map(p => ({ value: p.id, label: p.articleId ? `${p.name} · ${p.articleId}` : p.name }))} empty="— product —" placeholder="Search products…" searchFrom={6} /></span><span className="text-xs" style={{ color: C.muted }}>{t ? `composition: ${chainLabel(layerChain(s, { kind: "Product", id: pid }, typeId), s)}` : "no form for this type yet"}</span></div>
      {insp && t ? (
        <div className="rounded-3xl p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
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
  // The controller preview sits next to the builder instead of on its own tab — a field shows up as the controller
  // will see it the moment it's added. Collapsible so the builder can take the full width when wanted.
  const [preview, setPreview] = useState(true);
  const [layerQ, setLayerQ] = useState("");
  const [newReason, setNewReason] = useState("");
  const [layersOpen, setLayersOpen] = useState(true);
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
  // Start a category layer as a copy of another category's layer (same type). Own items get fresh ids (module references
  // re-pointed), while suppressions / overrides of inherited items are kept only where the inherited item also exists here.
  const copySources = scope.kind === "Category" ? s.templates.filter(x => x.scope === "Category" && (x.typeId || "type-full") === typeId && x.categoryId !== scope.id && (x.modules.length + x.fields.length + x.problemRefs.length + (x.suppressed || []).length + Object.keys(x.fieldOverrides || {}).length + (x.overrides || []).length) > 0) : [];
  const createFrom = srcId => { const src = s.templates.find(x => x.id === srcId); if (!src) return; const parent = compose(s, layerChain(s, scope, typeId)); const validIds = new Set([...parent.modules, ...parent.fields, ...parent.problemRefs].map(x => x.id));
    const deep = JSON.parse(JSON.stringify(src)); const idMap = {}; const nid = old => (idMap[old] = idMap[old] || uid());
    const modules = (deep.modules || []).map(m => ({ ...m, id: nid(m.id) }));
    const fields = (deep.fields || []).map(f => ({ ...f, id: nid(f.id), moduleId: idMap[f.moduleId] || f.moduleId }));
    const problemRefs = (deep.problemRefs || []).map(r => ({ ...r, id: nid(r.id), moduleId: idMap[r.moduleId] || r.moduleId }));
    const nt = { ...emptyTemplate("Category", { typeId, categoryId: scope.id }), modules, fields, problemRefs, overrides: deep.overrides || [], suppressed: (deep.suppressed || []).filter(id => validIds.has(id)), fieldOverrides: Object.fromEntries(Object.entries(deep.fieldOverrides || {}).filter(([k]) => validIds.has(k))), copiedFrom: { templateId: src.id, categoryId: src.categoryId, at: nowISO() } };
    set(x => ({ ...x, templates: [...x.templates, nt] })); };
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
      <div className="flex items-center gap-1 mb-4" style={{ borderBottom: `1px solid ${C.line}` }}>{[["build", "Build form"], ["type", "Type settings"]].map(([k, l]) => <button key={k} onClick={() => setTab(k)} className="text-sm px-3 py-2" style={{ borderBottom: `2px solid ${tab === k ? C.accent : "transparent"}`, color: tab === k ? C.ink : C.muted, fontWeight: tab === k ? 600 : 450, marginBottom: -1 }}>{l}</button>)}</div>
      {tab === "type" && (
        <Card style={{ maxWidth: 640 }}>
          <div className="flex items-center gap-2 mb-3"><input type="color" value={type.color} onChange={e => patchType({ color: e.target.value })} className="w-9 h-9 p-0.5 rounded-lg" style={{ minHeight: 0 }} /><input value={type.name} onChange={e => patchType({ name: e.target.value })} className="flex-1 text-base font-semibold" /></div>
          <input value={type.description || ""} onChange={e => patchType({ description: e.target.value })} placeholder="one line for controllers: what this type is for" className="w-full text-sm mb-4" />
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={!!type.autoAccept} onChange={e => patchType({ autoAccept: e.target.checked })} className="mt-1" /><span>Auto-accept on finish<span className="block text-xs" style={{ color: C.muted }}>No Accept / Reject buttons. Finishing records “Accepted”. Use for checks that only leave a trace (visual, skip).</span></span></label>
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={type.countsAsInspection !== false} onChange={e => patchType({ countsAsInspection: e.target.checked })} className="mt-1" /><span>Counts as an inspection<span className="block text-xs" style={{ color: C.muted }}>Included in “done today”, averages and analytics. Turn off for skips — a trace, not work.</span></span></label>
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={type.summary !== false} onChange={e => patchType({ summary: e.target.checked })} className="mt-1" /><span>Summary step<span className="block text-xs" style={{ color: C.muted }}>A final “Summary” tab with the problem overview, remarks, comment and verdict. Turn off for quick types — the last module then ends with the Accept / Reject and Finish controls.</span></span></label>
          <div className="flex items-center gap-3 text-sm py-2.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">Reason on finish<span className="block text-xs" style={{ color: C.muted }}>Quick reason chips {type.summary === false ? "at the end of the last module" : "in the summary"} — you define them below.</span></span><select value={type.reason || "none"} onChange={e => patchType({ reason: e.target.value })} className="text-sm"><option value="none">none</option><option value="optional">optional</option><option value="required">required</option></select></div>
          {(type.reason || "none") !== "none" && (() => { const list = typeReasons(type); const setList = next => patchType({ reasons: next });
            const add = () => { const v = newReason.trim(); if (!v || list.some(x => x.toLowerCase() === v.toLowerCase())) { setNewReason(""); return; } setList([...list, v]); setNewReason(""); };
            const move = (i, d) => { const j = i + d; if (j < 0 || j >= list.length) return; const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; setList(n); };
            return (
            <div className="pb-3">
              <p className="text-xs mb-2" style={{ color: C.muted }}>Reasons the controller can pick — they appear as chips {type.summary === false ? "at the end of the last module" : "in the summary"}. Past inspections keep the wording they were saved with.</p>
              {list.length === 0 && <Note tone="warn">No reasons yet — until you add at least one, the controller sees no reason picker{type.reason === "required" ? " (and “required” is not enforced)" : ""}.</Note>}
              {list.map((r, i) => <div key={i} className="flex items-center gap-1.5 mb-1.5"><input value={r} onChange={e => setList(list.map((x, j) => j === i ? e.target.value : x))} onBlur={e => { if (!e.target.value.trim()) setList(list.filter((_, j) => j !== i)); }} className="flex-1 text-sm rounded px-2.5 py-1.5 outline-none" style={{ ...inp }} /><button onClick={() => move(i, -1)} disabled={i === 0} className="text-xs px-1.5" style={{ color: C.muted, opacity: i === 0 ? .3 : 1 }} title="up">↑</button><button onClick={() => move(i, 1)} disabled={i === list.length - 1} className="text-xs px-1.5" style={{ color: C.muted, opacity: i === list.length - 1 ? .3 : 1 }} title="down">↓</button><button onClick={() => setList(list.filter((_, j) => j !== i))} className="text-xs px-1.5" style={{ color: C.muted }} title="remove reason">×</button></div>)}
              <div className="flex items-center gap-2 mt-2"><input value={newReason} onChange={e => setNewReason(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="new reason, e.g. “no time”" className="flex-1 text-sm rounded px-2.5 py-1.5 outline-none" style={{ ...inp }} /><Ghost onClick={add}>+ add</Ghost>{Array.isArray(type.reasons) && <button onClick={() => patchType({ reasons: undefined })} className="text-xs underline" style={{ color: C.muted }}>restore defaults</button>}</div>
            </div>); })()}
          <label className="flex items-start gap-3 text-sm py-2.5 cursor-pointer" style={{ borderTop: `1px solid ${C.line}` }}><input type="checkbox" checked={!!type.allowedByDefault} onChange={e => patchType({ allowedByDefault: e.target.checked })} className="mt-1" /><span>Allowed by default<span className="block text-xs" style={{ color: C.muted }}>Products without their own policy (or category policy) may use this type.</span></span></label>
          <div className="flex items-center gap-3 text-sm py-2.5" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">Order in the scanner</span><div className="flex gap-1">{types.map(t => t.id === typeId ? null : null)}<button onClick={() => set(x => { const arr = typesOf(x); const i = arr.findIndex(t => t.id === typeId); if (i <= 0) return x; const a = arr[i - 1]; return { ...x, inspectionTypes: x.inspectionTypes.map(t => t.id === typeId ? { ...t, sort: a.sort } : t.id === a.id ? { ...t, sort: arr[i].sort } : t) }; })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }}>↑</button><button onClick={() => set(x => { const arr = typesOf(x); const i = arr.findIndex(t => t.id === typeId); if (i < 0 || i >= arr.length - 1) return x; const b = arr[i + 1]; return { ...x, inspectionTypes: x.inspectionTypes.map(t => t.id === typeId ? { ...t, sort: b.sort } : t.id === b.id ? { ...t, sort: arr[i].sort } : t) }; })} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${C.line}` }}>↓</button></div></div>
          <div className="mt-4 flex items-center gap-3"><button onClick={deleteType} disabled={s.inspections.some(i => (i.typeId || legacyTypeId(i.type)) === typeId) || types.length <= 1} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.bad }}>Delete type</button><span className="text-[11px]" style={{ color: C.muted }}>{s.inspections.some(i => (i.typeId || legacyTypeId(i.type)) === typeId) ? "Used by existing inspections — cannot be deleted." : "Deletes its form layers too."}</span></div>
        </Card>
      )}
</>}
      {type && <div className="flex gap-5 items-start w-full" style={{ display: tab === "build" ? "flex" : "none" }}>
        <aside className="flex-shrink-0" style={{ width: layersOpen ? 208 : 44 }}>
          <div className="flex items-center gap-1 mb-1">{layersOpen && <p className="label-sm px-2 flex-1" style={{ color: C.muted }}>Layer</p>}<button onClick={() => setLayersOpen(v => !v)} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ color: C.muted }} title={layersOpen ? "Hide layers" : "Show layers"}><Ic i={layersOpen ? ChevronLeft : ChevronRight} s={14} mr={0} /></button></div>
          {layersOpen && <>
          <button onClick={() => setScope({ kind: "Global" })} className="w-full text-left text-sm px-2.5 py-2 rounded-lg mb-2" style={{ background: scope.kind === "Global" ? C.accentSoft : "transparent", color: scope.kind === "Global" ? C.accent : C.ink }}><Ic i={Globe} s={14} />Global<Dot on={!!globalT} /></button>
          <input value={layerQ} onChange={e => setLayerQ(e.target.value)} placeholder="Search categories and products…" className="w-full text-xs rounded-lg px-2 py-1.5 mb-2 outline-none" style={{ ...inp }} />
          {(() => { const lq = layerQ.trim().toLowerCase(); const cats = s.categories.filter(c => !lq || catPath(c).toLowerCase().includes(lq)); const prods = s.products.filter(p => !lq || p.name.toLowerCase().includes(lq) || (p.articleId || "").toLowerCase().includes(lq)); return (
            <div style={{ maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
              {cats.length > 0 && <p className="label-sm px-2 mb-1" style={{ color: C.muted }}>Categories</p>}
              {cats.map(c => { const has = s.templates.some(t => t.scope === "Category" && t.categoryId === c.id); return <button key={c.id} onClick={() => setScope({ kind: "Category", id: c.id })} className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg mb-0.5" style={{ background: scope.id === c.id ? C.accentSoft : "transparent", color: scope.id === c.id ? C.accent : C.ink, paddingLeft: c.parentId ? 22 : 10 }}>{catPath(c)}<Dot on={has} /></button>; })}
              {prods.length > 0 && <p className="label-sm px-2 mb-1 mt-3" style={{ color: C.muted }}>Products</p>}
              {prods.map(p => { const has = s.templates.some(t => t.scope === "Product" && t.productId === p.id); return <button key={p.id} onClick={() => setScope({ kind: "Product", id: p.id })} className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg mb-0.5 truncate" style={{ background: scope.id === p.id ? C.accentSoft : "transparent", color: scope.id === p.id ? C.accent : C.ink }}>{p.name}<Dot on={has} /></button>; })}
              {lq && !cats.length && !prods.length && <p className="text-xs px-2" style={{ color: C.muted }}>Nothing matches.</p>}
            </div>
          ); })()}
          </>}
        </aside>
        <div className="flex-1 min-w-0">
          {scope.kind === "Global" && !globalT && <Empty icon="🧩" title="No global template" hint="The starting point for every product. Build it once — modules, fields, problem branches from the catalog." action={<Primary onClick={create}>Create global template</Primary>} />}
          {scope.kind !== "Global" && !globalT && <Empty icon="🧩" title="Global template first" hint="Without a global template there is nothing to inherit from." action={<Primary onClick={() => setScope({ kind: "Global" })}>Go to global</Primary>} />}
          {globalT && scope.kind !== "Global" && !own && eff && (
            <>
              <div className="flex items-center gap-3 mb-3 flex-wrap"><Primary onClick={create}>Add own layer</Primary>
                {copySources.length > 0 && <span className="text-xs inline-flex items-center gap-2" style={{ color: C.muted }}>or copy from<span style={{ minWidth: 240, display: "inline-block" }}><SearchSelect size="xs" value="" onChange={v => v && createFrom(v)} options={copySources.map(x => { const c = s.categories.find(k => k.id === x.categoryId); const n = x.modules.length + x.fields.length + x.problemRefs.length; return { value: x.id, label: `${c ? catPath(c) : "?"} · ${n} own item${n === 1 ? "" : "s"}${(x.suppressed || []).length ? ` · ${x.suppressed.length} hidden` : ""}` }; })} empty="another category's form…" placeholder="Search categories…" /></span></span>}
                <span className="text-xs" style={{ color: C.muted }}>The inherited form below is read-only until this level has a layer of its own.</span></div>
              <Note tone="warn">This level <b>has no layer of its own</b> — you see the composition: {chainLabel(chain, s)}. Everything works as is. Add a layer only if you want to add, hide or override something here{scope.kind === "Product" ? " (e.g. explicitly link a field to this product's specification)" : ""}.</Note>
              <Builder eff={eff} own={null} setOwn={() => {}} problems={s.problems} specs={null} specsHint="—" readOnly s={s} scope={scope} />
            </>
          )}
          {own && eff && (
            <>
              <div className="flex items-center gap-3 mb-3 flex-wrap">
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: C.okBg, color: C.ok }}>{scope.kind === "Global" ? "global layer" : `own layer · ${ownCount} changes vs: ${chainLabel(parentChain, s) || "—"}`}</span>
                {own.copiedFrom && <span className="text-xs px-2 py-1 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>copied from {s.categories.find(c => c.id === own.copiedFrom.categoryId)?.name || "another category"}</span>}
                {scope.kind !== "Global" && <button onClick={drop} className="text-xs" style={{ color: C.muted }}>Remove layer — back to pure inheritance</button>}
              </div>
              {scope.kind === "Product" && product?.specs.length === 0 && effectiveSpecs(s, product).length === 0 && <Note tone="warn">This product has no specifications, own or from the category — measurement fields will have no reference.</Note>}
              <Builder eff={eff} own={own} setOwn={setOwn} problems={s.problems} specs={scope.kind === "Product" ? product?.specs : null} specsHint={specsHint} s={s} scope={scope} />
            </>
          )}
        </div>
        {preview && <aside className="flex-shrink-0 self-start sticky" style={{ width: 400, top: 72, maxHeight: "calc(100vh - 88px)", overflowY: "auto" }}>
          <div className="flex items-center gap-2 mb-2"><p className="label-sm flex-1" style={{ color: C.muted }}>Controller preview</p><button onClick={() => setPreview(false)} className="text-xs" style={{ color: C.muted }}>hide</button></div>
          <ControllerPreview s={s} typeId={typeId} scope={scope} setScope={setScope} />
        </aside>}
      </div>}
      {type && tab === "build" && !preview && <button onClick={() => setPreview(true)} className="fixed text-xs px-3 py-2 rounded-full inline-flex items-center gap-1.5" style={{ right: 24, bottom: 24, background: C.ink, color: C.onDark, boxShadow: "0 6px 16px rgba(0,0,0,.25)", zIndex: 30 }}><Ic i={Eye} s={13} mr={0} />Show preview</button>}
    </div>
  );
}

// ═══════════════════ PAGE: Inspection ═══════════════════
function RaiseForm({ problems, overrides, linkedId, totals, onRaise, intro }) {
  const lp = problems.find(p => p.id === linkedId);
  const zero = lp && effTol(problems, overrides || [], lp.id) === 0;
  const available = { PieceCount: totals.pieces > 0, DirectWeight: totals.weight > 0, WholeUnitCount: totals.cu > 0 };
  const firstMode = Object.keys(available).find(k => available[k]) || "WholeUnitCount";
  const [mode, setMode] = useState(firstMode);
  const [raw, setRaw] = useState("");
  const unit = mode === "PieceCount" ? "pcs" : mode === "DirectWeight" ? "g" : "CU";
  return (
    <div className="rounded-lg p-2 mt-1.5" style={{ background: C.warnBg }}>
      <p className="text-xs mb-1.5" style={{ color: C.warn }}>{intro} → problem <b>{lp?.name}</b>.{zero ? " Tolerance 0% — presence alone is enough." : " How many are affected and in which unit?"}</p>
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
  );
}
function ListInput({ f, spec, value, problems, allProblems, overrides, totals, onRaise, raised, picker }) {
  const check = listCheck(spec, value);
  const linkedId = linkedProblemId(allProblems || problems, problems, f.problemMismatchId);
  const lp = linkedId && problems.find(p => p.id === linkedId);
  const bad = check && !check.ok;
  const expected = spec && spec.value && spec.value !== "—" ? spec.value : check?.expected;
  return (
    <div>
      {picker}
      {expected && !bad && <p className="text-[11px] mt-1" style={{ color: check ? C.ok : C.muted }}>{check ? "✓ Matches the specification" : "Specification"}: <b>{expected}</b>{spec?.source && spec.source !== "product" ? <span style={{ color: C.muted }}> · {spec.source}</span> : null}</p>}
      {bad && !lp && <div className="rounded-lg px-3 py-1.5 mt-1.5 text-xs" style={{ background: C.warnBg, color: C.warn }}>Doesn't match the specification (expected <b>{check.expected}</b>) — warning only.</div>}
      {bad && lp && !raised && <RaiseForm problems={problems} overrides={overrides} linkedId={linkedId} totals={totals} onRaise={onRaise} intro={<>Doesn't match the specification (expected <b>{check.expected}</b>)</>} />}
      {bad && lp && raised && <p className="text-xs mt-1.5" style={{ color: C.ok }}>✓ {lp.name} reported from this field.</p>}
    </div>
  );
}
function NumberInput({ f, problems, allProblems, overrides, specs, totals, value, onChange, onRaise, raised, piecesPerCu }) {
  const n = f.measurementCount || 1, ms = value?.measurements || Array(n).fill("");
  const belowId = linkedProblemId(allProblems || problems, problems, f.problemBelowId), aboveId = linkedProblemId(allProblems || problems, problems, f.problemAboveId);
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
  const linkedId = side === "below" ? belowId : side === "above" ? aboveId : null;
  const lp = linkedId && problems.find(p => p.id === linkedId);
  // "Answer from a list": fixed allowed values (see the form builder). The dropdown is just the numbers;
  // average / out-of-spec / raising work after a pick, same as a typed number.
  const choices = Array.isArray(f.choices) ? f.choices.filter(v => v !== "" && v !== null && !isNaN(Number(v))) : [];
  const choiceOptions = choices.map(v => ({ value: String(v), label: String(v) }));
  const setM = (i, v) => onChange({ measurements: ms.map((x, j) => j === i ? v : x) });
  return (
    <div>
      {choices.length
        ? <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(n, 3)}, minmax(0,1fr))` }}>{ms.map((m, i) => <SearchSelect key={i} value={m === "" ? "" : String(m)} onChange={v => setM(i, v)} options={choiceOptions} empty={n > 1 ? `reading ${i + 1}` : "— choose —"} placeholder="Search values…" searchFrom={11} />)}</div>
        : <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>{ms.map((m, i) => <input key={i} type="number" value={m} onChange={e => setM(i, e.target.value)} placeholder={`reading ${i + 1}`} className="text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />)}</div>}
      {lim.note && <p className="text-[11px] mt-1" style={{ color: C.muted }}>{lim.note}</p>}
      {spec?.temp && <p className="text-[11px] mt-1" style={{ color: C.warn }}>Temporary spec {tempUntilLabel(spec.temp)}{spec.temp.note ? ` — ${spec.temp.note}` : ""}</p>}
      {avg !== null && <p className="text-xs mt-1.5" style={{ color: C.muted }}>average <b style={{ color: C.ink }}>{fmt(avg)}</b>{ref ? ` · reference ${ref}${byName ? ` (by name “${spec.name}"${spec.source !== "product" ? ", " + spec.source : ""})` : ""}` : (f.problemBelowId || f.problemAboveId) ? <span style={{ color: C.warn }}> · no reference — the product has no specification “{(f.specName || "").trim() || f.label}“ and the field has no min/max</span> : ""}</p>}
      {bad && !lp && <div className="rounded-lg px-3 py-1.5 mt-1.5 text-xs" style={{ background: C.warnBg, color: C.warn }}>Out of spec — warning only.</div>}
      {bad && lp && !raised && <RaiseForm problems={problems} overrides={overrides} linkedId={linkedId} totals={totals} onRaise={onRaise} intro="Out of spec" />}
      {raised && <p className="text-xs mt-1.5" style={{ color: C.ok }}>✓ {lp?.name} reported from this field.</p>}
    </div>
  );
}
function ProblemTreeView({ root, problems, overrides, remarks, onReport, onDelete, onPhoto, onRemovePhoto, onReplacePhoto, totals, disabled, notes }) {
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
          <div key={r.id} className="mb-1" style={{ paddingLeft: dep * 14 + 12 }}>
            <div className="flex items-center gap-2 text-xs py-1" style={{ color: C.muted }}>
              <span className="flex-1">↳ {r.mode === "Presence" ? "present" : `${r.raw} ${unitOf(r.mode)}`}{r.auto && " · from measurement"}</span>
              {r.mode !== "Presence" && <span className="font-medium" style={{ color: C.ink }}>{fmt(pct(r, totals))}%</span>}
              <button onClick={() => onDelete(r.id)} className="px-1" style={{ color: C.bad }} title="delete report">×</button>
            </div>
            <PhotoStrip photos={r.photos} onAdd={got => onPhoto && onPhoto(r.id, got)} onRemove={onRemovePhoto ? pid => onRemovePhoto(r.id, pid) : null} onReplace={onReplacePhoto ? (pid, next) => onReplacePhoto(r.id, pid, next) : null} size={44} addLabel="Photo" />
          </div>
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
  const refs = [...(t.problemRefs || [])].sort(bySort).map(r => pm[r.problemTypeId]).filter(Boolean);
  const covered = new Set(refs.flatMap(n => [...subtree(problems, n.id)]));
  const extra = [...new Set(remarks.map(r => r.leafId).filter(id => !covered.has(id)))].map(id => pm[id]).filter(Boolean);
  const rows = [...refs, ...extra];
  if (!rows.length) return null;
  const Bar = ({ node }) => {
    const row = reportStatusFields({ name: node.name, agg: aggregate(problems, remarks, node.id, totals), ownTol: effTol(problems, t.overrides, node.id), present: presenceIn(problems, remarks, node.id), state: statusOf(problems, t.overrides, remarks, node.id, totals), remarkTols: tolsUnder(problems, t.overrides, remarks, node.id) });
    const [fg, bg] = tone(row.state);
    const width = row.found === "present" ? 100 : row.ratio === null ? 0 : Math.min(100, row.ratio * 100);
    const label = `${row.found} / ${row.tolerance}`;
    return (
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1"><span className="font-medium">{node.name}</span><span style={{ color: fg, fontWeight: 500 }}>{label}{row.tolerance === "0%" && " ⚡"}</span></div>
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
  // An empty list must never trap the controller behind a "required" reason with nothing to pick.
  const reasonList = typeReasons(itype); const reasonShown = !!itype.reason && itype.reason !== "none" && reasonList.length > 0; const reasonRequired = itype.reason === "required" && reasonList.length > 0;
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
  const addPhotos = (key, got) => setPhotos(p => ({ ...p, [key]: [...asPhotoList(p[key]), ...pickedPhotos(got)] }));
  const removePhoto = (key, id) => setPhotos(p => ({ ...p, [key]: asPhotoList(p[key]).filter(x => x.id !== id) }));
  const replaceFieldPhoto = (key, id, next) => setPhotos(p => ({ ...p, [key]: replacePhoto(p[key], id, next) }));
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
  // Types can skip the Summary step (Forms → type → "Summary step"): then the last module ends with the finish controls.
  const hasSummary = itype.summary !== false;
  // Soft validation: required fields left empty get ONE reminder on Finish (with jumps to the fields); finishing anyway
  // is allowed, but the report records it and the Head is notified.
  const isEmptyValue = f => { const v = values[f.id]; if (f.type === "MultiChoice") return !(v || []).length; if (f.type === "Photos") return !asPhotoList(photos[f.id]).length; return v === undefined || v === null || String(v).trim() === ""; };
  const missingRequired = t.fields.filter(f => f.required && !isSystem(f.type) && isEmptyValue(f)).map(f => ({ id: f.id, label: fieldLabel(f), moduleIx: modules.findIndex(mm => mm.id === f.moduleId) }));
  const [remind, setRemind] = useState(false);
  const tryFinish = () => { if (missingRequired.length && !remind) { setRemind(true); return; } const result = itype.autoAccept && !insp.result ? "Accepted" : insp.result; if (result && result !== insp.result) set({ result }); onFinish({ anyExceeded, generalFlag, autoAccept: itype.autoAccept, missingRequired: missingRequired.map(f => f.label), result }); };
  const isSummary = hasSummary && tab === modules.length, m = modules[Math.min(tab, modules.length - 1)];
  const isLastModule = !hasSummary && tab >= modules.length - 1;
  const specs = effectiveSpecs(sctx, product);
  const editingCompleted = insp.status === "Completed";
  const wantPo = !!(sctx && settingsOf(sctx).requirePoOnReject);
  const sheetPo = sctx ? sheetPoForInspection(dockRowsLive(sctx), insp) : { fromSheet: false, pos: [] };
  const poMissing = poRequiredOnReject(wantPo, insp.result, insp.po);
  useEffect(() => {
    if (!wantPo || insp.result !== "Rejected" || String(insp.po || "").trim()) return;
    const sug = suggestedPo(insp, sheetPoForInspection(sctx ? dockRowsLive(sctx) : [], insp));
    if (sug) set({ po: sug });
  }, [insp.result, (insp.pallets || []).join("|")]);
  const finishControls = (
    <>
      {reasonShown && <div className="mt-4"><p className="text-sm font-medium mb-1">Reason {reasonRequired ? <span style={{ color: C.bad }}>*</span> : <span className="text-xs font-normal" style={{ color: C.muted }}>(optional)</span>}</p><div className="flex flex-wrap gap-1.5">{reasonList.map(r => <button key={r} onClick={() => set({ skipReason: insp.skipReason === r ? null : r })} className="text-xs px-3 py-1.5 rounded-full" style={{ background: insp.skipReason === r ? C.ink : "transparent", color: insp.skipReason === r ? C.onDark : C.ink, border: `1px solid ${insp.skipReason === r ? C.ink : C.line}` }}>{r}</button>)}</div></div>}
      {itype.autoAccept && <Note tone="ok">{itype.name}: finishing records “Accepted” — no verdict needed. Problems you report still go to the Head.</Note>}
      {!itype.autoAccept && <div className="flex gap-2 mt-4">{[["Accepted", "Accept", C.ok, C.okBg], ["Rejected", "Reject", C.bad, C.badBg]].map(([v, l, fg, bg]) => <button key={v} onClick={() => !escalated && set({ result: v })} disabled={escalated} className="flex-1 py-2 rounded-lg text-sm font-medium" style={{ background: escalated ? C.line : insp.result === v ? fg : bg, color: escalated ? C.muted : insp.result === v ? C.onDark : fg }}>{l}</button>)}</div>}
      {wantPo && insp.result === "Rejected" && <div className="mt-3"><p className="text-sm font-medium mb-1">PO{poMissing ? <span style={{ color: C.bad }}> *</span> : null}</p><input value={insp.po || ""} onChange={e => set({ po: e.target.value })} placeholder="Purchase order" className="w-full text-sm rounded px-2 py-1.5 outline-none font-mono" style={{ ...inp, borderColor: poMissing ? C.bad : C.line }} /><p className="text-xs mt-1" style={{ color: poMissing ? C.warn : C.muted }}>{poSourceHint(sheetPo)}</p></div>}
      {insp.result === "Accepted" && (anyExceeded || generalFlag) && <p className="text-xs mt-2" style={{ color: C.warn }}>Accepted despite the numbers — the Head will be notified. Status and decision are independent axes.</p>}
      {remind && missingRequired.length > 0 && <div className="rounded-xl px-3.5 py-3 mt-4" style={{ background: C.warnBg, border: `1px solid ${C.warn}` }}>
        <p className="text-sm font-semibold flex items-center" style={{ color: C.warn }}><Ic i={AlertTriangle} s={14} />{missingRequired.length} required field{missingRequired.length === 1 ? "" : "s"} still empty</p>
        <div className="flex flex-wrap gap-1.5 mt-2">{missingRequired.map(f => <button key={f.id} onClick={() => setTab(Math.max(0, f.moduleIx))} className="text-xs px-2.5 py-1 rounded-full inline-flex items-center gap-1" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>{f.label}<Ic i={ChevronRight} s={11} mr={0} /></button>)}</div>
        <p className="text-xs mt-2" style={{ color: C.ink }}>Tap a field to fill it in, or press <b>Finish anyway</b> — the report will say which fields were left empty and the Head gets a notification.</p>
      </div>}
      <div className="mt-4 flex items-center gap-3">
        <Primary onClick={tryFinish} disabled={escalated || (!itype.autoAccept && !insp.result) || (reasonRequired && !insp.skipReason) || poMissing}>{remind && missingRequired.length ? "Finish anyway" : editingCompleted ? "Save changes (audited)" : itype.autoAccept ? `Finish — ${itype.name.toLowerCase()} done` : "Finish inspection"}</Primary>
        {!itype.autoAccept && !insp.result && !escalated && <span className="text-xs" style={{ color: C.muted }}>choose a result to finish</span>}
        {reasonRequired && !insp.skipReason && <span className="text-xs" style={{ color: C.muted }}>pick a reason to finish</span>}
        {poMissing && <span className="text-xs" style={{ color: C.muted }}>enter the PO to finish</span>}
      </div>
    </>
  );
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
      {sctx.announcements.filter(a => annMatchesProduct(sctx, a, product)).map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b> — {a.body}<AnnounceFileList announcement={a} colors={C} compact /></Note>)}
      {escalated && <Note tone="warn">⏸ Paused — question for the Head: <i>„{insp.question}"</i>. You can keep filling in; the result is locked until answered.</Note>}
      {insp.answer && insp.status !== "PendingReview" && <Note tone="ok">💬 Head's answer: <i>„{insp.answer}"</i></Note>}
      <div className="flex gap-1 mb-3 border-b flex-wrap" style={{ borderColor: C.line }}>{[...modules.map(x => x.name), ...(hasSummary ? ["Summary"] : [])].map((name, i) => <button key={i} onClick={() => setTab(i)} className="text-xs px-3 py-2" style={{ borderBottom: tab === i ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === i ? C.ink : C.muted, fontWeight: tab === i ? 500 : 400, marginBottom: -1, fontStyle: i === modules.length ? "italic" : "normal" }}>{name}</button>)}</div>
      {generalFlag && <Note tone="bad">🚩 General problem reported — inspection flagged.</Note>}
      {!isSummary && m && (
        <div>
          {t.fields.filter(f => f.moduleId === m.id).sort(bySort).map(f => (
            <div key={f.id} className="mb-4">
              {f.type !== "ProductInfo" && <label className="block text-sm font-medium mb-1">{fieldLabel(f)}{f.required && !isSystem(f.type) && <span style={{ color: C.bad }}> *</span>}{f.helper && <span className="block text-xs font-normal" style={{ color: C.muted }}>{f.helper}</span>}</label>}
              {f.type === "ProductInfo" && <div className="rounded-lg p-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}><p className="font-semibold">{product.name}{product.isBio && <span className="text-xs ml-2 px-1.5 py-0.5 rounded" style={{ background: C.okBg, color: C.ok }}>bio</span>}</p><p className="text-xs mt-1" style={{ color: C.muted }}>{specs.length ? specs.map(q => `${q.name}: ${specLabel(q)}${q.source !== "product" ? " (" + q.source + ")" : ""}`).join(" · ") : "no specifications"}</p></div>}
              {f.type === "Supplier" && (productSuppliers.length ? <div><SearchSelect value={insp.supplier || ""} onChange={v => set({ supplier: v })} options={productSuppliers.map(x => ({ value: x.name, label: x.name }))} empty="— choose supplier —" placeholder="Search suppliers…" searchFrom={11} />{suppliersUnrestricted && <p className="text-[10px] mt-1" style={{ color: C.muted }}>product has no assigned suppliers — showing all</p>}</div> : <p className="text-xs" style={{ color: C.warn }}>The supplier list is empty — fill it in Dictionaries → Suppliers.</p>)}
              {f.type === "Variety" && (() => { const vars = effectiveVarieties(sctx, product); return vars.length ? <SearchSelect value={insp.variety || ""} onChange={v => set({ variety: v })} options={vars.map(x => ({ value: x.name, label: x.name }))} empty="— choose variety —" placeholder="Search varieties…" searchFrom={11} /> : <p className="text-xs" style={{ color: C.warn }}>No varieties — add them on the category or the product.</p>; })()}
              {f.type === "List" && (() => {
                const d = (dictionaries || sctx?.dictionaries || []).find(x => x.id === f.dictionaryId);
                const preset = sctx && product ? effectiveAttributes(sctx, product).find(a => a.dictionaryId === f.dictionaryId) : null;
                if (!d) return <p className="text-xs" style={{ color: C.warn }}>No list attached to this field — the Head must pick one in the form builder.</p>;
                if (!d.items.length) return <p className="text-xs" style={{ color: C.warn }}>The list “{d.name}” is empty — fill it in Dictionaries → Lists.</p>;
                // Lists are always a dropdown; the search box appears from 11 options up (the Head can attach a 70-item country list).
                const picker = <SearchSelect value={values[f.id] || ""} onChange={v => setV(f.id, v)} options={d.items.map(o => ({ value: o.value, label: o.value }))} empty={`— choose (${d.items.length} options) —`} placeholder={`Search ${d.name.toLowerCase()}…`} searchFrom={11} />;
                return <ListInput f={f} spec={preset} value={values[f.id]} problems={problems} allProblems={sctx?.problems} overrides={t.overrides} totals={totals} onRaise={(leafId, mode, raw) => setRemarks(r => [...r, { id: uid(), leafId, mode, raw, auto: true, fieldId: f.id }])} raised={remarks.some(r => r.auto && r.fieldId === f.id)} picker={picker} />;
              })()}
              {f.type === "Pallet" && <div>{pallets.map((p, i) => <div key={i} className="flex gap-1.5 mb-1.5"><input value={p} onChange={e => setPallets(ps => ps.map((x, j) => j === i ? e.target.value : x))} placeholder={`pallet ${i + 1}`} className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><button className="text-xs px-2 rounded" style={{ background: C.line, color: C.muted }} title="camera scanning is only available in the phone app" disabled><Ic i={ScanLine} s={13} mr={0} /></button>{pallets.length > 1 && <button onClick={() => setPallets(ps => ps.filter((_, j) => j !== i))} className="text-xs px-1" style={{ color: C.muted }}>×</button>}</div>)}<button onClick={() => setPallets(ps => [...ps, ""])} className="text-xs" style={{ color: C.accent }}>+ another pallet</button><DeliveryPallets product={product} insp={insp} onAdd={hus => setPallets(ps => [...ps.filter(Boolean), ...hus.filter(h => !ps.includes(h))])} /></div>}
              {f.type === "DateCode" && <div><input type="date" value={insp.dateISO || ""} onChange={e => set({ dateISO: e.target.value })} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />{insp.dateISO && <p className="text-xs mt-1.5" style={{ color: C.muted }}>saved as date code: <b style={{ color: C.ink, fontVariantNumeric: "tabular-nums" }}>{dateCode(insp.dateISO)}</b> (week {dateCode(insp.dateISO).slice(0, -1)}, day {dateCode(insp.dateISO).slice(-1)})</p>}</div>}
              {f.type === "SampleSize" && <SampleBlock sample={sample} setSample={setSample} totals={totals} />}
              {f.type === "Photos" && <PhotoStrip photos={photos[f.id]} onAdd={got => addPhotos(f.id, got)} onRemove={id => removePhoto(f.id, id)} onReplace={(id, next) => replaceFieldPhoto(f.id, id, next)} />}
              {f.type === "Escalate" && (escalated ? <p className="text-xs" style={{ color: C.warn }}>⏸ Already paused.</p> : <div className="flex gap-1.5"><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="what to you want to ask the Head?" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><button onClick={() => { if (question.trim()) { onEscalate(question.trim()); setQuestion(""); } }} className="text-sm px-3 py-2 rounded-lg" style={{ background: C.warnBg, color: C.warn, border: `1px solid ${C.warn}` }}><Ic i={HelpCircle} />Ask the Head</button></div>)}
              {f.type === "Text" && <input value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
              {f.type === "Date" && <input type="date" value={values[f.id] || ""} onChange={e => setV(f.id, e.target.value)} className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />}
              {f.type === "SingleChoice" && <div className="flex flex-wrap gap-1.5">{(f.options || []).map(o => <button key={o} onClick={() => setV(f.id, o)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: values[f.id] === o ? C.accent : C.accentSoft, color: values[f.id] === o ? C.onDark : C.accent }}>{o}</button>)}</div>}
              {f.type === "MultiChoice" && <div className="flex flex-col gap-1">{(f.options || []).map(o => { const on = (values[f.id] || []).includes(o.value); return <label key={o.value} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={on} onChange={e => setV(f.id, e.target.checked ? [...(values[f.id] || []), o.value] : (values[f.id] || []).filter(x => x !== o.value))} />{o.value}{o.trigger && " 🚩"}</label>; })}</div>}
              {f.type === "Scale" && <div className="flex gap-1">{Array.from({ length: f.scaleMax || 5 }, (_, i) => i + 1).map(k => <button key={k} onClick={() => setV(f.id, k)} className="w-8 h-8 rounded-lg text-sm" style={{ background: values[f.id] === k ? C.accent : C.accentSoft, color: values[f.id] === k ? C.onDark : C.accent }}>{k}</button>)}</div>}
              {f.type === "Number" && <NumberInput piecesPerCu={insp.sample?.piecesPerCu || product?.piecesPerCu} f={f} problems={problems} allProblems={sctx?.problems} overrides={t.overrides} specs={specs} totals={totals} value={values[f.id]} onChange={v => setV(f.id, v)} onRaise={(leafId, mode, raw) => setRemarks(r => [...r, { id: uid(), leafId, mode, raw, auto: true, fieldId: f.id }])} raised={remarks.some(r => r.auto && r.fieldId === f.id)} />}
              {f.allowPhotos && !isSystem(f.type) && <div className="mt-1.5"><PhotoStrip photos={photos[f.id]} onAdd={got => addPhotos(f.id, got)} onRemove={id => removePhoto(f.id, id)} onReplace={(id, next) => replaceFieldPhoto(f.id, id, next)} size={48} /></div>}
            </div>
          ))}
          {t.problemRefs.filter(r => r.moduleId === m.id).length > 0 && !sampleReady && <Note tone="bad">{hasSampleBlock ? "Sample size gives 0 CU — fill in the “Sample size” block to compute percentages." : "This template has no “Sample size” block — the Head must add it."}</Note>}
          {t.problemRefs.filter(r => r.moduleId === m.id).sort(bySort).map(r => pm[r.problemTypeId] && <ProblemTreeView key={r.id} root={pm[r.problemTypeId]} problems={problems} overrides={t.overrides} remarks={remarks} totals={totals} disabled={!sampleReady} notes={effectiveNotesFor(sctx, product)} onReport={rem => setRemarks(x => [...x, { id: uid(), ...rem }])} onDelete={id => setRemarks(x => x.filter(q => q.id !== id))} onPhoto={(id, got) => setRemarks(x => attachRemarkPhotos(x, id, got))} onRemovePhoto={(id, pid) => setRemarks(x => x.map(q => q.id === id ? { ...q, photos: asPhotoList(q.photos).filter(ph => ph.id !== pid) } : q))} onReplacePhoto={(id, pid, next) => setRemarks(x => replaceRemarkPhoto(x, id, pid, next))} />)}
          {t.fields.filter(f => f.moduleId === m.id).length + t.problemRefs.filter(r => r.moduleId === m.id).length === 0 && <p className="text-sm" style={{ color: C.muted }}>Empty module.</p>}
          {isLastModule && <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.line}` }}>
            <Note tone={escalated ? "warn" : anyExceeded || generalFlag ? "bad" : remarks.length ? "warn" : "ok"}>{escalated ? "Paused — awaiting the Head." : anyExceeded ? "Tolerance exceeded — the system suggests rejection." : generalFlag ? "General problem flagged — the system suggests rejection." : remarks.length ? `${remarks.length} remark${remarks.length === 1 ? "" : "s"} within tolerance.` : "No problems."}</Note>
            {finishControls}
          </div>}
        </div>
      )}
      {isSummary && (
        <div>
          {(() => { const all = product ? sameDeliveryPallets(product, insp) : []; const left = all.basis === "none" ? [] : all.filter(r => r.sameDay !== false); return left.length ? <div className="mb-3"><p className="text-xs mb-1" style={{ color: C.muted }}>Before you finish:</p><DeliveryPallets product={product} insp={insp} onAdd={hus => setPallets(ps => [...ps.filter(Boolean), ...hus.filter(h => !ps.includes(h))])} /></div> : null; })()}
          <Note tone={escalated ? "warn" : anyExceeded || generalFlag ? "bad" : remarks.length ? "warn" : "ok"}>{escalated ? "Paused — awaiting the Head." : anyExceeded ? "Tolerance exceeded — the system suggests rejection." : generalFlag ? "General problem flagged — the system suggests rejection." : remarks.length ? "Problems within tolerance." : "No problems."}</Note>
          <ProblemOverview t={t} problems={problems} remarks={remarks} totals={totals} />
          <div className="text-xs mb-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>{insp.supplier && <span>supplier: <b style={{ color: C.ink }}>{insp.supplier}</b></span>}{insp.variety && <span>variety: <b style={{ color: C.ink }}>{insp.variety}</b></span>}{insp.country && <span>country: <b style={{ color: C.ink }}>{insp.country}</b></span>}{pallets.filter(Boolean).length > 0 && <span>pallets: <b style={{ color: C.ink }}>{pallets.filter(Boolean).join(", ")}</b></span>}{insp.po && <span>PO: <b style={{ color: C.ink }}>{insp.po}</b></span>}{insp.dateISO && <span>date code: <b style={{ color: C.ink }}>{dateCode(insp.dateISO)}</b></span>}<span>sample: <b style={{ color: C.ink }}>{totals.cu} CU</b></span></div>
          {remarks.map(r => <div key={r.id} className="flex items-center gap-2 text-sm py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{pathOf(problems, r.leafId)}{r.auto && <span className="text-xs" style={{ color: C.muted }}> (from measurement)</span>}</span><span className="text-xs" style={{ color: C.muted }}>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</span><span>{r.mode === "Presence" ? "⚡" : `${fmt(pct(r, totals))}%`}</span><button onClick={() => setRemarks(x => x.filter(q => q.id !== r.id))} className="text-xs px-1" style={{ color: C.bad }} title="delete">×</button></div>)}
          <div className="flex items-center justify-between mt-4 mb-1"><label className="text-sm font-medium">Comment</label><Ghost onClick={() => set({ comment: generateComment(problems, t.overrides, remarks, totals, generalFlag) })}><Ic i={Sparkles} s={13} />Generate from remarks</Ghost></div>
          <textarea value={insp.comment || ""} onChange={e => set({ comment: e.target.value })} rows={3} placeholder="optional — or generate and edit" className="w-full text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} />
          {finishControls}
        </div>
      )}
    </div>
  );
}

function ReportView({ insp, s, onEdit, onAnswer, user, onMarkReference, onProduct }) {
  const [printing, setPrinting] = useState(null);
  const [savingPdf, setSavingPdf] = useState(null);
  const pdfPack = useRef(null);
  useEffect(() => {
    if (insp.status !== "Completed") return;
    let alive = true;
    (async () => {
      try {
        await ensureJsPdf();
        const d = await buildReportPdf(insp, s);
        if (!alive) return;
        const blob = d.output("blob");
        if (pdfPack.current?.url) URL.revokeObjectURL(pdfPack.current.url);
        pdfPack.current = { blob, url: URL.createObjectURL(blob), fileName: pdfFileName(insp, s) };
      } catch {}
    })();
    return () => { alive = false; if (pdfPack.current?.url) URL.revokeObjectURL(pdfPack.current.url); pdfPack.current = null; };
  }, [insp.id, insp.status]);
  useEffect(() => () => { if (savingPdf?.url && savingPdf.url !== pdfPack.current?.url) URL.revokeObjectURL(savingPdf.url); }, [savingPdf?.url]);
  const onDownloadPdf = async () => {
    const cached = pdfPack.current;
    if (cached) {
      const result = await savePdfFile(cached.blob, cached.fileName, { url: cached.url });
      if (result === "shared" || result === "downloaded" || result === "aborted") return;
      setSavingPdf({ phase: "ready", ...cached });
      return;
    }
    setSavingPdf(cur => { if (cur?.url && cur.url !== pdfPack.current?.url) URL.revokeObjectURL(cur.url); return { phase: "generating" }; });
    let created = null;
    try {
      const d = await buildReportPdf(insp, s);
      const blob = d.output("blob");
      created = URL.createObjectURL(blob);
      const fileName = pdfFileName(insp, s);
      const result = await savePdfFile(blob, fileName, { url: created });
      if (result === "shared" || result === "downloaded" || result === "aborted") {
        URL.revokeObjectURL(created);
        setSavingPdf(null);
        return;
      }
      setSavingPdf({ phase: "ready", blob, url: created, fileName });
    } catch (e) {
      if (created) URL.revokeObjectURL(created);
      setSavingPdf({ phase: "err", err: String(e.message || e) });
    }
  };
  const product = s.products.find(p => p.id === insp.productId), t = insp.template, problems = withLinkedProblems(s, problemsFor(s, { kind: "Product", id: insp.productId }, new Set((t && t.suppressed) || [])), t);
  const cu = (Number(insp.sample?.tu) || 0) * (Number(insp.sample?.cusPerTu) || 0);
  const totals = { cu, pieces: cu * (Number(insp.sample?.piecesPerCu) || 0), weight: cu * (Number(insp.sample?.weightPerCu) || 0) };
  const [ans, setAns] = useState("");
  const [fg, bg] = insp.result === "Accepted" ? [C.ok, C.okBg] : insp.result === "Rejected" ? [C.bad, C.badBg] : [C.muted, C.line];
  const Action = ({ children, onClick, primary }) => <button type="button" onClick={onClick} className="px-4 py-2.5 rounded-2xl text-sm font-semibold inline-flex items-center justify-center gap-1.5" style={primary ? { background: C.ink, color: C.onDark } : { background: C.bg, color: C.ink, border: `1px solid ${C.line}` }}>{children}</button>;
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-[26px] font-semibold leading-[1.15] tracking-tight">{product?.name || "Report"}</h1>
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: STATUS[insp.status][2], color: STATUS[insp.status][1] }}>{STATUS[insp.status][0]}</span>
          {insp.result && <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: bg, color: fg }}>{insp.result === "Accepted" ? "Accepted" : "Rejected"}</span>}
          {insp.isReference && <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: C.okBg, color: C.ok }}><Ic i={Star} s={12} mr={4} />Reference</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {insp.status === "Completed" && <Action primary onClick={() => setPrinting("open")}><Ic i={Printer} s={15} mr={0} />Open PDF</Action>}
          {insp.status === "Completed" && <Action onClick={onDownloadPdf}><Ic i={Download} s={15} mr={0} />Download PDF</Action>}
          {insp.status === "Completed" && onEdit && <Action onClick={onEdit}><Ic i={Pencil} s={15} mr={0} />Edit report</Action>}
          {onProduct && <Action onClick={onProduct}><Ic i={BookOpen} s={15} mr={0} />Product profile</Action>}
          {insp.status === "Completed" && user?.role === "Head" && onMarkReference && <Action onClick={onMarkReference}>{insp.isReference ? <><Ic i={Star} s={15} mr={0} />Unmark reference</> : <><Ic i={Star} s={15} mr={0} />Mark as reference</>}</Action>}
        </div>
      </div>
      {printing && <PdfViewer insp={insp} s={s} intent={printing} onClose={() => setPrinting(null)} />}
      {savingPdf && <PdfSaveOverlay phase={savingPdf.phase} err={savingPdf.err} blob={savingPdf.blob} url={savingPdf.url} fileName={savingPdf.fileName} onClose={() => { if (savingPdf.url) URL.revokeObjectURL(savingPdf.url); setSavingPdf(null); }} />}
      <div className="text-xs mb-3 flex flex-wrap gap-x-4 gap-y-1" style={{ color: C.muted }}>
        <span>controller <b style={{ color: C.ink }}>{s.users.find(u => u.id === insp.controllerId)?.name}</b></span><span>start {fmtTime(insp.startedAt)}</span>{insp.completedAt && <span>finished {fmtTime(insp.completedAt)}</span>}
        {insp.supplier && <span>supplier <b style={{ color: C.ink }}>{insp.supplier}</b></span>}{insp.variety && <span>variety <b style={{ color: C.ink }}>{insp.variety}</b></span>}{insp.country && <span>country <b style={{ color: C.ink }}>{insp.country}</b></span>}{(insp.pallets || []).filter(Boolean).length > 0 && <span>pallets <b style={{ color: C.ink }}>{insp.pallets.filter(Boolean).join(", ")}</b></span>}{insp.po && <span>PO <b style={{ color: C.ink }}>{insp.po}</b></span>}{insp.dateISO && <span>date code <b style={{ color: C.ink }}>{dateCode(insp.dateISO)}</b></span>}<span>sample <b style={{ color: C.ink }}>{totals.cu} CU</b></span>
      </div>
      {insp.status === "PendingReview" && (
        <div className="rounded-lg p-3 mb-3" style={{ background: C.warnBg }}>
          <p className="text-sm mb-2" style={{ color: C.warn }}><Ic i={HelpCircle} s={14} />Controller's question: <i>„{insp.question}"</i></p>
          {user.role === "Head" ? <div className="flex gap-2"><input value={ans} onChange={e => setAns(e.target.value)} placeholder="answer — goes back to the controller, inspection returns to draft" className="flex-1 text-sm rounded px-2 py-1.5 outline-none" style={{ ...inp }} /><Primary small onClick={() => { if (ans.trim()) { onAnswer(ans.trim()); setAns(""); } }}>Answer</Primary></div> : <p className="text-xs" style={{ color: C.muted }}>Awaiting the Head's answer.</p>}
        </div>
      )}
      {insp.answer && <Note tone="ok">💬 Head's answer: <i>„{insp.answer}"</i></Note>}
      {(insp.missingRequired || []).length > 0 && <Note tone="warn"><Ic i={AlertTriangle} s={13} />Finished with <b>{insp.missingRequired.length} required field{insp.missingRequired.length === 1 ? "" : "s"} empty</b>: {insp.missingRequired.join(", ")}</Note>}
      {t && <ProblemOverview t={t} problems={problems} remarks={insp.remarks || []} totals={totals} />}
      {(insp.remarks || []).map(r => <div key={r.id} className="flex items-center gap-2 text-sm py-1" style={{ borderTop: `1px solid ${C.line}` }}><span className="flex-1">{pathOf(problems, r.leafId)}{r.auto && <span className="text-xs" style={{ color: C.muted }}> (from measurement)</span>}</span><span className="text-xs" style={{ color: C.muted }}>{r.mode === "Presence" ? "present" : `${r.raw} ${r.mode === "PieceCount" ? "pcs" : r.mode === "DirectWeight" ? "g" : "CU"}`}</span><span>{r.mode === "Presence" ? "⚡" : `${fmt(pct(r, totals))}%`}</span></div>)}
      {insp.comment && <div className="rounded-lg p-3 mt-3 text-sm" style={{ background: C.bg }}>{insp.comment}</div>}
      {(() => { const groups = photoGroupsOf(t, insp, problems); return <div className="mt-4"><p className="label-sm mb-2">Photos</p>{groups.length ? groups.map(g => <div key={g.key} className="mb-3"><PhotoStrip photos={g.photos} size={72} label={g.label} /></div>) : <p className="text-xs" style={{ color: C.muted }}>No photos in this inspection.</p>}</div>; })()}
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
function InspectionsPage({ s, set, user, notify, openId, setOpenId, preset, clearPreset, datePreset, clearDatePreset }) {
  const [newProduct, setNewProduct] = useState(preset || "");
  useEffect(() => { if (preset) { setNewProduct(preset); clearPreset(); } }, [preset]); const [filter, setFilter] = useState("all"); const [editing, setEditing] = useState(false); const [peek, setPeek] = useState(false); useEffect(() => { setPeek(false); }, [openId]);
  const [q, setQ] = useState(""); const [adv, setAdv] = useState({ range: datePreset || "all", result: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "" }); const [advOpen, setAdvOpen] = useState(!!datePreset);
  useEffect(() => { if (datePreset) { setAdv(x => ({ ...x, range: datePreset })); setAdvOpen(true); setOpenId(null); clearDatePreset && clearDatePreset(); } }, [datePreset]);
  const matchAdv = i => {
    const p = s.products.find(x => x.id === i.productId); const when = i.completedAt || i.startedAt || "";
    if (q.trim() && !matchesInspSearch(i, p, q)) return false;
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
  const finish = ({ anyExceeded, generalFlag, autoAccept, missingRequired = [], result }) => {
    { const p = s.products.find(x => x.id === insp.productId); const hus = (insp.pallets || []).map(h => String(h).replace(/\D/g, "").replace(/^0+/, "")).filter(Boolean); set(x => { const pc = { ...(x.palletClaims || {}) }; Object.keys(pc).forEach(k => { const mine = pc[k].userId === user.id; if (!mine) return; if (p?.articleId && k.startsWith(p.articleId + "|")) delete pc[k]; if (k.startsWith("hu:") && hus.some(h => k.slice(3).replace(/^0+/, "") === h)) delete pc[k]; }); return { ...x, palletClaims: pc }; }); }
    const wasCompleted = insp.status === "Completed";
    patchInsp(insp.id, i => ({ ...i, status: "Completed", result: result || i.result, completedAt: i.completedAt || nowISO(), lastEditedBy: wasCompleted ? user.id : i.lastEditedBy, lastEditedAt: wasCompleted ? nowISO() : i.lastEditedAt, missingRequired }));
    log(insp.id, wasCompleted ? "Edited completed report" : "Completed", `result: ${result || insp.result}${missingRequired.length ? ` · required fields left empty: ${missingRequired.join(", ")}` : ""}`);
    if (missingRequired.length) notify("MissingRequired", `${user.name} finished ${product.name} with ${missingRequired.length} required field${missingRequired.length === 1 ? "" : "s"} empty: ${missingRequired.join(", ")}`, "Inspection", insp.id);
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
  const canInspect = user.role !== "Controller";
  const legacyLight = insp && !insp.template;
  const showRunner = canInspect && insp && !legacyLight && (insp.status === "Draft" || insp.status === "PendingReview" || editing);

  return (
    <div>
      <h1 className="mb-1">{canInspect ? "Inspections" : "History"}</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>{canInspect ? "Statuses: Draft → (Awaiting Head) → Completed / Cancelled. Any controller can edit a completed report — with an audit trail." : "Reports from the floor. Web is view-only — start and finish inspections on the phone."}</p>
      {!insp ? (
        <>
          {canInspect && <Card style={{ marginBottom: 16 }}>
            <p className="font-medium text-sm mb-2">New inspection</p>
            <div className="flex gap-2 items-center"><div className="flex-1 min-w-0"><SearchSelect value={newProduct} onChange={v => { setNewProduct(v); setCollisionWarn(null); }} options={s.products.filter(p => p.isActive !== false).map(p => ({ value: p.id, label: p.articleId ? `${p.articleId} · ${p.name}` : p.name }))} empty="— product —" placeholder="Search products…" searchFrom={0} /></div><select value={newType} onChange={e => setNewType(e.target.value)} className="text-sm" style={{ minHeight: 36 }}>{(newProduct ? allowedTypes(s, s.products.find(p => p.id === newProduct)) : typesOf(s)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select><Primary onClick={() => start(false)} disabled={!newProduct || !(newProduct && resolveTemplate(s, s.products.find(p => p.id === newProduct), allowedTypes(s, s.products.find(p => p.id === newProduct)).some(t => t.id === newType) ? newType : allowedTypes(s, s.products.find(p => p.id === newProduct))[0]?.id))}>Start</Primary></div>
            {collisionWarn && <div className="mt-2"><Note tone="warn"><div className="flex items-center gap-3 flex-wrap"><span>{s.users.find(u => u.id === collisionWarn.controllerId)?.name} already has an open inspection of this product ({STATUS[collisionWarn.status][0]}).</span><button onClick={() => start(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: C.ink, color: C.onDark }}>Start anyway</button><button onClick={() => setCollisionWarn(null)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}` }}>Never mind</button></div></Note></div>}
            {newProduct && !resolveTemplate(s, s.products.find(p => p.id === newProduct)) && <p className="text-xs mt-2" style={{ color: C.bad }}>This product has no form — no global template.</p>}
          </Card>}
          <Card>
            <div className="flex gap-2 mb-2"><SearchBox value={q} onChange={setQ} placeholder="search by product, article ID or report no.…" className="flex-1" inputClass="rounded" /><button onClick={() => setAdvOpen(o => !o)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: advCount ? C.accent : C.accentSoft, color: advCount ? C.onDark : C.accent }}>Filters{advCount ? ` · ${advCount}` : ""}</button></div>
            {advOpen && (
              <div className="rounded-lg p-3 mb-3" style={{ background: C.bg }}>
                <div className="flex items-center justify-between mb-2"><span className="text-xs" style={{ color: C.muted }}>Filters</span><button onClick={() => { setAdv({ range: "all", result: "", supplier: "", controller: "", category: "", from: "", to: "", code: "", packFrom: "", packTo: "" }); setQ(""); }} className="text-xs" style={{ color: C.accent }}>Clear all</button></div>
                <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                <label className="text-xs min-w-0" style={{ color: C.muted }}>date range<select value={adv.range} onChange={e => setAdv(x => ({ ...x, range: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="all">everything</option><option value="0">today</option><option value="7">7 days</option><option value="30">30 days</option><option value="custom">custom</option></select></label>
                {adv.range === "custom" && <label className="text-xs min-w-0" style={{ color: C.muted }}>from – to<div className="flex gap-1 mt-1"><input type="date" value={adv.from} onChange={e => setAdv(x => ({ ...x, from: e.target.value }))} className="flex-1 min-w-0 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={adv.to} onChange={e => setAdv(x => ({ ...x, to: e.target.value }))} className="flex-1 min-w-0 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /></div></label>}
                <label className="text-xs min-w-0" style={{ color: C.muted }}>result<select value={adv.result} onChange={e => setAdv(x => ({ ...x, result: e.target.value }))} className="w-full text-sm rounded px-2 py-1.5 outline-none mt-1" style={{ ...inp }}><option value="">all</option><option value="Accepted">accepted</option><option value="Rejected">rejected</option></select></label>
                <label className="text-xs min-w-0" style={{ color: C.muted }}>supplier<div className="mt-1"><SearchSelect value={adv.supplier} onChange={v => setAdv(x => ({ ...x, supplier: v }))} options={[...new Set(s.inspections.map(i => i.supplier).filter(Boolean))].map(n => ({ value: n, label: n }))} empty="all" placeholder="Search suppliers…" searchFrom={0} /></div></label>
                <label className="text-xs min-w-0" style={{ color: C.muted }}>controller<div className="mt-1"><SearchSelect value={adv.controller} onChange={v => setAdv(x => ({ ...x, controller: v }))} options={s.users.filter(u => u.role === "Controller").map(u => ({ value: u.id, label: u.name }))} empty="all" placeholder="Search controllers…" searchFrom={0} /></div></label>
                <label className="text-xs min-w-0" style={{ color: C.muted }}>category<div className="mt-1"><SearchSelect value={adv.category} onChange={v => setAdv(x => ({ ...x, category: v }))} options={s.categories.map(c => ({ value: c.id, label: c.name }))} empty="all" placeholder="Search categories…" searchFrom={0} /></div></label>
                <label className="text-xs min-w-0" style={{ color: C.muted }} title="packing date — a different axis than the inspection date">date code<div className="flex gap-1 mt-1 items-center"><input value={adv.code} onChange={e => setAdv(x => ({ ...x, code: e.target.value }))} placeholder="382" className="w-16 text-sm rounded px-2 py-1.5 outline-none font-mono" style={{ ...inp }} /><span className="text-[10px]">or</span><input type="date" value={adv.packFrom} onChange={e => setAdv(x => ({ ...x, packFrom: e.target.value }))} className="flex-1 min-w-0 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /><input type="date" value={adv.packTo} onChange={e => setAdv(x => ({ ...x, packTo: e.target.value }))} className="flex-1 min-w-0 text-xs rounded px-1 py-1.5 outline-none" style={{ ...inp }} /></div></label>
                </div>
              </div>
            )}
            <div className="flex gap-1.5 mb-3 flex-wrap">{[["all", "all"], ["mine", "mine"], ...typesOf(s).map(t => ["type:" + t.id, t.name.toLowerCase()]), ["Draft", "drafts"], ["PendingReview", "awaiting Head"], ["Completed", "completed"], ["Cancelled", "cancelled"]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className="text-xs px-2.5 py-1 rounded-full" style={{ background: filter === k ? C.accent : C.accentSoft, color: filter === k ? C.onDark : C.accent }}>{l} {k === "PendingReview" && s.inspections.filter(i => i.status === "PendingReview").length > 0 && `(${s.inspections.filter(i => i.status === "PendingReview").length})`}</button>)}</div>
            {list.length === 0 ? <Empty icon="📋" title={s.inspections.length ? "Nothing matches" : "No inspections"} hint={s.inspections.length ? "Change the search or filters." : (canInspect ? "Start the first one above." : "Inspections are started on the phone.")} /> : list.map(i => { const p = s.products.find(x => x.id === i.productId); const it = inspType(s, i); const vis = it.autoAccept, skp = !it.countsAsInspection; const [fg, bg] = i.status !== "Completed" ? [STATUS[i.status][1], STATUS[i.status][2]] : it.autoAccept ? [it.color, C.accentSoft] : i.result === "Accepted" ? [C.ok, C.okBg] : i.result === "Rejected" ? [C.bad, C.badBg] : [STATUS[i.status][1], STATUS[i.status][2]]; return (
              <button key={i.id} onClick={() => { setOpenId(i.id); setEditing(false); }} className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg row" style={{ borderTop: `1px solid ${C.line}` }}>
                <span className="text-xs px-2.5 py-0.5 rounded-full whitespace-nowrap inline-flex items-center gap-1.5" style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}`, fontWeight: 500 }}><span className="inline-block rounded-full" style={{ width: 7, height: 7, background: fg }} />{i.status !== "Completed" ? STATUS[i.status][0] : it.autoAccept ? it.name : (i.result === "Accepted" ? "Accepted" : "Rejected")}</span>{it.id !== "type-full" && i.status === "Completed" && !it.autoAccept && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: C.bg, color: C.muted }}>{it.name}</span>}
                <span className="flex-1 text-sm min-w-0 truncate">{p?.name || `Pallet ${(i.pallets || [])[0] || ""}`}<span className="ml-2 font-mono text-[11px]" style={{ color: C.muted }}>{String(i.id).toUpperCase()}</span></span>
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
          {peek && product && <ProductPeek s={s} user={user} product={product} onClose={() => setPeek(false)} />}
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
            ? <InspectionRunner key={insp.id} insp={insp} patch={fn => patchInsp(insp.id, fn)} t={insp.template} problems={withLinkedProblems(s, problemsFor(s, { kind: "Product", id: product.id }, new Set(insp.template.suppressed || [])), insp.template)} product={product} suppliers={s.suppliers || []} dictionaries={s.dictionaries || []} sctx={s} user={user} onFinish={finish} onEscalate={escalate} onRaiseFlag={raiseFlag} onCancel={cancel} />
            : <>
                {!canInspect && ["Draft", "PendingReview"].includes(insp.status) && <Note tone="warn">This inspection is in progress on the phone. Web is view-only.</Note>}
                <ReportView insp={insp} s={s} user={user} onEdit={canInspect ? () => setEditing(true) : null} onAnswer={answer} onMarkReference={canInspect ? () => toggleReferenceInspection(set, insp.productId, insp.id) : null} />
              </>}
        </Card>
      )}
    </div>
  );
}

// Read-only product profile in a side drawer, opened from inside an inspection. Everything the controller may want
// to double-check mid-inspection (photos, facts, specs, properties, suppliers, encyclopedia, reference guide,
// announcements, recent history) without leaving the form — the runner keeps its state underneath.
function ProductPeek({ s, user, product, onClose }) {
  const [tab, setTab] = useState("overview");
  const [zoom, setZoom] = useState(null);
  const [showRef, setShowRef] = useState(false);
  useEffect(() => { const h = e => { if (e.key === "Escape") { if (zoom) setZoom(null); else onClose(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [zoom, onClose]);
  const photos = asPhotoList(product.photos);
  const specs = effectiveSpecs(s, product), attrs = effectiveAttributes(s, product), varieties = effectiveVarieties(s, product);
  const suppliers = (product.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)).filter(Boolean);
  const guide = effectiveGuide(s, product);
  const notes = effectiveNotesFor(s, product);
  const anns = (s.announcements || []).filter(a => annMatchesProduct(s, a, product));
  const history = s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")).slice(0, 8);
  const reference = s.inspections.find(i => i.productId === product.id && i.isReference);
  const cat = s.categories.find(c => c.id === product.categoryId);
  const catPath = id => { const out = []; let c = s.categories.find(x => x.id === id); while (c) { out.unshift(c.name); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } return out.join(" › "); };
  const tabs = [["overview", "Overview"], ["specs", `Specs${specs.length ? ` · ${specs.length}` : ""}`], ["attrs", `Properties${attrs.length ? ` · ${attrs.length}` : ""}`], ["guide", `Encyclopedia${guide.length ? ` · ${guide.length}` : ""}`], ["reference", `Reference guide${notes.length ? ` · ${notes.length}` : ""}`], ["history", `History${history.length ? ` · ${history.length}` : ""}`]];
  const Row = ({ k, v }) => v ? <div className="flex justify-between gap-3 py-1.5 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span><span className="text-right font-medium">{v}</span></div> : null;
  const H = ({ children }) => <p className="text-[11px] font-semibold uppercase tracking-wide mt-4 mb-2" style={{ color: C.muted }}>{children}</p>;
  const Photos = ({ list, size = 84 }) => list.length ? <div className="flex gap-2 flex-wrap">{list.map(ph => <button key={ph.id} onClick={() => setZoom(ph)} className="rounded-lg overflow-hidden" style={{ width: size, height: size, border: `1px solid ${C.line}`, background: C.bg }}><img src={thumbSrc(ph) || ph.url || ph.src} loading="lazy" decoding="async" alt="" className="w-full h-full object-cover" /></button>)}</div> : null;
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
            {anns.length > 0 && <div className="mt-4">{anns.map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b>{a.body && <> — {a.body}</>}<AnnounceFileList announcement={a} colors={C} compact /></Note>)}</div>}
            <div className="mt-4"><ComplaintsNote s={s} articleId={product.articleId} /><LiveNote product={product} /><ExtRejectionsNote s={s} articleId={product.articleId} /></div>
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
            {reference && <><H>Reference report</H>
              <button type="button" onClick={() => setShowRef(v => !v)} className="w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ background: C.okBg }}>
                <Ic i={Star} s={14} mr={0} style={{ color: C.ok }} />
                <span className="flex-1 text-sm" style={{ color: C.ok }}>{s.users.find(u => u.id === reference.controllerId)?.name} · {fmtTime(reference.completedAt)} · {reference.result || "—"}</span>
                <span className="text-xs" style={{ color: C.ok }}>{showRef ? "hide" : "see how it should look"}</span>
              </button>
              {showRef && <div className="mt-2"><ReportView insp={reference} s={s} user={user} onEdit={() => {}} onAnswer={() => {}} /></div>}
            </>}
          </div>}
          {tab === "specs" && <div className="mt-3">{specs.length === 0 ? <Empty icon="📏" title="No specifications" hint="Nothing set on the product or its categories." /> : specs.map((q, i) => <div key={q.id || i} className="py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><div className="flex justify-between gap-3 items-baseline"><div><span className="font-medium">{q.name}</span>{q.source !== "product" && <span className="text-[10px] ml-2" style={{ color: C.muted }}>{q.source}</span>}</div><SpecValue spec={q} colors={C} /></div>{q.temp?.note && <p className="text-[12px] mt-1" style={{ color: C.bad }}>{q.temp.note}</p>}</div>)}</div>}
          {tab === "attrs" && <div className="mt-3">{attrs.length === 0 ? <Empty icon="🏷️" title="No properties" hint="Nothing set on the product or its categories." /> : attrs.map(a => <div key={a.dictionaryId} className="flex justify-between gap-3 py-2 text-sm" style={{ borderBottom: `1px solid ${C.line}` }}><div><span style={{ color: C.muted }}>{a.list}</span>{a.source !== "product" && <span className="text-[10px] ml-2" style={{ color: C.muted }}>{a.source}</span>}</div><span className="font-medium text-right">{a.value}</span></div>)}</div>}
          {tab === "guide" && <div className="mt-3">{guide.length === 0 ? <Empty icon="📖" title="Encyclopedia is empty" hint="Fill it in on the product page (Products → Encyclopedia)." /> : guide.map(g => <FoldNote key={g.id} title={g.title || "Untitled entry"} chip={g.inherited ? <InheritChip label={g.source} /> : null}>{g.body && <p className="text-sm whitespace-pre-wrap mb-2" style={{ color: C.ink }}>{g.body}</p>}<Photos list={asPhotoList(g.photos)} /></FoldNote>)}</div>}
          {tab === "reference" && <div className="mt-3">{notes.length === 0 ? <Empty icon="🧭" title="No reference notes" hint="Notes and photos per defect are filled in on the product page." /> : notes.map(n => <FoldNote key={n.id} title={problemPath(s.problems, n.problemId) || "Defect"} chip={n.inherited ? <InheritChip label={n.source} /> : null}>{n.description && <p className="text-sm whitespace-pre-wrap mb-2">{n.description}</p>}<Photos list={asPhotoList(n.photos)} /></FoldNote>)}</div>}
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
function FoldNote({ title, chip, children }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl mb-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full text-left px-3 py-2.5 flex items-center gap-2">
        <span className="flex-1 font-semibold text-sm flex items-center gap-2 min-w-0"><span className="truncate">{title}</span>{chip}</span>
        <Ic i={open ? ChevronDown : ChevronRight} s={14} mr={0} style={{ color: C.muted, flexShrink: 0 }} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
function CatalogPage({ s, set, user, notify, onStartInspection, onOpenInspection, presetSel, clearPresetSel, presetFilter, clearPreset, openPallet }) {
  const [q, setQ] = useState(""); const [sel, setSel] = useBackSel("catalogSel", null); const [flagText, setFlagText] = useState(""); const [flagOpen, setFlagOpen] = useState(false); const [showRef, setShowRef] = useState(null); const [sec, setSec] = useState(null);
  useEffect(() => { if (presetSel) { setSel(presetSel); clearPresetSel && clearPresetSel(); } }, [presetSel]);
  useEffect(() => { if (presetFilter) { setQ(presetFilter); clearPreset && clearPreset(); } }, [presetFilter]);
  const [cat, setCat] = useBackSel("catalogCat", ""); const [f, setF] = useState({ bio: "", supplier: "", only: "", sort: "dock" }); const [limit, setLimit] = useState(80);
  const now = Date.now();
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return ""; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const catChain = id => { const out = []; let c = s.categories.find(x => x.id === id); while (c) { out.unshift(c); c = c.parentId ? s.categories.find(x => x.id === c.parentId) : null; } return out; };
  const lastInsp = pid => s.inspections.filter(i => i.productId === pid && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""))[0];
  // What stands on the dock right now, per article — the list the controller actually walks to.
  const dock = dockRowsLive(s).filter(r => !lostOf(s, r)); const onDock = {}; dock.forEach(r => { const k = normArticle(r.article); if (!k) return; (onDock[k] = onDock[k] || []).push(r); });
  const dockOf = p => onDock[normArticle(p.articleId)] || [];
  const urgency = rows => Math.min(...rows.map(r => r.blocking ? 0 : r.priority && PRIO_ORDER.includes(r.priority) ? 1 + PRIO_ORDER.indexOf(r.priority) : 8));
  const haystack = p => [p.name, p.articleId, p.barcodeCu, p.barcodeTu, ...catChain(p.categoryId).map(c => c.name), ...(p.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)?.name || ""), ...effectiveVarieties(s, p).map(v => v.name)].join(" ").toLowerCase();
  const qq = q.trim().toLowerCase();
  const active = s.products.filter(p => p.isActive !== false);
  const matches = p => (!cat || catChain(p.categoryId).some(c => c.id === cat)) && (!f.bio || (f.bio === "bio" ? p.isBio : !p.isBio)) && (!f.supplier || (p.supplierIds || []).includes(f.supplier))
    && (!f.only || (f.only === "dock" ? dockOf(p).length > 0 : f.only === "flag" ? s.flags.some(x => x.productId === p.id && x.status === "Open") : f.only === "rejected" ? !!extRejectionLine(s, p.articleId, now) || recentProblemsFor(s, p.id, now).count > 0 : f.only === "live" ? !!liveNoteOf(p) || (s.tempSpecs || []).some(t => t.ownerKind === "product" && t.ownerId === p.id && tempSpecIsActive(t)) : true))
    && (!qq || haystack(p).includes(qq));
  const visible = active.filter(matches).sort((a, b) => f.sort === "recent" ? ((lastInsp(b.id)?.completedAt || "").localeCompare(lastInsp(a.id)?.completedAt || "")) : f.sort === "dock" ? (dockOf(a).length ? urgency(dockOf(a)) : 99) - (dockOf(b).length ? urgency(dockOf(b)) : 99) || a.name.localeCompare(b.name, "en") : a.name.localeCompare(b.name, "en"));
  const filtered = !!(qq || cat || f.bio || f.supplier || f.only);
  const dockFirst = !filtered && f.sort === "dock" ? visible.filter(p => dockOf(p).length).sort((a, b) => urgency(dockOf(a)) - urgency(dockOf(b)) || a.name.localeCompare(b.name, "en")) : [];
  const rest = dockFirst.length ? visible.filter(p => !dockOf(p).length) : visible;
  const catCount = cid => active.filter(p => catChain(p.categoryId).some(c => c.id === cid)).length;
  const catOptions = s.categories.filter(c => !c.parentId).map(c => ({ c, n: catCount(c.id), kids: s.categories.filter(k => k.parentId === c.id).map(k => ({ c: k, n: catCount(k.id) })).filter(k => k.n) })).filter(x => x.n).sort((a, b) => a.c.name.localeCompare(b.c.name, "en"));
  const usedSuppliers = (s.suppliers || []).filter(x => active.some(p => (p.supplierIds || []).includes(x.id))).sort((a, b) => a.name.localeCompare(b.name, "en"));
  const counts = { dock: active.filter(p => dockOf(p).length).length, flag: active.filter(p => s.flags.some(x => x.productId === p.id && x.status === "Open")).length, rejected: active.filter(p => !!extRejectionLine(s, p.articleId, now) || recentProblemsFor(s, p.id, now).count > 0).length, live: active.filter(p => !!liveNoteOf(p) || (s.tempSpecs || []).some(t => t.ownerKind === "product" && t.ownerId === p.id && tempSpecIsActive(t))).length };
  const Pill = ({ on, onClick, children, tone }) => <button type="button" onClick={onClick} className="text-xs font-medium px-3 rounded-full whitespace-nowrap inline-flex items-center gap-1.5" style={{ height: 30, background: on ? C.ink : C.surface, color: on ? C.onDark : C.ink, border: `1px solid ${on ? C.ink : C.line}` }}>{children}{tone && <span style={{ color: on ? C.onDark : tone }} />}</button>;
  const product = s.products.find(p => p.id === sel);
  const specs = product ? effectiveSpecs(s, product) : [];
  const assigned = product ? (product.supplierIds || []).map(id => (s.suppliers || []).find(x => x.id === id)).filter(Boolean) : [];
  const history = product ? s.inspections.filter(i => i.productId === product.id && i.status === "Completed").sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || "")) : [];
  const openFlags = product ? s.flags.filter(x => x.productId === product.id && x.status === "Open") : [];
  const prodDock = product ? dockOf(product) : [];
  const hist = product ? recentProblemsFor(s, product.id, now) : null;
  const guide = product ? effectiveGuide(s, product).filter(e => e.title || e.body || asPhotoList(e.photos).length) : [];
  const refNotes = product ? effectiveNotesFor(s, product).filter(n => n.description || asPhotoList(n.photos).length) : [];
  const policy = product ? effectivePolicy(s, product) : null; const allowedTypes = policy ? typesOf(s).filter(tp => policy.typeIds.includes(tp.id)) : [];
  const raise = () => { if (!flagText.trim()) return; set(x => ({ ...x, flags: [...x.flags, { id: uid(), productId: product.id, inspectionId: null, raisedBy: user.id, description: flagText.trim(), status: "Open", createdAt: nowISO() }] })); notify("Flag", `${user.name}: ${product.name} — ${flagText.trim()}`, "ProductFlag", null); setFlagText(""); setFlagOpen(false); };
  const Row = ({ p }) => { const li = lastInsp(p.id); const openFlag = s.flags.some(x => x.productId === p.id && x.status === "Open"); const d = dockOf(p); const on = sel === p.id; const ext = extRejectionLine(s, p.articleId, now); return (
    <button type="button" onClick={() => { setSel(p.id); setFlagOpen(false); setShowRef(null); setSec(null); }} className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: on ? C.accentSoft : "transparent", border: `1px solid ${on ? C.accent : "transparent"}` }}>
      {asPhotoList(p.photos).length ? <img src={thumbSrc(asPhotoList(p.photos)[0])} loading="lazy" decoding="async" alt="" className="w-10 h-10 rounded-lg object-contain flex-shrink-0" style={{ background: PHOTO_BG }} /> : <span className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: C.bg, color: C.muted }}><Ic i={ImageIcon} s={16} mr={0} /></span>}
      <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate leading-tight" style={{ color: on ? C.accent : C.ink }}>{p.name}</span><span className="block text-[11px] truncate mt-0.5" style={{ color: C.muted }}><span className="font-mono">{p.articleId || "—"}</span>{p.isBio ? " · bio" : ""}{catPath(p.categoryId) ? ` · ${catPath(p.categoryId)}` : ""}</span></span>
      <span className="flex items-center gap-1.5 flex-shrink-0">
        {d.length > 0 && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: d.some(r => r.blocking) ? C.badBg : C.accentSoft, color: d.some(r => r.blocking) ? C.bad : C.accent }}>on dock{d.length > 1 ? ` ×${d.length}` : ""}</span>}
        {ext && <span className="w-2 h-2 rounded-full" title={`rejected ${ext.count}× in ${ext.span}`} style={{ background: C.warn }} />}
        {openFlag && <Ic i={Flag} s={12} mr={0} style={{ color: C.warn }} />}
        {li && <span className="w-2 h-2 rounded-full" title={`last inspection ${li.result === "Accepted" ? "accepted" : "rejected"} · ${fmtTime(li.completedAt)}`} style={{ background: li.result === "Accepted" ? C.ok : C.bad }} />}
      </span>
    </button>); };
  const Fact = ({ k, v }) => v ? <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span style={{ color: C.muted }}>{k}</span> <b>{v}</b></span> : null;
  const Section = ({ title, right, children }) => <div className="mt-5"><div className="flex items-center mb-1.5"><p className="label-sm flex-1" style={{ color: C.muted }}>{title}</p>{right}</div>{children}</div>;
  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3"><h1>Products</h1><span className="text-xs" style={{ color: C.muted }}>{active.length} in the catalog{counts.dock ? ` · ${counts.dock} on the dock now` : ""}</span></div>
      <div className="flex gap-2 mb-3 items-center flex-wrap">
        <SearchBox value={q} onChange={v => { setQ(v); setLimit(80); }} placeholder="Search product, article, barcode, category, supplier, variety…" autoFocus className="flex-1" style={{ minWidth: 320 }} />
        <select value={cat} onChange={e => setCat(e.target.value)} className="text-sm rounded-xl px-3" style={{ height: 36, border: `1px solid ${C.line}`, background: C.surface, color: C.ink, maxWidth: 220 }}>
          <option value="">All categories</option>
          {catOptions.map(({ c, n, kids }) => kids.length ? <optgroup key={c.id} label={`${c.name} · ${n}`}><option value={c.id}>All {c.name} · {n}</option>{kids.map(k => <option key={k.c.id} value={k.c.id}>{k.c.name} · {k.n}</option>)}</optgroup> : <option key={c.id} value={c.id}>{c.name} · {n}</option>)}
        </select>
        {usedSuppliers.length > 0 && <select value={f.supplier} onChange={e => setF(x => ({ ...x, supplier: e.target.value }))} className="text-sm rounded-xl px-3" style={{ height: 36, border: `1px solid ${C.line}`, background: C.surface, color: C.ink, maxWidth: 200 }}><option value="">Any supplier</option>{usedSuppliers.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <select value={f.sort} onChange={e => setF(x => ({ ...x, sort: e.target.value }))} className="text-sm rounded-xl px-3" style={{ height: 36, border: `1px solid ${C.line}`, background: C.surface, color: C.ink }}><option value="dock">On the dock first</option><option value="name">A–Z</option><option value="recent">Recently inspected</option></select>
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        <Pill on={!f.only && !f.bio} onClick={() => setF(x => ({ ...x, only: "", bio: "" }))}>All</Pill>
        <Pill on={f.only === "dock"} onClick={() => setF(x => ({ ...x, only: x.only === "dock" ? "" : "dock" }))}>On the dock now <b style={{ color: f.only === "dock" ? C.onDark : C.accent }}>{counts.dock}</b></Pill>
        <Pill on={f.only === "rejected"} onClick={() => setF(x => ({ ...x, only: x.only === "rejected" ? "" : "rejected" }))}>Rejected recently <b style={{ color: f.only === "rejected" ? C.onDark : C.warn }}>{counts.rejected}</b></Pill>
        <Pill on={f.only === "live"} onClick={() => setF(x => ({ ...x, only: x.only === "live" ? "" : "live" }))}>Temporary spec <b style={{ color: f.only === "live" ? C.onDark : C.bad }}>{counts.live}</b></Pill>
        <Pill on={f.only === "flag"} onClick={() => setF(x => ({ ...x, only: x.only === "flag" ? "" : "flag" }))}>Open flag <b style={{ color: f.only === "flag" ? C.onDark : C.warn }}>{counts.flag}</b></Pill>
        <span className="w-px self-stretch mx-1" style={{ background: C.line }} />
        <Pill on={f.bio === "bio"} onClick={() => setF(x => ({ ...x, bio: x.bio === "bio" ? "" : "bio" }))}>Bio</Pill>
        <Pill on={f.bio === "std"} onClick={() => setF(x => ({ ...x, bio: x.bio === "std" ? "" : "std" }))}>Standard</Pill>
      </div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(300px, 2fr) minmax(0, 3fr)" }}>
        <Card style={{ padding: 10 }}>
          {visible.length === 0 ? <p className="text-sm py-8 text-center" style={{ color: C.muted }}>Nothing matches.</p> : <>
            {dockFirst.length > 0 && <><p className="label-sm px-3 pt-2 pb-1" style={{ color: C.accent }}>On the dock now · {dockFirst.length}</p>{dockFirst.map(p => <Row key={p.id} p={p} />)}<p className="label-sm px-3 pt-4 pb-1" style={{ color: C.muted }}>All products · {rest.length}</p></>}
            {rest.slice(0, limit).map(p => <Row key={p.id} p={p} />)}
            {rest.length > limit && <button type="button" onClick={() => setLimit(l => l + 120)} className="w-full text-sm py-2.5 mt-1 rounded-xl font-medium" style={{ color: C.accent, background: C.accentSoft }}>Show {Math.min(120, rest.length - limit)} more of {rest.length - limit}</button>}
          </>}
        </Card>
        <Card>
          {!product ? <div>
            <Empty icon="📦" title="Pick a product" hint="Spec, photos, suppliers and what happened to it recently — before you walk to the pallet." />
            {dockFirst.length > 0 && <div className="px-2 pb-2"><div className="flex items-baseline gap-2 mb-2"><p className="label-sm" style={{ color: C.muted }}>Most urgent on the dock</p><span className="text-[11px]" style={{ color: C.muted }}>· {Math.min(6, dockFirst.length)} of {dockFirst.length} — the full list is on the left, most urgent first</span></div><div className="grid gap-2" style={{ gridTemplateColumns: "1fr 1fr" }}>{dockFirst.slice(0, 6).map(p => { const d = dockOf(p); return <button key={p.id} type="button" onClick={() => setSel(p.id)} className="qc-tile text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>{asPhotoList(p.photos).length ? <img src={thumbSrc(asPhotoList(p.photos)[0])} alt="" className="w-9 h-9 rounded-lg object-contain" style={{ background: PHOTO_BG }} /> : <span className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: C.surface, color: C.muted }}><Ic i={ImageIcon} s={14} mr={0} /></span>}<span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{p.name}</span><span className="block text-[11px]" style={{ color: d.some(r => r.blocking) ? C.bad : C.muted }}>{d.length} pallet{d.length === 1 ? "" : "s"} · {[...new Set(d.map(r => r.location).filter(Boolean))].slice(0, 2).join(", ")}{d.some(r => r.blocking) ? " · needed today" : d[0]?.priority ? ` · ${d[0].priority}` : ""}</span></span></button>; })}</div></div>}
          </div> : (
            <>
              {/* Header */}
              <div className="flex items-start gap-4">
                {asPhotoList(product.photos).length ? <img src={thumbSrc(asPhotoList(product.photos)[0])} loading="lazy" decoding="async" alt="" className="w-24 h-24 rounded-xl object-contain flex-shrink-0" style={{ border: `1px solid ${C.line}`, background: PHOTO_BG }} /> : <div className="w-24 h-24 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.muted }}><Ic i={ImageIcon} s={28} mr={0} /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap"><h2 className="text-lg font-semibold leading-tight">{product.name}</h2>{product.isBio && <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: C.okBg, color: C.ok }}>bio</span>}{product.isActive === false && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: C.line, color: C.muted }}>inactive</span>}</div>
                  <p className="text-xs mt-1 font-mono break-all" style={{ color: C.muted }}>ID {product.articleId || "—"}{product.barcodeCu ? ` · CU ${product.barcodeCu}` : ""}{product.barcodeTu ? ` · TU ${product.barcodeTu}` : ""}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    <Fact k="Category" v={catPath(product.categoryId)} /><Fact k="CU / TU" v={product.cusPerTu} /><Fact k="pcs / CU" v={product.piecesPerCu} /><Fact k="g / CU" v={product.weightPerCu} />
                    {product.sortable && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: product.sortable.value ? C.okBg : C.bg, color: product.sortable.value ? C.ok : C.muted, border: product.sortable.value ? "none" : `1px solid ${C.line}` }}>{product.sortable.value ? "sortable" : "not sortable"}</span>}
                    {effectiveAttributes(s, product).map(a => <Fact key={a.dictionaryId} k={a.list} v={a.value} />)}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  {onStartInspection && <Primary small onClick={() => onStartInspection(product.id)}><Ic i={ClipboardList} />Start inspection</Primary>}
                  <button type="button" onClick={() => setFlagOpen(o => !o)} className="text-xs font-semibold px-3 rounded-xl inline-flex items-center justify-center" style={{ height: 30, background: C.warnBg, color: C.warn }}><Ic i={Flag} s={13} />Something's off</button>
                </div>
              </div>
              {flagOpen && <div className="flex gap-2 mt-3"><input value={flagText} onChange={e => setFlagText(e.target.value)} placeholder="What's wrong? e.g. supplier changed, spec outdated, wrong photo…" className="flex-1 text-sm rounded-xl px-3" style={{ ...inp, height: 36 }} autoFocus /><Primary small onClick={raise}>Send to the Head</Primary></div>}
              {/* On the dock */}
              {prodDock.length > 0 && <div className="rounded-xl p-3 mt-4" style={{ background: prodDock.some(r => r.blocking) ? C.badBg : C.accentSoft }}>
                <div className="flex items-center gap-2 flex-wrap"><Ic i={Truck} s={14} mr={0} style={{ color: prodDock.some(r => r.blocking) ? C.bad : C.accent }} /><span className="text-sm font-semibold" style={{ color: prodDock.some(r => r.blocking) ? C.bad : C.accent }}>On the dock now · {prodDock.length} pallet{prodDock.length === 1 ? "" : "s"}</span>{prodDock.some(r => r.blocking) && <span className="text-xs font-medium" style={{ color: C.bad }}>· needed today</span>}</div>
                <div className="flex flex-wrap gap-1.5 mt-2">{prodDock.map(r => { const done = completedInspectionFor(s, r.hu); return <button key={r.hu} type="button" onClick={() => openPallet && openPallet(r.hu)} className="text-xs px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5" style={{ background: C.surface, border: `1px solid ${C.line}` }}><b>{r.location || "—"}</b>{r.priority && <span style={{ color: C.muted }}>· {r.priority}</span>}{r.po && <span className="font-mono" style={{ color: C.muted }}>· PO {r.po}</span>}{done ? <Ic i={Check} s={12} mr={0} style={{ color: C.ok }} /> : null}<Ic i={ChevronRight} s={12} mr={0} style={{ color: C.muted }} /></button>; })}</div>
              </div>}
              {/* Notes that change how you inspect */}
              <div className="mt-4">
                {s.announcements.filter(a => annMatchesProduct(s, a, product)).map(a => <Note key={a.id} tone="warn">📣 <b>{a.title}</b>{a.body ? <> — {richText(a.body)}</> : null}<AnnounceFileList announcement={a} colors={C} compact /></Note>)}
                <LiveNote product={product} /><ComplaintsNote s={s} articleId={product.articleId} /><ExtRejectionsNote s={s} articleId={product.articleId} />
                {hist?.count > 0 && <Note tone="bad"><b>{hist.count} rejected by the team in the last 14 days</b>{hist.problems.length ? <> — {hist.problems.slice(0, 3).map(p => `${p.name} ×${p.count}`).join(", ")}</> : null}</Note>}
                {openFlags.length > 0 && <Note tone="warn">🚩 {openFlags.length} open flag{openFlags.length === 1 ? "" : "s"} on this product — the Head hasn't resolved {openFlags.length === 1 ? "it" : "them"} yet.</Note>}
              </div>
              {/* Specs */}
              <Section title="Specifications" right={(() => { const ref = s.inspections.find(i => i.productId === product.id && i.isReference); return ref ? <button type="button" onClick={() => setShowRef(r => r ? null : ref.id)} className="text-xs font-medium inline-flex items-center" style={{ color: C.ok }}><Ic i={Star} s={13} />{showRef ? "Hide the reference" : "See how it should look"}</button> : null; })()}>
                {specs.length === 0 ? <p className="text-sm" style={{ color: C.muted }}>No specifications yet — inspect by the general rules for the category.</p> : <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}><tbody>
                  {specs.map(sp => <tr key={sp.id} style={{ borderTop: `1px solid ${C.line}` }}><td className="py-2 pr-3">{sp.name}{sp.basis && <span className="text-[11px] ml-1.5" style={{ color: C.muted }}>per {sp.basis === "cu" ? "CU" : sp.basis}</span>}</td><td className="py-2 pr-3 text-right"><SpecValue spec={sp} colors={C} /></td><td className="py-2 text-right text-[11px] whitespace-nowrap" style={{ color: C.muted, width: 120 }}>{sp.temp ? <span style={{ color: C.bad }}>temporary</span> : sp.origin === "sheet" ? "commercial sheet" : sp.source !== "product" ? sp.source : "product"}</td></tr>)}
                </tbody></table>}
                {showRef && (() => { const ref = s.inspections.find(i => i.id === showRef); return ref ? <div className="rounded-xl p-3 mt-3" style={{ border: `1px solid ${C.ok}` }}><ReportView insp={ref} s={s} user={user} onEdit={() => {}} onAnswer={() => {}} /></div> : null; })()}
              </Section>
              {(() => {
                const photosAll = asPhotoList(product.photos); const vars = effectiveVarieties(s, product);
                const tiles = [
                  ["photos", ImageIcon, "Photos", photosAll.length, "how it should look"],
                  ["guide", Eye, "Reference guide", refNotes.length, "what each defect looks like"],
                  ["ency", BookOpen, "Encyclopedia", guide.length, "notes about the product"],
                  ["history", ClipboardList, "Inspections", history.length, "what the team found"],
                  ["supply", Truck, "Suppliers & varieties", assigned.length + vars.length, "who delivers it"],
                  ["types", Layers, "Inspection types", allowedTypes.length, "how it may be inspected"],
                ].filter(([, , , n]) => n > 0);
                if (!tiles.length && !product.consumerAppUrl) return null;
                return <div className="mt-5">
                  <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {tiles.map(([k, I, label, n, hint]) => <button key={k} type="button" onClick={() => setSec(x => x === k ? null : k)} className="qc-tile text-left rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ background: sec === k ? C.accentSoft : C.bg, border: `1px solid ${sec === k ? C.accent : C.line}` }}>
                      <span className="w-8 h-8 rounded-lg inline-flex items-center justify-center flex-shrink-0" style={{ background: sec === k ? C.accent : C.surface, color: sec === k ? C.onDark : C.accent, border: sec === k ? "none" : `1px solid ${C.line}` }}><Ic i={I} s={15} mr={0} /></span>
                      <span className="min-w-0"><span className="block text-sm font-medium leading-tight truncate" style={{ color: sec === k ? C.accent : C.ink }}>{label} <span style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>· {n}</span></span><span className="block text-[11px] truncate" style={{ color: C.muted }}>{hint}</span></span>
                    </button>)}
                    {product.consumerAppUrl && <a href={product.consumerAppUrl} target="_blank" rel="noopener noreferrer" className="qc-tile rounded-xl px-3 py-2.5 flex items-center gap-2.5 no-underline" style={{ background: C.bg, border: `1px solid ${C.line}` }}><span className="w-8 h-8 rounded-lg inline-flex items-center justify-center flex-shrink-0" style={{ background: C.surface, color: C.accent, border: `1px solid ${C.line}` }}><Ic i={ExternalLink} s={15} mr={0} /></span><span className="min-w-0"><span className="block text-sm font-medium leading-tight truncate">Consumer app</span><span className="block text-[11px] truncate" style={{ color: C.muted }}>how customers see it</span></span></a>}
                  </div>
                  {sec && <div className="rounded-xl p-4 mt-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                    {sec === "photos" && <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>{photosAll.map((ph, ix) => <img key={ph.id || ix} src={thumbSrc(ph)} loading="lazy" decoding="async" alt="" className="w-full rounded-lg object-contain" style={{ aspectRatio: "1 / 1", background: PHOTO_BG, border: `1px solid ${C.line}` }} />)}</div>}
                    {sec === "guide" && <><p className="text-[12px] mb-2" style={{ color: C.muted }}>What each defect looks like on this product — notes and photos from the Head.</p>{refNotes.map(n => <FoldNote key={n.id} title={problemPath(s.problems, n.problemId) || "Defect"} chip={n.inherited ? <InheritChip label={n.source} /> : null}>{n.description && <p className="text-sm whitespace-pre-wrap mb-2">{n.description}</p>}<PhotoStrip photos={n.photos} size={84} /></FoldNote>)}</>}
                    {sec === "ency" && guide.map(g => <FoldNote key={g.id} title={g.title || "Untitled entry"} chip={g.inherited ? <InheritChip label={g.source} /> : null}>{g.body && <p className="text-sm whitespace-pre-wrap mb-2">{g.body}</p>}<PhotoStrip photos={g.photos} size={84} /></FoldNote>)}
                    {sec === "history" && history.slice(0, 10).map(i => { const who = s.users.find(u => u.id === i.controllerId); const rej = i.result === "Rejected"; return <button key={i.id} type="button" onClick={() => onOpenInspection && onOpenInspection(i.id)} className="w-full flex items-center gap-3 text-sm py-2 text-left" style={{ borderTop: `1px solid ${C.line}` }}><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: rej ? C.badBg : C.okBg, color: rej ? C.bad : C.ok, minWidth: 66, textAlign: "center" }}>{rej ? "Rejected" : "Accepted"}</span><span className="flex-1 truncate" style={{ color: i.comment ? C.ink : C.muted }}>{i.comment || "no comment"}</span><span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>{who ? `${who.name.split(" ")[0]} · ` : ""}{fmtTime(i.completedAt)}</span></button>; })}
                    {sec === "supply" && <div className="grid gap-4" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div><p className="label-sm mb-1.5" style={{ color: C.muted }}>Suppliers</p>{assigned.length ? <div className="flex flex-wrap gap-1">{assigned.map(x => <span key={x.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.accentSoft, color: C.accent }}>{x.name}</span>)}</div> : <p className="text-xs" style={{ color: C.muted }}>none assigned</p>}</div>
                      <div><p className="label-sm mb-1.5" style={{ color: C.muted }}>Varieties</p>{vars.length ? <div className="flex flex-wrap gap-1">{vars.map(v => <span key={v.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.surface, border: `1px solid ${C.line}` }} title={v.source}>{v.name}</span>)}</div> : <p className="text-xs" style={{ color: C.muted }}>none</p>}</div>
                    </div>}
                    {sec === "types" && <div className="flex flex-wrap gap-1.5">{allowedTypes.map(tp => <span key={tp.id} className="text-xs px-2.5 py-1 rounded-full" style={{ background: C.surface, border: `1px solid ${C.line}` }}>{tp.name}</span>)}<span className="text-[11px] self-center" style={{ color: C.muted }}>· set on {policy.source}</span></div>}
                  </div>}
                </div>; })()}
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
function AnnouncementsPage({ s, set, user, notify, openProduct }) {
  const [tab, setTab] = useState("active"); const [q, setQ] = useState("");
  const [d, setD] = useState({ blocking: false, dashboard: true, product: false, category: false, title: "", body: "", productId: "", categoryId: "", validTo: "" });
  const [files, setFiles] = useState([]);
  const controllers = s.users.filter(u => u.role === "Controller" && u.active !== false);
  const catPath = id => { const c = s.categories.find(x => x.id === id); if (!c) return "—"; const p = c.parentId && s.categories.find(x => x.id === c.parentId); return p ? `${p.name} › ${c.name}` : c.name; };
  const valid = d.title.trim() && d.body.trim() && (d.blocking || d.dashboard || d.product || d.category) && (!d.product || d.productId) && (!d.category || d.categoryId);
  const add = () => {
    if (!valid) return;
    const a = { id: uid(), isBlocking: d.blocking, showOnDashboard: d.dashboard, productId: d.product ? d.productId : null, categoryId: d.category ? d.categoryId : null, title: d.title.trim(), body: d.body.trim(), validTo: d.dashboard ? (d.validTo || null) : null, createdBy: user.id, createdAt: nowISO(), acks: {}, attachments: files };
    set(x => ({ ...x, announcements: [...x.announcements, a] }));
    if (a.isBlocking) controllers.forEach(c => notify("Announcement", `New blocking announcement: ${a.title}`, "Announcement", a.id, c.id));
    setD({ blocking: false, dashboard: true, product: false, category: false, title: "", body: "", productId: "", categoryId: "", validTo: "" });
    setFiles([]);
  };
  const remove = id => set(x => ({ ...x, announcements: x.announcements.filter(a => a.id !== id) }));
  const all = [...s.announcements].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  const expired = a => a.showOnDashboard && !annActive(a) && !a.productId && !a.categoryId && !a.isBlocking; // dashboard-only notes past their date
  const qq = q.trim().toLowerCase();
  const pool = all.filter(a => !qq || `${a.title} ${a.body} ${s.products.find(p => p.id === a.productId)?.name || ""}`.toLowerCase().includes(qq));
  const list = pool.filter(a => tab === "all" ? true : tab === "expired" ? expired(a) : !expired(a));
  const nActive = pool.filter(a => !expired(a)).length, nExpired = pool.filter(expired).length;
  // *bold* in the body, as the Head types it
  const rich = txt => String(txt || "").split(/(\*[^*\n]+\*)/g).map((part, i) => /^\*[^*]+\*$/.test(part) ? <b key={i}>{part.slice(1, -1)}</b> : <Fragment key={i}>{part}</Fragment>);
  const Chip = ({ children, tone, onClick }) => { const fg = tone === "bad" ? C.bad : tone === "warn" ? C.warn : tone === "ok" ? C.ok : tone === "accent" ? C.accent : C.muted; const bg = tone === "bad" ? C.badBg : tone === "warn" ? C.warnBg : tone === "ok" ? C.okBg : tone === "accent" ? C.accentSoft : C.bg; const Tag = onClick ? "button" : "span"; return <Tag type={onClick ? "button" : undefined} onClick={onClick} className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap" style={{ background: bg, color: fg, border: tone ? "none" : `1px solid ${C.line}` }}>{children}</Tag>; };
  const canPublish = user.role === "Head";
  return (
    <div>
      <h1 className="mb-1">Announcements</h1>
      <p className="text-sm mb-5" style={{ color: C.muted, maxWidth: 640 }}>{canPublish ? "One announcement, several channels — enable all of them to make sure it lands." : "Notes from the Head — same list as on the phone. Blocking ones still have to be acknowledged first."}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: canPublish ? "1fr 1fr" : "1fr" }}>
        {canPublish && <Card>
          <p className="font-medium text-sm mb-3">New announcement</p>
          <p className="text-xs mb-1.5" style={{ color: C.muted }}>Channels — tick every one it should reach through:</p>
          {Object.entries(CHANNELS).map(([k, [l, desc]]) => <label key={k} className="flex items-start gap-2 text-sm mb-1.5 cursor-pointer"><input type="checkbox" checked={!!d[k]} onChange={e => setD(x => ({ ...x, [k]: e.target.checked }))} className="mt-1" /><span><b>{l}</b><span className="block text-xs" style={{ color: C.muted }}>{desc}</span></span></label>)}
          <div className="mb-2" />
          <input value={d.title} onChange={e => setD(x => ({ ...x, title: e.target.value }))} placeholder="title" className="w-full text-sm rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
          <textarea value={d.body} onChange={e => setD(x => ({ ...x, body: e.target.value }))} rows={3} placeholder="body" className="w-full text-sm rounded px-2 py-1.5 outline-none mb-2" style={{ ...inp }} />
          {d.product && <div className="mb-2"><ProductPicker products={s.products} value={d.productId} onChange={id => setD(x => ({ ...x, productId: id }))} invalid={!d.productId} /></div>}
          {d.category && <div className="mb-2"><CategoryPicker categories={s.categories} value={d.categoryId} onChange={id => setD(x => ({ ...x, categoryId: id }))} invalid={!d.categoryId} /></div>}
          {d.dashboard && <label className="text-xs flex items-center gap-2 mb-2" style={{ color: C.muted }}>on the dashboard until <input type="date" value={d.validTo} onChange={e => setD(x => ({ ...x, validTo: e.target.value }))} className="text-sm rounded px-2 py-1 outline-none" style={{ ...inp }} /> (empty = no expiry)</label>}
          <AnnounceFileList files={files} colors={C} onRemove={id => setFiles(list => list.filter(f => f.id !== id))} />
          <AnnounceAttachButton colors={C} onAdd={added => setFiles(list => [...list, ...added])} />
          <Primary onClick={add} disabled={!valid}>Publish</Primary>
        </Card>}
        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {[["active", "Current", nActive], ["expired", "Expired", nExpired], ["all", "All", pool.length]].map(([id, l, n]) => <button key={id} type="button" onClick={() => setTab(id)} className="text-xs font-medium px-3 rounded-full inline-flex items-center gap-1.5" style={{ height: 30, background: tab === id ? C.ink : C.surface, color: tab === id ? C.onDark : C.ink, border: `1px solid ${tab === id ? C.ink : C.line}` }}>{l}<span style={{ color: tab === id ? C.onDark : C.muted, fontVariantNumeric: "tabular-nums" }}>{n}</span></button>)}
            <div className="flex-1" />
            <SearchBox value={q} onChange={setQ} placeholder="Search notes…" style={{ width: 240 }} />
          </div>
          {list.length === 0 ? <Card><Empty icon="📣" title={qq ? "Nothing matches" : tab === "expired" ? "Nothing expired" : "No announcements"} hint={canPublish ? "Publish the first one on the left." : "Nothing from the Head right now."} /></Card> : <div className="flex flex-col gap-3">
            {list.map(a => { const acked = Object.keys(a.acks || {}).length; const prod = a.productId && s.products.find(p => p.id === a.productId); const isExp = expired(a); const mineAck = a.isBlocking && (a.acks || {})[user.id];
              const accent = a.isBlocking ? C.bad : a.productId ? C.warn : a.categoryId ? C.accent : C.line;
              return <div key={a.id} className="qc-elev rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `4px solid ${accent}`, boxShadow: lift(), opacity: isExp ? .6 : 1 }}>
                <div className="px-5 pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold leading-tight" style={{ fontSize: 16 }}>{a.title}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {a.isBlocking && <Chip tone="bad"><Ic i={ShieldAlert} s={11} mr={0} />Must be acknowledged{canPublish ? ` · ${acked}/${controllers.length}` : mineAck ? " · you did ✓" : " · pending"}</Chip>}
                        {prod && <Chip tone="warn" onClick={openProduct ? () => openProduct(prod.id) : undefined}><Ic i={Package} s={11} mr={0} />{prod.name}{openProduct && <Ic i={ChevronRight} s={11} mr={0} />}</Chip>}
                        {a.categoryId && <Chip tone="accent"><Ic i={FolderTree} s={11} mr={0} />{catPath(a.categoryId)}</Chip>}
                        {a.showOnDashboard && (isExp || !annActive(a) ? <Chip>Dashboard · expired {a.validTo}</Chip> : <Chip><Ic i={LayoutDashboard} s={11} mr={0} />Dashboard{a.validTo ? ` until ${fmtUntil(a.validTo)}` : ""}</Chip>)}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs" style={{ color: C.muted }}>{fmtTime(a.createdAt)}</p>
                      <p className="text-[11px]" style={{ color: C.muted }}>{s.users.find(u => u.id === a.createdBy)?.name.split(" ")[0] || "Head"}</p>
                    </div>
                  </div>
                  <p className="text-sm mt-3 leading-relaxed whitespace-pre-wrap" style={{ maxWidth: 760 }}>{rich(a.body)}</p>
                  <AnnounceFileList announcement={a} colors={C} compact />
                  {a.isBlocking && canPublish && <div className="mt-3 flex flex-wrap gap-1.5">{controllers.map(c => <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ background: a.acks?.[c.id] ? C.okBg : C.bg, color: a.acks?.[c.id] ? C.ok : C.muted, border: a.acks?.[c.id] ? "none" : `1px solid ${C.line}` }}><Avatar user={c} size={14} />{c.name.split(" ")[0]}{a.acks?.[c.id] ? " ✓" : ""}</span>)}</div>}
                  {canPublish && <div className="mt-3 flex justify-end"><button type="button" onClick={() => { if (confirm(`Remove “${a.title}”?`)) remove(a.id); }} className="text-[11px]" style={{ color: C.muted }}>Remove</button></div>}
                </div>
              </div>; })}
          </div>}
        </div>
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
        <AnnounceFileList announcement={a} colors={C} />
        <p className="text-xs mb-4" style={{ color: C.muted }}>{s.users.find(u => u.id === a.createdBy)?.name} · {fmtTime(a.createdAt)}</p>
        <Primary onClick={ack}>I have read and acknowledge</Primary>
      </div>
    </div>
  );
}

// ═══════════════════ MODULE 4: Messages (1:1 and groups) ═══════════════════
const unreadIn = (conv, userId) => { const last = (conv.lastRead || {})[userId] || ""; return (conv.messages || []).filter(m => m.senderId !== userId && (m.at || "") > last).length; };
const convName = (conv, s, userId) => conv.name || conv.participantIds.filter(id => id !== userId).map(id => s.users.find(u => u.id === id)?.name).join(", ") || "(empty)";
// ───────── Chat presentation shared by the conversation list and the thread ─────────
const convOther = (conv, s, userId) => conv.isGroup ? null : s.users.find(u => u.id === conv.participantIds.find(id => id !== userId));
const ConvAvatar = ({ conv, s, userId, size = 40 }) => { const other = convOther(conv, s, userId); if (other) return <Avatar user={other} size={size} />; return <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, background: C.ink, color: C.onDark }}><Ic i={Users} s={Math.round(size * .45)} mr={0} /></div>; };
const msgPreview = (m, s, userId) => { if (!m) return ""; const who = m.senderId === userId ? "You" : (s.users.find(u => u.id === m.senderId)?.name.split(" ")[0] || "?"); const body = m.text || ((m.attachments || []).length ? ((m.attachments || []).some(a => a.kind === "image") ? "Photo" : "Attachment") : (m.contexts || []).length ? "Linked item" : ""); return `${who}: ${body}`; };
const chatTime = iso => { if (!iso) return ""; const d = new Date(iso), t = new Date(); if (d.toDateString() === t.toDateString()) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); if (diff === 1) return "Yesterday"; if (diff < 7) return d.toLocaleDateString("en-GB", { weekday: "short" }); return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); };
const chatDayLabel = iso => { const l = dayLabel(iso); return l === "Today" || l === "Yesterday" ? l : new Date(iso).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); };
const lastMsgAt = c => (c.messages?.slice(-1)[0]?.at) || c.createdAt || "";
// One conversation row: avatar, name, time of the last message, preview with the sender, unread badge.
function ConvRow({ conv, s, user, active, onClick }) {
  const un = unreadIn(conv, user.id); const last = (conv.messages || []).slice(-1)[0];
  return (
    <button onClick={onClick} className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors" style={{ background: active ? C.accentSoft : "transparent" }}>
      <ConvAvatar conv={conv} s={s} userId={user.id} size={44} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2"><p className="text-[14px] flex-1 truncate" style={{ fontWeight: un ? 650 : 500, color: C.ink }}>{convName(conv, s, user.id)}</p><span className="text-[11px] flex-shrink-0" style={{ color: un ? C.accent : C.muted, fontWeight: un ? 600 : 400 }}>{chatTime(last?.at)}</span></div>
        <div className="flex items-center gap-2 mt-0.5"><p className="text-[12.5px] flex-1 truncate" style={{ color: un ? C.ink : C.muted, fontWeight: un ? 500 : 400 }}>{last ? msgPreview(last, s, user.id) : (conv.isGroup ? `${conv.participantIds.length} people · no messages yet` : "No messages yet")}</p>{un > 0 && <span className="text-[10.5px] font-semibold min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.accent, color: C.onDark }}>{un}</span>}</div>
      </div>
    </button>
  );
}
// The message thread: day separators, runs of messages from one sender grouped (avatar once, tight corners inside a run),
// mine on the right in accent, theirs on the left in surface. Scrolls to the newest message on open and on every send.
function ChatThread({ s, conv, user, onOpenCtx, wide }) {
  const ref = useRef(null); const msgs = conv.messages || [];
  useEffect(() => { const el = ref.current; if (el) el.scrollTop = el.scrollHeight; }, [conv.id, msgs.length]);
  const hh = iso => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const gap = (a, b) => Math.abs(new Date(a) - new Date(b)) > 5 * 60000;
  return (
    <div ref={ref} className="flex-1 overflow-y-auto px-3 py-3" style={{ background: C.bg }}>
      {msgs.length === 0 && <div className="flex flex-col items-center justify-center text-center py-10 px-6"><ConvAvatar conv={conv} s={s} userId={user.id} size={56} /><p className="text-sm font-semibold mt-3">{convName(conv, s, user.id)}</p><p className="text-xs mt-1 leading-snug" style={{ color: C.muted }}>No messages yet. Say hello, attach a photo or link a pallet, product or inspection.</p></div>}
      {msgs.map((m, i) => { const me = m.senderId === user.id; const prev = msgs[i - 1], next = msgs[i + 1];
        const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
        const firstOfRun = newDay || prev.senderId !== m.senderId || gap(prev.at, m.at);
        const lastOfRun = !next || next.senderId !== m.senderId || new Date(next.at).toDateString() !== new Date(m.at).toDateString() || gap(next.at, m.at);
        const sender = s.users.find(u => u.id === m.senderId);
        const R = 18, r = 6; const radius = me ? `${R}px ${firstOfRun ? R : r}px ${lastOfRun ? R : r}px ${R}px` : `${firstOfRun ? R : r}px ${R}px ${R}px ${lastOfRun ? R : r}px`;
        return (
          <Fragment key={m.id}>
            {newDay && <div className="flex items-center gap-2 my-3"><span className="flex-1" style={{ borderTop: `1px solid ${C.line}` }} /><span className="text-[10.5px] font-medium px-2" style={{ color: C.muted }}>{chatDayLabel(m.at)}</span><span className="flex-1" style={{ borderTop: `1px solid ${C.line}` }} /></div>}
            <div className={`flex items-end gap-2 ${me ? "justify-end" : "justify-start"}`} style={{ marginTop: firstOfRun ? 8 : 2 }}>
              {!me && <span className="flex-shrink-0" style={{ width: 28 }}>{lastOfRun && <Avatar user={sender} size={28} />}</span>}
              <div style={{ maxWidth: wide ? "68%" : "80%" }}>
                {!me && conv.isGroup && firstOfRun && <p className="text-[11px] font-medium mb-0.5 ml-2" style={{ color: C.muted }}>{sender?.name.split(" ")[0]}</p>}
                <div className="px-3.5 py-2" style={{ background: me ? C.accent : C.surface, color: me ? C.onDark : C.ink, borderRadius: radius, border: me ? "none" : `1px solid ${C.line}`, boxShadow: "0 1px 1px rgba(0,0,0,.04)" }}>
                  <ContextChips s={s} contexts={m.contexts?.length ? m.contexts : (m.productId ? [{ kind: "product", id: m.productId }] : [])} onOpen={onOpenCtx} dark={me} />
                  <AttachmentList attachments={m.attachments} dark={me} />
                  {m.text && <p className="text-[14px] leading-snug" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</p>}
                  <p className="text-[10px] mt-1 text-right leading-none" style={{ color: me ? C.onDarkMuted : C.muted }}>{hh(m.at)}</p>
                </div>
              </div>
            </div>
          </Fragment>
        ); })}
    </div>
  );
}
// People picker for a new conversation: one person = direct message, more = group (optional name).
function NewConversation({ s, user, pick, setPick, gname, setGname, onCreate, onCancel }) {
  const others = s.users.filter(u => u.id !== user.id && u.active !== false).sort((a, b) => (a.role === "Head" ? -1 : 1) - (b.role === "Head" ? -1 : 1) || a.name.localeCompare(b.name));
  const toggle = id => setPick(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  return (
    <div>
      <p className="text-xs mb-2" style={{ color: C.muted }}>Pick one person for a direct message, or several for a group.</p>
      <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${C.line}` }}>
        {others.map((u, i) => { const on = pick.includes(u.id); return (
          <button key={u.id} onClick={() => toggle(u.id)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left" style={{ background: on ? C.accentSoft : C.surface, borderTop: i ? `1px solid ${C.line}` : "none" }}>
            <Avatar user={u} size={36} />
            <span className="flex-1 min-w-0"><span className="block text-sm font-medium truncate">{u.name}</span><span className="block text-[11px]" style={{ color: C.muted }}>{u.role === "Head" ? "Head of QC" : "Controller"}</span></span>
            <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: on ? C.accent : "transparent", border: `1.5px solid ${on ? C.accent : C.line}`, color: C.onDark }}>{on && <Ic i={Check} s={12} mr={0} />}</span>
          </button>
        ); })}
        {others.length === 0 && <p className="text-xs px-3 py-3" style={{ color: C.muted }}>Nobody else to message yet.</p>}
      </div>
      {pick.length > 1 && <input value={gname} onChange={e => setGname(e.target.value)} placeholder="Group name (optional)" className="w-full text-sm rounded-xl px-3 py-2.5 outline-none mt-3" style={{ ...inp }} />}
      <div className="flex gap-2 mt-3">
        <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Cancel</button>
        <button onClick={onCreate} disabled={!pick.length} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: pick.length ? C.accent : C.line, color: pick.length ? C.onDark : C.muted }}>{pick.length > 1 ? `Start group · ${pick.length}` : "Start chat"}</button>
      </div>
    </div>
  );
}
function MessagesPage({ s, set, user, setPage, onOpenProduct, onOpenInspection, onOpenCategory, initialContext, clearInitialContext }) {
  const [open, setOpen] = useState(null); const [text, setText] = useState(""); const [creating, setCreating] = useState(false); const [pick, setPick] = useState([]); const [gname, setGname] = useState(""); const [q, setQ] = useState("");
  const mine = s.conversations.filter(c => c.participantIds.includes(user.id) && c.isActive !== false).sort((a, b) => lastMsgAt(b).localeCompare(lastMsgAt(a)));
  const qq = q.trim().toLowerCase();
  const shown = qq ? mine.filter(c => convName(c, s, user.id).toLowerCase().includes(qq) || (c.messages || []).some(m => (m.text || "").toLowerCase().includes(qq))) : mine;
  const conv = s.conversations.find(c => c.id === open);
  const markRead = id => set(x => ({ ...x, conversations: x.conversations.map(c => c.id === id ? { ...c, lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) }));
  const openConv = id => { setOpen(id); markRead(id); setCreating(false); };
  // Land on the most recent conversation instead of an empty pane — the office user usually wants to continue, not browse.
  useEffect(() => { if (!open && mine.length && !creating) openConv(mine[0].id); }, [open, mine.length]);
  const [pending, setPending] = useState({ attachments: [], contexts: initialContext ? [initialContext] : [] });
  useEffect(() => { if (initialContext) { setPending(p => ({ ...p, contexts: [...p.contexts.filter(c => !(c.kind === initialContext.kind && c.id === initialContext.id)), initialContext] })); clearInitialContext && clearInitialContext(); } }, [initialContext]);
  const canSend = !!(text.trim() || pending.attachments.length || pending.contexts.length);
  const send = () => { if (!canSend || !conv) return; set(x => ({ ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, messages: [...(c.messages || []), { id: uid(), senderId: user.id, text: text.trim(), at: nowISO(), attachments: pending.attachments, contexts: pending.contexts, productId: pending.contexts.find(k => k.kind === "product")?.id || null }], lastRead: { ...(c.lastRead || {}), [user.id]: nowISO() } } : c) })); setText(""); setPending({ attachments: [], contexts: [] }); };
  const openCtx = c => { if (c.kind === "product") { setPage && setPage(user.role === "Head" ? "products" : "catalog"); onOpenProduct && onOpenProduct(c.id); } else if (c.kind === "inspection") { onOpenInspection && onOpenInspection(c.id); } else if (c.kind === "flag") { setPage && setPage("flags"); } else if (c.kind === "category") { setPage && setPage("categories"); onOpenCategory && onOpenCategory(c.id); } };
  const create = () => {
    if (!pick.length) return;
    const isGroup = pick.length > 1 || !!gname.trim();
    if (!isGroup) { const existing = s.conversations.find(c => !c.isGroup && c.participantIds.length === 2 && c.participantIds.includes(user.id) && c.participantIds.includes(pick[0])); if (existing) { openConv(existing.id); setPick([]); return; } }
    const id = uid();
    set(x => ({ ...x, conversations: [...x.conversations, { id, isGroup, name: isGroup ? (gname.trim() || null) : null, participantIds: [user.id, ...pick], createdBy: user.id, createdAt: nowISO(), messages: [], lastRead: { [user.id]: nowISO() }, isActive: true }] }));
    openConv(id); setPick([]); setGname("");
  };
  const leave = () => { if (!conv || !conv.isGroup) return; set(x => ({ ...x, conversations: x.conversations.map(c => c.id === conv.id ? { ...c, participantIds: c.participantIds.filter(id => id !== user.id), removed: { ...(c.removed || {}), [user.id]: nowISO() } } : c) })); setOpen(null); };
  const other = conv && convOther(conv, s, user.id);
  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 56px - 56px)" }}>
      <div className="flex items-center gap-3 mb-3"><h1 className="flex-1">Messages</h1></div>
      <div className="flex-1 min-h-0 grid rounded-2xl overflow-hidden" style={{ gridTemplateColumns: "320px 1fr", background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex flex-col min-h-0" style={{ borderRight: `1px solid ${C.line}` }}>
          <div className="px-3 pt-3 pb-2 flex items-center gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Search people or messages" className="flex-1" inputClass="rounded-xl" />
            <button onClick={() => { setCreating(o => !o); setPick([]); setGname(""); }} className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: creating ? C.ink : C.accent, color: C.onDark }} title="New conversation"><Ic i={creating ? X : Plus} s={18} mr={0} /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2">
            {creating && <div className="px-1.5 pb-3 mb-1" style={{ borderBottom: `1px solid ${C.line}` }}><p className="text-sm font-semibold mb-2 px-1">New conversation</p><NewConversation s={s} user={user} pick={pick} setPick={setPick} gname={gname} setGname={setGname} onCreate={create} onCancel={() => { setCreating(false); setPick([]); setGname(""); }} /></div>}
            {shown.length === 0 && !qq && !creating && <div className="text-center px-6 py-10"><span className="w-12 h-12 rounded-full inline-flex items-center justify-center mb-2" style={{ background: C.accentSoft, color: C.accent }}><Ic i={MessageSquare} s={22} mr={0} /></span><p className="text-sm font-semibold">No conversations yet</p><p className="text-xs mt-1" style={{ color: C.muted }}>Start one with the + button.</p></div>}
            {shown.length === 0 && qq && <p className="text-xs px-3 py-6 text-center" style={{ color: C.muted }}>Nothing matches “{q}”.</p>}
            {shown.map(c => <ConvRow key={c.id} conv={c} s={s} user={user} active={open === c.id} onClick={() => openConv(c.id)} />)}
          </div>
        </div>
        <div className="flex flex-col min-h-0">
          {!conv ? <div className="flex-1 flex flex-col items-center justify-center text-center px-8" style={{ background: C.bg }}><span className="w-14 h-14 rounded-full flex items-center justify-center mb-3" style={{ background: C.accentSoft, color: C.accent }}><Ic i={MessageSquare} s={26} mr={0} /></span><p className="text-sm font-semibold">{creating ? "Pick who to message" : "Select a conversation"}</p><p className="text-xs mt-1" style={{ color: C.muted }}>Messages can carry photos, files and links to products, inspections, pallets and flags.</p></div> : (
            <>
              <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
                <ConvAvatar conv={conv} s={s} userId={user.id} size={38} />
                <div className="flex-1 min-w-0"><p className="text-[15px] font-semibold leading-tight truncate">{convName(conv, s, user.id)}</p><p className="text-[11.5px] truncate" style={{ color: C.muted }}>{other ? (other.role === "Head" ? "Head of QC" : "Controller") : conv.participantIds.map(id => s.users.find(u => u.id === id)?.name.split(" ")[0]).filter(Boolean).join(", ")}</p></div>
                {conv.isGroup && <button onClick={leave} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Leave group</button>}
              </div>
              <ChatThread s={s} conv={conv} user={user} onOpenCtx={openCtx} wide />
              <div className="px-3 pt-2 pb-2.5" style={{ borderTop: `1px solid ${C.line}` }}>
                <ComposerExtras s={s} user={user} pending={pending} setPending={setPending} bar={<>
                  <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Message… (Enter to send, Shift+Enter for a new line)" rows={1} className="flex-1 text-[14px] px-3.5 py-2 outline-none resize-none" style={{ ...inp, background: C.bg, borderRadius: 20, maxHeight: 140, minHeight: 36, lineHeight: "20px" }} />
                  <button onClick={send} disabled={!canSend} className="h-9 px-4 rounded-full flex items-center justify-center gap-1.5 flex-shrink-0 text-sm font-semibold transition-colors" style={{ background: canSend ? C.accent : C.line, color: canSend ? C.onDark : C.muted }}><Ic i={Send} s={14} mr={0} />Send</button>
                </>} />
              </div>
            </>
          )}
        </div>
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
          <button key={n.id} onClick={() => { markRead(n.id); if (n.entityType === "Inspection" && n.entityId) { setOpenId(n.entityId); setPage("inspections"); } if (n.entityType === "ProductFlag") setPage("flags"); if (n.entityType === "Conversation") setPage("messages"); if (n.entityType === "Announcement") setPage("announcements"); if (n.entityType === "Product" && n.entityId) { setSelProduct(n.entityId); setPage(user.role === "Head" ? "products" : "catalog"); } }} className="w-full text-left flex items-center gap-3 px-2 py-2.5" style={{ borderTop: `1px solid ${C.line}`, background: n.readAt ? "transparent" : C.accentSoft }}>
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
function LostPalletsPage({ s, set, user, setSel, setPage, setSelPallet }) {
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
                <td className="py-2 pr-3">{(x.hu || x.row || x.key) ? <button onClick={() => setSelPallet(x.hu || (x.row && (x.row.hu || claimKey(x.row))) || x.key)} className="underline text-left" style={{ color: C.accent }}>{x.name}</button> : x.name}</td>
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
function UnreportedPalletsPage({ s, set, user, setSel, setPage, setSelPallet }) {
  const [view, setView] = useState("open");
  const [notes, setNotes] = useState({});
  const isHead = user.role === "Head";
  const stats = unreportedStats(s);
  const shown = (view === "open" ? unreportedList(s).filter(x => !x.reviewedAt) : unreportedList(s));
  const groups = []; shown.forEach(x => { const k = dayLabel(x.detectedAt); let g = groups.find(g => g.k === k); if (!g) { g = { k, items: [] }; groups.push(g); } g.items.push(x); });
  const review = id => { reviewUnreported(set, id, user, notes[id] || ""); setNotes(n => { const { [id]: _, ...rest } = n; return rest; }); };
  const [confirmClear, setConfirmClear] = useState(false);
  const cleared = s.unreportedCleared; const clearedBy = cleared && s.users.find(u => u.id === cleared.byUserId);
  return (
    <div>
      <div className="flex items-center gap-3 mb-1"><h1 className="flex-1">Unreported pallets</h1>
        {isHead && stats.total > 0 && !confirmClear && <button onClick={() => setConfirmClear(true)} className="text-xs px-3 py-1.5 rounded-lg" style={{ border: `1px solid ${C.line}`, color: C.muted }}>Clear the log</button>}
        {isHead && confirmClear && <span className="flex items-center gap-2 text-xs rounded-lg px-3 py-1.5" style={{ background: C.badBg, color: C.bad }}>Delete all {stats.total} logged pallet{stats.total === 1 ? "" : "s"}? This cannot be undone.<button onClick={() => { clearUnreported(set, user); setConfirmClear(false); setNotes({}); }} className="px-2.5 py-1 rounded-md font-medium" style={{ background: C.bad, color: C.onDark }}>Yes, clear</button><button onClick={() => setConfirmClear(false)} className="px-2 py-1" style={{ color: C.bad }}>Cancel</button></span>}
      </div>
      {cleared && stats.total === 0 && <p className="text-xs mb-2" style={{ color: C.muted }}>Log cleared {fmtTime(cleared.at)}{clearedBy ? ` by ${clearedBy.name}` : ""} · {cleared.count} entr{cleared.count === 1 ? "y" : "ies"} removed. New disappearances will be logged again from the next dock push.</p>}
      <p className="text-sm mb-4" style={{ color: C.muted, maxWidth: 680 }}>Pallets that dropped off the dock sheet — picked or moved on — before QC ever inspected them. Nobody scans a pallet that leaves this way, so without this list nobody would know it happened. Detected automatically from the dock pushes, independent of anyone having the app open; a pallet is only logged once it has stayed missing for a full push cycle, so a brief sheet hiccup (a formula recalculating) doesn't get logged as a real incident.</p>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
        {[["Today", stats.today, C.bad], ["This week", stats.week, C.warn], ["Open", stats.open, C.warn], ["Total logged", stats.total, C.muted]].map(([l, v, col]) => (
          <div key={l} className="qc-tile rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold">{v}</p></div>
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
                    <td className="py-2 pr-3">{(x.hu || product) ? <button onClick={() => { if (x.hu && setSelPallet) setSelPallet(x.hu); else if (product) { setSel(product.id); setPage("products"); } }} className="underline text-left" style={{ color: C.accent }}>{x.name || product?.name || x.article}</button> : (x.name || x.article || "—")}</td>
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
function BlockedQueuePage({ s, set, user, setSel, setPage, setSelPallet }) {
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
          {[["Open", open.length, C.bad], ["Taken", taken.length, C.accent], ["In stack", stacked.length, C.muted], ["Unassigned", open.length - taken.length - stacked.length, C.warn]].map(([l, v, col]) => <div key={l} className="qc-tile rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}`, borderLeft: `3px solid ${col}` }}><p className="text-xs" style={{ color: C.muted }}>{l}</p><p className="text-[26px] leading-tight font-semibold">{v}</p></div>)}
        </div>
        <div className="flex gap-1.5 mb-3">{[["open", "Open"], ["mine", "Mine"], ["all", "All incl. done"]].map(([k, l]) => <button key={k} onClick={() => setView(k)} className="text-xs px-3 py-1.5 rounded-full" style={{ background: view === k ? C.ink : "transparent", color: view === k ? C.onDark : C.ink, border: `1px solid ${view === k ? C.ink : C.line}` }}>{l}</button>)}</div>
        <Card>{list.length === 0 ? <p className="text-xs py-4" style={{ color: C.muted }}>Nothing here.</p> : list.map(b => <QueueRow key={b.key} s={s} set={set} user={user} b={b} onOpen={() => { if (setSelPallet) setSelPallet(b.hu || claimKey(b)); else { const prod = s.products.find(p => p.articleId === b.article); if (prod) { setSel(prod.id); setPage("products"); } } }} />)}</Card>
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
        <h2 className="mb-1">Shift update cards</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>When a controller opens a card, it is marked seen for that person on every phone. Reset so notes, rejections and complaints show as new again — for everyone.</p>
        <p className="text-xs mb-3" style={{ color: C.muted }}>{(s.briefingSeen || []).length} seen mark{(s.briefingSeen || []).length === 1 ? "" : "s"}{(() => { const n = new Set((s.briefingSeen || []).map(r => r.userId)).size; return n ? ` · ${n} people` : ""; })()}.</p>
        <button type="button" onClick={() => set(x => clearBriefingSeen(x))} disabled={!(s.briefingSeen || []).length} className="text-sm px-3 py-2 rounded-xl font-semibold" style={{ background: (s.briefingSeen || []).length ? C.ink : C.line, color: (s.briefingSeen || []).length ? C.onDark : C.muted }}>Show all cards as new</button>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h2 className="mb-1">PO on rejection</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Off by default. When on, a Rejected inspection must have a PO. The system fills it from the dock sheet when the pallet is there; if the inspection was not started from the sheet, the controller types it.</p>
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input type="checkbox" className="mt-1" checked={!!st.requirePoOnReject} onChange={e => put({ requirePoOnReject: e.target.checked })} />
          <span>Require a PO when rejecting<span className="block text-xs mt-0.5" style={{ color: C.muted }}>Sheet pallets: pull PO ID automatically. Catalog / no sheet: required field on Reject.</span></span>
        </label>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <h2 className="mb-1">Report result icon</h2>
        <p className="text-xs mb-3" style={{ color: C.muted }}>This image is the mark on the right of the report header. The report number and Accepted or Rejected sit to its left. Upload one image per result. Leave a result blank and the report shows the words only.</p>
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
const EMPTY = { categories: [], problems: [], problemNotes: [], products: [], templates: [], suppliers: [], countries: [], users: SEED_USERS(), inspections: [], flags: [], notifications: [], announcements: [], conversations: [], dictionaries: [], inspectionTypes: SEED_TYPES(), tempSpecs: [], settings: { defaultPolicy: "Visual", skipReasonRequired: false }, briefingSeen: [] };

// Migration of older exports: product.suppliers as names → global list + supplierIds
const normalize = raw => {
  const s = { ...EMPTY, ...raw };
  s.suppliers = Array.isArray(s.suppliers) ? s.suppliers : [];
  s.users = Array.isArray(s.users) && s.users.length ? s.users : SEED_USERS();
  s.inspections = (Array.isArray(s.inspections) ? s.inspections : []).map(i => ({ ...i, type: i.type || "Full", photos: Object.fromEntries(Object.entries(i.photos || {}).map(([k, v]) => [k, asPhotoList(v)])), remarks: (i.remarks || []).map(r => ({ ...r, photos: asPhotoList(r.photos) })) }));
  s.flags = Array.isArray(s.flags) ? s.flags : [];
  // Complaints: the old single list becomes the first dated snapshot; `complaints` stays as the latest snapshot's copy.
  s.complaintSnapshots = Array.isArray(s.complaintSnapshots) && s.complaintSnapshots.length ? sortSnapshots(s.complaintSnapshots) : migrateLegacy(s.complaints, uid);
  if (s.complaintSnapshots.length) s.complaints = asLegacyMeta(latestSnapshot(s.complaintSnapshots), s.complaintSnapshots);
  s.notifications = Array.isArray(s.notifications) ? s.notifications : [];
  s.announcements = (Array.isArray(s.announcements) ? s.announcements : []).map(a => {
    const row = a.type ? (({ type, ...r }) => ({ ...r, isBlocking: type === "Blocking", showOnDashboard: type === "General", productId: type === "Product" ? r.productId : null }))(a) : a;
    return { ...row, attachments: announceFilesOf(row) };
  });
  s.conversations = Array.isArray(s.conversations) ? s.conversations : [];
  s.integrations = Array.isArray(s.integrations) ? s.integrations : [];
  { const seed = byId(SEED_USERS()); const placeholders = { "u-head": "Marta K.", "u-anna": "Anna K.", "u-jakub": "Jakub M." }; s.users = (s.users || []).map(u => placeholders[u.id] && u.name === placeholders[u.id] ? { ...u, ...seed[u.id] } : u); }
  s.categoryRules = Array.isArray(s.categoryRules) ? s.categoryRules : [];
  s.palletClaims = s.palletClaims && typeof s.palletClaims === "object" ? s.palletClaims : {};
  s.briefingSeen = Array.isArray(s.briefingSeen) ? s.briefingSeen.filter(r => r && r.id && r.userId && r.fp) : [];
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
  s.categories = s.categories.map(c => ({ ...c, hiddenProblemIds: c.hiddenProblemIds || [], guide: Array.isArray(c.guide) ? c.guide.map(e => ({ ...e, photos: asPhotoList(e.photos) })) : [], hiddenGuideIds: Array.isArray(c.hiddenGuideIds) ? c.hiddenGuideIds : [] }));
  // Reference guide: per-product notes (description + photos) on a problem type, written by the Head, shown to controllers.
  s.problemNotes = (Array.isArray(s.problemNotes) ? s.problemNotes : []).map(n => ({ ...n, photos: asPhotoList(n.photos), description: n.description || "" }));
  s.tempSpecs = closeExpiredTempSpecs(Array.isArray(s.tempSpecs) ? s.tempSpecs : []);
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
    users: SEED_USERS(), inspections: [], flags: [], notifications: [], announcements: [], conversations: [], tempSpecs: [],
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
const sameDeliveryPallets = (product, insp) => sameDeliveryRows(dockRowsForProduct(product), insp?.pallets, new Date().toISOString().slice(0, 10));
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
      set(normalize(parsed), { replace: true });
      setMsg("State loaded.");
    } catch { setMsg("This doesn't look like a valid state export."); }
  };
  // Thumbnails for photos taken before the app made them: fetch the full picture, shrink it in the browser, upload the
  // small copy and write its path next to the photo. Trails are re-checked at write time (the state may have moved on).
  const [thumbJob, setThumbJob] = useState(null);
  const missingThumbs = thumbsMissing(s).length;
  const backfillThumbs = async () => {
    const list = thumbsMissing(s); if (!list.length) return;
    let done = 0, failed = 0; const base = window.__qcServer || "";
    const at = (x, trail) => trail.reduce((n, k) => (n == null ? n : n[k]), x);
    setThumbJob({ done, failed, total: list.length });
    for (const m of list) {
      try {
        const r = await fetch(base + m.photo.path, { credentials: "include" }); if (!r.ok) throw new Error(String(r.status));
        const d = await readAsDataUrl(await r.blob()); const t = d && await shrinkPhoto(d, THUMB_EDGE, 0.74);
        const path = t && t.length < d.length ? await uploadPhoto(t) : null; if (!path) throw new Error("upload");
        set(x => (at(x, m.trail)?.path === m.photo.path ? withThumb(x, m.trail, path) : x)); done++;
      } catch { failed++; }
      setThumbJob({ done, failed, total: list.length });
    }
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
      <div className="mt-3 mb-3">
        <div className="flex items-center gap-2 mb-1"><p className="font-medium text-sm">Photo thumbnails</p>{missingThumbs > 0 && !thumbJob && <Ghost onClick={backfillThumbs}>Make thumbnails for {missingThumbs} older photo{missingThumbs === 1 ? "" : "s"}</Ghost>}</div>
        <p className="text-[11px]" style={{ color: C.muted }}>New photos get a small copy for lists and tiles so screens open fast. Photos from before this change load full-size until a thumbnail is made — this runs in your browser, one photo at a time, and can be left open in a tab.{thumbJob ? ` Progress: ${thumbJob.done} done, ${thumbJob.failed} failed, of ${thumbJob.total}.` : missingThumbs ? "" : " All photos have one."}</p>
      </div>
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
  const [selPallet, setSelPallet] = useState(null);
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
    try { history.pushState({ __qcNav: true, page, selProduct, openInspId, selPallet }, ""); } catch {}
  }, [page, selProduct, openInspId, selPallet]);
  useEffect(() => {
    try { history.replaceState({ __qcNav: true, page, selProduct, openInspId, selPallet }, ""); } catch {}
    const onPop = e => {
      skipPushRef.current = true; const st = e.state;
      setPage(st && st.__qcNav ? st.page : "dashboard");
      setSelProduct(st && st.__qcNav ? (st.selProduct ?? null) : null);
      setOpenInspId(st && st.__qcNav ? (st.openInspId ?? null) : null);
      setSelPallet(st && st.__qcNav ? (st.selPallet ?? null) : null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  const [presetProduct, setPresetProduct] = useState("");
  const [inspDatePreset, setInspDatePreset] = useState("");
  const [productsQuery, setProductsQuery] = useState("");
  const [presetCategory, setPresetCategory] = useState(null);
  const [pendingChatContext, setPendingChatContext] = useState(null);
  const bootIdRef = useRef(null); const [newVersion, setNewVersion] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => { (async () => { try { if (window.storage) { const r = await window.storage.get(THEME_KEY); if (r?.value === "dark") { applyTheme(true); setDark(true); } } } catch (e) {} })(); }, []);
  const toggleTheme = () => { const d = !dark; applyTheme(d); setDark(d); (async () => { try { if (window.storage) await window.storage.set(THEME_KEY, d ? "dark" : "light"); } catch (e) {} })(); };
  useEffect(() => { if (!loaded) return; const tick = () => refreshPushedIntegrations(() => _S, set); tick(); const id = setInterval(tick, 60000); return () => clearInterval(id); }, [loaded]);
  useEffect(() => {
    if (!loaded || !userId) return;
    let fps = [];
    try { fps = JSON.parse(localStorage.getItem(briefingItemsKey(userId)) || "[]"); } catch { fps = []; }
    if (!Array.isArray(fps) || !fps.length) return;
    set(x => adoptLocalBriefingSeen(x, userId, fps, nowISO()));
    try { localStorage.removeItem(briefingItemsKey(userId)); } catch {}
  }, [loaded, userId]);
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
  const briefingNew = briefingUnseen(s, user.id).total;
  const productPage = user.role === "Head" ? "products" : "catalog";
  const goBriefing = (page, id) => {
    setSelPallet(null);
    if (page === "catalog") { setSelProduct(id); setPage("catalog"); }
    else if (page === "inspection") { setOpenInspId(id); setPage("inspections"); }
    else setPage(page);
  };
  const guard = key => user.role === "Head" || NAV_CONTROLLER.some(g => g.items.some(([k]) => k === key));
  const safePage = guard(page) ? page : "dashboard";
  return (
    <Shell onSearch={q => { setSelPallet(null); setProductsQuery(q); setPage(productPage); }} onLogout={() => { writeSession(null); setUserId(null); }} page={safePage} setPage={p => { setSelPallet(null); setPage(p); }} badge={{ ...badge, complaints: complaintsNewCount(s, user.id), messages: unreadMsgs, notifications: unread, briefing: briefingNew, flags: user.role === "Head" ? s.flags.filter(f => f.status === "Open").length : s.flags.filter(f => f.raisedBy === user.id && f.status === "Open").length, inspections: user.role === "Head" ? s.inspections.filter(i => i.status === "PendingReview").length : 0, tempspecs: user.role === "Head" ? (s.tempSpecs || []).filter(t => !t.endedAt).length : 0 }} topRight={dataButton} users={s.users} user={user} setUser={id => { setUserId(id); setSelPallet(null); setPage("dashboard"); setOpenInspId(null); }} unread={unread} onBell={() => { setSelPallet(null); setPage("notifications"); }}>
      <BlockingOverlay s={s} set={set} user={user} />
      {dataOpen && <DataPanel s={s} set={set} onClose={() => setDataOpen(false)} />}
      {toastMsg && <div className="fixed left-1/2 -translate-x-1/2 text-sm px-4 py-2 rounded-xl" style={{ top: 12, zIndex: 90, background: C.ink, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.25)" }}>{toastMsg}</div>}
      {newVersion && <div className="fixed left-1/2 -translate-x-1/2 flex items-center gap-3 text-sm px-4 py-2.5 rounded-xl" style={{ top: 12, zIndex: 91, background: C.accent, color: C.onDark, boxShadow: "0 8px 20px rgba(0,0,0,.3)" }}>A new version is live<button onClick={() => location.reload()} className="px-2.5 py-1 rounded-lg font-semibold" style={{ background: C.onDark, color: C.accent }}>Refresh</button></div>}
      {selPallet && <PalletPage s={s} set={set} user={user} hu={selPallet} onBack={() => setSelPallet(null)} onPickPallet={h => setSelPallet(h)} onOpenProduct={id => { setSelPallet(null); setSelProduct(id); setPage(user.role === "Head" ? "products" : "catalog"); }} onOpenInspection={id => { setSelPallet(null); setOpenInspId(id); setPage("inspections"); }} onAssign={r => { setSelPallet(null); setPendingChatContext({ kind: "pallet", id: r.hu || claimKey(r), label: `${r.name || r.article} · ${r.location || ""}`.trim() }); setPage("messages"); }} onOpenAnnouncements={() => { setSelPallet(null); setPage("announcements"); }} onOpenComplaints={() => { setSelPallet(null); setPage("complaints"); }} />}
      {!selPallet && safePage === "dashboard" && (user.role === "Head" ? <Dashboard s={s} user={user} set={set} setPage={setPage} seed={() => set(olaState(), { replace: true })} openPallet={hu => setSelPallet(hu)} onAssign={a => { setPendingChatContext({ kind: "pallet", id: a.hu, label: `${a.name} · ${a.location}` }); setPage("messages"); }} openTodayInspections={() => { setOpenInspId(null); setInspDatePreset("0"); setPage("inspections"); }} /> : <ControllerDashboard s={s} user={user} set={set} setPage={setPage} setOpenId={setOpenInspId} openPallet={hu => setSelPallet(hu)} openProduct={id => { setSelProduct(id); setPage("catalog"); }} />)}
      {!selPallet && safePage === "briefing" && <BriefingPage s={s} set={set} user={user} go={goBriefing} />}
      {!selPallet && safePage === "profile" && <ProfilePage s={s} set={set} user={user} openInspection={id => { setOpenInspId(id); setPage("inspections"); }} />}
      {!selPallet && safePage === "categories" && <CategoriesPage s={s} set={set} onMessage={ctx => { setPendingChatContext(ctx); setPage("messages"); }} onOpenProduct={id => { setSelProduct(id); setPage("products"); }} presetSel={presetCategory} clearPresetSel={() => setPresetCategory(null)} />}
      {!selPallet && safePage === "problems" && <ProblemsPage s={s} set={set} />}
      {!selPallet && safePage === "products" && <ProductsPage s={s} set={set} user={user} sel={selProduct} setSel={setSelProduct} presetFilter={productsQuery} clearPreset={() => setProductsQuery("")} onMessage={ctx => { setPendingChatContext(ctx); setPage("messages"); }} onOpenInspection={id => { setOpenInspId(id); setPage("inspections"); }} onOpenCategory={id => { setPresetCategory(id); setPage("categories"); }} />}
      {!selPallet && safePage === "tempspecs" && <TempSpecsPage s={s} set={set} user={user} openProduct={id => { setSelProduct(id); setPage("products"); }} openCategory={id => { setPresetCategory(id); setPage("categories"); }} />}
      {!selPallet && safePage === "forms" && <FormsPage s={s} set={set} />}
      {!selPallet && safePage === "suppliers" && <DictionaryPage s={s} set={set} listKey="suppliers" title="Suppliers" hint="One global list of all suppliers (Suppliers). Assign to products in Products." placeholder="e.g. El Ciruelo" usageOf={id => s.products.filter(p => (p.supplierIds || []).includes(id)).length} />}
      {!selPallet && safePage === "lists" && <ListsPage s={s} set={set} />}
      {!selPallet && safePage === "blocked" && <BlockedQueuePage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} setSelPallet={setSelPallet} />}
      {!selPallet && safePage === "lost" && <LostPalletsPage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} setSelPallet={setSelPallet} />}
      {!selPallet && safePage === "complaints" && <ComplaintsPage s={s} set={set} user={user} openProduct={id => { setSelProduct(id); setPage(user.role === "Head" ? "products" : "catalog"); }} />}
      {!selPallet && safePage === "docks" && <DockMapPage s={s} user={user} openPallet={hu => setSelPallet(hu)} />}
      {!selPallet && safePage === "unreported" && <UnreportedPalletsPage s={s} set={set} user={user} setSel={setSelProduct} setPage={setPage} setSelPallet={setSelPallet} />}
      {!selPallet && safePage === "inspections" && <InspectionsPage s={s} set={set} user={user} notify={notify} openId={openInspId} setOpenId={setOpenInspId} preset={presetProduct} clearPreset={() => setPresetProduct("")} datePreset={inspDatePreset} clearDatePreset={() => setInspDatePreset("")} />}
      {!selPallet && safePage === "catalog" && <CatalogPage s={s} set={set} user={user} notify={notify} openPallet={hu => setSelPallet(hu)} presetSel={selProduct} clearPresetSel={() => setSelProduct(null)} presetFilter={productsQuery} clearPreset={() => setProductsQuery("")} onOpenInspection={id => { setOpenInspId(id); setPage("inspections"); }} />}
      {!selPallet && safePage === "flags" && <FlagsPage s={s} set={set} user={user} />}
      {!selPallet && safePage === "notifications" && <NotificationsPage s={s} set={set} user={user} setPage={setPage} setOpenId={setOpenInspId} setSelProduct={setSelProduct} />}
      {!selPallet && safePage === "analytics" && <AnalyticsPage s={s} setPage={setPage} openInspection={id => { setOpenInspId(id); setPage("inspections"); }} />}
      {!selPallet && safePage === "integrations" && <IntegrationsPage s={s} set={set} go={setPage} />}
      {!selPallet && safePage === "settings" && <SettingsPage s={s} set={set} />}
      {!selPallet && safePage === "users" && <UsersPage s={s} set={set} />}
      {!selPallet && safePage === "announcements" && <AnnouncementsPage s={s} set={set} user={user} notify={notify} openProduct={id => { setSelPallet(null); setSelProduct(id); setPage(user.role === "Head" ? "products" : "catalog"); }} />}
      {!selPallet && safePage === "messages" && <MessagesPage s={s} set={set} user={user} setPage={setPage} onOpenProduct={id => setSelProduct(id)} onOpenInspection={id => { setOpenInspId(id); setPage("inspections"); }} onOpenCategory={id => setPresetCategory(id)} initialContext={pendingChatContext} clearInitialContext={() => setPendingChatContext(null)} />}
    </Shell>
  );
}
