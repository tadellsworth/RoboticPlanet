// Smelter: blast furnace with a glowing mouth and molten runner, tall soot-stained stack, ingot casting bed.
// ?part=work&f=k: only the furnace mouth, the molten runner, the glowing ingots and the furnace-lit window, at frame k of
// an 8-frame flicker (embers are drawn on top afterwards from the 'mouth' mark).
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips round the furnace crown, the
// catwalk edge, the plinth and the eaves, warm lit windows, a transformer yard with arcing insulators feeding a
// conduit into the furnace, a floodlight pole, cables and beacons). Its lights are team-coloured: render one image per
// team. The layer is added to the base render only, never to part= renders, so the work loops still line up.
import { workLayer, litMat } from './worklib.js';
import { power } from './powerkit.js';
const FLICK = { mouth: [1.0, 1.3, 0.8, 1.15, 0.72, 1.35, 0.9, 1.12], runner: [1.0, 1.1, 0.95, 1.05, 0.88, 1.12, 0.97, 1.04], window: [1.0, 1.15, 0.9, 1.07, 0.85, 1.18, 0.95, 1.06] };
export default function (L) {
  const q = new URLSearchParams(location.search), PART = q.get('part'), WORK = PART === 'work', F = +(q.get('f') || 0);
  const parts = { mouth: [], runner: [], window: [] }, P = (k, m, hex, i) => (parts[k].push([m, hex, i]), m);
  const { box, cyl, hoop, pipe, ringWalk, ladder, lamp, pointLight, ao, catwalk, M, ACCENT } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), off = M.paint('#c8c2b5'), rib = M.ribbed('#b9b3a6');
  const hot = M.emit(ACCENT, 3.2), white = M.emit('#ffd896', 4);
  const fx = -1.1, fz = -0.6;

  // furnace plinth and body
  box(4.6, 0.5, 4.6, M.concrete, fx, 0, fz); ao(fx, fz, 4.6, 4.6, 0.5);
  box(4.6, 0.12, 0.05, M.hazard, fx, 0.32, fz + 2.31, { dirt: 0 });
  cyl(1.95, 3.3, gun, fx, 0.5, fz, { dirtH: 1.4 });
  for (const y of [1.3, 2.4, 3.5]) hoop(1.98, 0.09, M.steel, fx, y, fz);
  cyl(1.95, 1.0, gun, fx, 3.8, fz, { rTop: 1.15, dirt: 0 });
  cyl(1.2, 0.45, M.steel, fx, 4.8, fz, { dirt: 0 });
  cyl(0.85, 0.06, M.dark, fx, 5.25, fz, { dirt: 0 });

  // mouth hood, glowing opening and molten runner to the casting bed
  box(1.7, 1.6, 0.9, M.steel, fx, 0.5, fz + 1.75);
  box(2.0, 0.22, 1.05, M.hazard, fx, 2.1, fz + 1.75, { dirt: 0 });
  P('mouth', box(1.05, 0.95, 0.06, white, fx, 0.62, fz + 2.21, { cast: false }), '#ffd896', 4);
  L.mark('mouth', fx, 1.0, fz + 2.3); L.mark('mouthOut', fx, 1.0, fz + 3.3);
  box(0.7, 0.3, 2.0, M.steel, fx, 0, fz + 3.15);
  P('runner', box(0.42, 0.03, 1.95, hot, fx, 0.29, fz + 3.15, { cast: false }), ACCENT, 3.2);
  box(2.4, 0.3, 0.7, M.steel, fx + 1.0, 0, 3.4);
  P('runner', box(2.3, 0.03, 0.42, hot, fx + 1.0, 0.29, 3.4, { cast: false }), ACCENT, 3.2);
  pointLight(ACCENT, 26, fx, 1.1, fz + 2.8, 6);

  // ingot casting bed
  const bx = 2.6, bz = 2.6;
  box(3.4, 0.45, 2.4, warm, bx, 0, bz); ao(bx, bz, 3.4, 2.4, 0.45);
  box(3.4, 0.1, 0.05, M.hazard, bx, 0.3, bz + 1.21, { dirt: 0 });
  const cells = [[-1, -0.5, 1], [0, -0.5, 1], [1, -0.5, 0], [-1, 0.5, 0], [0, 0.5, 1], [1, 0.5, 0]];
  for (const [i, j, glowing] of cells) {
    const x = bx + i * 1.0, z = bz + j * 1.0;
    box(0.82, 0.04, 0.66, M.dark, x, 0.45, z, { dirt: 0, cast: false });
    if (glowing) P('runner', box(0.7, 0.05, 0.54, hot, x, 0.45, z, { cast: false }), ACCENT, 3.2);
    else box(0.68, 0.22, 0.5, M.steel, x, 0.45, z, { dirt: 0 });
  }
  pointLight(ACCENT, 10, bx, 1.2, bz, 4);

  // chimney stack (back right) on a concrete base, with duct from the furnace top
  const sx = 2.9, sz = -3.1;
  box(1.8, 0.7, 1.8, M.concrete, sx, 0, sz); ao(sx, sz, 1.8, 1.8, 0.5);
  cyl(0.68, 6.4, gun, sx, 0.7, sz, { soot: 2.4, dirtH: 1.2 });
  for (const y of [2.2, 3.8, 5.4]) hoop(0.71, 0.06, M.steel, sx, y, sz);
  cyl(0.78, 0.25, M.dark, sx, 7.0, sz, { dirt: 0 });
  cyl(0.5, 0.02, M.emit(ACCENT, 0.8), sx, 7.22, sz, { cast: false });
  pipe([[fx, 5.0, fz], [fx, 6.0, fz], [sx - 0.6, 6.0, sz + 0.35]], 0.42, warm);
  for (const y of [1.5, 3.0, 4.5, 6.0]) box(0.12, 0.12, 0.9, M.steel, sx - 0.75, y, sz, { dirt: 0 });

  // blower house (back left) with hot-blast pipe into the furnace
  const hx = -3.65, hz = -3.35;
  box(2.4, 2.1, 2.3, rib, hx, 0, hz); ao(hx, hz, 2.4, 2.3, 0.5);
  box(2.6, 0.18, 2.5, off, hx, 2.1, hz, { dirt: 0 });
  cyl(0.32, 0.5, M.steel, hx - 0.5, 2.28, hz - 0.3); cyl(0.32, 0.5, M.steel, hx + 0.5, 2.28, hz - 0.3);
  box(0.9, 1.4, 0.06, M.dark, hx + 0.3, 0, hz + 1.16, { dirt: 0.5 });
  pipe([[hx + 1.2, 1.5, hz + 0.6], [fx - 0.8, 1.5, hz + 0.6], [fx - 0.8, 1.5, fz - 1.4]], 0.28, M.steel);

  // catwalk ring around the furnace with a ladder
  ringWalk(fx, 2.6, fz, 1.98, 2.55, { posts: 18 });
  ladder(fx + 2.75, 0.5, 2.6, fz + 0.2, { ry: Math.PI / 2 });

  // small control cabin by the casting bed with a window lit by the furnace glow
  const cx = 3.5, cz = -0.3;
  box(1.9, 1.5, 1.6, off, cx, 0, cz); ao(cx, cz, 1.9, 1.6, 0.45);
  box(2.05, 0.14, 1.75, gun, cx, 1.5, cz, { dirt: 0 });
  P('window', box(1.2, 0.45, 0.05, M.emit('#ffc27a', 1.4), cx, 0.75, cz + 0.81, { cast: false }), '#ffc27a', 1.4);
  box(0.5, 0.35, 0.5, M.grille(), cx - 0.4, 1.64, cz);
  lamp(fx - 1.55, 2.0, fz + 1.4, ACCENT, { size: 0.16, intensity: 3, dist: 3 });

  // ================================================================ power layer (lights and electricity), base render only
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: round the furnace crown, along the catwalk's outer edge, the plinth's front edge and the eaves
    hoop(1.23, 0.035, K.glow, fx, 4.83, fz, { cast: false });
    hoop(2.57, 0.026, K.glow, fx, 2.56, fz, { cast: false });
    K.strip(4.5, fx, 0.45, fz + 2.32);
    K.strip(2.6, hx, 2.07, hz + 1.27);
    K.strip(2.0, cx, 1.47, cz + 0.89);
    // chimney: a team band near the top and amber obstruction beacons on the cap
    hoop(0.71, 0.035, K.glow, sx, 6.72, sz, { cast: false });
    for (const s of [-1, 1]) K.beacon(sx + s * 0.6, 7.32, sz + 0.25, '#ffb347');
    // warm lit windows on the blower house; a lamp over the cabin door side
    K.windows(0.85, 0.32, hx - 0.72, 1.25, hz + 1.17, 0, 2);
    box(0.16, 0.1, 0.1, K.steelD, cx + 0.75, 1.28, cz + 0.84, { dirt: 0 }); box(0.12, 0.05, 0.03, K.warm, cx + 0.75, 1.3, cz + 0.89, nc);
    // transformer yard at the front left: hazard-framed plate, a transformer with arcing insulators, a conduit to a
    // junction box and on up the plinth into a control box on the furnace
    const tx = -3.35, tz = 3.4;
    box(1.25, 0.03, 1.05, K.dark, tx, 0, tz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, tx, tz - 0.52], [1.25, 0.08, tx, tz + 0.52], [0.08, 1.05, tx - 0.62, tz], [0.08, 1.05, tx + 0.62, tz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(tx, tz, 0);
    K.junction(-2.15, 2.3, 0);
    K.conduit([[tx + 0.45, 0.14, tz], [-2.15, 0.14, tz], [-2.15, 0.14, 2.52]], 0.05);
    K.conduit([[-2.15, 0.56, 2.1], [-2.15, 0.56, 1.12], [-2.15, 1.15, 1.12]], 0.055);
    box(0.34, 0.4, 0.16, K.steel, -2.15, 1.12, 1.1, { dirt: 0.3 }); box(0.06, 0.06, 0.03, K.green, -2.22, 1.4, 1.19, nc); box(0.06, 0.06, 0.03, K.glow, -2.08, 1.4, 1.19, nc);
    // floodlight pole with a crossarm at the plinth's front-left corner: fed from the transformer, and on to the blower house
    const px = -4.35, pz = 1.55;
    K.flood(px, pz, 2.75, 0.55);
    box(0.7, 0.06, 0.08, K.steelD, px, 2.35, pz, { dirt: 0 });
    for (const s of [-1, 1]) cyl(0.03, 0.12, M.plain('#c9c2b0', 0.4, 0.1), px + s * 0.3, 2.41, pz, { seg: 8, dirt: 0 });
    K.cable([tx - 0.28, 1.17, tz], [px - 0.3, 2.53, pz], 0.25);
    K.cable([tx + 0.28, 1.17, tz], [px + 0.3, 2.53, pz], 0.3);
    K.cable([px + 0.3, 2.53, pz], [hx - 1.15, 2.2, hz + 1.2], 0.3);
    // a floodlight by the cabin lighting the casting bed; team beacons on the furnace crown, the blower house and the cabin
    K.flood(4.45, 1.05, 2.3, -0.6);
    K.beacon(fx - 0.85, 5.33, fz + 0.75);
    K.beacon(hx + 0.5, 2.86, hz - 0.3);
    K.beacon(cx + 0.7, 1.72, cz - 0.5);
  }

  if (WORK) {
    const keep = new Set();
    for (const k in parts) for (const [m, hex, i] of parts[k]) { m.material = litMat(L, hex, i, FLICK[k][F]); keep.add(m); }
    workLayer(L, keep);
  }
}
