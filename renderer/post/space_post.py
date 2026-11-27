"""Finish a space-concept render: bloom the glow pass (as compose_any.py), then paint from the scene's marks the
exhaust plumes (pN_a nozzle, pN_b plume end, pN_r rim), the landing lamps' pools on the deck (lN_a, lN_g; hero views),
and gun fire (mN_a muzzle, mN_b along the barrel): tracers, or a beam with beam=1.
python3 space_post.py <dir> <name> [--night] [--flick k] [--fire tracer|beam|none] [--beamcol #rrggbb] [--pool 0/1] [--glow k]
Writes <dir>/<name>.png at half the render's size."""
import json, sys, argparse
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

ap = argparse.ArgumentParser()
ap.add_argument('dir'); ap.add_argument('name')
ap.add_argument('--night', action='store_true'); ap.add_argument('--flick', type=float, default=1.0)
ap.add_argument('--fire', default='none'); ap.add_argument('--beamcol', default='#ff9a3c'); ap.add_argument('--tracercol', default='#ffd27a')
ap.add_argument('--pool', type=int, default=1); ap.add_argument('--glow', type=float, default=1.0); ap.add_argument('--plume', type=float, default=1.0)
ap.add_argument('--seed', type=int, default=1); ap.add_argument('--out', default=None)
a = ap.parse_args()
D, N = a.dir, a.name
bea = np.asarray(Image.open(f'{D}/{N}.beauty.png').convert('RGBA'), np.float32) / 255
glo = np.asarray(Image.open(f'{D}/{N}.glow.png').convert('RGB'), np.float32) / 255
geo = json.load(open(f'{D}/{N}.geom.json'))
mk = geo['marks']
H, W = bea.shape[:2]
rgb = bea[..., :3] * bea[..., 3:4]; al = bea[..., 3].copy()
s = W / 1024
gk = a.glow * (1.35 if a.night else 1.0)
b1 = gaussian_filter(glo, (5 * s, 5 * s, 0)); b2 = gaussian_filter(glo, (15 * s, 15 * s, 0))
add = (glo * 0.4 + b1 * 1.1 + b2 * 0.8) * gk
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
light = np.zeros((H, W, 3), np.float32)
rng = np.random.default_rng(a.seed)
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
CORE, MID, EDGE = hexc('#fff4e0'), hexc('#ffc47a'), hexc('#ff7a3a')


def P(k): return np.array(mk[k], np.float32) * [W, H]


def seg_field(A, Bp, r0, r1):
    """distance along (t 0..1) and across (normalised by the tapering radius) a segment A->B."""
    d = Bp - A; L2 = float(d @ d) + 1e-6
    t = ((xx - A[0]) * d[0] + (yy - A[1]) * d[1]) / L2
    tc = np.clip(t, 0, 1)
    px, py = A[0] + d[0] * tc, A[1] + d[1] * tc
    r = r0 + (r1 - r0) * tc
    q = np.hypot(xx - px, yy - py) / np.maximum(r, 0.5)
    return t, q


k = 0
while f'p{k}_a' in mk:
    A, Bp, Rr = P(f'p{k}_a'), P(f'p{k}_b'), P(f'p{k}_r')
    r = max(1.5, float(np.hypot(*(Rr - A))))
    fl = a.flick * (0.88 + 0.24 * rng.random()) * a.plume
    Bp = A + (Bp - A) * fl
    L = float(np.hypot(*(Bp - A)))
    if L < r * 1.5:   # seen end-on (straight down): a hot disc and a soft halo
        q = np.hypot(xx - A[0], yy - A[1]) / r
        light += CORE[None, None] * np.exp(-(q / 0.55) ** 2)[..., None] * 1.3 * fl
        light += MID[None, None] * np.exp(-(q / 1.4) ** 2)[..., None] * 0.7 * fl
        light += EDGE[None, None] * np.exp(-(q / 3.2) ** 2)[..., None] * 0.25 * fl
    else:
        t, q = seg_field(A, Bp, r * 0.95, r * 0.35)
        along = np.clip(1 - t, 0, 1) * (t > -0.05)
        core = np.exp(-(q / 0.42) ** 2) * np.clip(1 - t * 1.6, 0, 1) * (t > -0.02)
        mid = np.exp(-(q / 0.85) ** 2) * along ** 1.2
        edge = np.exp(-(q / 1.6) ** 2) * along ** 2
        # shock diamonds: a faint bright ripple along the core
        dia = 1 + 0.35 * np.cos(t * 26) * (t > 0) * (t < 0.6)
        light += CORE[None, None] * (core * 1.6 * dia)[..., None] * fl
        light += MID[None, None] * (mid * 0.9)[..., None] * fl
        light += EDGE[None, None] * (edge * 0.45)[..., None] * fl
        halo = np.exp(-(np.hypot(xx - A[0], yy - A[1]) / (r * 2.2)) ** 2)
        light += MID[None, None] * halo[..., None] * 0.5 * fl
    k += 1

# landing lamps: a cone of light down to the deck and a pool there (hero views)
k = 0
while a.pool and f'l{k}_a' in mk:
    A, Gp = P(f'l{k}_a'), P(f'l{k}_g')
    if np.hypot(*(Gp - A)) > 6:
        pr = 26 * s * (1.6 if a.night else 1)
        q = np.hypot((xx - Gp[0]) / 1.7, yy - Gp[1]) / pr
        light += np.array([1, 0.96, 0.88])[None, None] * np.exp(-q ** 2)[..., None] * (0.55 if a.night else 0.18)
        t, qq = seg_field(A, Gp, 3 * s, pr * 0.9)
        light += np.array([1, 0.97, 0.9])[None, None] * (np.exp(-qq ** 2) * (t > 0) * (t < 1) * (0.16 if a.night else 0.05))[..., None]
    k += 1

# gun fire
k = 0
while a.fire != 'none' and f'm{k}_a' in mk:
    A, Bp = P(f'm{k}_a'), P(f'm{k}_b')
    d = (Bp - A) / (np.hypot(*(Bp - A)) + 1e-6)
    if a.fire == 'beam':
        col = hexc(a.beamcol); E = A + d * 2.2 * W
        t, q = seg_field(A, E, 2.2 * s, 2.2 * s)
        on = (t > 0) & (t < 1)
        light += np.ones(3)[None, None] * (np.exp(-(q / 0.6) ** 2) * on)[..., None] * 1.6
        light += col[None, None] * (np.exp(-(q / 2.2) ** 2) * on)[..., None] * 1.1
        light += col[None, None] * (np.exp(-(q / 6.0) ** 2) * on)[..., None] * 0.35
        qq = np.hypot(xx - A[0], yy - A[1]) / (9 * s)
        light += col[None, None] * np.exp(-qq ** 2)[..., None] * 1.4 + np.exp(-(qq / 0.4) ** 2)[..., None] * 1.2
    else:
        col = hexc(a.tracercol)
        qq = np.hypot(xx - A[0], yy - A[1]) / (10 * s)
        light += hexc('#fff1c2')[None, None] * np.exp(-qq ** 2)[..., None] * 1.6
        for j in range(3):  # three tracers in flight, dashes along the line of fire
            o0 = (0.18 + 0.32 * j + 0.08 * rng.random()) * W * 0.5
            t, q = seg_field(A + d * o0, A + d * (o0 + 34 * s), 1.3 * s, 1.3 * s)
            on = (t > 0) & (t < 1)
            light += col[None, None] * (np.exp(-(q / 0.8) ** 2) * on * (0.3 + 0.7 * t))[..., None] * 1.8
            light += col[None, None] * (np.exp(-(q / 3) ** 2) * on)[..., None] * 0.35
    k += 1

solid = np.clip((al - 0.9) * 10, 0, 1)[..., None]   # the model itself (the shadow catcher's shade is fainter)
light = light * (1 - solid * 0.85)                    # plumes and pools pass behind the hull
lum = np.clip((add + light).max(axis=2), 0, 1)
out = rgb + add + light
al = np.clip(np.maximum(al, lum), 0, 1)
out = np.clip(out, 0, 1)
# downsample 2x (premultiplied), un-premultiply
o4 = np.concatenate([out, al[..., None]], 2)
o4 = o4[:H // 2 * 2, :W // 2 * 2].reshape(H // 2, 2, W // 2, 2, 4).mean((1, 3))
c = o4[..., :3] / np.maximum(o4[..., 3:4], 1e-4)
res = np.concatenate([np.clip(c, 0, 1), o4[..., 3:4]], 2)
Image.fromarray((res * 255 + 0.5).astype(np.uint8), 'RGBA').save(a.out or f'{D}/{N}.png')
