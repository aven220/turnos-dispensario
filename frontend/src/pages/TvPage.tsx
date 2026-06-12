import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { getSocket } from '../services/socket';
import { buildCallMessage, enqueueCallSpeech, initSpeech } from '../utils/speech';
import { isYoutubeUrl, youtubeEmbedUrl } from '../utils/media';
import type { Ticket, TvDisplay } from '../types';

function announceTicket(ticket: Ticket) {
  if (!ticket.window) return;
  const key = `${ticket.id}-${ticket.callCount}`;
  const msg = buildCallMessage(ticket.displayCode, ticket.priority.code, ticket.window.number, ticket.callCount, ticket.priority.name);
  enqueueCallSpeech(key, msg);
}

export function TvPage() {
  const [display, setDisplay] = useState<TvDisplay | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);

  const load = useCallback(async () => {
    const data = await api<TvDisplay>('/tv/display');
    setDisplay(data);
  }, []);

  useEffect(() => {
    initSpeech();
    load();
    const socket = getSocket();
    socket.emit('join:tv');

    const onCalled = (ticket: Ticket) => {
      setDisplay((prev) =>
        prev
          ? {
              ...prev,
              currentCall: ticket,
              upcoming: prev.upcoming.filter((t) => t.id !== ticket.id),
            }
          : prev
      );
      announceTicket(ticket);
    };

    const onRepeated = (ticket: Ticket) => {
      announceTicket(ticket);
      setDisplay((prev) => (prev?.currentCall?.id === ticket.id ? { ...prev, currentCall: ticket } : prev));
    };

    const refresh = () => load();

    socket.on('ticket:called', onCalled);
    socket.on('ticket:repeated', onRepeated);
    socket.on('ticket:created', refresh);
    socket.on('ticket:attending', refresh);
    socket.on('ticket:finished', refresh);
    socket.on('ticket:absent', refresh);
    socket.on('tv:media-updated', refresh);
    socket.on('tv:ticker-updated', refresh);
    socket.on('tv:settings-updated', refresh);

    return () => {
      socket.off('ticket:called', onCalled);
      socket.off('ticket:repeated', onRepeated);
      socket.off('ticket:created', refresh);
      socket.off('ticket:attending', refresh);
      socket.off('ticket:finished', refresh);
      socket.off('ticket:absent', refresh);
      socket.off('tv:media-updated', refresh);
      socket.off('tv:ticker-updated', refresh);
      socket.off('tv:settings-updated', refresh);
    };
  }, [load]);

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

  return (
    <div className="h-dvh min-h-dvh max-h-dvh bg-slate-900 text-white flex flex-col overflow-hidden">
      <header className="shrink-0 bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 border-b border-blue-600 py-3 sm:py-4 lg:py-5 px-4 sm:px-6 text-center">
        <h1 className="font-bold uppercase text-white text-[clamp(1rem,3.5vw,2.25rem)] tracking-[0.08em] sm:tracking-[0.15em] lg:tracking-[0.2em] leading-tight break-words">
          {welcomeMessage}
        </h1>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-hidden">
        <section className="shrink-0 lg:shrink lg:w-[32%] lg:min-w-0 flex flex-col justify-center items-center px-4 py-4 sm:p-6 border-b lg:border-b-0 lg:border-r border-slate-700">
          <p className="text-slate-400 uppercase tracking-widest mb-2 sm:mb-3 text-[clamp(0.75rem,2vw,1.125rem)]">
            Turno actual
          </p>
          {display.currentCall ? (
            <>
              <p className="font-black leading-none text-yellow-400 text-[clamp(2.5rem,12vmin,6rem)]">
                {display.currentCall.displayCode}
              </p>
              <p className="mt-2 sm:mt-4 text-emerald-400 text-[clamp(1.125rem,4vmin,1.875rem)]">
                Ventanilla {display.currentCall.window?.number}
              </p>
              <p className="text-slate-400 mt-1 sm:mt-2 text-[clamp(0.75rem,2vmin,1rem)] text-center">
                {display.currentCall.priority.name}
              </p>
            </>
          ) : (
            <p className="text-slate-500 text-[clamp(1rem,3vmin,1.5rem)]">En espera...</p>
          )}
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
        </section>

        <section className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 lg:min-w-0">
          <h3 className="font-semibold text-slate-400 mb-3 sm:mb-4 uppercase tracking-wide text-[clamp(0.75rem,2vw,1rem)]">
            En atención
          </h3>
          {display.attending.length > 0 ? (
            <div className="space-y-2 sm:space-y-3">
              {display.attending.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-3 sm:gap-4 bg-slate-800/60 border border-slate-600 rounded-xl px-3 py-3 sm:px-5 sm:py-4 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-emerald-400 uppercase tracking-wide font-semibold text-[clamp(0.75rem,2.5vw,0.875rem)] truncate">
                      Ventanilla {t.window?.number}
                    </p>
                    <p className="text-slate-500 mt-0.5 sm:mt-1 text-[clamp(0.65rem,2vw,0.75rem)] truncate">
                      {t.priority.name}
                    </p>
                  </div>
                  <p className="font-black text-yellow-300 shrink-0 text-[clamp(1.25rem,5vmin,1.875rem)]">
                    {t.displayCode}
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
                    <p className="text-slate-400 text-[clamp(0.65rem,2vw,0.75rem)] truncate">{t.priority.name}</p>
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
        <div className="animate-marquee whitespace-nowrap font-semibold text-white tracking-wide text-[clamp(0.875rem,2.5vw,1.125rem)]">
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
      `}</style>
    </div>
  );
}
