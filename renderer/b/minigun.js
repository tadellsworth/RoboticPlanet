// Minigun Nest, rendered in layers on the shared pad framing (same scheme as the Flak Gun and Pulse Turret).
//   ?part=base            the emplacement: a low D-shaped armoured nest (square plated walls at the back, a curved
//                         armour shield and a sandbag berm across the front), open crates of linked brass belts with a
//                         feed chute into a raised ring mount, spent brass on the floor, and an EMPTY turntable
//   ?part=head&rot=k&n=N  the gun alone: a six-barrel rotary minigun (barrel cluster with rear, middle and front
//                         clamps, a drive motor at the back) on a short pivoting yoke behind a curved gun shield, an
//                         ammo box on its left side feeding a brass belt into the receiver, barrels nearly level;
//                         turned to direction k of N (0 = right, then clockwise seen from above). No team colour on
//                         the head (one set serves both teams), only a small amber ready lamp. Camera and light never
//                         move; the turntable centre never moves. The 'muzzle' mark is the centre of the cluster's
//                         front face (the tracers start there).
// Powered realism (b/powerkit.js), kept light and on the base layer only (built last, so the seeded textures and the
// head frames are untouched): a team strip along the top of the walls and the front shield, status lights on the
// ring mount, a junction box at the front right with an amber beacon conduited under the sandbags, a searchlight on
// a post at the back right with a team beacon on top and a cable to the nest.
import { bagArc, offsetPoly, frustum, band } from './milkit.js';
import { power } from './powerkit.js';

export default function (L) {
  const { box, cyl, hcyl, beam, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), part = p.get('part') || 'base', rot = +(p.get('rot') || 0), n = +(p.get('n') || 8);
  L.seed(947);
  const armor = M.paint('#4f5559'), gun = M.paint('#5f666c', { rivets: false, metal: 0.5, rough: 0.45 }), olive = M.paint('#5d6247');
  const barrelM = M.paint('#3d4349', { rivets: false, metal: 0.6, rough: 0.4 }), clampM = M.paint('#a2a8ad', { rivets: false, metal: 0.6, rough: 0.35 });
  const stencil = M.plain('#b8962e', 0.7, 0.1), glow = M.emit(TEAM, 3), bag = M.rough('#9a8763'), steelD = M.paint('#3c4146', { rivets: false });
  const brass = new THREE.MeshStandardMaterial({ color: '#c99d48', roughness: 0.3, metalness: 0.9, vertexColors: true }); brass.envMapIntensity = 0.95;
  const copper = new THREE.MeshStandardMaterial({ color: '#b5653a', roughness: 0.35, metalness: 0.85, vertexColors: true });
  const cz = -0.1, FLOOR = 0.12, WT = 0.62, DRUM = 0.42, RING_Y = FLOOR + DRUM;   // turntable top: the head's pivot sits here

  // ---- base layer
  const base = group(0, 0, 0, 0);
  const B = { parent: base };
  // the nest outline: square at the back (chamfered corners), a half-circle across the front
  const HX = 2.25, HZ = 2.05, CH = 0.6, NA = 14;
  const D = [];
  for (let i = 0; i <= NA; i++) { const a = (i / NA) * Math.PI; D.push([Math.cos(a) * HX, cz + Math.sin(a) * HX]); }
  D.push([-HX, cz - HZ + CH], [-HX + CH, cz - HZ], [HX - CH, cz - HZ], [HX, cz - HZ + CH]);
  const OUT0 = offsetPoly(D, -0.26), OUT1 = offsetPoly(D, -0.08), IN = offsetPoly(D, 0.22);
  ao(0, cz, 5.4, 5.2, 0.5);
  // floor slab and the sloped plated walls (outer face, inner face, concrete cap)
  frustum(L, IN, IN, 0, FLOOR, M.concrete, { parent: base, dirt: 0.5 });
  frustum(L, OUT0, OUT1, 0, WT, armor, { cap: false, parent: base, dirt: 0.7, dirtH: 0.7 });
  const wallIn = M.concrete.clone(); wallIn.side = THREE.DoubleSide;
  frustum(L, IN, IN, FLOOR - 0.01, WT, wallIn, { cap: false, parent: base, dirt: 0.5 });
  band(L, OUT1, 0.3, WT, M.rough('#7f796f'), { parent: base });
  // the curved front shield: a slanted, double-skinned armour plate standing on the front arc of the wall
  const S0 = -Math.PI / 2, SL = Math.PI, SH = 0.42, sR0 = HX + 0.04, sR1 = HX - 0.06;
  const shell = (r0, r1, y0, h, mat, side) => {
    const g = new THREE.CylinderGeometry(r1, r0, h, 40, 2, true, S0, SL); g.translate(0, h / 2, 0);
    const m = mesh(g, mat, 0, y0, cz, { parent: base, dirt: 0.4, dirtH: h }); if (side) m.material = side; return m;
  };
  const plate = armor.clone(); plate.side = THREE.DoubleSide;
  shell(sR0, sR1, WT, SH, plate); shell(sR0 - 0.14, sR1 - 0.14, WT, SH, plate);
  { const g = new THREE.RingGeometry(sR1 - 0.15, sR1 + 0.005, 40, 1, S0 - Math.PI / 2, SL); g.rotateX(-Math.PI / 2);
    // (RingGeometry runs in the XY plane from +x; turned flat and round so it matches the cylinder's sweep)
    const uv = g.attributes.uv, pos = g.attributes.position;
    for (let i = 0; i < uv.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)), r = Math.hypot(pos.getX(i), pos.getZ(i)); uv.setXY(i, a * r * 1.6, (r - sR1) * 3); }
    mesh(g, steelD, 0, WT + SH + 0.004, cz, { parent: base, dirt: 0, cast: true }); }
  // end posts where the shield meets the straight walls
  for (const s of [-1, 1]) box(0.3, SH + 0.06, 0.3, steelD, s * (HX - 0.02), WT, cz, { parent: base, dirt: 0.3 });
  // the sandbag berm piled against the front of the shield, wrapping a little round the sides
  bagArc(L, 0, cz, HX + 0.62, 0.06 * Math.PI, 0.94 * Math.PI, 2, { lean: 0.07, mat: bag, parent: base });
  bagArc(L, 0, cz, HX + 0.48, 0.2 * Math.PI, 0.8 * Math.PI, 1, { lean: 0.07, mat: bag, parent: base, y: 0.62 });

  // raised ring mount (the turntable): an armoured drum with a hazard band, a bolt circle and a feed port
  cyl(0.9, DRUM - 0.1, armor, 0, FLOOR, cz, { seg: 48, rTop: 0.87, dirt: 0.5, ...B });
  cyl(0.88, 0.1, M.hazard, 0, FLOOR + DRUM - 0.1, cz, { seg: 48, dirt: 0, ...B });
  cyl(0.8, 0.014, M.dark, 0, RING_Y, cz, { seg: 48, dirt: 0, cast: false, ...B });
  cyl(0.76, 0.02, M.paint('#686e74', { rivets: false, metal: 0.5, rough: 0.5 }), 0, RING_Y, cz, { seg: 48, dirt: 0, cast: false, ...B });
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; cyl(0.035, 0.035, M.chrome, Math.cos(a) * 0.82, RING_Y, cz + Math.sin(a) * 0.82, { seg: 8, dirt: 0, ...B }); }
  // feed port on the drum's back-left side
  const fa = Math.PI * 1.25, fpx = Math.cos(fa) * 0.89, fpz = cz + Math.sin(fa) * 0.89;
  box(0.34, 0.22, 0.12, steelD, fpx, FLOOR + 0.12, fpz, { ry: -fa + Math.PI / 2, dirt: 0.2, ...B });

  // open crates of linked brass belts: an olive box with no lid, the belt folded inside in rows of rounds
  const beltCrate = (x, z, ry, open = true, y = FLOOR) => {
    const g = group(x, y, z, ry, base), G = { parent: g };
    const W = 0.78, H = 0.36, Dd = 0.5, t = 0.05;
    box(W, 0.05, Dd, olive, 0, 0, 0, { ...G, dirt: 0.3 });
    if (!open) { box(W, H, Dd, olive, 0, 0, 0, { ...G, dirt: 0.5 }); box(W + 0.02, 0.05, Dd + 0.02, steelD, 0, H, 0, { ...G, dirt: 0 });
      box(0.12, H * 0.6, Dd + 0.012, stencil, -0.22, H * 0.2, 0, { ...G, dirt: 0, cast: false }); return g; }
    for (const s of [-1, 1]) { box(W, H, t, olive, 0, 0, s * (Dd - t) / 2, { ...G, dirt: 0.5 }); box(t, H, Dd, olive, s * (W - t) / 2, 0, 0, { ...G, dirt: 0.5 }); }
    box(t + 0.02, 0.06, Dd + 0.02, steelD, -(W - t) / 2, H - 0.03, 0, { ...G, dirt: 0 });
    box(t + 0.02, 0.06, Dd + 0.02, steelD, (W - t) / 2, H - 0.03, 0, { ...G, dirt: 0 });
    // the belt: folds across the crate, rounds lying along z, tips forward, dark links under them
    for (let r = 0; r < 4; r++) {
      const zr = -0.15 + r * 0.1, yr = H - 0.1 + (r % 2) * 0.012;
      box(W - 2 * t - 0.02, 0.03, 0.05, M.dark, 0, yr - 0.03, zr, { ...G, dirt: 0, cast: false });
      for (let k = 0; k < 11; k++) {
        const xr = -(W - 2 * t) / 2 + 0.04 + k * 0.059;
        const c = hcyl(0.024, 0.13, brass, xr, yr, zr, { axis: 'z', seg: 10, ...G, dirt: 0 });
        hcyl(0.016, 0.04, copper, xr, yr, zr + 0.085, { axis: 'z', seg: 8, ...G, dirt: 0 }); void c;
      }
    }
    return g;
  };
  const crateA = beltCrate(-1.42, cz - 1.25, 0.62);
  beltCrate(1.5, cz - 1.22, -0.6);
  // the feed chute: a ribbed flexible chute from the back-left crate up and over into the drum's feed port
  { const a = new THREE.Vector3(-1.42, FLOOR + 0.42, cz - 1.25).add(new THREE.Vector3(0.18, 0, 0.12)), b = new THREE.Vector3(fpx, FLOOR + 0.22, fpz);
    const c1 = new THREE.Vector3(a.x + 0.05, a.y + 0.38, a.z + 0.05), c2 = new THREE.Vector3(b.x - 0.25, b.y + 0.42, b.z - 0.25);
    const curve = new THREE.CubicBezierCurve3(a, c1, c2, b), pts = curve.getPoints(12);
    for (let i = 0; i < pts.length - 1; i++) {
      beam(pts[i].toArray(), pts[i + 1].toArray(), 0.2, 0.075, steelD, { parent: base });
      const m = pts[i].clone().lerp(pts[i + 1], 0.5), d = pts[i + 1].clone().sub(pts[i]).normalize().multiplyScalar(0.02);
      beam(m.clone().sub(d).toArray(), m.clone().add(d).toArray(), 0.23, 0.095, M.steel, { parent: base });
    } }
  void crateA;
  // spent brass on the nest floor in front of the mount
  for (let k = 0; k < 22; k++) {
    const a = 0.12 * Math.PI + L.rnd() * 0.76 * Math.PI, r = 1.0 + L.rnd() * 0.85;
    const m = hcyl(0.02, 0.1, brass, Math.cos(a) * r, FLOOR + 0.02, cz + Math.sin(a) * r, { axis: 'x', seg: 8, ...B, dirt: 0, cast: false });
    m.rotation.y = L.rnd() * Math.PI;
  }
  // closed ammo crates stacked outside at the back left
  beltCrate(-3.1, -3.15, 0.15, false, 0); beltCrate(-3.15, -2.45, -0.1, false, 0);
  beltCrate(-3.1, -2.8, 0.05, false, 0.41);
  ao(-3.1, -2.8, 1.1, 1.4, 0.4);

  // ---- head layer: the minigun, built at the origin facing +x, then put on the turntable
  const head = group(0, 0, 0, 0);
  const H = { parent: head };
  cyl(0.55, 0.1, gun, 0, 0, 0, { seg: 32, dirt: 0.3, ...H });                                   // traversing ring
  cyl(0.26, 0.3, steelD, 0, 0.1, 0, { seg: 20, rTop: 0.2, dirt: 0.2, ...H });                  // pivot pedestal
  box(0.42, 0.08, 0.86, gun, -0.05, 0.38, 0, { dirt: 0.2, ...H });                               // yoke
  for (const s of [-1, 1]) box(0.3, 0.42, 0.07, gun, -0.05, 0.42, s * 0.4, { dirt: 0.2, ...H });
  for (const s of [-1, 1]) hcyl(0.07, 0.1, steelD, -0.05, 0.7, s * 0.45, { axis: 'z', ...H });  // trunnions
  // the gun, on a cradle raised a touch above level
  const ELEV = 4 * Math.PI / 180, BL = 1.7, X0 = 0.3, CR = 0.13;
  const cradle = new THREE.Group(); cradle.position.set(-0.05, 0.7, 0); cradle.rotation.z = ELEV; head.add(cradle);
  const C = { parent: cradle };
  // curved gun shield across the front, leaning back a little, the barrel cluster through a collared port
  { const T0 = Math.PI / 2 - 0.62, TL = 1.24, sh = 0.68, cx = -0.35;
    const g = new THREE.CylinderGeometry(0.84, 0.92, sh, 20, 3, true, T0, TL); g.translate(0, sh / 2, 0);
    const pm = M.paint('#737a80').clone(); pm.side = THREE.DoubleSide;
    mesh(g, pm, cx, -0.36, 0, { dirt: 0.25, dirtH: sh, ...C });
    const t = new THREE.TorusGeometry(0.84, 0.035, 6, 20, TL); t.rotateX(Math.PI / 2); t.rotateY(0.62);
    mesh(t, steelD, cx, -0.36 + sh, 0, { dirt: 0, ...C });
    hcyl(0.24, 0.1, steelD, cx + 0.9, 0, 0, { ...C }); }
  box(0.82, 0.3, 0.34, gun, -0.2, -0.15, 0, { dirt: 0.2, ...C });                              // receiver
  box(0.5, 0.06, 0.3, steelD, -0.25, 0.15, 0, { dirt: 0, ...C });                              // top cover
  hcyl(0.15, 0.36, steelD, -0.78, 0.0, 0, { ...C });                                            // drive motor
  hcyl(0.12, 0.04, M.dark, -0.98, 0.0, 0, { ...C });
  for (const x of [-0.7, -0.84]) hcyl(0.16, 0.03, M.steel, x, 0.0, 0, { ...C });                // motor bands
  box(0.2, 0.12, 0.16, steelD, -0.35, 0.21, 0.0, { dirt: 0, ...C });                            // sight box
  box(0.03, 0.08, 0.1, M.plain('#16222b', 0.15, 0.6), -0.245, 0.23, 0.0, { dirt: 0, ...C });
  // the barrel cluster: rotor housing, six barrels round a spindle, middle and front clamps
  hcyl(0.22, 0.3, gun, X0 + 0.15, 0, 0, { ...C });
  hcyl(0.2, 0.05, clampM, X0 + 0.32, 0, 0, { ...C });
  hcyl(0.05, BL, steelD, X0 + BL / 2, 0, 0, { seg: 12, ...C });
  for (let k = 0; k < 6; k++) {
    const a = k * Math.PI / 3 + Math.PI / 6, y = Math.cos(a) * CR, z = Math.sin(a) * CR;
    hcyl(0.048, BL, barrelM, X0 + BL / 2, y, z, { seg: 14, ...C });
    hcyl(0.03, 0.012, M.dark, X0 + BL + 0.002, y, z, { seg: 10, ...C });
  }
  hcyl(0.2, 0.08, clampM, X0 + 0.85, 0, 0, { ...C });                                         // middle clamp
  hcyl(0.205, 0.12, clampM, X0 + BL - 0.13, 0, 0, { ...C });                                     // front clamp
  hcyl(0.07, 0.02, M.dark, X0 + BL - 0.065, 0, 0, { seg: 12, ...C });
  // the ammo box on the left side and the belt feeding up into the receiver
  box(0.5, 0.34, 0.26, olive, -0.32, -0.42, -0.6, { dirt: 0.3, ...C });
  box(0.52, 0.04, 0.28, steelD, -0.32, -0.08, -0.6, { dirt: 0, ...C });
  box(0.3, 0.06, 0.12, steelD, -0.25, -0.3, -0.46, { dirt: 0, ...C });                           // bracket
  { const a = new THREE.Vector3(-0.3, -0.04, -0.6), b = new THREE.Vector3(-0.2, 0.0, -0.17);
    const c1 = new THREE.Vector3(-0.3, 0.32, -0.6), c2 = new THREE.Vector3(-0.22, 0.3, -0.17);
    const pts = new THREE.CubicBezierCurve3(a, c1, c2, b).getSpacedPoints(11);
    for (let i = 0; i < pts.length; i++) {
      hcyl(0.024, 0.15, brass, pts[i].x, pts[i].y, pts[i].z, { axis: 'x', seg: 10, ...C, dirt: 0 });
      hcyl(0.016, 0.04, copper, pts[i].x + 0.09, pts[i].y, pts[i].z, { axis: 'x', seg: 8, ...C, dirt: 0 });
      if (i < pts.length - 1) beam([pts[i].x - 0.03, pts[i].y - 0.015, pts[i].z], [pts[i + 1].x - 0.03, pts[i + 1].y - 0.015, pts[i + 1].z], 0.05, 0.02, M.dark, { parent: cradle });
    } }
  // small amber ready lamp on the receiver: lit, but not a glow material, so the evening and night passes don't hang a
  // point light on it (that would wash the whole gun orange while the base round it is lit in team colour)
  { const lm = new THREE.MeshStandardMaterial({ color: '#ffb347', emissive: '#ffb347', emissiveIntensity: 2.6, roughness: 0.4 });
    box(0.07, 0.055, 0.07, lm, -0.52, 0.15, 0.12, { dirt: 0, cast: false, ...C }); }
  head.position.set(0, RING_Y, cz); head.scale.setScalar(1.5); head.rotation.y = -rot * (Math.PI * 2 / n);
  mark('muzzle', X0 + BL + 0.01, 0, 0, cradle); mark('breech', X0, 0, 0, cradle); mark('pivot', 0, 0, 0, head);

  if (part === 'base') { head.visible = false; pointLight(TEAM, 2, 0, 1.3, cz + 1.4, 3); }
  else { base.visible = false; L.hidePad(); L.getRoot().traverse(o => { if (o.userData.decal) o.visible = false; }); }

  // ================================================================ power layer (base only; lights and electricity)
  if (part === 'base') {
    const P = power(L), nc = { dirt: 0, cast: false };
    const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;
    // team strip along the outer top edge of the straight walls, and round the top of the front shield
    const E = offsetPoly(D, -0.1);
    for (let i = NA; i < E.length; i++) {
      const a = E[i], b = E[(i + 1) % E.length];
      box(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.045, 0.05, P.glow, (a[0] + b[0]) / 2, WT - 0.07, (a[1] + b[1]) / 2, { ry: Math.atan2(-(b[1] - a[1]), b[0] - a[0]), ...nc });
    }
    { const g = new THREE.TorusGeometry(sR1 + 0.012, 0.028, 6, 40, SL); g.rotateX(Math.PI / 2); g.rotateY(S0 + SL - Math.PI / 2);
      mesh(g, P.glow, 0, WT + SH - 0.05, cz, nc); }
    // status lights on the ring mount's front
    for (const [k, mat] of [[-0.12, P.green], [0, P.amber], [0.12, P.glow]]) {
      const a = Math.PI / 2 + k; box(0.07, 0.06, 0.03, mat, Math.cos(a) * 0.975, FLOOR + 0.18, cz + Math.sin(a) * 0.975, { ry: -a + Math.PI / 2, ...nc });
    }
    // junction box at the front right with an amber beacon, its conduit diving under the sandbags
    P.junction(3.45, 3.3, -0.25); P.beacon(3.45, 0.82, 3.3, '#ffb347'); ao(3.45, 3.3, 0.5, 0.4, 0.3);
    P.conduit([[3.3, 0.4, 3.1], [3.2, 0.3, 2.85], [2.25, 0.3, 1.9], [2.05, 0.06, 1.75]], 0.05);
    // searchlight on a post at the back right, a team beacon on top, a cable over to the nest wall
    { const x = 2.95, z = -2.85, h = 1.9, ry = -0.8;
      cyl(0.05, h, P.steelD, x, 0, z, { seg: 10, dirt: 0.2 }); ao(x, z, 0.4, 0.4, 0.3);
      box(0.22, 0.1, 0.22, P.steelD, x, 0, z, { dirt: 0.3 });
      const g = group(x, h - 0.05, z, ry), t = new THREE.Group(); t.rotation.x = 0.3; g.add(t);
      const lampBody = new THREE.CylinderGeometry(0.17, 0.13, 0.32, 20); lampBody.rotateX(Math.PI / 2);
      mesh(lampBody, P.steel, 0, 0, 0.05, { parent: t, dirt: 0 });
      const lens = new THREE.CircleGeometry(0.145, 20); mesh(lens, P.white, 0, 0, 0.215, { parent: t, ...nc });
      box(0.05, 0.22, 0.05, P.steelD, 0, -0.2, -0.02, { parent: t, dirt: 0 });
      P.beacon(x, h + 0.25, z);
      pointLight('#fff1d6', 3.5 * NB, x + Math.sin(ry) * 1.5, h - 0.8, z + Math.cos(ry) * 1.5, 4.5);
      P.cable([x, h - 0.4, z], [1.8, WT + 0.02, cz - 2.0], 0.18); }
  }
}
