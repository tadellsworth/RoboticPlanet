// Drop Outpost: a small fortified pod that comes down by parachute. An eight-sided armoured module with firing
// slits on four splayed landing legs (their crush pads dug into the ground), a short sensor mast with the team
// beacon, two supply crates (one opened), a black fuel bladder feeding a two-cable charging post, a ring of
// sandbags round the front, and its spent parachute heaped beside it with the shroud lines trailing.
// POWERED (powered realism): a lights-and-electricity layer from b/powerkit.js: team light strips round the pod's top
// edge and along the landing legs, marker lights on the crush pads, two floodlights on the roof, a lamp over the door,
// a junction box at the pod's foot feeding the charging post by cable, a compact transformer with arcing insulators
// behind the pod cabled up to the roof, amber beacons on the mast. No pad, as before: it lands anywhere.
import { power } from './powerkit.js';
export const config = { pad: false };
export default function (L) {
  const { box, cyl, mesh, sphere, lamp, pointLight, ao, group, beam, M, THREE, TEAM } = L;
  L.seed(1307);
  const armor = M.paint('#525a50'), armorD = M.paint('#41473f', { rivets: false }), steel = M.steel;
  const team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.6), dark = M.dark;
  const crate = M.paint('#7a6a48', { rivets: false }), sand = M.rough('#9b8a68'), canvas = M.paint('#c9c2a8', { rivets: false });
  const cz = -0.3;

  // ---- the ground churned where it came down, and the pod's footing
  ao(0, cz, 6.4, 6.0, 0.45);
  cyl(2.6, 0.08, M.rough('#7d7466'), 0, 0, cz, { seg: 24, dirt: 0.4 });
  // landing legs, splayed out to crush pads
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a), z = Math.sin(a);
    beam([x * 1.2, 1.1, cz + z * 1.2], [x * 2.25, 0.12, cz + z * 2.25], 0.18, 0.18, steel);
    cyl(0.32, 0.12, armorD, x * 2.3, 0, cz + z * 2.3, { seg: 16 });
  }
  // ---- the pod: eight armoured faces, firing slits, a team band, a hatch on top
  cyl(1.75, 1.7, armor, 0, 0.35, cz, { rTop: 1.5, seg: 8 });
  cyl(1.78, 0.28, team, 0, 1.05, cz, { seg: 8, rTop: 1.74, dirt: 0 });
  for (let k = 0; k < 8; k++) {
    const g = group(0, 0, cz, (k + 0.5) * Math.PI / 4);
    box(0.55, 0.13, 0.1, dark, 0, 1.55, 1.56, { parent: g, dirt: 0 });
    box(0.45, 0.04, 0.04, glow, 0, 1.6, 1.6, { parent: g, cast: false });
  }
  cyl(1.5, 0.18, armorD, 0, 2.05, cz, { rTop: 1.2, seg: 8, dirt: 0.2 });
  cyl(0.55, 0.14, steel, 0, 2.23, cz, { seg: 16, dirt: 0 });
  box(0.9, 0.9, 0.12, dark, 0, 0.35, cz + 1.6, { dirt: 0.3 });       // the door
  box(1.0, 0.06, 0.06, glow, 0, 1.28, cz + 1.66, { cast: false });
  // ---- sensor mast and the team beacon
  box(0.14, 1.8, 0.14, steel, 0.6, 2.2, cz - 0.4, { dirt: 0 });
  for (const y of [3.0, 3.6]) box(0.6, 0.06, 0.06, steel, 0.6, y, cz - 0.4, { dirt: 0 });
  box(0.04, 0.8, 0.04, steel, 0.2, 2.25, cz + 0.4, { dirt: 0 });
  sphere(0.2, M.emit(TEAM, 4), 0.6, 4.1, cz - 0.4, { cast: false });
  pointLight(TEAM, 5, 0.6, 3.7, cz + 0.2, 3.5);

  // ---- supply crates, one open, at the front right; the fuel bladder and charging post at the front left
  box(1.0, 0.75, 0.75, crate, 2.4, 0, 1.6, { ry: 0.2, dirt: 0.5 });
  box(0.9, 0.5, 0.7, crate, 2.0, 0, 2.6, { ry: -0.3, dirt: 0.5 });
  box(0.92, 0.05, 0.72, crate, 2.6, 0.75, 2.4, { ry: 0.7, dirt: 0.3 });         // its lid, propped aside
  box(0.72, 0.08, 0.5, M.paint('#4a6a8a', { rivets: false }), 2.0, 0.5, 2.6, { ry: -0.3, dirt: 0 }); // goods inside
  { const g = new THREE.SphereGeometry(0.9, 24, 12); g.scale(1.3, 0.38, 0.85); mesh(g, M.plain('#1c1d1f', 0.75), -2.3, 0.3, 1.9, { dirt: 0.2 }); }
  box(0.3, 1.2, 0.3, M.paint('#d6d2c4', { rivets: false }), -1.2, 0, 2.55, { dirt: 0.3 });
  box(0.32, 0.12, 0.32, glow, -1.2, 1.2, 2.55, { cast: false });
  for (const s of [-1, 1]) beam([-1.2, 0.6, 2.55], [-1.2 + s * 0.6, 0.05, 2.95], 0.05, 0.05, dark);
  beam([-1.5, 0.12, 2.3], [-1.9, 0.12, 2.0], 0.08, 0.08, dark);                  // the hose from the bladder

  // ---- sandbags in a broken ring round the front
  for (let k = 0; k < 9; k++) {
    const a = 0.45 + k * 0.27, r = 3.3;
    if (k === 4) continue; // the gap in front of the door
    const g = new THREE.CapsuleGeometry(0.17, 0.42, 4, 10); g.rotateZ(Math.PI / 2);
    for (const y of [0.16, 0.42]) mesh(g.clone(), sand, Math.cos(a) * r, y, cz + Math.sin(a) * r, { ry: -a + Math.PI / 2, dirt: 0.4 });
  }

  // ---- the spent parachute, heaped at the back left, shroud lines trailing to the pod
  { const g = new THREE.SphereGeometry(1.0, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, p.getY(i) * (0.28 + 0.12 * Math.sin(x * 5) * Math.cos(z * 4))); }
    g.computeVertexNormals(); g.scale(1.6, 1, 1.1);
    mesh(g, canvas, -2.4, 0.02, -2.2, { dirt: 0.2 });
    const g2 = g.clone(); g2.scale(0.55, 0.9, 0.55); mesh(g2, team, -1.9, 0.12, -2.0, { dirt: 0.1 }); }
  for (const o of [-0.3, 0, 0.3]) beam([-1.3, 0.05, -1.9 + o], [-0.9, 0.5, cz - 1.0 + o * 0.5], 0.025, 0.025, M.paint('#bdb7a2', { rivets: false }));
  void lamp;

  // ================================================================ power layer (lights and electricity)
  // (made after everything else, so the original parts keep their random texture offsets)
  const P = power(L), nc = { dirt: 0, cast: false };
  const NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.6 : 1;      // real lamps carry further after dark
  const at = (r, deg, y) => [Math.sin(deg * Math.PI / 180) * r, y, cz + Math.cos(deg * Math.PI / 180) * r];   // polar point round the pod
  // team strips along the eight top edges of the armoured body
  for (let k = 0; k < 8; k++) { const g = group(0, 0, cz, (k + 0.5) * Math.PI / 4); box(1.1, 0.05, 0.05, P.glow, 0, 2.0, 1.41, { parent: g, ...nc }); }
  // team strips along the top of each landing leg, white marker lights on the crush pads
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a), z = Math.sin(a);
    beam([x * 1.35, 1.06, cz + z * 1.35], [x * 2.22, 0.24, cz + z * 2.22], 0.04, 0.04, P.glow, nc);
    box(0.1, 0.05, 0.1, P.white, x * 2.3, 0.12, cz + z * 2.3, nc);
  }
  // two floodlights on the roof, aimed out over the front quarters
  for (const d of [-40, 40]) {
    const [x, , z] = at(1.05, d, 0), ry = d * Math.PI / 180;
    cyl(0.035, 0.45, P.steelD, x, 2.23, z, { seg: 8, dirt: 0 });
    const g = group(x, 2.68, z, ry), t = new THREE.Group(); t.rotation.x = 0.3; g.add(t);
    box(0.3, 0.2, 0.14, P.steel, 0, -0.1, 0.03, { parent: t, dirt: 0 }); box(0.25, 0.15, 0.03, P.white, 0, -0.075, 0.11, { parent: t, ...nc });
    pointLight('#fff1d6', 3.5 * NB, x + Math.sin(ry) * 1.8, 1.0, z + Math.cos(ry) * 1.8, 4.5);
  }
  // a warm lamp over the door
  box(0.22, 0.1, 0.12, P.steelD, 0, 1.36, cz + 1.68, { dirt: 0 }); box(0.16, 0.05, 0.03, P.warm, 0, 1.38, cz + 1.75, nc);
  pointLight('#ffd9a0', 2.2 * NB, 0, 0.8, cz + 2.4, 2.5);
  // junction box at the pod's foot (left), conduit into the hull, a cable over to the charging post
  const jd = -78, jr = 2.15, [jx, , jz] = at(jr, jd, 0);
  P.junction(jx, jz, jd * Math.PI / 180);
  P.conduit([at(jr - 0.22, jd, 0.45), at(1.68, jd, 0.45), at(1.68, jd, 0.62)], 0.045);
  P.cable([jx + 0.05, 0.7, jz + 0.1], [-1.2, 1.15, 2.4], 0.2);
  // compact transformer beside the pod on the right, between the legs, cabled up to the roof
  const td = 98, [yx, , yz] = at(2.42, td, 0), tr = td * Math.PI / 180 - Math.PI / 2;
  box(1.05, 0.03, 0.85, P.dark, yx, 0, yz, { dirt: 0, cast: false, ry: tr });
  P.transformer(yx, yz, tr);
  { const [cx2, , cz2] = at(2.42 - 0.0, td - 7, 0); P.cable([cx2, 1.17, cz2], at(1.3, td - 15, 2.12), 0.18); }
  // amber beacons on the ends of the mast's upper cross-bar
  for (const s of [-1, 1]) P.beacon(0.6 + s * 0.3, 3.7, cz - 0.4, '#ffb347');
}
