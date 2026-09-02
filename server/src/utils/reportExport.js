const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
const IMG_EXT = { '.png': 'png', '.jpg': 'jpeg', '.jpeg': 'jpeg', '.gif': 'gif' };

// Resolve a stored "/uploads/xxx.png" logo URL to an on-disk path we can embed.
function resolveLogo(logoUrl) {
  if (!logoUrl) return null;
  const ext = path.extname(logoUrl).toLowerCase();
  if (!IMG_EXT[ext]) return null;
  const file = path.join(uploadsDir, path.basename(logoUrl));
  if (!fs.existsSync(file)) return null;
  return { file, extension: IMG_EXT[ext] };
}

function hslToHex(h, s = 62, l = 45) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const c = l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return (f(0) + f(8) + f(4)).toUpperCase();
}

const fmtMoney = (n) => '$' + Number(n || 0).toFixed(2);
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);
const fmtDateTime = (d) => new Date(d).toISOString().slice(0, 16).replace('T', ' ');

function cellText(row, col) {
  const v = row[col.key];
  if (v == null || v === '') return col.format === 'money' ? fmtMoney(0) : '';
  if (col.format === 'money') return fmtMoney(v);
  if (col.format === 'date') return fmtDate(v);
  if (col.format === 'datetime') return fmtDateTime(v);
  if (col.format === 'int') return String(v);
  return String(v);
}

// ---------------------------------------------------------------------------
// Excel
// ---------------------------------------------------------------------------
async function buildXlsx(spec) {
  const { restaurant, reportName, reportNameSo, filterLines = [], summary = [], columns, rows, totalsRow } = spec;
  const hex = hslToHex(restaurant.hue ?? 212);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Miis Restaurant OS';
  wb.created = new Date();
  const ws = wb.addWorksheet(reportName, {
    views: [{ state: 'frozen', ySplit: 0 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
  });

  const lastCol = columns.length;
  const colLetter = (n) => {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const L = colLetter(lastCol);
  const titleCol = lastCol >= 4 ? 3 : 1; // leave room for the logo when wide enough

  const logo = resolveLogo(restaurant.logoUrl);
  if (logo) {
    const imgId = wb.addImage({ filename: logo.file, extension: logo.extension });
    ws.addImage(imgId, { tl: { col: 0, row: 0 }, ext: { width: 92, height: 92 }, editAs: 'oneCell' });
  }

  let r = 1;
  const bandRow = (text, opts = {}) => {
    ws.mergeCells(`${colLetter(titleCol)}${r}:${L}${r}`);
    const c = ws.getCell(`${colLetter(titleCol)}${r}`);
    c.value = text;
    c.font = { name: 'Calibri', size: opts.size || 11, bold: !!opts.bold, color: { argb: opts.color || 'FF6B7280' } };
    c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    ws.getRow(r).height = opts.height || 18;
    r += 1;
  };
  bandRow(restaurant.name || 'Restaurant', { size: 18, bold: true, color: 'FF' + hex, height: 26 });
  bandRow(`${reportName} · ${reportNameSo}`, { size: 12, bold: true, color: 'FF111827' });
  if (filterLines.length) bandRow(filterLines.join('     |     '), { size: 9 });
  bandRow(`${[restaurant.city, restaurant.plan].filter(Boolean).join(' · ')}     ·     Generated ${fmtDateTime(new Date())}     ·     Miis Restaurant OS`, { size: 9 });
  r += 1;

  // Summary block
  if (summary.length) {
    const head = ws.getCell(`A${r}`);
    head.value = 'SUMMARY · KOOBID';
    head.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF' + hex } };
    r += 1;
    for (const s of summary) {
      ws.mergeCells(`A${r}:B${r}`);
      const lc = ws.getCell(`A${r}`);
      lc.value = s.label;
      lc.font = { name: 'Calibri', size: 10, color: { argb: 'FF374151' } };
      lc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      const vc = ws.getCell(`C${r}`);
      vc.value = s.value;
      vc.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
      vc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      r += 1;
    }
    r += 1;
  }

  // Table header
  const headerRowIdx = r;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = col.headerSo ? `${col.header}\n${col.headerSo}` : col.header;
    c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } };
    c.alignment = { vertical: 'middle', horizontal: col.align === 'right' ? 'right' : 'left', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } } };
  });
  headerRow.height = 28;
  r += 1;

  // Data rows
  for (let i = 0; i < rows.length; i += 1) {
    const row = ws.getRow(r);
    const zebra = i % 2 === 1;
    columns.forEach((col, ci) => {
      const c = row.getCell(ci + 1);
      const raw = rows[i][col.key];
      if (col.format === 'money') {
        c.value = Number(raw || 0);
        c.numFmt = '"$"#,##0.00';
      } else if (col.format === 'date') {
        c.value = raw ? new Date(raw) : '';
        c.numFmt = 'yyyy-mm-dd';
      } else if (col.format === 'datetime') {
        c.value = raw ? new Date(raw) : '';
        c.numFmt = 'yyyy-mm-dd hh:mm';
      } else if (col.format === 'int') {
        c.value = Number(raw || 0);
      } else {
        c.value = raw == null ? '' : String(raw);
      }
      c.font = { name: 'Calibri', size: 10, color: { argb: 'FF1F2937' } };
      c.alignment = { vertical: 'middle', horizontal: col.align === 'right' ? 'right' : 'left', wrapText: col.wrap === true };
      if (zebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFB' } };
      c.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
    });
    r += 1;
  }

  // Totals
  if (totalsRow) {
    const row = ws.getRow(r);
    columns.forEach((col, ci) => {
      const c = row.getCell(ci + 1);
      if (ci === 0) {
        c.value = totalsRow.label || 'TOTAL';
      } else if (totalsRow.values && col.key in totalsRow.values) {
        const v = totalsRow.values[col.key];
        if (col.format === 'money') { c.value = Number(v || 0); c.numFmt = '"$"#,##0.00'; }
        else c.value = v;
      }
      c.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF111827' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF1F3' } };
      c.border = { top: { style: 'medium', color: { argb: 'FF' + hex } } };
      c.alignment = { horizontal: col.align === 'right' ? 'right' : 'left' };
    });
    r += 1;
  }

  ws.views = [{ state: 'frozen', ySplit: headerRowIdx }];
  columns.forEach((col, i) => { ws.getColumn(i + 1).width = col.width || 16; });
  if (titleCol === 3) { ws.getColumn(1).width = Math.max(ws.getColumn(1).width || 0, 14); }

  return wb.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
function buildPdf(spec, res, filename) {
  const { restaurant, reportName, reportNameSo, filterLines = [], summary = [], columns, rows, totalsRow } = spec;
  const hex = '#' + hslToHex(restaurant.hue ?? 212);
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 32, bufferPages: true });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width;
  const left = doc.page.margins.left;
  const right = pageW - doc.page.margins.right;
  const contentW = right - left;
  const bottom = doc.page.height - doc.page.margins.bottom;

  // ---- Header band ----
  const logo = resolveLogo(restaurant.logoUrl);
  let hx = left;
  if (logo) {
    try { doc.image(logo.file, left, 30, { fit: [52, 52] }); hx = left + 64; } catch { /* ignore */ }
  }
  doc.font('Helvetica-Bold').fontSize(19).fillColor(hex).text(restaurant.name || 'Restaurant', hx, 32, { width: contentW * 0.55 });
  doc.font('Helvetica').fontSize(9).fillColor('#6B7280')
    .text([restaurant.city, restaurant.plan].filter(Boolean).join('  ·  '), hx, doc.y + 2, { width: contentW * 0.55 });

  const rBlockX = left + contentW * 0.56;
  const rBlockW = right - rBlockX;
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(`${reportName} · ${reportNameSo}`, rBlockX, 34, { width: rBlockW, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280');
  filterLines.forEach((line) => doc.text(line, rBlockX, doc.y + 1, { width: rBlockW, align: 'right' }));
  doc.text(`Generated ${fmtDateTime(new Date())}`, rBlockX, doc.y + 1, { width: rBlockW, align: 'right' });

  let y = Math.max(doc.y, 88) + 8;
  doc.moveTo(left, y).lineTo(right, y).lineWidth(1.5).strokeColor(hex).stroke();
  y += 12;

  // ---- Summary chips ----
  if (summary.length) {
    const chipW = contentW / Math.min(summary.length, 5);
    summary.slice(0, 5).forEach((s, i) => {
      const cx = left + i * chipW;
      doc.font('Helvetica').fontSize(7.5).fillColor('#6B7280').text(s.label.toUpperCase(), cx, y, { width: chipW - 8 });
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(String(s.value), cx, y + 10, { width: chipW - 8 });
    });
    y += 34;
  }

  // ---- Table ----
  const weightTotal = columns.reduce((a, c) => a + (c.w || 1), 0);
  const colX = [];
  let acc = left;
  columns.forEach((c) => { colX.push(acc); acc += ((c.w || 1) / weightTotal) * contentW; });
  const colW = columns.map((c, i) => (i + 1 < columns.length ? colX[i + 1] : right) - colX[i]);
  const rowH = 18;
  const headH = 22;

  const drawHeader = () => {
    doc.rect(left, y, contentW, headH).fill(hex);
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    columns.forEach((c, i) => {
      doc.text(c.header, colX[i] + 4, y + 6, { width: colW[i] - 8, align: c.align === 'right' ? 'right' : 'left', lineBreak: false });
    });
    y += headH;
  };

  const truncate = (str, width, font, size) => {
    doc.font(font).fontSize(size);
    let s = String(str);
    if (doc.widthOfString(s) <= width) return s;
    while (s.length > 1 && doc.widthOfString(s + '…') > width) s = s.slice(0, -1);
    return s + '…';
  };

  drawHeader();
  doc.font('Helvetica').fontSize(8).fillColor('#1F2937');
  rows.forEach((row, ri) => {
    if (y + rowH > bottom) { doc.addPage(); y = doc.page.margins.top; drawHeader(); doc.font('Helvetica').fontSize(8).fillColor('#1F2937'); }
    if (ri % 2 === 1) doc.rect(left, y, contentW, rowH).fill('#FAFAFB');
    doc.fillColor('#1F2937');
    columns.forEach((c, i) => {
      const txt = truncate(cellText(row, c), colW[i] - 8, 'Helvetica', 8);
      doc.font('Helvetica').fontSize(8).text(txt, colX[i] + 4, y + 5, { width: colW[i] - 8, align: c.align === 'right' ? 'right' : 'left', lineBreak: false });
    });
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).lineWidth(0.5).strokeColor('#E5E7EB').stroke();
    y += rowH;
  });

  if (totalsRow) {
    if (y + rowH > bottom) { doc.addPage(); y = doc.page.margins.top; drawHeader(); }
    doc.rect(left, y, contentW, rowH).fill('#EFF1F3');
    doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(hex).stroke();
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(8);
    columns.forEach((c, i) => {
      let txt = '';
      if (i === 0) txt = totalsRow.label || 'TOTAL';
      else if (totalsRow.values && c.key in totalsRow.values) {
        const v = totalsRow.values[c.key];
        txt = c.format === 'money' ? fmtMoney(v) : String(v);
      }
      doc.text(txt, colX[i] + 4, y + 5, { width: colW[i] - 8, align: c.align === 'right' ? 'right' : 'left', lineBreak: false });
    });
    y += rowH;
  }

  // ---- Footer on every page ----
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc.font('Helvetica').fontSize(7.5).fillColor('#9CA3AF');
    doc.text(
      `${restaurant.name} · ${reportName}  —  Miis Restaurant OS`,
      left, doc.page.height - doc.page.margins.bottom + 8,
      { width: contentW / 2, align: 'left', lineBreak: false },
    );
    doc.text(
      `Page ${i + 1} / ${range.count}`,
      left + contentW / 2, doc.page.height - doc.page.margins.bottom + 8,
      { width: contentW / 2, align: 'right', lineBreak: false },
    );
  }

  doc.end();
}

module.exports = { buildXlsx, buildPdf, fmtMoney, fmtDate, fmtDateTime };
