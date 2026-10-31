# Evaluating the key and tempo detection

Runs the analysis worker's exact steps over audio with known keys and tempos, on every core, and
scores it. Local only: the audio isn't ours to put in the repo or in CI.

## The sets

Both from Zenodo under CC BY-SA 4.0, unpacked into `../datasets` next to the repo:

| Set | Use | Get it |
|---|---|---|
| GiantSteps+ EDM Key (600 two-minute EDM excerpts, keys revised by an expert) | the test: report on it, never tune on it | [record 4153506](https://zenodo.org/records/4153506): `audio.zip`, `annotations.zip`, `original_metadata.zip` into `../datasets/giantsteps-plus/` |
| Beatport EDM Key Dataset (1486 excerpts) | tuning and the learned key profiles | [record 1101082](https://zenodo.org/records/1101082): `audio.zip`, `keys.zip`, `original_metadata.zip` into `../datasets/beatport-edm-key/` |

The keys come as modes (aeolian, dorian, phrygian count as minor; ionian, mixolydian as major);
tracks with a key change or no single key are left out of the key score. The tempos are Beatport's
own BPMs from the metadata: a useful reference, not a perfect one. Decoding needs ffmpeg.

## Running it

    npm run eval -- --set giantsteps
    npm run eval -- --set beatport --out ../datasets/results/beatport.json
    npm run eval -- --set csv:mine.csv ~/Music/tracks      # file,key,bpm[,genre]
    npm run eval -- --set giantsteps --detune 35           # every track 35 cents sharp first
    npm run eval -- --set giantsteps --src ../pitcher-main/src/lib    # another tree, to compare

Key: exactly right, the MIREX weighted score (a fifth 0.5, the relative 0.3, the parallel 0.2), the
error kinds, right within the best two, and accuracy by confidence quarter. Tempo: usable for Pitcher
(within 0.5 %, half and double allowed, since the app reads those on its own), exact integer,
Accuracy1 (±4 %) and Accuracy2 (also ×2, ×3, ×½, ×⅓).

## Results (2026-10-31, 48 kHz)

GiantSteps+, 545 tracks with one key:

| | Correct | Weighted | Top two | Minor tracks | Major tracks |
|---|---|---|---|---|---|
| Before: whole-spectrum chroma, Krumhansl–Kessler | 44.6 % | 56.6 | 65.7 % | 45.5 % | 40.0 % |
| After: filtered peaks, tuning, learned profiles | **66.1 %** | **74.5** | **81.5 %** | 68.8 % | 52.2 % |

After, by confidence: under 0.3 right 41 % (the runner-up makes it 76 %), 0.3–0.75 about 67 %, over
0.75 85 %. Detuned 35 cents: 63.9 % (before 45.1 %); 45 cents flat: 47.2 % (before 25.1 %). At
44.1 kHz: 66.4 %. Tempo, unchanged: usable 88.4 %, exact 86.1 %, Accuracy2 89.6 %.

For comparison on the same set, published (Faraldo's thesis, Table 6.5; their counts differ a little):
bgate 70.0 %, KeyFinder 68.7 %, Traktor 69.6 %, Mixed In Key 75.7 %. Everything here is EDM; pop isn't
measured yet.
