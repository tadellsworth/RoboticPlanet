// Outpost, "Tron line" proposal (same footprint and silhouette as outpost.js): a fortified garrison tower.
// A faceted octagonal bunker of dark armour on a plinth, lit firing slits in every face and glowing corner ridges,
// a glowing parapet rail round its roof deck; rising from it, the octagonal watchtower with lit corner posts, a
// band of team-tinted windows, and an overhanging crenellated crown outlined in light; on top, a faceted sensor
// mast with lit edges, a radar dish with a glowing rim and the team beacon. An armoured porch with a glowing
// door frame opens onto a dark approach apron with lane lines and chevrons; angular barriers with amber lamps.
import { tron } from './tronkit.js';
export const config = { pad: false };

// ---- faceted geometry helpers (lofted rings with mitred corners) ----
function kit(L, T) {
  const { THREE, mesh, beam } = L;
  const TAU = Math.PI * 2;
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // polygons are lists of [x, z]; orientation: outward normal of edge (a -> b) is (dz, -dx)
  const ngon = (r, n, rot = 0, cx = 0, cz = 0) => Array.from({ length: n }, (_, k) => { const a = rot - k * TAU / n; return [cx + r * Math.sin(a), cz + r * Math.cos(a)]; });
  const rect = (w, d, cx = 0, cz = 0) => [[cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2], [cx - w / 2, cz - d / 2]];
  const crect = (w, d, c, cx = 0, cz = 0) => { const x = w / 2, z = d / 2; return [[x, -z + c], [x, z - c], [x - c, z], [-x + c, z], [-x, z - c], [-x, -z + c], [-x + c, -z], [x - c, -z]].map(([a, b]) => [cx + a, cz + b]); };
  // offset a polyline / polygon outward by d with mitred corners
  function offset(pts, d, closed = true) {
    const n = pts.length, nrm = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return [dz / l, -dx / l]; };
    return pts.map((P, i) => {
      const ns = [];
      if (closed || i > 0) ns.push(nrm(pts[(i - 1 + n) % n], P));
      if (closed || i < n - 1) ns.push(nrm(P, pts[(i + 1) % n]));
      let mx = 0, mz = 0; for (const v of ns) { mx += v[0]; mz += v[1]; }
      const ml = Math.hypot(mx, mz); mx /= ml; mz /= ml;
      const k = d / (mx * ns[0][0] + mz * ns[0][1]);
      return [P[0] + mx * k, P[1] + mz * k];
    });
  }
  // loft through rings [[pts, y], ...] (equal counts). Rings go outer-bottom -> up -> over the top (-> inner side).
  // closed: the ring path is a loop (caps: 'top' | 'both' | false); open: a swept wall (end caps).
  function loft(rings, mat, o = {}) {
    const closed = o.closed ?? true, caps = o.caps ?? (closed ? 'top' : 'ends');
    const R = rings.map(([pts, y]) => pts.map(p => [p[0], y, p[1]]));
    const m = R.length, n = R[0].length, segs = closed ? n : n - 1, s = 0.5;
    const pos = [], uv = [];
    const put = (P, U) => { pos.push(P[0], P[1], P[2]); uv.push(U[0], U[1]); };
    const tri = (A, B, C, ua, ub, uc, want) => {
      if (want && dot(cross(sub(B, A), sub(C, A)), want) < 0) { [B, C] = [C, B]; [ub, uc] = [uc, ub]; }
      put(A, ua); put(B, ub); put(C, uc);
    };
    const uc = [0]; for (let i = 1; i <= segs; i++) { const a = R[0][i - 1], b = R[0][i % n]; uc.push(uc[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
    const vc = [0]; for (let j = 1; j < m; j++) { const a = R[j - 1][0], b = R[j][0]; vc.push(vc[j - 1] + Math.hypot(...sub(b, a))); }
    for (let j = 0; j < m - 1; j++) for (let i = 0; i < segs; i++) {
      const i2 = (i + 1) % n, A = R[j][i], B = R[j + 1][i], C = R[j][i2], D = R[j + 1][i2];
      const uA = [uc[i] * s, vc[j] * s], uB = [uc[i] * s, vc[j + 1] * s], uC = [uc[i + 1] * s, vc[j] * s], uD = [uc[i + 1] * s, vc[j + 1] * s];
      tri(A, B, C, uA, uB, uC); tri(B, D, C, uB, uD, uC);
    }
    const cap = (P3, want, proj) => {
      const c2 = P3.map(proj).map(([x, y]) => new THREE.Vector2(x, y));
      for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(c2, [])) tri(P3[a], P3[b], P3[c], [c2[a].x * s, c2[a].y * s], [c2[b].x * s, c2[b].y * s], [c2[c].x * s, c2[c].y * s], want);
    };
    if (closed) {
      if (caps === 'top' || caps === 'both') cap(R[m - 1], [0, 1, 0], p => [p[0], p[2]]);
      if (caps === 'both') cap(R[0], [0, -1, 0], p => [p[0], p[2]]);
    } else if (caps === 'ends') {
      for (const [i, i2] of [[0, 1], [n - 1, n - 2]]) {
        const t = sub(R[0][i2], R[0][i]), tl = Math.hypot(t[0], t[2]), want = [-t[0] / tl, 0, -t[2] / tl];
        cap(R.map(r => r[i]), want, p => [-p[0] * want[2] + p[2] * want[0], p[1]]);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return mesh(geo, mat, 0, 0, 0, { dirt: 0.35, ...o });
  }
  // a solid block on a footprint: optional taper t (inset at the top) and chamfered top edge c
  function prism(pts, y0, y1, mat, o = {}) {
    const c = o.c ?? 0, t = o.t ?? 0, rings = [[pts, y0]];
    if (c > 0) rings.push([offset(pts, -t), y1 - c], [offset(pts, -t - c), y1]); else rings.push([offset(pts, -t), y1]);
    return loft(rings, mat, o);
  }
  // sweep a profile [[d (outward), y], ...] along an open polyline
  const sweep = (path, profile, mat, o = {}) => loft(profile.map(([d, y]) => [offset(path, d, false), y]), mat, { closed: false, ...o });
  // groups on each face of a frustum (rings rb at yb, rt at yt): local x along the face, y up the slant, z out of it
  function faces(rb, yb, rt, yt, fn, parent) {
    const n = rb.length;
    for (let k = 0; k < n; k++) {
      const a = rb[k], b = rb[(k + 1) % n], c = rt[k], d = rt[(k + 1) % n];
      const cb = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], ct = [(c[0] + d[0]) / 2, (c[1] + d[1]) / 2];
      const ex = b[0] - a[0], ez = b[1] - a[1], el = Math.hypot(ex, ez), nx = ez / el, nz = -ex / el;
      const dn = (ct[0] - cb[0]) * nx + (ct[1] - cb[1]) * nz, h = yt - yb;
      const g = L.group(cb[0], yb, cb[1], Math.atan2(nx, nz), parent); g.rotation.order = 'YXZ'; g.rotation.x = Math.atan2(dn, h);
      fn(g, { k, w: el, sl: Math.hypot(dn, h), nx, nz });
    }
  }
  const nc = { dirt: 0, cast: false };
  // glowing line through world points [[x, y, z], ...]
  function wl(pts, w, mat, closed = false) { for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) beam(pts[i], pts[(i + 1) % pts.length], w, w, mat, nc); }
  // glowing line through points given in a group's local frame
  function gl(g, pts, w, mat, closed = false) {
    g.updateWorldMatrix(true, false);
    wl(pts.map(p => g.localToWorld(new THREE.Vector3(...p)).toArray()), w, mat, closed);
  }
  const ring3 = (pts, y) => pts.map(([x, z]) => [x, y, z]);
  return { ngon, rect, crect, offset, loft, prism, sweep, faces, wl, gl, ring3, nc };
}

export default function (L) {
  const { box, cyl, hcyl, beam, hoop, lamp, pointLight, ao, mesh, sphere, group, THREE, TEAM } = L;
  const T = tron(L); T.pad();
  const { ngon, rect, crect, offset, loft, prism, sweep, faces, wl, gl, ring3, nc } = kit(L, T);
  const line = (pts, y, w = 0.06, mat = T.glow, closed = true) => T.edges(pts, y, w, mat, closed);
  L.seed(91);
  const P8 = Math.PI / 8, AMBER = '#ffb347';
  const cz = -0.4, at = (r, y) => ngon(r, 8, P8, 0, cz);

  // ---------------------------------------------------------------- bunker
  ao(0, cz, 7.0, 7.0, 0.5);
  prism(at(3.5), 0, 0.28, T.armorD, { c: 0.1, dirt: 0.5 });
  loft([[at(3.24), 0.28], [at(2.9), 1.84], [at(2.76), 1.98]], T.armor);
  line(at(2.9), 1.84, 0.065);                                            // roof outline
  const b0 = at(3.24), b1 = at(2.9);
  for (let k = 0; k < 8; k++) wl([[b0[k][0], 0.28, b0[k][1]], [b1[k][0], 1.84, b1[k][1]]], 0.05, T.glow);   // corner ridges
  faces(at(3.24), 0.28, at(2.9), 1.84, (g, f) => {
    if (f.k === 7) return;                                               // the front face carries the porch
    for (const s of [-1, 1]) {
      box(f.w * 0.3, 0.16, 0.05, T.black, s * f.w * 0.21, 0.72, 0, { parent: g, dirt: 0 });
      box(f.w * 0.24, 0.045, 0.05, T.glowHi, s * f.w * 0.21, 0.78, 0.012, { parent: g, ...nc });
    }
    box(0.045, 1.5, 0.03, T.seam, 0, 0.02, 0, { parent: g, dirt: 0 });
    box(f.w * 0.7, 0.06, 0.03, T.glowSoft, 0, 1.28, 0.004, { parent: g, ...nc });
  });
  // the deck: a glowing parapet rail on slim posts
  const rail = at(2.58);
  for (let k = 0; k < 8; k++) {
    const a = rail[k], b = rail[(k + 1) % 8];
    for (const t of [0, 0.5]) box(0.06, 0.5, 0.06, T.armorL, a[0] + (b[0] - a[0]) * t, 1.98, a[1] + (b[1] - a[1]) * t, { dirt: 0 });
  }
  line(rail, 2.5, 0.055, T.glow);

  // ---------------------------------------------------------------- watchtower
  loft([[at(1.62), 1.98], [at(1.5), 3.7]], T.armor);
  const t0 = at(1.62), t1 = at(1.5);
  for (let k = 0; k < 8; k++) wl([[t0[k][0], 1.98, t0[k][1]], [t1[k][0], 3.7, t1[k][1]]], 0.05, T.glow);     // corner posts
  faces(at(1.62), 1.98, at(1.5), 3.7, (g, f) => {
    box(0.16, 0.5, 0.04, T.black, 0, 0.55, 0, { parent: g, dirt: 0 });
    box(0.05, 0.4, 0.04, T.glowHi, 0, 0.6, 0.012, { parent: g, ...nc });
  });
  loft([[at(1.5), 3.7], [at(1.46), 4.3]], T.black, { caps: false, dirt: 0 });   // window band
  faces(at(1.5), 3.7, at(1.46), 4.3, (g, f) => { box(f.w * 0.8, 0.44, 0.03, T.glass, 0, 0.08, 0, { parent: g, ...nc }); });
  loft([[at(1.47), 4.3], [at(1.42), 4.62]], T.armor, { caps: false });
  line(at(1.5), 3.7, 0.04, T.glowSoft);
  // the overhanging crown with crenellations
  loft([[at(1.42), 4.56], [at(1.9), 4.84], [at(1.9), 5.04], [at(1.8), 5.12]], T.armorL);
  line(at(1.9), 5.04, 0.065);
  line(at(1.9), 4.84, 0.035, T.glowSoft);
  const cr = at(1.62);
  for (let k = 0; k < 8; k++) {
    const a = cr[k], b = cr[(k + 1) % 8], mxk = (a[0] + b[0]) / 2, mzk = (a[1] + b[1]) / 2, ang = Math.atan2(mxk, mzk - cz);
    const g = group(mxk, 5.12, mzk, ang);
    prism(crect(0.62, 0.34, 0.06, 0, 0), 0, 0.42, T.armor, { c: 0.05, parent: g, dirt: 0.2 });
    box(0.34, 0.07, 0.03, T.glowSoft, 0, 0.2, 0.172, { parent: g, ...nc });
  }
  prism(at(1.2), 5.12, 5.2, T.roof, { dirt: 0 });

  // ---------------------------------------------------------------- sensor mast, dish, beacon
  const mx = 0.2, mz = cz, y0 = 5.2, y1 = 9.0;
  prism(ngon(0.38, 6, 0, mx, mz), y0, y0 + 0.3, T.armorL, { c: 0.06, dirt: 0 });
  const s0 = ngon(0.22, 4, Math.PI / 4, mx, mz), s1 = ngon(0.07, 4, Math.PI / 4, mx, mz);
  loft([[s0, y0 + 0.3], [s1, y1]], T.armorD, { dirt: 0 });
  for (let k = 0; k < 4; k++) wl([[s0[k][0], y0 + 0.3, s0[k][1]], [s1[k][0], y1, s1[k][1]]], 0.035, T.glow);
  for (const [y, w] of [[6.3, 1.0], [7.5, 0.8]]) {
    box(w, 0.06, 0.06, T.armorL, mx, y, mz, { dirt: 0 });
    for (const s of [-1, 1]) box(0.08, 0.08, 0.08, T.white, mx + s * w / 2, y - 0.01, mz, nc);
  }
  for (const [x, h] of [[0.62, 1.0], [-0.22, 0.7]]) cyl(0.022, h, T.armorL, x, 7.56, mz, { seg: 6, dirt: 0 });
  sphere(0.05, T.amber, 0.62, 8.58, mz, { cast: false });
  const dg = group(mx, 6.8, mz, -1.0);
  box(0.1, 0.1, 0.5, T.armorL, 0, -0.05, 0.25, { parent: dg, dirt: 0 });
  const dsub = group(0, 0, 0.58, 0, dg); dsub.rotation.x = -2.0;
  const dishG = new THREE.SphereGeometry(0.66, 28, 10, 0, Math.PI * 2, 0, 0.85); dishG.translate(0, -0.66, 0);
  const dmat = T.armorD.clone(); dmat.side = THREE.DoubleSide;
  mesh(dishG, dmat, 0, 0, 0, { parent: dsub, dirt: 0 });
  hoop(0.66 * Math.sin(0.85), 0.025, T.glow, 0, 0.66 * Math.cos(0.85) - 0.66, 0, { parent: dsub, cast: false });
  cyl(0.022, 0.42, T.armorL, 0, -0.42, 0, { parent: dsub, seg: 8, dirt: 0 });
  sphere(0.06, T.white, 0, -0.44, 0, { parent: dsub, cast: false });
  cyl(0.025, 0.5, T.armorL, mx, y1, mz, { seg: 8, dirt: 0 });
  hoop(0.34, 0.025, T.glow, mx, y1 - 0.02, mz, { cast: false });
  sphere(0.28, T.glowHi, mx, y1 + 0.42, mz, { cast: false });
  pointLight(TEAM, 5, mx, y1 + 0.9, mz - 0.4, 3);

  // ---------------------------------------------------------------- porch, door and approach
  const pf = cz + 3.42;                                                  // porch front face
  prism(crect(1.5, 0.95, 0.14, 0, pf - 0.475), 0, 1.5, T.armor, { c: 0.1 });
  line(crect(1.5, 0.95, 0.14, 0, pf - 0.475), 1.4, 0.05);
  box(0.8, 1.0, 0.04, T.black, 0, 0, pf, { dirt: 0 });
  box(0.66, 0.86, 0.04, T.glass, 0, 0, pf + 0.012, nc);
  box(0.05, 0.86, 0.04, T.glowHi, 0, 0, pf + 0.02, nc);
  for (const s of [-1, 1]) box(0.05, 1.02, 0.05, T.glow, s * 0.43, 0, pf + 0.01, nc);
  box(0.92, 0.06, 0.05, T.glowHi, 0, 1.02, pf + 0.01, nc);
  lamp(0, 1.5, pf - 0.3, AMBER, { size: 0.13, k: 3, intensity: 1.5, dist: 2 });
  pointLight(TEAM, 3, 0, 1.3, pf + 0.6, 3);
  const z0 = pf + 0.02, z1 = 4.97;
  box(1.5, 0.035, z1 - z0, T.armorD, 0, 0, (z0 + z1) / 2, { dirt: 0, cast: false });
  box(1.2, 0.04, 0.07, T.glowHi, 0, 0.005, z0 + 0.12, nc);
  for (const s of [-1, 1]) box(0.05, 0.04, z1 - z0 - 0.3, T.glow, s * 0.6, 0.005, (z0 + z1) / 2 + 0.1, nc);
  for (const z of [3.75, 4.2, 4.65]) for (const s of [-1, 1]) beam([s * 0.36, 0.04, z + 0.2], [0, 0.04, z], 0.07, 0.02, T.glow, nc);

  // angular barriers at the front corners
  for (const [x, z, r] of [[-3.55, 3.5, 0.5], [3.55, 3.5, -0.5]]) {
    const c = Math.cos(r), s = Math.sin(r), hl = 0.7;
    const path = [[x - c * hl, z + s * hl], [x + c * hl, z - s * hl]];
    sweep(path, [[0.25, 0], [0.25, 0.1], [0.12, 0.22], [0.09, 0.56], [-0.09, 0.56], [-0.12, 0.22], [-0.25, 0.1], [-0.25, 0]], T.armor, { dirt: 0.4 });
    line(path, 0.56, 0.05, T.glow, false);
    lamp(x + c * (hl - 0.12), 0.56, z - s * (hl - 0.12), AMBER, { size: 0.1, k: 3, intensity: 1, dist: 1.5 });
  }
}
