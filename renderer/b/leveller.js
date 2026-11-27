// The Leveller (Terraforming stage 5, the owner's pick: concept A, "Bucket Wheel"): a giant bucket-wheel excavator on
// its turntable and four track units, the boom reaching out over the pad's north edge to bite the hill; the spoil rides
// the boom's belt back over the house and out along a discharge boom to a stacker over the Stone heap, and the STONE
// hopper on the front edge where Haulers load. 3 x 3 (30 x 30 units), framed like the Deep Core; the wheel overhangs
// the pad to the north. Team colour on the house's band and the hopper's rim; cut-stone tan (the accent) on the
// hopper's label and the cut-plan board.
//   (plain)          the building without its moving parts (the game draws the work frame over it, still when it stops)
//   part=work&f=k    only the moving parts, frame k of 4: the wheel turned a tenth of a turn (ten buckets: the loop
//                    closes), the belts' load run on, the tracks' pads, the dust at the wheel (renderer/b/worklib.js)
//   face=1           a rock face at the wheel (a hero shot); site=1|2 build stages
// Marks: 'beacon', 'wheel'.
import { setup, gameTextures, puffs, site, rock, spin, rot } from './t5kit.js';
import { workLayer, hideParts } from './worklib.js';
const Q = new URLSearchParams(location.search);
const F = +(Q.get('f') || 0), SITE = +(Q.get('site') || 0), FACE = Q.get('face') === '1', WORK = Q.get('part') === 'work';
const PI = Math.PI;
export const config = { pad: false };

export default async function (L) {
  const { box, cyl, beam, sphere, hoop, hcyl, mesh, group, mark, ao, pointLight, pipe, M, THREE } = L;
  L.seed(5404);
  const { T, dark, NB } = setup(L), G = await gameTextures(L);
  ao(0, 0, 28, 28, 0.3);
  const ore = M.rough('#9a8d80'), oreD = M.rough('#7b6f64');
  // the crawler: four track units under a frame
  const MX = 4.5, MZ = -1, ANG = 1.3, from = L.getRoot().children.length, mov = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = MX + sx * 5.2, z = MZ + sz * 4.4;
    box(3.2, 1.8, 6.2, T.dark, x, 0, z, { dirt: 0.6 });
    for (let k = 0; k < 9; k++) mov[mov.length] = box(3.24, 0.12, 0.22, T.greyD, x, 1.8, z - 2.9 + k * 0.72 + (F % 2) * 0.36, { dirt: 0 });
    box(1.6, 1.4, 1.6, T.yellowD, x, 1.8, z, { dirt: 0.3 });
  }
  box(13, 1.2, 11, T.yellowD, MX, 3.2, MZ, { dirt: 0.4 });
  cyl(5.2, 1.0, T.greyD, MX, 4.4, MZ, { seg: 40 });
  // the house: machinery deck, the operator's cab looking up the boom, the team band
  const HY = 5.4;
  box(9.5, 4.2, 7.5, T.yellow, MX + 1.0, HY, MZ + 1.2, { dirt: 0.4, dirtH: 4 });
  box(9.7, 0.3, 7.7, T.greyD, MX + 1.0, HY + 4.2, MZ + 1.2, { dirt: 0 });
  box(9.54, 0.36, 7.54, T.team, MX + 1.0, HY + 3.4, MZ + 1.2, T.nc);
  box(6.4, 0.6, 0.05, T.amber, MX + 1.0, HY + 2.2, MZ + 4.97, T.nc);
  box(2.4, 2.0, 2.2, T.yellowD, MX - 3.2, HY + 4.5, MZ - 1.8, { dirt: 0.2 });
  box(2.2, 1.0, 0.05, M.glass('#8fc8e8', 0.65), MX - 3.2, HY + 5.3, MZ - 2.92, { cast: false });
  // the boom: two lattice chords, from the house out over the north edge
  const B0 = [MX, HY + 4.0, MZ - 2.4], B1 = [MX, HY + 7.0, MZ - 13.5];
  for (const s of [-1.1, 1.1]) for (const dy of [0, 1.8]) beam([B0[0] + s, B0[1] + dy, B0[2]], [B1[0] + s * 0.8, B1[1] + dy * 0.6, B1[2]], 0.34, 0.34, T.yellow, { dirt: 0 });
  for (let k = 0; k <= 10; k++) {
    const t = k / 10, p = (s, dy) => [B0[0] + s * (1.1 - 0.3 * t), B0[1] + (B1[1] - B0[1]) * t + dy * (1 - 0.4 * t), B0[2] + (B1[2] - B0[2]) * t];
    beam(p(-1, 0), p(1, 1.8), 0.14, 0.14, T.yellowD, { dirt: 0 }); beam(p(1, 0), p(-1, 1.8), 0.14, 0.14, T.yellowD, { dirt: 0 });
  }
  // the belt along the boom, running
  beam([B0[0], B0[1] + 0.6, B0[2]], [B1[0], B1[1] + 0.4, B1[2] + 1.5], 1.2, 0.2, T.belt, { dirt: 0 });
  for (let k = 0; k < 10; k++) { const t = (k + F / 4) / 10; mov[mov.length] = box(0.6, 0.35, 0.6, ore, B0[0] + (Math.sin(k * 3) * 0.2), B0[1] + 0.75 + (B1[1] - B0[1]) * (1 - t), B0[2] + (B1[2] + 1.5 - B0[2]) * (1 - t), { dirt: 0.2, ry: k }); }
  // the counter-boom and its weight, raking back over the south
  beam([MX + 1, HY + 4.2, MZ + 4.4], [MX + 1, HY + 9.5, MZ + 11], 0.5, 0.5, T.yellow, { dirt: 0 });
  beam([MX, HY + 4.2, MZ - 2.4], [MX + 1, HY + 11.5, MZ + 2], 0.4, 0.4, T.yellowD, { dirt: 0 });
  beam([MX + 1, HY + 11.5, MZ + 2], [MX + 1, HY + 9.5, MZ + 11], 0.14, 0.14, T.rope, { dirt: 0 });
  beam([MX + 1, HY + 11.5, MZ + 2], [B1[0], B1[1] + 1.8, B1[2] + 3], 0.12, 0.12, T.rope, { dirt: 0 });
  box(4.2, 3.0, 3.0, T.greyD, MX + 1, HY + 7.6, MZ + 11.2, { dirt: 0.2 });
  sphere(0.25, T.beacon, MX + 1, HY + 11.8, MZ + 2, { cast: false }); mark('beacon', MX + 1, HY + 11.8, MZ + 2);
  // the wheel, turning about the x axis at the boom's tip: ten buckets with teeth
  {
    const WX = B1[0] + 2.2, WY = B1[1] - 0.5, WZ = B1[2] - 1.0, WR = 5.4;
    const wg = group(WX, WY, WZ); mov.push(wg); wg.rotation.x = -F * (PI / 5) / 4;
    const rimG = new THREE.TorusGeometry(WR, 0.32, 10, 48); rimG.rotateY(PI / 2); mesh(rimG, T.yellow, 0, 0, 0, { parent: wg, dirt: 0 });
    const rim2 = new THREE.TorusGeometry(WR - 0.9, 0.16, 8, 48); rim2.rotateY(PI / 2); mesh(rim2, T.yellowD, 0, 0, 0, { parent: wg, dirt: 0 });
    for (let k = 0; k < 10; k++) {
      const a = k * PI / 5, bg = group(0, Math.sin(a) * WR, Math.cos(a) * WR, 0, wg); bg.rotation.x = -a;
      box(1.6, 1.3, 1.4, T.greyD, 0, -0.2, 0.3, { parent: bg, dirt: 0.3 });
      box(1.62, 0.3, 0.4, T.steel, 0, 1.1, 0.8, { parent: bg, dirt: 0 });
      const sp = new THREE.BoxGeometry(0.22, WR * 2 - 0.4, 0.22); mesh(sp, T.yellowD, 0, 0, 0, { parent: wg, rx: a, dirt: 0 });
    }
    hcyl(0.8, 1.4, T.greyD, WX, WY, WZ, { axis: 'x' });
    hcyl(0.5, 2.6, T.steel, WX - 1.2, WY, WZ, { axis: 'x' });
    mark('wheel', WX, WY, WZ);
    if (!SITE) mov.push(...puffs(L, G.mist, WX, WY - 3.2, WZ - 2, 3, F, 1.0, 1.3, 0.8));
    if (FACE) {
      // the hill's face the wheel bites into
      rock(L, 26, 9, 12, T.spoil, MX, -0.6, MZ - 30, 3, 0.16);
      rock(L, 12, 7, 4, T.spoilD, WX, -0.6, WZ - 5.2, 5, 0.25);
    }
  }
  spin(L, from, MX, MZ, ANG);
  // the discharge boom east, a stacker over the Stone yard, the STONE hopper
  {
    const dr = rot(MX + 5.6, MZ + 1.2, MX, MZ, ANG), D0 = [dr[0], HY + 3.0, dr[1]], D1 = [10.5, 9.2, 8.5];
    beam(D0, D1, 1.0, 0.8, T.yellowD, { dirt: 0 });
    beam([D0[0], D0[1] + 0.5, D0[2]], [D1[0], D1[1] + 0.5, D1[2]], 1.1, 0.12, T.belt, { dirt: 0 });
    for (let k = 0; k < 6; k++) { const t = (k + F / 4) / 6; mov[mov.length] = box(0.5, 0.3, 0.5, ore, D0[0] + (D1[0] - D0[0]) * t, D0[1] + 0.7 + (D1[1] - D0[1]) * t, D0[2] + (D1[2] - D0[2]) * t, { dirt: 0.2, ry: k }); }
    box(0.5, 9.2, 0.5, T.greyD, D1[0], 0, D1[2] - 0.6, { dirt: 0 });
    // the heap of broken stone under it
    const cone = new THREE.ConeGeometry(4.6, 4.2, 22, 3); cone.translate(0, 2.1, 0);
    const p = cone.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05 && y < 4.1) { p.setX(i, p.getX(i) * (0.88 + 0.24 * Math.abs(Math.sin(i * 7.1)))); p.setZ(i, p.getZ(i) * (0.88 + 0.24 * Math.abs(Math.cos(i * 3.3)))); } }
    cone.computeVertexNormals(); mesh(cone, ore, 10.8, 0, 9.4, { dirt: 0.4, dirtH: 4 });
    for (let k = 0; k < 5; k++) mov[mov.length] = box(0.6, 0.5, 0.6, oreD, 10.8 + Math.sin(k * 1.9 + F) * 0.6, 4.4 - k * 0.75, 9.0 + Math.cos(k) * 0.3, { dirt: 0.2, ry: k });
    // the STONE hopper on the front edge, where Haulers load
    const hx = 3.5, hz = 12;
    for (const dx of [-1.3, 1.3]) for (const dz of [-1.0, 1.0]) box(0.24, 2.4, 0.24, T.grey, hx + dx, 0, hz + dz, { dirt: 0.3 });
    const f = new THREE.CylinderGeometry(2.05, 0.7, 2.2, 4, 1); f.rotateY(PI / 4); f.scale(1, 1, 0.86); f.translate(hx, 3.5, hz); mesh(f, M.paint('#8a8178', { rivets: false, rough: 0.6 }), 0, 0, 0, { dirt: 0.4, dirtH: 2.2 });
    box(2.95, 0.2, 2.55, T.team, hx, 4.5, hz, T.nc);
    const tex = L.canvasTex(256, (g, n) => { g.fillStyle = '#8a8178'; g.fillRect(0, 0, n, n); g.fillStyle = '#f2eee4'; g.font = 'bold 76px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STONE', n / 2, n / 2 + 6); g.strokeStyle = L.ACCENT; g.lineWidth = 10; g.strokeRect(12, 12, n - 24, n - 24); });
    const pl = new THREE.PlaneGeometry(1.9, 1.3); pl.rotateX(-0.42); mesh(pl, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), hx, 3.35, hz + 1.06, T.nc);
    beam([8.2, 1.2, 9.4], [hx + 1.4, 4.6, hz - 0.6], 0.8, 0.3, T.greyD, { dirt: 0 });
    box(0.36, 0.36, 0.1, T.acc, hx, 2.0, hz + 1.2, T.nc);
  }
  // a control cabin front left with the cut plan on its board (accent)
  {
    const hx = -10.5, hz = 11.5;
    box(6.4, 3.2, 4.2, T.white, hx, 0, hz, { dirt: 0.5, dirtH: 3.2 });
    box(6.6, 0.22, 4.4, T.concL, hx, 3.2, hz, { dirt: 0.2 });
    box(6.44, 0.3, 4.24, T.team, hx, 2.7, hz, T.nc);
    box(5, 0.7, 0.05, T.amber, hx, 1.6, hz + 2.13, T.nc);
    box(2.8, 1.4, 0.14, T.greyD, hx, 4.0, hz - 0.6, { dirt: 0 }); box(2.5, 1.1, 0.05, T.acc, hx, 4.15, hz - 0.52, T.nc);
  }
  for (const [x, z, ry] of [[-14, -14, 0.8], [14, -14, -0.8], [14, 4, -1.8]]) {
    cyl(0.12, 5.5, T.greyD, x, 0, z, { seg: 10 }); box(0.8, 0.5, 0.4, T.greyD, x, 5.5, z, { ry }); box(0.6, 0.36, 0.06, T.flood, x + Math.sin(ry) * 0.22, 5.57, z + Math.cos(ry) * 0.22, { ...T.nc, ry });
    if (dark) pointLight('#eef4ff', 5 * NB, x + Math.sin(ry) * 3, 4, z + Math.cos(ry) * 3, 9);
  }
  if (dark) { const wr = rot(B1[0], B1[2] + 2, MX, MZ, ANG); pointLight('#eef4ff', 6 * NB, wr[0], B1[1] - 2, wr[1], 10); pointLight('#ffb347', 3 * NB, MX + 1, HY + 2, MZ + 7, 8); }
  if (!SITE) { if (WORK) workLayer(L, new Set(mov)); else hideParts(mov); }
  site(L, T, SITE, { cut2: 7.5, scaf: [[MX, MZ, 14, 12, 10]], craneAt: [11, 9, 4, -1, 20, 1.0] });
}
