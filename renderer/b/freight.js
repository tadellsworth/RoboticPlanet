// Freight Train cars, top-down, facing +x (right), orthographic straight down like b/truck.js; 10 units across the
// frame (256 px final). Every car is 8 units coupler to coupler (80 %) and 4 units wide (40 %), symmetric about z = 0,
// with bogie wheels on the rail lines (z = +-2.19 = the track tiles' 33 % / 67 % rails at the game's car scale).
//   ?part=loco (default) | flat | hopper | brake (loco rear lenses only, lit) | heads (loco headlight lenses only, lit)
//   ?f=k   loco frame k (0..3): roof fans turn 1/4 of a blade gap, wheels a quarter turn
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, group, railing, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), part = p.get('part') || 'loco';
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), deckP = M.paint('#5a6066', { panelW: 128, panelH: 512 });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.55).getHexString(), { rivets: false }), glowT = M.emit(TEAM, 0.75);
  const yellow = M.paint('#c9a22a', { rivets: false }), glassD = M.plain('#0e1114', 0.15, 0.6);
  L.seed(1501);

  const W = 10, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const RZ = 2.19, WR = 0.5;                                       // rail line, wheel radius
  // ---- bogie: two wheelsets on the rail lines, outboard side frames with spring nests
  function bogie(bx, roll) {
    for (const ax of [-0.75, 0.75]) {
      hcyl(0.07, RZ * 2, M.steel, bx + ax, WR, 0, { axis: 'z' });
      for (const s of [-1, 1]) {
        const w = group(bx + ax, WR, s * RZ); w.rotation.z = -roll;
        const tg = new THREE.CylinderGeometry(WR, WR, 0.2, 40, 1); tg.rotateX(Math.PI / 2);
        mesh(tg, M.steel, 0, 0, 0, { parent: w, dirt: 0 });
        const fl = new THREE.CylinderGeometry(WR + 0.06, WR + 0.06, 0.05, 40, 1); fl.rotateX(Math.PI / 2);
        mesh(fl, gunD, 0, 0, -s * 0.11, { parent: w, dirt: 0 });
        for (const a of [0.3, 2.4, 4.1]) {                                       // scuffs on the tread so the roll reads
          const b = new THREE.BoxGeometry(0.16, 0.03, 0.21); b.translate(0, WR + 0.003, 0);
          const m = mesh(b, M.plain('#2a2b2d', 0.7), 0, 0, 0, { parent: w, dirt: 0 }); m.rotation.z = a;
        }
      }
    }
    for (const s of [-1, 1]) {
      const z = s * (RZ + 0.2);
      box(2.2, 0.32, 0.14, gunD, bx, 0.55, z, { dirt: 0 });                       // side frame
      box(0.6, 0.5, 0.18, gun, bx, 0.45, z, { dirt: 0 });                          // spring nest
      for (const ax of [-0.75, 0.75]) box(0.34, 0.3, 0.2, gun, bx + ax, 0.38, z, { dirt: 0 });   // axle boxes
      for (const dx of [-0.15, 0.15]) cyl(0.07, 0.3, M.paint('#c9a22a', { rivets: false }), bx + dx, 0.5, z, { seg: 10, dirt: 0 });
    }
    box(0.5, 0.3, RZ * 2 - 0.4, gunD, bx, 0.75, 0, { dirt: 0 });                  // bolster
  }
  function coupler(xe, sgn) {
    box(0.5, 0.22, 0.26, gunD, xe - sgn * 0.12, 0.95, 0, { dirt: 0 });
    const k = new THREE.Shape(); k.moveTo(0, -0.2); k.lineTo(0.18, -0.2); k.lineTo(0.22, 0.05); k.lineTo(0.1, 0.22); k.lineTo(0, 0.12); k.closePath();
    const g = new THREE.ExtrudeGeometry(k, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); if (sgn < 0) g.rotateY(Math.PI);
    mesh(g, gun, xe - sgn * 0.08, 1.08, 0, { dirt: 0 });
    hcyl(0.035, 0.3, M.steel, xe - sgn * 0.45, 1.05, 0.28, { axis: 'x' });          // cut lever / air hose
    hcyl(0.04, 0.35, M.plain('#1a1b1c', 0.8), xe - sgn * 0.45, 0.95, -0.22, { axis: 'x' });
  }
  function headstock(x, w = 3.9) {
    box(0.26, 0.4, w, gunD, x, 0.8, 0, { dirt: 0 });
    box(0.24, 0.02, w - 0.2, M.hazard, x, 1.2, 0, { dirt: 0 });
  }
  function sideStripe(x0, x1, y, z) {                                           // team livery stripe on a side sill top
    box(x1 - x0, 0.03, 0.14, team, (x0 + x1) / 2, y, z, { dirt: 0 });
    box(x1 - x0 - 0.2, 0.012, 0.04, glowT, (x0 + x1) / 2, y + 0.03, z, { dirt: 0, cast: false });
  }
  const roll = f * Math.PI / 2;
  const brakeLens = [], headLens = [];

  if (part === 'flat') {
    for (const bx of [-2.5, 2.5]) bogie(bx, 0);
    box(7.3, 0.4, 3.0, gunD, 0, 0.85, 0, { dirt: 0 });                            // centre sill / underframe
    const X0 = -3.62, X1 = 3.62, DY = 1.25;
    box(X1 - X0, 0.12, 3.8, deckP, 0, DY - 0.12, 0, { dirt: 0 });
    for (let x = X0 + 0.6; x < X1 - 0.3; x += 0.6) box(0.04, 0.012, 3.4, M.dark, x, DY, 0, { dirt: 0, cast: false });
    for (const s of [-1, 1]) {
      box(X1 - X0, 0.18, 0.12, gun, 0, DY - 0.1, s * 1.92, { dirt: 0 });          // side sills
      sideStripe(X0 + 0.15, X1 - 0.15, DY + 0.08, s * 1.92);
      for (let x = X0 + 0.45; x < X1 - 0.3; x += 0.9) box(0.16, 0.16, 0.16, gunD, x, DY - 0.05, s * 1.82, { dirt: 0 });   // stake pockets
      for (let x = X0 + 0.9; x < X1 - 0.5; x += 1.8) { const r = new THREE.TorusGeometry(0.07, 0.02, 8, 14); r.rotateX(Math.PI / 2); mesh(r, M.paint('#d0a536', { rivets: false }), x, DY + 0.02, s * 1.6, { dirt: 0 }); }
    }
    for (const s of [-1, 1]) {                                                    // low end bulkheads
      box(0.16, 0.6, 3.8, gun, s * (X1 - 0.08), DY, 0, { dirt: 0 });
      box(0.18, 0.03, 3.6, M.hazard, s * (X1 - 0.08), DY + 0.6, 0, { dirt: 0 });
      headstock(s * 3.72); coupler(s * 3.95, s);
    }
    return;
  }

  if (part === 'hopper') {
    for (const bx of [-2.5, 2.5]) bogie(bx, 0);
    box(7.3, 0.4, 3.0, gunD, 0, 0.85, 0, { dirt: 0 });
    const X0 = -3.35, X1 = 3.35, Z = 1.9, H0 = 1.15, H1 = 2.75, t = 0.1;
    // open box with ribbed sides; the interior is dark with two sloped hopper bays
    const sideM = M.ribbed('#7a8086', { period: 18 });
    for (const s of [-1, 1]) {
      box(X1 - X0, H1 - H0, t, sideM, 0, H0, s * (Z - t / 2), { dirt: 0.5, dirtH: 1.2 });
      box(t, H1 - H0, Z * 2, sideM, s * (X1 - t / 2), H0, 0, { dirt: 0.5, dirtH: 1.2 });
      for (let x = X0 + 0.45; x < X1 - 0.3; x += 0.75) box(0.1, H1 - H0 - 0.1, 0.12, gun, x, H0, s * (Z + 0.04), { dirt: 0 });   // external ribs
      box(X1 - X0 + 0.1, 0.1, 0.16, gun, 0, H1 - 0.02, s * (Z - 0.02), { dirt: 0 });                   // top chord
      box(0.16, 0.1, Z * 2 + 0.1, gun, s * (X1 - 0.02), H1 - 0.02, 0, { dirt: 0 });
      sideStripe(X0 + 0.2, X1 - 0.2, H1 + 0.08, s * (Z - 0.02));
      headstock(s * 3.72); coupler(s * 3.95, s);
      for (const z of [-1.2, 1.2]) beam([s * 3.62, 1.2, z], [s * (X1 - 0.05), H1 - 0.1, z], 0.1, 0.1, gun);   // end platform braces
    }
    const dark = M.plain('#141210', 0.95);
    const inner = M.plain('#1e1c1a', 0.9);
    // sloped floors: two hopper bays meeting at a ridge in the middle, chutes at the bottom
    const IX0 = X0 + t, IX1 = X1 - t, IZ = Z - t;
    for (const [a, b] of [[IX0, -0.1], [0.1, IX1]]) {
      const mid = (a + b) / 2, half = (b - a) / 2;
      for (const s of [-1, 1]) {
        beam([mid - s * half, H1 - 0.35, 0], [mid - s * 0.2, H0 + 0.25, 0], IZ * 2, 0.05, inner);
      }
      box(0.4, 0.05, IZ * 2 - 0.6, dark, mid, H0 + 0.2, 0, { dirt: 0, cast: false });
    }
    box(0.22, H1 - H0 - 0.25, IZ * 2, inner, 0, H0, 0, { dirt: 0 });                                   // centre ridge
    box(0.3, 0.06, IZ * 2, gun, 0, H1 - 0.28, 0, { dirt: 0 });
    for (const x of [-1.75, 1.75]) beam([x, H1 - 0.12, -IZ], [x, H1 - 0.12, IZ], 0.08, 0.08, gun);   // cross ties
    return;
  }

  // ================= locomotive =================
  for (const bx of [-2.6, 2.6]) bogie(bx, roll);
  box(7.4, 0.42, 3.0, gunD, 0, 0.8, 0, { dirt: 0 });                                   // underframe
  // fuel tank between the bogies
  for (const s of [-1, 1]) hcyl(0.5, 2.6, gun, 0, 0.75, s * 0.9, { axis: 'x' });
  const DY = 1.25, XB0 = -3.62, XB1 = 3.62;
  box(XB1 - XB0, 0.14, 4.0, M.grating, 0, DY - 0.14, 0, { dirt: 0 });                 // walkway deck
  for (const s of [-1, 1]) {
    box(XB1 - XB0, 0.2, 0.1, gun, 0, DY - 0.2, s * 1.97, { dirt: 0 });
    railing([[XB0 + 0.1, s * 1.9], [XB1 - 0.5, s * 1.9]], DY, { h: 0.6, spacing: 0.9, mat: yellow });
    headstock(s * 3.72); coupler(s * 3.95, s);
  }
  railing([[XB0 + 0.1, -1.9], [XB0 + 0.1, -0.6]], DY, { h: 0.6, mat: yellow });
  railing([[XB0 + 0.1, 1.9], [XB0 + 0.1, 0.6]], DY, { h: 0.6, mat: yellow });
  // long hood with rounded roof edges
  const HX0 = -3.3, HX1 = 2.15, HZ = 1.38, HY = 3.0, rr = 0.32;
  {
    const sh = new THREE.Shape(); sh.moveTo(-HZ, 0); sh.lineTo(-HZ, HY - DY - rr); sh.quadraticCurveTo(-HZ, HY - DY, -HZ + rr, HY - DY);
    sh.lineTo(HZ - rr, HY - DY); sh.quadraticCurveTo(HZ, HY - DY, HZ, HY - DY - rr); sh.lineTo(HZ, 0); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: HX1 - HX0, bevelEnabled: false, curveSegments: 8 });
    g.rotateY(Math.PI / 2); g.translate(HX0, DY, 0);
    mesh(g, off, 0, 0, 0, { dirt: 0.4, dirtH: 1.4 });
    // livery: team band along both roof edges, glowing line
    for (const s of [-1, 1]) {
      box(HX1 - HX0 - 0.1, 0.02, 0.22, team, (HX0 + HX1) / 2 - 0.05, HY - 0.02, s * (HZ - 0.32), { dirt: 0 });
      box(HX1 - HX0 - 0.3, 0.012, 0.045, glowT, (HX0 + HX1) / 2, HY + 0.005, s * (HZ - 0.32), { dirt: 0, cast: false });
    }
    // side doors (seen as seams on the roof edges) and roof panel seams
    for (let x = HX0 + 0.75; x < HX1; x += 0.75) box(0.03, 0.01, HZ * 2 - 0.9, M.dark, x, HY, 0, { dirt: 0, cast: false });
  }
  // two big radiator fans under circular grilles at the rear of the hood
  const NB = 7;
  for (const fx of [-2.55, -1.25]) {
    cyl(0.68, 0.08, gunD, fx, HY - 0.02, 0, { seg: 48, dirt: 0 });
    cyl(0.6, 0.02, M.plain('#121314', 0.9), fx, HY + 0.04, 0, { seg: 48, dirt: 0 });
    const fg = group(fx, HY + 0.08, 0); fg.rotation.y = -(f / 4) * (Math.PI * 2 / NB);
    for (let k = 0; k < NB; k++) {
      const bl = new THREE.BoxGeometry(0.5, 0.02, 0.17); bl.translate(0.3, 0, 0); bl.rotateX(0.35);
      const m = mesh(bl, M.paint('#8a9096', { rivets: false }), 0, 0, 0, { parent: fg, dirt: 0 }); m.rotation.y = k * Math.PI * 2 / NB;
    }
    cyl(0.12, 0.08, gun, 0, 0, 0, { seg: 20, dirt: 0, parent: fg });
    // grille: rings + radial bars over the fan
    for (const r of [0.22, 0.42, 0.62]) L.hoop(r, 0.018, M.steel, fx, HY + 0.17, 0);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; beam([fx + Math.cos(a) * 0.12, HY + 0.17, Math.sin(a) * 0.12], [fx + Math.cos(a) * 0.66, HY + 0.17, Math.sin(a) * 0.66], 0.03, 0.03, M.steel); }
  }
  // exhaust hatch with louvers
  box(0.9, 0.12, 0.8, gunD, 0.0, HY, 0, { dirt: 0 });
  box(0.7, 0.04, 0.6, M.grille('#2e3236'), 0.0, HY + 0.12, 0, { dirt: 0 });
  box(0.4, 0.06, 0.3, M.plain('#151515', 0.95), 0.0, HY + 0.13, 0, { dirt: 0, cast: false });
  // folded pantograph on insulators
  for (const [x, z] of [[0.75, -0.55], [0.75, 0.55], [1.85, -0.55], [1.85, 0.55]]) { cyl(0.08, 0.22, M.paint('#b8352a', { rivets: false }), x, HY, z, { seg: 12, dirt: 0 }); }
  box(1.3, 0.08, 1.3, gun, 1.3, HY + 0.22, 0, { dirt: 0 });
  beam([0.85, HY + 0.34, -0.4], [1.95, HY + 0.42, 0.0], 0.07, 0.07, M.steel); beam([0.85, HY + 0.34, 0.4], [1.95, HY + 0.42, 0.0], 0.07, 0.07, M.steel);
  beam([1.95, HY + 0.42, 0], [0.75, HY + 0.5, 0], 0.06, 0.06, M.steel);
  box(0.12, 0.06, 1.5, M.chrome, 0.72, HY + 0.5, 0, { dirt: 0 });                    // pan head
  // horns and an antenna
  for (const s of [-1, 1]) hcyl(0.05, 0.4, M.chrome, 2.0, HY + 0.08, s * 0.95, { axis: 'x' });

  // cab with a sloped nose: wide dark windscreen, livery across the nose, twin headlights
  const CX0 = 2.15, CX1 = 3.2, CY = 3.15;
  const prof = new THREE.Shape(); prof.moveTo(CX0, DY); prof.lineTo(CX0, CY); prof.lineTo(CX1 - 0.15, CY); prof.lineTo(3.62, 2.1); prof.lineTo(3.66, DY); prof.closePath();
  const cg = new THREE.ExtrudeGeometry(prof, { depth: 3.4, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  cg.translate(0, 0, -1.7);
  mesh(cg, off, 0, 0, 0, { dirt: 0.35, dirtH: 1.4 });
  beam([CX1 - 0.12 + 0.09, CY + 0.05, 0], [3.6 + 0.09, 2.15 + 0.05, 0], 3.1, 0.06, glassD);       // windscreen on the slope
  beam([CX1 - 0.05 + 0.1, CY + 0.06, 0], [3.25 + 0.1, 2.8 + 0.06, 0], 2.9, 0.02, M.emit(TEAM, 0.5), { cast: false });
  box(0.5, 0.03, 3.3, team, 2.62, CY + 0.06, 0, { dirt: 0 });                         // livery across the cab roof
  beam([3.72, 2.02, 0], [3.76, 1.62, 0], 3.3, 0.05, team);                             // and across the nose
  box(0.04, 0.012, 3.0, glowT, 2.88, CY + 0.09, 0, { dirt: 0, cast: false });
  box(0.4, 0.1, 0.6, gunD, 2.4, CY + 0.06, 0, { dirt: 0 }); box(0.34, 0.02, 0.5, M.grille('#3d4247'), 2.4, CY + 0.16, 0, { dirt: 0 });                           // roof AC unit
  for (const s of [-1, 1]) {
    box(0.12, 0.2, 0.36, gunD, 3.7, 1.45, s * 0.85, { dirt: 0 });
    headLens.push(box(0.06, 0.16, 0.3, M.emit('#fff1c8', 0.8), 3.77, 1.47, s * 0.85, { dirt: 0, cast: false }));
    box(0.1, 0.1, 0.14, M.emit('#ffa632', 1.0), 3.72, 1.45, s * 1.55, { dirt: 0, cast: false });
  }
  // rear: brake and marker lights on the rear headstock
  for (const s of [-1, 1]) {
    box(0.22, 0.14, 0.34, gunD, -3.72, 1.2, s * 1.3, { dirt: 0 });
    brakeLens.push(box(0.16, 0.04, 0.26, M.plain('#5a1414', 0.35), -3.72, 1.34, s * 1.3, { dirt: 0, cast: false }));
    box(0.16, 0.04, 0.12, M.emit('#ffa632', 1.0), -3.72, 1.34, s * 1.62, { dirt: 0, cast: false });
  }

  if (part === 'brake' || part === 'heads') {
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    for (const m of (part === 'brake' ? brakeLens : headLens)) { m.visible = true; m.material = M.emit(part === 'brake' ? '#ff2a1e' : '#fff1c8', 4); }
  }
}
