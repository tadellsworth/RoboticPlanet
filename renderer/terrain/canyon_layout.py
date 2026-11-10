"""Assemble a test map from the canyon tiles to check joins. usage: canyon_layout.py <dir> <suffix> <ground.png> <out.png> [T]"""
import sys
from PIL import Image

d, suf, groundf, outf = sys.argv[1:5]
T = int(sys.argv[5]) if len(sys.argv) > 5 else 128
MAP = [
    "LLLLLLLL",
    "LLCCCLLL",
    "LCCCCCLL",
    "LCCCCCCL",
    "LLLCCCLL",
    "LLLLLCLL",
    "LLLLLLLL",
]
R, C = len(MAP), len(MAP[0])
g = Image.open(groundf).convert('RGBA')
gt = g.width // 4                                     # ground image = 4x4 tiles
g = g.resize((T * 4, T * 4), Image.LANCZOS)
land = lambda r, c: not (0 <= r < R and 0 <= c < C) or MAP[r][c] == 'L'
im = lambda n: Image.open(f'{d}/{n}{suf}.png').convert('RGBA').resize((T, T), Image.LANCZOS)
out = Image.new('RGBA', (C * T, R * T))
for r in range(R):
    for c in range(C):
        x, y = c * T, r * T
        if land(r, c):
            out.alpha_composite(g.crop(((c % 4) * T, (r % 4) * T, (c % 4 + 1) * T, (r % 4 + 1) * T)), (x, y))
            if not land(r - 1, c):
                out.alpha_composite(im('chasm-lip-n'), (x, y))
            if not land(r, c - 1):
                out.alpha_composite(im('chasm-lip-w'), (x, y))
            if not land(r, c + 1):
                out.alpha_composite(im('chasm-lip-e'), (x, y))
        else:
            if land(r - 1, c):
                n = 'chasm-wall'
            elif land(r - 2, c):
                n = 'chasm-wall-2'
            else:
                n = 'chasm'
            out.alpha_composite(im(n), (x, y))
out.save(outf)
