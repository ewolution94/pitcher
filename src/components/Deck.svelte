<!--
  The deck, once a track is loaded: the track and what was detected, the waveform, then the tempo
  beside the key, and the transport. On a wide screen it fills the window below the header; on a
  narrow one it stacks, with a key row in place of the wheel.
-->
<script lang="ts">
  import Key from './Key.svelte';
  import Tempo from './Tempo.svelte';
  import Track from './Track.svelte';
  import Transport from './Transport.svelte';
  import Wave from './Wave.svelte';
  import { session } from '../lib/session.svelte.ts';

  const media = matchMedia('(min-width: 760px)');
  let wide = $state(media.matches);
  $effect(() => {
    const change = () => (wide = media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  });

  let tempo: Tempo | undefined = $state();
  export function focusTempo() {
    tempo?.focus();
  }
</script>

<main class="deck" class:is-orig={session.orig}>
  <Track />
  <Wave />
  <div class="controls">
    <Tempo bind:this={tempo} />
    <Key {wide} />
  </div>
  <Transport {wide} />
</main>

<style>
  .deck {
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
    grid-template-columns: minmax(0, 1fr) 300px;
    border-top: 1px solid var(--ewo-line);
    min-height: 280px;
  }

  .controls > :global(.key) {
    border-left: 1px solid var(--ewo-line);
  }

  .deck > :global(.transport) {
    border-top: 1px solid var(--ewo-line);
  }

  @media (max-height: 760px) and (min-width: 760px) {
    .deck {
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
