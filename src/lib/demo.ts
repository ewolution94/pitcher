// The demo beat behind the start screen's button: made here, so there's nothing anyone else owns in
// it. 24 bars at 116 BPM in F♯ minor: kick, clap, hats, a bass, pads and a plucked arpeggio over
// F♯m, D, C♯ and F♯m (the tonic twice and the major V make the minor unmistakable: i, VI, III, VII
// reads as its relative major, and with Bm in it the key slid to B minor). Rendered sample by sample,
// then wrapped as a WAV file so it loads like any other file: the analysis reads it as 116 and F♯m
// (tests/analysis.test.mjs).

export const DEMO_BPM = 116;
const BARS = 24;
/** The chords, one a bar: MIDI notes of the triad and the bass's root. */
const CHORDS: { triad: number[]; root: number }[] = [
  { triad: [54, 57, 61], root: 30 }, // F♯m
  { triad: [54, 57, 62], root: 38 }, // D
  { triad: [53, 56, 61], root: 37 }, // C♯ (E♯ the leading tone)
  { triad: [54, 57, 61], root: 30 }, // F♯m
];

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A repeatable noise, so the beat is the same every time. */
function noise(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** The beat, mono, at `rate`. */
export function renderDemo(rate = 32000): Float32Array {
  const beat = 60 / DEMO_BPM;
  const out = new Float32Array(Math.ceil(BARS * 4 * beat * rate) + rate);
  const rnd = noise(116);
  const add = (start: number, seconds: number, voice: (t: number) => number) => {
    const a = Math.round(start * rate), n = Math.round(seconds * rate);
    for (let i = 0; i < n && a + i < out.length; i++) out[a + i] += voice(i / rate);
  };

  for (let bar = 0; bar < BARS; bar++) {
    const chord = CHORDS[bar % 4];
    const at = bar * 4 * beat;
    const full = bar >= 2; // two bars of drums and bass, then everything
    for (let b = 0; b < 4; b++) {
      const t0 = at + b * beat;
      // Kick: a falling sine.
      add(t0, 0.32, (t) => Math.sin(2 * Math.PI * (45 * t + (75 / 30) * (1 - Math.exp(-30 * t)))) * Math.exp(-t / 0.09) * 0.9);
      // Clap on two and four: bursts of noise.
      if (b % 2 === 1) add(t0, 0.18, (t) => rnd() * Math.exp(-t / 0.045) * 0.32);
      // Hats on the offbeats.
      add(t0 + beat / 2, 0.06, (t) => {
        const v = rnd();
        return (v - 0.6 * rnd()) * Math.exp(-t / 0.012) * 0.16;
      });
    }
    // Bass: the root in eighths, the octave on the last of each beat.
    for (let e = 0; e < 8; e++) {
      const f = hz(chord.root + (e % 2 === 1 ? 12 : 0) + 12);
      add(at + (e * beat) / 2, beat / 2 - 0.01, (t) => {
        const env = Math.min(1, t / 0.005) * Math.exp(-t / 0.18);
        return (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * env * 0.32;
      });
    }
    if (!full) continue;
    // Pads: the triad, soft, held for the bar.
    const length = 4 * beat;
    for (const note of chord.triad) {
      const f = hz(note);
      add(at, length, (t) => {
        const env = Math.min(1, t / 0.25) * Math.min(1, (length - t) / 0.2);
        return (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t) + 0.1 * Math.sin(6 * Math.PI * f * t)) * env * 0.07;
      });
    }
    // A plucked arpeggio of the chord, up an octave, in eighths.
    const arp = [...chord.triad, chord.triad[1] + 12, chord.triad[2], chord.triad[1], chord.triad[0] + 12, chord.triad[2]];
    arp.forEach((note, e) => {
      const f = hz(note + 12);
      add(at + (e * beat) / 2, beat / 2, (t) => (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t / 0.12) * 0.09);
    });
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  return out;
}

/** The beat as a 16-bit mono WAV file, for the deck to load like any other. */
export function demoFile(name: string): File {
  const rate = 32000;
  const samples = renderDemo(rate);
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => [...s].forEach((c, i) => data.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  data.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true); // PCM
  data.setUint16(22, 1, true); // mono
  data.setUint32(24, rate, true);
  data.setUint32(28, rate * 2, true);
  data.setUint16(32, 2, true);
  data.setUint16(34, 16, true);
  text(36, 'data');
  data.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) data.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), true);
  return new File([data.buffer], `${name}.wav`, { type: 'audio/wav' });
}
