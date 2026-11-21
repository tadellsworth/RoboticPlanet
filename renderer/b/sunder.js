// The Sundering Ray (IDEAS.md "Megastructures", the owner's look B, "Piston Battery", Nov 2026; drawn on the sheet as
// the Seismic Lance): a phased array, three great hydraulic rams in a long concrete block (an engine buried up to its
// cylinder heads) round the bore tower over a deep shot hole, two stacks, and a row of six ram plates set in the ground
// before it. A 3 x 3 concrete pad (30 x 30 world units, the middle of its nine tiles at the origin), rendered in layers
// on one wide frame like the Lance of Corvane (the pad's 30 units across 0.62 of it, about 4.8 tiles).
//   ?part=base            the pad and the block: the two ram bores EMPTY (the rams are their own layer), the bore tower
//                         in the middle over the shot hole (a lattice tower round a steel casing, crown sheave, team band,
//                         a red beacon), the two stacks at the back, the hydraulic manifold and its lines out to the six
//                         plate sockets (the plates are their own layer), the control cabin at the front left with a lit
//                         window band and a team stripe, a hydraulic pump house at the front right, amber lamps.
//   ?part=site&stage=1|2  under construction: 1 the pad poured, the shot hole drilled (the rig over it), the block's
//                         formwork and rebar, the plate sockets marked out, pallets of goods; 2 the block cast, the bore
//                         tower's lattice half up in scaffolding, a crawler crane, the stacks' first sections.
//   ?part=ram&side=-1|1&e=0|1|2   one great ram alone, west (-1) or east (1), its head down (0), half up (1) or full up (2)
//                         on its chrome rod. No team colour (one set for every team).
//   ?part=plate&k=0..5&e=0|1      one ram plate alone (0 the westmost), seated (0) or raised on its rams (1).
// Marks: 'bore' (the shot hole's mouth), 'top' (the bore tower's crown), 'stackW', 'stackE' (the stack mouths),
// 'ramW', 'ramE' (the rams' bores), 'plate0'..'plate5' (the plates' middles).
const Q = new URLSearchParams(location.search);
const PART = Q.get('part') || 'base', SIDE = +(Q.get('side') || 1), EXT = +(Q.get('e') || 0), K = +(Q.get('k') || 0), STAGE = +(Q.get('stage') || 1);
const PI = Math.PI;
export const config = { pad: false };

import { power } from './powerkit.js';

export default function (L) {
  const { box, cyl, hcyl, hoop, sphere, mesh, group, mark, ao, pointLight, pipe, M, THREE } = L;
  L.seed(9120 + (PART === 'site' ? STAGE : 0));
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.56 });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#9c958a'), concD: M.rough('#7c766c'), concL: M.rough('#b2ab9e'), earth: M.rough('#6e5d48'),
    steel: M.steel, dark: M.dark, chrome: M.chrome, grey: M.paint('#5d636a', { metal: 0.4 }), greyD: M.paint('#3f454b', { rivets: false, metal: 0.5 }),
    gun: M.paint('#4f565c', { metal: 0.45, rough: 0.45 }), orange: M.paint('#d6762a', { rivets: false, rough: 0.5 }),
    yellow: M.paint('#d8a92c'), white: M.paint('#d6d2c8', { rivets: false }), team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }),
    wood: M.plain('#9b7a52', 0.9, 0), rebar: M.plain('#6e4a33', 0.7, 0.5), hole: M.plain('#0d0b0a', 1, 0),
    nc: { dirt: 0, cast: false },
  };
  const amber = dark ? M.emit('#ffb347', 2.6) : M.plain('#c7a46b', 0.35, 0.3);
  const red = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  const warmWin = dark ? M.emit('#ffd9a0', 1.6) : M.plain('#3b4652', 0.2, 0.3);

  // The block: z -12.5 .. -1.5 (the back of the pad, up the screen), 24 wide, its deck BH up.
  const BH = 3.4, BZ = -7, BX = 7.6, BORE_R = 2.7;
  const plateX = (k) => -11.25 + k * 4.5, PZ = 6.6;

  const base = group(0, 0, 0, 0), B = { parent: base };
  const parts = group(0, 0, 0, 0), P2 = { parent: parts };
  const full = PART === 'base', site = PART === 'site';

  // =================================================================================== the pad, the block, the tower
  if (full || site) {
    ao(0, 0, 28, 28, 0.35);
    // painted markings: hazard bands round the plate row, a white lane by the cabin
    { const g = new THREE.PlaneGeometry(27, 0.5); g.rotateX(-PI / 2); mesh(g, M.hazard, 0, 0.012, PZ - 2.6, { ...T.nc, ...B }); mesh(g.clone(), M.hazard, 0, 0.012, PZ + 2.6, { ...T.nc, ...B }); }
    // the plate sockets: dark steel-rimmed recesses
    for (let k = 0; k < 6; k++) {
      const x = plateX(k);
      box(3.6, 0.05, 3.6, T.greyD, x, 0.01, PZ, { ...T.nc, ...B });
      box(3.1, 0.06, 3.1, T.hole, x, 0.02, PZ, { ...T.nc, ...B });
      if (full) for (const dx of [-1.2, 1.2]) for (const dz of [-1.2, 1.2]) cyl(0.22, 0.25, T.chrome, x + dx, 0.03, PZ + dz, { seg: 10, dirt: 0, ...B });
      mark('plate' + k, x, 0.6, PZ);
    }
  }
  if (full || (site && STAGE >= 2)) {
    // the block: an engine buried to its cylinder heads, chamfered, ribbed on its front face
    box(25, BH, 11, T.concD, 0, 0, BZ, { dirt: 0.75, dirtH: BH, ...B });
    box(25.4, 0.35, 11.4, T.concL, 0, BH, BZ, { dirt: 0.3, ...B });
    for (let k = 0; k < 9; k++) box(0.6, BH - 0.4, 0.5, T.conc, -11 + k * 2.75, 0.2, BZ + 5.6, { dirt: 0.6, ...B });
    if (full) { box(25.04, 0.32, 0.1, T.team, 0, BH - 0.7, BZ + 5.52, T.nc); box(25.04, 0.2, 0.1, M.hazard, 0, 0.15, BZ + 5.52, T.nc); }
    if (full) {
      // the deck: a steel tread plate, the two ram bores (dark wells with heavy rims and orange collars), bolt circles
      box(24, 0.06, 10, M.grating, 0, BH + 0.35, BZ, { ...T.nc, ...B });
      for (const s of [-1, 1]) {
        const x = s * BX;
        cyl(BORE_R + 0.5, 0.42, T.greyD, x, BH + 0.35, BZ, { seg: 40, dirt: 0.2, ...B });
        cyl(BORE_R, 0.06, T.hole, x, BH + 0.78, BZ, { seg: 40, ...T.nc, ...B });
        hoop(BORE_R + 0.15, 0.14, T.orange, x, BH + 0.8, BZ, B);
        for (let k = 0; k < 16; k++) { const a = k * PI / 8; cyl(0.1, 0.12, T.chrome, x + Math.cos(a) * (BORE_R + 0.32), BH + 0.77, BZ + Math.sin(a) * (BORE_R + 0.32), { seg: 6, dirt: 0, ...B }); }
        // hydraulic accumulators beside each bore
        for (const dz of [-3.6, 3.6]) { cyl(0.55, 2.2, T.white, x + s * 3.9, BH + 0.35, BZ + dz * 0.8, { seg: 18, dirt: 0.3, ...B }); sphere(0.55, T.white, x + s * 3.9, BH + 2.55, BZ + dz * 0.8, B); }
        mark(s < 0 ? 'ramW' : 'ramE', x, BH + 0.8, BZ);
      }
      // the manifold along the front of the deck, and its lines down to the plates
      hcyl(0.42, 22, T.orange, 0, BH + 0.95, BZ + 4.3, { axis: 'x', dirt: 0.2, ...B });
      for (let k = 0; k < 6; k++) {
        const x = plateX(k);
        pipe([[x * 0.9, BH + 0.95, BZ + 4.4], [x * 0.95, BH - 0.4, BZ + 5.9], [x, 0.35, PZ - 2.3], [x, 0.25, PZ - 1.6]], 0.16, T.steel, B);
      }
    }
    // the bore tower over the shot hole: a heavy collar, the steel casing, a lattice of four legs and braces, crown
    const TH = full ? 13.5 : 7;
    cyl(3.2, 1.0, T.concD, 0, BH + 0.35, BZ, { seg: 8, dirt: 0.5, ...B });
    if (full) {
      cyl(2.1, 0.08, T.hole, 0, BH + 1.36, BZ, { seg: 32, ...T.nc, ...B });
      mark('bore', 0, BH + 1.4, BZ);
      hoop(2.25, 0.18, T.orange, 0, BH + 1.4, BZ, B);
      cyl(1.5, TH - 2.5, T.gun, 0, BH + 1.35, BZ, { seg: 28, dirt: 0.2, ...B });
      for (let k = 0; k < 5; k++) hoop(1.57, 0.12, k === 0 ? T.orange : T.greyD, 0, BH + 2.5 + k * 2, BZ, B);
    }
    const legs = [[-2.5, -2.5], [2.5, -2.5], [2.5, 2.5], [-2.5, 2.5]];
    for (const [dx, dz] of legs) box(0.38, TH, 0.38, T.grey, dx * (full ? 1 : 1), BH + 1.35, BZ + dz, { dirt: 0.3, ...B });
    for (let h = BH + 2.5; h < BH + TH; h += 2.2) for (let k = 0; k < 4; k++) {
      const [ax, az] = legs[k], [bx, bz] = legs[(k + 1) % 4];
      box(Math.hypot(bx - ax, bz - az), 0.14, 0.14, T.grey, (ax + bx) / 2, h, BZ + (az + bz) / 2, { ry: Math.atan2(-(bz - az), bx - ax), dirt: 0.1, ...B });
    }
    if (full) {
      const ty = BH + 1.35 + TH;
      box(5.2, 0.5, 5.2, T.greyD, 0, ty, BZ, { dirt: 0.2, ...B });
      box(5.26, 0.2, 5.26, T.team, 0, ty + 0.12, BZ, { ...T.nc, ...B });
      hcyl(1.0, 0.5, T.yellow, 0, ty + 1.3, BZ, { axis: 'x', dirt: 0.1, ...B });
      box(0.2, 1.4, 0.2, T.grey, -0.4, ty + 0.5, BZ, B); box(0.2, 1.4, 0.2, T.grey, 0.4, ty + 0.5, BZ, B);
      sphere(0.2, red, 0, ty + 2.5, BZ, { cast: false, ...B });
      mark('top', 0, ty + 2.5, BZ);
    }
    // the two stacks at the back corners
    const SH = full ? 12 : 4;
    for (const s of [-1, 1]) {
      const x = s * 11.2, z = -11.2;
      cyl(1.15, 1.2, T.concD, x, BH + 0.35, z, { seg: 20, dirt: 0.4, ...B });
      cyl(0.85, SH, T.gun, x, BH + 1.5, z, { seg: 20, dirt: 0.5, dirtH: SH, ...B });
      if (full) {
        for (let k = 0; k < 4; k++) hoop(0.9, 0.08, T.greyD, x, BH + 3 + k * 2.6, z, B);
        hoop(0.92, 0.16, T.orange, x, BH + 1.5 + SH - 0.4, z, B);
        cyl(0.7, 0.05, dark ? M.emit('#ff8a3a', 1.6) : T.hole, x, BH + 1.5 + SH, z, { seg: 20, ...T.nc, ...B });
        mark(s < 0 ? 'stackW' : 'stackE', x, BH + 1.5 + SH, z);
      }
    }
  }
  if (full) {
    // the control cabin at the front left: a lit window band and a team stripe; the pump house at the front right
    { const x = -10.4, z = 11.4;
      box(6.2, 2.8, 3.6, T.white, x, 0, z, { dirt: 0.5, dirtH: 2.8, ...B });
      box(6.4, 0.24, 3.8, T.concL, x, 2.8, z, { dirt: 0.3, ...B });
      box(6.22, 0.26, 3.62, T.team, x, 2.4, z, T.nc);
      box(5.2, 0.6, 0.06, warmWin, x, 1.35, z + 1.81, T.nc);
      cyl(0.08, 1.6, T.steel, x + 2.2, 3.04, z - 0.8, { seg: 8, ...B }); hcyl(0.5, 0.2, T.white, x + 2.2, 4.4, z - 0.8, { axis: 'z', ...B }); }
    { const x = 10.2, z = 11.6;
      box(6.4, 2.2, 3.4, T.grey, x, 0, z, { dirt: 0.5, dirtH: 2.2, ...B });
      box(6.6, 0.2, 3.6, T.greyD, x, 2.2, z, { dirt: 0.2, ...B });
      for (let k = 0; k < 5; k++) box(0.08, 1.4, 0.05, T.greyD, x - 2.4 + k * 1.2, 0.4, z + 1.72, T.nc);
      box(6.42, 0.14, 3.42, M.hazard, x, 1.9, z, T.nc);
      hcyl(0.55, 4.4, T.orange, x, 2.95, z - 0.2, { axis: 'x', dirt: 0.2, ...B });
      pipe([[x - 3.2, 1.2, z - 1.6], [x - 5, 1.2, z - 3.6], [6, 0.4, PZ + 2.6]], 0.2, T.orange, B); }
    // amber lamps on the block's corners
    for (const [x, z] of [[-12.4, BZ + 5.4], [12.4, BZ + 5.4], [-12.4, BZ - 5.4], [12.4, BZ - 5.4]]) { box(0.3, 0.6, 0.3, T.greyD, x, BH + 0.35, z, B); sphere(0.2, amber, x, BH + 1.05, z, { cast: false, ...B }); }
    if (dark) { pointLight('#ffc98a', 5 * NB, 0, BH + 4, BZ + 6, 16); pointLight('#ffd9a0', 3 * NB, -10, 3.5, 13.5, 8); }
  }

  // =================================================================================== construction stages
  if (site) {
    if (STAGE === 1) {
      // the block's footing: formwork boards and rebar standing up out of it; the shot hole drilled, its rig over it
      for (const [w, d, x, z] of [[25, 0.2, 0, BZ - 5.5], [25, 0.2, 0, BZ + 5.5], [0.2, 11, -12.5, BZ], [0.2, 11, 12.5, BZ]]) box(w, 0.9, d, T.wood, x, 0, z, { dirt: 0.3, ...B });
      box(24.6, 0.3, 10.6, T.concD, 0, 0, BZ, { dirt: 0.5, ...B });
      for (let i = -11; i <= 11; i += 1.6) for (let j = -4.5; j <= 4.5; j += 1.8) if (Math.abs(i) > 3.6 || Math.abs(j) > 3.6) box(0.08, RR(1.2, 1.8), 0.08, T.rebar, i, 0.3, BZ + j, { dirt: 0, ...B });
      cyl(2.1, 0.08, T.hole, 0, 0.31, BZ, { seg: 32, ...T.nc, ...B });
      // the drill rig: a small mast on a crawler over the hole
      box(3.2, 1.2, 2.2, T.yellow, 0, 0.3, BZ + 3.2, { dirt: 0.4, ...B });
      box(0.4, 7.5, 0.4, T.yellow, 0, 0.3, BZ + 1.6, { dirt: 0.3, ...B });
      box(0.16, 6.5, 0.16, T.steel, 0, 0.6, BZ + 1.1, { dirt: 0, ...B });
      // pallets of goods and a heap of spoil from the hole
      for (const [x, z, c] of [[-6, 11, T.concL], [-3, 11.5, T.grey], [3.5, 11, T.orange], [7, 11.6, T.concL]]) { box(2, 0.25, 2, T.wood, x, 0, z, B); box(1.7, 1.0, 1.7, c, x, 0.25, z, { dirt: 0.3, ...B }); }
      { const g = new THREE.SphereGeometry(2.6, 16, 8, 0, PI * 2, 0, PI / 2); g.scale(1.4, 0.55, 1); mesh(g, T.earth, 9.5, 0, -0.5, { dirt: 0.6, ...B }); }
    } else {
      // the tower's legs half up in scaffolding, a crawler crane, the bores still open
      for (const s of [-1, 1]) { cyl(BORE_R, 0.06, T.hole, s * BX, BH + 0.36, BZ, { seg: 32, ...T.nc, ...B }); }
      for (let h = BH + 0.4; h < BH + 7; h += 1.8) for (const dz of [-3.2, 3.2]) box(7, 0.12, 0.6, T.wood, 0, h, BZ + dz, { dirt: 0.2, ...B });
      for (const dx of [-3.4, 3.4]) for (const dz of [-3.2, 3.2]) box(0.12, 7, 0.12, T.steel, dx, BH + 0.4, BZ + dz, { dirt: 0, ...B });
      // the crane: tracks, cab, a lattice jib leaning over the block
      const cx = 8.5, cz = 9;
      box(5, 1.0, 3.2, T.greyD, cx, 0, cz, { dirt: 0.4, ...B });
      box(3.2, 1.8, 2.6, T.yellow, cx, 1.0, cz, { dirt: 0.3, ...B });
      { const g = group(cx - 0.6, 2.6, cz - 0.4, 0.5, B.parent); const jib = group(0, 0, 0, 0, g); jib.rotation.z = 0; box(0.5, 0.5, 15, T.yellow, 0, 0, -7.5, { parent: jib, dirt: 0.2 }); jib.rotation.x = 0.55; void jib; }
      for (const [x, z, c] of [[-7, 11, T.grey], [-3.5, 11.6, T.orange], [1, 11.2, T.concL]]) { box(2, 0.25, 2, T.wood, x, 0, z, B); box(1.7, 1.0, 1.7, c, x, 0.25, z, { dirt: 0.3, ...B }); }
    }
  }

  // =================================================================================== the rams and the plates
  if (PART === 'ram') {
    const x = SIDE * BX, rise = [0, 2.4, 4.8][EXT] || 0, top = BH + 0.8 + rise;
    // the chrome rod out of the bore, and the ram's head: a heavy cylinder with an orange band and a capped crown
    if (rise > 0.1) cyl(1.05, rise + 0.4, T.chrome, x, BH + 0.6, BZ, { seg: 28, dirt: 0, ...P2 });
    cyl(2.45, 2.0, T.gun, x, top, BZ, { seg: 40, dirt: 0.25, dirtH: 2, ...P2 });
    hoop(2.47, 0.2, T.orange, x, top + 1.3, BZ, P2);
    cyl(2.2, 0.35, T.greyD, x, top + 2.0, BZ, { seg: 40, dirt: 0.1, ...P2 });
    cyl(1.0, 0.5, T.grey, x, top + 2.35, BZ, { seg: 24, dirt: 0.1, ...P2 });
    for (let k = 0; k < 8; k++) { const a = k * PI / 4 + PI / 8; box(0.3, 0.3, 0.9, T.greyD, x + Math.cos(a) * 1.7, top + 2.35, BZ + Math.sin(a) * 1.7, { ry: -a, dirt: 0, ...P2 }); }
    mark('head', x, top + 2.85, BZ);
  }
  if (PART === 'plate') {
    const x = plateX(K), up = EXT ? 1.3 : 0;
    // the plate, its two lift rams and their yoke
    if (up) for (const dx of [-1.2, 1.2]) cyl(0.18, up + 0.3, T.chrome, x + dx, 0, PZ, { seg: 10, dirt: 0, ...P2 });
    box(3.0, 0.45, 3.0, T.gun, x, 0.05 + up, PZ, { dirt: 0.5, ...P2 });
    box(3.02, 0.08, 0.3, M.hazard, x, 0.5 + up, PZ + 1.36, { ...T.nc, ...P2 });
    for (const dx of [-1.2, 1.2]) cyl(0.32, 1.0, T.orange, x + dx, 0.5 + up, PZ, { seg: 14, dirt: 0.1, ...P2 });
    box(3.0, 0.3, 0.4, T.greyD, x, 1.5 + up, PZ, { dirt: 0.1, ...P2 });
  }

  if (PART === 'ram' || PART === 'plate') { base.visible = false; L.hidePad(); L.getRoot().traverse((o) => { if (o.userData.decal) o.visible = false; }); }
  else parts.visible = false;

  // ================================================================================== power layer (the finished one)
  if (full) {
    const Pw = power(L), nc = T.nc;
    // a team light strip along the block's front lip and round the tower's crown deck
    Pw.strip(24.6, 0, BH + 0.3, BZ + 5.72, 0);
    Pw.strip(24.6, 0, BH + 0.3, BZ - 5.72, 0);
    Pw.windows(3.0, 0.4, -10.4, 1.4, 11.4 + 1.85, 0, 3);
    Pw.junction(4.2, 13.4, 0);
    Pw.beacon(-12.6, BH + 1.2, BZ - 5.6, '#ff3a22'); Pw.beacon(12.6, BH + 1.2, BZ - 5.6, '#ff3a22');
    Pw.flood(-13.6, 2.2, 4.2, PI / 2 + 0.3); Pw.flood(13.6, 2.2, 4.2, -PI / 2 - 0.3);
    void nc;
  }
  void hcyl; void mesh;
}
