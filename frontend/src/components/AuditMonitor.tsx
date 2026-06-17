import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { Ticket, TicketMonitorData, TicketStatus } from '../types';
import { Card } from './Layout';

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { fullName: string } | null;
  window: { name: string; number: number } | null;
  ticket: { displayCode: string } | null;
}

const STATUS_LABEL: Record<TicketStatus, string> = {
  GENERADO: 'En espera',
  LLAMADO: 'Llamado',
  ATENDIENDO: 'En atención',
  FINALIZADO: 'Atendido',
  AUSENTE: 'Ausente',
  CANCELADO: 'Cancelado',
};

const STATUS_CLASS: Record<TicketStatus, string> = {
  GENERADO: 'bg-slate-100 text-slate-700',
  LLAMADO: 'bg-amber-100 text-amber-800',
  ATENDIENDO: 'bg-emerald-100 text-emerald-800',
  FINALIZADO: 'bg-blue-100 text-blue-800',
  AUSENTE: 'bg-red-100 text-red-800',
  CANCELADO: 'bg-slate-200 text-slate-500',
};

function formatElapsed(from: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - new Date(from).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDatePrefix(prefix: string): string {
  if (prefix.length !== 8) return 'Hoy';
  return `${prefix.slice(6, 8)}/${prefix.slice(4, 6)}/${prefix.slice(0, 4)}`;
}

function operatorName(ticket: Ticket): string | null {
  const w = ticket.window as
    | (Ticket['window'] & {
        operators?: { user: { fullName: string } }[];
        sessions?: { user: { fullName: string } }[];
      })
    | null
    | undefined;
  return w?.sessions?.[0]?.user.fullName ?? w?.operators?.[0]?.user.fullName ?? null;
}

function elapsedSince(ticket: Ticket): string | null {
  if (ticket.status === 'ATENDIENDO' && ticket.attendingAt) return ticket.attendingAt;
  if (ticket.status === 'LLAMADO' && ticket.calledAt) return ticket.calledAt;
  return null;
}

function durationLabel(ticket: Ticket, now: number): string {
  if (ticket.status === 'ATENDIENDO' && ticket.attendingAt) {
    return formatElapsed(ticket.attendingAt, now);
  }
  if (ticket.status === 'LLAMADO' && ticket.calledAt) {
    return formatElapsed(ticket.calledAt, now);
  }
  if (ticket.status === 'FINALIZADO' && ticket.attendingAt && ticket.finishedAt) {
    return formatElapsed(ticket.attendingAt, new Date(ticket.finishedAt).getTime());
  }
  return '—';
}

export function AuditMonitor() {
  const { token } = useAuth();
  const [monitor, setMonitor] = useState<TicketMonitorData | null>(null);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [m, logs] = await Promise.all([
      api<TicketMonitorData>('/stats/monitor'),
      api<AuditLog[]>('/stats/audit?limit=80'),
    ]);
    setMonitor(m);
    setAudit(logs);
    setLoading(false);
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
      'window:availability-changed',
    ] as const;
    events.forEach((e) => socket.on(e, refresh));
    return () => {
      events.forEach((e) => socket.off(e, refresh));
    };
  }, [token, load]);

  useEffect(() => {
    const hasActive = (monitor?.active.length ?? 0) > 0;
    if (!hasActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [monitor?.active.length]);

  const filteredTickets = useMemo(() => {
    if (!monitor) return [];
    const q = search.trim().toLowerCase();
    return monitor.tickets.filter((t) => {
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (!q) return true;
      return (
        t.displayCode.toLowerCase().includes(q) ||
        t.priority.code.toLowerCase().includes(q) ||
        t.priority.name.toLowerCase().includes(q) ||
        (t.window?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [monitor, statusFilter, search]);

  if (loading && !monitor) {
    return <Card><p className="text-slate-500 text-center py-8">Cargando monitor...</p></Card>;
  }

  const summary = monitor?.summary;
  const active = monitor?.active ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">Monitor en vivo</h3>
          <p className="text-sm text-slate-500">
            Turnos del día {formatDatePrefix(monitor?.datePrefix ?? '')} · actualización automática
          </p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Tiempo real
        </span>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: 'Total', value: summary.total, color: 'text-slate-800' },
            { label: 'En espera', value: summary.generated, color: 'text-slate-600' },
            { label: 'Llamados', value: summary.called, color: 'text-amber-700' },
            { label: 'En atención', value: summary.attending, color: 'text-emerald-700' },
            { label: 'Atendidos', value: summary.finished, color: 'text-blue-700' },
            { label: 'Ausentes', value: summary.absent, color: 'text-red-600' },
            { label: 'Cancelados', value: summary.cancelled, color: 'text-slate-500' },
          ].map((s) => (
            <Card key={s.label} className="!p-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-[10px] uppercase tracking-wide text-slate-500 mt-0.5">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <h4 className="font-semibold mb-1">En este momento</h4>
        <p className="text-sm text-slate-500 mb-4">Turnos llamados o en atención ahora mismo</p>
        {active.length === 0 ? (
          <p className="text-slate-400 text-sm py-6 text-center">Ningún turno en curso en este momento</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {active.map((t) => {
              const since = elapsedSince(t);
              const op = operatorName(t);
              return (
                <div
                  key={t.id}
                  className={`rounded-xl border-2 p-4 ${
                    t.status === 'ATENDIENDO' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-3xl font-black text-slate-900">{t.displayCode}</p>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${STATUS_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{t.priority.name}</p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p>
                      <span className="text-slate-500">Ventanilla:</span>{' '}
                      <span className="font-semibold">
                        {t.window ? `${t.window.name} (№ ${t.window.number})` : '—'}
                      </span>
                    </p>
                    {op && (
                      <p>
                        <span className="text-slate-500">Operador:</span> <span className="font-medium">{op}</span>
                      </p>
                    )}
                    {since && (
                      <p className="text-base font-bold text-slate-800 mt-2">
                        {t.status === 'ATENDIENDO' ? 'Tiempo en atención' : 'Tiempo llamando'}:{' '}
                        <span className={t.status === 'ATENDIENDO' ? 'text-emerald-700' : 'text-amber-700'}>
                          {formatElapsed(since, now)}
                        </span>
                      </p>
                    )}
                    {t.status === 'LLAMADO' && (
                      <p className="text-xs text-slate-500">Llamados: {t.callCount}/3</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h4 className="font-semibold">Todos los turnos del día</h4>
            <p className="text-sm text-slate-500">{filteredTickets.length} turno(s) mostrados</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar turno..."
              className="border rounded-lg px-3 py-2 text-sm w-40"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TicketStatus | 'ALL')}
              className="border rounded-lg px-3 py-2 text-sm"
            >
              <option value="ALL">Todos los estados</option>
              {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white border-b">
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">Turno</th>
                <th className="py-2 pr-3">Prioridad</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Ventanilla</th>
                <th className="py-2 pr-3">Generado</th>
                <th className="py-2 pr-3">Duración</th>
                <th className="py-2">Generado por</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-2.5 pr-3 font-bold text-blue-900">{t.displayCode}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-medium">{t.priority.code}</span>
                    <span className="text-slate-400 text-xs block">{t.priority.name}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_CLASS[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    {t.window ? `Vent. ${t.window.number}` : '—'}
                  </td>
                  <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap">
                    {new Date(t.createdAt).toLocaleTimeString('es-CO')}
                  </td>
                  <td className="py-2.5 pr-3 font-medium whitespace-nowrap">
                    {durationLabel(t, now)}
                  </td>
                  <td className="py-2.5 text-slate-500 text-xs">{t.createdBy?.fullName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredTickets.length === 0 && (
            <p className="text-center text-slate-400 py-8">No hay turnos que coincidan con el filtro</p>
          )}
        </div>
      </Card>

      <Card>
        <h4 className="font-semibold mb-4">Registro de auditoría</h4>
        <div className="max-h-[320px] overflow-y-auto space-y-2">
          {audit.map((log) => (
            <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-slate-400 shrink-0">{new Date(log.createdAt).toLocaleString('es-CO')}</span>
              </div>
              <p className="text-slate-600 mt-1">
                {log.user?.fullName && `Usuario: ${log.user.fullName}`}
                {log.window && ` · Ventanilla: ${log.window.name}`}
                {log.ticket && ` · Turno: ${log.ticket.displayCode}`}
                {log.details && ` · ${log.details}`}
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
