// Space expansion concepts: drifting asteroids, the small rocks that drift through the void between the rocks and decks.
//   c=plain    grey-coral regolith, the Ring's own rock
//   c=ore      Ore-bearing: rust-orange metal nodules and veins breaking the crust
//   c=crystal  Crystal-bearing: Ring Crystal (violet) clusters growing out of it, glowing faintly
// s= size (world units across, ~8 a tile), k= seed; tow=1: a tow harness (a clamp band, three claws, a cable led off
// to the west toward the Shuttle that pulls it); spin= turn in degrees. view=top|hero.
import { space, num, P } from './spacekit.js';
export const config = { pad: false, size: 1024 };

export function rock(K, c, o = {}) {
  const { L, THREE, M, G, mat } = K;
  const sz = o.s ?? 7, seed = o.k ?? 3, y0 = o.y ?? 0;
  let sd = seed * 7919 + 13; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const g = new THREE.IcosahedronGeometry(sz / 2, 4), p = g.attributes.position, v = new THREE.Vector3();
  const bumps = Array.from({ length: 9 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.15 + r() * 0.25, r() < 0.5 ? -1 : 1]);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const n = v.clone().normalize(); let k = 1;
    for (const [d, w, s] of bumps) { const t = n.dot(d); if (t > 1 - w) k += s * 0.18 * ((t - (1 - w)) / w) ** 2; }
    k += (Math.sin(n.x * 9 + seed) * Math.sin(n.y * 7) * Math.sin(n.z * 8 + seed)) * 0.05;
    v.copy(n.multiplyScalar(sz / 2 * k)); v.y *= 0.72; p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const rk = M.rough(c === 'ore' ? '#6e625a' : '#857b74');
  const m = L.mesh(g, rk, 0, y0, 0, { parent: G, dirt: 0.35, dirtH: sz });
  m.rotation.y = (o.spin ?? 0) * Math.PI / 180;
  // pick surface points on the upper half for the seams
  const surf = (n) => { const out = []; for (let i = 0; i < p.count && out.length < n; i += 7 + Math.floor(r() * 19)) { v.fromBufferAttribute(p, i); if (v.y > -sz * 0.05) out.push(v.clone()); } return out; };
  if (c === 'ore') {
    const ore = M.plain('#b0602a', 0.45, 0.7), oreD = M.plain('#7a3a1a', 0.6, 0.5);
    for (const q of surf(22)) { const s2 = 0.25 + r() * 0.55; const gg = new THREE.DodecahedronGeometry(s2, 0); const mm = L.mesh(gg, r() < 0.6 ? ore : oreD, q.x * 0.97, q.y * 0.97, q.z * 0.97, { parent: m, dirt: 0 }); mm.rotation.set(r() * 3, r() * 3, r() * 3); }
    for (const q of surf(8)) L.sphere(0.12, M.emit('#ff8a3d', 1.2), q.x * 1.02, q.y * 1.02, q.z * 1.02, { parent: m, cast: false });
  }
  if (c === 'crystal') {
    const cr = M.crystal('#6a52ff', '#5440e6', 0.7);
    for (const q of surf(14)) { const n = q.clone().normalize(); const len = 0.8 + r() * 1.6;
      for (let j = 0; j < 3; j++) { const gg = new THREE.ConeGeometry(0.22 + r() * 0.18, len * (0.6 + r() * 0.6), 6); gg.translate(0, len * 0.4, 0);
        const mm = L.mesh(gg, cr, q.x, q.y, q.z, { parent: m, dirt: 0 }); mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.7)).normalize()); } }
  }
  return m;
}

export default function (L) {
  const c = P.get('c') || 'plain', view = P.get('view') || 'top', s = num('s', 7);
  const K = space(L, { view, W: num('W', 12), hero: { half: num('half', 5), width: 0.7, cy: 0.5 } });
  const y = view === 'hero' ? num('alt', 3) + s * 0.36 : 0;
  rock(K, c, { s, k: num('k', 3), y, spin: num('spin', 0) });
  if (num('tow', 0)) {
    const { G, mat, B, C, beam, S } = K, THREE = L.THREE;
    const g = new THREE.TorusGeometry(s * 0.55, 0.2, 6, 32); g.rotateX(Math.PI / 2); L.mesh(g, mat.steel, 0, y + s * 0.12, 0, { parent: G, dirt: 0 });
    for (const a of [Math.PI * 0.75, Math.PI, Math.PI * 1.25]) { const x = Math.cos(a) * s * 0.55, z = Math.sin(a) * s * 0.55;
      beam([x, y + s * 0.12, z], [x * 1.25 - 0.6, y + s * 0.12, z * 1.1], 0.22, 0.22, mat.armor); S(0.12, mat.amber, x, y + s * 0.12 + 0.2, z); }
    beam([-s * 0.58 - 0.6, y + s * 0.12, 0], [-s * 0.95 - 4, y + s * 0.12, 0], 0.08, 0.08, mat.black);
    for (const z of [-0.9, 0, 0.9]) beam([-s * 0.58 - 0.6, y + s * 0.12, z * s * 0.4], [-s * 0.58 - 1.6, y + s * 0.12, 0], 0.06, 0.06, mat.black);
  }
  K.settle();
}
