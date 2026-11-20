// The Shield Dome's emitter (IDEAS.md "Megastructures", the owner's look A, "Hex Lattice", Nov 2026): a 2 x 2 building
// (20 x 20 world units, the middle of its four tiles at the origin) on its own wide pad, framed like the Mass Driver
// (the pad's 20 units across 0.7 of the frame). The dome itself (faint blue hexagon panels nine tiles round it, flashing
// where something hits) is drawn by the game in code; this is what makes it.
//   A six-sided concrete plinth with the team band round its rim; the emitter tower in the middle: a tapered steel
//   column wound with three copper field coils, topped by a cradle of four claws holding a pale blue Ring Crystal
//   projector inside a halo ring; six field pylons round it on the corners of a hexagon, each a steel post with ceramic
//   insulators and a small crystal tip, cabled in to the tower; a Crystal hopper at the front (the dome burns them), a
//   transformer at the back, a junction box, floodlights, beacons. Marks: 'emitter' (the projector), 'p0'..'p5' (the
//   pylons' tips).
import { power } from './powerkit.js';
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, hoop, sphere, mesh, group, ao, pointLight, pipe, M, THREE } = L;
  L.seed(8810);
  L.longPad(20, 20);
  L.frameCompoundOpts({ half: 10.12, width: 0.7, cy: 0.6 });
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const P = power(L), nc = { dirt: 0, cast: false };
  const T = {
    conc: M.rough('#9a9285'), concD: M.rough('#7f786c'), gun: M.paint('#4c5258', { metal: 0.45, rough: 0.5 }), gunD: M.paint('#363a3f', { rivets: false, metal: 0.5 }),
    steel: M.steel, copper: M.plain('#b06a32', 0.35, 0.9), copperD: M.plain('#7e4a22', 0.45, 0.85), ceramic: M.plain('#d9d3c4', 0.45, 0.05),
    crys: M.crystal('#2f8fd0', '#5ab8ff', dark ? 1.1 : 0.25), halo: dark ? M.emit('#8fd0ff', 2.4) : M.plain('#a9c8dc', 0.3, 0.4), white: M.paint('#d8d3c6', { rivets: false }),
  };
  ao(0, 0, 13, 13, 0.45);
  // the plinth: six-sided, two steps, the team band round the upper rim
  cyl(6.6, 0.55, T.concD, 0, 0, 0, { seg: 6, dirt: 0.6 });
  cyl(5.4, 1.0, M.paint('#5d636a'), 0, 0.55, 0, { seg: 6, dirt: 0.5, dirtH: 1 });
  for (let k = 0; k < 6; k++) {
    const a0 = k * PI / 3, a1 = a0 + PI / 3, r = 5.42;
    const ax = Math.cos(a0) * r, az = Math.sin(a0) * r, bx = Math.cos(a1) * r, bz = Math.sin(a1) * r;
    box(Math.hypot(bx - ax, bz - az) - 0.3, 0.1, 0.1, P.glow, (ax + bx) / 2, 1.5, (az + bz) / 2, { ry: Math.atan2(-(bz - az), bx - ax), ...nc });
  }
  // a hazard ring round the tower's foot
  { const g = new THREE.RingGeometry(2.3, 2.75, 48); g.rotateX(-PI / 2); mesh(g, M.hazard, 0, 1.56, 0, nc); }
  // the tower: a tapered steel column with three copper field coils, a gallery, the claws and the projector
  const Y0 = 1.55;
  cyl(2.1, 0.6, T.gunD, 0, Y0, 0, { seg: 6, dirt: 0.3 });
  cyl(1.55, 6.2, T.gun, 0, Y0 + 0.6, 0, { seg: 24, rTop: 0.95, dirt: 0.35, dirtH: 5 });
  for (const [y, r] of [[2.4, 1.48], [4.1, 1.3], [5.8, 1.1]]) {
    for (const dy of [-0.18, 0, 0.18]) hoop(r + 0.12, 0.11, dy ? T.copperD : T.copper, 0, Y0 + y + dy, 0);
    hoop(r + 0.26, 0.05, T.halo, 0, Y0 + y, 0);
  }
  // the ladder side and the gallery under the head
  for (let y = Y0 + 1; y < Y0 + 6.9; y += 0.35) box(0.5, 0.05, 0.05, T.steel, 0, y, 1.5 - (y - Y0) * 0.1, { dirt: 0 });
  cyl(1.7, 0.12, T.gunD, 0, Y0 + 6.8, 0, { seg: 24, dirt: 0 });
  hoop(1.68, 0.05, M.paint('#c49a2c', { rivets: false }), 0, Y0 + 7.5, 0);
  // the claws: four curved steel arms holding the projector
  const HY = Y0 + 8.5;
  for (let k = 0; k < 4; k++) {
    const a = k * PI / 2 + PI / 4, c = Math.cos(a), s = Math.sin(a);
    pipe([[c * 0.6, Y0 + 6.9, s * 0.6], [c * 1.35, HY - 0.6, s * 1.35], [c * 1.25, HY + 0.4, s * 1.25], [c * 0.75, HY + 0.95, s * 0.75]], 0.13, T.gunD);
    sphere(0.16, T.steel, c * 0.75, HY + 0.95, s * 0.75);
  }
  // the projector: a faceted Ring Crystal in a halo ring
  { const g = new THREE.IcosahedronGeometry(0.95, 1); const m = mesh(g, T.crys, 0, HY, 0, { dirt: 0, cast: false }); m.scale.set(1, 1.25, 1); }
  hoop(1.55, 0.07, T.halo, 0, HY, 0);
  hoop(1.75, 0.04, T.gunD, 0, HY - 0.05, 0);
  L.mark('emitter', 0, HY, 0);
  // six field pylons on the corners of a hexagon, cabled in to the tower's foot
  for (let k = 0; k < 6; k++) {
    const a = k * PI / 3 + PI / 6, x = Math.cos(a) * 7.6, z = Math.sin(a) * 7.6;
    box(1.2, 0.3, 1.2, T.concD, x, 0, z, { dirt: 0.5 });
    cyl(0.22, 3.0, T.steel, x, 0.3, z, { seg: 10, dirt: 0.3 });
    for (const y of [2.0, 2.35, 2.7]) cyl(0.34, 0.08, T.ceramic, x, y, z, { seg: 14, dirt: 0 });
    { const g = new THREE.OctahedronGeometry(0.32, 0); const m = mesh(g, T.crys, x, 3.65, z, { dirt: 0, cast: false }); m.scale.set(1, 1.6, 1); }
    L.mark('p' + k, x, 3.65, z);
    pipe([[x * 0.9, 0.35, z * 0.9], [x * 0.8, 0.35, z * 0.8], [Math.cos(a) * 6.5, 0.7, Math.sin(a) * 6.5], [Math.cos(a) * 5.5, 1.6, Math.sin(a) * 5.5], [Math.cos(a) * 2.3, 1.7, Math.sin(a) * 2.3]], 0.12, P.dark);
  }
  // the Crystal hopper at the front left: a steel bin heaped with Ring Crystal, a chute into the plinth
  { const x = -3.6, z = 7.2;
    box(2.2, 1.2, 1.6, T.gun, x, 0, z, { dirt: 0.5 });
    for (let k = 0; k < 7; k++) { const g = new THREE.OctahedronGeometry(0.28 + 0.1 * L.rnd(), 0); const m = mesh(g, T.crys, x - 0.7 + (k % 4) * 0.45, 1.25, z - 0.35 + Math.floor(k / 4) * 0.6, { dirt: 0, cast: false }); m.rotation.set(L.rnd(), L.rnd(), L.rnd()); }
    pipe([[x + 0.9, 1.0, z - 0.6], [x + 2.2, 1.0, z - 2.4]], 0.18, T.gunD); }
  // the power: a transformer at the back right, a junction box, floodlights, beacons
  P.transformer(7.6, -8.2, 0);
  P.cable([7.9, 1.2, -8.2], [2.0, 1.4, -2.0], 0.4);
  P.junction(5.2, 8.2, 0); P.beacon(5.2, 0.82, 8.2, '#ffb347');
  P.flood(-8.6, -8.6, 3.2, PI / 4); P.flood(8.6, 8.8, 3.2, -PI * 3 / 4);
  P.beacon(0, HY + 1.35, 0, '#ff3a22');
  if (dark) { pointLight('#9fd8ff', 9 * NB, 0, HY, 0, 9); pointLight('#9fd8ff', 3 * NB, 0, 2, 0, 7); }
  else pointLight('#cfeaff', 2.5, 0, HY, 0, 4);
}
