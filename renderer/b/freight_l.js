// Freight Train cars, "Lancer" restyle (design study for b/freight.js). Same camera, frame, footprint and parts:
// top-down, facing +x (right), orthographic straight down, 10 units across the frame (256 px final). Every car is
// 8 units coupler to coupler (80 %) and 4 units wide (40 %), symmetric about z = 0, with bogie wheels on the rail
// lines (z = +-2.19). In the Lancer robots' language: dark gunmetal armour in three shades with thin dark seams,
// armoured side skirts over the inner half of the wheels carrying team-colour light strips, amber hazard headstocks.
//   loco:   a wedge-nosed armoured cab with a glowing sensor-slit eye and white LED headlight bars on the nose bumper
//           (the lamps stay at x 3.77, z +-0.85 where the headlight overlays expect them), a long armoured hood with
//           two radiator fans in dark wells, the exhaust vent at the centre (x 0, z 0, under the exhaust overlay), a
//           folded pantograph, an amber beacon and a sensor mast on the cab, team-colour tail lights and the brake
//           lenses at x -3.72, z +-1.3 (where the brake overlay expects them).
//   flat:   a gunmetal flat car: the plank deck left open where the game draws the load (x +-3.44, z +-1.84).
//   hopper: an armoured open hopper with ribbed walls and a team strip on the top chord; the opening is kept clear
//           (x +-3.24, z +-1.8) for the load the game draws.
//   ?part=loco (default) | flat | hopper | brake (loco rear lenses only, lit) | heads (loco headlight lenses only, lit)
//   ?f=k   loco frame k (0..3): roof fans turn 1/4 of a blade gap, wheels a quarter turn
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { box, cyl, hcyl, mesh, beam, group, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), part = p.get('part') || 'loco';
  L.seed(1501);
  // the Lancer kit: the same straight-down 10-unit camera as before, the robots' toned-down overhead light, helpers
  const R = kit(L, 0, 0), { poly, ext, strip, grime, eye } = R, k = R.k, PX = 1 / k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), seam = M.plain('#101214', 0.8);
  const steel = M.plain('#626970', 0.3, 0.85), glow = M.emit(TEAM, 1.1), haz = R.hazard('#f0a030');
  const deckP = M.paint('#4a5056', { panelW: 128, panelH: 512 }), lampW = M.emit('#fff1d0', 2.2), amber = M.emit('#ff9a2a', 1.3);

  // world-unit wrappers round the kit's px helpers: a plan outline [[x, z], ...] extruded up from y0, and flat strips
  const slab = (pts, y0, h, mat, o = {}) => ext(poly(pts.map(([x, z]) => [x * PX, z * PX])), y0, h, mat, o);
  const line = (x1, z1, x2, z2, w, y0, h, mat, o = {}) => strip(x1 * PX, z1 * PX, x2 * PX, z2 * PX, w * PX, y0, h, mat, o);
  const mir = (pts) => [...pts, ...pts.slice().reverse().map(([x, z]) => [x, -z])];      // mirror a half outline (z < 0) to z > 0

  const RZ = 2.19, WR = 0.5;                                       // rail line, wheel radius
  // ---- bogie: two wheelsets on the rail lines, outboard gunmetal side frames with dark spring nests
  function bogie(bx, roll) {
    for (const ax of [-0.75, 0.75]) {
      hcyl(0.07, RZ * 2, M.steel, bx + ax, WR, 0, { axis: 'z' });
      for (const s of [-1, 1]) {
        const w = group(bx + ax, WR, s * RZ); w.rotation.z = -roll;
        const tg = new THREE.CylinderGeometry(WR, WR, 0.2, 40, 1); tg.rotateX(Math.PI / 2);
        mesh(tg, M.steel, 0, 0, 0, { parent: w, dirt: 0 });
        const fl = new THREE.CylinderGeometry(WR + 0.06, WR + 0.06, 0.05, 40, 1); fl.rotateX(Math.PI / 2);
        mesh(fl, armor, 0, 0, -s * 0.11, { parent: w, dirt: 0 });
        for (const a of [0.3, 2.4, 4.1]) {                                       // scuffs on the tread so the roll reads
          const b = new THREE.BoxGeometry(0.16, 0.03, 0.21); b.translate(0, WR + 0.003, 0);
          const m = mesh(b, M.plain('#2a2b2d', 0.7), 0, 0, 0, { parent: w, dirt: 0 }); m.rotation.z = a;
        }
      }
    }
    for (const s of [-1, 1]) {
      const z = s * (RZ + 0.2);
      box(2.2, 0.32, 0.14, armor, bx, 0.55, z, { dirt: 0 });                        // side frame
      box(0.6, 0.5, 0.18, top, bx, 0.45, z, { dirt: 0 });                            // spring nest
      for (const ax of [-0.75, 0.75]) box(0.34, 0.3, 0.2, dark, bx + ax, 0.38, z, { dirt: 0 });   // axle boxes
      for (const dx of [-0.15, 0.15]) cyl(0.07, 0.3, steel, bx + dx, 0.5, z, { seg: 10, dirt: 0 });
    }
    box(0.5, 0.3, RZ * 2 - 0.4, dark, bx, 0.75, 0, { dirt: 0 });                    // bolster
  }
  function coupler(xe, sgn) {
    box(0.5, 0.22, 0.26, dark, xe - sgn * 0.12, 0.95, 0, { dirt: 0 });
    const kk = new THREE.Shape(); kk.moveTo(0, -0.2); kk.lineTo(0.18, -0.2); kk.lineTo(0.22, 0.05); kk.lineTo(0.1, 0.22); kk.lineTo(0, 0.12); kk.closePath();
    const g = new THREE.ExtrudeGeometry(kk, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); if (sgn < 0) g.rotateY(Math.PI);
    mesh(g, top, xe - sgn * 0.08, 1.08, 0, { dirt: 0 });
    hcyl(0.035, 0.3, M.steel, xe - sgn * 0.45, 1.05, 0.28, { axis: 'x' });          // cut lever / air hose
    hcyl(0.04, 0.35, M.plain('#1a1b1c', 0.8), xe - sgn * 0.45, 0.95, -0.22, { axis: 'x' });
  }
  // the headstock: an amber hazard bumper with chamfered ends (the Lancer hauler's)
  function headstock(x, sgn, w = 1.95) {
    box(0.26, 0.4, w * 2, dark, x, 0.8, 0, { dirt: 0 });
    const a = x - sgn * 0.13, b = x + sgn * 0.13;
    slab([[a, -w], [b - sgn * 0.06, -w], [b, -w + 0.12], [b, w - 0.12], [b - sgn * 0.06, w], [a, w]], 1.08, 0.14, haz, { bevel: 0.02 });
  }
  // armoured side skirts over the inner half of the wheels, a team light strip along each, seams across them
  function skirts(x0, x1, y0 = 0.72, h = 0.62, gaps = []) {
    for (const s of [-1, 1]) {
      slab([[x0, s * 1.8], [x1, s * 1.8], [x1 - 0.12, s * 2.16], [x0 + 0.12, s * 2.16]], y0, h, armor, { bevel: 0.05 });
      line(x0 + 0.3, s * 2.0, x1 - 0.3, s * 2.0, 0.11, y0 + h + 0.005, 0.02, glow);
      for (const x of gaps) line(x, s * 1.82, x, s * 2.14, 0.05, y0 + h, 0.012, seam);
    }
  }
  const roll = f * Math.PI / 2;
  const brakeLens = [], headLens = [];
  const finish = () => {   // the kit's finish: low reflections on flat tops looking straight down
    const seen = new Set();
    L.getRoot().traverse(o => { if (o.isMesh && !seen.has(o.material) && o.material.envMapIntensity !== undefined) { seen.add(o.material); o.material.envMapIntensity *= o.material.emissiveIntensity > 0 ? 1 : 0.35; } });
  };

  if (part === 'flat') {
    for (const bx of [-2.5, 2.5]) bogie(bx, 0);
    box(7.3, 0.4, 3.0, dark, 0, 0.85, 0, { dirt: 0 });                             // centre sill / underframe
    const X0 = -3.62, X1 = 3.62, DY = 1.25;
    box(X1 - X0, 0.12, 3.76, deckP, 0, DY - 0.12, 0, { dirt: 0 });
    grime(-3.5 * PX, -1.84 * PX, 7 * PX, 3.68 * PX, DY + 0.002, 1.0, 5);
    for (let x = X0 + 0.6; x < X1 - 0.3; x += 0.6) box(0.04, 0.012, 3.4, M.plain('#2c3135', 0.6, 0.5), x, DY, 0, { dirt: 0, cast: false });
    skirts(-3.55, 3.55, 0.72, 0.66, [-1.2, 1.2]);
    for (const s of [-1, 1]) {
      for (let x = X0 + 0.45; x < X1 - 0.3; x += 0.9) box(0.14, 0.1, 0.1, dark, x, DY, s * 1.86, { dirt: 0 });   // stake pockets
      for (let x = X0 + 0.9; x < X1 - 0.5; x += 1.8) { const r = new THREE.TorusGeometry(0.07, 0.02, 8, 14); r.rotateX(Math.PI / 2); mesh(r, M.plain('#a7aeb3', 0.4, 0.8), x, DY + 0.02, s * 1.6, { dirt: 0 }); }
    }
    for (const s of [-1, 1]) {                                                     // low armoured end bulkheads
      const a = s * 3.5, b = s * 3.7;
      slab([[a, -1.84], [b, -1.7], [b, 1.7], [a, 1.84]], DY - 0.05, 0.5, top, { bevel: 0.03 });
      line(s * 3.6, -1.6, s * 3.6, 1.6, 0.04, DY + 0.45, 0.01, seam);
      headstock(s * 3.72, s); coupler(s * 3.95, s);
      for (const z of [-1.55, 1.55]) box(0.08, 0.08, 0.18, glow, s * 3.79, 1.0, z, { dirt: 0, cast: false });   // team marker lamps
    }
    finish(); return;
  }

  if (part === 'hopper') {
    for (const bx of [-2.5, 2.5]) bogie(bx, 0);
    box(7.3, 0.4, 3.0, dark, 0, 0.85, 0, { dirt: 0 });
    const X0 = -3.35, X1 = 3.35, Z = 1.9, H0 = 1.15, H1 = 2.75, t = 0.1;
    skirts(-3.55, 3.55, 0.72, 0.62, [-1.2, 1.2]);
    // the open box: armoured walls with vertical ribs, a chamfered top chord carrying the team strip
    for (const s of [-1, 1]) {
      box(X1 - X0, H1 - H0, t, armor, 0, H0, s * (Z - t / 2), { dirt: 0.5, dirtH: 1.2 });
      box(t, H1 - H0, Z * 2, armor, s * (X1 - t / 2), H0, 0, { dirt: 0.5, dirtH: 1.2 });
      for (let x = X0 + 0.45; x < X1 - 0.3; x += 0.75) box(0.1, H1 - H0 - 0.12, 0.12, top, x, H0, s * (Z + 0.04), { dirt: 0 });   // external ribs
      slab([[X0 - 0.05, s * (Z - 0.1)], [X1 + 0.05, s * (Z - 0.1)], [X1 + 0.05, s * (Z + 0.06)], [X0 - 0.05, s * (Z + 0.06)]], H1 - 0.04, 0.1, top, { bevel: 0.02 });
      slab([[s * (X1 - 0.1), -Z + 0.06], [s * (X1 + 0.06), -Z + 0.06], [s * (X1 + 0.06), Z - 0.06], [s * (X1 - 0.1), Z - 0.06]], H1 - 0.04, 0.1, top, { bevel: 0.02 });
      line(X0 + 0.25, s * (Z - 0.02), X1 - 0.25, s * (Z - 0.02), 0.07, H1 + 0.065, 0.02, glow);
      headstock(s * 3.72, s); coupler(s * 3.95, s);
      for (const z of [-1.2, 1.2]) beam([s * 3.62, 1.2, z], [s * (X1 - 0.05), H1 - 0.1, z], 0.1, 0.1, top);   // end platform braces
      line(s * (X1 - 0.02), -1.5, s * (X1 - 0.02), 1.5, 0.06, H1 + 0.065, 0.01, haz);                         // hazard on the end chords
    }
    // angular corner gussets on the top chord (the Lancer wedge language)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab([[sx * (X1 + 0.06), sz * (Z - 0.5)], [sx * (X1 + 0.06), sz * (Z + 0.06)], [sx * (X1 - 0.5), sz * (Z + 0.06)]], H1 + 0.04, 0.05, armor, { bevel: 0.015 });
    const dk = M.plain('#141210', 0.95), inner = M.plain('#1e1c1a', 0.9);
    // sloped floors: two hopper bays meeting at a ridge in the middle, chutes at the bottom
    const IX0 = X0 + t, IX1 = X1 - t, IZ = Z - t;
    for (const [a, b] of [[IX0, -0.1], [0.1, IX1]]) {
      const mid = (a + b) / 2, half = (b - a) / 2;
      for (const s of [-1, 1]) beam([mid - s * half, H1 - 0.35, 0], [mid - s * 0.2, H0 + 0.25, 0], IZ * 2, 0.05, inner);
      box(0.4, 0.05, IZ * 2 - 0.6, dk, mid, H0 + 0.2, 0, { dirt: 0, cast: false });
    }
    box(0.22, H1 - H0 - 0.25, IZ * 2, inner, 0, H0, 0, { dirt: 0 });                                   // centre ridge
    box(0.3, 0.06, IZ * 2, armor, 0, H1 - 0.28, 0, { dirt: 0 });
    for (const x of [-1.75, 1.75]) beam([x, H1 - 0.12, -IZ], [x, H1 - 0.12, IZ], 0.08, 0.08, armor);  // cross ties
    finish(); return;
  }

  // ================= locomotive =================
  for (const bx of [-2.6, 2.6]) bogie(bx, roll);
  box(7.4, 0.42, 3.0, dark, 0, 0.8, 0, { dirt: 0 });                                   // underframe
  for (const s of [-1, 1]) hcyl(0.5, 2.6, armor, 0, 0.75, s * 0.9, { axis: 'x' });     // fuel tank between the bogies
  skirts(-3.58, 3.42, 0.72, 0.6, [-1.3, 0, 1.3]);
  for (const s of [-1, 1]) { headstock(s * 3.72, s); coupler(s * 3.95, s); }
  // the lower hull: a long armoured deck, chamfered at the tail and cut to a wedge at the nose
  const DY = 1.3, HY = 2.9;
  slab(mir([[-3.6, -1.45], [-3.32, -1.78], [2.8, -1.78], [3.5, -1.1], [3.64, -0.55]]), 0.95, DY - 0.95, armor, { bevel: 0.06 });
  slab(mir([[-3.5, -1.4], [-3.27, -1.68], [2.74, -1.68], [3.4, -1.05], [3.52, -0.55]]), DY, 0.06, top, { bevel: 0.02 });
  grime(-3.6 * PX, -1.78 * PX, 7.2 * PX, 3.56 * PX, DY + 0.065, 0.8, 23);
  // the long hood: armoured sides, a lighter top plate with seams, chamfered at the rear
  const HX0 = -3.3, HX1 = 2.1;
  slab(mir([[HX0, -1.05], [HX0 + 0.28, -1.36], [HX1, -1.36]]), DY + 0.06, HY - DY - 0.06, armor, { bevel: 0.08 });
  slab(mir([[HX0 + 0.12, -0.95], [HX0 + 0.36, -1.22], [HX1 - 0.05, -1.22]]), HY, 0.06, top, { bevel: 0.02 });
  for (const x of [-1.9, -0.6, 0.6]) line(x, -1.22, x, 1.22, 0.04, HY + 0.06, 0.01, seam);
  slab([[-0.5, -1.0], [2.0, -1.0], [2.0, 1.0], [-0.5, 1.0]], HY + 0.06, 0.04, roof, { bevel: 0.015 });   // raised roof plate over the pantograph
  grime(HX0 * PX, -1.3 * PX, (HX1 - HX0) * PX, 2.6 * PX, HY + 0.065, 0.7, 31);
  // rear deck vents and the tail: team-colour tail lights, the brake lenses (x -3.72, z +-1.3) on the rear headstock
  for (const s of [-1, 1]) {
    box(0.22, 0.14, 0.34, dark, -3.72, 1.2, s * 1.3, { dirt: 0 });
    brakeLens.push(box(0.16, 0.04, 0.26, M.plain('#5a1414', 0.35), -3.72, 1.34, s * 1.3, { dirt: 0, cast: false }));
    box(0.12, 0.08, 0.28, glow, -3.62, DY - 0.02, s * 1.6, { dirt: 0, cast: false });
  }
  // two radiator fans in dark wells at the rear of the hood (they turn with f)
  const NB = 7;
  for (const fx of [-2.4, -1.25]) {
    cyl(0.6, 0.06, dark, fx, HY + 0.02, 0, { seg: 48, dirt: 0 });
    cyl(0.54, 0.02, black, fx, HY + 0.08, 0, { seg: 48, dirt: 0 });
    const fg = group(fx, HY + 0.1, 0); fg.rotation.y = -(f / 4) * (Math.PI * 2 / NB);
    for (let kk = 0; kk < NB; kk++) {
      const bl = new THREE.BoxGeometry(0.44, 0.02, 0.15); bl.translate(0.27, 0, 0); bl.rotateX(0.35);
      const m = mesh(bl, M.plain('#6b737b', 0.5, 0.6), 0, 0, 0, { parent: fg, dirt: 0 }); m.rotation.y = kk * Math.PI * 2 / NB;
    }
    cyl(0.1, 0.07, top, 0, 0, 0, { seg: 20, dirt: 0, parent: fg });
    for (const r of [0.3, 0.56]) L.hoop(r, 0.016, M.plain('#2a2f34', 0.5, 0.6), fx, HY + 0.17, 0);
    for (let kk = 0; kk < 6; kk++) { const a = kk * Math.PI / 3 + 0.3; beam([fx + Math.cos(a) * 0.1, HY + 0.17, Math.sin(a) * 0.1], [fx + Math.cos(a) * 0.58, HY + 0.17, Math.sin(a) * 0.58], 0.025, 0.025, M.plain('#2a2f34', 0.5, 0.6)); }
  }
  // the exhaust vent at the centre of the hood (under the exhaust overlay)
  slab(mir([[-0.42, -0.34], [0.42, -0.34]]), HY + 0.06, 0.06, dark, { bevel: 0.015 });
  for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) line(x, -0.26, x, 0.26, 0.07, HY + 0.12, 0.01, black);
  // a folded pantograph on its insulators
  for (const [x, z] of [[0.75, -0.55], [0.75, 0.55], [1.85, -0.55], [1.85, 0.55]]) cyl(0.075, 0.2, M.plain('#c9cdd1', 0.4, 0.3), x, HY + 0.06, z, { seg: 12, dirt: 0 });
  for (const z of [-0.6, 0.6]) slab([[0.66, z - 0.05], [1.94, z - 0.05], [1.94, z + 0.05], [0.66, z + 0.05]], HY + 0.26, 0.06, top, { bevel: 0.015 });
  for (const x of [0.7, 1.9]) slab([[x - 0.05, -0.6], [x + 0.05, -0.6], [x + 0.05, 0.6], [x - 0.05, 0.6]], HY + 0.26, 0.06, top, { bevel: 0.015 });
  beam([0.85, HY + 0.38, -0.4], [1.9, HY + 0.44, 0.0], 0.06, 0.06, steel); beam([0.85, HY + 0.38, 0.4], [1.9, HY + 0.44, 0.0], 0.06, 0.06, steel);
  beam([1.9, HY + 0.44, 0], [0.8, HY + 0.52, 0], 0.05, 0.05, steel);
  box(0.1, 0.05, 1.4, M.plain('#8d959c', 0.3, 0.9), 0.78, HY + 0.52, 0, { dirt: 0 });   // pan head

  // ---- the cab: a raised armoured block with a lighter roof, a wedge nose stepped down in front of it
  const CX0 = 2.1, CY = 3.1, NY = 2.25;
  slab(mir([[CX0, -1.5], [2.95, -1.5], [3.12, -1.2]]), DY + 0.06, CY - DY - 0.06, armor, { bevel: 0.08 });
  slab(mir([[CX0 + 0.1, -1.36], [2.85, -1.36], [3.02, -1.1]]), CY, 0.06, roof, { bevel: 0.02 });
  grime(CX0 * PX, -1.4 * PX, 0.95 * PX, 2.8 * PX, CY + 0.065, 0.6, 13);
  line(2.62, -1.36, 2.62, 1.36, 0.04, CY + 0.06, 0.01, seam);
  // the nose: the cab's lower front, wedge-cut, carrying the sensor-slit eye
  slab(mir([[2.9, -1.5], [3.3, -1.18], [3.6, -0.55]]), DY + 0.06, NY - DY - 0.06, armor, { bevel: 0.07 });
  slab(mir([[3.0, -1.32], [3.28, -1.08], [3.5, -0.5]]), NY, 0.05, top, { bevel: 0.02 });
  slab([[3.12, -1.05], [3.38, -0.8], [3.5, -0.28], [3.5, 0.28], [3.38, 0.8], [3.12, 1.05], [3.02, 0.92], [3.27, 0.7], [3.37, 0.24], [3.37, -0.24], [3.27, -0.7], [3.02, -0.92]], NY + 0.04, 0.1, eye(TEAM, 1.3, 0.32), { bevel: 0.01, cast: false });
  // LED headlight bars on the nose bumper (the headlight lenses: x 3.77, z +-0.85), amber corner markers
  for (const s of [-1, 1]) {
    box(0.16, 0.1, 0.62, dark, 3.75, 1.2, s * 0.85, { dirt: 0 });
    headLens.push(box(0.1, 0.06, 0.54, lampW, 3.77, 1.3, s * 0.85, { dirt: 0, cast: false }));
    box(0.1, 0.1, 0.14, amber, 3.74, 1.22, s * 1.6, { dirt: 0, cast: false });
  }
  // cab roof: a hatch, the amber beacon, a sensor mast with a team lens, a team chevron
  { const g = new THREE.CylinderGeometry(0.2, 0.2, 0.04, 28); L.mesh(g, M.plain('#2d3236', 0.55, 0.5), 2.4, CY + 0.08, 0.6, { dirt: 0 }); L.hoop(0.2, 0.015, steel, 2.4, CY + 0.1, 0.6); }
  cyl(0.12, 0.1, dark, 2.3, CY + 0.06, -0.85, { seg: 20, dirt: 0 }); cyl(0.09, 0.08, amber, 2.3, CY + 0.16, -0.85, { seg: 20, dirt: 0, cast: false });
  cyl(0.05, 0.3, M.plain('#15171a', 0.6, 0.5), 2.72, CY + 0.06, -0.5, { seg: 10, dirt: 0 });
  slab([[2.58, -0.66], [2.86, -0.66], [2.86, -0.38], [2.58, -0.38]], CY + 0.36, 0.04, M.plain('#c9cdd1', 0.4, 0.3), { bevel: 0.01 });
  cyl(0.07, 0.03, eye(TEAM, 1, 0.3), 2.72, CY + 0.4, -0.5, { seg: 16, dirt: 0, cast: false });
  finish();

  if (part === 'brake' || part === 'heads') {
    L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; });
    for (const m of (part === 'brake' ? brakeLens : headLens)) { m.visible = true; m.material = M.emit(part === 'brake' ? '#ff2a1e' : '#fff1c8', 4); }
  }
}
