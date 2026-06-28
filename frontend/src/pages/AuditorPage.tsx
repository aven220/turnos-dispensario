import { useEffect, useState } from 'react';
import { AuditMonitor } from '../components/AuditMonitor';
import { Layout, Card } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api, apiBlob } from '../services/api';
import type { Stats } from '../types';
import { formatDuration } from '../utils/formatDuration';

function formatTodayLabel(prefix?: string): string {
  if (!prefix || prefix.length !== 8) return 'Hoy';
  return `${prefix.slice(6, 8)}/${prefix.slice(4, 6)}/${prefix.slice(0, 4)}`;
}

export function AuditorPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<'stats' | 'monitor'>('stats');

  async function loadStats() {
    const s = await api<Stats>('/stats');
    setStats(s);
  }

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  async function download(kind: 'excel' | 'pdf') {
    const blob = await apiBlob(`/stats/export/${kind}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kind === 'excel' ? 'reporte-turnos.xlsx' : 'reporte-turnos.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadDaily(kind: 'daily-excel' | 'daily-pdf') {
    const blob = await apiBlob(`/stats/export/${kind}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = kind === 'daily-excel' ? 'informe-ventanillas.xlsx' : 'informe-ventanillas.pdf';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout title="Auditoría — Jefe">
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: 'stats' as const, label: 'Tiempos y estadísticas' },
          { id: 'monitor' as const, label: 'Monitor en vivo' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <Card className="bg-slate-50">
            <p className="text-sm text-slate-600">
              Vista de solo lectura — tiempos de espera, respuesta y atención por ventanilla ({formatTodayLabel(stats.datePrefix)}).
            </p>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Generados', value: stats.generated },
              { label: 'Atendidos', value: stats.attended },
              { label: 'Ausentes', value: stats.absent },
              { label: 'Cancelados', value: stats.cancelled },
            ].map((item) => (
              <Card key={item.label} className="text-center">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="text-3xl font-bold text-slate-800">{item.value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
              <h3 className="font-semibold">Tiempos por ventanilla</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => download('excel')}
                  className="text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50"
                >
                  Excel
                </button>
                <button
                  type="button"
                  onClick={() => downloadDaily('daily-excel')}
                  className="text-sm px-3 py-1.5 rounded-lg border bg-white hover:bg-slate-50"
                >
                  Excel detallado
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-2">Ventanilla</th>
                    <th className="py-2 pr-2">Atendidos</th>
                    <th className="py-2 pr-2">Espera prom.</th>
                    <th className="py-2 pr-2">Respuesta prom.</th>
                    <th className="py-2 pr-2">Atención prom.</th>
                    <th className="py-2 pr-2">Operador</th>
                    <th className="py-2">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.windowStats.map((w) => (
                    <tr key={w.windowId} className="border-b">
                      <td className="py-2 pr-2 font-medium">{w.windowName}</td>
                      <td className="py-2 pr-2">{w.totalAttended}</td>
                      <td className="py-2 pr-2">{formatDuration(w.avgWaitSeconds ?? 0)}</td>
                      <td className="py-2 pr-2">{formatDuration(w.avgResponseSeconds ?? 0)}</td>
                      <td className="py-2 pr-2">{formatDuration(w.avgAttentionSeconds)}</td>
                      <td className="py-2 pr-2">{w.assignedUser ?? '—'}</td>
                      <td className="py-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            w.attentionStatus === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : w.attentionStatus === 'PAUSED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {w.attentionStatus === 'ACTIVE'
                            ? 'Activo'
                            : w.attentionStatus === 'PAUSED'
                              ? 'Pausa'
                              : 'Sin sesión'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              <strong>Espera:</strong> desde generación del turno hasta llamado.{' '}
              <strong>Respuesta:</strong> desde llamado hasta inicio de atención.{' '}
              <strong>Atención:</strong> duración del servicio.
            </p>
          </Card>
        </div>
      )}

      {tab === 'monitor' && <AuditMonitor />}
    </Layout>
  );
}
