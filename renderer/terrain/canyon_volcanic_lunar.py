"""Chasm tiles (chasm, chasm-wall, chasm-wall-2, chasm-lip-n/w/e) for the Volcanic and Lunar biomes.

Uses canyon.py's builders with two new palettes: the Volcanic chasm glows a deep lava-red far
below with embers drifting up; the Lunar one is airless black with a few faint pale motes.
Rendered at 256 by canyon.build, then saved at the game's 128 x 128 into each biome's folder as
chasm-<biome>.png, chasm-wall-<biome>.png, ... (the names art/canyon/ uses).

Run from renderer/:  PYTHONPATH=terrain python3 terrain/canyon_volcanic_lunar.py
"""
import os
import sys
import tempfile
from PIL import Image

TMP = tempfile.mkdtemp(prefix='canyon-')
sys.argv = [sys.argv[0], TMP]          # canyon.py takes its output folder from argv[1]
import canyon                           # noqa: E402

canyon.PAL['volcanic'] = dict(
    void='#080403', haze='#3a1208', mote='#ff9a3c',
    rim='#4c4744', rimhi='#706a64', crack='#0c0a0a', dust='#8c8680',
    bands=['#3a3634', '#4a4441', '#2a2726', '#56382c', '#332f2e', '#5c544e', '#2e2a29', '#48392f'],
    face=0.76)
canyon.PAL['lunar'] = dict(
    void='#030406', haze='#15171d', mote='#dfe6f2',
    rim='#7c7e83', rimhi='#a0a2a7', crack='#141519', dust='#a6a8ac',
    bands=['#5e6065', '#76787d', '#4a4c51', '#6a6c71', '#55575c', '#83858a', '#4f5156', '#686a6f'],
    face=0.84)

NAMES = ['chasm', 'chasm-wall', 'chasm-wall-2', 'chasm-lip-w', 'chasm-lip-e', 'chasm-lip-n']

if __name__ == '__main__':
    for biome, seed in (('volcanic', 53), ('lunar', 67)):
        canyon.build(biome, seed)
        out = f'out/art/biomes/{biome}'
        os.makedirs(out, exist_ok=True)
        for n in NAMES:
            im = Image.open(f'{TMP}/{n}-{biome}.png')
            im.resize((128, 128), Image.LANCZOS).save(f'{out}/{n}-{biome}.png')
        print('done', biome, '->', out)
