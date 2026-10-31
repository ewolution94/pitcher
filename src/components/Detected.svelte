<!--
  What the analysis found: the source tempo (click to correct it), half and double time (lit when the
  reading picked them on its own), and the key (pick another when it's wrong), with the runner-up one
  tap away and marked unsure when it's nearly as likely. At the end of the track row.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, keyName, MAJOR_KEYS, MINOR_KEYS, parseBpm, type Key } from '../lib/music.ts';
  import { session } from '../lib/session.svelte.ts';

  let editing = $state(false);
  let value = $state('');

  const keys = [
    ...MINOR_KEYS.map((_, pc) => ({ pc, minor: true })),
    ...MAJOR_KEYS.map((_, pc) => ({ pc, minor: false })),
  ].sort((a, b) => camelot(a).localeCompare(camelot(b), 'en', { numeric: true }));
  const keyValue = $derived(`${session.srcKey.pc}:${session.srcKey.minor ? 'm' : ''}`);

  const same = (a: Key, b: Key) => a.pc === b.pc && a.minor === b.minor;
  /** The other of the two likeliest keys: the runner-up while the detected one is in use, else the detected one. */
  const other = $derived(same(session.srcKey, session.detectedKey) ? session.altKey : session.detectedKey);
  /** Under 0.3 the runner-up is nearly as likely: measured, the detected key is right about 40 % of the time there. */
  const unsure = $derived(session.keySure < 0.3 && (same(session.srcKey, session.detectedKey) || same(session.srcKey, session.altKey)));

  function commit() {
    const bpm = parseBpm(value);
    if (bpm) session.setSourceTempo(bpm);
    editing = false;
  }

  function pickKey(event: Event) {
    const [pc, minor] = (event.currentTarget as HTMLSelectElement).value.split(':');
    session.setSourceKey({ pc: Number(pc), minor: minor === 'm' });
  }
</script>

<div class="detected">
  <span class="label">{t('track.detected')}</span>
  <span class="row">
    <span class="bpm">
      <input
        type="text"
        inputmode="decimal"
        aria-label={t('track.correct')}
        title={t('track.correct')}
        value={editing ? value : session.srcBpm.toFixed(1)}
        onfocus={(e) => {
          // currentTarget is gone by the next frame, so keep the field.
          const field = e.currentTarget;
          editing = true;
          value = session.srcBpm.toFixed(1);
          requestAnimationFrame(() => field.select());
        }}
        oninput={(e) => (value = e.currentTarget.value)}
        onblur={commit}
        onkeydown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            editing = false;
            e.currentTarget.blur();
          }
        }}
      />
      <span class="unit">BPM</span>
    </span>
    <span class="half" role="group">
      <button type="button" class:on={session.mult === 0.5} aria-pressed={session.mult === 0.5} title={t('track.half')} onclick={() => session.setMultiple(0.5)}>½</button>
      <button type="button" class:on={session.mult === 2} aria-pressed={session.mult === 2} title={t('track.double')} onclick={() => session.setMultiple(2)}>2×</button>
    </span>
  </span>
  <label class="key" title={t('track.key')}>
    <span class="sr">{t('track.key')}</span>
    <b>{keyName(session.srcKey)}</b>
    <span class="code">{camelot(session.srcKey)}</span>
    {#if unsure}<span class="unsure" aria-hidden="true">?</span>{/if}
    <select value={keyValue} onchange={pickKey}>
      {#each keys as k (camelot(k))}
        <option value="{k.pc}:{k.minor ? 'm' : ''}">{camelot(k)} · {keyName(k)}</option>
      {/each}
    </select>
  </label>
  <button
    type="button"
    class="alt"
    class:unsure
    title={unsure ? t('track.unsure', { key: keyName(other) }) : t('track.altTitle')}
    onclick={() => session.setSourceKey(other)}
  >
    {t('track.alt', { key: keyName(other) })} <span class="code">{camelot(other)}</span>
  </button>
</div>

<style>
  .detected {
    display: flex;
    align-items: center;
    gap: 12px;
    color: var(--ewo-fg-2);
    font-size: 13px;
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .bpm {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .bpm input {
    width: 5ch;
    padding: 0;
    border: 0;
    background: none;
    text-align: right;
    color: var(--ewo-fg);
    font: 650 16px/1.2 var(--font);
    font-variant-numeric: tabular-nums;
    box-shadow: 0 1px 0 var(--ewo-line-strong);
    outline: none;
    cursor: text;
  }

  .bpm input:hover {
    box-shadow: 0 1px 0 var(--ewo-fg-3);
  }

  .bpm input:focus {
    box-shadow: 0 2px 0 var(--amber);
  }

  .half {
    display: flex;
    gap: 3px;
  }

  .half button {
    min-width: 26px;
    height: 22px;
    padding: 0 5px;
    border-radius: 5px;
    border: 1px solid var(--ewo-line);
    background: none;
    color: var(--ewo-fg-2);
    font-size: 12px;
    font-weight: 650;
  }

  .half button.on {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--amber-ink);
  }

  .key {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: 4px;
    cursor: pointer;
  }

  .key b {
    color: var(--ewo-fg);
    font-size: 16px;
    font-weight: 650;
    box-shadow: 0 1px 0 var(--ewo-line-strong);
  }

  .key:hover b {
    box-shadow: 0 1px 0 var(--ewo-fg-3);
  }

  .key:focus-within b {
    box-shadow: 0 2px 0 var(--amber);
  }

  .key select {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  /* A desktop: like the stage's readouts, the label on a line of its own, the values bigger under it. */
  .unsure {
    color: var(--amber-text);
    font-weight: 700;
  }

  .alt {
    height: 24px;
    padding: 0 9px;
    border-radius: 12px;
    border: 1px solid var(--ewo-line);
    background: none;
    color: var(--ewo-fg-2);
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }

  .alt .code {
    color: var(--ewo-fg-3);
  }

  .alt.unsure {
    border-color: var(--amber);
    color: var(--amber-text);
  }

  @media (hover: hover) and (pointer: fine) {
    .alt:hover {
      border-color: var(--ewo-line-strong);
      color: var(--ewo-fg);
    }
  }

  @media (min-width: 760px) {
    .detected {
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px 16px;
    }

    .label {
      flex-basis: 100%;
      text-align: right;
    }

    .bpm input {
      font-size: 22px;
      font-weight: 700;
    }

    .unit {
      font-size: 13px;
    }

    .half button {
      min-width: 30px;
      height: 26px;
      font-size: 13px;
    }

    .key b {
      font-size: 22px;
      font-weight: 700;
    }

    .key .code {
      font-size: 14px;
    }

    .unsure {
      font-size: 20px;
    }

    .alt {
      height: 28px;
      padding: 0 11px;
      border-radius: 14px;
      font-size: 13px;
    }
  }

  /* A narrow screen: the parts wrap rather than push the page wider than the screen; the runner-up only
     when it's nearly as likely, so the row stays short. */
  @media (max-width: 759.98px) {
    .alt:not(.unsure) {
      display: none;
    }

    .detected {
      flex-wrap: wrap;
      gap: 4px 10px;
      font-size: 12px;
    }

    .bpm input,
    .key b {
      font-size: 14px;
    }
  }
</style>
