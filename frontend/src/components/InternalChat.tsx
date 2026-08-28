import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, apiBlob, apiUpload } from '../services/api';
import { getSocket } from '../services/socket';
import type { ChatMessage, ChatParticipant, ChatSettings, ChatThread } from '../types';
import { playChatNotifySound, unlockChatSound } from '../utils/chatSound';
import { formatBogotaDateTime } from '../utils/datetime';
import { isAllowedChatImageType, prepareChatImage } from '../utils/prepareChatImage';
import { Button, Card } from './Layout';

function formatMsgTime(iso: string): string {
  return formatBogotaDateTime(iso);
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

const IMAGE_BODY_MARKERS = new Set(['[imagen]', '📷 imagen', '📷imagen', 'imagen']);

/** Detecta mensaje con imagen aunque falte el flag hasImage (p. ej. payload antiguo). */
function messageHasImage(m: ChatMessage & { imagePath?: string | null }): boolean {
  if (m.hasImage) return true;
  if (m.imagePath) return true;
  const body = (m.body || '').trim().toLowerCase();
  return IMAGE_BODY_MARKERS.has(body);
}

function normalizeChatMessage(m: ChatMessage): ChatMessage {
  return { ...m, hasImage: messageHasImage(m) };
}

function isImageOnlyBody(body: string): boolean {
  const b = body.trim().toLowerCase();
  return !b || IMAGE_BODY_MARKERS.has(b) || b === '📷 imagen';
}

function ChatImageThumb({
  messageId,
  mine,
  onOpen,
}: {
  messageId: string;
  mine: boolean;
  onOpen: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    (async () => {
      try {
        const blob = await apiBlob(`/chat/messages/${messageId}/image`);
        if (cancelled) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setUrl(objectUrl);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [messageId, retryKey]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, []);

  if (failed) {
    return (
      <button
        type="button"
        className={`text-xs underline mt-1 ${mine ? 'text-blue-100' : 'text-slate-600'}`}
        onClick={() => setRetryKey((k) => k + 1)}
      >
        No se pudo cargar la imagen — reintentar
      </button>
    );
  }
  if (loading || !url) {
    return <p className={`text-xs ${mine ? 'text-blue-100' : 'text-slate-400'}`}>Cargando imagen…</p>;
  }

  return (
    <button
      type="button"
      className="block mt-1 mb-1 rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-300"
      onClick={() => onOpen(url)}
      title="Ver imagen"
    >
      <img
        src={url}
        alt="Imagen del chat"
        className="max-w-full max-h-40 object-contain bg-black/10"
        loading="lazy"
      />
    </button>
  );
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
  /** Solo admin: eliminar conversación completa. */
  onDeleteThread?: () => void;
  deletingThread?: boolean;
}

export function ChatConversation({
  participantId,
  title,
  relatedTicketOverride,
  settings,
  onUnreadChange,
  compact,
  muteIncomingSound,
  onDeleteThread,
  deletingThread,
}: ChatConversationProps) {
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [relatedTicket, setRelatedTicket] = useState<{ id: string; displayCode: string } | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const myId = user?.id;
  const loadSeqRef = useRef(0);
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;

  const load = useCallback(async () => {
    if (!participantId) {
      setError('No se pudo identificar la conversación. Cierre sesión y vuelva a entrar.');
      return;
    }
    const seq = ++loadSeqRef.current;
    try {
      const data = await api<ChatThread>(`/chat/threads/${participantId}`);
      if (seq !== loadSeqRef.current) return;
      setMessages(data.messages.map(normalizeChatMessage));
      setRelatedTicket(data.relatedTicket);
      setError('');
    } catch (err) {
      if (seq !== loadSeqRef.current) return;
      const msg = err instanceof Error ? err.message : 'No se pudo cargar el chat';
      // Al cambiar de chat la petición anterior puede abortar: no mostrar eso
      if (/failed to fetch|networkerror|abort/i.test(msg)) return;
      setError(msg);
    }
  }, [participantId]);

  const markRead = useCallback(async () => {
    if (!participantId) return;
    try {
      await api(`/chat/threads/${participantId}/read`, { method: 'POST', body: '{}' });
      onUnreadChangeRef.current?.();
    } catch {
      // ignore
    }
  }, [participantId]);

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

  // Carga inicial solo al cambiar de conversación (evita bucle de re-renders del admin)
  useEffect(() => {
    loadSeqRef.current += 1;
    setMessages([]);
    setRelatedTicket(null);
    setError('');
    setText('');
    setLightboxUrl(null);
    void load().then(() => markRead());
    return () => {
      loadSeqRef.current += 1;
    };
  }, [participantId, load, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onMessage = (msg: ChatMessage) => {
      if (msg.participantId !== participantId) return;
      const normalized = normalizeChatMessage(msg);
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === normalized.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = normalizeChatMessage({ ...prev[idx], ...normalized });
          return next;
        }
        return [...prev, normalized];
      });
      if (normalized.senderId !== myId) {
        if (!muteIncomingSound && settings.chatSoundEnabled) playChatNotifySound();
        ackDelivered(normalized);
        markRead();
        onUnreadChangeRef.current?.();
      }
    };
    // Solo actualizar estado local "Leído" — no recargar todo el hilo (evita parpadeo)
    const onRead = (payload: { participantId: string }) => {
      if (payload.participantId !== participantId) return;
      const now = new Date().toISOString();
      setMessages((prev) =>
        prev.map((m) => (m.senderId === myId && !m.readAt ? { ...m, readAt: now } : m))
      );
    };
    const onDelivered = (payload: { id: string; participantId: string; deliveredAt: string }) => {
      if (payload.participantId !== participantId) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === payload.id ? { ...m, deliveredAt: payload.deliveredAt } : m))
      );
    };
    const onDeleted = (payload: { participantId: string }) => {
      if (payload.participantId !== participantId) return;
      setMessages([]);
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    socket.on('chat:delivered', onDelivered);
    socket.on('chat:thread-deleted', onDeleted);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
      socket.off('chat:delivered', onDelivered);
      socket.off('chat:thread-deleted', onDeleted);
    };
  }, [
    token,
    participantId,
    myId,
    settings.chatSoundEnabled,
    muteIncomingSound,
    markRead,
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
      const normalized = normalizeChatMessage(msg);
      setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized]));
      setText('');
      onUnreadChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file || !settings.chatEnabled) return;
    if (!participantId || !myId) {
      setError('Sesión inválida. Cierre sesión y vuelva a entrar.');
      return;
    }
    if (!isAllowedChatImageType(file)) {
      setError('Formato no permitido. Use JPG, PNG o WEBP.');
      return;
    }
    unlockChatSound();
    setSending(true);
    setError('');
    try {
      const prepared = await prepareChatImage(file);
      const fd = new FormData();
      fd.append('image', prepared);
      const caption = text.trim();
      if (caption) fd.append('caption', caption);
      const msg = await apiUpload<ChatMessage>(`/chat/threads/${participantId}/image`, fd);
      const normalized = normalizeChatMessage(msg);
      setMessages((prev) => (prev.some((m) => m.id === normalized.id) ? prev : [...prev, normalized]));
      setText('');
      onUnreadChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la imagen');
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const ticketLabel = relatedTicketOverride?.displayCode ?? relatedTicket?.displayCode ?? null;

  return (
    <div className={`flex flex-col ${compact ? 'h-[380px]' : 'h-[520px]'}`}>
      {(title || ticketLabel || onDeleteThread) && (
        <div className="border-b border-slate-200 pb-2 mb-2 shrink-0 flex items-start justify-between gap-2">
          <div className="min-w-0">
            {title && <p className="text-sm font-semibold text-slate-800">{title}</p>}
            {ticketLabel && (
              <p className="text-xs font-medium text-emerald-700 mt-0.5">Turno relacionado: {ticketLabel}</p>
            )}
          </div>
          {onDeleteThread && (
            <button
              type="button"
              disabled={deletingThread}
              onClick={onDeleteThread}
              className="shrink-0 text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
            >
              Eliminar conversación
            </button>
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
          const hasImage = messageHasImage(m);
          const showText = Boolean(m.body && !isImageOnlyBody(m.body));
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
                {hasImage && (
                  <ChatImageThumb messageId={m.id} mine={mine} onOpen={setLightboxUrl} />
                )}
                {showText && (
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                )}
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

      <form onSubmit={handleSend} className="mt-2 flex gap-2 shrink-0 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => handleImageSelected(e.target.files?.[0])}
        />
        <button
          type="button"
          title="Adjuntar imagen (máx. 1 MB) — Admin y ventanilla"
          disabled={!settings.chatEnabled || sending || !participantId}
          onClick={() => fileInputRef.current?.click()}
          className="shrink-0 px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Imagen
        </button>
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

      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[300] bg-black/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white text-sm bg-black/40 px-3 py-1.5 rounded-lg"
            onClick={() => setLightboxUrl(null)}
          >
            Cerrar
          </button>
          <img
            src={lightboxUrl}
            alt="Vista ampliada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function AdminChatPanel() {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [storageLabel, setStorageLabel] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setSettings(await api<ChatSettings>('/chat/settings'));
  }, []);

  const loadParticipants = useCallback(async () => {
    const list = await api<ChatParticipant[]>('/chat/participants');
    setParticipants(list);
  }, []);

  const loadStorage = useCallback(async () => {
    try {
      const data = await api<{ bytesLabel: string }>('/chat/storage');
      setStorageLabel(data.bytesLabel);
    } catch {
      setStorageLabel(null);
    }
  }, []);

  const refreshParticipants = useCallback(() => {
    void loadParticipants();
  }, [loadParticipants]);

  useEffect(() => {
    loadSettings();
    loadParticipants();
    loadStorage();
  }, [loadSettings, loadParticipants, loadStorage]);

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
                lastMessage: { body: msg.body, createdAt: msg.createdAt, hasImage: msg.hasImage },
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
    const onDeleted = (payload: { participantId: string }) => {
      setParticipants((prev) =>
        prev.map((p) =>
          p.id === payload.participantId ? { ...p, unread: 0, lastMessage: null } : p
        )
      );
      loadStorage();
    };
    socket.on('chat:message', onMsg);
    socket.on('chat:settings-updated', onSettings);
    socket.on('chat:presence', onPresence);
    socket.on('chat:presence-sync', onPresenceSync);
    socket.on('chat:thread-deleted', onDeleted);
    const onRead = (payload: { participantId: string }) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === payload.participantId ? { ...p, unread: 0 } : p))
      );
    };
    socket.on('chat:read', onRead);
    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:settings-updated', onSettings);
      socket.off('chat:presence', onPresence);
      socket.off('chat:presence-sync', onPresenceSync);
      socket.off('chat:thread-deleted', onDeleted);
      socket.off('chat:read', onRead);
    };
  }, [token, selectedId, loadStorage]);

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

  async function handleDeleteThread() {
    if (!selectedId) return;
    const ok = window.confirm('¿Está seguro de eliminar esta conversación?');
    if (!ok) return;
    setDeleting(true);
    try {
      await api(`/chat/threads/${selectedId}`, { method: 'DELETE' });
      setParticipants((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, unread: 0, lastMessage: null } : p))
      );
      await loadStorage();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo eliminar la conversación');
    } finally {
      setDeleting(false);
    }
  }

  const selected = participants.find((p) => p.id === selectedId);
  const sortedParticipants = [...participants].sort((a, b) => {
    const au = a.unread > 0 ? 1 : 0;
    const bu = b.unread > 0 ? 1 : 0;
    if (au !== bu) return bu - au;
    if (!!a.online !== !!b.online) return a.online ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, 'es');
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
          {storageLabel && (
            <p className="text-sm text-slate-600">
              Chat: <span className="font-semibold">{storageLabel}</span>
            </p>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Cada usuario solo chatea con el Administrador. Imágenes máx. 1 MB (JPG/PNG/WEBP). Puede
          eliminar conversaciones para liberar espacio.
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
            <p className="text-[11px] text-slate-400 mb-2">
              ● Verde = en línea · Insignia = sin leer (se conserva por chat)
            </p>
            <ul className="space-y-1 max-h-[480px] overflow-y-auto">
              {sortedParticipants.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(p.id);
                      setParticipants((prev) =>
                        prev.map((x) => (x.id === p.id ? { ...x, unread: 0 } : x))
                      );
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
                key={selected.id}
                participantId={selected.id}
                title={`${selected.fullName} · ${roleLabel(selected.role)}`}
                settings={settings}
                onUnreadChange={refreshParticipants}
                onDeleteThread={handleDeleteThread}
                deletingThread={deleting}
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
  const [flash, setFlash] = useState(false);
  const isAdmin = user?.role === 'ADMIN';
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  useEffect(() => {
    if (!token) return;
    getSocket(token);
    loadSettings();
    loadUnread();
  }, [token, loadSettings, loadUnread]);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);

    const onSettings = (s: ChatSettings) => setSettings(s);

    const onMsg = (msg: ChatMessage) => {
      if (!msg?.participantId || !msg?.senderId) return;

      const forMe = isAdmin
        ? msg.senderId !== user.id && msg.sender?.role !== 'ADMIN'
        : msg.participantId === user.id && msg.senderId !== user.id;

      if (!forMe) return;

      if (settings?.chatSoundEnabled !== false) playChatNotifySound();
      setFlash(true);
      setTimeout(() => setFlash(false), 1500);
      loadUnread();

      if (!isAdmin) {
        setOpen(true);
      }

      if (msg.senderId !== user.id) {
        api(`/chat/messages/${msg.id}/delivered`, { method: 'POST', body: '{}' }).catch(() => undefined);
      }
    };

    const onDeleted = (payload: { participantId: string }) => {
      if (!isAdmin && payload.participantId === user.id) {
        loadUnread();
      }
    };

    socket.on('chat:settings-updated', onSettings);
    socket.on('chat:message', onMsg);
    socket.on('chat:read', loadUnread);
    socket.on('chat:thread-deleted', onDeleted);
    return () => {
      socket.off('chat:settings-updated', onSettings);
      socket.off('chat:message', onMsg);
      socket.off('chat:read', loadUnread);
      socket.off('chat:thread-deleted', onDeleted);
    };
  }, [token, user, isAdmin, settings?.chatSoundEnabled, loadUnread]);

  if (!user || !settings?.chatEnabled) return null;

  if (isAdmin) {
    return (
      <button
        type="button"
        title="Ir a Chat interno"
        onClick={() => {
          unlockChatSound();
          window.dispatchEvent(new CustomEvent('admin:open-chat'));
          if (!window.location.pathname.startsWith('/admin')) {
            window.location.assign('/admin?tab=chat');
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
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          unlockChatSound();
          setOpen((v) => !v);
          if (!openRef.current) loadUnread();
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
            <p className="font-semibold text-sm">Chat con administración</p>
            <button type="button" className="text-slate-400 hover:text-slate-700 text-sm" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          {settings && (
            <ChatConversation
              participantId={user.id}
              title="Chat con administración"
              settings={settings}
              onUnreadChange={loadUnread}
              compact
              muteIncomingSound
            />
          )}
        </div>
      )}
    </div>
  );
}
