import { useEffect, useState } from 'react';
import { api, apiBlob } from '../services/api';
import type { DailyHistoryDay, DayDispensations } from '../types';
import { formatDuration } from '../utils/formatDuration';
import { Button, Card } from './Layout';

function formatDayLabel(dateLabel: string, isToday?: boolean): string {
  if (isToday) return `Hoy (${dateLabel})`;
  const [y, m, d] = dateLabel.split('-');
  return `${d}/${m}/${y}`;
}

interface DailyHistoryPanelProps {
  title?: string;
}

export function DailyHistoryPanel({ title = 'Historial de dispensas por día' }: DailyHistoryPanelProps) {
  const [days, setDays] = useState<DailyHistoryDay[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [detail, setDetail] = useState<DayDispensations | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  async function loadDays() {
    setLoading(true);
    try {
      const data = await api<DailyHistoryDay[]>('/stats/history/days?limit=120');
      setDays(data);
      if (!selectedDate && data.length > 0) {
        setSelectedDate(data[0].datePrefix);
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(datePrefix: string) {
    setDetailLoading(true);
    try {
      const data = await api<DayDispensations>(`/stats/history/dispensations?date=${datePrefix}`);
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadDays();
  }, []);

  useEffect(() => {
    if (selectedDate) loadDetail(selectedDate);
  }, [selectedDate]);

  async function exportDay(format: 'daily-excel' | 'daily-pdf') {
    if (!selectedDate) return;
    const blob = await apiBlob(`/stats/export/${format}?date=${selectedDate}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dispensas-${selectedDate}.${format === 'daily-excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedDay = days.find((d) => d.datePrefix === selectedDate);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-50 border-slate-200">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-1">
          Cada día se guarda automáticamente el resumen y el detalle de turnos atendidos y ausentes.
          Al cambiar de día, los turnos pendientes del día anterior quedan registrados como cancelados.
        </p>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <h4 className="font-semibold mb-3">Días registrados</h4>
          {loading ? (
            <p className="text-sm text-slate-500">Cargando...</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay historial. Los turnos de hoy se irán guardando.</p>
          ) : (
            <ul className="space-y-1 max-h-[480px] overflow-y-auto">
              {days.map((d) => (
                <li key={d.datePrefix}>
                  <button
                    type="button"
                    onClick={() => setSelectedDate(d.datePrefix)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition ${
                      selectedDate === d.datePrefix
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="font-medium">{formatDayLabel(d.dateLabel, d.isToday)}</span>
                    <span className={`block text-xs mt-0.5 ${selectedDate === d.datePrefix ? 'text-blue-100' : 'text-slate-500'}`}>
                      {d.attended} atendidos · {d.absent} ausentes · {d.generated} generados
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={loadDays} className="w-full mt-4 text-sm">
            Actualizar lista
          </Button>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {selectedDay && (
            <Card>
              <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                <div>
                  <h4 className="font-semibold">
                    {formatDayLabel(selectedDay.dateLabel, selectedDay.isToday)}
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    Guardado: {new Date(selectedDay.archivedAt).toLocaleString('es-CO')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => exportDay('daily-excel')}>
                    Excel
                  </Button>
                  <Button variant="secondary" onClick={() => exportDay('daily-pdf')}>
                    PDF
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                {[
                  { label: 'Generados', value: selectedDay.generated },
                  { label: 'Atendidos', value: selectedDay.attended },
                  { label: 'Ausentes', value: selectedDay.absent },
                  { label: 'Cancelados', value: selectedDay.cancelled },
                  { label: 'Pendientes', value: selectedDay.pending },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-xl font-bold text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>

              {selectedDay.windowSummary.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-slate-500">
                        <th className="py-2">Ventanilla</th>
                        <th>Atendidos</th>
                        <th>Ausentes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDay.windowSummary.map((w) => (
                        <tr key={w.windowId} className="border-b">
                          <td className="py-2">{w.windowName}</td>
                          <td className="font-semibold">{w.attended}</td>
                          <td>{w.absent}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          <Card>
            <h4 className="font-semibold mb-3">Detalle de dispensas</h4>
            {detailLoading ? (
              <p className="text-sm text-slate-500">Cargando detalle...</p>
            ) : !detail || detail.dispensations.length === 0 ? (
              <p className="text-sm text-slate-500">No hay turnos atendidos ni ausentes este día.</p>
            ) : (
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-2">Turno</th>
                      <th className="py-2 pr-2">Prioridad</th>
                      <th className="py-2 pr-2">Ventanilla</th>
                      <th className="py-2 pr-2">Estado</th>
                      <th className="py-2 pr-2">Espera</th>
                      <th className="py-2">Atención</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.dispensations.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="py-2 pr-2 font-bold text-blue-900">{d.displayCode}</td>
                        <td className="py-2 pr-2">{d.priority}</td>
                        <td className="py-2 pr-2">{d.windowName ?? '—'}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              d.status === 'FINALIZADO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {d.status === 'FINALIZADO' ? 'Atendido' : 'Ausente'}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {d.waitSeconds != null ? formatDuration(d.waitSeconds) : '—'}
                        </td>
                        <td className="py-2">
                          {d.attentionSeconds != null ? formatDuration(d.attentionSeconds) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
