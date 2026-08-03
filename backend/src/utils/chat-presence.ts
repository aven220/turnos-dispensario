/** Usuarios conectados con sesión autenticada (en memoria). */
const onlineCounts = new Map<string, number>();

export function trackUserOnline(userId: string): boolean {
  const prev = onlineCounts.get(userId) ?? 0;
  onlineCounts.set(userId, prev + 1);
  return prev === 0;
}

export function trackUserOffline(userId: string): boolean {
  const prev = onlineCounts.get(userId) ?? 0;
  if (prev <= 1) {
    onlineCounts.delete(userId);
    return true;
  }
  onlineCounts.set(userId, prev - 1);
  return false;
}

export function getOnlineUserIds(): string[] {
  return [...onlineCounts.keys()];
}

export function isUserOnline(userId: string): boolean {
  return (onlineCounts.get(userId) ?? 0) > 0;
}
