# Crawler overlays (512 px, 20 world units across): headlight pools + amber beacon glow, dust plume behind both treads,
# and the dust puffs at the four foot pads on deploy frame d3.
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
N, W = 512, 20.0
P = lambda v: (v / W + 0.5) * N
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
def save(rgb, a, n):
    a = np.clip(a, 0, 1); rgb = np.broadcast_to(np.asarray(rgb, np.float32), (N, N, 3)) if np.ndim(rgb) == 1 else rgb
    Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), a[..., None]], 2) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/{n}.png')
def noise(seed, size):
    r = np.random.default_rng(seed).standard_normal((N, N)); f = np.fft.fft2(r)
    fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
    n = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 6))); return (n - n.mean()) / n.std()

# ---- lights: two warm pools ahead of the cab running off the right edge, amber beacon halo on the cab roof
x0 = P(8.9)
a = np.zeros((N, N), np.float32)
for z in (-2.1, 2.1):
    cy = P(z); dx = xx - x0; dy = yy - cy
    ang = np.arctan2(dy, np.maximum(dx, 1e-3)) - np.sign(z) * 0.12
    cone = np.exp(-(ang / 0.42) ** 2) * (dx > -2)
    along = np.clip((dx + 2) / 6, 0, 1)
    a = np.maximum(a, 0.62 * cone * along * np.exp(-np.maximum(dx, 0) / 120))
warm = np.zeros((N, N, 3), np.float32) + np.array([1.0, 0.92, 0.72], np.float32)
bx, by = P(6.9), P(0.0)
r2 = ((xx - bx) ** 2 + (yy - by) ** 2)
halo = 0.85 * np.exp(-r2 / (2 * 9.0 ** 2)) + 0.35 * np.exp(-r2 / (2 * 22.0 ** 2))
amber = np.array([1.0, 0.62, 0.18], np.float32)
A = 1 - (1 - a) * (1 - halo)
col = (warm * a[..., None] + amber * halo[..., None]) / np.maximum(a + halo, 1e-4)[..., None]
save(col, A, 'crawler-lights')

# ---- dust plume: streaming back from the rear of both treads toward the left edge
D = np.zeros((N, N), np.float32)
rng = np.random.default_rng(3)
for zc in (-4.7, 4.7):
    cy0 = P(zc)
    for i in range(26):
        t = i / 25
        cx = P(-6.5) - t * (P(-6.5) + 10) + rng.uniform(-3, 3)
        cy = cy0 + np.sign(zc) * t * 26 + rng.uniform(-5, 5)
        r = 16 + 30 * t + rng.uniform(-3, 3)
        D += (0.75 - 0.35 * t) * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)))
n = noise(9, 9.0) * 0.8 + noise(10, 4.0) * 0.2
alpha = (1 - np.exp(-D * 1.6 * (0.85 + 0.25 * n))) * 0.72
alpha *= np.clip(xx / 18, 0, 1)
alpha *= 1 - 0.45 * np.clip((xx - P(-8.5)) / 60, 0, 1)
gy, gx = np.gradient(D)
shade = np.clip(1 + 9.0 * (-(gx + gy)), 0.8, 1.2)[..., None]
dust = np.clip(np.array([0.66, 0.46, 0.33], np.float32) * shade, 0, 1)
save(dust, alpha, 'crawler-dust')

# ---- d3: dust puffs bursting round the four foot pads, composited onto both teams' d3 frames
HZ = 3.35 + 0.15
pads = []
for lx, s, dep in [(7.6, 1, 60), (7.6, -1, -60), (-7.6, 1, 120), (-7.6, -1, -120)]:
    th = np.radians(dep); pads.append((P(lx + 3.45 * np.cos(th)), P(s * HZ + 3.45 * np.sin(th))))
Dp = np.zeros((N, N), np.float32)
for k, (px, py) in enumerate(pads):
    rr = np.random.default_rng(20 + k)
    for j in range(9):
        a_ = j / 9 * 2 * np.pi + rr.uniform(-0.3, 0.3)
        rad = rr.uniform(14, 22)
        cx, cy = px + np.cos(a_) * rad, py + np.sin(a_) * rad
        Dp += 0.7 * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / rr.uniform(7, 11) ** 2))
n2 = noise(12, 3.0)
ap = (1 - np.exp(-Dp * 1.8 * (0.85 + 0.25 * n2))) * 0.78
gy, gx = np.gradient(Dp)
sh = np.clip(1 + 9.0 * (-(gx + gy)), 0.8, 1.2)[..., None]
pc = np.clip(np.array([0.70, 0.50, 0.36], np.float32) * sh, 0, 1)
for t in (0, 1):
    b = np.asarray(Image.open(f'{src}/crawler-deploy@{t}-d3.png').convert('RGBA')).astype(np.float32) / 255
    ba = b[..., 3:4]; la = ap[..., None]
    oa = la + ba * (1 - la)
    oc = (pc * la + b[..., :3] * ba * (1 - la)) / np.maximum(oa, 1e-4)
    Image.fromarray((np.concatenate([oc, oa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/crawler-deploy@{t}-d3.png')
