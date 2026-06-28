/** Debe coincidir con backend/src/utils/call-cooldown.ts */
export const REPEAT_CALL_COOLDOWN_MS = 4000;

export function repeatCallCooldownRemaining(
  lastCalledAt: string | null | undefined,
  now = Date.now()
): number {
  if (!lastCalledAt) return 0;
  const last = new Date(lastCalledAt).getTime();
  if (Number.isNaN(last)) return 0;
  return Math.max(0, REPEAT_CALL_COOLDOWN_MS - (now - last));
}
