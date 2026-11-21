"""Mock-ups for the behemoth design sheet (three directions for the biggest Murmur form: the Harrow, the Maw and the
Bearer), composed the way the game draws a map, with the helpers of hollow_mock.py and forms_mock.py. Nothing here is
game code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/behemoth_mock.py <spritedir> <outdir>      (run from renderer/)

<spritedir> holds the composed murmur_behemoth.js renders (<c>-<pose>.png by day, -n at night). Writes, by day and
at night:
    scale-<c>-<tod>.png    a warbot squad, a Brute, a Command Base and the behemoth, at play size on a tile grid
    siege-<c>-<tod>.png    the behemoth doing what it does at a walled colony (48 px a tile, the desktop game)
    hollow-<c>.png         the Hollow (always night): two of it bursting out of the Deep's mound, north and south
"""
import math
import os
import sys
import numpy as np

SPRB, OUTD = sys.argv[1], sys.argv[2]
sys.argv = [sys.argv[0], SPRB, SPRB, OUTD]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import forms_mock as fm                       # noqa: E402  (reads its dirs from argv)
from forms_mock import Canvas, art, ground, grid, draw_wall, building, lamp, lamps, is_dark, street_pools, light_pool, city_glow, CYAN, head_to, old, shadow, tex_layer, grade, load, ridge_layers, avg_ground, ART  # noqa: E402

FRAME = 6.0                                   # murmur_behemoth.js FRAME_TILES: the frame is drawn 6 tiles wide
VIOLET = np.array([0.62, 0.4, 1.0])
LANDER = (2.4, [0.5, 0.615])


def beh(cv, name, x, y, rot, tod, k=1.0):
    p = os.path.join(SPRB, name + ('-n' if tod == 'night' else '') + '.png')
    cv.sprite(p, x, y, FRAME * k, [0.5, 0.5], rot=rot)


def beh_shadow(cv, x, y, rx, ry, a=0.42):
    """a big soft shadow under it (drawCritter's, grown)"""
    yy, xx = np.mgrid[0:cv.h, 0:cv.w].astype(np.float32) / cv.T
    d = ((xx - x - 0.15) / rx) ** 2 + ((yy - y - 0.3) / ry) ** 2
    m = np.clip(1.2 - d, 0, 1) ** 1.5 * a
    cv.rgb = cv.rgb * (1 - m[..., None]) + np.array([20, 8, 20]) / 255 * m[..., None]


def pool(cv, x, y, k, size):
    light_pool(cv, x, y, VIOLET, k, size)


def dark_mask(cv, x, y, r):
    """the lights drawn out round a Bearer: everything lit fades toward the night grade inside r"""
    yy, xx = np.mgrid[0:cv.h, 0:cv.w].astype(np.float32) / cv.T
    return fm.hm.sstep(0.5 * r, r, np.hypot(xx - x, yy - y)).astype(np.float32)


def bot(cv, key, x, y, rot, tod, size=0.6):
    cv.sprite(art('bots', key, tod), x, y, size, [0.5, 0.5], rot=rot)


def save(cv, name):
    cv.save(os.path.join(OUTD, name + '.png'))


def key_pose(c):
    return {'harrow': 'harrow-walk', 'maw': 'maw-up', 'bearer': 'bearer-walk'}[c]


# ------------------------------------------------------------------------------------------------ scale
def scale(c, tod, T=48):
    cv = Canvas(int(17 * T), int(7.4 * T), T)
    ground(cv, tod)
    grid(cv, 0.1 if tod == 'day' else 0.05)
    if tod == 'night':
        light_pool(cv, 6.4, 3.7, CYAN, 0.8, 3.4)
        pool(cv, 12.6, 3.7, 0.75, 8.5)
    # a squad of six warbots, a Brute, a Command Base
    for i in range(6):
        bot(cv, 'warbot@0-f0', 0.8 + (i % 2) * 0.7, 2.3 + (i // 2) * 0.9, 0, tod)
    shadow(cv, 3.0, 3.7, 1.7)
    cv.sprite(art('bots', 'brute-f0', tod), 3.0, 3.7, 0.82, [0.5, 0.5])
    if tod == 'night':
        cv.add(load(art('bots', 'brute-f0-glow'), (int(0.82 * T), int(0.82 * T))), 3.0 * T - 0.41 * T, 3.7 * T - 0.41 * T, 0.8)
    cv.sprite(art('buildings', 'lander@0', tod), 6.4, 3.9, *LANDER)
    if c != 'maw':
        beh_shadow(cv, 12.6, 3.7, 2.3, 1.5)
    beh(cv, key_pose(c), 12.6, 3.7, 0, tod)
    save(cv, f'scale-{c}-{tod}')


# ------------------------------------------------------------------------------------------------ at a colony
def colony(cv, tod, walls, gates, roads, builds, dark=(), bots_=(), skip_walls=()):
    """walls, roads, lamps and buildings drawn in depth order with the behemoth items given in bots_"""
    L = lamps(roads)
    if tod == 'night':
        street_pools(cv, [l for l in L if not is_dark(*l[3], dark)])
        for key, x, y in builds:
            if not is_dark(x, y, dark):
                light_pool(cv, x, y, CYAN, 0.8, 2.2 if 'lander' not in key else 3.4)
        city_glow(cv, [(x, y, 'lander' in k) for k, x, y in builds if not is_dark(x, y, dark)], CYAN)
    items = []
    for (x, y) in (walls | set(gates)):
        if (x, y) not in skip_walls:
            items.append((y + 0.5, 'wall', x, y))
    for key, x, y in builds:
        items.append((y, 'b', key, x, y))
    for kind, i, j, (fx_, fy) in L:
        if (i, j) not in walls:
            items.append((fy, 'lamp', kind, fx_, fy))
    for b in bots_:
        items.append(b)
    for it in sorted(items, key=lambda t: t[0]):
        kind = it[1]
        if kind == 'wall':
            draw_wall(cv, walls - set(skip_walls), gates, it[2], it[3], tod)
        elif kind == 'b':
            key = it[2]
            if key.startswith('turret'):
                building(cv, 'turret@0', it[3], it[4], tod, int(key.split(':')[1]))
            elif key.startswith('lander'):
                cv.sprite(art('buildings', 'lander@0', tod if not is_dark(it[3], it[4], dark) else 'night'), it[3], it[4], *LANDER)
            else:
                building(cv, key, it[3], it[4], tod if not is_dark(it[3], it[4], dark) else tod)
        elif kind == 'lamp':
            lamp(cv, it[2], it[3], it[4], 'off' if tod == 'night' and is_dark(it[3], it[4], dark) else tod)
        elif kind == 'bot':
            bot(cv, it[2], it[3], it[4], it[5], tod, it[6] if len(it) > 6 else 0.6)
        elif kind == 'beh':
            beh(cv, it[2], it[3], it[4], it[5], tod)
        elif kind == 'old':
            cv.sprite(old(it[2], tod), it[3], it[4], 0.62, [0.5, 0.5], rot=it[5])


def siege_harrow(tod, T=48):
    W, H = 22, 12
    cv = Canvas(W * T, H * T, T)
    walls = {(13, j) for j in range(1, 11)} | {(i, 1) for i in range(13, 22)} | {(i, 10) for i in range(13, 22)}
    gates = {(13, 8): 'ns'}
    walls -= set(gates)
    broken = {(13, 4), (13, 5), (13, 6)}
    # the road it walked down is gone where it went: torn up under its furrow
    roads = {(i, 8): 'c' for i in range(0, 22)} | {(17, j): 'c' for j in range(2, 10)} | {(2, j): 'c' for j in range(0, 8)}
    # the furrow it has torn across the land and the road behind it: a heaved ridge, drawn as the tunnels are
    ridges = [{'pts': [[-0.5, 3.2 + d], [2.5, 4.4 + d], [5.5, 4.9 + d], [9.0, 5.1 + d]], 'w': 1.3, 'age': 1.0} for d in (-0.55, 0.0, 0.55)]
    rng = np.random.default_rng(3)
    plants = [(i, j, int(rng.integers(1, 7))) for j in range(H) for i in range(W) if rng.uniform() < 0.1 and i < 12 and (i, j) not in roads]
    for j in (3, 4, 5):
        roads.pop((2, j))
    ground(cv, tod, plants=plants, ridges=ridges, roads=roads, seed=5, t=0.6)
    if tod == 'night':
        pool(cv, 10.6, 5.2, 0.85, 10)
    builds = [('turret:8', 15.5, 3.5), ('turret:8', 15.5, 6.6), ('generator@0', 19.5, 3.5), ('depot@0', 19.6, 6.4), ('bunker@0', 15.4, 9.2)]
    bots_ = []
    army = [(15.0, 4.6), (14.6, 5.4), (15.2, 5.9), (16.2, 4.9), (16.4, 5.8), (14.4, 2.8), (16.6, 3.0), (11.6, 9.5), (12.2, 10.3)]
    for i, (x, y) in enumerate(army):
        bots_.append((y, 'bot', 'warbot@0-f0' if i % 3 else 'bulwark@0-f0', x, y, math.atan2(5.1 - y, 11.0 - x), 0.6 if i % 3 else 0.68))
    bots_.append((5.2, 'beh', 'harrow-slam', 10.4, 5.1, 0.0))
    colony(cv, tod, walls, gates, roads, builds, bots_=bots_, skip_walls=broken)
    save(cv, f'siege-harrow-{tod}')


def siege_maw(tod, T=48):
    W, H = 22, 12
    cv = Canvas(W * T, H * T, T)
    walls = {(3, j) for j in range(0, 12)} | {(i, 0) for i in range(3, 22)} | {(i, 11) for i in range(3, 22)}
    gates = {(3, 6): 'ns'}
    walls -= set(gates)
    roads = {(i, 6): 'c' for i in range(0, 22)} | {(16, j): 'c' for j in range(1, 11)}
    for (i, j) in [(9, 6), (10, 6), (11, 6), (12, 6), (13, 6), (8, 6)]:
        roads.pop((i, j))
    ground(cv, tod, roads=roads, seed=9, t=0.5)
    if tod == 'night':
        pool(cv, 10.6, 6.0, 0.95, 9)
    builds = [('generator@0', 6.6, 2.6), ('smelter@0', 13.6, 2.4), ('depot@0', 19.0, 3.0), ('charger@0', 6.6, 9.4), ('fab@0', 13.8, 9.6), ('lander@0', 19.4, 8.6), ('turret:4', 18.5, 5.0)]
    bots_ = []
    for i, (x, y) in enumerate([(16.4, 4.6), (16.9, 5.4), (17.2, 7.1), (16.2, 7.6), (5.6, 5.0), (5.0, 7.2), (4.6, 6.0), (17.8, 6.2)]):
        bots_.append((y, 'bot', 'warbot@0-f0', x, y, math.atan2(6 - y, 10.6 - x)))
    bots_.append((6.0, 'beh', 'maw-erupt', 10.6, 6.0, 0.0))
    colony(cv, tod, walls, gates, roads, builds, bots_=bots_)
    save(cv, f'siege-maw-{tod}')


def siege_bearer(tod, T=48):
    W, H = 22, 12
    cv = Canvas(W * T, H * T, T)
    walls = {(14, j) for j in range(0, 12)}
    gates = {(14, 6): 'ns'}
    walls -= set(gates)
    roads = {(i, 6): 'c' for i in range(0, 22)} | {(18, j): 'c' for j in range(0, 12)} | {(10, j): 'c' for j in range(0, 12)}
    for (i, j) in [(7, 6), (6, 6), (5, 6), (4, 6), (8, 6)]:
        roads.pop((i, j))
    dark = [(6.2, 6.0, 7.5)]
    ground(cv, tod, roads=roads, seed=4, t=0.5, dark=dark)
    if tod == 'night':
        pool(cv, 6.2, 6.0, 1.0, 11)
    builds = [('generator@0', 11.8, 3.4), ('charger@0', 11.8, 8.6), ('turret:8', 13.0, 5.0), ('turret:8', 13.0, 7.2), ('depot@0', 16.4, 3.0), ('smelter@0', 20.2, 3.2), ('lander@0', 20.0, 8.8)]
    bots_ = []
    for i, (x, y) in enumerate([(15.4, 5.0), (15.8, 6.9), (16.6, 6.0), (15.2, 8.0)]):
        bots_.append((y, 'bot', 'warbot@0-f0', x, y, math.pi))
    for (x, y, r) in [(9.6, 4.2, -0.3), (10.4, 5.4, 0.1), (9.8, 7.6, 0.3), (11.0, 8.0, 0.2), (8.8, 9.6, 0.4), (10.8, 2.6, -0.4)]:
        bots_.append((y, 'old', 'scuttler', x, y, r))
    bots_.append((6.0, 'beh', 'bearer-draw', 6.2, 6.0, 0.0))
    colony(cv, tod, walls, gates, roads, builds, dark=dark, bots_=bots_)
    save(cv, f'siege-bearer-{tod}')


# ------------------------------------------------------------------------------------------------ the Hollow
def hollow(c, T=36):
    """the Deep's mound in the Hollow's central chamber, almost destroyed: two of the behemoth burst out of it, one
    for each colony, north and south"""
    W, H = 16, 27
    cv = Canvas(W * T, H * T, T)
    cv.rgb[:] = tex_layer(os.path.join(ART, 'biomes', 'hollow', 'ground.webp'), cv.w, cv.h, T)
    rid = [{'pts': [[8, 13.5], [7.2, 9.5], [8.4, 5.0], [7.6, 1.0]], 'w': 1.6, 'age': 0.4},
           {'pts': [[8, 13.5], [8.8, 17.5], [7.6, 22.0], [8.4, 26.5]], 'w': 1.6, 'age': 0.4},
           {'pts': [[8, 13.5], [12.0, 12.0], [16.5, 12.6]], 'w': 1.0, 'age': 0.3},
           {'pts': [[8, 13.5], [4.0, 14.6], [-0.5, 14.0]], 'w': 1.0, 'age': 0.3}]
    g = avg_ground(os.path.join(ART, 'biomes', 'hollow', 'ground.webp'))
    rl = ridge_layers([{'name': f'hol-{c}-b', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g, 'layer': 'base', 'ridges': rid, 'seed': 3},
                       {'name': f'hol-{c}-g', 'w': cv.w, 'h': cv.h, 'tile': T, 'ground': g, 'layer': 'glow', 'ridges': rid, 'seed': 3, 't': 0.6}])
    cv.over(rl[f'hol-{c}-b'], 0, 0)
    cv.rgb = grade(cv.rgb)
    cv.add(rl[f'hol-{c}-g'], 0, 0, 0.92)
    # the colonies, north and south, their light at the edges
    for y in (1.6, 25.6):
        light_pool(cv, 8, y, CYAN, 0.85, 3.6)
        for x in (4.0, 12.0):
            light_pool(cv, x, y + (0.4 if y < 5 else -0.4), CYAN, 0.7, 2.2)
    pool(cv, 8, 13.4, 0.9, 9)
    pool(cv, 8, 6.4, 0.9, 9); pool(cv, 8, 20.4, 0.9, 9)
    cv.sprite(art('buildings', 'lander@0', 'night'), 8, 1.8, *LANDER)
    cv.sprite(art('buildings', 'lander@1', 'night'), 8, 25.6, *LANDER)
    for x, y in ((4.0, 2.0), (12.0, 2.0)):
        building(cv, 'turret@0', x, y, 'night', 12)
    for x, y in ((4.0, 25.2), (12.0, 25.2)):
        cv.sprite(art('buildings', 'turret@1', 'night'), x, y, *fm.B3)
    # the mound, broken and almost down: drawn darker (most of its armour gone), then the two coming out of it
    mound = load(os.path.join(ART, 'biomes', 'hollow', 'deep-mound.webp'), (int(5.6 * T), int(5.6 * T))).copy()
    mound[..., :3] *= 0.72
    cv.over(mound, 8 * T - 2.8 * T, 13.6 * T - 0.6145 * 5.6 * T)
    name = 'maw-erupt' if c == 'maw' else f'{c}-emerge'
    beh(cv, name, 8, 7.4, -math.pi / 2, 'night')
    beh(cv, name, 8, 19.6, math.pi / 2, 'night')
    save(cv, f'hollow-{c}')


if __name__ == '__main__':
    os.makedirs(OUTD, exist_ok=True)
    for tod in ('day', 'night'):
        for c in ('harrow', 'maw', 'bearer'):
            scale(c, tod)
        siege_harrow(tod)
        siege_maw(tod)
        siege_bearer(tod)
    for c in ('harrow', 'maw', 'bearer'):
        hollow(c)
    print('wrote', OUTD)
