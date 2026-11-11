// Mortar Pit, rendered in layers on the shared pad framing (same scheme as the Pulse Turret).
//   ?part=base            the pit: sandbag and concrete ring, ammo crates, rangefinder, casings, EMPTY turntable plate
//   ?part=head&rot=k&n=N  the mortar alone (tube, bipod, round base plate), turned to direction k of N
//                         (0 = right, then clockwise seen from above: 1/8 turn = down-right toward the viewer).
//                         No team colour on the head. Camera and light never move; the base plate centre never moves.
// Powered realism (b/powerkit.js), kept light and on the base layer only (built last, so the head frames are
// untouched): team strips and warm lamps on the outer faces of the concrete blocks, a transformer at the back right
// and a junction box at the front right conduited into the blocks, a pole floodlight at the back left, beacons.
import { sandbag, bagArc } from './milkit.js';
import { power } from './powerkit.js';

export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), part = p.get('part') || 'base', rot = +(p.get('rot') || 0), n = +(p.get('n') || 8);
  L.seed(611);
  const armor = M.paint('#4c5258'), gun = M.paint('#575d63', { rivets: false, metal: 0.45, rough: 0.5 }), olive = M.paint('#5d6247');
  const team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 3), AMBER = '#ffb347';
  const bag = M.rough('#9a8763'), earth = M.rough('#6f5a45'), brass = new THREE.MeshStandardMaterial({ color: '#c49a4a', roughness: 0.32, metalness: 0.9, vertexColors: true });
  brass.envMapIntensity = 0.9;
  const cz = -0.2, FLOOR = 0.12, TT = 0.16, RING_Y = FLOOR + TT;   // turntable top: the mortar's base plate sits here

  // ---- base layer
  const base = group(0, 0, 0, 0);
  const B = { parent: base };
  cyl(3.75, 0.1, M.concrete, 0, 0, cz, { seg: 40, ...B }); ao(0, cz, 7.2, 7.2, 0.5);
  cyl(2.62, FLOOR - 0.1, earth, 0, 0.1, cz, { seg: 48, dirt: 0.6, ...B });              // pit floor, packed earth
  // inner revetment: a low concrete wall inside the bags
  const rev = M.concrete.clone(); rev.side = THREE.DoubleSide;
  cyl(2.66, 0.62, rev, 0, 0.1, cz, { seg: 48, open: true, ...B });
  // turntable: steel plate, darker inner ring, bolt circle, painted hazard ring on the floor round it
  const ring = new THREE.RingGeometry(1.08, 1.32, 48); ring.rotateX(-Math.PI / 2);
  { const uv = ring.attributes.uv, pos = ring.attributes.position; for (let i = 0; i < uv.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)), r = Math.hypot(pos.getX(i), pos.getZ(i)); uv.setXY(i, a * 1.32 * 1.4, (r - 1.08) * 2); } }
  mesh(ring, M.hazard, 0, FLOOR + 0.006, cz, { dirt: 0, cast: false, ...B });
  cyl(1.05, TT, M.steel, 0, FLOOR, cz, { seg: 48, dirt: 0, ...B });
  cyl(0.82, 0.012, M.dark, 0, RING_Y, cz, { seg: 48, dirt: 0, cast: false, ...B });
  cyl(0.62, 0.014, M.steel, 0, RING_Y, cz, { seg: 48, dirt: 0, cast: false, ...B });
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; cyl(0.045, 0.04, M.chrome, Math.cos(a) * 0.94, RING_Y, cz + Math.sin(a) * 0.94, { seg: 8, dirt: 0, ...B }); }

  // sandbag ring with concrete blocks set into it and a gap at the back-left for the crew
  const GAP = [Math.PI * 1.22, Math.PI * 1.42];
  const BLOCKS = [0.12, 0.88, 1.68].map(f => f * Math.PI);
  const inGap = a => { const t = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return t > GAP[0] && t < GAP[1]; };
  const nearBlock = a => BLOCKS.some(b => { let d = Math.abs(((a - b) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI); return d < 0.21; });
  bagArc(L, 0, cz, 3.0, 0, Math.PI * 2, 4, { lean: 0.05, mat: bag, parent: base, skip: (a, k) => inGap(a) || nearBlock(a) });
  bagArc(L, 0, cz, 3.45, 0, Math.PI * 2, 2, { lean: 0.06, mat: bag, parent: base, skip: (a, k) => inGap(a) || nearBlock(a) });
  for (const b of BLOCKS) {
    const g = group(Math.cos(b) * 3.15, 0, cz + Math.sin(b) * 3.15, -b + Math.PI / 2, base);
    box(1.15, 1.25, 1.05, M.concrete, 0, 0, 0, { parent: g, dirt: 0.6 });
    box(1.17, 0.12, 1.07, M.hazard, 0, 1.0, 0, { parent: g, dirt: 0 });
  }
  // steps down through the gap
  { const a = (GAP[0] + GAP[1]) / 2, g = group(Math.cos(a) * 3.2, 0, cz + Math.sin(a) * 3.2, -a + Math.PI / 2, base);
    for (let i = 0; i < 3; i++) box(1.1, 0.12, 0.35, M.concrete, 0, 0.22 + i * 0.0, -0.4 + i * 0.36, { parent: g, dirt: 0.4 }); }

  // ammunition crates stacked against the inside wall (back-right), team stripe on the lids
  const crate = (x, y, z, ry, open) => {
    const g = group(x, y, cz + z, ry, base);
    box(0.78, 0.42, 0.52, olive, 0, 0, 0, { parent: g, dirt: 0.4 });
    box(0.8, 0.05, 0.54, M.steel, 0, 0.42, 0, { parent: g, dirt: 0 });
    box(0.16, 0.012, 0.55, team, 0.2, 0.47, 0, { parent: g, dirt: 0, cast: false });
    box(0.81, 0.08, 0.16, team, 0, 0.26, 0, { parent: g, dirt: 0, cast: false });
    if (open) { box(0.66, 0.02, 0.42, M.dark, 0, 0.47, 0, { parent: g, dirt: 0 }); for (let i = 0; i < 5; i++) for (const dz of [-0.1, 0.1]) { cyl(0.05, 0.08, brass, -0.24 + i * 0.12, 0.47, dz, { parent: g, seg: 10, dirt: 0 }); sphere(0.05, M.paint('#5a6048', { rivets: false }), -0.24 + i * 0.12, 0.56, dz, { parent: g }); } }
  };
  crate(1.15, FLOOR, -2.05, -0.5, false); crate(1.85, FLOOR, -1.55, -0.95, false); crate(1.4, FLOOR + 0.47, -1.85, -0.7, true);
  crate(2.2, FLOOR, -0.65, -1.35, false);

  // rangefinder on a tripod with an amber lamp (back-left, inside the ring)
  { const x = -1.55, z = cz - 1.55, y0 = FLOOR, top = 1.25;
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3 + 0.4; beam([x + Math.cos(a) * 0.5, y0, z + Math.sin(a) * 0.5], [x, y0 + top, z], 0.05, 0.05, M.steel, B); }
    const g = group(x, y0 + top, z, -0.6, base);
    box(0.22, 0.2, 0.22, armor, 0, 0, 0, { parent: g, dirt: 0 });
    hcyl(0.08, 1.2, gun, 0, 0.28, 0, { axis: 'x', parent: g });
    for (const sx of [-0.6, 0.6]) hcyl(0.11, 0.14, M.dark, sx, 0.28, 0, { axis: 'x', parent: g });
    box(0.2, 0.18, 0.16, armor, 0, 0.36, 0.1, { parent: g, dirt: 0 });
    lamp(x - 0.02, y0 + top + 0.5, z, AMBER, { size: 0.15, k: 4, light: false });
  }
  // spent shell casings on the floor
  for (let i = 0; i < 9; i++) {
    const a = (i % 2 ? -0.35 : 0.45) * Math.PI + (L.rnd() - 0.5) * 0.9, r = 1.45 + L.rnd() * 0.7;
    const m = hcyl(0.065, 0.36, brass, Math.cos(a) * r, FLOOR + 0.065, cz + Math.sin(a) * r, { axis: 'x', parent: base, seg: 12 });
    m.rotation.y = L.rnd() * Math.PI;
  }
  // team signal lamp on a short post on the rim (front-left)
  { const a = Math.PI * 0.72, x = Math.cos(a) * 3.0, z = cz + Math.sin(a) * 3.0;
    cyl(0.07, 0.75, M.steel, x, 1.2, z, { ...B, dirt: 0 });
    box(0.4, 0.12, 0.4, armor, x, 1.95, z, { ...B, dirt: 0 });
    box(0.28, 0.3, 0.28, glow, x, 2.07, z, { ...B, cast: false, dirt: 0 });
    cyl(0.26, 0.07, armor, x, 2.37, z, { ...B, dirt: 0 });
  }

  // ---- head layer: the mortar, built leaning toward +x (east), its base plate centred on the turntable
  const head = group(0, 0, 0, 0);   // built at the origin (beams aim in world space), moved onto the turntable at the end
  const H = { parent: head };
  cyl(0.6, 0.1, gun, 0, 0, 0, { seg: 32, dirt: 0.3, ...H });
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; box(0.5, 0.08, 0.07, gun, Math.cos(a) * 0.32, 0.1, Math.sin(a) * 0.32, { ry: -a, dirt: 0, ...H }); }
  sphere(0.17, gun, 0, 0.16, 0, { ...H });
  const ELEV = 60 * Math.PI / 180, LEN = 2.2, R = 0.21;
  const tube = new THREE.Group(); tube.position.set(0, 0.16, 0); tube.rotation.z = -(Math.PI / 2 - ELEV); head.add(tube);
  const T = { parent: tube };
  cyl(R, LEN, gun, 0, 0, 0, { seg: 28, dirt: 0.2, ...T });
  cyl(R + 0.04, 0.3, gun, 0, 0, 0, { seg: 28, dirt: 0, ...T });                      // breech
  cyl(R + 0.035, 0.22, M.hazard, 0, LEN - 0.42, 0, { seg: 28, dirt: 0, ...T });       // scuffed hazard stripe at the muzzle
  cyl(R + 0.055, 0.14, gun, 0, LEN - 0.14, 0, { seg: 28, dirt: 0, ...T });            // muzzle ring
  cyl(R - 0.04, 0.02, M.dark, 0, LEN, 0, { seg: 20, dirt: 0, ...T });
  cyl(R + 0.06, 0.16, M.steel, 0, LEN * 0.55, 0, { seg: 24, dirt: 0, ...T });         // bipod collar
  // sight on the side of the collar
  box(0.14, 0.32, 0.16, armor, 0.05, LEN * 0.5, R + 0.14, { dirt: 0, ...T });
  hcyl(0.05, 0.22, M.dark, 0.05, LEN * 0.5 + 0.3, R + 0.14, { axis: 'z', ...T });
  // bipod: from the collar down to two feet ahead of the plate
  tube.updateMatrix(); head.updateMatrixWorld(true);
  const col = new THREE.Vector3(0, LEN * 0.55 + 0.08, 0).applyMatrix4(tube.matrix);
  for (const s of [-1, 1]) {
    const foot = [col.x + 0.15, 0.02, s * 0.62];
    beam([col.x, col.y, s * 0.12], foot, 0.07, 0.07, M.steel, H);
    box(0.18, 0.05, 0.18, gun, foot[0], 0, foot[2], { dirt: 0, ...H });
  }
  beam([col.x + 0.08, col.y * 0.42, -0.4], [col.x + 0.08, col.y * 0.42, 0.4], 0.05, 0.05, M.steel, H);   // traverse bar
  hcyl(0.03, 0.4, M.steel, col.x + 0.05, col.y - 0.1, 0.42, { axis: 'z', ...H });                       // traverse handwheel axle
  hoop(0.12, 0.02, M.steel, col.x + 0.05, col.y - 0.1, 0.64, H).rotation.x = Math.PI / 2;
  head.position.set(0, RING_Y, cz); head.scale.setScalar(1.32); head.rotation.y = -rot * (Math.PI * 2 / n);
  mark('muzzle', 0, LEN, 0, tube); mark('plate', 0, 0, 0, head);

  if (part === 'base') { head.visible = false; pointLight(TEAM, 3, 0, 1.0, cz + 2.4, 3); pointLight(AMBER, 3, -1.57, FLOOR + 2.0, cz - 1.55, 2.5); }
  else { base.visible = false; L.hidePad(); L.getRoot().traverse(o => { if (o.userData.decal) o.visible = false; }); }

  // ================================================================ power layer (base only; lights and electricity)
  if (part === 'base') {
    const P = power(L), nc = { dirt: 0, cast: false };
    const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;
    const pol = (a, r) => [Math.cos(a) * r, cz + Math.sin(a) * r];
    // the concrete blocks set in the bag ring: a team strip under the hazard top and a warm lamp on each outer face
    for (const b of BLOCKS) {
      const [x, z] = pol(b, 3.15), g = group(x, 0, z, -b + Math.PI / 2);
      box(1.05, 0.05, 0.04, P.glow, 0, 0.9, 0.545, { parent: g, ...nc });
      box(0.2, 0.12, 0.08, P.steelD, 0, 0.6, 0.56, { parent: g, dirt: 0 }); box(0.14, 0.06, 0.03, P.warm, 0, 0.62, 0.61, { parent: g, ...nc });
    }
    P.beacon(...(([x, z]) => [x, 1.33, z])(pol(BLOCKS[0], 3.15)), '#ffb347');
    // transformer at the back right, conduited into the back-right block
    const ux = 3.6, uz = -3.7;
    box(1.2, 0.03, 1.0, P.dark, ux, 0, uz, nc);
    for (const [w, d, x, z] of [[1.2, 0.08, ux, uz - 0.5], [1.2, 0.08, ux, uz + 0.5], [0.08, 1.0, ux - 0.6, uz], [0.08, 1.0, ux + 0.6, uz]]) box(w, 0.04, d, M.hazard, x, 0, z, nc);
    P.transformer(ux, uz, 0); ao(ux, uz, 1.0, 0.8, 0.35);
    { const [x, z] = pol(BLOCKS[2], 3.72); P.conduit([[ux - 0.45, 0.3, uz + 0.1], [x + 0.3, 0.3, uz + 0.1], [x, 0.3, z]], 0.05); }
    // junction box at the front right, conduited into the front-right block
    P.junction(3.6, 3.6, 0);
    { const [x, z] = pol(BLOCKS[0], 3.72); P.conduit([[3.6, 0.4, 3.38], [3.6, 0.3, 3.15], [3.6, 0.3, 1.8], [x, 0.3, z]], 0.05); }
    // pole floodlight at the back left, lighting the pit
    { const x = -3.75, z = -3.75, h = 2.2, ry = 0.75;
      cyl(0.04, h, P.steelD, x, 0, z, { seg: 10, dirt: 0.2 }); ao(x, z, 0.4, 0.4, 0.3);
      const g = group(x, h, z, ry), t = new THREE.Group(); t.rotation.x = 0.2; g.add(t);
      box(0.4, 0.25, 0.18, P.steel, 0, -0.125, 0.03, { parent: t, dirt: 0 }); box(0.34, 0.19, 0.03, P.white, 0, -0.095, 0.13, { parent: t, ...nc });
      pointLight('#fff1d6', 4 * NB, x + Math.sin(ry) * 1.6, h - 0.8, z + Math.cos(ry) * 1.6, 5); }
  }
}
