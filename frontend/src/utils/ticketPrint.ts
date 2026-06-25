import type { Ticket, TicketPrintSettings } from '../types';

export const SAMPLE_TICKET: Ticket = {
  id: 'preview',
  uniqueCode: '20260611-PRI-001',
  displayCode: 'PRI001',
  status: 'GENERADO',
  callCount: 0,
  priority: { id: 'preview', name: 'Prioritario', code: 'PRI', sortOrder: 1 },
  createdAt: new Date().toISOString(),
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildTicketPrintHtml(
  ticket: Ticket,
  settings: TicketPrintSettings,
  options?: { autoPrint?: boolean; preview?: boolean }
) {
  const autoPrint = options?.autoPrint ?? false;
  const preview = options?.preview ?? false;
  const dateTime = formatDateTime(ticket.createdAt);
  const msgScale = Math.min(2.5, Math.max(0.8, settings.messageFontScale ?? 1));

  const blocks: string[] = [];

  if (settings.showHeader) {
    blocks.push(`<div class="header">${escapeHtml(settings.headerTitle)}</div>`);
  }
  if (settings.showPriority) {
    blocks.push(`<div class="priority">${escapeHtml(ticket.priority.code)}</div>`);
  }
  if (settings.showDisplayCode) {
    blocks.push(`<div class="code">${escapeHtml(ticket.displayCode)}</div>`);
  }
  if (settings.showUniqueCode) {
    blocks.push(`<div class="unique">${escapeHtml(ticket.uniqueCode)}</div>`);
  }
  if (settings.showDateTime) {
    blocks.push(`<div class="datetime">${escapeHtml(dateTime)}</div>`);
  }
  if (settings.showFooter) {
    blocks.push(`<div class="footer">${escapeHtml(settings.footerMessage)}</div>`);
  }

  if (blocks.length === 0) {
    blocks.push(`<div class="code">${escapeHtml(ticket.displayCode)}</div>`);
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Turno ${escapeHtml(ticket.displayCode)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      width: ${preview ? '100%' : '80mm'};
      max-width: 100%;
      margin: 0 auto;
      padding: 16px 12px;
      text-align: center;
      color: #0f172a;
    }
    .ticket {
      border: ${preview ? '2px dashed #cbd5e1' : '1px solid #e2e8f0'};
      border-radius: 8px;
      padding: 20px 12px;
    }
    .header {
      font-size: ${18 * msgScale}px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 12px;
      color: #1e40af;
    }
    .priority {
      font-size: ${14 * msgScale}px;
      font-weight: 600;
      color: #475569;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .code {
      font-size: 56px;
      font-weight: 800;
      line-height: 1;
      margin: 16px 0;
      color: #0f172a;
    }
    .unique {
      font-size: 11px;
      color: #64748b;
      margin-bottom: 8px;
      word-break: break-all;
    }
    .datetime {
      font-size: 13px;
      color: #475569;
      margin-top: 8px;
    }
    .footer {
      font-size: ${12 * msgScale}px;
      color: #334155;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      line-height: 1.4;
    }
    @media print {
      body { width: 80mm; padding: 8px; }
      .ticket { border: none; border-radius: 0; padding: 12px 4px; }
    }
  </style>
</head>
<body>
  <div class="ticket">
    ${blocks.join('\n    ')}
  </div>
  ${autoPrint ? '<script>window.onload = () => { window.print(); };</script>' : ''}
</body>
</html>`;
}

export function openTicketPrint(ticket: Ticket, settings: TicketPrintSettings) {
  const printWindow = window.open('', '_blank', 'width=420,height=640');
  if (!printWindow) {
    alert('Permita ventanas emergentes para imprimir el turno.');
    return;
  }
  printWindow.document.write(buildTicketPrintHtml(ticket, settings, { autoPrint: true }));
  printWindow.document.close();
  printWindow.focus();
}
