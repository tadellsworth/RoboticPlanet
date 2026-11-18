"""Pictures for the Maglev design sheet: the three directions' Terminals, pylons, guideway and pods (b/maglev.js) drawn
the way the game draws a map (js/render.js: ground textures, roads and lamps, the night grade, buildings by depth,
a Ropeway's cable and gondola above everything), beside today's Rail Station, Freight Train, Ropeway and Mooring Mast.
The guideway is drawn the way the sheet proposes the game should draw it: a straight band of the deck tile from one
Terminal's head to the other's, lifted the pylon's height up the screen, its shadow on the ground down-sun, pylon
sprites every three tiles with their heads on it (shorter on high ground, as the Viaduct's piers are), and the pods
drawn top-down on it, turned to the line. Nothing here is game code, and nothing is installed.

    TERRAFALL_ART=<game>/art python3 preview/maglev_mock.py <renderdir> <outdir>      (run from renderer/)

<renderdir> holds the composed renders of tools/render_maglev.sh (t<v><t>, p<v><t>, pod<v><t>, pod<v>0e, d<v><t>,
scene-<v>, pa0-cut, each with -n at night, with their .geom.json). Writes, by day and at night:
    terminal-<v>-<tod>.png   both teams' Terminals, a pod docked on each, the guideway arriving       (160 px a tile)
    pylon-<v>-<tod>.png      both teams' pylons under one span, a pod crossing                        (160)
    cross-<v>-<tod>.png      a stretch of line crossing a river and climbing onto a plateau            (96)
    pod-<v>-<tod>.png        pods on the span: loaded, empty, the rival's                              (128)
    colony-<v>-<tod>.png     a colony at game scale: a line from a factory district over a river to a field,
                             a Rail Station and train, a Ropeway, a Mooring Mast for comparison        (48; -big at 96)
    phone-<v>-<tod>.png      the same at a phone's 28 px a tile
    cut-<tod>.png            direction A with a pylon shot down: the line cut, pods stopped either side (72)
    scale-<tod>.png          a line-up: Freight Truck, Freight Train, Rail Station, Ropeway, Mast, then A, B, C (64)
    contact.png              the three crossings by day and night, labelled, for a quick look
"""
import json
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SPR, OUTD = sys.argv[1], sys.argv[2]
WHICH = sys.argv[3] if len(sys.argv) > 3 else 'all'
os.makedirs(OUTD, exist_ok=True)
sys.argv = [sys.argv[0], os.path.join(OUTD, '_hollow')]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hollow_mock import Canvas, art, grade, load, tex_layer, tile_mask, sstep, draw_roads, road_glow, lamps, street_pools, light_pool, city_glow, CYAN, ART  # noqa: E402

RED = np.array([255, 90, 110]) / 255
TEAMC = {0: CYAN, 1: RED}
B3 = (1.4, [0.5, 0.615])          # every building (B3D in art/art-manifest.js)
TERM = (1.6, [0.5, 0.615])        # the Terminals, as big as the Rail Station
ROPE = (1.47, [0.5, 0.615])
SPACING = 3.0                     # tiles between pylons (the proposal)
END_SHORT = {'a': 0.44, 'b': 0.49, 'c': 0.37}   # the deck ends this far short of the head: the platform's rim
LEVEL_UP = 0.3                    # tiles a terrain level rises on screen (the Viaduct's pier rule)
SHADOW = (0.6, 0.55)              # a thing H tiles up casts its shadow (0.6 H right, 0.55 H down) of the ground under it
NAMES = {'a': 'Accord Phase 2', 'b': 'Industrial freight', 'c': 'Monorail on the ground'}
GROUND = art('tiles', 'ground'); WATER = art('tiles', 'water'); ROCK = art('tiles', 'rock')


def spr(name, tod='day'):
    return os.path.join(SPR, name + ('-n' if tod == 'night' else '') + '.png')


_geom = {}


def geom(name):
    if name not in _geom:
        _geom[name] = json.load(open(os.path.join(SPR, name + '.geom.json')))
    return _geom[name]


def save(cv, name):
    cv.save(os.path.join(OUTD, name + '.png'))


def head_off(v, t=0):
    """where the guideway meets a Terminal, in tiles from its tile centre (up the screen is negative)"""
    g = geom(f't{v}{t}'); h = g['marks']['head']
    return (h[0] - TERM[1][0]) * TERM[0], (h[1] - TERM[1][1]) * TERM[0]


def deck_h(v):
    """how far up the screen the deck top sits over a pylon's foot, in tiles"""
    g = geom(f'p{v}0')
    return (g['anchor'][1] - g['marks']['head'][1]) * B3[0]


def pyl_anchor(v):
    return list(geom(f'p{v}0')['anchor'])


# ------------------------------------------------------------------------------------------------ drawing helpers
def sprite_h(cv, path, tx, ty, scale, anchor, hscale=1.0, alpha=1.0, mul=None):
    """a sprite squashed vertically by hscale, its anchor kept on (tx, ty)"""
    px = max(2, int(round(scale * cv.T))); py = max(2, int(round(px * hscale)))
    s = load(path, (px, py))
    if mul == 'night':
        s = s.copy(); s[..., :3] = grade(s[..., :3])
    cv.over(s, tx * cv.T - anchor[0] * px, ty * cv.T - anchor[1] * py, alpha)


def strip_img(path, T, length):
    """the deck tile repeated along x for `length` pixels"""
    tile = Image.open(path).convert('RGBA').resize((T, T), Image.LANCZOS)
    n = int(math.ceil(length / T)) + 2
    s = Image.new('RGBA', (n * T, T), (0, 0, 0, 0))
    for i in range(n):
        s.paste(tile, (i * T, 0))
    x0 = (n * T - int(length)) // 2
    return s.crop((x0, 0, x0 + max(1, int(length)), T))


def band(cv, path, P0, P1, alpha=1.0, shadow=None):
    """the guideway from screen point P0 to P1 (tiles); shadow=(rgb, k): its shadow instead, dark and softened"""
    dx, dy = (P1[0] - P0[0]) * cv.T, (P1[1] - P0[1]) * cv.T
    L = math.hypot(dx, dy)
    if L < 1:
        return
    im = strip_img(path, cv.T, L)
    if shadow:
        rgb, k = shadow
        a = im.getchannel('A').point(lambda q: int(q * k))
        im = Image.merge('RGBA', [Image.new('L', im.size, int(c * 255)) for c in rgb] + [a]).filter(ImageFilter.GaussianBlur(max(0.6, cv.T * 0.02)))
    im = im.rotate(-math.degrees(math.atan2(dy, dx)), resample=Image.BICUBIC, expand=True)
    arr = np.asarray(im).astype(np.float32) / 255
    cv.over(arr, (P0[0] + P1[0]) / 2 * cv.T - im.width / 2, (P0[1] + P1[1]) / 2 * cv.T - im.height / 2, alpha)


def band_glow(cv, color, P0, P1, k=0.3, w=0.3):
    """at night: a soft ribbon of team light along the span"""
    S = 2
    im = Image.new('L', (cv.w * S, cv.h * S), 0)
    ImageDraw.Draw(im).line([(P0[0] * cv.T * S, P0[1] * cv.T * S), (P1[0] * cv.T * S, P1[1] * cv.T * S)], fill=255, width=max(2, int(w * cv.T * S)))
    im = im.resize((cv.w, cv.h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(cv.T * 0.18))
    a = np.asarray(im).astype(np.float32) / 255
    cv.rgb = np.clip(cv.rgb + (a * k)[..., None] * np.asarray(color)[None, None], 0, 1)


_masks = {}


def pod_mask(name, px, rot):
    key = (name, px, round(rot, 3))
    if key not in _masks:
        a = Image.open(os.path.join(SPR, name + '.png')).getchannel('A').resize((px, px), Image.LANCZOS)
        a = a.rotate(-math.degrees(rot), resample=Image.BICUBIC).filter(ImageFilter.GaussianBlur(max(0.6, px * 0.012)))
        _masks[key] = np.asarray(a).astype(np.float32) / 255
    return _masks[key]


def pod(cv, v, t, P, rot, tod, loaded=True, ground=None, H=0.0):
    """a pod at screen point P (tiles) on the span, turned along it; its shadow on the ground under it"""
    name = f'pod{v}{t}' + ('' if loaded else 'e')
    if ground is not None:
        px = int(round(cv.T)); m = pod_mask(name, px, rot)
        sh = np.zeros(m.shape + (4,), np.float32); sh[..., :3] = (4 / 255, 10 / 255, 16 / 255); sh[..., 3] = m * (0.3 if tod == 'day' else 0.14)
        cv.over(sh, (ground[0] + SHADOW[0] * H) * cv.T - px / 2, (ground[1] + SHADOW[1] * H) * cv.T - px / 2)
    cv.sprite(spr(name, tod), P[0], P[1], 1.0, [0.5, 0.5], rot=rot)


def pylon(cv, v, t, G, tod, e=0, cut=False):
    """a pylon with its foot at ground point G; on high ground (e levels) it is shorter, its foot drawn up the screen"""
    H = deck_h(v); hs = max(0.3, (H - LEVEL_UP * e) / H)
    name = 'pa0-cut' if cut else f'p{v}{t}'
    sprite_h(cv, spr(name, tod), G[0], G[1] - LEVEL_UP * e, B3[0], pyl_anchor(v), hs)


def line(cv, v, t, A, B, tod, pods=(), elev=None, cut=None, draw=('shadow', 'pylons', 'deck', 'pods'), docked=()):
    """the line between Terminals on tiles A and B (tile centres); pods: (fraction, loaded); cut: the index of a pylon shot down.
    Call it in stages (draw=...) so the pylons can be sorted in with the buildings: it returns the pylons' feet for that."""
    ho = head_off(v, t); H = deck_h(v)
    HA = (A[0] + ho[0], A[1] + ho[1]); HB = (B[0] + ho[0], B[1] + ho[1])
    L = math.hypot(B[0] - A[0], B[1] - A[1]); u = ((B[0] - A[0]) / L, (B[1] - A[1]) / L); ang = math.atan2(u[1], u[0])
    at = lambda P, s: (P[0] + u[0] * s, P[1] + u[1] * s)
    feet = []
    s = 1.5
    while s < L - 1.4:
        feet.append((at(A, s), elev(at(A, s)) if elev else 0)); s += SPACING
    es = END_SHORT[v]
    spans = [(at(HA, es), at(HB, -es))]
    if cut is not None:
        g0 = cut * SPACING + 1.5
        spans = [(at(HA, es), at(HA, g0 - SPACING * 0.55)), (at(HA, g0 + SPACING * 0.55), at(HB, -es))]
    deck = spr(f'd{v}{t}', tod)
    if 'shadow' in draw:
        sh = (SHADOW[0] * H, SHADOW[1] * H)
        for P0, P1 in spans:
            band(cv, deck, (P0[0] - ho[0] + sh[0], P0[1] - ho[1] + sh[1]), (P1[0] - ho[0] + sh[0], P1[1] - ho[1] + sh[1]), shadow=((4 / 255, 10 / 255, 16 / 255), 0.28 if tod == 'day' else 0.12))
    if 'pylons' in draw:
        for k, (G, e) in enumerate(feet):
            pylon(cv, v, t, G, tod, e, cut=(k == cut))
    if 'deck' in draw:
        for P0, P1 in spans:
            band(cv, deck, P0, P1)
            if tod == 'night':
                band_glow(cv, TEAMC[t], P0, P1)
    if 'pods' in draw:
        for f, loaded in pods:
            pod(cv, v, t, at(HA, f * L), ang, tod, loaded, ground=at(A, f * L), H=H)
        for P, loaded in docked:
            pod(cv, v, t, (P[0] + ho[0], P[1] + ho[1]), ang, tod, loaded)
    return feet


# ------------------------------------------------------------------------------------------------ today's pieces
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


def bot_shadow(cv, x, y, rot, along, across, tod):
    S = 4; n = int(cv.T * along * 2.6 * S) + 8; im = Image.new('L', (n, n), 0)
    ImageDraw.Draw(im).ellipse((n / 2 - along * cv.T * S, n / 2 - across * cv.T * S, n / 2 + along * cv.T * S, n / 2 + across * cv.T * S), fill=255)
    im = im.rotate(-math.degrees(rot), resample=Image.BICUBIC)
    a = np.asarray(im.resize((n // S, n // S), Image.LANCZOS)).astype(np.float32) / 255
    p = np.zeros(a.shape + (4,), np.float32); p[..., 0] = 20 / 255; p[..., 1] = 10 / 255; p[..., 2] = 5 / 255; p[..., 3] = a * (0.3 if tod == 'day' else 0.12)
    cv.over(p, (x + 0.03) * cv.T - a.shape[1] / 2, (y + 0.05) * cv.T - a.shape[0] / 2)


def train(cv, t, x, y, rot, tod, wagons=4):
    """drawFreightTrain with art: the loco and its wagons 0.62 tiles apart along a straight track, each 0.775 tiles"""
    size = 0.775; ux, uy = math.cos(rot), math.sin(rot)
    cars = [(x - ux * 0.62 * k, y - uy * 0.62 * k) for k in range(wagons + 1)]
    for cx, cy in cars:
        bot_shadow(cv, cx, cy, rot, size * 0.42, size * 0.2, tod)
    for k in range(wagons, 0, -1):
        cx, cy = cars[k]
        cv.sprite(art('bots', f'freight-wagon-{"hopper" if k % 2 == 0 else "flat"}@{t}', tod), cx, cy, size, [0.5, 0.5], rot=rot)
    cv.sprite(art('bots', f'freight-loco@{t}-f0', tod), x, y, size, [0.5, 0.5], rot=rot)
    if tod == 'night':
        cv.sprite(art('bots', 'freight-loco-lights'), x, y, size, [0.5, 0.5], rot=rot)


def rail(cv, tiles, tod, ns=False):
    for i, j in tiles:
        cv.sprite(art('rail', 'rail-straight', tod), i + 0.5, j + 0.5, 1.0, [0.5, 0.5], rot=math.pi / 2 if ns else 0.0)


def lamp(cv, kind, fx_, fy, tod):
    cv.sprite(art('roads', f'streetlamp-{kind}@0'), fx_, fy, 1, [0.5, 0.914], mul='night' if tod == 'night' else None)
    if tod == 'night':
        cv.sprite(art('roads', f'streetlamp-{kind}-lit@0'), fx_, fy, 1, [0.5, 0.914])


def building(cv, key, x, y, tod, scale=None):
    sc = (scale, B3[1]) if scale else B3
    if key[0] == 't' and len(key) == 3:          # one of the new Terminals
        cv.sprite(spr(key, tod), x, y, *TERM)
    else:
        cv.sprite(art('buildings', key, tod), x, y, *sc)


def ropeway(cv, t, A, B, tod, gondola=0.5):
    """two Ropeway stations and the sagging cable between their bull wheels, a gondola on it (drawRopeways)"""
    top = (ROPE[1][1] - 0.1) * ROPE[0]
    x0, y0, x1, y1 = A[0], A[1] - top, B[0], B[1] - top
    L = math.hypot(B[0] - A[0], B[1] - A[1]); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2 + L * 0.08
    S = 2; im = Image.new('RGBA', (cv.w * S, cv.h * S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for off in (-0.06, 0.06):
        pts = []
        for k in range(33):
            f = k / 32
            pts.append((((1 - f) ** 2 * x0 + 2 * (1 - f) * f * cx + f * f * x1) * cv.T * S, ((1 - f) ** 2 * y0 + 2 * (1 - f) * f * cy + f * f * y1 + off) * cv.T * S))
        d.line(pts, fill=(20, 22, 26, 217), width=max(2, int(cv.T * 0.045 * S)))
    cv.over(np.asarray(im.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255, 0, 0)
    f = gondola
    px, py = (1 - f) ** 2 * x0 + 2 * (1 - f) * f * cx + f * f * x1, (1 - f) ** 2 * y0 + 2 * (1 - f) * f * cy + f * f * y1
    cv.sprite(art('bots', f'gondola@{t}', tod), px, py, 0.8, [0.5, 0.08])


def grid(cv, k=0.08):
    for i in range(0, cv.w, cv.T):
        cv.rgb[:, i:i + 1] = cv.rgb[:, i:i + 1] * (1 - k) + k
    for j in range(0, cv.h, cv.T):
        cv.rgb[j:j + 1] = cv.rgb[j:j + 1] * (1 - k) + k


def plain_ground(cv, tod):
    cv.rgb[:] = tex_layer(GROUND, cv.w, cv.h, cv.T)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)


def terrain(cv, G, water_feather=0.45):
    """ground, water (soft shores) and rock plateaus with a cliff face along their south and west edges, from a map of
    '.', '~' and '^'; returns the elevation lookup"""
    T = cv.T
    ground = tex_layer(GROUND, cv.w, cv.h, T); water = tex_layer(WATER, cv.w, cv.h, T); rock = tex_layer(ROCK, cv.w, cv.h, T)
    mW = sstep(0.42, 0.58, tile_mask(G, '~', T, feather=T * water_feather)).astype(np.float32)
    mR = sstep(0.4, 0.6, tile_mask(G, '^', T, feather=T * 0.12)).astype(np.float32)
    base = ground * (1 - mW[..., None]) + water * mW[..., None]
    base = base * (1 - mR[..., None]) + rock * mR[..., None]
    south = np.clip(mR - np.roll(mR, -int(T * 0.24), axis=0), 0, 1)            # the face: the rock's southern strip, dark
    west = np.clip(mR - np.roll(mR, int(T * 0.12), axis=1), 0, 1)              # its western strip, less so
    foot = np.clip(np.roll(mR, int(T * 0.3), axis=0) - mR, 0, 1)               # a soft shade on the ground at its foot
    base *= (1 - 0.55 * south - 0.3 * west)[..., None]
    base *= (1 - 0.35 * foot)[..., None]
    cv.rgb[:] = base
    H, W = len(G), len(G[0])
    return lambda P: 1 if 0 <= int(P[1]) < H and 0 <= int(P[0]) < W and G[int(P[1])][int(P[0])] == '^' else 0


def ripples(cv, G, tod):
    """light rings on the water round a pylon standing in it"""
    S = 2; im = Image.new('L', (cv.w * S, cv.h * S), 0); d = ImageDraw.Draw(im)
    for r, a in ((0.22, 170), (0.32, 110), (0.44, 60)):
        d.ellipse(((G[0] - r) * cv.T * S, (G[1] + 0.02 - r * 0.6) * cv.T * S, (G[0] + r) * cv.T * S, (G[1] + 0.02 + r * 0.6) * cv.T * S), outline=a, width=max(1, int(cv.T * 0.025 * S)))
    a = np.asarray(im.resize((cv.w, cv.h), Image.LANCZOS)).astype(np.float32) / 255 * (0.5 if tod == 'day' else 0.25)
    cv.rgb = np.clip(cv.rgb + a[..., None] * np.array([0.9, 0.96, 0.95])[None, None], 0, 1)


# ------------------------------------------------------------------------------------------------ the cards
def terminal_card(v, tod, T=160):
    cv = Canvas(int(5.6 * T), int(2.9 * T), T)
    plain_ground(cv, tod); grid(cv, 0.06 if tod == 'day' else 0.03)
    A, B = (1.45, 1.95), (4.15, 1.95)
    ho = head_off(v); H = deck_h(v); sh = (SHADOW[0] * H, SHADOW[1] * H)
    deck = spr(f'd{v}0', tod); deck1 = spr(f'd{v}1', tod)
    es = END_SHORT[v]
    for P0, P1, d in (((-0.3, A[1]), (A[0] - es, A[1]), deck), ((B[0] + es, B[1]), (5.9, B[1]), deck1)):
        band(cv, d, (P0[0] + sh[0], P0[1] + sh[1]), (P1[0] + sh[0], P1[1] + sh[1]), shadow=((4 / 255, 10 / 255, 16 / 255), 0.28 if tod == 'day' else 0.12))
    if tod == 'night':
        light_pool(cv, A[0], A[1], CYAN, 0.6, 2.4); light_pool(cv, B[0], B[1], RED, 0.6, 2.4)
    building(cv, f't{v}0', *A, tod); building(cv, f't{v}1', *B, tod)
    for P0, P1, d, t in (((-0.3, A[1] + ho[1]), (A[0] + ho[0] - es, A[1] + ho[1]), deck, 0), ((B[0] + ho[0] + es, B[1] + ho[1]), (5.9, B[1] + ho[1]), deck1, 1)):
        band(cv, d, P0, P1)
        if tod == 'night':
            band_glow(cv, TEAMC[t], P0, P1)
    pod(cv, v, 0, (A[0] + ho[0], A[1] + ho[1]), 0.0, tod, True)
    pod(cv, v, 1, (B[0] + ho[0], B[1] + ho[1]), 0.0, tod, True)
    save(cv, f'terminal-{v}-{tod}')


def pylon_card(v, tod, T=160):
    cv = Canvas(int(4.8 * T), int(2.5 * T), T)
    plain_ground(cv, tod); grid(cv, 0.06 if tod == 'day' else 0.03)
    H = deck_h(v); y = 1.75; sh = (SHADOW[0] * H, SHADOW[1] * H)
    for t, x0, x1 in ((0, -0.3, 2.4), (1, 2.4, 5.1)):
        band(cv, spr(f'd{v}{t}', tod), (x0 + sh[0], y + sh[1]), (x1 + sh[0], y + sh[1]), shadow=((4 / 255, 10 / 255, 16 / 255), 0.28 if tod == 'day' else 0.12))
    pylon(cv, v, 0, (1.3, y), tod); pylon(cv, v, 1, (3.5, y), tod)
    for t, x0, x1 in ((0, -0.3, 2.4), (1, 2.4, 5.1)):
        band(cv, spr(f'd{v}{t}', tod), (x0, y - H), (x1, y - H))
        if tod == 'night':
            band_glow(cv, TEAMC[t], (x0, y - H), (x1, y - H))
    pod(cv, v, 0, (2.4, y - H), 0.0, tod, True, ground=(2.4, y), H=H)
    save(cv, f'pylon-{v}-{tod}')


CROSS = ['.......^^^', '.......^^^', '...~~..^^^', '...~~.....', '...~~.....']


def cross_card(v, tod, T=96):
    W, Hh = len(CROSS[0]), len(CROSS)
    cv = Canvas(W * T, Hh * T, T)
    elev = terrain(cv, CROSS, 0.4)
    if tod == 'night':
        cv.rgb = grade(cv.rgb)
    A, B = (-1.2, 4.6), (11.6, 0.6)                     # Terminals off both edges: just the line crossing
    feet = line(cv, v, 0, A, B, tod, elev=elev, draw=('shadow',))
    for G, e in feet:
        if 2 <= G[1] < 5 and 3 <= G[0] < 5:
            ripples(cv, G, tod)
    line(cv, v, 0, A, B, tod, pods=((0.43, True), (0.74, False)), elev=elev, draw=('pylons', 'deck', 'pods'))
    save(cv, f'cross-{v}-{tod}')


def pod_card(v, tod, T=128):
    cv = Canvas(int(6.4 * T), int(2.2 * T), T)
    plain_ground(cv, tod); grid(cv, 0.06 if tod == 'day' else 0.03)
    H = deck_h(v); y = 1.5; sh = (SHADOW[0] * H, SHADOW[1] * H)
    for t, x0, x1 in ((0, -0.3, 4.0), (1, 4.0, 6.7)):
        band(cv, spr(f'd{v}{t}', tod), (x0 + sh[0], y + sh[1]), (x1 + sh[0], y + sh[1]), shadow=((4 / 255, 10 / 255, 16 / 255), 0.28 if tod == 'day' else 0.12))
    for t, x0, x1 in ((0, -0.3, 4.0), (1, 4.0, 6.7)):
        band(cv, spr(f'd{v}{t}', tod), (x0, y - H), (x1, y - H))
        if tod == 'night':
            band_glow(cv, TEAMC[t], (x0, y - H), (x1, y - H))
    for t, x, loaded in ((0, 1.1, True), (0, 3.0, False), (1, 5.2, True)):
        pod(cv, v, t, (x, y - H), 0.0, tod, loaded, ground=(x, y), H=H)
    save(cv, f'pod-{v}-{tod}')


# ------------------------------------------------------------------------------------------------ the colony
MAP = [
    '..........~~~.^^^^^^^^',
    '..........~~~.^^^^^^^^',
    '..........~~~.^^^^^^^^',
    '...........~~~^^^^^^^^',
    '...........~~~^^^^^^^^',
    '...........~~~........',
    '...........~~~........',
    '..........~~~.........',
    '..........~~~.........',
    '..........~~~.........',
    '.........~~~..........',
    '.........~~~..........',
    '.........~~~..........',
]


def colony(v, tod, T=48, name=None):
    MH, MW = len(MAP), len(MAP[0])
    cv = Canvas(MW * T, MH * T, T)
    elev = terrain(cv, MAP)
    roads = {(i, 6): 'c' for i in range(0, 6)} | {(5, j): 'c' for j in range(7, 10)} | {(i, 7): 'a' for i in range(15, 22)}
    cv.over(draw_roads(cv, roads, tod), 0, 0)
    track = [(i, 12) for i in range(0, 9)]
    A, B = (3.5, 8.5), (19.5, 2.5)                     # the two Terminals: by the factories, and in the field on the plateau
    builds = [('smelter@0', 2.5, 5.4, None), ('fab@0', 4.8, 5.4, None), ('generator@0', 6.3, 8.6, None), ('depot@0', 1.4, 10.6, None),
              (f't{v}0', A[0], A[1], None), (f't{v}0', B[0], B[1], None), ('generator@0', 17.6, 4.2, None), ('farm@0', 16.3, 1.3, None),
              ('station@0', 5.0, 11.0, 1.6), ('ropeway@0', 14.5, 11.3, None), ('ropeway@0', 20.8, 9.2, None), ('mast@0', 14.0, 8.6, None)]
    if tod == 'night':
        cv.rgb = grade(cv.rgb)
        road_glow(cv, roads)
        street_pools(cv, lamps(roads))
        for key, x, y, _s in builds:
            light_pool(cv, x, y, CYAN, 0.8, 2.2)
        city_glow(cv, [(x, y, False) for _, x, y, _s in builds], CYAN)
    rail(cv, track, tod)
    feet = line(cv, v, 0, A, B, tod, elev=elev, draw=('shadow',))
    for G, e in feet:
        if MAP[int(G[1])][int(G[0])] == '~':
            ripples(cv, G, tod)
    items = [(y, 'b', key, x, y, sc) for key, x, y, sc in builds]
    items += [(fy_, 'lamp', kind, fx_, fy_) for kind, i, j, (fx_, fy_) in lamps(roads)]
    items += [(6.5, 'truck', 3.2, 6.5, 0.0), (8.8, 'truck', 5.5, 8.8, math.pi / 2), (7.5, 'truck', 17.4, 7.5, math.pi)]
    items += [(G[1] - 0.01, 'pylon', G, e) for G, e in feet]
    for it in sorted(items, key=lambda q: q[0]):
        if it[1] == 'b':
            building(cv, it[2], it[3], it[4], tod, it[5])
        elif it[1] == 'lamp':
            lamp(cv, it[2], it[3], it[4], tod)
        elif it[1] == 'truck':
            truck(cv, 0, it[2], it[3], it[4], tod)
        else:
            pylon(cv, v, 0, it[2], tod, it[3])
    train(cv, 0, 4.1, 12.5, 0.0, tod)
    ropeway(cv, 0, (14.5, 11.3), (20.8, 9.2), tod, 0.42)
    line(cv, v, 0, A, B, tod, pods=((0.3, True), (0.72, False)), elev=elev, draw=('deck', 'pods'), docked=((B, False),))
    save(cv, name or f'colony-{v}-{tod}' + ('-big' if T > 48 else ''))


CUT = ['..........', '..........', '..........', '..........', '..........']


def cut_card(tod, T=72):
    cv = Canvas(10 * T, 5 * T, T)
    plain_ground(cv, tod)
    A, B = (-1.6, 3.6), (11.4, 2.0)
    line(cv, 'a', 0, A, B, tod, draw=('shadow',), cut=2)
    # the scorched ground where it came down, and a smoulder of smoke
    G = (A[0] + (B[0] - A[0]) * (7.5 / math.hypot(B[0] - A[0], B[1] - A[1])), A[1] + (B[1] - A[1]) * (7.5 / math.hypot(B[0] - A[0], B[1] - A[1])))
    S = 2; im = Image.new('L', (cv.w * S, cv.h * S), 0); d = ImageDraw.Draw(im)
    d.ellipse(((G[0] - 1.6) * T * S, (G[1] - 0.9) * T * S, (G[0] + 2.0) * T * S, (G[1] + 1.1) * T * S), fill=140)
    a = np.asarray(im.resize((cv.w, cv.h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(T * 0.3))).astype(np.float32) / 255
    cv.rgb *= (1 - 0.55 * a)[..., None]
    line(cv, 'a', 0, A, B, tod, pods=((0.2, True), (0.8, False)), draw=('pylons', 'deck', 'pods'), cut=2)
    for k, (dx, dy, r, al) in enumerate(((0.9, -0.3, 0.55, 0.35), (1.0, -0.9, 0.7, 0.28), (1.15, -1.6, 0.9, 0.18))):
        im = Image.new('L', (cv.w * S, cv.h * S), 0)
        ImageDraw.Draw(im).ellipse(((G[0] + dx - r) * T * S, (G[1] + dy - r * 0.8) * T * S, (G[0] + dx + r) * T * S, (G[1] + dy + r * 0.8) * T * S), fill=255)
        a = np.asarray(im.resize((cv.w, cv.h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(T * 0.22))).astype(np.float32) / 255 * al
        cv.rgb = cv.rgb * (1 - a[..., None]) + a[..., None] * (np.array([0.32, 0.3, 0.3]) if tod == 'day' else np.array([0.1, 0.1, 0.12]))
    save(cv, f'cut-{tod}')


def lineup(tod, T=64, name='scale'):
    cv = Canvas(int(26.0 * T), int(4.0 * T), T)
    plain_ground(cv, tod); grid(cv, 0.08 if tod == 'day' else 0.035)
    y = 2.5
    if tod == 'night':
        for x in (6.4, 8.9, 12.0):
            light_pool(cv, x, y, CYAN, 0.6, 2.0)
    truck(cv, 0, 0.8, y, 0.0, tod)
    train(cv, 0, 3.6, y, 0.0, tod, wagons=2)
    building(cv, 'station@0', 6.4, y, tod, 1.6)
    building(cv, 'ropeway@0', 8.9, y, tod, 1.47)
    cv.sprite(art('bots', 'gondola@0', tod), 10.3, y - (ROPE[1][1] - 0.1) * ROPE[0] + 0.1, 0.8, [0.5, 0.08])
    building(cv, 'mast@0', 12.0, y, tod)
    for k, v in enumerate('abc'):
        tx = 14.3 + 3.9 * k; H = deck_h(v); ho = head_off(v); es = END_SHORT[v]; sh = (SHADOW[0] * H, SHADOW[1] * H)
        P0, P1 = (tx + ho[0] + es, y + ho[1]), (tx + 3.3, y + ho[1])
        band(cv, spr(f'd{v}0', tod), (P0[0] - ho[0] + sh[0], P0[1] - ho[1] + sh[1]), (P1[0] - ho[0] + sh[0], P1[1] - ho[1] + sh[1]), shadow=((4 / 255, 10 / 255, 16 / 255), 0.28 if tod == 'day' else 0.12))
        if tod == 'night':
            light_pool(cv, tx, y, CYAN, 0.6, 2.2)
        building(cv, f't{v}0', tx, y, tod)
        pylon(cv, v, 0, (tx + 2.4, y), tod)
        band(cv, spr(f'd{v}0', tod), P0, P1)
        if tod == 'night':
            band_glow(cv, CYAN, P0, P1)
        pod(cv, v, 0, (tx + 1.5, y + ho[1]), 0.0, tod, True, ground=(tx + 1.5, y), H=H)
    save(cv, f'{name}-{tod}')


def contact():
    """the three crossings by day and night, labelled, one PNG"""
    ims = {(v, t): Image.open(os.path.join(OUTD, f'cross-{v}-{t}.png')) for v in 'abc' for t in ('day', 'night')}
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
                terminal_card(v, tod); pylon_card(v, tod); pod_card(v, tod); cross_card(v, tod)
            if WHICH in ('all', 'colony'):
                colony(v, tod); colony(v, tod, T=96); colony(v, tod, T=28, name=f'phone-{v}-{tod}')
        if WHICH in ('all', 'cards', 'cut'):
            cut_card(tod)
        if WHICH in ('all', 'scale'):
            lineup(tod)
    if WHICH in ('all', 'cards'):
        contact()
    print('wrote', OUTD)
