// The Lance of Corvane (IDEAS.md "Megastructures", the owner's look A, "Gun Emplacement", Nov 2026): a planet-scale
// laser cannon in a 3 x 3 concrete gun pit (30 x 30 world units, the middle of its nine tiles at the origin), rendered
// in layers on one wide frame (FRAME: the pad's 30 units across 0.62 of it, about 4.8 tiles), like the Flak Gun.
//   ?part=base            the pit: an eight-sided earth-and-concrete berm with a team band and lights round its crest,
//                         the pit floor with the turntable race (a hazard ring, its bolt circle and the rail it rolls
//                         on), four capacitor banks in the corners outside the berm cabled in over it, a coolant plant
//                         at the back, a fire-control bunker at the front left with lit slits, floodlights, beacons.
//                         The turntable itself is EMPTY.
//   ?part=head&rot=k&n=N  the gun alone on its turntable deck: two armoured trunnion cheeks, a finned breech housing
//                         with its cable bundles, the long barrel raised 11 degrees with eight ceramic charge rings
//                         along it (dark: the game draws their glow as it charges), cooling fins, and the focusing
//                         head at the muzzle round a Ring Crystal lens. Turned to direction k of N (0 = east, then
//                         clockwise seen from above). No team colour on the head. Marks: 'breech', 'r0'..'r7' (the
//                         rings' centres), 'muzzle' (the lens).
import { power } from './powerkit.js';
const Q = new URLSearchParams(location.search);
const PART = Q.get('part') || 'base', ROT = +(Q.get('rot') || 0), NR = +(Q.get('n') || 16);
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, hcyl, hoop, sphere, mesh, group, mark, ao, pointLight, pipe, beam, M, THREE } = L;
  L.seed(7710 + (PART === 'head' ? ROT : 99));
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.56 });
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#9a9285'), concD: M.rough('#7f786c'), concL: M.rough('#aba395'), earth: M.rough('#7d6a52'),
    gun: M.paint('#4c5258', { metal: 0.45, rough: 0.5 }), gunD: M.paint('#363a3f', { rivets: false, metal: 0.5 }), armor: M.paint('#555c55'),
    olive: M.paint('#5b6045'), steel: M.steel, dark: M.dark, chrome: M.chrome,
    copper: M.plain('#b06a32', 0.35, 0.9), copperD: M.plain('#7e4a22', 0.45, 0.85),
    ceramic: M.plain('#d9d3c4', 0.45, 0.05), ring: M.plain('#3a3330', 0.55, 0.3),
    lens: M.crystal('#bfefff', '#cff6ff', dark ? 1.8 : 0.9), white: M.paint('#d8d3c6', { rivets: false }),
    red: M.emit('#ff3a22', 2.4), nc: { dirt: 0, cast: false },
  };
  const FLOOR = 0.12;

  // =============================================================================================== the base: the pit
  const base = group(0, 0, 0, 0), B = { parent: base };
  {
    ao(0, 0, 27, 27, 0.4);
    // the pit floor: a big concrete disc, scored in pours
    cyl(12.6, FLOOR, T.concD, 0, 0, 0, { seg: 8, ry: PI / 8, dirt: 0.5, ...B });
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; box(12, 0.02, 0.06, T.dark, Math.cos(a) * 6, FLOOR, Math.sin(a) * 6, { ry: -a, ...T.nc, ...B }); }
    // the turntable race: a hazard ring, the rail, the bolt circle, and the empty turntable well
    const haz = new THREE.RingGeometry(6.4, 7.1, 64); haz.rotateX(-PI / 2); mesh(haz, M.hazard, 0, FLOOR + 0.006, 0, { ...T.nc, ...B });
    hoop(6.15, 0.12, T.steel, 0, FLOOR + 0.1, 0, B);
    hoop(5.6, 0.1, T.steel, 0, FLOOR + 0.08, 0, B);
    for (let k = 0; k < 48; k++) { const a = k * PI / 24; cyl(0.09, 0.08, T.chrome, Math.cos(a) * 5.88, FLOOR, Math.sin(a) * 5.88, { seg: 8, dirt: 0, ...B }); }
    cyl(5.5, 0.05, T.dark, 0, FLOOR, 0, { seg: 64, ...T.nc, ...B });
    // the berm: an eight-sided wall of packed earth faced in concrete, sloping out, with a crest walk
    const berm = new THREE.CylinderGeometry(11.6, 13.6, 2.2, 8, 1, true); berm.translate(0, 1.1, 0); berm.rotateY(PI / 8);
    const bm = mesh(berm, T.conc, 0, 0, 0, { dirt: 0.7, dirtH: 2.2, ...B }); bm.material = T.conc.clone(); bm.material.side = THREE.DoubleSide;
    const inner = new THREE.CylinderGeometry(10.9, 10.9, 2.2, 8, 1, true); inner.translate(0, 1.1, 0); inner.rotateY(PI / 8);
    const im = mesh(inner, T.concL, 0, 0, 0, { dirt: 0.5, dirtH: 2.2, ...B }); im.material = T.concL.clone(); im.material.side = THREE.DoubleSide;
    const top = new THREE.RingGeometry(10.9, 11.6, 8, 1); top.rotateX(-PI / 2); top.rotateY(PI / 8);
    mesh(top, T.concD, 0, 2.2, 0, { dirt: 0.2, ...B });
    // buttresses down the outer face, and a step in the berm at the front for the crew
    for (let k = 0; k < 16; k++) {
      const a = k * PI / 8 + PI / 16, r = 12.7;
      box(0.7, 1.9, 1.3, T.concD, Math.cos(a) * r, 0, Math.sin(a) * r, { ry: -a, dirt: 0.6, ...B });
    }
    // the gun crew's ramp down into the pit (front right), and a steel gate frame
    box(2.4, 0.06, 3.0, M.grating, 8.6, 2.2, 8.6, { ry: -PI / 4, dirt: 0, ...B });
  }
  // ---- capacitor banks in the four corners outside the berm, cabled in over the crest
  const banks = [[-12.4, -12.4], [12.4, -12.4], [-12.4, 12.4], [12.4, 12.4]];
  for (const [x, z] of banks) {
    box(3.6, 0.3, 3.6, T.concD, x, 0, z, { dirt: 0.6, ...B });
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]]) {
      cyl(0.62, 2.3, M.ribbed('#7b8288'), x + dx, 0.3, z + dz, { seg: 22, ...B });
      cyl(0.66, 0.12, T.gunD, x + dx, 2.6, z + dz, { seg: 22, dirt: 0, ...B });
      cyl(0.12, 0.3, T.ceramic, x + dx, 2.72, z + dz, { seg: 10, dirt: 0, ...B });
    }
    // a busbar frame over the bank and a fat cable over the berm toward the turntable
    box(2.4, 0.12, 0.2, T.copper, x, 3.05, z, { dirt: 0, ...B }); box(0.2, 0.12, 2.4, T.copper, x, 3.05, z, { dirt: 0, ...B });
    const ix = x * 0.72, iz = z * 0.72;
    pipe([[x, 3.1, z], [x * 0.88, 3.3, z * 0.88], [x * 0.8, 2.55, z * 0.8], [ix, 1.2, iz], [x * 0.5, 0.3, z * 0.5]], 0.17, T.dark, { parent: base });
  }
  // ---- the coolant plant at the back: two horizontal tanks on saddles, piped in
  for (const s of [-1, 1]) {
    const x = s * 4.2, z = -13.6;
    box(4.6, 0.25, 1.8, T.concD, x, 0, z, { dirt: 0.5, ...B });
    for (const dx of [-1.6, 1.6]) box(0.3, 0.7, 1.3, T.gunD, x + dx, 0.25, z, { dirt: 0.2, ...B });
    hcyl(0.8, 4.4, T.white, x, 1.6, z, { dirt: 0.4, ...B });
    for (const e of [-1, 1]) sphere(0.8, T.white, x + e * 2.2, 1.6, z, { ...B }).scale.set(0.35, 1, 1);
    for (const dx of [-1.2, 0, 1.2]) hoop(0.82, 0.05, T.gunD, x + dx, 1.6, z, { ...B }).rotation.z = PI / 2;
    pipe([[x, 2.4, z], [x, 2.9, z + 0.6], [x * 0.6, 2.6, -11.2], [x * 0.4, 0.4, -9.5]], 0.12, T.steel, { parent: base });
  }
  // ---- the fire-control bunker at the front left: a squat block with armoured slits and a rangefinder
  const fx = -10.6, fz = 9.6;
  {
    box(4.2, 2.4, 3.2, T.conc, fx, 0, fz, { ry: PI / 4, dirt: 0.7, dirtH: 2.4, ...B });
    box(4.5, 0.3, 3.5, T.concD, fx, 2.4, fz, { ry: PI / 4, dirt: 0.3, ...B });
    cyl(0.12, 1.4, T.steel, fx, 2.7, fz, { seg: 10, ...B });
    hcyl(0.18, 2.6, T.gunD, fx, 4.15, fz, { ...B }).rotation.y = PI / 4;
    for (const s of [-1, 1]) sphere(0.24, T.gunD, fx + s * 0.92, 4.15, fz - s * 0.92, { ...B });
  }
  // ---- a rack of spare Ring Crystal lenses at the right, under a tarpaulin frame
  {
    const x = 13.4, z = -3;
    box(1.4, 0.2, 4.4, T.gunD, x, 0, z, { dirt: 0.3, ...B });
    for (let k = 0; k < 3; k++) { sphere(0.42, T.lens, x, 0.62, z - 1.4 + k * 1.4, { ...B }).scale.set(1, 0.55, 1); box(1.1, 0.25, 1.0, T.olive, x, 0.2, z - 1.4 + k * 1.4, { dirt: 0.2, ...B }); }
  }

  // ============================================================================================ the head: the gun
  const head = group(0, 0, 0, 0), H = { parent: head };
  const TOPY = FLOOR + 0.25;
  // the turntable deck: a heavy steel disc with a tread-plate top and a rim of rollers
  cyl(5.45, 0.55, T.gunD, 0, FLOOR, 0, { seg: 64, dirt: 0.2, ...H });
  cyl(5.2, 0.06, M.grating, 0, FLOOR + 0.55, 0, { seg: 64, dirt: 0, ...H });
  for (let k = 0; k < 24; k++) { const a = k * PI / 12; box(0.5, 0.35, 0.3, T.steel, Math.cos(a) * 5.5, FLOOR + 0.1, Math.sin(a) * 5.5, { ry: -a, dirt: 0.1, ...H }); }
  const DY = FLOOR + 0.61;
  // the carriage: a long armoured box the length of the deck, and two great trunnion cheeks
  box(8.6, 1.5, 5.2, T.armor, -0.6, DY, 0, { dirt: 0.35, dirtH: 1.5, ...H });
  for (const s of [-1, 1]) {
    const g = new THREE.Shape(); g.moveTo(-3.4, 0); g.lineTo(3.0, 0); g.lineTo(2.2, 3.6); g.lineTo(0.6, 4.9); g.lineTo(-1.6, 4.9); g.lineTo(-3.4, 2.4); g.closePath();
    const geo = new THREE.ExtrudeGeometry(g, { depth: 0.75, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
    geo.translate(0, 0, -0.375);
    mesh(geo, T.armor, -0.4, DY + 1.5, s * 2.15, { dirt: 0.35, dirtH: 5, ...H });
    // rivet rows and a hazard stripe on each cheek
    for (let k = 0; k < 7; k++) cyl(0.07, 0.08, T.chrome, -2.9 + k * 0.85, DY + 1.8, s * (2.55 + 0.02), { seg: 8, dirt: 0, ...H }).rotation.x = PI / 2;
    box(5.6, 0.22, 0.04, M.hazard, -0.6, DY + 1.55, s * 2.56, { ...T.nc, ...H });
    // the trunnion hub
    hcyl(0.95, 0.9, T.gun, -0.2, DY + 5.0, s * 2.15, { axis: 'z', dirt: 0.2, ...H });
    hcyl(0.55, 1.05, T.chrome, -0.2, DY + 5.0, s * 2.15, { axis: 'z', dirt: 0, ...H });
  }
  // the counterweight at the back of the carriage
  box(2.6, 2.0, 4.0, T.gunD, -5.6, DY, 0, { dirt: 0.4, ...H });
  for (let k = 0; k < 4; k++) box(0.08, 1.7, 4.06, T.steel, -6.6 + k * 0.6, DY + 0.15, 0, { dirt: 0.2, ...H });
  // the gun, raised ELEV about its trunnions; x runs along the barrel from the trunnion axis
  const ELEV = 11 * PI / 180, TY = DY + 5.0, TX = -0.2;
  const G = new THREE.Group(); G.position.set(TX, TY, 0); G.rotation.z = ELEV; head.add(G);
  const GO = (e = {}) => ({ parent: G, ...e });
  // the breech housing: a long finned box behind the trunnions, with the cable bundles feeding it
  box(6.4, 2.6, 3.4, T.gun, -2.4, -1.3, 0, GO({ dirt: 0.3 }));
  box(6.6, 0.25, 3.6, T.gunD, -2.4, 1.3, 0, GO({ dirt: 0.1 }));
  for (let k = 0; k < 9; k++) for (const s of [-1, 1]) box(0.12, 2.2, 0.5, T.steel, -5.2 + k * 0.62, -1.1, s * 1.92, GO({ dirt: 0.2 }));
  for (const s of [-1, 1]) {
    const y0 = -0.4, z0 = s * 1.25;
    pipe([[-5.6, y0, z0], [-6.4, y0 - 0.4, z0 * 1.2], [-7.2, -2.6, z0 * 1.4], [-6.4, -4.8, z0 * 1.2]], 0.26, T.dark, { parent: G });
    pipe([[-5.6, y0 + 0.7, z0 * 0.6], [-6.6, y0 + 0.2, z0 * 0.8], [-7.4, -2.2, z0 * 0.9], [-6.8, -4.8, z0 * 0.8]], 0.2, T.dark, { parent: G });
  }
  L.mark('breech', -5.4, 0, 0, G);
  // the barrel: a thick jacket out of the breech, then the tube, tapering, with the charge rings and cooling fins
  const LEN = 23;
  { const g = new THREE.CylinderGeometry(1.35, 1.55, 4.2, 40, 1); g.rotateZ(-PI / 2); mesh(g, T.gun, 2.6, 0, 0, GO({ dirt: 0.25 })); }
  { const g = new THREE.CylinderGeometry(0.78, 1.08, LEN - 4.6, 40, 1); g.rotateZ(-PI / 2); mesh(g, T.gunD, 4.7 + (LEN - 4.6) / 2, 0, 0, GO({ dirt: 0.15 })); }
  const R0 = 6.2, R1 = LEN - 2.6, NRING = 8;
  for (let k = 0; k < NRING; k++) {
    const x = R0 + k * (R1 - R0) / (NRING - 1), r = 1.08 - (x - 4.7) / (LEN - 4.6) * 0.3;
    // a collar: copper windings either side of a dark ceramic band (the game lights it as the charge climbs)
    for (const dx of [-0.32, 0.32]) { const t = new THREE.TorusGeometry(r + 0.06, 0.1, 10, 40); t.rotateY(PI / 2); mesh(t, T.copperD, x + dx, 0, 0, GO({ dirt: 0 })); }
    { const g = new THREE.CylinderGeometry(r + 0.16, r + 0.16, 0.46, 40, 1, true); g.rotateZ(PI / 2); const m = mesh(g, T.ring, x, 0, 0, GO({ dirt: 0 })); m.material = T.ring.clone(); m.material.side = THREE.DoubleSide; }
    { const t = new THREE.TorusGeometry(r + 0.2, 0.06, 8, 40); t.rotateY(PI / 2); mesh(t, T.gun, x, 0, 0, GO({ dirt: 0 })); }
    L.mark('r' + k, x, 0, 0, G);
  }
  // cooling fins along the top and the underside, between the rings
  for (let k = 0; k < NRING - 1; k++) {
    const x0 = R0 + k * (R1 - R0) / (NRING - 1) + 0.6, x1 = R0 + (k + 1) * (R1 - R0) / (NRING - 1) - 0.6, r = 0.98 - (x0 - 4.7) / (LEN - 4.6) * 0.3;
    for (let x = x0; x <= x1; x += 0.32) { box(0.06, 0.34, 0.9, T.steel, x, r - 0.1, 0, GO({ dirt: 0 })); }
  }
  // a guide rail and conduit along the barrel's top
  box(LEN - 6, 0.12, 0.2, T.copper, 4.5 + (LEN - 6) / 2, 1.18, 0.55, GO({ dirt: 0 }));
  // the focusing head: a flared steel shroud round the Ring Crystal lens, with its brace ring and a red light
  {
    const g = new THREE.CylinderGeometry(1.25, 0.95, 1.9, 40, 1, true); g.rotateZ(-PI / 2);
    const m = mesh(g, T.gun, LEN + 0.7, 0, 0, GO({ dirt: 0.1 })); m.material = T.gun.clone(); m.material.side = THREE.DoubleSide;
    for (const dx of [-0.2, 0.9]) { const t = new THREE.TorusGeometry(1.1 + dx * 0.1, 0.09, 8, 48); t.rotateY(PI / 2); mesh(t, T.gunD, LEN + 0.3 + dx, 0, 0, GO({ dirt: 0 })); }
    for (let k = 0; k < 6; k++) { const a = k * PI / 3; box(1.6, 0.14, 0.14, T.steel, LEN + 0.4, Math.cos(a) * 0.95, Math.sin(a) * 0.95, GO({ dirt: 0 })); }
    const lens = new THREE.SphereGeometry(0.92, 36, 18); lens.scale(0.42, 1, 1);
    mesh(lens, T.lens, LEN + 1.45, 0, 0, GO({ dirt: 0, cast: false }));
    sphere(0.12, T.red, LEN - 0.2, 1.4, 0, GO({ cast: false }));
    cyl(0.04, 0.3, T.dark, LEN - 0.2, 1.05, 0, GO({ seg: 8, dirt: 0 }));
  }
  L.mark('muzzle', LEN + 1.6, 0, 0, G);
  // work lights on the carriage (warm, not team-coloured: the head is shared by every team)
  { const warm = dark ? M.emit('#ffc477', 2.6) : M.plain('#e8d6a8', 0.4, 0.2);
    for (const s of [-1, 1]) { box(0.5, 0.22, 0.12, warm, 2.2, DY + 1.25, s * 2.62, { ...T.nc, ...H }); box(0.36, 0.18, 0.1, warm, -6.2, DY + 1.4, s * 2.05, { ...T.nc, ...H }); }
    sphere(0.14, dark ? M.emit('#ffb347', 3) : T.red, -5.6, DY + 2.2, 0, { cast: false, ...H }); }
  head.rotation.y = -ROT * (PI * 2 / NR);

  if (PART === 'base') { head.visible = false; }
  else { base.visible = false; L.hidePad(); L.getRoot().traverse((o) => { if (o.userData.decal) o.visible = false; }); }

  // ========================================================================= power layer (base only: lights and electricity)
  if (PART === 'base') {
    const P = power(L), nc = T.nc;
    // the team band round the berm's crest, one length per face of the octagon, and a beacon at each corner
    for (let k = 0; k < 8; k++) {
      const a0 = PI / 8 + k * PI / 4, a1 = a0 + PI / 4, r = 11.25;
      const ax = Math.cos(a0) * r, az = Math.sin(a0) * r, bx = Math.cos(a1) * r, bz = Math.sin(a1) * r;
      box(Math.hypot(bx - ax, bz - az) - 0.4, 0.09, 0.12, P.glow, (ax + bx) / 2, 2.22, (az + bz) / 2, { ry: Math.atan2(-(bz - az), bx - ax), ...nc });
      if (k % 2 === 0) P.beacon(ax, 2.35, az, k === 0 ? '#ff3a22' : undefined);
    }
    // the bunker's lit slits, and a junction box by its door
    P.windows(2.0, 0.28, fx + 1.2, 1.5, fz + 1.2, -PI / 4, 3);
    P.junction(-8.0, 12.4, 0);
    // transformers by the capacitor banks at the back, arcing
    P.transformer(-9.0, -13.5, 0); P.transformer(9.0, -13.5, 0);
    // floodlights on poles at the front corners, lighting the pit
    P.flood(-13.6, 2.0, 4.0, PI / 2 + 0.4); P.flood(13.6, 2.0, 4.0, -PI / 2 - 0.4);
    // the turntable race glows faintly where the power couples in
    const inner = new THREE.RingGeometry(5.62, 5.78, 64); inner.rotateX(-PI / 2); mesh(inner, P.glowSoft, 0, FLOOR + 0.06, 0, nc);
    if (dark) pointLight('#ffdcae', 6 * NB, 0, 6, 0, 14);
  }
  void beam; void cyl;
}
