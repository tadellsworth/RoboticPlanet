// Trade Terminal: an off-world freight exchange. A landing pad with a stubby cargo lifter parked on it (engine
// pods, cockpit glow), a loading bay under a twin-beam gantry where the Road Trains pull in, a stack of
// containers waiting to go up, a control tower with the team's band and a beacon, and an uplink dish.
// POWERED (powered realism): a lights-and-electricity layer from b/powerkit.js: team light strips along the gantry
// beams, legs and spreader, work lights under the gantry over the lane, team studs along the lane's edge lines (the
// lane itself stays clear), a team ring round the landing pad, lit cabin windows and nav lights on the lifter, a team
// strip under the tower band, and on the front apron a transformer with arcing insulators and a junction box feeding
// the gantry by a conduit up its leg; beacons.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, sphere, lamp, ao, hoop, pointLight, M, TEAM, ACCENT, THREE, mesh } = L;
  L.seed(733);
  const conc = M.paint('#6a6d70', { rivets: false, panelW: 256, panelH: 256, rough: 0.92, metal: 0.03 });
  const steel = M.paint('#4c535a'), yel = M.paint('#b8952e'), hull = M.paint('#c9ccd0', { panelW: 128, panelH: 96 });
  const hullD = M.paint('#6f767d'), team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.4);
  const amber = M.emit('#ffb347', 2.2), cyan = M.emit('#7fe3ff', 2.6), win = M.emit('#ffe2a0', 1.2);
  const C = { red: '#7a3b2a', teal: '#3f6b6b', ochre: '#957636', grey: '#566170' };
  const container = (x, y, z, col, ry) => {
    const g = new THREE.BoxGeometry(2.4, 1.0, 1.0); g.translate(0, 0.5, 0);
    const m = mesh(g, M.ribbed(C[col]), x, y, z, { dirt: y > 0 ? 0.2 : 0.8 }); if (ry) m.rotation.y = ry;
  };

  // the landing pad (back right): a raised concrete disc with a hazard ring and corner lights
  const PX = 1.9, PZ = -1.6;
  cyl(3.0, 0.3, conc, PX, 0, PZ, { seg: 40, dirt: 0.5 });
  cyl(2.75, 0.02, M.hazard, PX, 0.3, PZ, { seg: 40, dirt: 0, cast: false });
  cyl(2.5, 0.025, conc, PX, 0.3, PZ, { seg: 40, dirt: 0.3, cast: false });
  box(2.2, 0.03, 0.22, M.plain('#d8d4c8'), PX, 0.31, PZ, { dirt: 0, cast: false });
  box(0.22, 0.03, 2.2, M.plain('#d8d4c8'), PX, 0.31, PZ, { dirt: 0, cast: false });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; sphere(0.09, cyan, PX + Math.cos(a) * 2.85, 0.36, PZ + Math.sin(a) * 2.85, { cast: false }); }

  // the cargo lifter on the pad: a boxy hull, a cockpit at the front (+x), four engine pods, landing legs
  const LX = PX, LZ = PZ, LY = 0.95;
  for (const [dx, dz] of [[-1.1, -0.85], [-1.1, 0.85], [1.0, -0.85], [1.0, 0.85]]) { box(0.12, 0.65, 0.12, M.dark, LX + dx, 0.3, LZ + dz, { dirt: 0 }); box(0.4, 0.06, 0.4, steel, LX + dx, 0.3, LZ + dz, { dirt: 0 }); }
  box(3.2, 1.25, 1.75, hull, LX - 0.15, LY, LZ, { dirt: 0.15 });
  box(3.25, 0.18, 1.8, hullD, LX - 0.15, LY + 1.25, LZ, { dirt: 0.1 });
  box(0.3, 0.2, 1.82, team, LX - 0.9, LY + 1.0, LZ, { dirt: 0 });
  { const g = new THREE.CylinderGeometry(0.0, 0.88, 1.1, 4, 1); g.rotateY(Math.PI / 4); g.rotateZ(-Math.PI / 2); g.scale(1, 0.75, 1.0); const m = mesh(g, hull, LX + 1.95, LY + 0.62, LZ, { dirt: 0.1 }); void m; }
  box(0.5, 0.32, 1.1, M.emit('#9fd8ff', 1.1), LX + 1.65, LY + 0.95, LZ, { dirt: 0, cast: false }); // cockpit glass
  for (const dz of [-1.15, 1.15]) for (const dx of [-1.2, 0.8]) {
    hcyl(0.34, 0.95, hullD, LX + dx, LY + 0.55, LZ + dz, { seg: 18, dirt: 0.1 });
    cyl(0.25, 0.06, amber, LX + dx, LY + 0.2, LZ + dz, { seg: 16, dirt: 0, cast: false }); // thruster glow underneath
  }
  for (const s of [-1, 1]) box(0.9, 0.16, 0.35, hullD, LX - 0.2, LY + 0.6, LZ + s * 0.98, { dirt: 0 });
  sphere(0.08, glow, LX - 1.6, LY + 1.5, LZ, { cast: false });
  ao(LX, LZ, 3.8, 2.6, 0.45);

  // the loading bay (front): a lane with a twin-beam gantry and a container on the hook
  const BZ = 2.2;
  box(9.0, 0.012, 1.9, M.plain('#3a3d40', 0.9, 0), 0, 0, BZ, { dirt: 0.6, cast: false });
  box(9.0, 0.014, 0.1, M.plain('#c9a032'), 0, 0, BZ - 0.95, { dirt: 0, cast: false });
  box(9.0, 0.014, 0.1, M.plain('#c9a032'), 0, 0, BZ + 0.95, { dirt: 0, cast: false });
  for (const x of [-3.6, 3.6]) {
    for (const z of [BZ - 1.25, BZ + 1.25]) box(0.32, 3.6, 0.32, yel, x, 0, z);
    box(0.36, 0.35, 2.9, yel, x, 3.35, BZ, { dirt: 0 });
    box(0.4, 0.14, 0.4, M.hazard, x, 0.35, BZ - 1.25, { dirt: 0 });
  }
  for (const z of [BZ - 0.4, BZ + 0.4]) box(7.6, 0.4, 0.28, yel, 0, 3.6, z, { dirt: 0 });
  box(1.1, 0.5, 1.2, steel, -1.0, 3.95, BZ, { dirt: 0 });
  for (const dz of [-0.3, 0.3]) box(0.04, 1.6, 0.04, M.dark, -1.0, 2.0, BZ + dz, { dirt: 0 });
  box(2.6, 0.14, 0.95, yel, -1.0, 1.92, BZ, { dirt: 0 });
  container(-1.0, 0.92, BZ, 'teal');
  lamp(-3.6, 3.95, BZ, ACCENT, { shape: 'sphere', size: 0.17, intensity: 3.5, dist: 4, k: 2.6 });
  lamp(3.6, 3.95, BZ, ACCENT, { shape: 'sphere', size: 0.17, intensity: 3.5, dist: 4, k: 2.6 });

  // containers waiting to go up (back left)
  container(-3.0, 0, -3.3, 'red'); container(-3.0, 1.0, -3.3, 'ochre'); container(-3.0, 0, -2.2, 'grey');
  container(-0.6, 0, -3.4, 'teal', 0.0);
  ao(-2.3, -2.9, 5.0, 2.4, 0.5);

  // the control tower (left middle): a slim concrete shaft, a glazed cab with the team band, a beacon
  const TX = -3.6, TZ = -0.4;
  box(1.0, 3.4, 1.0, conc, TX, 0, TZ, { dirt: 0.3 });
  box(1.55, 0.95, 1.55, steel, TX, 3.4, TZ, { dirt: 0.1 });
  box(1.58, 0.42, 1.58, win, TX, 3.62, TZ, { dirt: 0, cast: false });
  box(1.62, 0.16, 1.62, team, TX, 4.35, TZ, { dirt: 0 });
  box(0.06, 0.9, 0.06, M.dark, TX + 0.4, 4.5, TZ - 0.4, { dirt: 0 });
  sphere(0.11, glow, TX + 0.4, 5.45, TZ - 0.4, { cast: false });
  box(0.5, 0.9, 0.05, win, TX, 0.45, TZ + 0.51, { cast: false }); // door light
  ao(TX, TZ, 1.6, 1.6, 0.5);

  // the uplink dish beside the tower
  const DX = -1.7, DZ = -0.7;
  cyl(0.12, 1.3, steel, DX, 0, DZ, { seg: 10, dirt: 0 });
  { const g = new THREE.SphereGeometry(0.85, 24, 10, 0, Math.PI * 2, 0, 1.0); const m = mesh(g, M.plain('#dfe2e4', 0.45, 0.2), DX, 1.75, DZ, { dirt: 0 }); m.rotation.z = 2.5; m.rotation.y = -0.6; }
  sphere(0.08, cyan, DX + 0.3, 1.95, DZ + 0.2, { cast: false });

  // ================================================================ power layer (lights and electricity)
  // (made after everything else, so the original parts keep their random texture offsets)
  const P = power(L), nc = { dirt: 0, cast: false };
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  // gantry: team strips along the cross beams, up the front legs and along the spreader; work lights over the lane
  P.strip(7.5, 0, 3.98, BZ + 0.55, 0, 0.06); P.strip(7.5, 0, 3.58, BZ + 0.55, 0, 0.06); P.strip(7.5, 0, 3.98, BZ - 0.25, 0, 0.06);
  for (const x of [-3.6, 3.6]) box(0.05, 2.8, 0.05, P.glow, x + Math.sign(x) * 0.12, 0.45, BZ + 1.42, nc);
  P.strip(2.5, -1.0, 1.97, BZ + 0.49, 0, 0.05);
  for (const x of [-2.6, 1.4]) {
    box(0.5, 0.08, 0.26, P.steel, x, 3.52, BZ + 0.4, { dirt: 0 }); box(0.42, 0.03, 0.2, P.white, x, 3.5, BZ + 0.4, nc);
    pointLight('#fff1d6', 3 * NB, x, 1.4, BZ + 0.2, 4);
  }
  P.beacon(-1.0, 4.55, BZ, TEAM);
  // the lane: team studs along both edge lines (set in the ground; the lane stays clear)
  for (let k = 0; k < 10; k++) for (const dz of [-0.95, 0.95]) box(0.12, 0.02, 0.08, P.glow, -4.05 + k * 0.9, 0.014, BZ + dz, nc);
  // the landing pad: a team ring round the rim
  hoop(3.0, 0.03, P.glow, PX, 0.27, PZ, { cast: false });
  // the lifter: lit cabin windows behind the cockpit, nav lights, a team strip along the hull's top edge
  P.windows(1.0, 0.16, LX + 0.55, LY + 0.92, LZ + 0.885, 0, 4);
  P.strip(3.2, LX - 0.15, LY + 1.2, LZ + 0.9, 0, 0.05);
  box(0.08, 0.08, 0.08, P.green, LX + 1.35, LY + 1.1, LZ + 0.92, nc); box(0.08, 0.08, 0.08, M.emit('#ff3a22', 2.4), LX + 1.35, LY + 1.1, LZ - 0.92, nc);
  // the tower: a team strip under the band on the two faces we see
  P.strip(1.64, TX, 4.29, TZ + 0.82, 0, 0.05); P.strip(1.64, TX + 0.82, 4.29, TZ, Math.PI / 2, 0.05);
  // front apron: transformer on a hazard-framed plate and a junction box, a conduit up the right front leg
  const yx = 1.6, yz = 4.05;
  box(1.3, 0.03, 1.0, P.dark, yx, 0, yz, { dirt: 0, cast: false });
  for (const [w, d, x, z] of [[1.3, 0.08, yx, yz - 0.5], [1.3, 0.08, yx, yz + 0.5], [0.08, 1.0, yx - 0.65, yz], [0.08, 1.0, yx + 0.65, yz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
  P.transformer(yx, yz, 0); ao(yx, yz, 1.0, 0.8, 0.4);
  P.junction(2.85, 4.15, 0);
  P.conduit([[yx + 0.45, 0.3, yz], [2.58, 0.3, yz]], 0.05);
  P.conduit([[3.12, 0.35, 4.15], [3.44, 0.35, 4.15], [3.44, 0.35, BZ + 1.43], [3.44, 3.3, BZ + 1.43]], 0.05);
}
