// Strike Bomber, Lancer style (proposal): the Foxbat planform of bomber.js re-skinned in the Lancer robot-tank's
// language. Top-down, facing +x, orthographic camera straight down, no ground; 20 world units across the frame, the
// same planform, size and placement as bomber.js so it drops in. Dark gunmetal armour built up from faceted,
// bevelled plates with thin dark seams: a long slab-sided body with a raised spine, huge angular box intakes,
// shoulder wings swept 43 degrees, twin canted fins and twin big nozzles. The canopy is an armoured hood with a
// glowing sensor slit. Team colour glows: strips along the wing leading edges and down the spine, the fin caps, the
// rings round each nozzle and the bands on the bombs. Navigation lights on the tip pods and the tail.
import { kit } from './robkit.js';
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, mesh, sphere, M, THREE, TEAM } = L;
  L.seed(3131);
  const R = kit(L, 0, 0);   // the Lancer's lighting (a toned-down overhead sun) and its sensor-lens material
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  // ---- materials: the Lancer's gunmetal shades, seams, steel and team glow
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false }), under = M.paint('#262a2e');
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), seam = M.plain('#101214', 0.8);
  const steel = M.plain('#626970', 0.3, 0.85), rail = M.plain('#23272b', 0.4, 0.7), hood = M.plain('#121518', 0.3, 0.6);
  const glow = M.emit(TEAM, 1.1), lens = R.eye(TEAM, 1.3, 0.32);
  const Y0 = 1.0, UV = 0.5; // one paint panel per world unit

  // ---- helpers
  // a faceted body lofted through octagonal sections, flat-shaded. A section: x, w (half-width), h (top above y),
  // b (bottom below y), t (half-width of the top facet), m (where the upper chamfer meets the side, fraction of h),
  // y, z. The top facet takes mats[0], the upper chamfers mats[1], the rest mats[2].
  function facet(st, mats, o = {}) {
    const ring = (s) => { const y = s.y ?? Y0, z = s.z ?? 0, w = s.w, h = s.h, b = s.b ?? h, t = s.t ?? w * 0.55, m = (s.m ?? 0.35) * h, bt = s.bt ?? w * 0.6, mb = -0.3 * b;
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
    const cap = (i, back) => { const s = st[i], c = [s.x, s.y ?? Y0, s.z ?? 0];
      for (let j = 0; j < 8; j++) { const p = V(i, j), q = V(i, j + 1); if (back) P[2].push(...c, ...p, ...q); else P[2].push(...c, ...q, ...p);
        for (const v of back ? [c, p, q] : [c, q, p]) U[2].push(v[2] * UV, v[1] * UV); } };
    if (o.capFront !== false) cap(0, false);
    if (o.capBack !== false) cap(st.length - 1, true);
    const g = new THREE.BufferGeometry(), pos = [], uv = [];
    let start = 0;
    for (let k = 0; k < 3; k++) { pos.push(...P[k]); uv.push(...U[k]); const n = P[k].length / 3; if (n) g.addGroup(start, n, k); start += n; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return mesh(g, [mats[0], mats[1] ?? mats[0], mats[2] ?? mats[1] ?? mats[0]], 0, 0, 0, { dirt: 0, ...o });
  }
  // a flat plate from a plan outline [x, z], its top at y, bevelled
  function plate(pts, y, thick, mat, o = {}) {
    const bev = Math.min(o.bevel ?? 0.03, thick / 3), sh = new THREE.Shape();
    pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(0.002, thick - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); g.translate(0, -bev, 0);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UV, uv.getY(i) * UV);
    return mesh(g, mat, 0, y, 0, { dirt: 0, ...o });
  }
  // a convex outline moved inward by d (one distance, or one per edge)
  function inset(pts, d) {
    const n = pts.length, ar = pts.reduce((a, p, i) => { const q = pts[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0), sg = Math.sign(ar);
    const lines = pts.map((p, i) => { const q = pts[(i + 1) % n], dx = q[0] - p[0], dz = q[1] - p[1], l = Math.hypot(dx, dz), nx = -dz / l * sg, nz = dx / l * sg, dd = Array.isArray(d) ? d[i] : d;
      return [p[0] + nx * dd, p[1] + nz * dd, dx, dz]; });
    return lines.map((A, i) => { const B = lines[(i + n - 1) % n], den = A[2] * B[3] - A[3] * B[2], t = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / den; return [A[0] + A[2] * t, A[1] + A[3] * t]; });
  }
  // a thin strip on top of a surface, from (x1, z1) to (x2, z2)
  const strip = (x1, z1, x2, z2, w, y, h, mat, o = {}) => { const dx = x2 - x1, dz = z2 - z1;
    return box(Math.hypot(dx, dz), h, w, mat, (x1 + x2) / 2, y, (z1 + z2) / 2, { ry: -Math.atan2(dz, dx), dirt: 0, cast: false, ...o }); };
  // a band round a horizontal (x-axis) octagonal body: a short octagonal section, slightly proud
  const band = (x, len, r, y, z, mat) => facet([{ x: x + len / 2, w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41, y, z }, { x: x - len / 2, w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41, y, z }], [mat, mat, mat], { cast: false });
  const oct = (r) => ({ w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41 }); // a regular octagon section
  // grime: rust-brown blotches and specks on a transparent decal cut to a plan outline, laid just over a surface
  function grime(pts, y, amt = 1, seed = 1) {
    const t = L.canvasTex(256, (g, n) => {
      let sd = seed * 9301 + 49297; const r = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
      for (let i = 0; i < 26 * amt; i++) { const cx = r() * n, cy = r() * n, rr = 8 + r() * 30;
        const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rr); const c = r() < 0.5 ? '122,84,50' : '70,52,36';
        gr.addColorStop(0, `rgba(${c},${0.12 + r() * 0.18})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2); }
      for (let i = 0; i < 900 * amt; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,18,16' : '150,120,90'},${r() * 0.35})`; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); }
    });
    const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, -z) : sh.moveTo(x, -z))); sh.closePath();
    const geo = new THREE.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 5, uv.getY(i) / 5);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.9, depthWrite: false }));
    m.position.y = y; m.userData.decal = true; m.receiveShadow = true; L.getRoot().add(m); return m;
  }

  // ---- the nose: a long, dark faceted radome on a slim forward body that runs back as the raised spine
  const R0 = [[8.96, 0.02], [8.75, 0.12], [8.35, 0.23], [7.75, 0.33], [7.0, 0.41], [6.16, 0.47]];
  facet(R0.map(([x, w]) => ({ x, ...oct(w), y: Y0 + 0.02 })), [rail, dark, dark], { capBack: false });
  band(6.13, 0.06, 0.48, Y0 + 0.02, 0, seam);
  L.hcyl(0.03, 0.75, steel, 9.3, Y0 + 0.02, 0, { seg: 8, dirt: 0, cast: false }); // the nose probe
  const F0 = [[6.16, 0.47, 0.47, 0.02], [5.4, 0.53, 0.53, 0.03], [4.4, 0.56, 0.56, 0.04], [3.4, 0.55, 0.6, 0.04], [2.6, 0.48, 0.68, 0.02],
    [1.6, 0.4, 0.72, 0], [0.6, 0.36, 0.71, 0], [-1.5, 0.34, 0.7, 0], [-4.5, 0.32, 0.68, 0], [-6.5, 0.3, 0.6, 0], [-8.2, 0.24, 0.42, 0], [-8.7, 0.16, 0.26, 0]];
  facet(F0.map(([x, w, h, dy]) => ({ x, w, h, b: h, t: w * 0.5, m: 0.45, y: Y0 + dy })), [roof, top, armor]);
  // the spine's top along its length, for the seams and the glow strip laid on it
  const spineY = (x) => { for (let i = 0; i < F0.length - 1; i++) { const [xa, , ha, da] = F0[i], [xb, , hb, db] = F0[i + 1];
    if (x <= xa && x >= xb) { const t = (xa - x) / (xa - xb); return Y0 + da + ha + t * (db + hb - da - ha); } } return Y0 + 0.5; };
  const spineW = (x) => { for (let i = 0; i < F0.length - 1; i++) { const [xa, wa] = F0[i], [xb, wb] = F0[i + 1]; if (x <= xa && x >= xb) return (wa + (wb - wa) * (xa - x) / (xa - xb)) * 0.5; } return 0.1; };
  for (const x of [5.3, -1.0, -3.6, -6.2]) strip(x, -spineW(x), x, spineW(x), 0.04, spineY(x) - 0.004, 0.012, seam);
  // the canopy: an armoured faceted hood, almost black, with the glowing sensor slit down its middle
  facet([[4.85, 0.03, 0.02], [4.45, 0.3, 0.2], [3.9, 0.42, 0.33], [3.2, 0.42, 0.36], [2.45, 0.34, 0.3], [1.85, 0.16, 0.18]].map(([x, w, h]) => ({ x, w, h, b: 0.05, t: w * 0.45, m: 0.5, y: Y0 + 0.47 })), [hood, M.plain('#2b3136', 0.35, 0.6), dark]);
  { const sh = new THREE.Shape(); [[4.55, 0], [4.25, 0.06], [2.55, 0.05], [2.35, 0], [2.55, -0.05], [4.25, -0.06]].forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }); g.rotateX(Math.PI / 2); mesh(g, lens, 0, Y0 + 0.86, 0, { dirt: 0, cast: false }); }
  for (const s of [-1, 1]) strip(4.15, s * 0.33, 3.0, s * 0.37, 0.04, Y0 + 0.75, 0.04, M.plain('#2b3035', 0.5, 0.5)); // hood frame rails

  // ---- the intakes: huge angular boxes either side of the nose, raked lips, opening into the broad body behind
  for (const s of [-1, 1]) {
    facet([{ x: 3.41, w: 0.5, h: 0.5, t: 0.38, m: 0.6, y: Y0 - 0.05, z: s * 0.76 }, { x: 3.36, w: 0.555, h: 0.6, t: 0.43, m: 0.6, y: Y0 - 0.05, z: s * 0.76 },
      { x: 1.2, w: 0.555, h: 0.6, t: 0.43, m: 0.6, y: Y0 - 0.05, z: s * 0.76 }], [top, armor, armor]);
    strip(3.39, s * 0.36, 3.39, s * 1.16, 0.08, Y0 + 0.55, 0.035, steel);                                    // the lip
    plate([[3.3, s * 0.36], [3.3, s * 1.17], [2.55, s * 1.17], [2.4, s * 0.36]], Y0 + 0.585, 0.03, roof);      // the ramp panel behind it
    strip(2.3, s * 0.36, 2.3, s * 1.17, 0.035, Y0 + 0.552, 0.01, seam);
    for (const x of [2.0, 1.75, 1.5]) strip(x, s * 0.5, x, s * 0.95, 0.07, Y0 + 0.552, 0.012, black);         // the bleed vents
  }
  // ---- the broad body over the engines: a wide faceted slab with raised deck plates either side of the spine
  facet([[1.42, 1.3, 0.62], [1.2, 1.44, 0.66], [-5.5, 1.44, 0.66], [-5.85, 1.3, 0.62], [-6.6, 1.22, 0.6]].map(([x, w, h]) => ({ x, w, h, t: w - 0.34, m: 0.55, y: Y0 - 0.1 })), [armor, armor, armor]);
  for (const s of [-1, 1]) {
    plate([[0.95, s * 0.42], [0.95, s * 0.98], [-1.9, s * 1.02], [-1.9, s * 0.42]], Y0 + 0.595, 0.04, roof);
    plate([[-2.1, s * 0.42], [-2.1, s * 1.02], [-5.2, s * 1.02], [-5.45, s * 0.8], [-5.45, s * 0.42]], Y0 + 0.595, 0.04, roof);
    for (let k = 0; k < 4; k++) strip(-2.6 - k * 0.42, s * 0.55, -2.6 - k * 0.42, s * 0.88, 0.06, Y0 + 0.596, 0.01, black); // cooling louvres
    strip(1.2, s * 1.12, -5.5, s * 1.12, 0.035, Y0 + 0.557, 0.01, seam);
  }
  // the engine bays: faceted nacelles, the two big nozzles behind with their glowing rings, a tail boom between them
  for (const s of [-1, 1]) {
    const z = s * 0.62, y = Y0 - 0.12;
    facet([{ x: -5.78, ...oct(0.62), y, z }, { x: -8.1, ...oct(0.62), y, z }], [top, armor, armor]);
    for (const x of [-6.35, -6.95, -7.55]) band(x, 0.04, 0.63, y, z, seam);
    facet([{ x: -8.08, ...oct(0.6), y, z }, { x: -8.56, ...oct(0.5), y, z }], [rail, rail, rail], { capBack: false });
    band(-8.24, 0.07, 0.585, y, z, glow); band(-8.42, 0.06, 0.55, y, z, glow);
    facet([{ x: -8.55, ...oct(0.42), y, z }, { x: -8.6, ...oct(0.42), y, z }], [lens, lens, lens], { cast: false });  // the hot core
  }

  // ---- the wing: thin, swept 43 degrees at the leading edge, a straight trailing edge, pods on the tips
  const RZ = 1.3, TZ = 5.68, LE = (z) => -0.48 - (Math.abs(z) - RZ) * (3.92 / 4.38), TE = (z) => -6.16 - (Math.abs(z) - RZ) * (0.08 / 4.38);
  const WY = Y0 + 0.34;
  for (const s of [-1, 1]) {
    plate([[LE(RZ), s * RZ], [LE(TZ), s * TZ], [TE(TZ), s * TZ], [TE(RZ), s * RZ]], WY, 0.12, under, { bevel: 0.04 });
    // the plating: three panels between the leading-edge band and the flaps, the flaps and the aileron behind
    const zs = [RZ, 2.8, 4.25, TZ - 0.12], fx = (z) => TE(z) + 0.78;
    for (let k = 0; k < 3; k++) {
      const z0 = zs[k] + (k ? 0.04 : 0.02), z1 = zs[k + 1] - 0.04;
      plate([[LE(z0) - 0.3, s * z0], [LE(z1) - 0.3, s * z1], [fx(z1) + 0.05, s * z1], [fx(z0) + 0.05, s * z0]], WY + 0.035, 0.035, k === 0 ? top : armor, { bevel: 0.012 });
    }
    for (const [z0, z1] of [[RZ + 0.04, 3.3], [3.38, 5.5]]) plate([[fx(z0) - 0.04, s * z0], [fx(z1) - 0.04, s * z1], [TE(z1) + 0.04, s * z1], [TE(z0) + 0.04, s * z0]], WY + 0.03, 0.03, armor, { bevel: 0.01 });
    // the leading-edge glow strip, in the dark band ahead of the plating
    strip(LE(RZ + 0.05) - 0.15, s * (RZ + 0.05), LE(TZ - 0.2) - 0.15, s * (TZ - 0.2), 0.085, WY + 0.002, 0.02, glow);
    // the tip pod: a faceted hexagonal pod, its nose a pointed cone
    facet([{ x: -2.5, ...oct(0.02), y: WY - 0.06, z: s * (TZ + 0.06) }, { x: -3.05, ...oct(0.12), y: WY - 0.06, z: s * (TZ + 0.06) },
      { x: -6.4, ...oct(0.12), y: WY - 0.06, z: s * (TZ + 0.06) }, { x: -6.6, ...oct(0.07), y: WY - 0.06, z: s * (TZ + 0.06) }], [top, armor, armor]);
    // a bomb under the wing, its nose ahead of the leading edge, a glowing band behind the fuze
    const bz = s * 2.85, bx = -1.75, by = Y0 + 0.02;
    facet([{ x: bx + 1.7, ...oct(0.02), y: by, z: bz }, { x: bx + 1.15, ...oct(0.21), y: by, z: bz }, { x: bx - 1.15, ...oct(0.21), y: by, z: bz }, { x: bx - 1.3, ...oct(0.14), y: by, z: bz }], [M.plain('#4a5056', 0.6, 0.4), M.plain('#30353a', 0.6, 0.4), dark]);
    band(bx + 0.85, 0.1, 0.22, by, bz, glow);
    // the stabilator: swept, reaching back past the nozzles, a raised panel on it
    const stab = [[-6.32, s * 1.25], [-9.12, s * 3.79], [-9.62, s * 3.4], [-8.48, s * 1.25]];
    plate(stab, Y0 + 0.08, 0.1, under, { bevel: 0.03 });
    plate(inset(stab, [0.12, 0.1, 0.25, 0.1]), Y0 + 0.105, 0.03, armor, { bevel: 0.01 });
    // the fin: tall and swept, canted out, a seam down it and its cap glowing
    const fin = new THREE.Group(); fin.position.set(0, Y0 + 0.52, s * 1.12); fin.rotation.x = s * 0.14; L.getRoot().add(fin);
    { const sh = new THREE.Shape(); sh.moveTo(-3.7, 0); sh.lineTo(-5.0, 0.42); sh.lineTo(-8.2, 2.4); sh.lineTo(-8.85, 2.4); sh.lineTo(-8.6, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelOffset: -0.02, bevelSegments: 1 }); g.translate(0, 0, -0.05);
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * UV, uv.getY(i) * UV);
      mesh(g, roof, 0, 0, 0, { dirt: 0, parent: fin }); }
    box(0.7, 0.07, 0.15, glow, -8.52, 2.36, 0, { dirt: 0, parent: fin, cast: false });
    { const a = [-5.0 - 3.2 * 0.4, 0.42 + 1.98 * 0.4], b = [-8.2, 2.4], g = new THREE.BoxGeometry(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.07, 0.14); // the leading edge glows on its upper part
      const m = mesh(g, glow, (a[0] + b[0]) / 2 + 0.02, (a[1] + b[1]) / 2 - 0.03, 0, { dirt: 0, parent: fin, cast: false }); m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]); }
  }

  // ---- grime over the body and the wings
  grime([[1.3, -1.4], [1.3, 1.4], [-5.5, 1.4], [-5.5, -1.4]], Y0 + 0.64, 0.7, 11);
  for (const s of [-1, 1]) grime([[LE(RZ), s * RZ], [LE(TZ), s * TZ], [TE(TZ), s * TZ], [TE(RZ), s * RZ]], WY + 0.075, 0.4, 5 + s);

  // ---- lights: navigation (red left, green right) on the tip pods, white on the tail boom, the beacon on the spine
  sphere(0.11, M.emit('#ff3a2a', 3.4), -2.85, WY - 0.02, -TZ - 0.06, { cast: false });
  sphere(0.11, M.emit('#3aff6a', 3.4), -2.85, WY - 0.02, TZ + 0.06, { cast: false });
  sphere(0.1, M.emit('#ffffff', 3.0), -8.78, Y0 + 0.05, 0, { cast: false });
  sphere(0.07, M.emit('#ff3a2a', 3.0), -2.3, Y0 + 0.72, 0, { cast: false });
  // the spine's glow strip, broken at the beacon
  for (const [a, b] of [[1.25, -1.9], [-2.7, -6.1]]) {
    const xs = [a, ...F0.map((r) => r[0]).filter((x) => x < a && x > b), b];
    for (let i = 0; i < xs.length - 1; i++) L.beam([xs[i], spineY(xs[i]) + 0.005, 0], [xs[i + 1], spineY(xs[i + 1]) + 0.005, 0], 0.075, 0.02, glow, { cast: false });
  }

  // looking straight down, the studio environment reflects off every flat top: keep reflections low (as the robots do)
  const seen = new Set();
  L.getRoot().traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (!seen.has(m) && m.envMapIntensity !== undefined) { seen.add(m); m.envMapIntensity *= m.emissiveIntensity > 0 ? 1 : 0.35; } });
}
