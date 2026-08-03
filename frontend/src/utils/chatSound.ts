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

/** Desbloquea audio tras un gesto del usuario (requerido por el navegador). */
export function unlockChatSound() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.01);
  } catch {
    // ignore
  }
}

/**
 * Sonido de notificación fuerte y corto.
 * Usa onda cuadrada + volumen alto + vibración (móviles).
 */
export function playChatNotifySound() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate([140, 70, 140, 70, 220]);
    }

    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      start: number,
      dur: number,
      vol: number,
      type: OscillatorType = 'square'
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      // Ataque rápido, volumen alto, decay corto
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.min(vol, 0.95), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    };

    // Tres tonos fuertes (square es más perceptible que sine)
    playTone(880, now, 0.16, 0.85);
    playTone(1175, now + 0.14, 0.18, 0.9);
    playTone(1480, now + 0.3, 0.22, 0.8);
    // Refuerzo grave para más “cuerpo”
    playTone(440, now, 0.2, 0.45, 'triangle');
  } catch {
    // silencioso si el navegador bloquea audio
  }
}
