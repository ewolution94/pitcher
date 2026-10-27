<!--
  The waveform, as a deck shows it: the lows, mids and highs in their own colours, scrolling past a
  fixed playhead with the beat grid and bar numbers over it (drag it to jog), and the whole track
  below, with YouTube's "most replayed" curve over it, the hook, the loop and the playhead (click or
  drag to jump).
-->
<script lang="ts">
  import { barLength, beatLength } from '../lib/analysis/tempo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { colours, type Palette } from '../lib/palette.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let zoom: HTMLCanvasElement | undefined = $state();
  let over: HTMLCanvasElement | undefined = $state();
  let zw = $state(0), zh = $state(0), ow = $state(0), oh = $state(0);

  /** Seconds across the scrolling view: about 150 px a second, 3 to 9 s. */
  const span = $derived(Math.max(3, Math.min(9, zw / 150)));

  function prepare(canvas: HTMLCanvasElement, w: number, h: number) {
    const ratio = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
      canvas.width = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
    }
    const x = canvas.getContext('2d')!;
    x.setTransform(ratio, 0, 0, ratio, 0, 0);
    x.clearRect(0, 0, w, h);
    return x;
  }

  function drawZoom(canvas: HTMLCanvasElement, w: number, h: number, P: Palette) {
    const x = prepare(canvas, w, h);
    const bands = session.bands;
    if (!bands || !w || !h) return;
    const pos = session.pos;
    const t0 = pos - span / 2;
    const pps = w / span;
    const top = 18;
    const cy = top + (h - top) / 2;
    const hh = (h - top) / 2 - 6;
    const frames = bands.lo.length;

    if (session.loopOn) {
      const a = (session.loopStart - t0) * pps, b = (session.loopEnd - t0) * pps;
      x.fillStyle = P['amber-soft'];
      x.fillRect(a, top, b - a, h - top);
      x.fillStyle = P.amber;
      x.fillRect(a, top, 1.5, h - top);
      x.fillRect(b - 1.5, top, 1.5, h - top);
    }

    const layers: [Float32Array, string, number][] = [
      [bands.lo, P.low, 1],
      [bands.mi, P.mid, 0.72],
      [bands.hi, P.high, 0.42],
    ];
    for (const [band, colour, scale] of layers) {
      x.beginPath();
      for (let px = 0; px < w; px++) {
        const a = (t0 + px / pps) * bands.fps;
        const b = (t0 + (px + 1) / pps) * bands.fps;
        if (b < 0 || a >= frames) continue;
        let v = 0;
        for (let f = Math.max(0, Math.floor(a)); f < Math.min(frames, Math.max(Math.floor(a) + 1, Math.ceil(b))); f++) v = Math.max(v, band[f]);
        const half = v * hh * scale;
        if (half > 0.3) x.rect(px, cy - half, 1, 2 * half);
      }
      x.fillStyle = colour;
      x.fill();
    }

    // The beat grid: a line every beat, stronger with the bar's number every bar.
    const grid = session.grid;
    const beat = beatLength(grid.bpm);
    x.font = '650 11px "Archivo Variable", sans-serif';
    for (let k = Math.ceil((t0 - grid.offset) / beat); grid.offset + k * beat < t0 + span; k++) {
      if (grid.offset + k * beat < 0) continue;
      const px = (grid.offset + k * beat - t0) * pps;
      const bar = ((k % 4) + 4) % 4 === 0;
      x.fillStyle = bar ? P['grid-bar'] : P.grid;
      x.fillRect(px, top, 1, h - top);
      if (bar) {
        x.fillStyle = P['ewo-fg-2'];
        x.fillText(String(Math.floor(k / 4) + 1), px + 4, 13);
      }
    }

    x.fillStyle = P.amber;
    x.fillRect(w / 2 - 1, 0, 2, h);
    x.beginPath();
    x.moveTo(w / 2 - 6, 0);
    x.lineTo(w / 2 + 6, 0);
    x.lineTo(w / 2, 7);
    x.fill();
  }

  // The overview's columns, worked out once per track and width.
  let cache: { key: unknown; width: number; lo: Float32Array; mi: Float32Array; hi: Float32Array } | null = null;
  function columns(width: number) {
    const bands = session.bands!;
    if (cache?.key === bands && cache.width === width) return cache;
    const lo = new Float32Array(width), mi = new Float32Array(width), hi = new Float32Array(width);
    const n = bands.lo.length;
    for (let c = 0; c < width; c++) {
      const a = Math.floor((c / width) * n), b = Math.max(a + 1, Math.floor(((c + 1) / width) * n));
      let sl = 0, sm = 0, sh = 0, pk = 0;
      for (let i = a; i < b; i++) {
        sl += bands.lo[i];
        sm += bands.mi[i];
        sh += bands.hi[i];
        pk = Math.max(pk, bands.lo[i]);
      }
      const k = b - a;
      lo[c] = 0.6 * (sl / k) + 0.4 * pk;
      mi[c] = sm / k;
      hi[c] = sh / k;
    }
    for (const arr of [lo, mi, hi]) {
      const top = Math.max(...arr) || 1;
      for (let i = 0; i < width; i++) arr[i] /= top;
    }
    cache = { key: bands, width, lo, mi, hi };
    return cache;
  }

  function drawOver(canvas: HTMLCanvasElement, w: number, h: number, P: Palette) {
    const x = prepare(canvas, w, h);
    const duration = session.track?.duration ?? 0;
    if (!session.bands || !w || !h || !duration) return;
    const cols = Math.max(1, Math.round(w));
    const c = columns(cols);
    const top = 9;
    const cy = top + (h - top) / 2;
    const hh = (h - top) / 2;

    const heat = session.heatmap;
    if (heat.length > 1) {
      x.beginPath();
      x.moveTo(0, top);
      for (let i = 0; i < cols; i++) x.lineTo(i, top - heat[Math.min(heat.length - 1, Math.floor((i / cols) * heat.length))] * 8);
      x.lineTo(w, top);
      x.closePath();
      x.fillStyle = P['ewo-fg-3'];
      x.globalAlpha = 0.55;
      x.fill();
      x.globalAlpha = 1;
    }

    for (const [arr, colour, scale] of [[c.lo, P.low, 1], [c.mi, P.mid, 0.72], [c.hi, P.high, 0.42]] as const) {
      x.beginPath();
      for (let i = 0; i < cols; i++) {
        const a = arr[i] * hh * scale;
        x.rect(i, cy - a, 1, 2 * a);
      }
      x.fillStyle = colour;
      x.fill();
    }

    const px = (session.pos / duration) * w;
    x.fillStyle = P['ewo-bg'];
    x.globalAlpha = 0.55;
    x.fillRect(0, top, px, h - top);
    x.globalAlpha = 1;

    if (session.loopOn) {
      const a = (session.loopStart / duration) * w, b = (session.loopEnd / duration) * w;
      x.fillStyle = P['amber-soft'];
      x.fillRect(a, 0, Math.max(2, b - a), h);
    }
    x.fillStyle = P.amber;
    if (session.hook != null) {
      const hx = (session.hook / duration) * w;
      x.beginPath();
      x.moveTo(hx - 4, 0);
      x.lineTo(hx + 4, 0);
      x.lineTo(hx, 5);
      x.fill();
    }
    x.fillRect(px - 1, 0, 2, h);
  }

  $effect(() => {
    if (zoom) drawZoom(zoom, zw, zh, colours.current);
  });
  $effect(() => {
    if (over) drawOver(over, ow, oh, colours.current);
  });

  // Jog: dragging the scrolling view moves the playhead under it.
  let jog: { x: number } | null = null;
  let grabbing = $state(false);
  function jogStart(event: PointerEvent) {
    if (event.button > 0) return;
    jog = { x: event.clientX };
    grabbing = true;
    zoom!.setPointerCapture(event.pointerId);
  }
  function jogMove(event: PointerEvent) {
    if (!jog) return;
    const dx = event.clientX - jog.x;
    jog.x = event.clientX;
    session.seek(session.pos - (dx / zw) * span);
  }

  let scrubbing = false;
  function scrub(event: PointerEvent) {
    const rect = over!.getBoundingClientRect();
    const duration = session.track?.duration ?? 0;
    session.seek(Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * duration);
  }
</script>

<div class="zoom" bind:clientWidth={zw} bind:clientHeight={zh}>
  <canvas
    bind:this={zoom}
    aria-label={t('wave.label')}
    class:grabbing
    onpointerdown={jogStart}
    onpointermove={jogMove}
    onpointerup={() => ((jog = null), (grabbing = false))}
    onpointercancel={() => ((jog = null), (grabbing = false))}
  ></canvas>
  {#if session.orig}<span class="badge">{t('transport.original')}</span>{/if}
</div>
<div class="over" bind:clientWidth={ow} bind:clientHeight={oh}>
  <canvas
    bind:this={over}
    aria-label={t('wave.overview')}
    onpointerdown={(e) => {
      scrubbing = true;
      over!.setPointerCapture(e.pointerId);
      scrub(e);
    }}
    onpointermove={(e) => scrubbing && scrub(e)}
    onpointerup={() => (scrubbing = false)}
    onpointercancel={() => (scrubbing = false)}
  ></canvas>
</div>

<style>
  .zoom,
  .over {
    position: relative;
    min-height: 0;
    min-width: 0;
  }

  .zoom {
    background: var(--well);
    border-bottom: 1px solid var(--ewo-line);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
  }

  .zoom canvas {
    cursor: grab;
  }

  .zoom canvas.grabbing {
    cursor: grabbing;
  }

  .over {
    margin: 5px max(1rem, env(safe-area-inset-right)) 5px max(1rem, env(safe-area-inset-left));
  }

  .over canvas {
    cursor: pointer;
  }

  .badge {
    position: absolute;
    right: 12px;
    bottom: 10px;
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--ewo-fg);
    color: var(--ewo-bg);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    pointer-events: none;
  }
</style>
