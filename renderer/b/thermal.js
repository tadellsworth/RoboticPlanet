// The Thermal Plant (BDEFS.thermal; the owner's pick from the stage 3 concept canvas, concept A "Cooling Tower"): a
// squat hyperbolic cooling tower, a turbine hall, and a heat well cut through the pad into the magma below (glowing
// through a grating, a wellhead and insulated steam pipes over it). Fuel-free power: no tanker point, no exhaust.
// The tower's plume is the game's own steam (the shipped smoke sheet, BUILDING_EMITTERS.thermal at the mark 'plume'),
// so it rises only while the plant runs; the scene has none.
//   ?f=k            the turbine hall's windows in turn and the wellhead's breath (k of 8)
//   ?part=work&f=k  only those (thermal-work-0..7)
// Team-coloured (the power kit's strips): render one image per team. Marks: plume (the tower's mouth), well.
import { power } from './powerkit.js';
import { t3 } from './t3kit.js';
import { workLayer } from './worklib.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, pointLight, ao, mesh, sphere, M, THREE, ACCENT } = L;
  const part = new URLSearchParams(location.search).get('part');
  const K3 = t3(L), { gun, gunD, f } = K3;
  L.seed(6601);
  const nc = { dirt: 0, cast: false };
  const moving = new Set();
  const keep = (o) => { moving.add(o); return o; };
  const insul = M.paint('#b9bcbf', { rivets: false, rough: 0.4, metal: 0.6 });
  // the heat well (front left): a pit in the pad showing magma under a grating, a basalt rim
  const WX = -2.6, WZ = 2.0;
  box(2.8, 0.06, 2.2, M.plain('#120806', 1), WX, -0.02, WZ, nc);
  K3.lava(WX, WZ, 2.5, 1.9);
  K3.rocks(WX - 1.3, WZ - 1.05, WX + 1.3, WZ - 1.05, 7, 0.32); K3.rocks(WX - 1.4, WZ - 0.9, WX - 1.4, WZ + 1.0, 5, 0.3);
  box(2.2, 0.05, 1.6, M.grating, WX + 0.1, 0.35, WZ + 0.05, { dirt: 0 });
  for (const [dx, dz] of [[-1.0, -0.7], [1.2, -0.7], [-1.0, 0.85], [1.2, 0.85]]) box(0.14, 0.35, 0.14, gunD, WX + dx, 0, WZ + dz);
  pointLight('#ff6a1a', 8, WX, 0.6, WZ, 4.5);
  L.mark('well', WX, 0.4, WZ);
  // wellhead on the grating: a valve tree with red wheels, steam breathing round it
  cyl(0.28, 0.7, insul, WX, 0.4, WZ, { seg: 16 }); cyl(0.38, 0.12, gunD, WX, 1.1, WZ, { seg: 16 });
  for (const dy of [0.7, 1.3]) { const w = new THREE.TorusGeometry(0.2, 0.035, 6, 20); mesh(w, M.paint('#b0302a', { rivets: false }), WX + 0.36, dy, WZ, { ry: Math.PI / 2, dirt: 0 }); }
  cyl(0.18, 0.6, insul, WX, 1.22, WZ, { seg: 12 });
  const before = new Set(L.getRoot().children);
  K3.puff(WX + 0.3, 1.8 + (f % 4) * 0.15, WZ - 0.2, 0.25 + 0.05 * (f % 4));
  for (const o of L.getRoot().children) if (!before.has(o)) moving.add(o);
  // insulated pipes from the wellhead to the turbine hall, with an expansion loop
  pipe([[WX, 1.6, WZ], [WX, 1.9, WZ], [WX, 1.9, 0.2], [-1.0, 1.9, 0.2], [-1.0, 2.6, -0.2], [0.2, 2.6, -0.2], [0.2, 1.9, 0.2], [1.2, 1.9, 0.2]], 0.16, insul);
  for (const [x, z] of [[WX, 0.9], [-0.4, 0.2], [0.7, 0.2]]) box(0.12, 1.9, 0.12, gunD, x, 0, z);
  // turbine hall (right front): ribbed shed, windows lit in turn while it runs, a turbine shaft guard on its side
  box(3.0, 2.1, 2.2, M.ribbed('#b3ad9f'), 2.6, 0, 1.3, { dirtH: 1 }); box(3.1, 0.14, 2.3, gunD, 2.6, 2.1, 1.3, { dirt: 0 }); ao(2.6, 1.3, 3.1, 2.3, 0.55);
  for (let k = 0; k < 4; k++) keep(box(0.5, 0.3, 0.04, M.emit(ACCENT, part === 'work' ? 1.8 + (k === (f % 4) ? 1.6 : 0) : 0.9), 1.6 + k * 0.66, 1.3, 2.42, nc));
  hcyl(0.42, 1.4, gun, 2.6, 0.55, 2.7, { axis: 'x' }); box(0.4, 0.04, 0.3, M.hazard, 3.4, 0.98, 2.7, nc);
  // the cooling tower (back): a hyperboloid shell, a lip, a lit band; its plume is the game's steam
  const TX = -0.6, TZ = -2.0, TR = 2.0, TH = 3.6;
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, y = t * TH; pts.push(new THREE.Vector2(TR * (1 - 0.32 * Math.sin(Math.PI * Math.min(1, t * 1.25))) + (t > 0.8 ? (t - 0.8) * 1.2 : 0), y)); }
  const tg = new THREE.LatheGeometry(pts, 48);
  mesh(tg, M.rough('#a8a093'), TX, 0, TZ, { dirt: 0.5, dirtH: 1.6 });
  const inner = new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p.x - 0.12, p.y)), 48); const im = M.plain('#2a2724', 0.9); im.side = THREE.BackSide; mesh(inner, im, TX, 0, TZ, { dirt: 0, cast: false });
  hoop(pts[16].x, 0.08, M.rough('#7d766b'), TX, TH, TZ, nc);
  for (let k = 0; k < 12; k++) { const a = k / 12 * 6.28; beam([TX + Math.cos(a) * (TR + 0.1), 0, TZ + Math.sin(a) * (TR + 0.1)], [TX + Math.cos(a + 0.26) * (TR - 0.05), 0.7, TZ + Math.sin(a + 0.26) * (TR - 0.05)], 0.1, 0.1, M.rough('#857d71'), { dirt: 0.3 }); }
  hoop(TR * 0.98, 0.05, M.emit(ACCENT, 2.0), TX, 1.0, TZ, nc);
  // (the tower's mouth glows faintly from the heat below, at night)
  if (K3.night) cyl(pts[16].x - 0.15, 0.02, M.emit('#ff7a2a', 0.9), TX, TH - 0.3, TZ, { seg: 40, ...nc });
  L.mark('plume', TX, TH + 0.2, TZ);
  if (part === 'work') { workLayer(L, moving); return; }
  // power layer
  const K = power(L);
  K.strip(3.0, 2.6, 1.95, 2.42); K.strip(2.6, WX + 0.1, 0.42, WZ + 0.86);
  K.transformer(4.0, -1.4, 0); K.transformer(4.0, -2.8, 0);
  K.flood(-4.4, -0.4, 2.4, 0.6); K.flood(0.4, 4.0, 2.2, 0);
  K.junction(4.3, 3.8, 0); K.beacon(TX + TR - 0.4, TH + 0.1, TZ + 1.4, '#ffb347');
  K.conduit([[2.6, 0.14, 0.18], [2.6, 0.14, -1.4], [3.55, 0.14, -1.4]], 0.05);
}
