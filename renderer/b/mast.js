// The Mooring Mast: a small building (one tile, the usual pad) at each end of an Airship line (b/airship.js). A design
// study in three directions to match the airship's three; not installed. `v=` picks the direction:
//   a  Lattice mast: a tall three-legged steel lattice round a lift shaft, a gallery and a winch room at the top
//      under the mooring cup; a winch house and a loading dock with crates at its foot.
//   b  Gantry mast: a container-crane portal in faded yellow, its crossbeam carrying the mooring cup and a hoist
//      trolley with a container on its spreader; crane rails, a control cab and a container stack at its foot.
//   c  Armoured pylon: a faceted concrete column banded in armour, a fuel line up its side, an armoured clamp head;
//      a bunkered loading bay with a lit blast door and a cargo lift at its foot.
// Building camera, pad and sun as every building; powered-realism lights (b/powerkit.js). The mooring cup's top is
// solved to sit on the image's centre line, 8 % from the top edge, like the Ropeway's bull wheel, and marked 'head'.
// dock=1: a presentation view (not a game sprite): the same mast with its airship moored, on open ground, framed
// wide (1600 x 1000) at the same 57 degree angle.
import { power } from './powerkit.js';
import { buildAirship, DOCK } from './airship.js';
const Q = new URLSearchParams(location.search), DOCKED = Q.get('dock') === '1';
export const config = DOCKED ? { w: 1600, h: 1000 } : {};

export default function (L) {
  const { M, THREE } = L;
  const v = Q.get('v') || 'a';
  L.seed(5150 + v.charCodeAt(0));
  const P = power(L);

  // ---- replica of the shared building camera, to solve the head's height
  const ELEV = 57 * Math.PI / 180, cam = new THREE.PerspectiveCamera(20, 1, 0.5, 200);
  {
    const D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
    let Pc = new THREE.Vector3(0, 0, 0).sub(D.clone().multiplyScalar(40));
    const BL = new THREE.Vector3(-5.06, -0.6, 5.06), BR = new THREE.Vector3(5.06, -0.6, 5.06);
    const pr = (q) => { const r = q.clone().project(cam); return [(r.x + 1) / 2, (1 - r.y) / 2]; };
    for (let i = 0; i < 80; i++) {
      cam.position.copy(Pc); cam.lookAt(Pc.clone().add(D)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const a = pr(BL), b = pr(BR); Pc.add(D.clone().multiplyScalar((0.75 - (b[0] - a[0])) * 20)); Pc.add(U.clone().multiplyScalar((0.96 - a[1]) * 8));
    }
  }
  const projY = (y, z) => { const q = new THREE.Vector3(0, y, z).project(cam); return (1 - q.y) / 2; };
  const ZT = -1.3;
  let lo = 2, hi = 30;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (projY(m, ZT) > 0.08) lo = m; else hi = m; }
  const HY = (lo + hi) / 2;

  const head = ({ a: latticeMast, b: gantryMast, c: armouredPylon }[v] || latticeMast)(L, P, HY, ZT);
  L.mark('head', ...head);
  if (DOCKED) moor(L, v, head);
}

// the mooring cup: a turntable, an open steel cone on top (its rim at y), a lit ring round the rim
function cup(L, P, x, y, z, o = {}) {
  const { cyl, hoop, M, THREE } = L;
  const steel = M.plain('#626970', 0.3, 0.85), gunD = M.paint('#3f4449', { rivets: false });
  cyl(0.42, 0.3, gunD, x, y - 0.85, z, { seg: o.seg ?? 24, dirt: 0 });
  cyl(0.2, 0.2, steel, x, y - 0.55, z, { seg: 16, dirt: 0 });
  const g = new THREE.CylinderGeometry(0.58, 0.2, 0.42, o.seg ?? 24, 1, true); g.translate(0, 0.21, 0);
  L.mesh(g, steel, x, y - 0.42, z, { dirt: 0 }).material.side = THREE.DoubleSide;
  hoop(0.58, 0.05, P.glowHi, x, y, z, { cast: false });
}
// red aviation light on a short stalk
function avLight(L, x, y, z) { L.cyl(0.035, 0.3, L.M.plain('#23272b', 0.4, 0.7), x, y, z, { seg: 8, dirt: 0 }); L.sphere(0.1, L.M.emit('#ff3a22', 2.4), x, y + 0.36, z, { cast: false }); }

// ------------------------------------------------------------------------------------------------- a: lattice mast
function latticeMast(L, P, HY, ZT) {
  const { box, cyl, hcyl, beam, sphere, ao, ladder, railing, pipe, hoop, M, THREE } = L;
  const PI = Math.PI, gun = M.paint('#50565c'), gunD = M.paint('#3f4449', { rivets: false }), conc = M.rough('#8f887c');
  const wall = M.ribbed('#a39c90'), off = M.paint('#c9c5ba'), steel = M.plain('#626970', 0.3, 0.85);
  // the footing: an octagonal plinth with a hazard band
  cyl(1.8, 0.5, conc, 0, 0, ZT, { seg: 8, dirtH: 0.5 });
  cyl(1.82, 0.14, M.hazard, 0, 0.3, ZT, { seg: 8, dirt: 0, open: true });
  // the lattice: three legs tapering to the gallery, ring beams and X-bracing on each face
  const Y0 = 0.5, Y1 = HY - 1.75, B0 = 1.4, B1 = 0.55, TH = [PI / 6, (5 * PI) / 6, (3 * PI) / 2];
  const leg = (k, y) => { const b = B0 + (B1 - B0) * ((y - Y0) / (Y1 - Y0)); return [Math.cos(TH[k]) * b, y, ZT + Math.sin(TH[k]) * b]; };
  for (let k = 0; k < 3; k++) { beam(leg(k, Y0), leg(k, Y1), 0.2, 0.2, gun); box(0.45, 0.22, 0.45, gunD, leg(k, Y0)[0], Y0, leg(k, Y0)[2], { dirt: 0 }); }
  const NP = 8, lv = []; for (let i = 0; i <= NP; i++) lv.push(Y0 + 0.2 + (Y1 - Y0 - 0.2) * (i / NP) ** 0.92);
  for (let i = 0; i <= NP; i++) for (let k = 0; k < 3; k++) {
    const k2 = (k + 1) % 3; beam(leg(k, lv[i]), leg(k2, lv[i]), 0.09, 0.09, gunD);
    if (i < NP) { beam(leg(k, lv[i]), leg(k2, lv[i + 1]), 0.06, 0.06, gun); beam(leg(k2, lv[i]), leg(k, lv[i + 1]), 0.06, 0.06, gun); }
  }
  // the lift shaft up the middle, lit collars on it; a cargo cage halfway up the front face
  cyl(0.3, Y1 - Y0, off, 0, Y0, ZT, { seg: 20, dirtH: 3 });
  for (let y = Y0 + 1.4; y < Y1 - 0.5; y += 1.6) cyl(0.33, 0.07, P.glowSoft, 0, y, ZT, { seg: 20, dirt: 0, cast: false });
  { const cy = Y0 + (Y1 - Y0) * 0.42, cz = ZT + 0.62;
    box(0.8, 0.9, 0.7, gunD, 0, cy, cz, { dirt: 0.2 }); box(0.86, 0.06, 0.76, gun, 0, cy + 0.9, cz, { dirt: 0 });
    box(0.62, 0.5, 0.04, M.grille('#3d4247'), 0, cy + 0.2, cz + 0.36, { dirt: 0 });
    box(0.5, 0.05, 0.05, P.glow, 0, cy + 0.8, cz + 0.37, { dirt: 0, cast: false });
    for (const s of [-1, 1]) pipe([[s * 0.25, cy + 0.96, cz], [s * 0.1, Y1 - 0.1, ZT + 0.3]], 0.018, P.dark); }
  ladder(0.42, Y0, Y1 - 0.1, ZT - 0.35, { ry: 0 });
  // the gallery: a round grating deck with railings, aviation lights at its rail
  cyl(1.25, 0.22, gunD, 0, Y1 - 0.22, ZT, { seg: 32, dirt: 0 });
  cyl(1.22, 0.02, M.grating, 0, Y1, ZT, { seg: 32, dirt: 0 });
  for (let k = 0; k < 14; k++) { const a = (k / 14) * PI * 2; box(0.06, 0.6, 0.06, M.paint('#c49a2c', { rivets: false }), Math.cos(a) * 1.18, Y1, ZT + Math.sin(a) * 1.18, { dirt: 0 }); }
  hoop(1.18, 0.04, M.paint('#c49a2c', { rivets: false }), 0, Y1 + 0.6, ZT); hoop(1.18, 0.03, M.paint('#c49a2c', { rivets: false }), 0, Y1 + 0.3, ZT);
  hoop(1.26, 0.035, P.glow, 0, Y1 - 0.12, ZT, { cast: false });
  // the winch room over the gallery: a drum of a room with a band of lit windows, the cup on its roof
  const RH = 0.75;
  cyl(0.62, RH, gun, 0, Y1, ZT, { seg: 16, dirt: 0.2 });
  for (let k = 0; k < 8; k++) { const a = (k / 8) * PI * 2 + PI / 8; box(0.26, 0.18, 0.03, P.warm, Math.cos(a) * 0.63, Y1 + 0.38, ZT + Math.sin(a) * 0.63, { ry: -a + PI / 2, dirt: 0, cast: false }); }
  cyl(0.7, 0.08, gunD, 0, Y1 + RH, ZT, { seg: 16, dirt: 0 });
  cup(L, P, 0, Y1 + RH + 1.0, ZT);
  for (const a of [PI * 0.25, PI * 0.75, PI * 1.5]) avLight(L, Math.cos(a) * 1.18, Y1 + 0.6, ZT + Math.sin(a) * 1.18);
  // at the foot: the winch house (west) with its drum and the hoist cable up the tower, the loading dock (east)
  const HX = -2.85, HZ = 2.2;
  box(2.5, 0.16, 2.2, conc, HX, 0, HZ, { dirtH: 0.2 });
  box(2.3, 1.6, 2.0, wall, HX, 0.16, HZ, { dirtH: 1 });
  box(2.5, 0.12, 2.2, gunD, HX, 1.76, HZ, { dirt: 0 });
  box(1.9, 0.03, 1.7, M.plain('#4b5157', 0.8), HX, 1.88, HZ, { dirt: 0 });
  P.windows(1.5, 0.3, HX + 0.1, 1.15, HZ + 1.01, 0, 3);
  box(0.6, 1.1, 0.05, gunD, HX - 0.75, 0.16, HZ + 1.01, { dirt: 0 }); box(0.75, 0.07, 0.07, M.hazard, HX - 0.75, 1.3, HZ + 1.02, { dirt: 0 });
  P.strip(2.2, HX, 1.68, HZ + 1.03);
  cyl(0.15, 0.12, gunD, HX + 0.8, 1.88, HZ - 0.5, { seg: 16, dirt: 0 }); P.beacon(HX + 0.8, 2.05, HZ - 0.5);
  hcyl(0.42, 1.2, off, HX + 1.9, 0.62, HZ - 1.6, { axis: 'z' });                                    // the winch drum
  for (let k = 0; k < 5; k++) { hoop(0.43, 0.025, gunD, HX + 1.9, 0.62, HZ - 2.1 + k * 0.25).rotation.x = PI / 2; }
  box(0.5, 0.35, 1.5, gunD, HX + 1.9, 0, HZ - 1.6, { dirt: 0 });
  pipe([[HX + 1.9, 1.04, HZ - 1.6], [leg(1, Y0 + 1)[0] + 0.1, Y0 + 1.2, leg(1, Y0 + 1)[2]], [0.15, Y1 - 0.2, ZT + 0.2]], 0.025, P.dark);
  // the loading dock: a raised deck with a hazard edge, crates, a pallet jack and railings
  const DX = 2.55, DZ = 2.35, DW = 3.6, DD = 2.6, DH = 0.6;
  box(DW, DH, DD, conc, DX, 0, DZ, { dirtH: 0.5 });
  box(DW, 0.04, DD, M.plain('#5c6166', 0.8), DX, DH, DZ, { dirt: 0 });
  box(DW, 0.03, 0.22, M.hazard, DX, DH + 0.01, DZ + DD / 2 - 0.11, { dirt: 0, cast: false });
  railing([[DX + DW / 2 - 0.1, DZ - DD / 2 + 0.1], [DX + DW / 2 - 0.1, DZ + DD / 2 - 0.3]], DH, { h: 0.6 });
  box(0.7, 0.6, 0.7, M.wood, DX - 0.6, DH, DZ - 0.3, { dirt: 0.2 }); box(0.55, 0.45, 0.55, M.wood, DX - 0.55, DH + 0.6, DZ - 0.3, { dirt: 0.2 });
  box(0.75, 0.55, 0.65, M.wood, DX + 0.35, DH, DZ - 0.45, { dirt: 0.2 });
  box(1.2, 0.08, 0.9, M.wood, DX + 0.3, DH, DZ + 0.55, { dirt: 0.2 }); box(1.0, 0.5, 0.75, M.paint('#7d4b36', { rivets: false }), DX + 0.3, DH + 0.08, DZ + 0.55, { dirt: 0.3 });
  for (let k = 0; k < 3; k++) box(0.9, DH - k * 0.2, 0.35, conc, DX - DW / 2 - 0.45, 0, DZ + 0.6 - k * 0.36, { dirtH: 0.3 });
  P.strip(DW - 0.2, DX, DH + 0.06, DZ + DD / 2 + 0.01);
  P.flood(DX + 1.5, DZ - 1.5, 2.0, PI * 0.75);
  P.junction(3.6, -3.2, 0); P.conduit([[3.6, 0.5, -3.0], [3.6, 0.5, -2.0], [1.2, 0.5, -1.4]], 0.05);
  ao(0, ZT, 3.2, 3.2, 0.5); ao(HX, HZ, 2.4, 2.1, 0.45); ao(DX, DZ, DW, DD, 0.45);
  return [0, Y1 + RH + 1.0, ZT];
}

// -------------------------------------------------------------------------------------------------- b: gantry mast
function gantryMast(L, P, HY, ZT) {
  const { box, cyl, hcyl, beam, sphere, ao, ladder, railing, pipe, hoop, M, THREE } = L;
  const PI = Math.PI, gun = M.paint('#50565c'), gunD = M.paint('#3f4449', { rivets: false }), conc = M.rough('#8f887c');
  const yel = M.paint('#b08a30', { rivets: false }), yelD = M.paint('#8e6f26', { rivets: false }), steel = M.plain('#626970', 0.3, 0.85);
  const LX = 3.1, Y1 = HY - 1.65;
  // the crane rails, under each leg front to back
  for (const s of [-1, 1]) { box(0.5, 0.12, 9.2, conc, s * LX, 0, 0, { dirtH: 0.1 }); for (const d of [-0.12, 0.12]) box(0.08, 0.1, 9.2, steel, s * LX + d, 0.12, 0, { dirt: 0 }); }
  // the legs: box sections on wheeled bogies, hazard bands at the foot, a team strip up the front face
  for (const s of [-1, 1]) {
    box(0.8, 0.45, 1.6, gunD, s * LX, 0.15, ZT, { dirt: 0.3 });
    for (const dz of [-0.55, 0.55]) hcyl(0.2, 0.3, M.plain('#26282b', 0.6, 0.5), s * LX, 0.32, ZT + dz, { axis: 'x' });
    box(0.62, Y1 - 0.6, 0.62, yel, s * LX, 0.6, ZT, { dirtH: 2.5 });
    box(0.66, 0.5, 0.66, M.hazard, s * LX, 0.6, ZT, { dirt: 0 });
    box(0.06, Y1 - 2.0, 0.06, P.glow, s * LX, 1.4, ZT + 0.33, { dirt: 0, cast: false });
    beam([s * LX, Y1 - 2.6, ZT], [s * 1.2, Y1 - 0.05, ZT], 0.3, 0.3, yelD);                   // knee braces
    ladder(s * (LX - 0.45), 0.6, Y1 - 0.1, ZT - 0.2, { ry: 0 });
  }
  // the crossbeam: a box girder with walkways along it, team strips, aviation lights at its ends
  box(LX * 2 + 1.0, 0.75, 0.9, yel, 0, Y1 - 0.6, ZT, { dirt: 0.2, dirtH: 0.8 });
  box(LX * 2 + 1.0, 0.04, 0.9, M.grating, 0, Y1 + 0.15, ZT, { dirt: 0 });
  for (const s of [-1, 1]) { box(LX * 2 + 0.9, 0.05, 0.05, P.glow, 0, Y1 - 0.22, ZT + s * 0.47, { dirt: 0, cast: false }); avLight(L, s * (LX + 0.4), Y1 + 0.15, ZT); }
  railing([[-LX - 0.4, ZT + 0.42], [LX + 0.4, ZT + 0.42]], Y1 + 0.15, { h: 0.45, spacing: 0.9 });
  // the head: the turntable and mooring cup on the crossbeam's middle, the machinery house beside it
  cyl(0.55, 0.5, gun, 0, Y1 + 0.15, ZT, { seg: 20, dirt: 0 });
  cup(L, P, 0, Y1 + 1.65, ZT);
  box(1.1, 0.7, 0.8, gun, -1.6, Y1 + 0.15, ZT, { dirt: 0.2 }); box(1.2, 0.06, 0.9, gunD, -1.6, Y1 + 0.85, ZT, { dirt: 0 });
  P.windows(0.9, 0.22, -1.6, Y1 + 0.45, ZT + 0.41, 0, 2);
  // the hoist trolley on the beam, its cables down to a spreader with a container on it
  const TX = 1.55, CY = Y1 * 0.42;
  box(1.2, 0.45, 1.2, gunD, TX, Y1 - 1.05, ZT, { dirt: 0 }); box(1.0, 0.06, 0.05, P.amber, TX, Y1 - 0.85, ZT + 0.62, { dirt: 0, cast: false });
  for (const [dx, dz] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]]) pipe([[TX + dx * 0.5, Y1 - 1.05, ZT + dz * 0.5], [TX + dx, CY + 1.55, ZT + dz]], 0.02, P.dark);
  box(2.0, 0.16, 1.0, yelD, TX, CY + 1.4, ZT, { dirt: 0 });
  box(2.2, 1.3, 1.0, M.ribbed('#4f5f66'), TX, CY, ZT, { dirtH: 1 });
  for (const s of [-1, 1]) box(0.08, 1.3, 1.04, M.plain('#2b3439', 0.7, 0.3), TX + s * 1.06, CY, ZT, { dirt: 0 });
  // the control cab on the west leg, lit, a team strip under its windows
  { const cx = -LX + 0.85, cy = Y1 - 2.3;
    box(1.1, 0.95, 1.2, gun, cx, cy, ZT + 0.1, { dirt: 0.2 }); box(1.2, 0.06, 1.3, gunD, cx, cy + 0.95, ZT + 0.1, { dirt: 0 });
    P.windows(0.9, 0.4, cx, cy + 0.45, ZT + 0.71, 0, 2); P.strip(1.0, cx, cy + 0.22, ZT + 0.73); }
  // at the foot: a stack of containers, a gate booth, a floodlight and power
  const stack = [['#7d4b36', 1.8, 2.55, 0], ['#94763d', 1.8, 2.55, 1.3], ['#5e6b4c', -1.3, 2.9, 0]];
  for (const [hex, x, z, y] of stack) { box(2.4, 1.3, 1.1, M.ribbed(hex), x, y, z, { dirtH: 1, ry: 0 }); for (const s of [-1, 1]) box(0.08, 1.32, 1.14, M.plain('#2b2a28', 0.7, 0.3), x + s * 1.17, y, z, { dirt: 0 }); }
  box(1.0, 1.2, 0.9, M.ribbed('#a39c90'), -1.2, 0, 1.0, { dirtH: 1 }); box(1.1, 0.08, 1.0, gunD, -1.2, 1.2, 1.0, { dirt: 0 });
  P.windows(0.8, 0.28, -1.2, 0.75, 1.46, 0, 2); P.beacon(-0.85, 1.36, 0.75);
  box(9.4, 0.03, 0.18, M.hazard, 0, 0.0, 3.95, { dirt: 0, cast: false });
  P.flood(-3.9, 3.6, 2.0, PI * 0.8); P.junction(3.9, -3.7, 0);
  ao(0, ZT, 7.5, 1.6, 0.4); ao(1.8, 2.55, 2.4, 1.1, 0.4);
  return [0, Y1 + 1.65, ZT];
}

// ------------------------------------------------------------------------------------------------ c: armoured pylon
function armouredPylon(L, P, HY, ZT) {
  const { box, cyl, hcyl, beam, sphere, ao, ladder, railing, pipe, hoop, M, THREE } = L;
  const PI = Math.PI, gun = M.paint('#50565c'), gunD = M.paint('#3f4449', { rivets: false }), conc = M.rough('#8f887c'), concD = M.rough('#7a746a');
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), steel = M.plain('#626970', 0.3, 0.85);
  const fuel = M.emit('#ff9a3c', 2.2);
  const Y1 = HY - 1.95, R0 = 1.55, R1 = 0.95, RY = PI / 6;                       // a face of the hexagon toward the camera
  // the column: a tapering hexagonal concrete shaft on a stepped footing
  cyl(2.0, 0.35, concD, 0, 0, ZT, { seg: 6, ry: RY, dirtH: 0.3 });
  cyl(R0, Y1 - 0.35, conc, 0, 0.35, ZT, { seg: 6, rTop: R1, ry: RY, dirtH: 2 });
  const rAt = (y) => R0 + (R1 - R0) * ((y - 0.35) / (Y1 - 0.35));
  // armour bands, a hazard band, team strips up the two front faces
  for (const y of [1.6, Y1 * 0.5, Y1 - 0.9]) cyl(rAt(y) + 0.08, 0.45, armor, 0, y, ZT, { seg: 6, rTop: rAt(y + 0.45) + 0.08, ry: RY, dirt: 0.2 });
  cyl(rAt(0.4) + 0.03, 0.3, M.hazard, 0, 0.4, ZT, { seg: 6, rTop: rAt(0.7) + 0.03, ry: RY, dirt: 0 });
  for (const a of [PI / 2 - PI / 6, PI / 2 + PI / 6]) {
    const ap = (y) => { const r = rAt(y) * Math.cos(PI / 6) + 0.02; return [Math.cos(a) * r, y, ZT + Math.sin(a) * r]; };
    beam(ap(2.2), ap(Y1 * 0.5 - 0.1), 0.07, 0.07, P.glow, { cast: false }); beam(ap(Y1 * 0.5 + 0.55), ap(Y1 - 1.0), 0.07, 0.07, P.glow, { cast: false });
  }
  // the fuel line up the east face: a pipe with glowing Fuel-orange collars, from a tank and pump at the foot
  { const a = PI / 2 - PI / 2.2, fp = (y, d = 0.18) => { const r = rAt(y) * Math.cos(PI / 6) + d; return [Math.cos(a) * r, y, ZT + Math.sin(a) * r]; };
    const pts = [[3.3, 0.55, 1.0], [2.0, 0.55, 0.6], fp(0.9), fp(Y1 - 0.2)];
    pipe(pts, 0.09, M.paint('#6b5a3a', { rivets: false }));
    for (let y = 1.2; y < Y1 - 0.4; y += 1.2) { const q = fp(y, 0.18); cyl(0.13, 0.08, fuel, q[0], q[1], q[2], { seg: 12, dirt: 0, cast: false }); }
    hcyl(0.55, 1.8, M.paint('#8a7f6c'), 3.3, 0.75, 1.6, { axis: 'z' });
    for (const s of [-1, 1]) box(0.35, 0.25, 0.35, gunD, 3.3, 0, 1.6 + s * 0.6, { dirt: 0 });
    hoop(0.57, 0.04, M.hazard, 3.3, 0.75, 1.6).rotation.x = PI / 2;
    box(0.5, 0.6, 0.4, gun, 2.4, 0, 1.6, { dirt: 0.3 }); box(0.12, 0.12, 0.03, fuel, 2.4, 0.42, 1.81, { dirt: 0, cast: false }); }
  // the head: an armoured octagonal clamp block, plated, a team band, the mooring cup on top, aviation lights
  cyl(1.25, 1.0, top, 0, Y1, ZT, { seg: 8, rTop: 1.05, ry: PI / 8, dirt: 0.2 });
  cyl(1.3, 0.12, armor, 0, Y1 + 0.35, ZT, { seg: 8, ry: PI / 8, dirt: 0 });
  cyl(1.27, 0.05, P.glow, 0, Y1 + 0.18, ZT, { seg: 8, ry: PI / 8, dirt: 0, cast: false });
  for (let k = 0; k < 4; k++) { const a = PI / 4 + (k * PI) / 2; box(0.35, 0.8, 0.35, armor, Math.cos(a) * 1.05, Y1 + 0.85, ZT + Math.sin(a) * 1.05, { ry: -a, dirt: 0 }); }
  cyl(1.05, 0.12, gunD, 0, Y1 + 1.0, ZT, { seg: 8, ry: PI / 8, dirt: 0 });
  cup(L, P, 0, Y1 + 1.95, ZT, { seg: 8 });
  for (const a of [PI * 0.25, PI * 0.75, PI * 1.25, PI * 1.75]) avLight(L, Math.cos(a) * 1.05, Y1 + 1.65, ZT + Math.sin(a) * 1.05);
  P.windows(0.9, 0.18, 0, Y1 + 0.62, ZT + 1.13, 0, 3);
  // the loading bay at the foot (west): a bunker with a lit blast door, blast walls, a cargo lift plate before it
  const BX = -2.6, BZ = 1.8;
  box(3.0, 1.5, 2.4, conc, BX, 0, BZ, { dirtH: 1 });
  box(3.2, 0.25, 2.6, concD, BX, 1.5, BZ, { dirt: 0.3 });
  box(1.0, 0.35, 0.8, gun, BX - 0.7, 1.75, BZ - 0.4, { dirt: 0.2 }); box(0.8, 0.04, 0.6, M.grille('#3d4247'), BX - 0.7, 2.1, BZ - 0.4, { dirt: 0 });
  box(0.7, 0.12, 0.7, armor, BX + 0.8, 1.75, BZ - 0.2, { dirt: 0 }); box(0.5, 0.03, 0.5, M.hazard, BX + 0.8, 1.87, BZ - 0.2, { dirt: 0 });
  P.strip(3.1, BX, 1.78, BZ + 1.31);
  box(1.5, 1.05, 0.06, M.emit('#ffe2b0', 0.55), BX + 0.2, 0, BZ + 1.21, { dirt: 0, cast: false });                  // the lit bay inside
  for (const s of [-1, 1]) box(0.25, 1.25, 0.3, armor, BX + 0.2 + s * 0.88, 0, BZ + 1.22, { dirt: 0 });
  box(2.0, 0.22, 0.3, M.hazard, BX + 0.2, 1.05, BZ + 1.22, { dirt: 0 });
  P.strip(2.6, BX, 1.42, BZ + 1.22); P.beacon(BX - 1.2, 1.85, BZ + 0.9);
  box(2.0, 0.08, 1.6, M.plain('#5c6166', 0.8), BX + 0.2, 0, BZ + 2.15, { dirt: 0 });                              // the lift plate
  for (const [dx, dz, w, d] of [[0, -0.78, 2.0, 0.06], [0, 0.78, 2.0, 0.06], [-0.98, 0, 0.06, 1.6], [0.98, 0, 0.06, 1.6]]) box(w, 0.02, d, M.hazard, BX + 0.2 + dx, 0.08, BZ + 2.15 + dz, { dirt: 0, cast: false });
  box(0.8, 0.55, 0.7, M.wood, BX + 0.0, 0.08, BZ + 2.2, { dirt: 0.2 });
  box(0.45, 1.0, 1.8, concD, BX - 1.9, 0, BZ + 1.7, { dirtH: 0.8 });                                            // blast walls
  box(1.8, 1.0, 0.45, concD, 1.0, 0, 3.6, { dirtH: 0.8 });
  P.flood(3.9, 3.7, 2.0, PI * 0.8); P.junction(-3.9, -3.4, PI / 2);
  ao(0, ZT, 4, 4, 0.5); ao(BX, BZ, 3.0, 2.4, 0.45);
  return [0, Y1 + 1.95, ZT];
}

// --------------------------------------------------------------------------------------- dock=1: an airship moored
function moor(L, v, head) {
  const { THREE } = L;
  // open ground round the pad, so the ship's shadow has somewhere to fall
  { const g = new THREE.PlaneGeometry(140, 140); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 35, uv.getY(i) * 35);
    L.mesh(g, L.M.rough('#9a7656'), 0, -0.3, 0, { dirt: 0, cast: false }).userData.ground = true; }
  // the ship: its nose cone in the cup, streaming away to the east and back (downwind), hull level
  const S = L.group(); buildAirship(L, v, S);
  const ry = Math.PI + 0.42, d = DOCK[v];
  S.rotation.y = ry; S.updateMatrixWorld(true);
  const tip = new THREE.Vector3(...d).applyEuler(new THREE.Euler(0, ry, 0));
  S.position.set(head[0] - tip.x, head[1] + 0.05 - tip.y, head[2] - tip.z);
  // a wider sun shadow box, and a camera framed on everything at the buildings' angle
  L.getScene().traverse((o) => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -34; c.right = c.top = 34; c.far = 140; c.updateProjectionMatrix(); o.shadow.mapSize.set(4096, 4096); } });
  L.getRoot().updateMatrixWorld(true);
  const bb = new THREE.Box3(); L.getRoot().traverse((o) => { if (o.isMesh && !o.userData.decal && !o.userData.ground) bb.expandByObject(o); });
  const ELEV = 57 * Math.PI / 180, D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV));
  const cam = new THREE.PerspectiveCamera(20, 1.6, 0.5, 400), C = bb.getCenter(new THREE.Vector3());
  const corners = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let dist = 80, off = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    cam.position.copy(C).add(off).sub(D.clone().multiplyScalar(dist)); cam.lookAt(cam.position.clone().add(D)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1; for (const c of corners) { const q = c.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const span = Math.max((x1 - x0) / 2, (y1 - y0) / 2), right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(right, D).normalize();
    dist *= 1 + (span / 0.93 - 1) * 0.5;
    off.add(right.multiplyScalar(((x0 + x1) / 2) * dist * 0.15)).add(up.multiplyScalar(((y0 + y1) / 2) * dist * 0.09));
  }
  L.useCamera(cam);
}
