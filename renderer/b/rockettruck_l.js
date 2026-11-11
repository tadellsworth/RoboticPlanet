// Rocket Truck, "Lancer" restyle (design proposal; the shipped scene is rockettruck.js). A six-wheeled robot truck
// in the warbot's language: dark gunmetal armour, a wedge-nosed cab with a glowing sensor-slit eye, the wheels half
// hidden under side skirts that carry team-colour glow strips, and an angular armoured launcher box (four tubes,
// 2 x 2) with team stripes down its lid. Top-down, orthographic, facing +x, no ground (the game draws its shadow);
// 10 world units across the frame, the truck about 7.6 long and 3.2 wide (kit px: 1 px = 1/25.6 unit).
//   ?part=drive  travelling: the launcher box lies flat over the bed, closed lid up
//   ?part=up     deployed: the box raised steeply toward the front (the four tube mouths showing), stabiliser legs out
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM, THREE } = L;
  const part = new URLSearchParams(location.search).get('part') || 'drive', up = part === 'up';
  L.seed(611);
  const R = kit(L, 0, 0), { rect, rr, poly, ext, disc, strip, tyre, brake, grime, eye, beamL, G } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), team = M.emit(TEAM, 0.75), paintT = M.paint(TEAM, { rivets: false });
  const lamp = M.emit('#fff1d0', 2.2), amber = M.emit('#ff9a2a', 1.3), nose = M.plain('#c9cdd2', 0.4, 0.5);

  // ---- running gear: three axles a side (one under the cab, a close pair under the bed), outer half showing
  for (const x of [60, -26, -60]) for (const s of [-1, 1]) tyre(x, s * 36, 14, 16, { blocks: 14 });
  rect(-92, -22, 184, 44, 0.3, 0.45, dark, { dirt: 0 });                                   // chassis frame
  for (const s of [-1, 1]) {
    // armoured skirt over the inner half of the wheels, a glow strip along its top, panel seams across it
    ext(poly([[86, s * 22], [78, s * 36], [-84, s * 36], [-94, s * 31], [-94, s * 22]]), 0.66, 0.54, armor, { bevel: 0.06 });
    strip(-84, s * 31.5, 72, s * 31.5, 3, 1.21, 0.02, glow);
    for (const x of [-43, 18]) strip(x, s * 28, x, s * 36, 1.5, 1.2, 0.01, seam);
  }

  // ---- the bed: an armoured hull under the launcher, rear deck with vents and lights
  ext(poly([[36, -28], [-88, -28], [-97, -20], [-97, 20], [-88, 28], [36, 28]]), 0.4, 0.95, armor, { bevel: 0.08 });
  ext(rr(-60, -21, 94, 42, 4), 1.35, 0.06, top, { bevel: 0.02 });                       // deck plate under the launcher
  for (const x of [-30, 8]) strip(x, -21, x, 21, 1.5, 1.42, 0.01, seam);
  rect(-93, -19, 22, 38, 1.35, 0.04, dark, { dirt: 0 });                                // rear vents
  for (const y of [-16, -9, -2, 5, 12]) rect(-90, y, 16, 4, 1.39, 0.01, black, { dirt: 0, cast: false });
  for (const s of [-1, 1]) {
    rect(-99, s < 0 ? -30 : 25, 3, 5, 0.62, 0.32, glow, { dirt: 0, cast: false });    // rear lights in team colour
    brake(-99, s < 0 ? -19 : 13, 4, 6, 0.95);
  }
  grime(-94, -36, 130, 72, 1.0, 0.8, 41);
  // ram mounts and a reload hatch at the front of the bed (seen when the launcher is up)
  for (const s of [-1, 1]) rect(2, s * 14 - 4, 10, 8, 1.41, 0.18, dark, { dirt: 0 });
  rect(16, -10, 14, 20, 1.41, 0.04, dark, { dirt: 0 });
  for (const y of [-7, -1, 5]) rect(18, y, 10, 2.5, 1.45, 0.01, black, { dirt: 0, cast: false });
  rect(32, -26, 4, 52, 1.0, 0.5, seam, { dirt: 0 });                                    // the joint behind the cab

  // ---- the cab: a wedge nose, sloping upper armour, a sensor-slit eye across the prow
  ext(poly([[100, 0], [92, -22], [84, -30], [36, -30], [36, 30], [84, 30], [92, 22]]), 0.4, 1.22, armor, { bevel: 0.08 });
  ext(poly([[94, 0], [84, -20], [76, -25], [40, -25], [40, 25], [76, 25], [84, 20]]), 1.62, 0.22, top, { bevel: 0.05 });
  ext(rr(42, -19, 28, 38, 4), 1.84, 0.06, roof, { bevel: 0.02 });
  for (const [a, b, c, d] of [[94, 0, 72, 0], [72, -25, 72, 25]]) strip(a, b, c, d, 2, 1.85, 0.01, seam);
  grime(38, -30, 62, 60, 1.85, 0.7, 17);
  ext(poly([[86, -16], [92, -6], [92, 6], [86, 16], [82, 14], [87, 4], [87, -4], [82, -14]]), 1.84, 0.1, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  for (const s of [-1, 1]) strip(97.5, s * 5, 92.5, s * 17, 4, 1.3, 0.16, lamp, { cast: false }); // headlight bars on the nose chamfers
  disc(61, 8, 6.5, 1.9, 0.05, M.plain('#2d3236', 0.55, 0.5)); L.hoop(6.5 * k, 0.02, steel, 61 * k, 1.95, 8 * k, R.O()); // roof hatch
  disc(46, 12, 2.6, 1.9, 0.14, amber, { cast: false });                                  // the beacon
  // a small sensor mast, as on the warbot's turret
  L.cyl(1.4 * k, 0.3, M.plain('#15171a', 0.6, 0.5), 52 * k, 1.9, -12 * k, R.O({ dirt: 0 }));
  ext(rr(44, -15, 16, 6, 3), 2.2, 0.05, M.plain('#c9cdd1', 0.4, 0.3), { bevel: 0.01 });
  disc(52, -12, 2.2, 2.25, 0.04, eye(TEAM, 1, 0.3), { cast: false });

  // ---- the launcher: an armoured box pivoting at its rear foot, lying flat or raised steeply toward the front
  const PX = -70, PY = 1.5, LEN = 102, H = 1.15, th = up ? 0.9 : 0;
  for (const s of [-1, 1]) rect(-72, s * 17 - 3, 104, 6, 1.35, 0.15, dark, { dirt: 0 });  // the cradle rails
  const rack = L.group(PX * k, PY, 0, 0, G); rack.rotation.z = th;
  const P = (o = {}) => Object.assign({ parent: rack }, o);
  L.hcyl(0.15, 1.5, steel, 0.06, 0.08, 0, P({ axis: 'z', dirt: 0 }));                      // the hinge
  ext(poly([[0, -15], [8, -24], [LEN, -24], [LEN, 24], [8, 24], [0, 15]]), 0, H, armor, P({ bevel: 0.08 }));
  // the lid: two raised armour plates over the two columns of tubes, wedge-cut at the front, team chevrons across them
  for (const s of [-1, 1]) {
    ext(poly([[6, s * 3], [LEN - 14, s * 3], [LEN - 3, s * 10], [LEN - 3, s * 20], [14, s * 20], [6, s * 13]]), H, 0.12, roof, P({ bevel: 0.04 }));
    for (const x of [LEN - 30, LEN - 40]) strip(x, s * 4, x - 8, s * 19, 4.5, H + 0.13, 0.02, paintT, P());
    strip(26, s * 4, 26, s * 19, 1.5, H + 0.13, 0.01, seam, P());
  }
  strip(4, 0, LEN, 0, 3, H + 0.01, 0.02, black, P());                                       // the valley between the plates
  { const g = grime(6, -20, LEN - 8, 40, H + 0.1, 0.7, 29); rack.add(g); }
  // the front face: a dark plate with four tube mouths, rocket noses inside, a thin team ring round each
  const FX = LEN * k;
  L.box(0.05, H - 0.1, 1.76, dark, FX + 0.025, 0.05, 0, P({ dirt: 0 }));
  const ring = new THREE.TorusGeometry(0.205, 0.022, 8, 32); ring.rotateY(Math.PI / 2);
  const cone = new THREE.ConeGeometry(0.14, 0.2, 18); cone.rotateZ(-Math.PI / 2);
  for (const yy of [0.3, 0.83]) for (const zz of [-0.45, 0.45]) {
    L.hcyl(0.25, 0.08, steel, FX + 0.04, yy, zz, P({ seg: 28, dirt: 0 }));
    L.hcyl(0.195, 0.09, black, FX + 0.045, yy, zz, P({ seg: 28, dirt: 0 }));
    L.mesh(cone, nose, FX + 0.04, yy, zz, P({ dirt: 0 }));
    L.mesh(ring, team, FX + 0.09, yy, zz, P({ dirt: 0, cast: false }));
  }
  // the elevating rams: from mounts on the bed up to the box's belly
  const c = Math.cos(th), sn = Math.sin(th), bx = PX * k + 60 * k * c, by = PY + 60 * k * sn;
  for (const s of [-1, 1]) {
    const A = [7 * k, 1.5, s * 14 * k], B = [bx, by, s * 14 * k], M2 = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, A[2]];
    beamL(A, M2, 0.2, 0.2, dark, { dirt: 0 }); beamL(M2, B, 0.11, 0.11, steel, { dirt: 0 });
  }

  // ---- deployed: four stabiliser legs swung out from the bed's corners onto the ground
  if (up) for (const x of [24, -86]) for (const s of [-1, 1]) {
    ext(poly([[x - 5, s * 26], [x + 5, s * 26], [x + 4, s * 54], [x - 4, s * 54]]), 1.0, 0.24, armor, { bevel: 0.04 });
    strip(x, s * 30, x, s * 50, 1.5, 1.25, 0.01, seam);
    disc(x, s * 58, 8, 0.02, 0.12, M.plain('#24272b', 0.7, 0.4), { seg: 8 });             // foot pad
    disc(x, s * 58, 4, 0.14, 1.0, steel);                                                  // the jack
  }

  // looking straight down, the studio environment reflects off every flat top: keep reflections low (as robkit's finish)
  const seen = new Set();
  L.getRoot().traverse(o => { if (o.isMesh && !seen.has(o.material) && o.material.envMapIntensity !== undefined) { seen.add(o.material); o.material.envMapIntensity *= o.material.emissiveIntensity > 0 ? 1 : 0.35; } });
}
