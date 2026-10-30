// The track on the deck: loading it (a YouTube link through the relay, or a file), what the
// analysis found, and the settings of the test: the target tempo, the key, the loop, the kick.
// Everything the engine plays follows from here.

import { engine } from './audio/engine.ts';
import { analyse, type Analysis } from './analysis/protocol.ts';
import { barLength, hookTime } from './analysis/tempo.ts';
import { LocalizedError, msg, toMessage, type Message } from './i18n/message.ts';
import { bestMultiple, MAX_BPM, MIN_BPM, semitonesOf, transpose, type Key } from './music.ts';
import { prefs, remember, type Mode } from './prefs.svelte.ts';
import { addressFor, type Settings } from './share.ts';
import { downloadAudio } from './yt/download.ts';
import { loadChunk, thumbnailUrl } from './yt/relay.ts';

export type Stage = 'resolve' | 'download' | 'decode' | 'analyse';

export interface Track {
  /** The YouTube id; null for a file. */
  id: string | null;
  title: string;
  channel: string;
  duration: number;
  thumb: string | null;
}

const clampBpm = (t: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, t));

class Session {
  status = $state<'empty' | 'loading' | 'ready' | 'error'>('empty');
  stage = $state<Stage>('resolve');
  progress = $state(0);
  error = $state<Message | null>(null);
  /** What's being loaded, shown while it loads. */
  pending = $state<Track | null>(null);
  track = $state<Track | null>(null);
  bands = $state.raw<Analysis['bands'] | null>(null);
  heatmap = $state.raw<number[]>([]);

  // The source, as detected and as corrected.
  srcBpm = $state(120);
  offset = $state(0);
  /** The beat grid moved by hand, in seconds. */
  nudge = $state(0);
  srcKey = $state<Key>({ pc: 9, minor: true });
  detectedKey = $state<Key>({ pc: 9, minor: true });

  // The test.
  mult = $state<0.5 | 1 | 2>(1);
  tempo = $state(120);
  /** The key shift in Keep key mode; in Resample it follows the tempo. */
  manual = $state(0);
  loopOn = $state(false);
  loopStart = $state(0);
  orig = $state(false);
  playing = $state(false);
  pos = $state(0);

  base = $derived(this.srcBpm * this.mult);
  ratio = $derived(this.tempo / this.base);
  shift = $derived(prefs.mode === 'resample' ? semitonesOf(this.ratio) : this.manual);
  grid = $derived({ bpm: this.srcBpm, offset: this.offset + this.nudge });
  loopEnd = $derived(this.loopStart + prefs.loopBars * barLength(this.srcBpm));
  targetKey = $derived(transpose(this.srcKey, this.shift));
  /** At the detected tempo, read as it is, and the detected key: nothing for Reset to do. */
  untouched = $derived(this.mult === 1 && Math.abs(this.tempo - this.srcBpm) < 0.005 && Math.abs(this.shift) < 0.005);
  hook = $derived(this.track ? hookTime(this.heatmap, this.track.duration, this.grid) : null);

  #abort: AbortController | null = null;
  #retry: (() => void) | null = null;
  #taps: number[] = [];

  // ---------------------------------------------------------------------------------------------
  // Loading

  async loadVideo(id: string, settings: Settings = {}) {
    const signal = this.#begin({ id, title: '', channel: '', duration: 0, thumb: thumbnailUrl(id, 'mqdefault') }, () =>
      this.loadVideo(id, settings),
    );
    try {
      const yt = await loadChunk(() => import('./yt/extract.ts'));
      const { audio, info } = await yt.resolveAudio(id, signal);
      this.pending = { ...this.pending!, title: info.title, channel: info.channel, duration: info.duration };
      // The "most replayed" curve comes from another request; it may not be there in time, or at all.
      const heat = Promise.race([yt.mostReplayed(id), new Promise<number[]>((r) => setTimeout(() => r([]), 6000))]);
      this.stage = 'download';
      const data = await downloadAudio(audio, (p) => (this.progress = p), signal).catch((err) => {
        if (signal.aborted) throw err;
        throw err instanceof LocalizedError ? err : new LocalizedError(msg('error.download'));
      });
      await this.#finish(data, settings, await heat, signal);
    } catch (err) {
      this.#fail(err, signal);
    }
  }

  async loadFile(file: File) {
    const title = file.name.replace(/\.[^.]+$/, '');
    const signal = this.#begin({ id: null, title, channel: '', duration: 0, thumb: null }, () => this.loadFile(file));
    try {
      this.stage = 'decode';
      await this.#finish(await file.arrayBuffer(), {}, [], signal);
    } catch (err) {
      this.#fail(err, signal);
    }
  }

  cancel() {
    this.#abort?.abort();
    this.#abort = null;
    this.pending = null;
    this.status = this.track ? 'ready' : 'empty';
  }

  retry() {
    this.#retry?.();
  }

  #begin(pending: Track, retry: () => void): AbortSignal {
    this.#abort?.abort();
    this.#abort = new AbortController();
    this.#retry = retry;
    engine.context(); // in the click or paste that started it, so Safari lets it play later
    this.pause();
    this.pending = pending;
    this.error = null;
    this.progress = 0;
    this.stage = 'resolve';
    this.status = 'loading';
    return this.#abort.signal;
  }

  async #finish(data: ArrayBuffer, settings: Settings, heatmap: number[], signal: AbortSignal) {
    this.stage = 'decode';
    let buffer: AudioBuffer;
    try {
      buffer = await engine.decode(data);
    } catch {
      throw new LocalizedError(msg('error.decode'));
    }
    signal.throwIfAborted();
    this.stage = 'analyse';
    let analysis: Analysis;
    try {
      analysis = await analyse(buffer);
    } catch {
      throw new LocalizedError(msg('error.analyse'));
    }
    signal.throwIfAborted();
    try {
      await engine.load(buffer);
    } catch {
      throw new LocalizedError(msg('error.audio'));
    }
    signal.throwIfAborted();

    const { grid, key } = analysis;
    this.track = { ...this.pending!, duration: buffer.duration };
    this.pending = null;
    this.bands = analysis.bands;
    this.heatmap = heatmap;
    this.srcBpm = grid.bpm;
    this.offset = grid.offset;
    this.nudge = 0;
    this.srcKey = key;
    this.detectedKey = key;
    if (settings.mode) prefs.mode = settings.mode;
    const target = clampBpm(settings.tempo ?? prefs.target ?? grid.bpm);
    this.mult = bestMultiple(grid.bpm, target);
    this.tempo = target;
    this.manual = settings.mode === 'resample' ? 0 : (settings.shift ?? 0);
    this.loopOn = false;
    this.orig = false;
    this.playing = false;
    const start = this.hook ?? 0;
    this.loopStart = start;
    this.seek(start);
    this.status = 'ready';
  }

  #fail(err: unknown, signal: AbortSignal) {
    if (signal.aborted) return;
    console.error(err);
    this.error = toMessage(err);
    this.status = 'error';
  }

  // ---------------------------------------------------------------------------------------------
  // The test

  /** `keepMultiple`: a drag or a nudge keeps the half/double reading; a typed tempo may change it. */
  setTempo(t: number, keepMultiple = false) {
    const next = clampBpm(t);
    if (!keepMultiple) this.mult = bestMultiple(this.srcBpm, next);
    this.tempo = Math.round(next * 100) / 100;
    prefs.target = this.tempo;
  }

  setShift(s: number) {
    const next = Math.max(-12, Math.min(12, s));
    if (prefs.mode === 'resample') this.setTempo(this.base * 2 ** (next / 12), true);
    else this.manual = Math.round(next * 100) / 100;
  }

  /** Switching keeps what's heard: leaving Resample, the key stays where the tempo had put it. */
  setMode(mode: Mode) {
    if (mode === prefs.mode) return;
    if (mode === 'keep') this.manual = Math.round(this.shift * 100) / 100;
    prefs.mode = mode;
  }

  /** Straight back to what Detected shows: its tempo, read as it is (no half or double), and its key. */
  reset() {
    this.mult = 1;
    this.manual = 0;
    this.setTempo(this.srcBpm, true);
  }

  setSourceTempo(b: number) {
    this.srcBpm = Math.round(clampBpm(b) * 100) / 100;
    this.mult = bestMultiple(this.srcBpm, this.tempo);
  }

  setMultiple(m: 0.5 | 1 | 2) {
    this.mult = this.mult === m ? 1 : m;
  }

  setSourceKey(k: Key) {
    this.srcKey = k;
  }

  /** Tap the source tempo: four taps or more, each within two seconds of the last. */
  tap(): number | null {
    const now = performance.now();
    if (this.#taps.length && now - this.#taps[this.#taps.length - 1] > 2000) this.#taps = [];
    this.#taps.push(now);
    if (this.#taps.length > 8) this.#taps.shift();
    if (this.#taps.length < 4) return null;
    const span = this.#taps[this.#taps.length - 1] - this.#taps[0];
    const bpm = (60000 * (this.#taps.length - 1)) / span;
    this.setSourceTempo(bpm);
    return this.srcBpm;
  }

  nudgeGrid(ms: number) {
    this.nudge = Math.round((this.nudge + ms / 1000) * 1000) / 1000;
  }

  // ---------------------------------------------------------------------------------------------
  // Transport

  togglePlay() {
    if (this.status !== 'ready') return;
    if (this.playing) return this.pause();
    if (this.track && this.pos >= this.track.duration - 0.05) this.seek(0);
    this.playing = true;
    // Resumes the audio context first thing, inside the click or key press, as Safari wants.
    engine.play().catch(() => (this.playing = false));
  }

  pause() {
    engine.pause();
    this.playing = false;
  }

  seek(t: number) {
    const duration = this.track?.duration ?? 0;
    const at = Math.max(0, Math.min(t, duration));
    engine.seek(at);
    this.pos = at;
  }

  /** The loop starts right where the playhead is, not at its bar: play carries on and comes back here. */
  toggleLoop() {
    if (!this.loopOn) this.loopStart = Math.max(0, this.pos);
    this.loopOn = !this.loopOn;
    if (this.loopOn && (this.pos < this.loopStart || this.pos >= this.loopEnd)) this.seek(this.loopStart);
  }

  cycleLoopBars() {
    prefs.loopBars = prefs.loopBars === 4 ? 8 : prefs.loopBars === 8 ? 16 : 4;
  }

  jumpToHook() {
    const at = this.hook ?? 0;
    if (this.loopOn) this.loopStart = at;
    this.seek(at);
  }

  hold(on: boolean) {
    this.orig = on;
  }
}

export const session = new Session();

// The engine follows the settings, the address and the recent list follow the track.
$effect.root(() => {
  $effect(() => {
    engine.set({
      rate: session.orig ? 1 : session.ratio,
      semitones: session.orig ? 0 : session.shift,
      loop: session.loopOn ? [session.loopStart, session.loopEnd] : null,
    });
  });

  $effect(() => {
    const on = prefs.kick && session.status === 'ready';
    const grid = session.grid;
    engine.setKick(on ? { bpm: grid.bpm, offset: grid.offset } : null);
  });

  // The playhead, every frame while playing; at the end of the track it stops.
  $effect(() => {
    if (!session.playing) return;
    let frame = 0;
    const step = () => {
      session.pos = engine.position();
      const duration = session.track?.duration ?? 0;
      if (!session.loopOn && duration && session.pos >= duration - 0.02) {
        session.pause();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    const track = session.track;
    if (session.status !== 'ready' || !track?.id) return;
    const id = track.id;
    const settings = { tempo: session.tempo, shift: session.shift, mode: prefs.mode };
    const entry = { id, title: track.title, channel: track.channel, ...settings };
    const timer = setTimeout(() => {
      history.replaceState(history.state, '', addressFor(id, settings));
      remember(entry);
    }, 400);
    return () => clearTimeout(timer);
  });
});
