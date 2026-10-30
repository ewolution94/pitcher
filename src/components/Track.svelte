<!--
  What's on the deck: the picture, the title and the channel, and what the analysis found (Detected),
  unless a very wide screen has it beside the tempo.
-->
<script lang="ts">
  import Detected from './Detected.svelte';
  import { session } from '../lib/session.svelte.ts';

  let { detected = true }: { detected?: boolean } = $props();
</script>

<div class="track">
  {#if session.track?.thumb}<img class="thumb" src={session.track.thumb} alt="" />{/if}
  <div class="title">
    <b>{session.track?.title}</b>
    {#if session.track?.channel}<span>{session.track.channel}</span>{/if}
  </div>
  {#if detected}<div class="end"><Detected /></div>{/if}
</div>

<style>
  .track {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    padding: 0 max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
  }

  .thumb {
    flex: none;
    width: 64px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 4px;
    background: var(--well);
  }

  .title {
    display: grid;
    min-width: 0;
  }

  .title b {
    font-size: 16px;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title span {
    color: var(--ewo-fg-2);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .end {
    margin-left: auto;
  }

  @media (max-width: 759.98px) {
    .track {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 2px 12px;
      padding-block: 8px;
    }

    .thumb {
      grid-row: span 2;
    }

    .end {
      margin-left: 0;
    }
  }
</style>
