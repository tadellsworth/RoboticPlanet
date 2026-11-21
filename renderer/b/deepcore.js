// The Deep Core (IDEAS.md "Megastructures", the owner's look A from the design sheet, "Headframe", Nov 21 2026): a 3 x 3
// megastructure (30 x 30 world units, the middle of its nine tiles at the origin), rendered on one wide frame like the
// Lance and the Lift (the pad's 30 units across 0.62 of it).
//   A red steel winding tower over the shaft, like an old colliery headframe: four lattice legs braced in X's rising
//   from a concrete shaft collar to a sheave deck, two raking back legs down to the winding house, two spoked winding
//   wheels side by side at the top (the game turns them: part=work), a floodlight on each side of the deck aimed at
//   them and a red beacon. The shaft: a dark square hole in the collar with its cage guides (the game adds the violet
//   glow rising out of it as it goes deeper). The winding house to the east, its rope port facing the wheels, a team
//   band under its eaves and a lit window band at night; the ropes from the wheels' tops to its drum. A skip bin on
//   the tower, a covered conveyor down to three hoppers along the south edge (ORE, CRY, U: rust, violet, green, team
//   rims) where Haulers load, and the depth gauge beside them: a grey cabinet with three lamp sockets (the game lights
//   them, one per stage). A spoil heap of broken rock in the north-west corner.
//   ?part=work&f=k   only the two wheels, turned frame k of 8 through 60 degrees (six spokes: the loop closes), the
//                    left one way and the right the other; every other surface depth only. Not team-coloured.
//   (the plain render, part=base, has no wheels: the game draws the work frame over it, still when it stops)
// Marks: 'shaft' (the middle of the shaft's mouth, where the game's violet glow rises), 'wheelL' and 'wheelR' (their
// hubs), 'g1', 'g2', 'g3' (the gauge's lamps, bottom to top), 'beacon'.
import { workLayer, hideParts } from './worklib.js';
const Q = new URLSearchParams(location.search);
const WORK = Q.get('part') === 'work', F = +(Q.get('f') || 0);
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, hcyl, sphere, mesh, group, mark, ao, pointLight, beam, pipe, M, THREE } = L;
  L.seed(6170);
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.6 });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#a39b8e'), concD: M.rough('#857d71'), concL: M.rough('#b8b0a2'),
    red: M.paint('#a8342a', { rivets: false, rough: 0.6, metal: 0.35 }), redD: M.paint('#7e2620', { rivets: false, rough: 0.6, metal: 0.35 }),
    steel: M.steel, dark: M.dark, white: M.paint('#d9d6cf', { rivets: false }), grey: M.paint('#5b6168', { metal: 0.4 }),
    greyD: M.paint('#41464c', { rivets: false, metal: 0.5 }), roof: M.plain('#4f5356', 0.85, 0.2), belt: M.plain('#24262a', 0.9, 0),
    rope: M.plain('#30302e', 0.5, 0.6), team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }), hole: M.plain('#07060a', 1, 0),
    spoil: M.rough('#6d6256'), spoilD: M.rough('#54493f'), nc: { dirt: 0, cast: false },
  };
  const flood = dark ? M.emit('#f4f8ff', 3.2) : M.plain('#cfd6dc', 0.3, 0.3);
  const red = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  const amber = dark ? M.emit('#ffb347', 1.8) : M.plain('#3b4652', 0.2, 0.3);

  ao(0, 0, 28, 28, 0.35);
  // ---- the shaft collar: a raised concrete square round a dark hole, its cage guides going down
  const SX = -2.4, SZ = -2.2, CH = 0.9, TOP = 19.2;
  box(8.2, CH, 8.2, T.concD, SX, 0, SZ, { dirt: 0.6, dirtH: 0.9 });
  box(8.4, 0.14, 8.4, T.concL, SX, CH, SZ, { dirt: 0.3 });
  box(3.6, 0.02, 3.6, M.hazard, SX, CH + 0.14, SZ, T.nc);
  box(3.0, 0.03, 3.0, T.hole, SX, CH + 0.15, SZ, T.nc);
  for (const dx of [-0.8, 0.8]) for (const dz of [-1.2, 1.2]) box(0.12, 2.4, 0.12, T.steel, SX + dx, CH - 0.2, SZ + dz, { dirt: 0 });
  mark('shaft', SX, CH + 0.2, SZ);
  // ---- the headframe: four lattice legs from the collar to the sheave deck, braced in X's, a team fascia on the deck
  const B0 = 3.4, B1 = 1.9, legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  const at = (sx, sz, y) => { const k = y / TOP, b = B0 + (B1 - B0) * k; return [SX + sx * b, CH + y, SZ + sz * b]; };
  for (const [sx, sz] of legs) beam(at(sx, sz, 0), at(sx, sz, TOP), 0.42, 0.42, T.red, { dirt: 0 });
  const tiers = [0, 3.4, 6.8, 10.2, 13.4, 16.4, TOP];
  for (let k = 0; k < tiers.length - 1; k++) {
    const y0 = tiers[k], y1 = tiers[k + 1];
    for (const [a, b] of [[[-1, -1], [1, -1]], [[-1, 1], [1, 1]], [[-1, -1], [-1, 1]], [[1, -1], [1, 1]]]) {
      beam(at(a[0], a[1], y1), at(b[0], b[1], y1), 0.22, 0.22, T.redD, { dirt: 0 });
      beam(at(a[0], a[1], y0), at(b[0], b[1], y1), 0.14, 0.14, T.red, { dirt: 0 });
      beam(at(b[0], b[1], y0), at(a[0], a[1], y1), 0.14, 0.14, T.red, { dirt: 0 });
    }
  }
  // the sheave deck: a grating platform, its fascia in the team colour, a railing
  const DY = CH + TOP;
  box(9.4, 0.3, 4.6, T.greyD, SX, DY, SZ, { dirt: 0.2 });
  box(9.5, 0.36, 0.08, T.team, SX, DY - 0.02, SZ + 2.32, T.nc);
  box(9.5, 0.36, 0.08, T.team, SX, DY - 0.02, SZ - 2.32, T.nc);
  L.railing([[SX - 4.6, SZ + 2.2], [SX + 4.6, SZ + 2.2], [SX + 4.6, SZ - 2.2], [SX - 4.6, SZ - 2.2], [SX - 4.6, SZ + 2.2]], DY + 0.3, { h: 0.7, spacing: 1.1, mat: T.redD });
  for (const s of [-1, 1]) for (const dz of [-2.1, 2.1]) beam(at(s, Math.sign(dz), TOP - 2.6), [SX + s * 4.4, DY, SZ + dz], 0.2, 0.2, T.redD, { dirt: 0 });
  // two raking back legs, from the deck down to beside the winding house
  for (const dz of [-1.7, 1.7]) {
    beam([SX + 2.6, DY - 0.4, SZ + dz], [7.2, 0.2, SZ + dz * 1.3], 0.38, 0.38, T.red, { dirt: 0 });
    box(1.0, 0.5, 1.0, T.concD, 7.2, 0, SZ + dz * 1.3, { dirt: 0.5 });
  }
  for (const y of [5, 10, 14.5]) { const f = (DY - 0.4 - y) / (DY - 0.6); const x = SX + 2.6 + (7.2 - SX - 2.6) * (1 - f); beam([x, y, SZ - 2.2], [x, y, SZ + 2.2], 0.16, 0.16, T.redD, { dirt: 0 }); }
  // the bearings the wheels turn in, and the wheels (moving parts: the game turns them)
  const WY = DY + 2.35, WR = 2.05, wheelX = [SX - 2.3, SX + 2.3], wheels = [];
  for (const [n, wx] of wheelX.entries()) {
    for (const dz of [-0.55, 0.55]) { box(0.3, 2.2, 0.3, T.greyD, wx, DY + 0.3, SZ + dz, { dirt: 0.1 }); }
    const g = group(wx, WY, SZ); wheels.push(g);
    const dir = n === 0 ? 1 : -1, ang = dir * (F / 8) * (PI / 3);
    const rim = new THREE.TorusGeometry(WR, 0.17, 10, 48); mesh(rim, T.red, 0, 0, 0, { parent: g, dirt: 0 });
    const rim2 = new THREE.TorusGeometry(WR - 0.22, 0.07, 8, 48); mesh(rim2, T.redD, 0, 0, 0.12, { parent: g, dirt: 0 });
    for (let k = 0; k < 6; k++) {
      const a = ang + k * PI / 3, sp = new THREE.BoxGeometry(0.16, WR * 2 - 0.3, 0.14);
      mesh(sp, T.redD, 0, 0, 0.02, { parent: g, rz: a, dirt: 0 });
    }
    const hub = new THREE.CylinderGeometry(0.34, 0.34, 0.6, 20); hub.rotateX(PI / 2); mesh(hub, T.greyD, 0, 0, 0, { parent: g, dirt: 0 });
    const cap = new THREE.CylinderGeometry(0.16, 0.16, 0.66, 12); cap.rotateX(PI / 2); mesh(cap, T.steel, 0, 0, 0, { parent: g, dirt: 0 });
    // (a bright tab on the rim, so the turning reads at a distance)
    const tab = new THREE.BoxGeometry(0.34, 0.2, 0.4); tab.translate(0, WR, 0); mesh(tab, M.paint('#e6e2d6', { rivets: false }), 0, 0, 0, { parent: g, rz: ang, dirt: 0 });
    mark(n === 0 ? 'wheelL' : 'wheelR', wx, WY, SZ);
  }
  // the ropes: down from each wheel's inner side into the shaft, and from its top to the winding house's drum
  const HX = 9.0, HZ = -6.4, DRY = 3.6;
  for (const [n, wx] of wheelX.entries()) {
    const ix = wx + (n === 0 ? WR : -WR) * 0.98;
    beam([ix, WY, SZ + 0.1], [ix, CH + 0.3, SZ + 0.1], 0.07, 0.07, T.rope, { dirt: 0 });
    beam([wx + 0.2, WY + WR - 0.02, SZ - 0.1], [HX - 3.4, DRY + 0.2 + n * 0.5, HZ + 1.6], 0.07, 0.07, T.rope, { dirt: 0 });
  }
  // floodlights on the deck aimed up at the wheels, and the red beacon on top
  for (const s of [-1, 1]) {
    const g = group(SX + s * 4.5, DY + 0.3, SZ + 2.0, 0);
    box(0.14, 1.4, 0.14, T.greyD, 0, 0, 0, { parent: g });
    const h = group(0, 1.4, 0, 0, g); h.rotation.x = -0.5; h.rotation.z = s * 0.5;
    box(0.7, 0.5, 0.36, T.greyD, 0, 0, 0, { parent: h }); box(0.56, 0.38, 0.04, flood, 0, 0.06, 0.2, { parent: h, cast: false, dirt: 0 });
    if (dark) pointLight('#eef4ff', 6 * NB, SX + s * 2.8, DY + 1.8, SZ + 1.8, 7);
  }
  box(0.2, 1.2, 0.2, T.greyD, SX, DY + 0.3, SZ - 2.0, { dirt: 0 });
  sphere(0.2, red, SX, DY + 1.6, SZ - 2.0, { cast: false });
  mark('beacon', SX, DY + 1.6, SZ - 2.0);
  // ---- the winding house: a long shed east of the tower, its rope port toward the wheels, a team band, lit windows
  {
    box(7.2, 5.4, 7.6, T.white, HX, 0, HZ, { dirt: 0.5, dirtH: 5.4 });
    box(7.4, 0.26, 7.8, T.concL, HX, 5.4, HZ, { dirt: 0.3 });
    const roof = new THREE.CylinderGeometry(0.01, 4.4, 1.6, 4, 1); roof.rotateY(PI / 4); roof.scale(1.15, 1, 1.22); roof.translate(HX, 5.66 + 0.8, HZ); mesh(roof, T.roof, 0, 0, 0, { dirt: 0.2 });
    box(7.24, 0.34, 7.64, T.team, HX, 4.9, HZ, T.nc);
    box(1.6, 1.3, 0.3, T.dark, HX - 3.55, 3.4, HZ + 1.6, { dirt: 0 }); // (the rope port)
    for (const z of [HZ + 3.81]) box(5.4, 0.7, 0.05, amber, HX, 2.9, z, T.nc);
    box(0.05, 0.7, 5.2, amber, HX + 3.61, 2.9, HZ, T.nc);
    box(1.0, 2.0, 0.06, T.greyD, HX + 2.2, 0, HZ + 3.82, T.nc);
    cyl(0.32, 2.6, T.steel, HX + 2.4, 5.6, HZ - 2.2, { seg: 14 });
    cyl(0.4, 0.2, T.dark, HX + 2.4, 8.2, HZ - 2.2, { seg: 14 });
  }
  // ---- the skip bin on the tower, a covered conveyor down to the hoppers, and the three hoppers (ORE, CRY, U)
  {
    box(2.2, 2.0, 1.8, T.grey, SX + 2.6, 5.6, SZ + 2.6, { dirt: 0.4 });
    box(2.3, 0.2, 1.9, T.greyD, SX + 2.6, 7.6, SZ + 2.6, { dirt: 0.2 });
    const a = [SX + 2.6, 5.9, SZ + 3.4], b = [-1.6, 5.0, 8.0];
    beam(a, b, 1.2, 0.5, T.greyD, { dirt: 0 });
    beam([a[0], a[1] + 0.45, a[2]], [b[0], b[1] + 0.45, b[2]], 1.26, 0.08, T.roof, { dirt: 0 });
    for (const t of [0.35, 0.7]) { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, z = a[2] + (b[2] - a[2]) * t; box(0.22, y, 0.22, T.grey, x, 0, z, { dirt: 0.3 }); }
    beam([-7.4, 5.0, 8.0], [3.6, 5.0, 8.0], 1.0, 0.4, T.greyD, { dirt: 0 });
    beam([-7.4, 5.45, 8.0], [3.6, 5.45, 8.0], 1.06, 0.08, T.roof, { dirt: 0 });
    const goods = [['ORE', '#9c5a32', '#c8834e'], ['CRY', '#6b4ab0', '#b597ff'], ['U', '#3f7d3a', '#8fd27a']];
    for (const [k, [txt, c0, c1]] of goods.entries()) {
      const x = -6 + k * 4.4, z = 8.6;
      for (const dx of [-1.3, 1.3]) for (const dz of [-1.1, 1.1]) box(0.24, 2.4, 0.24, T.grey, x + dx, 0, z + dz, { dirt: 0.3 });
      const f = new THREE.CylinderGeometry(2.05, 0.7, 2.2, 4, 1); f.rotateY(PI / 4); f.scale(1, 1, 0.86); f.translate(x, 2.4 + 1.1, z);
      mesh(f, M.paint(c0, { rivets: false, rough: 0.6 }), 0, 0, 0, { dirt: 0.4, dirtH: 2.2 });
      box(2.95, 0.2, 2.55, T.team, x, 4.5, z, T.nc);
      // its label, facing the camera on the hopper's front
      const tex = L.canvasTex(256, (g, n) => {
        g.fillStyle = c0; g.fillRect(0, 0, n, n); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, n, 18); g.fillRect(0, n - 18, n, 18);
        g.fillStyle = '#f2eee4'; g.font = `bold ${txt.length > 1 ? 104 : 150}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, n / 2, n / 2 + 6);
        g.strokeStyle = c1; g.lineWidth = 10; g.strokeRect(12, 12, n - 24, n - 24);
      });
      const lm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.1 });
      const pl = new THREE.PlaneGeometry(1.9, 1.3); pl.rotateX(-0.42); mesh(pl, lm, x, 3.35, z + 1.06, T.nc);
      box(0.7, 0.5, 0.7, T.greyD, x, 1.9, z, { dirt: 0.2 }); // (the chute Haulers load from)
    }
  }
  // ---- the depth gauge: a grey cabinet by the hoppers with three lamp sockets (the game lights them, stage by stage)
  {
    const gx = 7.6, gz = 8.2;
    box(1.7, 3.6, 0.9, T.grey, gx, 0, gz, { dirt: 0.4, dirtH: 3.6 });
    box(1.8, 0.16, 1.0, T.greyD, gx, 3.6, gz, { dirt: 0.2 });
    box(1.72, 0.22, 0.92, T.team, gx, 3.2, gz, T.nc);
    box(1.2, 2.5, 0.04, T.dark, gx, 0.5, gz + 0.46, T.nc);
    for (let k = 0; k < 3; k++) {
      const y = 0.95 + k * 0.78;
      const geo = new THREE.CylinderGeometry(0.26, 0.26, 0.14, 18); geo.rotateX(PI / 2); mesh(geo, M.plain('#2a2630', 0.4, 0.3), gx, y, gz + 0.52, T.nc);
      mark('g' + (k + 1), gx, y, gz + 0.6);
    }
    // a cable from the gauge to the collar, along the ground
    pipe([[gx - 0.5, 0.15, gz - 0.4], [3.0, 0.15, 3.2], [SX + 4.1, 0.6, SZ + 2.4]], 0.09, T.dark);
  }
  // ---- the spoil heap: broken rock piled in the north-west corner, a few boulders rolled off it
  {
    const geo = new THREE.ConeGeometry(4.6, 3.6, 24, 4); geo.translate(0, 1.8, 0);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05 && y < 3.55) { p.setX(i, p.getX(i) * RR(0.85, 1.12)); p.setZ(i, p.getZ(i) * RR(0.85, 1.12)); p.setY(i, y + RR(-0.2, 0.2)); } }
    geo.computeVertexNormals();
    mesh(geo, T.spoil, -10.4, 0, -9.6, { dirt: 0.5, dirtH: 3.6 });
    for (let k = 0; k < 14; k++) { const a = RR(0, 2 * PI), r = RR(4.2, 6.4); box(RR(0.4, 0.9), RR(0.3, 0.6), RR(0.4, 0.8), R() < 0.5 ? T.spoil : T.spoilD, -10.4 + Math.cos(a) * r, 0, -9.6 + Math.sin(a) * r * 0.8, { ry: RR(0, PI), dirt: 0.4 }); }
  }
  // ---- small things: a fuel line from the pad's east edge to the winding house, a power cabinet, crates by the hoppers
  pipe([[14.6, 0.35, 1.6], [11.2, 0.35, 1.6], [HX + 2.0, 0.35, HZ + 4.0]], 0.2, M.paint('#b8452e', { rivets: false }));
  box(1.3, 1.7, 0.9, T.grey, 12.2, 0, -12.0, { dirt: 0.4 }); box(1.32, 0.18, 0.92, M.hazard, 12.2, 1.4, -12.0, T.nc);
  for (const [x, z] of [[9.4, 11.8], [10.6, 11.6], [10.0, 12.6]]) box(0.9, 0.7, 0.9, M.wood || T.concD, x, 0, z, { ry: RR(0, 0.4), dirt: 0.4 });
  if (dark) pointLight('#ffffff', 4 * NB, SX, CH + 3, SZ + 2, 8);

  if (WORK) workLayer(L, new Set(wheels));
  else hideParts(wheels);
}
