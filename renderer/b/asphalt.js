// Asphalt Plant: cold-feed bins of aggregate, inclined conveyor, burner drum mixer, drag-slat conveyor to a tall
// hot-mix silo on legs, baghouse with exhaust stack.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips on the baghouse, the hot-mix
// silo, the slat conveyor and the feed bins, lit baghouse windows, a transformer yard with a junction box and conduit to
// the drum, a floodlight pole fed by cable, status lights, beacons). Its lights are team-coloured: render one image per
// team. Base render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#454b51'), yel = M.paint('#c49a26'), dark = M.paint('#2d3136'), rib = M.ribbed('#7f8378');
  const aggs = [M.rough('#9a948a'), M.rough('#7d6e5c'), M.rough('#b3a58e'), M.rough('#5f5a54')];
  L.seed(161);

  // cold-feed bins (front left): four hoppers on legs, heaped with aggregate
  for (let i = 0; i < 4; i++) {
    const x = -3.8 + i * 1.1, z = 2.9;
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) box(0.09, 0.9, 0.09, gun, x + dx, 0, z + dz, { dirt: 0.6 });
    cyl(0.4, 1.0, yel, x, 0.85, z, { rTop: 0.76, seg: 4, ry: Math.PI / 4 });
    mesh(new THREE.ConeGeometry(0.66, 0.4, 4, 1), aggs[i], x, 2.05, z, { ry: Math.PI / 4, dirt: 0 });
  }
  ao(-2.15, 2.9, 4.6, 1.2, 0.5);
  beam([-4.2, 0.55, 2.0], [-0.4, 0.55, 2.0], 0.5, 0.1, M.dark);

  // inclined feed conveyor up to the drum
  beam([-0.6, 0.6, 2.0], [-1.6, 2.3, -0.4], 0.55, 0.12, M.dark);
  beam([-0.6, 0.72, 2.0], [-1.6, 2.42, -0.4], 0.08, 0.14, yel);

  // drum mixer on its frame, burner end glowing
  const dz = -0.4, dy = 1.7;
  for (const x of [-1.6, 1.6]) { box(0.2, dy - 0.75, 1.3, gun, x, 0, dz); box(0.5, 0.2, 1.3, gun, x, dy - 0.95, dz, { dirt: 0 }); }
  const drum = hcyl(0.82, 4.4, dark, 0.2, dy, dz, { axis: 'x', seg: 36 }); drum.rotation.z = -0.05;
  for (const x of [-1.2, 0.2, 1.6]) mesh(new THREE.TorusGeometry(0.86, 0.1, 10, 36), yel, x, dy - x * 0.05, dz, { ry: Math.PI / 2, dirt: 0 });
  box(0.9, 1.3, 1.2, gun, 2.75, 1.0, dz); hcyl(0.38, 0.5, M.steel, 3.35, 1.7, dz, { axis: 'x' });
  hcyl(0.3, 0.06, M.emit(ACCENT, 2.6), 3.62, 1.7, dz, { axis: 'x', cast: false });
  pointLight(ACCENT, 6, 3.9, 1.7, dz + 0.6, 3);

  // drag-slat conveyor up to the hot-mix silo
  const sx = 3.4, sz = -2.9;
  beam([-1.9, 1.3, dz], [sx - 0.3, 5.6, sz], 0.6, 0.55, yel);
  // silo on legs
  for (const [ddx, ddz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) box(0.16, 2.3, 0.16, gun, sx + ddx, 0, sz + ddz);
  mesh(new THREE.ConeGeometry(1.0, 0.7, 28), dark, sx, 2.35, sz, { rx: Math.PI, dirt: 0 });
  cyl(1.0, 3.0, M.paint('#3a3f45'), sx, 2.7, sz, { seg: 32, dirt: 0 });
  for (const y of [3.7, 4.7]) hoop(1.02, 0.05, yel, sx, y, sz);
  cyl(1.03, 0.25, yel, sx, 5.7, sz, { seg: 32, dirt: 0 });
  ao(sx, sz, 2.0, 2.0, 0.5); box(1.8, 0.02, 0.12, M.hazard, sx, 0, sz + 1.1, { dirt: 0, cast: false });
  lamp(sx, 6.05, sz, ACCENT, { shape: 'sphere', size: 0.15, intensity: 4, dist: 3, k: 2.6 });

  // baghouse with exhaust stack (back left)
  const bx = -2.6, bz = -2.9;
  box(2.6, 2.6, 1.8, rib, bx, 0, bz); box(2.7, 0.18, 1.9, gun, bx, 2.6, bz, { dirt: 0 }); ao(bx, bz, 2.6, 1.8, 0.5);
  for (let i = 0; i < 4; i++) mesh(new THREE.ConeGeometry(0.4, 0.6, 4), gun, bx - 0.95 + i * 0.63, 0.6, bz + 0.95, { rx: Math.PI, ry: Math.PI / 4, dirt: 0 });
  cyl(0.3, 4.6, M.steel, bx + 1.6, 0, bz - 0.2, { soot: 1.2 }); ao(bx + 1.6, bz - 0.2, 0.7, 0.7, 0.4);
  pipe([[-1.6, dy + 0.4, dz - 0.5], [-1.6, 3.0, bz + 0.4], [bx + 0.6, 3.0, bz + 0.4], [bx + 0.6, 2.75, bz + 0.4]], 0.2, M.steel);
  lamp(bx - 1.2, 2.95, bz + 0.9, ACCENT, { size: 0.12, intensity: 2, dist: 2, k: 2.6 });

  // hot-oil heater tank (front right)
  for (const x of [1.9, 3.3]) box(0.2, 0.5, 0.9, M.steel, x, 0, 2.6);
  hcyl(0.55, 2.0, M.paint('#cfcbc0'), 2.6, 1.0, 2.6, { axis: 'x' }); ao(2.6, 2.6, 2.0, 1.1, 0.45);
  pipe([[2.6, 1.5, 2.6], [2.6, 1.9, 2.6], [2.6, 1.9, dz + 0.9]], 0.07, M.steel);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: the baghouse eave, a ring under the silo's cap and up its front legs, along the slat
    // conveyor's front top edge, and along the front of the cold-feed bins
    K.strip(2.7, bx, 2.63, bz + 0.97);
    L.hoop(1.03, 0.03, K.glow, sx, 5.62, sz, { cast: false });
    for (const s of [-1, 1]) box(0.05, 2.0, 0.05, K.glow, sx + s * 0.75, 0.2, sz + 0.84, nc);
    { const A = [-1.9, 1.3, dz], B = [sx - 0.3, 5.6, sz], h = [B[0] - A[0], B[2] - A[2]], n = Math.hypot(h[0], h[1]), px = -h[1] / n * 0.32, pz = h[0] / n * 0.32;
      const t0 = 0.08, t1 = 0.95, P0 = A.map((v, i) => v + (B[i] - v) * t0), P1 = A.map((v, i) => v + (B[i] - v) * t1);
      beam([P0[0] + px, P0[1] + 0.27, P0[2] + pz], [P1[0] + px, P1[1] + 0.27, P1[2] + pz], 0.05, 0.05, K.glow, nc); }
    K.strip(4.4, -2.15, 1.84, 3.45);
    // warm lit windows on the baghouse front, above the hoppers
    K.windows(1.7, 0.34, bx - 0.35, 1.5, bz + 0.92, 0, 3);
    // transformer yard at the front, a junction box and a conduit to the drum frame, a cable to the floodlight pole
    const qx = 0.75, qz = 3.7;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(1.2, 1.35, 0);
    K.conduit([[qx, 0.14, qz - 0.35], [qx, 0.14, 1.35], [0.92, 0.14, 1.35]], 0.05);
    K.conduit([[1.2, 0.5, 1.15], [1.2, 0.5, 0.32], [1.5, 0.5, 0.32]], 0.05);
    const px = 4.4, pz = 1.25;
    K.flood(px, pz, 2.6, -0.7);
    box(0.7, 0.06, 0.08, K.steelD, px, 2.2, pz, { dirt: 0 });
    for (const s of [-1, 1]) cyl(0.03, 0.12, M.plain('#c9c2b0', 0.4, 0.1), px + s * 0.3, 2.26, pz, { seg: 8, dirt: 0 });
    K.cable([qx + 0.28, 1.17, qz], [px - 0.3, 2.38, pz], 0.12);
    K.flood(-4.5, 0.6, 2.5, 0.6);
    // status lights on the burner housing and the hot-oil heater
    for (const [k, m] of [[-0.18, K.green], [0, K.amber], [0.18, K.glow]]) box(0.07, 0.07, 0.03, m, 2.75 + k, 1.95, dz + 0.61, nc);
    box(0.3, 0.2, 0.03, K.glowSoft, 2.6, 0.55, 3.16, nc);
    // beacons: amber on the exhaust stack, team on the baghouse roof and the burner housing
    K.beacon(bx + 1.6, 4.68, bz - 0.2, '#ffb347');
    K.beacon(bx - 1.0, 2.86, bz - 0.5);
    K.beacon(2.95, 2.4, dz - 0.3);
  }
  // ---------------------------------------------------------------- end of power layer
}
