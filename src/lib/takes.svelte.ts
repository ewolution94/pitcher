// Takes: a test's settings saved for the track on the deck, to compare them. Up to nine per track,
// kept on the device; a take is recalled on the next beat. Two of them, A (the one playing) and B,
// can flip every 4, 8 or 16 bars, counted in the source's bars, so a loop shorter than that still
// flips.

import { untrack } from 'svelte';
import { barLength } from './analysis/tempo.ts';
import { session, type Take } from './session.svelte.ts';

const KEY = 'pitcher:takes';
export const MAX_TAKES = 9;

function loadAll(): Record<string, Take[]> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

/** Which track the takes belong to: its YouTube id, or a file's name. */
export const trackKey = (t: { id: string | null; title: string }) => t.id ?? `file:${t.title}`;

class Takes {
  list = $state<Take[]>([]);
  /** The take playing (or last recalled); -1 for none. */
  active = $state(-1);
  /** The other side of a flip; -1 for none. */
  b = $state(-1);
  flipping = $state(false);
  every = $state<4 | 8 | 16>(8);
  /** How far through the current flip span, 0–1. */
  progress = $state(0);
  side = $state<'A' | 'B'>('A');

  #track: string | null = null;
  #all = loadAll();
  #elapsed = 0;
  #last = 0;

  open(track: string) {
    this.#track = track;
    this.list = (this.#all[track] ?? []).map((t) => ({ ...t }));
    this.active = -1;
    this.b = -1;
    this.stopFlip();
  }

  #persist() {
    if (!this.#track) return;
    if (this.list.length) this.#all[this.#track] = $state.snapshot(this.list);
    else delete this.#all[this.#track];
    try {
      localStorage.setItem(KEY, JSON.stringify(this.#all));
    } catch {}
  }

  /** Saves what's on the deck as the next take, which becomes A. Null when nine are saved. */
  save(): number | null {
    if (this.list.length >= MAX_TAKES || !this.#track) return null;
    this.list.push(session.current());
    const i = this.list.length - 1;
    if (this.active >= 0) this.b = this.active;
    this.active = i;
    this.#persist();
    return i;
  }

  remove(i: number) {
    if (!this.list[i]) return;
    this.list.splice(i, 1);
    const shift = (n: number) => (n === i ? -1 : n > i ? n - 1 : n);
    this.active = shift(this.active);
    this.b = shift(this.b);
    if (this.flipping && (this.active < 0 || this.b < 0)) this.stopFlip();
    this.#persist();
  }

  /** Recalls a take on the next beat; with `asB`, only marks it as the flip's other side. */
  recall(i: number, asB = false): boolean {
    const take = this.list[i];
    if (!take) return false;
    if (asB) {
      if (i !== this.active) this.b = i;
      return true;
    }
    if (i !== this.active) {
      if (this.active >= 0) this.b = this.active;
      this.active = i;
    }
    if (this.flipping) this.#restartFlip();
    session.onBeat(() => session.applyTake($state.snapshot(take)));
    return true;
  }

  /** Starts or stops flipping between A and B; false when there's no B to flip to. */
  toggleFlip(): boolean {
    if (this.flipping) {
      this.stopFlip();
      return true;
    }
    if (this.active < 0 || this.b < 0 || this.active === this.b || !this.list[this.active] || !this.list[this.b]) return false;
    this.flipping = true;
    this.#restartFlip();
    session.onBeat(() => session.applyTake($state.snapshot(this.list[this.active])));
    return true;
  }

  stopFlip() {
    this.flipping = false;
    this.progress = 0;
    this.side = 'A';
  }

  #restartFlip() {
    this.side = 'A';
    this.#elapsed = 0;
    this.#last = session.pos;
    this.progress = 0;
  }

  /** Every frame while playing: counts source seconds (seeks and loop jumps don't count) and flips. */
  tick(pos: number) {
    const d = pos - this.#last;
    this.#last = pos;
    if (!this.flipping) return;
    if (d > 0 && d < 0.5) this.#elapsed += d;
    const span = this.every * barLength(session.srcBpm);
    if (this.#elapsed >= span) {
      this.#elapsed -= span;
      this.side = this.side === 'A' ? 'B' : 'A';
      const take = this.list[this.side === 'A' ? this.active : this.b];
      if (take) session.applyTake($state.snapshot(take));
      else this.stopFlip();
    }
    this.progress = Math.min(1, this.#elapsed / span);
  }
}

export const takes = new Takes();

session.frame.add((pos) => takes.tick(pos));

// A new track brings its own takes.
$effect.root(() => {
  $effect(() => {
    const track = session.track;
    if (track) untrack(() => takes.open(trackKey(track)));
  });
});
