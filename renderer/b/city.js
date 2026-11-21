// Arrival City (IDEAS.md "Megastructures", the owner's look A from the second sheet, "Four Blocks round a Square",
// Nov 2026; it replaced the Terraced Arcology): a 4 x 4 megastructure (40 x 40 world units, the middle of its sixteen
// tiles at the origin), a lit-up panel-block square from the future, built for colonists who never came.
//   Four prefab panel apartment blocks of raw concrete round a central square: a long five-storey block across the north
//   side facing the square (WELCOME HOME in big letters on its roof, masts, dishes, solar panels), two five-storey
//   blocks down the west and east sides, and a low three-storey block along the south street, split by a gateway onto
//   the square. Window grids in every panel, loggias, entrance canopies, an LED strip round every roof edge (painted in
//   the team colour by day; the game lights it in the owner colony's colour at night). In the square: paving, four
//   lawns with trees and three deer, lamps, a fountain, and the Arrival clock (T+31) on a concrete stele with the Ring
//   round its top (no statues: LORE.md keeps people off screen). Round the outside a street; tram rails along the south
//   side with an empty tram waiting at the stop by the gateway.
//   ?state=down          the City knocked down by fighting: its windows dark and many broken, panels cracked and a few
//                        fallen onto the square, the east end of the south block blown out into rubble, scorch over the
//                        roofs and the square, burnt trees, the fountain dry, a mast bent, the C of WELCOME fallen.
//   ?part=lit&tier=k     only the lights of tier k (in the glow pass), for the game to switch on at dusk one after
//                        another, on a timer: 0 the street and square lamps, the fountain, the tram and its stop;
//                        1 the ground and first floors' windows and the lobbies; 2 the second and third floors';
//                        3 the top floors', WELCOME HOME, the clock and the Ring. 4 the LED strips alone, in white (the
//                        game tints them in the owner's colour). 5 (with state=down) what still burns on the wrecked
//                        City: WEL OME HOME, the clock and the masts' red lights, which the game flickers.
//                        The beauty pass is the plain City and isn't used.
//   Every other render has all of those lights off (windows dark glass, lamps unlit): the game adds them. Only the red
//   lights on the masts burn in every render, like any tall building's.
// Marks: 'clock' (the clock face), 'sign' (the middle of WELCOME HOME), 'stop' (the tram stop).
const Q = new URLSearchParams(location.search);
const PART = Q.get('part') || 'base', LIT = PART === 'lit' ? +(Q.get('tier') || 0) : -1, DOWN = Q.get('state') === 'down';
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, mesh, group, ao, pointLight, canvasTex, M, THREE } = L;
  L.seed(5120 + (DOWN ? 7 : 0));
  L.frameCompoundOpts({ half: 20.12, width: 0.64, cy: 0.6 });
  L.getScene().traverse((o) => {
    if (!o.isDirectionalLight || !o.castShadow) return;
    o.position.multiplyScalar(3);
    const c = o.shadow.camera; c.left = -28; c.right = 28; c.top = 28; c.bottom = -28; c.near = 1; c.far = 170; c.updateProjectionMatrix();
  });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const nc = { dirt: 0, cast: false };
  const offM = M.plain('#2a2c30', 0.5, 0.2);
  // A light of tier k: glowing only in that tier's pass; dark (or `off`) otherwise.
  const E = (hex, k, tier, off) => (LIT === tier ? M.emit(hex, k) : off || offM);
  const team = M.paint(L.TEAM, { rivets: false, rough: 0.5 });
  const C = {
    conc: M.rough('#bdb8ad'), concD: M.rough('#a39e94'), concL: M.rough('#d2cdc2'), roof: M.plain('#5d5f60', 0.95, 0), roofL: M.plain('#8a8781', 0.9, 0), roofD: M.plain('#4a4c4e', 0.8, 0.2),
    paving: M.rough('#c6c0b2'), kerb: M.rough('#d6d2c8'), asphalt: M.plain('#3a3c40', 0.9, 0), line: M.plain('#e8e4d8', 0.7, 0),
    steel: M.steel, dark: M.dark, white: M.paint('#e4e2dc', { rivets: false, rough: 0.5 }), grass: M.plain('#6f9a4e', 0.95, 0),
    grassD: M.plain('#5f8a44', 0.95, 0), trunk: M.plain('#5b4330', 0.9, 0), wood: M.wood,
    water: new THREE.MeshPhysicalMaterial({ color: '#3d7ea6', roughness: 0.05, metalness: 0.1, clearcoat: 0.9, envMapIntensity: 1.2 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#a8d4e6', roughness: 0.06, transparent: true, opacity: 0.4, clearcoat: 0.9, envMapIntensity: 1.5 }),
    solar: M.plain('#1d2a3a', 0.25, 0.5), ash: M.plain('#2a2522', 0.95, 0), char: M.plain('#3a2f28', 0.95, 0),
    rubble: M.rough('#9c978c'), rubbleD: M.rough('#6e6a62'), red: M.paint('#a8352a', { rivets: false, rough: 0.5 }),
  };
  if (DOWN) { C.grass = M.plain('#6a7a48', 0.95, 0); C.grassD = M.plain('#56633c', 0.95, 0); }
  const leafM = ['#5e9a48', '#4f8a3f', '#6fa654', '#7aa957', '#58913f'].map((h) => M.plain(h, 0.85, 0));
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  // ---------------------------------------------------------------------------- the ground: square, street, rails
  const RW = 2.5, RO = 19.8, RI = RO - RW;
  {
    const n = 1024, t = canvasTex(n, (g) => {
      g.fillStyle = '#c4beb0'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 24) for (let x = 0; x < n; x += 24) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '60,55,48'},${RR(0.02, 0.08)})`; g.fillRect(x + 1, y + 1, 22, 22); }
      g.strokeStyle = 'rgba(70,64,56,0.3)'; g.lineWidth = 1.5;
      for (let k = 0; k <= n; k += 24) { g.beginPath(); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.stroke(); }
      if (DOWN) for (let k = 0; k < 30; k++) { const x = R() * n, y = R() * n, r = RR(30, 120), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,16,12,0.75)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    });
    const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, vertexColors: true }); top.envMapIntensity = 0.35;
    const geo = new THREE.BoxGeometry(40, 0.6, 40); geo.translate(0, -0.3, 0);
    const m = mesh(geo, [C.concD, C.concD, top, C.concD, C.concD, C.concD], 0, 0, 0, { dirt: 0.3, dirtH: 0.6, cast: false });
    m.userData.pad = true;
    for (const [w, d, x, z] of [[2 * RO, RW, 0, -(RI + RW / 2)], [2 * RO, RW, 0, RI + RW / 2], [RW, 2 * RI, -(RI + RW / 2), 0], [RW, 2 * RI, RI + RW / 2, 0]]) box(w, 0.06, d, C.asphalt, x, 0, z, nc);
    for (const s of [-1, 1]) {
      box(2 * RI + 0.3, 0.14, 0.18, C.kerb, 0, 0, s * (RI - 0.05), nc); box(0.18, 0.14, 2 * RI + 0.3, C.kerb, s * (RI - 0.05), 0, 0, nc);
      for (let k = -RO + 1.5; k < RO - 1; k += 2.2) { if (s < 0) box(1.1, 0.075, 0.12, C.line, k, 0, s * (RI + RW / 2), nc); box(0.12, 0.075, 1.1, C.line, s * (RI + RW / 2), 0, k, nc); }
    }
    // the tram rails down the south street, and its overhead wire on poles
    for (const dz of [-0.42, 0.42]) box(2 * RO, 0.09, 0.08, C.steel, 0, 0, RI + RW / 2 + dz, nc);
    for (let x = -RO + 2; x < RO; x += 6.5) { cyl(0.05, 3.1, C.steel, x, 0, RO - 0.1, { seg: 6, dirt: 0.2 }); box(0.06, 0.06, 1.4, C.steel, x, 3.05, RI + RW / 2 + 0.6, nc); }
    box(2 * RO, 0.03, 0.03, C.dark, 0, 2.95, RI + RW / 2, nc);
  }

  // ---------------------------------------------------------------------------- the panel blocks
  // A face of a block, w x h, `floors` storeys of prefab panels, a window in each; the windows of a floor light in the
  // pass of that floor's tier (tierOf). Faces +z unless turned by ry. Down: dark, many broken, panels cracked or gone.
  const tierOf = (f, floors) => floors <= 3 ? f + 1 : f < 2 ? 1 : f < 4 ? 2 : 3;
  function facade(w, h, x, y, z, ry, floors, o = {}) {
    const ppu = 40, cw = Math.min(2048, Math.round(w * ppu)), ch = Math.round(h * ppu), cols = Math.max(2, Math.round(w / (o.pitch || 1.5)));
    const base = cv(cw, ch), emit = cv(cw, ch), g = base.getContext('2d'), e = emit.getContext('2d');
    g.fillStyle = '#b9b4a9'; g.fillRect(0, 0, cw, ch);
    e.fillStyle = '#000'; e.fillRect(0, 0, cw, ch);
    const fh = ch / floors, pw = cw / cols, stair = o.stairs || [], f0 = o.floor0 || 0;
    if (o.mural) { mural(g, cw, ch); floors = 1; }
    for (let f = 0; f < (o.mural ? 0 : floors); f++) {
      const y0 = (floors - 1 - f) * fh, tier = tierOf(f + f0, o.of || floors), ground = f + f0 === 0 && o.shops;
      for (let c = 0; c < cols; c++) {
        const x0 = c * pw, isStair = stair.includes(c);
        // the panel: raw concrete, each one a shade of its own, its joints dark
        const v = RR(-12, 12) + (o.tone || 0);
        g.fillStyle = `rgb(${190 + v},${185 + v},${175 + v})`; g.fillRect(x0 + 1, y0 + 1, pw - 2, fh - 2);
        for (let k = 0; k < 6; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '80,72,60' : '255,250,240'},${RR(0.03, 0.08)})`; g.fillRect(x0 + R() * pw, y0 + R() * fh, RR(4, 16), RR(4, 14)); }
        g.fillStyle = 'rgba(60,55,48,0.18)'; g.fillRect(x0, y0 + fh * 0.7, pw, fh * 0.3); // (weathering under the sill)
        if (DOWN && R() < 0.12) { // (a panel fallen out: a dark hole and rebar)
          g.fillStyle = '#16130f'; g.fillRect(x0 + 2, y0 + 2, pw - 4, fh - 4); g.strokeStyle = '#5a4a3a'; g.lineWidth = 2;
          for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x0 + k * pw / 4, y0 + 2); g.lineTo(x0 + k * pw / 4 + RR(-4, 4), y0 + fh - 2); g.stroke(); }
          continue;
        }
        let wx, wy, ww, wh;
        if (isStair) { wx = x0 + pw * 0.38; ww = pw * 0.24; wy = y0 + fh * 0.1; wh = fh * 0.8; }
        else if (ground) { wx = x0 + pw * 0.08; ww = pw * 0.84; wy = y0 + fh * 0.12; wh = fh * 0.74; }
        else { wx = x0 + pw * 0.18; ww = pw * 0.64; wy = y0 + fh * 0.22; wh = fh * 0.5; }
        const broken = DOWN && R() < 0.5, burnt = DOWN && R() < 0.3;
        g.fillStyle = '#3e3d3a'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        if (broken) { gr.addColorStop(0, '#0b0b0c'); gr.addColorStop(1, '#141312'); }
        else { gr.addColorStop(0, '#6a8598'); gr.addColorStop(0.45, '#2e3c4a'); gr.addColorStop(1, '#223040'); }
        g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
        if (broken && !burnt) { g.strokeStyle = 'rgba(150,170,185,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wx, wy + RR(0, wh)); g.lineTo(wx + RR(0, ww), wy + RR(0, wh)); g.lineTo(wx + ww, wy + RR(0, wh)); g.stroke(); }
        if (!isStair) { g.fillStyle = 'rgba(30,26,22,0.65)'; g.fillRect(wx + ww * (ground ? 0.33 : 0.5) - 1, wy, 2, wh); if (ground) g.fillRect(wx + ww * 0.66 - 1, wy, 2, wh); }
        if (burnt) { const r = pw * 0.9, cx = wx + ww / 2, s = g.createRadialGradient(cx, wy, 0, cx, wy, r); s.addColorStop(0, 'rgba(15,12,10,0.85)'); s.addColorStop(1, 'rgba(15,12,10,0)'); g.fillStyle = s; g.fillRect(cx - r, wy - r * 1.6, 2 * r, 2 * r); }
        // its light: the same warm white everywhere, on a timer (nobody home); a stairwell a little cooler
        if (LIT === tier && !DOWN) { e.fillStyle = isStair ? '#fff4e0' : ground ? '#ffe6b8' : `rgba(255,228,182,${RR(0.88, 1)})`; e.fillRect(wx, wy, ww, wh); if (!isStair) { e.fillStyle = 'rgba(0,0,0,0.7)'; e.fillRect(wx + ww * (ground ? 0.33 : 0.5) - 1, wy, 2, wh); } }
      }
      g.fillStyle = 'rgba(40,36,30,0.55)'; g.fillRect(0, y0 + fh - 2, cw, 2); // (the floor's joint)
    }
    for (let c = 1; c < cols; c++) { g.fillStyle = 'rgba(40,36,30,0.45)'; g.fillRect(c * pw - 1, 0, 2, ch); }
    if (o.mural) for (let f = 1; f < o.mural; f++) { g.fillStyle = 'rgba(40,36,30,0.45)'; g.fillRect(0, f * ch / o.mural - 1, cw, 2); }
    if (DOWN) {
      g.strokeStyle = 'rgba(25,20,16,0.85)'; g.lineWidth = 2.5; // cracks across the panels
      for (let k = 0; k < Math.ceil(w / 2.5); k++) { let px = R() * cw, py = R() * ch; g.beginPath(); g.moveTo(px, py); for (let s = 0; s < 6; s++) { px += RR(-30, 30); py += RR(8, 34); g.lineTo(px, py); } g.stroke(); }
      for (let k = 0; k < Math.ceil(w / 4); k++) { const x0 = R() * cw, y0 = R() * ch, r = RR(40, 150), s = g.createRadialGradient(x0, y0, 0, x0, y0, r); s.addColorStop(0, 'rgba(18,14,12,0.8)'); s.addColorStop(1, 'rgba(18,14,12,0)'); g.fillStyle = s; g.fillRect(x0 - r, y0 - r, 2 * r, 2 * r); }
    }
    if (o.hole) { g.fillStyle = '#0d0c0b'; g.beginPath(); const hx = cw * (1 - o.hole); g.moveTo(cw, ch); for (let k = 0; k <= 10; k++) g.lineTo(hx + (cw - hx) * (k / 10) + RR(-10, 10), ch * (0.05 + 0.5 * R())); g.lineTo(hx, ch); g.closePath(); g.fill(); }
    const lit = LIT >= 1 && LIT <= 3 && !DOWN;
    const mat = new THREE.MeshStandardMaterial({ map: tex(base), roughness: 0.85, metalness: 0, emissive: lit ? '#ffffff' : '#000000', emissiveMap: lit ? tex(emit) : null, emissiveIntensity: lit ? 1.5 : 0 });
    mat.envMapIntensity = 0.4;
    if (lit) mat.userData.glow = '#ffe2b0';
    return mesh(new THREE.PlaneGeometry(w, h), mat, x, y + h / 2, z, { ry, dirt: 0, cast: false });
  }
  // A mosaic on a blank gable end, as the old blocks had: the ringed planet over hills and a rising arc of stars, in
  // small glazed tiles (no people).
  function mural(g, cw, ch) {
    const t = Math.max(6, Math.round(cw / 26)), cx = cw * 0.5, cy = ch * 0.36, r = cw * 0.26;
    for (let y = 0; y < ch; y += t) for (let x = 0; x < cw; x += t) {
      const px = x + t / 2, py = y + t / 2, dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy), ring = Math.abs((dx * 0.96 + dy * 0.28) ** 2 / (r * 1.9) ** 2 + (dy * 0.96 - dx * 0.28) ** 2 / (r * 0.42) ** 2 - 1) < 0.22;
      let col;
      if (ring && !(d < r && dy * 0.96 - dx * 0.28 < 0)) col = [232, 196, 120];
      else if (d < r) col = dy < -r * 0.2 ? [86, 150, 176] : [62, 118, 150];
      else if (py > ch * 0.74 + Math.sin(px / cw * 6.3) * ch * 0.04) col = py > ch * 0.86 ? [70, 110, 62] : [96, 140, 74];
      else col = (Math.sin(px * 0.7) * Math.cos(py * 0.9) > 0.985) ? [240, 236, 220] : [36 + py / ch * 30, 52 + py / ch * 40, 88 + py / ch * 30];
      const v = RR(-14, 14);
      g.fillStyle = `rgb(${col[0] + v},${col[1] + v},${col[2] + v})`; g.fillRect(x + 1, y + 1, t - 2, t - 2);
    }
    g.fillStyle = 'rgba(60,55,48,0.25)'; g.fillRect(0, 0, cw, ch * 0.03);
  }
  // A roof: dark membrane, a parapet with the team's LED strip along every edge (white in tier 4; broken when down).
  const ledM = LIT === 4 ? M.emit('#ffffff', 2.4) : team;
  function roofEdge(x0, x1, z0, z1, y) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    box(w, 0.06, d, C.roof, cx, y, cz, nc);
    for (const [bw, bd, bx, bz] of [[w + 0.3, 0.3, cx, z1], [w + 0.3, 0.3, cx, z0], [0.3, d, x0, cz], [0.3, d, x1, cz]]) {
      box(bw, 0.55, bd, C.concL, bx, y, bz, { dirt: 0.25 });
      const along = bw > bd, lw = along ? bw + 0.1 : 0.2, ld = along ? 0.2 : bd, ox = along ? 0 : (bx < cx ? -0.12 : 0.12), oz = along ? (bz < cz ? -0.12 : 0.12) : 0;
      if (DOWN) { for (let k = 0; k < 6; k++) if (R() < 0.6) box(along ? lw / 6 - 0.05 : lw, 0.1, along ? ld : ld / 6 - 0.05, team, bx + ox + (along ? (k - 2.5) * lw / 6 : 0), y + 0.44, bz + oz + (along ? 0 : (k - 2.5) * ld / 6), nc); }
      else box(lw, 0.16, ld, ledM, bx + ox, y + 0.42, bz + oz, nc);
    }
  }
  function roofKit(x0, x1, z0, z1, y, o = {}) {
    const w = x1 - x0, d = z1 - z0, along = w > d;
    // lift and stair housings along the spine, with vents
    const n = Math.max(2, Math.round((along ? w : d) / 7));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, hx = along ? x0 + t * w : (x0 + x1) / 2, hz = along ? (z0 + z1) / 2 - d * 0.12 : z0 + t * d;
      box(along ? 1.8 : 1.3, 1.2, along ? 1.3 : 1.8, C.concL, hx, y, hz, { dirt: 0.3 });
      box(along ? 2.0 : 1.5, 0.12, along ? 1.5 : 2.0, C.roofD, hx, y + 1.2, hz, nc);
      for (let v = 0; v < 2; v++) cyl(0.18, 0.5, C.steel, hx + (along ? (v - 0.5) * 1.4 + 2.2 : 0.4), y, hz + (along ? 0.3 : (v - 0.5) * 1.4 + 2.2), { seg: 10, dirt: 0.3 });
    }
    // solar panels in rows (the modern touch on old concrete), dishes
    if (o.solar) for (const [sx, sz, sw, sd] of o.solar) for (let k = 0; k < sd; k += 0.9) { const p = box(sw, 0.06, 0.7, DOWN && R() < 0.3 ? C.char : C.solar, sx, y + 0.35, sz + k, nc); p.rotation.x = -0.35; box(sw, 0.3, 0.05, C.steel, sx, y, sz + k + 0.25, nc); }
    if (o.dishes) for (const [dx, dz] of o.dishes) { cyl(0.05, 0.6, C.steel, dx, y, dz, { seg: 6 }); const g = new THREE.SphereGeometry(0.45, 16, 8, 0, PI * 2, 0, PI / 3); const m = mesh(g, C.white, dx, y + 0.9, dz, { dirt: 0.2 }); m.rotation.x = 2.2; }
  }
  // A mast with a red light on top, always burning (bent over when down).
  const redM = LIT < 0 || LIT === 5 ? M.emit('#ff3a22', 2.6) : offM;
  function mast(x, y, z, h, bent) {
    const g = group(x, y, z, 0); if (bent) g.rotation.set(0.9, 0, 0.4);
    cyl(0.07, h, C.steel, 0, 0, 0, { parent: g, seg: 6, dirt: 0.2 });
    for (let k = 1; k < 4; k++) box(0.9 - k * 0.18, 0.04, 0.04, C.steel, 0, h * k / 4, 0, { parent: g, ...nc });
    box(0.2, 0.2, 0.2, redM, 0, h, 0, { parent: g, ...nc });
  }
  // A block: a concrete box, its faces (all but the north, which the camera never sees), its roof unless o.noRoof.
  const FH = 2.7;
  function block(x0, x1, z0, z1, floors, o = {}) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, H = floors * FH;
    box(w, H, d, C.conc, cx, 0, cz, { dirt: 0.3, dirtH: 3 });
    const stairsW = (n) => { const s = []; for (let k = Math.floor(n / 6); k < n; k += 6) s.push(k); return s; };
    const colsW = Math.round(w / 1.5), colsD = Math.round(d / 1.5);
    facade(w, H, cx, 0, z1 + 0.012, 0, floors, { stairs: stairsW(colsW), shops: o.shops, hole: o.hole, tone: o.tone, mural: o.mural ? floors : 0 });
    facade(d, H, x1 + 0.012, 0, cz, PI / 2, floors, { stairs: stairsW(colsD), tone: o.tone });
    facade(d, H, x0 - 0.012, 0, cz, -PI / 2, floors, { stairs: stairsW(colsD), tone: o.tone });
    if (!o.noRoof) roofEdge(x0, x1, z0, z1, H);
    return H;
  }
  // The loggias: slabs and parapets on the south face of a block, every few bays, on the floors above the ground.
  function loggias(x0, x1, z, floors, every, skip = []) {
    const cols = Math.round((x1 - x0) / 1.5), pw = (x1 - x0) / cols;
    for (let c = 0; c < cols - 1; c++) {
      if (c % every !== 1 || skip.includes(c)) continue;
      for (let f = 1; f < floors; f++) {
        if (DOWN && R() < 0.15) continue;
        const bx = x0 + (c + 1) * pw, y = f * FH;
        box(pw * 1.9, 0.14, 0.7, C.concL, bx, y, z + 0.35, { dirt: 0.2 });
        box(pw * 1.9, 0.75, 0.06, C.concD, bx, y + 0.14, z + 0.68, { dirt: 0.3 });
      }
    }
  }
  // An entrance: a lit lobby door (tier 1) under a concrete canopy, facing +z (or turned by ry).
  function entrance(x, z, ry = 0) {
    const g = group(x, 0, z, ry);
    box(1.4, 2.0, 0.05, E('#ffe6b8', 1.8, 1, M.plain('#2a3440', 0.3, 0.2)), 0, 0, 0.03, { parent: g, ...nc });
    box(2.2, 0.16, 1.4, C.concL, 0, 2.3, 0.7, { parent: g, dirt: 0.2 });
    box(2.2, 0.06, 0.06, team, 0, 2.38, 1.4, { parent: g, ...nc });
    for (const s of [-1, 1]) box(0.12, 2.3, 0.12, C.steel, s * 0.95, 0, 1.3, { parent: g, ...nc });
    box(0.5, 0.06, 0.4, E('#fff1d0', 2.2, 1, C.white), 0, 2.24, 0.7, { parent: g, ...nc });
  }

  // north block: five storeys across the north side, facing the square; WELCOME HOME on its roof
  const NZ0 = -16.6, NZ1 = -11.6;
  const NH = block(-16.6, 16.6, NZ0, NZ1, 5, { shops: true });
  loggias(-16.6, 16.6, NZ1, 5, 3, [4, 10, 16]);
  for (const x of [-9, 0, 9]) entrance(x, NZ1);
  roofKit(-16.6, 16.6, NZ0, NZ1, NH, { solar: [[-11, NZ0 + 1.0, 6, 1.8], [11, NZ0 + 1.0, 6, 1.8]], dishes: [[-5.5, NZ0 + 1.3], [5, NZ0 + 1.1]] });
  mast(-15, NH, NZ0 + 1.2, 4.2); mast(15.2, NH, NZ0 + 1.6, 3.2, DOWN);
  // the letters: WELCOME HOME, red on a steel lattice along the roof's front edge; lit red in tier 3. Down: dark and
  // burnt, the C hanging off its frame, the rest lit in tier 5 (the game flickers it).
  {
    const SW = 24, SH = 2.9, y0 = NH + 0.55, z = NZ1 - 0.9, words = 'WELCOME HOME';
    for (let k = 0; k <= 8; k++) { const x = -SW / 2 + k * SW / 8; box(0.08, SH + 0.3, 0.08, C.steel, x, NH, z - 0.25, nc); const b = box(0.06, 0.06, Math.hypot(SH, 0.8), C.steel, x, NH + 0.1, z - 0.6, nc); b.rotation.x = 0.33; }
    box(SW + 0.4, 0.08, 0.08, C.steel, 0, y0 + SH * 0.5, z - 0.25, nc); box(SW + 0.4, 0.1, 0.1, C.steel, 0, y0, z - 0.2, nc);
    const glyph = (ch, mode) => canvasTex(256, (g, n) => {
      g.clearRect(0, 0, n, n); if (mode === 'emit') { g.fillStyle = '#000'; g.fillRect(0, 0, n, n); } g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 240px sans-serif';
      const sx = Math.min(1.6, (n * 0.86) / g.measureText(ch).width); g.translate(n / 2, n * 0.54); g.scale(sx, 1);
      if (mode === 'emit') { g.fillStyle = '#ffffff'; g.fillText(ch, 0, 0); return; }
      g.lineWidth = 16; g.strokeStyle = '#3a3c40'; g.strokeText(ch, 0, 0);
      g.fillStyle = mode === 'burnt' ? '#4a2e28' : '#c23a2c'; g.fillText(ch, 0, 0);
    });
    const step = SW / words.length;
    for (let k = 0; k < words.length; k++) {
      const ch = words[k]; if (ch === ' ') continue;
      const fallen = DOWN && k === 3, on = (LIT === 3 && !DOWN) || (LIT === 5 && DOWN && !fallen);
      const mat = new THREE.MeshStandardMaterial({ map: glyph(ch, DOWN && (fallen || R() < 0.3) ? 'burnt' : 'day'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.1,
        emissive: on ? '#ffffff' : '#000000', emissiveMap: on ? glyph(ch, 'emit') : null, emissiveIntensity: on ? 1.8 : 0 });
      if (on) mat.userData.glow = '#ff5a3a';
      const x = -SW / 2 + (k + 0.5) * step;
      const m = mesh(new THREE.PlaneGeometry(step * 0.92, SH), mat, x, y0 + SH / 2, z, nc);
      if (fallen) { m.position.set(x + 0.2, NH + 0.4, z + 0.4); m.rotation.set(-1.2, 0, 2.3); }
    }
    L.mark('sign', 0, y0 + SH / 2, z);
  }

  // west and east blocks: five storeys down the sides, entrances onto the square
  const WX0 = -16.6, WX1 = -11.8, SZ0 = -9.4, SZ1 = 9.4;
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? WX0 : -WX1, x1 = s < 0 ? WX1 : -WX0;
    const H = block(x0, x1, SZ0, SZ1, 5, { tone: s * 4, mural: !DOWN || s < 0 });
    for (const z of [-4.5, 4.5]) entrance(s < 0 ? x1 : x0, z, s < 0 ? PI / 2 : -PI / 2);
    roofKit(x0, x1, SZ0, SZ1, H, { solar: [[(x0 + x1) / 2, SZ1 - 3.2, 3.2, 2.0]], dishes: s > 0 ? [[(x0 + x1) / 2 - 1.2, SZ0 + 1.0]] : [] });
    mast((x0 + x1) / 2 + s * 1.2, H, SZ0 + 0.9, 3.0);
  }

  // south block: three storeys along the street, split by a gateway onto the square (a bridge of flats over it)
  const SB0 = 11.8, SB1 = 15.6, GW = 3.8, HOLE = DOWN ? 0.3 : 0;
  {
    const HW = block(-16.6, -GW, SB0, SB1, 3, { shops: true, noRoof: true });
    block(GW, 16.6, SB0, SB1, 3, { shops: true, hole: HOLE, noRoof: true });
    box(2 * GW, FH, SB1 - SB0, C.conc, 0, 2 * FH, (SB0 + SB1) / 2, { dirt: 0.3 });
    facade(2 * GW, FH, 0, 2 * FH, SB1 + 0.012, 0, 1, { floor0: 2, of: 3 });
    box(2 * GW, 0.3, SB1 - SB0, C.concD, 0, 2 * FH - 0.3, (SB0 + SB1) / 2, nc);
    roofEdge(-16.6, 16.6, SB0, SB1, HW);
    roofKit(-16.6, -GW, SB0, SB1, HW); roofKit(GW, 16.6, SB0, SB1, HW);
    // the passage: concrete piers, a lamp under the bridge (tier 0)
    for (const s of [-1, 1]) box(0.5, 2 * FH, 0.5, C.concD, s * (GW - 0.3), 0, SB1 - 0.3, { dirt: 0.3 });
    box(1.2, 0.08, 0.4, E('#fff1d0', 2.2, 0), 0, 2 * FH - 0.38, (SB0 + SB1) / 2, nc);
    box(2 * GW, 0.06, SB1 - SB0 + 1.2, C.paving, 0, 0, (SB0 + SB1) / 2, nc);
    loggias(-16.6, -GW, SB1, 3, 3); loggias(GW, 16.6 - (HOLE ? 4 : 0), SB1, 3, 3);
    for (const x of [-12, -7.5, 8, 12.5]) if (!(HOLE && x > 11)) entrance(x, SB1);
  }
  // the blown-out east end of the south block: a dark gap and rubble spilling into the street
  if (DOWN) {
    const xs = 16.6 - (16.6 - GW) * HOLE;
    box(16.6 - xs + 0.2, 5.0, SB1 - SB0 - 0.6, C.ash, (xs + 16.6) / 2, 0, (SB0 + SB1) / 2, { dirt: 0 });
    for (let k = 0; k < 90; k++) {
      const x = RR(xs - 1, 17.5), z = RR(SB0 - 1, 18.8), s = RR(0.25, 1.3);
      const m = box(s, s * RR(0.4, 0.9), s * RR(0.6, 1.2), R() < 0.4 ? C.rubbleD : C.rubble, x, RR(0, 0.25), z, { dirt: 0.5 });
      m.rotation.set(RR(-0.5, 0.5), R() * PI, RR(-0.5, 0.5));
    }
    for (let k = 0; k < 7; k++) { const m = box(RR(2, 3.5), 0.14, 0.14, C.steel, RR(xs, 16.5), RR(0.2, 1.5), RR(SB0, 17), { dirt: 0.2 }); m.rotation.set(RR(-0.6, 0.6), R() * PI, RR(-0.6, 0.6)); }
    // fallen panels lying on the square, cracked
    for (const [x, z, a] of [[-6, -10.2, 0.3], [8.5, -9.8, -0.5], [-10.5, 4, 1.4], [10.6, -2, 1.7]]) { const p = box(1.5, 0.22, 2.6, C.conc, x, 0.05, z, { dirt: 0.6 }); p.rotation.set(RR(-0.1, 0.1), a, RR(-0.15, 0.15)); }
  }

  // ---------------------------------------------------------------------------- the square
  function tree(x, y, z, s = 1, kind = 'round') {
    const burnt = DOWN && R() < 0.6;
    cyl(0.1 * s, 0.9 * s, burnt ? C.char : C.trunk, x, y, z, { seg: 7, dirt: 0.2 });
    if (burnt) { for (let k = 0; k < 3; k++) { const m = box(0.06 * s, 0.6 * s, 0.06 * s, C.char, x, y + 0.7 * s, z, { dirt: 0 }); m.rotation.set(RR(-0.8, 0.8), R() * PI, RR(-0.8, 0.8)); } return; }
    const leaf = leafM[Math.floor(R() * leafM.length)];
    if (kind === 'cone') { const g = new THREE.ConeGeometry(0.55 * s, 1.6 * s, 8); g.translate(0, 0.8 * s, 0); mesh(g, leaf, x, y + 0.6 * s, z, { dirt: 0 }); }
    else { const g = new THREE.IcosahedronGeometry(0.62 * s, 1); const m = mesh(g, leaf, x, y + 1.15 * s, z, { dirt: 0 }); m.scale.set(1, 0.85, 1); }
  }
  const scorchTex = canvasTex(256, (g, n) => { for (let k = 0; k < 14; k++) { const x = n / 2 + RR(-50, 50), y = n / 2 + RR(-50, 50), r = RR(40, 90), s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(18,13,10,0.55)'); s.addColorStop(1, 'rgba(18,13,10,0)'); g.fillStyle = s; g.fillRect(0, 0, n, n); } });
  function scorch(x, y, z, r) { const g = new THREE.PlaneGeometry(2 * r * 1.4, 2 * r * 1.4); g.rotateX(-PI / 2); const m = mesh(g, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false }), x, y + 0.14, z, { dirt: 0, cast: false }); m.userData.decal = true; m.rotation.y = R() * PI; }
  {
    // four lawns, kerbed, round a round middle; paths between them
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x0 = sx * 2.4, x1 = sx * 10.2, z0 = sz * 2.2, z1 = sz < 0 ? -10.2 : 10.4;
      const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      box(w + 0.24, 0.14, d + 0.24, C.kerb, cx, 0, cz, nc);
      box(w, 0.16, d, sz < 0 ? C.grass : C.grassD, cx, 0, cz, { dirt: 0, cast: false });
    }
    const disc = new THREE.CylinderGeometry(4.6, 4.6, 0.2, 48); disc.translate(0, 0.1, 0); mesh(disc, C.paving, 0, 0.01, 0, { dirt: 0.15, cast: false });
    { const g = new THREE.RingGeometry(4.45, 4.6, 48); g.rotateX(-PI / 2); mesh(g, C.kerb, 0, 0.215, 0, nc); }
    for (const [x, z, s] of [[-8.6, -8.4, 1.1], [-4.4, -8.8, 0.9], [8.8, -8.2, 1.0], [4.6, -7.6, 0.85], [-8.8, 8.6, 1.0], [-4.2, 9.0, 0.85], [8.6, 8.8, 1.1], [4.4, 8.4, 0.9], [-9.2, -3.6, 0.8], [9.2, 3.8, 0.8], [-3.2, -5.8, 0.75], [3.4, 5.6, 0.75], [-9.4, 5.2, 0.9], [9.0, -4.6, 0.9], [-6.6, -6.0, 0.7], [6.8, 7.0, 0.7]]) tree(x, 0.16, z, s);
    for (const [x, z, ry] of [[-6, -1.4, 0], [6, -1.4, 0], [-6, 1.4, PI], [6, 1.4, PI]]) { const g = group(x, 0, z, ry); box(1.4, 0.08, 0.4, C.wood, 0, 0.45, 0, { parent: g, ...nc }); box(1.4, 0.35, 0.06, C.wood, 0, 0.5, -0.2, { parent: g, ...nc }); for (const s of [-0.6, 0.6]) box(0.08, 0.45, 0.35, C.steel, s, 0, 0, { parent: g, ...nc }); }
    // the deer (from the Pathfinder's garden), grazing on the lawns
    if (!DOWN) for (const [x, z, a] of [[-6.8, 5.6, 0.4], [-5.2, 7.0, 2.6], [7.0, -5.0, 1.2]]) {
      const g = group(x, 0.16, z, a), D = M.plain('#8a5f3a', 0.85, 0), d2 = M.plain('#e8dccb', 0.85, 0);
      const body = mesh(new THREE.SphereGeometry(0.3, 12, 8), D, 0, 0.62, 0, { parent: g, dirt: 0 }); body.scale.set(1.5, 0.75, 0.75);
      for (const [lx, lz] of [[-0.3, -0.12], [-0.3, 0.12], [0.3, -0.12], [0.3, 0.12]]) cyl(0.035, 0.5, D, lx, 0.05, lz, { parent: g, seg: 5, dirt: 0 });
      const neck = box(0.1, 0.45, 0.1, D, 0.44, 0.38, 0, { parent: g, dirt: 0 }); neck.rotation.z = -0.9;
      mesh(new THREE.SphereGeometry(0.11, 10, 8), D, 0.66, 0.24, 0, { parent: g, dirt: 0 });
      mesh(new THREE.SphereGeometry(0.07, 8, 6), d2, -0.45, 0.66, 0, { parent: g, dirt: 0 });
    }
    // the fountain, south of the stele: a round basin, lit from inside at dusk (tier 0)
    { const fz = 2.5;
      cyl(1.7, 0.45, C.concL, 0, 0.2, fz, { seg: 32, dirt: 0.2 });
      const g = new THREE.CircleGeometry(1.5, 32); g.rotateX(-PI / 2);
      mesh(g, DOWN ? M.plain('#2b2a26', 0.9, 0) : LIT === 0 ? M.emit('#7fd8ff', 1.2) : C.water, 0, 0.66, fz, nc);
      if (!DOWN) cyl(0.12, 0.9, LIT === 0 ? M.emit('#dff6ff', 1.6) : M.plain('#d8eef8', 0.2, 0), 0, 0.66, fz, { seg: 8, rTop: 0.03 }); }
    // the stele: a concrete shaft on a plinth, the Arrival clock on its face, the Ring round its top
    {
      const z0 = -1.6;
      box(3.0, 0.5, 1.8, C.concD, 0, 0.2, z0, { dirt: 0.3 });
      box(1.0, 6.4, 0.7, C.concL, 0, 0.7, z0, { dirt: 0.25, dirtH: 2 });
      const face = (mode) => canvasTex(256, (g, n) => {
        g.fillStyle = mode === 'emit' ? '#000' : DOWN ? '#121212' : '#15191e'; g.fillRect(0, 0, n, n);
        if (mode !== 'emit') { g.strokeStyle = '#6a6e72'; g.lineWidth = 8; g.strokeRect(4, 4, n - 8, n - 8); }
        g.fillStyle = mode === 'emit' ? '#ffffff' : DOWN ? '#2c2a27' : '#7a5a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 34px monospace'; g.fillText('ARRIVAL', n / 2, n * 0.2);
        g.font = 'bold 92px monospace'; g.fillText('T+31', n / 2, n * 0.55);
        g.font = 'bold 30px monospace'; g.fillText('YEARS', n / 2, n * 0.84);
        if (DOWN && mode !== 'emit') { g.strokeStyle = 'rgba(200,200,200,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(n * 0.2, n * 0.1); g.lineTo(n * 0.5, n * 0.5); g.lineTo(n * 0.4, n * 0.95); g.moveTo(n * 0.5, n * 0.5); g.lineTo(n * 0.9, n * 0.6); g.stroke(); }
      });
      const on = (LIT === 3 && !DOWN) || (LIT === 5 && DOWN);
      const cm = new THREE.MeshStandardMaterial({ map: face('day'), roughness: 0.4, metalness: 0.1, emissive: on ? '#ffffff' : '#000000', emissiveMap: on ? face('emit') : null, emissiveIntensity: on ? 1.7 : 0 });
      if (on) cm.userData.glow = '#ffb347';
      const CY = 5.2, CZ = z0 + 0.36;
      mesh(new THREE.PlaneGeometry(0.9, 0.9), cm, 0, CY, CZ, nc);
      L.mark('clock', 0, CY, CZ);
      // the Ring: a flat band tilted round the shaft's top, like the planet's own (lit pale in tier 3)
      const rg = new THREE.TorusGeometry(2.0, 0.09, 8, 64); rg.scale(1, 1, 0.35);
      const ring = mesh(rg, LIT === 3 && !DOWN ? M.emit('#d6f2ff', 2.2) : M.paint('#c9ccd0', { rivets: false, metal: 0.6 }), 0, 6.5, z0, nc);
      ring.rotation.set(PI / 2 - 0.25, 0, 0.18);
      const b2 = mesh(new THREE.TorusGeometry(2.35, 0.04, 6, 64), LIT === 3 && !DOWN ? M.emit('#9fe0ff', 1.6) : C.steel, 0, 6.5, z0, nc); b2.rotation.set(PI / 2 - 0.25, 0, 0.18);
      cyl(0.35, 0.5, C.concL, 0, 7.1, z0, { seg: 20, rTop: 0.05 });
    }
    // square lamps (tier 0): round the middle and along the paths
    for (const [x, z] of [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6], [-1.8, -10], [1.8, -10], [-1.8, 10.4], [1.8, 10.4], [-10.8, -1.6], [-10.8, 1.6], [10.8, -1.6], [10.8, 1.6]]) {
      const lean = DOWN && R() < 0.35, g = group(x, 0, z, 0); if (lean) g.rotation.set(RR(-0.5, 0.5), 0, RR(-0.5, 0.5));
      cyl(0.05, 2.2, C.steel, 0, 0, 0, { parent: g, seg: 8, dirt: 0.2 });
      cyl(0.22, 0.12, E('#ffe6b0', 3, DOWN ? 9 : 0), 0, 2.2, 0, { parent: g, seg: 12 });
      cyl(0.26, 0.05, C.dark, 0, 2.32, 0, { parent: g, seg: 12 });
    }
    if (DOWN) for (const [x, z, r] of [[-6, -5, 1.6], [5, 6, 1.8], [0.5, -5.5, 1.2], [-7.5, 7, 1.3], [8, -7, 1.4]]) scorch(x, 0.05, z, r);
  }

  // ---------------------------------------------------------------------------- the street: the tram and its stop
  {
    const tz = RI + RW / 2, ty = 0.12;
    // the stop, by the gateway: a glass shelter, its strip light and departure board (tier 0)
    const sx = 6.6, sz = 16.6;
    box(5.0, 0.18, 1.2, C.kerb, sx, 0, sz, { dirt: 0.2, cast: false });
    for (const dx of [-2.2, 2.2]) box(0.1, 2.2, 0.1, C.steel, sx + dx, 0.18, sz - 0.4, nc);
    box(4.8, 0.08, 1.3, DOWN ? C.char : C.white, sx, 2.38, sz, { dirt: 0.2 }); box(4.8, 0.06, 0.06, team, sx, 2.46, sz + 0.65, nc);
    if (!DOWN) box(4.4, 1.6, 0.04, C.glass, sx, 0.3, sz - 0.45, nc);
    box(4.2, 0.05, 0.1, E('#fff1d0', 2.2, 0), sx, 2.3, sz, nc);
    box(3.2, 0.08, 0.35, C.wood, sx, 0.62, sz - 0.2, nc);
    const board = canvasTex(256, (g, n) => { g.fillStyle = '#0c0d0f'; g.fillRect(0, 0, n, n); g.fillStyle = LIT === 0 ? '#ffb43a' : '#3a3428'; g.font = 'bold 30px monospace';
      ['TRAM 1', 'CENTRAL  ON TIME', 'HARBOUR  ON TIME', 'FIELDS   ON TIME'].forEach((t, k) => g.fillText(t, 8, 40 + k * 52)); });
    const bm = new THREE.MeshStandardMaterial({ map: board, roughness: 0.5, emissive: LIT === 0 ? '#ffffff' : '#000000', emissiveMap: LIT === 0 ? board : null, emissiveIntensity: LIT === 0 ? 1.5 : 0 });
    if (LIT === 0) bm.userData.glow = '#ffb43a';
    box(0.1, 1.5, 0.1, C.steel, sx - 2.9, 0, sz, nc);
    mesh(new THREE.PlaneGeometry(1.4, 0.75), bm, sx - 2.9, 1.65, sz + 0.06, nc);
    L.mark('stop', sx, 1.2, sz);
    // the tram: two cars waiting at the stop, empty; its windows lit at dusk (tier 0)
    for (const [x0, len] of [[-2.6, 6.0], [3.6, 6.0]]) {
      const cx = x0 + len / 2, body = M.paint(DOWN ? '#8a8378' : '#e6e3dc', { rivets: false });
      box(len, 1.45, 1.6, body, cx, ty + 0.25, tz, { dirt: 0.25 });
      box(len + 0.02, 0.3, 1.62, C.red, cx, ty + 0.25, tz, nc);
      box(len + 0.02, 0.08, 1.62, team, cx, ty + 0.6, tz, nc);
      box(len - 0.6, 0.55, 1.63, LIT === 0 && !DOWN ? M.emit('#ffe7b8', 1.4) : M.plain(DOWN ? '#121416' : '#25303a', 0.2, 0.3), cx, ty + 0.85, tz, nc);
      box(len - 0.2, 0.1, 1.4, M.plain('#5b6066', 0.6, 0.4), cx, ty + 1.7, tz, nc);
      for (const dx of [-len / 2 + 0.9, len / 2 - 0.9]) box(0.5, 0.25, 1.3, C.dark, cx + dx, ty, tz, nc);
    }
    const pg = box(0.06, 1.1, 0.06, C.steel, 2.4, 1.85, tz, nc); pg.rotation.z = 0.5; // (the pantograph)
  }
  // street lamps along the outer pavement (tier 0), and trees at the corners
  {
    const pts = [];
    for (let k = -16; k <= 16; k += 5.3) pts.push([k, -17.0], [-17.0, k], [17.0, k]);
    for (const x of [-16, -10.5, -5, 12, 16.4]) pts.push([x, 17.0]);
    for (const [x, z] of pts) {
      const lean = DOWN && R() < 0.35, g = group(x, 0, z, 0);
      if (lean) g.rotation.set(RR(-0.5, 0.5), 0, RR(-0.5, 0.5));
      cyl(0.06, 2.7, C.steel, 0, 0, 0, { parent: g, seg: 8, dirt: 0.2 });
      const out = [Math.abs(x) > 16.9 ? Math.sign(x) * 0.4 : 0, Math.abs(z) > 16.9 ? Math.sign(z) * 0.4 : 0];
      box(0.1, 0.06, 0.1, C.steel, out[0] / 2, 2.65, out[1] / 2, { parent: g, ...nc });
      box(0.3, 0.1, 0.3, E('#ffe6b0', 3, DOWN ? 9 : 0), out[0], 2.58, out[1], { parent: g, ...nc });
    }
    for (const [x, z] of [[-18.2, -18.2], [18.2, -18.2], [-18.2, 18.2], [18.2, 18.2], [-10.6, -10.6], [10.6, -10.6], [-10.6, 10.8], [10.6, 10.8]]) tree(x, 0, z, 0.85, Math.abs(x) > 15 ? 'round' : 'cone');
  }
  ao(0, -1, 34, 34, 0.35);
  if (DOWN) for (const [x, z, r] of [[-10, -14, 1.6], [6, -14, 1.4], [-14, 2, 1.3], [14, -5, 1.5], [-9, 13.6, 1.5], [12, 18.5, 1.3]]) scorch(x, z < -11 ? NH - 0.04 : z > 11.5 && z < 16 ? 3 * FH - 0.04 : Math.abs(x) > 11.5 && Math.abs(z) < 9.4 ? 5 * FH - 0.04 : -0.1, z, r);
  // night: a faint moonlit fill so the blocks read in the dark (no light of its own: the game adds the City's)
  if (L.TOD === 'night' && LIT < 0) pointLight('#8fa6ff', 3, 0, 24, 16, 46);
}
