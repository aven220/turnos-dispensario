import { FormEvent, useEffect, useState } from 'react';
import { TicketPrintPreview } from '../components/TicketPrintPreview';
import { TickerPreview } from '../components/TickerPreview';
import { WindowsManager } from '../components/WindowsManager';
import { Button, Card, Layout } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { api, apiBlob, apiUpload } from '../services/api';
import { getSocket } from '../services/socket';
import type { Priority, Stats, TicketPrintSettings, TickerMessage, TvMedia, TvSettings, User, Window } from '../types';

type Tab = 'dashboard' | 'users' | 'windows' | 'priorities' | 'tv' | 'ticketPrint' | 'audit';

const DEFAULT_TICKET_PRINT: TicketPrintSettings = {
  id: 'default',
  headerTitle: 'CENCOIC',
  showHeader: true,
  showPriority: true,
  showDisplayCode: true,
  showUniqueCode: false,
  showDateTime: true,
  showFooter: true,
  footerMessage: 'Espere a ser llamado en pantalla',
};

interface AuditLog {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  user: { fullName: string } | null;
  window: { name: string; number: number } | null;
  ticket: { displayCode: string } | null;
}

export function AdminPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [windows, setWindows] = useState<Window[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [tickerText, setTickerText] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaTitle, setMediaTitle] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaMode, setMediaMode] = useState<'file' | 'url'>('file');
  const [tvMedia, setTvMedia] = useState<TvMedia[]>([]);
  const [tickerMessages, setTickerMessages] = useState<TickerMessage[]>([]);
  const [editingTickerId, setEditingTickerId] = useState<string | null>(null);
  const [editingTickerText, setEditingTickerText] = useState('');
  const [tvError, setTvError] = useState('');
  const [tvSettings, setTvSettings] = useState<TvSettings | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(3);
  const [windowQueueCount, setWindowQueueCount] = useState(3);
  const [welcomeMessage, setWelcomeMessage] = useState('BIENVENIDOS A CENCOIC');
  const [userError, setUserError] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editError, setEditError] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editingPriority, setEditingPriority] = useState<Priority | null>(null);
  const [priorityError, setPriorityError] = useState('');
  const [priorityLoading, setPriorityLoading] = useState(false);
  const [priorityDraft, setPriorityDraft] = useState({ name: '', code: '', sortOrder: '' });
  const [ticketPrintSettings, setTicketPrintSettings] = useState<TicketPrintSettings | null>(null);
  const [ticketPrintDraft, setTicketPrintDraft] = useState<TicketPrintSettings>(DEFAULT_TICKET_PRINT);
  const [ticketPrintError, setTicketPrintError] = useState('');

  async function loadAll() {
    const [s, u, w, p, a] = await Promise.all([
      api<Stats>('/stats'),
      api<User[]>('/users'),
      api<Window[]>('/windows'),
      api<Priority[]>('/priorities?includeInactive=true'),
      api<AuditLog[]>('/stats/audit?limit=50'),
    ]);
    setStats(s);
    setUsers(u);
    setWindows(w);
    setPriorities(p);
    setAudit(a);
  }

  async function loadTvConfig() {
    const [media, ticker, settings] = await Promise.all([
      api<TvMedia[]>('/tv/media'),
      api<TickerMessage[]>('/tv/ticker'),
      api<TvSettings>('/tv/settings'),
    ]);
    setTvMedia(media.filter((m) => m.isActive));
    setTickerMessages(ticker.filter((t) => t.isActive));
    setTvSettings(settings);
    setUpcomingCount(settings.upcomingCount);
    setWindowQueueCount(settings.windowQueueCount);
    setWelcomeMessage(settings.welcomeMessage);
  }

  async function loadTicketPrintConfig() {
    const settings = await api<TicketPrintSettings>('/tickets/print-settings');
    setTicketPrintSettings(settings);
    setTicketPrintDraft(settings);
  }

  async function saveTicketPrintSettings() {
    setTicketPrintError('');
    try {
      const settings = await api<TicketPrintSettings>('/tickets/print-settings', {
        method: 'PATCH',
        body: JSON.stringify({
          headerTitle: ticketPrintDraft.headerTitle.trim(),
          showHeader: ticketPrintDraft.showHeader,
          showPriority: ticketPrintDraft.showPriority,
          showDisplayCode: ticketPrintDraft.showDisplayCode,
          showUniqueCode: ticketPrintDraft.showUniqueCode,
          showDateTime: ticketPrintDraft.showDateTime,
          showFooter: ticketPrintDraft.showFooter,
          footerMessage: ticketPrintDraft.footerMessage.trim(),
        }),
      });
      setTicketPrintSettings(settings);
      setTicketPrintDraft(settings);
    } catch (err) {
      setTicketPrintError(err instanceof Error ? err.message : 'Error al guardar configuración');
    }
  }

  function updateTicketPrintField<K extends keyof TicketPrintSettings>(key: K, value: TicketPrintSettings[K]) {
    setTicketPrintDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function saveTvSettings() {
    setTvError('');
    try {
      const settings = await api<TvSettings>('/tv/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          upcomingCount,
          windowQueueCount,
          welcomeMessage: welcomeMessage.trim(),
        }),
      });
      setTvSettings(settings);
      setWelcomeMessage(settings.welcomeMessage);
      setUpcomingCount(settings.upcomingCount);
      setWindowQueueCount(settings.windowQueueCount);
    } catch (err) {
      setTvError(err instanceof Error ? err.message : 'Error al guardar configuración');
    }
  }

  useEffect(() => {
    loadAll();
    const socket = getSocket(token ?? undefined);
    const refresh = () => loadAll();
    socket.on('ticket:created', refresh);
    socket.on('ticket:finished', refresh);
    return () => {
      socket.off('ticket:created', refresh);
      socket.off('ticket:finished', refresh);
    };
  }, [token]);

  useEffect(() => {
    if (tab === 'tv') loadTvConfig();
    if (tab === 'ticketPrint') loadTicketPrintConfig();
  }, [tab]);

  async function updateUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    setEditLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    const payload: Record<string, string> = {
      username: String(fd.get('username') ?? '').trim(),
      fullName: String(fd.get('fullName') ?? '').trim(),
      role: String(fd.get('role') ?? ''),
    };
    if (password) payload.password = password;

    try {
      await api(`/users/${editingUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setEditingUser(null);
      loadAll();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setEditLoading(false);
    }
  }

  async function reactivateUser(userId: string) {
    try {
      await api(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ACTIVE' }),
      });
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reactivar');
    }
  }

  async function createUser(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUserError('');
    setUserLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: String(fd.get('username') ?? '').trim(),
          password: fd.get('password'),
          fullName: String(fd.get('fullName') ?? '').trim(),
          role: fd.get('role'),
        }),
      });
      e.currentTarget.reset();
      loadAll();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Error al crear usuario');
    } finally {
      setUserLoading(false);
    }
  }

  async function createPriority(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPriorityError('');
    const sortOrder = parsePrioritySortOrder(priorityDraft.sortOrder);
    if (sortOrder === null) {
      setPriorityError('Indique un acomodo válido (1 = se atiende primero)');
      return;
    }
    setPriorityLoading(true);
    try {
      await api('/priorities', {
        method: 'POST',
        body: JSON.stringify({
          name: priorityDraft.name.trim(),
          code: priorityDraft.code.trim().toUpperCase(),
          sortOrder,
        }),
      });
      setPriorityDraft({ name: '', code: '', sortOrder: '' });
      loadAll();
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setPriorityLoading(false);
    }
  }

  async function updatePriority(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editingPriority) return;
    setPriorityError('');
    const sortOrder = parsePrioritySortOrder(priorityDraft.sortOrder);
    if (sortOrder === null) {
      setPriorityError('Indique un acomodo válido (1 = se atiende primero)');
      return;
    }
    setPriorityLoading(true);
    try {
      await api(`/priorities/${editingPriority.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: priorityDraft.name.trim(),
          code: priorityDraft.code.trim().toUpperCase(),
          sortOrder,
        }),
      });
      cancelEditPriority();
      loadAll();
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setPriorityLoading(false);
    }
  }

  function parsePrioritySortOrder(value: string): number | null {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return null;
    return n;
  }

  function startEditPriority(priority: Priority) {
    setEditingPriority(priority);
    setPriorityError('');
    setPriorityDraft({
      name: priority.name,
      code: priority.code,
      sortOrder: String(priority.sortOrder),
    });
  }

  function cancelEditPriority() {
    setEditingPriority(null);
    setPriorityError('');
    setPriorityDraft({ name: '', code: '', sortOrder: '' });
  }

  async function deactivatePriority(priorityId: string) {
    try {
      await api(`/priorities/${priorityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      if (editingPriority?.id === priorityId) cancelEditPriority();
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al desactivar');
    }
  }

  async function reactivatePriority(priorityId: string) {
    try {
      await api(`/priorities/${priorityId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: true }),
      });
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reactivar');
    }
  }

  async function deletePriority(priorityId: string, label: string) {
    if (!confirm(`¿Eliminar permanentemente la prioridad "${label}"?\n\nSolo se permite si no tiene turnos asociados.`)) return;
    try {
      await api(`/priorities/${priorityId}`, { method: 'DELETE' });
      if (editingPriority?.id === priorityId) cancelEditPriority();
      loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function addTicker() {
    if (!tickerText.trim()) return;
    setTvError('');
    try {
      await api('/tv/ticker', { method: 'POST', body: JSON.stringify({ message: tickerText.trim() }) });
      setTickerText('');
      loadTvConfig();
    } catch (err) {
      setTvError(err instanceof Error ? err.message : 'Error al agregar mensaje');
    }
  }

  async function saveTickerEdit(id: string) {
    if (!editingTickerText.trim()) return;
    setTvError('');
    try {
      await api(`/tv/ticker/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ message: editingTickerText.trim() }),
      });
      setEditingTickerId(null);
      setEditingTickerText('');
      loadTvConfig();
    } catch (err) {
      setTvError(err instanceof Error ? err.message : 'Error al guardar mensaje');
    }
  }

  async function removeTicker(id: string) {
    try {
      await api(`/tv/ticker/${id}`, { method: 'DELETE' });
      loadTvConfig();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function addMedia() {
    setTvError('');
    try {
      if (mediaMode === 'file') {
        if (!mediaFile) {
          setTvError('Seleccione un archivo');
          return;
        }
        const fd = new FormData();
        fd.append('file', mediaFile);
        if (mediaTitle.trim()) fd.append('title', mediaTitle.trim());
        await apiUpload('/tv/media/upload', fd);
        setMediaFile(null);
        setMediaTitle('');
      } else {
        if (!mediaUrl.trim()) {
          setTvError('Ingrese un enlace');
          return;
        }
        await api('/tv/media', {
          method: 'POST',
          body: JSON.stringify({
            title: mediaTitle.trim() || 'Video TV',
            url: mediaUrl.trim(),
          }),
        });
        setMediaUrl('');
        setMediaTitle('');
      }
      loadTvConfig();
    } catch (err) {
      setTvError(err instanceof Error ? err.message : 'Error al agregar media');
    }
  }

  async function removeMedia(id: string) {
    try {
      await api(`/tv/media/${id}`, { method: 'DELETE' });
      loadTvConfig();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function download(format: 'excel' | 'pdf') {
    const blob = await apiBlob(`/stats/export/${format}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-turnos.${format === 'excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadDaily(format: 'daily-excel' | 'daily-pdf') {
    const date = stats?.datePrefix ?? new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const blob = await apiBlob(`/stats/export/${format}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe-ventanillas-${date}.${format === 'daily-excel' ? 'xlsx' : 'pdf'}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatTodayLabel(prefix?: string) {
    if (!prefix || prefix.length !== 8) return 'Hoy';
    return `${prefix.slice(6, 8)}/${prefix.slice(4, 6)}/${prefix.slice(0, 4)}`;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Estadísticas' },
    { id: 'users', label: 'Usuarios' },
    { id: 'windows', label: 'Ventanillas' },
    { id: 'priorities', label: 'Prioridades' },
    { id: 'tv', label: 'Pantalla TV' },
    { id: 'ticketPrint', label: 'Impresión turno' },
    { id: 'audit', label: 'Auditoría' },
  ];

  const windowOperators = users.filter((u) => u.role === 'WINDOW');

  const tickerPreviewParts = tickerMessages
    .map((msg) => (editingTickerId === msg.id ? editingTickerText : msg.message))
    .map((m) => m.trim())
    .filter(Boolean);
  if (tickerText.trim()) tickerPreviewParts.push(tickerText.trim());
  const tickerPreviewText = tickerPreviewParts.join('   ·   ');

  return (
    <Layout title="Panel Administrador">
      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((t) => (
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

      {tab === 'dashboard' && stats && (
        <div className="space-y-6">
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex flex-wrap justify-between items-start gap-4">
              <div>
                <h3 className="font-semibold text-blue-900">Informe detallado del día</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Estadísticas y detalle por ventanilla — {formatTodayLabel(stats.datePrefix)}
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  Los turnos reinician cada día. La numeración (PRI001, GEN001…) vuelve a cero automáticamente.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => downloadDaily('daily-excel')}>Excel detallado</Button>
                <Button variant="secondary" onClick={() => downloadDaily('daily-pdf')}>PDF detallado</Button>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Generados', value: stats.generated, color: 'blue' },
              { label: 'Atendidos', value: stats.attended, color: 'emerald' },
              { label: 'Ausentes', value: stats.absent, color: 'amber' },
              { label: 'Cancelados', value: stats.cancelled, color: 'red' },
            ].map((item) => (
              <Card key={item.label} className="text-center">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className={`text-3xl font-bold text-${item.color}-600`}>{item.value}</p>
              </Card>
            ))}
          </div>

          <Card>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Ranking por ventanilla — {formatTodayLabel(stats.datePrefix)}</h3>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => download('excel')}>Resumen Excel</Button>
                <Button variant="secondary" onClick={() => download('pdf')}>Resumen PDF</Button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">#</th>
                  <th>Ventanilla</th>
                  <th>Atendidos</th>
                  <th>Ausentes</th>
                  <th>Promedio</th>
                  <th>Operador</th>
                </tr>
              </thead>
              <tbody>
                {stats.windowStats.map((w, i) => (
                  <tr key={w.windowId} className="border-b">
                    <td className="py-2">{i + 1}</td>
                    <td>{w.windowName}</td>
                    <td className="font-bold">{w.totalAttended}</td>
                    <td>{w.totalAbsent ?? 0}</td>
                    <td>{Math.floor(w.avgAttentionSeconds / 60)}m {w.avgAttentionSeconds % 60}s</td>
                    <td>{w.assignedUser ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            {editingUser ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Editar usuario</h3>
                  <button type="button" onClick={() => { setEditingUser(null); setEditError(''); }} className="text-sm text-slate-500 hover:text-slate-700">
                    Cancelar
                  </button>
                </div>
                <form onSubmit={updateUser} className="space-y-3">
                  <input name="username" defaultValue={editingUser.username} placeholder="Usuario" minLength={3} className="w-full border rounded-lg px-3 py-2" required />
                  <input name="fullName" defaultValue={editingUser.fullName} placeholder="Nombre completo" minLength={2} className="w-full border rounded-lg px-3 py-2" required />
                  <select name="role" defaultValue={editingUser.role} className="w-full border rounded-lg px-3 py-2">
                    <option value="ADMIN">Administrador</option>
                    <option value="FILTER">Filtro</option>
                    <option value="WINDOW">Ventanilla</option>
                  </select>
                  <input
                    name="password"
                    type="password"
                    placeholder="Nueva contraseña (mín. 6 caracteres, opcional)"
                    minLength={6}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-slate-400">Deje la contraseña vacía si no desea cambiarla. Útil para recuperar acceso de un usuario.</p>
                  {editError && <p className="text-red-600 text-sm">{editError}</p>}
                  <Button type="submit" disabled={editLoading}>{editLoading ? 'Guardando...' : 'Guardar cambios'}</Button>
                </form>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-4">Crear usuario</h3>
                <form onSubmit={createUser} className="space-y-3">
                  <input name="username" placeholder="Usuario (mín. 3 caracteres)" minLength={3} className="w-full border rounded-lg px-3 py-2" required />
                  <input name="password" type="password" placeholder="Contraseña (mín. 6 caracteres)" minLength={6} className="w-full border rounded-lg px-3 py-2" required />
                  <input name="fullName" placeholder="Nombre completo" minLength={2} className="w-full border rounded-lg px-3 py-2" required />
                  <select name="role" className="w-full border rounded-lg px-3 py-2">
                    <option value="ADMIN">Administrador</option>
                    <option value="FILTER">Filtro</option>
                    <option value="WINDOW">Ventanilla</option>
                  </select>
                  {userError && <p className="text-red-600 text-sm">{userError}</p>}
                  <Button type="submit" disabled={userLoading}>{userLoading ? 'Creando...' : 'Crear'}</Button>
                </form>
              </>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-4">Usuarios ({users.length})</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {users.map((u) => (
                <div key={u.id} className={`flex justify-between items-center p-3 rounded-lg ${editingUser?.id === u.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                  <div>
                    <p className="font-medium">{u.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {u.username} · {u.role}
                      {u.windowAssignments?.[0] && ` · ${u.windowAssignments[0].window.name}`}
                      {u.status === 'INACTIVE' && ' · Inactivo'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => { setEditingUser(u); setEditError(''); setUserError(''); }}>
                      Editar
                    </Button>
                    {u.status === 'ACTIVE' ? (
                      <Button variant="danger" onClick={() => api(`/users/${u.id}/deactivate`, { method: 'PATCH' }).then(loadAll)}>
                        Desactivar
                      </Button>
                    ) : (
                      <Button variant="success" onClick={() => reactivateUser(u.id)}>Reactivar</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'windows' && (
        <WindowsManager
          windows={windows}
          priorities={priorities}
          operators={windowOperators}
          onRefresh={loadAll}
        />
      )}

      {tab === 'priorities' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            {editingPriority ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Editar prioridad</h3>
                  <button type="button" onClick={cancelEditPriority} className="text-sm text-slate-500 hover:text-slate-700">
                    Cancelar
                  </button>
                </div>
                <form key={editingPriority.id} onSubmit={updatePriority} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <input
                      value={priorityDraft.name}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Nombre"
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Código</label>
                    <input
                      value={priorityDraft.code}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                      placeholder="Código (ej: PRI)"
                      maxLength={5}
                      className="w-full border rounded-lg px-3 py-2 uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Acomodar</label>
                    <input
                      value={priorityDraft.sortOrder}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                      type="number"
                      placeholder="1 = se atiende primero"
                      min={1}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Define el orden en que se atienden los turnos de esta prioridad.</p>
                  </div>
                  {priorityError && <p className="text-red-600 text-sm">{priorityError}</p>}
                  <Button type="submit" disabled={priorityLoading}>
                    {priorityLoading ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h3 className="font-semibold mb-4">Crear prioridad</h3>
                <form onSubmit={createPriority} className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Nombre</label>
                    <input
                      value={priorityDraft.name}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, name: e.target.value }))}
                      placeholder="Nombre"
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Código</label>
                    <input
                      value={priorityDraft.code}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                      placeholder="Código (ej: PRI)"
                      maxLength={5}
                      className="w-full border rounded-lg px-3 py-2 uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Acomodar</label>
                    <input
                      value={priorityDraft.sortOrder}
                      onChange={(e) => setPriorityDraft((d) => ({ ...d, sortOrder: e.target.value }))}
                      type="number"
                      placeholder="1 = se atiende primero"
                      min={1}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                    <p className="text-xs text-slate-500 mt-1">Define el orden en que se atienden los turnos de esta prioridad.</p>
                  </div>
                  {priorityError && <p className="text-red-600 text-sm">{priorityError}</p>}
                  <Button type="submit" disabled={priorityLoading}>
                    {priorityLoading ? 'Creando...' : 'Crear'}
                  </Button>
                </form>
              </>
            )}
          </Card>
          <Card>
            <h3 className="font-semibold mb-1">Prioridades</h3>
            <p className="text-xs text-slate-500 mb-4">
              Si ve duplicados, elimine las que no use (sin turnos asociados). Mantenga una sola por código.
            </p>
            <div className="space-y-2">
              {priorities.map((p) => (
                <div key={p.id} className={`flex justify-between items-center gap-2 p-3 rounded-lg ${editingPriority?.id === p.id ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50'}`}>
                  <div className="min-w-0">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-sm text-slate-500 ml-2">{p.code} · Acomodo {p.sortOrder}</span>
                    {p.isActive === false && <span className="text-xs text-red-500 ml-2">Inactiva</span>}
                    {(p._count?.tickets ?? 0) > 0 && (
                      <span className="text-xs text-amber-600 ml-2">{p._count!.tickets} turno(s)</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0 justify-end">
                    <Button variant="secondary" onClick={() => startEditPriority(p)}>Editar</Button>
                    {p.isActive === false ? (
                      <Button variant="success" onClick={() => reactivatePriority(p.id)}>Reactivar</Button>
                    ) : (
                      <Button variant="danger" onClick={() => deactivatePriority(p.id)}>Desactivar</Button>
                    )}
                    <Button variant="danger" onClick={() => deletePriority(p.id, p.name)}>Eliminar</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {tab === 'tv' && (
        <div className="space-y-6">
          {tvError && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2">{tvError}</p>}

          <Card>
            <h3 className="font-semibold mb-2">Configuración de pantalla TV</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mensaje de bienvenida (parte superior)</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="BIENVENIDOS A CENCOIC"
                  maxLength={120}
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Próximos turnos en TV</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={upcomingCount}
                    onChange={(e) => setUpcomingCount(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-24 border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Cola visible en ventanilla</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={windowQueueCount}
                    onChange={(e) => setWindowQueueCount(Math.min(10, Math.max(0, Number(e.target.value) || 0)))}
                    className="w-24 border rounded-lg px-3 py-2"
                  />
                </div>
                <span className="text-xs text-slate-400 pb-2">0 = ocultar · máximo 10</span>
              </div>
              <Button
                onClick={saveTvSettings}
                disabled={
                  tvSettings?.upcomingCount === upcomingCount &&
                  tvSettings?.windowQueueCount === windowQueueCount &&
                  tvSettings?.welcomeMessage === welcomeMessage.trim()
                }
              >
                Guardar configuración TV
              </Button>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold mb-2">Mensajes del ticker</h3>
              <p className="text-xs text-slate-500 mb-4">
                Edite los mensajes y vea en tiempo real cómo se verán en la TV. Use &quot;Imprimir vista previa&quot; para revisar antes de imprimir.
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  className="flex-1 border rounded-lg px-3 py-2"
                  value={tickerText}
                  onChange={(e) => setTickerText(e.target.value)}
                  placeholder="Ej: Horario de atención de 7 AM a 5 PM"
                />
                <Button onClick={addTicker}>Agregar</Button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
                {tickerMessages.length === 0 && (
                  <p className="text-sm text-slate-400">No hay mensajes activos en el ticker.</p>
                )}
                {tickerMessages.map((msg) => (
                  <div key={msg.id} className="p-3 bg-slate-50 rounded-lg">
                    {editingTickerId === msg.id ? (
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-500">Editar mensaje</label>
                        <textarea
                          className="w-full border rounded-lg px-3 py-2 text-sm"
                          rows={3}
                          value={editingTickerText}
                          onChange={(e) => setEditingTickerText(e.target.value)}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <Button onClick={() => saveTickerEdit(msg.id)}>Guardar</Button>
                          <Button variant="secondary" onClick={() => { setEditingTickerId(null); setEditingTickerText(''); }}>Cancelar</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-3">
                        <p className="text-sm flex-1">{msg.message}</p>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            variant="secondary"
                            onClick={() => { setEditingTickerId(msg.id); setEditingTickerText(msg.message); }}
                          >
                            Editar
                          </Button>
                          <Button variant="danger" onClick={() => removeTicker(msg.id)}>Eliminar</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <TickerPreview
                tickerText={tickerPreviewText}
                welcomeMessage={welcomeMessage.trim() || 'BIENVENIDOS A CENCOIC'}
              />
            </Card>

            <Card>
              <h3 className="font-semibold mb-2">Multimedia TV</h3>
              <p className="text-xs text-slate-500 mb-4">Suba un archivo o pegue un enlace de video (MP4, YouTube).</p>

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setMediaMode('file')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${mediaMode === 'file' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Subir archivo
                </button>
                <button
                  type="button"
                  onClick={() => setMediaMode('url')}
                  className={`px-3 py-1.5 rounded-lg text-sm ${mediaMode === 'url' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Enlace URL
                </button>
              </div>

              <div className="space-y-2 mb-4">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={mediaTitle}
                  onChange={(e) => setMediaTitle(e.target.value)}
                  placeholder="Título (opcional)"
                />
                {mediaMode === 'file' ? (
                  <input
                    type="file"
                    accept="video/mp4,video/webm,image/jpeg,image/png,image/webp,image/gif"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    onChange={(e) => setMediaFile(e.target.files?.[0] ?? null)}
                  />
                ) : (
                  <input
                    className="w-full border rounded-lg px-3 py-2"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    placeholder="https://... (MP4, JPG, PNG o YouTube)"
                  />
                )}
                <Button onClick={addMedia}>Agregar multimedia</Button>
              </div>

              <h4 className="font-medium text-sm mb-2">En reproducción ({tvMedia.length})</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tvMedia.length === 0 && (
                  <p className="text-sm text-slate-400">Sin contenido multimedia activo.</p>
                )}
                {tvMedia.map((m) => (
                  <div key={m.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{m.title}</p>
                      <p className="text-xs text-slate-500 truncate">{m.type} · {m.url}</p>
                    </div>
                    <Button variant="danger" onClick={() => removeMedia(m.id)}>Eliminar</Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'ticketPrint' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <h3 className="font-semibold mb-2">Configuración del ticket impreso</h3>
            <p className="text-xs text-slate-500 mb-4">
              Elija qué datos se muestran cuando el módulo Filtro imprime un turno para el usuario.
            </p>

            {ticketPrintError && (
              <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-4 py-2 mb-4">{ticketPrintError}</p>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Título superior</label>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={ticketPrintDraft.headerTitle}
                  onChange={(e) => updateTicketPrintField('headerTitle', e.target.value)}
                  maxLength={80}
                  disabled={!ticketPrintDraft.showHeader}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Mensaje inferior</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  rows={2}
                  value={ticketPrintDraft.footerMessage}
                  onChange={(e) => updateTicketPrintField('footerMessage', e.target.value)}
                  maxLength={200}
                  disabled={!ticketPrintDraft.showFooter}
                />
              </div>

              <div className="space-y-2 pt-2">
                {[
                  { key: 'showHeader' as const, label: 'Mostrar título superior' },
                  { key: 'showPriority' as const, label: 'Mostrar prioridad (ej. Prioritario)' },
                  { key: 'showDisplayCode' as const, label: 'Mostrar número de turno (ej. PRI001)' },
                  { key: 'showUniqueCode' as const, label: 'Mostrar código interno completo' },
                  { key: 'showDateTime' as const, label: 'Mostrar fecha y hora' },
                  { key: 'showFooter' as const, label: 'Mostrar mensaje inferior' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={ticketPrintDraft[item.key]}
                      onChange={(e) => updateTicketPrintField(item.key, e.target.checked)}
                      className="rounded"
                    />
                    {item.label}
                  </label>
                ))}
              </div>

              <Button
                onClick={saveTicketPrintSettings}
                disabled={JSON.stringify(ticketPrintSettings) === JSON.stringify({
                  ...ticketPrintDraft,
                  headerTitle: ticketPrintDraft.headerTitle.trim(),
                  footerMessage: ticketPrintDraft.footerMessage.trim(),
                })}
              >
                Guardar configuración
              </Button>
            </div>
          </Card>

          <Card>
            <TicketPrintPreview settings={ticketPrintDraft} />
          </Card>
        </div>
      )}

      {tab === 'audit' && (
        <Card>
          <h3 className="font-semibold mb-4">Auditoría del sistema</h3>
          <div className="max-h-[600px] overflow-y-auto space-y-2">
            {audit.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{log.action}</span>
                  <span className="text-slate-400">{new Date(log.createdAt).toLocaleString('es-CO')}</span>
                </div>
                <p className="text-slate-600">
                  {log.user?.fullName && `Usuario: ${log.user.fullName}`}
                  {log.window && ` · Ventanilla: ${log.window.name}`}
                  {log.ticket && ` · Turno: ${log.ticket.displayCode}`}
                  {log.details && ` · ${log.details}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </Layout>
  );
}
