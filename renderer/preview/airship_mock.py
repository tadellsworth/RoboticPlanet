"""Pictures for the Airship design sheet: the three directions' airships and Mooring Masts drawn the way the game draws
a map (js/render.js: ground textures, roads, the night grade, buildings by depth, aircraft last with their shadows
down-sun), beside today's Cargo Plane, Freight Truck and buildings. Nothing here is game code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/airship_mock.py <renderdir> <outdir>      (run from renderer/)

<renderdir> holds the composed renders (see preview/airship_sheet.py for the job list): the airships <v><t> and
<v><t>-n (v = a, b, c; t = 0, 1; -n at night) from b/airship.js, the masts m<v><t> and m<v><t>-n from b/mast.js, with
their .beauty.png and .geom.json. Writes, by day and at night:
    ship-<v>-<tod>.png        the airship in both team colours, in flight over the ground with its shadow
    shadow-<v>.png            the ground shadow image (its silhouette, softened), on its own
    mast-<v>-<tod>.png        the mast in both team colours
    docked-<v>-<tod>.png      an airship moored at its mast, as the game would draw it
    mock-<v>-<tod>.png        a stretch of colony at game scale (48 px a tile); -big at 96
    scale-<tod>.png           Freight Truck, a one-tile building, the Cargo Plane in flight and the three airships
    phone-<tod>.png           the same line-up at a phone's 28 px a tile (drawn at 56)
"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SPR, OUTD = sys.argv[1], sys.argv[2]
os.makedirs(OUTD, exist_ok=True)
sys.argv = [sys.argv[0], os.path.join(OUTD, '_hollow')]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hollow_mock import Canvas, art, grade, load, tex_layer, tile_mask, sstep, draw_roads, road_glow, lamps, street_pools, light_pool, city_glow, CYAN, ART  # noqa: E402

RED = np.array([255, 90, 110]) / 255
TEAMC = {0: CYAN, 1: RED}
FRAME = 3.0                   # tiles across an airship's frame: 30 world units, 0.1 tile a unit (the pad is 10 units, one tile)
B3 = (1.4, [0.5, 0.615])      # every building (B3D in art/art-manifest.js)
DOCK_OFF, FLY_OFF = 0.8, 1.05  # shadow offsets (tiles): moored at the mast head, and cruising (a Cargo Plane's is 1.17)
GROUND = art('tiles', 'ground'); WATER = art('tiles', 'water'); ROCK = art('tiles', 'rock')


def spr(name, tod='day'):
    return os.path.join(SPR, name + ('-n' if tod == 'night' else '') + '.png')


def geom(name):
    return json.load(open(os.path.join(SPR, name + '.geom.json')))


def save(cv, name):
    cv.save(os.path.join(OUTD, name + '.png'))


# ------------------------------------------------------------------------------------------------ shadows
_sh = {}


def ship_mask(v, px):
    """the airship's silhouette (its day render's alpha, glow left out), softened a little, px across"""
    key = (v, px)
    if key not in _sh:
        a = Image.open(os.path.join(SPR, f'{v}0.beauty.png')).getchannel('A').resize((px, px), Image.LANCZOS)
        a = a.filter(ImageFilter.GaussianBlur(max(0.6, px * 0.006)))
        _sh[key] = np.asarray(a).astype(np.float32) / 255
    return _sh[key]


def patch_from_mask(m, rgb, k, rot=0.0):
    im = Image.fromarray((np.clip(m * k, 0, 1) * 255).astype(np.uint8))
    if rot:
        im = im.rotate(-math.degrees(rot), resample=Image.BICUBIC)
    a = np.asarray(im).astype(np.float32) / 255
    p = np.zeros(a.shape + (4,), np.float32); p[..., :3] = np.asarray(rgb, np.float32); p[..., 3] = a
    return p


def ship_shadow(cv, v, x, y, rot, off, tod):
    """the ship's shadow on the ground, down-sun of it like a Cargo Plane's (0.7 across, 1 down, for every tile up)"""
    px = int(round(FRAME * cv.T))
    k = 0.3 if tod == 'day' else 0.16
    p = patch_from_mask(ship_mask(v, px), (4 / 255, 10 / 255, 16 / 255), k, rot)
    cv.over(p, (x + 0.7 * off) * cv.T - px / 2, (y + off) * cv.T - px / 2)


def ship_light(cv, v, t, x, y, off, k=0.35):
    """(a proposal) at night, a soft pool of team light on the ground under the ship, where its shadow falls"""
    light_pool(cv, x + 0.7 * off, y + off, TEAMC[t], k, 2.6 if v != 'c' else 2.9)


def ship(cv, v, t, x, y, rot, tod):
    cv.sprite(spr(f'{v}{t}', tod), x, y, FRAME, [0.5, 0.5], rot=rot)


def dock_centre(v, t, mx, my, body):
    """where the moored ship's sprite goes: its mooring cone on the mast head, its body streaming out along `body`
    (radians, clockwise on screen from east); returns the sprite centre and its rotation"""
    hd = geom(f'm{v}{t}')['marks']['head']
    hx, hy = mx + (hd[0] - B3[1][0]) * B3[0], my + (hd[1] - B3[1][1]) * B3[0]
    d = geom(f'{v}{t}')['marks']['dock']
    ox, oy = (d[0] - 0.5) * FRAME, (d[1] - 0.5) * FRAME
    rot = body + math.pi
    rx, ry = ox * math.cos(rot) - oy * math.sin(rot), ox * math.sin(rot) + oy * math.cos(rot)
    return hx - rx, hy - ry, rot, (hx, hy)


# ------------------------------------------------------------------------------------------------ today's pieces
def plane_outline(L):
    """planeOutline() in js/render.js, facing +x, in pixels for a plane L px long: a list of polygons"""
    W = L * 0.98
    def quad(p0, c, p1, n=6):
        return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]) for t in np.linspace(0, 1, n)]
    fus = quad((0.5 * L, 0), (0.47 * L, -0.055 * L), (0.38 * L, -0.07 * L)) + [(-0.3 * L, -0.07 * L), (-0.47 * L, -0.03 * L), (-0.47 * L, 0.03 * L), (-0.3 * L, 0.07 * L)] \
        + quad((0.38 * L, 0.07 * L), (0.47 * L, 0.055 * L), (0.5 * L, 0))
    polys = [fus]
    for s in (-1, 1):
        polys.append([(0.12 * L, s * 0.06 * L), (-0.06 * L, s * W / 2), (-0.15 * L, s * W / 2), (-0.12 * L, s * 0.06 * L)])
        polys.append([(-0.36 * L, s * 0.02 * L), (-0.47 * L, s * 0.2 * L), (-0.53 * L, s * 0.2 * L), (-0.5 * L, s * 0.02 * L)])
    return polys


def cargo_plane(cv, t, x, y, rot, tod, alt=1.0):
    """drawPlane: the Cargo Plane in the air (alt 1: 2.45 tiles across), its outline shadow and engine trails"""
    T = cv.T; L = T * (1.6 + 0.85 * alt); off = T * (0.07 + 1.1 * alt)
    S = 4; n = int(L * 1.3 * S); im = Image.new('L', (n, n), 0); d = ImageDraw.Draw(im)
    c, s = math.cos(rot), math.sin(rot)
    for poly in plane_outline(L * (1 - 0.06 * alt) * S):
        d.polygon([(n / 2 + px * c - py * s, n / 2 + px * s + py * c) for px, py in poly], fill=255)
    a = np.asarray(im.resize((n // S, n // S), Image.LANCZOS)).astype(np.float32) / 255
    p = np.zeros(a.shape + (4,), np.float32); p[..., 0] = 4 / 255; p[..., 1] = 10 / 255; p[..., 2] = 16 / 255; p[..., 3] = a * (0.34 - 0.14 * alt)
    cv.over(p, x * T + off * 0.7 - a.shape[1] / 2, y * T + off - a.shape[0] / 2)
    # engine trails: four faint streaks streaming back from under the wing
    tr = Image.new('L', (n, n), 0); dt = ImageDraw.Draw(tr)
    run = L * (0.5 + 0.6 * alt) * S
    for k in (-0.3, -0.17, 0.17, 0.3):
        x0 = (-L * 0.05 + abs(k) * L * 0.18) * S
        for q in range(12):
            f0, f1 = q / 12, (q + 1) / 12
            px0, py0, px1, py1 = x0 - run * f0, k * L * S, x0 - run * f1, k * L * S * 1.02
            dt.line([(n / 2 + px0 * c - py0 * s, n / 2 + px0 * s + py0 * c), (n / 2 + px1 * c - py1 * s, n / 2 + px1 * s + py1 * c)],
                    fill=int(255 * 0.32 * alt * (1 - f0)), width=max(1, int(T * 0.05 * S)))
    a = np.asarray(tr.resize((n // S, n // S), Image.LANCZOS)).astype(np.float32) / 255
    cv.over(np.dstack([np.full_like(a, 240 / 255), np.full_like(a, 246 / 255), np.ones_like(a), a]), x * T - a.shape[1] / 2, y * T - a.shape[0] / 2)
    cv.sprite(art('bots', f'cargoplane@{t}', tod), x, y, L / T, [0.5, 0.5], rot=rot)


def truck(cv, t, x, y, rot, tod):
    """drawTruck with art: 0.9 of a tile, its soft shadow, headlights after dark"""
    size = 0.9; along, across = size * 0.44, size * 0.17
    S = 4; n = int(cv.T * size * 1.4 * S); im = Image.new('L', (n, n), 0)
    ImageDraw.Draw(im).ellipse((n / 2 - along * cv.T * S, n / 2 - across * cv.T * S, n / 2 + along * cv.T * S, n / 2 + across * cv.T * S), fill=255)
    im = im.rotate(-math.degrees(rot), resample=Image.BICUBIC)
    a = np.asarray(im.resize((n // S, n // S), Image.LANCZOS)).astype(np.float32) / 255
    p = np.zeros(a.shape + (4,), np.float32); p[..., 0] = 20 / 255; p[..., 1] = 10 / 255; p[..., 2] = 5 / 255; p[..., 3] = a * (0.32 if tod == 'day' else 0.12)
    cv.over(p, (x + along * 0.12) * cv.T - a.shape[1] / 2, (y + along * 0.16) * cv.T - a.shape[0] / 2)
    cv.sprite(art('bots', f'truck@{t}-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        hl = load(os.path.join(ART, 'tod', 'shared', 'truck-headlights.webp'), (int(size * 3 * cv.T),) * 2)
        if rot:
            hl = np.asarray(Image.fromarray((hl * 255).astype(np.uint8)).rotate(-math.degrees(rot), resample=Image.BICUBIC)).astype(np.float32) / 255
        cv.add(hl, x * cv.T - hl.shape[1] / 2, y * cv.T - hl.shape[0] / 2, 1.0)


def lamp(cv, kind, fx_, fy, tod):
    cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914], mul='night' if tod == 'night' else None)
    if tod == 'night':
        cv.sprite(art('roads', f'streetlamp-{kind}-lit@0'), fx_, fy, 1, [0.5, 0.914])


def building(cv, key, x, y, tod, scale=None):
    sc = (scale, B3[1]) if scale else B3
    if key.startswith('m') and len(key) == 3:      # one of the new masts
        cv.sprite(spr(key, tod), x, y, *sc)
    else:
        cv.sprite(art('buildings', key, tod), x, y, *sc)


def grid(cv, k=0.08):
    for i in range(0, cv.w, cv.T):
        cv.rgb[:, i:i + 1] = cv.rgb[:, i:i + 1] * (1 - k) + k
    for j in range(0, cv.h, cv.T):
        cv.rgb[j:j + 1] = cv.rgb[j:j + 1] * (1 - k) + k


def plain_ground(cv, tod):
    cv.rgb[:] = tex_layer(GROUND, cv.w, cv.h, cv.T)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)


# ------------------------------------------------------------------------------------------------ panels
def ship_card(v, tod, T=96):
    cv = Canvas(int(7.2 * T), int(3.5 * T), T)
    plain_ground(cv, tod)
    for t, x in ((0, 1.8), (1, 5.4)):
        if tod == 'night':
            ship_light(cv, v, t, x, 1.4, FLY_OFF * 0.8)
        ship_shadow(cv, v, x, 1.4, 0.0, FLY_OFF * 0.8, tod)
    for t, x in ((0, 1.8), (1, 5.4)):
        ship(cv, v, t, x, 1.4, 0.0, tod)
    save(cv, f'ship-{v}-{tod}')


def shadow_card(v, T=128):
    """the shadow image on its own (what the game would draw under the ship), on plain sand"""
    px = int(FRAME * T)
    m = ship_mask(v, px)
    Image.fromarray(np.dstack([np.full_like(m, 4), np.full_like(m, 10), np.full_like(m, 16), m * 255 * 0.9]).astype(np.uint8), 'RGBA').save(os.path.join(OUTD, f'shadow-{v}-alpha.png'))
    cv = Canvas(px, int(px * 0.72), T)
    plain_ground(cv, 'day')
    p = patch_from_mask(m, (4 / 255, 10 / 255, 16 / 255), 0.3)
    cv.over(p, 0, cv.h / 2 - px / 2)
    save(cv, f'shadow-{v}')


def mast_card(v, tod, T=192):
    cv = Canvas(int(3.0 * T), int(1.85 * T), T)
    plain_ground(cv, tod)
    if tod == 'night':
        for t, x in ((0, 0.8), (1, 2.2)):
            light_pool(cv, x, 1.2, TEAMC[t], 0.6, 2.0)
    for t, x in ((0, 0.8), (1, 2.2)):
        building(cv, f'm{v}{t}', x, 1.2, tod)
    save(cv, f'mast-{v}-{tod}')


def docked_card(v, tod, T=96):
    cv = Canvas(int(5.2 * T), int(3.7 * T), T)
    plain_ground(cv, tod)
    grid(cv, 0.07 if tod == 'day' else 0.03)
    mx, my = 1.5, 2.5
    sx, sy, rot, _ = dock_centre(v, 0, mx, my, -0.32)
    if tod == 'night':
        light_pool(cv, mx, my, CYAN, 0.7, 2.2); ship_light(cv, v, 0, sx, sy, DOCK_OFF)
    building(cv, f'm{v}0', mx, my, tod)
    ship_shadow(cv, v, sx, sy, rot, DOCK_OFF, tod)
    ship(cv, v, 0, sx, sy, rot, tod)
    save(cv, f'docked-{v}-{tod}')


def lineup(tod, T=64, name='scale'):
    cv = Canvas(int(17.2 * T), int(3.6 * T), T)
    plain_ground(cv, tod)
    grid(cv, 0.08 if tod == 'day' else 0.035)
    y = 1.5
    if tod == 'night':
        light_pool(cv, 2.5, 2.0, CYAN, 0.6, 2.0)
        for v, x in (('a', 8.5), ('b', 11.7), ('c', 14.9)):
            ship_light(cv, v, 0, x, y, FLY_OFF)
    truck(cv, 0, 0.9, 2.0, 0.0, tod)
    building(cv, 'depot@0', 2.5, 2.0, tod)
    for v, x in (('a', 8.5), ('b', 11.7), ('c', 14.9)):
        ship_shadow(cv, v, x, y, 0.0, FLY_OFF, tod)
    cargo_plane(cv, 0, 5.0, y, 0.0, tod)
    for v, x in (('a', 8.5), ('b', 11.7), ('c', 14.9)):
        ship(cv, v, 0, x, y, 0.0, tod)
    save(cv, f'{name}-{tod}')


# ------------------------------------------------------------------------------------------------ the colony mock-up
MW, MH = 20, 12
WATER_ROWS = [9, 9, 9, 9, 10, 10, 10, 10, 9, 9, 9, 10]


def mock(v, tod, T=48, name=None):
    cv = Canvas(MW * T, MH * T, T)
    G = [['.'] * MW for _ in range(MH)]
    for j, c0 in enumerate(WATER_ROWS):
        for i in range(c0, c0 + 3):
            G[j][i] = '~'
    for j, i0 in ((0, 13), (1, 13), (2, 15), (10, 16), (11, 15)):
        for i in range(i0, MW):
            G[j][i] = '^'
    G = [''.join(r) for r in G]
    ground = tex_layer(GROUND, cv.w, cv.h, T); water = tex_layer(WATER, cv.w, cv.h, T); rock = tex_layer(ROCK, cv.w, cv.h, T)
    mW = sstep(0.42, 0.58, tile_mask(G, '~', T, feather=T * 0.45)).astype(np.float32)
    mR = sstep(0.4, 0.6, tile_mask(G, '^', T, feather=T * 0.12)).astype(np.float32)
    base = ground * (1 - mW[..., None]) + water * mW[..., None]
    base = base * (1 - mR[..., None]) + rock * mR[..., None]
    # the plateau's cliff: a dark face along its southern edge, a soft shade at its foot
    edge = np.clip(np.roll(mR, -int(T * 0.28), axis=0) - mR, 0, 1)
    base *= (1 - 0.55 * np.clip(mR - np.roll(mR, int(T * 0.22), axis=0), 0, 1))[..., None]
    base *= (1 - 0.35 * edge)[..., None]
    cv.rgb[:] = base
    roads = {(i, 5): 'c' for i in range(0, 8)} | {(7, j): 'c' for j in range(6, 12)} | {(i, 7): 'a' for i in range(13, 20)}
    cv.over(draw_roads(cv, roads, tod), 0, 0)
    builds = [('depot@0', 2.5, 3.5, None), ('fueltank@0', 4.6, 3.5, None), ('airfield@0', 7.5, 2.5, 1.6), ('smelter@0', 14.5, 9.5, None),
              (f'm{v}0', 3.5, 8.5, None), (f'm{v}0', 17.5, 5.5, None)]
    m1, m2 = (3.5, 8.5), (17.5, 5.5)
    # the moored ship at the west mast, its body streaming east-north-east; the other on the line, over the river
    dx, dy, drot, _ = dock_centre(v, 0, *m1, -0.35)
    hx2, hy2 = m2[0] + 0.0, m2[1] - 0.75
    fx, fy = 10.6, 6.6
    frot = math.atan2(hy2 - fy, hx2 - fx)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)
        road_glow(cv, roads)
        street_pools(cv, lamps(roads))
        for key, x, y, _s in builds:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        city_glow(cv, [(x, y, False) for _, x, y, _s in builds], CYAN)
        ship_light(cv, v, 0, dx, dy, DOCK_OFF); ship_light(cv, v, 0, fx, fy, FLY_OFF)
    items = [(y, 'b', key, x, y, sc) for key, x, y, sc in builds]
    items += [(fy_, 'lamp', kind, fx_, fy_) for kind, i, j, (fx_, fy_) in lamps(roads)]
    items += [(5.5, 'truck', 4.4, 5.5, 0.0), (9.4, 'truck', 7.5, 9.4, math.pi / 2)]
    for it in sorted(items, key=lambda q: q[0]):
        if it[1] == 'b':
            building(cv, it[2], it[3], it[4], tod, it[5])
        elif it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], tod)
        else:
            truck(cv, 0, it[2], it[3], it[4], tod)
    ship_shadow(cv, v, dx, dy, drot, DOCK_OFF, tod)
    ship_shadow(cv, v, fx, fy, frot, FLY_OFF, tod)
    ship(cv, v, 0, dx, dy, drot, tod)
    ship(cv, v, 0, fx, fy, frot, tod)
    cargo_plane(cv, 0, 12.6, 10.4, -0.5, tod)
    save(cv, name or f'mock-{v}-{tod}' + ('-big' if T > 48 else ''))


if __name__ == '__main__':
    for tod in ('day', 'night'):
        for v in 'abc':
            ship_card(v, tod); mast_card(v, tod); docked_card(v, tod)
            mock(v, tod); mock(v, tod, T=96)
        lineup(tod); lineup(tod, T=56, name='phone')
    for v in 'abc':
        shadow_card(v)
    print('wrote', OUTD)
