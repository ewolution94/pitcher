<!--
  Pitcher: paste a YouTube link (or drop a file), set a BPM, and hear the track at it, the key held
  or resampled. The start screen until a track is on the deck; the page-wide paste, drop and keys.
-->
<script lang="ts">
  import Deck from './components/Deck.svelte';
  import Header from './components/Header.svelte';
  import Settings from './components/Settings.svelte';
  import Start from './components/Start.svelte';
  import { toast } from '../vendor/ewo/elements/toaster.js';
  import { openDrop, openFile, openText } from './lib/actions.ts';
  import { t } from './lib/i18n/index.svelte.ts';
  import { prefs, ui, zoomBy } from './lib/prefs.svelte.ts';
  import { session } from './lib/session.svelte.ts';
  import { readAddress } from './lib/share.ts';
  import { takes } from './lib/takes.svelte.ts';
  import { formatShift, keyName, transpose } from './lib/music.ts';

  // Without the takes' wing (under 2400 px) the keys still work, and a short note says what happened.
  const wingsShown = matchMedia('(min-width: 2400px)');
  const note = (text: string) => {
    if (!wingsShown.matches) toast(text, { duration: 1600 });
  };

  function recallTake(i: number, asB: boolean) {
    const take = takes.list[i];
    if (!take || !takes.recall(i, asB) || asB) return;
    const key = transpose(session.srcKey, take.mode === 'resample' ? 12 * Math.log2(take.tempo / (session.srcBpm * take.mult)) : take.shift);
    const shift = take.mode === 'keep' && Math.abs(take.shift) >= 0.005 ? ` ${formatShift(take.shift)}` : '';
    note(t('toast.recalled', { n: i + 1, name: `${take.tempo.toFixed(1)} · ${keyName(key)}${shift} · ${take.mode === 'resample' ? t('key.resample') : t('key.keep')}` }));
  }

  // A link with a video in it (?v=…, /watch?v=…, a youtu.be path swapped onto this host) opens it,
  // with the settings it carries.
  const start = readAddress(new URL(location.href));
  if (start.id) {
    // A YouTube path swapped onto this host (/watch, /shorts/…, /<id>) becomes Pitcher's own /?v=…
    // at once, before Census's beacon loads: it counts every path change as a view.
    if (location.pathname !== '/') {
      const query = new URLSearchParams(location.search);
      query.set('v', start.id);
      history.replaceState(history.state, '', `/?${query}`);
    }
    void session.loadVideo(start.id, start.settings);
  }

  const editable = (el: EventTarget | null) => el instanceof HTMLElement && !!el.closest('input, textarea, select, [contenteditable]');

  function onPaste(event: ClipboardEvent) {
    if (editable(event.target)) return;
    const file = event.clipboardData?.files[0];
    if (file) {
      event.preventDefault();
      openFile(file);
      return;
    }
    const text = event.clipboardData?.getData('text') ?? '';
    if (text.trim()) {
      event.preventDefault();
      openText(text);
    }
  }

  function onDragOver(event: DragEvent) {
    const types = event.dataTransfer?.types ?? [];
    if (types.includes('Files') || types.includes('text/uri-list') || types.includes('text/plain')) event.preventDefault();
  }

  function onDrop(event: DragEvent) {
    if (editable(event.target)) return;
    event.preventDefault();
    openDrop(event.dataTransfer);
  }

  function focusLink() {
    const field = document.getElementById('link-header') ?? document.getElementById('link-start');
    if (field instanceof HTMLInputElement) {
      field.focus();
      field.select();
    }
  }

  function onKey(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey || ui.settings || editable(event.target)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === '/') {
      event.preventDefault();
      return focusLink();
    }
    if (key === ',') {
      ui.settings = true;
      return;
    }
    if (session.status !== 'ready') return;
    const big = event.shiftKey;
    // Takes: 1–9 by the key's place, so shift + 1 still reads as 1 on every layout.
    const digit = /^Digit([1-9])$/.exec(event.code);
    if (digit) {
      event.preventDefault();
      return recallTake(Number(digit[1]) - 1, big);
    }
    switch (key) {
      case ' ':
        session.togglePlay();
        break;
      case 'ArrowRight':
      case 'ArrowLeft':
        session.setTempo(session.tempo + (key === 'ArrowRight' ? 1 : -1) * (big ? 1 : 0.1), true);
        break;
      case 'ArrowUp':
      case 'ArrowDown': {
        const step = key === 'ArrowUp' ? 1 : -1;
        session.setShift(big ? session.shift + step * 0.1 : Math.round(session.shift) + step);
        break;
      }
      case 'r':
        session.setMode(prefs.mode === 'keep' ? 'resample' : 'keep');
        break;
      case 'k':
        prefs.kick = !prefs.kick;
        break;
      case 'l':
        session.toggleLoop();
        break;
      case 'h':
        session.jumpToHook();
        break;
      case 'o':
        if (!event.repeat) session.hold(true);
        break;
      case '[':
      case ']':
        session.nudgeGrid(key === ']' ? 5 : -5);
        toast(t('toast.nudged', { ms: Math.round(session.nudge * 1000) }), { duration: 1500 });
        break;
      case '-':
        zoomBy(-1);
        break;
      case '+':
      case '=':
        zoomBy(1);
        break;
      case 's': {
        const i = takes.save();
        if (i === null) toast(t('takes.full'), { tone: 'bad' });
        else note(t('toast.saved', { n: i + 1 }));
        break;
      }
      case 'b':
        if (!takes.toggleFlip()) toast(t('takes.needB'));
        break;
      case 't': {
        const bpm = session.tap();
        if (bpm) toast(t('toast.tapped', { bpm: bpm.toFixed(1) }), { duration: 1500 });
        break;
      }
      default:
        return;
    }
    event.preventDefault();
  }

  function onKeyUp(event: KeyboardEvent) {
    if (event.key.toLowerCase() === 'o') session.hold(false);
  }

  // A button clicked with the pointer gives its focus back, so Space keeps meaning play.
  function onClick(event: MouseEvent) {
    if (event.detail > 0 && event.target instanceof HTMLElement) event.target.closest('button')?.blur();
  }
</script>

<svelte:window onpaste={onPaste} ondragover={onDragOver} ondrop={onDrop} onkeydown={onKey} onkeyup={onKeyUp} onclick={onClick} />

<Header />
{#if session.status === 'ready' && session.track}
  <Deck />
{:else}
  <Start />
{/if}
<Settings />
