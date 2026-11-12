"""Forest ground and lake water (512 seamless) for the 'jungle' biome slot, shown in the game as Forest.

Ground: a grassy, mossy forest floor in fresh greens, with drifts of brown needle litter, a few
fallen leaves and twigs and the odd wildflower. Water: a clear, deep blue-green forest lake with a
few lily pads. Rock and cliffs keep the mossy grey stone of terrain_biomes.
"""
import os
import sys
import numpy as np
from tex import *
from terrain_biomes import N, over, leaf_patch

OUT = 'out/art/biomes/forest'


def forest_ground():
    rng = np.random.default_rng(171)
    # broad light and shade: sunny glades and damp hollows
    z1 = fbm(N, 1701, 3, 48, beta=2.0)
    col = mix(hexrgb('#4a6a2c'), hexrgb('#6a8f3c'), smoothstep(-1.3, 1.3, z1))
    damp = smoothstep(0.4, 1.4, fbm(N, 1702, 4, 32, beta=2.0))
    col = over(col, hexrgb('#3e5e2a'), damp * 0.4)
    # short grass: fine streaks at a few angles, light tips and dark roots
    g = 0.5 * fbm(N, 1703, 60, 256, beta=0.6, aniso=(1.0, 5.0), angle=0.35) + \
        0.5 * fbm(N, 1704, 60, 256, beta=0.6, aniso=(1.0, 5.0), angle=-0.5)
    col = col * (1 + 0.16 * zscore(g))[..., None]
    col = over(col, hexrgb('#8eae52'), smoothstep(1.3, 2.4, zscore(g)) * 0.55)
    hs = fbm(N, 1705, 8, 160, beta=1.7)
    col = col * (0.8 + 0.22 * relief(normals_from_height(hs * 5), 225, 50))[..., None]
    # moss cushions: darker, velvety green
    mm = fbm(N, 1706, 4, 30, beta=2.0)
    M = smoothstep(0.55, 1.2, mm)
    mh = fbm(N, 1707, 50, 256, beta=0.8)
    mcol = mix(hexrgb('#3d6028'), hexrgb('#557c32'), smoothstep(-1.0, 1.4, mh))
    mcol = mcol * (0.7 + 0.35 * relief(normals_from_height((M * 3 + M * mh) * 1.6), 225, 50))[..., None]
    col = over(col, mcol, M * 0.75)
    # needle litter: rusty-brown drifts where the conifers drop them
    nl = fbm(N, 1708, 3, 24, beta=2.0) + 0.3 * fbm(N, 1709, 16, 80, beta=1.5)
    NL = smoothstep(0.85, 1.5, nl) * (1 - M)
    ncol = mix(hexrgb('#6a5030'), hexrgb('#8a6a3c'), smoothstep(-1, 1.4, fbm(N, 1710, 40, 256, beta=0.8)))
    col = over(col, ncol, NL * 0.6)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    # pine needles: thin strokes, thickest on the litter drifts
    placed = 0
    while placed < 700:
        x, y = rng.uniform(0, N, 2)
        if rng.uniform() > 0.12 + 0.88 * NL[int(y) % N, int(x) % N]:
            continue
        c = hexrgb(['#6e4c2a', '#8a6236', '#5c3e22', '#9a7040'][rng.integers(4)]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(rng.uniform(5, 9), 0.9, rng.uniform(0, np.pi), c, c * 0.7, ss=4, shadow=(0.6, 0.7), sh_op=0.25)
        stamp(img, p, x, y)
        placed += 1
    # twigs
    for i in range(10):
        x, y = rng.uniform(0, N, 2)
        p = leaf_patch(rng.uniform(12, 24), 1.5, rng.uniform(0, np.pi), hexrgb(['#4a3622', '#5a4028', '#3e2c1c'][i % 3]),
                       hexrgb('#2a1c12'), sh_op=0.35)
        stamp(img, p, x, y)
    # a few fallen leaves (oak brown, birch yellow), not on moss
    cols = ['#7a5a30', '#8a6a34', '#a08038', '#6a4a2a', '#b09040', '#8c7030']
    placed = 0
    while placed < 70:
        x, y = rng.uniform(0, N, 2)
        if rng.uniform() < 0.8 * M[int(y) % N, int(x) % N]:
            continue
        L = rng.uniform(7, 13)
        cc = hexrgb(cols[rng.integers(len(cols))]) * rng.uniform(0.9, 1.1)
        p = leaf_patch(L, L * rng.uniform(0.4, 0.6), rng.uniform(0, np.pi * 2), cc, cc * 0.65, curl=rng.uniform(-0.2, 0.2))
        stamp(img, p, x, y)
        placed += 1
    # clover and wood-sorrel: little clusters of round leaflets on the grass
    for k in range(26):
        cx, cy = rng.uniform(0, N, 2)
        if NL[int(cy) % N, int(cx) % N] > 0.4:
            continue
        for q in range(rng.integers(4, 9)):
            x, y = cx + rng.normal() * 5, cy + rng.normal() * 5
            c = hexrgb(['#5c8a34', '#6a9a3c', '#4e7a2e'][q % 3])
            for a in (0, 2.1, 4.2):
                p = leaf_patch(3.4, 3.0, a + q, c, c * 0.75, ss=4, shadow=(0.5, 0.6), sh_op=0.25)
                stamp(img, p, x + 1.6 * np.cos(a + q), y + 1.6 * np.sin(a + q))
    # the odd wildflower
    for k in range(18):
        x, y = rng.uniform(0, N, 2)
        c = hexrgb(['#e8e4d0', '#e8d060', '#c8b0e0', '#f0f0f0'][k % 4])
        for a in np.linspace(0, 2 * np.pi, 5, endpoint=False):
            p = leaf_patch(2.6, 1.9, a, c, c * 0.85, ss=4, shadow=(0.4, 0.5), sh_op=0.2)
            stamp(img, p, x + 1.3 * np.cos(a), y + 1.3 * np.sin(a))
    return img[..., :3]


def forest_water():
    """A clear forest lake: deep blue-green, gently rippled, with a few lily pads."""
    z1 = fbm(N, 1721, 4, 64, beta=2.0)
    z2 = fbm(N, 1722, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#1f4650')
    col = over(col, hexrgb('#163640'), 0.1 + 0.2 * z1)
    col = over(col, hexrgb('#2c5e64'), -0.1 - 0.2 * z2)
    h = fbm(N, 1723, 3, 48, beta=2.0, aniso=(1.0, 3.0), angle=0.1) + 0.035 * fbm(N, 1724, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    col = col * (0.68 + 0.34 * 1.2 * lambert(normals_from_height(H * 13.0), 225, 55))[..., None]
    sheen_n = fbm(N, 1726, 5, 40, beta=2.2, aniso=(1.0, 2.2), angle=0.1)
    sheen_a = blur_wrap(np.clip((sheen_n - 0.5) * 0.7, 0, 1), 2.0) * 0.4
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, hexrgb('#6a9ea4'), sheen_a)
    col = over(col, hexrgb('#e4f0f0'), 0.9 * spec(normals_from_height(H * 10.4), 26, 225, 38) * 0.45)
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    rng = np.random.default_rng(172)
    for cl in range(5):
        cx, cy = rng.uniform(0, N, 2)
        for k in range(rng.integers(3, 7)):
            x, y = cx + rng.normal() * 9, cy + rng.normal() * 6
            r = rng.uniform(2.6, 4.4)
            c = hexrgb('#4f7a32') * rng.uniform(0.9, 1.15)
            p = leaf_patch(r * 2.0, r * 1.9, rng.uniform(0, 3), c, hexrgb('#3a6026'), shadow=(0.7, 0.8), sh_op=0.3)
            stamp(img, p, x, y)
            if rng.uniform() < 0.25:  # a white water-lily
                for a in np.linspace(0, 2 * np.pi, 6, endpoint=False):
                    q = leaf_patch(2.2, 1.4, a, hexrgb('#f2f0e8'), hexrgb('#e0d8c0'), ss=4, shadow=(0.3, 0.3), sh_op=0.15)
                    stamp(img, q, x + 1.0 * np.cos(a), y + 1.0 * np.sin(a))
    return img[..., :3]


JOBS = {'ground': forest_ground, 'water': forest_water}

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for k in (sys.argv[1:] or JOBS):
        img = JOBS[k]()
        save_rgb(img, f'{OUT}/{k}.png')
        print(k, img.shape, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))
