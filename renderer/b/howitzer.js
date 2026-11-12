// Howitzer, "Lancer" family: the self-propelled gun that replaces the Rocket Truck, on the same chassis and frame.
// Six wheels half hidden under armoured side skirts with team-colour light strips, the Lancer wedge cab up front
// (glowing sensor-slit eye, LED headlight bars, amber beacon), and on the rear deck a big angular gun house carrying
// a long thick howitzer barrel: cradle and recoil cylinders, fume extractor, a team-lit band and a double-baffle
// muzzle brake. Top-down, orthographic, facing +x, no ground (the game draws its shadow); 10 world units across the
// frame, the hull about 7.7 long and 3.2 wide (kit px: 1 px = 1/25.6 unit), the barrel overhanging the nose in travel.
//   ?part=drive  travelling: the barrel lowered and laid forward over the cab in its travel lock, legs stowed, spade up
//   ?part=up     dug in: the barrel raised steeply (about 41 degrees, the muzzle brake over the cab's prow), the
//                travel lock's clamp open and empty, four stabiliser legs out at the corners onto hazard-striped foot
//                pads, the toothed recoil spade down behind the hull
// Mark: muzzle (the centre of the barrel's mouth, in both poses).
import { lancer } from './lancertruck.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM, THREE } = L;
  const part = new URLSearchParams(location.search).get('part') || 'drive', up = part === 'up';
  L.seed(613);
  const V = lancer(L), { R, k, m, mir } = V, { rect, rr, poly, ext, disc, strip, tyre, grime, beamL, hazard, G } = R;
  const { armor, top, roof, dark, black, glow, steel, seam } = m;
  const team = M.emit(TEAM, 0.9), paintT = M.paint(TEAM, { rivets: false }), haz = hazard('#f0a030');
  const gun = M.plain('#757d85', 0.48, 0.4), gunD = M.plain('#25292d', 0.5, 0.6), brakeM = M.plain('#4a5158', 0.45, 0.6), pad = M.plain('#24272b', 0.7, 0.4);

  // ---- running gear: three axles a side (one under the cab, a close pair under the gun), outer half showing
  for (const x of [60, -26, -60]) for (const s of [-1, 1]) tyre(x, s * 36, 14, 16, { blocks: 14 });
  rect(-92, -22, 184, 44, 0.3, 0.45, dark, { dirt: 0 });                                   // chassis frame
  for (const s of [-1, 1]) {
    // armoured skirt over the inner half of the wheels, a team light strip along its top, panel seams across it
    ext(poly(mir([[86, 22], [78, 36], [-84, 36], [-94, 31], [-94, 22]], s)), 0.66, 0.54, armor, { bevel: 0.06 });
    strip(-84, s * 31.5, 72, s * 31.5, 3, 1.21, 0.02, glow);
    for (const x of [-43, 18]) strip(x, s * 28, x, s * 36, 1.5, 1.2, 0.01, seam);
  }

  // ---- the hull: armoured bed under the gun house, a deck plate, an ammunition hatch between gun house and cab
  ext(poly([[36, -28], [-88, -28], [-97, -20], [-97, 20], [-88, 28], [36, 28]]), 0.4, 0.95, armor, { bevel: 0.08 });
  ext(rr(-92, -24, 126, 48, 4), 1.35, 0.06, M.paint('#41474e'), { bevel: 0.02 });
  for (const x of [-30, 8]) strip(x, -24, x, 24, 1.5, 1.42, 0.01, seam);
  grime(-94, -28, 130, 56, 1.42, 0.8, 41);
  rect(10, -20, 20, 10, 1.41, 0.05, dark, { dirt: 0 });                                   // ammunition hatch (left of the barrel)
  for (const x of [13, 18, 23]) rect(x, -18, 3, 6, 1.46, 0.01, black, { dirt: 0, cast: false });
  rect(10, 11, 20, 9, 1.41, 0.08, gunD, { dirt: 0 });                                     // a tool box on the right
  rect(32, -26, 4, 52, 1.0, 0.5, seam, { dirt: 0 });                                       // the joint behind the cab
  // rear: lights in team colour, brake lenses
  for (const s of [-1, 1]) {
    rect(-99, s < 0 ? -30 : 25, 3, 5, 0.62, 0.32, glow, { dirt: 0, cast: false });
    V.brake(-99, s < 0 ? -19 : 13, 4, 6, 0.95);
  }
  // stabiliser leg housings at the four corners of the hull
  const LEGS = [[27, 1], [-89, -1]];                                                       // [x of the pivot, which way the leg swings]
  for (const [x] of LEGS) for (const s of [-1, 1]) {
    ext(rr(x - 7, s < 0 ? -31 : 21, 14, 10, 2), 1.0, 0.42, dark, { bevel: 0.03 });
    disc(x, s * 26, 3, 1.42, 0.06, steel);
  }

  // ---- the cab (shared Lancer cab), with its roof furniture kept clear of the barrel's line
  const C = V.cab({ x0: 36, xf: 100, xc: 89, hw: 30, nf: 18, y0: 0.4, yt: 1.62, roof: [42, -19, 30, 38] });
  const yr = C.yu + 0.07;
  V.hatch(67, 13, 6, yr);
  V.beacon(45, 15, yr);
  V.mast(70, -14, yr);

  // ---- the gun house: a big angular armoured box on the rear deck, wedge-faced toward the front
  const T0 = 1.3, TH = 1.0, TT = T0 + TH + 0.12;                                             // TT: top of the roof plate
  ext(poly([[-3, -13], [-14, -30], [-81, -30], [-93, -21], [-93, 21], [-81, 30], [-14, 30], [-3, 13]]), 1.38, 0.06, black, { bevel: 0.01, dirt: 0, cast: false }); // dark ring gap round its foot
  ext(poly([[-6, -12], [-16, -27], [-80, -27], [-90, -20], [-90, 20], [-80, 27], [-16, 27], [-6, 12]]), T0, TH, armor, { bevel: 0.08 });
  ext(poly([[-12, -10], [-20, -22], [-77, -22], [-84, -16], [-84, 16], [-77, 22], [-20, 22], [-12, 10]]), T0 + TH - 0.02, 0.14, roof, { bevel: 0.04 });
  for (const [a, b, c, d] of [[-50, -22, -50, 22], [-77, 0, -58, 0]]) strip(a, b, c, d, 1.6, TT + 0.005, 0.01, seam);
  grime(-84, -22, 72, 44, TT + 0.01, 0.7, 23);
  rect(-26, -8, 18, 16, TT - 0.02, 0.03, black, { dirt: 0, cast: false });                  // the slot the breech drops into
  // team chevrons across the back of the roof, pointing forward
  for (const x of [-80, -71]) for (const s of [-1, 1]) strip(x, s * 19, x + 7, s * 3, 4.5, TT + 0.005, 0.02, paintT);
  // ammunition bustle at the back: a vent grille
  rect(-89, -14, 5, 28, T0 + 0.3, 0.6, dark, { dirt: 0 });
  // roof furniture: commander's cupola with periscopes, loader's hatch, a sensor mast with a team eye
  disc(-40, 13, 7.5, TT, 0.14, top); L.hoop(7.5 * k, 0.025, steel, -40 * k, TT + 0.14, 13 * k, R.O());
  disc(-40, 13, 5, TT + 0.14, 0.04, M.plain('#2d3236', 0.55, 0.5));
  for (const [dx, dy] of [[6, 0], [3, 5], [3, -5]]) rect(-40 + dx - 1.5, 13 + dy - 1.5, 3, 3, TT + 0.14, 0.08, black, { dirt: 0 });
  V.hatch(-62, -11, 6, TT);
  V.mast(-42, -15, TT);
  // smoke dischargers on the front cheeks
  for (const s of [-1, 1]) for (const i of [0, 1, 2]) {
    const x = -14 - i * 4.5, y = s * (17 + i * 2.2);
    L.hcyl(1.8 * k, 7 * k, gunD, x * k, T0 + TH - 0.12, y * k, R.O({ axis: 'x', seg: 12, dirt: 0 }));
  }
  // the trunnion cheeks either side of the barrel, and the trunnion pin across them
  const TX = -18, HT = 2.58;                                                                // trunnion: x px, height
  for (const s of [-1, 1]) ext(rr(-30, s < 0 ? -20 : 14, 22, 6, 2), TT - 0.02, HT + 0.12 - TT, top, { bevel: 0.03 });
  L.hcyl(3.2 * k, 38 * k, steel, TX * k, HT, 0, R.O({ axis: 'z', seg: 16, dirt: 0 }));

  // ---- the gun: everything below rotates about the trunnion; local x along the barrel, local y up
  const th = up ? 0.72 : 0;                                                                // dug in: about 41 degrees
  const gg = L.group(TX * k, HT, 0, 0, G); gg.rotation.z = th;
  const P = (o = {}) => Object.assign({ parent: gg, dirt: 0 }, o);
  // mantlet: a chamfered armour block round the barrel's root
  ext(poly([[-10, -13], [6, -13], [13, -8], [13, 8], [6, 13], [-10, 13]]), -0.3, 0.6, armor, { parent: gg, bevel: 0.06, dirt: 0.2 });
  // cradle sleeve with two recoil cylinders along its top
  L.hcyl(9 * k, 30 * k, gunD, 26 * k, 0, 0, P({ seg: 28 }));
  for (const s of [-1, 1]) L.hcyl(2.6 * k, 34 * k, steel, 28 * k, 0.33, s * 5 * k, P({ seg: 14 }));
  // the tube, tapering slightly toward the muzzle
  const B0 = 40, B1 = 124;
  const tube = new THREE.CylinderGeometry(5.8 * k, 7.0 * k, (B1 - B0) * k, 32, 1); tube.rotateZ(-Math.PI / 2);
  L.mesh(tube, gun, (B0 + B1) / 2 * k, 0, 0, P());
  // fume extractor: a swelling a third of the way along
  const FE0 = 50, FE1 = 68;
  const fe = new THREE.CylinderGeometry(8.6 * k, 8.6 * k, (FE1 - FE0) * k, 32, 1); fe.rotateZ(-Math.PI / 2);
  L.mesh(fe, gun, (FE0 + FE1) / 2 * k, 0, 0, P());
  for (const [x, rT, rB] of [[FE0 - 1.25, 8.6, 6.8], [FE1 + 1.25, 6.6, 8.6]]) {
    const g = new THREE.CylinderGeometry(rT * k, rB * k, 2.5 * k, 32, 1); g.rotateZ(-Math.PI / 2); L.mesh(g, gun, x * k, 0, 0, P());
  }
  // team-lit band behind the muzzle brake
  L.hcyl(6.6 * k, 4 * k, team, 114 * k, 0, 0, P({ seg: 28, cast: false }));
  for (const x of [44, 96]) L.hcyl(7.2 * k, 2.5 * k, gunD, x * k, 0, 0, P({ seg: 28 }));     // clamp rings
  // double-baffle muzzle brake: two broad blocks with the bore showing between them, a dark mouth at the front
  const BW = 28;
  for (const [x0, x1] of [[120, 128.5], [131, 139]]) {
    L.box((x1 - x0) * k, 0.5, BW * k, brakeM, (x0 + x1) / 2 * k, -0.25, 0, P());
    for (const s of [-1, 1]) L.box((x1 - x0 + 0.4) * k, 0.3, 3 * k, black, (x0 + x1) / 2 * k, -0.15, s * (BW / 2 - 1.3) * k, P({ cast: false })); // side ports
  }
  L.hcyl(5.2 * k, 3 * k, gunD, 131 * k, 0, 0, P({ seg: 24 }));
  L.hcyl(4.2 * k, 0.6 * k, black, 139.2 * k, 0, 0, P({ seg: 24 }));
  L.mark('muzzle', 139.5 * k, 0, 0, gg);

  // elevating rams from the front of the gun house up to the cradle's belly
  gg.updateMatrixWorld(true); G.updateMatrixWorld(true);
  const toG = (x, y, z) => { const v = new THREE.Vector3(x * k, y, z * k); gg.localToWorld(v); return G.worldToLocal(v); };
  for (const s of [-1, 1]) {
    const A = [-6 * k, T0 + TH - 0.25, s * 9 * k], Bv = toG(34, -0.15, s * 9), B = [Bv.x, Bv.y, Bv.z];
    const M2 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, A[2]];
    beamL(A, M2, 0.17, 0.17, gunD, { dirt: 0 }); beamL(M2, B, 0.1, 0.1, steel, { dirt: 0 });
  }

  // ---- the travel lock on the back of the cab roof: a crutch whose clamp holds the barrel in travel (left open, empty, when dug in)
  const xl = 56, yb = C.yu + 0.07, yt = HT - 7.1 * k;                                       // yt: the barrel's underside over the lock
  for (const s of [-1, 1]) beamL([xl * k, yb, s * 14 * k], [xl * k, yt - 0.05, s * 6 * k], 0.12, 0.12, steel, { dirt: 0 });
  rect(xl - 3, -10, 6, 20, yt - 0.08, 0.08, dark, { dirt: 0 });                              // the saddle
  for (const s of [-1, 1]) rect(xl - 2.5, s * (up ? 11 : 9.5) - 1.5, 5, 3, yt - 0.08, 0.36, dark, { dirt: 0 }); // clamp jaws (swung open when dug in)

  // ---- the recoil spade: a toothed blade hinged under the tail, folded up in travel, dug into the ground behind
  const SPX = -95, SPH = 0.82, SL = 30;
  const sp = L.group(SPX * k, SPH, 0, 0, G); sp.rotation.z = up ? 0.64 : -1.45;
  const S = (o = {}) => Object.assign({ parent: sp, dirt: 0 }, o);
  L.hcyl(0.07, 48 * k, steel, 0, 0, 0, S({ axis: 'z', seg: 12 }));
  L.box(SL * k, 0.1, 50 * k, armor, -SL / 2 * k, -0.05, 0, S({ dirt: 0.3 }));
  for (const y of [-16, 0, 16]) L.box((SL - 4) * k, 0.1, 3 * k, dark, -(SL / 2 + 1) * k, 0.05, y * k, S());   // stiffening ribs
  L.box(7 * k, 0.012, 50 * k, haz, -3.5 * k, 0.05, 0, S({ cast: false }));                 // hazard band along the hinge
  for (let i = 0; i < 6; i++) {                                                             // teeth along the blade's edge
    const y = -21 + i * 8.4, tg = new THREE.ConeGeometry(3.4 * k, 5 * k, 4); tg.rotateZ(Math.PI / 2);
    L.mesh(tg, steel, -(SL + 2) * k, 0, y * k, S());
  }
  // the spade's two rams from the hull to the blade
  sp.updateMatrixWorld(true);
  const toS = (x, y, z) => { const v = new THREE.Vector3(x * k, y, z * k); sp.localToWorld(v); return G.worldToLocal(v); };
  for (const s of [-1, 1]) {
    const A = [-90 * k, 1.25, s * 20 * k], Bv = toS(-24, 0.1, s * 20), B = [Bv.x, Bv.y, Bv.z];
    const M2 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2];
    beamL(A, M2, 0.14, 0.14, gunD, { dirt: 0 }); beamL(M2, B, 0.08, 0.08, steel, { dirt: 0 });
  }

  // ---- dug in: four stabiliser legs swung out at the corners onto foot pads
  if (up) for (const [x, d] of LEGS) for (const s of [-1, 1]) {
    const fx = x + d * 13, fy = s * 58;
    const A = [x * k, 1.3, s * 26 * k], F = [fx * k, 0.66, fy * k], at = t => A.map((a, i) => a + (F[i] - a) * t);
    beamL(A, F, 0.34, 0.26, armor, { dirt: 0.2 });
    // a team light strip along the leg's top
    const up1 = p => [p[0], p[1] + 0.145, p[2]];
    beamL(up1(at(0.2)), up1(at(0.8)), 0.09, 0.03, team, { dirt: 0, cast: false });
    // foot: a square pad with a hazard-striped top and a steel jack standing on it
    ext(rr(fx - 9, fy - 9, 18, 18, 3), 0.02, 0.14, pad, { bevel: 0.03, dirt: 0.5 });
    ext(rr(fx - 7, fy - 7, 14, 14, 2), 0.16, 0.02, haz, { bevel: 0.005, cast: false });
    disc(fx, fy, 4.2, 0.14, 0.62, steel);
    disc(fx, fy, 5.4, 0.7, 0.1, dark);
  }

  V.finish(part);
}
