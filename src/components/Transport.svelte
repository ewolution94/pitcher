<!--
  The transport, down to what a session uses: where you are (bar.beat, time at the new tempo, the new
  length) on the left; Loop, Hold for the original, the big play button, the Kick (it lights on the
  beat) and Hook in the middle; Reset (back to the track's own tempo and key), the loop's length and
  Copy (the numbers for the DAW and a link back) on the right. On a phone the middle row is the thumb's, the rest goes above it.
-->
<script lang="ts">
  import AudioWaveform from '@lucide/svelte/icons/audio-waveform';
  import CircleDot from '@lucide/svelte/icons/circle-dot';
  import Flame from '@lucide/svelte/icons/flame';
  import Repeat from '@lucide/svelte/icons/repeat';
  import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
  import { toast } from '../../vendor/ewo/elements/toaster.js';
  import { barBeat } from '../lib/analysis/tempo.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { formatTime } from '../lib/music.ts';
  import { prefs } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';
  import { summaryText } from '../lib/share.ts';

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

<footer class="transport">
  <span class="pos">
    <b>{barBeat(session.pos, session.grid)}</b>
    <span>{formatTime(session.pos / rate)}</span>
    <span class="len">/ {formatTime((session.track?.duration ?? 0) / rate)}</span>
  </span>
  <div class="centre">
    <button type="button" class="tb" class:on={session.loopOn} aria-pressed={session.loopOn} onclick={() => session.toggleLoop()}>
      <i><Repeat size={19} /></i>{t('transport.loop')}
    </button>
    <button
      type="button"
      class="tb"
      class:on={session.orig}
      title={t('transport.holdTitle')}
      onpointerdown={holdStart}
      onpointerup={() => session.hold(false)}
      onpointercancel={() => session.hold(false)}
      onlostpointercapture={() => session.hold(false)}
      onkeydown={(e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && (e.preventDefault(), session.hold(true))}
      onkeyup={(e) => (e.key === ' ' || e.key === 'Enter') && session.hold(false)}
    >
      <i><AudioWaveform size={19} /></i>{t('transport.holdShort')}
    </button>
    <button type="button" class="play" class:on={session.playing} aria-label={session.playing ? t('transport.pause') : t('transport.play')} onclick={() => session.togglePlay()}>
      {#if session.playing}
        {#key beatIndex}<span class="ring" aria-hidden="true"></span>{/key}
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" /></svg>
      {:else}
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7.5 4.5v15l12.5-7.5z" /></svg>
      {/if}
    </button>
    <button type="button" class="tb" class:on={prefs.kick} class:blink aria-pressed={prefs.kick} title={t('transport.kickTitle')} onclick={() => (prefs.kick = !prefs.kick)}>
      <i><CircleDot size={19} /></i>{t('transport.kick')}
    </button>
    <button type="button" class="tb" title={t('transport.hookTitle')} onclick={() => session.jumpToHook()}>
      <i><Flame size={19} /></i>{t('transport.hook')}
    </button>
  </div>
  <div class="end">
    <button type="button" class="btn reset" aria-label={t('transport.reset')} title={t('transport.resetTitle')} disabled={session.untouched} onclick={() => session.reset()}>
      <RotateCcw size={15} /><span class="text">{t('transport.reset')}</span>
    </button>
    <button type="button" class="btn bars" title={t('transport.barsTitle')} onclick={() => session.cycleLoopBars()}>{t('transport.bars', { count: prefs.loopBars })}</button>
    <button type="button" class="btn" title={t('transport.copyTitle')} onclick={copy}>{t('transport.copy')}</button>
  </div>
</footer>

<style>
  .transport {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: center;
    gap: 16px;
    min-width: 0;
    padding-inline: var(--side, 1.25rem);
    border-top: 1px solid var(--ewo-line);
  }

  .pos {
    display: flex;
    align-items: baseline;
    gap: 7px;
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

  .centre {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .end {
    justify-self: end;
    display: flex;
    gap: 8px;
  }

  .bars {
    color: var(--ewo-fg-2);
  }

  .reset:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* Round buttons with their name under them, like a player's. */
  .tb {
    display: grid;
    justify-items: center;
    gap: 4px;
    min-width: 52px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ewo-fg-2);
    font-size: 11.5px;
    font-weight: 600;
    white-space: nowrap;
  }

  .tb i {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    border: 1px solid var(--ewo-line-strong);
    background: var(--ewo-bg-raised);
    color: var(--ewo-fg);
  }

  .tb:hover i {
    border-color: var(--ewo-fg-3);
  }

  .tb.on {
    color: var(--amber-text);
  }

  .tb.on i {
    border-color: var(--amber);
    background: var(--amber-soft);
    color: var(--amber-text);
  }

  .tb.blink i {
    box-shadow: 0 0 10px 2px var(--amber-soft), 0 0 0 1px var(--amber);
  }

  /* The deck's main control: big and filled in the readout's amber, a ring pulsing on the beat while
     it plays. */
  .play {
    position: relative;
    flex: none;
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    margin-inline: 6px;
    border: 0;
    border-radius: 50%;
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 2px 14px var(--amber-soft), inset 0 1px 0 rgb(255 255 255 / 0.25);
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
    box-shadow: 0 0 24px var(--amber-soft), inset 0 1px 0 rgb(255 255 255 / 0.25);
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

  @media (max-height: 760px) and (min-width: 760px) {
    .tb i {
      width: 40px;
      height: 40px;
    }

    .play {
      width: 58px;
      height: 58px;
    }
  }

  /* A phone: where you are, the loop's length and Copy in a line, the buttons under it in the thumb's
     reach, the play button in the middle. */
  @media (max-width: 759.98px) {
    .transport {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'pos end' 'centre centre';
      gap: 10px;
      padding: 10px max(1rem, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
      background: var(--ewo-bg-raised);
    }

    .pos {
      grid-area: pos;
      min-width: 0;
      overflow: hidden;
    }

    .reset {
      padding: 0 9px;
    }

    .reset .text {
      display: none;
    }

    .end {
      grid-area: end;
    }

    .centre {
      grid-area: centre;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      justify-items: center;
      gap: 0;
    }

    .tb {
      min-width: 0;
    }

    .play {
      width: 68px;
      height: 68px;
      margin: 0;
    }
  }

  @media (max-width: 374.98px) {
    .len {
      display: none;
    }
  }
</style>
