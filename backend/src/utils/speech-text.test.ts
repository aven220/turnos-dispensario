import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

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

function displayCodeToSpeech(displayCode: string): string {
  const match = displayCode.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return displayCode;

  const letters = match[1].toUpperCase().split('').join(' ');
  const sequence = parseInt(match[2], 10);
  const numberSpeech = Number.isNaN(sequence) ? match[2] : numberToSpanish(sequence);
  return `${letters} ${numberSpeech}`;
}

describe('displayCodeToSpeech', () => {
  it('reads GE001 as G E uno', () => {
    assert.equal(displayCodeToSpeech('GE001'), 'G E uno');
  });

  it('reads GEN020 as G E N veinte', () => {
    assert.equal(displayCodeToSpeech('GEN020'), 'G E N veinte');
  });

  it('reads GEN022 as G E N veinte y dos', () => {
    assert.equal(displayCodeToSpeech('GEN022'), 'G E N veinte y dos');
  });
});
