<!--
  The start screen's live preview: the deck in miniature, saying what Pitcher does before a word is
  read. The waveform scrolls, the tempo slides from 116 to 128 and back while the beat grid closes up,
  and the key card says it's held. Its button loads a demo beat Pitcher makes itself (lib/demo.ts)
  into the real deck. An idle page stays still (learnings/performance.md): it plays three cycles,
  rests at 116, and plays again when pointed at or focused; it waits while Settings (a blur over the
  page) is open. Still under reduced motion, at 128.
-->
<script lang="ts">
  import Play from '@lucide/svelte/icons/play';
  import { openFile } from '../lib/actions.ts';
  import { DEMO_BPM, demoFile } from '../lib/demo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { colours } from '../lib/palette.svelte.ts';
  import { ui } from '../lib/prefs.svelte.ts';

  /** How far the tempo slides. */
  const TO = 128;
  /** One cycle (hold, up, hold, down) in ms, and how many play before it rests. */
  const CYCLE = 8000;
  const CYCLES = 3;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas: HTMLCanvasElement | undefined = $state();
  let w = $state(0), h = $state(0);
  let shown = $state((reduced ? TO : DEMO_BPM).toFixed(1));
  let running = $state(true);
  /** Where the waveform is, kept across rests so it carries on where it stopped. */
  let beats = 0;

  function wake() {
    if (!reduced) running = true;
  }

  /** A made-up waveform at `tempo`: kicks on the beat (the lows), a body (the mids), hats between. */
  function draw(beats: number, tempo: number) {
    if (!canvas || !w || !h) return;
    const P = colours.current;
    const ratio = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
    if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
    const x = canvas.getContext('2d')!;
    x.setTransform(ratio, 0, 0, ratio, 0, 0);
    x.clearRect(0, 0, w, h);
    const narrow = w < 560;
    // Pixels a beat: the grid closes up as the tempo rises, the way it does on the deck.
    const ppb = ((narrow ? 34 : 54) * DEMO_BPM) / tempo;
    const cy = h * 0.56, hh = narrow ? 40 : 56;
    const first = beats - w / 2 / ppb;
    const layers: [string, number][] = [[P.low, 1], [P.mid, 0.72], [P.high, 0.42]];
    for (const [colour, scale] of layers) {
      x.beginPath();
      for (let px = 0; px < w; px++) {
        const b = first + px / ppb, phase = b - Math.floor(b);
        const v = scale === 1 ? 0.85 * Math.exp(-phase / 0.12) + 0.15 : scale === 0.72 ? 0.35 + 0.15 * Math.sin(b * 1.7) : 0.55 * Math.exp(-Math.abs(phase - 0.5) / 0.05) + 0.1;
        const a = v * hh * scale;
        x.rect(px, cy - a, 1, 2 * a);
      }
      x.fillStyle = colour;
      x.fill();
    }
    for (let k = Math.ceil(first); k < first + w / ppb; k++) {
      x.fillStyle = k % 4 === 0 ? P['grid-bar'] : P.grid;
      x.fillRect((k - first) * ppb, 0, 1, h);
    }
    x.fillStyle = P.amber;
    x.fillRect(w / 2 - 1, 0, 2, h);
  }

  $effect(() => {
    void colours.current;
    if (!canvas || !w || !h) return;
    if (reduced) {
      draw(0, TO);
      return;
    }
    if (!running || ui.settings) {
      draw(beats, DEMO_BPM);
      shown = DEMO_BPM.toFixed(1);
      return;
    }
    const started = performance.now();
    let frame = 0, last = started;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // A cycle from the start: hold, up, hold, down, eased; it rests after the last one.
      const elapsed = now - started;
      if (elapsed >= CYCLE * CYCLES) {
        running = false;
        return;
      }
      const c = (elapsed % CYCLE) / 1000;
      const k = c < 1.5 ? 0 : c < 3.5 ? (c - 1.5) / 2 : c < 5.5 ? 1 : c < 7.5 ? 1 - (c - 5.5) / 2 : 0;
      const tempo = DEMO_BPM + (TO - DEMO_BPM) * k * k * (3 - 2 * k);
      beats += (dt * tempo) / 60;
      const text = tempo.toFixed(1);
      if (text !== shown) shown = text;
      draw(beats, tempo);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  });
</script>

<!-- Pointing at it (or focusing its button) only plays the decorative preview again. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="preview" onpointerenter={wake} onfocusin={wake}>
  <div class="art" role="img" aria-label={t('start.preview')}>
    <div class="wave" bind:clientWidth={w} bind:clientHeight={h}><canvas bind:this={canvas}></canvas></div>
    <div class="hud" aria-hidden="true">
      <div class="readout tempo">
        <span class="label">{t('tempo.label')}</span>
        <div class="row"><span class="from">{DEMO_BPM} →</span><b class="big">{shown}</b></div>
      </div>
      <div class="readout key">
        <span class="label">{t('key.label')}</span>
        <b class="name">F♯m</b>
        <span class="held">{t('start.held')}</span>
      </div>
    </div>
  </div>
  <div class="foot">
    <p class="caption">{t('start.caption')}</p>
    <button type="button" class="demo" onclick={() => openFile(demoFile(t('start.demoName')))}>
      <i class="dot"><Play size={12} fill="currentColor" /></i>{t('start.demo')}
    </button>
  </div>
</div>

<style>
  .preview {
    position: relative;
    width: min(860px, 100%);
    height: 300px;
    border-radius: 16px;
    border: 1px solid var(--ewo-line);
    background: var(--well);
    overflow: hidden;
  }

  .art,
  .wave {
    position: absolute;
    inset: 0;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }

  .hud {
    position: absolute;
    top: 16px;
    left: 16px;
    right: 16px;
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 12px;
  }

  .row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .from {
    color: var(--ewo-fg-3);
    font-size: 18px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .big {
    min-width: 4.2ch;
    font-size: 48px;
    line-height: 0.95;
    font-weight: 650;
    font-stretch: 115%;
    letter-spacing: -0.02em;
    color: var(--big);
    font-variant-numeric: tabular-nums;
  }

  .key {
    justify-items: end;
    text-align: right;
  }

  .name {
    font-size: 34px;
    line-height: 1;
    font-weight: 700;
    font-stretch: 112%;
  }

  .held {
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    font-weight: 600;
  }

  .foot {
    position: absolute;
    left: 16px;
    right: 16px;
    bottom: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .caption {
    max-width: 46ch;
    color: var(--ewo-fg-2);
    font-size: 14px;
    line-height: 1.4;
  }

  .demo {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    height: 40px;
    padding: 0 18px 0 9px;
    border-radius: 20px;
    border: 1px solid var(--ewo-line-strong);
    background: color-mix(in oklab, var(--well) 86%, transparent);
    color: var(--ewo-fg);
    font-size: 14px;
    font-weight: 650;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .dot {
    width: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--amber);
    color: var(--amber-ink);
  }

  @media (hover: hover) and (pointer: fine) {
    .demo:hover {
      border-color: var(--amber);
    }
  }

  @media (max-width: 759.98px) {
    .preview {
      height: 236px;
    }

    .hud {
      top: 12px;
      left: 12px;
      right: 12px;
    }

    .from,
    .caption {
      display: none;
    }

    .big {
      font-size: 34px;
    }

    .name {
      font-size: 26px;
    }

    .foot {
      bottom: 12px;
      justify-content: center;
    }
  }
</style>
