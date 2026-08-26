import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { Button, Card } from './Layout';

interface NumberingItem {
  priorityId: string;
  name: string;
  code: string;
  lastNumber: number;
  maxIssued: number;
  nextNumber: number;
}

export function NumberingPanel() {
  const [items, setItems] = useState<NumberingItem[]>([]);
  const [datePrefix, setDatePrefix] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await api<{ datePrefix: string; items: NumberingItem[] }>('/tickets/numbering');
    setDatePrefix(data.datePrefix);
    setItems(data.items);
    const d: Record<string, string> = {};
    data.items.forEach((i) => {
      d[i.priorityId] = String(i.nextNumber);
    });
    setDrafts(d);
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : 'Error'));
  }, [load]);

  async function save(priorityId: string) {
    setError('');
    setSavingId(priorityId);
    try {
      const nextNumber = parseInt(drafts[priorityId] ?? '', 10);
      await api(`/tickets/numbering/${priorityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ nextNumber }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Card className="mt-6">
      <h3 className="font-semibold mb-1">Numeración del día</h3>
      <p className="text-xs text-slate-500 mb-4">
        Día {datePrefix || '—'}. Defina el próximo número por prioridad (no se permiten duplicados).
      </p>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.priorityId}
            className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-lg"
          >
            <div className="min-w-[140px]">
              <p className="font-medium">{item.name}</p>
              <p className="text-xs text-slate-500">
                Código {item.code} · Último emitido {item.maxIssued || 0}
              </p>
            </div>
            <label className="text-sm flex items-center gap-2">
              Próximo {item.code}:
              <input
                className="border rounded-lg px-2 py-1 w-24"
                value={drafts[item.priorityId] ?? ''}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [item.priorityId]: e.target.value.replace(/\D/g, '') }))
                }
              />
            </label>
            <Button
              onClick={() => save(item.priorityId)}
              disabled={savingId === item.priorityId}
            >
              Guardar
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
