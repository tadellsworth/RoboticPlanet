"""Pictures for the oil seep design sheet: the three proposed puddle directions (terrain/oil_puddles.py) drawn the way
the game draws a map (js/render.js: the Rust's ground, plants, roads, the night grade, buildings and vehicles over it),
beside today's seep (drawSeep: the oil-seep texture over a disc per tile, and the survey stake). Nothing here is game
code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/oil_seep_mock.py <outdir>      (run from renderer/)

Writes, for each direction v = a, b, c (and 'today' where it applies), by day and at night:
    side-<tod>.png            today and the three directions side by side on one strip, a five-tile seep each, 64 px a tile
    card-<v>-<tod>.png        a five-tile seep close up, 96 px a tile, with the survey stakes
    fill-<v>-<tod>.png        the same seep full, half pumped and nearly dry, an Oil Pump on its middle tile, 64 px a tile
    colony-<v>-<tod>.png      a stretch of colony at game scale (48 px a tile): a pumped seep, a wild one, a road, a Refinery
    phone-<v>-<tod>.png       the same colony at a phone's 28 px a tile
    nostakes-a-day.png        direction A with no survey stakes on it (for the questions)
    contact.png               the side-by-side strips by day and night, labelled, for a quick look
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

OUTD = sys.argv[1] if len(sys.argv) > 1 else 'out/preview/oil'
WHICH = sys.argv[2] if len(sys.argv) > 2 else 'all'
os.makedirs(OUTD, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0], os.path.join(OUTD, '_hollow')]
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'terrain'))
from hollow_mock import Canvas, art, grade, load, tex_layer, draw_roads, road_glow, lamps, street_pools, light_pool, city_glow, CYAN, ART  # noqa: E402
from oil_puddles import render_puddle  # noqa: E402

B3 = (1.4, [0.5, 0.615])                   # every building (B3D in art/art-manifest.js)
GROUND = art('tiles', 'ground')
OIL_AMOUNT = 16                            # RES[R_OIL].amount in js/defs.js
SEEP5 = {(3, 2): 1.0, (2, 2): 0.9, (4, 2): 1.0, (3, 1): 0.85, (3, 3): 1.0}          # a plus, as stamp() lays them (radius 1.1 to 1.3)
SEEP3 = {(0, 0): 1.0, (1, 0): 0.9, (1, 1): 1.0}
SEEDS = {'a': 11, 'b': 23, 'c': 37}
GLOW_K = 0.92                              # how the glow map is added over the graded picture (resource_mock.py)


def save(cv, name):
    cv.save(os.path.join(OUTD, name + '.png'))


def shift(tiles, di, dj):
    return {(i + di, j + dj): f for (i, j), f in tiles.items()}


# ------------------------------------------------------------------------------------------------ the ground
def ground(cv, seed, busy, density=0.07):
    """the Rust's ground, and its plants scattered as the game does (never on a resource or a building)"""
    cv.rgb[:] = tex_layer(GROUND, cv.w, cv.h, cv.T)
    rng = np.random.default_rng(seed)
    T = cv.T
    for j in range(cv.h // T):
        for i in range(cv.w // T):
            if (i, j) in busy or rng.uniform() >= density:
                continue
            k = int(rng.integers(1, 7))
            cv.over(load(art('biomes/desert', f'plant-{k}'), (T, T)), i * T, j * T)


# ------------------------------------------------------------------------------------------------ the seeps
class Night:
    """what gets added after the night grade: the glow map (gleams, stake lamps), light pools"""
    def __init__(self):
        self.items = []


def seep_today(cv, tiles, fscale, night, stakes=True, skip=()):
    """drawSeep (js/render.js): a halo, then the oil-seep texture over a wobbly disc per tile bridged to its oil
    neighbours; the survey stake on each tile, its lamp lit at night"""
    T, S = cv.T, 4
    tex = load(art('resources', 'oil-seep'), (2 * T, 2 * T))
    pat = np.tile(tex, (cv.h // (2 * T) + 1, cv.w // (2 * T) + 1, 1))[:cv.h, :cv.w]
    rng = np.random.default_rng(5)

    def shape(k):
        im = Image.new('L', (cv.w * S, cv.h * S), 0); d = ImageDraw.Draw(im)
        for (i, j), f0 in tiles.items():
            f = min(1.0, f0 * fscale)
            r = T * (0.3 + 0.17 * f) * S; cx, cy = (i + 0.5) * T * S, (j + 0.5) * T * S
            h1, h2 = rng.uniform(0, 6), rng.uniform(0, 6)
            pts = []
            for n in range(19):
                a = n / 18 * 2 * np.pi
                rr = r * k * (1 + 0.1 * np.sin(a * 3 + h1) + 0.05 * np.sin(a * 7 + h2))
                pts.append((cx + np.cos(a) * rr, cy + np.sin(a) * rr * 0.92))
            d.polygon(pts, fill=255)
            for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)):
                if (i + di, j + dj) in tiles:
                    w = r * k * (1.2 if di and dj else 1.7)
                    d.line((cx, cy, cx + di * T * S * 0.5, cy + dj * T * S * 0.5), fill=255, width=int(w))
        return np.asarray(im.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255
    halo = shape(1.22) * 0.22
    cv.rgb = cv.rgb * (1 - halo[..., None]) + np.array([22, 14, 8], np.float32) / 255 * halo[..., None]
    a = shape(1.0) * pat[..., 3]
    cv.rgb = cv.rgb * (1 - a[..., None]) + pat[..., :3] * a[..., None]
    if stakes:
        draw_stakes(cv, tiles, fscale, night, skip)


def draw_stakes(cv, tiles, fscale, night, skip=()):
    """the survey stake on each seep tile (drawResource: the oil art, 0.6 + 0.4 x its fill of a tile), its lamp at night"""
    for (i, j), f0 in tiles.items():
        if (i, j) in skip:
            continue
        f = min(1.0, f0 * fscale); sc = 0.6 + 0.4 * f
        cv.sprite(art('resources', 'oil'), i + 0.5, j + 0.5, sc, [0.5, 0.5])
        if night is not None:
            g = load(art('resources', 'oil-glow'), (int(sc * cv.T),) * 2)
            night.items.append(('glow', g, (i + 0.5) * cv.T - sc * cv.T / 2, (j + 0.5) * cv.T - sc * cv.T / 2, GLOW_K))


def seep_new(cv, v, tiles, fscale, night, seed, stakes=True, skip=()):
    p = render_puddle(tiles, cv.T, v, seed, fscale)
    cv.over(p.stain, p.x0, p.y0)
    cv.over(p.body, p.x0, p.y0)
    if night is not None:
        night.items.append(('glow', p.gleam, p.x0, p.y0, GLOW_K))
    if stakes:
        draw_stakes(cv, tiles, fscale, night, skip)


def seep(cv, v, tiles, fscale, night, seed=1, stakes=True, skip=()):
    if v == 'today':
        seep_today(cv, tiles, fscale, night, stakes, skip)
    else:
        seep_new(cv, v, tiles, fscale, night, seed, stakes, skip)


def finish_night(cv, night):
    cv.rgb = grade(cv.rgb)
    for it in night.items:
        if it[0] == 'glow':
            _, g, x, y, k = it
            cv.add(g, x, y, k)


# ------------------------------------------------------------------------------------------------ pieces of colony
def building(cv, key, x, y, tod):
    cv.sprite(art('buildings', key, tod), x, y, *B3)


def vehicle(cv, key, x, y, rot, tod, size=0.9):
    """drawTruck with art: the vehicle, its soft shadow, headlights after dark"""
    import math
    along, across = size * 0.44, size * 0.17
    S = 4; n = int(cv.T * size * 1.4 * S); im = Image.new('L', (n, n), 0)
    ImageDraw.Draw(im).ellipse((n / 2 - along * cv.T * S, n / 2 - across * cv.T * S, n / 2 + along * cv.T * S, n / 2 + across * cv.T * S), fill=255)
    im = im.rotate(-math.degrees(rot), resample=Image.BICUBIC)
    a = np.asarray(im.resize((n // S, n // S), Image.LANCZOS)).astype(np.float32) / 255
    p = np.zeros(a.shape + (4,), np.float32); p[..., 0] = 20 / 255; p[..., 1] = 10 / 255; p[..., 2] = 5 / 255; p[..., 3] = a * (0.32 if tod == 'day' else 0.12)
    cv.over(p, (x + along * 0.12) * cv.T - a.shape[1] / 2, (y + along * 0.16) * cv.T - a.shape[0] / 2)
    cv.sprite(art('bots', f'{key}@0-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        hl = load(os.path.join(ART, 'tod', 'shared', f'{key}-headlights.webp'), (int(size * 3 * cv.T),) * 2)
        if rot:
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        cv.add(hl, x * cv.T - hl.shape[1] / 2, y * cv.T - hl.shape[0] / 2, 1.0)


def lamp(cv, kind, fx_, fy, tod):
    cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914], mul='night' if tod == 'night' else None)
    if tod == 'night':
        cv.sprite(art('roads', f'streetlamp-{kind}-lit@0'), fx_, fy, 1, [0.5, 0.914])


def pump_light(cv, x, y):
    light_pool(cv, x, y, CYAN, 0.8, 2.2)


# ------------------------------------------------------------------------------------------------ panels
def card(v, tod, T=96):
    cv = Canvas(6 * T, 4 * T, T)
    night = Night() if tod == 'night' else None
    ground(cv, 3, set(SEEP5))
    seep(cv, v, SEEP5, 1.0, night, SEEDS.get(v, 1))
    if night: finish_night(cv, night)
    save(cv, f'card-{v}-{tod}')


def fill(v, tod, T=64):
    """full, half pumped, nearly dry: the same seep three times, an Oil Pump on its middle tile"""
    cv = Canvas(17 * T, 5 * T, T)
    night = Night() if tod == 'night' else None
    sets = [(shift(SEEP5, -1 + 5 * n, 0), f) for n, f in enumerate((1.0, 0.5, 0.12))]
    busy = set().union(*[set(t) for t, _ in sets])
    ground(cv, 4, busy)
    for n, (tiles, f) in enumerate(sets):
        seep(cv, v, tiles, f, night, SEEDS.get(v, 1), skip={(2 + 5 * n, 2)})
    if night:
        finish_night(cv, night)
        for n in range(3):
            pump_light(cv, 2.5 + 5 * n, 2.5)
    for n in range(3):
        building(cv, 'pump@0', 2.5 + 5 * n, 2.5, tod)
    save(cv, f'fill-{v}-{tod}')


ROADS = {(i, 5): 'c' for i in range(0, 14)}
ROADS.update({(7, j): 'c' for j in range(2, 5)})
COLONY_SEEP = shift(SEEP5, 0, 0)                 # pumped, its pump on (3, 2)
WILD_SEEP = shift(SEEP3, 10, 1)                  # not yet pumped


def colony(v, tod, T=48, name=None):
    cv = Canvas(14 * T, 8 * T, T)
    night = Night() if tod == 'night' else None
    builds = [('pump@0', 3.5, 2.5), ('refinery@0', 5.5, 2.5), ('depot@0', 9.5, 3.5), ('depot@0', 11.5, 6.5)]
    busy = set(COLONY_SEEP) | set(WILD_SEEP) | set(ROADS) | {(int(x), int(y)) for _, x, y in builds}
    ground(cv, 7, busy)
    seep(cv, v, COLONY_SEEP, 0.8, night, SEEDS.get(v, 1), skip={(3, 2)})
    seep(cv, v, WILD_SEEP, 1.0, night, SEEDS.get(v, 1) + 100)
    cv.over(draw_roads(cv, ROADS, tod), 0, 0)
    L = lamps(ROADS)
    if night:
        finish_night(cv, night)
        road_glow(cv, ROADS)
        street_pools(cv, L)
        for _, x, y in builds:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        city_glow(cv, [(x, y, False) for _, x, y in builds], CYAN)
    items = [(y, 'b', key, x, y) for key, x, y in builds]
    items += [(fy, 'lamp', kind, fx, fy) for kind, i, j, (fx, fy) in L]
    items += [(5.5, 'tanker', 1.6, 5.5, 0.0), (3.6, 'truck', 7.5, 3.6, np.pi / 2)]
    for it in sorted(items, key=lambda q: q[0]):
        if it[1] == 'b':
            building(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], tod)
        else:
            vehicle(cv, it[1], it[2], it[3], it[4], tod)
    save(cv, name or f'colony-{v}-{tod}')


def side(tod, T=64, vs=('today', 'a', 'b', 'c'), name=None, stakes=True):
    """today and the three directions on one strip, the same five-tile seep each, labelled"""
    W = 6
    cv = Canvas(W * len(vs) * T, 4 * T, T)
    night = Night() if tod == 'night' else None
    sets = [(shift(SEEP5, W * n, 0)) for n in range(len(vs))]
    ground(cv, 5, set().union(*[set(t) for t in sets]))
    for n, v in enumerate(vs):
        seep(cv, v, sets[n], 1.0, night, SEEDS.get(v, 1), stakes=stakes)
    if night: finish_night(cv, night)
    # a thin seam between the panels
    for n in range(1, len(vs)):
        cv.rgb[:, W * n * T - 1:W * n * T + 1] = 0.06
    save(cv, name or f'side-{tod}')


def contact():
    """the two strips with labels, one PNG"""
    day, nite = (Image.open(os.path.join(OUTD, f'side-{t}.png')) for t in ('day', 'night'))
    w, h = day.size
    im = Image.new('RGB', (w, h * 2 + 70), (18, 19, 22)); d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 20)
    except OSError:
        font = ImageFont.load_default()
    labels = ['Today', 'A  Fresh spill', 'B  Spattered seep', 'C  Still pool']
    for n, s in enumerate(labels):
        d.text((n * w // 4 + 14, 10), s, fill=(235, 236, 240), font=font)
    im.paste(day, (0, 40)); im.paste(nite, (0, 40 + h + 30))
    d.text((14, 40 + h + 4), 'At night', fill=(235, 236, 240), font=font)
    im.save(os.path.join(OUTD, 'contact.png'))


if __name__ == '__main__':
    which = WHICH
    for tod in ('day', 'night'):
        if which in ('all', 'side'):
            side(tod)
        for v in 'abc':
            if which in ('all', 'card'): card(v, tod)
            if which in ('all', 'fill'): fill(v, tod)
            if which in ('all', 'colony'):
                colony(v, tod)
                colony(v, tod, T=28, name=f'phone-{v}-{tod}')
    if which in ('all', 'side'):
        side('day', vs=('a',), name='nostakes-a-day', stakes=False)
        contact()
    print('wrote', OUTD)
