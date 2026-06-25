import { useCallback, useEffect, useState } from 'react';
import { useTurnoActualHighlight } from '../hooks/useTurnoActualHighlight';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import type { Ticket, TvDisplay } from '../types';
import { buildCallMessage, enqueueCallSpeech, initSpeech, normalizeVoicePreset, setSpeechSettings } from '../utils/speech';
import { isYoutubeUrl, youtubeEmbedUrl } from '../utils/media';
import { removePendingCall, sortPendingCalls, upsertPendingCall } from '../utils/tvCalls';
import { tvScaledFontSize } from '../utils/tvTypography';

function announceTicket(ticket: Ticket) {
  if (!ticket.window) return;
  const key = `${ticket.id}-${ticket.callCount}`;
  const msg = buildCallMessage(ticket.displayCode, ticket.window.number, ticket.callCount);
  enqueueCallSpeech(key, msg);
}

function RecentCallRow({ ticket }: { ticket: Ticket }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:gap-4 bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
      <p className="font-black text-yellow-300 shrink-0 text-[clamp(1rem,4vmin,1.5rem)]">{ticket.displayCode}</p>
      <p className="text-slate-400 font-semibold text-[clamp(0.7rem,2vmin,0.875rem)] uppercase shrink-0">
        {ticket.priority.code}
      </p>
      <p className="text-emerald-400 font-semibold text-[clamp(0.8rem,2.5vmin,1rem)] truncate">
        Vent. {ticket.window?.number}
      </p>
    </div>
  );
}

function getAttendingScale(count: number): number {
  if (count <= 1) return 1;
  return Math.max(0.72, 1 - (count - 1) * 0.035);
}

function AttendingSection({ tickets }: { tickets: Ticket[] }) {
  const scale = getAttendingScale(tickets.length);

  return (
    <section className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:min-w-0">
      <h3 className="font-semibold text-slate-400 mb-3 sm:mb-4 uppercase tracking-wide text-[clamp(0.75rem,2vw,1rem)]">
        En atención
      </h3>
      {tickets.length > 0 ? (
        <div className="space-y-2 sm:space-y-3 origin-top" style={{ zoom: scale }}>
          {tickets.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-3 sm:gap-4 bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-3 sm:px-5 sm:py-4 min-w-0"
            >
              <div className="min-w-0">
                <p className="font-black text-yellow-300 text-[clamp(1.25rem,5vmin,1.875rem)] leading-none">
                  {t.displayCode}
                </p>
                <p className="text-emerald-400 uppercase tracking-wide font-semibold text-[clamp(0.75rem,2.5vw,0.875rem)] mt-1 sm:mt-2 truncate">
                  Ventanilla {t.window?.number}
                </p>
              </div>
              <p className="text-slate-400 font-bold shrink-0 text-[clamp(0.875rem,2.5vw,1.125rem)] uppercase">
                {t.priority.code}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500 text-[clamp(0.75rem,2vw,0.875rem)]">
          No hay ventanillas atendiendo en este momento
        </p>
      )}
    </section>
  );
}

export function TvPage() {
  const [display, setDisplay] = useState<TvDisplay | null>(null);
  const [pendingCalls, setPendingCalls] = useState<Ticket[]>([]);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const { highlighted, highlight, clearIfTicket } = useTurnoActualHighlight();

  const load = useCallback(async () => {
    const data = await api<TvDisplay>('/tv/display');
    setDisplay(data);
    setPendingCalls(sortPendingCalls(data.pendingCalls));
  }, []);

  const handleCallEvent = useCallback(
    (ticket: Ticket) => {
      setPendingCalls((prev) => upsertPendingCall(prev, ticket));
      setDisplay((prev) =>
        prev ? { ...prev, upcoming: prev.upcoming.filter((t) => t.id !== ticket.id) } : prev
      );
      highlight(ticket);
      announceTicket(ticket);
    },
    [highlight]
  );

  const handleTicketRemoved = useCallback(
    (ticket: Ticket) => {
      setPendingCalls((prev) => removePendingCall(prev, ticket.id));
      clearIfTicket(ticket.id);
    },
    [clearIfTicket]
  );

  const handleAttending = useCallback(
    (ticket: Ticket) => {
      handleTicketRemoved(ticket);
      setDisplay((prev) => {
        if (!prev) return prev;
        const attending = prev.attending.filter((t) => t.id !== ticket.id);
        attending.push(ticket);
        attending.sort((a, b) => (a.window?.number ?? 0) - (b.window?.number ?? 0));
        return { ...prev, attending };
      });
    },
    [handleTicketRemoved]
  );

  const handleAttendingEnded = useCallback(
    (ticket: Ticket) => {
      handleTicketRemoved(ticket);
      setDisplay((prev) =>
        prev ? { ...prev, attending: prev.attending.filter((t) => t.id !== ticket.id) } : prev
      );
    },
    [handleTicketRemoved]
  );

  useEffect(() => {
    if (!display?.settings) return;
    setSpeechSettings({
      rate: display.settings.speechRate ?? 0.9,
      voiceName: normalizeVoicePreset(display.settings.speechVoice),
      lang: 'es-ES',
    });
  }, [display?.settings]);

  useEffect(() => {
    initSpeech();
    load();
    const socket = getSocket();
    socket.emit('join:tv');

    const refresh = () => load();

    socket.on('ticket:called', handleCallEvent);
    socket.on('ticket:repeated', handleCallEvent);
    socket.on('ticket:attending', handleAttending);
    socket.on('ticket:finished', handleAttendingEnded);
    socket.on('ticket:absent', handleAttendingEnded);
    socket.on('ticket:created', refresh);
    socket.on('tv:media-updated', refresh);
    socket.on('tv:ticker-updated', refresh);
    socket.on('tv:settings-updated', refresh);

    return () => {
      socket.off('ticket:called', handleCallEvent);
      socket.off('ticket:repeated', handleCallEvent);
      socket.off('ticket:attending', handleAttending);
      socket.off('ticket:finished', handleAttendingEnded);
      socket.off('ticket:absent', handleAttendingEnded);
      socket.off('ticket:created', refresh);
      socket.off('tv:media-updated', refresh);
      socket.off('tv:ticker-updated', refresh);
      socket.off('tv:settings-updated', refresh);
    };
  }, [load, handleCallEvent, handleAttending, handleAttendingEnded]);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    if (!display?.media.length) return;
    const current = display.media[mediaIndex];
    const duration = current?.type === 'VIDEO' ? 30000 : 8000;
    const timer = setTimeout(() => {
      setMediaIndex((i) => (i + 1) % display.media.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [display?.media, mediaIndex]);

  if (!display) {
    return (
      <div className="h-dvh min-h-dvh bg-slate-900 flex items-center justify-center text-white text-[clamp(1rem,4vw,1.5rem)] px-4">
        Cargando...
      </div>
    );
  }

  const currentMedia = display.media[mediaIndex];
  const tickerText = display.ticker.map((t) => t.message).join('   ·   ');
  const upcomingCount = display.settings?.upcomingCount ?? 3;
  const welcomeMessage = display.settings?.welcomeMessage ?? 'BIENVENIDOS A CENCOIC';
  const welcomeFontScale = display.settings?.welcomeFontScale ?? 1;
  const tickerFontScale = display.settings?.tickerFontScale ?? 1;
  const welcomeFontSize = tvScaledFontSize(1, 3.5, 2.25, welcomeFontScale);
  const tickerFontSize = tvScaledFontSize(0.875, 2.5, 1.125, tickerFontScale);
  const highlightedId = highlighted?.ticket.id;
  const recentCalls = pendingCalls.filter((t) => t.id !== highlightedId);

  return (
    <div className="h-dvh min-h-dvh max-h-dvh bg-slate-900 text-white flex flex-col overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 border-b border-blue-600 py-3 sm:py-4 lg:py-5 px-4 sm:px-6 text-center">
        <h1
          className="font-bold uppercase text-white tracking-[0.08em] sm:tracking-[0.15em] lg:tracking-[0.2em] leading-tight break-words"
          style={{ fontSize: welcomeFontSize }}
        >
          {welcomeMessage}
        </h1>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
        <section className="shrink-0 lg:shrink lg:w-[32%] lg:min-w-0 flex flex-col min-h-0 border-b lg:border-b-0 lg:border-r border-slate-700 overflow-hidden">
          <div className="shrink-0 flex flex-col justify-center items-center px-4 py-4 sm:p-6">
            <p className="text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 text-[clamp(0.75rem,2vw,1.125rem)]">
              Turno actual
            </p>
            {highlighted ? (
              <div key={highlighted.key} className="tv-call-spotlight flex flex-col items-center justify-center text-center w-full">
                <p className="font-black leading-none text-yellow-400 text-[clamp(2.5rem,12vmin,6rem)]">
                  {highlighted.ticket.displayCode}
                </p>
                <p className="mt-2 sm:mt-4 text-emerald-400 text-[clamp(1.125rem,4vmin,1.875rem)]">
                  Ventanilla {highlighted.ticket.window?.number}
                </p>
                <p className="mt-1 text-slate-400 uppercase tracking-widest text-[clamp(0.875rem,2.5vmin,1.25rem)] font-bold">
                  {highlighted.ticket.priority.code}
                </p>
                {highlighted.ticket.callCount > 1 && (
                  <p className="mt-2 text-amber-300/80 text-[clamp(0.7rem,1.8vmin,0.875rem)] uppercase tracking-wide">
                    Llamada {highlighted.ticket.callCount}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-slate-500 text-[clamp(1rem,3vmin,1.5rem)]">En espera...</p>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 border-t border-slate-700/60">
            <h3 className="font-semibold text-slate-400 my-3 sm:my-4 uppercase tracking-wide text-[clamp(0.7rem,1.8vw,0.875rem)]">
              Últimos llamados
            </h3>
            {recentCalls.length > 0 ? (
              <div className="space-y-2">
                {recentCalls.map((t) => (
                  <RecentCallRow key={t.id} ticket={t} />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-[clamp(0.7rem,1.8vw,0.8rem)]">
                No hay turnos llamados pendientes
              </p>
            )}
          </div>
        </section>

        <section className="h-[22vh] sm:h-[28vh] md:h-[32vh] lg:h-auto lg:flex-1 lg:min-h-0 lg:w-[38%] lg:max-w-[38%] flex flex-col border-b lg:border-b-0 lg:border-r border-slate-700 overflow-hidden">
          <div className="flex-1 relative bg-black min-h-0 overflow-hidden">
            {currentMedia ? (
              currentMedia.type === 'VIDEO' && isYoutubeUrl(currentMedia.url) ? (
                <iframe
                  key={currentMedia.id}
                  src={youtubeEmbedUrl(currentMedia.url)!}
                  title={currentMedia.title}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : currentMedia.type === 'VIDEO' ? (
                <video
                  key={currentMedia.id}
                  src={currentMedia.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <img
                  key={currentMedia.id}
                  src={currentMedia.url}
                  alt={currentMedia.title}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-600 text-[clamp(0.875rem,2.5vw,1.125rem)] px-4 text-center">
                Sin contenido multimedia
              </div>
            )}
          </div>
          <div className="shrink-0 border-t border-slate-700 bg-slate-900/90 px-4 py-2 sm:py-3 text-center">
            <p className="font-semibold text-white tabular-nums text-[clamp(1.25rem,4vw,2rem)] tracking-wide">
              {now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
            <p className="text-slate-400 capitalize text-[clamp(0.7rem,2vw,0.875rem)]">
              {now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </section>

        <AttendingSection tickets={display.attending} />
      </div>

      {upcomingCount > 0 && (
        <div className="shrink-0 border-t border-slate-700 bg-slate-800/80 px-4 sm:px-6 py-3 sm:py-4 text-center">
          <h3 className="font-semibold text-slate-400 uppercase tracking-wide mb-2 sm:mb-3 text-[clamp(0.7rem,2vw,0.875rem)]">
            Próximos turnos
          </h3>
          {display.upcoming.length > 0 ? (
            <div className="flex flex-wrap justify-center items-stretch gap-2 sm:gap-4">
              {display.upcoming.map((t, i) => (
                <div
                  key={t.id}
                  className="flex items-center justify-center gap-2 sm:gap-3 bg-slate-900/60 border border-slate-600 rounded-xl px-3 py-2 sm:px-5 sm:py-3 flex-1 min-w-[120px] max-w-[220px]"
                >
                  <span className="text-slate-500 font-bold w-5 sm:w-6 text-center text-[clamp(0.875rem,2.5vw,1.125rem)] shrink-0">
                    {i + 1}
                  </span>
                  <div className="text-center min-w-0">
                    <p className="font-bold text-amber-300 text-[clamp(1rem,4vmin,1.5rem)]">{t.displayCode}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-[clamp(0.75rem,2vw,0.875rem)]">No hay turnos en espera</p>
          )}
        </div>
      )}

      <footer className="shrink-0 bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 border-t border-blue-600 py-2 sm:py-3 overflow-hidden">
        <div
          className="animate-marquee whitespace-nowrap font-semibold text-white tracking-wide"
          style={{ fontSize: tickerFontSize }}
        >
          <span className="inline-block px-4">{tickerText || 'Bienvenido al dispensario'}</span>
          <span className="inline-block px-4">{tickerText}</span>
        </div>
      </footer>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 30s linear infinite;
        }
        @keyframes tv-call-spotlight {
          0% {
            opacity: 0;
            transform: scale(0.82);
          }
          18% {
            opacity: 1;
            transform: scale(1.1);
          }
          35% {
            transform: scale(1);
          }
          55% {
            box-shadow: inset 0 0 0 0 rgba(250, 204, 21, 0);
            background-color: rgba(30, 58, 138, 0.15);
          }
          70% {
            box-shadow: inset 0 0 80px rgba(250, 204, 21, 0.25);
            background-color: rgba(30, 58, 138, 0.35);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            box-shadow: inset 0 0 0 rgba(250, 204, 21, 0);
            background-color: transparent;
          }
        }
        .tv-call-spotlight {
          animation: tv-call-spotlight 5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
