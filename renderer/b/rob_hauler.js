// Hauler, top-down 3D, matching the reference sprite (coordinates are the old SVG's px, centred on 0,0).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(701);
  const R = kit(L, 0, 0), { rect, rr, shape, ext, disc, strip, hazard, tyre, brake, grime } = R;
  const gun = M.paint('#454b51'), gunD = M.paint('#3b4045', { rivets: false }), rail = M.paint('#6c747a', { rivets: false });
  const cab = M.paint('#ada99f'), dark = M.plain('#2a2d31', 0.7, 0.3), black = M.plain('#0b0c0e', 0.8), glow = M.emit(TEAM, 1.1);

  // six chunky wheels
  for (const x of [-79, -27, 71]) for (const z of [-59, 59]) tyre(x, z, 22, 30);
  // chassis and narrow fenders
  ext(rr(-108, -52, 216, 104, 14), 0.55, 0.9, gun, { bevel: 0.08 });
  for (const x of [-104, -52, 46]) for (const y of [-53, 45]) ext(rr(x, y, 50, 8, 3), 1.72, 0.1, gunD, { bevel: 0.03 });
  // empty flatbed: ribbed deck, low side rails with posts, rear rail, tie-down rings
  rect(-102, -43, 140, 86, 1.45, 0.15, M.paint('#4a5056', { panelW: 128, panelH: 512 }), { dirt: 0 });
  grime(-102, -43, 140, 86, 1.6, 1.4, 3);
  for (let y = -38; y <= 38; y += 9.5) rect(-100, y - 1, 136, 2, 1.6, 0.025, M.plain('#62696f', 0.6, 0.5), { dirt: 0, cast: false });
  for (const y of [-48, 41]) ext(rr(-104, y, 144, 7, 2), 1.6, 0.25, rail, { bevel: 0.03 });
  ext(rr(-107, -48, 8, 96, 2), 1.6, 0.25, rail, { bevel: 0.03 });
  for (const x of [-74, -38, -2]) for (const y of [-50, 40]) ext(rr(x, y, 8, 10, 1.5), 1.6, 0.32, M.paint('#4a5056', { rivets: false }), { bevel: 0.03 });
  for (const x of [-88, -52, -16, 20]) for (const y of [-35, 35]) {
    const r = new THREE.TorusGeometry(3 * R.k, 0.03, 8, 16); r.rotateX(Math.PI / 2);
    L.mesh(r, M.plain('#a7aeb3', 0.4, 0.8), x * R.k, 1.63, y * R.k, R.O({ dirt: 0 }));
  }
  // armoured cab (front, right)
  ext(rr(37, -47, 8, 94, 2), 1.45, 0.75, gunD, { bevel: 0.03 });
  for (const y of [-34, -22, -10, 2, 14, 26]) strip(38, y, 44, y, 2, 2.2, 0.01, black);
  ext(shape(P => { P.m(45, -47); P.l(86, -47); P.c(100, -47, 106, -40, 106, -28); P.l(106, 28); P.c(106, 40, 100, 47, 86, 47); P.l(45, 47); P.l(45, -47); }), 1.0, 1.35, cab, { bevel: 0.12 });
  grime(45, -47, 61, 94, 2.35, 1.0, 7);
  for (const y of [-30, 30]) strip(47, y, 96, y, 1.5, 2.35, 0.012, M.plain('#5e5c55', 0.8));
  rect(51, -20, 20, 40, 2.35, 0.06, dark, { dirt: 0 });
  for (const y of [-16, -8, 0, 8]) rect(54, y, 14, 3.5, 2.41, 0.01, black, { dirt: 0, cast: false });
  disc(80, 0, 9, 2.35, 0.14, M.plain('#3d4349', 0.5, 0.5)); disc(80, 0, 4, 2.49, 0.03, M.plain('#15181b', 0.4));
  rect(91, -29, 9, 58, 2.35, 0.04, M.plain('#11161a', 0.15, 0.6), { dirt: 0 });
  disc(58, 35, 3.5, 2.35, 0.05, M.plain('#22262a', 0.6, 0.5));
  // amber hazard-striped bumpers, front and back
  ext(rr(105, -42, 10, 84, 3), 0.6, 0.7, hazard('#f0a030'), { bevel: 0.04 });
  ext(rr(-115, -42, 10, 84, 3), 0.6, 0.7, hazard('#f0a030'), { bevel: 0.04 });
  // team lights: headlights at the cab's front corners, running strips along each side
  for (const y of [-41, 28]) { ext(rr(98, y, 8, 13, 3), 2.35, 0.05, glow, { bevel: 0.01, cast: false }); rect(100.5, y + 3.5, 3.5, 6, 2.41, 0.01, M.emit('#e8fbff', 0.5), { cast: false }); }
  for (const y of [-52.5, 49.5]) rect(-100, y, 196, 3, 1.84, 0.04, glow, { dirt: 0, cast: false });
  // brake lenses on the rear bumper corners
  brake(-114, -41, 8, 9, 1.3); brake(-114, 32, 8, 9, 1.3);
  R.finish();
}
