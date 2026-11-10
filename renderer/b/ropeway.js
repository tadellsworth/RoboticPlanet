// Ropeway station: a slim steel lattice pylon on a concrete footing, a big grooved bull wheel at the top for the haul
// cable, a small machine house with the drive motor and the team status light at its foot, and a short loading platform
// with railings and hazard stripes. The bull wheel's centre is placed so it projects onto the image's vertical centre
// line, 10 % from the top edge (solved against the shared building camera).
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, lamp, ao, group, ladder, railing, pipe, hoop, M, THREE, TEAM } = L;
  L.seed(1207);
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), wall = M.ribbed('#a39c90');
  const conc = M.rough('#8f887c'), yellow = M.paint('#c9a22a', { rivets: false }), glow = M.emit(TEAM, 2.6);

  // ---- replica of the shared building camera (pad framing) to solve the wheel height
  const ELEV = 57 * Math.PI / 180;
  const cam = new THREE.PerspectiveCamera(20, 1, 0.5, 200);
  {
    const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
    let P = new THREE.Vector3(0, 0, 0).sub(D.clone().multiplyScalar(40));
    const BL = new THREE.Vector3(-5.06, -0.6, 5.06), BR = new THREE.Vector3(5.06, -0.6, 5.06);
    const pr = v => { const q = v.clone().project(cam); return [(q.x + 1) / 2, (1 - q.y) / 2]; };
    for (let i = 0; i < 80; i++) {
      cam.position.copy(P); cam.lookAt(P.clone().add(D)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const a = pr(BL), b = pr(BR); P.add(D.clone().multiplyScalar((0.75 - (b[0] - a[0])) * 20)); P.add(U.clone().multiplyScalar((0.96 - a[1]) * 8));
    }
  }
  const projY = (y, z) => { const q = new THREE.Vector3(0, y, z).project(cam); return (1 - q.y) / 2; };
  const ZT = -1.4;                                                    // tower axis
  let lo = 2, hi = 30;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (projY(m, ZT) > 0.10) lo = m; else hi = m; }
  const HW = (lo + hi) / 2;                                           // bull wheel centre height

  // ---- concrete footing and the lattice pylon (4 legs tapering, X-braced panels)
  box(3.4, 0.45, 3.4, conc, 0, 0, ZT, { dirtH: 0.4 });
  box(3.5, 0.05, 0.14, M.hazard, 0, 0.45, ZT + 1.68, { dirt: 0, cast: false });
  const Y0 = 0.45, Y1 = HW - 1.05, B0 = 1.2, B1 = 0.5;
  const leg = (sx, sz, y) => { const t = (y - Y0) / (Y1 - Y0), b = B0 + (B1 - B0) * t; return [sx * b, y, ZT + sz * b]; };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) {
    beam(leg(sx, sz, Y0), leg(sx, sz, Y1), 0.17, 0.17, gun);
    box(0.42, 0.25, 0.42, gunD, sx * B0, Y0, ZT + sz * B0, { dirt: 0 });             // base plates
  }
  const NP = 7, levels = [];
  for (let k = 0; k <= NP; k++) levels.push(Y0 + 0.25 + (Y1 - Y0 - 0.25) * (k / NP) ** 0.93);
  for (let k = 0; k <= NP; k++) for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
    beam(leg(ax, az, levels[k]), leg(bx, bz, levels[k]), 0.09, 0.09, gunD);
    if (k < NP) {
      beam(leg(ax, az, levels[k]), leg(bx, bz, levels[k + 1]), 0.06, 0.06, gun);
      beam(leg(bx, bz, levels[k]), leg(ax, az, levels[k + 1]), 0.06, 0.06, gun);
    }
  }
  // ladder with a cable tray running up the front-right leg
  ladder(0, Y0, Y1 - 0.2, ZT + 0.32);
  pipe([[1.6, 0.25, 0.9], [1.6, 0.25, ZT + 1.25], [0.62, 1.2, ZT + 1.25], [B1 + 0.1, Y1 - 0.2, ZT + B1 + 0.1]], 0.06, M.dark);

  // ---- headframe: a platform with railing, the bull wheel slung horizontally under its gearbox
  const HP = Y1;                                                      // platform top
  box(2.4, 0.22, 2.4, gunD, 0, HP - 0.22, ZT, { dirt: 0 });
  box(2.3, 0.03, 2.3, M.grating, 0, HP, ZT, { dirt: 0 });
  
  railing([[-1.12, ZT - 1.12], [1.12, ZT - 1.12], [1.12, ZT + 1.12], [-1.12, ZT + 1.12], [-1.12, ZT - 1.12]], HP, { h: 0.6 });
  // wheel bracket: a short box girder from the platform carrying the vertical axle
  box(0.9, 0.5, 0.7, gunD, 0, HP, ZT, { dirt: 0 });                             // gearbox under the wheel
  hcyl(0.24, 0.9, off, 0.0, HP + 0.26, ZT + 0.75, { axis: 'x' });                 // drive motor beside it
  for (let k = 0; k < 5; k++) hoop(0.25, 0.025, gunD, -0.34 + k * 0.17, HP + 0.26, ZT + 0.75, {}).rotation.z = Math.PI / 2;
  box(0.3, 0.3, 0.3, gun, 0.55, HP, ZT + 0.75, { dirt: 0 });
  // bull wheel: grooved rim (rubber liner), spokes and hub; horizontal, centre at (0, HW, ZT)
  const RW = 1.22, wg = group(0, HW, ZT);
  {
    const rim = new THREE.TorusGeometry(RW, 0.16, 14, 96); rim.rotateX(Math.PI / 2); mesh(rim, off, 0, 0.05, 0, { parent: wg, dirt: 0 });
    const rim2 = new THREE.TorusGeometry(RW, 0.16, 14, 96); rim2.rotateX(Math.PI / 2); mesh(rim2, off, 0, -0.17, 0, { parent: wg, dirt: 0 });
    const liner = new THREE.TorusGeometry(RW + 0.06, 0.085, 10, 96); liner.rotateX(Math.PI / 2); mesh(liner, M.plain('#151617', 0.9), 0, -0.06, 0, { parent: wg, dirt: 0 });
    const rib = new THREE.TorusGeometry(RW - 0.18, 0.05, 8, 96); rib.rotateX(Math.PI / 2); mesh(rib, gunD, 0, -0.06, 0, { parent: wg, dirt: 0 });
    for (let k = 0; k < 6; k++) {
      const a = k * Math.PI / 3, c = Math.cos(a), s = Math.sin(a);
      beam([c * 0.32, -0.06, s * 0.32], [c * (RW - 0.12), -0.06, s * (RW - 0.12)], 0.11, 0.14, gun, { parent: wg });
    }
    cyl(0.42, 0.42, gunD, 0, -0.27, 0, { seg: 32, dirt: 0, parent: wg });
    cyl(0.24, 0.12, M.chrome, 0, 0.15, 0, { seg: 24, dirt: 0, parent: wg });
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + 0.2; cyl(0.035, 0.06, M.steel, Math.cos(a) * 0.32, 0.15, Math.sin(a) * 0.32, { seg: 8, dirt: 0, parent: wg }); }
  }
  // axle down from the gearbox to the hub; the wheel hangs just below the platform
  cyl(0.13, HW - 0.27 - (HP + 0.5), M.steel, 0, HP + 0.5, ZT, { seg: 18, dirt: 0 });
  // aircraft warning light on the railing post
  sphere(0.1, M.emit('#ff3a22', 1.6), -1.12, HP + 0.85, ZT + 1.12, { dirt: 0 });

  // ---- machine house at the foot: ribbed walls, roof vents, the team status light
  const MX = 2.75, MZ = -0.1, MW = 2.6, MD = 2.5, MH = 1.85;
  box(MW + 0.2, 0.2, MD + 0.2, conc, MX, 0, MZ, { dirtH: 0.2 });
  box(MW, MH, MD, wall, MX, 0.2, MZ, { dirtH: 1.0 });
  box(MW + 0.25, 0.14, MD + 0.25, gunD, MX, 0.2 + MH, MZ, { dirt: 0 });
  box(MW - 0.2, 0.03, MD - 0.2, M.plain('#4b5157', 0.8), MX, 0.34 + MH, MZ, { dirt: 0 });
  cyl(0.32, 0.36, gun, MX + 0.6, 0.34 + MH, MZ - 0.5, { seg: 24, dirt: 0 }); cyl(0.26, 0.04, M.grille('#3d4247'), MX + 0.6, 0.7 + MH, MZ - 0.5, { seg: 24, dirt: 0 });
  box(0.9, 0.3, 0.6, gun, MX - 0.55, 0.34 + MH, MZ + 0.2, { dirt: 0 });
  box(0.8, 0.04, 0.5, M.grille('#3d4247'), MX - 0.55, 0.64 + MH, MZ + 0.2, { dirt: 0 });
  // door with hazard surround and a window band on the front face
  box(0.8, 1.35, 0.06, gunD, MX - 0.6, 0.2, MZ + MD / 2, { dirt: 0 });
  box(0.95, 0.07, 0.07, M.hazard, MX - 0.6, 1.55, MZ + MD / 2 + 0.01, { dirt: 0 });
  box(1.0, 0.32, 0.05, M.glass('#40525e', 0.9), MX + 0.55, 1.15, MZ + MD / 2 + 0.01, { dirt: 0 });
  // drive motor outside on the west side, shaft housing to the tower
  hcyl(0.34, 1.0, off, MX - MW / 2 - 0.55, 0.62, MZ - 0.4, { axis: 'x' });
  box(0.7, 0.28, 0.9, gunD, MX - MW / 2 - 0.55, 0.2, MZ - 0.4, { dirt: 0 });
  for (let k = 0; k < 6; k++) { const h = hoop(0.35, 0.025, gunD, MX - MW / 2 - 0.95 + k * 0.16, 0.62, MZ - 0.4, {}); h.rotation.z = Math.PI / 2; }
  // team status light: a beacon on the roof corner plus a glowing status panel by the door
  cyl(0.16, 0.14, gunD, MX + MW / 2 - 0.25, 0.34 + MH, MZ + MD / 2 - 0.25, { seg: 18, dirt: 0 });
  sphere(0.2, glow, MX + MW / 2 - 0.25, 0.62 + MH, MZ + MD / 2 - 0.25, { dirt: 0 });
  box(0.42, 0.42, 0.05, glow, MX + 0.05, 0.75, MZ + MD / 2 + 0.02, { dirt: 0, cast: false });
  box(MW - 0.3, 0.06, 0.05, glow, MX, 0.2 + MH - 0.25, MZ + MD / 2 + 0.02, { dirt: 0, cast: false });

  // ---- loading platform in front of the tower: deck, hazard edge, railings, steps and a crate
  const PX = -1.6, PZ = 2.2, PW = 4.0, PD = 1.9, PH = 0.7;
  box(PW, PH, PD, conc, PX, 0, PZ, { dirtH: 0.5 });
  box(PW, 0.04, PD, M.plain('#5c6166', 0.8), PX, PH, PZ, { dirt: 0 });
  box(PW, 0.03, 0.22, M.hazard, PX, PH + 0.01, PZ + PD / 2 - 0.11, { dirt: 0, cast: false });
  railing([[PX - PW / 2 + 0.1, PZ - PD / 2 + 0.1], [PX - PW / 2 + 0.1, PZ + PD / 2 - 0.3]], PH, { h: 0.7 });
  railing([[PX - PW / 2 + 0.1, PZ - PD / 2 + 0.1], [PX + PW / 2 - 0.1, PZ - PD / 2 + 0.1]], PH, { h: 0.7 });
  for (let k = 0; k < 3; k++) box(0.9, PH - k * 0.23, 0.35, conc, PX + PW / 2 + 0.45, 0, PZ + 0.5 - k * 0.0 + (k - 1) * 0.0, { dirtH: 0.3 });
  box(0.8, 0.6, 0.7, M.wood, PX - 0.6, PH, PZ + 0.1, { dirt: 0.3 });
  box(0.6, 0.45, 0.55, M.wood, PX + 0.4, PH, PZ - 0.1, { dirt: 0.3 });
  for (const x of [PX - 0.6]) for (const y of [PH + 0.2, PH + 0.42]) box(0.82, 0.04, 0.72, gunD, x, y, PZ + 0.1, { dirt: 0 });
  ao(0, ZT, 3.4, 3.4, 0.35); ao(MX, MZ, MW, MD, 0.4); ao(PX, PZ, PW, PD, 0.35);
}
