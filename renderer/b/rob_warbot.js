// Warbot, the "Lancer": a sleek wedge-hulled robot-tank on tracks half-hidden by side skirts, a low turret set well
// back carrying a long railgun (twin rails with glowing coil rings), a nose sensor strip and a small radar mast.
// Faces +x (east). (Chosen from the design studies rob_tank_a/b.js.)
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(937);
  const R = kit(L, 16, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), rail = M.plain('#23272b', 0.4, 0.7), seam = M.plain('#101214', 0.8);
  // tracks, set wide, mostly under the side skirts
  for (const y of [-60, 60]) track(-84, 84, y, 28, 0.4, { pitch: 0.31 });
  for (const s of [-1, 1]) {
    ext(poly(s < 0 ? [[90, -52], [76, -64], [-80, -64], [-94, -58], [-94, -50]] : [[90, 52], [76, 64], [-80, 64], [-94, 58], [-94, 50]]), 0.5, 0.48, armor, { bevel: 0.06 }); // skirt over the inner half
    strip(-76, s * 60, 64, s * 60, 3, 0.99, 0.02, glow);
  }
  // the wedge hull: a pointed nose, sloping plates
  ext(poly([[104, 0], [70, -46], [-88, -48], [-100, -36], [-100, 36], [-88, 48], [70, 46]]), 0.34, 0.66, armor, { bevel: 0.08 });
  ext(poly([[98, 0], [68, -38], [30, -38], [30, 38], [68, 38]]), 1.0, 0.08, top, { bevel: 0.03 });
  for (const [a, b, c, d] of [[98, 0, 30, 0], [30, -38, 30, 38]]) strip(a, b, c, d, 2, 1.09, 0.01, seam);
  grime(-94, -46, 196, 92, 1.01, 0.8, 41);
  // sensor strip across the nose: a long glowing slit
  ext(poly([[86, -14], [92, -6], [92, 6], [86, 14], [82, 12], [86, 4], [86, -4], [82, -12]]), 1.02, 0.12, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  // rear deck vents and lights
  rect(-96, -30, 30, 60, 1.0, 0.04, dark, { dirt: 0 });
  for (const y of [-26, -16, -6, 4, 14, 24]) rect(-93, y, 24, 4, 1.04, 0.01, black, { dirt: 0, cast: false });
  for (const y of [-40, 32]) rect(-103, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-102, -30, 5, 7, 0.72); brake(-102, 23, 5, 7, 0.72);
  // low turret, set well back
  ext(poly([[24, -18], [10, -34], [-46, -34], [-56, -22], [-56, 22], [-46, 34], [10, 34], [24, 18]]), 1.06, 0.42, top, { bevel: 0.08 });
  ext(rr(-44, -24, 50, 48, 8), 1.48, 0.06, roof, { bevel: 0.02 });
  // the railgun: twin rails with coil rings, a breech block, and a glowing tip
  rect(14, -16, 22, 32, 1.14, 0.36, rail, { dirt: 0 });
  for (const s of [-1, 1]) L.box(98 * k, 0.12, 5 * k, steel, (36 + 49) * k, 1.38, s * 7 * k, R.O({ dirt: 0 }));
  L.box(98 * k, 0.06, 6 * k, rail, (36 + 49) * k, 1.34, 0, R.O({ dirt: 0 }));
  for (const x of [48, 62, 76, 90, 104]) L.box(4 * k, 0.24, 20 * k, glow, x * k, 1.3, 0, R.O({ dirt: 0, cast: false }));
  L.box(5 * k, 0.16, 18 * k, eye(TEAM, 2.2, 0.5), 134 * k, 1.36, 0, R.O({ dirt: 0, cast: false }));
  // radar mast with a small dish
  L.cyl(1.6 * k, 0.4, M.plain('#15171a', 0.6, 0.5), -36 * k, 1.54, -22 * k, R.O({ dirt: 0 }));
  ext(rr(-46, -32, 20, 8, 3), 1.94, 0.05, M.plain('#c9cdd1', 0.4, 0.3), { bevel: 0.01 });
  disc(-36, -22, 3, 1.99, 0.04, eye(TEAM, 1, 0.3), { cast: false });
  disc(-20, 16, 8, 1.54, 0.05, M.plain('#2d3236', 0.55, 0.5)); L.hoop(8 * k, 0.02, steel, -20 * k, 1.59, 16 * k, R.O());
  R.finish();
}
