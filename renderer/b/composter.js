// The Composter (BDEFS.composter; the owner's pick from the stage 2 concept canvas, concept A "Drum"): a long rotary
// composting drum on roller cradles, fed by a conveyor from a waste hopper, spilling dark humus onto a heap at its far
// end; a vent stack over a biofilter box, a control hut, bagged humus on pallets. Its accent is an earthy amber, not the
// Chip Fab's lime.
//   ?f=k            the drum's turn (k of 8: one rib's pitch a loop, so the loop is seamless) and the steam
//   ?part=work&f=k  only the drum and the steam (the working loop, composter-work-0..7; the rest is depth only)
// Team-coloured (the power kit's strips): render one image per team. The working loop is the same for every team.
import { power } from './powerkit.js';
import { t2 } from './t2kit.js';
import { workLayer } from './worklib.js';
export default function (L) {
  const { box, hcyl, pipe, hoop, pointLight, ao, mesh, M, THREE, ACCENT } = L;
  const K2 = t2(L), { heap, conveyor, puff, ph, f, nf } = K2;
  const WORK = new URLSearchParams(location.search).get('part') === 'work';
  L.seed(331);
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), rust = M.ribbed('#5d5446', { period: 40 });
  const ochre = M.paint('#9c7a3c', { rivets: false });
  const moving = new Set();
  // drum: along x, tilted slightly
  const dx = -0.3, dz = -0.9, dy = 1.75, R = 1.35, LEN = 6.4, RIBS = 7;
  box(LEN + 0.6, 0.25, 2.9, M.concrete, dx, 0, dz); ao(dx, dz, LEN, 2.9, 0.55);
  const g = L.group(dx, dy, dz, 0); g.rotation.z = 0.04;
  const drum = L.group(0, 0, 0, 0, g); drum.rotation.x = (f / nf) * (Math.PI * 2 / RIBS); // one rib's pitch a loop
  moving.add(drum);
  const dg = new THREE.CylinderGeometry(R, R, LEN, 48, 1); dg.rotateZ(Math.PI / 2);
  mesh(dg, rust, 0, 0, 0, { parent: drum, dirt: 0.4 });
  for (let k = 0; k < RIBS; k++) { const a = (k / RIBS) * Math.PI * 2; box(LEN - 0.4, 0.12, 0.22, M.paint('#3f4449'), 0, 0, 0, { parent: L.group(0, Math.cos(a) * R, Math.sin(a) * R, 0, drum), dirt: 0 }); }
  for (const s of [-1, 1]) { const tg = new THREE.TorusGeometry(R + 0.08, 0.14, 10, 56); tg.rotateY(Math.PI / 2); mesh(tg, M.steel, s * (LEN / 2 - 0.9), 0, 0, { parent: g, dirt: 0 }); }
  // accent bands (lit) near each end
  for (const s of [-1, 1]) { const tg = new THREE.TorusGeometry(R + 0.03, 0.04, 6, 56); tg.rotateY(Math.PI / 2); mesh(tg, M.emit(ACCENT, 2.2), s * (LEN / 2 - 0.45), 0, 0, { parent: g, dirt: 0, cast: false }); }
  // cradles and rollers
  for (const s of [-1, 1]) {
    const x = dx + s * (LEN / 2 - 0.9);
    for (const zz of [-0.95, 0.95]) { box(0.5, dy - 0.85, 0.35, gun, x, 0.25, dz + zz); hcyl(0.22, 0.5, M.steel, x, dy - R + 0.05 - 0.15 + 0.35, dz + zz * 0.9, { axis: 'x' }); }
    box(0.7, 0.3, 2.6, gun, x, 0.25, dz);
  }
  // drive motor + gear ring
  box(0.8, 0.7, 0.7, off, dx - LEN / 2 + 1.6, 0.25, dz + 1.75); hcyl(0.18, 0.6, M.steel, dx - LEN / 2 + 1.6, 0.85, dz + 1.35, { axis: 'z' });
  // end caps: feed (west) and discharge (east)
  const capW = new THREE.CylinderGeometry(R * 0.95, R * 0.95, 0.3, 40); capW.rotateZ(Math.PI / 2);
  mesh(capW, gun, -LEN / 2 - 0.1, 0, 0, { parent: g, dirt: 0 }); mesh(capW.clone(), gun, LEN / 2 + 0.1, 0, 0, { parent: g, dirt: 0 });
  // hopper + conveyor into the west end
  const hx = -4.0, hz = 2.6;
  box(1.4, 0.9, 1.4, gun, hx, 0, hz);
  const hg = new THREE.CylinderGeometry(1.05, 0.6, 0.9, 4, 1, true); hg.rotateY(Math.PI / 4); hg.translate(0, 0.45, 0);
  mesh(hg, ochre, hx, 0.9, hz, { dirt: 0.3 }); mesh(hg.clone(), M.dark, hx, 0.92, hz, { dirt: 0 });
  heap(hx, hz, 0.7, 0.7, 0.35, K2.straw, { y: 1.25 });
  conveyor([hx + 0.3, 1.2, hz - 0.6], [dx - LEN / 2 - 0.2, dy + 0.4, dz], 0.42, ochre);
  // discharge chute + humus heap (east, front)
  const ex = dx + LEN / 2 + 0.3;
  L.beam([ex, dy - 0.3, dz + 0.2], [ex + 0.6, 0.9, dz + 1.6], 0.6, 0.1, M.steel);
  heap(ex + 0.7, dz + 2.6, 1.3, 1.0, 0.95, K2.compostD);
  heap(ex - 0.4, dz + 3.0, 0.7, 0.55, 0.45, K2.compost);
  // vent stack with biofilter box and steam
  box(1.2, 1.0, 1.0, M.paint('#3f4449'), 2.6, 0, -3.6);
  L.cyl(0.22, 3.3, M.steel, 3.0, 1.0, -3.6, { soot: 0.6 }); hoop(0.25, 0.04, M.emit(ACCENT, 2), 3.0, 4.0, -3.6, { cast: false });
  pipe([[dx + LEN / 2 + 0.1, dy + 0.6, dz], [2.6, dy + 0.6, -3.1], [2.6, 1.0, -3.1]], 0.12, M.steel);
  const s = (Math.sin(ph) + 1) / 2;
  for (const o of K2.added(() => {
    puff(3.0, 4.6 + s * 0.3, -3.6, 0.35); puff(3.15, 5.2 + s * 0.4, -3.75, 0.45);
    puff(ex + 0.6, 1.4 + s * 0.2, dz + 2.5, 0.35, K2.steamMat);
  })) moving.add(o);
  // bagged humus on pallets (front middle)
  for (let i = 0; i < 3; i++) { box(0.9, 0.12, 0.7, M.wood, 0.6 + i * 1.05, 0, 3.2); box(0.8, 0.45, 0.6, M.plain('#3d4a2c', 0.9), 0.6 + i * 1.05, 0.12, 3.2); }
  ao(1.65, 3.2, 3.2, 0.8, 0.4);
  // control hut (front-left)
  box(1.5, 1.4, 1.1, off, -1.6, 0, 3.4); box(1.6, 0.12, 1.2, gun, -1.6, 1.4, 3.4, { dirt: 0 }); ao(-1.6, 3.4, 1.5, 1.1, 0.45);
  box(0.8, 0.3, 0.05, M.emit(ACCENT, 1.4), -1.6, 0.8, 3.96, { cast: false });
  pointLight(ACCENT, 6, ex + 0.5, 1.6, dz + 2.2, 4);
  if (WORK) { workLayer(L, moving); return; }
  // power layer (not in the working loop: that stays shared by every team)
  const K = power(L);
  K.strip(LEN - 0.6, dx, 0.27, dz + 1.47);
  K.strip(1.6, -1.6, 1.53, 3.97);
  K.flood(-3.0, 0.9, 2.3, 0.4); K.flood(4.0, 1.2, 2.2, -0.4);
  K.beacon(3.0, 4.15, -3.6); K.beacon(-1.25, 1.62, 3.0, '#ffb347');
  K.junction(4.0, -1.0, 0);
}
