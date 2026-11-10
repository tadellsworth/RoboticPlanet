"""Assemble wall/gate sprites into a small base layout the way the game would draw them.

Each wall tile = layers in this order: arm-n, arm-w, arm-e, post, arm-s (each followed by its spark frame).
A gate tile = one gate image (+ spark). Tiles are drawn row by row, top to bottom.
Image size = 1.4 x tile, anchor (0.5, 0.615) on the tile centre.
"""
import sys
import os
import numpy as np
from PIL import Image

D = '../out'
LAYOUT = [
    "...........",
    ".##~##.....",
    ".#...#####.",
    ".=...#...#.",
    ".#...#...|.",
    ".#...#...#.",
    ".##-##...#.",
    ".....#####.",
    "...........",
]
# '#' wall, '-' gate across an east-west run, '|' gate across a north-south run, '=' open east-west... see below
GATES = {'-': 'gate-ew-closed', '=': 'gate-ns-open', '|': 'gate-ns-closed', '~': 'gate-ew-open'}


def is_wallish(c):
    return c in '#' or c in GATES


def connects(layout, r, c, dr, dc):
    rr, cc = r + dr, c + dc
    if not (0 <= rr < len(layout) and 0 <= cc < len(layout[0])):
        return False
    ch = layout[rr][cc]
    if ch == '#':
        return True
    if ch in GATES:
        ew = GATES[ch].startswith('gate-ew')
        return (dr == 0) if ew else (dc == 0)
    return False


_cache = {}


def sprite(name, size):
    k = (name, size)
    if k not in _cache:
        p = f'{D}/{name}.png'
        _cache[k] = Image.open(p).resize((size, size), Image.LANCZOS) if os.path.exists(p) else None
    return _cache[k]


def compose(T, frame, team='@0', ground=None, layout=LAYOUT):
    H, W = len(layout), len(layout[0])
    S = int(round(1.4 * T))
    if ground is not None:
        img = ground.resize((W * T, H * T)) if ground.size != (W * T, H * T) else ground.copy()
        img = img.convert('RGBA')
    else:
        img = Image.new('RGBA', (W * T, H * T), (166, 117, 74, 255))
    for r in range(H):
        for c in range(W):
            ch = layout[r][c]
            if not is_wallish(ch):
                continue
            cx, cy = c * T + T / 2, r * T + T / 2
            x0, y0 = int(round(cx - 0.5 * S)), int(round(cy - 0.615 * S))
            if ch in GATES:
                layers = [GATES[ch]]
            else:
                layers = []
                if connects(layout, r, c, -1, 0): layers.append('wall-n')
                if connects(layout, r, c, 0, -1): layers.append('wall-w')
                if connects(layout, r, c, 0, 1): layers.append('wall-e')
                n_, s_ = connects(layout, r, c, -1, 0), connects(layout, r, c, 1, 0)
                w_, e_ = connects(layout, r, c, 0, -1), connects(layout, r, c, 0, 1)
                straight_ew = w_ and e_ and not n_ and not s_
                straight_ns = n_ and s_ and not w_ and not e_
                if (straight_ew or straight_ns) and (r + c) % 2 == 1:
                    layers.append('wall-hub-ew' if straight_ew else 'wall-hub-ns')
                else:
                    layers.append('wall-post')
                if s_: layers.append('wall-s')
            for L in layers:
                for nm in (f'{L}{team}', f'{L}{team}.spark-{frame}' if frame is not None else None):
                    if nm is None:
                        continue
                    sp = sprite(nm, S)
                    if sp is not None:
                        img.alpha_composite(sp, (x0, y0)) if x0 >= 0 and y0 >= 0 else img.paste(sp, (x0, y0), sp)
    return img


if __name__ == '__main__':
    team = sys.argv[1] if len(sys.argv) > 1 else '@0'
    gpath = sys.argv[2] if len(sys.argv) > 2 else None
    ground = None
    if gpath:
        g = Image.open(gpath).convert('RGBA')
        def ground_for(T):
            s = 4 * T
            gg = g.resize((s, s), Image.LANCZOS)
            out = Image.new('RGBA', (len(LAYOUT[0]) * T, len(LAYOUT) * T))
            for x in range(0, out.width, s):
                for y in range(0, out.height, s):
                    out.paste(gg, (x, y))
            return out
    else:
        ground_for = lambda T: None
    big = compose(96, 0, team, ground_for(96))
    small = compose(45, 0, team, ground_for(45))
    big.save(f'{D}/layout-big{team}.png')
    small.save(f'{D}/layout-phone{team}.png')
    frames = [compose(64, f, team, ground_for(64)).convert('RGB') for f in range(6)]
    frames[0].save(f'{D}/layout-anim{team}.gif', save_all=True, append_images=frames[1:], duration=90, loop=0)
    print('ok', big.size, small.size)
