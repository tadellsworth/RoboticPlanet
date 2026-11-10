"""Bloom + 2x downsample for any image size.  usage: compose2.py <dir> name ... [--b1 7] [--b2 22] [--glow 1] [--haze]
--haze: fade toward dark haze and transparency at the bottom (for piers plunging into the canyon)."""
import sys, numpy as np
from PIL import Image, ImageFilter
args = sys.argv[1:]
d = args[0]
opt = lambda k, v: float(args[args.index(k) + 1]) if k in args else v
BL1, BL2, K = opt('--b1', 7.0), opt('--b2', 22.0), opt('--glow', 1.0)
names = [a for i, a in enumerate(args[1:], 1) if not a.startswith('--') and not args[i - 1] in ('--b1', '--b2', '--glow')]
def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
for n in names:
    b = load(f'{d}/{n}.beauty.png'); g = load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = g[..., :3] * g[..., 3:4]
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    add = (0.9 * np.asarray(gimg.filter(ImageFilter.GaussianBlur(BL1))).astype(np.float32) / 255 +
           1.1 * np.asarray(gimg.filter(ImageFilter.GaussianBlur(BL2))).astype(np.float32) / 255) * K
    prem = np.clip(prem + add, 0, 1); a2 = np.clip(a + add.max(2, keepdims=True) * 0.95, 0, 1)
    out = np.concatenate([prem, a2], 2)
    H, W = out.shape[0] // 2, out.shape[1] // 2
    out = out.reshape(H, 2, W, 2, 4).mean(axis=(1, 3))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    alpha = out[..., 3:4]
    if '--haze' in args:
        t = (np.arange(H) / (H - 1))[:, None, None]
        s = np.clip((t - 0.3) / 0.65, 0, 1); s = s * s * (3 - 2 * s)
        rgb = rgb * (1 - 0.85 * s) + np.array([0.09, 0.07, 0.06]) * 0.85 * s
        f = np.clip((t - 0.72) / 0.28, 0, 1); alpha = alpha * (1 - f * f * (3 - 2 * f))
    Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), alpha], 2) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}.png')
print('composed', len(names))
