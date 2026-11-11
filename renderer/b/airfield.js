// Airfield: the hangar end of an airstrip (the game draws the runway itself, out from this tile in any of four
// directions). An arched hangar with its big doors part open on a lit bay, a slim control tower with a glazed
// cab and the team beacon, a fuel bowser tank with its hose reel, a windsock, and a yellow taxi line across the
// apron. Floodlights and the cab glow at night.
// POWERED (powered realism): a lights-and-electricity layer from b/powerkit.js: team light strips over the hangar ribs
// and round the door opening, warm lit skylights, a glowing threshold, floodlights on the hangar's front corners,
// lit tower cab windows with a team strip round the roof, team edge lights round the apron and green centre lights
// on the taxi line, a transformer and junction box powering the hangar and cabled to the tower, amber beacons.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, mesh, sphere, lamp, pointLight, ao, ladder, group, M, THREE, TEAM } = L;
  L.seed(1201);
  const wall = M.ribbed('#9fa39d', { period: 10 }), roofM = M.ribbed('#7a8086', { period: 14 }), steel = M.paint('#5a6066', { panelW: 128 });
  const off = M.paint('#cfccc2', { rivets: false }), conc = M.rough('#8f887c'), apron = M.rough('#7c776e');
  const team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.6), dark = M.dark;

  // ---- the apron
  box(8.6, 0.18, 8.2, apron, 0, 0, 0.2, { dirtH: 0.18 });
  box(0.16, 0.02, 2.6, M.paint('#d8b53a', { rivets: false }), -0.9, 0.18, 2.9, { dirt: 0, cast: false });         // taxi line out of the hangar
  box(4.4, 0.02, 0.16, M.paint('#d8b53a', { rivets: false }), 1.2, 0.18, 4.15, { dirt: 0, cast: false });
  for (let k = 0; k < 4; k++) box(0.5, 0.02, 0.12, M.paint('#e9e6dc', { rivets: false }), -3.4 + k * 0.7, 0.18, 4.1, { dirt: 0, cast: false });

  // ---- the hangar: an arched roof over ribbed end walls (its axis front to back), its doors part open on a lit bay
  const HX = -0.9, HZ = -1.0, HL = 5.0, HR = 2.45, HF = HZ + HL / 2;
  const arch = (r, len, t0, tl, mat, z, o = {}) => {
    const g = new THREE.CylinderGeometry(r, r, len, 40, 1, true, t0, tl);
    g.rotateX(Math.PI / 2); // along z, the arch up
    const m = mesh(g, mat, HX, 0.18, z, o); m.material = mat; m.material.side = THREE.DoubleSide; return m;
  };
  arch(HR, HL, Math.PI / 2, Math.PI, roofM, HZ, { dirt: 0.25, dirtH: 2.5 });
  for (let k = 0; k <= 6; k++) { const r = new THREE.TorusGeometry(HR + 0.03, 0.05, 6, 40, Math.PI); mesh(r, steel, HX, 0.18, HZ - HL / 2 + (k * HL) / 6, { dirt: 0 }); }
  arch(HR + 0.02, 0.6, Math.PI - 0.17, 0.34, team, HZ - 1.2, { dirt: 0 });                                       // team band over the ridge
  for (const z of [HZ - 0.2, HZ + 1.1]) arch(HR + 0.03, 0.7, Math.PI - 0.12, 0.24, M.emit('#ffd9a0', 1.3), z, { dirt: 0, cast: false }); // lit skylights
  { const sh = new THREE.Shape(); sh.absarc(0, 0, HR, 0, Math.PI, false); sh.closePath();
    mesh(new THREE.ShapeGeometry(sh, 32), wall, HX, 0.18, HZ - HL / 2, { dirt: 0.3 }).material.side = THREE.DoubleSide; }
  { const sh = new THREE.Shape(); sh.absarc(0, 0, HR, 0, Math.PI, false); sh.closePath();
    const hole = new THREE.Path(); hole.moveTo(-1.55, 0); hole.lineTo(-1.55, 1.9); hole.lineTo(1.55, 1.9); hole.lineTo(1.55, 0); hole.closePath(); sh.holes.push(hole);
    mesh(new THREE.ShapeGeometry(sh, 32), wall, HX, 0.18, HF, { dirt: 0.3 }).material.side = THREE.DoubleSide; }
  box(3.1, 1.9, 0.05, M.emit('#ffe2b0', 0.5), HX, 0.18, HF - 0.9, { cast: false, dirt: 0 });                     // the lit bay inside
  box(3.1, 0.02, 0.9, M.rough('#6a655c'), HX, 0.19, HF - 0.45, { dirt: 0, cast: false });
  for (const s of [-1, 1]) box(1.0, 1.95, 0.12, M.ribbed('#6c7074', { period: 8 }), HX + s * 1.95, 0.18, HF + 0.1, { dirt: 0.3 }); // doors slid aside
  box(3.4, 0.14, 0.14, M.hazard, HX, 2.05, HF + 0.03, { dirt: 0 });
  box(1.5, 0.3, 0.06, team, HX, 2.25, HF + 0.04, { dirt: 0 });                                                  // team panel over the doors
  ao(HX, HZ, HR * 2 + 0.6, HL + 0.6, 0.5);

  // ---- the control tower at the front right: shaft, glazed cab, mast and team beacon
  const tx = 3.1, tz = -2.7;
  box(0.9, 3.4, 0.9, off, tx, 0.18, tz, { dirtH: 1.4 });
  box(1.5, 0.12, 1.5, steel, tx, 3.58, tz, { dirt: 0.2 });
  box(1.38, 0.62, 1.38, M.glass('#2c4250', 0.92), tx, 3.7, tz, { dirt: 0 });
  for (const [dx, dz] of [[-0.66, -0.66], [0.66, -0.66], [-0.66, 0.66], [0.66, 0.66]]) box(0.08, 0.62, 0.08, steel, tx + dx, 3.7, tz + dz, { dirt: 0 });
  box(1.55, 0.1, 1.55, steel, tx, 4.32, tz, { dirt: 0.2 });
  box(1.1, 0.05, 0.05, M.emit('#ffd9a0', 1.4), tx, 3.95, tz + 0.7, { cast: false });
  box(0.18, 0.18, 0.18, glow, tx, 4.42, tz, { cast: false });
  cyl(0.05, 1.0, M.steel, tx + 0.45, 4.42, tz + 0.45, { seg: 10 });
  lamp(tx + 0.45, 5.45, tz + 0.45, TEAM, { size: 0.2, k: 4.5, intensity: 5, dist: 4, shape: 'sphere' });
  ladder(tx - 0.5, 0.3, 3.55, tz, { ry: Math.PI / 2 });
  ao(tx, tz, 1.4, 1.4, 0.45);

  // ---- the fuel bowser by the hangar, and its hose reel
  const fx = 2.9, fz = 1.5;
  for (const s of [-1, 1]) box(0.25, 0.5, 0.3, steel, fx + s * 1.0, 0.18, fz, { dirt: 0.3 });
  hcyl(0.62, 2.8, M.paint('#d6d2c4', { rivets: false }), fx, 1.05, fz, { seg: 28 });
  box(2.4, 0.08, 0.06, M.hazard, fx, 1.05, fz + 0.62, { dirt: 0 });
  cyl(0.28, 0.25, dark, fx - 1.0, 0.18, fz + 1.0, { seg: 20 });
  box(0.9, 0.1, 0.28, M.paint('#b33a2a', { rivets: false }), fx, 1.7, fz, { dirt: 0 }); // FUEL plate on the top
  ao(fx, fz, 3.0, 1.4, 0.4);

  // ---- the windsock on its pole, out at the front left
  cyl(0.05, 2.4, M.steel, -3.4, 0.18, 2.9, { seg: 10 });
  for (let k = 0; k < 4; k++) {
    const g = new THREE.CylinderGeometry(0.26 - k * 0.04, 0.22 - k * 0.04, 0.32, 16, 1, true);
    g.rotateZ(-Math.PI / 2 + 0.18);
    const m = mesh(g, M.paint(k % 2 ? '#e9e6dc' : '#e2702a', { rivets: false }), -3.2 + k * 0.31, 2.48 - k * 0.055, 2.9, { dirt: 0 });
    m.material.side = THREE.DoubleSide;
  }

  // ---- floodlights on a mast at the apron's back left
  cyl(0.07, 3.6, M.steel, -3.9, 0.18, -3.6, { seg: 10 });
  box(0.7, 0.12, 0.3, steel, -3.9, 3.78, -3.6, { dirt: 0 });
  for (const dx of [-0.2, 0.2]) lamp(-3.9 + dx, 3.7, -3.48, '#fff1c8', { size: 0.14, k: 2.2, intensity: 2.2, dist: 4 });
  pointLight(TEAM, 2.2, HX, 1.2, HF + 0.8, 3.5);
  void sphere;

  // ================================================================ power layer (lights and electricity)
  // (made after everything else, so the original parts keep their random texture offsets)
  const P = power(L), nc = { dirt: 0, cast: false }, AY = 0.18;                  // AY: the apron's top
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  const lift = (fn) => { const r = L.getRoot(), n = r.children.length; fn(); for (let i = n; i < r.children.length; i++) r.children[i].position.y += AY; };
  // team light strips over two hangar ribs and round the front arch; jambs and a threshold at the door opening
  const glowArch = (r, tube, z) => { const g = new THREE.TorusGeometry(r, tube, 6, 48, Math.PI); mesh(g, P.glow, HX, AY, z, nc); };
  for (const k of [2, 4]) glowArch(HR + 0.09, 0.035, HZ - HL / 2 + (k * HL) / 6);
  glowArch(HR + 0.06, 0.04, HF + 0.04);
  for (const s of [-1, 1]) box(0.06, 1.85, 0.06, P.glow, HX + s * 1.5, AY, HF + 0.05, nc);
  box(3.0, 0.012, 0.08, P.glow, HX, AY, HF + 0.25, nc);
  pointLight('#ffe2b0', 3 * NB, HX, 1.0, HF - 0.3, 3.5);                                         // the bay lit inside
  // floodlights on brackets high on the gable either side of the doors, aimed out over the apron
  for (const s of [-1, 1]) {
    const x = HX + s * 1.62, y = AY + 1.72, g = group(x, y, HF + 0.12, -s * 0.3), t = new THREE.Group(); t.rotation.x = 0.35; g.add(t);
    box(0.08, 0.08, 0.22, P.steelD, x, y - 0.04, HF + 0.08, { dirt: 0 });
    box(0.36, 0.22, 0.16, P.steel, 0, -0.11, 0.12, { parent: t, dirt: 0 });
    box(0.3, 0.16, 0.03, P.white, 0, -0.08, 0.21, { parent: t, ...nc });
    pointLight('#fff1d6', 3.5 * NB, x - s * 0.5, 0.9, HF + 1.6, 5);
  }
  // control tower: lit cab windows on the two faces we see, a team strip round the cab roof
  P.windows(1.25, 0.36, tx, 3.8, tz + 0.71, 0, 4);
  P.windows(1.25, 0.36, tx - 0.71, 3.8, tz, -Math.PI / 2, 4);
  P.strip(1.6, tx, 4.34, tz + 0.79, 0, 0.055); P.strip(1.6, tx - 0.79, 4.34, tz, Math.PI / 2, 0.055);
  // apron: team edge lights round the rim, green centre lights along the taxi line
  for (let k = 0; k <= 8; k++) { const x = -4.0 + k; box(0.1, 0.03, 0.1, P.glow, x, AY, 4.18, nc); box(0.1, 0.03, 0.1, P.glow, x, AY, -3.78, nc); }
  for (let k = 0; k <= 7; k++) { const z = -3.3 + k * 1.05; for (const x of [-4.18, 4.18]) box(0.1, 0.03, 0.1, P.glow, x, AY, z, nc); }
  for (let k = 0; k < 4; k++) box(0.07, 0.025, 0.12, P.green, -0.9, AY, 1.95 + k * 0.6, nc);
  for (let k = 0; k < 6; k++) box(0.12, 0.025, 0.07, P.green, -0.45 + k * 0.7, AY, 4.15, nc);
  // power: a transformer and a junction box on the apron beside the hangar, a conduit into its side, a cable
  // up to the tower
  const yx = 3.25, yz = -0.8;
  lift(() => {
    box(1.3, 0.03, 1.05, P.dark, yx, 0, yz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.3, 0.08, yx, yz - 0.52], [1.3, 0.08, yx, yz + 0.52], [0.08, 1.05, yx - 0.65, yz], [0.08, 1.05, yx + 0.65, yz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    P.transformer(yx, yz, 0);
    P.junction(2.2, -0.15, 0);
    P.conduit([[yx - 0.45, 0.32, yz], [2.2, 0.32, yz], [2.2, 0.32, -0.37]], 0.05);
    P.conduit([[1.93, 0.4, -0.15], [1.45, 0.4, -0.15]], 0.05);
  });
  ao(yx, yz, 1.0, 0.8, 0.4);
  box(0.14, 0.18, 0.12, P.steelD, tx - 0.25, 2.7, tz + 0.48, { dirt: 0 });                        // tower bushing
  P.cable([yx + 0.28, AY + 1.17, yz], [tx - 0.25, 2.8, tz + 0.52], 0.25);
  // amber beacons: the floodlight mast, the windsock pole, the fuel bowser
  P.beacon(-3.9, 3.98, -3.6, '#ffb347'); P.beacon(-3.4, 2.66, 2.9, '#ffb347'); P.beacon(fx + 1.1, 1.78, fz, '#ffb347');
}
