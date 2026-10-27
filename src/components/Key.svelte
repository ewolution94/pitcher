<!--
  The key: what a tempo change does to it (Keep key, the default, or Resample, where the pitch
  follows like a record: FL Studio's default), and the key itself: the Camelot wheel beside the tempo
  on a wide screen, a key row on a narrow one. − and + move a semitone.
-->
<script lang="ts">
  import Wheel from './Wheel.svelte';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, formatShift, keyName } from '../lib/music.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let { wide }: { wide: boolean } = $props();
</script>

<section class="key" class:wide>
  <div class="head">
    <span class="label">{t('key.label')}</span>
    <div class="seg" role="radiogroup" aria-label={t('key.mode')}>
      <button type="button" role="radio" aria-checked={prefs.mode === 'keep'} class:on={prefs.mode === 'keep'} title={t('key.keepTitle')} onclick={() => session.setMode('keep')}>{t('key.keep')}</button>
      <button type="button" role="radio" aria-checked={prefs.mode === 'resample'} class:on={prefs.mode === 'resample'} title={t('key.resampleTitle')} onclick={() => session.setMode('resample')}>{t('key.resample')}</button>
    </div>
  </div>
  {#if wide}
    <div class="body">
      <button type="button" class="step" aria-label={t('key.down')} onclick={() => session.setShift(Math.round(session.shift) - 1)}>−</button>
      <div class="wheel"><Wheel /></div>
      <button type="button" class="step" aria-label={t('key.up')} onclick={() => session.setShift(Math.round(session.shift) + 1)}>+</button>
    </div>
  {:else}
    <div class="row">
      <button type="button" class="step" aria-label={t('key.down')} onclick={() => session.setShift(Math.round(session.shift) - 1)}>−</button>
      <span class="now"><b>{keyName(session.targetKey)}</b><span>{camelot(session.targetKey)}</span></span>
      <button type="button" class="step" aria-label={t('key.up')} onclick={() => session.setShift(Math.round(session.shift) + 1)}>+</button>
      <span class="shift">{formatShift(session.shift)}</span>
    </div>
  {/if}
</section>

<style>
  .key {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 4px;
    min-height: 0;
    padding: 14px 16px;
  }

  .key:not(.wide) {
    gap: 10px;
    padding: 12px max(1rem, env(safe-area-inset-right)) 12px max(1rem, env(safe-area-inset-left));
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .seg {
    display: flex;
    border: 1px solid var(--ewo-line-strong);
    border-radius: 7px;
    overflow: hidden;
  }

  .seg button {
    height: 30px;
    padding: 0 12px;
    border: 0;
    background: none;
    color: var(--ewo-fg-2);
    font-size: 13px;
    font-weight: 650;
  }

  .seg button + button {
    border-left: 1px solid var(--ewo-line-strong);
  }

  .seg button.on {
    background: var(--amber);
    color: var(--amber-ink);
  }

  .body {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) 34px;
    align-items: center;
    justify-items: center;
    min-height: 0;
  }

  .wheel {
    width: min(210px, 100%);
    aspect-ratio: 1;
  }

  .step {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 1px solid var(--ewo-line);
    background: none;
    color: var(--ewo-fg-2);
    font-size: 20px;
    font-weight: 600;
  }

  .step:hover {
    color: var(--ewo-fg);
    border-color: var(--ewo-line-strong);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .now {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 6px;
    min-width: 80px;
  }

  .now b {
    font-size: 26px;
    font-weight: 700;
    font-stretch: 112%;
  }

  :global(.is-orig) .now {
    opacity: 0.35;
  }

  .now span,
  .shift {
    color: var(--ewo-fg-2);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
</style>
