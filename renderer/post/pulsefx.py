"""Pulse Cannon charge-up + purple laser effects.
  turret-charge-K.png  (K = 0..15)  8 frames of 512x512 in a 4x2 sheet, drawn on top of turret-head-K (same canvas/anchor)
  fx-pulse-laser.png   6 frames of 512x64 in a 1x6 sheet: points right, muzzle = middle of the left edge, stretched to the target
  fx-pulse-hit.png     6 frames of 128x128 in a 6x1 sheet: centred on the target
  pulse-muzzles.json   per direction: both barrel tips (px in the 512 canvas) and the screen angle of the barrels
"""
import os as _os, sys as _sys
_HERE = _os.path.dirname(_os.path.abspath(__file__)); _ROOT = _os.path.dirname(_HERE)
import sys, json, math
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, _os.path.join(_ROOT, 'fx'))
from fxlib import Canvas, sheet, smooth
from defence_overlays import jagged

R = _os.path.join(sys.argv[1], ''); O = _os.path.join(sys.argv[2], '')   # usage: pulsefx.py <rawdir with charge-K renders> <outdir>
VIO = np.array([0.66, 0.36, 1.0], np.float32)      # #a85cff
DEEP = np.array([0.45, 0.16, 0.95], np.float32)
WHITE = np.array([1.0, 0.97, 1.0], np.float32)
S = 512
import os; os.makedirs(O, exist_ok=True)

def mix(a, b, t): return a * (1 - t) + b * t

def charge_frames(k):
    g = json.load(open(f'{R}charge-{k}.geom.json'))['marks']
    im = np.asarray(Image.open(f'{R}charge-{k}.beauty.png').convert('RGBA')).astype(np.float32) / 255
    a = im[..., 3]
    # split the lit mask into rings by the nearest coil/tip mark: level 0..2 = coils back to front, 3 = tips
    keys = [(f'coil{b}-{x}', l) for b in (0, 1) for l, x in enumerate(['1.3', '1.7', '2.1'])] + [(f'tip{b}', 3) for b in (0, 1)]
    pts = np.array([np.array(g[n]) * 1024 for n, _ in keys]); lv = np.array([l for _, l in keys])
    yy, xx = np.mgrid[0:1024, 0:1024]
    d = (xx[None] - pts[:, 0, None, None]) ** 2 + (yy[None] - pts[:, 1, None, None]) ** 2
    level = lv[d.argmin(0)]
    tips = [np.array(g[f'tip{b}']) * S for b in (0, 1)]
    dirs = []
    for b in (0, 1):
        v = np.array(g[f'tip{b}f']) * S - tips[b]; dirs.append(v / (np.linalg.norm(v) + 1e-6))
    unit = np.linalg.norm(np.array(g['tip0f']) * S - tips[0])            # px per world unit along the barrel (foreshortened)
    rng = np.random.default_rng(100 + k)
    frames = []
    for f in range(8):
        cv = Canvas(S, S, 2)
        t = min(f, 6) / 6.0
        I = np.zeros(4)
        for l in range(4):
            I[l] = smooth(l * 0.16, l * 0.16 + 0.42, t) * (0.88 + 0.12 * rng.random())
        if f == 7: I[:] = 0.6
        Ipx = I[level] * a
        w = np.clip(Ipx, 0, 1) ** 1.5
        col = mix(VIO[None, None], WHITE[None, None], (w * 0.75)[..., None])
        cv.rgb[:] = col * Ipx[..., None]; cv.a[:] = np.clip(Ipx * 1.05, 0, 1)
        cv.glow[:] = VIO[None, None] * (Ipx * 2.0)[..., None]
        # charging aura: a soft violet glow that swells round the barrels and head as the shot builds
        cpts = np.array([np.array(g[n]) * S for n, _ in keys])
        cx, cy = cpts.mean(0)
        if 1 <= f <= 6:
            cv.blob(cx, cy, 70 + 25 * t, tuple(DEEP), alpha=0.5 * t, glowk=0.8 * t, power=2.0)
            cv.blob(cx, cy, 40 + 12 * t, tuple(VIO), alpha=0.32 * t, glowk=0.6 * t, power=1.8)
        for b in (0, 1):
            x, y = tips[b]; dd = dirs[b]
            if f < 7:
                rr = 2 + 11 * smooth(0.1, 1.0, t) + (3.5 if f == 6 else 0)
                if f >= 1:
                    # energy motes spiralling in toward the muzzle
                    for i in range(14):
                        ph = (i / 14 + f * 0.13) % 1.0; ang = i * 2.39 + f * 0.9; rad = (12 + 40 * (1 - ph)) * (0.7 + 0.5 * t)
                        p0 = np.array([x + math.cos(ang) * rad, y + math.sin(ang) * rad * 0.8]); p1 = p0 + (np.array([x, y]) - p0) * 0.28
                        cv.streak(p1[0], p1[1], p0[0], p0[1], 1.1, tuple(mix(VIO, WHITE, 0.45)), alpha=0.6 + 0.4 * t, glowk=1.0)
                    cv.blob(x, y, rr * 3.2, tuple(DEEP), alpha=0.45 * min(1, t * 1.6), glowk=0.8, power=2.2)
                    cv.blob(x, y, rr * 2.0, tuple(VIO), alpha=0.7 * min(1, t * 1.6), glowk=1.0, power=1.8)
                    cv.blob(x, y, rr, tuple(mix(VIO, WHITE, 0.6)), alpha=0.95, glowk=1.4, power=1.2)
                    cv.blob(x, y, rr * 0.45, tuple(WHITE), alpha=1.0, glowk=1.0, power=1.0)
                if f >= 4:   # crackle from the muzzle back to the front coil
                    c = np.array(g[f'coil{b}-2.1']) * S
                    pts2 = jagged((x, y), c, rng, 0.22, 3)
                    for p, q in zip(pts2[:-1], pts2[1:]):
                        cv.streak(p[0], p[1], q[0], q[1], 1.8, tuple(VIO), alpha=0.5, glowk=0.6, taper=False)
                        cv.streak(p[0], p[1], q[0], q[1], 0.6, tuple(WHITE), alpha=0.9, glowk=0.4, taper=False)
            else:
                # discharge: a violet-white star flash bursting forward out of the muzzle
                L = 1.6 * max(unit, 18)
                cv.blob(x + dd[0] * L * 0.2, y + dd[1] * L * 0.2, L * 0.75, tuple(VIO), alpha=0.6, glowk=1.0, power=2.0)
                for ang, l, wd in [(0, 1.0, 0.34), (0.5, 0.6, 0.18), (-0.5, 0.6, 0.18), (1.4, 0.45, 0.14), (-1.4, 0.45, 0.14)]:
                    ca, sa = math.cos(ang), math.sin(ang); e = (dd[0] * ca - dd[1] * sa, dd[0] * sa + dd[1] * ca)
                    cv.streak(x + e[0] * l * L, y + e[1] * l * L, x, y, wd * L, tuple(mix(VIO, WHITE, 0.55)), alpha=1.0, glowk=1.2)
                cv.blob(x, y, L * 0.32, tuple(WHITE), alpha=1.0, glowk=1.6, power=1.0)
        frames.append(cv.finish(bloom=(4, 12), bloomk=(0.7, 0.5)))
    sheet(frames, 4).save(f'{O}turret-charge-{k}.png')
    ang = math.degrees(math.atan2(dirs[0][1], dirs[0][0]))
    return {'tip0': [round(float(v), 1) for v in tips[0]], 'tip1': [round(float(v), 1) for v in tips[1]], 'mid': [round(float(v), 1) for v in (tips[0] + tips[1]) / 2],
            'barrel_angle_deg': round(float(ang), 2)}, frames

def laser():
    W, H = 512, 64
    frames = []
    widths = [0.75, 1.0, 0.95, 0.72, 0.45, 0.22]; alphas = [1, 1, 1, 0.92, 0.75, 0.45]
    rng = np.random.default_rng(5)
    for f in range(6):
        s = widths[f]; A = alphas[f]
        ss = 2; yy, xx = np.mgrid[0:H * ss, 0:W * ss].astype(np.float32) / ss
        y = yy - H / 2 + 0.25
        # gentle energy ripple along the beam (survives stretching) and two thin spiral filaments
        ph = rng.uniform(0, 6.28)
        rip = 0.88 + 0.12 * np.sin(xx / 512 * 2 * math.pi * 5 + ph)
        core = np.exp(-(y / (2.2 * s)) ** 2)
        inner = np.exp(-(y / (5.5 * s)) ** 2)
        outer = np.exp(-(y / (13.0 * s)) ** 2)
        fil = 0
        for sgn in (-1, 1):
            yc = sgn * 5.5 * s * np.sin(xx / 512 * 2 * math.pi * 7 + ph + sgn)
            fil = fil + np.exp(-((y - yc) / (0.9 * max(s, 0.5))) ** 2) * 0.7
        em = (WHITE[None, None] * (core * 1.0 + fil * 0.25)[..., None] + mix(VIO, WHITE, 0.25)[None, None] * (inner * 0.9 * rip + fil * 0.6)[..., None]
              + DEEP[None, None] * (outer * 0.55)[..., None])
        alpha = np.clip(core + inner * 0.95 + outer * 0.6 + fil * 0.5, 0, 1) * A
        prem = np.clip(em * A, 0, None)
        prem = np.minimum(prem, alpha[..., None] * 1.0 + 1e-6)
        # downsample
        prem = prem.reshape(H, ss, W, ss, 3).mean((1, 3)); al = alpha.reshape(H, ss, W, ss).mean((1, 3))
        c = np.where(al[..., None] > 1e-4, prem / np.maximum(al, 1e-4)[..., None], 0)
        frames.append((np.concatenate([np.clip(c, 0, 1), al[..., None]], -1) * 255 + 0.5).astype(np.uint8))
    sheet(frames, 1).save(f'{O}fx-pulse-laser.png')
    return frames

def hit():
    rng = np.random.default_rng(9); frames = []
    for f in range(6):
        t = f / 5; cv = Canvas(128, 128, 2); c = 64
        ring = 10 + 46 * smooth(0, 1, t)
        if f <= 3:
            cv.blob(c, c, 34 * (1 - 0.5 * t) + 6, tuple(VIO), alpha=0.8 * (1 - t), glowk=1.1, power=2.0)
            cv.blob(c, c, 15 * (1 - t) + 3, tuple(WHITE), alpha=1 - 0.6 * t, glowk=1.5, power=1.1)
        # expanding thin shock ring
        n = 48
        for i in range(n):
            a0, a1 = i / n * 2 * math.pi, (i + 1) / n * 2 * math.pi
            cv.streak(c + math.cos(a0) * ring, c + math.sin(a0) * ring * 0.8, c + math.cos(a1) * ring, c + math.sin(a1) * ring * 0.8,
                      1.6 * (1 - t) + 0.4, tuple(mix(VIO, WHITE, 0.3)), alpha=0.85 * (1 - t) ** 1.2, glowk=0.7, taper=False)
        for i in range(12):
            ang = rng.uniform(0, 2 * math.pi); r0 = 6 + 40 * t * rng.uniform(0.6, 1.0); l = 6 + 8 * (1 - t)
            p0 = (c + math.cos(ang) * r0, c + math.sin(ang) * r0 * 0.8); p1 = (p0[0] + math.cos(ang) * l, p0[1] + math.sin(ang) * l * 0.8)
            cv.streak(p1[0], p1[1], p0[0], p0[1], 1.0, tuple(mix(VIO, WHITE, 0.5)), alpha=1 - t ** 1.5, glowk=0.9)
        frames.append(cv.finish(bloom=(3, 8), bloomk=(0.7, 0.4)))
    sheet(frames, 6).save(f'{O}fx-pulse-hit.png')
    return frames

if __name__ == '__main__':
    meta = {}
    for k in range(16):
        m, _ = charge_frames(k); meta[str(k)] = m; print('charge', k)
    json.dump({'note': 'Pixel positions in the 512 x 512 turret canvas (same canvas as turret-head-K). Beams start at tip0 and tip1.',
               'directions': meta}, open(f'{O}pulse-muzzles.json', 'w'), indent=1)
    laser(); hit(); print('done')
