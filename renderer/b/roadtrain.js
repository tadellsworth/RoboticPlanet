// Road Train, top-down, facing +x (right), orthographic camera straight down, no ground and no shadow.
// Same camera, sun, materials and tyre code as b/truck.js; 10 world units across the frame (256 px final).
//   ?part=tractor (default) | trailer | brake (only the tractor's two rear brake lenses, lit)
//   ?f=k   tractor driving frame k (0..3): every tyre rolled forward by k/4 of one tread-block pitch
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, beam, hcyl, mesh, group, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), part = p.get('part') || 'tractor';
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), deck = M.paint('#5a6066', { panelW: 128, panelH: 512 });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.55).getHexString(), { rivets: false }), rubber = M.plain('#141516', 0.95), lug = M.plain('#4a4c50', 0.8);
  const grease = M.plain('#1b1c1d', 0.35, 0.4), glassD = M.plain('#0e1114', 0.15, 0.6);
  L.seed(733);

  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const HW = 1.93;
  const TR = 0.62, TW = 0.62, NL = 18, pitch = Math.PI * 2 / NL;
  function tyre(ax, z, roll) {
    const w = group(ax, TR, z); w.rotation.z = -roll;
    const tg = new THREE.CylinderGeometry(TR - 0.07, TR - 0.07, TW, 36, 1); tg.rotateX(Math.PI / 2);
    mesh(tg, rubber, 0, 0, 0, { parent: w, dirt: 0 });
    for (let k = 0; k < NL; k++) for (const half of [-1, 1]) {
      const a = k * pitch + (half > 0 ? pitch / 2 : 0);
      const b = new THREE.BoxGeometry(0.17, 0.11, TW * 0.46); b.translate(0, TR - 0.06, half * TW * 0.26);
      const m = mesh(b, lug, 0, 0, 0, { parent: w, dirt: 0 }); m.rotation.z = a;
    }
    const sw = new THREE.CylinderGeometry(TR - 0.02, TR - 0.02, 0.06, 36, 1); sw.rotateX(Math.PI / 2);
    for (const e of [-1, 1]) mesh(sw, rubber, 0, 0, e * (TW / 2 - 0.03), { parent: w, dirt: 0 });
    return w;
  }
  function tailLights(xr, lens) {
    box(0.28, 0.4, 3.3, gunD, xr + 0.14, 0.75, 0, { dirt: 0 });
    box(0.26, 0.02, 2.2, M.hazard, xr + 0.15, 1.15, 0, { dirt: 0 });
    for (const s of [-1, 1]) {
      box(0.26, 0.12, 0.32, gunD, xr + 0.15, 1.15, s * 1.28, { dirt: 0 });
      lens.push(box(0.2, 0.04, 0.24, M.plain('#5a1414', 0.35), xr + 0.15, 1.27, s * 1.28, { dirt: 0, cast: false }));
      box(0.26, 0.12, 0.18, gunD, xr + 0.15, 1.15, s * 1.62, { dirt: 0 });
      box(0.18, 0.04, 0.12, M.emit('#ffa632', 1.2), xr + 0.15, 1.27, s * 1.62, { dirt: 0, cast: false });
    }
  }
  const brakeLens = [];

  if (part === 'trailer') {
    // ---- flatbed trailer: 6 units bumper to coupler, two rear axles, kingpin plate at the right
    const XR = -3.0, DX0 = -2.95, DX1 = 2.2, DY = 1.3, DW = 1.52;
    for (const ax of [-1.05, -2.3]) for (const s of [-1, 1]) tyre(ax, s * (HW - TW / 2), 0);
    box(5.3, 0.35, 1.6, gunD, -0.3, 0.55, 0, { dirt: 0 });
    box(DX1 - DX0, 0.14, DW * 2, deck, (DX0 + DX1) / 2, DY - 0.14, 0, { dirt: 0 });
    for (let x = DX0 + 0.54; x < DX1; x += 0.54) box(0.04, 0.012, DW * 2 - 0.3, M.dark, x, DY, 0, { dirt: 0, cast: false });
    for (const s of [-1, 1]) {
      box(DX1 - DX0, 0.22, 0.1, gun, (DX0 + DX1) / 2, DY, s * (DW - 0.05), { dirt: 0 });
      box(DX1 - DX0 - 0.1, 0.03, 0.1, team, (DX0 + DX1) / 2, DY + 0.22, s * (DW - 0.05), { dirt: 0 });
      box(DX1 - DX0 - 0.3, 0.012, 0.035, M.emit(TEAM, 0.7), (DX0 + DX1) / 2, DY + 0.25, s * (DW - 0.05), { dirt: 0, cast: false });
      for (let x = DX0 + 0.22; x <= DX1 - 0.1; x += 1.07) box(0.12, 0.3, 0.14, gunD, x, DY, s * (DW - 0.05), { dirt: 0 });
      for (let x = DX0 + 0.75; x < DX1 - 0.3; x += 1.07) {
        const r = new THREE.TorusGeometry(0.09, 0.025, 8, 16); r.rotateX(Math.PI / 2);
        mesh(r, M.paint('#d0a536', { rivets: false }), x, DY + 0.03, s * (DW - 0.28), { dirt: 0 });
        box(0.16, 0.03, 0.08, M.steel, x, DY, s * (DW - 0.16), { dirt: 0 });
      }
    }
    // front bulkhead
    box(0.14, 0.7, DW * 2, gun, DX1 + 0.05, DY, 0, { dirt: 0 });
    for (let z = -1.35; z <= 1.36; z += 0.45) box(0.16, 0.05, 0.05, M.steel, DX1 + 0.05, DY + 0.7, z, { dirt: 0 });
    box(0.16, 0.03, DW * 2 - 0.2, M.hazard, DX1 + 0.05, DY + 0.7, 0, { dirt: 0 });
    // gooseneck / upper coupler plate stepping down, kingpin underneath
    box(0.36, 0.16, 2.3, gunD, DX1 + 0.3, 1.0, 0, { dirt: 0 });
    const cp = new THREE.Shape(); cp.moveTo(0, -0.95); cp.lineTo(0.28, -0.95); cp.lineTo(0.45, -0.55); cp.lineTo(0.45, 0.55); cp.lineTo(0.28, 0.95); cp.lineTo(0, 0.95); cp.closePath();
    const cg = new THREE.ExtrudeGeometry(cp, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    cg.rotateX(Math.PI / 2); mesh(cg, gun, DX1 + 0.3, 1.08, 0, { dirt: 0 });
    box(0.06, 0.02, 1.1, M.hazard, DX1 + 0.72, 1.1, 0, { dirt: 0, cast: false });
    cyl(0.12, 0.05, M.steel, DX1 + 0.55, 1.1, 0, { seg: 20, dirt: 0 });
    for (const s of [-1, 1]) {                                         // landing-leg cranks and air/electric couplers
      box(0.2, 0.12, 0.2, gunD, 1.7, 1.0, s * 1.62, { dirt: 0 });
      cyl(0.07, 0.06, M.paint('#b8352a', { rivets: false }), DX1 + 0.22, 1.3, s * 0.35, { seg: 14, dirt: 0 });
    }
    cyl(0.07, 0.06, M.paint('#2f5aa8', { rivets: false }), DX1 + 0.22, 1.3, 0, { seg: 14, dirt: 0 });
    tailLights(XR, brakeLens);
    return;
  }

  // ---- tractor: heavy cab-over prime mover, 8.8 units long, three axles (steer + tandem drive)
  const XF = 4.4, XR = -4.4;
  const roll = f * pitch / 4;
  tyre(3.0, -(HW - TW / 2), roll); tyre(3.0, HW - TW / 2, roll);
  for (const ax of [-1.85, -3.3]) for (const s of [-1, 1]) { tyre(ax, s * (HW - TW / 2), roll); tyre(ax, s * (HW - TW * 1.5 - 0.04), roll); }
  // frame rails, cross members
  for (const s of [-1, 1]) box(8.1, 0.32, 0.22, gunD, -0.2, 0.62, s * 0.55, { dirt: 0 });
  for (const x of [-3.9, -2.55, -0.9, 0.6]) box(0.18, 0.2, 1.3, gunD, x, 0.7, 0, { dirt: 0 });
  // diff housings / axle beams on the drive axles (visible between the duals)
  for (const ax of [-1.85, -3.3]) { box(0.3, 0.3, 1.1, gun, ax, 0.48, 0, { dirt: 0 }); hcyl(0.16, 1.2, gun, ax, 0.62, 0, { axis: 'z' }); }
  // fifth-wheel coupling plate between the drive axles: round plate with a V slot opening to the rear
  {
    const R = 1.05, sh = new THREE.Shape();
    const a0 = Math.PI - 0.42, a1 = -Math.PI + 0.42;
    sh.absarc(0, 0, R, a1 + 2 * Math.PI, a0, true);
    sh.lineTo(0.05, 0.07); sh.lineTo(0.05, -0.07); sh.closePath();
    const pts = sh.getPoints(64);
    const shape = new THREE.Shape(pts);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 48 });
    g.rotateX(-Math.PI / 2);
    mesh(g, gun, -2.55, 1.12, 0, { dirt: 0 });
    const top = new THREE.ShapeGeometry(shape, 48); top.rotateX(-Math.PI / 2);
    mesh(top, grease, -2.55, 1.30, 0, { dirt: 0, cast: false });
    box(0.12, 0.05, 0.6, M.hazard, -2.55 - 0.55, 1.29, 0.0, { dirt: 0, cast: false, ry: 0 });
    // mounting brackets and the release handle
    for (const s of [-1, 1]) box(1.3, 0.3, 0.2, gunD, -2.55, 0.85, s * 0.7, { dirt: 0 });
    beam([-2.4, 1.25, 1.0], [-2.3, 1.25, 1.45], 0.05, 0.05, M.paint('#d0a536', { rivets: false }));
    // ramp skid plates behind it
    for (const s of [-1, 1]) beam([-3.4, 1.1, s * 0.7], [-4.1, 0.85, s * 0.7], 0.32, 0.06, gun);
  }
  // quarter fenders between the drive axles, mud flaps behind the last axle
  for (const s of [-1, 1]) {
    box(0.55, 0.05, 1.42, gun, -2.57, 1.38, s * 1.22, { dirt: 0 });
    box(0.06, 0.55, 1.35, M.plain('#1a1b1c', 0.9), -4.05, 0.55, s * 1.25, { dirt: 0 });
  }
  tailLights(XR, brakeLens);
  // deck plate behind the cab with toolbox, air tanks and the suzi coils
  box(1.9, 0.08, 1.9, M.ribbed ? M.ribbed('#5a6066') : deck, -0.15, 1.18, 0, { dirt: 0 });
  box(0.7, 0.42, 0.9, gun, -0.55, 1.26, 0.35, { dirt: 0 });
  box(0.66, 0.03, 0.86, gunD, -0.55, 1.68, 0.35, { dirt: 0 });
  for (const z of [-0.35, 0.35]) hcyl(0.17, 1.0, M.steel, 0.35, 1.0, z, { axis: 'x' });
  for (const [col, dz, r] of [['#b8352a', -0.45, 0.28], ['#2f5aa8', -0.05, 0.24]]) {
    const pts = [];
    for (let k = 0; k <= 120; k++) { const t = k / 120, a = t * Math.PI * 2 * 3.2; pts.push(new THREE.Vector3(0.65 - t * 2.0 + Math.cos(a) * r * 0.5, 1.75 - t * 0.35, dz + Math.sin(a) * r)); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.035, 8, false);
    mesh(tg, M.plain(col, 0.45, 0.05), 0, 0, 0, { dirt: 0 });
  }
  // fuel tanks along both sides behind the cab
  for (const s of [-1, 1]) {
    hcyl(0.42, 2.0, M.chrome, 0.2, 0.92, s * 1.5, { axis: 'x' });
    for (const x of [-0.6, 1.0]) hcyl(0.44, 0.08, gunD, x, 0.92, s * 1.5, { axis: 'x' });
    cyl(0.1, 0.06, gunD, 0.6, 1.33, s * 1.5, { seg: 16, dirt: 0 });
    box(2.1, 0.06, 0.25, M.grating || gunD, 0.2, 1.36, s * 1.83, { dirt: 0 });          // step on top of the tanks
  }
  // twin exhaust stacks behind the cab, with perforated heat shields and rain caps
  for (const s of [-1, 1]) {
    const x = 1.25, z = s * 1.22;
    cyl(0.14, 3.0, M.chrome, x, 0.6, z, { seg: 24, dirt: 0 });
    cyl(0.18, 1.4, M.grille('#9aa1a7'), x, 1.6, z, { seg: 24, dirt: 0 });
    cyl(0.12, 0.02, M.dark, x, 3.6, z, { seg: 20, dirt: 0 });
    const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.03, 20); cap.translate(0, 0.015, 0);
    const cm = mesh(cap, M.chrome, x + 0.08, 3.64, z, { dirt: 0 }); cm.rotation.z = -0.5;
    for (const y of [1.0, 2.9]) L.hoop(0.15, 0.03, gunD, x, y, z);
    L.mark('ex' + (s < 0 ? 0 : 1), x, 3.66, z);
  }
  // air cleaner canister
  cyl(0.28, 1.7, gun, 1.15, 0.9, 0.0, { seg: 28, dirt: 0 }); cyl(0.3, 0.08, gunD, 1.15, 2.6, 0.0, { seg: 28, dirt: 0 });

  // ---- cab-over cab: tall box with a short sloped nose and windscreen, off-white like the truck
  const CX0 = 1.55, CY = 2.55, CW = 1.5;
  const prof = new THREE.Shape(); prof.moveTo(CX0, 0.55); prof.lineTo(CX0, CY - 0.12); prof.lineTo(CX0 + 0.12, CY); prof.lineTo(3.9, CY); prof.lineTo(4.25, 1.9); prof.lineTo(4.28, 0.55); prof.closePath();
  const cg = new THREE.ExtrudeGeometry(prof, { depth: CW * 2 - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  cg.translate(0, 0, -(CW * 2 - 0.16) / 2);
  mesh(cg, off, 0, 0, 0, { dirt: 0.4, dirtH: 1.4 });
  beam([3.92, CY + 0.005, 0], [4.3, 1.92, 0], CW * 2 - 0.3, 0.05, glassD);                       // windscreen
  beam([3.95, CY + 0.03, 0], [4.27, 2.0, 0], CW * 2 - 0.5, 0.012, M.emit(TEAM, 0.5), { cast: false });
  // sun visor
  box(0.22, 0.05, CW * 2 - 0.1, gunD, 3.98, CY + 0.02, 0, { dirt: 0 });
  // side armour skirts, steps, mirrors
  for (const s of [-1, 1]) {
    box(2.5, 0.9, 0.1, gun, 2.9, 0.65, s * (CW + 0.06), { dirt: 0 });
    beam([3.7, 2.0, s * (CW + 0.05)], [3.85, 2.05, s * (CW + 0.42)], 0.05, 0.05, gunD);
    box(0.12, 0.42, 0.14, M.dark, 3.85, 1.75, s * (CW + 0.45), { dirt: 0 });
    box(0.08, 0.36, 0.1, glassD, 3.79, 1.78, s * (CW + 0.45), { dirt: 0, cast: false });
  }
  // front bumper with headlights and amber markers
  box(0.3, 0.45, 3.4, gunD, XF - 0.15, 0.6, 0, { dirt: 0 });
  box(0.28, 0.02, 2.0, M.hazard, XF - 0.15, 1.05, 0, { dirt: 0 });
  for (const s of [-1, 1]) {
    box(0.22, 0.06, 0.3, M.emit('#fff1c8', 0.7), XF - 0.13, 1.05, s * 1.25, { dirt: 0, cast: false });
    box(0.2, 0.06, 0.16, M.emit('#ffa632', 1.2), XF - 0.13, 1.05, s * 1.62, { dirt: 0, cast: false });
  }
  // roof: team panel and stripes, a team-coloured light bar at the front, hatch and air horns
  box(1.85, 0.04, CW * 2 - 0.8, team, 2.6, CY + 0.08, 0, { dirt: 0 });
  box(1.95, 0.03, CW * 2 - 0.66, gunD, 2.6, CY + 0.06, 0, { dirt: 0 });
  for (const s of [-1, 1]) box(1.85, 0.03, 0.05, M.emit(TEAM, 0.7), 2.6, CY + 0.12, s * (CW - 0.4), { dirt: 0, cast: false });
  box(0.3, 0.14, CW * 2 - 0.5, gunD, 3.72, CY + 0.06, 0, { dirt: 0 });                        // light bar housing
  for (let k = 0; k < 5; k++) box(0.16, 0.05, 0.3, M.emit(TEAM, 1.1), 3.76, CY + 0.2, -1.0 + k * 0.5, { dirt: 0, cast: false });
  box(0.55, 0.06, 0.55, gun, 2.15, CY + 0.08, 0, { dirt: 0 });
  for (const s of [-1, 1]) hcyl(0.06, 0.6, M.chrome, 1.95, CY + 0.17, s * 0.62, { axis: 'x' });
  cyl(0.03, 0.5, gunD, 1.8, CY + 0.1, -1.1, { seg: 8, dirt: 0 });

  if (part === 'brake') {
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    for (const m of brakeLens) { m.visible = true; m.material = M.emit('#ff2a1e', 4); }
  }
}
