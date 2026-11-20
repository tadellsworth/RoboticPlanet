// Arrival City (IDEAS.md "Megastructures", the owner's look A, "Terraced Arcology", Nov 2026): a 4 x 4 megastructure
// (40 x 40 world units, the middle of its sixteen tiles at the origin), a stepped block of homes like a ziggurat, built
// for colonists who never came. Rendered on one wide frame (the pad's 40 units across 0.64 of it, about 6.2 tiles).
//   Three terraces of homes, each with two rows of windows on its faces and a team-colour band along its parapet,
//   stepping back to the north so their roofs face the player as gardens: on the first, a school (its own small block,
//   a running track and a playground) and a park with a pond; on the second, allotments, an orchard and two deer from the
//   Pathfinder's garden grazing; on the third, a fountain square before the glass atrium at the top, where the Arrival
//   clock reads T+31. Round the outside a ring road with tram rails, the Arrival Station on the south side (a glass
//   canopy over an empty tram and a departure board), bus shelters, street lamps and a welcome sign.
//   ?state=down          the battle-damaged City (knocked down to 0): its windows dark and many broken, scorch over its
//                        faces and terraces, a corner of the first terrace blown out into rubble, burnt trees, the
//                        atrium's glass shattered, the clock dark, lamps knocked askew.
//   ?part=lit&tier=k     only the lights of tier k (in the glow pass), for the game to switch on at dusk one after
//                        another, on a timer: 0 the street lamps, shelters, station, tram and welcome sign; 1 the first
//                        terrace's windows and the school; 2 the second terrace's; 3 the third's, the atrium and the clock.
//                        The beauty pass is the plain City and isn't used.
//   Every other render has all of those lights off (windows dark glass, lamps unlit): the game adds them.
// Marks: 'clock' (the clock face), 'atrium' (the atrium's middle), 'station' (the departure board).
const Q = new URLSearchParams(location.search);
const PART = Q.get('part') || 'base', LIT = PART === 'lit' ? +(Q.get('tier') || 0) : -1, DOWN = Q.get('state') === 'down';
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, sphere, mesh, group, ao, pointLight, canvasTex, M, THREE } = L;
  L.seed(4410 + (DOWN ? 7 : 0));
  L.frameCompoundOpts({ half: 20.12, width: 0.64, cy: 0.6 });
  // The sun's shadows reach the whole 40-unit square (the shared set-up covers a single tile's pad and a little more).
  L.getScene().traverse((o) => {
    if (!o.isDirectionalLight || !o.castShadow) return;
    o.position.multiplyScalar(3);
    const c = o.shadow.camera; c.left = -27; c.right = 27; c.top = 27; c.bottom = -27; c.near = 1; c.far = 160; c.updateProjectionMatrix();
  });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const nc = { dirt: 0, cast: false };
  // A light that belongs to tier k: lit only in that tier's pass (the glow pass of ?part=lit&tier=k); dark otherwise.
  const offM = M.plain('#2a2c30', 0.5, 0.2);
  const E = (hex, k, tier, off) => (LIT === tier ? M.emit(hex, k) : off || offM);
  const team = M.paint(L.TEAM, { rivets: false, rough: 0.55 });
  const C = {
    render: M.rough('#ddd1bb'), renderD: M.rough('#c9bca4'), renderS: M.rough('#b9ab92'), slab: M.rough('#a8a294'),
    paving: M.rough('#bcb6aa'), kerb: M.rough('#d6d2c8'), asphalt: M.plain('#3a3c40', 0.9, 0), line: M.plain('#e8e4d8', 0.7, 0),
    steel: M.steel, dark: M.dark, white: M.paint('#e9e6de', { rivets: false, rough: 0.5 }), grass: M.plain('#6f9a4e', 0.95, 0),
    grassD: M.plain('#5a8441', 0.95, 0), soil: M.plain('#6b5136', 0.95, 0), water: new THREE.MeshPhysicalMaterial({ color: '#3d7ea6', roughness: 0.05, metalness: 0.1, clearcoat: 0.9, envMapIntensity: 1.2 }),
    trunk: M.plain('#5b4330', 0.9, 0), track: M.plain('#b4553a', 0.9, 0), wood: M.wood, glassRoof: new THREE.MeshPhysicalMaterial({ color: '#a8d4e6', roughness: 0.06, transparent: true, opacity: 0.38, clearcoat: 0.9, envMapIntensity: 1.5 }),
    ash: M.plain('#2a2522', 0.95, 0), char: M.plain('#3a2f28', 0.95, 0), rubble: M.rough('#9c9283'), rubbleD: M.rough('#6e665b'),
  };
  if (DOWN) { C.grass = M.plain('#6a7a48', 0.95, 0); C.grassD = M.plain('#56633c', 0.95, 0); }
  const leafM = ['#5e9a48', '#4f8a3f', '#6fa654', '#7aa957', '#58913f'].map((h) => M.plain(h, 0.85, 0));

  // ---------------------------------------------------------------------------- the ground: plaza, ring road, rails
  {
    const n = 1024, t = canvasTex(n, (g) => {
      g.fillStyle = '#bdb7ab'; g.fillRect(0, 0, n, n);
      for (let y = 0; y < n; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < n; x += 32) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '60,55,48'},${RR(0.03, 0.09)})`; g.fillRect(x + 1, y + 1, 30, 30); }
      g.strokeStyle = 'rgba(70,64,56,0.35)'; g.lineWidth = 2;
      for (let k = 0; k <= n; k += 32) { g.beginPath(); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); }
      if (DOWN) for (let k = 0; k < 26; k++) { const x = R() * n, y = R() * n, r = RR(30, 120), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(20,16,12,0.75)'); gr.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    });
    t.repeat.set(1, 1);
    const top = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, metalness: 0, vertexColors: true }); top.envMapIntensity = 0.35;
    const geo = new THREE.BoxGeometry(40, 0.6, 40); geo.translate(0, -0.3, 0);
    const m = mesh(geo, [C.slab, C.slab, top, C.slab, C.slab, C.slab], 0, 0, 0, { dirt: 0.3, dirtH: 0.6, cast: false });
    m.userData.pad = true;
    // the ring road round the outside, with kerbs, a dashed line, and tram rails along the south side past the station
    const RW = 2.6, RO = 19.7, RI = RO - RW;
    for (const [w, d, x, z] of [[2 * RO, RW, 0, -(RI + RW / 2)], [2 * RO, RW, 0, RI + RW / 2], [RW, 2 * RI, -(RI + RW / 2), 0], [RW, 2 * RI, RI + RW / 2, 0]]) box(w, 0.06, d, C.asphalt, x, 0, z, nc);
    for (const s of [-1, 1]) {
      box(2 * RI + 0.3, 0.14, 0.18, C.kerb, 0, 0, s * (RI - 0.05), nc); box(0.18, 0.14, 2 * RI + 0.3, C.kerb, s * (RI - 0.05), 0, 0, nc);
      for (let k = -RO + 1.5; k < RO - 1; k += 2.2) { box(1.1, 0.075, 0.12, C.line, k, 0, s * (RI + RW / 2), nc); box(0.12, 0.075, 1.1, C.line, s * (RI + RW / 2), 0, k, nc); }
    }
    for (const dz of [-0.45, 0.45]) box(2 * RO, 0.09, 0.07, C.steel, 0, 0, RI + RW / 2 + dz, nc);
  }

  // ---------------------------------------------------------------------------- facades: windows in rows
  // A face of a terrace, w x h, its window rows (`floors` of them) in a texture; the windows of tier `tier` light up
  // in that tier's pass (an emissive map of the same windows). Faces +z unless turned by ry.
  function facade(w, h, x, y, z, ry, floors, tier, o = {}) {
    const ppu = 40, cw = Math.min(2048, Math.round(w * ppu)), ch = Math.round(h * ppu), cols = Math.max(2, Math.round(w / (o.pitch || 1.3)));
    const base = document.createElement('canvas'); base.width = cw; base.height = ch;
    const emit = document.createElement('canvas'); emit.width = cw; emit.height = ch;
    const g = base.getContext('2d'), e = emit.getContext('2d');
    g.fillStyle = o.wall || '#e0d4be'; g.fillRect(0, 0, cw, ch);
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,75,55' : '255,250,240'},${RR(0.02, 0.06)})`; g.fillRect(R() * cw, R() * ch, RR(10, 70), RR(10, 50)); }
    e.fillStyle = '#000'; e.fillRect(0, 0, cw, ch);
    const fh = ch / floors, pw = cw / cols;
    for (let f = 0; f < floors; f++) {
      const y0 = f * fh;
      // the slab line and its shadow, a balcony rail
      g.fillStyle = 'rgba(70,60,48,0.55)'; g.fillRect(0, y0 + fh - fh * 0.12, cw, fh * 0.05);
      g.fillStyle = 'rgba(255,252,245,0.5)'; g.fillRect(0, y0 + fh - fh * 0.07, cw, fh * 0.07);
      for (let c = 0; c < cols; c++) {
        const wx = c * pw + pw * 0.16, ww = pw * 0.68, wy = y0 + fh * 0.18, wh = fh * 0.58;
        const broken = DOWN && R() < 0.45, burnt = DOWN && R() < 0.25;
        g.fillStyle = '#4a4740'; g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4); // frame
        const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
        if (broken) { gr.addColorStop(0, '#0b0b0c'); gr.addColorStop(1, '#141312'); }
        else { gr.addColorStop(0, '#5a7488'); gr.addColorStop(0.45, '#2c3a48'); gr.addColorStop(1, '#223040'); }
        g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
        if (broken && !burnt) { g.strokeStyle = 'rgba(150,170,185,0.55)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(wx, wy + RR(0, wh)); g.lineTo(wx + RR(0, ww), wy + RR(0, wh)); g.lineTo(wx + ww, wy + RR(0, wh)); g.stroke(); }
        g.fillStyle = 'rgba(30,26,22,0.6)'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); // mullion
        if (burnt) { const r = pw * 0.9, cx = wx + ww / 2, cy = wy, s = g.createRadialGradient(cx, cy, 0, cx, cy, r); s.addColorStop(0, 'rgba(15,12,10,0.85)'); s.addColorStop(1, 'rgba(15,12,10,0)'); g.fillStyle = s; g.fillRect(cx - r, cy - r * 1.6, 2 * r, 2 * r); }
        // its light: warm white, a few warmer or dimmer (curtains drawn, lamps of other colours)
        const v = RR(0.75, 1), warm = R() < 0.15;
        e.fillStyle = warm ? `rgba(255,190,110,${v})` : `rgba(255,232,190,${v})`; e.fillRect(wx, wy, ww, wh);
        e.fillStyle = 'rgba(0,0,0,0.7)'; e.fillRect(wx + ww / 2 - 1, wy, 2, wh);
      }
    }
    if (DOWN) for (let k = 0; k < Math.ceil(w / 5); k++) { const x0 = R() * cw, y0 = R() * ch, r = RR(40, 140), s = g.createRadialGradient(x0, y0, 0, x0, y0, r); s.addColorStop(0, 'rgba(18,14,12,0.8)'); s.addColorStop(1, 'rgba(18,14,12,0)'); g.fillStyle = s; g.fillRect(x0 - r, y0 - r, 2 * r, 2 * r); }
    if (o.hole) { // (a blown-out corner on its west end: a black gap with ragged edges)
      g.fillStyle = '#0d0c0b'; g.beginPath(); const hx = o.hole * cw; g.moveTo(0, ch); for (let k = 0; k <= 10; k++) g.lineTo(hx * (k / 10) + RR(-10, 10), ch * (0.1 + 0.55 * R())); g.lineTo(hx, ch); g.closePath(); g.fill();
    }
    const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
    const lit = LIT === tier;
    const mat = new THREE.MeshStandardMaterial({ map: tex(base), roughness: 0.8, metalness: 0, emissive: lit ? '#ffffff' : '#000000', emissiveMap: lit ? tex(emit) : null, emissiveIntensity: lit ? 1.4 : 0 });
    mat.envMapIntensity = 0.4;
    if (lit) mat.userData.glow = '#ffe2b0';
    const geo = new THREE.PlaneGeometry(w, h);
    const m = mesh(geo, mat, x, y + h / 2, z, { ry, dirt: 0, cast: false });
    return m;
  }

  // ---------------------------------------------------------------------------- the terraces
  // [x0, x1, z0, z1, y0, y1, floors, tier]: each steps back to the north, so its roof garden faces the player.
  const TIERS = [[-15, 15, -15, 13, 0, 6.3, 3, 1], [-11, 11, -13.5, 6.5, 6.3, 12.0, 3, 2], [-7.2, 7.2, -12, 0.6, 12.0, 16.0, 2, 3]];
  const HOLE = DOWN ? 0.32 : 0; // (the first terrace's south-west corner blown out: the first third of its south face)
  for (const [x0, x1, z0, z1, y0, y1, fl, tier] of TIERS) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = y1 - y0;
    box(w, h - 0.02, d, C.renderS, cx, y0, cz, { dirt: 0.25, dirtH: 3 });
    const wall = tier === 1 ? '#e2d5bd' : tier === 2 ? '#e6dac3' : '#ebe0cb';
    facade(w, h - 0.5, cx, y0 + 0.05, z1 + 0.012, 0, fl, tier, { wall, hole: tier === 1 ? HOLE : 0 });
    facade(d, h - 0.5, x1 + 0.012, y0 + 0.05, cz, PI / 2, fl, tier, { wall });
    facade(d, h - 0.5, x0 - 0.012, y0 + 0.05, cz, -PI / 2, fl, tier, { wall });
    // the parapet with the team band, and the roof slab
    box(w + 0.3, 0.42, 0.3, C.white, cx, y1 - 0.42, z1 + 0.02, { dirt: 0.2 });
    box(0.3, 0.42, d + 0.3, C.white, x0 - 0.02, y1 - 0.42, cz, { dirt: 0.2 }); box(0.3, 0.42, d + 0.3, C.white, x1 + 0.02, y1 - 0.42, cz, { dirt: 0.2 });
    box(w + 0.34, 0.2, 0.33, team, cx, y1 - 0.34, z1 + 0.02, nc);
    box(0.33, 0.2, d + 0.34, team, x0 - 0.02, y1 - 0.34, cz, nc); box(0.33, 0.2, d + 0.34, team, x1 + 0.02, y1 - 0.34, cz, nc);
    // the colony's banners hanging down the south face, between the window bays
    if (tier < 3) for (const bx of tier === 1 ? [-9.5, 0, 9.5] : [-5.5, 5.5]) if (!(HOLE && tier === 1 && bx < 0)) box(0.9, h * 0.62, 0.05, team, bx, y1 - 0.45 - h * 0.62, z1 + 0.08, { dirt: 0, cast: false });
    // its ground-floor arcade: a strip of columns along the south face
    if (tier === 1) for (let x = x0 + 1; x < x1 - 0.5; x += 2) if (!(HOLE && x < x0 + w * HOLE)) box(0.24, 1.2, 0.24, C.white, x, 0, z1 + 0.5, { dirt: 0.3 });
  }
  // the blown-out corner: a dark gap in the first terrace and its rubble spilling onto the plaza
  if (DOWN) {
    const x1 = -15 + 30 * HOLE;
    box(x1 + 15, 4.2, 3.5, C.ash, (x1 - 15) / 2 - 0.2, 0, 11.4, { dirt: 0 });
    for (let k = 0; k < 80; k++) {
      const x = RR(-16, x1 + 1), z = RR(10.5, 16.5), s = RR(0.25, 1.2);
      const m = box(s, s * RR(0.4, 0.9), s * RR(0.6, 1.2), R() < 0.4 ? C.rubbleD : C.rubble, x, RR(0, 0.25), z, { dirt: 0.5 });
      m.rotation.set(RR(-0.5, 0.5), R() * PI, RR(-0.5, 0.5));
    }
    for (let k = 0; k < 7; k++) { const m = box(RR(2, 3.5), 0.14, 0.14, C.steel, RR(-14, x1), RR(0.2, 1.5), RR(11, 15), { dirt: 0.2 }); m.rotation.set(RR(-0.6, 0.6), R() * PI, RR(-0.6, 0.6)); } // twisted rebar
  }

  // ---------------------------------------------------------------------------- terrace gardens
  function tree(x, y, z, s = 1, kind = 'round') {
    const burnt = DOWN && R() < 0.6;
    cyl(0.1 * s, 0.9 * s, burnt ? C.char : C.trunk, x, y, z, { seg: 7, dirt: 0.2 });
    if (burnt) { for (let k = 0; k < 3; k++) { const m = box(0.06 * s, 0.6 * s, 0.06 * s, C.char, x, y + 0.7 * s, z, { dirt: 0 }); m.rotation.set(RR(-0.8, 0.8), R() * PI, RR(-0.8, 0.8)); } return; }
    const leaf = leafM[Math.floor(R() * leafM.length)];
    if (kind === 'cone') { const g = new THREE.ConeGeometry(0.55 * s, 1.6 * s, 8); g.translate(0, 0.8 * s, 0); mesh(g, leaf, x, y + 0.6 * s, z, { dirt: 0 }); }
    else { const g = new THREE.IcosahedronGeometry(0.62 * s, 1); const m = mesh(g, leaf, x, y + 1.15 * s, z, { dirt: 0 }); m.scale.set(1, 0.85, 1); }
  }
  function lawn(x0, x1, z0, z1, y, mat = C.grass) { box(x1 - x0, 0.12, z1 - z0, mat, (x0 + x1) / 2, y, (z0 + z1) / 2, { dirt: 0, cast: false }); }
  function rail(x0, x1, z, y) { box(x1 - x0, 0.05, 0.05, C.steel, (x0 + x1) / 2, y + 0.55, z, nc); for (let x = x0; x <= x1 + 0.01; x += 1.2) box(0.05, 0.55, 0.05, C.steel, x, y, z, nc); }
  const scorchTex = canvasTex(256, (g, n) => { for (let k = 0; k < 14; k++) { const x = n / 2 + RR(-50, 50), y = n / 2 + RR(-50, 50), r = RR(40, 90), s = g.createRadialGradient(x, y, 0, x, y, r); s.addColorStop(0, 'rgba(18,13,10,0.55)'); s.addColorStop(1, 'rgba(18,13,10,0)'); g.fillStyle = s; g.fillRect(0, 0, n, n); } });
  function scorch(x, y, z, r) { const g = new THREE.PlaneGeometry(2 * r * 1.4, 2 * r * 1.4); g.rotateX(-PI / 2); const m = mesh(g, new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false }), x, y + 0.14, z, { dirt: 0, cast: false }); m.userData.decal = true; m.rotation.y = R() * PI; }

  // first terrace (y 6.3): the school on the west, its running track, a park and pond on the east; tree rows down the sides
  {
    const Y = 6.3;
    lawn(-14.7, 14.7, 6.6, 12.7, Y);
    lawn(-14.7, -11.2, -14.7, 6.6, Y, C.grassD); lawn(11.2, 14.7, -14.7, 6.6, Y, C.grassD);
    for (let z = -13; z < 6; z += 2.4) { tree(-13, Y + 0.12, z, 0.8); tree(13, Y + 0.12, z, 0.8); }
    // the school: a two-storey block with its own windows (tier 1), a flat roof with a little bell turret
    const sx0 = -14.4, sx1 = -8.6, sz0 = 7.0, sz1 = 10.2;
    box(sx1 - sx0, 2.6, sz1 - sz0, C.renderD, (sx0 + sx1) / 2, Y, (sz0 + sz1) / 2, { dirt: 0.3 });
    facade(sx1 - sx0, 2.2, (sx0 + sx1) / 2, Y + 0.12, sz1 + 0.012, 0, 2, 1, { wall: '#f0c98a', pitch: 1.1 });
    facade(sz1 - sz0, 2.2, sx1 + 0.012, Y + 0.12, (sz0 + sz1) / 2, PI / 2, 2, 1, { wall: '#f0c98a', pitch: 1.1 });
    box(sx1 - sx0 + 0.2, 0.18, sz1 - sz0 + 0.2, C.white, (sx0 + sx1) / 2, Y + 2.6, (sz0 + sz1) / 2, { dirt: 0.2 });
    box(0.7, 0.9, 0.7, C.white, sx0 + 1, Y + 2.78, sz0 + 1, { dirt: 0.2 }); cyl(0.5, 0.5, M.paint('#9a3b2e', { rivets: false }), sx0 + 1, Y + 3.68, sz0 + 1, { seg: 4, rTop: 0, ry: PI / 4 });
    // the running track (a red oval round a green infield) and a playground: a slide, swings, a climbing frame
    { const g = new THREE.RingGeometry(1.25, 2.0, 40); g.rotateX(-PI / 2); const m = mesh(g, C.track, 0, Y + 0.14, 0, nc); m.position.set(-4.4, Y + 0.14, 9.6); m.scale.set(1.55, 1, 1); }
    { const g = new THREE.CircleGeometry(1.25, 40); g.rotateX(-PI / 2); const m = mesh(g, M.plain('#79a85a', 0.95, 0), -4.4, Y + 0.145, 9.6, nc); m.scale.set(1.55, 1, 1); }
    box(0.04, 0.02, 1.2, C.line, -4.4, Y + 0.16, 9.6, nc);
    { const px = -12.4, pz = 11.6; box(2.2, 0.06, 1.6, M.plain('#c9a46a', 0.95, 0), px, Y + 0.12, pz, nc);
      for (const sx of [-0.7, 0.7]) box(0.06, 0.9, 0.06, M.paint('#d24a3a', { rivets: false }), px + sx, Y + 0.18, pz - 0.4, nc); box(1.5, 0.06, 0.06, M.paint('#d24a3a', { rivets: false }), px, Y + 1.05, pz - 0.4, nc);
      const sl = box(0.4, 0.05, 1.4, M.paint('#e8c13a', { rivets: false }), px + 0.4, Y + 0.6, pz + 0.3, nc); sl.rotation.x = 0.45; }
    // the park: a pond with a little bridge, paths, trees, benches
    { const g = new THREE.CircleGeometry(1.9, 32); g.rotateX(-PI / 2); const m = mesh(g, DOWN ? M.plain('#2b3a36', 0.3, 0) : C.water, 7, Y + 0.15, 9.5, nc); m.scale.set(1.5, 1, 0.9); }
    box(0.5, 0.1, 2.4, C.wood, 7, Y + 0.24, 9.5, nc);
    box(10, 0.04, 0.6, C.paving, 6.5, Y + 0.13, 12.0, nc); box(0.6, 0.04, 5.4, C.paving, 2.0, Y + 0.13, 9.6, nc);
    for (const [x, z, s] of [[2.8, 7.4, 1], [4.4, 12.0, 0.9], [10.6, 7.4, 1.1], [12.6, 10.6, 1], [11.2, 12.2, 0.8], [3.0, 11.0, 0.8], [8.8, 7.0, 0.9]]) tree(x, Y + 0.12, z, s);
    for (const [x, z] of [[5, 12.5], [9, 12.5]]) { box(0.9, 0.08, 0.3, C.wood, x, Y + 0.45, z, nc); box(0.9, 0.3, 0.06, C.wood, x, Y + 0.5, z + 0.15, nc); }
    for (let x = -14.6; x < 14.7; x += 2.4) if (!(HOLE && x < -5.5)) rail(x, Math.min(x + 2.4, 14.6), 12.85, Y + 0.12);
    if (DOWN) for (const [x, z, r] of [[-3, 8, 1.4], [6, 11, 1.8], [12, 3, 1.2], [-9, 12, 1]]) scorch(x, Y, z, r);
  }

  // second terrace (y 12): allotments, an orchard, a pergola and two deer grazing
  {
    const Y = 12.0;
    lawn(-10.7, 10.7, 0.8, 6.3, Y); lawn(-10.7, -7.4, -13.2, 0.8, Y, C.grassD); lawn(7.4, 10.7, -13.2, 0.8, Y, C.grassD);
    for (let r = 0; r < 4; r++) {
      box(5.6, 0.16, 0.7, C.soil, -6.6, Y + 0.12, 1.6 + r * 1.15, nc);
      if (!DOWN || r % 2) for (let k = 0; k < 9; k++) { const g = new THREE.IcosahedronGeometry(0.17, 0); mesh(g, leafM[(k + r) % 5], -9.1 + k * 0.62, Y + 0.38, 1.6 + r * 1.15, { dirt: 0 }); }
    }
    for (const [x, z] of [[1.5, 2], [3.5, 2.2], [5.6, 2], [7.8, 2.3], [2.4, 4.4], [4.6, 4.6], [6.8, 4.4], [9.2, 4.7]]) tree(x, Y + 0.12, z, 0.62);
    for (let z = -12; z < 0; z += 2.6) { tree(-9, Y + 0.12, z, 0.7, 'cone'); tree(9, Y + 0.12, z, 0.7, 'cone'); }
    // the pergola over a path
    for (let k = 0; k < 4; k++) for (const s of [-0.6, 0.6]) box(0.12, 1.4, 0.12, C.white, -1.2 + s, Y + 0.12, 1.4 + k * 1.3, nc);
    for (let k = 0; k < 6; k++) box(1.6, 0.08, 0.12, C.wood, -1.2, Y + 1.52, 1.2 + k * 0.85, nc);
    // the deer (from the Pathfinder's garden), heads down
    if (!DOWN) for (const [x, z, a] of [[3.2, 5.6, 0.4], [5.4, 3.3, 2.6]]) {
      const g = group(x, Y + 0.12, z, a), D = M.plain('#8a5f3a', 0.85, 0), d2 = M.plain('#e8dccb', 0.85, 0);
      const body = mesh(new THREE.SphereGeometry(0.3, 12, 8), D, 0, 0.62, 0, { parent: g, dirt: 0 }); body.scale.set(1.5, 0.75, 0.75);
      for (const [lx, lz] of [[-0.3, -0.12], [-0.3, 0.12], [0.3, -0.12], [0.3, 0.12]]) cyl(0.035, 0.5, D, lx, 0.05, lz, { parent: g, seg: 5, dirt: 0 });
      const neck = box(0.1, 0.45, 0.1, D, 0.44, 0.38, 0, { parent: g, dirt: 0 }); neck.rotation.z = -0.9;
      mesh(new THREE.SphereGeometry(0.11, 10, 8), D, 0.66, 0.24, 0, { parent: g, dirt: 0 });
      mesh(new THREE.SphereGeometry(0.07, 8, 6), d2, -0.45, 0.66, 0, { parent: g, dirt: 0 });
    }
    for (let x = -10.6; x < 10.7; x += 2.4) rail(x, Math.min(x + 2.4, 10.6), 6.35, Y + 0.12);
    if (DOWN) for (const [x, z, r] of [[-6, 3, 1.5], [4, 4, 1.2], [8, -3, 1.4]]) scorch(x, Y, z, r);
  }

  // third terrace (y 16): a fountain square before the atrium; the atrium with the Arrival clock
  {
    const Y = 16.0;
    box(14, 0.08, 4, C.paving, 0, Y, -1.4, { dirt: 0, cast: false });
    lawn(-6.9, -4.6, -11.7, -3.4, Y, C.grassD); lawn(4.6, 6.9, -11.7, -3.4, Y, C.grassD);
    for (const z of [-11, -8.6, -6.2]) { tree(-5.8, Y + 0.12, z, 0.55, 'cone'); tree(5.8, Y + 0.12, z, 0.55, 'cone'); }
    cyl(1.2, 0.35, C.white, 0, Y + 0.08, -1.2, { seg: 24, dirt: 0.2 });
    { const g = new THREE.CircleGeometry(1.05, 24); g.rotateX(-PI / 2); mesh(g, DOWN ? M.plain('#2b3a36', 0.3, 0) : C.water, 0, Y + 0.42, -1.2, nc); }
    cyl(0.18, 0.9, C.white, 0, Y + 0.4, -1.2, { seg: 10 });
    for (let x = -7; x < 7.1; x += 2.4) rail(x, Math.min(x + 2.4, 7), 0.45, Y + 0.08);
    // the atrium: a tall glass hall, its frame white, its ridge running north-south so its gable faces the player with
    // the Arrival clock set in it; inside, a garden under the glass and a lit floor and back wall (tier 3)
    const ax0 = -4.4, ax1 = 4.4, az0 = -10.8, az1 = -3.2, AH = 4.2, RH = 2.6, acx = 0, acz = (az0 + az1) / 2;
    box(ax1 - ax0, 0.1, az1 - az0, E('#8a6a40', 1.0, 3, M.plain('#d8cbb0', 0.8, 0)), 0, Y + 0.02, acz, nc);
    box(ax1 - ax0 - 0.4, AH - 0.2, 0.12, E('#a07a44', 1.0, 3, M.plain('#cbbd9f', 0.8, 0)), 0, Y + 0.1, az0 + 0.3, nc); // (the back wall, lit from inside)
    for (let k = 0; k < 3; k++) box(0.5, 0.12, 0.5, E('#ffe2a8', 2.0, 3, M.plain('#d9d3c4', 0.5, 0)), -2.6 + k * 2.6, Y + AH - 0.3, acz, nc); // (lamps hung under the ridge)
    for (const [x, z] of [[-2.6, -8.6], [2.4, -8.8], [-1.0, -6.2], [2.8, -5.4], [-3.0, -4.6]]) tree(x, Y + 0.1, z, 0.75);
    const glass = DOWN ? new THREE.MeshPhysicalMaterial({ color: '#2a3036', roughness: 0.4, transparent: true, opacity: 0.55, clearcoat: 0.5 }) : C.glassRoof;
    const frame = C.white;
    for (const x of [ax0, ax1]) for (const z of [az0, az1]) box(0.24, AH, 0.24, frame, x, Y, z, { dirt: 0.2 });
    for (let x = ax0 + 1.1; x < ax1 - 0.1; x += 1.1) box(0.08, AH, 0.08, frame, x, Y, az1, nc);
    for (let z = az0 + 1.27; z < az1 - 0.1; z += 1.27) for (const x of [ax0, ax1]) box(0.08, AH, 0.08, frame, x, Y, z, nc);
    for (const z of [az0, az1]) box(ax1 - ax0, 0.16, 0.16, frame, 0, Y + AH, z, nc);
    for (const x of [ax0, ax1]) box(0.16, 0.16, az1 - az0, frame, x, Y + AH, acz, nc);
    box(ax1 - ax0, 0.1, 0.1, frame, 0, Y + AH * 0.5, az1, nc);
    // the glass walls (shattered in places when down)
    for (const [w, d, x, z] of [[ax1 - ax0, 0.04, 0, az1], [0.04, az1 - az0, ax0, acz], [0.04, az1 - az0, ax1, acz]]) {
      if (!DOWN) box(w, AH, d, glass, x, Y, z, nc);
      else for (let k = 0; k < 6; k++) if (R() < 0.5) box(w > d ? w / 6 - 0.05 : w, AH * RR(0.3, 1), w > d ? d : d / 6 - 0.05, glass, w > d ? x - w / 2 + (k + 0.5) * w / 6 : x, Y, w > d ? z : z - d / 2 + (k + 0.5) * d / 6, nc);
    }
    // the roof: two glass slopes east and west of a north-south ridge, ribbed in white
    const hw = (ax1 - ax0) / 2, sl = Math.hypot(hw, RH), ang = Math.atan2(RH, hw);
    for (const s of [-1, 1]) {
      if (DOWN && s > 0) continue;
      const g = new THREE.PlaneGeometry(sl, az1 - az0); g.rotateX(-PI / 2); g.rotateZ(-s * ang);
      const m = mesh(g, DOWN ? glass : C.glassRoof, s * hw / 2, Y + AH + RH / 2, acz, nc); m.material.side = THREE.DoubleSide;
      for (let z = az0; z <= az1 + 0.01; z += (az1 - az0) / 5) { const b = box(sl, 0.08, 0.08, frame, 0, 0, 0, nc); b.position.set(s * hw / 2, Y + AH + RH / 2 - 0.04, z); b.rotation.z = -s * ang; }
    }
    box(0.18, 0.18, az1 - az0 + 0.2, frame, 0, Y + AH + RH - 0.09, acz, nc);
    // the south gable: a white triangle with the Arrival clock in it
    { const sh = new THREE.Shape(); sh.moveTo(-hw - 0.15, 0); sh.lineTo(hw + 0.15, 0); sh.lineTo(0, RH + 0.12); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.24, bevelEnabled: false }); mesh(g, frame, 0, Y + AH, az1 - 0.12, { dirt: 0.15 }); }
    for (const x of [ax0, ax1]) { cyl(0.05, 2.0, C.steel, x, Y + AH, az1, { seg: 6 }); box(1.0, 0.55, 0.03, team, x + (x < 0 ? -0.52 : 0.52), Y + AH + 1.35, az1, nc); }
    const CR = 1.12, CY = Y + AH + 0.95, CZ = az1 + 0.14;
    const face = (lit) => canvasTex(512, (g, n) => {
      g.fillStyle = DOWN ? '#151515' : '#1c2026'; g.fillRect(0, 0, n, n);
      g.strokeStyle = DOWN ? '#3a3632' : '#c9b78a'; g.lineWidth = 22; g.beginPath(); g.arc(n / 2, n / 2, n / 2 - 14, 0, 7); g.stroke();
      for (let k = 0; k < 12; k++) { const a = k * PI / 6; g.fillStyle = DOWN ? '#3a3632' : '#c9b78a'; g.fillRect(n / 2 + Math.cos(a) * n * 0.39 - 7, n / 2 + Math.sin(a) * n * 0.39 - 7, 14, 14); }
      const col = lit ? '#ffcf7a' : DOWN ? '#2c2a27' : '#9a8c6c';
      g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 58px sans-serif'; g.fillText('ARRIVAL', n / 2, n * 0.29);
      g.font = 'bold 158px sans-serif'; g.fillText('T+31', n / 2, n * 0.56);
      g.font = 'bold 42px sans-serif'; g.fillText('YEARS', n / 2, n * 0.77);
      if (DOWN) { g.strokeStyle = 'rgba(200,200,200,0.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(n * 0.3, n * 0.1); g.lineTo(n * 0.5, n * 0.45); g.lineTo(n * 0.42, n * 0.9); g.moveTo(n * 0.5, n * 0.45); g.lineTo(n * 0.85, n * 0.6); g.stroke(); }
    });
    const lit = LIT === 3 && !DOWN;
    const cm = new THREE.MeshStandardMaterial({ map: face(false), roughness: 0.4, metalness: 0.1, emissive: lit ? '#ffffff' : '#000000', emissiveMap: lit ? face(true) : null, emissiveIntensity: lit ? 1.6 : 0 });
    if (lit) cm.userData.glow = '#ffd58a';
    hoopRing(CR + 0.08, CY, CZ);
    mesh(new THREE.CircleGeometry(CR, 48), cm, 0, CY, CZ + 0.02, nc);
    L.mark('clock', 0, CY, CZ);
    L.mark('atrium', 0, Y + AH / 2, acz);
    function hoopRing(r, y, z) { const g = new THREE.TorusGeometry(r, 0.09, 8, 48); mesh(g, M.paint('#b08a3e', { rivets: false, metal: 0.6 }), 0, y, z + 0.02, nc); }
    // a red warning light on the ridge (always on, like any tall building's)
    box(0.16, 0.16, 0.16, LIT < 0 ? M.emit('#ff3a22', 2.4) : offM, 0, Y + AH + RH + 0.05, acz, nc);
  }

  // ---------------------------------------------------------------------------- the street: station, shelters, lamps
  // the Arrival Station on the south plaza: a long glass canopy on white columns over the tram stop, an empty tram
  {
    const sx0 = 1.0, sx1 = 15.5, sz0 = 14.2, sz1 = 16.8, H = 2.4;
    box(sx1 - sx0, 0.22, sz1 - sz0, C.kerb, (sx0 + sx1) / 2, 0, (sz0 + sz1) / 2, { dirt: 0.2, cast: false });
    for (let x = sx0 + 0.5; x < sx1; x += 2.4) box(0.18, H, 0.18, C.white, x, 0.22, sz0 + 0.4, { dirt: 0.2 });
    const canopy = new THREE.BoxGeometry(sx1 - sx0 + 0.8, 0.08, sz1 - sz0 + 1.6); canopy.translate(0, 0, 0);
    if (!DOWN) { const cm = mesh(canopy, C.glassRoof, (sx0 + sx1) / 2, H + 0.3, (sz0 + sz1) / 2 + 0.5, nc); cm.rotation.x = -0.08; }
    else for (let x = sx0; x < sx1; x += 1.6) { if (R() < 0.45) { const b = box(1.5, 0.06, sz1 - sz0 + 1.6, C.glassRoof, x + 0.8, H + 0.3, (sz0 + sz1) / 2 + 0.5, nc); b.rotation.x = -0.08; } box(0.1, 0.1, sz1 - sz0 + 1.6, C.char, x, H + 0.3, (sz0 + sz1) / 2 + 0.5, nc); }
    box(sx1 - sx0 + 0.8, 0.22, 0.22, C.white, (sx0 + sx1) / 2, H + 0.18, sz0 + 0.1, nc); box(sx1 - sx0 + 0.8, 0.12, 0.12, team, (sx0 + sx1) / 2, H + 0.42, sz0 + 0.1, nc);
    // its lights (tier 0): a strip under the canopy, and the departure board
    box(sx1 - sx0, 0.06, 0.1, E('#fff1d0', 2.2, 0), (sx0 + sx1) / 2, H + 0.12, sz0 + 1.2, nc);
    const board = canvasTex(256, (g, n) => { g.fillStyle = '#0c0d0f'; g.fillRect(0, 0, n, n); g.fillStyle = LIT === 0 ? '#ffb43a' : '#3a3428'; g.font = 'bold 30px monospace';
      ['DEPARTURES', 'CENTRAL  ON TIME', 'HARBOUR  ON TIME', 'FIELDS   ON TIME'].forEach((t, k) => g.fillText(t, 8, 40 + k * 52)); });
    const bm = new THREE.MeshStandardMaterial({ map: board, roughness: 0.5, emissive: LIT === 0 ? '#ffffff' : '#000000', emissiveMap: LIT === 0 ? board : null, emissiveIntensity: LIT === 0 ? 1.5 : 0 });
    if (LIT === 0) bm.userData.glow = '#ffb43a';
    box(0.12, 1.6, 0.12, C.steel, 3.2, 0.22, sz0 + 1.0, nc);
    mesh(new THREE.PlaneGeometry(2.2, 1.1), bm, 3.2, 1.6, sz0 + 1.08, nc);
    L.mark('station', 3.2, 1.6, sz0 + 1.08);
    for (const x of [6, 9.5, 13]) { box(1.1, 0.08, 0.3, C.wood, x, 0.62, sz0 + 1.8, nc); box(1.1, 0.35, 0.06, C.wood, x, 0.7, sz0 + 1.95, nc); }
    // the tram: two cars standing at the platform, empty; its windows lit at dusk (tier 0)
    const tz = 18.4, ty = 0.12;
    for (const [x0, len] of [[2.0, 6.2], [8.4, 6.2]]) {
      const cx = x0 + len / 2;
      box(len, 1.5, 1.5, M.paint('#e9e6de', { rivets: false }), cx, ty + 0.2, tz, { dirt: 0.25 });
      box(len + 0.02, 0.18, 1.52, team, cx, ty + 0.55, tz, nc);
      box(len - 0.5, 0.5, 1.53, LIT === 0 ? M.emit('#ffe7b8', 1.4) : M.plain('#25303a', 0.2, 0.3), cx, ty + 0.85, tz, nc);
      box(len, 0.12, 1.3, M.plain('#5b6066', 0.6, 0.4), cx, ty + 1.7, tz, nc);
      for (const dx of [-len / 2 + 0.9, len / 2 - 0.9]) box(0.5, 0.3, 1.2, M.dark, cx + dx, ty + 0.0, tz, nc);
    }
    box(0.1, 1.3, 0.1, C.steel, 1.2, 1.82, tz, nc); // pantograph
  }
  // bus shelters on the east and west sides, a welcome sign on the south-west plaza
  for (const [x, z, ry] of [[-16.3, -3, PI / 2], [16.3, 3, -PI / 2]]) {
    const g = group(x, 0, z, ry);
    box(2.2, 0.08, 1.0, C.white, 0, 2.0, 0, { parent: g, dirt: 0.2 }); box(2.2, 0.06, 0.06, team, 0, 2.1, -0.5, { parent: g, ...nc });
    for (const sx of [-1, 1]) box(0.08, 2.0, 0.08, C.steel, sx * 1.0, 0, -0.4, { parent: g, ...nc });
    box(2.0, 1.6, 0.04, DOWN ? M.plain('#2a3036', 0.4, 0) : C.glassRoof, 0, 0.3, -0.42, { parent: g, ...nc });
    box(1.6, 0.06, 0.4, C.wood, 0, 0.5, -0.15, { parent: g, ...nc });
    box(1.9, 0.05, 0.08, E('#fff1d0', 2.0, 0), 0, 1.94, 0, { parent: g, ...nc });
    box(0.08, 2.4, 0.08, C.steel, 1.4, 0, 0.3, { parent: g, ...nc }); box(0.5, 0.5, 0.05, M.paint('#2c6fb3', { rivets: false }), 1.4, 2.2, 0.3, { parent: g, ...nc });
  }
  {
    const sign = (lit) => canvasTex(512, (g, n) => { g.fillStyle = '#1f2a33'; g.fillRect(0, 0, n, n); g.fillStyle = lit ? '#ffe8b0' : DOWN ? '#3d3a35' : '#d8cfb8'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 120px sans-serif'; g.fillText('WELCOME', n / 2, n * 0.38); g.font = 'bold 76px sans-serif'; g.fillText('HOME', n / 2, n * 0.68); });
    const on = LIT === 0 && !DOWN;
    const sm = new THREE.MeshStandardMaterial({ map: sign(false), roughness: 0.5, emissive: on ? '#ffffff' : '#000000', emissiveMap: on ? sign(true) : null, emissiveIntensity: on ? 1.6 : 0 });
    if (on) sm.userData.glow = '#ffe2a0';
    for (const x of [-12.6, -9.4]) box(0.14, 2.6, 0.14, C.steel, x, 0, 15.6, nc);
    const sg = box(3.4, 1.2, 0.12, M.dark, -11, 1.6, 15.6, nc); if (DOWN) sg.rotation.z = 0.18;
    const sp = mesh(new THREE.PlaneGeometry(3.3, 1.1), sm, -11, 2.2, 15.68, nc); if (DOWN) { sp.rotation.z = 0.18; sp.position.y = 2.05; }
  }
  // street lamps round the ring road (tier 0), and a little shade of trees in the plaza corners
  {
    const pts = [];
    for (let k = -16; k <= 16; k += 4) { pts.push([k, -16.6], [k, 16.6]); if (k > -16 && k < 16) pts.push([-16.6, k], [16.6, k]); }
    for (const [x, z] of pts) {
      if (Math.abs(z - 16.6) < 0.1 && x > 0.5 && x < 16) continue; // (the station's canopy has its own)
      const lean = DOWN && R() < 0.35, g = group(x, 0, z, 0);
      if (lean) g.rotation.set(RR(-0.5, 0.5), 0, RR(-0.5, 0.5));
      cyl(0.06, 2.5, C.steel, 0, 0, 0, { parent: g, seg: 8, dirt: 0.2 });
      const out = [Math.sign(x) * (Math.abs(x) > 16 ? 0.35 : 0), Math.sign(z) * (Math.abs(z) > 16 ? 0.35 : 0)];
      box(0.1, 0.06, 0.1, C.steel, out[0] / 2, 2.45, out[1] / 2, { parent: g, ...nc });
      box(0.26, 0.1, 0.26, E('#ffe6b0', 3, DOWN ? 9 : 0), out[0], 2.38, out[1], { parent: g, ...nc });
    }
    for (const [x, z] of [[-17.8, -17.8], [17.8, -17.8], [-17.8, 17.8], [17.8, 17.8]]) tree(x, 0, z, 0.9);
    for (const [x, z] of [[-14.5, 14.8], [-7.5, 15.2], [-3.5, 14.8]]) tree(x, 0, z, 0.8);
  }
  ao(0, -1, 30, 28, 0.35);
  if (DOWN) { for (const [x, z, r] of [[-6, 15, 1.5], [12, 18.5, 1.3], [-16, 6, 1.4], [15.5, -8, 1.2], [8, -16.5, 1.4]]) scorch(x, -0.1, z, r); }
  // night: a faint moonlit fill so the terraces read in the dark (no light of its own: the game adds the City's)
  if (L.TOD === 'night' && LIT < 0) pointLight('#8fa6ff', 3, 0, 22, 14, 40);
}
