'use strict';
/*
 * Terrafall: The Dam's look and its panel (SHAPE_PRESETS dam). The map is laid by damShape (world.js) and runs in sim.js
 * (damTick, damRun, damBreak, damFlood); this file only draws it and opens the dam's panel. Everything here reads the
 * game (S.dam, the clock) and never changes it.
 *
 *   damGround   on the ground, under robots and buildings: the flood (muddy water spreading from the dam's foot, a
 *               foaming front, streaks running down the valley, then wet silt as it goes down), the lakebed's wet mud as
 *               the lake drains, the river's current; drawn with the ground, so it's graded with it at dusk and night
 *   damItems    the dams among the buildings and robots, sorted by their foot: the concrete wall (its crest, its face
 *               toward the valley with a spillway gate and a trickle over it), cracks that spread as it weakens, water
 *               seeping through them below half, chips flying while it's hit (a Missile's blast on it: damBlast's fx); once burst, its broken ends, rubble and
 *               the lake pouring through the breach; a strength bar while it's hurt; your Demolish or Shore up order as
 *               a dashed outline
 */

const DAM_H = 0.8; // (the wall's height over its ground, tiles)
const _dd = { cracks: new Map() };

/** Which way dam d faces: [fx, fy], from the middle of the map out toward the valley it holds the lake over. */
function damFace(d) {
  const c = damMid(d), dx = c.x - S.W / 2, dy = c.y - S.H / 2, l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}
/** Dam d's index in S.dam.d. */
function damKOf(d) { return S.dam.d.indexOf(d); }

/* ------------------------------------------------------------------ the flood, the lakebed, the river */

function damGround(ctx, ox, oy, z, v0, v1) {
  if (!S.dam || typeof document === 'undefined') return;
  const now = S.time, rt = typeof R !== 'undefined' ? R.time || 0 : 0, W = S.W;
  const inV = (i, j) => i >= v0.x - 2 && i <= v1.x + 2 && j >= v0.y - 2 && j <= v1.y + 2;
  ctx.save();
  S.dam.d.forEach((d, k) => {
    if (d.broke < 0) return;
    const el = now - d.broke, front = el * DAM.speed, [fx, fy] = damFace(d), c = damMid(d), mx = c.x + fx * 0.6, my = c.y + fy * 0.6;
    const chan = damIndex().chan[k];
    // The lakebed: wet mud where the water was, darker the fresher; a faint tide line stays.
    const span = DAM.drain[1] - DAM.drain[0];
    for (let q = 0; q < d.lake.length; q++) {
      const t = d.lake[q], i = t % W, j = (t / W) | 0;
      if (!inV(i, j) || S.terrain[t] === T_WATER) continue;
      const dry = d.broke + DAM.drain[0] + ((q + 1) / d.lake.length) * span, age = now - dry;
      if (age < 0) continue;
      ctx.fillStyle = `rgba(58,46,32,${Math.max(0.16, 0.62 - age / 60)})`;
      ctx.fillRect(ox + i * z, oy + j * z, z + 0.5, z + 0.5);
      if (age < 25 && hash2(i, j, 7101) < 0.35) { ctx.fillStyle = `rgba(160,190,200,${0.35 * (1 - age / 25)})`; ctx.fillRect(ox + (i + hash2(i, j, 7102) * 0.6) * z, oy + (j + hash2(i, j, 7103) * 0.7) * z, z * 0.32, z * 0.12); } // (puddles)
    }
    // The flood: tiles the front has reached (and the next one, filling), muddy water with streaks running downhill.
    const last = d.fd.length ? d.fd[d.fd.length - 1] / 100 : 0, goneAt = DAM.stay + DAM.recede;
    for (let q = 0; q < d.flood.length; q++) {
      const a = d.fd[q] / 100;
      if (a > front + 1) break;
      const t = d.flood[q], i = t % W, j = (t / W) | 0;
      if (!inV(i, j)) continue;
      const fill = clamp(front + 1 - a, 0, 1), river = chan.has(t), wet = S.terrain[t] === T_WATER;
      const X = ox + i * z, Y = oy + j * z;
      // when this tile went down (the far end first), for the silt it leaves
      const down = DAM.stay + (1 - a / (last || 1)) * DAM.recede;
      if (!wet && !river && el > down) {
        const age = el - down;
        if (age < 40) { ctx.fillStyle = `rgba(70,58,40,${0.45 * (1 - age / 40)})`; ctx.fillRect(X, Y, z + 0.5, z + 0.5); }
        continue;
      }
      const settle = clamp((el - (a / DAM.speed)) / 12, 0, 1); // (0 as the front arrives, 1 once it has settled)
      const muddy = river ? (el < goneAt ? 0.8 - 0.4 * clamp((el - DAM.stay) / DAM.recede, 0, 1) : 0.35) : 0.85 - 0.15 * settle;
      ctx.fillStyle = `rgba(52,76,92,${muddy * fill})`;
      ctx.fillRect(X, Y, z + 0.5, z + 0.5);
      // streaks running down the valley, away from the dam's foot
      const ux = i + 0.5 - mx, uy = j + 0.5 - my, ul = Math.hypot(ux, uy) || 1, sx = ux / ul, sy = uy / ul;
      const speed = river ? 1.6 : 2.4 * (1 - settle * 0.7);
      ctx.strokeStyle = `rgba(214,228,226,${(river ? 0.45 : 0.4) * fill * (1 - settle * 0.5)})`;
      ctx.lineWidth = Math.max(1, z * 0.05);
      ctx.beginPath();
      for (let s = 0; s < 2; s++) {
        const ph = ((rt * speed * 0.5 + hash2(i, j * 3 + s, 7111)) % 1 + 1) % 1, px = X + (0.2 + 0.6 * hash2(i + s, j, 7112)) * z, py = Y + (0.2 + 0.6 * hash2(i, j + s, 7113)) * z;
        const L = z * 0.35, off = (ph - 0.5) * z * 0.6;
        ctx.moveTo(px + sx * off, py + sy * off); ctx.lineTo(px + sx * (off + L), py + sy * (off + L));
      }
      ctx.stroke();
      // the foaming front
      const behind = front - a;
      if (behind < 1.6 && el < (last / DAM.speed) + 2) {
        const fa = (1 - behind / 1.6) * fill;
        ctx.fillStyle = `rgba(245,245,238,${0.75 * fa})`;
        for (let s = 0; s < 4; s++) {
          const r = z * (0.08 + 0.1 * hash2(i * 5 + s, j, 7121)) * (0.8 + 0.3 * Math.sin(rt * 9 + s + i));
          ctx.beginPath(); ctx.arc(X + hash2(i, j * 7 + s, 7122) * z, Y + hash2(i * 7 + s, j, 7123) * z, r, 0, 7); ctx.fill();
        }
      }
    }
  });
  ctx.restore();
}

/* ------------------------------------------------------------------ the wall */

function damItems(items, inView) {
  if (!S.dam) return;
  S.dam.d.forEach((d, k) => { const c = damMid(d); if (inView(c.x, c.y, Math.max(d.x1 - d.x0, d.y1 - d.y0) + 6)) items.push({ ent: 'dam', d, k, x: d.x0, y: d.y1 + 1 - 0.02 }); });
}

/** Dam d's cracks: up to 12, each a jagged line down its face (tile-space points), the same every time. */
function damCracks(d, k) {
  let c = _dd.cracks.get(k);
  if (c && c.of === d) return c.list;
  const list = [];
  for (let n = 0; n < 12; n++) {
    const t = d.tiles[Math.floor(hash2(k, n, 7201) * d.tiles.length)], i = t % S.W, j = (t / S.W) | 0;
    let x = i + 0.15 + hash2(k, n, 7202) * 0.7, y = j + 0.1 + hash2(k, n, 7203) * 0.3;
    const pts = [[x, y]];
    for (let s = 0; s < 5; s++) { x += (hash2(k * 13 + n, s, 7204) - 0.5) * 0.4; y += 0.12 + hash2(k * 13 + n, s, 7205) * 0.14; pts.push([x, y]); }
    list.push(pts);
  }
  _dd.cracks.set(k, { of: d, list });
  return list;
}

function damDraw(ctx, e, ox, oy, z) {
  const d = e.d, k = e.k, rt = typeof R !== 'undefined' ? R.time || 0 : 0, live = typeof R !== 'undefined' && !R.inMap;
  const broke = d.broke >= 0, el = broke ? S.time - d.broke : 0, gap = new Set(d.gap), set = new Set(d.tiles), W = S.W;
  const col = (h) => (typeof todColor === 'function' ? todColor(h) : h);
  const h = DAM_H * z, [fx, fy] = damFace(d);
  const crest = col('#b7bcbd'), face = col('#82898c'), dark = col('#565d61'), edge = col('#dfe3e3');
  const tiles = d.tiles.filter((t) => !(broke && gap.has(t))).sort((a, b) => a - b);
  // the wall: each tile a block, its crest raised, the face below it where no wall stands in front
  for (const t of tiles) {
    const i = t % W, j = (t / W) | 0, X = ox + i * z, Y = oy + j * z;
    if (!set.has(t + W) || (broke && gap.has(t + W))) {
      ctx.fillStyle = face; ctx.fillRect(X, Y + z - h, z + 0.5, h);
      ctx.fillStyle = dark; for (let s = 1; s < 3; s++) ctx.fillRect(X + (s / 3) * z, Y + z - h, Math.max(1, z * 0.025), h); // (the shuttering's seams)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(X, Y + z - h * 0.18, z + 0.5, h * 0.18);
    }
    ctx.fillStyle = crest; ctx.fillRect(X, Y - h, z + 0.5, z + 0.5);
    // the parapets along the long sides (lake side and valley side)
    ctx.fillStyle = edge;
    if (Math.abs(fy) >= Math.abs(fx)) { ctx.fillRect(X, Y - h, z + 0.5, z * 0.12); ctx.fillRect(X, Y - h + z * 0.88, z + 0.5, z * 0.12); }
    else { ctx.fillRect(X, Y - h, z * 0.12, z + 0.5); ctx.fillRect(X + z * 0.88, Y - h, z * 0.12, z + 0.5); }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(X + z * 0.45, Y - h + z * 0.4, z * 0.1, z * 0.1); // (a bollard's base)
  }
  // the spillway gate in the middle of the valley face, and the trickle over it while the lake is full
  if (!broke && d.gap.length) {
    const mid = d.gap[Math.floor(d.gap.length / 2)], i = mid % W, j = (mid / W) | 0;
    const X = ox + (i + fx * 0.5) * z, Y = oy + (j + 0.5 + Math.max(0, fy) * 0.5) * z - h * 0.5;
    ctx.fillStyle = dark; ctx.fillRect(X - z * 0.22, Y - h * 0.35, z * 0.44, h * 0.6);
    if (live) {
      ctx.fillStyle = 'rgba(170,210,230,0.55)';
      for (let s = 0; s < 3; s++) { const ph = (rt * 1.4 + s / 3) % 1; ctx.fillRect(X - z * 0.15 + s * z * 0.12, Y - h * 0.3 + ph * h * 0.9, z * 0.05, z * 0.14); }
    }
  }
  // cracks, spreading as it weakens; water seeping through them below half; chips flying while it's hit
  if (!broke) {
    const f = 1 - d.hp / DAM.hp, cr = damCracks(d, k), n = Math.min(cr.length, Math.floor(f * 13));
    ctx.lineCap = 'round';
    for (let q = 0; q < n; q++) {
      const pts = cr[q], wdt = Math.max(1, z * (0.03 + 0.05 * f));
      ctx.strokeStyle = 'rgba(30,26,22,0.85)'; ctx.lineWidth = wdt;
      ctx.beginPath(); pts.forEach(([x, y], s) => { const X = ox + x * z, Y = oy + y * z - h; if (s) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
      if (f > 0.5 && live) { // seeping
        const [x, y] = pts[pts.length - 1], X = ox + x * z, Y = oy + y * z - h;
        ctx.fillStyle = 'rgba(150,200,225,0.7)';
        const ph = (rt * 1.2 + q * 0.37) % 1;
        ctx.fillRect(X - z * 0.02, Y, z * 0.04, ph * h * 1.2);
      }
    }
    ctx.lineCap = 'butt';
    if (live && S.time - d.hitT < 0.6) {
      ctx.fillStyle = col('#d8d1c0');
      for (let s = 0; s < 6; s++) {
        const t = d.tiles[Math.floor(hash2(Math.floor(rt * 8), s, 7211) * d.tiles.length)], i = t % W, j = (t / W) | 0, ph = (rt * 3 + s / 6) % 1;
        ctx.fillRect(ox + (i + hash2(s, Math.floor(rt * 8), 7212)) * z, oy + (j + 0.5) * z - h - ph * z * 0.6, Math.max(1, z * 0.06), Math.max(1, z * 0.06));
      }
    }
  }
  // burst: rubble at the broken ends, and the lake pouring through
  if (broke) {
    for (const t of d.gap) {
      const i = t % W, j = (t / W) | 0;
      ctx.fillStyle = col('#8a8476');
      for (let s = 0; s < 5; s++) { const r = z * (0.1 + 0.12 * hash2(i * 3 + s, j, 7221)); ctx.beginPath(); ctx.arc(ox + (i + hash2(i, j * 5 + s, 7222)) * z, oy + (j + hash2(i * 5 + s, j, 7223)) * z - h * 0.2, r, 0, 7); ctx.fill(); }
    }
    const pour = clamp(1 - (el - DAM.drain[1]) / 15, 0, 1);
    if (pour > 0 && live) {
      for (const t of d.gap) {
        const i = t % W, j = (t / W) | 0;
        for (let s = 0; s < 6; s++) {
          const ph = (rt * 2.2 + s / 6 + hash2(i, j, 7231)) % 1, w = z * (0.1 + 0.1 * hash2(i, s, 7232));
          const x0 = i + 0.15 + 0.7 * hash2(i * 7 + s, j, 7233), y0 = j + 0.5;
          const x = x0 + fx * ph * 2.2, y = y0 + fy * ph * 2.2;
          ctx.fillStyle = `rgba(235,242,245,${0.8 * pour * (1 - ph)})`;
          ctx.beginPath(); ctx.arc(ox + x * z, oy + y * z - h * (1 - ph) * 0.6, w * (1 + ph), 0, 7); ctx.fill();
        }
      }
      const c = damMid(d), mx = c.x + fx * 1.6, my = c.y + fy * 1.6;
      const g = ctx.createRadialGradient(ox + mx * z, oy + my * z, 0, ox + mx * z, oy + my * z, z * 2.2);
      g.addColorStop(0, `rgba(240,246,248,${0.5 * pour})`); g.addColorStop(1, 'rgba(240,246,248,0)');
      ctx.fillStyle = g; ctx.fillRect(ox + (mx - 2.2) * z, oy + (my - 2.2) * z, z * 4.4, z * 4.4);
    }
  }
  // your order on it, and its strength while it's hurt
  if (live) {
    const p = typeof ME !== 'undefined' ? ME : 0, X0 = ox + d.x0 * z, Y0 = oy + d.y0 * z - h, w = (d.x1 - d.x0 + 1) * z, hh = (d.y1 - d.y0 + 1) * z + h;
    const mine = !broke && ((d.by >> p) & 1 ? '#ff5a6e' : (d.mend >> p) & 1 ? '#7dffa0' : '');
    if (mine) { ctx.save(); ctx.strokeStyle = mine; ctx.lineWidth = Math.max(1, z * 0.05); ctx.setLineDash([z * 0.2, z * 0.14]); ctx.lineDashOffset = -rt * z * 0.6; ctx.strokeRect(X0 - z * 0.15, Y0 - z * 0.15, w + z * 0.3, hh + z * 0.3); ctx.restore(); }
    if (!broke && (d.hp < DAM.hp || (typeof UI !== 'undefined' && UI.sheetKind === 'dam' && UI.sheetFor === k))) {
      const bw = Math.max(z * 1.6, w * 0.8), bx = X0 + w / 2 - bw / 2, by = Y0 - z * 0.45, f = d.hp / DAM.hp;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, Math.max(3, z * 0.12));
      ctx.fillStyle = f > 0.6 ? '#7bea6b' : f > 0.3 ? '#ffd166' : '#ff5a5a'; ctx.fillRect(bx, by, bw * f, Math.max(3, z * 0.12));
    }
  }
}

/* ------------------------------------------------------------------ the panel */

function damSheet(k) {
  const d = damByK(k);
  if (!d) return;
  if (typeof R !== 'undefined') { R.selected = 0; R.selTile = -1; }
  if (typeof UI !== 'undefined') UI.selBot = 0;
  const p = ME, broke = d.broke >= 0, wreck = (d.by >> p) & 1, mend = (d.mend >> p) & 1, whose = damWhose(d, p);
  const crew = S.bots.filter((u) => !u.dead && u.owner === p && u.task && u.task.type === 'dammend' && u.task.d === k).length;
  const at = S.bots.filter((u) => !u.dead && !u.inside && u.owner === p && isArmy(u) && botArmed(u) && damDist(d, u.x, u.y) <= DAM.reach).length;
  const pct = Math.round((d.hp / DAM.hp) * 100);
  let state;
  if (broke) state = `<b>Burst${d.brokeBy >= 0 ? ` by ${d.brokeBy === p ? 'you' : esc(playerName(d.brokeBy, true))}` : ''}.</b> The lake has flooded ${whose} valley and drained to a muddy bed, with Ore and Crystal in the mud; the river it left is shallows robots wade (Haulers and trucks need a bridge), and the breach is a way up to the lakebed.`;
  else {
    state = `Strength <b>${Math.ceil(d.hp)} of ${DAM.hp}</b> (${pct}%). It holds the lake over ${whose} valley. `;
    if (wreck) state += at ? `<b>Demolishing it:</b> ${at} of your armed robots in reach, each taking ${DAM.hit} a second off it.` : `<b>Ordered demolished:</b> select warbots and tap the dam to send them; armed robots within ${DAM.reach} tiles of it shoot it (Howitzers from ${DAM.siegeReach}, ${DAM.siege} a second).`;
    else if (mend) state += crew ? `<b>Being shored up:</b> ${crew} of your Workers on it (up to ${DAM.crew}), each mending ${DAM.mend} a second.` : S.time - d.hitT < DAM.calm ? '<b>Ordered shored up:</b> your Workers go once nothing has hit it for a few seconds.' : '<b>Ordered shored up:</b> your next free Workers go to it.';
    else state += d.k === p ? 'If it breaks, the flood sweeps your robots, damages your buildings down the valley (those in the river\'s path are wrecked) and washes out the roads there. Guard it from the shelf and the gorge: a rival\'s Missile takes ' + DAM.missile + ' off it.' : `Demolish it and the lake floods ${whose} valley. A Missile aimed at it (your Silo's Aim missile) takes ${DAM.missile} off it.`;
  }
  const btn = broke ? '' : (wreck ? '<button class="btn" id="sh-damstop">Stop demolishing</button>' : '<button class="btn primary" id="sh-damwreck">Demolish the dam</button>')
    + (mend ? '<button class="btn" id="sh-damunmend">Stop shoring up</button>' : `<button class="btn" id="sh-dammend"${d.hp >= DAM.hp ? ' disabled' : ''}>Shore it up</button>`);
  const html = `<div class="sheet-title"><div><h3>The dam</h3><div class="sub">over ${whose} valley</div></div></div>
    <p class="flavor">${esc(broke ? DAM_LINE.replace('full', 'empty') : DAM_LINE)}</p>
    <p class="desc">${state}</p>
    ${btn ? `<div class="btn-row">${btn}</div>` : ''}`;
  openSheet('dam', k, html);
  const go = (what, on) => { sfx('click'); act('damOrder', [k, what, on], (why) => { if (why) toast(why, 'warn'); else toast(what === 'wreck' ? (on ? 'Dam ordered demolished: select warbots and tap it to send them.' : 'Demolishing called off.') : (on ? 'Your free Workers are on their way to shore it up.' : 'Shoring up called off.'), 'info'); damSheet(k); }); };
  if ($('sh-damwreck')) $('sh-damwreck').onclick = () => go('wreck', true);
  if ($('sh-damstop')) $('sh-damstop').onclick = () => go('wreck', false);
  if ($('sh-dammend')) $('sh-dammend').onclick = () => go('mend', true);
  if ($('sh-damunmend')) $('sh-damunmend').onclick = () => go('mend', false);
}
/** A few times a second (the interface): the dam's open panel kept current. */
function damUiTick() {
  if (!S || !S.dam || typeof UI === 'undefined' || UI.sheetKind !== 'dam') return;
  UI.damT = (UI.damT || 0) + 1;
  if (UI.damT % 4 === 0) damSheet(UI.sheetFor);
}
