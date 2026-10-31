// The source key: how much of each of the 12 pitch classes sounds over the whole track, compared with
// a profile of each of the 24 major and minor keys. Measured on music with known keys (`npm run eval`,
// tools/eval/README.md): on EDM (GiantSteps+) 69 % exactly right and 85 % within the best two, on pop,
// rock, folk and hip-hop (FMAK) 55 %, against 45 % and 42 % for the textbook profiles on the plain
// spectrum this replaced.
//
// The steps: a real low-pass before going down to about 11 kHz (so hi-hat partials can't fold into
// the notes); 8192-point frames, half overlapping, from 40 Hz to 3.5 kHz; only spectral peaks that
// stand clear of their surroundings count (noise and cymbals don't), each at its true frequency in a
// histogram of ten-cent steps; every frame counts by its share, not its loudness; the track's tuning
// read off the histogram and corrected when it's clearly off (over 25 cents), so a sped-up upload
// still reads right; then the 12 pitch classes, matched against profiles learned from 661 songs of
// many genres with expert keys (FMAK, Free Music Archive, CC BY 4.0). Learned from EDM instead
// (the Beatport EDM Key Dataset) they did no better on EDM and worse on everything else.

import { fft } from './fft.ts';
import type { Key } from '../music.ts';

/** Learned: the average pitch-class profile of the major and the minor songs, the tonic first. */
const MAJOR = [1, 0.2642, 0.6144, 0.3077, 0.7723, 0.4826, 0.3544, 0.9493, 0.2766, 0.5714, 0.2848, 0.5877];
const MINOR = [1, 0.2544, 0.5588, 0.6335, 0.3226, 0.5566, 0.2854, 0.9034, 0.3614, 0.3361, 0.5856, 0.3361];

const SIZE = 8192;
const HOP = SIZE / 2;
const LOW_HZ = 40;
const HIGH_HZ = 3500;
/** A peak counts when it stands this far above the spectrum's mean around it. */
const PEAK = 1.6;
/** Ten cents a bin, C at 0. */
const BINS = 120;
/** Tuning further off than this (in cents) is corrected. */
const TUNE_ABOVE = 25;

export interface KeyResult {
  key: Key;
  /** 0–1 from how far the best key stood above the next: under 0.3 the runner-up is nearly as likely. */
  confidence: number;
  /** All 24 keys, the likeliest first. */
  ranking: Key[];
  /** The track's tuning against A = 440 Hz, in cents (0 when it's within 25 cents). */
  tuning: number;
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

/** A six-pole Butterworth low-pass (three biquads), in place. */
function lowpass(x: Float32Array, rate: number, hz: number) {
  const w0 = (2 * Math.PI * hz) / rate, cos = Math.cos(w0), sin = Math.sin(w0);
  for (const q of [0.5176, 0.7071, 1.9319]) {
    const alpha = sin / (2 * q), a0 = 1 + alpha;
    const b0 = (1 - cos) / 2 / a0, b1 = (1 - cos) / a0, b2 = b0, a1 = (-2 * cos) / a0, a2 = (1 - alpha) / a0;
    let z1 = 0, z2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = x[i];
      const y = b0 * v + z1;
      z1 = b1 * v - a1 * y + z2;
      z2 = b2 * v - a2 * y;
      x[i] = y;
    }
  }
}

/** The spectral peaks of the whole track in ten-cent bins, each frame counting by its share. */
export function pitchHistogram(samples: Float32Array, sampleRate: number): Float64Array {
  const factor = Math.max(1, Math.floor(sampleRate / 11025));
  const rate = sampleRate / factor;
  const filtered = samples.slice();
  lowpass(filtered, sampleRate, Math.min(HIGH_HZ * 1.15, rate * 0.4));
  const length = Math.floor(filtered.length / factor);
  const x = new Float32Array(length);
  for (let i = 0; i < length; i++) x[i] = filtered[i * factor];

  const window = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i++) window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (SIZE - 1));
  const k0 = Math.max(2, Math.floor((LOW_HZ * SIZE) / rate));
  const k1 = Math.min(SIZE / 2 - 2, Math.ceil((Math.min(HIGH_HZ, rate * 0.45) * SIZE) / rate));

  const hist = new Float64Array(BINS);
  const frame = new Float64Array(BINS);
  const re = new Float64Array(SIZE), im = new Float64Array(SIZE);
  const mag = new Float64Array(SIZE / 2), sums = new Float64Array(SIZE / 2 + 1);
  for (let start = 0; start + SIZE <= length; start += HOP) {
    let energy = 0;
    for (let i = 0; i < SIZE; i++) {
      const v = x[start + i];
      re[i] = v * window[i];
      im[i] = 0;
      energy += v * v;
    }
    if (energy / SIZE < 1e-6) continue; // silence
    fft(re, im);
    for (let k = 0; k < SIZE / 2; k++) mag[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    for (let k = 0; k < SIZE / 2; k++) sums[k + 1] = sums[k] + mag[k];
    frame.fill(0);
    let total = 0;
    for (let k = k0; k <= k1; k++) {
      if (!(mag[k] > mag[k - 1] && mag[k] >= mag[k + 1])) continue;
      // The spectrum's mean within about a third of an octave around it.
      const w = Math.max(3, Math.round(k * 0.12));
      const a = Math.max(0, k - w), b = Math.min(SIZE / 2, k + w + 1);
      if (mag[k] < (PEAK * (sums[b] - sums[a])) / (b - a)) continue;
      // The peak's true frequency, from a parabola through the log magnitudes.
      const l = Math.log(mag[k - 1] + 1e-12), c = Math.log(mag[k] + 1e-12), r = Math.log(mag[k + 1] + 1e-12);
      const offset = Math.max(-0.5, Math.min(0.5, (l - r) / (2 * (l - 2 * c + r) || 1)));
      const cents = 1200 * Math.log2(((k + offset) * rate) / SIZE / 440) + 900;
      const bin = (((cents / 10) % BINS) + BINS) % BINS;
      const i = Math.floor(bin), f = bin - i;
      frame[i % BINS] += mag[k] * (1 - f);
      frame[(i + 1) % BINS] += mag[k] * f;
      total += mag[k];
    }
    if (total > 0) for (let b = 0; b < BINS; b++) hist[b] += frame[b] / total;
  }
  return hist;
}

/** Where the notes sit against A = 440 Hz, in cents (−50 to 50): the histogram's ten-bin period. */
export function tuningOf(hist: Float64Array): number {
  let s = 0, c = 0;
  for (let b = 0; b < BINS; b++) {
    const angle = (2 * Math.PI * b) / 10;
    s += hist[b] * Math.sin(angle);
    c += hist[b] * Math.cos(angle);
  }
  return (Math.atan2(s, c) / (2 * Math.PI)) * 100;
}

/** The 12 pitch classes, each gathering the bins within half a semitone of it (tuned). */
export function chromaOf(hist: Float64Array, tuning: number): number[] {
  const chroma = new Array(12).fill(0);
  for (let b = 0; b < BINS; b++) {
    const semis = (b * 10 - tuning) / 100;
    const pc = Math.round(semis);
    chroma[((pc % 12) + 12) % 12] += hist[b] * Math.cos(Math.PI * (semis - pc)) ** 2;
  }
  return chroma;
}

export function keyFromChroma(chroma: number[], tuning = 0): KeyResult {
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
  return { key: scores[0].key, confidence, ranking: scores.map((s) => s.key), tuning, chroma };
}

export function detectKey(samples: Float32Array, sampleRate: number): KeyResult {
  const hist = pitchHistogram(samples, sampleRate);
  const measured = tuningOf(hist);
  const tuning = Math.abs(measured) > TUNE_ABOVE ? measured : 0;
  return keyFromChroma(chromaOf(hist, tuning), tuning);
}
