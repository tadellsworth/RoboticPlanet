// Depot: stacked shipping containers and crates under a gantry crane lifting a container; painted ground markings.
export default function (L) {
  const { box, cyl, beam, lamp, pointLight, ao, M, ACCENT } = L;
  const gun = M.paint('#50565c'), yel = M.paint('#b8952e'), off = M.paint('#c7c2b6');
  L.seed(71);
  const C = { red: '#7a3b2a', teal: '#3f6b6b', ochre: '#957636', grey: '#566170', olive: '#666b45' };
  const container = (x, y, z, col) => {
    box(2.7, 1.15, 1.15, M.ribbed(C[col]), x, y, z, { dirt: y > 0 ? 0.3 : 1 });
    for (const sx of [-1.28, 1.28]) for (const sz of [-0.51, 0.51]) box(0.15, 0.13, 0.15, M.dark, x + sx, y + 1.03, z + sz, { dirt: 0 });
    box(0.03, 1.0, 0.95, M.dark, x + 1.36, y + 0.07, z, { dirt: 0 });
  };

  // container stacks (back left)
  container(-2.8, 0, -3.1, 'red'); container(0.1, 0, -3.1, 'teal');
  container(-2.8, 1.15, -3.1, 'ochre'); container(0.1, 1.15, -3.1, 'grey'); container(-2.8, 2.3, -3.1, 'teal');
  container(-2.8, 0, -1.8, 'grey'); container(0.1, 0, -1.8, 'olive'); container(-2.8, 1.15, -1.8, 'red');
  ao(-1.35, -2.45, 5.8, 2.6, 0.55);
  container(-2.7, 0, 0.7, 'ochre'); ao(-2.7, 0.7, 2.7, 1.15, 0.45);

  // gantry crane on ground rails, lifting a container
  for (const x of [-4.55, 4.55]) {
    box(0.14, 0.08, 7.2, M.chrome, x, 0, -1.0, { dirt: 0, cast: false });
    for (const z of [-2.4, 0.0]) { box(0.38, 4.7, 0.38, yel, x, 0, z); box(0.5, 0.25, 0.6, M.dark, x, 0, z, { dirt: 0 }); }
    box(0.42, 0.45, 2.8, yel, x, 4.3, -1.2, { dirt: 0 });
    box(0.44, 0.16, 0.44, M.hazard, x, 0.4, -2.4, { dirt: 0 }); box(0.44, 0.16, 0.44, M.hazard, x, 0.4, 0.0, { dirt: 0 });
  }
  box(9.6, 0.65, 0.75, yel, 0, 4.7, -1.2, { dirt: 0 });
  box(9.6, 0.1, 0.06, M.hazard, 0, 4.85, -0.82, { dirt: 0 });
  const tx = 2.7, tz = -1.2;
  box(1.3, 0.65, 1.15, gun, tx, 5.35, tz);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]]) box(0.04, 1.6, 0.04, M.dark, tx + dx, 3.12, tz + dz, { dirt: 0 });
  box(2.5, 0.16, 0.95, yel, tx, 2.98, tz, { dirt: 0 });
  container(tx, 1.82, tz, 'teal');
  for (const [x, z] of [[tx - 1.5, tz - 0.7], [tx + 1.5, tz - 0.7], [tx - 1.5, tz + 0.7], [tx + 1.5, tz + 0.7]]) { box(0.1, 0.012, 0.1, M.plain('#c9a032'), x, 0, z, { dirt: 0, cast: false }); }
  box(3.0, 0.012, 0.12, M.hazard, tx, 0, tz - 0.7, { dirt: 0, cast: false }); box(3.0, 0.012, 0.12, M.hazard, tx, 0, tz + 0.7, { dirt: 0, cast: false });
  lamp(-4.55, 5.3, -1.2, ACCENT, { shape: 'sphere', size: 0.2, intensity: 4, dist: 4, k: 2.8 });
  lamp(4.55, 5.3, -1.2, ACCENT, { shape: 'sphere', size: 0.2, intensity: 4, dist: 4, k: 2.8 });
  lamp(tx, 6.05, tz, ACCENT, { shape: 'sphere', size: 0.15, intensity: 3, dist: 3, k: 2.8 });

  // crates and drums (front right)
  for (const [x, y, z] of [[1.6, 0, 2.5], [2.5, 0, 2.5], [3.4, 0, 2.5], [2.05, 0.85, 2.5], [2.95, 0.85, 2.5], [3.4, 0, 1.6]]) box(0.85, 0.85, 0.85, M.wood, x, y, z);
  ao(2.5, 2.3, 3.0, 1.6, 0.5);
  const drums = [M.paint('#4f6b78', { rivets: false }), M.paint('#8a4a2a', { rivets: false }), M.paint('#a08a3a', { rivets: false })];
  [[0.3, 2.9], [0.95, 3.3], [0.25, 3.65], [0.9, 2.55]].forEach(([x, z], i) => cyl(0.32, 0.95, drums[i % 3], x, 0, z, { seg: 20 }));
  ao(0.6, 3.1, 1.6, 1.6, 0.4);

  // lane line and a small yard office
  box(8.4, 0.012, 0.14, M.plain('#c9a032'), 0, 0, 1.55, { dirt: 0, cast: false });
  box(1.7, 1.7, 1.4, off, -3.4, 0, 3.0); box(1.85, 0.14, 1.55, gun, -3.4, 1.7, 3.0, { dirt: 0 }); ao(-3.4, 3.0, 1.7, 1.4, 0.45);
  box(1.0, 0.45, 0.05, M.emit('#ffe2a0', 1.3), -3.4, 0.95, 3.71, { cast: false });
}
