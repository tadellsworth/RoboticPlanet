/*
 * The mouse cursor: Terrafall's own, on any device with a mouse (pointer: fine). Drawn here at start-up in the game's
 * colours, sharp at 1× and 2×: a gunmetal arrow edged in the accent cyan; the same arrow lit cyan over anything that
 * takes a click (a button, or a building or robot on the map); a cyan reticle for placing buildings and painting
 * roads; a red one over a rival when your army is picked (a right-click attacks it) and while an attack or a missile
 * is being aimed; amber for landings and air drops; four arrows while the map is dragged. Text fields keep the
 * system's I-beam. Settings → Custom cursor turns it off (kept on this device: botfall.cursor).
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
  amber: { hx: 16, hy: 16, fb: 'crosshair' },
  pan: { hx: 16, hy: 16, fb: 'move' },
};

/** Draw one cursor on a 32×32 (× s) canvas. */
function drawCursorImage(kind, s) {
  const c = document.createElement('canvas');
  c.width = c.height = 32 * s;
  const ctx = c.getContext('2d');
  ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const glowLine = (col, glow, w, path) => {
    // A dark edge first (so it shows on pale ground), then the colour with a soft glow.
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(4,8,12,0.9)'; ctx.lineWidth = w + 2.2; path(); ctx.stroke();
    ctx.shadowColor = glow; ctx.shadowBlur = 3; ctx.strokeStyle = col; ctx.lineWidth = w; path(); ctx.stroke();
    ctx.shadowBlur = 0;
  };
  if (kind === 'arrow' || kind === 'point') {
    const lit = kind === 'point';
    const P = [[2, 2], [2, 23.5], [7.2, 18.6], [11, 27], [14.6, 25.4], [10.9, 17.2], [18, 17.2]];
    const path = () => { ctx.beginPath(); P.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    ctx.shadowColor = lit ? 'rgba(56,212,255,0.9)' : 'rgba(56,212,255,0.45)'; ctx.shadowBlur = lit ? 4 : 2.5;
    path(); ctx.fillStyle = 'rgba(4,8,12,0.9)'; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(4,8,12,0.92)'; ctx.lineWidth = 2.6; path(); ctx.stroke();
    const g = ctx.createLinearGradient(2, 2, 14, 26);
    if (lit) { g.addColorStop(0, '#b8f6ff'); g.addColorStop(0.5, '#4fd8ff'); g.addColorStop(1, '#168fc0'); }
    else { g.addColorStop(0, '#3a4652'); g.addColorStop(0.55, '#1f272f'); g.addColorStop(1, '#0f141a'); }
    path(); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = lit ? '#e9fcff' : '#38d4ff'; ctx.lineWidth = 1.15; path(); ctx.stroke();
    // A bright edge down the spine, and a notch of light near the tail.
    ctx.strokeStyle = lit ? 'rgba(255,255,255,0.9)' : 'rgba(150,235,255,0.65)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(3.7, 6); ctx.lineTo(3.7, 19.5); ctx.stroke();
    ctx.fillStyle = lit ? '#ffffff' : '#38d4ff';
    ctx.beginPath(); ctx.arc(10.5, 21.6, 1.05, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'cross') {
    // Placing: four corner brackets and a small cross in the middle.
    const path = () => {
      ctx.beginPath();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ctx.moveTo(16 + sx * 9, 16 + sy * 4.5); ctx.lineTo(16 + sx * 9, 16 + sy * 9); ctx.lineTo(16 + sx * 4.5, 16 + sy * 9);
      }
      ctx.moveTo(16, 13); ctx.lineTo(16, 19); ctx.moveTo(13, 16); ctx.lineTo(19, 16);
    };
    glowLine('#38d4ff', 'rgba(56,212,255,0.9)', 1.5, path);
  } else if (kind === 'attack' || kind === 'amber') {
    // A targeting reticle: a broken ring, ticks pointing in, a dot.
    const col = kind === 'attack' ? '#ff4b4b' : '#ffb43c', glow = kind === 'attack' ? 'rgba(255,60,60,0.9)' : 'rgba(255,170,50,0.9)';
    const path = () => {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2 + Math.PI / 4; ctx.moveTo(16 + Math.cos(a - 0.55) * 9, 16 + Math.sin(a - 0.55) * 9); ctx.arc(16, 16, 9, a - 0.55, a + 0.55); }
      for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 2; ctx.moveTo(16 + Math.cos(a) * 13.5, 16 + Math.sin(a) * 13.5); ctx.lineTo(16 + Math.cos(a) * 5.5, 16 + Math.sin(a) * 5.5); }
    };
    glowLine(col, glow, 1.6, path);
    ctx.fillStyle = 'rgba(4,8,12,0.9)'; ctx.beginPath(); ctx.arc(16, 16, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(16, 16, 1.4, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'pan') {
    // Four arrowheads out from a dot.
    const path = () => {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2, ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
        ctx.moveTo(16 + ux * 4.5, 16 + uy * 4.5); ctx.lineTo(16 + ux * 12.5, 16 + uy * 12.5);
        ctx.moveTo(16 + ux * 8.5 + px * 3.5, 16 + uy * 8.5 + py * 3.5); ctx.lineTo(16 + ux * 12.5, 16 + uy * 12.5); ctx.lineTo(16 + ux * 8.5 - px * 3.5, 16 + uy * 8.5 - py * 3.5);
      }
    };
    glowLine('#38d4ff', 'rgba(56,212,255,0.9)', 1.6, path);
    ctx.fillStyle = '#38d4ff'; ctx.beginPath(); ctx.arc(16, 16, 1.6, 0, Math.PI * 2); ctx.fill();
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
html.tf-cur body.mode-land canvas#game, html.tf-cur body.mode-airdrop canvas#game { cursor: var(--tfc-amber); }
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
