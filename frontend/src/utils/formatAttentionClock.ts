/** Reloj de atención: MM:SS; con ≥1h → HH:MM:SS */
export function formatAttentionClock(fromIso: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}
