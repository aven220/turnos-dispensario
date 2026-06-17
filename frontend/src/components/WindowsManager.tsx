import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import type { Priority, User, Window } from '../types';
import { Button, Card } from './Layout';

interface WindowsManagerProps {
  windows: Window[];
  priorities: Priority[];
  operators: User[];
  onRefresh: () => void;
}

function operatorOf(w: Window): { id: string; fullName: string } | null {
  const fromAssign = w.operators?.[0]?.user;
  if (fromAssign) return fromAssign;
  const session = w.activeSession?.user;
  if (session) return { id: '', fullName: session.fullName };
  return null;
}

export function WindowsManager({ windows, priorities, operators, onRefresh }: WindowsManagerProps) {
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNumber, setNewNumber] = useState('');

  const activePriorities = useMemo(
    () => priorities.filter((p) => p.isActive !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    [priorities]
  );

  const stats = useMemo(() => {
    const withOperator = windows.filter((w) => operatorOf(w)).length;
    const attending = windows.filter((w) => w.currentTicket?.status === 'ATENDIENDO').length;
    return { total: windows.length, withOperator, attending, free: windows.length - attending };
  }, [windows]);

  async function createWindow(e: FormEvent) {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await api('/windows', {
        method: 'POST',
        body: JSON.stringify({ name: newName.trim(), number: parseInt(newNumber, 10) }),
      });
      setNewName('');
      setNewNumber('');
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setCreating(false);
    }
  }

  async function saveWindow(w: Window, name: string, number: number) {
    setError('');
    try {
      await api(`/windows/${w.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), number }),
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    }
  }

  async function toggleActive(w: Window) {
    setError('');
    try {
      await api(`/windows/${w.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !w.isActive }),
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  }

  async function assignOperator(windowId: string, userId: string, force = false) {
    setError('');
    try {
      await api(`/windows/${windowId}/operators`, {
        method: 'POST',
        body: JSON.stringify({ userId, force }),
      });
      onRefresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al asignar';
      if (!force && message.includes('ya está en')) {
        if (confirm(`${message}\n\n¿Desea reasignarlo a esta ventanilla?`)) {
          await assignOperator(windowId, userId, true);
          return;
        }
      }
      setError(message);
    }
  }

  async function unassignOperator(windowId: string, name: string) {
    if (!confirm(`¿Quitar operador de ${name}?`)) return;
    setError('');
    try {
      await api(`/windows/${windowId}/operators`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al quitar operador');
    }
  }

  async function deleteWindow(w: Window) {
    if (
      !confirm(
        `¿Eliminar permanentemente "${w.name}" (Ventanilla ${w.number})?\n\nNo se permite si hay turno en curso o sesión abierta.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await api(`/windows/${w.id}`, { method: 'DELETE' });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function togglePriority(windowId: string, priorityId: string, currentIds: string[]) {
    setError('');
    const next = currentIds.includes(priorityId)
      ? currentIds.filter((id) => id !== priorityId)
      : [...currentIds, priorityId];
    try {
      await api(`/windows/${windowId}/priorities`, {
        method: 'PUT',
        body: JSON.stringify({ priorityIds: next }),
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar prioridades');
    }
  }

  function assignedWindowForUser(userId: string): Window | undefined {
    return windows.find((w) => w.operators?.[0]?.user.id === userId);
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Ventanillas', value: stats.total, color: 'text-slate-800' },
          { label: 'Con operador', value: stats.withOperator, color: 'text-blue-700' },
          { label: 'Atendiendo', value: stats.attending, color: 'text-emerald-700' },
          { label: 'Disponibles', value: stats.free, color: 'text-slate-600' },
        ].map((s) => (
          <Card key={s.label} className="!p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-500 uppercase tracking-wide mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="font-semibold mb-3">Nueva ventanilla</h3>
        <form onSubmit={createWindow} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-slate-500 mb-1">Nombre</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ventanilla 4"
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-slate-500 mb-1">Número</label>
            <input
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              type="number"
              min={1}
              placeholder="4"
              className="w-full border rounded-lg px-3 py-2 text-center"
              required
            />
          </div>
          <Button type="submit" disabled={creating}>
            {creating ? 'Creando...' : 'Agregar'}
          </Button>
        </form>
      </Card>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...windows].sort((a, b) => a.number - b.number).map((w) => (
          <WindowCard
            key={w.id}
            window={w}
            activePriorities={activePriorities}
            operators={operators}
            assignedWindowForUser={assignedWindowForUser}
            onSave={saveWindow}
            onToggleActive={toggleActive}
            onAssign={assignOperator}
            onUnassign={unassignOperator}
            onDelete={deleteWindow}
            onTogglePriority={togglePriority}
          />
        ))}
      </div>

      {windows.length === 0 && (
        <p className="text-center text-slate-500 py-8">No hay ventanillas. Cree la primera arriba.</p>
      )}
    </div>
  );
}

function WindowCard({
  window: w,
  activePriorities,
  operators,
  assignedWindowForUser,
  onSave,
  onToggleActive,
  onAssign,
  onUnassign,
  onDelete,
  onTogglePriority,
}: {
  window: Window;
  activePriorities: Priority[];
  operators: User[];
  assignedWindowForUser: (userId: string) => Window | undefined;
  onSave: (w: Window, name: string, number: number) => void;
  onToggleActive: (w: Window) => void;
  onAssign: (windowId: string, userId: string) => void;
  onUnassign: (windowId: string, name: string) => void;
  onDelete: (w: Window) => void;
  onTogglePriority: (windowId: string, priorityId: string, currentIds: string[]) => void;
}) {
  const [name, setName] = useState(w.name);
  const [number, setNumber] = useState(String(w.number));

  useEffect(() => {
    setName(w.name);
    setNumber(String(w.number));
  }, [w.id, w.name, w.number]);
  const operator = operatorOf(w);
  const priorityIds = w.priorities?.map((wp) => wp.priority.id) ?? [];
  const isBusy = w.currentTicket?.status === 'ATENDIENDO' || w.currentTicket?.status === 'LLAMADO';
  const statusLabel = !w.isActive
    ? { text: 'Inactiva', className: 'bg-slate-200 text-slate-600' }
    : isBusy
      ? { text: 'En turno', className: 'bg-amber-100 text-amber-800' }
      : w.activeSession
        ? { text: 'Sesión abierta', className: 'bg-emerald-100 text-emerald-800' }
        : { text: 'Disponible', className: 'bg-blue-100 text-blue-800' };

  return (
    <Card className={`!p-0 overflow-hidden ${!w.isActive ? 'opacity-75' : ''}`}>
      <div className="flex items-stretch border-b border-slate-100">
        <div className="shrink-0 w-16 bg-slate-900 text-white flex flex-col items-center justify-center py-4">
          <span className="text-xs uppercase tracking-wider text-slate-400">Vent.</span>
          <span className="text-2xl font-black leading-none">{w.number}</span>
        </div>
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusLabel.className}`}>
              {statusLabel.text}
            </span>
            <span className="text-xs text-emerald-600 font-medium">{w.todayServed ?? 0} atendidos hoy</span>
          </div>
          {w.currentTicket && (
            <p className="mt-2 text-sm font-semibold text-blue-800">
              Turno: {w.currentTicket.displayCode}
              <span className="text-slate-500 font-normal ml-1">({w.currentTicket.status})</span>
            </p>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm font-medium min-w-0"
          />
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            type="number"
            min={1}
            className="w-16 border rounded-lg px-2 py-2 text-sm text-center"
          />
          <Button
            variant="secondary"
            onClick={() => onSave(w, name, parseInt(number, 10))}
            className="!px-3 text-sm shrink-0"
          >
            Guardar
          </Button>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Operador</p>
          {operator ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg px-3 py-2 text-sm font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                {operator.fullName}
              </span>
              {!w.activeSession && (
                <button
                  type="button"
                  onClick={() => onUnassign(w.id, w.name)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Quitar
                </button>
              )}
              {w.activeSession && (
                <span className="text-xs text-amber-600">Sesión activa — no se puede quitar</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 mb-2">Sin operador asignado</p>
          )}
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm mt-2"
            value=""
            onChange={(e) => e.target.value && onAssign(w.id, e.target.value)}
          >
            <option value="">Asignar operador...</option>
            {operators.map((u) => {
              const assigned = assignedWindowForUser(u.id);
              const isHere = assigned?.id === w.id;
              if (isHere) return null;
              return (
                <option key={u.id} value={u.id}>
                  {u.fullName}
                  {assigned ? ` · actualmente en Vent. ${assigned.number}` : ' · libre'}
                </option>
              );
            })}
          </select>
          <p className="text-xs text-slate-400 mt-1">Un operador solo puede estar en una ventanilla.</p>
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Prioridades que atiende</p>
          <div className="flex flex-wrap gap-2">
            {activePriorities.map((p) => {
              const active = priorityIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onTogglePriority(w.id, p.id, priorityIds)}
                  className={`text-sm px-3 py-1.5 rounded-lg border font-medium transition ${
                    active
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
                  }`}
                >
                  {p.code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={() => onToggleActive(w)} className="text-sm">
            {w.isActive ? 'Desactivar' : 'Activar'}
          </Button>
          <Button variant="danger" onClick={() => onDelete(w)} className="text-sm">
            Eliminar
          </Button>
        </div>
      </div>
    </Card>
  );
}
