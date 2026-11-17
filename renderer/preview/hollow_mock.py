"""Mock-ups of the Hollow set and the Murmur's tunnels, composed the way the game draws a map (see js/render.js and
js/daynight.js): ground textures one image per 4 x 4 tiles, the canyon tiles, the night grade (time-of-day.json) on
everything that is not lit, the biome glow maps added over it, roads with their edge strips and streetlamps, the
colony's light pools and haze, then the sprites by depth. Nothing here is game code.

    TERRAFALL_ART=<game>/art python3 preview/hollow_mock.py <outdir>      (run from renderer/, after the Hollow renders)

Needs out/art/biomes/hollow (terrain/terrain_hollow.py, canyon_hollow.py, plants_hollow.py) and out/hollow (the 3D
pieces, composed, and post/hollow_post.py's breach light). Writes:
    hollow-mock.png         a stretch of the Hollow at game scale (48 px a tile); hollow-mock-big.png the same at 96
    tunnels-<biome>-<day|night>.png    tunnel ridges and exits on the Rust, Greenreach, Hoarfell and the Hollow
    ridges-tiles-<day|night>.png       the same network from a tile set, for comparison
    asset-<name>-game.png / -big.png   each piece on Hollow ground at game scale and enlarged
"""
import json
import os
import subprocess
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ART = os.environ.get('TERRAFALL_ART', os.path.join(ROOT, '..', 'art'))
HB = os.path.join(ROOT, 'out', 'art', 'biomes', 'hollow')
H3 = os.path.join(ROOT, 'out', 'hollow')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'out', 'preview', 'hollow')
os.makedirs(OUT, exist_ok=True)
TODJ = json.load(open(os.path.join(ART, 'tod', 'shared', 'time-of-day.json')))['times']
NIGHT_MUL = np.array([0.16, 0.2, 0.33]); NIGHT_ADD = np.array([0.006, 0.008, 0.022])   # js/daynight.js TOD_TIMES.night
CYAN = np.array([56, 212, 255]) / 255
SPECS = json.load(open(os.path.join(ROOT, 'preview', 'hollow_specs.json')))
B3D = {'scale': 1.4, 'anchor': [0.5, 0.615]}


# ------------------------------------------------------------------------------------------------ image helpers
_cache = {}


def load(p, size=None):
    key = (p, size)
    if key not in _cache:
        im = Image.open(p).convert('RGBA')
        if size:
            im = im.resize(size, Image.LANCZOS)
        _cache[key] = np.asarray(im).astype(np.float32) / 255
    return _cache[key]


def art(group, name, tod='day'):
    base = os.path.join(ART, group) if tod == 'day' else os.path.join(ART, 'tod', tod, group)
    for ext in ('.webp', '.png'):
        if os.path.exists(os.path.join(base, name + ext)):
            return os.path.join(base, name + ext)
    raise FileNotFoundError(f'{group}/{name} ({tod})')


def grade(rgb, tod='night'):
    if tod == 'day':
        return rgb
    t = TODJ[tod]
    mul = NIGHT_MUL if tod == 'night' else np.array(t['grade_multiply']); add = NIGHT_ADD if tod == 'night' else np.array(t['grade_add'])
    return np.clip(rgb * mul + add, 0, 1)


def sstep(a, b, x):
    t = np.clip((np.asarray(x, float) - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


class Canvas:
    def __init__(self, w, h, T):
        self.w, self.h, self.T = w, h, T
        self.rgb = np.zeros((h, w, 3), np.float32)

    def _clip(self, x, y, sw, sh):
        x0, y0 = max(0, x), max(0, y); x1, y1 = min(self.w, x + sw), min(self.h, y + sh)
        return (x0, y0, x1, y1) if x1 > x0 and y1 > y0 else None

    def over(self, s, x, y, alpha=1.0, dst=None):
        dst = self.rgb if dst is None else dst
        x, y = int(round(x)), int(round(y)); sh, sw = s.shape[:2]
        c = self._clip(x, y, sw, sh)
        if not c: return
        x0, y0, x1, y1 = c
        ss = s[y0 - y:y1 - y, x0 - x:x1 - x]; a = ss[..., 3:4] * alpha
        dst[y0:y1, x0:x1] = dst[y0:y1, x0:x1] * (1 - a) + ss[..., :3] * a

    def add(self, s, x, y, k=1.0, tint=None):
        x, y = int(round(x)), int(round(y)); sh, sw = s.shape[:2]
        c = self._clip(x, y, sw, sh)
        if not c: return
        x0, y0, x1, y1 = c
        ss = s[y0 - y:y1 - y, x0 - x:x1 - x]
        col = ss[..., :3] if tint is None else np.asarray(tint, np.float32)[None, None]
        self.rgb[y0:y1, x0:x1] = np.clip(self.rgb[y0:y1, x0:x1] + col * ss[..., 3:4] * k, 0, 1)

    def sprite(self, path, tx, ty, scale, anchor, alpha=1.0, rot=0.0, dst=None, mul=None):
        """Draw an image `scale` tiles across with its anchor point on tile coordinates (tx, ty)."""
        px = max(2, int(round(scale * self.T)))
        s = load(path, (px, px))
        if rot:
            s = np.asarray(Image.fromarray((s * 255).astype(np.uint8)).rotate(-np.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        if mul is not None:
            s = s.copy(); s[..., :3] = grade(s[..., :3]) if mul == 'night' else s[..., :3] * mul
        self.over(s, tx * self.T - anchor[0] * px, ty * self.T - anchor[1] * px, alpha, dst)

    def save(self, p):
        Image.fromarray((np.clip(self.rgb, 0, 1) * 255 + 0.5).astype(np.uint8)).save(p)


def tex_layer(path, W, H, T):
    """A ground texture spanning 4 x 4 tiles, repeated over the whole map (as drawTexture does)."""
    t = load(path, (4 * T, 4 * T))[..., :3]
    reps = (int(np.ceil(H / (4 * T))), int(np.ceil(W / (4 * T))), 1)
    return np.tile(t, reps)[:H, :W]


def tile_mask(grid, ch, T, feather=0.0):
    m = np.array([[1.0 if c in ch else 0.0 for c in row] for row in grid], np.float32)
    m = np.kron(m, np.ones((T, T), np.float32))
    if feather:
        m = ndimage.gaussian_filter(m, feather)
    return m


# ------------------------------------------------------------------------------------------------ roads and lamps
def draw_roads(cv, roads, grade_tod):
    """roads: {(c, r): 'c' | 'a'}. The game's road: a band half a tile wide with kerbs and rounded joins."""
    T, S = cv.T, 4
    SURF = {'c': ((185, 190, 197), (93, 99, 107)), 'a': ((51, 54, 61), (21, 23, 27))}
    img = Image.new('RGBA', (cv.w * S, cv.h * S), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(img)
    for layer in (0, 1):
        for (c, r), k in roads.items():
            col = SURF[k][1 - layer]
            half = (8 if layer == 0 else 6) / 32 * T * S
            cx, cy = (c + 0.5) * T * S, (r + 0.5) * T * S
            d.ellipse((cx - half, cy - half, cx + half, cy + half), fill=col)
            for dc, dr in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (c + dc, r + dr) in roads:
                    ex, ey = cx + dc * T * S / 2, cy + dr * T * S / 2
                    d.rectangle((min(cx, ex) - (half if dr else 0), min(cy, ey) - (half if dc else 0), max(cx, ex) + (half if dr else 0), max(cy, ey) + (half if dc else 0)), fill=col)
    a = np.asarray(img.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255
    return a


def road_glow(cv, roads, team=CYAN, inset=0.09):
    """drawRoadGlow: a thin line in the owner's colour along each road's open edges, and a soft glow round it."""
    from PIL import ImageDraw, ImageFilter
    T, S = cv.T, 4
    img = Image.new('L', (cv.w * S, cv.h * S), 0); d = ImageDraw.Draw(img)
    glow = Image.new('L', (cv.w * S, cv.h * S), 0); dg = ImageDraw.Draw(glow)
    rd = lambda i, j: (i, j) in roads
    for (i, j), k in roads.items():
        x0, x1, y0, y1 = (i + inset) * T * S, (i + 1 - inset) * T * S, (j + inset) * T * S, (j + 1 - inset) * T * S
        lines = []
        if not rd(i, j - 1): lines.append(((i * T * S if rd(i - 1, j) else x0), y0, ((i + 1) * T * S if rd(i + 1, j) else x1), y0))
        if not rd(i, j + 1): lines.append(((i * T * S if rd(i - 1, j) else x0), y1, ((i + 1) * T * S if rd(i + 1, j) else x1), y1))
        if not rd(i - 1, j): lines.append((x0, (j * T * S if rd(i, j - 1) else y0), x0, ((j + 1) * T * S if rd(i, j + 1) else y1)))
        if not rd(i + 1, j): lines.append((x1, (j * T * S if rd(i, j - 1) else y0), x1, ((j + 1) * T * S if rd(i, j + 1) else y1)))
        a = 0.85 if k == 'a' else 0.6
        for l in lines:
            d.line(l, fill=int(255 * a), width=max(1, int(T * 0.028 * S)))
            dg.line(l, fill=int(255 * (0.2 if k == 'a' else 0.13)), width=max(2, int(T * 0.11 * S)))
    m = np.asarray(img.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255
    g = np.asarray(glow.resize((cv.w, cv.h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(T * 0.06))).astype(np.float32) / 255
    cv.rgb = np.clip(cv.rgb + (m + g)[..., None] * team[None, None], 0, 1)


def lamps(roads):
    """streetLamps: every third tile of road ((i + 2j) % 3 == 0); an east-west road has its lamp in the south verge."""
    out = []
    rd = lambda i, j: (i, j) in roads
    for (i, j), k in roads.items():
        if (i + 2 * j) % 3:
            continue
        ew = (rd(i - 1, j) or rd(i + 1, j)) and not rd(i, j - 1) and not rd(i, j + 1)
        out.append(('asphalt' if k == 'a' else 'road', i, j, (i + 0.5, j + 0.875) if ew else (i + 0.125, j + 0.5)))
    return out


def street_pools(cv, L):
    for kind, i, j, _ in L:
        r, a = (1.3, 0.6) if kind == 'road' else (1.6, 0.7)
        w = cv.T * r * 2
        pool = load(os.path.join(ART, 'roads', f'streetlamp-{kind}-pool.webp'), (int(w), int(w * 0.8)))
        cv.add(pool, (i + 0.5) * cv.T - w / 2, (j + 0.5) * cv.T - w * 0.4, a)


def light_pool(cv, tx, ty, color, k=0.8, size=2.2):
    s = cv.T * size
    p = load(os.path.join(ART, 'tod', 'shared', 'light-pool.webp'), (int(s), int(s)))
    cv.add(p, tx * cv.T - s / 2, ty * cv.T - s / 2, k, tint=color)


def city_glow(cv, pts, color, k=0.085):
    """drawCityGlow: a wide faint haze in the owner's colour round every building."""
    g = np.zeros((cv.h, cv.w), np.float32)
    yy, xx = np.mgrid[0:cv.h, 0:cv.w].astype(np.float32)
    for (tx, ty, big) in pts:
        r = cv.T * (4.2 if big else 3.0)
        d = np.hypot(xx - tx * cv.T, yy - ty * cv.T) / r
        g += np.interp(d, [0, 0.35, 0.7, 1.0], [1, 0.67, 0.2, 0]).astype(np.float32)
    cv.rgb = np.clip(cv.rgb + (g * k)[..., None] * np.asarray(color)[None, None], 0, 1)


# ------------------------------------------------------------------------------------------------ ridges (tunnels/ridges.js)
def ridge_layers(jobs):
    jf = os.path.join(OUT, '_ridges', jobs[0]['name'] + '.jobs.json')      # one jobs file per call, so runs can overlap
    os.makedirs(os.path.dirname(jf), exist_ok=True)
    json.dump(jobs, open(jf, 'w'))
    subprocess.run(['node', os.path.join(ROOT, 'tunnels', 'run.js'), jf, os.path.join(OUT, '_ridges')], check=True, capture_output=True)
    return {j['name']: np.asarray(Image.open(os.path.join(OUT, '_ridges', j['name'] + '.png')).convert('RGBA')).astype(np.float32) / 255 for j in jobs}


def avg_ground(path):
    a = load(path, (8, 8))[..., :3]
    return [float(v) for v in (a.reshape(-1, 3).mean(0) * 255)]


# ------------------------------------------------------------------------------------------------ the Hollow mock-up
MAP = [
    "################################",
    "###.....#######.....######...###",
    "##.......####.........##......##",
    "##.......###...........#vvv....#",
    "###...##.##............vvvvv...#",
    "####..#...............vvvvvvv..#",
    "#.....................vvvvvvv..#",
    "#....................vvvvvvvv..#",
    "#....................vvvvvvvv..#",
    "#....................vvvvvvvvv.#",
    "#....................vvvvvvvvv.#",
    "#....................vvvvvvvv..#",
    "#.....................vvvvvvv..#",
    "#~~~~.................vvvvvv...#",
    "~~~~~~~................vvvv....#",
    "~~~~~~~~...............vvv.....#",
    "~~~~~~~~~......................#",
    "~~~~~~~~~~...........##........#",
    "#~~~~~~~~~~.........####......##",
    "################################",
]


def spec(key):
    s = SPECS['sprites'][key]
    return s['scale'], s['anchor']


def hollow_mock(T=48, name='hollow-mock'):
    G = MAP
    H, W = len(G), len(G[0])
    cv = Canvas(W * T, H * T, T)
    at = lambda i, j: G[j][i] if 0 <= i < W and 0 <= j < H else '#'
    # ---- the plan: the colony under the breach, roads, buildings, the Ropeway to the floating Crystal
    breach = (9.0, 10.0)
    roads = {}
    for i in range(6, 14):
        roads[(i, 7)] = 'c'; roads[(i, 13)] = 'c'
    for j in range(7, 14):
        roads[(6, j)] = 'c'; roads[(13, j)] = 'c'
    for i in range(14, 19):
        roads[(i, 10)] = 'a'
    for j in range(14, 16):
        roads[(9, j)] = 'c'
    for i in range(10, 12):
        roads[(i, 15)] = 'c'
    for j in range(4, 7):
        roads[(11, j)] = 'c'
    builds = [  # key, tile x, y (the pad's centre), team
        ('lander@0', 9.5, 10.2), ('generator@0', 11.5, 3.6), ('smelter@0', 15.3, 8.2), ('fab@0', 15.3, 12.0), ('depot@0', 4.4, 12.6),
        ('uplink', 4.4, 9.0), ('harvester@0', 12.6, 16.6), ('turret@0', 7.6, 5.4), ('ropeway@0', 19.4, 10.2),
    ]
    # ---- ground: floor, black water, rock (the cave walls), and the chasm tiles
    floor = tex_layer(os.path.join(HB, 'ground.png'), cv.w, cv.h, T)
    water = tex_layer(os.path.join(HB, 'water.png'), cv.w, cv.h, T)
    rock = tex_layer(os.path.join(HB, 'rock.png'), cv.w, cv.h, T)
    mW = sstep(0.42, 0.58, tile_mask(G, '~', T, feather=T * 0.45)).astype(np.float32)   # shores with rounded corners, as the game rounds them
    mR = tile_mask(G, '#', T, feather=T * 0.05)
    base = floor * (1 - mW[..., None]) + water * mW[..., None]
    base = base * (1 - mR[..., None]) + rock * mR[..., None]
    cv.rgb[:] = base
    # the rock masses rise into the dark: darker the further in from their edge (the ceiling is lost in the dark)
    dist = ndimage.distance_transform_edt(tile_mask(G, '#', 1) > 0.5)
    dist = np.kron(dist, np.ones((T, T)))
    dist = ndimage.gaussian_filter(dist, T * 0.4)
    cv.rgb *= (1 - (0.45 + 0.5 * sstep(0.6, 2.4, dist)) * mR)[..., None]
    cv.rgb *= (1 - 0.45 * mW)[..., None]                       # black water: darker than any floor
    # canyon tiles
    for j in range(H):
        for i in range(W):
            if at(i, j) == 'v':
                key = 'chasm-wall' if at(i, j - 1) not in 'v' else 'chasm-wall-2' if at(i, j - 2) not in 'v' else 'chasm'
                cv.over(load(os.path.join(HB, f'{key}-hollow.png'), (T, T)), i * T, j * T)
    for j in range(H):
        for i in range(W):
            if at(i, j) == '.':
                for di, dj, side in ((0, -1, 'n'), (-1, 0, 'w'), (1, 0, 'e')):
                    if at(i + di, j + dj) == 'v':
                        cv.over(load(os.path.join(HB, f'chasm-lip-{side}-hollow.png'), (T, T)), i * T, j * T)
    # the cave wall where rock meets floor: the wall face over the top of each floor tile below a rock tile
    wall = load(os.path.join(HB, 'wall.png'), (4 * T, int(T * 0.8)))
    for j in range(H):
        for i in range(W):
            if at(i, j) in '.' and at(i, j - 1) == '#':
                sw = wall[:, (i % 4) * T:(i % 4 + 1) * T]
                cv.over(sw, i * T, j * T)
    # ---- tunnel ridges: the network from the nest, laced over the floor (old ones settled, tonight's fresh)
    nest = (17.0, 2.6)
    net = [
        {'pts': [[17.0, 3.0], [15.6, 3.6], [14.4, 4.0], [13.6, 4.5]], 'w': 1.2, 'age': 1},
        {'pts': [[17.6, 3.1], [19.4, 3.6], [20.5, 5.4], [20.3, 7.5], [19.8, 8.8]], 'w': 1.0, 'age': 0.9},
        {'pts': [[16.4, 2.6], [14.0, 2.0], [11.6, 2.4], [9.8, 3.4], [8.6, 4.3]], 'w': 0.9, 'age': 0.4},
        {'pts': [[20.4, 6.8], [18.0, 6.2], [16.4, 5.4]], 'w': 0.7, 'age': 0.6},
        {'pts': [[2.4, 6.6], [3.2, 8.6], [2.6, 10.6], [3.4, 12.2]], 'w': 0.8, 'age': 0.1},
        {'pts': [[14.6, 17.4], [16.4, 15.8], [18.6, 14.6], [20.6, 13.6]], 'w': 0.8, 'age': 0.2},
        {'pts': [[16.2, 15.6], [16.0, 13.8]], 'w': 0.6, 'age': 0.2},
        {'pts': [[25.5, 15.0], [27.4, 15.4], [29.2, 13.6], [29.6, 11.0], [29.5, 7.5], [28.6, 4.2], [26.8, 2.2]], 'w': 0.9, 'age': 0.5},
    ]
    g_avg = avg_ground(os.path.join(HB, 'ground.png'))
    rl = ridge_layers([{'name': f'{name}-base', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g_avg, 'layer': 'base', 'ridges': net, 'seed': 5},
                       {'name': f'{name}-glow', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g_avg, 'layer': 'glow', 'ridges': net, 'seed': 5, 't': 0.6}])
    onfloor = tile_mask(G, '.', T, feather=1.5)
    rb = rl[f'{name}-base'].copy(); rb[..., 3] *= onfloor
    cv.over(rb, 0, 0)
    # ---- plants: the biome's six, scattered over open floor (a building, road or ridge clears them)
    rng = np.random.default_rng(17)
    taken = set(roads) | {(int(x), int(y)) for _, x, y in builds}
    for (bx, by) in [(9, 10), (10, 10), (9, 9), (10, 9), (8, 9), (8, 10), (9, 11), (10, 11), (8, 11)]:
        taken.add((bx, by))
    plants = []
    for j in range(H):
        for i in range(W):
            if at(i, j) == '.' and (i, j) not in taken and rng.uniform() < 0.16 and not (2 <= i <= 8 and 1 <= j <= 4):
                plants.append((i, j, int(rng.integers(1, 7))))
    for i, j, k in plants:
        cv.over(load(os.path.join(HB, f'plant-{k}.png'), (T, T)), i * T, j * T)
    # ---- roads
    ra = draw_roads(cv, roads, 'night')
    cv.over(ra, 0, 0)
    day = cv.rgb.copy()                                       # the ground as daylight shows it (for the breach)
    # ---- night: grade everything so far; under the breach, daylight instead (warm), fading out at the patch's edge
    bl = load(os.path.join(H3, 'breach-light.png'), (int(7.5 * T), int(7.5 * T)))[..., 3]
    bmask = np.zeros((cv.h, cv.w), np.float32)
    x0, y0 = int(breach[0] * T - bl.shape[1] / 2), int(breach[1] * T - bl.shape[0] / 2)
    bmask[y0:y0 + bl.shape[0], x0:x0 + bl.shape[1]] = bl
    warm = np.array([1.0, 0.93, 0.8], np.float32)
    lit = np.clip(day * warm * 0.92 + 0.02, 0, 1)
    cv.rgb = grade(cv.rgb) * (1 - bmask[..., None]) + lit * bmask[..., None]
    # ---- the glow maps (ground and water), the plants' glow, the ridges' veins and pulses, a faint light at the shores
    nk = 0.92
    gg = tex_layer(os.path.join(HB, 'ground-glow.png'), cv.w, cv.h, T)
    wg = tex_layer(os.path.join(HB, 'water-glow.png'), cv.w, cv.h, T)
    road_m = (ra[..., 3] > 0.3).astype(np.float32)
    glow = gg * (onfloor * (1 - road_m))[..., None] + wg * mW[..., None]
    cv.rgb = np.clip(cv.rgb + glow * nk * (1 - 0.7 * bmask[..., None]), 0, 1)
    for i, j, k in plants:
        g = load(os.path.join(HB, f'plant-{k}-glow.png'), (T, T))
        cv.add(g, i * T, j * T, nk)
    rg = rl[f'{name}-glow'].copy(); rg[..., 3] *= onfloor * (1 - road_m)
    cv.add(rg, 0, 0, nk)
    # proposed edge light (drawn by the game along the edges, like the roads' strips): the lakes faintly lit at the
    # shore, the foot of the cave walls and the lip of the chasms catching the Bloom's light
    def edge_light(inside, outside, w, k, col):
        e = np.clip(ndimage.gaussian_filter(outside, w) * inside, 0, 1)
        cv.rgb[:] = np.clip(cv.rgb + (e * k)[..., None] * np.asarray(col, np.float32)[None, None], 0, 1)
    edge_light(mW, 1 - mW, T * 0.12, 0.9, [0.5, 0.4, 0.95])
    mV = tile_mask(G, 'v', T)
    edge_light(onfloor, mR, T * 0.1, 0.35, [0.45, 0.3, 0.8])
    edge_light(onfloor, mV, T * 0.12, 0.45, [0.55, 0.38, 0.95])
    # ---- the colony's lights: road edge strips, streetlamp pools, light pools under buildings, the town's haze
    L = lamps(roads)
    road_glow(cv, roads)
    street_pools(cv, L)
    for key, x, y in builds:
        if key not in ('uplink',):
            light_pool(cv, x, y, CYAN, 0.8, 2.2 if key != 'lander@0' else 3.4)
    city_glow(cv, [(x, y, key == 'lander@0') for key, x, y in builds if key != 'uplink'], CYAN)
    # ---- the floating Crystal over the chasm (drawn with the terrain, under what stands on it)
    sc, an = spec('floater-hollow')
    fl = (25.0, 9.2)
    cv.sprite(os.path.join(H3, 'floater.png'), fl[0], fl[1], sc, an)
    # ---- the side chamber in its pocket of rock
    sc, an = spec('chamber-hollow')
    cv.sprite(os.path.join(H3, 'chamber.png'), 5.4, 2.6, sc, an)
    # ---- sprites, back to front
    items = []
    for key, x, y in builds:
        s = (2.4, [0.5, 0.615]) if key == 'lander@0' else (1.47, [0.5, 0.615]) if key == 'ropeway@0' else (1.9, [0.5, 0.615]) if key == 'uplink' else (1.4, [0.5, 0.615])
        items.append((y, 'b', key, x, y, s))
    items.append((9.6, 'b', 'ropeway@0', 24.4, 9.6, (1.47, [0.5, 0.615])))       # the Ropeway's far station, on the Crystal
    for kind, i, j, (fx, fy) in L:
        items.append((fy, 'lamp', kind, fx, fy))
    items.append((nest[1], 'nest', 'nest-2', nest[0], nest[1]))
    items.append((4.5, 'exit', 'exit-open', 13.6, 4.5))
    items.append((7.4, 'exit', 'exit-collapsed', 2.5, 6.6))
    for x, y, v in [(15.5, 17.0, 1), (19.3, 15.4, 2), (3.0, 15.8, 2)]:
        if at(int(x), int(y)) == '.':
            items.append((y, 'pillar', f'pillar-{v}', x, y))
    for x, y in [(12.4, 17.4), (14.0, 16.0)]:
        items.append((y, 'veins', 'veins', x, y))
    murmur = [(12.6, 5.2, 2.4, 'scuttler'), (14.4, 5.0, 2.0, 'scuttler'), (13.4, 3.7, 2.2, 'scuttler'), (18.2, 4.6, 2.7, 'brute'), (20.2, 7.4, 2.0, 'scuttler')]
    for x, y, f, c in murmur:
        items.append((y, 'mm', c, x, y, f))
    bots = [(16.2, 10.5, 0.0, 'hauler'), (6.5, 11.6, -np.pi / 2, 'worker'), (9.5, 14.6, np.pi / 2, 'hauler'), (10.0, 7.5, np.pi, 'worker')]
    for x, y, f, c in bots:
        items.append((y, 'bot', c, x, y, f))
    for it in sorted(items, key=lambda t: t[0]):
        kind = it[1]
        if kind == 'b':
            _, _, key, x, y, (s, an) = it
            nb = art('buildings', key, 'night')
            cv.sprite(nb, x, y, s, an)
            m = float(bmask[min(cv.h - 1, int(y * T)), min(cv.w - 1, int(x * T))])
            if m > 0.02:                                         # in the breach's daylight: the day art shows through
                cv.sprite(art('buildings', key), x, y, s, an, alpha=m * 0.9)
            if key == 'turret@0':
                cv.sprite(art('buildings', 'turret-head-6@0', 'night'), x, y, s, an)
        elif kind == 'lamp':
            _, _, k, fx, fy = it
            cv.sprite(art('roads', f'streetlamp-{k}@0'), fx, fy, 1, [0.5, 0.914], mul='night')
            cv.sprite(art('roads', f'streetlamp-{k}-lit@0'), fx, fy, 1, [0.5, 0.914])
        elif kind == 'nest':
            _, _, key, x, y = it
            cv.sprite(art('buildings', key, 'night'), x, y, 1.4, [0.5, 0.615])
        elif kind == 'exit':
            _, _, key, x, y = it
            cv.sprite(os.path.join(H3, key + '-night.png'), x, y, *spec('tunnel-exit'))
        elif kind == 'pillar':
            _, _, key, x, y = it
            cv.sprite(os.path.join(H3, key + '.png'), x, y, *spec('pillar-1-hollow'))
        elif kind == 'veins':
            _, _, key, x, y = it
            cv.sprite(os.path.join(H3, 'veins.png'), x, y, *spec('veins-hollow'))
        elif kind == 'mm':
            _, _, c, x, y, f = it
            s = 0.62 if c == 'scuttler' else 0.82
            cv.sprite(art('bots', f'{c}-f0', 'night'), x, y, s, [0.5, 0.5], rot=f)
        elif kind == 'bot':
            _, _, c, x, y, f = it
            cv.sprite(art('bots', f'{c}@0-f0', 'night'), x, y, 0.5, [0.5, 0.5], rot=f)
            hl = load(os.path.join(ART, 'tod', 'shared', f'{c}-headlights.webp'), (int(1.5 * T), int(1.5 * T)))   # 3x the sprite, as drawHeadlights
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-np.degrees(f), resample=Image.BICUBIC)).astype(np.float32) / 255
            cv.add(hl, x * T - 0.75 * T, y * T - 0.75 * T, 1.0)
    # ---- the Ropeway's cable across the chasm, and a gondola on it
    a = np.array([19.4, 10.2 - 0.515 * 1.47]); b = np.array([24.4, 9.6 - 0.515 * 1.47])
    from PIL import ImageDraw
    lay = Image.new('RGBA', (cv.w, cv.h), (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    for off in (-0.06, 0.06):
        pts = [tuple(((a + (b - a) * t) + np.array([0, off + 0.25 * np.sin(np.pi * t)])) * T) for t in np.linspace(0, 1, 30)]
        d.line(pts, fill=(96, 104, 120, 255), width=2)
    cv.over(np.asarray(lay).astype(np.float32) / 255, 0, 0)
    gp = a + (b - a) * 0.45 + np.array([0, 0.25 * np.sin(np.pi * 0.45)])
    cv.sprite(art('bots', 'gondola@0', 'night'), gp[0], gp[1] + 0.3, 0.7, [0.5, 0.08])
    # ---- the breach: the column of daylight over it all, and its dust
    sc = 7.0
    beam = load(os.path.join(H3, 'breach-beam.png'), (int(sc * T), int(2 * sc * T)))
    cv.add(beam, breach[0] * T - sc * T / 2, breach[1] * T - 0.86 * 2 * sc * T, 0.75)
    cv.save(os.path.join(OUT, name + '.png'))
    return cv


# ------------------------------------------------------------------------------------------------ tunnels on the surface
BIOMES = {
    'desert': ('The Rust', os.path.join(ART, 'tiles', 'ground.webp'), None),
    'jungle': ('Greenreach', os.path.join(ART, 'biomes', 'jungle', 'ground.webp'), 'jungle'),
    'polar': ('Hoarfell', os.path.join(ART, 'biomes', 'polar', 'ground.webp'), 'polar'),
    'hollow': ('The Hollow', os.path.join(HB, 'ground.png'), 'hollow'),
}
TNET = [  # a nest at the west, its network spreading east toward a colony's power (off the east edge)
    {'pts': [[1.6, 3.6], [3.4, 3.2], [5.2, 2.4], [7.0, 2.2], [8.6, 2.8]], 'w': 1.1, 'age': 0.4},
    {'pts': [[1.8, 4.0], [3.6, 4.8], [5.4, 5.6], [6.4, 5.2]], 'w': 1.0, 'age': 1.0},
    {'pts': [[5.2, 2.5], [6.0, 1.2]], 'w': 0.7, 'age': 0.4},
    {'pts': [[3.6, 4.8], [4.6, 6.4]], 'w': 0.7, 'age': 0.8},
    {'pts': [[7.0, 2.2], [8.0, 4.2], [9.4, 4.9]], 'w': 0.8, 'age': 1.0},
]


def tunnels_scene(biome, tod, T=48, Wt=11, Ht=7, ridges=TNET, exits=((8.6, 2.8, 'open'), (6.4, 5.2, 'open'), (9.4, 4.9, 'collapsed')), name=None,
                  murmur=True):
    label, gpath, b = BIOMES[biome]
    cv = Canvas(Wt * T, Ht * T, T)
    cv.rgb[:] = tex_layer(gpath, cv.w, cv.h, T)
    # the biome's own plants, a few
    rng = np.random.default_rng(3)
    pk = b or 'desert'
    plants = []
    for j in range(Ht):
        for i in range(Wt):
            if rng.uniform() < (0.25 if biome == 'jungle' else 0.1):
                plants.append((i, j, int(rng.integers(1, 7))))
    pdir = (lambda k: os.path.join(HB, f'plant-{k}.png')) if biome == 'hollow' else (lambda k: art(f'biomes/{pk}', f'plant-{k}'))
    for i, j, k in plants:
        cv.over(load(pdir(k), (T, T)), i * T, j * T)
    g_avg = avg_ground(gpath)
    nm = name or f'tunnels-{biome}-{tod}'
    rl = ridge_layers([{'name': nm + '-b', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g_avg, 'layer': 'base', 'ridges': ridges, 'seed': 9},
                       {'name': nm + '-g', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g_avg, 'layer': 'glow', 'ridges': ridges, 'seed': 9, 't': 0.9}])
    cv.over(rl[nm + '-b'], 0, 0)
    night = tod == 'night' or biome == 'hollow'
    if night:
        cv.rgb = grade(cv.rgb)
        if biome == 'hollow':
            cv.rgb = np.clip(cv.rgb + tex_layer(os.path.join(HB, 'ground-glow.png'), cv.w, cv.h, T) * 0.92, 0, 1)
            for i, j, k in plants:
                cv.add(load(os.path.join(HB, f'plant-{k}-glow.png'), (T, T)), i * T, j * T, 0.92)
        cv.add(rl[nm + '-g'], 0, 0, 0.92)
    # the nest for scale, the exits, and at night the Murmur that came up through them
    cv.sprite(art('buildings', 'nest-1', 'night' if night else 'day'), 1.4, 3.8, 1.4, [0.5, 0.615])
    for x, y, st in exits:
        cv.sprite(os.path.join(H3, f'exit-{st}{"-night" if night else ""}.png'), x, y, *spec('tunnel-exit'))
    if night and murmur:
        # the regional variants (murmur_moles.js v=): armoured in the Rust, pale and shaggy in Hoarfell (the polar biome)
        var = {'desert': 'scuttler-rust-night', 'polar': 'scuttler-white-night'}.get(biome)
        sp = os.path.join(H3, var + '.png') if var else art('bots', 'scuttler-f0', 'night')
        for x, y, f in [(9.3, 2.6, 0.2), (9.9, 3.3, 0.5), (7.2, 5.8, 0.4)]:
            cv.sprite(sp, x, y, 0.62, [0.5, 0.5], rot=f)
    cv.save(os.path.join(OUT, nm + '.png'))
    return cv


def tile_set_scene(tod, T=48):
    """The same network built from a 16-piece tile set (straights, bends, tees, a cross, ends), for comparison: every
    ridge has to run tile centre to tile centre, so it reads as pipework."""
    cells = {(1, 3), (2, 3), (3, 3), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2), (3, 4), (3, 5), (4, 5), (5, 5), (6, 5), (5, 1), (7, 3), (7, 4), (8, 4), (9, 4)}
    ridges = []
    for (i, j) in cells:
        for di, dj in ((1, 0), (0, 1)):
            if (i + di, j + dj) in cells:
                ridges.append({'pts': [[i + 0.5, j + 0.5], [i + di + 0.5, j + dj + 0.5]], 'w': 1.0, 'age': 0.7})
    # (each piece drawn alone and clipped to its tile, as tile art would be)
    return tunnels_scene('desert', tod, T, ridges=ridges, exits=((9.5, 4.5, 'open'), (6.5, 5.5, 'open')), name=f'ridges-tiles-{tod}', murmur=False)


def tile_pieces(T=128):
    """The pieces a tile set would need, drawn by the same code: straight, bend, tee, cross, end."""
    pieces = {'straight': [[[0, 0.5], [1, 0.5]]], 'bend': [[[0, 0.5], [0.5, 0.5], [0.5, 1]]], 'tee': [[[0, 0.5], [1, 0.5]], [[0.5, 0.5], [0.5, 1]]],
              'cross': [[[0, 0.5], [1, 0.5]], [[0.5, 0], [0.5, 1]]], 'end': [[[0, 0.5], [0.62, 0.5]]]}
    g = avg_ground(os.path.join(ART, 'tiles', 'ground.webp'))
    jobs = []
    for k, paths in pieces.items():
        rid = [{'pts': [[x + 0.0, y] for x, y in p], 'w': 1.0, 'age': 0.7} for p in paths]
        jobs.append({'name': 'piece-' + k, 'w': T, 'h': T, 'tile': T, 'ground': g, 'layer': 'base', 'ridges': rid, 'seed': 4})
    rl = ridge_layers(jobs)
    gt = load(os.path.join(ART, 'tiles', 'ground.webp'), (4 * T, 4 * T))[:T, :T, :3]
    row = []
    for k in pieces:
        c = Canvas(T, T, T); c.rgb[:] = gt; c.over(rl['piece-' + k], 0, 0); row.append(c.rgb)
        row.append(np.full((T, 8, 3), 0.12, np.float32))
    Image.fromarray((np.concatenate(row[:-1], 1) * 255).astype(np.uint8)).save(os.path.join(OUT, 'ridges-pieces.png'))


# ------------------------------------------------------------------------------------------------ each asset, game scale and big
def patch(Wt, Ht, T, glow=True):
    cv = Canvas(int(Wt * T), int(Ht * T), T)
    g = tex_layer(os.path.join(HB, 'ground.png'), cv.w, cv.h, T)
    cv.rgb[:] = grade(g)
    if glow:
        cv.rgb = np.clip(cv.rgb + tex_layer(os.path.join(HB, 'ground-glow.png'), cv.w, cv.h, T) * 0.92, 0, 1)
    return cv


def chasm_patch(Wt, Ht, T):
    cv = Canvas(int(Wt * T), int(Ht * T), T)
    for j in range(int(np.ceil(Ht))):
        for i in range(int(np.ceil(Wt))):
            cv.over(load(os.path.join(HB, 'chasm-hollow.png'), (T, T)), i * T, j * T)
    cv.rgb = grade(cv.rgb)
    return cv


def assets():
    out = {}
    for T, tag in ((48, 'game'), (128, 'big')):
        items = [
            ('exit-open', 2.4, 2.0, lambda cv: cv.sprite(os.path.join(H3, 'exit-open-night.png'), 1.2, 1.1, *spec('tunnel-exit'))),
            ('exit-collapsed', 2.4, 2.0, lambda cv: cv.sprite(os.path.join(H3, 'exit-collapsed-night.png'), 1.2, 1.1, *spec('tunnel-exit'))),
            ('veins', 2.4, 2.0, lambda cv: cv.sprite(os.path.join(H3, 'veins.png'), 1.2, 1.1, *spec('veins-hollow'))),
            ('pillars', 6.0, 5.0, lambda cv: (cv.sprite(os.path.join(H3, 'pillar-1.png'), 1.8, 4.0, *spec('pillar-1-hollow')),
                                              cv.sprite(os.path.join(H3, 'pillar-2.png'), 4.4, 4.2, *spec('pillar-2-hollow')))),
            ('chamber', 4.0, 3.0, lambda cv: cv.sprite(os.path.join(H3, 'chamber.png'), 2.0, 1.6, *spec('chamber-hollow'))),
            ('deep-mound', 6.0, 5.0, lambda cv: (cv.sprite(os.path.join(H3, 'deep-mound.png'), 3.0, 2.8, *spec('deep-mound-hollow')),
                                                 cv.sprite(art('buildings', 'nest-3', 'night'), 5.3, 4.3, 1.4, [0.5, 0.615]))),
        ]
        for name, Wt, Ht, fn in items:
            if tag == 'big' and Wt * T > 900:
                T2 = int(900 / Wt)
            else:
                T2 = T
            cv = patch(Wt, Ht, T2)
            fn(cv)
            p = os.path.join(OUT, f'asset-{name}-{tag}.png'); cv.save(p); out[(name, tag)] = p
        # the floating Crystal over the chasm
        T2 = T if tag == 'game' else 128
        Wt, Ht = 6.0, 6.0
        cv = chasm_patch(Wt, Ht, T2)
        cv.sprite(os.path.join(H3, 'floater.png'), 3.0, 2.9, *spec('floater-hollow'))
        p = os.path.join(OUT, f'asset-floater-{tag}.png'); cv.save(p)
        # the breach: patch of daylight and the column over it, on night floor
        T2 = T if tag == 'game' else 80
        Wt, Ht = 9.0, 9.0
        cv = patch(Wt, Ht, T2, glow=True)
        day = tex_layer(os.path.join(HB, 'ground.png'), cv.w, cv.h, T2)
        bl = load(os.path.join(H3, 'breach-light.png'), (int(7.5 * T2), int(7.5 * T2)))[..., 3]
        m = np.zeros((cv.h, cv.w), np.float32); x0, y0 = int(4.5 * T2 - bl.shape[1] / 2), int(6.0 * T2 - bl.shape[0] / 2)
        m[max(0, y0):y0 + bl.shape[0], x0:x0 + bl.shape[1]] = bl[max(0, -y0):, :][:cv.h - max(0, y0)]
        cv.rgb = cv.rgb * (1 - m[..., None]) + np.clip(day * np.array([1.0, 0.93, 0.8]) * 0.92 + 0.02, 0, 1) * m[..., None]
        beam = load(os.path.join(H3, 'breach-beam.png'), (int(7 * T2), int(14 * T2)))
        cv.add(beam, 4.5 * T2 - 3.5 * T2, 6.0 * T2 - 0.86 * 14 * T2, 0.75)
        p = os.path.join(OUT, f'asset-breach-{tag}.png'); cv.save(p)
        # plants in a row
        T2 = T if tag == 'game' else 128
        cv = patch(6.0, 1.0, T2)
        for k in range(1, 7):
            cv.over(np.concatenate([grade(load(os.path.join(HB, f'plant-{k}.png'), (T2, T2))[..., :3]), load(os.path.join(HB, f'plant-{k}.png'), (T2, T2))[..., 3:]], -1), (k - 1) * T2, 0)
            cv.add(load(os.path.join(HB, f'plant-{k}-glow.png'), (T2, T2)), (k - 1) * T2, 0, 0.92)
        p = os.path.join(OUT, f'asset-plants-{tag}.png'); cv.save(p)
        # the terrain: a swatch of floor, water, rock and chasm at night (4 x 4 tiles each)
        T2 = T if tag == 'game' else 96
        sw = []
        for k in ('ground', 'water', 'rock'):
            c = Canvas(4 * T2, 4 * T2, T2); c.rgb[:] = grade(tex_layer(os.path.join(HB, f'{k}.png'), c.w, c.h, T2))
            if k != 'rock':
                c.rgb = np.clip(c.rgb + tex_layer(os.path.join(HB, f'{k}-glow.png'), c.w, c.h, T2) * 0.92, 0, 1)
            sw.append(c.rgb); sw.append(np.full((4 * T2, 6, 3), 0.1, np.float32))
        c = Canvas(4 * T2, 4 * T2, T2)
        G2 = ['....', 'vvvv', 'vvvv', 'vvvv']
        c.rgb[:] = tex_layer(os.path.join(HB, 'ground.png'), c.w, c.h, T2)
        for j in range(4):
            for i in range(4):
                if G2[j][i] == 'v':
                    key = 'chasm-wall' if j == 1 else 'chasm-wall-2' if j == 2 else 'chasm'
                    c.over(load(os.path.join(HB, f'{key}-hollow.png'), (T2, T2)), i * T2, j * T2)
        c.rgb = grade(c.rgb)
        sw.append(c.rgb)
        Image.fromarray((np.concatenate(sw, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f'asset-terrain-{tag}.png'))
        # the walls: rock meeting floor, with the wall face and the cliff
        T2 = T if tag == 'game' else 96
        G3 = ['####', '####', '....', '....']
        c = Canvas(4 * T2, 4 * T2, T2)
        fl_ = tex_layer(os.path.join(HB, 'ground.png'), c.w, c.h, T2); rk = tex_layer(os.path.join(HB, 'rock.png'), c.w, c.h, T2)
        mR = tile_mask(G3, '#', T2, 1)
        c.rgb[:] = fl_ * (1 - mR[..., None]) + rk * mR[..., None] * (0.5 + 0.5 * sstep(2 * T2, 1 * T2, np.arange(c.h)[:, None]))[..., None]
        wl = load(os.path.join(HB, 'wall.png'), (4 * T2, int(T2 * 0.8)))
        c.over(wl, 0, 2 * T2)
        c.rgb = np.clip(grade(c.rgb) + tex_layer(os.path.join(HB, 'ground-glow.png'), c.w, c.h, T2) * (1 - mR[..., None]) * 0.92, 0, 1)
        Image.fromarray((np.clip(c.rgb, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f'asset-walls-{tag}.png'))
    return out


if __name__ == '__main__':
    what = sys.argv[2:] or ['mock', 'tunnels', 'assets']
    if 'mock' in what:
        hollow_mock()
    if 'mockbig' in what:                                           # the same at 2x, for close-ups
        hollow_mock(96, 'hollow-mock-big')
    if 'tunnels' in what:
        for b in ('desert', 'jungle', 'polar'):
            for t in ('day', 'night'):
                tunnels_scene(b, t)
        tunnels_scene('hollow', 'night')
        for b in ('desert', 'jungle', 'polar'):                 # close-ups: the same at 2x, cropped round two exits
            for t in ('day', 'night'):
                cv = tunnels_scene(b, t, T=96, name=f'tunnels-{b}-{t}-big')
                Image.fromarray((np.clip(cv.rgb, 0, 1) * 255).astype(np.uint8)).crop((int(5.4 * 96), int(1.4 * 96), int(10.6 * 96), int(6.2 * 96))).save(os.path.join(OUT, f'tunnels-{b}-{t}-big.png'))
        tile_set_scene('day'); tile_set_scene('night'); tile_pieces()
    if 'assets' in what:
        assets()
    print('ok', what)
