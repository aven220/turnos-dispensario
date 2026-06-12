import { useRef } from 'react';
import { Button } from './Layout';

interface TickerPreviewProps {
  tickerText: string;
  welcomeMessage?: string;
  showAnimation?: boolean;
}

export function TickerPreview({ tickerText, welcomeMessage, showAnimation = true }: TickerPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const displayText = tickerText.trim() || 'Bienvenido al dispensario';

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=900,height=600');
    if (!printWindow) {
      alert('Permita ventanas emergentes para imprimir la vista previa.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Vista previa ticker — CENCOIC</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; }
            h1 { font-size: 14px; font-weight: 600; color: #64748b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; }
            .welcome {
              background: linear-gradient(to right, #1e40af, #1d4ed8, #1e40af);
              color: white;
              text-align: center;
              padding: 20px 16px;
              font-size: 22px;
              font-weight: 700;
              letter-spacing: 0.15em;
              text-transform: uppercase;
              border: 1px solid #2563eb;
              margin-bottom: 24px;
            }
            .screen {
              border: 2px solid #334155;
              border-radius: 8px;
              overflow: hidden;
              background: #0f172a;
              min-height: 120px;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
            }
            .screen-body {
              flex: 1;
              min-height: 80px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #64748b;
              font-size: 13px;
            }
            .ticker {
              background: linear-gradient(to right, #1e40af, #1d4ed8, #1e40af);
              color: white;
              padding: 14px 16px;
              font-size: 16px;
              font-weight: 600;
              letter-spacing: 0.05em;
              border-top: 1px solid #2563eb;
              white-space: pre-wrap;
              word-break: break-word;
              line-height: 1.5;
            }
            .meta { margin-top: 16px; font-size: 12px; color: #94a3b8; }
            @media print {
              body { padding: 12px; }
              @page { margin: 12mm; }
            }
          </style>
        </head>
        <body>
          <h1>Vista previa — Pantalla TV</h1>
          ${welcomeMessage ? `<div class="welcome">${welcomeMessage}</div>` : ''}
          <div class="screen">
            <div class="screen-body">Contenido de turnos y multimedia</div>
            <div class="ticker">${displayText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          </div>
          <p class="meta">Generado el ${new Date().toLocaleString('es-CO')}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Vista previa en pantalla TV</p>
        <Button variant="secondary" onClick={handlePrint}>
          Imprimir vista previa
        </Button>
      </div>

      <div ref={printRef} className="rounded-xl overflow-hidden border-2 border-slate-700 bg-slate-900">
        {welcomeMessage && (
          <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 border-b border-blue-600 py-3 px-4 text-center">
            <p className="text-sm font-bold tracking-[0.15em] text-white uppercase truncate">
              {welcomeMessage}
            </p>
          </div>
        )}

        <div className="h-24 flex items-center justify-center text-slate-500 text-xs px-4 text-center">
          Vista simplificada del contenido central (turnos, multimedia)
        </div>

        <div className="bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 border-t border-blue-600 py-3 overflow-hidden">
          {showAnimation ? (
            <div className="ticker-marquee whitespace-nowrap text-sm font-semibold text-white tracking-wide">
              <span className="inline-block px-4">{displayText}</span>
              <span className="inline-block px-4">{displayText}</span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-white tracking-wide px-4 text-center break-words">
              {displayText}
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        La animación se ve en la vista previa. Al imprimir, el texto aparece completo y legible.
      </p>

      <style>{`
        @keyframes ticker-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-marquee {
          display: inline-block;
          animation: ticker-marquee 25s linear infinite;
        }
      `}</style>
    </div>
  );
}
