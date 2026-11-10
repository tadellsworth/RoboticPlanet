# Freight loco overlays (256 px, 10 world units across): headlight beams, brake glow, exhaust wisp.
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
N = 256
P = lambda v: (v / 10 + 0.5) * N
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)

def load(n): return np.asarray(Image.open(f'{src}/{n}.png').convert('RGBA')).astype(np.float32) / 255
def under(b, rgb, a):
    ba = b[..., 3:4]; la = a[..., None]; oa = ba + la * (1 - ba)
    oc = (b[..., :3] * ba + np.array(rgb, np.float32) * la * (1 - ba)) / np.maximum(oa, 1e-4)
    return np.concatenate([oc, oa], 2)
def save(a, n): Image.fromarray((a.clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/{n}.png')
def noise(seed, size):
    r = np.random.default_rng(seed).standard_normal((N, N)); f = np.fft.fft2(r)
    fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
    n = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 6))); return (n - n.mean()) / n.std()

# ---- headlights: two soft warm beams fanning out ahead of the nose, running off the right edge
b = load('freight-loco-heads')
x0 = P(3.8)
a = np.zeros((N, N), np.float32)
for z in (-0.85, 0.85):
    cy = P(z); dx = xx - x0; dy = yy - cy
    ang = np.arctan2(dy, np.maximum(dx, 1e-3)) - np.sign(z) * 0.06
    cone = np.exp(-(ang / 0.2) ** 2) * (dx > 0)
    along = np.clip(dx / 4, 0, 1) * np.exp(-dx / 70)
    a = np.maximum(a, 0.6 * cone * along)
    a = np.maximum(a, 0.5 * np.exp(-(((xx - x0 - 2) / 5) ** 2 + ((yy - cy) / 4) ** 2)))
save(under(b, (1.0, 0.95, 0.8), a), 'freight-loco-lights')

# ---- brake: red lenses with a faint glow on the ground behind
b = load('freight-loco-brake')
xr = P(-3.85)
a = np.zeros((N, N), np.float32)
for z in (-1.3, 1.3):
    cy = P(z); cx = xr - 3
    d = ((xx - cx) / 12) ** 2 + ((yy - cy) / 9) ** 2
    a = np.maximum(a, 0.5 * np.exp(-d * 1.6) * (xx < xr + 5))
a *= np.clip(xx / 4, 0, 1)
save(under(b, (1.0, 0.16, 0.1), a), 'freight-loco-brake')

# ---- exhaust: heat shimmer over the hatch and a thin smoke wisp drifting toward the bottom-right
hx, hy = P(0.0), P(0.0)
D = np.zeros((N, N), np.float32)
rng = np.random.default_rng(11)
for i in range(16):
    t = i / 15
    cx = hx + t * 62 + 6 * np.sin(t * 5.0) + rng.uniform(-1.5, 1.5)
    cy = hy + t * 46 + 4 * np.cos(t * 4.0) + rng.uniform(-1.5, 1.5)
    r = 4 + 13 * t
    D += (0.9 - 0.75 * t) * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (r * r)))
n = noise(5, 3.0) * 0.8 + noise(6, 1.5) * 0.2
alpha = (1 - np.exp(-D * 2.4 * (0.8 + 0.3 * n))) * 0.72
gy, gx = np.gradient(D)
shade = np.clip(1 + 5.0 * (-(gx + gy)), 0.85, 1.15)[..., None]
far = np.clip(((xx - hx) + (yy - hy)) / 110, 0, 1)[..., None]
smoke = np.clip((np.array([0.27, 0.26, 0.25], np.float32) * (1 - far) + np.array([0.52, 0.5, 0.48], np.float32) * far) * shade, 0, 1)
shim = 0.16 * np.exp(-(((xx - hx) / 9) ** 2 + ((yy - hy) / 7) ** 2)) * (0.6 + 0.4 * np.sin((xx + yy) * 0.9 + n * 2))
alpha = np.maximum(alpha, shim)
col = smoke * (1 - (shim / 0.16)[..., None] * 0.0) + np.array([1.0, 0.92, 0.8], np.float32) * 0
out_a = np.concatenate([np.where(shim[..., None] > alpha[..., None] * 0.99, np.array([0.95, 0.9, 0.82], np.float32), smoke), alpha[..., None]], 2)
save(out_a, 'freight-loco-exhaust')
