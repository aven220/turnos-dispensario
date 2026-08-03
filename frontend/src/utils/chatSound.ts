/** Sonido de notificación claro y corto (una vez por mensaje). */
export function playChatNotifySound() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, dur: number, vol: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    };

    // Dos tonos cortos y nítidos
    playTone(988, now, 0.12, 0.22);
    playTone(1319, now + 0.14, 0.16, 0.2);

    setTimeout(() => ctx.close().catch(() => undefined), 500);
  } catch {
    // silencioso si el navegador bloquea audio
  }
}
