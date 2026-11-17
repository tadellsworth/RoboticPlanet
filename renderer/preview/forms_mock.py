"""Mock-ups for the Murmur forms sheet (the Leech, the Spitter and the Sapper beside the Scuttler and the Brute),
composed the way the game draws a map (js/render.js, js/daynight.js), with the helpers of hollow_mock.py. Nothing
here is game code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/forms_mock.py <spritedir> <fxdir> <outdir>      (run from renderer/)

<spritedir> holds the composed murmur_moles.js renders (256 px finals, see the job list in the sheet), <fxdir> the
fx/spit_impact.py frames. Writes, for day and night:
    lineup-<form>-<tod>.png     the form between the Scuttler and the Brute at play size, on the Rust, a tile grid
    leech-<tod>.png             the Leech feeding at a Generator and a Fuel Station, hungry to full
    spitter-<tod>.png           the Spitter spitting at a wall: the volley in flight, the impact frames on the wall
    sapper-<tod>.png            the Sapper digging in, its ridge running under a wall (the heave at its head), and
                                coming up inside
    raid-<tod>.png / -big.png   a night raid on a walled colony, all five forms (48 and 96 px a tile)
    phone-<tod>.png             the raid at a phone's 28 px a tile (drawn at 2x for a 3x screen), and the five alone
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

SPR, FX, OUTD = sys.argv[1], sys.argv[2], sys.argv[3]
sys.argv = [sys.argv[0], OUTD]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hollow_mock as hm                      # noqa: E402  (reads its out dir from argv)
from hollow_mock import Canvas, art, grade, load, tex_layer, ridge_layers, avg_ground, draw_roads, road_glow, lamps, street_pools, light_pool, city_glow, CYAN, ART  # noqa: E402

GROUND = os.path.join(ART, 'tiles', 'ground.webp')
B3 = (1.4, [0.5, 0.615])
# play sizes, in tiles across the sprite frame. The game draws the Scuttler's frame 0.62 of a tile and the Brute's
# 0.82 (drawCritter); the new forms are put on the line between them by their frames' world width (SPRITE_W in
# murmur_moles.js): 5.8 -> 0.62, 11.4 -> 0.82.
SPRITE_W = {'scuttler': 5.8, 'leech': 7.6, 'spitter': 6.8, 'sapper': 8.4, 'brute': 11.4, 'shards': 3.2}


def play(form):
    return 0.62 + (SPRITE_W[form] - 5.8) * 0.2 / 5.6


# the volley drawn larger than true to the Spitter (0.31 of a tile) so it reads, as the turrets' shots are
SHOT = 0.6


def per_unit(form):
    return play(form) / SPRITE_W[form]


def spr(name, tod):
    """a composed render: <name>.png by day, <name>-n.png at night"""
    return os.path.join(SPR, name + ('-n' if tod == 'night' else '') + '.png')


def old(c, tod):
    return art('bots', f'{c}-f0', tod)


def shadow(cv, x, y, k):
    """drawCritter's shadow: a soft dark ellipse just below and right of the creature (k: 1 Scuttler, 1.7 Brute)"""
    S = 4; w, h = int(0.4 * k * cv.T * S), int(0.24 * k * cv.T * S)
    im = Image.new('L', (w, h), 0); ImageDraw.Draw(im).ellipse((0, 0, w - 1, h - 1), fill=int(255 * 0.3))
    a = np.asarray(im.resize((max(1, w // S), max(1, h // S)), Image.LANCZOS)).astype(np.float32) / 255
    patch = np.zeros(a.shape + (4,), np.float32); patch[..., 0] = 20 / 255; patch[..., 1] = 8 / 255; patch[..., 2] = 20 / 255; patch[..., 3] = a
    cv.over(patch, (x + 0.03) * cv.T - a.shape[1] / 2, (y + 0.08) * cv.T - a.shape[0] / 2)


def murmur(cv, kind, x, y, rot, tod, scale=None):
    """one of the Murmur at tile (x, y), facing rot (radians, 0 = east, clockwise on screen), with its shadow"""
    base = kind.split('-')[0]
    if base != 'shards' and kind not in ('sapper-dig', 'sapper-heave', 'sapper-surface'):
        sz = scale or play(base)
        shadow(cv, x, y, 1 + (sz - 0.62) / 0.2 * 0.7)
    if kind in ('scuttler', 'brute'):
        cv.sprite(old(kind, tod), x, y, scale or play(kind), [0.5, 0.5], rot=rot)
        return
    form = {'leech': 'leech', 'spitter': 'spitter', 'sapper': 'sapper', 'shards': 'shards'}[kind.split('-')[0]]
    cv.sprite(spr(kind, tod), x, y, scale or play(form), [0.5, 0.5], rot=rot)


def fx(cv, name, x, y, size, rot=0.0, k=1.0, tod='day'):
    """an effect frame (art on transparent). At night its dust is graded like everything unlit, and its bright parts
    (the flash, splinters, arcs, embers) keep their light"""
    p = os.path.join(FX, name + '.png')
    px = int(round(size * cv.T))
    s = load(p, (px, px))
    if rot:
        s = np.asarray(Image.fromarray((s * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
    if tod == 'night':
        lum = s[..., :3].max(-1, keepdims=True); hot = np.clip((lum - 0.5) / 0.4, 0, 1)
        d = s.copy(); d[..., :3] = grade(s[..., :3]) * (1 - hot) + s[..., :3] * hot
        s = d
    cv.over(s, x * cv.T - px / 2, y * cv.T - px / 2, k)


def grid(cv, k=0.12):
    for i in range(0, cv.w, cv.T):
        cv.rgb[:, i:i + 1] = cv.rgb[:, i:i + 1] * (1 - k) + k
    for j in range(0, cv.h, cv.T):
        cv.rgb[j:j + 1] = cv.rgb[j:j + 1] * (1 - k) + k


def ground(cv, tod, plants=(), ridges=None, roads=None, seed=5, t=0.6, dark=()):
    """the Rust's ground, its plants, tunnel ridges and roads, graded for the time of day. dark: [(x, y, r)] where a
    Leech is drinking the road lights (their edge strips fade out round it). Returns the ridges' glow layer."""
    cv.rgb[:] = tex_layer(GROUND, cv.w, cv.h, cv.T)
    for i, j, k in plants:
        cv.over(load(art('biomes/desert', f'plant-{k}'), (cv.T, cv.T)), i * cv.T, j * cv.T)
    rg = None
    if ridges:
        nm = f'r{abs(hash(json_key(ridges, cv))) % 10 ** 8}'
        g = avg_ground(GROUND)
        rl = ridge_layers([{'name': nm + '-b', 'w': cv.w, 'h': cv.h, 'tile': cv.T, 'ground': g, 'layer': 'base', 'ridges': ridges, 'seed': seed},
                           {'name': nm + '-g', 'w': cv.w, 'h': cv.h, 'tile': cv.T, 'ground': g, 'layer': 'glow', 'ridges': ridges, 'seed': seed, 't': t}])
        cv.over(rl[nm + '-b'], 0, 0)
        rg = rl[nm + '-g']
    if roads:
        cv.over(draw_roads(cv, roads, tod), 0, 0)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)
        if rg is not None:
            cv.add(rg, 0, 0, 0.92)
        if roads:
            before = cv.rgb.copy()
            road_glow(cv, roads)
            cv.rgb = before + (cv.rgb - before) * lit_mask(cv, dark)[..., None]
    return rg


def lit_mask(cv, dark):
    """1 where the lights burn, falling to 0 round each point a Leech drinks at"""
    m = np.ones((cv.h, cv.w), np.float32)
    yy, xx = np.mgrid[0:cv.h, 0:cv.w].astype(np.float32) / cv.T
    for x, y, r in dark:
        m *= hm.sstep(0.35 * r, r, np.hypot(xx - x, yy - y)).astype(np.float32)
    return m


def is_dark(x, y, dark):
    return any(math.hypot(x - a, y - b) < 0.7 * r for a, b, r in dark)


def json_key(ridges, cv):
    import json
    return json.dumps([ridges, cv.w, cv.h, cv.T])


# ------------------------------------------------------------------------------------------------ walls (drawBarrierArt)
def wall_layers(walls, gates, x, y):
    """the art keys for the wall at (x, y), in drawing order, as drawBarrierArt picks them"""
    if (x, y) in gates:
        return [f'gate-{gates[(x, y)]}-closed@0']
    joins = lambda di, dj: (x + di, y + dj) in walls or (x + di, y + dj) in gates
    N, E, S, W = joins(0, -1), joins(1, 0), joins(0, 1), joins(-1, 0)
    L = []
    if N: L.append('wall-n@0')
    if W: L.append('wall-w@0')
    if E: L.append('wall-e@0')
    ew, ns = E and W and not N and not S, N and S and not E and not W
    L.append(('wall-hub-ew@0' if ew else 'wall-hub-ns@0') if (ew or ns) and (x + y) % 2 == 1 else 'wall-post@0')
    if S: L.append('wall-s@0')
    return L


def draw_wall(cv, walls, gates, x, y, tod):
    for k in wall_layers(walls, gates, x, y):
        cv.sprite(art('buildings/walls', k, tod), x + 0.5, y + 0.5, *B3)


def building(cv, key, x, y, tod, head=None):
    s = (1.3, [0.5, 0.615]) if key.startswith('minigun') else B3
    cv.sprite(art('buildings', key, tod), x, y, *s)
    if head is not None:
        cv.sprite(art('buildings', f'turret-head-{head}@0', tod), x, y, *s)


def lamp(cv, kind, fx_, fy, tod):
    """a streetlamp; tod 'off': a night with its light drunk"""
    if tod == 'off':
        cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914], mul='night')
    elif tod == 'night':
        cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914], mul='night')
        cv.sprite(art('roads', f'streetlamp-{kind}-lit@0'), fx_, fy, 1, [0.5, 0.914])
    else:
        cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914])


def head_to(x0, y0, x1, y1):
    return int(round(math.atan2(y1 - y0, x1 - x0) / (2 * math.pi / 16))) % 16


def violet_pool(cv, x, y, k=0.5, size=1.4):
    """(a proposal) the light a charged Murmur throws on the ground round it at night"""
    light_pool(cv, x, y, np.array([0.62, 0.4, 1.0]), k, size)


def save(cv, name):
    cv.save(os.path.join(OUTD, name + '.png'))


# ------------------------------------------------------------------------------------------------ the panels
def lineup(form, tod, T=96):
    """the form between the Scuttler and the Brute, at play size, a faint tile grid under them"""
    cv = Canvas(int(4.2 * T), int(1.5 * T), T)
    ground(cv, tod)
    grid(cv, 0.1 if tod == 'day' else 0.05)
    murmur(cv, 'scuttler', 0.75, 0.75, 0, tod)
    murmur(cv, form + '-walk', 2.0, 0.75, 0, tod)
    murmur(cv, 'brute', 3.35, 0.75, 0, tod)
    save(cv, f'lineup-{form}-{tod}')


def lineup_all(tod, T=96):
    cv = Canvas(int(6.2 * T), int(1.4 * T), T)
    ground(cv, tod)
    grid(cv, 0.1 if tod == 'day' else 0.05)
    for x, k in [(0.6, 'scuttler'), (1.75, 'spitter-walk'), (2.95, 'leech-walk'), (4.15, 'sapper-walk'), (5.45, 'brute')]:
        murmur(cv, k, x, 0.7, 0, tod)
    save(cv, f'lineup-all-{tod}')


def leech_panel(tod, T=96):
    """the Leech feeding: hungry, just latched onto a Generator; at a streetlamp, the road's lights going out round it;
    full, at a Fuel Station"""
    cv = Canvas(int(7 * T), int(3.2 * T), T)
    roads = {(i, 2): 'c' for i in range(-1, 8)}
    dark = [(2.5, 2.8, 2.4)]
    ground(cv, tod, roads=roads, dark=dark)
    L = [l for l in lamps(roads)]
    if tod == 'night':
        street_pools(cv, [l for l in L if not is_dark(*l[3], dark)])
        for x, y in [(1.2, 1.1), (5.6, 1.1)]:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        violet_pool(cv, 2.05, 2.85, 0.4, 1.2); violet_pool(cv, 4.95, 1.25, 0.45, 1.3)
    items = [(1.1, 'b', 'generator@0', 1.2, 1.1), (1.1, 'b', 'charger@0', 5.6, 1.1),
             (1.3, 'm', 'leech-hungry', 0.55, 1.3, 0.2), (2.84, 'm', 'leech-half', 2.06, 2.84, 0.0), (1.25, 'm', 'leech-full', 4.95, 1.25, 0.0)]
    for kind, i, j, (fx_, fy) in L:
        items.append((fy - 0.01, 'lamp', kind, fx_, fy))
    for it in sorted(items, key=lambda t: t[0]):
        if it[1] == 'b':
            building(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], 'day' if tod == 'day' else ('off' if is_dark(it[3], it[4], dark) else tod))
        else:
            murmur(cv, it[2], it[3], it[4], it[5], tod, play('leech'))
    save(cv, f'leech-{tod}')


def spitter_panel(tod, T=96):
    """the Spitter at range from a wall: spitting, its volley in flight, the volley striking the wall's face"""
    cv = Canvas(int(7 * T), int(3 * T), T)
    walls = {(5, j) for j in range(0, 3)}
    ground(cv, tod)
    if tod == 'night':
        violet_pool(cv, 1.0, 1.5, 0.35, 1.2)
    murmur(cv, 'spitter-spit', 1.0, 1.5, 0.0, tod)
    for j in range(3):
        draw_wall(cv, walls, {}, 5, j, tod)
    murmur(cv, 'shards', 2.9, 1.48, 0.0, tod, SHOT)
    fx(cv, 'spit-impact-f1', 5.15, 1.5, 1.0, tod=tod)
    fx(cv, 'spit-impact-stain', 5.15, 0.55, 0.9, k=0.9, tod=tod)
    save(cv, f'spitter-{tod}')


def impact_strip(tod, T=96, n=8):
    """the eight impact frames, each on the face of a wall (the shards came from the left)"""
    cell = 1.3
    cv = Canvas(int(n * cell * T), int(cell * T), T)
    ground(cv, tod)
    for i in range(n):
        x = i * cell + 0.75
        cv.sprite(art('buildings/walls', 'wall-hub-ns@0', tod), x, 0.62, *B3)
        fx(cv, f'spit-impact-f{i}', x - 0.32, 0.62, 1.0, tod=tod)
    save(cv, f'impact-{tod}')


SAP_RIDGE = [{'pts': [[0.9, 1.4], [2.2, 1.9], [3.6, 2.0], [4.9, 1.75]], 'w': 1.0, 'age': 1.0}]


def sapper_panel(tod, T=96):
    """digging in (left), its ridge running for the wall with the heave at its head, and one up inside (right)"""
    cv = Canvas(int(9 * T), int(3.4 * T), T)
    walls = {(6, j) for j in range(0, 4)}
    rid = SAP_RIDGE + [{'pts': [[4.9, 1.75], [6.2, 2.3], [7.4, 2.4], [7.9, 1.9]], 'w': 1.0, 'age': 1.0}]
    ground(cv, tod, ridges=rid, seed=11, t=0.3)
    murmur(cv, 'sapper-dig', 0.62, 1.32, 0.35, tod)
    murmur(cv, 'sapper-heave', 5.05, 1.72, -0.18, tod)
    for j in range(4):
        draw_wall(cv, walls, {}, 6, j, tod)
    if tod == 'night':
        violet_pool(cv, 8.0, 1.75, 0.35, 1.3)
    murmur(cv, 'sapper-surface', 8.05, 1.7, -0.9, tod)
    save(cv, f'sapper-{tod}')


# ------------------------------------------------------------------------------------------------ the raid
RW, RH = 18, 11


def raid(tod, T=48, name=None, plants_k=0.12):
    cv = Canvas(RW * T, RH * T, T)
    walls = {(8, j) for j in range(1, 10)} | {(i, 1) for i in range(8, 18)} | {(i, 9) for i in range(8, 18)}
    gates = {(8, 5): 'ns'}
    walls -= set(gates)
    roads = {(i, 5): 'c' for i in range(5, 18)} | {(12, j): 'c' for j in range(2, 9)}
    roads.pop((8, 5), None); roads[(8, 5)] = 'c'
    builds = [('generator@0', 13.5, 3.5), ('charger@0', 14.5, 7.5), ('depot@0', 16.0, 3.4), ('turret@0', 10.5, 2.5), ('turret@0', 10.5, 7.5)]
    # tunnels from a nest off the west edge: two exits short of the walls; a Sapper's fresh ridge running for the
    # west wall (the heave at its head), and another's that went under the south wall and came up inside
    ridges = [
        {'pts': [[-0.6, 2.4], [1.4, 2.9], [3.0, 3.4], [4.3, 3.2]], 'w': 1.1, 'age': 0.5},
        {'pts': [[-0.6, 6.4], [1.4, 6.7], [3.1, 7.0], [4.5, 6.8]], 'w': 1.1, 'age': 0.6},
        {'pts': [[3.1, 7.0], [4.4, 8.2], [5.9, 8.8], [7.2, 8.6]], 'w': 0.9, 'age': 1.0},
        {'pts': [[1.4, 6.7], [2.6, 8.9], [5.0, 10.2], [8.4, 10.3], [10.4, 9.6], [11.1, 8.5]], 'w': 0.9, 'age': 1.0},
    ]
    rng = np.random.default_rng(4)
    plants = [(i, j, int(rng.integers(1, 7))) for j in range(RH) for i in range(RW)
              if rng.uniform() < plants_k and (i < 7 or j < 1 or j > 9) and (i, j) not in roads]
    dark = [(5.5, 5.85, 2.4)]
    ground(cv, tod, plants=plants, ridges=ridges, roads=roads, seed=7, t=0.5, dark=dark)
    L = lamps(roads)
    if tod == 'night':
        street_pools(cv, [l for l in L if not is_dark(*l[3], dark)])
        for key, x, y in builds:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        city_glow(cv, [(x, y, False) for _, x, y in builds], CYAN)
        for x, y, k in [(13.0, 3.6, 0.5), (5.3, 2.6, 0.3), (5.9, 6.9, 0.3), (11.2, 8.1, 0.3), (5.1, 5.85, 0.35)]:
            violet_pool(cv, x, y, k, 1.3)
    items = []
    for (x, y) in walls | set(gates):
        items.append((y + 0.5, 'wall', x, y))
    for i, (key, x, y) in enumerate(builds):
        head = head_to(x, y, *((5.3, 2.6) if y < 5 else (7.3, 7.5))) if key == 'turret@0' else None
        items.append((y, 'b', key, x, y, head))
    for kind, i, j, (fx_, fy) in L:
        if not (8 <= i and 1 <= j <= 9 and (i == 8 or j in (1, 9))):
            items.append((fy, 'lamp', kind, fx_, fy))
    for x, y, st in [(4.35, 3.2, 'tunnel-exit'), (4.55, 6.8, 'tunnel-exit')]:
        items.append((y - 0.3, 'exit', st, x, y))
    mm = [  # kind, x, y, facing
        ('scuttler', 6.6, 4.6, 0.15), ('scuttler', 7.3, 5.25, 0.0), ('scuttler', 6.2, 5.7, -0.25), ('scuttler', 7.0, 4.15, 0.4), ('scuttler', 5.5, 3.6, 0.6),
        ('brute', 7.3, 7.5, 0.05),
        ('spitter-spit', 5.3, 2.6, 0.0), ('spitter-spit', 5.9, 6.9, -0.35), ('spitter-walk', 3.2, 4.6, 0.5),
        ('sapper-heave', 7.25, 8.6, -0.15), ('sapper-surface', 11.1, 8.3, -1.2),
        ('leech-full', 12.8, 3.62, 0.0), ('leech-walk', 10.1, 8.75, -0.9), ('leech-half', 5.08, 5.84, 0.0),
    ]
    for k, x, y, f in mm:
        items.append((y, 'mm', k, x, y, f))
    for it in sorted(items, key=lambda t: t[0]):
        kind = it[1]
        if kind == 'wall':
            draw_wall(cv, walls, gates, it[2], it[3], tod)
        elif kind == 'b':
            building(cv, it[2], it[3], it[4], tod, it[5])
        elif kind == 'lamp':
            lamp(cv, it[2], it[3], it[4], 'off' if tod == 'night' and is_dark(it[3], it[4], dark) else tod)
        elif kind == 'exit':
            cv.sprite(art('buildings', it[2], tod), it[3], it[4], 1.05, [0.5, 0.6145])
        else:
            murmur(cv, it[2], it[3], it[4], it[5], tod)
    # the shots: a volley in flight over the wall at the north turret, one striking the wall's face to the south
    sh = SHOT
    murmur(cv, 'shards', 8.4, 2.55, 0.0, tod, sh)
    fx(cv, 'spit-impact-f0', 10.3, 2.45, 0.9, tod=tod)
    murmur(cv, 'shards', 7.1, 6.45, -0.35, tod, sh)
    fx(cv, 'spit-impact-f2', 8.15, 6.2, 1.0, tod=tod)
    fx(cv, 'spit-impact-stain', 8.2, 3.6, 0.8, k=0.8, tod=tod)
    save(cv, name or f'raid-{tod}' + ('-big' if T > 48 else ''))
    return cv


def phone(tod):
    """the raid as a phone shows it: 28 px a tile (drawn at 56 for a high-density screen), and the five forms alone"""
    raid(tod, 56, name=f'phone-raid-{tod}')
    cv = Canvas(int(6.2 * 56), int(1.4 * 56), 56)
    ground(cv, tod)
    for x, k in [(0.6, 'scuttler'), (1.75, 'spitter-walk'), (2.95, 'leech-walk'), (4.15, 'sapper-walk'), (5.45, 'brute')]:
        murmur(cv, k, x, 0.7, 0, tod)
    save(cv, f'phone-five-{tod}')


if __name__ == '__main__':
    for tod in ('day', 'night'):
        for f in ('leech', 'spitter', 'sapper'):
            lineup(f, tod)
        lineup_all(tod)
        leech_panel(tod)
        spitter_panel(tod)
        sapper_panel(tod)
        impact_strip(tod)
        raid(tod, 48)
        raid(tod, 96)
        phone(tod)
    print('wrote', OUTD)
