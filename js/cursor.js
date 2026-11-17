/*
 * The mouse cursor: Terrafall's own, on any device with a mouse (pointer: fine). Drawn here at start-up in the app
 * icon's colours, sharp at 1× and 2× (the owner's pick, "Midnight"): a navy arrow with a cream rim and coral stripes on
 * its tail; the arrow lit coral over anything that takes a click (a button, or a building or robot on the map); a cream
 * frame for placing buildings and painting roads; a coral reticle over a rival when your army is picked (a right-click
 * attacks it) and while an attack or a missile is being aimed; a cream one for landings and air drops; four cream
 * arrows while the map is dragged. Text fields keep the system's I-beam. Settings → Custom cursor turns it off (kept on
 * this device: botfall.cursor).
 *
 * How: every cursor the page's stylesheets ask for is asked again under html.tf-cur with ours in its place
 * (pointer → lit, crosshair → reticle, default → arrow; the rest, such as not-allowed, stay the system's), so new
 * styles get it without a change here. The map's own cursor follows what's under the mouse (cursorTick, from render).
 */
const CURSOR = { on: true, ok: false, kind: '', t: 0 };

// What each cursor is: its hotspot (1× pixels from the top left) and the system cursor to fall back on.
const CURSOR_KINDS = {
  arrow: { hx: 2, hy: 2, fb: 'default' },
  point: { hx: 2, hy: 2, fb: 'pointer' },
  cross: { hx: 16, hy: 16, fb: 'crosshair' },
  attack: { hx: 16, hy: 16, fb: 'crosshair' },
  drop: { hx: 16, hy: 16, fb: 'crosshair' },
  pan: { hx: 16, hy: 16, fb: 'move' },
};

// The app icon's colours (icons/icon.svg): midnight navy, the planet's coral and its shadow side, the ring's cream.
const CUR_NAVY = '#14213d', CUR_CORAL = '#ff6b4a', CUR_CORAL2 = '#e04a2c', CUR_CREAM = '#f1e4d3', CUR_INK = 'rgba(8,12,24,0.85)';
// The arrow: tip at (2, 2), a little smaller than the system's.
const CUR_ARROW = [[2, 2], [2, 23.5], [7.2, 18.6], [11, 27], [14.6, 25.4], [10.9, 17.2], [18, 17.2]].map(([x, y]) => [2 + (x - 2) * 0.9, 2 + (y - 2) * 0.9]);

/**
 * Draw one cursor on a 32×32 (× s) canvas, flat (no glow), each shape with a thin dark edge so it reads on pale ground:
 * the arrow navy with a cream rim and three thin coral stripes across its tail; lit (over a clickable) coral, lit and
 * shaded like the planet, its stripes navy; the frame for placing and the drag arrows cream round a coral dot; the
 * attack reticle coral round a cream dot; the reticle for landings and drops cream round a coral one.
 */
function drawCursorImage(kind, s) {
  const c = document.createElement('canvas');
  c.width = c.height = 32 * s;
  const ctx = c.getContext('2d');
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const TAU = Math.PI * 2;
  const arrow = () => { ctx.beginPath(); CUR_ARROW.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const line2 = (path, col, w) => { ctx.strokeStyle = CUR_INK; ctx.lineWidth = w + 1.6; path(); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = w; path(); ctx.stroke(); };
  const dot = (r, col) => { ctx.fillStyle = CUR_INK; ctx.beginPath(); ctx.arc(16, 16, r + 0.8, 0, TAU); ctx.fill(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(16, 16, r, 0, TAU); ctx.fill(); };
  const reticle = () => { ctx.beginPath(); ctx.arc(16, 16, 7.5, 0, TAU); for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; ctx.moveTo(16 + Math.cos(a) * 11.5, 16 + Math.sin(a) * 11.5); ctx.lineTo(16 + Math.cos(a) * 5, 16 + Math.sin(a) * 5); } };
  if (kind === 'arrow' || kind === 'point') {
    const lit = kind === 'point';
    ctx.strokeStyle = CUR_INK; ctx.lineWidth = 2.7; arrow(); ctx.stroke();
    let fill = CUR_NAVY;
    if (lit) { fill = ctx.createLinearGradient(4, 4, 14, 22); fill.addColorStop(0, CUR_CORAL); fill.addColorStop(0.62, CUR_CORAL); fill.addColorStop(0.63, CUR_CORAL2); fill.addColorStop(1, CUR_CORAL2); }
    arrow(); ctx.fillStyle = fill; ctx.fill();
    // Three thin stripes, angled across the tail.
    ctx.save(); arrow(); ctx.clip();
    ctx.strokeStyle = lit ? 'rgba(20,33,61,0.55)' : CUR_CORAL; ctx.lineWidth = 0.75; ctx.lineCap = 'butt';
    for (let k = 0; k < 3; k++) {
      const t = 0.32 + k * 0.22, cx = 8.3 + 3.3 * t, cy = 16.4 + 7.2 * t;
      ctx.beginPath(); ctx.moveTo(cx - 6, cy + 3.6); ctx.lineTo(cx + 6, cy - 3.6); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = CUR_CREAM; ctx.lineWidth = 1.1; arrow(); ctx.stroke();
  } else if (kind === 'cross') {
    line2(() => {
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { ctx.moveTo(16 + sx * 8.5, 16 + sy * 5); ctx.lineTo(16 + sx * 8.5, 16 + sy * 8.5); ctx.lineTo(16 + sx * 5, 16 + sy * 8.5); }
    }, CUR_CREAM, 1.2);
    dot(1.5, CUR_CORAL);
  } else if (kind === 'attack' || kind === 'drop') {
    line2(reticle, kind === 'attack' ? CUR_CORAL : CUR_CREAM, 1.4);
    dot(1.2, kind === 'attack' ? CUR_CREAM : CUR_CORAL);
  } else if (kind === 'pan') {
    line2(() => {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
        ctx.moveTo(16 + ux * 4.5, 16 + uy * 4.5); ctx.lineTo(16 + ux * 11.5, 16 + uy * 11.5);
        ctx.moveTo(16 + ux * 7.5 + px * 3, 16 + uy * 7.5 + py * 3); ctx.lineTo(16 + ux * 11.5, 16 + uy * 11.5); ctx.lineTo(16 + ux * 7.5 - px * 3, 16 + uy * 7.5 - py * 3);
      }
    }, CUR_CREAM, 1.2);
    dot(1.5, CUR_CORAL);
  }
  return c.toDataURL('image/png');
}

/** The cursor property's value for a kind, in the best form this browser takes (image-set for sharp 2× screens). */
function cursorValue(kind, form) {
  const k = CURSOR_KINDS[kind], a = drawCursorImage(kind, 1), b = drawCursorImage(kind, 2), tail = ` ${k.hx} ${k.hy}, ${k.fb}`;
  if (form === 'set') return `image-set(url("${a}") 1x, url("${b}") 2x)${tail}`;
  if (form === 'webkit') return `-webkit-image-set(url("${a}") 1x, url("${b}") 2x)${tail}`;
  return `url("${a}")${tail}`;
}

/** Split a selector list at its top-level commas (not those inside :is(…) and the like). */
function splitSelectors(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** The stylesheet that puts our cursors in: every cursor rule on the page asked again under html.tf-cur. */
function buildCursorSheet() {
  const probe = 'url("data:image/png;base64,iVBORw0KGgo=") 1x';
  const sup = (v) => typeof CSS !== 'undefined' && CSS.supports && CSS.supports('cursor', v);
  const form = sup(`image-set(${probe}) 2 2, auto`) ? 'set' : sup(`-webkit-image-set(${probe}) 2 2, auto`) ? 'webkit' : 'url';
  const vars = Object.keys(CURSOR_KINDS).map((k) => `--tfc-${k}: ${cursorValue(k, form)};`).join('\n');
  const ours = { pointer: 'var(--tfc-point)', crosshair: 'var(--tfc-cross)', default: 'var(--tfc-arrow)', auto: 'var(--tfc-arrow)' };
  const out = [];
  const walk = (rules, wrap) => {
    for (const r of rules) {
      if (r.cssRules && r.media) { walk(r.cssRules, (s) => wrap(`@media ${r.media.mediaText} { ${s} }`)); continue; }
      const cur = r.style && r.style.getPropertyValue('cursor');
      if (!cur || !r.selectorText) continue;
      const sel = splitSelectors(r.selectorText).map((s) => `html.tf-cur ${s.replace(/^html\b/, '')}`).join(', ');
      out.push(wrap(`${sel} { cursor: ${ours[cur.trim()] || cur}; }`));
    }
  };
  for (const sh of document.styleSheets) {
    let rules = null;
    try { rules = sh.cssRules; } catch (e) { /* another site's stylesheet: not ours to read */ }
    if (rules) walk(rules, (s) => s);
  }
  return `html.tf-cur {\n${vars}\n}
html.tf-cur, html.tf-cur * { cursor: var(--tfc-arrow); }
html.tf-cur :is(a[href], summary, select, label[for], input[type=range], input[type=checkbox], input[type=radio], input[type=color], [role=button], [role=switch], [role=radio], [role=tab]) { cursor: var(--tfc-point); }
${out.join('\n')}
html.tf-cur :is(textarea, [contenteditable=true], input:not([type]), input[type=text], input[type=search], input[type=email], input[type=number], input[type=url], input[type=password]) { cursor: text; }
html.tf-cur :is(button, [role=button]):disabled { cursor: var(--tfc-arrow); }
html.tf-cur body.mode-attack canvas#game, html.tf-cur body.mode-aim canvas#game { cursor: var(--tfc-attack); }
html.tf-cur body.mode-land canvas#game, html.tf-cur body.mode-airdrop canvas#game { cursor: var(--tfc-drop); }
html.tf-cur canvas#game[data-cur=point] { cursor: var(--tfc-point) !important; }
html.tf-cur canvas#game[data-cur=attack] { cursor: var(--tfc-attack) !important; }
html.tf-cur canvas#game[data-cur=pan] { cursor: var(--tfc-pan) !important; }
`;
}

/** Can this device show our cursor (it has a mouse, and the browser takes images for cursors)? */
function cursorSupported() {
  return typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches && typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('cursor', 'url("x.png") 2 2, auto');
}

function initCursor() {
  try { CURSOR.on = localStorage.getItem('botfall.cursor') !== '0'; } catch (e) { /* storage unavailable */ }
  CURSOR.ok = cursorSupported();
  if (!CURSOR.ok) return;
  try {
    const st = document.createElement('style');
    st.id = 'tf-cursor';
    st.textContent = buildCursorSheet();
    document.head.appendChild(st);
  } catch (e) { CURSOR.ok = false; return; }
  setCursorOn(CURSOR.on);
}

function setCursorOn(on) {
  CURSOR.on = !!on;
  try { localStorage.setItem('botfall.cursor', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  document.documentElement.classList.toggle('tf-cur', CURSOR.ok && CURSOR.on);
}

/**
 * The map's cursor, from what's under the mouse (called each frame by render; looks again every tenth of a second):
 * four arrows while a drag moves the map; in the normal view, the red reticle over a rival building or robot with
 * your army picked, else the lit arrow over any building or one of your robots.
 */
function cursorTick(canvas) {
  if (!CURSOR.ok || !CURSOR.on || !canvas) return;
  const g = INPUT.gesture, now = R.time;
  let kind = '';
  if (g && g.type === 'single' && g.moved && !g.box && !g.painting && !g.grab) kind = 'pan';
  else if (now - CURSOR.t < 0.1) return;
  else if (R.mouse && S && typeof UI !== 'undefined' && UI.inGame && !UI.paused && R.mode === 'normal' && R.hover >= 0) {
    CURSOR.t = now;
    const w = screenToWorld(R.mouse.x, R.mouse.y), i = Math.floor(w.x), j = Math.floor(w.y);
    const b = buildingAtTap(i, j, w.x, w.y);
    const army = UI.sel && UI.sel.length > 0;
    if (army && ((b && foes(b.owner, ME)) || (!b && enemyBotAtTap(i, j)))) kind = 'attack';
    else if (b || S.bots.some((u) => !u.dead && !u.inside && u.owner === ME && dist2(u.x, u.y, w.x, w.y) < 0.16)) kind = 'point';
  } else CURSOR.t = now;
  if (kind !== CURSOR.kind) {
    CURSOR.kind = kind;
    if (kind) canvas.dataset.cur = kind; else delete canvas.dataset.cur;
  }
}
