// Space expansion concepts: the Launch Pad, which builds and services spacecraft (the Airfield's place on the space
// maps). Proposed 2 x 2: modelled 20 units across and drawn at half scale into the buildings' 57 degree frame, so a
// parked Shuttle (15 units, 1.5 tiles) sits on it at true size. `v=`:
//   a  Cradle Ring: a round blast deck on a plinth, a lattice service tower with a swing arm, two fuel spheres, a hut
//   b  Blast Pit: a square deck round a grated pit and a flame trench, a gantry crane over it, a hangar shed behind
//   c  Silo Hangar: an armoured block whose two roof leaves slide apart (open=0..1) over a lift (lift=0..1)
// ship= a ship from b/ships.js parked on it (thr= its thrust, 0 parked). Accent (pad lilac) on the deck's signal lamps.
import { space, num, P } from './spacekit.js';
import { build } from './ships.js';
export const config = { pad: false };

export default function (L) {
  const { THREE, M, ACCENT } = L;
  const K = space(L, { view: 'building', seed: 77 });
  const { G, mat, B, C, S, beam, plate, strip, hc, grime, lights } = K;
  G.scale.setScalar(0.5);
  const v = P.get('v') || 'a', acc = M.emit(ACCENT, 2.2), conc = M.concrete, deck = M.paint('#5a5d60'), scorch = M.plain('#1c1814', 0.95);
  const ship = P.get('ship'), thr = num('thr', 0), open = num('open', 1), lift = num('lift', 1);
  let shipY = 0.6, shipX = 0, shipZ = 0;
  // the plinth everything stands on: 20 x 20, a low concrete slab with a kerb
  B(20.2, 0.5, 20.2, conc, 0, -0.5, 0, { dirt: 0.4 });

  if (v === 'a') {
    C(8.6, 0.6, M.steel, 0, 0, 0, { seg: 48 }); C(8.0, 0.08, deck, 0, 0.6, 0, { seg: 48 });
    C(4.2, 0.02, scorch, 0, 0.68, 0, { seg: 40, cast: false });
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; strip(Math.cos(a) * 2.4, Math.sin(a) * 2.4, Math.cos(a) * 7.8, Math.sin(a) * 7.8, 0.06, 0.68, 0.02, mat.seam); }
    { const g = new THREE.TorusGeometry(8.25, 0.18, 6, 64); g.rotateX(Math.PI / 2); L.mesh(g, M.hazard, 0, 0.62, 0, { parent: G, dirt: 0 }); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2 + 0.13; S(0.24, k % 3 ? mat.glow : acc, Math.cos(a) * 8.6, 0.72, Math.sin(a) * 8.6); }
    // the service tower, back left: four legs, cross-bracing, a cab, the swing arm reaching over the deck
    const tx = -7.5, tz = -7.5, th = 10;
    B(2.6, th, 2.6, mat.top, tx, 0, tz, { dirt: 0.3 });
    for (let y = 1.0; y < th; y += 1.8) { B(2.7, 0.18, 2.7, M.hazard, tx, y, tz); }
    for (const [dx, dz] of [[-1.35, 0], [0, 1.35]]) for (let y = 0.4; y < th - 1; y += 1.8) beam([tx + dx - (dz ? 1.2 : 0), y, tz + dz + (dx ? 1.2 : 0)], [tx + dx + (dz ? 1.2 : 0), y + 1.6, tz + dz - (dx ? 1.2 : 0)], 0.1, 0.1, mat.rail);
    B(2.6, 1.6, 2.6, mat.armor, tx, th, tz); B(2.0, 0.2, 0.06, acc, tx, th + 1.0, tz + 1.31, { cast: false });
    beam([tx + 0.8, th - 1.2, tz + 0.8], [-1.5, th - 3.2, -1.5], 0.55, 0.45, mat.top); beam([-1.5, th - 3.2, -1.5], [-1.5, 4.0, -1.5], 0.2, 0.2, mat.black);
    S(0.2, mat.navR, tx, th + 2.0, tz);
    // fuel spheres, back right, on saddles, with a pipe to the deck
    for (const [x, z] of [[6.6, -7.4], [8.6, -4.6]]) { B(1.8, 0.8, 1.8, conc, x, 0, z); K.S(1.45, M.paint('#c7c2b6', { rivets: false }), x, 2.2, z, { cast: true }); strip(x - 1.2, z, x + 1.2, z, 0.2, 2.15, 0.12, mat.team); }
    K.L.pipe([[6.6, 0.5, -6.0], [6.6, 0.5, -5.2], [3.6, 0.5, -3.6]], 0.16, mat.steel, { parent: G });
    // the hut, front right
    B(3.2, 2.0, 2.4, mat.armor, 7.4, 0, 7.4); B(3.4, 0.2, 2.6, mat.top, 7.4, 2.0, 7.4); B(2.2, 0.35, 0.05, acc, 7.4, 1.2, 8.62, { cast: false });
    shipY = 0.68;
  }

  if (v === 'b') {
    plate([[-9.6, -9.6], [9.6, -9.6], [9.6, 9.6], [-9.6, 9.6]], 0.45, 0.45, deck, { bevel: 0.08 });
    B(9.6, 0.05, 9.6, M.grating, 0, 0.46, 1.0, { cast: false }); B(9.0, 0.02, 9.0, mat.black, 0, 0.47, 1.0, { cast: false });
    for (const [x, z, w, d] of [[0, -3.95, 10.2, 0.3], [0, 5.95, 10.2, 0.3], [-5.1, 1, 0.3, 10.2], [5.1, 1, 0.3, 10.2]]) B(w, 0.12, d, M.hazard, x, 0.45, z);
    // the flame trench out to the right edge, heat-stained
    B(4.6, 0.03, 2.8, scorch, 7.4, 0.46, 1.0, { cast: false }); B(4.6, 0.04, 0.25, M.steel, 7.4, 0.46, -0.45); B(4.6, 0.04, 0.25, M.steel, 7.4, 0.46, 2.45);
    for (let k = 0; k < 4; k++) B(0.15, 0.03, 2.6, mat.rail, 5.6 + k * 1.1, 0.47, 1.0);
    // the gantry crane: two A-frame legs either side of the pit, a beam across, a trolley and hook
    for (const z of [-4.6, 6.6]) { beam([-6.2, 0.45, z], [-5.4, 7.2, z], 0.35, 0.35, M.hazard); beam([6.2, 0.45, z], [5.4, 7.2, z], 0.35, 0.35, M.hazard); }
    for (const z of [-4.6, 6.6]) B(11.6, 0.6, 0.6, mat.armor, 0, 7.2, z);
    B(0.8, 0.5, 12.0, mat.top, -2.2, 7.8, 1.0); B(1.0, 0.7, 1.0, mat.dark, -2.2, 7.3, 2.6); beam([-2.2, 7.3, 2.6], [-2.2, 4.4, 2.6], 0.06, 0.06, mat.black);
    S(0.18, acc, -5.4, 7.9, -4.6); S(0.18, acc, 5.4, 7.9, 6.6);
    // the hangar shed behind: a long low vault, a roll door with team light over it
    B(18.0, 3.6, 4.6, mat.armor, 0, 0.45, -7.4); { const g = new THREE.CylinderGeometry(2.3, 2.3, 18, 16, 1, false, 0, Math.PI); g.rotateZ(Math.PI / 2); L.mesh(g, M.ribbed('#4a5157'), 0, 4.05, -7.4, { parent: G, dirt: 0.2, ry: 0 }); }
    B(8.0, 3.0, 0.1, M.ribbed('#3a3f45'), 0, 0.45, -5.06); strip(-4, -5.0, 4, -5.0, 0.12, 3.55, 0.1, mat.team);
    for (const [x, z] of [[-9.0, 9.0], [9.0, 9.0]]) { C(0.15, 6, mat.steel, x, 0.45, z, { seg: 8 }); B(0.9, 0.4, 0.5, mat.dark, x, 6.4, z); B(0.7, 0.05, 0.35, mat.white, x, 6.38, z + 0.05, { cast: false }); }
    for (let k = -3; k <= 3; k++) S(0.16, k % 2 ? mat.glow : acc, k * 1.4, 0.6, 9.5);
    shipY = 0.5; shipZ = 1.0;
  }

  if (v === 'c') {
    const H = 4.6;
    // the armoured block: sloped glacis on all sides, a deck on top with the roof leaves
    const gl = (w0, w1, h) => { const g = new THREE.CylinderGeometry(w1 / Math.SQRT2, w0 / Math.SQRT2, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); return g; };
    L.mesh(gl(19.6, 17.0, H), M.paint('#4a5056'), 0, 0, 0, { parent: G, dirt: 0 });
    // the well: dark walls inside, seen when the leaves part
    for (const [x, z, w, d] of [[0, -5.3, 10.6, 0.2], [0, 5.3, 10.6, 0.2], [-5.3, 0, 0.2, 10.6], [5.3, 0, 0.2, 10.6]]) B(w, H, d, mat.black, x, 0.01, z, { cast: false });
    const lh = H - 0.2 - (1 - lift) * (H - 0.6);
    B(10.0, 0.3, 10.0, M.grating, 0, lh - 0.3, 0); for (const [x, z] of [[-5.1, 0], [5.1, 0]]) B(0.2, 0.32, 10.0, M.hazard, x, lh - 0.32, z);
    const lw = 5.4 + 0.1, sh = open * 5.2;
    for (const s of [-1, 1]) {
      const x = s * (lw / 2 + sh); B(lw, 0.4, 11.2, M.paint('#3e454c'), x, H, 0); strip(x - s * lw / 2 + s * 0.1, -5.4, x - s * lw / 2 + s * 0.1, 5.4, 0.12, H + 0.4, 0.04, M.hazard);
      for (const z of [-3.5, 0, 3.5]) B(lw - 0.6, 0.05, 0.12, mat.seam, x, H + 0.4, z, { cast: false });
    }
    // rails the leaves run on, lamps, a comms mast at a corner
    for (const z of [-5.9, 5.9]) { B(17.0, 0.12, 0.3, mat.steel, 0, H, z); for (let k = -3; k <= 3; k++) S(0.15, Math.abs(k) % 2 ? acc : mat.glow, k * 2.4, H + 0.2, z + Math.sign(z) * 0.3); }
    C(0.18, 5, mat.steel, 7.4, H, -7.4, { seg: 8 }); S(0.2, mat.navR, 7.4, H + 5.1, -7.4); B(1.4, 0.1, 0.1, mat.steel, 7.4, H + 4.2, -7.4);
    B(4.2, 2.4, 0.2, M.ribbed('#3a3f45'), 0, 0, 9.4); strip(-2, 9.6, 2, 9.6, 0.12, 2.5, 0.08, mat.team); // a ground door for robots
    shipY = lh;
  }
  if (ship) { const n0 = G.children.length; K.gy = shipY; build(K, ship, { thr, gear: 1, alt: shipY + num('hover', 0), ramp: 0, empty: num('empty', 0) });
    for (const o of G.children.slice(n0)) { o.position.x += shipX; o.position.z += shipZ; } }
  K.settle();
}
