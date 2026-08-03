import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { ChatMessage, ChatParticipant, ChatSettings, ChatThread } from '../types';
import { playChatNotifySound, unlockChatSound } from '../utils/chatSound';
import { Button, Card } from './Layout';

function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    WINDOW: 'Ventanilla',
    FILTER: 'Filtro',
    AREA_MANAGER: 'Jefe de área',
    AUDITOR: 'Auditoría',
    ADMIN: 'Admin',
  };
  return map[role] ?? role;
}

function deliveryLabel(m: ChatMessage, mine: boolean): string | null {
  if (!mine) return null;
  if (m.readAt) return 'Leído';
  if (m.deliveredAt) return 'Entregado';
  return 'Enviado';
}

interface ChatConversationProps {
  participantId: string;
  title?: string;
  relatedTicketOverride?: { displayCode: string } | null;
  settings: ChatSettings;
  onUnreadChange?: () => void;
  compact?: boolean;
  /** Si true, no reproduce sonido (lo maneja el contenedor al auto-abrir). */
  muteIncomingSound?: boolean;
}

export function ChatConversation({
  participantId,
  title,
  relatedTicketOverride,
  settings,
  onUnreadChange,
  compact,
  muteIncomingSound,
}: ChatConversationProps) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [relatedTicket, setRelatedTicket] = useState<{ id: string; displayCode: string } | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const myId = user?.id;

  const load = useCallback(async () => {
    if (!participantId) {
      setError('No se pudo identificar la conversación. Cierre sesión y vuelva a entrar.');
      return;
    }
    try {
      const data = await api<ChatThread>(`/chat/threads/${participantId}`);
      setMessages(data.messages);
      setRelatedTicket(data.relatedTicket);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el chat');
    }
  }, [participantId]);

  const markRead = useCallback(async () => {
    if (!participantId) return;
    try {
      await api(`/chat/threads/${participantId}/read`, { method: 'POST', body: '{}' });
      onUnreadChange?.();
    } catch {
      // ignore
    }
  }, [participantId, onUnreadChange]);

  const ackDelivered = useCallback(
    async (msg: ChatMessage) => {
      if (msg.senderId === myId || msg.deliveredAt) return;
      try {
        await api(`/chat/messages/${msg.id}/delivered`, { method: 'POST', body: '{}' });
      } catch {
        // ignore
      }
    },
    [myId]
  );

  useEffect(() => {
    load().then(() => markRead()).catch(() => undefined);
  }, [load, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onMessage = (msg: ChatMessage) => {
      if (msg.participantId !== participantId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== myId) {
        if (!muteIncomingSound && settings.chatSoundEnabled) playChatNotifySound();
        ackDelivered(msg);
        markRead();
        onUnreadChange?.();
      }
    };
    const onRead = (payload: { participantId: string }) => {
      if (payload.participantId !== participantId) return;
      load();
    };
    const onDelivered = (payload: { id: string; participantId: string; deliveredAt: string }) => {
      if (payload.participantId !== participantId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, deliveredAt: payload.deliveredAt } : m))
      );
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:delivered', onDelivered);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:delivered', onDelivered);
    };
  }, [
    token,
    participantId,
    myId,
    settings.chatSoundEnabled,
    muteIncomingSound,
    markRead,
    onUnreadChange,
    load,
    ackDelivered,
  ]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !settings.chatEnabled) return;
    if (!participantId || !myId) {
      setError('Sesión inválida. Cierre sesión y vuelva a entrar.');
      return;
    }
    unlockChatSound();
    setSending(true);
    setError('');
    try {
      const msg = await api<ChatMessage>(`/chat/threads/${participantId}`, {
        method: 'POST',
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setText('');
      onUnreadChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  const ticketLabel = relatedTicketOverride?.displayCode ?? relatedTicket?.displayCode ?? null;

  return (
    <div className={`flex flex-col ${compact ? 'h-[380px]' : 'h-[520px]'}`}>
      {(title || ticketLabel) && (
        <div className="border-b border-slate-200 pb-2 mb-2 shrink-0">
          {title && <p className="text-sm font-semibold text-slate-800">{title}</p>}
          {ticketLabel && (
            <p className="text-xs font-medium text-emerald-700 mt-0.5">Turno relacionado: {ticketLabel}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin mensajes aún</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          const status = deliveryLabel(m, mine);
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {!mine && (
                  <p className="text-[10px] font-semibold mb-0.5 text-slate-500">{m.sender.fullName}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div
                  className={`flex items-center gap-2 mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-slate-400'}`}
                >
                  <span>{formatMsgTime(m.createdAt)}</span>
                  {m.ticketDisplayCode && <span>· {m.ticketDisplayCode}</span>}
                  {status && <span>· {status}</span>}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-600 text-xs mt-2">{error}</p>}

      <form onSubmit={handleSend} className="mt-2 flex gap-2 shrink-0">
        <input
          className="flex-1 border rounded-lg px-3 py-2 text-sm"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => unlockChatSound()}
          placeholder={settings.chatEnabled ? 'Escriba un mensaje...' : 'Chat desactivado'}
          maxLength={1000}
          disabled={!settings.chatEnabled || sending || !participantId}
        />
        <Button
          type="submit"
          disabled={!settings.chatEnabled || sending || !text.trim() || !participantId}
        >
          Enviar
        </Button>
      </form>
    </div>
  );
}

export function AdminChatPanel() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setSettings(await api<ChatSettings>('/chat/settings'));
  }, []);

  const loadParticipants = useCallback(async () => {
    const list = await api<ChatParticipant[]>('/chat/participants');
    setParticipants(list);
  }, []);

  useEffect(() => {
    loadSettings();
    loadParticipants();
  }, [loadSettings, loadParticipants]);

  useEffect(() => {
    if (!token) return;
    getSocket(token);
  }, [token]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onMsg = (msg: ChatMessage) => {
      if (msg.sender?.role === 'ADMIN') return;
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === msg.participantId
            ? {
                ...p,
                unread: selectedId === msg.participantId ? 0 : p.unread + 1,
                lastMessage: { body: msg.body, createdAt: msg.createdAt },
              }
            : p
        )
      );
    };
    const onSettings = (s: ChatSettings) => setSettings(s);
    const onPresence = (payload: { userId: string; online: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.userId ? { ...p, online: payload.online } : p))
      );
    };
    const onPresenceSync = (payload: { onlineUserIds: string[] }) => {
      const set = new Set(payload.onlineUserIds);
      setParticipants((prev) => prev.map((p) => ({ ...p, online: set.has(p.id) })));
    };
    socket.on('chat:message', onMsg);
    socket.on('chat:settings-updated', onSettings);
    socket.on('chat:presence', onPresence);
    socket.on('chat:presence-sync', onPresenceSync);
    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:settings-updated', onSettings);
      socket.off('chat:presence', onPresence);
      socket.off('chat:presence-sync', onPresenceSync);
    };
  }, [token, selectedId]);

  async function saveSettings(patch: Partial<ChatSettings>) {
    setSaving(true);
    try {
      setSettings(
        await api<ChatSettings>('/chat/settings', { method: 'PATCH', body: JSON.stringify(patch) })
      );
    } finally {
      setSaving(false);
    }
  }

  const selected = participants.find((p) => p.id === selectedId);
  const sortedParticipants = [...participants].sort((a, b) => {
    if (!!a.online === !!b.online) return a.fullName.localeCompare(b.fullName, 'es');
    return a.online ? -1 : 1;
  });

  return (
    <div className="space-y-6">
      <Card className="bg-slate-50">
        <h3 className="font-semibold mb-3">Configuración del chat</h3>
        <div className="flex flex-wrap gap-6 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings?.chatEnabled ?? true}
              disabled={!settings || saving}
              onChange={(e) => saveSettings({ chatEnabled: e.target.checked })}
            />
            Chat interno activo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings?.chatSoundEnabled ?? true}
              disabled={!settings || saving}
              onChange={(e) => saveSettings({ chatSoundEnabled: e.target.checked })}
            />
            Sonido de notificaciones
          </label>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Comunicación centralizada: cada usuario solo chatea con el Administrador. El punto verde
          indica quién está conectado ahora.
        </p>
      </Card>

      {!settings?.chatEnabled ? (
        <Card>
          <p className="text-sm text-slate-600">El chat está desactivado. Active la opción arriba para usarlo.</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 !p-4">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Usuarios</p>
            <p className="text-[11px] text-slate-400 mb-2">● Verde = conectado ahora</p>
            <ul className="space-y-1 max-h-[480px] overflow-y-auto">
              {sortedParticipants.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setParticipants((prev) => prev.map((x) => (x.id === p.id ? { ...x, unread: 0 } : x)));
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center gap-2 ${
                      selectedId === p.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span className="min-w-0 flex items-start gap-2">
                      <span
                        className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${
                          p.online ? 'bg-emerald-400' : selectedId === p.id ? 'bg-slate-400' : 'bg-slate-300'
                        }`}
                        title={p.online ? 'Activo' : 'Desconectado'}
                      />
                      <span>
                        <span className="font-medium block truncate">{p.fullName}</span>
                        <span className={`text-xs ${selectedId === p.id ? 'text-blue-100' : 'text-slate-500'}`}>
                          {roleLabel(p.role)}
                          {p.window ? ` · Vent. ${p.window.number}` : ''}
                          {p.online ? ' · En línea' : ' · Fuera'}
                        </span>
                      </span>
                    </span>
                    {p.unread > 0 && (
                      <span className="shrink-0 text-xs font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5">
                        {p.unread}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-2">
            {selected && settings ? (
              <ChatConversation
                participantId={selected.id}
                title={`${selected.fullName} · ${roleLabel(selected.role)}`}
                settings={settings}
                onUnreadChange={loadParticipants}
              />
            ) : (
              <p className="text-sm text-slate-500 py-16 text-center">Seleccione un usuario para chatear</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

/** Botón de chat en la barra superior — visible para todos los usuarios autorizados. */
export function ChatNavButton() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [flash, setFlash] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Desbloquear audio con el primer clic/tecla en la página
  useEffect(() => {
    const unlock = () => unlockChatSound();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      setSettings(await api<ChatSettings>('/chat/settings'));
    } catch {
      setSettings(null);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const data = await api<{ total: number }>('/chat/unread');
      setUnread(data.total);
    } catch {
      setUnread(0);
    }
  }, []);

  const loadParticipants = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setParticipants(await api<ChatParticipant[]>('/chat/participants'));
    } catch {
      setParticipants([]);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!token) return;
    getSocket(token);
    loadSettings();
    loadUnread();
    loadParticipants();
  }, [token, loadSettings, loadUnread, loadParticipants]);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) setSelectedId(user.id);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);

    const onSettings = (s: ChatSettings) => setSettings(s);

    const onMsg = (msg: ChatMessage) => {
      // Evitar ecos / mensajes de otras conversaciones
      if (!msg?.participantId || !msg?.senderId) return;

      const forMe = isAdmin
        ? msg.senderId !== user.id && msg.sender?.role !== 'ADMIN'
        : msg.participantId === user.id && msg.senderId !== user.id;

      if (!forMe) return;

      if (settings?.chatSoundEnabled !== false) playChatNotifySound();
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);

      // Auto-abrir siempre que llegue un mensaje dirigido a mí
      setOpen(true);
      if (isAdmin) {
        setSelectedId(msg.participantId);
        loadParticipants();
      } else {
        setSelectedId(user.id);
      }
      loadUnread();

      if (msg.senderId !== user.id) {
        api(`/chat/messages/${msg.id}/delivered`, { method: 'POST', body: '{}' }).catch(() => undefined);
      }
    };

    const onPresence = (payload: { userId: string; online: boolean }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.userId ? { ...p, online: payload.online } : p))
      );
    };
    const onPresenceSync = (payload: { onlineUserIds: string[] }) => {
      const set = new Set(payload.onlineUserIds);
      setParticipants((prev) => prev.map((p) => ({ ...p, online: set.has(p.id) })));
    };

    socket.on('chat:settings-updated', onSettings);
    socket.on('chat:message', onMsg);
    socket.on('chat:read', loadUnread);
    socket.on('chat:presence', onPresence);
    socket.on('chat:presence-sync', onPresenceSync);
    return () => {
      socket.off('chat:settings-updated', onSettings);
      socket.off('chat:message', onMsg);
      socket.off('chat:read', loadUnread);
      socket.off('chat:presence', onPresence);
      socket.off('chat:presence-sync', onPresenceSync);
    };
  }, [token, user, isAdmin, settings?.chatSoundEnabled, loadUnread, loadParticipants]);

  if (!user || !settings?.chatEnabled) return null;

  const selected = isAdmin ? participants.find((p) => p.id === selectedId) : null;
  const threadId = isAdmin ? selectedId : user.id;
  const title = isAdmin
    ? selected
      ? `${selected.fullName} · ${roleLabel(selected.role)}`
      : 'Seleccione un usuario'
    : 'Chat con administración';
  const sortedParticipants = [...participants].sort((a, b) => {
    if (!!a.online === !!b.online) return a.fullName.localeCompare(b.fullName, 'es');
    return a.online ? -1 : 1;
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          unlockChatSound();
          setOpen((v) => !v);
          if (!openRef.current) {
            loadUnread();
            loadParticipants();
          }
        }}
        className={`relative text-sm px-3 py-1.5 rounded-lg font-medium transition ${
          unread > 0 || flash
            ? 'bg-amber-400 text-amber-950 hover:bg-amber-300 ring-2 ring-amber-200'
            : 'bg-slate-700 hover:bg-slate-600 text-white'
        }`}
      >
        Chat
        {unread > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed right-3 top-16 sm:right-6 w-[min(100vw-1.5rem,26rem)] bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 p-4 z-[200]">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold text-sm">Chat interno</p>
            <button type="button" className="text-slate-400 hover:text-slate-700 text-sm" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>

          {isAdmin && (
            <div className="mb-3 max-h-36 overflow-y-auto space-y-1 border-b border-slate-100 pb-2">
              <p className="text-[10px] text-slate-400 px-1 mb-1">● En línea / ○ Fuera</p>
              {sortedParticipants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left text-xs px-2 py-1.5 rounded flex justify-between items-center gap-2 ${
                    selectedId === p.id ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${p.online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className="truncate">
                      {p.fullName} · {roleLabel(p.role)}
                    </span>
                  </span>
                  {p.unread > 0 && (
                    <span className="font-bold text-amber-700 ml-2 shrink-0">{p.unread}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {threadId && settings ? (
            <ChatConversation
              participantId={threadId}
              title={title}
              settings={settings}
              onUnreadChange={() => {
                loadUnread();
                loadParticipants();
              }}
              compact
              muteIncomingSound
            />
          ) : (
            <p className="text-sm text-slate-500 py-8 text-center">Seleccione un usuario</p>
          )}
        </div>
      )}
    </div>
  );
}
