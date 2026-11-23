"""Passenger Town's buildings (b/town.js) into the game's art folder, from the renders tools/render_town.sh makes.
Run from renderer/:
    python3 tools/install_town.py jobs [kind ...]     the render jobs (tools/render_town.sh runs them)
    python3 tools/install_town.py [<game>/art]        install: art/town/*.webp and art/town/town-art.js
    python3 tools/install_town.py --sheet <out.png>   a review sheet of every lot, day, night and stripped

Every lot in tools/town_footprints.json (kind and size, as townSetup lays them) has its sprites, in VARIANTS(lot) looks
(three for the commonest, two for the common ones, one for the rare):
  town/<kind>-<w>x<h>-<v>.webp       by day (lights off)
  town/<...>-n.webp                  at night: the lights on automatic, and the town's own lift (NIGHT_LIFT of the day
                                     render added, so its roofs read: brighter than the shared very dark night)
  town/<...>-1-s1.webp, -s2.webp     being stripped (scaffold; then only the frame), by day, the lot's first look only:
                                     the game grades them at night (their lights are cut)
  town/<...>-sh.webp                 the shadow alone (black, its alpha the shadow), PPT_SH px a tile: drawn with the ground
Each is bloomed from its glow pass and taken down 2x (as post/town_compose.py), cropped to what shows and shipped at
PPT px a tile (PPT_RARE for a rare lot; the stripped looks at PPT_S): an entry's `p` when it isn't PPT.
town-art.js (window.TOWN_ART) lists them with their marks in the cropped sprite's pixels: fl (the lot's front-left
corner on the ground: the game puts it on the lot's), roof and roofG (the sentry's post and the ground under it), mast
(a tower's red light), beacon (the civic tower's), and at night flick (a few lit windows the game lets falter).
Morning and evening are made in the game from day and night (a crossfade and the time of day's grade).
"""
import json
import os
import zlib
import sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('OUT', os.path.join(ROOT, 'out', 'town'))
LOTS = json.load(open(os.path.join(ROOT, 'tools', 'town_footprints.json')))
NIGHT_LIFT = 0.13           # the share of the day render added to the night one (the town's night is lifted a little)
Q, QS = 74, 64              # WebP quality: day and night; stripped
PPT, PPT_RARE, PPT_S, PPT_SH = 96, 72, 64, 16  # px a tile shipped: day and night; the same for a rare lot (under
# RARE of the town's buildings: the civic halls and schools, long arcades); stripped (one look a lot); shadows
RARE = 0.001
NO_STRIP = ('arcade', 'car')  # (these come down without a stripped look)
PARTIAL = '--partial' in sys.argv  # (install what has been rendered so far: for a look at it while the rest renders)


def VARIANTS(lot):
    if (lot['k'], lot['w'], lot['h']) in (('house', 2, 2), ('car', 1, 1)): return 3
    return 2 if lot['share'] >= 0.003 else 1


def names():
    for lot in LOTS:
        k, w, h = lot['k'], lot['w'], lot['h']
        for v in range(1, VARIANTS(lot) + 1):
            base = f'{k}-{w}x{h}-{v}', f'k={k}&w={w}&h={h}&v={v}'
            yield lot, v, base[0], base[1]


def load(p): return np.asarray(Image.open(p).convert('RGBA')).astype(np.float32) / 255


def half(a):
    h, w = a.shape[0] // 2, a.shape[1] // 2
    return a[:h * 2, :w * 2].reshape(h, 2, w, 2, a.shape[2]).mean(axis=(1, 3))


def compose(n):
    """Premultiplied RGBA at 128 px a tile (bloomed, halved), the marks in its pixels, and the glow pass (halved)."""
    b = load(f'{OUT}/{n}.beauty.png'); g = load(f'{OUT}/{n}.glow.png')
    a = b[..., 3:4]; prem = b[..., :3] * a
    gl = g[..., :3] * g[..., 3:4]
    gimg = Image.fromarray((gl * 255).astype(np.uint8))
    b1 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(2.6))).astype(np.float32) / 255
    b2 = np.asarray(gimg.filter(ImageFilter.GaussianBlur(8.5))).astype(np.float32) / 255
    add = 0.9 * b1 + 1.1 * b2
    prem = np.clip(prem + add, 0, 1)
    a2 = np.clip(a + add.max(axis=2, keepdims=True) * 0.95, 0, 1)
    out = half(np.concatenate([prem, a2], axis=2))
    geo = json.load(open(f'{OUT}/{n}.geom.json'))
    H, W = out.shape[:2]
    marks = {m: [geo['marks'][m][0] * W, geo['marks'][m][1] * H] for m in geo['marks']}
    return out, marks, half(gl)


def unprem(p):
    rgb = np.where(p[..., 3:4] > 1e-4, p[..., :3] / np.maximum(p[..., 3:4], 1e-4), 0)
    return Image.fromarray((np.concatenate([np.clip(rgb, 0, 1), p[..., 3:4]], axis=2) * 255 + 0.5).astype(np.uint8), 'RGBA')


def crop_box(alpha, pad=2):
    ys, xs = np.nonzero(alpha > 2 / 255)
    if not len(xs): return 0, 0, 4, 4
    H, W = alpha.shape
    return max(0, xs.min() - pad), max(0, ys.min() - pad), min(W, xs.max() + 1 + pad), min(H, ys.max() + 1 + pad)


def shift(marks, x0, y0):
    return {m: [round(v[0] - x0, 1), round(v[1] - y0, 1)] for m, v in marks.items()}


def flickers(gl, x0, y0, seed, n=3):
    """A few lit windows (window-sized patches of the glow pass) the game lets falter at night: [x, y, w, h]."""
    from scipy import ndimage
    lum = gl.max(axis=2)
    lab, k = ndimage.label(lum > 0.35)
    if not k: return []
    sl = ndimage.find_objects(lab)
    cand = []
    for s in sl:
        h, w = s[0].stop - s[0].start, s[1].stop - s[1].start
        if 3 <= w <= 9 and 3 <= h <= 10: cand.append([s[1].start - x0, s[0].start - y0, w, h])
    rng = np.random.default_rng(seed)
    rng.shuffle(cand)
    return [[int(v) for v in c] for c in cand[:n]]


def save(img, path, q):
    img.save(path, 'WEBP', quality=q, method=6, alpha_quality=80)
    return os.path.getsize(path)


def shadow_of(n, fl, dest):
    """The shadow pass at PPT_SH px a tile, cropped; its own lot corner mark."""
    s = load(f'{OUT}/{n}.shadow.png')[..., 3]
    H, W = s.shape
    f = 256 // PPT_SH  # (the pass is at 256 px a tile)
    q = Image.fromarray((s * 255).astype(np.uint8)).resize((W // f, H // f), Image.LANCZOS)
    a = np.asarray(q)
    x0, y0, x1, y1 = crop_box(a, 1)
    a = a[y0:y1, x0:x1]
    img = Image.fromarray(np.dstack([np.zeros_like(a)] * 3 + [a]), 'RGBA')
    size = save(img, dest, 80)
    g = 128 / PPT_SH
    return {'size': [img.width, img.height], 'fl': [round(fl[0] / g - x0, 1), round(fl[1] / g - y0, 1)]}, size


def finish(p, marks, ppt):
    """A composed render (128 px a tile) cropped to what shows and taken to ppt px a tile; its marks to match."""
    x0, y0, x1, y1 = crop_box(p[..., 3])
    img = unprem(p[y0:y1, x0:x1])
    f = ppt / 128
    if f != 1: img = img.resize((max(1, round(img.width * f)), max(1, round(img.height * f))), Image.LANCZOS)
    m = {k: [round((v[0] - x0) * f, 1), round((v[1] - y0) * f, 1)] for k, v in marks.items()}
    return img, m, (x0, y0, f)


def install(art):
    dst = os.path.join(art, 'town')
    os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst): os.remove(os.path.join(dst, f))
    index, total = {}, 0
    for lot, v, base, _ in names():
        key = f"{lot['k']}-{lot['w']}x{lot['h']}"
        need = [base, base + '-n'] + ([] if lot['k'] in NO_STRIP or v > 1 else [base + '-s1', base + '-s2'])
        if PARTIAL and not all(os.path.exists(f'{OUT}/{n}.shadow.png') for n in need): continue
        day, dm, _ = compose(base)
        night, nm, ngl = compose(base + '-n')
        # the night lift: a share of the day render added, aligned on the lot's corner (the two canvases differ: the
        # moon throws its shadow another way)
        dx, dy = round((nm['lotFL'][0] - dm['lotFL'][0])), round((nm['lotFL'][1] - dm['lotFL'][1]))
        H, W = night.shape[:2]
        sh = np.zeros_like(night)
        ys0, xs0 = max(0, dy), max(0, dx)
        ys1, xs1 = min(H, day.shape[0] + dy), min(W, day.shape[1] + dx)
        sh[ys0:ys1, xs0:xs1] = day[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
        night[..., :3] = np.clip(night[..., :3] + NIGHT_LIFT * sh[..., :3] * night[..., 3:4], 0, 1)
        e = {'v': v}
        for tag, p, marks, q in (('d', day, dm, Q), ('n', night, nm, Q)):
            ppt = PPT if lot['share'] >= RARE else PPT_RARE
            img, m, (x0, y0, f) = finish(p, marks, ppt)
            total += save(img, os.path.join(dst, f"{base}{'' if tag == 'd' else '-n'}.webp"), q)
            e[tag] = {**({} if ppt == PPT else {'p': ppt}), 'size': [img.width, img.height], 'fl': m['lotFL'], 'roof': m['roof'], 'roofG': m['roofG'], **{k: m[k] for k in ('mast', 'beacon') if k in m}}
            if tag == 'n': e[tag]['flick'] = [[round(a * f, 1) for a in w] for w in flickers(ngl, x0, y0, zlib.crc32(base.encode()) % 9973)]
        e['sh'], sz = shadow_of(base, dm['lotFL'], os.path.join(dst, f'{base}-sh.webp')); total += sz
        if lot['k'] not in NO_STRIP:  # (stripped: the lot's first look, whichever look it was: scaffold covers the change)
            for s in (1, 2):
                first = f"{key}-1"
                if v == 1:
                    p, marks, _ = compose(f'{base}-s{s}')
                    img, m, _ = finish(p, marks, PPT_S)
                    total += save(img, os.path.join(dst, f'{base}-s{s}.webp'), QS)
                    e[f's{s}'] = {'src': f'{base}-s{s}', 'p': PPT_S, 'size': [img.width, img.height], 'fl': m['lotFL'], 'roof': m['roof'], 'roofG': m['roofG']}
                else: e[f's{s}'] = index[key][0][f's{s}']
        index.setdefault(key, []).append(e)
        print(base, end='  ', flush=True)
    js = ('// Passenger Town\'s buildings (renderer/b/town.js; made by renderer/tools/install_town.py, do not edit): every lot\'s\n'
          '// sprites and their marks, in the sprite\'s pixels at `ppt` a tile. Loaded only for a Passenger Town map (js/city.js).\n'
          'window.TOWN_ART = ' + json.dumps({'ppt': PPT, 'sh': PPT_SH, 'lots': index}, separators=(',', ':')).replace('],"', '],\n"') + ';\n')
    open(os.path.join(dst, 'town-art.js'), 'w').write(js)
    total += len(js)
    print(f'\ninstalled {sum(len(v) for v in index.values())} looks of {len(index)} lots: {total / 1e6:.2f} MB')


def sheet(out):
    from PIL import ImageDraw
    art = os.path.join(ROOT, '..', 'art', 'town')
    src = open(os.path.join(art, 'town-art.js')).read()
    idx = json.loads(src[src.index('{'):src.rindex('}') + 1])
    tiles = []
    for key, looks in idx['lots'].items():
        for e in looks:
            row = []
            for suf in ('', '-n', '-s1', '-s2'):
                p = os.path.join(art, f"{key}-{e['v']}{suf}.webp")
                if os.path.exists(p): row.append(Image.open(p).convert('RGBA'))
            tiles.append((f"{key}-{e['v']}", row))
    S = 0.35
    tiles = [(n, [im.resize((max(1, round(im.width * S)), max(1, round(im.height * S)))) for im in row]) for n, row in tiles]
    W = 2400
    x = y = rowh = 0
    pos = []
    for n, row in tiles:
        w = sum(im.width + 4 for im in row) + 10
        h = max(im.height for im in row) + 16
        if x + w > W: x, y, rowh = 0, y + rowh, 0
        pos.append((x, y, n, row)); x += w; rowh = max(rowh, h)
    img = Image.new('RGB', (W, y + rowh), (58, 60, 64)); d = ImageDraw.Draw(img)
    for x, y, n, row in pos:
        d.text((x + 2, y + 2), n, fill=(230, 225, 210))
        xx = x
        for im in row: img.paste(im, (xx, y + 14), im); xx += im.width + 4
    img.save(out); print('wrote', out, img.size)


if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'jobs':
        only = a[1:]
        for lot, v, base, q in names():
            if only and lot['k'] not in only: continue
            print(f'town:::{base}:{q}')
            print(f'town:::{base}-n:{q}&tod=night')
            if lot['k'] not in NO_STRIP and v == 1:
                for s in (1, 2): print(f'town:::{base}-s{s}:{q}&strip={s}')
    elif a and a[0] == '--sheet': sheet(a[1])
    else:
        a = [x for x in a if x != '--partial']
        install(a[0] if a else os.path.join(ROOT, '..', 'art'))
