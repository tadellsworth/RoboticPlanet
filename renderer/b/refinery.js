// Refinery: twin distillation columns with platforms, spherical storage tanks, pipe rack, heater box, burning flare stack.
// ?part=work&f=k: only the column lights, blinking slowly (frame k of 8). The flare flame comes from fx-flare.
// Powered realism (b/powerkit.js), not in the work frames (they stay shared): team strips along the pipe rack and up
// its end posts, floodlights on the rack, a control room with lit windows at the front, a junction box and conduits
// with glowing collars to the heater and the rack, a transformer with arcing insulators cabled to the rack, beacons on
// the spheres. Team-coloured: render one image per team.
import { workLayer, litMat } from './worklib.js';
import { power } from './powerkit.js';
const BLINK = [[1.7, 1.7, 1.2, 0.35, 0.25, 0.3, 0.9, 1.5], [0.3, 0.9, 1.6, 1.7, 1.6, 0.9, 0.3, 0.25], [1.6, 0.4, 0.3, 1.6, 0.4, 0.3, 1.6, 0.4]];
export default function (L) {
  const q = new URLSearchParams(location.search), WORK = q.get('part') === 'work', F = +(q.get('f') || 0);
  const blink = [];
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, ringWalk, group, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#cfcbc0'), warm = M.paint('#8c8579');
  L.seed(141);

  // distillation columns (back left)
  const cols = [[-2.5, -2.4, 0.62, 6.6], [-1.0, -3.3, 0.48, 5.2]];
  for (const [x, z, r, h] of cols) {
    box(r * 2 + 0.5, 0.45, r * 2 + 0.5, M.concrete, x, 0, z); ao(x, z, r * 2 + 0.5, r * 2 + 0.5, 0.5);
    cyl(r, h, off, x, 0.45, z, { seg: 32, dirtH: 1.2 });
    sphere(r, off, x, 0.45 + h, z, { dome: true });
    for (let y = 1.6; y < h; y += 1.6) ringWalk(x, y + 0.45, z, r + 0.02, r + 0.45, { posts: 12 });
    blink.push(hoop(r + 0.03, 0.06, M.emit(ACCENT, 2.2), x, h + 0.2, z, { cast: false }));
    ladder(x + r + 0.3, 0.45, h - 0.2, z + 0.3, { ry: Math.PI / 2 });
  }
  pipe([[-2.5, 6.5, -2.4], [-2.5, 7.25, -2.4], [-1.0, 7.25, -2.4], [-1.0, 5.9, -2.4], [-1.0, 5.9, -2.85]], 0.13, M.steel);

  // pipe rack across the middle
  for (const x of [-3.6, -1.2, 1.2, 3.6]) { box(0.2, 2.3, 0.2, gun, x, 0, -0.3); box(0.2, 2.3, 0.2, gun, x, 0, 0.5); box(0.25, 0.18, 1.0, gun, x, 2.3, 0.1, { dirt: 0 }); }
  beam([-3.7, 2.4, -0.3], [3.7, 2.4, -0.3], 0.15, 0.15, gun); beam([-3.7, 2.4, 0.5], [3.7, 2.4, 0.5], 0.15, 0.15, gun);
  const pc = [M.paint('#8d949a', { rivets: false }), M.paint('#3f6b6b', { rivets: false }), M.paint('#b8952e', { rivets: false })];
  [-0.1, 0.15, 0.4].forEach((dz, i) => pipe([[-3.8, 2.62, dz], [3.8, 2.62, dz]], 0.11, pc[i]));
  pipe([[-2.5, 1.0, -1.8], [-2.5, 2.62, -1.8], [-2.5, 2.62, -0.1]], 0.12, M.steel);

  // spherical storage tanks on legs (back right)
  for (const [x, z, r] of [[1.9, -2.6, 1.05], [3.75, -1.25, 0.85]]) {
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; box(0.12, r + 0.5, 0.12, gun, x + Math.cos(a) * r * 0.8, 0, z + Math.sin(a) * r * 0.8); }
    sphere(r, off, x, r + 0.55, z); hoop(r * 0.99, 0.04, gun, x, r + 0.55, z); ao(x, z, r * 2, r * 2, 0.45);
    ladder(x - r - 0.05, 0, r * 2 + 0.4, z + 0.3, { ry: Math.PI / 2 });
  }

  // fired heater (front left) and product tanks (front right)
  box(2.2, 2.0, 1.5, gun, -2.7, 0, 2.3); box(2.3, 0.15, 1.6, warm, -2.7, 2.0, 2.3, { dirt: 0 }); ao(-2.7, 2.3, 2.2, 1.5, 0.5);
  cyl(0.28, 1.6, M.steel, -2.7, 2.15, 2.3, { soot: 0.6 });
  box(1.4, 0.3, 0.05, M.emit('#ff7a2a', 1.6), -2.7, 0.35, 3.06, { cast: false });
  for (const [x, z] of [[1.6, 2.6], [3.4, 2.6]]) { cyl(0.82, 1.5, off, x, 0, z, { seg: 32 }); cyl(0.85, 0.1, gun, x, 1.5, z, { dirt: 0 }); hoop(0.84, 0.04, M.emit(ACCENT, 1.6), x, 1.2, z, { cast: false }); }
  ao(2.5, 2.6, 3.6, 1.7, 0.5);
  pipe([[1.6, 0.3, 1.8], [1.6, 0.3, 0.9], [1.2, 0.3, 0.9]], 0.08, M.steel);

  // flare stack (back right corner) with a burning tip
  const fx = 4.2, fz = -4.1;
  box(0.8, 0.3, 0.8, M.concrete, fx, 0, fz);
  cyl(0.16, 4.9, M.paint('#9b3a2a', { rivets: false }), fx, 0.3, fz, { seg: 14, soot: 1.0 });
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + 0.4; beam([fx + Math.cos(a) * 0.9, 0.05, fz + Math.sin(a) * 0.9], [fx, 3.4, fz], 0.03, 0.03, M.dark); }
  mesh(new THREE.ConeGeometry(0.32, 1.0, 16), M.emit('#ff6a1a', 2.4), fx, 5.7, fz, { cast: false, dirt: 0 });
  mesh(new THREE.ConeGeometry(0.17, 0.62, 16), M.emit('#ffe08a', 3.5), fx, 5.52, fz, { cast: false, dirt: 0 });
  pointLight('#ff7a2a', 5, fx, 5.6, fz + 0.5, 4);
  lamp(-1.0, 5.95, -3.3, ACCENT, { shape: 'sphere', size: 0.13, intensity: 2, dist: 3, k: 2.6 });
  blink.push(L.getRoot().children[L.getRoot().children.length - 1]);
  if (!WORK) powerLayer();
  if (WORK) {
    blink.forEach((m, i) => { m.material = litMat(L, ACCENT, i === 2 ? 2.6 : 2.2, BLINK[i][F], 1.7); });
    workLayer(L, new Set(blink));
  }

  // ================================================================ power layer (lights and electricity)
  function powerLayer() {
    const P = power(L), nc = { dirt: 0, cast: false };
    // team strips along the front of the pipe rack's top beams and up its end posts; floodlights on the end posts
    P.strip(7.3, 0, 2.31, 0.62, 0, 0.07); P.strip(7.3, 0, 2.31, -0.42, 0, 0.05);
    for (const s of [-1, 1]) {
      box(0.06, 1.9, 0.06, P.glow, s * 3.6, 0.3, 0.62, nc);
      const g = group(s * 3.6, 2.3, 0.72, s * 0.45); box(0.12, 0.12, 0.2, P.steelD, 0, -0.08, -0.05, { parent: g, dirt: 0 });
      const h = new THREE.Group(); h.position.set(0, 0.04, 0.12); h.rotation.x = 0.4; g.add(h);
      box(0.36, 0.22, 0.18, P.steel, 0, -0.11, 0, { parent: h, dirt: 0 }); box(0.3, 0.16, 0.03, P.white, 0, -0.08, 0.1, { parent: h, ...nc });
      pointLight('#fff1d6', 3, s * 3.2, 1.4, 1.6, 4.5);
    }
    // team strip round the heater's roof edge
    P.strip(2.3, -2.7, 2.03, 3.11, 0, 0.06);
    // control room at the front: lit window band, team strip on the fascia, door lamp, roof unit, beacon
    const rx = -0.35, rz = 3.5, RW = 1.75, RD = 1.25, RH = 1.25, rf = rz + RD / 2;
    box(RW + 0.25, 0.1, RD + 0.25, P.conc, rx, 0, rz, { dirt: 0.4 }); ao(rx, rz, RW, RD, 0.5);
    box(RW, RH, RD, off, rx, 0.1, rz, { dirtH: 0.7 });
    box(RW + 0.12, 0.12, RD + 0.12, gun, rx, 0.1 + RH, rz, { dirt: 0 });
    P.strip(RW + 0.1, rx, 0.13 + RH, rf + 0.08, 0, 0.06);
    P.windows(1.0, 0.32, rx - 0.3, 0.75, rf + 0.02, 0, 3);
    box(0.36, 0.85, 0.04, P.steelD, rx + 0.56, 0.1, rf + 0.02, { dirt: 0.3 }); box(0.18, 0.05, 0.05, P.white, rx + 0.56, 1.02, rf + 0.05, nc);
    pointLight('#ffd9a0', 1.6, rx, 0.8, rf + 0.7, 2.2);
    box(0.5, 0.28, 0.45, P.steel, rx - 0.45, 0.22 + RH, rz - 0.1, { dirt: 0.3 }); cyl(0.15, 0.03, M.dark, rx - 0.45, 0.5 + RH, rz - 0.1, { seg: 16, dirt: 0 });
    P.beacon(rx + 0.6, 0.32 + RH, rz - 0.3, '#ffb347');
    // junction box behind the control room; conduits to the heater and up a rack post
    P.junction(rx + 0.25, rz - RD / 2 - 0.45, Math.PI);
    P.conduit([[rx - 0.02, 0.3, rz - RD / 2 - 0.45], [-1.6, 0.3, rz - RD / 2 - 0.45]], 0.05);
    P.conduit([[rx + 0.52, 0.3, rz - RD / 2 - 0.45], [0.2, 0.3, rz - RD / 2 - 0.45], [0.2, 0.3, 1.0], [-1.2, 0.3, 1.0], [-1.2, 0.3, 0.62], [-1.2, 1.9, 0.62]], 0.05);
    // transformer in the back-left corner on a hazard-edged plinth, cabled up to the rack's end
    const qx = -3.95, qz = -3.85;
    box(1.2, 0.08, 1.0, P.conc, qx, 0, qz, { dirt: 0.4, cast: false }); ao(qx, qz, 1.2, 1.0, 0.4);
    box(1.2, 0.1, 0.05, M.hazard, qx, 0, qz + 0.5, { dirt: 0, cast: false });
    P.transformer(qx, qz, Math.PI / 2);
    box(0.3, 0.3, 0.2, P.steelD, -3.6, 2.15, -0.42, { dirt: 0 });
    P.cable([qx, 1.17, qz + 0.28], [-3.6, 2.35, -0.48], 0.3);
    // team rings round the spheres' equators and beacons on their tops
    for (const [x, z, r] of [[1.9, -2.6, 1.05], [3.75, -1.25, 0.85]]) hoop(r + 0.035, 0.03, P.glow, x, r + 0.62, z, { cast: false });
    P.beacon(1.9, 2.7, -2.6); P.beacon(3.75, 2.3, -1.25);
  }
}
