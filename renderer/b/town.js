// Passenger Town (the city map, js/city.js): its buildings as 3D sprites, a CONCEPT set (Nov 2026; not installed).
// The owner's art direction (ART_GUIDE.md, Passenger Town): the mood of the dense sci-fi cities of Industries of Titan,
// our own buildings: chunky blocky forms of varied heights, rooftop clutter (vents, tanks, fans, pads, antennas), many
// small warm windows, cool cyan strips, a few red or orange sign panels and glyph signs; weathered, dust at the foot,
// streaks under the sills. Neutral: no team colour anywhere. Empty: by day the lights are off; at dusk and night they
// still run on automatic.
//
// One building on its lot, w x h tiles (10 world units a tile), the lot's middle at the origin, its front (south) edge
// toward the camera. The buildings' 57 degree view, square-on, but ORTHOGRAPHIC (as the walls), so neighbouring lots
// join exactly and every sprite has the same scale: `ppu` render px a world unit (default 25.6, i.e. 128 px a tile
// after compose's 2x downsample). The canvas is sized to the building. No pad: the town's ground is drawn in code.
//   ?k=house|shop|flats|tower|school|hall|spire|car|arcade   the kind (TOWN_KINDS)
//   ?w=&h=        the lot in tiles (arcade: the street segment it closes)
//   ?v=           the variant seed (colours, heights, details)
//   ?strip=1|2    being stripped for salvage: 1 a third gone (top floor off, panels out, scaffold over the front),
//                 2 most of it gone (a frame of columns and slabs, rubble, crates)
//   ?tod=night    lights on automatic (windows, strips, signs, beacons); day: lights off, only the red mast lights burn
// Passes: beauty, glow, and `shadow` (the building's shadow alone on the ground, black in alpha, to draw with the ground
// under every building). Marks: lotFL / lotFR / lotBL / lotBR (the lot's corners on the ground), foot (front middle).
const Q = new URLSearchParams(location.search);
const KIND = Q.get('k') || 'house', TW = +(Q.get('w') || 2), TH = +(Q.get('h') || 2), VAR = +(Q.get('v') || 1);
const STRIP = +(Q.get('strip') || 0), PPU = +(Q.get('ppu') || 25.6);
const PI = Math.PI;
export const config = { pad: false, size: 256 };

export default function (L) {
  const { THREE, M, box, cyl, mesh } = L;
  const LIT = L.TOD === 'night' || L.TOD === 'evening';
  L.seed(7000 + VAR * 131 + TW * 17 + TH * 7 + KIND.length * 1009);
  const R = L.rnd, RR = (a, b) => a + (b - a) * R(), pick = (a) => a[Math.floor(R() * a.length)];
  const LX = TW * 5, LZ = TH * 5, FH = 3.4;                                   // half lot, floor height
  const nc = { dirt: 0, cast: false };
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(4, Math.round(w)); c.height = Math.max(4, Math.round(h)); return c; };
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const std = (o) => { const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, vertexColors: true, ...o }); m.envMapIntensity = 0.4; return m; };
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const shade = (hex, k) => '#' + rgb(hex).map((x) => Math.round(Math.max(0, Math.min(255, k > 0 ? x + (255 - x) * k : x * (1 + k)))).toString(16).padStart(2, '0')).join('');
  // a light: glowing at dusk and night, a painted (unlit) panel by day
  const light = (hex, k = 2.2, dayHex) => (LIT ? M.emit(hex, k) : M.plain(dayHex || shade(hex, -0.55), 0.6, 0.1));
  const red = M.emit('#ff3a26', 3); // (the red mast lights: they burn in every render)

  // ------------------------------------------------------------------ palettes
  const WALLS = {
    house: ['#8a5a48', '#9a6a52', '#c2b29a', '#7c6a5c', '#a88c6c', '#6f4a42'],
    shop: ['#8d8a84', '#a2978a', '#6e7476', '#b5a88f', '#7b6a5e'],
    flats: ['#bdb3a0', '#6e3f3c', '#a7a196', '#5d6b70', '#8a7d6c', '#c8c0ae'],
    tower: ['#4c5259', '#5a3638', '#4a4644', '#3f4a55', '#62574e'],
    school: ['#c8bfa8'], hall: ['#cfc6b2'], spire: ['#545b63'],
  };
  const TEAL = ['#3d7c84', '#2f6670', '#4a8a8c', '#356a78'];
  const wallC = pick(WALLS[KIND] || ['#8a8a8a']), accentC = pick(TEAL);
  const roofC = pick(['#4a4e53', '#55524d', '#454c4e', '#5a5753', '#3f4448', '#4e5a5c', '#77746c', '#6a6e70', '#3c5258']);
  const frameC = pick(['#d8ccb4', '#cfc5b2', '#e0d6c0', '#b8ae9c']);
  const lit = RR(0.38, 0.62); // the share of windows lit at night

  // ------------------------------------------------------------------ facades
  // A front face, fw x fh world units, its bottom at height y0 (so the floors line up across tiers). Painted: the wall,
  // floor joints, windows with light frames, sills with streaks under them, dust up from the foot. Its lights (night)
  // in the emissive map. o: { style: grid|ribbon|pairs|tall|blank, ground: shop|lobby|plain|none, accent: [cols],
  // band: hex (a coloured band under the top floor), holes: k (stripped: panels out) }.
  const TPU = 22;
  function facade(fw, fh, y0, o = {}) {
    const W = Math.min(2048, fw * TPU), H = Math.min(2048, fh * TPU), sx = W / fw, sy = H / fh;
    const base = cv(W, H), emit = cv(W, H), g = base.getContext('2d'), e = emit.getContext('2d');
    const wall = o.wall || wallC, style = o.style || 'grid';
    g.fillStyle = wall; g.fillRect(0, 0, W, H); e.fillStyle = '#000'; e.fillRect(0, 0, W, H);
    for (let k = 0; k < fw * fh * 0.5; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '40,34,28' : '255,248,236'},${RR(0.02, 0.07)})`; const r = RR(4, 30); g.fillRect(R() * W, R() * H, r, r * RR(0.5, 1.5)); }
    const Yp = (y) => H - (y - y0) * sy;                       // world height -> canvas y
    const f0 = Math.round(y0 / FH), f1 = Math.round((y0 + fh) / FH);
    const pitch = o.pitch || (style === 'pairs' ? 3.2 : style === 'tall' ? 2.6 : 2.2), cols = Math.max(1, Math.floor((fw - 0.6) / pitch)), pad = (fw - cols * pitch) / 2;
    const accent = o.accent || [];
    for (const c of accent) { g.fillStyle = accentC; g.fillRect((pad + c * pitch) * sx, 0, pitch * sx, H); }
    for (let f = f0; f < f1; f++) {
      const yb = Yp(f * FH), yt = Yp((f + 1) * FH);
      if (yb < -2 || yt > H + 2) continue;
      g.fillStyle = 'rgba(30,26,22,0.35)'; g.fillRect(0, yt - 1, W, 2);                    // (the floor joint)
      g.fillStyle = 'rgba(255,250,240,0.10)'; g.fillRect(0, yt + 1, W, 3);
      if (o.band && f === f1 - 1) { g.fillStyle = o.band; g.fillRect(0, yt + 2, W, 0.5 * sy); }
      const ground = f === 0 && (o.ground || 'plain') !== 'plain' ? o.ground : null;
      if (ground === 'none') continue;
      if (ground === 'shop' || ground === 'lobby') {
        const gx0 = ground === 'lobby' ? W * 0.32 : 0.5 * sx, gx1 = ground === 'lobby' ? W * 0.68 : W - 0.5 * sx, gy0 = yb - FH * 0.78 * sy, gy1 = yb - 0.1 * sy;
        g.fillStyle = '#2b2a29'; g.fillRect(gx0 - 3, gy0 - 3, gx1 - gx0 + 6, gy1 - gy0 + 6);
        const gr = g.createLinearGradient(0, gy0, 0, gy1); gr.addColorStop(0, '#5f7684'); gr.addColorStop(1, '#1c242c'); g.fillStyle = gr; g.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
        for (let x = gx0 + 1.6 * sx; x < gx1; x += 1.6 * sx) { g.fillStyle = 'rgba(25,22,20,0.8)'; g.fillRect(x, gy0, 2, gy1 - gy0); }
        if (o.shutters) { for (let y = gy0; y < gy0 + (gy1 - gy0) * o.shutters; y += 4) { g.fillStyle = y % 8 < 4 ? '#77746e' : '#5f5c57'; g.fillRect(gx0, y, gx1 - gx0, 4); } }
        const tint = o.shopTint || '#ffd08a';
        e.fillStyle = tint; e.globalAlpha = 0.6; e.fillRect(gx0, gy0 + (gy1 - gy0) * (o.shutters || 0), gx1 - gx0, (gy1 - gy0) * (1 - (o.shutters || 0))); e.globalAlpha = 1;
        for (let x = gx0 + 1.6 * sx; x < gx1; x += 1.6 * sx) { e.fillStyle = '#000'; e.fillRect(x, gy0, 2, gy1 - gy0); }
        continue;
      }
      for (let c = 0; c < cols; c++) {
        const cx = (pad + (c + 0.5) * pitch) * sx;
        if (style === 'blank') continue;
        let ww = style === 'pairs' ? 2.4 : style === 'ribbon' ? pitch - 0.25 : style === 'tall' ? 1.2 : 1.3, wh = style === 'tall' ? 2.4 : 1.65, wy = style === 'tall' ? 0.5 : 0.85;
        const x0 = cx - (ww / 2) * sx, x1 = cx + (ww / 2) * sx, y1 = yb - wy * sy, yy0 = y1 - wh * sy;
        const hole = o.holes && R() < o.holes;
        // the frame (light), the glass (dark, a little sky in it), its mullion
        g.fillStyle = o.frame || frameC; g.fillRect(x0 - 0.16 * sx, yy0 - 0.16 * sy, (x1 - x0) + 0.32 * sx, (y1 - yy0) + 0.32 * sy);
        if (hole) { g.fillStyle = '#0e0c0b'; g.fillRect(x0 - 0.16 * sx, yy0 - 0.16 * sy, (x1 - x0) + 0.32 * sx, (y1 - yy0) + 0.32 * sy); continue; }
        const gr = g.createLinearGradient(x0, yy0, x1, y1); gr.addColorStop(0, '#6d8696'); gr.addColorStop(0.5, '#2c3a46'); gr.addColorStop(1, '#1e2833');
        g.fillStyle = gr; g.fillRect(x0, yy0, x1 - x0, y1 - yy0);
        if (style !== 'ribbon') { g.fillStyle = 'rgba(30,28,26,0.7)'; g.fillRect(cx - 1, yy0, 2, y1 - yy0); }
        // the sill, and a streak of grime under it
        g.fillStyle = 'rgba(255,250,240,0.25)'; g.fillRect(x0 - 0.2 * sx, y1 + 0.16 * sy, (x1 - x0) + 0.4 * sx, 2);
        if (R() < 0.55) { const sl = RR(0.4, 1.6) * sy, s = g.createLinearGradient(0, y1, 0, y1 + sl); s.addColorStop(0, 'rgba(40,30,22,0.38)'); s.addColorStop(1, 'rgba(40,30,22,0)'); g.fillStyle = s; g.fillRect(x0 + RR(0, x1 - x0 - 6), y1 + 0.2 * sy, RR(3, 8), sl); }
        // its light: warm (amber or cream) on automatic, now and then a cool one, the odd one with its blind half down
        if (R() < lit * (o.litK || 1)) {
          const h = R();
          e.fillStyle = h < 0.1 ? '#9fe6ff' : h < 0.55 ? '#ffc477' : h < 0.85 ? '#ffd9a0' : '#ffb25e';
          e.globalAlpha = RR(0.75, 1); e.fillRect(x0, yy0, x1 - x0, y1 - yy0); e.globalAlpha = 1;
          if (R() < 0.3) { e.fillStyle = 'rgba(0,0,0,0.75)'; e.fillRect(x0, yy0, x1 - x0, (y1 - yy0) * RR(0.3, 0.6)); }
          if (style !== 'ribbon') { e.fillStyle = '#000'; e.fillRect(cx - 1, yy0, 2, y1 - yy0); }
        }
      }
    }
    // dust up from the foot, streaks down the face
    if (y0 < 0.1) { const d = Math.min(H, 2.6 * sy), gr = g.createLinearGradient(0, H - d, 0, H); gr.addColorStop(0, 'rgba(120,96,70,0)'); gr.addColorStop(1, 'rgba(110,88,64,0.55)'); g.fillStyle = gr; g.fillRect(0, H - d, W, d); }
    for (let k = 0; k < fw / 2.5; k++) { const x = R() * W, l = RR(0.15, 0.5) * H, s = g.createLinearGradient(0, 0, 0, l); s.addColorStop(0, 'rgba(45,36,28,0.22)'); s.addColorStop(1, 'rgba(45,36,28,0)'); g.fillStyle = s; g.fillRect(x, 0, RR(2, 6), l); }
    const mat = std({ map: tex(base) });
    if (LIT) { mat.emissive = new THREE.Color('#ffffff'); mat.emissiveMap = tex(emit); mat.emissiveIntensity = 1.35; mat.userData.glow = '#ffffff'; }
    return mat;
  }
  // A roof, w x d: membrane panels with dark seams, tar patches, a lighter gravel border, grime toward the parapet.
  function roofMat(c, w, d) {
    const W = Math.min(2048, w * 16), H = Math.min(2048, d * 16), sx = W / w, sy = H / d, cc = cv(W, H), g = cc.getContext('2d');
    const col = c || roofC; g.fillStyle = col; g.fillRect(0, 0, W, H);
    const pw = pick([2.5, 3, 4]) * sx;
    for (let x = 0; x < W; x += pw) for (let y = 0; y < H; y += pw * 2) { g.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,250,240'},${RR(0.02, 0.09)})`; g.fillRect(x + 1, y + 1, pw - 2, pw * 2 - 2); }
    g.strokeStyle = 'rgba(20,18,16,0.35)'; g.lineWidth = 1.5;
    for (let x = 0; x < W; x += pw) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let k = 0; k < w * d / 90; k++) { const x = R() * W, y = R() * H, r = RR(0.5, 1.4) * sx; g.fillStyle = `rgba(22,20,18,${RR(0.12, 0.25)})`; g.beginPath(); g.ellipse(x, y, r, r * RR(0.5, 1), R() * 3, 0, 7); g.fill(); }
    for (let k = 0; k < w * d / 3; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '20,18,16' : '240,235,225'},${RR(0.05, 0.15)})`; g.fillRect(R() * W, R() * H, 2, 2); }
    const e = 0.9 * sx, gr = (x0, y0, x1, y1) => { const q = g.createLinearGradient(x0, y0, x1, y1); q.addColorStop(0, 'rgba(70,58,44,0.45)'); q.addColorStop(1, 'rgba(70,58,44,0)'); return q; };
    g.fillStyle = gr(0, 0, 0, e); g.fillRect(0, 0, W, e); g.fillStyle = gr(0, H, 0, H - e); g.fillRect(0, H - e, W, e);
    g.fillStyle = gr(0, 0, e, 0); g.fillRect(0, 0, e, H); g.fillStyle = gr(W, 0, W - e, 0); g.fillRect(W - e, 0, e, H);
    return std({ map: tex(cc), roughness: 0.92 });
  }

  // ------------------------------------------------------------------ modelling
  // A block: x0..x1, z0..z1 on the ground plan, y0..y1 tall; its front painted by facade(), its roof with a parapet.
  const blocks = [];
  function block(x0, x1, z0, z1, y0, y1, o = {}) {
    const w = x1 - x0, d = z1 - z0, h = y1 - y0, wall = std({ color: o.wall || wallC });
    const front = facade(w, h, y0, o), top = roofMat(o.roof, w, d);
    const geo = new THREE.BoxGeometry(w, h, d, 1, Math.min(24, Math.max(1, Math.ceil(h / 0.5))), 1); geo.translate(0, h / 2, 0);
    const m = mesh(geo, [wall, wall, top, wall, wall, wall], (x0 + x1) / 2, y0, (z0 + z1) / 2, { dirt: y0 < 0.1 ? 0.45 : 0.15, dirtH: 2.2 });
    // (the front as its own plane: the glow pass gives a whole mesh one material, so the lit windows must not share the roof's)
    const fp = new THREE.PlaneGeometry(w, h, 1, Math.min(24, Math.max(1, Math.ceil(h / 0.5))));
    m.userData.front = mesh(fp, front, (x0 + x1) / 2, y0 + h / 2, z1 + 0.015, { dirt: y0 < 0.1 ? 0.45 : 0.15, dirtH: 2.2, cast: false });
    if (o.parapet !== false) parapet(x0, x1, z0, z1, y1, o.parapetC || shade(o.wall || wallC, 0.12));
    if (o.parapet !== false && h > FH * 2 && R() < 0.6) { // a work light on the parapet (on automatic at night: it shows the roof)
      const lx = R() < 0.5 ? x0 + 0.5 : x1 - 0.5, lz = R() < 0.5 ? z0 + 0.5 : z1 - 0.5;
      box(0.35, 0.3, 0.35, light(pick(['#ffd9a0', '#ffc477', '#bfe8ff']), 3), lx, y1 + 0.55, lz, nc);
    }
    // floor ledges across the front (chunky slabs that catch the light)
    if (o.ledges) for (let f = Math.ceil(y0 / FH + 0.01); f * FH < y1 - 0.5; f++) box(w + 0.2, 0.22, 0.3, std({ color: shade(o.wall || wallC, 0.18) }), (x0 + x1) / 2, f * FH - 0.11, z1 + 0.1, { dirt: 0 });
    const b = { x0, x1, z0, z1, y0, y1, m }; blocks.push(b); return b;
  }
  function parapet(x0, x1, z0, z1, y, c, hgt = 0.55) {
    const mt = std({ color: c }), t = 0.3;
    box(x1 - x0, hgt, t, mt, (x0 + x1) / 2, y, z1 - t / 2, { dirt: 0 }); box(x1 - x0, hgt, t, mt, (x0 + x1) / 2, y, z0 + t / 2, { dirt: 0 });
    box(t, hgt, z1 - z0 - 2 * t, mt, x0 + t / 2, y, (z0 + z1) / 2, { dirt: 0 }); box(t, hgt, z1 - z0 - 2 * t, mt, x1 - t / 2, y, (z0 + z1) / 2, { dirt: 0 });
  }
  // balconies on a front: slabs with a rail, on floors from..to, every `every` columns
  function balconies(x0, x1, z, f0, f1, o = {}) {
    const slab = std({ color: o.c || shade(wallC, -0.25) }), rail = M.plain(o.rail || '#3a3e42', 0.6, 0.4), w = o.w || 2.6, n = Math.max(1, Math.floor((x1 - x0 - 0.6) / (o.pitch || 4.4)));
    const sp = (x1 - x0) / n;
    for (let f = f0; f <= f1; f++) for (let k = 0; k < n; k++) {
      if (R() < 0.15) continue;
      const x = x0 + (k + 0.5) * sp, y = f * FH + 0.05;
      box(w, 0.18, 0.9, slab, x, y, z + 0.45, { dirt: 0 });
      box(w, 0.75, 0.06, rail, x, y + 0.18, z + 0.87, { dirt: 0 });
      if (R() < 0.25) box(0.5, 0.5, 0.4, std({ color: pick(['#6a8a5a', '#8a6a4a', '#9aa0a4']) }), x + RR(-0.8, 0.8), y + 0.18, z + 0.4, { dirt: 0 }); // (a planter, a crate)
    }
  }
  // a vertical light strip up a front (cyan or teal), and its housing
  function strip(x, z, y0, y1, hex = '#5ff0e8') {
    box(0.42, y1 - y0, 0.2, M.plain('#2a3034', 0.6, 0.4), x, y0, z + 0.1, nc);
    box(0.22, y1 - y0 - 0.4, 0.12, light(hex, 2.6, '#3f7f86'), x, y0 + 0.2, z + 0.24, nc);
  }
  // a sign panel on a front: red/orange bars, or a cyan glyph (a square spiral, a ring) on dark glass
  function glyphCanvas(kind, wpx, hpx, hex, on) {
    const c = cv(wpx, hpx), g = c.getContext('2d');
    g.fillStyle = on ? '#000' : '#1b2024'; g.fillRect(0, 0, wpx, hpx);
    const col = on ? hex : shade(hex, -0.45);
    g.fillStyle = col; g.strokeStyle = col;
    if (kind === 'bars') { const n = Math.max(2, Math.round(hpx / wpx * 2.2)); for (let k = 0; k < n; k++) g.fillRect(wpx * 0.14, hpx * (0.08 + k * 0.92 / n), wpx * 0.72, hpx * 0.5 / n); }
    else if (kind === 'glyph') {
      const s = Math.min(wpx, hpx), ox = (wpx - s) / 2, oy = (hpx - s) / 2, u = s / 10; g.lineWidth = u;
      const t = Math.floor(R() * 3);
      g.strokeRect(ox + u * 1.5, oy + u * 1.5, s - u * 3, s - u * 3);
      if (t === 0) { g.fillRect(ox + u * 3.5, oy + u * 3.5, u * 3, u * 3); }
      else if (t === 1) { g.beginPath(); g.arc(ox + s / 2, oy + s / 2, u * 2, 0, 7); g.stroke(); g.fillRect(ox + s / 2 - u / 2, oy + u * 1.5, u, u * 2); }
      else { g.fillRect(ox + u * 3.5, oy + u * 3.5, u * 3, u); g.fillRect(ox + u * 3.5, oy + u * 5.5, u * 3, u); g.fillRect(ox + u * 3.5, oy + u * 3.5, u, u * 3); }
      for (let y = oy + s; y + u * 2 < hpx; y += u * 2) g.fillRect(ox + u * 1.5, y + u * 0.5, s - u * 3, u * 0.8); // (a column of ticks under a tall glyph)
    } else { // 'words': a row of blocky characters (no real letters: Accord script, worn)
      const n = Math.max(3, Math.floor(wpx / hpx * 1.6)), u = hpx / 7;
      for (let k = 0; k < n; k++) { const x = wpx * 0.06 + k * (wpx * 0.88 / n); for (let j = 0; j < 5; j++) if (R() < 0.55) g.fillRect(x + (j % 2) * u * 1.1, hpx * 0.18 + Math.floor(j / 2) * u * 1.6, u * 1.2, u); }
    }
    return c;
  }
  function sign(x, y, z, w, h, kind, hex, o = {}) {
    box(w + 0.24, h + 0.24, 0.22, M.plain('#24282b', 0.6, 0.5), x, y - 0.12, z + 0.11, nc);
    const c = glyphCanvas(kind, w * 40, h * 40, hex, LIT);
    const m = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.4, metalness: 0.1 });
    if (LIT) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 2.2; m.userData.glow = '#ffffff'; }
    else if (o.dayGlow) { m.emissive = new THREE.Color('#ffffff'); m.emissiveMap = m.map; m.emissiveIntensity = 0.35; }
    const p = new THREE.PlaneGeometry(w, h);
    mesh(p, m, x, y + h / 2, z + 0.23, { dirt: 0, cast: false });
  }

  // ------------------------------------------------------------------ rooftop clutter
  const metal = M.plain('#8a8e92', 0.5, 0.5), metalD = M.plain('#5c6166', 0.55, 0.5), unitC = std({ color: '#9a9c98' }), dark = M.dark;
  const grille = M.grille('#6a6e72');
  function acUnit(x, y, z, s = 1) { box(1.6 * s, 1.0 * s, 1.1 * s, unitC, x, y, z, { dirt: 0.3, dirtH: 0.5 }); cyl(0.42 * s, 0.06, dark, x, y + 1.0 * s, z, { seg: 16, dirt: 0 }); for (const a of [0, PI / 2]) box(0.8 * s, 0.04, 0.08, metalD, x, y + 1.06 * s, z, { ry: a + 0.4, dirt: 0 }); }
  function vent(x, y, z) { const S = 1.5; box(1.2 * S, 0.7 * S, 1.2 * S, metalD, x, y, z, { dirt: 0.2 }); box(1.5 * S, 0.15, 1.5 * S, metal, x, y + 0.7 * S, z, { dirt: 0 }); box(1.5 * S, 0.15, 1.5 * S, metal, x, y + 1.05 * S, z, { dirt: 0 }); box(0.3, 0.35 * S, 0.3, metalD, x, y + 0.75 * S, z, { dirt: 0 }); }
  function bigFan(x, y, z, r = 1.5) {
    cyl(r, 0.9, std({ color: '#7d8084' }), x, y, z, { seg: 28, dirt: 0.3, dirtH: 0.6 });
    cyl(r * 0.86, 0.05, dark, x, y + 0.9, z, { seg: 28, dirt: 0 });
    for (let k = 0; k < 4; k++) box(r * 1.6, 0.05, 0.3, metal, x, y + 0.95, z, { ry: (k * PI) / 4 + R(), dirt: 0 });
    cyl(0.25, 0.12, metalD, x, y + 0.95, z, { seg: 12, dirt: 0 });
  }
  function tank(x, y, z, r = 1.1, h = 1.8) {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.14, 1.1, 0.14, metalD, x + a * r * 0.6, y, z + b * r * 0.6, { dirt: 0 });
    cyl(r, h, std({ color: pick(['#a7a49c', '#8a8f90', '#6f7a7c']) }), x, y + 1.1, z, { seg: 24, dirt: 0.25, dirtH: 0.9 });
    cyl(r * 1.02, 0.35, std({ color: '#5f6366' }), x, y + 1.1 + h, z, { rTop: r * 0.2, seg: 24, dirt: 0 });
  }
  function antenna(x, y, z, h = 5) { cyl(0.07, h, metal, x, y, z, { seg: 8, dirt: 0 }); for (let k = 1; k < 3; k++) box(0.9 - k * 0.2, 0.05, 0.05, metal, x, y + h * (0.5 + k * 0.18), z, { dirt: 0 }); box(0.22, 0.22, 0.22, red, x, y + h, z, nc); }
  function dish(x, y, z) { box(0.18, 0.9, 0.18, metalD, x, y, z, { dirt: 0 }); const g = new THREE.SphereGeometry(0.8, 20, 10, 0, PI * 2, 0, PI / 3); g.rotateX(-PI / 2 - 0.6); mesh(g, std({ color: '#c9cac6', side: THREE.DoubleSide }), x, y + 1.1, z, { dirt: 0 }); }
  function solar(x0, x1, z0, z1, y) { const mt = M.plain('#1f2c3c', 0.25, 0.5); for (let z = z0 + 0.8; z < z1 - 0.6; z += 1.6) box(x1 - x0, 0.1, 1.2, mt, (x0 + x1) / 2, y + 0.35, z, { rx: 0, dirt: 0 }); for (let z = z0 + 0.8; z < z1 - 0.6; z += 1.6) box(x1 - x0, 0.35, 0.1, metalD, (x0 + x1) / 2, y, z, { dirt: 0 }); }
  function hut(x, y, z, w = 2.6, d = 2.2, h = 2.4) { // a stair or lift house, a door on its front, a light over it
    block(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h, { style: 'blank', ground: 'none', parapet: false, wall: shade(wallC, 0.08) });
    box(0.9, 1.7, 0.06, M.plain('#3a3d40', 0.6, 0.4), x - w * 0.2, y, z + d / 2 + 0.02, nc);
    box(0.3, 0.12, 0.12, light('#ffd9a0', 2.5), x - w * 0.2, y + 1.95, z + d / 2 + 0.06, nc);
  }
  function pad(x, y, z, r) { // a landing pad: a dark disc on stilts, a worn yellow ring, edge lights
    cyl(r, 0.35, std({ color: '#3a3d41' }), x, y + 0.6, z, { seg: 40, dirt: 0 });
    for (let k = 0; k < 6; k++) { const a = (k / 6) * PI * 2; box(0.22, 0.6, 0.22, metalD, x + Math.cos(a) * r * 0.7, y, z + Math.sin(a) * r * 0.7, { dirt: 0 }); }
    const ring = new THREE.RingGeometry(r * 0.62, r * 0.72, 40); ring.rotateX(-PI / 2); mesh(ring, M.plain('#c9a83a', 0.7, 0), x, y + 0.96, z, { dirt: 0, cast: false });
    const cr = new THREE.PlaneGeometry(r * 0.7, r * 0.12); cr.rotateX(-PI / 2); mesh(cr, M.plain('#d8d2c0', 0.7, 0), x, y + 0.96, z, { dirt: 0, cast: false });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * PI * 2; box(0.2, 0.12, 0.2, light('#7ff6ff', 3), x + Math.cos(a) * r * 0.93, y + 0.95, z + Math.sin(a) * r * 0.93, nc); }
  }
  function pipes(x0, x1, y, z) { const mt = M.plain('#7a7e80', 0.5, 0.5); hcylX(x0, x1, y + 0.4, z, 0.16, mt); hcylX(x0, x1, y + 0.4, z + 0.45, 0.12, mt); for (let x = x0 + 0.6; x < x1; x += 2.2) box(0.12, 0.4, 0.8, metalD, x, y, z + 0.2, { dirt: 0 }); }
  function hcylX(x0, x1, y, z, r, mt) { L.hcyl(r, x1 - x0, mt, (x0 + x1) / 2, y, z, { axis: 'x', seg: 12, dirt: 0 }); }
  // scatter clutter over a roof rect (inside the parapet), never over a hole left for a hut or pad
  function clutter(b, n, kinds) {
    if (STRIP >= 2) return [];
    if (STRIP) { n = Math.ceil(n / 3); kinds = []; }
    const used = [];
    const fits = (x, z, r) => x - r > b.x0 + 0.5 && x + r < b.x1 - 0.5 && z - r > b.z0 + 0.5 && z + r < b.z1 - 0.5 && used.every(([ux, uz, ur]) => Math.hypot(ux - x, uz - z) > ur + r);
    const place = (r) => { for (let t = 0; t < 30; t++) { const x = RR(b.x0, b.x1), z = RR(b.z0, b.z1); if (fits(x, z, r)) { used.push([x, z, r]); return [x, z]; } } return null; };
    const out = [], S = 1.45;
    for (const [k, r] of kinds) { const p = place(r * S); if (p) out.push([k, p]); }
    for (let i = 0; i < n; i++) { const k = pick(['ac', 'vent', 'fan', 'tank', 'housing', 'housing', 'box', 'antenna', 'dish', 'solar', 'glass']), r = { ac: 1.1, vent: 0.9, fan: 1.7, tank: 1.4, antenna: 0.5, dish: 0.9, box: 1.1, housing: 1.6, solar: 2.0, glass: 1.8 }[k]; const p = place(r * S); if (p) out.push([k, p]); }
    for (const [k, [x, z]] of out) {
      const y = b.y1;
      if (k === 'ac') acUnit(x, y, z, S); else if (k === 'ac2') { acUnit(x - 0.85 * S, y, z, 0.9 * S); acUnit(x + 0.85 * S, y, z, 0.9 * S); }
      else if (k === 'vent') vent(x, y, z); else if (k === 'fan') bigFan(x, y, z, RR(1.2, 1.6) * S); else if (k === 'tank') tank(x, y, z, 1.1 * S, 1.8 * S);
      else if (k === 'antenna') antenna(x, y, z, RR(3, 6)); else if (k === 'dish') dish(x, y, z);
      else if (k === 'box') box(RR(1.6, 2.8), RR(0.7, 1.6), RR(1.2, 2.2), std({ color: pick(['#8b8e8a', '#6f7579', '#9a8f7e']) }), x, y, z, { dirt: 0.3 });
      else if (k === 'hut') hut(x, y, z);
      else if (k === 'pad') pad(x, y, z, 3.2);
      else if (k === 'bigtank') tank(x, y, z, 2.2, 3.2);
      else if (k === 'housing') { // a plant housing in teal or blue panels, louvres on its front
        const w = RR(2.6, 4), d = RR(2, 3), h = RR(1.2, 2.2), c = pick(['#3d7c84', '#356a8a', '#4a8a8c', '#2f5f78', '#8a8d90']);
        box(w, h, d, M.paint(c, { rivets: false, rough: 0.55, panelW: 128, panelH: 512 }), x, y, z, { dirt: 0.25, dirtH: 0.8 });
        box(w * 0.7, h * 0.5, 0.06, grille, x, y + h * 0.25, z + d / 2 + 0.03, nc);
        if (R() < 0.5) box(0.25, 0.15, 0.25, light('#7ff6ff', 3), x + w / 2 - 0.3, y + h, z + d / 2 - 0.3, nc);
      } else if (k === 'solar') solar(x - 2.2, x + 2.2, z - 2, z + 2, y);
      else if (k === 'glass') { // a little roof greenhouse (dead plants), its glass lit warm at night
        const w = RR(2.4, 3.4), d = 2.2;
        box(w, 1.6, d, M.plain('#4a5258', 0.45, 0.6), x, y, z, { dirt: 0 });
        box(w - 0.2, 1.4, d - 0.2, LIT ? M.emit('#ffd9a0', 0.9) : M.plain('#8fb0b6', 0.15, 0.2), x, y + 0.2, z, nc);
      }
      else if (k === 'billboard') { // a sign on a frame over the roof, facing the street
        const w = RR(3, 5), h = RR(2, 3);
        for (const s of [-1, 1]) box(0.18, 1.4, 0.18, metalD, x + s * w * 0.4, y, z, { dirt: 0 });
        box(w * 0.9, 0.12, 0.12, metalD, x, y + 1.0, z - 0.3, nc);
        sign(x, y + 1.4, z - 0.11, w, h, pick(['bars', 'glyph', 'words']), pick(['#ff4a32', '#ff7a3a', '#7ff6ff', '#ffb24a']));
      }
    }
    return used;
  }

  // ------------------------------------------------------------------ the kinds
  const m = 0.7; // (the building stands this far in from its lot's edges)
  const X0 = -LX + m, X1 = LX - m, Z0 = -LZ + m, Z1 = LZ - m;
  const floorsTo = (n) => n * FH;
  let topY = 0;
  const roofN = (b) => Math.round((b.x1 - b.x0) * (b.z1 - b.z0) / 40);
  const HB = 1 - STRIP * 0.25; // (stripping takes the top floors first)
  const fl = (n) => Math.max(1, Math.round(n * HB));
  if (KIND === 'house') { // walk-up flats: a row of two or three narrow walk-ups of four or five floors, each its own colour, balconies, a stair tower
    const n = Math.max(1, Math.round((X1 - X0) / RR(8, 11))), w = (X1 - X0) / n, deep = Z1 - Z0 > 22;
    let tall = null;
    for (let i = 0; i < n; i++) {
      const a = X0 + i * w + (i ? 0.15 : 0), b = X0 + (i + 1) * w, set = R() < 0.5 ? RR(0.6, 2) : 0, f = fl(pick([4, 4, 5, 5, 6]) - (deep ? 1 : 0));
      const wall = i ? pick(WALLS.house) : wallC;
      const v = block(a, b, deep ? Z0 + (Z1 - Z0) * 0.45 : Z0 + RR(0, 1.5), Z1 - set, 0, floorsTo(f) + 0.6, { wall, style: pick(['grid', 'grid', 'pairs']), ground: R() < 0.35 ? 'shop' : R() < 0.5 ? 'lobby' : 'plain', ledges: R() < 0.6, holes: STRIP ? 0.4 : 0 });
      balconies(a + 0.3, b - 0.3, v.z1, 1, f - 1, { pitch: RR(4, 5.5), c: shade(wall, 0.25), rail: '#d8d2c4' });
      if (deep) { const bk = block(a + RR(0, 1), b - RR(0, 1), Z0, v.z0 + 0.2, 0, floorsTo(fl(f + 2)) + 0.6, { wall: shade(wall, -0.1), style: 'grid', ledges: true, holes: STRIP ? 0.4 : 0 }); clutter(bk, roofN(bk), [['tank', 1.4]]); if (!tall || bk.y1 > tall.y1) tall = bk; }
      clutter(v, roofN(v), i === 0 ? [['tank', 1.4]] : R() < 0.3 ? [['billboard', 1.7]] : []);
      if (!tall || v.y1 > tall.y1) tall = v;
      if (R() < 0.55) sign(R() < 0.5 ? a + 1.3 : b - 1.3, FH * 1.3, v.z1, 1.2, FH * 1.6, pick(['bars', 'glyph']), pick(['#ff5a3a', '#7ff6ff', '#ffb24a']));
    }
    if (!STRIP) { // the stair tower, a floor over the tallest
      const cx = (tall.x0 + tall.x1) / 2 + RR(-2, 2), z0 = tall.z0 + 0.2, st = block(cx - 1.8, cx + 1.8, z0, z0 + 3.6, tall.y1 - 0.6, tall.y1 + FH + 0.4, { style: 'tall', pitch: 3.6, wall: shade(wallC, 0.15), accent: R() < 0.5 ? [0] : [] });
      antenna(st.x1 - 0.6, st.y1, st.z0 + 0.6, RR(4, 7));
    }
    topY = tall.y1 + FH + 8;
  } else if (KIND === 'shop') { // a shopfront: a tall glazed ground floor under an awning and a big sign band; two floors over it set back; a taller back
    const gh = 4.6, deep = Z1 - Z0 > 14, up = fl(pick([2, 2, 3]));
    const fz = deep ? Z1 - Math.min(11, (Z1 - Z0) * 0.62) : Z0;
    const shop = block(X0, X1, fz, Z1, 0, gh, { style: 'blank', ground: 'shop', shutters: R() < 0.35 ? RR(0.3, 0.7) : 0, shopTint: pick(['#ffd08a', '#ffe2b0', '#bff0ff']), parapetC: '#3a3d40' });
    const upper = block(X0 + 0.5, X1 - 0.5, fz, Z1 - 2.4, gh, gh + floorsTo(up) + 0.6, { style: pick(['grid', 'ribbon', 'pairs']), ledges: R() < 0.5, wall: shade(wallC, 0.06), holes: STRIP ? 0.4 : 0 });
    let top = upper;
    if (deep) { top = block(X0 + 0.2, X1 - 0.2, Z0, fz + 0.3, 0, gh + floorsTo(fl(up + 2)) + 0.6, { style: 'grid', ledges: true, wall: pick(WALLS.shop), holes: STRIP ? 0.4 : 0 }); clutter(top, roofN(top), [['fan', 1.8], ['hut', 1.8]]); }
    // the awning, the sign band over it, a blade sign
    const awC = pick(['#3f7f86', '#8a3a30', '#b08a3a', '#4f6a4a', '#5a5f8a']);
    box(X1 - X0 - 0.4, 0.25, 1.8, std({ color: awC }), 0, gh - 1.45, Z1 + 0.85, { dirt: 0 });
    for (let x = X0 + 0.6; x < X1 - 0.4; x += 1.2) box(0.55, 0.36, 1.8, std({ color: shade(awC, 0.22) }), x + 0.3, gh - 1.5, Z1 + 0.85, { dirt: 0 });
    sign(0, gh - 1.1, Z1 + 0.05, Math.min(X1 - X0 - 1.2, 9), 1.0, 'words', pick(['#ff7a3a', '#ff5a3a', '#ffb24a', '#7ff6ff']), { dayGlow: true });
    if (R() < 0.7) sign(R() < 0.5 ? X0 + 1.5 : X1 - 1.5, gh + 0.8, Z1 - 2.4 + 0.02, 1.4, floorsTo(up) - 1.2, pick(['bars', 'glyph']), pick(['#ff5a3a', '#7ff6ff', '#ffb24a']));
    // the shop roof's ledge in front of the upper floors: condenser units, a duct
    for (let x = X0 + 1.6; x < X1 - 1.4; x += RR(3.2, 4.6)) acUnit(x, gh, Z1 - 1.2, 1.1);
    clutter(upper, roofN(upper), [[R() < 0.4 ? 'billboard' : 'ac2', 1.7]]);
    topY = top.y1 + 8;
  } else if (KIND === 'flats') { // an apartment block: a front slab, a taller back slab, a lift core taller still with a teal panel and strip
    const f = fl(pick([6, 7, 7, 8])), d = Z1 - Z0, fz = Z1 - Math.max(7, d * 0.5);
    const acc = [[1], [0, 4], [2]][Math.floor(R() * 3)];
    const back = block(X0 + 0.6, X1 - 0.6, Z0, fz + 0.5, 0, floorsTo(fl(f + 2)) + 0.6, { style: pick(['grid', 'tall']), ground: 'plain', accent: acc.map((c) => c + 1), wall: shade(wallC, -0.1), ledges: R() < 0.5, holes: STRIP ? 0.35 : 0 });
    const front = block(X0, X1, fz, Z1, 0, floorsTo(f) + 0.6, { style: pick(['grid', 'pairs']), ground: R() < 0.5 ? 'shop' : 'lobby', accent: acc, ledges: true, holes: STRIP ? 0.35 : 0 });
    balconies(X0 + 0.4, X1 - 0.4, Z1, 1, f - 1, { pitch: 4.4, c: shade(wallC, 0.2), rail: '#cfc8b8' });
    let core = back;
    if (!STRIP) { const cx = R() < 0.5 ? X0 + 3.2 : X1 - 3.2; core = block(cx - 2.4, cx + 2.4, Z0 + 0.4, Z0 + 5, 0, back.y1 + FH * 1.5, { style: 'tall', pitch: 4.8, wall: accentC, frame: '#cfe6e4' }); strip(cx, core.z1, back.y1 - FH, core.y1 - 0.4, pick(['#5ff0e8', '#7ff6ff'])); antenna(cx + 1.2, core.y1, core.z0 + 1, 6); }
    if (R() < 0.7) strip(R() < 0.5 ? X0 + 0.6 : X1 - 0.6, Z1, FH, front.y1 - 0.2, pick(['#5ff0e8', '#7ff6ff']));
    if (R() < 0.7) sign(X1 - 1.7, FH * 1.2, Z1 + 0.2, 1.6, FH * 2.4, pick(['bars', 'glyph']), pick(['#ff5a3a', '#7ff6ff', '#ff7a3a']));
    clutter(front, roofN(front), [[R() < 0.55 ? 'billboard' : 'ac2', 1.7]]);
    clutter(back, roofN(back), [[R() < 0.5 ? 'bigtank' : 'fan', 2.2], ['hut', 1.8]]);
    topY = core.y1 + 8;
  } else if (KIND === 'tower') { // a residential tower: a podium of shops, a lower annex, a shaft of twelve to sixteen storeys, a crown with a pad
    const pf = 2, sf = fl(12 + Math.floor(R() * 5)), ins = Math.min(1.8, (X1 - X0) * 0.1), left = R() < 0.5;
    const podium = block(X0, X1, Z0, Z1, 0, floorsTo(pf) + 0.4, { style: 'ribbon', ground: 'shop', wall: pick(['#6e6a64', '#5d6064', '#7a7066']), ledges: true, shopTint: pick(['#ffd08a', '#bff0ff']) });
    const sw = Math.max(12, (X1 - X0) * 0.62), sx0 = left ? X0 + ins : X1 - ins - sw, sx1 = sx0 + sw, sz0 = Z0 + ins, sz1 = Z1 - ins * 1.6;
    const shaft = block(sx0, sx1, sz0, sz1, podium.y1, floorsTo(pf + sf) + 0.6, { style: pick(['grid', 'tall']), ground: 'plain', accent: R() < 0.5 ? [0] : [], ledges: R() < 0.5, holes: STRIP ? 0.35 : 0 });
    const ax0 = left ? sx1 + 0.2 : X0 + 0.6, ax1 = left ? X1 - 0.6 : sx0 - 0.2;
    if (ax1 - ax0 > 4) { const an = block(ax0, ax1, Z0 + 0.6, Z1 - 3, podium.y1, floorsTo(pf + fl(pick([3, 4, 5]))) + 0.6, { style: 'grid', wall: pick(WALLS.flats), accent: [0], holes: STRIP ? 0.35 : 0 }); clutter(an, roofN(an), [[R() < 0.6 ? 'billboard' : 'ac2', 1.7]]); }
    let top = shaft;
    if (!STRIP && R() < 0.8) { const c = 1.3; top = block(sx0 + c, sx1 - c, sz0 + c * 0.5, sz1 - c, shaft.y1, shaft.y1 + floorsTo(2) + 0.6, { style: 'ribbon', wall: shade(wallC, 0.12) }); }
    strip(left ? sx0 + 0.5 : sx1 - 0.5, sz1, podium.y1 + 0.3, shaft.y1 - 0.3, pick(['#5ff0e8', '#7ff6ff', '#46d8ff']));
    sign(left ? sx1 - 1.7 : sx0 + 1.7, podium.y1 + FH * 2, sz1, 1.7, Math.min(FH * 5, shaft.y1 - podium.y1 - FH * 3), 'bars', pick(['#ff4a32', '#ff6a3a']));
    sign(left ? X1 - 2.4 : X0 + 2.4, 0.9 * FH, Z1 + 0.02, 2, 2, 'glyph', '#7ff6ff');
    if (!STRIP) {
      const big = Math.min(top.x1 - top.x0, top.z1 - top.z0) > 9;
      clutter(top, 2, big && R() < 0.75 ? [['pad', 3.8]] : [['hut', 1.8], ['bigtank', 2]]);
      antenna(top.x1 - 1, top.y1, top.z0 + 1, 8);
    }
    topY = top.y1 + 10;
  } else if (KIND === 'spire') { // the civic tower: the tallest thing in town, stepped, light fins up its corners, the beacon
    const base = block(X0, X1, Z0, Z1, 0, floorsTo(2) + 0.4, { style: 'tall', ground: 'lobby', wall: '#6a7077', ledges: true });
    let y = base.y1, ins = 1.6, prev = base;
    const steps = STRIP ? [7] : [13, 5, 3];
    steps.forEach((n, i) => {
      const b = block(X0 + ins, X1 - ins, Z0 + ins * 0.8, Z1 - ins, y, y + floorsTo(n) + 0.4, { style: i ? 'ribbon' : 'tall', wall: i === 1 ? '#4c535a' : wallC, holes: STRIP ? 0.35 : 0 });
      for (const sx of [b.x0 + 0.35, b.x1 - 0.35]) box(0.3, b.y1 - b.y0 - 0.6, 0.3, light('#7ff6ff', 2.8, '#3f7f86'), sx, b.y0 + 0.3, b.z1 + 0.05, nc);
      y = b.y1; ins += 1.6; prev = b;
    });
    if (!STRIP) {
      const cx = (prev.x0 + prev.x1) / 2, cz = (prev.z0 + prev.z1) / 2;
      box(3.2, 2.6, 3.2, std({ color: '#6a7077' }), cx, y, cz, { dirt: 0 });
      box(3.4, 0.25, 3.4, metal, cx, y + 2.6, cz, { dirt: 0 });
      for (const [dx, dz] of [[0, 1.62]]) box(2.2, 1.3, 0.1, light('#ffe6b0', 4, '#8a8470'), cx + dx, y + 0.8, cz + dz, nc); // (the beacon's lens, facing the sky road the arks would come in by)
      cyl(0.6, 1.0, light('#ffe8b0', 5, '#9a937e'), cx, y + 2.85, cz, { seg: 20, dirt: 0, cast: false });
      cyl(0.09, 9, metal, cx, y + 3.85, cz, { seg: 8, dirt: 0 }); box(0.3, 0.3, 0.3, red, cx, y + 12.8, cz, nc);
      sign((X0 + X1) / 2, base.y1 + FH * 2, Z1 - 1.6 * 1 + 0.02, 2.2, 2.2 + FH * 3, 'glyph', '#7ff6ff');
    }
    topY = y + 13;
  } else if (KIND === 'school') { // the school: an L of three storeys round a yard with a court; yellow band, clock, solar roof
    const wing = Math.min(9, (Z1 - Z0) * 0.55), fl = 4 - (STRIP ? 1 : 0);
    const main = block(X0, X1, Z0, Z0 + wing, 0, floorsTo(fl) + 0.5, { style: 'pairs', ground: 'plain', band: '#c9a23a', wall: '#c8bfa8', ledges: true, holes: STRIP ? 0.35 : 0 });
    const side = block(X0, X0 + Math.min(9, (X1 - X0) * 0.4), Z0 + wing - 0.2, Z1, 0, floorsTo(fl - 1) + 0.5, { style: 'pairs', ground: 'lobby', band: '#c9a23a', wall: '#bfb6a0', ledges: true, holes: STRIP ? 0.35 : 0 });
    // the yard: a court painted on worn asphalt, a fence along the street, a covered walk
    const yx0 = side.x1 + 0.6, yz0 = main.z1 + 0.6;
    const court = cv(512, 512), cg = court.getContext('2d'); cg.fillStyle = '#5f6366'; cg.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 400; k++) { cg.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},0.06)`; cg.fillRect(R() * 512, R() * 512, 6, 6); }
    cg.strokeStyle = 'rgba(232,226,205,0.7)'; cg.lineWidth = 6; cg.strokeRect(60, 60, 392, 392); cg.beginPath(); cg.moveTo(256, 60); cg.lineTo(256, 452); cg.stroke(); cg.beginPath(); cg.arc(256, 256, 60, 0, 7); cg.stroke();
    cg.strokeStyle = 'rgba(201,162,58,0.7)'; cg.beginPath(); cg.arc(60, 256, 90, -PI / 2, PI / 2); cg.stroke(); cg.beginPath(); cg.arc(452, 256, 90, PI / 2, PI * 1.5); cg.stroke();
    const cgeo = new THREE.PlaneGeometry(X1 - yx0, Z1 - yz0); cgeo.rotateX(-PI / 2);
    mesh(cgeo, std({ map: tex(court) }), (yx0 + X1) / 2, 0.03, (yz0 + Z1) / 2, { dirt: 0, cast: false });
    for (let x = yx0; x < X1; x += 1.2) box(0.06, 1.4, 0.06, metalD, x, 0, Z1 + 0.4, { dirt: 0 });
    box(X1 - yx0, 0.06, 0.06, metalD, (yx0 + X1) / 2, 1.4, Z1 + 0.4, nc);
    box(X1 - yx0, 0.9, 0.04, M.plain('#4a4e52', 0.7, 0.3), (yx0 + X1) / 2, 0.3, Z1 + 0.4, { dirt: 0, cast: false });
    for (const [px, pz] of [[yx0 + 1.4, yz0 + 1.2], [X1 - 1.4, yz0 + 1.2]]) { cyl(0.08, 3.2, metal, px, 0, pz, { seg: 8, dirt: 0 }); box(1.2, 0.9, 0.08, std({ color: '#e4e2dc' }), px, 2.6, pz + 0.1, { dirt: 0 }); }
    // the clock over the door, the band; the roofs: solar panels, a small observatory dome
    const cl = cv(128, 128), c2 = cl.getContext('2d'); c2.fillStyle = '#e9e4d6'; c2.beginPath(); c2.arc(64, 64, 60, 0, 7); c2.fill(); c2.strokeStyle = '#333'; c2.lineWidth = 6; c2.beginPath(); c2.moveTo(64, 64); c2.lineTo(64, 22); c2.moveTo(64, 64); c2.lineTo(94, 76); c2.stroke();
    const clm = std({ map: tex(cl), vertexColors: false, transparent: true, alphaTest: 0.5 }); if (LIT) { clm.emissive = new THREE.Color('#fff2d8'); clm.emissiveMap = clm.map; clm.emissiveIntensity = 0.9; clm.userData.glow = '#fff2d8'; }
    mesh(new THREE.PlaneGeometry(2.2, 2.2), clm, (side.x0 + side.x1) / 2, side.y1 - 2.0, side.z1 + 0.05, { dirt: 0, cast: false });
    if (!STRIP) { solar(main.x0 + 1, main.x1 - 6, main.z0 + 0.8, main.z1 - 0.8, main.y1); L.sphere(1.6, std({ color: '#d8d6cf' }), main.x1 - 3, main.y1 + 0.6, (main.z0 + main.z1) / 2, { dome: true, dirt: 0 }); cyl(1.7, 0.6, std({ color: '#9a9690' }), main.x1 - 3, main.y1, (main.z0 + main.z1) / 2, { seg: 24, dirt: 0 }); }
    clutter(side, 3, [['ac2', 1.6]]);
    topY = main.y1 + 3;
  } else if (KIND === 'hall') { // the civic hall: a podium and steps, a colonnade, a high chamber with a copper-green roof, a flagpole, a clock
    const pz1 = Z1 - 3.2, fl = STRIP ? 1 : 2;
    const pod = block(X0, X1, Z0, pz1, 0, 2.2, { style: 'blank', ground: 'none', wall: '#bdb4a0', parapet: false, roof: '#a89f8c' });
    for (let k = 0; k < 4; k++) box(Math.min(X1 - X0 - 4, 18) - k * 0.2, 0.55, 3.2 - k * 0.8, std({ color: '#c9c1b0' }), 0, k * 0.55, pz1 + 1.6 - k * 0.4 + 0.0, { dirt: 0.2 }); // (the steps)
    const hall = block(X0 + 2, X1 - 2, Z0 + 1, pz1 - 2.5, 2.2, 2.2 + floorsTo(fl) + 2.4, { style: 'tall', pitch: 3.4, ground: 'plain', wall: '#cfc6b2', frame: '#e8e0cc', roof: '#8e897e', holes: STRIP ? 0.4 : 0 });
    for (let x = hall.x0 + 3; x < hall.x1 - 2; x += 5) box(1.6, 0.5, hall.z1 - hall.z0 - 3, M.plain('#7fa4ae', 0.2, 0.3), x, hall.y1, (hall.z0 + hall.z1) / 2, { dirt: 0 }); // (skylights)
    // the colonnade across the front, its entablature
    for (let x = hall.x0 + 0.8; x < hall.x1 - 0.4; x += 2.6) cyl(0.42, hall.y1 - 2.2 - 1.2, std({ color: '#ddd5c4' }), x, 2.2, pz1 - 1.0, { seg: 14, dirt: 0.2, dirtH: 1 });
    box(hall.x1 - hall.x0 + 0.4, 1.2, 2.2, std({ color: '#d8d0bd' }), (hall.x0 + hall.x1) / 2, hall.y1 - 1.2, pz1 - 1.6, { dirt: 0 });
    if (!STRIP) {
      // the chamber: a stepped block with a copper-green roof, the clock on its front
      const cx = 0, cw = Math.min(16, (hall.x1 - hall.x0) * 0.5), cz0 = hall.z0 + (hall.z1 - hall.z0) * 0.25, cz1 = hall.z1 - 1.5;
      const ch = block(cx - cw / 2, cx + cw / 2, cz0, cz1, hall.y1, hall.y1 + 7.5, { style: 'tall', pitch: 2.4, wall: '#bfb6a2', roof: '#5f8a7a', parapetC: '#4f7a6a' });
      const cop = std({ color: '#5f8a7a', roughness: 0.6, metalness: 0.3 });
      for (let k = 0; k < 4; k++) box(cw - 1 - k * 2.4, 1.2, cz1 - cz0 - 1 - k * 2.0, cop, cx, ch.y1 + k * 1.2, (cz0 + cz1) / 2, { dirt: 0 });
      const cl = cv(128, 128), c2 = cl.getContext('2d'); c2.fillStyle = '#efe8d6'; c2.beginPath(); c2.arc(64, 64, 60, 0, 7); c2.fill(); c2.strokeStyle = '#2a2a2a'; c2.lineWidth = 5; c2.beginPath(); c2.arc(64, 64, 56, 0, 7); c2.stroke(); c2.lineWidth = 7; c2.beginPath(); c2.moveTo(64, 64); c2.lineTo(64, 20); c2.moveTo(64, 64); c2.lineTo(30, 80); c2.stroke();
      const clm = std({ map: tex(cl), vertexColors: false, transparent: true, alphaTest: 0.5 }); if (LIT) { clm.emissive = new THREE.Color('#fff0d0'); clm.emissiveMap = clm.map; clm.emissiveIntensity = 1.1; clm.userData.glow = '#fff0d0'; }
      mesh(new THREE.PlaneGeometry(3, 3), clm, cx, ch.y0 + 0.8, cz1 + 0.04, { dirt: 0, cast: false });
      cyl(0.09, 10, std({ color: '#e0e0d8' }), hall.x1 - 1.5, hall.y1, hall.z0 + 1.5, { seg: 8, dirt: 0 }); box(0.25, 0.25, 0.25, red, hall.x1 - 1.5, hall.y1 + 10, hall.z0 + 1.5, nc); // (the flagpole: no flag)
      clutter(hall, 4, [['ac2', 1.6], ['ac2', 1.6]]);
      topY = ch.y1 + 3;
    } else topY = hall.y1;
    // planters and lamps on the podium's front
    for (const s of [-1, 1]) { box(2.6, 0.8, 1.6, std({ color: '#9a9484' }), s * (Math.min(X1 - X0 - 4, 18) / 2 + 2), 0, pz1 + 1.4, { dirt: 0.3 }); box(2.3, 0.3, 1.3, M.plain('#5d7a44', 0.95, 0), s * (Math.min(X1 - X0 - 4, 18) / 2 + 2), 0.8, pz1 + 1.4, { dirt: 0 }); }
    for (const s of [-1, 1]) { cyl(0.1, 3.6, M.plain('#3a3e44', 0.6, 0.4), s * 5.4, 2.2, pz1 - 0.2, { seg: 8, dirt: 0 }); box(0.5, 0.35, 0.5, light('#ffe2a8', 3, '#9a948a'), s * 5.4, 5.8, pz1 - 0.2, nc); }
  } else if (KIND === 'car') { // a parked town runabout, dusty, tyres flat
    const ry = RR(-0.25, 0.25) + (R() < 0.5 ? 0 : PI), body = std({ color: pick(['#8a3a30', '#3a5a7a', '#c8b27a', '#5a6a4a', '#d0d0c8', '#6a6e72']), roughness: 0.55, metalness: 0.25 });
    const g = L.group(RR(-1, 1), -0.12, RR(-0.8, 0.8), ry);
    box(5.4, 1.1, 2.6, body, 0, 0.45, 0, { parent: g, dirt: 0.7, dirtH: 1.2 });
    box(3.0, 1.0, 2.3, body, -0.4, 1.55, 0, { parent: g, dirt: 0.3, dirtH: 1 });
    const gl = M.plain('#1e2630', 0.15, 0.4);
    box(3.04, 0.7, 2.0, gl, -0.4, 1.65, 0, { parent: g, dirt: 0 }); box(2.6, 0.08, 2.34, body, -0.4, 2.55, 0, { parent: g, dirt: 0 });
    for (const [x, z] of [[-1.7, 1.25], [1.7, 1.25], [-1.7, -1.25], [1.7, -1.25]]) { const w = new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16); w.rotateX(PI / 2); w.scale(1, 0.8, 1); mesh(w, M.dark, x, 0.45, z, { parent: g, dirt: 0 }); }
    box(0.3, 0.3, 0.6, std({ color: '#6a4a30' }), 2.3, 1.0, 0.7, { parent: g, dirt: 0 }); // (rust)
    box(0.06, 0.25, 0.5, M.plain('#5a1414', 0.4, 0), 2.72, 1.0, -0.8, { parent: g, dirt: 0 }); box(0.06, 0.25, 0.5, M.plain('#5a1414', 0.4, 0), 2.72, 1.0, 0.8, { parent: g, dirt: 0 });
    topY = 3;
  } else if (KIND === 'arcade') { // a covered arcade over a street: a glass barrel roof on steel ribs, shop kiosks under it
    const along = TW >= TH ? 'x' : 'z', len = along === 'x' ? X1 - X0 + 1.4 : Z1 - Z0 + 1.4, span = along === 'x' ? Z1 - Z0 + 1.4 : X1 - X0 + 1.4, hgt = 7.5;
    const g = L.group(0, 0, 0, along === 'x' ? 0 : PI / 2);
    const steel = M.plain('#4a5258', 0.45, 0.6), glass = new THREE.MeshPhysicalMaterial({ color: '#86aab4', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55, clearcoat: 0.8, envMapIntensity: 1.3 });
    for (let x = -len / 2 + 0.3; x <= len / 2 - 0.2; x += 2.4) {
      for (const s of [-1, 1]) box(0.35, hgt, 0.35, steel, x, 0, s * (span / 2 - 0.3), { parent: g, dirt: 0.4 });
      const rib = new THREE.TorusGeometry(span / 2 - 0.3, 0.14, 6, 24, PI); rib.rotateY(PI / 2); rib.scale(1, 0.55, 1);
      mesh(rib, steel, x, hgt, 0, { parent: g, dirt: 0 });
    }
    const roof = new THREE.CylinderGeometry(span / 2 - 0.3, span / 2 - 0.3, len, 24, 1, true, 0, PI); roof.rotateZ(PI / 2); // (theta 0..PI: the upper half once its axis lies along x) roof.scale(1, 0.55, 1);
    mesh(roof, glass, 0, hgt, 0, { parent: g, dirt: 0, cast: false });
    box(len, 0.35, 0.5, steel, 0, hgt - 0.35, span / 2 - 0.3, { parent: g, dirt: 0 }); box(len, 0.35, 0.5, steel, 0, hgt - 0.35, -span / 2 + 0.3, { parent: g, dirt: 0 });
    // kiosks down the middle, lit by night
    for (let x = -len / 2 + 2.5; x < len / 2 - 2; x += RR(4, 6)) { box(2.2, 2.4, 1.6, std({ color: pick(['#8a7d6c', '#6e7476', '#7b6a5e']) }), x, 0, RR(-1, 1), { parent: g, dirt: 0.4 }); box(1.8, 0.6, 0.05, light(pick(['#ffc477', '#7ff6ff', '#ff7a3a']), 2.4), x, 1.5, 0.83, { parent: g, dirt: 0, cast: false }); }
    for (let x = -len / 2 + 1.2; x < len / 2; x += 4.8) box(0.4, 0.2, 0.4, light('#ffe2a8', 3, '#8a8a80'), x, hgt + 1.4, 0, { parent: g, dirt: 0, cast: false });
    topY = hgt + 4.5;
  }

  // ------------------------------------------------------------------ stripping
  if (STRIP && KIND !== 'car' && KIND !== 'arcade') {
    const scaf = M.plain('#c8bfae', 0.6, 0.4), plank = M.wood, net = new THREE.MeshStandardMaterial({ color: '#3f8a86', transparent: true, opacity: 0.7, roughness: 0.9, side: THREE.DoubleSide });
    const fb = blocks.reduce((a, b) => (b.z1 > a.z1 - 0.5 && b.y0 < 0.1 ? (b.x1 - b.x0 > a.x1 - a.x0 ? b : a) : a), blocks[0]);
    const z = fb.z1 + 0.9, top = Math.min(fb.y1 + 1, FH * 4 + 1);
    for (let x = fb.x0; x <= fb.x1 + 0.01; x += 2.4) { box(0.24, top, 0.24, scaf, x, 0, z, { dirt: 0 }); box(0.24, top, 0.24, scaf, x, 0, z - 0.7, { dirt: 0 }); }
    for (let y = FH; y < top; y += FH) { box(fb.x1 - fb.x0, 0.22, 0.22, scaf, (fb.x0 + fb.x1) / 2, y, z, { dirt: 0 }); box(fb.x1 - fb.x0, 0.12, 0.8, plank, (fb.x0 + fb.x1) / 2, y - 0.12, z - 0.35, { dirt: 0 }); }
    if (R() < 0.7) mesh(new THREE.PlaneGeometry((fb.x1 - fb.x0) * 0.45, top - FH), net, fb.x0 + (fb.x1 - fb.x0) * 0.3, FH + (top - FH) / 2, z + 0.06, { dirt: 0, cast: false });
    // the top block's roof gone: girders over a dark hole, rubble heaps
    const tb = blocks.reduce((a, b) => (b.y1 > a.y1 ? b : a), blocks[0]);
    box(tb.x1 - tb.x0 - 0.8, 0.05, tb.z1 - tb.z0 - 0.8, M.plain('#16130f', 1, 0), (tb.x0 + tb.x1) / 2, tb.y1 + 0.02, (tb.z0 + tb.z1) / 2, nc);
    const rust = M.plain('#7a5a40', 0.7, 0.4);
    for (let x = tb.x0 + 1; x < tb.x1 - 0.6; x += 1.6) box(0.25, 0.35, tb.z1 - tb.z0 - 0.6, rust, x, tb.y1, (tb.z0 + tb.z1) / 2, { dirt: 0 });
    // crates of salvage stacked at the foot (the colony's Workers carry them off)
    for (let k = 0; k < 3; k++) box(1.1, 1.0, 1.1, std({ color: pick(['#9a8f7e', '#7d8a8c', '#a88c6c']) }), fb.x0 + 1 + k * 1.3, 0, fb.z1 + 2.2 - (k % 2) * 0.3, { dirt: 0.3 });
    for (let k = 0; k < 4; k++) { const geo = new THREE.DodecahedronGeometry(RR(0.6, 1.2), 0); geo.scale(1.4, 0.5, 1); mesh(geo, M.rough(pick(['#8a857a', '#6e6a62', '#9c978c'])), RR(tb.x0 + 1, tb.x1 - 1), tb.y1 + 0.1, RR(tb.z0 + 1, tb.z1 - 1), { dirt: 0 }); }
    if (STRIP >= 2) { // most of it gone: knock the facades out above the first floor, leaving the columns and slabs
      for (const b of blocks.slice()) {
        if (b.y1 - b.y0 <= FH * 1.5) continue;
        b.m.visible = false; b.m.userData.front.visible = false;
        const slab = M.rough('#9c978c'), col = M.rough('#8a857a');
        block(b.x0, b.x1, b.z0, b.z1, b.y0, Math.min(b.y1, b.y0 + FH) , { style: 'grid', ground: 'none', holes: 0.6, parapet: false });
        for (let y = b.y0 + FH; y < b.y1 - 0.3; y += FH) { for (let zz = b.z0 + 0.4; zz < b.z1; zz += 3) box(b.x1 - b.x0, 0.4, 0.5, slab, (b.x0 + b.x1) / 2, y, zz, { dirt: 0.2 }); const kept = RR(0.3, 0.6); box((b.x1 - b.x0) * kept, 0.3, b.z1 - b.z0, slab, b.x0 + (b.x1 - b.x0) * kept / 2, y, (b.z0 + b.z1) / 2, { dirt: 0.2 }); }
        for (let x = b.x0 + 0.2; x <= b.x1; x += 3) for (const zz of [b.z0 + 0.2, b.z1 - 0.2]) box(0.4, Math.min(b.y1 - b.y0, FH * 3), 0.4, col, x, b.y0, zz, { dirt: 0.2 });
      }
    }
  }

  // ------------------------------------------------------------------ frame, shadows, marks
  L.mark('lotFL', -LX, 0, LZ); L.mark('lotFR', LX, 0, LZ); L.mark('lotBL', -LX, 0, -LZ); L.mark('lotBR', LX, 0, -LZ); L.mark('foot', 0, 0, LZ);
  const scene = L.getScene();
  let sunDir = new THREE.Vector3(-7, 15, -6.5);
  const span = Math.max(LX, LZ) + topY * 1.2 + 12;
  scene.traverse((o) => {
    if (!o.isDirectionalLight || !o.castShadow) return;
    sunDir = o.position.clone();
    o.position.multiplyScalar(Math.max(1, (span * 2.2) / o.position.length()));
    const c = o.shadow.camera; c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.near = 1; c.far = span * 5; c.updateProjectionMatrix();
    o.shadow.bias = -0.0003;
  });
  // the camera: orthographic, 57 degrees down, square-on; the canvas fitted round the building and its shadow
  const ELEV = (57 * PI) / 180, D = new THREE.Vector3(0, -Math.sin(ELEV), -Math.cos(ELEV)), U = new THREE.Vector3(0, Math.cos(ELEV), -Math.sin(ELEV));
  const root = L.getRoot(); root.updateMatrixWorld(true);
  const bb = new THREE.Box3(); root.traverse((o) => { if (o.isMesh && o.visible) bb.expandByObject(o); });
  bb.expandByPoint(new THREE.Vector3(-LX, 0, -LZ)); bb.expandByPoint(new THREE.Vector3(LX, 0, LZ));
  const sx = sunDir.x / sunDir.y, sz = sunDir.z / sunDir.y; // (a point at height y casts onto the ground at x - y*sx, z - y*sz)
  let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
  for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) {
    for (const p of [new THREE.Vector3(x, y, z), new THREE.Vector3(x - y * sx, 0, z - y * sz)]) { u0 = Math.min(u0, p.x); u1 = Math.max(u1, p.x); const v = p.dot(U); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  }
  // snap so the lot's front-left corner lands on a whole (final) pixel: the sprites then join on the grid exactly
  const step = 2 / PPU, mg = 1.5;
  const uL = -LX - Math.ceil((-LX - u0 + mg) / step) * step, vB = LZ * -Math.sin(ELEV) - Math.ceil((LZ * -Math.sin(ELEV) - v0 + mg) / step) * step;
  const Wpx = Math.ceil((u1 + mg - uL) * PPU / 2) * 2, Hpx = Math.ceil((v1 + mg - vB) * PPU / 2) * 2;
  const cam = new THREE.OrthographicCamera(uL, uL + Wpx / PPU, vB + Hpx / PPU, vB, 0.1, 2000);
  cam.position.copy(D.clone().multiplyScalar(-800)); cam.up.copy(U); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.getRenderer().setSize(Wpx, Hpx);
  L.useCamera(cam);
  // the shadow catcher, shown only in the shadow pass
  const sg = new THREE.PlaneGeometry(4000, 4000); sg.rotateX(-PI / 2);
  const catcher = new THREE.Mesh(sg, new THREE.ShadowMaterial({ opacity: 1, color: 0x000000 })); catcher.receiveShadow = true; catcher.visible = false; catcher.userData.decal = true; scene.add(catcher);
  _t = { L, catcher };
}

// After beauty and glow: the shadow pass, the building itself unseen but still casting, the catcher on the ground.
let _t = null;
export function after() {
  const { L, catcher } = _t, THREE = L.THREE, r = L.getRenderer();
  r.shadowMap.enabled = true; r.shadowMap.needsUpdate = true;
  const hide = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  L.getRoot().traverse((o) => { if (o.isMesh) o.material = hide; });
  catcher.visible = true;
  L.snap('shadow');
}
