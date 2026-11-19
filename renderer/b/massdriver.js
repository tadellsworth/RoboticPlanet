// The Mass Driver and its Catcher (IDEAS.md "High-speed transit", the owner's look A, "Coil Ramp", Nov 2026).
//   c=driver (default)  the Mass Driver, two tiles long on a 2 x 1 pad (20 x 10 world units): a concrete ramp carrying a
//                       coil-gun rail of eleven copper coil rings up to a flared muzzle, a breech house with a canister
//                       hopper at its foot, capacitor banks along its flanks cabled up to the coils' yokes, a rack of
//                       sealed canisters waiting. dir=e|w|n|s: the way the rail points (on the map: e is east, s is
//                       down the screen): an east-west Driver fires e or w, a north-south one n or s, toward its
//                       Catcher. Framed wide (frameCompound: the pad's 20 units across 0.85 of the frame, about 2.48
//                       tiles), the world origin (the middle of the two tiles) on the frame's anchor. Marks: 'breech',
//                       'muzzle' and 'c0'..'c10' (each coil's centre), for the coils lighting in sequence, the arcs
//                       along the rail and the canister leaving it.
//   c=catcher           the Catcher: a wide steel funnel cradle on a concrete plinth with copper braking rings in its
//                       throat and four magnetic arms on legs round it. arms=open (waiting: swung up and out) or
//                       arms=closed (swung in over the funnel, their magnet heads lit, as a canister lands). Mark 'cradle'.
// Powered realism (b/powerkit.js): team strips, floodlights, a beacon; the coils' inner bands and the magnet heads glow
// pale blue-white after dark (and by day only faintly, unlit), as the owner asked: night glow on the coils.
import { power } from './powerkit.js';
const Q = new URLSearchParams(location.search);
const C = Q.get('c') || 'driver', DIR = Q.get('dir') || 'e', ARMS = Q.get('arms') || 'open';
const PI = Math.PI;
export const DIRS = { e: 0, s: PI / 2, w: PI, n: -PI / 2 };
export const config = C === 'catcher' ? {} : { pad: false };
export const FRAME = { half: 10.12, width: 0.85, cy: 0.57 };

export default function (L) {
  L.seed(7300 + (C === 'driver' ? Object.keys(DIRS).indexOf(DIR) : 40));
  const P = power(L), T = mats(L, P);
  if (C === 'catcher') catcher(L, P, T, ARMS === 'closed');
  else { const ns = DIR === 'n' || DIR === 's'; L.longPad(ns ? 10 : 20, ns ? 20 : 10); L.frameCompoundOpts(FRAME); driver(L, P, T, DIRS[DIR] ?? 0); }
}

function mats(L, P) {
  const { M } = L, dark = L.TOD === 'night' || L.TOD === 'evening';
  return {
    conc: M.rough('#9a9285'), concD: M.rough('#827b70'), concL: M.rough('#aaa294'), gun: M.paint('#50565c'), gunD: M.paint('#3c4146', { rivets: false }),
    steel: M.plain('#646b72', 0.32, 0.85), dark: M.plain('#1b1d20', 0.6, 0.3), copper: M.plain('#b8672c', 0.32, 0.9), copperD: M.plain('#8a4a20', 0.4, 0.85),
    white: M.paint('#d6d2c8', { rivets: false }), olive: M.paint('#5d6247'),
    // the coils' inner bands and the magnet faces: a pale ceramic by day, glowing blue-white once the lights come on
    band: dark ? M.emit('#bfe3ff', L.TOD === 'night' ? 1.6 : 0.9) : M.plain('#c9d6df', 0.4, 0.1),
    face: dark ? M.emit('#cfeaff', L.TOD === 'night' ? 2.2 : 1.2) : M.plain('#aebdc8', 0.35, 0.3),
    red: M.emit('#ff3a22', 2.4), nc: { dirt: 0, cast: false },
  };
}

// a sealed cargo canister lying along x in group g: a pale capsule with two team bands and a handling ring
function canister(L, P, T, g, x, y, z, len = 1.1, r = 0.24, ry = 0) {
  const { THREE } = L, cg = new THREE.Group(); cg.position.set(x, y, z); cg.rotation.y = ry; g.add(cg);
  const body = new THREE.CylinderGeometry(r, r, len - 2 * r * 0.6, 20, 1); body.rotateZ(PI / 2);
  L.mesh(body, T.white, 0, 0, 0, { parent: cg, dirt: 0.15, dirtH: 0.4 });
  for (const s of [-1, 1]) {
    const cap = new THREE.SphereGeometry(r, 20, 10, 0, PI * 2, 0, PI / 2); cap.scale(0.6, 1, 1); cap.rotateZ(-s * PI / 2);
    L.mesh(cap, T.white, s * (len / 2 - r * 0.6), 0, 0, { parent: cg, dirt: 0.15 });
    const band = new THREE.CylinderGeometry(r + 0.012, r + 0.012, 0.07, 20, 1, true); band.rotateZ(PI / 2);
    L.mesh(band, P.glow, s * len * 0.22, 0, 0, { parent: cg, ...T.nc });
  }
  const ring = new THREE.TorusGeometry(r + 0.02, 0.025, 6, 24); ring.rotateY(PI / 2);
  L.mesh(ring, T.gunD, 0, 0, 0, { parent: cg, dirt: 0 });
  return cg;
}

// ================================================================================================= the Mass Driver
function driver(L, P, T, th) {
  const { box, cyl, beam, pipe, sphere, ao, mesh, group, pointLight, THREE, M } = L;
  const G = group(0, 0, 0, -th);
  const O = (e = {}) => ({ parent: G, ...e });
  ao(0, 0, 18.5, 8.5, 0.35);

  // ---- the ramp: a concrete wedge rising from the breech to the muzzle, with buttresses down its flanks
  const X0 = -9.3, X1 = 8.9, BX = -7.6, BY = 1.4, MX = 9.2, MY = 7.6, A = Math.atan2(MY - BY, MX - BX), HW = 1.45;
  const lineY = (x) => BY + (x - BX) * Math.tan(A) - 0.55; // the top of the concrete under the deck
  {
    const s = new THREE.Shape();
    s.moveTo(X0, 0); s.lineTo(X1, 0); s.lineTo(X1, lineY(X1)); s.lineTo(BX - 0.2, lineY(BX - 0.2)); s.lineTo(X0, lineY(BX - 0.2)); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 2 * HW, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
    g.translate(0, 0, -HW);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    mesh(g, T.concL, 0, 0, 0, O({ dirt: 0.35, dirtH: 1.6 }));
    // pour lines down its flanks, and a recessed panel
    for (let x = -6.6 + 0.67; x < X1 - 0.6; x += 1.35) for (const sz of [-1, 1]) box(0.05, Math.max(0.2, lineY(x) - 0.5), 0.02, T.concD, x, 0.25, sz * (HW + 0.07), O(T.nc));
    for (const sz of [-1, 1]) box(X1 - X0 - 0.6, 0.06, 0.03, T.concD, (X0 + X1) / 2, 0.75, sz * (HW + 0.07), O(T.nc));
    // formwork lines and the buttresses
    for (let x = -6.6; x < X1 - 0.3; x += 1.35) {
      const h = lineY(x) - 0.15;
      for (const sz of [-1, 1]) {
        const b = new THREE.Shape(); b.moveTo(-0.2, 0); b.lineTo(0.2, 0); b.lineTo(0.2, h); b.lineTo(-0.2, h * 0.9); b.closePath();
        const bg = new THREE.ExtrudeGeometry(b, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
        bg.translate(x, 0, sz > 0 ? HW - 0.05 : -HW - 0.4);
        mesh(bg, T.concD, 0, 0, 0, O({ dirt: 0.6, dirtH: 1.0 }));
      }
    }
    box(X1 - X0 + 0.4, 0.22, 2 * HW + 1.0, T.concD, (X0 + X1) / 2, 0, 0, O({ dirt: 0.7, dirtH: 0.3 }));   // the footing
    box(X1 - X0 + 0.42, 0.06, 0.16, M.hazard, (X0 + X1) / 2, 0.22, HW + 0.43, O({ dirt: 0 }));
    box(X1 - X0 + 0.42, 0.06, 0.16, M.hazard, (X0 + X1) / 2, 0.22, -HW - 0.43, O({ dirt: 0 }));
  }

  // ---- the rail: a pitched group from the breech; x runs up the rail, y off the deck
  const R = new THREE.Group(); R.position.set(BX, BY, 0); R.rotation.z = A; G.add(R);
  const RO = (e = {}) => ({ parent: R, ...e }), LEN = Math.hypot(MX - BX, MY - BY);
  box(LEN + 1.1, 0.3, 2.3, T.gunD, LEN / 2 - 0.25, -0.62, 0, RO({ dirt: 0.2 }));                             // the deck
  for (const s of [-1, 1]) {
    box(LEN + 1.1, 0.07, 0.07, P.glow, LEN / 2 - 0.25, -0.5, s * 1.16, RO(T.nc));                              // team strips along it
    box(LEN + 0.8, 0.16, 0.14, T.steel, LEN / 2, -0.32, s * 0.3, RO({ dirt: 0 }));                              // the guide rails
    for (let x = 0.4; x < LEN; x += 0.8) box(0.08, 0.2, 0.2, T.gunD, x, -0.34, s * 0.3, RO({ dirt: 0 }));     // their chairs
  }
  box(LEN + 0.6, 0.05, 0.36, T.dark, LEN / 2, -0.33, 0, RO(T.nc));                                             // the stator slot
  // the coils: copper windings round the rail on steel yokes, an inner band that glows at night
  const NC = 11, coilX = (k) => 1.0 + k * (LEN - 1.5) / (NC - 1), CY = 0.24, CR = 0.66;
  for (let k = 0; k < NC; k++) {
    const x = coilX(k);
    for (const dx of [-0.17, -0.06, 0.06, 0.17]) { const g = new THREE.TorusGeometry(CR, 0.075, 10, 40); g.rotateY(PI / 2); mesh(g, dx * dx > 0.01 ? T.copperD : T.copper, x + dx, CY, 0, RO({ dirt: 0 })); }
    { const g = new THREE.TorusGeometry(CR - 0.1, 0.045, 8, 40); g.rotateY(PI / 2); mesh(g, T.band, x, CY, 0, RO(T.nc)); }
    { const g = new THREE.TorusGeometry(CR + 0.1, 0.05, 8, 40); g.rotateY(PI / 2); mesh(g, T.gun, x, CY, 0, RO({ dirt: 0 })); }  // the clamp band
    box(0.34, 0.55, 1.5, T.gun, x, -0.48, 0, RO({ dirt: 0.2 }));                                                // the yoke
    box(0.36, 0.08, 0.5, T.dark, x, CY + CR + 0.08, 0, RO({ dirt: 0 }));                                         // a busbar clamp on top
    L.mark('c' + k, x, CY, 0, R);
  }
  // the muzzle: a flared steel throat with a team-light ring and hazard band, a red light on top
  {
    const g = new THREE.CylinderGeometry(0.62, 0.86, 0.6, 32, 1, true); g.rotateZ(-PI / 2);
    const m = mesh(g, T.gun, LEN + 0.05, CY, 0, RO({ dirt: 0.1 })); m.material = T.gun.clone(); m.material.side = THREE.DoubleSide;
    const r1 = new THREE.TorusGeometry(0.86, 0.06, 8, 40); r1.rotateY(PI / 2); mesh(r1, P.glow, LEN + 0.36, CY, 0, RO(T.nc));
    const r2 = new THREE.CylinderGeometry(0.66, 0.66, 0.14, 32, 1, true); r2.rotateZ(PI / 2); mesh(r2, M.hazard, LEN - 0.32, CY, 0, RO({ dirt: 0 }));
    box(0.5, 0.75, 1.6, T.gun, LEN - 0.3, -0.5, 0, RO({ dirt: 0.2 }));
    cyl(0.03, 0.3, T.dark, LEN - 0.3, CY + 0.66, 0, RO({ seg: 8, dirt: 0 }));
    sphere(0.08, T.red, LEN - 0.3, CY + 1.0, 0, RO({ cast: false }));
  }
  L.mark('muzzle', LEN + 0.4, CY, 0, R);
  // the breech house: a squat armoured block over the rail's foot, a hopper on its roof, a lit loading hatch
  {
    const hx = -0.55;
    box(1.6, 1.25, 2.2, T.gun, hx, -0.7, 0, RO({ dirt: 0.45 }));
    box(1.7, 0.12, 2.3, T.gunD, hx, 0.55, 0, RO({ dirt: 0 }));
    const hop = new THREE.CylinderGeometry(0.7, 0.32, 0.7, 4, 1, true); hop.rotateY(PI / 4);
    const hm = mesh(hop, T.olive, hx, 0.67, 0, RO({ dirt: 0.3 })); hm.material = T.olive.clone(); hm.material.side = THREE.DoubleSide;
    box(0.06, 0.06, 2.24, P.glow, hx + 0.81, 0.2, 0, RO(T.nc));
    for (const s of [-1, 1]) box(0.9, 0.5, 0.04, P.warm, hx, -0.15, s * 1.12, RO(T.nc));
  }
  L.mark('breech', 0, CY, 0, R);
  // a canister seated in the breech, its nose in the first coil
  canister(L, P, T, R, 0.35, CY, 0, 1.0, 0.22);

  // ---- capacitor banks down both flanks at the low end, cabled up to the coils' yokes
  R.updateMatrixWorld(true); G.updateMatrixWorld(true);
  const toW = (o, x, y, z) => { const v = new THREE.Vector3(x, y, z); o.localToWorld(v); return [v.x, v.y, v.z]; };
  for (const s of [-1, 1]) {
    const z = s * 2.85;
    box(7.6, 0.3, 1.0, T.concD, -4.4, 0, z, O({ dirt: 0.6, dirtH: 0.3 }));
    for (let k = 0; k < 6; k++) {
      const x = -7.6 + k * 1.3;
      cyl(0.36, 1.05, M.ribbed('#7b8288'), x, 0.3, z, O({ seg: 20 }));
      cyl(0.38, 0.08, T.gunD, x, 1.35, z, O({ seg: 20, dirt: 0 }));
      cyl(0.1, 0.22, M.plain('#d9d2c2', 0.4, 0), x, 1.43, z, O({ seg: 10, dirt: 0 }));     // insulator
      sphere(0.08, P.glow, x, 1.7, z, O({ cast: false }));
    }
    // cables: from each bank up to every other coil's yoke
    for (let k = 1; k < NC; k += 2) {
      const a = toW(G, -7.0 + 1.05 * Math.min(k, 6), 0.32, z * 0.85), b = toW(R, coilX(k), -0.5, s * 0.78), m = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) + 0.05, (a[2] + b[2]) / 2];
      pipe([a, [a[0], a[1] + 0.05, a[2]], m, b], 0.045, T.dark);
    }
  }
  // the canister rack at the breech end: three sealed canisters waiting to be loaded
  {
    const rx = -9.0, rz = 0;
    box(0.9, 0.18, 1.9, T.gunD, rx + 0.1, 0.22, rz, O({ dirt: 0.2 }));
    for (let k = 0; k < 3; k++) canister(L, P, T, G, rx + 0.1, 0.62, rz - 0.6 + k * 0.6, 0.95, 0.22, PI / 2);
  }
  // lights: a floodlight on the breech house, a lamp at the muzzle's foot
  const fl = toW(G, -6.0, 2.6, -1.6);
  pointLight('#fff1d6', L.TOD === 'night' ? 6 : 2, fl[0], fl[1], fl[2], 6);
  const mz = toW(R, LEN, 0.8, 0);
  pointLight('#bfe3ff', L.TOD === 'night' ? 5 : L.TOD === 'evening' ? 2.5 : 0, mz[0], mz[1], mz[2], 4);
  for (let k = 0; k < NC; k += 2) { const p = toW(R, coilX(k), CY, 0); if (L.TOD === 'night') pointLight('#bfe3ff', 2.2, p[0], p[1] + 0.3, p[2], 2.5); }
}

// ================================================================================================= the Catcher
function catcher(L, P, T, closed) {
  const { box, cyl, sphere, hoop, mesh, group, ao, pointLight, pipe, THREE, M } = L;
  ao(0, 0, 8.5, 8.5, 0.4);
  // the plinth: an octagonal concrete drum, a hazard ring, team light round its lip
  cyl(3.9, 0.55, T.concD, 0, 0, 0, { seg: 8, dirtH: 0.5 });
  cyl(3.92, 0.12, M.hazard, 0, 0.3, 0, { seg: 8, dirt: 0, open: true });
  cyl(3.3, 0.35, T.conc, 0, 0.55, 0, { seg: 8, dirtH: 0.3 });
  hoop(3.35, 0.05, P.glow, 0, 0.9, 0, { cast: false });
  // the funnel: a wide steel cone on a ring of struts, ribbed, its rim lit, dark inside
  const FY0 = 1.05, FY1 = 2.75, R0 = 1.05, R1 = 3.15;
  {
    const g = new THREE.CylinderGeometry(R1, R0, FY1 - FY0, 40, 4, true); g.translate(0, (FY1 - FY0) / 2, 0);
    const m = mesh(g, M.paint('#59606a'), 0, FY0, 0, { dirt: 0.25, dirtH: 1.2 }); m.material = m.material.clone(); m.material.side = THREE.DoubleSide;
    const gi = new THREE.CylinderGeometry(R1 - 0.12, R0 - 0.06, FY1 - FY0 - 0.05, 40, 1, true); gi.translate(0, (FY1 - FY0) / 2, 0);
    const mi = mesh(gi, M.grating, 0, FY0 + 0.04, 0, { dirt: 0 }); mi.material = mi.material.clone(); mi.material.side = THREE.BackSide;
    hoop(R1, 0.11, T.gun, 0, FY1, 0);
    hoop(R1 + 0.02, 0.045, P.glow, 0, FY1 + 0.1, 0, { cast: false });
    for (let k = 0; k < 12; k++) {                                                                                 // ribs down its outside
      const a = k * PI / 6, c = Math.cos(a), s = Math.sin(a);
      pipe([[c * (R1 + 0.06), FY1, s * (R1 + 0.06)], [c * (R0 + 0.08), FY0, s * (R0 + 0.08)]], 0.06, T.gunD);
    }
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8, c = Math.cos(a), s = Math.sin(a); pipe([[c * 2.9, 0.9, s * 2.9], [c * 1.9, FY0 + 0.75, s * 1.9]], 0.08, T.steel); }   // struts
    // the throat: copper braking rings, glowing bands, a buffer pad at the bottom
    cyl(R0 + 0.15, FY0 - 0.85, T.gun, 0, 0.85, 0, { seg: 32, dirt: 0.2 });
    for (let k = 0; k < 3; k++) { hoop(R0 - 0.05 + k * 0.28, 0.07, T.copper, 0, FY0 + 0.12 + k * 0.4, 0); hoop(R0 - 0.12 + k * 0.28, 0.03, T.band, 0, FY0 + 0.12 + k * 0.4, 0, { cast: false }); }
    cyl(R0 - 0.15, 0.1, T.dark, 0, FY0 - 0.02, 0, { seg: 32, dirt: 0 });
  }
  L.mark('cradle', 0, FY0 + 0.3, 0);
  // the four magnetic arms, on legs at the corners: swung up and out (waiting) or in over the funnel (catching)
  const PR = 4.15, PY = 2.15, BL = 3.45, pitch = closed ? 0.42 : 1.72;
  for (let k = 0; k < 4; k++) {
    const a = PI / 4 + k * PI / 2, c = Math.cos(a), s = Math.sin(a);
    // the leg and its pivot housing
    cyl(0.42, 0.4, T.concD, c * PR, 0, s * PR, { seg: 8, dirtH: 0.3 });
    cyl(0.24, PY - 0.4, T.gun, c * PR, 0.4, s * PR, { seg: 12, dirtH: 0.8 });
    const Y = group(c * PR, PY, s * PR, -a + PI);            // local +x toward the funnel's axis
    box(0.7, 0.55, 0.62, T.gunD, 0, -0.28, 0, { parent: Y, dirt: 0.2 });
    const Hc = new THREE.CylinderGeometry(0.2, 0.2, 0.74, 16); Hc.rotateX(PI / 2); mesh(Hc, T.steel, 0, 0, 0, { parent: Y, dirt: 0 });
    const Bm = new THREE.Group(); Bm.rotation.z = pitch; Y.add(Bm);
    box(BL, 0.26, 0.3, M.paint('#b08a30', { rivets: false }), BL / 2, -0.13, 0, { parent: Bm, dirt: 0.15 });  // the boom
    box(BL - 0.4, 0.05, 0.05, P.glow, BL / 2, 0.14, 0, { parent: Bm, ...T.nc });
    box(0.22, 0.3, 0.34, M.hazard, BL * 0.25, -0.15, 0, { parent: Bm, dirt: 0 });
    // the hydraulic ram from the leg to the boom
    // (a short steel strut under the boom; fixed in the boom's frame, so it reads in both poses)
    box(1.2, 0.12, 0.12, T.steel, 0.6, -0.42, 0.18, { parent: Bm, dirt: 0 });
    // the electromagnet head, its face turned down and in
    const Hd = new THREE.Group(); Hd.position.set(BL, 0, 0); Hd.rotation.z = -pitch - 0.25; Bm.add(Hd);
    const hd = new THREE.CylinderGeometry(0.5, 0.56, 0.36, 24); mesh(hd, T.gunD, 0, -0.2, 0, { parent: Hd, dirt: 0.1 });
    const ring = new THREE.TorusGeometry(0.5, 0.06, 8, 24); ring.rotateX(PI / 2); mesh(ring, T.copper, 0, -0.1, 0, { parent: Hd, dirt: 0 });
    const fc = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24); mesh(fc, T.face, 0, -0.4, 0, { parent: Hd, ...T.nc });
    if (closed || L.TOD === 'night') { Hd.updateMatrixWorld(true); const v = new THREE.Vector3(0, -0.7, 0); Hd.localToWorld(v); pointLight('#cfeaff', closed ? 3.5 : 1.2, v.x, v.y, v.z, 3); }
  }
  // a control cabin at the front, a junction box, a floodlight pole
  box(1.5, 0.95, 0.9, T.olive, -2.75, 0.55, 3.45, { dirt: 0.4 }); box(1.6, 0.1, 1.0, T.gunD, -2.75, 1.5, 3.45, { dirt: 0 });
  box(1.0, 0.3, 0.04, P.warm, -2.75, 1.0, 3.91, T.nc);
  P.junction(2.9, 3.3, 0.3);
  cyl(0.05, 3.8, T.gunD, 3.6, 0.55, -3.0, { seg: 10 }); box(0.45, 0.25, 0.2, T.gun, 3.6, 4.35, -2.9, { dirt: 0 }); box(0.38, 0.18, 0.03, P.white, 3.6, 4.38, -2.79, T.nc);
  pointLight('#fff1d6', L.TOD === 'night' ? 5 : 1.5, 3.0, 3.5, -1.6, 6);
  sphere(0.09, T.red, 3.6, 4.7, -2.9, { cast: false });
  if (L.TOD === 'night') pointLight('#bfe3ff', 3, 0, FY0 + 0.6, 0, 3.5);
}
