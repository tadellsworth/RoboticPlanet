// Cement Works: long inclined rotary kiln on piers with a glowing firing hood, cyclone preheater tower, twin cement silos.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, catwalk, group, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#cfcbc0'), warm = M.paint('#8c8579'), kilnM = M.paint('#7d6a5a', { panelW: 512, panelH: 128 });
  const silo = M.rough('#bdb8ad');
  L.seed(151);

  // rotary kiln: inclined along x, three piers with tyre rings
  const kz = 1.0, ky = 1.55, KL = 7.0, tilt = 0.06;
  const k = hcyl(0.72, KL, kilnM, -0.1, ky, kz, { axis: 'x', seg: 40 }); k.rotation.z = tilt;
  for (const x of [-2.4, 0, 2.4]) {
    const y = ky + x * Math.tan(tilt);
    box(0.9, y - 0.55, 1.4, M.concrete, x - 0.1, 0, kz); mesh(new THREE.TorusGeometry(0.8, 0.11, 10, 40), M.steel, x - 0.1, y, kz, { ry: Math.PI / 2, dirt: 0 });
    hcyl(0.22, 0.3, M.steel, x - 0.1, y - 0.75, kz + 0.45, { axis: 'x' }); hcyl(0.22, 0.3, M.steel, x - 0.1, y - 0.75, kz - 0.45, { axis: 'x' });
  }
  mesh(new THREE.TorusGeometry(0.84, 0.16, 10, 40), M.paint('#3f6b6b', { rivets: false }), 1.2, ky + 1.3 * Math.tan(tilt), kz, { ry: Math.PI / 2, dirt: 0 });
  ao(-0.1, kz, KL, 1.6, 0.5);

  // firing hood at the low end with the kiln's glow, clinker cooler below
  const hx = -3.95;
  box(1.2, 2.5, 1.9, gun, hx, 0, kz); box(1.3, 0.16, 2.0, warm, hx, 2.5, kz, { dirt: 0 });
  box(0.8, 0.8, 0.06, M.emit(ACCENT, 2.6), hx, 1.15, kz + 0.96, { cast: false });
  box(0.95, 0.12, 0.08, M.hazard, hx, 2.05, kz + 0.97, { dirt: 0 });
  cyl(0.3, 1.4, M.steel, hx, 2.66, kz - 0.3, { soot: 0.6 });
  pointLight(ACCENT, 12, hx + 0.2, 1.2, kz + 1.8, 4);
  const glowRing = hcyl(0.6, 0.06, M.emit(ACCENT, 1.4), -3.38, ky - 3.6 * Math.tan(tilt), kz, { axis: 'x', cast: false }); glowRing.rotation.z = tilt;

  // cyclone preheater tower at the high end
  const tx = 3.9, tz = 0.2;
  box(1.5, 5.6, 1.6, off, tx, 0, tz - 0.4); box(1.6, 0.2, 1.7, gun, tx, 5.6, tz - 0.4, { dirt: 0 }); ao(tx, tz - 0.4, 1.5, 1.6, 0.5);
  for (const [y, r] of [[4.3, 0.42], [3.0, 0.48], [1.7, 0.54]]) {
    cyl(r, 0.8, M.steel, tx - 0.15, y, tz + 0.85, { seg: 24 }); mesh(new THREE.ConeGeometry(r, 0.7, 24), M.steel, tx - 0.15, y - 0.35, tz + 0.85, { rx: Math.PI, dirt: 0 });
  }
  pipe([[tx - 0.15, 5.1, tz + 0.85], [tx - 0.15, 5.35, tz + 0.85], [tx - 0.15, 5.35, tz - 0.4]], 0.18, M.steel);
  pipe([[tx - 0.75, 1.4, tz + 0.6], [3.4, ky + 0.25, kz]], 0.25, M.steel);
  for (const y of [1.6, 2.9, 4.2]) box(1.7, 0.06, 0.25, M.grating, tx, y, tz + 0.43, { dirt: 0 });
  lamp(tx + 0.55, 5.95, tz - 0.4, ACCENT, { shape: 'sphere', size: 0.14, intensity: 3, dist: 3, k: 2.6 });

  // twin cement silos (back left) with a bridge on top
  for (const x of [-2.9, -0.9]) {
    box(1.9, 0.35, 1.9, M.concrete, x, 0, -3.1); cyl(0.9, 4.4, silo, x, 0.35, -3.1, { seg: 36, dirtH: 1.2 });
    cyl(0.92, 0.45, M.steel, x, 4.75, -3.1, { rTop: 0.45, seg: 36, dirt: 0 });
    for (const y of [1.6, 3.0]) hoop(0.92, 0.04, M.steel, x, y, -3.1);
  }
  ao(-1.9, -3.1, 4.0, 2.0, 0.5);
  beam([-2.9, 5.0, -3.1], [-0.9, 5.0, -3.1], 0.5, 0.18, M.grating);
  pipe([[-0.9, 4.4, -2.3], [-0.9, 4.4, -1.4], [2.4, 4.4, -1.4], [tx - 0.75, 4.4, tz - 0.4]], 0.14, M.steel);
  ladder(-2.0, 0, 4.9, -2.2);
}
