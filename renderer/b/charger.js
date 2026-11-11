// Charging station: solar canopy over three charging bays with glowing dock pads and charge posts,
// battery cabinets with charge bars, transformer, and an insulated power mast with a glowing top.
// Powered realism (b/powerkit.js): team light strips outline the canopy and run up its front posts, the transformer's
// insulators arc, conduits with glowing collars feed a junction box, floodlights flank the bays, cables run from the
// transformer and the mast to the canopy, beacons on the canopy corners. Team-coloured: render one image per team.
import { power } from './powerkit.js';
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, hoop, lamp, pointLight, ao, mesh, sphere, group, canvasTex, M, THREE, ACCENT } = L;
  const gun = M.paint('#50565c'), warm = M.paint('#8c8579'), off = M.paint('#c9c5ba'), alu = M.paint('#a9aeb2', { rivets: false });
  const glow = M.emit(ACCENT, 2.4), dim = M.emit(ACCENT, 1.2);
  const P = power(L), nc = { dirt: 0, cast: false };
  L.seed(111);

  // photovoltaic cell texture (tileable): dark blue cells, silver busbars
  const cells = canvasTex(512, (g, n) => {
    g.fillStyle = '#0c1628'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const x = i * 64, y = j * 64, gr = g.createLinearGradient(x, y, x + 64, y + 64);
      gr.addColorStop(0, '#1b2f52'); gr.addColorStop(1, '#0f1c34'); g.fillStyle = gr; g.fillRect(x + 3, y + 3, 58, 58);
      g.fillStyle = 'rgba(190,200,215,0.55)'; g.fillRect(x + 20, y + 3, 2, 58); g.fillRect(x + 42, y + 3, 2, 58);
    }
    g.strokeStyle = '#b7bec6'; g.lineWidth = 3; for (let k = 0; k <= n; k += 64) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(160,120,80,${0.05 + Math.random() * 0.12})`; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 6 + Math.random() * 30, 0, 7); g.fill(); }
  });
  const pv = new THREE.MeshStandardMaterial({ map: cells, roughness: 0.22, metalness: 0.45, vertexColors: true }); pv.envMapIntensity = 1.6;

  // ---- solar canopy on a steel frame, tilted toward the viewer
  const cx = -0.2, cz = -0.7, CW = 8.6, CD = 5.0, yB = 3.95, yF = 3.15;
  const zB = cz - CD / 2, zF = cz + CD / 2, tilt = Math.atan2(yB - yF, CD);
  for (const x of [cx - CW / 2 + 0.5, cx + CW / 2 - 0.5]) {
    box(0.32, yB - 0.25, 0.32, gun, x, 0, zB + 0.45); box(0.32, yF - 0.2, 0.32, gun, x, 0, zF - 0.45);
    box(0.6, 0.15, 0.6, M.hazard, x, 0, zB + 0.45, { dirt: 0 }); box(0.6, 0.15, 0.6, M.hazard, x, 0, zF - 0.45, { dirt: 0 });
    beam([x, yB - 0.25, zB + 0.45], [x, yF - 0.2, zF - 0.45], 0.24, 0.3, gun);
    beam([x, 0.6, zF - 0.45], [x, yB - 0.6, zB + 0.45], 0.12, 0.12, gun);
  }
  beam([cx - CW / 2 + 0.3, yB - 0.2, zB + 0.45], [cx + CW / 2 - 0.3, yB - 0.2, zB + 0.45], 0.22, 0.26, gun);
  beam([cx - CW / 2 + 0.3, yF - 0.15, zF - 0.45], [cx + CW / 2 - 0.3, yF - 0.15, zF - 0.45], 0.22, 0.26, gun);
  const can = group(cx, (yB + yF) / 2, cz); can.rotation.x = tilt;
  const mods = 4, rows = 2, mw = (CW - 0.12 * (mods - 1)) / mods, md = (CD - 0.12) / rows;
  for (let i = 0; i < mods; i++) for (let j = 0; j < rows; j++) {
    const x = -CW / 2 + mw / 2 + i * (mw + 0.12), z = -CD / 2 + md / 2 + j * (md + 0.12);
    box(mw, 0.1, md, [alu, alu, pv, alu, alu, alu], x, 0, z, { parent: can, dirt: 0 });
  }
  box(CW + 0.1, 0.08, 0.1, alu, 0, 0.02, CD / 2 + 0.05, { parent: can, dirt: 0 });
  box(CW - 0.6, 0.05, 0.05, dim, 0, -0.08, CD / 2 - 0.05, { parent: can, cast: false });

  // ---- three charging bays under the canopy
  for (const bx of [-2.9, -0.2, 2.5]) {
    const bz = 0.1;
    box(2.1, 0.05, 2.6, M.plain('#26292c', 0.85), bx, 0, bz, { dirt: 0, cast: false });
    hoop(0.72, 0.06, glow, bx, 0.07, bz + 0.2, { cast: false });
    hoop(0.42, 0.03, dim, bx, 0.07, bz + 0.2, { cast: false });
    box(2.1, 0.02, 0.12, M.hazard, bx, 0.05, bz + 1.24, { dirt: 0, cast: false });
    box(0.5, 1.55, 0.42, off, bx, 0, bz - 1.45);
    box(0.36, 0.42, 0.04, glow, bx, 0.95, bz - 1.23, { cast: false });
    box(0.36, 0.08, 0.05, M.dark, bx, 1.2, bz - 1.23, { dirt: 0 });
    pipe([[bx + 0.18, 1.0, bz - 1.25], [bx + 0.45, 0.85, bz - 0.9], [bx + 0.45, 0.35, bz - 0.7]], 0.05, M.dark);
    box(0.16, 0.16, 0.2, glow, bx + 0.45, 0.25, bz - 0.7, { cast: false });
    pointLight(ACCENT, 3.5, bx, 0.6, bz + 0.2, 2.6);
  }

  // ---- battery cabinets with charge bars (front left)
  const fx = -3.0, fz = 3.35;
  for (let i = 0; i < 4; i++) {
    const x = fx - 1.2 + i * 0.85, lvl = [4, 3, 4, 2][i];
    box(0.78, 1.45, 0.95, off, x, 0, fz);
    for (let k = 0; k < 4; k++) box(0.42, 0.13, 0.04, k < lvl ? glow : M.dark, x, 0.28 + k * 0.22, fz + 0.48, { cast: false, dirt: 0 });
    box(0.8, 0.08, 0.97, gun, x, 1.45, fz, { dirt: 0 });
  }
  ao(fx, fz, 3.4, 1.0, 0.5);
  box(3.4, 0.08, 0.35, M.hazard, fx, 0, fz + 0.75, { dirt: 0, cast: false });

  // ---- transformer (front right) with fins and insulators
  const tx = 2.9, tz = 3.3;
  box(1.6, 1.25, 1.1, gun, tx, 0, tz); ao(tx, tz, 1.6, 1.1, 0.5);
  for (let i = 0; i < 7; i++) box(0.06, 0.95, 0.25, M.steel, tx - 0.72 + i * 0.24, 0.12, tz + 0.65, { dirt: 0 });
  for (const dx of [-0.45, 0, 0.45]) { cyl(0.08, 0.5, M.plain('#e4e0d6', 0.3), tx + dx, 1.25, tz, { seg: 12, dirt: 0 }); for (const y of [1.35, 1.5, 1.65]) cyl(0.16, 0.04, M.plain('#e4e0d6', 0.3), tx + dx, y, tz, { seg: 16, dirt: 0 }); }
  box(0.9, 0.5, 0.05, M.paint('#d8b52a', { rivets: false }), tx, 0.45, tz + 0.56, { dirt: 0 });
  P.conduit([[tx - 0.8, 0.3, tz - 0.3], [1.0, 0.3, tz - 0.3], [1.0, 0.3, 1.8]], 0.07);
  P.conduit([[fx + 1.75, 0.3, fz - 0.3], [fx + 2.1, 0.3, fz - 0.3], [fx + 2.1, 0.3, 1.8]], 0.07);

  // ---- power mast with insulator stack and a glowing collector ring (back right corner)
  const px = 4.15, pz = -4.0;
  box(1.0, 0.4, 1.0, M.concrete, px, 0, pz); ao(px, pz, 1.0, 1.0, 0.5);
  cyl(0.18, 4.7, gun, px, 0.4, pz, { seg: 16 });
  for (let y = 1.4; y < 4.6; y += 0.35) cyl(0.32, 0.07, M.plain('#e4e0d6', 0.3), px, y, pz, { seg: 20, dirt: 0 });
  hoop(0.42, 0.07, glow, px, 5.1, pz, { cast: false });
  sphere(0.22, M.emit(ACCENT, 3), px, 5.35, pz, { cast: false });
  pointLight(ACCENT, 4, px, 5.2, pz + 0.6, 3);
  pipe([[px, 1.2, pz], [px - 0.7, 1.2, pz], [px - 0.7, 1.2, zB + 0.45], [cx + CW / 2 - 0.5, 1.2, zB + 0.45]], 0.06, M.dark);

  // ================================================================ power layer (lights and electricity)
  // team light strips outlining the canopy (front, back and both sides) and up the front faces of its front posts
  box(CW + 0.12, 0.06, 0.06, P.glow, 0, 0.11, CD / 2 + 0.1, { parent: can, ...nc });
  box(CW + 0.12, 0.06, 0.06, P.glow, 0, 0.11, -CD / 2 - 0.04, { parent: can, ...nc });
  for (const s of [-1, 1]) box(0.06, 0.06, CD + 0.1, P.glow, s * (CW / 2 + 0.04), 0.11, 0.03, { parent: can, ...nc });
  for (const x of [cx - CW / 2 + 0.5, cx + CW / 2 - 0.5]) box(0.06, yF - 0.75, 0.06, P.glow, x, 0.3, zF - 0.45 + 0.18, nc);
  // the transformer's insulators carry glowing caps with a crackle of arc between them; a lit status panel
  const tops = [-0.45, 0, 0.45].map(dx => [tx + dx, 1.82, tz]);
  for (const t of tops) sphere(0.07, P.white, ...t, { cast: false });
  P.arc(tops[0], tops[1], 4, 3); P.arc(tops[1], tops[2], 4, 7);
  pointLight('#bfe8ff', 1.5, tx, 2.0, tz + 0.3, 2.2);
  box(1.62, 0.06, 0.06, P.glow, tx, 1.22, tz + 0.56, nc);
  for (const [k, mat] of [[-0.2, P.green], [0, P.amber], [0.2, P.glow]]) box(0.07, 0.07, 0.03, mat, tx + k, 0.82, tz + 0.57, nc);
  // cables from the insulators up to the canopy's front beam
  for (const [i, t] of tops.entries()) P.cable(t, [2.55 + i * 0.35, yF - 0.08, zF - 0.45], 0.18, 6);
  // junction box on the front apron between the cabinets and the transformer, conduits into both
  P.junction(0.35, 3.72, 0);
  P.conduit([[0.64, 0.35, 3.62], [tx - 0.8, 0.35, 3.62]], 0.055);
  P.conduit([[0.06, 0.35, 3.62], [fx + 1.75, 0.35, 3.62]], 0.055);
  // floodlights flanking the bays, aimed in over the apron
  P.flood(-4.4, 2.25, 2.3, 0.55); P.flood(4.3, 2.0, 2.3, -0.55);
  // a cable from the mast's insulator stack to the canopy's back beam; beacons on the canopy corners and the mast
  P.cable([px - 0.3, 4.25, pz], [cx + CW / 2 - 0.35, yB - 0.1, zB + 0.45], 0.25);
  for (const x of [cx - CW / 2 + 0.05, cx + CW / 2 - 0.05]) P.beacon(x, 3.3, zF - 0.03);
  P.beacon(cx - CW / 2 + 0.05, yB + 0.12, zB + 0.05, '#ffb347');
}
