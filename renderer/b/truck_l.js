// Freight Truck, "Lancer" restyle: the rocket truck's family on a civilian flatbed. Top-down, facing +x (right),
// orthographic camera straight down, no ground and no shadow; 10 world units across the 384-px frame, the truck 8.5 x 3.86.
// Gunmetal armour, the three axles half under armoured side skirts carrying team-colour light strips, a long open
// flatbed (kept clear: the game draws the cargo crates on it, world x -3.92..1.48, z -1.2..1.2) behind a slatted
// headboard with a team-painted cap, a wedge cab with the glowing sensor-slit eye, LED headlight bars, an amber beacon and the two motor vents,
// twin gunmetal exhaust stacks behind the cab, team rear lights. Coordinates in robkit px (1 px = 1/25.6 unit).
//   ?f=k     driving frame k (0..3): every tyre rolled forward by k/4 of one tread-block pitch
//   ?part=   truck (default) | brake (only the two rear brake lenses, lit) | boost (only the cab's motor vents, glowing)
// Kept from b/truck.js: tyre axles and size, flatbed span, brake lenses (world -4.1, +-1.28), motor-vent slots
// (world 1.92, +-0.72), exhaust tips (marks ex0 / ex1 at world 1.62, 3.1, -+1.72), headlamps at the nose corners (~4.1, +-1.15).
import { lancer } from './lancertruck.js';
export const config = { pad: false, size: 768 };
export default function (L) {
  const { M, TEAM, THREE } = L;
  const part = new URLSearchParams(location.search).get('part') || 'truck';
  L.seed(611);
  const V = lancer(L), { R, k, m, mir } = V, { rect, rr, poly, ext, disc, strip, tyre, grime, hazard } = R;
  const deck = M.paint('#596067', { panelW: 128, panelH: 512 }), rib = M.plain('#2c3135', 0.6, 0.5), haz = hazard('#f0a030');

  // ---- running gear: three axles (steer under the cab, a close pair under the bed); the outer half shows past the skirts
  for (const x of [2.95, -1.55, -3.05]) for (const s of [-1, 1]) tyre(x / k, s * 41.5, 15.9, 15.9, { blocks: 18 });
  rect(-104, -24, 204, 48, 0.3, 0.5, m.dark, { dirt: 0 });                                 // chassis frame
  for (const s of [-1, 1]) {
    // one long armoured skirt per side over the inner half of the wheels, a team light strip along its top
    ext(poly(mir([[106, 26], [101, 42], [-100, 42], [-107, 37], [-107, 26]], s)), 0.62, 0.6, m.armor, { bevel: 0.06 });
    strip(-99, s * 38.5, 97, s * 38.5, 3, 1.23, 0.02, m.glow);
    for (const x of [53, -12, -59]) strip(x, s * 40.5, x, s * 42, 1.5, 1.22, 0.01, m.seam);
  }

  // ---- the flatbed: armoured bed hull, a plain grooved deck, low rails with stake pockets, tie-down rings
  ext(poly([[40, -36], [-101, -36], [-108.5, -29], [-108.5, 29], [-101, 36], [40, 36]]), 0.4, 0.76, m.armor, { bevel: 0.06 });
  rect(-102.4, -34, 139.5, 68, 1.16, 0.14, deck, { dirt: 0 });
  for (let y = -28; y <= 28; y += 8) rect(-101, y - 0.8, 137, 1.6, 1.3, 0.015, rib, { dirt: 0, cast: false });
  for (const x of [-74, -46, -18, 10]) strip(x, -33, x, 33, 1.2, 1.3, 0.012, m.seam);
  grime(-102, -34, 139, 68, 1.32, 1.0, 3);
  for (const s of [-1, 1]) {
    ext(rr(-103, s < 0 ? -36 : 32, 141, 4, 1.5), 1.16, 0.28, m.top, { bevel: 0.03 });
    for (const x of [-95, -67, -39, -11, 17]) rect(x - 2, s * 34 - 2.5, 4, 5, 1.16, 0.33, m.dark, { dirt: 0 });
    for (const x of [-83, -55, -27, 1]) {
      const r = new THREE.TorusGeometry(2.4 * k, 0.025, 8, 16); r.rotateX(Math.PI / 2);
      L.mesh(r, M.plain('#a7aeb3', 0.4, 0.8), x * k, 1.33, s * 28.5 * k, R.O({ dirt: 0 }));
    }
  }
  // slatted headboard guarding the cab
  ext(rr(34.5, -36, 5, 72, 1.5), 1.16, 0.9, m.top, { bevel: 0.03 });
  ext(rr(35, -34.5, 4, 69, 1), 2.05, 0.02, M.paint(TEAM, { rivets: false }), { bevel: 0.005 });            // team-painted cap
  for (let y = -28; y <= 28; y += 8) strip(35, y, 39, y, 2, 2.075, 0.01, m.black);
  rect(39.5, -34, 2, 68, 0.9, 0.5, m.seam, { dirt: 0 });                                   // the joint behind the cab

  // ---- the tail: an armoured bumper with a hazard band, the brake lenses, team-colour corner lights
  ext(poly([[-102, -46], [-106, -46], [-109, -42], [-109, 42], [-106, 46], [-102, 46]]), 0.5, 0.74, m.armor, { bevel: 0.05 });
  ext(rr(-107.5, -24, 4.5, 48, 1), 1.22, 0.04, haz, { bevel: 0.01 });
  for (const s of [-1, 1]) {
    V.brake(-107.6, s * 32.8 - 3.07, 5.1, 6.14, 1.24);
    rect(-109, s * 41.5 - 3, 3.2, 6, 0.8, 0.42, m.glow, { dirt: 0, cast: false });
  }

  // ---- the cab
  const C = V.cab({ x0: 41, xf: 108.5, xc: 101, hw: 35, nf: 20, y0: 0.45, yt: 1.72, roof: [60, -23, 29, 46] });
  V.hatch(75, 9, 6.5, C.yu + 0.07);
  V.beacon(65, 17, C.yu + 0.07);
  V.mast(83, -13, C.yu + 0.07);
  // the two motor vents at the back of the roof (the boost pass lights their slots)
  const ventGlow = [];
  for (const s of [-1, 1]) {
    L.box(0.42, 0.08, 0.95, m.dark, 1.92, C.yu, s * 0.72, R.O({ dirt: 0 }));
    L.box(0.34, 0.03, 0.85, M.grille('#3d4247'), 1.92, C.yu + 0.08, s * 0.72, R.O({ dirt: 0 }));
    for (let i = 0; i < 4; i++) ventGlow.push(L.box(0.28, 0.02, 0.1, M.dark, 1.92, C.yu + 0.09, s * 0.72 - 0.3 + i * 0.2, R.O({ dirt: 0, cast: false })));
  }

  // ---- twin exhaust stacks beside the back of the cab; marks at the tips
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const x = 1.62, z = s * 1.72, top = 3.05;
    V.stack(x, z, top);
    L.box(0.3, 0.1, 0.24, m.armor, x + 0.1, 1.0, z - s * 0.13, R.O({ dirt: 0 }));               // bracket to the cab
    L.mark('ex' + i, x, top + 0.05, z);
  }

  V.finish(part, { boost: ventGlow.map(b => [b, M.emit('#bfe4ff', 2.6)]) });
}
