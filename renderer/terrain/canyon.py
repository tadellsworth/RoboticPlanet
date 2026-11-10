"""Sky islands canyon tiles: chasm, chasm-wall, chasm-wall-2, chasm-lip-w/e/n (+ -jungle, -polar).

Rendered at 2x (512 per tile) and downsampled to 256.
  chasm        opaque, seamless both ways
  chasm-wall   opaque, rim at top, strata fading down; tiles left-right; continues into chasm-wall-2
  chasm-wall-2 opaque, continues the strata, ends exactly as `chasm` (so chasm below joins seamlessly)
  chasm-lip-*  transparent overlays drawn on the LAND tile, hugging the named edge
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from tex import fbm, worley, hexrgb, to_lin, to_srgb, smoothstep, normals_from_height, relief, spec

N = 512
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out/canyon'
os.makedirs(OUT, exist_ok=True)

L = lambda h: to_lin(hexrgb(h))

PAL = {
    'desert': dict(
        void='#0b0806', haze='#2c1b12', mote='#f0a868',
        rim='#8c5232', rimhi='#b47a4a', crack='#1a0e09', dust='#b98a5c',
        bands=['#8a4a2c', '#b47a40', '#4c2d1e', '#7c3e26', '#c48c55', '#3e2419', '#9c5c34', '#a8693a'],
        face=0.80),
    'jungle': dict(
        void='#060907', haze='#132019', mote='#d6f07a',
        rim='#4b4c42', rimhi='#6f6f60', crack='#0d0f0c', dust='#4f6a2e',
        bands=['#3b3e37', '#4d4f45', '#2a2d28', '#55554b', '#33372f', '#46483d', '#2f322c', '#5a594d'],
        face=0.78, moss='#456f24', moss2='#6a9534', vine='#3c6b22', leaf='#5d9a30'),
    'polar': dict(
        void='#05080c', haze='#15202d', mote='#e8f6ff',
        rim='#76818d', rimhi='#9eaab6', crack='#151a20', dust='#dfe8f0',
        bands=['#6a7480', '#8794a1', '#4b545f', '#77838f', '#5a6470', '#93a0ad', '#535d68', '#6f7b88'],
        face=0.82, snow='#eef4fb', snowsh='#a9bfd6', ice='#bde3f6'),
}


def row_noise(n, seed, f_lo=2, f_hi=40, beta=1.2):
    """Periodic 1-D noise (z-scored) of length n."""
    a = fbm(n, seed, f_lo, f_hi, beta)[n // 3]
    return (a - a.mean()) / (a.std() + 1e-9)


def blocky(n, seed, seg_lo, seg_hi, amp, smooth=2.0):
    """Periodic piecewise-constant random profile (chunky crumbled outlines), lightly rounded."""
    rng = np.random.default_rng(seed)
    out = np.zeros(n)
    x = 0
    vals = []
    while x < n:
        L_ = int(rng.uniform(seg_lo, seg_hi))
        vals.append((x, min(n, x + L_), rng.uniform(-1, 1)))
        x += L_
    for a, b, v in vals:
        out[a:b] = v
    out = ndimage.gaussian_filter1d(out, smooth, mode='wrap')
    return out * amp


def down(img):
    h, w = img.shape[:2]
    return img.reshape(h // 2, 2, w // 2, 2, *img.shape[2:]).mean((1, 3))


def save(lin, path, alpha=None):
    s = to_srgb(lin)
    if alpha is None:
        Image.fromarray((s * 255 + 0.5).astype(np.uint8), 'RGB').save(path)
    else:
        a = np.clip(alpha, 0, 1)
        rgba = np.concatenate([s, a[..., None]], -1)
        Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(path)


# ---------------------------------------------------------------- chasm
def chasm(p, seed):
    void, haze = L(p['void']), L(p['haze'])
    h1 = fbm(N, seed, 3, 12, 1.5)
    h2 = fbm(N, seed + 1, 3, 30, 1.2, aniso=(0.3, 1.0))      # horizontal dust wisps
    h3 = fbm(N, seed + 2, 10, 120, 0.8)
    hz = smoothstep(-2.2, 2.4, 0.7 * h1 + 0.45 * h2)
    col = void + (haze - void) * (0.06 + 0.75 * hz ** 1.6)[..., None]
    col *= (1 + 0.03 * h3)[..., None]
    # far-off motes of light: tiny points plus a few with a soft glow
    rng = np.random.default_rng(seed + 7)
    pts = np.zeros((N, N))
    glow = np.zeros((N, N))
    big = np.zeros((N, N))
    for i in range(16):
        x, y = rng.integers(0, N, 2)
        if i < 5:
            big[y, x] += rng.uniform(0.6, 1.0)
            glow[y, x] += rng.uniform(0.6, 1.0)
        else:
            pts[y, x] += rng.uniform(0.25, 0.8)
    core = ndimage.gaussian_filter(pts, 1.1, mode='wrap') * 9 + ndimage.gaussian_filter(big, 2.0, mode='wrap') * 26
    halo = ndimage.gaussian_filter(glow, 7, mode='wrap') * 60
    m = L(p['mote'])
    col = col + m * (0.55 * core + 0.10 * halo)[..., None]
    return col


# ---------------------------------------------------------------- wall (two tiles tall)
def wall(p, seed, biome, bg):
    H2 = 2 * N
    ys, xs = np.mgrid[0:H2, 0:N]
    v = ys / N                                     # 0..2 tile units
    rng = np.random.default_rng(seed)

    # rim edge line (top surface ends here, face begins)
    e = 0.075 + 0.010 * row_noise(N, seed + 1, 2, 12, 1.5) + blocky(N, seed + 2, 14, 48, 0.012, 1.5)
    e = e + np.clip(blocky(N, seed + 3, 20, 70, 1.0, 2.5) - 0.55, 0, None) * 0.05
    E = e[None, :]

    # strata: warped band coordinate
    warp = fbm(N, seed + 4, 1, 4, 1.8, ny=H2)
    w = v + 0.022 * warp + 0.006 * fbm(N, seed + 5, 6, 30, 1.0, ny=H2)
    edges = [0.0]
    while edges[-1] < 2.4:
        edges.append(edges[-1] + rng.uniform(0.04, 0.12))
    edges = np.array(edges)
    nb = len(edges) - 1
    cols = []
    last = -1
    for i in range(nb):
        k = rng.integers(0, len(p['bands']))
        while k == last:
            k = rng.integers(0, len(p['bands']))
        cols.append(L(p['bands'][k]))
        last = k
    cols = np.array(cols)
    hard = rng.uniform(0, 1, nb)
    bi = np.clip(np.searchsorted(edges, w) - 1, 0, nb - 1)
    frac = (w - edges[bi]) / (edges[bi + 1] - edges[bi])

    # heightmap of the face (protrusion towards the viewer)
    Hb = hard[bi] * 6.0
    Hb = ndimage.gaussian_filter(Hb, (2.2, 0.6))
    grain = fbm(N, seed + 6, 20, 160, 0.9, ny=H2)
    streak = fbm(N, seed + 7, 4, 120, 1.0, aniso=(1.0, 0.12), ny=H2)   # vertical erosion runnels
    Hf = Hb + 0.55 * grain + 1.3 * streak
    # vertical cracks
    crackmask = np.zeros((H2, N))
    for i in range(5):
        cx = rng.uniform(0, N)
        v0 = rng.uniform(0.08, 0.6)
        v1 = v0 + rng.uniform(0.35, 1.2)
        jit = 3 * fbm(N, seed + 20 + i, 2, 12, 1.5, ny=H2)[:, int(cx) % N]
        xx = cx + jit[:, None] + 0 * xs
        d = np.abs(((xs - xx) + N / 2) % N - N / 2)
        wid = rng.uniform(1.2, 2.4)
        on = smoothstep(v0, v0 + 0.05, v) * (1 - smoothstep(v1 - 0.1, v1, v))
        crackmask = np.maximum(crackmask, np.exp(-(d / wid) ** 2) * on)
    Hf -= 5.0 * crackmask
    Nf = normals_from_height(Hf, 0.55)
    lit = relief(Nf, 225, 38)

    col = cols[bi] * (1 + 0.10 * grain)[..., None]
    col *= (0.92 + 0.08 * np.clip(streak, -2, 2))[..., None]
    col = col * (lit * p['face'])[..., None]
    col = col * (1 - 0.75 * crackmask)[..., None] + L(p['crack']) * (0.75 * crackmask)[..., None]

    # ledges: lit strip on top of hard bands, shadow beneath their lip
    ledge_on = np.zeros(nb, bool)
    for i in range(1, nb):
        ledge_on[i] = hard[i] > 0.45 and hard[i] > hard[i - 1] + 0.12
    lmask_t = np.zeros((H2, N))
    lshad = np.zeros((H2, N))
    brk = row_noise(N, seed + 30, 3, 40)
    for i in np.where(ledge_on)[0]:
        top = edges[i]
        dv = (w - top) * N                          # px below the band's top
        ln = smoothstep(-0.4, 0.4, brk + rng.uniform(-0.6, 0.6))[None, :]
        lmask_t = np.maximum(lmask_t, (smoothstep(-7, -3, dv) * (1 - smoothstep(1, 3, dv))) * ln)
        # shadow cast by the previous (soft) band's overhang onto this one: under the lip
        # shadow below the ledge (the ledge overhangs the band below this one)
        bot = edges[i + 1]
        db = (w - bot) * N
        lshad = np.maximum(lshad, smoothstep(-1, 1, dv - 3) * (1 - smoothstep(5, 18, dv - 3)) * ln * 0.55)
    ledgecol = L(p['dust']) * 1.05
    col = col * (1 - lmask_t)[..., None] + ledgecol * lmask_t[..., None]
    col = col * (1 - lshad)[..., None]

    # rim: top surface (lit, crumbly) above E, overhang shadow just below
    F1, F2, _ = worley(N, np.random.default_rng(seed + 40).uniform(0, 1, (260, 2)), ny=H2)
    peb = smoothstep(0.0, 0.02, F2 - F1)
    Hr = 3 * peb + 0.8 * grain
    Nr = normals_from_height(Hr, 0.6)
    litr = relief(Nr, 225, 55)
    rimc = L(p['rim']) + (L(p['rimhi']) - L(p['rim'])) * (0.5 + 0.5 * np.tanh(grain))[..., None] * 0.6
    roll = 1 - 0.55 * smoothstep(E - 0.022, E, v)            # edge rolls over
    rimc = rimc * (litr * 1.05 * roll)[..., None]
    top = v < E
    under = smoothstep(E, E + 0.004, v) * (1 - smoothstep(E + 0.006, E + 0.05, v))
    col = col * (1 - 0.62 * under)[..., None]
    # crumbled rim edge: a lit highlight on the lip
    lip = np.exp(-(((v - (E - 0.006)) * N) / 2.2) ** 2)
    col = np.where(top[..., None], rimc, col)
    col = col + L(p['rimhi']) * (0.35 * lip * (v < E + 0.002))[..., None]

    # biome dressing
    if biome == 'jungle':
        col = jungle_dress(p, col, v, E, w, edges, ledge_on, lmask_t, xs, ys, seed)
    if biome == 'polar':
        col = polar_dress(p, col, v, E, w, edges, ledge_on, lmask_t, xs, ys, seed, Nf)

    # depth: the face fades into the haze of the chasm; bottom tile ends exactly as chasm
    vv = np.maximum(v - 0.10, 0)
    a = np.exp(-(vv / 0.75) ** 1.7) * (1 - smoothstep(1.6, 1.95, v))
    a = np.where(top, 1.0, a)
    bright = 0.40 + 0.60 * a
    haze = L(p['haze'])
    rock = col * bright[..., None]
    rock = rock + (haze - rock) * (0.25 * (1 - a))[..., None]
    bg2 = np.concatenate([bg, bg], 0)
    out = bg2 + (rock - bg2) * a[..., None]
    return out


def jungle_dress(p, col, v, E, w, edges, ledge_on, lmask_t, xs, ys, seed):
    rng = np.random.default_rng(seed + 90)
    H2 = col.shape[0]
    moss_n = fbm(N, seed + 91, 6, 80, 1.0, ny=H2)
    # moss carpets the rim top and spills a little over the lip; ledge tops are mossy too
    rim_moss = (v < E + 0.012) * smoothstep(-0.6, 0.4, moss_n)
    led_moss = lmask_t * smoothstep(-0.8, 0.0, moss_n)
    m = np.maximum(rim_moss, led_moss)
    mc = L(p['moss']) + (L(p['moss2']) - L(p['moss'])) * smoothstep(0.2, 1.6, moss_n)[..., None]
    shade = 0.75 + 0.35 * smoothstep(-1, 1.5, fbm(N, seed + 92, 20, 160, 0.8, ny=H2))
    col = col * (1 - m)[..., None] + (mc * shade[..., None]) * m[..., None]
    # moss streaks down the face (damp runnels)
    damp = smoothstep(0.9, 2.0, fbm(N, seed + 93, 3, 60, 1.0, aniso=(1, 0.15), ny=H2)) * (v > E) * 0.45
    col = col * (1 - damp)[..., None] + L(p['moss']) * 0.55 * damp[..., None]
    # hanging vines from the rim lip and from a few ledges
    vines = np.zeros(col.shape[:2])
    leaves = np.zeros(col.shape[:2])
    starts = [(rng.uniform(0, N), None) for _ in range(14)]
    for (x0, _) in starts:
        e0 = E[0, int(x0) % N]
        length = rng.uniform(0.18, 0.75)
        sway = rng.uniform(4, 10)
        ph = rng.uniform(0, 6.28)
        yy = np.arange(int(e0 * N) - 4, int((e0 + length) * N))
        for y in yy:
            t = (y / N - e0) / length
            x = x0 + sway * np.sin(t * 3.0 + ph) * t
            xi = int(round(x)) % N
            if 0 <= y < H2:
                wid = 2 if t < 0.7 else 1
                for dx in range(-wid, wid + 1):
                    vines[y, (xi + dx) % N] = max(vines[y, (xi + dx) % N], 1 - abs(dx) / (wid + 1))
                if rng.uniform() < 0.18:
                    side = rng.choice([-1, 1])
                    for k in range(5):
                        for j in range(-1, 2):
                            yk, xk = y + j, (xi + side * k) % N
                            if 0 <= yk < H2:
                                leaves[yk, xk] = max(leaves[yk, xk], 1 - k / 6)
    vines = ndimage.gaussian_filter(vines, 0.6)
    leaves = ndimage.gaussian_filter(leaves, 0.8)
    # shadow of vines on the wall (down-right)
    sh = ndimage.shift(np.maximum(vines, leaves), (3, 4), order=1, mode='wrap')
    col = col * (1 - 0.45 * np.clip(sh, 0, 1))[..., None]
    vc = L(p['vine']) * 0.62 * (0.8 + 0.3 * smoothstep(-1, 1, fbm(N, seed + 94, 30, 200, 0.7, ny=H2)))[..., None]
    lc = L(p['leaf']) * 0.6
    col = col * (1 - np.clip(vines, 0, 1))[..., None] + vc * np.clip(vines, 0, 1)[..., None]
    col = col * (1 - np.clip(leaves, 0, 1))[..., None] + lc * np.clip(leaves, 0, 1)[..., None]
    return col


def polar_dress(p, col, v, E, w, edges, ledge_on, lmask_t, xs, ys, seed, Nf):
    H2 = col.shape[0]
    rng = np.random.default_rng(seed + 120)
    sn = fbm(N, seed + 121, 4, 90, 1.1, ny=H2)
    snow_c = L(p['snow'])
    snow_sh = L(p['snowsh'])
    # snow cap on the rim top, overhanging the lip as a soft cornice
    cap_edge = E + 0.010 + 0.008 * smoothstep(-0.5, 1.5, sn)
    cap = smoothstep(cap_edge + 0.003, cap_edge - 0.003, v)
    shade = smoothstep(cap_edge - 0.03, cap_edge, v)            # cornice rolls over: blue shadow
    sc = snow_c + (snow_sh - snow_c) * (0.75 * shade + 0.12 * smoothstep(0, 2, sn))[..., None]
    col = col * (1 - cap)[..., None] + sc * cap[..., None]
    # snow on ledge tops
    ls = lmask_t * smoothstep(-0.9, 0.2, sn)
    col = col * (1 - ls)[..., None] + (snow_c * 0.92) * ls[..., None]
    # ice streaks: glazed vertical runs below the rim and ledges
    ice = smoothstep(1.0, 2.2, fbm(N, seed + 122, 3, 90, 1.0, aniso=(1, 0.12), ny=H2)) * (v > cap_edge)
    ice *= 1 - smoothstep(0.3, 1.2, v - E)
    sp = spec(Nf, 24, 225, 35)
    icec = L(p['ice']) * (0.75 + 0.6 * sp)[..., None]
    col = col * (1 - 0.65 * ice)[..., None] + icec * (0.65 * ice)[..., None]
    # icicles hanging from the cornice
    ic = np.zeros(col.shape[:2])
    for _ in range(26):
        x0 = rng.uniform(0, N)
        ln = rng.uniform(8, 34)
        wd = rng.uniform(2, 4.5)
        y0 = float(cap_edge[int(E[0, int(x0) % N] * N), int(x0) % N]) * N
        for y in range(int(y0) - 2, int(y0 + ln)):
            t = (y - y0) / ln
            half = wd * (1 - np.clip(t, 0, 1))
            for dx in range(-5, 6):
                xx = (int(x0) + dx) % N
                if 0 <= y < H2 and abs(dx) <= half:
                    ic[y, xx] = max(ic[y, xx], 1.0)
    ic = ndimage.gaussian_filter(ic, 0.7)
    gx = np.gradient(ic, axis=1)
    icol = L(p['ice']) * (0.85 + 2.5 * np.clip(-gx, 0, 0.4))[..., None]
    col = col * (1 - ic)[..., None] + icol * ic[..., None]
    sh = ndimage.shift(ic, (3, 3), order=1, mode='wrap')
    col = col * (1 - 0.35 * np.clip(sh - ic, 0, 1))[..., None]
    return col


# ---------------------------------------------------------------- lips (on the land tile)
def lip(p, seed, side, biome):
    """Crumbled rim along one edge of a land tile + a dark overhang shadow at the very edge."""
    ys, xs = np.mgrid[0:N, 0:N]
    if side == 'n':
        d, t = ys / N, xs
    elif side == 'w':
        d, t = xs / N, ys
    else:  # 'e'
        d, t = 1 - (xs + 1) / N, ys
    rn = lambda s, lo, hi, b=1.2: row_noise(N, seed + s, lo, hi, b)[t]

    bk = lambda s_, lo, hi, amp, sm=2.0: blocky(N, seed + s_, lo, hi, amp, sm)[t]
    wb = 0.080 + 0.014 * rn(1, 2, 10, 1.5) + bk(2, 16, 50, 0.016)                 # rock band width
    bite = 0.012 + np.clip(bk(3, 18, 60, 1.0, 2.5) - 0.45, 0, None) * 0.06 + bk(4, 8, 22, 0.003, 1.0)
    # heightmap: crumbly rock, rolling down towards the edge
    g = fbm(N, seed + 5, 20, 180, 0.9)
    F1, F2, _ = worley(N, np.random.default_rng(seed + 6).uniform(0, 1, (90, 2)))
    peb = smoothstep(0.0, 0.03, F2 - F1) + 0.6 * smoothstep(0.08, 0.0, F1)
    H = 3.2 * peb + 0.45 * g - 9.0 * smoothstep(bite + 0.03, bite, d)
    Nn = normals_from_height(H, 0.6)
    lit = relief(Nn, 225, 50)
    rimc = L(p['rim']) + (L(p['rimhi']) - L(p['rim'])) * (0.5 + 0.5 * np.tanh(g))[..., None] * 0.6
    col = rimc * lit[..., None]
    a = smoothstep(wb + 0.003, wb - 0.003, d)                                 # rock band

    # overhang: the void-dark strip right at the edge, ragged where chunks have fallen
    void = L(p['void']) + (L(p['haze']) - L(p['void'])) * 0.35
    vm = smoothstep(bite + 0.003, bite - 0.003, d)
    shadow = smoothstep(bite + 0.035, bite, d) * (1 - vm)                     # shade creeping onto the rim
    col = col * (1 - 0.6 * shadow)[..., None]
    col = col * (1 - vm)[..., None] + void * vm[..., None]

    # loose rubble just inside the band
    rng = np.random.default_rng(seed + 8)
    rub = np.zeros((N, N))
    rsh = np.zeros((N, N))
    rcol = np.zeros((N, N))
    for _ in range(22):
        tt = rng.uniform(0, N)
        dd = rng.uniform(0.0, 0.06) ** 1.4 / 0.06 ** 0.4
        r = rng.uniform(3.0, 7.5)
        if side == 'n':
            cx, cy = tt, (0.085 + dd) * N
        elif side == 'w':
            cx, cy = (0.085 + dd) * N, tt
        else:
            cx, cy = N - (0.085 + dd) * N, tt
        dx = ((xs - cx) + N / 2) % N - N / 2
        dy = ((ys - cy) + N / 2) % N - N / 2
        q = np.sqrt(dx ** 2 + dy ** 2) / r
        m = smoothstep(1.05, 0.85, q)
        rub = np.maximum(rub, m)
        rcol = np.maximum(rcol, m * np.clip(1.0 - 0.6 * (dx + dy) / (r * 1.5), 0.3, 1.3))
        dxs, dys = dx - r * 0.45, dy - r * 0.45
        rsh = np.maximum(rsh, smoothstep(1.4, 0.6, np.sqrt(dxs ** 2 + dys ** 2) / r) * 0.45)
    rocks = L(p['rim']) * rcol[..., None] * 1.05
    # contact shadow along the inner boundary of the band, on the ground
    inner = smoothstep(wb + 0.018, wb, d) * (1 - a) * 0.35

    s_ = np.maximum(rsh * (1 - a), inner)
    P = np.zeros((N, N, 3)); A = s_.copy()
    P = rocks * rub[..., None] + P * (1 - rub)[..., None]; A = rub + A * (1 - rub)
    P = col * a[..., None] + P * (1 - a)[..., None]; A = a + A * (1 - a)
    out = P / np.maximum(A, 1e-6)[..., None]
    alpha = A

    if biome == 'jungle':
        mn = fbm(N, seed + 50, 6, 80, 1.0)
        mm = a * (1 - vm) * smoothstep(-0.3, 0.6, mn) * smoothstep(bite + 0.01, bite + 0.03, d)
        mc = L(p['moss']) + (L(p['moss2']) - L(p['moss'])) * smoothstep(0.3, 1.5, mn)[..., None]
        mc = mc * (0.7 + 0.4 * smoothstep(-1, 1.5, g))[..., None]
        out = out * (1 - mm)[..., None] + mc * mm[..., None]
    if biome == 'polar':
        sn = fbm(N, seed + 60, 4, 80, 1.1)
        cap = a * (1 - vm) * smoothstep(bite + 0.008, bite + 0.022, d) * smoothstep(-0.9, -0.2, sn)
        sh = smoothstep(bite + 0.04, bite + 0.01, d)
        sc = L(p['snow']) + (L(p['snowsh']) - L(p['snow'])) * (0.7 * sh + 0.15 * smoothstep(0, 2, sn))[..., None]
        out = out * (1 - cap)[..., None] + sc * cap[..., None]
    return out, alpha


def build(biome, seed):
    p = PAL[biome]
    suf = '' if biome == 'desert' else '-' + biome
    bg = chasm(p, seed)
    save(down(bg), f'{OUT}/chasm{suf}.png')
    wl = wall(p, seed + 100, biome, bg)
    d = down(wl)
    save(d[:256], f'{OUT}/chasm-wall{suf}.png')
    save(d[256:], f'{OUT}/chasm-wall-2{suf}.png')
    for k, side in enumerate('wen'):
        c, a = lip(p, seed + 300 + 17 * k, side, biome)
        # premultiplied downsample keeps edges clean
        pm = down(c * a[..., None])
        ad = down(a)
        c2 = np.where(ad[..., None] > 1e-4, pm / np.maximum(ad, 1e-4)[..., None], 0)
        save(c2, f'{OUT}/chasm-lip-{side}{suf}.png', ad)


if __name__ == '__main__':
    for b, s in (('desert', 11), ('jungle', 23), ('polar', 37)):
        build(b, s)
        print('done', b)
