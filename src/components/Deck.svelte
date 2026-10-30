<!--
  The deck, once a track is loaded: the track and what was detected, then the stage, the tempo ruler,
  the whole track, and the transport. The stage is the waveform, full bleed: the tempo and the key
  float over it as two readouts. The ruler has a band of its own under it, with room on both sides.
  On a phone the key's controls get a row of their own under the whole track, and the transport sits
  in the thumb zone. Wider than a 1080p screen, everything you use keeps to a centred group as wide as
  one, and the waveform runs on at the sides, fading out; on a tall screen the stage stops growing and
  the deck sits in the middle.
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
  /** The room the waveform keeps from the readouts above it and the stage's bottom edge. */
  const gap = $derived(wide.matches ? 24 : 14);

  let hud: HTMLElement | undefined = $state();
  let hudHeight = $state(0);
  /** Where the readouts end: the waveform starts under them when there's room. */
  const ceiling = $derived(hud && hudHeight ? hud.offsetTop + hudHeight + gap : 18);
</script>

<main class="deck" class:is-orig={session.orig}>
  <Track />
  <Wave {gap} {ceiling}>
    <div class="hud" bind:this={hud} bind:clientHeight={hudHeight}>
      <Tempo />
      <Key variant={wide.matches ? 'full' : 'readout'} />
    </div>
    {#snippet below()}
      <div class="rule"><Ruler /></div>
    {/snippet}
  </Wave>
  {#if !wide.matches}<Key variant="row" />{/if}
  <Transport />
</main>

<style>
  .deck {
    /* A 1080p screen's width: wider than that, the controls keep together in the middle. */
    --group: 1920px;
    /* What's beside the group (nothing up to its width), and the side margin, at least a gutter. */
    --wing: max(0px, (100% - var(--group)) / 2);
    --side: max(1.25rem, (100% - var(--group)) / 2);
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    /* The stage grows with the screen, to a cap: past it the deck keeps its size in the middle. */
    grid-template-rows: 56px minmax(200px, 54vh) auto auto 112px;
    align-content: center;
    height: calc(100dvh - var(--ewo-bar-h));
    min-height: 600px;
  }

  .deck > :global(.track) {
    border-bottom: 1px solid var(--ewo-line);
    padding-inline: var(--side);
  }

  /* Beside the group the waveform fades out towards the screen's edges. */
  .deck :global(.zoom > canvas) {
    --fade: linear-gradient(to right, rgb(0 0 0 / 0.12), #000 var(--wing), #000 calc(100% - var(--wing)), rgb(0 0 0 / 0.12));
    -webkit-mask-image: var(--fade);
    mask-image: var(--fade);
  }

  /* The ruler: a band of its own between the stage and the whole track. */
  .rule {
    height: 104px;
    margin: 22px var(--side);
    border: 1px solid var(--ewo-line);
    border-radius: 12px;
    background: var(--ewo-bg-raised);
    overflow: hidden;
  }

  .deck > :global(.over) {
    height: 36px;
    margin: 0 var(--side) 18px;
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

  @media (max-height: 760px) and (min-width: 760px) {
    .deck {
      grid-template-rows: 52px minmax(160px, 1fr) auto auto 92px;
    }

    .rule {
      height: 92px;
      margin-block: 14px;
    }

    .deck > :global(.over) {
      height: 30px;
      margin-bottom: 12px;
    }

    .hud {
      top: 22px;
    }
  }

  @media (max-width: 759.98px) {
    .deck {
      grid-template-rows: auto minmax(0, 1fr) auto auto auto auto;
    }

    .deck > :global(.track) {
      padding-inline: max(1rem, env(safe-area-inset-left)) max(1rem, env(safe-area-inset-right));
    }

    .rule {
      height: 112px;
      margin: 12px max(0.75rem, env(safe-area-inset-right)) 12px max(0.75rem, env(safe-area-inset-left));
    }

    .deck > :global(.over) {
      height: 26px;
      margin: 0 max(1rem, env(safe-area-inset-right)) 10px max(1rem, env(safe-area-inset-left));
    }

    .hud {
      top: 22px;
      left: max(0.75rem, env(safe-area-inset-left));
      right: max(0.75rem, env(safe-area-inset-right));
      gap: 10px;
    }
  }
</style>
