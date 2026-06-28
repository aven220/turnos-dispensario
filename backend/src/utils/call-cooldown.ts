/** Segundos mínimos entre repetir llamado del mismo turno */
export const REPEAT_CALL_COOLDOWN_MS = 4000;

export function repeatCallCooldownRemaining(lastCalledAt: Date | string | null | undefined, now = Date.now()): number {
  if (!lastCalledAt) return 0;
  const last = typeof lastCalledAt === 'string' ? new Date(lastCalledAt).getTime() : lastCalledAt.getTime();
  if (Number.isNaN(last)) return 0;
  return Math.max(0, REPEAT_CALL_COOLDOWN_MS - (now - last));
}

export function assertRepeatCallCooldown(lastCalledAt: Date | null | undefined): void {
  const remaining = repeatCallCooldownRemaining(lastCalledAt);
  if (remaining <= 0) return;
  const seconds = Math.ceil(remaining / 1000);
  const err = new Error(`Espere ${seconds} segundo${seconds === 1 ? '' : 's'} antes de repetir el llamado`) as Error & {
    statusCode?: number;
  };
  err.statusCode = 429;
  throw err;
}
