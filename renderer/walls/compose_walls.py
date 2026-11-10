"""Compose wall/gate renders: bloom from the glow pass, post-shadow correction for arms,
spark overlay frames (white-hot core + team-coloured halo), 1024 -> 512 downsample.

usage: python3 compose_walls.py <dir> <name> [<name> ...] [--post <post-name>] [--team #38d4ff] [--frames N]
"""
import sys
import numpy as np
from PIL import Image, ImageFilter

args = sys.argv[1:]
d = args[0]
opt = {}
names = []
i = 1
while i < len(args):
    if args[i].startswith('--'):
        opt[args[i][2:]] = args[i + 1]
        i += 2
    else:
        names.append(args[i])
        i += 1
team = np.array([int(opt.get('team', '#38d4ff')[k:k + 2], 16) for k in (1, 3, 5)], np.float32) / 255
nframes = int(opt.get('frames', 0))


def load(p):
    return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255


def blur(rgb, r):
    im = Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255


def down(prem_rgba):
    o = prem_rgba.reshape(512, 2, 512, 2, 4).mean(axis=(1, 3))
    rgb = np.where(o[..., 3:4] > 1e-4, o[..., :3] / np.maximum(o[..., 3:4], 1e-4), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), o[..., 3:4]], 2) * 255 + 0.5).astype(np.uint8), 'RGBA')


post_shadow = None
if 'post' in opt:
    pb = load(f"{d}/{opt['post']}.beauty.png")
    ps = load(f"{d}/{opt['post']}.solid.png")[..., 3]
    post_shadow = pb[..., 3] * (1 - ps)          # shadow/AO alpha the post lays on bare ground

for n in names:
    b = load(f'{d}/{n}.beauty.png')
    g = load(f'{d}/{n}.glow.png')
    solid = load(f'{d}/{n}.solid.png')[..., 3]
    a = b[..., 3].copy()
    if post_shadow is not None and not n.startswith(opt['post']):
        # ground shadow of this arm, minus what the (always present) post already darkens: no double shadows
        sh = a * (1 - solid)
        sh2 = np.clip((np.maximum(sh, post_shadow) - post_shadow) / np.maximum(1 - post_shadow, 1e-3), 0, 1)
        a = solid + (1 - solid) * sh2
        a = np.maximum(a, solid)
    prem = b[..., :3] * b[..., 3:4] * (a / np.maximum(b[..., 3], 1e-4))[..., None]
    gl = g[..., :3] * g[..., 3:4]
    add = 0.9 * blur(gl, 7) + 1.1 * blur(gl, 22)
    prem = np.clip(prem + add, 0, 1)
    a2 = np.clip(a[..., None] + add.max(2, keepdims=True) * 0.95, 0, 1)
    down(np.concatenate([prem, a2], 2)).save(f'{d}/{n}.png')
    for f in range(nframes):
        try:
            s = load(f'{d}/{n}.spark-f{f}.png')
        except FileNotFoundError:
            break
        core = s[..., :3] * s[..., 3:4]
        ca = s[..., 3:4]
        lum = ca[..., 0]
        halo = (0.8 * blur(np.repeat(lum[..., None], 3, 2), 4)[..., :1] + 1.0 * blur(np.repeat(lum[..., None], 3, 2), 14)[..., :1]) * team
        halo = np.clip(halo * 1.6, 0, 1)
        prem_s = np.clip(core + halo * (1 - ca), 0, 1)
        a_s = np.clip(ca + halo.max(2, keepdims=True) * (1 - ca), 0, 1)
        down(np.concatenate([prem_s, a_s], 2)).save(f'{d}/{n}.spark-{f}.png')
print('composed', names)
