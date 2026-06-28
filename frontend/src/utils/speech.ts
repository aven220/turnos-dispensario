export interface SpeechSettings {
  rate: number;
  voiceName: string;
  lang: string;
}

export type VoicePresetId = 'google' | 'female-1' | 'female-2' | 'male-1' | 'male-2';

export interface NeutralVoiceOption {
  id: VoicePresetId;
  label: string;
  gender: 'neutral' | 'female' | 'male';
  voice: SpeechSynthesisVoice | null;
  available: boolean;
  lang: string;
}

/** @deprecated Usar 'google' */
export const GOOGLE_NEUTRAL_VOICE = 'google';

export const DEFAULT_VOICE_PRESET: VoicePresetId = 'google';

const DEFAULT_SETTINGS: SpeechSettings = {
  rate: 0.9,
  voiceName: DEFAULT_VOICE_PRESET,
  lang: 'es-ES',
};

const REGIONAL_LANGS = new Set([
  'es-co', 'es-mx', 'es-ar', 'es-cl', 'es-pe', 'es-ve', 'es-uy', 'es-py', 'es-bo',
  'es-ec', 'es-cr', 'es-pa', 'es-do', 'es-gt', 'es-hn', 'es-ni', 'es-sv', 'es-pr',
  'es-cu', 'es-419', 'es-us', 'ca-es', 'ca',
]);

interface PresetDefinition {
  id: VoicePresetId;
  label: string;
  gender: 'neutral' | 'female' | 'male';
  mode: 'specific' | 'browser';
  patterns?: RegExp[];
}

const PRESET_DEFINITIONS: PresetDefinition[] = [
  { id: 'google', label: 'Google Español (Chrome)', gender: 'neutral', mode: 'specific' },
  {
    id: 'female-1',
    label: 'Español neutro — sistema',
    gender: 'neutral',
    mode: 'specific',
    patterns: [/helena/i, /mónica|monica/i, /elvira/i, /laura/i],
  },
  { id: 'female-2', label: 'Mujer (navegador)', gender: 'female', mode: 'browser' },
  { id: 'male-1', label: 'Hombre (navegador)', gender: 'male', mode: 'browser' },
  { id: 'male-2', label: 'Automática (navegador)', gender: 'neutral', mode: 'browser' },
];

let currentSettings: SpeechSettings = { ...DEFAULT_SETTINGS };

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

export function displayCodeToSpeech(displayCode: string): string {
  const match = displayCode.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return displayCode;

  const letters = match[1].toUpperCase().split('').join(' ');
  const sequence = parseInt(match[2], 10);
  const numberSpeech = Number.isNaN(sequence) ? match[2] : numberToSpanish(sequence);
  return `${letters} ${numberSpeech}`;
}

export function buildCallMessage(displayCode: string, windowNumber: number, callCount: number): string {
  const ticketSpeech = displayCodeToSpeech(displayCode);
  const windowSpeech = numberToSpanish(windowNumber);

  if (callCount > 1) {
    const ordinals = ['', 'Primera', 'Segunda', 'Tercera'];
    return `${ordinals[callCount]} llamada para el turno ${ticketSpeech}, diríjase a la ventanilla ${windowSpeech}.`;
  }

  return `Turno ${ticketSpeech}, diríjase a la ventanilla ${windowSpeech}.`;
}

const queue: string[] = [];
let processing = false;
const announced = new Set<string>();
let initialized = false;

function loadVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis?.getVoices() ?? [];
}

function normalizeLang(lang: string): string {
  return lang.trim().toLowerCase().replace('_', '-');
}

function isNeutralLang(lang: string): boolean {
  const l = normalizeLang(lang);
  if (REGIONAL_LANGS.has(l)) return false;
  return l === 'es' || l === 'es-es' || l.startsWith('es-es-');
}

function isRegionalName(name: string): boolean {
  const n = name.toLowerCase();
  return /colombia|méxico|mexico|argentina|chile|perú|peru|venezuela|latinoamérica|latinoamerica|latino\b|caribe|catalán|catalan|andina|paulina|soledad|mexican|united states|estados unidos/i.test(n);
}

export function isGoogleNeutralVoice(voice: SpeechSynthesisVoice): boolean {
  if (!/google/i.test(voice.name)) return false;
  if (!isNeutralLang(voice.lang)) return false;
  if (isRegionalName(voice.name)) return false;
  return true;
}

function isSystemNeutralVoice(voice: SpeechSynthesisVoice): boolean {
  if (/google/i.test(voice.name)) return false;
  if (!voice.lang.toLowerCase().startsWith('es')) return false;
  if (!isNeutralLang(voice.lang)) return false;
  if (isRegionalName(voice.name)) return false;
  return true;
}

function googleVoiceScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (normalizeLang(voice.lang) === 'es-es') score += 30;
  if (/español/i.test(voice.name)) score += 20;
  if (voice.default) score += 5;
  return score;
}

export function findGoogleNeutralVoice(voices = loadVoices()): SpeechSynthesisVoice | undefined {
  const google = voices.filter(isGoogleNeutralVoice);
  if (!google.length) return undefined;
  return [...google].sort((a, b) => googleVoiceScore(b) - googleVoiceScore(a))[0];
}

function systemVoiceScore(voice: SpeechSynthesisVoice): number {
  let score = 0;
  if (normalizeLang(voice.lang) === 'es-es') score += 20;
  if (/helena|mónica|monica|elvira|laura/i.test(voice.name)) score += 15;
  if (voice.default) score += 5;
  if (voice.localService) score += 3;
  return score;
}

function findBestSystemNeutralVoice(voices = loadVoices()): SpeechSynthesisVoice | undefined {
  const pool = voices.filter(isSystemNeutralVoice);
  if (!pool.length) return undefined;
  return [...pool].sort((a, b) => systemVoiceScore(b) - systemVoiceScore(a))[0];
}

function isBrowserPreset(presetId: VoicePresetId): boolean {
  return PRESET_DEFINITIONS.find((p) => p.id === presetId)?.mode === 'browser';
}

function getPreset(presetId: VoicePresetId): PresetDefinition | undefined {
  return PRESET_DEFINITIONS.find((p) => p.id === presetId);
}

function findByPatterns(
  voices: SpeechSynthesisVoice[],
  patterns: RegExp[],
  used: Set<string>
): SpeechSynthesisVoice | undefined {
  const pool = voices.filter(isSystemNeutralVoice).filter((v) => !used.has(v.voiceURI));
  for (const pattern of patterns) {
    const match = pool.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return undefined;
}

export function normalizeVoicePreset(value: string | undefined | null): VoicePresetId {
  if (!value || value === '') return 'google';
  const valid: VoicePresetId[] = ['google', 'female-1', 'female-2', 'male-1', 'male-2'];
  if (valid.includes(value as VoicePresetId)) return value as VoicePresetId;
  if (/google/i.test(value)) return 'google';
  return 'google';
}

export function resolveNeutralVoices(voices = loadVoices()): NeutralVoiceOption[] {
  return PRESET_DEFINITIONS.map((preset) => {
    if (preset.mode === 'browser') {
      return {
        id: preset.id,
        label: preset.label,
        gender: preset.gender,
        voice: null,
        available: true,
        lang: 'es-ES',
      };
    }

    let voice: SpeechSynthesisVoice | undefined;

    if (preset.id === 'google') {
      voice = findGoogleNeutralVoice(voices);
    } else if (preset.patterns) {
      voice = findByPatterns(voices, preset.patterns, new Set()) ?? findBestSystemNeutralVoice(voices);
    }

    return {
      id: preset.id,
      label: preset.label,
      gender: preset.gender,
      voice: voice ?? null,
      available: true,
      lang: 'es-ES',
    };
  });
}

export function listNeutralVoices(): NeutralVoiceOption[] {
  return resolveNeutralVoices();
}

export function findVoiceByPreset(presetId: VoicePresetId, voices = loadVoices()): SpeechSynthesisVoice | undefined {
  if (isBrowserPreset(presetId)) return undefined;

  if (presetId === 'google') return findGoogleNeutralVoice(voices);

  const preset = getPreset(presetId);
  if (!preset?.patterns) return undefined;

  return findByPatterns(voices, preset.patterns, new Set()) ?? findBestSystemNeutralVoice(voices);
}

/** @deprecated Use listNeutralVoices */
export function listSpanishVoices(): SpeechSynthesisVoice[] {
  return resolveNeutralVoices().filter((o) => o.voice).map((o) => o.voice!);
}

function pickVoice(voices: SpeechSynthesisVoice[], settings: SpeechSettings): SpeechSynthesisVoice | undefined {
  const presetId = normalizeVoicePreset(settings.voiceName);
  if (isBrowserPreset(presetId)) return undefined;
  return findVoiceByPreset(presetId, voices);
}

export function isBrowserDelegatedPreset(presetId: VoicePresetId): boolean {
  return isBrowserPreset(presetId);
}

export function setSpeechSettings(settings: Partial<SpeechSettings>): void {
  currentSettings = {
    ...currentSettings,
    ...settings,
    lang: 'es-ES',
    voiceName:
      settings.voiceName === undefined
        ? currentSettings.voiceName
        : normalizeVoicePreset(settings.voiceName),
  };
}

export function getSpeechSettings(): SpeechSettings {
  return { ...currentSettings };
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

function speakOnce(text: string, override?: Partial<SpeechSettings>, cancelPending = false): Promise<void> {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    const settings = {
      ...currentSettings,
      ...override,
      lang: 'es-ES' as const,
      voiceName: normalizeVoicePreset(override?.voiceName ?? currentSettings.voiceName),
    };

    if (cancelPending) window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.rate;
    utterance.volume = 1;
    utterance.lang = 'es-ES';

    const voice = pickVoice(loadVoices(), settings);
    if (voice) utterance.voice = voice;

    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.speak(utterance);
  });
}

export function previewSpeech(text: string, settings: SpeechSettings): void {
  speakOnce(
    text,
    { ...settings, voiceName: normalizeVoicePreset(settings.voiceName), lang: 'es-ES' },
    true
  );
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

export function hasGoogleNeutralVoice(): boolean {
  return !!findGoogleNeutralVoice();
}
