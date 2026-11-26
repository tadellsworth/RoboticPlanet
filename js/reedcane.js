'use strict';
/*
 * Fiber's Stalks drawn as Lantern Cane (the owner's pick from six Reedcane redesigns, Nov 2026; ART_GUIDE Batch 16):
 * a clump of tall jointed canes in Fiber's mint-teal, a darker ring at every joint, a few narrow leaves off the joints.
 * When the clump is ripe its rings turn pale mint, and at night they are lit: a field reads as rows of mint lights.
 *
 * Nothing here is an image file: each look is drawn in code once, the first time it's needed, into a small canvas that
 * is then used like any art (REED.cache), so a big field costs one drawImage a clump when its tiles are baked and
 * nothing per frame by day. The looks:
 *   - a stage of growth (reedState, from the tile's S.grow): a quarter grown is mostly pale cut stumps with a few
 *     short shoots, a half and three quarters grown are canes regrowing a joint at a time (rings still dull green),
 *     and ripe is full height with mint rings;
 *   - a ripe clump being cut (from S.amt): a third and then two thirds of its canes are cut to stumps;
 *   - three variants (REED.variants), one picked for each tile from its position (reedVariant), with a small nudge
 *     off the tile's middle, so a field isn't one clump repeated on a grid.
 * A sprite is 1.5 tiles square (REED.scale), its foot at the tile's middle and its canes standing up into the tile
 * above, so the clumps are drawn after the ground of every tile round them (drawStalks, from the bakes in
 * js/render.js), like the decorative plants. They're graded for evening and night with the ground.
 *
 * Their light: a soft mint halo in the night glow map (16 px a tile, drawStalks with glow), and zoomed in, where that
 * map is too coarse to show single rings, each ring's own small light drawn over it (drawReedLights: one cached
 * sprite a clump in view, only at dusk and night, not on the Saver graphics step). A clump growing back is lit too,
 * dimmer the less grown (REED.lit).
 *
 * Render state only: read from S, never written to it, and no part of the simulation reads it.
 */

const REED = {
  px: 128,           // sprite pixels a tile (the sharp map's finest)
  glowPx: 32,        // the halo sprites' pixels a tile (the night glow map is 16)
  scale: 1.5, anchor: [0.5, 2 / 3],
  zoom: 1.22,        // the design's own scale inside its 192-unit tile (as drawn on the design sheet)
  hf: [0.3, 0.52, 0.76, 1],     // cane height at each stage (a quarter, half, three quarters grown, ripe)
  stumps: [0.75, 0.3, 0.1, 0],  // share of the canes still stumps at each stage
  cut: [0, 0.34, 0.67],         // share of a ripe clump's canes cut to stumps, by how much of it is left (reedState)
  lit: [0.28, 0.45, 0.68, 1],   // how bright its lights are at night at each stage
  live: [30, 46],    // zoom (css px a tile) over which the rings' own lights fade in (drawReedLights)
  // Three clumps: the seed for where its canes stand, how many, and how wide the clump is.
  variants: [{ seed: 1101, n: 12, rx: 38, ry: 18 }, { seed: 2417, n: 10, rx: 34, ry: 16 }, { seed: 3733, n: 13, rx: 41, ry: 19 }],
  cache: new Map(),
};

/** The look of a Stalk with growth `grow` and `amt` left: { s: stage 0..3, c: how much of a ripe clump is cut, 0..2 }. */
function reedState(grow, amt) {
  const s = grow >= 0.875 ? 3 : grow < 0.375 ? 0 : grow < 0.625 ? 1 : 2;
  const f = amt / RES[R_STALK].amount;
  return { s, c: s < 3 || f >= 0.99 ? 0 : f > 0.5 ? 1 : 2 };
}

/** Which clump stands on tile (i, j), and how far it's nudged off the tile's middle (in tiles). */
function reedVariant(i, j) {
  return { v: Math.floor(hash2(i, j, 5179) * REED.variants.length), dx: (hash2(i, j, 5183) - 0.5) * 0.12, dy: (hash2(i, j, 5189) - 0.5) * 0.07 };
}

/**
 * The cached art for clump v at state st: kind 'art' (the clump itself), 'glow' (its halo for the night glow map) or
 * 'lights' (its rings' crisp lights, drawn live). An art entry as drawArt takes it.
 */
function reedArt(v, st, kind) {
  const key = `${kind}:${v}:${st.s}:${st.c}`;
  let a = REED.cache.get(key);
  if (!a) {
    a = { img: reedPaint(v, st.s, st.c, kind), scale: REED.scale, anchor: REED.anchor, key: 'reedcane' };
    if (kind === 'lights') reedCrop(a);
    REED.cache.set(key, a);
  }
  return a;
}

/**
 * Trim a lights sprite to the part that holds any light (most of it is empty), noting where that part lies in the
 * full sprite (fx, fy, fw, fh: shares of its side), so the many drawn each frame cover as few pixels as they can.
 */
function reedCrop(a) {
  const c = a.img, W = c.width;
  a.fx = a.fy = 0; a.fw = a.fh = 1;
  let d;
  try { d = c.getContext('2d').getImageData(0, 0, W, W).data; } catch (e) { return; }
  let x0 = W, y0 = W, x1 = -1, y1 = -1;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 2) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) { a.empty = true; return; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, o = document.createElement('canvas');
  o.width = w; o.height = h;
  o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
  Object.assign(a, { img: o, fx: x0 / W, fy: y0 / W, fw: w / W, fh: h / W });
}

/** A seeded random number source (the canes' places; looks only). */
function reedRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Clump v's canes, back to front: where each stands and its full height, lean and girth (in 192 units a tile). */
function reedCanes(v) {
  const V = REED.variants[v], R = reedRng(V.seed), R2 = reedRng(V.seed + 7), out = [];
  for (let k = 0; k < V.n; k++) {
    const a = R() * Math.PI * 2, r = Math.sqrt(0.15 + 0.85 * R());
    const x = 96 + Math.cos(a) * V.rx * r, y = 128 + Math.sin(a) * V.ry * r;
    const r1 = R(), r2 = R(), r3 = R(), r4 = R(), r5 = R2();
    out.push({ x, y, k, H: 64 + r1 * 52, lean: (x - 96) * 0.22 + (r2 - 0.5) * 8, w: 7.6 + r3 * 2, r1, r4, r5 });
  }
  // Which canes are stumps: the lowest r4 while it grows back, the lowest r5 as a ripe clump is cut.
  const rank = (f) => { const o = out.slice().sort((p, q) => p[f] - q[f]); o.forEach((c, n) => { c[f + 'rank'] = n / out.length; }); };
  rank('r4'); rank('r5');
  return out.sort((p, q) => p.y - q.y);
}

/** Draw clump v at stage s (cut c) into a new canvas: the clump itself, or only its light (kind 'glow' or 'lights'). */
function reedPaint(v, s, c, kind) {
  const N = kind === 'glow' ? REED.glowPx : REED.px, TAU = Math.PI * 2, hf = REED.hf[s], ripe = s === 3, art = kind === 'art';
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(N * REED.scale);
  const ctx = cv.getContext('2d');
  // 192 units a tile, the tile's top-left at (48, 96) of the 1.5-tile canvas; the design's own zoom about the clump's foot.
  const k = N / 192, Z = REED.zoom;
  const T = [k * Z, 48 * k + 96 * k * (1 - Z), 96 * k + 132 * k * (1 - Z)];
  ctx.setTransform(T[0], 0, 0, T[0], T[1], T[2]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const canes = reedCanes(v).map((p) => {
    const stump = s < 3 ? p.r4rank < REED.stumps[s] : p.r5rank < REED.cut[c];
    const H = p.H * hf;
    return { ...p, stump, H, seg: Math.max(1, Math.round(H / 19)), cut: s === 3 && stump };
  });
  const lit = REED.lit[s];
  const dot = (x, y, r, a) => { // a soft mint light
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(150,255,215,${a})`); g.addColorStop(0.35, `rgba(120,255,205,${a * 0.55})`); g.addColorStop(1, 'rgba(120,255,205,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  };
  const light = (x, y, big) => {
    if (kind === 'glow') dot(x, y, big ? 14 : 10, (big ? 0.34 : 0.26) * lit);
    else { dot(x, y, big ? 5.5 : 4.5, (big ? 0.55 : 0.45) * lit); dot(x, y, 1.7, 0.85 * lit); }
  };
  if (art) reedShadow(ctx, T, canes);
  for (const cn of canes) {
    if (cn.stump) {
      if (art) reedStump(ctx, cn.x, cn.y, cn.w * 0.85, 6 + cn.r1 * 3, cn.cut ? '#5a7f62' : '#4d7a5c', cn.cut ? '#eee6bd' : '#e2dcae');
      else if (!cn.cut && s === 0) light(cn.x, cn.y - 7, false); // (a stump about to shoot, faintly lit)
      continue;
    }
    const at = (f) => ({ x: cn.x + cn.lean * f * f, y: cn.y - cn.H * f });
    for (let n = 0; n < cn.seg; n++) {
      const f1 = (n + 1) / cn.seg, a = at(n / cn.seg), b = at(f1), w = cn.w * (1 - 0.32 * f1);
      if (art) {
        const g = ctx.createLinearGradient(a.x - w / 2, 0, a.x + w / 2, 0);
        g.addColorStop(0, '#a9d4b4'); g.addColorStop(0.3, '#6aa88c'); g.addColorStop(0.75, '#3a7563'); g.addColorStop(1, '#1f4a3f');
        ctx.strokeStyle = g; ctx.lineWidth = w; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (n === cn.seg - 1) { // the tapered tip
          ctx.fillStyle = '#4e8f74';
          ctx.beginPath(); ctx.moveTo(b.x - w / 2, b.y); ctx.lineTo(b.x + w / 2, b.y); ctx.lineTo(b.x + cn.lean * 0.05, b.y - 7 * hf - 3); ctx.fill();
        }
      } else if (n === cn.seg - 1) light(b.x + cn.lean * 0.04, b.y - 4 * hf - 2, false); // (its growing tip)
      if (n === 0) continue;
      // The joint's ring at a: dark, its lit side dull green while it grows, pale mint once ripe.
      if (!art) { light(a.x - w * 0.15, a.y, ripe); continue; }
      ctx.fillStyle = '#183c33'; ctx.beginPath(); ctx.ellipse(a.x, a.y, w * 0.62, w * 0.24, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = ripe ? '#c6ffe8' : s === 2 ? '#8fcfb2' : '#7ea68c';
      ctx.beginPath(); ctx.ellipse(a.x - w * 0.18, a.y - 0.4, w * 0.36, w * 0.17, 0, 0, TAU); ctx.fill();
      if (ripe) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(a.x - w * 0.28, a.y - 0.6, 0.9, 0, TAU); ctx.fill(); }
      if ((n + cn.k) % 2 === 0) { // a leaf off this joint
        const side = (cn.k + n) % 4 < 2 ? -1 : 1, L = 16 + 10 * hf;
        reedLeaf(ctx, a.x, a.y, a.x + side * L, a.y + L * 0.3, 3.2, '#4c8a62', side < 0 ? '#8fbf86' : '#2f6a50');
      }
    }
  }
  return cv;
}

/**
 * The clump's shadows: a soft dark pool under it and each cane's (and stump's) shadow cast down-right, drawn small and
 * laid on enlarged so they come out soft (the same in every browser, with no canvas filter).
 */
function reedShadow(ctx, T, canes) {
  const W = ctx.canvas.width, q = 4, sc = document.createElement('canvas');
  sc.width = sc.height = Math.ceil(W / q);
  const x = sc.getContext('2d');
  x.setTransform(T[0] / q, 0, 0, T[0] / q, T[1] / q, T[2] / q);
  x.strokeStyle = '#1a1008'; x.lineCap = 'round';
  for (const c of canes) {
    const h = c.stump ? 10 : c.H;
    x.lineWidth = c.stump ? 6 : c.w;
    x.beginPath(); x.moveTo(c.x, c.y); x.lineTo(c.x + h * 0.42, c.y + h * 0.16); x.stroke();
  }
  // the pool under the clump
  const cx = 98, cy = 130, rx = 52, ry = 22, a = 0.42;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(26,16,8,${a})`); g.addColorStop(0.65, `rgba(26,16,8,${a * 0.5})`); g.addColorStop(1, 'rgba(26,16,8,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.28; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sc, 0, 0, sc.width * q, sc.height * q);
  ctx.restore();
}

/** A cut cane: a short stub with a pale cut face. */
function reedStump(ctx, x, y, w, h, body, face) {
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#83a28c'); g.addColorStop(0.5, body); g.addColorStop(1, '#2b4433');
  ctx.fillStyle = g; ctx.fillRect(x - w / 2, y - h, w, h);
  ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(x, y - h, w / 2, w * 0.28, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,30,0.5)'; ctx.lineWidth = 0.6; ctx.stroke();
}

/** A narrow leaf from (x, y) out to (ex, ey), bulging to one side. */
function reedLeaf(ctx, x, y, ex, ey, w, c1, c2) {
  const mx = (x + ex) / 2, my = (y + ey) / 2, dx = ex - x, dy = ey - y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const g = ctx.createLinearGradient(x, y, ex, ey); g.addColorStop(0, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x, y);
  ctx.quadraticCurveTo(mx + nx * w, my + ny * w - L * 0.12, ex, ey);
  ctx.quadraticCurveTo(mx - nx * w * 0.35, my - ny * w * 0.35 - L * 0.05, x, y); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,230,0.18)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3 - L * 0.1, ex, ey); ctx.stroke();
}

/** Is a Stalk on tile t drawn (its clump, or its light)? Under a road or track it shows faintly and gives no light. */
function reedUnder(t) { return !!(S.road[t] || (S.rail && S.rail[t])); }

/**
 * The Stalks of tiles i0..i1 × j0..j1 (row by row, back to front), drawn after the ground of the tiles round them; with
 * `glow`, their halos in the night glow map instead. A tile a Stalk stands on, or ever stood on, is noted (R.reedAt), so
 * a repaint near it redraws the tiles round it too (redrawAround).
 */
function drawStalks(ctx, i0, j0, i1, j1, glow) {
  if (!S.res) return;
  if (!R.reedAt || R.reedAt.length !== S.W * S.H) R.reedAt = new Uint8Array(S.W * S.H);
  const prev = R.drawScale;
  R.drawScale = ctx.hdScale || 1;
  R.inMap = true;
  try {
    for (let j = Math.max(0, j0); j <= Math.min(S.H - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(S.W - 1, i1); i++) {
      const t = j * S.W + i;
      if (S.res[t] !== R_STALK) continue;
      R.reedAt[t] = 1;
      const under = reedUnder(t);
      if (glow && under) continue;
      const P = reedVariant(i, j), x = (i + 0.5 + P.dx) * TP, y = (j + 0.5 + P.dy) * TP;
      const st = reedState(S.grow[t], S.amt[t]);
      if (glow) { drawArt(ctx, reedArt(P.v, st, 'glow'), x, y, TP); continue; }
      if (under) ctx.globalAlpha = 0.4;
      drawArt(ctx, reedArt(P.v, st, 'art'), x, y, TP);
      ctx.globalAlpha = 1;
      if (!under && richRes(t)) drawGlint(ctx, i * TP, j * TP, i, j);
    }
  } finally { R.inMap = false; R.drawScale = prev; }
}

/** Might a Stalk's clump reach tile (i, j) (one stands, or once stood, on it or a tile round it)? */
function reedNear(i, j) {
  const A = R.reedAt && R.reedAt.length === S.W * S.H ? R.reedAt : null;
  for (let b = Math.max(0, j - 1); b <= Math.min(S.H - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(S.W - 1, i + 1); a++) {
    const t = b * S.W + a;
    if (S.res[t] === R_STALK || (A && A[t])) return true;
  }
  return false;
}

/**
 * At dusk and night, zoomed in: each Stalk's rings lit, crisp, over the night glow map's soft halo (which is too coarse
 * at this zoom to show single rings). One cached sprite a clump in view, each pulsing a little on its own.
 */
function drawReedLights(ctx, ox, oy, z, v0, v1) {
  if (!R.glowMap || S.hollow) return;
  const n = Math.max(fxNight(), typeof duskWake === 'function' ? duskWake() : 0);
  const zf = clamp((z - REED.live[0]) / (REED.live[1] - REED.live[0]), 0, 1);
  if (n < 0.02 || zf <= 0 || (typeof gfxStep === 'function' && gfxStep() === 'saver')) return;
  const i0 = Math.max(0, Math.floor(v0.x) - 1), i1 = Math.min(S.W - 1, Math.ceil(v1.x) + 1);
  const j0 = Math.max(0, Math.floor(v0.y) - 1), j1 = Math.min(S.H - 1, Math.ceil(v1.y) + 2);
  const a0 = n * zf, T = S.time, s = z * REED.scale;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * S.W + i;
    if (S.res[t] !== R_STALK || reedUnder(t)) continue;
    const P = reedVariant(i, j), L = reedArt(P.v, reedState(S.grow[t], S.amt[t]), 'lights');
    if (L.empty) continue;
    // (the sprite's foot at the tile's middle, as drawArt places it, and only its trimmed part drawn)
    const x = ox + (i + 0.5 + P.dx) * z - REED.anchor[0] * s + L.fx * s, y = oy + (j + 0.5 + P.dy) * z - REED.anchor[1] * s + L.fy * s;
    ctx.globalAlpha = a0 * (0.82 + 0.18 * Math.sin(T * 1.1 + hash2(i, j, 5197) * 6.283));
    ctx.drawImage(artMip(L, L.fw * s * (R.drawScale || 1)), x, y, L.fw * s, L.fh * s);
  }
  ctx.restore();
}
