// Foundry: barrel-roofed hangar with an open bay door, robot arms assembling a bot inside, gear emblem on the gable.
export default function (L) {
  const { box, cyl, beam, pipe, lamp, pointLight, ao, mesh, gear, sphere, group, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), off = M.paint('#c7c2b6'), rib = M.ribbed('#9d978b'), yel = M.paint('#c9a032');
  L.seed(61);
  const hx = -0.2, hz = -1.3, W = 7.8, D = 6.0, WH = 2.1, R = W / 2, sy = 0.56, fz = hz + D / 2;

  // walls with the bay opening in the front
  box(W, WH, 0.25, off, hx, 0, hz - D / 2 + 0.125); ao(hx, hz, W, D);
  box(0.25, WH, D, off, hx - W / 2 + 0.125, 0, hz); box(0.25, WH, D, off, hx + W / 2 - 0.125, 0, hz);
  box(1.95, WH, 0.25, off, hx - W / 2 + 0.975, 0, fz - 0.125); box(1.95, WH, 0.25, off, hx + W / 2 - 0.975, 0, fz - 0.125);
  box(W - 0.5, 0.02, D - 0.5, M.plain('#202326', 0.6, 0.3), hx, 0.01, hz, { dirt: 0, cast: false });

  // barrel roof
  const roof = new THREE.CylinderGeometry(R, R, D + 0.3, 56, 1, false, Math.PI / 2, Math.PI); roof.rotateX(Math.PI / 2); roof.scale(1, sy, 1);
  mesh(roof, rib, hx, WH, hz, { dirt: 0 });
  const crest = WH + R * sy;
  for (const dz of [-1.8, 0, 1.8]) { box(0.7, 0.05, 1.3, M.plain('#2b3238', 0.3, 0.6), hx, crest - 0.03, hz + dz, { cast: false, dirt: 0 }); box(0.5, 0.05, 1.1, M.emit('#5fc4f5', 0.35), hx, crest - 0.01, hz + dz, { cast: false }); }
  for (const dz of [-0.9, 0.9]) { cyl(0.32, 0.4, M.steel, hx - 1.4, crest - 0.3, hz + dz); cyl(0.32, 0.4, M.steel, hx + 1.4, crest - 0.3, hz + dz); }

  // gear emblem on the front gable
  gear(1.05, 0.8, 12, 0.18, M.paint('#d9d5ca', { rivets: false }), hx, WH + 0.95, fz + 0.25);
  cyl(0.2, 0.1, M.steel, hx, WH + 0.95, fz + 0.3).rotation.x = Math.PI / 2;

  // bay door frame
  box(0.18, WH, 0.32, M.hazard, hx - 1.9, 0, fz, { dirt: 0 }); box(0.18, WH, 0.32, M.hazard, hx + 1.9, 0, fz, { dirt: 0 });
  box(3.9, 0.2, 0.32, M.hazard, hx, WH - 0.2, fz, { dirt: 0 });
  box(3.6, 0.07, 0.07, M.emit(ACCENT, 2.4), hx, WH - 0.3, fz + 0.18, { cast: false });
  pointLight('#8fdcff', 16, hx, 1.3, fz - 0.6, 5);
  pointLight('#8fdcff', 3, hx, 0.6, fz + 0.9, 3);

  // in the doorway: assembly platform, half-built bot, two robot arms with welding sparks
  cyl(0.75, 0.16, M.steel, hx, 0, fz - 0.35, { dirt: 0 });
  box(0.9, 0.42, 0.75, off, hx, 0.16, fz - 0.35, { dirt: 0 });
  box(1.0, 0.24, 0.16, M.dark, hx, 0.16, fz - 0.8, { dirt: 0 }); box(1.0, 0.24, 0.16, M.dark, hx, 0.16, fz + 0.1, { dirt: 0 });
  sphere(0.2, M.emit('#8fdcff', 2), hx + 0.3, 0.68, fz - 0.35, { cast: false });
  for (const s of [-1, 1]) {
    const ax = hx + s * 1.35, az = fz - 0.4;
    cyl(0.28, 0.3, M.steel, ax, 0, az, { dirt: 0 });
    beam([ax, 0.3, az], [ax - s * 0.1, 1.35, az + 0.1], 0.22, 0.22, yel);
    beam([ax - s * 0.1, 1.35, az + 0.1], [hx + s * 0.5, 0.85, fz - 0.3], 0.17, 0.17, yel);
    sphere(0.15, M.steel, ax - s * 0.1, 1.35, az + 0.1);
    sphere(0.07, M.emit('#ffffff', 3), hx + s * 0.45, 0.78, fz - 0.3, { cast: false });
  }

  // apron: parts crates and a charging post outside the bay
  for (const [x, z, y] of [[2.9, 2.6, 0], [3.8, 2.6, 0], [3.35, 2.6, 0.75]]) box(0.75, 0.75, 0.75, M.wood, x, y, z);
  ao(3.35, 2.6, 1.8, 0.9, 0.45);
  box(0.5, 1.5, 0.5, gun, -3.6, 0, 2.6); box(0.36, 0.5, 0.05, M.emit(ACCENT, 1.8), -3.6, 0.9, 2.86, { cast: false }); ao(-3.6, 2.6, 0.6, 0.6, 0.4);
  pipe([[-3.6, 0.3, 2.35], [-3.6, 0.3, fz + 0.1]], 0.07, M.dark);
  box(5.0, 0.012, 0.14, M.plain('#c9a032'), hx, 0, fz + 1.5, { dirt: 0, cast: false });
}
