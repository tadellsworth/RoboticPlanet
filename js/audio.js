'use strict';
/*
 * Terrafall — audio, all made live with Web Audio (no audio files).
 *
 * Effects: short synthesized sounds for the interface and the battle, plus sounds from the map
 * that play when they're on screen (louder zoomed in, panned left or right): the hum of traffic,
 * builders welding, workers spreading concrete, Pavers laying hot asphalt, Freight Truck air brakes
 * and horns in jams, and the wind of each biome (with birds and insects in the jungle).
 *
 * Music: a generative synthwave score that follows the game. A slow theme on the menu, a calm
 * groove while you build, a driving track when you're under attack or at war, and an alarm while a
 * nuclear missile is in the air. It's written a bar at a time from chord progressions, arpeggios,
 * bass lines, drum patterns and short melodies, arranged in 8-bar sections that bring parts in and
 * out, so it never loops exactly.
 *
 * Volumes (Music and Effects, 0..1) are set in the pause menu and remembered on this device.
 */

const AUDIO = { ctx: null, on: true, last: {}, music: 0.55, fx: 0.8, suppress: false };
try {
  const saved = JSON.parse(localStorage.getItem('botfall.audio') || '{}');
  if (typeof saved.music === 'number') AUDIO.music = saved.music;
  if (typeof saved.fx === 'number') AUDIO.fx = saved.fx;
} catch (e) { /* defaults */ }

function saveAudio() {
  try { localStorage.setItem('botfall.audio', JSON.stringify({ music: AUDIO.music, fx: AUDIO.fx })); } catch (e) { /* storage unavailable */ }
}

/** Set the Music or Effects volume (0..1). */
function setVolume(kind, v) {
  AUDIO[kind] = clampV(v);
  saveAudio();
  const ac = AUDIO.ctx;
  if (!ac) return;
  if (kind === 'fx' && AUDIO.fxBus) AUDIO.fxBus.gain.setTargetAtTime(AUDIO.fx, ac.currentTime, 0.05);
  if (kind === 'music' && AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(AUDIO.music * MUSIC_LEVEL, ac.currentTime, 0.05);
}
function clampV(v) { return Math.max(0, Math.min(1, +v || 0)); }

const MUSIC_LEVEL = 0.95; // the music bus at full Music volume

/** Browsers only start audio from a tap or key press: called on the first one (and on Start). */
function audioUnlock() {
  if (AUDIO.ctx) { if (AUDIO.ctx.state === 'suspended' && !document.hidden) AUDIO.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    AUDIO.ctx = new AC();
    buildAudioGraph(AUDIO.ctx);
    musicStart();
  } catch (e) { AUDIO.ctx = null; }
}

if (typeof window !== 'undefined' && window.addEventListener) {
  const first = () => audioUnlock();
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
  window.addEventListener('touchend', first, true);
  // Nothing plays while the game is in the background.
  document.addEventListener('visibilitychange', () => {
    if (!AUDIO.ctx) return;
    if (document.hidden) AUDIO.ctx.suspend(); else AUDIO.ctx.resume();
  });
}

/*
 * The mixer: effects and music each have a bus (their volume sliders) into a master compressor.
 * The music has its own reverb and a tempo-synced echo, a filter that muffles it while paused, and
 * a gain that ducks it under big explosions.
 */
function buildAudioGraph(ac) {
  const A = AUDIO;
  A.master = ac.createGain();
  A.master.gain.value = 0.9;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
  A.master.connect(comp).connect(ac.destination);

  A.fxBus = ac.createGain();
  A.fxBus.gain.value = A.fx;
  A.fxBus.connect(A.master);

  A.musicBus = ac.createGain();
  A.musicBus.gain.value = A.music * MUSIC_LEVEL;
  A.musicDuck = ac.createGain();
  A.musicLP = ac.createBiquadFilter();
  A.musicLP.type = 'lowpass';
  A.musicLP.frequency.value = 18000;
  A.musicBus.connect(A.musicDuck).connect(A.musicLP).connect(A.master);

  // Music sends: dry, reverb and echo. Pads go through their own gain so the kick can pump them.
  A.mDry = ac.createGain(); A.mDry.connect(A.musicBus);
  A.mPad = ac.createGain(); A.mPad.connect(A.mDry);
  A.mVerbIn = ac.createGain();
  const verb = ac.createConvolver();
  verb.buffer = makeImpulse(ac, 2.8);
  const verbOut = ac.createGain(); verbOut.gain.value = 0.55;
  A.mVerbIn.connect(verb).connect(verbOut).connect(A.musicBus);
  A.mEchoIn = ac.createGain();
  A.mEcho = ac.createDelay(2);
  A.mEcho.delayTime.value = 0.45;
  const fb = ac.createGain(); fb.gain.value = 0.33;
  const echoLP = ac.createBiquadFilter(); echoLP.type = 'lowpass'; echoLP.frequency.value = 2600;
  const echoOut = ac.createGain(); echoOut.gain.value = 0.45;
  A.mEchoIn.connect(A.mEcho).connect(echoLP).connect(fb).connect(A.mEcho);
  echoLP.connect(echoOut).connect(A.musicBus);

  // Two seconds of white noise, shared by every noisy sound.
  A.noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const d = A.noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

/** A reverb tail: decaying stereo noise. */
function makeImpulse(ac, secs) {
  const len = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < ac.sampleRate * 0.012 ? i / (ac.sampleRate * 0.012) : 1);
  }
  return buf;
}

function midiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

/* ------------------------------------------------------------------ sound effects */

/** A pitched blip into `dest` (the effects bus by default). */
function _tone(freq, dur, type, vol, slideTo, delay, dest) {
  const ac = AUDIO.ctx;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest || AUDIO.fxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/**
 * A burst of filtered noise. o: { type: 'lowpass' | 'highpass' | 'bandpass', freq, to (filter
 * sweep), q, attack, delay, dest }.
 */
function _noise(dur, vol, o) {
  o = o || {};
  const ac = AUDIO.ctx, t0 = ac.currentTime + (o.delay || 0);
  const src = ac.createBufferSource();
  src.buffer = AUDIO.noise;
  src.loop = true;
  const f = ac.createBiquadFilter();
  f.type = o.type || 'lowpass';
  f.frequency.setValueAtTime(o.freq || 900, t0);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
  if (o.q) f.Q.value = o.q;
  const g = ac.createGain(), a = o.attack || 0.005;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(o.dest || AUDIO.fxBus);
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

const SFX_GAP = {
  launch: 0.3, boom: 0.12, laser: 0.08, hit: 0.07, produce: 0.25, alert: 1.5, complete: 0.3, order: 0.15,
  weld: 0.25, scrape: 0.3, hiss: 0.6, airbrake: 1.2, honk: 2.5, nuke: 2, siren: 4,
};

function sfxReady() { return AUDIO.on && !AUDIO.suppress && AUDIO.ctx && AUDIO.ctx.state === 'running' && AUDIO.fx > 0; }

/** Play a sound effect (dest: an optional node, e.g. a panner for a sound on the map). */
function sfx(name, dest) {
  if (!sfxReady()) return;
  const now = AUDIO.ctx.currentTime;
  if (now - (AUDIO.last[name] || -9) < (SFX_GAP[name] || 0.05)) return;
  AUDIO.last[name] = now;
  const D = dest || AUDIO.fxBus;
  switch (name) {
    case 'click': _tone(720, 0.06, 'triangle', 0.06, null, 0, D); break;
    case 'place': _tone(440, 0.08, 'triangle', 0.08, null, 0, D); _tone(660, 0.1, 'triangle', 0.08, null, 0.07, D); break;
    case 'complete': _tone(523, 0.1, 'sine', 0.08, null, 0, D); _tone(659, 0.1, 'sine', 0.08, null, 0.08, D); _tone(784, 0.16, 'sine', 0.08, null, 0.16, D); break;
    case 'produce': _tone(980, 0.05, 'sine', 0.035, null, 0, D); break;
    case 'laser': _tone(1400, 0.14, 'sawtooth', 0.035, 300, 0, D); break;
    case 'hit': _tone(220, 0.05, 'square', 0.03, 120, 0, D); break;
    case 'boom':
      _noise(0.45, 0.2, { freq: 900, to: 120, dest: D });
      _tone(110, 0.35, 'sine', 0.16, 38, 0, D);
      duckMusic(0.6, 0.6);
      break;
    case 'alert': _tone(880, 0.12, 'square', 0.05, null, 0, D); _tone(660, 0.12, 'square', 0.05, null, 0.15, D); break;
    case 'launch': _noise(0.6, 0.12, { freq: 2200, to: 600, dest: D }); _tone(180, 0.6, 'sawtooth', 0.05, 520, 0, D); break;
    case 'capture': _tone(392, 0.12, 'triangle', 0.09, null, 0, D); _tone(587, 0.2, 'triangle', 0.09, null, 0.1, D); break;
    case 'error': _tone(200, 0.12, 'square', 0.05, 150, 0, D); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.25, 'triangle', 0.09, null, i * 0.14, D)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => _tone(f, 0.3, 'triangle', 0.09, null, i * 0.18, D)); break;
    // Orders acknowledged over the radio: two quick blips through a narrow band.
    case 'order': {
      const bp = AUDIO.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 3; bp.connect(D);
      _tone(1180, 0.05, 'square', 0.07, null, 0, bp); _tone(1580, 0.07, 'square', 0.07, null, 0.08, bp);
      _noise(0.16, 0.025, { type: 'bandpass', freq: 2000, q: 1, delay: 0.17, dest: bp });
      break;
    }
    // A builder welding: a crackle of sparks.
    case 'weld':
      for (let k = 0; k < 5; k++) _noise(0.02 + Math.random() * 0.04, 0.05 + Math.random() * 0.05, { type: 'highpass', freq: 3500 + Math.random() * 3000, delay: Math.random() * 0.35, dest: D });
      _tone(2900, 0.05, 'square', 0.012, null, 0.1, D);
      break;
    // Fresh concrete spread across a road tile.
    case 'scrape': _noise(0.22, 0.06, { type: 'bandpass', freq: 600, to: 1400, q: 0.8, attack: 0.04, dest: D }); break;
    // Hot asphalt laid by a Paver: a soft steamy hiss.
    case 'hiss': _noise(0.7, 0.035, { type: 'highpass', freq: 3500, to: 6000, attack: 0.12, dest: D }); break;
    // A Freight Truck's air brakes.
    case 'airbrake':
      _tone(170, 0.06, 'square', 0.03, 90, 0, D);
      _noise(0.45, 0.06, { type: 'highpass', freq: 2500, to: 5000, attack: 0.01, delay: 0.04, dest: D });
      break;
    // A Freight Truck's horn, stuck in traffic.
    case 'honk': {
      const lp = AUDIO.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(D);
      for (const [f, dl] of [[311, 0], [370, 0], [311, 0.3], [370, 0.3]]) _tone(f, 0.22, 'sawtooth', 0.035, f * 0.98, dl, lp);
      break;
    }
    // A nuclear missile coming for you: an air-raid siren, rising and falling.
    case 'siren': {
      const ac = AUDIO.ctx, t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(380, t0);
      for (let k = 0; k < 3; k++) { o.frequency.linearRampToValueAtTime(980, t0 + k * 1.6 + 0.9); o.frequency.linearRampToValueAtTime(380, t0 + k * 1.6 + 1.6); }
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.3); g.gain.setValueAtTime(0.05, t0 + 4.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 4.8);
      o.connect(lp).connect(g).connect(D);
      o.start(t0); o.stop(t0 + 4.9);
      break;
    }
    // A nuclear detonation: a long, deep rumble with a sub drop (the music ducks under it).
    case 'nuke':
      _noise(0.08, 0.35, { type: 'highpass', freq: 800, dest: D });
      _noise(4.5, 0.5, { freq: 1200, to: 60, attack: 0.02, dest: D });
      _tone(70, 3.2, 'sine', 0.45, 22, 0, D);
      _tone(140, 1.2, 'triangle', 0.15, 40, 0.05, D);
      duckMusic(0.15, 5);
      break;
  }
}

/** Duck the music for `secs`, down to `to` of its level. */
function duckMusic(to, secs) {
  const ac = AUDIO.ctx;
  if (!ac || !AUDIO.musicDuck) return;
  const g = AUDIO.musicDuck.gain, t = ac.currentTime;
  g.cancelScheduledValues(t);
  g.setTargetAtTime(to, t, 0.03);
  g.setTargetAtTime(1, t + secs * 0.4, secs * 0.25);
}

/* ------------------------------------------------------------------ sounds from the map */

/** Where on screen (wx, wy) is: a panner and gain for it, or null if it's off screen. */
function mapVoice(wx, wy, vol) {
  if (typeof R === 'undefined' || !R.w) return null;
  const p = worldToScreen(wx, wy);
  if (p.x < -40 || p.y < -40 || p.x > R.w + 40 || p.y > R.h + 40) return null;
  const ac = AUDIO.ctx, g = ac.createGain();
  g.gain.value = (vol || 1) * zoomLoud();
  if (ac.createStereoPanner) {
    const pan = ac.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, (p.x / R.w) * 2 - 1));
    g.connect(pan).connect(AUDIO.fxBus);
  } else g.connect(AUDIO.fxBus);
  // The voice disconnects itself once its sounds are long done.
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 6000);
  return g;
}

/** Map sounds are louder zoomed in, quiet zoomed right out. */
function zoomLoud() { return Math.max(0.15, Math.min(1, (R.cam.z - 10) / 40)); }

const WORLD = { t: 0, honk: {}, brake: {}, mood: 0, bed: null };

/** Every frame: the music's mood, and the sounds of what's on screen (a few times a second). */
function audioTick(dt) {
  const ac = AUDIO.ctx;
  if (!ac || ac.state !== 'running') return;
  WORLD.t -= dt;
  WORLD.mood -= dt;
  if (WORLD.mood <= 0) { WORLD.mood = 0.5; MUSIC.want = musicMood(); }
  const inGame = typeof UI !== 'undefined' && UI.inGame && S;
  // Paused: the music sounds far away.
  const muffle = !!(inGame && UI.paused);
  if (muffle !== WORLD.muffled) { WORLD.muffled = muffle; AUDIO.musicLP.frequency.setTargetAtTime(muffle ? 900 : 18000, ac.currentTime, 0.25); }
  WORLD.bt = (WORLD.bt || 0) - dt;
  if (WORLD.bt <= 0) { updateBeds(!!(inGame && !UI.paused && S.winner < 0), 0.25 - WORLD.bt); WORLD.bt = 0.25; }
  if (!inGame || UI.paused || S.winner >= 0 || WORLD.t > 0) return;
  WORLD.t = 0.3;
  if (!sfxReady()) return;
  const v0 = screenToWorld(0, 0), v1 = screenToWorld(R.w, R.h);
  const on = (x, y) => x > v0.x - 1 && x < v1.x + 1 && y > v0.y - 1 && y < v1.y + 1;
  let welders = [], pavers = [], spreaders = [], moving = 0, trucks = 0;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== 0 || !on(u.x, u.y)) continue;
    const t = u.task;
    if (u.path && u.moved) { moving++; if (BOTS[u.type].truck) trucks++; }
    if (t && t.type === 'build' && t.phase === 'work') welders.push(u);
    else if (t && t.type === 'pave' && t.phase === 'work') spreaders.push(u);
    else if (t && t.type === 'staff' && t.phase === 'work' && u.type === 'paver') pavers.push(u);
    if (BOTS[u.type].truck) {
      // Air brakes when a truck pulls up hard; the horn when it's been stuck in a jam a while.
      if (u.drive < 0 && (u.vel || 0) > 0.6 && S.time - (WORLD.brake[u.id] || -99) > 6) { WORLD.brake[u.id] = S.time; at(u, 'airbrake', 0.9); }
      WORLD.honk[u.id] = u.path && !u.moved ? (WORLD.honk[u.id] || 0) + 0.3 : 0;
      if (WORLD.honk[u.id] > 3) { WORLD.honk[u.id] = -8; at(u, 'honk', 0.9); }
    }
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (welders.length && Math.random() < 0.25 + 0.15 * welders.length) at(pick(welders), 'weld', 0.8);
  if (spreaders.length && Math.random() < 0.3 + 0.1 * spreaders.length) at(pick(spreaders), 'scrape', 0.9);
  if (pavers.length && Math.random() < 0.4) at(pick(pavers), 'hiss', 1);
  WORLD.moving = moving; WORLD.trucks = trucks;
}

function at(u, name, vol) {
  const v = mapVoice(u.x, u.y, vol);
  if (v) sfx(name, v);
}

/*
 * Two steady beds under everything: the hum of the traffic on screen (deeper with trucks), and the
 * wind of the biome, gusting. In the jungle, birds and insects call now and then.
 */
function updateBeds(live, dt) {
  const ac = AUDIO.ctx, A = AUDIO, t = ac.currentTime;
  if (!WORLD.bed) {
    const hum = ac.createGain(); hum.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
    const o1 = ac.createOscillator(), o2 = ac.createOscillator(), o3 = ac.createOscillator();
    o1.type = 'sawtooth'; o1.frequency.value = 52; o2.type = 'sawtooth'; o2.frequency.value = 78.5; o3.type = 'triangle'; o3.frequency.value = 36;
    const g3 = ac.createGain(); g3.gain.value = 0;
    o1.connect(lp); o2.connect(lp); o3.connect(g3).connect(lp);
    lp.connect(hum).connect(A.fxBus);
    o1.start(); o2.start(); o3.start();
    const wind = ac.createBufferSource(); wind.buffer = A.noise; wind.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
    const wg = ac.createGain(); wg.gain.value = 0;
    wind.connect(bp).connect(wg).connect(A.fxBus);
    wind.start();
    WORLD.bed = { hum, g3, lp, bp, wg, gust: 0, chirp: 3 };
  }
  const B = WORLD.bed;
  const zl = live ? zoomLoud() : 0;
  B.hum.gain.setTargetAtTime(live ? Math.min(0.05, 0.006 * (WORLD.moving || 0)) * zl : 0, t, 0.4);
  B.g3.gain.setTargetAtTime(Math.min(1, (WORLD.trucks || 0) * 0.5), t, 0.4);
  B.lp.frequency.setTargetAtTime(160 + Math.min(200, (WORLD.moving || 0) * 8), t, 0.5);
  const b = typeof biome === 'function' && S ? biome() : 'desert';
  const wind = { desert: [480, 0.7, 0.03], jungle: [320, 0.6, 0.016], polar: [1100, 2.2, 0.035] }[b] || [480, 0.7, 0.03];
  B.gust -= dt;
  if (B.gust <= 0) {
    // A new gust every few seconds: the wind swells, drops and changes pitch.
    B.gust = 2 + Math.random() * 4;
    B.bp.frequency.setTargetAtTime(wind[0] * (0.7 + Math.random() * 0.7), t, 1.2);
    B.bp.Q.value = wind[1];
  }
  const windLevel = live ? wind[2] * (0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1)) + wind[2] * 0.5 : 0;
  B.wg.gain.setTargetAtTime(windLevel, t, 0.8);
  if (live && b === 'jungle') {
    B.chirp -= dt;
    if (B.chirp <= 0) { B.chirp = 2 + Math.random() * 6; jungleCall(); }
  }
}

/** A bird or an insect somewhere in the jungle. */
function jungleCall() {
  if (!sfxReady()) return;
  const ac = AUDIO.ctx, pan = ac.createStereoPanner ? ac.createStereoPanner() : null, g = ac.createGain();
  g.gain.value = 0.5;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan).connect(AUDIO.fxBus); } else g.connect(AUDIO.fxBus);
  if (Math.random() < 0.5) {
    // A bird: two or three falling whistles.
    const base = 1700 + Math.random() * 1400;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) _tone(base, 0.12, 'sine', 0.025, base * 0.7, k * 0.17, g);
  } else {
    // An insect: a fast trill.
    const f = 4000 + Math.random() * 2500;
    for (let k = 0; k < 8; k++) _tone(f, 0.025, 'triangle', 0.012, f * 1.04, k * 0.035, g);
  }
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 3000);
}

/* ------------------------------------------------------------------ music */

/** Which mood the music should be in right now. */
function musicMood() {
  if (typeof UI === 'undefined' || !UI.inGame || !S) return 'menu';
  if (S.winner >= 0) return 'end';
  if (S.missiles.some((m) => m.nuke)) return 'nuke';
  if (MUSIC.of !== S) { MUSIC.of = S; MUSIC.warUntil = 0; }
  // Under attack, raiders in your land, or your warbots in a fight: war, for at least 40 s after.
  let threat = 0;
  for (const b of S.buildings) if (!b.dead && b.owner === 0 && S.time - (b.lastHit ?? -99) < 8) threat += 2;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.type !== 'warbot') continue;
    if (u.owner !== 0 && S.owner[Math.floor(u.y) * S.W + Math.floor(u.x)] === 0) threat++;
    else if (u.owner === 0 && u.fight) threat++;
  }
  if (threat >= 3) MUSIC.warUntil = S.time + 40;
  return S.time < MUSIC.warUntil ? 'war' : 'build';
}

const MINOR = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], dim: [0, 3, 6] };

/** Each mood: tempo, keys (MIDI note of the root, octave 3), scale, chord progressions, and its arrangements. */
const MOODS = {
  menu: {
    bpm: 84, keys: [57, 55], scale: MINOR, chordBars: 2,
    progs: [[[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], [[0, 'm7'], [5, 'm'], [8, 'M7'], [10, 'M']]],
    arrange: [['pad', 'arp8'], ['pad', 'arp8', 'bassW'], ['pad', 'arp8', 'bassW', 'lead'], ['pad', 'lead', 'bassW']],
  },
  build: {
    bpm: 96, keys: [57, 55, 59, 52], scale: MINOR, chordBars: 1,
    progs: [[[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], [[0, 'm'], [10, 'M'], [8, 'M'], [10, 'M']], [[0, 'm7'], [5, 'm'], [8, 'M7'], [7, 'M']], [[8, 'M7'], [10, 'M'], [0, 'm'], [0, 'm7']]],
    arrange: [
      ['pad', 'arp'],
      ['pad', 'arp', 'bass', 'hat'],
      ['pad', 'arp', 'bass', 'kick', 'snare', 'hat'],
      ['pad', 'arp', 'bass', 'kick', 'snare', 'hat', 'lead'],
      ['pad', 'lead', 'hat', 'bassW'],
      ['pad', 'bass', 'kick', 'hat', 'lead'],
    ],
  },
  war: {
    bpm: 112, keys: [52, 53, 55], scale: PHRYGIAN, chordBars: 1,
    progs: [[[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']], [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']], [[0, 'm'], [0, 'm'], [8, 'M'], [10, 'M']]],
    arrange: [
      ['pad', 'bass16', 'kick4', 'hat16', 'snare'],
      ['pad', 'bass16', 'kick4', 'hat16', 'snare', 'stab'],
      ['pad', 'bass16', 'kick4', 'hat16', 'snare', 'lead', 'arp'],
      ['bass16', 'kick4', 'tom', 'hat16', 'stab'],
    ],
  },
  nuke: {
    bpm: 120, keys: [53], scale: PHRYGIAN, chordBars: 2,
    progs: [[[0, 'm'], [1, 'M']]],
    arrange: [['drone', 'alarm', 'heart', 'hat16']],
  },
  end: { bpm: 90, keys: [57], scale: MINOR, chordBars: 1, progs: [[[0, 'm']]], arrange: [[]] },
};

const MUSIC = { timer: 0, next: 0, step: 0, bar: 0, mood: '', want: 'menu', def: null, layers: new Set(), stepDur: 0.15, key: 57, prog: null, sect: 0, arr: 0, of: null, warUntil: 0, motif: null, arpMode: 0, color: false, lastDeg: 7 };

function musicStart() {
  if (MUSIC.timer || !AUDIO.ctx) return;
  MUSIC.next = AUDIO.ctx.currentTime + 0.1;
  MUSIC.timer = setInterval(musicPump, 25);
}

/** Schedule every step that starts in the next 0.2 s (the usual Web Audio look-ahead scheduler). */
function musicPump() {
  const ac = AUDIO.ctx;
  if (!ac || ac.state !== 'running') return;
  if (MUSIC.next < ac.currentTime - 0.05) MUSIC.next = ac.currentTime + 0.05; // back from a pause: don't rush to catch up
  musicSchedule(ac.currentTime + 0.2);
}

function musicSchedule(until) {
  while (MUSIC.next < until) {
    musicStep(MUSIC.next);
    MUSIC.next += MUSIC.stepDur;
  }
}

const rnd = (n) => Math.floor(Math.random() * n);

/** Switch to a new mood: its tempo, a key, a progression, and the first arrangement. */
function musicSetMood(m, t) {
  const d = MOODS[m];
  MUSIC.mood = m; MUSIC.def = d;
  MUSIC.stepDur = 60 / d.bpm / 4;
  MUSIC.key = d.keys[rnd(d.keys.length)];
  MUSIC.prog = d.progs[rnd(d.progs.length)];
  MUSIC.bar = 0; MUSIC.sect = 0; MUSIC.arr = 0;
  MUSIC.layers = new Set(d.arrange[0]);
  MUSIC.arpMode = rnd(3);
  MUSIC.motif = makeMotif();
  if (AUDIO.mEcho) AUDIO.mEcho.delayTime.setValueAtTime(MUSIC.stepDur * 3, t); // a dotted-eighth echo
  if (m === 'war' || m === 'nuke') mCrash(t);
}

/** A new 8-bar section: bring parts in and out, and now and then a new progression. */
function musicSection() {
  const d = MUSIC.def;
  MUSIC.sect++;
  if (d.arrange.length > 1) {
    let a;
    do a = 1 + rnd(d.arrange.length - 1); while (a === MUSIC.arr && d.arrange.length > 2);
    MUSIC.arr = a;
  }
  MUSIC.layers = new Set(d.arrange[MUSIC.arr]);
  if (MUSIC.sect % 2 === 0) MUSIC.prog = d.progs[rnd(d.progs.length)];
  MUSIC.arpMode = rnd(3);
  MUSIC.color = Math.random() < 0.5;
  MUSIC.motif = makeMotif();
}

/** One sixteenth-note step of the score. */
function musicStep(t) {
  const s = MUSIC.step % 16;
  if (s === 0) musicBar(t);
  MUSIC.step++;
  const L = MUSIC.layers, d = MUSIC.def;
  if (!d || !L.size || AUDIO.music <= 0) return;
  const chord = MUSIC.chord, fill = MUSIC.bar % 8 === 7, sd = MUSIC.stepDur;
  const root = MUSIC.key + MUSIC.chordRoot;
  // Drums
  if (L.has('kick') && (s === 0 || s === 8 || (s === 10 && MUSIC.bar % 2 === 1))) mKick(t, 0.9);
  if (L.has('kick4') && s % 4 === 0) mKick(t, 1);
  if (L.has('heart') && (s === 0 || s === 3)) mKick(t, s ? 0.5 : 0.7);
  if (L.has('snare') && (s === 4 || s === 12)) mSnare(t, 1);
  if (L.has('snare') && fill && s >= 13) mSnare(t, 0.4 + (s - 12) * 0.15);
  if (L.has('hat') && s % 4 === 2) mHat(t, s === 14 ? 0.12 : 0.04, 1);
  if (L.has('hat16')) mHat(t, 0.03, s % 2 ? 0.55 : 1);
  if (L.has('tom') && fill && s >= 8 && s % 2 === 0) mTom(t, 140 - (s - 8) * 9);
  // Bass
  if (L.has('bass') && s % 2 === 0) mBass(t, root - 12 + (s % 8 === 6 ? 12 : 0), sd * 1.6);
  if (L.has('bassW') && s === 0) mBass(t, root - 12, sd * 15, true);
  if (L.has('bass16')) mBass(t, root - 12 + (s % 8 === 7 ? 12 : 0), sd * 0.8);
  // Arpeggio: chord tones across two octaves.
  if (L.has('arp') || (L.has('arp8') && s % 2 === 0)) {
    const notes = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
    const k = L.has('arp8') ? s / 2 : s;
    const i = MUSIC.arpMode === 0 ? k % notes.length : MUSIC.arpMode === 1 ? pingPong(k, notes.length) : (k * 5 + MUSIC.bar * 3) % notes.length;
    mArp(t, MUSIC.key + notes[i], s);
  }
  if (L.has('stab') && [0, 3, 6, 10].includes(s)) mStab(t, chord);
  if (L.has('alarm') && s % 4 === 0) mAlarm(t, MUSIC.key + 12 + (s % 8 === 0 ? 0 : 6));
  // Melody
  if (L.has('lead') && MUSIC.melody) {
    const n = MUSIC.melody[s];
    if (n) mLead(t, n[0], n[1] * sd);
  }
}

function pingPong(k, n) { const p = 2 * n - 2; const m = k % p; return m < n ? m : p - m; }

/** At the top of each bar: mood changes, sections, the chord, pads and the melody for the bar. */
function musicBar(t) {
  if (MUSIC.want !== MUSIC.mood) musicSetMood(MUSIC.want, t);
  else {
    MUSIC.bar++;
    if (MUSIC.bar % 8 === 0) musicSection();
  }
  const d = MUSIC.def, prog = MUSIC.prog;
  const c = prog[Math.floor(MUSIC.bar / d.chordBars) % prog.length];
  let q = c[1];
  if (MUSIC.color && q === 'm') q = 'm7'; else if (MUSIC.color && q === 'M') q = 'M7';
  MUSIC.chordRoot = c[0];
  MUSIC.chord = CHORD[q].map((n) => n + c[0]);
  const L = MUSIC.layers;
  if (AUDIO.music <= 0) return;
  const barDur = MUSIC.stepDur * 16;
  if (L.has('pad') && MUSIC.bar % d.chordBars === 0) mPad(t, MUSIC.chord.map((n) => MUSIC.key + n), barDur * d.chordBars);
  if (L.has('drone')) mDrone(t, MUSIC.key - 12 + c[0], barDur, MUSIC.bar);
  MUSIC.melody = L.has('lead') ? realizeMotif(MUSIC.motif, MUSIC.chord) : null;
}

/** A short rhythmic idea (onsets and moves through the scale) that the lead repeats over the section's chords. */
function makeMotif() {
  const rhythms = [[0, 3, 6, 10, 12], [0, 4, 8, 12], [0, 2, 4, 8, 11, 14], [0, 6, 8, 14], [0, 3, 8, 10, 12, 14], [0, 8, 10]];
  const r = rhythms[rnd(rhythms.length)];
  return { r, moves: r.map(() => [-2, -1, -1, 1, 1, 2, 0][rnd(7)]) };
}

/** The motif over this bar's chord: strong beats land on chord tones, the rest step through the scale. */
function realizeMotif(mo, chord) {
  const d = MUSIC.def, scale = d.scale, out = new Array(16).fill(null);
  const pc = new Set(chord.map((n) => ((n % 12) + 12) % 12));
  const degNote = (deg) => MUSIC.key + 12 + Math.floor(deg / 7) * 12 + scale[((deg % 7) + 7) % 7];
  let deg = MUSIC.lastDeg;
  mo.r.forEach((pos, k) => {
    deg = Math.max(2, Math.min(12, deg + mo.moves[k]));
    if (pos % 8 === 0) {
      // Snap to the nearest chord tone.
      for (let off = 0; off < 4; off++) {
        if (pc.has(((degNote(deg + off) - MUSIC.key) % 12 + 12) % 12)) { deg += off; break; }
        if (pc.has(((degNote(deg - off) - MUSIC.key) % 12 + 12) % 12)) { deg -= off; break; }
      }
    }
    const next = k + 1 < mo.r.length ? mo.r[k + 1] : 16;
    out[pos] = [degNote(deg), Math.max(1, next - pos) * 0.9];
  });
  MUSIC.lastDeg = deg;
  return out;
}

/* Instruments. Each makes its own short-lived nodes, all into the music bus. */

function mOsc(type, freq, t) { const o = AUDIO.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); return o; }
function env(g, t, a, peak, hold, rel) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  if (hold > a) g.gain.setValueAtTime(peak, t + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(hold, a) + rel);
}
function sends(node, dry, verb, echo) {
  const ac = AUDIO.ctx;
  if (dry) { const g = ac.createGain(); g.gain.value = dry; node.connect(g).connect(AUDIO.mDry); }
  if (verb) { const g = ac.createGain(); g.gain.value = verb; node.connect(g).connect(AUDIO.mVerbIn); }
  if (echo) { const g = ac.createGain(); g.gain.value = echo; node.connect(g).connect(AUDIO.mEchoIn); }
}

/** Warm pads: two detuned saws a note, slowly opening, pumped by the kick. */
function mPad(t, notes, dur) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(700, t); lp.frequency.linearRampToValueAtTime(1500, t + dur * 0.6); lp.Q.value = 0.6;
  // Each chord swells in while the last one is still fading, so the harmony flows bar to bar.
  env(g, t, 0.35, 1, dur, 1.1);
  for (const n of notes) for (const det of [-7, 7]) {
    const o = mOsc('sawtooth', midiHz(n), t), og = ac.createGain();
    o.detune.value = det; og.gain.value = 0.034;
    o.connect(og).connect(lp);
    o.start(t); o.stop(t + dur + 1.3);
  }
  lp.connect(g);
  g.connect(AUDIO.mPad);
  const v = ac.createGain(); v.gain.value = 0.7; g.connect(v).connect(AUDIO.mVerbIn);
}

function mArp(t, n, s) {
  const ac = AUDIO.ctx, o = mOsc('square', midiHz(n), t), lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(3400, t); lp.frequency.exponentialRampToValueAtTime(700, t + 0.16);
  env(g, t, 0.004, 0.042 * (s % 4 === 0 ? 1.2 : 1), 0.01, 0.17);
  o.connect(lp).connect(g);
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = s % 2 ? 0.35 : -0.35; g.connect(p); sends(p, 1, 0.35, 0.45); } else sends(g, 1, 0.35, 0.45);
  o.start(t); o.stop(t + 0.25);
}

function mBass(t, n, dur, soft) {
  const ac = AUDIO.ctx, o = mOsc('sawtooth', midiHz(n), t), sub = mOsc('sine', midiHz(n - 12), t), lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.Q.value = 4;
  lp.frequency.setValueAtTime(soft ? 400 : 1100, t); lp.frequency.exponentialRampToValueAtTime(soft ? 220 : 260, t + Math.min(dur, 0.25));
  env(g, t, 0.006, soft ? 0.085 : 0.11, dur * 0.6, dur * 0.4 + 0.05);
  const sg = ac.createGain(); sg.gain.value = soft ? 0.5 : 0.9;
  o.connect(lp); sub.connect(sg).connect(lp); lp.connect(g);
  sends(g, 1, 0, 0);
  o.start(t); sub.start(t); o.stop(t + dur + 0.1); sub.stop(t + dur + 0.1);
}

function mKick(t, v) {
  const ac = AUDIO.ctx, o = mOsc('sine', 150, t), g = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  env(g, t, 0.003, 0.5 * v, 0.02, 0.3);
  o.connect(g); sends(g, 1, 0, 0);
  o.start(t); o.stop(t + 0.4);
  // The pads duck under every kick: the synthwave pump.
  const pg = AUDIO.mPad.gain;
  pg.cancelScheduledValues(t); pg.setValueAtTime(0.45, t); pg.linearRampToValueAtTime(1, t + MUSIC.stepDur * 3);
}

function mSnare(t, v) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; bp.type = 'bandpass'; bp.frequency.value = 1900; bp.Q.value = 0.7;
  env(g, t, 0.002, 0.18 * v, 0.01, 0.17);
  src.connect(bp).connect(g); sends(g, 1, 0.35, 0);
  src.start(t, Math.random()); src.stop(t + 0.25);
  const o = mOsc('triangle', 190, t), og = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
  env(og, t, 0.002, 0.08 * v, 0.01, 0.08);
  o.connect(og); sends(og, 1, 0, 0);
  o.start(t); o.stop(t + 0.12);
}

function mHat(t, len, v) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; hp.type = 'highpass'; hp.frequency.value = 7500;
  env(g, t, 0.001, 0.045 * v, 0.003, len);
  src.connect(hp).connect(g); sends(g, 1, 0.1, 0);
  src.start(t, Math.random()); src.stop(t + len + 0.05);
}

function mTom(t, f) {
  const ac = AUDIO.ctx, o = mOsc('sine', f, t), g = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.2);
  env(g, t, 0.003, 0.16, 0.02, 0.22);
  o.connect(g); sends(g, 1, 0.3, 0);
  o.start(t); o.stop(t + 0.3);
}

function mStab(t, chord) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(500, t + 0.14);
  env(g, t, 0.003, 1, 0.02, 0.14);
  for (const n of chord) { const o = mOsc('sawtooth', midiHz(MUSIC.key + 12 + n), t), og = ac.createGain(); og.gain.value = 0.03; o.connect(og).connect(lp); o.start(t); o.stop(t + 0.2); }
  lp.connect(g); sends(g, 1, 0.3, 0.2);
}

function mLead(t, n, dur) {
  const ac = AUDIO.ctx, o = mOsc('sawtooth', midiHz(n), t), o2 = mOsc('triangle', midiHz(n + 12), t), lp = ac.createBiquadFilter(), g = ac.createGain();
  // A touch of vibrato that comes in as the note holds.
  const lfo = mOsc('sine', 5.5, t), lg = ac.createGain();
  lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(9, t + Math.min(0.4, dur));
  lfo.connect(lg); lg.connect(o.detune); lg.connect(o2.detune);
  lp.type = 'lowpass'; lp.frequency.value = 2300; lp.Q.value = 1.5;
  env(g, t, 0.03, 0.055, Math.max(0.05, dur - 0.08), 0.18);
  const g2 = ac.createGain(); g2.gain.value = 0.35;
  o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g);
  sends(g, 1, 0.5, 0.35);
  for (const x of [o, o2, lfo]) { x.start(t); x.stop(t + dur + 0.3); }
}

function mDrone(t, n, dur, bar) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.Q.value = 6;
  const open = 200 + Math.min(1800, bar * 160);
  lp.frequency.setValueAtTime(open * 0.6, t); lp.frequency.linearRampToValueAtTime(open, t + dur);
  env(g, t, 0.05, 0.08, dur - 0.05, 0.2);
  for (const m of [n, n + 7, n + 12]) { const o = mOsc('sawtooth', midiHz(m), t); o.connect(lp); o.start(t); o.stop(t + dur + 0.3); }
  lp.connect(g); sends(g, 1, 0.3, 0);
}

function mAlarm(t, n) {
  const ac = AUDIO.ctx, o = mOsc('square', midiHz(n), t), g = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2200;
  env(g, t, 0.005, 0.035, 0.12, 0.08);
  o.connect(lp).connect(g); sends(g, 1, 0.3, 0.4);
  o.start(t); o.stop(t + 0.3);
}

function mCrash(t) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), hp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; src.loop = true; hp.type = 'highpass'; hp.frequency.value = 4500;
  env(g, t, 0.003, 0.07, 0.01, 1.6);
  src.connect(hp).connect(g); sends(g, 1, 0.5, 0);
  src.start(t, Math.random()); src.stop(t + 1.8);
}
