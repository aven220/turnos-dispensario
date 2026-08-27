/** Alerta sonora para mensajes prioritarios del administrador (bloquean ventanilla). */

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AudioCtx();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

export function unlockPriorityAlertSound() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
}

/** Tono corto, fuerte y profesional (más perceptible que el chat). */
export function playPriorityMessageAlert() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([180, 80, 180]);
    }
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
    const now = ctx.currentTime;

    const tone = (freq: number, start: number, dur: number, vol: number, type: OscillatorType = 'square') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    };

    // Tres impulsos claros
    tone(740, now, 0.16, 0.75);
    tone(980, now + 0.18, 0.18, 0.8);
    tone(740, now + 0.4, 0.2, 0.7);
  } catch {
    // ignore
  }
}
