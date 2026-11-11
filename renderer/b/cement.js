// Cement Works: long inclined rotary kiln on piers with a glowing firing hood, cyclone preheater tower, twin cement silos.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips on the preheater tower and
// firing hood, rings on the silos, lit tower windows, a transformer yard with a junction box and ground conduit along the
// kiln, a floodlight pole fed by cable, beacons). Its lights are team-coloured: render one image per team. Base render
// only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, ladder, catwalk, group, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#cfcbc0'), warm = M.paint('#8c8579'), kilnM = M.paint('#7d6a5a', { panelW: 512, panelH: 128 });
  const silo = M.rough('#bdb8ad');
  L.seed(151);

  // rotary kiln: inclined along x, three piers with tyre rings
  const kz = 1.0, ky = 1.55, KL = 7.0, tilt = 0.06;
  const k = hcyl(0.72, KL, kilnM, -0.1, ky, kz, { axis: 'x', seg: 40 }); k.rotation.z = tilt;
  for (const x of [-2.4, 0, 2.4]) {
    const y = ky + x * Math.tan(tilt);
    box(0.9, y - 0.55, 1.4, M.concrete, x - 0.1, 0, kz); mesh(new THREE.TorusGeometry(0.8, 0.11, 10, 40), M.steel, x - 0.1, y, kz, { ry: Math.PI / 2, dirt: 0 });
    hcyl(0.22, 0.3, M.steel, x - 0.1, y - 0.75, kz + 0.45, { axis: 'x' }); hcyl(0.22, 0.3, M.steel, x - 0.1, y - 0.75, kz - 0.45, { axis: 'x' });
  }
  mesh(new THREE.TorusGeometry(0.84, 0.16, 10, 40), M.paint('#3f6b6b', { rivets: false }), 1.2, ky + 1.3 * Math.tan(tilt), kz, { ry: Math.PI / 2, dirt: 0 });
  ao(-0.1, kz, KL, 1.6, 0.5);

  // firing hood at the low end with the kiln's glow, clinker cooler below
  const hx = -3.95;
  box(1.2, 2.5, 1.9, gun, hx, 0, kz); box(1.3, 0.16, 2.0, warm, hx, 2.5, kz, { dirt: 0 });
  box(0.8, 0.8, 0.06, M.emit(ACCENT, 2.6), hx, 1.15, kz + 0.96, { cast: false });
  box(0.95, 0.12, 0.08, M.hazard, hx, 2.05, kz + 0.97, { dirt: 0 });
  cyl(0.3, 1.4, M.steel, hx, 2.66, kz - 0.3, { soot: 0.6 });
  pointLight(ACCENT, 12, hx + 0.2, 1.2, kz + 1.8, 4);
  const glowRing = hcyl(0.6, 0.06, M.emit(ACCENT, 1.4), -3.38, ky - 3.6 * Math.tan(tilt), kz, { axis: 'x', cast: false }); glowRing.rotation.z = tilt;

  // cyclone preheater tower at the high end
  const tx = 3.9, tz = 0.2;
  box(1.5, 5.6, 1.6, off, tx, 0, tz - 0.4); box(1.6, 0.2, 1.7, gun, tx, 5.6, tz - 0.4, { dirt: 0 }); ao(tx, tz - 0.4, 1.5, 1.6, 0.5);
  for (const [y, r] of [[4.3, 0.42], [3.0, 0.48], [1.7, 0.54]]) {
    cyl(r, 0.8, M.steel, tx - 0.15, y, tz + 0.85, { seg: 24 }); mesh(new THREE.ConeGeometry(r, 0.7, 24), M.steel, tx - 0.15, y - 0.35, tz + 0.85, { rx: Math.PI, dirt: 0 });
  }
  pipe([[tx - 0.15, 5.1, tz + 0.85], [tx - 0.15, 5.35, tz + 0.85], [tx - 0.15, 5.35, tz - 0.4]], 0.18, M.steel);
  pipe([[tx - 0.75, 1.4, tz + 0.6], [3.4, ky + 0.25, kz]], 0.25, M.steel);
  for (const y of [1.6, 2.9, 4.2]) box(1.7, 0.06, 0.25, M.grating, tx, y, tz + 0.43, { dirt: 0 });
  lamp(tx + 0.55, 5.95, tz - 0.4, ACCENT, { shape: 'sphere', size: 0.14, intensity: 3, dist: 3, k: 2.6 });

  // twin cement silos (back left) with a bridge on top
  for (const x of [-2.9, -0.9]) {
    box(1.9, 0.35, 1.9, M.concrete, x, 0, -3.1); cyl(0.9, 4.4, silo, x, 0.35, -3.1, { seg: 36, dirtH: 1.2 });
    cyl(0.92, 0.45, M.steel, x, 4.75, -3.1, { rTop: 0.45, seg: 36, dirt: 0 });
    for (const y of [1.6, 3.0]) hoop(0.92, 0.04, M.steel, x, y, -3.1);
  }
  ao(-1.9, -3.1, 4.0, 2.0, 0.5);
  beam([-2.9, 5.0, -3.1], [-0.9, 5.0, -3.1], 0.5, 0.18, M.grating);
  pipe([[-0.9, 4.4, -2.3], [-0.9, 4.4, -1.4], [2.4, 4.4, -1.4], [tx - 0.75, 4.4, tz - 0.4]], 0.14, M.steel);
  ladder(-2.0, 0, 4.9, -2.2);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: the preheater tower's roof edges and front corner, the firing hood's eaves, a ring at each
    // silo's shoulder, along the silo bridge
    K.strip(1.6, tx, 5.78, tz + 0.47); K.strip(1.7, tx - 0.82, 5.78, tz - 0.4, Math.PI / 2);
    box(0.05, 5.0, 0.05, K.glow, tx - 0.77, 0.4, tz + 0.42, nc);
    K.strip(1.3, hx, 2.6, kz + 1.02); K.strip(2.0, hx + 0.66, 2.6, kz, Math.PI / 2);
    for (const x of [-2.9, -0.9]) L.hoop(0.93, 0.03, K.glow, x, 4.73, -3.1, { cast: false });
    K.strip(2.0, -1.9, 5.14, -2.84, 0, 0.05);
    // warm lit windows up the tower's front, one per floor beside the cyclones
    for (const y of [2.0, 3.3, 4.6]) K.windows(0.3, 0.32, tx + 0.57, y, tz + 0.42, 0, 1);
    // transformer yard at the front, a junction box at the middle pier, a ground conduit along the kiln to the hood
    const qx = 1.1, qz = 3.45;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(-0.1, 2.3, 0);
    K.conduit([[qx - 0.45, 0.14, qz], [-0.1, 0.14, qz], [-0.1, 0.14, 2.52]], 0.05);
    K.conduit([[-0.1, 0.5, 2.1], [-0.1, 0.5, 1.72]], 0.05);
    K.conduit([[-0.38, 0.14, 2.3], [-3.15, 0.14, 2.3], [-3.15, 0.14, 1.96]], 0.05);
    // floodlight poles: front right fed by cable from the transformer, front left by the hood
    const px = 3.3, pz = 2.75;
    K.flood(px, pz, 2.6, -0.45);
    box(0.7, 0.06, 0.08, K.steelD, px, 2.2, pz, { dirt: 0 });
    for (const s of [-1, 1]) cyl(0.03, 0.12, M.plain('#c9c2b0', 0.4, 0.1), px + s * 0.3, 2.26, pz, { seg: 8, dirt: 0 });
    K.cable([qx + 0.28, 1.17, qz], [px - 0.3, 2.38, pz], 0.2); K.cable([qx, 1.17, qz], [px + 0.3, 2.38, pz], 0.25);
    K.flood(-4.4, 3.0, 2.4, 0.5);
    // beacons: amber on the hood's stack and the tower roof, team on the silo tops
    K.beacon(hx, 4.13, kz - 0.3, '#ffb347');
    K.beacon(tx - 0.6, 5.88, tz - 1.1, '#ffb347');
    for (const x of [-2.9, -0.9]) K.beacon(x, 5.27, -3.1);
  }
  // ---------------------------------------------------------------- end of power layer
}
