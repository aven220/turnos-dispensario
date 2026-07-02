import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { PriorityQueueSummary } from '../types';
import { Card } from './Layout';

function formatDayLabel(prefix: string): string {
  if (prefix.length !== 8) return 'Hoy';
  return `${prefix.slice(6, 8)}/${prefix.slice(4, 6)}/${prefix.slice(0, 4)}`;
}

export function PriorityQueueSummary() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<PriorityQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await api<PriorityQueueSummary>('/tickets/queue-by-priority');
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket(token ?? undefined);
    const refresh = () => load();
    const events = [
      'ticket:created',
      'ticket:called',
      'ticket:repeated',
      'ticket:attending',
      'ticket:finished',
      'ticket:absent',
    ] as const;
    events.forEach((e) => socket.on(e, refresh));
    const interval = setInterval(load, 20000);
    return () => {
      events.forEach((e) => socket.off(e, refresh));
      clearInterval(interval);
    };
  }, [load, token]);

  const withPending = summary?.byPriority.filter((p) => p.count > 0) ?? [];
  const empty = summary?.byPriority.filter((p) => p.count === 0) ?? [];

  return (
    <Card className="mb-6 border-blue-200 bg-blue-50/40">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold text-blue-900">Turnos en espera por prioridad</h3>
          <p className="text-sm text-blue-800 mt-1">
            Cola de hoy ({formatDayLabel(summary?.datePrefix ?? '')}) — use estos datos para ordenar las ventanillas.
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-blue-700 leading-none">{summary?.total ?? '—'}</p>
          <p className="text-xs text-blue-600 mt-1">pendientes en total</p>
        </div>
      </div>

      {loading && !summary ? (
        <p className="text-sm text-slate-500">Cargando cola...</p>
      ) : (
        <>
          {withPending.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 mb-4">
              {withPending.map((p) => (
                <div
                  key={p.priorityId}
                  className="rounded-xl border-2 border-blue-300 bg-white px-4 py-3 text-center shadow-sm"
                >
                  <p className="text-2xl font-black text-blue-800">{p.count}</p>
                  <p className="text-sm font-bold text-slate-800 mt-1">{p.code}</p>
                  <p className="text-xs text-slate-500 leading-tight mt-0.5">{p.name}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-4">
              No hay turnos en espera en este momento.
            </p>
          )}

          {empty.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {empty.map((p) => (
                <span
                  key={p.priorityId}
                  className="text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-500"
                >
                  {p.code}: 0
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
