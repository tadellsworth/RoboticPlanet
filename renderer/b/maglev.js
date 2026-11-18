// The Maglev line (IDEAS.md "High-speed transit"): an elevated guideway on pylons, run straight across anything between
// two Maglev Terminals, with pods carrying goods at several times a Freight Train's speed. A design study in three
// directions for the owner to choose from. Direction A is installed in the game (tools/render_maglev_game.sh, then
// tools/install_maglev.py), with B's hazard chevrons on its pylon caps. `v=` picks the direction, `c=` the piece:
//   v=a  Accord Phase 2: the civic transit plan built at last. Pale weathered concrete and gunmetal: slender tapering
//        pylons with a hammerhead cap, a slim box-girder guideway with a team-colour power rail along each edge, a
//        round glass-sided terminal hall with a lit platform ring on its roof (empty shelters and benches at its
//        door), and sleek rounded white pods with a band of lit windows and a roof hatch for the freight.
//   v=b  Industrial freight: the robots' own answer, kin to the Rail Station and the Mooring Mast. Four-legged steel
//        lattice pylons on hazard-banded footings with a heavy cap girder, a boxy steel trough guideway with the power
//        rails glowing on its inner walls, a terminal that is a loading gantry (a steel platform on lattice legs, a
//        crane over the dock, containers at its foot), and open-rack container pods that show their goods.
//   v=c  Monorail on the ground: half the height. A single pale concrete beam on squat round piers, a low-slung
//        depot terminal (a round platform beside a bus-depot shed), and double-ended bullet pods that hug the beam
//        with a glowing underside.
//   c=terminal (default)  the Terminal: a one-tile building on the usual pad, building camera; marks 'head' (where
//                         the guideway meets it, on the pod's dock at deck-top height) and 'dock' (the same point).
//   c=pylon               one pylon, building camera, no pad; marks 'head' (the deck top over it) and 'foot'.
//                         state=cut: the pylon shot down (v=a only): a sheared stump, the fallen column, broken deck.
//   c=pod                 a pod, straight down, facing +x, 10 units across the frame (as the train cars); load=0 empty.
//   c=deck                one tile of guideway, straight down, running along x, 10 units across (for the game to
//                         stretch along a line; the night render carries the power rails' glow).
//   c=scene               a presentation view (not a game sprite): the Terminal on its pad with the guideway leaving
//                         it, two pylons closer together than in the game, a loaded pod on the span, on open ground,
//                         framed wide (1600 x 1000) at the buildings' angle.
// World units: the pad's 10 are one tile. Deck tops (DECK[v].y) are 6.0 (a), 5.6 (b) and 3.0 (c) units up.
// Powered realism (b/powerkit.js): team-colour light strips and power rails, lit windows, beacons, floodlights.
import { power } from './powerkit.js';
import { kit } from './robkit.js';
const Q = new URLSearchParams(location.search);
const V = Q.get('v') || 'a', C = Q.get('c') || 'terminal', CUT = Q.get('state') === 'cut', LOAD = Q.get('load') !== '0';
export const config = C === 'scene' ? { w: 1600, h: 1000 } : (C === 'pod' || C === 'deck') ? { pad: false, size: 512 } : C === 'pylon' ? { pad: false } : {};
// the guideway: deck-top height, width and depth, in world units
export const DECK = { a: { y: 6.0, w: 2.4, d: 0.7 }, b: { y: 5.6, w: 3.6, d: 1.2 }, c: { y: 3.0, w: 1.8, d: 1.1 } };
const PI = Math.PI;

export default function (L) {
  L.seed(6100 + V.charCodeAt(0) * 3 + C.length * 7);
  const P = power(L), T = mats(L, P);
  if (C === 'pod') { kit(L, 0, 0); pod(L, P, T, V, LOAD, L.getRoot()); return; }
  if (C === 'deck') { kit(L, 0, 0); deckRun(L, P, T, V, L.group(0, 0, 0), -5.2, 5.2, DECK[V].d); return; }
  if (C === 'pylon') { pylon(L, P, T, V, 0, 0, CUT); L.mark('head', 0, DECK[V].y, 0); L.mark('foot', 0, 0, 0); return; }
  if (C === 'scene') { scene(L, P, T, V); return; }
  const head = terminal(L, P, T, V);
  L.mark('head', ...head); L.mark('dock', ...head);
}

function mats(L, P) {
  const { M } = L;
  return {
    gun: M.paint('#50565c'), gunD: M.paint('#3f4449', { rivets: false }), conc: M.rough('#8f887c'), concD: M.rough('#7a746a'),
    white: M.paint('#cbc6bb', { rivets: false }), whiteR: M.ribbed('#d0cbc1'), pale: M.rough('#c2bbae'), grey: M.ribbed('#8d9094'),
    steel: M.plain('#626970', 0.3, 0.85), dark: M.plain('#1b1d20', 0.6, 0.3), yel: M.paint('#b08a30', { rivets: false }),
    yelL: M.plain('#d4ae3a', 0.6, 0), asphalt: M.plain('#353638', 0.85, 0), red: M.emit('#ff3a22', 2.4), nc: { dirt: 0, cast: false },
  };
}
// a red aviation light on a short stalk
function avLight(L, T, x, y, z) { L.cyl(0.03, 0.26, T.dark, x, y, z, { seg: 8, dirt: 0 }); L.sphere(0.085, T.red, x, y + 0.3, z, { cast: false }); }
// a rounded-rectangle outline in world units (x, z: the corner nearest -x, -z), for ext()
function rrect(L, x, z, w, d, r) {
  const { THREE } = L, s = new THREE.Shape(); r = Math.min(r, w / 2, d / 2);
  const T = (px, pz) => [px, -pz];                                             // shape y runs to -z once rotated flat
  s.moveTo(...T(x + r, z)); s.lineTo(...T(x + w - r, z)); s.quadraticCurveTo(...T(x + w, z), ...T(x + w, z + r));
  s.lineTo(...T(x + w, z + d - r)); s.quadraticCurveTo(...T(x + w, z + d), ...T(x + w - r, z + d));
  s.lineTo(...T(x + r, z + d)); s.quadraticCurveTo(...T(x, z + d), ...T(x, z + d - r));
  s.lineTo(...T(x, z + r)); s.quadraticCurveTo(...T(x, z), ...T(x + r, z));
  return s;
}
// a flat outline extruded up from y0 by h with soft bevelled edges (as the robots' kit does)
function ext(L, shape, y0, h, mat, o = {}) {
  const { THREE } = L, bev = Math.min(o.bevel ?? 0.05, h / 3);
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.002, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 3, curveSegments: 18 });
  g.rotateX(-PI / 2); g.translate(0, y0 + bev, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  return L.mesh(g, mat, 0, 0, 0, { dirt: 0.25, dirtH: 1.2, ...o });
}

// ================================================================================================= the guideway
// one straight run along x from x0 to x1, its top at y, centred on z = 0 of group g
export function deckRun(L, P, T, v, g, x0, x1, y) {
  const { box, M } = L, len = x1 - x0, cx = (x0 + x1) / 2, D = DECK[v], O = (e = {}) => ({ parent: g, ...e });
  const joints = (step, w) => { for (let x = Math.ceil(x0 / step) * step; x < x1 - 0.1; x += step) box(0.06, 0.02, w, T.dark, x, y + 0.004, 0, O(T.nc)); };
  if (v === 'a') {
    box(len, D.d, D.w, T.white, cx, y - D.d, 0, O({ dirt: 0.2, dirtH: 0.4 }));                      // the box girder
    box(len, 0.1, D.w + 0.12, T.gunD, cx, y - D.d - 0.1, 0, O({ dirt: 0 }));                       // its soffit plate
    for (const s of [-1, 1]) {
      box(len, 0.12, 0.16, T.steel, cx, y - 0.02, s * 0.9, O({ dirt: 0 }));                         // the guide rails
      box(len, 0.06, 0.08, P.glow, cx, y, s * (D.w / 2 - 0.08), O(T.nc));                           // the power rail along each edge
    }
    box(len, 0.03, 0.5, T.dark, cx, y - 0.01, 0, O(T.nc));                                          // the stator strip
    joints(2.5, D.w);
  } else if (v === 'b') {
    box(len, 0.4, D.w, T.gunD, cx, y - D.d, 0, O({ dirt: 0.3 }));                                   // the trough floor
    box(len, 0.03, D.w - 0.7, M.grating, cx, y - D.d + 0.4, 0, O({ dirt: 0 }));
    for (const s of [-1, 1]) {
      box(len, D.d, 0.26, T.gun, cx, y - D.d, s * (D.w / 2 - 0.13), O({ dirt: 0.2, dirtH: 0.6 }));  // the walls
      box(len, 0.08, 0.08, P.glow, cx, y - 0.5, s * (D.w / 2 - 0.3), O(T.nc));                      // the power rail on each inner wall
      box(len, 0.06, 0.3, T.yel, cx, y - 0.02, s * (D.w / 2 - 0.15), O({ dirt: 0 }));               // painted top chord
    }
    for (let x = Math.ceil(x0 / 1.25) * 1.25; x < x1 - 0.1; x += 1.25) box(0.18, 0.14, D.w - 0.6, T.gunD, x, y - D.d + 0.4, 0, O({ dirt: 0 }));   // cross ribs
    box(len, 0.05, 0.7, M.grating, cx, y - 0.35, D.w / 2 + 0.35, O({ dirt: 0 }));                   // the walkway along the south side
    box(len, 0.04, 0.04, T.yel, cx, y + 0.35, D.w / 2 + 0.68, O({ dirt: 0 }));
    for (let x = Math.ceil(x0 / 1.25) * 1.25; x < x1 - 0.1; x += 1.25) box(0.05, 0.7, 0.05, T.yel, x, y - 0.3, D.w / 2 + 0.68, O({ dirt: 0 }));
  } else {
    box(len, D.d, D.w, T.pale, cx, y - D.d, 0, O({ dirt: 0.25, dirtH: 0.5 }));                      // the beam
    for (const s of [-1, 1]) box(len, 0.08, 0.1, T.steel, cx, y - 0.02, s * 0.72, O({ dirt: 0 }));  // the guide rails on its shoulders
    box(len, 0.03, 0.14, P.glowSoft, cx, y - 0.005, 0, O(T.nc));                                    // the stator groove, lit
    joints(2.5, D.w);
  }
}

// ================================================================================================= pylons
function pylon(L, P, T, v, x, z, cut) { ({ a: pylonA, b: pylonB, c: pylonC }[v])(L, P, T, x, z, cut); }

function pylonA(L, P, T, x, z, cut) {
  const { box, cyl, beam, sphere, pipe, hoop, mesh, ao, M, THREE } = L, D = DECK.a, Y = D.y - D.d;   // Y: the deck's underside
  cyl(1.5, 0.35, T.concD, x, 0, z, { seg: 8, dirtH: 0.3 });                                            // octagonal footing
  cyl(1.52, 0.12, M.hazard, x, 0.18, z, { seg: 8, dirt: 0, open: true });
  ao(x, z, 2.6, 2.6, 0.45);
  if (!cut) {
    const H = Y - 0.7 - 0.35;
    cyl(0.85, H, T.white, x, 0.35, z, { seg: 24, rTop: 0.6, dirtH: 2.4 });                             // the tapering column
    hoop(0.63, 0.04, T.gunD, x, Y - 1.4, z);
    box(D.w + 0.6, 0.5, 1.1, T.gunD, x, Y - 0.7, z, { dirt: 0 });                                       // the hammerhead cap
    for (const s of [-1, 1]) box(0.3, 0.52, 1.12, M.hazard, x + s * ((D.w + 0.6) / 2 - 0.15), Y - 0.7, z, { dirt: 0 });   // B's hazard chevrons on the cap's ends (the owner's mix, Nov 2026)
    box(D.w + 0.3, 0.2, 0.9, T.steel, x, Y - 0.2, z, { dirt: 0 });                                      // the deck saddle
    beam([x, 1.0, z + 0.9], [x, Y - 0.95, z + 0.66], 0.07, 0.07, P.glow, { cast: false });              // a team strip up the front face
    box(0.4, 0.5, 0.06, T.dark, x, 0.45, z + 0.84, { dirt: 0 });                                        // an access hatch
    avLight(L, T, x + (D.w + 0.6) / 2 - 0.12, Y - 0.2, z);
    return;
  }
  // shot down: a sheared stump, the column lying beside it with its cap, broken deck slabs, rebar, a scorched ground
  const SH = 2.1;
  cyl(0.85, SH - 0.35, T.white, x, 0.35, z, { seg: 24, rTop: 0.8, dirtH: 1.2 });
  cyl(0.8, 0.06, M.plain('#17130f', 0.9), x, SH, z, { seg: 24, dirt: 0 });                             // the charred break
  for (let k = 0; k < 7; k++) { const a = k * 0.9 + 0.3, r = 0.55 + 0.2 * Math.sin(k * 2.1); box(0.22 + 0.1 * (k % 3), 0.25 + 0.3 * ((k * 7) % 3) / 2, 0.2, T.white, x + Math.cos(a) * r, SH, z + Math.sin(a) * r, { dirt: 0.5, dirtH: 0.2, ry: a }); }   // the jagged rim
  for (const [dx, dz] of [[0.3, 0.1], [-0.25, 0.3], [0.05, -0.35]]) pipe([[x + dx, SH, z + dz], [x + dx * 1.8, SH + 0.9, z + dz * 1.6]], 0.03, T.dark);   // rebar
  { // the fallen column: a frustum lying on the ground, pointing south-east, its cap still on it
    const ry = -0.55, len = Y - 0.7 - SH;
    const g = new THREE.CylinderGeometry(0.6, 0.78, len, 24, 1); g.rotateZ(PI / 2); g.translate(len / 2 + 1.3, 0.72, 0);
    mesh(g, T.white, x, 0, z, { ry, dirt: 0.4, dirtH: 0.8 });
    const cap = new THREE.BoxGeometry(0.5, 1.4, D.w + 1.0); cap.translate(len + 1.55, 0.72, 0); cap.rotateX(0.35);
    mesh(cap, T.gunD, x, 0.1, z, { ry, dirt: 0 });
    const sl = new THREE.BoxGeometry(2.6, 0.5, 1.6); sl.rotateZ(0.42); sl.translate(len + 0.6, 0.9, 1.9);
    mesh(sl, T.white, x, 0, z, { ry, dirt: 0.3 });                                                     // a broken deck slab leaning on it
    const sl2 = new THREE.BoxGeometry(3.0, 0.6, 1.3); sl2.rotateY(0.3); sl2.translate(-2.4, 0, -1.6);
    mesh(sl2, T.white, x, 0, z, { ry: 0, dirt: 0.3 });                                                 // another on the ground behind
    box(0.1, 0.05, 1.2, P.glowHi, x - 2.5, 0.62, z - 1.6, { dirt: 0, cast: false, ry: 0.3 });           // a live power rail on it
    L.pointLight(L.TEAM, 1.6, x - 2.5, 0.9, z - 1.6, 2.4);
    for (let k = 0; k < 9; k++) { const a = k * 1.4, r = 1.3 + 0.9 * ((k * 5) % 4) / 3; cyl(0.1 + 0.06 * (k % 3), 0.14, T.concD, x + Math.cos(a) * r, 0.3 * (k === 2 || k === 6 ? 1 : 0), z + Math.sin(a) * r, { seg: 5, dirt: 0.3 }); }   // rubble
  }
  ao(x + 1.6, z + 0.6, 5.0, 3.6, 0.6, 0.006);                                                           // the scorch
}

function pylonB(L, P, T, x, z) {
  const { box, beam, ao, M } = L, D = DECK.b, Y = D.y - D.d - 0.8;                                      // Y: the cap girder's underside
  box(3.4, 0.4, 3.4, T.conc, x, 0, z, { dirtH: 0.4 });
  box(3.5, 0.06, 0.14, M.hazard, x, 0.4, z + 1.72, T.nc);
  ao(x, z, 3.4, 3.4, 0.4);
  const Y0 = 0.4, B0 = 1.3, B1 = 0.95, corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const leg = (sx, sz, y) => { const t = (y - Y0) / (Y - Y0), b = B0 + (B1 - B0) * t; return [x + sx * b, y, z + sz * b]; };
  for (const [sx, sz] of corners) { beam(leg(sx, sz, Y0), leg(sx, sz, Y), 0.2, 0.2, T.gun); box(0.42, 0.22, 0.42, T.gunD, x + sx * B0, Y0, z + sz * B0, { dirt: 0 }); }
  const NP = 3, lv = []; for (let k = 0; k <= NP; k++) lv.push(Y0 + 0.25 + (Y - Y0 - 0.25) * k / NP);
  for (let k = 0; k <= NP; k++) for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
    beam(leg(ax, az, lv[k]), leg(bx, bz, lv[k]), 0.1, 0.1, T.gunD);
    if (k < NP) { beam(leg(ax, az, lv[k]), leg(bx, bz, lv[k + 1]), 0.07, 0.07, T.gun); beam(leg(bx, bz, lv[k]), leg(ax, az, lv[k + 1]), 0.07, 0.07, T.gun); }
  }
  box(D.w + 1.4, 0.6, 2.4, T.gun, x, Y, z, { dirt: 0.2 });                                              // the cap girder
  for (const s of [-1, 1]) box(0.32, 0.62, 2.42, M.hazard, x + s * ((D.w + 1.4) / 2 - 0.16), Y, z, { dirt: 0 });   // chevron ends
  box(D.w + 0.4, 0.2, 1.8, T.steel, x, Y + 0.6, z, { dirt: 0 });                                        // the deck saddle
  for (const sx of [-1, 1]) { const a = leg(sx, 1, Y0 + 0.4), b = leg(sx, 1, Y - 0.2); beam([a[0], a[1], a[2] + 0.12], [b[0], b[1], b[2] + 0.12], 0.05, 0.05, P.glow, { cast: false }); }   // team strips up the front legs
  P.junction(x + 1.1, z + 1.35, 0);
  P.conduit([[x + 1.1, 0.6, z + 1.2], [x + 1.1, 0.6, z + 1.0], [x + 0.95, Y - 0.3, z + 0.95]], 0.045);
  avLight(L, T, x + (D.w + 1.4) / 2 - 0.1, Y + 0.6, z - 0.9);
  P.beacon(x - (D.w + 1.4) / 2 + 0.1, Y + 0.7, z + 0.9, '#ffb347');
}

function pylonC(L, P, T, x, z) {
  const { box, cyl, hoop, ao, M } = L, D = DECK.c, Y = D.y - D.d;                                        // Y: the beam's underside
  cyl(1.35, 0.25, T.concD, x, 0, z, { seg: 24, dirtH: 0.25 });
  cyl(1.1, Y - 0.25 - 0.3, T.pale, x, 0.25, z, { seg: 24, rTop: 1.0, dirtH: 1.0 });                      // the squat pier
  cyl(1.12, 0.22, M.hazard, x, 0.25, z, { seg: 24, dirt: 0, open: true });
  box(D.w + 0.8, 0.3, 2.0, T.gunD, x, Y - 0.3, z, { dirt: 0 });                                          // the cap
  hoop(1.06, 0.03, P.glow, x, Y - 0.5, z, { cast: false });                                               // a team light ring under it
  box(0.3, 0.3, 0.05, T.dark, x, 0.6, z + 1.04, { dirt: 0 });
  avLight(L, T, x + (D.w + 0.8) / 2 - 0.1, Y, z);
  ao(x, z, 2.4, 2.4, 0.4);
}

// ================================================================================================= terminals
function terminal(L, P, T, v) { return ({ a: terminalA, b: terminalB, c: terminalC }[v])(L, P, T); }

// the dock: the guideway's end at the platform's middle, a round turntable carrying a short saddle, its top at deck height
function dock(L, P, T, v, x, y, z) {
  const { box, cyl, M } = L, D = DECK[v];
  cyl(1.6, 0.3, T.gunD, x, y - 0.6, z, { seg: 32, dirt: 0 });
  cyl(1.62, 0.07, M.hazard, x, y - 0.36, z, { seg: 32, dirt: 0, open: true });
  box(D.w + 0.4, 0.3, 1.6, T.steel, x, y - 0.3, z, { dirt: 0 });
  for (const s of [-1, 1]) box(0.12, 0.04, 1.4, P.glowHi, x + s * (D.w / 2 + 0.12), y, z, T.nc);
}
// a slender lamp mast with a white lamp head, lit
function mast(L, P, T, x, y, z, h, ry = 0) {
  const { box, cyl } = L, NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;
  cyl(0.05, h, P.steelD, x, y, z, { seg: 10, dirt: 0.2 });
  box(0.34, 0.1, 0.16, P.steel, x + Math.sin(ry) * 0.1, y + h, z + Math.cos(ry) * 0.1, { dirt: 0, ry });
  box(0.28, 0.03, 0.12, P.white, x + Math.sin(ry) * 0.12, y + h - 0.02, z + Math.cos(ry) * 0.12, { ...T.nc, ry });
  L.pointLight('#fff1d6', 2.2 * NB, x + Math.sin(ry) * 0.9, y + h - 0.6, z + Math.cos(ry) * 0.9, 3.2);
}
// a passenger shelter (lore: built to the Accord's passenger standard, for colonists who never came): posts, a roof,
// a glass back, an empty bench, a lit sign strip and a timetable board glowing blank
function shelter(L, P, T, x, z, ry = 0) {
  const { box, cyl, M, group } = L, g = group(x, 0, z, ry), O = (o = {}) => ({ parent: g, ...o });
  for (const [dx, dz] of [[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.45], [0.85, 0.45]]) cyl(0.04, 1.9, T.steel, dx, 0, dz, O({ seg: 8, dirt: 0.2 }));
  box(2.0, 0.07, 1.2, T.gunD, 0, 1.9, 0, O({ dirt: 0 }));
  box(1.7, 1.35, 0.04, M.glass('#40525e', 0.5), 0, 0.5, -0.45, O({ dirt: 0 }));
  box(1.4, 0.06, 0.38, M.wood, 0, 0.45, -0.1, O({ dirt: 0.2 })); for (const dx of [-0.55, 0.55]) box(0.06, 0.45, 0.3, T.gunD, dx, 0, -0.1, O({ dirt: 0.3 }));
  box(1.8, 0.05, 0.05, P.white, 0, 1.82, 0.62, O(T.nc));                                                 // the lit sign strip
  box(0.5, 0.72, 0.05, P.warm, 1.25, 0.95, 0.55, O(T.nc)); cyl(0.03, 0.95, T.steel, 1.25, 0, 0.55, O({ seg: 8, dirt: 0.2 }));   // the timetable, lit and blank
}

function terminalA(L, P, T) {
  const { box, cyl, hoop, railing, sphere, ao, M, THREE } = L, D = DECK.a, DY = D.y, ZT = -0.7, R = 3.2, PY = DY - 0.6;   // PY: the platform's top
  // the hall: a plinth, a ribbed drum with a band of glass (lit warm at night) and the ring beam over it
  cyl(R + 0.4, 0.4, T.conc, 0, 0, ZT, { seg: 48, dirtH: 0.4 });
  cyl(R, 2.0, T.whiteR, 0, 0.4, ZT, { seg: 48, dirtH: 1.2 });
  cyl(R - 0.3, 1.4, M.emit('#ffe2b0', 0.5), 0, 2.4, ZT, { seg: 48, dirt: 0 });                            // the lit hall inside, seen through the glass
  cyl(R + 0.03, 1.4, M.glass('#40525e', 0.82), 0, 2.4, ZT, { seg: 48, dirt: 0 });
  for (let k = 0; k < 24; k++) { const a = k / 24 * 2 * PI; box(0.08, 1.42, 0.08, T.gunD, Math.cos(a) * (R + 0.04), 2.4, ZT + Math.sin(a) * (R + 0.04), { dirt: 0 }); }   // mullions
  cyl(R + 0.14, 0.3, T.gunD, 0, 3.8, ZT, { seg: 48, dirt: 0 });
  hoop(R + 0.17, 0.045, P.glow, 0, 3.96, ZT, { cast: false });                                          // the team fascia line
  cyl(R - 0.15, PY - 0.55 - 4.1, T.white, 0, 4.1, ZT, { seg: 48, dirt: 0.15 });
  // the platform: a round slab with a team fascia and a yellow safety ring, a railing with a gap at the front, lamp masts, the dock
  cyl(R + 0.5, 0.55, T.pale, 0, PY - 0.55, ZT, { seg: 48, dirt: 0 });
  hoop(R + 0.52, 0.035, P.glow, 0, PY - 0.3, ZT, { cast: false });
  cyl(R + 0.5, 0.02, M.plain('#5c6166', 0.8), 0, PY, ZT, { seg: 48, dirt: 0 });
  hoop(R + 0.2, 0.025, T.yelL, 0, PY + 0.01, ZT, { cast: false });
  { const pts = []; for (let k = 2; k <= 14; k++) { const a = PI / 2 + 0.36 + (k - 2) / 12 * (2 * PI - 0.72); pts.push([Math.cos(a) * (R + 0.36), ZT + Math.sin(a) * (R + 0.36)]); } railing(pts, PY, { h: 0.9, spacing: 1.1, mat: M.paint('#9aa0a6', { rivets: false }) }); }
  for (const a of [PI * 0.2, PI * 0.8, PI * 1.25, PI * 1.75]) mast(L, P, T, Math.cos(a) * (R + 0.15), PY, ZT + Math.sin(a) * (R + 0.15), 2.1, -a - PI / 2);
  dock(L, P, T, 'a', 0, DY, ZT);
  for (const a of [PI * 0.5, PI * 1.5]) avLight(L, T, Math.cos(a) * (R + 0.38), PY + 0.9, ZT + Math.sin(a) * (R + 0.38));
  // at the door: two lit glass doors under a canopy with a white welcome strip, a shelter with its empty bench, a bench
  P.windows(1.5, 1.5, 0, 0.5, ZT + R + 0.04, 0, 2);
  box(2.4, 0.08, 1.1, T.gunD, 0, 2.2, ZT + R + 0.5, { dirt: 0 }); box(2.1, 0.04, 0.05, P.white, 0, 2.17, ZT + R + 1.02, T.nc);
  shelter(L, P, T, 2.6, 3.2, -0.25);
  box(1.3, 0.06, 0.36, M.wood, -2.7, 0.45, 3.4, { dirt: 0.2, ry: 0.3 }); for (const dx of [-0.5, 0.5]) box(0.06, 0.45, 0.3, T.gunD, -2.7 + dx, 0, 3.4 + dx * 0.3, { dirt: 0.3 });
  box(5.0, 0.04, 2.2, M.plain('#7a7570', 0.9), 0, 0, 3.6, { dirt: 0, cast: false });                  // the forecourt paving
  // power: a transformer and junction box at the back right, cabled to the hall (a Generator feeds the line)
  P.transformer(3.85, -3.6, 0); P.junction(3.0, -2.6, 0);
  P.conduit([[3.0, 0.3, -2.4], [3.0, 0.3, -1.4], [R * 0.72, 0.3, ZT - R * 0.68]], 0.05);
  P.cable([3.6, 1.17, -3.6], [R * 0.6, 2.3, ZT - R * 0.78], 0.2, 6);
  P.flood(-3.9, 3.5, 2.2, PI * 0.78);
  ao(0, ZT, 2 * R + 1.2, 2 * R + 1.2, 0.45); ao(2.6, 3.2, 2.0, 1.2, 0.35);
  return [0, DY, ZT];
}

function terminalB(L, P, T) {
  const { box, cyl, beam, railing, ao, M } = L, D = DECK.b, DY = D.y, ZT = -0.5, PY = DY - 0.6, LX = 3.3, LZ = 2.4, nc = T.nc;
  // four box-section legs on hazard-banded footings, K-braced in pairs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * LX, z = ZT + sz * LZ;
    box(1.1, 0.3, 1.1, T.conc, x, 0, z, { dirtH: 0.3 }); box(1.14, 0.05, 0.1, M.hazard, x, 0.3, z + 0.52, nc);
    box(0.55, PY - 0.5 - 0.3, 0.55, T.gun, x, 0.3, z, { dirtH: 2 });
  }
  for (const sx of [-1, 1]) { const x = sx * LX; beam([x, 0.6, ZT - LZ], [x, PY - 0.7, ZT], 0.14, 0.14, T.gunD); beam([x, 0.6, ZT + LZ], [x, PY - 0.7, ZT], 0.14, 0.14, T.gunD); box(0.16, 0.16, LZ * 2, T.gunD, x, (PY - 0.5) / 2, ZT, { dirt: 0 }); }
  for (const sz of [-1, 1]) { const z = ZT + sz * LZ; beam([-LX, 0.6, z], [0, PY - 0.7, z], 0.14, 0.14, T.gunD); beam([LX, 0.6, z], [0, PY - 0.7, z], 0.14, 0.14, T.gunD); }
  for (const sx of [-1, 1]) beam([sx * LX + 0.3 * sx, 0.9, ZT + LZ + 0.3], [sx * LX + 0.3 * sx, PY - 0.9, ZT + LZ + 0.3], 0.05, 0.05, P.glow, { cast: false });   // team strips up the front legs
  // the platform: a steel deck with grating, a hazard edge and team fascia along the front, railings, the dock
  box(LX * 2 + 1.6, 0.5, LZ * 2 + 1.2, T.gunD, 0, PY - 0.5, ZT, { dirt: 0.2 });
  box(LX * 2 + 1.4, 0.03, LZ * 2 + 1.0, M.grating, 0, PY, ZT, { dirt: 0 });
  box(LX * 2 + 1.6, 0.04, 0.22, M.hazard, 0, PY + 0.01, ZT + LZ + 0.49, nc);
  P.strip(LX * 2 + 1.6, 0, PY - 0.25, ZT + LZ + 0.62, 0, 0.06);
  railing([[-LX - 0.7, ZT + LZ + 0.5], [-LX - 0.7, ZT - LZ - 0.5], [LX + 0.7, ZT - LZ - 0.5], [LX + 0.7, ZT + LZ + 0.5]], PY, { h: 0.8, spacing: 1.0 });
  dock(L, P, T, 'b', 0, DY, ZT);
  // the gantry crane over the platform: two portal legs, twin girders, a trolley with a lit cab, a container on its spreader
  const GY = PY + 2.5;
  for (const s of [-1, 1]) {
    for (const dz of [-1.0, 1.0]) box(0.36, GY - PY, 0.36, T.yel, s * 3.5, PY, ZT + dz, { dirtH: 1.2 });
    box(0.4, 0.4, 2.4, T.yel, s * 3.5, GY, ZT, { dirt: 0 });
    beam([s * 3.5, PY + 0.4, ZT - 1.0], [s * 3.5, GY - 0.2, ZT + 1.0], 0.08, 0.08, T.yel); beam([s * 3.5, PY + 0.4, ZT + 1.0], [s * 3.5, GY - 0.2, ZT - 1.0], 0.08, 0.08, T.yel);
  }
  for (const dz of [-1.0, 1.0]) box(7.8, 0.5, 0.45, T.yel, 0, GY + 0.4, ZT + dz, { dirt: 0.2 });
  P.strip(7.4, 0, GY + 0.35, ZT + 1.24, 0, 0.055);
  { const tx = -2.5, cy = PY + 0.75;
    box(1.1, 0.35, 2.2, T.gunD, tx, GY + 0.9, ZT, { dirt: 0 });
    box(0.7, 0.6, 0.6, M.paint('#c9c5ba', { rivets: false }), tx - 0.95, GY + 0.1, ZT + 1.25, { dirt: 0.3 }); P.windows(0.5, 0.25, tx - 0.95, GY + 0.4, ZT + 1.56, 0, 2);
    for (const [dx, dz] of [[-0.45, -0.35], [0.45, -0.35], [-0.45, 0.35], [0.45, 0.35]]) beam([tx + dx * 0.6, GY + 0.9, ZT + dz * 0.6], [tx + dx * 1.6, cy + 1.05, ZT + dz * 1.3], 0.025, 0.025, T.dark);
    box(2.2, 0.12, 1.0, T.yel, tx, cy + 0.95, ZT, { dirt: 0 });
    box(2.1, 0.95, 0.95, M.ribbed('#a24a32', { period: 12 }), tx, cy, ZT, { dirtH: 0.5 }); }
  for (const s of [-1, 1]) avLight(L, T, s * 3.5, GY + 0.4, ZT - 1.0);
  // at the foot: a cargo lift cage on the front-left leg, a lit control cab on the front-right leg, containers, power
  box(1.2, 1.6, 1.0, T.gunD, -LX + 0.9, 1.6, ZT + LZ + 0.1, { dirt: 0.2 }); box(0.9, 0.5, 0.05, M.grille('#3d4247'), -LX + 0.9, 2.2, ZT + LZ + 0.62, { dirt: 0 });
  box(1.0, 0.05, 0.05, P.glow, -LX + 0.9, 3.1, ZT + LZ + 0.62, nc);
  for (const dx of [-0.5, 0.5]) box(0.08, PY - 0.5, 0.08, T.steel, -LX + 0.9 + dx, 0.3, ZT + LZ + 0.68, { dirt: 0 });   // the lift's guide rails
  { const cx = LX - 0.9, cy = 2.6; box(1.2, 1.0, 1.1, T.gun, cx, cy, ZT + LZ + 0.1, { dirt: 0.2 }); box(1.3, 0.06, 1.2, T.gunD, cx, cy + 1.0, ZT + LZ + 0.1, { dirt: 0 }); P.windows(1.0, 0.4, cx, cy + 0.45, ZT + LZ + 0.67, 0, 2); P.strip(1.1, cx, cy + 0.2, ZT + LZ + 0.69); }
  for (const [hex, x, z, y, ry] of [['#7d4b36', 2.4, 3.6, 0, 0.05], ['#94763d', 2.4, 3.6, 0.95, -0.03], ['#5e6b4c', -2.2, 3.7, 0, -0.08]]) { box(2.2, 0.95, 0.95, M.ribbed(hex, { period: 12 }), x, y, z, { dirtH: 0.6, ry }); }
  P.junction(4.2, 0.6, PI / 2); P.transformer(4.0, -3.4, 0); P.conduit([[4.0, 0.3, 0.3], [4.0, 0.3, -2.4]], 0.05);
  P.cable([3.72, 1.17, -3.4], [LX, PY - 0.9, ZT - LZ + 0.1], 0.25, 6);
  P.flood(-4.3, 3.3, 2.4, PI * 0.8);
  box(9.4, 0.03, 0.18, M.hazard, 0, 0, 4.0, nc);
  ao(0, ZT, LX * 2 + 1.0, LZ * 2 + 1.0, 0.4); ao(2.4, 3.6, 2.2, 1.0, 0.4);
  return [0, DY, ZT];
}

function terminalC(L, P, T) {
  const { box, cyl, hoop, railing, ao, M } = L, D = DECK.c, DY = D.y, ZT = -0.3, PX = -1.6, PY = DY - 0.6, nc = T.nc;
  // the beam's end: a low drum with a round platform on it, its edge lit, a railing, the dock, steps down
  cyl(3.0, 0.3, T.conc, PX, 0, ZT, { seg: 40, dirtH: 0.3 });
  cyl(2.6, PY - 0.3 - 0.3, T.grey, PX, 0.3, ZT, { seg: 40, dirtH: 0.9 });
  cyl(3.1, 0.3, T.pale, PX, PY - 0.3, ZT, { seg: 40, dirt: 0 });
  hoop(3.12, 0.04, P.glow, PX, PY - 0.14, ZT, { cast: false });
  cyl(3.1, 0.02, M.plain('#5c6166', 0.8), PX, PY, ZT, { seg: 40, dirt: 0 });
  hoop(2.75, 0.025, T.yelL, PX, PY + 0.01, ZT, { cast: false });
  { const pts = []; for (let k = 0; k <= 10; k++) { const a = PI * 0.62 + k / 10 * PI * 1.56; pts.push([PX + Math.cos(a) * 2.95, ZT + Math.sin(a) * 2.95]); } railing(pts, PY, { h: 0.8, spacing: 1.0 }); }
  dock(L, P, T, 'c', PX, DY, ZT);
  for (let k = 0; k < 4; k++) box(1.2, PY - k * 0.55, 0.45, T.conc, PX + 0.4, 0, ZT + 3.0 + k * 0.45, { dirtH: 0.3 });   // the steps
  mast(L, P, T, PX - 2.6, PY, ZT - 1.4, 1.8, PI * 0.25); mast(L, P, T, PX + 1.9, PY, ZT + 2.2, 1.8, PI * 1.1);
  // the depot shed beside it: a low ribbed shed, two roller doors on its front, a team sign band, lit windows toward the platform
  const SX = 3.0, SW = 3.4, SD = 6.4, SH = 2.4;
  box(SW + 0.3, 0.3, SD + 0.3, T.conc, SX, 0, ZT, { dirtH: 0.3 });
  box(SW, SH, SD, M.ribbed('#a39c90'), SX, 0.3, ZT, { dirtH: 1.0 });
  box(SW + 0.3, 0.14, SD + 0.3, T.gunD, SX, 0.3 + SH, ZT, { dirt: 0 });
  box(SW - 0.3, 0.03, SD - 0.3, M.plain('#4b5157', 0.8), SX, 0.44 + SH, ZT, { dirt: 0 });
  for (const dz of [-1.8, 0.6]) { box(0.8, 0.3, 0.6, T.gun, SX + 0.4, 0.44 + SH, ZT + dz, { dirt: 0 }); box(0.7, 0.04, 0.5, M.grille('#3d4247'), SX + 0.4, 0.74 + SH, ZT + dz, { dirt: 0 }); }
  for (const dx of [-0.85, 0.85]) { box(1.3, 1.7, 0.08, M.ribbed('#6c6f70', { period: 8 }), SX + dx, 0.3, ZT + SD / 2 + 0.03, { dirt: 0.3 }); box(1.4, 0.1, 0.1, M.hazard, SX + dx, 2.0, ZT + SD / 2 + 0.05, { dirt: 0 }); }
  P.strip(SW, SX, 0.3 + SH - 0.3, ZT + SD / 2 + 0.06, 0, 0.07);                                           // the sign band
  P.windows(4.2, 0.3, SX - SW / 2 - 0.03, 1.8, ZT - 0.4, PI / 2, 5);
  box(0.26, 0.1, 0.14, P.steelD, SX, 2.45, ZT + SD / 2 + 0.12, { dirt: 0 }); box(0.2, 0.04, 0.1, P.white, SX, 2.43, ZT + SD / 2 + 0.15, nc);
  L.pointLight('#fff1d6', 2.2, SX, 2.0, ZT + SD / 2 + 0.8, 3.0);
  // the apron in front of the doors (asphalt, a yellow line), a shelter by the steps, power
  box(SW + 1.0, 0.05, 1.5, T.asphalt, SX, 0, ZT + SD / 2 + 0.95, nc); box(SW + 0.6, 0.012, 0.08, T.yelL, SX, 0.05, ZT + SD / 2 + 1.6, nc);
  shelter(L, P, T, -3.6, 3.2, 0.35);
  P.junction(PX + 3.4, ZT - 3.3, 0); P.conduit([[PX + 3.4, 0.6, ZT - 3.1], [PX + 3.4, 0.6, ZT - 2.8], [PX + 2.5, PY - 0.5, ZT - 1.9]], 0.045);
  P.transformer(-3.9, -3.7, 0); P.cable([-3.62, 1.17, -3.7], [PX - 2.3, PY - 0.6, ZT - 1.5], 0.2, 6);
  P.flood(4.4, -3.8, 2.2, PI * 0.9);
  ao(PX, ZT, 6.0, 6.0, 0.4); ao(SX, ZT, SW + 0.4, SD + 0.4, 0.45);
  return [PX, DY, ZT];
}

// ================================================================================================= pods
// built at the origin of group g, facing +x, its underside at y = 0 (the deck top); frame of 10 units
function pod(L, P, T, v, load, g) { ({ a: podA, b: podB, c: podC }[v])(L, P, T, load, g); }
const crates = (L, T, g, spots) => { for (const [x, z, s, kind] of spots) { if (kind === 'ore') { L.box(s, s * 0.6, s, L.M.plain('#5b5248', 0.9), x, 0, z, { parent: g, dirt: 0.2 }); L.sphere(s * 0.42, L.M.rough('#8a6d4c'), x, s * 0.45, z, { parent: g, dome: true, dirt: 0.2 }); } else { L.box(s, s * 0.8, s, L.M.wood, x, 0, z, { parent: g, dirt: 0.2 }); L.box(s + 0.02, 0.03, 0.06, T.gunD, x, s * 0.5, z, { parent: g, dirt: 0 }); } } };

function podA(L, P, T, load, g) {
  const { box, sphere, M } = L, O = (o = {}) => ({ parent: g, ...o }), nc = { ...T.nc, parent: g };
  ext(L, rrect(L, -3.9, -1.32, 7.8, 2.64, 1.1), 0.25, 0.75, T.gunD, O({ bevel: 0.08 }));              // the skirt that wraps the guideway
  for (const s of [-1, 1]) box(7.0, 0.04, 0.08, P.glow, 0, 1.0, s * 1.24, nc);                          // team light slits on its shoulders
  ext(L, rrect(L, -3.8, -1.2, 7.6, 2.4, 1.15), 0.98, 1.45, T.white, O({ bevel: 0.36, dirt: 0.15, dirtH: 0.5 }));   // the body with soft shoulders
  for (const s of [-1, 1]) { box(5.2, 0.28, 0.04, P.warm, -0.2, 1.72, s * 1.17, nc); for (const x of [-2.2, -0.9, 0.4, 1.7]) box(0.07, 0.3, 0.05, T.dark, x, 1.71, s * 1.18, O({ dirt: 0 })); }   // the band of lit windows (empty seats)
  for (const s of [-1, 1]) box(6.4, 0.05, 0.1, P.glow, -0.1, 2.4, s * 0.86, nc);                         // team strips along the roof edges
  for (const x of [-3.45, 3.45]) { sphere(0.2, M.plain('#162430', 0.2, 0.1), x, 2.35, 0, O({ dome: true, dirt: 0 })); for (const s of [-1, 1]) box(0.3, 0.06, 0.3, P.white, x * 1.03, 1.55, s * 0.75, nc); }   // sensor domes and lamps at both ends
  box(3.1, 0.06, 1.56, T.gunD, -0.3, 2.4, 0, O({ dirt: 0 }));                                             // the roof hatch frame
  if (load) {
    box(2.9, 0.5, 1.4, T.dark, -0.3, 1.95, 0, O({ dirt: 0 }));                                             // the open hold
    const h = L.group(0, 2.0, 0, 0, g); crates(L, T, h, [[-1.3, -0.35, 0.6, 'crate'], [-1.3, 0.4, 0.55, 'ore'], [-0.5, 0.0, 0.62, 'crate'], [0.35, -0.38, 0.52, 'ore'], [0.4, 0.4, 0.5, 'crate']]);
    box(1.45, 0.05, 1.42, T.white, 0.75, 2.46, 0, O({ dirt: 0 })); box(1.45, 0.02, 0.06, P.amber, 0.75, 2.51, 0, nc);   // the hatch slid half back
  } else {
    box(2.9, 0.04, 1.42, T.white, -0.3, 2.44, 0, O({ dirt: 0 })); box(0.04, 0.02, 1.4, T.dark, -0.3, 2.48, 0, nc); box(0.3, 0.02, 0.3, P.glowSoft, -1.6, 2.48, 0, nc);
  }
}

function podB(L, P, T, load, g) {
  const { box, hoop, M } = L, O = (o = {}) => ({ parent: g, ...o }), nc = { ...T.nc, parent: g };
  ext(L, rrect(L, -4.05, -1.62, 8.1, 3.24, 0.3), 0.25, 0.5, T.gunD, O({ bevel: 0.06 }));                // the skirt
  for (const s of [-1, 1]) box(7.4, 0.04, 0.08, P.glow, 0, 0.75, s * 1.56, nc);
  box(7.5, 0.3, 2.6, T.gunD, 0, 0.7, 0, O({ dirt: 0.3 })); box(7.3, 0.02, 2.4, M.grating, 0, 1.0, 0, O({ dirt: 0 }));   // the rack floor
  for (const s of [-1, 1]) { box(8.0, 1.5, 0.26, T.gun, 0, 0.75, s * 1.37, O({ dirt: 0.3, dirtH: 0.8 })); box(8.0, 0.1, 0.32, T.yel, 0, 2.25, s * 1.37, O({ dirt: 0 })); box(7.4, 0.05, 0.08, P.glow, 0, 2.35, s * 1.3, nc); }   // the long walls, painted top chord, team strips
  for (const s of [-1, 1]) { box(0.3, 1.6, 3.0, T.gun, s * 3.85, 0.75, 0, O({ dirt: 0.3 })); box(0.42, 0.3, 2.7, M.hazard, s * 3.9, 2.25, 0, O({ dirt: 0 })); box(0.2, 0.25, 0.7, T.dark, s * 4.02, 1.7, 0, O({ dirt: 0 })); box(0.05, 0.08, 0.5, P.white, s * 4.13, 1.78, 0, nc); }   // end plates, chevrons, sensor bars
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { box(0.32, 1.7, 0.32, T.gunD, sx * 3.84, 0.75, sz * 1.36, O({ dirt: 0 })); box(0.1, 0.06, 0.1, P.amber, sx * 3.84, 2.45, sz * 1.36, nc); }   // corner posts with amber marker lamps
  for (const x of [-2.0, 0, 2.0]) box(0.08, 0.9, 2.44, T.gunD, x, 1.0, 0, O({ dirt: 0 }));                 // rack dividers: four bays
  if (load) {
    const h = L.group(0, 1.02, 0, 0, g);
    crates(L, T, h, [[-3.0, -0.6, 0.85, 'crate'], [-3.0, 0.55, 0.8, 'crate'], [-1.0, 0, 1.5, 'ore'], [1.0, -0.55, 0.9, 'crate'], [1.0, 0.5, 0.8, 'ore'], [3.0, 0, 1.4, 'ore']]);
  } else {
    for (const x of [-3.0, -1.0, 1.0, 3.0]) for (const z of [-0.7, 0.7]) hoop(0.1, 0.02, T.steel, x, 1.03, z, O({ cast: false }));   // tie-down rings on the bare floor
    for (const x of [-3.0, 1.0]) box(0.9, 0.012, 0.9, M.hazard, x, 1.02, 0, nc);
  }
}

function podC(L, P, T, load, g) {
  const { box, mesh, THREE, M } = L, O = (o = {}) => ({ parent: g, ...o }), nc = { ...T.nc, parent: g };
  ext(L, rrect(L, -3.7, -1.42, 7.4, 2.84, 1.4), 0.2, 0.62, T.gunD, O({ bevel: 0.1 }));                   // the skirt hugging the beam
  for (const s of [-1, 1]) box(5.6, 0.04, 0.1, P.glow, 0, 0.82, s * 1.34, nc);                           // its glowing edges
  ext(L, rrect(L, -3.6, -1.26, 7.2, 2.52, 1.26), 0.8, 1.5, T.gun, O({ bevel: 0.5, dirt: 0.2, dirtH: 0.6 }));   // the domed body
  box(5.6, 0.04, 0.1, P.glow, 0, 2.3, 0, nc);                                                              // the team spine
  for (const s of [-1, 1]) { box(0.36, 0.26, 1.3, P.warm, s * 2.95, 1.62, 0, nc); box(0.4, 0.3, 0.06, T.dark, s * 2.95, 1.6, 0, O({ dirt: 0 })); }   // the visors at both ends
  for (const s of [-1, 1]) for (const z of [-0.6, 0.6]) box(0.14, 0.06, 0.26, P.white, s * 3.5, 1.3, z, nc);   // lamps
  for (const s of [-1, 1]) box(0.4, 0.05, 0.7, M.hazard, s * 3.3, 2.1, 0, nc);
  if (load) {
    box(2.5, 0.5, 1.5, T.dark, 0, 1.95, 0, O({ dirt: 0 }));                                                 // the open hold
    const h = L.group(0, 2.0, 0, 0, g); crates(L, T, h, [[-0.75, -0.3, 0.6, 'crate'], [-0.7, 0.42, 0.5, 'ore'], [0.2, 0.05, 0.62, 'ore'], [0.95, -0.4, 0.5, 'crate']]);
    const lid = new THREE.BoxGeometry(2.5, 0.06, 1.5); lid.translate(0, 0, 0.75); lid.rotateX(-0.9); lid.translate(0, 2.45, 0.76);   // the lid hinged up along the far side
    mesh(lid, T.gunD, 0, 0, 0, O({ dirt: 0 }));
  } else {
    box(2.5, 0.04, 1.5, T.gunD, 0, 2.3, 0, O({ dirt: 0 })); box(2.4, 0.02, 0.05, T.dark, 0, 2.34, 0.72, nc); box(0.5, 0.02, 0.2, P.glowSoft, -0.9, 2.34, -0.5, nc);
  }
}

// ================================================================================================= c=scene
function scene(L, P, T, v) {
  const { THREE } = L, D = DECK[v];
  const head = terminal(L, P, T, v);
  { const g = new THREE.PlaneGeometry(160, 160); g.rotateX(-PI / 2);                                       // open ground round the pad
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 40, uv.getY(i) * 40);
    L.mesh(g, L.M.rough('#9a7656'), 0, -0.3, 0, { dirt: 0, cast: false }).userData.ground = true; }
  const hz = head[2], x0 = head[0] + { a: 3.8, b: 4.2, c: 3.2 }[v], SP = 13;                              // from the platform's rim; pylons 1.3 tiles apart here (3 in the game)
  deckRun(L, P, T, v, L.group(0, 0, hz), x0, head[0] + 2 * SP + 7, D.y);
  for (const px of [head[0] + SP, head[0] + 2 * SP]) pylon(L, P, T, v, px, hz, false);
  pod(L, P, T, v, true, L.group(head[0] + SP * 1.5, D.y, hz));
  // a wider sun shadow box, and a camera framed on everything at the buildings' angle
  L.getScene().traverse((o) => { if (o.isDirectionalLight && o.castShadow) { const c = o.shadow.camera; c.left = c.bottom = -44; c.right = c.top = 44; c.far = 160; c.updateProjectionMatrix(); o.shadow.mapSize.set(4096, 4096); } });
  L.getRoot().updateMatrixWorld(true);
  const bb = new THREE.Box3(); L.getRoot().traverse((o) => { if (o.isMesh && !o.userData.decal && !o.userData.ground) bb.expandByObject(o); });
  const ELEV = 57 * PI / 180, Dn = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV));
  const cam = new THREE.PerspectiveCamera(20, 1.6, 0.5, 400), Cc = bb.getCenter(new THREE.Vector3());
  const corners = []; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) corners.push(new THREE.Vector3(x, y, z));
  let dist = 90, off = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    cam.position.copy(Cc).add(off).sub(Dn.clone().multiplyScalar(dist)); cam.lookAt(cam.position.clone().add(Dn)); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    let x0 = 1, x1 = -1, y0 = 1, y1 = -1; for (const c of corners) { const q = c.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const span = Math.max((x1 - x0) / 2, (y1 - y0) / 2), right = new THREE.Vector3(1, 0, 0), up = new THREE.Vector3().crossVectors(right, Dn).normalize();
    dist *= 1 + (span / 0.93 - 1) * 0.5;
    off.add(right.multiplyScalar(((x0 + x1) / 2) * dist * 0.15)).add(up.multiplyScalar(((y0 + y1) / 2) * dist * 0.09));
  }
  L.useCamera(cam);
}
