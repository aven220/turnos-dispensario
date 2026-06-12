import { Button } from './Layout';
import { SAMPLE_TICKET, buildTicketPrintHtml } from '../utils/ticketPrint';
import type { Ticket, TicketPrintSettings } from '../types';

interface TicketPrintPreviewProps {
  settings: TicketPrintSettings;
  sampleTicket?: Ticket;
}

export function TicketPrintPreview({ settings, sampleTicket = SAMPLE_TICKET }: TicketPrintPreviewProps) {
  function handlePrint() {
    const printWindow = window.open('', '_blank', 'width=420,height=640');
    if (!printWindow) {
      alert('Permita ventanas emergentes para imprimir la vista previa.');
      return;
    }
    printWindow.document.write(buildTicketPrintHtml(sampleTicket, settings, { preview: true }));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const dateTime = new Date(sampleTicket.createdAt).toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Vista previa del ticket impreso</p>
        <Button variant="secondary" onClick={handlePrint}>
          Imprimir vista previa
        </Button>
      </div>

      <div className="mx-auto max-w-xs bg-white border-2 border-dashed border-slate-300 rounded-lg p-5 text-center shadow-sm">
        {settings.showHeader && (
          <p className="text-base font-bold tracking-[0.12em] text-blue-800 uppercase mb-3">
            {settings.headerTitle}
          </p>
        )}
        {settings.showPriority && (
          <p className="text-sm font-semibold text-slate-600 uppercase mb-2">{sampleTicket.priority.name}</p>
        )}
        {settings.showDisplayCode && (
          <p className="text-5xl font-black text-slate-900 my-3 leading-none">{sampleTicket.displayCode}</p>
        )}
        {settings.showUniqueCode && (
          <p className="text-xs text-slate-500 break-all mb-2">{sampleTicket.uniqueCode}</p>
        )}
        {settings.showDateTime && (
          <p className="text-sm text-slate-600 mt-2">{dateTime}</p>
        )}
        {settings.showFooter && (
          <p className="text-xs text-slate-700 mt-4 pt-3 border-t border-dashed border-slate-300 leading-relaxed">
            {settings.footerMessage}
          </p>
        )}
        {!settings.showHeader &&
          !settings.showPriority &&
          !settings.showDisplayCode &&
          !settings.showUniqueCode &&
          !settings.showDateTime &&
          !settings.showFooter && (
            <p className="text-sm text-slate-400">Seleccione al menos un dato para mostrar en el ticket.</p>
          )}
      </div>

      <p className="text-xs text-slate-500">
        Así se verá el ticket que recibe el usuario al generar un turno en el módulo Filtro.
      </p>
    </div>
  );
}
