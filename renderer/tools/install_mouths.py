# Half underground's cave mouths: finish the renders of b/cavemouth.js and install them in the game.
# usage: python3 tools/install_mouths.py <renderDir> <concept> <gameArtDir>
#   reads <c>-<face>-<part>.beauty/glow.png for face s and n, parts floor, rock, lip, key, glow (the night 'all' pass)
#   writes <gameArtDir>/biomes/hollow/mouth-<layer>-<face>.webp, each cropped to what it holds, and prints the crop table
#   for js/mouths.js (MOUTH_ART: x and y of the crop in the 64 px a tile frame).
import sys, json, numpy as np
from PIL import Image, ImageFilter

src, concept, art = sys.argv[1], sys.argv[2], sys.argv[3]

def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255

def down(rgba):
    """Premultiplied 2x2 average, back to straight alpha."""
    a = rgba[..., 3:4]; prem = np.concatenate([rgba[..., :3] * a, a], axis=2)
    H, W = prem.shape[0] // 2, prem.shape[1] // 2
    out = prem[:H * 2, :W * 2].reshape(H, 2, W, 2, 4).mean(axis=(1, 3))
    rgb = np.where(out[..., 3:4] > 1e-4, out[..., :3] / np.maximum(out[..., 3:4], 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), out[..., 3:4]], axis=2)

def glow(g, b1=4.0, b2=13.0, k=1.0):
    """The glow pass bloomed, as light to add (transparent where dark): colour / alpha with alpha the brightest channel."""
    gl = g[..., :3] * g[..., 3:4]
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    a1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(b1))).astype(np.float32) / 255
    a2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(b2))).astype(np.float32) / 255
    add = np.clip(gl * 0.8 + (0.9 * a1 + 1.1 * a2) * k, 0, 1)
    al = add.max(axis=2, keepdims=True)
    rgb = np.where(al > 1e-4, add / np.maximum(al, 1e-4), 0)
    out = np.concatenate([rgb, al], axis=2)
    H, W = out.shape[0] // 2, out.shape[1] // 2
    prem = np.concatenate([out[..., :3] * out[..., 3:4], out[..., 3:4]], axis=2)[:H * 2, :W * 2].reshape(H, 2, W, 2, 4).mean(axis=(1, 3))
    rgb = np.where(prem[..., 3:4] > 1e-4, prem[..., :3] / np.maximum(prem[..., 3:4], 1e-4), 0)
    return np.concatenate([np.clip(rgb, 0, 1), prem[..., 3:4]], axis=2)

def save(img, name):
    a = img[..., 3]
    ys, xs = np.where(a > 2 / 255)
    if not len(xs): x0 = y0 = 0; x1 = y1 = 1
    else: x0, x1, y0, y1 = max(0, xs.min() - 2), min(img.shape[1], xs.max() + 3), max(0, ys.min() - 2), min(img.shape[0], ys.max() + 3)
    crop = img[y0:y1, x0:x1]
    Image.fromarray((crop * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{art}/biomes/hollow/{name}.webp', 'WEBP', quality=88, method=6)
    return [int(x0), int(y0)]

table = {}
for f in ['s', 'n']:
    p = lambda part, k='beauty': f'{src}/{concept}-{f}-{part}.{k}.png'
    for part in ['floor', 'rock', 'lip', 'key']:
        img = down(load(p(part)))
        if part == 'lip':
            # (the lip's ends tuck into the cheeks: faded over the last tile before each cheek's face, 8 and 22 tiles in)
            x = (np.arange(img.shape[1]) + 0.5) / 64
            ramp = np.clip(np.minimum(x - 7.0, 23.0 - x) / 1.1, 0, 1)
            img[..., 3] *= (ramp * ramp * (3 - 2 * ramp))[None, :]
        table[f'{part}-{f}'] = save(img, f'mouth-{part}-{f}')
    table[f'glow-{f}'] = save(glow(load(p('glow', 'glow'))), f'mouth-glow-{f}')
    table[f'keyglow-{f}'] = save(glow(load(p('key', 'glow'))), f'mouth-keyglow-{f}')
print(json.dumps(table))
