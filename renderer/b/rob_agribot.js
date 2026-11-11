// Agribot, "Lancer" line: the farm robot restyled to match the Lancer worker and hauler. A low chamfered gunmetal hull on
// two narrow rubber tracks half-hidden by side skirts carrying team running lights; at the rear the big domed seed hopper
// (its job: sage work paint, dark ribs, a window onto the glowing seed), at the front a wedge cab with a sage roof and the
// glowing sensor slit, the planting arm folded over the cab's right shoulder, the green farm lights at the corners.
// Faces +x (east). Old SVG px coordinates (bounding box centre at x = 5), as b/rob_agribot.js: tracks, brake lenses and
// footprint unchanged.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(703);
  const R = kit(L, 5, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e');
  const sage = M.paint('#949c86', { rivets: false });                    // the agribot's work paint
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8);
  const green = (() => { const m = M.emit('#6fd36a', 0.7).clone(); m.userData.glow = '#3a7a36'; return m; })();
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  // two narrow rubber tracks, the inner part under armoured skirts with team running lights
  for (const y of [-74, 74]) track(-84, 84, y, 18, 0.32, { pitch: 0.26 });
  for (const s of [-1, 1]) {
    ext(poly(mir([[82, 58], [74, 72], [-78, 72], [-87, 66], [-87, 58]], s)), 0.42, 0.5, armor, { bevel: 0.05 });
    strip(-74, s * 68.5, 68, s * 68.5, 3, 0.93, 0.02, glow);
    for (const x of [-30, 22]) strip(x, s * 70, x, s * 72, 1.5, 0.92, 0.01, seam);
  }
  // hull: low and chamfered
  ext(poly([[84, -30], [76, -60], [-78, -62], [-88, -52], [-88, 52], [-78, 62], [76, 60], [84, 30]]), 0.35, 0.78, armor, { bevel: 0.08 });
  grime(-88, -62, 172, 124, 1.14, 0.8, 13);
  // seed hitch and spreader chute at the tail
  rect(-88, -10, 9, 20, 0.6, 0.62, dark, { dirt: 0 });
  for (const y of [-6, 0, 6]) rect(-87, y - 1, 7, 2, 1.22, 0.01, black, { dirt: 0, cast: false });
  // the domed seed hopper: sage shell, dark ribs, a rim, a window onto the seed
  const DR = 48 * k, DH = 0.46, dcx = -34, y0d = 1.13, dome = (x, y) => { const r = Math.hypot(x - dcx, y) * k; return y0d + DH * Math.sqrt(Math.max(0, 1 - (r / DR) ** 2)); };
  const dg = new THREE.SphereGeometry(DR, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); dg.scale(1, DH / DR, 1);
  L.mesh(dg, sage, dcx * k, y0d, 0, R.O({ dirt: 0.15, dirtH: 0.4 }));
  L.hoop(48 * k, 0.07, top, dcx * k, y0d + 0.02, 0, R.O());
  const ribs = [[0, -17, 0, -44], [0, 17, 0, 44], [-17, 0, -44, 0], [17, 0, 44, 0], [-12, -12, -31, -31], [12, -12, 31, -31], [-12, 12, -31, 31], [12, 12, 31, 31]];
  for (const [a, b, c, d] of ribs) for (let i = 0; i < 3; i++) {
    const x1 = dcx + a + (c - a) * i / 3, y1 = b + (d - b) * i / 3, x2 = dcx + a + (c - a) * (i + 1) / 3, y2 = b + (d - b) * (i + 1) / 3;
    R.beamL([x1 * k, dome(x1, y1) + 0.01, y1 * k], [x2 * k, dome(x2, y2) + 0.01, y2 * k], 3 * k, 0.05, M.plain('#4b5146', 0.7, 0.2));
  }
  disc(-34, 0, 15.5, 1.5, 0.12, M.plain('#22262a', 0.6, 0.3)); disc(-34, 0, 12.5, 1.62, 0.02, M.plain('#12301a', 0.45, 0.2));
  for (const [x, y, r] of [[-38, -4, 3.6], [-29, 3, 3.5], [-37, 6, 3.1], [-28, -6, 3]]) disc(x, y, r, 1.63, 0.02, green, { cast: false });
  // the cab: a wedge with a sage roof, a darker brow and the sensor slit
  ext(poly([[90, -20], [80, -46], [20, -48], [15, -42], [15, 42], [20, 48], [80, 46], [90, 20]]), 0.9, 0.62, armor, { bevel: 0.08 });
  ext(poly([[64, -34], [58, -40], [20, -40], [20, 40], [58, 40], [64, 34]]), 1.5, 0.08, sage, { bevel: 0.03 });
  ext(poly([[86, -17], [76, -38], [66, -38], [66, 38], [76, 38], [86, 17]]), 1.5, 0.06, top, { bevel: 0.02 });
  for (const [a, b, c, d] of [[66, -38, 66, 38], [40, -38, 40, 38]]) strip(a, b, c, d, 2, 1.59, 0.01, seam);
  grime(15, -46, 75, 92, 1.59, 0.6, 7);
  ext(poly([[82, -19], [88, -7], [88, 7], [82, 19], [77, 17], [82, 5], [82, -5], [77, -17]]), 1.54, 0.1, eye(TEAM, 1.4, 0.36), { bevel: 0.01, cast: false });
  // roof: vents, an amber work beacon, a stub aerial with a team eye
  rect(23, -20, 10, 26, 1.58, 0.04, dark, { dirt: 0 });
  for (const y of [-16, -9, -2]) rect(25, y + 0.5, 6, 3.5, 1.62, 0.01, black, { dirt: 0, cast: false });
  disc(54, -28, 4.5, 1.58, 0.12, M.plain('#22262a', 0.6, 0.5)); disc(54, -28, 3, 1.7, 0.04, M.emit('#ffb340', 0.6), { cast: false });
  L.cyl(1.2 * k, 0.35, M.plain('#15171a', 0.6, 0.5), 32 * k, 1.58, -32 * k, R.O({ dirt: 0 }));
  disc(32, -32, 2.4, 1.93, 0.03, eye(TEAM, 1, 0.3), { cast: false });
  const arm = M.plain('#7a8288', 0.5, 0.6);
  // the planting arm folded over the right shoulder: turntable, boom, forearm, drill-and-claw head past the nose corner
  disc(38, 30, 9, 1.58, 0.2, dark); disc(38, 30, 5, 1.78, 0.04, steel);
  strip(38, 30, 66, 44, 9, 1.72, 0.16, arm, { cast: true }); strip(41, 36, 64, 47, 2.4, 1.885, 0.01, M.plain('#c5ccd0', 0.3, 0.8));
  disc(66, 44, 6.5, 1.66, 0.36, dark);
  strip(66, 44, 84, 30, 7.5, 1.86, 0.14, arm, { cast: true });
  rect(80, 22, 9, 16, 1.66, 0.36, M.plain('#3a3f44', 0.6, 0.5), { dirt: 0 });
  ext(R.poly([[89, 25.5], [97, 30], [89, 34.5]]), 1.76, 0.12, M.plain('#a8b0b5', 0.3, 0.8), { bevel: 0.02 });
  for (const s of [-1, 1]) { strip(85, 30 + s * 8, 90, 30 + s * 12, 2.6, 1.84, 0.05, M.plain('#8d959b', 0.4, 0.7)); strip(90, 30 + s * 12, 96, 30 + s * 10, 2.6, 1.84, 0.05, M.plain('#8d959b', 0.4, 0.7)); }
  // the green farm lights at the hull's corners, team lights and brake lenses at the tail
  for (const [x, y] of [[-78, -51], [-78, 51], [70, -53], [70, 53]]) { disc(x, y, 4.6, 1.1, 0.04, dark); disc(x, y, 3.4, 1.12, 0.05, green, { cast: false }); }
  for (const y of [-48, 40]) rect(-88, y, 2.5, 8, 0.5, 0.36, glow, { dirt: 0, cast: false });
  brake(-85, -34, 6, 8, 1.13); brake(-85, 26, 6, 8, 1.13);
  R.finish();
}
