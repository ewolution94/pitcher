"""The top genre of every FMAK track, for the evaluation's per-genre results: genres.json beside the keys.

The FMA's own metadata (fma_metadata.zip, bzip2 inside, which macOS's unzip can't read) gives a top
genre for under half of them; the rest take the commonest top-level genre among all their genres.

    python3 tools/eval/fmak_genres.py ../datasets/fmak
"""

import ast
import collections
import csv
import io
import json
import sys
import zipfile
from pathlib import Path

csv.field_size_limit(sys.maxsize)
folder = Path(sys.argv[1] if len(sys.argv) > 1 else '../datasets/fmak')
archive = zipfile.ZipFile(folder / 'fma_metadata.zip')

names, top_of = {}, {}
for g in csv.DictReader(io.TextIOWrapper(archive.open('fma_metadata/genres.csv'), encoding='utf-8')):
    names[g['genre_id']] = g['title']
    top_of[g['genre_id']] = g['top_level']

rows = csv.reader(io.TextIOWrapper(archive.open('fma_metadata/tracks.csv'), encoding='utf-8', newline=''))
groups, fields, _ = next(rows), next(rows), next(rows)
columns = [f'{a}.{b}' for a, b in zip(groups, fields)]
top_col, all_col = columns.index('track.genre_top'), columns.index('track.genres_all')
top = {}
for row in rows:
    genre = row[top_col]
    if not genre and row[all_col]:
        counts = collections.Counter(names.get(top_of.get(str(i), ''), '') for i in ast.literal_eval(row[all_col]))
        counts.pop('', None)
        genre = counts.most_common(1)[0][0] if counts else ''
    top[row[0]] = genre

keys = list(csv.DictReader(open(folder / 'fma_keys_metadata.csv', encoding='utf-8')))
json.dump({k['track_id']: top.get(k['track_id'], '') for k in keys}, open(folder / 'genres.json', 'w'))
print(f"genres.json: {len(keys)} tracks;", collections.Counter(top.get(k['track_id'], '') for k in keys).most_common(8))
