// Harvester: tall machine shed, big circular saw on a hydraulic arm, conveyor into a hopper of chopped glowing fibre.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, lamp, pointLight, ao, mesh, group, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), rib = M.ribbed('#b1aa9d'), yel = M.paint('#b8952e');
  const blade = M.plain('#9ea5ab', 0.32, 0.85);
  L.seed(11);

  // machine shed (back left)
  const sx = -2.1, sz = -1.9, SH = 3.2;
  box(4.4, SH, 3.8, rib, sx, 0, sz); ao(sx, sz, 4.4, 3.8);
  box(4.6, 0.22, 4.0, gun, sx, SH, sz, { dirt: 0 });
  box(2.2, 2.3, 0.08, M.ribbed('#3c4045'), sx - 0.5, 0, 0.0, { dirt: 0.5 });
  box(2.5, 0.16, 0.12, M.hazard, sx - 0.5, 2.3, 0.02, { dirt: 0 });
  box(4.2, 0.1, 0.07, M.emit(ACCENT, 2.6), sx, SH - 0.22, 0.03, { cast: false });
  cyl(0.42, 0.55, M.steel, sx - 1.2, SH + 0.22, sz - 0.9); cyl(0.42, 0.55, M.steel, sx + 0.2, SH + 0.22, sz - 0.9);
  box(1.3, 0.65, 0.9, M.grille(), sx + 1.2, SH + 0.22, sz + 0.6);
  lamp(sx + 0.95, 2.2, 0.12, ACCENT, { size: 0.18, intensity: 4, dist: 3, k: 3 });

  // saw turret and hydraulic arm (right)
  const tx = 2.6, tz = -1.7;
  cyl(1.1, 0.9, gun, tx, 0, tz, { seg: 12 }); ao(tx, tz, 2.2, 2.2);
  box(1.8, 1.3, 1.8, warm, tx, 0.9, tz);
  box(1.8, 0.14, 0.06, M.hazard, tx, 0.95, tz + 0.91, { dirt: 0 });
  const hub = [2.2, 2.75, 1.45];
  beam([tx, 1.9, tz + 0.2], [hub[0], hub[1] + 0.25, hub[2] - 0.35], 0.6, 0.65, yel);
  beam([tx + 0.4, 1.3, tz + 0.7], [hub[0] + 0.4, 2.3, hub[2] - 0.6], 0.17, 0.17, M.chrome);
  pipe([[tx - 0.45, 2.1, tz + 0.3], [hub[0] - 0.45, 3.1, hub[2] - 0.5]], 0.06, M.dark);

  // the saw blade facing the camera: big teeth, slotted disc, hazard guard over the top
  hcyl(1.8, 0.1, blade, hub[0], hub[1], hub[2], { axis: 'z', seg: 64 });
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; const g = group(hub[0] + Math.cos(a) * 1.82, hub[1] + Math.sin(a) * 1.82, hub[2]); g.rotation.z = a - Math.PI / 2; mesh(new THREE.ConeGeometry(0.17, 0.34, 4), M.steel, 0, 0.12, 0, { parent: g, dirt: 0 }); }
  hcyl(1.15, 0.12, M.steel, hub[0], hub[1], hub[2] + 0.01, { axis: 'z', seg: 48 });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; const g = group(hub[0] + Math.cos(a) * 1.45, hub[1] + Math.sin(a) * 1.45, hub[2] + 0.06); g.rotation.z = a; box(0.42, 0.07, 0.02, M.dark, 0, -0.035, 0, { parent: g, dirt: 0, cast: false }); }
  hcyl(0.42, 0.36, M.dark, hub[0], hub[1], hub[2], { axis: 'z' });
  const guard = new THREE.TorusGeometry(2.12, 0.22, 10, 40, Math.PI * 0.8); guard.rotateZ(Math.PI * 0.12);
  mesh(guard, M.hazard, hub[0], hub[1], hub[2], { dirt: 0 });
  lamp(tx, 2.25, tz, ACCENT, { size: 0.22, intensity: 4, dist: 3, k: 3 });

  // hopper of chopped fibre (front left)
  const hx = -2.3, hz = 2.6;
  box(3.5, 1.3, 0.16, warm, hx, 0, hz + 1.0); box(3.5, 1.3, 0.16, warm, hx, 0, hz - 1.0);
  box(0.16, 1.3, 2.16, warm, hx - 1.67, 0, hz); box(0.16, 1.3, 2.16, warm, hx + 1.67, 0, hz);
  box(3.66, 0.12, 0.2, M.hazard, hx, 1.3, hz + 1.0, { dirt: 0 }); ao(hx, hz, 3.5, 2.2);
  const fibre = [M.plain('#3e8c6b'), M.plain('#5fbf90'), M.plain('#2f6b52'), M.emit('#5ff5c0', 0.8)];
  for (let i = 0; i < 120; i++) {
    const x = hx + (rnd() - 0.5) * 3.1, z = hz + (rnd() - 0.5) * 1.75, dx = (x - hx) / 1.6, dz = (z - hz) / 0.95;
    const y = 0.4 + 1.05 * Math.max(0, 1 - 0.65 * (dx * dx + dz * dz)) + rnd() * 0.1;
    const geo = new THREE.BoxGeometry(0.25 + rnd() * 0.3, 0.07 + rnd() * 0.06, 0.1 + rnd() * 0.1);
    mesh(geo, fibre[i % 7 === 0 ? 3 : i % 3], x, y, z, { rx: rnd() * 0.8, ry: rnd() * 3, rz: rnd() * 0.6, dirt: 0 });
  }
  pointLight(ACCENT, 6, hx, 2.0, hz + 0.4, 4);

  // conveyor from under the saw up into the hopper
  beam([1.0, 1.0, 2.75], [-0.55, 1.45, 2.75], 0.75, 0.12, M.dark);
  beam([1.0, 1.1, 2.33], [-0.55, 1.55, 2.33], 0.08, 0.14, yel); beam([1.0, 1.1, 3.17], [-0.55, 1.55, 3.17], 0.08, 0.14, yel);
  for (const x of [0.8, -0.3]) { box(0.1, x > 0 ? 1.0 : 1.35, 0.1, M.steel, x, 0, 2.35); box(0.1, x > 0 ? 1.0 : 1.35, 0.1, M.steel, x, 0, 3.15); }
  for (const t of [0.15, 0.45, 0.75]) { const x = 1.0 - 1.55 * t, y = 1.08 + 0.45 * t; box(0.22, 0.06, 0.12, fibre[t === 0.45 ? 3 : 1], x, y, 2.75, { dirt: 0 }); }

  pipe([[0.1, 0.6, -2.5], [1.5, 0.6, -2.5]], 0.17, M.steel);
}
