// Keys, the Camelot wheel, tempo ratios and how the numbers are written. Pure functions: the page,
// the analysis worker and the unit tests all use them.

export const MINOR_KEYS = ['Cm', 'C♯m', 'Dm', 'E♭m', 'Em', 'Fm', 'F♯m', 'Gm', 'A♭m', 'Am', 'B♭m', 'Bm'];
export const MAJOR_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** A key by its pitch class (C = 0) and mode. */
export interface Key {
  pc: number;
  minor: boolean;
}

export const keyName = (k: Key) => (k.minor ? MINOR_KEYS : MAJOR_KEYS)[mod(k.pc, 12)];

/** The Camelot number: 8A is A minor, 8B is C major, and a fifth up is one step clockwise. */
export const camelotNumber = (k: Key) => mod(mod((k.pc - (k.minor ? 9 : 0)) * 7, 12) + 7, 12) + 1;
export const camelot = (k: Key) => `${camelotNumber(k)}${k.minor ? 'A' : 'B'}`;

export function keyFromCamelot(n: number, minor: boolean): Key {
  for (let pc = 0; pc < 12; pc++) if (camelotNumber({ pc, minor }) === n) return { pc, minor };
  return { pc: 0, minor };
}

export const transpose = (k: Key, semitones: number): Key => ({ pc: mod(k.pc + Math.round(semitones), 12), minor: k.minor });

/** The smallest shift from one key to another of the same mode: −5 to +6 semitones. */
export function shortestShift(from: Key, to: Key): number {
  const d = mod(to.pc - from.pc, 12);
  return d > 6 ? d - 12 : d;
}

/** Semitones a tempo ratio moves the pitch when the pitch follows the tempo (Resample). */
export const semitonesOf = (ratio: number) => 12 * Math.log2(ratio);

/**
 * Half or double time: the reading of the source tempo closest to the target. A 116 track aimed at
 * 174 reads as 232 (−25 %) rather than +50 %. Ties go to the plain reading.
 */
export function bestMultiple(source: number, target: number): 0.5 | 1 | 2 {
  let best: 0.5 | 1 | 2 = 1;
  let distance = Infinity;
  for (const m of [1, 2, 0.5] as const) {
    const d = Math.abs(Math.log(target / (source * m)));
    if (d < distance - 1e-9) {
      distance = d;
      best = m;
    }
  }
  return best;
}

/** Any tempo within reason: a 100 BPM track at 300 is the user's call, not ours. */
export const MIN_BPM = 20;
export const MAX_BPM = 400;

const MINUS = '−';

export function formatSigned(n: number, digits = 0): string {
  const text = Math.abs(n).toFixed(digits);
  if (+text === 0) return `±${text}`;
  return (n > 0 ? '+' : MINUS) + text;
}

/** The change as a percentage: "+10.3%", "−25.0%", "±0.0%". */
export const formatPercent = (ratio: number, digits = 1) => `${formatSigned((ratio - 1) * 100, digits)}%`;

/** A shift in semitones: "±0 st", "+2 st", "−1.16 st". */
export function formatShift(s: number): string {
  if (Math.abs(s) < 0.005) return '±0 st';
  const a = Math.abs(s);
  const text = Math.abs(a - Math.round(a)) < 0.005 ? String(Math.round(a)) : a.toFixed(2);
  return `${s > 0 ? '+' : MINUS}${text} st`;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

/** A typed tempo: "128", "128.5", "128,5". Null when it isn't one. */
export function parseBpm(text: string): number | null {
  const n = parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n >= MIN_BPM && n <= MAX_BPM ? n : null;
}
