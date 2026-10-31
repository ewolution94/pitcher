// The source tempo and where its beats fall. The bands' energy becomes an onset envelope (how
// sharply each band gets louder, every 10 ms); its autocorrelation picks the tempo's rough
// neighbourhood, and folding the whole envelope at each candidate period picks the exact tempo and
// the beat's phase: at the right period every beat lands in the same few bins, at a slightly wrong
// one they smear across the track. The tempos a third away are folded too: drum & bass at 174 often
// repeats every three eighths, which the autocorrelation reads as 116, and folded at 116 its beats
// fall in three places. The bar's first beat is the one where the lows hit hardest. Measured with
// `npm run eval` on GiantSteps+: usable (within 0.5 %, half and double allowed) 91.7 %, from 88.4 %.

import type { Bands } from './bands.ts';

export interface Grid {
  /** Beats per minute of the source. */
  bpm: number;
  /** Seconds to the first downbeat (0 ≤ offset < one bar). */
  offset: number;
  /** 0–1, how clearly one tempo stood out. */
  confidence: number;
}

const BINS = 64;

function median(values: Float32Array): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

/** How sharply the sound gets louder at each frame, the lows weighted most. */
export function onsetEnvelope(b: Bands): { all: Float32Array; low: Float32Array } {
  const n = b.loE.length;
  const all = new Float32Array(n);
  const low = new Float32Array(n);
  const bands: [Float32Array, number][] = [[b.loE, 1], [b.miE, 0.7], [b.hiE, 0.5]];
  for (const [energy, weight] of bands) {
    const scale = 1 / (median(energy) + 1e-9);
    let previous = Math.log1p(energy[0] * scale);
    for (let i = 1; i < n; i++) {
      const level = Math.log1p(energy[i] * scale);
      const rise = Math.max(0, level - previous);
      all[i] += weight * rise;
      if (energy === b.loE) low[i] = rise;
      previous = level;
    }
  }
  // Minus a running mean (0.2 s), so steady loudness doesn't count, only its rises.
  const half = 10;
  const smoothed = new Float32Array(n);
  let sum = 0;
  for (let i = 0; i < n + half; i++) {
    if (i < n) sum += all[i];
    if (i - 2 * half - 1 >= 0) sum -= all[i - 2 * half - 1];
    const centre = i - half;
    if (centre >= 0 && centre < n) {
      const count = Math.min(n - 1, centre + half) - Math.max(0, centre - half) + 1;
      smoothed[centre] = Math.max(0, all[centre] - sum / count);
    }
  }
  return { all: smoothed, low };
}

/** A gentle preference for tempos near 125: it decides between a tempo and its half or double. */
const prior = (bpm: number) => Math.exp(-0.5 * (Math.log2(bpm / 125) / 0.8) ** 2);

/** Besides the autocorrelation's tempo: the tempos a third away, where it most often goes wrong. */
const THIRDS = [3 / 2, 2 / 3, 4 / 3, 3 / 4];
/** The autocorrelation's own tempo wins unless another folds this much better. */
const FAVOUR = 1.05;

/** The envelope folded at one period: how sharply the beats line up, and at which phase. */
function fold(env: Float32Array, period: number): { score: number; phase: number } {
  const bins = new Float64Array(BINS);
  let total = 0;
  for (let i = 0; i < env.length; i++) {
    const v = env[i];
    if (v === 0) continue;
    const p = i / period;
    bins[Math.floor((p - Math.floor(p)) * BINS) % BINS] += v;
    total += v;
  }
  let best = 0;
  let at = 0;
  for (let k = 0; k < BINS; k++) {
    const s = bins[(k + BINS - 1) % BINS] * 0.5 + bins[k] + bins[(k + 1) % BINS] * 0.5;
    if (s > best) {
      best = s;
      at = k;
    }
  }
  return { score: total > 0 ? best / total : 0, phase: ((at + 0.5) / BINS) * period };
}

/**
 * The exact tempo within ±3 % of a guess, in steps of 0.01 BPM: the sharpest fold, its scores averaged
 * over the two steps either side, so the bins' jaggedness can't pull it off a whole tempo (an exact
 * 87 read as 86.99). Most produced music sits on a whole tempo: it's taken when it folds about as well
 * (played drums, Get Lucky's, drift a little, so "about as well" is generous).
 */
function refine(env: Float32Array, fps: number, guess: number): { bpm: number; best: { score: number; phase: number } } {
  const tempos: number[] = [];
  const folds: { score: number; phase: number }[] = [];
  for (let t = guess * 0.97; t <= guess * 1.03; t += 0.01) {
    tempos.push(t);
    folds.push(fold(env, (60 * fps) / t));
  }
  const smooth = folds.map((_, i) => {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(folds.length - 1, i + 2); j++, count++) sum += folds[j].score;
    return sum / count;
  });
  let at = 0;
  for (let i = 1; i < smooth.length; i++) if (smooth[i] > smooth[at]) at = i;
  const whole = Math.round(tempos[at]);
  if (Math.abs(whole - tempos[at]) < 0.12) {
    let near = 0;
    for (let i = 1; i < tempos.length; i++) if (Math.abs(tempos[i] - whole) < Math.abs(tempos[near] - whole)) near = i;
    if (smooth[near] >= smooth[at] * 0.9) return { bpm: whole, best: { score: smooth[near], phase: fold(env, (60 * fps) / whole).phase } };
  }
  return { bpm: tempos[at], best: { score: smooth[at], phase: folds[at].phase } };
}

export function detectGrid(b: Bands): Grid {
  const fps = b.fps;
  const { all: env, low } = onsetEnvelope(b);
  const n = env.length;
  if (n < fps * 4) return { bpm: 120, offset: 0, confidence: 0 };

  // 1. The neighbourhood: autocorrelation between 50 and 240 BPM, weighted by the prior.
  const minLag = Math.floor((60 * fps) / 240);
  const maxLag = Math.ceil((60 * fps) / 50);
  const acf = new Float64Array(maxLag + 2);
  for (let lag = minLag - 1; lag <= maxLag + 1; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += env[i] * env[i + lag];
    acf[lag] = s / (n - lag);
  }
  let bestLag = minLag;
  let bestValue = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const value = acf[lag] * prior((60 * fps) / lag);
    if (value > bestValue) {
      bestValue = value;
      bestLag = lag;
    }
  }
  const a = acf[bestLag - 1], c = acf[bestLag + 1], m = acf[bestLag];
  const shift = a - 2 * m + c !== 0 ? (0.5 * (a - c)) / (a - 2 * m + c) : 0;
  const rough = (60 * fps) / (bestLag + Math.max(-0.5, Math.min(0.5, shift)));

  // 2. The exact tempo: near the rough one, or near a tempo a third away when that folds clearly
  //    better.
  let { bpm, best } = refine(env, fps, rough);
  let bar = best.score * FAVOUR;
  for (const k of THIRDS) {
    const guess = rough * k;
    if (guess < 50 || guess > 240) continue;
    const other = refine(env, fps, guess);
    if (other.best.score > bar) {
      ({ bpm, best } = other);
      bar = other.best.score;
    }
  }

  // 3. The downbeat: of the four beats, the one where the lows rise most.
  const period = (60 * fps) / bpm;
  const strength = [0, 0, 0, 0];
  for (let k = 0; ; k++) {
    const at = Math.round(best.phase + k * period);
    if (at >= n) break;
    let s = 0;
    for (let d = -1; d <= 1; d++) s += low[at + d] ?? 0;
    strength[k % 4] += s;
  }
  const first = strength.indexOf(Math.max(...strength));
  const offset = ((best.phase + first * period) / fps) % ((4 * period) / fps);

  const confidence = Math.max(0, Math.min(1, (best.score * BINS) / 8 - 0.25));
  return { bpm: Math.round(bpm * 100) / 100, offset, confidence };
}

// ---------------------------------------------------------------------------------------------
// The grid in time

export const beatLength = (bpm: number) => 60 / bpm;
export const barLength = (bpm: number) => 240 / bpm;

/** The bar (1-based) a source time falls in. */
export function barAt(t: number, g: Pick<Grid, 'bpm' | 'offset'>): number {
  return Math.max(1, Math.floor((t - g.offset) / barLength(g.bpm)) + 1);
}

/** Where a bar (1-based) starts, in source seconds; may be before 0 for bar 1 of a late start. */
export const barStart = (bar: number, g: Pick<Grid, 'bpm' | 'offset'>) => g.offset + (bar - 1) * barLength(g.bpm);

/** "33.1": bar and beat at a source time. */
export function barBeat(t: number, g: Pick<Grid, 'bpm' | 'offset'>): string {
  const beats = Math.max(0, (t - g.offset) / beatLength(g.bpm));
  return `${Math.floor(beats / 4) + 1}.${(Math.floor(beats) % 4) + 1}`;
}

/** The hook: the start of the bar at YouTube's "most replayed" peak, past the first few seconds. */
export function hookTime(heatmap: number[], duration: number, g: Pick<Grid, 'bpm' | 'offset'>): number | null {
  if (heatmap.length < 4 || !duration) return null;
  const skip = Math.ceil(heatmap.length * 0.04);
  let at = -1;
  let best = -Infinity;
  for (let i = skip; i < heatmap.length; i++) {
    if (heatmap[i] > best) {
      best = heatmap[i];
      at = i;
    }
  }
  if (at < 0) return null;
  const peak = (at / heatmap.length) * duration;
  return Math.max(0, barStart(barAt(peak, g), g));
}
