import { useEffect, useState } from 'react';
import { Button, Card, Layout } from '../components/Layout';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { openTicketPrint } from '../utils/ticketPrint';
import type { Client, Priority, Ticket, TicketPrintSettings } from '../types';

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

  const [docQuery, setDocQuery] = useState('');
  const [client, setClient] = useState<Client | null>(null);
  const [searchDone, setSearchDone] = useState(false);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState('');
  const [registering, setRegistering] = useState(false);
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

  async function searchClient() {
    setError('');
    setSearching(true);
    setSearchDone(false);
    setClient(null);
    try {
      const found = await api<Client | null>(
        `/clients/search?document=${encodeURIComponent(docQuery.trim())}`
      );
      setClient(found);
      setSearchDone(true);
      if (found) setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar');
    } finally {
      setSearching(false);
    }
  }

  async function registerClient() {
    setError('');
    setRegistering(true);
    try {
      const created = await api<Client>('/clients', {
        method: 'POST',
        body: JSON.stringify({ documentNumber: docQuery.trim(), fullName: newName.trim() }),
      });
      setClient(created);
      setSearchDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar');
    } finally {
      setRegistering(false);
    }
  }

  async function generate() {
    setError('');
    if (!client) {
      setError('Busque o registre un cliente antes de generar el turno');
      return;
    }
    if (!selectedPriority) {
      setError('Seleccione una prioridad');
      return;
    }
    setGenerating(true);
    try {
      const ticket = await api<Ticket>('/tickets/generate', {
        method: 'POST',
        body: JSON.stringify({ priorityId: selectedPriority, clientId: client.id }),
      });
      setLastTicket(ticket);
      setTickets((prev) => [ticket, ...prev.filter((x) => x.id !== ticket.id)]);
      openTicketPrint(ticket, printSettings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setGenerating(false);
    }
  }

  function clearClient() {
    setClient(null);
    setSearchDone(false);
    setDocQuery('');
    setNewName('');
  }

  return (
    <Layout title="Módulo Filtro">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4">Generar turno</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Documento del cliente</label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded-lg px-3 py-2"
                  value={docQuery}
                  onChange={(e) => {
                    setDocQuery(e.target.value);
                    setSearchDone(false);
                    setClient(null);
                  }}
                  placeholder="Número de documento"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      searchClient();
                    }
                  }}
                />
                <Button onClick={searchClient} disabled={searching || !docQuery.trim()}>
                  Buscar
                </Button>
              </div>
            </div>

            {client && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs uppercase text-emerald-700 font-semibold">Cliente</p>
                <p className="font-semibold text-emerald-950 text-lg">{client.fullName}</p>
                <p className="text-sm text-emerald-800">Documento: {client.documentNumber}</p>
                <button type="button" className="text-xs text-emerald-700 underline mt-2" onClick={clearClient}>
                  Cambiar cliente
                </button>
              </div>
            )}

            {searchDone && !client && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                <p className="text-sm font-medium text-amber-900">Cliente no encontrado — registrar nuevo</p>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Nombre completo"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <Button onClick={registerClient} disabled={registering || newName.trim().length < 2}>
                  Registrar cliente
                </Button>
              </div>
            )}

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

            <Button
              onClick={generate}
              className="w-full text-lg py-4"
              disabled={!client || generating}
            >
              Generar turno
            </Button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>

          {lastTicket && (
            <div className="mt-6 p-6 bg-blue-50 rounded-xl text-center">
              <p className="text-sm text-blue-600 font-semibold uppercase">{lastTicket.priority.code}</p>
              <p className="text-5xl font-bold text-blue-900 my-2">{lastTicket.displayCode}</p>
              {lastTicket.client && (
                <p className="text-sm text-blue-800 mb-3">
                  {lastTicket.client.fullName} · {lastTicket.client.documentNumber}
                </p>
              )}
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
                  {t.client && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {t.client.fullName} · {t.client.documentNumber}
                    </p>
                  )}
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
