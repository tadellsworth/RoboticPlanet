"""Finish the proposed resource renders (b/resources.js): the day sprite and, where it glows, its night glow map.

    python3 post/resource_post.py <dir> name [name ...] [--day 0.25]

From <name>.beauty.png and <name>.glow.png (512) it writes, at 256 (one tile, like art/resources/*):
  <name>.png       the sprite as drawn by day: the render, with a touch of its glow (--day, default 0.25) for the glints
  <name>-glow.png  the glow alone, bloomed (scaled by --glowk): RGB its colour, alpha its strength, for the game to add at night over the
                   graded sprite (as the biomes' plant glows are); only written when the render has glowing parts
Resources are graded for the time of day in code, so there are no morning, evening or night re-renders.
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
d = args[0]
names = [a for a in args[1:] if not a.startswith('--') and not a.replace('.', '').isdigit()]
DAY = float(args[args.index('--day') + 1]) if '--day' in args else 0.25
GK = float(args[args.index('--glowk') + 1]) if '--glowk' in args else 1.0   # the glow map's strength


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255


def down(a):
    h = a.shape[0] // 2
    return a.reshape(h, 2, h, 2, a.shape[2]).mean((1, 3))


for n in names:
    b, g = load(f'{d}/{n}.beauty.png'), load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]
    gl = g[..., :3] * g[..., 3:4]
    gi = Image.fromarray((gl * 255).astype(np.uint8))
    bloom = 0.9 * np.asarray(gi.filter(ImageFilter.GaussianBlur(3.5))).astype(np.float32) / 255 + 1.1 * np.asarray(gi.filter(ImageFilter.GaussianBlur(11))).astype(np.float32) / 255
    halo = np.clip(gl + bloom, 0, 1)
    # the day sprite: premultiplied, a little of the glow added, downsampled, un-premultiplied
    prem = np.clip(b[..., :3] * a + halo * DAY * a, 0, 1)
    out = down(np.concatenate([prem, a], -1))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}.png')
    if gl.max() > 0.02:
        h = down(halo)
        ga = np.clip(h.max(-1, keepdims=True) * GK, 0, 1)
        col = np.clip(np.where(ga > 1e-4, h * GK / np.maximum(ga, 1e-4), 0), 0, 1)
        Image.fromarray((np.concatenate([np.clip(col, 0, 1), ga], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}-glow.png')
    print('finished', n, 'glow' if gl.max() > 0.02 else '')
