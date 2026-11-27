// The Graveyard (space expansion, phase 2): the wreck field's art, straight down (view=top) or at the buildings' 57 degrees
// (view=hero, for the canvas). From the concept board's wreck types (b/voidmaps.js c=hulk, debris, prize).
//   c=plate   a hulk's deck plating, 4 by 4 tiles (40 units) seen straight down, for the game to tile over a hulk's ground:
//             v=0 the dead hulls' weathered gunmetal (hatch rows, scorch, dead deck lights, a hazard stripe), v=1 the same
//             torn up (plates missing, ribs showing through, burns), v=2 the Arbiter's Accord white (pale plates, seams,
//             relay conduits). Panel seams fall on the tile grid and the image's edges, so it tiles without a seam.
//   c=salvage towable debris, the wreckage a Shuttle tows in: v=0 a torn-off engine bell on a hull plate, v=1 a cluster of
//             hull plates round a cargo pod, ribs sticking out (12 units: the game draws it 1.8 tiles across)
//   c=junk    a debris lane's shard cloud: twisted plates and beams loose in space (24 units)
//   c=arb     the Arbiter's relay, the old Accord arbitration ship's superstructure that stands on the core tiles: a great
//             shallow relay dish on its yoke, a mast array with lamps, the beacon housing. cap=0 derelict (dark, a dim amber
//             beacon still answering), cap=1 captured (the holder's team light round the dish rim, the masts lit). 46 units across.
// tod=night: the eclipse (the game's TOD swaps it in at night).
import { space, num, P } from './spacekit.js';
export const config = { pad: false, size: 1024 };

export default function (L) {
  const c = P.get('c') || 'plate', view = P.get('view') || 'top', v = num('v', 0), cap = num('cap', 0);
  const Wd = { plate: 40, salvage: 12, junk: 24, arb: 46 }[c];
  const K = space(L, { view, W: num('W', Wd), hero: { half: num('half', Wd * 0.48), width: 0.8, cy: 0.5 } });
  const { THREE, M, G, mat, B, C, S, beam, hc, strip, plate, tube, lights } = K;
  const Y = view === 'hero' ? num('alt', c === 'plate' ? 0 : 2) : 0;
  let sd = 7 + v * 31 + (c === 'junk' ? 99 : 0); const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
  const deck = M.paint('#4b4f54', { rivets: false }), deck2 = M.paint('#41454a', { rivets: false }), deckD = M.paint('#373a3e', { rivets: false });
  const white = mat.accord, whiteD = mat.accordD, NEU = M.emit('#ffc860', cap ? 2.2 : 0.9), dead = M.plain('#2a2c2e', 0.6, 0.3);
  if (c === 'plate') {
    // 2 by 2 tile panels (20 units), each of four plates, seams on the grid. The image is the 40-unit square.
    const pale = v === 2, base = pale ? [white, whiteD, M.paint('#a8a59c', { rivets: false })] : [deck, deck2, deckD];
    for (let pz = 0; pz < 2; pz++) for (let px = 0; px < 2; px++) {
      const x0 = -20 + px * 20, z0 = -20 + pz * 20;
      for (let qz = 0; qz < 2; qz++) for (let qx = 0; qx < 2; qx++) {
        const a = x0 + qx * 10 + 0.12, b = z0 + qz * 10 + 0.12, k = Math.floor(r() * 3);
        if (v === 1 && r() < 0.28) { // (torn up: the plate is gone, the ribs and the dark hold under it show)
          B(9.76, 0.1, 9.76, mat.black, a + 4.88, -1.2, b + 4.88, { cast: false });
          for (let s = 1; s < 4; s++) B(0.5, 1.1, 9.6, mat.steel, a + s * 2.45, -0.6, b + 4.88);
          for (let s = 1; s < 3; s++) B(9.6, 0.5, 0.35, mat.rail, a + 4.88, -0.4, b + s * 3.2);
          // a ragged edge of the next plate curled up
          plate([[a, b], [a + 3 + r() * 3, b], [a + 1.5, b + 2 + r() * 2]], 0.15, 0.12, base[k], { bevel: 0.02 }).rotation.x = 0.15;
          continue;
        }
        plate([[a, b], [a + 9.76, b], [a + 9.76, b + 9.76], [a, b + 9.76]], 0.05, 0.25, base[k], { bevel: 0.05 });
        // rivets along the plate's edges
        for (let s = 0.8; s < 9.6; s += 1.6) for (const [x, z] of [[a + s, b + 0.45], [a + s, b + 9.3], [a + 0.45, b + s], [a + 9.3, b + s]]) C(0.09, 0.08, mat.steel, x, 0.32, z, { seg: 6, cast: false });
        const roll = r();
        if (roll < 0.22) { // a hatch
          B(4.2, 0.08, 3.0, pale ? whiteD : mat.dark, a + 4.9, 0.32, b + 4.9, { cast: false }); B(3.8, 0.1, 0.25, mat.steel, a + 4.9, 0.36, b + 3.6); B(3.8, 0.1, 0.25, mat.steel, a + 4.9, 0.36, b + 6.2);
        } else if (roll < 0.36) { // a vent grille
          for (let s = 0; s < 6; s++) B(3.2, 0.06, 0.18, mat.black, a + 4.9, 0.32, b + 3.4 + s * 0.6, { cast: false });
        } else if (roll < 0.5) { // scorch and pitting from the old fight
          for (let s = 0; s < 9; s++) C(0.2 + r() * 0.7, 0.03, s % 3 ? M.plain('#26221e', 0.95, 0.1) : mat.burnt, a + 1.2 + r() * 7.4, 0.31 + s * 0.002, b + 1.2 + r() * 7.4, { seg: 7, cast: false });
          B(2 + r() * 3, 0.03, 0.3, mat.burnt, a + 5, 0.33, b + 3 + r() * 4, { ry: r() * 3, cast: false }); // (a gouge)
        } else if (roll < 0.58 && !pale) { // a hazard stripe across the plate
          B(9.6, 0.04, 0.8, M.hazard, a + 4.88, 0.31, b + 2.0, { cast: false });
        } else if (roll < 0.66) { // a conduit run (Accord white on the Arbiter: the relay's)
          B(9.6, 0.35, 0.5, pale ? mat.steel : mat.rail, a + 4.88, 0.45, b + 7.5);
        }
      }
      // dead deck lights at the panel's corners: dark lenses (the Arbiter's still glow, faintly)
      for (const [x, z] of [[x0 + 0.6, z0 + 0.6], [x0 + 19.4, z0 + 19.4]]) S(0.28, pale ? M.emit('#ffc860', 0.5) : dead, x, 0.4, z);
    }
    // the heavy seams on the 2-tile grid (and the light ones on the 1-tile grid fall between the plates)
    for (const k of [-20, 0, 20]) { B(40, 0.06, 0.24, mat.seam, 0, 0.32, k, { cast: false }); B(0.24, 0.06, 40, mat.seam, k, 0.32, 0, { cast: false }); }
  }
  if (c === 'salvage') {
    if (v === 0) {
      // a torn-off engine bell on a bent hull plate, cable eyes for the tow
      const g = new THREE.CylinderGeometry(2.4, 1.2, 4.0, 18, 1, true); g.rotateZ(-Math.PI / 2 + 0.3);
      const m = L.mesh(g, mat.rail, -1.0, Y + 1.3, 0, { parent: G, dirt: 0 }); m.material.side = THREE.DoubleSide;
      hc(1.3, 1.8, mat.burnt, 1.9, Y + 1.1, 0.2, 'x');
      plate([[0.5, -3.0], [4.5, -2.2], [5.0, 1.3], [1.5, 2.8], [-0.4, 0.4]], Y + 0.4, 0.3, white, { bevel: 0.05 }).rotation.z = 0.15;
      for (const [x, z] of [[4.5, -2.2], [-2.6, 2.0]]) S(0.24, mat.amber, x, Y + 1.0, z);
      B(1.1, 0.3, 0.6, mat.burnt, 3.2, Y + 0.6, 2.0, { ry: 0.6 }); B(0.9, 0.2, 1.5, whiteD, -1.7, Y + 0.3, -2.6, { ry: -0.4 });
      for (let s = 0; s < 4; s++) beam([0.8 + s * 0.9, Y + 0.6, -2.4], [1.1 + s * 0.9, Y + 0.7, -3.6 - r()], 0.18, 0.18, mat.steel); // (ribs torn off with it)
    } else {
      // hull plates round a cargo pod, ribs sticking out of the torn edge
      hc(1.4, 4.6, M.ribbed('#7a5a36'), 0.2, Y + 1.2, 0, 'x', { seg: 8 });
      B(0.5, 2.7, 2.7, mat.steel, 2.6, Y + 1.2, 0); B(0.5, 2.7, 2.7, mat.steel, -2.2, Y + 1.2, 0);
      plate([[-4.2, -2.6], [1.0, -3.4], [3.6, -1.6], [-1.0, -0.8]], Y + 0.3, 0.3, white, { bevel: 0.05 }).rotation.x = 0.2;
      plate([[-3.4, 1.2], [2.4, 0.9], [4.6, 3.2], [-2.0, 3.6]], Y + 0.25, 0.3, whiteD, { bevel: 0.05 }).rotation.x = -0.18;
      for (let s = 0; s < 5; s++) beam([-3.6 + s * 1.6, Y + 0.6, 3.2], [-3.4 + s * 1.6 + r() * 0.6, Y + 0.9 + r(), 4.6 + r()], 0.2, 0.2, mat.steel);
      S(0.24, mat.amber, -3.8, Y + 1.0, -2.4); S(0.2, dead, 3.8, Y + 0.8, 2.8);
    }
  }
  if (c === 'junk') {
    // twisted plates and beams, loose, spread over the frame (the game spins the whole cloud slowly)
    for (let k = 0; k < 9; k++) {
      const a = r() * Math.PI * 2, d = 1.5 + r() * 8, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.8, s = 0.8 + r() * 1.8;
      if (k % 3 === 2) beam([x - s, Y + 0.5, z - s * 0.4], [x + s, Y + 0.6 + r(), z + s * 0.4], 0.25, 0.25, r() < 0.5 ? mat.steel : mat.rail);
      else { const p = plate([[x - s, z - s * 0.6], [x + s * 0.8, z - s * 0.9], [x + s, z + s * 0.5], [x - s * 0.5, z + s * 0.8]], Y + 0.4 + r() * 0.6, 0.2, k % 2 ? white : deck, { bevel: 0.03 }); p.rotation.x = (r() - 0.5) * 0.8; p.rotation.z = (r() - 0.5) * 0.6; }
    }
    S(0.18, mat.amber, 2.0, Y + 1.0, -1.0);
  }
  if (c === 'arb') {
    const lit = cap ? mat.team : dead;
    // the beacon housing: an octagonal drum across the core, banded
    tube([[9, 3.4], [7, 4.6], [-7, 4.6], [-9, 3.4]], Y + 2.0, 0, [white, white, whiteD]);
    for (const x of [5, 0, -5]) K.band(x, 0.8, 4.75, Y + 2.0, 0, lit);
    // the relay dish forward (east): a great shallow dish on its yoke, the feed horn at its focus
    { const g = new THREE.SphereGeometry(16, 40, 10, 0, Math.PI * 2, 0, 0.5); const m = L.mesh(g, white, 14, Y + 20, 0, { parent: G, dirt: 0 }); m.rotation.x = Math.PI; m.material.side = THREE.DoubleSide;
      const rim = new THREE.TorusGeometry(7.7, 0.35, 6, 48); rim.rotateX(Math.PI / 2); L.mesh(rim, cap ? mat.team : whiteD, 14, Y + 5.95, 0, { parent: G, dirt: 0, cast: false });
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3; beam([14 + Math.cos(a) * 7.2, Y + 6.0, Math.sin(a) * 7.2], [14, Y + 11.0, 0], 0.3, 0.3, mat.steel); }
      S(0.9, NEU, 14, Y + 11.2, 0); beam([9, Y + 3.5, 0], [14, Y + 4.5, 0], 1.2, 1.2, mat.steel); }
    // the mast array aft (west): tall thin masts with crossbars and lamps (lit in the holder's colour once held)
    for (const [x, z, h] of [[-12, -5, 12], [-12, 5, 10], [-17, 0, 16], [-21, -4, 9], [-21, 4, 11]]) {
      C(0.25, h, mat.steel, x, Y + 2.0, z, { seg: 6 });
      for (let y = 3; y < h; y += 3) B(2.8, 0.1, 0.1, mat.steel, x, Y + 2.0 + y, z);
      S(0.4, cap ? mat.team : NEU, x, Y + 2.0 + h, z);
    }
    // conduits from the drum down onto the deck, and the deck clamps that hold it
    for (const s of [-1, 1]) { beam([0, Y + 1.0, s * 4.5], [0, Y + 0.2, s * 10], 0.8, 0.5, mat.rail); B(3, 0.6, 2, mat.armor, 0, Y + 0.3, s * 10.5); lights([[0, Y + 0.8, s * 11.6, cap ? mat.team : dead, 0.3]]); }
    for (const [x, z] of [[8, -8], [8, 8], [-8, -8], [-8, 8]]) B(2.2, 0.8, 2.2, mat.armor, x, Y + 0.4, z);
    // the beacon itself, still answering: a lamp on the drum's spine
    S(0.8, NEU, 0, Y + 6.8, 0); C(0.5, 1.5, mat.steel, 0, Y + 5.3, 0, { seg: 8 });
    if (!cap) for (const [x, z] of [[3, -3], [-4, 2]]) C(1.2, 0.05, mat.burnt, x, Y + 6.6, z, { seg: 12, cast: false }); // (the scorch of the old fight on its back)
  }
  K.settle();
}
