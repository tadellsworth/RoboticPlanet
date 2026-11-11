// Depot, POWERED proposal (depot_p): the realistic container yard from depot.js (stacked shipping containers, a
// gantry crane on ground rails lifting a container, crates, drums, a yard office) with a lights-and-electricity layer
// from b/powerkit.js: team-colour light strips along the crane girder and legs, a lit operator cab, floodlights on the
// girder ends lighting the yard, amber crane beacons, a festoon power cable under the girder, indicator lights on the
// spreader and status lights on the containers, a small transformer and junction box feeding a ground conduit along
// the rail, and a lit yard office. Team-coloured lights: render one image per team (the team field of the job).
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, lamp, pointLight, ao, mesh, M, THREE } = L;
  const P = power(L), nc = { dirt: 0, cast: false };
  const gun = M.paint('#50565c'), yel = M.paint('#b8952e'), off = M.paint('#c7c2b6');
  L.seed(71);
  const C = { red: '#7a3b2a', teal: '#3f6b6b', ochre: '#957636', grey: '#566170', olive: '#666b45' };
  const status = [P.green, P.amber, P.glow];
  let si = 0;
  const container = (x, y, z, col, lit = true) => {
    box(2.7, 1.15, 1.15, M.ribbed(C[col]), x, y, z, { dirt: y > 0 ? 0.3 : 1 });
    for (const sx of [-1.28, 1.28]) for (const sz of [-0.51, 0.51]) box(0.15, 0.13, 0.15, M.dark, x + sx, y + 1.03, z + sz, { dirt: 0 });
    box(0.03, 1.0, 0.95, M.dark, x + 1.36, y + 0.07, z, { dirt: 0 });
    if (lit) { box(0.07, 0.07, 0.03, status[si++ % 3], x + 1.12, y + 0.92, z + 0.585, nc); }   // e-seal status light
  };

  // container stacks (back left)
  container(-2.8, 0, -3.1, 'red', false); container(0.1, 0, -3.1, 'teal', false);
  container(-2.8, 1.15, -3.1, 'ochre', false); container(0.1, 1.15, -3.1, 'grey', false); container(-2.8, 2.3, -3.1, 'teal', false);
  container(-2.8, 0, -1.8, 'grey'); container(0.1, 0, -1.8, 'olive'); container(-2.8, 1.15, -1.8, 'red');
  ao(-1.35, -2.45, 5.8, 2.6, 0.55);
  container(-2.7, 0, 0.7, 'ochre'); ao(-2.7, 0.7, 2.7, 1.15, 0.45);
  // a reefer unit on the front container: grille and a lit display
  box(0.7, 0.8, 0.06, M.grille(), -3.6, 0.15, 1.3, { dirt: 0.4 }); box(0.22, 0.12, 0.03, P.green, -3.6, 0.82, 1.34, nc);

  // gantry crane on ground rails, lifting a container
  for (const x of [-4.55, 4.55]) {
    box(0.14, 0.08, 7.2, M.chrome, x, 0, -1.0, { dirt: 0, cast: false });
    for (const z of [-2.4, 0.0]) {
      box(0.38, 4.7, 0.38, yel, x, 0, z); box(0.5, 0.25, 0.6, M.dark, x, 0, z, { dirt: 0 });
      box(0.06, 3.7, 0.06, P.glow, x - Math.sign(x) * 0.13, 0.62, z + 0.2, nc);              // team strip up the leg's inner front edge
    }
    box(0.42, 0.45, 2.8, yel, x, 4.3, -1.2, { dirt: 0 });
    P.strip(2.7, x - Math.sign(x) * 0.22, 4.33, -1.2, Math.PI / 2);                           // under the sill beam
    box(0.44, 0.16, 0.44, M.hazard, x, 0.4, -2.4, { dirt: 0 }); box(0.44, 0.16, 0.44, M.hazard, x, 0.4, 0.0, { dirt: 0 });
  }
  box(9.6, 0.65, 0.75, yel, 0, 4.7, -1.2, { dirt: 0 });
  box(9.6, 0.1, 0.06, M.hazard, 0, 4.85, -0.82, { dirt: 0 });
  // team light strips along the girder: top front and back edges, underside front edge
  P.strip(9.5, 0, 5.33, -0.81, 0, 0.07); P.strip(9.5, 0, 5.33, -1.59, 0, 0.07); P.strip(9.5, 0, 4.66, -0.81, 0, 0.07);
  // trolley with a lit operator cab
  const tx = 2.7, tz = -1.2;
  box(1.3, 0.65, 1.15, gun, tx, 5.35, tz);
  box(1.36, 0.06, 1.2, P.steelD, tx, 6.0, tz, { dirt: 0 });
  P.windows(1.05, 0.24, tx, 5.58, tz + 0.6, 0, 3);
  P.strip(1.3, tx, 5.37, tz + 0.6, 0, 0.05);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]]) box(0.04, 1.6, 0.04, M.dark, tx + dx, 3.12, tz + dz, { dirt: 0 });
  box(2.5, 0.16, 0.95, yel, tx, 2.98, tz, { dirt: 0 });
  P.strip(2.3, tx, 3.06, tz + 0.49, 0, 0.05);                                                   // team strip along the spreader
  for (const sx of [-1.18, 1.18]) for (const sz of [-0.42, 0.42]) box(0.08, 0.08, 0.08, sz > 0 ? P.green : P.amber, tx + sx, 3.14, tz + sz, nc); // twistlock indicators
  container(tx, 1.82, tz, 'teal', false);
  pointLight('#fff1d6', 3, tx, 2.7, tz + 0.9, 3.5);                                                 // work light under the trolley
  for (const [x, z] of [[tx - 1.5, tz - 0.7], [tx + 1.5, tz - 0.7], [tx - 1.5, tz + 0.7], [tx + 1.5, tz + 0.7]]) { box(0.1, 0.012, 0.1, M.plain('#c9a032'), x, 0, z, { dirt: 0, cast: false }); }
  box(3.0, 0.012, 0.12, M.hazard, tx, 0, tz - 0.7, { dirt: 0, cast: false }); box(3.0, 0.012, 0.12, M.hazard, tx, 0, tz + 0.7, { dirt: 0, cast: false });
  // festoon power cable hanging in loops under the girder, from the left end to the trolley
  for (let k = 0; k < 5; k++) {
    const x0 = -4.2 + k * 1.3, x1 = Math.min(x0 + 1.3, tx - 0.5);
    if (x1 > x0) { P.cable([x0, 4.66, -0.74], [x1, 4.66, -0.74], 0.32, 6); box(0.06, 0.08, 0.1, P.steelD, x1, 4.6, -0.74, nc); }
  }
  // floodlights on the girder ends, lighting the yard; amber beacons on the leg tops; team beacon on the trolley
  for (const s of [-1, 1]) {
    const x = s * 3.9, g = new THREE.Group(); g.position.set(x, 5.4, -1.05); g.rotation.x = 0.18; g.rotation.y = -s * 0.3; L.getRoot().add(g);
    box(0.44, 0.26, 0.2, P.steel, 0, 0, 0, { dirt: 0, parent: g }); box(0.36, 0.18, 0.03, P.white, 0, 0.04, 0.1, { ...nc, parent: g });
    box(0.1, 0.06, 0.1, P.steelD, x, 5.35, -1.1, { dirt: 0 });
    pointLight('#fff1d6', 5, x - s * 0.8, 3.6, 0.7, 6.5);
    P.beacon(s * 4.55, 5.42, -1.2, '#ffb347');
  }
  P.beacon(tx, 6.12, tz);

  // power: a small transformer and junction box at the front right, a conduit along the right rail to the crane
  P.transformer(3.85, 3.85, 0);
  P.junction(2.85, 3.95, 0);
  P.conduit([[3.35, 0.15, 3.85], [3.05, 0.15, 3.85]], 0.05);
  P.conduit([[4.32, 0.15, 3.85], [4.3, 0.15, 3.3], [4.3, 0.15, 0.35], [4.3, 0.15, 0.25], [4.3, 1.1, 0.22]], 0.06);
  box(0.24, 0.4, 0.18, P.steel, 4.3, 1.0, 0.22, { dirt: 0.3 }); box(0.1, 0.06, 0.03, P.green, 4.3, 1.25, 0.32, nc);
  // a ground conduit from the junction box along the front of the yard to the office
  P.conduit([[2.55, 0.12, 4.12], [-2.5, 0.12, 4.12], [-2.5, 0.12, 3.7]], 0.05);

  // crates and drums (front right)
  for (const [x, y, z] of [[1.6, 0, 2.5], [2.5, 0, 2.5], [3.4, 0, 2.5], [2.05, 0.85, 2.5], [2.95, 0.85, 2.5], [3.4, 0, 1.6]]) box(0.85, 0.85, 0.85, M.wood, x, y, z);
  ao(2.5, 2.3, 3.0, 1.6, 0.5);
  const drums = [M.paint('#4f6b78', { rivets: false }), M.paint('#8a4a2a', { rivets: false }), M.paint('#a08a3a', { rivets: false })];
  [[0.3, 2.9], [0.95, 3.3], [0.25, 3.65], [0.9, 2.55]].forEach(([x, z], i) => cyl(0.32, 0.95, drums[i % 3], x, 0, z, { seg: 20 }));
  ao(0.6, 3.1, 1.6, 1.6, 0.4);

  // lane line and the yard office: lit window, team strip on the fascia, a light over the door, a beacon
  box(8.4, 0.012, 0.14, M.plain('#c9a032'), 0, 0, 1.55, { dirt: 0, cast: false });
  box(1.7, 1.7, 1.4, off, -3.4, 0, 3.0); box(1.85, 0.14, 1.55, gun, -3.4, 1.7, 3.0, { dirt: 0 }); ao(-3.4, 3.0, 1.7, 1.4, 0.45);
  P.strip(1.85, -3.4, 1.74, 3.79, 0, 0.06);
  P.windows(1.1, 0.42, -3.6, 0.85, 3.72, 0, 2);
  box(0.36, 0.9, 0.04, P.steelD, -2.85, 0, 3.71, { dirt: 0.3 }); box(0.2, 0.06, 0.05, P.white, -2.85, 1.0, 3.73, nc);
  box(0.5, 0.3, 0.4, P.steel, -3.85, 1.84, 2.75, { dirt: 0.3 });                              // rooftop AC unit
  P.beacon(-2.75, 1.95, 2.5);
}
