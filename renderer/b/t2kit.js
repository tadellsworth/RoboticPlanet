// Shared parts for the terraforming stage 2 scenes (b/composter.js, b/nursery.js, b/wpump.js; the concept scenes
// comp_*, nurs_*, wpump_* on the design canvas used it first): compost heaps, saplings, water, mist, conveyors, and
// `added(fn)`, the objects fn put in the scene (a working loop's moving parts, for worklib.js's workLayer).
export function t2(L) {
  const { THREE, M, mesh, box, cyl, sphere, rnd } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), nf = +(p.get('n') || 8);
  const ph = (f / nf) * Math.PI * 2;
  const compost = M.rough('#3a2818'), compostD = M.rough('#2a1d12'), straw = M.rough('#8a7448');
  const leaf = [M.plain('#3f7a34', 0.85), M.plain('#55933f', 0.85), M.plain('#2e5e2a', 0.85), M.plain('#6aa04a', 0.85)];
  const bark = M.plain('#5a3e26', 0.9);
  // a lumpy dome heap, footprint rx x rz, height h
  function heap(x, z, rx, rz, h, mat = compost, o = {}) {
    const g = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const pos = g.attributes.position, s = o.seed ?? rnd() * 100;
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const n = 1 + 0.12 * Math.sin(vx * 7 + s) * Math.cos(vz * 6 - s) + 0.06 * Math.sin(vx * 17 + vz * 13 + s);
      pos.setXYZ(i, vx * rx * n, vy * h * n, vz * rz * n);
    }
    g.computeVertexNormals();
    return mesh(g, mat, x, o.y ?? 0, z, { dirt: 0, ...o });
  }
  // a windrow: an elongated heap along x
  function windrow(x, z, len, w, h, mat = compost) {
    const n = Math.round(len / (w * 0.9));
    for (let k = 0; k < n; k++) heap(x - len / 2 + w * 0.6 + k * (len - w * 1.2) / (n - 1), z + (rnd() - 0.5) * 0.08, w * (1.0 + rnd() * 0.25), w * (0.95 + rnd() * 0.15), h * (0.85 + rnd() * 0.25), mat);
  }
  // a small tree: trunk + clustered leaf balls; s = 0..1 size
  function tree(x, z, s, o = {}) {
    const H = 0.3 + 1.9 * s, R = 0.12 + 0.75 * s;
    cyl(0.025 + 0.08 * s, H * 0.75, bark, x, o.y ?? 0, z, { seg: 8, dirt: 0 });
    const n = o.conifer ? 0 : 3 + Math.round(5 * s);
    if (o.conifer) {
      const k = 3 + Math.round(2 * s);
      for (let i = 0; i < k; i++) { const t = i / k; const g = new THREE.ConeGeometry(R * (1 - t * 0.7), H * 0.45, 9); g.translate(0, H * 0.22, 0); mesh(g, leaf[2], x, (o.y ?? 0) + H * 0.25 + t * H * 0.55, z, { dirt: 0 }); }
      return;
    }
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.28, d = rnd() * R * 0.55;
      sphere(R * (0.45 + rnd() * 0.3), leaf[(i + Math.floor(rnd() * 4)) % 4], x + Math.cos(a) * d, (o.y ?? 0) + H * (0.7 + rnd() * 0.3), z + Math.sin(a) * d, { dirt: 0 });
    }
  }
  function sapling(x, z, y = 0, s = 0.2) {
    cyl(0.012, 0.18 + s * 0.4, bark, x, y, z, { seg: 5, dirt: 0, cast: false });
    for (let i = 0; i < 3; i++) sphere(0.06 + s * 0.12, leaf[(i + Math.floor(rnd() * 4)) % 4], x + (rnd() - 0.5) * 0.08, y + 0.16 + s * 0.4 + rnd() * 0.06, z + (rnd() - 0.5) * 0.08, { dirt: 0, cast: s > 0.3 });
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: '#1d4f57', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.93 }); waterMat.envMapIntensity = 1.5;
  const mistMat = new THREE.MeshStandardMaterial({ color: '#e8f4ff', roughness: 1, transparent: true, opacity: 0.09, depthWrite: false });
  const steamMat = new THREE.MeshStandardMaterial({ color: '#eeeeea', roughness: 1, transparent: true, opacity: 0.12, depthWrite: false });
  function puff(x, y, z, r, mat = steamMat) { for (let i = 0; i < 4; i++) sphere(r * (0.55 + 0.2 * i), mat, x + (rnd() - 0.5) * r * 0.8, y + (rnd() - 0.5) * r * 0.6, z + (rnd() - 0.5) * r * 0.8, { cast: false, dirt: 0 }); }
  // conveyor between two points (belt + side rails + legs)
  function conveyor(a, b, w = 0.45, mat = M.paint('#50565c')) {
    L.beam(a, b, w, 0.08, M.dark); L.beam([a[0], a[1] + 0.06, a[2] + w / 2], [b[0], b[1] + 0.06, b[2] + w / 2], 0.05, 0.12, mat); L.beam([a[0], a[1] + 0.06, a[2] - w / 2], [b[0], b[1] + 0.06, b[2] - w / 2], 0.05, 0.12, mat);
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / 1.1));
    for (let k = 0; k <= n; k++) { const t = k / n, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t; if (y > 0.1) box(0.06, y, 0.06, M.steel, x, 0, z); }
  }
  // every object fn adds to the scene (wherever it is parented)
  function added(fn) {
    const before = new Set(); L.getRoot().traverse((o) => before.add(o));
    fn();
    const out = new Set(); L.getRoot().traverse((o) => { if (!before.has(o)) out.add(o); });
    return out;
  }
  return { added, f, nf, ph, compost, compostD, straw, leaf, bark, heap, windrow, tree, sapling, waterMat, mistMat, steamMat, puff, conveyor };
}
