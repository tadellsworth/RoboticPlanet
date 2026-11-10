// Paver, top-down 3D, matching the reference sprite (old SVG px coordinates; bounding box centre at x = -2).
// Rear wheels roll a quarter tread block per frame; the front roller turns a quarter of its rib pattern.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, THREE, TEAM } = L;
  L.seed(704);
  const R = kit(L, -2, 0), { rect, rr, ext, disc, strip, hazard, tyre, brake, grime } = R, k = R.k;
  const yel = M.paint('#b8901f'), dark = M.plain('#2a2d31', 0.7, 0.3), black = M.plain('#0b0c0e', 0.8), glow = M.emit(TEAM, 1.1);
  // two small rear wheels
  for (const y of [-61, 61]) tyre(-70, y, 16, 18, { blocks: 14 });
  // chassis and yellow side skirts
  ext(rr(-100, -52, 152, 104, 12), 0.4, 0.7, M.paint('#3f454b'), { bevel: 0.06 });
  for (const y of [-52, 40]) ext(rr(-98, y, 142, 12, 4), 1.1, 0.15, yel, { bevel: 0.03 });
  // black insulated tar tank lying along the vehicle, with straps and a hatch
  const TR = 34 * k, tank = new THREE.CapsuleGeometry(TR, (82 - 68) * k, 8, 32); tank.rotateZ(Math.PI / 2); tank.scale(1, 0.55, 1.06);
  L.mesh(tank, M.plain('#2a2c2e', 0.55, 0.3), -53 * k, 1.1 + TR * 0.55, 0, R.O({ dirt: 0.2, dirtH: 0.8 }));
  for (const x of [-73.5, -35.5]) { const t = new THREE.TorusGeometry(TR * 1.07, 0.045, 8, 40); t.rotateY(Math.PI / 2); t.scale(1, 0.56, 1); L.mesh(t, M.plain('#55595e', 0.5, 0.6), x * k, 1.1 + TR * 0.55, 0, R.O({ dirt: 0 })); }
  disc(-55, 0, 9, 1.1 + TR * 1.1 - 0.05, 0.08, M.plain('#202122', 0.6, 0.3)); L.hoop(9 * k, 0.03, M.plain('#6b7076', 0.5, 0.6), -55 * k, 1.1 + TR * 1.1 + 0.03, 0, R.O());
  rect(-105, -46, 8, 92, 0.5, 0.4, M.plain('#2a2e33', 0.6, 0.4), { dirt: 0 });
  for (const y of [-34, -17, 0, 17, 34]) { disc(-103, y, 2.6, 0.9, 0.03, black); disc(-106.5, y, 2.6, 0.6, 0.25, M.emit('#ff7a1a', 0.9), { cast: false }); }
  ext(rr(-110, -50, 6, 100, 2), 0.5, 0.5, hazard('#ffcf4a'), { bevel: 0.03 });
  brake(-109, -49, 5, 8, 1.0); brake(-109, 41, 5, 8, 1.0);
  // compact cab
  ext(rr(-12, -42, 58, 84, 10), 1.1, 0.9, yel, { bevel: 0.08 });
  grime(-12, -42, 58, 84, 2.0, 0.8, 17);
  rect(-4, -18, 16, 36, 2.0, 0.06, dark, { dirt: 0 });
  for (const y of [-13, -6, 1, 8]) rect(-1, y - 1.2, 10, 2.4, 2.06, 0.01, black, { dirt: 0, cast: false });
  rect(34, -30, 9, 60, 2.0, 0.04, M.plain('#11161a', 0.15, 0.6), { dirt: 0 });
  disc(26, 0, 9.5, 2.0, 0.12, M.plain('#14171a', 0.4, 0.5)); disc(26, 0, 10.5, 2.0, 0.1, M.plain('#5e666d', 0.5, 0.6));
  disc(27, 0, 6.5, 2.12, 0.03, R.eye(TEAM), { cast: false }); disc(24.5, -2.5, 2, 2.15, 0.01, M.emit('#ffffff', 0.35), { cast: false });
  disc(4, -30, 7.5, 2.0, 0.12, M.plain('#22262a', 0.6, 0.4)); disc(4, -30, 5.2, 2.12, 0.08, M.emit('#ffb22e', 1.8), { cast: false });
  // roller frame (hazard yoke), cross beam, steel drum with turning ribs, scraper bar
  for (const y of [-84, 73]) ext(rr(44, y, 58, 11, 3), 0.5, 1.1, hazard('#ffcf4a'), { bevel: 0.04 });
  rect(44, -74, 10, 148, 1.0, 0.5, M.plain('#3a4046', 0.6, 0.5), { dirt: 0 });
  const DRR = 22 * k, dl = 146 * k, NR = 20, rp = Math.PI * 2 / NR;
  const drum = L.group(77 * k, DRR + 0.02, 0, 0, R.G); drum.rotation.z = -R.f * rp / 4;
  const dgeo = new THREE.CylinderGeometry(DRR - 0.03, DRR - 0.03, dl, 48, 1); dgeo.rotateX(Math.PI / 2);
  L.mesh(dgeo, M.plain('#8d969c', 0.4, 0.75), 0, 0, 0, { parent: drum, dirt: 0 });
  for (let i = 0; i < NR; i++) { const b = new THREE.BoxGeometry(0.07, 0.06, dl * 0.97); b.translate(0, DRR - 0.02, 0); const m = L.mesh(b, M.plain('#4f565c', 0.5, 0.6), 0, 0, 0, { parent: drum, dirt: 0 }); m.rotation.z = i * rp; }
  for (const z of [-dl / 2, dl / 2]) L.hcyl(DRR + 0.02, 0.06, M.plain('#3a4046', 0.5, 0.6), 0, 0, z, { axis: 'z', parent: drum, dirt: 0 });
  rect(99, -74, 7, 148, 0.25, 1.0, M.plain('#262a2e', 0.6, 0.4), { dirt: 0 });
  // team running strips
  for (const y of [-55, 52]) rect(-96, y, 138, 3, 1.26, 0.04, glow, { dirt: 0, cast: false });
  R.finish();
}
