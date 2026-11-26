'use strict';
/*
 * Terrafall — The Ring's look (SHAPE_PRESETS asteroids, ringMap in js/world.js): the space behind the asteroids, drawn in code.
 * Looks only: nothing here reads or changes anything the game decides, so it may use Math.random and the real clock.
 *
 *   - ringSpace: what shows where there is no ground (the map is drawn over it, its void tiles left clear): a deep sky with a few
 *     faint nebulae, three layers of stars that drift slowly and slide a little as the view pans (the further the layer, the
 *     less), Corvane's glow at one corner, Ithaca I large and turning with its Ring round it, Argos turning small beside it,
 *     and now and then a streak of ringfall. The asteroids themselves stay put.
 *   - ringClipLand: the day's light and the dusk are graded over the ground only (space is not lit by the day and night cycle).
 *   - Cheap: the stars are three small tiles drawn a few times each, the planet and the moon are textures made once and turned
 *     by sampling them a couple of times a second into a small sprite. Graphics Saver draws one star layer and no motion;
 *     reduced motion holds everything still.
 */

const RSP = { of: null, tiles: null, spr: {}, planet: null, moon: null, tex: null, falls: [], next: 0, last: 0, t: 0, landFor: null };

/** 3D value noise (0..1) for the planet's seamless texture. */
function rspNoise(x, y, z, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi;
  const s = (v) => v * v * (3 - 2 * v);
  const h = (a, b, c) => hash2(a + c * 977, b + c * 31, seed);
  const lerpN = (a, b, t) => a + (b - a) * t;
  const u = s(fx), v = s(fy), w = s(fz);
  const l0 = lerpN(lerpN(h(xi, yi, zi), h(xi + 1, yi, zi), u), lerpN(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v);
  const l1 = lerpN(lerpN(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), lerpN(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v);
  return lerpN(l0, l1, w);
}
function rspFbm(x, y, z, seed, oct) { let s = 0, a = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { s += a * rspNoise(x * f, y * f, z * f, seed + o * 17); n += a; a *= 0.5; f *= 2; } return s / n; }

/** A soft disc sprite in colour rgb (alpha 1 at the middle falling to 0 at the edge), made once. */
function rspSprite(name, rgb, core) {
  if (RSP.spr[name]) return RSP.spr[name];
  const n = 96, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
  if (core) { gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.1, `rgba(${rgb},0.95)`); gr.addColorStop(0.4, `rgba(${rgb},0.28)`); }
  else { gr.addColorStop(0, `rgba(${rgb},1)`); gr.addColorStop(0.5, `rgba(${rgb},0.35)`); }
  gr.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, n, n);
  return (RSP.spr[name] = c);
}

/** One tile of stars: `n` of them in a size × size tile, `big` of the brightest with a little cross of light. */
function rspStarTile(seed, size, n, bigShare, dim, d) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * d);
  const g = c.getContext('2d');
  g.scale(d, d);
  for (let k = 0; k < n; k++) {
    const x = 3 + hash2(k, 3, seed) * (size - 6), y = 3 + hash2(k, 4, seed) * (size - 6), b = hash2(k, 5, seed), tint = hash2(k, 6, seed);
    const rgb = tint > 0.86 ? '255,226,196' : tint < 0.16 ? '190,212,255' : '226,234,255';
    const r = b > 1 - bigShare ? 1.15 : 0.6 + 0.35 * b;
    g.fillStyle = `rgba(${rgb},${dim * (0.35 + 0.65 * b)})`;
    g.fillRect(x - r / 2, y - r / 2, r, r);
    if (b > 1 - bigShare) {
      g.fillStyle = `rgba(${rgb},${dim * 0.18})`;
      g.fillRect(x - 2.6, y - 0.3, 5.2, 0.6); g.fillRect(x - 0.3, y - 2.6, 0.6, 5.2);
    }
  }
  return c;
}

/** Ithaca I's face (256 × 128, longitude by latitude): seas, rust and green land, pale polar caps, a few clouds. */
function rspPlanetTexture() {
  const w = 256, h = 128, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), seed = 7311;
  for (let j = 0; j < h; j++) {
    const lat = (j / h - 0.5) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i / w) * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      const e = rspFbm(x * 2.3 + 5, y * 2.3 + 5, z * 2.3 + 5, seed, 4), m = rspFbm(x * 3.1 + 40, y * 3.1 + 40, z * 3.1 + 40, seed + 9, 3);
      let r, gg, b;
      if (e < 0.5) { const k = clamp((0.5 - e) * 5, 0, 1); r = 30 - 14 * k; gg = 86 - 34 * k; b = 140 - 40 * k; }
      else { const k = clamp((e - 0.5) * 4, 0, 1), dry = clamp((m - 0.42) * 4, 0, 1); r = 92 + 80 * dry + 30 * k; gg = 118 - 14 * dry + 14 * k; b = 60 + 4 * k; if (dry < 0.5) { r *= 0.8; gg *= 1.08; } }
      const cap = clamp((Math.abs(lat) - 1.12) * 9, 0, 1);
      r += (236 - r) * cap; gg += (240 - gg) * cap; b += (246 - b) * cap;
      const cloud = clamp((rspFbm(x * 3.6 + 90, y * 3.6 + 90, z * 3.6 + 90, seed + 31, 3) - 0.56) * 4.5, 0, 0.8);
      r += (250 - r) * cloud; gg += (250 - gg) * cloud; b += (252 - b) * cloud;
      const o = (j * w + i) * 4;
      img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Argos's face (128 × 64): grey regolith pocked with craters. */
function rspMoonTexture() {
  const w = 128, h = 64, c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h), seed = 4421;
  const craters = [];
  for (let k = 0; k < 34; k++) craters.push({ u: hash2(k, 1, seed) * w, v: 6 + hash2(k, 2, seed) * (h - 12), r: 1.6 + hash2(k, 3, seed) * hash2(k, 4, seed) * 7 });
  for (let j = 0; j < h; j++) {
    const lat = (j / h - 0.5) * Math.PI, cl = Math.cos(lat), y = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = (i / w) * Math.PI * 2, x = cl * Math.cos(lon), z = cl * Math.sin(lon);
      let v = 150 + 50 * (rspFbm(x * 3 + 11, y * 3 + 11, z * 3 + 11, seed, 4) - 0.5) * 2;
      for (const k of craters) {
        let du = Math.abs(i - k.u); if (du > w / 2) du = w - du;
        const d = Math.sqrt(du * du * cl * cl + (j - k.v) * (j - k.v)) / k.r;
        if (d < 1) v -= 30 * (1 - d); else if (d < 1.25) v += 24 * (1.25 - d) * 4;
      }
      const o = (j * w + i) * 4;
      img.data[o] = v; img.data[o + 1] = v - 2; img.data[o + 2] = v + 4; img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

/**
 * A turning ball: its sprite (D × D px), made from texture `tex` turned `rot` radians, lit from the upper left. The per-pixel
 * lookups (which texel, how bright) are worked out once for a size; a turn only moves the column.
 */
function rspBall(ball, tex, D, rot, ambient) {
  if (!ball.D || ball.D !== D) {
    ball.D = D; ball.cv = document.createElement('canvas'); ball.cv.width = ball.cv.height = D;
    ball.g = ball.cv.getContext('2d'); ball.img = ball.g.createImageData(D, D);
    ball.px = new Float32Array(D * D).fill(-1); ball.row = new Int16Array(D * D); ball.shade = new Float32Array(D * D);
    const L = [-0.5, -0.45, 0.74], ln = Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]);
    for (let j = 0; j < D; j++) for (let i = 0; i < D; i++) {
      const x = ((i + 0.5) / D) * 2 - 1, y = ((j + 0.5) / D) * 2 - 1, rr = x * x + y * y, o = j * D + i;
      if (rr >= 1) continue;
      const z = Math.sqrt(1 - rr);
      ball.px[o] = (Math.atan2(x, z) / (Math.PI * 2)) * tex.width; // (longitude from the middle, in texels)
      ball.row[o] = Math.floor(clamp(0.5 + Math.asin(clamp(y, -1, 1)) / Math.PI, 0, 0.999) * tex.height);
      const lam = Math.max(0, (x * L[0] + y * L[1] + z * L[2]) / ln);
      ball.shade[o] = ambient + (1 - ambient) * Math.pow(lam, 0.85);
    }
  }
  if (!ball.texData || ball.texOf !== tex) { ball.texOf = tex; ball.texData = tex.getContext('2d').getImageData(0, 0, tex.width, tex.height).data; }
  const T = ball.texData, tw = tex.width, d = ball.img.data, shift = (rot / (Math.PI * 2)) * tw;
  for (let o = 0; o < D * D; o++) {
    const p = ball.px[o];
    if (p < -0.5) { d[o * 4 + 3] = 0; continue; }
    let u = Math.floor(p + shift) % tw; if (u < 0) u += tw;
    const t = (ball.row[o] * tw + u) * 4, s = ball.shade[o];
    d[o * 4] = T[t] * s; d[o * 4 + 1] = T[t + 1] * s; d[o * 4 + 2] = T[t + 2] * s;
    const x = ((o % D) + 0.5) / D * 2 - 1, y = (((o / D) | 0) + 0.5) / D * 2 - 1, edge = Math.sqrt(x * x + y * y);
    d[o * 4 + 3] = edge > 0.985 ? Math.max(0, (1 - edge) / 0.015) * 255 : 255; // (a soft edge)
  }
  ball.g.putImageData(ball.img, 0, 0);
  return ball.cv;
}

/** The Ring round Ithaca I (tilted bands), `half` 'back' (behind the planet) or 'front'. */
function rspRing(g, px, py, r, half, tilt) {
  g.save();
  g.translate(px, py); g.rotate(tilt);
  const bands = [[1.92, 0.09, 0.16], [1.81, 0.04, 0.46], [1.69, 0.07, 0.3], [1.56, 0.03, 0.18], [1.46, 0.05, 0.24]];
  const gr = g.createLinearGradient(-r * 2, -r * 0.6, r * 2, r * 0.6);
  gr.addColorStop(0, 'rgba(120,110,120,0.55)'); gr.addColorStop(1, 'rgba(244,230,206,0.95)');
  g.strokeStyle = gr;
  for (const [rk, wk, a] of bands) {
    g.globalAlpha = Math.min(1, a * 1.8); g.lineWidth = Math.max(1, r * wk);
    g.beginPath();
    if (half === 'back') g.ellipse(0, 0, r * rk, r * rk * 0.22, 0, Math.PI, Math.PI * 2); else g.ellipse(0, 0, r * rk, r * rk * 0.22, 0, 0, Math.PI);
    g.stroke();
  }
  g.restore();
}

/** Ringfall in the sky: now and then a streak across the view, a spark where it burns out. */
function rspFalls(g, dt, calm) {
  const t = RSP.t;
  if (!calm && t >= RSP.next) {
    const a = 0.5 + Math.random() * 0.7, left = Math.random() < 0.5;
    RSP.falls.push({ x: Math.random() * R.w * (left ? 0.9 : 1.1), y: -10 + Math.random() * R.h * 0.5, dx: (left ? 1 : -1) * Math.cos(a), dy: Math.sin(a), sp: 360 + Math.random() * 360, len: 60 + Math.random() * 110, life: 0.8 + Math.random() * 0.8, age: 0 });
    RSP.next = t + 2.6 + Math.random() * 5.5;
  }
  const fl = rspSprite('fall', '255,220,180', true);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const f of RSP.falls) {
    f.age += dt;
    const k = f.age / f.life, hx = f.x + f.dx * f.sp * f.age, hy = f.y + f.dy * f.sp * f.age, a = Math.max(0, 1 - k) * Math.min(1, f.age * 8);
    const tx = hx - f.dx * f.len * Math.min(1, f.age * 3), ty = hy - f.dy * f.len * Math.min(1, f.age * 3);
    const gr = g.createLinearGradient(tx, ty, hx, hy);
    gr.addColorStop(0, 'rgba(255,200,150,0)'); gr.addColorStop(1, `rgba(255,236,208,${0.85 * a})`);
    g.strokeStyle = gr; g.lineWidth = 1.4; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
    if (k > 0.82) { const s = 6 + 10 * (k - 0.82); g.globalAlpha = (1 - k) * 4; g.drawImage(fl, hx - s, hy - s, s * 2, s * 2); g.globalAlpha = 1; }
  }
  g.restore();
  RSP.falls = RSP.falls.filter((f) => f.age < f.life);
}

/**
 * The space behind the asteroids, for the frame: ox, oy the map's corner on screen (css px) and z the zoom. Called instead of
 * drawOffMap on The Ring (R.void), over the dark fill the frame starts with.
 */
function ringSpace(ctx, ox, oy, z) {
  if (RSP.of !== S) { RSP.of = S; RSP.tiles = null; RSP.planet = { rot: 0 }; RSP.moon = { rot: 0 }; RSP.falls = []; RSP.next = 1.5; RSP.last = 0; RSP.t = 0; RSP.tex = null; }
  const now = performance.now() / 1000, dt = RSP.last ? Math.min(0.1, now - RSP.last) : 0;
  RSP.last = now;
  const still = !!(LESS_MOTION && LESS_MOTION.matches), saver = typeof gfxStep === 'function' && gfxStep() === 'saver', calm = still || saver;
  if (!calm) RSP.t += dt;
  const T = still ? 0 : RSP.t, d = Math.min(R.dpr || 1, 2), W = R.w, H = R.h;
  const camx = (R.cam.x - S.W / 2) * z, camy = (R.cam.y - S.H / 2) * z; // (how far the view has moved from the middle of the map, px)
  // The sky.
  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, '#0b1124'); bg.addColorStop(0.5, '#070b17'); bg.addColorStop(1, '#04060d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // A few faint nebulae, far off.
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const neb = [[0.2, 0.3, 0.9, '110,70,170', 0.07], [0.78, 0.62, 1.05, '50,100,170', 0.075], [0.5, 0.92, 0.8, '60,140,150', 0.045]];
  for (const [fx, fy, s, rgb, a] of neb) {
    const sp = rspSprite('neb' + rgb, rgb), r = Math.max(W, H) * s * 0.55;
    ctx.globalAlpha = a; ctx.drawImage(sp, fx * W - camx * 0.012 - r, fy * H - camy * 0.012 - r, r * 2, r * 2);
  }
  ctx.restore();
  // Three layers of stars (the far ones drift least and slide least with the view).
  if (!RSP.tiles) RSP.tiles = [rspStarTile(11, 384, 150, 0.0, 0.8, d), rspStarTile(23, 320, 70, 0.04, 0.95, d), rspStarTile(37, 448, 34, 0.14, 1, d)];
  const layers = [[0.014, 2, 0.9], [0.03, 5, 1], [0.055, 9, 1]];
  for (let k = 0; k < (saver ? 1 : 3); k++) {
    const tile = RSP.tiles[k], size = tile.width / d, par = layers[k][0], vx = layers[k][1], vy = layers[k][2] * 0.6;
    const offx = (((-camx * par - T * vx) % size) + size) % size, offy = (((-camy * par - T * vy) % size) + size) % size;
    for (let y = offy - size; y < H; y += size) for (let x = offx - size; x < W; x += size) ctx.drawImage(tile, x, y, size, size);
  }
  // Corvane's glow in a corner, a warm lens streak across it.
  {
    const sx = W * 0.07 - camx * 0.02, sy = H * -0.03 - camy * 0.02, rs = Math.min(W, H) * 0.045;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const co = rspSprite('corona', '255,150,80'), cr = rspSprite('core', '255,214,160', true), flare = still ? 0 : Math.max(0, Math.sin((T / 37) * Math.PI * 2)) ** 12;
    ctx.globalAlpha = 0.34 + 0.18 * flare; let q = rs * (10 + 2 * flare); ctx.drawImage(co, sx - q, sy - q, q * 2, q * 2);
    ctx.globalAlpha = 0.85; q = rs * 3.4; ctx.drawImage(co, sx - q, sy - q, q * 2, q * 2);
    ctx.globalAlpha = 1; q = rs * 1.5; ctx.drawImage(cr, sx - q, sy - q, q * 2, q * 2);
    ctx.globalAlpha = 0.18; ctx.drawImage(cr, sx - rs * 15, sy - rs * 0.16, rs * 30, rs * 0.32);
    ctx.restore();
  }
  // Ithaca I, large and turning slowly, its Ring round it; Argos, small and turning faster.
  const pr = clamp(Math.min(W, H) * 0.24, 80, 170), px = W * 0.8 - camx * 0.05, py = H * 0.2 - camy * 0.05, tilt = -0.32;
  if (px > -pr * 2.2 && px < W + pr * 2.2 && py > -pr * 2.2 && py < H + pr * 2.2) {
    rspRing(ctx, px, py, pr, 'back', tilt);
    const D = Math.round(pr * 2 * d), P = RSP.planet;
    if (!RSP.tex) RSP.tex = { planet: rspPlanetTexture(), moon: rspMoonTexture() };
    P.rot = still ? 1.4 : (T / 520) * Math.PI * 2 + 1.4; // (one turn in about nine minutes)
    if (!P.cv || P.D !== D || !P.at || Math.abs(now - P.at) > (saver ? 2 : 0.45)) { P.at = now; P.sprite = rspBall(P, RSP.tex.planet, D, P.rot, 0.1); }
    ctx.drawImage(P.sprite, px - pr, py - pr, pr * 2, pr * 2);
    // (its air: a thin blue rim on the lit side, and the dark side's edge)
    const at = ctx.createRadialGradient(px, py, pr * 0.9, px, py, pr * 1.09);
    at.addColorStop(0, 'rgba(120,170,255,0)'); at.addColorStop(0.55, 'rgba(120,170,255,0.2)'); at.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = at; ctx.beginPath(); ctx.arc(px, py, pr * 1.09, 0, Math.PI * 2); ctx.fill();
    rspRing(ctx, px, py, pr, 'front', tilt);
    const mr = pr * 0.24, ma = (T / 80) * Math.PI * 2 + 2.2, mx = W * 0.2 - camx * 0.08, my = H * 0.78 - camy * 0.08, M = RSP.moon, MD = Math.round(mr * 2 * d);
    M.rot = still ? 0.5 : (T / 60) * Math.PI * 2;
    if (!M.cv || M.D !== MD || !M.at || Math.abs(now - M.at) > (saver ? 2 : 0.45)) { M.at = now; M.sprite = rspBall(M, RSP.tex.moon, MD, M.rot, 0.07); }
    void ma;
    ctx.drawImage(M.sprite, mx - mr, my - mr, mr * 2, mr * 2);
  }
  rspFalls(ctx, dt, calm);
}

/**
 * Clip to the asteroids (their ground and the rock face under each): what the light of the day and the dusk is graded over, so the
 * space stays as it is. Call between ctx.save() and ctx.restore(); the map's drawing resumes in screen space after it.
 */
function ringClipLand(ctx, ox, oy, z) {
  if (RSP.landFor !== S || !RSP.land) {
    RSP.landFor = S;
    const p = new Path2D(), W = S.W, H = S.H;
    const land = (i, j) => inMap(i, j) && S.terrain[j * W + i] !== T_CHASM;
    for (let j = 0; j < H; j++) {
      let i0 = -1;
      for (let i = 0; i <= W; i++) {
        const on = i < W && (land(i, j) || land(i, j - 1) || land(i, j - 2));
        if (on && i0 < 0) i0 = i;
        else if (!on && i0 >= 0) { p.rect(i0, j, i - i0 + 0.04, 1.04); i0 = -1; }
      }
    }
    RSP.land = p;
  }
  ctx.translate(ox, oy); ctx.scale(z, z);
  ctx.clip(RSP.land);
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
}
