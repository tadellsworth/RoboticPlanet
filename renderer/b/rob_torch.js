// Torch, "Lancer" family: a flamethrower robot. Tracks under team-lit skirts, a compact wedge hull, and on the rear
// deck two big fuel tanks lying side by side (orange hazard bands, filler caps), fuel lines running forward along the
// deck to a heat-shielded nozzle mount with a flared flamethrower nozzle and a pilot flame burning in its mouth (orange,
// whatever the team). An amber warning beacon and a sensor slit in the nose. Faces +x (east), top-down.
// Mark: nozzle (the mouth of the nozzle).
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(4421);
  const R = kit(L, 10, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye, hazard } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), tankM = M.plain('#a85a24', 0.38, 0.55), copper = M.plain('#8a5a32', 0.4, 0.8);
  const flame = M.emit('#ff8a2a', 2.6), core = M.emit('#ffe1a0', 3.2), amber = M.emit('#ffb02e', 1.4);
  for (const y of [-54, 54]) track(-86, 80, y, 26, 0.4, { pitch: 0.31 });
  for (const s of [-1, 1]) {
    ext(poly(s < 0 ? [[84, -46], [72, -58], [-82, -58], [-94, -52], [-94, -46]] : [[84, 46], [72, 58], [-82, 58], [-94, 52], [-94, 46]]), 0.5, 0.48, armor, { bevel: 0.06 });
    strip(-76, s * 54, 62, s * 54, 3, 0.99, 0.02, glow);
  }
  // hull
  ext(poly([[96, 0], [66, -42], [-86, -44], [-98, -32], [-98, 32], [-86, 44], [66, 42]]), 0.34, 0.62, armor, { bevel: 0.08 });
  ext(rr(-92, -38, 150, 76, 8), 0.96, 0.05, top, { bevel: 0.02 });
  grime(-94, -42, 186, 84, 1.02, 0.9, 53);
  // twin fuel tanks on the rear deck (lying along the hull)
  for (const s of [-1, 1]) {
    const yc = 1.0 + 17 * k, zc = s * 19 * k;
    L.hcyl(17 * k, 70 * k, tankM, -46 * k, yc, zc, R.O({ axis: 'x', seg: 36, dirt: 0.25 }));
    for (const x of [-81, -11]) L.sphere(17 * k, tankM, x * k, yc, zc, R.O({ dirt: 0.25 }));   // rounded ends
    for (const x of [-70, -22]) L.hcyl(17.6 * k, 6 * k, R.hazard('#f07a20', '#1b1a17'), x * k, yc, zc, R.O({ axis: 'x', seg: 36, dirt: 0.1 }));
    strip(-80, s * 19 - 4, -12, s * 19 - 4, 2.5, 1.0 + 34.2 * k, 0.005, M.plain('#e8b07a', 0.25, 0.6));   // the sheen along the top
    disc(-46, s * 19, 5, 1.0 + 33.5 * k, 0.05, steel);                    // filler cap
    // fuel line forward to the nozzle mount
    L.beam([-4 * k, 1.06, s * 19 * k], [40 * k, 1.06, s * 9 * k], 3 * k, 3 * k, copper, R.O({ dirt: 0 }));
  }
  rect(-94, -4, 96, 8, 1.0, 0.18, dark, { dirt: 0 });                    // the gap between the tanks
  // nozzle mount: heat shield plate, the flamethrower barrel and flared nozzle, a pilot flame
  ext(poly([[64, -22], [44, -26], [26, -20], [26, 20], [44, 26], [64, 22]]), 1.0, 0.18, roof, { bevel: 0.03 });
  L.hcyl(7 * k, 46 * k, steel, (40 + 23) * k, 1.24, 0, R.O({ axis: 'x', seg: 24, dirt: 0 }));
  for (const x of [52, 62, 72]) L.hcyl(8.5 * k, 3 * k, dark, x * k, 1.24, 0, R.O({ axis: 'x', seg: 24, dirt: 0 }));
  // flared nozzle (a cone opening forward), its mouth glowing
  const cone = new L.THREE.CylinderGeometry(12 * k, 7 * k, 16 * k, 28, 1, true); cone.rotateZ(-Math.PI / 2);
  L.mesh(cone, M.plain('#3b3f44', 0.45, 0.6), 94 * k, 1.24, 0, R.O({ dirt: 0 }));
  disc(101, 0, 9, 1.14, 0.12, flame, { cast: false });
  L.box(4 * k, 0.12, 12 * k, core, 103 * k, 1.24, 0, R.O({ dirt: 0, cast: false }));
  L.mark && L.mark('nozzle', 104 * k, 1.24, 0);
  // sensor slit and beacon
  ext(poly([[86, -12], [90, -6], [90, 6], [86, 12], [82, 10], [84, 4], [84, -4], [82, -10]]), 0.96, 0.08, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  disc(14, -30, 5, 1.0, 0.16, amber, { cast: false });
  for (const y of [-38, 30]) rect(-101, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-101, -26, 5, 7, 0.72); brake(-101, 19, 5, 7, 0.72);
  // hazard plate on the nose
  rect(70, -30, 10, 8, 0.97, 0.03, hazard('#f0a030'), { dirt: 0.2 });
  R.finish();
}
