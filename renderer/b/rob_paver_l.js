// Paver, "Lancer" line: the road-laying robot restyled to match the Lancer worker and hauler. A chamfered gunmetal hull on
// two small rear wheels half under armoured skirts with team running lights; the black insulated tar tank lying along the
// back with the hot spray bar behind it; a wedge cab with a paver-yellow roof and the glowing sensor slit; at the front
// the big steel roller drum in its hazard-striped yoke (its job, kept as it was). Faces +x (east). Old SVG px coordinates
// (bounding box centre at x = -2), as b/rob_paver.js: wheels, drum, brake lenses and footprint unchanged.
// Rear wheels roll a quarter tread block per frame; the front roller turns a quarter of its rib pattern.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(704);
  const R = kit(L, -2, 0), { rect, rr, poly, ext, disc, strip, hazard, tyre, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e');
  const yel = M.paint('#b39232', { rivets: false });                     // the paver's work paint
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const seam = M.plain('#101214', 0.8), haz = hazard('#ffcf4a');
  const mir = (pts, s) => pts.map(([x, y]) => [x, s * y]);
  // two small rear wheels, the inner half under armoured skirts with team running lights
  for (const y of [-61, 61]) tyre(-70, y, 16, 18, { blocks: 14, y0: -0.3 });                // sunk a little so the skirts sit over them
  for (const s of [-1, 1]) {
    ext(poly(mir([[50, 46], [44, 60], [-92, 60], [-100, 54], [-100, 46]], s)), 0.5, 0.56, armor, { bevel: 0.05 });
    strip(-92, s * 56, 40, s * 56, 3, 1.07, 0.02, glow);
    for (const x of [-46, 0]) strip(x, s * 58, x, s * 60, 1.5, 1.06, 0.01, seam);
  }
  // hull: chamfered, low at the back under the tank
  ext(poly([[52, -46], [46, -52], [-94, -52], [-100, -46], [-100, 46], [-94, 52], [46, 52], [52, 46]]), 0.4, 0.7, armor, { bevel: 0.06 });
  // black insulated tar tank lying along the vehicle, with steel straps and a hatch
  const TR = 34 * k, tank = new THREE.CapsuleGeometry(TR, (82 - 68) * k, 8, 32); tank.rotateZ(Math.PI / 2); tank.scale(1, 0.55, 1.06);
  L.mesh(tank, M.plain('#24262a', 0.55, 0.3), -53 * k, 1.1 + TR * 0.55, 0, R.O({ dirt: 0.2, dirtH: 0.8 }));
  for (const x of [-73.5, -35.5]) { const t = new THREE.TorusGeometry(TR * 1.07, 0.05, 8, 40); t.rotateY(Math.PI / 2); t.scale(1, 0.56, 1); L.mesh(t, yel, x * k, 1.1 + TR * 0.55, 0, R.O({ dirt: 0 })); }
  disc(-55, 0, 9, 1.1 + TR * 1.1 - 0.05, 0.08, M.plain('#202122', 0.6, 0.3)); L.hoop(9 * k, 0.03, M.plain('#6b7076', 0.5, 0.6), -55 * k, 1.1 + TR * 1.1 + 0.03, 0, R.O());
  // the hot spray bar behind the tank: orange-glowing nozzles, a hazard bumper
  rect(-105, -46, 8, 92, 0.5, 0.4, M.plain('#22262a', 0.6, 0.4), { dirt: 0 });
  for (const y of [-34, -17, 0, 17, 34]) { disc(-103, y, 2.6, 0.9, 0.03, black); disc(-106.5, y, 2.6, 0.6, 0.25, M.emit('#ff7a1a', 0.9), { cast: false }); }
  ext(rr(-110, -50, 6, 100, 2), 0.5, 0.5, haz, { bevel: 0.03 });
  for (const y of [-50, 42]) rect(-111, y, 3, 8, 0.6, 0.36, glow, { dirt: 0, cast: false });
  brake(-109, -49, 5, 8, 1.0); brake(-109, 41, 5, 8, 1.0);
  // the cab: a wedge with a paver-yellow roof, a darker brow and the sensor slit
  ext(poly([[48, -18], [40, -42], [-8, -44], [-14, -38], [-14, 38], [-8, 44], [40, 42], [48, 18]]), 1.0, 0.85, armor, { bevel: 0.08 });
  ext(poly([[26, -34], [20, -38], [-10, -38], [-10, 38], [20, 38], [26, 34]]), 1.83, 0.08, yel, { bevel: 0.03 });
  ext(poly([[44, -15], [36, -36], [28, -36], [28, 36], [36, 36], [44, 15]]), 1.83, 0.06, top, { bevel: 0.02 });
  for (const [a, b, c, d] of [[28, -36, 28, 36], [8, -36, 8, 36]]) strip(a, b, c, d, 2, 1.92, 0.01, seam);
  grime(-14, -44, 62, 88, 1.92, 0.7, 17);
  ext(poly([[40, -17], [46, -6], [46, 6], [40, 17], [35.5, 15], [40, 4], [40, -4], [35.5, -15]]), 1.87, 0.1, eye(TEAM, 1.4, 0.36), { bevel: 0.01, cast: false });
  rect(-4, -18, 9, 36, 1.91, 0.04, dark, { dirt: 0 });
  for (const y of [-14, -6, 2, 10]) rect(-2.5, y, 6, 3.5, 1.95, 0.01, black, { dirt: 0, cast: false });
  disc(14, -24, 4.5, 1.91, 0.12, M.plain('#22262a', 0.6, 0.5)); disc(14, -24, 3, 2.03, 0.04, M.emit('#ffb340', 0.6), { cast: false });
  L.cyl(1.2 * k, 0.35, M.plain('#15171a', 0.6, 0.5), 16 * k, 1.91, 26 * k, R.O({ dirt: 0 }));
  disc(16, 26, 2.4, 2.26, 0.03, eye(TEAM, 1, 0.3), { cast: false });
  // roller frame (hazard yoke), cross beam, steel drum with turning ribs, scraper bar
  for (const y of [-84, 73]) ext(rr(44, y, 58, 11, 3), 0.5, 1.1, haz, { bevel: 0.04 });
  rect(44, -74, 10, 148, 1.0, 0.5, armor, { dirt: 0 });
  const DRR = 22 * k, dl = 146 * k, NR = 20, rp = Math.PI * 2 / NR;
  const drum = L.group(77 * k, DRR + 0.02, 0, 0, R.G); drum.rotation.z = -R.f * rp / 4;
  const dgeo = new THREE.CylinderGeometry(DRR - 0.03, DRR - 0.03, dl, 48, 1); dgeo.rotateX(Math.PI / 2);
  L.mesh(dgeo, M.plain('#8d969c', 0.4, 0.75), 0, 0, 0, { parent: drum, dirt: 0 });
  for (let i = 0; i < NR; i++) { const b = new THREE.BoxGeometry(0.07, 0.06, dl * 0.97); b.translate(0, DRR - 0.02, 0); const m = L.mesh(b, M.plain('#4f565c', 0.5, 0.6), 0, 0, 0, { parent: drum, dirt: 0 }); m.rotation.z = i * rp; }
  for (const z of [-dl / 2, dl / 2]) L.hcyl(DRR + 0.02, 0.06, M.plain('#3a4046', 0.5, 0.6), 0, 0, z, { axis: 'z', parent: drum, dirt: 0 });
  rect(99, -74, 7, 148, 0.25, 1.0, M.plain('#262a2e', 0.6, 0.4), { dirt: 0 });
  R.finish();
}
