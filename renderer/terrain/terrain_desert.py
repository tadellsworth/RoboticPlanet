"""Red desert ground / water / rock re-made at 512 (same look as today's 128 tiles, more detail)."""
import sys
import numpy as np
from tex import *

N = 512


def over(col, layer_rgb, a):
    a = np.clip(a, 0, 1)[..., None]
    return col * (1 - a) + layer_rgb * a


def pebble_patch(rx, ry, body, hi, ss=4, shadow=(6, 6), sh_op=0.35, rng=None):
    """Small shaded pebble with its soft shadow, returned as RGBA float patch (srgb)."""
    pad = int(max(rx, ry) + max(shadow) + 6)
    S = 2 * pad * ss
    ys, xs = (np.mgrid[0:S, 0:S] + 0.5) / ss - pad
    out = np.zeros((S, S, 4))
    # shadow
    d = ((xs - shadow[0]) / (rx * 1.05)) ** 2 + ((ys - shadow[1]) / (ry * 1.05)) ** 2
    sa = np.clip(1.15 - d, 0, 1) ** 0.7 * sh_op
    out[..., :3] = hexrgb('#3b2a1c')
    out[..., 3] = sa
    # body as an ellipsoid
    jit = 1 + 0.08 * np.sin(np.arctan2(ys, xs) * 3 + rng.uniform(0, 6)) if rng is not None else 1
    d = (xs / rx) ** 2 + (ys / ry) ** 2
    inside = d < jit
    z = np.sqrt(np.clip(1 - d / jit, 0, 1))
    nx, ny = xs / rx * 0.9, ys / ry * 0.9
    Nn = np.stack([nx, ny, z * 1.4], -1)
    Nn /= np.linalg.norm(Nn, axis=-1, keepdims=True)
    lit = 0.45 + 0.75 * np.clip((Nn * light_dir(225, 50)).sum(-1), 0, 1)
    col = hexrgb(body)[None, None] * lit[..., None]
    col = mix(col, hexrgb(hi)[None, None], np.clip((Nn * light_dir(225, 50)).sum(-1) - 0.75, 0, 1) * 1.6)
    a = np.clip((jit - d) * max(rx, ry) * 1.2, 0, 1)
    out[..., :3] = out[..., :3] * (1 - a[..., None]) + col * a[..., None]
    out[..., 3] = out[..., 3] * (1 - a) + a
    # downsample
    return downsample(out * np.concatenate([np.ones(3), [1]]), ss) if False else _ds_rgba(out, ss)


def _ds_rgba(p, ss):
    a = p[..., 3:4]
    pm = np.concatenate([p[..., :3] * a, a], -1)
    pm = downsample(pm, ss)
    a = pm[..., 3:4]
    rgb = np.where(a > 1e-6, pm[..., :3] / np.maximum(a, 1e-6), 0)
    return np.concatenate([rgb, a], -1)


def ground():
    z1 = fbm(N, 401, 4, 160, beta=2.0)
    z2 = fbm(N, 402, 4, 160, beta=2.0)
    z3 = fbm(N, 403, 56, 256, beta=1.2)
    z4 = fbm(N, 404, 56, 256, beta=1.2)
    col = np.ones((N, N, 3)) * hexrgb('#a6754a')
    col = over(col, hexrgb('#784a2b'), 0.01 + 0.17 * z1)
    col = over(col, hexrgb('#c79968'), -0.1 - 0.22 * z2)
    col = over(col, hexrgb('#4d2e1a'), -0.03 + 0.2 * z3)
    col = over(col, hexrgb('#dbb380'), -0.05 + 0.2 * z4)
    # wind ripples: anisotropic (wide in x), plus fine ripple detail
    h = fbm(N, 409, 2, 60, beta=2.0, aniso=(1.0, 5.0)) + 0.12 * fbm(N, 410, 24, 160, beta=1.5, aniso=(1, 4))
    H = 0.5 + 0.12 * h
    Nn = normals_from_height(H * 8.8)
    lit = 1.3 * lambert(Nn, 225, 55)
    col = col * (0.7 + 0.3 * lit)[..., None]
    img = np.concatenate([col, np.ones((N, N, 1))], -1)
    rng = np.random.default_rng(41)
    peb = [((30.5, 22.5), 2.6, 1.9, '#8a7462', '#c9b49c'), ((91, 37), 2.0, 1.5, '#7a6553', '#bfa78d'),
           ((61, 87), 3.0, 2.1, '#8d7b6b', '#cbb8a3'), ((20.5, 100.5), 1.6, 1.2, '#6f5a48', '#a89078'),
           ((104.5, 104.5), 1.8, 1.3, '#86705d', '#b9a088'), ((74, 56), 1.2, 0.9, '#7d6856', '#a8927c'),
           ((44, 62), 1.1, 0.8, '#6c5644', '#988068')]
    for (x, y), rx, ry, b, hi in peb:
        p = pebble_patch(rx * 4, ry * 4, b, hi, rng=rng)
        stamp(img, p, x * 4, y * 4)
    # extra detail: a sprinkle of tiny grit pebbles (2-4 px) that do not show a pattern
    for i in range(46):
        x, y = rng.uniform(0, N, 2)
        r = rng.uniform(1.2, 2.6)
        b = ['#7b6552', '#8c7764', '#6a5443', '#957f6a'][i % 4]
        p = pebble_patch(r * 1.25, r, b, '#c4ae96', shadow=(1.6, 1.6), sh_op=0.3, rng=rng)
        stamp(img, p, x, y)
    return img[..., :3]


def water():
    z1 = fbm(N, 501, 4, 64, beta=2.0)
    z2 = fbm(N, 502, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#124b5c')
    col = over(col, np.array([0.04, 0.18, 0.24]), 0.05 + 0.15 * z1)
    col = over(col, np.array([0.16, 0.5, 0.52]), -0.1 - 0.15 * z2)
    h = fbm(N, 513, 3, 48, beta=2.0, aniso=(1.0, 3.0)) + 0.035 * fbm(N, 514, 30, 160, beta=1.5, aniso=(1.0, 3.0))
    H = 0.5 + 0.12 * zscore(h)
    Nn = normals_from_height(H * 13.0)
    lit = 1.2 * lambert(Nn, 225, 55)
    col = col * (0.65 + 0.35 * lit)[..., None]
    Ns = normals_from_height(H * 10.4)
    sp = 0.9 * spec(Ns, 26, 225, 38)
    sheen_n = fbm(N, 521, 5, 40, beta=2.2, aniso=(1.0, 2.2))
    sheen_a = blur_wrap(np.clip((sheen_n - 0.5) * 0.7, 0, 1), 2.0) * 0.4
    # break the sheen up along the ripple crests so it reads as light on water, not blobs
    sheen_a *= np.clip(0.55 + 0.35 * zscore(H), 0, 1.2)
    col = over(col, np.array([0.72, 0.9, 0.84]), sheen_a)
    col = over(col, hexrgb('#d8fff4'), sp * 0.5)
    return col


def rock():
    z1 = fbm(N, 601, 4, 64, beta=2.0)
    z2 = fbm(N, 602, 4, 64, beta=2.0)
    col = np.ones((N, N, 3)) * hexrgb('#4d3828')
    col = over(col, np.array([0.18, 0.12, 0.08]), 0.1 + 0.24 * z1)
    col = over(col, np.array([0.45, 0.34, 0.24]), -0.15 - 0.24 * z2)
    h = fbm(N, 605, 4, 48, beta=2.2) + 0.02 * fbm(N, 606, 60, 256, beta=1.2)
    H = 0.5 + 0.13 * h
    Nn = normals_from_height(H * 34)
    lit = 1.25 * lambert(Nn, 225, 45)
    col = col * (0.25 + 0.75 * lit)[..., None]
    # fine grain for more detail at zoom
    g = fbm(N, 607, 80, 256, beta=0.3)
    col = col * (1 + 0.06 * g)[..., None]
    # cracks: where a turbulence field is near zero
    w = 0.06 * fbm(N, 613, 16, 60, beta=1.5)
    z1 = fbm(N, 611, 3, 12, beta=2.0) + w
    z2 = fbm(N, 612, 6, 24, beta=2.0) + w
    gate = smoothstep(0.2, 1.1, fbm(N, 614, 3, 8, beta=2.0))
    core = np.maximum(np.clip(1 - np.abs(z1) / 0.26, 0, 1) ** 1.6, np.clip(1 - np.abs(z2) / 0.2, 0, 1) ** 1.6 * gate)
    halo = np.maximum(np.clip(1 - np.abs(z1) / 0.6, 0, 1) ** 2, np.clip(1 - np.abs(z2) / 0.45, 0, 1) ** 2 * gate)
    crack = np.clip(np.maximum(core * 1.1, halo * 0.4), 0, 1)
    col = over(col, np.array([0.06, 0.038, 0.025]), crack)
    # light lip along the upper-left side of each crack (sun catching the edge)
    lip = np.clip(np.roll(np.roll(crack, 2, 0), 2, 1) - crack, 0, 1) * 0.25
    col = over(col, hexrgb('#8a6c50'), lip)
    return col


if __name__ == '__main__':
    out = {'ground': ground, 'water': water, 'rock': rock}
    for k in (sys.argv[1:] or out):
        img = out[k]()
        save_rgb(img, f'out/art/tiles/{k}.png')
        print(k, (np.clip(img, 0, 1).reshape(-1, 3).mean(0) * 255).round(1))
