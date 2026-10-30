// What a link, a paste or a drop does: a YouTube address loads the video, an audio file loads the
// file. Shared by the link field, the page-wide paste and drop, and the recent list.

import { toast } from '../../vendor/ewo/elements/toaster.js';
import { t } from './i18n/index.svelte.ts';
import type { Recent } from './prefs.svelte.ts';
import { session } from './session.svelte.ts';
import { readAddress } from './share.ts';
import { parseTarget } from './yt/url.ts';

/** What the file pickers take. */
export const AUDIO_FILES = 'audio/*,.mp3,.wav,.aif,.aiff,.flac,.m4a,.aac,.ogg,.opus';

/** Loads whatever YouTube video the text names. False (and a toast) when it names none. */
export function openText(text: string): boolean {
  const target = parseTarget(text);
  if (target?.kind !== 'video') {
    toast(t('error.notLink'), { tone: 'bad' });
    return false;
  }
  let settings = {};
  try {
    settings = readAddress(new URL(/^https?:/i.test(text.trim()) ? text.trim() : `https://${text.trim()}`)).settings;
  } catch {}
  void session.loadVideo(target.id, settings);
  return true;
}

export function openFile(file: File) {
  void session.loadFile(file);
}

export function openRecent(r: Recent) {
  void session.loadVideo(r.id, { tempo: r.tempo, shift: r.shift, mode: r.mode });
}

/** Files first, then a link among the dropped text. */
export function openDrop(data: DataTransfer | null): boolean {
  if (!data) return false;
  const file = [...data.files].find((f) => f.type.startsWith('audio/') || /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|opus)$/i.test(f.name));
  if (file) {
    openFile(file);
    return true;
  }
  const text = data.getData('text/uri-list') || data.getData('text/plain');
  return text ? openText(text) : false;
}
