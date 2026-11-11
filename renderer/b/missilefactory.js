// Missile Factory: tall assembly hangar with a lit bay, a missile on its assembly cradle under a gantry crane,
// propellant tanks, parts crates; team-colour lights and missile band.
// Powered realism (b/powerkit.js): team strips along the hangar eave, corners and the gantry girder, lit window
// bands either side of the bay, floodlights on the hangar corners and under the girder lighting the missile, a
// transformer at the front right cabled up to the gantry, a ground conduit into a junction box feeding the cradle,
// glowing bands on the propellant tanks, amber and team beacons.
import { missile } from './missile.js';
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, ladder, M, THREE, TEAM } = L;
  const gun = M.paint('#4b5157'), olive = M.paint('#5d6247'), rib = M.ribbed('#a9a296'), yel = M.paint('#b8952e'), glow = M.emit(TEAM, 2.4);
  L.seed(201);

  // assembly hangar (back) with clerestory and open bay
  const hx = -0.4, hz = -2.4, HW = 7.2, HD = 3.4, HH = 3.4;
  box(HW, HH, HD, rib, hx, 0, hz); ao(hx, hz, HW, HD);
  box(HW + 0.2, 0.22, HD + 0.2, gun, hx, HH, hz, { dirt: 0 });
  box(4.6, 0.9, 1.4, olive, hx - 0.4, HH + 0.22, hz - 0.3); box(4.4, 0.35, 0.05, M.emit(TEAM, 1.1), hx - 0.4, HH + 0.6, hz + 0.41, { cast: false });
  box(3.4, 2.7, 0.06, M.plain('#121518', 0.7, 0.2), hx - 0.6, 0, hz + HD / 2 + 0.01, { dirt: 0 });
  box(3.7, 0.18, 0.12, M.hazard, hx - 0.6, 2.7, hz + HD / 2 + 0.03, { dirt: 0 });
  box(3.3, 0.07, 0.07, glow, hx - 0.6, 2.55, hz + HD / 2 + 0.09, { cast: false });
  pointLight(TEAM, 8, hx - 0.6, 1.2, hz + HD / 2 + 0.8, 4);
  for (const x of [hx + 2.2, hx + 3.1]) cyl(0.3, 0.6, M.steel, x, HH + 0.22, hz - 0.6);

  // missile on its assembly cradle (front), lying along x
  const mz = 1.5, my = 1.25;
  const mg = group(-3.3, my, mz); mg.rotation.z = -Math.PI / 2; missile(L, mg, 5.0, 0.6, TEAM);
  for (const x of [-2.3, -0.2, 1.6]) { box(0.5, my - 0.55, 1.1, yel, x, 0, mz); box(0.6, 0.22, 1.2, gun, x, my - 0.6, mz, { dirt: 0 }); }
  ao(-0.3, mz, 7.0, 1.6, 0.5);

  // gantry crane over the cradle
  for (const x of [-4.1, 3.9]) { beam([x, 0, mz - 1.1], [x, 3.7, mz], 0.24, 0.24, yel); beam([x, 0, mz + 1.1], [x, 3.7, mz], 0.24, 0.24, yel); box(0.6, 0.2, 2.6, M.chrome, x, 0, mz, { dirt: 0, cast: false }); }
  box(8.3, 0.45, 0.5, yel, -0.1, 3.7, mz, { dirt: 0 });
  box(0.8, 0.5, 0.8, gun, 0.6, 3.25, mz); box(0.03, 1.0, 0.03, M.dark, 0.6, 2.25, mz, { dirt: 0 });
  box(0.9, 0.1, 0.4, M.steel, 0.6, 2.15, mz, { dirt: 0 });
  lamp(-4.1, 4.3, mz, TEAM, { shape: 'sphere', size: 0.16, intensity: 3, dist: 3, k: 3 });
  lamp(3.9, 4.3, mz, TEAM, { shape: 'sphere', size: 0.16, intensity: 3, dist: 3, k: 3 });

  // propellant tanks (back right) and parts crates (front)
  for (const z of [-3.6, -2.2]) { cyl(0.55, 2.8, M.paint('#d3cfc4', { rivets: false }), 4.15, 0, z, { seg: 28 }); sphere(0.55, M.paint('#d3cfc4', { rivets: false }), 4.15, 2.8, z, { dome: true }); box(1.12, 0.14, 0.05, M.hazard, 4.15, 1.4, z + 0.55, { dirt: 0 }); }
  ao(4.15, -2.9, 1.2, 2.6, 0.5);
  pipe([[4.15, 0.4, -1.65], [4.15, 0.4, -0.7], [hx + HW / 2, 0.4, -0.7]], 0.08, M.steel);
  for (const [x, z, y] of [[-3.2, 3.5, 0], [-2.3, 3.5, 0], [-2.75, 3.5, 0.55], [2.6, 3.5, 0]]) { box(0.85, 0.55, 0.6, olive, x, y, z); box(0.86, 0.08, 0.61, M.hazard, x, y + 0.3, z, { dirt: 0 }); }
  ao(-2.75, 3.5, 1.9, 0.7, 0.45);

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
  const fz = hz + HD / 2;                                                    // hangar front wall
  // hangar: team strips along the eave and up the front corners, lit window bands either side of the bay
  P.strip(HW + 0.2, hx, HH + 0.11, fz + 0.13, 0, 0.07);
  for (const x of [hx - HW / 2 - 0.03, hx + HW / 2 + 0.03]) box(0.06, HH - 0.1, 0.06, P.glow, x, 0.05, fz + 0.03, nc);
  P.windows(2.0, 0.32, hx + 2.35, 2.35, fz + 0.03, 0, 4);
  P.windows(0.95, 0.32, hx - 3.0, 2.35, fz + 0.03, 0, 2);
  // floodlights on the hangar's front corners, aimed over the cradle; amber beacons on the roof corners
  for (const s of [-1, 1]) {
    flood(hx + s * (HW / 2 - 0.25), HH + 0.22, fz - 0.05, 0.35, -s * 0.35, 0.35, 2.4);
    P.beacon(hx + s * (HW / 2 - 0.1), HH + 0.33, hz - HD / 2 + 0.1, '#ffb347');
  }
  // gantry: a team strip along the girder's lower edge, two lamps under it lighting the missile, amber light on the hook block
  P.strip(7.4, -0.1, 3.72, mz + 0.26, 0, 0.05);
  for (const x of [-2.6, 2.6]) {
    const g = group(x, 3.7, mz + 0.05, 0), t = new THREE.Group(); t.rotation.x = 1.1; g.add(t);
    box(0.44, 0.24, 0.2, P.steel, 0, -0.24, 0, { parent: t, dirt: 0 }); box(0.36, 0.17, 0.03, P.white, 0, -0.205, 0.1, { parent: t, ...nc });
    pointLight('#fff1d6', 2 * NB, x, 2.3, mz + 0.5, 3);
  }
  for (const s of [-1, 1]) box(0.08, 0.06, 0.08, P.amber, 0.6 + s * 0.4, 2.12, mz, nc);
  // transformer at the front right on a hazard-framed plate, cabled up to the girder; a ground conduit to a
  // junction box that feeds the cradle
  const ux = 3.85, uz = 3.65;
  box(1.2, 0.03, 1.0, P.dark, ux, 0, uz, nc);
  for (const [w, d, x, z] of [[1.2, 0.08, ux, uz - 0.5], [1.2, 0.08, ux, uz + 0.5], [0.08, 1.0, ux - 0.6, uz], [0.08, 1.0, ux + 0.6, uz]]) box(w, 0.04, d, M.hazard, x, 0, z, nc);
  P.transformer(ux, uz, 0); ao(ux, uz, 1.0, 0.8, 0.35);
  box(0.16, 0.1, 0.16, P.steelD, 3.9, 3.6, mz + 0.3, { dirt: 0 });
  P.cable([ux + 0.28, 1.2, uz], [3.9, 3.6, mz + 0.38], 0.2);
  P.junction(1.15, 3.6, 0);
  P.conduit([[ux - 0.45, 0.3, uz + 0.2], [1.43, 0.3, uz + 0.2]], 0.05);
  P.conduit([[1.15, 0.4, 3.39], [1.15, 0.4, 3.15], [1.6, 0.12, 2.6], [1.6, 0.12, 2.1]], 0.05);
  // propellant tanks: glowing bands and amber beacons on the domes; a status box on the feed pipe
  for (const z of [-3.6, -2.2]) { hoop(0.565, 0.03, P.glow, 4.15, 2.2, z, { cast: false }); P.beacon(4.15, 3.38, z, '#ffb347'); }
  // pole floodlight by the parts crates at the front left
  flood(-4.15, 0, 3.35, 2.0, 0.55); ao(-4.15, 3.35, 0.4, 0.4, 0.3);
  box(0.3, 0.36, 0.24, P.steel, 3.6, 0.25, -0.58, { dirt: 0.3 }); box(0.07, 0.06, 0.03, P.green, 3.53, 0.48, -0.45, nc); box(0.07, 0.06, 0.03, P.glow, 3.67, 0.48, -0.45, nc);
}
