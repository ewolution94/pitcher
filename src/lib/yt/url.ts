export type Target =
  | { kind: 'video'; id: string; start?: number; list?: string }
  | { kind: 'playlist'; list: string };

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_URL = /(?:https?:\/\/)?(?:[\w-]+\.)*(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/[^\s<>"']*/i;

/** Finds a YouTube target in free text: a URL, a bare video ID, or shared text containing a link. */
export function parseTarget(input: string): Target | null {
  const text = input.trim();
  if (!text) return null;
  if (VIDEO_ID.test(text)) return { kind: 'video', id: text };
  if (/^(PL|OLAK5uy_|UU|FL|LL)[\w-]{10,}$/.test(text)) return { kind: 'playlist', list: text };

  const match = text.match(YT_URL);
  if (!match) return null;
  try {
    return fromUrl(new URL(/^https?:\/\//i.test(match[0]) ? match[0] : `https://${match[0]}`));
  } catch {
    return null;
  }
}

/**
 * Reads a target from a YouTube URL — or from Fermata's own URL, which accepts the same paths so
 * that swapping `youtube.com` for your Fermata host in any link just works.
 */
export function fromUrl(url: URL): Target | null {
  const params = url.searchParams;
  const segments = url.pathname.split('/').filter(Boolean);
  const list = params.get('list') ?? undefined;
  const start = parseStart(params.get('t') ?? params.get('start'));

  let id: string | undefined;
  if (/(?:^|\.)youtu\.be$/i.test(url.hostname)) id = segments[0];
  else if (segments[0] === 'watch') id = params.get('v') ?? undefined;
  else if (['shorts', 'live', 'embed', 'v', 'e'].includes(segments[0])) id = segments[1];
  else if (segments.length === 1 && VIDEO_ID.test(segments[0])) id = segments[0];

  if (id && VIDEO_ID.test(id)) {
    // Mixes (RD…) are generated radio queues and can't be fetched as playlists.
    return { kind: 'video', id, start, list: list && !list.startsWith('RD') ? list : undefined };
  }
  if (list && !list.startsWith('RD')) return { kind: 'playlist', list };
  return null;
}

function parseStart(value: string | null): number | undefined {
  if (!value) return undefined;
  if (/^\d+s?$/.test(value)) return parseInt(value, 10);
  const m = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!m) return undefined;
  const seconds = (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + +(m[3] ?? 0);
  return seconds || undefined;
}
