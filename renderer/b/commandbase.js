// Command base: the colony's landing craft dug into a fortified compound. Four gated blast walls, corner bastions
// with static guns, the hull as an armoured keep with a glowing reactor dome, comms mast, roof landing pad.
export const config = { pad: false };
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, ladder, canvasTex, M, THREE, TEAM } = L;
  L.frameCompoundOpts({ half: 7.0, width: 0.70, cy: 0.62 });
  const gun = M.paint('#4b5157'), armor = M.rough('#8a8377'), off = M.paint('#c9c5ba'), hull = M.paint('#5a6066', { panelW: 128, panelH: 128 });
  const glow = M.emit(TEAM, 2.4);
  L.seed(221);

  // courtyard slab with lane markings from each gate to the keep
  box(14.6, 0.4, 14.6, M.rough('#8f887c'), 0, -0.4, 0, { dirt: 0.5, dirtH: 0.4 });
  const lane = M.plain('#d9b23a', 0.7);
  for (const r of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) { const g = group(0, 0, 0, r); for (let t = 3.7; t < 6.2; t += 0.75) box(0.14, 0.012, 0.42, lane, -0.7, 0, t, { parent: g, dirt: 0, cast: false }); for (let t = 3.7; t < 6.2; t += 0.75) box(0.14, 0.012, 0.42, lane, 0.7, 0, t, { parent: g, dirt: 0, cast: false }); }

  // blast walls: angled armoured concrete, hazard-striped tops, team running lights; a gate in each wall
  const sec = new THREE.Shape(); sec.moveTo(-0.7, 0); sec.lineTo(0.7, 0); sec.lineTo(0.32, 2.0); sec.lineTo(-0.32, 2.0); sec.closePath();
  const WC = 6.3, GATE = 1.75, inner = 5.0;
  for (let side = 0; side < 4; side++) {
    const g = group(0, 0, 0, side * Math.PI / 2);
    for (const s of [-1, 1]) {
      const x0 = s * GATE, x1 = s * inner, len = Math.abs(x1 - x0), cx = (x0 + x1) / 2;
      const geo = new THREE.ExtrudeGeometry(sec, { depth: len, bevelEnabled: false }); geo.translate(0, 0, -len / 2); geo.rotateY(Math.PI / 2);
      const w = mesh(geo, armor, cx, 0, WC, { parent: g, dirtH: 1.0 });
      box(len, 0.1, 0.62, M.hazard, cx, 2.0, WC, { parent: g, dirt: 0 });
      box(len - 0.4, 0.07, 0.05, glow, cx, 1.05, WC + 0.53, { parent: g, cast: false });
      box(len - 0.4, 0.07, 0.05, glow, cx, 1.05, WC - 0.53, { parent: g, cast: false });
      for (let k = 0; k < 3; k++) box(0.06, 1.7, 1.0, M.plain('#6d675d', 0.9), cx - len / 2 + 0.8 + k * (len - 1.6) / 2, 0.05, WC, { parent: g, dirt: 0 });
      // gate pillar
      box(0.9, 2.7, 1.7, armor, s * (GATE + 0.2), 0, WC, { parent: g });
      box(0.95, 0.16, 1.75, M.hazard, s * (GATE + 0.2), 2.7, WC, { parent: g, dirt: 0 });
      box(0.06, 1.6, 0.4, M.hazard, s * (GATE - 0.24), 0.3, WC + 0.66, { parent: g, dirt: 0 });
    }
    box(2 * GATE + 1.6, 0.42, 0.55, gun, 0, 2.7, WC, { parent: g, dirt: 0 });
    box(2 * GATE - 0.2, 0.07, 0.07, glow, 0, 2.66, WC + 0.3, { parent: g, cast: false });
    box(2 * GATE - 0.2, 0.07, 0.07, glow, 0, 2.66, WC - 0.3, { parent: g, cast: false });
  }
  pointLight(TEAM, 6, 0, 1.6, WC + 1.2, 4);

  // corner bastions with static twin-gun emplacements facing outward
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = sx * 6.15, bz = sz * 6.15, out = Math.atan2(-sz, sx);
    cyl(1.75, 2.9, armor, bx, 0, bz, { rTop: 1.45, seg: 8, ry: Math.PI / 8 });
    cyl(1.5, 0.14, M.hazard, bx, 2.9, bz, { seg: 8, ry: Math.PI / 8, dirt: 0 });
    for (let k = 0; k < 4; k++) { const a = out + (k - 1.5) * 0.45; box(0.4, 0.13, 0.12, M.dark, bx + Math.cos(a) * 1.62, 1.9, bz - Math.sin(a) * 1.62, { ry: a + Math.PI / 2, dirt: 0 }); }
    cyl(0.62, 0.3, gun, bx, 3.04, bz, { dirt: 0 });
    const tg = group(bx, 3.34, bz, out);
    box(0.95, 0.5, 0.8, gun, 0, 0, 0, { parent: tg, dirt: 0 });
    for (const dz of [-0.18, 0.18]) { const b = hcyl(0.075, 1.15, M.steel, 0.95, 0.27, dz, { axis: 'x', parent: tg }); }
    box(0.3, 0.08, 0.5, glow, -0.3, 0.5, 0, { parent: tg, cast: false });
  }

  // the keep: old landing craft on an octagonal armoured base, legs folded and anchored
  cyl(3.4, 2.2, armor, 0, 0, 0, { rTop: 3.05, seg: 8, ry: Math.PI / 8 }); ao(0, 0, 7, 7, 0.55);
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; box(0.7, 0.12, 0.1, M.dark, Math.cos(a) * 3.2, 1.3, Math.sin(a) * 3.2, { ry: -a + Math.PI / 2, dirt: 0 }); }
  cyl(3.0, 1.35, hull, 0, 2.2, 0, { rTop: 2.3, seg: 8, ry: Math.PI / 8, soot: 0.4 });
  cyl(2.3, 0.3, gun, 0, 3.55, 0, { seg: 8, ry: Math.PI / 8, dirt: 0 });
  hoop(2.95, 0.07, glow, 0, 2.28, 0, { cast: false });
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    beam([c * 2.6, 2.9, s * 2.6], [c * 4.4, 0.35, s * 4.4], 0.4, 0.4, gun);
    beam([c * 2.9, 2.3, s * 2.9], [c * 4.1, 0.9, s * 4.1], 0.16, 0.16, M.chrome);
    box(1.1, 0.45, 1.1, M.concrete, c * 4.45, 0, s * 4.45, { ry: -a });
    cyl(0.5, 0.15, M.steel, c * 4.45, 0.45, s * 4.45, { dirt: 0 });
  }
  for (const a of [0, Math.PI]) { const g = group(0, 0, 0, a); box(1.3, 0.75, 0.1, M.hazard, 0, 2.5, 2.75, { parent: g, dirt: 0 }); box(1.0, 0.5, 0.06, M.dark, 0, 2.62, 2.8, { parent: g, dirt: 0 }); }

  // reactor dome
  sphere(1.35, M.emit(TEAM, 1.1), 0, 3.85, 0, { dome: true, cast: false });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d9f4ff', roughness: 0.05, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false }); glass.envMapIntensity = 1.5;
  mesh(new THREE.SphereGeometry(1.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 3.85, 0, { cast: false, dirt: 0 });
  for (let k = 0; k < 6; k++) { const r = new THREE.TorusGeometry(1.56, 0.05, 6, 24, Math.PI); mesh(r, gun, 0, 3.85, 0, { ry: k * Math.PI / 6, dirt: 0 }); }
  hoop(1.56, 0.1, gun, 0, 3.87, 0);
  pointLight(TEAM, 10, 0, 4.9, 1.6, 6);

  // comms mast with team beacon (rises from the keep's back)
  const mx = 1.5, mz = -1.2;
  cyl(0.38, 0.7, gun, mx, 3.85, mz, { dirt: 0 });
  cyl(0.17, 9.4, M.steel, mx, 4.5, mz, { seg: 12, rTop: 0.1, dirt: 0 });
  for (const y of [6.2, 8.2, 10.2, 12.0]) box(1.3 - (y - 6) * 0.08, 0.09, 0.09, M.steel, mx, y, mz, { dirt: 0 });
  for (const [dx, dz] of [[-1.1, 0.6], [1.0, 0.7], [0, -1.1]]) beam([mx + dx, 3.9, mz + dz], [mx, 9.0, mz], 0.035, 0.035, M.dark);
  const dish = new THREE.SphereGeometry(0.6, 20, 8, 0, Math.PI * 2, 0, 0.9); dish.translate(0, -0.6, 0);
  const dm = mesh(dish, off, mx - 0.3, 7.6, mz + 0.25, { rx: -1.0, dirt: 0 }); dm.material.side = THREE.DoubleSide;
  sphere(0.3, M.emit(TEAM, 4), mx, 14.25, mz, { cast: false }); pointLight(TEAM, 5, mx, 14.0, mz + 0.6, 4);
  cyl(0.18, 0.15, M.dark, mx, 13.9, mz, { dirt: 0 });

  // annex with a marked landing pad on its roof (back right), supply tanks and crates
  const padMark = canvasTex(256, (g, n) => {
    g.fillStyle = '#3d4247'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#d9b23a'; g.lineWidth = 14; g.beginPath(); g.arc(n / 2, n / 2, n * 0.36, 0, 7); g.stroke();
    g.fillStyle = '#e6e2d8'; g.fillRect(n * 0.47, n * 0.25, n * 0.06, n * 0.5); g.fillRect(n * 0.25, n * 0.47, n * 0.5, n * 0.06);
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * n, Math.random() * n, 6, 3);
  });
  const roof = new THREE.MeshStandardMaterial({ map: padMark, roughness: 0.8, vertexColors: true });
  const ax = 3.5, az = -3.5;
  box(2.6, 1.5, 2.6, off, ax, 0, az); ao(ax, az, 2.6, 2.6, 0.5);
  box(2.7, 0.1, 2.7, [gun, gun, roof, gun, gun, gun], ax, 1.5, az, { dirt: 0 });
  for (const [dx, dz] of [[-1.25, -1.25], [1.25, -1.25], [1.25, 1.25], [-1.25, 1.25]]) lamp(ax + dx, 1.62, az + dz, TEAM, { size: 0.1, light: false, k: 3 });
  for (const z of [-4.2, -3.0]) { cyl(0.5, 1.6, off, -4.0, 0, z, { seg: 20 }); hoop(0.52, 0.04, gun, -4.0, 1.0, z); }
  for (const [x, z, y] of [[3.4, 3.6, 0], [4.2, 3.6, 0], [3.8, 3.6, 0.6]]) box(0.75, 0.6, 0.6, M.paint('#5d6247'), x, y, z);
  for (const [x, z] of [[-3.8, 3.5], [-3.2, 4.1]]) cyl(0.3, 0.8, M.paint('#4f6b78', { rivets: false }), x, 0, z, { seg: 16 });
}
