<!--
  What's on the deck: the picture (a file's tile for a file), the title and the channel, and what the
  analysis found (Detected). On a desktop it's the deck's headline: a big cover, a big bold title; on a
  phone a compact row.
-->
<script lang="ts">
  import FileMusic from '@lucide/svelte/icons/file-music';
  import Detected from './Detected.svelte';
  import { session } from '../lib/session.svelte.ts';
</script>

<div class="track">
  {#if session.track?.thumb}<img class="thumb" src={session.track.thumb} alt="" />{:else}<span class="thumb file" aria-hidden="true"><FileMusic size={20} /></span>{/if}
  <div class="title">
    <b>{session.track?.title}</b>
    {#if session.track?.channel}<span>{session.track.channel}</span>{/if}
  </div>
  <div class="end"><Detected /></div>
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

  .file {
    display: grid;
    place-items: center;
    border: 1px solid var(--ewo-line);
    color: var(--ewo-fg-2);
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

  @media (min-width: 760px) {
    .track {
      gap: 18px;
    }

    /* Detected keeps its two lines; the title gives way. */
    .end {
      flex: none;
    }

    .thumb {
      width: 120px;
      border-radius: 8px;
      box-shadow: 0 6px 18px rgb(0 0 0 / 0.3), 0 0 0 1px var(--ewo-line);
    }

    .file :global(svg) {
      width: 28px;
      height: 28px;
    }

    .title {
      gap: 4px;
    }

    .title b {
      font-size: 26px;
      font-weight: 750;
      font-stretch: 106%;
      letter-spacing: -0.012em;
      line-height: 1.15;
    }

    .title span {
      font-size: 15px;
      font-weight: 550;
    }
  }

  @media (min-width: 760px) and (max-height: 760px) {
    .thumb {
      width: 100px;
    }

    .title b {
      font-size: 22px;
    }

    .title span {
      font-size: 14px;
    }
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
      min-width: 0;
      margin-left: 0;
    }
  }
</style>
