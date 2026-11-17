"""Mock-ups of the proposed Fiber and Oil resources, composed the way the game draws a map (js/render.js drawResource,
js/daynight.js): ground one texture per 4 x 4 tiles, the biome's scenery plants, the resources one tile across, the
night grade on all of it, then the glow maps. Nothing here is game code.

    python3 preview/resource_mock.py <outdir>     (run from renderer/, after b/resources.js, post/resource_post.py and
                                                   terrain/oil_seeps.py; TERRAFALL_ART=<game>/art if not ../art)
Writes, for each direction (fiber-0 / oil-0 are today's art) and biome:
    <res>-<k>-<biome>-<day|night>.png    a patch at game scale (48 px a tile)
    <res>-<k>-big-<day|night>.png        the Rust patch enlarged (128 px a tile)
    lineup-<biome>.png                   every resource and the biome's plants side by side at game scale
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.environ.get('TERRAFALL_ART', os.path.join(ROOT, '..', 'art'))
RES = os.path.join(ROOT, 'out', 'res')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'preview', 'res')
os.makedirs(OUT, exist_ok=True)
NIGHT_MUL = np.array([0.16, 0.2, 0.33], np.float32); NIGHT_ADD = np.array([0.006, 0.008, 0.022], np.float32)   # js/daynight.js
BIOMES = {  # key: (region name, ground, plant density as BIOMES in js/defs.js)
    'desert': ('The Rust', os.path.join(ART, 'tiles', 'ground.webp'), 0.07),
    'jungle': ('Greenreach', os.path.join(ART, 'biomes', 'jungle', 'ground.webp'), 0.44),
    'polar': ('Hoarfell', os.path.join(ART, 'biomes', 'polar', 'ground.webp'), 0.1),
    'volcanic': ('Cinderlands', os.path.join(ART, 'biomes', 'volcanic', 'ground.webp'), 0.1),
    'swamp': ('Blackwater', os.path.join(ART, 'biomes', 'swamp', 'ground.webp'), 0.38),
}
_c = {}


def load(p, size=None):
    k = (p, size)
    if k not in _c:
        im = Image.open(p).convert('RGBA')
        if size: im = im.resize(size, Image.LANCZOS)
        _c[k] = np.asarray(im).astype(np.float32) / 255
    return _c[k]


def grade(rgb):
    return np.clip(rgb * NIGHT_MUL + NIGHT_ADD, 0, 1)


class Canvas:
    def __init__(self, wt, ht, T):
        self.T, self.w, self.h = T, int(wt * T), int(ht * T)
        self.rgb = np.zeros((self.h, self.w, 3), np.float32)
        self.glow = np.zeros((self.h, self.w, 3), np.float32)       # light to add at night, over the graded picture

    def _place(self, s, x, y):
        x, y = int(round(x)), int(round(y)); sh, sw = s.shape[:2]
        x0, y0, x1, y1 = max(0, x), max(0, y), min(self.w, x + sw), min(self.h, y + sh)
        if x1 <= x0 or y1 <= y0: return None
        return x0, y0, x1, y1, s[y0 - y:y1 - y, x0 - x:x1 - x]

    def over(self, s, x, y, alpha=1.0, mask_glow=True):
        r = self._place(s, x, y)
        if not r: return
        x0, y0, x1, y1, ss = r
        a = ss[..., 3:4] * alpha
        self.rgb[y0:y1, x0:x1] = self.rgb[y0:y1, x0:x1] * (1 - a) + ss[..., :3] * a
        if mask_glow: self.glow[y0:y1, x0:x1] *= (1 - a)              # what stands in front hides the glow behind it

    def addglow(self, s, x, y, k=1.0):
        r = self._place(s, x, y)
        if not r: return
        x0, y0, x1, y1, ss = r
        self.glow[y0:y1, x0:x1] += ss[..., :3] * ss[..., 3:4] * k

    def sprite(self, path, tx, ty, scale=1.0, anchor=(0.5, 0.5), alpha=1.0, glow=None):
        px = max(2, int(round(scale * self.T)))
        x, y = tx * self.T - anchor[0] * px, ty * self.T - anchor[1] * px
        self.over(load(path, (px, px)), x, y, alpha)
        if glow and os.path.exists(glow): self.addglow(load(glow, (px, px)), x, y, alpha)

    def result(self, night):
        if not night: return self.rgb
        return np.clip(grade(self.rgb) + self.glow * 0.92, 0, 1)


def ground(cv, biome, night):
    _, gp, _ = BIOMES[biome]
    t = load(gp, (4 * cv.T, 4 * cv.T))[..., :3]
    cv.rgb[:] = np.tile(t, (cv.h // (4 * cv.T) + 1, cv.w // (4 * cv.T) + 1, 1))[:cv.h, :cv.w]
    gg = os.path.join(ART, 'biomes', biome, 'ground-glow.webp')
    if night and os.path.exists(gg):
        g = load(gg, (4 * cv.T, 4 * cv.T))[..., :3]
        cv.glow += np.tile(g, (cv.h // (4 * cv.T) + 1, cv.w // (4 * cv.T) + 1, 1))[:cv.h, :cv.w]


def plants(cv, biome, busy, seed):
    """The biome's scenery plants, as the game scatters them (never on a resource)."""
    rng = np.random.default_rng(seed)
    dens = BIOMES[biome][2]
    for j in range(int(cv.h / cv.T)):
        for i in range(int(cv.w / cv.T)):
            if (i, j) in busy or rng.uniform() >= dens: continue
            k = int(rng.integers(1, 7))
            pdir = os.path.join(ART, 'biomes', biome)
            cv.sprite(os.path.join(pdir, f'plant-{k}.webp'), i + 0.5, j + 0.5, glow=os.path.join(pdir, f'plant-{k}-glow.webp'))


# ------------------------------------------------------------------------------------------------ Fiber
GROVE = [(1, 1, 1), (2, 1, 1), (3, 1, 0.75), (1, 2, 1), (2, 2, 1), (3, 2, 1), (4, 2, 0.5), (2, 3, 0.25), (3, 3, 1), (4, 1, 1), (1, 3, 0.75)]


def fiber(cv, k, tiles):
    for i, j, g in tiles:
        if k == 0:                                                   # today: the art drawn smaller (and a little faded) while it regrows
            cv.sprite(os.path.join(ART, 'resources', 'stalk.webp'), i + 0.5, j + 0.5, 0.5 + 0.5 * g, alpha=0.85 if g < 1 else 1)
        else:                                                        # proposed: an image for each growth stage, drawn full size
            n = f'fiber-{k}' + ('' if g >= 1 else f'-g{g}')
            cv.sprite(os.path.join(RES, n + '.png'), i + 0.5, j + 0.5, glow=os.path.join(RES, n + '-glow.png'))


# ------------------------------------------------------------------------------------------------ Oil
SEEP = [(2, 1, 1.0), (3, 1, 1.0), (3, 2, 0.8), (4, 2, 1.0), (2, 2, 0.6), (4, 1, 0.45)]
PUMP = (3, 1)


def seep_mask(cv, tiles):
    """The seep as one shape: a disc on each oil tile (smaller as it is pumped dry), bridged to its oil neighbours,
    with a ragged edge. This is what the game would fill with the seep texture."""
    T, ss = cv.T, 2
    H, W = cv.h * ss, cv.w * ss
    m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
    have = {(i, j): f for i, j, f in tiles}
    for (i, j), f in have.items():
        r = (0.38 + 0.18 * f) * T * ss
        cx, cy = (i + 0.5) * T * ss, (j + 0.5) * T * ss
        d.ellipse((cx - r, cy - r * 0.92, cx + r, cy + r * 0.92), fill=255)
        for di, dj in ((1, 0), (0, 1), (1, 1), (1, -1)):
            if (i + di, j + dj) in have:
                w = r * (0.85 if di * dj == 0 else 0.6)
                d.line((cx, cy, cx + di * T * ss, cy + dj * T * ss), fill=255, width=int(w * 2))
    a = np.asarray(m).astype(np.float32) / 255
    yy, xx = np.mgrid[0:H, 0:W] / (T * ss)
    wob = 0.5 + 0.5 * (np.sin(xx * 5.1 + np.sin(yy * 3.7) * 1.6) * np.sin(yy * 4.3 + 1.3) + 0.5 * np.sin(xx * 11 + yy * 9))
    a = ndimage.gaussian_filter(a, T * ss * 0.08)
    a = np.clip((a - 0.5 + 0.3 * (wob - 0.5)) * 6 + 0.5, 0, 1)
    a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255
    return a


def oil(cv, k, tiles, night, pump=True):
    T = cv.T
    if k == 0:                                                       # today: an ellipse per tile, drawn in code
        lay = Image.new('RGBA', (cv.w * 4, cv.h * 4), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
        S = 4
        for i, j, f in tiles:
            if pump and (i, j) == PUMP: continue
            ff = 0.55 + 0.45 * f; u = T / 32 * S
            cx, cy, rx, ry = (i + 0.5) * T * S, (j + 0.5) * T * S, 12 * ff * u, 8.5 * ff * u
            d.ellipse((cx - rx + 1.5 * u, cy - ry + 2 * u, cx + rx + 1.5 * u, cy + ry + 2 * u), fill=(30, 20, 10, 77))
            d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), fill=(22, 18, 15, 255))
            for col, kk in (((255, 92, 138, 140), 0.7), ((56, 212, 255, 115), 0.55), ((200, 240, 90, 90), 0.4)):
                d.arc((cx - 2 * u - rx * kk, cy - 1.5 * u - ry * kk, cx - 2 * u + rx * kk, cy - 1.5 * u + ry * kk), 162, 342, fill=col, width=max(1, int(1.4 * u)))
            d.ellipse((cx - rx * 0.4 - 2 * u, cy - ry * 0.35 - u, cx - rx * 0.4 + 2 * u, cy - ry * 0.35 + u), fill=(255, 255, 255, 128))
        cv.over(np.asarray(lay.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255, 0, 0)
    else:
        a = seep_mask(cv, tiles)
        # a dark soaked edge round the seep, then the seep's own texture over its shape
        halo = np.clip(ndimage.gaussian_filter(a, T * 0.12) * 1.25 - a, 0, 1) * 0.5
        cv.rgb *= (1 - halo * 0.8)[..., None]
        tx = load(os.path.join(RES, f'seep-{k}.png'), (2 * T, 2 * T))
        reps = (cv.h // (2 * T) + 1, cv.w // (2 * T) + 1, 1)
        t = np.tile(tx, reps)[:cv.h, :cv.w]
        aa = a * t[..., 3]
        cv.rgb = cv.rgb * (1 - aa[..., None]) + t[..., :3] * aa[..., None]
        gp = os.path.join(RES, f'seep-{k}-glow.png')
        if os.path.exists(gp):
            g = np.tile(load(gp, (2 * T, 2 * T)), reps)[:cv.h, :cv.w]
            cv.glow += g[..., :3] * (g[..., 3] * a)[..., None]
        for i, j, f in tiles:
            if pump and (i, j) == PUMP: continue
            n = f'vent-{k}'
            cv.sprite(os.path.join(RES, n + '.png'), i + 0.5, j + 0.5, 0.6 + 0.4 * f, glow=os.path.join(RES, n + '-glow.png'))
    if pump:                                                         # an Oil Pump built right on the seep
        tod = 'night' if night else None
        bdir = os.path.join(ART, 'tod', 'night', 'buildings') if night else os.path.join(ART, 'buildings')
        for key in ('pump@0',):
            cv.sprite(os.path.join(bdir, key + '.webp'), PUMP[0] + 0.5, PUMP[1] + 0.5, 1.4, (0.5, 0.615))
        if night:
            lp = load(os.path.join(ART, 'tod', 'shared', 'light-pool.webp'), (int(2.2 * T), int(2.2 * T)))
            cv.addglow(np.concatenate([np.ones(lp.shape[:2] + (3,), np.float32) * np.array([56, 212, 255], np.float32) / 255, lp[..., 3:] * 0.8], -1),
                       (PUMP[0] + 0.5) * T - 1.1 * T, (PUMP[1] + 0.5) * T - 1.1 * T)


def save(rgb, name):
    Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(os.path.join(OUT, name + '.png'))


def patch(res, k, biome, night, T=48, Wt=6, Ht=4, name=None):
    cv = Canvas(Wt, Ht, T)
    ground(cv, biome, night)
    if res == 'fiber':
        busy = {(i, j) for i, j, _ in GROVE}
        plants(cv, biome, busy, 11)
        fiber(cv, k, GROVE)
    else:
        busy = {(i, j) for i, j, _ in SEEP}
        plants(cv, biome, busy, 12)
        oil(cv, k, SEEP, night)
    save(cv.result(night), name or f'{res}-{k}-{biome}-{"night" if night else "day"}')


def lineup(biome, T=48):
    """Every resource side by side at game scale, then the biome's six plants: what the new art has to stand apart from."""
    items = [('resources/ore.webp', None), ('resources/crystal.webp', None), ('resources/boulder.webp', None), ('resources/stalk.webp', None)]
    items += [(os.path.join(RES, f'fiber-{k}.png'), os.path.join(RES, f'fiber-{k}-glow.png')) for k in (1, 2, 3)]
    items += [(os.path.join(RES, f'vent-{k}.png'), os.path.join(RES, f'vent-{k}-glow.png')) for k in (1, 2, 3)]
    items += [(os.path.join('biomes', biome, f'plant-{k}.webp'), None) for k in range(1, 7)]
    out = []
    for night in (False, True):
        cv = Canvas(len(items) * 1.25 + 0.25, 1.5, T)
        ground(cv, biome, night)
        for n, (p, g) in enumerate(items):
            x = 0.25 + n * 1.25 + 0.5
            if 'vent-' in p:   # an oil tile: its seep texture under the pump spot
                k = int(os.path.basename(p)[5])
                a = np.zeros((cv.h, cv.w), np.float32)
                yy, xx = np.mgrid[0:cv.h, 0:cv.w] / T
                a = np.clip((0.55 - np.hypot(xx - x, (yy - 0.75) / 0.92)) * 12, 0, 1).astype(np.float32)
                tx = load(os.path.join(RES, f'seep-{k}.png'), (2 * T, 2 * T))
                t = np.tile(tx, (cv.h // (2 * T) + 1, cv.w // (2 * T) + 1, 1))[:cv.h, :cv.w]
                aa = a * t[..., 3]; cv.rgb = cv.rgb * (1 - aa[..., None]) + t[..., :3] * aa[..., None]
            path = p if os.path.isabs(p) else os.path.join(ART, p)
            cv.sprite(path, x, 0.75, glow=g)
        out.append(cv.result(night))
    save(np.concatenate(out, 0), f'lineup-{biome}')
    return [os.path.basename(p).replace('.webp', '').replace('.png', '') for p, _ in items]


def stages(k, biome='desert', T=96):
    """A strip of the growth stages, regrowing to full, then the night look of the full one."""
    cv = Canvas(5.5, 1.3, T)
    ground(cv, biome, False)
    gs = [0.25, 0.5, 0.75, 1]
    for n, g in enumerate(gs):
        if k == 0: cv.sprite(os.path.join(ART, 'resources', 'stalk.webp'), 0.6 + n * 1.1, 0.65, 0.5 + 0.5 * g, alpha=0.85 if g < 1 else 1)
        else: cv.sprite(os.path.join(RES, f'fiber-{k}' + ('' if g >= 1 else f'-g{g}') + '.png'), 0.6 + n * 1.1, 0.65)
    day = cv.rgb.copy()
    # the last cell at night
    cvn = Canvas(1.1, 1.3, T); ground(cvn, biome, True)
    if k == 0: cvn.sprite(os.path.join(ART, 'resources', 'stalk.webp'), 0.55, 0.65)
    else: cvn.sprite(os.path.join(RES, f'fiber-{k}.png'), 0.55, 0.65, glow=os.path.join(RES, f'fiber-{k}-glow.png'))
    x0 = int(4.4 * T); w = min(day.shape[1] - x0, cvn.w)
    day[:, x0:x0 + w] = cvn.result(True)[:, :w]
    save(day, f'fiber-{k}-stages')


if __name__ == '__main__':
    for res, ks in (() if 'quick' in sys.argv else (('fiber', (0, 1, 2, 3)), ('oil', (0, 1, 2, 3)))):
        for k in ks:
            for b in BIOMES:
                for night in (False, True):
                    patch(res, k, b, night)
            for night in (False, True):
                patch(res, k, 'desert', night, T=128, name=f'{res}-{k}-big-{"night" if night else "day"}')
    for k in (0, 1, 2, 3):
        stages(k)
    order = lineup('jungle'); lineup('desert'); lineup('polar')
    print('lineup order', order)
    print('ok')
