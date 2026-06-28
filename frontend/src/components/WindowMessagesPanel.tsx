import { FormEvent, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { Window, WindowMessage } from '../types';
import { Button, Card } from './Layout';

interface WindowMessagesPanelProps {
  windows: Window[];
  token: string | null;
}

export function WindowMessagesPanel({ windows, token }: WindowMessagesPanelProps) {
  const [selectedWindowId, setSelectedWindowId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recent, setRecent] = useState<WindowMessage[]>([]);

  async function loadRecent() {
    const data = await api<WindowMessage[]>('/windows/messages/recent');
    setRecent(data);
  }

  useEffect(() => {
    loadRecent();
    const socket = getSocket(token ?? undefined);
    const refresh = () => loadRecent();
    socket.on('window:message-sent', refresh);
    socket.on('window:message-acknowledged', refresh);
    return () => {
      socket.off('window:message-sent', refresh);
      socket.off('window:message-acknowledged', refresh);
    };
  }, [token]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!selectedWindowId || !message.trim()) return;
    setError('');
    setSuccess('');
    setSending(true);
    try {
      await api(`/windows/${selectedWindowId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: message.trim() }),
      });
      setMessage('');
      setSuccess('Mensaje enviado. La ventanilla debe aceptarlo para continuar.');
      await loadRecent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="mb-6 border-amber-200 bg-amber-50/50">
      <h3 className="font-semibold text-amber-900 mb-1">Mensaje a ventanilla</h3>
      <p className="text-sm text-amber-800 mb-4">
        El operador verá un aviso bloqueante y no podrá tomar turnos hasta pulsar Aceptar. Usted verá aquí cuando fue atendido.
      </p>

      <form onSubmit={handleSend} className="space-y-3">
        <select
          className="w-full border rounded-lg px-3 py-2 bg-white"
          value={selectedWindowId}
          onChange={(e) => setSelectedWindowId(e.target.value)}
          required
        >
          <option value="">Seleccione ventanilla...</option>
          {[...windows].sort((a, b) => a.number - b.number).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} (Vent. {w.number})
              {w.activeSession?.user ? ` — ${w.activeSession.user.fullName}` : ''}
            </option>
          ))}
        </select>
        <textarea
          className="w-full border rounded-lg px-3 py-2 bg-white min-h-[80px]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ej.: Revisar documentación pendiente antes de continuar..."
          maxLength={500}
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-emerald-700 text-sm">{success}</p>}
        <Button type="submit" disabled={sending || !selectedWindowId}>
          {sending ? 'Enviando...' : 'Enviar mensaje bloqueante'}
        </Button>
      </form>

      {recent.length > 0 && (
        <div className="mt-6 border-t border-amber-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 mb-2">Historial reciente</p>
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {recent.slice(0, 15).map((m) => (
              <li key={m.id} className="text-sm bg-white rounded-lg border px-3 py-2">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    Vent. {m.window?.number ?? '—'} — {m.window?.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                      m.status === 'PENDING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {m.status === 'PENDING' ? 'Pendiente' : 'Aceptado'}
                  </span>
                </div>
                <p className="text-slate-600 mt-1 line-clamp-2">{m.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Enviado {new Date(m.sentAt).toLocaleString('es-CO')}
                  {m.acknowledgedAt && m.acknowledgedBy && (
                    <> · Aceptado por {m.acknowledgedBy.fullName} ({new Date(m.acknowledgedAt).toLocaleString('es-CO')})</>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
