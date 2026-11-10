// Agribot, top-down 3D, matching the reference sprite (old SVG px coordinates; bounding box centre at x = 5).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(703);
  const R = kit(L, 5, 0), { rect, rr, shape, ext, disc, strip, track, brake, grime } = R, k = R.k;
  const body = M.paint('#7f8674'), domeM = M.paint('#8f9682', { rivets: false }), frame = M.paint('#3b4045', { rivets: false });
  const dark = M.plain('#2c302b', 0.7, 0.3), black = M.plain('#0c0d0c', 0.8), glow = M.emit(TEAM, 1.1), green = (() => { const m = M.emit('#6fd36a', 0.7).clone(); m.userData.glow = '#3a7a36'; return m; })();
  // two narrow rubber tracks with mud
  for (const y of [-74, 74]) track(-84, 84, y, 18, 0.32, { pitch: 0.26 });
  for (const y of [-68, 61]) ext(rr(-78, y, 156, 7, 3), 0.4, 0.5, frame, { bevel: 0.03 });
  // rounded body
  ext(rr(-88, -64, 164, 128, 52), 0.35, 0.85, body, { bevel: 0.1 });
  grime(-88, -64, 164, 128, 1.2, 0.9, 13);
  const seam = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = (1 - t) ** 3 * 8 + 3 * (1 - t) ** 2 * t * 20 + 3 * (1 - t) * t * t * 20 + t ** 3 * 8, y = -58 + 116 * t; seam.push([x, y]); }
  for (let i = 0; i < 8; i++) strip(...seam[i], ...seam[i + 1], 2, 1.2, 0.01, M.plain('#4e5449', 0.8));
  rect(22, -10, 14, 20, 1.2, 0.06, dark, { dirt: 0 });
  for (const y of [-6, -1, 4]) rect(25, y - 1.1, 8, 2.2, 1.26, 0.01, black, { dirt: 0, cast: false });
  // domed seed hopper with ribs, rim and a glass window
  const DR = 48 * k, DH = 0.42, dcx = -34, dome = (x, y) => { const r = Math.hypot(x - dcx, y) * k; return 1.2 + DH * Math.sqrt(Math.max(0, 1 - (r / DR) ** 2)); };
  const dg = new THREE.SphereGeometry(DR, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2); dg.scale(1, DH / DR, 1);
  L.mesh(dg, domeM, dcx * k, 1.2, 0, R.O({ dirt: 0.15, dirtH: 0.4 }));
  L.hoop(47 * k, 0.06, M.plain('#3a3f38', 0.7, 0.3), dcx * k, 1.22, 0, R.O());
  const ribs = [[0, -17, 0, -44], [0, 17, 0, 44], [-17, 0, -44, 0], [17, 0, 44, 0], [-12, -12, -31, -31], [12, -12, 31, -31], [-12, 12, -31, 31], [12, 12, 31, 31],
    [-7, -16, -17, -41], [7, -16, 17, -41], [-7, 16, -17, 41], [7, 16, 17, 41], [-16, -7, -41, -17], [16, -7, 41, -17], [-16, 7, -41, 17], [16, 7, 41, 17]];
  for (const [a, b, c, d] of ribs) for (let i = 0; i < 3; i++) {
    const x1 = dcx + a + (c - a) * i / 3, y1 = b + (d - b) * i / 3, x2 = dcx + a + (c - a) * (i + 1) / 3, y2 = b + (d - b) * (i + 1) / 3;
    R.beamL([x1 * k, dome(x1, y1) + 0.01, y1 * k], [x2 * k, dome(x2, y2) + 0.01, y2 * k], 2.4 * k, 0.05, M.plain('#5d6355', 0.7, 0.2));
  }
  rect(-86, -8, 9, 16, 0.6, 0.75, frame, { dirt: 0 });
  disc(-34, 0, 15.5, 1.55, 0.1, M.plain('#2a2e2a', 0.6, 0.3)); disc(-34, 0, 12.5, 1.65, 0.02, M.plain('#12301a', 0.45, 0.2));
  for (const [x, y, r] of [[-38, -4, 3.6], [-29, 3, 3.5], [-37, 6, 3.1], [-28, -6, 3]]) disc(x, y, r, 1.66, 0.02, green, { cast: false });
  // team stripe following the curve of the hopper
  for (let y = -40; y < 40; y += 5) { const x = -7.75; L.box(4.5 * k, 0.03, 5.2 * k, glow, x * k, dome(x, y + 2.5) + 0.005, (y + 2.5) * k, R.O({ dirt: 0, cast: false })); }
  // folded planting arm with drill-and-claw tool
  const arm = M.plain('#6b737a', 0.5, 0.6);
  disc(42, 30, 9, 1.2, 0.25, M.plain('#4a5056', 0.5, 0.6));
  strip(42, 30, 70, 44, 9, 1.38, 0.16, arm, { cast: true }); strip(45, 36, 68, 48, 2.4, 1.545, 0.01, M.plain('#c5ccd0', 0.3, 0.8));
  disc(70, 44, 6.5, 1.3, 0.35, M.plain('#3d4349', 0.5, 0.6));
  strip(70, 44, 86, 20, 7.5, 1.5, 0.14, arm, { cast: true });
  rect(81, 10, 9, 16, 1.3, 0.4, M.plain('#3a3f44', 0.6, 0.5), { dirt: 0 });
  ext(R.poly([[90, 13.5], [98, 18], [90, 22.5]]), 1.42, 0.12, M.plain('#a8b0b5', 0.3, 0.8), { bevel: 0.02 });
  for (const s of [-1, 1]) { strip(86, 18 + s * 8, 91, 18 + s * 12, 2.6, 1.5, 0.05, M.plain('#8d959b', 0.4, 0.7)); strip(91, 18 + s * 12, 97, 18 + s * 10, 2.6, 1.5, 0.05, M.plain('#8d959b', 0.4, 0.7)); }
  // sensor eye (team colour) and the fixed green farm lights
  disc(60, -22, 11, 1.2, 0.2, M.plain('#14171a', 0.4, 0.5)); disc(60, -22, 12, 1.2, 0.17, M.plain('#5e666d', 0.5, 0.6));
  disc(61, -22, 7.5, 1.4, 0.03, R.eye(TEAM), { cast: false }); disc(58.5, -24.5, 2, 1.43, 0.01, M.emit('#ffffff', 0.35), { cast: false });
  for (const [x, y] of [[-76, -50], [-76, 50], [64, -50], [64, 50]]) disc(x, y, 3.6, 1.2, 0.04, green, { cast: false });
  brake(-85, -34, 6, 8, 1.2); brake(-85, 26, 6, 8, 1.2);
  R.finish();
}
