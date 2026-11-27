// The Water Pump (BDEFS.wpump; the owner's pick from the stage 2 concept canvas, concept B "Screw Lift"; its art key
// is wpump, as the Oil Pump's is pump): a big inclined Archimedes screw in an open steel trough lifts water from a sump
// at the back edge (the water side) up to a raised header tank, which feeds the pipe network out of the front; a drive
// house at the top, a control kiosk.
//   ?f=k            the screw's turn (k of 8: one turn a loop) and the water spilling into the tank
//   ?part=work&f=k  only the screw's flights and the spill (wpump-work-0..7; the rest is depth only)
// Team-coloured (the power kit's strips): render one image per team. The working loop is the same for every team.
import { power } from './powerkit.js';
import { t2 } from './t2kit.js';
import { workLayer } from './worklib.js';
export default function (L) {
  const { box, cyl, pipe, hoop, ao, mesh, sphere, rnd, M, THREE, ACCENT } = L;
  const K2 = t2(L), { ph, f } = K2;
  const WORK = new URLSearchParams(location.search).get('part') === 'work';
  L.seed(1102);
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), blue = M.paint('#3a6f8a'), yel = M.paint('#c49a2c', { rivets: false }), pipeM = M.paint('#5d7480', { rivets: false });
  const moving = new Set();
  // sump (back left)
  const sx = -2.6, sz = -3.4;
  for (const [w, d, x, z] of [[3.4, 0.2, 0, -0.9], [3.4, 0.2, 0, 0.9], [0.2, 2.0, -1.6, 0], [0.2, 2.0, 1.6, 0]]) box(w, 0.35, d, M.concrete, sx + x, 0, sz + z);
  box(3.0, 0.02, 1.6, K2.waterMat, sx, 0.2, sz, { cast: false, dirt: 0 }); box(3.0, 0.02, 1.6, M.plain('#14262a', 0.9), sx, 0.05, sz, { dirt: 0 });
  // the screw: from the sump (low, back) to the header (high, front right), along a tilted axis
  const A = new THREE.Vector3(sx + 0.4, 0.2, sz), B = new THREE.Vector3(1.6, 3.2, 0.4);
  const len = A.distanceTo(B), G = L.group(0, 0, 0, 0); G.position.copy(A).add(B).multiplyScalar(0.5); G.lookAt(B);
  const tg = new THREE.CylinderGeometry(0.85, 0.85, len, 32, 1, true, -Math.PI / 2, Math.PI); tg.rotateX(Math.PI / 2);
  const tm = M.paint('#4a5056'); tm.side = THREE.DoubleSide; mesh(tg, tm, 0, 0, 0, { parent: G, dirt: 0.3 });
  const cg = new THREE.CylinderGeometry(0.22, 0.22, len, 16); cg.rotateX(Math.PI / 2); mesh(cg, M.steel, 0, 0, 0, { parent: G, dirt: 0 });
  const turns = 11, seg = 260;
  class Helix extends THREE.Curve { getPoint(t) { const a = t * turns * Math.PI * 2 + ph; return new THREE.Vector3(Math.cos(a) * 0.6, Math.sin(a) * 0.6, (t - 0.5) * len); } }
  moving.add(mesh(new THREE.TubeGeometry(new Helix(), seg, 0.07, 6), yel, 0, 0, 0, { parent: G, dirt: 0 }));
  // water carried in the lower half of the trough
  const wg = new THREE.CylinderGeometry(0.7, 0.7, len * 0.92, 20, 1, true, -Math.PI * 0.3, Math.PI * 0.6); wg.rotateX(Math.PI / 2);
  mesh(wg, K2.waterMat, 0, 0, 0, { parent: G, cast: false, dirt: 0 });
  // supports
  for (const t of [0.25, 0.6]) { const p = A.clone().lerp(B, t); box(0.3, p.y - 0.6, 0.3, gun, p.x, 0, p.z); box(1.8, 0.2, 0.3, gun, p.x, p.y - 0.8, p.z, { ry: Math.atan2(B.x - A.x, B.z - A.z) + Math.PI / 2 }); }
  // drive house at the top end
  box(1.4, 1.2, 1.4, off, B.x + 0.6, B.y - 0.3, B.z + 0.4); box(1.5, 0.12, 1.5, gun, B.x + 0.6, B.y + 0.9, B.z + 0.4, { dirt: 0 });
  box(0.5, B.y - 0.3, 0.5, gun, B.x + 0.6, 0, B.z + 0.4);
  box(0.05, 0.3, 0.8, M.emit(ACCENT, 1.5), B.x + 1.31, B.y + 0.2, B.z + 0.4, { cast: false });
  // header tank under the screw's top, water spilling in
  cyl(1.1, 1.6, blue, 2.2, 0.25, 2.0, { seg: 36 }); box(2.6, 0.25, 2.6, M.concrete, 2.2, 0, 2.0);
  cyl(1.05, 0.02, K2.waterMat, 2.2, 1.82, 2.0, { seg: 36, cast: false, dirt: 0 }); hoop(1.11, 0.04, M.emit(ACCENT, 2.2), 2.2, 1.5, 2.0, { cast: false });
  L.beam([B.x, B.y - 0.6, B.z], [2.0, 1.95, 1.4], 0.5, 0.06, M.steel);
  for (const o of K2.added(() => { for (let k = 0; k < 4; k++) sphere(0.1 + 0.05 * ((k + f) % 4), K2.mistMat, 2.0 + (rnd() - 0.5) * 0.4, 1.9 + k * 0.08, 1.4 + (rnd() - 0.5) * 0.3, { cast: false, dirt: 0 }); })) moving.add(o);
  // outlet: from the tank to the front edge of the pad
  pipe([[2.2, 0.5, 3.0], [2.2, 0.5, 4.9]], 0.2, pipeM);
  pipe([[1.2, 0.5, 2.0], [-1.0, 0.5, 2.0], [-1.0, 0.5, 4.9]], 0.2, pipeM);
  box(0.1, 0.5, 0.1, M.steel, -1.0, 0.6, 3.4, { dirt: 0 }); hoop(0.2, 0.03, M.paint('#b0302a', { rivets: false }), -1.0, 1.12, 3.4);
  // control kiosk (front left)
  box(1.2, 1.3, 1.0, off, -3.5, 0, 2.6); box(1.3, 0.12, 1.1, gun, -3.5, 1.3, 2.6, { dirt: 0 }); ao(-3.5, 2.6, 1.2, 1.0, 0.45);
  if (WORK) { workLayer(L, moving); return; }
  const K = power(L);
  K.strip(3.4, sx, 0.32, sz + 1.02); K.strip(1.3, -3.5, 1.43, 3.17);
  K.flood(-4.3, -0.6, 2.2, 0.4); K.flood(4.3, -1.0, 2.2, -0.4);
  K.beacon(B.x + 0.6, B.y + 1.1, B.z + 0.4); K.beacon(-3.2, 1.55, 2.2, '#ffb347');
  K.junction(4.2, 3.6, -Math.PI / 2);
}
