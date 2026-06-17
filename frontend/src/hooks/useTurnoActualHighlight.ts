import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ticket } from '../types';

const HIGHLIGHT_DURATION_MS = 5000;

export interface HighlightedCall {
  ticket: Ticket;
  key: string;
}

export function useTurnoActualHighlight(durationMs = HIGHLIGHT_DURATION_MS) {
  const [highlighted, setHighlighted] = useState<HighlightedCall | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlight = useCallback(
    (ticket: Ticket) => {
      setHighlighted({ ticket, key: `${ticket.id}-${ticket.callCount}` });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setHighlighted(null), durationMs);
    },
    [durationMs]
  );

  const clearIfTicket = useCallback((ticketId: string) => {
    setHighlighted((current) => {
      if (current?.ticket.id !== ticketId) return current;
      if (timerRef.current) clearTimeout(timerRef.current);
      return null;
    });
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { highlighted, highlight, clearIfTicket };
}
