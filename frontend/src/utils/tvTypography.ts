/** Escala de texto responsive para TV (clamp con factor). */
export function tvScaledFontSize(minRem: number, vw: number, maxRem: number, scale = 1): string {
  const s = Math.min(2.5, Math.max(0.6, scale));
  return `clamp(${minRem * s}rem, ${vw * s}vw, ${maxRem * s}rem)`;
}
