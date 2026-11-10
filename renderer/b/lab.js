// Research Lab: a compact white-and-graphite science station. Observatory dome on a drum with a glowing violet window
// band and a shutter slit; an entrance airlock; a flat-roofed instrument annex carrying a small satellite dish and an
// antenna mast; a bank of server racks with blinking lights on the east side; a sample bay with glowing glass canisters
// on the west side. Accent (violet #b98cff) in the window band and canisters. One version (the game adds the team bar).
export default function (L) {
  const { box, cyl, hcyl, sphere, hoop, mesh, beam, pipe, lamp, pointLight, ao, railing, group, M, THREE, ACCENT } = L;
  L.seed(1777);
  const white = M.paint('#e2e0da', { rivets: false }), whiteR = M.paint('#d8d6cf'), graph = M.paint('#3a3d42'), graphD = M.paint('#2c2f33', { rivets: false });
  const conc = M.rough('#8f887c'), glow = M.emit(ACCENT, 2.6), glowS = M.emit(ACCENT, 1.4);
  const DX = -0.7, DZ = -0.9, DR = 2.55;                                     // dome centre and radius

  // ---- plinth and drum with the window band
  cyl(DR + 0.45, 0.45, conc, DX, 0, DZ, { seg: 64, dirtH: 0.4 }); ao(DX, DZ, 5.6, 5.6, 0.45);
  hoop(DR + 0.42, 0.05, M.hazard, DX, 0.45, DZ);
  cyl(DR, 1.05, white, DX, 0.45, DZ, { seg: 64, dirt: 0.25, dirtH: 0.6 });
  cyl(DR + 0.02, 0.62, graphD, DX, 1.5, DZ, { seg: 64, dirt: 0 });
  cyl(DR + 0.04, 0.4, glow, DX, 1.61, DZ, { seg: 64, dirt: 0, cast: false, open: true });
  for (let k = 0; k < 28; k++) { const a = k * Math.PI * 2 / 28; box(0.07, 0.62, 0.1, graph, DX + Math.cos(a) * (DR + 0.05), 1.5, DZ + Math.sin(a) * (DR + 0.05), { dirt: 0, ry: -a }); }
  cyl(DR + 0.06, 0.12, graph, DX, 2.12, DZ, { seg: 64, dirt: 0 });
  // ---- dome with graphite panel ribs and a closed observation shutter slit
  const dome = sphere(DR, white, DX, 2.24, DZ, { dome: true, dirt: 0.15 });
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, pts = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI / 2; pts.push([DX + Math.cos(a) * Math.cos(t) * (DR + 0.02), 2.24 + Math.sin(t) * (DR + 0.02), DZ + Math.sin(a) * Math.cos(t) * (DR + 0.02)]); }
    for (let i = 0; i < 12; i++) beam(pts[i], pts[i + 1], 0.05, 0.03, graph);
  }
  {
    // shutter slit: a graphite meridian strip from the crown down the front-left, with steel rails either side
    const sg = new THREE.SphereGeometry(DR + 0.03, 10, 24, 0, 0.34, 0, Math.PI / 2 - 0.02);
    const sm = mesh(sg, graphD, DX, 2.24, DZ, { dirt: 0 }); sm.rotation.y = 0.55;
    for (const e of [0, 0.34]) {
      const rg = new THREE.SphereGeometry(DR + 0.06, 2, 24, e - 0.015, 0.03, 0, Math.PI / 2 - 0.02);
      const rm = mesh(rg, M.steel, DX, 2.24, DZ, { dirt: 0 }); rm.rotation.y = 0.55;
    }
  }
  // dome crown: sensor puck
  cyl(0.38, 0.14, graph, DX, 2.24 + DR - 0.06, DZ, { seg: 32, dirt: 0 });
  cyl(0.22, 0.06, M.plain('#15181b', 0.2, 0.6), DX, 2.24 + DR + 0.08, DZ, { seg: 24, dirt: 0 });

  // ---- entrance airlock at the front of the drum
  const AX = DX - 0.2, AZ = DZ + DR + 0.55;
  box(1.6, 1.45, 1.3, whiteR, AX, 0.45, AZ, { dirtH: 0.6 });
  box(1.72, 0.12, 1.42, graph, AX, 1.9, AZ, { dirt: 0 });
  box(0.8, 1.05, 0.05, graphD, AX, 0.5, AZ + 0.66, { dirt: 0 });
  box(0.62, 0.36, 0.03, M.glass('#5a4f7a', 0.85), AX, 1.0, AZ + 0.69, { dirt: 0 });
  box(0.9, 0.04, 0.05, glowS, AX, 1.6, AZ + 0.67, { dirt: 0, cast: false });
  box(1.8, 0.12, 0.7, conc, AX, 0, AZ + 1.0); box(1.8, 0.03, 0.12, M.hazard, AX, 0.12, AZ + 1.3, { dirt: 0 });

  // ---- instrument annex at the back-right, with a small satellite dish and an antenna mast on its roof
  const NX = 2.75, NZ = -2.55, NW = 2.9, ND = 2.6, NH = 1.75;
  box(NW + 0.2, 0.3, ND + 0.2, conc, NX, 0, NZ); ao(NX, NZ, NW, ND, 0.45);
  box(NW, NH, ND, white, NX, 0.3, NZ, { dirtH: 0.7 });
  box(NW + 0.12, 0.14, ND + 0.12, graph, NX, 0.3 + NH, NZ, { dirt: 0 });
  box(NW - 0.3, 0.32, 0.05, M.glass('#40525e', 0.9), NX, 1.15, NZ + ND / 2 + 0.01, { dirt: 0 });
  box(NW - 0.3, 0.05, 0.05, glowS, NX, 1.5, NZ + ND / 2 + 0.02, { dirt: 0, cast: false });
  const RY = 0.44 + NH;
  {
    const dg = group(NX - 0.5, RY, NZ + 0.2);
    cyl(0.25, 0.4, graph, 0, 0, 0, { parent: dg, seg: 20, dirt: 0 });
    const R0 = 0.85, depth = 0.26, pts = [];
    for (let i = 0; i <= 14; i++) { const r = R0 * i / 14; pts.push(new THREE.Vector2(r, depth * (r / R0) ** 2)); }
    const dish = group(0, 0.65, 0, 0, dg); dish.rotation.z = 0.75; dish.rotation.y = -0.6;
    const dm = mesh(new THREE.LatheGeometry(pts, 40), M.paint('#e8e6e0', { rivets: false }), 0, 0, 0, { parent: dish, dirt: 0 }); dm.material.side = THREE.DoubleSide;
    L.hoop(R0, 0.035, graph, 0, depth, 0, { parent: dish });
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; beam([Math.cos(a) * R0 * 0.9, depth, Math.sin(a) * R0 * 0.9], [0, 0.62, 0], 0.03, 0.03, graph, { parent: dish }); }
    cyl(0.06, 0.12, graphD, 0, 0.6, 0, { parent: dish, seg: 10, dirt: 0 });
  }
  // antenna mast with cross arms and a red tip light
  cyl(0.07, 2.3, M.steel, NX + 0.9, RY, NZ - 0.6, { seg: 12, dirt: 0 });
  for (const [y, w] of [[1.2, 0.7], [1.75, 0.5], [2.15, 0.3]]) box(w, 0.04, 0.04, M.steel, NX + 0.9, RY + y, NZ - 0.6, { dirt: 0 });
  sphere(0.07, M.emit('#ff3a22', 2), NX + 0.9, RY + 2.35, NZ - 0.6, { dirt: 0 });
  box(0.6, 0.3, 0.5, graph, NX + 0.6, RY, NZ + 0.75, { dirt: 0 });
  box(0.5, 0.03, 0.4, M.grille('#3d4247'), NX + 0.6, RY + 0.3, NZ + 0.75, { dirt: 0 });
  pipe([[NX - NW / 2, 1.3, NZ + 0.4], [DX + DR * 0.92, 1.3, NZ + 0.4]], 0.08, graph);

  // ---- server racks bank on the east side, fronts facing south, with blinking status lights
  const SX = 2.85, SZ = 1.35;
  box(3.0, 0.2, 1.4, conc, SX, 0, SZ); ao(SX, SZ, 3.0, 1.4, 0.4);
  box(3.0, 0.08, 1.5, graph, SX, 2.2, SZ - 0.05, { dirt: 0 });                                          // rain canopy
  for (const s of [-1, 1]) box(0.08, 2.0, 0.08, graph, SX + s * 1.42, 0.2, SZ + 0.62, { dirt: 0 });
  const cols = ['#9bff6a', '#b98cff', '#ffb347', '#6ad8ff'];
  for (let i = 0; i < 4; i++) {
    const x = SX - 1.05 + i * 0.7;
    box(0.62, 1.85, 0.9, graphD, x, 0.2, SZ - 0.1, { dirt: 0.1 });
    box(0.5, 1.6, 0.03, M.grille('#2a2d31'), x, 0.32, SZ + 0.36, { dirt: 0 });
    for (let r = 0; r < 7; r++) for (let c = 0; c < 3; c++) {
      if (L.rnd() < 0.35) continue;
      const hex = cols[Math.floor(L.rnd() * cols.length)];
      box(0.06, 0.035, 0.02, M.emit(hex, 1.5 + L.rnd() * 1.5), x - 0.15 + c * 0.15, 0.45 + r * 0.21, SZ + 0.385, { dirt: 0, cast: false });
    }
    box(0.62, 0.05, 0.9, white, x, 2.05, SZ - 0.1, { dirt: 0 });
  }
  pipe([[SX - 1.4, 2.0, SZ - 0.5], [DX + DR * 0.86, 2.0, SZ - 0.5]], 0.07, graph);                       // cable tray to the drum

  // ---- sample bay on the west side: glass canisters with glowing violet samples in a steel frame
  const BX = -3.55, BZ = 2.25;
  box(2.6, 0.3, 1.8, conc, BX, 0, BZ); ao(BX, BZ, 2.6, 1.8, 0.4);
  box(2.6, 0.04, 0.12, M.hazard, BX, 0.3, BZ + 0.85, { dirt: 0 });
  box(2.3, 0.12, 1.4, graph, BX, 0.3, BZ, { dirt: 0 });
  for (const [cx, cz] of [[-0.75, -0.35], [0, -0.35], [0.75, -0.35], [-0.75, 0.35], [0, 0.35], [0.75, 0.35]]) {
    const x = BX + cx, z = BZ + cz;
    cyl(0.25, 0.08, white, x, 0.42, z, { seg: 24, dirt: 0 });
    cyl(0.15, 0.62, M.emit(ACCENT, 1.1), x, 0.5, z, { seg: 20, dirt: 0, cast: false });
    const gl = cyl(0.23, 0.78, M.glass('#d8ccff', 0.32), x, 0.5, z, { seg: 24, dirt: 0, cast: false });
    cyl(0.25, 0.08, M.steel, x, 1.28, z, { seg: 24, dirt: 0 });
  }
  for (const s of [-1, 1]) { box(0.07, 1.25, 0.07, M.steel, BX + s * 1.12, 0.42, BZ - 0.66, { dirt: 0 }); box(0.07, 1.25, 0.07, M.steel, BX + s * 1.12, 0.42, BZ + 0.66, { dirt: 0 }); }
  box(2.3, 0.05, 0.07, M.steel, BX, 1.62, BZ - 0.66, { dirt: 0 }); box(2.3, 0.05, 0.07, M.steel, BX, 1.62, BZ + 0.66, { dirt: 0 });
  pointLight(ACCENT, 8, BX, 1.2, BZ + 0.3, 3);
  box(0.7, 0.9, 0.5, white, BX + 1.55, 0.3, BZ - 0.45, { dirt: 0.2 });                                  // sample fridge
  box(0.5, 0.05, 0.03, glowS, BX + 1.55, 1.0, BZ - 0.19, { dirt: 0, cast: false });
}
