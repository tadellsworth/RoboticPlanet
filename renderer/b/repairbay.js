// Repair bay: an open-sided service shed (roofed at the back, open rafters at the front) over three repair
// cradles; a robotic welding arm throwing a bright spark onto a hull on the middle cradle; a monorail crane
// hoist lowering a spare plate onto the left cradle; a rack of spare plating, gas bottles and a parts cart.
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#c9c5ba'), olive = M.paint('#5d6247');
  const yel = M.paint('#d0a536', { rivets: false }), arm = M.paint('#d8a032', { rivets: false, panelW: 512, panelH: 512 });
  const glow = M.emit(ACCENT, 2.4), dim = M.emit(ACCENT, 1.2);
  L.seed(141);

  // ---- shed: posts and a sawtooth workshop roof over the back of the cradles; open on all sides.
  // Each roof tooth ends in a glazed face toward the viewer, lit warm from inside. (The camera looks down at
  // 57 deg, so the eave stays behind the cradles' sightline and the monorail hangs just under it.)
  const X0 = -4.35, X1 = 4.35, ZB = -4.1, ZF = 0.75, Y0 = 3.45, RISE = 0.75;
  const yAt = () => Y0;
  for (const x of [X0 + 0.2, X1 - 0.2]) {
    for (const z of [ZB + 0.25, -1.7, ZF - 0.2]) {
      box(0.3, Y0, 0.3, gun, x, 0, z);
      box(0.56, 0.14, 0.56, M.hazard, x, 0, z, { dirt: 0 });
    }
    beam([x, 0.5, ZF - 0.2], [x, Y0 - 0.5, -1.7], 0.1, 0.1, gun);               // wind bracing
    beam([x, 0.5, ZB + 0.25], [x, Y0 - 0.5, -1.7], 0.1, 0.1, gun);
    box(0.22, 0.3, ZF - ZB + 0.3, gun, x, Y0 - 0.3, (ZB + ZF) / 2, { dirt: 0 });     // side girders
  }
  const z0 = ZB - 0.15, z1 = ZF + 0.1, teeth = 3, td = (z1 - z0) / teeth, slope = Math.atan2(RISE, td), sl = Math.hypot(td, RISE);
  const sheet = M.ribbed('#7b8086', { period: 24 }), lit = new THREE.MeshStandardMaterial({ color: '#2a1a10', emissive: ACCENT, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1 }); lit.userData.glow = '#9a5420';
  for (let k = 0; k < teeth; k++) {
    const zb = z0 + k * td, zf = zb + td;
    const t = group(0, Y0 + RISE / 2, (zb + zf) / 2); t.rotation.x = -slope;
    box(X1 - X0 + 0.3, 0.09, sl, sheet, 0, -0.045, 0, { parent: t, dirt: 0.3 });
    box(X1 - X0 + 0.3, 0.12, 0.14, gun, 0, -0.02, -sl / 2, { parent: t, dirt: 0 });                 // valley gutter
    // glazed face (toward the viewer) with mullions
    box(X1 - X0 + 0.1, RISE - 0.06, 0.05, lit, 0, Y0 + 0.02, zf - 0.03, { cast: false, dirt: 0 });
    for (let x = X0 + 0.1; x <= X1 - 0.05; x += 0.55) box(0.06, RISE, 0.09, gun, x, Y0, zf, { dirt: 0 });
    box(X1 - X0 + 0.3, 0.1, 0.12, gun, 0, Y0 + RISE - 0.03, zf, { dirt: 0 });
    box(X1 - X0 + 0.3, 0.12, 0.12, gun, 0, Y0 - 0.1, zf, { dirt: 0 });
    for (const x of [X0 - 0.1, X1 + 0.1]) {                                                          // gable ends
      const g = new THREE.Shape(); g.moveTo(zb, 0); g.lineTo(zf, 0); g.lineTo(zf, RISE); g.closePath();
      const geo = new THREE.ExtrudeGeometry(g, { depth: 0.08, bevelEnabled: false }); geo.rotateY(-Math.PI / 2); geo.translate(0.04, 0, 0);
      mesh(geo, gun, x, Y0, 0, { dirt: 0 });
    }
  }
  box(X1 - X0 - 0.6, 0.06, 0.05, glow, 0, Y0 - 0.12, z1 + 0.04, { cast: false });                   // eave light strip
  // roof fan unit on the back tooth
  box(0.9, 0.3, 0.9, M.paint('#8a8f94', { rivets: false }), 2.6, Y0 + 0.28, z0 + 0.9);
  cyl(0.32, 0.08, M.dark, 2.6, Y0 + 0.58, z0 + 0.9, { seg: 20, dirt: 0 });
  // work lights hanging under the eave
  for (const x of [-2.85, 0, 2.85]) lamp(x, Y0 - 0.45, ZF - 0.3, ACCENT, { size: 0.2, k: 2.5, intensity: 5, dist: 4.5 });
  // beacon on the front corner of the roof
  sphere(0.2, M.emit(ACCENT, 3.5), X1 - 0.1, Y0 + RISE + 0.2, z1 - 0.1, { cast: false });
  pointLight(ACCENT, 3, X1 - 0.1, Y0 + RISE + 0.5, z1 + 0.4, 3);
  pointLight(ACCENT, 3, 0, Y0 - 0.6, -1.5, 5);                                                       // interior light behind the glazing

  // ---- back wall under the roof: tool boards and a workbench (mostly in shade)
  box(X1 - X0 - 0.4, 1.5, 0.15, M.paint('#6a6f74'), 0, 0, ZB + 0.05);
  for (const x of [-3.2, -1.6, 1.6, 3.2]) box(1.2, 0.8, 0.05, M.grille('#4a4f55'), x, 0.6, ZB + 0.15, { dirt: 0 });
  box(3.4, 0.9, 0.7, olive, 1.8, 0, ZB + 0.5); box(3.5, 0.08, 0.75, M.steel, 1.8, 0.9, ZB + 0.5, { dirt: 0 });
  ao(0, ZB + 0.6, 8.4, 1.2, 0.45);

  // ---- three repair cradles
  const CZ = 0.65, cradles = [-2.85, 0, 2.85];
  for (const cx of cradles) {
    box(2.25, 0.1, 2.75, M.plain('#2a2d30', 0.85), cx, 0, CZ, { dirt: 0, cast: false });
    for (const s of [-1, 1]) box(2.25, 0.02, 0.14, M.hazard, cx, 0.1, CZ + s * 1.31, { dirt: 0, cast: false });
    for (const s of [-1, 1]) box(0.26, 0.32, 2.3, gun, cx + s * 0.72, 0.1, CZ, { dirt: 0.2 });      // lift rails
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {                                           // clamp arms
      const px = cx + sx * 0.72, pz = CZ + sz * 0.85;
      box(0.18, 0.75, 0.18, yel, px, 0.42, pz, { dirt: 0.2 });
      beam([px, 1.12, pz], [px - sx * 0.3, 1.3, pz], 0.14, 0.14, yel);
      box(0.16, 0.08, 0.3, M.dark, px - sx * 0.36, 1.22, pz, { dirt: 0 });
    }
    box(1.7, 0.06, 0.05, glow, cx, 0.13, CZ + 1.4, { cast: false });                                // status strip
    pointLight(ACCENT, 3, cx, 0.7, CZ + 1.3, 2.4);
    ao(cx, CZ, 2.2, 2.6, 0.35);
  }

  // middle cradle: a hull shell with an open side panel, being welded
  const hx = 0, hz = CZ;
  box(1.36, 0.62, 1.8, off, hx, 0.62, hz);
  box(1.0, 0.12, 1.4, gun, hx - 0.1, 1.24, hz - 0.1, { dirt: 0 });
  box(0.05, 0.42, 0.9, M.dark, hx - 0.69, 0.72, hz + 0.1, { dirt: 0 });                            // open side panel
  for (const z of [-0.2, 0.15, 0.45]) pipe([[hx - 0.66, 0.85, hz + z], [hx - 0.4, 0.85, hz + z], [hx - 0.4, 1.1, hz + z]], 0.05, M.chrome);
  box(0.6, 0.04, 0.5, M.emit('#ff7a2a', 1.6), hx + 0.42, 1.365, hz + 0.33, { cast: false, dirt: 0 });  // heated seam
  // left cradle: empty, a spare plate on its way down from the hoist
  // right cradle: a drive unit (axle + wheels) on the clamps
  const rx = 2.85;
  hcyl(0.1, 1.5, M.steel, rx, 0.95, CZ - 0.35, { axis: 'x' }); hcyl(0.1, 1.5, M.steel, rx, 0.95, CZ + 0.55, { axis: 'x' });
  box(0.9, 0.3, 1.2, gun, rx, 0.8, CZ + 0.1, { dirt: 0.3 });
  for (const sx of [-1, 1]) for (const z of [CZ - 0.35, CZ + 0.55]) { hcyl(0.34, 0.24, M.dark, rx + sx * 0.82, 0.95, z, { axis: 'x' }); hcyl(0.15, 0.26, dim, rx + sx * 0.82, 0.95, z, { axis: 'x', cast: false }); }

  // ---- monorail crane hoist (along x, between the rafters) with trolley, chain, hook and a spare plate
  const my = yAt(CZ) - 0.45;
  box(X1 - X0 - 0.2, 0.22, 0.2, yel, 0, my, CZ, { dirt: 0 });
  box(X1 - X0 - 0.2, 0.05, 0.22, M.hazard, 0, my + 0.22, CZ, { dirt: 0 });
  for (const x of [-3.2, 0.1, 3.2]) box(0.08, yAt(CZ) - my - 0.12, 0.08, gun, x, my + 0.22, CZ, { dirt: 0 });
  const tx = -2.85;
  box(0.6, 0.35, 0.45, gun, tx, my - 0.35, CZ, { dirt: 0 });
  box(0.5, 0.4, 0.4, M.paint('#c9c5ba', { rivets: false }), tx, my - 0.75, CZ, { dirt: 0 });
  box(0.3, 0.06, 0.05, glow, tx, my - 0.5, CZ + 0.21, { cast: false });
  const hookY = 2.25;
  cyl(0.035, my - 0.75 - hookY, M.steel, tx, hookY, CZ, { seg: 8, dirt: 0 });
  mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 16, Math.PI * 1.4), M.steel, tx, hookY - 0.08, CZ, { rz: -0.4, dirt: 0 });
  const plY = 1.6;
  for (const [dx, dz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) beam([tx, hookY - 0.15, CZ], [tx + dx, plY + 0.06, CZ + dz], 0.025, 0.025, M.steel);
  box(1.4, 0.07, 1.0, M.paint('#7d8a74'), tx, plY, CZ, { dirt: 0.2 });

  // ---- welding robot arm between the middle and right cradles, torch on the hull seam
  const S = [1.42, 0.85, 2.0], E = [1.62, 2.3, 1.45], W = [0.98, 2.0, 1.02], T = [0.58, 1.38, 0.98];
  cyl(0.42, 0.25, gun, S[0], 0, S[2], { seg: 24 }); cyl(0.32, 0.45, arm, S[0], 0.25, S[2], { seg: 24, dirt: 0.2 });
  hoop(0.33, 0.04, glow, S[0], 0.62, S[2], { cast: false });
  sphere(0.25, arm, ...S, { dirt: 0 }); sphere(0.2, arm, ...E, { dirt: 0 }); sphere(0.14, gun, ...W, { dirt: 0 });
  beam(S, E, 0.3, 0.32, arm); beam(E, W, 0.22, 0.24, arm);
  hoop(0.21, 0.035, glow, E[0], E[1], E[2], { cast: false });
  beam(W, T, 0.08, 0.08, M.dark);
  cyl(0.07, 0.18, M.chrome, T[0], T[1] + 0.02, T[2], { seg: 10, dirt: 0 });
  pipe([[S[0] + 0.25, 0.4, S[2] + 0.2], [S[0] + 0.3, 1.2, S[2] - 0.05], [E[0] + 0.15, E[1] - 0.1, E[2]], [W[0] + 0.05, W[1] + 0.1, W[2]]], 0.04, M.dark);
  // the spark: white-hot core, short bright streaks spraying out and down, warm light
  const spark = M.emit('#fff1d6', 7); spark.userData.glow = '#ffd9a0';
  sphere(0.15, spark, T[0], T[1], T[2], { cast: false });
  const streak = M.emit('#ffc46b', 5);
  L.seed(77);
  for (let k = 0; k < 16; k++) {
    const a = L.rnd() * Math.PI * 2, up = -0.1 + L.rnd() * 0.7, len = 0.35 + L.rnd() * 0.6;
    const d = [Math.cos(a) * Math.cos(up), Math.sin(up), Math.sin(a) * Math.cos(up)];
    beam([T[0] + d[0] * 0.08, T[1] + d[1] * 0.08, T[2] + d[2] * 0.08], [T[0] + d[0] * len, T[1] + d[1] * len, T[2] + d[2] * len], 0.035, 0.035, streak, { cast: false });
  }
  pointLight('#ffb466', 9, T[0] + 0.1, T[1] + 0.35, T[2] + 0.25, 4);
  // gas bottles and a small control console beside the arm
  for (const [x, z, cap] of [[2.05, 2.55, ACCENT], [2.42, 2.62, '#b8c0c8']]) {
    cyl(0.17, 1.15, M.paint(cap === ACCENT ? '#5d6247' : '#3f5f78', { rivets: false }), x, 0, z, { seg: 20 });
    sphere(0.17, M.plain(cap, 0.5), x, 1.15, z, { dome: true });
  }
  box(0.55, 0.95, 0.4, gun, 0.75, 0, 2.6);
  mesh(new THREE.PlaneGeometry(0.42, 0.28), dim, 0.75, 0.8, 2.81, { rx: -0.5, cast: false, dirt: 0 });
  ao(1.6, 2.5, 1.8, 0.6, 0.45);

  // ---- rack of spare plating (front left): A-frame with plates leaning on both faces
  const ax = -3.05, az = 3.85, aw = 2.4;
  for (const x of [ax - aw / 2 + 0.15, ax + aw / 2 - 0.15]) {
    beam([x, 0, az - 0.5], [x, 1.55, az], 0.1, 0.1, yel); beam([x, 0, az + 0.5], [x, 1.55, az], 0.1, 0.1, yel);
  }
  box(aw, 0.1, 0.1, yel, ax, 1.5, az, { dirt: 0 }); box(aw, 0.12, 1.2, gun, ax, 0, az, { dirt: 0.2 });
  const plates = ['#7d8a74', '#8a8f94', '#c9c5ba', '#5d6247', '#8a8f94'];
  plates.forEach((c, i) => {
    const p = group(ax - 0.12 + (i - 2) * 0.05, 0.12, az + 0.18 + i * 0.09); p.rotation.x = 0.28 - i * 0.015;
    box(aw - 0.45 - (i % 2) * 0.25, 1.25 - (i % 3) * 0.12, 0.05, M.paint(c, { rivets: i % 2 === 0 }), 0, 0, 0, { parent: p, dirt: 0.3 });
  });
  for (let i = 0; i < 3; i++) { const p = group(ax + 0.1, 0.12, az - 0.2 - i * 0.08); p.rotation.x = -0.28; box(aw - 0.5, 1.2, 0.05, M.paint(plates[i + 1]), 0, 0, 0, { parent: p, dirt: 0.3 }); }
  ao(ax, az, aw, 1.3, 0.5);

  // ---- parts cart and drums (front right)
  box(1.2, 0.75, 0.7, M.paint('#4f6b78', { rivets: false }), 3.4, 0.12, 3.85);
  for (const [x, z] of [[2.9, 3.55], [3.9, 3.55], [2.9, 4.15], [3.9, 4.15]]) cyl(0.1, 0.12, M.dark, x, 0, z, { seg: 12, dirt: 0 });
  for (let k = 0; k < 3; k++) box(0.34, 0.2, 0.55, M.paint(['#c9c5ba', '#5d6247', '#8a8f94'][k], { rivets: false }), 3.05 + k * 0.36, 0.87, 3.85, { dirt: 0 });
  for (const [x, z] of [[4.15, 2.75], [3.55, 2.7]]) { cyl(0.3, 0.85, M.paint('#8a5a2e', { rivets: false }), x, 0, z, { seg: 20 }); hoop(0.31, 0.03, gun, x, 0.3, z); hoop(0.31, 0.03, gun, x, 0.6, z); }
  ao(3.6, 3.4, 1.6, 1.6, 0.45);
  // floor bay markings in front of each cradle
  
}
