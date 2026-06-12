const PRIORITY_NAMES: Record<string, string> = {
  PRI: 'prioritario',
  PEN: 'pendiente',
  GEN: 'general',
  AM: 'adulto mayor',
  ENT: 'entrega',
};

function numberToSpanish(num: number): string {
  const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];

  if (num < 10) return units[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const t = Math.floor(num / 10);
    const u = num % 10;
    return u === 0 ? tens[t] : `${tens[t]} y ${units[u]}`;
  }
  return String(num);
}

export function buildCallMessage(
  displayCode: string,
  priorityCode: string,
  windowNumber: number,
  callCount: number,
  priorityLabel?: string
): string {
  const match = displayCode.match(/(\d+)$/);
  const num = match ? parseInt(match[1], 10) : 0;
  const priorityName = priorityLabel?.toLowerCase() ?? PRIORITY_NAMES[priorityCode] ?? priorityCode.toLowerCase();
  const numText = numberToSpanish(num);

  if (callCount > 1) {
    const ordinals = ['', 'Primera', 'Segunda', 'Tercera'];
    return `${ordinals[callCount]} llamada para el turno ${priorityName} ${numText}, diríjase a la ventanilla ${numberToSpanish(windowNumber)}.`;
  }

  return `Turno ${priorityName} ${numText}, diríjase a la ventanilla ${numberToSpanish(windowNumber)}.`;
}

const queue: string[] = [];
let processing = false;
const announced = new Set<string>();
let initialized = false;

function loadVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

function pickSpanishVoice(): SpeechSynthesisVoice | undefined {
  const voices = loadVoices();
  return (
    voices.find((v) => v.lang === 'es-CO') ??
    voices.find((v) => v.lang.startsWith('es'))
  );
}

function wakeSpeechEngine(): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.resume();
  const voices = loadVoices();
  if (voices.length === 0) return;
  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  window.speechSynthesis.speak(utterance);
}

export function initSpeech(): void {
  if (!('speechSynthesis' in window) || initialized) return;
  initialized = true;

  const hydrate = () => wakeSpeechEngine();
  hydrate();
  window.speechSynthesis.addEventListener('voiceschanged', hydrate);

  setInterval(() => window.speechSynthesis.resume(), 8000);
}

function speakOnce(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-CO';
    utterance.rate = 0.9;
    utterance.volume = 1;

    const voice = pickSpanishVoice();
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();

    window.speechSynthesis.speak(utterance);
  });
}

async function processQueue(): Promise<void> {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const text = queue.shift()!;
    await speakOnce(text);
    await new Promise((r) => setTimeout(r, 400));
  }

  processing = false;
}

export function enqueueCallSpeech(key: string, text: string): void {
  if (announced.has(key)) return;
  announced.add(key);
  if (announced.size > 200) {
    const keep = [...announced].slice(-100);
    announced.clear();
    keep.forEach((k) => announced.add(k));
  }
  wakeSpeechEngine();
  queue.push(text);
  processQueue();
}
