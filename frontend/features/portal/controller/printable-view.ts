export function openPrintableView(title: string, payload: unknown) {
  // `noopener` makes Chromium intentionally return `null`, even when the tab
  // opens successfully. The old implementation then returned before writing
  // any content, leaving users on about:blank. Detach the opener immediately
  // after obtaining the document handle instead.
  const printable = window.open('', '_blank', 'width=900,height=700');
  if (!printable) return false;
  printable.opener = null;
  const escapedTitle = escapeHtml(title);
  const body = renderValue(payload);
  printable.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapedTitle}</title>
        <style>
          :root { color-scheme: light; font-family: "IBM Plex Sans", Arial, sans-serif; }
          * { box-sizing: border-box; }
          body { margin: 0; background: #f4f4f4; color: #161616; }
          header { position: sticky; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; padding: 12px 24px; border-bottom: 1px solid #c6c6c6; background: #fff; }
          header strong { overflow: hidden; font-size: 16px; text-overflow: ellipsis; white-space: nowrap; }
          header div { display: flex; gap: 8px; }
          button { min-height: 40px; padding: 0 16px; border: 1px solid #8d8d8d; background: #fff; color: #161616; cursor: pointer; font: inherit; }
          button:first-child { border-color: #0f62fe; background: #0f62fe; color: #fff; }
          button:focus-visible { outline: 3px solid #78a9ff; outline-offset: 2px; }
          main { width: min(960px, calc(100% - 32px)); margin: 24px auto; padding: 32px; border: 1px solid #e0e0e0; background: #fff; box-shadow: 0 2px 10px rgb(0 0 0 / 8%); }
          h1 { margin: 0 0 24px; font-size: 28px; font-weight: 500; }
          h2 { font-size: 18px; margin: 24px 0 8px; }
          dl { display: grid; grid-template-columns: minmax(160px, 240px) minmax(0, 1fr); border-top: 1px solid #e0e0e0; margin: 0; }
          dt, dd { border-bottom: 1px solid #e0e0e0; margin: 0; padding: 10px 12px; }
          dt { background: #f4f4f4; font-weight: 600; }
          dd { overflow-wrap: anywhere; }
          ul { padding-left: 22px; }
          .empty { color: #6f6f6f; font-style: italic; }
          @media (max-width: 620px) {
            main { width: 100%; margin: 0; padding: 20px; border: 0; box-shadow: none; }
            dl { grid-template-columns: 1fr; }
            dt { border-bottom: 0; }
          }
          @media print {
            body { background: #fff; }
            header { display: none; }
            main { width: 100%; margin: 0; padding: 0; border: 0; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <header>
          <strong>${escapedTitle}</strong>
          <div>
            <button type="button" onclick="window.print()">Print</button>
            <button type="button" onclick="window.close()">Close</button>
          </div>
        </header>
        <main><h1>${escapedTitle}</h1>${body}</main>
      </body>
    </html>
  `);
  printable.document.close();
  printable.focus();
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
