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
};

export function FilterPage() {
  const { token } = useAuth();
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedPriority, setSelectedPriority] = useState('');
  const [lastTicket, setLastTicket] = useState<Ticket | null>(null);
  const [printSettings, setPrintSettings] = useState<TicketPrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [error, setError] = useState('');

  async function load() {
    const [p, t, settings] = await Promise.all([
      api<Priority[]>('/priorities'),
      api<Ticket[]>('/tickets/today'),
      api<TicketPrintSettings>('/tickets/print-settings'),
    ]);
    setPriorities(p);
    setTickets(t);
    setPrintSettings(settings);
    if (!selectedPriority && p.length) setSelectedPriority(p[0].id);
  }

  useEffect(() => {
    load();
    const socket = getSocket(token ?? undefined);
    socket.on('ticket:created', (ticket: Ticket) => {
      setTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
      setLastTicket(ticket);
    });
    return () => { socket.off('ticket:created'); };
  }, [token]);

  async function generate() {
    setError('');
    try {
      const ticket = await api<Ticket>('/tickets/generate', {
        method: 'POST',
        body: JSON.stringify({ priorityId: selectedPriority }),
      });
      setLastTicket(ticket);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  return (
    <Layout title="Módulo Filtro">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Generar turno</h2>
          <div className="space-y-4">
            <select
              className="w-full border rounded-lg px-3 py-2"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
            >
              {priorities.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
            <Button onClick={generate} className="w-full text-lg py-4">Generar turno</Button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>

          {lastTicket && (
            <div className="mt-6 p-6 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-600 font-semibold uppercase">{lastTicket.priority.code}</p>
              <p className="text-5xl font-bold text-blue-900 my-2">{lastTicket.displayCode}</p>
              <Button variant="secondary" onClick={() => openTicketPrint(lastTicket, printSettings)}>Imprimir</Button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Turnos de hoy ({tickets.length})</h2>
          <div className="max-h-[500px] overflow-y-auto space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="font-bold text-lg">{t.displayCode}</span>
                  <span className="ml-2 text-sm text-slate-500 font-semibold uppercase">{t.priority.code}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                    t.status === 'GENERADO' ? 'bg-yellow-100 text-yellow-800' :
                    t.status === 'FINALIZADO' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>{t.status}</span>
                </div>
                <Button variant="secondary" onClick={() => openTicketPrint(t, printSettings)}>Reimprimir</Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
