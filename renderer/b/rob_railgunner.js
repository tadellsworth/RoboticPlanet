// Railgunner, "Lancer" family: a slow long-range gun robot. A heavy tracked chassis, a stabiliser spade folded at the
// tail, and set well back on a low turret a long open rail: two heavy parallel rails held by a row of glowing coil
// clamps (team colour), a breech block with two big capacitor drums either side, and a muzzle brace at the very end
// with a lit muzzle. A rangefinder sight on the turret's side and a sensor slit in the nose.
// Faces +x (east), top-down. Mark: muzzle.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(3301);
  const R = kit(L, 12, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye, hazard } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), rail = M.plain('#2a2f34', 0.35, 0.8), seam = M.plain('#101214', 0.8);
  // heavy tracks
  for (const y of [-56, 56]) track(-92, 52, y, 30, 0.44, { pitch: 0.31 });
  for (const s of [-1, 1]) {
    ext(poly(s < 0 ? [[58, -46], [46, -62], [-86, -62], [-98, -56], [-98, -46]] : [[58, 46], [46, 62], [-86, 62], [-98, 56], [-98, 46]]), 0.52, 0.5, armor, { bevel: 0.06 });
    strip(-84, s * 56, 40, s * 56, 3, 1.03, 0.02, glow);
  }
  // the chassis: a long low wedge
  ext(poly([[70, 0], [52, -44], [-90, -46], [-104, -34], [-104, 34], [-90, 46], [52, 44]]), 0.34, 0.66, armor, { bevel: 0.08 });
  ext(rr(-96, -38, 140, 76, 8), 1.0, 0.05, top, { bevel: 0.02 });
  grime(-100, -44, 170, 88, 1.06, 0.85, 87);
  ext(poly([[62, -10], [66, -4], [66, 4], [62, 10], [58, 8], [61, 3], [61, -3], [58, -8]]), 1.02, 0.08, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  // stabiliser spade folded at the tail, hazard-striped
  ext(poly([[-100, -24], [-110, -30], [-113, -24], [-113, 24], [-110, 30], [-100, 24]]), 0.4, 0.2, dark, { bevel: 0.03 });
  rect(-112, -18, 5, 36, 0.6, 0.02, hazard('#f0a030'), { dirt: 0.2 });
  // the turret, set back, with the breech and its two capacitor drums
  ext(poly([[-6, -26], [-20, -36], [-62, -36], [-72, -24], [-72, 24], [-62, 36], [-20, 36], [-6, 26]]), 1.06, 0.4, top, { bevel: 0.07 });
  ext(rr(-60, -24, 44, 48, 7), 1.46, 0.05, roof, { bevel: 0.02 });
  for (const s of [-1, 1]) {
    L.hcyl(11 * k, 40 * k, M.plain('#2c3036', 0.5, 0.6), -36 * k, 1.66, s * 30 * k, R.O({ axis: 'x', seg: 28, dirt: 0.2 }));
    for (const x of [-50, -36, -22]) L.hcyl(11.8 * k, 2.5 * k, glow, x * k, 1.66, s * 30 * k, R.O({ axis: 'x', seg: 28, cast: false }));
  }
  rect(-14, -16, 30, 32, 1.12, 0.42, rail, { dirt: 0 });                                  // breech block
  // the long open rail: two heavy rails, coil clamps between them, a muzzle brace at the end
  for (const s of [-1, 1]) L.box(118 * k, 0.16, 6 * k, steel, (16 + 59) * k, 1.36, s * 8 * k, R.O({ dirt: 0 }));
  L.box(118 * k, 0.05, 4 * k, black, (16 + 59) * k, 1.34, 0, R.O({ dirt: 0, cast: false }));
  for (const x of [30, 48, 66, 84, 102, 120]) {
    L.box(5 * k, 0.12, 24 * k, dark, x * k, 1.3, 0, R.O({ dirt: 0 }));
    L.box(2.5 * k, 0.14, 22 * k, glow, x * k, 1.32, 0, R.O({ dirt: 0, cast: false }));
  }
  L.box(9 * k, 0.24, 28 * k, rail, 131 * k, 1.26, 0, R.O({ dirt: 0 }));
  L.box(3 * k, 0.12, 9 * k, eye(TEAM, 2.4, 0.55), 136 * k, 1.38, 0, R.O({ dirt: 0, cast: false }));
  L.mark && L.mark('muzzle', 137 * k, 1.4, 0);
  // rangefinder sight on the turret's flank
  L.hcyl(5 * k, 22 * k, dark, -6 * k, 1.56, -40 * k, R.O({ axis: 'x', seg: 20, dirt: 0 }));
  disc(6, -40, 3.5, 1.53, 0.05, eye('#ff5b4a', 1.6, 0.35), { cast: false });
  // rear deck vents, lights, brake lenses
  for (const y of [-24, -14, -4, 6, 16]) rect(-98, y, 20, 4, 1.06, 0.01, black, { dirt: 0, cast: false });
  for (const y of [-42, 34]) rect(-106, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-106, -34, 5, 6, 0.72); brake(-106, 28, 5, 6, 0.72);
  R.finish();
}
