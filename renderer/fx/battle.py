"""The battle effects (ART_GUIDE Batch 15, the Nov 2026 redraw): every small weapon effect as a sprite sheet, made with
fxlib like fx-explosion and fx-fuel-blast, so the whole fight has one painted, lit look. Transparent backgrounds; grids
read left to right, then top to bottom; the last frame has faded to almost nothing.

  fx-explosion   16 x 256 (4x4)  the fireball of every blast (explosion.py, with lighter, quicker-thinning late smoke)
  fx-muzzle       4 x 128x64 (4x1) a gun's flash, pointing right, the barrel's end the middle of the left edge
  fx-impact       8 x 128 (4x2)  a round kicking up sand: grit thrown up and out, a little cloud settling
  fx-spark        6 x 128 (6x1)  a round striking armour: a white flash, sparks flying out and falling
  fx-smoke       16 x 128 (4x4)  gun smoke and blast smoke: a puff rising and spreading, the source 2/3 down
  fx-debris      12 x 256 (4x3)  chunks of plate and concrete thrown up and falling back, hot ones cooling
  fx-dustcloud   16 x 256 (4x4)  a building coming down: dust rolling out along the ground and churning up
  decal-scorch    4 x 128 (4x1)  blast scorch variants, seen at the 70-degree camera (an oval)
  decal-pock      4 x 64  (4x1)  bullet pockmarks in the ground
  decal-burn      4 x 64  (4x1)  laser burns

    python3 fx/battle.py <outdir>          -> <name>.webp in outdir (and <name>.png previews with --png)
"""
import os, sys, math
import numpy as np
from PIL import Image
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)
sys.path.insert(0, os.path.join(_HERE, '..', 'terrain'))
from fxlib import Canvas, sheet, smooth
from tex import fbm

OUT = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith('-') else 'out/fx'
ONLY = [a for a in sys.argv[2:] if not a.startswith('-')]
os.makedirs(OUT, exist_ok=True)
SAND = (0.70, 0.52, 0.34)       # the planet's rust-ochre dust
GRIT = (0.34, 0.25, 0.18)
CONC = (0.62, 0.60, 0.57)       # concrete powder
SMOKE = (0.30, 0.28, 0.27)
KY = 0.84 * 0.62                 # ground depth -> screen (the high three-quarter camera)


def save(img, name):
    img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=82, method=6)
    if '--png' in sys.argv: img.save(os.path.join(OUT, name + '.png'))
    print(name, img.size, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')


def want(n): return not ONLY or n in ONLY


# ------------------------------------------------------------------ fx-explosion
if want('fx-explosion'):
    import explosion
    save(sheet([explosion.frame(i) for i in range(16)], 4), 'fx-explosion')

# ------------------------------------------------------------------ fx-muzzle
if want('fx-muzzle'):
    rng = np.random.default_rng(11)
    fl = [(rng.uniform(-0.5, 0.5), rng.uniform(0.55, 1.0)) for _ in range(9)]
    frames = []
    for i in range(4):
        t = i / 3
        C = Canvas(128, 64)
        x0, y0 = 2, 32
        k = [1.0, 0.85, 0.45, 0.12][i]
        L = [88, 104, 96, 60][i]
        # the cone of flame: streaks fanning out, white at the root
        for a, s in fl:
            ln = L * s * (0.8 + 0.2 * (i == 1))
            ang = a * (0.38 + 0.25 * t)
            C.streak(x0, y0, x0 + math.cos(ang) * ln, y0 + math.sin(ang) * ln, 7 * s * k + 1, (1.0, 0.72 - 0.3 * t, 0.3 - 0.2 * t), alpha=0.75 * k, glowk=0.9 * k, taper=False)
        # two side flares (the muzzle brake)
        if i < 3:
            for sg in (-1, 1):
                C.streak(x0 + 14, y0, x0 + 22, y0 + sg * 20 * (0.7 + 0.3 * t), 4 * k + 0.6, (1.0, 0.78, 0.4), alpha=0.85 * k, glowk=0.8 * k)
        C.blob(x0 + 16 + 6 * t, y0, 22 - 6 * t, (1.0, 0.95, 0.8), alpha=k, glowk=1.4 * k, power=1.6)
        # gun smoke curling off the flash
        if i >= 1:
            for n in range(3):
                C.puff(x0 + 26 + 22 * n + 10 * t, y0 + (n - 1) * 6, 6 + 6 * t + 2 * n, dens=0.35 * (1 - 0.6 * t), albedo=(0.55, 0.52, 0.5), seed=n + 3, rot=t, rough=0.4)
        frames.append(C.finish(bloom=(2.0, 6.0), bloomk=(0.6, 0.35)))
    save(sheet(frames, 4), 'fx-muzzle')

# ------------------------------------------------------------------ fx-impact
if want('fx-impact'):
    rng = np.random.default_rng(23)
    grit = [(rng.uniform(-2.4, -0.7), rng.uniform(26, 60), rng.uniform(0.8, 1.6)) for _ in range(14)]
    puffs = [(rng.uniform(-1, 1), rng.uniform(0.3, 1.0), int(rng.integers(0, 50))) for _ in range(6)]
    frames = []
    for i in range(8):
        t = i / 7
        C = Canvas(128, 128)
        cx, cy = 64, 76
        # the little cloud: kicked up, spreading low and settling
        for dx, h, sd in puffs:
            r = 6 + 20 * (1 - math.exp(-t / 0.3)) * (0.6 + 0.4 * h)
            x = cx + dx * 26 * (1 - math.exp(-t / 0.25))
            y = cy - 22 * h * math.sin(min(1.0, t * 1.6) * math.pi * 0.5) + 6 * t
            C.puff(x, y, r, dens=0.75 * (1 - t) ** 1.4 * smooth(0, 0.08, t + 0.05), albedo=SAND, seed=sd, rot=t + dx, rough=0.5, flat=0.8)
        # grit flying up and out, falling back
        for a, sp, w in grit:
            tt = t * 0.9
            def p(q): return cx + math.cos(a) * sp * q * 1.2, cy + math.sin(a) * sp * q + 90 * q * q
            if tt <= 0.01: continue
            a0, a1 = p(max(0, tt - 0.06)), p(tt)
            C.streak(a0[0], a0[1], a1[0], a1[1], w, GRIT, alpha=(1 - t) ** 0.8)
        if i == 0: C.blob(cx, cy - 4, 10, (1.0, 0.9, 0.7), alpha=0.7, glowk=0.6)
        frames.append(C.finish())
    save(sheet(frames, 4), 'fx-impact')

# ------------------------------------------------------------------ fx-spark
if want('fx-spark'):
    rng = np.random.default_rng(5)
    sp = [(rng.uniform(0, 2 * math.pi), rng.uniform(30, 64), rng.uniform(0.6, 1.3)) for _ in range(22)]
    frames = []
    for i in range(6):
        t = i / 5
        C = Canvas(128, 128)
        cx, cy = 64, 64
        for a, v, w in sp:
            def p(q): return cx + math.cos(a) * v * q, cy + math.sin(a) * v * q * 0.75 + 46 * q * q
            q1 = 0.15 + 0.85 * t; q0 = max(0, q1 - 0.22)
            a0, a1 = p(q0), p(q1)
            col = (1.0, 0.95 - 0.4 * t, 0.7 - 0.55 * t)
            C.streak(a0[0], a0[1], a1[0], a1[1], w, col, alpha=(1 - t) ** 0.7, glowk=1.2 * (1 - t))
        if i < 2: C.blob(cx, cy, 16 - 7 * i, (1.0, 0.98, 0.9), alpha=1 - 0.5 * i, glowk=1.6, power=1.4)
        frames.append(C.finish(bloom=(2.0, 6.0), bloomk=(0.6, 0.3)))
    save(sheet(frames, 6), 'fx-spark')

# ------------------------------------------------------------------ fx-smoke
if want('fx-smoke'):
    rng = np.random.default_rng(77)
    sub = [(rng.uniform(-1, 1), rng.uniform(-1, 0.4), rng.uniform(0.55, 0.85), int(rng.integers(0, 60))) for _ in range(7)]
    frames = []
    for i in range(16):
        t = i / 15
        C = Canvas(128, 128)
        cx = 64 + 14 * t ** 1.3
        cy = 128 * 2 / 3 - 58 * t ** 0.8
        r = 9 + 28 * t ** 0.7
        dens = 0.85 * (1 - t) ** 1.25 * smooth(0, 0.1, t + 0.04)
        alb = tuple(np.array(SMOKE) * (1 - t) + np.array((0.52, 0.49, 0.46)) * t)
        for ox, oy, rs, sd in sorted(sub, key=lambda o: o[1]):
            C.puff(cx + ox * r * 0.7, cy + oy * r * 0.6, r * rs, dens=dens, albedo=alb, seed=sd, rot=t * 0.8 + ox, rough=0.38)
        frames.append(C.finish())
    save(sheet(frames, 4), 'fx-smoke')

# ------------------------------------------------------------------ fx-debris
if want('fx-debris'):
    rng = np.random.default_rng(91)
    ch = []
    for i in range(12):
        az = rng.uniform(0, 2 * math.pi); el = rng.uniform(0.5, 1.3); v = rng.uniform(70, 130)
        ch.append(dict(v=(v * math.cos(el) * math.cos(az), v * math.cos(el) * math.sin(az), v * math.sin(el)), s=rng.uniform(3.5, 7.5),
                       col=[(0.24, 0.25, 0.27), (0.50, 0.46, 0.40), (0.40, 0.33, 0.27)][i % 3], hot=i % 4 == 0, spin=rng.uniform(4, 12), ph=rng.uniform(0, 6)))
    frames = []
    for i in range(12):
        t = i / 11
        C = Canvas(256, 256)
        cx, cy = 128, 128
        for c in ch:
            vx, vy, vz = c['v']
            q = t * 1.1
            z = max(0.0, vz * q - 160 * q * q)
            x, y = cx + vx * q, cy + vy * q * KY
            sx, sy = x, y - z * 0.78
            fade = 1 - smooth(0.75, 1.0, t)
            C.blob(x + 2, y + 2, c['s'] * 0.9, (0, 0, 0), alpha=0.35 * fade, power=1.2)        # its shadow on the ground
            ang = c['ph'] + c['spin'] * q * (1 if z > 0 else 0.2)
            dx, dy = math.cos(ang) * c['s'], math.sin(ang) * c['s'] * 0.6
            hot = c['hot'] and t < 0.7
            col = (1.0, 0.55, 0.2) if hot else c['col']
            C.streak(sx - dx, sy - dy, sx + dx, sy + dy, c['s'] * 0.55, col, alpha=fade, glowk=0.8 * (1 - t) if hot else 0, taper=False)
            C.streak(sx - dx * 0.6, sy - dy * 0.6 - 1, sx + dx * 0.4, sy + dy * 0.4 - 1, c['s'] * 0.22, (0.75, 0.72, 0.68) if not hot else (1, 0.85, 0.5), alpha=0.6 * fade, taper=False)
        frames.append(C.finish())
    save(sheet(frames, 4), 'fx-debris')

# ------------------------------------------------------------------ fx-dustcloud
if want('fx-dustcloud'):
    rng = np.random.default_rng(303)
    ring = [dict(az=i / 20 * 2 * math.pi + rng.uniform(-0.15, 0.15), s=rng.uniform(0.65, 1.0), r0=rng.uniform(16, 26), sd=int(rng.integers(0, 90)),
                 col=SAND if i % 3 else CONC) for i in range(20)]
    up = [dict(dx=rng.uniform(-30, 30), h=rng.uniform(0.3, 1.0), r0=rng.uniform(18, 28), sd=int(rng.integers(0, 90))) for _ in range(8)]
    frames = []
    for i in range(16):
        t = i / 15
        C = Canvas(256, 256)
        gx, gy = 128, 256 * 2 / 3
        items = []
        for p in ring:
            D = 95 * p['s'] * (1 - math.exp(-t / 0.3))
            x, y = math.cos(p['az']) * D, math.sin(p['az']) * D * KY
            r = p['r0'] * (0.6 + 1.0 * (1 - math.exp(-t / 0.35)))
            dens = 0.7 * smooth(0, 0.1, t + 0.03) * (1 - smooth(0.35, 1.0, t))
            items.append((y, gx + x, gy + y - 6 * t, r, dens, p['col'], p['sd'], 0.7))
        for p in up:
            z = 70 * p['h'] * (1 - math.exp(-t / 0.4))
            r = p['r0'] * (0.5 + 1.1 * (1 - math.exp(-t / 0.4)))
            dens = 0.6 * smooth(0, 0.15, t) * (1 - smooth(0.3, 1.0, t))
            items.append((-z * 0.2, gx + p['dx'] * (0.5 + t), gy - z * 0.78, r, dens, CONC, p['sd'], 0.95))
        for _, x, y, r, d, col, sd, fl in sorted(items, key=lambda q: q[0]):
            if d > 0.01: C.puff(x, y, r, dens=d, albedo=col, seed=sd, rot=t + sd, rough=0.45, flat=fl)
        frames.append(C.finish())
    save(sheet(frames, 4), 'fx-dustcloud')


# ------------------------------------------------------------------ ground marks (drawn straight in numpy)
def mark(n, seed, paint):
    """n x n RGBA; paint(u, v, d, ang, noise) -> (rgb (n,n,3), alpha (n,n)). u, v in -1..1, the camera's 70-degree squash on v."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    u = (xx + 0.5) / n * 2 - 1
    v = ((yy + 0.5) / n * 2 - 1) / 0.76
    d = np.sqrt(u * u + v * v)
    ang = np.arctan2(v, u)
    nz = fbm(n, seed, 2, 9, 1.6)
    nz2 = fbm(n, seed + 1, 4, 20, 1.2)
    rgb, a = paint(u, v, d, ang, nz, nz2)
    return np.concatenate([np.clip(rgb, 0, 1) * 255, np.clip(a, 0, 1)[..., None] * 255], -1).astype(np.uint8)


def scorch(seed):
    rs = np.random.default_rng(seed)
    nray = int(rs.integers(9, 15)); rays = rs.uniform(0, 2 * np.pi, nray); rlen = rs.uniform(0.55, 1.0, nray)
    def paint(u, v, d, ang, nz, nz2):
        ray = np.zeros_like(d)
        for r0, l in zip(rays, rlen):
            da = np.angle(np.exp(1j * (ang - r0)))
            ray = np.maximum(ray, np.exp(-(da / 0.11) ** 2) * np.clip(1 - d / (0.75 + 0.25 * l), 0, 1))
        edge = 0.62 + 0.1 * nz
        body = 1 - smooth(edge - 0.18, edge + 0.08, d)
        a = np.clip(body * (0.82 + 0.06 * nz2) + ray * 0.5, 0, 1) * (1 - smooth(0.85, 1.0, d))
        pit = 1 - smooth(0.12, 0.24 + 0.03 * nz, d)
        rim = np.exp(-((d - 0.28 - 0.03 * nz) / 0.06) ** 2) * np.clip(-u * 0.6 - v * 0.7 + 0.3, 0, 1)   # the lit lip, upper left
        base = np.array([0.10, 0.075, 0.06])[None, None] * (1 + 0.12 * nz2[..., None]) + np.array([0.12, 0.08, 0.05])[None, None] * smooth(0.3, 0.8, d)[..., None]
        rgb = base * (1 - pit[..., None] * 0.45) + np.array([0.42, 0.33, 0.24])[None, None] * rim[..., None] * 0.8
        ash = 0.5 * np.clip(nz2 - 1.6, 0, 1)[..., None] * np.array([0.5, 0.48, 0.45])[None, None]
        return rgb + ash * body[..., None], np.maximum(a, pit * 0.95)
    return mark(128, seed, paint)


def pock(seed):
    rs = np.random.default_rng(seed)
    holes = [(rs.uniform(-0.5, 0.5), rs.uniform(-0.45, 0.45), rs.uniform(0.12, 0.2)) for _ in range(int(rs.integers(2, 5)))]
    def paint(u, v, d, ang, nz, nz2):
        a = np.zeros_like(d); rgb = np.zeros(d.shape + (3,))
        for hx, hy, r in holes:
            dd = np.sqrt((u - hx) ** 2 + ((v * 0.76 - hy) / 0.76) ** 2) / r
            lip = np.exp(-((dd - 1.15) / 0.3) ** 2) * (0.6 + 0.4 * np.clip(-(u - hx) - (v - hy), -1, 1))
            hole = 1 - smooth(0.7, 1.0, dd + 0.1 * nz)
            rgb = rgb * (1 - hole[..., None]) + np.array([0.11, 0.08, 0.06])[None, None] * hole[..., None]
            rgb = rgb + np.array([0.55, 0.42, 0.3])[None, None] * (lip * (1 - hole))[..., None]
            a = np.maximum(a, np.maximum(hole * 0.92, lip * 0.55))
        return rgb / np.maximum(a, 1e-3)[..., None] * (a > 0)[..., None], a
    return mark(64, seed, paint)


def burn(seed):
    def paint(u, v, d, ang, nz, nz2):
        e = 0.55 + 0.12 * nz
        core = 1 - smooth(e - 0.25, e, d)
        halo = (1 - smooth(e, e + 0.3, d)) * 0.3
        glow = np.exp(-((d - e + 0.05) / 0.07) ** 2) * 0.5
        rgb = np.array([0.06, 0.05, 0.05])[None, None] * (1 + 0.4 * np.clip(nz2, 0, 2))[..., None]
        rgb = rgb + np.array([0.22, 0.32, 0.36])[None, None] * 0.6 * np.clip(nz2 - 1.0, 0, 1)[..., None] * core[..., None]   # glassy sheen
        rgb = rgb + np.array([0.7, 0.3, 0.08])[None, None] * glow[..., None]
        return rgb, np.maximum(core * 0.9, halo)
    return mark(64, seed, paint)


def row(cells): return Image.fromarray(np.concatenate(cells, 1), 'RGBA')


if want('decal-scorch'): save(row([scorch(40 + k) for k in range(4)]), 'decal-scorch')
if want('decal-pock'): save(row([pock(60 + k) for k in range(4)]), 'decal-pock')
if want('decal-burn'): save(row([burn(80 + k) for k in range(4)]), 'decal-burn')
