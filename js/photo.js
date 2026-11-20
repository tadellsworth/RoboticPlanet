'use strict';
/*
 * Terrafall — photo mode: a picture of your colony.
 *
 * From the pause menu (Photo mode) or Shift+P on a keyboard. The game stands still (a multiplayer game can't stop for
 * one player: it runs on), the whole interface goes, and the map is yours to frame: drag and pinch, the mouse and its
 * wheel, the arrow keys or WASD and + −. A small toolbar fades once it's left alone (a tap on the map, a mouse move or
 * a key brings it back): a Time of day slider (looks only: TOD.over, see daynight.js; the game's clock and S are
 * untouched, and it's let go on the way out), Borders and Minimap (both off unless asked for, remembered on this
 * device), Save picture and Exit. Esc, the phone's Back button, Exit or Shift+P leave it, back where you came from.
 *
 * Nothing here changes the game. What the picture leaves out (the selection, range rings, a Paths plan, a building
 * being placed, badges and health bars) is set aside only while the map is drawn and put straight back (photoRender,
 * R.clean); taps and drags on the map only move it (inputSwap).
 *
 * Save picture: the map drawn again at the screen's full resolution (R.dpr may be lower while the game runs, to keep
 * it smooth), with the minimap if it's showing and a small Terrafall mark in the corner, as a PNG (toBlob). In claude.ai
 * the page asks the viewer first (the `downloads` capability, as Download save file does); elsewhere it's an
 * ordinary download.
 */

const PHOTO = { prefs: null, timer: 0, msgTimer: 0, saving: false };
const PHOTO_IDLE = 3200;       // ms the toolbar stays with nothing done before it fades
const PHOTO_MAX_PX = 16.7e6;   // the picture's pixels at most (the largest canvas some browsers allow)
const PHOTO_PREFS_KEY = 'terrafall.photo';

/** Photo mode's switches, kept on this device: { borders, mm }. */
function photoPrefs() {
  let p = null;
  try { p = JSON.parse(localStorage.getItem(PHOTO_PREFS_KEY) || 'null'); } catch (e) { p = null; }
  return { borders: !!(p && p.borders), mm: !!(p && p.mm) };
}
function photoKeepPrefs() { try { localStorage.setItem(PHOTO_PREFS_KEY, JSON.stringify(PHOTO.prefs)); } catch (e) { /* storage unavailable */ } }

/** Give the map's input handlers (INPUT, input.js) new ones; the old ones come back, to be put back later. */
function inputSwap(h) {
  const old = {};
  for (const k in h) { old[k] = INPUT[k]; INPUT[k] = h[k]; }
  return old;
}
const PHOTO_INPUT = { onTap: () => photoTapMap(), onPaint: null, onBox: null, onCommand: null, onGrab: null, onHover: null, canBox: () => false, canPaint: () => false };

/** Into photo mode (from the pause menu or Shift+P). */
function photoEnter() {
  if (!UI.inGame || !S || UI.photo) return;
  const fromPause = !$('screen-pause').hidden;
  $('screen-pause').hidden = true;
  $('speed-menu').hidden = true;
  hideGoodTip();
  if (UI.briefing) closeBriefing();
  const P = PHOTO.prefs || (PHOTO.prefs = photoPrefs());
  UI.photo = { fromPause, paused: UI.paused, clean: R.clean, mm: MM.on, input: inputSwap(PHOTO_INPUT) };
  UI.paused = !MP.on; // (multiplayer runs on: everyone plays at one pace)
  INPUT.boxArmed = false; R.box = null; R.hover = -1;
  R.clean = 2;
  R.terrOff = !P.borders;
  if (P.mm) MM.on = true; // (for the picture: the player's own minimap setting isn't touched)
  document.body.classList.add('photo');
  document.body.classList.toggle('photo-mm', P.mm);
  photoTodReset();
  photoSync();
  $('photo-bar').hidden = false;
  placeMinimap();
  photoMsg(onTouch() ? 'Drag to frame it, pinch to zoom. Tap the map to hide or show this bar.' : 'Drag or use the arrow keys to frame it; scroll to zoom. Esc leaves.', 5000);
  photoWake();
  R.dirty = true;
  sfx('click');
}

/** Out of photo mode: everything as it was (the time of day, the minimap, the pause menu if that's where it came from). */
function photoExit() {
  const ph = UI.photo;
  if (!ph) return;
  UI.photo = null;
  TOD.over = null;
  R.clean = ph.clean;
  R.terrOff = false;
  MM.on = ph.mm;
  Object.assign(INPUT, ph.input);
  INPUT.gesture = null; R.box = null;
  document.body.classList.remove('photo', 'photo-mm');
  clearTimeout(PHOTO.timer); clearTimeout(PHOTO.msgTimer);
  $('photo-bar').hidden = true;
  $('photo-bar').classList.remove('faded');
  UI.paused = ph.paused;
  if (UI.inGame) {
    placeMinimap();
    if (ph.fromPause) { UI.paused = !MP.on; mpSyncPauseMenu(); syncSaved(); $('screen-pause').hidden = false; }
  }
  R.dirty = true;
}

/** Draw the map for the picture: no selection, range rings, plans, placing or hover marks (they're put back after). */
function photoRender(dt) {
  const keep = {
    mode: R.mode, selected: R.selected, ghost: R.ghost, routePreview: R.routePreview, selTile: R.selTile, box: R.box, hover: R.hover,
    workerView: R.workerView, traffic: R.traffic, ropeEnd: R.ropeEnd,
    selSet: UI.selSet, selBot: UI.selBot, planKept: UI.planKept, sheetKind: UI.sheetKind, ropeA: UI.ropeA,
  };
  R.mode = 'normal'; R.selected = 0; R.ghost = null; R.routePreview = null; R.selTile = -1; R.box = null; R.hover = -1;
  R.workerView = false; R.traffic = false; R.ropeEnd = null;
  UI.selSet = null; UI.selBot = 0; UI.planKept = false; UI.sheetKind = null; UI.ropeA = null;
  try { render(dt); } finally {
    R.mode = keep.mode; R.selected = keep.selected; R.ghost = keep.ghost; R.routePreview = keep.routePreview; R.selTile = keep.selTile; R.box = keep.box; R.hover = keep.hover;
    R.workerView = keep.workerView; R.traffic = keep.traffic; R.ropeEnd = keep.ropeEnd;
    UI.selSet = keep.selSet; UI.selBot = keep.selBot; UI.planKept = keep.planKept; UI.sheetKind = keep.sheetKind; UI.ropeA = keep.ropeA;
  }
}

/* ------------------------------------------------------------------ the toolbar */

/** The length of the day-and-night cycle, in seconds (TOD_CYCLE). */
function photoDayLen() { return TOD_CYCLE.reduce((n, p) => n + p[p.length - 1], 0) * 60; }

/** The slider starts at the light on screen now: the game's time of day (or midday, or midnight, as the setting has it). */
function photoTodReset() {
  const len = photoDayLen(), el = $('pb-time');
  el.max = len;
  const v = todMode() === 'night' ? len * 0.83 : !todEnabled() ? len * 0.29 : ((S.time % len) + len) % len;
  el.value = Math.round(v);
  photoTodLabel(+el.value);
}
function photoTodLabel(t) {
  const st = todAt(t);
  $('pb-time-v').textContent = TOD_NAMES[st.name] || 'Day';
  $('pb-time-v').dataset.tod = st.name;
}

/** The toolbar's switches as they are. */
function photoSync() {
  const P = PHOTO.prefs;
  $('pb-borders').setAttribute('aria-pressed', P.borders ? 'true' : 'false');
  $('pb-mm').setAttribute('aria-pressed', P.mm ? 'true' : 'false');
}

/** A line on the toolbar (`ms`: for that long). */
function photoMsg(text, ms) {
  const el = $('pb-msg');
  clearTimeout(PHOTO.msgTimer);
  el.textContent = text || '';
  el.hidden = !text;
  if (text && ms) PHOTO.msgTimer = setTimeout(() => { el.hidden = true; }, ms);
  if (text) photoWake();
}

/** Show the toolbar, and fade it again after a while left alone. */
function photoWake() {
  if (!UI.photo) return;
  $('photo-bar').classList.remove('faded');
  clearTimeout(PHOTO.timer);
  PHOTO.timer = setTimeout(photoFade, PHOTO_IDLE);
}
function photoFade() {
  if (!UI.photo) return;
  const bar = $('photo-bar'), a = document.activeElement;
  // (not under the mouse, while the slider is held, a picture is being made, or the keyboard is on one of its buttons)
  if (bar.matches(':hover') || PHOTO.saving || PHOTO.held || (a && bar.contains(a) && a.matches(':focus-visible'))) { photoWake(); return; }
  bar.classList.add('faded');
}

/** A tap on the map: the toolbar comes and goes (under a finger). */
function photoTapMap() {
  if (!UI.photo) return;
  if (INPUT.mouse) { photoWake(); return; } // (a mouse brings it back by moving: a click doesn't hide it)
  if ($('photo-bar').classList.contains('faded')) photoWake();
  else { clearTimeout(PHOTO.timer); $('photo-bar').classList.add('faded'); }
}

/* ------------------------------------------------------------------ the picture */

/**
 * The picture, on a canvas of its own: the map drawn at the screen's full resolution (up to 3 device pixels to a
 * CSS pixel, and PHOTO_MAX_PX in all), the minimap where it shows (if it's on), and the Terrafall mark.
 */
function photoCanvas() {
  const cv = R.canvas, keep = { dpr: R.dpr, w: cv.width, h: cv.height };
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1, Math.sqrt(PHOTO_MAX_PX / Math.max(1, R.w * R.h))));
  const W = Math.round(R.w * dpr), H = Math.round(R.h * dpr);
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const x = out.getContext('2d');
  // (Drawn and put back in one go: the screen never shows the canvas at the other size.)
  try {
    R.dpr = dpr; cv.width = W; cv.height = H;
    photoRender(0);
    x.drawImage(cv, 0, 0);
  } finally {
    R.dpr = keep.dpr; cv.width = keep.w; cv.height = keep.h;
    photoRender(0);
  }
  const mm = MM.canvas, box = PHOTO.prefs.mm && mm && !$('minimap').hidden ? mm.getBoundingClientRect() : null;
  if (box && box.width > 0) {
    const r = 9 * dpr, bx = box.left * dpr, by = box.top * dpr, bw = box.width * dpr, bh = box.height * dpr;
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 14 * dpr; x.shadowOffsetY = 5 * dpr;
    roundRect(x, bx, by, bw, bh, r); x.fillStyle = '#0c0d11'; x.fill();
    x.restore();
    x.save();
    roundRect(x, bx, by, bw, bh, r); x.clip();
    x.drawImage(mm, bx, by, bw, bh);
    x.restore();
    roundRect(x, bx + 0.5 * dpr, by + 0.5 * dpr, bw - dpr, bh - dpr, r);
    x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = dpr; x.stroke();
  }
  photoMark(x, W, H, dpr);
  return out;
}

/** The Terrafall mark, bottom right: the app icon's ringed planet and the name, small and a little see-through. */
function photoMark(x, W, H, k) {
  const size = 13 * k, pad = 14 * k, r = 7 * k;
  x.save();
  x.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  if ('letterSpacing' in x) x.letterSpacing = `${0.16 * size}px`;
  x.textBaseline = 'middle'; x.textAlign = 'right';
  const tx = W - pad, ty = H - pad - size * 0.55, tw = x.measureText('TERRAFALL').width;
  const cx = tx - tw - r * 1.9, cy = ty;
  x.shadowColor = 'rgba(0,0,0,0.7)'; x.shadowBlur = 5 * k; x.shadowOffsetY = k;
  x.globalAlpha = 0.9;
  x.fillStyle = '#ff6b4a';
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.shadowColor = 'transparent';
  x.strokeStyle = '#f1e4d3'; x.lineWidth = 1.4 * k;
  x.beginPath(); x.ellipse(cx, cy + 0.6 * k, r * 1.7, r * 0.45, -0.25, 0, Math.PI * 2); x.stroke();
  x.fillStyle = '#ff6b4a';
  x.beginPath(); x.arc(cx, cy, r, Math.PI * 1.02, Math.PI * 1.98); x.fill(); // (the planet in front of the ring's far side)
  x.shadowColor = 'rgba(0,0,0,0.7)';
  x.fillStyle = '#f6efe6';
  x.fillText('TERRAFALL', tx, ty);
  x.restore();
}

/** The picture as a PNG (null if this browser can't make one: a canvas drawn from art of another site, say). */
function photoBlob() {
  return new Promise((done) => {
    let c = null;
    try { c = photoCanvas(); c.toBlob((b) => { done(b); c.width = c.height = 0; }, 'image/png'); } catch (e) { if (c) c.width = c.height = 0; done(null); }
  });
}

/** Save picture: terrafall-<planet>-<date>-<time>.png. */
async function photoSave() {
  if (!UI.photo || PHOTO.saving) return;
  PHOTO.saving = true;
  $('pb-save').disabled = true;
  photoMsg('Making the picture…');
  try {
    const blob = await photoBlob();
    if (!blob) { photoMsg('This browser can\'t save a picture of the map here.', 6000); return; }
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    const name = `terrafall-${S.seed}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
    const said = await photoOffer(name, blob);
    photoMsg(said, 6000);
    if (/^Saved/.test(said)) sfx('place');
  } finally {
    PHOTO.saving = false;
    $('pb-save').disabled = false;
  }
}

/** Offer a file the way Download save file does (claude.ai asks the viewer first); what to say about how it went. */
async function photoOffer(name, blob) {
  const ok = `Saved ${name}.`, no = 'Downloads aren\'t possible here.';
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data: blob }); return ok; } catch (e) {
      const c = e && e.code;
      if (c === 'declined') return 'Download cancelled.';
      if (c === 'rate_limited') return 'A download is already waiting for your OK.';
      return plainDownload(name, blob) ? ok : no;
    }
  }
  return plainDownload(name, blob) ? ok : no;
}

/* ------------------------------------------------------------------ setup */

function initPhoto() {
  $('p-photo').onclick = () => photoEnter();
  $('pb-exit').onclick = () => { sfx('click'); photoExit(); };
  $('pb-save').onclick = () => photoSave();
  $('pb-borders').onclick = () => {
    const P = PHOTO.prefs; P.borders = !P.borders; photoKeepPrefs(); photoSync();
    R.terrOff = !P.borders; R.dirty = true; sfx('click');
  };
  $('pb-mm').onclick = () => {
    const P = PHOTO.prefs; P.mm = !P.mm; photoKeepPrefs(); photoSync();
    MM.on = P.mm || UI.photo.mm;
    document.body.classList.toggle('photo-mm', P.mm);
    placeMinimap(); R.dirty = true; sfx('click');
  };
  const t = $('pb-time');
  t.addEventListener('input', () => { if (!UI.photo) return; TOD.over = +t.value; photoTodLabel(TOD.over); R.dirty = true; photoWake(); });
  t.addEventListener('pointerdown', () => { PHOTO.held = true; });
  for (const ev of ['pointerup', 'pointercancel', 'blur']) t.addEventListener(ev, () => { PHOTO.held = false; });
  // Anything done on the toolbar, or the mouse moving anywhere, keeps it in view. (A finger dragging the map doesn't.)
  $('photo-bar').addEventListener('pointerdown', () => photoWake());
  $('photo-bar').addEventListener('focusin', () => photoWake());
  window.addEventListener('pointermove', (e) => { if (UI.photo && e.pointerType === 'mouse') photoWake(); });
  // Keys (before the game's own: see initKeyboard). Shift+P opens it from the map; in it, Esc or Shift+P leaves, the
  // arrow keys, WASD and + − move and zoom the map, and no other key reaches the game (Space would pause, a letter
  // would open a menu out of sight). A key on the toolbar's own buttons and slider still does what it does there.
  window.addEventListener('keydown', (e) => {
    if (!UI.inGame) return;
    const k = (e.key || '').toLowerCase(), plain = !e.ctrlKey && !e.metaKey && !e.altKey;
    const tag = (e.target && e.target.tagName) || '';
    if (!UI.photo) {
      if (k === 'p' && e.shiftKey && plain && !topScreen() && !UI.briefing && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault(); e.stopPropagation(); photoEnter();
      }
      return;
    }
    if (!$('screen-keys').hidden || (plain && k === SHORTCUT_SHEET_KEY)) return;
    if (k === 'escape' || (k === 'p' && e.shiftKey && plain)) { e.preventDefault(); e.stopPropagation(); photoExit(); return; }
    photoWake();
    if (e.altKey && k === 'enter') return; // (full screen)
    if (plain && (PAN_KEYS[k] || k === '+' || k === '=' || k === '-' || k === '_') && tag !== 'INPUT') return;
    e.stopPropagation();
  }, true);
}

initPhoto();
