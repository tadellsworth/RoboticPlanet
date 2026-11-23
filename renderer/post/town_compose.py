# usage: python3 post/town_compose.py <dir> name [name ...] [--glow 1.0]
# Passenger Town concept sprites (b/town.js): the beauty pass with bloom from the glow pass, downsampled 2x in
# premultiplied space -> <name>.png; the shadow pass -> <name>-shadow.png (black, its alpha the shadow); the lot's
# corners in final pixels -> <name>.json. The bloom radii are the buildings' (7, 22) scaled to this set's 128 px a tile
# (the buildings' art has about 366 px a tile at 512).
import sys, json, numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
d = args[0]; names = [a for a in args[1:] if not a.startswith('--') and not a.replace('.', '').isdigit()]
k = float(args[args.index('--glow') + 1]) if '--glow' in args else 1.0
B1, B2 = 2.6, 8.5

def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255
def half(a):
    H2, W2 = a.shape[0] // 2, a.shape[1] // 2
    return a[:H2 * 2, :W2 * 2].reshape(H2, 2, W2, 2, a.shape[2]).mean(axis=(1, 3))

for n in names:
    b = load(f'{d}/{n}.beauty.png'); g = load(f'{d}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = g[..., :3] * g[..., 3:4]
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    b1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(B1))).astype(np.float32) / 255
    b2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(B2))).astype(np.float32) / 255
    add = (0.9 * b1 + 1.1 * b2) * k
    prem = np.clip(prem + add, 0, 1)
    a2 = np.clip(a + add.max(axis=2, keepdims=True) * 0.95, 0, 1)
    out = half(np.concatenate([prem, a2], axis=2))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], axis=2) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}.png')
    try:
        s = load(f'{d}/{n}.shadow.png'); sa = half(s[..., 3:4])
        Image.fromarray((np.concatenate([np.zeros_like(sa).repeat(3, 2), sa], axis=2) * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{d}/{n}-shadow.png')
    except FileNotFoundError: pass
    geo = json.load(open(f'{d}/{n}.geom.json'))
    W, H = out.shape[1], out.shape[0]
    json.dump({'size': [W, H], **{m: [round(geo['marks'][m][0] * W, 2), round(geo['marks'][m][1] * H, 2)] for m in geo['marks']}}, open(f'{d}/{n}.json', 'w'))
    print('composed', n, W, H)
