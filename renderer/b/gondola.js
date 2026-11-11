// Ropeway cargo gondola, "powered realism" restyle (design study for b/gondola.js). The same grip clamp with carrier
// wheels at the top centre (where the cable passes, 8 % from the top edge), bent steel hanger arm and yoke, and
// open-topped steel cargo cabin with its crate rack (the game draws the load at the cabin's top). Weathered plated
// steel, with lights and power added: a band of lit windows round the upper cabin walls, a team-colour light strip
// round the cabin's waist, team lights on the yoke ends, an amber beacon on the grip and a white work light under it.
// Building camera angle (57 degrees, FOV 20) and sun; no pad, no ground. Cabin = 45 % of the image width.
import { power } from './powerkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, sphere, group, M, THREE, TEAM } = L;
  L.seed(1313);
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449'), off = M.paint('#c9c5ba'), steelP = M.paint('#5a6066', { panelW: 128 });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.55).getHexString(), { rivets: false });
  const PK = power(L), glow = PK.glow, warm = M.emit('#ffc27a', 0.95), mull = M.plain('#1b1d20', 0.6, 0.3);

  // ---- grip clamp (cable runs along x through y = 0)
  const GY = 0;
  box(0.9, 0.26, 0.42, gunD, 0, GY - 0.36, 0, { dirt: 0 });                            // grip body
  for (const s of [-1, 1]) {                                                             // carrier wheels either side of the clamp
    const w = new THREE.CylinderGeometry(0.17, 0.17, 0.1, 24); w.rotateX(Math.PI / 2);
    mesh(w, M.steel, s * 0.3, GY, 0.1, { dirt: 0 }); mesh(w, M.steel, s * 0.3, GY, -0.1, { dirt: 0 });
    box(0.12, 0.3, 0.32, gun, s * 0.3, GY - 0.25, 0, { dirt: 0 });
  }
  for (const s of [-1, 1]) box(0.5, 0.2, 0.06, gun, 0, GY - 0.2, s * 0.13, { dirt: 0 });   // jaws
  box(0.22, 0.04, 0.44, M.hazard, 0, GY - 0.12, 0, { dirt: 0 });
  box(0.16, 0.12, 0.3, M.paint('#d0a536', { rivets: false }), 0.38, GY - 0.48, 0, { dirt: 0 });   // release lever
  box(0.12, 0.1, 0.12, gunD, -0.5, GY - 0.36, 0.12, { dirt: 0 }); PK.beacon(-0.5, GY - 0.2, 0.12, '#ffb347');   // amber beacon on the grip

  // ---- hanger arm: a C-shaped steel arm stepping out and back down, then a yoke over the cabin
  const HY0 = GY - 0.36, KX = 0.42, YK = -3.9;
  beam([0, HY0, 0], [KX, HY0 - 0.35, 0], 0.16, 0.16, gun);
  beam([KX, HY0 - 0.35, 0], [KX, YK + 0.3, 0], 0.16, 0.16, gun);
  beam([KX, YK + 0.3, 0], [0, YK, 0], 0.16, 0.16, gun);
  cyl(0.12, 0.25, gunD, 0, YK - 0.18, 0, { seg: 16, dirt: 0 });                          // swivel
  const CW = 1.15, CD = 0.78, CH = 1.1, CT = YK - 0.45;                                   // cabin half sizes, rim height
  beam([-CW + 0.05, CT, 0], [CW - 0.05, CT, 0], 0.14, 0.14, gun);                         // yoke bar
  beam([-0.6, CT + 0.05, 0], [0, YK - 0.15, 0], 0.1, 0.1, gun); beam([0.6, CT + 0.05, 0], [0, YK - 0.15, 0], 0.1, 0.1, gun);
  for (const s of [-1, 1]) { box(0.14, 0.4, 0.3, gunD, s * (CW - 0.05), CT - 0.3, 0, { dirt: 0 }); box(0.06, 0.06, 0.2, PK.glowHi, s * (CW + 0.03), CT + 0.0, 0, { dirt: 0, cast: false }); }

  // ---- open-topped cabin
  const Y0 = CT - CH, t = 0.07;
  box(CW * 2, 0.08, CD * 2, steelP, 0, Y0, 0, { dirt: 0.3 });
  box(CW * 2, CH, t, steelP, 0, Y0, CD - t / 2, { dirt: 0.5, dirtH: 0.8 });
  box(CW * 2, CH, t, steelP, 0, Y0, -CD + t / 2, { dirt: 0.5, dirtH: 0.8 });
  box(t, CH, CD * 2, steelP, CW - t / 2, Y0, 0, { dirt: 0.5, dirtH: 0.8 });
  box(t, CH, CD * 2, steelP, -CW + t / 2, Y0, 0, { dirt: 0.5, dirtH: 0.8 });
  // top rim, corner posts, ribs
  for (const s of [-1, 1]) { box(CW * 2 + 0.06, 0.07, 0.1, gun, 0, CT - 0.04, s * (CD - 0.02), { dirt: 0 }); box(0.1, 0.07, CD * 2 + 0.06, gun, s * (CW - 0.02), CT - 0.04, 0, { dirt: 0 }); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.12, CH + 0.02, 0.12, gunD, sx * (CW - 0.03), Y0, sz * (CD - 0.03), { dirt: 0 });
  // a band of lit windows round the upper walls (four panes a side between the ribs, two at each end)
  const WY = CT - 0.42, WH = 0.26;
  for (const s of [-1, 1]) {
    box(CW * 2 - 0.12, WH + 0.06, 0.02, mull, 0, WY - 0.03, s * (CD + 0.01), { dirt: 0, cast: false });
    for (const x of [-0.82, -0.28, 0.28, 0.82]) box(0.4, WH, 0.025, warm, x, WY, s * (CD + 0.02), { dirt: 0, cast: false });
    box(0.02, WH + 0.06, CD * 2 - 0.12, mull, s * (CW + 0.01), WY - 0.03, 0, { dirt: 0, cast: false });
    for (const z of [-0.33, 0.33]) box(0.025, WH, 0.5, warm, s * (CW + 0.02), WY, z, { dirt: 0, cast: false });
  }
  for (const x of [-0.55, 0, 0.55]) for (const s of [-1, 1]) box(0.06, CH - 0.1, 0.05, gun, x, Y0 + 0.05, s * (CD + 0.03), { dirt: 0 });
  // the team light strip round the waist, on a painted band
  for (const s of [-1, 1]) {
    box(CW * 2 + 0.02, 0.14, 0.02, team, 0, Y0 + 0.3, s * (CD + 0.04), { dirt: 0 });
    box(CW * 2 - 0.06, 0.045, 0.02, glow, 0, Y0 + 0.345, s * (CD + 0.055), { dirt: 0, cast: false });
    box(0.02, 0.14, CD * 2 + 0.02, team, s * (CW + 0.04), Y0 + 0.3, 0, { dirt: 0 });
    box(0.02, 0.045, CD * 2 - 0.06, glow, s * (CW + 0.055), Y0 + 0.345, 0, { dirt: 0, cast: false });
  }
  box(CW * 2 + 0.1, 0.05, 0.14, M.hazard, 0, Y0 - 0.02, CD - 0.05, { dirt: 0 });
  box(0.3, 0.08, 0.2, gunD, 0, Y0 - 0.1, 0, { dirt: 0 }); box(0.22, 0.02, 0.14, PK.white, 0, Y0 - 0.12, 0, { dirt: 0, cast: false });   // work light under the floor
  // crate rack inside: a low steel frame with two crates
  for (const x of [-0.7, 0.05, 0.75]) box(0.06, 0.45, CD * 2 - 0.25, gunD, x, Y0 + 0.08, 0, { dirt: 0 });
  box(1.6, 0.05, CD * 2 - 0.25, gun, 0.02, Y0 + 0.5, 0, { dirt: 0 });
  box(0.62, 0.42, 0.62, M.wood, -0.35, Y0 + 0.55, -0.2, { dirt: 0.2 });
  box(0.5, 0.36, 0.5, M.wood, 0.42, Y0 + 0.55, 0.15, { dirt: 0.2 });
  for (const [x, z, w] of [[-0.35, -0.2, 0.64], [0.42, 0.15, 0.52]]) box(w, 0.035, 0.07, gunD, x, Y0 + 0.75, z, { dirt: 0 });
  box(0.38, 0.3, 0.38, M.paint('#8a6a3a', { rivets: false }), 0.65, Y0 + 0.08, -0.4, { dirt: 0.2 });

  // ---- camera: same elevation and FOV as the buildings; solved so the cabin spans 45 % and the grip sits at 8 %
  const ELEV = 57 * Math.PI / 180, cam = new THREE.PerspectiveCamera(20, 1, 0.5, 200);
  const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
  const pr = v => { const q = v.clone().project(cam); return [(q.x + 1) / 2, (1 - q.y) / 2]; };
  let P = new THREE.Vector3(0, Y0 + CH / 2, 0).sub(D.clone().multiplyScalar(30));
  const A = new THREE.Vector3(-CW, CT, CD), B = new THREE.Vector3(CW, CT, CD), G = new THREE.Vector3(0, GY, 0);
  for (let i = 0; i < 200; i++) {
    cam.position.copy(P); cam.lookAt(P.clone().add(D)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    const w = pr(B)[0] - pr(A)[0], gy = pr(G)[1];
    P.add(D.clone().multiplyScalar((0.45 - w) * 25)); P.add(U.clone().multiplyScalar((0.08 - gy) * 6));
  }
  L.useCamera(cam);
}
