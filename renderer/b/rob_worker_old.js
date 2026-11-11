// Worker, top-down 3D, matching the reference sprite (old SVG px coordinates; bounding box centre at x = 1).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(702);
  const R = kit(L, 1, 0), { rect, rr, shape, ext, disc, strip, hazard, track, brake, grime } = R;
  const gun = M.paint('#454c52'), rail = M.paint('#5f676d', { rivets: false }), cab = M.paint('#a9a69c'), head = M.paint('#b8b5ab', { rivets: false });
  const dark = M.plain('#2a2d31', 0.7, 0.3), black = M.plain('#0b0c0e', 0.8), glow = M.emit(TEAM, 1.1);
  // treads
  for (const y of [-66, 66]) track(-96, 94, y, 36, 0.42, { pitch: 0.35 });
  // chassis and cargo cradle
  ext(rr(-88, -58, 178, 116, 32), 0.35, 0.8, gun, { bevel: 0.08 });
  rect(-78, -42, 76, 84, 1.15, 0.03, M.plain('#1a1c1f', 0.9), { dirt: 0 });
  for (const x of [-70, -50, -30]) rect(x, -38, 9, 76, 1.18, 0.07, M.plain('#32373c', 0.6, 0.4), { dirt: 0 });
  grime(-78, -42, 76, 84, 1.25, 0.8, 11);
  for (const y of [-51, 41]) ext(rr(-84, y, 84, 10, 3), 1.15, 0.3, rail, { bevel: 0.03 });
  ext(rr(-93, -51, 13, 102, 4), 1.15, 0.35, rail, { bevel: 0.03 });
  rect(-91, -30, 9, 60, 1.5, 0.02, hazard('#b08a2e'), { dirt: 0 });
  for (const y of [-56, 39]) ext(rr(-96, y, 17, 17, 4), 1.15, 0.45, M.paint('#4a5056', { rivets: false }), { bevel: 0.03 });
  brake(-91, -51, 7, 7, 1.6); brake(-91, 44, 7, 7, 1.6);
  // painted cab with a domed head
  ext(shape(P => { P.m(-4, -50); P.l(50, -50); P.c(78, -50, 92, -30, 92, 0); P.c(92, 30, 78, 50, 50, 50); P.l(-4, 50); P.l(-4, -50); }), 0.6, 1.15, cab, { bevel: 0.1 });
  grime(-4, -50, 96, 100, 1.75, 0.7, 5);
  for (const s of [-1, 1]) { strip(-4, s * 36, -14, s * 38, 3.6, 1.6, 0.06, black); strip(-14, s * 38, -26, s * 47, 3.6, 1.45, 0.06, black); }
  rect(0, -22, 16, 44, 1.75, 0.06, dark, { dirt: 0 });
  for (const y of [-18, -9, 0, 9]) rect(3, y, 10, 4, 1.81, 0.01, black, { dirt: 0, cast: false });
  disc(9, 36, 6.5, 1.75, 0.08, M.plain('#1b1d20', 0.6, 0.4)); disc(9, 36, 7.6, 1.75, 0.05, M.plain('#737b82', 0.5, 0.6));
  disc(9, -36, 8, 1.75, 0.08, dark); disc(9, -36, 5, 1.83, 0.03, glow, { cast: false });
  const hg = new THREE.SphereGeometry(31 * R.k, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); hg.scale(1, 0.55, 1);
  L.mesh(hg, head, 50 * R.k, 1.75, 0, R.O({ dirt: 0.2, dirtH: 0.6 }));
  ext(rr(88, -38, 12, 76, 5), 0.6, 0.75, hazard('#b08a2e'), { bevel: 0.04 });
  // sensor eye (team colour) set into the head
  disc(70, 0, 18, 1.75, 0.6, M.plain('#101215', 0.4, 0.5)); disc(70, 0, 19, 2.3, 0.05, M.plain('#5e666d', 0.5, 0.6));
  disc(71, 0, 13.5, 2.33, 0.04, R.eye(TEAM), { cast: false });
  disc(66.5, -4.5, 3.2, 2.38, 0.01, M.emit('#ffffff', 0.35), { cast: false });
  // team lights at the back
  for (const y of [-50, 38]) rect(-98, y, 5, 12, 1.15, 0.3, glow, { dirt: 0, cast: false });
  R.finish();
}
