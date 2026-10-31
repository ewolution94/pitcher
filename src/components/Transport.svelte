<!--
  The transport, down to what a session uses: where you are (bar.beat, the time at the new tempo, the
  new length), then Loop, the loop's length, the big play button, Reset (straight back to what was
  detected) and Copy (the numbers for the DAW and a link back). The Kick and Hook stay on their keys
  (K, H). On a phone where you are runs across the top, the bar on the left and the time on the right,
  the buttons under it in the thumb's reach.
-->
<script lang="ts">
  import CopyIcon from '@lucide/svelte/icons/copy';
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
</script>

<footer class="transport">
  <div class="pos">
    <span class="bar"><span class="label">{t('transport.bar')}</span><b>{barBeat(session.pos, session.grid)}</b></span>
    <span class="clock"><span class="time">{formatTime(session.pos / rate)}</span><span class="len">/ {formatTime((session.track?.duration ?? 0) / rate)}</span></span>
  </div>
  <div class="buttons">
    <button type="button" class="tb" class:on={session.loopOn} aria-pressed={session.loopOn} onclick={() => session.toggleLoop()}>
      <i><Repeat size={19} /></i>{t('transport.loop')}
    </button>
    <button type="button" class="tb" title={t('transport.barsTitle')} onclick={() => session.cycleLoopBars()}>
      <i class="count">{prefs.loopBars}</i>{t('transport.barsLabel')}
    </button>
    <span class="deck-play">
      <span class="glow" class:on={session.playing} aria-hidden="true"></span>
      <button type="button" class="play" class:on={session.playing} aria-label={session.playing ? t('transport.pause') : t('transport.play')} onclick={() => session.togglePlay()}>
        {#if session.playing}
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" /></svg>
        {:else}
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M7.5 4.5v15l12.5-7.5z" /></svg>
        {/if}
      </button>
    </span>
    <button type="button" class="tb reset" title={t('transport.resetTitle')} disabled={session.untouched} onclick={() => session.reset()}>
      <i><RotateCcw size={19} /></i>{t('transport.reset')}
    </button>
    <button type="button" class="tb" title={t('transport.copyTitle')} onclick={copy}>
      <i><CopyIcon size={18} /></i>{t('transport.copy')}
    </button>
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
    /* The play button's glow reaches below it; at the screen's bottom edge it stops there. */
    overflow-y: clip;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .pos {
    display: flex;
    align-items: baseline;
    gap: 18px;
    color: var(--ewo-fg-2);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .bar,
  .clock {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .pos b {
    min-width: 3.4ch;
    font-size: 20px;
    font-weight: 700;
    color: var(--ewo-fg);
  }

  .time {
    font-size: 15px;
    font-weight: 600;
    color: var(--ewo-fg);
  }

  .len {
    font-size: 15px;
    color: var(--ewo-fg-3);
  }

  .buttons {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  /* Round buttons with their name under them, like a player's. */
  .tb {
    -webkit-tap-highlight-color: transparent;
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
    font-style: normal;
  }

  .tb .count {
    font-size: 17px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* Hover only with a mouse: on a touch screen the last tapped button keeps :hover, which read as on.
     A keyboard's focus is a neutral ring round the circle, never the amber of on. */
  @media (hover: hover) and (pointer: fine) {
    .tb:hover:not(:disabled) i {
      border-color: var(--ewo-fg-3);
    }

    .play:hover {
      background: color-mix(in oklab, var(--amber) 88%, white);
    }
  }

  .tb:focus-visible {
    outline: none;
  }

  .tb:focus-visible i {
    outline: 2px solid var(--ewo-fg-2);
    outline-offset: 2px;
  }

  .tb.on {
    color: var(--amber-text);
  }

  .tb.on i {
    border-color: var(--amber);
    background: var(--amber-soft);
    color: var(--amber-text);
  }

  .tb:disabled {
    opacity: 0.4;
    cursor: default;
  }

  /* The deck's main control: big and filled in the readout's amber; while it plays, a soft glow
     under it breathes slowly (on its own time, not the track's). */
  .deck-play {
    position: relative;
    display: grid;
    place-items: center;
    margin-inline: 6px;
  }

  .glow {
    position: absolute;
    inset: -14px;
    border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in oklab, var(--amber) 50%, transparent), transparent);
    translate: 0 7px;
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
  }

  .glow.on {
    opacity: 0.8;
    animation: breathe 3.2s ease-in-out infinite;
  }

  @keyframes breathe {
    0%,
    100% {
      opacity: 0.55;
      scale: 0.95;
    }
    50% {
      opacity: 0.9;
      scale: 1.04;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .glow.on {
      animation: none;
    }
  }

  .play {
    -webkit-tap-highlight-color: transparent;
    position: relative;
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    background: var(--amber);
    color: var(--amber-ink);
    box-shadow: 0 2px 10px var(--amber-soft), inset 0 1px 0 rgb(255 255 255 / 0.25);
    transition: scale 0.12s ease;
  }

  .play:active {
    scale: 0.95;
  }

  .play svg {
    fill: currentColor;
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

  /* A phone: where you are across the top, the bar on the left and the time on the right, the
     buttons under it in the thumb's reach, the play button in the middle. */
  @media (max-width: 759.98px) {
    .transport {
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      padding: 16px max(1.25rem, env(safe-area-inset-right)) max(14px, env(safe-area-inset-bottom)) max(1.25rem, env(safe-area-inset-left));
      background: var(--ewo-bg-raised);
    }

    .pos {
      justify-content: space-between;
      min-width: 0;
      overflow: hidden;
    }

    .pos b {
      font-size: 22px;
    }

    .time,
    .len {
      font-size: 16px;
    }

    .buttons {
      width: 100%;
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      justify-items: center;
      gap: 0;
    }

    .tb {
      min-width: 0;
    }

    .deck-play {
      margin: 0;
    }

    .play {
      width: 68px;
      height: 68px;
    }
  }
</style>
