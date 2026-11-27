// The Seam Drill (BDEFS.seamdrill; the owner's pick from the stage 3 concept canvas, concept A "Derrick"): the Deep
// Core's headframe in miniature. A slim red lattice mast over a raised shaft collar (its orchid glow rising out of the
// bore), a crown block and a travelling top drive that feeds the drill string down, a pipe rack, a driller's cabin, a
// core tray with banded cores, and two labelled hoppers (ORE, CRY) where Haulers load.
//   ?f=k            the top drive's stroke (k of 8): down the mast and back up, the string's joints turning
//   ?part=work&f=k  only the top drive, its hoist lines, the string and the bore's glow (seamdrill-work-0..7)
//   ?part=base      the drill without them (seamdrill-base@T: drawn under the loop while it works)
// Team-coloured (the power kit's strips): render one image per team. Marks: bore (the shaft's glow).
import { power } from './powerkit.js';
import { t3 } from './t3kit.js';
import { workLayer, hideParts } from './worklib.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, pointLight, ao, sphere, M, ACCENT } = L;
  const part = new URLSearchParams(location.search).get('part');
  const K3 = t3(L), { red, gun, gunD, off, hole, f, nf } = K3;
  L.seed(512);
  const nc = { dirt: 0, cast: false };
  const moving = new Set();
  const keep = (o) => { moving.add(o); return o; };
  // shaft collar
  const SX = -1.3, SZ = -1.0, CH = 0.55;
  box(3.4, CH, 3.4, M.rough('#857d71'), SX, 0, SZ, { dirt: 0.6 }); ao(SX, SZ, 3.6, 3.6, 0.5);
  box(3.5, 0.1, 3.5, M.rough('#b8b0a2'), SX, CH, SZ, { dirt: 0.3 });
  box(1.7, 0.02, 1.7, M.hazard, SX, CH + 0.1, SZ, nc);
  box(1.25, 0.03, 1.25, hole, SX, CH + 0.11, SZ, nc);
  // the bore's glow, pulsing through the loop (brightest as the top drive bottoms out)
  const t = f / nf, st = t < 0.75 ? t / 0.75 : 1 - (t - 0.75) / 0.25;
  keep(hoop(0.5, 0.05, M.emit(ACCENT, 1.6 + 1.6 * st), SX, CH + 0.13, SZ, nc));
  pointLight(ACCENT, 5, SX, CH + 0.6, SZ, 3.5);
  L.mark('bore', SX, CH + 0.15, SZ);
  // the mast
  const H = 7.6;
  K3.mast(SX, SZ, H, 1.45, 0.5, 6, { y: CH + 0.1 });
  const TOP = CH + 0.1 + H;
  box(1.5, 0.35, 1.5, gunD, SX, TOP, SZ, { dirt: 0.1 });                 // crown block deck
  for (const dx of [-0.3, 0.3]) hcyl(0.32, 0.18, red, SX + dx, TOP + 0.6, SZ, { axis: 'z' }); // sheaves
  box(0.12, 0.9, 0.12, gunD, SX, TOP + 0.35, SZ - 0.6);
  sphere(0.11, K3.night ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4), SX, TOP + 1.3, SZ - 0.6, { cast: false });
  // travelling top drive: down the mast over three quarters of the loop, then hoisted back up
  const ty = CH + 1.2 + (1 - st) * 4.6;
  const td = keep(L.group(SX, ty, SZ));
  box(0.8, 0.9, 0.8, M.paint('#d2a326', { rivets: false }), 0, 0, 0, { parent: td, dirt: 0.2 });
  box(0.84, 0.12, 0.84, M.hazard, 0, 0.9, 0, { parent: td, dirt: 0 });
  box(0.86, 0.1, 0.06, M.emit(ACCENT, 2.2), 0, 0.45, 0.42, { parent: td, ...nc });
  for (const dx of [-0.22, 0.22]) keep(beam([SX + dx, ty + 0.9, SZ], [SX + dx, TOP + 0.3, SZ], 0.035, 0.035, M.plain('#30302e', 0.5, 0.6), nc)); // hoist lines
  // drill string, its tool joints turning with the frame
  keep(cyl(0.11, ty - CH, M.chrome, SX, CH + 0.1, SZ, { seg: 16, dirt: 0 }));
  for (let k = 0; k < 4; k++) { const y = CH + 0.3 + ((k + t * 4) % 4) * (ty - CH - 0.3) / 4; keep(cyl(0.15, 0.12, gunD, SX, y, SZ, { seg: 16, dirt: 0 })); }
  // pipe rack behind (stands of drill pipe lying on trestles) and a catwalk ramp to the collar
  for (const dz of [-3.6, -2.9]) { box(0.2, 0.5, 0.25, gun, 1.6, 0, dz); box(0.2, 0.5, 0.25, gun, 4.0, 0, dz); }
  for (let r = 0; r < 2; r++) for (let k = 0; k < 6; k++) hcyl(0.1, 3.0, M.steel, 2.8, 0.6 + r * 0.2, -3.6 + k * 0.14 + (r ? 0.07 : 0), { axis: 'x', dirt: 0.2 });
  beam([0.4, CH + 0.1, -1.3], [1.6, 0.55, -2.6], 0.9, 0.08, M.grating, { dirt: 0 });
  // driller's cabin (doghouse) right of the collar, lit window
  box(1.7, 1.5, 1.4, off, 2.4, 0, -0.4, { dirtH: 1 }); box(1.8, 0.12, 1.5, gunD, 2.4, 1.5, -0.4, { dirt: 0 }); ao(2.4, -0.4, 1.8, 1.5, 0.5);
  box(0.9, 0.4, 0.04, M.glass('#9fd8ff', 0.6), 2.4, 0.85, 0.31, nc);
  // core tray: banded cores (ore rust, crystal violet) on a bench
  box(2.2, 0.55, 0.9, gun, -2.9, 0, 2.2); ao(-2.9, 2.2, 2.3, 1.0, 0.45);
  const oreC = M.plain('#7a4a2c', 0.8), cryC = M.emit('#9b6bff', 0.9);
  for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) hcyl(0.11, 0.48, (k + r) % 3 === 1 ? cryC : oreC, -3.65 + k * 0.5, 0.67, 1.95 + r * 0.25, { axis: 'x', dirt: 0 });
  // hoppers where Haulers load, fed by a short chute from the collar
  K3.hopper(1.1, 2.6, 'ORE', '#9c5a32', '#c8834e', 0.95);
  K3.hopper(3.3, 2.6, 'CRY', '#6b4ab0', '#b597ff', 0.95);
  beam([SX + 1.2, CH + 0.9, SZ + 1.4], [2.2, 2.4, 2.1], 0.5, 0.12, M.steel, { dirt: 0 });
  // mud pump and hose to the mast
  box(1.2, 0.8, 0.8, M.paint('#6b6f5a'), -3.7, 0, -1.6); pipe([[-3.1, 0.6, -1.6], [-2.6, 0.6, -1.6], [-2.6, 2.2, SZ + 0.5], [SX - 0.3, 2.2, SZ + 0.3]], 0.07, M.dark);
  if (part === 'work') { workLayer(L, moving); return; }
  if (part === 'base') hideParts(moving);
  // power layer
  const K = power(L);
  K.strip(1.7, 2.4, 1.62, 0.31); K.strip(3.4, SX, CH + 0.05, SZ + 1.71);
  K.flood(-4.2, 0.6, 2.4, 0.5); K.flood(4.4, -2.0, 2.2, -0.6);
  K.junction(-0.5, 3.6, 0); K.beacon(3.1, 1.75, -0.9);
  K.conduit([[-0.22, 0.14, 3.6], [-0.22, 0.14, 1.0], [SX + 1.75, 0.14, 1.0]], 0.05);
}
