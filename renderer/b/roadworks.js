// Roadworks: equipment yard with a strip of fresh asphalt, a road roller and a paver at work, traffic cones,
// a machine shed with beacons, and a gravel stockpile.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, rnd, group, M, THREE, ACCENT } = L;
  const yel = M.paint('#c9a028'), gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), rib = M.ribbed('#a9a296');
  L.seed(171);

  // fresh road strip across the front with markings; the left end still unpaved gravel
  const asphaltTex = L.canvasTex(512, (g, n) => { g.fillStyle = '#2a2a2b'; g.fillRect(0, 0, n, n); for (let i = 0; i < 9000; i++) { const v = 30 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * n, Math.random() * n, 2, 2); } });
  const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.85, metalness: 0, vertexColors: true });
  box(6.6, 0.1, 3.0, asphalt, 0.9, 0, 2.3, { dirt: 0 });
  box(2.6, 0.08, 3.0, M.rough('#8a8070'), -3.1, 0, 2.3, { dirt: 0 });
  for (let x = -2.2; x < 4.0; x += 1.0) box(0.55, 0.012, 0.12, M.plain('#e2b52c', 0.6), x, 0.1, 2.3, { dirt: 0, cast: false });
  box(6.6, 0.012, 0.08, M.plain('#e6e2d8', 0.6), 0.9, 0.1, 0.95, { dirt: 0, cast: false }); box(6.6, 0.012, 0.08, M.plain('#e6e2d8', 0.6), 0.9, 0.1, 3.65, { dirt: 0, cast: false });

  // road roller (on the asphalt, facing left)
  const rx = 1.9, rz = 2.4;
  hcyl(0.6, 1.5, M.steel, rx - 1.1, 0.62, rz, { axis: 'z', seg: 36 }); hcyl(0.6, 1.5, M.steel, rx + 1.0, 0.62, rz, { axis: 'z', seg: 36 });
  box(0.6, 0.5, 1.7, yel, rx - 1.1, 1.0, rz, { dirt: 0 }); box(0.6, 0.5, 1.7, yel, rx + 1.0, 1.0, rz, { dirt: 0 });
  box(1.4, 0.9, 1.4, yel, rx, 0.75, rz); box(0.9, 0.8, 1.1, M.plain('#1f2a30', 0.15, 0.4), rx + 0.1, 1.65, rz);
  box(1.2, 0.1, 1.3, yel, rx + 0.1, 2.45, rz, { dirt: 0 }); for (const [dx, dz] of [[-0.45, -0.5], [0.6, -0.5], [-0.45, 0.5], [0.6, 0.5]]) box(0.06, 0.8, 0.06, M.dark, rx + dx, 1.65, rz + dz, { dirt: 0 });
  lamp(rx + 0.1, 2.6, rz, ACCENT, { shape: 'sphere', size: 0.13, intensity: 3, dist: 3, k: 2.6 });
  ao(rx, rz, 3.0, 1.8, 0.5);

  // paver (at the edge of the unpaved section)
  const px = -1.7, pz = 2.3;
  box(1.9, 0.7, 2.2, yel, px, 0.15, pz); box(1.0, 0.5, 2.4, M.dark, px + 1.15, 0.12, pz, { dirt: 0 });
  box(0.8, 0.6, 2.0, yel, px - 1.2, 0.5, pz); box(0.1, 0.55, 2.0, yel, px - 1.55, 0.85, pz, { dirt: 0 });
  for (let i = 0; i < 10; i++) mesh(new THREE.DodecahedronGeometry(0.12, 0), M.rough('#3a3532'), px - 1.2 + (rnd() - 0.5) * 0.5, 1.1, pz + (rnd() - 0.5) * 1.6, { dirt: 0 });
  box(0.9, 0.7, 0.8, M.plain('#1f2a30', 0.15, 0.4), px + 0.2, 0.85, pz - 0.2); box(1.1, 0.1, 1.0, yel, px + 0.2, 1.75, pz - 0.2, { dirt: 0 });
  for (const s of [-1, 1]) box(1.9, 0.3, 0.3, M.dark, px, 0.0, pz + s * 1.0, { dirt: 0 });
  lamp(px + 0.2, 1.9, pz - 0.2, ACCENT, { shape: 'sphere', size: 0.13, intensity: 3, dist: 3, k: 2.6 });
  ao(px, pz, 3.2, 2.4, 0.5);

  // traffic cones along the road edge
  const cone = M.paint('#e0632a', { rivets: false }), band = M.plain('#e9e6de', 0.5);
  for (const x of [-4.2, -3.3, -2.4, 4.0, 4.4]) { box(0.36, 0.05, 0.36, M.dark, x, 0, 4.05, { dirt: 0 }); mesh(new THREE.ConeGeometry(0.16, 0.62, 16), cone, x, 0.36, 4.05, { dirt: 0 }); cyl(0.105, 0.09, band, x, 0.36, 4.05, { rTop: 0.085, seg: 16, dirt: 0 }); }

  // machine shed (back left) with open bays and beacons
  const sx = -1.6, sz = -2.6;
  box(5.4, 2.6, 2.8, rib, sx, 0, sz); box(5.6, 0.2, 3.0, gun, sx, 2.6, sz, { dirt: 0 }); ao(sx, sz, 5.4, 2.8);
  for (const dx of [-1.6, 0.4]) { box(1.6, 2.0, 0.06, M.dark, sx + dx, 0, sz + 1.41, { dirt: 0.4 }); box(1.8, 0.14, 0.1, M.hazard, sx + dx, 2.0, sz + 1.42, { dirt: 0 }); }
  box(0.9, 1.0, 0.06, M.plain('#26323a', 0.2, 0.3), sx + 2.0, 0.9, sz + 1.41, { dirt: 0 });
  lamp(sx - 2.4, 2.95, sz + 1.2, ACCENT, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 2.6 });
  lamp(sx + 2.4, 2.95, sz + 1.2, ACCENT, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 2.6 });

  // gravel stockpile and barriers (back right)
  const pile = new THREE.ConeGeometry(1.2, 1.3, 28); pile.translate(0, 0.65, 0); mesh(pile, M.rough('#8f8a82'), 3.4, 0, -2.6, { dirt: 0 }); ao(3.4, -2.6, 2.2, 2.2, 0.5);
  for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, h = rnd() * 1.1, r = 1.2 * (1 - h / 1.3); mesh(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.08, 0), M.rough('#7a756d'), 3.4 + Math.cos(a) * r, h, -2.6 + Math.sin(a) * r, { dirt: 0 }); }
  for (const z of [-0.6, -0.1]) { box(1.4, 0.55, 0.3, M.paint('#d7d2c6', { rivets: false }), 3.3, 0, z); box(1.42, 0.14, 0.32, M.hazard, 3.3, 0.3, z, { dirt: 0 }); }
}
