<!--
  Before a track is on the deck: the link field front and centre, a file instead, and the recent
  tracks with their settings. While loading: what's coming and how far it got. After a failure:
  what went wrong and a way to try again.
-->
<script lang="ts">
  import LinkField from './LinkField.svelte';
  import { openFile, openRecent } from '../lib/actions.ts';
  import { t, tm } from '../lib/i18n/index.svelte.ts';
  import { formatShift } from '../lib/music.ts';
  import { forget, recent } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  const percent = (p: number) => `${Math.round(p * 100)} %`;
  const stageText = $derived(
    session.stage === 'download' ? t('loading.download', { percent: percent(session.progress) }) : t(`loading.${session.stage}`),
  );
  const stageProgress = $derived(
    session.stage === 'resolve' ? 0.08 : session.stage === 'download' ? 0.08 + 0.72 * session.progress : session.stage === 'decode' ? 0.85 : 0.94,
  );

  function picked(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (file) openFile(file);
    input.value = '';
  }
</script>

<section class="start">
  {#if session.status === 'loading' && session.pending}
    <div class="loading" aria-live="polite">
      <div class="what">
        {#if session.pending.thumb}<img class="thumb" src={session.pending.thumb} alt="" />{/if}
        <div class="title">
          <b>{session.pending.title || '…'}</b>
          {#if session.pending.channel}<span>{session.pending.channel}</span>{/if}
        </div>
      </div>
      <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(stageProgress * 100)}>
        <i style:width="{stageProgress * 100}%"></i>
      </div>
      <div class="row">
        <span class="stage">{stageText}</span>
        <button type="button" class="btn" onclick={() => session.cancel()}>{t('loading.cancel')}</button>
      </div>
    </div>
  {:else}
    <div class="lead">
      <LinkField big id="link-start" />
      {#if session.status === 'error' && session.error}
        <div class="error" role="alert">
          <span>{tm(session.error)}</span>
          <button type="button" class="btn" onclick={() => session.retry()}>{t('loading.again')}</button>
        </div>
      {/if}
      <p class="hint">
        <label class="file">
          {t('start.file')}
          <input type="file" accept="audio/*,.mp3,.wav,.aif,.aiff,.flac,.m4a,.aac,.ogg,.opus" onchange={picked} />
        </label>
        <span class="drop">· {t('start.drop')}</span>
      </p>
    </div>

    {#if recent.list.length}
      <div class="recent">
        <h2 class="label">{t('start.recent')}</h2>
        <ul>
          {#each recent.list as r (r.id)}
            <li>
              <button type="button" class="open" onclick={() => openRecent(r)}>
                <span class="name"><b>{r.title}</b>{#if r.channel}<span>{r.channel}</span>{/if}</span>
                <span class="set">{r.tempo.toFixed(1)} BPM{#if Math.abs(r.shift) >= 0.005} · {formatShift(r.shift)}{/if}{#if r.mode === 'resample'} · Resample{/if}</span>
              </button>
              <button type="button" class="forget" aria-label="{t('start.forget')}: {r.title}" title={t('start.forget')} onclick={() => forget(r.id)}>×</button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  {/if}
</section>

<style>
  .start {
    display: grid;
    align-content: start;
    justify-items: center;
    gap: 48px;
    padding: clamp(48px, 16vh, 160px) max(1rem, env(safe-area-inset-right)) 64px max(1rem, env(safe-area-inset-left));
  }

  .lead,
  .loading,
  .recent {
    width: min(640px, 100%);
  }

  .lead {
    display: grid;
    gap: 14px;
  }

  .hint {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    color: var(--ewo-fg-3);
    font-size: 14px;
  }

  .file {
    position: relative;
    color: var(--ewo-fg-2);
    text-decoration: underline;
    text-decoration-color: var(--ewo-line-strong);
    text-underline-offset: 3px;
    cursor: pointer;
  }

  .file:hover {
    color: var(--ewo-fg);
  }

  .file input {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    cursor: pointer;
  }

  .file:focus-within {
    outline: 2px solid var(--amber);
    outline-offset: 2px;
    border-radius: 4px;
  }

  @media (hover: none) {
    .drop {
      display: none;
    }
  }

  .error {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-radius: 12px;
    background: var(--amber-soft);
    color: var(--ewo-fg);
    font-size: 14px;
  }

  .loading {
    display: grid;
    gap: 16px;
  }

  .what {
    display: flex;
    align-items: center;
    gap: 14px;
    min-width: 0;
  }

  .thumb {
    width: 96px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 6px;
    background: var(--well);
  }

  .title {
    display: grid;
    min-width: 0;
  }

  .title b {
    font-size: 18px;
    font-weight: 650;
  }

  .title span,
  .name span {
    color: var(--ewo-fg-2);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meter {
    height: 4px;
    border-radius: 2px;
    background: var(--ewo-line);
    overflow: hidden;
  }

  .meter i {
    display: block;
    height: 100%;
    background: var(--amber);
    transition: width 0.2s ease;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .stage {
    color: var(--ewo-fg-2);
    font-size: 14px;
    font-variant-numeric: tabular-nums;
  }

  .recent {
    display: grid;
    gap: 10px;
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    border-top: 1px solid var(--ewo-line);
  }

  li {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--ewo-line);
  }

  .open {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 4px;
    border: 0;
    background: none;
    text-align: left;
  }

  .open:hover b {
    color: var(--amber-text);
  }

  .name {
    display: grid;
    min-width: 0;
  }

  .name b {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .set {
    flex: none;
    color: var(--ewo-fg-2);
    font-size: 13px;
    font-variant-numeric: tabular-nums;
  }

  .forget {
    flex: none;
    width: 36px;
    height: 36px;
    border: 0;
    background: none;
    color: var(--ewo-fg-3);
    font-size: 18px;
  }

  .forget:hover {
    color: var(--ewo-fg);
  }

  @media (max-width: 479.98px) {
    .open {
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }
  }
</style>
