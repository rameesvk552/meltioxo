// Browser-side report exports. Keep the source rows as values so spreadsheet
// formulas cannot be introduced by customer, supplier, or account names.
export const reportData = (filename, rows) => ({
  filename: Array.from(String(filename).replace(/\.csv$/i, ''))
    .map(character => /[<>:"/\\|?*]/.test(character) || character.charCodeAt(0) < 32 ? '-' : character)
    .join('').replace(/[. ]+$/g, '') || 'report',
  rows
});

const xml = value => Array.from(String(value ?? '')).filter(character =>
  character.charCodeAt(0) >= 32 || '\t\n\r'.includes(character)
).join('').replace(/[<>&"']/g, character => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
})[character]);
const col = index => {
  let label = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label;
  return label;
};
const bytes = new TextEncoder();
const amountColumns = rows => new Set((rows[1] || []).flatMap((heading, index) =>
  /\b(amount|balance|total|price|cost|profit|sales|income|revenue|expense|expenses|discount|returns|tax|paid|due|inflow|outflow|transfer|debit|credit|outstanding)\b/i.test(String(heading))
  && !/(%|percent|rate|margin|date)/i.test(String(heading)) ? [index] : []));
const displayRows = (rows, amounts) => rows.map((row, index) => index === 1
  ? row.map((value, column) => amounts.has(column) ? `${value} (INR)` : value) : row);
const formatAmount = value => Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const u16 = number => [number & 255, (number >>> 8) & 255];
const u32 = number => [number & 255, (number >>> 8) & 255, (number >>> 16) & 255, (number >>> 24) & 255];
const crc32 = data => {
  let crc = -1;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
};
function zip(files) {
  const local = [], central = [];
  let offset = 0;
  for (const [path, content] of Object.entries(files)) {
    const name = bytes.encode(path), data = bytes.encode(content), checksum = crc32(data);
    const header = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name
    ]);
    local.push(header, data);
    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0),
      ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name
    ]));
    offset += header.length + data.length;
  }
  const centralSize = central.reduce((size, part) => size + part.length, 0);
  const end = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length),
    ...u16(central.length), ...u32(centralSize), ...u32(offset), ...u16(0)]);
  return new Blob([...local, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function makeXlsx({ rows }) {
  const amounts = amountColumns(rows);
  rows = displayRows(rows, amounts);
  const width = Math.max(1, ...rows.map(row => row.length));
  const columns = Array.from({ length: width }, (_, i) => {
    const max = Math.max(10, ...rows.map(row => String(row[i] ?? '').length));
    return `<col min="${i + 1}" max="${i + 1}" width="${Math.min(42, max + 2)}" customWidth="1"/>`;
  }).join('');
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, index) => {
    const address = `${col(index)}${rowIndex + 1}`;
    const style = rowIndex === 0 ? 1 : rowIndex === 1 ? 2 : amounts.has(index) ? 3 : 0;
    return typeof value === 'number' && Number.isFinite(value)
      ? `<c r="${address}" s="${style}" t="n"><v>${value}</v></c>`
      : `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
  }).join('')}</row>`).join('');
  const files = {
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Report" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="15"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF304F46"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${col(width - 1)}${Math.max(1, rows.length)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${columns}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="A2:${col(width - 1)}${Math.max(2, rows.length)}"/></worksheet>`
  };
  files['xl/styles.xml'] = files['xl/styles.xml']
    .replace('<fonts count="3">', '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts><fonts count="3">')
    .replace('<cellXfs count="3">', '<cellXfs count="4">')
    .replace('</cellXfs>', '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>')
    .replace('</styleSheet>', '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>');
  return zip(files);
}

const pdfText = value => String(value ?? '').normalize('NFKD').replace(/[^\x20-\x7e]/g, character => {
  if (character === '₹') return 'INR '; if (character === '−' || character === '–' || character === '—') return '-';
  return '?';
});
const pdfEscape = value => pdfText(value).replace(/[\\()]/g, '\\$&');
const pdfLine = (x, y, value, size = 8, bold = false) => `BT /F${bold ? 2 : 1} ${size} Tf ${x.toFixed(1)} ${y.toFixed(1)} Td (${pdfEscape(value)}) Tj ET\n`;
export function makePdf({ rows }) {
  const amounts = amountColumns(rows);
  rows = displayRows(rows, amounts);
  const width = 1190, height = 842, margin = 34, usable = width - margin * 2;
  const title = pdfText(rows[0]?.[0] || 'Report');
  const subtitle = pdfText((rows[0] || []).slice(1).filter(Boolean).join('  |  '));
  const headers = rows[1]?.length > 2 ? rows[1] : null;
  const detail = headers ? rows.slice(2) : rows.slice(1);
  const count = Math.max(1, ...rows.map(row => row.length));
  const columnWidth = usable / count;
  const fontSize = count > 10 ? 6.5 : count > 6 ? 7.5 : 9;
  const maxChars = Math.max(4, Math.floor(columnWidth / (fontSize * 0.53)));
  const linesFor = row => row.map((value, index) => {
    const valueText = pdfText(typeof value === 'number' && amounts.has(index) ? formatAmount(value) : value);
    const words = valueText.split(/\s+/), lines = [];
    let line = '';
    for (let word of words) {
      if ((line + ' ' + word).trim().length > maxChars && line) { lines.push(line); line = ''; }
      while (word.length > maxChars) { lines.push(word.slice(0, maxChars)); word = word.slice(maxChars); }
      line = (line + ' ' + word).trim();
    }
    lines.push(line); return lines;
  });
  const pages = [];
  let commands = '', y = height - 64;
  const begin = () => {
    commands = `0.18 0.31 0.27 rg 0 ${height - 46} ${width} 46 re f\n1 1 1 rg\n${pdfLine(margin, height - 30, title, 16, true)}${pdfLine(width - margin - Math.min(480, subtitle.length * 5), height - 28, subtitle.slice(0, 95), 9)}0 0 0 rg\n`;
    y = height - 63;
    if (headers) draw(headers, true);
  };
  const draw = (row, heading = false, stripe = 0) => {
    const cells = linesFor(row), totalLines = Math.max(1, ...cells.map(cell => cell.length));
    let cursor = 0;
    while (cursor < totalLines) {
      const available = Math.floor((y - 46) / (fontSize + 2));
      if (available < 1) { pages.push(commands); begin(); continue; }
      const lineCount = Math.min(available, totalLines - cursor);
      const rowHeight = Math.max(23, 8 + lineCount * (fontSize + 2));
      if (y - rowHeight < 38) { pages.push(commands); begin(); continue; }
      if (heading) commands += `0.89 0.93 0.91 rg ${margin} ${y - rowHeight} ${usable} ${rowHeight} re f\n0 0 0 rg\n`;
      else if (stripe % 2 === 1) commands += `0.97 0.97 0.96 rg ${margin} ${y - rowHeight} ${usable} ${rowHeight} re f\n0 0 0 rg\n`;
      cells.forEach((cell, index) => cell.slice(cursor, cursor + lineCount).forEach((line, lineIndex) => {
        commands += pdfLine(margin + index * columnWidth + 3, y - 11 - lineIndex * (fontSize + 2), line, fontSize, heading);
      }));
      y -= rowHeight;
      cursor += lineCount;
      if (cursor < totalLines) { pages.push(commands); begin(); }
    }
  };
  begin();
  detail.forEach((row, index) => draw(row, false, index));
  pages.push(commands);
  const objects = [null, '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'];
  const pageIds = [];
  pages.forEach((content, index) => {
    const contentId = objects.length, pageId = contentId + 1;
    content += pdfLine(margin, 20, `Page ${index + 1} of ${pages.length}`, 8);
    objects.push(`<< /Length ${bytes.encode(content).length} >>\nstream\n${content}endstream`);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    pageIds.push(pageId);
  });
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let pdf = '%PDF-1.4\n', offset = bytes.encode(pdf).length;
  const offsets = [0];
  objects.slice(1).forEach((object, index) => { offsets.push(offset); const chunk = `${index + 1} 0 obj\n${object}\nendobj\n`; pdf += chunk; offset += bytes.encode(chunk).length; });
  const xref = offset;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(value => `${String(value).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function downloadReport(spec, format) {
  if (!spec || !Array.isArray(spec.rows)) return;
  const blob = format === 'xlsx' ? makeXlsx(spec) : makePdf(spec);
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${spec.filename}.${format}`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
