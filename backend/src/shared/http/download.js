export function requestedFormat(request, allowed = ['json', 'pdf', 'csv']) {
  const value = String(request.query?.format || 'json').trim().toLowerCase();
  return allowed.includes(value) ? value : 'json';
}

export function sendDownload(response, { format, fileName, title, payload, rows = [] }) {
  if (format === 'pdf') {
    const body = createTextPdf(title, payload);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(fileName, 'pdf')}"`);
    response.send(body);
    return;
  }

  if (format === 'csv') {
    const body = createCsv(rows.length ? rows : rowsFromPayload(payload));
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(fileName, 'csv')}"`);
    response.send(body);
    return;
  }

  response.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName(fileName, 'json')}"`);
  response.json(payload);
}

export function createCsv(rows) {
  if (!rows.length) return '';
  const columns = [...new Set(rows.flatMap((row) => Object.keys(flatten(row))))];
  return [
    columns.map(csvCell).join(','),
    ...rows.map((row) => {
      const flat = flatten(row);
      return columns.map((column) => csvCell(flat[column] ?? '')).join(',');
    }),
  ].join('\r\n');
}

export function createTextPdf(title, payload) {
  const lines = [title, '', ...textLines(payload)].slice(0, 54);
  const commands = ['BT', '/F1 11 Tf', '50 760 Td'];
  lines.forEach((line, index) => {
    if (index) commands.push('0 -13 Td');
    commands.push(`(${escapePdfText(line.slice(0, 110))}) Tj`);
  });
  commands.push('ET');
  const stream = commands.join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf);
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [{ value: payload }];
  const firstArray = Object.values(payload).find(Array.isArray);
  return firstArray || [payload];
}

function flatten(value, prefix = '', output = {}) {
  for (const [key, entry] of Object.entries(value || {})) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) flatten(entry, name, output);
    else output[name] = Array.isArray(entry) ? entry.join('; ') : entry;
  }
  return output;
}

function textLines(value, prefix = '') {
  if (value === null || value === undefined) return [`${prefix || 'Value'}: `];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => textLines(entry, `${prefix || 'Item'} ${index + 1}`));
  }
  if (typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => textLines(entry, prefix ? `${prefix}.${key}` : key));
  }
  return [`${humanize(prefix)}: ${String(value)}`];
}

function humanize(value) {
  return String(value || 'Value').replaceAll('.', ' / ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePdfText(value) {
  return String(value).replace(/[\\()]/g, (character) => `\\${character}`).replace(/[^\x20-\x7E]/g, '?');
}

function safeDownloadName(baseName, extension) {
  const safe = String(baseName || 'download').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return safe.toLowerCase().endsWith(`.${extension}`) ? safe : `${safe}.${extension}`;
}
