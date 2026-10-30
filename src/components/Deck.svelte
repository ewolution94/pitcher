<!--
  The deck, once a track is loaded: the track and what was detected, then the stage, the whole track,
  and the transport. The stage is the waveform, full bleed: the tempo and the key float over it as two
  readouts, and the tempo ruler is its bottom edge. On a phone the key's controls get a row of their
  own under the stage, and the transport sits in the thumb zone. On an ultrawide the readouts and the
  transport keep to a centred group while the waveform runs the whole width.
-->
<script lang="ts">
  import Key from './Key.svelte';
  import Ruler from './Ruler.svelte';
  import Tempo from './Tempo.svelte';
  import Track from './Track.svelte';
  import Transport from './Transport.svelte';
  import Wave from './Wave.svelte';
  import { session } from '../lib/session.svelte.ts';

  function query(text: string) {
    const media = matchMedia(text);
    let matches = $state(media.matches);
    $effect(() => {
      const change = () => (matches = media.matches);
      media.addEventListener('change', change);
      return () => media.removeEventListener('change', change);
    });
    return {
      get matches() {
        return matches;
      },
    };
  }

  const wide = query('(min-width: 760px)');
  const short = query('(max-height: 760px)');
  /** The ruler's height: the stage's bottom edge, kept clear of the waveform. */
  const floor = $derived(wide.matches ? (short.matches ? 76 : 88) : 72);

  let hud: HTMLElement | undefined = $state();
  let hudHeight = $state(0);
  /** Where the readouts end: the waveform starts under them when there's room. */
  const ceiling = $derived(hud && hudHeight ? hud.offsetTop + hudHeight + 12 : 18);
</script>

<main class="deck" class:is-orig={session.orig}>
  <Track />
  <Wave {floor} {ceiling}>
    <div class="hud" bind:this={hud} bind:clientHeight={hudHeight}>
      <Tempo />
      <Key variant={wide.matches ? 'full' : 'readout'} />
    </div>
    <div class="floor" style:height="{floor}px"><Ruler /></div>
  </Wave>
  {#if !wide.matches}<Key variant="row" />{/if}
  <Transport />
</main>

<style>
  .deck {
    --group: 1760px;
    /* The side margin: from an ultrawide on, what keeps the readouts and the transport together. */
    --side: max(1.25rem, (100% - var(--group)) / 2);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 56px minmax(0, 1fr) 40px 96px;
    height: calc(100dvh - var(--ewo-bar-h));
    min-height: 600px;
  }

  .deck > :global(.track) {
    border-bottom: 1px solid var(--ewo-line);
    padding-inline: var(--side);
  }

  .hud {
    position: absolute;
    top: 26px;
    left: var(--side);
    right: var(--side);
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 16px;
    pointer-events: none;
  }

  .hud > :global(*) {
    pointer-events: auto;
  }

  .floor {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--well);
    border-top: 1px solid var(--ewo-line);
  }

  @media (max-height: 760px) and (min-width: 760px) {
    .deck {
      grid-template-rows: 52px minmax(0, 1fr) 36px 84px;
    }

    .hud {
      top: 22px;
    }
  }

  @media (max-width: 759.98px) {
    .deck {
      grid-template-rows: auto minmax(0, 1fr) 34px auto auto;
    }

    .deck > :global(.track) {
      padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    }

    .hud {
      top: 22px;
      left: max(0.75rem, env(safe-area-inset-left));
      right: max(0.75rem, env(safe-area-inset-right));
      gap: 10px;
    }
  }
</style>
