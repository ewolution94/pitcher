# Pitcher

Paste a YouTube link, set a BPM, and hear the track at it: the key held, or resampled the way a
record (and FL Studio's default) does it. A quick test of a bootleg idea before the DAW opens.
Live at [pitcher.ewolution.cloud](https://pitcher.ewolution.cloud).

- **The tempo, typed or thrown.** Type a BPM into the big number, or drag the ruler (throw it and it
  settles on a tenth, or on the source tempo, its half or its double near one). The arrow keys nudge
  by 0.1 or 1.
- **Keep key or Resample.** Keep key (the default) changes the tempo and holds the key; Resample ties
  the pitch to the tempo like a record. The key moves on its own too, with − and +.
- **Detected, then yours.** The source tempo, its beat grid and its key are read in the page. Click
  the tempo to correct it, tap it with `T`, read it as half or double time (picked on its own when
  that's closer), pick another key.
- **What a session needs.** Hold for the original, loops of 4, 8 or 16 bars from wherever the
  playhead is, Reset (straight back to the detected tempo and key), and Copy: the numbers for the
  DAW and a link that opens the same test. On the keys, a kick on every beat at the new tempo (`K`)
  and Hook, YouTube's most replayed part (`H`).
- **Files too.** Drop an MP3, WAV, AAC or FLAC anywhere, open one from the link field, or paste a
  link anywhere on the page.
- **The family's shell.** English and German, light and dark, installs to the home screen, counts
  visits with Census, no cookies.

## How it works

```
 Browser                                                     Server (server/, no dependencies)
 ┌────────────────────────────────────────────────┐          ┌───────────────────────────────┐
 │ youtubei.js: the audio stream's address         │  /relay  │ relay.mjs (Fermata's):         │  YouTube
 │ download.ts: the stream in 1 MB ranges          │ ───────► │  YouTube's hosts only,         │ ─► youtube.com
 │ decodeAudioData: the samples                    │ ◄─────── │  bytes in, bytes out,          │ ◄─ googlevideo.com
 │ analysis worker: bands, tempo + grid, key       │          │  nothing stored                │
 │ Signalsmith Stretch (WASM, audio worklet):      │          │ census.mjs: /_e → Census       │
 │   tempo and pitch apart; the kick on the grid    │          └───────────────────────────────┘
 └────────────────────────────────────────────────┘
```

- **Getting the audio** is Fermata's way (`fermata/`): YouTube sends no CORS headers and binds its
  stream URLs to the address that asked, so the browser talks to YouTube through the relay. The
  client chain and the tail probe are Fermata's (`src/lib/yt/extract.ts`); Pitcher takes the best
  audio-only stream (AAC before Opus) and keeps it in memory, never on disk.
- **The analysis** (`src/lib/analysis/`) runs in a worker. The waveform's three bands come from two
  cascaded one-pole filters (150 Hz, 2.5 kHz), every 10 ms. The tempo: an onset envelope from the
  bands' energy, its autocorrelation for the neighbourhood, then folding the whole envelope at each
  candidate period (0.01 BPM apart) for the exact tempo and the beat's phase; the downbeat is the
  beat where the lows rise most. The key: a chromagram (FFT at ~11 kHz, 65 Hz to 2.1 kHz) against
  the Krumhansl–Kessler profiles.
- **Playback** (`src/lib/audio/engine.ts`): [Signalsmith Stretch](https://signalsmith-audio.co.uk/code/stretch/)
  (MIT) in an audio worklet does tempo and pitch separately; Resample is the same node with the pitch
  set to the tempo ratio (12 × log2). The kick is a synthesised one, scheduled a little ahead on the
  source's beat grid at the context time the stretched playhead reaches each beat.
- **State** (`src/lib/session.svelte.ts`) keeps the address up to date (`/?v=…&bpm=128&st=1`), so a
  reload or a sent link opens the same test, and the recent tracks on the device.

## Run it

```bash
npm install
npm run dev     # http://localhost:7210, the relay included
npm test        # the analysis on made-up audio, keys, the address, the relay's allowlist
npm run check   # svelte-check
npm run build && npm start   # the production server on :8080 (PORT to change it)
```

## Deploy (NAS)

A push to `release` runs the checks (`ci.yml`) and publishes `ghcr.io/ewolution94/pitcher:latest`
(amd64 and arm64); the shared Watchtower deploys it. The stack is `deploy/portainer-stack.yml`, not
`docker-compose.yml` (that one builds from source).

| Variable | Default | What it does |
|---|---|---|
| `PORT` | `8080` | Where the server listens (the NAS stack sets its registry port). |
| `HOST` | `0.0.0.0` | |
| `PITCHER_CENSUS` | off | Census's ingest origin (`http://census:4901` on the `ewolution` network). |
| `PITCHER_IPV4` | off | `1` pins IPv4 towards YouTube, should a dual-stack host get 403s. |

## Project layout

```
server/          server.mjs (static, headers, relay, Census), relay.mjs, census.mjs
src/lib/yt/      extract.ts (youtubei.js, lazily), download.ts, relay.ts, url.ts
src/lib/analysis bands.ts, tempo.ts, key.ts, fft.ts, worker.ts, protocol.ts
src/lib/audio/   engine.ts (Signalsmith Stretch, the kick)
src/lib/         session.svelte.ts, music.ts, share.ts, prefs, theme, i18n
src/components/  Header, Start, Deck (Track, Wave as the stage with Tempo, Key and Ruler over it, Transport), Settings
vendor/ewo/      Folio's tokens and elements (npm run vendor -- pitcher, in Folio)
tests/           node --test, no browser
```
