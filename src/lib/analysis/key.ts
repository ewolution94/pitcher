// The source key: a chromagram (how much of each of the 12 pitch classes sounds, over the whole
// track) compared with the Krumhansl–Kessler profiles of the 24 major and minor keys. Tuned to
// A = 440 Hz. Good at a track's home key; a relative major or minor (Am and C) is the usual miss,
// which is why the detected key can be corrected by hand.

import { fft } from './fft.ts';
import type { Key } from '../music.ts';

const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const SIZE = 4096;
const LOW_HZ = 65;
const HIGH_HZ = 2100;

export interface KeyResult {
  key: Key;
  /** 0–1: how far the best key stood above the next one. */
  confidence: number;
  chroma: number[];
}

function correlation(a: number[], b: number[]): number {
  const ma = a.reduce((s, v) => s + v, 0) / a.length;
  const mb = b.reduce((s, v) => s + v, 0) / b.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

export function chromagram(samples: Float32Array, sampleRate: number): number[] {
  // Down to about 11 kHz (an average over each group is filter enough for notes below 2 kHz).
  const factor = Math.max(1, Math.floor(sampleRate / 11025));
  const rate = sampleRate / factor;
  const length = Math.floor(samples.length / factor);
  const x = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let s = 0;
    for (let j = 0; j < factor; j++) s += samples[i * factor + j];
    x[i] = s / factor;
  }

  const window = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1));
  const bins: { bin: number; pc: number }[] = [];
  for (let k = 1; k < SIZE / 2; k++) {
    const hz = (k * rate) / SIZE;
    if (hz < LOW_HZ || hz > HIGH_HZ) continue;
    const midi = 69 + 12 * Math.log2(hz / 440);
    bins.push({ bin: k, pc: ((Math.round(midi) % 12) + 12) % 12 });
  }

  const chroma = new Array(12).fill(0);
  const re = new Float64Array(SIZE);
  const im = new Float64Array(SIZE);
  const frame = new Array(12);
  for (let start = 0; start + SIZE <= length; start += SIZE) {
    let energy = 0;
    for (let i = 0; i < SIZE; i++) {
      const v = x[start + i];
      re[i] = v * window[i];
      im[i] = 0;
      energy += v * v;
    }
    if (energy / SIZE < 1e-6) continue; // silence
    fft(re, im);
    frame.fill(0);
    for (const { bin, pc } of bins) frame[pc] += Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
    const top = Math.max(...frame);
    if (top > 0) for (let pc = 0; pc < 12; pc++) chroma[pc] += frame[pc] / top;
  }
  return chroma;
}

export function keyFromChroma(chroma: number[]): KeyResult {
  const scores: { key: Key; r: number }[] = [];
  for (let pc = 0; pc < 12; pc++) {
    for (const minor of [false, true]) {
      const profile = minor ? MINOR : MAJOR;
      const rotated = Array.from({ length: 12 }, (_, i) => profile[(i - pc + 12) % 12]);
      scores.push({ key: { pc, minor }, r: correlation(chroma, rotated) });
    }
  }
  scores.sort((a, b) => b.r - a.r);
  const confidence = Math.max(0, Math.min(1, (scores[0].r - scores[1].r) * 5));
  return { key: scores[0].key, confidence, chroma };
}

export const detectKey = (samples: Float32Array, sampleRate: number): KeyResult =>
  keyFromChroma(chromagram(samples, sampleRate));
