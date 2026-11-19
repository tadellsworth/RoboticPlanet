"""Boiling Springs textures and scenery, lit from the upper left like the other biomes.

Run: python renderer/terrain/terrain_springs.py art/biomes/springs
"""
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import numpy as np
from PIL import Image

from tex import TAU, fbm, hexrgb, mix, normals_from_height, relief, smoothstep
from terrain_biomes import crag_height, over

N = 512


def terraces(phase):
    """Soft deposits separated by a sharp raised lip and a shadow below it."""
    f = phase % 1
    lip = np.exp(-((f - 0.22) / 0.12) ** 2)
    foot = np.exp(-((f - 0.48) / 0.13) ** 2)
    return lip, foot


def ground():
    broad = fbm(N, 701, 2, 13, 2.0)
    grit = fbm(N, 702, 18, 210, 1.25)
    fine = fbm(N, 703, 60, 245, 0.6)
    sulfur = smoothstep(0.35, 1.7, fbm(N, 704, 3, 44, 1.75) + fine * 0.10)
    rise = broad * 1.0 + fbm(N, 705, 8, 42, 1.55) * 0.20
    lip, foot = terraces(rise * 1.48)
    shelf = smoothstep(-1.2, 0.8, fbm(N, 706, 2, 14, 1.9))
    h = broad * 2 + grit * 0.34 + (lip - 0.52 * foot) * shelf * 1.8
    color = mix(hexrgb('#96846b'), hexrgb('#c8bd9c'), smoothstep(-1.7, 1.6, broad + 0.23 * grit))
    color = over(color, hexrgb('#c5a34e'), sulfur * 0.82)
    color = over(color, hexrgb('#9a5f38'), smoothstep(0.98, 1.5, rise) * sulfur * 0.49)
    color = over(color, hexrgb('#e6dfc4'), lip * shelf * 0.41)
    color = over(color, hexrgb('#78614a'), foot * shelf * 0.28)
    pits = smoothstep(1, 2.5, fine)
    return over(color, hexrgb('#6b604e'), pits * 0.27) * (0.78 + 0.24 * relief(normals_from_height(h), 225, 48))[..., None]


def water():
    flow = fbm(N, 711, 2, 35, 1.7, aniso=(1.4, 0.75), angle=0.4)
    mineral = fbm(N, 712, 2, 15, 2.1) + flow * 0.22
    color = mix(hexrgb('#136f77'), hexrgb('#56b8a3'), smoothstep(-1.7, 1.9, mineral))
    color = over(color, hexrgb('#9ac18a'), smoothstep(0.75, 2.5, mineral) * 0.50)
    current = fbm(N, 713, 3, 72, 1.3, aniso=(0.45, 1.7), angle=-0.3)
    gleam = (1 - smoothstep(0.08, 0.24, np.abs(current + flow * 0.62)))
    return over(color, hexrgb('#c6f1cb'), gleam * smoothstep(-0.4, 1.1, flow) * 0.18)


def rock():
    height, _, _ = crag_height(721, n_blocks=40, amp=15)
    field = fbm(N, 722, 3, 50, 1.8)
    lip, foot = terraces(height * 0.24 + field * 0.22)
    color = mix(hexrgb('#6c6152'), hexrgb('#aca185'), smoothstep(-1.5, 1.8, field))
    color = over(color, hexrgb('#c6b78f'), lip * 0.48)
    color = over(color, hexrgb('#5f4b36'), foot * 0.38)
    return color * (0.58 + relief(normals_from_height(height + lip), 225, 49) * 0.52)[..., None]


def cliff():
    height, width = 48, 128
    y, x = np.mgrid[0:height, 0:width]
    warp = 1.3 * np.sin(TAU * x / width * 2.0) + 0.55 * np.sin(TAU * x / width * 7.0)
    phase = (y + warp + 0.055 * y * np.cos(TAU * x / width * 3.0)) / 7.9
    lip, foot = terraces(phase)
    grain = fbm(width, 731, 8, 59, 1.3, ny=height)
    color = mix(hexrgb('#8e795e'), hexrgb('#c7b58a'), smoothstep(-1.2, 1.4, grain))
    color = over(color, hexrgb('#e0d6af'), lip * 0.71)
    color = over(color, hexrgb('#735133'), foot * 0.64)
    color = over(color, hexrgb('#cba854'), smoothstep(0.6, 1.6, grain) * (1 - smoothstep(11, 38, y)) * 0.50)
    return color * (1 - 0.49 * (y / height) ** 1.1)[..., None]


# Broad blue bath, sage-and-amber pool, cascading terraces, geyser cone, sulfur shelf and twin vents.
# Each lobe is (centre x/y, horizontal/vertical radius, rotation), in sprite-space.
SPRITES = [
    ([(0.00, -0.02, 0.83, 0.62, -0.36)], '#136b85', '#5ad8c7', '#c5a855'),
    ([(0.00, 0.00, 0.76, 0.52, 0.52), (0.38, 0.16, 0.43, 0.33, -0.6)], '#36786c', '#9dd0a1', '#c9763d'),
    ([(-0.31, -0.28, 0.51, 0.38, 0.18), (0.23, 0.02, 0.62, 0.45, -0.2),
      (0.19, 0.46, 0.43, 0.28, 0.19)], '#1e8189', '#6dceb3', '#a68148'),
    ([(0.00, 0.00, 0.73, 0.60, -0.22)], '#234c59', '#74b4ad', '#b5965b'),
    ([(-0.22, -0.10, 0.65, 0.50, -0.42), (0.31, 0.26, 0.52, 0.34, 0.27)], None, None, '#bd9039'),
    ([(0.00, 0.00, 0.65, 0.46, -0.48), (0.43, 0.22, 0.35, 0.27, -0.30)], '#3c7166', '#9eae79', '#ac7139'),
]


def deposit(kind):
    n = 256
    y, x = np.mgrid[0:n, 0:n] / (n / 2) - 1
    lobes, depth, shallows, stain = SPRITES[kind - 1]
    # Argmin gives the rim around the whole set of basins. Overlapping pools have saddles between them.
    def radius(cx, cy, rx, ry, angle):
        c, s = np.cos(angle), np.sin(angle)
        return np.hypot(((x - cx) * c + (y - cy) * s) / rx, (-(x - cx) * s + (y - cy) * c) / ry)

    basins = [radius(*lobe) for lobe in lobes]
    grit = fbm(n, 750 + kind, 10, 120, 1.2)
    warp = fbm(n, 760 + kind, 2, 13, 1.7)
    r = np.minimum.reduce(basins) + 0.037 * warp + 0.014 * grit
    h = 5 * (1 - smoothstep(0.14, 1.0, r))
    if kind == 4:
        h += 15 * (1 - smoothstep(0.10, 0.60, r))
    phase = r * (7.6 if kind == 4 else 5.3) + 0.11
    lip, foot = terraces(phase)
    h += 1.4 * lip - 0.65 * foot + 0.23 * grit
    lit = relief(normals_from_height(h), 225, 48)
    color = mix(hexrgb('#aa936d'), hexrgb('#dfd4ae'), smoothstep(0.15, 0.9, lit))
    color = over(color, hexrgb(stain), smoothstep(-0.5, 1.3, warp + 0.4 * grit) * 0.63)
    color = over(color, hexrgb('#eee0b3'), lip * 0.71)
    color = over(color, hexrgb('#6a5137'), foot * 0.33)
    if depth:
        limit = {1: 0.69, 2: 0.58, 3: 0.63, 4: 0.22, 6: 0.37}[kind]
        filled = 1 - smoothstep(limit - 0.02, limit + 0.015, r)
        bank = smoothstep(limit - 0.08, limit - 0.025, r)
        liquid = mix(hexrgb(depth), hexrgb(shallows), smoothstep(limit * 0.14, limit, r + warp * 0.041))
        ripple = (1 - smoothstep(0.07, 0.28, np.abs(fbm(n, 770 + kind, 6, 34, 1.3) + warp * 0.55)))
        liquid = over(liquid, hexrgb('#e3f7d6'), ripple * smoothstep(-0.2, 1.2, warp) * 0.26 + lip * bank * 0.26)
        color = over(color, hexrgb('#8d532a'), smoothstep(limit - 0.01, limit + 0.035, r) * (1 - smoothstep(limit + 0.055, limit + 0.09, r)) * 0.78)
        color = over(color, liquid, filled)
    rim = 1 - smoothstep(0.83, 1.005, r)
    shadow = (1 - smoothstep(0.77, 1.12, np.roll(r, (8, 7), (0, 1)))) * 0.34
    alpha = rim + shadow * (1 - rim)
    rgb = (color * rim[..., None] + hexrgb('#423729') * (alpha - rim)[..., None]) / np.maximum(alpha[..., None], 1e-6)
    return np.dstack((rgb, alpha))


def save(pixels, file):
    Image.fromarray(np.uint8(np.clip(pixels, 0, 1) * 255 + 0.5)).save(file, quality=86, method=6)


def save_canyon(out):
    # Reuse the Sky islands' shapes and lighting with the basin's limestone palette.
    import canyon

    canyon.PAL['springs'] = dict(
        void='#171613', haze='#3c453b', mote='#ead4a7',
        rim='#9d8a68', rimhi='#d6c297', crack='#2e2721', dust='#bda681',
        bands=['#8b775b', '#b19b76', '#756650', '#9e895d', '#beb08e', '#6c5a45', '#aa9262', '#998772'],
        face=0.84)
    with TemporaryDirectory(prefix='springs-canyon-') as temp:
        canyon.OUT = temp
        canyon.build('springs', 769)
        for source in Path(temp).glob('*.png'):
            with Image.open(source) as img:
                img.resize((128, 128), Image.Resampling.LANCZOS).save(out / (source.stem + '.webp'), quality=84, method=6)


if __name__ == '__main__':
    out = Path(sys.argv[1])
    out.mkdir(parents=True, exist_ok=True)
    for job in (ground, water, rock, cliff):
        save(job(), out / f'{job.__name__}.webp')
    for kind in range(1, len(SPRITES) + 1):
        save(deposit(kind), out / f'plant-{kind}.webp')
    save_canyon(out)
