// Mine: reinforced shaft glowing from the depths, drilling derrick on a gantry above it, ore cart on rails, winch house.
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
}
