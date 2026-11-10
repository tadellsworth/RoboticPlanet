"""fx-fuel-blast: a fuel explosion (a Tanker or a Refinery going up). 16 frames of 256x256 in a 4x4 grid.
Ground zero centred, 2/3 down (the explosion's high three-quarter view). Plays once over about 1.1 s.

Bigger and dirtier than fx-explosion: a white-hot flash, a rolling orange fireball that climbs into a mushroom of
thick black oily smoke, burning fuel splashed in a ring on the ground, and blazing droplets thrown out. The last
frame has nearly faded to nothing. Made with fxlib, like fx-explosion."""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__))
import sys, math
import numpy as np
from PIL import Image
sys.path.insert(0, _HERE)
from fxlib import Canvas, sheet, smooth

FS = 256
GX, GY = 128, FS * 2 / 3
KY, KZ = 0.84 * 0.62, 0.78                       # ground depth and height -> screen (high three-quarter camera)
rng = np.random.default_rng(7177)
N = 16

fire = []
for i in range(80):
    az = rng.uniform(0, 2 * math.pi)
    u_ = rng.uniform(-0.05, 1.0); el = math.asin(math.copysign(abs(u_) ** 0.75, u_))
    s = rng.uniform(0.45, 1.0)
    fire.append(dict(d=(math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)), s=s,
                     r0=rng.uniform(12, 22), cap=0.4 + 0.6 * max(0.0, math.sin(el)) ** 0.8 * rng.uniform(0.6, 1.0),
                     hot=1 - s * 0.5 + rng.uniform(-0.1, 0.1), seed=int(rng.integers(0, 1000)), rot=rng.uniform(0, 6.28)))
# burning fuel splashed over the ground: low flames in a ring that spreads and dies down
pool = []
for i in range(22):
    az = i / 22 * 2 * math.pi + rng.uniform(-0.15, 0.15)
    pool.append(dict(az=az, s=rng.uniform(0.6, 1.0), r0=rng.uniform(7, 11), seed=int(rng.integers(0, 1000)), rot=rng.uniform(0, 6.28)))
drops = []
for i in range(26):
    az = rng.uniform(0, 2 * math.pi); el = rng.uniform(0.3, 1.2); sp = rng.uniform(130, 220)
    drops.append(dict(v=(sp * math.cos(el) * math.cos(az), sp * math.cos(el) * math.sin(az), sp * math.sin(el)), w=rng.uniform(1.2, 2.2),
                      life=rng.uniform(0.35, 0.6)))

def proj(x, y, z): return GX + x, GY + y * KY - z * KZ

def frame(i):
    t = i / (N - 1)
    C = Canvas(FS, FS)
    items = []
    for p in pool:
        D = 58 * p['s'] * (1 - math.exp(-t / 0.2))
        x, y = math.cos(p['az']) * D, math.sin(p['az']) * D
        r = p['r0'] * (0.7 + 0.8 * (1 - math.exp(-t / 0.25)))
        dens = 0.9 * smooth(0.03, 0.12, t) * (1 - smooth(0.55, 1.0, t))
        if dens <= 0.01: continue
        T = float(np.clip(0.85 - t * 0.7, 0, 1))
        sx, sy = proj(x, y, 2)
        items.append((y * KY, 'pool', dict(x=sx, y=sy, r=r, dens=dens, temp=T, seed=p['seed'], rot=p['rot'] + t)))
    for p in fire:
        dx, dy, dz = p['d']
        D = 74 * p['s'] * (1 - math.exp(-t / 0.12))
        cap = p['cap']
        horiz = D * (1 - 0.5 * smooth(0.2, 0.8, t) * (1 - cap)) + 40 * t * cap * (0.5 + 0.5 * p['s'])
        rise = 130 * (t ** 1.05) * cap + 26 * t * (1 - cap)
        x, y, z = dx * horiz, dy * horiz * 0.8, dz * D * 0.8 + rise
        r = p['r0'] * (0.34 + 1.2 * (1 - math.exp(-t / 0.18)) + 0.9 * t)
        T = float(np.clip(1.1 - t * (1.05 + 1.0 * (1 - p['hot'])), 0, 1))
        dens = (1.0 if t < 0.55 else max(0.0, (1.0 - t) / 0.45) ** 1.6) * (0.85 + 0.35 * p['hot'])
        if dens <= 0.01: continue
        # oily smoke: sooty black, staying dark as it cools (fx-explosion's turns grey)
        alb = np.array([0.07, 0.065, 0.06]) * (1 - smooth(0.45, 1.0, t)) + np.array([0.14, 0.13, 0.12]) * smooth(0.45, 1.0, t)
        sx, sy = proj(x, y, z)
        items.append((y * KY + z * 0.55, 'fire', dict(x=sx, y=sy, r=r, dens=dens, temp=T, albedo=tuple(alb), seed=p['seed'], rot=p['rot'] + t,
                                                      underglow=max(0.0, 1.0 - t * 1.4), heat_core=1.1)))
    if t > 0.12:   # the stem of the mushroom
        for k in range(8):
            h = (k + 0.5) / 8
            zc = 130 * (t ** 1.05) * 0.6 * h
            r = 10 + 8 * h + 12 * t
            T = float(np.clip(0.95 - t * 1.3 - 0.3 * (1 - h), 0, 1))
            dens = 0.9 * smooth(0.12, 0.28, t) * (1.0 if t < 0.55 else max(0.0, (1.0 - t) / 0.45) ** 1.6)
            sx, sy = proj(math.sin(k * 2.1) * 5, 0, zc)
            alb = np.array([0.07, 0.065, 0.06]) * (1 - smooth(0.45, 1.0, t)) + np.array([0.14, 0.13, 0.12]) * smooth(0.45, 1.0, t)
            items.append((zc * 0.55 - 5, 'fire', dict(x=sx, y=sy, r=r, dens=dens, temp=T, albedo=tuple(alb), seed=600 + k, rot=k,
                                                     underglow=max(0.0, 0.8 - t * 1.2), heat_core=0.95)))
    for _, kind, a in sorted(items, key=lambda q: q[0]):
        if kind == 'pool':
            C.puff(a['x'], a['y'], a['r'], dens=a['dens'], temp=a['temp'], albedo=(0.08, 0.07, 0.06), seed=a['seed'], rot=a['rot'],
                   rough=0.5, flat=0.55, soft=1.2, underglow=0.6, heat_core=1.0, glowk=0.9)
        else:
            C.puff(a['x'], a['y'], a['r'], dens=a['dens'], temp=a['temp'], albedo=a['albedo'], seed=a['seed'], rot=a['rot'],
                   underglow=a['underglow'], heat_core=a['heat_core'], glowk=1.0)
    # blazing fuel droplets, thrown out and falling back
    ts = t * 0.75
    for p in drops:
        if ts <= 0.004 or ts > p['life']: continue
        def pos(tt):
            vx, vy, vz = p['v']; return proj(vx * tt * 0.55, vy * tt * 0.55, vz * tt * 0.55 - 0.5 * 480 * tt * tt * 0.55)
        a0, a1 = pos(max(0.0, ts - 0.04)), pos(ts)
        k = ts / p['life']
        col = (1.0, 0.75 - 0.45 * k, 0.25 - 0.2 * k)
        C.streak(a0[0], a0[1], a1[0], a1[1], p['w'], col, alpha=1 - k ** 2, glowk=0.8 * (1 - k))
    if i == 0:
        C.blob(GX, GY - 10, 56, (1.0, 0.8, 0.4), alpha=0.6, glowk=1.0, power=2.2)
        C.blob(GX, GY - 9, 26, (1.0, 0.97, 0.85), alpha=1.0, glowk=1.8, power=1.2)
    elif i == 1:
        C.blob(GX, GY - 16, 64, (1.0, 0.65, 0.25), alpha=0.4, glowk=0.7, power=2.0)
    out = C.finish(bloom=(3.0, 11.0), bloomk=(0.55, 0.32))
    # The smoke thins out evenly over the last frames, to nothing at the end.
    out[..., 3] = (out[..., 3].astype(np.float32) * (1 - smooth(0.6, 1.0, t))).astype(np.uint8)
    return out

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'out/fx'
    _os.makedirs(out, exist_ok=True)
    frames = [frame(i) for i in range(N)]  # (the last frame: t = 1, faded right out)
    sheet(frames, 4).save(f'{out}/fx-fuel-blast.png')
    print('ok')
