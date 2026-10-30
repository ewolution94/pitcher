<!--
  What the analysis found: the source tempo (click to correct it), half and double time (lit when the
  reading picked them on its own), and the key (pick another when it's wrong; a relative major or
  minor is the usual miss). In the track row, or stacked beside the tempo on a very wide screen.
-->
<script lang="ts">
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, keyName, MAJOR_KEYS, MINOR_KEYS, parseBpm } from '../lib/music.ts';
  import { session } from '../lib/session.svelte.ts';

  let { stacked = false }: { stacked?: boolean } = $props();

  let editing = $state(false);
  let value = $state('');

  const keys = [
    ...MINOR_KEYS.map((_, pc) => ({ pc, minor: true })),
    ...MAJOR_KEYS.map((_, pc) => ({ pc, minor: false })),
  ].sort((a, b) => camelot(a).localeCompare(camelot(b), 'en', { numeric: true }));
  const keyValue = $derived(`${session.srcKey.pc}:${session.srcKey.minor ? 'm' : ''}`);

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

<div class="detected" class:stacked>
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
          editing = true;
          value = session.srcBpm.toFixed(1);
          requestAnimationFrame(() => (e.currentTarget as HTMLInputElement).select());
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
    <select value={keyValue} onchange={pickKey}>
      {#each keys as k (camelot(k))}
        <option value="{k.pc}:{k.minor ? 'm' : ''}">{camelot(k)} · {keyName(k)}</option>
      {/each}
    </select>
  </label>
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

  /* Beside the tempo: the source as a column, the numbers as big as the ones they lead to. */
  .stacked {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .stacked .bpm input,
  .stacked .key b {
    font-size: clamp(22px, 2.6vh, 34px);
  }

  .stacked .bpm input {
    width: 4.6ch;
  }

  .stacked .key .code {
    font-size: 15px;
    font-weight: 600;
  }

  @media (max-width: 759.98px) {
    .detected {
      gap: 10px;
      font-size: 12px;
    }

    .bpm input,
    .key b {
      font-size: 14px;
    }
  }
</style>
