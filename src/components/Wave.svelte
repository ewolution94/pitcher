<!--
  The waveform, as a deck shows it, and the deck's stage: the lows, mids and highs in their own
  colours, scrolling past a fixed playhead with the beat grid and bar numbers over it (drag it to jog);
  what the deck floats over it comes in as children, `floor` keeps the bottom edge clear for the ruler,
  and the waveform starts under `ceiling` (where the readouts end) when there's room for it. Then the whole track below, with YouTube's "most replayed" curve over it, the hook, the loop and the playhead (click or
  drag to jump). The zoom is in pixels per beat, so a wider screen shows more bars rather than bigger
  ones; ⌘ + scroll (or pinch) on the waveform, and − and +, change it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { barLength, beatLength } from '../lib/analysis/tempo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { prefs, ZOOM, zoomBy } from '../lib/prefs.svelte.ts';
  import { colours, type Palette } from '../lib/palette.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let { floor = 0, ceiling = 18, children }: { floor?: number; ceiling?: number; children?: Snippet } = $props();

  /** How far the waveform reaches up and down from its middle at most, so a tall screen shows more
      room around it rather than a giant one. */
  const REACH = 230;
  /** The least height the waveform keeps above the floor; with less room under the readouts it runs on
      under them. */
  const LEAST = 160;

  let zoom: HTMLCanvasElement | undefined = $state();
  let over: HTMLCanvasElement | undefined = $state();
  let zw = $state(0), zh = $state(0), ow = $state(0), oh = $state(0);

  /** Seconds across the scrolling view, from the zoom's pixels per beat. */
  const span = $derived(zw / ((ZOOM[prefs.zoom] ?? ZOOM[2]) * (session.srcBpm / 60)));
  const bars = $derived(Math.max(1, Math.round(span / barLength(session.srcBpm))));

  // After a zoom, how many bars are on screen now, for a moment.
  let zoomNote = $state(false);
  let lastZoom = prefs.zoom;
  $effect(() => {
    if (prefs.zoom === lastZoom) return;
    lastZoom = prefs.zoom;
    zoomNote = true;
    const timer = setTimeout(() => (zoomNote = false), 1200);
    return () => clearTimeout(timer);
  });

  // ⌘ + scroll (or a trackpad pinch, which arrives with Ctrl) zooms; plain scrolling still scrolls.
  $effect(() => {
    if (!zoom) return;
    const canvas = zoom;
    let acc = 0;
    const wheel = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      acc += event.deltaY;
      if (Math.abs(acc) < 40) return;
      zoomBy(acc < 0 ? 1 : -1);
      acc = 0;
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas.removeEventListener('wheel', wheel);
  });

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
    const bottom = h - floor;
    const body = Math.max(top, Math.min(ceiling, bottom - LEAST));
    const cy = (body + bottom) / 2;
    const hh = Math.min(REACH, (bottom - body) / 2 - 6);
    const frames = bands.lo.length;

    if (session.loopOn) {
      const a = (session.loopStart - t0) * pps, b = (session.loopEnd - t0) * pps;
      x.fillStyle = P['amber-soft'];
      x.fillRect(a, top, b - a, bottom - top);
      x.fillStyle = P.amber;
      x.fillRect(a, top, 1.5, bottom - top);
      x.fillRect(b - 1.5, top, 1.5, bottom - top);
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
      x.fillRect(px, top, 1, bottom - top);
      if (bar) {
        x.fillStyle = P['ewo-fg-2'];
        x.fillText(String(Math.floor(k / 4) + 1), px + 4, 13);
      }
    }

    x.fillStyle = P.amber;
    x.fillRect(w / 2 - 1, 0, 2, bottom);
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

<div class="zoom" style:--floor="{floor}px" bind:clientWidth={zw} bind:clientHeight={zh}>
  <canvas
    bind:this={zoom}
    aria-label={t('wave.label')}
    class:grabbing
    onpointerdown={jogStart}
    onpointermove={jogMove}
    onpointerup={() => ((jog = null), (grabbing = false))}
    onpointercancel={() => ((jog = null), (grabbing = false))}
  ></canvas>
  {@render children?.()}
  {#if session.orig}<span class="badge">{t('transport.original')}</span>{/if}
  <span class="zoomed" class:shown={zoomNote} aria-live="polite">{zoomNote ? t('wave.zoom', { count: bars }) : ''}</span>
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

  .zoomed {
    position: absolute;
    left: 12px;
    bottom: calc(var(--floor) + 10px);
    padding: 3px 8px;
    border-radius: 4px;
    background: var(--ewo-bg-raised);
    color: var(--ewo-fg-2);
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    opacity: 0;
    transition: opacity 0.2s;
    pointer-events: none;
  }

  .zoomed.shown {
    opacity: 1;
  }

  .badge {
    position: absolute;
    left: 50%;
    translate: -50% 0;
    bottom: calc(var(--floor) + 10px);
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
