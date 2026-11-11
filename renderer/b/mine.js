// Mine: reinforced shaft glowing from the depths, drilling derrick on a gantry above it, ore cart on rails, winch house.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips round the shaft collar, up the
// derrick's front legs and round its deck, lit winch-house windows, work lights under the deck, a transformer yard and
// junction box feeding the derrick, a floodlight pole, a rail signal, beacons). Its lights are team-coloured: render one
// image per team. Base render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, lamp, pointLight, ao, mesh, rnd, M, THREE, ACCENT, ladder, catwalk } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), oxide = M.paint('#7a4532'), rib = M.ribbed('#b1aa9d');
  L.seed(31);

  // shaft collar (concrete ring around a deep glowing hole)
  const cx = -1.0, cz = -0.9;
  box(4.4, 0.6, 0.9, M.concrete, cx, 0, cz - 1.75); box(4.4, 0.6, 0.9, M.concrete, cx, 0, cz + 1.75);
  box(0.9, 0.6, 2.6, M.concrete, cx - 1.75, 0, cz); box(0.9, 0.6, 2.6, M.concrete, cx + 1.75, 0, cz);
  ao(cx, cz, 4.4, 4.4, 0.5);
  box(2.6, 0.02, 2.6, M.dark, cx, 0.01, cz, { dirt: 0, cast: false });
  box(1.5, 0.02, 1.5, M.emit(ACCENT, 1.4), cx, 0.02, cz, { cast: false });
  box(2.0, 0.015, 2.0, M.emit('#8a2a06', 0.9), cx, 0.015, cz, { cast: false });
  pointLight(ACCENT, 14, cx, 0.35, cz, 3.5);
  for (const s of [-1, 1]) { box(4.4, 0.08, 0.2, M.hazard, cx, 0.6, cz + s * 1.38, { dirt: 0 }); box(0.2, 0.08, 2.6, M.hazard, cx + s * 1.38, 0.6, cz, { dirt: 0 }); }

  // drilling derrick: four tapering legs, braces, top deck with drive house
  const B = 1.85, Tp = 0.75, H = 6.3, y0 = 0.6;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const at = (sx, sz, y) => { const t = (y - y0) / (H - y0), r = B + (Tp - B) * t; return [cx + sx * r, y, cz + sz * r]; };
  for (const [sx, sz] of legs) beam(at(sx, sz, y0), at(sx, sz, H), 0.24, 0.24, oxide);
  for (const y of [2.2, 3.8, 5.2]) for (let i = 0; i < 4; i++) { const a = legs[i], b = legs[(i + 1) % 4]; beam(at(a[0], a[1], y), at(b[0], b[1], y), 0.13, 0.13, oxide); }
  for (const [y1, y2] of [[y0, 2.2], [2.2, 3.8], [3.8, 5.2]]) { beam(at(-1, 1, y1), at(1, 1, y2), 0.1, 0.1, oxide); beam(at(1, 1, y1), at(-1, 1, y2), 0.1, 0.1, oxide); beam(at(-1, -1, y1), at(-1, 1, y2), 0.1, 0.1, oxide); beam(at(1, -1, y1), at(1, 1, y2), 0.1, 0.1, oxide); }
  box(2.2, 0.18, 2.2, M.grating, cx, H, cz, { dirt: 0 });
  box(1.5, 1.1, 1.3, gun, cx, H + 0.18, cz);
  box(1.6, 0.14, 1.4, M.hazard, cx, H + 1.28, cz, { dirt: 0 });
  cyl(0.12, H - 0.2, M.chrome, cx, 0.2, cz, { dirt: 0 });
  box(0.6, 0.7, 0.6, M.paint('#b8952e'), cx, 3.9, cz);
  cyl(0.45, 0.3, M.steel, cx, 0.65, cz);
  lamp(cx, H + 1.5, cz, ACCENT, { shape: 'sphere', size: 0.22, intensity: 6, dist: 4 });
  lamp(cx + 0.78, H + 0.6, cz + 0.66, ACCENT, { size: 0.14, intensity: 3, dist: 3 });

  // rails and ore cart (front right)
  for (let x = 0.7; x < 4.6; x += 0.42) box(0.18, 0.06, 1.1, M.wood, x, 0, 2.1, { dirt: 0 });
  box(3.9, 0.09, 0.08, M.chrome, 2.65, 0.06, 1.78, { dirt: 0 }); box(3.9, 0.09, 0.08, M.chrome, 2.65, 0.06, 2.42, { dirt: 0 });
  const kx = 2.9, kz = 2.1;
  for (const [i, j] of [[-0.55, -0.32], [0.55, -0.32], [-0.55, 0.32], [0.55, 0.32]]) L.hcyl(0.2, 0.1, M.dark, kx + i, 0.25, kz + j, { axis: 'z' });
  box(1.5, 0.12, 0.9, M.steel, kx, 0.28, kz, { dirt: 0 });
  cyl(0.82, 0.75, oxide, kx, 0.4, kz, { rTop: 1.0, seg: 4, ry: Math.PI / 4 });
  for (let i = 0; i < 16; i++) { const glow = i % 4 === 0; mesh(new THREE.DodecahedronGeometry(0.16 + rnd() * 0.08, 0), glow ? M.emit(ACCENT, 1.6) : M.rough('#2c2926'), kx + (rnd() - 0.5) * 1.0, 1.15 + rnd() * 0.15, kz + (rnd() - 0.5) * 0.9, { rx: rnd() * 3, ry: rnd() * 3, dirt: 0 }); }
  ao(kx, kz, 1.6, 1.0, 0.5); pointLight(ACCENT, 5, kx, 1.8, kz + 0.3, 3);

  // winch house (back right) with hoist cable to the derrick top
  const wx = 2.8, wz = -2.9;
  box(2.6, 2.0, 2.2, rib, wx, 0, wz); box(2.8, 0.18, 2.4, gun, wx, 2.0, wz, { dirt: 0 }); ao(wx, wz, 2.6, 2.2);
  box(0.9, 1.5, 0.06, M.dark, wx - 0.5, 0, wz + 1.11, { dirt: 0.5 });
  L.hcyl(0.45, 1.2, M.steel, wx, 2.6, wz, { axis: 'x' });
  beam([wx - 0.5, 2.7, wz], [cx + 0.4, H + 0.6, cz], 0.05, 0.05, M.dark);
  ladder(cx + 1.6, 0.6, H, cz + 1.75);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: round the shaft collar's outer edge, up the derrick's two front legs, round the top deck and
    // the drive house eave, and the winch house eave
    K.strip(4.4, cx, 0.57, cz + 2.21); for (const s of [-1, 1]) K.strip(4.4, cx + s * 2.21, 0.57, cz, Math.PI / 2);
    for (const sx of [-1, 1]) { const a = at(sx, 1, y0 + 0.15), b = at(sx, 1, H - 0.1); beam([a[0], a[1], a[2] + 0.14], [b[0], b[1], b[2] + 0.14], 0.05, 0.05, K.glow, nc); }
    K.strip(2.2, cx, H + 0.16, cz + 1.12); for (const s of [-1, 1]) K.strip(2.2, cx + s * 1.12, H + 0.16, cz, Math.PI / 2);
    K.strip(1.6, cx, H + 1.27, cz + 0.72);
    K.strip(2.8, wx, 2.15, wz + 1.22);
    // warm lit windows on the winch house beside its door, and a lamp over the door
    K.windows(1.0, 0.34, wx + 0.68, 1.15, wz + 1.13, 0, 2);
    box(0.16, 0.1, 0.1, K.steelD, wx - 0.5, 1.6, wz + 1.15, { dirt: 0 }); box(0.12, 0.05, 0.03, K.warm, wx - 0.5, 1.62, wz + 1.2, nc);
    // work lights under the derrick deck's front corners, aimed down at the shaft and the cart
    for (const s of [-1, 1]) {
      const x = cx + s * 0.95, g = new THREE.Group(); g.position.set(x, H, cz + 1.05); g.rotation.x = 0.7; g.rotation.y = s * 0.35; L.getRoot().add(g);
      box(0.36, 0.22, 0.16, K.steel, 0, -0.24, 0.04, { dirt: 0, parent: g }); box(0.3, 0.15, 0.03, K.white, 0, -0.2, 0.13, { ...nc, parent: g });
    }
    pointLight('#fff1d6', 4, cx + 0.6, 2.4, cz + 2.4, 5.5);
    // transformer yard at the front left, a junction box at the collar, a conduit up onto the collar to the derrick foot
    const qx = -3.4, qz = 3.3;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(-2.35, 1.82, 0);
    K.conduit([[qx + 0.45, 0.14, qz], [-2.35, 0.14, qz], [-2.35, 0.14, 2.04]], 0.05);
    K.conduit([[-2.35, 0.5, 1.6], [-2.35, 0.67, 1.36], [-2.35, 0.67, 0.95], [-2.65, 0.67, 0.95]], 0.05);
    // floodlight pole at the front-left corner of the collar, fed from the transformer
    const px = -4.4, pz = 1.3;
    K.flood(px, pz, 2.7, 0.6);
    box(0.7, 0.06, 0.08, K.steelD, px, 2.3, pz, { dirt: 0 });
    for (const s of [-1, 1]) cyl(0.03, 0.12, M.plain('#c9c2b0', 0.4, 0.1), px + s * 0.3, 2.36, pz, { seg: 8, dirt: 0 });
    K.cable([qx - 0.28, 1.17, qz], [px - 0.3, 2.48, pz], 0.25); K.cable([qx + 0.28, 1.17, qz], [px + 0.3, 2.48, pz], 0.3);
    // rail signal at the end of the track, green and amber
    box(0.08, 1.1, 0.08, K.steelD, 0.55, 0, 2.75, { dirt: 0 }); box(0.18, 0.36, 0.12, K.steelD, 0.55, 1.1, 2.75, { dirt: 0 });
    box(0.08, 0.08, 0.03, K.green, 0.55, 1.36, 2.82, nc); box(0.08, 0.08, 0.03, K.amber, 0.55, 1.18, 2.82, nc);
    // beacons: amber on the deck's back corners, team on the winch house and the drive house
    for (const s of [-1, 1]) K.beacon(cx + s * 1.0, H + 0.26, cz - 1.0, '#ffb347');
    K.beacon(wx + 1.25, 2.28, wz + 1.05);
    K.beacon(cx - 0.65, H + 1.5, cz - 0.5);
  }
  // ---------------------------------------------------------------- end of power layer
}
