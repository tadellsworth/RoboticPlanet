"""Finish a time-of-day set: crawler d0/d3/base, turret head names, light-pool sprite.  usage: tod_post.py <tod>"""
import sys, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage
tod = sys.argv[1]
A = sys.argv[2]   # usage: tod_post.py <tod> <that time's art folder, e.g. art/tod/night>
GRADE = {'morning': ((1.0, 0.85, 0.79), (0.06, 0.05, 0.09)), 'evening': ((0.92, 0.64, 0.5), (0.01, 0, 0.02)), 'night': ((0.19, 0.23, 0.37), (0.008, 0.01, 0.025))}
m, add = [np.array(v, np.float32) for v in GRADE[tod]]
U = f'{A}/units'

# ---- crawler: d0 = f0, d3 gets the (graded) dust puffs at the pads, base = d9
for t in ('@0', '@1'):
    if os.path.exists(f'{U}/crawler{t}-f0.png'): shutil.copy(f'{U}/crawler{t}-f0.png', f'{U}/crawler-deploy{t}-d0.png')
    if os.path.exists(f'{U}/crawler-deploy{t}-d9.png'): shutil.copy(f'{U}/crawler-deploy{t}-d9.png', f'{U}/crawlerbase{t}.png')
N, W = 512, 20.0
P = lambda v: (v / W + 0.5) * N
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
def noise(seed, size):
    r = np.random.default_rng(seed).standard_normal((N, N)); f = np.fft.fft2(r)
    fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
    n = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 6))); return (n - n.mean()) / n.std()
HZ = 3.5
pads = []
for lx, s, dep in [(7.6, 1, 60), (7.6, -1, -60), (-7.6, 1, 120), (-7.6, -1, -120)]:
    th = np.radians(dep); pads.append((P(lx + 3.45 * np.cos(th)), P(s * HZ + 3.45 * np.sin(th))))
Dp = np.zeros((N, N), np.float32)
for k, (px, py) in enumerate(pads):
    rr = np.random.default_rng(20 + k)
    for j in range(9):
        a_ = j / 9 * 2 * np.pi + rr.uniform(-0.3, 0.3); rad = rr.uniform(14, 22)
        cx, cy = px + np.cos(a_) * rad, py + np.sin(a_) * rad
        Dp += 0.7 * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / rr.uniform(7, 11) ** 2))
n2 = noise(12, 3.0)
ap = (1 - np.exp(-Dp * 1.8 * (0.85 + 0.25 * n2))) * 0.78
gy, gx = np.gradient(Dp)
sh = np.clip(1 + 9.0 * (-(gx + gy)), 0.8, 1.2)[..., None]
pc = np.clip(np.clip(np.array([0.70, 0.50, 0.36], np.float32) * sh, 0, 1) * m + add, 0, 1)
for t in ('@0', '@1'):
    f = f'{U}/crawler-deploy{t}-d3.png'
    if not os.path.exists(f): continue
    b = np.asarray(Image.open(f).convert('RGBA')).astype(np.float32) / 255
    ba = b[..., 3:4]; la = ap[..., None]; oa = la + ba * (1 - la)
    oc = (pc * la + b[..., :3] * ba * (1 - la)) / np.maximum(oa, 1e-4)
    Image.fromarray((np.concatenate([oc, oa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f)

# ---- turret heads: 16-direction set + the 8-direction set (= its even frames)
T16 = f'{A}/buildings/turret-16dir'
if os.path.isdir(T16):
    for fn in os.listdir(T16):
        if fn.startswith('turret16-'):
            k, t = fn[len('turret16-'):-4].split('@')
            os.replace(f'{T16}/{fn}', f'{T16}/turret-head-{k}@{t}.png')
    for k in range(0, 16, 2):
        for t in ('0', '1'):
            src = f'{T16}/turret-head-{k}@{t}.png'
            if os.path.exists(src): shutil.copy(src, f'{A}/buildings/turret-head-{k // 2}@{t}.png')
print('post done', tod)
