import { useEffect, useState } from 'react';
import { Button } from './Layout';
import {
  buildCallMessage,
  initSpeech,
  isBrowserDelegatedPreset,
  listNeutralVoices,
  normalizeVoicePreset,
  previewSpeech,
  type NeutralVoiceOption,
  type VoicePresetId,
} from '../utils/speech';

interface TvSpeechConfigProps {
  speechRate: number;
  speechVoice: string;
  onRateChange: (rate: number) => void;
  onVoiceChange: (preset: VoicePresetId) => void;
}

const PREVIEW_MESSAGE = buildCallMessage('AM001', 1, 1);

const GENDER_HINT: Record<NeutralVoiceOption['gender'], string> = {
  neutral: '○',
  female: '♀',
  male: '♂',
};

function optionLabel(v: NeutralVoiceOption): string {
  const prefix = `${GENDER_HINT[v.gender]} ${v.label}`;
  if (v.id === 'google' && !v.voice) return `${prefix} · ideal en Chrome`;
  if (v.id === 'female-1' && v.voice) return `${prefix} · ${v.voice.name}`;
  if (isBrowserDelegatedPreset(v.id)) return `${prefix} · voz del navegador`;
  return prefix;
}

export function TvSpeechConfig({
  speechRate,
  speechVoice,
  onRateChange,
  onVoiceChange,
}: TvSpeechConfigProps) {
  const [voices, setVoices] = useState<NeutralVoiceOption[]>([]);
  const [speechSupported, setSpeechSupported] = useState(true);
  const selected = normalizeVoicePreset(speechVoice);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setSpeechSupported(false);
      return;
    }
    initSpeech();
    const load = () => setVoices(listNeutralVoices());
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  function handlePreview() {
    previewSpeech(PREVIEW_MESSAGE, {
      rate: speechRate,
      voiceName: selected,
      lang: 'es-ES',
    });
  }

  if (!speechSupported) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Este navegador no soporta síntesis de voz.
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4 mt-4">
      <div>
        <h4 className="font-medium text-sm">Voz de llamados (TV)</h4>
        <p className="text-xs text-slate-500 mt-1">
          <strong>2 voces fijas:</strong> Google (Chrome) y Español sistema (Safari/Edge).
          Las otras 3 dejan que el <strong>navegador elija</strong> la voz en español.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Voz</label>
        <select
          value={selected}
          onChange={(e) => onVoiceChange(e.target.value as VoicePresetId)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          {voices.map((v) => (
            <option key={v.id} value={v.id}>
              {optionLabel(v)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-sm font-medium">Velocidad</label>
          <span className="text-sm text-slate-600 font-mono">{speechRate.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={0.6}
          max={1.2}
          step={0.05}
          value={speechRate}
          onChange={(e) => onRateChange(parseFloat(e.target.value))}
          className="w-full accent-blue-600"
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>Más lenta (0.6)</span>
          <span>Normal (0.9)</span>
          <span>Más rápida (1.2)</span>
        </div>
      </div>

      <Button variant="secondary" onClick={handlePreview} className="text-sm">
        Probar voz seleccionada
      </Button>
      <p className="text-xs text-slate-400">
        Prueba: &quot;{PREVIEW_MESSAGE}&quot;
      </p>
    </div>
  );
}
