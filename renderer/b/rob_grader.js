// The Grader, the owner's pick from the concept canvas: concept A, "Dozer". A compact, heavy crawler dozer in the
// Lancer line (robkit.js): wide exposed tracks under narrow fenders with team strips, an earth-ochre engine hood with a
// stack, a cab set back with a pale work-paint roof and the sensor slit, a wide curved blade on push arms with two lift
// rams, and a three-shank ripper at the tail. Faces +x, 10 world units across, straight down, no shadow.
// Params: f (track frame), blade 0 raised (driving) .. 1 down (at work), load 0..1 (earth heaped ahead of the blade),
// part=robot | brake (the lit brake lenses alone) | load (the heap alone, for the grader-load-1..3 overlays).
// tools/render_grader.sh renders the set; tools/install_grader.py installs it (ART_GUIDE, Batch 35).
import { kit } from './robkit.js';
import { lamp, beacon, heap, earthMat } from './gradekit.js';
export const config = { pad: false, size: 512 };
export default async function (L) {
  const { M, TEAM } = L;
  L.seed(811);
  const R = kit(L, 4, 0), { rect, rr, poly, ext, disc, strip, hazard, track, brake, grime, eye } = R, k = R.k;
  const p = new URLSearchParams(location.search), blade = +(p.get('blade') ?? 0), load = +(p.get('load') ?? 0);
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), work = M.paint('#a7a397', { rivets: false });
  const ochre = M.paint('#9c7a3c', { rivets: false });            // earth-ochre: the terraforming crews' paint
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), chrome = M.plain('#b9c0c6', 0.25, 0.95), seam = M.plain('#101214', 0.8);
  const haz = hazard('#dca83a'), edge = M.plain('#8d9298', 0.35, 0.9);
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  // tracks: long, wide and mostly exposed (an earthmover shows its tracks)
  for (const y of [-64, 64]) track(-86, 72, y, 40, 0.52, { pitch: 0.34, cleatW: 1 });
  for (const s of [-1, 1]) {
    ext(poly(mir([[70, 46], [66, 58], [-82, 58], [-88, 50], [-88, 46]], s)), 1.02, 0.12, armor, { bevel: 0.04 });   // fender lip
    ext(rr(-84, s < 0 ? -86 : 78, 150, 8, 3), 1.02, 0.1, top, { bevel: 0.03 });                                       // outer fender
    strip(-70, s * 82, 50, s * 82, 2.2, 1.13, 0.02, glow);
  }
  // hull
  ext(poly([[70, -40], [64, -48], [-86, -48], [-92, -40], [-92, 40], [-86, 48], [64, 48], [70, 40]]), 0.4, 0.66, armor, { bevel: 0.08 });
  grime(-90, -48, 160, 96, 1.07, 0.9, 13);
  // the engine hood ahead of the cab: ochre, louvred, with a stack
  ext(poly([[68, -30], [62, -38], [6, -38], [6, 38], [62, 38], [68, 30]]), 1.0, 0.42, ochre, { bevel: 0.06 });
  for (let x = 14; x <= 54; x += 8) rect(x, -26, 4, 52, 1.43, 0.01, black, { dirt: 0, cast: false });
  grime(6, -38, 62, 76, 1.43, 0.8, 21);
  L.cyl(4 * k, 0.75, M.plain('#2a2c30', 0.5, 0.6), 22 * k, 1.42, -30 * k, R.O());
  disc(22, -30, 3, 2.17, 0.03, black);
  // the cab: tall, set back, ROPS posts at the corners, pale roof, sensor slit facing forward
  ext(poly([[2, -34], [-4, -40], [-58, -40], [-62, -34], [-62, 34], [-58, 40], [-4, 40], [2, 34]]), 1.06, 0.92, armor, { bevel: 0.08 });
  for (const [x, y] of [[-2, -38], [-2, 38], [-60, -38], [-60, 38]]) L.cyl(2.6 * k, 1.0, steel, x * k, 1.06, y * k, R.O());
  const glass = M.plain('#141b22', 0.15, 0.6);
  ext(poly([[3, -30], [3, 30], [-1, 30], [-1, -30]]), 1.45, 0.42, glass, { bevel: 0.01 });
  for (const s of [-1, 1]) ext(rr(-54, s < 0 ? -41 : 39, 50, 2, 1), 1.45, 0.42, glass, { bevel: 0.005 });
  ext(poly([[6, -36], [0, -42], [-60, -42], [-64, -36], [-64, 36], [-60, 42], [0, 42], [6, 36]]), 1.98, 0.08, work, { bevel: 0.03 });
  strip(-60, 0, 2, 0, 2, 2.07, 0.01, seam); strip(-30, -40, -30, 40, 2, 2.07, 0.01, seam);
  grime(-62, -40, 66, 80, 2.07, 0.5, 5);
  ext(poly([[7, -22], [10, -10], [10, 10], [7, 22], [4, 20], [6, 8], [6, -8], [4, -20]]), 1.96, 0.1, eye(TEAM, 1.4, 0.36), { bevel: 0.01, cast: false });
  rect(-50, -16, 12, 32, 2.07, 0.04, dark, { dirt: 0 });
  for (const y of [-12, -4, 4]) rect(-48, y, 8, 4, 2.11, 0.01, black, { dirt: 0, cast: false });
  beacon(L, R, -20, 28, 2.07);
  L.cyl(1.2 * k, 0.4, M.plain('#15171a', 0.6, 0.5), -42 * k, 2.07, -32 * k, R.O({ dirt: 0 }));
  disc(-42, -32, 2.4, 2.47, 0.03, eye(TEAM, 1, 0.3), { cast: false });
  // work lights on the roof's front corners, headlights on the hood
  lamp(L, R, 6, -32, 2.06, { r: 3.4 }); lamp(L, R, 6, 32, 2.06, { r: 3.4 });
  lamp(L, R, 68, -24, 1.18, { r: 3 }); lamp(L, R, 68, 24, 1.18, { r: 3 });
  // the blade on push arms: raised 0.45 when travelling, down at the cut
  const lift = (1 - blade) * 0.42, bx = 96;
  for (const s of [-1, 1]) {
    const a = R.beamL([40 * k, 0.75, s * 58 * k], [(bx - 4) * k, 0.35 + lift, s * 58 * k], 0.22, 0.18, steel);
    R.beamL([58 * k, 1.28, s * 18 * k], [(bx - 6) * k, 0.95 + lift, s * 20 * k], 0.11, 0.11, chrome);    // lift ram rod
    R.beamL([56 * k, 1.3, s * 18 * k], [76 * k, 1.17 + lift * 0.5, s * 19 * k], 0.17, 0.17, dark);    // ram barrel
  }
  const BG = L.group(bx * k, lift, 0, 0, R.G);
  // curved moldboard: a stack of slats leaning back, a cutting edge in front, side bits, hazard top
  const W = 176 * k;
  const NS = 9, BH = 1.45;
  for (let i = 0; i < NS; i++) {
    const t = i / (NS - 1), y = 0.1 + t * BH, x = -0.34 * Math.sin(t * Math.PI) - 0.16 * t + (t > 0.85 ? 0.1 : 0);
    L.box(0.12, BH / (NS - 1) + 0.03, W, i === NS - 1 ? haz : M.paint('#2f3439'), x - 0.06, y, 0, { parent: BG, dirt: 0.5, dirtH: 0.6 });
  }
  L.box(0.14, 0.12, W, edge, 0.06, 0.02, 0, { parent: BG, dirt: 0 });                // worn bright cutting edge
  for (const s of [-1, 1]) L.box(0.55, 1.5, 0.1, armor, -0.16, 0.8, s * W / 2, { parent: BG });
  L.box(0.3, 0.9, W * 0.9, top, -0.56, 0.62, 0, { parent: BG });
  for (const z of [-60, -20, 20, 60]) L.box(0.36, 1.1, 0.08, top, -0.42, 0.7, z * k, { parent: BG });                    // back bracing
  // three-shank ripper at the tail
  L.box(0.3, 0.22, 2.4, top, -96 * k, 0.75, 0, R.O());
  L.box(0.14, 0.16, 2.5, haz, -99 * k, 0.88, 0, R.O());
  for (const y of [-32, 0, 32]) { L.box(0.16, 0.9, 0.16, steel, -100 * k, 0.32, y * k, R.O()); L.box(0.3, 0.1, 0.14, steel, -98 * k, -0.08, y * k, R.O({ ry: 0 })); }
  // rear lights
  for (const y of [-44, 36]) rect(-95, y, 4, 8, 0.6, 0.3, glow, { dirt: 0, cast: false });
  brake(-94, -26, 5, 7, 1.08); brake(-94, 19, 5, 7, 1.08);
  // the earth in front of the blade
  const earth = [];
  if (load > 0) {
    const em = await earthMat(L);
    const wx = (bx + 4) * k + R.G.position.x + 0.55 * Math.sqrt(load);
    earth.push(...heap(L, em, wx, 0, 2.6 * Math.sqrt(load), 0.95 * load + 0.08, 3, { sz: 1.45, sx: 0.55 }));
  }
  R.finish();
  if (R.part === 'load') for (const m of earth) m.visible = true;
}
