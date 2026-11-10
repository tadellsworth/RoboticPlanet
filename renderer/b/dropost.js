// Drop Outpost: a small fortified pod that comes down by parachute. An eight-sided armoured module with firing
// slits on four splayed landing legs (their crush pads dug into the ground), a short sensor mast with the team
// beacon, two supply crates (one opened), a black fuel bladder feeding a two-cable charging post, a ring of
// sandbags round the front, and its spent parachute heaped beside it with the shroud lines trailing.
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
}
