<!--
  The tempo, a readout over the stage: the source (as read) → the target, big, typed into (Enter sets
  it), and the change in percent. Past ±25 % a note says the sound gets rough. The ruler that drags
  it is the stage's bottom edge.
-->
<script lang="ts">
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
</script>

<section class="tempo readout">
  <span class="label">{t('tempo.label')}</span>
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
</section>

<style>
  .tempo {
    min-width: 0;
  }

  .big {
    display: flex;
    align-items: baseline;
    gap: 10px;
    font-variant-numeric: tabular-nums;
  }

  .from {
    font-size: 24px;
    font-weight: 500;
    color: var(--ewo-fg-3);
  }

  .arrow {
    font-size: 20px;
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
    font: 650 clamp(76px, 10vh, 128px) / 0.95 var(--font);
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
    font-size: 20px;
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

  /* Not enough room beside the key's controls: the source is in the track row anyway. */
  @media (max-width: 959.98px) {
    .from,
    .arrow,
    .unit {
      display: none;
    }
  }

  @media (max-width: 759.98px) {
    .bpm {
      font-size: 54px;
    }

    .change b {
      font-size: 16px;
    }

    .change {
      font-size: 12px;
    }
  }

  @media (max-width: 759.98px) and (max-height: 740px) {
    .bpm {
      font-size: 46px;
    }
  }
</style>
