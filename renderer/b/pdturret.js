// Space expansion concepts: the Point-Defence Turret, Flak's place on the space maps (1 x 1, on the shared pad).
//   v=a  Twin Rotary: an armoured drum, a yoke carrying two six-barrel rotary guns and a fire-control radar between
//        them; tracers.
//   v=b  Lattice Laser: a low dome with cooling fins, a turret head with a big emitter lens in a hooded mount and two
//        tracking eyes; a beam.
// rot= head yaw in degrees (0 = east), el= elevation in degrees; fire=1 marks the muzzles. Accent (PD orchid) on lamps.
import { space, num, P } from './spacekit.js';

export default function (L) {
  const { THREE, M, ACCENT } = L;
  const K = space(L, { view: 'building', seed: 31 });
  const { G, mat, B, C, S, beam, hc, strip, muzzle, lights } = K;
  const v = P.get('v') || 'a', acc = M.emit(ACCENT, 2.4), rot = num('rot', 200) * Math.PI / 180, el = num('el', 35) * Math.PI / 180;
  const head = new THREE.Group(); head.rotation.y = rot; G.add(head);
  const O = (o = {}) => ({ parent: head, dirt: 0, ...o });
  const dir = (l) => [Math.cos(rot) * Math.cos(el) * l, Math.sin(el) * l, -Math.sin(rot) * Math.cos(el) * l];
  // sandbag-free: a space emplacement, a plinth ring of armour plates
  C(4.4, 0.5, M.concrete, 0, 0, 0, { seg: 8, rTop: 4.1 });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + Math.PI / 8; S(0.16, k % 2 ? acc : mat.glow, Math.cos(a) * 4.0, 0.55, Math.sin(a) * 4.0); }
  if (v === 'a') {
    C(2.6, 1.6, mat.armor, 0, 0.5, 0, { seg: 12, rTop: 2.3 }); C(2.35, 0.12, mat.glow, 0, 1.75, 0, { seg: 12, cast: false });
    L.cyl(2.0, 0.6, mat.top, 0, 2.1, 0, O({ seg: 12 }));
    for (const s of [-1, 1]) {
      L.box(1.2, 1.9, 0.4, mat.armor, 0, 2.6, s * 1.25, O());
      const g = new THREE.Group(); g.position.set(0, 3.5, s * 1.6); g.rotation.z = el; head.add(g);
      L.box(2.0, 0.9, 0.9, mat.top, 0.2, -0.45, 0, { parent: g, dirt: 0 });
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; const gg = new THREE.CylinderGeometry(0.07, 0.07, 3.0, 8); gg.rotateZ(-Math.PI / 2); L.mesh(gg, mat.rail, 2.6, Math.cos(a) * 0.22, Math.sin(a) * 0.22, { parent: g, dirt: 0 }); }
      { const gg = new THREE.CylinderGeometry(0.34, 0.34, 0.3, 12); gg.rotateZ(-Math.PI / 2); L.mesh(gg, mat.steel, 3.6, 0, 0, { parent: g, dirt: 0 }); }
      L.box(0.5, 0.1, 0.5, acc, -0.4, 0.46, 0, { parent: g, dirt: 0, cast: false });
      const m = L.mark('mz' + s, 4.15, 0, 0, g);
      if (num('fire', 0)) { const f = L.sphere(0.4, M.emit('#fff1c2', 4), 4.3, 0, 0, { parent: g, cast: false }); }
    }
    L.box(1.4, 0.9, 1.4, mat.dark, -0.4, 2.7, 0, O()); { const d = L.sphere(0.75, M.plain('#c9c4b8', 0.6, 0.1), -0.4, 3.9, 0, O({ cast: true })); }
    L.box(0.6, 0.1, 0.05, acc, -0.4, 3.0, 0.71, O({ cast: false }));
  }
  if (v === 'b') {
    L.cyl(3.0, 1.2, mat.armor, 0, 0.5, 0, { parent: G, seg: 24, rTop: 2.6, dirt: 0 });
    for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; L.box(0.12, 0.9, 0.9, mat.steel, Math.cos(a) * 2.75, 0.7, Math.sin(a) * 2.75, { parent: G, ry: -a, dirt: 0 }); }
    const dg = new THREE.SphereGeometry(2.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2); L.mesh(dg, mat.top, 0, 1.7, 0, O());
    const g = new THREE.Group(); g.position.set(0, 3.2, 0); g.rotation.z = el; head.add(g);
    L.box(2.6, 1.4, 1.8, mat.armor, 0.2, -0.7, 0, { parent: g, dirt: 0 });
    { const gg = new THREE.CylinderGeometry(0.75, 0.9, 1.5, 16); gg.rotateZ(-Math.PI / 2); L.mesh(gg, mat.dark, 2.1, 0, 0, { parent: g, dirt: 0 }); }
    { const gg = new THREE.CircleGeometry(0.62, 24); gg.rotateY(Math.PI / 2); L.mesh(gg, M.emit(ACCENT, num('fire', 0) ? 5 : 1.6), 2.87, 0, 0, { parent: g, dirt: 0, cast: false }); }
    for (const s of [-1, 1]) { L.box(0.5, 0.5, 0.5, mat.hood, 0.6, 0.75, s * 0.7, { parent: g, dirt: 0 }); L.box(0.05, 0.22, 0.22, mat.visor, 0.86, 0.9, s * 0.7, { parent: g, dirt: 0, cast: false }); }
    for (let k = 0; k < 4; k++) L.box(0.12, 0.25, 1.9, mat.steel, -0.8 + k * 0.4, 0.7, 0, { parent: g, dirt: 0 });
    L.mark('mz1', 2.9, 0, 0, g);
  }
  // the second point along each barrel for post's tracer direction: put it after the head is posed
  L.getRoot().updateMatrixWorld(true);
  for (const s of v === 'a' ? [-1, 1] : [1]) {
    const o = L.getRoot().getObjectByProperty('type', 'Object3D');
  }
  head.updateMatrixWorld(true);
  const pts = [];
  head.traverse((o) => { if (o.type === 'Object3D' && !o.isMesh) pts.push(o); });
  for (const o of pts) { const p = new THREE.Vector3(); o.getWorldPosition(p); const d = dir(1); muzzle(p.x, p.y, p.z, d); }
  K.settle();
}
