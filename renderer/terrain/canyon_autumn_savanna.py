"""Chasm (sky-islands canyon) tiles for the Autumn Forest and Savanna biomes, built with canyon.py.

Writes 128x128 tiles (rendered at 512 and downsampled) into out/art/biomes/<key>/:
  chasm-<key>, chasm-wall-<key>, chasm-wall-2-<key> (opaque), chasm-lip-n/w/e-<key> (transparent overlays).
Autumn: grey granite strata, the rim carpeted in moss and fallen leaves, red creeper hanging down.
Savanna: red-brown strata, golden dry grass along the rim and ledges with a few blades hanging over.

Usage (from renderer/): PYTHONPATH=terrain python3 terrain/canyon_autumn_savanna.py [autumn] [savanna]
"""
import os
import sys
import numpy as np
from scipy import ndimage

_argv = sys.argv
sys.argv = [_argv[0], 'out/art/biomes']        # canyon.py reads its output folder from argv at import
import canyon as C                             # noqa: E402
sys.argv = _argv
from tex import fbm, smoothstep                # noqa: E402

PAL = {
    'autumn': dict(
        void='#070605', haze='#1e1912', mote='#f2c070',
        rim='#64645e', rimhi='#8a8a80', crack='#121212', dust='#8a6a3c',
        bands=['#5e6064', '#74767a', '#4c4e52', '#808286', '#585a5e', '#6a6c70', '#505256', '#7a7c80'],
        face=0.80, moss='#6a6a2c', moss2='#b8682a', vine='#5a2a1a', leaf='#c0381e'),
    'savanna': dict(
        void='#0b0705', haze='#2a1a10', mote='#f4cc8c',
        rim='#9a6a4a', rimhi='#c09468', crack='#1e100a', dust='#c8a464',
        bands=['#8a4e36', '#a8684a', '#5a3426', '#7c4430', '#b47a58', '#4a2c20', '#94583e', '#a06446'],
        face=0.82, moss='#a8844a', moss2='#d8bc78', vine='#a8844a', leaf='#d0b068'),
}
SEED = {'autumn': 53, 'savanna': 67}


def savanna_dress(p, col, v, E, w, edges, ledge_on, lmask_t, xs, ys, seed):
    """Golden dry grass on the rim top and ledges, dusty red streaks down the face, and short blades of
    grass hanging over the lip (in place of the jungle's vines)."""
    rng = np.random.default_rng(seed + 90)
    N = C.N
    H2 = col.shape[0]
    gn = fbm(N, seed + 91, 6, 80, 1.0, ny=H2)
    rim_g = (v < E + 0.010) * smoothstep(-0.9, 0.0, gn)
    led_g = lmask_t * smoothstep(-0.9, -0.1, gn)
    m = np.maximum(rim_g, led_g)
    streaks = fbm(N, seed + 95, 60, 256, 0.5, aniso=(1.0, 5.0), ny=H2)
    gc = C.L(p['moss']) + (C.L(p['moss2']) - C.L(p['moss'])) * smoothstep(-1.2, 1.6, streaks + 0.5 * gn)[..., None]
    col = col * (1 - m)[..., None] + gc * m[..., None]
    dust = smoothstep(1.0, 2.0, fbm(N, seed + 93, 3, 60, 1.0, aniso=(1, 0.15), ny=H2)) * (v > E) * 0.3
    col = col * (1 - dust)[..., None] + C.L('#c08a5a') * 0.5 * dust[..., None]
    blades = np.zeros(col.shape[:2])
    for _ in range(70):
        x0 = rng.uniform(0, N)
        e0 = E[0, int(x0) % N]
        L = rng.uniform(0.02, 0.06) * N
        lean = rng.uniform(-0.5, 0.5)
        for k in range(int(L)):
            y = int(e0 * N) - 3 + k
            x = int(round(x0 + lean * k)) % N
            if 0 <= y < H2:
                blades[y, x] = max(blades[y, x], 1 - k / L * 0.6)
    blades = ndimage.gaussian_filter(blades, 0.6)
    sh = ndimage.shift(blades, (3, 4), order=1, mode='wrap')
    col = col * (1 - 0.35 * np.clip(sh, 0, 1))[..., None]
    bc = C.L(p['leaf']) * 0.8
    col = col * (1 - np.clip(blades, 0, 1))[..., None] + bc * np.clip(blades, 0, 1)[..., None]
    return col


def down4(img):
    return C.down(C.down(img))


def build(biome):
    p = PAL[biome]
    seed = SEED[biome]
    out = f'out/art/biomes/{biome}'
    os.makedirs(out, exist_ok=True)
    jd = C.jungle_dress
    if biome == 'savanna':
        C.jungle_dress = savanna_dress
    try:
        bg = C.chasm(p, seed)
        C.save(down4(bg), f'{out}/chasm-{biome}.png')
        wl = C.wall(p, seed + 100, 'jungle', bg)
        d = down4(wl)
        C.save(d[:128], f'{out}/chasm-wall-{biome}.png')
        C.save(d[128:], f'{out}/chasm-wall-2-{biome}.png')
        for k, side in enumerate('wen'):
            c, a = C.lip(p, seed + 300 + 17 * k, side, 'jungle')
            pm = down4(c * a[..., None])
            ad = down4(a)
            c2 = np.where(ad[..., None] > 1e-4, pm / np.maximum(ad, 1e-4)[..., None], 0)
            C.save(c2, f'{out}/chasm-lip-{side}-{biome}.png', ad)
    finally:
        C.jungle_dress = jd
    print('done', biome)


if __name__ == '__main__':
    for b in (sys.argv[1:] or ('autumn', 'savanna')):
        build(b)
