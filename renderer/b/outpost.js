// Outpost: armoured round bunker with glowing firing slits, watchtower with team band, sensor mast, radar dish, team beacon.
export default function (L) {
  const { box, cyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, ladder, M, THREE, TEAM } = L;
  const armor = M.paint('#4c5258'), steel = M.steel, off = M.paint('#c7c2b6'), team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.6);
  L.seed(91);
  const cz = -0.4;

  // footing and sloped armoured bunker (12 faces) with firing slits
  cyl(3.55, 0.3, M.concrete, 0, 0, cz, { seg: 12 }); ao(0, cz, 7.0, 7.0, 0.5);
  cyl(3.3, 1.7, armor, 0, 0.3, cz, { rTop: 2.9, seg: 12 });
  for (let k = 0; k < 12; k++) {
    const g = group(0, 0, cz, (k + 0.5) * Math.PI / 6);
    box(0.78, 0.17, 0.14, M.dark, 0, 1.15, 2.97, { parent: g, dirt: 0 });
    box(0.62, 0.05, 0.04, glow, 0, 1.21, 3.05, { parent: g, cast: false });
  }
  cyl(2.95, 0.12, steel, 0, 2.0, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; box(0.07, 0.75, 0.07, M.paint('#c49a2c', { rivets: false }), Math.cos(a) * 2.8, 2.12, cz + Math.sin(a) * 2.8, { dirt: 0 }); }
  hoop(2.8, 0.045, M.paint('#c49a2c', { rivets: false }), 0, 2.87, cz);

  // watchtower with team-colour band and crenellated cap
  cyl(1.6, 2.8, armor, 0, 2.12, cz, { seg: 12 });
  cyl(1.63, 0.42, team, 0, 3.9, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 6; k++) { const g = group(0, 0, cz, (k + 0.5) * Math.PI / 3); box(0.5, 0.14, 0.1, M.dark, 0, 3.15, 1.55, { parent: g, dirt: 0 }); box(0.4, 0.04, 0.04, glow, 0, 3.2, 1.6, { parent: g, cast: false }); }
  cyl(1.9, 0.32, steel, 0, 4.92, cz, { seg: 12, dirt: 0 });
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; box(0.42, 0.4, 0.3, armor, Math.cos(a) * 1.72, 5.24, cz + Math.sin(a) * 1.72, { ry: -a, dirt: 0 }); }

  // sensor mast, radar dish, antennas, team beacon
  box(0.3, 3.9, 0.3, steel, 0.2, 5.24, cz, { dirt: 0 });
  for (const y of [6.2, 7.4]) box(1.0, 0.08, 0.08, steel, 0.2, y, cz, { dirt: 0 });
  const dish = new THREE.SphereGeometry(0.95, 28, 10, 0, Math.PI * 2, 0, 0.85); dish.translate(0, -0.95, 0);
  const dm = mesh(dish, off, -0.1, 7.0, cz + 0.25, { rx: -1.05, dirt: 0 }); dm.material = off; dm.material.side = THREE.DoubleSide;
  beam([-0.1, 6.55, cz + 0.55], [-0.1, 6.95, cz + 1.2], 0.05, 0.05, steel);
  box(0.05, 1.0, 0.05, steel, 0.6, 7.4, cz, { dirt: 0 }); box(0.05, 0.7, 0.05, steel, -0.25, 7.4, cz, { dirt: 0 });
  cyl(0.24, 0.12, M.dark, 0.2, 9.14, cz, { dirt: 0 });
  sphere(0.3, M.emit(TEAM, 4), 0.2, 9.5, cz, { cast: false });
  pointLight(TEAM, 6, 0.2, 9.0, cz + 0.6, 4);

  // door and approach
  const dg = group(0, 0, cz, 0);
  box(1.0, 1.35, 0.25, M.dark, 0, 0.3, 3.08, { parent: dg, dirt: 0.4 });
  box(1.1, 0.07, 0.07, glow, 0, 1.75, 3.0, { parent: dg, cast: false });
  box(1.4, 0.1, 0.6, M.hazard, 0, 0, cz + 3.75, { dirt: 0 });
  ladder(1.6, 2.12, 4.92, cz + 0.2, { ry: Math.PI / 2 });

  // concrete barriers at the front corners
  for (const [x, z, r] of [[-3.6, 3.4, 0.5], [3.6, 3.4, -0.5]]) { box(1.4, 0.65, 0.45, M.concrete, x, 0, z, { ry: r }); box(1.42, 0.12, 0.47, M.hazard, x, 0.42, z, { ry: r, dirt: 0 }); }
}
