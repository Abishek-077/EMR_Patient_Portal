export function openPrintableView(title: string, payload: unknown) {
  const printable = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!printable) return false;
  const escapedTitle = escapeHtml(title);
  const body = renderValue(payload);
  printable.document.write(`
    <html>
      <head>
        <title>${escapedTitle}</title>
        <style>
          body { font-family: IBM Plex Sans, Arial, sans-serif; margin: 32px; color: #161616; }
          h1 { font-size: 24px; font-weight: 600; }
          h2 { font-size: 18px; margin: 24px 0 8px; }
          dl { display: grid; grid-template-columns: minmax(140px, 220px) 1fr; border-top: 1px solid #e0e0e0; margin: 0; }
          dt, dd { border-bottom: 1px solid #e0e0e0; margin: 0; padding: 10px 12px; }
          dt { background: #f4f4f4; font-weight: 600; }
          ul { padding-left: 22px; }
          .empty { color: #6f6f6f; font-style: italic; }
        </style>
      </head>
      <body><h1>${escapedTitle}</h1>${body}</body>
    </html>
  `);
  printable.document.close();
  printable.focus();
  printable.print();
  return true;
}

function renderValue(value: unknown, label = ''): string {
  if (value === null || value === undefined || value === '') return '<span class="empty">Not provided</span>';
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="empty">No items</span>';
    return `<ul>${value.map((item) => `<li>${renderValue(item)}</li>`).join('')}</ul>`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (!entries.length) return '<span class="empty">No details</span>';
    const heading = label ? `<h2>${escapeHtml(toLabel(label))}</h2>` : '';
    return `${heading}<dl>${entries.map(([key, item]) => `<dt>${escapeHtml(toLabel(key))}</dt><dd>${renderValue(item, key)}</dd>`).join('')}</dl>`;
  }
  return escapeHtml(String(value));
}

function toLabel(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (char) => char.toUpperCase());
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}
