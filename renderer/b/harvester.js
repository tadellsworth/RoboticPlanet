// Harvester: tall machine shed, big circular saw on a hydraulic arm, conveyor into a hopper of chopped glowing fibre.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour strips on the shed eaves, the saw
// guard's rim and the hopper, lit windows, a transformer yard with arcing insulators and a conduit to the turret, a power
// pole, floodlights, cables and beacons). Its lights are team-coloured: render one image per team. Base render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, lamp, pointLight, ao, mesh, group, rnd, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), rib = M.ribbed('#b1aa9d'), yel = M.paint('#b8952e');
  const blade = M.plain('#9ea5ab', 0.32, 0.85);
  L.seed(11);

  // machine shed (back left)
  const sx = -2.1, sz = -1.9, SH = 3.2;
  box(4.4, SH, 3.8, rib, sx, 0, sz); ao(sx, sz, 4.4, 3.8);
  box(4.6, 0.22, 4.0, gun, sx, SH, sz, { dirt: 0 });
  box(2.2, 2.3, 0.08, M.ribbed('#3c4045'), sx - 0.5, 0, 0.0, { dirt: 0.5 });
  box(2.5, 0.16, 0.12, M.hazard, sx - 0.5, 2.3, 0.02, { dirt: 0 });
  box(4.2, 0.1, 0.07, M.emit(ACCENT, 2.6), sx, SH - 0.22, 0.03, { cast: false });
  cyl(0.42, 0.55, M.steel, sx - 1.2, SH + 0.22, sz - 0.9); cyl(0.42, 0.55, M.steel, sx + 0.2, SH + 0.22, sz - 0.9);
  box(1.3, 0.65, 0.9, M.grille(), sx + 1.2, SH + 0.22, sz + 0.6);
  lamp(sx + 0.95, 2.2, 0.12, ACCENT, { size: 0.18, intensity: 4, dist: 3, k: 3 });

  // saw turret and hydraulic arm (right)
  const tx = 2.6, tz = -1.7;
  cyl(1.1, 0.9, gun, tx, 0, tz, { seg: 12 }); ao(tx, tz, 2.2, 2.2);
  box(1.8, 1.3, 1.8, warm, tx, 0.9, tz);
  box(1.8, 0.14, 0.06, M.hazard, tx, 0.95, tz + 0.91, { dirt: 0 });
  const hub = [2.2, 2.75, 1.45];
  beam([tx, 1.9, tz + 0.2], [hub[0], hub[1] + 0.25, hub[2] - 0.35], 0.6, 0.65, yel);
  beam([tx + 0.4, 1.3, tz + 0.7], [hub[0] + 0.4, 2.3, hub[2] - 0.6], 0.17, 0.17, M.chrome);
  pipe([[tx - 0.45, 2.1, tz + 0.3], [hub[0] - 0.45, 3.1, hub[2] - 0.5]], 0.06, M.dark);

  // the saw blade facing the camera: big teeth, slotted disc, hazard guard over the top
  hcyl(1.8, 0.1, blade, hub[0], hub[1], hub[2], { axis: 'z', seg: 64 });
  for (let k = 0; k < 26; k++) { const a = (k / 26) * Math.PI * 2; const g = group(hub[0] + Math.cos(a) * 1.82, hub[1] + Math.sin(a) * 1.82, hub[2]); g.rotation.z = a - Math.PI / 2; mesh(new THREE.ConeGeometry(0.17, 0.34, 4), M.steel, 0, 0.12, 0, { parent: g, dirt: 0 }); }
  hcyl(1.15, 0.12, M.steel, hub[0], hub[1], hub[2] + 0.01, { axis: 'z', seg: 48 });
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + 0.3; const g = group(hub[0] + Math.cos(a) * 1.45, hub[1] + Math.sin(a) * 1.45, hub[2] + 0.06); g.rotation.z = a; box(0.42, 0.07, 0.02, M.dark, 0, -0.035, 0, { parent: g, dirt: 0, cast: false }); }
  hcyl(0.42, 0.36, M.dark, hub[0], hub[1], hub[2], { axis: 'z' });
  const guard = new THREE.TorusGeometry(2.12, 0.22, 10, 40, Math.PI * 0.8); guard.rotateZ(Math.PI * 0.12);
  mesh(guard, M.hazard, hub[0], hub[1], hub[2], { dirt: 0 });
  lamp(tx, 2.25, tz, ACCENT, { size: 0.22, intensity: 4, dist: 3, k: 3 });

  // hopper of chopped fibre (front left)
  const hx = -2.3, hz = 2.6;
  box(3.5, 1.3, 0.16, warm, hx, 0, hz + 1.0); box(3.5, 1.3, 0.16, warm, hx, 0, hz - 1.0);
  box(0.16, 1.3, 2.16, warm, hx - 1.67, 0, hz); box(0.16, 1.3, 2.16, warm, hx + 1.67, 0, hz);
  box(3.66, 0.12, 0.2, M.hazard, hx, 1.3, hz + 1.0, { dirt: 0 }); ao(hx, hz, 3.5, 2.2);
  const fibre = [M.plain('#3e8c6b'), M.plain('#5fbf90'), M.plain('#2f6b52'), M.emit('#5ff5c0', 0.8)];
  for (let i = 0; i < 120; i++) {
    const x = hx + (rnd() - 0.5) * 3.1, z = hz + (rnd() - 0.5) * 1.75, dx = (x - hx) / 1.6, dz = (z - hz) / 0.95;
    const y = 0.4 + 1.05 * Math.max(0, 1 - 0.65 * (dx * dx + dz * dz)) + rnd() * 0.1;
    const geo = new THREE.BoxGeometry(0.25 + rnd() * 0.3, 0.07 + rnd() * 0.06, 0.1 + rnd() * 0.1);
    mesh(geo, fibre[i % 7 === 0 ? 3 : i % 3], x, y, z, { rx: rnd() * 0.8, ry: rnd() * 3, rz: rnd() * 0.6, dirt: 0 });
  }
  pointLight(ACCENT, 6, hx, 2.0, hz + 0.4, 4);

  // conveyor from under the saw up into the hopper
  beam([1.0, 1.0, 2.75], [-0.55, 1.45, 2.75], 0.75, 0.12, M.dark);
  beam([1.0, 1.1, 2.33], [-0.55, 1.55, 2.33], 0.08, 0.14, yel); beam([1.0, 1.1, 3.17], [-0.55, 1.55, 3.17], 0.08, 0.14, yel);
  for (const x of [0.8, -0.3]) { box(0.1, x > 0 ? 1.0 : 1.35, 0.1, M.steel, x, 0, 2.35); box(0.1, x > 0 ? 1.0 : 1.35, 0.1, M.steel, x, 0, 3.15); }
  for (const t of [0.15, 0.45, 0.75]) { const x = 1.0 - 1.55 * t, y = 1.08 + 0.45 * t; box(0.22, 0.06, 0.12, fibre[t === 0.45 ? 3 : 1], x, y, 2.75, { dirt: 0 }); }

  pipe([[0.1, 0.6, -2.5], [1.5, 0.6, -2.5]], 0.17, M.steel);
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: the shed's roof edges, the saw guard's outer rim, the turret's top edge and base, the hopper front
    K.strip(4.6, sx, SH + 0.17, sz + 2.03); K.strip(4.0, sx + 2.33, SH + 0.17, sz, Math.PI / 2);
    const rim = new THREE.TorusGeometry(2.33, 0.032, 6, 48, Math.PI * 0.8); rim.rotateZ(Math.PI * 0.12);
    mesh(rim, K.glow, hub[0], hub[1], hub[2] + 0.09, { cast: false, dirt: 0 });
    K.strip(1.8, tx, 2.17, tz + 0.92); L.hoop(1.12, 0.03, K.glow, tx, 0.88, tz, { cast: false });
    K.strip(3.4, hx, 1.12, hz + 1.1);
    // warm lit windows on the shed front either side of the door, a lamp over the door
    K.windows(1.2, 0.34, -0.72, 1.35, 0.03, 0, 3);
    K.windows(0.5, 0.34, -4.0, 1.35, 0.03, 0, 1);
    // transformer yard at the front right (clear of the blade), a junction box and a conduit under the blade to the turret
    const qx = 3.4, qz = 3.6;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(2.2, 3.75, 0);
    K.conduit([[qx - 0.45, 0.14, 3.62], [2.48, 0.14, 3.62]], 0.05);
    K.conduit([[2.2, 0.14, 3.54], [2.2, 0.14, 0.3], [2.75, 0.14, -0.5]], 0.055);
    // floodlights: one by the hopper, one lighting the blade's face
    K.flood(-4.45, 1.05, 2.6, 0.7);
    K.flood(4.4, 0.55, 2.7, -0.65);
    K.cable([qx + 0.28, 1.17, qz], [4.4, 2.55, 0.55], 0.25);
    // power pole in the back-right corner: amber beacon on top, a cable to the shed roof, a conduit to the turret
    const ox = 4.15, oz = -3.85;
    cyl(0.07, 3.6, K.steelD, ox, 0, oz, { seg: 10, dirt: 0.3 });
    box(0.8, 0.07, 0.09, K.steelD, ox, 3.1, oz, { dirt: 0 });
    for (const s of [-1, 1]) cyl(0.03, 0.13, M.plain('#c9c2b0', 0.4, 0.1), ox + s * 0.33, 3.17, oz, { seg: 8, dirt: 0 });
    K.beacon(ox, 3.68, oz, '#ffb347');
    for (const s of [-1, 1]) K.cable([ox + s * 0.33, 3.3, oz], [0.2, SH + 0.3, sz - 1.2 + s * 0.4], 0.45);
    K.conduit([[ox, 0.14, oz + 0.15], [ox, 0.14, -1.7], [tx + 1.1, 0.14, -1.7]], 0.055);
    box(0.3, 0.4, 0.2, K.steel, ox, 0.6, oz + 0.12, { dirt: 0.3 }); box(0.06, 0.06, 0.03, K.green, ox, 0.85, oz + 0.23, nc);
    // team beacons: shed roof vents and corner, turret top corner
    K.beacon(sx - 1.2, SH + 0.86, sz - 0.9); K.beacon(sx - 2.15, SH + 0.3, sz + 1.85);
    K.beacon(tx + 0.75, 2.3, tz - 0.75);
  }
  // ---------------------------------------------------------------- end of power layer
}
