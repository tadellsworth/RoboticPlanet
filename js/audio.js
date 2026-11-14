'use strict';
/*
 * Terrafall — audio, all made live with Web Audio (no audio files).
 *
 * Effects: short synthesized sounds for the interface and the battle, plus sounds from the map
 * that play when they're on screen (louder zoomed in, panned left or right): the hum of traffic,
 * builders welding, workers spreading concrete, Pavers laying hot asphalt, Freight Truck air brakes
 * and horns in jams, and the wind of each biome (with birds and insects in the forest).
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
  // The effects' own space, for explosions: a dark outdoor reverb (the blast rolling round the hills) and a
  // slapback echo off a far ridge. Explosions send to both (more of it the further off they are).
  A.fxVerbIn = ac.createGain();
  const fv = ac.createConvolver();
  fv.buffer = makeBlastImpulse(ac, 3.4);
  const fvOut = ac.createGain(); fvOut.gain.value = 0.85;
  A.fxVerbIn.connect(fv).connect(fvOut).connect(A.fxBus);
  A.fxEchoIn = ac.createGain();
  const fe = ac.createDelay(1.5); fe.delayTime.value = 0.29;
  const feLP = ac.createBiquadFilter(); feLP.type = 'lowpass'; feLP.frequency.value = 1100;
  const feFb = ac.createGain(); feFb.gain.value = 0.34;
  const feOut = ac.createGain(); feOut.gain.value = 0.55;
  A.fxEchoIn.connect(fe).connect(feLP).connect(feFb).connect(fe);
  feLP.connect(feOut).connect(A.fxBus);
  // A soft clipper the blasts are driven into: grit and weight (and harmonics a phone speaker can play).
  A.boomCurve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = (i / 2047) * 2 - 1; A.boomCurve[i] = Math.tanh(x * 2.8) / Math.tanh(2.8); }

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

/**
 * The explosions' reverb: a few early reflections off near ground (the first 120 ms), then a long, dark tail
 * (noise through a one-pole lowpass, decaying), a little different in each ear.
 */
function makeBlastImpulse(ac, secs) {
  const sr = ac.sampleRate, len = Math.floor(sr * secs), buf = ac.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      lp += 0.09 * ((Math.random() * 2 - 1) - lp); // dark: rolls off the highs
      d[i] = lp * 3.2 * Math.exp(-t * 1.65) * Math.min(1, t / 0.03);
    }
    for (let k = 0; k < 7; k++) {
      const at = Math.floor(sr * (0.018 + 0.016 * k + Math.random() * 0.012)), amp = (0.55 - k * 0.06) * (c ? 0.9 : 1);
      for (let j = 0; j < 90 && at + j < len; j++) d[at + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / 18);
    }
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
  g.gain.value = 0.0001; // silent until its envelope starts (a gain starts at 1, which clicked)
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
  g.gain.value = 0.0001; // silent until its envelope starts (a gain starts at 1, which clicked)
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(o.dest || AUDIO.fxBus);
  src.start(t0, Math.random() * 1.5);
  src.stop(t0 + dur + 0.05);
}

const SFX_GAP = { rumble: 2.5, eruption: 3,
  launch: 0.3, rocket: 0.12, takeoff: 1.5, chute: 0.4, flakfire: 0.25, flak: 0.12, boom: 0.12, shellhit: 0.09, missilehit: 0.2, laser: 0.08, pulse: 0.14, hit: 0.07, produce: 0.25, alert: 1.5, complete: 0.3, order: 0.15,
  weld: 0.25, scrape: 0.3, hiss: 0.6, airbrake: 1.2, honk: 2.5, nuke: 2, siren: 4,
  bombhit: 0.12, howitzerhit: 0.12, fireball: 0.2, collapse: 0.15, botboom: 0.1, bombfall: 0.15, incoming: 0.3, nukefall: 3,
};

/* ------------------------------------------------------------------ explosions */

/**
 * How big each explosion is (1: a building going up), for blast(), and how far off it's heard: one under 1
 * isn't heard at all off screen. (Also the sounds of something coming down: a bomb's whistle is only heard on
 * screen, a missile's roar further.)
 */
const BLAST_SIZE = {
  flak: 0.4, shellhit: 0.55, botboom: 0.6, collapse: 0.9, boom: 1, howitzerhit: 1.1, fireball: 1.3, bombhit: 1.35, missilehit: 1.8, nuke: 3.2,
  bombfall: 0.9, incoming: 1.2, nukefall: 3.2,
};

/**
 * Where an explosion at (wx, wy) is heard from. On screen: panned to it, louder and closer (brighter, less
 * echo) zoomed in. Off screen: far off (muffled, quieter the further it is, more echo), or not at all if it's
 * a small one; a nuclear blast is heard wherever it is. Returns { far: 0 (right here) .. 1 (far off), pan, vol }
 * or null (not heard).
 */
function blastWhere(wx, wy, size) {
  if (typeof R === 'undefined' || !R.w || typeof worldToScreen !== 'function') return { far: 0.3, pan: 0, vol: 1 };
  const p = worldToScreen(wx, wy), m = 60, zl = zoomLoud();
  if (p.x >= -m && p.y >= -m && p.x <= R.w + m && p.y <= R.h + m) {
    return { far: 0.08 + 0.55 * (1 - zl), pan: Math.max(-0.75, Math.min(0.75, (p.x / R.w) * 2 - 1)), vol: 0.6 + 0.4 * zl };
  }
  if (size < 1) return null;
  const dx = p.x - R.w / 2, d = Math.hypot(dx, p.y - R.h / 2) / Math.max(R.w, R.h), pan = Math.max(-0.6, Math.min(0.6, dx / R.w));
  if (size >= 3) return { far: 0.6, pan, vol: 0.85 };
  return { far: 1, pan, vol: Math.max(0.2, 0.6 - 0.15 * d) };
}

/** A voice for a sound heard from w (see blastWhere): its level, a lowpass for the distance, its pan. */
function blastVoice(w) {
  const ac = AUDIO.ctx, g = ac.createGain(), lp = ac.createBiquadFilter();
  g.gain.value = w.vol;
  lp.type = 'lowpass'; lp.frequency.value = 16000 * Math.pow(0.045, w.far); // (right here: open; far off: about 700 Hz)
  g.connect(lp);
  let out = lp;
  if (ac.createStereoPanner) { const pn = ac.createStereoPanner(); pn.pan.value = w.pan; lp.connect(pn); out = pn; }
  out.connect(AUDIO.fxBus);
  g.tap = lp; // (where an explosion's echoes are taken from: after the distance)
  setTimeout(() => { try { g.disconnect(); lp.disconnect(); out.disconnect(); } catch (e) { /* gone */ } }, 16000);
  return g;
}

/**
 * Short bursts of filtered noise from one source (debris clattering down, a fire crackling): grains is a list
 * of { at (seconds from now), len, amp, f (the filter's centre) }. One source, one filter and one gain however
 * many there are, the filter and gain automated grain by grain.
 */
function grains(D, list, type, q) {
  if (!list.length) return;
  const ac = AUDIO.ctx, now = ac.currentTime, src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  list.sort((x, y) => x.at - y.at);
  src.buffer = AUDIO.noise; src.loop = true;
  f.type = type || 'bandpass'; f.Q.value = q || 1.5;
  g.gain.value = 0;
  let endAt = 0;
  for (let k = 0; k < list.length; k++) {
    const gr = list[k], a = now + gr.at, next = k + 1 < list.length ? now + list[k + 1].at : Infinity;
    if (a < endAt) continue; // (still ringing from the one before)
    const e = Math.min(a + gr.len, next - 0.002);
    if (e <= a + 0.004) continue;
    f.frequency.setValueAtTime(gr.f, a);
    g.gain.setValueAtTime(0.0001, a);
    g.gain.exponentialRampToValueAtTime(gr.amp, a + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, e);
    endAt = e;
  }
  src.connect(f).connect(g).connect(D);
  src.start(now + list[0].at, Math.random() * 1.5);
  src.stop(endAt + 0.05);
}

/**
 * An explosion, layered the way films build them, into D:
 *   1. the crack of the shock front (a hard, bright snap),
 *   2. the blast itself: noise driven into a soft clipper, its lowpass slamming shut,
 *   3. a sub-bass thump dropping in pitch, felt more than heard (with an octave over it a phone can play),
 *   4. a rolling rumble that wobbles as it fades,
 *   5. debris pattering down,
 *   6. the echo off the hills: a slapback and the effects reverb, more of both the further off it is.
 * o: size (1: a building going up; a missile 1.8, a mortar shell 0.55), far (0..1, see blastWhere), gain (its level),
 * fire (a fuel blast: no crack, a whoomph as the fireball blooms, then the fire crackling and roaring on), air
 * (a shell bursting in the sky: no thump, no debris), deep (heavy ordnance: a bomb, a Howitzer shell, a
 * missile: a duller crack and a darker blast, a lower, longer thump, a resonant low boom under it all and a
 * heavier rumble rolling on), delay. Every one comes out a little different.
 */
function blast(D, o) {
  const ac = AUDIO.ctx, A = AUDIO, s = o.size || 1, far = o.far || 0, dl = o.delay || 0, t0 = ac.currentTime + dl;
  const rnd = (lo, hi) => lo + Math.random() * (hi - lo), pitch = rnd(0.9, 1.12);
  const mix = ac.createGain();
  mix.gain.value = o.gain ?? 1;
  mix.connect(D);
  // The echoes are taken after the distance (the voice's own filter, when it has one), so a far blast echoes dark.
  const tap = D.tap || mix, sends = [];
  const send = (node, lvl) => { if (!node) return; const g = ac.createGain(); g.gain.value = lvl * (D.tap ? o.gain ?? 1 : 1); tap.connect(g).connect(node); sends.push(g); };
  send(A.fxVerbIn, 0.28 + 0.5 * far + 0.07 * s + (o.deep ? 0.1 : 0));
  send(A.fxEchoIn, (o.air ? 0.3 : 0.14) + 0.3 * far);
  const deep = !!o.deep;
  // 1. The crack (heavy ordnance: duller, and under the boom).
  if (!o.fire) {
    const ck = deep ? 0.45 : 1;
    _noise(0.03 + 0.02 * s, (0.26 + 0.05 * s) * (1 - 0.6 * far) * ck, { type: 'highpass', freq: deep ? rnd(1100, 1500) : rnd(1700, 2600), attack: 0.001, delay: dl, dest: mix });
    _noise(0.12 + 0.05 * s, 0.11 * (1 - 0.5 * far) * ck, { type: 'bandpass', freq: deep ? rnd(1800, 2400) : rnd(2600, 3600), to: deep ? 600 : 900, q: 0.8, attack: 0.002, delay: dl, dest: mix });
  }
  // 2. The blast: driven noise, its lowpass slamming shut (a fireball's opens first: the whoomph).
  {
    const src = ac.createBufferSource(), drive = ac.createGain(), sh = ac.createWaveShaper(), lp = ac.createBiquadFilter(), env = ac.createGain();
    src.buffer = A.noise; src.loop = true;
    drive.gain.value = 2.2 + 0.4 * s;
    sh.curve = A.boomCurve; sh.oversample = '2x';
    lp.type = 'lowpass'; lp.Q.value = 0.8;
    const top = ((deep ? rnd(1300, 1800) : rnd(2600, 3600)) * (o.air ? 1.3 : 1)) / Math.sqrt(s), dur = ((o.air ? 0.45 : 0.75) * s + 0.35) * (deep ? 1.15 : 1);
    if (o.fire) {
      lp.frequency.setValueAtTime(260, t0); lp.frequency.exponentialRampToValueAtTime(1400, t0 + 0.09); lp.frequency.exponentialRampToValueAtTime(110, t0 + dur + 0.6);
    } else {
      lp.frequency.setValueAtTime(top, t0); lp.frequency.exponentialRampToValueAtTime(top * 0.22, t0 + 0.08); lp.frequency.exponentialRampToValueAtTime(deep ? 60 : 75, t0 + dur);
    }
    const pk = (o.air ? 0.15 : 0.22) * Math.min(1.25, 0.75 + 0.25 * s);
    env.gain.value = 0;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(pk, t0 + (o.fire ? 0.07 : 0.004));
    env.gain.exponentialRampToValueAtTime(pk * 0.35, t0 + (o.fire ? 0.5 : 0.18 * s + 0.08));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + (o.fire ? 0.8 : 0));
    src.connect(drive).connect(sh).connect(lp).connect(env).connect(mix);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.9);
  }
  // 3. The thump: a sine dropping in pitch, and its octave, both through the clipper.
  if (!o.air) {
    const sh = ac.createWaveShaper(), env = ac.createGain(), o1 = ac.createOscillator(), o2 = ac.createOscillator(), g2 = ac.createGain(), post = ac.createGain();
    sh.curve = A.boomCurve;
    // (Heavy ordnance: lower, longer, louder, with more of the octave so a phone speaker still gives the boom.)
    const f0 = ((o.fire ? 70 : deep ? 64 : 96) * pitch) / Math.pow(s, deep ? 0.3 : 0.35), f1 = Math.max(deep ? 20 : 22, ((deep ? 26 : 30) * pitch) / Math.pow(s, deep ? 0.2 : 0.25));
    const dur = deep ? 0.75 + 0.55 * s : 0.45 + 0.42 * s, drop = t0 + (deep ? 0.35 * s + 0.15 : 0.28 * s + 0.12);
    o1.frequency.setValueAtTime(f0, t0); o1.frequency.exponentialRampToValueAtTime(f1, drop);
    o2.frequency.setValueAtTime(f0 * 2, t0); o2.frequency.exponentialRampToValueAtTime(f1 * 2, drop);
    g2.gain.value = deep ? 0.45 : 0.35; post.gain.value = 0.5;
    const pk = (deep ? 0.7 : 0.55) * Math.min(1.3, 0.7 + 0.3 * s);
    env.gain.value = 0;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(pk, t0 + (o.fire ? 0.05 : 0.004));
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o1.connect(sh); o2.connect(g2).connect(sh);
    sh.connect(post).connect(env).connect(mix);
    o1.start(t0); o2.start(t0); o1.stop(t0 + dur + 0.05); o2.stop(t0 + dur + 0.05);
  }
  // 4. The rumble: low noise rolling on, wobbling as it fades.
  {
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), env = ac.createGain(), wob = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    src.buffer = A.noise; src.loop = true;
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    const dur = ((o.air ? 1.1 : 1.3) + 1.25 * s) * (deep ? 1.35 : 1);
    lp.frequency.setValueAtTime(o.air ? 420 : deep ? 210 : 260, t0); lp.frequency.exponentialRampToValueAtTime(deep ? 40 : 48, t0 + dur);
    lfo.frequency.value = rnd(3, 6); lg.gain.value = 0.35; wob.gain.value = 0.75;
    lfo.connect(lg).connect(wob.gain);
    const pk = (o.air ? 0.1 : 0.19) * Math.min(1.4, 0.6 + 0.4 * s) * (1 + 0.4 * far) * (deep ? 1.3 : 1);
    env.gain.value = 0;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(pk, t0 + 0.06 + 0.04 * s);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp).connect(wob).connect(env).connect(mix);
    src.start(t0, Math.random() * 1.5); lfo.start(t0); src.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05);
  }
  // 4b. Heavy ordnance: the boom itself, low noise ringing in a resonant lowpass that sinks as it dies away,
  // driven into the clipper (its harmonics carry the boom on small speakers).
  if (deep) {
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), drive = ac.createGain(), sh = ac.createWaveShaper(), env = ac.createGain();
    src.buffer = A.noise; src.loop = true;
    lp.type = 'lowpass'; lp.Q.value = 1.6;
    const dur = 1.1 + 0.5 * s;
    lp.frequency.setValueAtTime(rnd(210, 250) * pitch, t0); lp.frequency.exponentialRampToValueAtTime(55, t0 + dur);
    drive.gain.value = 2.4; sh.curve = A.boomCurve;
    const pk = 0.32 * Math.min(1.3, 0.7 + 0.3 * s);
    env.gain.value = 0;
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(pk, t0 + 0.008);
    env.gain.exponentialRampToValueAtTime(pk * 0.5, t0 + 0.25 + 0.1 * s);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(lp).connect(drive).connect(sh).connect(env).connect(mix);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.05);
  }
  // 5. Debris coming down: clattering at first, sparser and softer as it settles (a fire crackles instead).
  if (!o.air) {
    const n = Math.min(26, Math.round(((o.fire ? 18 : 6) + 7 * s) * (deep ? 0.6 : 1))), span = 0.6 + (o.fire ? 2.4 : 1) * s, list = [];
    for (let k = 0; k < n; k++) {
      const at = 0.12 + Math.pow(Math.random(), 1.6) * span, fade = Math.max(0.2, 1 - at / (span + 0.5));
      list.push(o.fire
        ? { at: dl + at, len: 0.006 + Math.random() * 0.02, amp: (0.03 + Math.random() * 0.05) * fade, f: 2500 + Math.random() * 4000 }
        : { at: dl + at, len: 0.02 + Math.random() * 0.06, amp: (0.03 + Math.random() * 0.05) * fade * (1 - 0.5 * far) * (deep ? 0.7 : 1), f: 900 + Math.random() * 3200 });
    }
    grains(mix, list, o.fire ? 'highpass' : 'bandpass', o.fire ? 0.7 : 1.8);
  }
  // 6. A fire roars on a while after a fuel blast.
  if (o.fire) _noise(1.8 + 0.8 * s, 0.07, { type: 'bandpass', freq: 520, to: 220, q: 0.7, attack: 0.25, delay: dl + 0.15, dest: mix });
  setTimeout(() => { try { mix.disconnect(); for (const g of sends) g.disconnect(); } catch (e) { /* gone */ } }, (dl + 14) * 1000);
}

/** Rubble coming down (a building dismantled, or crumbling away): a heavy crunch and a long clatter, no blast. */
function rubble(D, far) {
  _noise(0.5, 0.18, { freq: 700, to: 90, attack: 0.02, dest: D });
  _noise(1.6, 0.1, { freq: 260, to: 55, attack: 0.15, dest: D });
  _tone(70, 0.5, 'sine', 0.16, 36, 0, D);
  const list = [];
  for (let k = 0; k < 14; k++) {
    const at = 0.05 + Math.pow(Math.random(), 1.4) * 1.3;
    list.push({ at, len: 0.03 + Math.random() * 0.07, amp: (0.03 + Math.random() * 0.04) * (1 - at / 1.6) * (1 - 0.5 * (far || 0)), f: 500 + Math.random() * 2200 });
  }
  grains(D, list, 'bandpass', 1.5);
}

/**
 * Something coming down on you, for dur seconds, ending as it hits: a bomb's falling whistle (dropping in
 * pitch, louder as it nears), or a missile's roar as it dives in (a rushing whoosh sweeping down, its motor
 * rumbling under it; a nuclear one deeper).
 */
function incoming(D, kind, dur) {
  const ac = AUDIO.ctx, t0 = ac.currentTime, t1 = t0 + dur;
  if (kind === 'bomb') {
    const osc = ac.createOscillator(), vib = ac.createOscillator(), vg = ac.createGain(), env = ac.createGain();
    osc.frequency.setValueAtTime(1500 + Math.random() * 200, t0); osc.frequency.exponentialRampToValueAtTime(430, t1);
    vib.frequency.value = 7; vg.gain.value = 16;
    vib.connect(vg).connect(osc.frequency);
    env.gain.value = 0;
    env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(0.09, t1 - 0.04); env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.03);
    osc.connect(env).connect(D);
    osc.start(t0); vib.start(t0); osc.stop(t1 + 0.06); vib.stop(t1 + 0.06);
    _noise(dur, 0.06, { type: 'bandpass', freq: 2600, to: 800, q: 1.4, attack: dur * 0.9, dest: D }); // (the air rushing past it)
    return;
  }
  const big = kind === 'nuke';
  _noise(dur, big ? 0.3 : 0.24, { type: 'bandpass', freq: big ? 1800 : 3400, to: big ? 260 : 500, q: 1.4, attack: dur * 0.95, dest: D });
  _noise(dur, big ? 0.2 : 0.13, { type: 'lowpass', freq: 600, to: 160, attack: dur * 0.95, dest: D });
  const roar = ac.createOscillator(), lp = ac.createBiquadFilter(), env = ac.createGain();
  roar.type = 'sawtooth';
  roar.frequency.setValueAtTime(big ? 70 : 120, t0); roar.frequency.exponentialRampToValueAtTime(big ? 38 : 62, t1);
  lp.type = 'lowpass'; lp.frequency.value = 420;
  env.gain.value = 0;
  env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(big ? 0.12 : 0.08, t1 - 0.03); env.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.01);
  roar.connect(lp).connect(env).connect(D);
  roar.start(t0); roar.stop(t1 + 0.05);
}

function sfxReady() { return AUDIO.on && !AUDIO.suppress && AUDIO.ctx && AUDIO.ctx.state === 'running' && AUDIO.fx > 0; }

/**
 * Play a sound effect. dest: an optional node (a panner for a sound on the map), or the map position (dest = x,
 * then y) of an explosion or something coming down, heard from where it is (see blastWhere).
 */
function sfx(name, dest, y) {
  if (!sfxReady()) return;
  const now = AUDIO.ctx.currentTime;
  if (now - (AUDIO.last[name] || -9) < (SFX_GAP[name] || 0.05)) return;
  const w = typeof dest === 'number' ? blastWhere(dest, y, BLAST_SIZE[name] || 1) : null;
  if (typeof dest === 'number' && !w) return; // (too small to hear from here)
  AUDIO.last[name] = now;
  const D = w ? blastVoice(w) : dest || AUDIO.fxBus, far = w ? w.far : 0;
  const spd = typeof UI !== 'undefined' && UI.speed > 0 ? UI.speed : 1; // (a falling bomb's whistle lasts as long as its fall)
  switch (name) {
    case 'click': _tone(720, 0.06, 'triangle', 0.06, null, 0, D); break;
    case 'place': _tone(440, 0.08, 'triangle', 0.08, null, 0, D); _tone(660, 0.1, 'triangle', 0.08, null, 0.07, D); break;
    case 'complete': _tone(523, 0.1, 'sine', 0.08, null, 0, D); _tone(659, 0.1, 'sine', 0.08, null, 0.08, D); _tone(784, 0.16, 'sine', 0.08, null, 0.16, D); break;
    case 'produce': _tone(980, 0.05, 'sine', 0.035, null, 0, D); break;
    case 'laser': _tone(1400, 0.14, 'sawtooth', 0.035, 300, 0, D); break;
    // A Pulse Turret firing, like a tesla coil: the last of its charge whining up, then the discharge, a
    // buzzing arc (a low sawtooth chopped on and off) crackling with sparks, a snapping zap sweeping down
    // and a thump where it strikes.
    case 'pulse': {
      const ac = AUDIO.ctx, t0 = ac.currentTime + 0.07;
      _tone(520, 0.08, 'sine', 0.035, 2600, 0, D);
      _noise(0.03, 0.07, { type: 'highpass', freq: 3200, attack: 0.001, delay: 0.07, dest: D });
      const o = ac.createOscillator(), bp = ac.createBiquadFilter(), am = ac.createGain(), env = ac.createGain();
      const lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(110, t0); o.frequency.exponentialRampToValueAtTime(58, t0 + 0.42);
      bp.type = 'bandpass'; bp.frequency.setValueAtTime(1300, t0); bp.frequency.exponentialRampToValueAtTime(500, t0 + 0.42); bp.Q.value = 0.9;
      am.gain.value = 0;
      env.gain.value = 0.0001;
      lfo.type = 'square'; lfo.frequency.setValueAtTime(38, t0); lfo.frequency.linearRampToValueAtTime(22, t0 + 0.42);
      lg.gain.value = 1;
      lfo.connect(lg).connect(am.gain);
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(0.09, t0 + 0.012);
      env.gain.exponentialRampToValueAtTime(0.04, t0 + 0.2);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45);
      o.connect(bp).connect(am).connect(env).connect(D);
      o.start(t0); lfo.start(t0); o.stop(t0 + 0.48); lfo.stop(t0 + 0.48);
      _tone(3400, 0.22, 'sawtooth', 0.028, 240, 0.07, D);
      _tone(150, 0.2, 'sine', 0.09, 55, 0.07, D);
      for (let k = 0; k < 14; k++) {
        _noise(0.006 + Math.random() * 0.022, 0.02 + Math.random() * 0.035, { type: 'bandpass', freq: 2200 + Math.random() * 5500, q: 1.6, attack: 0.001, delay: 0.07 + Math.random() * 0.36, dest: D });
      }
      break;
    }
    case 'hit': _tone(220, 0.05, 'square', 0.03, 120, 0, D); break;
    // A Disruptor Tower's pulse: an electric crackle sweeping down.
    case 'zap': _tone(2400, 0.22, 'sawtooth', 0.025, 180, 0, D); _noise(0.18, 0.03, { type: 'highpass', freq: 4000, to: 1500, dest: D }); break;
    // A Mortar Pit firing: a deep hollow thump.
    case 'thump': _tone(90, 0.22, 'sine', 0.14, 45, 0, D); _noise(0.12, 0.05, { freq: 500, to: 120, dest: D }); break;
    // The ground shaking (a volcano rumbling, an earthquake): a long, deep, swelling rumble with a sub under it.
    case 'rumble':
      _noise(3.2, 0.26, { freq: 160, to: 60, attack: 0.9, dest: D });
      _noise(2.4, 0.12, { type: 'bandpass', freq: 320, to: 120, q: 0.8, attack: 0.6, delay: 0.3, dest: D });
      _tone(42, 2.8, 'sine', 0.18, 30, 0.2, D);
      duckMusic(0.55, 2.5);
      break;
    // A volcano erupting: a huge blast, a roar that rolls on, and the hiss of ash and stones thrown up.
    case 'eruption':
      _noise(0.12, 0.32, { type: 'highpass', freq: 1800, attack: 0.002, dest: D });
      _noise(2.6, 0.3, { freq: 1200, to: 70, attack: 0.01, dest: D });
      _noise(3.5, 0.08, { type: 'highpass', freq: 3000, attack: 0.5, delay: 0.4, dest: D });
      _tone(55, 1.6, 'sine', 0.22, 26, 0, D);
      duckMusic(0.5, 2.5);
      break;
    // Explosions (see blast): a building going up, a Mortar shell landing; heavy ordnance with a deep boom (a
    // Howitzer shell, a Strike Bomber's bomb, a Silo's missile); a Refinery or loaded Tanker going up in a fireball.
    case 'boom': blast(D, { size: 1, far, gain: 0.6 }); duckMusic(0.6, 0.7); break;
    case 'shellhit': blast(D, { size: 0.55, far, gain: 0.6 }); duckMusic(0.75, 0.4); break;
    case 'bombhit': blast(D, { size: 1.35, far, gain: 0.72, deep: true }); duckMusic(0.5, 1.2); break;
    case 'howitzerhit': blast(D, { size: 1.1, far, gain: 0.6, deep: true }); duckMusic(0.6, 0.9); break;
    case 'missilehit': blast(D, { size: 1.8, far, gain: 0.8, deep: true }); duckMusic(0.4, 1.6); break;
    case 'fireball': blast(D, { size: 1.3, far, gain: 0.6, fire: true }); duckMusic(0.5, 1.2); break;
    case 'botboom': blast(D, { size: 0.6, far, gain: 0.4 }); break; // (a robot blowing up)
    case 'collapse': rubble(D, far); break;
    // Coming down on you: a bomb's whistle as it falls, a missile's roar as it dives in (each ending as it hits).
    case 'bombfall': incoming(D, 'bomb', BOMBER.fall / spd); break;
    case 'incoming': incoming(D, 'missile', MISSILE_WARN / spd); break;
    case 'nukefall': incoming(D, 'nuke', (MISSILE_WARN * 1.6) / spd); break;
    case 'alert': _tone(880, 0.12, 'square', 0.05, null, 0, D); _tone(660, 0.12, 'square', 0.05, null, 0.15, D); break;
    // A missile leaving its Silo: the ignition pop, then the motor's roar climbing as it rises away.
    // A Howitzer firing: a deep, heavy cannon boom rolling away.
    case 'howitzer':
      _noise(0.08, 0.2, { type: 'lowpass', freq: 1400, attack: 0.001, dest: D });
      _noise(1.1, 0.12, { type: 'lowpass', freq: 380, to: 90, attack: 0.01, delay: 0.02, dest: D });
      _tone(46, 0.7, 'sine', 0.16, 28, 0.0, D);
      break;
    case 'rocket': // a short rocket whoosh off a launcher rack
      _noise(0.04, 0.12, { type: 'highpass', freq: 1800, attack: 0.002, dest: D });
      _noise(0.6, 0.12, { type: 'bandpass', freq: 600, to: 2600, q: 1.1, attack: 0.04, dest: D });
      break;
    case 'launch':
      _noise(0.07, 0.18, { type: 'highpass', freq: 1500, attack: 0.002, dest: D });
      _tone(70, 0.3, 'sine', 0.16, 40, 0, D);
      _noise(1.6, 0.16, { type: 'bandpass', freq: 380, to: 3200, q: 0.9, attack: 0.18, delay: 0.05, dest: D });
      _noise(1.4, 0.1, { freq: 400, to: 160, attack: 0.1, delay: 0.05, dest: D });
      _tone(110, 1.3, 'sawtooth', 0.035, 620, 0.08, D);
      break;
    // A Cargo Plane taking off: four turboprops spooling up, a deep drone and a rising roar that fades away.
    case 'takeoff':
      _noise(2.6, 0.11, { type: 'bandpass', freq: 220, to: 900, q: 0.7, attack: 0.6, dest: D });
      _noise(2.2, 0.06, { type: 'highpass', freq: 1800, to: 3200, attack: 0.9, delay: 0.3, dest: D });
      _tone(58, 2.4, 'sawtooth', 0.03, 92, 0, D);
      _tone(87, 2.2, 'triangle', 0.025, 140, 0.15, D);
      break;
    // A Flak Gun firing: a heavy double pom-pom, the twin barrels a beat apart.
    case 'flakfire':
      for (const dl of [0, 0.11]) { _tone(95, 0.16, 'sine', 0.12, 50, dl, D); _noise(0.09, 0.12, { type: 'bandpass', freq: 700, q: 0.8, attack: 0.002, delay: dl, dest: D }); }
      break;
    // A flak shell bursting up in the sky: a sharp crack and a dull, rolling boom.
    // A minigun's burst: a fast rattle of sharp cracks over a motor whine.
    case 'minigun':
      for (let k = 0; k < 8; k++) _noise(0.025, 0.07, { type: 'highpass', freq: 1800, attack: 0.001, delay: k * 0.04, dest: D });
      _tone(880, 0.34, 'sawtooth', 0.012, 660, 0.0, D);
      break;
    case 'flak': blast(D, { size: 0.4, far: Math.max(far, 0.35), gain: 0.8, air: true }); break;
    // Parachutes opening: a cloth crack and the rush of air.
    case 'chute':
      _noise(0.09, 0.12, { type: 'bandpass', freq: 900, q: 1.2, attack: 0.003, dest: D });
      _noise(0.7, 0.05, { type: 'lowpass', freq: 700, to: 300, attack: 0.05, delay: 0.06, dest: D });
      break;
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
    // A nuclear detonation: the biggest blast there is, then the shockwave arriving a beat later (a second,
    // deeper whump), a roar that rolls on for seconds and the wind rushing back in (the music all but stops).
    case 'nuke':
      blast(D, { size: 3.2, far: Math.min(far, 0.5), deep: true });
      blast(D, { size: 2.6, far: Math.min(1, far + 0.3), gain: 0.8, delay: 0.32, deep: true });
      _noise(6.5, 0.22, { freq: 900, to: 45, attack: 0.4, delay: 0.2, dest: D });
      _tone(34, 4.5, 'sine', 0.32, 22, 0.25, D);
      _noise(3.5, 0.06, { type: 'bandpass', freq: 600, to: 1800, q: 0.6, attack: 1.4, delay: 1.6, dest: D });
      duckMusic(0.12, 6);
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

/*
 * The air raid siren. While enemy Strike Bombers are in the air coming for you (a target of yours, or flying
 * over your land), a motor siren wails out across the colony: two rotors a third apart spinning up and down,
 * echoing off the hills. When the last one has gone it winds down, and it won't start again for a few seconds.
 */
const RAID = { voice: null, quietUntil: 0, last: 0, next: 0 };
const SIREN = { lo: 150, hi: 560, rise: 3.4, hold: 0.7, fall: 3.6, third: 1.2, level: 0.055, rest: 6 };

/** Are enemy Strike Bombers in the air coming for player 0 (at a target of theirs, or over their land)? */
function raidOn() {
  if (typeof S === 'undefined' || !S || !S.bots || !S.players[0] || S.players[0].absent) return false;
  for (const u of S.bots) {
    if (u.dead || u.owner <= 0 || u.type !== 'bomber' || !u.flight || !((u.alt || 0) > 0.05)) continue;
    const tg = u.mission && u.mission.target ? getE(u.mission.target) : null;
    if (tg && !tg.dead && tg.owner === 0) return true;
    const i = Math.floor(u.x), j = Math.floor(u.y);
    if (inMap(i, j) && S.owner[tIdx(i, j)] === 0) return true;
  }
  return false;
}

/** Start the siren: its two rotors, a filter taking the edge off, and the outdoor echo. */
function sirenStart() {
  const ac = AUDIO.ctx, A = AUDIO, now = ac.currentTime;
  const out = ac.createGain(), lp = ac.createBiquadFilter(), body = ac.createBiquadFilter(), amp = ac.createGain(), vib = ac.createOscillator(), vg = ac.createGain();
  const rotors = [1, SIREN.third].map((k) => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = SIREN.lo * 0.5 * k; return { o, k }; });
  lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.5;
  body.type = 'peaking'; body.frequency.value = 900; body.Q.value = 0.8; body.gain.value = 5;
  amp.gain.value = 0; out.gain.value = 1;
  vib.frequency.value = 4.6; vg.gain.value = 0.006; // (the rotor's wobble, as a fraction of its pitch: see sirenWail)
  for (const r of rotors) { const g = ac.createGain(); g.gain.value = r.k === 1 ? 0.6 : 0.42; r.o.connect(g).connect(body); }
  body.connect(lp).connect(amp).connect(out).connect(A.fxBus);
  const toVerb = ac.createGain(), toEcho = ac.createGain();
  toVerb.gain.value = 0.55; toEcho.gain.value = 0.3;
  if (A.fxVerbIn) amp.connect(toVerb).connect(A.fxVerbIn);
  if (A.fxEchoIn) amp.connect(toEcho).connect(A.fxEchoIn);
  for (const r of rotors) { const w = ac.createGain(); w.gain.value = SIREN.hi * r.k * 0.006; vib.connect(w).connect(r.o.frequency); r.o.start(now); }
  vib.start(now);
  RAID.voice = { rotors, amp, out, vib, nodes: [out, lp, body, amp, toVerb, toEcho, vib], end: Infinity };
  RAID.next = now + 0.05;
}

/** One wail from t0: the rotors spin up to full pitch (and loudness), hold a moment, and spin down again. */
function sirenWail(t0) {
  const V = RAID.voice, top = t0 + SIREN.rise, down = top + SIREN.hold;
  for (const r of V.rotors) {
    const f = r.o.frequency;
    f.setTargetAtTime(SIREN.hi * r.k, t0, SIREN.rise / 3);
    f.setTargetAtTime(SIREN.lo * r.k, down, SIREN.fall / 3.2);
  }
  V.amp.gain.setTargetAtTime(SIREN.level, t0, SIREN.rise / 3.5);
  V.amp.gain.setTargetAtTime(SIREN.level * 0.45, down, SIREN.fall / 3);
  return down + SIREN.fall;
}

/** The raid is over: the siren winds right down and fades away, then its nodes are let go. */
function sirenStop(quick) {
  const V = RAID.voice;
  if (!V) return;
  const ac = AUDIO.ctx, now = ac.currentTime, fade = quick ? 0.4 : 5;
  for (const r of V.rotors) { r.o.frequency.cancelScheduledValues(now); r.o.frequency.setValueAtTime(r.o.frequency.value, now); r.o.frequency.setTargetAtTime(45 * r.k, now, fade / 2.5); r.o.stop(now + fade + 0.5); }
  V.amp.gain.cancelScheduledValues(now); V.amp.gain.setValueAtTime(V.amp.gain.value, now); V.amp.gain.setTargetAtTime(0.0001, now, fade / 4);
  V.vib.stop(now + fade + 0.5);
  setTimeout(() => { try { for (const n of V.nodes) n.disconnect(); } catch (e) { /* gone */ } }, (fade + 1) * 1000);
  RAID.voice = null;
  RAID.quietUntil = now + SIREN.rest;
}

/**
 * Every quarter second: start the siren when a raid begins, keep the wails coming while it lasts (one is
 * scheduled as the last comes down), and let it wind down when it's over (at once if the game is paused or left).
 */
function sirenTick(live) {
  const ac = AUDIO.ctx, now = ac.currentTime, raid = live && AUDIO.fx > 0 && !AUDIO.suppress && raidOn();
  if (!live) { if (RAID.voice) sirenStop(true); return; }
  if (raid) RAID.last = now;
  if (raid && !RAID.voice && now >= RAID.quietUntil) sirenStart();
  if (!RAID.voice) return;
  if (now >= RAID.next - 0.3) {
    if (now - RAID.last < 1) RAID.next = sirenWail(Math.max(now, RAID.next));
    else sirenStop(false);
  }
}

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
  if (WORLD.bt <= 0) {
    const live = !!(inGame && !UI.paused && S.winner < 0);
    updateBeds(live, 0.25 - WORLD.bt);
    sirenTick(live);
    WORLD.bt = 0.25;
  }
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
 * wind of the biome, gusting. In the forest, birds and insects call now and then.
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
  const wind = { desert: [480, 0.7, 0.03], jungle: [320, 0.6, 0.016], polar: [1100, 2.2, 0.035], volcanic: [180, 0.5, 0.03], lunar: [90, 0.4, 0.008],
    autumn: [600, 0.8, 0.028], savanna: [700, 0.9, 0.024], alien: [260, 3, 0.014], swamp: [240, 0.5, 0.01] }[b] || [480, 0.7, 0.03];
  B.gust -= dt;
  if (B.gust <= 0) {
    // A new gust every few seconds: the wind swells, drops and changes pitch.
    B.gust = 2 + Math.random() * 4;
    B.bp.frequency.setTargetAtTime(wind[0] * (0.7 + Math.random() * 0.7), t, 1.2);
    B.bp.Q.value = wind[1];
  }
  const windLevel = live ? wind[2] * (0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1)) + wind[2] * 0.5 : 0;
  B.wg.gain.setTargetAtTime(windLevel, t, 0.8);
  if (live && BIOME_CALLS[b]) {
    B.chirp -= dt;
    if (B.chirp <= 0) { B.chirp = 2 + Math.random() * 6; biomeCall(b); }
  }
}

// The life (and the land) heard now and then in each biome: see biomeCall.
const BIOME_CALLS = { jungle: 1, autumn: 1, savanna: 1, swamp: 1, alien: 1, volcanic: 1 };

/** Something heard somewhere out in the biome: birds and insects, frogs in the swamp, strange calls on the alien bloom, the ground hissing and grumbling on the ashlands. */
function biomeCall(b) {
  if (b === 'jungle' || b === 'autumn') return jungleCall();
  if (!sfxReady()) return;
  const ac = AUDIO.ctx, pan = ac.createStereoPanner ? ac.createStereoPanner() : null, g = ac.createGain();
  g.gain.value = 0.5;
  if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; g.connect(pan).connect(AUDIO.fxBus); } else g.connect(AUDIO.fxBus);
  const r = Math.random();
  if (b === 'savanna') {
    // Cicadas buzzing, or a far-off bird's two-note call.
    if (r < 0.6) { const f = 5200 + Math.random() * 1500; for (let k = 0; k < 14; k++) _tone(f, 0.02, 'square', 0.006, f * 1.02, k * 0.03, g); }
    else { const f = 900 + Math.random() * 300; _tone(f, 0.22, 'sine', 0.025, f * 0.92, 0, g); _tone(f * 1.25, 0.25, 'sine', 0.022, f, 0.3, g); }
  } else if (b === 'swamp') {
    // Frogs croaking, a chorus, or a drip.
    if (r < 0.7) { const f = 140 + Math.random() * 120; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) _tone(f, 0.09, 'square', 0.02, f * 0.8, k * 0.22, g); }
    else _tone(1800 + Math.random() * 600, 0.05, 'sine', 0.02, 900, 0, g);
  } else if (b === 'alien') {
    // Strange, sliding, warbling calls.
    const f = 300 + Math.random() * 900;
    _tone(f, 0.6, 'sine', 0.02, f * (Math.random() < 0.5 ? 2.2 : 0.45), 0, g);
    if (r < 0.5) _tone(f * 1.5, 0.4, 'triangle', 0.012, f * 0.8, 0.35, g);
  } else if (b === 'volcanic') {
    // A vent hissing, or the ground grumbling.
    if (r < 0.6) _noise(1.2, 0.03, { type: 'highpass', freq: 2500, attack: 0.2, dest: g });
    else _noise(1.6, 0.06, { freq: 140, to: 60, attack: 0.3, dest: g });
  }
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 3000);
}

/** A bird or an insect somewhere in the forest. */
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
    arrange: [['pad', 'arp8'], ['pad', 'arp8', 'bassW'], ['pad', 'arp8', 'bassW', 'shimmer'], ['pad', 'shimmer', 'bassW']],
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
  // Shimmer: a slow, high bell arpeggio drifting through the chord.
  if (L.has('shimmer') && s % 4 === 0) { const hi = chord.map((n) => n + 24); mLead(t, MUSIC.key + hi[(s / 4 + MUSIC.bar) % hi.length], sd * 6, 0.6); }
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

/**
 * The melody voice: a soft synth bell. A sine with a quiet octave above and a touch of filtered
 * square for synth character, struck and left to ring out into the echo (no vibrato, no horn).
 */
function mLead(t, n, dur, vol) {
  const ac = AUDIO.ctx, f = midiHz(n), g = ac.createGain(), lp = ac.createBiquadFilter();
  const o = mOsc('sine', f, t), o2 = mOsc('sine', f * 2, t), o3 = mOsc('square', f, t);
  const g2 = ac.createGain(), g3 = ac.createGain();
  g2.gain.setValueAtTime(0.25, t); g2.gain.exponentialRampToValueAtTime(0.02, t + 0.4); // the octave fades first: a bell's strike
  g3.gain.value = 0.12;
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.5);
  const ring = Math.min(1.6, Math.max(0.5, dur * 1.5));
  env(g, t, 0.006, 0.05 * (vol || 1), 0.02, ring);
  o.connect(g); o2.connect(g2).connect(g); o3.connect(g3).connect(lp).connect(g);
  sends(g, 1, 0.55, 0.45);
  for (const x of [o, o2, o3]) { x.start(t); x.stop(t + ring + 0.1); }
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
