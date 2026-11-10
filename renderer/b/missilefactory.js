// Missile Factory: tall assembly hangar with a lit bay, a missile on its assembly cradle under a gantry crane,
// propellant tanks, parts crates; team-colour lights and missile band.
import { missile } from './missile.js';
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
}
