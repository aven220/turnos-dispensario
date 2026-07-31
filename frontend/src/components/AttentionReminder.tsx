import { Button } from './Layout';

interface AttentionReminderProps {
  onDismiss: () => void;
}

export function AttentionReminder({ onDismiss }: AttentionReminderProps) {
  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-amber-900">Recordatorio</p>
        <p className="text-sm text-amber-800 mt-0.5">
          Por favor no olvide marcar &quot;Iniciar Atención&quot; si el usuario ya está siendo atendido.
        </p>
      </div>
      <Button variant="secondary" onClick={onDismiss} className="shrink-0 text-sm">
        Entendido
      </Button>
    </div>
  );
}
