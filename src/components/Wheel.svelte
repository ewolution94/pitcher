<!--
  The Camelot wheel: the majors outside, the minors inside, a fifth apart from slice to slice. The
  source key has the dot on the hub, the key you'll hear is lit, and its neighbours (one step either
  way, and its relative) are tinted: those mix with it. A tap on a slice moves the key there by the
  shortest shift; a slice of the other mode means its relative.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, camelotNumber, formatShift, keyFromCamelot, keyName, shortestShift, mod } from '../lib/music.ts';
  import { session } from '../lib/session.svelte.ts';

  const C = 160;
  const point = (r: number, a: number) => `${(C + r * Math.sin(a)).toFixed(2)} ${(C - r * Math.cos(a)).toFixed(2)}`;

  const slices = [
    ...[true, false].flatMap((minor) =>
      Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const [r0, r1] = minor ? [75, 116] : [117, 158];
        const a = ((n % 12) * Math.PI) / 6;
        const a0 = a - Math.PI / 12, a1 = a + Math.PI / 12;
        const rm = (r0 + r1) / 2;
        return {
          n,
          minor,
          name: keyName(keyFromCamelot(n, minor)),
          d: `M${point(r1, a0)}A${r1} ${r1} 0 0 1 ${point(r1, a1)}L${point(r0, a1)}A${r0} ${r0} 0 0 0 ${point(r0, a0)}Z`,
          x: (C + rm * Math.sin(a)).toFixed(1),
          y: (C - rm * Math.cos(a) + 4).toFixed(1),
        };
      }),
    ),
  ];

  const src = $derived(camelotNumber(session.srcKey));
  const target = $derived(camelotNumber(session.targetKey));
  const dot = $derived.by(() => {
    const a = ((src % 12) * Math.PI) / 6;
    return { x: C + 63 * Math.sin(a), y: C - 63 * Math.cos(a) };
  });

  function pick(n: number) {
    session.setShift(shortestShift(session.srcKey, keyFromCamelot(n, session.srcKey.minor)));
  }

  function key(event: KeyboardEvent, n: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(n);
    }
  }
</script>

<svg viewBox="0 0 320 320" role="group" aria-label={t('key.wheel')}>
  {#each slices as s (s.minor + '' + s.n)}
    {@const same = s.minor === session.srcKey.minor}
    {@const isTarget = same && s.n === target}
    {@const near = (same && (s.n === mod(target, 12) + 1 || s.n === mod(target - 2, 12) + 1)) || (!same && s.n === target)}
    <g
      class="slice"
      class:target={isTarget}
      class:near
      class:src={same && s.n === src}
      role="button"
      tabindex="-1"
      aria-label="{s.n}{s.minor ? 'A' : 'B'}, {s.name}"
      onclick={() => pick(s.n)}
      onkeydown={(e) => key(e, s.n)}
    >
      <path d={s.d} />
      <text x={s.x} y={s.y}>{s.name}</text>
    </g>
  {/each}
  <circle class="hub" cx={C} cy={C} r="72" />
  <circle class="dot" r="4" cx={dot.x} cy={dot.y} />
  <text class="big" x={C} y="165">{keyName(session.targetKey)}</text>
  <text class="code" x={C} y="188">{camelot(session.targetKey)}</text>
  {#if Math.abs(session.shift) >= 0.005}
    <text class="from" x={C} y="206">{t('key.from', { shift: formatShift(session.shift), key: keyName(session.srcKey) })}</text>
  {/if}
</svg>

<style>
  svg {
    width: 100%;
    height: 100%;
    display: block;
    overflow: visible;
  }

  .slice {
    cursor: pointer;
  }

  .slice path {
    fill: var(--ewo-bg-raised);
    stroke: var(--ewo-bg);
    stroke-width: 2;
    transition: fill 0.12s;
  }

  .slice:hover path {
    fill: var(--ewo-line-strong);
  }

  .slice.near path {
    fill: var(--amber-soft);
  }

  .slice.target path {
    fill: var(--amber);
  }

  .slice text {
    text-anchor: middle;
    pointer-events: none;
    fill: var(--ewo-fg-2);
    font: 600 12px var(--font);
  }

  .slice.src text {
    fill: var(--ewo-fg);
    font-weight: 750;
  }

  .slice.target text {
    fill: var(--amber-ink);
  }

  .hub {
    fill: var(--ewo-bg-raised);
    stroke: var(--ewo-line);
  }

  .dot {
    fill: var(--ewo-fg);
  }

  .big,
  .code,
  .from {
    text-anchor: middle;
    fill: var(--ewo-fg);
    font-family: var(--font);
  }

  .big {
    font-size: 40px;
    font-weight: 700;
    font-stretch: 112%;
  }

  :global(.is-orig) .big {
    opacity: 0.35;
  }

  .code {
    font-size: 15px;
    font-weight: 600;
    fill: var(--ewo-fg-2);
  }

  .from {
    font-size: 10.5px;
    fill: var(--ewo-fg-2);
  }
</style>
