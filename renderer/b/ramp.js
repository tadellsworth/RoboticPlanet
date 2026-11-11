// Ramp: steel-plated ramp rising from the front of the pad to an upper concrete landing at the back,
// with hazard-striped edges, guard rails, painted chevrons and amber guide lights.
// Powered realism, a light touch (b/powerkit.js): team beacons on the bollards, floodlights on the landing's corners,
// a junction box at the foot with a conduit with glowing collars up the side wall, team strips on the landing's
// exposed front edges. Team-coloured: render one image per team.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, lamp, ao, mesh, M, THREE, ACCENT } = L;
  const P = power(L), nc = { dirt: 0, cast: false };
  const plate = M.paint('#7d848a', { rivets: false, panelW: 128, panelH: 128 }), gun = M.paint('#50565c'), yel = M.paint('#c49a2c', { rivets: false });
  L.seed(181);
  const W = 5.6, z0 = 4.3, z1 = -2.4, H = 2.6, len = Math.hypot(z0 - z1, H), ang = Math.atan2(H, z0 - z1);
  const yAt = z => H * (z0 - z) / (z0 - z1);

  // upper landing (back)
  box(W + 1.2, H, 2.4, M.concrete, 0, 0, -3.6, { dirtH: 1.2 }); ao(0, -3.6, W + 1.2, 2.4, 0.5);
  box(W + 1.2, 0.05, 2.4, plate, 0, H, -3.6, { dirt: 0 });
  box(W + 1.2, 0.08, 0.2, M.hazard, 0, H, -2.45, { dirt: 0 });

  // concrete side walls (triangular) under the ramp deck
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(z0 - z1, 0); sh.lineTo(0, H); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.35, bevelEnabled: false });
    mesh(g, M.concrete, s * (W / 2 - 0.175) - 0.175, 0, z1, { ry: Math.PI / 2, order: 'YXZ' });
  }
  // deck: tilted plate with hazard edges and chevrons
  const mid = [(0), yAt((z0 + z1) / 2), (z0 + z1) / 2];
  const deck = L.group(mid[0], mid[1], mid[2]); deck.rotation.x = -ang;
  box(W, 0.14, len, plate, 0, 0, 0, { parent: deck, dirt: 0 });
  for (const s of [-1, 1]) box(0.4, 0.16, len, M.hazard, s * (W / 2 - 0.2), 0.01, 0, { parent: deck, dirt: 0 });
  const chev = M.plain('#e2b52c', 0.6);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) {
    const c = L.group(s * 0.55, 0.15, len / 2 - 1.6 - i * 2.0, 0, deck); c.rotation.y = -s * 0.8;
    box(1.4, 0.015, 0.28, chev, 0, 0, 0, { parent: c, dirt: 0, cast: false });
  }
  // guard rails following the slope
  for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.05);
    for (let z = z0 - 0.3; z > z1 - 2.2; z -= 0.9) { const y = z > z1 ? yAt(z) : H; box(0.08, 0.85, 0.08, yel, x, y, z, { dirt: 0 }); }
    beam([x, 0.85, z0 - 0.3], [x, H + 0.85, z1], 0.07, 0.07, yel); beam([x, H + 0.85, z1], [x, H + 0.85, z1 - 2.1], 0.07, 0.07, yel);
    beam([x, 0.43, z0 - 0.3], [x, H + 0.43, z1], 0.05, 0.05, yel);
  }
  // amber guide lights along both edges
  for (const s of [-1, 1]) for (let z = z0 - 0.8; z > z1; z -= 1.6) lamp(s * (W / 2 - 0.55), yAt(z) + 0.12, z, ACCENT, { size: 0.12, intensity: 1.5, dist: 1.8, k: 2.6, lift: 0.1 });
  for (const s of [-1, 1]) lamp(s * (W / 2 + 0.3), H + 0.1, -3.6, ACCENT, { size: 0.14, intensity: 2, dist: 2, k: 2.6 });
  // bollards at the foot of the ramp
  for (const x of [-W / 2 - 0.6, W / 2 + 0.6]) { cyl(0.16, 0.7, yel, x, 0, z0 - 0.2, { seg: 16 }); cyl(0.17, 0.12, M.dark, x, 0.45, z0 - 0.2, { seg: 16, dirt: 0 }); }

  // ================================================================ power layer (a light touch)
  // team beacons on the bollards
  for (const x of [-W / 2 - 0.6, W / 2 + 0.6]) P.beacon(x, 0.76, z0 - 0.2);
  // team strips along the landing's front edge either side of the ramp
  for (const s of [-1, 1]) P.strip(0.62, s * (W / 2 + 0.29), H + 0.04, -2.33, 0, 0.06);
  // floodlights on the landing's back corners, aimed down the ramp
  for (const s of [-1, 1]) P.flood(s * (W / 2 + 0.3), -4.55, H + 1.3, -s * 0.35);
  // junction box at the foot of the right side wall, a conduit up the wall to the landing
  P.junction(W / 2 + 0.45, 2.6, -Math.PI / 2);
  P.conduit([[W / 2 + 0.25, 0.55, 2.6], [W / 2 + 0.05, 0.55, 2.6], [W / 2 + 0.05, yAt(-1.2) - 0.25, -1.2], [W / 2 + 0.05, H - 0.25, -2.6]], 0.05);
}
