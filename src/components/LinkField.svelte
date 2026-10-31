<!--
  The link field: paste or type a YouTube address, Enter or Load opens it. Big on the start screen,
  compact in the header once a track is on the deck, with a button to open a file there too.
-->
<script lang="ts">
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import { AUDIO_FILES, openFile, openText } from '../lib/actions.ts';
  import { t } from '../lib/i18n/index.svelte.ts';
  import { session } from '../lib/session.svelte.ts';

  let { big = false, id = 'link' }: { big?: boolean; id?: string } = $props();
  let value = $state('');
  let input: HTMLInputElement | undefined = $state();

  // The loaded video's address, so it reads as "what's on the deck". Empty for a file, so the field
  // still reads as a place for a link (the file's name is in the track row).
  $effect(() => {
    const track = session.track;
    if (!big && track && document.activeElement !== input) value = track.id ? `youtube.com/watch?v=${track.id}` : '';
  });

  function picked(event: Event) {
    const picker = event.currentTarget as HTMLInputElement;
    const file = picker.files?.[0];
    if (file) openFile(file);
    picker.value = '';
  }

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
  {:else}
    <label class="open" title={t('link.file')}>
      <FolderOpen size={16} />
      <span class="sr">{t('link.file')}</span>
      <input type="file" accept={AUDIO_FILES} onchange={picked} />
    </label>
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

  /* Open a file: a round button at the field's end, the picker itself invisible over it. */
  /* WebKit lays a file input out at its own width whatever the inset, so it reached over the settings
     button beside it (a tap there opened the file picker): sized and clipped to the circle. */
  .open {
    position: relative;
    overflow: hidden;
    flex: none;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--ewo-fg-2);
    cursor: pointer;
  }

  .open:has(input:focus-visible) {
    color: var(--ewo-fg);
    background: var(--ewo-bg-raised);
  }

  /* Hover only with a mouse: a touch screen keeps :hover on what was tapped last. */
  @media (hover: hover) and (pointer: fine) {
    .open:hover {
      color: var(--ewo-fg);
      background: var(--ewo-bg-raised);
    }
  }

  .open input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    font-size: 0;
    cursor: pointer;
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
