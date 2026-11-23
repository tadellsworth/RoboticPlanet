# Ithaca I, the globe's realistic surface: the atlas's own fields (tools/atlas/atlas.py), evaluated at any point of the
# sphere, plus extra detail (fractal coasts, relief, region colours). Shared by globe_texture.py and globe_borders.py.
import numpy as np, math

_TAB = {}
def _tab(seed):
    t = _TAB.get(seed)
    if t is None:
        t = np.random.default_rng(seed).random((64, 64, 64)).astype(np.float32).ravel(); _TAB[seed] = t
    return t

def vnoise(x, y, z, f, seed):
    """atlas.py's value noise, exactly (same lattice, same tables)."""
    g = _tab(seed)
    x = (x + 2) * f; y = (y + 2) * f; z = (z + 2) * f
    xi = np.floor(x); yi = np.floor(y); zi = np.floor(z)
    xf = (x - xi).astype(np.float32); yf = (y - yi).astype(np.float32); zf = (z - zi).astype(np.float32)
    xi = xi.astype(np.int64); yi = yi.astype(np.int64); zi = zi.astype(np.int64)
    u = xf * xf * (3 - 2 * xf); v = yf * yf * (3 - 2 * yf); w = zf * zf * (3 - 2 * zf)
    x0 = (xi % 64) * 4096; x1 = ((xi + 1) % 64) * 4096
    y0 = (yi % 64) * 64; y1 = ((yi + 1) % 64) * 64
    z0 = zi % 64; z1 = (zi + 1) % 64
    def L(a, b, t): return a + (b - a) * t
    c00 = L(g[x0 + y0 + z0], g[x1 + y0 + z0], u); c10 = L(g[x0 + y1 + z0], g[x1 + y1 + z0], u)
    c01 = L(g[x0 + y0 + z1], g[x1 + y0 + z1], u); c11 = L(g[x0 + y1 + z1], g[x1 + y1 + z1], u)
    return L(L(c00, c10, v), L(c01, c11, v), w)

def fbm(x, y, z, f, seed, o=5, gain=0.5):
    t = 0; a = 1; n = 0
    for i in range(o):
        t = t + a * vnoise(x, y, z, f * 2 ** i, seed + i); n += a; a *= gain
    return t / n

def ridged(x, y, z, f, seed, o=6):
    t = 0; a = 1; n = 0; prev = 1
    for i in range(o):
        r = 1 - np.abs(2 * vnoise(x, y, z, f * 2 ** i, seed + i) - 1); r = r * r
        t = t + a * r * prev; prev = np.clip(r * 1.6, 0, 1); n += a; a *= 0.5
    return t / n

# the atlas's territories (atlas.py's T): name, region, lon, lat, radius
T = [
 ("Pathfinder's Landing","rust",-118,24,26),("Redwash Flats","rust",-152,30,26),("Dustgate","rust",-108,-4,26),("Ironbluff","rust",-145,-6,26),
 ("Passenger Town","green",-86,30,22),("Tallpine","green",-74,56,22),("Stillwater","green",-100,50,20),
 ("Goldleaf","ember",-160,58,22),("Foxford","ember",-128,62,22),
 ("Herdway","grass",-22,20,24),("Ledger Post","grass",2,34,24),("Windsweep","grass",-12,0,24),
 ("the Delta","black",-22,-26,22),("Heron Reach","black",4,-30,22),
 ("Northcap","polar",-80,80,0),("Southcap","polar",80,-80,0),
 ("Ringfall Basin","cinder",80,-30,25),("Ashfield","cinder",112,-42,25),("Cinder Rift","cinder",68,-54,23),
 ("the Terraces","steam",108,14,22),("Geyser Field","steam",80,10,22),
 ("Palm Keys","shoals",-60,-4,13),("Lantern Reef","shoals",-56,-22,13),
 ("Violet Reach","bloom",146,-20,24),("Bloom Edge","bloom",150,12,22),
]
REGIONS = ['rust', 'green', 'ember', 'grass', 'black', 'polar', 'cinder', 'steam', 'shoals', 'bloom']
TREG = np.array([REGIONS.index(t[1]) for t in T])
LANDT = [i for i, t in enumerate(T) if t[1] != 'polar']
IN = 14; IS = 15
OFF = None  # set by calibrate()

def vec(lo, la):
    lo, la = math.radians(lo), math.radians(la)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])

def beltlat(lo): return 28 * np.cos(np.radians(lo + 120))

def xyz(lon, lat):
    LO = np.radians(lon); LA = np.radians(lat)
    return np.cos(LA) * np.cos(LO), np.cos(LA) * np.sin(LO), np.sin(LA)

def scores(X, Y, Z, want_all=False):
    wx = X + 0.22 * (fbm(X, Y, Z, 2.5, 11) - 0.5); wy = Y + 0.22 * (fbm(X, Y, Z, 2.5, 21) - 0.5); wz = Z + 0.22 * (fbm(X, Y, Z, 2.5, 31) - 0.5)
    n = np.sqrt(wx * wx + wy * wy + wz * wz); wx /= n; wy /= n; wz /= n
    S = np.full((len(T),) + X.shape, -9.0, np.float32)
    for i in LANDT:
        v = vec(T[i][2], T[i][3])
        S[i] = -np.degrees(np.arccos(np.clip(wx * v[0] + wy * v[1] + wz * v[2], -1, 1))) / T[i][4]
    return S

def calibrate():
    """atlas.py's bisection for the coast offset (65% land), at the atlas's own resolution."""
    global OFF
    W, H = 1200, 600  # (half the atlas's size: the same answer to well under a pixel)
    lon = np.linspace(-180, 180, W, endpoint=False) + 180 / W; lat = np.linspace(90, -90, H, endpoint=False) - 90 / H
    LO, LA = np.meshgrid(lon, lat); X, Y, Z = xyz(LO, LA)
    S = scores(X, Y, Z); best = S.max(0); coast = fbm(X, Y, Z, 5, 41, 6)
    wt = np.cos(np.radians(LA)); pole = np.abs(LA) > 70
    lo_, hi_ = -0.6, 0.6
    for _ in range(25):
        m_ = (lo_ + hi_) / 2
        L = best > -1.0 - 0.9 * (coast - 0.5) + m_
        if ((L | pole) * wt).sum() / wt.sum() > 0.665: lo_ = m_
        else: hi_ = m_
    OFF = lo_
    return OFF

def fields(X, Y, Z, lat, detail=True):
    """Continuous fields at points: S (scores per territory), s1, s2, tid, g (land > 0, with fractal coast detail),
    cn/cs (polar caps > 0, degrees), and more."""
    S = scores(X, Y, Z)
    order = np.argsort(-S, axis=0)
    tid = order[0]; tid2 = order[1]
    s1 = np.take_along_axis(S, order[:1], 0)[0]; s2 = np.take_along_axis(S, order[1:2], 0)[0]
    coast = fbm(X, Y, Z, 5, 41, 6)
    g0 = s1 + 1.0 + 0.9 * (coast - 0.5) - OFF
    # fractal coast: bays, headlands and islets, strongest right at the shore so the continents keep their shape
    if detail:
        d1 = fbm(X, Y, Z, 22, 101, 8, 0.55) - 0.5
        d2 = ridged(X, Y, Z, 40, 121, 5) - 0.35
        near = np.exp(-np.abs(g0) / 0.12)
        g = g0 + near * (0.16 * d1 + 0.05 * d2) + 0.035 * d1
    else:
        g = g0
    # the Shoals: islets only
    sh = (TREG[tid] == REGIONS.index('shoals'))
    isl = fbm(X, Y, Z, 18, 51, 4)
    if detail: isl = isl + 0.05 * (fbm(X, Y, Z, 70, 141, 4) - 0.5)
    gsh = np.minimum(np.minimum(g, (isl - 0.55) * 2.0), (s1 + 1.0))
    # blend across the shoals' edge (its territory edge is a straight sea line, no visible seam)
    shi = [i for i, t in enumerate(T) if t[1] == 'shoals']; oth = [i for i in LANDT if i not in shi]
    wsh = 1 / (1 + np.exp(np.clip(-(S[shi].max(0) - S[oth].max(0)) / 0.012, -50, 50)))
    g = g + (gsh - g) * wsh
    cn = lat - (70 + 14 * (fbm(X, Y, Z, 4, 61, 5) - 0.5))
    cs = (-70 + 14 * (fbm(X, Y, Z, 4, 71, 5) - 0.5)) - lat
    return dict(S=S, tid=tid, tid2=tid2, s1=s1, s2=s2, g=g, g0=g0, cn=cn, cs=cs, coast=coast, isl=isl, sh=sh)

def craters():
    """The atlas's craters (same random draws), as (lon, lat, angular radius in degrees), plus Ringfall Basin's own."""
    out = []
    cr = np.random.default_rng(5); W = 2400
    for k in range(260):
        lo = cr.uniform(-180, 180); la = beltlat(lo) + cr.normal(0, 6)
        r = cr.uniform(2, 9) * (3 if k < 6 else 1)
        out.append((lo, la, r * 360 / W))
    # many small ones under the belt, more in the Rust and Cinderlands
    cr = np.random.default_rng(55)
    for k in range(380):
        lo = cr.uniform(-180, 180); la = beltlat(lo) + cr.normal(0, 9)
        out.append((lo, la, cr.uniform(0.12, 0.6) * (1 + 2 * (cr.random() < 0.08))))
    out.append((79, -27, 7.5))   # Ringfall Basin, the biggest crater (the Ring Shard Spire at 78,-25)
    return out
