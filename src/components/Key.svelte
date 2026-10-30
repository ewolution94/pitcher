<!--
  The key: what a tempo change does to it (Keep key, the default, or Resample, where the pitch
  follows like a record: FL Studio's default), and the key itself; − and + move a semitone. A readout
  over the stage, with the controls under it on a wide screen; on a narrow one the controls are a row
  of their own under the stage.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, formatShift, keyName } from '../lib/music.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let { variant }: { variant: 'full' | 'readout' | 'row' } = $props();
</script>

{#snippet step(direction: -1 | 1)}
  <button type="button" class="step" aria-label={direction < 0 ? t('key.down') : t('key.up')} onclick={() => session.setShift(Math.round(session.shift) + direction)}>{direction < 0 ? '−' : '+'}</button>
{/snippet}

{#snippet mode()}
  <div class="seg" role="radiogroup" aria-label={t('key.mode')}>
    <button type="button" role="radio" aria-checked={prefs.mode === 'keep'} class:on={prefs.mode === 'keep'} title={t('key.keepTitle')} onclick={() => session.setMode('keep')}>{t('key.keep')}</button>
    <button type="button" role="radio" aria-checked={prefs.mode === 'resample'} class:on={prefs.mode === 'resample'} title={t('key.resampleTitle')} onclick={() => session.setMode('resample')}>{t('key.resample')}</button>
  </div>
{/snippet}

{#if variant === 'row'}
  <section class="row" aria-label={t('key.label')}>
    <span class="stepper">
      {@render step(-1)}
      <b class="name">{keyName(session.targetKey)}</b>
      {@render step(1)}
    </span>
    {@render mode()}
  </section>
{:else}
  <section class="key readout">
    <span class="label">{t('key.label')}</span>
    <b class="name big">{keyName(session.targetKey)}</b>
    <span class="sub">{camelot(session.targetKey)} · {formatShift(session.shift)}</span>
    {#if variant === 'full'}
      <div class="controls">
        {@render step(-1)}
        {@render step(1)}
        {@render mode()}
      </div>
    {/if}
  </section>
{/if}

<style>
  .key {
    justify-items: end;
    text-align: right;
  }

  .name {
    font-weight: 700;
    font-stretch: 112%;
    white-space: nowrap;
  }

  .big {
    font-size: clamp(48px, 6.4vh, 80px);
    line-height: 0.95;
  }

  :global(.is-orig) .name {
    opacity: 0.35;
  }

  .sub {
    color: var(--ewo-fg-2);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 6px;
  }

  .seg {
    display: flex;
    border: 1px solid var(--ewo-line-strong);
    border-radius: 8px;
    overflow: hidden;
  }

  .seg button {
    height: 34px;
    padding: 0 14px;
    border: 0;
    background: none;
    color: var(--ewo-fg-2);
    font-size: 13px;
    font-weight: 650;
    white-space: nowrap;
  }

  .seg button + button {
    border-left: 1px solid var(--ewo-line-strong);
  }

  .seg button.on {
    background: var(--amber);
    color: var(--amber-ink);
  }

  .step {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--ewo-line-strong);
    background: none;
    color: var(--ewo-fg-2);
    font-size: 20px;
    font-weight: 600;
  }

  .step:hover {
    color: var(--ewo-fg);
  }

  /* A phone: the key's controls under the stage, the stepper on the left, the mode on the right. */
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px max(1rem, env(safe-area-inset-right)) 10px max(1rem, env(safe-area-inset-left));
    border-top: 1px solid var(--ewo-line);
  }

  .stepper {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stepper .name {
    min-width: 3.2ch;
    font-size: 22px;
    text-align: center;
  }

  .row .step {
    width: 40px;
    height: 40px;
  }

  .row .seg button {
    height: 40px;
    padding: 0 12px;
  }

  @media (max-width: 759.98px) {
    .big {
      font-size: 38px;
    }

    .sub {
      font-size: 12.5px;
    }
  }

  @media (max-width: 759.98px) and (max-height: 740px) {
    .big {
      font-size: 32px;
    }
  }
</style>
