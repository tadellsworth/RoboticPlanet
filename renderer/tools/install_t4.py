"""Writes Terraforming stage 4's art (ART_GUIDE Batch 38) into the game's art folder as WebP, from the composed renders
tools/render_t4.sh makes. Run from renderer/:
    bash tools/render_t4.sh && python3 tools/install_t4.py [<game>/art]

  resources/ew/ew-<k>-<p>-<d>.webp         an earthwork's arm (k = bank, trench, teeth; p = n, e, s, w; d = 0 intact,
                                           1 worn, 2 breached), every team, 256 px (by day: baked and graded with the ground)
  resources/ew/ew-<k>-post-<d>@<team>.webp its post, with the team's stake, lamp post or cat's-eye, 256 px
  resources/ew/ew-bank-hub-<ew|ns>-<d>@<team>.webp  a bank's middle on a straight run: the stake alone
  resources/ew/ew-<k>-glow-<d>@<team>.webp the post's night lights (its glow pass, softened), d = 0 and 1, 128 px
  buildings/sluice-<dir>[-open]@<team>.webp  the Sluice for the side its water is on (n, s, e, w), shut and open, 512 px
  buildings/saphead-f<0..3>@<team>.webp    the Sap Head and its four-frame work loop (the skip's run, the fan, the spoil)
  buildings/sapexit@<team>.webp            a sap's break-out
  tod/<morning|evening|night>/buildings/...  the Sluice, Sap Head and Sap Exit re-lit for each time of day
The third and fourth teams' are the rival's recoloured in the game (recolorArt), as every building's.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 't4')
written = []


def put(im, rel, size, q=82):
    if im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    p = os.path.join(ART, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p, 'WEBP', quality=q, method=6)
    written.append((rel, os.path.getsize(p)))


def save(src, rel, size, q=82):
    put(Image.open(src).convert('RGBA'), rel, size, q)


def glow(src, rel, size):
    """The glow pass as light: its colour, alpha from its brightness, softened a little."""
    g = np.asarray(Image.open(src).convert('RGBA')).astype(np.float32) / 255
    rgb = g[..., :3] * g[..., 3:4]
    base = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    near = np.asarray(base.filter(ImageFilter.GaussianBlur(3))).astype(np.float32) / 255
    wide = np.asarray(base.filter(ImageFilter.GaussianBlur(16))).astype(np.float32) / 255
    a = np.clip(near * 3 + wide * 9, 0, 1)  # (a bright core and a wide halo: a lamp has to read at night at 40 px a tile)
    al = np.clip(a.max(axis=2, keepdims=True) * 1.6, 0, 1)
    col = np.where(al > 1e-3, np.clip(a / np.maximum(al, 1e-3), 0, 1), 0)
    put(Image.fromarray((np.concatenate([col, al], axis=2) * 255).astype(np.uint8), 'RGBA'), rel, size)


for k in ('bank', 'trench', 'teeth'):
    for d in (0, 1, 2):
        for p in ('n', 'e', 's', 'w'):
            save(f'{OUT}/ew/ew-{k}-{p}-{d}.png', f'resources/ew/ew-{k}-{p}-{d}.webp', 256)
        for t in (0, 1):
            save(f'{OUT}/ew/ew-{k}-post-{d}@{t}.png', f'resources/ew/ew-{k}-post-{d}@{t}.webp', 256)
            if k == 'bank':
                for a in ('ew', 'ns'):
                    save(f'{OUT}/ew/ew-{k}-hub-{a}-{d}@{t}.png', f'resources/ew/ew-{k}-hub-{a}-{d}@{t}.webp', 256)
            if d < 2:
                glow(f'{OUT}/ew/ew-{k}-post-{d}@{t}.glow.png', f'resources/ew/ew-{k}-glow-{d}@{t}.webp', 128)
for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for t in (0, 1):
        for d in ('n', 's', 'e', 'w'):
            for o in ('', '-open'):
                save(f'{OUT}/{tod}/sluice-{d}{o}@{t}.png', f'{pre}buildings/sluice-{d}{o}@{t}.webp', 512)
        for f in range(4):
            save(f'{OUT}/{tod}/saphead-f{f}@{t}.png', f'{pre}buildings/saphead-f{f}@{t}.webp', 512)
        save(f'{OUT}/{tod}/sapexit@{t}.png', f'{pre}buildings/sapexit@{t}.webp', 512)
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')
