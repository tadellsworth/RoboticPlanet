'use strict';
/*
 * Half underground's cave mouths (cavesMap in js/world.js; ART_GUIDE.md, Batch 41): the gaps in the solid wall between the
 * surface and the caves drawn as real entrances, the owner's pick of the three concepts (the natural rock arch).
 * Looks only: where the mouths are and what can pass is cavesMap's, untouched.
 *
 * The art (renderer/b/cavemouth.js, art/biomes/hollow/mouth-*.webp) is one wall section, rendered in the terrain's own
 * projection (straight down, 64 px a tile, heights shifted up the screen as on a building), for each way the map can
 * face: `s` with the surface south of the wall (the caves north), `n` with the surface north. Its frame is 30 x 10 tiles,
 * the line where the roof begins across its middle, the left cheek's inner face 7 tiles left of the middle and the
 * right's 7 right. A mouth `w` tiles wide is drawn as the strip's left part up to w/2 tiles past the left cheek and its
 * right part from w/2 tiles before the right cheek, closed up, with the keystone over the join.
 *   floor    flat on the ground (scree, the shadows): drawn with the ground, before its time-of-day grade
 *   rock     the cheeks: the wall rising either side; after the grade, under the robots
 *   lip      the roof's edge across the gap: over the robots, which pass under it
 *   key      the keystone over the join (the rock lobe and its Bloom knot)
 *   glow     light to add after dark: the Bloom knots (the key's own, keyglow)
 * The rock is always in the caves' light (CAVE_LIGHT), as the wall is: graded copies are made once, when the art comes in.
 * Code adds the throat (the dark under the roof, into the caves) and the light that spills through: daylight in onto the
 * caves' floor by day, the caves' violet glow out onto the surface at night (not on Graphics Saver).
 */

/** Where each layer's cropped picture sits in the 30 x 10 tile frame (px at 64 a tile): renderer/tools/install_mouths.py. */
const MOUTH_ART = {"floor-s": [30, 127], "rock-s": [54, 106], "lip-s": [450, 102], "key-s": [84, 68], "glow-s": [505, 132], "keyglow-s": [94, 119], "floor-n": [30, 162], "rock-n": [54, 170], "lip-n": [450, 245], "key-n": [84, 7], "glow-n": [504, 301], "keyglow-n": [104, 58]};
const MOUTH = { ppt: 64, w: 30, h: 10, half: 7, key: 4 };

/** The mouths of this map, worked out once: { face, line, L, R (the gap's first and last column), w, x (its middle) }. */
function cavesMouths() {
  if (!S || !S.caves || !S.cave) return [];
  if (R.mouthsOf === S.caves) return R.mouths;
  const face = S.caves.south ? 'n' : 's', W = S.W, out = [];
  for (const e of S.caves.entrances || []) {
    // the gap's columns: open (not wall) in the mouth's row, out from its middle
    const open = (i) => i >= 0 && i < W && S.cave[e.y * W + i] !== 2;
    if (!open(e.x)) continue;
    let L = e.x, R2 = e.x;
    while (open(L - 1) && L > e.x - e.hw - 2) L--;
    while (open(R2 + 1) && R2 < e.x + e.hw + 2) R2++;
    // the line where the roof begins: below the mouth's row with the caves north (it is the caves' last row), above it with them south
    // Each column's own line (where the caves give way to the surface: the wall's middle wanders a row or two across a
    // wide mouth). The mouth's line is the one furthest out toward the surface: the roof's edge stands there, and where a
    // column's surface ground runs on in under it, that ground is in the throat's shadow (steps).
    const lines = [];
    for (let i = L; i <= R2; i++) {
      let j = e.y - 4;
      if (face === 's') { while (j < e.y + 4 && S.cave[j * W + i] !== 0) j++; } else { while (j < e.y + 4 && S.cave[j * W + i] !== 1) j++; }
      lines.push([i, j]);
    }
    const line = face === 's' ? Math.max(...lines.map((l) => l[1])) : Math.min(...lines.map((l) => l[1]));
    const steps = lines.filter((l) => l[1] !== line);
    out.push({ face, line, L, R: R2, w: R2 + 1 - L, x: (L + R2 + 1) / 2, steps });
  }
  R.mouthsOf = S.caves; R.mouths = out;
  return out;
}

/** A layer's art for this map's face, with its crop: { img, x0, y0 } (px of the frame), or null while it loads. */
function mouthArt(layer, face, graded) {
  const art = ART[`mouth-${layer}-${face}-hollow`], at = MOUTH_ART[`${layer}-${face}`];
  if (!art || !at) return null;
  if (!graded) return { img: art.img, x0: at[0], y0: at[1] };
  // (in the caves' light, made once: the picture multiplied, its own alpha kept)
  if (!art.caveLit) {
    const c = document.createElement('canvas'); c.width = art.img.width; c.height = art.img.height;
    const g = c.getContext('2d'), m = CAVE_LIGHT.mul;
    g.drawImage(art.img, 0, 0);
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgb(${Math.round(m[0] * 255)},${Math.round(m[1] * 255)},${Math.round(m[2] * 255)})`; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(art.img, 0, 0);
    art.caveLit = c;
  }
  return { img: art.caveLit, x0: at[0], y0: at[1] };
}

/**
 * Draw one layer of every mouth in view: the strip's two parts closed up to each gap. (sx: tiles from the frame's left
 * edge; the left part runs from 0 to the left cheek's face + w/2, the right part from the right cheek's face - w/2 to 30.)
 */
function mouthLayer(ctx, ox, oy, z, layer, graded) {
  const ms = cavesMouths();
  if (!ms.length) return;
  const A = mouthArt(layer, ms[0].face, graded);
  if (!A) return;
  const P = MOUTH.ppt, cxL = MOUTH.w / 2 - MOUTH.half, cxR = MOUTH.w / 2 + MOUTH.half, top = -MOUTH.h / 2, iw = A.img.width / P, ih = A.img.height / P;
  const ax = A.x0 / P, ay = A.y0 / P;
  for (const m of ms) {
    const y0 = oy + (m.line + top) * z;
    if (y0 > R.h || y0 + MOUTH.h * z < 0) continue;
    // [frame x from, frame x to, map x of the frame's left edge]
    for (const [f0, f1, mx] of [[0, cxL + m.w / 2, m.L - cxL], [cxR - m.w / 2, MOUTH.w, m.R + 1 - cxR]]) {
      // the part of the cropped picture within f0..f1
      const s0 = Math.max(f0, ax), s1 = Math.min(f1, ax + iw);
      if (s1 <= s0) continue;
      const dx = ox + (mx + s0) * z;
      if (dx > R.w || dx + (s1 - s0) * z < 0) continue;
      ctx.drawImage(A.img, (s0 - ax) * P, 0, (s1 - s0) * P, A.img.height, dx, y0 + ay * z, (s1 - s0) * z, ih * z);
    }
  }
}

/** The keystone over each mouth's join (and its glow, `glow`). */
function mouthKeys(ctx, ox, oy, z, glow) {
  const ms = cavesMouths();
  if (!ms.length) return;
  const A = mouthArt(glow ? 'keyglow' : 'key', ms[0].face, !glow);
  if (!A) return;
  const k = MOUTH.key, sg = ms[0].face === 's' ? 1 : -1, P = MOUTH.ppt;
  for (const m of ms) {
    // (its frame: 4 x 4 tiles, centred on the join, 0.75 tile into the caves from the line)
    const x = ox + (m.x - k / 2) * z + (A.x0 / P) * z, y = oy + (m.line - 0.75 * sg - k / 2) * z + (A.y0 / P) * z;
    if (x > R.w || y > R.h || x + k * z < 0 || y + k * z < 0) continue;
    ctx.drawImage(A.img, x, y, (A.img.width / P) * z, (A.img.height / P) * z);
  }
}

/** With the ground, before its grade: what lies flat (scree, the cheeks' and the roof's shadows). */
function mouthsFloor(ctx, ox, oy, z) { if (S.caves) mouthLayer(ctx, ox, oy, z, 'floor', false); }

/**
 * After the ground's grade, under the robots: the throat (dark under the roof, into the caves), the light spilling
 * through the gap (daylight in, the caves' glow out after dark), then the cheeks.
 */
function mouthsUnder(ctx, ox, oy, z) {
  const ms = S.caves && cavesMouths();
  if (!ms || !ms.length) return;
  const st = TOD.state || {}, lights = TOD.active ? st.lights || 0 : 0, day = 1 - Math.min(1, lights * 1.2), rich = gfx().night > 0;
  for (const m of ms) {
    const sg = m.face === 's' ? 1 : -1, x0 = ox + m.L * z, x1 = ox + (m.R + 1) * z, yl = oy + m.line * z;
    if (x0 > R.w || x1 < 0 || yl < -6 * z || yl > R.h + 6 * z) continue;
    // the throat: the floor under the roof and a little beyond, in shadow
    const yIn = yl - sg * 3.2 * z, g = ctx.createLinearGradient(0, yl + sg * 0.15 * z, 0, yIn);
    g.addColorStop(0, 'rgba(6,4,12,0)'); g.addColorStop(0.12, 'rgba(6,4,12,0.62)'); g.addColorStop(0.5, 'rgba(6,4,12,0.4)'); g.addColorStop(1, 'rgba(6,4,12,0)');
    ctx.fillStyle = g; ctx.fillRect(x0, Math.min(yl, yIn), x1 - x0, Math.abs(yIn - yl) + 0.15 * z);
    // (a column whose surface ground runs on in under the roof, past the mouth's line: in the throat's shadow too)
    ctx.fillStyle = 'rgba(6,4,12,0.62)';
    for (const [i, j] of m.steps) if ((j - m.line) * sg < 0) ctx.fillRect(ox + i * z, oy + Math.min(j, m.line) * z, z, Math.abs(m.line - j) * z);
    if (!rich) continue;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    // daylight through the mouth onto the caves' floor, past the throat: warm, fading in
    if (day > 0.02) {
      const cy = yl - sg * 2.6 * z, r = Math.max(1.2, m.w * 0.42) * z;
      const d = ctx.createRadialGradient(m.x * z + ox, cy, 0.1 * z, m.x * z + ox, cy, r * 1.2);
      d.addColorStop(0, `rgba(255,214,150,${0.05 * day})`); d.addColorStop(0.6, `rgba(255,200,130,${0.025 * day})`); d.addColorStop(1, 'rgba(255,190,120,0)');
      ctx.fillStyle = d; ctx.beginPath(); ctx.ellipse(m.x * z + ox, cy, r * 1.2, 1.3 * z, 0, 0, Math.PI * 2); ctx.fill();
    }
    // after dark the caves are the lighter side: their violet glow breathes out onto the surface
    if (lights > 0.05) {
      const cy = yl + sg * 1.0 * z, r = Math.max(1.4, m.w * 0.45) * z, k = lights * (0.85 + 0.15 * Math.sin(R.time * 0.7 + m.x));
      const v = ctx.createRadialGradient(m.x * z + ox, cy, 0.1 * z, m.x * z + ox, cy, r * 1.3);
      v.addColorStop(0, `rgba(150,110,255,${0.12 * k})`); v.addColorStop(0.55, `rgba(120,90,230,${0.045 * k})`); v.addColorStop(1, 'rgba(110,80,220,0)');
      ctx.fillStyle = v; ctx.beginPath(); ctx.ellipse(m.x * z + ox, cy, r * 1.3, 1.6 * z, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  mouthLayer(ctx, ox, oy, z, 'rock', true);
}

/** Over the robots: the roof's edge they pass under, the keystone, and after dark the light the mouth gives. */
function mouthsOver(ctx, ox, oy, z) {
  if (!S.caves || !cavesMouths().length) return;
  mouthLayer(ctx, ox, oy, z, 'lip', true);
  mouthKeys(ctx, ox, oy, z, false);
  // (the Bloom knots glow always a little, the caves being always dark; full at night)
  const st = TOD.state || {}, k = 0.45 + 0.55 * (TOD.active ? st.lights || 0 : 0);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = k;
  mouthLayer(ctx, ox, oy, z, 'glow', false);
  mouthKeys(ctx, ox, oy, z, true);
  ctx.restore();
}

/** On the minimap: each mouth a small bright notch across the wall, so the ways through show at a glance. */
function mouthsMinimap(g, sx, sy) {
  for (const m of cavesMouths()) {
    const x = m.L * sx, y = m.line * sy, w = m.w * sx;
    g.fillStyle = 'rgba(14,10,24,0.85)'; g.fillRect(x - 1, y - 2.5, w + 2, 5);
    g.fillStyle = '#c7b3ff'; g.fillRect(x, y - 1.5, w, 3);
  }
}
