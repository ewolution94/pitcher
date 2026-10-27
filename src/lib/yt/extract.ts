// Everything that talks to InnerTube, from Fermata (fermata/src/lib/yt/extract.ts), cut down to
// what Pitcher needs: one audio stream, the title, and YouTube's "most replayed" curve. It pulls in
// youtubei.js (~1 MB), so the page loads it with `import()` the first time a link is pasted.

import { Innertube, Platform, UniversalCache, Log, type Misc, type YT } from 'youtubei.js/web';
import { LocalizedError, msg, type MessageKey } from '../i18n/message.ts';
import { RelayError, relayed, withRange } from './relay.ts';

type Format = Misc.Format;

Log.setLevel(import.meta.env.DEV ? Log.Level.ERROR : Log.Level.NONE);

// Some clients return stream URLs whose signature must be computed by YouTube's own player
// JavaScript. youtubei.js extracts the relevant functions; running them is up to us.
Platform.shim.eval = async (data) => new Function(data.output)();

/**
 * InnerTube clients to try, in order (Fermata's chain). YouTube restricts clients independently and
 * changes the rules often, so each candidate is verified with a real byte-range request first.
 */
const CLIENT_CHAIN = ['VISIONOS', 'TV_SIMPLY', 'IOS', 'MWEB', 'ANDROID_VR', 'TV'] as const;
type Client = (typeof CLIENT_CHAIN)[number];

// Browsers silently drop these from fetch(); the relay restores them from x-relay-<name>.
const SMUGGLED_HEADERS = ['user-agent', 'cookie', 'origin', 'referer'];

export interface AudioStream {
  url: string;
  /** Bytes; 0 when YouTube doesn't say. */
  size: number;
  mime: string;
  bitrate: number;
}

export interface VideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;
}

async function relayFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : input.toString());
  const headers = new Headers(init?.headers ?? request?.headers);
  for (const name of SMUGGLED_HEADERS) {
    const value = headers.get(name);
    if (value !== null) {
      headers.delete(name);
      headers.set(`x-relay-${name}`, value);
    }
  }
  const method = init?.method ?? request?.method ?? 'GET';
  let body = init?.body ?? undefined;
  if (body === undefined && request && method !== 'GET' && method !== 'HEAD') body = await request.clone().arrayBuffer();
  return relayed(url, { method, headers, body, signal: init?.signal ?? request?.signal, credentials: 'same-origin' });
}

const sessions: Partial<Record<'lite' | 'full', Promise<Innertube>>> = {};

/** `full` also downloads YouTube's player script, needed only for clients with ciphered URLs. */
function session(kind: 'lite' | 'full' = 'lite'): Promise<Innertube> {
  return (sessions[kind] ??= Innertube.create({
    fetch: relayFetch,
    retrieve_player: kind === 'full',
    cache: new UniversalCache(true),
    lang: 'en',
  }).catch((err) => {
    delete sessions[kind];
    throw err;
  }));
}

/** After a relay failure, drop cached sessions so the next attempt builds a proper one. */
function onRelayError(err: unknown) {
  if (err instanceof RelayError) {
    delete sessions.lite;
    delete sessions.full;
  }
}

export class ExtractError extends LocalizedError {}

/** The best audio-only stream: AAC first (every browser decodes it), Opus otherwise. */
export async function resolveAudio(videoId: string, signal?: AbortSignal): Promise<{ audio: AudioStream; info: VideoInfo }> {
  try {
    return await resolveWithFallback(videoId, signal);
  } catch (err) {
    onRelayError(err);
    throw err;
  }
}

async function resolveWithFallback(videoId: string, signal?: AbortSignal) {
  const yt = await session('lite');
  const failures: { client: Client; reason: string }[] = [];

  for (const client of CLIENT_CHAIN) {
    signal?.throwIfAborted();
    try {
      const info = await yt.getBasicInfo(videoId, { client });
      const status = info.playability_status?.status;
      if (status !== 'OK') {
        failures.push({ client, reason: info.playability_status?.reason || status || 'Unplayable' });
        continue;
      }
      if (info.basic_info.is_live) throw new ExtractError(msg('error.live'));

      const formats = (info.streaming_data?.adaptive_formats ?? []).filter(isAudio).sort(preferred);
      if (!formats.length) {
        failures.push({ client, reason: 'No audio formats' });
        continue;
      }
      const best = formats[0];
      const needsPlayer = !best.url || new URL(best.url).searchParams.has('n');
      const player = needsPlayer ? (await session('full')).session.player : undefined;
      const url = await best.decipher(player).catch(() => '');
      if (!url) {
        failures.push({ client, reason: 'Could not decipher the stream URL' });
        continue;
      }
      const audio: AudioStream = { url, size: best.content_length ?? 0, mime: best.mime_type, bitrate: best.average_bitrate || best.bitrate };
      if (!(await probe(audio, signal))) {
        failures.push({ client, reason: 'The stream URL was rejected by YouTube' });
        continue;
      }
      return { audio, info: basicInfo(videoId, info) };
    } catch (err) {
      if (signal?.aborted || err instanceof ExtractError || err instanceof RelayError) throw err;
      failures.push({ client, reason: err instanceof Error ? err.message : String(err) });
    }
  }
  throw new ExtractError(msg(explain(failures.map((f) => f.reason))), failures.map((f) => `${f.client}: ${f.reason}`));
}

function isAudio(f: Format): boolean {
  if (f.drm_families?.length || f.is_type_otf || f.has_text) return false;
  if (f.is_sr || f.is_drc || f.is_descriptive) return false;
  if (f.audio_track && !(f.audio_track.audio_is_default || f.is_original)) return false;
  return f.has_audio && !f.has_video && /mp4a|opus/.test(f.mime_type);
}

/** AAC before Opus, then the higher bitrate. */
function preferred(a: Format, b: Format): number {
  const aac = (f: Format) => (f.mime_type.includes('mp4a') ? 1 : 0);
  return aac(b) - aac(a) || (b.average_bitrate || b.bitrate) - (a.average_bitrate || a.bitrate);
}

/** Clients without a proof-of-origin token get the first few hundred KB, then a 403: test the end. */
async function probe(audio: AudioStream, signal?: AbortSignal): Promise<boolean> {
  const start = audio.size > 4096 ? audio.size - 4096 : 0;
  const end = audio.size > 0 ? audio.size - 1 : 4095;
  const res = await relayed(withRange(audio.url, start, end), { signal });
  await res.body?.cancel();
  return res.ok;
}

function explain(reasons: string[]): MessageKey {
  const all = reasons.join(' | ');
  if (/confirm your age|age-restricted|inappropriate for some users/i.test(all)) return 'error.ageRestricted';
  if (/not a bot/i.test(all)) return 'error.botCheck';
  if (/private video/i.test(all)) return 'error.private';
  if (/members|join this channel/i.test(all)) return 'error.membersOnly';
  if (/premiere|live event will begin|scheduled/i.test(all)) return 'error.premiere';
  if (/not available in your country|blocked it in your country/i.test(all)) return 'error.geo';
  if (/removed|terminated|no longer available|unavailable/i.test(all)) return 'error.unavailable';
  return 'error.noStream';
}

function basicInfo(videoId: string, info: YT.VideoInfo): VideoInfo {
  const b = info.basic_info;
  return { id: videoId, title: b.title ?? 'Untitled', channel: b.author ?? b.channel?.name ?? '', duration: b.duration ?? 0 };
}

/** YouTube's "most replayed" curve, 0–1 evenly over the video; empty when it has none. Best effort. */
export async function mostReplayed(videoId: string): Promise<number[]> {
  try {
    const yt = await session('lite');
    const info = await yt.getInfo(videoId);
    const heatmap = info.heat_map as { heat_markers?: { heat_marker_intensity_score_normalized: number }[] } | null;
    return heatmap?.heat_markers?.map((m) => m.heat_marker_intensity_score_normalized) ?? [];
  } catch (err) {
    onRelayError(err);
    return [];
  }
}
