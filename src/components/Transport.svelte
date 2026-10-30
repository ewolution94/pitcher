<!--
  The transport, down to what a session uses: play, where you are (bar.beat, time at the new tempo,
  the new length), Loop and its length, Hook, the Kick (its light blinks on the beat), Hold for the
  original, and Copy (the numbers for the DAW and a link back).
-->
<script lang="ts">
  import { toast } from '../../vendor/ewo/elements/toaster.js';
  import { barBeat } from '../lib/analysis/tempo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { formatTime } from '../lib/music.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';
  import { summaryText } from '../lib/share.ts';

  let { wide, grouped = false }: { wide: boolean; grouped?: boolean } = $props();

  const rate = $derived(session.orig ? 1 : session.ratio);
  const beatPhase = $derived(((session.pos - session.grid.offset) / (60 / session.grid.bpm)) % 1);
  const blink = $derived(prefs.kick && session.playing && beatPhase >= 0 && beatPhase < 0.22);
  /** The beat the playhead is on: the play button's ring pulses once per beat. */
  const beatIndex = $derived(Math.floor((session.pos - session.grid.offset) / (60 / session.grid.bpm)));

  async function copy() {
    const track = session.track!;
    const text = summaryText({
      title: track.title,
      channel: track.channel,
      source: session.srcBpm,
      base: session.base,
      tempo: session.tempo,
      key: session.srcKey,
      shift: session.shift,
      mode: prefs.mode,
      link: track.id ? location.href : null,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast(t('transport.copied'), { tone: 'ok' });
    } catch {
      toast(t('transport.copyFailed'), { tone: 'bad' });
    }
  }

  function holdStart(event: PointerEvent) {
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    session.hold(true);
  }
</script>

<footer class="transport" class:grouped>
  <button type="button" class="play" class:on={session.playing} aria-label={session.playing ? t('transport.pause') : t('transport.play')} onclick={() => session.togglePlay()}>
    {#if session.playing}
      {#key beatIndex}<span class="ring" aria-hidden="true"></span>{/key}
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" /></svg>
    {:else}
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M7.5 4.5v15l12.5-7.5z" /></svg>
    {/if}
  </button>
  <span class="pos">
    <b>{barBeat(session.pos, session.grid)}</b>
    <span>{formatTime(session.pos / rate)}</span>
    <span>/ {formatTime((session.track?.duration ?? 0) / rate)}</span>
  </span>
  <button type="button" class="btn" class:on={session.loopOn} aria-pressed={session.loopOn} onclick={() => session.toggleLoop()}>{t('transport.loop')}</button>
  <button type="button" class="btn bars" title={t('transport.barsTitle')} onclick={() => session.cycleLoopBars()}>{t('transport.bars', { count: prefs.loopBars })}</button>
  <button type="button" class="btn" title={t('transport.hookTitle')} onclick={() => session.jumpToHook()}>{t('transport.hook')}</button>
  {#if wide && !grouped}<span class="gap"></span>{/if}
  <button type="button" class="btn" class:on={prefs.kick} class:blink aria-pressed={prefs.kick} title={t('transport.kickTitle')} onclick={() => (prefs.kick = !prefs.kick)}>
    <i class="led"></i>{t('transport.kick')}
  </button>
  <button
    type="button"
    class="btn"
    class:on={session.orig}
    title={t('transport.holdTitle')}
    onpointerdown={holdStart}
    onpointerup={() => session.hold(false)}
    onpointercancel={() => session.hold(false)}
    onlostpointercapture={() => session.hold(false)}
    onkeydown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), session.hold(true))}
    onkeyup={(e) => (e.key === ' ' || e.key === 'Enter') && session.hold(false)}
  >{wide ? t('transport.hold') : t('transport.holdShort')}</button>
  <button type="button" class="btn copy" title={t('transport.copyTitle')} onclick={copy}>{t('transport.copy')}</button>
</footer>

<style>
  .transport {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0 max(1.25rem, env(safe-area-inset-right)) 0 max(1.25rem, env(safe-area-inset-left));
  }

  /* The deck's main control: big and filled in the readout's amber, a ring pulsing on the beat while
     it plays. */
  .play {
    position: relative;
    flex: none;
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    margin-right: 6px;
    border: 0;
    border-radius: 50%;
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 2px 12px var(--amber-soft), inset 0 1px 0 rgb(255 255 255 / 0.25);
    transition: scale 0.12s ease;
  }

  .play:hover {
    background: color-mix(in oklab, var(--amber) 88%, white);
  }

  .play:active {
    scale: 0.95;
  }

  .play svg {
    position: relative;
    fill: currentColor;
  }

  .play.on {
    box-shadow: 0 0 22px var(--amber-soft), inset 0 1px 0 rgb(255 255 255 / 0.25);
  }

  .ring {
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    border: 2px solid var(--amber);
    opacity: 0;
    animation: beat 0.5s ease-out;
    pointer-events: none;
  }

  @keyframes beat {
    from {
      opacity: 0.8;
      scale: 1;
    }
    to {
      opacity: 0;
      scale: 1.35;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ring {
      display: none;
    }
  }

  .pos {
    display: flex;
    align-items: baseline;
    gap: 7px;
    margin-right: 4px;
    color: var(--ewo-fg-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .pos b {
    min-width: 3.4ch;
    font-size: 15px;
    font-weight: 650;
    color: var(--ewo-fg);
  }

  .bars {
    color: var(--ewo-fg-2);
  }

  .gap {
    flex: 1;
  }

  /* On an ultrawide the whole row stays together, under the playhead. */
  .grouped {
    justify-content: center;
  }

  @media (max-width: 759.98px) {
    .transport {
      flex-wrap: wrap;
      padding-block: 12px 16px;
    }

    .copy {
      margin-left: auto;
    }

    .play {
      width: 52px;
      height: 52px;
    }
  }
</style>
