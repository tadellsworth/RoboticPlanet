"""fx-explosion: 16 frames of 256x256 in a 4x4 grid. Ground zero centred, 2/3 down. Plays once over 0.6 s."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, math
import numpy as np
from PIL import Image
sys.path.insert(0, _HERE)
from fxlib import Canvas, sheet, smooth

FS = 256
GX, GY = 128, FS * 2 / 3
KY, KZ = 0.84 * 0.62, 0.78                       # ground depth and height -> screen (high three-quarter camera)
rng = np.random.default_rng(42)

fire = []
for i in range(64):
    az = rng.uniform(0, 2 * math.pi)
    u_ = rng.uniform(-0.05, 1.0); el = math.asin(math.copysign(abs(u_) ** 0.7, u_))
    s = rng.uniform(0.45, 1.0)
    fire.append(dict(d=(math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)), s=s,
                     r0=rng.uniform(11, 21), cap=0.35 + 0.65 * max(0.0, math.sin(el)) ** 0.8 * rng.uniform(0.6, 1.0),
                     hot=1 - s * 0.55 + rng.uniform(-0.1, 0.1), seed=int(rng.integers(0, 1000)), rot=rng.uniform(0, 6.28)))
dust = []
for i in range(16):
    az = i / 16 * 2 * math.pi + rng.uniform(-0.2, 0.2)
    dust.append(dict(az=az, s=rng.uniform(0.7, 1.0), r0=rng.uniform(9, 14), seed=int(rng.integers(0, 1000)), rot=rng.uniform(0, 6.28)))
deb = []
for i in range(18):
    az = rng.uniform(0, 2 * math.pi); el = rng.uniform(0.35, 1.25); sp = rng.uniform(150, 230)
    deb.append(dict(v=(sp * math.cos(el) * math.cos(az), sp * math.cos(el) * math.sin(az), sp * math.sin(el)), w=rng.uniform(1.0, 1.9),
                    life=rng.uniform(0.32, 0.55)))

def proj(x, y, z): return GX + x, GY + y * KY - z * KZ

def frame(i):
    t = i / 15
    C = Canvas(FS, FS)
    items = []
    # ground dust skirt, rolling out along the ground
    for p in dust:
        D = 70 * p['s'] * (1 - math.exp(-t / 0.28))
        x, y = math.cos(p['az']) * D, math.sin(p['az']) * D
        r = p['r0'] * (0.6 + 1.6 * (1 - math.exp(-t / 0.3)))
        dens = 0.5 * smooth(0.02, 0.12, t) * (1 - smooth(0.4, 1.06, t))
        if dens <= 0.01: continue
        sx, sy = proj(x, y, 3)
        items.append((y * KY, 'dust', dict(x=sx, y=sy, r=r, dens=dens, seed=p['seed'], rot=p['rot'])))
    # fireball puffs: burst out, rise into a mushroom, cool into smoke, thin out
    for p in fire:
        dx, dy, dz = p['d']
        D = 68 * p['s'] * (1 - math.exp(-t / 0.11))
        cap = p['cap']
        horiz = D * (1 - 0.45 * smooth(0.2, 0.85, t) * (1 - cap)) + 52 * t * cap * (0.5 + 0.5 * p['s'])
        rise = 118 * (t ** 1.1) * cap + 22 * t * (1 - cap)
        x, y, z = dx * horiz, dy * horiz * 0.8, dz * D * 0.8 + rise
        r = p['r0'] * (0.32 + 1.15 * (1 - math.exp(-t / 0.16)) + 0.75 * t)
        T = float(np.clip(1.08 - t * (1.25 + 1.1 * (1 - p['hot'])), 0, 1))
        dens = (1.0 if t < 0.45 else max(0.0, (1.06 - t) / 0.61) ** 1.6) * (0.8 + 0.35 * p['hot'])
        if dens <= 0.01: continue
        alb = np.array([0.11, 0.10, 0.095]) * (1 - smooth(0.35, 1.0, t)) + np.array([0.30, 0.27, 0.245]) * smooth(0.35, 1.0, t)
        sx, sy = proj(x, y, z)
        items.append((y * KY + z * 0.55, 'fire', dict(x=sx, y=sy, r=r, dens=dens, temp=T, albedo=tuple(alb), seed=p['seed'], rot=p['rot'] + t,
                                                      underglow=max(0.0, 0.9 - t * 1.6), heat_core=1.05)))
    if t > 0.15:
        for k in range(7):
            h = (k + 0.5) / 7
            zc = 118 * (t ** 1.1) * 0.55 * h
            r = 9 + 7 * h + 10 * t
            T = float(np.clip(0.9 - t * 1.6 - 0.3 * (1 - h), 0, 1))
            dens = 0.85 * smooth(0.15, 0.3, t) * (1.0 if t < 0.5 else max(0.0, (1.06 - t) / 0.56) ** 1.6)
            sx, sy = proj(math.sin(k * 2.1) * 4, 0, zc)
            alb = np.array([0.12, 0.11, 0.10]) * (1 - smooth(0.35, 1.0, t)) + np.array([0.30, 0.27, 0.245]) * smooth(0.35, 1.0, t)
            items.append((zc * 0.55 - 5, 'fire', dict(x=sx, y=sy, r=r, dens=dens, temp=T, albedo=tuple(alb), seed=500 + k, rot=k,
                                                     underglow=max(0.0, 0.7 - t * 1.4), heat_core=0.9)))
    for _, kind, a in sorted(items, key=lambda q: q[0]):
        if kind == 'dust':
            C.puff(a['x'], a['y'], a['r'], dens=a['dens'], albedo=(0.66, 0.44, 0.27), seed=a['seed'], rot=a['rot'], rough=0.45, flat=0.62, soft=1.3)
        else:
            C.puff(a['x'], a['y'], a['r'], dens=a['dens'], temp=a['temp'], albedo=a['albedo'], seed=a['seed'], rot=a['rot'],
                   underglow=a['underglow'], heat_core=a['heat_core'], glowk=1.0)
    # burning debris flecks, thrown out and falling back
    ts = t * 0.6
    for p in deb:
        if ts <= 0.004 or ts > p['life']: continue
        def pos(tt):
            vx, vy, vz = p['v']; return proj(vx * tt * 0.55, vy * tt * 0.55, vz * tt * 0.55 - 0.5 * 520 * tt * tt * 0.55)
        a0, a1 = pos(max(0.0, ts - 0.035)), pos(ts)
        k = ts / p['life']
        col = (1.0, 0.85 - 0.5 * k, 0.4 - 0.35 * k)
        C.streak(a0[0], a0[1], a1[0], a1[1], p['w'], col, alpha=1 - k ** 2, glowk=0.6 * (1 - k))
    # frame 1: the white-hot flash
    if i == 0:
        C.blob(GX, GY - 8, 44, (1.0, 0.82, 0.45), alpha=0.55, glowk=0.9, power=2.2)
        C.blob(GX, GY - 7, 20, (1.0, 0.97, 0.85), alpha=1.0, glowk=1.6, power=1.2)
    elif i == 1:
        C.blob(GX, GY - 14, 52, (1.0, 0.7, 0.3), alpha=0.35, glowk=0.6, power=2.0)
    return C.finish(bloom=(3.0, 10.0), bloomk=(0.5, 0.3))

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out/fx'; _os.makedirs(out, exist_ok=True)
    import os; os.makedirs(out, exist_ok=True)
    frames = [frame(i) for i in range(16)]
    sheet(frames, 4).save(f'{out}/fx-explosion.png')
    for i, f in enumerate(frames): Image.fromarray(f, 'RGBA').save(f'{out}/fx-explosion-{i:02d}.png')
    print('ok')
