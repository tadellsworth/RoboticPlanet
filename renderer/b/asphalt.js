// Asphalt Plant: cold-feed bins of aggregate, inclined conveyor, burner drum mixer, drag-slat conveyor to a tall
// hot-mix silo on legs, baghouse with exhaust stack.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#454b51'), yel = M.paint('#c49a26'), dark = M.paint('#2d3136'), rib = M.ribbed('#7f8378');
  const aggs = [M.rough('#9a948a'), M.rough('#7d6e5c'), M.rough('#b3a58e'), M.rough('#5f5a54')];
  L.seed(161);

  // cold-feed bins (front left): four hoppers on legs, heaped with aggregate
  for (let i = 0; i < 4; i++) {
    const x = -3.8 + i * 1.1, z = 2.9;
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(0.09, 0.9, 0.09, gun, x + dx, 0, z + dz, { dirt: 0.6 });
    cyl(0.4, 1.0, yel, x, 0.85, z, { rTop: 0.76, seg: 4, ry: Math.PI / 4 });
    mesh(new THREE.ConeGeometry(0.66, 0.4, 4, 1), aggs[i], x, 2.05, z, { ry: Math.PI / 4, dirt: 0 });
  }
  ao(-2.15, 2.9, 4.6, 1.2, 0.5);
  beam([-4.2, 0.55, 2.0], [-0.4, 0.55, 2.0], 0.5, 0.1, M.dark);

  // inclined feed conveyor up to the drum
  beam([-0.6, 0.6, 2.0], [-1.6, 2.3, -0.4], 0.55, 0.12, M.dark);
  beam([-0.6, 0.72, 2.0], [-1.6, 2.42, -0.4], 0.08, 0.14, yel);

  // drum mixer on its frame, burner end glowing
  const dz = -0.4, dy = 1.7;
  for (const x of [-1.6, 1.6]) { box(0.2, dy - 0.75, 1.3, gun, x, 0, dz); box(0.5, 0.2, 1.3, gun, x, dy - 0.95, dz, { dirt: 0 }); }
  const drum = hcyl(0.82, 4.4, dark, 0.2, dy, dz, { axis: 'x', seg: 36 }); drum.rotation.z = -0.05;
  for (const x of [-1.2, 0.2, 1.6]) mesh(new THREE.TorusGeometry(0.86, 0.1, 10, 36), yel, x, dy - x * 0.05, dz, { ry: Math.PI / 2, dirt: 0 });
  box(0.9, 1.3, 1.2, gun, 2.75, 1.0, dz); hcyl(0.38, 0.5, M.steel, 3.35, 1.7, dz, { axis: 'x' });
  hcyl(0.3, 0.06, M.emit(ACCENT, 2.6), 3.62, 1.7, dz, { axis: 'x', cast: false });
  pointLight(ACCENT, 6, 3.9, 1.7, dz + 0.6, 3);

  // drag-slat conveyor up to the hot-mix silo
  const sx = 3.4, sz = -2.9;
  beam([-1.9, 1.3, dz], [sx - 0.3, 5.6, sz], 0.6, 0.55, yel);
  // silo on legs
  for (const [ddx, ddz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) box(0.16, 2.3, 0.16, gun, sx + ddx, 0, sz + ddz);
  mesh(new THREE.ConeGeometry(1.0, 0.7, 28), dark, sx, 2.35, sz, { rx: Math.PI, dirt: 0 });
  cyl(1.0, 3.0, M.paint('#3a3f45'), sx, 2.7, sz, { seg: 32, dirt: 0 });
  for (const y of [3.7, 4.7]) hoop(1.02, 0.05, yel, sx, y, sz);
  cyl(1.03, 0.25, yel, sx, 5.7, sz, { seg: 32, dirt: 0 });
  ao(sx, sz, 2.0, 2.0, 0.5); box(1.8, 0.02, 0.12, M.hazard, sx, 0, sz + 1.1, { dirt: 0, cast: false });
  lamp(sx, 6.05, sz, ACCENT, { shape: 'sphere', size: 0.15, intensity: 4, dist: 3, k: 2.6 });

  // baghouse with exhaust stack (back left)
  const bx = -2.6, bz = -2.9;
  box(2.6, 2.6, 1.8, rib, bx, 0, bz); box(2.7, 0.18, 1.9, gun, bx, 2.6, bz, { dirt: 0 }); ao(bx, bz, 2.6, 1.8, 0.5);
  for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(0.4, 0.6, 4), gun, bx - 0.95 + i * 0.63, 0.6, bz + 0.95, { rx: Math.PI, ry: Math.PI / 4, dirt: 0 });
  cyl(0.3, 4.6, M.steel, bx + 1.6, 0, bz - 0.2, { soot: 1.2 }); ao(bx + 1.6, bz - 0.2, 0.7, 0.7, 0.4);
  pipe([[-1.6, dy + 0.4, dz - 0.5], [-1.6, 3.0, bz + 0.4], [bx + 0.6, 3.0, bz + 0.4], [bx + 0.6, 2.75, bz + 0.4]], 0.2, M.steel);
  lamp(bx - 1.2, 2.95, bz + 0.9, ACCENT, { size: 0.12, intensity: 2, dist: 2, k: 2.6 });

  // hot-oil heater tank (front right)
  for (const x of [1.9, 3.3]) box(0.2, 0.5, 0.9, M.steel, x, 0, 2.6);
  hcyl(0.55, 2.0, M.paint('#cfcbc0'), 2.6, 1.0, 2.6, { axis: 'x' }); ao(2.6, 2.6, 2.0, 1.1, 0.45);
  pipe([[2.6, 1.5, 2.6], [2.6, 1.9, 2.6], [2.6, 1.9, dz + 0.9]], 0.07, M.steel);
}
