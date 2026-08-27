import { useEffect, useState } from 'react';
import { Button, Card, Layout } from '../components/Layout';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { openTicketPrint } from '../utils/ticketPrint';
import type { Priority, Ticket, TicketPrintSettings } from '../types';

const DEFAULT_PRINT_SETTINGS: TicketPrintSettings = {
  id: 'default',
  headerTitle: 'CENCOIC',
  showHeader: true,
  showPriority: true,
  showDisplayCode: true,
  showUniqueCode: false,
  showDateTime: true,
  showFooter: true,
  footerMessage: 'Espere a ser llamado en pantalla',
  messageFontScale: 1,
  maxFormulas: 1,
};

export function FilterPage() {
  const { token } = useAuth();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [formulaCount, setFormulaCount] = useState(1);
  const [maxFormulas, setMaxFormulas] = useState(1);
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [printSettings, setPrintSettings] = useState<TicketPrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);

  async function load() {
    const [p, t, settings] = await Promise.all([
      api<Priority[]>('/priorities'),
      api<Ticket[]>('/tickets/today'),
      api<TicketPrintSettings>('/tickets/print-settings'),
    ]);
    setPriorities(p);
    setTickets(t);
    setPrintSettings(settings);
    const max = Math.max(1, settings.maxFormulas ?? 1);
    setMaxFormulas(max);
    setFormulaCount((prev) => (prev > max ? 1 : prev));
    if (!selectedPriority && p.length) setSelectedPriority(p[0].id);
  }

  useEffect(() => {
    load();
    const socket = getSocket(token ?? undefined);
    socket.on('ticket:created', (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev.filter((x) => x.id !== ticket.id)]);
    });
    socket.on('ticket:cancelled', () => load());
    return () => {
      socket.off('ticket:created');
      socket.off('ticket:cancelled');
    };
  }, [token]);

  async function generate() {
    setError('');
    if (!selectedPriority) {
      setError('Seleccione una prioridad');
      return;
    }
    setGenerating(true);
    try {
      const ticket = await api<Ticket>('/tickets/generate', {
        method: 'POST',
        body: JSON.stringify({ priorityId: selectedPriority, formulaCount }),
      });
      setLastTicket(ticket);
      setTickets((prev) => [ticket, ...prev.filter((x) => x.id !== ticket.id)]);
      setFormulaCount(1);
      openTicketPrint(ticket, printSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setGenerating(false);
    }
  }

  const formulaOptions = Array.from({ length: maxFormulas }, (_, i) => i + 1);

  return (
    <Layout title="Módulo Filtro">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Generar turno</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Prioridad</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={selectedPriority}
                onChange={(e) => setSelectedPriority(e.target.value)}
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Número de fórmulas</label>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={formulaCount}
                onChange={(e) => setFormulaCount(parseInt(e.target.value, 10))}
              >
                {formulaOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Valor predeterminado: 1</p>
            </div>

            <Button onClick={generate} className="w-full text-lg py-4" disabled={generating}>
              Generar turno
            </Button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>

          {lastTicket && (
            <div className="mt-6 p-6 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-600 font-semibold uppercase">{lastTicket.priority.code}</p>
              <p className="text-5xl font-bold text-blue-900 my-2">{lastTicket.displayCode}</p>
              <p className="text-sm text-blue-800 mb-3">
                Fórmulas: {lastTicket.formulaCount ?? 1}
              </p>
              <Button variant="secondary" onClick={() => openTicketPrint(lastTicket, printSettings)}>
                Reimprimir
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Turnos de hoy ({tickets.length})</h2>
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg gap-2">
                <div className="min-w-0">
                  <span className="font-bold text-lg">{t.displayCode}</span>
                  <span className="ml-2 text-sm text-slate-500 font-semibold uppercase">{t.priority.code}</span>
                  <span className="ml-2 text-xs text-slate-600">· {t.formulaCount ?? 1} fórm.</span>
                  <span
                    className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                      t.status === 'GENERADO'
                        ? 'bg-yellow-100 text-yellow-800'
                        : t.status === 'FINALIZADO'
                          ? 'bg-green-100 text-green-800'
                          : t.status === 'CANCELADO'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <Button variant="secondary" onClick={() => openTicketPrint(t, printSettings)}>
                  Reimprimir
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
