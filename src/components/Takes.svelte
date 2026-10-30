<!--
  Takes, in an ultrawide's right wing: the settings saved for the track on the deck, to compare. Save
  takes what you hear; a click (or 1–9) recalls one on the next beat; shift + click marks the flip's
  other side, B. Flip alternates A and B every 4, 8 or 16 bars, with a meter for the bars to go.
-->
<script lang="ts">
  import { toast } from '../../vendor/ewo/elements/toaster.js';
  import { barAt } from '../lib/analysis/tempo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { camelot, formatPercent, formatShift, keyName, transpose } from '../lib/music.ts';
  import { session, type Take } from '../lib/session.svelte.ts';
  import { MAX_TAKES, takes } from '../lib/takes.svelte.ts';

  const keyOf = (take: Take) => transpose(session.srcKey, take.mode === 'resample' ? 12 * Math.log2(take.tempo / (session.srcBpm * take.mult)) : take.shift);

  function detail(take: Take): string {
    const mode = take.mode === 'resample' ? t('key.resample') : t('key.keep');
    const shift = take.mode === 'keep' && Math.abs(take.shift) >= 0.005 ? ` ${formatShift(take.shift)}` : '';
    const loop = take.loopOn ? t('takes.loop', { bars: take.loopBars, bar: barAt(take.loopStart, session.grid) }) : t('takes.noLoop');
    return `${mode}${shift} · ${loop}${take.kick ? ` · ${t('takes.kick')}` : ''}`;
  }

  function save() {
    if (takes.save() === null) toast(t('takes.full'), { tone: 'bad' });
  }

  function flip() {
    if (!takes.toggleFlip()) toast(t('takes.needB'));
  }

  const playing = $derived(
    takes.active < 0
      ? ''
      : takes.flipping
        ? t('takes.playingSide', { n: (takes.side === 'A' ? takes.active : takes.b) + 1, side: takes.side })
        : t('takes.playing', { n: takes.active + 1 }),
  );
</script>

<section class="takes" aria-label={t('takes.title')}>
  <header>
    <span class="label">{t('takes.title')} · <span class="track">{session.track?.title}</span></span>
    <button type="button" class="btn" onclick={save} disabled={takes.list.length >= MAX_TAKES}>{t('takes.save')} <kbd>S</kbd></button>
  </header>
  <div class="list">
    {#each takes.list as take, i (i)}
      {@const key = keyOf(take)}
      <div
        class="take"
        class:on={i === takes.active}
        class:b={i === takes.b}
        role="button"
        tabindex="0"
        aria-pressed={i === takes.active}
        onclick={(e) => takes.recall(i, e.shiftKey)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            takes.recall(i, e.shiftKey);
          }
        }}
      >
        <span class="n">{i + 1}</span>
        <span class="main">
          <b>{take.tempo.toFixed(1)}<small>{formatPercent(take.tempo / (session.srcBpm * take.mult), 1)}</small></b>
          <span>{detail(take)}</span>
        </span>
        <span class="key"><b>{keyName(key)}</b><span>{camelot(key)}</span></span>
        <button
          type="button"
          class="x"
          aria-label={t('takes.delete', { n: i + 1 })}
          onclick={(e) => {
            e.stopPropagation();
            takes.remove(i);
          }}>×</button
        >
      </div>
    {:else}
      <p class="empty">{t('takes.empty')}</p>
    {/each}
  </div>
  <div class="compare">
    <div class="line">
      <span class="label">{t('takes.flip')}</span>
      <span class="ab a"><i>A</i>{takes.active >= 0 ? takes.active + 1 : '–'}</span>
      <span aria-hidden="true">⇄</span>
      <span class="ab b"><i>B</i>{takes.b >= 0 ? takes.b + 1 : '–'}</span>
      <span class="grow"></span>
      <span class="label">{t('takes.every')}</span>
      <div class="seg" role="radiogroup" aria-label={t('takes.every')}>
        {#each [4, 8, 16] as const as n (n)}
          <button type="button" role="radio" aria-checked={takes.every === n} class:on={takes.every === n} onclick={() => (takes.every = n)}>{n}</button>
        {/each}
      </div>
      <span class="label">{t('takes.bars')}</span>
    </div>
    <div class="line">
      <button type="button" class="btn" class:on={takes.flipping} aria-pressed={takes.flipping} onclick={flip}>{t('takes.flipButton')} <kbd>B</kbd></button>
      <span class="playing">{playing}</span>
    </div>
    <div class="meter" class:b={takes.side === 'B'}><i style:width="{takes.progress * 100}%"></i></div>
  </div>
  <footer>{t('takes.foot')}</footer>
</section>

<style>
  .takes {
    container-type: inline-size;
    display: grid;
    /* One column held to the panel's width: a long title wraps or ellipsises instead of widening it. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) auto auto;
    width: min(560px, 100%);
    height: 100%;
    min-height: 0;
    border: 1px solid var(--ewo-line);
    border-radius: 14px;
    background: var(--ewo-bg-raised);
    overflow: hidden;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ewo-line);
  }

  header .label {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .track {
    text-transform: none;
    letter-spacing: 0;
    font-stretch: 100%;
    color: var(--ewo-fg-2);
  }

  kbd {
    font-family: var(--ewo-mono);
    font-size: 10.5px;
    padding: 0 4px;
    border-radius: 3px;
    border: 1px solid var(--ewo-line-strong);
    color: var(--ewo-fg-3);
  }

  .list {
    overflow: auto;
    overscroll-behavior: contain;
  }

  .take {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto 28px;
    gap: 12px;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--ewo-line);
    cursor: pointer;
  }

  .take:hover {
    background: var(--ewo-fill-1, rgb(127 127 127 / 0.06));
  }

  .take.on {
    background: var(--amber-soft);
  }

  .n {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    border: 1px solid var(--ewo-line-strong);
    font: 700 13px var(--ewo-mono);
    color: var(--ewo-fg-2);
  }

  .take.on .n {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--amber-ink);
  }

  .take.b .n {
    border-color: var(--low);
    color: var(--low);
  }

  .main {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .main b {
    font-size: 20px;
    font-weight: 650;
    font-stretch: 112%;
    font-variant-numeric: tabular-nums;
  }

  .main b small {
    margin-left: 6px;
    font-size: 12.5px;
    font-weight: 600;
    font-stretch: 100%;
    color: var(--ewo-fg-2);
  }

  .main span {
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .key {
    display: grid;
    justify-items: end;
    gap: 2px;
  }

  .key b {
    font-size: 18px;
    font-weight: 700;
  }

  .key span {
    color: var(--ewo-fg-2);
    font-size: 12px;
  }

  .x {
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--ewo-fg-3);
    font-size: 18px;
  }

  .x:hover {
    color: var(--ewo-fg);
    background: var(--ewo-fill-2, rgb(127 127 127 / 0.12));
  }

  .empty {
    padding: 18px 16px;
    color: var(--ewo-fg-3);
    font-size: 13px;
  }

  .compare {
    display: grid;
    gap: 10px;
    padding: 14px 16px;
    border-top: 1px solid var(--ewo-line);
  }

  .line {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .grow {
    flex: 1;
  }

  .ab {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 30px;
    padding: 0 10px;
    border-radius: 7px;
    background: var(--ewo-fill-2, rgb(127 127 127 / 0.12));
    font-weight: 650;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .ab i {
    font: normal 11px var(--ewo-mono);
    color: var(--ewo-fg-3);
  }

  .ab.a {
    box-shadow: inset 0 0 0 1px var(--amber);
  }

  .ab.b {
    box-shadow: inset 0 0 0 1px var(--low);
  }

  .seg {
    display: flex;
    border: 1px solid var(--ewo-line-strong);
    border-radius: 7px;
    overflow: hidden;
  }

  .seg button {
    height: 28px;
    padding: 0 10px;
    border: 0;
    background: none;
    color: var(--ewo-fg-2);
    font-weight: 650;
    font-size: 12.5px;
  }

  .seg button + button {
    border-left: 1px solid var(--ewo-line-strong);
  }

  .seg button.on {
    background: var(--ewo-fg);
    color: var(--ewo-bg);
  }

  .playing {
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
  }

  .meter {
    height: 6px;
    border-radius: 3px;
    background: var(--ewo-fill-2, rgb(127 127 127 / 0.12));
    overflow: hidden;
  }

  .meter i {
    display: block;
    height: 100%;
    background: var(--amber);
  }

  .meter.b i {
    background: var(--low);
  }

  footer {
    padding: 10px 16px 12px;
    border-top: 1px solid var(--ewo-line);
    color: var(--ewo-fg-3);
    font-size: 12px;
  }

  /* A narrow wing (a 2560 screen): the key under the tempo, the flip controls wrap. */
  @container (max-width: 420px) {
    .take {
      grid-template-columns: 30px minmax(0, 1fr) 28px;
    }

    .key {
      grid-column: 2;
      grid-row: 2;
      display: flex;
      gap: 6px;
      justify-items: start;
    }

    .x {
      grid-column: 3;
      grid-row: 1 / 3;
    }
  }
</style>
