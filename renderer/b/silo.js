// Missile Silo: armoured silo collar with the missile rising out of the open hatch, slid-back blast door,
// umbilical tower with swing arm, low control bunker; team-colour rim lights and beacon.
// Powered realism (b/powerkit.js): team strips round the collar lip, the blast-door rails, the tower leg, platform
// and bunker roof; white lamps on the guard blocks; a lit tower cab with a floodlight on the missile; a transformer
// yard (front left) cabled up the tower; the bunker-to-silo line as a conduit with glowing collars from a junction
// box; a pole floodlight at the back right; amber and team beacons. Static, so identical with ?empty=1.
import { missile } from './missile.js';
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, ladder, M, THREE, TEAM } = L;
  const gun = M.paint('#4b5157'), olive = M.paint('#5d6247'), glow = M.emit(TEAM, 2.4);
  L.seed(191);
  const sx = -0.7, sz = -0.6;

  // silo collar, opening, rim lights
  cyl(2.7, 0.55, M.concrete, sx, 0, sz, { seg: 40 }); ao(sx, sz, 5.4, 5.4, 0.5);
  hoop(2.35, 0.13, M.hazard, sx, 0.56, sz);
  cyl(1.55, 0.03, M.dark, sx, 0.55, sz, { seg: 40, dirt: 0, cast: false });
  hoop(1.6, 0.09, M.steel, sx, 0.58, sz);
  hoop(1.9, 0.06, glow, sx, 0.58, sz, { cast: false });
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; box(0.3, 0.18, 0.3, gun, sx + Math.cos(a) * 2.1, 0.55, sz + Math.sin(a) * 2.1, { dirt: 0 }); }

  // the missile rising out of the silo
  const mg = group(sx, -1.2, sz); missile(L, mg, 5.4, 0.62, TEAM);
  if (new URLSearchParams(location.search).get('empty')) mg.visible = false;   // ?empty=1: same scene with the silo empty
  pointLight(TEAM, 6, sx, 1.2, sz + 1.8, 4);

  // blast door slid back on rails (right)
  box(0.18, 0.12, 4.0, M.chrome, 1.75, 0, sz - 0.9, { dirt: 0 }); box(0.18, 0.12, 4.0, M.chrome, 3.75, 0, sz - 0.9, { dirt: 0 });
  cyl(1.75, 0.5, olive, 2.75, 0.12, sz, { seg: 40 }); hoop(1.72, 0.08, M.hazard, 2.75, 0.63, sz);
  box(1.2, 0.2, 0.5, gun, 2.75, 0.62, sz, { dirt: 0 }); ao(2.75, sz, 3.6, 3.6, 0.45);

  // umbilical tower with swing arm (back left)
  const tx = -3.7, tz = -3.3, TH = 6.0;
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]]) box(0.14, TH, 0.14, gun, tx + dx, 0, tz + dz);
  for (let y = 0.3; y < TH - 0.6; y += 0.9) { beam([tx - 0.45, y, tz + 0.45], [tx + 0.45, y + 0.9, tz + 0.45], 0.06, 0.06, gun); beam([tx + 0.45, y, tz - 0.45], [tx + 0.45, y + 0.9, tz + 0.45], 0.06, 0.06, gun); }
  box(1.2, 0.18, 1.2, M.grating, tx, TH, tz, { dirt: 0 }); box(0.9, 0.7, 0.9, olive, tx, TH + 0.18, tz);
  beam([tx + 0.5, 4.3, tz + 0.4], [sx - 0.75, 4.3, sz - 0.3], 0.3, 0.3, M.paint('#b8952e'));
  pipe([[tx + 0.5, 4.05, tz + 0.4], [sx - 0.7, 3.95, sz - 0.25]], 0.06, M.dark);
  box(1.0, 0.4, 1.0, M.concrete, tx, 0, tz); ao(tx, tz, 1.2, 1.2, 0.5);
  sphere(0.18, M.emit(TEAM, 3.5), tx, TH + 1.05, tz, { cast: false }); pointLight(TEAM, 4, tx, TH + 1.0, tz + 0.6, 3);

  // low control bunker (front right) with team-lit vision slits
  const bx = 2.7, bz = 3.0;
  box(2.8, 1.2, 1.8, M.concrete, bx, 0, bz); ao(bx, bz, 2.8, 1.8, 0.5);
  box(2.9, 0.25, 1.9, olive, bx, 1.2, bz, { dirt: 0 });
  for (const dx of [-0.8, 0, 0.8]) { box(0.55, 0.12, 0.05, M.dark, bx + dx, 0.75, bz + 0.91, { dirt: 0 }); box(0.45, 0.04, 0.04, glow, bx + dx, 0.79, bz + 0.94, { cast: false }); }
  box(0.06, 1.2, 0.06, M.steel, bx + 1.1, 1.45, bz - 0.5, { dirt: 0 });
  box(1.6, 0.02, 0.3, M.hazard, -2.8, 0, 3.4, { dirt: 0, cast: false }); box(1.6, 0.02, 0.3, M.hazard, -2.8, 0, 2.8, { dirt: 0, cast: false });

  // ================================================================ power layer (lights and electricity)
  const P = power(L), nc = { dirt: 0, cast: false };
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  function flood(x, y, z, h, ry, tilt = 0.12, reach = 1.4) {
    cyl(0.04, h, P.steelD, x, y, z, { seg: 10, dirt: 0.2 });
    const g = group(x, y + h, z, ry), t = new THREE.Group(); t.rotation.x = tilt; g.add(t);
    box(0.4, 0.25, 0.18, P.steel, 0, -0.125, 0.03, { parent: t, dirt: 0 });
    box(0.34, 0.19, 0.03, P.white, 0, -0.095, 0.13, { parent: t, ...nc });
    pointLight('#fff1d6', 4 * NB, x + Math.sin(ry) * reach, y + h - 0.9, z + Math.cos(ry) * reach, 5);
  }
  // team strip round the collar's outer lip, white lamps on four guard blocks
  hoop(2.69, 0.03, P.glow, sx, 0.5, sz, { cast: false });
  for (let k = 1; k < 8; k += 2) { const a = k * Math.PI / 4; box(0.14, 0.06, 0.14, P.white, sx + Math.cos(a) * 2.1, 0.73, sz + Math.sin(a) * 2.1, nc); }
  // blast door: team strips inside both rails, a strip on the door's lifting bar
  for (const x of [1.75 + 0.13, 3.75 - 0.13]) P.strip(3.9, x, 0.04, sz - 0.9, Math.PI / 2, 0.05);
  P.strip(1.1, 2.75, 0.74, sz + 0.26, 0, 0.05);
  // umbilical tower: team strip up the front-right leg and round the platform, lit cab, amber corner beacons
  box(0.05, TH - 0.5, 0.05, P.glow, tx + 0.53, 0.4, tz + 0.53, nc);
  P.strip(1.2, tx, TH + 0.07, tz + 0.62, 0, 0.05); P.strip(1.2, tx + 0.62, TH + 0.07, tz, Math.PI / 2, 0.05);
  P.windows(0.72, 0.2, tx, TH + 0.45, tz + 0.46, 0, 3); P.windows(0.72, 0.2, tx + 0.46, TH + 0.45, tz, Math.PI / 2, 3);
  for (const s of [-1, 1]) P.beacon(tx + s * 0.42, TH + 0.94, tz + 0.42, '#ffb347');
  flood(tx + 0.5, TH + 0.18, tz + 0.5, 0.25, 0.84, 0.55, 2.2);            // floodlight on the platform, aimed down at the missile
  // transformer yard at the front left, cabled up the tower; its junction box feeds a conduit onto the collar
  const ux = -3.55, uz = 1.75;
  box(1.25, 0.03, 1.05, P.dark, ux, 0, uz, nc);
  for (const [w, d, x, z] of [[1.25, 0.08, ux, uz - 0.52], [1.25, 0.08, ux, uz + 0.52], [0.08, 1.05, ux - 0.62, uz], [0.08, 1.05, ux + 0.62, uz]]) box(w, 0.04, d, M.hazard, x, 0, z, nc);
  P.transformer(ux, uz, 0); ao(ux, uz, 1.0, 0.8, 0.35);
  box(0.12, 0.2, 0.2, P.steelD, tx - 0.5, 2.3, tz + 0.45, { dirt: 0 });
  P.cable([ux - 0.28, 1.2, uz], [tx - 0.5, 2.45, tz + 0.45], 0.45, 12);
  P.junction(-2.45, 2.2, 0);
  P.conduit([[ux + 0.45, 0.35, uz + 0.3], [-2.95, 0.35, uz + 0.3], [-2.95, 0.35, 2.2], [-2.73, 0.35, 2.2]], 0.045);
  P.conduit([[-2.45, 0.45, 2.0], [-2.45, 0.45, 1.75], [-2.22, 0.45, 1.72], [-2.22, 0.62, 1.72], [-2.05, 0.62, 1.5]], 0.05);
  // control bunker: the old ground pipe becomes a conduit with glowing collars; team strip on the roof edge,
  // a status panel, a beacon on the mast
  P.conduit([[bx - 1.4, 0.25, bz - 0.4], [sx + 1.2, 0.25, bz - 0.4], [sx + 1.2, 0.25, sz + 2.6]], 0.08);
  P.strip(2.9, bx, 1.45, bz + 0.96, 0, 0.06); P.strip(1.9, bx - 1.46, 1.45, bz, Math.PI / 2, 0.06);
  box(0.5, 0.3, 0.4, P.steel, bx - 0.6, 1.45, bz - 0.3, { dirt: 0.3 }); box(0.08, 0.06, 0.03, P.green, bx - 0.7, 1.62, bz - 0.09, nc); box(0.08, 0.06, 0.03, P.amber, bx - 0.55, 1.62, bz - 0.09, nc);
  P.beacon(bx + 1.1, 2.72, bz - 0.5);
  pointLight(TEAM, 2.5 * NB, bx, 1.0, bz + 1.6, 3);
  // pole floodlight at the back right, lighting the blast door and the silo
  flood(4.1, 0, -4.1, 2.3, -0.75);
  P.beacon(4.1, 2.62, -4.1, '#ffb347');
}
