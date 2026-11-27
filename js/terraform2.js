'use strict';
/*
 * Terrafall — Terraforming, stage 2: soil, plants and water. The interface and the drawing; the rules are in js/sim.js
 * (the stage 2 block: updateComposter, the Nursery's Agribot in doStaff, t2Groves, t2Water, t2Shift, groveSlow,
 * groveBurn, t2Earthwork) and the numbers in SOIL, GROVE, IRR and SHIFT (js/defs.js).
 *
 *  - Build → Terraform (key 6) holds the stage 2 buildings beside the Grader's tools: the Composter (M), the Tree
 *    Nursery (N) and the Water Pump (P) (t2Cards), with their reach shown while placing (t2Ranges) and their panels
 *    (t2Panel). The Grader's Spread soil (O) and Reclaim (E) are tools in js/terraform.js.
 *  - The ground, baked with the map (t2PaintTile): humus darkening barren ground as it enriches, wet ground turning
 *    green, and the biome shift blending the next biome's ground in over the old (biomeMixAt's look: the two biomes'
 *    textures blended through noise), its scenery taking root (drawPlant, t2ArtBiome).
 *  - The groves (rendered: renderer/b/grove.js, 1-tile variants at three stages) and the sprinklers at the pipes' ends
 *    with their spray, drawn with the ground and graded with it (t2Ground); leaves swirling round a robot slowed in a
 *    foe's grove (t2SlowTell); the minimap's colours for groves, irrigated and shifted land (t2MiniColor).
 * The look is the owner's picks from the stage 2 concept canvas (ART_GUIDE Batch 36). Looks only: nothing here changes
 * the simulation.
 */

const T2_TYPES = ['composter', 'nursery', 'wpump'];
/** The stage 2 buildings on the Terraform tab. */
function t2Types() { return T2_TYPES; }

/** Their cards on the Terraform tab (openBuildMenu binds them as it does every building card). */
function t2Cards() {
  const have = playerGoods(ME), sites = siteCount(ME);
  return T2_TYPES.map((t) => {
    const ban = worldBan(t), k = BUILD_KEYS.terra[t];
    return `<button class="bcard${ban ? ' banned' : ''}" data-t="${t}" data-g="terra" ${sites >= MAX_SITES || ban ? 'disabled' : ''} title="${ban || BDEFS[t].name}">` +
      `<kbd data-tab="${BUILD_TAB_KEYS.terra}" data-key="${k.toUpperCase()}">${k.toUpperCase()}</kbd><img src="${iconFor(t)}" alt=""><div class="bname">${BDEFS[t].name}</div>` +
      `<div class="bcost">${costHTML(BDEFS[t].cost, have)}</div><div class="bhave">${ownedText(t)}</div></button>`;
  }).join('');
}

/** Open tiles in reach of a Composter at (i, j), and how many are rich already. */
function t2SoilCount(i, j, owner) { return typeof soilInReach === 'function' ? soilInReach({ x: i, y: j, owner }) : [0, 0]; }
/** Open ground a Tree Nursery at (i, j) could plant. */
function t2GroveRoom(i, j, owner) {
  const b = { x: i, y: j, owner }, R0 = GROVE.reach, r2 = R0 * R0 + 0.3;
  let n = 0;
  for (let y = Math.max(0, j - R0); y <= Math.min(S.H - 1, j + R0); y++) for (let x = Math.max(0, i - R0); x <= Math.min(S.W - 1, i + R0); x++) if ((x !== i || y !== j) && dist2(x, y, i, j) <= r2 && groveSpotOk(b, y * S.W + x)) n++;
  return Math.min(n, GROVE.most);
}
/** The pipe networks of yours a Water Pump at (i, j) would join. */
function t2PipesAt(i, j) {
  let n = 0;
  for (const u of tfSides(tIdx(i, j))) if (S.pipe && S.pipe[u] === ME + 1) n++;
  return n;
}

/** What the placing banner says about a stage 2 building at (i, j). */
function t2PlaceText(type, i, j) {
  if (type === 'composter') {
    const [n, rich] = t2SoilCount(i, j, ME);
    return ` <span class="ok">${n} open tiles in reach to enrich${rich ? ` (${rich} rich already)` : ''}.</span> Haulers bring it a Fiber and a Stone a batch.`;
  }
  if (type === 'nursery') { const n = t2GroveRoom(i, j, ME); return n ? ` <span class="ok">Room for ${n} grove${n === 1 ? '' : 's'}, with lanes left open.</span>` : ' <span class="err">No open ground in reach to plant.</span>'; }
  if (type === 'wpump') {
    const p = t2PipesAt(i, j);
    return p ? ' <span class="ok">It joins your pipe: the water goes along it, and a sprinkler waters round its end.</span>' : ' It waters round itself. Join pipe to it (Paths → Pipe) or dig a canal from its water to send the water further.';
  }
  return '';
}

/** A stage 2 building's panel rows (buildingSheet). */
function t2Panel(b, mine) {
  const def = BDEFS[b.type], out = [];
  if (def.compost) {
    const [n, rich] = soilInReach(b);
    let imp = 0;
    const r2 = SOIL.reach * SOIL.reach + 0.3;
    for (let j = Math.max(0, b.y - SOIL.reach); j <= Math.min(S.H - 1, b.y + SOIL.reach); j++) for (let i = Math.max(0, b.x - SOIL.reach); i <= Math.min(S.W - 1, b.x + SOIL.reach); i++) {
      const t = j * S.W + i;
      if (dist2(i, j, b.x, b.y) <= r2 && soilOpen(t, b.owner) && soilLv(t) === 1) imp++;
    }
    out.push(`<div class="kv"><span>Soil in reach</span><span>${rich} rich · ${imp} improving · ${n - rich - imp} barren</span></div>`);
    out.push(`<div class="kv"><span>A batch</span><span>1 Fiber + 1 Stone, every ${SOIL.every} s · ${b.batches || 0} so far</span></div>`);
    if (mine) out.push(`<div class="section-label">Hopper</div><div class="goodlist">${Object.keys(SOIL.batch).map((g) => goodTag(g, `${b.stock[g] || 0}/${SOIL.hopper}`, !(b.stock[g] > 0))).join('')}</div>`);
    out.push('<p class="hint">Rich soil is farmland: Bio Farms plant on it, and crops on richer soil grow faster and give more Fuel. Groves, water and rich soil together slowly change the land itself.</p>');
  } else if (def.nursery) {
    const st = [0, 0, 0, 0], R0 = GROVE.reach, r2 = R0 * R0 + 0.3;
    let ripe = 0;
    if (S.grove) for (let j = Math.max(0, b.y - R0); j <= Math.min(S.H - 1, b.y + R0); j++) for (let i = Math.max(0, b.x - R0); i <= Math.min(S.W - 1, b.x + R0); i++) {
      const t = j * S.W + i;
      if (!S.grove[t] || groveOwner(t) !== b.owner || dist2(i, j, b.x, b.y) > r2) continue;
      st[groveStage(t)]++;
      if (groveStage(t) === 3 && S.grvF[t] >= GROVE.fiberEvery) ripe++;
    }
    out.push(`<div class="kv"><span>Groves</span><span>${st[1]} saplings · ${st[2]} young · ${st[3]} mature (up to ${GROVE.most})</span></div>`);
    if (st[3]) out.push(`<div class="kv"><span>Fiber ready to gather</span><span>${ripe} grove${ripe === 1 ? '' : 's'}</span></div>`);
    if (mine) out.push(`<div class="kv"><span>Waiting for pickup</span><span>${goodTag('fiber', `${b.stock.fiber || 0}/${def.out.fiber}`)}</span></div>`);
    out.push(`<p class="hint">Saplings grow young in ${Math.round(GROVE.young * GROVE.step / 60 * 10) / 10} minutes and mature in ${Math.round(GROVE.mature * GROVE.step / 60)}; a mature grove bears a Fiber every ${Math.round(GROVE.fiberEvery * GROVE.step)} s. Enemy robots crawl through your groves. They burn, and Reclaim (Build → Terraform) clears burned ground for planting again.</p>`);
  } else if (def.wpump) {
    out.push(`<div class="kv"><span>Water reaches</span><span>${b.wpN ? `${b.wpN} tile${b.wpN === 1 ? '' : 's'} of pipe and canal` : 'round itself only'} (up to ${IRR.reach})</span></div>`);
    out.push('<p class="hint">Wet ground turns green: Bio Farms plant crops on it even in desert, and they grow faster. Pipe joined to the pump carries the water (Paths → Pipe), a sprinkler waters round each open end, and a canal the Grader digs from its water (Dig channel) carries it too.</p>');
  }
  return out;
}

/* ------------------------------------------------------------------ drawing */

/** The soil, water and shift colours (RGB): humus, wet green, and the minimap's groves and irrigated land. */
const T2_COL = { humus: [52, 34, 20], wet: [84, 156, 62], grove: [38, 92, 40], irrigated: [92, 156, 76] };

/** The reach rings while a stage 2 building is placed or selected (drawRanges). */
function t2Ranges(ctx, type, x, y, ox, oy, z, owner) {
  const cx = ox + (x + 0.5) * z, cy = oy + (y + 0.5) * z;
  ctx.save();
  if (type === 'composter') {
    ctx.fillStyle = 'rgba(214,160,74,0.08)'; ctx.strokeStyle = 'rgba(214,160,74,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, (SOIL.reach + 0.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // each tile it enriches, by how rich it is already: open (barren), half (improving), full (rich)
    const r2 = SOIL.reach * SOIL.reach + 0.3;
    for (let j = Math.max(0, y - SOIL.reach); j <= Math.min(S.H - 1, y + SOIL.reach); j++) for (let i = Math.max(0, x - SOIL.reach); i <= Math.min(S.W - 1, x + SOIL.reach); i++) {
      const t = j * S.W + i;
      if (dist2(i, j, x, y) > r2 || !soilOpen(t, owner || 0)) continue;
      const lv = soilLv(t), px = ox + (i + 0.5) * z, py = oy + (j + 0.5) * z, r = z * 0.16;
      ctx.strokeStyle = 'rgba(232,190,120,0.85)'; ctx.lineWidth = Math.max(1, z * 0.03);
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
      if (lv) { ctx.fillStyle = 'rgba(120,78,40,0.95)'; ctx.beginPath(); lv === 2 ? ctx.arc(px, py, r, 0, Math.PI * 2) : ctx.arc(px, py, r, Math.PI / 2, Math.PI * 1.5); ctx.fill(); }
    }
  } else if (type === 'nursery') {
    ctx.fillStyle = 'rgba(140,255,106,0.07)'; ctx.strokeStyle = 'rgba(140,255,106,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, (GROVE.reach + 0.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // where it would plant (a sapling dot) and its lanes (left open)
    const b = { x, y, owner: owner || 0 }, R0 = GROVE.reach, r2 = R0 * R0 + 0.3;
    for (let j = Math.max(0, y - R0); j <= Math.min(S.H - 1, y + R0); j++) for (let i = Math.max(0, x - R0); i <= Math.min(S.W - 1, x + R0); i++) {
      const t = j * S.W + i;
      if (dist2(i, j, x, y) > r2 || (i === x && j === y)) continue;
      const px = ox + (i + 0.5) * z, py = oy + (j + 0.5) * z;
      if (S.grove && S.grove[t]) { ctx.strokeStyle = 'rgba(200,255,170,0.9)'; ctx.lineWidth = Math.max(1, z * 0.03); ctx.beginPath(); ctx.arc(px, py, z * 0.3, 0, Math.PI * 2); ctx.stroke(); }
      else if (groveSpotOk(b, t)) { ctx.fillStyle = 'rgba(120,220,90,0.8)'; ctx.beginPath(); ctx.arc(px, py, z * 0.1, 0, Math.PI * 2); ctx.fill(); }
    }
  } else if (type === 'wpump') {
    ctx.fillStyle = 'rgba(58,160,255,0.08)'; ctx.strokeStyle = 'rgba(110,190,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, (IRR.spray + 0.5) * z, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // the ground its water reaches now (a built pump's), and the pipe it would send it along
    if (S.wet) {
      ctx.fillStyle = 'rgba(110,200,140,0.22)';
      const R0 = 14;
      for (let j = Math.max(0, y - R0); j <= Math.min(S.H - 1, y + R0); j++) for (let i = Math.max(0, x - R0); i <= Math.min(S.W - 1, x + R0); i++) if (S.wet[j * S.W + i]) ctx.fillRect(ox + i * z + z * 0.1, oy + j * z + z * 0.1, z * 0.8, z * 0.8);
    }
    ctx.strokeStyle = 'rgba(110,190,255,0.8)'; ctx.lineWidth = Math.max(1.5, z * 0.05); ctx.setLineDash([z * 0.15, z * 0.1]);
    for (const u of tfSides(tIdx(x, y))) if (S.pipe && S.pipe[u] === (owner || 0) + 1) ctx.strokeRect(ox + (u % S.W) * z + z * 0.12, oy + ((u / S.W) | 0) * z + z * 0.12, z * 0.76, z * 0.76);
    ctx.setLineDash([]);
  }
  ctx.restore();
}

/** Biome key's region (its textures and look), kept; made again until its art has come in. */
function t2Region(key) {
  const C = R.t2Reg || (R.t2Reg = {});
  if (C[key] && C[key].tex.ground) return C[key];
  return (C[key] = biomeRegion(key));
}
/** The biome whose scenery grows on shifted tile t (its art asked for), or null. */
function t2ArtBiome(t) {
  const k = typeof t2TileBiome === 'function' ? t2TileBiome(t) : null;
  if (!k) return null;
  const b = artBiome(k);
  ensureBiomeArt(b);
  return ART[`plant-${b}-1`] ? b : null;
}

/**
 * Tile (i, j)'s stage 2 ground, baked with the map (paintTile): the biome shift's new ground blended in through noise
 * (biomeMixAt's look), humus darkening the ground as it enriches (farmland, once rich, is drawn as fertile soil), and
 * wet ground greening, a darker damp edge where it meets the dry.
 */
function t2PaintTile(ctx, i, j, x, y, t) {
  const sh = S.shift ? S.shift[t] : 0, tf = S.tform ? S.tform[t] : 0;
  if (sh || tf > SHIFT.full * 0.12) {
    const chain = SHIFT.chain[t2BaseBiome(t)] || [], lvl = sh + tf / SHIFT.full, n = fbm(i / 4, j / 4, 4242, 2);
    for (let k = 0; k < chain.length && k < Math.ceil(lvl); k++) {
      const a = clamp(lvl - k, 0, 1), w = a >= 1 ? 1 : clamp(a * 1.6 - 0.35 + (n - 0.5) * 0.7, 0, 1);
      if (w <= 0) continue;
      const reg = t2Region(chain[k]);
      if (reg.tex.ground) blendTexture(ctx, reg.tex.ground, w, i, j, x, y);
      else { ctx.fillStyle = `rgba(${reg.mm.ground.join(',')},${0.7 * w})`; ctx.fillRect(x, y, TP, TP); }
    }
  }
  const v = S.soil ? S.soil[t] : 0;
  if (v && !S.fert[t]) {
    const k = Math.min(1, v / SOIL.rich), [r, g, b] = T2_COL.humus;
    ctx.fillStyle = `rgba(${r},${g},${b},${0.1 + 0.32 * k})`; ctx.fillRect(x, y, TP, TP);
    // crumbs of humus, more of them as it enriches
    const n = 3 + Math.floor(9 * k);
    for (let q = 0; q < n; q++) {
      const h = hash2(i * 31 + q, j * 17 - q, 77);
      ctx.fillStyle = h < 0.5 ? 'rgba(30,18,10,0.45)' : 'rgba(96,66,40,0.4)';
      ctx.fillRect(x + hash2(i, j * 7 + q, 79) * (TP - 4), y + hash2(i * 5 + q, j, 81) * (TP - 4), 3 + (h < 0.2 ? 2 : 0), 2);
    }
  }
  const w = (S.wet ? S.wet[t] : 0) || (S.rsvBank && S.rsvBank[t] ? 1 : 0); // (a Reservoir's banks are wet too: stage 5)
  if (w) {
    const [r, g, b] = T2_COL.wet;
    ctx.fillStyle = `rgba(${r},${g},${b},${w === 2 ? 0.36 : 0.26})`; ctx.fillRect(x, y, TP, TP);
    ctx.fillStyle = 'rgba(20,40,16,0.14)'; // (damp: darker where it meets dry ground)
    const dry = (di, dj) => inMap(i + di, j + dj) && !(S.wet && S.wet[tIdx(i + di, j + dj)]) && !(S.rsvBank && S.rsvBank[tIdx(i + di, j + dj)]) && S.terrain[tIdx(i + di, j + dj)] === T_GROUND;
    if (dry(0, -1)) ctx.fillRect(x, y, TP, 4);
    if (dry(0, 1)) ctx.fillRect(x, y + TP - 4, TP, 4);
    if (dry(-1, 0)) ctx.fillRect(x, y, 4, TP);
    if (dry(1, 0)) ctx.fillRect(x + TP - 4, y, 4, TP);
    for (let q = 0; q < 4; q++) { // tufts of new green
      ctx.fillStyle = 'rgba(120,190,80,0.45)';
      ctx.fillRect(x + hash2(i * 3 + q, j, 91) * (TP - 3), y + hash2(i, j * 3 + q, 93) * (TP - 5), 2, 4);
    }
  }
}

/** A code-drawn grove (while its art loads, or without it): `st` 1 saplings, 2 young, 3 mature. */
function t2GroveCode(ctx, cx, cy, z, st, v) {
  const n = st === 1 ? 3 : v % 2 ? 1 : 2;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + v, d = n > 1 ? z * 0.2 : 0, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, r = z * (st === 1 ? 0.08 : st === 2 ? 0.18 : 0.3);
    ctx.fillStyle = 'rgba(20,14,8,0.3)'; ctx.beginPath(); ctx.ellipse(x + r * 0.3, y + r * 0.4, r, r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = st === 3 ? '#2f6a32' : '#4f8f3c'; ctx.beginPath(); ctx.arc(x, y - r * 0.3, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,120,0.35)'; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.6, r * 0.45, 0, Math.PI * 2); ctx.fill();
  }
}

/**
 * The groves and the sprinklers (render, with the ground: graded for the time of day with it): each grove its rendered
 * tile for its stage (grove-<stage>-<variant>), a mature one laden with Fiber showing pale seed heads; each sprinkler
 * (a pipe's open end the water reaches: pipeSprinkler) its head and, but on Saver, its spray sweeping round.
 */
function t2Ground(ctx, ox, oy, z, v0, v1) {
  const i0 = Math.max(0, Math.floor(v0.x) - 1), j0 = Math.max(0, Math.floor(v0.y) - 1), i1 = Math.min(S.W - 1, Math.ceil(v1.x) + 1), j1 = Math.min(S.H - 1, Math.ceil(v1.y) + 1);
  const saver = typeof gfxStep === 'function' && gfxStep() === 'saver';
  ctx.save();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const t = j * S.W + i;
    if (S.wet && S.wet[t] === 2 && S.pipe && S.pipe[t] && pipeSprinkler(t)) {
      const x = ox + (i + 0.5) * z, y = oy + (j + 0.5) * z;
      if (!saver) t2Spray(ctx, x, y, z, t);
      const sp = ART.sprinkler;
      if (sp) drawArt(ctx, sp, x, y, z * 0.42); else { ctx.fillStyle = '#b08a3c'; ctx.beginPath(); ctx.arc(x, y, z * 0.07, 0, Math.PI * 2); ctx.fill(); }
    }
    const g = S.grove ? S.grove[t] : 0;
    if (!g) continue;
    const st = groveStage(t), v = 1 + Math.floor(hash2(i, j, 4407) * 4), x = ox + (i + 0.5) * z, y = oy + (j + 0.5) * z;
    const art = ART[`grove-${st}-${v}`];
    if (art) drawArt(ctx, art, x, y, z * (st === 3 ? 1.75 : st === 2 ? 1.55 : 1.4)); else t2GroveCode(ctx, x, y, z, st, v); // (the art is 1.4 tiles across; older crowns spread wider)
    if (st === 3 && S.grvF && S.grvF[t] >= GROVE.fiberEvery && z >= 16) { // (Fiber ready: pale seed tufts in the crowns)
      ctx.fillStyle = 'rgba(244,232,196,0.85)';
      for (let q = 0; q < 4; q++) { ctx.beginPath(); ctx.arc(x + (hash2(t, q, 11) - 0.5) * z * 0.6, y - z * 0.15 + (hash2(t, q, 13) - 0.5) * z * 0.4, Math.max(1, z * 0.03), 0, Math.PI * 2); ctx.fill(); }
    }
  }
  ctx.restore();
}

/** A sprinkler's spray at (x, y): an impact sprinkler's jet sweeping round, its drops falling in a ring (IRR.spray tiles). */
function t2Spray(ctx, x, y, z, t) {
  const a0 = R.time * 1.4 + (t % 7), reach = IRR.spray * z * 0.85;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 14; k++) { // the jet: drops along an arc out to its reach
    const f = (k + 1) / 14, a = a0 - f * 0.25, d = reach * f, lift = Math.sin(f * Math.PI) * z * 0.35;
    ctx.globalAlpha = 0.35 * (1 - f * 0.5);
    ctx.fillStyle = '#cfefff';
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8 - lift, Math.max(1, z * 0.025 * (1.4 - f)), 0, Math.PI * 2); ctx.fill();
  }
  // the falling drops where the jet has been: a faint ring of mist behind it
  ctx.globalAlpha = 0.12; ctx.strokeStyle = '#d8f2ff'; ctx.lineWidth = Math.max(1, z * 0.05);
  ctx.beginPath(); ctx.ellipse(x, y, reach, reach * 0.8, 0, a0 - 1.6, a0 - 0.2); ctx.stroke();
  ctx.restore();
}

/** Robot u slowed in a foe's grove (groveSlow): three leaves swirling round it, so you can see why it's crawling. */
function t2SlowTell(ctx, u, sx, sy, s) {
  if (typeof groveSlow !== 'function' || groveSlow(u) >= 1) return;
  const a0 = R.time * 2.6 + u.id;
  for (let k = 0; k < 3; k++) {
    const a = a0 + (k * Math.PI * 2) / 3, x = sx + Math.cos(a) * s * 0.42, y = sy + Math.sin(a) * s * 0.3 - s * 0.1;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a * 1.7);
    ctx.fillStyle = k === 1 ? '#7fbf4a' : '#4f8f36';
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(2, s * 0.08), Math.max(1, s * 0.04), 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** The minimap's colour of ground tile t with stage 2 on it: groves dark green, irrigated land green, shifted land its new biome's. */
function t2MiniColor(t, c) {
  const sh = typeof t2TileBiome === 'function' ? t2TileBiome(t) : null;
  if (sh) { const reg = t2Region(sh); if (reg && reg.mm.ground) c = mixBiomeRGB(c, reg.mm.ground, 0.85); }
  if (S.grove && S.grove[t]) return mixBiomeRGB(c, T2_COL.grove, 0.45 + 0.15 * groveStage(t));
  if ((S.wet && S.wet[t]) || (S.rsvBank && S.rsvBank[t])) return mixBiomeRGB(c, T2_COL.irrigated, 0.55);
  return c;
}
