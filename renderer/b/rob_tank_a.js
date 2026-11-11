// Warbot design study A, "Sentinel": a classic battle-tank silhouette as a robot. Two full-length tracks under
// fenders, a low hull with a sloped glacis, a round turret set back, one long main gun with a muzzle brake, a
// glowing visor slit (its "eye") across the turret brow, a sensor dome and an aerial. Faces +x (east).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(911);
  const R = kit(L, 14, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#353b41'), top = M.paint('#4a5158'), roof = M.paint('#58606a', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#5d646b', 0.35, 0.8), gun = M.plain('#2b3035', 0.45, 0.7), seam = M.plain('#101214', 0.8);
  // tracks, full length, under armoured fenders
  for (const y of [-64, 64]) track(-90, 90, y, 32, 0.42, { pitch: 0.3 });
  for (const s of [-1, 1]) {
    // a narrow fender over the inner edge of each track, so the treads show
    ext(rr(-94, s < 0 ? -56 : 44, 188, 12, 4), 0.9, 0.1, armor, { bevel: 0.03 });
    strip(-84, s * 50, 74, s * 50, 3, 1.0, 0.02, glow); // team running light along each fender
    for (const x of [-60, -20, 20, 60]) disc(x, s * 64, 7, 0.9, 0.04, M.plain('#33373c', 0.5, 0.6)); // road-wheel hubs through the track
  }
  // hull: low, with a sloped glacis at the nose
  ext(poly([[98, -24], [82, -44], [-86, -46], [-98, -34], [-98, 34], [-86, 46], [82, 44], [98, 24]]), 0.32, 0.72, armor, { bevel: 0.08 });
  ext(poly([[96, -20], [80, -38], [52, -38], [52, 38], [80, 38], [96, 20]]), 1.04, 0.08, top, { bevel: 0.03 });
  for (const [a, b, c, d] of [[52, -38, 52, 38], [80, -38, 96, -20], [80, 38, 96, 20]]) strip(a, b, c, d, 2, 1.13, 0.01, seam);
  grime(-90, -44, 186, 88, 1.05, 0.8, 23);
  // engine deck at the rear: grille slats and two exhaust ports
  rect(-92, -32, 34, 64, 1.04, 0.04, dark, { dirt: 0 });
  for (const y of [-28, -18, -8, 2, 12, 22]) rect(-89, y, 28, 5, 1.08, 0.01, black, { dirt: 0, cast: false });
  for (const s of [-1, 1]) disc(-100, s * 24, 5, 0.6, 0.35, M.plain('#2a2d31', 0.5, 0.6));
  for (const y of [-38, 30]) rect(-101, y, 4, 8, 0.6, 0.3, glow, { dirt: 0, cast: false });
  brake(-100, -44, 5, 7, 0.8); brake(-100, 37, 5, 7, 0.8);
  // the turret: a rounded octagon set back on the hull
  const T = (cx, r) => { const p = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; p.push([cx + Math.cos(a) * r * (Math.cos(a) > 0 ? 1.12 : 1), Math.sin(a) * r]); } return poly(p); };
  ext(T(-12, 44), 1.1, 0.5, top, { bevel: 0.09 });
  L.hoop(44 * k, 0.03, glow, -12 * k, 1.36, 0, R.O({ cast: false })); // team band round the turret ring
  ext(rr(-42, -24, 44, 48, 10), 1.6, 0.06, roof, { bevel: 0.02 });
  // the visor: a glowing slit across the turret brow, its "eye"
  ext(poly([[30, -22], [36, -10], [36, 10], [30, 22], [25, 20], [30, 8], [30, -8], [25, -20]]), 1.42, 0.2, eye(TEAM, 1.4, 0.35), { bevel: 0.01, cast: false });
  // mantlet and the long main gun with a muzzle brake
  rect(30, -13, 16, 26, 1.2, 0.42, gun, { dirt: 0 });
  L.hcyl(8 * k, 76 * k, steel, (46 + 38) * k, 1.44, 0, R.O({ axis: 'x', dirt: 0 }));
  L.hcyl(8.5 * k, 10 * k, gun, 66 * k, 1.44, 0, R.O({ axis: 'x', dirt: 0 })); // fume extractor
  rect(118, -10, 12, 20, 1.3, 0.28, gun, { dirt: 0 });
  for (const x of [121, 126]) rect(x, -10, 2, 20, 1.585, 0.01, black, { dirt: 0, cast: false });
  // sensor dome with a lens, hatch, aerial
  L.sphere(10 * k, M.plain('#262a2f', 0.4, 0.5), -30 * k, 1.66, -18 * k, R.O({ dome: true, dirt: 0 }));
  disc(-24, -18, 4, 1.68, 0.1, eye(TEAM, 1.2, 0.3), { cast: false });
  disc(-24, 14, 9, 1.66, 0.05, M.plain('#2d3236', 0.55, 0.5)); L.hoop(9 * k, 0.02, steel, -24 * k, 1.71, 14 * k, R.O());
  L.cyl(1.2 * k, 0.5, M.plain('#15171a', 0.6, 0.5), -48 * k, 1.66, 20 * k, R.O({ dirt: 0 }));
  L.sphere(2.6 * k, glow, -48 * k, 2.18, 20 * k, R.O({ dirt: 0, cast: false }));
  R.finish();
}
