<!--
  The sticky header: the name, the link field once a track is on the deck (the start screen has its
  own, big), and the settings button (Folio's, the same in every app).
-->
<script lang="ts">
  import LinkField from './LinkField.svelte';
  import { ui } from '../lib/prefs.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let field: LinkField | undefined = $state();
  export function focusLink() {
    field?.focus();
  }
</script>

<header class="bar">
  <a class="brand" href="/" onclick={(e) => e.preventDefault()}>
    <img src="/icon.svg" alt="" width="24" height="24" />
    <span class="word">pitcher</span>
  </a>
  {#if session.track}
    <div class="link"><LinkField bind:this={field} id="link-header" /></div>
  {/if}
  <!-- Its own <button> inside takes the keys and names itself (after <html lang>); the click bubbles out. -->
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <ewo-settings-button class="settings" onclick={() => (ui.settings = true)}></ewo-settings-button>
</header>

<style>
  .bar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 14px;
    height: var(--ewo-bar-h);
    padding: 0 max(1rem, env(safe-area-inset-right)) 0 max(1rem, env(safe-area-inset-left));
    background: var(--ewo-bg);
    border-bottom: 1px solid var(--ewo-line);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-stretch: 125%;
    font-size: 17px;
    letter-spacing: -0.01em;
    white-space: nowrap;
    cursor: default;
  }

  .link {
    flex: 1;
    min-width: 0;
    max-width: 560px;
    margin-inline: auto;
  }

  .settings {
    flex: none;
    margin-left: auto;
    margin-right: -6px;
  }

  .link + .settings {
    margin-left: 0;
  }

  @media (max-width: 479.98px) {
    .word {
      display: none;
    }
  }
</style>
