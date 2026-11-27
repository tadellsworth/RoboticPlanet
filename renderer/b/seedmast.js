// The Seed Mast (BDEFS.seedmast; the owner's pick from the stage 3 concept canvas, concept B "Charge Mast"): Ring
// Crystal grows on charge, so this seeder feeds it. A slim mast with three emitter rings stands in a round bed; seed
// pins with grown Crystal stand round it, a capacitor bank and a transformer charge it. The Crystal Seedbed it grows
// on the tiles round it is tile art of its own (seedbed.js).
//   ?f=k            which ring is lit (k of 8: rings in turn, low to high, with arcs to the pins under it)
//   ?part=work&f=k  only the rings, the pin caps and the arcs (seedmast-work-0..7)
// Team-coloured (the power kit's strips): render one image per team. Marks: top (the mast's cap lamp).
import { power } from './powerkit.js';
import { t3 } from './t3kit.js';
import { workLayer } from './worklib.js';
export default function (L) {
  const { box, cyl, beam, hoop, pointLight, ao, sphere, M, ACCENT, THREE } = L;
  const part = new URLSearchParams(location.search).get('part');
  const K3 = t3(L), { gun, gunD, off, f, sprig } = K3;
  L.seed(4410);
  const nc = { dirt: 0, cast: false };
  const moving = new Set();
  const keep = (o) => { moving.add(o); return o; };
  const CX = -0.6, CZ = 0.2, RB = 3.3;
  // round bed: concrete curb, dark prepared ground, raked rings
  cyl(RB + 0.25, 0.2, M.rough('#8f887c'), CX, 0, CZ, { seg: 56, dirt: 0.4 });
  cyl(RB, 0.04, M.rough('#2c2530'), CX, 0.18, CZ, { seg: 56, ...nc });
  for (const r of [1.2, 1.9, 2.6]) hoop(r, 0.025, M.rough('#3d3440'), CX, 0.23, CZ, nc);
  // seed pins and sprigs on three rings, older outward; the ring of pins under the lit emitter lit with it
  const pin = M.paint('#8a9096', { rivets: false });
  const lit = f % 4 < 3 ? f % 4 : -1; // (three rings in turn, then a beat with all of them low)
  for (const [ri, r, n, s] of [[0, 1.3, 8, 0.35], [1, 2.0, 12, 0.6], [2, 2.75, 16, 0.92]]) for (let k = 0; k < n; k++) {
    const a = k / n * 6.28 + ri * 0.2, x = CX + Math.cos(a) * r, z = CZ + Math.sin(a) * r;
    cyl(0.03, 0.2, pin, x, 0.22, z, { seg: 6, dirt: 0 });
    keep(sphere(0.045, M.emit(ACCENT, ri === lit ? 3.2 : 1.2), x, 0.44, z, nc));
    sprig(x + Math.cos(a) * 0.2, z + Math.sin(a) * 0.2, Math.min(1, s * (0.85 + L.rnd() * 0.3)), 0.22);
  }
  // the mast: tapering steel tube on a plinth, three emitter rings (the lit one bright), guy wires, a cap lamp
  box(1.1, 0.5, 1.1, M.rough('#857d71'), CX, 0.2, CZ, { dirt: 0.5 });
  cyl(0.22, 7.0, gunD, CX, 0.7, CZ, { rTop: 0.1, seg: 16 });
  for (let k = 0; k < 3; k++) {
    const y = 2.4 + k * 1.6, on = k === lit;
    cyl(0.62 - k * 0.1, 0.12, gun, CX, y - 0.06, CZ, { seg: 24 });
    keep(hoop(0.58 - k * 0.1, 0.07, M.emit(ACCENT, on ? 3.4 : 1.0), CX, y + 0.08, CZ, nc));
    if (on) pointLight(ACCENT, 6, CX, y, CZ + 0.6, 4);
  }
  sphere(0.12, K3.night ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4), CX, 7.8, CZ, nc);
  L.mark('top', CX, 7.8, CZ);
  for (const a of [0.6, 2.7, 4.8]) beam([CX, 6.2, CZ], [CX + Math.cos(a) * 3.6, 0.2, CZ + Math.sin(a) * 3.6], 0.025, 0.025, M.plain('#30302e', 0.5, 0.6), nc);
  // arcs from the lit ring down to a few pins on its ring of pins (added to the loop)
  const K = power(L);
  if (lit >= 0) {
    const before = new Set(L.getRoot().children), rr = [1.3, 2.0, 2.75][lit];
    for (const a of [0.9, 2.6, 4.4]) K.arc([CX + Math.cos(a) * 0.5, 2.4 + lit * 1.6, CZ + Math.sin(a) * 0.5], [CX + Math.cos(a) * rr, 0.46, CZ + Math.sin(a) * rr], 6, a + lit + f);
    for (const o of L.getRoot().children) if (!before.has(o)) moving.add(o);
  }
  // capacitor bank (right) and transformer (right back), cable trench to the plinth
  const bx = 3.6, bz = 1.4;
  for (const dz of [-0.7, 0.7]) { box(1.2, 1.3, 1.0, gun, bx, 0, bz + dz); box(0.8, 0.14, 0.04, M.emit(ACCENT, 2.0), bx, 0.9, bz + dz + 0.51, nc); }
  box(1.4, 0.12, 2.6, off, bx, 1.3, bz, { dirt: 0 }); ao(bx, bz, 1.4, 2.6, 0.5);
  K.transformer(3.7, -2.3, 0);
  box(4.0, 0.04, 0.3, M.dark, (CX + bx) / 2 + 0.2, 0.01, bz - 0.9, nc);
  K.conduit([[bx - 0.6, 0.14, bz - 0.9], [CX + 0.6, 0.14, bz - 0.9], [CX + 0.6, 0.14, CZ + 0.4]], 0.05);
  // small seed-stock kiosk (back left)
  box(1.4, 1.5, 1.1, off, -3.6, 0, -3.5, { dirtH: 1 }); box(1.5, 0.12, 1.2, gunD, -3.6, 1.5, -3.5, { dirt: 0 });
  if (part === 'work') { workLayer(L, moving); return; }
  // power layer
  K.strip(1.4, bx, 1.44, bz - 1.31, 0); K.strip(1.4, -3.6, 1.38, -2.93);
  K.flood(4.5, -0.6, 2.3, -0.6); K.flood(-4.4, 3.8, 2.3, 0.4);
  K.junction(2.3, -3.8, 0); K.beacon(-3.2, 1.75, -3.8);
  void THREE;
}
