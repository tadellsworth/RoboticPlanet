// OLD warbot (twin side guns, replaced by the "Lancer" robot-tank in rob_warbot.js), top-down 3D, matching the reference sprite (old SVG px coordinates; bounding box centre at x = 10.5).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(705);
  const R = kit(L, 10.5, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime } = R, k = R.k;
  const armor = M.paint('#30353a'), top = M.paint('#454b51'), dark = M.plain('#191b1e', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const line = M.plain('#0f1113', 0.8);
  for (const y of [-72, 72]) track(-90, 16, y, 24, 0.4, { pitch: 0.31 });
  // armoured hull and raised top deck
  ext(poly([[100, 0], [42, -30], [8, -70], [-70, -72], [-94, -52], [-94, 52], [-70, 72], [8, 70], [42, 30]]), 0.3, 0.85, armor, { bevel: 0.1 });
  for (const [a, b, c, d] of [[42, -30, 0, -20], [42, 30, 0, 20], [8, -70, -8, -48], [8, 70, -8, 48], [-70, -72, -60, -50], [-70, 72, -60, 50], [-94, -52, -78, -34], [-94, 52, -78, 34]]) strip(a, b, c, d, 2.2, 1.15, 0.01, line);
  ext(poly([[72, 0], [28, -22], [-2, -48], [-58, -50], [-78, -34], [-78, 34], [-58, 50], [-2, 48], [28, 22]]), 1.15, 0.35, top, { bevel: 0.07 });
  grime(-80, -52, 152, 104, 1.5, 0.7, 19);
  for (const [a, b, c, d] of [[-2, -48, -26, -14], [-26, -14, -26, 14], [-26, 14, -2, 48], [28, -22, -26, -14], [28, 22, -26, 14]]) strip(a, b, c, d, 2, 1.5, 0.01, M.plain('#111315', 0.8));
  rect(-68, -26, 32, 52, 1.5, 0.04, dark, { dirt: 0 });
  for (const y of [-22, -13, -4, 5, 14]) rect(-65, y, 26, 4, 1.54, 0.01, black, { dirt: 0, cast: false });
  disc(-14, -32, 4.5, 1.5, 0.06, M.plain('#22262a', 0.6, 0.4)); L.hoop(4.5 * k, 0.025, M.plain('#6d757c', 0.5, 0.6), -14 * k, 1.56, -32 * k, R.O());
  // team chevron, edge lines and rear lights
  ext(poly([[60, 0], [36, -15], [30, -11], [50, 0], [30, 11], [36, 15]]), 1.5, 0.04, glow, { bevel: 0.01, cast: false });
  for (const [a, b, c, d] of [[88, -3, 46, -25], [88, 3, 46, 25], [-6, -63, -62, -65], [-6, 63, -62, 65]]) strip(a, b, c, d, 2.6, 1.155, 0.03, glow);
  for (const y of [-30, 14]) rect(-97, y, 4, 16, 0.5, 0.5, glow, { dirt: 0, cast: false });
  brake(-93, -48, 6, 8, 1.15); brake(-93, 40, 6, 8, 1.15);
  // twin guns on armoured mounts
  for (const s of [-1, 1]) {
    const y0 = s < 0 ? -49 : 23;
    ext(rr(-10, y0, 50, 26, 6), 1.5, 0.35, M.paint('#363b41', { rivets: false }), { bevel: 0.05 });
    ext(rr(-4, s < 0 ? -44 : 28, 14, 16, 2), 1.85, 0.1, M.plain('#1d2023', 0.6, 0.4), { bevel: 0.02 });
    L.hcyl(6 * k, 70 * k, M.plain('#5a6168', 0.35, 0.8), 73 * k, 1.68, s * 36 * k, R.O({ axis: 'x', dirt: 0 }));
    rect(102, s * 36 - 8, 16, 16, 1.45, 0.46, M.plain('#2a2e33', 0.6, 0.5), { dirt: 0 });
    for (const x of [107, 112]) rect(x - 1, s * 36 - 8, 2, 16, 1.915, 0.01, black, { dirt: 0, cast: false });
    for (const x of [64, 76]) L.hcyl(6.6 * k, 4 * k, glow, x * k, 1.68, s * 36 * k, R.O({ axis: 'x', dirt: 0, cast: false }));
  }
  R.finish();
}
