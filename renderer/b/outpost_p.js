// Outpost: armoured round bunker with glowing firing slits, watchtower with team band, sensor mast, radar dish, team beacon.
// POWERED proposal (outpost_p): the same realistic outpost with a lights-and-electricity layer from b/powerkit.js:
// team light strips round the crown, band and bunker rim, warm lit window slits, a conduit up the tower from a
// junction box, a transformer yard with an arc, floodlights on the rim, a cable to a small antenna, beacons.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, ladder, M, THREE, TEAM } = L;
  const PK = power(L), nc = { dirt: 0, cast: false };
  const armor = M.paint('#4c5258'), steel = M.steel, off = M.paint('#c7c2b6'), team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.6);
  L.seed(91);
  const cz = -0.4;

  // footing and sloped armoured bunker (12 faces) with firing slits
  cyl(3.55, 0.3, M.concrete, 0, 0, cz, { seg: 12 }); ao(0, cz, 7.0, 7.0, 0.5);
  cyl(3.3, 1.7, armor, 0, 0.3, cz, { rTop: 2.9, seg: 12 });
  for (let k = 0; k < 12; k++) {
    const g = group(0, 0, cz, (k + 0.5) * Math.PI / 6);
    box(0.78, 0.17, 0.14, M.dark, 0, 1.15, 2.97, { parent: g, dirt: 0 });
    box(0.62, 0.05, 0.04, glow, 0, 1.21, 3.05, { parent: g, cast: false });
  }
  cyl(2.95, 0.12, steel, 0, 2.0, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; box(0.07, 0.75, 0.07, M.paint('#c49a2c', { rivets: false }), Math.cos(a) * 2.8, 2.12, cz + Math.sin(a) * 2.8, { dirt: 0 }); }
  hoop(2.8, 0.045, M.paint('#c49a2c', { rivets: false }), 0, 2.87, cz);

  // watchtower with team-colour band and crenellated cap
  cyl(1.6, 2.8, armor, 0, 2.12, cz, { seg: 12 });
  cyl(1.63, 0.42, team, 0, 3.9, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 6; k++) { const g = group(0, 0, cz, (k + 0.5) * Math.PI / 3); box(0.5, 0.14, 0.1, M.dark, 0, 3.15, 1.55, { parent: g, dirt: 0 }); box(0.42, 0.08, 0.04, PK.warm, 0, 3.18, 1.59, { parent: g, ...nc }); }
  cyl(1.9, 0.32, steel, 0, 4.92, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(0.42, 0.4, 0.3, armor, Math.cos(a) * 1.72, 5.24, cz + Math.sin(a) * 1.72, { ry: -a, dirt: 0 }); }

  // sensor mast, radar dish, antennas, team beacon
  box(0.3, 3.9, 0.3, steel, 0.2, 5.24, cz, { dirt: 0 });
  for (const y of [6.2, 7.4]) box(1.0, 0.08, 0.08, steel, 0.2, y, cz, { dirt: 0 });
  const dish = new THREE.SphereGeometry(0.95, 28, 10, 0, Math.PI * 2, 0, 0.85); dish.translate(0, -0.95, 0);
  const dm = mesh(dish, off, -0.1, 7.0, cz + 0.25, { rx: -1.05, dirt: 0 }); dm.material = off; dm.material.side = THREE.DoubleSide;
  beam([-0.1, 6.55, cz + 0.55], [-0.1, 6.95, cz + 1.2], 0.05, 0.05, steel);
  box(0.05, 1.0, 0.05, steel, 0.6, 7.4, cz, { dirt: 0 }); box(0.05, 0.7, 0.05, steel, -0.25, 7.4, cz, { dirt: 0 });
  cyl(0.24, 0.12, M.dark, 0.2, 9.14, cz, { dirt: 0 });
  sphere(0.3, M.emit(TEAM, 4), 0.2, 9.5, cz, { cast: false });
  pointLight(TEAM, 6, 0.2, 9.0, cz + 0.6, 4);

  // door and approach
  const dg = group(0, 0, cz, 0);
  box(1.0, 1.35, 0.25, M.dark, 0, 0.3, 3.08, { parent: dg, dirt: 0.4 });
  box(1.1, 0.07, 0.07, glow, 0, 1.75, 3.0, { parent: dg, cast: false });
  box(1.4, 0.1, 0.6, M.hazard, 0, 0, cz + 3.75, { dirt: 0 });
  ladder(1.6, 2.12, 4.92, cz + 0.2, { ry: Math.PI / 2 });

  // concrete barriers at the front corners
  for (const [x, z, r] of [[-3.6, 3.4, 0.5], [3.6, 3.4, -0.5]]) { box(1.4, 0.65, 0.45, M.concrete, x, 0, z, { ry: r }); box(1.42, 0.12, 0.47, M.hazard, x, 0.42, z, { ry: r, dirt: 0 }); }

  // ================================================================ power layer (lights and electricity)
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  const P = (r, deg, y) => [Math.sin(deg * Math.PI / 180) * r, y, cz + Math.cos(deg * Math.PI / 180) * r];   // polar point round the tower
  function flood(x, y, z, h, ry, reach = 1.4) {
    cyl(0.04, h, PK.steelD, x, y, z, { seg: 10, dirt: 0.2 });
    const g = group(x, y + h, z, ry), t = new THREE.Group(); t.rotation.x = 0.12; g.add(t);
    box(0.4, 0.25, 0.18, PK.steel, 0, -0.125, 0.03, { parent: t, dirt: 0 });
    box(0.34, 0.19, 0.03, PK.white, 0, -0.095, 0.13, { parent: t, ...nc });
    pointLight('#fff1d6', 4 * NB, x + Math.sin(ry) * reach, y + h - 0.9, z + Math.cos(ry) * reach, 5);
  }

  // team light strips round the crown and the bunker rim; white perimeter lamps on every fourth railing post
  hoop(1.92, 0.025, glow, 0, 5.08, cz, { cast: false });
  hoop(2.97, 0.025, glow, 0, 2.06, cz, { cast: false });
  for (let k = 0; k < 16; k += 4) { const a = ((k + 2) / 16) * Math.PI * 2; box(0.1, 0.08, 0.1, PK.white, Math.cos(a) * 2.8, 2.88, cz + Math.sin(a) * 2.8, nc); }

  // warm bulkhead lamps either side of the door
  for (const s of [-1, 1]) { box(0.16, 0.12, 0.1, PK.steelD, s * 0.72, 1.32, cz + 3.03, { dirt: 0 }); box(0.12, 0.07, 0.03, PK.warm, s * 0.72, 1.34, cz + 3.08, nc); }
  pointLight('#ffd9a0', 2.5 * NB, 0, 0.9, cz + 3.6, 2.6);

  // floodlights on the bunker rim, front left and front right, lighting the approach
  for (const d of [-42, 42]) { const [x, , z] = P(2.55, d, 0); flood(x, 2.12, z, 0.95, d * Math.PI / 180); }

  // junction box at the foot of the bunker; a conduit runs up the slope and the tower to the crown
  const cd = 55;
  { const [x, , z] = P(4.05, cd, 0); PK.junction(x, z, cd * Math.PI / 180); }
  PK.conduit([P(3.82, cd, 0.5), P(3.6, cd, 0.5), P(3.36, cd, 0.4), P(2.98, cd, 1.98), P(3.02, cd, 2.2), P(1.7, cd, 2.2), P(1.7, cd, 4.86)], 0.055);
  { const [x, , z] = P(1.72, cd, 0); box(0.3, 0.36, 0.14, PK.steel, x, 4.45, z, { ry: cd * Math.PI / 180, dirt: 0 });       // crown distribution box
    const [fx, , fz] = P(1.8, cd, 0); box(0.05, 0.05, 0.03, PK.green, fx, 4.66, fz, { ry: cd * Math.PI / 180, ...nc }); }

  // transformer yard at the front-left foot of the bunker: hazard-framed plate, transformer with arcing insulators,
  // a conduit into the footing and a high-voltage feed up to the rim
  const tx = -3.35, tz = 2.0;
  box(1.25, 0.03, 1.05, PK.dark, tx, 0, tz, { dirt: 0, cast: false });
  for (const [w, d, x, z] of [[1.25, 0.08, tx, tz - 0.52], [1.25, 0.08, tx, tz + 0.52], [0.08, 1.05, tx - 0.62, tz], [0.08, 1.05, tx + 0.62, tz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
  PK.transformer(tx, tz, 0);
  PK.conduit([[tx + 0.3, 0.4, tz - 0.42], [tx + 0.3, 0.4, tz - 0.62], P(3.3, -60, 0.4)], 0.05);
  PK.cable([tx + 0.28, 1.2, tz], P(2.95, -68, 2.12), 0.2);

  // small antenna in the back-right corner, fed by a cable from the mast; amber obstruction beacons
  const ax = 3.55, az = -3.55;
  box(0.5, 0.45, 0.4, PK.steel, ax, 0, az, { dirt: 0.5 }); box(0.06, 0.06, 0.03, PK.green, ax - 0.1, 0.32, az + 0.21, nc); box(0.06, 0.06, 0.03, PK.amber, ax + 0.06, 0.32, az + 0.21, nc);
  cyl(0.05, 2.6, PK.steelD, ax, 0.45, az, { seg: 8, dirt: 0 });
  for (const y of [1.6, 2.4]) box(0.5, 0.04, 0.04, PK.steelD, ax, y, az, { dirt: 0 });
  cyl(0.02, 0.6, M.steel, ax, 3.05, az, { seg: 6, dirt: 0 });
  PK.beacon(ax, 3.1, az, '#ffb347');
  PK.cable([0.7, 7.38, cz], [ax, 2.95, az], 0.45);
  for (const s of [-1, 1]) PK.beacon(0.2 + s * 0.5, 7.53, cz, '#ffb347');
}
