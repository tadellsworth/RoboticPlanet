# The Contingency globe's territory outlines, as smooth lines (js/contingency-globe.js: do not edit that by hand).
# From the atlas's own fields (globe_planet.py, the same territories as tools/atlas/atlas.py's map and CONT_CELLS):
# each territory's edge is where its score meets its neighbour's, or the (smoothed) coast, or the polar caps' edge, traced
# with marching squares on a 2048 x 1024 grid, simplified, and delta-coded in fiftieths of a degree.
#   CONT_RINGS[t]: territory t's outline(s), closed rings [lon0, lat0, dlon, dlat, ...] (the globe's owner outlines, its
#                  tints and what a tap picks: js/contingency-ui.js). The caps' rings go round their pole.
#   CONT_BORDERS:  the borders between territories on land, drawn once each: [kind, lon0, lat0, dlon, dlat, ...], kind 1
#                  where two regions meet, 2 the caps' edge, 0 otherwise.
# Usage: python3 tools/atlas/globe_borders.py   (a minute or two)
import os, json, math, numpy as np
import globe_planet as P

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 2048, 1024
COAST = 0.05       # the outline runs this far off the smooth coast (in the coast field's units), round the real one
TOL = 0.035        # simplification tolerance, degrees
Q = 50             # coordinates in 1/Q degree

def grid():
    lon = np.linspace(-180, 180, W, endpoint=False) + 180 / W
    lat = np.linspace(90, -90, H, endpoint=False) - 90 / H
    return lon, lat

def compute():
    lon, lat = grid()
    nT = len(P.T)
    F = {k: np.zeros((H, W), np.float32) for k in ('s1', 's2', 'g0', 'cn', 'cs')}
    tid = np.zeros((H, W), np.int16); tid2 = np.zeros((H, W), np.int16)
    S = np.zeros((nT, H, W), np.float32)
    for j0 in range(0, H, 64):
        LO, LA = np.meshgrid(lon, lat[j0:j0 + 64]); X, Y, Z = P.xyz(LO, LA)
        f = P.fields(X, Y, Z, LA, detail=False)
        for k in F: F[k][j0:j0 + 64] = f[k]
        tid[j0:j0 + 64] = f['tid']; tid2[j0:j0 + 64] = f['tid2']; S[:, j0:j0 + 64] = f['S']
        print('.', end='', flush=True)
    print()
    return lon, lat, F, tid, tid2, S

def march(f):
    """Closed contours (f = 0, f > 0 inside) of a field whose border is negative, as lists of (x, y) in grid units."""
    Hh, Ww = f.shape
    segs = {}
    def eid(kind, j, i): return (kind, j, i)   # 'h': between (j,i),(j,i+1); 'v': between (j,i),(j+1,i)
    def pt(e):
        kind, j, i = e
        if kind == 'h': a, b = f[j, i], f[j, i + 1]; t = a / (a - b); return (i + t, j)
        a, b = f[j, i], f[j + 1, i]; t = a / (a - b); return (i, j + t)
    pos = f > 0
    js, is_ = np.nonzero((pos[:-1, :-1] != pos[:-1, 1:]) | (pos[:-1, :-1] != pos[1:, :-1]) | (pos[:-1, :-1] != pos[1:, 1:]))
    adj = {}
    def link(a, b):
        adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    for j, i in zip(js.tolist(), is_.tolist()):
        c = (pos[j, i] << 0) | (pos[j, i + 1] << 1) | (pos[j + 1, i + 1] << 2) | (pos[j + 1, i] << 3)
        T_, R_, B_, L_ = eid('h', j, i), eid('v', j, i + 1), eid('h', j + 1, i), eid('v', j, i)
        if c in (1, 14): link(L_, T_)
        elif c in (2, 13): link(T_, R_)
        elif c in (4, 11): link(R_, B_)
        elif c in (8, 7): link(B_, L_)
        elif c in (3, 12): link(L_, R_)
        elif c in (6, 9): link(T_, B_)
        elif c in (5, 10):
            mid = (f[j, i] + f[j, i + 1] + f[j + 1, i] + f[j + 1, i + 1]) / 4
            if (c == 5) == (mid > 0): link(L_, B_); link(T_, R_)
            else: link(L_, T_); link(R_, B_)
    seen = set(); rings = []
    for start in adj:
        if start in seen: continue
        ring = [start]; seen.add(start); prev = None; cur = start
        while True:
            nx = [e for e in adj[cur] if e != prev and (e not in seen or (e == start and len(ring) > 2))]
            if not nx: break
            if nx[0] == start: break
            prev, cur = cur, nx[0]; seen.add(cur); ring.append(cur)
        rings.append([pt(e) for e in ring])
    return rings

def dp(pts, tol, closed):
    """Douglas-Peucker on (lon, lat) points."""
    a = np.array(pts, float)
    if closed and len(a) > 3:
        # split the ring at its farthest pair so both halves simplify well
        k = int(np.argmax(((a - a[0]) ** 2).sum(1)))
        return dp(pts[:k + 1], tol, False)[:-1] + dp(pts[k:] + [pts[0]], tol, False)[:-1]
    keep = np.zeros(len(a), bool); keep[0] = keep[-1] = True
    stack = [(0, len(a) - 1)]
    while stack:
        s, e = stack.pop()
        if e <= s + 1: continue
        p, q = a[s], a[e]; d = q - p; n = math.hypot(*d) or 1e-9
        dist = np.abs((a[s + 1:e, 0] - p[0]) * d[1] - (a[s + 1:e, 1] - p[1]) * d[0]) / n
        k = int(np.argmax(dist))
        if dist[k] > tol: keep[s + 1 + k] = True; stack += [(s, s + 1 + k), (s + 1 + k, e)]
    return [tuple(x) for x in a[keep]]

def code(pts):
    out = []; px = py = None
    for lo, la in pts:
        x, y = int(round(lo * Q)), int(round(la * Q))
        if px is None: out += [x, y]
        else:
            dx = x - px
            dx = (dx + 180 * Q) % (360 * Q) - 180 * Q   # (across the date line: the short way)
            out += [dx, y - py]
        px, py = x, y
    return out

def main():
    P.calibrate()
    lon, lat, F, tid, tid2, S = compute()
    dlon = 360 / W; dlat = 180 / H
    capf = np.maximum(F['cn'], F['cs'])
    land = [i for i in P.LANDT]
    shoals = [i for i, t in enumerate(P.T) if t[1] == 'shoals']
    rings = [[] for _ in P.T]
    for k in land:
        o = S.copy(); o[k] = -9; other = o[land].max(0); del o
        diff = S[k] - other
        reach = (F['g0'] + COAST) if k not in shoals else (S[k] + 1.0) * 0.5
        f = np.minimum(np.minimum(diff, reach), -capf / 10)
        # centre the territory's longitude so it never crosses the grid's edge
        c = int(((P.T[k][2] + 180) / 360) * W); sh = W // 2 - c
        fr = np.roll(f, sh, 1)
        js, is_ = np.nonzero(fr > 0)
        j0, j1, i0, i1 = max(js.min() - 2, 0), min(js.max() + 3, H), max(is_.min() - 2, 0), min(is_.max() + 3, W)
        sub = np.full((j1 - j0 + 2, i1 - i0 + 2), -1.0, np.float32); sub[1:-1, 1:-1] = fr[j0:j1, i0:i1]
        for r in march(sub):
            if len(r) < 8: continue   # (specks)
            pts = [((i0 + x - 1 - sh + 0.5) * dlon - 180, 90 - (j0 + y - 1 + 0.5) * dlat) for x, y in r]
            pts = [(((a + 180) % 360) - 180, b) for a, b in pts]
            # unwrap for simplifying
            u = [pts[0]]
            for a, b in pts[1:]:
                a2 = a + 360 * round((u[-1][0] - a) / 360); u.append((a2, b))
            area = 0.5 * sum(u[i][0] * u[i - 1][1] - u[i - 1][0] * u[i][1] for i in range(len(u)))
            if abs(area) < 0.6: continue
            rings[k].append(dp(u, TOL, True))
        print(P.T[k][0], [len(r) for r in rings[k]])
    # the caps: their edge's latitude round the pole (scanning from the pole for the first crossing)
    for k, key, sgn in ((P.IN, 'cn', 1), (P.IS, 'cs', -1)):
        f = F[key]; pts = []
        rows = range(H) if sgn > 0 else range(H - 1, -1, -1)
        rows = list(rows)
        for i in range(W):
            col = f[rows, i]
            m = np.nonzero(col <= 0)[0]
            q = m[0] if len(m) else len(rows) - 1
            a, b = col[q - 1], col[q]; t = a / (a - b) if a != b else 0
            jj = rows[q - 1] + (rows[q] - rows[q - 1]) * t
            pts.append((lon[i], 90 - (jj + 0.5) * dlat))
        pts = dp(pts + [(180 + lon[0], pts[0][1])], TOL, False)[:-1]
        rings[k].append(pts)
        print(P.T[k][0], len(pts))
    # the land borders: the parts of each ring between two land territories (from the lower index), and the caps'
    # edges over land
    def at(lo, la):
        i = int(((lo + 180) % 360) / dlon) % W; j = min(H - 1, max(0, int((90 - la) / dlat)))
        return i, j
    borders = []
    for k in land:
        for r in rings[k]:
            flags = []
            for lo, la in r:
                i, j = at(lo, la)
                a, b = int(tid[j, i]), int(tid2[j, i]); oth = b if a == k else a
                ok = F['g0'][j, i] > 0.0 and capf[j, i] < -0.5 and oth in land and oth not in shoals and k not in shoals and k < oth
                flags.append((ok, oth))
            n = len(r)
            # runs of consecutive flagged points (round the ring)
            if all(f[0] for f in flags): starts = [0]; runs = [list(range(n)) + [0]]
            else:
                runs = []; s0 = next(i for i in range(n) if not flags[i][0])
                cur = []
                for q in range(1, n + 1):
                    i = (s0 + q) % n
                    if flags[i][0]: cur.append(i)
                    elif cur: runs.append(cur); cur = []
                if cur: runs.append(cur)
            for run in runs:
                if len(run) < 2: continue
                oth = max(set(flags[i][1] for i in run), key=[flags[i][1] for i in run].count)
                kind = 1 if P.TREG[k] != P.TREG[oth] else 0
                borders.append([kind] + code([r[i] for i in run]))
    for k in (P.IN, P.IS):
        r = rings[k][0]; n = len(r); run = []
        for q in range(n + 1):
            lo, la = r[q % n]; i, j = at(lo, la)
            if F['g0'][j, i] > 0: run.append(r[q % n])
            else:
                if len(run) > 1: borders.append([2] + code(run))
                run = []
        if len(run) > 1: borders.append([2] + code(run))
    # check: the rings pick what CONT_CELLS says (land cells)
    out = os.path.normpath(os.path.join(HERE, '..', '..', 'js', 'contingency-globe.js'))
    R = [[code(r) for r in rs] for rs in rings]
    head = ("'use strict';\n/*\n * Terrafall: the Contingency globe's territory outlines (js/contingency-ui.js). Made by tools/atlas/globe_borders.py\n"
            " * from the atlas's fields: do not edit by hand. Points in 1/%d degree, the first [lon, lat] whole, the rest the steps\n"
            " * from the one before. CONT_RINGS[t]: territory t's closed outline(s) (the Hollow and Argos have none; the caps' go\n"
            " * round their pole). CONT_BORDERS: the borders on land, each once: [kind (0 territories, 1 regions, 2 the caps' edge),\n"
            " * lon, lat, steps...].\n */\n") % Q
    js = head + 'const CONT_RINGS = ' + json.dumps(R + [[], [], []], separators=(',', ':')) + ';\nconst CONT_BORDERS = ' + json.dumps(borders, separators=(',', ':')) + ';\n'
    open(out, 'w').write(js)
    print('wrote', out, len(js) // 1024, 'KB', sum(len(r) for rs in rings for r in rs), 'points,', len(borders), 'borders')

if __name__ == '__main__':
    main()
