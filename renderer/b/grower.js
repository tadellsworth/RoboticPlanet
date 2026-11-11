// Grower: geodesic glass dome over rows of glowing seedlings, misting nozzles, water tank, airlock.
// Powered realism: a lights-and-electricity layer from b/powerkit.js (team-colour rings round the base and the crown,
// team lamps on the misting posts, lit airlock windows, a transformer yard with a junction box and a cable to the posts,
// floodlights, beacons). Its lights are team-coloured: render one image per team. Base render only.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), off = M.paint('#c7c2b6'), soil = M.plain('#3b2b1d', 0.95);
  L.seed(81);
  const cx = 0, cz = -0.7, RD = 3.35, BY = 0.5;

  cyl(3.65, BY, M.concrete, cx, 0, cz, { seg: 48 }); ao(cx, cz, 7.3, 7.3, 0.5);
  hoop(3.4, 0.1, gun, cx, BY, cz);

  // planting beds with glowing seedlings
  const seed = M.emit(ACCENT, 1.5);
  for (let dz = -2.6; dz <= 2.61; dz += 0.58) {
    const half = Math.sqrt(Math.max(0, 2.95 * 2.95 - dz * dz)) - 0.2; if (half < 0.4) continue;
    box(2 * half, 0.26, 0.34, soil, cx, BY, cz + dz, { dirt: 0 });
    for (let x = -half + 0.18; x < half - 0.1; x += 0.3) mesh(new THREE.ConeGeometry(0.1, 0.26, 6), seed, cx + x, BY + 0.39, cz + dz, { dirt: 0, cast: false });
  }
  pointLight(ACCENT, 10, cx, 1.6, cz, 5);

  // glass dome and geodesic frame
  const glass = new THREE.MeshPhysicalMaterial({ color: '#d8f2ee', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false });
  glass.envMapIntensity = 1.6;
  mesh(new THREE.SphereGeometry(RD, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass, cx, BY, cz, { cast: false, dirt: 0 });
  const ico = new THREE.IcosahedronGeometry(RD + 0.02, 2), p = ico.attributes.position, seen = new Set(), frame = M.paint('#3e4449', { rivets: false });
  const key = v => v.map(n => n.toFixed(2)).join(',');
  for (let i = 0; i < p.count; i += 3) for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
    const A = [p.getX(a), p.getY(a), p.getZ(a)], B = [p.getX(b), p.getY(b), p.getZ(b)];
    if (A[1] < -0.01 || B[1] < -0.01) continue; const k = [key(A), key(B)].sort().join('|'); if (seen.has(k)) continue; seen.add(k);
    pipe([[cx + A[0], BY + Math.max(0, A[1]), cz + A[2]], [cx + B[0], BY + Math.max(0, B[1]), cz + B[2]]], 0.045, frame);
  }
  cyl(0.35, 0.3, gun, cx, BY + RD - 0.05, cz, { dirt: 0 });

  // misting nozzles on posts around the dome, with faint mist
  const mist = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.13, roughness: 1, depthWrite: false });
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6, px = cx + Math.cos(a) * 3.95, pz = cz + Math.sin(a) * 3.95;
    box(0.14, 2.1, 0.14, M.steel, px, 0, pz);
    beam([px, 2.1, pz], [cx + Math.cos(a) * 3.35, 2.25, cz + Math.sin(a) * 3.35], 0.08, 0.08, M.steel);
    sphere(0.09, M.chrome, cx + Math.cos(a) * 3.3, 2.25, cz + Math.sin(a) * 3.3);
    for (let j = 0; j < 3; j++) mesh(new THREE.SphereGeometry(0.35 + j * 0.12, 16, 10), mist, cx + Math.cos(a) * (3.2 - j * 0.25), 2.15 - j * 0.12, cz + Math.sin(a) * (3.2 - j * 0.25), { cast: false, dirt: 0 });
  }
  pipe([[cx + 3.95, 0.25, cz], [4.4, 0.25, cz], [4.4, 0.25, -3.6], [3.6, 0.25, -3.6]], 0.1, M.steel);

  // water tank (back right), pump skid (left), airlock (front)
  cyl(0.85, 2.7, off, 3.65, 0, -3.65, { seg: 32 }); hoop(0.87, 0.05, M.steel, 3.65, 1.0, -3.65); hoop(0.87, 0.05, M.steel, 3.65, 2.0, -3.65); ao(3.65, -3.65, 1.7, 1.7, 0.5);
  cyl(0.88, 0.12, gun, 3.65, 2.7, -3.65, { dirt: 0 });
  box(1.3, 0.9, 1.0, gun, -3.9, 0, 2.3); hcyl(0.3, 1.0, M.paint('#3f6b6b'), -3.9, 1.2, 2.3, { axis: 'x' }); ao(-3.9, 2.3, 1.3, 1.0, 0.45);
  pipe([[-3.9, 0.5, 1.8], [-3.9, 0.5, 0.9], [-3.3, 0.5, 0.9]], 0.1, M.steel);
  box(1.5, 1.5, 1.4, off, cx, 0, cz + 3.9); box(1.65, 0.14, 1.55, gun, cx, 1.5, cz + 3.9, { dirt: 0 }); ao(cx, cz + 3.9, 1.5, 1.4, 0.45);
  box(0.8, 1.2, 0.06, M.dark, cx, 0, cz + 4.61, { dirt: 0.4 });
  box(0.9, 0.08, 0.06, M.emit(ACCENT, 2.6), cx, 1.3, cz + 4.63, { cast: false });
  box(1.5, 0.08, 0.4, M.hazard, cx, 0, cz + 4.85, { dirt: 0 });
  // ================================================================ power layer (lights and electricity), base render only
  const PART = new URLSearchParams(location.search).get('part');
  if (!PART || PART === 'base') {
    const K = power(L), nc = { dirt: 0, cast: false };
    // team light strips: round the base ring's top edge and the dome's crown, team lamps on the misting posts, the
    // airlock eave and the water tank's rim
    L.hoop(3.66, 0.03, K.glow, cx, BY - 0.03, cz, { cast: false });
    L.hoop(0.37, 0.03, K.glow, cx, BY + RD + 0.23, cz, { cast: false });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + Math.PI / 6; box(0.18, 0.08, 0.18, K.glow, cx + Math.cos(a) * 3.95, 2.1, cz + Math.sin(a) * 3.95, nc); }
    K.strip(1.65, cx, 1.62, cz + 4.68);
    L.hoop(0.89, 0.03, K.glow, 3.65, 2.8, -3.65, { cast: false });
    // the airlock: warm windows either side of the door; status lights on the pump skid
    for (const s of [-1, 1]) K.windows(0.3, 0.4, cx + s * 0.58, 0.75, cz + 4.62, 0, 1);
    for (const [k, m] of [[-0.25, K.green], [0, K.amber], [0.25, K.glow]]) box(0.07, 0.07, 0.03, m, -3.9 + k, 0.7, 2.81, nc);
    // transformer yard at the front right: a junction box at the base ring, a cable up to the nearest misting post
    const qx = 3.3, qz = 3.45;
    box(1.25, 0.03, 1.05, K.dark, qx, 0, qz, { dirt: 0, cast: false });
    for (const [w, d, x, z] of [[1.25, 0.08, qx, qz - 0.52], [1.25, 0.08, qx, qz + 0.52], [0.08, 1.05, qx - 0.62, qz], [0.08, 1.05, qx + 0.62, qz]]) box(w, 0.04, d, M.hazard, x, 0, z, { dirt: 0, cast: false });
    K.transformer(qx, qz, 0);
    K.junction(2.05, 2.75, 0);
    K.conduit([[qx - 0.45, 0.14, qz], [2.05, 0.14, qz], [2.05, 0.14, 2.97]], 0.05);
    K.conduit([[2.05, 0.4, 2.56], [2.05, 0.4, 2.2]], 0.05);
    { const a = Math.PI / 6; K.cable([qx + 0.28, 1.17, qz], [cx + Math.cos(a) * 3.95, 2.0, cz + Math.sin(a) * 3.95], 0.25); }
    // floodlights at the front left and on the right
    K.flood(-3.0, 3.7, 2.4, 0.5);
    K.flood(4.4, 1.45, 2.5, -0.6);
    // beacons: amber on the dome's crown, team on the tank and the airlock roof
    cyl(0.025, 0.5, K.steelD, cx, BY + RD + 0.25, cz, { seg: 8, dirt: 0 }); K.beacon(cx, BY + RD + 0.8, cz, '#ffb347');
    K.beacon(3.65, 2.92, -3.65);
    K.beacon(cx + 0.6, 1.72, cz + 3.5);
  }
  // ---------------------------------------------------------------- end of power layer
}
