// The analysis on made-up audio with known answers: click tracks at set tempos, chords in set keys.

import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBands } from '../src/lib/analysis/bands.ts';
import { detectGrid, barAt, barStart, barBeat, hookTime } from '../src/lib/analysis/tempo.ts';
import { detectKey } from '../src/lib/analysis/key.ts';
import { keyName } from '../src/lib/music.ts';

const RATE = 44100;

/** A kick on every beat (a falling sine), a hat between; `first` seconds of silence before beat 1. */
function drumTrack(bpm, seconds, first = 0.25) {
  const out = new Float32Array(Math.round(seconds * RATE));
  const beat = 60 / bpm;
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let k = 0; first + k * beat < seconds; k++) {
    const kick = Math.round((first + k * beat) * RATE);
    for (let i = 0; i < 0.18 * RATE && kick + i < out.length; i++) {
      const t = i / RATE;
      const accent = k % 4 === 0 ? 1 : 0.75;
      out[kick + i] += accent * 0.8 * Math.exp(-t / 0.06) * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t / 0.02)) * t);
    }
    const hat = Math.round((first + (k + 0.5) * beat) * RATE);
    for (let i = 0; i < 0.04 * RATE && hat + i < out.length; i++) out[hat + i] += 0.2 * Math.exp(-i / RATE / 0.01) * noise();
  }
  return out;
}

function chords(progression, seconds) {
  const out = new Float32Array(Math.round(seconds * RATE));
  const each = out.length / progression.length;
  progression.forEach((freqs, c) => {
    for (let i = Math.floor(c * each); i < Math.floor((c + 1) * each); i++) {
      const t = i / RATE;
      let s = 0;
      for (const f of freqs) s += Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t);
      out[i] = (0.25 * s) / freqs.length;
    }
  });
  return out;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
const triad = (root, minor) => [hz(root), hz(root + (minor ? 3 : 4)), hz(root + 7), hz(root - 12)];

for (const bpm of [100, 124, 128, 140]) {
  test(`a click track at ${bpm} BPM reads as ${bpm}, with the downbeat on the first click`, () => {
    const grid = detectGrid(computeBands(drumTrack(bpm, 40), RATE));
    assert.ok(Math.abs(grid.bpm - bpm) < 0.05, `read ${grid.bpm}`);
    const bar = 240 / bpm;
    const off = Math.min(Math.abs(grid.offset - 0.25), Math.abs(grid.offset - 0.25 - bar), Math.abs(grid.offset + bar - 0.25));
    assert.ok(off < 0.03, `downbeat at ${grid.offset.toFixed(3)} s, expected 0.25 s`);
  });
}

for (const bpm of [87, 174]) {
  test(`an exact ${bpm} BPM reads as a whole tempo (or its half or double), not ${bpm - 0.01}`, () => {
    const read = detectGrid(computeBands(drumTrack(bpm, 40), RATE)).bpm;
    assert.ok([bpm, bpm / 2, bpm * 2].includes(read), `read ${read}`);
  });
}

test('a fractional tempo stays fractional', () => {
  const grid = detectGrid(computeBands(drumTrack(117.5, 40), RATE));
  assert.ok(Math.abs(grid.bpm - 117.5) < 0.05, `read ${grid.bpm}`);
});

test('silence and a short clip give a neutral grid, not an error', () => {
  const grid = detectGrid(computeBands(new Float32Array(RATE * 2), RATE));
  assert.equal(grid.bpm, 120);
  assert.equal(grid.confidence, 0);
});

test('A minor chords read as A minor', () => {
  // Am, Dm, Em, Am: i, iv, v, i.
  const audio = chords([triad(57, true), triad(62, true), triad(64, true), triad(57, true)], 12);
  assert.equal(keyName(detectKey(audio, RATE).key), 'Am');
});

test('C major chords read as C major', () => {
  // C, F, G, C: I, IV, V, I.
  const audio = chords([triad(60, false), triad(65, false), triad(67, false), triad(60, false)], 12);
  assert.equal(keyName(detectKey(audio, RATE).key), 'C');
});

test('F♯ minor reads as F♯ minor at 48 kHz too', () => {
  const rate = 48000;
  const out = new Float32Array(rate * 10);
  const progression = [triad(66, true), triad(71, true), triad(73, true), triad(66, true)];
  const each = out.length / progression.length;
  progression.forEach((freqs, c) => {
    for (let i = Math.floor(c * each); i < Math.floor((c + 1) * each); i++) {
      let s = 0;
      for (const f of freqs) s += Math.sin((2 * Math.PI * f * i) / rate);
      out[i] = (0.25 * s) / freqs.length;
    }
  });
  assert.equal(keyName(detectKey(out, rate).key), 'F♯m');
});

test('an upload 40 cents sharp still reads in its key, the tuning measured', () => {
  // Am, Dm, Em, Am, every note 40 cents sharp: without the tuning correction it can slip a semitone.
  const sharp = (freqs) => freqs.map((f) => f * 2 ** (40 / 1200));
  const audio = chords([triad(57, true), triad(62, true), triad(64, true), triad(57, true)].map(sharp), 12);
  const result = detectKey(audio, RATE);
  assert.equal(keyName(result.key), 'Am');
  assert.ok(Math.abs(result.tuning - 40) < 8, `tuning read as ${result.tuning.toFixed(1)} cents`);
});

test('the key comes with a runner-up and a confidence', () => {
  const audio = chords([triad(60, false), triad(65, false), triad(67, false), triad(60, false)], 12);
  const result = detectKey(audio, RATE);
  assert.equal(result.ranking.length, 24);
  assert.deepEqual(result.ranking[0], result.key);
  assert.notDeepEqual(result.ranking[1], result.key);
  assert.ok(result.confidence >= 0 && result.confidence <= 1);
});

test('bars and beats from the grid', () => {
  const g = { bpm: 120, offset: 0.5 };
  assert.equal(barStart(1, g), 0.5);
  assert.equal(barStart(3, g), 4.5);
  assert.equal(barAt(4.6, g), 3);
  assert.equal(barAt(0.1, g), 1);
  assert.equal(barBeat(5.0, g), '3.2');
});

test('the hook is the bar at the most replayed peak, past the opening', () => {
  const heat = Array.from({ length: 100 }, (_, i) => (i === 1 ? 1 : i === 40 ? 0.9 : 0.1));
  // The opening spike (index 1) is skipped; index 40 of 100 over 200 s is 80 s, bar 41 at 120 BPM.
  assert.equal(hookTime(heat, 200, { bpm: 120, offset: 0 }), 80);
  assert.equal(hookTime([], 200, { bpm: 120, offset: 0 }), null);
});
