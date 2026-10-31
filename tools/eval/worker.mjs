// One evaluation worker: decodes a file with ffmpeg and runs the analysis worker's steps on it, from
// the source tree it's given (so a branch can be measured against main).

import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { parentPort, workerData } from 'node:worker_threads';

const { src, rate, detune } = workerData;
// Detuning: played faster by the ratio and resampled back, so every pitch moves by `detune` cents.
const filter = detune ? ['-af', `aresample=${rate},asetrate=${rate}*${2 ** (detune / 1200)},aresample=${rate}`] : [];
const { computeBands, mixDown } = await import(join(src, 'analysis/bands.ts'));
const { detectGrid } = await import(join(src, 'analysis/tempo.ts'));
const keyModule = await import(join(src, 'analysis/key.ts'));

// The source trees before the runner-up existed only give the best key: rank the keys the way they
// did (Krumhansl–Kessler on the chroma), so every tree is scored on its top two.
const KK_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const KK_MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
function kkRanking(chroma) {
  const corr = (a, b) => {
    const ma = a.reduce((s, v) => s + v) / 12, mb = b.reduce((s, v) => s + v) / 12;
    let n = 0, da = 0, db = 0;
    for (let i = 0; i < 12; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
    return da && db ? n / Math.sqrt(da * db) : 0;
  };
  const s = [];
  for (let pc = 0; pc < 12; pc++) for (const minor of [false, true]) {
    const p = minor ? KK_MINOR : KK_MAJOR;
    s.push({ key: { pc, minor }, r: corr(chroma, Array.from({ length: 12 }, (_, i) => p[(i - pc + 12) % 12])) });
  }
  return s.sort((a, b) => b.r - a.r).map((x) => x.key);
}

function decode(path) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', path, ...filter, '-f', 'f32le', '-ac', '2', '-ar', String(rate), '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (c) => chunks.push(c));
    p.stderr.on('data', (c) => (err += c));
    p.on('close', (code) => {
      if (code) return reject(new Error(err.trim() || `ffmpeg exited ${code}`));
      const buf = Buffer.concat(chunks);
      const all = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4));
      const n = all.length / 2, l = new Float32Array(n), r = new Float32Array(n);
      for (let i = 0; i < n; i++) { l[i] = all[2 * i]; r[i] = all[2 * i + 1]; }
      resolve([l, r]);
    });
  });
}

parentPort.on('message', async ({ file }) => {
  try {
    const channels = await decode(file);
    const t0 = performance.now();
    const mono = mixDown(channels);
    const grid = detectGrid(computeBands(mono, rate));
    const key = keyModule.detectKey(mono, rate);
    const ms = performance.now() - t0;
    const ranking = key.ranking ?? kkRanking(key.chroma);
    parentPort.postMessage({ file, ok: true, ms, bpm: grid.bpm, key: key.key, conf: key.confidence, ranking: ranking.slice(0, 3), chroma: key.chroma, tuning: key.tuning ?? null });
  } catch (err) {
    parentPort.postMessage({ file, ok: false, error: String(err?.message ?? err) });
  }
});
