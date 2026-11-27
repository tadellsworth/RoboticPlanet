// The Tree Nursery (BDEFS.nursery; the owner's pick from the stage 2 concept canvas, concept C "Pivot"): a round
// nursery bed of saplings in rings, older at the rim, watered by a centre-pivot boom on wheeled towers that sweeps
// round it, spraying; a seed store and a pump skid in the corners.
//   ?f=k            the boom's sweep (k of 8): a two-armed boom, half a turn a loop, so the loop is seamless
//   ?part=work&f=k  only the boom and its spray (nursery-work-0..7; the rest is depth only)
//   ?part=base      the nursery without the boom (nursery-base@T: drawn under the loop while it works)
// Team-coloured (the power kit's strips): render one image per team.
import { power } from './powerkit.js';
import { t2 } from './t2kit.js';
import { workLayer, hideParts } from './worklib.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, mesh, sphere, rnd, M, THREE, ACCENT } = L;
  const K2 = t2(L), { sapling, tree, f, nf } = K2;
  const part = new URLSearchParams(location.search).get('part');
  L.seed(883);
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), yel = M.paint('#c49a2c', { rivets: false });
  const cx = -0.3, cz = -0.5, R = 3.9;
  cyl(R + 0.15, 0.1, M.concrete, cx, 0, cz, { seg: 64 });
  const soil = M.rough('#4a3626'); cyl(R, 0.06, soil, cx, 0.1, cz, { seg: 64, dirt: 0 });
  // rings of saplings, bigger toward the rim
  for (let r = 0.9; r < R - 0.2; r += 0.55) {
    const n = Math.floor(2 * Math.PI * r / 0.42), s = (r - 0.9) / (R - 1.1);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + r; const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (s > 0.7 && k % 2 === 0) tree(x, z, 0.12 + 0.12 * s, { y: 0.16, conifer: k % 4 === 0 }); else sapling(x, z, 0.16, 0.1 + 0.35 * s); }
  }
  // pivot centre
  cyl(0.35, 2.4, M.paint('#3f4449'), cx, 0.1, cz, { seg: 20 }); cyl(0.5, 0.3, gun, cx, 0.1, cz, { seg: 20 });
  hoop(0.36, 0.04, M.emit(ACCENT, 2.2), cx, 2.0, cz, { cast: false });
  // the boom: two arms from the centre out to the rim, each on two wheeled towers, with drop sprinklers
  const a0 = (f / nf) * Math.PI + 0.35;
  const boom = K2.added(() => {
    for (const a of [a0, a0 + Math.PI]) {
      const B = L.group(cx, 0, cz, a), W = ([x, y, z]) => [cx + x * Math.cos(a) + z * Math.sin(a), y, cz - x * Math.sin(a) + z * Math.cos(a)];
      const bm = (p, q, w, h, m) => beam(W(p), W(q), w, h, m);
      bm([0.3, 2.3, 0], [R + 0.2, 2.0, 0], 0.12, 0.12, yel);
      for (const t of [0.35, 0.7]) bm([R * t - 0.6, 2.25, 0], [R * t + 0.6, 2.1, 0], 0.05, 0.05, M.steel);
      for (const t of [0.5, 0.95]) {
        const x = R * t;
        bm([x, 2.1, 0], [x - 0.2, 0.3, -0.35], 0.07, 0.07, yel); bm([x, 2.1, 0], [x - 0.2, 0.3, 0.35], 0.07, 0.07, yel);
        for (const z of [-0.38, 0.38]) { const w = new THREE.CylinderGeometry(0.25, 0.25, 0.14, 16); w.rotateX(Math.PI / 2); mesh(w, M.dark, x - 0.2, 0.36, z, { parent: B, dirt: 0 }); }
      }
      for (let x = 0.7; x < R; x += 0.5) {
        box(0.03, 0.5, 0.03, M.steel, x, 1.6, 0, { parent: B, dirt: 0 });
        for (let k = 0; k < 3; k++) sphere(0.16 + 0.08 * k, K2.mistMat, x + (rnd() - 0.5) * 0.2, 1.4 - k * 0.38, (rnd() - 0.5) * 0.25, { parent: B, cast: false, dirt: 0 });
      }
    }
  });
  // corners: seed store (back right) and pump skid (front left)
  box(1.4, 1.3, 1.2, off, 3.9, 0, -3.8); box(1.5, 0.12, 1.3, gun, 3.9, 1.3, -3.8, { dirt: 0 });
  box(0.05, 0.3, 0.7, M.emit(ACCENT, 1.4), 3.17, 0.7, -3.8, { cast: false });
  box(1.3, 0.6, 0.9, gun, -3.9, 0, 3.7); hcyl(0.3, 0.9, M.paint('#3a6f8a'), -3.9, 0.9, 3.7, { axis: 'x' });
  pipe([[-3.4, 0.3, 3.4], [cx, 0.3, cz + 0.2], [cx, 0.3, cz]], 0.08, M.steel);
  if (part === 'work') { workLayer(L, boom); return; }
  if (part === 'base') hideParts(boom);
  const K = power(L);
  for (const [x, z] of [[-4.3, -4.3], [4.3, 4.3]]) K.flood(x, z, 2.2, 0);
  K.beacon(cx, 2.55, cz); K.beacon(3.9, 1.5, -3.8, '#ffb347');
  K.junction(4.2, 3.2, -Math.PI / 2);
}
