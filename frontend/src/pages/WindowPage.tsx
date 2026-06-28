import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Layout } from '../components/Layout';
import { WindowMessageModal, type PendingWindowMessage } from '../components/WindowMessageModal';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { Ticket } from '../types';
import { repeatCallCooldownRemaining } from '../utils/callCooldown';

interface WindowState {
  activeTicket: Ticket | null;
  todayServed: number;
  session: { user: { fullName: string }; startedAt: string; availableForService: boolean } | null;
  upcoming: Ticket[];
  queueCount: number;
  queueTotal: number;
}

export function WindowPage() {
  const { token, windowId, user } = useAuth();
  const [state, setState] = useState<WindowState | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<PendingWindowMessage | null>(null);
  const [repeatCooldownSec, setRepeatCooldownSec] = useState(0);

  const ticket = state?.activeTicket;
  const repeatOnCooldown = repeatCooldownSec > 0;

  useEffect(() => {
    if (!ticket || ticket.status !== 'LLAMADO') {
      setRepeatCooldownSec(0);
      return;
    }

    const lastCalled = ticket.lastCalledAt ?? ticket.calledAt;
    const tick = () => {
      const remaining = repeatCallCooldownRemaining(lastCalled);
      setRepeatCooldownSec(Math.ceil(remaining / 1000));
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [ticket?.id, ticket?.callCount, ticket?.lastCalledAt, ticket?.calledAt, ticket?.status]);

  const loadPendingMessage = useCallback(async () => {
    if (!windowId) return;
    try {
      const msg = await api<PendingWindowMessage | null>(`/windows/${windowId}/messages/pending`);
      setPendingMessage(msg);
    } catch {
      setPendingMessage(null);
    }
  }, [windowId]);

  const loadState = useCallback(async () => {
    if (!windowId) return;
    const data = await api<WindowState>(`/tickets/window/${windowId}/state`);
    setState(data);
  }, [windowId]);

  useEffect(() => {
    if (!windowId) return;
    loadState();
    loadPendingMessage();
    const socket = getSocket(token ?? undefined);
    socket.emit('join:window', windowId);
    const refresh = () => loadState();
    const onMessage = (msg: PendingWindowMessage) => setPendingMessage(msg);
    socket.on('ticket:created', refresh);
    socket.on('ticket:called', refresh);
    socket.on('ticket:repeated', refresh);
    socket.on('ticket:attending', refresh);
    socket.on('ticket:finished', refresh);
    socket.on('ticket:absent', refresh);
    socket.on('tv:settings-updated', refresh);
    socket.on('window:availability-changed', refresh);
    socket.on('window:message', onMessage);
    return () => {
      socket.off('ticket:created', refresh);
      socket.off('ticket:called', refresh);
      socket.off('ticket:repeated', refresh);
      socket.off('ticket:attending', refresh);
      socket.off('ticket:finished', refresh);
      socket.off('ticket:absent', refresh);
      socket.off('tv:settings-updated', refresh);
      socket.off('window:availability-changed', refresh);
      socket.off('window:message', onMessage);
    };
  }, [windowId, token, loadState, loadPendingMessage]);

  async function acknowledgeMessage() {
    if (!windowId || !pendingMessage) return;
    await api(`/windows/messages/${pendingMessage.id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ windowId }),
    });
    setPendingMessage(null);
  }

  const blockedByMessage = !!pendingMessage;

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

  async function setAvailability(available: boolean) {
    if (!windowId) return;
    setError('');
    setAvailabilityLoading(true);
    try {
      await api(`/tickets/window/${windowId}/availability`, {
        method: 'PATCH',
        body: JSON.stringify({ available }),
      });
      await loadState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    } finally {
      setAvailabilityLoading(false);
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

  const showQueue = (state?.queueCount ?? 0) > 0;
  const isAvailable = state?.session?.availableForService !== false;

  return (
    <Layout title="Módulo Ventanilla">
      {pendingMessage && (
        <WindowMessageModal message={pendingMessage} onAcknowledge={acknowledgeMessage} />
      )}
      <Card className={`mb-6 border-2 ${isAvailable ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Modo atención</p>
            <p className={`text-xl font-bold mt-1 ${isAvailable ? 'text-emerald-800' : 'text-amber-800'}`}>
              {isAvailable ? 'Activo — recibiendo turnos' : 'En pausa — no atiende turnos'}
            </p>
            <p className="text-sm text-slate-600 mt-1">
              {isAvailable
                ? 'Use pausa al salir a almorzar o cuando no pueda atender.'
                : 'El administrador verá esta ventanilla fuera de atención.'}
            </p>
          </div>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 self-start sm:self-center">
            <button
              type="button"
              disabled={availabilityLoading || isAvailable || blockedByMessage}
              onClick={() => setAvailability(true)}
              className={`px-5 py-3 text-sm font-semibold transition ${
                isAvailable
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 hover:bg-emerald-50 disabled:opacity-50'
              }`}
            >
              Activo
            </button>
            <button
              type="button"
              disabled={availabilityLoading || !isAvailable || blockedByMessage}
              onClick={() => setAvailability(false)}
              className={`px-5 py-3 text-sm font-semibold transition border-l border-slate-200 ${
                !isAvailable
                  ? 'bg-amber-500 text-white'
                  : 'text-slate-600 hover:bg-amber-50 disabled:opacity-50'
              }`}
            >
              En pausa
            </button>
          </div>
        </div>
      </Card>

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
              <p className="text-xl">{isAvailable ? 'Sin turno activo' : 'Ventanilla en pausa'}</p>
              <p className="text-sm mt-2">
                {isAvailable
                  ? 'Presione "Tomar siguiente" para asignar automáticamente'
                  : 'Active el modo atención para tomar turnos'}
              </p>
            </div>
          )}

          {error && <p className="text-red-600 text-center mb-4">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={takeNext} disabled={loading || !!ticket || !isAvailable || blockedByMessage} className="col-span-2 py-4 text-lg" variant="primary">
              Tomar siguiente
            </Button>
            <Button
              onClick={() => action('repeat')}
              disabled={
                loading ||
                !ticket ||
                ticket.status !== 'LLAMADO' ||
                ticket.callCount >= 3 ||
                blockedByMessage ||
                repeatOnCooldown
              }
            >
              {repeatOnCooldown ? `Espere ${repeatCooldownSec}s…` : 'Repetir llamado'}
            </Button>
            <Button onClick={() => action('start')} disabled={loading || !ticket || ticket.status !== 'LLAMADO' || blockedByMessage} variant="success">
              Iniciar atención
            </Button>
            <Button onClick={() => action('finish')} disabled={loading || !ticket || ticket.status !== 'ATENDIENDO' || blockedByMessage} variant="success">
              Finalizar
            </Button>
            <Button onClick={() => action('absent')} disabled={loading || !ticket || ticket.status !== 'LLAMADO' || ticket.callCount < 3 || blockedByMessage} variant="danger">
              Marcar ausente
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="font-semibold mb-4">Estado de sesión</h3>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-slate-500">Operador</dt><dd className="font-medium">{user?.fullName}</dd></div>
              <div><dt className="text-slate-500">Modo atención</dt>
                <dd className={`font-semibold ${isAvailable ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {isAvailable ? 'Activo' : 'En pausa'}
                </dd>
              </div>
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
