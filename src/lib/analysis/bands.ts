// The waveform's three bands, the way DJ software colours it: lows (below ~150 Hz, the kick and the
// bass), mids, and highs (above ~2.5 kHz, hats and air). One value per band every 10 ms: the peak
// for drawing, the energy for finding the beats.

export const FPS = 100;

export interface Bands {
  fps: number;
  /** Peak per frame, 0–1 after normalising each band. */
  lo: Float32Array;
  mi: Float32Array;
  hi: Float32Array;
  /** Energy per frame (mean square), not normalised: the tempo reads these. */
  loE: Float32Array;
  miE: Float32Array;
  hiE: Float32Array;
}

/** Two cascaded one-pole low-passes: soft, but cheap enough for a whole track in a worker. */
function lowpassCoefficient(cutoff: number, sampleRate: number) {
  return 1 - Math.exp((-2 * Math.PI * cutoff) / sampleRate);
}

export function computeBands(samples: Float32Array, sampleRate: number): Bands {
  const hop = Math.round(sampleRate / FPS);
  const frames = Math.max(1, Math.ceil(samples.length / hop));
  const lo = new Float32Array(frames), mi = new Float32Array(frames), hi = new Float32Array(frames);
  const loE = new Float32Array(frames), miE = new Float32Array(frames), hiE = new Float32Array(frames);

  const aLow = lowpassCoefficient(150, sampleRate);
  const aMid = lowpassCoefficient(2500, sampleRate);
  let l1 = 0, l2 = 0, m1 = 0, m2 = 0;

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const end = Math.min(samples.length, start + hop);
    let pl = 0, pm = 0, ph = 0, el = 0, em = 0, eh = 0;
    for (let i = start; i < end; i++) {
      const x = samples[i];
      l1 += aLow * (x - l1);
      l2 += aLow * (l1 - l2);
      m1 += aMid * (x - m1);
      m2 += aMid * (m1 - m2);
      const low = l2;
      const mid = m2 - l2;
      const high = x - m2;
      const al = Math.abs(low), am = Math.abs(mid), ah = Math.abs(high);
      if (al > pl) pl = al;
      if (am > pm) pm = am;
      if (ah > ph) ph = ah;
      el += low * low;
      em += mid * mid;
      eh += high * high;
    }
    const n = Math.max(1, end - start);
    lo[f] = pl;
    mi[f] = pm;
    hi[f] = ph;
    loE[f] = el / n;
    miE[f] = em / n;
    hiE[f] = eh / n;
  }

  for (const band of [lo, mi, hi]) normalise(band);
  return { fps: FPS, lo, mi, hi, loE, miE, hiE };
}

/** Scales a band so its loud parts reach 1 (the 99.5th percentile, so one click doesn't flatten the rest). */
function normalise(band: Float32Array) {
  const sorted = Float32Array.from(band).sort();
  const top = sorted[Math.floor(sorted.length * 0.995)] || sorted[sorted.length - 1] || 1;
  const scale = top > 0 ? 1 / top : 1;
  for (let i = 0; i < band.length; i++) band[i] = Math.min(1, band[i] * scale);
}

/** A mono mix of the channels, for analysis. */
export function mixDown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const ch of channels) for (let i = 0; i < out.length; i++) out[i] += ch[i] / channels.length;
  return out;
}
