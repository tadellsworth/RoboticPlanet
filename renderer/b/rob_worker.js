// Worker, "Lancer" line: the builder robot restyled to match the Lancer warbot. A low chamfered
// gunmetal hull on tracks half-hidden by side skirts with team running lights; at the front a wedge cab with a pale
// work-paint roof and a glowing sensor slit, behind it an open work deck with a folded manipulator arm, and a
// hazard-striped push blade at the nose and rail at the tail so it reads as civilian. Faces +x (east).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(702);
  const R = kit(L, 1, 0), { rect, rr, poly, ext, disc, strip, hazard, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const work = M.paint('#a7a397', { rivets: false });                    // the civilian work paint
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), haz = hazard('#dca83a');
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  // tracks, set wide, the inner part under side skirts
  for (const y of [-66, 66]) track(-94, 94, y, 34, 0.42, { pitch: 0.33 });
  for (const s of [-1, 1]) {
    ext(poly(mir([[88, 50], [76, 71], [-80, 71], [-92, 63], [-92, 50]], s)), 0.5, 0.48, armor, { bevel: 0.06 });
    strip(-74, s * 66, 66, s * 66, 3, 0.99, 0.02, glow);
  }
  // hull: low and chamfered
  ext(poly([[92, -26], [82, -50], [-84, -52], [-96, -42], [-96, 42], [-84, 52], [82, 50], [92, 26]]), 0.34, 0.66, armor, { bevel: 0.08 });
  grime(-94, -50, 186, 100, 1.01, 0.8, 11);
  // open work deck at the rear: dark floor, cross ribs, low side rails, hazard rail at the tail
  rect(-88, -42, 86, 84, 1.0, 0.03, M.plain('#1a1c1f', 0.9), { dirt: 0 });
  for (const x of [-80, -62, -44, -26]) rect(x, -40, 7, 80, 1.03, 0.05, M.plain('#32373c', 0.6, 0.4), { dirt: 0 });
  grime(-88, -42, 86, 84, 1.09, 0.7, 5);
  for (const s of [-1, 1]) ext(rr(-90, s < 0 ? -50 : 42, 92, 8, 2), 1.0, 0.2, top, { bevel: 0.03 });
  ext(rr(-96, -42, 8, 84, 2), 1.0, 0.22, haz, { bevel: 0.03 });
  // manipulator arm folded back over the deck: turntable, boom, forearm, gripper
  disc(-8, -26, 12, 1.03, 0.14, dark); disc(-8, -26, 8, 1.17, 0.05, roof);
  const arm = (x1, y1, x2, y2, w, y0, h, mat) => {
    const dx = (x2 - x1) * k, dz = (y2 - y1) * k, len = Math.hypot(dx, dz);
    return L.box(len, h, w * k, mat, (x1 + x2) / 2 * k, y0, (y1 + y2) / 2 * k, R.O({ ry: -Math.atan2(dz, dx), dirt: 0.3 }));
  };
  arm(-8, -26, -72, -18, 15, 1.2, 0.2, work);
  arm(-14, -34, -56, -29, 4, 1.42, 0.05, steel);                         // hydraulic ram along the boom
  disc(-72, -18, 9, 1.2, 0.22, dark); disc(-72, -18, 4, 1.42, 0.03, steel);
  arm(-72, -18, -32, 18, 11, 1.44, 0.16, work);
  strip(-12, -26, -66, -19, 1.6, 1.405, 0.01, seam); strip(-68, -14, -36, 15, 1.6, 1.605, 0.01, seam);
  disc(-32, 18, 7, 1.44, 0.2, dark);
  for (const s of [-1, 1]) { arm(-32, 18, -22, 18 + s * 9, 4, 1.46, 0.14, steel); arm(-22, 18 + s * 9, -14, 18 + s * 6, 3.5, 1.46, 0.14, steel); }
  // the cab: a wedge with a pale work-paint roof
  ext(poly([[90, -22], [78, -44], [8, -46], [2, -40], [2, 40], [8, 46], [78, 44], [90, 22]]), 0.9, 0.62, armor, { bevel: 0.08 });
  ext(poly([[64, -32], [58, -38], [14, -38], [14, 38], [58, 38], [64, 32]]), 1.52, 0.08, work, { bevel: 0.03 });
  ext(poly([[86, -18], [76, -38], [66, -38], [66, 38], [76, 38], [86, 18]]), 1.52, 0.06, top, { bevel: 0.02 });
  for (const [a, b, c, d] of [[66, -38, 66, 38], [36, -38, 36, 38]]) strip(a, b, c, d, 2, 1.61, 0.01, seam);
  grime(10, -42, 78, 84, 1.61, 0.6, 7);
  // sensor slit across the nose
  ext(poly([[82, -20], [88, -8], [88, 8], [82, 20], [77, 18], [82, 6], [82, -6], [77, -18]]), 1.56, 0.1, eye(TEAM, 1.4, 0.36), { bevel: 0.01, cast: false });
  // roof vents, a small amber work beacon and a stub aerial
  rect(16, -20, 10, 40, 1.6, 0.04, dark, { dirt: 0 });
  for (const y of [-16, -8, 0, 8]) rect(18, y + 0.5, 6, 3.5, 1.64, 0.01, black, { dirt: 0, cast: false });
  disc(42, -6, 7, 1.6, 0.04, M.plain('#5c5a53', 0.7, 0.2)); L.hoop(7 * k, 0.018, M.plain('#3a3833', 0.7), 42 * k, 1.64, -6 * k, R.O());
  disc(56, 28, 4.5, 1.6, 0.12, M.plain('#22262a', 0.6, 0.5)); disc(56, 28, 3, 1.72, 0.04, M.emit('#ffb340', 0.6), { cast: false });
  L.cyl(1.2 * k, 0.35, M.plain('#15171a', 0.6, 0.5), 30 * k, 1.6, -30 * k, R.O({ dirt: 0 }));
  disc(30, -30, 2.4, 1.95, 0.03, eye(TEAM, 1, 0.3), { cast: false });
  // hazard-striped push blade at the nose
  ext(poly([[100, -34], [96, -44], [88, -44], [88, 44], [96, 44], [100, 34]]), 0.4, 0.55, haz, { bevel: 0.03 });
  // rear team lights and brake lenses
  for (const y of [-40, 32]) rect(-99, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-98, -50, 6, 7, 1.08); brake(-98, 43, 6, 7, 1.08);
  R.finish();
}
