// Generator: fuel-burning power plant. Two container gensets with roof radiator fans, silencers and tall exhaust stacks,
// a fuel day tank with a tanker fill point, a transformer with switchgear, glowing power bus and a line pole.
//   ?part=work&f=k   only the radiator fan blades (turning) and the power-bus lights (pulsing), frame k of 8
// Marks: ex0, ex1 (exhaust stack tips), fill (tanker fill point).
import { workLayer, litMat } from './worklib.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, mark, canvasTex, M, THREE, ACCENT } = L;
  const q = new URLSearchParams(location.search), WORK = q.get('part') === 'work', F = +(q.get('f') || 0);
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), olive = M.paint('#6b6f5a');
  const rib = M.ribbed('#b3ad9f'), tfm = M.paint('#4f6158'), glow = M.emit(ACCENT, 2.6), dim = M.emit(ACCENT, 1.3);
  L.seed(907);
  const fans = [], bus = [];

  // ---- two container gensets along the back
  const gz = -1.75, GW = 3.5, GD = 2.1, GH = 2.55;
  const stackTips = [];
  for (const [k, gx] of [[0, -2.15], [1, 2.05]]) {
    box(GW + 0.3, 0.3, GD + 0.3, gunD, gx, 0, gz); ao(gx, gz, GW + 0.3, GD + 0.3, 0.55);       // skid
    box(GW, GH, GD, rib, gx, 0.3, gz, { dirtH: 1.0 });
    box(GW + 0.12, 0.14, GD + 0.12, gun, gx, 0.3 + GH, gz, { dirt: 0 });                     // roof trim
    // front: two louvred intake panels, a service door with a hazard band, a control panel with a lit display
    for (const dx of [-1.05, 0.15]) box(0.95, 1.15, 0.06, M.grille('#3d4247'), gx + dx, 0.75, gz + GD / 2 + 0.01, { dirt: 0.3 });
    box(0.7, 1.75, 0.06, gun, gx + 1.25, 0.32, gz + GD / 2 + 0.02, { dirt: 0.3 });
    box(0.74, 0.1, 0.07, M.hazard, gx + 1.25, 2.0, gz + GD / 2 + 0.03, { dirt: 0 });
    box(0.5, 0.36, 0.12, gunD, gx + 1.25, 1.2, gz + GD / 2 + 0.08, { dirt: 0 });
    box(0.34, 0.12, 0.02, glow, gx + 1.25, 1.36, gz + GD / 2 + 0.15, { cast: false });
    // roof: two radiator fans in round shrouds
    for (const fx of [gx - 0.95, gx + 0.15]) {
      const y = 0.44 + GH;
      cyl(0.72, 0.22, gunD, fx, y, gz + 0.1, { seg: 32, dirt: 0 });
      cyl(0.62, 0.02, M.dark, fx, y + 0.22, gz + 0.1, { seg: 32, dirt: 0, cast: false });
      hoop(0.66, 0.035, M.steel, fx, y + 0.24, gz + 0.1);
      const fan = group(fx, y + 0.2, gz + 0.1, 0); fan.rotation.y = F * (Math.PI * 2 / 5) / 8 * 3 + fx;
      for (let b = 0; b < 5; b++) { const bl = box(0.55, 0.02, 0.2, M.steel, 0.3, 0, 0, { parent: fan, dirt: 0 }); bl.geometry.translate(0, 0, 0); const p = new THREE.Group(); fan.add(p); p.rotation.y = b * Math.PI * 2 / 5; p.add(bl); bl.position.set(0.32, 0, 0); bl.rotation.x = 0.35; }
      cyl(0.12, 0.08, gun, 0, 0, 0, { parent: fan, seg: 16, dirt: 0 });
      for (const s of [-1, 1]) box(1.36, 0.03, 0.04, M.steel, fx, y + 0.26, gz + 0.1 + s * 0.3, { dirt: 0 });   // guard bars
      fans.push(fan);
    }
    // silencer on stands across the back of the roof, and the exhaust stack with a rain cap
    const mx = gx + 1.05, my = 0.44 + GH + 0.45, mz = gz - 0.55;
    for (const dx of [-0.35, 0.35]) box(0.1, 0.4, 0.1, gun, mx + dx, 0.44 + GH, mz, { dirt: 0 });
    hcyl(0.34, 1.25, M.steel, mx, my, mz, { axis: 'x', seg: 24, soot: 0.4 });
    pipe([[mx + 0.62, my, mz], [mx + 0.85, my, mz], [mx + 0.85, my + 0.3, mz]], 0.15, M.steel);
    const sx = mx + 0.85, sy0 = my + 0.3, sy1 = 6.1;
    cyl(0.25, sy1 - sy0, gunD, sx, sy0, mz, { seg: 20, soot: 1.6 });
    for (const dy of [0.7, 1.9]) hoop(0.27, 0.05, M.steel, sx, sy0 + dy, mz);
    cyl(0.29, 0.12, M.steel, sx, sy1 - 0.12, mz, { seg: 20, dirt: 0 });
    const cap = box(0.52, 0.03, 0.52, gun, sx, sy1, mz, { dirt: 0 }); cap.rotation.z = -0.5; cap.position.x += 0.1;
    stackTips.push([sx, sy1 + 0.08, mz]);
    // side stair to the roof
    for (let i = 0; i < 6; i++) box(0.5, 0.06, 0.28, M.grating, gx - GW / 2 - 0.35, 0.3 + i * 0.37, gz + GD / 2 - 0.3 - i * 0.22, { dirt: 0 });
  }
  mark('ex0', ...stackTips[0]); mark('ex1', ...stackTips[1]);

  // ---- glowing power bus: covered cable trays from both gensets to the transformer
  const tx = 2.75, tz = 2.15;
  const trayPts = [[-2.15, 0.36, gz + 1.25], [-2.15, 0.36, 0.25], [tx - 0.8, 0.36, 0.25], [tx - 0.8, 0.36, tz - 0.4]];
  for (let i = 0; i < trayPts.length - 1; i++) {
    const a = trayPts[i], b = trayPts[i + 1], mxx = (a[0] + b[0]) / 2, mzz = (a[2] + b[2]) / 2, lx = Math.abs(b[0] - a[0]) + 0.4, lz = Math.abs(b[2] - a[2]) + 0.4;
    box(lx, 0.16, lz, gun, mxx, 0.2, mzz, { dirt: 0.2 });
    bus.push(box(lx - 0.25, 0.03, lz - 0.25, glow, mxx, 0.36, mzz, { cast: false }));
  }
  box(0.4, 0.16, 1.5, gun, 2.05, 0.2, gz + 1.6, { dirt: 0.2 }); bus.push(box(0.15, 0.03, 1.25, glow, 2.05, 0.36, gz + 1.6, { cast: false }));

  // ---- transformer (front right): tank with cooling fins, three bushings, switchgear cabinet, fenced yard
  box(2.6, 0.25, 2.2, M.concrete, tx, 0, tz); ao(tx, tz, 2.6, 2.2, 0.5);
  box(1.3, 1.4, 1.0, tfm, tx - 0.25, 0.25, tz - 0.15);
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) box(0.05, 1.05, 0.28, tfm, tx - 0.8 + i * 0.18, 0.4, tz - 0.15 + s * 0.62, { dirt: 0 });
  for (let i = 0; i < 3; i++) {
    const bx = tx - 0.65 + i * 0.4, by = 1.65;
    for (let j = 0; j < 4; j++) cyl(j % 2 ? 0.07 : 0.11, 0.1, M.plain('#c9b48a', 0.35), bx, by + j * 0.1, tz - 0.15, { seg: 14, dirt: 0 });
    sphere(0.06, M.steel, bx, by + 0.45, tz - 0.15, {});
  }
  box(0.7, 1.5, 0.6, off, tx + 0.8, 0.25, tz - 0.25);
  box(0.5, 0.2, 0.03, glow, tx + 0.8, 1.15, tz + 0.06, { cast: false }); for (let i = 0; i < 3; i++) box(0.08, 0.08, 0.03, M.emit(i ? '#44ff88' : '#ffb34a', 2), tx + 0.62 + i * 0.18, 0.85, tz + 0.06, { cast: false });
  for (const [x0, z0, x1, z1] of [[tx - 1.25, tz + 1.05, tx + 1.25, tz + 1.05], [tx + 1.25, tz - 1.05, tx + 1.25, tz + 1.05]]) {
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.6);
    for (let i = 0; i <= n; i++) box(0.05, 0.75, 0.05, M.steel, x0 + (x1 - x0) * i / n, 0.25, z0 + (z1 - z0) * i / n, { dirt: 0 });
    beam([x0, 0.95, z0], [x1, 0.95, z1], 0.03, 0.03, M.steel); beam([x0, 0.55, z0], [x1, 0.55, z1], 0.02, 0.02, M.steel);
  }
  box(0.6, 0.04, 0.6, M.hazard, tx - 0.95, 0.26, tz + 0.75, { dirt: 0 });

  // ---- line pole (right edge) carrying the output away, with insulators and cables to the bushings
  const px = 4.15, pz = -0.2;
  cyl(0.14, 5.6, M.paint('#6b5a46', { rivets: false }), px, 0, pz, { rTop: 0.11, seg: 12 });
  box(0.1, 0.12, 1.5, gun, px, 5.2, pz, { dirt: 0 });
  for (const dz of [-0.6, 0, 0.6]) { cyl(0.05, 0.25, M.plain('#c9b48a', 0.35), px, 5.32, pz + dz, { seg: 10, dirt: 0 }); sphere(0.05, M.emit(ACCENT, 1.6), px, 5.6, pz + dz, { cast: false }); }
  for (let i = 0; i < 3; i++) {
    const a = [tx - 0.65 + i * 0.4, 2.1, tz - 0.15], b = [px, 5.58, pz - 0.6 + i * 0.6], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.25, (a[2] + b[2]) / 2];
    beam(a, mid, 0.025, 0.025, M.dark); beam(mid, b, 0.025, 0.025, M.dark);
  }
  lamp(px, 5.75, pz, ACCENT, { shape: 'sphere', size: 0.12, intensity: 2, dist: 3, k: 3 });

  // ---- fuel day tank (front left) on saddles, with a tanker fill point and bollards
  const fx = -2.55, fz = 2.2;
  box(3.1, 0.2, 1.7, M.concrete, fx, 0, fz); ao(fx, fz, 3.1, 1.7, 0.5);
  for (const dx of [-0.9, 0.9]) box(0.35, 0.5, 1.2, gunD, fx + dx, 0.2, fz, { dirt: 0 });
  const tankM = M.paint('#c3c6c8', { rivets: false, metal: 0.55, rough: 0.35, panelW: 4096, panelH: 4096 });
  hcyl(0.68, 2.5, tankM, fx, 1.25, fz, { axis: 'x', seg: 32, dirt: 0.3 });
  for (const e of [-1, 1]) { const c = new THREE.SphereGeometry(0.68, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2); c.rotateZ(-e * Math.PI / 2); c.scale(0.3, 1, 1); mesh(c, tankM, fx + e * 1.25, 1.25, fz, { dirt: 0.2 }); }
  for (const dx of [-0.6, 0.6]) hoop(0.69, 0.04, gun, fx + dx, 1.25, fz).rotation.z = Math.PI / 2;
  box(1.9, 0.08, 0.16, M.plain('#d38a1e', 0.6), fx, 1.25, fz + 0.66, { dirt: 0 });       // fuel-amber band
  const plac = canvasTex(128, (g, n) => { g.fillStyle = '#e8541c'; g.fillRect(0, 0, n, n); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(10, 10, n - 20, n - 20);
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(n / 2, 26); g.bezierCurveTo(n * 0.78, n * 0.45, n * 0.7, n * 0.66, n / 2, n * 0.7); g.bezierCurveTo(n * 0.3, n * 0.66, n * 0.24, n * 0.48, n * 0.4, n * 0.36);
    g.bezierCurveTo(n * 0.42, n * 0.48, n * 0.5, n * 0.5, n / 2, 26); g.fill(); g.fillRect(n * 0.3, n * 0.78, n * 0.4, 6); });
  const pl = box(0.42, 0.42, 0.02, new THREE.MeshStandardMaterial({ map: plac, roughness: 0.6, vertexColors: true }), fx + 0.55, 1.05, fz + 0.69, { dirt: 0, cast: false }); pl.rotation.z = Math.PI / 4;
  cyl(0.18, 0.15, gun, fx - 0.3, 1.9, fz, { seg: 16, dirt: 0 }); cyl(0.07, 0.4, M.steel, fx + 0.6, 1.9, fz - 0.2, { seg: 10, dirt: 0 });
  pipe([[fx + 1.3, 1.0, fz - 0.3], [fx + 1.75, 1.0, fz - 0.3], [fx + 1.75, 0.36, fz - 0.3], [fx + 1.75, 0.36, gz + 1.4]], 0.07, M.dark);
  // fill point cabinet at the front edge, where a tanker parks
  box(0.6, 0.85, 0.45, gun, fx - 0.9, 0.2, fz + 1.3, { dirt: 0.3 });
  box(0.62, 0.1, 0.47, M.hazard, fx - 0.9, 1.05, fz + 1.3, { dirt: 0 });
  hcyl(0.08, 0.3, M.paint('#c43b2a', { rivets: false }), fx - 0.9, 0.65, fz + 1.6, { axis: 'z' });
  lamp(fx - 0.9, 1.2, fz + 1.3, '#ffa632', { size: 0.12, intensity: 2, dist: 2, k: 2.6 });
  mark('fill', fx - 0.9, 0.65, fz + 1.75);
  for (const dx of [-1.6, -0.2]) { cyl(0.11, 0.55, M.paint('#c9a028'), fx + dx, 0.2, fz + 1.45, { seg: 14 }); cyl(0.12, 0.08, M.dark, fx + dx, 0.6, fz + 1.45, { seg: 14, dirt: 0 }); }
  // dark fuel stains on the pad by the fill point
  const oil = new THREE.MeshBasicMaterial({ color: '#0b0806', transparent: true, opacity: 0.45, depthWrite: false });
  const st = new THREE.CircleGeometry(0.6, 20); st.rotateX(-Math.PI / 2); st.scale(1.4, 1, 0.8); const sm = mesh(st, oil, fx - 0.6, 0.006, fz + 1.75, { cast: false }); sm.userData.decal = true;

  // control kiosk (front centre) with a lit window and a load meter
  const kx = 0.2, kz = 2.55;
  box(1.6, 1.35, 1.2, off, kx, 0, kz); ao(kx, kz, 1.6, 1.2, 0.45);
  box(1.72, 0.12, 1.32, gun, kx, 1.35, kz, { dirt: 0 });
  box(0.9, 0.42, 0.04, M.emit('#ffd98a', 1.3), kx - 0.2, 0.7, kz + 0.61, { cast: false });
  box(0.3, 0.75, 0.04, gun, kx + 0.55, 0.0, kz + 0.61, { dirt: 0.3 });
  for (let i = 0; i < 5; i++) box(0.1, 0.06 + i * 0.05, 0.03, i < 4 ? glow : M.dark, kx - 0.55 + i * 0.13, 1.47, kz + 0.45, { cast: false, dirt: 0 });
  cyl(0.03, 0.9, M.steel, kx + 0.6, 1.47, kz - 0.35, { seg: 8, dirt: 0 });
  pointLight(ACCENT, 5, 0.3, 1.0, 0.6, 4);

  if (WORK) {
    const PULSE = [1.0, 1.25, 1.5, 1.25, 1.0, 0.8, 0.65, 0.8];
    bus.forEach((m, i) => { m.material = litMat(L, ACCENT, 2.6, PULSE[(F + i * 2) % 8], 1.5); });
    workLayer(L, new Set([...fans, ...bus]));
  }
}
