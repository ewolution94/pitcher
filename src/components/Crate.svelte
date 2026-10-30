<!--
  The crate, in an ultrawide's left wing: the tracks you tested lately, each with a thumbnail of its
  waveform and its last settings, newest first. Click one to open it at them. A pasted link adds a
  track; "Mixes with" keeps the ones near the target tempo whose key mixes with the deck's (a
  neighbour on the Camelot wheel or the relative), "Today" the ones from today.
-->
<script lang="ts">
  import { openRecent, openText } from '../lib/actions.ts';
  import { locale, t, tn } from '../lib/i18n/index.svelte.ts';
  import { camelot, formatPercent, formatShift, keyName, keysMix, tempoNear, bestMultiple } from '../lib/music.ts';
  import { recent, type Recent } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';
  import { thumbnailUrl } from '../lib/yt/relay.ts';

  type Filter = 'all' | 'mix' | 'today';
  let filter = $state<Filter>('all');
  let link = $state('');

  const mixes = (r: Recent) =>
    r.id !== session.track?.id && !!r.src && !!r.key && tempoNear(r.src, session.tempo) && keysMix(r.key, session.targetKey);
  const startOfDay = () => new Date(new Date().setHours(0, 0, 0, 0)).getTime();
  const shown = $derived(
    recent.list.filter((r) => filter === 'all' || r.id === session.track?.id || (filter === 'mix' ? mixes(r) : r.at >= startOfDay())),
  );

  function ago(at: number): string {
    const minutes = Math.round((Date.now() - at) / 60000);
    if (minutes < 1) return t('crate.now');
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto', style: 'short' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (minutes < 60 * 24) return rtf.format(-Math.round(minutes / 60), 'hour');
    return rtf.format(-Math.round(minutes / 1440), 'day');
  }

  function change(r: Recent): string {
    if (!r.src) return '';
    const m = bestMultiple(r.src, r.tempo);
    return formatPercent(r.tempo / (r.src * m), 1) + (m === 1 ? '' : m === 2 ? ' (×2)' : ' (÷2)');
  }

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (link.trim() && openText(link)) link = '';
  }
</script>

<section class="crate" aria-label={t('crate.title')}>
  <header>
    <span class="label">{t('crate.title')}</span>
    <span class="count">{tn('crate.count', recent.list.length)}</span>
  </header>
  <form class="add" onsubmit={submit}>
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
    <input type="text" inputmode="url" spellcheck="false" autocomplete="off" aria-label={t('crate.add')} placeholder={t('crate.add')} bind:value={link} />
  </form>
  <div class="filters" role="group">
    <button type="button" class:on={filter === 'all'} aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>{t('crate.all')}</button>
    <button type="button" class:on={filter === 'mix'} aria-pressed={filter === 'mix'} onclick={() => (filter = 'mix')}>
      {t('crate.mixes', { tempo: session.tempo.toFixed(0), key: keyName(session.targetKey) })}
    </button>
    <button type="button" class:on={filter === 'today'} aria-pressed={filter === 'today'} onclick={() => (filter = 'today')}>{t('crate.today')}</button>
  </div>
  <div class="rows">
    {#each shown as r (r.id)}
      {@const now = r.id === session.track?.id}
      <button type="button" class="row" class:now aria-current={now ? 'true' : undefined} onclick={() => !now && openRecent(r)}>
        <img class="thumb" src={thumbnailUrl(r.id, 'mqdefault')} alt="" loading="lazy" onerror={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')} />
        <span class="t"><b>{r.title}</b>{#if r.channel}<span>{r.channel}</span>{/if}</span>
        <span class="set">
          <b>{r.src ? `${r.src.toFixed(1)} → ` : ''}{r.tempo.toFixed(1)}</b>
          <span>{change(r)}</span>
        </span>
        {#if r.overview?.length}
          <span class="mini" aria-hidden="true">
            {#each r.overview as v, i (i)}<i style:height="{Math.max(1.5, v * 14)}px"></i>{/each}
          </span>
        {/if}
        <span class="tags">
          {#if r.key}<span class="tag">{keyName(r.key)} · {camelot(r.key)}</span>{/if}
          <span class="tag">{r.mode === 'resample' ? t('key.resample') : t('key.keep')}{#if r.mode === 'keep' && Math.abs(r.shift) >= 0.005}&nbsp;{formatShift(r.shift)}{/if}</span>
          {#if mixes(r)}<span class="tag mix">{t('crate.mixTag')}</span>{/if}
          <span class="when">{now ? t('crate.now') : ago(r.at)}</span>
        </span>
      </button>
    {:else}
      <p class="empty">{recent.list.length ? t('crate.none') : t('crate.empty')}</p>
    {/each}
  </div>
  <footer>{t('crate.foot')}</footer>
</section>

<style>
  .crate {
    container-type: inline-size;
    display: grid;
    /* One column held to the panel's width: a long title wraps or ellipsises instead of widening it. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto auto minmax(0, 1fr) auto;
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
    padding: 14px 16px 10px;
  }

  .count {
    color: var(--ewo-fg-3);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 38px;
    margin: 0 16px 10px;
    padding: 0 14px;
    border-radius: 19px;
    border: 1px dashed var(--ewo-line-strong);
    color: var(--ewo-fg-3);
  }

  .add:focus-within {
    border-style: solid;
    border-color: var(--amber);
  }

  .add svg {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  .add input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: none;
    outline: none;
    color: var(--ewo-fg);
    font: 500 13px var(--font);
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 12px;
  }

  .filters button {
    height: 28px;
    padding: 0 12px;
    border-radius: 14px;
    border: 1px solid var(--ewo-line);
    background: none;
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .filters button.on {
    background: var(--amber);
    border-color: var(--amber);
    color: var(--amber-ink);
  }

  .rows {
    overflow: auto;
    overscroll-behavior: contain;
    border-top: 1px solid var(--ewo-line);
    scrollbar-width: thin;
  }

  .row {
    position: relative;
    width: 100%;
    display: grid;
    grid-template-columns: 52px minmax(0, 1fr) auto;
    gap: 4px 12px;
    align-items: center;
    padding: 10px 16px;
    border: 0;
    border-bottom: 1px solid var(--ewo-line);
    background: none;
    text-align: left;
    color: inherit;
  }

  .row:hover {
    background: var(--ewo-fill-1, rgb(127 127 127 / 0.06));
  }

  .row.now {
    background: var(--amber-soft);
    cursor: default;
  }

  .row.now::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--amber);
  }

  .thumb {
    grid-row: span 2;
    width: 52px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 4px;
    background: var(--well);
  }

  .t {
    display: grid;
    min-width: 0;
  }

  .t b {
    font-size: 14px;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .t span {
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .set {
    display: grid;
    justify-items: end;
    gap: 2px;
    font-size: 13px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .set b {
    font-weight: 650;
  }

  .set span {
    color: var(--ewo-fg-2);
    font-size: 12px;
  }

  .mini {
    grid-column: 2 / 4;
    height: 14px;
    display: flex;
    align-items: center;
    gap: 1.5px;
    overflow: hidden;
  }

  .mini i {
    flex: none;
    width: 2px;
    border-radius: 1px;
    background: var(--ewo-fg-3);
    opacity: 0.6;
  }

  .tags {
    grid-column: 2 / 4;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .tag {
    height: 20px;
    display: inline-flex;
    align-items: center;
    padding: 0 7px;
    border-radius: 4px;
    background: var(--ewo-fill-2, rgb(127 127 127 / 0.12));
    color: var(--ewo-fg-2);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .tag.mix {
    background: color-mix(in oklab, var(--low) 18%, transparent);
    color: var(--low);
  }

  .when {
    color: var(--ewo-fg-3);
    font-size: 11.5px;
  }

  .empty {
    padding: 18px 16px;
    color: var(--ewo-fg-3);
    font-size: 13px;
  }

  footer {
    padding: 10px 16px 12px;
    border-top: 1px solid var(--ewo-line);
    color: var(--ewo-fg-3);
    font-size: 12px;
  }

  /* A narrow wing (a 2560 screen): no waveform thumbnails, the settings under the title. */
  @container (max-width: 420px) {
    .row {
      grid-template-columns: 44px minmax(0, 1fr);
    }

    .thumb {
      width: 44px;
    }

    .set {
      grid-column: 2;
      justify-items: start;
      display: flex;
      gap: 8px;
    }

    .mini {
      display: none;
    }

    .tags {
      grid-column: 2;
    }
  }
</style>
