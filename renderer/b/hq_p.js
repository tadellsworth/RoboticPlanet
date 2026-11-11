// Command Base (game id "lander"), on the shared pad like every other 3D building.
// A low octagonal wall of armoured concrete with riveted steel plating around the pad, a squat round bastion with a
// twin-barrelled gun on each corner, a half-open blast gate over a short ramp in the front wall, and inside a
// stepped armoured command block (the old landing craft, legs sunk into concrete and plated over) with a slanted
// band of team-coloured windows and a tall comms mast with radar dish and beacon. Courtyard: three charging
// docks, stacked supply crates, fuel drums. Team-coloured lights along the top of the wall.
// POWERED proposal (hq_p): the same realistic base with a lights-and-electricity layer from b/powerkit.js:
// warm lit windows on the command block, lit firing slits, floodlights on the bastions and gate, a transformer
// yard with arcing insulators, conduits with glowing collars into junction boxes, cables to the mast, beacons.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, M, THREE, TEAM } = L;
  const PK = power(L), nc = { dirt: 0, cast: false };
  const conc = M.rough('#8f887c'), concD = M.rough('#7a7468'), plate = M.paint('#5a6066', { panelW: 128, panelH: 256 });
  const armor = M.paint('#4c5258'), gun = M.paint('#3f4449'), off = M.paint('#c9c5ba'), olive = M.paint('#5d6247');
  const glow = M.emit(TEAM, 2.4), dim = M.emit(TEAM, 1.1);
  L.seed(301);

  // ---------------------------------------------------------------- wall
  const A = 4.05, C = 1.75;                                  // flats at |x|,|z| = A; corners chamfered by C
  const V = [[A, -A + C], [A, A - C], [A - C, A], [-A + C, A], [-A, A - C], [-A, -A + C], [-A + C, -A], [A - C, -A]];
  const GATE = 1.2;
  const secLow = new THREE.Shape(); secLow.moveTo(-0.55, 0); secLow.lineTo(0.55, 0); secLow.lineTo(0.44, 0.72); secLow.lineTo(-0.44, 0.72); secLow.closePath();
  const secHigh = new THREE.Shape(); secHigh.moveTo(-0.44, 0.72); secHigh.lineTo(0.44, 0.72); secHigh.lineTo(0.34, 1.22); secHigh.lineTo(-0.34, 1.22); secHigh.closePath();
  function seg(P, Q) {
    const dx = Q[0] - P[0], dz = Q[1] - P[1], len = Math.hypot(dx, dz), ry = Math.atan2(dx, dz), mx = (P[0] + Q[0]) / 2, mz = (P[1] + Q[1]) / 2;
    for (const [sec, mat] of [[secLow, conc], [secHigh, plate]]) {
      const g = new THREE.ExtrudeGeometry(sec, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2);
      mesh(g, mat, mx, 0, mz, { ry, dirtH: 1.2 });
    }
    box(0.72, 0.1, len, gun, mx, 1.22, mz, { ry, dirt: 0 });                                       // steel coping
    const ox = Math.cos(ry), oz = -Math.sin(ry);
    for (const s of [-1, 1]) box(0.05, 0.05, Math.max(len - 0.5, 0.2), glow, mx + ox * s * 0.31, 1.3, mz + oz * s * 0.31, { ry, cast: false });
    const n = Math.max(1, Math.round(len / 1.1));                                                   // vertical plate seams
    for (let k = 1; k < n; k++) { const t = k / n - 0.5; box(0.92, 0.5, 0.06, M.dark, mx + dx * t, 0.72, mz + dz * t, { ry, dirt: 0 }); }
  }
  for (let i = 0; i < 8; i++) {
    const P = V[i], Q = V[(i + 1) % 8];
    if (i === 2) { seg(P, [GATE + 0.3, A]); seg([-GATE - 0.3, A], Q); }                             // front wall split by the gate
    else seg(P, Q);
  }
  for (const [x, z] of V) { box(1.05, 1.35, 1.05, concD, x, 0, z, { ry: Math.PI / 4 }); box(1.1, 0.1, 1.1, gun, x, 1.35, z, { ry: Math.PI / 4, dirt: 0 }); }   // joint pilasters

  // corner bastions with twin-barrelled guns facing outward
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const bx = sx * (A - C / 2 + 0.15), bz = sz * (A - C / 2 + 0.15), out = Math.atan2(-sz, sx);
    cyl(1.12, 1.6, conc, bx, 0, bz, { rTop: 1.0, seg: 24 });
    cyl(1.04, 0.32, plate, bx, 1.6, bz, { seg: 24, dirt: 0 });
    hoop(1.05, 0.03, dim, bx, 1.92, bz, { cast: false });
    for (let k = 0; k < 3; k++) { const a = out + (k - 1) * 0.6; box(0.34, 0.12, 0.1, M.dark, bx + Math.cos(a) * 1.07, 1.1, bz - Math.sin(a) * 1.07, { ry: a + Math.PI / 2, dirt: 0 });
      box(0.26, 0.05, 0.1, PK.warm, bx + Math.cos(a) * 1.08, 1.135, bz - Math.sin(a) * 1.08, { ry: a + Math.PI / 2, ...nc }); }   // lit slit
    cyl(0.5, 0.18, gun, bx, 1.92, bz, { dirt: 0 });
    const t = group(bx, 2.1, bz, out);
    box(0.85, 0.42, 0.7, armor, -0.05, 0, 0, { parent: t, dirt: 0 });
    box(0.5, 0.06, 0.4, M.hazard, -0.15, 0.42, 0, { parent: t, dirt: 0 });
    for (const dz of [-0.16, 0.16]) { hcyl(0.07, 1.0, M.steel, 0.82, 0.22, dz, { axis: 'x', parent: t }); hcyl(0.1, 0.18, M.dark, 1.3, 0.22, dz, { axis: 'x', parent: t }); }
    box(0.25, 0.06, 0.3, glow, -0.35, 0.43, 0, { parent: t, cast: false });
    ao(bx, bz, 2.2, 2.2, 0.5);
  }

  // front gate: two armoured gate towers, a heavy blast door slid half open, a short ramp, barriers, hazard stripes
  for (const s of [-1, 1]) {
    const gx = s * (GATE + 0.3);
    box(0.85, 1.75, 1.3, concD, gx, 0, A);
    box(0.9, 0.12, 1.35, gun, gx, 1.75, A, { dirt: 0 });
    box(0.82, 0.8, 0.04, M.hazard, gx, 0.2, A + 0.66, { dirt: 0 });
    lamp(gx, 1.88, A + 0.35, TEAM, { size: 0.16, k: 3.5, intensity: 3, dist: 3 });
  }
  box(2 * GATE + 1.4, 0.3, 0.5, gun, 0, 1.75, A - 0.2, { dirt: 0 });                                  // door track header
  const door = group(-GATE * 0.55, 0, A - 0.25);                                                     // slid half open to the left
  box(GATE * 2, 1.55, 0.32, armor, 0, 0.15, 0, { parent: door, dirt: 0.4 });
  box(GATE * 2 - 0.1, 0.35, 0.04, M.hazard, 0, 0.3, 0.17, { parent: door, dirt: 0 });
  for (const x of [-0.7, 0, 0.7]) box(0.08, 1.3, 0.06, M.dark, x, 0.25, 0.18, { parent: door, dirt: 0 });
  box(GATE * 2 - 0.4, 0.05, 0.04, glow, 0, 1.45, 0.18, { parent: door, cast: false });
  // ramp: rises from the pad edge to the gate threshold
  const rampLen = 5.0 - (A + 0.55) + 0.25, rise = 0.18;
  const rg = group(0, rise / 2, A + 0.55 + rampLen / 2 - 0.25); rg.rotation.x = Math.atan2(rise, rampLen);
  box(2 * GATE, 0.08, rampLen + 0.05, M.grating, 0, -0.04, 0, { parent: rg, dirt: 0 });
  box(2 * GATE, 0.18, 1.3, concD, 0, 0, A, { dirt: 0 });                                            // threshold slab
  for (const s of [-1, 1]) box(0.12, 0.02, 0.9, M.hazard, s * (GATE - 0.1), rise + 0.01, A, { dirt: 0, cast: false });
  for (const s of [-1, 1]) {                                                                        // concrete barriers flanking the approach
    const b = new THREE.Shape(); b.moveTo(-0.22, 0); b.lineTo(0.22, 0); b.lineTo(0.12, 0.12); b.lineTo(0.08, 0.46); b.lineTo(-0.08, 0.46); b.lineTo(-0.12, 0.12); b.closePath();
    const g = new THREE.ExtrudeGeometry(b, { depth: 0.9, bevelEnabled: false }); g.translate(0, 0, -0.45);
    mesh(g, conc, s * 2.15, 0, 4.78, { ry: Math.PI / 2 });
    box(0.9, 0.1, 0.17, M.hazard, s * 2.15, 0.3, 4.78, { dirt: 0 });
  }
  pointLight(TEAM, 4, 0, 1.2, A + 0.9, 3.5);

  // ---------------------------------------------------------------- command block (the old landing craft)
  const cz = -0.85;
  cyl(2.75, 0.25, concD, 0, 0, cz, { seg: 8, ry: Math.PI / 8 }); ao(0, cz, 5.6, 5.6, 0.6);
  cyl(2.55, 1.5, conc, 0, 0.25, cz, { rTop: 2.25, seg: 8, ry: Math.PI / 8 });                       // sunk concrete plinth
  cyl(2.28, 0.14, gun, 0, 1.75, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(1.98, 2.2, plate, 0, 1.89, cz, { rTop: 1.55, seg: 8, ry: Math.PI / 8, soot: 0.3 });           // hull
  cyl(1.9, 0.42, M.emit(TEAM, 1.6), 0, 2.75, cz, { rTop: 1.82, seg: 8, ry: Math.PI / 8, open: true, cast: false, dirt: 0 });   // slanted window band
  for (let k = 0; k < 16; k++) { const a = (k + 0.5) * Math.PI / 8; box(0.07, 0.48, 0.12, gun, Math.cos(a) * 1.85, 2.72, cz + Math.sin(a) * 1.85, { ry: -a + Math.PI / 2, dirt: 0 }); }
  cyl(1.95, 0.1, gun, 0, 2.66, cz, { rTop: 1.92, seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(1.84, 0.1, gun, 0, 3.17, cz, { rTop: 1.81, seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(1.58, 0.14, gun, 0, 4.09, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });
  cyl(1.3, 1.0, armor, 0, 4.23, cz, { rTop: 1.0, seg: 8, ry: Math.PI / 8 });                         // command cupola
  cyl(1.02, 0.12, gun, 0, 5.23, cz, { seg: 8, ry: Math.PI / 8, dirt: 0 });
  box(0.7, 0.18, 0.7, M.dark, -0.35, 5.35, cz + 0.25, { dirt: 0 });                                 // roof hatch
  for (let k = 0; k < 8; k++) { const a = (k + 0.5) * Math.PI / 4; box(0.4, 0.08, 0.06, glow, Math.cos(a) * 1.18, 4.75, cz + Math.sin(a) * 1.18, { ry: -a + Math.PI / 2, cast: false }); }
  pointLight(TEAM, 7, 0, 2.95, cz + 2.7, 4.5);
  // the landing legs: folded down, sunk into concrete feet, plated over
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2 + Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
    beam([c * 1.6, 3.6, cz + s * 1.6], [c * 2.75, 0.95, cz + s * 2.75], 0.5, 0.42, armor);
    beam([c * 1.88, 3.0, cz + s * 1.88], [c * 2.55, 1.45, cz + s * 2.55], 0.56, 0.1, M.hazard);
    box(1.0, 1.1, 1.0, concD, c * 2.85, 0, cz + s * 2.85, { ry: -a });
    box(1.05, 0.1, 1.05, gun, c * 2.85, 1.1, cz + s * 2.85, { ry: -a, dirt: 0 });
  }
  // armoured entrance at the front of the block
  box(1.3, 1.25, 0.5, concD, 0, 0.25, cz + 2.45);
  box(0.8, 0.85, 0.06, armor, 0, 0.3, cz + 2.71, { dirt: 0 });
  box(0.6, 0.05, 0.04, glow, 0, 1.2, cz + 2.73, { cast: false });
  box(1.36, 0.08, 0.56, gun, 0, 1.5, cz + 2.45, { dirt: 0 });

  // comms mast: lattice of three legs, radar dish, antenna, beacon
  const mx = 0.45, mz = cz - 0.35, y0 = 5.35, y1 = 9.5;
  cyl(0.4, 0.35, gun, mx, y0, mz, { dirt: 0 });
  const legs = [0, 2.094, 4.189].map(a => [Math.cos(a), Math.sin(a)]);
  for (const [c, s] of legs) beam([mx + c * 0.34, y0 + 0.3, mz + s * 0.34], [mx + c * 0.07, y1, mz + s * 0.07], 0.07, 0.07, M.steel);
  for (let y = y0 + 0.9; y < y1 - 0.4; y += 0.75) {
    const r = 0.34 - 0.27 * (y - y0) / (y1 - y0);
    for (let i = 0; i < 3; i++) { const [c1, s1] = legs[i], [c2, s2] = legs[(i + 1) % 3]; beam([mx + c1 * r, y, mz + s1 * r], [mx + c2 * r, y + 0.37, mz + s2 * r], 0.035, 0.035, M.steel); }
  }
  // radar dish on a bracket, tipped up and turned toward the front left
  const dg = group(mx, 7.2, mz, 0.55);
  box(0.12, 0.12, 0.7, gun, 0, 0, 0.35, { parent: dg, dirt: 0 });
  const dish = new THREE.SphereGeometry(0.85, 28, 10, 0, Math.PI * 2, 0, 0.85); dish.translate(0, -0.85, 0);
  const dm = mesh(dish, off, 0, 0, 0.75, { parent: dg, rx: Math.PI / 2 - 0.45, dirt: 0 }); dm.material = off.clone(); dm.material.side = THREE.DoubleSide;
  cyl(0.04, 0.55, M.steel, 0, 0.05, 1.0, { parent: dg, dirt: 0 });
  sphere(0.08, M.emit(TEAM, 3), 0, 0.12, 1.35, { parent: dg, cast: false });
  box(0.9, 0.06, 0.06, M.steel, mx, 8.7, mz, { dirt: 0 });
  sphere(0.26, M.emit(TEAM, 4), mx, y1 + 0.15, mz, { cast: false });
  cyl(0.03, 0.55, M.steel, mx, y1 + 0.38, mz, { seg: 8, dirt: 0 });
  pointLight(TEAM, 6, mx, y1, mz + 0.7, 4);
  // a stubby secondary antenna on the cupola
  cyl(0.03, 1.2, M.steel, -0.75, 5.35, cz - 0.4, { seg: 8, dirt: 0 });
  sphere(0.07, M.emit(TEAM, 3), -0.75, 6.57, cz - 0.4, { cast: false });

  // ---------------------------------------------------------------- courtyard
  // three charging docks in a row along the left wall
  for (const dz of [-2.15, -0.9, 0.35]) {
    const x = -3.05;
    box(0.95, 0.05, 1.0, M.plain('#26292c', 0.85), x + 0.1, 0, dz, { dirt: 0, cast: false });
    hoop(0.32, 0.04, glow, x + 0.2, 0.06, dz, { cast: false });
    box(0.32, 0.95, 0.5, armor, x - 0.3, 0, dz); box(0.36, 0.08, 0.54, M.hazard, x - 0.3, 0.95, dz, { dirt: 0 });
    box(0.06, 0.55, 0.3, glow, x - 0.12, 0.25, dz, { cast: false });
    box(0.08, 0.05, 0.08, PK.green, x - 0.3, 1.03, dz + 0.15, nc);                                     // ready light
  }
  pointLight(TEAM, 3, -2.6, 0.8, -0.9, 3);
  // stacked supply crates (front right) and fuel drums
  const crate = M.paint('#5d6247'), crate2 = M.paint('#7a6a48');
  for (const [x, z, y, m] of [[1.75, 2.35, 0, crate], [2.45, 2.35, 0, crate2], [2.1, 2.35, 0.62, crate], [1.75, 2.98, 0, crate2], [2.45, 2.98, 0, crate]]) {
    box(0.66, 0.6, 0.6, m, x, y, z); box(0.68, 0.06, 0.62, M.dark, x, y + 0.27, z, { dirt: 0 });
  }
  ao(2.1, 2.65, 1.5, 1.3, 0.5);
  for (const [x, z] of [[-1.85, 2.3], [-2.35, 2.55], [-1.9, 2.85], [2.1, -0.3]]) {
    cyl(0.25, 0.72, M.paint('#8a5a2e', { rivets: false }), x, 0, z, { seg: 18 }); hoop(0.26, 0.025, gun, x, 0.25, z); hoop(0.26, 0.025, gun, x, 0.5, z);
    cyl(0.08, 0.03, M.dark, x + 0.1, 0.72, z, { seg: 10, dirt: 0 });
  }
  ao(-2.05, 2.55, 1.0, 0.9, 0.45);
  // small generator on the right
  box(0.8, 0.75, 1.3, olive, 3.0, 0, 1.0); box(0.6, 0.06, 0.9, M.grille('#3d4247'), 3.0, 0.76, 1.0, { dirt: 0 });
  pipe([[3.0, 0.4, 0.35], [3.0, 0.3, -0.1], [1.9, 0.3, -0.1]], 0.06, M.dark);

  // ================================================================ power layer (lights and electricity)
  const at = (dx, dz) => Math.atan2(dx, dz);                               // ry that aims local +z along (dx, dz)
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  // floodlight: pole from (x, y, z), lamp head aimed along ry and tipped down, warm-white light where it points
  function flood(x, y, z, h, ry, reach = 1.3) {
    cyl(0.045, h, PK.steelD, x, y, z, { seg: 10, dirt: 0.2 });
    const g = group(x, y + h, z, ry), t = new THREE.Group(); t.rotation.x = 0.12; g.add(t);
    box(0.42, 0.26, 0.18, PK.steel, 0, -0.13, 0.03, { parent: t, dirt: 0 });
    box(0.36, 0.2, 0.03, PK.white, 0, -0.1, 0.13, { parent: t, ...nc });
    pointLight('#fff1d6', 4 * NB, x + Math.sin(ry) * reach, y + h - 0.6, z + Math.cos(ry) * reach, 5);
  }
  // a band of n lit windows on a sloping facet: outward normal at angle ang (from +z toward +x), leaning back by tilt
  function facetWin(x, y, z, ang, tilt, w, h, n, mat = PK.warm) {
    const g = group(x, y, z, ang), t = new THREE.Group(); t.rotation.x = -tilt; g.add(t);
    const gap = 0.07, ww = (w - gap * (n + 1)) / n;
    box(w, h + 0.08, 0.04, PK.dark, 0, -h / 2 - 0.04, 0, { parent: t, ...nc });
    for (let k = 0; k < n; k++) box(ww, h, 0.05, mat, -w / 2 + gap + ww / 2 + k * (ww + gap), -h / 2, 0.01, { parent: t, ...nc });
  }

  // warm lit windows on the command block hull, under the team window band
  const hullApo = (y) => (1.98 - 0.43 * (y - 1.89) / 2.2) * Math.cos(Math.PI / 8) + 0.02, hullTilt = Math.atan(0.43 * Math.cos(Math.PI / 8) / 2.2);
  const wy = 2.28, wa = hullApo(wy);
  facetWin(0, wy, cz + wa, 0, hullTilt, 1.2, 0.26, 4);
  for (const s of [-1, 1]) {                                               // front diagonals: a pane each side of the leg
    const a = s * Math.PI / 4, ox = Math.sin(a) * wa, oz = Math.cos(a) * wa, tx = Math.cos(a), tz = -Math.sin(a);
    for (const k of [-0.48, 0.48]) facetWin(ox + tx * k, wy, cz + oz + tz * k, a, hullTilt, 0.3, 0.26, 1);
  }
  // warm bulkhead lamps either side of the block entrance
  for (const s of [-1, 1]) { box(0.16, 0.12, 0.1, PK.steelD, s * 0.5, 1.28, cz + 2.75, { dirt: 0 }); box(0.12, 0.07, 0.03, PK.warm, s * 0.5, 1.3, cz + 2.8, nc); }
  pointLight('#ffd9a0', 2.5, 0, 0.9, cz + 3.2, 2.6);

  // floodlights on the back bastions, beside the guns, lighting the courtyard
  const flTop = [];
  for (const sx of [-1, 1]) {
    const bx = sx * (A - C / 2 + 0.15), bz = -(A - C / 2 + 0.15), px = bx - sx * 0.74, pz = bz + 0.1;
    flood(px, 1.92, pz, 1.15, at(-px * 0.5, 1.0 - pz), 1.8); flTop.push([px, 3.0, pz]);
  }
  // searchlight on the cupola roof, trained on the gate
  { const sx0 = 0.6, sz0 = cz + 0.5, sy = 5.35;
    cyl(0.13, 0.1, PK.steelD, sx0, sy, sz0, { seg: 12, dirt: 0 });
    for (const s of [-1, 1]) box(0.04, 0.3, 0.06, PK.steelD, sx0 + s * 0.2, sy + 0.1, sz0, { dirt: 0 });
    hcyl(0.16, 0.34, PK.steel, sx0, sy + 0.34, sz0, { axis: 'z', seg: 20 });
    hcyl(0.13, 0.03, PK.white, sx0, sy + 0.34, sz0 + 0.17, { axis: 'z', seg: 20, cast: false });
    pointLight('#f2f8ff', 3 * NB, 0.3, 1.0, 2.6, 4.5); }
  // warm lamp posts in the front courtyard
  for (const [x, z] of [[-1.3, 3.05], [1.2, 2.55]]) {
    cyl(0.035, 1.25, PK.steelD, x, 0, z, { seg: 8, dirt: 0.3 });
    box(0.26, 0.07, 0.14, PK.steelD, x, 1.25, z, { dirt: 0 }); box(0.2, 0.025, 0.1, PK.warm, x, 1.23, z, nc);
    pointLight('#ffd49a', 2.5 * NB, x, 1.0, z, 2.8);
  }
  // lit guard-post windows on the gate towers
  for (const s of [-1, 1]) PK.windows(0.62, 0.16, s * (GATE + 0.3), 1.27, A + 0.66, 0, 2);
  // perimeter lamps along the wall tops, between the team strips
  const bollard = (x, z) => { box(0.05, 0.16, 0.05, PK.steelD, x, 1.32, z, { dirt: 0 }); box(0.09, 0.07, 0.09, PK.white, x, 1.48, z, nc); };
  for (const z of [-1.55, -0.5, 0.55, 1.6]) for (const sx of [-1, 1]) bollard(sx * A, z);
  for (const x of [-1.3, 0, 1.3]) bollard(x, -A);
  pointLight('#ffe2b8', 3, 0, 0.6, A + 1.0, 3.2);

  // transformer yard in the right courtyard: hazard-framed plate, transformer with arcing insulators,
  // a junction box, conduit into the block and a high-voltage feed to the hull
  const tx = 3.0, tz = -1.4;
  box(1.2, 0.03, 1.0, PK.dark, tx, 0, tz, { dirt: 0, cast: false });
  for (const [w, d, x, z] of [[1.2, 0.08, tx, tz - 0.5], [1.2, 0.08, tx, tz + 0.5], [0.08, 1.0, tx - 0.6, tz], [0.08, 1.0, tx + 0.6, tz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
  PK.transformer(tx, tz, 0);
  PK.junction(3.05, -0.55, 0);
  PK.conduit([[3.05, 0.55, -0.75], [3.05, 0.55, -1.0]], 0.05);
  PK.conduit([[2.77, 0.4, -0.55], [2.4, 0.4, -0.55], [2.17, 1.62, -0.55], [2.17, 1.95, -0.55], [1.86, 2.35, -0.55]], 0.055);
  box(0.1, 0.18, 0.18, PK.steelD, hullApo(2.55) + 0.02, 2.46, tz, { dirt: 0 });                    // hull bushing
  PK.cable([tx - 0.28, 1.2, tz], [hullApo(2.55) + 0.06, 2.55, tz], 0.12);
  PK.cable([tx + 0.28, 1.2, tz], [3.66, 1.25, tz - 0.2], 0.08);

  // conduit along the left wall feeding the charging docks, from a junction box by the front-left bastion
  const wx = -3.63, wyc = 1.12;
  PK.junction(-3.12, 1.32, 0);
  PK.conduit([[-3.4, 0.45, 1.32], [wx, 0.45, 1.32], [wx, wyc, 1.32], [wx, wyc, -2.55]], 0.05);
  for (const dz of [-2.15, -0.9, 0.35]) PK.conduit([[wx, wyc, dz], [-3.36, wyc, dz], [-3.36, 1.03, dz]], 0.035);

  // comms mast: amber obstruction beacons on the cross-arm, feed cables down to the back floodlights
  for (const s of [-1, 1]) PK.beacon(mx + s * 0.45, 8.78, mz, '#ffb347');
  for (let i = 0; i < 2; i++) PK.cable([mx + (i ? 0.12 : -0.12), 7.4, mz], flTop[i], 0.35);
}
