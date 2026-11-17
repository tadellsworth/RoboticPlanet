"""Finishing for the Hollow set (renderer/b/hollow.js, murmur_moles.js c=burrow&s=4) and its 2D light pieces.

  python3 post/hollow_post.py fade <dir> <name> [top0 top1]
      a pillar rises into the roof's dark: fade its sprite to nothing toward the top of the canvas (alpha x
      smoothstep(top0, top1, y), y in 0..1 from the top; default 0.08 .. 0.5)
  python3 post/hollow_post.py breach <outdir>
      the breach shaft, the only daylight in the Hollow (LORE.md: "columns of pale gold"):
        breach-light.png  256 x 256: the lit patch on the floor, a soft, ragged-edged pool (white = full daylight).
                          The game uses it as a mask over 7 x 7 tiles: under it the ground (and the sprites) show as by
                          day, warmed, instead of night-graded; a little gold is added on top.
        breach-beam.png   256 x 512: the column itself, seen from above at the 57° view: it rises from the patch up the
                          screen and fades out toward the roof, streaked with rays and full of dust. Added ('lighter')
                          over everything, 7 tiles wide and 14 tall, its foot centred on the patch.
        breach-motes.png  128 x 128 x 4 frames (512 x 128): dust motes catching the light, to drift up the beam (or the
                          game can draw them as particles and skip this file).
"""
import os
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

GOLD = np.array([1.0, 0.86, 0.58])      # pale gold daylight
PALE = np.array([1.0, 0.95, 0.84])


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def noise(shape, sigma, seed):
    r = np.random.default_rng(seed).normal(size=shape)
    a = ndimage.gaussian_filter(r, sigma, mode='wrap')
    return (a - a.mean()) / (a.std() + 1e-9)


def save(rgb, a, path):
    img = np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], -1)
    Image.fromarray((img * 255 + 0.5).astype(np.uint8), 'RGBA').save(path)


def fade(d, name, t0=0.08, t1=0.5):
    p = f'{d}/{name}.png'
    im = np.asarray(Image.open(p).convert('RGBA')).astype(float) / 255
    y = np.linspace(0, 1, im.shape[0])[:, None]
    im[..., 3] *= sstep(t0, t1, y)
    Image.fromarray((im * 255 + 0.5).astype(np.uint8), 'RGBA').save(p)


def breach(out):
    os.makedirs(out, exist_ok=True)
    # ---- the lit patch: a ragged pool, brightest in the middle, dappled at the rim where the hole's edge (rubble,
    # hanging roots) breaks the light up
    n = 256
    ys, xs = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r, a = np.hypot(xs, ys), np.arctan2(ys, xs)
    rs = np.random.default_rng(7)
    edge = 0.76 + sum(rs.uniform(0.012, 0.04) * np.sin(k * a + rs.uniform(0, 6.3)) for k in (2, 3, 5, 7, 11))   # periodic: no seam
    pool = sstep(edge, edge - 0.36, r)
    dapple = 1 - 0.5 * sstep(0.4, 1.6, noise((n, n), 6, 11)) * sstep(0.3, 0.8, r)
    streaks = 1 - 0.2 * sstep(0.8, 1.8, noise((n, n), 2.5, 12)) * sstep(0.5, 0.85, r)
    light = pool * dapple * streaks
    light = light * (0.82 + 0.18 * sstep(0.7, 0.0, r))
    save(np.ones((n, n, 3)) * PALE, light, f'{out}/breach-light.png')

    # ---- the beam: a vertical column of light seen from above at 57°. Its foot is the patch (an ellipse, as the
    # sprites see the ground); it climbs the screen toward the roof, widening a little, fading as it goes, in rays
    W, H = 256, 512
    ys, xs = np.mgrid[0:H, 0:W].astype(float)
    u = (xs + 0.5) / W * 2 - 1                    # -1..1 across
    v = (ys + 0.5) / H                            # 0 top .. 1 bottom
    foot = 0.86                                   # the patch centre sits at 86% down (the game anchors it there)
    hw = 0.62 + 0.18 * (foot - v)                  # the half-width: the column, widening upward
    body = sstep(hw, hw - 0.35, np.abs(u)) * sstep(foot + 0.1, foot - 0.08, v)
    footE = sstep(1.0, 0.55, np.hypot(u / 0.66, (v - foot) / (0.66 * 0.27)))   # the foot: the pool's ellipse
    rise = sstep(-0.05, 0.75, v)                   # fades out up toward the roof
    col = np.clip(body * rise, 0, 1)
    rays = 0.55 + 0.45 * sstep(-0.6, 1.4, np.interp(u, np.linspace(-1, 1, 64), np.random.default_rng(21).normal(size=64)) * 0.7
                                + 0.5 * np.interp(u * 2.1, np.linspace(-2.1, 2.1, 90), np.random.default_rng(22).normal(size=90)))
    haze = 0.85 + 0.15 * noise((H, W), 9, 23)
    beam = col * rays * haze * 0.5 + footE * 0.22
    # dust in the light: fine motes, a few larger soft ones, all only where the beam is
    rng = np.random.default_rng(31)
    dust = np.zeros((H, W))
    for k in range(260):
        x, y = rng.uniform(0, W), rng.uniform(H * 0.1, H * 0.95)
        if body[int(y), int(x)] * rise[int(y), int(x)] < rng.uniform(0.15, 0.9):
            continue
        s = rng.choice([0.6, 0.8, 1.1, 1.8], p=[0.45, 0.3, 0.17, 0.08])
        dust += rng.uniform(0.35, 1.0) * np.exp(-((xs - x) ** 2 + (ys - y) ** 2) / (2 * s * s))
    beam = beam + np.clip(dust, 0, 1) * 0.75
    rgb = GOLD * (1 - 0.3 * sstep(0.2, 0.9, v))[..., None] + (PALE - GOLD) * np.clip(dust, 0, 1)[..., None]
    save(rgb, np.clip(beam, 0, 1), f'{out}/breach-beam.png')

    # ---- motes: 4 frames of 128 x 128, a few points drifting up and turning in and out of the light
    fr = []
    yy, xx = np.mgrid[0:128, 0:128].astype(float)
    pts = rng.uniform(0, 128, (26, 2)); ph = rng.uniform(0, 2 * np.pi, 26); sz = rng.choice([0.7, 1.0, 1.5], 26, p=[0.5, 0.35, 0.15])
    for f in range(4):
        m = np.zeros((128, 128))
        for (x, y), p, s in zip(pts, ph, sz):
            yf = (y - f * 6) % 128
            m += (0.5 + 0.5 * np.sin(p + f * np.pi / 2)) * np.exp(-((xx - x) ** 2 + (yy - yf) ** 2) / (2 * s * s))
        fr.append(np.clip(m, 0, 1))
    m = np.concatenate(fr, 1)
    save(np.ones(m.shape + (3,)) * PALE, m, f'{out}/breach-motes.png')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'fade':
        d, name = sys.argv[2], sys.argv[3]
        t = [float(x) for x in sys.argv[4:6]] or [0.08, 0.5]
        fade(d, name, *t)
    elif cmd == 'breach':
        breach(sys.argv[2])
    print('ok', cmd)
