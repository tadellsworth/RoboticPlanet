// Hauler, "Lancer" line (design proposal): the six-wheeled flatbed restyled to match the Lancer warbot. A gunmetal
// chassis whose wheels sit half under armoured side skirts carrying team running lights; a long open flatbed (kept
// clear for the cargo crates the game draws at model x -99..37, y -41..41) behind a slatted headboard; a wedge cab with
// a pale work-paint roof and a glowing sensor slit at the nose; amber hazard bumpers front and back. Faces +x (east).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(701);
  const R = kit(L, 0, 0), { rect, rr, poly, ext, disc, strip, hazard, tyre, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e');
  const work = M.paint('#a7a397', { rivets: false });                    // the civilian work paint
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const seam = M.plain('#101214', 0.8), haz = hazard('#f0a030');
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  // six wheels, the inner half of each under the side skirts
  for (const x of [-79, -27, 71]) for (const z of [-59, 59]) tyre(x, z, 22, 30, { y0: -0.78 });   // sunk so the skirts sit over them
  for (const s of [-1, 1]) {
    ext(poly(mir([[-6, 46], [-12, 64], [-98, 64], [-106, 56], [-106, 46]], s)), 0.62, 0.5, armor, { bevel: 0.06 });   // rear bogie skirt
    ext(poly(mir([[100, 46], [94, 64], [50, 64], [44, 56], [44, 46]], s)), 0.62, 0.5, armor, { bevel: 0.06 });       // front wheel skirt
    strip(-94, s * 58, -16, s * 58, 3, 1.11, 0.02, glow);
    strip(54, s * 58, 88, s * 58, 3, 1.11, 0.02, glow);
  }
  // chassis: long and low, chamfered at the corners
  ext(poly([[108, -30], [100, -48], [-102, -50], [-110, -42], [-110, 42], [-102, 50], [100, 48], [108, 30]]), 0.5, 0.62, armor, { bevel: 0.08 });
  // the open flatbed: a plain deck with low ribs, low side rails, a rear rail, tie-down rings
  rect(-102, -43, 141, 86, 1.12, 0.1, M.paint('#4a5056', { panelW: 128, panelH: 512 }), { dirt: 0 });
  grime(-102, -43, 141, 86, 1.22, 1.1, 3);
  for (let y = -36; y <= 36; y += 12) rect(-99, y - 1, 136, 2, 1.22, 0.02, M.plain('#2c3135', 0.6, 0.5), { dirt: 0, cast: false });
  for (const s of [-1, 1]) {
    ext(rr(-104, s < 0 ? -50 : 43, 144, 7, 2), 1.12, 0.22, top, { bevel: 0.03 });
    strip(-100, s * 46.5, 36, s * 46.5, 1.2, 1.345, 0.01, seam);
  }
  ext(rr(-108, -50, 7, 100, 2), 1.12, 0.22, top, { bevel: 0.03 });
  for (const x of [-84, -48, -12, 24]) for (const y of [-38, 38]) {
    const r = new THREE.TorusGeometry(2.6 * k, 0.025, 8, 16); r.rotateX(Math.PI / 2);
    L.mesh(r, M.plain('#a7aeb3', 0.4, 0.8), x * k, 1.25, y * k, R.O({ dirt: 0 }));
  }
  // slatted headboard guarding the cab
  ext(rr(38, -48, 8, 96, 2), 1.12, 0.8, top, { bevel: 0.03 });
  for (const y of [-36, -24, -12, 0, 12, 24, 36]) strip(39, y, 45, y, 2, 1.93, 0.01, black);
  // the cab: a wedge with a pale work-paint roof, a darker brow and the sensor slit
  ext(poly([[106, -26], [96, -46], [50, -46], [46, -42], [46, 42], [50, 46], [96, 46], [106, 26]]), 1.0, 0.95, armor, { bevel: 0.1 });
  ext(poly([[89, -34], [83, -40], [54, -40], [54, 40], [83, 40], [89, 34]]), 1.95, 0.08, work, { bevel: 0.03 });
  ext(poly([[103, -24], [95, -40], [91, -40], [91, 40], [95, 40], [103, 24]]), 1.95, 0.06, top, { bevel: 0.02 });
  for (const [a, b, c, d] of [[91, -40, 91, 40], [70, -40, 70, 40]]) strip(a, b, c, d, 2, 2.04, 0.01, seam);
  grime(50, -44, 54, 88, 2.04, 0.9, 7);
  ext(poly([[98, -20], [103, -8], [103, 8], [98, 20], [93, 18], [97, 6], [97, -6], [93, -18]]), 1.99, 0.1, eye(TEAM, 1.4, 0.36), { bevel: 0.01, cast: false });
  // roof greebles: a vent, a hatch, a small amber work beacon and a stub aerial
  rect(56, -18, 9, 36, 2.03, 0.04, dark, { dirt: 0 });
  for (const y of [-15, -8, -1, 6]) rect(57.5, y + 0.5, 6, 3.5, 2.07, 0.01, black, { dirt: 0, cast: false });
  disc(80, 4, 6, 2.03, 0.04, M.plain('#5c5a53', 0.7, 0.2)); L.hoop(6 * k, 0.016, M.plain('#3a3833', 0.7), 80 * k, 2.07, 4 * k, R.O());
  disc(64, 31, 4.5, 2.03, 0.12, M.plain('#22262a', 0.6, 0.5)); disc(64, 31, 3, 2.15, 0.04, M.emit('#ffb340', 0.6), { cast: false });
  L.cyl(1.2 * k, 0.35, M.plain('#15171a', 0.6, 0.5), 82 * k, 2.03, -31 * k, R.O({ dirt: 0 }));
  disc(82, -31, 2.4, 2.38, 0.03, eye(TEAM, 1, 0.3), { cast: false });
  // amber hazard bumpers, front and back
  ext(poly([[115, -34], [112, -42], [104, -42], [104, 42], [112, 42], [115, 34]]), 0.55, 0.6, haz, { bevel: 0.03 });
  ext(poly([[-115, -34], [-112, -42], [-106, -42], [-106, 42], [-112, 42], [-115, 34]]), 0.55, 0.6, haz, { bevel: 0.03 });
  // team lights: small lights at the tail
  for (const y of [-49, 42]) rect(-113, y, 4, 7, 0.6, 0.3, glow, { dirt: 0, cast: false });
  // brake lenses on the rear bumper corners
  brake(-114, -40, 6, 8, 1.16); brake(-114, 32, 6, 8, 1.16);
  R.finish();
}
