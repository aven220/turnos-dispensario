import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, apiUpload } from '../services/api';
import type { Client } from '../types';
import { Button, Card } from './Layout';

interface PreviewResult {
  totalFound: number;
  nuevos: number;
  yaExistentes: number;
  conErrores: number;
  errors: { row: number; documentNumber?: string; error: string }[];
  rows: { row: number; documentNumber: string; fullName: string }[];
}

export function ClientsAdminPanel() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [doc, setDoc] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const data = await api<{ total: number; items: Client[] }>(
      `/clients?q=${encodeURIComponent(q)}&page=${page}&pageSize=30`
    );
    setItems(data.items);
    setTotal(data.total);
  }, [q, page]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/clients', {
        method: 'POST',
        body: JSON.stringify({ documentNumber: doc, fullName: name }),
      });
      setDoc('');
      setName('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setError('');
    setMessage('');
    setPreview(null);
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const result = await apiUpload<PreviewResult>('/clients/import/preview', fd);
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al leer archivo');
    } finally {
      setImporting(false);
    }
  }

  async function confirmImport() {
    if (!preview?.rows.length) return;
    setImporting(true);
    setError('');
    try {
      const result = await api<{ created: number; skipped: number; errors: unknown[] }>(
        '/clients/import/confirm',
        { method: 'POST', body: JSON.stringify({ rows: preview.rows }) }
      );
      setMessage(
        `Importación lista: ${result.created} nuevos, ${result.skipped} ya existían, ${result.errors.length} errores.`
      );
      setPreview(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-semibold mb-3">Registrar cliente</h3>
          <form onSubmit={create} className="space-y-3">
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Documento"
              value={doc}
              onChange={(e) => setDoc(e.target.value)}
              required
            />
            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Button type="submit">Guardar</Button>
          </form>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          {message && <p className="text-emerald-700 text-sm mt-2">{message}</p>}
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Importar clientes (CSV / Excel)</h3>
          <p className="text-xs text-slate-500 mb-3">
            Columnas: documento y nombre. Primero se muestra un resumen; la importación solo ocurre al confirmar.
          </p>
          <input
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            disabled={importing}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {preview && (
            <div className="mt-4 p-4 bg-slate-50 rounded-xl space-y-2 text-sm">
              <p>
                Registros encontrados: <strong>{preview.totalFound}</strong>
              </p>
              <p>
                Nuevos: <strong>{preview.nuevos}</strong>
              </p>
              <p>
                Ya existentes: <strong>{preview.yaExistentes}</strong>
              </p>
              <p>
                Con errores: <strong>{preview.conErrores}</strong>
              </p>
              {preview.errors.length > 0 && (
                <ul className="max-h-32 overflow-y-auto text-xs text-red-700 space-y-1">
                  {preview.errors.map((e) => (
                    <li key={`${e.row}-${e.error}`}>
                      Fila {e.row}: {e.error}
                      {e.documentNumber ? ` (${e.documentNumber})` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2 pt-2">
                <Button onClick={confirmImport} disabled={importing || preview.nuevos === 0}>
                  Confirmar importación ({preview.nuevos})
                </Button>
                <Button variant="secondary" onClick={() => setPreview(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
          <h3 className="font-semibold">Clientes ({total})</h3>
          <input
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder="Buscar documento o nombre"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <div className="max-h-[420px] overflow-y-auto space-y-1">
          {items.map((c) => (
            <div key={c.id} className="flex justify-between p-2 bg-slate-50 rounded-lg text-sm">
              <span className="font-medium">{c.fullName}</span>
              <span className="text-slate-500">{c.documentNumber}</span>
            </div>
          ))}
          {items.length === 0 && <p className="text-slate-400 text-sm py-6 text-center">Sin resultados</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            variant="secondary"
            disabled={page * 30 >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </Card>
    </div>
  );
}
