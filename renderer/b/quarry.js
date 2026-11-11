// Quarry: heavy jaw crusher with a hydraulic hammer on a gantry, conveyor to a gravel pile, pallets of cut stone.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips along the gantry girder and
// legs and round the funnel rim, a lit operator window, floodlights under the girder, a transformer yard feeding the
// crusher by conduit and the gantry by cable, beacons). Its lights are team-coloured: render one image per team. Base
// render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, beam, pipe, lamp, pointLight, ao, mesh, sphere, rnd, M, THREE, ACCENT, ladder } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), yel = M.paint('#b8952e'), stone = M.rough('#c9bca3'), rock = M.rough('#8f8a82');
  L.seed(21);

  // crusher body with square funnel
  const cx = -1.9, cz = -1.6;
  box(3.2, 3.0, 3.0, gun, cx, 0, cz); ao(cx, cz, 3.2, 3.0);
  box(3.2, 0.16, 0.06, M.hazard, cx, 0.4, cz + 1.51, { dirt: 0 });
  box(1.6, 0.9, 0.08, M.grille(), cx, 1.2, cz + 1.52, { dirt: 0.3 });
  cyl(2.15, 1.1, warm, cx, 3.0, cz, { rTop: 2.95, seg: 4, ry: Math.PI / 4, dirt: 0 });
  box(3.4, 0.04, 3.4, M.dark, cx, 4.1, cz, { dirt: 0, cast: false });
  for (let i = 0; i < 18; i++) {
    const geo = new THREE.DodecahedronGeometry(0.22 + rnd() * 0.2, 0);
    mesh(geo, rock, cx + (rnd() - 0.5) * 2.6, 4.12 + rnd() * 0.1, cz + (rnd() - 0.5) * 2.6, { rx: rnd() * 3, ry: rnd() * 3, dirt: 0 });
  }

  // gantry with the hydraulic hammer
  const GH = 6.6;
  box(0.55, GH, 0.6, yel, cx - 2.35, 0, cz); box(0.55, GH, 0.6, yel, cx + 2.35, 0, cz);
  box(0.65, 0.2, 0.65, M.hazard, cx - 2.35, 0.25, cz, { dirt: 0 }); box(0.65, 0.2, 0.65, M.hazard, cx + 2.35, 0.25, cz, { dirt: 0 });
  box(5.4, 0.7, 0.8, yel, cx, GH, cz);
  box(1.1, 0.9, 1.1, warm, cx, GH - 0.9, cz);
  L.cyl(0.22, 0.8, M.chrome, cx, GH - 1.7, cz, { dirt: 0 });
  box(1.3, 1.0, 1.3, M.steel, cx, GH - 2.7, cz, { dirt: 0 });
  box(1.34, 0.24, 1.34, M.hazard, cx, GH - 2.0, cz, { dirt: 0 });
  ladder(cx + 2.35, 0, GH, cz + 0.45);
  lamp(cx - 2.35, GH + 0.75, cz, ACCENT, { shape: 'sphere', size: 0.2, intensity: 4, dist: 4, k: 2.5 });
  lamp(cx + 2.35, GH + 0.75, cz, ACCENT, { shape: 'sphere', size: 0.2, intensity: 4, dist: 4, k: 2.5 });
  cyl(0.17, 0.1, M.dark, cx - 2.35, GH + 0.7, cz); cyl(0.17, 0.1, M.dark, cx + 2.35, GH + 0.7, cz);

  // inclined conveyor to a gravel pile (right)
  beam([-0.2, 1.0, -0.3], [3.3, 2.6, -0.3], 0.8, 0.12, M.dark);
  beam([-0.2, 1.1, 0.12], [3.3, 2.7, 0.12], 0.1, 0.14, yel); beam([-0.2, 1.1, -0.72], [3.3, 2.7, -0.72], 0.1, 0.14, yel);
  for (const t of [0.35, 0.8]) { const x = -0.2 + 3.5 * t, h = 1.0 + 1.6 * t; box(0.1, h, 0.1, M.steel, x, 0, 0.12); box(0.1, h, 0.1, M.steel, x, 0, -0.72); }
  for (let i = 0; i < 6; i++) { const t = 0.1 + i * 0.15; mesh(new THREE.DodecahedronGeometry(0.11, 0), rock, -0.2 + 3.5 * t, 1.12 + 1.6 * t, -0.3 + (rnd() - 0.5) * 0.3, { dirt: 0 }); }
  const pile = new THREE.ConeGeometry(1.35, 1.5, 28, 1); pile.translate(0, 0.75, 0);
  mesh(pile, rock, 3.6, 0, -0.5, { dirt: 0 }); ao(3.6, -0.5, 2.4, 2.4, 0.5);
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.28, h = rnd() * 1.3, r = 1.35 * (1 - h / 1.5) + 0.02; mesh(new THREE.DodecahedronGeometry(0.1 + rnd() * 0.12, 0), rock, 3.6 + Math.cos(a) * r, h, -0.5 + Math.sin(a) * r, { rx: rnd() * 3, dirt: 0 }); }

  // pallets of cut stone blocks (front)
  for (const [px, pz] of [[-2.6, 2.6], [0.6, 2.9]]) {
    box(2.1, 0.16, 1.5, M.wood, px, 0, pz); ao(px, pz, 2.1, 1.5, 0.5);
    for (const [i, j] of [[-0.5, -0.36], [0.5, -0.36], [-0.5, 0.36], [0.5, 0.36]]) box(0.95, 0.62, 0.68, stone, px + i, 0.16, pz + j, { dirt: 0.3 });
    for (const i of [-0.5, 0.5]) box(0.95, 0.62, 0.68, stone, px + i, 0.78, pz, { dirt: 0.2 });
  }
  box(0.95, 0.62, 0.68, stone, 2.9, 0, 2.6, { dirt: 0.3, ry: 0.4 });

  // small control cab on the crusher side with an amber window
  box(1.4, 1.5, 1.3, warm, 0.3, 0, -3.4); box(1.5, 0.12, 1.4, gun, 0.3, 1.5, -3.4, { dirt: 0 });
  box(0.9, 0.4, 0.05, M.emit('#ffd28a', 1.2), 0.3, 0.8, -2.73, { cast: false });
  pointLight(ACCENT, 6, cx, 2.0, cz + 2.2, 4);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: the gantry girder's top and bottom front edges, up the legs' inner front edges, round the
    // crusher funnel's rim, under its front edge, and the cab's eave
    K.strip(5.4, cx, GH + 0.67, cz + 0.42, 0, 0.07); K.strip(5.4, cx, GH + 0.03, cz + 0.42, 0, 0.07);
    for (const s of [-1, 1]) box(0.06, GH - 1.1, 0.06, K.glow, cx + s * (2.35 - 0.3), 0.55, cz + 0.26, nc);
    K.strip(4.24, cx, 4.08, cz + 2.11); for (const s of [-1, 1]) K.strip(4.24, cx + s * 2.11, 4.08, cz, Math.PI / 2);
    K.strip(3.2, cx, 2.95, cz + 1.53);
    K.strip(1.5, 0.3, 1.58, -2.68);
    // a lit operator window on the crusher's front, above the grille
    K.windows(1.4, 0.24, cx, 2.35, cz + 1.53, 0, 4);
    // floodlights under the girder ends, tilted down over the crusher mouth and the stone yard
    for (const s of [-1, 1]) {
      const x = cx + s * 1.75, g = new THREE.Group(); g.position.set(x, GH, cz + 0.42); g.rotation.x = 0.55; L.getRoot().add(g);
      box(0.42, 0.24, 0.18, K.steel, 0, -0.26, 0.05, { dirt: 0, parent: g }); box(0.34, 0.16, 0.03, K.white, 0, -0.22, 0.15, { ...nc, parent: g });
      pointLight('#fff1d6', 4, x, 3.2, cz + 2.8, 6);
    }
    // transformer yard in the back-right corner: a junction box by the cab, a conduit to the crusher, and the
    // high-voltage feed up to a bushing on the gantry's right leg
    const qx = 3.45, qz = -3.35;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(1.6, -3.3, 0);
    K.conduit([[qx - 0.45, 0.14, qz], [1.88, 0.14, qz]], 0.05);
    K.conduit([[1.6, 0.14, -3.08], [1.6, 0.14, -2.45], [-0.3, 0.14, -2.45]], 0.055);
    box(0.16, 0.26, 0.5, K.steelD, cx + 2.67, 4.7, cz, { dirt: 0 });
    for (const dz of [-0.16, 0.16]) cyl(0.035, 0.18, M.plain('#c9c2b0', 0.4, 0.1), cx + 2.79, 4.96, cz + dz, { seg: 8, dirt: 0 });
    K.cable([qx - 0.28, 1.17, qz], [cx + 2.79, 5.12, cz - 0.16], 0.35);
    K.cable([qx, 1.17, qz], [cx + 2.79, 5.12, cz + 0.16], 0.4);
    // ground floodlight over the stone pallets
    K.flood(4.35, 1.45, 2.4, -0.75);
    // beacons: amber on the girder, team on the hammer housing and the cab roof
    K.beacon(cx, GH + 0.78, cz, '#ffb347');
    K.beacon(cx + 0.45, GH - 0.38, cz + 0.45);
    K.beacon(0.85, 1.72, -3.85);
  }
  // ---------------------------------------------------------------- end of power layer
}
