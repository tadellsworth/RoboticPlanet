// THE CRAWLER, "Lancer" restyle: the colossal tracked mobile depot in the rocket truck's family. Top-down, facing +x
// (right), orthographic camera straight down, framed 20 world units across the 512 frame (render 1024). Crawler: 18 x 12.
// The off-white hull becomes gunmetal armour with thin dark seams and the robkit lighting; team-colour light strips run
// along every hull edge and the wing panels; the cab is an armoured bridge with a glowing sensor-slit eye across its
// front slope, LED headlight bars on the glacis and the amber beacon on its roof; the massive treads, the container deck,
// the charging bays, legs, arms and mast keep their geometry. Kept from b/crawler.js: every position the overlays and the
// game use (treads, headlamps at x 8.9 z +-2.1, beacon at 6.9, mast pivot at canvas px 180, leg feet, dish layer).
//   ?f=k     driving frame k (0..7): track plates advance k/8 of a plate pitch, sprocket/idler turn to match;
//            f2 and f6 settle the hull one pixel back and lower.
//   ?d=k     deploy frame k (0..9) (d0 = f0, d9 = crawlerbase)
//   ?part=dish   only the sensor dish and its mast head (stowed size), for the spinning layer; pivot = mast axis
// Driving frames and d0-d7 carry no dish/mast head (the game draws crawler-dish on top); d8, d9 include the raised dish.
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, group, gear, ao, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search);
  const f = +(p.get('f') || 0), d = p.has('d') ? +p.get('d') : -1, part = p.get('part') || 'crawler';
  const gun = M.paint('#4f565e'), gunD = M.paint('#3a4046'), off = M.paint('#454c53'), roofM = M.paint('#5e666f', { rivets: false });
  const deckP = M.paint('#5a6066', { panelW: 128, panelH: 512 }), grille = M.grille('#3d4247');
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.55).getHexString(), { rivets: false });
  const runL = M.emit(TEAM, 1.1), padGlow = M.emit(TEAM, 2.2), glassD = M.plain('#0e1114', 0.15, 0.6);
  const seam = M.plain('#101214', 0.8), lamp = M.emit('#fff1d0', 2.2), dark = M.plain('#1a1c1f', 0.7, 0.3);
  const eyeM = (() => { const m = M.emit(TEAM, 1.3).clone(); m.color = new THREE.Color(TEAM).multiplyScalar(0.12); m.roughness = 0.7; m.envMapIntensity = 0.1; m.userData.glow = '#' + new THREE.Color(TEAM).multiplyScalar(0.32).getHexString(); return m; })();
  const plateM = M.plain('#3b3d40', 0.75, 0.45), grouserM = M.steel;
  L.seed(2203);

  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);
  // straight-down sun lights every top face fully: tone it down as robkit does for the Lancer line
  L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });

  // deploy state
  const D = d < 0 ? 0 : d;
  const legT = D <= 0 ? 0 : D >= 3 ? 1 : D / 3, legDown = D >= 3;
  const lifted = D >= 4, wingA = D <= 4 ? 1 : D === 5 ? 0.5 : 0;          // 1 = stowed (flipped over), 0 = deployed
  const armOut = D >= 7, mastUp = D >= 8, beacon = D >= 9;
  const settle = d < 0 && (f === 2 || f === 6);

  const veh = group(0, 0, 0);                                                // everything that lifts/settles
  if (settle) { veh.position.x = -W / 512; veh.position.y = -0.08; }
  if (lifted) veh.scale.set(1.01, 1.01, 1.01);
  const P = veh;                                                             // parent shortcut
  const o = (extra = {}) => ({ parent: P, ...extra });

  // ================= treads =================
  const AX = 7.6, R = 1.35, YC = 1.35, NPL = 48;
  const LT = 4 * AX + 2 * Math.PI * R, PITCH = LT / NPL, TEETH = 10;
  function pathAt(s) {
    s = ((s % LT) + LT) % LT;
    if (s < 2 * AX) return [-AX + s, YC + R, 0];
    s -= 2 * AX;
    if (s < Math.PI * R) { const ph = Math.PI / 2 - s / R; return [AX + R * Math.cos(ph), YC + R * Math.sin(ph), ph - Math.PI / 2]; }
    s -= Math.PI * R;
    if (s < 2 * AX) return [AX - s, YC - R, Math.PI];
    s -= 2 * AX;
    const ph = -Math.PI / 2 - s / R; return [-AX + R * Math.cos(ph), YC + R * Math.sin(ph), ph - Math.PI / 2];
  }
  const shift = (d < 0 ? f : 0) * PITCH / 8;
  for (const s of [-1, 1]) {
    const zc = s * 4.7, TWD = 2.6;
    // track frame and roller beam between the runs
    box(2 * AX, 1.6, TWD - 0.5, gunD, 0, YC - 0.8, zc, o({ dirt: 0.6 }));
    for (let k = 0; k < NPL; k++) {
      const [x, y, rot] = pathAt(k * PITCH + shift);
      const g = group(x, y, zc, 0, P); g.rotation.z = rot;
      box(PITCH * 0.9, 0.2, TWD, plateM, 0, -0.1, 0, { parent: g, dirt: 0.5, dirtH: 0.2 });
      box(0.17, 0.17, TWD - 0.12, grouserM, PITCH * 0.28, 0.08, 0, { parent: g, dirt: 0.7, dirtH: 0.2 });
      box(PITCH * 0.5, 0.06, 0.16, gunD, -PITCH * 0.15, 0.1, TWD / 2 - 0.12, { parent: g, dirt: 0 });
      box(PITCH * 0.5, 0.06, 0.16, gunD, -PITCH * 0.15, 0.1, -TWD / 2 + 0.12, { parent: g, dirt: 0 });
    }
    // drive sprocket (front) and idler (rear), turning with the track; hub caps outboard
    const turn = -(d < 0 ? f : 0) * (2 * Math.PI / TEETH) / 8;
    for (const [ax, toothed] of [[AX, true], [-AX, false]]) {
      const wg = group(ax, YC, zc, 0, P); wg.rotation.z = turn;
      if (toothed) { gear(R - 0.05, R - 0.32, TEETH, TWD - 0.6, gun, 0, 0, 0, { parent: wg }); }
      else {
        const ig = new THREE.CylinderGeometry(R - 0.22, R - 0.22, TWD - 0.6, 40); ig.rotateX(Math.PI / 2); mesh(ig, gun, 0, 0, 0, { parent: wg, dirt: 0 });
        for (let k = 0; k < TEETH; k++) { const a = k * 2 * Math.PI / TEETH; const hg = new THREE.CylinderGeometry(0.16, 0.16, TWD - 0.5, 14); hg.rotateX(Math.PI / 2); mesh(hg, gunD, Math.cos(a) * 0.75, Math.sin(a) * 0.75, 0, { parent: wg, dirt: 0 }); }
      }
      const hub = new THREE.CylinderGeometry(0.55, 0.62, 0.35, 28); hub.rotateX(Math.PI / 2);
      mesh(hub, gunD, 0, 0, s * (TWD / 2 + 0.12), { parent: wg, dirt: 0 });
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; const bg = new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8); bg.rotateX(Math.PI / 2); mesh(bg, M.steel, Math.cos(a) * 0.4, Math.sin(a) * 0.4, s * (TWD / 2 + 0.32), { parent: wg, dirt: 0 }); }
    }
  }

  // ================= hull =================
  const HX0 = -8.0, HX1 = 8.45, HZ = 3.35;
  box(HX1 - HX0, 1.7, HZ * 2 - 0.2, gunD, (HX0 + HX1) / 2, 0.8, 0, o({ dirt: 0.6 }));          // lower hull
  // chamfered section helper (profile in z,y extruded along x)
  function chamferBlock(x0, x1, y0, y1, hz, ch, mat) {
    const sh = new THREE.Shape(); sh.moveTo(-hz, y0); sh.lineTo(-hz, y1 - ch); sh.lineTo(-hz + ch, y1); sh.lineTo(hz - ch, y1); sh.lineTo(hz, y1 - ch); sh.lineTo(hz, y0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(x0, 0, 0);
    return mesh(g, mat, 0, 0, 0, o({ dirt: 0.45, dirtH: 1.5 }));
  }
  // rear engine block
  chamferBlock(HX0, -4.0, 2.4, 4.1, HZ, 0.45, off);
  for (const x of [-7.0, -5.3]) { box(1.3, 0.1, 3.4, gunD, x, 4.1, 0, o({ dirt: 0 })); box(1.15, 0.04, 3.2, grille, x, 4.2, 0, o({ dirt: 0 })); }
  for (const s of [-1, 1]) { cyl(0.22, 0.6, gun, -4.6, 4.1, s * 2.2, o({ seg: 18, dirt: 0 })); cyl(0.15, 0.02, M.dark, -4.6, 4.71, s * 2.2, o({ seg: 16, dirt: 0 })); }
  box(0.3, 0.6, 5.6, gunD, HX0 + 0.1, 2.4, 0, o({ dirt: 0 }));
  for (const s of [-1, 1]) {
    box(0.9, 0.05, 0.9, M.hazard, HX0 + 0.5, 4.11, s * (HZ - 0.5), o({ dirt: 0 }));
    box(0.14, 0.1, 0.5, M.emit(TEAM, 1.2), HX0 - 0.02, 3.6, s * 2.6, o({ dirt: 0, cast: false }));    // team rear lights
    box(0.12, 0.08, 0.3, M.emit('#ff2a1e', 1.2), HX0 + 0.02, 3.6, s * 1.9, o({ dirt: 0, cast: false }));
  }
  for (const x of [-6.15, -4.4]) box(0.05, 0.012, HZ * 2 - 1.1, seam, x, 4.1, 0, o({ dirt: 0, cast: false }));
  // front block under the cab, with a sloped glacis, headlights and hazard corners
  chamferBlock(4.3, HX1, 2.4, 3.6, HZ, 0.35, off);
  {
    const g = new THREE.BufferGeometry();
    const v = [HX1, 3.6 - 0.35, -HZ + 0.35, HX1, 3.6 - 0.35, HZ - 0.35, HX1 + 0.45, 2.5, HZ - 0.2, HX1 + 0.45, 2.5, -HZ + 0.2];
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
    mesh(g, gun, 0, 0, 0, o({ dirt: 0 }));
    for (const s of [-1, 1]) {
      box(0.3, 0.2, 1.1, gunD, HX1 + 0.25, 2.55, s * 2.1, o({ dirt: 0 }));
      box(0.12, 0.12, 0.95, lamp, HX1 + 0.42, 2.6, s * 2.1, o({ dirt: 0, cast: false }));                // LED headlight bars
      box(0.6, 0.05, 0.6, M.hazard, HX1 - 0.4, 3.61, s * (HZ - 0.45), o({ dirt: 0 }));
    }
  }
  // middle: central spine (containers + hatch), side recesses with racks under the wings
  const MX0 = -4.0, MX1 = 4.3;
  box(MX1 - MX0, 1.0, 1.8, deckP, (MX0 + MX1) / 2, 2.4, 0, o({ dirt: 0.3 }));
  box(MX1 - MX0, 0.05, 1.7, deckP, (MX0 + MX1) / 2, 3.4, 0, o({ dirt: 0 }));
  for (const s of [-1, 1]) {
    box(MX1 - MX0, 0.1, 2.4, gunD, (MX0 + MX1) / 2, 2.4, s * 2.1, o({ dirt: 0 }));                // rack floor
    box(MX1 - MX0, 1.05, 0.1, gun, (MX0 + MX1) / 2, 2.4, s * (HZ - 0.05), o({ dirt: 0 }));        // outer wall
    // storage racks with containers
    for (const rx of [-2.85, -1.15, 0.55, 2.25]) for (const rz of [1.5, 2.65]) {
      const cols = ['#8a4a2c', '#c9c5ba', '#5f7a7c', '#7d7a4a', '#9a6a3a'];
      const c = cols[Math.floor(L.rnd() * cols.length)];
      box(1.45, 0.75, 0.95, M.ribbed(c, { period: 10 }), rx, 2.5, s * rz, o({ dirt: 0.3 }));
    }
    for (const rx of [-3.75, -2.0, -0.3, 1.4, 3.1, 4.15]) for (const rz of [0.95, 2.08, 3.2]) box(0.1, 0.85, 0.1, gunD, rx, 2.5, s * rz, o({ dirt: 0 }));
    for (const rz of [0.95, 2.08, 3.2]) box(MX1 - MX0 - 0.2, 0.06, 0.07, gun, (MX0 + MX1) / 2, 3.3, s * rz, o({ dirt: 0 }));
    // running lights along the hull edges (rear and front sections)
    box(3.7, 0.03, 0.12, runL, -6.0, 4.11, s * (HZ - 0.22), o({ dirt: 0, cast: false }));
    box(3.9, 0.03, 0.12, runL, 6.35, 3.61, s * (HZ - 0.16), o({ dirt: 0, cast: false }));
  }
  // containers stacked on the spine, cargo hatch
  const ccols = [['#8a4a2c', -1.0, 3.45, 0], ['#5f7a7c', 1.25, 3.45, 0], ['#c9c5ba', 0.1, 4.6, 0]];
  for (const [c, x, y] of ccols) {
    box(2.1, 1.12, 1.45, M.ribbed(c, { period: 12 }), x, y, 0, o({ dirt: 0.25, dirtH: 0.8 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.14, 0.14, 0.14, gunD, x + sx * 0.99, y + 1.0, sz * 0.66, o({ dirt: 0 }));
  }
  box(1.3, 0.1, 1.3, gunD, 3.35, 3.42, 0, o({ dirt: 0 })); box(1.1, 0.04, 1.1, M.plain('#4b5157', 0.7), 3.35, 3.52, 0, o({ dirt: 0 }));
  box(1.36, 0.03, 0.12, M.hazard, 3.35, 3.53, 0.6, o({ dirt: 0 })); box(1.36, 0.03, 0.12, M.hazard, 3.35, 3.53, -0.6, o({ dirt: 0 }));
  box(1.1, 0.1, 1.2, gunD, -3.25 + 0.0, 3.42, 0, o({ dirt: 0 }));                                    // mast turret plinth

  // ================= cab =================
  const CX0 = 4.6, CX1 = 8.35, CZ = 3.1, CY0 = 3.6, CYW = 4.35, CYT = 5.05, IN = 0.38;
  box(CX1 - CX0, CYW - CY0, CZ * 2, off, (CX0 + CX1) / 2, CY0, 0, o({ dirt: 0.4, dirtH: 0.8 }));
  {
    const x0 = CX0, x1 = CX1, z0 = -CZ, z1 = CZ, a = IN, y0 = CYW, y1 = CYT;
    const B = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], T = [[x0 + a, y1, z0 + a], [x1 - a, y1, z0 + a], [x1 - a, y1, z1 - a], [x0 + a, y1, z1 - a]];
    const pos = [];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; pos.push(...B[i], ...B[j], ...T[j], ...B[i], ...T[j], ...T[i]); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = mesh(g, glassD, 0, 0, 0, o({ dirt: 0 })); m.material.side = THREE.DoubleSide;
    // window mullions on the slopes
    for (const x of [5.4, 6.4, 7.4]) for (const s of [-1, 1]) beam([x, y0, s * z1], [x, y1, s * (z1 - a)], 0.08, 0.05, gun, o());
    for (const zz of [-2.35, 2.35]) beam([x1, y0, zz], [x1 - a, y1, zz * (z1 - a) / z1], 0.08, 0.05, gun, o());
    // the sensor-slit eye: a glowing visor across the front slope, its ends turned back like the Lancer bracket
    beam([x1 + 0.01, y0 + 0.12, 0], [x1 - a + 0.05, y1 - 0.1, 0], 3.6, 0.03, eyeM, o({ cast: false }));
    for (const s of [-1, 1]) beam([x1 - 0.02, y0 + 0.12, s * 1.8], [x1 - a + 0.06, y1 - 0.1, s * 1.62], 0.5, 0.03, eyeM, o({ cast: false, ry: 0 }));
  }
  box(CX1 - CX0 - IN * 2, 0.25, CZ * 2 - IN * 2, off, (CX0 + CX1) / 2, CYT, 0, o({ dirt: 0 }));
  // cab roof: a lighter armour plate with seams, running lights round the edge, amber beacon, antenna, AC unit
  const RX = (CX0 + CX1) / 2, RY = CYT + 0.25;
  box(2.4, 0.03, 3.6, roofM, RX - 0.1, RY, 0, o({ dirt: 0 }));
  for (const x of [5.6, 7.75]) box(0.05, 0.012, CZ * 2 - IN * 2 - 0.3, seam, x, RY + 0.03, 0, o({ dirt: 0, cast: false }));
  for (const s of [-1, 1]) box(CX1 - CX0 - 1.0, 0.03, 0.1, runL, RX, RY + 0.02, s * (CZ - IN - 0.16), o({ dirt: 0, cast: false }));
  cyl(0.28, 0.12, gunD, 6.9, RY, 0, o({ seg: 24, dirt: 0 }));
  sphere(0.24, M.emit('#ffa632', 1.0), 6.9, RY + 0.12, 0, o({ dirt: 0, dome: true }));
  box(0.9, 0.3, 0.8, gun, 5.35, RY, -1.2, o({ dirt: 0 })); box(0.8, 0.04, 0.7, grille, 5.35, RY + 0.3, -1.2, o({ dirt: 0 }));
  cyl(0.04, 0.9, gunD, 5.2, RY, 1.5, o({ seg: 8, dirt: 0 })); sphere(0.07, M.emit('#ff2a1e', 1.2), 5.2, RY + 0.9, 1.5, o({ dirt: 0 }));
  box(0.7, 0.06, 0.7, gun, 5.4, RY, 0.6, o({ dirt: 0 }));

  // ================= wings (side cargo panels) with two charging bays each =================
  const WX0 = -3.95, WX1 = 4.25, WW = 2.42, WT = 0.18, HY = 3.55;
  for (const s of [-1, 1]) {
    const wg = group((WX0 + WX1) / 2, HY, s * HZ, 0, P);
    wg.rotation.x = -s * Math.PI * wingA;
    const L2 = WX1 - WX0;
    box(L2, WT, WW, deckP, 0, 0, s * WW / 2, { parent: wg, dirt: 0.2 });                              // panel
    box(L2, 0.04, WW, off, 0, -0.04, s * WW / 2, { parent: wg, dirt: 0.4 });                          // outer armour (up when stowed)
    for (const x of [-L2 / 2 + 0.35, L2 / 2 - 0.35]) box(0.6, 0.03, 0.6, M.hazard, x, -0.06, s * (WW - 0.35), { parent: wg, dirt: 0 });
    for (let x = -L2 / 2 + 1.0; x < L2 / 2; x += 1.6) box(0.05, 0.03, WW - 0.2, gunD, x, -0.06, s * WW / 2, { parent: wg, dirt: 0 });
    box(L2 - 0.4, 0.02, 0.1, runL, 0, -0.065, s * (WW - 0.14), { parent: wg, dirt: 0, cast: false });
    // inner face (up when deployed): charging bays
    for (const bx of [-2.0, 2.0]) {
      box(2.3, 0.04, 1.9, M.plain('#26292c', 0.85), bx, WT, s * 1.25, { parent: wg, dirt: 0 });
      const ring = new THREE.TorusGeometry(0.62, 0.06, 10, 48); ring.rotateX(Math.PI / 2);
      mesh(ring, padGlow, bx, WT + 0.06, s * 1.25, { parent: wg, dirt: 0, cast: false });
      const ring2 = new THREE.TorusGeometry(0.36, 0.03, 8, 40); ring2.rotateX(Math.PI / 2);
      mesh(ring2, M.emit(TEAM, 1.2), bx, WT + 0.06, s * 1.25, { parent: wg, dirt: 0, cast: false });
      box(2.3, 0.03, 0.12, M.hazard, bx, WT + 0.02, s * (1.25 + 0.95), { parent: wg, dirt: 0 });
      box(0.4, 0.5, 0.3, off, bx + 0.95, WT, s * 0.35, { parent: wg, dirt: 0 });                       // charge post
      box(0.26, 0.2, 0.04, M.emit(TEAM, 1.4), bx + 0.95, WT + 0.25, s * 0.52, { parent: wg, dirt: 0, cast: false });
    }
    // hinges
    for (const x of [-3.0, 0, 3.0]) hcyl(0.12, 0.5, gun, x, 0, 0, { parent: wg, axis: 'x' });
  }

  // ================= charging arms (folded along the sides, swing out over the bays on d7) =================
  for (const s of [-1, 1]) {
    const ag = group(4.2, 3.95, s * 2.55, 0, P);
    ag.rotation.y = armOut ? s * 0.42 : 0;
    cyl(0.42, 0.3, gunD, 0, -0.35, 0, { parent: ag, seg: 24, dirt: 0 });
    box(5.8, 0.32, 0.34, off, -2.9, 0, 0, { parent: ag, dirt: 0.3 });
    box(5.6, 0.04, 0.1, M.hazard, -2.9, 0.32, 0, { parent: ag, dirt: 0 });
    hcyl(0.1, 4.6, M.chrome, -2.6, 0.12, s * 0.24, { parent: ag, axis: 'x' });                         // hydraulic ram
    for (const x of [-1.6, -4.0]) box(0.25, 0.42, 0.5, gunD, x, -0.12, 0, { parent: ag, dirt: 0 });    // clamps
    box(0.6, 0.35, 0.6, gun, -5.85, -0.15, 0, { parent: ag, dirt: 0 });                                // charging head
    box(0.36, 0.06, 0.36, M.emit(TEAM, armOut ? 2.0 : 0.6), -5.85, 0.21, 0, { parent: ag, dirt: 0, cast: false });
    if (armOut) { cyl(0.05, 0.7, M.dark, -5.85, -0.85, 0, { parent: ag, seg: 8, dirt: 0 }); }
  }

  // ================= outrigger legs =================
  const legs = [[7.6, 1, 60, 180], [7.6, -1, -60, -180], [-7.6, 1, 120, 0], [-7.6, -1, -120, 0]];
  for (const [lx, s, dep, stow] of legs) {
    const th = (stow + (dep - stow) * legT) * Math.PI / 180, LL = 3.45;
    box(0.9, 0.5, 0.7, gunD, lx, 3.0, s * (HZ + 0.15), o({ dirt: 0 }));                                // housing
    box(0.9, 0.03, 0.7, M.hazard, lx, 3.51, s * (HZ + 0.15), o({ dirt: 0 }));
    const PY = 3.4, lg = group(lx, PY, s * (HZ + 0.15), 0, P); lg.rotation.y = -th;
    box(LL, 0.36, 0.42, off, LL / 2, -0.18, 0, { parent: lg, dirt: 0.4 });
    box(LL - 0.4, 0.04, 0.12, M.hazard, LL / 2, 0.18, 0, { parent: lg, dirt: 0 });
    hcyl(0.1, LL - 0.6, M.chrome, LL / 2, 0.05, 0.27, { parent: lg, axis: 'x' });
    cyl(0.32, 0.7, gun, LL, -0.6, 0, { parent: lg, seg: 20, dirt: 0 });                                  // jack cylinder
    if (legDown) {
      cyl(0.18, PY - 0.8, M.chrome, LL, -(PY - 0.2), 0, { parent: lg, seg: 16, dirt: 0 });
      cyl(0.62, 0.22, gunD, LL, -PY, 0, { parent: lg, seg: 32, dirt: 0 });
      L.hoop(0.6, 0.04, M.paint('#c9a22a', { rivets: false }), LL, -PY + 0.23, 0, { parent: lg });
    } else {
      cyl(0.5, 0.18, gunD, LL, -0.8, 0, { parent: lg, seg: 28, dirt: 0 });
    }
  }
  if (D >= 3) {
    for (const [lx, s, dep] of legs) {
      const th = dep * Math.PI / 180, fx = lx + 3.45 * Math.cos(th), fz = s * (HZ + 0.15) + 3.45 * Math.sin(th);
      ao(fx, fz, 1.0, 1.0, D >= 4 ? 0.6 : 0.35, 0.004);
    }
  }

  // ================= sensor mast and dish =================
  const MXP = (180 / 512 - 0.5) * W;                                          // pivot x = -2.96875 (canvas px 180)
  const mastH = mastUp ? 3.4 : 0.0;
  cyl(0.48, 0.35, gun, MXP, 3.52, 0, o({ seg: 28, dirt: 0 }));
  cyl(0.3, 0.75 + mastH * 0.35, off, MXP, 3.85, 0, o({ seg: 24, dirt: 0 }));
  if (mastUp) { cyl(0.22, mastH * 0.4 + 0.3, M.steel, MXP, 4.6 + mastH * 0.35 - 0.3, 0, o({ seg: 20, dirt: 0 })); cyl(0.15, mastH * 0.35 + 0.3, M.chrome, MXP, 4.6 + mastH * 0.75 - 0.3, 0, o({ seg: 16, dirt: 0 })); }
  const headY = 4.6 + mastH;
  const showDish = part === 'dish' || mastUp;
  if (showDish) {
    const hg = group(MXP, headY, 0, 0, part === 'dish' ? undefined : P);
    if (mastUp) hg.scale.set(1.08, 1.08, 1.08);
    box(0.7, 0.45, 0.6, gunD, 0, 0, 0, { parent: hg, dirt: 0 });                                        // mast head
    hcyl(0.16, 0.9, gun, 0, 0.3, 0, { parent: hg, axis: 'z' });                                         // elevation axle
    const R0 = mastUp ? 1.45 : 1.05, depth = mastUp ? 0.38 : 0.5;
    const pts = []; for (let i = 0; i <= 16; i++) { const r = R0 * i / 16; pts.push(new THREE.Vector2(r, depth * (r / R0) ** 2)); }
    const dg = new THREE.LatheGeometry(pts, 48);
    const dish = group(0.35, 0.55, 0, 0, hg); dish.rotation.z = -(mastUp ? 0.95 : 1.1);              // tilted, facing +x and up
    const dm = mesh(dg, M.paint('#d8d4ca', { rivets: false }), 0, 0, 0, { parent: dish, dirt: 0 }); dm.material.side = THREE.DoubleSide;
    L.hoop(R0, 0.05, gun, 0, depth, 0, { parent: dish });
    for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; beam([Math.cos(a) * R0 * 0.9, depth, Math.sin(a) * R0 * 0.9], [0, 0.95, 0], 0.04, 0.04, gunD, { parent: dish }); }
    cyl(0.1, 0.18, gunD, 0, 0.9, 0, { parent: dish, seg: 12, dirt: 0 });
    if (beacon) sphere(0.2, M.emit(TEAM, 2.5), 0, 0.45, -0.1, { parent: hg, dirt: 0 });
  } else if (part !== 'dish') {
    cyl(0.32, 0.35, gunD, MXP, headY - 0.1, 0, o({ seg: 20, dirt: 0 }));                                  // collar (the head sits on top in the dish layer)
  }

  if (part === 'dish') {
    // keep only the mast head + dish group (added to root, not to the vehicle)
    veh.visible = false;
  }
}
