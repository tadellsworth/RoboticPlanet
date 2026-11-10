// Crystal tap: violet crystal cluster gripped by a clamp pylon, energy conduits to a storage tank and capacitor bank.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, crystal, rnd, M, THREE, ACCENT, ladder } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), off = M.paint('#c2bcaf');
  const cry = M.crystal('#5440e6', '#2f22a0', 0.3), conduit = M.emit(ACCENT, 2.0);
  L.seed(41);
  const cx = -0.4, cz = -0.9;

  // octagonal collar and the crystal cluster
  cyl(2.0, 0.5, M.concrete, cx, 0, cz, { seg: 8, ry: Math.PI / 8 }); ao(cx, cz, 4.0, 4.0, 0.5);
  hoop(1.62, 0.07, M.hazard, cx, 0.52, cz);
  crystal(0.72, 4.1, 1.2, cry, cx, 0.4, cz, 0, 0);
  crystal(0.48, 2.7, 0.8, cry, cx - 0.6, 0.4, cz + 0.3, 0.15, 0.45);
  crystal(0.44, 2.4, 0.7, cry, cx + 0.65, 0.4, cz + 0.2, 0.2, -0.5);
  crystal(0.34, 1.6, 0.55, cry, cx + 0.1, 0.4, cz + 0.7, 0.6, -0.1);
  crystal(0.32, 1.4, 0.5, cry, cx - 0.2, 0.4, cz - 0.65, -0.55, 0.2);
  pointLight(ACCENT, 6, cx, 2.4, cz + 1.6, 6);

  // clamp pylon: four columns, top frame, hydraulic clamp arms at two heights
  const P = 1.75, H = 6.0;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    box(0.36, H, 0.36, gun, cx + sx * P, 0.5, cz + sz * P);
    box(0.5, 0.2, 0.5, M.hazard, cx + sx * P, 0.5, cz + sz * P, { dirt: 0 });
    for (const y of [2.2, 3.9]) {
      const a = [cx + sx * (P - 0.15), y, cz + sz * (P - 0.15)], b = [cx + sx * 0.72, y, cz + sz * 0.72];
      beam(a, [(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2], 0.3, 0.3, warm);
      beam([(a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2], b, 0.15, 0.15, M.chrome);
      box(0.32, 0.4, 0.32, M.steel, b[0], y - 0.2, b[2], { dirt: 0 });
    }
  }
  for (const s of [-1, 1]) { box(2 * P + 0.4, 0.32, 0.36, gun, cx, H + 0.5, cz + s * P, { dirt: 0 }); box(0.36, 0.32, 2 * P + 0.4, gun, cx + s * P, H + 0.5, cz, { dirt: 0 }); }
  box(2 * P + 0.4, 0.12, 0.08, M.hazard, cx, H + 0.6, cz + P + 0.2, { dirt: 0 });
  hoop(1.0, 0.11, M.emit(ACCENT, 1.4), cx, H + 0.25, cz, { cast: false });
  beam([cx - P, H + 0.66, cz], [cx + P, H + 0.66, cz], 0.18, 0.18, M.steel);
  ladder(cx + P + 0.3, 0.5, H + 0.5, cz + 0.6, { ry: Math.PI / 2 });

  // storage tank (front right) and capacitor bank (front left), linked by glowing conduits
  const tx = 2.9, tz = 2.4;
  for (const dx of [-0.8, 0.8]) box(0.3, 0.6, 1.3, M.steel, tx + dx, 0, tz);
  hcyl(0.85, 2.6, off, tx, 1.25, tz, { axis: 'x' }); ao(tx, tz, 2.8, 1.8, 0.5);
  for (const dx of [-0.9, 0, 0.9]) L.hoop(0.87, 0.05, M.steel, tx + dx, 1.25, tz).rotation.set(0, 0, Math.PI / 2);
  box(0.8, 0.1, 0.06, M.hazard, tx, 1.2, tz + 0.86, { dirt: 0 });
  pipe([[cx + 0.8, 0.3, cz + 1.7], [cx + 0.8, 0.3, tz], [tx - 1.3, 0.3, tz], [tx - 1.3, 1.25, tz]], 0.13, conduit);
  const bx = -3.3, bz = 2.1;
  for (const dz of [-0.7, 0.7]) { box(1.6, 1.5, 1.0, gun, bx, 0, bz + dz); box(1.0, 0.18, 0.04, M.emit(ACCENT, 2.2), bx, 1.0, bz + dz + 0.51, { cast: false }); box(1.0, 0.18, 0.04, M.emit(ACCENT, 2.2), bx, 0.6, bz + dz + 0.51, { cast: false }); }
  box(1.8, 0.14, 2.6, warm, bx, 1.5, bz, { dirt: 0 }); ao(bx, bz, 1.6, 2.4, 0.5);
  pipe([[cx - 0.8, 0.3, cz + 1.7], [cx - 0.8, 0.3, bz - 0.7], [bx + 0.8, 0.3, bz - 0.7]], 0.12, conduit);
  pipe([[cx - 1.9, 0.25, cz - 1.9], [-3.9, 0.25, cz - 1.9], [-3.9, 0.25, bz - 1.2]], 0.15, M.steel);
  // control kiosk (back right)
  box(1.3, 1.6, 1.1, off, 2.9, 0, -3.1); box(1.4, 0.12, 1.2, gun, 2.9, 1.6, -3.1, { dirt: 0 }); ao(2.9, -3.1, 1.3, 1.1, 0.5);
  box(0.7, 0.35, 0.05, M.emit(ACCENT, 1.2), 2.9, 0.95, -2.53, { cast: false });
}
