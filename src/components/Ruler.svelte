<!--
  The tempo ruler: BPM slides under a fixed needle. Strobe dots every half BPM, ticks every BPM, the
  numbers every ten, and the genre stops below. Drag it, or throw it and let it settle (on a stop
  when it ends near one); a tap on a genre's name jumps there. Sideways scrolling moves it too. The
  source tempo (and its half and double) is marked, so you see how far you've gone.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { STOPS } from '../lib/music.ts';
  import { colours, withAlpha } from '../lib/palette.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let canvas: HTMLCanvasElement | undefined = $state();
  let w = $state(0), h = $state(0);
  /** Pixels per BPM. */
  const PPB = 15;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  $effect(() => {
    if (!canvas || !w || !h) return;
    const P = colours.current;
    const ratio = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(w * ratio)) canvas.width = Math.round(w * ratio);
    if (canvas.height !== Math.round(h * ratio)) canvas.height = Math.round(h * ratio);
    const x = canvas.getContext('2d')!;
    x.setTransform(ratio, 0, 0, ratio, 0, 0);
    x.clearRect(0, 0, w, h);

    const tempo = session.tempo;
    const cx = w / 2;
    const lo = tempo - cx / PPB - 3, hi = tempo + cx / PPB + 3;
    const dotY = h * 0.14, tickY = h * 0.24, numY = h * 0.57;

    x.fillStyle = P.dot;
    for (let b = Math.ceil(lo * 2) / 2; b <= hi; b += 0.5) {
      x.beginPath();
      x.arc(cx + (b - tempo) * PPB, dotY, b % 1 === 0 ? 1.7 : 1.1, 0, Math.PI * 2);
      x.fill();
    }
    for (let b = Math.ceil(lo); b <= hi; b++) {
      const px = Math.round(cx + (b - tempo) * PPB);
      x.globalAlpha = b % 10 === 0 ? 0.9 : b % 5 === 0 ? 0.55 : 0.3;
      x.fillStyle = P['ewo-fg'];
      x.fillRect(px, tickY, 1, b % 10 === 0 ? h * 0.17 : b % 5 === 0 ? h * 0.11 : h * 0.06);
    }
    x.globalAlpha = 1;
    x.textAlign = 'center';
    x.font = '650 12px "Archivo Variable", sans-serif';
    x.fillStyle = P['ewo-fg-2'];
    for (let b = Math.ceil(lo / 10) * 10; b <= hi; b += 10) x.fillText(String(b), cx + (b - tempo) * PPB, numY);

    for (const [b, name] of STOPS) {
      const px = cx + (b - tempo) * PPB;
      if (px < -60 || px > w + 60) continue;
      const on = Math.abs(tempo - b) < 0.05;
      x.fillStyle = on ? P.amber : P['ewo-fg-3'];
      x.beginPath();
      x.arc(px, numY + 8, on ? 2.2 : 1.6, 0, Math.PI * 2);
      x.fill();
      x.font = `${on ? 700 : 500} 10px "Archivo Variable", sans-serif`;
      x.fillStyle = on ? P.amber : P['ewo-fg-2'];
      x.fillText(name, px, h * 0.87);
    }

    x.textAlign = 'left';
    x.font = '650 9.5px "Archivo Variable", sans-serif';
    for (const k of [0.5, 1, 2]) {
      const px = cx + (session.srcBpm * k - tempo) * PPB;
      if (px < -60 || px > w + 60) continue;
      x.fillStyle = P['ewo-fg'];
      x.beginPath();
      x.arc(px, dotY, 3.6, 0, Math.PI * 2);
      x.fill();
      x.fillText(k === 1 ? 'SOURCE' : k === 2 ? 'SOURCE ×2' : 'SOURCE ÷2', px + 7, dotY + 3.5);
    }

    const edge = P['ewo-bg'];
    const g = x.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, edge);
    g.addColorStop(0.09, withAlpha(edge, 0));
    g.addColorStop(0.91, withAlpha(edge, 0));
    g.addColorStop(1, edge);
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);

    x.fillStyle = P.amber;
    x.fillRect(cx - 1, 4, 2, numY + 6);
    x.beginPath();
    x.moveTo(cx - 6, 2);
    x.lineTo(cx + 6, 2);
    x.lineTo(cx, 9);
    x.fill();
  });

  /** The nearest stop (a genre, or the source tempo or its half or double) within `tolerance` BPM. */
  function stopNear(bpm: number, tolerance: number): number | null {
    let best: number | null = null;
    let distance = tolerance;
    for (const s of [...STOPS.map((g) => g[0]), session.srcBpm, session.srcBpm * 2, session.srcBpm / 2]) {
      const d = Math.abs(s - bpm);
      if (d < distance) {
        distance = d;
        best = s;
      }
    }
    return best;
  }

  let drag: { x: number; x0: number; t: number; v: number; moved: boolean } | null = null;
  let grabbing = $state(false);
  let throwFrame = 0;

  function settle() {
    const s = stopNear(session.tempo, 0.8);
    session.setTempo(s ?? Math.round(session.tempo * 10) / 10);
  }

  function down(event: PointerEvent) {
    if (event.button > 0) return;
    cancelAnimationFrame(throwFrame);
    drag = { x: event.clientX, x0: event.clientX, t: performance.now(), v: 0, moved: false };
    grabbing = true;
    canvas!.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (!drag) return;
    const now = performance.now();
    const dt = Math.max(1, now - drag.t);
    const db = -(event.clientX - drag.x) / PPB;
    drag.x = event.clientX;
    drag.t = now;
    if (Math.abs(event.clientX - drag.x0) > 4) drag.moved = true;
    drag.v = 0.6 * drag.v + 0.4 * ((db / dt) * 1000);
    session.setTempo(session.tempo + db);
  }

  function up(event: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    grabbing = false;
    if (!d.moved) {
      const rect = canvas!.getBoundingClientRect();
      const bpm = session.tempo + (event.clientX - rect.left - rect.width / 2) / PPB;
      session.setTempo(stopNear(bpm, 2.2) ?? Math.round(bpm * 2) / 2);
      return;
    }
    if (reduced || Math.abs(d.v) < 3 || performance.now() - d.t > 90) return settle();
    let velocity = Math.max(-160, Math.min(160, d.v));
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      velocity *= Math.exp(-dt * 4.5);
      session.setTempo(session.tempo + velocity * dt);
      if (Math.abs(velocity) > 0.8 && session.tempo > 40 && session.tempo < 250) throwFrame = requestAnimationFrame(step);
      else settle();
    };
    throwFrame = requestAnimationFrame(step);
  }

  // Sideways scrolling moves the ruler; up and down still scroll the page. Not passive, so it can
  // keep the sideways scroll from going back a page in the browser.
  $effect(() => {
    if (!canvas) return;
    const wheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      event.preventDefault();
      session.setTempo(session.tempo + (event.deltaX / PPB) * 0.5, true);
    };
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => canvas?.removeEventListener('wheel', wheel);
  });
</script>

<div class="ruler" bind:clientWidth={w} bind:clientHeight={h}>
  <canvas
    bind:this={canvas}
    aria-label={t('tempo.ruler')}
    class:grabbing
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={() => ((drag = null), (grabbing = false))}
  ></canvas>
</div>

<style>
  .ruler {
    position: relative;
    min-width: 0;
    border-block: 1px solid var(--ewo-line);
  }

  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    touch-action: none;
    cursor: grab;
  }

  canvas.grabbing {
    cursor: grabbing;
  }
</style>
