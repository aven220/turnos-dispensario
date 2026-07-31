import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { ChatMessage, ChatSettings, ChatThread, Window } from '../types';
import { playChatNotifySound } from '../utils/chatSound';
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

interface ChatConversationProps {
  windowId: string;
  windowLabel?: string;
  relatedTicketOverride?: { displayCode: string } | null;
  settings: ChatSettings;
  onUnreadChange?: () => void;
  compact?: boolean;
}

export function ChatConversation({
  windowId,
  windowLabel,
  relatedTicketOverride,
  settings,
  onUnreadChange,
  compact,
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
    const data = await api<ChatThread>(`/chat/windows/${windowId}`);
    setMessages(data.messages);
    setRelatedTicket(data.relatedTicket);
  }, [windowId]);

  const markRead = useCallback(async () => {
    try {
      await api(`/chat/windows/${windowId}/read`, { method: 'POST', body: '{}' });
      onUnreadChange?.();
    } catch {
      // ignore
    }
  }, [windowId, onUnreadChange]);

  useEffect(() => {
    load().then(() => markRead());
  }, [load, markRead]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onMessage = (msg: ChatMessage & { windowId?: string }) => {
      if (msg.windowId !== windowId) return;
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      if (msg.senderId !== myId && settings.chatSoundEnabled) {
        playChatNotifySound();
      }
      if (msg.senderId !== myId) {
        markRead();
        onUnreadChange?.();
      }
    };

    const onRead = (payload: { windowId: string }) => {
      if (payload.windowId !== windowId) return;
      load();
    };

    socket.on('chat:message', onMessage);
    socket.on('chat:read', onRead);
    return () => {
      socket.off('chat:message', onMessage);
      socket.off('chat:read', onRead);
    };
  }, [token, windowId, myId, settings.chatSoundEnabled, markRead, onUnreadChange, load]);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !settings.chatEnabled) return;
    setSending(true);
    setError('');
    try {
      const msg = await api<ChatMessage>(`/chat/windows/${windowId}`, {
        method: 'POST',
        body: JSON.stringify({ body: text.trim() }),
      });
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar');
    } finally {
      setSending(false);
    }
  }

  const ticketLabel =
    relatedTicketOverride?.displayCode ?? relatedTicket?.displayCode ?? null;

  return (
    <div className={`flex flex-col ${compact ? 'h-[420px]' : 'h-[520px]'}`}>
      {(windowLabel || ticketLabel) && (
        <div className="border-b border-slate-200 pb-2 mb-2 shrink-0">
          {windowLabel && <p className="text-sm font-semibold text-slate-800">{windowLabel}</p>}
          {ticketLabel && (
            <p className="text-xs font-medium text-emerald-700 mt-0.5">
              Turno relacionado: {ticketLabel}
            </p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">Sin mensajes aún</p>
        )}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                  mine ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {!mine && (
                  <p className={`text-[10px] font-semibold mb-0.5 ${mine ? 'text-blue-100' : 'text-slate-500'}`}>
                    {m.sender.fullName}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <div className={`flex items-center gap-2 mt-1 text-[10px] ${mine ? 'text-blue-100' : 'text-slate-400'}`}>
                  <span>{formatMsgTime(m.createdAt)}</span>
                  {m.ticketDisplayCode && <span>· {m.ticketDisplayCode}</span>}
                  {mine && <span>{m.readAt ? 'Leído' : 'Enviado'}</span>}
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
          placeholder={settings.chatEnabled ? 'Escriba un mensaje...' : 'Chat desactivado'}
          maxLength={1000}
          disabled={!settings.chatEnabled || sending}
        />
        <Button type="submit" disabled={!settings.chatEnabled || sending || !text.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}

interface AdminChatPanelProps {
  windows: Window[];
}

export function AdminChatPanel({ windows }: AdminChatPanelProps) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    const s = await api<ChatSettings>('/chat/settings');
    setSettings(s);
  }, []);

  const loadUnread = useCallback(async () => {
    const data = await api<{ total: number; byWindow: { windowId: string; count: number }[] }>('/chat/unread');
    const map: Record<string, number> = {};
    data.byWindow.forEach((w) => {
      map[w.windowId] = w.count;
    });
    setUnread(map);
  }, []);

  useEffect(() => {
    loadSettings();
    loadUnread();
  }, [loadSettings, loadUnread]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onMsg = (msg: ChatMessage & { windowId?: string }) => {
      const wid = msg.windowId;
      if (!wid) return;
      if (msg.sender?.role === 'WINDOW') {
        setUnread((prev) => ({ ...prev, [wid]: (prev[wid] ?? 0) + (selectedId === wid ? 0 : 1) }));
        if (settings?.chatSoundEnabled && selectedId !== wid) {
          playChatNotifySound();
        }
      }
    };
    const onSettings = (s: ChatSettings) => setSettings(s);
    socket.on('chat:message', onMsg);
    socket.on('chat:settings-updated', onSettings);
    return () => {
      socket.off('chat:message', onMsg);
      socket.off('chat:settings-updated', onSettings);
    };
  }, [token, settings?.chatSoundEnabled, selectedId]);

  async function saveSettings(patch: Partial<ChatSettings>) {
    setSaving(true);
    try {
      const s = await api<ChatSettings>('/chat/settings', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setSettings(s);
    } finally {
      setSaving(false);
    }
  }

  const activeWindows = [...windows].sort((a, b) => a.number - b.number);
  const selected = activeWindows.find((w) => w.id === selectedId);

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
          Si desactiva el chat, el botón desaparece en las ventanillas. El historial se conserva.
        </p>
      </Card>

      {!settings?.chatEnabled ? (
        <Card>
          <p className="text-sm text-slate-600">El chat está desactivado. Active la opción arriba para usarlo.</p>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 !p-4">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Ventanillas</p>
            <ul className="space-y-1 max-h-[480px] overflow-y-auto">
              {activeWindows.map((w) => (
                <li key={w.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(w.id);
                      setUnread((prev) => ({ ...prev, [w.id]: 0 }));
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm flex justify-between items-center ${
                      selectedId === w.id ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'
                    }`}
                  >
                    <span>
                      {w.name}
                      <span className={selectedId === w.id ? 'text-blue-100' : 'text-slate-500'}> · Vent. {w.number}</span>
                    </span>
                    {(unread[w.id] ?? 0) > 0 && (
                      <span className="ml-2 text-xs font-bold bg-amber-400 text-amber-950 rounded-full px-2 py-0.5">
                        {unread[w.id]}
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
                windowId={selected.id}
                windowLabel={`${selected.name} (Vent. ${selected.number})`}
                settings={settings}
                onUnreadChange={loadUnread}
              />
            ) : (
              <p className="text-sm text-slate-500 py-16 text-center">Seleccione una ventanilla para chatear</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

interface WindowChatWidgetProps {
  windowId: string;
  relatedTicketDisplayCode?: string | null;
}

export function WindowChatWidget({ windowId, relatedTicketDisplayCode }: WindowChatWidgetProps) {
  const { token } = useAuth();
  const [settings, setSettings] = useState<ChatSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadSettings = useCallback(async () => {
    try {
      const s = await api<ChatSettings>('/chat/settings');
      setSettings(s);
    } catch {
      setSettings(null);
    }
  }, []);

  const loadUnread = useCallback(async () => {
    try {
      const data = await api<{ total: number }>(`/chat/unread?windowId=${windowId}`);
      setUnread(data.total);
    } catch {
      setUnread(0);
    }
  }, [windowId]);

  useEffect(() => {
    loadSettings();
    loadUnread();
  }, [loadSettings, loadUnread]);

  useEffect(() => {
    const socket = getSocket(token ?? undefined);
    const onSettings = (s: ChatSettings) => setSettings(s);
    const onMsg = (msg: ChatMessage & { windowId?: string }) => {
      if (msg.windowId && msg.windowId !== windowId) return;
      if (msg.sender?.role !== 'ADMIN') return;
      if (!open) {
        setUnread((n) => n + 1);
        if (settings?.chatSoundEnabled) playChatNotifySound();
      }
    };
    socket.on('chat:settings-updated', onSettings);
    socket.on('chat:message', onMsg);
    return () => {
      socket.off('chat:settings-updated', onSettings);
      socket.off('chat:message', onMsg);
    };
  }, [token, windowId, open, settings?.chatSoundEnabled]);

  if (!settings?.chatEnabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            setUnread(0);
          }
        }}
        className="fixed bottom-5 right-5 z-40 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg px-5 py-3 text-sm font-semibold flex items-center gap-2"
      >
        Chat
        {unread > 0 && (
          <span className="bg-amber-400 text-amber-950 text-xs font-bold rounded-full min-w-[1.25rem] h-5 px-1.5 flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[min(100vw-2rem,24rem)] bg-white rounded-xl shadow-2xl border border-slate-200 p-4">
          <div className="flex justify-between items-center mb-2">
            <p className="font-semibold text-slate-800 text-sm">Chat con administración</p>
            <button type="button" className="text-slate-400 hover:text-slate-700 text-sm" onClick={() => setOpen(false)}>
              Cerrar
            </button>
          </div>
          <ChatConversation
            windowId={windowId}
            relatedTicketOverride={relatedTicketDisplayCode ? { displayCode: relatedTicketDisplayCode } : null}
            settings={settings}
            onUnreadChange={loadUnread}
            compact
          />
        </div>
      )}
    </>
  );
}
