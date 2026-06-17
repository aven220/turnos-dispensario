import type { Ticket } from '../types';

export function upsertPendingCall(calls: Ticket[], ticket: Ticket): Ticket[] {
  const next = calls.filter((t) => t.id !== ticket.id);
  next.push(ticket);
  return sortPendingCalls(next);
}

export function sortPendingCalls(calls: Ticket[]): Ticket[] {
  return [...calls].sort((a, b) => {
    const at = a.calledAt ? new Date(a.calledAt).getTime() : 0;
    const bt = b.calledAt ? new Date(b.calledAt).getTime() : 0;
    return bt - at;
  });
}

export function removePendingCall(calls: Ticket[], ticketId: string): Ticket[] {
  return calls.filter((t) => t.id !== ticketId);
}
