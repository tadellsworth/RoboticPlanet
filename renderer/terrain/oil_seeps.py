"""Proposed oil seep textures (IDEAS.md: "Redesign the Fiber and Oil resources"): the ground of the seep itself, which
the game would draw across all of a seep's tiles as one shape (the union of a disc on each oil tile, bridged to its oil
neighbours), with the pump-spot sprite (b/resources.js c=vent) on each tile. 256 px, seamless, one image per 2 x 2 tiles.

  seep-1  tar:    black tar with a wrinkled skin, warm brown where it is thin, small bubbles, glossy
  seep-2  pitch:  a crust of dried pitch broken into plates, glossy black oil in the cracks
  seep-3  soaked: the ground itself soaked dark (semi-transparent, so each biome's ground shows through), glossy puddles
Each has a -glow: its wet highlights, a faint cool sheen added at night so a seep still reads as wet in the dark.

usage: python3 terrain/oil_seeps.py   (run from renderer/; writes out/res/seep-*.png)
"""
import os
import numpy as np
from PIL import Image
from tex import fbm, hexrgb, smoothstep, normals_from_height, relief, spec, blur_wrap, zscore
from terrain_alien import jworley

N = 256
OUT = 'out/res'


def save(rgb, a, name):
    os.makedirs(OUT, exist_ok=True)
    img = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], -1)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/{name}.png')


def sheen_glow(H, k, name, mask=None):
    s = spec(normals_from_height(H), 40, 225, 42)
    if mask is not None:
        s = s * mask
    g = blur_wrap(s, 0.8)
    save(np.ones((N, N, 3)) * hexrgb('#b8c8ff'), g * k, name)


def tar():
    flow = fbm(N, 501, 2, 12, beta=2.2, aniso=(1, 3), angle=0.5)
    wr = np.sin(zscore(flow) * 9 + 2 * fbm(N, 502, 4, 30, beta=1.6))          # the wrinkles of a skin on cooling tar
    H = 0.5 * flow + 0.08 * wr + 0.05 * fbm(N, 503, 30, 120, beta=1.2)
    col = np.ones((N, N, 3)) * hexrgb('#0a0806')
    thin = smoothstep(0.6, 1.8, fbm(N, 504, 3, 20, beta=2.0))
    col = col + (hexrgb('#3a1e0c') - col) * (thin * 0.6)[..., None]
    col = col * (0.75 + 0.35 * relief(normals_from_height(H * 6), 225, 50))[..., None]
    hl = spec(normals_from_height(H * 5), 60, 225, 40)
    col = col + (hexrgb('#d8d0c4') - col) * (hl * 0.55)[..., None]
    F1, F2, _ = jworley(N, 22, 505)
    bub = (1 - smoothstep(0.08, 0.16, F1)) * (np.random.default_rng(506).uniform(0, 1, 22 * 22)[_] < 0.12)
    col = col * (1 - 0.6 * bub)[..., None]
    col = col + (np.array([0.8, 0.78, 0.74]) - col) * ((1 - smoothstep(0.02, 0.06, np.abs(F1 - 0.1))) * (bub > 0) * 0.5)[..., None]
    save(col, np.ones((N, N)), 'seep-1')
    sheen_glow(H * 5, 0.35, 'seep-1-glow')


def pitch():
    F1, F2, ID = jworley(N, 7, 511, jit=0.8, warp=(6 * fbm(N, 512, 2, 12, beta=1.6), 6 * fbm(N, 513, 2, 12, beta=1.6)))
    crack = 1 - smoothstep(0.03, 0.09, F2 - F1)
    tone = np.random.default_rng(514).uniform(-1, 1, 49)[ID]
    plate = np.ones((N, N, 3)) * hexrgb('#2c2622')
    plate = plate * (1 + 0.12 * tone)[..., None] * (1 + 0.1 * fbm(N, 515, 20, 120, beta=1.0))[..., None]
    Hp = 1.0 * smoothstep(0.0, 0.25, F2 - F1) + 0.15 * fbm(N, 516, 10, 80, beta=1.4) + 0.3 * F1
    plate = plate * (0.7 + 0.4 * relief(normals_from_height(Hp * 8), 225, 50))[..., None]
    fine = 1 - smoothstep(0.0, 0.035, np.abs(fbm(N, 517, 6, 40, beta=1.5)))         # hairline cracks in the plates
    plate = plate * (1 - 0.35 * fine * (1 - crack))[..., None]
    oil = np.ones((N, N, 3)) * hexrgb('#060504')
    Ho = -crack * 0.5
    hl = spec(normals_from_height(fbm(N, 518, 6, 40, beta=1.6) * 3), 50, 225, 40) * crack
    oil = oil + (hexrgb('#c8c0b8') - oil) * (hl * 0.6)[..., None]
    col = plate * (1 - crack[..., None]) + oil * crack[..., None]
    save(col, np.ones((N, N)), 'seep-2')
    sheen_glow(fbm(N, 518, 6, 40, beta=1.6) * 3, 0.4, 'seep-2-glow', crack)


def soaked():
    blot = fbm(N, 521, 2, 16, beta=2.0)
    dark = 0.55 + 0.35 * smoothstep(-1.2, 1.2, blot)                               # how soaked: 0.55 .. 0.9
    pud = smoothstep(0.7, 1.1, fbm(N, 522, 3, 18, beta=2.2))                        # glossy puddles of crude
    H = fbm(N, 523, 3, 24, beta=2.0) + 0.04 * fbm(N, 524, 30, 120, beta=1.2)
    col = np.ones((N, N, 3)) * hexrgb('#0a0807')
    col = col + (hexrgb('#2a1a10') - col) * (smoothstep(0.0, 1.0, -blot) * 0.4)[..., None]
    hl = spec(normals_from_height(H * 7), 55, 225, 40) * pud
    col = col + (hexrgb('#d8d0c8') - col) * (hl * 0.6)[..., None]
    a = np.maximum(dark, pud)
    save(col, a, 'seep-3')
    sheen_glow(H * 7, 0.35, 'seep-3-glow', pud)


if __name__ == '__main__':
    tar(); pitch(); soaked()
    print('seeps ok')
