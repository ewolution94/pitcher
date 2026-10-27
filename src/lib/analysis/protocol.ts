import type { Key } from '../music.ts';
import type { Grid } from './tempo.ts';

export interface AnalysisRequest {
  id: number;
  /** One Float32Array per channel (copies: the page keeps its own for playback). */
  channels: Float32Array[];
  sampleRate: number;
}

export interface Analysis {
  grid: Grid;
  key: Key;
  keyConfidence: number;
  /** The waveform: peaks per band, 0–1, `fps` frames a second. */
  bands: { fps: number; lo: Float32Array; mi: Float32Array; hi: Float32Array };
}

export type AnalysisResponse = { id: number; ok: true; result: Analysis } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (a: Analysis) => void; reject: (e: Error) => void }>();

/** Analyses decoded audio in the worker. */
export function analyse(buffer: AudioBuffer): Promise<Analysis> {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<AnalysisResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.ok) job.resolve(event.data.result);
      else job.reject(new Error(event.data.error));
    };
    worker.onerror = () => {
      for (const job of pending.values()) job.reject(new Error('analysis'));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }
  const id = nextId++;
  const channels = Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c).slice());
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, channels, sampleRate: buffer.sampleRate } satisfies AnalysisRequest, channels.map((c) => c.buffer));
  });
}
