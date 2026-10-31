// The ground truth of the sets the evaluation knows, keyed by the track's id (the number its files
// start with): GiantSteps+ (600 EDM excerpts, keys revised by an expert, modal labels) and the
// Beatport EDM Key Dataset (1486 excerpts), both from Zenodo under CC BY-SA 4.0, unpacked into
// ../datasets next to the repo; or a CSV of file,key,bpm[,genre].

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const idOf = (name) => basename(name, extname(name)).match(/^\d+/)?.[0] ?? basename(name, extname(name));
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

function metadata(dir) {
  const out = new Map();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    // Some of the sets' metadata files aren't valid JSON ("exclusive": ,): read those two fields by hand.
    const text = readFileSync(join(dir, f), 'utf8');
    let bpm = null, genre = '';
    try {
      const d = JSON.parse(text);
      bpm = Number(d.bpm) || null;
      genre = d.genres?.[0]?.name ?? '';
    } catch {
      bpm = Number(text.match(/"bpm":\s*(\d+(\.\d+)?)/)?.[1]) || null;
      genre = text.match(/"genres":\s*\[\s*\{[^}]*?"name":\s*"([^"]+)"/)?.[1] ?? '';
    }
    out.set(idOf(f), { bpm, genre });
  }
  return out;
}

/** id → { key, bpm, genre } */
export function loadTruth(set, data) {
  const truth = new Map();
  if (set === 'giantsteps') {
    const dir = join(data, 'giantsteps-plus');
    const meta = metadata(join(dir, 'meta'));
    for (const f of readdirSync(join(dir, 'new_annotations'))) {
      if (!f.endsWith('.json')) continue;
      const d = json(join(dir, 'new_annotations', f));
      const id = idOf(f);
      // One key for the whole excerpt only: key changes and "other" are left out of the key score.
      const key = Array.isArray(d.key) && d.key.length === 1 ? d.key[0] : null;
      truth.set(id, { key, bpm: meta.get(id)?.bpm ?? null, genre: meta.get(id)?.genre ?? '' });
    }
    return { truth, audio: join(dir, 'audio') };
  }
  if (set === 'beatport') {
    const dir = join(data, 'beatport-edm-key');
    const meta = metadata(join(dir, 'meta'));
    for (const f of readdirSync(join(dir, 'keys'))) {
      if (!f.endsWith('.txt')) continue;
      const id = idOf(f);
      const key = readFileSync(join(dir, 'keys', f), 'utf8').trim();
      truth.set(id, { key: key || null, bpm: meta.get(id)?.bpm ?? null, genre: meta.get(id)?.genre ?? '' });
    }
    return { truth, audio: join(dir, 'audio') };
  }
  if (set.startsWith('csv:')) {
    const lines = readFileSync(set.slice(4), 'utf8').trim().split('\n').slice(1);
    for (const line of lines) {
      const [file, key, bpm, genre] = line.split(',');
      truth.set(idOf(file), { key: key || null, bpm: Number(bpm) || null, genre: genre ?? '' });
    }
    return { truth, audio: null };
  }
  throw new Error(`Unknown set: ${set} (giantsteps, beatport or csv:<file>)`);
}

export { idOf };
