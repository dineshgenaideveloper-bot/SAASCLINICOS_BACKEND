// server/utils/reportExporter.js
//
// One pipeline -> 4 formats. Every report generator returns the SAME shape:
//
//   {
//     title:    'Daily Visit List',
//     subtitle: 'March 2026',            // usually the date-range label
//     columns:  [{ key, label, type }],  // type: text|number|currency|date|datetime
//     rows:     [{ ...keyed values }],
//     summary:  [{ label, value, type }] // optional totals shown at the bottom
//   }
//
// exportReport(report, format) -> { buffer, contentType, filename }
//
// Requires:  npm i exceljs pdfkit docx
// (CSV needs nothing.)

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, WidthType, AlignmentType, BorderStyle,
} = require('docx');

const CURRENCY = '₹';

/* ----------------------------- value formatting ---------------------------- */
function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}
function fmtDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d)) return String(v);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtMoney(v) {
  const n = Number(v || 0);
  return `${CURRENCY}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function display(value, type) {
  if (value === null || value === undefined) return '';
  switch (type) {
    case 'date': return fmtDate(value);
    case 'datetime': return fmtDateTime(value);
    case 'currency': return fmtMoney(value);
    case 'number': return Number(value).toLocaleString('en-IN');
    default: return String(value);
  }
}

/* ---------------------------------- CSV ------------------------------------ */
function toCSV({ title, subtitle, columns, rows, summary }) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const out = [];
  out.push(esc(title));
  if (subtitle) out.push(esc(subtitle));
  out.push('');
  out.push(columns.map((c) => esc(c.label)).join(','));
  for (const r of rows) out.push(columns.map((c) => esc(display(r[c.key], c.type))).join(','));
  if (summary && summary.length) {
    out.push('');
    for (const s of summary) out.push(`${esc(s.label)},${esc(display(s.value, s.type))}`);
  }
  return Buffer.from(out.join('\n'), 'utf8');
}

/* --------------------------------- Excel ----------------------------------- */
async function toExcel({ title, subtitle, columns, rows, summary }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Clinic Reports';
  const ws = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: subtitle ? 4 : 3 }] });

  const lastCol = columns.length;
  const colLetter = (n) => {
    let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const span = `A1:${colLetter(lastCol)}1`;

  ws.mergeCells(span);
  const titleCell = ws.getCell('A1');
  titleCell.value = title;
  titleCell.font = { size: 15, bold: true, color: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { horizontal: 'left' };

  let headerRowIdx = 3;
  if (subtitle) {
    ws.mergeCells(`A2:${colLetter(lastCol)}2`);
    const sub = ws.getCell('A2');
    sub.value = subtitle;
    sub.font = { size: 11, italic: true, color: { argb: 'FF555555' } };
    headerRowIdx = 4;
  }

  const header = ws.getRow(headerRowIdx);
  columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFBBBBBB' } } };
  });
  header.height = 22;

  rows.forEach((r, ri) => {
    const row = ws.getRow(headerRowIdx + 1 + ri);
    columns.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const raw = r[c.key];
      if (c.type === 'currency' || c.type === 'number') {
        cell.value = raw === null || raw === undefined || raw === '' ? null : Number(raw);
        if (c.type === 'currency') cell.numFmt = '₹#,##0.00';
        else cell.numFmt = '#,##0';
        cell.alignment = { horizontal: 'right' };
      } else if (c.type === 'date' || c.type === 'datetime') {
        cell.value = display(raw, c.type);
      } else {
        cell.value = raw === null || raw === undefined ? '' : String(raw);
      }
      if (ri % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FD' } };
    });
  });

  columns.forEach((c, i) => {
    let max = c.label.length;
    rows.forEach((r) => { const s = display(r[c.key], c.type); if (s.length > max) max = s.length; });
    ws.getColumn(i + 1).width = Math.min(48, Math.max(12, max + 2));
  });

  if (summary && summary.length) {
    ws.addRow([]);
    summary.forEach((s) => {
      const row = ws.addRow([]);
      const labelCell = row.getCell(Math.max(1, lastCol - 1));
      labelCell.value = s.label;
      labelCell.font = { bold: true };
      labelCell.alignment = { horizontal: 'right' };
      const valCell = row.getCell(lastCol);
      if (s.type === 'currency' || s.type === 'number') {
        valCell.value = Number(s.value || 0);
        valCell.numFmt = s.type === 'currency' ? '₹#,##0.00' : '#,##0';
      } else valCell.value = display(s.value, s.type);
      valCell.font = { bold: true };
      valCell.alignment = { horizontal: 'right' };
    });
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------------------------------- PDF ------------------------------------ */
function pdfToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

async function toPDF({ title, subtitle, columns, rows, summary }) {
  // Landscape for wide tables
  const landscape = columns.length > 5;
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 32 });
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const left = doc.page.margins.left;

  // weights -> column widths
  const weights = columns.map((c) => {
    if (c.type === 'currency' || c.type === 'number' || c.type === 'date') return 1;
    if (c.type === 'datetime') return 1.4;
    return Math.min(3, Math.max(1.2, (c.label.length) / 8));
  });
  const wsum = weights.reduce((a, b) => a + b, 0);
  const colW = weights.map((w) => (w / wsum) * pageW);

  const drawHeaderBlock = () => {
    doc.fillColor('#1E3A8A').font('Helvetica-Bold').fontSize(15).text(title, left, doc.y);
    if (subtitle) doc.moveDown(0.1).fillColor('#555').font('Helvetica-Oblique').fontSize(9).text(subtitle, left);
    doc.moveDown(0.4);
  };

  const rowHeight = (cells, font, size) => {
    doc.font(font).fontSize(size);
    let h = 0;
    cells.forEach((txt, i) => {
      const hh = doc.heightOfString(String(txt), { width: colW[i] - 8 });
      if (hh > h) h = hh;
    });
    return h + 8;
  };

  const drawTableHeader = () => {
    const y = doc.y;
    const h = rowHeight(columns.map((c) => c.label), 'Helvetica-Bold', 8);
    doc.rect(left, y, pageW, h).fill('#2563EB');
    let x = left;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8);
    columns.forEach((c, i) => {
      doc.text(c.label, x + 4, y + 4, { width: colW[i] - 8, align: 'left' });
      x += colW[i];
    });
    doc.y = y + h;
  };

  drawHeaderBlock();
  drawTableHeader();

  doc.font('Helvetica').fontSize(8);
  rows.forEach((r, ri) => {
    const cells = columns.map((c) => display(r[c.key], c.type));
    const h = rowHeight(cells, 'Helvetica', 8);

    if (doc.y + h > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      drawTableHeader();
      doc.font('Helvetica').fontSize(8);
    }

    const y = doc.y;
    if (ri % 2 === 1) doc.rect(left, y, pageW, h).fill('#F3F6FD');
    let x = left;
    doc.fillColor('#222');
    columns.forEach((c, i) => {
      const align = (c.type === 'currency' || c.type === 'number') ? 'right' : 'left';
      doc.text(cells[i], x + 4, y + 4, { width: colW[i] - 8, align });
      x += colW[i];
    });
    doc.y = y + h;
  });

  if (summary && summary.length) {
    doc.moveDown(0.6);
    summary.forEach((s) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#1E3A8A')
        .text(`${s.label}:  ${display(s.value, s.type)}`, left, doc.y, { align: 'right', width: pageW });
    });
  }

  // footer page numbers
  const range = doc.bufferedPageRange ? null : null;
  return pdfToBuffer(doc);
}

/* ---------------------------------- Word ----------------------------------- */
function wcell(text, { bold = false, fill, align = AlignmentType.LEFT, color } = {}) {
  return new TableCell({
    shading: fill ? { fill } : undefined,
    margins: { top: 40, bottom: 40, left: 60, right: 60 },
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({ text: String(text ?? ''), bold, size: 18, color })],
    })],
  });
}

async function toWord({ title, subtitle, columns, rows, summary }) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: columns.map((c) =>
      wcell(c.label, { bold: true, fill: '2563EB', color: 'FFFFFF', align: AlignmentType.CENTER })),
  });

  const bodyRows = rows.map((r, ri) =>
    new TableRow({
      children: columns.map((c) =>
        wcell(display(r[c.key], c.type), {
          fill: ri % 2 ? 'F3F6FD' : undefined,
          align: (c.type === 'currency' || c.type === 'number') ? AlignmentType.RIGHT : AlignmentType.LEFT,
        })),
    }));

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      left: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      right: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: 'E5E5E5' },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: 'E5E5E5' },
    },
    rows: [headerRow, ...bodyRows],
  });

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, color: '1E3A8A' })] }),
  ];
  if (subtitle) children.push(new Paragraph({ children: [new TextRun({ text: subtitle, italics: true, color: '555555', size: 20 })] }));
  children.push(new Paragraph({ text: '' }));
  children.push(table);

  if (summary && summary.length) {
    children.push(new Paragraph({ text: '' }));
    summary.forEach((s) =>
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `${s.label}:  ${display(s.value, s.type)}`, bold: true, color: '1E3A8A', size: 20 })],
      })));
  }

  const doc = new Document({ sections: [{ children }] });
  return Buffer.from(await Packer.toBuffer(doc));
}

/* ------------------------------- dispatcher -------------------------------- */
const TYPES = {
  pdf: { ext: 'pdf', contentType: 'application/pdf', fn: toPDF },
  excel: { ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fn: toExcel },
  xlsx: { ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', fn: toExcel },
  csv: { ext: 'csv', contentType: 'text/csv', fn: toCSV },
  word: { ext: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fn: toWord },
  docx: { ext: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fn: toWord },
};

async function exportReport(report, format = 'pdf') {
  const t = TYPES[String(format).toLowerCase()] || TYPES.pdf;
  const buffer = await t.fn(report);
  const safe = (report.title || 'report').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const stamp = new Date().toISOString().slice(0, 10);
  return { buffer, contentType: t.contentType, filename: `${safe}_${stamp}.${t.ext}`, ext: t.ext };
}

module.exports = { exportReport, display };