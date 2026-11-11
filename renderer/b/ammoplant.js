// Ammo Plant: olive munitions hall with exhaust stack, conveyor line of brass cartridges into a shell press,
// pallet of big upright shells, ammo crates inside concrete blast walls; team-colour lights.
// Powered realism (b/powerkit.js): lit window band and team corner strips on the hall, floodlights on its eave
// and on a pole by the shell pallet, a team strip along the conveyor and the blast walls, an aviation beacon and
// glowing band on the stack, a transformer yard (right) cabled to the hall and conduited through a junction box
// into the shell press, status lights on the press, amber beacons.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, M, THREE, TEAM } = L;
  const gun = M.paint('#4b5157'), olive = M.paint('#5d6247'), oliveR = M.ribbed('#646a4e'), glow = M.emit(TEAM, 2.4);
  const brass = M.plain('#c9a043', 0.28, 0.9), tip = M.plain('#2c2a26', 0.5, 0.6);
  L.seed(211);

  // munitions hall (back) with roof vents and stack
  const hx = -1.3, hz = -2.6;
  box(5.8, 2.6, 3.0, oliveR, hx, 0, hz); box(6.0, 0.22, 3.2, gun, hx, 2.6, hz, { dirt: 0 }); ao(hx, hz, 5.8, 3.0);
  for (const dx of [-1.8, -0.4, 1.0]) { box(0.9, 0.5, 2.6, olive, hx + dx, 2.82, hz, { dirt: 0 }); box(0.9, 0.3, 0.05, M.grille('#2c3034'), hx + dx, 2.9, hz + 1.31, { dirt: 0 }); }
  box(5.4, 0.08, 0.07, glow, hx, 2.25, hz + 1.53, { cast: false });
  box(1.4, 1.9, 0.06, M.dark, hx + 1.8, 0, hz + 1.51, { dirt: 0.4 }); box(1.6, 0.14, 0.1, M.hazard, hx + 1.8, 1.9, hz + 1.52, { dirt: 0 });
  cyl(0.32, 5.0, M.steel, 2.6, 0, -3.6, { soot: 1.2 }); hoop(0.34, 0.05, gun, 2.6, 2.0, -3.6); hoop(0.34, 0.05, gun, 2.6, 3.6, -3.6); ao(2.6, -3.6, 0.8, 0.8, 0.4);
  lamp(hx - 2.7, 2.95, hz + 1.3, TEAM, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 3 });

  // conveyor line of cartridges into the shell press
  const cz = -0.25, cy = 0.85;
  for (const x of [-3.8, -1.6, 0.6]) { box(0.1, cy, 0.1, M.steel, x, 0, cz - 0.4); box(0.1, cy, 0.1, M.steel, x, 0, cz + 0.4); }
  box(5.0, 0.12, 0.9, M.dark, -1.5, cy, cz, { dirt: 0 });
  box(5.0, 0.16, 0.08, M.paint('#b8952e', { rivets: false }), -1.5, cy, cz - 0.49, { dirt: 0 }); box(5.0, 0.16, 0.08, M.paint('#b8952e', { rivets: false }), -1.5, cy, cz + 0.49, { dirt: 0 });
  for (let x = -3.8; x < 0.9; x += 0.32) for (const dz of [-0.2, 0.2]) { cyl(0.08, 0.3, brass, x, cy + 0.12, cz + dz, { seg: 14, dirt: 0 }); mesh(new THREE.ConeGeometry(0.08, 0.16, 14), tip, x, cy + 0.5, cz + dz, { dirt: 0 }); }
  const px = 2.0;
  box(1.6, 2.0, 1.5, gun, px, 0, cz); ao(px, cz, 1.6, 1.5, 0.5);
  box(1.0, 0.7, 0.08, M.plain('#121518', 0.6, 0.2), px - 0.81, 0.85, cz, { dirt: 0, ry: Math.PI / 2 });
  box(1.62, 0.18, 1.52, M.hazard, px, 1.3, cz, { dirt: 0 });
  cyl(0.22, 0.7, M.chrome, px, 2.0, cz, { dirt: 0 }); box(0.8, 0.3, 0.8, olive, px, 2.7, cz, { dirt: 0 });
  box(0.5, 0.08, 0.05, glow, px, 1.7, cz + 0.76, { cast: false });
  pointLight(TEAM, 4, px - 1.2, 1.4, cz + 0.8, 3);

  // pallet of big shells (front right)
  const sx = 2.5, sz = 2.7;
  box(2.3, 0.16, 1.6, M.wood, sx, 0, sz); ao(sx, sz, 2.3, 1.6, 0.5);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) { const x = sx - 0.84 + i * 0.42, z = sz - 0.46 + j * 0.46; cyl(0.17, 0.8, brass, x, 0.16, z, { seg: 20, dirt: 0 }); mesh(new THREE.ConeGeometry(0.17, 0.42, 20), j === 1 ? M.plain('#6b2a22', 0.5, 0.4) : tip, x, 1.17, z, { dirt: 0 }); }

  // ammo crates inside concrete blast walls (front left)
  const ax = -2.6, az = 2.6;
  box(0.4, 1.5, 2.6, M.concrete, ax - 1.75, 0, az); box(3.9, 1.5, 0.4, M.concrete, ax - 0.15, 0, az - 1.3); ao(ax - 0.5, az - 0.4, 3.9, 2.6, 0.5);
  for (const [x, z, y] of [[-0.6, -0.35, 0], [0.4, -0.35, 0], [1.4, -0.35, 0], [-0.6, 0.4, 0], [0.4, 0.4, 0], [-0.1, -0.35, 0.5], [0.9, -0.35, 0.5], [0.4, 0.4, 0.5]]) {
    box(0.9, 0.5, 0.65, olive, ax + x, y, az + z); box(0.91, 0.07, 0.66, M.paint('#c9a028', { rivets: false }), ax + x, y + 0.36, az + z, { dirt: 0 });
  }
  lamp(ax - 1.75, 1.62, az + 1.2, TEAM, { size: 0.14, intensity: 2, dist: 2.5, k: 3 });

  // ================================================================ power layer (lights and electricity)
  const P = power(L), nc = { dirt: 0, cast: false };
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  function flood(x, y, z, h, ry, tilt = 0.12, reach = 1.4) {
    if (h > 0) cyl(0.04, h, P.steelD, x, y, z, { seg: 10, dirt: 0.2 });
    const g = group(x, y + h, z, ry), t = new THREE.Group(); t.rotation.x = tilt; g.add(t);
    box(0.4, 0.25, 0.18, P.steel, 0, -0.125, 0.03, { parent: t, dirt: 0 });
    box(0.34, 0.19, 0.03, P.white, 0, -0.095, 0.13, { parent: t, ...nc });
    pointLight('#fff1d6', 4 * NB, x + Math.sin(ry) * reach, y + h - 1.2, z + Math.cos(ry) * reach, 5.5);
  }
  const fz = hz + 1.5;                                                       // hall front wall
  // hall: lit window band left of the door, team strips up the front corners, eave floodlights, amber roof beacons
  P.windows(3.3, 0.32, hx - 1.05, 1.5, fz + 0.03, 0, 5);
  for (const x of [hx - 2.93, hx + 2.93]) box(0.06, 2.55, 0.06, P.glow, x, 0.05, fz + 0.03, nc);
  for (const s of [-1, 1]) { flood(hx + s * 2.65, 2.82, fz - 0.15, 0.3, -s * 0.3, 0.35, 2.2); P.beacon(hx + s * 2.8, 2.93, hz - 1.4, '#ffb347'); }
  box(0.3, 0.14, 0.1, P.steelD, hx + 1.8, 2.06, fz + 0.06, { dirt: 0 }); box(0.24, 0.06, 0.03, P.warm, hx + 1.8, 2.07, fz + 0.12, nc);   // lamp over the door
  // stack: glowing band and an amber aviation beacon on top
  hoop(0.335, 0.03, P.glow, 2.6, 4.6, -3.6, { cast: false }); P.beacon(2.6, 5.1, -3.6, '#ffb347');
  // conveyor: a team strip along the front rail; shell press: status panel with lights
  P.strip(5.0, -1.5, 0.82, cz + 0.54, 0, 0.04);
  box(0.5, 0.36, 0.05, P.steelD, px + 0.45, 0.6, cz + 0.76, { dirt: 0 });
  for (const [k, mat] of [[-0.13, P.green], [0, P.amber], [0.13, P.glow]]) box(0.07, 0.07, 0.03, mat, px + 0.45 + k, 0.82, cz + 0.79, nc);
  box(0.36, 0.08, 0.03, P.glowSoft, px + 0.45, 0.68, cz + 0.79, nc);
  // blast wall: a team strip under the lip of its inner face
  P.strip(3.4, ax - 0.05, 1.36, az - 1.08, 0, 0.045);
  // transformer yard at the right: cable to the hall, conduit through a junction box into the press
  const ux = 3.8, uz = -2.0;
  box(1.2, 0.03, 1.0, P.dark, ux, 0, uz, nc);
  for (const [w, d, x, z] of [[1.2, 0.08, ux, uz - 0.5], [1.2, 0.08, ux, uz + 0.5], [0.08, 1.0, ux - 0.6, uz], [0.08, 1.0, ux + 0.6, uz]]) box(w, 0.04, d, M.hazard, x, 0, z, nc);
  P.transformer(ux, uz, 0); ao(ux, uz, 1.0, 0.8, 0.35);
  box(0.1, 0.18, 0.18, P.steelD, hx + 2.93, 2.2, uz, { dirt: 0 });
  P.cable([ux - 0.28, 1.2, uz], [hx + 2.98, 2.3, uz], 0.15);
  P.junction(3.75, -0.3, 0);
  P.conduit([[3.75, 0.35, uz + 0.36], [3.75, 0.35, -0.52]], 0.05);
  P.conduit([[3.47, 0.45, -0.3], [2.82, 0.45, -0.3], [2.82, 1.25, -0.3]], 0.05);
  // pole floodlight by the shell pallet, lighting the apron
  flood(4.05, 0, 1.35, 2.1, -0.85); ao(4.05, 1.35, 0.4, 0.4, 0.3);
  P.beacon(hx + 1.8 - 0.62, 1.98, fz + 0.12, '#ffb347');
}
