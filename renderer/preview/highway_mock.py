"""Pictures for the Express highway design sheet: the three directions' tile sets (preview/highway_tiles.py) drawn the
way the game draws a map (js/render.js: ground textures, roads with their kerbs, street lamps, the night grade and
the roads' edge glow, buildings and robots by depth), with today's art for the Freight Trucks, Road Trains, Tankers,
Haulers and the Paver. It reuses the Maglev sheet's kit (preview/maglev_mock.py: trucks, lamps, buildings, terrain).
The highway is drawn the way the sheet proposes the game should draw it: A and B as ground tiles with the roads,
their cat's-eyes, strips and guidance lights added as light after dark; C as the overpass is drawn, its shadow with
the roads and its deck lifted a quarter tile up the screen over the traffic, on piers, with its own vehicles on top.
Nothing here is game code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/highway_mock.py <outdir> [all|cards|colony|scale]      (run from renderer/)

Writes, by day and at night unless said:
    pieces-<v>-<tod>.png     the tile set laid out on open ground: straight, ramps, crossing, end, bend, laid, base, worn  (128 px a tile)
    colony-<v>-<tod>.png     a colony at game scale: a factory district, the highway out to a far Depot, an on-ramp,
                             a crossing with an ordinary road, Freight Trucks and a Road Train on it, Haulers on the
                             ordinary road beside it                                                   (48; -big at 96)
    close-<v>-<tod>.png      the middle of that colony at 96 px a tile
    phone-<v>-<tod>.png      the colony at a phone's 28 px a tile
    build-<v>.png            under construction: the Paver laying it (C: Workers building it), the planned tiles beyond  (96, day)
    worn-<v>-<tod>.png       a worn stretch, the game's resurfacing mark on the worst tile                    (96)
    scale-<tod>.png          a line-up: road, asphalt road, then A, B and C, each with traffic                 (64)
    contact.png              the three colonies by day and night, labelled, for a quick look
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUTD = sys.argv[1]
WHICH = sys.argv[2] if len(sys.argv) > 2 else 'all'
os.makedirs(OUTD, exist_ok=True)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.argv = [sys.argv[0], os.path.join(OUTD, '_spr'), OUTD]        # maglev_mock reads these; it renders nothing on import
from maglev_mock import Canvas, art, grade, load, draw_roads, road_glow, lamps, street_pools, light_pool, city_glow, CYAN, ART, B3, truck, bot_shadow, lamp, building, terrain, plain_ground, grid  # noqa: E402
import highway_tiles as HT  # noqa: E402

NAMES = {'a': 'Expressway', 'b': 'Freight corridor', 'c': 'Elevated flyover'}
LIFT = 0.25                        # C: the deck this many tiles up the screen over its ground tile
SHADOW = (0.15, 0.17)              # C: the deck's shadow lands this far right and down of the ground under it (the overpass's rule)
ROT = {'E': 0, 'S': -90, 'W': 180, 'N': 90}      # PIL turns counter-clockwise: a southbound lane is the eastbound tile turned clockwise


# ------------------------------------------------------------------------------------------------ the tiles
_imgs = {}


def tile(v, name, T, d='E', flip=False, lit=False):
    """a piece at T px a tile, turned to lane direction d (flip: mirrored along the lane, so an end is a start)"""
    key = (v, name, T, d, flip, lit)
    if key not in _imgs:
        im = HT.piece(v, name)[1 if lit else 0]
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        if ROT[d]:
            im = im.rotate(ROT[d], expand=True)
        im = im.resize((max(1, round(im.width / HT.R * T)), max(1, round(im.height / HT.R * T))), Image.LANCZOS)
        _imgs[key] = np.asarray(im).astype(np.float32) / 255
    return _imgs[key]


def put_tile(cv, v, name, i, j, d='E', flip=False, tod='day', dy=0.0, dim=1.0):
    s = tile(v, name, cv.T, d, flip)
    if tod == 'night':
        s = s.copy(); s[..., :3] = grade(s[..., :3])
    if dim != 1.0:
        s = s.copy(); s[..., :3] *= dim
    cv.over(s, i * cv.T, (j + dy) * cv.T)


def put_lit(cv, v, name, i, j, d='E', flip=False, dy=0.0, k=1.0):
    """what glows on a piece, added as light with a soft bloom round it"""
    s = tile(v, name, cv.T, d, flip, lit=True)
    cv.add(s, i * cv.T, (j + dy) * cv.T, 1.0 * k)
    b = Image.fromarray((s * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(1, cv.T * 0.06)))
    cv.add(np.asarray(b).astype(np.float32) / 255, i * cv.T, (j + dy) * cv.T, 1.0 * k)


def tile_shadow(cv, v, name, i, j, d='E', flip=False, dy=0.0, tod='day'):
    """C: the deck's shadow on the ground, down-sun of where it stands"""
    s = tile(v, name, cv.T, d, flip)
    a = Image.fromarray((s[..., 3] * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(0.6, cv.T * 0.03)))
    sh = np.zeros(s.shape, np.float32); sh[..., :3] = (4 / 255, 8 / 255, 14 / 255); sh[..., 3] = np.asarray(a).astype(np.float32) / 255 * (0.38 if tod == 'day' else 0.16)
    cv.over(sh, (i + SHADOW[0]) * cv.T, (j + dy + LIFT + SHADOW[1]) * cv.T)


def pier(cv, x, y, tod, h=LIFT, w=0.14):
    """C: a squat round pier under the deck, its foot on ground point (x, y), seen at the game's angle"""
    T = cv.T; S = 3
    im = Image.new('RGBA', (int(T * 1.0 * S), int(T * 1.0 * S)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    cx, cy = T * 0.5 * S, T * 0.8 * S
    top = cy - (h + 0.16) * T * S
    d.ellipse((cx - w * 0.9 * T * S, cy - w * 0.35 * T * S, cx + w * 0.9 * T * S, cy + w * 0.35 * T * S), fill=(20, 16, 12, 110))
    d.rectangle((cx - w / 2 * T * S, top, cx, cy), fill=(166, 171, 178, 255))
    d.rectangle((cx, top, cx + w / 2 * T * S, cy), fill=(92, 98, 106, 255))
    d.ellipse((cx - w / 2 * T * S, cy - w * 0.3 * T * S, cx + w / 2 * T * S, cy + w * 0.3 * T * S), fill=(120, 126, 134, 255))
    s = np.asarray(im.resize((im.width // S, im.height // S), Image.LANCZOS)).astype(np.float32) / 255
    if tod == 'night':
        s = s.copy(); s[..., :3] = grade(s[..., :3])
    cv.over(s, x * T - T * 0.5, y * T - T * 0.8)


# ------------------------------------------------------------------------------------------------ street furniture
def gantry(cv, x, j_top, tod):
    """A: a sign gantry over both carriageways: two legs in the verges, a beam, two blank green boards lit at night"""
    T = cv.T; S = 3
    H = 0.5
    im = Image.new('RGBA', (int(T * 2 * S), int(T * 3.2 * S)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    oy = 0.6 * T * S          # the image's top is 0.6 tiles above the pair's top edge
    y0, y1 = oy + (-0.08) * T * S, oy + 2.08 * T * S
    lx = T * S
    for y in (y0, y1):
        d.rectangle((lx - 0.03 * T * S, y - H * T * S, lx + 0.03 * T * S, y), fill=(44, 48, 54, 255))
        d.ellipse((lx - 0.08 * T * S, y - 0.04 * T * S, lx + 0.08 * T * S, y + 0.04 * T * S), fill=(90, 96, 104, 255))
    d.rectangle((lx - 0.04 * T * S, y0 - H * T * S, lx + 0.04 * T * S, y1 - H * T * S), fill=(58, 63, 70, 255))
    d.rectangle((lx - 0.015 * T * S, y0 - H * T * S, lx + 0.015 * T * S, y1 - H * T * S), fill=(30, 33, 38, 255))
    for yc in (oy + 0.5 * T * S, oy + 1.5 * T * S):
        bx0, bx1, by0, by1 = lx - 0.02 * T * S, lx + 0.34 * T * S, yc - (H - 0.02) * T * S - 0.16 * T * S, yc - (H - 0.02) * T * S + 0.16 * T * S
        d.rectangle((bx0, by0, bx1, by1), fill=(28, 84, 58, 255), outline=(230, 234, 236, 255), width=max(1, int(0.012 * T * S)))
        d.rectangle((bx0 + 0.05 * T * S, by0 + 0.07 * T * S, bx1 - 0.05 * T * S, by0 + 0.1 * T * S), fill=(220, 226, 228, 255))
        d.rectangle((bx0 + 0.05 * T * S, by0 + 0.16 * T * S, bx1 - 0.12 * T * S, by0 + 0.19 * T * S), fill=(220, 226, 228, 255))
    s = np.asarray(im.resize((im.width // S, im.height // S), Image.LANCZOS)).astype(np.float32) / 255
    # its shadow on the carriageways first
    sh = np.zeros(s.shape, np.float32); sh[..., :3] = (4 / 255, 8 / 255, 14 / 255); sh[..., 3] = s[..., 3] * (0.3 if tod == 'day' else 0.1)
    cv.over(sh, (x + 0.5 - 1 + 0.28) * T, (j_top - 0.6 + 0.5) * T)
    if tod == 'night':
        s = s.copy(); s[..., :3] = grade(s[..., :3])
    cv.over(s, (x + 0.5 - 1) * T, (j_top - 0.6) * T)
    if tod == 'night':
        for yc in (0.5, 1.5):
            g = np.zeros((int(T * 0.6), int(T * 0.8), 4), np.float32); g[..., :3] = (0.75, 0.95, 0.85); g[..., 3] = 1
            g = np.asarray(Image.fromarray((g * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(T * 0.12))).astype(np.float32) / 255
            cv.add(g, (x + 0.64) * T - g.shape[1] / 2, (j_top + yc - H + 0.02) * T - g.shape[0] / 2, 0.28)


def overpass_ns(cv, i, j_top, rows, tod):
    """an ordinary road crossing A on an overpass running north-south (the game's drawOverpassDeck, turned)"""
    T = cv.T; S = 3
    w = 0.46; e = 0.04
    im = Image.new('RGBA', (int(T * 1 * S), int(T * (rows + 1.4) * S)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    x0 = (1 - w) / 2 * T * S; x1 = x0 + w * T * S
    for ry0, ry1 in ((0.0, 0.45), (rows + 0.95, rows + 1.4)):
        d.rectangle((x0 + e * T * S, ry0 * T * S, x1 - e * T * S, ry1 * T * S), fill=(154, 161, 169, 255))
        d.rectangle((x0, ry0 * T * S, x0 + e * T * S, ry1 * T * S), fill=(74, 80, 88, 255)); d.rectangle((x1 - e * T * S, ry0 * T * S, x1, ry1 * T * S), fill=(74, 80, 88, 255))
    d.rectangle((x0 - e * T * S, 0.58 * T * S, x1 + e * T * S, (rows + 0.82) * T * S), fill=(60, 66, 73, 255))
    d.rectangle((x0 + e * T * S, 0.6 * T * S, x1 - e * T * S, (rows + 0.8) * T * S), fill=(201, 206, 213, 255))
    d.rectangle((x0 + e * T * S, 0.6 * T * S, x0 + 2 * e * T * S, (rows + 0.8) * T * S), fill=(242, 244, 247, 255))
    d.rectangle((x1 - 2 * e * T * S, 0.6 * T * S, x1 - e * T * S, (rows + 0.8) * T * S), fill=(242, 244, 247, 255))
    for k in range(int(rows * 3)):
        yy = (0.7 + k * 0.36) * T * S
        d.rectangle((T * S / 2 - e / 2 * T * S, yy, T * S / 2 + e / 2 * T * S, yy + 0.18 * T * S), fill=(255, 209, 102, 217))
    s = np.asarray(im.resize((im.width // S, im.height // S), Image.LANCZOS)).astype(np.float32) / 255
    sh = np.zeros(s.shape, np.float32); sh[..., :3] = 0; sh[..., 3] = s[..., 3] * (0.38 if tod == 'day' else 0.14)
    cv.over(sh, (i + 0.17) * T, (j_top - 0.7 + 0.08) * T)
    if tod == 'night':
        s = s.copy(); s[..., :3] = grade(s[..., :3])
    cv.over(s, i * T, (j_top - 0.7) * T)


def signal(cv, i, j, tod, go_ew=True):
    """the game's traffic light head on a junction's corner (drawLights)"""
    T = cv.T; S = 3
    im = Image.new('RGBA', (int(T * 0.4 * S), int(T * 0.5 * S)), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    r = 0.07 * T * S; px, py = 0.2 * T * S, 0.25 * T * S
    d.rounded_rectangle((px - r * 1.5, py - r * 2.6, px + r * 1.5, py + r * 2.6), radius=r, fill=(20, 22, 28, 230))
    d.ellipse((px - r * 0.8, py - 1.2 * r - r * 0.8, px + r * 0.8, py - 1.2 * r + r * 0.8), fill=(61, 255, 138, 255) if go_ew else (255, 75, 75, 255))
    d.ellipse((px - r * 0.8, py + 1.2 * r - r * 0.8, px + r * 0.8, py + 1.2 * r + r * 0.8), fill=(255, 75, 75, 255) if go_ew else (61, 255, 138, 255))
    s = np.asarray(im.resize((im.width // S, im.height // S), Image.LANCZOS)).astype(np.float32) / 255
    cv.over(s, (i + 0.86) * T - s.shape[1] / 2, (j + 0.14) * T - s.shape[0] / 2)
    # the stop bars across the ordinary road's entries
    bar = np.zeros((max(1, int(T * 0.09)), int(T * 0.42), 4), np.float32); bar[..., 3] = 0.85
    bar[..., :3] = (1, 0.3, 0.3) if go_ew else (0.24, 1, 0.54)
    cv.over(bar, (i + 0.29) * T, (j + 0.04) * T); cv.over(bar, (i + 0.29) * T, (j + 0.96) * T - bar.shape[0])


def plan_mark(cv, i, j, tod, road=False):
    """the game's paving mark: amber over a tile marked for asphalt (fainter over road already there), its outline"""
    T = cv.T
    a = np.zeros((T, T, 4), np.float32); a[..., :3] = (1, 0.77, 0.27)
    k = int(T * 0.08)
    a[k:T - k, k:T - k, 3] = 0.16 if road else 0.34
    e = max(1, int(T * 0.05))
    a[k:k + e, k:T - k, 3] = 0.7; a[T - k - e:T - k, k:T - k, 3] = 0.7; a[k:T - k, k:k + e, 3] = 0.7; a[k:T - k, T - k - e:T - k, 3] = 0.7
    cv.over(a, i * T, j * T)


def repave_mark(cv, i, j):
    T = cv.T
    a = np.zeros((T, T, 4), np.float32); a[..., :3] = (1, 0.31, 0.24)
    k = int(T * 0.18); e = max(1, int(T * 0.05))
    a[k:k + e, k:T - k, 3] = 0.9; a[T - k - e:T - k, k:T - k, 3] = 0.9; a[k:T - k, k:k + e, 3] = 0.9; a[k:T - k, T - k - e:T - k, 3] = 0.9
    cv.over(a, i * T, j * T)


# ------------------------------------------------------------------------------------------------ vehicles
def bot(cv, kind, t, x, y, rot, tod, size=0.5):
    """a Hauler, Paver or Worker with its art: the game's size, its soft shadow, headlights after dark"""
    bot_shadow(cv, x, y, rot, size * 0.42, size * 0.3, tod)
    cv.sprite(art('bots', f'{kind}@{t}-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        hl = load(os.path.join(ART, 'tod', 'shared', f'{kind}-headlights.webp'), (int(size * 3 * cv.T),) * 2)
        if rot:
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        cv.add(hl, x * cv.T - hl.shape[1] / 2, y * cv.T - hl.shape[0] / 2, 1.0)


def crates(cv, x, y, rot, n, size):
    """a few goods crates on a trailer bed (drawTruckCargo draws them in the goods' colours)"""
    cols = [(0.85, 0.6, 0.3), (0.55, 0.6, 0.68), (0.9, 0.82, 0.5), (0.7, 0.45, 0.35)]
    ux, uy = math.cos(rot), math.sin(rot); vx, vy = -uy, ux
    k = 0
    for r in (-0.075, 0.075):
        for c in (-0.17, -0.06, 0.05, 0.16):
            if k >= n:
                return
            cx, cy = x + ux * c * size * 1.1 + vx * r * size, y + uy * c * size * 1.1 + vy * r * size
            s = max(2, int(cv.T * size * 0.085))
            box = np.zeros((s, s, 4), np.float32); box[..., :3] = cols[k % 4]; box[..., 3] = 1
            box[:max(1, s // 5), :, :3] *= 1.25; box[-max(1, s // 5):, :, :3] *= 0.7
            cv.over(np.clip(box, 0, 1), cx * cv.T - s / 2, cy * cv.T - s / 2)
            k += 1


def tanker(cv, t, x, y, rot, tod):
    size = 0.9
    bot_shadow(cv, x, y, rot, size * 0.44, size * 0.17, tod)
    cv.sprite(art('bots', f'tanker@{t}-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        hl = load(os.path.join(ART, 'tod', 'shared', 'tanker-headlights.webp'), (int(size * 3 * cv.T),) * 2)
        if rot:
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        cv.add(hl, x * cv.T - hl.shape[1] / 2, y * cv.T - hl.shape[0] / 2, 1.0)


def roadtrain(cv, t, x, y, rot, tod, load_=22):
    """drawRoadTrain with art: the tractor and two flatbeds 0.477 tiles apart along a straight road, each 0.9 of a tile"""
    size, gap = 0.9, 0.477
    ux, uy = math.cos(rot), math.sin(rot)
    cars = [(x - ux * gap * k, y - uy * gap * k) for k in range(3)]
    for cx, cy in cars:
        bot_shadow(cv, cx, cy, rot, size * 0.4, size * 0.16, tod)
    for k in (2, 1):
        cx, cy = cars[k]
        cv.sprite(art('bots', f'roadtrain-trailer@{t}', tod), cx, cy, size, [0.5, 0.5], rot=rot)
        n = min(15, load_) if k == 1 else max(0, load_ - 15)
        crates(cv, cx - ux * 0.06, cy - uy * 0.06, rot, math.ceil(n / 15 * 8), size)
    cv.sprite(art('bots', f'roadtrain@{t}-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        hl = load(os.path.join(ART, 'tod', 'shared', 'roadtrain-headlights.webp'), (int(size * 3 * cv.T),) * 2)
        if rot:
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        cv.add(hl, x * cv.T - hl.shape[1] / 2, y * cv.T - hl.shape[0] / 2, 1.0)


def lamp_pool_at(cv, x, y, kind='asphalt', k=0.7, r=1.6):
    w = cv.T * r * 2
    pool = load(os.path.join(ART, 'roads', f'streetlamp-{kind}-pool.webp'), (int(w), int(w * 0.8)))
    cv.add(pool, x * cv.T - w / 2, y * cv.T - w * 0.4, k)


# ------------------------------------------------------------------------------------------------ the highway
class Highway:
    """the pieces of one direction's highway on a map, and how they are drawn in the game's passes:
    tiles: [(i, j, name, dir, flip)] ; furniture: [(kind, ...)] ; vehicles on it: [(kind, x, y, rot)]"""

    def __init__(self, v, tiles, furniture=(), vehicles=()):
        self.v, self.tiles, self.furniture, self.vehicles = v, list(tiles), list(furniture), list(vehicles)

    def lift(self):
        return LIFT if self.v == 'c' else 0.0

    def ground_pass(self, cv, tod):
        """with the roads: A and B's tiles and their light; C's shadow"""
        if self.v == 'c':
            for i, j, name, d, flip in self.tiles:
                tile_shadow(cv, 'c', name, i, j, d, flip, tod=tod)
            return
        for i, j, name, d, flip in self.tiles:
            put_tile(cv, self.v, name, i, j, d, flip, tod)
        if tod == 'night':
            for i, j, name, d, flip in self.tiles:
                put_lit(cv, self.v, name, i, j, d, flip)

    def sorted_items(self, tod):
        """things drawn among the buildings and robots, keyed by depth"""
        out = []
        if self.v == 'c':
            for i, j, name, d, flip in self.tiles:
                h = LIFT * (0.5 if name == 'ramp' else 1.0)
                out.append((j + 0.95, 'pier', (i + 0.5, j + 0.95, h)))
        for f in self.furniture:
            if f[0] == 'lamp':
                out.append((f[2], 'lamp', f[1:]))
            elif f[0] == 'gantry':
                out.append((f[2] + 2.1, 'gantry', f[1:]))
            elif f[0] == 'over':
                out.append((f[2] + f[3] + 0.6, 'over', f[1:]))
            elif f[0] == 'signal':
                out.append((f[2] + 0.2, 'signal', f[1:]))
        if self.v != 'c':
            for kind, x, y, rot in self.vehicles:
                out.append((y, 'veh', (kind, x, y, rot)))
        return out

    def draw_item(self, cv, kind, args, tod):
        if kind == 'pier':
            pier(cv, args[0], args[1], tod, args[2])
        elif kind == 'lamp':
            x, y = args
            lamp(cv, 'asphalt', x, y, tod)
            if tod == 'night':
                lamp_pool_at(cv, x, y - 0.1)
        elif kind == 'gantry':
            gantry(cv, args[0], args[1], tod)
        elif kind == 'over':
            overpass_ns(cv, args[0], args[1], args[2], tod)
        elif kind == 'signal':
            signal(cv, args[0], args[1], tod)
        elif kind == 'veh':
            draw_vehicle(cv, args, tod, 0.0)

    def deck_pass(self, cv, tod):
        """C only, after everything on the ground: the deck lifted, its light, the vehicles on it"""
        if self.v != 'c':
            return
        for i, j, name, d, flip in self.tiles:
            dy = -LIFT * (0.5 if name == 'ramp' else 1.0)
            put_tile(cv, 'c', name, i, j, d, flip, tod, dy=dy)
        if tod == 'night':
            for i, j, name, d, flip in self.tiles:
                put_lit(cv, 'c', name, i, j, d, flip, dy=-LIFT * (0.5 if name == 'ramp' else 1.0))
        for f in self.furniture:
            if f[0] == 'decklamp':
                lamp(cv, 'asphalt', f[1], f[2] - LIFT, tod)
                if tod == 'night':
                    lamp_pool_at(cv, f[1], f[2] - LIFT - 0.1, k=0.5, r=1.3)
        for veh in sorted(self.vehicles, key=lambda q: q[2]):
            draw_vehicle(cv, veh, tod, -LIFT)


def draw_vehicle(cv, veh, tod, dy):
    kind, x, y, rot = veh
    if kind == 'truck':
        truck(cv, 0, x, y + dy, rot, tod)
    elif kind == 'tanker':
        tanker(cv, 0, x, y + dy, rot, tod)
    elif kind == 'train':
        roadtrain(cv, 0, x, y + dy, rot, tod)
    else:
        bot(cv, kind, 0, x, y + dy, rot, tod)


# ------------------------------------------------------------------------------------------------ the colony
MAP = ['.........~~~~~~.........'] * 2 + ['..........~~~~..........'] + ['........................'] * 10
MW, MH = len(MAP[0]), len(MAP)
HX0, HX1 = 8, 20        # the highway runs from column 8 to 20, on row 6 (A: westbound on row 5 too)
# A's trucks keep to their lanes: the inner lane 0.3 of the tile from the median, the outer 0.63
A_IN_LANE, A_OUT_LANE = 0.3, 0.63


def colony_plan(v):
    roads = {}
    for i in range(1, 8):
        roads[(i, 3)] = 'a'
    for i in range(1, 22):
        roads[(i, 9)] = 'a'
    for j in range(3, 10):
        roads[(1, j)] = 'c'; roads[(7, j)] = 'a'
    for j in range(7, 9):
        roads[(10, j)] = 'a'                                # the feeder up to the on-ramp
    for j in range(1, 13):
        roads[(15, j)] = 'c'                                # the ordinary road that crosses the highway
    for j in range(4, 9):
        roads[(21, j)] = 'a'                                # the far end's road, up to the Depot
    if v == 'c':
        roads.pop((10, 7)); roads.pop((10, 8))              # the flyover has no mid-line ramp
    builds = [('depot@0', 3.0, 1.5), ('smelter@0', 5.4, 1.5), ('tarworks@0', 3.0, 5.7), ('roadworks@0', 5.4, 5.7),
              ('lander@0', 3.0, 11.0), ('fab@0', 5.6, 11.0), ('foundry@0', 12.6, 11.0), ('fab@0', 17.6, 11.0),
              ('depot@0', 22.7, 4.4), ('generator@0', 22.7, 7.6), ('generator@0', 18.4, 1.6)]
    tiles, furn, veh = [], [], []
    j = 6
    if v == 'a':
        tiles.append((HX0, 6, 'end', 'E', True)); tiles.append((HX0, 5, 'end', 'W', False))
        for i in range(HX0 + 1, HX1):
            tiles.append((i, 5, 'straight', 'W', False))
        tiles += [(9, 6, 'straight', 'E', False), (10, 6, 'ramp', 'E', False), (11, 6, 'merge', 'E', False)]
        for i in range(12, HX1):
            tiles.append((i, 6, 'straight', 'E', False))
        tiles.append((HX1, 6, 'end', 'E', False)); tiles.append((HX1, 5, 'end', 'W', True))
        roads.pop((15, 5)); roads.pop((15, 6))              # the ordinary road goes over, on an overpass
        furn += [('lamp', x + 0.5, 6.0) for x in (9, 11, 17, 19)] + [('gantry', 13, 5), ('over', 15, 5, 2)]
        veh += [('truck', 12.4, 6 + A_IN_LANE, 0.0), ('train', 17.6, 6 + A_OUT_LANE, 0.0), ('truck', 19.0, 6 + A_IN_LANE, 0.0),
                ('truck', 14.2, 6 - A_IN_LANE, math.pi), ('tanker', 10.4, 6 - A_OUT_LANE, math.pi), ('truck', 10.1, 7.9, -math.pi / 2)]
    elif v == 'b':
        tiles.append((HX0, 6, 'end', 'E', True))
        tiles += [(9, 6, 'straight', 'E', False), (10, 6, 'ramp', 'E', False), (11, 6, 'straight', 'E', False), (12, 6, 'layby', 'E', False),
                  (13, 6, 'straight', 'E', False), (14, 6, 'straight', 'E', False), (15, 6, 'cross', 'E', False)]
        for i in range(16, HX1):
            tiles.append((i, 6, 'straight', 'E', False))
        tiles.append((HX1, 6, 'end', 'E', False))
        roads.pop((15, 6))
        furn += [('signal', 15, 6)]
        veh += [('truck', 10.6, 6.5, 0.0), ('truck', 12.5, 6.87, 0.0), ('train', 17.6, 6.5, 0.0), ('truck', 14.3, 6.5, 0.0), ('truck', 10.1, 7.9, -math.pi / 2)]
    else:
        tiles.append((HX0, 6, 'ramp', 'E', True))
        for i in range(HX0 + 1, HX1):
            tiles.append((i, 6, 'straight', 'E', False))
        tiles.append((HX1, 6, 'ramp', 'E', False))
        roads.pop((15, 6))                                  # the ordinary road runs under the deck: its tile is the deck's
        roads[(15, 6)] = 'c'
        furn += [('decklamp', x + 0.5, 6.22) for x in (10, 12, 14, 16, 18)]
        veh += [('truck', 11.0, 6.5, 0.0), ('train', 17.6, 6.5, 0.0), ('truck', 14.3, 6.5, 0.0)]
    hw = Highway(v, tiles, furn, veh)
    # Haulers on the ordinary roads beside it, each on its own side
    haulers = [(11.3, 9.67, 0.0), (14.6, 9.33, math.pi), (18.2, 9.67, 0.0), (15.33, 3.4, -math.pi / 2), (15.67, 8.1, math.pi / 2), (7.33, 6.2, -math.pi / 2), (4.0, 9.67, 0.0)]
    return roads, builds, hw, haulers


def colony(v, tod, T=48, name=None, crop=None):
    cv = Canvas(MW * T, MH * T, T)
    terrain(cv, MAP)
    roads, builds, hw, haulers = colony_plan(v)
    cv.over(draw_roads(cv, roads, tod), 0, 0)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)
        road_glow(cv, roads)
        street_pools(cv, lamps(roads))
        for key, x, y in builds:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        city_glow(cv, [(x, y, False) for _, x, y in builds], CYAN)
    hw.ground_pass(cv, tod)
    items = [(y, 'b', key, x, y) for key, x, y in builds]
    items += [(fy_, 'lamp', kind, fx_, fy_) for kind, i, j, (fx_, fy_) in lamps(roads)]
    items += [(y, 'hauler', x, y, rot) for x, y, rot in haulers]
    items += [(d, 'hw', kind, args) for d, kind, args in hw.sorted_items(tod)]
    for it in sorted(items, key=lambda q: q[0]):
        if it[1] == 'b':
            building(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'hauler':
            bot(cv, 'hauler', 0, it[2], it[3], it[4], tod)
        else:
            hw.draw_item(cv, it[2], it[3], tod)
    hw.deck_pass(cv, tod)
    if crop:
        x0, y0, x1, y1 = crop
        cv.rgb = cv.rgb[int(y0 * T):int(y1 * T), int(x0 * T):int(x1 * T)]
    cv.save(os.path.join(OUTD, (name or f'colony-{v}-{tod}') + '.png'))


# ------------------------------------------------------------------------------------------------ the cards
def pieces_card(v, tod, T=128):
    """the tile set on open ground, a tile of ground between pieces: a straight run, the end (its exit road), the on-ramp
    with its feeder road, the crossing, the bend, the construction tiles, the worn tile; A's gantry and overpass, B's
    light, C's piers and lamps, each with traffic where it tells"""
    cv = Canvas(int(18 * T), int(3.6 * T), T)
    plain_ground(cv, tod); grid(cv, 0.06 if tod == 'day' else 0.03)
    y = 1
    veh = []
    if v == 'a':
        W_ = lambda i, n='straight', f=False: (i, y - 1, n, 'W', f)
        E_ = lambda i, n='straight', f=False: (i, y, n, 'E', f)
        tiles = [E_(0), W_(0), E_(2, 'end'), W_(2, 'end', True), E_(5, 'ramp'), E_(6, 'merge'), W_(5), W_(6), (8, y - 1, 'bend', 'E', False),
                 E_(11, 'fresh'), W_(11, 'fresh'), E_(12, 'bed'), W_(12, 'bed'), E_(14, 'worn'), W_(14, 'worn'), E_(16), W_(16)]
        roads = {(3, y - 1): 'a', (3, y): 'a', (3, y + 1): 'a', (5, y + 1): 'a', (5, y + 2): 'a'}
        furn = [('lamp', 0.5, y), ('gantry', 16, y - 1)]
        veh = [('truck', 5.5, y + 0.86, 0.0), ('truck', 0.5, y + A_IN_LANE, 0.0)]
    elif v == 'b':
        E_ = lambda i, n='straight', f=False: (i, y, n, 'E', f)
        tiles = [E_(0), E_(2, 'ramp'), E_(4, 'layby'), E_(6, 'cross'), E_(8, 'end'), E_(10, 'bend'), E_(12, 'fresh'), E_(13, 'bed'), E_(15, 'worn'), E_(16)]
        roads = {(2, y + 1): 'a', (2, y + 2): 'a', (6, y - 1): 'c', (6, y + 1): 'c', (6, y + 2): 'c', (9, y): 'a'}
        furn = [('signal', 6, y)]
        veh = [('truck', 4.5, y + 0.87, 0.0), ('truck', 0.5, y + 0.5, 0.0)]
    else:
        E_ = lambda i, n='straight', f=False: (i, y, n, 'E', f)
        tiles = [E_(0), E_(3, 'ramp', True), E_(4), E_(5, 'ramp'), E_(8), E_(10, 'bend'), E_(12, 'rough'), E_(14, 'worn'), E_(16)]
        roads = {(1, y): 'a', (2, y): 'a', (6, y): 'a', (7, y): 'a', (8, y - 1): 'c', (8, y): 'c', (8, y + 1): 'c', (8, y + 2): 'c'}
        furn = [('decklamp', 0.5, y + 0.22), ('decklamp', 16.5, y + 0.22)]
        veh = [('truck', 8.5, y + 0.5, 0.0), ('truck', 0.5, y + 0.5, 0.0)]
    hw = Highway(v, tiles, furn, veh)
    cv.over(draw_roads(cv, roads, tod), 0, 0)
    if tod == 'night':
        cv.rgb = grade(cv.rgb); road_glow(cv, roads)
    hw.ground_pass(cv, tod)
    items = list(hw.sorted_items(tod))
    if v == 'c':
        items.append((y + 1.6, 'hauler', (8.33, y + 1.6, -math.pi / 2)))
    for d, kind, args in sorted(items, key=lambda q: q[0]):
        if kind == 'hauler':
            bot(cv, 'hauler', 0, args[0], args[1], args[2], tod)
        else:
            hw.draw_item(cv, kind, args, tod)
    hw.deck_pass(cv, tod)
    cv.save(os.path.join(OUTD, f'pieces-{v}-{tod}.png'))


def build_card(v, T=96):
    """under construction: finished tiles, the one being laid (the Paver on it; for C, Workers building the deck on
    piers already standing), the prepared base, then the planned tiles marked in amber"""
    tod = 'day'
    cv = Canvas(9 * T, 4 * T, T)
    plain_ground(cv, tod)
    rows = (1, 2) if v == 'a' else (2,)
    y = 2
    tiles, furn, veh = [], [], []
    if v == 'a':
        for i in range(0, 3):
            tiles += [(i, 2, 'straight', 'E', False)]
        for i in range(0, 2):
            tiles += [(i, 1, 'straight', 'W', False)]
        tiles += [(3, 2, 'fresh', 'E', False), (2, 1, 'fresh', 'W', False), (4, 2, 'bed', 'E', False), (3, 1, 'bed', 'W', False), (4, 1, 'bed', 'W', False)]
        furn = [('lamp', 1.5, 2.0)]
        veh = [('paver', 3.3, 2.5, 0.0), ('paver', 2.4, 1.5, math.pi), ('truck', 1.4, 2.63, 0.0)]
        plans = [(i, j) for i in range(5, 9) for j in rows]
    elif v == 'b':
        for i in range(0, 4):
            tiles += [(i, 2, 'straight', 'E', False)]
        tiles += [(4, 2, 'fresh', 'E', False), (5, 2, 'bed', 'E', False)]
        veh = [('paver', 4.3, 2.5, 0.0), ('truck', 2.2, 2.5, 0.0), ('hauler', 3.5, 2.5, 0.0)]
        plans = [(i, 2) for i in range(6, 9)]
    else:
        for i in range(0, 4):
            tiles += [(i, 2, 'straight', 'E', False)]
        tiles += [(4, 2, 'rough', 'E', False)]
        furn = [('decklamp', 0.5, 2.22), ('decklamp', 2.5, 2.22)]
        veh = [('truck', 2.0, 2.5, 0.0)]
        plans = [(i, 2) for i in range(6, 9)]
    hw = Highway(v, tiles, furn, veh)
    hw.ground_pass(cv, tod)
    for i, j in plans:
        plan_mark(cv, i, j, tod)
    items = list(hw.sorted_items(tod))
    if v == 'c':
        items.append((2.95, 'pier', (5.5, 2.95, LIFT)))           # the next pier stands, no deck on it yet
        items.append((3.3, 'worker', (5.2, 3.3)))
        items.append((3.25, 'worker', (4.4, 3.25)))
    for d, kind, args in sorted(items, key=lambda q: q[0]):
        if kind == 'worker':
            bot(cv, 'worker', 0, args[0], args[1], 0.4, tod)
        else:
            hw.draw_item(cv, kind, args, tod)
    hw.deck_pass(cv, tod)
    if v == 'c':
        bot(cv, 'worker', 0, 4.6, 2.5 - LIFT, 0.0, tod)
    cv.save(os.path.join(OUTD, f'build-{v}.png'))


def worn_card(v, tod, T=96):
    """a worn stretch: fresh at each end, worn through the middle, the game's resurfacing mark on the worst tile"""
    cv = Canvas(7 * T, 3 * T, T)
    plain_ground(cv, tod)
    rows = {'a': ((1, 'W'), (2, 'E')), 'b': ((1, 'E'),), 'c': ((1, 'E'),)}[v]
    tiles = []
    for j, d in rows:
        for i in range(7):
            tiles.append((i, j, 'worn' if 2 <= i <= 4 else 'straight', d, False))
    y = 2 if v == 'a' else 1
    furn = [('lamp', 1.5, 2.0), ('lamp', 5.5, 2.0)] if v == 'a' else ([('decklamp', 0.5, 1.22), ('decklamp', 4.5, 1.22)] if v == 'c' else [])
    veh = [('truck', 1.2, y + (A_IN_LANE if v == 'a' else 0.5), 0.0), ('train', 5.6, y + (A_OUT_LANE if v == 'a' else 0.5), 0.0)]
    hw = Highway(v, tiles, furn, veh)
    hw.ground_pass(cv, tod)
    for d, kind, args in sorted(hw.sorted_items(tod), key=lambda q: q[0]):
        hw.draw_item(cv, kind, args, tod)
    hw.deck_pass(cv, tod)
    for j, d in rows:
        repave_mark(cv, 3, j - (LIFT if v == 'c' else 0))
    cv.save(os.path.join(OUTD, f'worn-{v}-{tod}.png'))


def lineup(tod, T=64):
    """road, asphalt road, then A, B and C, three tiles of each with traffic, side by side"""
    cv = Canvas(int(19.5 * T), int(3.6 * T), T)
    plain_ground(cv, tod); grid(cv, 0.08 if tod == 'day' else 0.035)
    roads = {(i, 2): 'c' for i in range(0, 3)} | {(i, 2): 'a' for i in range(4, 7)}
    cv.over(draw_roads(cv, roads, tod), 0, 0)
    if tod == 'night':
        cv.rgb = grade(cv.rgb); road_glow(cv, roads); street_pools(cv, lamps(roads))
    hws = []
    for k, v in enumerate('abc'):
        x0 = 8 + k * 4
        if v == 'a':
            tiles = [(x0 + i, 2, 'straight', 'E', False) for i in range(3)] + [(x0 + i, 1, 'straight', 'W', False) for i in range(3)]
            furn = [('lamp', x0 + 1.5, 2.0)]
            veh = [('truck', x0 + 0.8, 2 + A_IN_LANE, 0.0), ('train', x0 + 2.8, 2 + A_OUT_LANE, 0.0), ('truck', x0 + 2.0, 2 - A_OUT_LANE, math.pi)]
        elif v == 'b':
            tiles = [(x0 + i, 2, 'straight', 'E', False) for i in range(3)]
            furn = []
            veh = [('truck', x0 + 0.7, 2.5, 0.0), ('train', x0 + 2.8, 2.5, 0.0)]
        else:
            tiles = [(x0 + i, 2, 'straight', 'E', False) for i in range(3)]
            furn = [('decklamp', x0 + 1.5, 2.22)]
            veh = [('truck', x0 + 0.7, 2.5, 0.0), ('train', x0 + 2.8, 2.5, 0.0)]
        hws.append(Highway(v, tiles, furn, veh))
    for hw in hws:
        hw.ground_pass(cv, tod)
    items = [(fy_, 'lamp', kind, fx_, fy_) for kind, i, j, (fx_, fy_) in lamps(roads)]
    items += [(2.67, 'hauler', 1.0, 2.67, 0.0), (2.33, 'hauler', 2.2, 2.33, math.pi), (2.5, 'truck', 5.2, 2.5, 0.0)]
    for hw in hws:
        items += [(d, 'hw', hw, kind, args) for d, kind, args in hw.sorted_items(tod)]
    for it in sorted(items, key=lambda q: q[0]):
        if it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'hauler':
            bot(cv, 'hauler', 0, it[2], it[3], it[4], tod)
        elif it[1] == 'truck':
            truck(cv, 0, it[2], it[3], it[4], tod)
        else:
            it[2].draw_item(cv, it[3], it[4], tod)
    for hw in hws:
        hw.deck_pass(cv, tod)
    cv.save(os.path.join(OUTD, f'scale-{tod}.png'))


def contact():
    ims = {(v, t): Image.open(os.path.join(OUTD, f'colony-{v}-{t}.png')) for v in 'abc' for t in ('day', 'night')}
    w, h = ims[('a', 'day')].size
    im = Image.new('RGB', (w * 3 + 40, h * 2 + 90), (18, 19, 22)); d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 22)
    except OSError:
        font = ImageFont.load_default()
    for k, v in enumerate('abc'):
        d.text((k * (w + 20) + 14, 10), f'{v.upper()}  {NAMES[v]}', fill=(235, 236, 240), font=font)
        im.paste(ims[(v, 'day')], (k * (w + 20), 44)); im.paste(ims[(v, 'night')], (k * (w + 20), 44 + h + 36))
    d.text((14, 44 + h + 6), 'At night', fill=(235, 236, 240), font=font)
    im.save(os.path.join(OUTD, 'contact.png'))


if __name__ == '__main__':
    for tod in ('day', 'night'):
        for v in 'abc':
            if WHICH in ('all', 'cards'):
                pieces_card(v, tod); worn_card(v, tod)
                if tod == 'day':
                    build_card(v)
            if WHICH in ('all', 'colony'):
                colony(v, tod); colony(v, tod, T=96, name=f'colony-{v}-{tod}-big')
                colony(v, tod, T=96, name=f'close-{v}-{tod}', crop=(8, 3, 17, 10.5))
                colony(v, tod, T=28, name=f'phone-{v}-{tod}')
        if WHICH in ('all', 'scale'):
            lineup(tod)
    if WHICH in ('all', 'colony'):
        contact()
    print('wrote', OUTD)
