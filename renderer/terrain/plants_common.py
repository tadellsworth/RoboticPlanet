"""Shared plant-part builders on top of r3d."""
import numpy as np
from r3d import *


def rot_z(V, a):
    c, s = np.cos(a), np.sin(a)
    R = np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
    return V @ R.T


def rot_y(V, a):
    c, s = np.cos(a), np.sin(a)
    R = np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
    return V @ R.T


def rot_x(V, a):
    c, s = np.cos(a), np.sin(a)
    R = np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
    return V @ R.T


def oriented_blob(S, center, radii, yaw=0.0, pitch=0.0, roll=0.0, disp=None, nu=16, nv=24, zmin=0.0, **akw):
    """Ellipsoid with its long (x) axis turned to yaw and tipped up by pitch."""
    V, F, u, v = blob((0, 0, 0), radii, nu, nv, disp)
    V = rot_x(V, roll)
    V = rot_y(V, -pitch)
    V = rot_z(V, yaw)
    V = V + np.asarray(center, float)
    if zmin is not None:
        V[:, 2] = np.maximum(V[:, 2], zmin)
    col = akw.pop('col')
    colf = col(u, v, V) if callable(col) else col
    S.add(V, F, attrs(len(V), colf, u=u, v=v, **akw))
    return V


def leaf_width(s, W, shape='ovate'):
    s = np.asarray(s)
    if shape == 'ovate':
        return W * np.sin(np.pi * np.clip(s, 0, 1) ** 0.75) * (1 - 0.15 * s) + 0.02
    if shape == 'lance':
        return W * np.sin(np.pi * np.clip(s, 0, 1) ** 0.6) ** 0.9 * (1 - s) ** 0.35 + 0.02
    if shape == 'blade':
        return W * (1 - s) ** 0.9 + 0.01
    if shape == 'point':
        return W * (1 - s) ** 0.8 * (0.72 + 0.28 * np.sin(np.pi * s)) + 0.01
    if shape == 'heart':
        return W * np.sin(np.pi * np.clip(s, 0, 1) ** 1.25) * (1.0 + 0.25 * (1 - s)) + 0.02
    if shape == 'broad':
        return W * np.sin(np.pi * np.clip(s, 0, 1) ** 0.62) ** 0.8 + 0.02
    raise ValueError(shape)


def add_leaf(S, origin, yaw, length, W, pitch0, pitch1, shape='ovate', n=12, ncross=5, fold=0.25, roll=0.0,
             col='#556b2f', col_tip=None, col2=None, mat=1, spec=0.18, trans=0.35, snow=0.0, gloss=22,
             pitch_curve=1.0, yaw1=None, droop_edges=0.0, col_mid=None):
    sp, yws = arc_spine(origin, yaw, length, pitch0, pitch1, n, yaw1=yaw1, pitch_curve=pitch_curve)
    s = np.linspace(0, 1, n)
    w = leaf_width(s, W, shape)
    V, F, u, v = ribbon(sp, w, yaws=yws, ncross=ncross, fold=fold, roll=roll, droop_edges=droop_edges)
    c = C(col)
    if col_tip is not None:
        c = lerpc(col, col_tip, smoothstep(0.25, 1.0, u))
    if col_mid is not None:
        c = c + (C(col_mid) - c) * (np.exp(-(v / 0.25) ** 2))[:, None] * 0.6
    S.add(V, F, attrs(len(V), c, col2=col2 if col2 is not None else col, u=u, v=v, mat=mat, spec=spec,
                      trans=trans, snow=snow, gloss=gloss))
    return sp


def thick_leaf(S, origin, yaw, length, W, pitch0, pitch1, thick=0.45, shape='point', n=14, nseg=12,
               concave=0.25, col='#5f6440', col_tip=None, tip_from=0.45, mat=3, spec=0.2, gloss=16, snow=0.0,
               trans=0.0, col2=None):
    sp, yws = arc_spine(origin, yaw, length, pitch0, pitch1, n)
    s = np.linspace(0, 1, n)
    w = leaf_width(s, W, shape)
    T = tangents(sp)
    side = np.stack([-np.sin(yws), np.cos(yws), np.zeros(n)], -1)
    side = nrm(side - (side * T).sum(-1, keepdims=True) * T)
    up = nrm(np.cross(T, side))
    up = np.where(up[:, 2:3] < 0, -up, up)
    a = np.linspace(0, 2 * np.pi, nseg, endpoint=False)
    ca, sa = np.cos(a), np.sin(a)
    prof_up = np.where(sa > 0, sa * thick - concave * (1 - ca ** 2) * 0.6, sa * thick * 0.9)
    P = (sp[:, None, :] + side[:, None, :] * (w[:, None] * ca[None, :])[..., None]
         + up[:, None, :] * (w[:, None] * prof_up[None, :])[..., None])
    V = P.reshape(-1, 3)
    F = gf(n, nseg, True)
    u = np.repeat(s, nseg)
    v = np.tile(ca, n)
    c = C(col) if col_tip is None else lerpc(col, col_tip, smoothstep(tip_from, 1.0, u))
    S.add(V, F, attrs(len(V), c, col2=col2, u=u, v=v, mat=mat, spec=spec, gloss=gloss, snow=snow, trans=trans))
    return sp


def add_tube(S, spine, r0, r1, nseg=7, col='#776655', col_tip=None, mat=3, spec=0.08, gloss=14, snow=0.0,
             radius=None, col2=None, trans=0.0):
    n = len(spine)
    s = np.linspace(0, 1, n)
    rad = r0 + (r1 - r0) * s if radius is None else radius
    V, F, u, v = tube(spine, rad, nseg)
    c = C(col) if col_tip is None else lerpc(col, col_tip, u)
    S.add(V, F, attrs(len(V), c, col2=col2, u=u, v=v, mat=mat, spec=spec, gloss=gloss, snow=snow, trans=trans))


def wiggle_spine(origin, direction, length, n, rng, amp=0.15, upbias=0.0, gravity=0.0):
    d = nrm(direction)
    pts = [np.asarray(origin, float)]
    ds = length / (n - 1)
    for i in range(n - 1):
        d = nrm(d + rng.normal(size=3) * amp + np.array([0, 0, upbias]) - np.array([0, 0, gravity]))
        pts.append(pts[-1] + d * ds)
    return np.array(pts)


def lobed(R, rng, k=6, amp=(0.06, 0.2), fmax=8):
    a = rng.uniform(amp[0], amp[1], k) / np.sqrt(k / 3)
    f = rng.integers(2, fmax, k)
    p = rng.uniform(0, 2 * np.pi, k)

    def rf(th):
        th = np.asarray(th)
        return R * (1 + sum(a[i] * np.sin(f[i] * th + p[i]) for i in range(k)))
    return rf
