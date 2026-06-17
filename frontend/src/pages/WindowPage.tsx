import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { Ticket } from '../types';

interface WindowState {
  activeTicket: Ticket | null;
  todayServed: number;
  session: { user: { fullName: string }; startedAt: string } | null;
  upcoming: Ticket[];
  queueCount: number;
  queueTotal: number;
}

export function WindowPage() {
  const { token, windowId, user } = useAuth();
  const [state, setState] = useState<WindowState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const loadState = useCallback(async () => {
    if (!windowId) return;
    const data = await api<WindowState>(`/tickets/window/${windowId}/state`);
    setState(data);
  }, [windowId]);

  useEffect(() => {
    if (!windowId) return;
    loadState();
    const socket = getSocket(token ?? undefined);
    socket.emit('join:window', windowId);
    const refresh = () => loadState();
    socket.on('ticket:created', refresh);
    socket.on('ticket:called', refresh);
    socket.on('ticket:repeated', refresh);
    socket.on('ticket:attending', refresh);
    socket.on('ticket:finished', refresh);
    socket.on('ticket:absent', refresh);
    socket.on('tv:settings-updated', refresh);
    return () => {
      socket.off('ticket:created', refresh);
      socket.off('ticket:called', refresh);
      socket.off('ticket:repeated', refresh);
      socket.off('ticket:attending', refresh);
      socket.off('ticket:finished', refresh);
      socket.off('ticket:absent', refresh);
      socket.off('tv:settings-updated', refresh);
    };
  }, [windowId, token, loadState]);

  async function action(path: string) {
    if (!windowId || !state?.activeTicket) return;
    setError('');
    setLoading(true);
    try {
      await api(`/tickets/${state.activeTicket.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify({ windowId }),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function takeNext() {
    if (!windowId) return;
    setError('');
    setLoading(true);
    try {
      await api('/tickets/take-next', {
        method: 'POST',
        body: JSON.stringify({ windowId }),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  if (!windowId) {
    return (
      <Layout title="Ventanilla">
        <Card><p className="text-red-600">Debe seleccionar una ventanilla al iniciar sesión.</p></Card>
      </Layout>
    );
  }

  const ticket = state?.activeTicket;
  const showQueue = (state?.queueCount ?? 0) > 0;

  return (
    <Layout title="Módulo Ventanilla">
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          {ticket ? (
            <div className="text-center py-8">
              <p className="text-slate-500">{ticket.priority.name}</p>
              <p className="text-7xl font-bold text-blue-900 my-4">{ticket.displayCode}</p>
              <p className={`text-lg font-medium ${
                ticket.status === 'LLAMADO' ? 'text-amber-600' :
                ticket.status === 'ATENDIENDO' ? 'text-emerald-600' : 'text-slate-600'
              }`}>
                {ticket.status} · Llamados: {ticket.callCount}/3
              </p>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <p className="text-xl">Sin turno activo</p>
              <p className="text-sm mt-2">Presione &quot;Tomar siguiente&quot; para asignar automáticamente</p>
            </div>
          )}

          {error && <p className="text-red-600 text-center mb-4">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={takeNext} disabled={loading || !!ticket} className="col-span-2 py-4 text-lg" variant="primary">
              Tomar siguiente
            </Button>
            <Button onClick={() => action('repeat')} disabled={loading || !ticket || ticket.status !== 'LLAMADO' || ticket.callCount >= 3}>
              Repetir llamado
            </Button>
            <Button onClick={() => action('start')} disabled={loading || !ticket || ticket.status !== 'LLAMADO'} variant="success">
              Iniciar atención
            </Button>
            <Button onClick={() => action('finish')} disabled={loading || !ticket || ticket.status !== 'ATENDIENDO'} variant="success">
              Finalizar
            </Button>
            <Button onClick={() => action('absent')} disabled={loading || !ticket || ticket.status !== 'LLAMADO' || ticket.callCount < 3} variant="danger">
              Marcar ausente
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4">Estado de sesión</h3>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-slate-500">Operador</dt><dd className="font-medium">{user?.fullName}</dd></div>
              <div><dt className="text-slate-500">Inicio sesión</dt><dd>{state?.session ? new Date(state.session.startedAt).toLocaleTimeString('es-CO') : '—'}</dd></div>
              <div><dt className="text-slate-500">Turnos atendidos hoy</dt><dd className="text-2xl font-bold text-emerald-600">{state?.todayServed ?? 0}</dd></div>
            </dl>
          </Card>

          {(showQueue || (state?.queueTotal ?? 0) > 0) && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Turnos en cola</h3>
                <div className="text-right">
                  <p className="text-3xl font-black text-blue-700 leading-none">{state?.queueTotal ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-1">pendientes hoy</p>
                </div>
              </div>

              {showQueue ? (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    Próximos {state?.upcoming.length ?? 0} de {state?.queueTotal ?? 0} para esta ventanilla
                  </p>
                  {state?.upcoming && state.upcoming.length > 0 ? (
                    <div className="space-y-2">
                      {state.upcoming.map((t, i) => (
                        <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 font-bold w-5 text-center">{i + 1}</span>
                            <div>
                              <p className="font-bold text-lg text-blue-900">{t.displayCode}</p>
                              <p className="text-xs text-slate-500">{t.priority.name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">No hay turnos en espera para esta ventanilla</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Hay {state?.queueTotal ?? 0} turno{(state?.queueTotal ?? 0) === 1 ? '' : 's'} pendiente{(state?.queueTotal ?? 0) === 1 ? '' : 's'} para atender
                </p>
              )}
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
