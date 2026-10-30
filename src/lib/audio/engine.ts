// Playback: the decoded track in a Signalsmith Stretch node (WebAssembly in an audio worklet), which
// changes tempo and pitch independently, and a kick drawn on the source's beat grid. Changes are
// merged into the node's schedule, so leaving out `input` keeps the place
// (node_modules/signalsmith-stretch: `schedule`). The playhead is kept here, from the audio clock
// and where it was last set: the node's own time reports run ahead of what's heard by its latency
// while it plays and not when it's paused, which made the waveform jump on every resume.

interface StretchNode extends AudioWorkletNode {
  inputTime: number;
  schedule(change: Partial<Change>): Promise<unknown>;
  addBuffers(buffers: Float32Array[]): Promise<number>;
  dropBuffers(): Promise<unknown>;
  setUpdateInterval(seconds: number, callback?: (inputTime: number) => void): Promise<unknown>;
}

interface Change {
  active: boolean;
  input: number;
  rate: number;
  semitones: number;
  loopStart: number;
  loopEnd: number;
}

export interface Params {
  /** Playback rate: the tempo ratio (1 while the original is held). */
  rate: number;
  semitones: number;
  /** [start, end] in source seconds, or null. */
  loop: [number, number] | null;
}

export interface KickGrid {
  bpm: number;
  /** Source seconds of a beat (any one; the kick repeats every beat from it). */
  offset: number;
}

const LOOKAHEAD = 0.12;

export class Engine {
  #ctx: AudioContext | null = null;
  #node: StretchNode | null = null;
  #master: GainNode | null = null;
  #kickBus: GainNode | null = null;
  #params: Params = { rate: 1, semitones: 0, loop: null };
  #playing = false;
  /** Where the playhead was (what's heard) at `#anchorTime` (context seconds). */
  #anchorInput = 0;
  #anchorTime = 0;
  #duration = 0;
  #kick: KickGrid | null = null;
  #kickTimer = 0;
  #kickUntil = 0;
  #kicks: { osc: OscillatorNode; at: number }[] = [];

  get playing() {
    return this.#playing;
  }

  get duration() {
    return this.#duration;
  }

  context(): AudioContext {
    if (!this.#ctx) {
      this.#ctx = new AudioContext({ latencyHint: 'interactive' });
      this.#master = this.#ctx.createGain();
      this.#master.connect(this.#ctx.destination);
      this.#kickBus = this.#ctx.createGain();
      this.#kickBus.gain.value = 0.55;
      this.#kickBus.connect(this.#master);
    }
    return this.#ctx;
  }

  decode(data: ArrayBuffer): Promise<AudioBuffer> {
    return this.context().decodeAudioData(data);
  }

  async load(buffer: AudioBuffer) {
    const ctx = this.context();
    this.pause();
    if (!this.#node) {
      // Loaded with the first track: the WebAssembly inside is most of the page's weight.
      const { default: SignalsmithStretch } = await import('signalsmith-stretch');
      this.#node = (await SignalsmithStretch(ctx)) as StretchNode;
      this.#node.connect(this.#master!);
    }
    await this.#node.dropBuffers();
    const left = buffer.getChannelData(0);
    const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
    await this.#node.addBuffers([left.slice(), right.slice()]);
    this.#duration = buffer.duration;
    this.#anchorInput = 0;
    this.#anchorTime = ctx.currentTime;
    await this.#node.schedule({ active: false, input: 0, ...this.#change() });
  }

  /** The playhead in source seconds: where it was set, moved on by the audio clock at the rate. */
  position(): number {
    if (!this.#ctx) return 0;
    let t = this.#anchorInput;
    if (this.#playing) t += (this.#ctx.currentTime - this.#anchorTime) * this.#params.rate;
    const loop = this.#params.loop;
    if (this.#playing && loop && t >= loop[1] && loop[1] > loop[0]) t = loop[0] + ((t - loop[0]) % (loop[1] - loop[0]));
    return Math.min(t, this.#duration);
  }

  async play(from?: number) {
    if (!this.#node || !this.#ctx) return;
    await this.#ctx.resume();
    const input = from ?? this.position();
    this.#anchorInput = input;
    this.#anchorTime = this.#ctx.currentTime;
    this.#playing = true;
    await this.#node.schedule({ active: true, input, ...this.#change() });
    this.#restartKick();
  }

  pause() {
    if (!this.#node || !this.#ctx || !this.#playing) return;
    const input = this.position();
    this.#playing = false;
    this.#anchorInput = input;
    this.#anchorTime = this.#ctx.currentTime;
    void this.#node.schedule({ active: false });
    this.#stopKick();
  }

  seek(input: number) {
    if (!this.#node || !this.#ctx) return;
    const t = Math.max(0, Math.min(input, this.#duration));
    this.#anchorInput = t;
    this.#anchorTime = this.#ctx.currentTime;
    void this.#node.schedule({ input: t, active: this.#playing });
    if (this.#playing) this.#restartKick();
  }

  set(params: Params) {
    const position = this.position();
    this.#params = params;
    if (!this.#node || !this.#ctx) return;
    this.#anchorInput = position;
    this.#anchorTime = this.#ctx.currentTime;
    void this.#node.schedule(this.#change());
    if (this.#playing) this.#restartKick();
  }

  setKick(grid: KickGrid | null) {
    this.#kick = grid;
    if (this.#playing) this.#restartKick();
    else this.#stopKick();
  }

  #change(): Partial<Change> {
    const { rate, semitones, loop } = this.#params;
    return { rate, semitones, loopStart: loop?.[0] ?? 0, loopEnd: loop?.[1] ?? 0 };
  }

  // The kick: every beat of the source grid, at the context time the stretched playback reaches
  // it, scheduled a little ahead. Rescheduled from scratch whenever the playhead or rate changes.

  #restartKick() {
    this.#stopKick();
    if (!this.#kick || !this.#ctx) return;
    this.#kickUntil = this.#ctx.currentTime;
    const tick = () => this.#scheduleKicks();
    tick();
    this.#kickTimer = window.setInterval(tick, 25);
  }

  #stopKick() {
    clearInterval(this.#kickTimer);
    this.#kickTimer = 0;
    const now = this.#ctx?.currentTime ?? 0;
    for (const k of this.#kicks) if (k.at > now) k.osc.stop();
    this.#kicks = [];
  }

  #scheduleKicks() {
    const ctx = this.#ctx!;
    const grid = this.#kick;
    if (!grid || !this.#playing) return;
    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const from = Math.max(this.#kickUntil, now);
    if (horizon <= from) return;
    const rate = this.#params.rate;
    const p = this.position();
    const beat = 60 / grid.bpm;
    const loop = this.#params.loop;

    // Source positions covered by [from, horizon], unwrapped across one loop end at most.
    const segments: [number, number, number][] = []; // [source start, source end, context time at start]
    let s0 = p + (from - now) * rate;
    let s1 = p + (horizon - now) * rate;
    if (loop && loop[1] > loop[0] && s1 > loop[1]) {
      if (s0 < loop[1]) segments.push([s0, loop[1], from]);
      const wrapAt = from + (Math.max(0, loop[1] - s0)) / rate;
      s0 = loop[0] + Math.max(0, s0 - loop[1]);
      s1 = loop[0] + (s1 - loop[1]);
      segments.push([s0, s1, wrapAt]);
    } else {
      segments.push([s0, s1, from]);
    }
    for (const [a, b, at] of segments) {
      for (let k = Math.ceil((a - grid.offset) / beat); grid.offset + k * beat < b; k++) {
        const source = grid.offset + k * beat;
        if (source < 0) continue;
        this.#playKick(at + (source - a) / rate);
      }
    }
    this.#kickUntil = horizon;
    this.#kicks = this.#kicks.filter((k) => k.at > now - 1);
  }

  #playKick(when: number) {
    const ctx = this.#ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, when);
    osc.frequency.exponentialRampToValueAtTime(48, when + 0.11);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(1, when + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.36);
    osc.connect(gain).connect(this.#kickBus!);
    osc.start(when);
    osc.stop(when + 0.38);
    this.#kicks.push({ osc, at: when });
  }
}

export const engine = new Engine();
