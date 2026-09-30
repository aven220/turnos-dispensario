import { useEffect, useState } from 'react';
import { getAudioDiagnostics, testCallAudio } from '../utils/speech';

/** Solo visible con /tv?diag=1: muestra qué mecanismo de audio puede usar el navegador del TV. */
export function TvAudioDiagnostics() {
  const [info, setInfo] = useState(() => getAudioDiagnostics());

  useEffect(() => {
    const id = window.setInterval(() => setInfo(getAudioDiagnostics()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="absolute left-2 bottom-2 z-40 max-w-[90vw] rounded-lg bg-black/90 border border-slate-600 p-3 text-xs text-slate-100 space-y-1">
      {Object.entries(info).map(([k, v]) => (
        <p key={k} className="break-all">
          <span className="text-slate-400">{k}:</span> {v}
        </p>
      ))}
      <div className="flex gap-2 pt-2">
        <button type="button" className="px-3 py-1 rounded bg-blue-600" onClick={() => testCallAudio(false)}>
          Probar llamada
        </button>
        <button type="button" className="px-3 py-1 rounded bg-emerald-600" onClick={() => testCallAudio(true)}>
          Probar audio grabado
        </button>
      </div>
    </div>
  );
}
