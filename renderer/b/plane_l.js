// Cargo Plane, Lancer style (proposal): the four-engined C-17-style transport of plane.js re-skinned in the Lancer
// robot-tank's language. Top-down, facing +x, orthographic camera straight down, no ground; 20 world units across the
// frame, the same planform, size and placement as plane.js so it drops in. A long, wide, faceted (octagonal) fuselage
// with an armoured flight-deck hood and a glowing sensor-slit visor, gear sponsons along its belly, a high wing swept
// back about 25 degrees with upturned winglets, four faceted turbofan pods on pylons, and a T-tail. Gunmetal armour,
// lighter on top than the bomber ('#5e666f' top panels) so it reads as a transport, with thin dark seams and a little
// grime. Team colour glows: strips along the wing and tailplane leading edges and down the fuselage sides, the rings
// round each engine intake, the winglet and tailplane tips. At night: navigation lights, the beacon and the visor.
import { kit } from './robkit.js';
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, mesh, sphere, M, THREE, TEAM } = L;
  L.seed(907);
  const R = kit(L, 0, 0);   // the Lancer's lighting (a toned-down overhead sun) and its sensor-lens material
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  // ---- materials: the Lancer's gunmetal shades, seams, steel and team glow
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false }), under = M.paint('#2c3136');
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), seam = M.plain('#101214', 0.8);
  const steel = M.plain('#626970', 0.3, 0.85), rail = M.plain('#23272b', 0.4, 0.7), hood = M.plain('#121518', 0.3, 0.6), hoodE = M.plain('#2b3136', 0.35, 0.6);
  const glow = M.emit(TEAM, 1.1), lens = R.eye(TEAM, 1.3, 0.32);
  const Y0 = 1.3, UV = 0.5; // one paint panel per world unit

  // ---- helpers (as in bomber_l.js)
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
  const oct = (r) => ({ w: r, h: r, t: r * 0.41, m: 0.41, bt: r * 0.41 }); // a regular octagon section
  // a band round a horizontal (x-axis) octagonal body: a short octagonal section, slightly proud
  const band = (x, len, r, y, z, mat) => facet([{ x: x + len / 2, ...oct(r), y, z }, { x: x - len / 2, ...oct(r), y, z }], [mat, mat, mat], { cast: false });
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

  // ---- fuselage: faceted octagonal sections (radius by station), its axis at height Y0
  const XN = 9.5, XT = -9.5;
  const prof = [[XN, 0.05], [9.15, 0.44], [8.6, 0.74], [8.2, 0.88], [7.8, 1.0], [6.8, 1.16], [5.6, 1.22], [-3.5, 1.22], [-4.6, 1.18], [-6.0, 1.0], [-7.4, 0.72], [-8.6, 0.42], [XT, 0.22]];
  const sec = ([x, r]) => ({ x, w: r, h: r, b: r, t: r * 0.58, m: 0.66, bt: r * 0.5, y: Y0 });
  const rOf = (x) => { for (let i = 0; i < prof.length - 1; i++) { const [xa, ra] = prof[i], [xb, rb] = prof[i + 1]; if (x <= xa && x >= xb) return ra + (rb - ra) * (xa - x) / (xa - xb); } return 0.2; };
  const topY = (x) => { const s = sec([x, rOf(x)]); return s.y + s.h; };
  facet(prof.slice(0, 3).map(sec), [top, armor, armor], { capBack: false });         // the nose cap
  facet(prof.slice(2, 5).map(sec), [hood, hoodE, top], { capFront: false, capBack: false }); // the flight-deck hood
  facet(prof.slice(4).map(sec), [roof, top, armor], { capFront: false });
  band(8.6, 0.05, 0.755, Y0, 0, seam); band(7.79, 0.05, 1.012, Y0, 0, seam); band(9.05, 0.04, 0.5, Y0, 0, seam);
  // the visor: a glowing sensor chevron across the hood, tilted with its slope
  { const sh = new THREE.Shape(); [[0.16, 0], [-0.06, 0.42], [-0.16, 0.42], [0.04, 0.02], [0.04, -0.02], [-0.16, -0.42], [-0.06, -0.42]].forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); g.rotateX(Math.PI / 2);
    const m = mesh(g, lens, 8.25, topY(8.25) + 0.035, 0, { dirt: 0, cast: false }); m.rotation.z = -Math.atan2(topY(7.8) - topY(8.6), 0.8); }
  // frames across the top: dark seams on the roof facet
  for (const x of [6.2, 4.6, 3.1, -2.6, -3.9, -5.2]) { const t = rOf(x) * 0.58; strip(x, -t, x, t, 0.035, topY(x) - 0.003, 0.012, seam); }
  // the glow strips down each side, at the crease where the upper chamfer meets the side
  for (const s of [-1, 1]) for (const [a, b] of [[6.4, 2.95], [-2.25, -4.9]]) {
    const xs = [a, ...prof.map((p) => p[0]).filter((x) => x < a && x > b), b];
    for (let i = 0; i < xs.length - 1; i++) {
      const P = (x) => { const S = sec([x, rOf(x)]); return [x, S.y + S.m * S.h - 0.02, s * (S.w + 0.005)]; };
      L.beam(P(xs[i]), P(xs[i + 1]), 0.07, 0.07, glow, { cast: false });
    }
  }
  // main-gear sponsons along the belly, faceted
  for (const s of [-1, 1]) facet([[1.3, 0.1], [0.8, 0.46], [-3.2, 0.46], [-3.7, 0.12]].map(([x, r]) => ({ x, ...oct(r), w: r * 1.05, y: Y0 - 0.6, z: s * 1.15 })), [top, armor, armor]);
  // hatches, vents and the satcom dome on the spine
  for (const x of [3.6, -4.3]) { plate([[x + 0.28, -0.18], [x + 0.28, 0.18], [x - 0.28, 0.18], [x - 0.28, -0.18]], topY(x) + 0.03, 0.04, top, { bevel: 0.012 });
    strip(x + 0.3, 0, x - 0.3, 0, 0.02, topY(x) + 0.031, 0.005, seam); }
  for (let k = 0; k < 4; k++) strip(5.35 - k * 0.2, -0.24, 5.35 - k * 0.2, 0.24, 0.07, topY(5.3) - 0.002, 0.01, black);
  facet([{ x: 6.85, ...oct(0.02), y: topY(6.6) }, { x: 6.75, ...oct(0.13), y: topY(6.6) }, { x: 6.45, ...oct(0.13), y: topY(6.6) }, { x: 6.35, ...oct(0.02), y: topY(6.6) }], [dark, rail, rail]);
  cyl(0.05, 0.03, lens, 6.6, topY(6.6) + 0.12, 0, { seg: 16, dirt: 0, cast: false });

  // ---- the wing: high, swept, on the fuselage's shoulders; armoured plating, flaps and ailerons along its back
  const WY = Y0 + 1.05, WT = WY + 0.36, span = 9.3;
  const LE = (z) => 2.7 - Math.abs(z) * 0.47, TE = (z) => (Math.abs(z) < 3.2 ? -2.0 + Math.abs(z) * 0.06 : -1.81 - (Math.abs(z) - 3.2) * 0.22);
  const FL = (z) => TE(z) + 0.75; // the flap line
  for (const s of [-1, 1]) {
    for (const [z0, z1] of [[0, 3.2], [3.2, span]]) plate([[LE(z0), s * z0], [LE(z1), s * z1], [TE(z1), s * z1], [TE(z0), s * z0]], WT, 0.3, armor, { bevel: 0.05 });
    // plating: panels between the leading-edge band and the flap line
    const zs = [1.25, 3.2, 5.5, 7.6, span - 0.15];
    zs.slice(0, -1).forEach((z0, k) => { const a = z0 + 0.04, b = zs[k + 1] - 0.04;
      plate([[LE(a) - 0.34, s * a], [LE(b) - 0.34, s * b], [FL(b) + 0.06, s * b], [FL(a) + 0.06, s * a]], WT + 0.035, 0.035, k === 1 || k === 3 ? top : roof, { bevel: 0.012 }); });
    for (const [a, b] of [[1.3, 3.15], [3.25, 5.15], [5.25, 7.0], [7.1, 9.0]]) plate([[FL(a) - 0.04, s * a], [FL(b) - 0.04, s * b], [TE(b) + 0.04, s * b], [TE(a) + 0.04, s * a]], WT + 0.03, 0.03, top, { bevel: 0.01 });
    for (const z of [2.3, 6.5]) strip(LE(z) - 0.5, s * z, FL(z) + 0.2, s * z, 0.03, WT + 0.036, 0.01, seam); // spar lines
    // the leading-edge glow strip, in the dark band ahead of the plating
    strip(LE(1.3) - 0.16, s * 1.3, LE(span - 0.4) - 0.16, s * (span - 0.4), 0.09, WT + 0.002, 0.02, glow);
    // the winglet, turned up at the tip, its top edge glowing
    { const g2 = new THREE.BoxGeometry(1.0, 1.1, 0.12); g2.translate(0, 0.55, 0); const m = mesh(g2, top, (LE(span) + TE(span)) / 2 - 0.15, WT - 0.1, s * (span - 0.02), { dirt: 0 }); m.rotation.x = -s * 0.28; m.rotation.z = 0.25;
      box(0.55, 0.07, 0.15, glow, 0.1, 1.08, 0, { dirt: 0, cast: false, parent: m }); }
    // two turbofans each side: faceted pods on pylons forward of the leading edge, a glowing ring behind each intake lip
    for (const ez of [3.35, 6.05]) {
      const ex = LE(ez) - 0.55, ey = WY - 0.45, z = s * ez;
      facet([{ x: ex + 1.35, ...oct(0.5), y: ey, z }, { x: ex - 0.6, ...oct(0.5), y: ey, z }, { x: ex - 1.35, ...oct(0.42), y: ey, z }], [top, armor, armor]);
      band(ex + 1.33, 0.12, 0.52, ey, z, steel);                                             // the intake lip
      band(ex + 1.12, 0.1, 0.515, ey, z, glow);                                              // the glowing ring
      facet([{ x: ex + 1.4, ...oct(0.4), y: ey, z }, { x: ex + 1.38, ...oct(0.4), y: ey, z }], [black, black, black], { cast: false }); // fan face
      band(ex + 0.6, 0.035, 0.51, ey, z, seam);
      facet([{ x: ex - 1.3, ...oct(0.3), y: ey, z }, { x: ex - 1.9, ...oct(0.12), y: ey, z }], [rail, rail, rail]); // the exhaust cone
      box(1.9, 0.5, 0.16, armor, ex - 0.2, ey + 0.25, z, { dirt: 0 });                       // pylon
    }
  }
  // the wing-to-body fairing over the shoulders: a faceted hump, a sensor lens and the beacon on it
  facet([[2.75, 0.2, 0.05], [2.2, 0.72, 0.28], [-1.6, 0.72, 0.28], [-2.3, 0.3, 0.08]].map(([x, w, h]) => ({ x, w, h, b: 0.05, t: w * 0.62, m: 0.3, y: WT })), [roof, top, armor]);
  for (const x of [1.4, -0.6]) strip(x, -0.42, x, 0.42, 0.035, WT + 0.276, 0.01, seam);

  // ---- T-tail: a tall swept fin, the tailplane across its top
  const FY = Y0 + 1.1, FH = 3.6;
  facet([[-3.9, 0.08], [-4.7, 0.42], [-8.4, 0.42], [-9.0, 0.14]].map(([x, w]) => ({ x, w, h: 0.25, b: 0.6, t: w * 0.5, m: 0.3, y: Y0 + 0.88 })), [top, armor, armor]); // the dorsal fairing into the fin
  { const sh = new THREE.Shape(); sh.moveTo(-5.4, 0); sh.lineTo(-7.0, FH); sh.lineTo(-8.7, FH); sh.lineTo(-9.3, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false }); g.translate(0, 0, -0.11); mesh(g, armor, 0, FY, 0, { dirt: 0 }); }
  const TY = FY + FH + 0.2;
  for (const s of [-1, 1]) {
    const tp = [[-6.9, 0], [-8.5, s * 3.8], [-9.25, s * 3.8], [-8.9, 0]];
    plate(tp, TY, 0.2, armor, { bevel: 0.04 });
    plate(inset(tp, [0.2, 0.12, 0.16, 0.02]), TY + 0.03, 0.03, roof, { bevel: 0.01 });
    strip(-7.13, s * 0.25, -8.52, s * 3.55, 0.08, TY + 0.002, 0.02, glow);                  // the leading edge glows
    strip(-8.5, s * 3.76, -9.22, s * 3.76, 0.09, TY - 0.06, 0.08, glow);                   // and the tips
  }
  box(0.7, 0.04, 0.22, seam, -8.1, TY + 0.03, 0, { dirt: 0, cast: false });

  // ---- grime over the fuselage top and the wings
  grime([[5.6, -0.6], [5.6, 0.6], [-5.0, 0.6], [-5.0, -0.6]], topY(0) + 0.02, 0.5, 13);
  for (const s of [-1, 1]) grime([[LE(0), 0], [LE(span), s * span], [TE(span), s * span], [TE(3.2), s * 3.2], [TE(0), 0]], WT + 0.075, 0.2, 6 + s);

  // ---- lights: navigation (red left, green right, white tail), the anti-collision beacon
  sphere(0.15, M.emit('#ff3a2a', 3.4), LE(span) - 0.5, WT + 0.02, -span + 0.05, { cast: false });
  sphere(0.15, M.emit('#3aff6a', 3.4), LE(span) - 0.5, WT + 0.02, span - 0.05, { cast: false });
  sphere(0.12, M.emit('#ffffff', 3.2), XT + 0.1, Y0 + 0.75, 0, { cast: false });
  sphere(0.13, M.emit('#ff3a2a', 3.0), -1.0, WT + 0.29, 0, { cast: false });

  // looking straight down, the studio environment reflects off every flat top: keep reflections low (as the robots do)
  const seen = new Set();
  L.getRoot().traverse((o) => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (!seen.has(m) && m.envMapIntensity !== undefined) { seen.add(m); m.envMapIntensity *= m.emissiveIntensity > 0 ? 1 : 0.35; } });
}
