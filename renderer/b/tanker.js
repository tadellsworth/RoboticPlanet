// Fuel Tanker: the Freight Truck's chassis and armoured cab with a fuel tank in place of the flatbed. Top-down, facing +x,
// orthographic camera straight down, no ground and no shadow. Same framing as the Freight Truck.
//   ?f=k     driving frame k (0..3): every tyre rolled forward by k/4 of one tread-block pitch
//   ?part=   truck (default) | brake (only the two rear brake lenses, lit) | boost (only the cab's motor vents, glowing)
export const config = { pad: false, size: 768 };
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, mesh, group, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), part = p.get('part') || 'truck';
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), deck = M.paint('#5a6066', { panelW: 128, panelH: 512 });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.55).getHexString(), { rivets: false }), rubber = M.plain('#141516', 0.95), lug = M.plain('#4a4c50', 0.8);
  L.seed(611);

  // camera: straight down, image top = -z, 10 world units across the 384-px frame (truck = 8.5 = 85 %)
  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const XF = 4.25, XR = -4.25, HW = 1.93;                       // overall footprint: 8.5 x 3.86 (2.2 : 1)
  const keep = [];                                                // meshes kept visible in the overlay passes

  // ---- tyres: three axles, deep staggered block treads; rolled per frame
  const TR = 0.62, TW = 0.62, NL = 18, pitch = Math.PI * 2 / NL;
  for (const ax of [2.95, -1.55, -3.05]) for (const s of [-1, 1]) {
    const w = group(ax, TR, s * (HW - TW / 2)); w.rotation.z = -f * pitch / 4;     // negative: the top of the tyre moves forward
    const tg = new THREE.CylinderGeometry(TR - 0.07, TR - 0.07, TW, 36, 1); tg.rotateX(Math.PI / 2);
    mesh(tg, rubber, 0, 0, 0, { parent: w, dirt: 0 });
    for (let k = 0; k < NL; k++) for (const half of [-1, 1]) {
      const a = k * pitch + (half > 0 ? pitch / 2 : 0);
      const b = new THREE.BoxGeometry(0.17, 0.11, TW * 0.46); b.translate(0, TR - 0.06, half * TW * 0.26);
      const m = mesh(b, lug, 0, 0, 0, { parent: w, dirt: 0 }); m.rotation.z = a;
    }
    const sw = new THREE.CylinderGeometry(TR - 0.02, TR - 0.02, 0.06, 36, 1); sw.rotateX(Math.PI / 2);    // shoulder ribs on the sidewalls
    for (const e of [-1, 1]) mesh(sw, rubber, 0, 0, e * (TW / 2 - 0.03), { parent: w, dirt: 0 });
  }

  // ---- chassis and fuel tank: an oval-section tank on saddles, top catwalk, hatches, vapour line, team stripes
  box(7.6, 0.35, 2.2, gunD, -0.3, 0.55, 0, { dirt: 0 });                              // frame rails (mostly hidden)
  const TX0 = -3.95, TX1 = 1.42, TYc = 1.62, TRz = 1.3, TRy = 0.82;                  // tank: x span, centre height, half-width, half-height
  const tankM = M.paint('#c3c6c8', { rivets: false, metal: 0.55, rough: 0.35, panelW: 4096, panelH: 4096 });
  const tlen = TX1 - TX0, tmid = (TX0 + TX1) / 2;
  const body = new THREE.CylinderGeometry(1, 1, tlen - 0.5, 48, 1, true); body.rotateZ(Math.PI / 2); body.scale(1, TRy, TRz);
  mesh(body, tankM, tmid, TYc, 0, { dirt: 0.25, dirtH: 0.6 });
  for (const e of [-1, 1]) {                                                            // dished ends
    const cap = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2); cap.rotateZ(-e * Math.PI / 2); cap.scale(0.25, TRy, TRz);
    mesh(cap, tankM, tmid + e * (tlen - 0.5) / 2, TYc, 0, { dirt: 0.2 });
  }
  for (const x of [TX0 + 0.55, tmid - 0.9, tmid + 0.9, TX1 - 0.55]) {                // reinforcing rings
    const r = new THREE.TorusGeometry(1, 0.045, 8, 48); r.rotateY(Math.PI / 2); r.scale(1, TRy + 0.01, TRz + 0.01);
    mesh(r, gun, x, TYc, 0, { dirt: 0 });
  }
  for (const x of [TX0 + 0.7, TX1 - 0.7]) box(0.5, 0.75, 2.3, gunD, x, 0.6, 0, { dirt: 0 });   // saddles
  // team-colour stripes down both upper flanks, with thin running lights
  for (const s of [-1, 1]) {
    const st = new THREE.CylinderGeometry(1, 1, tlen - 0.9, 48, 1, true, s > 0 ? Math.PI * 0.215 : Math.PI * 0.735, Math.PI * 0.05); st.rotateZ(Math.PI / 2); st.scale(1, TRy + 0.012, TRz + 0.012);
    mesh(st, team, tmid, TYc, 0, { dirt: 0, cast: false });
  }
  // top catwalk with grating, handrails, three domed manhole hatches and a vapour-recovery line
  const top = TYc + TRy;
  box(tlen - 0.9, 0.06, 0.62, M.grating, tmid, top - 0.02, 0, { dirt: 0 });
  for (const s of [-1, 1]) {
    for (let x = TX0 + 0.6; x <= TX1 - 0.5; x += 0.95) box(0.04, 0.32, 0.04, M.steel, x, top, s * 0.36, { dirt: 0 });
    box(tlen - 1.0, 0.04, 0.04, M.paint('#d0a536', { rivets: false }), tmid, top + 0.32, s * 0.36, { dirt: 0 });
  }
  for (const x of [TX0 + 1.15, tmid, TX1 - 1.15]) {
    cyl(0.3, 0.1, gun, x, top + 0.02, 0, { seg: 24, dirt: 0 });
    const d = new THREE.SphereGeometry(0.27, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.45, 1); mesh(d, M.steel, x, top + 0.12, 0, { dirt: 0 });
    box(0.32, 0.04, 0.06, gunD, x, top + 0.2, 0.18, { dirt: 0 });
  }
  pipe([[TX0 + 0.5, top + 0.08, -0.48], [TX1 - 0.4, top + 0.08, -0.48]], 0.05, gunD);
  // hazard placards (flammable diamond) on the tank's rear end and on both sides of the top
  const plac = L.canvasTex(128, (g, n) => { g.fillStyle = '#e8541c'; g.fillRect(0, 0, n, n); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(10, 10, n - 20, n - 20);
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(n / 2, 26); g.bezierCurveTo(n * 0.78, n * 0.45, n * 0.7, n * 0.66, n / 2, n * 0.7); g.bezierCurveTo(n * 0.3, n * 0.66, n * 0.24, n * 0.48, n * 0.4, n * 0.36);
    g.bezierCurveTo(n * 0.42, n * 0.48, n * 0.5, n * 0.5, n / 2, 26); g.fill(); g.fillRect(n * 0.3, n * 0.78, n * 0.4, 6); });
  const placM = new THREE.MeshStandardMaterial({ map: plac, roughness: 0.6, vertexColors: true });
  for (const s of [-1, 1]) { const g = group(tmid + 1.55, TYc + TRy * Math.sqrt(1 - (0.86 / TRz) ** 2) + 0.02, s * 0.86, 0); g.rotation.x = s * 0.51; const pl = box(0.4, 0.02, 0.4, placM, 0, 0, 0, { parent: g, dirt: 0, cast: false }); pl.rotation.y = Math.PI / 4; }
  // rear: valve manifold, hose reel, ladder up to the catwalk
  for (const s of [-1, 1]) { cyl(0.12, 0.42, M.steel, TX0 - 0.05, 0.6, s * 0.55, { seg: 16 }); hcyl(0.1, 0.3, M.paint('#c43b2a', { rivets: false }), TX0 - 0.05, 0.95, s * 0.55, { axis: 'z' }); }
  hcyl(0.07, 1.6, gunD, TX0 - 0.05, 0.62, 0, { axis: 'z' });
  hcyl(0.28, 0.5, M.plain('#141516', 0.9), TX0 + 0.25, 0.75, -1.15, { axis: 'z', seg: 24 });
  for (let k = 0; k < 6; k++) box(0.05, 0.03, 0.42, M.steel, TX0 - 0.15, 0.85 + k * 0.17, 0.8, { dirt: 0 });
  // fuel-amber edge markers along the frame
  for (const s of [-1, 1]) for (const x of [-2.6, -0.6]) box(0.14, 0.05, 0.08, M.emit('#ffa632', 1.0), x, 0.74, s * 1.42, { dirt: 0, cast: false });
  // rear bumper with hazard stripes, rear corner lights
  box(0.28, 0.4, 3.3, gunD, XR + 0.14, 0.75, 0, { dirt: 0 });
  box(0.26, 0.02, 2.2, M.hazard, XR + 0.15, 1.15, 0, { dirt: 0 });
  const brakeLens = [];
  for (const s of [-1, 1]) {
    box(0.26, 0.12, 0.32, gunD, XR + 0.15, 1.15, s * 1.28, { dirt: 0 });
    brakeLens.push(box(0.2, 0.04, 0.24, M.plain('#5a1414', 0.35), XR + 0.15, 1.27, s * 1.28, { dirt: 0, cast: false }));
    box(0.26, 0.12, 0.18, gunD, XR + 0.15, 1.15, s * 1.62, { dirt: 0 });
    box(0.18, 0.04, 0.12, M.emit('#ffa632', 1.2), XR + 0.15, 1.27, s * 1.62, { dirt: 0, cast: false });
  }

  // ---- armoured cab: side profile extruded across the truck; sloped nose with a dark sensor strip
  const CX0 = 1.6, CY = 2.05, CW = 1.45;
  const prof = new THREE.Shape(); prof.moveTo(CX0, 0.55); prof.lineTo(CX0, CY - 0.12); prof.lineTo(CX0 + 0.12, CY); prof.lineTo(3.7, CY); prof.lineTo(4.12, 1.48); prof.lineTo(4.12, 0.55); prof.closePath();
  const cg = new THREE.ExtrudeGeometry(prof, { depth: CW * 2 - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  cg.translate(0, 0, -(CW * 2 - 0.16) / 2);
  mesh(cg, off, 0, 0, 0, { dirt: 0.4, dirtH: 1.2 });
  beam([3.74, CY + 0.005, 0], [4.15, 1.5, 0], CW * 2 - 0.3, 0.05, M.plain('#0e1114', 0.15, 0.6));       // sensor windscreen strip
  beam([3.76, CY + 0.03, 0], [4.13, 1.56, 0], CW * 2 - 0.5, 0.012, M.emit(TEAM, 0.5), { cast: false });
  // gunmetal armour skirts along the cab sides and a front bumper with headlights and amber markers
  for (const s of [-1, 1]) box(2.3, 0.75, 0.1, gun, 2.85, 0.7, s * (CW + 0.06), { dirt: 0 });
  box(0.3, 0.45, 3.3, gunD, XF - 0.15, 0.6, 0, { dirt: 0 });
  for (const s of [-1, 1]) {
    box(0.22, 0.06, 0.3, M.emit('#fff1c8', 0.7), XF - 0.13, 1.05, s * 1.18, { dirt: 0, cast: false });
    box(0.2, 0.06, 0.16, M.emit('#ffa632', 1.2), XF - 0.13, 1.05, s * 1.6, { dirt: 0, cast: false });
  }
  // roof: team-coloured panel, armour trim, sensor puck, motor vents at the back of the cab
  box(1.55, 0.04, CW * 2 - 0.75, team, 2.75, CY + 0.08, 0, { dirt: 0 });
  box(1.65, 0.03, CW * 2 - 0.62, gunD, 2.75, CY + 0.06, 0, { dirt: 0 });
  for (const s of [-1, 1]) box(1.55, 0.03, 0.04, M.emit(TEAM, 0.7), 2.75, CY + 0.12, s * (CW - 0.4), { dirt: 0, cast: false });
  cyl(0.16, 0.1, gunD, 3.55, CY + 0.08, 0, { seg: 20, dirt: 0 }); cyl(0.1, 0.05, M.plain('#0e1114', 0.15, 0.6), 3.55, CY + 0.18, 0, { seg: 20, dirt: 0 });
  const ventGlow = [];
  for (const s of [-1, 1]) {
    box(0.42, 0.08, 0.95, gunD, 1.92, CY + 0.06, s * 0.72, { dirt: 0 });
    box(0.34, 0.03, 0.85, M.grille('#3d4247'), 1.92, CY + 0.14, s * 0.72, { dirt: 0 });
    for (let k = 0; k < 4; k++) ventGlow.push(box(0.28, 0.02, 0.1, M.dark, 1.92, CY + 0.15, s * 0.72 - 0.3 + k * 0.2, { dirt: 0, cast: false }));
  }


  // ---- twin exhaust stacks beside the back of the cab (chrome, perforated heat shields, rain caps); marks at the tips
  for (const [k, s] of [[0, -1], [1, 1]]) {
    const x = 1.62, z = s * 1.72, top = 3.05;
    cyl(0.15, top - 0.55, M.steel, x, 0.55, z, { seg: 24, dirt: 0, soot: 0.8 });
    cyl(0.19, 1.1, M.grille('#8a9197'), x, 1.25, z, { seg: 24, dirt: 0 });
    cyl(0.165, 0.22, M.plain('#24211e', 0.8), x, top - 0.22, z, { seg: 24, dirt: 0 });           // soot-black tip
    cyl(0.12, 0.02, M.plain('#080808', 0.9), x, top, z, { seg: 20, dirt: 0 });                  // open pipe
    const cap = new THREE.CylinderGeometry(0.15, 0.15, 0.025, 20); cap.translate(0.15, 0.012, 0);
    const cm = mesh(cap, gunD, x - 0.15, top + 0.01, z, { dirt: 0 }); cm.rotation.z = 1.15;   // rain flap swung open, toward the back
    for (const y of [0.9, 2.5]) hoop(0.14, 0.03, gunD, x, y, z);
    box(0.3, 0.1, 0.22, gunD, x + 0.1, 1.0, z - s * 0.12, { dirt: 0 });              // bracket to the cab
    L.mark('ex' + k, x, top + 0.05, z);
  }

  // ---- overlay passes: hide the truck, keep only the lit parts, at exactly the same framing
  if (part !== 'truck') {
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    if (part === 'brake') for (const m of brakeLens) { m.visible = true; m.material = M.emit('#ff2a1e', 4); }
    if (part === 'boost') for (const m of ventGlow) { m.visible = true; m.material = M.emit('#bfe4ff', 2.6); }
  }
}
