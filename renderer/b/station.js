// Freight Rail Station: a long barrel-roofed goods shed, a gantry crane over the loading strip along the south edge
// with a container hanging from it, stacked containers and pallets, loading ramps at both ends and a signal mast
// with the team light. No rails: the game draws the railway beside it.
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, lamp, pointLight, ao, group, ladder, railing, M, THREE, TEAM, R } = L;
  L.seed(911);
  const wall = M.ribbed('#a39c90'), roof = M.ribbed('#7a8086', { period: 20 }), off = M.paint('#c9c5ba', { rivets: false });
  const steel = M.paint('#5a6066', { panelW: 128 }), conc = M.rough('#8f887c'), yellow = M.paint('#c9a22a', { rivets: false });
  const glow = M.emit(TEAM, 2.6);

  // ---- goods shed (back half)
  const X0 = -4.2, X1 = 2.9, Z0 = -4.1, Z1 = -0.6, WH = 1.7, cx = (X0 + X1) / 2, cz = (Z0 + Z1) / 2, len = X1 - X0, dep = Z1 - Z0;
  box(len + 0.3, 0.3, dep + 0.3, conc, cx, 0, cz, { dirtH: 0.3 });                     // plinth
  box(len, WH, dep, wall, cx, 0.3, cz, { dirtH: 1.2 });
  // barrel-vaulted roof along x
  const rr = dep / 2 + 0.18, VH = 1.45;
  const vs = new THREE.Shape(); vs.moveTo(-rr, 0);
  for (let i = 0; i <= 32; i++) { const t = Math.PI - (i / 32) * Math.PI; vs.lineTo(Math.cos(t) * rr, Math.sin(t) * VH); }
  vs.lineTo(rr, 0); vs.closePath();
  const vg = new THREE.ExtrudeGeometry(vs, { depth: len + 0.5, bevelEnabled: false, curveSegments: 32 });
  vg.rotateY(Math.PI / 2); vg.translate(X0 - 0.25, 0.3 + WH, cz);
  mesh(vg, roof, 0, 0, 0, { dirt: 0.25, dirtH: 0.6 });
  // roof ribs
  for (let k = 0; k <= 6; k++) {
    const x = X0 - 0.2 + k * (len + 0.4) / 6;
    const pts = []; for (let i = 0; i <= 16; i++) { const t = Math.PI - (i / 16) * Math.PI; pts.push([x, 0.3 + WH + Math.sin(t) * (VH + 0.05), cz - Math.cos(t) * (rr + 0.05)]); }
    for (let i = 0; i < pts.length - 1; i++) beam(pts[i], pts[i + 1], 0.12, 0.1, steel);
  }
  box(len - 0.6, 0.1, 0.42, M.glass('#40525e', 0.95), cx, 0.3 + WH + VH - 0.03, cz, { dirt: 0 });
  // gable ends: big roller doors and a team-glow band
  for (const s of [-1, 1]) {
    const ex = s < 0 ? X0 - 0.02 : X1 + 0.02;
    box(0.06, 1.35, 2.0, M.ribbed('#6c6f70', { period: 10 }), ex, 0.3, cz, { dirt: 0.3 });
    box(0.08, 0.12, 2.2, M.hazard, ex, 1.65, cz, { dirt: 0 });
  }
  // windows band on the south wall + team-coloured strip light
  for (let k = 0; k < 6; k++) box(0.75, 0.32, 0.06, M.dark, X0 + 0.7 + k * 1.15, 1.25, Z1 + 0.02, { dirt: 0, cast: false });
  box(len - 0.6, 0.07, 0.05, glow, cx, 1.72, Z1 + 0.05, { cast: false });
  // sliding loading doors on the south wall opening onto the platform
  for (const x of [-2.6, 0.3]) { box(1.5, 1.2, 0.08, M.ribbed('#7d8183', { period: 8 }), x, 0.3, Z1 + 0.04, { dirt: 0.3 }); box(1.6, 0.1, 0.12, M.hazard, x, 1.52, Z1 + 0.06, { dirt: 0 }); }
  ao(cx, cz, len + 0.6, dep + 0.6, 0.5);

  // ---- loading ramps at both ends of the shed
  for (const s of [-1, 1]) {
    const x = s < 0 ? X0 - 0.75 : X1 + 0.75;
    const rgeo = new THREE.BoxGeometry(1.3, 0.3, 2.4); const rp = rgeo.attributes.position;
    for (let i = 0; i < rp.count; i++) { if (rp.getY(i) > 0 && rp.getX(i) * s > 0) rp.setY(i, -0.15); }
    rgeo.computeVertexNormals(); rgeo.translate(0, 0.15, 0);
    mesh(rgeo, conc, x, 0, cz, { dirtH: 0.3 });
    for (let k = 0; k < 5; k++) box(0.05, 0.02, 2.2, M.dark, x - s * 0.5 + s * k * 0.22, 0.3 - (k * 0.22 + 0.15) * 0.23, cz, { dirt: 0, cast: false });
  }

  // ---- loading strip along the south edge (platform edge with yellow safety line)
  box(9.2, 0.18, 2.6, conc, 0, 0, 2.6, { dirtH: 0.18 });
  box(9.2, 0.02, 0.16, yellow, 0, 0.18, 3.75, { dirt: 0 });
  box(9.2, 0.04, 0.12, M.steel, 0, 0.18, 3.86, { dirt: 0 });

  // ---- gantry crane spanning the strip
  const GY = 3.2, gz0 = 1.15, gz1 = 4.15;
  for (const x of [-4.25, 3.85]) {
    for (const z of [gz0, gz1]) { box(0.22, GY, 0.22, yellow, x, 0.18, z, { dirtH: 1.5 }); }
    beam([x, GY - 0.1, gz0], [x, GY - 0.1, gz1], 0.24, 0.26, yellow);
    beam([x, 0.9, gz0], [x, GY - 0.4, gz1], 0.09, 0.09, yellow); beam([x, 0.9, gz1], [x, GY - 0.4, gz0], 0.09, 0.09, yellow);
    box(0.7, 0.35, 0.5, steel, x, 0.18, gz0, { dirt: 0.4 }); box(0.7, 0.35, 0.5, steel, x, 0.18, gz1, { dirt: 0.4 });
  }
  for (const z of [gz0 + 0.5, gz1 - 0.5]) beam([-4.35, GY + 0.05, z], [3.95, GY + 0.05, z], 0.22, 0.3, yellow);
  // trolley + cab, hoist cables, spreader and a hanging container
  const tx = 1.0, tz = (gz0 + gz1) / 2;
  box(0.8, 0.3, gz1 - gz0 - 0.7, steel, tx, GY + 0.12, tz, { dirt: 0.3 });
  box(0.55, 0.45, 0.5, off, tx - 0.75, GY - 0.35, gz1 - 0.5, { dirt: 0.3 });
  box(0.4, 0.2, 0.05, M.glass('#2a3a44', 0.9), tx - 0.75, GY - 0.2, gz1 - 0.24, { dirt: 0 });
  lamp(tx - 0.75, GY + 0.1, gz1 - 0.5, TEAM, { size: 0.13, k: 4, intensity: 2.5, dist: 2.5 });
  const cy = 1.25;
  for (const dx of [-0.4, 0.4]) for (const dz of [-0.25, 0.25]) beam([tx + dx, GY + 0.05, tz + dz], [tx + dx * 1.2, cy + 1.05, tz + dz * 1.4], 0.03, 0.03, M.dark);
  box(2.4, 0.12, 1.05, yellow, tx, cy + 0.95, tz, { dirt: 0 });
  box(2.3, 0.95, 0.95, M.ribbed('#a24a32', { period: 12 }), tx, cy, tz, { dirtH: 0.5 });

  // ---- stacked containers and pallets on the strip
  const cols = ['#4f6f86', '#a24a32', '#c9c5ba', '#6d7148', '#8a5a2e'];
  const stack = (x, z, n, rot = 0) => { for (let k = 0; k < n; k++) box(2.2, 0.92, 0.92, M.ribbed(cols[Math.floor(R(0, cols.length))], { period: 12 }), x + R(-0.05, 0.05), 0.18 + k * 0.94, z, { dirtH: 0.6, ry: rot + R(-0.03, 0.03) }); };
  stack(-2.9, 2.0, 2); stack(-2.9, 2.95, 1); stack(2.95, 1.7, 3); stack(2.95, 2.65, 1);
  for (const [x, z] of [[-0.9, 3.3], [-0.2, 3.3], [-0.55, 2.55], [2.3, 3.2]]) {
    box(0.62, 0.1, 0.62, L.M.wood, x, 0.18, z, { dirt: 0.3 });
    box(0.55, R(0.35, 0.55), 0.55, L.M.wood, x, 0.28, z, { dirt: 0.3, ry: R(-0.2, 0.2) });
  }

  // ---- signal mast with the team light (front-right corner)
  const mx = 4.35, mz = -0.2;
  cyl(0.11, 4.6, M.steel, mx, 0, mz, { seg: 12 });
  box(0.5, 0.85, 0.36, M.dark, mx, 4.1, mz + 0.05, { dirt: 0 });
  box(0.62, 0.06, 0.48, steel, mx, 4.95, mz + 0.05, { dirt: 0 });
  lamp(mx, 4.55, mz + 0.26, TEAM, { size: 0.22, k: 4.5, intensity: 5, dist: 4, shape: 'sphere' });
  sphere(0.13, M.emit('#ff3a22', 1.4), mx, 4.25, mz + 0.24, { cast: false });
  ladder(mx - 0.15, 0.2, 3.9, mz + 0.12, { ry: Math.PI / 2 });
  pointLight(TEAM, 3, cx, 2.0, Z1 + 1.0, 4.5);
}
