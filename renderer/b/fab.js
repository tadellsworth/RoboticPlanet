// Chip fab: sealed clean-room block, glowing lime circuit pattern on the roof, roof fans, cooling-fin bank, airlock.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips round the parapet, airlock and
// cooling bank, warm lit window bands, a transformer yard with arcing insulators, a junction box and conduit into the
// wall, cables to the cooling bank, floodlights, beacons). Its lights are team-coloured: render one image per team. Base
// render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, lamp, pointLight, ao, mesh, canvasTex, group, sphere, M, THREE, ACCENT, ladder } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), off = M.paint('#c9c5ba', { panelW: 128, panelH: 256 });
  L.seed(51);
  const bx = -0.5, bz = -0.9, W = 6.8, D = 5.4, H = 3.1;

  box(W, H, D, off, bx, 0, bz); ao(bx, bz, W, D);
  box(W + 0.2, 0.3, 0.22, warm, bx, H, bz + D / 2, { dirt: 0 }); box(W + 0.2, 0.3, 0.22, warm, bx, H, bz - D / 2, { dirt: 0 });
  box(0.22, 0.3, D, warm, bx - W / 2, H, bz, { dirt: 0 }); box(0.22, 0.3, D, warm, bx + W / 2, H, bz, { dirt: 0 });
  box(W - 0.4, 0.1, 0.06, M.emit(ACCENT, 2.2), bx, H - 0.45, bz + D / 2 + 0.01, { cast: false });

  // circuit-pattern roof panel (emissive map)
  const circuit = canvasTex(1024, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.strokeStyle = '#b4ff3c'; g.fillStyle = '#b4ff3c'; g.lineCap = 'square';
    const d0 = n * 0.38, d1 = n * 0.62, m = 60;
    g.lineWidth = 10; g.strokeRect(d0, d0, d1 - d0, d1 - d0);
    g.globalAlpha = 0.55; for (let k = d0 + 24; k < d1 - 10; k += 24) { g.fillRect(d0 + 18, k, d1 - d0 - 36, 4); } g.globalAlpha = 1;
    const side = (rot) => { g.save(); g.translate(n / 2, n / 2); g.rotate(rot); g.translate(-n / 2, -n / 2);
      for (let i = 0; i < 6; i++) { const x0 = d0 + (i + 0.5) * (d1 - d0) / 6, off = (i - 2.5) * 46; g.lineWidth = 9;
        g.beginPath(); g.moveTo(x0, d0); g.lineTo(x0, d0 - 50 - Math.abs(i - 2.5) * 12); g.lineTo(x0 + off, d0 - 110 - Math.abs(i - 2.5) * 12); g.lineTo(x0 + off, m + 22); g.stroke();
        g.fillRect(x0 + off - 16, m, 32, 32); }
      g.restore(); };
    for (let r = 0; r < 4; r++) side(r * Math.PI / 2);
    g.globalAlpha = 0.35; g.lineWidth = 4; for (let i = 0; i < 14; i++) { const y = 120 + i * 55; g.beginPath(); g.moveTo(m, y); g.lineTo(n * 0.22, y); g.lineTo(n * 0.26, y + 30); g.stroke(); g.beginPath(); g.moveTo(n - m, y); g.lineTo(n * 0.78, y); g.lineTo(n * 0.74, y - 30); g.stroke(); } g.globalAlpha = 1;
  });
  const panelBase = canvasTex(256, (g, n) => { g.fillStyle = '#1b1f1d'; g.fillRect(0, 0, n, n); g.strokeStyle = '#2a302c'; g.lineWidth = 2; for (let k = 0; k <= n; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); } });
  const pm = new THREE.MeshStandardMaterial({ map: panelBase, emissiveMap: circuit, emissive: ACCENT, emissiveIntensity: 2.0, roughness: 0.35, metalness: 0.5 }); pm.userData.glow = ACCENT;
  const pgeo = new THREE.PlaneGeometry(4.0, 3.0); pgeo.rotateX(-Math.PI / 2); mesh(pgeo, pm, bx - 0.3, H + 0.09, bz + 0.45, { cast: false, dirt: 0 });
  box(4.2, 0.06, 3.2, gun, bx - 0.3, H, bz + 0.45, { dirt: 0, cast: false });
  pointLight(ACCENT, 5, bx - 0.3, H + 1.2, bz + 0.6, 4);

  // roof fans and a duct unit
  for (const fx of [bx - 2.3, bx + 2.1]) {
    const fz = bz - 2.0;
    cyl(0.78, 0.6, gun, fx, H, fz, { dirt: 0 }); cyl(0.66, 0.02, M.dark, fx, H + 0.6, fz, { dirt: 0, cast: false });
    for (let k = 0; k < 4; k++) { const g = group(fx, H + 0.63, fz); g.rotation.y = k * Math.PI / 4 + 0.3; box(1.2, 0.03, 0.16, M.steel, 0, 0, 0, { parent: g, dirt: 0 }); }
    cyl(0.14, 0.08, M.steel, fx, H + 0.6, fz, { dirt: 0 });
  }
  box(1.2, 0.7, 0.9, M.grille(), bx + 2.5, H, bz + 1.6);
  ladder(bx - W / 2 - 0.05, 0, H + 0.3, bz + 1.2, { ry: Math.PI / 2 });

  // cooling-fin bank on the right side
  const kx = bx + W / 2 + 0.7;
  box(1.2, 0.4, 4.8, gun, kx, 0, bz, { dirt: 0.6 });
  for (let i = 0; i < 18; i++) box(1.0, 2.0, 0.08, M.steel, kx, 0.4, bz - 2.3 + i * 0.27, { dirt: 0.4 });
  box(1.2, 0.12, 4.8, warm, kx, 2.4, bz, { dirt: 0 });
  pipe([[bx + W / 2, 1.2, bz - 1.6], [kx - 0.5, 1.2, bz - 1.6]], 0.14, M.steel);

  // airlock vestibule (front)
  const ax = bx - 0.6, az = bz + D / 2 + 0.6;
  box(1.9, 2.4, 1.2, off, ax, 0, az); box(2.1, 0.16, 1.4, warm, ax, 2.4, az, { dirt: 0 });
  box(1.0, 1.9, 0.06, M.dark, ax, 0, az + 0.6, { dirt: 0.4 });
  box(1.15, 0.08, 0.08, M.emit(ACCENT, 2.6), ax, 2.0, az + 0.62, { cast: false });
  box(1.9, 0.08, 0.5, M.hazard, ax, 0, az + 0.85, { dirt: 0 });
  lamp(ax + 0.75, 1.5, az + 0.62, ACCENT, { size: 0.12, intensity: 2, dist: 2, k: 3 });

  // process-gas tanks (back left) give the block a taller silhouette
  for (const tz of [-3.3, -2.0]) { cyl(0.52, 3.9, M.paint('#d3cfc4', { rivets: false }), -4.35, 0, tz, { seg: 28 }); L.hoop(0.54, 0.05, M.steel, -4.35, 1.3, tz); L.hoop(0.54, 0.05, M.steel, -4.35, 2.6, tz); sphere(0.52, M.paint('#d3cfc4', { rivets: false }), -4.35, 3.9, tz, { dome: true }); }
  L.ao(-4.35, -2.65, 1.1, 2.4, 0.5);
  pipe([[-4.35, 3.2, -2.65], [bx - W / 2, 3.2, -2.65]], 0.1, M.steel);

  // utility skid on the left with pipes into the wall
  box(1.4, 1.1, 1.6, gun, -4.35, 0, 1.9); hcyl(0.42, 1.4, M.paint('#9fa4a6'), -4.35, 1.5, 1.9, { axis: 'z' });
  pipe([[-4.35, 0.8, 1.1], [-4.35, 0.8, 0.4], [bx - W / 2, 0.8, 0.4]], 0.12, M.steel);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: round the parapet's top edge, the airlock's eave and the cooling bank's top edges
    for (const s of [-1, 1]) { K.strip(W + 0.4, bx, H + 0.37, bz + s * (D / 2 + 0.12)); K.strip(D + 0.2, bx + s * (W / 2 + 0.12), H + 0.37, bz, Math.PI / 2); }
    K.strip(2.1, ax, 2.47, az + 0.72);
    K.strip(1.2, kx, 2.55, bz + 2.42); K.strip(4.8, kx + 0.62, 2.55, bz, Math.PI / 2);
    // warm lit window bands on the clean-room wall either side of the airlock
    K.windows(2.6, 0.36, bx + 1.85, 1.45, bz + D / 2 + 0.03, 0, 5);
    K.windows(1.45, 0.36, bx - 2.5, 1.45, bz + D / 2 + 0.03, 0, 2);
    // transformer yard at the front right, a junction box by the airlock, cables up to bushings on the cooling bank
    const qx = 2.95, qz = 3.45;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(0.4, 2.25, 0);
    K.conduit([[qx - 0.45, 0.14, qz], [0.4, 0.14, qz], [0.4, 0.14, 2.47]], 0.05);
    K.conduit([[0.4, 0.55, 2.05], [0.4, 0.55, 1.87], [0.4, 1.25, 1.87]], 0.05);
    box(1.0, 0.08, 0.16, K.steelD, kx, 2.62, bz + 2.25, { dirt: 0 });
    for (const [k, t] of [[-0.3, -0.28], [0.3, 0.28]]) {
      cyl(0.035, 0.16, M.plain('#c9c2b0', 0.4, 0.1), kx + k, 2.7, bz + 2.25, { seg: 8, dirt: 0 });
      K.cable([qx + t, 1.17, qz], [kx + k, 2.86, bz + 2.25], 0.2);
    }
    // floodlights at the front corners
    K.flood(4.4, 2.35, 2.5, -0.6);
    K.flood(-4.4, 3.65, 2.4, 0.55);
    // beacons: amber on the gas tanks, team on the roof fans' hubs and the duct unit
    for (const tz of [-3.3, -2.0]) K.beacon(-4.35, 4.48, tz, '#ffb347');
    for (const fx of [bx - 2.3, bx + 2.1]) K.beacon(fx, H + 0.75, bz - 2.0);
    K.beacon(bx + 2.95, H + 0.8, bz + 1.95);
  }
  // ---------------------------------------------------------------- end of power layer
}
