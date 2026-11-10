"""Lit lamp-head overlays (3D lens render + a glow that spills round the housing) and the optional light pools."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, json, math
import numpy as np
from PIL import Image
sys.path.insert(0, _os.path.join(_ROOT, 'fx'))
from fxlib import Canvas

D = _os.path.join(sys.argv[1], ''); O = _os.path.join(sys.argv[2], '')   # usage: lamps_post.py <rawdir> <outdir>
import os; os.makedirs(O, exist_ok=True)
KINDS = {
    'road':    {'glow': (1.0, 0.52, 0.16), 'core': (1.0, 0.74, 0.42), 'head': (-0.95, 0.85), 'k': 1.0, 'pool': 1.3, 'poolcol': (1.0, 0.573, 0.204)},
    'asphalt': {'glow': (0.894, 0.933, 1.0), 'core': (1.0, 1.0, 1.0), 'head': (-0.9, 0.9), 'k': 1.15, 'pool': 1.6, 'poolcol': (0.894, 0.933, 1.0)},
}
PX = 25.6   # px per world unit on the 256 canvas

for kind, c in KINDS.items():
    m = json.load(open(f'{D}streetlamp-{kind}.geom.json'))['marks']
    lx, ly = m['lens'][0] * 256, m['lens'][1] * 256
    cv = Canvas(256, 256, 2)
    k = c['k']
    # wide soft halo round the head, then a hot band along the underside of the housing
    cv.blob(lx, ly + 4, 58, c['glow'], alpha=0.30 * k, glowk=0.5, power=2.2)
    cv.blob(lx, ly + 2, 34, c['glow'], alpha=0.45 * k, glowk=0.8, power=1.8)
    x0, x1 = lx + c['head'][0] * PX, lx + c['head'][1] * PX
    for i in range(9):
        x = x0 + (x1 - x0) * i / 8; w = 1 - abs(i - 4) / 5
        cv.blob(x, ly + 1.5, 7 + 3 * w, c['core'], alpha=0.75 * w + 0.2, glowk=1.0, power=1.4)
    img = Image.fromarray(cv.finish(bloom=(3, 9), bloomk=(0.6, 0.4)), 'RGBA')
    img.alpha_composite(Image.open(f'{D}streetlamp-{kind}-lit.png'))      # the lens itself, exactly where the 3D head puts it
    img.save(f'{O}streetlamp-{kind}-lit.png')
    Image.open(f'{D}streetlamp-{kind}.png').save(f'{O}streetlamp-{kind}.png')
    # optional light pool: soft round pool, colour as in the game's code
    n = 256; yy, xx = np.mgrid[0:n, 0:n].astype(np.float32) + 0.5
    r = np.hypot(xx - n / 2, yy - n / 2) / (n / 2)
    a = 0.85 * np.exp(-(r / 0.5) ** 2) + 0.15 * np.exp(-(r / 0.18) ** 2)
    a *= np.clip((1 - r) / 0.15, 0, 1)
    col = np.array(c['poolcol'], np.float32)
    rgb = np.broadcast_to(col, (n, n, 3)).copy()
    rgb = rgb * (1 - 0.35 * np.exp(-(r / 0.2) ** 2))[..., None] + 0.35 * np.exp(-(r / 0.2) ** 2)[..., None]   # whiter core
    Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], -1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{O}streetlamp-{kind}-pool.png')
print('ok')
