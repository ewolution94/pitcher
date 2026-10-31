// Scoring for the evaluation: keys as MIREX does it (a fifth either way, the relative, the parallel),
// tempos as the tempo literature does (Accuracy1 and 2) and as Pitcher needs it (within 0.5 %, half
// and double allowed, since the app reads those on its own).

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "C minor", "F# major", "Gb aeolian", "Bbm", "A♭", "8A" → { pc, minor }; null for anything else. */
export function parseKey(text) {
  if (!text) return null;
  const t = text.trim().replace('♯', '#').replace('♭', 'b');
  const cam = t.match(/^(\d{1,2})\s*([AB])$/i);
  if (cam) {
    const n = Number(cam[1]), minor = cam[2].toUpperCase() === 'A';
    return { pc: ((((n - 8) * 7 + (minor ? 9 : 0)) % 12) + 12) % 12, minor };
  }
  const m = t.match(/^([A-Ga-g])\s*(#|b)?\s*(.*)$/);
  if (!m) return null;
  const pc = PC[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const rest = m[3].toLowerCase().trim();
  // The minor family and the major family; modal labels fold into them the usual way.
  let minor;
  if (rest === '' || /^(maj|major|ionian|mixolydian|lydian)\b/.test(rest)) minor = false;
  else if (/^(m|min|minor|aeolian|dorian|phrygian|harmonic|melodic)\b/.test(rest)) minor = true;
  else return null;
  return { pc: ((pc % 12) + 12) % 12, minor };
}

/** correct | fifth (either way, same mode) | relative | parallel | other */
export function category(ref, est) {
  if (ref.pc === est.pc && ref.minor === est.minor) return 'correct';
  const d = (est.pc - ref.pc + 12) % 12;
  if (ref.minor === est.minor && (d === 7 || d === 5)) return 'fifth';
  if (!ref.minor && est.minor && d === 9) return 'relative';
  if (ref.minor && !est.minor && d === 3) return 'relative';
  if (ref.minor !== est.minor && d === 0) return 'parallel';
  return 'other';
}

export const WEIGHT = { correct: 1, fifth: 0.5, relative: 0.3, parallel: 0.2, other: 0 };

const within = (est, ref, tol) => Math.abs(est - ref) <= tol * ref;

export function tempoScores(est, ref) {
  return {
    exact: Math.round(est) === Math.round(ref),
    acc1: within(est, ref, 0.04),
    acc2: [1, 2, 3, 1 / 2, 1 / 3].some((f) => within(est, ref * f, 0.04)),
    usable: [1, 2, 1 / 2].some((f) => Math.abs(est - ref * f) <= 0.005 * ref * f),
  };
}

const pct = (n, of) => (of ? ((n / of) * 100).toFixed(1) : '–');

/** The summary lines for a set of rows ({ cat, top2, conf } for keys, tempo scores for tempos). */
export function summary(rows, label = '') {
  const out = [];
  const keyed = rows.filter((r) => r.cat);
  if (keyed.length) {
    const n = keyed.length;
    const c = (k) => keyed.filter((r) => r.cat === k).length;
    const weighted = keyed.reduce((s, r) => s + WEIGHT[r.cat], 0) / n;
    out.push(
      `${label}key (n=${n}): correct ${pct(c('correct'), n)} %, weighted ${(weighted * 100).toFixed(1)}; ` +
        `fifth ${pct(c('fifth'), n)}, relative ${pct(c('relative'), n)}, parallel ${pct(c('parallel'), n)}, other ${pct(c('other'), n)}; ` +
        `in the top two ${pct(keyed.filter((r) => r.top2).length, n)} %`,
    );
    const refMinor = keyed.filter((r) => r.refMinor);
    const refMajor = keyed.filter((r) => !r.refMinor);
    out.push(
      `${label}  minor tracks (n=${refMinor.length}) correct ${pct(refMinor.filter((r) => r.cat === 'correct').length, refMinor.length)} %; ` +
        `major tracks (n=${refMajor.length}) correct ${pct(refMajor.filter((r) => r.cat === 'correct').length, refMajor.length)} %`,
    );
    const sorted = [...keyed].sort((a, b) => a.conf - b.conf);
    const parts = [];
    for (let q = 0; q < 4; q++) {
      const part = sorted.slice(Math.floor((q * n) / 4), Math.floor(((q + 1) * n) / 4));
      if (part.length) parts.push(`${part[0].conf.toFixed(2)}–${part.at(-1).conf.toFixed(2)}: ${pct(part.filter((r) => r.cat === 'correct').length, part.length)} %`);
    }
    out.push(`${label}  correct by confidence quarter: ${parts.join(' | ')}`);
  }
  const timed = rows.filter((r) => r.acc1 != null);
  if (timed.length) {
    const n = timed.length;
    const c = (k) => timed.filter((r) => r[k]).length;
    out.push(`${label}tempo (n=${n}): usable ${pct(c('usable'), n)} %, exact integer ${pct(c('exact'), n)}, Accuracy1 ${pct(c('acc1'), n)}, Accuracy2 ${pct(c('acc2'), n)}`);
  }
  return out.join('\n');
}
