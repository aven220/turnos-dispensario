export function todayPrefix(): string {
  const now = new Date();
  return formatDatePrefix(now);
}

/** Inicio del día local del servidor (medianoche). */
export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDatePrefix(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function parseDatePrefix(input?: string): string {
  if (!input) return todayPrefix();
  if (/^\d{8}$/.test(input)) return input;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return todayPrefix();
  return formatDatePrefix(parsed);
}

export function datePrefixToLabel(prefix: string): string {
  if (prefix.length !== 8) return prefix;
  return `${prefix.slice(0, 4)}-${prefix.slice(4, 6)}-${prefix.slice(6, 8)}`;
}

export function formatDisplayCode(code: string, sequence: number): string {
  return `${code}${String(sequence).padStart(3, '0')}`;
}

export function formatUniqueCode(datePrefix: string, code: string, sequence: number): string {
  return `${datePrefix}-${code}-${String(sequence).padStart(3, '0')}`;
}
