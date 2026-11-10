// Missile Silo: armoured silo collar with the missile rising out of the open hatch, slid-back blast door,
// umbilical tower with swing arm, low control bunker; team-colour rim lights and beacon.
import { missile } from './missile.js';
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
  pipe([[bx - 1.4, 0.25, bz - 0.4], [sx + 1.2, 0.25, bz - 0.4], [sx + 1.2, 0.25, sz + 2.6]], 0.08, M.dark);
  box(1.6, 0.02, 0.3, M.hazard, -2.8, 0, 3.4, { dirt: 0, cast: false }); box(1.6, 0.02, 0.3, M.hazard, -2.8, 0, 2.8, { dirt: 0, cast: false });
}
