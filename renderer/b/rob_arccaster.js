// Arc Caster, "Lancer" family: a chain-lightning robot. Tracks under team-lit skirmishers' skirts, a short boxy hull,
// and filling the deck a Tesla coil seen from above: a stack of ceramic insulator rings rising to a fat toroidal
// discharge ring with a glowing electric-blue core, three stubby lightning rods round it. On the rear deck, two banks
// of capacitor drums with blue-white charge lights (Crystal powers them). A sensor slit in the nose.
// Faces +x (east), top-down. Mark: core.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(8807);
  const R = kit(L, 4, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), copper = M.plain('#a86a3a', 0.35, 0.85);
  const ceramic = M.plain('#d9d4c8', 0.45, 0.05), bolt = M.emit('#9fe6ff', 2.4), core = M.emit('#c8f2ff', 2.8);
  for (const y of [-56, 56]) track(-82, 74, y, 28, 0.42, { pitch: 0.31 });
  for (const s of [-1, 1]) {
    ext(poly(s < 0 ? [[78, -48], [66, -62], [-78, -62], [-90, -56], [-90, -48]] : [[78, 48], [66, 62], [-78, 62], [-90, 56], [-90, 48]]), 0.5, 0.5, armor, { bevel: 0.06 });
    strip(-76, s * 56, 58, s * 56, 3, 1.01, 0.02, glow);
  }
  // boxy hull with a chamfered nose
  ext(poly([[86, -30], [70, -46], [-84, -46], [-96, -34], [-96, 34], [-84, 46], [70, 46], [86, 30]]), 0.34, 0.66, armor, { bevel: 0.08 });
  ext(rr(-90, -40, 168, 80, 9), 1.0, 0.05, top, { bevel: 0.02 });
  grime(-94, -44, 180, 88, 1.06, 0.8, 61);
  ext(poly([[80, -12], [86, -5], [86, 5], [80, 12], [77, 10], [80, 3], [80, -3], [77, -10]]), 1.02, 0.08, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  // capacitor banks on the rear deck: drums with copper caps and blue charge lights
  for (const s of [-1, 1]) for (const x of [-80, -62]) {
    L.cyl(9 * k, 0.32, M.plain('#2c3036', 0.5, 0.6), x * k, 1.04, s * 26 * k, R.O({ seg: 28, dirt: 0.2 }));
    disc(x, s * 26, 6.5, 1.36, 0.04, M.plain('#3d4248', 0.4, 0.8), { cast: false });
    disc(x, s * 26, 4, 1.4, 0.03, eye('#9fe6ff', 2.0, 0.5), { cast: false });
  }
  for (const s of [-1, 1]) L.beam([-70 * k, 1.2, s * 26 * k], [-26 * k, 1.12, s * 14 * k], 3 * k, 3 * k, copper, R.O({ dirt: 0 }));
  // the coil: a base plinth, ceramic insulator rings stacked up, the toroidal discharge ring and its glowing core
  const cx = 10;
  L.cyl(34 * k, 0.16, top, cx * k, 1.04, 0, R.O({ seg: 40 }));
  for (let i = 0; i < 4; i++) L.cyl((22 - i * 2) * k, 0.12, i % 2 ? dark : ceramic, cx * k, 1.2 + i * 0.12, 0, R.O({ seg: 36, dirt: 0 }));
  L.hoop(26 * k, 7 * k, M.plain('#8f969d', 0.28, 0.9), cx * k, 1.86, 0, R.O());     // the discharge torus
  L.hoop(26 * k, 2.2 * k, bolt, cx * k, 2.0, 0, R.O({ cast: false }));               // its glowing seam
  L.sphere(11 * k, core, cx * k, 1.72, 0, R.O({ cast: false, dirt: 0 }));
  L.mark && L.mark('core', cx * k, 2.0, 0);
  // three stubby lightning rods round the coil, each with a lit tip
  for (const a of [Math.PI * 0.25, Math.PI, -Math.PI * 0.25]) {
    const x = cx + Math.cos(a) * 40, y = Math.sin(a) * 40;
    L.cyl(3.5 * k, 0.7, steel, x * k, 1.04, y * k, R.O({ seg: 16, dirt: 0 }));
    disc(x, y, 3.2, 1.74, 0.05, bolt, { cast: false });
  }
  // rear lights and brake lenses
  for (const y of [-40, 32]) rect(-99, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-99, -26, 5, 7, 0.72); brake(-99, 19, 5, 7, 0.72);
  for (const y of [-6, 0, 6]) rect(-94, y - 1.5, 10, 3, 1.06, 0.01, black, { dirt: 0, cast: false });
  R.finish();
}
