# Evaluating the key and tempo detection

Runs the analysis worker's exact steps over audio with known keys and tempos, on every core, and
scores it. Local only: the audio isn't ours to put in the repo or in CI.

## The sets

From Zenodo, unpacked into `../datasets` next to the repo:

| Set | Use | Get it |
|---|---|---|
| GiantSteps+ EDM Key (600 two-minute EDM excerpts, keys revised by an expert) | the test: report on it, never tune on it | [record 4153506](https://zenodo.org/records/4153506): `audio.zip`, `annotations.zip`, `original_metadata.zip` into `../datasets/giantsteps-plus/` |
| Beatport EDM Key Dataset (1486 excerpts) | tuning and the learned key profiles | [record 1101082](https://zenodo.org/records/1101082): `audio.zip`, `keys.zip`, `original_metadata.zip` into `../datasets/beatport-edm-key/` |
| FMAK (keys for 5489 Free Music Archive songs, 17 genres; CC BY 4.0, the audio under each artist's licence) | pop, hip-hop, rock and the rest beside EDM | [record 10719860](https://zenodo.org/records/10719860): `fma_keys_metadata.csv` and one or more of the ten audio zips (2–5 GB each) unpacked into `../datasets/fmak/audio/`; the genres from the FMA's [`fma_metadata.zip`](https://os.unil.cloud.switch.ch/fma/fma_metadata.zip) with `python3 tools/eval/fmak_genres.py ../datasets/fmak` (bzip2 inside: macOS's unzip can't open these, Python can) |

The keys come as modes (aeolian, dorian, phrygian count as minor; ionian, mixolydian as major);
tracks with a key change or no single key are left out of the key score. The tempos are Beatport's
own BPMs from the metadata: a useful reference, not a perfect one. Decoding needs ffmpeg.

## Running it

    npm run eval -- --set giantsteps
    npm run eval -- --set beatport --out ../datasets/results/beatport.json
    npm run eval -- --set fmak                             # the FMAK songs whose audio is unpacked
    npm run eval -- --set csv:mine.csv ~/Music/tracks      # file,key,bpm[,genre]
    npm run eval -- --set giantsteps --detune 35           # every track 35 cents sharp first
    npm run eval -- --set giantsteps --src ../pitcher-main/src/lib    # another tree, to compare

Key: exactly right, the MIREX weighted score (a fifth 0.5, the relative 0.3, the parallel 0.2), the
error kinds, right within the best two, and accuracy by confidence quarter. Tempo: usable for Pitcher
(within 0.5 %, half and double allowed, since the app reads those on its own), exact integer,
Accuracy1 (±4 %) and Accuracy2 (also ×2, ×3, ×½, ×⅓).

## Results (2026-10-31, 48 kHz)

Key, exactly right (MIREX weighted; right within the best two):

| | GiantSteps+ (EDM, 545) | Beatport EDM (1392) | FMAK (661 songs of zip 020-039) |
|---|---|---|---|
| Before: whole-spectrum chroma, Krumhansl–Kessler | 44.6 % (56.6; 65.7 %) | 31.2 % (43.5; 56.2 %) | 42.1 % (53.6; 59.6 %) |
| Filtered peaks and tuning, profiles learned from Beatport | 66.1 % (74.5; 81.5 %) | learned on it | 52.8 % (62.0; 67.9 %) |
| **Now: the same, profiles learned from FMAK** | **69.2 % (76.7; 84.8 %)** | **53.0 % (62.6; 75.9 %)** | **55.4 %** (two folds) |

FMAK by genre now, two folds: pop 62 %, hip-hop 58 %, electronic 60 %, rock 48 %, folk 49 % (before:
47, 36, 39, 42, 39). The profiles learned from FMAK beat the EDM-learned ones on EDM too, and pooling
both sets did worse than FMAK alone; FMAK's keys are expert-made on whole songs, like what the app
analyses.

By confidence, on GiantSteps+: under 0.3 right 41 % (the runner-up makes it 73 %), 0.3–0.75 72 %,
0.75 and over 85 %. On FMAK: 42 %, 54 %, 67 %. GiantSteps+ detuned 35 cents sharp: 66.1 % (before
45.1 %); 45 cents flat, nearly between two semitones: 50.1 % (before 25.1 %). At 44.1 kHz: the same
as at 48.
Tempo, unchanged: usable 88.4 % on GiantSteps+, 83.6 % on Beatport (against Beatport's own BPMs).

For comparison on GiantSteps+, published (Faraldo's thesis, Table 6.5; their counts differ a little):
bgate 70.0 %, KeyFinder 68.7 %, Traktor 69.6 %, Mixed In Key 75.7 %.
