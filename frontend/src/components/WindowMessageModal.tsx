import { useState } from 'react';
import { Button } from './Layout';

export interface PendingWindowMessage {
  id: string;
  message: string;
  sentAt: string;
  sentBy?: { fullName: string };
}

interface WindowMessageModalProps {
  message: PendingWindowMessage;
  onAcknowledge: () => Promise<void>;
}

export function WindowMessageModal({ message, onAcknowledge }: WindowMessageModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAccept() {
    setError('');
    setLoading(true);
    try {
      await onAcknowledge();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border-2 border-amber-400 overflow-hidden"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="window-message-title"
      >
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
          <p id="window-message-title" className="text-white font-bold text-lg">
            Mensaje del administrador
          </p>
          {message.sentBy && (
            <p className="text-amber-100 text-sm mt-1">Enviado por {message.sentBy.fullName}</p>
          )}
        </div>

        <div className="px-6 py-6">
          <p className="text-slate-800 text-lg leading-relaxed whitespace-pre-wrap">{message.message}</p>
          <p className="text-xs text-slate-400 mt-4">
            {new Date(message.sentAt).toLocaleString('es-CO')}
          </p>
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mt-4">
            Debe pulsar <strong>Aceptar</strong> para continuar. No podrá tomar turnos hasta confirmar que leyó el mensaje.
          </p>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>

        <div className="px-6 pb-6">
          <Button
            onClick={handleAccept}
            disabled={loading}
            className="w-full py-4 text-lg font-bold"
            variant="primary"
          >
            {loading ? 'Confirmando...' : 'Aceptar — he leído el mensaje'}
          </Button>
        </div>
      </div>
    </div>
  );
}
