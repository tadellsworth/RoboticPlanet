// Depot, Tron line (proposal): stacks of dark armoured containers whose seams and top edges are traced in team-colour
// light, under a gantry crane of chamfered armour lit along its legs and girder, its trolley lowering a container onto
// a loading bay marked out in light strips. Armoured cargo pods and canisters with glowing bands on the right, a small
// control booth with a lit window band at the front left. Team-coloured (one image per team), built with the Tron kit.
import { tron } from './tronkit.js';
export const config = { pad: false };
export default function (L) {
  const { box, cyl, beam, sphere, mesh, pointLight, ao, M, THREE, TEAM } = L;
  L.seed(71);
  const T = tron(L); T.pad();
  const nc = { dirt: 0, cast: false };

  // ---- small modelling helpers (as in foundry_t.js): chamfered slabs and prisms
  const halfUV = g => { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2); };
  function slab(pts, y0, h, mat, o = {}) {
    const s = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    const bev = Math.min(o.bevel ?? 0.05, h / 3);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.002, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 1 });
    g.rotateX(-Math.PI / 2); g.translate(0, y0 + bev, 0); halfUV(g);
    return mesh(g, mat, 0, 0, 0, { dirt: 0.3, dirtH: 1.2, ...o });
  }
  const chamf = (w, d, x, z, c) => [[x - w / 2 + c, z - d / 2], [x + w / 2 - c, z - d / 2], [x + w / 2, z - d / 2 + c], [x + w / 2, z + d / 2 - c],
    [x + w / 2 - c, z + d / 2], [x - w / 2 + c, z + d / 2], [x - w / 2, z + d / 2 - c], [x - w / 2, z - d / 2 + c]];
  const cbox = (w, h, d, mat, x, y, z, c = 0.08, o = {}) => slab(chamf(w, d, x, z, c), y, h, mat, { bevel: Math.min(0.04, c), ...o });
  // a prism along x: profile given as [z, y] pairs, run from x0 to x1
  function prismX(prof, x0, x1, mats, o = {}) {
    const s = new THREE.Shape(); prof.forEach(([z, y], i) => (i ? s.lineTo(-z, y) : s.moveTo(-z, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false }); g.translate(0, 0, x0); g.rotateY(Math.PI / 2); halfUV(g);
    return mesh(g, mats, 0, 0, 0, { dirt: 0, ...o });
  }
  const line = (a, b, mat = T.glow, w = 0.06) => beam(a, b, w, w, mat, nc);

  // ---- containers: dark ribbed armour in a few gunmetal tones, black corner castings, door bars on the east end,
  // a light line along the front top edge (the stacks read as lit shelves) and a lit ID panel; the top of a stack
  // gets a full glowing outline
  const tones = { a: M.ribbed('#3a4046'), b: M.ribbed('#2c3846'), c: M.ribbed('#4a4742'), d: M.ribbed('#343d37') };
  const CL = 2.6, CH = 1.1, CD = 1.1;
  function container(x, y, z, tone, o = {}) {
    box(CL, CH, CD, tones[tone], x, y, z, { dirt: y > 0 ? 0.25 : 0.8, dirtH: 0.8 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(0.14, 0.13, 0.14, T.black, x + sx * (CL / 2 - 0.06), y + CH - 0.12, z + sz * (CD / 2 - 0.06), { dirt: 0 });
      box(0.14, 0.13, 0.14, T.black, x + sx * (CL / 2 - 0.06), y, z + sz * (CD / 2 - 0.06), { dirt: 0 });
    }
    box(0.03, CH - 0.2, CD - 0.2, T.armorD, x + CL / 2, y + 0.1, z, { dirt: 0 });                    // door end
    for (const t of [-0.22, 0.22]) box(0.05, CH - 0.26, 0.04, T.black, x + CL / 2 + 0.02, y + 0.13, z + t, nc);
    box(0.03, CH - 0.34, 0.03, T.glowSoft, x + CL / 2 + 0.03, y + 0.17, z, nc);                        // door seam
    line([x - CL / 2 + 0.14, y + CH - 0.03, z + CD / 2 + 0.01], [x + CL / 2 - 0.14, y + CH - 0.03, z + CD / 2 + 0.01], T.glow, 0.045);
    box(CL - 0.3, 0.05, 0.02, T.glowSoft, x, y + 0.36, z + CD / 2 + 0.005, nc);                       // a lit seam along the face
    box(0.5, 0.16, 0.02, o.white ? T.white : T.glass, x - CL / 2 + 0.55, y + 0.62, z + CD / 2 + 0.005, nc);
    if (o.top) T.outline(CL - 0.02, CD - 0.02, x, y + CH, z, 0.045, T.glow);
  }

  // container stacks (back left)
  const zA = -3.2, zB = -2.0, xA = -2.75, xB = 0.05;
  container(xA, 0, zA, 'a'); container(xA, CH, zA, 'c'); container(xA, 2 * CH, zA, 'b', { top: true });
  container(xB, 0, zA, 'b'); container(xB, CH, zA, 'd', { top: true, white: true });
  container(xA, 0, zB, 'd'); container(xA, CH, zB, 'a', { top: true });
  container(xB, 0, zB, 'c', { top: true });
  ao(-1.35, -2.6, 5.8, 2.6, 0.55);
  container(-2.75, 0, 0.55, 'b', { top: true, white: true }); ao(-2.75, 0.55, 2.7, 1.15, 0.45);

  // ---- gantry crane: chamfered armour legs on rail bogies, side beams, the main girder, all traced in light
  const LX = 4.6, LZ = [-2.55, 0.15], GY = 4.55, GZ = -1.2;
  for (const s of [-1, 1]) {
    const x = s * LX;
    box(0.16, 0.06, 8.4, T.black, x, 0, -1.0, { dirt: 0, cast: false });                             // rail
    box(0.05, 0.02, 8.2, T.glowSoft, x, 0.06, -1.0, nc);
    for (const z of LZ) {
      cbox(0.52, 0.32, 0.9, T.armorD, x, 0.0, z, 0.1);                                              // bogie
      box(0.1, 0.08, 0.1, T.amber, x, 0.32, z + 0.38, nc);
      cbox(0.38, GY - 0.3, 0.38, T.armor, x, 0.3, z, 0.08, { dirt: 0.4, dirtH: 1.5 });              // leg
      box(0.05, GY - 0.7, 0.04, T.glow, x, 0.5, z + 0.2, nc);                                       // light line up its front
      box(0.04, GY - 0.7, 0.05, T.glowSoft, x - s * 0.2, 0.5, z, nc);                               // and its inner face
    }
    cbox(0.46, 0.5, LZ[1] - LZ[0] + 0.5, T.armorL, x, GY - 0.3, (LZ[0] + LZ[1]) / 2, 0.1);          // side beam
    line([x - s * 0.24, GY - 0.05, LZ[0] - 0.1], [x - s * 0.24, GY - 0.05, LZ[1] + 0.1], T.glow, 0.045);
    // diagonal brace under the side beam
    beam([x, 1.6, LZ[0] + 0.15], [x, GY - 0.3, (LZ[0] + LZ[1]) / 2], 0.14, 0.14, T.armorD);
    beam([x, 1.6, LZ[1] - 0.15], [x, GY - 0.3, (LZ[0] + LZ[1]) / 2], 0.14, 0.14, T.armorD);
  }
  // the girder: a chamfered box section across the yard, light along its front chamfers and its top edges
  const gp = [[-0.42, 0.1], [-0.32, 0], [0.32, 0], [0.42, 0.1], [0.42, 0.52], [0.32, 0.62], [-0.32, 0.62], [-0.42, 0.52]];
  prismX(gp.map(([z, y]) => [GZ + z, GY + y]), -LX - 0.3, LX + 0.3, [T.armorD, T.armor]);
  line([-LX - 0.3, GY + 0.1, GZ + 0.43], [LX + 0.3, GY + 0.1, GZ + 0.43], T.glow, 0.05);
  line([-LX - 0.3, GY + 0.52, GZ + 0.43], [LX + 0.3, GY + 0.52, GZ + 0.43], T.glowHi, 0.05);
  line([-LX - 0.3, GY + 0.63, GZ - 0.3], [LX + 0.3, GY + 0.63, GZ - 0.3], T.glowSoft, 0.04);
  for (let k = -7; k <= 7; k++) if (Math.abs(k * 0.6 - 2.6) > 0.8) box(0.03, 0.3, 0.02, T.seam, k * 0.6, GY + 0.16, GZ + 0.43, nc);  // panel seams
  for (const s of [-1, 1]) box(0.14, 0.1, 0.14, T.white, s * (LX + 0.18), GY + 0.62, GZ + 0.3, nc);
  // trolley riding the girder, with its lamp; four cables down to a lit spreader and the container it carries
  const tx = 2.6, tz = GZ, cy = 1.4;
  cbox(1.3, 0.5, 1.15, T.armorL, tx, GY + 0.62, tz, 0.14);
  T.outline(1.2, 1.05, tx, GY + 1.1, tz, 0.045, T.glow);
  box(0.5, 0.06, 0.3, T.black, tx, GY + 1.1, tz, nc);
  box(0.16, 0.08, 0.16, T.white, tx - 0.4, GY + 1.12, tz + 0.35, nc);
  box(0.6, 0.08, 0.04, T.glowHi, tx, GY + 0.82, tz + 0.58, nc);
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.32], [0.45, 0.32]]) box(0.04, GY - (cy + CH + 0.16), 0.04, T.glowSoft, tx + dx, cy + CH + 0.16, tz + dz, nc);
  cbox(2.5, 0.16, 0.95, T.armorD, tx, cy + CH, tz, 0.08);
  T.outline(2.5, 0.95, tx, cy + CH + 0.16, tz, 0.045, T.glowHi);
  container(tx, cy, tz, 'a');
  // the loading bay under it: glowing corner brackets and two light strips on the ground
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = tx + sx * 1.55, z = tz + sz * 0.8;
    box(0.5, 0.012, 0.07, T.glow, x - sx * 0.22, 0.004, z, nc); box(0.07, 0.012, 0.5, T.glow, x, 0.004, z - sz * 0.22, nc);
  }
  for (const sz of [-1, 1]) box(2.3, 0.012, 0.09, T.glowSoft, tx, 0.004, tz + sz * 0.8, nc);
  // a set-down plate of team-lit floor panes (dim emissive with a soft bloom, so the panes stay coloured)
  const bayPane = M.emit(TEAM, 0.42).clone(); bayPane.color = new THREE.Color(TEAM).multiplyScalar(0.1); bayPane.roughness = 0.35;
  bayPane.userData.glow = '#' + new THREE.Color(TEAM).multiplyScalar(0.2).getHexString();
  box(2.95, 0.03, 1.45, T.armorD, tx, 0, tz, { dirt: 0, cast: false });
  for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) box(0.42, 0.012, 0.38, bayPane, tx - 1.2 + i * 0.48, 0.03, tz - 0.44 + j * 0.44, nc);
  pointLight(TEAM, 3, tx, 0.9, tz + 0.9, 3);

  // ---- cargo pods (front right): chamfered armour crates with a light band; the top tier outlined in light
  for (const [x, y, z] of [[1.6, 0, 2.5], [2.5, 0, 2.5], [3.4, 0, 2.5], [2.05, 0.82, 2.5], [2.95, 0.82, 2.5], [3.4, 0, 1.6]]) {
    cbox(0.82, 0.82, 0.82, y ? T.armorL : T.armor, x, y, z, 0.1, { dirt: y ? 0.2 : 0.6 });
    box(0.6, 0.05, 0.02, T.glowSoft, x, y + 0.5, z + 0.415, nc);
    box(0.02, 0.05, 0.6, T.glowSoft, x + 0.415, y + 0.5, z, nc);
    if (y || x === 3.4 && z === 1.6 || x === 1.6) T.outline(0.66, 0.66, x, y + 0.82, z, 0.035, T.glow);
  }
  ao(2.5, 2.3, 3.0, 1.6, 0.5);
  // canisters with glowing bands
  [[0.3, 2.9], [0.95, 3.3], [0.25, 3.65], [0.9, 2.55]].forEach(([x, z], i) => {
    cyl(0.31, 0.95, i % 2 ? T.armorL : T.armor, x, 0, z, { seg: 8, dirt: 0.5 });
    L.hoop(0.315, 0.022, i === 1 ? T.amber : T.glow, x, 0.62, z, { cast: false });
    cyl(0.18, 0.03, T.black, x, 0.95, z, { seg: 8, dirt: 0 });
    L.hoop(0.2, 0.018, T.glow, x, 0.97, z, { cast: false });
  });
  ao(0.6, 3.1, 1.6, 1.6, 0.4);

  // ---- lane strip across the yard (dashed light) and a small control booth at the front left
  for (let k = 0; k < 7; k++) box(0.75, 0.012, 0.09, T.glow, -3.55 + k * 1.02, 0.004, 1.55, nc);
  const bx = -3.4, bz = 3.0;
  ao(bx, bz, 1.7, 1.4, 0.45);
  cbox(1.7, 1.55, 1.4, T.armor, bx, 0, bz, 0.14, { dirt: 0.5 });
  cbox(1.86, 0.16, 1.56, T.armorL, bx, 1.55, bz, 0.16);
  T.outline(1.86, 1.56, bx, 1.71, bz, 0.05, T.glow);
  T.posts([[bx - 0.85, bz + 0.7], [bx + 0.85, bz + 0.7]], 0.05, 1.55, 0.05);
  box(1.3, 0.34, 0.04, T.black, bx, 0.92, bz + 0.7, nc);
  box(1.2, 0.24, 0.04, T.glass, bx, 0.97, bz + 0.71, nc);
  for (const t of [-0.3, 0, 0.3]) box(0.04, 0.26, 0.05, T.armorD, bx + t, 0.96, bz + 0.715, nc);
  box(0.04, 0.24, 0.9, T.glass, bx + 0.86, 0.97, bz - 0.05, nc);
  box(0.05, 0.6, 0.05, T.armorD, bx + 0.5, 1.71, bz - 0.4, { dirt: 0 });
  box(0.1, 0.1, 0.1, T.white, bx + 0.5, 2.31, bz - 0.4, nc);
}
