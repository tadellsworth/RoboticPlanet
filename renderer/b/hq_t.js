// Command Base (game id "lander"), "Tron line" proposal (same footprint and silhouette as hq.js).
// An armoured octagonal wall with a sloped, chamfered profile and glowing coping lines along both top edges, a lit
// skirt line at its foot and dashed team-colour inlays on its faces; four faceted octagonal gun bastions with
// glowing top rings, lit firing slits and angular twin-barrelled turrets whose barrels carry glowing rings; a
// glowing blast gate between two armoured gate towers (lit corner posts, amber warning lamps) over a dark approach
// apron with lane lines and chevrons; inside, the faceted, stepped command block (the old landing craft plated
// over: four angular legs with lit spines) with glowing outlines at every step, a slanted band of team-tinted
// windows, lit corner ridges, a cupola ringed with light slits, and a tall faceted mast with lit edges, a radar
// dish with a glowing rim and a team beacon. Courtyard: charging docks, supply containers, energy cells.
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
  L.seed(301);
  const P8 = Math.PI / 8, AMBER = '#ffb347';

  // ---------------------------------------------------------------- wall
  const A = 3.78, C = 1.62, G = 0.95, TW = 0.86, gx = G + TW / 2;
  const V = [[A, -A + C], [A, A - C], [A - C, A], [-A + C, A], [-A, A - C], [-A, -A + C], [-A + C, -A], [A - C, -A]];
  const path = [[-gx, A], V[3], V[4], V[5], V[6], V[7], V[0], V[1], V[2], [gx, A]];
  sweep(path, [[0.62, 0], [0.62, 0.15], [0.54, 0.25], [-0.48, 0.25], [-0.48, 0]], T.armorD, { dirt: 0.5 });          // skirt
  sweep(path, [[0.54, 0.25], [0.46, 0.93], [0.37, 1.02], [-0.33, 1.02], [-0.42, 0.93], [-0.45, 0.25]], T.armor);       // body
  sweep(path, [[0.37, 1.02], [0.35, 1.1], [-0.31, 1.1], [-0.33, 1.02]], T.roof, { dirt: 0 });                          // coping
  line(offset(path, 0.35, false), 1.1, 0.06, T.glow, false);       // coping lines along both top edges
  line(offset(path, -0.31, false), 1.1, 0.04, T.glowSoft, false);
  for (let i = 0; i < path.length - 1; i++) {
    const P = path[i], Q = path[i + 1], len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
    if (i % 2 === 1) continue;                                       // diagonals sit behind the bastions
    const nx = (Q[1] - P[1]) / len, nz = -(Q[0] - P[0]) / len;
    const g = group((P[0] + Q[0]) / 2, 0, (P[1] + Q[1]) / 2, Math.atan2(nx, nz));
    const gp = group(0, 0.25, 0.54, 0, g); gp.rotation.x = Math.atan2(-0.08, 0.68);    // on the sloped outer face
    const np = Math.max(1, Math.round(len / 1.1)), pw = len / np;
    for (let k = 0; k < np; k++) {
      const xc = -len / 2 + (k + 0.5) * pw;
      if (k > 0) box(0.05, 0.68, 0.03, T.seam, xc - pw / 2, 0, 0, { parent: gp, dirt: 0 });
      box(pw * 0.5, 0.07, 0.03, T.glow, xc, 0.36, 0.004, { parent: gp, ...nc });             // dashed inlays
      box(pw * 0.62, 0.05, 0.03, T.seam, xc, 0.2, 0, { parent: gp, dirt: 0 });
      box(pw * 0.5, 0.07, 0.03, T.glowSoft, xc, 0.6, -0.455, { parent: g, ...nc });            // inner face
      if (k > 0) box(0.05, 0.68, 0.03, T.seam, xc - pw / 2, 0.25, -0.45, { parent: g, dirt: 0 });
    }
  }

  // ---------------------------------------------------------------- corner gun bastions
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = sx * 3.12, bz = sz * 3.12, out = Math.atan2(-sz, sx), at = r => ngon(r, 8, P8, bx, bz);
    prism(at(1.24), 0, 0.26, T.armorD, { c: 0.08, dirt: 0.5 });
    loft([[at(1.13), 0.26], [at(1.01), 1.56], [at(0.88), 1.7]], T.armor);
    line(at(1.01), 1.56, 0.06, T.glow);                               // glowing ring round the top
    faces(at(1.13), 0.26, at(1.01), 1.56, (g, f) => {
      if (f.nx * sx + f.nz * sz < 0.2) return;                        // firing slits on the outward faces
      box(0.5, 0.13, 0.05, T.black, 0, 0.66, 0, { parent: g, dirt: 0 });
      box(0.38, 0.04, 0.05, T.glowHi, 0, 0.71, 0.012, { parent: g, ...nc });
      box(0.05, 0.9, 0.03, T.seam, f.w * 0.36, 0.12, 0, { parent: g, dirt: 0 }); box(0.05, 0.9, 0.03, T.seam, -f.w * 0.36, 0.12, 0, { parent: g, dirt: 0 });
    });
    prism(at(0.66), 1.7, 1.84, T.armorD, { c: 0.04, dirt: 0 });       // turret ring
    line(at(0.66), 1.78, 0.04, T.glowSoft);
    const t = group(bx, 1.84, bz, out);                                 // local +x points outward
    loft([[crect(1.02, 0.82, 0.2, -0.06, 0), 0], [crect(0.94, 0.74, 0.17, -0.08, 0), 0.3], [crect(0.7, 0.56, 0.13, -0.16, 0), 0.46]], T.armor, { parent: t, dirt: 0 });
    gl(t, ring3(crect(0.94, 0.74, 0.17, -0.08, 0), 0.3), 0.035, T.glow, true);
    box(0.05, 0.06, 0.3, T.white, 0.4, 0.36, 0, { parent: t, ...nc });
    for (const dz of [-0.17, 0.17]) {
      hcyl(0.068, 1.2, T.armorD, 0.92, 0.22, dz, { axis: 'x', parent: t, seg: 12, dirt: 0 });
      hcyl(0.085, 0.3, T.armorL, 0.52, 0.22, dz, { axis: 'x', parent: t, seg: 8, dirt: 0 });
      for (const x of [0.78, 1.0, 1.22]) hcyl(0.088, 0.07, T.glowHi, x, 0.22, dz, { axis: 'x', parent: t, seg: 12, cast: false, dirt: 0 });
      hcyl(0.095, 0.18, T.armorL, 1.54, 0.22, dz, { axis: 'x', parent: t, seg: 8, dirt: 0 });
    }
    ao(bx, bz, 2.3, 2.3, 0.45);
  }

  // ---------------------------------------------------------------- gate
  for (const s of [-1, 1]) {
    const x = s * gx, fp = crect(TW, 1.5, 0.13, x, A);
    prism(crect(TW + 0.14, 1.64, 0.14, x, A), 0, 0.26, T.armorD, { c: 0.07, dirt: 0.5 });
    loft([[fp, 0.26], [offset(fp, -0.04), 1.66], [offset(fp, -0.14), 1.78]], T.armor);
    line(offset(fp, -0.04), 1.66, 0.055, T.glow);
    const fb = offset(fp, 0), ft = offset(fp, -0.04);
    for (const k of [1, 3]) wl([[(fb[k][0] + fb[k + 1][0]) / 2, 0.26, (fb[k][1] + fb[k + 1][1]) / 2], [(ft[k][0] + ft[k + 1][0]) / 2, 1.66, (ft[k][1] + ft[k + 1][1]) / 2]], 0.05, T.glow);
    box(0.5, 0.1, 0.03, T.glowSoft, x, 1.1, A + 0.74, nc);
    lamp(x, 1.78, A + 0.42, AMBER, { size: 0.15, k: 3, intensity: 2, dist: 2.5 });
  }
  const dz = A - 0.02;
  for (const s of [-1, 1]) {                                            // the blast door: two closed leaves
    prism(rect(G - 0.015, 0.34, s * G / 2, dz), 0, 1.44, T.armorD, { c: 0.04, dirt: 0.3 });
    for (const y of [0.32, 0.62, 0.92]) box(G - 0.34, 0.06, 0.03, T.glowSoft, s * (G / 2 + 0.04), y, dz + 0.17, nc);
  }
  box(0.06, 1.34, 0.05, T.glowHi, 0, 0.04, dz + 0.17, nc);               // the glowing split between the leaves
  prism(rect(2 * G + 0.12, 0.84, 0, dz), 1.44, 1.72, T.armorL, { c: 0.06, dirt: 0 });   // lintel
  box(2 * G, 0.05, 0.05, T.glowHi, 0, 1.47, dz + 0.42, nc);
  for (const s of [-1, 1]) box(0.05, 1.44, 0.05, T.glow, s * (G - 0.02), 0, dz + 0.2, nc);
  // approach apron: dark plate, lane lines, chevrons and a lit threshold
  const z1 = 4.97, z0 = A + 0.2;
  box(2 * G - 0.06, 0.035, z1 - z0, T.armorD, 0, 0, (z0 + z1) / 2, { dirt: 0, cast: false });
  box(2 * G - 0.2, 0.04, 0.07, T.glowHi, 0, 0.005, A + 0.3, nc);
  for (const s of [-1, 1]) box(0.05, 0.04, z1 - z0 - 0.3, T.glow, s * (G - 0.16), 0.005, (z0 + z1) / 2 + 0.1, nc);
  for (const z of [4.22, 4.62]) for (const s of [-1, 1]) beam([s * 0.42, 0.04, z + 0.22], [0, 0.04, z], 0.07, 0.02, T.glow, nc);
  pointLight(TEAM, 3, 0, 1.0, A + 1.0, 3);

  // ---------------------------------------------------------------- command block (the old landing craft)
  const cz = -0.72, at = (r, n = 8, rot = P8) => ngon(r, n, rot, 0, cz);
  ao(0, cz, 5.6, 5.6, 0.55);
  prism(at(2.74), 0, 0.34, T.armorD, { c: 0.12, dirt: 0.5 });
  loft([[at(2.46), 0.34], [at(2.24), 1.86], [at(2.1), 1.98]], T.armor);
  line(at(2.24), 1.86, 0.065);
  faces(at(2.46), 0.34, at(2.24), 1.86, (g, f) => {                      // panel seams + inlays on the lower hull
    for (const x of [-0.3, 0.3]) box(0.045, 1.5, 0.03, T.seam, x * f.w, 0, 0, { parent: g, dirt: 0 });
    if (f.k % 2 === 1) box(f.w * 0.36, 0.08, 0.03, T.glowSoft, 0, 1.22, 0.004, { parent: g, ...nc });
  });
  loft([[at(2.02), 1.98], [at(1.9), 2.6]], T.black, { caps: false, dirt: 0 });   // window band
  faces(at(2.02), 1.98, at(1.9), 2.6, (g, f) => {
    for (const s of [-1, 1]) box(f.w * 0.4, 0.42, 0.03, T.glass, s * f.w * 0.215, 0.1, 0, { parent: g, ...nc });
  });
  loft([[at(1.93), 2.6], [at(1.66), 3.86], [at(1.52), 3.98]], T.armor);
  line(at(1.66), 3.86, 0.06, T.glow);
  const u0 = at(1.93), u1 = at(1.66);
  faces(at(1.93), 2.6, at(1.66), 3.86, (g, f) => { box(f.w * 0.5, 0.07, 0.03, T.glowSoft, 0, 0.95, 0.004, { parent: g, ...nc }); });
  loft([[at(1.3), 3.98], [at(1.12), 4.86], [at(0.98), 4.98]], T.armorL);  // command cupola
  faces(at(1.3), 3.98, at(1.12), 4.86, (g, f) => { box(f.w * 0.62, 0.1, 0.03, T.glowHi, 0, 0.45, 0.004, { parent: g, ...nc }); box(f.w * 0.8, 0.22, 0.02, T.black, 0, 0.39, 0, { parent: g, dirt: 0 }); });
  line(at(1.12), 4.86, 0.05, T.glow);
  prism(rect(0.6, 0.6, -0.42, cz + 0.32), 4.98, 5.12, T.armorD, { c: 0.04, dirt: 0 });   // roof hatch
  T.outline(0.6, 0.6, -0.42, 5.12, cz + 0.32, 0.035, T.glowSoft);
  // the landing legs: angular struts down to armoured feet, each with a lit spine
  for (let k = 0; k < 4; k++) {
    const g = group(0, 0, cz, Math.PI / 4 + k * Math.PI / 2);            // local +z points out along the diagonal
    prism(crect(1.02, 1.02, 0.16, 0, 2.86), 0, 0.96, T.armorD, { c: 0.08, parent: g, dirt: 0.5 });
    gl(g, ring3(crect(1.02, 1.02, 0.16, 0, 2.86), 0.88), 0.05, T.glow, true);
    loft([[rect(0.68, 1.0, 0, 2.62), 0.96], [rect(0.5, 0.42, 0, 1.78), 3.52]], T.armor, { parent: g });
    gl(g, [[0, 0.96, 3.13], [0, 3.52, 2.0]], 0.055, T.glow);
    gl(g, [[0.25, 0.96, 3.13], [0.25, 3.52, 2.0]], 0.035, T.seam); gl(g, [[-0.25, 0.96, 3.13], [-0.25, 3.52, 2.0]], 0.035, T.seam);
  }
  // armoured entrance at the front
  const ef = cz + 2.84;
  prism(crect(1.5, 1.0, 0.14, 0, ef - 0.5), 0, 1.45, T.armor, { c: 0.1 });
  line(crect(1.5, 1.0, 0.14, 0, ef - 0.5), 1.35, 0.05);
  box(0.8, 0.98, 0.04, T.black, 0, 0.0, ef, { dirt: 0 });
  box(0.66, 0.84, 0.04, T.glass, 0, 0.0, ef + 0.012, nc);
  for (const s of [-1, 1]) box(0.05, 1.0, 0.05, T.glow, s * 0.43, 0, ef + 0.01, nc);
  box(0.92, 0.06, 0.05, T.glowHi, 0, 1.0, ef + 0.01, nc);
  pointLight(TEAM, 4, 0, 1.4, ef + 0.6, 3);
  for (const s of [-1, 1]) box(0.05, 0.02, A - 0.5 - ef - 0.05, T.glowSoft, s * 0.55, 0.002, (A - 0.5 + ef) / 2, nc);   // guide lines

  // ---------------------------------------------------------------- comms mast: faceted pylon, dish, beacon
  const mx = 0.42, mz = cz - 0.3, y0 = 4.98, y1 = 9.3;
  prism(ngon(0.36, 6, 0, mx, mz), y0, y0 + 0.3, T.armorL, { c: 0.06, dirt: 0 });
  const s0 = ngon(0.2, 4, Math.PI / 4, mx, mz), s1 = ngon(0.06, 4, Math.PI / 4, mx, mz);
  loft([[s0, y0 + 0.3], [s1, y1]], T.armorD, { dirt: 0 });
  for (let k = 0; k < 4; k++) wl([[s0[k][0], y0 + 0.3, s0[k][1]], [s1[k][0], y1, s1[k][1]]], 0.035, T.glow);
  for (const [y, w] of [[7.7, 1.0], [8.6, 0.7]]) {
    box(w, 0.06, 0.06, T.armorL, mx, y, mz, { dirt: 0 });
    for (const s of [-1, 1]) box(0.08, 0.08, 0.08, T.white, mx + s * w / 2, y - 0.01, mz, nc);
  }
  lamp(mx - 0.5, 7.82, mz, AMBER, { size: 0.1, k: 3, light: false });
  const dg = group(mx, 7.0, mz, 0.5);
  box(0.12, 0.12, 0.62, T.armorL, 0, -0.06, 0.3, { parent: dg, dirt: 0 });
  const dsub = group(0, 0, 0.72, 0, dg); dsub.rotation.x = -2.2;
  const dishG = new THREE.SphereGeometry(0.82, 28, 10, 0, Math.PI * 2, 0, 0.85); dishG.translate(0, -0.82, 0);
  const dmat = T.armorD.clone(); dmat.side = THREE.DoubleSide;
  mesh(dishG, dmat, 0, 0, 0, { parent: dsub, dirt: 0 });
  hoop(0.82 * Math.sin(0.85), 0.03, T.glow, 0, 0.82 * Math.cos(0.85) - 0.82, 0, { parent: dsub, cast: false });
  cyl(0.025, 0.5, T.armorL, 0, -0.5, 0, { parent: dsub, seg: 8, dirt: 0 });
  sphere(0.07, T.white, 0, -0.52, 0, { parent: dsub, cast: false });
  cyl(0.025, 0.55, T.armorL, mx, y1, mz, { seg: 8, dirt: 0 });
  hoop(0.32, 0.025, T.glow, mx, y1 - 0.05, mz, { cast: false });
  sphere(0.25, T.glowHi, mx, y1 + 0.3, mz, { cast: false });
  pointLight(TEAM, 5, mx, y1 + 0.6, mz - 0.4, 3);
  cyl(0.025, 1.1, T.armorL, -0.62, 4.98, cz - 0.45, { seg: 8, dirt: 0 });   // a stubby second antenna
  sphere(0.06, T.amber, -0.62, 6.1, cz - 0.45, { cast: false });

  // ---------------------------------------------------------------- courtyard
  for (const z of [-1.3, -0.25, 0.8]) {                                   // charging docks along the left wall
    const x = -2.9;
    box(0.7, 0.03, 0.78, T.armorD, x, 0, z, { dirt: 0, cast: false });
    line(ngon(0.24, 8, P8, x + 0.05, z), 0.045, 0.04, T.glow);
    prism(rect(0.2, 0.5, x - 0.3, z), 0, 0.82, T.armor, { c: 0.04 });
    box(0.03, 0.45, 0.22, T.glow, x - 0.19, 0.25, z, nc);
  }
  for (const [x, z, y] of [[2.82, 0.42, 0], [2.82, 0.98, 0], [2.82, 0.7, 0.46]]) {   // supply containers
    prism(rect(0.6, 0.52, x, z), y, y + 0.44, T.armorL, { c: 0.04, dirt: 0.2 });
    T.outline(0.6, 0.52, x, y + 0.4, z, 0.03, T.glowSoft);
    box(0.02, 0.1, 0.3, T.glow, x - 0.305, y + 0.18, z, nc);
  }
  ao(2.82, 0.7, 0.8, 1.1, 0.45);
  for (const [x, z] of [[-1.15, 2.5], [-1.55, 2.55], [-1.3, 2.95], [-1.72, 3.0]]) {   // energy cells
    cyl(0.17, 0.62, T.armorD, x, 0, z, { seg: 8, dirt: 0.3 });
    hoop(0.175, 0.025, T.glow, x, 0.4, z, { cast: false });
    cyl(0.1, 0.06, T.armorL, x, 0.62, z, { seg: 8, dirt: 0 });
  }
  ao(-1.4, 2.75, 1.0, 0.9, 0.4);
  prism(crect(0.7, 1.2, 0.1, 2.92, -0.8), 0, 0.72, T.armor, { c: 0.06 });   // power unit on the right
  box(0.46, 0.02, 0.8, L.M.grille('#2c3137'), 2.92, 0.72, -0.8, { dirt: 0 });
  for (const z of [-1.1, -0.8, -0.5]) box(0.03, 0.06, 0.2, T.glow, 2.56, 0.4, z, nc);
}
