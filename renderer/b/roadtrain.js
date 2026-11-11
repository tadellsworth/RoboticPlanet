// Road Train, "Lancer" restyle: a heavy prime mover in the rocket truck's family, and its flatbed trailer. Top-down,
// facing +x (right), orthographic camera straight down, no ground and no shadow; 10 world units across the frame (256 px
// final). Coordinates in robkit px (1 px = 1/25.6 unit) or world units where noted.
//   ?part=tractor (default) | trailer | brake (only the tractor's two rear brake lenses, lit)
//   ?f=k   tractor driving frame k (0..3): every tyre rolled forward by k/4 of one tread-block pitch
// Tractor: a tall wedge cab-over with the sensor-slit eye, LED headlight bars, an amber beacon and a team light bar on the
// brow; armoured side pods (in place of the chrome fuel tanks) and skirts carry one team light line from tail to nose;
// twin gunmetal stacks; the air lines and the fifth wheel behind. Trailer: a long armoured flatbed, the deck kept clear for
// the game's cargo (inside the rails, world x -2.93..2.19, z -1.41..1.41), aero skirts with the same team light line.
// Kept from b/roadtrain.js: axles and tyres, fifth wheel (world -2.55) and kingpin (2.75): 5.3 apart, brake lenses
// (tractor -4.25 / trailer -2.85, +-1.28), exhaust marks ex0 / ex1 at (1.25, 3.66, -+1.22), headlamps (~4.15, +-1.2).
import { lancer } from './lancertruck.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM, THREE } = L;
  const part = new URLSearchParams(location.search).get('part') || 'tractor';
  L.seed(733);
  const V = lancer(L), { R, k, m, mir } = V, { rect, rr, poly, ext, disc, strip, tyre, grime, hazard } = R, O = R.O;
  const deck = M.paint('#596067', { panelW: 128, panelH: 512 }), rib = M.plain('#2c3135', 0.6, 0.5), haz = hazard('#f0a030');
  const grease = M.plain('#1b1c1d', 0.35, 0.4);
  const T = 41.5, TR = 15.9;                                                               // outer tyre track (px), tyre radius
  // the tail: armoured bumper with a hazard band, brake lenses at +-1.28, team-colour lights at the outer corners
  function tail(xr) {
    const x = xr / k;
    ext(poly([[x + 7, -46], [x + 3, -46], [x, -42], [x, 42], [x + 3, 46], [x + 7, 46]]), 0.5, 0.74, m.armor, { bevel: 0.05 });
    ext(rr(x + 1.5, -24, 4.5, 48, 1), 1.22, 0.04, haz, { bevel: 0.01 });
    for (const s of [-1, 1]) {
      V.brake((xr + 0.05) / k, s * 32.8 - 3.07, 5.1, 6.14, 1.24);
      rect(x, s * 41.5 - 3, 3, 6, 0.8, 0.42, m.glow, { dirt: 0, cast: false });
    }
  }

  if (part === 'trailer') {
    // ---- flatbed trailer: 6 units bumper to coupler, two rear axles, kingpin plate at the right
    for (const x of [-1.05, -2.3]) for (const s of [-1, 1]) tyre(x / k, s * T, TR, TR, { blocks: 18 });
    L.box(5.3, 0.35, 1.6, m.dark, -0.3, 0.55, 0, O({ dirt: 0 }));                      // frame
    for (const s of [-1, 1]) {
      // full-length aero skirt over the inner half of the bogie, the team light line along its top
      ext(poly(mir([[58, 26], [55, 43], [-72, 43], [-77, 38], [-77, 26]], s)), 0.62, 0.62, m.armor, { bevel: 0.06 });
      strip(-72, s * 40.5, 53, s * 40.5, 3, 1.25, 0.02, m.glow);
      for (const x of [-43, 10]) strip(x, s * 42, x, s * 43, 1.5, 1.24, 0.01, m.seam);
    }
    // the bed: armoured hull, the grooved deck, rails with stake pockets, tie-down rings
    ext(poly([[58, -38], [-71, -38], [-76, -33], [-76, 33], [-71, 38], [58, 38]]), 0.45, 0.72, m.armor, { bevel: 0.06 });
    rect(-75.5, -37, 131.8, 74, 1.16, 0.14, deck, { dirt: 0 });
    for (let y = -32; y <= 32; y += 8) rect(-74, y - 0.8, 129, 1.6, 1.3, 0.015, rib, { dirt: 0, cast: false });
    for (const x of [-48, -20, 8, 36]) strip(x, -36, x, 36, 1.2, 1.3, 0.012, m.seam);
    grime(-75, -37, 131, 74, 1.32, 1.0, 5);
    for (const s of [-1, 1]) {
      ext(rr(-76, s < 0 ? -39 : 35.5, 133, 3.5, 1.4), 1.16, 0.28, m.top, { bevel: 0.03 });
      for (const x of [-70, -42, -14, 14, 42]) rect(x - 2, s * 37.2 - 2.5, 4, 5, 1.16, 0.33, m.dark, { dirt: 0 });
      for (const x of [-56, -28, 0, 28]) {
        const r = new THREE.TorusGeometry(2.4 * k, 0.025, 8, 16); r.rotateX(Math.PI / 2);
        L.mesh(r, M.plain('#a7aeb3', 0.4, 0.8), x * k, 1.33, s * 32 * k, O({ dirt: 0 }));
      }
    }
    // front bulkhead: slatted armour, a team light along its top
    ext(rr(56, -39, 5, 78, 1.5), 1.16, 0.8, m.top, { bevel: 0.03 });
    for (let y = -32; y <= 32; y += 8) strip(56.5, y, 60.5, y, 2, 1.97, 0.01, m.black);
    strip(58.5, -36, 58.5, 36, 1.4, 1.97, 0.012, M.emit(TEAM, 0.8));
    // gooseneck / upper coupler plate: an armoured wedge stepping down to the kingpin (world 2.75), hazard edge
    L.box(0.36, 0.16, 2.3, m.dark, 2.5, 1.0, 0, O({ dirt: 0 }));
    ext(poly([[62, -24], [69, -24], [75.5, -14], [75.5, 14], [69, 24], [62, 24]]), 0.98, 0.16, m.armor, { bevel: 0.03 });
    ext(poly([[73, -13], [75.5, -12], [75.5, 12], [73, 13]]), 1.12, 0.03, haz, { bevel: 0.005 });
    L.cyl(0.12, 0.05, m.steel, 2.75, 1.12, 0, O({ seg: 20, dirt: 0 }));
    for (const s of [-1, 1]) {                                                             // landing-leg cranks, air / electric couplers
      L.box(0.2, 0.12, 0.2, m.dark, 1.7, 1.0, s * 1.62, O({ dirt: 0 }));
      L.cyl(0.07, 0.06, M.paint('#b8352a', { rivets: false }), 2.42, 1.3, s * 0.35, O({ seg: 14, dirt: 0 }));
    }
    L.cyl(0.07, 0.06, M.paint('#2f5aa8', { rivets: false }), 2.42, 1.3, 0, O({ seg: 14, dirt: 0 }));
    tail(-3.0);
    V.finish('trailer');
    return;
  }

  // ---- tractor: heavy cab-over prime mover, 8.8 units long, three axles (steer + tandem drive with duals)
  for (const s of [-1, 1]) tyre(3.0 / k, s * T, TR, TR, { blocks: 18 });
  for (const ax of [-1.85, -3.3]) for (const s of [-1, 1]) { tyre(ax / k, s * T, TR, TR, { blocks: 18 }); tyre(ax / k, s * 0.96 / k, TR, TR, { blocks: 18 }); }
  for (const s of [-1, 1]) L.box(8.1, 0.32, 0.22, m.dark, -0.2, 0.62, s * 0.55, O({ dirt: 0 }));        // frame rails, cross members
  for (const x of [-3.9, -2.55, -0.9, 0.6]) L.box(0.18, 0.2, 1.3, m.dark, x, 0.7, 0, O({ dirt: 0 }));
  for (const ax of [-1.85, -3.3]) { L.box(0.3, 0.3, 1.1, m.armor, ax, 0.48, 0, O({ dirt: 0 })); L.hcyl(0.16, 1.2, m.armor, ax, 0.62, 0, O({ axis: 'z' })); }
  // fifth-wheel coupling plate between the drive axles: round plate with a V slot opening to the rear
  {
    const Rp = 1.05, sh = new THREE.Shape(), a0 = Math.PI - 0.42, a1 = -Math.PI + 0.42;
    sh.absarc(0, 0, Rp, a1 + 2 * Math.PI, a0, true); sh.lineTo(0.05, 0.07); sh.lineTo(0.05, -0.07); sh.closePath();
    const shape = new THREE.Shape(sh.getPoints(64));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 48 });
    g.rotateX(-Math.PI / 2); L.mesh(g, m.armor, -2.55, 1.12, 0, O({ dirt: 0 }));
    const tp = new THREE.ShapeGeometry(shape, 48); tp.rotateX(-Math.PI / 2); L.mesh(tp, grease, -2.55, 1.30, 0, O({ dirt: 0, cast: false }));
    L.box(0.12, 0.05, 0.6, M.hazard, -3.1, 1.29, 0, O({ dirt: 0, cast: false }));
    for (const s of [-1, 1]) L.box(1.3, 0.3, 0.2, m.dark, -2.55, 0.85, s * 0.7, O({ dirt: 0 }));
    L.beam([-2.4, 1.25, 1.0], [-2.3, 1.25, 1.45], 0.05, 0.05, M.paint('#d0a536', { rivets: false }), O());
    for (const s of [-1, 1]) L.beam([-3.4, 1.1, s * 0.7], [-4.1, 0.85, s * 0.7], 0.32, 0.06, m.armor, O());
  }
  // armoured skirts over the drive bogie and the steer axle; side pods between them; one team light line along both sides
  for (const s of [-1, 1]) {
    ext(poly(mir([[-30, 27], [-33, 42], [-105, 42], [-109, 37], [-109, 27]], s)), 0.62, 0.62, m.armor, { bevel: 0.06 });
    ext(poly(mir([[-26, 27], [-22, 47], [24, 47], [28, 42], [28, 27]], s)), 0.55, 0.85, m.armor, { bevel: 0.08 });   // the side pod
    ext(rr(-20, s < 0 ? -47 : 42, 42, 5, 1.5), 1.4, 0.04, M.grating, { bevel: 0.01 });                                 // step on the pod
    ext(poly(mir([[107, 26], [102, 42], [44, 42], [40, 38], [40, 26]], s)), 0.62, 0.62, m.armor, { bevel: 0.06 });
    strip(-104, s * 39.5, -36, s * 39.5, 3, 1.25, 0.02, m.glow);
    strip(-22, s * 39.5, 23, s * 39.5, 3, 1.41, 0.02, m.glow);
    strip(46, s * 39.5, 98, s * 39.5, 3, 1.25, 0.02, m.glow);
    for (const x of [-68]) strip(x, s * 40, x, s * 42, 1.5, 1.24, 0.01, m.seam);
  }
  tail(-4.4);
  // deck behind the cab: toolbox, air tanks and the coiled air / electric lines to the trailer
  L.box(1.9, 0.08, 1.9, deck, -0.15, 1.18, 0, O({ dirt: 0 }));
  L.box(0.7, 0.42, 0.9, m.armor, -0.55, 1.26, 0.35, O({ dirt: 0 }));
  L.box(0.66, 0.03, 0.86, m.top, -0.55, 1.68, 0.35, O({ dirt: 0 }));
  for (const z of [-0.35, 0.35]) L.hcyl(0.17, 1.0, m.steel, 0.35, 1.0, z, O({ axis: 'x' }));
  for (const [col, dz, r] of [['#b8352a', -0.45, 0.28], ['#2f5aa8', -0.05, 0.24]]) {
    const pts = [];
    for (let i = 0; i <= 120; i++) { const t = i / 120, a = t * Math.PI * 2 * 3.2; pts.push(new THREE.Vector3(0.65 - t * 2.0 + Math.cos(a) * r * 0.5, 1.75 - t * 0.35, dz + Math.sin(a) * r)); }
    L.mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.035, 8, false), M.plain(col, 0.45, 0.05), 0, 0, 0, O({ dirt: 0 }));
  }
  // twin gunmetal exhaust stacks behind the cab, the air cleaner between them; marks at the tips
  for (const s of [-1, 1]) {
    const x = 1.25, z = s * 1.22;
    V.stack(x, z, 3.6, 0.6);
    L.mark('ex' + (s < 0 ? 0 : 1), x, 3.66, z);
  }
  L.cyl(0.28, 1.7, m.armor, 1.15, 0.9, 0.0, O({ seg: 28, dirt: 0 })); L.cyl(0.3, 0.08, m.dark, 1.15, 2.6, 0.0, O({ seg: 28, dirt: 0 }));

  // ---- the cab-over cab: tall, with a team light bar on the brow
  const C = V.cab({ x0: 40, xf: 109.6, xc: 102, hw: 37, nf: 22, y0: 0.5, yt: 2.25, roof: [52, -25, 34, 50], grime: 23 });
  const yr = C.yu + 0.07;
  rect(88, -30, 6, 60, C.yu, 0.12, m.dark, { dirt: 0 });                                   // light bar housing
  for (let i = 0; i < 5; i++) rect(89.5, -26 + i * 11.5 - 2.5, 3, 5, C.yu + 0.12, 0.04, M.emit(TEAM, 1.1), { dirt: 0, cast: false });
  V.hatch(68, 10, 7, yr);
  V.beacon(57, -18, yr);
  V.mast(76, -15, yr);
  for (const s of [-1, 1]) L.hcyl(0.06, 0.6, m.steel, 1.95, yr + 0.08, s * 0.62, O({ axis: 'x' }));     // air horns
  // a low armoured front bumper under the prow (to the old bumper line, world 4.4) with a hazard band
  ext(poly([[112.6, -30], [110.5, -40], [104, -42], [104, 42], [110.5, 40], [112.6, 30]]), 0.55, 0.5, m.armor, { bevel: 0.04 });
  ext(poly([[112.2, -26], [112.2, 26], [109, 26], [109, -26]]), 1.05, 0.03, haz, { bevel: 0.005 });
  // mirrors on short arms at the cab's front corners
  for (const s of [-1, 1]) {
    L.beam([3.7, 2.0, s * 1.4], [3.85, 2.05, s * 1.9], 0.05, 0.05, m.dark, O());
    L.box(0.12, 0.42, 0.14, m.dark, 3.85, 1.75, s * 1.93, O({ dirt: 0 }));
  }

  V.finish(part);
}
