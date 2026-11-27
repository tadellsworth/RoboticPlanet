// Space expansion concepts: the spacecraft that replace aircraft on The Ring and Orbital platforms.
//   c=shuttle_a  Shuttle A "Frame Tug": an open cargo frame (six containers in plain view), a sensor cab, four corner
//                thruster pods on outriggers, twin aft mains, a tow claw at the stern (it tows drifting rock).
//   c=shuttle_b  Shuttle B "Lifting Body": a flat faceted wedge, cargo inside under two dorsal doors, eight ventral lift
//                nozzles, three aft mains, two canted fins.
//   c=drop_a     Dropship A "Clamshell": a deep hull with a stern ramp that lowers (ramp=0..1) onto four robots
//                standing inside, thruster sponsons each side, four legs (gear=0..1).
//   c=drop_b     Dropship B "Cradle Rack": a high spine with four robots clamped in cradles under it; the cradles lower
//                them on cables (ramp=0..1) and let go. Pods at four corners.
//   c=gun_a      Gunship A "Lancet" (the owner's pick, Nov 2026): a short, broad-backed arrowhead dart, two long cannon
//                barrels running out past the nose like a tuning fork, short stubs ending in round vertical lift pods,
//                and two more lift pods at the tail corners: four glowing discs from above and no jet nozzle, wings or
//                fins, so at game zoom it reads as a hovering gun platform and never as the Vulcan Bomber (b/bomber.js).
//   c=gun_b      Gunship B "Halo": an armoured pod inside a ring frame carrying four thrusters, a chin turret.
// view=top|hero; thr= thrust 0..1; gear=, ramp= 0..1; alt= hover height (hero); f= frame (hover bob); fire=1 muzzles.
import { space, num, P } from './spacekit.js';
export const config = { pad: false, size: 1024 };
export const SIZE = { shuttle_a: 18, shuttle_b: 18, drop_a: 18, drop_b: 18, gun_a: 15, gun_b: 13 }; // top view W

export function build(K, c, o = {}) {
  const { mat, facet, oct, tube, band, plate, rect, strip, B, C, S, hc, beam, grime, nozzle, leg, lights, landLamp, muzzle, bot, THREE, G } = K;
  const thr = o.thr ?? 1, gear = o.gear ?? 0, ramp = o.ramp ?? 0, yb = o.alt ?? 0, fire = o.fire ?? 0;
  const visor = (x, y, z, s = 1, tilt = 0.3) => { const sh = new THREE.Shape(); [[0.16, 0], [-0.06, 0.42], [-0.16, 0.42], [0.04, 0.02], [0.04, -0.02], [-0.16, -0.42], [-0.06, -0.42]].forEach(([a, b], i) => (i ? sh.lineTo(a * s, b * s) : sh.moveTo(a * s, b * s)));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }); g.rotateX(Math.PI / 2); const m = K.L.mesh(g, mat.visor, x, y, z, { parent: G, dirt: 0, cast: false }); m.rotation.z = -tilt; };
  const pod = (x, z, y, r, h, ext = 0) => { // a vertical thruster pod: a faceted can, a team ring, a nozzle under it
    C(r, h, mat.armor, x, y, z, { seg: 8, rTop: r * 0.86 }); C(r * 0.7, 0.06, mat.roof, x, y + h, z, { seg: 8 });
    C(r * 1.02, 0.08, mat.glow, x, y + h * 0.62, z, { seg: 8, cast: false });
    nozzle(x, y, z, r * 0.62, [ext, -1, 0].map((v, i) => (i === 0 ? v : v)).map((v, i, a) => v / Math.hypot(...a)), thr, 0.8);
  };

  if (c === 'shuttle_a') {
    const Y = yb + 1.25;
    tube([[-6.2, 0.45], [-5.6, 0.7], [4.6, 0.7], [5.0, 0.55]], Y, 0, [mat.roof, mat.top, mat.armor]);               // spine
    facet([{ x: 7.4, w: 0.35, h: 0.25, b: 0.3, y: Y + 0.15 }, { x: 6.8, w: 1.0, h: 0.62, b: 0.55, y: Y + 0.15 }, { x: 4.6, w: 1.25, h: 0.85, b: 0.7, y: Y + 0.15 }, { x: 4.0, w: 1.1, h: 0.7, b: 0.6, y: Y + 0.15 }], [mat.hood, mat.top, mat.armor]); // the sensor cab
    visor(6.55, Y + 0.86, 0, 1.2, 0.35);
    for (const s of [-1, 1]) {                                                                                         // the cargo frame
      B(10.6, 0.28, 0.32, mat.steel, -0.9, Y - 0.62, s * 1.95); strip(4.2, s * 2.12, -6.0, s * 2.12, 0.08, Y - 0.34, 0.03, mat.glow);
      for (const x of [-5.6, -3.0, -0.4, 2.2, 4.0]) beam([x, Y - 0.5, s * 1.95], [x, Y + 0.1, s * 0.4], 0.16, 0.16, mat.rail);
    }
    const cols = ['#7a5a36', '#4d5a63', '#8a4a2e', '#5f6a4a', '#6b6f73', '#8b6a2e'];
    [[-4.4, -0.95], [-4.4, 0.95], [-1.8, -0.95], [-1.8, 0.95], [0.8, -0.95], [0.8, 0.95]].forEach(([x, z], i) => {
      if (o.empty && i > 1) return;
      B(2.4, 1.15, 1.6, K.M.ribbed(cols[i]), x, Y - 0.6, z, { dirt: 0.3 }); B(2.3, 0.04, 0.06, mat.seam, x, Y + 0.56, z, { cast: false }); });
    for (const [x, ext] of [[4.2, 0.12], [-5.4, -0.12]]) for (const s of [-1, 1]) {                                    // outriggers and pods
      beam([x, Y - 0.1, s * 2.0], [x, Y - 0.1, s * 3.1], 0.36, 0.3, mat.armor); pod(x, s * 3.35, Y - 0.95, 0.6, 1.35, ext);
      lights([[x, Y + 0.45, s * 3.35, s < 0 ? mat.navR : mat.navG, 0.12]]);
    }
    for (const s of [-1, 1]) { hc(0.42, 1.2, mat.armor, -6.3, Y, s * 0.55, 'x', { r2: 0.36 }); nozzle(-6.9, Y, s * 0.55, 0.36, [-1, 0, 0], thr * 0.7, 0.8); }
    // the tow claw: a boom out of the stern under the mains, three fingers
    beam([-5.8, Y - 0.55, 0], [-8.0, Y - 0.55, 0], 0.22, 0.22, mat.steel);
    for (const a of [-0.6, 0, 0.6]) beam([-8.0, Y - 0.55, 0], [-8.55, Y - 0.55 + Math.cos(a) * 0.1, Math.sin(a) * 0.55], 0.12, 0.12, mat.rail);
    S(0.13, mat.amber, -8.0, Y - 0.35, 0);
    for (const [x, z] of [[3.2, -1.95], [3.2, 1.95], [-4.6, -1.95], [-4.6, 1.95]]) leg(x, z, Y - 0.62, gear, 0, Math.sign(z));
    landLamp(5.8, Y - 0.55, 0); lights([[-6.9, Y + 0.5, 0, mat.white, 0.1], [0.6, Y + 0.72, 0, mat.navR, 0.12]]);
    grime(K.rect(4.2, -0.5, -5.8, 0.5), Y + 0.72, 0.4, 5);
  }

  if (c === 'shuttle_b') {
    const Y = yb + 1.0;
    const st = [[7.6, 0.15, 0.08, 0.1], [6.6, 1.2, 0.42, 0.35], [4.6, 2.2, 0.75, 0.55], [-3.6, 2.7, 0.92, 0.6], [-5.8, 2.55, 0.85, 0.55], [-6.4, 2.2, 0.7, 0.45]];
    facet(st.map(([x, w, h, b]) => ({ x, w, h, b, t: w * 0.72, m: 0.3, bt: w * 0.7, y: Y })), [mat.roof, mat.top, mat.armor]);
    visor(6.2, Y + 0.5, 0, 1.25, 0.22);
    for (const s of [-1, 1]) { // the dorsal doors, seams, the team strip at the crease
      plate([[3.6, s * 0.08], [3.6, s * 1.55], [-4.4, s * 1.75], [-4.4, s * 0.08]], Y + 0.95, 0.05, mat.top, { bevel: 0.015 });
      strip(5.2, s * 1.85, -6.0, s * 2.42, 0.1, Y + 0.27, 0.05, mat.glow);
      // canted fins aft
      const g = new THREE.BoxGeometry(1.9, 1.3, 0.14); g.translate(0, 0.65, 0); const m = K.L.mesh(g, mat.armor, -5.4, Y + 0.6, s * 2.0, { parent: G, dirt: 0 }); m.rotation.x = -s * 0.5; m.rotation.z = 0.35;
      lights([[5.0, Y + 0.1, s * 2.0, s < 0 ? mat.navR : mat.navG, 0.12]]);
    }
    for (const x of [2.2, -1.0]) strip(x, -1.4, x, 1.4, 0.04, Y + 0.95, 0.012, mat.seam);
    strip(3.6, 0, -4.4, 0, 0.05, Y + 0.96, 0.012, mat.seam);
    for (const x of [4.0, 1.4, -1.4, -4.2]) for (const s of [-1, 1]) nozzle(x, Y - 0.55, s * 1.55, 0.36, [0, -1, 0], thr, 0.6);
    for (const z of [-1.2, 0, 1.2]) nozzle(-6.45, Y + 0.1, z, 0.42, [-1, 0, 0], thr * 0.7, 0.8);
    for (const [x, z] of [[4.6, 0], [-3.8, -1.6], [-3.8, 1.6]]) leg(x, z, Y - 0.6, gear);
    landLamp(6.6, Y - 0.3, 0); lights([[-6.4, Y + 0.85, 0, mat.white, 0.1], [0.4, Y + 1.0, 0, mat.navR, 0.12]]);
    grime(K.rect(4.0, -1.8, -5.6, 1.8), Y + 1.01, 0.5, 3);
  }

  if (c === 'drop_a') {
    const Y = yb + 1.75;
    const st = [[7.0, 0.3, 0.3, 0.3], [6.2, 1.2, 0.9, 0.9], [4.6, 1.95, 1.4, 1.35], [-4.4, 2.1, 1.5, 1.45], [-5.6, 1.95, 1.35, 1.3]];
    facet(st.map(([x, w, h, b]) => ({ x, w, h, b, t: w * 0.6, m: 0.4, bt: w * 0.55, y: Y })), [mat.roof, mat.top, mat.armor], { capBack: ramp > 0.05 ? false : true });
    visor(6.15, Y + 1.0, 0, 1.4, 0.45);
    // the stern: an open dark hold behind the ramp, four robots standing in it
    if (ramp > 0.05) {
      B(0.1, 2.6, 3.6, mat.black, -5.5, Y - 1.25, 0, { cast: false });
      B(9.2, 0.08, 3.4, mat.dark, -1.0, Y - 1.18, 0);
      for (const [k, [x, z]] of [[-4.6, -0.8], [-4.6, 0.8], [-3.3, -0.8], [-3.3, 0.8]].entries()) {
        if (o.bots === false) continue; // (the game's frames: its own robots walk out)
        const out = ramp >= 0.99 && k < 3; // set down: three are out on the ground behind the ramp, one coming down it
        if (out) bot(-9.6 - (k % 2) * 1.3, 0, (k - 1) * 1.3, 1.1, Math.PI); else bot(ramp >= 0.99 ? -7.0 : x, ramp >= 0.99 ? 0.8 : Y - 1.1, z * (ramp >= 0.99 ? 0 : 1), 1.1, Math.PI);
      }
    }
    { // the ramp: hinged at the hold's floor at the stern; closed it stands up as the stern door, open it reaches the ground
      const hy = Y - 1.2, h = new THREE.Group(); h.position.set(-5.6, hy, 0); G.add(h);
      h.rotation.z = ramp * (Math.PI / 2 + Math.asin(Math.min(1, Math.max(0, hy - 0.1) / 3.0)));
      K.L.box(0.18, 3.0, 3.4, mat.armor, 0, 0, 0, { parent: h, dirt: 0 }); K.L.box(0.2, 0.12, 3.0, mat.hazard, 0.02, 2.8, 0, { parent: h, dirt: 0 });
      for (const z of [-1.2, 0, 1.2]) K.L.box(0.21, 2.4, 0.08, mat.seam, 0.02, 0.3, z, { parent: h, dirt: 0, cast: false });
    }
    for (const s of [-1, 1]) { // sponsons with two thruster pods each, a team strip along the hull
      beam([2.6, Y, s * 2.0], [2.6, Y, s * 3.1], 0.5, 0.4, mat.armor); beam([-3.0, Y, s * 2.1], [-3.0, Y, s * 3.1], 0.5, 0.4, mat.armor);
      tube([[3.6, 0.5], [3.2, 0.62], [-3.8, 0.62], [-4.3, 0.45]], Y - 0.2, s * 3.35, [mat.top, mat.armor, mat.armor]);
      pod(2.6, s * 3.35, Y - 1.4, 0.55, 0.8, 0.0); pod(-3.0, s * 3.35, Y - 1.4, 0.55, 0.8, 0.0);
      strip(4.6, s * 2.05, -4.2, s * 2.2, 0.1, Y + 0.6, 0.05, mat.glow);
      lights([[3.6, Y + 0.2, s * 3.4, s < 0 ? mat.navR : mat.navG, 0.13]]);
    }
    for (const z of [-0.9, 0.9]) nozzle(-5.7, Y + 0.95, z, 0.32, [-1, 0, 0], thr * 0.6, 0.8);
    for (const [x, z] of [[4.2, -1.4], [4.2, 1.4], [-3.6, -1.6], [-3.6, 1.6]]) leg(x, z, Y - 1.3, gear, 0, Math.sign(z));
    B(0.3, 0.6, 0.3, mat.rail, 1.0, Y + 1.45, 0); S(0.12, mat.navR, 1.0, Y + 2.1, 0);
    landLamp(6.3, Y - 0.8, 0); landLamp(-5.2, Y - 1.25, 1.6, 0.1); landLamp(-5.2, Y - 1.25, -1.6, 0.1);
    grime(K.rect(4.6, -1.0, -5.0, 1.0), Y + 1.51, 0.5, 8);
  }

  if (c === 'drop_b') {
    const Y = yb + 3.2;
    tube([[-6.6, 0.5], [-6.0, 0.75], [5.0, 0.75], [5.6, 0.55]], Y, 0, [mat.roof, mat.top, mat.armor]);               // the spine
    facet([{ x: 7.8, w: 0.3, h: 0.25, b: 0.3, y: Y }, { x: 7.0, w: 0.95, h: 0.75, b: 0.7, y: Y }, { x: 5.0, w: 1.2, h: 0.95, b: 0.85, y: Y }], [mat.hood, mat.top, mat.armor]);
    visor(6.85, Y + 0.72, 0, 1.15, 0.4);
    const drop = ramp * (Y - 1.0);
    for (const [x, z] of [[3.0, -1.05], [3.0, 1.05], [-1.6, -1.05], [-1.6, 1.05]]) { // the cradles: a hoist box, cables, a clamp frame, a robot
      B(1.3, 0.5, 1.0, mat.armor, x, Y - 0.85, z * 0.55);
      const cy = Y - 2.2 - drop * 0.95;
      beam([x - 0.4, Y - 0.85, z * 0.55], [x - 0.4, cy + 1.25, z], 0.05, 0.05, mat.black); beam([x + 0.4, Y - 0.85, z * 0.55], [x + 0.4, cy + 1.25, z], 0.05, 0.05, mat.black);
      B(1.3, 0.12, 1.2, mat.steel, x, cy + 1.2, z); for (const s of [-1, 1]) B(0.12, 0.9, 1.2, mat.rail, x + s * 0.65, cy + 0.35, z);
      bot(x, Math.max(0, cy - (ramp >= 1 ? 0.0 : 0)), z, 1.15, 0);
      S(0.08, mat.amber, x, Y - 0.32, z * 0.55);
    }
    for (const [x, ext] of [[5.2, 0.1], [-4.6, -0.1]]) for (const s of [-1, 1]) {
      beam([x, Y, s * 0.6], [x, Y, s * 2.7], 0.4, 0.35, mat.armor); pod(x, s * 2.95, Y - 1.3, 0.62, 1.55, ext);
      strip(x + 0.3, s * 0.7, x + 0.3, s * 2.5, 0.08, Y + 0.18, 0.04, mat.glow);
      lights([[x, Y + 0.3, s * 2.95, s < 0 ? mat.navR : mat.navG, 0.13]]);
    }
    hc(0.7, 1.0, mat.armor, -6.8, Y, 0, 'x', { r2: 0.55 }); nozzle(-7.3, Y, 0, 0.5, [-1, 0, 0], thr * 0.7, 0.9);
    strip(4.8, 0, -5.8, 0, 0.12, Y + 0.76, 0.04, mat.glow);
    for (const [x, z] of [[5.2, -2.95], [5.2, 2.95], [-4.6, -2.95], [-4.6, 2.95]]) leg(x, z, Y - 1.35, gear, 0, 0);
    landLamp(7.1, Y - 0.6, 0); lights([[-7.4, Y + 0.6, 0, mat.white, 0.1]]);
    grime(K.rect(4.8, -0.4, -5.8, 0.4), Y + 0.77, 0.4, 2);
  }

  if (c === 'gun_a') {
    // The Lancet, made to read apart from the Vulcan Bomber at game zoom: short and broad-backed (an arrowhead, widest at
    // the tail, not a long fuselage with wings), two long cannon barrels out past the nose, and four round lift pods (two on
    // short stubs, two at the tail corners) seen from above as glowing discs, with no jet nozzle, wings or tail fins.
    const Y = yb + 0.9;
    const st = [[4.4, 0.1, 0.08, 0.08], [3.4, 0.7, 0.36, 0.32], [1.0, 1.25, 0.6, 0.48], [-2.2, 1.55, 0.62, 0.5], [-3.3, 1.35, 0.5, 0.42]];
    facet(st.map(([x, w, h, b]) => ({ x, w, h, b, t: w * 0.45, m: 0.3, bt: w * 0.5, y: Y })), [mat.roof, mat.top, mat.armor]);
    visor(2.9, Y + 0.48, 0, 0.9, 0.25);
    for (const s of [-1, 1]) {
      // the twin cannons: long barrels under the chines, running out well past the nose (a tuning fork from above)
      hc(0.16, 4.6, mat.rail, 4.2, Y - 0.3, s * 0.62, 'x'); hc(0.27, 1.6, mat.armor, 1.9, Y - 0.3, s * 0.62, 'x');
      hc(0.22, 0.35, mat.steel, 6.35, Y - 0.3, s * 0.62, 'x'); // muzzle brakes
      if (fire) { S(0.24, K.M.emit('#efe8ff', 4.5), 6.75, Y - 0.3, s * 0.62); } muzzle(6.6, Y - 0.3, s * 0.62, [1, 0, 0]);
      // short straight stubs (no sweep, no wing) out to round lift pods
      plate([[0.6, s * 1.1], [0.6, s * 2.3], [-0.9, s * 2.3], [-0.9, s * 1.1]], Y + 0.05, 0.18, mat.armor, { bevel: 0.04 });
      pod(-0.15, s * 2.75, Y - 0.55, 0.62, 1.0, 0); lights([[0.5, Y + 0.25, s * 2.75, s < 0 ? mat.navR : mat.navG, 0.11]]);
      // the tail pods at the corners of the broad stern
      beam([-3.0, Y, s * 1.2], [-3.0, Y, s * 1.75], 0.4, 0.34, mat.armor);
      pod(-3.0, s * 2.05, Y - 0.5, 0.5, 0.9, 0);
      // a team chevron across the back (the Lancet's mark: a bright V, not the Vulcan's long double line)
      strip(0.6, 0, -1.6, s * 1.3, 0.09, Y + 0.62, 0.03, mat.glow);
    }
    B(1.2, 0.3, 1.6, mat.top, -2.6, Y + 0.55, 0); B(0.9, 0.06, 1.2, mat.seam, -2.6, Y + 0.86, 0, { cast: false });
    for (const [x, z] of [[2.0, 0], [-2.6, -0.9], [-2.6, 0.9]]) leg(x, z, Y - 0.45, gear);
    landLamp(3.6, Y - 0.25, 0, 0.08); lights([[-3.35, Y + 0.3, 0, mat.white, 0.1]]);
  }

  if (c === 'gun_b') {
    const Y = yb + 1.0;
    facet([{ x: 2.3, ...oct(0.35), y: Y }, { x: 1.8, ...oct(1.0), y: Y }, { x: -1.2, ...oct(1.1), y: Y }, { x: -2.0, ...oct(0.7), y: Y }], [mat.roof, mat.top, mat.armor]);
    visor(1.95, Y + 0.6, 0, 0.9, 0.7);
    { const g = new THREE.TorusGeometry(3.1, 0.24, 6, 32); g.rotateX(Math.PI / 2); K.L.mesh(g, mat.armor, 0, Y, 0, { parent: G, dirt: 0 });
      const g2 = new THREE.TorusGeometry(3.1, 0.07, 4, 48); g2.rotateX(Math.PI / 2); K.L.mesh(g2, mat.glow, 0, Y + 0.22, 0, { parent: G, dirt: 0, cast: false }); }
    for (const a of [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]) {
      const x = Math.cos(a) * 3.1, z = Math.sin(a) * 3.1;
      beam([Math.cos(a) * 0.9, Y, Math.sin(a) * 0.9], [Math.cos(a) * 2.9, Y, Math.sin(a) * 2.9], 0.3, 0.26, mat.steel);
      K.C(0.55, 1.0, mat.armor, x, Y - 0.55, z, { seg: 8, rTop: 0.45 }); K.C(0.57, 0.07, mat.glow, x, Y - 0.05, z, { seg: 8, cast: false });
      nozzle(x, Y - 0.55, z, 0.4, [0, -1, 0], thr, 0.7);
      lights([[x, Y + 0.5, z, z < 0 ? mat.navR : mat.navG, 0.1]]);
    }
    // the chin turret: a ball with a twin rotary gun forward
    K.S(0.55, mat.armor, 1.5, Y - 0.8, 0, { cast: true });
    for (const s of [-1, 1]) { hc(0.11, 2.2, mat.rail, 2.7, Y - 0.85, s * 0.22, 'x'); muzzle(3.8, Y - 0.85, s * 0.22, [1, 0, 0]); if (fire) S(0.2, K.M.emit('#fff1c2', 4), 3.85, Y - 0.85, s * 0.22); }
    nozzle(-2.1, Y, 0, 0.38, [-1, 0, 0], thr * 0.7, 0.8);
    for (const a of [0, 2.1, -2.1]) leg(Math.cos(a) * 1.0, Math.sin(a) * 1.0, Y - 0.8, gear);
    landLamp(1.8, Y - 0.6, 0.6, 0.08); lights([[-1.0, Y + 1.1, 0, mat.navR, 0.12]]);
  }
}

export default function (L) {
  const c = P.get('c') || 'shuttle_a', view = P.get('view') || 'top';
  const f = num('f', 0), bob = view === 'hero' ? 0.25 * Math.sin(f * Math.PI / 2) : 0;
  const alt = num('alt', view === 'hero' ? 3.0 : 0) + bob;
  const K = space(L, { view, W: num('W', SIZE[c]), hero: { half: num('half', 7.2), width: num('width', 0.72), cy: num('cy', 0.5) } });
  build(K, c, { thr: num('thr', 1), gear: num('gear', 0), ramp: num('ramp', 0), alt, fire: num('fire', 0), empty: num('empty', 0), bots: num('bots', 1) !== 0 });
  K.settle();
}
