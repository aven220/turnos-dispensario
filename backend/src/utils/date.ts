/** Zona horaria oficial de la aplicación (Colombia). */
export const APP_TIMEZONE = 'America/Bogota';

function bogotaParts(date: Date): { year: string; month: string; day: string; hour: string; minute: string; second: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Prefijo YYYYMMDD del día calendario en America/Bogota. */
export function todayPrefix(): string {
  return formatDatePrefix(new Date());
}

/**
 * Instant UTC correspondiente a medianoche (00:00:00.000) del día calendario
 * actual en America/Bogota.
 */
export function startOfToday(): Date {
  return startOfDatePrefix(todayPrefix());
}

/** Medianoche Bogotá del datePrefix YYYYMMDD → Instant UTC. */
export function startOfDatePrefix(prefix: string): Date {
  if (!/^\d{8}$/.test(prefix)) {
    throw new Error(`datePrefix inválido: ${prefix}`);
  }
  const y = prefix.slice(0, 4);
  const m = prefix.slice(4, 6);
  const d = prefix.slice(6, 8);
  // Colombia no observa DST; offset fijo UTC-5
  return new Date(`${y}-${m}-${d}T00:00:00.000-05:00`);
}

/** Fin exclusivo del día (medianoche del día siguiente en Bogotá). */
export function endOfDatePrefixExclusive(prefix: string): Date {
  const start = startOfDatePrefix(prefix);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

export function formatDatePrefix(date: Date): string {
  const { year, month, day } = bogotaParts(date);
  return `${year}${month}${day}`;
}

/**
 * Acepta YYYYMMDD, YYYY-MM-DD o ISO. Interpreta fechas de calendario en Bogotá.
 */
export function parseDatePrefix(input?: string): string {
  if (!input) return todayPrefix();
  if (/^\d{8}$/.test(input)) return input;
  const isoDay = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) return `${isoDay[1]}${isoDay[2]}${isoDay[3]}`;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return todayPrefix();
  return formatDatePrefix(parsed);
}

/** Lista inclusiva de datePrefix desde from hasta to (ambos YYYYMMDD o parseables). */
export function datePrefixRange(fromInput?: string, toInput?: string): string[] {
  const from = parseDatePrefix(fromInput);
  const to = parseDatePrefix(toInput ?? fromInput);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  const result: string[] = [];
  let cursor = startOfDatePrefix(start);
  const endInstant = startOfDatePrefix(end);
  while (cursor.getTime() <= endInstant.getTime()) {
    result.push(formatDatePrefix(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return result;
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
