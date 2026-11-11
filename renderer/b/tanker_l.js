// Fuel Tanker, "Lancer" restyle: the Lancer Freight Truck's chassis, skirts and cab (b/truck_l.js) with a fuel tank in
// place of the flatbed. Top-down, facing +x, orthographic camera straight down, no ground and no shadow; same framing as
// the Freight Truck. The tank stays bright brushed steel (it is the vehicle's job, and reads as a tank at game size),
// wrapped in gunmetal armour bands, with team-colour light lines along its upper flanks, a dark catwalk spine with three
// hatches, and the flammable placards. Coordinates in robkit px (1 px = 1/25.6 unit) or world units where noted.
//   ?f=k     driving frame k (0..3): every tyre rolled forward by k/4 of one tread-block pitch
//   ?part=   truck (default) | brake (only the two rear brake lenses, lit) | boost (only the cab's motor vents, glowing)
// Kept from b/tanker.js: tyres, tank span and section, brake lenses, motor-vent slots, exhaust marks ex0 / ex1, headlamps.
import { lancer } from './lancertruck.js';
export const config = { pad: false, size: 768 };
export default function (L) {
  const { M, TEAM, THREE } = L;
  const part = new URLSearchParams(location.search).get('part') || 'truck';
  L.seed(611);
  const V = lancer(L), { R, k, m, mir } = V, { rect, rr, poly, ext, disc, strip, tyre, grime, hazard } = R;
  const haz = hazard('#f0a030'), O = R.O;

  // ---- running gear and skirts, as the Freight Truck
  for (const x of [2.95, -1.55, -3.05]) for (const s of [-1, 1]) tyre(x / k, s * 41.5, 15.9, 15.9, { blocks: 18 });
  rect(-104, -24, 204, 48, 0.3, 0.5, m.dark, { dirt: 0 });
  for (const s of [-1, 1]) {
    ext(poly(mir([[106, 26], [101, 42], [-100, 42], [-107, 37], [-107, 26]], s)), 0.62, 0.6, m.armor, { bevel: 0.06 });
    strip(-99, s * 38.5, 97, s * 38.5, 3, 1.23, 0.02, m.glow);
    for (const x of [53, -12, -59]) strip(x, s * 40.5, x, s * 42, 1.5, 1.22, 0.01, m.seam);
  }
  ext(poly([[40, -30], [-101, -30], [-108.5, -24], [-108.5, 24], [-101, 30], [40, 30]]), 0.4, 0.7, m.armor, { bevel: 0.06 });   // bed hull

  // ---- the tank (world units): an oval-section shell on armoured saddles
  const TX0 = -3.95, TX1 = 1.42, TYc = 1.62, TRz = 1.3, TRy = 0.82, tlen = TX1 - TX0, tmid = (TX0 + TX1) / 2;
  const tankM = M.paint('#b3b8bc', { rivets: false, metal: 0.6, rough: 0.33, panelW: 4096, panelH: 4096 });
  const body = new THREE.CylinderGeometry(1, 1, tlen - 0.5, 48, 1, true); body.rotateZ(Math.PI / 2); body.scale(1, TRy, TRz);
  L.mesh(body, tankM, tmid, TYc, 0, O({ dirt: 0.25, dirtH: 0.6 }));
  for (const e of [-1, 1]) {
    const cap = new THREE.SphereGeometry(1, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2); cap.rotateZ(-e * Math.PI / 2); cap.scale(0.25, TRy, TRz);
    L.mesh(cap, tankM, tmid + e * (tlen - 0.5) / 2, TYc, 0, O({ dirt: 0.2 }));
  }
  for (const x of [TX0 + 0.7, TX1 - 0.7]) L.box(0.5, 0.75, 2.3, m.armor, x, 0.6, 0, O({ dirt: 0 }));      // saddles
  // team-colour light lines along both upper flanks (the armour bands below cut them into segments)
  for (const s of [-1, 1]) {
    const st = new THREE.CylinderGeometry(1, 1, tlen - 0.9, 48, 1, true, s > 0 ? Math.PI * 0.225 : Math.PI * 0.75, Math.PI * 0.025);
    st.rotateZ(Math.PI / 2); st.scale(1, TRy + 0.012, TRz + 0.012);
    L.mesh(st, M.emit(TEAM, 0.7), tmid, TYc, 0, O({ dirt: 0, cast: false }));          // dimmer, so the night lights don't flood the steel
  }
  // gunmetal armour bands round the shell
  for (const x of [TX0 + 0.55, tmid - 0.9, tmid + 0.9, TX1 - 0.55]) {
    const b = new THREE.CylinderGeometry(1, 1, 0.2, 48, 1, true); b.rotateZ(Math.PI / 2); b.scale(1, TRy + 0.03, TRz + 0.03);
    L.mesh(b, m.armor, x, TYc, 0, O({ dirt: 0 }));
    for (const e of [-1, 1]) { const r = new THREE.TorusGeometry(1, 0.018, 6, 48); r.rotateY(Math.PI / 2); r.scale(1, TRy + 0.035, TRz + 0.035); L.mesh(r, m.seam, x + e * 0.1, TYc, 0, O({ dirt: 0 })); }
  }
  // the catwalk spine: dark grating, low rails, three hatches, the vapour line
  const top = TYc + TRy;
  L.box(tlen - 0.9, 0.06, 0.62, M.grating, tmid, top - 0.02, 0, O({ dirt: 0 }));
  for (const s of [-1, 1]) {
    for (let x = TX0 + 0.6; x <= TX1 - 0.5; x += 0.95) L.box(0.04, 0.3, 0.04, m.steel, x, top, s * 0.36, O({ dirt: 0 }));
    L.box(tlen - 1.0, 0.04, 0.05, m.top, tmid, top + 0.3, s * 0.36, O({ dirt: 0 }));
  }
  for (const x of [TX0 + 1.15, tmid, TX1 - 1.15]) {
    L.cyl(0.3, 0.1, m.armor, x, top + 0.02, 0, O({ seg: 24, dirt: 0 }));
    const d = new THREE.SphereGeometry(0.25, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2); d.scale(1, 0.45, 1); L.mesh(d, m.steel, x, top + 0.12, 0, O({ dirt: 0 }));
    L.box(0.3, 0.04, 0.06, m.dark, x, top + 0.2, 0.17, O({ dirt: 0 }));
  }
  L.pipe([[TX0 + 0.5, top + 0.08, -0.48], [TX1 - 0.4, top + 0.08, -0.48]], 0.05, m.pipe);
  // flammable placards on the upper flanks
  const plac = L.canvasTex(128, (g, n) => { g.fillStyle = '#e8541c'; g.fillRect(0, 0, n, n); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(10, 10, n - 20, n - 20);
    g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(n / 2, 26); g.bezierCurveTo(n * 0.78, n * 0.45, n * 0.7, n * 0.66, n / 2, n * 0.7); g.bezierCurveTo(n * 0.3, n * 0.66, n * 0.24, n * 0.48, n * 0.4, n * 0.36);
    g.bezierCurveTo(n * 0.42, n * 0.48, n * 0.5, n * 0.5, n / 2, 26); g.fill(); g.fillRect(n * 0.3, n * 0.78, n * 0.4, 6); });
  const placM = new THREE.MeshStandardMaterial({ map: plac, roughness: 0.6, vertexColors: true });
  for (const s of [-1, 1]) { const g = L.group(tmid + 1.55, TYc + TRy * Math.sqrt(1 - (0.86 / TRz) ** 2) + 0.02, s * 0.86, 0, R.G); g.rotation.x = s * 0.51; const pl = L.box(0.38, 0.02, 0.38, placM, 0, 0, 0, { parent: g, dirt: 0, cast: false }); pl.rotation.y = Math.PI / 4; }
  // rear of the tank: valve manifold, hose reel, ladder
  for (const s of [-1, 1]) { L.cyl(0.12, 0.42, m.steel, TX0 - 0.05, 0.6, s * 0.55, O({ seg: 16 })); L.hcyl(0.1, 0.3, M.paint('#c43b2a', { rivets: false }), TX0 - 0.05, 0.95, s * 0.55, O({ axis: 'z' })); }
  L.hcyl(0.07, 1.6, m.pipe, TX0 - 0.05, 0.62, 0, O({ axis: 'z' }));
  L.hcyl(0.28, 0.5, M.plain('#141516', 0.9), TX0 + 0.25, 0.75, -1.15, O({ axis: 'z', seg: 24 }));
  for (let i = 0; i < 6; i++) L.box(0.05, 0.03, 0.42, m.steel, TX0 - 0.15, 0.85 + i * 0.17, 0.8, O({ dirt: 0 }));
  rect(37, -30, 4, 60, 0.9, 0.5, m.seam, { dirt: 0 });                                     // the joint behind the cab

  // ---- the tail, the cab, the vents and the stacks, as the Freight Truck
  ext(poly([[-102, -46], [-106, -46], [-109, -42], [-109, 42], [-106, 46], [-102, 46]]), 0.5, 0.74, m.armor, { bevel: 0.05 });
  ext(rr(-107.5, -24, 4.5, 48, 1), 1.22, 0.04, haz, { bevel: 0.01 });
  for (const s of [-1, 1]) {
    V.brake(-107.6, s * 32.8 - 3.07, 5.1, 6.14, 1.24);
    rect(-110, s * 41.5 - 3, 3.5, 6, 0.8, 0.42, m.glow, { dirt: 0, cast: false });
  }
  const C = V.cab({ x0: 41, xf: 108.5, xc: 101, hw: 35, nf: 20, y0: 0.45, yt: 1.72, roof: [60, -23, 29, 46] });
  V.hatch(75, 9, 6.5, C.yu + 0.07);
  V.beacon(65, 17, C.yu + 0.07);
  V.mast(83, -13, C.yu + 0.07);
  const ventGlow = [];
  for (const s of [-1, 1]) {
    L.box(0.42, 0.08, 0.95, m.dark, 1.92, C.yu, s * 0.72, O({ dirt: 0 }));
    L.box(0.34, 0.03, 0.85, M.grille('#3d4247'), 1.92, C.yu + 0.08, s * 0.72, O({ dirt: 0 }));
    for (let i = 0; i < 4; i++) ventGlow.push(L.box(0.28, 0.02, 0.1, M.dark, 1.92, C.yu + 0.09, s * 0.72 - 0.3 + i * 0.2, O({ dirt: 0, cast: false })));
  }
  for (const [i, s] of [[0, -1], [1, 1]]) {
    const x = 1.62, z = s * 1.72, top2 = 3.05;
    V.stack(x, z, top2);
    L.box(0.3, 0.1, 0.24, m.armor, x + 0.1, 1.0, z - s * 0.13, O({ dirt: 0 }));
    L.mark('ex' + i, x, top2 + 0.05, z);
  }

  V.finish(part, { boost: ventGlow.map(b => [b, M.emit('#bfe4ff', 2.6)]) });
}
