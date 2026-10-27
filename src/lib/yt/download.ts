// The audio stream, fetched through the relay into memory. googlevideo throttles long requests,
// so it comes in fixed byte ranges over a few connections, each retried once (Fermata's approach,
// fermata/src/lib/media/download.ts, without its files on disk: a track's audio is a few MB).

import { relayed, withRange } from './relay.ts';
import type { AudioStream } from './extract.ts';

const CHUNK = 1 << 20;
const CONNECTIONS = 4;

export class DownloadError extends Error {}

async function range(url: string, start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await relayed(withRange(url, start, end), { signal });
      if (!res.ok) throw new DownloadError(`HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      if (signal?.aborted || attempt >= 1) throw err;
    }
  }
}

export async function downloadAudio(
  audio: AudioStream,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  if (!audio.size) {
    // No length given: ranges one after another until a short one ends it.
    const parts: Uint8Array[] = [];
    for (let start = 0; ; start += CHUNK) {
      const part = await range(audio.url, start, start + CHUNK - 1, signal);
      parts.push(part);
      onProgress(Math.min(0.95, parts.length * 0.1));
      if (part.length < CHUNK) break;
    }
    return join(parts).buffer as ArrayBuffer;
  }

  const out = new Uint8Array(audio.size);
  const starts: number[] = [];
  for (let start = 0; start < audio.size; start += CHUNK) starts.push(start);
  let next = 0;
  let loaded = 0;
  const worker = async () => {
    while (next < starts.length) {
      const start = starts[next++];
      const end = Math.min(audio.size, start + CHUNK) - 1;
      const part = await range(audio.url, start, end, signal);
      if (part.length !== end - start + 1) throw new DownloadError('short read');
      out.set(part, start);
      loaded += part.length;
      onProgress(loaded / audio.size);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONNECTIONS, starts.length) }, worker));
  return out.buffer;
}

function join(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
