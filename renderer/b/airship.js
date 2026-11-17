// The Airship: a slow freight airship that shuttles goods and robots between two Mooring Masts (b/mast.js). A design
// study in three directions for the owner to choose from; not installed. `v=` picks the direction:
//   a  Rigid freighter: a long classic rigid hull (pale doped skin over a girder frame), cruciform tail, four engine
//      cars on outriggers with pusher props, three cargo containers in a pannier rack on each flank, a small dorsal
//      cab and a crew car slung under the nose.
//   b  Twin-hull lifter: two slim gunmetal hulls joined by a truss deck that carries eight containers in plain view,
//      a bridge cab at the front of the deck, a docking frame running forward to one nose cone, a stabiliser
//      across both tails and a ducted pusher round each tail.
//   c  Armoured blimp: a stubby, flattened, faceted envelope in the Cargo Plane's and the Bomber's armour language
//      (gunmetal plates, thin seams, glowing team strips at the creases, a sensor visor on an armoured hood), four big
//      ducted lift fans at its corners, a V-tail, and an armoured cargo pod clamped under the belly.
// Like the Cargo Plane (b/plane.js): seen straight down, facing +x, orthographic, no ground, 30 world units across
// the frame (building units: the 10-unit pad is one tile, so the hulls run 23-25 units, about 2.4 tiles). Team colour
// glows in strips and rings, navigation lights red to port, green to starboard and white at the tail, lit windows.
// `buildAirship(L, v, G)` builds the model into group G (at the origin, nose toward +x, hull axis at y = 0) so the
// mast scene can moor one; DOCK[v] is where its mooring cone's tip is.
import { kit } from './robkit.js';
export const config = { pad: false, size: 1024 };
export const DOCK = { a: [12.95, 0, 0], b: [14.15, 0.15, 0], c: [11.6, 0, 0] };

// ------------------------------------------------------------------------------------------------- shared helpers
export function airKit(L, G) {
  const { mesh, M, THREE } = L;
  const O = (o = {}) => ({ parent: G, ...o });
  const T = 2; // world units per texture tile (as lib.js)

  // A smooth hull of revolution along x: points [x, r] (ascending x) through a Catmull-Rom spline, sampled to n
  // stations. Sections may be ellipses (ky, kz) and off-axis (yc, zc). Returns the radius at x, a point on the
  // surface at angle phi (0 = top, +pi/2 = toward +z) and sleeves: patches of skin lifted off the hull (bands, strips,
  // girders), between x0..x1 and phi0..phi1.
  function hull(pts, o = {}) {
    const yc = o.yc ?? 0, zc = o.zc ?? 0, ky = o.ky ?? 1, kz = o.kz ?? 1, seg = o.seg ?? 64;
    const curve = new THREE.SplineCurve(pts.map(([x, r]) => new THREE.Vector2(x, r)));
    const st = curve.getPoints(o.n ?? 96).map((p) => [p.x, Math.max(0, p.y)]).sort((a, b) => a[0] - b[0]);
    st[0][1] = 0; st[st.length - 1][1] = 0;
    const rMax = Math.max(...st.map((s) => s[1]));
    const rAt = (x) => { if (x <= st[0][0] || x >= st[st.length - 1][0]) return 0;
      for (let i = 0; i < st.length - 1; i++) if (x >= st[i][0] && x <= st[i + 1][0]) { const t = (x - st[i][0]) / (st[i + 1][0] - st[i][0] || 1); return st[i][1] + (st[i + 1][1] - st[i][1]) * t; } return 0; };
    const surf = (x, phi, dr = 0) => { const r = rAt(x) + dr; return [x, yc + r * ky * Math.cos(phi), zc + r * kz * Math.sin(phi)]; };
    function geo(stations, phi0, phi1, dr, sg) {
      const P = [], U = [], I = [];
      for (const [x, r0] of stations) for (let k = 0; k <= sg; k++) {
        const ph = phi0 + (phi1 - phi0) * (k / sg), r = r0 > 0 ? r0 + dr : 0;
        P.push(x, yc + r * ky * Math.cos(ph), zc + r * kz * Math.sin(ph)); U.push(x / (o.uvx ?? T), (ph * rMax) / (o.uvy ?? T));
      }
      for (let i = 0; i < stations.length - 1; i++) for (let k = 0; k < sg; k++) {
        const a = i * (sg + 1) + k, b = a + sg + 1; I.push(a, a + 1, b, a + 1, b + 1, b);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
    }
    const body = mesh(geo(st, -Math.PI, Math.PI, 0, seg), o.mat, 0, 0, 0, O({ dirt: o.dirt ?? 0.35, dirtH: (o.dirtH ?? 2) * rMax }));
    function sleeve(x0, x1, phi0, phi1, dr, mat, so = {}) {
      const s = [[x0, rAt(x0)], ...st.filter(([x]) => x > x0 && x < x1), [x1, rAt(x1)]].map(([x, r]) => [x, Math.max(r, 0.001)]);
      const n = Math.max(2, Math.round(Math.abs(phi1 - phi0) / (Math.PI * 2) * seg));
      return mesh(geo(s, phi0, phi1, dr, n), mat, 0, 0, 0, O({ dirt: 0, cast: false, ...so }));
    }
    return { st, rAt, surf, sleeve, body, rMax, yc, zc };
  }

  // A faceted body lofted through octagonal sections, flat-shaded (as b/plane.js). Section: x, w (half-width), h (top
  // above y), b (bottom below y), t (half-width of the top facet), m (where the upper chamfer meets the side, a
  // fraction of h), bt (half-width of the bottom facet), y, z. Top facet takes mats[0], upper chamfers mats[1], the
  // rest mats[2]. Sections run front (high x) to back.
  const UV = 0.5;
  function facet(st, mats, o = {}) {
    const ring = (s) => { const y = s.y ?? 0, z = s.z ?? 0, w = s.w, h = s.h, b = s.b ?? h, t = s.t ?? w * 0.55, m = (s.m ?? 0.35) * h, bt = s.bt ?? w * 0.6, mb = -0.3 * b;
      return [[z + bt, y - b], [z + w, y + mb], [z + w, y + m], [z + t, y + h], [z - t, y + h], [z - w, y + m], [z - w, y + mb], [z - bt, y - b]]; };
    const mat = (e) => (e === 3 ? 0 : e === 2 || e === 4 ? 1 : 2);
    const P = [[], [], []], U = [[], [], []];
    const rings = st.map(ring);
    const per = rings.map((r) => { const a = [0]; for (let j = 0; j < 8; j++) { const p = r[j], q = r[(j + 1) % 8]; a.push(a[j] + Math.hypot(q[0] - p[0], q[1] - p[1])); } return a; });
    const V = (i, j) => [st[i].x, rings[i][j % 8][1], rings[i][j % 8][0]];
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < 8; j++) {
      const g = mat(j), a = V(i, j), a1 = V(i, j + 1), b = V(i + 1, j), b1 = V(i + 1, j + 1);
      const ua = [st[i].x * UV, per[i][j] * UV], ua1 = [st[i].x * UV, per[i][j + 1] * UV], ub = [st[i + 1].x * UV, per[i + 1][j] * UV], ub1 = [st[i + 1].x * UV, per[i + 1][j + 1] * UV];
      P[g].push(...a, ...a1, ...b, ...a1, ...b1, ...b); U[g].push(...ua, ...ua1, ...ub, ...ua1, ...ub1, ...ub);
    }
    const cap = (i, back) => { const s = st[i], c = [s.x, s.y ?? 0, s.z ?? 0];
      for (let j = 0; j < 8; j++) { const p = V(i, j), q = V(i, j + 1); if (back) P[2].push(...c, ...p, ...q); else P[2].push(...c, ...q, ...p);
        for (const v of back ? [c, p, q] : [c, q, p]) U[2].push(v[2] * UV, v[1] * UV); } };
    if (o.capFront !== false) cap(0, false);
    if (o.capBack !== false) cap(st.length - 1, true);
    const g = new THREE.BufferGeometry(), pos = [], uv = [];
    let start = 0;
    for (let k = 0; k < 3; k++) { pos.push(...P[k]); uv.push(...U[k]); const n = P[k].length / 3; if (n) g.addGroup(start, n, k); start += n; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return mesh(g, [mats[0], mats[1] ?? mats[0], mats[2] ?? mats[1] ?? mats[0]], 0, 0, 0, O({ dirt: 0, ...o }));
  }
  const oct = (r) => ({ w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41 });
  // a flat plate from a plan outline [x, z], its top at y, bevelled
  function plate(pts, y, thick, mat, o = {}) {
    const bev = Math.min(o.bevel ?? 0.03, thick / 3), sh = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, -bev, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UV, uv.getY(i) * UV);
    return mesh(g, mat, 0, y, 0, O({ dirt: 0, ...o }));
  }
  // an upright plate from a side outline [x, y], thick in z, centred on z
  function fin(pts, z, thick, mat, o = {}) {
    const sh = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
    const bev = Math.min(0.03, thick / 3);
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
    g.translate(0, 0, -thick / 2 + bev);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UV, uv.getY(i) * UV);
    return mesh(g, mat, 0, 0, z, O({ dirt: 0, ...o }));
  }
  // a convex outline moved inward by d
  function inset(pts, d) {
    const n = pts.length, ar = pts.reduce((a, p, i) => { const q = pts[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0), sg = Math.sign(ar);
    const lines = pts.map((p, i) => { const q = pts[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), nx = -dz / l * sg, nz = dx / l * sg, dd = Array.isArray(d) ? d[i] : d;
      return [p[0] + nx * dd, p[1] + nz * dd, dx, dz]; });
    return lines.map((A, i) => { const B = lines[(i + n - 1) % n], den = A[2] * B[3] - A[3] * B[2], t = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / den; return [A[0] + A[2] * t, A[1] + A[3] * t]; });
  }
  // a thin flat strip lying on a level surface, from (x1, z1) to (x2, z2)
  const strip = (x1, z1, x2, z2, w, y, h, mat, o = {}) => { const dx = x2 - x1, dz = z2 - z1;
    return L.box(Math.hypot(dx, dz), h, w, mat, (x1 + x2) / 2, y, (z1 + z2) / 2, O({ ry: -Math.atan2(dz, dx), dirt: 0, cast: false, ...o })); };
  const beam = (a, b, w, h, mat, o = {}) => L.beam(a, b, w, h, mat, O(o));
  // a ring round an axis along x (a duct, a collar): inner and outer radius, from x0 to x1, centred (y, z)
  function ringX(x0, x1, rIn, rOut, y, z, mat, o = {}) {
    const pts = [new THREE.Vector2(rIn, x0), new THREE.Vector2(rOut, x0), new THREE.Vector2(rOut, x1), new THREE.Vector2(rIn, x1), new THREE.Vector2(rIn, x0)];
    const g = new THREE.LatheGeometry(pts, o.seg ?? 48); g.rotateZ(-Math.PI / 2); // lathe axis y -> x
    return mesh(g, mat, 0, y, z, O({ dirt: 0, ...o }));
  }
  // a ring round a vertical axis (a lift-fan duct), base at y
  function ringY(x, y, z, rIn, rOut, h, mat, o = {}) {
    const pts = [new THREE.Vector2(rIn, 0), new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
    return mesh(new THREE.LatheGeometry(pts, o.seg ?? 56), mat, x, y, z, O({ dirt: 0, ...o }));
  }
  // a propeller with its axis along x: hub at (x, y, z), n blades of radius r, turned to angle a0
  function prop(x, y, z, r, n, a0, blade, hub) {
    const g = new THREE.Group(); g.position.set(x, y, z); G.add(g);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Group(); b.rotation.x = a0 + (k * Math.PI * 2) / n; g.add(b);
      const geo = new THREE.BoxGeometry(0.07, r, 0.24); geo.translate(0, r / 2, 0);
      const m = mesh(geo, blade, 0, 0, 0, { parent: b, dirt: 0 }); m.rotation.y = 0.35; // blade pitch
    }
    const sp = new THREE.ConeGeometry(0.2, 0.45, 18); sp.rotateZ(Math.PI / 2); mesh(sp, hub, -0.18, 0, 0, { parent: g, dirt: 0 });
    return g;
  }
  // a fan with its axis vertical, seen from above: hub, n blades, under a duct
  function fanY(x, y, z, r, n, a0, blade, hub) {
    const g = new THREE.Group(); g.position.set(x, y, z); G.add(g);
    for (let k = 0; k < n; k++) {
      const geo = new THREE.BoxGeometry(r, 0.05, 0.42); geo.translate(r / 2, 0, 0);
      const m = mesh(geo, blade, 0, 0, 0, { parent: g, dirt: 0 }); m.rotation.y = a0 + (k * Math.PI * 2) / n; m.rotation.x = 0.4;
    }
    L.cyl(r * 0.24, 0.3, hub, 0, -0.12, 0, { parent: g, seg: 24, dirt: 0 });
    L.cyl(r * 0.12, 0.1, hub, 0, 0.18, 0, { parent: g, seg: 16, dirt: 0, rTop: r * 0.05 });
    return g;
  }
  // a cargo container: ribbed walls, a darker frame and corner castings, lashing straps over the top; base at y
  function container(x, y, z, l, w, h, hex, o = {}) {
    const rib = M.ribbed(hex, { period: 18 }), frame = M.plain(new THREE.Color(hex).multiplyScalar(0.55).getStyle(), 0.7, 0.3);
    L.box(l, h, w, rib, x, y, z, O({ dirt: 0.3, dirtH: h }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.box(0.12, h + 0.02, 0.12, frame, x + sx * (l / 2 - 0.05), y, z + sz * (w / 2 - 0.05), O({ dirt: 0 }));
    for (const sz of [-1, 1]) L.box(l, 0.06, 0.08, frame, x, y + h - 0.04, z + sz * (w / 2 - 0.03), O({ dirt: 0, cast: false }));
    for (const sx of [-1, 1]) L.box(0.08, 0.06, w, frame, x + sx * (l / 2 - 0.03), y + h - 0.04, z, O({ dirt: 0, cast: false }));
    if (o.straps !== false) for (const f of [-0.25, 0.25]) L.box(0.07, 0.02, w + 0.04, M.plain('#2a2620', 0.8), x + f * l, y + h, z, O({ dirt: 0, cast: false }));
  }
  return { O, hull, facet, oct, plate, fin, inset, strip, beam, ringX, ringY, prop, fanY, container };
}

// ---------------------------------------------------------------------------------------------- the three ships
export function buildAirship(L, v, G) {
  const K = airKit(L, G);
  if (v === 'b') return twinHull(L, K);
  if (v === 'c') return armoured(L, K);
  return rigid(L, K);
}

function mats(L) {
  const { M, THREE, TEAM } = L;
  return {
    gun: M.paint('#50565c'), gunD: M.paint('#3f4449', { rivets: false }), seam: M.plain('#17191b', 0.8),
    steel: M.plain('#626970', 0.3, 0.85), rail: M.plain('#23272b', 0.4, 0.7), black: M.plain('#0a0b0c', 0.85),
    team: M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.6).getHexString(), { rivets: false }),
    glow: M.emit(TEAM, 1.3), glowHi: M.emit(TEAM, 2.2), warm: M.emit('#ffd29a', 1.35), mull: M.plain('#1b1d20', 0.6, 0.3),
    red: M.emit('#ff3a2a', 3.4), green: M.emit('#3aff6a', 3.4), white: M.emit('#ffffff', 3.2), amber: M.emit('#ffb347', 2.6),
    blade: M.plain('#2a2d31', 0.5, 0.6), hub: M.plain('#7b8288', 0.3, 0.8),
    girder: M.plain('#4d4a44', 0.8), frame: M.plain('#6c685f', 0.8),
  };
}

// a: the rigid freighter
function rigid(L, K) {
  const { M } = L, C = mats(L);
  const skin = M.paint('#a7a296', { panelW: 512, panelH: 256, rivets: false });
  const H = K.hull([[-12.45, 0], [-12.1, 0.5], [-11.2, 1.2], [-9.7, 1.95], [-7.8, 2.55], [-5.2, 2.98], [-1.5, 3.15], [2.5, 3.15], [5.8, 3.0],
    [8.2, 2.7], [10.0, 2.18], [11.25, 1.5], [12.05, 0.78], [12.4, 0]], { mat: skin, seg: 80, dirt: 0.3 });
  const PI = Math.PI;
  // the girder lines along the skin, the frames across it
  for (const ph of [0.45, 0.9, 1.35, 1.8]) for (const s of [-1, 1]) H.sleeve(-11.7, 11.75, s * ph - 0.01, s * ph + 0.01, 0.012, C.girder);
  for (let x = -9.5; x <= 10; x += 2.5) H.sleeve(x - 0.03, x + 0.03, -1.9, 1.9, 0.01, C.frame);
  // the walkway hatch line down the spine, the team glow strip along it
  H.sleeve(-8.6, 3.3, -0.05, 0.05, 0.02, C.gunD); H.sleeve(-8.2, 2.9, -0.022, 0.022, 0.035, C.glow);
  H.sleeve(6.9, 9.6, -0.05, 0.05, 0.02, C.gunD); H.sleeve(7.1, 9.4, -0.022, 0.022, 0.035, C.glow);
  // team bands round the hull, a glowing line in each
  for (const [x0, x1] of [[8.3, 9.1], [-7.4, -6.6]]) { H.sleeve(x0, x1, -PI, PI, 0.02, C.team); H.sleeve((x0 + x1) / 2 - 0.05, (x0 + x1) / 2 + 0.05, -PI, PI, 0.035, C.glow); }
  // the mooring cone at the nose: a steel cup on a collar, a light ring round it
  { const g = new L.THREE.CylinderGeometry(0.16, 0.5, 0.6, 24); g.rotateZ(-PI / 2); L.mesh(g, C.steel, 12.55, 0, 0, K.O({ dirt: 0 })); }
  K.ringX(12.15, 12.3, 0.5, 0.62, 0, 0, C.gunD); K.ringX(12.3, 12.38, 0.42, 0.56, 0, 0, C.glowHi, { cast: false });
  L.sphere(0.12, C.white, 12.86, 0, 0, K.O({ cast: false }));
  // the dorsal cab: a low armoured cab on the spine with lit roof lights, a hatch and a little railing
  { const x = 4.9, y = 2.95; L.box(2.7, 0.5, 1.3, C.gun, x, y, 0, K.O({ dirt: 0.2 })); L.box(2.8, 0.06, 1.4, C.gunD, x, y + 0.5, 0, K.O({ dirt: 0 }));
    for (const dx of [-0.9, -0.3, 0.3, 0.9]) for (const s of [-1, 1]) L.box(0.4, 0.03, 0.22, C.warm, x + dx, y + 0.56, s * 0.35, K.O({ dirt: 0, cast: false }));
    L.box(0.8, 0.04, 0.05, C.glow, x - 0.9, y + 0.56, 0, K.O({ dirt: 0, cast: false })); L.box(0.08, 0.08, 0.6, C.glow, x + 1.37, y + 0.2, 0, K.O({ dirt: 0, cast: false })); }
  // the pannier racks: three containers a side hung on the flanks in a steel frame
  const CON = [['#7d4b36', '#94763d', '#4f5f66'], ['#5e6b4c', '#7d4b36', '#94763d']];
  for (const s of [-1, 1]) {
    const z = s * 3.95, y = -1.3;
    L.box(8.6, 0.16, 1.5, C.gunD, 0, y - 0.16, z, K.O({ dirt: 0 }));                             // the rack's floor
    for (const x of [-4.2, -1.4, 1.4, 4.2]) { L.box(0.14, 1.25, 0.14, C.gun, x, y - 0.1, s * 4.68, K.O({ dirt: 0 }));      // posts
      K.beam(H.surf(x, s * 1.75, -0.05), [x, y - 0.1, s * 3.25], 0.14, 0.14, C.gun); K.beam(H.surf(x, s * 1.35, -0.05), [x, y + 1.1, s * 4.68], 0.1, 0.1, C.gunD); }
    L.box(8.6, 0.1, 0.1, C.gun, 0, y + 1.1, s * 4.68, K.O({ dirt: 0 }));                         // the outer top rail
    L.box(8.5, 0.05, 0.06, C.glow, 0, y + 1.2, s * 4.7, K.O({ dirt: 0, cast: false }));          // its team light
    [-2.75, 0, 2.75].forEach((x, k) => K.container(x, y, z, 2.55, 1.3, 1.1, CON[s > 0 ? 1 : 0][k]));
  }
  // engine cars on outriggers, pusher props behind
  for (const [xc, zo, yo] of [[7.4, 5.1, -0.55], [-5.4, 4.8, -0.55]]) for (const s of [-1, 1]) {
    const zc = s * zo;
    const E = K.hull([[xc - 1.5, 0], [xc - 1.25, 0.32], [xc - 0.5, 0.52], [xc + 0.6, 0.56], [xc + 1.25, 0.42], [xc + 1.55, 0]], { mat: C.gun, yc: yo, zc, seg: 32, n: 30, dirt: 0.4 });
    E.sleeve(xc + 0.75, xc + 0.95, -PI, PI, 0.02, C.glowHi);
    L.box(0.6, 0.05, 0.24, C.warm, xc + 0.15, yo + 0.53, zc, K.O({ dirt: 0, cast: false }));     // a lit skylight in the car
    L.cyl(0.07, 0.3, C.rail, xc - 0.6, yo + 0.4, zc + s * 0.18, K.O({ seg: 10, dirt: 0 }));        // exhaust stack
    K.prop(xc - 1.62, yo, zc, 1.25, 3, s * 0.5, C.blade, C.hub);
    const r0 = H.surf(xc + 0.4, s * 1.55, -0.05), r1 = H.surf(xc - 0.6, s * 1.55, -0.05);
    K.beam(r0, [xc + 0.4, yo + 0.25, zc - s * 0.3], 0.16, 0.12, C.gunD); K.beam(r1, [xc - 0.6, yo + 0.25, zc - s * 0.3], 0.16, 0.12, C.gunD);
    K.beam(H.surf(xc - 0.1, s * 2.1, -0.05), [xc - 0.1, yo - 0.3, zc - s * 0.35], 0.08, 0.08, C.gun);
  }
  // the crew car slung under the nose (seen from the side only): windows round it
  { const E = K.hull([[3.2, 0], [3.5, 0.55], [4.6, 0.8], [7.6, 0.8], [8.6, 0.6], [9.1, 0]], { mat: C.gun, yc: -3.45, ky: 0.9, kz: 1.1, seg: 40, n: 40 });
    E.sleeve(4.3, 8.2, 1.25, 1.75, 0.02, C.warm); E.sleeve(4.3, 8.2, -1.75, -1.25, 0.02, C.warm); E.sleeve(8.2, 8.75, -1.1, 1.1, 0.02, C.warm);
    for (const x of [4.6, 7.5]) K.beam([x, -3.0, 0], H.surf(x, PI, -0.2), 0.14, 0.14, C.gunD); }
  // the cruciform tail: horizontal fins with elevators, top and bottom fins
  for (const s of [-1, 1]) {
    K.plate([[-6.9, s * 2.6], [-10.7, s * 4.75], [-12.05, s * 4.75], [-12.35, s * 0.35]], 0.09, 0.18, C.gun, { bevel: 0.04 });
    K.plate([[-11.15, s * 1.25], [-11.15, s * 4.6], [-12.0, s * 4.6], [-12.25, s * 1.25]], 0.12, 0.04, C.gunD, { bevel: 0.01 }); // elevator
    K.strip(-11.1, s * 1.35, -11.1, s * 4.55, 0.14, 0.12, 0.02, M.hazard);                          // hazard stripes on its hinge line
    K.strip(-7.2, s * 2.8, -10.6, s * 4.67, 0.09, 0.092, 0.02, C.glow);                             // the leading edge glows
    L.sphere(0.15, s < 0 ? C.red : C.green, -11.4, 0.12, s * 4.82, K.O({ cast: false }));
  }
  for (const sy of [1, -1]) {
    const pts = [[-7.2, sy * 2.2], [-10.2, sy * 5.0], [-12.0, sy * 5.0], [-12.35, sy * 0.3], [-9.5, sy * 0.3]];
    K.fin(sy > 0 ? pts : pts.slice().reverse(), 0, 0.2, C.gun);
    if (sy > 0) { K.strip(-10.25, 0, -11.95, 0, 0.1, 4.98, 0.06, C.glow); L.sphere(0.13, C.white, -12.0, 5.05, 0, K.O({ cast: false })); }
  }
  L.sphere(0.14, C.white, -12.48, 0, 0, K.O({ cast: false }));                                   // tail light
  L.sphere(0.16, C.red, 1.2, 3.18, 0, K.O({ cast: false }));                                     // anti-collision beacon
  return { len: 25.4, dock: DOCK.a, shadowR: 3.15 };
}

// b: the twin-hull lifter
function twinHull(L, K) {
  const { M } = L, C = mats(L), PI = Math.PI;
  const skin = M.paint('#6c7176', { panelW: 512, panelH: 256, rivets: false });
  const ZH = 4.35, hulls = [];
  for (const s of [-1, 1]) {
    const H = K.hull([[-11.4, 0], [-11.0, 0.5], [-9.8, 1.15], [-7.6, 1.8], [-4.5, 2.15], [1, 2.25], [6, 2.12], [8.6, 1.8], [10.3, 1.25], [11.3, 0.62], [11.75, 0]],
      { mat: skin, zc: s * ZH, seg: 64, dirt: 0.35 });
    hulls.push(H);
    for (const ph of [0.55, 1.15]) for (const t of [-1, 1]) H.sleeve(-10.6, 11.0, t * ph - 0.012, t * ph + 0.012, 0.012, C.girder);
    for (let x = -8; x <= 9; x += 2.4) H.sleeve(x - 0.025, x + 0.025, -1.4, 1.4, 0.01, C.frame);
    H.sleeve(-7.5, 7.5, -0.06, 0.06, 0.02, C.gunD); H.sleeve(-7.2, 7.2, -0.025, 0.025, 0.035, C.glow);       // spine strip
    H.sleeve(8.7, 9.4, -PI, PI, 0.02, C.team); H.sleeve(9.0, 9.1, -PI, PI, 0.035, C.glow);                   // nose band
    H.sleeve(-6.4, -5.8, -PI, PI, 0.02, C.team);
    // the ducted pusher round the tail: a duct on four stators, the fan inside, a glowing lip
    K.ringX(-12.1, -10.6, 1.25, 1.5, 0, s * ZH, C.gun, { seg: 56 });
    K.ringX(-12.2, -12.05, 1.22, 1.55, 0, s * ZH, C.glowHi, { cast: false, seg: 56 });
    for (let k = 0; k < 4; k++) { const a = (k * PI) / 2 + PI / 4; K.beam([-11.2, Math.cos(a) * 0.4, s * ZH + Math.sin(a) * 0.4], [-11.2, Math.cos(a) * 1.3, s * ZH + Math.sin(a) * 1.3], 0.1, 0.1, C.gunD); }
    K.prop(-11.55, 0, s * ZH, 1.15, 5, 0.3, C.blade, C.hub);
    // a fin on each hull's back
    K.fin([[-6.6, 1.9], [-9.4, 4.1], [-10.9, 4.1], [-11.1, 0.4], [-8.5, 0.4]], s * ZH, 0.18, C.gun);
    K.strip(-9.45, s * ZH, -10.85, s * ZH, 0.1, 4.08, 0.06, C.glow);
  }
  // the tail stabiliser across both hulls, its elevator and tips
  K.plate([[-7.8, 7.2], [-9.0, 8.1], [-10.15, 8.1], [-10.15, -8.1], [-9.0, -8.1], [-7.8, -7.2]], 0.4, 0.18, C.gun, { bevel: 0.04 });
  K.plate([[-9.45, 7.6], [-10.1, 7.6], [-10.1, -7.6], [-9.45, -7.6]], 0.43, 0.04, C.gunD, { bevel: 0.01 });
  for (const s of [-1, 1]) { K.strip(-7.85, s * 7.25, -8.95, s * 8.05, 0.09, 0.41, 0.02, C.glow); L.sphere(0.15, s < 0 ? C.red : C.green, -9.6, 0.42, s * 8.15, K.O({ cast: false })); }
  // the truss deck between the hulls: crossbeams through both hulls, longitudinal girders, a grating floor
  const DY = -0.95;
  L.box(14.6, 0.12, 4.6, M.grating, 0.4, DY, 0, K.O({ dirt: 0 }));
  for (let x = -6.9; x <= 7.7; x += 1.825) L.box(0.22, 0.32, 8.7, C.gunD, x, DY - 0.2, 0, K.O({ dirt: 0 }));
  for (const z of [-2.35, 2.35]) { L.box(14.8, 0.38, 0.22, C.gun, 0.4, DY - 0.18, z, K.O({ dirt: 0 })); L.box(14.6, 0.05, 0.06, C.glow, 0.4, DY + 0.2, z, K.O({ dirt: 0, cast: false })); }
  for (let x = -6.9; x < 7; x += 3.65) for (const s of [-1, 1]) K.beam([x, DY + 0.1, s * 2.35], [x + 1.82, DY - 0.15, s * 3.2], 0.1, 0.1, C.gun);
  // eight containers in two rows: the load, in plain view
  const CON = ['#7d4b36', '#94763d', '#4f5f66', '#5e6b4c', '#94763d', '#6b3b30', '#4f5f66', '#7d4b36'];
  [-5.35, -1.85, 1.65, 5.15].forEach((x, i) => { for (const [k, z] of [[0, -1.12], [1, 1.12]]) K.container(x, DY + 0.12, z, 3.3, 2.05, 1.45, CON[i * 2 + k]); });
  // the bridge cab at the front of the deck: lit windscreen and roof lights, a team strip round the roof
  { const x0 = 7.2, x1 = 10.2, y0 = DY - 0.3, h = 1.55, w = 1.85;
    L.box(x1 - x0 - 0.6, h, w * 2, C.gun, (x0 + x1 - 0.6) / 2, y0, 0, K.O({ dirt: 0.3 }));
    const g = new L.THREE.Shape(); g.moveTo(x1 - 0.6, y0); g.lineTo(x1, y0 + 0.5); g.lineTo(x1 - 0.45, y0 + h); g.lineTo(x1 - 0.6, y0 + h); g.closePath();
    const eg = new L.THREE.ExtrudeGeometry(g, { depth: w * 2, bevelEnabled: false }); eg.translate(0, 0, -w);
    L.mesh(eg, C.gunD, 0, 0, 0, K.O({ dirt: 0 }));
    const wg = new L.THREE.BoxGeometry(0.04, 0.55, w * 2 - 0.3); const wm = L.mesh(wg, M.emit('#ffd29a', 0.8), x1 - 0.2, y0 + 1.0, 0, K.O({ dirt: 0, cast: false })); wm.rotation.z = 0.89;
    L.box(x1 - x0 - 0.5, 0.08, w * 2 + 0.1, C.gunD, (x0 + x1 - 0.6) / 2, y0 + h, 0, K.O({ dirt: 0 }));
    for (const dx of [-0.55, 0.25]) for (const s of [-1, 1]) L.box(0.34, 0.03, 0.36, C.warm, x0 + 1.3 + dx, y0 + h + 0.08, s * 0.8, K.O({ dirt: 0, cast: false }));
    for (const s of [-1, 1]) L.box(x1 - x0 - 0.7, 0.05, 0.06, C.glow, (x0 + x1 - 0.6) / 2, y0 + h + 0.1, s * (w + 0.02), K.O({ dirt: 0, cast: false }));
    L.sphere(0.15, C.red, x0 + 0.3, y0 + h + 0.2, 0, K.O({ cast: false })); }
  // the docking frame: struts from both hull noses and the cab to one mooring cone ahead
  const tip = [13.4, 0.15, 0];
  for (const s of [-1, 1]) { K.beam(hulls[s > 0 ? 1 : 0].surf(10.6, -s * 1.2, -0.1), tip, 0.2, 0.2, C.gun); K.beam([10.0, 0.8, s * 1.0], tip, 0.14, 0.14, C.gunD); }
  K.beam([10.2, -0.9, 0], tip, 0.18, 0.18, C.gun);
  { const g = new L.THREE.CylinderGeometry(0.16, 0.48, 0.65, 24); g.rotateZ(-PI / 2); L.mesh(g, C.steel, 13.75, 0.15, 0, K.O({ dirt: 0 })); }
  K.ringX(13.3, 13.45, 0.45, 0.58, 0.15, 0, C.glowHi, { cast: false });
  L.sphere(0.12, C.white, 14.1, 0.15, 0, K.O({ cast: false }));
  for (const s of [-1, 1]) L.sphere(0.13, C.white, -11.6, 1.2, s * ZH, K.O({ cast: false }));
  return { len: 25.5, dock: DOCK.b, shadowR: 2.25 };
}

// c: the armoured blimp
function armoured(L, K) {
  const { M, THREE } = L, C = mats(L), PI = Math.PI;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false }), plateL = M.paint('#666e77', { rivets: false });
  const hood = M.plain('#121518', 0.3, 0.6), hoodE = M.plain('#2b3136', 0.35, 0.6);
  const lens = (() => { const m = M.emit(L.TEAM, 1.3).clone(); m.color = new THREE.Color(L.TEAM).multiplyScalar(0.12); m.roughness = 0.7; m.envMapIntensity = 0.1; m.userData.glow = '#' + new THREE.Color(L.TEAM).multiplyScalar(0.32).getHexString(); return m; })();
  // the envelope: few, wide, flattened octagonal sections, so its plan is angular; an armoured hood at the nose
  const prof = [[11.0, 0.5, 0.35], [10.2, 2.4, 1.45], [8.4, 4.1, 2.2], [5.8, 4.8, 2.5], [-3.0, 4.8, 2.5], [-6.6, 4.3, 2.25], [-9.2, 2.9, 1.5], [-10.6, 1.4, 0.75], [-11.0, 0.5, 0.35]];
  const T0 = 0.55, M0 = 0.32;
  const sec = ([x, w, h]) => ({ x, w, h, b: h * 0.88, t: w * T0, m: M0, bt: w * 0.55, y: 0 });
  const S = prof.map(sec);
  const wAt = (x) => { for (let i = 0; i < prof.length - 1; i++) { const [xa, wa, ha] = prof[i], [xb, wb, hb] = prof[i + 1]; if (x <= xa && x >= xb) { const t = (xa - x) / (xa - xb); return [wa + (wb - wa) * t, ha + (hb - ha) * t]; } } return [0.3, 0.3]; };
  K.facet(S.slice(0, 3), [hood, hoodE, top], { capBack: false });
  K.facet(S.slice(2), [roof, top, armor], { capFront: false });
  // the visor across the hood, and a slim band of lit bridge windows behind it
  { const sh = new THREE.Shape(); [[0.2, 0], [-0.1, 0.7], [-0.26, 0.7], [0.05, 0.03], [0.05, -0.03], [-0.26, -0.7], [-0.1, -0.7]].forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); g.rotateX(PI / 2);
    const m = K.O().parent; const mm = L.mesh(g, lens, 9.75, 1.86, 0, { parent: m, dirt: 0, cast: false }); mm.rotation.z = -Math.atan2(2.2 - 1.45, 1.8); }
  for (const z of [-1.2, -0.4, 0.4, 1.2]) L.box(0.24, 0.04, 0.62, C.warm, 8.15, 2.2, z, K.O({ dirt: 0, cast: false }));
  // the docking probe on the nose: an armoured cone, a lit collar
  { const g = new THREE.CylinderGeometry(0.14, 0.42, 0.65, 8); g.rotateZ(-PI / 2); L.mesh(g, C.steel, 11.25, 0, 0, K.O({ dirt: 0 })); }
  K.ringX(10.9, 11.0, 0.36, 0.52, 0, 0, C.glowHi, { cast: false, seg: 8 });
  L.sphere(0.1, C.white, 11.6, 0, 0, K.O({ cast: false }));
  const tH = (x) => wAt(x)[1];
  // armour plates on the top facet: two columns either side of a spine gap, bevelled, the lighter ones alternating
  [[8.0, 5.7], [5.5, 2.7], [2.5, -0.3], [-0.5, -3.1], [-3.3, -6.0], [-6.2, -8.4]].forEach(([x0, x1], k) => {
    for (const sg of [-1, 1]) {
      const w0 = wAt(x0)[0] * T0 - 0.12, w1 = wAt(x1)[0] * T0 - 0.12;
      K.plate([[x0, sg * 0.2], [x0, sg * w0], [x1, sg * w1], [x1, sg * 0.2]], Math.max(tH(x0), tH(x1)) + 0.03, 0.06, (k + (sg > 0 ? 1 : 0)) % 2 ? plateL : roof, { bevel: 0.02 });
    }
  });
  // the crease between the top and the chamfers, in a dark seam; the team glow strips along the lower creases
  for (const sg of [-1, 1]) {
    for (let i = 2; i < prof.length - 2; i++) { const [xa, wa, ha] = prof[i], [xb, wb, hb] = prof[i + 1];
      K.beam([xa, ha + 0.005, sg * wa * T0], [xb, hb + 0.005, sg * wb * T0], 0.06, 0.03, C.seam, { cast: false }); }
    for (let i = 2; i < prof.length - 3; i++) { const [xa, wa, ha] = prof[i], [xb, wb, hb] = prof[i + 1];
      K.beam([xa, M0 * ha - 0.02, sg * (wa + 0.012)], [xb, M0 * hb - 0.02, sg * (wb + 0.012)], 0.09, 0.09, C.glow, { cast: false }); }
  }
  // the spine: a dorsal fairing with the beacon, a sensor dome and a glow strip, hatches either side
  K.facet([[4.4, 0.2, 0.05], [3.8, 0.55, 0.3], [-4.6, 0.55, 0.3], [-5.3, 0.2, 0.06]].map(([x, w, h]) => ({ x, w, h, b: 0.05, t: w * 0.6, m: 0.3, y: 2.56 })), [top, armor, armor]);
  L.sphere(0.16, C.red, -2.4, 2.9, 0, K.O({ cast: false }));
  L.sphere(0.3, M.plain('#2b3136', 0.4, 0.5), 2.6, 2.86, 0, K.O({ dirt: 0 })); L.sphere(0.08, lens, 2.75, 3.13, 0, K.O({ cast: false }));
  K.strip(-1.8, 0, 1.9, 0, 0.1, 2.89, 0.02, C.glow);
  for (const [x, z] of [[4.1, 1.7], [-1.6, -1.8], [-4.5, 1.6]]) { K.plate([[x + 0.35, z - 0.3], [x + 0.35, z + 0.3], [x - 0.35, z + 0.3], [x - 0.35, z - 0.3]], 2.62, 0.04, top, { bevel: 0.012 });
    K.strip(x + 0.36, z, x - 0.36, z, 0.025, 2.625, 0.006, C.seam); }
  for (let k = 0; k < 4; k++) K.strip(6.6 - k * 0.22, -0.9, 6.6 - k * 0.22, -0.3, 0.08, 2.55, 0.012, C.black);
  // four big ducted lift fans at the corners, on armoured pylons; a thin team ring on each lip
  for (const fx of [5.2, -5.4]) for (const s of [-1, 1]) {
    const fz = s * 7.2, fy = -0.6;
    K.ringY(fx, fy, fz, 1.55, 1.98, 1.0, top, { seg: 8 });                                          // an octagonal armoured duct
    K.ringY(fx, fy + 1.0, fz, 1.62, 1.72, 0.04, C.glow, { cast: false, seg: 48 });
    K.ringY(fx, fy + 0.35, fz, 1.5, 1.56, 0.3, C.black, { seg: 48, cast: false });
    for (let k = 0; k < 3; k++) { const a = (k * 2 * PI) / 3 + 0.3; K.beam([fx + Math.cos(a) * 0.3, fy + 0.55, fz + Math.sin(a) * 0.3], [fx + Math.cos(a) * 1.55, fy + 0.55, fz + Math.sin(a) * 1.55], 0.14, 0.08, C.gunD); }
    K.fanY(fx, fy + 0.35, fz, 1.5, 7, s * 0.3, C.blade, C.hub);
    const w = wAt(fx)[0];
    K.facet([{ x: fx + 0.75, y: 0, z: s * (w + 0.8) }, { x: fx - 0.75, y: 0, z: s * (w + 0.8) }].map((q) => ({ ...q, w: 0.9, h: 0.4, b: 0.35, t: 0.5, m: 0.4, bt: 0.4 })), [top, armor, armor]);
    K.beam([fx, 0.05, s * (w - 0.3)], [fx, 0.05, s * (fz / s - 1.6)], 1.2, 0.5, armor);
    L.sphere(0.15, s < 0 ? C.red : C.green, fx, fy + 1.05, s * 9.22, K.O({ cast: false }));
  }
  // the V-tail: two canted fins at the stern, their tips glowing
  for (const s of [-1, 1]) {
    const g = new THREE.Group(); g.position.set(0, 1.0, s * 0.9); g.rotation.x = -s * 0.7; K.O().parent.add(g);
    const sh = new THREE.Shape(); [[-5.6, 0], [-9.4, 3.7], [-11.3, 3.7], [-11.6, 0]].forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); sh.closePath();
    const eg = new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 }); eg.translate(0, 0, -0.12);
    L.mesh(eg, top, 0, 0, 0, { parent: g, dirt: 0 });
    L.box(1.85, 0.08, 0.28, C.glow, -10.35, 3.66, 0, { parent: g, dirt: 0, cast: false });
    L.beam([-5.9, 0.3, 0.13], [-9.3, 3.62, 0.13], 0.06, 0.04, C.glow, { parent: g, cast: false });
  }
  L.sphere(0.14, C.white, -11.05, 0.1, 0, K.O({ cast: false }));
  // the cargo pod clamped under the belly (seen from the side only), its clamps and a team strip
  K.facet([[5.4, 0.3, 0.3], [4.6, 2.0, 1.0], [-4.4, 2.0, 1.0], [-5.0, 1.4, 0.7]].map(([x, w, h]) => ({ x, w, h, b: h, t: w * 0.7, m: 0.5, bt: w * 0.7, y: -3.3 })), [top, armor, armor]);
  for (const x of [3.2, -2.8]) for (const s of [-1, 1]) K.beam([x, -2.2, s * 1.5], [x, -1.6, s * 2.0], 0.25, 0.25, C.gunD);
  for (const s of [-1, 1]) L.box(8.4, 0.05, 0.05, C.glow, -0.1, -2.85, s * 2.02, K.O({ dirt: 0, cast: false }));
  return { len: 22, dock: DOCK.c, shadowR: 4.8 };
}

// --------------------------------------------------------------------------------------- the top-down sprite scene
export default function (L) {
  const { THREE } = L;
  const p = new URLSearchParams(location.search), v = p.get('v') || 'a';
  L.seed(4040 + v.charCodeAt(0));
  kit(L, 0, 0);   // the robots' and the Cargo Plane's top-down lighting
  const W = +(p.get('w') || 30), cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  // the ship is longer than the shared sun's shadow box: widen it
  L.getScene().traverse((o) => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -18; c.right = c.top = 18; c.updateProjectionMatrix(); } });
  const G = L.group();
  buildAirship(L, v, G);
  // centre the ship in the frame (the game draws the sprite centred on the unit), and mark its mooring cone's tip
  const bb = new THREE.Box3().setFromObject(G), cx = (bb.min.x + bb.max.x) / 2;
  G.position.x = -cx;
  L.mark('dock', DOCK[v][0] - cx, DOCK[v][1], DOCK[v][2]);
  // looking straight down the studio environment reflects off every top: keep reflections low (as plane.js)
  const seen = new Set();
  L.getRoot().traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (!seen.has(m) && m.envMapIntensity !== undefined) { seen.add(m); m.envMapIntensity *= m.emissiveIntensity > 0 ? 1 : 0.35; } });
}
