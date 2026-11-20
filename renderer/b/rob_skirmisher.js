// Skirmisher, "Lancer" family: a fast, light raider. A narrow arrowhead body slung low between four big all-terrain
// tyres on swing arms, team light strips along its flanks, a small swivel mount with twin short autoguns, a sensor
// slit in the nose, and two dash thrusters at the tail glowing team colour. Lighter and leaner than the Warbot.
// Faces +x (east), top-down. Mark: thrusters.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(5171);
  const R = kit(L, 4, 0), { rect, rr, poly, ext, disc, strip, tyre, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), arm = M.plain('#2b2f34', 0.55, 0.6);
  // four big tyres on swing arms, set wide at the corners
  for (const [x, y] of [[52, -50], [52, 50], [-50, -50], [-50, 50]]) {
    tyre(x, y, 22, 20, { blocks: 18 });
    L.beam([x * k, 0.62, Math.sign(y) * 30 * k], [x * k, 0.62, y * k], 8 * k, 0.14, arm, R.O({ dirt: 0 }));
  }
  // the arrowhead body: a long pointed nose, swept flanks, a tail block for the thrusters
  ext(poly([[100, 0], [58, -26], [-58, -30], [-78, -24], [-78, 24], [-58, 30], [58, 26]]), 0.42, 0.52, armor, { bevel: 0.07 });
  ext(poly([[92, 0], [56, -18], [-20, -20], [-20, 20], [56, 18]]), 0.94, 0.07, top, { bevel: 0.025 });
  for (const s of [-1, 1]) {
    strip(-54, s * 28, 54, s * 24, 3, 0.95, 0.02, glow);     // team light strip along each flank
    ext(poly([[-30, s * 30], [-64, s * 30], [-74, s * 44], [-46, s * 40]]), 0.5, 0.18, top, { bevel: 0.03 }); // tail fins
  }
  strip(92, 0, -20, 0, 2, 1.02, 0.01, seam);
  grime(-76, -28, 168, 56, 0.95, 0.7, 29);
  // nose sensor slit
  ext(poly([[84, -9], [90, -3], [90, 3], [84, 9], [81, 7], [84, 2], [84, -2], [81, -7]]), 0.96, 0.08, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  // the swivel mount and its twin short autoguns
  disc(18, 0, 15, 0.98, 0.22, top, { seg: 36 });
  ext(rr(6, -11, 24, 22, 5), 1.2, 0.08, roof, { bevel: 0.02 });
  for (const s of [-1, 1]) {
    L.box(46 * k, 0.09, 4.5 * k, steel, (28 + 23) * k, 1.14, s * 6 * k, R.O({ dirt: 0 }));
    L.box(8 * k, 0.12, 6 * k, dark, 30 * k, 1.12, s * 6 * k, R.O({ dirt: 0 }));
    L.box(3 * k, 0.08, 4 * k, eye(TEAM, 1.4, 0.35), 74 * k, 1.15, s * 6 * k, R.O({ dirt: 0, cast: false }));
  }
  // dash thrusters: two nozzles in the tail, glowing team colour
  rect(-82, -22, 16, 44, 0.86, 0.14, dark, { dirt: 0 });
  for (const s of [-1, 1]) {
    L.hcyl(9 * k, 14 * k, M.plain('#3b3f44', 0.45, 0.6), -84 * k, 0.78, s * 12 * k, R.O({ axis: 'x', seg: 24, dirt: 0 }));
    disc(-91, s * 12, 6, 0.74, 0.1, eye(TEAM, 2.0, 0.5), { cast: false });
  }
  L.mark && L.mark('thrusters', -92 * k, 0.8, 0);
  // rear vents and lights, brake lenses
  for (const y of [-14, -6, 2, 10]) rect(-62, y, 18, 3, 0.95, 0.01, black, { dirt: 0, cast: false });
  for (const y of [-34, 26]) rect(-80, y, 4, 8, 0.5, 0.26, glow, { dirt: 0, cast: false });
  brake(-80, -28, 4, 6, 0.66); brake(-80, 22, 4, 6, 0.66);
  R.finish();
}
