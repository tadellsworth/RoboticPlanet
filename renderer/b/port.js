// Port: a container quay. A harbour office with a control tower at the back, a concrete apron with stacked
// containers, and a ship-to-shore crane whose boom reaches out over the quay edge (black rubber fenders,
// bollards) at the front, where ships tie up. Floodlight masts and the team beacon light it at night.
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, lamp, pointLight, ao, ladder, railing, M, THREE, TEAM, R } = L;
  L.seed(733);
  const wall = M.ribbed('#a7a196'), roofM = M.paint('#6f757b', { panelW: 256 }), off = M.paint('#c9c5ba', { rivets: false });
  const steel = M.paint('#5a6066', { panelW: 128 }), conc = M.rough('#8f887c'), apronM = M.rough('#7d776c');
  const craneM = M.paint('#c9a22a', { rivets: false }), craneD = M.paint('#8c7020', { rivets: false });
  const glow = M.emit(TEAM, 2.6), rubber = M.plain('#151618', 0.9);

  // ---- harbour office along the back, with a control tower at its left end
  const X0 = -4.3, X1 = 1.4, Z0 = -4.1, Z1 = -1.6, H = 1.55, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2;
  box(X1 - X0 + 0.3, 0.25, Z1 - Z0 + 0.3, conc, cx, 0, cz, { dirtH: 0.25 });
  box(X1 - X0, H, Z1 - Z0, wall, cx, 0.25, cz, { dirtH: 1.0 });
  box(X1 - X0 + 0.16, 0.14, Z1 - Z0 + 0.16, roofM, cx, 0.25 + H, cz, { dirt: 0.3 });
  for (let k = 0; k < 2; k++) box(0.9, 0.35, 0.7, steel, -2.4 + k * 2.1, 0.25 + H + 0.14, cz - 0.3, { dirt: 0.3 }); // roof plant
  for (let k = 0; k < 5; k++) box(0.75, 0.38, 0.06, M.glass('#3a5260', 0.9), X0 + 0.7 + k * 1.1, 0.95, Z1 + 0.02, { dirt: 0, cast: false });
  box(X1 - X0 - 0.4, 0.07, 0.05, glow, cx, 1.62, Z1 + 0.05, { cast: false });
  box(1.4, 1.1, 0.08, M.ribbed('#6c6f70', { period: 10 }), 0.6, 0.25, Z1 + 0.04, { dirt: 0.3 });             // roller door
  box(1.5, 0.1, 0.12, M.hazard, 0.6, 1.36, Z1 + 0.06, { dirt: 0 });
  ao(cx, cz, X1 - X0 + 0.5, Z1 - Z0 + 0.5, 0.5);
  // control tower: a slim shaft and a glazed cab overhanging it, a mast with the team beacon on top
  const tx = -3.6, tz = -2.9;
  box(1.0, 3.6, 1.0, off, tx, 0.25, tz, { dirtH: 1.5 });
  box(1.55, 0.12, 1.55, steel, tx, 3.85, tz, { dirt: 0.2 });
  box(1.45, 0.62, 1.45, M.glass('#2c4250', 0.92), tx, 3.97, tz, { dirt: 0 });
  for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) box(0.08, 0.62, 0.08, steel, tx + dx, 3.97, tz + dz, { dirt: 0 });
  box(1.6, 0.1, 1.6, roofM, tx, 4.59, tz, { dirt: 0.2 });
  box(1.2, 0.05, 0.05, M.emit('#ffd9a0', 1.4), tx, 4.2, tz + 0.74, { cast: false });                       // warm cab light
  cyl(0.06, 1.0, M.steel, tx + 0.4, 4.69, tz + 0.4, { seg: 10 });
  lamp(tx + 0.4, 5.62, tz + 0.4, TEAM, { size: 0.2, k: 4.5, intensity: 5, dist: 4, shape: 'sphere' });
  ladder(tx + 0.52, 0.3, 3.8, tz, { ry: Math.PI / 2 });

  // ---- the apron and the quay edge at the front (where the water is)
  box(9.0, 0.2, 5.4, apronM, 0, 0, 1.25, { dirtH: 0.2 });
  box(9.0, 0.02, 0.12, M.paint('#d8b53a', { rivets: false }), 0, 0.2, 3.72, { dirt: 0 });                 // safety line
  box(9.2, 0.3, 0.3, conc, 0, 0, 3.95, { dirtH: 0.3 });                                                     // quay cope
  for (let k = 0; k < 7; k++) box(0.5, 0.42, 0.18, rubber, -3.9 + k * 1.3, -0.12, 4.18, { dirt: 0 });     // fenders
  for (const x of [-3.3, -0.7, 1.9, 4.1]) {                                                                  // bollards
    cyl(0.17, 0.3, M.plain('#202224', 0.6), x, 0.3, 3.85, { seg: 20, dirt: 0 });
    cyl(0.23, 0.06, M.plain('#202224', 0.6), x, 0.6, 3.85, { seg: 20, dirt: 0 });
  }
  // crane rails along the apron
  for (const z of [0.9, 3.35]) box(9.0, 0.04, 0.1, M.steel, 0, 0.2, z, { dirt: 0 });

  // ---- stacked containers on the apron (left), a straddle-carrier lane and pallets
  const cols = ['#4f6f86', '#a24a32', '#c9c5ba', '#6d7148', '#8a5a2e', '#2f5a5a'];
  const stack = (x, z, n) => { for (let k = 0; k < n; k++) box(2.1, 0.88, 0.9, M.ribbed(cols[Math.floor(R(0, cols.length))], { period: 12 }), x + R(-0.04, 0.04), 0.2 + k * 0.9, z, { dirtH: 0.6, ry: R(-0.02, 0.02) }); };
  stack(-3.2, 0.2, 3); stack(-3.2, 1.15, 2); stack(-3.2, 2.1, 1); stack(-0.9, 0.2, 2); stack(-0.9, 1.15, 1);
  ao(-2.0, 1.1, 4.8, 3.0, 0.45, 0.21);

  // ---- ship-to-shore crane on the right: four legs on the rails, a portal beam, a boom out over the quay edge
  const CX = 2.6, legX = [CX - 1.1, CX + 1.1], legZ = [0.9, 3.35], PY = 3.4;
  for (const x of legX) for (const z of legZ) { box(0.22, PY, 0.22, craneM, x, 0.2, z, { dirtH: 1.2 }); box(0.6, 0.3, 0.4, steel, x, 0.2, z, { dirt: 0.3 }); }
  for (const x of legX) { beam([x, PY, legZ[0]], [x, PY, legZ[1]], 0.26, 0.28, craneM); beam([x, 1.0, legZ[0]], [x, PY - 0.4, legZ[1]], 0.09, 0.09, craneM); }
  for (const z of legZ) beam([legX[0], PY + 0.1, z], [legX[1], PY + 0.1, z], 0.28, 0.24, craneM);
  // the boom: two girders from the back of the crane out past the front edge, a machinery house on top
  const BY = PY + 0.55, bz0 = -0.4, bz1 = 5.3;
  for (const dx of [-0.42, 0.42]) beam([CX + dx, BY, bz0], [CX + dx, BY, bz1], 0.18, 0.32, craneM);
  for (let z = bz0 + 0.5; z < bz1; z += 0.8) beam([CX - 0.42, BY - 0.12, z], [CX + 0.42, BY - 0.12, z], 0.07, 0.07, craneD);
  for (const x of legX) for (const z of legZ) beam([x, PY + 0.1, z], [CX + Math.sign(x - CX) * 0.42, BY, z], 0.1, 0.1, craneD);
  box(1.3, 0.75, 1.5, off, CX, BY + 0.15, 0.3, { dirt: 0.3 });                                              // machinery house
  box(1.4, 0.06, 1.6, roofM, CX, BY + 0.9, 0.3, { dirt: 0.2 });
  // the A-frame and stays holding the boom
  const AY = BY + 2.0;
  for (const dx of [-0.42, 0.42]) { beam([CX + dx, BY, legZ[0]], [CX + dx * 0.4, AY, 1.6], 0.12, 0.12, craneM); beam([CX + dx, BY, legZ[1]], [CX + dx * 0.4, AY, 1.6], 0.12, 0.12, craneM); }
  beam([CX - 0.17, AY, 1.6], [CX + 0.17, AY, 1.6], 0.14, 0.14, craneM);
  for (const z of [3.6, bz1 - 0.2]) beam([CX, AY, 1.6], [CX, BY + 0.05, z], 0.04, 0.04, M.dark);
  beam([CX, AY, 1.6], [CX, BY + 0.05, bz0 + 0.1], 0.04, 0.04, M.dark);
  lamp(CX, AY + 0.12, 1.6, '#ff3a22', { size: 0.14, k: 3, intensity: 2, dist: 2.5, shape: 'sphere' });     // aircraft warning light
  // trolley with the operator's cab and a spreader lowering a container toward the quay edge
  const trz = 3.9;
  box(1.0, 0.28, 0.75, steel, CX, BY - 0.2, trz, { dirt: 0.3 });
  box(0.55, 0.5, 0.55, off, CX - 0.2, BY - 0.72, trz + 0.1, { dirt: 0.2 });
  box(0.45, 0.22, 0.05, M.glass('#2a3a44', 0.9), CX - 0.2, BY - 0.6, trz + 0.39, { dirt: 0 });
  for (const dx of [-0.3, 0.3]) beam([CX + dx, BY - 0.2, trz], [CX + dx, 1.95, trz], 0.03, 0.03, M.dark);
  box(2.2, 0.1, 0.95, craneM, CX, 1.85, trz, { dirt: 0 });
  box(2.1, 0.88, 0.9, M.ribbed('#a24a32', { period: 12 }), CX, 0.97, trz, { dirtH: 0.5 });
  ladder(legX[1] + 0.13, 0.3, PY, legZ[1], { ry: Math.PI / 2 });

  // ---- floodlight masts at the quay corners, a mooring light, the team-glow edge strip
  for (const [x, z] of [[-4.35, 3.55], [0.75, 3.55]]) {
    cyl(0.08, 3.2, M.steel, x, 0.2, z, { seg: 10 });
    box(0.6, 0.12, 0.3, steel, x, 3.4, z, { dirt: 0 });
    for (const dx of [-0.17, 0.17]) lamp(x + dx, 3.32, z + 0.1, '#fff1c8', { size: 0.13, k: 2.2, intensity: 2.2, dist: 3.5 });
  }
  box(8.8, 0.05, 0.05, glow, 0, 0.31, 4.12, { cast: false });
  pointLight(TEAM, 2.5, -1.5, 1.6, Z1 + 1.0, 4);
}
