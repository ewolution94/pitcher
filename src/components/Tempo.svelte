<!--
  The tempo: the source (as read) → the target, big, typed into (Enter sets it), the change in
  percent, and the ruler. Past ±25 % a note says the sound gets rough.
-->
<script lang="ts">
  import Ruler from './Ruler.svelte';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { formatPercent, parseBpm } from '../lib/music.ts';
  import { session } from '../lib/session.svelte.ts';

  let editing = $state(false);
  let value = $state('');
  let input: HTMLInputElement | undefined = $state();

  const shown = $derived(editing ? value : session.tempo.toFixed(1));
  const rough = $derived(Math.abs(session.ratio - 1) > 0.25);
  const readAs = $derived(
    session.mult === 1 ? '' : t('tempo.readAs', { bpm: session.base.toFixed(1), multiple: session.mult === 2 ? '×2' : '÷2' }),
  );

  function commit() {
    const bpm = parseBpm(value);
    if (bpm) session.setTempo(bpm);
    editing = false;
  }

  export function focus() {
    input?.focus();
  }
</script>

<section class="tempo">
  <div class="read">
    <span class="label sr">{t('tempo.label')}</span>
    <div class="big">
      <span class="from">{session.base.toFixed(1)}</span>
      <span class="arrow" aria-hidden="true">→</span>
      <input
        bind:this={input}
        class="bpm"
        type="text"
        inputmode="decimal"
        aria-label={t('tempo.input')}
        value={shown}
        onfocus={() => {
          editing = true;
          value = session.tempo.toFixed(1);
          requestAnimationFrame(() => input?.select());
        }}
        oninput={(e) => (value = e.currentTarget.value)}
        onblur={commit}
        onkeydown={(e) => {
          if (e.key === 'Enter') input?.blur();
          if (e.key === 'Escape') {
            editing = false;
            input?.blur();
          }
        }}
      />
      <span class="unit">BPM</span>
    </div>
    <div class="change">
      <b>{formatPercent(session.ratio, 1)}</b>
      {#if readAs}<span>{readAs}</span>{/if}
      {#if rough}<span class="rough" title={t('tempo.roughTitle')}>{t('tempo.rough')}</span>{/if}
    </div>
  </div>
  <Ruler />
</section>

<style>
  .tempo {
    display: grid;
    grid-template-rows: auto 84px;
    align-content: center;
    gap: 16px;
    min-width: 0;
    padding: 14px 24px;
  }

  .read {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 20px;
    min-width: 0;
  }

  .big {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  }

  .from {
    font-size: 26px;
    font-weight: 500;
    color: var(--ewo-fg-3);
  }

  .arrow {
    font-size: 22px;
    color: var(--ewo-fg-3);
  }

  .bpm {
    width: 4.4ch;
    padding: 0;
    border: 0;
    background: none;
    outline: none;
    color: var(--big);
    caret-color: var(--amber);
    font: 650 92px/0.95 var(--font);
    font-stretch: 115%;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }

  .bpm:focus {
    box-shadow: 0 3px 0 var(--amber);
  }

  :global(.is-orig) .bpm,
  :global(.is-orig) .change b {
    opacity: 0.35;
  }

  .unit {
    font-size: 14px;
    font-weight: 650;
    color: var(--ewo-fg-2);
    letter-spacing: 0.08em;
  }

  .change {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 12px;
    color: var(--ewo-fg-2);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .change b {
    font-size: 22px;
    font-weight: 650;
    color: var(--ewo-fg);
  }

  .rough {
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--amber-soft);
    color: var(--amber-text);
    font-weight: 600;
    font-size: 12px;
    cursor: help;
  }

  @media (max-width: 759.98px) {
    .tempo {
      grid-template-rows: auto 76px;
      gap: 12px;
      padding: 14px max(1rem, env(safe-area-inset-right)) 14px max(1rem, env(safe-area-inset-left));
    }

    .from {
      font-size: 18px;
    }

    .arrow {
      font-size: 16px;
    }

    .bpm {
      font-size: 62px;
    }

    .change b {
      font-size: 18px;
    }
  }
</style>
