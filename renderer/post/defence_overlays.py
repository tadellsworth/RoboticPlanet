"""2D overlays registered to the 3D defence renders via the marks the scenes report.
  python3 overlays.py fire  <geom.json> <out.png>                  bunker muzzle flashes
  python3 overlays.py pulse <raw beauty.png> <geom.json> <out.png> disruptor pulse glow + arcs
"""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, json, math
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, _os.path.join(_ROOT, 'fx'))
from fxlib import Canvas

def rot(d, a):
    c, s = math.cos(a), math.sin(a); return (d[0] * c - d[1] * s, d[0] * s + d[1] * c)

def muzzle_flash(cv, ox, oy, d, Lf, rng, k=1.0):
    """yellow-white flash bursting from (ox,oy) along unit screen direction d, Lf px long"""
    P = lambda t, dd=d: (ox + dd[0] * t, oy + dd[1] * t)
    # soft warm bloom behind everything
    cv.blob(*P(0.3 * Lf), 0.9 * Lf, (1.0, 0.62, 0.22), alpha=0.4 * k, glowk=0.6, power=2.0)
    # side petals (star-shaped muzzle-brake flash)
    for a, l, w in [(1.45, 0.5, 0.16), (-1.45, 0.5, 0.16), (0.7, 0.72, 0.2), (-0.7, 0.72, 0.2), (0.3, 0.85, 0.16), (-0.3, 0.85, 0.16)]:
        dd = rot(d, a + rng.uniform(-0.1, 0.1)); tip = (ox + dd[0] * l * Lf, oy + dd[1] * l * Lf)
        cv.streak(tip[0], tip[1], ox, oy, w * Lf, (1.0, 0.72, 0.3), alpha=0.95 * k, glowk=0.9)
    # main forward tongue, then a hotter inner core
    tip = P(Lf); cv.streak(tip[0], tip[1], *P(0.05 * Lf), 0.36 * Lf, (1.0, 0.86, 0.5), alpha=k, glowk=1.0)
    tip = P(0.6 * Lf); cv.streak(tip[0], tip[1], ox, oy, 0.22 * Lf, (1.0, 0.98, 0.88), alpha=k, glowk=1.3)
    cv.blob(*P(0.15 * Lf), 0.34 * Lf, (1.0, 1.0, 0.95), alpha=k, glowk=1.6, power=1.1)
    # a few orange sparks
    for i in range(10):
        dd = rot(d, rng.uniform(-1.3, 1.3)); r0 = rng.uniform(0.35, 0.95) * Lf; l = rng.uniform(0.12, 0.32) * Lf
        a0 = (ox + dd[0] * r0, oy + dd[1] * r0); a1 = (a0[0] + dd[0] * l, a0[1] + dd[1] * l)
        cv.streak(a1[0], a1[1], a0[0], a0[1], rng.uniform(0.7, 1.1), (1.0, 0.62, 0.2), alpha=0.95 * k, glowk=0.9)

def fire(geom, out):
    g = json.load(open(geom)); m = g['marks']; S = 512
    cv = Canvas(S, S, 2); rng = np.random.default_rng(7)
    for k in (0, 1):
        o = np.array(m[f'gun{k}']) * S; f = np.array(m[f'gun{k}f']) * S
        d = f - o; unit = np.linalg.norm(d); d = d / unit
        muzzle_flash(cv, o[0], o[1], (d[0], d[1]), 1.9 * unit, rng)
    Image.fromarray(cv.finish(bloom=(3, 9), bloomk=(0.6, 0.4)), 'RGBA').save(out)

def jagged(a, b, rng, rough=0.16, depth=5):
    pts = [np.array(a, float), np.array(b, float)]
    for lv in range(depth):
        new = [pts[0]]
        for p, q in zip(pts[:-1], pts[1:]):
            d = q - p; n = np.array([-d[1], d[0]]); L = np.linalg.norm(d) + 1e-6
            mid = (p + q) / 2 + n / L * rng.normal(0, rough * L)
            new += [mid, q]
        pts = new
    return pts

def arc(cv, a, b, rng, w=1.0, rough=0.16, branches=2, k=1.0):
    ICE = (0.56, 0.85, 1.0)
    pts = jagged(a, b, rng, rough)
    for p, q in zip(pts[:-1], pts[1:]):
        cv.streak(p[0], p[1], q[0], q[1], 2.6 * w, ICE, alpha=0.45 * k, glowk=0.8, taper=False)
    for p, q in zip(pts[:-1], pts[1:]):
        cv.streak(p[0], p[1], q[0], q[1], 0.9 * w, (0.92, 0.98, 1.0), alpha=k, glowk=0.6, taper=False)
    for _ in range(branches):
        i = rng.integers(len(pts) // 5, 4 * len(pts) // 5); p = pts[i]
        d = (np.array(b) - np.array(a)); L = np.linalg.norm(d)
        t = p + rot(d / L, rng.uniform(-1.1, 1.1)) * np.array([1, 1]) * L * rng.uniform(0.2, 0.4)
        sub = jagged(p, t, rng, rough * 1.2, 3)
        for p2, q2 in zip(sub[:-1], sub[1:]):
            cv.streak(p2[0], p2[1], q2[0], q2[1], 1.4 * w, ICE, alpha=0.6 * k, glowk=0.5, taper=False)
            cv.streak(p2[0], p2[1], q2[0], q2[1], 0.55 * w, (0.92, 0.98, 1.0), alpha=0.9 * k, glowk=0.3, taper=False)

def pulse(raw, geom, out):
    g = json.load(open(geom)); m = g['marks']; S = 512
    im = np.asarray(Image.open(raw).convert('RGBA')).astype(np.float32) / 255     # 1024 px raw emissive render
    a = im[..., 3]
    # brightness ramp: ice blue at the edges of each lit part, white toward its middle
    inside = ndimage.distance_transform_edt(a > 0.5)
    t = np.clip(inside / 7.0, 0, 1)
    ICE = np.array([0.56, 0.85, 1.0], np.float32)
    col = ICE[None, None] * (1 - t[..., None]) + np.array([0.97, 0.995, 1.0], np.float32)[None, None] * t[..., None]
    cv = Canvas(S, S, 2)
    cv.rgb[:] = col * a[..., None]; cv.a[:] = a
    cv.glow[:] = ICE[None, None] * (a * 1.15)[..., None]
    rng = np.random.default_rng(11)
    P = lambda n: np.array(m[n]) * S
    # arcs jumping between the coils and up to the orb, on both sides
    arc(cv, P('c1L') + [-3, 0], P('c2L') + [-3, 0], rng, 1.0)
    arc(cv, P('c2R') + [3, 0], P('c3R') + [3, 0], rng, 0.95)
    arc(cv, P('c1R') + [3, 2], P('c2R') + [3, 0], rng, 0.8, branches=1)
    arc(cv, P('c3L') + [-2, 0], P('orbL') + [-1, 2], rng, 0.9)
    arc(cv, P('c2F'), P('c3F'), rng, 0.7, branches=1, k=0.85)
    img = cv.finish(bloom=(6, 18), bloomk=(0.75, 0.55))
    Image.fromarray(img, 'RGBA').save(out)

if __name__ == '__main__':
    if sys.argv[1] == 'fire': fire(sys.argv[2], sys.argv[3])
    else: pulse(sys.argv[2], sys.argv[3], sys.argv[4])
