// The analysis runs off the main thread: the waveform's bands, the tempo and grid, the key. A
// four-minute track takes well under a second; the page stays responsive meanwhile.

import { computeBands, mixDown } from './bands.ts';
import { detectKey } from './key.ts';
import { detectGrid } from './tempo.ts';
import type { AnalysisRequest, AnalysisResponse } from './protocol.ts';

self.onmessage = (event: MessageEvent<AnalysisRequest>) => {
  const { id, channels, sampleRate } = event.data;
  try {
    const mono = mixDown(channels);
    const bands = computeBands(mono, sampleRate);
    const grid = detectGrid(bands);
    const key = detectKey(mono, sampleRate);
    const response: AnalysisResponse = {
      id,
      ok: true,
      result: { grid, key: key.key, keyConfidence: key.confidence, bands: { fps: bands.fps, lo: bands.lo, mi: bands.mi, hi: bands.hi } },
    };
    (self as unknown as Worker).postMessage(response, [bands.lo.buffer, bands.mi.buffer, bands.hi.buffer]);
  } catch (err) {
    const response: AnalysisResponse = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(response);
  }
};
