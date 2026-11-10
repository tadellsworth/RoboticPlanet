# Adds the soft red ground spill behind the Road Train tractor's brake lenses (256 px, 10 world units across).
import sys, numpy as np
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
N = 256
P = lambda v: (v / 10 + 0.5) * N
yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
b = np.asarray(Image.open(f'{src}/roadtrain-brake.png').convert('RGBA')).astype(np.float32) / 255
xr = P(-4.4)
a = np.zeros((N, N), np.float32)
for z in (-1.28, 1.28):
    cy = P(z); cx = xr - 2.5
    d = ((xx - cx) / 13) ** 2 + ((yy - cy) / 10.5) ** 2
    a = np.maximum(a, 0.5 * np.exp(-d * 1.6) * (xx < xr + 4))
a *= np.clip(xx / 4, 0, 1)
ba = b[..., 3:4]; la = a[..., None]
oa = ba + la * (1 - ba)
oc = (b[..., :3] * ba + np.array([1.0, 0.16, 0.1], np.float32) * la * (1 - ba)) / np.maximum(oa, 1e-4)
Image.fromarray((np.concatenate([oc, oa], 2).clip(0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{out}/roadtrain-brake.png')
