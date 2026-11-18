"""The Express highway tile sets for the design sheet: three directions, painted the way the game paints its roads.

The game draws roads itself (drawRoad in js/render.js: a band 12/32 of a tile wide with a 2 px kerb each side, concrete
or asphalt, joined to its neighbours; one-way arrows; worn asphalt fading, cracking and breaking into potholes), so an
Express tile set is drawn here the same way, as flat top-down tiles the game would autotile from a tile's neighbours
and turn to the lane's direction. Every piece is drawn for a lane running EAST (traffic flows to the right); the mock
turns and flips it. Each piece comes as two layers, as the street lamps do: the day tile, and a "lit" layer of what
glows at night (cat's-eyes, strips, guidance lights), to be added over the night-graded tile.

    A  Expressway        two one-way carriageways a tile each, the median barrier along their shared edge (an eastbound
                         tile has its median on the north side; turned 180 degrees it is the westbound tile beside it)
    B  Freight corridor  one broad one-way slab a tile wide, heavy kerbs, team-colour edge strips, guidance lights
    C  Elevated flyover  one raised one-way deck a tile wide (drawn lifted up the screen on piers by the mock)

    python3 preview/highway_tiles.py <outdir>      (run from renderer/) writes every piece at 256 px, day and lit

Pieces (w x h in tiles): A straight, ramp, merge, end, bend (2x2); B straight, ramp, layby, cross, end, bend;
C deck, ramp, bend. Shared: `fresh` (just laid, unmarked) and `bed` (the prepared base) for A and B, `rough` for C,
and a `worn` straight for each. Nothing here is game code.
"""
import math
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

R = 256          # the finished tile, pixels
SS = 4           # drawn at SS times that and averaged down
CYAN = (56, 212, 255)
RED = (255, 90, 110)
WHITE = (236, 238, 232)
AMBER = (255, 209, 102)
HAZ_Y = (232, 178, 40)
HAZ_K = (28, 28, 32)
# the game's own road colours (ROAD_LOOK in js/render.js)
ASPHALT, ASPHALT_EDGE = (51, 54, 61), (21, 23, 27)
CONCRETE, CONCRETE_EDGE = (185, 190, 197), (93, 99, 107)
# the overpass (drawOverpassDeck)
OVER_EDGE, OVER_DECK, OVER_RAIL, OVER_RAMP = (60, 66, 73), (201, 206, 213), (242, 244, 247), (154, 161, 169)


class Tile:
    """An RGBA canvas w x h tiles, drawn at SS x R pixels a tile in tile units, with a second canvas for what glows."""

    def __init__(self, w=1, h=1):
        self.w, self.h = w, h
        self.P = R * SS
        self.im = Image.new('RGBA', (int(w * self.P), int(h * self.P)), (0, 0, 0, 0))
        self.lit = Image.new('RGBA', self.im.size, (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.im)
        self.dl = ImageDraw.Draw(self.lit)

    def px(self, v):
        return v * self.P

    def _draw(self, lit, a, fn):
        """PIL replaces pixels when it draws on RGBA, so anything see-through is drawn on its own layer and composited"""
        if a >= 255:
            fn(self.dl if lit else self.d)
            return
        layer = Image.new('RGBA', self.im.size, (0, 0, 0, 0)); fn(ImageDraw.Draw(layer))
        if lit:
            self.lit.alpha_composite(layer); self.dl = ImageDraw.Draw(self.lit)
        else:
            self.im.alpha_composite(layer); self.d = ImageDraw.Draw(self.im)

    def rect(self, x0, y0, x1, y1, col, a=255, lit=False):
        self._draw(lit, a, lambda d: d.rectangle((self.px(x0), self.px(y0), self.px(x1) - 1, self.px(y1) - 1), fill=tuple(col) + (a,)))

    def poly(self, pts, col, a=255, lit=False):
        self._draw(lit, a, lambda d: d.polygon([(self.px(x), self.px(y)) for x, y in pts], fill=tuple(col) + (a,)))

    def line(self, pts, col, w, a=255, lit=False):
        self._draw(lit, a, lambda d: d.line([(self.px(x), self.px(y)) for x, y in pts], fill=tuple(col) + (a,), width=max(1, int(self.px(w))), joint='curve'))

    def dot(self, x, y, r, col, a=255, lit=False):
        self._draw(lit, a, lambda d: d.ellipse((self.px(x - r), self.px(y - r), self.px(x + r), self.px(y + r)), fill=tuple(col) + (a,)))

    def band(self, P0, P1, P2, w0, w1, col, a=255, lit=False, n=24):
        """a quadratic curve from P0 through control P1 to P2, w0 wide at the start and w1 at the end"""
        pts = []
        for k in range(n + 1):
            f = k / n
            x = (1 - f) ** 2 * P0[0] + 2 * (1 - f) * f * P1[0] + f * f * P2[0]; y = (1 - f) ** 2 * P0[1] + 2 * (1 - f) * f * P1[1] + f * f * P2[1]
            dx = 2 * (1 - f) * (P1[0] - P0[0]) + 2 * f * (P2[0] - P1[0]); dy = 2 * (1 - f) * (P1[1] - P0[1]) + 2 * f * (P2[1] - P1[1])
            L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L; hw = (w0 + (w1 - w0) * f) / 2
            pts.append(((x + nx * hw, y + ny * hw), (x - nx * hw, y - ny * hw)))
        self.poly([p[0] for p in pts] + [p[1] for p in pts][::-1], col, a, lit)

    def dashes(self, x0, x1, y, dash, gap, col, w, a=230, phase=0.0, lit=False):
        """a dashed line along x (the game's road dashes are plain rectangles)"""
        x = x0 + phase
        while x < x1:
            self.rect(max(x0, x), y - w / 2, min(x1, x + dash), y + w / 2, col, a, lit)
            x += dash + gap

    def hatch(self, pts, col, w=0.03, step=0.08, ang=45, a=235):
        """chevron / hatch markings clipped to a polygon"""
        m = Image.new('L', self.im.size, 0)
        ImageDraw.Draw(m).polygon([(self.px(x), self.px(y)) for x, y in pts], fill=255)
        hl = Image.new('RGBA', self.im.size, (0, 0, 0, 0)); dh = ImageDraw.Draw(hl)
        xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        x0, x1, y0, y1 = min(xs) - 1, max(xs) + 1, min(ys), max(ys)
        t = math.tan(math.radians(ang))
        k = x0
        while k < x1 + (y1 - y0) / max(abs(t), 1e-6):
            dh.line([(self.px(k), self.px(y0)), (self.px(k - (y1 - y0) / t), self.px(y1))], fill=tuple(col) + (a,), width=max(1, int(self.px(w))))
            k += step
        hl.putalpha(Image.fromarray(np.minimum(np.asarray(hl.getchannel('A')), np.asarray(m))))
        self.im.alpha_composite(hl)

    def stripes(self, x0, y0, x1, y1, step=0.07, w=0.5):
        """black and yellow hazard stripes, diagonal, in a box"""
        self.rect(x0, y0, x1, y1, HAZ_K)
        self.hatch([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], HAZ_Y, w=step * w, step=step, ang=55, a=255)

    def noise(self, x0, y0, x1, y1, k=0.05, seed=1, scale=6):
        """a faint grain on a surface, so a big slab is not a flat fill"""
        rng = np.random.default_rng(seed)
        W, H = int(self.px(x1 - x0)), int(self.px(y1 - y0))
        if W <= 0 or H <= 0:
            return
        n = rng.random((max(1, H // scale // SS), max(1, W // scale // SS))).astype(np.float32)
        n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)).astype(np.float32) / 255 - 0.5
        a = np.asarray(self.im).astype(np.float32)
        y, x = int(self.px(y0)), int(self.px(x0))
        sub = a[y:y + H, x:x + W, :3]
        sub *= (1 + n[..., None] * 2 * k)
        a[y:y + H, x:x + W, :3] = np.clip(sub, 0, 255)
        self.im = Image.fromarray(a.astype(np.uint8)); self.d = ImageDraw.Draw(self.im)

    def flip(self):
        self.im = self.im.transpose(Image.FLIP_LEFT_RIGHT); self.lit = self.lit.transpose(Image.FLIP_LEFT_RIGHT)
        self.d = ImageDraw.Draw(self.im); self.dl = ImageDraw.Draw(self.lit)
        return self

    def out(self):
        s = (int(self.w * R), int(self.h * R))
        return self.im.resize(s, Image.LANCZOS), self.lit.resize(s, Image.LANCZOS)


# ================================================================================================= A  Expressway
A_SURF, A_SHOULDER, A_EDGE = (36, 39, 46), (47, 51, 58), (17, 19, 23)
A_MED, A_BARRIER, A_BARRIER_SIDE = (58, 62, 68), (156, 162, 169), (96, 102, 110)
A_LANE_Y = 0.465          # the dashed line between the two lanes
A_IN, A_OUT = 0.14, 0.80  # the carriageway between the median edge line and the shoulder edge line
A_SH_OUT = 0.92           # the shoulder's outer edge


def a_median(t, x0=0.0, x1=1.0, barrier=True):
    """the median half on the tile's north side: hard standing, the barrier along the shared edge"""
    t.rect(x0, 0.0, x1, 0.10, A_MED)
    if barrier:
        t.rect(x0, 0.0, x1, 0.045, A_BARRIER)
        t.rect(x0, 0.045, x1, 0.062, A_BARRIER_SIDE)
    t.rect(x0, 0.10, x1, 0.125, A_SHOULDER)


def a_carriageway(t, x0=0.0, x1=1.0, markings=True, shoulder=True, cats=True):
    t.rect(x0, 0.10, x1, A_SH_OUT if shoulder else A_OUT + 0.03, A_SURF)
    if shoulder:
        t.rect(x0, A_OUT + 0.02, x1, A_SH_OUT, A_SHOULDER)
    t.rect(x0, A_SH_OUT if shoulder else A_OUT + 0.03, x1, (A_SH_OUT if shoulder else A_OUT + 0.03) + 0.04, A_EDGE)
    if markings:
        t.rect(x0, A_IN - 0.02, x1, A_IN, AMBER, 220)                       # the median edge line
        t.rect(x0, A_OUT, x1, A_OUT + 0.02, WHITE, 220)                     # the shoulder edge line
        t.dashes(x0, x1, A_LANE_Y, 0.28, 0.2, WHITE, 0.018, 210, phase=0.08)
    if cats:
        for x in (0.25, 0.75):
            if x0 <= x < x1:
                t.dot(x, A_LANE_Y, 0.012, (250, 250, 240), 255, lit=True); t.dot(x, A_LANE_Y, 0.012, (200, 200, 190))
                t.dot(x, A_IN - 0.01, 0.012, AMBER, 255, lit=True)
                t.dot(x, A_OUT + 0.01, 0.012, (255, 70, 60), 255, lit=True)


def a_straight(worn=False):
    t = Tile()
    a_median(t); a_carriageway(t)
    t.noise(0, 0.1, 1, A_SH_OUT, 0.035, seed=3)
    if worn:
        a_wear(t)
    return t


def a_wear(t):
    """the game's wear: the surface fades grey, cracks run, and potholes open; here a missing cat's-eye too"""
    rng = np.random.default_rng(11)
    t.rect(0, A_IN, 1, A_OUT, (170, 165, 155), 50)
    for k in range(7):
        x, y = rng.random(), A_IN + rng.random() * (A_OUT - A_IN)
        pts = [(x, y)]
        for _s in range(4):
            x += (rng.random() - 0.5) * 0.22; y += (rng.random() - 0.5) * 0.18; pts.append((x, min(A_OUT, max(A_IN, y))))
        t.line(pts, (8, 8, 10), 0.008, 200)
    for x, y, r in ((0.32, 0.62, 0.045), (0.7, 0.3, 0.035)):
        t.dot(x + 0.006, y + 0.006, r + 0.01, (150, 140, 125)); t.dot(x, y, r, (11, 11, 13))
    t.rect(0.55, A_LANE_Y - 0.03, 0.9, A_LANE_Y + 0.03, A_SURF)               # a stretch of lane line scrubbed off
    lit = np.asarray(t.lit).copy(); P = t.P
    lit[int(P * (A_LANE_Y - 0.03)):int(P * (A_LANE_Y + 0.03)), int(P * 0.7):int(P * 0.8)] = 0   # a cat's-eye gone dark
    t.lit = Image.fromarray(lit); t.dl = ImageDraw.Draw(t.lit)


def a_ramp():
    """an on-ramp from the south: the ordinary road comes in and sweeps east into the shoulder lane, which is an
    acceleration lane across this tile and the next"""
    t = Tile()
    a_median(t)
    t.rect(0, 0.10, 1, A_SH_OUT, A_SURF)
    t.rect(0, A_SH_OUT, 1, A_SH_OUT + 0.04, A_EDGE)
    # the connector: an ordinary road's width (12/32 of a tile, with its 2 px kerb) at the south edge, bending east
    t.band((0.5, 1.02), (0.5, 0.86), (1.0, 0.86), 0.5, 0.16, A_EDGE)
    t.band((0.5, 1.02), (0.5, 0.86), (1.0, 0.86), 0.375, 0.13, A_SURF)
    t.rect(0, 0.10, 1, A_SH_OUT, A_SURF)
    t.rect(0, A_IN - 0.02, 1, A_IN, AMBER, 220)
    t.dashes(0, 1, A_LANE_Y, 0.28, 0.2, WHITE, 0.018, 210, phase=0.08)
    t.dashes(0.0, 1.0, A_OUT + 0.01, 0.12, 0.08, WHITE, 0.018, 210)        # the edge line is broken along the acceleration lane
    t.hatch([(0.0, A_OUT + 0.03), (0.34, A_OUT + 0.03), (0.3, A_SH_OUT - 0.01), (0.0, A_SH_OUT - 0.01)], WHITE, w=0.02, step=0.09, a=170)
    t.poly([(0.36, 0.86), (0.3, 0.9), (0.3, 0.82)], WHITE, 170)                                          # give way as you join
    for x in (0.25, 0.75):
        t.dot(x, A_LANE_Y, 0.012, (250, 250, 240), 255, lit=True); t.dot(x, A_IN - 0.01, 0.012, AMBER, 255, lit=True)
    t.noise(0, 0.1, 1, 1.0, 0.035, seed=4)
    return t


def a_merge():
    """the tile after a ramp: the acceleration lane tapers back into the shoulder, chevrons in the gore"""
    t = Tile()
    a_median(t)
    t.rect(0, 0.10, 1, A_SH_OUT, A_SURF)
    t.poly([(0.0, 0.9), (0.55, A_SH_OUT), (1.0, A_SH_OUT), (1.0, A_SH_OUT + 0.04), (0.0, A_SH_OUT + 0.04)], A_SHOULDER)
    t.rect(0, A_SH_OUT, 1, A_SH_OUT + 0.04, A_EDGE)
    t.poly([(0.0, 0.9), (0.0, 0.94), (0.6, A_SH_OUT + 0.04), (0.6, A_SH_OUT)], A_EDGE)
    t.rect(0, A_IN - 0.02, 1, A_IN, AMBER, 220)
    t.dashes(0, 1, A_LANE_Y, 0.28, 0.2, WHITE, 0.018, 210, phase=0.08)
    t.dashes(0.0, 0.5, A_OUT + 0.01, 0.12, 0.08, WHITE, 0.018, 210)
    t.rect(0.5, A_OUT, 1, A_OUT + 0.02, WHITE, 220)
    t.hatch([(0.0, A_OUT + 0.03), (0.5, A_OUT + 0.03), (0.0, 0.89)], WHITE, w=0.02, step=0.09, a=170)
    for x in (0.25, 0.75):
        t.dot(x, A_LANE_Y, 0.012, (250, 250, 240), 255, lit=True); t.dot(x, A_IN - 0.01, 0.012, AMBER, 255, lit=True)
        t.dot(x, A_OUT + 0.01, 0.012, (255, 70, 60), 255, lit=True)
    t.noise(0, 0.1, 1, 1.0, 0.035, seed=5)
    return t


def a_end():
    """one carriageway's end: it narrows onto an ordinary road centred on its own tile row (roads are tile-aligned, so
    each carriageway hands on to its own road and the two meet at an ordinary junction beyond); the median barrier
    ends in a hazard nose with red lamps, chevrons fill the lost width. Flipped, it is the carriageway's start."""
    t = Tile()
    t.rect(0, 0.0, 0.46, 0.10, A_MED)
    t.rect(0, 0.0, 0.36, 0.045, A_BARRIER); t.rect(0, 0.045, 0.36, 0.062, A_BARRIER_SIDE)
    t.stripes(0.36, 0.0, 0.44, 0.075, step=0.025)
    t.poly([(0, 0.08), (0.47, 0.08), (0.87, 0.29), (1.0, 0.29), (1.0, 0.71), (0.87, 0.71), (0.52, A_SH_OUT + 0.04), (0, A_SH_OUT + 0.04)], A_EDGE)
    t.poly([(0, 0.10), (0.46, 0.10), (0.85, 0.3125), (1.0, 0.3125), (1.0, 0.6875), (0.85, 0.6875), (0.5, A_SH_OUT), (0, A_SH_OUT)], A_SURF)
    t.rect(0.85, 0.3125, 1.0, 0.6875, ASPHALT)
    t.rect(0, A_IN - 0.02, 0.46, A_IN, AMBER, 220); t.line([(0.46, A_IN - 0.01), (0.86, 0.335)], AMBER, 0.018, 220)
    t.dashes(0, 0.5, A_LANE_Y, 0.28, 0.2, WHITE, 0.018, 210, phase=0.08)
    t.line([(0.0, A_OUT + 0.01), (0.5, A_OUT + 0.01), (0.86, 0.665)], WHITE, 0.018, 220)
    t.hatch([(0.5, A_OUT + 0.03), (0.85, 0.69), (0.52, A_SH_OUT - 0.01)], WHITE, w=0.02, step=0.09, a=170)
    t.hatch([(0.52, A_LANE_Y + 0.03), (0.84, A_LANE_Y + 0.03), (0.84, 0.64), (0.5, A_OUT - 0.02)], WHITE, w=0.02, step=0.1, a=120)
    t.dot(0.25, A_LANE_Y, 0.012, (250, 250, 240), 255, lit=True); t.dot(0.25, A_IN - 0.01, 0.012, AMBER, 255, lit=True)
    t.dot(0.25, A_OUT + 0.01, 0.012, (255, 70, 60), 255, lit=True)
    t.dot(0.40, 0.02, 0.015, (255, 60, 50), 255, lit=True); t.dot(0.40, 0.055, 0.015, AMBER, 255, lit=True)
    t.noise(0, 0.0, 1, 1.0, 0.035, seed=6)
    return t


def a_bend():
    """a 90 degree bend of the pair, 2 x 2 tiles: the eastbound lane comes in on the west edge of the south tile and
    leaves southward, the westbound lane comes up the east side and leaves west; banked quarter annuli about the
    block's south-west corner, the median barrier on the ring between them"""
    t = Tile(2, 2)
    C = (0.0, 2.0)
    ps = lambda r, col, a=255, lit=False: (t.dl if lit else t.d).pieslice((t.px(C[0] - r), t.px(C[1] - r), t.px(C[0] + r), t.px(C[1] + r)), 270, 360, fill=tuple(col) + (a,))
    for r, col in ((1.96, A_EDGE), (1.92, A_SHOULDER), (1.8, A_SURF), (1.125, A_SHOULDER), (1.10, A_MED), (1.045, A_BARRIER_SIDE), (1.03, A_BARRIER),
                   (0.955, A_MED), (0.9, A_SHOULDER), (0.875, A_SURF), (0.2, A_SHOULDER), (0.08, A_EDGE)):
        ps(r, col)
    ps(0.04, (0, 0, 0), 0)

    def arc(r, col, w, a=220, dash=None):
        L = math.pi / 2 * r
        segs = [(0.0, L)] if dash is None else [(k, min(L, k + dash)) for k in np.arange(0.0, L, dash * 1.7)]
        for s0, s1 in segs:
            m = max(3, int((s1 - s0) / r * 24))
            t.line([(C[0] + r * math.sin(s0 / r + (s1 - s0) / r * q / m), C[1] - r * math.cos(s0 / r + (s1 - s0) / r * q / m)) for q in range(m + 1)], col, w, a)
    arc(1.8, WHITE, 0.018); arc(1.465, WHITE, 0.018, dash=0.28); arc(1.13, AMBER, 0.018)
    arc(0.87, AMBER, 0.018); arc(0.535, WHITE, 0.018, dash=0.2); arc(0.2, WHITE, 0.018)
    for r, col in ((1.465, (250, 250, 240)), (1.14, AMBER), (1.81, (255, 70, 60)), (0.535, (250, 250, 240)), (0.86, AMBER), (0.21, (255, 70, 60))):
        for q in (0.17, 0.5, 0.83):
            t.dot(C[0] + r * math.sin(q * math.pi / 2), C[1] - r * math.cos(q * math.pi / 2), 0.012, col, 255, lit=True)
    # a chevron board in the verge at the outside of the bend, where the headlights point
    t.stripes(1.56, 0.08, 1.63, 0.4, step=0.05)
    t.noise(0, 0, 2, 2, 0.03, seed=7)
    return t


def a_fresh():
    """just laid: the surface black and unmarked, the barrier up, no lines yet, cones along the shoulder"""
    t = Tile()
    a_median(t); t.rect(0, 0.10, 1, A_SH_OUT, (24, 26, 30)); t.rect(0, A_SH_OUT, 1, A_SH_OUT + 0.04, A_EDGE)
    for x in (0.2, 0.5, 0.8):
        t.dot(x, 0.86, 0.03, (236, 100, 30)); t.dot(x, 0.86, 0.012, WHITE)
    t.noise(0, 0.1, 1, 1, 0.05, seed=8)
    return t


def a_bed():
    """the prepared base before the Paver comes: pale compacted stone between the kerb lines, the median posts set"""
    t = Tile()
    t.rect(0, 0.0, 1, 0.10, A_MED); t.rect(0, 0, 1, 0.062, (120, 112, 100))
    t.rect(0, 0.10, 1, A_SH_OUT, (142, 134, 120)); t.rect(0, A_SH_OUT, 1, A_SH_OUT + 0.04, A_EDGE)
    t.noise(0, 0.1, 1, A_SH_OUT, 0.12, seed=9, scale=3)
    return t


# ================================================================================================= B  Freight corridor
B_SLAB, B_JOINT, B_KERB, B_KERB_SIDE, B_TRACK = (126, 130, 136), (78, 82, 88), (172, 177, 184), (40, 44, 50), (104, 108, 114)
B_IN, B_OUT = 0.10, 0.90


def b_kerbs(t, x0=0.0, x1=1.0, north=True, south=True, team=CYAN):
    for on, y0, y1, s0, s1, l0, l1 in ((north, 0.0, 0.08, 0.0, 0.02, 0.08, 0.105), (south, 0.92, 1.0, 0.98, 1.0, 0.895, 0.92)):
        if not on:
            continue
        t.rect(x0, y0, x1, y1, B_KERB); t.rect(x0, s0, x1, s1, B_KERB_SIDE)
        t.rect(x0, l0, x1, l1, team, 215); t.rect(x0, l0, x1, l1, team, 255, lit=True)


def b_slab(t, x0=0.0, x1=1.0, joints=True, tracks=True, lights=True, arrow=True, team=CYAN):
    t.rect(x0, B_IN, x1, B_OUT, B_SLAB)
    if tracks:
        for y in (0.33, 0.67):
            t.rect(x0, y - 0.06, x1, y + 0.06, B_TRACK, 110)
    if joints:
        for x in (0.0, 0.5):
            if x0 <= x < x1:
                t.rect(x, B_IN, x + 0.012, B_OUT, B_JOINT, 200)
    if lights:
        for x in (0.125, 0.375, 0.625, 0.875):
            if x0 <= x < x1:
                t.dot(x, 0.5, 0.016, (40, 44, 50)); t.dot(x, 0.5, 0.011, (225, 250, 255)); t.dot(x, 0.5, 0.014, (190, 245, 255), 255, lit=True)
    if arrow:
        t.poly([(0.6, 0.5), (0.48, 0.41), (0.48, 0.46), (0.36, 0.46), (0.36, 0.54), (0.48, 0.54), (0.48, 0.59)], WHITE, 120)


def b_straight(worn=False):
    t = Tile()
    b_kerbs(t); b_slab(t)
    t.noise(0, B_IN, 1, B_OUT, 0.05, seed=12)
    if worn:
        rng = np.random.default_rng(13)
        t.rect(0, B_IN, 1, B_OUT, (90, 80, 70), 40)
        for k in range(6):
            x, y = rng.random(), B_IN + rng.random() * 0.8; pts = [(x, y)]
            for _s in range(4):
                x += (rng.random() - 0.5) * 0.2; y += (rng.random() - 0.5) * 0.2; pts.append((x, min(B_OUT, max(B_IN, y))))
            t.line(pts, (20, 20, 24), 0.008, 200)
        t.poly([(0.62, 0.0), (0.78, 0.0), (0.74, 0.08), (0.66, 0.08)], (70, 66, 62))                  # a spalled kerb
        t.rect(0.6, 0.08, 0.8, 0.105, (90, 110, 120))                                              # its strip dead
        t.dot(0.375, 0.5, 0.013, (60, 62, 66)); t.dot(0.625, 0.5, 0.013, (60, 62, 66))             # two guidance lights out
        lit = np.asarray(t.lit).copy(); P = t.P
        lit[int(P * 0.45):int(P * 0.55), int(P * 0.33):int(P * 0.67)] = 0; lit[0:int(P * 0.12), int(P * 0.6):int(P * 0.8)] = 0
        t.lit = Image.fromarray(lit); t.dl = ImageDraw.Draw(t.lit)
        for x in (0.2, 0.85):
            t.dot(x, 0.72, 0.04, (150, 140, 125)); t.dot(x - 0.005, 0.715, 0.034, (28, 26, 28))      # potholes
    return t


def b_ramp():
    """an ordinary road joins from the south through a hazard-striped apron; the kerb is cut for it"""
    t = Tile()
    b_kerbs(t, south=False); b_kerbs(t, 0.0, 0.2, north=False); b_kerbs(t, 0.8, 1.0, north=False)
    b_slab(t, arrow=False)
    t.poly([(0.2, B_OUT), (0.8, B_OUT), (0.8, 0.98), (0.69, 1.0), (0.31, 1.0), (0.2, 0.98)], B_SLAB)
    t.stripes(0.2, 0.9, 0.31, 1.0, step=0.04); t.stripes(0.69, 0.9, 0.8, 1.0, step=0.04)
    t.rect(0.31, 0.985, 0.69, 1.0, ASPHALT_EDGE)
    t.dashes(0.33, 0.67, 0.93, 0.05, 0.04, WHITE, 0.02, 200)       # give way to the corridor
    t.poly([(0.5, 0.86), (0.44, 0.92), (0.56, 0.92)], WHITE, 170)
    t.noise(0, B_IN, 1, 1.0, 0.05, seed=14)
    return t


def b_layby():
    """a truck-stop lay-by on the south side: the slab widens to the tile's edge, a bay marked off with a broken line"""
    t = Tile()
    b_kerbs(t, south=False); b_kerbs(t, 0.0, 0.08, north=False); b_kerbs(t, 0.92, 1.0, north=False)
    b_slab(t, tracks=True)
    t.poly([(0.08, B_OUT), (0.92, B_OUT), (0.92, 0.985), (0.08, 0.985)], B_SLAB)
    t.rect(0.08, 0.985, 0.92, 1.0, B_KERB_SIDE); t.rect(0.08, 0.96, 0.92, 0.985, B_KERB)
    t.dashes(0.1, 0.9, B_OUT, 0.06, 0.05, WHITE, 0.016, 200)
    t.stripes(0.08, 0.9, 0.12, 0.985, step=0.03); t.stripes(0.88, 0.9, 0.92, 0.985, step=0.03)
    t.rect(0.3, 0.945, 0.7, 0.96, AMBER, 160); t.rect(0.3, 0.945, 0.7, 0.96, AMBER, 200, lit=True)   # the bay's marker light bar
    t.noise(0, B_IN, 1, 0.985, 0.05, seed=15)
    return t


def b_cross():
    """an ordinary road crossing at grade: the slab runs on, the kerbs are cut, stop lines on the ordinary road,
    hazard stripes warn where it crosses (the game's traffic light goes on the corner)"""
    t = Tile()
    b_kerbs(t, 0.0, 0.3); b_kerbs(t, 0.7, 1.0)
    b_slab(t, lights=False, arrow=False, tracks=False)
    for y0, y1 in ((0.0, B_IN), (B_OUT, 1.0)):
        t.rect(0.31, y0, 0.69, y1, ASPHALT); t.rect(0.3, y0, 0.31, y1, ASPHALT_EDGE); t.rect(0.69, y0, 0.7, y1, ASPHALT_EDGE)
    t.rect(0.31, 0.03, 0.69, 0.06, WHITE, 220); t.rect(0.31, 0.94, 0.69, 0.97, WHITE, 220)
    t.hatch([(0.3, B_IN), (0.7, B_IN), (0.7, B_OUT), (0.3, B_OUT)], (238, 190, 60), w=0.02, step=0.1, a=120)
    t.dot(0.125, 0.5, 0.014, (190, 245, 255), 255, lit=True); t.dot(0.875, 0.5, 0.014, (190, 245, 255), 255, lit=True)
    t.noise(0, 0, 1, 1, 0.04, seed=16)
    return t


def b_end():
    """the slab ends: it tapers onto an ordinary road leaving east, a hazard-striped buffer in each gore, red lamps"""
    t = Tile()
    t.poly([(0, 0), (0.45, 0), (0.86, 0.29), (1.0, 0.29), (1.0, 0.71), (0.86, 0.71), (0.45, 1.0), (0, 1.0)], B_KERB)
    t.poly([(0, B_IN), (0.45, B_IN), (0.8, 0.33), (1.0, 0.33), (1.0, 0.67), (0.8, 0.67), (0.45, B_OUT), (0, B_OUT)], B_SLAB)
    t.rect(0.86, 0.3125, 1.0, 0.6875, ASPHALT)
    t.poly([(0.82, 0.31), (1.0, 0.31), (1.0, 0.33), (0.8, 0.33)], ASPHALT_EDGE); t.poly([(0.82, 0.69), (1.0, 0.69), (1.0, 0.67), (0.8, 0.67)], ASPHALT_EDGE)
    t.poly([(0, 0.08), (0.46, 0.08), (0.82, 0.31), (0.8, 0.33), (0.45, B_IN), (0, B_IN)], CYAN, 215)
    t.poly([(0, 0.92), (0.46, 0.92), (0.82, 0.69), (0.8, 0.67), (0.45, B_OUT), (0, B_OUT)], CYAN, 215)
    t.poly([(0, 0.08), (0.46, 0.08), (0.82, 0.31), (0.8, 0.33), (0.45, B_IN), (0, B_IN)], CYAN, 255, lit=True)
    t.poly([(0, 0.92), (0.46, 0.92), (0.82, 0.69), (0.8, 0.67), (0.45, B_OUT), (0, B_OUT)], CYAN, 255, lit=True)
    t.stripes(0.5, 0.12, 0.62, 0.3, step=0.04); t.stripes(0.5, 0.7, 0.62, 0.88, step=0.04)
    for x in (0.125, 0.375):
        t.dot(x, 0.5, 0.016, (40, 44, 50)); t.dot(x, 0.5, 0.011, (225, 250, 255)); t.dot(x, 0.5, 0.014, (190, 245, 255), 255, lit=True)
    t.dot(0.56, 0.21, 0.02, (255, 60, 50), 255, lit=True); t.dot(0.56, 0.79, 0.02, (255, 60, 50), 255, lit=True)
    t.dot(0.56, 0.21, 0.02, (120, 30, 30)); t.dot(0.56, 0.79, 0.02, (120, 30, 30))
    t.noise(0, 0, 1, 1, 0.05, seed=17)
    return t


def b_bend():
    """a 90 degree bend, eastbound in on the west edge, out southward: a banked quarter annulus about the tile's
    south-west corner, the kerbs, strips and guidance lights following it"""
    t = Tile()
    C = (0.0, 1.0)
    ps = lambda r, col, a=255, lit=False: (t.dl if lit else t.d).pieslice((t.px(C[0] - r), t.px(C[1] - r), t.px(C[0] + r), t.px(C[1] + r)), 270, 360, fill=tuple(col) + (a,))
    for r, col in ((1.0, B_KERB_SIDE), (0.98, B_KERB), (0.92, B_KERB), (0.92, CYAN), (0.895, B_SLAB), (0.105, CYAN), (0.08, B_KERB), (0.02, B_KERB_SIDE)):
        ps(r, col)
    ps(0.02, (0, 0, 0), 0)
    for r in (0.9075, 0.0925):
        ps(r + 0.0125, CYAN, 255, lit=True); ps(r - 0.0125, (0, 0, 0), 0, lit=True)
    for q in (0.15, 0.4, 0.65, 0.9):
        a = q * math.pi / 2; x, y = C[0] + 0.5 * math.sin(a), C[1] - 0.5 * math.cos(a)
        t.dot(x, y, 0.016, (40, 44, 50)); t.dot(x, y, 0.011, (225, 250, 255)); t.dot(x, y, 0.014, (190, 245, 255), 255, lit=True)
    t.stripes(0.88, 0.04, 0.96, 0.3, step=0.03)
    t.noise(0, 0, 1, 1, 0.05, seed=18)
    return t


def b_fresh():
    t = Tile()
    b_kerbs(t); t.rect(0, B_IN, 1, B_OUT, (96, 100, 106))
    for x in (0.2, 0.5, 0.8):
        t.dot(x, 0.84, 0.03, (236, 100, 30)); t.dot(x, 0.84, 0.012, WHITE)
    t.noise(0, B_IN, 1, B_OUT, 0.06, seed=19)
    return t


def b_bed():
    t = Tile()
    t.rect(0, 0, 1, 0.08, (120, 112, 100)); t.rect(0, 0.92, 1, 1, (120, 112, 100))
    t.rect(0, B_IN, 1, B_OUT, (142, 134, 120)); t.rect(0, 0.0, 1, 0.02, B_KERB_SIDE); t.rect(0, 0.98, 1, 1.0, B_KERB_SIDE)
    t.noise(0, 0.08, 1, 0.92, 0.12, seed=20, scale=3)
    return t


# ================================================================================================= C  Elevated flyover
C_DECK, C_RAIL, C_POST, C_FACE, C_FACE_LOW, C_KERB = (46, 49, 55), (222, 226, 231), (128, 134, 142), (74, 80, 88), (38, 42, 48), (160, 166, 174)
C_IN, C_OUT = 0.22, 0.78        # the parapets' outer faces (the Viaduct's 56 % deck)


def c_deck_body(t, x0=0.0, x1=1.0, markings=True, rails=True, face=True, team=CYAN):
    if face:
        t.rect(x0, C_OUT, x1, 0.86, C_FACE); t.rect(x0, 0.84, x1, 0.86, C_FACE_LOW)
    t.rect(x0, C_IN, x1, C_OUT, C_DECK)
    if rails:
        for y0, y1 in ((C_IN, C_IN + 0.04), (C_OUT - 0.04, C_OUT)):
            t.rect(x0, y0, x1, y1, C_RAIL)
            for x in np.arange(0.06, 1.0, 0.22):
                if x0 <= x < x1:
                    t.rect(x, y0 - 0.005, x + 0.03, y1 + 0.005, C_POST)
        t.rect(x0, C_IN + 0.04, x1, C_IN + 0.055, team, 170); t.rect(x0, C_OUT - 0.055, x1, C_OUT - 0.04, team, 170)
        t.rect(x0, C_IN + 0.04, x1, C_IN + 0.055, team, 235, lit=True); t.rect(x0, C_OUT - 0.055, x1, C_OUT - 0.04, team, 235, lit=True)
    if markings:
        t.rect(x0, C_IN + 0.07, x1, C_IN + 0.085, WHITE, 200); t.rect(x0, C_OUT - 0.085, x1, C_OUT - 0.07, WHITE, 200)
        t.dashes(x0, x1, 0.5, 0.22, 0.16, WHITE, 0.016, 200, phase=0.05)
        for x in (0.25, 0.75):
            if x0 <= x < x1:
                t.dot(x, 0.5, 0.011, (250, 250, 240), 255, lit=True)


def c_deck(worn=False):
    t = Tile()
    c_deck_body(t)
    t.noise(0, C_IN, 1, C_OUT, 0.04, seed=21)
    if worn:
        rng = np.random.default_rng(22)
        t.rect(0, C_IN + 0.06, 1, C_OUT - 0.06, (150, 140, 120), 45)
        for k in range(5):
            x, y = rng.random(), 0.3 + rng.random() * 0.4; pts = [(x, y)]
            for _s in range(4):
                x += (rng.random() - 0.5) * 0.2; y += (rng.random() - 0.5) * 0.1; pts.append((x, min(0.7, max(0.3, y))))
            t.line(pts, (12, 12, 14), 0.008, 200)
        for x in (0.18, 0.47, 0.8):
            t.poly([(x, C_OUT), (x + 0.03, C_OUT), (x + 0.045, 0.86), (x - 0.01, 0.86)], (120, 70, 40), 150)   # rust streaks down the face
        t.rect(0.55, C_IN, 0.72, C_IN + 0.04, C_POST)                                                     # a parapet section gone
        t.dot(0.4, 0.62, 0.035, (150, 140, 125)); t.dot(0.395, 0.615, 0.03, (18, 18, 20))
        lit = np.asarray(t.lit).copy(); P = t.P; lit[:, int(P * 0.5):int(P * 0.8)] = lit[:, int(P * 0.5):int(P * 0.8)] * 0.25
        t.lit = Image.fromarray(lit.astype(np.uint8)); t.dl = ImageDraw.Draw(t.lit)
    return t


def c_ramp():
    """the deck coming down to the ground, eastward: the parapets give way to retaining walls that splay to an ordinary
    road's width at the foot, hazard stripes on the wall ends (the mock draws this tile half lifted, sloping)"""
    t = Tile()
    t.poly([(0, C_OUT), (1.0, 0.72), (1.0, 0.74), (0, 0.86)], C_FACE)
    t.poly([(0, C_IN), (1, 0.31), (1, 0.69), (0, C_OUT)], C_DECK)
    t.poly([(0, C_IN), (1, 0.30), (1, 0.325), (0, C_IN + 0.04)], C_KERB); t.poly([(0, C_OUT - 0.04), (1, 0.675), (1, 0.7), (0, C_OUT)], C_KERB)
    t.poly([(0, C_IN + 0.04), (1, 0.325), (1, 0.335), (0, C_IN + 0.055)], CYAN, 170); t.poly([(0, C_OUT - 0.055), (1, 0.665), (1, 0.675), (0, C_OUT - 0.04)], CYAN, 170)
    t.poly([(0, C_IN + 0.04), (1, 0.325), (1, 0.335), (0, C_IN + 0.055)], CYAN, 235, lit=True); t.poly([(0, C_OUT - 0.055), (1, 0.665), (1, 0.675), (0, C_OUT - 0.04)], CYAN, 235, lit=True)
    t.dashes(0, 1, 0.5, 0.22, 0.16, WHITE, 0.016, 200, phase=0.05)
    for x in np.arange(0.1, 1.0, 0.14):      # the slope's grip grooves
        t.rect(x, 0.36 - (0.36 - C_IN - 0.07) * (1 - x), x + 0.012, 0.64 + (C_OUT - 0.07 - 0.64) * (1 - x), (28, 30, 34), 60)
    t.stripes(0.0, C_IN - 0.03, 0.08, C_IN + 0.04, step=0.03); t.stripes(0.0, C_OUT - 0.04, 0.08, C_OUT + 0.03, step=0.03)
    t.dot(0.04, C_IN - 0.02, 0.014, (255, 60, 50), 255, lit=True); t.dot(0.04, C_OUT + 0.02, 0.014, (255, 60, 50), 255, lit=True)
    t.noise(0, C_IN, 1, 0.86, 0.04, seed=23)
    return t


def c_bend():
    """a 90 degree bend of the deck about the tile's south-west corner, the parapets following it"""
    t = Tile()
    C = (0.0, 1.0)
    ps = lambda r, col, a=255, lit=False: (t.dl if lit else t.d).pieslice((t.px(C[0] - r), t.px(C[1] - r), t.px(C[0] + r), t.px(C[1] + r)), 270, 360, fill=tuple(col) + (a,))
    ps(0.84, C_FACE); ps(0.78, C_RAIL); ps(0.74, CYAN); ps(0.725, C_DECK); ps(0.275, CYAN); ps(0.26, C_RAIL); ps(0.22, (0, 0, 0), 0)
    ps(0.755, CYAN, 235, lit=True); ps(0.74, (0, 0, 0), 0, lit=True); ps(0.275, CYAN, 235, lit=True); ps(0.26, (0, 0, 0), 0, lit=True)
    for q in (0.15, 0.4, 0.65, 0.9):
        a = q * math.pi / 2; x, y = C[0] + 0.5 * math.sin(a), C[1] - 0.5 * math.cos(a)
        t.dot(x, y, 0.011, (250, 250, 240), 255, lit=True); t.dot(x, y, 0.011, (200, 200, 190))
    t.noise(0, 0, 1, 1, 0.04, seed=24)
    return t


def c_rough():
    """the deck poured but not finished: no parapets, no lines, grey formwork along the edges"""
    t = Tile()
    t.rect(0, C_OUT, 1, 0.86, (110, 100, 85)); t.rect(0, C_IN, 1, C_OUT, (96, 98, 102))
    t.rect(0, C_IN, 1, C_IN + 0.03, (140, 128, 105)); t.rect(0, C_OUT - 0.03, 1, C_OUT, (140, 128, 105))
    t.noise(0, C_IN, 1, 0.86, 0.08, seed=25)
    return t


# ================================================================================================= the sets
def pieces(v):
    if v == 'a':
        return {'straight': a_straight, 'ramp': a_ramp, 'merge': a_merge, 'end': a_end, 'bend': a_bend, 'fresh': a_fresh, 'bed': a_bed, 'worn': lambda: a_straight(True)}
    if v == 'b':
        return {'straight': b_straight, 'ramp': b_ramp, 'layby': b_layby, 'cross': b_cross, 'end': b_end, 'bend': b_bend, 'fresh': b_fresh, 'bed': b_bed, 'worn': lambda: b_straight(True)}
    return {'straight': c_deck, 'ramp': c_ramp, 'bend': c_bend, 'rough': c_rough, 'worn': lambda: c_deck(True)}


_cache = {}


def piece(v, name):
    """(day RGBA, lit RGBA) PIL images at 256 px a tile, cached"""
    key = (v, name)
    if key not in _cache:
        _cache[key] = pieces(v)[name]().out()
    return _cache[key]


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'out', 'highway')
    os.makedirs(out, exist_ok=True)
    for v in 'abc':
        for name in pieces(v):
            day, lit = piece(v, name)
            day.save(os.path.join(out, f'{v}-{name}.png')); lit.save(os.path.join(out, f'{v}-{name}-lit.png'))
    print('wrote', out)
