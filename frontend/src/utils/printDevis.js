/**
 * printDevis(props, action)
 *
 * Renders the Devis component to a standalone HTML page in a popup window,
 * then either:
 *   action = 'print'    → calls window.print() immediately (user can Save as PDF)
 *   action = 'download' → doesn't auto-print, user can Ctrl+P or close
 *
 * Works with react-to-print v2, v3, or no library at all.
 * Uses ReactDOMServer.renderToStaticMarkup so the ref trick is not needed.
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from '../i18n/index.js';
import Devis from '../components/sales/Devis.jsx';

const PAGE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: Arial, sans-serif; }
  @page { size: A4; margin: 10mm; }
  @media print {
    body { margin: 0; }
    button, .no-print { display: none !important; }
  }
`;

/**
 * @param {{ sale?, loan?, type?, settings? }} devisProps
 * @param {'print'|'download'} action
 */
export function printDevis(devisProps, action = 'print') {
  // Render to static HTML string (no hooks, no refs needed)
  const html = renderToStaticMarkup(
    createElement(I18nextProvider, { i18n },
      createElement(Devis, { ...devisProps, ref: null })
    )
  );

  const docTitle = devisProps.sale?.quoteNumber
    || devisProps.sale?.receiptNumber
    || devisProps.loan?._id?.slice(-8)
    || 'Devis';

  const fullHtml = `<!DOCTYPE html>
<html lang="${i18n.language}" dir="${i18n.language === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <title>${docTitle}</title>
  <style>${PAGE_CSS}</style>
</head>
<body>
  ${html}
</body>
</html>`;

  if (action === 'download') {
    // Create downloadable .html file — user opens it and Ctrl+P → Save as PDF
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${docTitle}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // action === 'print': open popup, trigger print dialog
  const popup = window.open('', '_blank', 'width=900,height=700,scrollbars=yes');
  if (!popup) {
    alert('Veuillez autoriser les popups pour imprimer.');
    return;
  }
  popup.document.open();
  popup.document.write(fullHtml);
  popup.document.close();

  // Wait for images/fonts to load then print
  popup.onload = () => {
    popup.focus();
    popup.print();
    // Close after print dialog dismissed (slight delay for Firefox)
    setTimeout(() => { try { popup.close(); } catch {} }, 1000);
  };

  // Fallback if onload doesn't fire (some browsers)
  setTimeout(() => {
    try {
      popup.focus();
      popup.print();
      setTimeout(() => { try { popup.close(); } catch {} }, 1000);
    } catch {}
  }, 800);
}
