import { LocalizedError, msg } from '../i18n/message.ts';

// Copied from Fermata (fermata/src/lib/yt/relay.ts); the relay is always on this origin.

/** Rewrites an absolute YouTube URL to go through the relay (server/relay.mjs). */
export function relayUrl(url: string | URL): string {
  const u = typeof url === 'string' ? new URL(url) : url;
  return `/relay/${u.host}${u.pathname}${u.search}`;
}

export const SERVER_UNREACHABLE = msg('error.serverUnreachable');

/**
 * Pitcher's own server is unreachable, or it couldn't reach YouTube. Distinct from YouTube
 * refusing a request, so the UI doesn't blame YouTube when the problem is on our side.
 */
export class RelayError extends LocalizedError {}

/**
 * Why one of Pitcher's own files (a lazily loaded chunk, the worker) failed to load. Established by
 * asking the server, never by reading the error: every browser words a failed load its own way
 * ("Failed to fetch dynamically imported module", Safari's "Importing a module script failed.",
 * Firefox's "error loading dynamically imported module"). Either the server is unreachable, or it
 * answers but no longer has the file, because a deploy replaced it while this page stayed open.
 */
export async function loadFailure(): Promise<LocalizedError> {
  try {
    const res = await fetch('/healthz', { cache: 'no-store' });
    if (res.ok) return new LocalizedError(msg('error.appUpdated'));
  } catch {}
  return new RelayError(SERVER_UNREACHABLE);
}

/** import() of one of Pitcher's own chunks, failing with a reason the user can act on. */
export async function loadChunk<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    // A failed load rejects with a TypeError; anything else is the module itself throwing.
    if (err instanceof TypeError) throw await loadFailure();
    throw err;
  }
}

/** fetch() through the relay, turning transport failures and relay-side errors into RelayError. */
export async function relayed(url: string | URL, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(relayUrl(url), init);
  } catch (err) {
    if (init?.signal?.aborted) throw err;
    throw new RelayError(SERVER_UNREACHABLE);
  }
  if (res.headers.get('x-pitcher-relay') === 'error') {
    const detail = await res.json().then((body: { error?: string }) => body.error ?? res.statusText, () => res.statusText);
    throw new RelayError(msg(res.status >= 500 ? 'error.relayUpstream' : 'error.relayRejected', { detail }));
  }
  return res;
}

/** Adds googlevideo's `range` query parameter, which avoids the throttling plain requests get. */
export function withRange(url: string, start: number, end: number): string {
  const u = new URL(url);
  u.searchParams.set('range', `${start}-${end}`);
  return u.toString();
}

export function thumbnailUrl(videoId: string, size: 'maxresdefault' | 'sddefault' | 'hqdefault' | 'mqdefault' = 'hqdefault') {
  return relayUrl(`https://i.ytimg.com/vi/${videoId}/${size}.jpg`);
}
