// Roadworks: equipment yard with a strip of fresh asphalt, a road roller and a paver at work, traffic cones,
// a machine shed with beacons, and a gravel stockpile.
// Powered realism (b/powerkit.js): a team strip along the shed's roof edge and over its bays, lit bay interiors and
// window, a mobile light tower lighting the road, team road studs along the road edges, a transformer and junction
// box between the shed and the gravel with conduits with glowing collars to the shed and the light tower, a cable,
// beacons. Team-coloured: render one image per team.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, rnd, group, M, THREE, ACCENT } = L;
  const yel = M.paint('#c9a028'), gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), rib = M.ribbed('#a9a296');
  const P = power(L), nc = { dirt: 0, cast: false };
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
  P.windows(0.8, 0.42, sx + 2.0, 1.35, sz + 1.45, 0, 2);
  lamp(sx - 2.4, 2.95, sz + 1.2, ACCENT, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 2.6 });
  lamp(sx + 2.4, 2.95, sz + 1.2, ACCENT, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 2.6 });

  // gravel stockpile and barriers (back right)
  const pile = new THREE.ConeGeometry(1.2, 1.3, 28); pile.translate(0, 0.65, 0); mesh(pile, M.rough('#8f8a82'), 3.4, 0, -2.6, { dirt: 0 }); ao(3.4, -2.6, 2.2, 2.2, 0.5);
  for (let i = 0; i < 18; i++) { const a = rnd() * 6.28, h = rnd() * 1.1, r = 1.2 * (1 - h / 1.3); mesh(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.08, 0), M.rough('#7a756d'), 3.4 + Math.cos(a) * r, h, -2.6 + Math.sin(a) * r, { dirt: 0 }); }
  for (const z of [-0.6, -0.1]) { box(1.4, 0.55, 0.3, M.paint('#d7d2c6', { rivets: false }), 3.3, 0, z); box(1.42, 0.14, 0.32, M.hazard, 3.3, 0.3, z, { dirt: 0 }); }

  // ================================================================ power layer (lights and electricity)
  // team strip along the shed's roof edge; a team strip and a work light over each bay, warm light inside
  P.strip(5.5, sx, 2.66, sz + 1.53, 0, 0.07);
  for (const dx of [-1.6, 0.4]) {
    box(1.5, 0.05, 0.05, P.glow, sx + dx, 2.16, sz + 1.5, nc);
    box(0.5, 0.08, 0.1, P.steelD, sx + dx, 1.92, sz + 1.5, { dirt: 0 }); box(0.42, 0.03, 0.08, P.white, sx + dx, 1.9, sz + 1.52, nc);
    pointLight('#ffd9a0', 3, sx + dx, 1.4, sz + 1.0, 2.6);
  }
  // mobile light tower in the yard, lamps aimed at the road; a team beacon on the mast
  const lx = -3.55, lz = -0.25;
  box(1.3, 0.55, 0.75, yel, lx, 0.22, lz); box(1.36, 0.08, 0.8, gun, lx, 0.77, lz, { dirt: 0 });
  for (const s of [-1, 1]) hcyl(0.2, 0.12, M.dark, lx + 0.25, 0.2, lz + s * 0.42, { axis: 'z', seg: 16 });
  box(0.5, 0.12, 0.08, gun, lx - 0.85, 0.24, lz, { dirt: 0 }); box(0.12, 0.25, 0.12, gun, lx - 0.55, 0, lz + 0.3, { dirt: 0 });
  box(0.5, 0.35, 0.04, M.grille('#3d4247'), lx + 0.2, 0.32, lz + 0.38, { dirt: 0 }); box(0.06, 0.06, 0.03, P.green, lx - 0.3, 0.6, lz + 0.39, nc); box(0.06, 0.06, 0.03, P.glow, lx - 0.42, 0.6, lz + 0.39, nc);
  cyl(0.07, 2.7, P.steelD, lx - 0.2, 0.85, lz, { seg: 10, dirt: 0 }); cyl(0.05, 0.6, M.steel, lx - 0.2, 3.5, lz, { seg: 10, dirt: 0 });
  box(1.25, 0.08, 0.08, P.steelD, lx - 0.2, 3.62, lz, { dirt: 0 });
  for (const [dx, dy] of [[-0.42, 0], [0.42, 0], [-0.42, 0.34], [0.42, 0.34]]) {
    const g = group(lx - 0.2 + dx, 3.5 + dy, lz + 0.06, 0.25); g.rotation.x = 0.45;
    box(0.36, 0.26, 0.14, P.steel, 0, 0, 0, { parent: g, dirt: 0 }); box(0.3, 0.2, 0.03, P.white, 0, 0.03, 0.08, { parent: g, ...nc });
  }
  pointLight('#fff1d6', 6, lx + 0.6, 2.4, lz + 2.0, 6);
  P.beacon(lx - 0.2, 4.18, lz);
  // team road studs along both edge lines of the fresh road
  for (let x = -2.1; x < 4.1; x += 0.75) for (const z of [0.95, 3.65]) box(0.1, 0.03, 0.06, P.glowHi, x, 0.1, z, nc);
  // transformer and junction box between the shed and the gravel; conduits to the shed and across the yard to the
  // light tower, a cable from the transformer to the shed's roof
  const qx = 1.72, qz = -2.75;
  box(0.95, 0.08, 1.25, P.conc, qx, 0, qz, { dirt: 0.4, cast: false }); ao(qx, qz, 0.95, 1.25, 0.4);
  P.transformer(qx, qz, Math.PI / 2);
  P.junction(qx, -1.55, 0);
  P.conduit([[qx, 0.3, -1.76], [qx, 0.3, qz + 0.45]], 0.05);
  P.conduit([[qx - 0.28, 0.25, -1.55], [1.1, 0.25, -1.55]], 0.05);
  P.conduit([[qx, 0.12, -1.33], [qx, 0.12, -0.75], [lx + 0.65, 0.12, -0.75], [lx + 0.65, 0.12, lz - 0.2]], 0.045);
  P.cable([qx, 1.17, qz - 0.28], [1.1, 2.7, qz - 0.6], 0.15, 6);
  P.beacon(sx, 2.85, sz - 0.4, '#ffb347');
}
