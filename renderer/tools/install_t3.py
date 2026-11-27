"""Writes Terraforming stage 3's art (ART_GUIDE Batch 37) into the game's art folder as WebP, from the composed renders
tools/render_t3.sh makes. Run from renderer/:
    bash tools/render_t3.sh && python3 tools/install_t3.py [<game>/art]

  buildings/<b>@<team>.webp            the Seam Drill, Seed Mast and Thermal Plant (b = seamdrill, seedmast, thermal), 512 px
  buildings/seamdrill-base@<team>.webp the drill without its top drive and string (under the working loop)
  buildings/<b>-work-<0..7>.webp       the working loop: the moving parts only, every team (the top drive and string, the
                                       mast's rings in turn, the turbine hall's windows and the wellhead's breath)
  tod/<morning|evening|night>/buildings/...   all of the above, re-lit for each time of day
  resources/seedbed-<look>-<v>.webp    a Crystal Seedbed tile, look 0 prepared, 1 seeded, 2 sprouting, 3 ripe, 4 starved,
                                       variants 1..3, 256 px (by day: the game grades it with the ground)
  resources/seedbed-<look>-glow.webp   its night glow, looks 0..3 (the night render's glow pass, softened), 128 px
The third and fourth teams' buildings are the rival's recoloured in the game (recolorArt), as every building's. The Thermal
Plant's plume is the game's steam, from the tower's mouth (the render's 'plume' mark: BUILDING_EMITTERS.thermal).
"""
import os
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, '..', 'art')
OUT = os.path.join(ROOT, 'out', 't3')
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
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))
    a = np.asarray(im).astype(np.float32) / 255
    al = np.clip(a.max(axis=2, keepdims=True) * 1.4, 0, 1)
    col = np.where(al > 1e-3, np.clip(a / np.maximum(al, 1e-3), 0, 1), 0)
    put(Image.fromarray((np.concatenate([col, al], axis=2) * 255).astype(np.uint8), 'RGBA'), rel, size)


for tod in ('day', 'morning', 'evening', 'night'):
    pre = '' if tod == 'day' else f'tod/{tod}/'
    for b in ('seamdrill', 'seedmast', 'thermal'):
        for t in (0, 1):
            save(f'{OUT}/{tod}/{b}@{t}.png', f'{pre}buildings/{b}@{t}.webp', 512)
            if b == 'seamdrill':
                save(f'{OUT}/{tod}/{b}-base@{t}.png', f'{pre}buildings/{b}-base@{t}.webp', 512)
        for f in range(8):
            save(f'{OUT}/{tod}/{b}-work-{f}.png', f'{pre}buildings/{b}-work-{f}.webp', 512)
for g in range(5):
    for v in (1, 2, 3):
        save(f'{OUT}/plants/seedbed-{g}-{v}.png', f'resources/seedbed-{g}-{v}.webp', 256)
for g in range(4):
    glow(f'{OUT}/plants/seedbed-{g}-night.glow.png', f'resources/seedbed-{g}-glow.webp', 128)
total = sum(n for _, n in written)
print(f'{len(written)} files, {total // 1024} KB')
