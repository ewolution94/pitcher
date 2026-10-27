<!--
  The link field: paste or type a YouTube address, Enter or Load opens it. Big on the start screen,
  compact in the header once a track is on the deck.
-->
<script lang="ts">
  import { openText } from '../lib/actions.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let { big = false, id = 'link' }: { big?: boolean; id?: string } = $props();
  let value = $state('');
  let input: HTMLInputElement | undefined = $state();

  // The loaded video's address, so it reads as "what's on the deck"; empty for a file.
  $effect(() => {
    const track = session.track;
    if (!big && track && document.activeElement !== input) value = track.id ? `youtube.com/watch?v=${track.id}` : track.title;
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (value.trim() && openText(value)) input?.blur();
  }

  export function focus() {
    input?.focus();
    input?.select();
  }
</script>

<form class="field" class:big onsubmit={submit}>
  <label class="sr" for={id}>{t('link.label')}</label>
  <svg class="icon" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
  <input
    {id}
    bind:this={input}
    bind:value
    type="text"
    inputmode="url"
    autocomplete="off"
    spellcheck="false"
    placeholder={t('link.placeholder')}
    onfocus={() => input?.select()}
  />
  {#if big}
    <button type="submit" class="load" disabled={!value.trim()}>{t('link.load')}</button>
  {/if}
</form>

<style>
  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 36px;
    padding: 0 6px 0 14px;
    border-radius: 18px;
    border: 1px solid var(--ewo-line);
    background: var(--well);
    color: var(--ewo-fg-3);
  }

  .field:focus-within {
    border-color: var(--amber);
  }

  .icon {
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    background: none;
    outline: none;
    color: var(--ewo-fg);
    font: 500 13px var(--ewo-mono);
  }

  input::placeholder {
    color: var(--ewo-fg-3);
    font-family: var(--font);
    font-size: 14px;
  }

  .big {
    height: 56px;
    padding: 0 8px 0 20px;
    border-radius: 28px;
    background: var(--ewo-bg-raised);
    box-shadow: 0 1px 0 var(--ewo-line);
  }

  .big input {
    font-size: 16px;
  }

  .big input::placeholder {
    font-size: 17px;
  }

  .load {
    flex: none;
    height: 40px;
    padding: 0 20px;
    border: 0;
    border-radius: 20px;
    background: var(--amber);
    color: var(--amber-ink);
    font-weight: 700;
    font-size: 15px;
  }

  .load:disabled {
    background: var(--ewo-fill-3, var(--ewo-line));
    color: var(--ewo-fg-3);
    cursor: default;
  }
</style>
