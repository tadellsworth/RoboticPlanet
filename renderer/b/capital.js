// Space expansion, phase 3 (The Void Fleet): the capital ships, from the space canvas's capital-ship board.
//   c=tender  The Flagship, a vanguard Carrier's tender (the canvas's "Tender"): a long faceted hull; on its back near the
//             stern the docking collar it rides clamped under its Carrier by (a ring of amber lamps); a flight deck along
//             the spine with yellow hazard ends, two launch rails lit in the team colour and two Gunships parked on it;
//             a forward command block with the visor; four point-defence sponsons on short arms; four great engines.
//             launch=1: the rails lit up and a catapult glow at the head of one (a Gunship going up off it).
//   c=line    The Line Ship (the canvas's "Line"): a narrow armoured hull with belt plates along its flanks, two big twin
//             turrets on the spine (rot= their training, degrees: 0 ahead, 90 to starboard (+z), -90 to port), a spinal
//             mass-driver gun the length of the bow (its coils lit), the bridge aft, small PD turrets, three engines.
//             fire=1: the turrets' muzzles flaring.
// view=top (the game's: straight down, nose toward +x, W units across) or hero. Units: 10 to a tile. thr= engines 0..1.
import { space, num, P } from './spacekit.js';
export const config = { pad: false, size: 1024 };
export const SIZE = { tender: 68, line: 50 }; // top view W (the game draws them FLEET_LOOK.frame tiles across: W / 10)

export function build(K, c, o = {}) {
  const { mat, facet, tube, plate, strip, B, C, S, hc, beam, grime, nozzle, lights, muzzle, THREE, G, M } = K;
  const thr = o.thr ?? 0, yb = o.alt ?? 0;
  const visor = (x, y, z, s = 1, tilt = 0.3) => { const sh = new THREE.Shape(); [[0.16, 0], [-0.06, 0.42], [-0.16, 0.42], [0.04, 0.02], [0.04, -0.02], [-0.16, -0.42], [-0.06, -0.42]].forEach(([a, b], i) => (i ? sh.lineTo(a * s, b * s) : sh.moveTo(a * s, b * s)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.06, bevelEnabled: false }); g.rotateX(Math.PI / 2); const m = K.L.mesh(g, mat.visor, x, y, z, { parent: G, dirt: 0, cast: false }); m.rotation.z = -tilt; };
  const deckMat = M.paint('#5a4f42', { rivets: false }), beltMat = M.paint('#454b52');
  // the capital hulls: a paler Accord grey than the small craft's gunmetal, as the canvas drew them
  const hull = [M.paint('#8b9198', { rivets: false }), M.paint('#787e85'), M.paint('#5c6269')];
  // a point-defence mount: a squat drum and a twin rotary gun trained `a` (radians from +x, toward +z)
  const pd = (x, y, z, s = 1, a = 0) => {
    C(0.75 * s, 0.5 * s, mat.armor, x, y, z, { seg: 10 }); C(0.55 * s, 0.35 * s, mat.top, x, y + 0.5 * s, z, { seg: 10 });
    for (const q of [-1, 1]) { const ox = -Math.sin(a) * 0.18 * s * q, oz = Math.cos(a) * 0.18 * s * q; beam([x + ox, y + 0.7 * s, z + oz], [x + ox + Math.cos(a) * 1.6 * s, y + 0.7 * s, z + oz + Math.sin(a) * 1.6 * s], 0.12 * s, 0.12 * s, mat.rail); }
    lights([[x, y + 0.9 * s, z, mat.glow, 0.1 * s]]);
  };

  if (c === 'tender') {
    const Y = yb + 2.4;
    // the hull: long and faceted, broad through the middle, a blunt stern, the bow tapering
    const st = [[-30, 5.4, 1.8, 1.6], [-27.5, 6.6, 2.4, 2.0], [20, 6.6, 2.4, 2.0], [25.5, 5.2, 2.0, 1.8], [29.5, 2.6, 1.4, 1.2], [31.2, 0.5, 0.5, 0.5]];
    facet(st.map(([x, w, h, b]) => ({ x, w, h, b, t: w * 0.82, m: 0.45, bt: w * 0.7, y: Y })), hull);
    const top = Y + 2.4;
    // the flight deck along the spine: darker plating, hazard ends, two launch rails, edge lamps
    plate([[-15, -4.4], [18, -4.4], [18, 4.4], [-15, 4.4]], top + 0.08, 0.1, deckMat, { bevel: 0.02 });
    for (const x of [-15.2, 18.2]) B(0.7, 0.12, 8.8, mat.hazard, x, top + 0.15, 0, { cast: false });
    const railK = o.launch ? 3.2 : 1.2;
    for (const z of [-2.2, 2.2]) {
      strip(-13.5, z, 17, z, 0.22, top + 0.18, 0.04, M.emit(K.TEAM, railK));
      for (let x = -12; x <= 16; x += 2.5) B(0.25, 0.06, 0.25, mat.white, x, top + 0.2, z + (z > 0 ? 0.55 : -0.55), { cast: false });
    }
    strip(-14, 0, 17.5, 0, 0.08, top + 0.17, 0.02, mat.seam);
    for (let x = -14; x <= 17; x += 3.1) for (const z of [-4.1, 4.1]) S(0.1, mat.white, x, top + 0.2, z);
    if (o.launch) { S(0.6, M.emit('#ffffff', 5), 16.2, top + 0.6, 2.2); S(1.1, M.emit(K.TEAM, 2.5), 15.4, top + 0.4, 2.2, { cast: false }); }
    // two Gunships parked on the deck (small Lancets: an arrowhead, twin barrels, four lift pods)
    for (const [gx, gz] of [[3.5, -2.2], [-6.5, 2.2]]) {
      if (o.launch && gz > 0) continue; // (that one has just gone up)
      const s = 0.62, gy = top + 0.55;
      plate([[gx + 4.4 * s, gz], [gx - 2.6 * s, gz - 1.6 * s], [gx - 3.3 * s, gz - 1.4 * s], [gx - 3.3 * s, gz + 1.4 * s], [gx - 2.6 * s, gz + 1.6 * s]], gy, 0.45, hull[0], { bevel: 0.05 });
      for (const q of [-1, 1]) { hc(0.14, 4.6 * s, mat.rail, gx + 4 * s, gy - 0.15, gz + q * 0.62 * s, 'x'); C(0.6 * s, 0.4, mat.armor, gx - 0.2 * s, gy - 0.2, gz + q * 2.7 * s, { seg: 8 }); C(0.5 * s, 0.4, mat.armor, gx - 3.0 * s, gy - 0.2, gz + q * 2.0 * s, { seg: 8 }); }
      strip(gx + 0.6 * s, gz, gx - 1.6 * s, gz - 1.3 * s, 0.08, gy + 0.05, 0.02, mat.glow); strip(gx + 0.6 * s, gz, gx - 1.6 * s, gz + 1.3 * s, 0.08, gy + 0.05, 0.02, mat.glow);
    }
    // the docking collar near the stern: a raised ring, dark inside, amber lamps round it
    { const g = new THREE.TorusGeometry(2.4, 0.42, 8, 32); g.rotateX(Math.PI / 2); K.L.mesh(g, mat.steel, -21.5, top + 0.35, 0, { parent: G, dirt: 0 });
      C(2.05, 0.3, mat.black, -21.5, top + 0.12, 0, { seg: 32 });
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; S(0.2, mat.amber, -21.5 + Math.cos(a) * 3.0, top + 0.45, Math.sin(a) * 3.0); B(0.5, 0.3, 0.3, mat.armor, -21.5 + Math.cos(a) * 2.95, top + 0.2, Math.sin(a) * 2.95, { ry: -a }); } }
    // the command block forward, its visor looking ahead
    facet([{ x: 26.2, w: 0.6, h: 0.3, b: 0.3, y: top - 0.2 }, { x: 25.4, w: 2.2, h: 1.1, b: 0.5, y: top - 0.2 }, { x: 20.2, w: 2.6, h: 1.3, b: 0.5, y: top - 0.2 }, { x: 19.4, w: 2.2, h: 1.0, b: 0.5, y: top - 0.2 }], [mat.hood, mat.top, mat.armor]);
    visor(25.0, top + 0.95, 0, 2.6, 0.3);
    // its team strips along both flanks, the long cyan lines of the concept
    for (const s of [-1, 1]) {
      strip(26, s * 4.9, -27, s * 6.35, 0.16, Y + 1.2, 0.05, mat.glow);
      strip(20, s * 6.55, -27, s * 6.55, 0.12, Y + 0.2, 0.04, mat.glow);
      for (const x of [-22, -10, 2, 14]) B(2.6, 1.2, 0.18, beltMat, x, Y + 0.3, s * 6.62); // (hangar doors along the flanks)
      // four point-defence sponsons on short arms
      for (const x of [12, -17]) { beam([x, Y + 0.8, s * 6.4], [x, Y + 0.8, s * 7.9], 0.7, 0.5, mat.armor); pd(x, Y + 0.6, s * 8.2, 1, s * 0.5 * Math.PI + (x > 0 ? -s * 0.6 : s * 0.6)); }
      lights([[29.3, Y + 0.8, s * 1.4, s < 0 ? mat.navR : mat.navG, 0.16], [-29.8, Y + 1.6, s * 4.8, mat.white, 0.13]]);
    }
    // four great engines at the stern, in a row
    for (const z of [-3.3, -1.1, 1.1, 3.3]) { hc(1.0, 1.6, mat.armor, -30.4, Y + 0.2, z, 'x', { r2: 0.9 }); nozzle(-31.2, Y + 0.2, z, 0.85, [-1, 0, 0], thr, 0.9); }
    // panel seams over the hull's back, fore and aft of the deck, and vents by the engines
    for (const x of [-26, -24, -18.5, -16.5, 19.5, 22.5]) strip(x, -5.6, x, 5.6, 0.07, top + 0.03, 0.02, mat.seam);
    for (const z of [-4.9, 4.9]) strip(-27, z, -15.5, z, 0.07, top + 0.03, 0.02, mat.seam);
    for (const z of [-4.2, -3.4, 3.4, 4.2]) B(2.2, 0.1, 0.35, mat.dark, -26.6, top + 0.06, z, { cast: false });
    grime(K.rect(-28, -6, 25, 6), top + 0.02, 0.5, 11);
    grime(K.rect(-15, -4.4, 18, 4.4), top + 0.19, 0.8, 12);
  }

  if (c === 'line') {
    const Y = yb + 1.8;
    const st = [[-22, 3.0, 1.6, 1.4], [-19, 4.0, 2.1, 1.8], [12, 4.0, 2.1, 1.8], [17, 3.0, 1.8, 1.5], [20.5, 1.5, 1.1, 1.0], [21.6, 0.4, 0.4, 0.4]];
    facet(st.map(([x, w, h, b]) => ({ x, w, h, b, t: w * 0.7, m: 0.4, bt: w * 0.65, y: Y })), hull);
    const top = Y + 2.1;
    // belt plates along both flanks, seams between, a team strip above them
    for (const s of [-1, 1]) {
      for (let x = -16; x <= 10; x += 4.4) { B(4.1, 1.5, 0.8, beltMat, x, Y + 0.9, s * 4.25); B(4.1, 0.08, 0.6, mat.seam, x, Y + 1.66, s * 4.3, { cast: false }); }
      strip(14, s * 3.4, -19, s * 3.95, 0.14, Y + 1.5, 0.04, mat.glow);
      lights([[19.5, Y + 0.6, s * 0.9, s < 0 ? mat.navR : mat.navG, 0.13], [-21.6, Y + 1.0, s * 2.6, mat.white, 0.11]]);
    }
    // the spinal mass-driver gun: a long barrel out past the bow, its coils lit
    hc(0.55, 14.5, mat.rail, 15.75, top - 0.2, 0, 'x'); hc(0.75, 4, mat.armor, 9.5, top - 0.2, 0, 'x');
    for (const x of [13, 15.8, 18.6, 21.4]) hc(0.78, 0.45, M.emit(K.TEAM, 1.8), x, top - 0.2, 0, 'x', { cast: false });
    hc(0.7, 0.8, mat.steel, 23.2, top - 0.2, 0, 'x');
    // two big twin turrets on the spine, trained `rot`
    const rot = (o.rot ?? 0) * Math.PI / 180;
    for (const [tx, sc] of [[4.5, 1], [-5.5, 1]]) {
      C(2.0 * sc, 0.5, mat.armor, tx, top - 0.1, 0, { seg: 20 });
      const g = K.L.group(tx, top + 0.4, 0, -rot, G);
      { const hg = new THREE.CylinderGeometry(1.5, 1.7, 1.1, 16); K.L.mesh(hg, hull[1], -0.3, 0.25, 0, { parent: g, dirt: 0 }); }
      K.L.box(1.6, 0.9, 2.3, hull[0], 1.0, 0.3, 0, { parent: g, dirt: 0 });
      { const cg = new THREE.CylinderGeometry(1.2, 1.5, 0.18, 16); K.L.mesh(cg, hull[0], -0.3, 0.86, 0, { parent: g, dirt: 0 }); }
      for (const q of [-1, 1]) {
        const bg = new THREE.CylinderGeometry(0.22, 0.26, 5.0, 12); bg.rotateZ(-Math.PI / 2);
        K.L.mesh(bg, mat.rail, 3.6, 0.3, q * 0.7, { parent: g, dirt: 0 });
        if (o.fire) { K.L.mesh(new THREE.SphereGeometry(0.55, 12, 8), M.emit('#fff1c2', 5), 6.3, 0.3, q * 0.7, { parent: g, dirt: 0, cast: false }); K.L.mesh(new THREE.SphereGeometry(1.1, 12, 8), M.emit('#ffae4a', 2.2), 6.9, 0.3, q * 0.7, { parent: g, dirt: 0, cast: false }); }
      }
      K.L.box(0.12, 0.1, 1.6, M.emit(K.TEAM, 1.6), 1.25, 0.82, 0, { parent: g, dirt: 0, cast: false });
    }
    // the bridge aft, its visor ahead, and small point-defence turrets
    facet([{ x: -10.5, w: 0.5, h: 0.4, b: 0.3, y: top - 0.2 }, { x: -11.2, w: 1.9, h: 1.3, b: 0.5, y: top - 0.2 }, { x: -15.8, w: 2.2, h: 1.4, b: 0.5, y: top - 0.2 }, { x: -16.6, w: 1.6, h: 1.0, b: 0.5, y: top - 0.2 }], [mat.hood, mat.top, mat.armor]);
    visor(-11.4, top + 1.05, 0, 2.0, 0.3);
    for (const [x, s] of [[10.5, -1], [10.5, 1], [-18.5, -1], [-18.5, 1]]) pd(x, top - 0.3, s * 2.6, 0.7, s * Math.PI / 2 + (x > 0 ? -s * 0.7 : s * 0.7));
    // three engines at the stern
    for (const z of [-1.6, 0, 1.6]) { hc(0.85, 1.2, mat.armor, -22.3, Y + 0.3, z, 'x', { r2: 0.75 }); nozzle(-22.9, Y + 0.3, z, 0.7, [-1, 0, 0], thr, 0.9); }
    for (const x of [-19.5, -8.5, -1.5, 8, 14]) strip(x, -3.4, x, 3.4, 0.07, top + 0.03, 0.02, mat.seam);
    for (const z of [-2.2, 2.2]) strip(-20, z, 15, z, 0.06, top + 0.03, 0.02, mat.seam);
    grime(K.rect(-20, -3.6, 15, 3.6), top + 0.02, 0.6, 21);
  }
}

export default function (L) {
  const c = P.get('c') || 'tender', view = P.get('view') || 'top';
  const K = space(L, { view, W: num('W', SIZE[c]), hero: { half: num('half', c === 'tender' ? 34 : 26), width: num('width', 0.8), cy: num('cy', 0.5) } });
  build(K, c, { thr: num('thr', 0), alt: num('alt', view === 'hero' ? 4 : 0), launch: num('launch', 0), rot: num('rot', 0), fire: num('fire', 0) });
  K.settle();
}
