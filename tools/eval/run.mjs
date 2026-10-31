// Measures the key and tempo detection on a set with known answers, on every core. Local only, never
// in CI: the audio isn't ours to put there. The sets go in ../datasets next to the repo (see
// tools/eval/README.md).
//
//   npm run eval -- --set giantsteps            the test set (600 EDM excerpts)
//   npm run eval -- --set beatport               the set to tune on (1486 EDM excerpts)
//   npm run eval -- --set csv:<file> <dir>       your own tracks: file,key,bpm
//   options: --src <src/lib of another tree> --rate 48000 --jobs N --limit N --out results.json
//            --detune <cents>: every track pitched up (or down) first, to check the tuning correction

import { cpus } from 'node:os';
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { category, parseKey, summary, tempoScores } from './score.mjs';
import { idOf, loadTruth } from './truth.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const value = args[i + 1];
  args.splice(i, 2);
  return value;
};
const set = opt('set', 'giantsteps');
const src = resolve(opt('src', join(here, '../../src/lib')));
const data = resolve(opt('data', join(here, '../../../datasets')));
const rate = Number(opt('rate', '48000'));
const jobs = Number(opt('jobs', String(Math.max(1, cpus().length - 1))));
const limit = Number(opt('limit', '0'));
const out = opt('out', '');
const detune = Number(opt('detune', '0'));

const { truth, audio } = loadTruth(set, data);
const AUDIO = /\.(mp3|wav|flac|m4a|aac|ogg|opus|aiff?)$/i;
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f.startsWith('__') ? [] : walk(p)) : AUDIO.test(f) ? [p] : [];
});
let files = (args.length ? args : [audio]).flatMap((a) => (statSync(a).isDirectory() ? walk(a) : [a])).filter((f) => truth.has(idOf(f))).sort();
if (limit) files = files.slice(0, limit);
console.log(`${set}: ${files.length} tracks with answers, ${jobs} workers, ${rate} Hz${detune ? `, detuned ${detune} cents` : ''}, analysis from ${src}`);

const rows = [];
let next = 0, done = 0;
const started = performance.now();
await new Promise((finish) => {
  if (!files.length) return finish();
  const workers = Array.from({ length: Math.min(jobs, files.length) }, () => new Worker(join(here, 'worker.mjs'), { workerData: { src, rate, detune } }));
  const feed = (w) => {
    if (next < files.length) w.postMessage({ file: files[next++] });
    else w.terminate();
  };
  for (const w of workers) {
    w.on('message', (res) => {
      done++;
      if (!res.ok) console.error(`  ${idOf(res.file)}: ${res.error}`);
      else {
        const ref = truth.get(idOf(res.file));
        const row = { id: idOf(res.file), genre: ref.genre, bpm: res.bpm, conf: res.conf, ms: res.ms, key: res.key, ranking: res.ranking, chroma: res.chroma, tuning: res.tuning, refKey: ref.key, refBpm: ref.bpm };
        const refKey = parseKey(ref.key);
        if (refKey) {
          row.refMinor = refKey.minor;
          row.cat = category(refKey, res.key);
          row.top2 = res.ranking.slice(0, 2).some((k) => category(refKey, k) === 'correct');
        }
        if (ref.bpm) Object.assign(row, tempoScores(res.bpm, ref.bpm));
        rows.push(row);
      }
      if (done % 100 === 0) console.log(`  ${done} / ${files.length}`);
      if (done === files.length) finish();
      feed(w);
    });
    feed(w);
  }
});

console.log(`\n${summary(rows)}`);
const byGenre = new Map();
for (const r of rows) byGenre.set(r.genre, [...(byGenre.get(r.genre) ?? []), r]);
const genres = [...byGenre].filter(([, rs]) => rs.filter((r) => r.cat).length >= 25).sort((a, b) => b[1].length - a[1].length);
if (genres.length > 1) {
  console.log('\nby genre (25 tracks or more):');
  for (const [genre, rs] of genres) {
    const keyed = rs.filter((r) => r.cat);
    console.log(`  ${genre.padEnd(22)} key correct ${((keyed.filter((r) => r.cat === 'correct').length / keyed.length) * 100).toFixed(0).padStart(3)} % (n=${keyed.length})`);
  }
}
const ms = rows.reduce((s, r) => s + r.ms, 0) / (rows.length || 1);
console.log(`\n${rows.length} tracks in ${((performance.now() - started) / 1000).toFixed(0)} s; analysis ${ms.toFixed(0)} ms a track`);
if (out) {
  writeFileSync(out, JSON.stringify({ set, src, rate, rows }));
  console.log(`wrote ${out}`);
}
