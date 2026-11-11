# Robot brake / boost overlays (256 px, same framing as each robot).
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
N = 256
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
CFG = {  # brake lens centres and dust sources (rear end of each track / rear wheel) in frame pixels
  'worker':  {'brake': [(32, 81.5), (32, 174.5)],     'dust': [(33, 62), (33, 194)]},
  'hauler':  {'brake': [(17, 92), (17, 164)],         'dust': [(27, 69), (27, 187)]},
  'agribot': {'brake': [(41, 98), (41, 158)],         'dust': [(39, 54), (39, 202)]},
  'paver':   {'brake': [(23.5, 83), (23.5, 173)],     'dust': [(44, 67), (44, 189)]},
  'warbot':  {'brake': [(12.5, 101.5), (12.5, 154.5)], 'dust': [(28, 68), (28, 188)]},
}
def noise(seed, size):
    r = np.random.default_rng(seed).standard_normal((N, N)); f = np.fft.fft2(r)
    fy = np.fft.fftfreq(N)[:, None]; fx = np.fft.fftfreq(N)[None, :]
    n = np.real(np.fft.ifft2(f * np.exp(-(fx ** 2 + fy ** 2) * size ** 2 * 6))); return (n - n.mean()) / n.std()
def under(img, rgb, a):
    b = np.asarray(img).astype(np.float32) / 255 if img is not None else np.zeros((N, N, 4), np.float32)
    ba = b[..., 3:4]; la = a[..., None]
    oa = ba + la * (1 - ba); oc = (b[..., :3] * ba + np.asarray(rgb, np.float32) * la * (1 - ba)) / np.maximum(oa, 1e-4)
    return Image.fromarray((np.concatenate([oc, oa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA')
for r, c in CFG.items():
    # brake: the lit lenses from the render, with a faint red glow on the ground just behind each
    a = np.zeros((N, N), np.float32)
    for x, y in c['brake']:
        a = np.maximum(a, 0.5 * np.exp(-(((xx - (x - 6)) / 11) ** 2 + ((yy - y) / 9) ** 2) * 1.5) * (xx < x + 3))
    a *= np.clip((xx - 1) / 5, 0, 1)
    under(Image.open(f'{src}/{r}-brake.png'), (1.0, 0.16, 0.1), a).save(f'{out}/{r}-brake.png')
    # boost: a small puff of pale orange-brown dust behind the tracks / wheels, trailing off to the left
    D = np.zeros((N, N), np.float32); rng = np.random.default_rng(len(r))
    for x0, y0 in c['dust']:
        side = -1 if y0 < 128 else 1
        for i in range(14):
            t = i / 13
            cx = x0 + 4 - t * (x0 - 2) + rng.uniform(-1.5, 1.5)
            cy = y0 + side * (t * 9 + rng.uniform(-2, 2))
            rad = 6 + 8 * t + rng.uniform(-1, 1)
            D += (0.8 - 0.5 * t) * np.exp(-(((xx - cx) ** 2 + (yy - cy) ** 2) / (rad * rad)))
    gy, gx = np.gradient(D)
    n = noise(len(r) + 3, 4.0)
    alpha = (1 - np.exp(-D * 1.9 * (0.85 + 0.2 * n))) * 0.8
    alpha *= np.clip((xx - 1) / 8, 0, 1)
    shade = np.clip(1 + 4.0 * (-(gx + gy)), 0.82, 1.18)[..., None]
    dust = np.clip(np.array([0.84, 0.69, 0.52], np.float32) * shade, 0, 1)
    b = np.concatenate([dust, alpha[..., None]], 2)
    Image.fromarray((b.clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/{r}-boost.png')
print('ok')
