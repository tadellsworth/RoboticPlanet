// Flak Gun, rendered in layers on the shared pad framing (same scheme as the Pulse Turret and Mortar Pit).
//   ?part=base            the emplacement: an eight-sided concrete gun pit with a sandbag parapet, ready racks of
//                         shell clips, a fire-control post with a stereo rangefinder and a small radar, the team band
//                         and beacon, and an EMPTY turntable
//   ?part=head&rot=k&n=N  the gun alone: a twin-barrelled anti-aircraft mount, its long barrels raised steeply,
//                         turned to direction k of N (0 = right, then clockwise seen from above). No team colour on
//                         the head. Camera and light never move; the turntable centre never moves.
import { bagArc } from './milkit.js';

export default function (L) {
  const { box, cyl, hcyl, beam, hoop, pointLight, ao, mesh, sphere, group, mark, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), part = p.get('part') || 'base', rot = +(p.get('rot') || 0), n = +(p.get('n') || 8);
  L.seed(733);
  const armor = M.paint('#4f5559'), gun = M.paint('#525a50', { rivets: false, metal: 0.45, rough: 0.5 }), olive = M.paint('#5d6247');
  const team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 3);
  const bag = M.rough('#9a8763'), steelD = M.paint('#3c4146', { rivets: false });
  const brass = new THREE.MeshStandardMaterial({ color: '#c49a4a', roughness: 0.32, metalness: 0.9, vertexColors: true });
  const cz = -0.1, FLOOR = 0.14, TT = 0.18, RING_Y = FLOOR + TT;

  // ---- base layer
  const base = group(0, 0, 0, 0);
  const B = { parent: base };
  cyl(3.6, 0.14, M.concrete, 0, 0, cz, { seg: 8, ry: Math.PI / 8, ...B }); ao(0, cz, 7.0, 7.0, 0.5);
  const wallM = M.concrete.clone(); wallM.side = THREE.DoubleSide;
  cyl(2.7, 0.55, wallM, 0, FLOOR, cz, { seg: 8, ry: Math.PI / 8, open: true, ...B });
  cyl(2.72, 0.16, team, 0, FLOOR + 0.55, cz, { seg: 8, ry: Math.PI / 8, open: true, dirt: 0, ...B });     // team band round the pit
  // turntable with its hazard ring
  const ring = new THREE.RingGeometry(1.15, 1.4, 48); ring.rotateX(-Math.PI / 2);
  mesh(ring, M.hazard, 0, FLOOR + 0.006, cz, { dirt: 0, cast: false, ...B });
  cyl(1.12, TT, M.steel, 0, FLOOR, cz, { seg: 48, dirt: 0, ...B });
  cyl(0.85, 0.012, M.dark, 0, RING_Y, cz, { seg: 48, dirt: 0, cast: false, ...B });
  for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; cyl(0.045, 0.04, M.chrome, Math.cos(a) * 1.0, RING_Y, cz + Math.sin(a) * 1.0, { seg: 8, dirt: 0, ...B }); }
  // sandbag parapet with a gap at the back right for the crew
  bagArc(L, 0, cz, 3.15, 0, Math.PI * 2, 3, { lean: 0.05, mat: bag, parent: base, skip: (a) => { const t = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); return t > Math.PI * 1.55 && t < Math.PI * 1.78; } });
  // ready racks of shell clips at the front left and front right
  for (const [x, z, r] of [[-2.0, 1.4, 0.6], [2.0, 1.4, -0.6]]) {
    box(1.0, 0.5, 0.42, olive, x, FLOOR, cz + z, { ry: r, dirt: 0.4, ...B });
    for (let k = 0; k < 4; k++) hcyl(0.06, 0.5, brass, x + (k - 1.5) * 0.2 * Math.cos(r), FLOOR + 0.58, cz + z - (k - 1.5) * 0.2 * Math.sin(r), { axis: 'z', ...B });
  }
  // the fire-control post at the back left: a stereo rangefinder on a post and a small radar dish
  const fx = -2.1, fz = cz - 1.5;
  box(0.8, 0.9, 0.8, armor, fx, FLOOR, fz, { dirt: 0.4, ...B });
  cyl(0.08, 0.8, M.steel, fx, FLOOR + 0.9, fz, { seg: 10, ...B });
  hcyl(0.1, 1.5, steelD, fx, FLOOR + 1.75, fz, { ...B });
  for (const s of [-1, 1]) sphere(0.13, steelD, fx + s * 0.75, FLOOR + 1.75, fz, { ...B });
  const dish = new THREE.SphereGeometry(0.55, 24, 8, 0, Math.PI * 2, 0, 0.9); dish.translate(0, -0.55, 0);
  const dm = mesh(dish, M.paint('#c9c5ba', { rivets: false }), fx + 0.9, FLOOR + 1.5, fz + 0.4, { rx: -0.9, ry: 0.6, dirt: 0, ...B }); dm.material.side = THREE.DoubleSide;
  cyl(0.05, 0.6, M.steel, fx + 0.9, FLOOR + 0.9, fz + 0.4, { seg: 8, ...B });
  // the team beacon on a short mast at the back right
  cyl(0.05, 2.0, M.steel, 2.2, FLOOR, cz - 1.6, { seg: 10, ...B });
  sphere(0.16, glow, 2.2, FLOOR + 2.05, cz - 1.6, { cast: false, ...B });

  // ---- head layer: the twin mount, built at the origin facing +x, then put on the turntable
  const head = group(0, 0, 0, 0);
  const H = { parent: head };
  cyl(0.95, 0.16, gun, 0, 0, 0, { seg: 32, dirt: 0.3, ...H });                              // traversing base
  box(1.3, 0.55, 1.15, gun, -0.1, 0.16, 0, { dirt: 0.2, ...H });                             // carriage
  for (const s of [-1, 1]) box(1.1, 0.95, 0.12, armor, -0.05, 0.3, s * 0.62, { dirt: 0.2, ...H }); // side cheeks the barrels pivot in
  // gun shield across the front, angled back
  { const g = new THREE.BoxGeometry(0.1, 1.0, 1.6); g.translate(0, 0.5, 0); const m = mesh(g, armor, 0.62, 0.3, 0, { dirt: 0.25, ...H }); m.rotation.z = 0.35; }
  // the barrels: raised 48 degrees, each a long tube with a recoil jacket and a flash hider
  const ELEV = 48 * Math.PI / 180, LEN = 2.6;
  const cradle = new THREE.Group(); cradle.position.set(0.05, 0.95, 0); cradle.rotation.z = ELEV; head.add(cradle);
  const C = { parent: cradle };
  box(0.9, 0.36, 0.9, gun, -0.1, -0.18, 0, { dirt: 0.2, ...C });                               // breech block
  for (const s of [-0.24, 0.24]) {
    hcyl(0.13, 1.1, steelD, 0.45, 0, s, { ...C });                                               // recoil jacket
    hcyl(0.07, LEN, gun, 0.45 + LEN / 2, 0, s, { ...C });                                        // barrel
    hcyl(0.1, 0.3, steelD, 0.45 + LEN - 0.05, 0, s, { ...C });                                  // flash hider
    hcyl(0.05, 0.02, M.dark, 0.45 + LEN + 0.11, 0, s, { ...C });
    // a clip of shells standing in the loader on top
    for (let k = 0; k < 4; k++) { const sh = hcyl(0.05, 0.4, brass, -0.45 + k * 0.02, 0.32, s, { ...C }); sh.rotation.z = Math.PI / 2; sh.position.x = -0.35; sh.position.y = 0.2 + k * 0.0; sh.position.z = s + (k - 1.5) * 0.06; }
  }
  // gunners' seats and sights on both sides
  for (const s of [-1, 1]) {
    box(0.4, 0.08, 0.35, steelD, -0.5, 0.75, s * 0.95, { dirt: 0, ...H });
    box(0.06, 0.45, 0.06, M.steel, -0.5, 0.3, s * 0.95, { dirt: 0, ...H });
    hcyl(0.05, 0.3, M.dark, -0.15, 1.15, s * 0.8, { ...H });
  }
  head.position.set(0, RING_Y, cz); head.scale.setScalar(1.2); head.rotation.y = -rot * (Math.PI * 2 / n);
  mark('muzzle', 0.45 + LEN + 0.1, 0, 0, cradle); mark('plate', 0, 0, 0, head);

  if (part === 'base') { head.visible = false; pointLight(TEAM, 3, 0, 1.0, cz + 2.4, 3); pointLight('#ffb347', 2.5, fx, FLOOR + 2.0, fz + 0.6, 2.5); }
  else { base.visible = false; L.hidePad(); L.getRoot().traverse(o => { if (o.userData.decal) o.visible = false; }); }
  void hoop; void beam;
}
