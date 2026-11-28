'use strict';
/*
 * Terrafall — Terraforming, stage 3: resources from the ground. The interface and the drawing; the rules are in
 * js/sim.js (the stage 3 block: t3SeamsMake, seamSurvey, updateSeamDrill, updateSeedMast, thermalHot) and the numbers
 * in SEAM, SEED and THERMAL (js/defs.js).
 *
 *  - Build → Terraform (key 6) holds them after stage 2's: the Seam Drill (I), the Seed Mast (G) and the Thermal Plant
 *    (T) (t3Cards), with what each would reach shown while placing (t3Ranges, t3PlaceText) and their panels (t3Panel).
 *  - A found seam (yours: the seams a drill of yours surveyed): glowing cracks in the ground, orange for Ore and violet
 *    for Crystal, inside a dashed outline, baked with the map (t3PaintTile) and glowing at night (t3Glow); its survey
 *    mark, the goods' icon with five pips for what's left, crossed out and grey once it's worked out (t3Marks), and a
 *    drill's dashed line to the seam it works.
 *  - The Crystal Seedbeds: a Seed Mast's rendered bed tile for its stage (renderer/b/seedbed.js: seedbed-<look>-<v>,
 *    prepared, seeded, sprouting, ripe, starved), baked with the map in place of the cluster's sprite, its pins and
 *    tips lit at night (seedbed-<look>-glow).
 *  - The minimap's colours for found seams and beds (t3MiniColor).
 * The look is the owner's picks from the stage 3 concept canvas (ART_GUIDE Batch 37). Looks only: nothing here changes
 * the simulation.
 */

const T3_TYPES = ['seamdrill', 'seedmast', 'thermal'];
/** The stage 3 buildings on the Terraform tab. */
function t3Types() { return T3_TYPES; }

/** Their cards on the Terraform tab, after stage 2's (openBuildMenu binds them as it does every building card). */
function t3Cards() {
  const have = playerGoods(ME), sites = siteCount(ME);
  return T3_TYPES.map((t) => {
    const ban = worldBan(t), k = BUILD_KEYS.terra[t];
    return `<button class="bcard${ban ? ' banned' : ''}" data-t="${t}" data-g="terra" ${sites >= MAX_SITES || ban ? 'disabled' : ''} title="${ban || BDEFS[t].name}">` +
      `<kbd data-tab="${BUILD_TAB_KEYS.terra}" data-key="${k.toUpperCase()}">${k.toUpperCase()}</kbd><img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div>` +
      `<div class="bcost">${costHTML(BDEFS[t].cost, have)}</div><div class="bhave">${ownedText(t)}</div></button>`;
  }).join('');
}

/** The seams of colony p found within r tiles of (i, j): [Ore, Crystal, worked out]. */
function t3SeamsNear(i, j, p, r) {
  const o = [0, 0, 0];
  for (const s of S.seams || []) {
    if (!seamFound(s, p) || seamDist(s, { x: i, y: j }) > r + 0.5) continue;
    if (s.n <= 0) o[2]++; else o[s.g === 'ore' ? 0 : 1]++;
  }
  return o;
}

/** What the placing banner says about a stage 3 building at (i, j). */
function t3PlaceText(type, i, j) {
  if (type === 'seamdrill') {
    const [o, c] = t3SeamsNear(i, j, ME, SEAM.survey[1]);
    return (o || c ? ` <span class="ok">Seams you've found in its reach: ${[o ? `${o} Ore` : '', c ? `${c} Crystal` : ''].filter(Boolean).join(', ')}.</span>` : ' It surveys for hidden seams the moment it stands.') +
      ` It needs power: a Generator with Fuel or a Thermal Plant within ${BDEFS.generator.burner.radius} tiles.`;
  }
  if (type === 'seedmast') {
    const b = { x: i, y: j, owner: ME }, R0 = SEED.reach, r2 = R0 * R0 + 0.3;
    let n = 0;
    for (let y = Math.max(0, j - R0); y <= Math.min(S.H - 1, j + R0); y++) for (let x = Math.max(0, i - R0); x <= Math.min(S.W - 1, i + R0); x++) if ((x !== i || y !== j) && dist2(x, y, i, j) <= r2 && bedSpotOk(b, tIdx(x, y))) n++;
    return (n ? ` <span class="ok">Room for ${Math.min(n, SEED.most)} bed${Math.min(n, SEED.most) === 1 ? '' : 's'}.</span>` : ' <span class="err">No open ground round it for beds.</span>') +
      ' It needs power, a Crystal a bed from Haulers, and a Crystal Tap in reach to gather the ripe Crystal.';
  }
  if (type === 'thermal') {
    const h = thermalHeat(tIdx(i, j));
    if (!h) return ' <span class="err">No heat here: it goes right beside lava, hot water or a steam vent.</span>';
    let n = 0;
    const r2 = THERMAL.radius * THERMAL.radius;
    for (const c of S.buildings) if (!c.dead && c.owner === ME && (BDEFS[c.type].work || BDEFS[c.type].t3pow) && dist2(c.x, c.y, i, j) <= r2) n++;
    return ` <span class="ok">Hot ground on ${h} side${h === 1 ? '' : 's'}: power with no Fuel.</span> ${n} building${n === 1 ? '' : 's'} in reach to power.`;
  }
  return '';
}

/** A stage 3 building's panel rows (buildingSheet). */
function t3Panel(b, mine) {
  const def = BDEFS[b.type], out = [];
  if (def.seamdrill) {
    const s = b.seam && S.seams ? S.seams[b.seam - 1] : null, [o, c, x] = t3SeamsNear(b.x, b.y, b.owner, b.svR || SEAM.survey[0]);
    out.push(`<div class="kv"><span>Survey</span><span>${b.svR || 0} of ${SEAM.survey[1]} tiles · ${o} Ore, ${c} Crystal seam${o + c === 1 ? '' : 's'} found${x ? `, ${x} worked out` : ''}</span></div>`);
    if (s) out.push(`<div class="kv"><span>Its seam</span><span>${GOOD[s.g].name}: ${s.n} of ${s.m} left, ${SEAM.rate[s.g]} a minute</span></div>`);
    if (mine) out.push(`<div class="section-label">Waiting for pickup</div><div class="goodlist">${['ore', 'crystal'].map((g) => goodTag(g, `${b.stock[g] || 0}/${SEAM.cap}`, !(b.stock[g] > 0))).join('')}</div>`);
    out.push(`<p class="hint">It surveys ${SEAM.survey[0]} tiles round it as it stands, and a tile further every ${SEAM.surveyEvery} s it has power, out to ${SEAM.survey[1]}. It drills the nearest seam it found, slowly: ${SEAM.rate.ore} Ore or ${SEAM.rate.crystal} Crystal a minute. A worked-out seam is spent for good. Power: a Generator with Fuel or a Thermal Plant within ${BDEFS.generator.burner.radius} tiles.</p>`);
  } else if (def.seedmast) {
    const n = [0, 0, 0, 0, 0];
    let starved = 0;
    for (const t of bedsOf(b)) { n[bedStage(t)]++; if (S.sbS && S.sbS[t]) starved++; }
    out.push(`<div class="kv"><span>Beds</span><span>${n[4]} ripe · ${n[3]} sprouting · ${n[2]} seeded · ${n[1]} prepared (up to ${SEED.most})</span></div>`);
    if (starved) out.push(`<div class="kv"><span>Starved</span><span class="err">${starved} bed${starved === 1 ? '' : 's'}: no power, not growing</span></div>`);
    if (mine) out.push(`<div class="section-label">Seed Crystal</div><div class="goodlist">${goodTag('crystal', `${b.stock.crystal || 0}/${SEED.hopper}`, !(b.stock.crystal > 0))}</div>`);
    out.push(`<p class="hint">A bed takes a Crystal to seed and about ${Math.round((SEED.ripe * SEED.step) / 60)} minutes of power to ripen into ${SEED.yield} Crystal, which a Crystal Tap within reach gathers; then it is seeded again. A ripe bed is Crystal on the ground like any other: a rival's Tap nearby gathers it too, so defend your beds. Without power the beds starve and stop. A growing field draws the Murmur.</p>`);
  } else if (def.burner && def.burner.heat) {
    out.push(`<div class="kv"><span>Heat</span><span>${thermalHot(b) ? `${thermalHeat(tIdx(b.x, b.y))} hot tile${thermalHeat(tIdx(b.x, b.y)) === 1 ? '' : 's'} beside it` : '<span class="err">cold: nothing hot beside it</span>'}</span></div>`);
    out.push(`<p class="hint">A Generator that burns no Fuel: factories within ${THERMAL.radius} tiles work a third faster while it runs, and it powers a Seam Drill, a Seed Mast, a Maglev Terminal or a Mass Driver (whose shots then cost no Fuel). It never powers a megastructure: those want a Generator's Fuel. It runs only while something in reach is working.</p>`);
  }
  return out;
}

/* ------------------------------------------------------------------ drawing */

/** Stage 3's colours: the seams' cracks (Ore orange, Crystal violet, spent grey), the accents, the minimap's. */
const T3_COL = { ore: [255, 138, 61], crystal: [176, 132, 255], spent: [128, 128, 128], drill: '#d94dff', mast: '#f78fc0', thermal: '#c9ef8f', bed: [74, 56, 92] };

/** The reach rings while a stage 3 building is placed or selected (drawRanges). True: drawn (nothing else to draw). */
function t3Ranges(ctx, type, x, y, ox, oy, z, owner) {
  const cx = ox + (x + 0.5) * z, cy = oy + (y + 0.5) * z, p = owner || 0;
  ctx.save();
  if (type === 'seamdrill') {
    const b = getE(S.bAt[tIdx(x, y)]), r = b && BDEFS[b.type].seamdrill && b.svR ? b.svR : SEAM.survey[0];
    ctx.fillStyle = 'rgba(217,77,255,0.07)'; ctx.strokeStyle = 'rgba(217,77,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, (r + 0.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([z * 0.2, z * 0.15]); ctx.strokeStyle = 'rgba(217,77,255,0.5)';
    ctx.beginPath(); ctx.arc(cx, cy, (SEAM.survey[1] + 0.5) * z, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,205,110,0.6)'; ctx.lineWidth = 1.5; // (where its power has to be)
    ctx.beginPath(); ctx.arc(cx, cy, (BDEFS.generator.burner.radius + 0.5) * z, 0, Math.PI * 2); ctx.stroke();
  } else if (type === 'seedmast') {
    ctx.fillStyle = 'rgba(247,143,192,0.08)'; ctx.strokeStyle = 'rgba(247,143,192,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, (SEED.reach + 0.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const b = { x, y, owner: p }, R0 = SEED.reach, r2 = R0 * R0 + 0.3;
    for (let j = Math.max(0, y - R0); j <= Math.min(S.H - 1, y + R0); j++) for (let i = Math.max(0, x - R0); i <= Math.min(S.W - 1, x + R0); i++) {
      const t = j * S.W + i;
      if ((i === x && j === y) || dist2(i, j, x, y) > r2) continue;
      if (t3Bed(t) || bedSpotOk(b, t)) { ctx.strokeStyle = t3Bed(t) ? 'rgba(247,180,214,0.95)' : 'rgba(247,143,192,0.6)'; ctx.lineWidth = Math.max(1, z * 0.03); ctx.strokeRect(ox + i * z + z * 0.15, oy + j * z + z * 0.15, z * 0.7, z * 0.7); }
    }
    ctx.strokeStyle = 'rgba(255,205,110,0.6)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, (BDEFS.generator.burner.radius + 0.5) * z, 0, Math.PI * 2); ctx.stroke();
  } else if (type === 'thermal') {
    // the hot tiles round it (lava, hot water, vents), then the usual power ring (drawRanges goes on)
    for (let j = y - 1; j <= y + 1; j++) for (let i = x - 1; i <= x + 1; i++) {
      if ((i === x && j === y) || !inMap(i, j) || !thermalHotTile(tIdx(i, j))) continue;
      ctx.fillStyle = 'rgba(255,120,40,0.3)'; ctx.fillRect(ox + i * z + 2, oy + j * z + 2, z - 4, z - 4);
    }
    ctx.restore();
    return false;
  }
  ctx.restore();
  return true;
}

/** The seam on tile t that colony `p` has found (or null): a lookup made again when the seams change. */
function t3SeamAt(t, p) {
  if (!S.seams) return null;
  const C = R.t3Seams;
  if (!C || C.of !== S.seams || C.n !== S.seams.length) { const m = new Map(); for (const s of S.seams) for (const u of s.t) m.set(u, s); R.t3Seams = { of: S.seams, n: S.seams.length, m }; }
  const s = R.t3Seams.m.get(t);
  return s && seamFound(s, p) ? s : null;
}

/** Seam tile (i, j)'s cracks: a few random walks in the tile (the same every time), in colour `col` at strength k. */
function t3Cracks(ctx, i, j, x, y, col, k, w) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, TP, TP); ctx.clip();
  ctx.strokeStyle = `rgba(${col.join(',')},${k})`; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let q = 0; q < 3; q++) {
    let px = x + hash2(i * 7 + q, j, 5101) * TP, py = y + hash2(i, j * 7 + q, 5103) * TP, a = hash2(i + q, j - q, 5105) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(px, py);
    for (let s = 0; s < 6; s++) { a += (hash2(i * 13 + s, j * 5 + q, 5107) - 0.5) * 1.6; px += Math.cos(a) * 6; py += Math.sin(a) * 4.5; ctx.lineTo(px, py); }
    ctx.stroke();
  }
  ctx.restore();
}

/** A seam's dashed outline on tile (i, j): along each edge whose neighbour isn't in the same seam. */
function t3Outline(ctx, s, i, j, x, y, col, a) {
  ctx.save();
  ctx.strokeStyle = `rgba(${col.join(',')},${a})`; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
  const inS = (di, dj) => inMap(i + di, j + dj) && s.t.includes(tIdx(i + di, j + dj));
  ctx.beginPath();
  if (!inS(0, -1)) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + TP - 1, y + 1); }
  if (!inS(0, 1)) { ctx.moveTo(x + 1, y + TP - 1); ctx.lineTo(x + TP - 1, y + TP - 1); }
  if (!inS(-1, 0)) { ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + 1, y + TP - 1); }
  if (!inS(1, 0)) { ctx.moveTo(x + TP - 1, y + 1); ctx.lineTo(x + TP - 1, y + TP - 1); }
  ctx.stroke();
  ctx.restore();
}

/** Which bed look tile t shows (0 prepared, 1 seeded, 2 sprouting, 3 ripe, 4 starved), or -1 for none. */
function t3BedLook(t) { const st = bedStage(t); return !st ? -1 : S.sbS && S.sbS[t] && st > 1 ? 4 : st - 1; }

/** A code-drawn bed (while its art loads): the dark raked bed, a 3 x 3 grid of pins, Crystal for its stage. */
function t3BedCode(ctx, x, y, look) {
  ctx.fillStyle = look === 4 ? '#4a4440' : '#2e2632'; ctx.fillRect(x + 2, y + 2, TP - 4, TP - 4);
  ctx.strokeStyle = 'rgba(110,116,122,0.8)'; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, TP - 5, TP - 5);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const px = x + 7 + a * 9, py = y + 8 + b * 9;
    if (look >= 2) { ctx.fillStyle = look === 4 ? '#8a8590' : '#6a50d8'; const h = look === 2 ? 3 : 6; ctx.beginPath(); ctx.moveTo(px - 2, py); ctx.lineTo(px, py - h); ctx.lineTo(px + 2, py); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = look === 4 ? '#3a3d44' : '#f78fc0'; ctx.fillRect(px + 2, py - 1, 1.5, 1.5);
  }
}

/**
 * Tile (i, j)'s stage 3 ground, baked with the map (paintTile): a found seam's cracks inside its dashed outline (yours:
 * the seams your drills surveyed), and a Crystal Seedbed in place of everything else on the tile (its Crystal too: a
 * ripe bed's cluster is drawn as the bed's grown Crystal). True when the tile is a bed (paintTile draws nothing more).
 */
function t3PaintTile(ctx, i, j, x, y, t) {
  const s = t3SeamAt(t, ME);
  if (s) {
    const spent = s.n <= 0, col = spent ? T3_COL.spent : T3_COL[s.g];
    ctx.fillStyle = 'rgba(20,12,10,0.12)'; ctx.fillRect(x, y, TP, TP); // (the seam showing through: the ground a touch darker)
    if (!spent) t3Cracks(ctx, i, j, x, y, col, 0.35 + 0.45 * (s.n / s.m), 1.4);
    t3Outline(ctx, s, i, j, x, y, col, spent ? 0.55 : 0.9);
  }
  const look = S.sbed ? t3BedLook(t) : -1;
  if (look < 0) return false;
  const art = ART[`seedbed-${look}-${1 + Math.floor(hash2(i, j, 4471) * 3)}`];
  if (art) drawArt(ctx, art, x + TP / 2, y + TP / 2, TP * 1.25); else t3BedCode(ctx, x, y, look);
  return true;
}

/** Tile (i, j)'s night glow (glowTiles): a found seam's cracks, and a bed's lit pins and Crystal tips. */
function t3Glow(ctx, i, j, t) {
  const x = i * TP, y = j * TP, s = t3SeamAt(t, ME);
  if (s && s.n > 0) t3Cracks(ctx, i, j, x, y, T3_COL[s.g], 0.5 + 0.5 * (s.n / s.m), 2.4);
  const look = S.sbed ? t3BedLook(t) : -1;
  if (look < 0 || look === 4) return;
  const g = ART[`seedbed-${look}-glow`];
  if (g) drawArt(ctx, g, x + TP / 2, y + TP / 2, TP * 1.25);
  else { const gr = ctx.createRadialGradient(x + TP / 2, y + TP / 2, 1, x + TP / 2, y + TP / 2, TP * 0.6); gr.addColorStop(0, `rgba(190,150,255,${0.25 + 0.15 * look})`); gr.addColorStop(1, 'rgba(160,110,255,0)'); ctx.fillStyle = gr; ctx.fillRect(x - 4, y - 4, TP + 8, TP + 8); }
}

/**
 * Over the ground, after the night's grade (render): each seam you've found, its survey mark at its middle (the goods'
 * icon in a ring, five pips under it for what's left; grey and crossed out once it's worked out), and your Seam Drills'
 * dashed lines to the seams they work.
 */
function t3Marks(ctx, ox, oy, z, v0, v1) {
  if (!S.seams || z < 9) return;
  ctx.save();
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.owner !== ME || !BDEFS[b.type].seamdrill || !b.seam) continue;
    const s = S.seams[b.seam - 1];
    if (!s || s.n <= 0) continue;
    ctx.strokeStyle = 'rgba(217,77,255,0.8)'; ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.setLineDash([z * 0.2, z * 0.16]); ctx.lineDashOffset = -R.time * z * 0.4;
    ctx.beginPath(); ctx.moveTo(ox + (b.x + 0.5) * z, oy + (b.y + 0.5) * z); ctx.lineTo(ox + (s.x + 0.5) * z, oy + (s.y + 0.5) * z); ctx.stroke();
  }
  ctx.setLineDash([]);
  for (const s of S.seams) {
    if (!seamFound(s, ME) || s.x < v0.x - 2 || s.x > v1.x + 2 || s.y < v0.y - 2 || s.y > v1.y + 2) continue;
    const spent = s.n <= 0, col = spent ? 'rgb(128,128,128)' : `rgb(${T3_COL[s.g].join(',')})`;
    const x = ox + (s.x + 0.5) * z, y = oy + (s.y + 0.5) * z, r = Math.max(6, z * 0.3);
    ctx.fillStyle = 'rgba(10,12,18,0.8)'; ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, z * 0.06);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const ic = ART[s.g];
    if (ic) { ctx.globalAlpha = spent ? 0.45 : 1; if (spent) ctx.filter = 'grayscale(1)'; drawArt(ctx, ic, x, y, r * 1.6); ctx.filter = 'none'; ctx.globalAlpha = 1; }
    if (spent) {
      ctx.strokeStyle = 'rgba(210,210,210,0.95)'; ctx.lineWidth = Math.max(1.5, z * 0.07);
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y + r * 0.6); ctx.moveTo(x - r * 0.6, y + r * 0.6); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.stroke();
    }
    if (z < 16) continue;
    const pips = seamPips(s), pw = Math.max(3, z * 0.12), gap = pw * 1.45;
    for (let k = 0; k < 5; k++) {
      const px = x - 2 * gap + k * gap - pw / 2, py = y + r + pw * 0.6;
      ctx.fillStyle = k < pips ? col : 'rgba(40,44,52,0.9)'; ctx.fillRect(px, py, pw, pw * 0.85);
      ctx.strokeStyle = 'rgba(10,12,18,1)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, pw * 0.85);
    }
  }
  ctx.restore();
}

/** The minimap's colour of ground tile t with stage 3 on it: a found seam its goods' colour, a bed dark violet. */
function t3MiniColor(t, c) {
  if (S.sbed && S.sbed[t]) return mixBiomeRGB(c, T3_COL.bed, 0.7);
  const s = t3SeamAt(t, ME);
  if (s) return mixBiomeRGB(c, s.n > 0 ? T3_COL[s.g] : T3_COL.spent, 0.5);
  return c;
}
