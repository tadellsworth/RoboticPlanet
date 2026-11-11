// Bot Foundry, Tron line (proposal): an armoured fabrication hall under a faceted hangar roof traced in team-colour
// light (arch ribs, facet lines, a glowing gable outline and three skylights down the spine), a light-traced gear
// emblem on the gable, and a glowing assembly bay: a half-built warbot on a lit cradle at the threshold between two
// robot arms welding it, a launch lane with light chevrons leading out. A charging pylon and armoured parts bins on
// the apron. Team-coloured (one image per team), built with the shared Tron kit.
import { tron } from './tronkit.js';
export const config = { pad: false };
export default function (L) {
  const { box, cyl, beam, sphere, mesh, pointLight, ao, M, THREE, TEAM } = L;
  L.seed(61);
  const T = tron(L); T.pad();
  const nc = { dirt: 0, cast: false };

  // ---- small modelling helpers: chamfered slabs (XZ outline extruded up) and prisms (XY profile run along z)
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
  function prism(prof, z0, z1, mats, o = {}) {
    const s = new THREE.Shape(); prof.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const g = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false }); g.translate(0, 0, z0); halfUV(g);
    return mesh(g, mats, 0, 0, 0, { dirt: 0, ...o });
  }
  const line = (a, b, mat = T.glow, w = 0.06) => beam(a, b, w, w, mat, nc);
  const poly = (pts, mat = T.glow, w = 0.06, closed = false) => { const n = pts.length; for (let i = 0; i < (closed ? n : n - 1); i++) line(pts[i], pts[(i + 1) % n], mat, w); };
  // a glowing pane that blooms softly (large lit areas would otherwise wash out to white)
  const pane = (k = 0.9, g = 0.3) => { const m = M.emit(TEAM, k).clone(); m.color = new THREE.Color(TEAM).multiplyScalar(0.1); m.roughness = 0.35; m.userData.glow = '#' + new THREE.Color(TEAM).multiplyScalar(g).getHexString(); return m; };
  const skyPane = pane(1.0, 0.32), floorPane = pane(0.55, 0.22);

  // ---- the hall
  const hx = -0.2, hz = -1.5, W = 7.6, D = 5.6, WH = 2.0;
  const x0 = hx - W / 2, x1 = hx + W / 2, zb = hz - D / 2, zf = hz + D / 2;
  const DW = 3.3, DH = 1.8, RD = 1.0;            // bay door width / height, bay recess depth
  const dx0 = hx - DW / 2, dx1 = hx + DW / 2;
  ao(hx, hz, W + 0.4, D + 0.4, 0.6);

  // armoured plinth (base skirt) with a glowing line along its top, broken at the bay
  slab(chamf(W + 0.36, D + 0.36, hx, hz, 0.22), 0, 0.32, T.armorD, { bevel: 0.07, dirt: 0.6, dirtH: 0.4 });
  const sk = 0.33, e = 0.17;
  poly([[dx0 - 0.3, sk, zf + e], [x0 - e + 0.12, sk, zf + e], [x0 - e, sk, zf + e - 0.12], [x0 - e, sk, zb - e + 0.12], [x0 - e + 0.12, sk, zb - e],
    [x1 + e - 0.12, sk, zb - e], [x1 + e, sk, zb - e + 0.12], [x1 + e, sk, zf + e - 0.12], [x1 + e - 0.12, sk, zf + e], [dx1 + 0.3, sk, zf + e]], T.glow, 0.055);

  // walls: one block with the bay notched out of the front
  slab([[x0, zb], [x1, zb], [x1, zf], [dx1, zf], [dx1, zf - RD], [dx0, zf - RD], [dx0, zf], [x0, zf]], 0.3, WH - 0.3, T.armor, { bevel: 0.03, dirt: 0.45, dirtH: 1.0 });
  // front wall: armoured pilasters, dark seams and a glowing window band
  for (const x of [x0 + 0.2, x1 - 0.2]) cbox(0.34, WH - 0.3, 0.16, T.armorL, x, 0.3, zf + 0.06, 0.05, { dirt: 0.4 });
  for (const [a, b] of [[x0 + 0.37, dx0 - 0.3], [dx1 + 0.3, x1 - 0.37]]) {
    const cx = (a + b) / 2, w = b - a;
    box(w - 0.16, 0.26, 0.04, T.black, cx, 1.14, zf + 0.005, nc);
    box(w - 0.24, 0.16, 0.04, T.glass, cx, 1.19, zf + 0.012, nc);
    for (let k = 1; k < 4; k++) box(0.04, 0.17, 0.05, T.armorD, a + 0.08 + (w - 0.16) * k / 4, 1.185, zf + 0.012, nc);
    box(w, 0.025, 0.02, T.seam, cx, 0.72, zf + 0.012, nc);
  }
  // side walls: a long window band (the flanks catch a sliver of view)
  for (const s of [-1, 1]) box(0.04, 0.16, D - 1.2, T.glass, (s < 0 ? x0 : x1) + s * 0.012, 1.19, hz, nc);
  // glowing corner posts
  T.posts([[x0 - 0.01, zf + 0.01], [x1 + 0.01, zf + 0.01], [x1 + 0.01, zb - 0.01], [x0 - 0.01, zb - 0.01]], 0.32, WH, 0.06);

  // bay interior: a dark floor laid with a glowing grid, lit from within
  box(DW, 0.02, RD, floorPane, hx, 0.3, zf - RD / 2, nc);
  for (let k = 0; k <= 6; k++) box(0.03, 0.024, RD, T.black, dx0 + DW * k / 6, 0.3, zf - RD / 2, nc);
  for (let k = 1; k < 3; k++) box(DW, 0.024, 0.03, T.black, hx, 0.3, zf - RD + RD * k / 3, nc);
  pointLight(TEAM, 5, hx, 1.2, zf - 0.7, 3);

  // bay door frame: chamfered jambs and lintel in light armour, traced with light; the shutter rolled up under the lintel
  for (const s of [-1, 1]) {
    const x = s < 0 ? dx0 - 0.14 : dx1 + 0.14;
    cbox(0.36, DH + 0.1, 0.46, T.armorL, x, 0.3, zf + 0.05, 0.08);
    box(0.06, DH - 0.1, 0.05, T.glowHi, x - s * 0.15, 0.36, zf + 0.29, nc);
    box(0.14, 0.12, 0.14, T.amber, x, DH + 0.46, zf + 0.06, nc);            // amber roll-out beacons
  }
  cbox(DW + 0.72, 0.38, 0.5, T.armorL, hx, DH + 0.08, zf + 0.05, 0.08);
  box(DW, 0.2, 0.3, T.armorD, hx, DH - 0.12, zf - 0.1, { dirt: 0 });       // the rolled-up shutter
  line([dx0, DH - 0.12, zf + 0.06], [dx1, DH - 0.12, zf + 0.06], T.glowHi, 0.05);
  line([dx0 - 0.3, DH + 0.46, zf + 0.31], [dx1 + 0.3, DH + 0.46, zf + 0.31], T.glow, 0.05);

  // ---- the faceted hangar roof
  const RH = 2.05, half = W / 2 + 0.12;
  const prof = [[-half, 0], [-half + 0.5, 0.95], [-2.3, 1.7], [-1.05, RH], [1.05, RH], [2.3, 1.7], [half - 0.5, 0.95], [half, 0]];
  const P = prof.map(([x, y]) => [hx + x, WH + y]);
  const rz0 = zb - 0.12, rz1 = zf + 0.14;
  prism(P, rz0, rz1, [T.armorD, T.armor]);
  // arch ribs (front, back and two between), a hair proud of the roof skin
  const ribP = prof.map(([x, y]) => [hx + x * (1 + 0.05 / half), WH + (y > 0 ? y + 0.05 : 0)]);
  const rA = hz - 0.95, rB = hz + 0.95;
  for (const z of [rz0 - 0.02, rA - 0.09, rB - 0.09]) prism(ribP, z, z + 0.18, [T.armorL, T.armorL]);
  prism(ribP, rz1 - 0.16, rz1 + 0.02, [T.armorD, T.armorL]);
  // light lines running the length of the roof along each facet edge (between the ribs)
  const segs = [[rz0 + 0.17, rA - 0.09], [rA + 0.09, rB - 0.09], [rB + 0.09, rz1 - 0.16]];
  for (let i = 1; i < prof.length - 1; i++) {
    const [x, y] = ribP[i], m = (i === 3 || i === 4) ? T.glow : T.glowSoft;
    for (const [a, b] of segs) line([x, y - 0.035, a], [x, y - 0.035, b], m, 0.05);
  }
  // eave lines along both sides
  for (const xs of [x0 - 0.13, x1 + 0.13]) line([xs, WH + 0.02, rz0], [xs, WH + 0.02, rz1], T.glow, 0.055);
  // the gable outline, front and back, in bright light
  poly(ribP.map(([x, y]) => [x, y + 0.01, rz1 + 0.03]), T.glowHi, 0.07);
  poly(ribP.map(([x, y]) => [x, y + 0.01, rz0 - 0.03]), T.glow, 0.06);
  // skylight spine: a raised strip with three skylights of team-lit glass, mullioned
  cbox(1.5, 0.16, D - 0.3, T.armorD, hx, WH + RH, hz, 0.1);
  for (const dz of [-1.9, 0, 1.9]) {
    const sy = WH + RH + 0.16;
    box(1.0, 0.02, 1.3, T.black, hx, sy, hz + dz, nc);
    box(0.88, 0.03, 1.18, skyPane, hx, sy, hz + dz, nc);
    box(0.04, 0.045, 1.18, T.armorD, hx, sy, hz + dz, nc);
    for (const t of [-0.3, 0.3]) box(0.88, 0.045, 0.04, T.armorD, hx, sy, hz + dz + t, nc);
    T.outline(1.0, 1.3, hx, sy + 0.03, hz + dz, 0.04, T.glow);
  }
  // roof vents on the upper facets: dark armoured boxes with glowing slits
  for (const s of [-1, 1]) for (const dz of [-1.9, 1.9]) {
    const vx = hx + s * 1.68, vy = WH + 1.86;
    const v = cbox(0.62, 0.22, 0.8, T.armorD, 0, 0, 0, 0.08); v.position.set(vx, vy - 0.05, hz + dz); v.rotation.z = -s * 0.31;
    for (const t of [-0.2, 0.2]) { const sl = box(0.42, 0.03, 0.06, T.glow, 0, 0, 0, nc); sl.position.set(vx, vy + 0.13, hz + dz + t); sl.rotation.z = -s * 0.31; }
  }
  // white marker lights at the front eave corners
  for (const x of [x0 - 0.13, x1 + 0.13]) box(0.12, 0.1, 0.12, T.white, x, WH - 0.02, rz1, nc);

  // light-traced gear emblem on the front gable, over a dark armour gear, with a lit hub
  const gy = WH + 1.02, gz = rz1 + 0.02, teeth = 12, rO = 0.84, rI = 0.66, st = Math.PI * 2 / teeth, gpts = [];
  for (let k = 0; k < teeth; k++) for (const [r, t] of [[rI - 0.03, 0.04], [rO - 0.035, 0.2], [rO - 0.035, 0.46], [rI - 0.03, 0.62]]) gpts.push([hx + Math.cos(k * st + t * st) * r, gy + Math.sin(k * st + t * st) * r, gz + 0.19]);
  L.gear(rO, rI, teeth, 0.12, T.armorL, hx, gy, gz + 0.06);
  poly(gpts, T.glowHi, 0.045, true);
  const hub = cyl(0.24, 0.06, T.glow, 0, 0, 0, { seg: 24, cast: false }); hub.rotation.x = Math.PI / 2; hub.position.set(hx, gy, gz + 0.1);
  const hub2 = cyl(0.13, 0.07, T.black, 0, 0, 0, { seg: 24, cast: false }); hub2.rotation.x = Math.PI / 2; hub2.position.set(hx, gy, gz + 0.12);

  // ---- the assembly cradle at the threshold: a half-built warbot on it, two robot arms welding
  const cx = hx, cz = zf + 0.55;
  cyl(0.9, 0.1, T.armorD, cx, 0, cz, { seg: 8, dirt: 0 });
  L.hoop(0.8, 0.03, T.glowHi, cx, 0.11, cz);
  cyl(0.68, 0.04, T.black, cx, 0.1, cz, { seg: 8, dirt: 0, cast: false });
  for (const a of [0.785, 2.356, 3.927, 5.498]) box(0.16, 0.08, 0.16, T.glow, cx + Math.cos(a) * 0.8, 0.1, cz + Math.sin(a) * 0.8, nc);
  // the bot (a Lancer-type hull facing out): tracks, skirts with their light strips, a wedge hull with the top plates
  // off over a glowing core, a sensor strip in the nose
  const by = 0.14;
  for (const s of [-1, 1]) {
    box(0.22, 0.26, 1.15, T.black, cx + s * 0.44, by, cz - 0.02, { dirt: 0 });
    slab([[cx + s * 0.34, cz - 0.6], [cx + s * 0.56, cz - 0.6], [cx + s * 0.56, cz + 0.42], [cx + s * 0.46, cz + 0.55], [cx + s * 0.34, cz + 0.55]], by + 0.24, 0.12, T.armor, { bevel: 0.03, dirt: 0 });
    line([cx + s * 0.47, by + 0.37, cz - 0.52], [cx + s * 0.47, by + 0.37, cz + 0.44], T.glowHi, 0.035);
  }
  slab([[cx, cz + 0.72], [cx + 0.34, cz + 0.4], [cx + 0.34, cz - 0.58], [cx - 0.34, cz - 0.58], [cx - 0.34, cz + 0.4]], by + 0.12, 0.3, T.armor, { bevel: 0.04, dirt: 0 });
  line([cx - 0.12, by + 0.43, cz + 0.5], [cx + 0.12, by + 0.43, cz + 0.5], T.glowHi, 0.04);
  // the turret, not yet plated: an open frame over a glowing core, with the railgun already mounted
  slab(chamf(0.5, 0.52, cx, cz - 0.2, 0.1), by + 0.42, 0.14, T.armorL, { bevel: 0.03, dirt: 0 });
  box(0.3, 0.04, 0.3, T.black, cx, by + 0.56, cz - 0.24, nc);
  sphere(0.09, T.glowHi, cx, by + 0.58, cz - 0.24, { cast: false });
  for (const s of [-1, 1]) box(0.04, 0.05, 0.95, T.armorL, cx + s * 0.06, by + 0.5, cz + 0.45, { dirt: 0 });
  for (const z of [cz + 0.32, cz + 0.52, cz + 0.72]) box(0.2, 0.08, 0.035, T.glow, cx, by + 0.48, z, nc);
  // the arms, each on an armoured base, a glowing ring at the shoulder, white weld sparks at the tool tips
  for (const s of [-1, 1]) {
    const ax = cx + s * 1.32, az = cz - 0.35, sh = [ax, 0.62, az], el = [ax + s * 0.02, 1.42, az + 0.12], tip = [cx + s * 0.3, by + 0.62, cz + 0.02];
    cbox(0.52, 0.16, 0.52, T.armorD, ax, 0.0, az, 0.13);
    cyl(0.17, 0.46, T.armor, ax, 0.16, az, { seg: 8, dirt: 0 });
    L.hoop(0.18, 0.028, T.glow, ax, 0.4, az);
    beam(sh, el, 0.18, 0.2, T.armorL);
    beam(el, tip, 0.14, 0.14, T.armorL);
    beam([sh[0], sh[1], sh[2] + 0.11], [el[0], el[1], el[2] + 0.11], 0.035, 0.035, T.glow, nc);
    sphere(0.14, T.armorD, ...sh); sphere(0.12, T.armorD, ...el);
    sphere(0.055, T.glow, el[0], el[1] + 0.02, el[2] + 0.12, { cast: false });
    sphere(0.07, T.white, ...tip, { cast: false });
    pointLight('#e8fbff', 2.5, tip[0], tip[1] + 0.15, tip[2] + 0.2, 1.6);
  }

  // ---- launch lane: a dark armoured strip from the cradle to the pad edge, light rails and chevrons
  const lz0 = zf + 0.2, lz1 = 4.15;
  box(2.1, 0.03, lz1 - lz0, T.armorD, hx, 0, (lz0 + lz1) / 2, { dirt: 0.2, cast: false });
  for (const s of [-1, 1]) box(0.06, 0.02, lz1 - lz0 - 0.1, T.glow, hx + s * 0.95, 0.03, (lz0 + lz1) / 2, nc);
  for (const z of [cz + 1.15, cz + 1.65]) for (const s of [-1, 1])
    beam([hx + s * 0.5, 0.045, z - 0.18], [hx, 0.045, z + 0.14], 0.08, 0.02, T.glow, nc);

  // ---- apron, left: a charging pylon with its glowing hex pad and a power cable back to the hall
  const px = -3.55, pz = 2.9;
  ao(px, pz, 0.7, 0.7, 0.45);
  cbox(0.58, 1.45, 0.58, T.armor, px, 0, pz, 0.12);
  cbox(0.66, 0.16, 0.66, T.armorL, px, 1.45, pz, 0.14);
  box(0.08, 0.95, 0.03, T.glowHi, px, 0.3, pz + 0.295, nc);
  box(0.16, 0.08, 0.16, T.white, px, 1.61, pz, nc);
  const hex = []; for (let k = 0; k < 6; k++) hex.push([-2.55 + Math.cos(k * Math.PI / 3) * 0.48, pz + Math.sin(k * Math.PI / 3) * 0.48]);
  slab(hex, 0, 0.05, T.armorD, { bevel: 0.02, dirt: 0, cast: false });
  T.edges(hex.map(([x, z]) => [-2.55 + (x + 2.55) * 0.86, pz + (z - pz) * 0.86]), 0.055, 0.045, T.glow);
  cyl(0.22, 0.012, floorPane, -2.55, 0.05, pz, { seg: 6, dirt: 0, cast: false });
  beam([px + 0.29, 0.05, pz], [-3.0, 0.05, pz], 0.07, 0.05, T.black, nc);

  // ---- apron, right: armoured parts bins with glowing seams
  for (const [x, z, y] of [[2.55, 2.85, 0], [3.4, 2.85, 0], [2.97, 2.85, 0.7]]) {
    cbox(0.74, 0.68, 0.7, T.armor, x, y, z, 0.07, { dirt: y ? 0.2 : 0.5 });
    box(0.6, 0.04, 0.02, T.glowSoft, x, y + 0.42, z + 0.355, nc);
    T.outline(0.72, 0.68, x, y + 0.66, z, 0.035, T.glow);
  }
  ao(2.97, 2.85, 1.7, 0.75, 0.45);
}
