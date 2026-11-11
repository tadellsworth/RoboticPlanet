// Warbot design study B, "Brawler": a robot-tank on four independent track pods (like legs ending in treads), a
// hexagonal chassis, a boxy turret with twin short heavy cannons, a "face" of two glowing eyes, and a rocket pod
// on its shoulder. Faces +x (east).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(923);
  const R = kit(L, 12, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#343a40'), top = M.paint('#4b5259'), roof = M.paint('#5a626b', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#5d646b', 0.35, 0.8), gun = M.plain('#2b3035', 0.45, 0.7), joint = M.plain('#6c737a', 0.3, 0.85);
  // four track pods at the corners, each on a hip joint
  for (const [x0, x1] of [[28, 92], [-90, -26]]) for (const s of [-1, 1]) {
    track(x0, x1, s * 64, 28, 0.38, { pitch: 0.29 });
    ext(rr(x0 + 4, s < 0 ? -58 : 48, x1 - x0 - 8, 10, 4), 0.82, 0.1, armor, { bevel: 0.03 }); // pod frame over the inner edge
    strip(x0 + 8, s * 53, x1 - 8, s * 53, 3, 0.93, 0.02, glow);
    const jx = (x0 + x1) / 2;
    rect(jx - 9, s < 0 ? -50 : 38, 18, 12, 0.6, 0.35, M.plain('#2a2e33', 0.5, 0.6), { dirt: 0 }); // the strut
    disc(jx, s * 44, 9, 0.7, 0.42, joint); L.hoop(9 * k, 0.02, M.plain('#202326', 0.6, 0.5), jx * k, 1.12, s * 44 * k, R.O());
  }
  // hexagonal chassis
  ext(poly([[88, 0], [66, -40], [-70, -40], [-92, 0], [-70, 40], [66, 40]]), 0.4, 0.68, armor, { bevel: 0.08 });
  grime(-86, -38, 170, 76, 1.09, 0.8, 31);
  rect(-86, -22, 22, 44, 1.08, 0.04, dark, { dirt: 0 });
  for (const y of [-18, -9, 0, 9]) rect(-84, y, 18, 5, 1.12, 0.01, black, { dirt: 0, cast: false });
  for (const y of [-26, 18]) rect(-95, y, 4, 8, 0.6, 0.3, glow, { dirt: 0, cast: false });
  brake(-94, -36, 5, 7, 0.7); brake(-94, 29, 5, 7, 0.7);
  // the turret: a wide box with a raised roof, rocket pod on the left shoulder
  ext(rr(-40, -30, 76, 60, 9), 1.08, 0.48, top, { bevel: 0.08 });
  ext(rr(-30, -22, 52, 44, 7), 1.56, 0.07, roof, { bevel: 0.02 });
  ext(rr(-30, -50, 40, 22, 4), 1.2, 0.36, M.paint('#3e444a', { rivets: false }), { bevel: 0.04 });
  for (const [x, y] of [[-22, -44], [-12, -44], [-2, -44], [-22, -34], [-12, -34], [-2, -34]]) disc(x, y, 3.6, 1.56, 0.02, black, { cast: false });
  // the face: two glowing eyes on the brow
  for (const s of [-1, 1]) {
    disc(30, s * 14, 7, 1.3, 0.3, M.plain('#121417', 0.5, 0.5));
    disc(32, s * 14, 5, 1.6, 0.03, eye(TEAM, 1.6, 0.4), { cast: false });
  }
  // twin short heavy cannons
  for (const s of [-1, 1]) {
    rect(32, s * 22 - 7, 14, 14, 1.22, 0.36, gun, { dirt: 0 });
    L.hcyl(6 * k, 62 * k, steel, (46 + 31) * k, 1.4, s * 22 * k, R.O({ axis: 'x', dirt: 0 }));
    rect(100, s * 22 - 8, 12, 16, 1.28, 0.26, gun, { dirt: 0 });
    rect(109, s * 22 - 8, 2, 16, 1.545, 0.01, black, { dirt: 0, cast: false });
    L.hcyl(6.8 * k, 4 * k, glow, 70 * k, 1.4, s * 22 * k, R.O({ axis: 'x', dirt: 0, cast: false }));
  }
  // a little antenna mast at the back of the turret
  L.cyl(1.2 * k, 0.45, M.plain('#15171a', 0.6, 0.5), -34 * k, 1.63, 22 * k, R.O({ dirt: 0 }));
  L.sphere(2.4 * k, glow, -34 * k, 2.1, 22 * k, R.O({ dirt: 0, cast: false }));
  R.finish();
}
