<!--
  The deck, once a track is loaded: the track and what was detected, the waveform, then the tempo
  beside the key, and the transport. On a wide screen it fills the window below the header; on a
  narrow one it stacks, with a key row in place of the wheel. From 2000 px wide (an ultrawide) the
  controls become one centred group: what was detected, the tempo under the playhead with the ruler's
  needle on the same line, and the key, with the transport in one row beneath. From 2400 px the side
  space holds two wings: the crate on the left, the takes on the right.
-->
<script lang="ts">
  import Crate from './Crate.svelte';
  import Detected from './Detected.svelte';
  import Key from './Key.svelte';
  import Takes from './Takes.svelte';
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
  const ultra = query('(min-width: 2000px)');
  const wings = query('(min-width: 2400px)');

  let tempo: Tempo | undefined = $state();
  export function focusTempo() {
    tempo?.focus();
  }
</script>

<main class="deck" class:is-orig={session.orig} class:ultra={ultra.matches} class:wings={wings.matches}>
  <Track detected={!ultra.matches} />
  <Wave />
  <div class="controls">
    {#if wings.matches}<div class="wing left"><Crate /></div>{/if}
    {#if ultra.matches}<div class="source"><Detected stacked /></div>{/if}
    <Tempo bind:this={tempo} centred={ultra.matches} />
    <Key wide={wide.matches} />
    <!-- On an ultrawide the transport belongs to the group, right under the tempo. -->
    {#if ultra.matches}<Transport wide grouped />{/if}
    {#if wings.matches}<div class="wing right"><Takes /></div>{/if}
  </div>
  {#if !ultra.matches}<Transport wide={wide.matches} />{/if}
</main>

<style>
  .deck {
    --group: 1760px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: 56px minmax(140px, 1fr) 40px auto 60px;
    height: calc(100dvh - var(--ewo-bar-h));
    min-height: 620px;
  }

  .deck > :global(:first-child) {
    border-bottom: 1px solid var(--ewo-line);
  }

  .controls {
    display: grid;
    grid-template-columns: minmax(0, 1fr) clamp(300px, calc(24vh + 90px), 420px);
    align-items: center;
    border-top: 1px solid var(--ewo-line);
    min-height: 280px;
  }

  .controls > :global(.key) {
    align-self: stretch;
    border-left: 1px solid var(--ewo-line);
  }

  .deck > :global(.transport) {
    border-top: 1px solid var(--ewo-line);
  }

  /* An ultrawide: one centred group, its tempo column centred on the screen, under the playhead. */
  .ultra > :global(.track),
  .ultra .controls {
    padding-left: calc((100% - var(--group)) / 2);
    padding-right: calc((100% - var(--group)) / 2);
  }

  /* The waveform grows with the screen's height up to a cap, so it doesn't take half the screen. */
  .ultra {
    grid-template-rows: 56px clamp(160px, 28vh, 360px) 40px minmax(0, 1fr);
  }

  /* Close under the waveform, where the eyes already are; the spare height stays below. */
  .ultra .controls {
    grid-template-columns: 1fr minmax(0, 2.4fr) 1fr;
    align-content: start;
    row-gap: 20px;
    padding-top: clamp(32px, 6vh, 88px);
  }

  .ultra .controls > :global(.transport) {
    grid-column: 1 / -1;
    justify-self: center;
    padding: 0;
  }

  .ultra .controls > :global(.key) {
    border-left: 0;
    align-self: center;
  }

  .source {
    justify-self: start;
    padding: 14px 16px;
  }

  /* From 2400 px: the group in fixed columns in the middle, a wing either side as tall as the space
     under the waveform, each panel close to the group. */
  .wings .controls {
    padding-left: 0;
    padding-right: 0;
    padding-bottom: 24px;
    grid-template-columns: minmax(0, 1fr) 400px 960px 400px minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .wings .controls > .source {
    grid-column: 2;
    grid-row: 1;
  }

  .wings .controls > :global(.tempo) {
    grid-column: 3;
    grid-row: 1;
  }

  .wings .controls > :global(.key) {
    grid-column: 4;
    grid-row: 1;
  }

  .wings .controls > :global(.transport) {
    grid-column: 2 / 5;
    grid-row: 2;
  }

  .wing {
    grid-row: 1 / -1;
    align-self: stretch;
    display: flex;
    min-height: 0;
  }

  .wing.left {
    grid-column: 1;
    justify-content: flex-end;
    padding: 0 40px 0 24px;
  }

  .wing.right {
    grid-column: 5;
    justify-content: flex-start;
    padding: 0 24px 0 40px;
  }

  @media (max-height: 760px) and (min-width: 760px) {
    .deck:not(.ultra) {
      grid-template-rows: 56px minmax(120px, 1fr) 36px auto 56px;
    }
  }

  @media (max-width: 759.98px) {
    .deck {
      grid-template-rows: auto clamp(120px, 22vh, 180px) 36px auto auto;
      height: auto;
      min-height: 0;
    }

    .controls {
      grid-template-columns: minmax(0, 1fr);
      min-height: 0;
    }

    .controls > :global(.key) {
      border-left: 0;
      border-top: 1px solid var(--ewo-line);
    }
  }
</style>
