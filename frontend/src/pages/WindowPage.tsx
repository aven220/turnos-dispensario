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
    socket.on('ticket:called', refresh);
    socket.on('ticket:repeated', refresh);
    socket.on('ticket:attending', refresh);
    socket.on('ticket:finished', refresh);
    socket.on('ticket:absent', refresh);
    return () => {
      socket.off('ticket:called', refresh);
      socket.off('ticket:repeated', refresh);
      socket.off('ticket:attending', refresh);
      socket.off('ticket:finished', refresh);
      socket.off('ticket:absent', refresh);
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
              <p className="text-sm mt-2">Presione "Tomar siguiente" para asignar automáticamente</p>
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

        <Card>
          <h3 className="font-semibold mb-4">Estado de sesión</h3>
          <dl className="space-y-3 text-sm">
            <div><dt className="text-slate-500">Operador</dt><dd className="font-medium">{user?.fullName}</dd></div>
            <div><dt className="text-slate-500">Inicio sesión</dt><dd>{state?.session ? new Date(state.session.startedAt).toLocaleTimeString('es-CO') : '—'}</dd></div>
            <div><dt className="text-slate-500">Turnos atendidos hoy</dt><dd className="text-2xl font-bold text-emerald-600">{state?.todayServed ?? 0}</dd></div>
          </dl>
        </Card>
      </div>
    </Layout>
  );
}
