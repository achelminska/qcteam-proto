// The inspection report PDF — one layout for the portal and the phone. Portal.jsx / Mobile.jsx own the catalog
// helpers, so they build the plain `model` below; this file only draws it.
//
// model = {
//   id, ok, result, typeName, company, qcEmail, generatedAt, icon (photo object | null),
//   product: { name, articleId, category, isBio },
//   inspectedAt, controller, edited,                      // strings ("" when not edited)
//   sample: { headline, detail },                        // "12 CU", "1 TU × 12 CU · 48 pcs · 7,200 g"
//   facts: [[label, value]],                             // supplier, country, variety, date code, pallets…
//   status: [{ name, found, tolerance, state, ratio }],  // state: clean | flagged | exceeded; ratio found/tol or null
//   remarks: [{ problem, quantity, pct, tolerance, source }],
//   parameters: [[label, value] | [label, value, specification, ok]],
//   comment, photoGroups: [{ label, photos }], audit: [[action, text]],
// }
import { addImageNatural, drawPhotoGroup, fitWithin, imagePixels, transparentIcon } from "./report-images.js";

const INK = [24, 34, 25], MUTED = [106, 119, 110], LINE = [221, 227, 222], SOFT = [243, 246, 243], WHITE = [255, 255, 255];
const OK = [31, 107, 69], OK_SOFT = [228, 241, 233];
const BAD = [166, 61, 61], BAD_SOFT = [249, 233, 233];
const WARN = [156, 106, 30], WARN_SOFT = [251, 243, 228];
const TONE = { clean: [OK, OK_SOFT, "Clean"], flagged: [WARN, WARN_SOFT, "Within tolerance"], exceeded: [BAD, BAD_SOFT, "Over tolerance"] };

const PAGE_W = 210, L = 14, R = 196, CW = R - L, TOP = 18, BOTTOM = 278;

// Roboto carries the Polish, Dutch and German letters the built-in Helvetica cannot print (Chełmińska → CheBmiDska).
// Subset TTFs live in /fonts; fetched once per session, embedded per document. Falls back to Helvetica offline.
const fontCache = {};
const fetchB64 = async url => {
  if (fontCache[url] !== undefined) return fontCache[url];
  try {
    const r = await fetch(url); if (!r.ok) throw new Error(r.status);
    const bytes = new Uint8Array(await r.arrayBuffer()); let str = "";
    for (let i = 0; i < bytes.length; i += 32768) str += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    fontCache[url] = btoa(str);
  } catch { fontCache[url] = null; }
  return fontCache[url];
};
export async function ensureReportFont(doc) {
  const [reg, bold] = await Promise.all([fetchB64("/fonts/Roboto-Regular.ttf"), fetchB64("/fonts/Roboto-Bold.ttf")]);
  if (!reg || !bold) return "helvetica";
  try {
    doc.addFileToVFS("Roboto-Regular.ttf", reg); doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
    doc.addFileToVFS("Roboto-Bold.ttf", bold); doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
    return "Roboto";
  } catch { return "helvetica"; }
}

export async function drawReportPdf(doc, model, photoData) {
  // Kick the photo downloads now so they overlap the tables, not the photo section.
  for (const g of model.photoGroups || []) for (const ph of g.photos || []) { try { photoData?.(ph); } catch { /* prefetch */ } }
  if (model.icon) { try { photoData?.(model.icon); } catch { /* prefetch */ } }
  const FONT = await ensureReportFont(doc);
  const font = (style = "normal", size = 9, color = INK) => { doc.setFont(FONT, style); doc.setFontSize(size); doc.setTextColor(...color); };
  const fill = c => doc.setFillColor(...c);
  const stroke = (c, w = 0.2) => { doc.setDrawColor(...c); doc.setLineWidth(w); };
  const label = (txt, x, y, color = MUTED, align) => { font("bold", 6.5, color); doc.text(String(txt).toUpperCase(), x, y, { charSpace: 0.35, align }); };
  const pageNo = () => doc.internal.getCurrentPageInfo().pageNumber;
  const headed = new Set([1]);
  const runningHeader = () => {
    const n = pageNo(); if (headed.has(n)) return; headed.add(n);
    font("normal", 7.5, MUTED); doc.text(`Quality inspection report · ${model.product.name} · ${model.id.toUpperCase()}`, L, 10);
    stroke(LINE); doc.line(L, 12.5, R, 12.5);
  };
  const newPage = () => { doc.addPage(); runningHeader(); y = TOP; };
  const ensure = h => { if (y + h > BOTTOM) newPage(); };
  const tone = model.ok ? OK : BAD, toneSoft = model.ok ? OK_SOFT : BAD_SOFT;
  let y = 0;

  // ── Header: who, what, and the Head's result image — the same quiet surface as the rest ──
  fill(SOFT); doc.rect(0, 0, PAGE_W, 38, "F");
  stroke(LINE); doc.line(0, 38, PAGE_W, 38);
  // The result image sits straight on the header surface — its own transparency shows the light background through.
  const src = model.icon && photoData ? await transparentIcon(await photoData(model.icon).catch(() => null)) : null;
  const box = src ? fitWithin(await imagePixels(src), 30, 20) : null;
  if (box) { try { await addImageNatural(doc, src, R - box.w, 9 + (20 - box.h) / 2, box.w, box.h); } catch { /* words carry the verdict */ } }
  label(model.company, L, 13, MUTED);
  font("bold", 17, INK); doc.text("Quality inspection report", L, 22.5);
  font("normal", 8.5, MUTED); doc.text(`${model.typeName} inspection · Report no. ${model.id.toUpperCase()} · ${model.inspectedAt}`, L, 29.5);

  // ── Verdict strip ──
  y = 45;
  const stripH = model.edited ? 20 : 16, mid = y + stripH / 2;
  fill(toneSoft); doc.roundedRect(L, y, CW, stripH, 2.2, 2.2, "F");
  fill(tone); doc.rect(L, y + 3, 1.6, stripH - 6, "F");
  font("bold", 13.5, tone); doc.text(model.ok ? "ACCEPTED" : "REJECTED", L + 6, mid + 2.4);
  const lines = [[`Inspected ${model.inspectedAt}`, 8.5, INK], [`by ${model.controller}`, 8, MUTED], model.edited ? [model.edited, 7.5, MUTED] : null].filter(Boolean);
  lines.forEach(([txt, size, color], i) => { font("normal", size, color); doc.text(txt, R - 4, mid - (lines.length - 1) * 2.1 + i * 4.2 + 1.2, { align: "right" }); });
  y += stripH + 8;

  // ── Product ──
  font("bold", 19, INK);
  const nameLines = doc.splitTextToSize(model.product.name || "—", CW);
  doc.text(nameLines, L, y + 5); y += 5 + (nameLines.length - 1) * 8;
  font("normal", 9, MUTED);
  doc.text([`Article ${model.product.articleId || "—"}`, model.product.category, model.product.isBio ? "Organic" : null].filter(Boolean).join("  ·  "), L, y + 5.5);
  y += 12;

  // ── KPI cards ──
  const over = model.status.filter(r => r.state === "exceeded").length, flagged = model.status.filter(r => r.state === "flagged").length;
  const measured = model.remarks.filter(r => r.source === "measurement").length;
  const photoCount = model.photoGroups.reduce((n, g) => n + (g.photos || []).length, 0);
  const kpis = [
    { k: "Sample", v: model.sample.headline, sub: model.sample.detail },
    { k: "Problem groups", v: `${over} over`, sub: `${flagged} within tolerance · ${model.status.length - over - flagged} clean`, tone: over ? BAD : flagged ? WARN : OK },
    { k: "Remarks", v: String(model.remarks.length), sub: model.remarks.length ? `${measured} measured · ${model.remarks.length - measured} reported` : "nothing reported" },
    { k: "Photos", v: String(photoCount), sub: photoCount ? `in ${model.photoGroups.length} group${model.photoGroups.length === 1 ? "" : "s"}` : "no photos attached" },
  ];
  const gap = 4, cardW = (CW - gap * 3) / 4, cardH = 20;
  kpis.forEach((c, i) => {
    const x = L + i * (cardW + gap);
    fill(SOFT); doc.roundedRect(x, y, cardW, cardH, 2, 2, "F");
    label(c.k, x + 3.5, y + 5.2);
    font("bold", 12.5, c.tone || INK); doc.text(doc.splitTextToSize(c.v, cardW - 7)[0], x + 3.5, y + 11.6);
    font("normal", 6.8, MUTED); doc.text(doc.splitTextToSize(c.sub, cardW - 7)[0], x + 3.5, y + 16.4);
  });
  y += cardH + 8;

  // ── Facts grid (3 per row) ──
  if (model.facts.length) {
    const colW = CW / 3, rows = [];
    for (let i = 0; i < model.facts.length; i += 3) rows.push(model.facts.slice(i, i + 3));
    stroke(LINE); doc.line(L, y, R, y); y += 1;
    for (const row of rows) {
      const heights = row.map(([, v]) => { font("normal", 9.2, INK); return doc.splitTextToSize(String(v), colW - 6).length; });
      const rowH = 9 + (Math.max(...heights) - 1) * 4.2;
      ensure(rowH + 2);
      row.forEach(([k, v], i) => {
        const x = L + i * colW;
        label(k, x, y + 4.2);
        font("normal", 9.2, INK); doc.text(doc.splitTextToSize(String(v), colW - 6), x, y + 8.6);
      });
      y += rowH; stroke(LINE); doc.line(L, y, R, y); y += 1;
    }
    y += 6;
  }

  // ── Sections ──
  const section = (title, hint, need = 30) => {
    ensure(need);
    fill(OK); doc.rect(L, y + 0.6, 1.4, 4.2, "F");
    font("bold", 10.5, INK); doc.text(title, L + 4, y + 4);
    if (hint) { font("normal", 7.5, MUTED); doc.text(hint, R, y + 4, { align: "right" }); }
    y += 8;
  };
  const table = (opts) => {
    doc.autoTable({
      startY: y, margin: { left: L, right: PAGE_W - R, top: TOP, bottom: 297 - BOTTOM },
      theme: "plain", tableLineWidth: 0,
      styles: { font: FONT, fontSize: 9, textColor: INK, cellPadding: { top: 2.3, bottom: 2.3, left: 2.5, right: 2.5 }, lineColor: LINE, lineWidth: { bottom: 0.2 }, valign: "middle" },
      headStyles: { fillColor: SOFT, textColor: MUTED, fontStyle: "bold", fontSize: 7.2, cellPadding: { top: 2.4, bottom: 2.2, left: 2.5, right: 2.5 } },
      didDrawPage: () => runningHeader(),
      ...opts,
      didParseCell: d => { if (d.section === "head") d.cell.text = d.cell.text.map(t => String(t).toUpperCase()); if (opts.didParseCell) opts.didParseCell(d); },
    });
    y = doc.lastAutoTable.finalY + 8;
  };
  const pill = (state, x, yMid) => {
    const [c, soft, txt] = TONE[state] || TONE.clean;
    font("bold", 7, c); const w = doc.getTextWidth(txt) + 5.2;
    fill(soft); doc.roundedRect(x, yMid - 2.7, w, 5.4, 2.7, 2.7, "F");
    doc.text(txt, x + 2.6, yMid + 7 * 0.3528 * 0.35);
  };

  if (model.status.length) {
    section("Quality status", "found vs. tolerance per problem group");
    table({
      head: [["Problem group", "Found", "Tolerance", "Status"]],
      body: model.status.map(r => [r.name, r.found, r.tolerance, ""]),
      columnStyles: { 0: { fontStyle: "bold" }, 1: { cellWidth: 44 }, 2: { cellWidth: 30 }, 3: { cellWidth: 38 } },
      didDrawCell: d => {
        if (d.section !== "body") return;
        const r = model.status[d.row.index]; if (!r) return;
        if (d.column.index === 3) pill(r.state, d.cell.x + 2.5, d.cell.y + d.cell.height / 2);
        if (d.column.index === 1 && r.ratio !== null && r.ratio !== undefined) {
          font("normal", 9, INK); const tx = d.cell.x + 2.5 + doc.getTextWidth(String(r.found)) + 3, track = d.cell.x + d.cell.width - 2.5 - tx;
          if (track > 8) { const [c] = TONE[r.state] || TONE.clean; const yb = d.cell.y + d.cell.height / 2 - 0.8; fill(LINE); doc.roundedRect(tx, yb, track, 1.6, 0.8, 0.8, "F"); const w = Math.max(0, Math.min(1, r.ratio)) * track; if (w > 0) { fill(c); doc.roundedRect(tx, yb, Math.max(w, 1.6), 1.6, 0.8, 0.8, "F"); } }
        }
      },
    });
  }
  if (model.remarks.length) {
    section("Remarks", "what was found, each remark's tolerance, and why the result is what it is");
    table({
      head: [["Problem", "Quantity", "% of sample", "Tolerance", "Source"]],
      body: model.remarks.map(r => [r.problem, r.quantity, r.pct, r.tolerance || "—", r.source]),
      columnStyles: { 1: { cellWidth: 24 }, 2: { cellWidth: 24 }, 3: { cellWidth: 24 }, 4: { cellWidth: 26, textColor: MUTED, fontSize: 8 } },
    });
  }
  if (model.parameters.length) {
    // Rows are [label, value] or [label, value, specification, ok]; with any specification present the table gains a
    // third column and the value is judged (green tick / red cross) so a miss is visible at a glance.
    const judged = model.parameters.some(r => r.length > 2 && r[2]);
    section("Parameters", judged ? "answers recorded on the form · checked against the specification" : "answers recorded on the form");
    if (!judged) table({ body: model.parameters.map(r => [r[0], r[1]]), columnStyles: { 0: { cellWidth: 56, textColor: MUTED, fontStyle: "bold", fontSize: 8 } } });
    else table({
      head: [["Parameter", "Answer", "Specification"]],
      body: model.parameters.map(r => [r[0], r[1], r.length > 2 && r[2] ? String(r[2]) : ""]),
      columnStyles: { 0: { cellWidth: 56, textColor: MUTED, fontStyle: "bold", fontSize: 8 }, 2: { cellWidth: 60, cellPadding: { top: 2.3, bottom: 2.3, left: 9, right: 2.5 } } },
      didParseCell: d => { if (d.section !== "body") return; const r = model.parameters[d.row.index]; if (r && r.length > 2 && r[2] && d.column.index === 1) { d.cell.styles.textColor = r[3] ? OK : BAD; d.cell.styles.fontStyle = "bold"; } },
      didDrawCell: d => {
        if (d.section !== "body" || d.column.index !== 2) return; const r = model.parameters[d.row.index]; if (!r || r.length < 3 || !r[2]) return;
        const ok = !!r[3], c = ok ? OK : BAD, soft = ok ? OK_SOFT : BAD_SOFT, cx = d.cell.x + 2.5 + 2.2, cy = d.cell.y + d.cell.height / 2;
        fill(soft); doc.circle(cx, cy, 2.2, "F"); stroke(c, 0.45);
        if (ok) { doc.line(cx - 1.1, cy + 0.1, cx - 0.3, cy + 0.9); doc.line(cx - 0.3, cy + 0.9, cx + 1.2, cy - 0.9); }
        else { doc.line(cx - 0.9, cy - 0.9, cx + 0.9, cy + 0.9); doc.line(cx - 0.9, cy + 0.9, cx + 0.9, cy - 0.9); }
      },
    });
  }
  section("Comment");
  {
    font("normal", 9.5, model.comment ? INK : MUTED);
    const lines = doc.splitTextToSize(model.comment || "No comment.", CW - 10);
    const h = lines.length * 5 + 7; ensure(h);
    fill(SOFT); doc.roundedRect(L, y, CW, h, 2, 2, "F");
    fill(OK); doc.rect(L, y + 2.5, 1.2, h - 5, "F");
    doc.text(lines, L + 5, y + 6);
    y += h + 8;
  }
  if (model.photoGroups.length) {
    section("Photos", `${photoCount} photo${photoCount === 1 ? "" : "s"}`, 70);
    let lastMod = "";
    for (const g of model.photoGroups) {
      ensure(70);
      if (g.module && g.module !== lastMod) {
        lastMod = g.module;
        font("bold", 9.5, INK); doc.text(g.module, L, y + 4); y += 7;
      }
      label(g.label, L, y + 3); y += 6;
      y = await drawPhotoGroup(doc, { photos: g.photos, photoData, x0: L, y0: y, right: R, maxW: 56, maxH: 56, gap: 4, pageBreak: BOTTOM - 4, newPage: () => { doc.addPage(); runningHeader(); } });
      y += 7;
    }
  }
  if (model.audit.length) {
    section("Report history");
    table({ body: model.audit, columnStyles: { 0: { cellWidth: 36, textColor: MUTED, fontStyle: "bold", fontSize: 8 } }, styles: { font: FONT, fontSize: 8.2, textColor: INK, cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 2.5 }, lineColor: LINE, lineWidth: { bottom: 0.2 } } });
  }

  // ── Footer on every page ──
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    stroke(LINE); doc.line(L, 284, R, 284);
    font("normal", 7.2, MUTED);
    doc.text(`${model.company} · ${model.qcEmail} · Generated by QCteam ${model.generatedAt}`, L, 288.5);
    doc.text(`Report ${model.id.toUpperCase()} · Page ${i} of ${n}`, R, 288.5, { align: "right" });
  }
  return doc;
}
