#!/usr/bin/env node
// Regenera los clips de voz de respaldo del TV (frontend/public/audio/voz) con voces neuronales gratuitas
// (edge-tts, sin cuenta ni clave) y deja todos los archivos con volumen uniforme y sin distorsión.
//
// Requisitos (solo en la máquina que genera los audios):
//   python3 -m venv /tmp/tts-tools/venv && /tmp/tts-tools/venv/bin/pip install edge-tts
//   cd /tmp/tts-tools && npm init -y && npm i ffmpeg-static@5
// Uso:
//   EDGE_TTS=/tmp/tts-tools/venv/bin/edge-tts FFMPEG=/tmp/tts-tools/node_modules/ffmpeg-static/ffmpeg \
//     node frontend/scripts/generate-voice-clips-neural.mjs
// Opcionales: VOICE (es-CO-SalomeNeural), RATE (-5%), TARGET_LUFS (-15), ONLY=turno,n22

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/audio/voz');
const EDGE_TTS = process.env.EDGE_TTS || 'edge-tts';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const VOICE = process.env.VOICE || 'es-CO-SalomeNeural';
const RATE = process.env.RATE || '-5%';
const TARGET_LUFS = Number(process.env.TARGET_LUFS || -15);
const PEAK_LIMIT = 0.79; // ≈ -2 dBFS; el limitador trabaja a 4x para contener también los picos entre muestras
const SAMPLE_RATE = 24000;
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;

function buildClipList() {
  const clips = [
    ['turno', 'Turno'],
    ['segunda', 'Segunda llamada para el turno'],
    ['tercera', 'Tercera llamada para el turno'],
    ['llamada', 'Llamada para el turno'],
    ['ventanilla', 'diríjase a la ventanilla'],
  ];
  const letters = {
    a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'efe', g: 'ge', h: 'hache', i: 'i', j: 'jota', k: 'ka',
    l: 'ele', m: 'eme', n: 'ene', o: 'o', p: 'pe', q: 'cu', r: 'erre', s: 'ese', t: 'te', u: 'u', v: 'uve',
    w: 'uve doble', x: 'equis', y: 'ye', z: 'zeta',
  };
  for (const [l, text] of Object.entries(letters)) clips.push([`letra-${l}`, text]);

  const units = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
  const tens = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
  for (let n = 0; n < 100; n++) {
    let text;
    if (n < 10) text = units[n];
    else if (n < 20) text = teens[n - 10];
    else text = n % 10 === 0 ? tens[n / 10] : `${tens[Math.floor(n / 10)]} y ${units[n % 10]}`;
    clips.push([`n${n}`, text]);
  }

  clips.push(['cien', 'cien']);
  ['ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos']
    .forEach((text, i) => clips.push([`h${i + 1}`, text]));
  return clips;
}

function synthesize(text, dest) {
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync(EDGE_TTS, ['--voice', VOICE, `--rate=${RATE}`, '--text', text, '--write-media', dest], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return;
    } catch (err) {
      if (attempt >= 3) throw new Error(`edge-tts falló con "${text}": ${String(err.stderr || err.message)}`);
    }
  }
}

function ffmpeg(args) {
  execFileSync(FFMPEG, ['-hide_banner', '-nostats', '-y', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
}

function loudness(file) {
  // Se añade silencio para que la medición EBU R128 funcione también con palabras muy cortas.
  const { stderr } = spawnSync(
    FFMPEG,
    ['-hide_banner', '-nostats', '-i', file, '-af', 'apad=whole_dur=3,loudnorm=print_format=json', '-f', 'null', '-'],
    { encoding: 'utf8' }
  );
  const json = JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
  return { lufs: Number(json.input_i), peak: Number(json.input_tp) };
}

const TRIM =
  'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,' +
  'areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0,areverse';

function processClip(raw, dest) {
  const trimmed = `${dest}.trim.wav`;
  ffmpeg(['-i', raw, '-af', TRIM, '-ac', '1', '-ar', String(SAMPLE_RATE), trimmed]);
  const gain = TARGET_LUFS - loudness(trimmed).lufs;
  ffmpeg([
    '-i', trimmed,
    '-af',
    `volume=${gain.toFixed(2)}dB,aresample=${SAMPLE_RATE * 4},` +
      `alimiter=limit=${PEAK_LIMIT}:attack=2:release=40:level=disabled,aresample=${SAMPLE_RATE},` +
      'adelay=20,apad=pad_dur=0.1',
    '-ac', '1', '-ar', String(SAMPLE_RATE), '-c:a', 'pcm_s16le', dest,
  ]);
  rmSync(trimmed);
  return loudness(dest);
}

function main() {
  const clips = buildClipList().filter(([id]) => !ONLY || ONLY.has(id));
  const work = mkdtempSync(join(tmpdir(), 'voz-'));
  const staged = join(work, 'out');
  mkdirSync(staged);

  const report = [];
  for (const [id, text] of clips) {
    const raw = join(work, `${id}.mp3`);
    synthesize(text, raw);
    report.push({ id, ...processClip(raw, join(staged, `${id}.wav`)) });
    process.stdout.write(`${id} `);
  }

  mkdirSync(OUT, { recursive: true });
  for (const file of readdirSync(staged)) renameSync(join(staged, file), join(OUT, file));
  rmSync(work, { recursive: true, force: true });

  const byLufs = [...report].sort((a, b) => a.lufs - b.lufs);
  const fmt = (r) => `${r.id} ${r.lufs.toFixed(1)}`;
  console.log(`\n\nVoz: ${VOICE} | archivos: ${report.length} | destino: ${OUT}`);
  console.log(`Más suaves (LUFS): ${byLufs.slice(0, 3).map(fmt).join(', ')}`);
  console.log(`Más fuertes (LUFS): ${byLufs.slice(-3).map(fmt).join(', ')}`);
  console.log(`Pico máximo: ${Math.max(...report.map((r) => r.peak)).toFixed(1)} dBTP`);
}

try {
  main();
} catch (err) {
  console.error(`\n${err.message}`);
  process.exit(1);
}
