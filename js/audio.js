'use strict';
/*
 * Terrafall — audio, all made live with Web Audio (no audio files).
 *
 * Effects: short synthesized sounds for the interface and the battle, plus sounds from the map
 * that play when they're on screen (louder zoomed in, panned left or right): the hum of traffic,
 * builders welding, workers spreading concrete, Pavers laying hot asphalt, Freight Truck air brakes
 * and horns in jams, and the wind of each biome (with birds and insects in the forest). A built-up
 * colony on screen has its own bustle, thicker the more there is of it (see updateBeds): a city
 * murmur, the hum of its working factories and each kind of factory at its work (clanking furnaces,
 * presses, wrenches and machine tools, drills, pumps, beeping fabs), far-off horns in a big city. Trains rumble along with their wheels
 * clacking over the joints, sound their horn pulling out and squeal braking in; aircraft drone
 * overhead, whine in on the approach and screech down on the runway; ships hoot leaving port; the
 * sea washes the shore and lava bubbles. Away from the streets the land itself is
 * heard (see natureBeds and biomeCall): each biome's rustle, hiss, drone or shimmer and its calls, surf and lapping
 * water, a volcano's rumble, the weather (rain and thunder, storms, embers), and near a nest or a tunnel exit (and at
 * night over their tunnels), the Murmur in the ground; and at night (nightSounds) a cricket chorus, owls, night birds,
 * peepers and frogs, the leaves stirring and the dry wind.
 *
 * Music: a generative synthwave score that follows the game. A slow theme on the menu, a calm
 * groove while you build (three of them, taking turns every ten minutes of play: the original,
 * Night Drive and Horizon), a driving track when you're under attack or at war (two of them, a new
 * fight taking the other: Overdrive and Redline), and an alarm while a nuclear missile is in the air.
 * The campaign theme, The Long Silence, tells the story's arc from a level the game sets (musicStory):
 * the Lore guide plays it while it's open. It's written a bar at a time from chord progressions, arpeggios,
 * bass lines, drum patterns and short melodies, arranged in 8-bar sections that bring parts in and
 * out, so it never loops exactly. On a computer a small card names each theme as it starts (MUSIC_TITLES).
 *
 * Volumes (Music, Effects and Ambience, 0..1) are set in the pause menu and remembered on this device. Ambience is the
 * land's own sounds (AUDIO.natureBus: each biome's wind, bed and calls, water, crickets, the sea), apart from the effects.
 */

const AUDIO = { ctx: null, on: true, last: {}, music: 0.55, fx: 0.8, amb: 0.5, suppress: false };
try {
  const saved = JSON.parse(localStorage.getItem('botfall.audio') || '{}');
  // (held to 0..1: a value from storage is used as a gain, and a large one would be deafening)
  if (typeof saved.music === 'number' && saved.music >= 0) AUDIO.music = Math.min(1, saved.music);
  if (typeof saved.fx === 'number' && saved.fx >= 0) AUDIO.fx = Math.min(1, saved.fx);
  if (typeof saved.amb === 'number' && saved.amb >= 0) AUDIO.amb = Math.min(1, saved.amb);
} catch (e) { /* defaults */ }

function saveAudio() {
  try { localStorage.setItem('botfall.audio', JSON.stringify({ music: AUDIO.music, fx: AUDIO.fx, amb: AUDIO.amb })); } catch (e) { /* storage unavailable */ }
}

/** Set the Music, Effects or Ambience volume (kind 'music', 'fx' or 'amb'; 0..1). */
function setVolume(kind, v) {
  AUDIO[kind] = clampV(v);
  saveAudio();
  const ac = AUDIO.ctx;
  if (!ac) return;
  if (kind === 'fx' && AUDIO.fxBus) AUDIO.fxBus.gain.setTargetAtTime(AUDIO.fx, ac.currentTime, 0.05);
  if (kind === 'amb' && AUDIO.natureBus) AUDIO.natureBus.gain.setTargetAtTime(AUDIO.amb * NATURE_LEVEL, ac.currentTime, 0.05);
  if (kind === 'music' && AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(musicLevel(), ac.currentTime, 0.05);
}
function clampV(v) { return Math.max(0, Math.min(1, +v || 0)); }

const MUSIC_LEVEL = 0.95; // the music bus at full Music volume
/** The music bus's level: the Music volume, and the mood's own trim (a sparser theme is brought up to match). */
function musicLevel() { return AUDIO.music * MUSIC_LEVEL * ((typeof MUSIC !== 'undefined' && MUSIC.def && MUSIC.def.gain) || 1); }

/** Browsers only start audio from a tap or key press: called on the first one (and on Start). */
function audioUnlock() {
  // A context can be 'suspended', or 'interrupted' (Safari, after a call, Siri or another app took the sound), and
  // only a tap brings it back; one the browser 'closed' is built afresh.
  if (AUDIO.ctx && AUDIO.ctx.state === 'closed') { AUDIO.ctx = null; if (typeof MUSIC !== 'undefined' && MUSIC.timer) { clearInterval(MUSIC.timer); MUSIC.timer = 0; } }
  if (AUDIO.ctx) { if (AUDIO.ctx.state !== 'running' && !document.hidden) { const r = AUDIO.ctx.resume(); if (r && r.catch) r.catch(() => {}); } return; }
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
    const r = document.hidden ? AUDIO.ctx.suspend() : AUDIO.ctx.resume();
    if (r && r.catch) r.catch(() => {});
  });
  // Back from the app switcher (pageshow) or a window regaining focus: try again (a tap does it if this can't).
  const back = () => { if (AUDIO.ctx && AUDIO.ctx.state !== 'running' && AUDIO.ctx.state !== 'closed' && !document.hidden) { const r = AUDIO.ctx.resume(); if (r && r.catch) r.catch(() => {}); } };
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);
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
  // The land's own sounds (each biome's wind, bed and calls, water, crickets, the sea) go through a bus of their own,
  // set by the Ambience volume (NATURE_LEVEL at full), apart from the effects.
  A.natureBus = ac.createGain();
  A.natureBus.gain.value = A.amb * NATURE_LEVEL;
  A.natureBus.connect(A.master);
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
  // A soft clipper the blasts are driven into: grit and weight (and harmonics a phone speaker can play); Redline's bass
  // and its kick are driven into it too (mGrind, mKickHard).
  A.boomCurve = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) { const x = (i / 2047) * 2 - 1; A.boomCurve[i] = Math.tanh(x * 2.8) / Math.tanh(2.8); }

  A.musicBus = ac.createGain();
  A.musicBus.gain.value = musicLevel();
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

const SFX_GAP = { rumble: 2.5, eruption: 3, clank: 0.12, furnace: 0.6, machine: 0.5, ratchet: 0.4, press: 0.6, drill: 0.35, pumpthump: 0.3, beeps: 0.3, chop: 0.2, honkfar: 1.5,
  touchdown: 0.4, approach: 0.8, planetakeoff: 0.8, trainhorn: 1.2, brakes: 1, clack: 0.05, shiphorn: 2.5, bubble: 0.15, cricket: 0.1,
  launch: 0.3, drizzle: 0.8, mdcharge: 0.8, mdlaunch: 0.4, mdcatch: 0.3, mdburst: 0.2, mdthud: 0.3, rocket: 0.12, takeoff: 1.5, chute: 0.4, flakfire: 0.25, flak: 0.12, boom: 0.12, shellhit: 0.09, missilehit: 0.2, laser: 0.08, pulse: 0.14, hit: 0.07, produce: 0.25, alert: 1.5, complete: 0.3, order: 0.15,
  deepsurge: 0.8, weld: 0.25, scrape: 0.3, hiss: 0.6, airbrake: 1.8, honk: 2.5, passby: 0.35, beepback: 0.9, toot: 1, chirp: 0.15, servo: 0.25, nuke: 2, siren: 4,
  bombhit: 0.12, howitzerhit: 0.12, fireball: 0.2, collapse: 0.15, botboom: 0.1, bombfall: 0.15, incoming: 0.3, nukefall: 3,
  planefall: 0.3, blimpfall: 0.3, aircrash: 0.3, aircrashnear: 0.3,
  flame: 0.45, shieldhit: 0.08, shieldbreak: 0.3, arc: 0.12, rail: 0.18, railcharge: 0.3,
  lancecharge: 2, lancefire: 1, domehit: 0.12, domefall: 1, citychime: 2.5, cityclock: 3,
  liftclimb: 1.5, liftland: 1, liftgroan: 2, liftsnap: 2, liftimpact: 0.35,
  gupbegin: 2, guppulse: 1.2, gupecho: 1.2, gupanswer: 5,
  sundercharge: 2, sunderthud: 0.12, sunderfire: 1, sunderquake: 0.8,
  deepstage: 3, atmosstage: 4, stormbolt: 1,
  harrow: 4, harrowslam: 1.5, harrowdown: 4,
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
  planefall: 0.9, blimpfall: 0.9, aircrash: 1.5, aircrashnear: 0.9, // (an aircraft shot down: its fall heard only on screen, its crash further off by those it concerns)
  flame: 0.5, shieldhit: 0.45, shieldbreak: 0.6, arc: 0.5, rail: 0.6, railcharge: 0.4, // (heard only on screen)
  mdcharge: 0.5, mdlaunch: 0.7, mdcatch: 0.5, mdburst: 0.45, mdthud: 0.45, // (a Mass Driver and its canisters: heard on screen)
  drizzle: 0.4, // (the Ring drizzle: a soft whoosh, heard only on screen)
  lancecharge: 3, lancefire: 3.2, domehit: 0.95, domefall: 1.4, // (the Lance of Corvane is heard by everyone, wherever it is; a Shield Dome near by)
  citychime: 1.6, cityclock: 0.5, // (Arrival City's tram-stop chime, taken or repaired, heard off screen; its clock's chime only on it)
  liftclimb: 0.8, liftland: 1.1, liftgroan: 2.2, liftsnap: 3, liftimpact: 1.6, // (an Orbital Lift's climber near by; its cable groaning and falling heard far off)
  sundercharge: 3, sunderthud: 2.6, sunderfire: 3, sunderquake: 2.4, // (the Sundering Ray's thudding is heard by everyone, as the Lance's charge; its blow landing far off)
  deepstage: 1.8, // (a Deep Core reaching a new depth: heard off screen, near by)
  atmosstage: 1.8, // (an Atmosphere Engine reaching a new stage: heard off screen, near by)
  stormbolt: 1.6, // (lightning out of a Storm Front: a crack and a roll, heard off screen near by)
  gupbegin: 3, guppulse: 0.6, gupecho: 0.6, // (a Great Uplink beginning to transmit heard by everyone; its pulse, and the Murmur's answer, only with it on screen)
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
  if (far < 0.6) WORLD.boomAt = t0; // (the night's insects fall quiet: nightSounds)
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
 * An aircraft shot down, falling for dur seconds into D, ending as it hits. A plane: its engines failing (a rough,
 * sputtering whine sinking in pitch, cutting in and out), the wind of its dive rising to a roar, its fire crackling.
 * The Airship (heavy) groans down instead: a low, beating moan sinking, its frame creaking and buckling, the fire
 * roaring in its envelope, the wind softer.
 */
function falling(D, heavy, dur) {
  const ac = AUDIO.ctx, t0 = ac.currentTime + 0.05, t1 = t0 + dur, crackle = [];
  for (let k = 0; k < Math.round(dur * 7); k++) crackle.push({ at: 0.1 + Math.random() * dur, len: 0.006 + Math.random() * 0.02, amp: 0.02 + Math.random() * 0.03, f: 2000 + Math.random() * 4000 });
  grains(D, crackle, 'highpass', 0.7);
  _noise(dur, heavy ? 0.06 : 0.11, { type: 'bandpass', freq: heavy ? 300 : 500, to: heavy ? 700 : 1500, q: 0.9, attack: dur * 0.92, dest: D });
  if (heavy) {
    for (const [f0, v] of [[62, 0.06], [65.5, 0.05]]) {
      const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, t0); o.frequency.linearRampToValueAtTime(f0 * 0.72, t1);
      lp.type = 'lowpass'; lp.frequency.value = 300;
      g.gain.value = 0.0001;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v, t0 + 1.5); g.gain.setValueAtTime(v, t1 - 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.05);
      o.connect(lp).connect(g).connect(D);
      o.start(t0); o.stop(t1 + 0.1);
    }
    for (let k = 0; k < Math.round(dur / 1.4); k++) _noise(0.35 + Math.random() * 0.4, 0.05, { type: 'bandpass', freq: 300 + Math.random() * 400, to: 120 + Math.random() * 100, q: 9, attack: 0.08, delay: 0.4 + Math.random() * (dur - 0.8), dest: D });
    _noise(dur, 0.06, { type: 'lowpass', freq: 500, to: 900, attack: dur * 0.5, dest: D });
    return;
  }
  const o = ac.createOscillator(), bp = ac.createBiquadFilter(), am = ac.createGain(), env = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(420 + Math.random() * 60, t0); o.frequency.exponentialRampToValueAtTime(110, t1);
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(1400, t0); bp.frequency.exponentialRampToValueAtTime(380, t1); bp.Q.value = 1.2;
  lfo.type = 'square'; lfo.frequency.setValueAtTime(6, t0); lfo.frequency.linearRampToValueAtTime(11, t1);
  lg.gain.value = 0.5; am.gain.value = 0.5;
  lfo.connect(lg).connect(am.gain);
  env.gain.value = 0.0001;
  env.gain.setValueAtTime(0.0001, t0); env.gain.exponentialRampToValueAtTime(0.07, t0 + 0.15); env.gain.exponentialRampToValueAtTime(0.03, t0 + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t1);
  o.connect(bp).connect(am).connect(env).connect(D);
  o.start(t0); lfo.start(t0); o.stop(t1 + 0.05); lfo.stop(t1 + 0.05);
  _noise(dur * 0.45, 0.035, { type: 'bandpass', freq: 1800, to: 900, q: 3, attack: dur * 0.4, delay: dur * 0.55, dest: D }); // (the whistle of the dive)
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

/** Vowel formants shape a synthetic carrier into the vanguard's spoken radio code. */
function commandVoice(speech) {
  if (!sfxReady()) return;
  const ac = AUDIO.ctx, start = ac.currentTime, formants = {
    a: [720, 1150, 2500], e: [480, 1770, 2500], i: [280, 2250, 3000],
    o: [500, 850, 2400], u: [300, 650, 2250],
  };
  let delay = 0.2, syllable = 0;
  _tone(620, 0.11, 'sine', 0.024, 970, 0);
  for (const sound of speech) {
    if (sound === ' ') { delay += 0.065; continue; }
    const at = start + delay, dur = [0.18, 0.12, 0.24, 0.16][syllable % 4];
    const buzz = ac.createOscillator(), envelope = ac.createGain();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime([108, 135, 100, 153][syllable % 4], at);
    buzz.frequency.exponentialRampToValueAtTime([93, 119, 83, 111][syllable % 4], at + dur);
    for (const hz of formants[sound]) {
      const vowel = ac.createBiquadFilter();
      vowel.type = 'bandpass';
      vowel.Q.value = 5;
      vowel.frequency.setValueAtTime(hz * 0.89, at);
      vowel.frequency.linearRampToValueAtTime(hz, at + 0.06);
      buzz.connect(vowel).connect(envelope);
    }
    envelope.gain.setValueAtTime(0, at);
    envelope.gain.linearRampToValueAtTime(0.24, at + 0.026);
    envelope.gain.exponentialRampToValueAtTime(0.001, at + dur);
    envelope.connect(AUDIO.fxBus);
    buzz.start(at); buzz.stop(at + dur);
    _noise(dur * 0.5, 0.012, { type: 'bandpass', freq: 1700, to: 950, q: 1.5, delay });
    delay += dur;
    syllable++;
  }
  _tone(710, 0.12, 'sine', 0.018, 410, delay);
}

function sfxReady() { return AUDIO.on && !AUDIO.suppress && AUDIO.ctx && AUDIO.ctx.state === 'running' && AUDIO.fx > 0; }
/** As sfxReady, for the land's own sounds: the Ambience volume, not the Effects one. */
function natureReady() { return AUDIO.on && !AUDIO.suppress && AUDIO.ctx && AUDIO.ctx.state === 'running' && AUDIO.amb > 0; }

/**
 * Play a sound effect. dest: an optional node (a panner for a sound on the map), or the map position (dest = x,
 * then y) of an explosion or something coming down, heard from where it is (see blastWhere). dur: how long something
 * coming down takes, in game seconds, for the sounds that last until it lands (an aircraft shot down).
 */
function sfx(name, dest, y, dur) {
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
    // Howitzer shell, a Vulcan Bomber's bomb, a Silo's missile); a Refinery or loaded Tanker going up in a fireball.
    case 'boom': blast(D, { size: 1, far, gain: 0.6 }); duckMusic(0.6, 0.7); break;
    case 'shellhit': blast(D, { size: 0.55, far, gain: 0.6 }); duckMusic(0.75, 0.4); break;
    case 'bombhit': blast(D, { size: 1.35, far, gain: 0.72, deep: true }); duckMusic(0.5, 1.2); break;
    case 'howitzerhit': blast(D, { size: 1.1, far, gain: 0.6, deep: true }); duckMusic(0.6, 0.9); break;
    case 'missilehit': blast(D, { size: 1.8, far, gain: 0.8, deep: true }); duckMusic(0.4, 1.6); break;
    case 'fireball': blast(D, { size: 1.3, far, gain: 0.6, fire: true }); duckMusic(0.5, 1.2); break;
    case 'botboom': blast(D, { size: 0.6, far, gain: 0.4 }); break; // (a robot blowing up)
    case 'collapse': rubble(D, far); break;
    case 'deepsurge': {
      const tier = clamp(dur || 1, 1, 3), f = [0, 63, 51, 42][tier], tail = 1.1 + 0.35 * tier;
      _tone(f, tail, 'sine', 0.04 + 0.015 * tier, f * 0.72, 0, D);
      _tone(f * 1.95, tail * 0.82, 'sine', 0.022, f * 1.36, 0.07, D);
      _noise(tail, 0.028 + 0.012 * tier, { type: 'lowpass', freq: f * 4, to: f * 1.25, attack: 0.23, dest: D });
      break;
    }
    // The Harrow: breaking out of the ground (a long rising groan of rock, the ground giving way, a sub-bass roar under
    // a hoarse breath), its slam (a crushing thud and the ground cracking), and coming down for good (a long falling groan).
    case 'harrow':
      _noise(3.6, 0.3, { freq: 90, to: 260, attack: 1.2, dest: D });
      _noise(1.4, 0.22, { type: 'bandpass', freq: 600, to: 150, q: 0.9, attack: 0.05, delay: 1.6, dest: D });
      _tone(36, 3.4, 'sine', 0.24, 52, 0.2, D);
      _tone(72, 2.2, 'sawtooth', 0.03, 58, 1.4, D);
      rubble(D, far);
      duckMusic(0.35, 3.5);
      break;
    case 'harrowslam':
      _tone(44, 0.9, 'sine', 0.3, 24, 0, D);
      _noise(0.08, 0.3, { type: 'lowpass', freq: 900, attack: 0.001, dest: D });
      _noise(1.2, 0.16, { type: 'bandpass', freq: 900, to: 220, q: 1.2, attack: 0.02, delay: 0.05, dest: D });
      rubble(D, far);
      duckMusic(0.5, 1.2);
      break;
    case 'harrowdown': { // (timed with its death on screen, HARROW_DEATH in js/render.js, at the game's speed)
      const T = typeof HARROW_DEATH !== 'undefined' ? HARROW_DEATH : { shatter: 0.9, thud: 1.9, burst: 2.8 }, k = 1 / (spd || 1);
      // staggering: a long falling groan, its core crackling as the light stutters
      _tone(58, T.thud * k + 0.6, 'sine', 0.2, 30, 0, D);
      _tone(116, T.shatter * k + 0.5, 'sawtooth', 0.025, 70, 0, D);
      const crk = [];
      for (let i = 0; i < 26; i++) crk.push({ at: Math.random() * T.shatter * k, len: 0.01 + Math.random() * 0.03, amp: 0.03 + Math.random() * 0.04, f: 1800 + Math.random() * 3500 });
      grains(D, crk, 'bandpass', 4);
      // the spires shattering: a glassy crack and a shower of ringing shards
      _noise(0.25, 0.2, { type: 'highpass', freq: 2500, attack: 0.002, delay: T.shatter * k, dest: D });
      for (let i = 0; i < 5; i++) _tone(1900 + Math.random() * 2600, 0.5 + Math.random() * 0.5, 'triangle', 0.018, 0, T.shatter * k + Math.random() * 0.15, D);
      const sh = [];
      for (let i = 0; i < 22; i++) sh.push({ at: T.shatter * k + 0.05 + Math.pow(Math.random(), 1.3) * 1.2, len: 0.02 + Math.random() * 0.05, amp: 0.025 + Math.random() * 0.035, f: 2500 + Math.random() * 4500 });
      grains(D, sh, 'bandpass', 6);
      // the thud as it comes down: the ground jumping, rubble
      _tone(46, 1.4, 'sine', 0.32, 22, T.thud * k, D);
      _noise(0.12, 0.3, { freq: 700, attack: 0.002, delay: T.thud * k, dest: D });
      _noise(1.8, 0.16, { freq: 300, to: 60, attack: 0.05, delay: T.thud * k + 0.03, dest: D });
      // the core bursting: a rising suck of breath, a deep boom and a bright violet ring going out
      _noise(0.5, 0.08, { type: 'bandpass', freq: 300, to: 1600, q: 1.5, attack: 0.4, delay: T.burst * k - 0.45, dest: D });
      _tone(38, 1.8, 'sine', 0.3, 20, T.burst * k, D);
      _noise(1.2, 0.18, { type: 'bandpass', freq: 1400, to: 200, q: 0.8, attack: 0.005, delay: T.burst * k, dest: D });
      _tone(660, 1.4, 'sine', 0.03, 220, T.burst * k, D);
      duckMusic(0.4, T.burst * k + 1.5);
      break;
    }
    case 'beacon': if (typeof ambHum === 'function') ambHum(D); break; // (a Command Base's beacon coming on at dusk: js/ambient.js)
    // Coming down on you: a bomb's whistle as it falls, a missile's roar as it dives in (each ending as it hits).
    case 'bombfall': incoming(D, 'bomb', BOMBER.fall / spd); break;
    case 'incoming': incoming(D, 'missile', MISSILE_WARN / spd); break;
    case 'nukefall': incoming(D, 'nuke', (MISSILE_WARN * 1.6) / spd); break;
    // An aircraft shot down, falling until it hits (AIR_CRASH fall: dur), and its crash: the impact, the airframe
    // tearing across the ground, its fuel going up in a fireball.
    case 'planefall': falling(D, false, (dur || 7) / spd); break;
    case 'blimpfall': falling(D, true, (dur || 11) / spd); break;
    case 'aircrash': case 'aircrashnear':
      blast(D, { size: 1.5, far, gain: 0.7, fire: true }); rubble(D, far);
      _noise(0.9, 0.08 * (1 - 0.5 * far), { type: 'bandpass', freq: 2400, to: 700, q: 2, attack: 0.02, dest: D });
      duckMusic(0.45, 1.6);
      break;
    case 'alert': _tone(880, 0.12, 'square', 0.05, null, 0, D); _tone(660, 0.12, 'square', 0.05, null, 0.15, D); break;
    // A co-op ping (js/coop.js): two bright sonar blips, rising, a spot marked for both of you.
    case 'ping': _tone(1320, 0.09, 'sine', 0.07, 1500, 0, D); _tone(1760, 0.16, 'sine', 0.06, 1900, 0.11, D); break;
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
    // The Mass Driver: its capacitor banks charging (a deep electric hum climbing, a thin capacitor whine over it, a
    // crackle building), then the shot: a hard electromagnetic crack and a heavy thump, the coils' ring, and the canister
    // leaving as a falling rush of air (no whistle: the owner, Nov 21 2026, found the old one a funny whistle).
    case 'mdcharge':
      _tone(55, 1.6, 'sawtooth', 0.05, 110, 0, D); // (the banks' hum, climbing)
      _tone(110, 1.6, 'square', 0.012, 220, 0, D);
      _tone(1200, 1.5, 'sine', 0.008, 5200, 0.1, D); // (the capacitor whine, faint and high)
      _noise(1.5, 0.04, { type: 'bandpass', freq: 2500, to: 6000, q: 4, attack: 1.3, dest: D }); // (the crackle building)
      break;
    case 'mdlaunch':
      _noise(0.03, 0.4, { type: 'highpass', freq: 3000, attack: 0.0005, dest: D }); // (the crack)
      _noise(0.12, 0.25, { type: 'bandpass', freq: 1800, to: 400, q: 1.5, attack: 0.001, dest: D });
      _tone(48, 0.5, 'sine', 0.3, 28, 0, D); // (the thump)
      _tone(96, 0.25, 'triangle', 0.12, 40, 0, D);
      _tone(780, 0.6, 'sawtooth', 0.02, 160, 0.01, D); // (the coils' electric snap falling)
      _tone(1560, 0.9, 'sine', 0.012, 1480, 0.02, D); // (the rails ringing)
      _noise(1.4, 0.07, { type: 'lowpass', freq: 1400, to: 250, attack: 0.05, delay: 0.05, dest: D }); // (the rush of air as it goes)
      break;
    case 'mdcatch':
      _tone(520, 0.6, 'triangle', 0.08, 500, 0, D); _tone(1310, 0.45, 'sine', 0.05, 1290, 0, D); _tone(2090, 0.3, 'sine', 0.025, null, 0, D);
      _noise(0.12, 0.14, { freq: 700, to: 300, attack: 0.001, dest: D });
      _tone(90, 0.3, 'sine', 0.12, 50, 0, D);
      break;
    // The Ring drizzle (updateDrizzle): a soft whoosh falling across the sky and a muffled thud as it lands.
    case 'drizzle':
      _noise(1.3, 0.05, { type: 'bandpass', freq: 2600, to: 500, q: 1.2, attack: 0.5, dest: D });
      _tone(70, 0.3, 'sine', 0.05, 40, 1.35, D);
      _noise(0.3, 0.04, { freq: 500, to: 160, attack: 0.01, delay: 1.35, dest: D });
      break;
    case 'mdburst': blast(D, { size: 0.45, far: Math.max(far, 0.3), gain: 0.8, air: true }); _tone(1800, 0.3, 'triangle', 0.04, 600, 0, D); break;
    case 'mdthud': _tone(80, 0.3, 'sine', 0.15, 45, 0, D); _noise(0.25, 0.12, { freq: 500, to: 150, attack: 0.002, dest: D }); _tone(700, 0.25, 'triangle', 0.03, 400, 0.02, D); break;
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
    // A Torch's flamethrower: a roaring rush of fire with a low rumble under it and a crackle on top.
    case 'flame':
      _noise(0.62, 0.12, { type: 'bandpass', freq: 520, to: 950, q: 0.6, attack: 0.04, dest: D });
      _noise(0.6, 0.09, { type: 'lowpass', freq: 320, to: 170, attack: 0.05, dest: D });
      for (let k = 0; k < 6; k++) _noise(0.015 + Math.random() * 0.02, 0.03 + Math.random() * 0.03, { type: 'highpass', freq: 2500 + Math.random() * 3000, attack: 0.001, delay: 0.05 + Math.random() * 0.5, dest: D });
      break;
    // Fire striking a Bulwark's shield: a bright energy ping that drops away, a hum under it and a fizz of sparks.
    case 'shieldhit':
      _tone(1900, 0.13, 'sine', 0.045, 650, 0, D);
      _tone(2650, 0.28, 'sine', 0.014, 2550, 0, D);
      _tone(360, 0.18, 'triangle', 0.05, 220, 0, D);
      _noise(0.09, 0.035, { type: 'highpass', freq: 5000, attack: 0.002, dest: D });
      break;
    // A Bulwark's shield failing: a glassy shatter and a falling power-down whine.
    case 'shieldbreak':
      _tone(950, 0.65, 'sawtooth', 0.03, 70, 0, D);
      _noise(0.45, 0.08, { type: 'bandpass', freq: 3200, to: 700, q: 0.9, attack: 0.003, dest: D });
      for (let k = 0; k < 8; k++) _tone(2400 + Math.random() * 2600, 0.06, 'sine', 0.018, null, Math.random() * 0.3, D);
      break;
    // An Arc Caster's bolt: a hard electric snap, a buzzing crackle as it jumps, and a thin high zap falling away.
    case 'arc':
      _noise(0.03, 0.09, { type: 'highpass', freq: 2600, attack: 0.001, dest: D });
      for (let k = 0; k < 4; k++) _noise(0.035, 0.05, { type: 'bandpass', freq: 1800 + k * 700, q: 2, attack: 0.002, delay: 0.03 + k * 0.045, dest: D });
      _tone(3200, 0.2, 'sawtooth', 0.016, 700, 0.01, D);
      _tone(120, 0.16, 'square', 0.02, 80, 0, D);
      break;
    // A Railgunner's rail charging: a rising whine.
    case 'railcharge': _tone(400, 0.9, 'sine', 0.022, 3400, 0, D); _tone(800, 0.9, 'triangle', 0.008, 5200, 0.1, D); break;
    // ...and firing: a sharp supersonic crack with a ringing metal tail.
    case 'rail':
      _noise(0.05, 0.16, { type: 'highpass', freq: 1500, attack: 0.001, dest: D });
      _tone(1250, 0.5, 'sine', 0.03, 1180, 0.01, D);
      _tone(170, 0.25, 'triangle', 0.06, 60, 0, D);
      _noise(0.4, 0.03, { type: 'bandpass', freq: 4200, to: 2000, q: 1.4, attack: 0.01, delay: 0.03, dest: D });
      break;
    // Parachutes opening: a cloth crack and the rush of air.
    case 'chute':
      _noise(0.09, 0.12, { type: 'bandpass', freq: 900, q: 1.2, attack: 0.003, dest: D });
      _noise(0.7, 0.05, { type: 'lowpass', freq: 700, to: 300, attack: 0.05, delay: 0.06, dest: D });
      break;
    case 'capture': _tone(392, 0.12, 'triangle', 0.09, null, 0, D); _tone(587, 0.2, 'triangle', 0.09, null, 0.1, D); break;
    case 'error': _tone(200, 0.12, 'square', 0.05, 150, 0, D); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.25, 'triangle', 0.09, null, i * 0.14, D)); break;
    // The end of a game flaring in (overFlare): a rising rush of air under the fanfare; a defeat's falls, low and slow.
    case 'flare': _noise(1.1, 0.05, { type: 'bandpass', freq: 380, to: 3400, q: 0.9, attack: 0.5, dest: D }); _tone(1568, 0.5, 'sine', 0.025, null, 0.55, D); break;
    case 'flareDown': _noise(1.6, 0.06, { type: 'lowpass', freq: 900, to: 140, attack: 0.3, dest: D }); break;
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
    // The colony at work (each from a working factory on screen; see audioTick).
    case 'clank': { // a furnace or forge: a heavy metal clank ringing off
      const f = 180 + Math.random() * 120;
      _noise(0.06, 0.07, { type: 'bandpass', freq: 2200, q: 1.5, dest: D });
      _tone(f, 0.35, 'triangle', 0.035, f * 0.97, 0, D); _tone(f * 2.76, 0.22, 'sine', 0.018, null, 0, D);
      break;
    }
    case 'furnace': _noise(1.1, 0.04, { freq: 260, to: 180, attack: 0.25, dest: D }); break; // the roar of a fire drawing
    case 'machine': { // a lathe or mill biting: a tool whine rising into the cut and falling away, with a metallic hiss
      const f = 520 + Math.random() * 260;
      _tone(f, 0.55, 'sawtooth', 0.006, f * 1.35, 0, D); _tone(f * 1.5, 0.45, 'triangle', 0.004, f * 1.9, 0.08, D);
      _noise(0.4, 0.02, { type: 'bandpass', freq: 4200, q: 3, attack: 0.12, delay: 0.1, dest: D });
      break;
    }
    case 'ratchet': { // an impact wrench: a quick burst of hammering clicks
      const n = 5 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) { _noise(0.025, 0.035, { type: 'bandpass', freq: 1700 + Math.random() * 400, q: 4, delay: k * 0.045, dest: D }); _tone(260, 0.03, 'square', 0.008, null, k * 0.045, D); }
      break;
    }
    case 'press': // a hydraulic press: a deep thump, then the hiss of air let out
      _tone(58, 0.3, 'sine', 0.08, 40, 0, D); _noise(0.08, 0.05, { type: 'bandpass', freq: 900, q: 1.5, dest: D });
      _noise(0.6, 0.02, { type: 'highpass', freq: 3200, attack: 0.05, delay: 0.25, dest: D });
      break;
    case 'drill': for (let k = 0; k < 6; k++) _noise(0.05, 0.035, { type: 'bandpass', freq: 900 + Math.random() * 300, q: 2, delay: k * 0.06, dest: D }); break;
    case 'pumpthump': _tone(70, 0.18, 'sine', 0.07, 48, 0, D); _noise(0.25, 0.018, { type: 'highpass', freq: 3000, delay: 0.12, dest: D }); break;
    case 'beeps': for (let k = 0; k < 3; k++) _tone([1320, 1760, 1480, 1980][Math.floor(Math.random() * 4)], 0.05, 'square', 0.012, null, k * 0.08, D); break;
    case 'chop': _noise(0.07, 0.06, { type: 'bandpass', freq: 700, q: 1.2, dest: D }); _tone(140, 0.08, 'sine', 0.04, 90, 0, D); break;
    case 'honkfar': { const f = 330 + Math.random() * 90; _tone(f, 0.22, 'square', 0.012, null, 0, D); _tone(f * 1.26, 0.22, 'square', 0.009, null, 0, D); break; } // a car horn a few streets away
    // Aircraft: the approach (engines throttled back, whining down) and the touchdown (tyres chirping, reverse thrust roaring).
    case 'approach': _noise(2.4, 0.05, { type: 'bandpass', freq: 1400, to: 600, q: 0.9, attack: 0.5, dest: D }); _tone(240, 2.2, 'sawtooth', 0.012, 120, 0, D); break;
    case 'touchdown':
      _noise(0.12, 0.08, { type: 'bandpass', freq: 2600, q: 3, dest: D }); _noise(0.1, 0.06, { type: 'bandpass', freq: 2300, q: 3, delay: 0.16, dest: D });
      _noise(2.2, 0.09, { type: 'bandpass', freq: 500, to: 220, q: 0.6, attack: 0.25, delay: 0.3, dest: D });
      _tone(64, 1.8, 'sawtooth', 0.025, 40, 0.3, D);
      break;
    case 'planetakeoff': // someone else's plane rolling out on screen (your own get 'takeoff', heard wherever they are)
      _noise(2.4, 0.07, { type: 'bandpass', freq: 240, to: 900, q: 0.7, attack: 0.6, dest: D });
      _tone(60, 2.2, 'sawtooth', 0.02, 95, 0, D);
      break;
    // Trains: a two-tone horn pulling out, brakes squealing coming in, and the wheels over a rail joint.
    case 'trainhorn': [233, 277, 349].forEach((f) => { _tone(f, 1.1, 'sawtooth', 0.016, f * 0.99, 0, D); _tone(f, 0.5, 'sawtooth', 0.014, null, 1.25, D); }); break;
    case 'brakes': _noise(1.6, 0.03, { type: 'bandpass', freq: 3800, to: 3200, q: 9, attack: 0.2, dest: D }); _tone(3400, 1.4, 'sine', 0.006, 3000, 0.1, D); break;
    case 'clack': _noise(0.035, 0.05, { type: 'bandpass', freq: 1800, q: 1.6, dest: D }); _noise(0.035, 0.04, { type: 'bandpass', freq: 1500, q: 1.6, delay: 0.085, dest: D }); _tone(95, 0.06, 'sine', 0.03, 70, 0, D); break;
    case 'shiphorn': _tone(98, 1.8, 'sawtooth', 0.03, 96, 0, D); _tone(147, 1.8, 'sawtooth', 0.018, 145, 0, D); break;
    case 'bubble': { const f = 90 + Math.random() * 80; _tone(f, 0.14, 'sine', 0.05, f * 2.2, 0, D); _noise(0.2, 0.02, { freq: 300, dest: D }); break; } // lava
    case 'cricket': { const f = 4300 + Math.random() * 500; for (let k = 0; k < 3; k++) _tone(f, 0.035, 'triangle', 0.008, null, k * 0.06, D); break; }
    case 'scrape': _noise(0.22, 0.06, { type: 'bandpass', freq: 600, to: 1400, q: 0.8, attack: 0.04, dest: D }); break;
    // Hot asphalt laid by a Paver: a soft steamy hiss.
    case 'hiss': _noise(0.7, 0.035, { type: 'highpass', freq: 3500, to: 6000, attack: 0.12, dest: D }); break;
    // A Freight Truck's air brakes.
    case 'airbrake':
      _tone(145, 0.05, 'triangle', 0.008, 90, 0, D);
      _noise(0.27, 0.014, { type: 'bandpass', freq: 1800, to: 2600, attack: 0.02, delay: 0.03, dest: D });
      break;
    // Busy streets (see audioTick: from where the traffic on screen bunches up).
    case 'passby': { const f = 85 + Math.random() * 30; _tone(f, 0.9, 'sawtooth', 0.011, f * 0.8, 0, D); _noise(0.9, 0.02, { type: 'bandpass', freq: 380, to: 820, q: 0.8, attack: 0.35, dest: D }); break; } // an engine going by
    case 'beepback': for (let k = 0; k < 3; k++) _tone(1040, 0.12, 'square', 0.006, null, k * 0.32, D); break; // a truck's warning beeps, backing or pulling round
    case 'toot': { const f = 420 + Math.random() * 80; _tone(f, 0.12, 'square', 0.009, null, 0, D); _tone(f * 1.25, 0.12, 'square', 0.007, null, 0, D); break; } // a quick tap on the horn
    case 'chirp': _tone(1500 + Math.random() * 500, 0.05, 'sine', 0.011, 2100, 0, D); _tone(1900 + Math.random() * 400, 0.05, 'sine', 0.009, 1500, 0.08, D); break; // a robot's 'coming through'
    case 'servo': _tone(700, 0.22, 'sawtooth', 0.004, 1150, 0, D); _noise(0.2, 0.009, { type: 'bandpass', freq: 2500, q: 2, dest: D }); break; // a servo whirring
    // A Freight Truck's horn, stuck in traffic.
    case 'honk': {
      const lp = AUDIO.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(D);
      for (const [f, dl] of [[311, 0], [370, 0], [311, 0.3], [370, 0.3]]) _tone(f, 0.22, 'sawtooth', 0.035, f * 0.98, dl, lp);
      break;
    }
    // The Lance of Corvane starts its charge: heavy contactors closing, then the turbines spinning up (its hum, lanceHum, carries on).
    case 'lancecharge':
      _noise(0.12, 0.12, { type: 'lowpass', freq: 500, dest: D }); _tone(70, 0.4, 'square', 0.03, 45, 0, D);
      _noise(0.1, 0.1, { type: 'lowpass', freq: 400, delay: 0.25, dest: D }); _tone(60, 0.35, 'square', 0.025, 40, 0.25, D);
      _tone(80, 2.4, 'sawtooth', 0.03, 240, 0.4, D); _tone(160, 2.4, 'sine', 0.025, 480, 0.4, D);
      break;
    // The Lance fires: a splitting crack like close thunder, the beam's roar tearing across the map, a deep shock under it.
    case 'lancefire':
      _noise(0.09, 0.4, { type: 'highpass', freq: 2200, attack: 0.002, dest: D });
      _tone(2600, 0.25, 'sawtooth', 0.05, 180, 0, D);
      _noise(2.8, 0.26, { type: 'bandpass', freq: 1400, to: 160, q: 0.5, attack: 0.03, delay: 0.02, dest: D });
      _noise(3.6, 0.2, { type: 'lowpass', freq: 600, to: 70, attack: 0.15, delay: 0.1, dest: D });
      _tone(42, 2.6, 'sine', 0.3, 26, 0.05, D);
      blast(D, { size: 2.2, far: Math.min(far, 0.4), gain: 0.7, delay: 0.05, deep: true });
      duckMusic(0.3, 3);
      break;
    // The Sundering Ray starts its wind-up: the hydraulic pumps kicking in, a hiss of pressure building in the lines.
    case 'sundercharge':
      _noise(0.14, 0.12, { type: 'lowpass', freq: 380, dest: D }); _tone(55, 0.5, 'square', 0.03, 38, 0, D);
      _noise(1.8, 0.05, { type: 'bandpass', freq: 1800, to: 3400, q: 2, attack: 0.2, delay: 0.2, dest: D });
      _tone(48, 2.2, 'sawtooth', 0.025, 70, 0.3, D);
      break;
    // One stroke of a great ram: a deep, heavy thud through the ground, a clank of steel on its seat, a short gasp of hydraulics.
    case 'sunderthud':
      _tone(52, 0.38, 'sine', 0.22, 30, 0, D); _tone(104, 0.12, 'triangle', 0.06, 50, 0, D);
      _noise(0.16, 0.12, { type: 'lowpass', freq: 260, to: 90, attack: 0.003, dest: D });
      _noise(0.06, 0.03, { type: 'bandpass', freq: 1600, q: 3, attack: 0.001, delay: 0.01, dest: D });
      _noise(0.22, 0.025, { type: 'highpass', freq: 2600, attack: 0.02, delay: 0.12, dest: D });
      break;
    // The blow: the bore charge going off under the tower, the six plates slamming in a rolling ripple, a long low shudder.
    case 'sunderfire':
      _noise(0.1, 0.35, { type: 'lowpass', freq: 900, to: 200, attack: 0.002, dest: D });
      _tone(38, 1.8, 'sine', 0.32, 22, 0, D);
      for (let k = 0; k < 6; k++) { _tone(60 - k * 2, 0.22, 'sine', 0.16, 34, 0.1 + k * 0.07, D); _noise(0.08, 0.06, { type: 'lowpass', freq: 320, delay: 0.1 + k * 0.07, dest: D }); }
      _noise(2.6, 0.14, { type: 'lowpass', freq: 160, to: 50, attack: 0.3, delay: 0.3, dest: D });
      blast(D, { size: 1.8, far: Math.min(far, 0.5), gain: 0.55, delay: 0.02, deep: true });
      duckMusic(0.4, 2.5);
      break;
    // The ripple lands: the quake's rumble rolling up out of the ground, stone cracking, rubble settling.
    case 'sunderquake':
      _noise(3.2, 0.3, { type: 'lowpass', freq: 140, to: 40, attack: 0.25, dest: D });
      _tone(31, 2.8, 'sine', 0.28, 24, 0, D); _tone(46, 2.2, 'triangle', 0.08, 30, 0.1, D);
      for (let k = 0; k < 7; k++) _noise(0.05, 0.06, { type: 'bandpass', freq: 900 + Math.random() * 1600, q: 2, attack: 0.001, delay: 0.15 + Math.random() * 1.6, dest: D });
      _noise(1.4, 0.06, { type: 'bandpass', freq: 500, to: 220, q: 0.8, attack: 0.1, delay: 1.2, dest: D });
      duckMusic(0.5, 2.5);
      break;
    // Something strikes a Shield Dome: a low resonant thrum through the field, and a glassy shimmer on top.
    case 'domehit': {
      const ac = AUDIO.ctx, t0 = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(92, t0); o.frequency.exponentialRampToValueAtTime(64, t0 + 0.9);
      lfo.frequency.value = 17; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.16, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.0);
      o.connect(g).connect(D); o.start(t0); lfo.start(t0); o.stop(t0 + 1.05); lfo.stop(t0 + 1.05);
      _noise(0.5, 0.05, { type: 'bandpass', freq: 3200, to: 1800, q: 3, attack: 0.005, dest: D });
      _tone(1320, 0.6, 'sine', 0.02, 1180, 0.01, D); _tone(1980, 0.45, 'sine', 0.012, 1760, 0.01, D);
      break;
    }
    // A Shield Dome drops: the field's note falling away, the lattice shattering into a hiss of crackle.
    case 'domefall':
      _tone(420, 1.6, 'sawtooth', 0.05, 38, 0, D); _tone(630, 1.2, 'sine', 0.03, 60, 0, D);
      _noise(1.4, 0.12, { type: 'highpass', freq: 5000, to: 900, attack: 0.01, dest: D });
      for (let k = 0; k < 10; k++) _tone(1800 + Math.random() * 2600, 0.05, 'square', 0.012, null, 0.05 + Math.random() * 1.2, D);
      _noise(1.6, 0.08, { type: 'lowpass', freq: 300, to: 60, delay: 0.1, dest: D });
      break;
    // Arrival City changing hands, or lit again: the recorded tram-stop chime, four soft bell notes rising, for no one.
    case 'citychime':
      for (const [f, dl] of [[523.3, 0], [659.3, 0.42], [784, 0.84], [1046.5, 1.26]]) { _tone(f, 1.4, 'sine', 0.05, null, dl, D); _tone(f * 2.01, 0.7, 'sine', 0.012, null, dl, D); _tone(f * 3.02, 0.3, 'sine', 0.005, null, dl, D); }
      break;
    // A Deep Core reaching a new depth: the drill breaking through, a deep thud and a long falling rumble, and under it a
    // low note from further down that holds a moment longer than it should.
    case 'deepstage':
      _tone(55, 0.7, 'sine', 0.16, 34, 0, D);
      _noise(1.6, 0.09, { type: 'lowpass', freq: 260, delay: 0.05, dest: D });
      _tone(41.2, 3.2, 'triangle', 0.035, 38, 0.6, D);
      _tone(82.4 * 1.004, 2.6, 'sine', 0.012, 79, 0.9, D);
      break;
    // An Atmosphere Engine reaching a new stage: a long breath of air through its fans, a soft rising open fifth over
    // it, and the patter of the first rain.
    // Lightning out of a Storm Front striking a building: a sharp crack right on top of it, then the thunder's long roll.
    case 'stormbolt':
      _noise(0.12, 0.16, { type: 'highpass', freq: 1400, delay: 0, dest: D });
      _noise(0.35, 0.12, { type: 'lowpass', freq: 2200, to: 600, attack: 0.005, delay: 0.02, dest: D });
      _noise(3.2, 0.09, { type: 'lowpass', freq: 300, to: 60, attack: 0.25, delay: 0.15, dest: D });
      _noise(2.2, 0.05, { type: 'lowpass', freq: 170, to: 50, attack: 0.4, delay: 0.9, dest: D });
      break;
    case 'atmosstage':
      _noise(2.6, 0.05, { type: 'bandpass', freq: 520, delay: 0, dest: D });
      for (const [f, dl] of [[196, 0.2], [293.7, 0.6], [392, 1.0]]) { _tone(f, 2.4, 'sine', 0.03, f * 1.002, dl, D); _tone(f * 2.003, 1.6, 'sine', 0.008, null, dl + 0.05, D); }
      _noise(2.2, 0.025, { type: 'highpass', freq: 2600, delay: 1.1, dest: D });
      break;
    // An Orbital Lift's climber setting off: a rising electric whine, and the clack of its clamps passing the first joints.
    case 'liftclimb':
      _tone(180, 2.2, 'sawtooth', 0.018, 900, 0, D);
      _tone(360, 2.2, 'sine', 0.02, 1500, 0.05, D);
      for (let k = 0; k < 5; k++) _noise(0.04, 0.05, { type: 'bandpass', freq: 2400, delay: 0.25 + k * 0.32, dest: D });
      break;
    // A climber landing: a heavy clunk as it seats on the collar, then the pneumatic hiss of its doors opening.
    case 'liftland':
      _tone(70, 0.5, 'sine', 0.14, 40, 0, D);
      _noise(0.18, 0.12, { type: 'lowpass', freq: 500, dest: D });
      _noise(1.1, 0.05, { type: 'highpass', freq: 3000, delay: 0.45, dest: D });
      break;
    // The cable groaning under load: a long low creak bending in pitch, like a held string about to go.
    case 'liftgroan':
      _tone(62, 2.6, 'sawtooth', 0.03, 48, 0, D);
      _tone(94, 2.2, 'triangle', 0.02, 120, 0.3, D);
      _noise(2.4, 0.03, { type: 'bandpass', freq: 220, delay: 0.1, dest: D });
      break;
    // The cable snapping free: a sharp crack like a snapped string, and the first of the rumble.
    case 'liftsnap':
      _noise(0.08, 0.3, { type: 'highpass', freq: 1800, dest: D });
      _tone(880, 0.35, 'sawtooth', 0.05, 110, 0.01, D);
      _noise(2.2, 0.12, { type: 'lowpass', freq: 260, to: 50, delay: 0.1, dest: D });
      break;
    // Its cable striking the ground, tile after tile: a rolling thud, running away from the anchor.
    case 'liftimpact':
      _tone(55 + Math.random() * 20, 0.6, 'sine', 0.08, 30, 0, D);
      _noise(0.5, 0.07, { type: 'lowpass', freq: 380, to: 80, dest: D });
      break;
    // A Great Uplink begins transmitting: relays closing, the carrier sweeping up from nothing to its note, the first pulse.
    case 'gupbegin':
      _noise(0.1, 0.1, { type: 'lowpass', freq: 600, dest: D }); _tone(64, 0.3, 'square', 0.02, 44, 0, D);
      _tone(110, 2.4, 'sine', 0.05, 440, 0.2, D); _tone(220, 2.4, 'triangle', 0.012, 880, 0.2, D);
      _noise(1.8, 0.03, { type: 'bandpass', freq: 2400, to: 900, q: 4, delay: 0.3, dest: D });
      _tone(880, 1.2, 'sine', 0.05, null, 2.6, D);
      break;
    // Its signal's slow pulse (one every GUP.pulse s while it transmits): a soft deep throb and a clear high ping fading,
    // with a breath of static under it.
    case 'guppulse':
      _tone(110, 0.9, 'sine', 0.07, 98, 0, D); _tone(880, 1.4, 'sine', 0.035, null, 0.02, D); _tone(1320, 0.7, 'sine', 0.008, null, 0.02, D);
      _noise(0.6, 0.012, { type: 'bandpass', freq: 3000, q: 1.5, dest: D });
      break;
    // In the last seconds, the Murmur repeating the pulse back from the ground: the same shape, low, muffled and a little
    // off, as if through rock.
    case 'gupecho': {
      const lp = AUDIO.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.connect(D);
      _tone(55, 1.1, 'sine', 0.09, 50, 0, lp); _tone(437, 1.3, 'triangle', 0.04, 431, 0.03, lp);
      _noise(0.9, 0.04, { type: 'lowpass', freq: 240, to: 120, dest: lp });
      break;
    }
    // Contact: after the silence, one answering tone, pure and long, from nowhere in particular.
    case 'gupanswer':
      _tone(587.3, 5.5, 'sine', 0.06, null, 0, D); _tone(880, 4.2, 'sine', 0.012, null, 0.6, D); _tone(293.7, 5, 'sine', 0.02, null, 0.2, D);
      break;
    // The Arrival clock striking: two slow, low bell notes from the stele in the square, the second a little lower, fading long.
    case 'cityclock':
      for (const [f, dl] of [[392, 0], [329.6, 0.9]]) { _tone(f, 2.6, 'sine', 0.035, null, dl, D); _tone(f * 2.76, 1.1, 'sine', 0.008, null, dl, D); _tone(f * 0.5, 2.2, 'sine', 0.02, null, dl, D); }
      break;
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

/*
 * The Lance of Corvane's hum while it charges, heard by every player: a deep electrical drone with a beating tremolo,
 * rising in pitch and brightness as the charge climbs (k: the fullest charge of any Lance, 0..1; 0 stops it), louder
 * for the one on screen (near 0..1).
 */
const HUM = { o: null };
function lanceHum(k, near) {
  const ac = AUDIO.ctx;
  if (!ac || !sfxReady()) k = 0;
  if (!k) {
    if (HUM.o) { const t = ac.currentTime, h = HUM.o; HUM.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.25); setTimeout(() => { try { h.a.stop(); h.b.stop(); h.l.stop(); } catch (e) { /* gone */ } }, 1500); }
    return;
  }
  if (!HUM.o) {
    const a = ac.createOscillator(), b = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), am = ac.createGain(), lp = ac.createBiquadFilter(), g = ac.createGain();
    a.type = 'sawtooth'; b.type = 'sine'; l.type = 'sine';
    lp.type = 'lowpass'; lp.Q.value = 2.5; am.gain.value = 0.75; lg.gain.value = 0.25; l.frequency.value = 6;
    g.gain.value = 0.0001;
    l.connect(lg).connect(am.gain);
    a.connect(lp); b.connect(lp); lp.connect(am).connect(g).connect(AUDIO.fxBus);
    a.start(); b.start(); l.start();
    HUM.o = { a, b, l, lp, g };
  }
  const t = ac.currentTime, h = HUM.o;
  h.a.frequency.setTargetAtTime(38 + 90 * k, t, 0.3); h.b.frequency.setTargetAtTime(76 + 260 * k * k, t, 0.3);
  h.l.frequency.setTargetAtTime(4 + 14 * k, t, 0.3);
  h.lp.frequency.setTargetAtTime(220 + 2400 * k * k, t, 0.3);
  h.g.gain.setTargetAtTime((0.02 + 0.06 * k) * (0.45 + 0.55 * near), t, 0.3);
}

/*
 * Arrival City on screen, lit: the hum of an empty city (the low drone of its services running, a soft wind between
 * the blocks), as loud as it is near the middle of the screen (k 0..1; 0 stops it). On the Ambience volume.
 */
const CITYHUM = { o: null };
function cityHum(k) {
  const ac = AUDIO.ctx;
  if (!ac || !natureReady()) k = 0;
  if (!k) {
    if (CITYHUM.o) { const t = ac.currentTime, h = CITYHUM.o; CITYHUM.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { h.a.stop(); h.b.stop(); h.n.stop(); } catch (e) { /* gone */ } }, 3000); }
    return;
  }
  if (!CITYHUM.o) {
    const a = ac.createOscillator(), b = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    a.type = 'sine'; b.type = 'sine'; a.frequency.value = 55; b.frequency.value = 110.6; // (a mains hum, beating slowly)
    const n = ac.createBufferSource(), len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < len; i++) { v = v * 0.985 + (Math.random() * 2 - 1) * 0.015; d[i] = v * 6; } // (brown-ish: wind)
    n.buffer = buf; n.loop = true;
    lp.type = 'lowpass'; lp.frequency.value = 420;
    const ga = ac.createGain(), gb = ac.createGain(), gn = ac.createGain(); ga.gain.value = 0.5; gb.gain.value = 0.22; gn.gain.value = 0.9;
    a.connect(ga).connect(lp); b.connect(gb).connect(lp); n.connect(gn).connect(lp); lp.connect(g).connect(AUDIO.natureBus);
    g.gain.value = 0.0001;
    a.start(); b.start(); n.start();
    CITYHUM.o = { a, b, n, g };
  }
  CITYHUM.o.g.gain.setTargetAtTime(0.035 * k, ac.currentTime, 0.8);
}

/*
 * An Orbital Lift on screen: the low steady note of its tensioned cable, like a held string, louder the nearer the middle
 * of the screen (k 0..1; 0 stops it), and a whine over it while a climber is on the move (w 0..1). On the Ambience volume.
 */
const LIFTHUM = { o: null };
function liftHum(k, w) {
  const ac = AUDIO.ctx;
  if (!ac || !natureReady()) k = 0;
  if (!k) {
    if (LIFTHUM.o) { const t = ac.currentTime, h = LIFTHUM.o; LIFTHUM.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { h.a.stop(); h.b.stop(); h.c.stop(); } catch (e) { /* gone */ } }, 3000); }
    return;
  }
  if (!LIFTHUM.o) {
    const a = ac.createOscillator(), b = ac.createOscillator(), c = ac.createOscillator(), g = ac.createGain(), gw = ac.createGain(), lp = ac.createBiquadFilter();
    a.type = 'sine'; b.type = 'triangle'; c.type = 'sawtooth'; a.frequency.value = 73.4; b.frequency.value = 146.9 * 1.003; c.frequency.value = 520;
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const ga = ac.createGain(), gb = ac.createGain(); ga.gain.value = 0.6; gb.gain.value = 0.18; gw.gain.value = 0;
    a.connect(ga).connect(lp); b.connect(gb).connect(lp); c.connect(gw).connect(lp); lp.connect(g).connect(AUDIO.natureBus);
    g.gain.value = 0.0001;
    a.start(); b.start(); c.start();
    LIFTHUM.o = { a, b, c, g, gw };
  }
  const t = ac.currentTime;
  LIFTHUM.o.g.gain.setTargetAtTime(0.03 * k, t, 0.8);
  LIFTHUM.o.gw.gain.setTargetAtTime(0.05 * (w || 0), t, 0.4);
  LIFTHUM.o.c.frequency.setTargetAtTime(380 + 420 * (w || 0), t, 1.2);
}

/*
 * A Deep Core at work on screen: its winding engine and the drill far down the shaft. A low drone that sinks with each
 * stage (the shaft deeper), a grinding band of noise, and the winding wheels' slow clank (a pulse on the noise) as the
 * ropes run (k 0..1 by how near the middle of the screen it is; 0 stops it). On the ambience volume, like the Lift's.
 */
const DEEPHUM = { o: null };
function deepHum(k, stage) {
  const ac = AUDIO.ctx;
  if (!ac || !natureReady()) k = 0;
  if (!k) {
    if (DEEPHUM.o) { const t = ac.currentTime, h = DEEPHUM.o; DEEPHUM.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { h.a.stop(); h.n.stop(); h.l.stop(); } catch (e) { /* gone */ } }, 3000); }
    return;
  }
  if (!DEEPHUM.o) {
    const a = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), gn = ac.createGain(), ga = ac.createGain();
    const n = ac.createBufferSource(), len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf; n.loop = true;
    a.type = 'sawtooth'; a.frequency.value = 49; lp.type = 'lowpass'; lp.frequency.value = 260;
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 2.2;
    // the wheels' clank: a slow square pulse swinging the grinding band's level
    const l = ac.createOscillator(), lg = ac.createGain(); l.type = 'square'; l.frequency.value = 1.4; lg.gain.value = 0.35; gn.gain.value = 0.45;
    l.connect(lg).connect(gn.gain);
    ga.gain.value = 0.5;
    a.connect(ga).connect(lp); n.connect(bp).connect(gn).connect(lp); lp.connect(g).connect(AUDIO.natureBus);
    g.gain.value = 0.0001;
    a.start(); n.start(); l.start();
    DEEPHUM.o = { a, n, l, g };
  }
  const t = ac.currentTime;
  DEEPHUM.o.g.gain.setTargetAtTime(0.045 * k, t, 0.8);
  DEEPHUM.o.a.frequency.setTargetAtTime([49, 43.6, 36.7][Math.max(0, Math.min(2, (stage || 1) - 1))], t, 2);
}

/*
 * An Atmosphere Engine at work on screen: the rush of air up its shell, a soft roar of its intake fans (a slow swell in
 * it), and from Rain on a hiss of rain round it (k 0..1 by how near the middle of the screen it is; 0 stops it).
 */
const AEHUM = { o: null };
function atmosHum(k, stage) {
  const ac = AUDIO.ctx;
  if (!ac || !natureReady()) k = 0;
  if (!k) {
    if (AEHUM.o) { const t = ac.currentTime, h = AEHUM.o; AEHUM.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.6); setTimeout(() => { try { h.n.stop(); h.l.stop(); } catch (e) { /* gone */ } }, 3000); }
    return;
  }
  if (!AEHUM.o) {
    const g = ac.createGain(), lp = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), gr = ac.createGain(), ga = ac.createGain();
    const n = ac.createBufferSource(), len = ac.sampleRate * 2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf; n.loop = true;
    lp.type = 'lowpass'; lp.frequency.value = 420; hp.type = 'highpass'; hp.frequency.value = 3200;
    const l = ac.createOscillator(), lg = ac.createGain(); l.type = 'sine'; l.frequency.value = 0.18; lg.gain.value = 0.25; ga.gain.value = 0.75;
    l.connect(lg).connect(ga.gain);
    n.connect(lp).connect(ga).connect(g); n.connect(hp).connect(gr).connect(g); gr.gain.value = 0;
    g.connect(AUDIO.natureBus); g.gain.value = 0.0001;
    n.start(); l.start();
    AEHUM.o = { n, l, g, gr };
  }
  const t = ac.currentTime;
  AEHUM.o.g.gain.setTargetAtTime(0.05 * k, t, 0.8);
  AEHUM.o.gr.gain.setTargetAtTime((stage || 1) >= 2 ? 0.18 : 0, t, 2);
}

/*
 * Burning oil on screen (an oil well, a Refinery or a Fuel Tank set alight: js/warfx.js): a low roar, a rumble of
 * turbulent fire with a slow surge in it, panned to the loudest well (pan -1..1) and as loud as it is near the middle of
 * the screen and fierce (k 0..1; 0 stops it). One voice for them all, so several wells never stack: more of them only
 * bring it up a little (n). On the Effects volume.
 */
const OILROAR = { o: null };
function oilRoar(k, pan, n) {
  const ac = AUDIO.ctx;
  if (!ac || !sfxReady()) k = 0;
  if (!k) {
    if (OILROAR.o) { const t = ac.currentTime, h = OILROAR.o; OILROAR.o = null; h.g.gain.setTargetAtTime(0.0001, t, 0.5); setTimeout(() => { try { h.n.stop(); h.l.stop(); } catch (e) { /* gone */ } }, 2500); }
    return;
  }
  if (!OILROAR.o) {
    const n0 = ac.createBufferSource(), len = ac.sampleRate * 3, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let v = 0; for (let i = 0; i < len; i++) { v = v * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = v * 5; } // (brown: the body of the roar)
    n0.buffer = buf; n0.loop = true;
    const lp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), gb = ac.createGain(), am = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.7;
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.8; gb.gain.value = 0.18; // (a hiss of flame over it)
    l.type = 'sine'; l.frequency.value = 0.35; lg.gain.value = 0.25; am.gain.value = 0.8; // (the slow surge)
    l.connect(lg).connect(am.gain);
    n0.connect(lp).connect(am); n0.connect(bp).connect(gb).connect(am);
    const pn = ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (pn) am.connect(g).connect(pn).connect(AUDIO.fxBus); else am.connect(g).connect(AUDIO.fxBus);
    g.gain.value = 0.0001;
    n0.start(); l.start();
    OILROAR.o = { n: n0, l, g, pn };
  }
  const t = ac.currentTime, h = OILROAR.o;
  h.g.gain.setTargetAtTime(0.11 * k * Math.min(1.3, 1 + 0.12 * ((n || 1) - 1)), t, 0.6);
  if (h.pn) h.pn.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, pan || 0)), t, 0.4);
}

/** Contact (the Great Uplink win): the music falls away to silence, and after it one answering tone (sfx 'gupanswer'). */
function gupSilence() {
  duckMusic(0.0001, 14);
  setTimeout(() => sfx('gupanswer'), 2200);
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
 * The air raid siren. While enemy Vulcan Bombers are in the air coming for you (a target of yours, or flying
 * over your land), a motor siren wails out across the colony: two rotors a third apart spinning up and down,
 * echoing off the hills. When the last one has gone it winds down, and it won't start again for a few seconds.
 */
const RAID = { voice: null, quietUntil: 0, last: 0, next: 0 };
const SIREN = { lo: 150, hi: 560, rise: 3.4, hold: 0.7, fall: 3.6, third: 1.2, level: 0.055, rest: 6 };

/** Are enemy Vulcan Bombers in the air coming for player 0 (at a target of theirs, or over their land)? */
function raidOn() {
  if (typeof S === 'undefined' || !S || !S.bots || !S.players[ME] || S.players[ME].absent) return false;
  for (const u of S.bots) {
    if (u.dead || u.owner <= 0 || u.type !== 'bomber' || !u.flight || !((u.alt || 0) > 0.05)) continue;
    const tg = u.mission && u.mission.target ? getE(u.mission.target) : null;
    if (tg && !tg.dead && tg.owner === ME) return true;
    if (u.mission && u.mission.napalm && inMap(u.mission.x, u.mission.y) && soilHolder(tIdx(u.mission.x, u.mission.y)) === ME) return true; // (napalm for our farmland)
    const i = Math.floor(u.x), j = Math.floor(u.y);
    if (inMap(i, j) && S.owner[tIdx(i, j)] === ME) return true;
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

const WORLD = { t: 0, honk: {}, brake: {}, mood: 0, bed: null, ph: {}, vel: {}, horn: {}, port: {} };

/** What each kind of working factory sounds like (see audioTick). */
const WORK_SOUNDS = {
  // (The Smelter and the Bot Foundry have the most to say: under the factory hum, a mix of clanks, presses, wrenches
  // and machine tools keeps it from droning.)
  smelter: ['clank', 'furnace', 'press', 'clank', 'machine'], foundry: ['clank', 'ratchet', 'machine', 'press', 'clank', 'furnace', 'ratchet'],
  kiln: ['furnace', 'clank'], tarworks: ['furnace'], munitions: ['clank', 'beeps', 'machine'],
  fab: ['beeps', 'machine'], lab: ['beeps'], armory: ['clank', 'machine', 'ratchet'], mine: ['drill'], quarry: ['drill', 'chop'], harvester: ['chop'], pump: ['pumpthump'],
  refinery: ['pumpthump', 'furnace'], tap: ['pumpthump'], roadworks: ['clank'], generator: ['pumpthump'], repair: ['clank'],
};

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
  // A Sundering Ray winding up anywhere: a deep thud at every stroke of its rams, in time with them (sunderPhase).
  if (inGame && !UI.paused && S.winner < 0) {
    const was = WORLD.sray && WORLD.sray.of === S ? WORLD.sray : { of: S }, now = { of: S };
    for (const b of S.buildings) {
      if (b.dead || !b.sOn || !BDEFS[b.type].sunder) continue;
      const k = Math.floor(sunderPhase(b) * 2);
      if (was[b.id] !== undefined && k !== was[b.id]) { const c = bCentre(b); sfx('sunderthud', c.x, c.y); }
      now[b.id] = k;
    }
    WORLD.sray = now;
  }
  WORLD.bt = (WORLD.bt || 0) - dt;
  if (WORLD.bt <= 0) {
    const live = !!(inGame && !UI.paused && S.winner < 0);
    updateBeds(live, 0.25 - WORLD.bt);
    sirenTick(live);
    // The Lance of Corvane charging anywhere: its hum, by the fullest charge (louder with one on screen).
    let hk = 0, near = 0;
    if (live) for (const b of S.buildings) if (!b.dead && b.lOn && BDEFS[b.type].lance) { const k = Math.min(1, b.lCharge / lanceTime(b)); if (k > hk) hk = k; const p = worldToScreen(b.x + 1.5, b.y + 1.5); if (p.x > -50 && p.y > -50 && p.x < R.w + 50 && p.y < R.h + 50) near = 1; }
    lanceHum(live ? Math.max(hk, 0.02 * (hk > 0)) : 0, near);
    // Arrival City on screen, lit: its hum, and now and then its clock striking.
    let ck = 0, cb = null;
    if (live) for (const b of S.buildings) {
      if (b.dead || !b.built || !BDEFS[b.type].city || b.cDown) continue;
      const m = bCentre(b), p = worldToScreen(m.x, m.y);
      if (p.x < -80 || p.y < -80 || p.x > R.w + 80 || p.y > R.h + 80) continue;
      const k = 1 - Math.min(1, Math.hypot(p.x - R.w / 2, p.y - R.h / 2) / Math.max(R.w, R.h));
      if (k > ck) { ck = k; cb = m; }
    }
    cityHum(ck);
    // An Orbital Lift on screen: its cable's note, and a climber's whine while one is on the move.
    let lk = 0, lw = 0;
    if (live) for (const b of S.buildings) {
      if (b.dead || !b.built || !BDEFS[b.type].lift) continue;
      const m = bCentre(b), p = worldToScreen(m.x, m.y);
      if (p.x < -80 || p.y < -200 || p.x > R.w + 80 || p.y > R.h + 80) continue;
      const k = 1 - Math.min(1, Math.hypot(p.x - R.w / 2, p.y - R.h / 2) / Math.max(R.w, R.h));
      if (k > lk) { lk = k; lw = b.lfMove && b.lfPaid ? 1 : 0; }
    }
    liftHum(lk, lw);
    // A Deep Core at work on screen: its winding engine and drill, deeper with each stage.
    let dk = 0, ds = 1;
    if (live) for (const b of S.buildings) {
      if (b.dead || !b.built || !b.working || !BDEFS[b.type].deepcore) continue;
      const m = bCentre(b), p = worldToScreen(m.x, m.y);
      if (p.x < -80 || p.y < -120 || p.x > R.w + 80 || p.y > R.h + 80) continue;
      const k = 1 - Math.min(1, Math.hypot(p.x - R.w / 2, p.y - R.h / 2) / Math.max(R.w, R.h));
      if (k > dk) { dk = k; ds = b.dcStage || 1; }
    }
    deepHum(dk, ds);
    // An Atmosphere Engine at work on screen: the air through it, and its rain from stage 2.
    let ak = 0, as = 1;
    if (live) for (const b of S.buildings) {
      if (b.dead || !b.built || !b.working || b.type !== 'atmos') continue;
      const m = bCentre(b), p = worldToScreen(m.x, m.y);
      if (p.x < -80 || p.y < -120 || p.x > R.w + 80 || p.y > R.h + 80) continue;
      const k = 1 - Math.min(1, Math.hypot(p.x - R.w / 2, p.y - R.h / 2) / Math.max(R.w, R.h));
      if (k > ak) { ak = k; as = b.aeStage || 1; }
    }
    atmosHum(ak, as);
    // Burning oil on screen (js/warfx.js): its roar, from the loudest well, a little more with more of them.
    let ok = 0, op = 0, on = 0;
    if (live && typeof R !== 'undefined' && R.wfx && R.wfx.of === S && R.wfx.oil && R.wfx.oil.length) for (const e of R.wfx.oil) {
      const f = wfxOilLevel(e);
      if (f <= 0.02) continue;
      const p = worldToScreen(e.x, e.y);
      if (p.x < -120 || p.y < -120 || p.x > R.w + 120 || p.y > R.h + 120) continue;
      const k = f * (1 - Math.min(1, Math.hypot(p.x - R.w / 2, p.y - R.h / 2) / Math.max(R.w, R.h))) * zoomLoud();
      on++;
      if (k > ok) { ok = k; op = (p.x / R.w) * 2 - 1; }
    }
    oilRoar(ok, op, on);
    // A Great Uplink transmitting on screen: its slow pulse, in time with the beam (gupPhase); in the last GUP.echo s, with
    // the Murmur in the game, the ground repeating it back. Jammed or without power, silence.
    if (live) {
      const ph = gupPhase(), wrap = ph < (WORLD.gupPh ?? 1);
      WORLD.gupPh = ph;
      if (wrap) for (const b of S.buildings) {
        if (b.dead || !b.built || !b.gOn || !BDEFS[b.type].gup || b.gJam || !b.gPow) continue;
        const m = bCentre(b);
        sfx('guppulse', m.x, m.y);
        if (S.wildlife && GUP.hold - (b.gT || 0) <= GUP.echo) setTimeout(() => sfx('gupecho', m.x, m.y + 2), 700);
        break;
      }
    }
    WORLD.cityT = (WORLD.cityT ?? 20) - 0.25;
    if (cb && WORLD.cityT <= 0) { WORLD.cityT = 50 + Math.random() * 20; sfx('cityclock', cb.x, cb.y); }
    WORLD.bt = 0.25;
  }
  if (!inGame || UI.paused || S.winner >= 0 || WORLD.t > 0) return;
  WORLD.t = 0.3;
  if (!sfxReady()) return;
  const v0 = screenToWorld(0, 0), v1 = screenToWorld(R.w, R.h);
  const on = (x, y) => x > v0.x - 1 && x < v1.x + 1 && y > v0.y - 1 && y < v1.y + 1;
  let welders = [], pavers = [], spreaders = [], moving = 0, trucks = 0;
  // A fight on screen (robots fighting, a blast a moment ago, not far off): the night's insects fall quiet (nightSounds).
  let fights = 0;
  for (const u of S.bots) if (u.fight && !u.dead && !u.inside && on(u.x, u.y)) fights++;
  WORLD.fray = Math.min(1, fights / 6 + Math.max(0, 1 - (ac.currentTime - (WORLD.boomAt ?? -99)) / 12));
  // Vehicles of every colony on screen: aircraft (in the air, on the runway), trains and ships, and what they're doing.
  let fly = 0, flyX = 0, rail = 0, railV = 0;
  const trainsOn = [], now = S.time;
  for (const u of S.bots) {
    if (u.dead) continue;
    const B = BOTS[u.type];
    if (B.air) {
      const ph = u.flight && u.flight.ph, was = WORLD.ph[u.id];
      WORLD.ph[u.id] = ph;
      if (!ph || !on(u.x, u.y)) continue;
      if ((u.alt || 0) > 0.05 || ph === 'roll' || ph === 'rollout') { fly++; flyX += worldToScreen(u.x, u.y).x; }
      if (ph !== was) {
        if (ph === 'roll' && u.owner !== ME) at(u, 'planetakeoff', 0.8);
        else if (ph === 'final') at(u, 'approach', 0.8);
        else if (ph === 'rollout') at(u, 'touchdown', 1);
      }
      continue;
    }
    if (B.rail) {
      const v = u.inside ? 0 : u.vel || 0, v0 = WORLD.vel[u.id] || 0;
      WORLD.vel[u.id] = v;
      if (u.inside || !on(u.x, u.y)) continue;
      if (v > 0.15) { rail++; railV += v; trainsOn.push(u); }
      // Pulling out (from a stop to under way): the horn. Slowing hard from speed: the brakes.
      if (v0 < 0.12 && v > 0.3 && now - (WORLD.horn[u.id] || -99) > 20) { WORLD.horn[u.id] = now; at(u, 'trainhorn', 0.9); }
      else if (v0 > 1.1 && v < v0 - 0.35 && now - (WORLD.brake[u.id] || -99) > 12) { WORLD.brake[u.id] = now; at(u, 'brakes', 0.8); }
      continue;
    }
    if (B.sea) {
      const was = WORLD.port[u.id];
      WORLD.port[u.id] = !!u.inside;
      if (was && !u.inside && on(u.x, u.y) && now - (WORLD.horn[u.id] || -99) > 25) { WORLD.horn[u.id] = now; at(u, 'shiphorn', 0.9); } // leaving port
      continue;
    }
  }
  WORLD.fly = fly; WORLD.flyPan = fly ? Math.max(-0.8, Math.min(0.8, (flyX / fly / R.w) * 2 - 1)) : 0;
  WORLD.rail = rail; WORLD.railV = rail ? railV / rail : 0; WORLD.trains = trainsOn;
  // The colony on screen: how built-up it is, and its factories at work.
  let built = 0, works = 0;
  const workers = [];
  for (const b of S.buildings) {
    if (b.dead || !b.built || b.owner < 0 || !on(b.x, b.y)) continue;
    built++;
    if (b.working && WORK_SOUNDS[b.type]) { works++; workers.push(b); }
  }
  WORLD.built = built; WORLD.works = works;
  if (workers.length && Math.random() < Math.min(0.85, 0.2 + 0.07 * workers.length)) {
    const b = workers[Math.floor(Math.random() * workers.length)], kinds = WORK_SOUNDS[b.type];
    const v = mapVoice(b.x + 0.5, b.y + 0.5, 0.75);
    if (v) sfx(kinds[Math.floor(Math.random() * kinds.length)], v);
  }
  // A big town has horns going off a few streets away now and then.
  if (built > 30 && Math.random() < Math.min(0.12, (built - 30) * 0.002)) {
    const b = S.buildings[Math.floor(Math.random() * S.buildings.length)];
    if (b && !b.dead && on(b.x, b.y)) { const v = mapVoice(b.x + 0.5, b.y + 0.5, 0.5); if (v) sfx('honkfar', v); }
  }
  // The ground on screen (a coarse look, every third tile): the sea and lava, the shore (water beside land), and how
  // wild it is: the share of its land that isn't built on, paved or laid with track (with a third of it built up,
  // it's all town). See natureBeds.
  let tiles = 0, sea = 0, lava = 0, land = 0, urban = 0, shore = 0;
  const i0 = Math.max(0, Math.floor(v0.x)), i1 = Math.min(S.W - 1, Math.ceil(v1.x)), j0 = Math.max(0, Math.floor(v0.y)), j1 = Math.min(S.H - 1, Math.ceil(v1.y));
  // (On Argos the pools are frozen: no water to hear. In the Cinderlands the lakes are lava, as they look.)
  const bm = biome(), frozen = bm === 'lunar', molten = bm === 'volcanic';
  const isLava = (u) => molten || !!(S.lava && S.lava[u]);
  const wet = (u) => S.terrain[u] === T_WATER && !isLava(u);
  for (let j = j0; j <= j1; j += 3) for (let i = i0; i <= i1; i += 3) {
    const t = j * S.W + i;
    tiles++;
    if (S.terrain[t] === T_WATER) {
      if (frozen) { land++; continue; }
      if (isLava(t)) { lava++; continue; }
      if (!(S.ford && S.ford[t])) sea++;
      if ((i > 0 && !wet(t - 1)) || (i < S.W - 1 && !wet(t + 1)) || (j > 0 && !wet(t - S.W)) || (j < S.H - 1 && !wet(t + S.W))) shore++;
    } else {
      land++;
      if (S.bAt[t] || S.road[t] || (S.rail && S.rail[t])) urban++;
    }
  }
  WORLD.sea = tiles ? sea / tiles : 0; WORLD.lava = tiles ? lava / tiles : 0; WORLD.shore = tiles ? shore / tiles : 0;
  WORLD.wildT = land ? Math.max(0, 1 - (3 * urban) / land) : 0;
  // How near a Murmur nest the view is (none live on Argos), and the volcano (see natureBeds).
  const cx = (v0.x + v1.x) / 2, cy = (v0.y + v1.y) / 2, span = Math.max(8, Math.abs(v1.x - v0.x) / 2);
  let nest = 0;
  if (typeof murmurGround !== 'function' || murmurGround(biome())) for (const b of S.buildings) if (!b.dead && (isNestB(b) || b.type === 'burrow')) nest = Math.max(nest, (isNestB(b) ? 1 : 0.7) * (1 - Math.hypot(b.x - cx, b.y - cy) / (span + 18)));
  WORLD.nest = nest;
  // (the Hollow: how near the Deep's mound in the middle the view is; the murmur there never stops, louder toward it)
  let deep = 0;
  if (S.hollow) for (const b of S.buildings) if (!b.dead && b.type === 'mound') deep = Math.max(deep, 1 - Math.hypot(b.x - cx, b.y - cy) / (span + 30));
  WORLD.deep = deep;
  // ...and how much of the Murmur's tunnel network is on screen (every other tile counted): heard at night (natureBeds).
  let tun = 0;
  if (S.tun) for (let j = j0; j <= j1; j += 2) for (let i = i0; i <= i1; i += 2) if (S.tun[j * S.W + i]) tun++;
  WORLD.tun = Math.min(1, tun / 12);
  const V = S.volcano;
  WORLD.volc = V ? Math.max(0, Math.min(1, 1 - (Math.hypot(V.x - cx, V.y - cy) - (V.r || 0)) / (span + 20))) : 0;
  for (const u of S.bots) {
    if (u.dead || u.inside || u.owner !== ME || !on(u.x, u.y)) continue;
    const t = u.task;
    if (u.path && u.moved) { moving++; if (BOTS[u.type].truck) trucks++; }
    if (t && t.type === 'build' && t.phase === 'work') welders.push(u);
    else if (t && t.type === 'pave' && t.phase === 'work') spreaders.push(u);
    else if (t && t.type === 'staff' && t.phase === 'work' && u.type === 'paver') pavers.push(u);
    if (BOTS[u.type].truck) {
      // Air brakes when a truck pulls up hard; the horn when it's been stuck in a jam a while.
      if (u.drive < 0 && (u.vel || 0) > 0.6 && S.time - (WORLD.brake[u.id] || -99) > 9) { WORLD.brake[u.id] = S.time; at(u, 'airbrake', 0.65); }
      WORLD.honk[u.id] = u.path && !u.moved ? (WORLD.honk[u.id] || 0) + 0.3 : 0;
      if (WORLD.honk[u.id] > 3) { WORLD.honk[u.id] = -8; at(u, 'honk', 0.9); }
    }
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  if (welders.length && Math.random() < 0.25 + 0.15 * welders.length) at(pick(welders), 'weld', 0.8);
  if (spreaders.length && Math.random() < 0.3 + 0.1 * spreaders.length) at(pick(spreaders), 'scrape', 0.9);
  if (pavers.length && Math.random() < 0.4) at(pick(pavers), 'hiss', 1);
  WORLD.moving = moving; WORLD.trucks = trucks;
  // Traffic where it bunches up: the robots and vehicles on the move on screen (every colony's), counted in 5-tile
  // squares. The busiest square swells the traffic hum (updateBeds), and from squares with three or more on the move
  // come engines going by, a truck's warning beeps, a toot of a horn and robots' chirps and servos: the busier the
  // streets, the more often, and from where the traffic is.
  const cells = new Map();
  for (const u of S.bots) {
    if (u.dead || u.inside || !u.path || !u.moved || !on(u.x, u.y)) continue;
    const B = BOTS[u.type];
    if (B.air || B.rail || B.sea || B.wild || B.war) continue;
    const k = Math.floor(u.x / 5) * 4096 + Math.floor(u.y / 5);
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    c.push(u);
  }
  let jam = 0;
  const busy = [];
  for (const c of cells.values()) { if (c.length > jam) jam = c.length; if (c.length >= 3) for (const u of c) busy.push(u); }
  WORLD.jam = jam;
  if (busy.length && Math.random() < Math.min(0.75, 0.04 * busy.length)) {
    const u = pick(busy);
    const kinds = BOTS[u.type].truck ? ['passby', 'passby', 'beepback', 'toot'] : ['chirp', 'chirp', 'servo', 'passby'];
    at(u, pick(kinds), 0.5 + Math.min(0.35, busy.length * 0.02));
  }
  if (WORLD.lava > 0.02 && Math.random() < Math.min(0.5, WORLD.lava * 3)) { // lava bubbling and popping somewhere on screen
    const ac = AUDIO.ctx, g = ac.createGain();
    g.gain.value = 0.6 * zoomLoud(); g.connect(AUDIO.natureBus || AUDIO.fxBus);
    sfx('bubble', g);
    setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 2000);
  }
}

function at(u, name, vol) {
  const v = mapVoice(u.x, u.y, vol);
  if (v) sfx(name, v);
}

/*
 * Two steady beds under everything: the hum of the traffic on screen (deeper with trucks), and the
 * wind of the biome, gusting (harder in a storm; on airless Argos only the faintest rumble). Under them the land
 * itself (natureBeds), and calls from out in the wilds (biomeCall), fewer the more built-up the view.
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
    wind.connect(bp).connect(wg).connect(A.natureBus);
    wind.start();
    WORLD.bed = { hum, g3, lp, bp, wg, o1, o2, gust: 0, chirp: 3 };
  }
  const B = WORLD.bed;
  const zl = live ? zoomLoud() : 0;
  ambienceBeds(live, dt, zl);
  // (Traffic comes and goes: the engines' pitch wanders and the level swells and eases, never one steady drone; and it's
  // two thirds as loud as it was, sitting under the music.)
  const tSwell = 0.82 + 0.18 * Math.sin(t * 0.13) * Math.sin(t * 0.051 + 1.3);
  B.hum.gain.setTargetAtTime(live ? Math.min(0.032, 0.0025 * (WORLD.moving || 0) + 0.0035 * (WORLD.jam || 0)) * zl * tSwell : 0, t, 0.4); // (louder where it bunches up)
  if (live && WORLD.moving) { B.o1.frequency.setTargetAtTime(52 * (1 + 0.03 * Math.sin(t * 0.17)), t, 1.5); B.o2.frequency.setTargetAtTime(78.5 * (1 + 0.025 * Math.sin(t * 0.11 + 2)), t, 1.5); }
  B.g3.gain.setTargetAtTime(Math.min(1, (WORLD.trucks || 0) * 0.5), t, 0.4);
  B.lp.frequency.setTargetAtTime(160 + Math.min(240, (WORLD.moving || 0) * 6 + (WORLD.jam || 0) * 10), t, 0.5);
  const b = typeof biome === 'function' && S ? biome() : 'desert';
  const wind = { desert: [480, 0.7, 0.03], jungle: [320, 0.6, 0.016], polar: [1100, 2.2, 0.035], volcanic: [180, 0.5, 0.03], lunar: [70, 0.4, 0.0025],
    autumn: [600, 0.8, 0.028], savanna: [700, 0.9, 0.024], alien: [260, 3, 0.014], swamp: [240, 0.5, 0.01], springs: [380, 0.65, 0.017], tropical: [360, 0.64, 0.019], hollow: [110, 0.3, 0.006] }[b] || [480, 0.7, 0.03]; // (the Hollow: a faint draught through the caverns)
  const wx = live ? weatherSound() : null, wk = wx ? wx.k : 0, storm = wx ? STORM_WIND[wx.kind] || 0 : 0;
  B.gust -= dt;
  if (B.gust <= 0) {
    // A new gust every few seconds: the wind swells, drops and changes pitch (higher in a sandstorm, blizzard or gale).
    B.gust = 2 + Math.random() * 4;
    B.bp.frequency.setTargetAtTime(wind[0] * (storm > 1 ? 1 + 0.5 * wk : 1) * (0.7 + Math.random() * 0.7), t, 1.2);
    B.bp.Q.value = wind[1];
  }
  const sway = 0.5 + 0.5 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
  const windLevel = live ? wind[2] * (sway + 0.5) * Math.max(0.3, 1 + storm * wk) : 0;
  B.wg.gain.setTargetAtTime(Math.min(0.09, windLevel), t, 0.8);
  // How wild the view is (WORLD.wildT, from the ground on screen), eased so it doesn't jump as you scroll.
  WORLD.wild = (WORLD.wild || 0) + ((live ? WORLD.wildT || 0 : 0) - (WORLD.wild || 0)) * Math.min(1, dt * 0.8);
  natureBeds(live, dt, zl, b, sway, wx);
  nightSounds(live, dt, b, wx, zl);
  if (live && BIOME_CALLS[b]) {
    B.chirp -= dt;
    if (B.chirp <= 0) {
      // Out in the wilds, a call every few seconds; at a town's edge now and then; in its streets hardly ever. More
      // at dawn, fewer in rain or fog; and on the ashlands the ground hisses and grumbles more near the volcano.
      const w = Math.max(WORLD.wild || 0, b === 'volcanic' ? WORLD.volc || 0 : 0), tod = typeof todNow === 'function' ? todNow() : null;
      const dawn = tod && (tod.a === 'morning' || tod.b === 'morning') ? 0.5 : 1, damp = wx && (wx.kind === 'rain' || wx.kind === 'fog') ? 1 + wk : 1;
      B.chirp = ((2 + Math.random() * 6) * dawn * damp) / Math.max(0.2, w) / (1 + 3 * (typeof faunaChorus === 'function' ? faunaChorus() : 0)); // (the dawn chorus after a Murmur night: js/wildlife.js)
      if (w > 0.12) biomeCall(b, w, tod ? tod.lights || 0 : 0);
    }
  }
}

/*
 * The steadier sounds of a colony and its traffic on screen, each a voice made once and turned up or down:
 * - the city: a murmur that thickens with the buildings on screen (and a little with the whole colony), quieter at night;
 * - industry: the low hum of the factories at work;
 * - trains: a diesel throb while any roll on screen, and their wheels clacking over the joints, faster the faster they go;
 * - aircraft: the drone of the engines overhead, panned to where they are;
 * - the sea: the wash of the waves on the shore when there's sea on screen, swelling and falling;
 * (The night's crickets and the rest: nightSounds.)
 */
function ambienceBeds(live, dt, zl) {
  const ac = AUDIO.ctx, A = AUDIO, t = ac.currentTime;
  if (!WORLD.amb) {
    const noiseVoice = (type, freq, q) => {
      const src = ac.createBufferSource(); src.buffer = A.noise; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(f).connect(g); src.start(0, Math.random() * 1.5);
      return { f, g };
    };
    const city = noiseVoice('bandpass', 420, 0.6), chatter = noiseVoice('bandpass', 1500, 1.4);
    city.g.connect(A.fxBus); chatter.g.connect(A.fxBus);
    // Industry: a soft machine hum (a low tone and two harmonics) through a low filter. It never sits still: each
    // tone wanders a little in pitch, the filter drifts, and the whole swells and eases on two slow, unrelated
    // cycles (a steady, unchanging hum was distracting: see the update below).
    const ind = ac.createGain(); ind.gain.value = 0;
    const ilp = ac.createBiquadFilter(); ilp.type = 'lowpass'; ilp.frequency.value = 260; ilp.Q.value = 0.4;
    const indOsc = [];
    for (const [f, k, w] of [[60, 0.55, 'triangle'], [120, 0.25, 'sawtooth'], [181, 0.08, 'sawtooth']]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = w; o.frequency.value = f; g.gain.value = k; o.connect(g).connect(ilp); o.start(); indOsc.push({ o, f }); }
    const indAm = ac.createGain(); indAm.gain.value = 1;
    for (const [rate, depth] of [[0.11, 0.22], [0.047, 0.18]]) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = rate; lg.gain.value = depth; l.connect(lg).connect(indAm.gain); l.start(); }
    ilp.connect(indAm).connect(ind).connect(A.fxBus);
    // Trains: a diesel throb (two low tones, pulsing).
    const rail = ac.createGain(); rail.gain.value = 0;
    const rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 240;
    const rAm = ac.createGain(); rAm.gain.value = 0.7;
    const d1 = ac.createOscillator(), d2 = ac.createOscillator(); d1.type = 'sawtooth'; d1.frequency.value = 44; d2.type = 'square'; d2.frequency.value = 66;
    const dg2 = ac.createGain(); dg2.gain.value = 0.4;
    d1.connect(rAm); d2.connect(dg2).connect(rAm);
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 7; lg.gain.value = 0.3; lfo.connect(lg).connect(rAm.gain);
    rAm.connect(rlp).connect(rail).connect(A.fxBus);
    d1.start(); d2.start(); lfo.start();
    // Aircraft: the drone of turboprops and jets (noise and a low buzz), panned.
    const air = noiseVoice('bandpass', 900, 0.8), airPan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const ab = ac.createOscillator(), abg = ac.createGain(); ab.type = 'sawtooth'; ab.frequency.value = 78; abg.gain.value = 0;
    ab.connect(abg); ab.start();
    if (airPan) { air.g.connect(airPan); abg.connect(airPan); airPan.connect(A.fxBus); } else { air.g.connect(A.fxBus); abg.connect(A.fxBus); }
    // The sea: low, rumbling wash.
    const sea = noiseVoice('lowpass', 520, 0.5); sea.g.connect(A.natureBus);
    WORLD.amb = { city, chatter, ind, ilp, indOsc, rail, air, airPan, abg, sea, clack: 0 };
  }
  const M = WORLD.amb, on = live && AUDIO.fx > 0, natOn = live && AUDIO.amb > 0;
  const night = typeof todNow === 'function' && S ? todNow().lights || 0 : 0;
  // The city: the buildings on screen, and the size of the whole colony a little.
  let total = 0;
  if (on) for (const b of S.buildings) if (!b.dead && b.built && b.owner === ME) total++;
  const cityLv = on ? Math.min(0.045, 0.0032 * Math.sqrt(WORLD.built || 0) + 0.0006 * Math.sqrt(total)) * (1 - 0.35 * night) * (0.6 + 0.4 * zl) : 0;
  M.city.g.gain.setTargetAtTime(cityLv, t, 0.8);
  M.chatter.g.gain.setTargetAtTime(cityLv * 0.35, t, 0.8);
  M.city.f.frequency.setTargetAtTime(380 + 80 * Math.sin(t * 0.21), t, 1);
  // (about half as loud as it was, and wandering: see where it's made)
  M.ind.gain.setTargetAtTime(on ? Math.min(0.009, 0.0018 * Math.sqrt(WORLD.works || 0)) * zl : 0, t, 0.6);
  if (on && WORLD.works) {
    M.indOsc.forEach((v, k) => v.o.frequency.setTargetAtTime(v.f * (1 + 0.012 * Math.sin(t * (0.07 + 0.03 * k) + k * 2.1)), t, 2));
    M.ilp.frequency.setTargetAtTime(230 + 70 * Math.sin(t * 0.09 + 1) * Math.sin(t * 0.023), t, 2);
  }
  // Trains.
  const rv = WORLD.railV || 0;
  M.rail.gain.setTargetAtTime(on && WORLD.rail ? Math.min(0.06, 0.03 * Math.sqrt(WORLD.rail)) * zl : 0, t, 0.4);
  if (on && WORLD.rail && WORLD.trains && WORLD.trains.length) {
    M.clack -= dt;
    if (M.clack <= 0) {
      M.clack = Math.max(0.28, 1.4 / Math.max(0.4, rv)); // a joint every few tiles: faster the faster they go
      const u = WORLD.trains[Math.floor(Math.random() * WORLD.trains.length)], v = mapVoice(u.x, u.y, 0.8);
      if (v) sfx('clack', v);
    }
  }
  // Aircraft.
  M.air.g.gain.setTargetAtTime(on && WORLD.fly ? Math.min(0.05, 0.03 * Math.sqrt(WORLD.fly)) * zl : 0, t, 0.5);
  M.abg.gain.setTargetAtTime(on && WORLD.fly ? Math.min(0.02, 0.012 * Math.sqrt(WORLD.fly)) * zl : 0, t, 0.5);
  if (M.airPan) M.airPan.pan.setTargetAtTime(WORLD.flyPan || 0, t, 0.5);
  // The sea, swelling and falling every eight seconds or so.
  const swell = 0.55 + 0.45 * Math.sin(t * 0.75) * Math.sin(t * 0.31 + 2);
  // (The open sea's: lakes and rivers only murmur, and lap at their banks: see natureBeds.)
  const openSea = !!(S && (SHAPE_PRESETS[S.settings.shape || 0] || {}).islands);
  M.sea.g.gain.setTargetAtTime(natOn ? Math.min(0.05, 0.06 * Math.sqrt(WORLD.sea || 0)) * swell * (0.5 + 0.5 * zl) * (openSea ? 1 : 0.35) : 0, t, 0.6);
}

/*
 * The land itself, under the colony's own sounds (called from updateBeds):
 * - each biome's bed (NATURE): leaves rustling in the forests and grass on the savanna as the wind gusts, sand or snow
 *   hissing, insects droning (cicadas in the heat of the day, the swamp's frogs and insects at night), the Bloom's
 *   shimmer (brighter by night), the ashlands' ground rumbling. It is loudest out in the wilds and fades as the view
 *   fills with a town (WORLD.wild), where the city's own sounds take over (ambienceBeds);
 * - water: surf breaking on the shores of the sea maps (Islands, Tidal flats, Four Isles); at lakes and rivers, water
 *   lapping at the banks (quicker on a river delta's channels);
 * - the volcano: the ground rumbles nearer it, harder once it's about to erupt and while it does; lava rumbles too;
 * - the weather (weatherSound): rain, with thunder after the lightning the storm shows; a gale in the leaves; a
 *   sandstorm's or a blizzard's hiss (the wind blows harder too: see updateBeds); embers ticking as they fall; an
 *   aurora's shimmer; fog damping the calls;
 * - near a Murmur nest, now and then (more at night), a low sound in the ground.
 * Argos, the moon, is near-silent: no air to carry a wind, and no Murmur.
 */
// (Levels measured against the build music at the default volumes: a calm wild scene sits about 16 to 20 dB under the
// music, a storm about 12 to 16 dB under; see the mix notes in README.)
const NATURE = {
  desert: { hiss: 0.006 },
  jungle: { leaves: [2800, 0.011], drone: [4800, 8, 27, 0.03, 0] },
  autumn: { leaves: [4200, 0.013] },
  savanna: { leaves: [2300, 0.01], drone: [5600, 10, 31, 0.045, 0] },
  swamp: { drone: [2100, 3, 11, 0.02, 0.06], lap: 0.005 },
  alien: { glow: [0.006, 0.012] },
  volcanic: { rumble: 0.018, hiss: 0.002 },
  tropical: { leaves: [2700, 0.012], lap: 0.006 },
  springs: { rumble: 0.007, hiss: 0.009, lap: 0.004 },
  polar: { hiss: 0.0065 },
  lunar: {},
};
// (leaves: [filter Hz, level]; drone: [filter Hz, Q, pulse rate, level by day, level by night]; glow: [by day, by night].
// A drone is a narrow band of noise, so it needs a far higher level than the broad rustle and hiss to be heard at all.)
// How much harder the wind blows in each kind of weather (see weatherAt) at its height (fog stills it).
const STORM_WIND = { sand: 3, snow: 2.5, leaves: 2, dust: 1, rain: 0.8, ash: 0.3, fog: -0.6 };

/** The weather heard now: a planet event's dust storm, or the weather (while it's shown): { kind, k } or null. */
function weatherSound() {
  if (!S) return null;
  const E = S.event;
  if (E && E.type === 'dust' && S.time >= E.t0 && S.time < E.t1) return { kind: 'sand', k: Math.max(0, Math.min(1, (S.time - E.t0) / 15, (E.t1 - S.time) / 15)) };
  if (typeof weatherOn !== 'function' || !weatherOn() || typeof weatherAt !== 'function') return null;
  return weatherAt(S.time);
}

/**
 * A gain for a sound from somewhere round about (panned at random within ±spread), that lets go of itself after a while.
 * `bus`: where it goes (the effects unless given: the land's own sounds pass AUDIO.natureBus).
 */
function aroundVoice(spread, vol, bus) {
  const ac = AUDIO.ctx, g = ac.createGain(), out = bus || AUDIO.fxBus;
  g.gain.value = vol === undefined ? 1 : vol;
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = (Math.random() * 2 - 1) * spread; g.connect(p).connect(out); } else g.connect(out);
  setTimeout(() => { try { g.disconnect(); } catch (e) { /* gone */ } }, 8000);
  return g;
}

function natureBeds(live, dt, zl, b, sway, wx) {
  const ac = AUDIO.ctx, A = AUDIO, t = ac.currentTime;
  if (!WORLD.nat) {
    const voice = (type, freq, q) => {
      const src = ac.createBufferSource(); src.buffer = A.noise; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(A.natureBus); src.start(0, Math.random() * 1.5);
      return { f, g };
    };
    // (a voice that pulses: insects, frogs, lapping water; its noise through a gain an oscillator swings)
    const pulsed = (type, freq, q, rate, depth) => {
      const src = ac.createBufferSource(); src.buffer = A.noise; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const am = ac.createGain(); am.gain.value = 1 - depth;
      const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = rate; lg.gain.value = depth; lfo.connect(lg).connect(am.gain); lfo.start();
      const g = ac.createGain(); g.gain.value = 0;
      src.connect(f).connect(am).connect(g).connect(A.natureBus); src.start(0, Math.random() * 1.5);
      return { f, g, lfo };
    };
    const leaves = voice('bandpass', 3000, 0.6), hiss = voice('highpass', 5000), rain = voice('bandpass', 2200, 0.35), rumble = voice('lowpass', 70, 0.7);
    const drone = pulsed('bandpass', 4800, 8, 27, 0.6), lap = pulsed('bandpass', 1000, 1.2, 0.7, 0.55);
    // The Bloom's shimmer: three soft tones close together, beating and drifting, swelling slowly.
    const glow = { g: ac.createGain() }; glow.g.gain.value = 0;
    const glp = ac.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 1400;
    const gAm = ac.createGain(); gAm.gain.value = 0.7;
    const gl = ac.createOscillator(), gLg = ac.createGain(); gl.frequency.value = 0.06; gLg.gain.value = 0.3; gl.connect(gLg).connect(gAm.gain); gl.start();
    const glowOsc = [];
    for (const [f, k] of [[412, 0.5], [415.5, 0.4], [618.7, 0.25]]) { const o = ac.createOscillator(), og = ac.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = k; o.connect(og).connect(glp); o.start(); glowOsc.push({ o, f }); }
    glp.connect(gAm).connect(glow.g).connect(A.natureBus);
    WORLD.nat = { leaves, hiss, rain, rumble, drone, lap, glow, glowOsc, surf: 4, lapping: 1, ember: 1, bolt: -1, thunderAt: 0, murmur: 20 };
  }
  const M = WORLD.nat, on = live && AUDIO.amb > 0 && !!S, N = NATURE[b] || {};
  const W = on ? WORLD.wild || 0 : 0, zq = 0.55 + 0.45 * zl;
  const night = on && typeof todNow === 'function' ? todNow().lights || 0 : 0;
  const wk = on && wx ? wx.k : 0, kind = on && wx ? wx.kind : '';
  const gust = 0.5 + 0.7 * Math.max(0, Math.min(1, sway));
  const set = (v, level, tc) => v.g.gain.setTargetAtTime(on ? Math.max(0, level) : 0, t, tc || 0.8);
  // Leaves and grass in the wind, and in a gale.
  if (N.leaves) M.leaves.f.frequency.setTargetAtTime(N.leaves[0], t, 1);
  set(M.leaves, ((N.leaves ? N.leaves[1] : 0) * W * gust + (kind === 'leaves' ? 0.016 * wk : 0)) * zq);
  // Sand, snow and dust hissing; the ashlands' vents.
  set(M.hiss, ((N.hiss || 0) * W * gust + (kind === 'sand' ? 0.02 : kind === 'snow' ? 0.014 : kind === 'dust' ? 0.007 : 0) * wk) * zq);
  // Insects and frogs (hushed by rain).
  const D = N.drone;
  if (D) { M.drone.f.frequency.setTargetAtTime(D[0], t, 1); M.drone.f.Q.value = D[1]; M.drone.lfo.frequency.setTargetAtTime(D[2], t, 1); }
  const hush = typeof faunaHush === 'function' ? faunaHush() : 0; // (the day's insects and birds fall silent before a Murmur night: js/wildlife.js)
  set(M.drone, D ? (D[3] * (1 - night) * (1 - 0.8 * hush) + D[4] * night) * W * zq * (1 - 0.7 * (typeof faunaScarred === 'function' ? faunaScarred() : 0)) * (kind === 'rain' ? 1 - 0.7 * wk : 1) : 0);
  // The Bloom's shimmer, brighter by night and under an aurora.
  const G = N.glow;
  if (on && G) M.glowOsc.forEach((v, k) => v.o.frequency.setTargetAtTime(v.f * (1 + 0.02 * Math.sin(t * (0.05 + 0.02 * k) + k)), t, 2));
  set(M.glow, ((G ? G[0] * (1 - night) + G[1] * night : 0) * W + (kind === 'aurora' ? 0.006 * wk : 0)) * zq, 1.5);
  // The ground rumbling: the ashlands, near the volcano (harder once it's about to blow, and while it does), lava on
  // screen, and an ashfall.
  const V = on && S.volcano, vk = V ? (V.erupting ? 2.6 : V.warned ? 1.8 : 1) : 0;
  const rum = (N.rumble || 0) * (0.5 + 0.5 * W) + 0.065 * (WORLD.volc || 0) * vk + 0.025 * Math.sqrt(WORLD.lava || 0) + (kind === 'ash' ? 0.008 * wk : 0);
  // (an eruption roars higher, so a small speaker plays it too)
  M.rumble.f.frequency.setTargetAtTime(60 + 25 * Math.sin(t * 0.13) * Math.sin(t * 0.07 + 2) + (V && V.erupting ? 90 * (WORLD.volc || 0) : 0), t, 1.5);
  set(M.rumble, Math.min(0.15, rum) * zq, 1.2);
  // Water lapping at the banks of lakes and rivers (a river delta's channels quicker), and the swamp's wet ground.
  const SH = (S && SHAPE_PRESETS[S.settings.shape || 0]) || {}, ocean = !!SH.islands, shoreF = Math.min(1, (WORLD.shore || 0) * 12);
  M.lap.lfo.frequency.setTargetAtTime(SH.delta ? 1.6 : 0.7, t, 1);
  set(M.lap, ((ocean ? 0.004 : 0.012) * shoreF + (N.lap || 0) * W) * zq);
  set(M.rain, kind === 'rain' ? 0.03 * wk * zq : 0, 1.2);
  if (!on || !sfxReady()) return;
  // Surf breaking on the shore of a sea map; little waves lapping at a lake's or a river's banks.
  if (shoreF > 0.05) {
    M.surf -= dt;
    if (ocean && M.surf <= 0) { M.surf = 2.5 + Math.random() * 4; _noise(2.4, 0.13 * shoreF * zq, { type: 'bandpass', freq: 1100, to: 350, q: 0.6, attack: 0.7, dest: aroundVoice(0.5, 1, AUDIO.natureBus) }); }
    M.lapping -= dt;
    if (!ocean && M.lapping <= 0) { M.lapping = 0.5 + Math.random() * 1.4; _noise(0.22, 0.018 * shoreF * zq, { type: 'bandpass', freq: 1200 + Math.random() * 900, q: 2.5, attack: 0.03, dest: aroundVoice(0.6, 1, AUDIO.natureBus) }); }
  }
  // Embers ticking as they fall.
  if (kind === 'ash' && wk > 0.1) {
    M.ember -= dt;
    if (M.ember <= 0) { M.ember = 0.15 + (Math.random() * 0.8) / wk; _noise(0.03, 0.012 * wk * zq, { type: 'highpass', freq: 3000 + Math.random() * 2000, dest: aroundVoice(0.8, 1, AUDIO.natureBus) }); }
  }
  // Thunder after the lightning: the same flashes the rainstorm shows (drawWeather), heard a moment later from off a way.
  if (kind === 'rain' && wk > 0.2) {
    const bolt = Math.floor(S.time / 5), at = bolt * 5 + hash2(S.seed | 0, bolt, 81) * 5;
    if (bolt !== M.bolt && S.time < at) { M.bolt = bolt; if (hash2(bolt, 3, 83) < 0.4) M.thunderAt = at + 0.5 + Math.random() * 2.5; }
  }
  if (M.thunderAt && S.time >= M.thunderAt) { M.thunderAt = 0; if (kind === 'rain') thunder(Math.max(0.4, wk) * zq); }
  // The Murmur: near a nest or an exit, now and then (more often at night), a low sound in the ground; at night (from
  // the game's clock: when they're up) over their tunnels too, more often the more of them there are. In the Hollow, their
  // lair (an always-night map), it never stops, louder toward the Deep's mound (LORE.md), and goes dead silent in the lull
  // before each surge (murmurLull: a minute of nothing, and then they come).
  const up = on && typeof murmurNight === 'function' && S.wildlife && murmurNight(S.time), lull = on && typeof murmurLull === 'function' && S.wildlife && murmurLull(S.time);
  const lair = on && S.wildlife && !!S.hollow;
  let near = Math.max(WORLD.nest || 0, up ? 0.8 * (WORLD.tun || 0) : 0);
  if (lair) near = Math.max(near, 0.35 + 0.5 * (WORLD.deep || 0));
  if (lull) M.murmur = Math.max(M.murmur, 2); // (silence, and the first sound after it a moment into the surge)
  else if (near > 0) {
    M.murmur -= dt;
    if (M.murmur <= 0) { M.murmur = ((25 + Math.random() * 40) / (0.3 + near)) * (up ? 0.35 : lair || night > 0.5 ? 0.6 : 1) * (lair ? 0.5 : 1); groundMurmur(near * zq); }
  }
}

/** Thunder: a crack, then a long roll, from somewhere off to one side. */
function thunder(k) {
  if (!sfxReady()) return;
  const g = aroundVoice(0.7);
  _noise(0.3, 0.07 * k, { type: 'lowpass', freq: 1800, to: 500, attack: 0.01, dest: g });
  _noise(3.8, 0.075 * k, { type: 'lowpass', freq: 280, to: 55, attack: 0.3, delay: 0.1, dest: g });
  _noise(2.6, 0.04 * k, { type: 'lowpass', freq: 160, to: 50, attack: 0.5, delay: 1.1, dest: g });
}

/** The Murmur somewhere under the ground: a slow, low throb, two tones beating against each other, with grit in it. */
function groundMurmur(v) {
  if (!sfxReady()) return;
  const ac = AUDIO.ctx, t0 = ac.currentTime, g = aroundVoice(0.6, Math.min(1, v)), f0 = 44 + Math.random() * 8;
  for (const [f, vol, d] of [[f0, 0.05, 0], [f0 * 1.07, 0.035, 0.25], [f0 * 2, 0.014, 0.1]]) {
    const o = ac.createOscillator(), og = ac.createGain();
    o.frequency.setValueAtTime(f, t0 + d); o.frequency.exponentialRampToValueAtTime(f * 0.94, t0 + d + 3);
    og.gain.value = 0.0001;
    og.gain.setValueAtTime(0.0001, t0 + d); og.gain.exponentialRampToValueAtTime(vol, t0 + d + 1); og.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 3);
    o.connect(og).connect(g); o.start(t0 + d); o.stop(t0 + d + 3.1);
  }
  _noise(3, 0.025, { freq: 180, to: 70, attack: 0.9, dest: g });
}

// The life (and the land) heard now and then out in each biome: see biomeCall. (None on Argos: it's silent.)
/**
 * The land's own sounds' bus (AUDIO.natureBus) at full Ambience volume. At the default (AUDIO.amb 0.5) they sit where
 * the owner turned them down to in Nov 2026, about 5 dB under where they were with the effects.
 */
const NATURE_LEVEL = 0.9;
const BIOME_CALLS = { springs: 1, tropical: 1, jungle: 1, autumn: 1, savanna: 1, swamp: 1, alien: 1, volcanic: 1, desert: 1, polar: 1 };

/**
 * Something heard somewhere out in the biome (w: how wild the view is, night: 0 to 1): birds by day and a night
 * bird's hoot in the forests, cicadas and a far-off call on the savanna, frogs (most at night), drips and bubbling mud
 * in the swamp, strange sliding calls on the Bloom and chimes there by night, vents hissing and the ground grumbling on
 * the ashlands, sand skittering and the wind whistling through the rocks in the desert (rock ticking as it cools at
 * night), ice cracking and groaning and snow sliding at the poles.
 */
/** A seagull's cry: a few falling "kee-ow" calls, a little raspy. */
function gullCry(g) {
  const f = 1500 + Math.random() * 500, n = 1 + Math.floor(Math.random() * 3);
  for (let k = 0; k < n; k++) {
    const d = k * (0.32 + Math.random() * 0.1), p = f * (1 - k * 0.04);
    _tone(p, 0.26, 'sawtooth', 0.007, p * 0.55, d, g);
    _tone(p * 1.01, 0.26, 'triangle', 0.012, p * 0.6, d, g);
  }
}

/** A geyser going off on screen (js/ambient.js drawSpringSteam): a rumble, a rushing whoosh, then a hissing fall. */
function geyserSound(vol) {
  if (!natureReady()) return;
  const g = aroundVoice(0.6, Math.max(0.2, Math.min(1, vol || 1)), AUDIO.natureBus);
  _tone(55, 0.9, 'sine', 0.03, 38, 0, g);
  _noise(0.5, 0.012, { type: 'lowpass', freq: 220, attack: 0.25, dest: g });
  _noise(1.6, 0.04, { type: 'bandpass', freq: 500, to: 2600, q: 0.7, attack: 0.18, delay: 0.3, dest: g });
  _noise(2.4, 0.02, { type: 'highpass', freq: 3000, attack: 0.4, delay: 1.2, dest: g });
}

function biomeCall(b, w, night) {
  if (!natureReady()) return;
  w = w === undefined ? 1 : w;
  const dark = Math.random() < (night || 0);
  if (!dark && typeof faunaHush === 'function' && Math.random() < faunaHush()) return; // (the birds fall silent before the Murmur come: js/wildlife.js)
  if (typeof faunaScarred === 'function' && Math.random() < faunaScarred()) return; // (none sing over a battlefield: War scars)
  const g = aroundVoice(0.8, 0.5 * (0.3 + 0.7 * w), AUDIO.natureBus), r = Math.random();
  if (b === 'jungle' || b === 'autumn') {
    if (dark && r < 0.45) { const f = 380 + Math.random() * 80; _tone(f, 0.3, 'sine', 0.02, f * 0.95, 0, g); _tone(f * 0.86, 0.45, 'sine', 0.018, f * 0.8, 0.42, g); } // a night bird
    else jungleCall(g, dark);
  } else if ((b === 'tropical' || b === 'springs') && !dark && r < (b === 'tropical' ? 0.55 : 0.35)) {
    gullCry(g);
  } else if (b === 'springs') {
    // Mud pots popping, or a hot pool bubbling.
    for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) _tone(120 + Math.random() * 80, 0.08, 'sine', 0.018, 70, k * (0.1 + Math.random() * 0.18), g);
  } else if (b === 'tropical' && !dark) {
    const f = 960 + r * 420;
    for (let k = 0; k < 3; k++) {
      const pitch = f * (1 - k * 0.14), delay = k * 0.22;
      _tone(pitch, 0.21 - k * 0.025, 'triangle', 0.012 - k * 0.002, pitch * 0.7, delay, g);
      _tone(pitch * 1.76, 0.11, 'sine', 0.004, pitch * 1.2, delay + 0.04, g);
    }
  } else if (b === 'savanna') {
    // Cicadas buzzing in the heat, or a far-off bird's two-note call; by night the grass hissing in a breath of wind.
    if (dark) _noise(0.9, 0.012, { type: 'bandpass', freq: 2600, q: 0.8, attack: 0.35, dest: g });
    else if (r < 0.6) { const f = 5200 + Math.random() * 1500; for (let k = 0; k < 14; k++) _tone(f, 0.02, 'square', 0.006, f * 1.02, k * 0.03, g); }
    else { const f = 900 + Math.random() * 300; _tone(f, 0.22, 'sine', 0.025, f * 0.92, 0, g); _tone(f * 1.25, 0.25, 'sine', 0.022, f, 0.3, g); }
  } else if (b === 'swamp') {
    // Frogs croaking (a chorus, most at night), or a drip, or mud bubbling.
    if (r < 0.45 + 0.45 * (night || 0)) { const f = 140 + Math.random() * 120; for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) _tone(f, 0.09, 'square', 0.02, f * 0.8, k * 0.22, g); }
    else if (Math.random() < 0.5) _tone(1800 + Math.random() * 600, 0.05, 'sine', 0.02, 900, 0, g);
    else for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) _tone(150 + Math.random() * 60, 0.07, 'sine', 0.02, 85, k * (0.12 + Math.random() * 0.2), g);
  } else if (b === 'alien') {
    // Strange, sliding, warbling calls; by night, soft chimes from the glowing growth.
    if (dark && r < 0.5) { const f = 1100 + Math.random() * 1300; _tone(f, 1.1, 'sine', 0.01, f * 0.995, 0, g); _tone(f * 1.5, 0.9, 'sine', 0.006, f * 1.49, 0.12, g); }
    else { const f = 300 + Math.random() * 900; _tone(f, 0.6, 'sine', 0.02, f * (Math.random() < 0.5 ? 2.2 : 0.45), 0, g); if (r < 0.5) _tone(f * 1.5, 0.4, 'triangle', 0.012, f * 0.8, 0.35, g); }
  } else if (b === 'volcanic') {
    // A vent hissing, or the ground grumbling.
    if (r < 0.6) _noise(1.2, 0.03, { type: 'highpass', freq: 2500, attack: 0.2, dest: g });
    else _noise(1.6, 0.06, { freq: 140, to: 60, attack: 0.3, dest: g });
  } else if (b === 'desert') {
    // By day sand skittering, or the wind whistling through the rocks; by night the rock ticking as it cools.
    if (dark && r < 0.7) for (let k = 0; k < 2 + Math.floor(Math.random() * 3); k++) _tone(2200 + Math.random() * 1500, 0.012, 'square', 0.008, 0, k * (0.15 + Math.random() * 0.3), g);
    else if (r < 0.6) _noise(0.5, 0.02, { type: 'bandpass', freq: 3500, to: 2500, q: 1.5, attack: 0.12, dest: g });
    else { const f = 650 + Math.random() * 300; _tone(f, 1.4, 'sine', 0.008, f * 1.08, 0, g); }
  } else if (b === 'polar') {
    // Ice cracking, ice groaning, or snow sliding.
    if (r < 0.45) { _noise(0.06, 0.05, { type: 'highpass', freq: 2500, dest: g }); _tone(110, 0.5, 'sine', 0.03, 55, 0.02, g); }
    else if (r < 0.8) _tone(75 + Math.random() * 20, 1.8, 'triangle', 0.02, 55, 0, g);
    else _noise(1.4, 0.02, { freq: 900, to: 250, attack: 0.3, dest: g });
  }
}

/** A bird (by day) or an insect somewhere in the forest, into gain g. */
function jungleCall(g, dark) {
  if (!dark && Math.random() < 0.5) {
    // A bird: two or three falling whistles.
    const base = 1700 + Math.random() * 1400;
    for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) _tone(base, 0.12, 'sine', 0.025, base * 0.7, k * 0.17, g);
  } else {
    // An insect: a fast trill.
    const f = 4000 + Math.random() * 2500;
    for (let k = 0; k < 8; k++) _tone(f, 0.025, 'triangle', 0.012, f * 1.04, k * 0.035, g);
  }
}

/* ------------------------------------------------------------------ the night */

/*
 * The night out in the wilds (nightSounds, called from updateBeds), on the land's own bus (the Ambience volume):
 * - a cricket chorus that comes in at dusk, one or two first and the rest joining as the dark deepens: each cricket its
 *   own pitch, chirp and rhythm, singing a while and falling quiet (and another taking its place), so it never loops;
 *   a tree cricket's long soft trill under them; a katydid's rasp far off on the warm, green maps, and on the savanna
 *   a cicada's buzz swelling and fading;
 * - in the forests and the swamp now and then an owl hooting, a far-off night bird, the leaves rustling in a breath
 *   of wind; in the swamp the peepers by the water, frogs, and the odd splash; on the savanna and in the desert a few
 *   insects and the dry wind.
 * It's loudest out in the wilds and fades as the view fills with a town (WORLD.wild, as natureBeds), and it falls quiet
 * in a fight (warbots fighting on screen, a blast) and comes back slowly after; rain hushes the insects (not the
 * frogs); near a Murmur nest they hush too. The Hollow, Argos and the poles keep their own nights (no NIGHT_SET there).
 * Cheap: at most NIGHT_VOICES steady voices, made once when a night first comes (and let go after a long day) and
 * played by scheduling their gates a moment ahead, and at most NIGHT_SHOTS calls at once. Audio only: no sim state is
 * touched and its randomness is the sound's own.
 */
// crickets: [voices, pitch Hz, level]; trill: a tree cricket's pitch; buzz: 'katydid' or 'cicada' (and its level);
// peepers: how many; the calls' rates (owl, bird, rustle, frog, splash: about one a minute at 1, out in the wilds);
// air: the dry wind [filter Hz, Q, level].
const NIGHT_SET = {
  jungle: { crickets: [4, 4500, 1], trill: 2900, buzz: ['katydid', 1], owl: 1.2, bird: 1, rustle: 3 },
  autumn: { crickets: [4, 4100, 0.9], trill: 2650, owl: 1.6, bird: 0.8, rustle: 4, air: [3800, 0.6, 0.0035] },
  swamp: { crickets: [3, 4800, 0.8], trill: 3100, buzz: ['katydid', 0.7], peepers: 2, owl: 0.8, bird: 0.8, rustle: 1.5, frog: 5, splash: 3 },
  tropical: { crickets: [3, 5000, 0.85], trill: 3300, buzz: ['katydid', 0.9], bird: 0.6, rustle: 2 },
  springs: { crickets: [2, 4300, 0.6], frog: 1.5 },
  savanna: { crickets: [2, 4700, 0.6], buzz: ['cicada', 0.7], bird: 0.5, sparse: 1, air: [1700, 0.5, 0.0075] },
  desert: { crickets: [2, 3900, 0.5], sparse: 1, air: [1300, 0.45, 0.0085] },
};
const NIGHT_VOICES = 10, NIGHT_SHOTS = 3;
const NIGHT = { v: null, idle: 0, fray: 0, shots: [], next: {} };

/** The night's steady voices: crickets, a trill, a rasp (noise), peepers, the air; each into a gate, panned. */
function nightBuild(ac) {
  const bus = ac.createGain(); bus.gain.value = 0; bus.connect(AUDIO.natureBus);
  const ins = ac.createGain(); ins.gain.value = 1; ins.connect(bus); // (the insects: rain hushes them)
  const frogs = ac.createGain(); frogs.gain.value = 1; frogs.connect(bus);
  const srcs = [];
  const panned = (dest, p) => { if (!ac.createStereoPanner) return { node: dest, pan: null }; const n = ac.createStereoPanner(); n.pan.value = p; n.connect(dest); return { node: n, pan: n }; };
  const gated = (src, dest, p) => { const gate = ac.createGain(); gate.gain.value = 0; const pn = panned(dest, p); src.connect(gate).connect(pn.node); return { gate, pan: pn.pan, next: 0, end: 0 }; };
  const osc = (type) => { const o = ac.createOscillator(); o.type = type || 'sine'; o.start(); srcs.push(o); return o; };
  const noise = (type, f, q) => {
    const s = ac.createBufferSource(); s.buffer = AUDIO.noise; s.loop = true; s.start(0, Math.random() * 1.5); srcs.push(s);
    const flt = ac.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q; s.connect(flt); return flt;
  };
  const crickets = [];
  for (let k = 0; k < 4; k++) { const o = osc('sine'), v = gated(o, ins, Math.random() * 1.6 - 0.8); v.o = o; crickets.push(v); }
  // The tree cricket: a soft tone pulsing fast (an oscillator swinging its gain), in long swells.
  const to = osc('sine'), am = ac.createGain(); am.gain.value = 0.5;
  const lfo = osc('sine'), lg = ac.createGain(); lfo.frequency.value = 44; lg.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
  to.connect(am);
  const trill = gated(am, ins, Math.random() * 1.2 - 0.6); trill.o = to; trill.lfo = lfo;
  const bf = noise('bandpass', 6200, 3), buzz = gated(bf, ins, Math.random() * 1.4 - 0.7); buzz.f = bf;
  const peepers = [];
  for (let k = 0; k < 2; k++) { const o = osc('sine'), v = gated(o, frogs, (k ? 0.5 : -0.5) + Math.random() * 0.3); v.o = o; peepers.push(v); }
  const af = noise('bandpass', 1500, 0.5), ag = ac.createGain(); ag.gain.value = 0; af.connect(ag).connect(bus);
  return { bus, ins, frogs, srcs, crickets, trill, buzz, peepers, air: { f: af, g: ag, next: 0 } };
}

function nightDrop() {
  const V = NIGHT.v;
  NIGHT.v = null;
  if (!V) return;
  for (const s of V.srcs) { try { s.stop(); s.disconnect(); } catch (e) { /* gone */ } }
  try { V.bus.disconnect(); } catch (e) { /* gone */ }
}

/** A new cricket in voice v: its pitch, how many pulses in a chirp, how long each, how often it chirps, how near. */
function nightCricket(v, base, sparse) {
  v.f = base * (0.88 + Math.random() * 0.24);
  v.p = 2 + Math.floor(Math.random() * 4);
  v.pl = 0.012 + Math.random() * 0.012;
  v.pg = v.pl * (1.2 + Math.random() * 0.9);
  v.per = (sparse ? 0.6 : 0.32) + Math.random() * (sparse ? 0.9 : 0.7);
  v.a = 0.25 + Math.random() * 0.75;
  v.per = Math.max(v.per, v.p * (v.pl + v.pg) + 0.12); // (a chirp ends before the next)
  if (v.pan) v.pan.pan.value = Math.random() * 1.7 - 0.85;
}

/** Schedule the steady voices' gates from where each left off to `until` (s, on the audio clock). */
function nightSchedule(V, set, t, until, nk) {
  const R = Math.random, ramp = (g, a, s, att, len) => { g.setValueAtTime(0, s); g.linearRampToValueAtTime(a, s + att); g.linearRampToValueAtTime(a * 0.7, s + len - att); g.linearRampToValueAtTime(0, s + len); };
  const fresh = (v) => { if (v.next < t) { v.next = t + 0.05 + R() * 0.6; v.end = 0; } };
  // Crickets: voice k sings once the night is dark enough (nk past its turn), in bouts.
  const C = set.crickets, sparse = !!set.sparse;
  V.crickets.forEach((v, k) => {
    fresh(v);
    if (k >= C[0] || nk < 0.12 + (0.6 * k) / C[0]) { v.end = 0; return; }
    if (!v.f) nightCricket(v, C[1], sparse);
    while (v.next < until) {
      if (v.next >= v.end) {
        if (v.end) { v.next += (sparse ? 5 + R() * 14 : 1 + R() * 7); if (R() < 0.5) nightCricket(v, C[1], sparse); }
        v.end = v.next + (sparse ? 4 + R() * 12 : 8 + R() * 30);
        continue;
      }
      const s = v.next, a = 0.016 * C[2] * v.a;
      v.o.frequency.setValueAtTime(v.f * (1 + (R() - 0.5) * 0.006), s);
      for (let p = 0; p < v.p; p++) ramp(v.gate.gain, a, s + p * (v.pl + v.pg), 0.003, v.pl);
      v.next += v.per * (0.95 + R() * 0.1);
    }
  });
  // The tree cricket: swells in, trills a while, fades.
  const T = V.trill;
  fresh(T);
  if (set.trill && nk > 0.45) while (T.next < until) {
    const s = T.next, len = 3 + R() * 8, att = 1 + R() * 1.2;
    T.o.frequency.setValueAtTime(set.trill * (0.95 + R() * 0.1), s);
    T.lfo.frequency.setValueAtTime(36 + R() * 18, s);
    ramp(T.gate.gain, 0.006 * (0.5 + 0.5 * R()), s, att, len);
    T.next = s + len + 2 + R() * 9;
  }
  // A katydid's rasp (two to four, again and again) or the savanna's cicada swelling and fading, far off.
  const Z = V.buzz, B = set.buzz;
  fresh(Z);
  if (B && nk > 0.6) while (Z.next < until) {
    if (Z.next >= Z.end) {
      if (Z.end) Z.next += 3 + R() * 12;
      Z.end = Z.next + 5 + R() * 15;
      Z.n = 2 + Math.floor(R() * 3);
      if (Z.pan) Z.pan.pan.value = R() * 1.6 - 0.8;
      continue;
    }
    const s = Z.next;
    if (B[0] === 'cicada') {
      Z.f.frequency.setValueAtTime(5200 + R() * 900, s); Z.f.Q.setValueAtTime(6, s);
      const len = 1.5 + R() * 2.5;
      ramp(Z.gate.gain, 0.05 * B[1], s, len * 0.45, len);
      Z.next = s + len + 3 + R() * 6;
    } else {
      Z.f.frequency.setValueAtTime(6000 + R() * 1200, s); Z.f.Q.setValueAtTime(2.5, s);
      const len = 0.045 + R() * 0.025, gap = 0.1 + R() * 0.05;
      for (let k = 0; k < Z.n; k++) ramp(Z.gate.gain, 0.045 * B[1], s + k * (len + gap), 0.008, len);
      Z.next = s + 0.9 + R() * 0.5;
    }
  }
  // Peepers by the water: a short rising peep, over and over, two out of step.
  for (const v of V.peepers) {
    fresh(v);
    if (!set.peepers || nk < 0.35) continue;
    while (v.next < until) {
      if (v.next >= v.end) {
        if (v.end) v.next += 2 + R() * 8;
        v.end = v.next + 6 + R() * 20; v.f = 2700 + R() * 500; v.per = 0.7 + R() * 0.6; v.a = 0.4 + R() * 0.6;
        continue;
      }
      const s = v.next, len = 0.1 + R() * 0.05;
      v.o.frequency.setValueAtTime(v.f * 0.86, s); v.o.frequency.linearRampToValueAtTime(v.f, s + len);
      ramp(v.gate.gain, 0.011 * v.a, s, 0.015, len);
      v.next += v.per * (0.92 + R() * 0.16);
    }
  }
}

/** A soft tone for the night's calls: a gentle attack and release, sliding f to f2 (through a lowpass if lp). */
function nightTone(g, d, f, f2, dur, vol, type, lp) {
  const ac = AUDIO.ctx, t0 = ac.currentTime + d, o = ac.createOscillator(), e = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(f, t0);
  o.frequency.linearRampToValueAtTime((f + f2) / 2 * 1.02, t0 + dur * 0.35);
  o.frequency.linearRampToValueAtTime(f2, t0 + dur);
  const a = Math.min(0.06, dur * 0.25);
  e.gain.value = 0; e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(vol, t0 + a); e.gain.setValueAtTime(vol, t0 + dur - a * 1.5); e.gain.linearRampToValueAtTime(0, t0 + dur);
  let out = o;
  if (lp) { const flt = ac.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = lp; flt.Q.value = 1.5; o.connect(flt); out = flt; }
  out.connect(e).connect(g);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

/** One of the night's calls, from somewhere round about (vol: how near and loud), on the night's bus. Its length. */
function nightCall(kind, vol, dest) {
  const R = Math.random, g = aroundVoice(0.85, vol, dest);
  if (kind === 'owl') {
    // An owl: "hoo, h'hoo, hoo, hoo", or a long "hoooo" and a quavering answer.
    const f = 300 + R() * 90;
    const notes = R() < 0.55 ? [[0, 0.36, 1], [0.58, 0.16, 1.03], [0.8, 0.42, 1], [1.5, 0.5, 0.98], [2.2, 0.55, 0.96]] : [[0, 0.75, 1.06], [2, 0.14, 1], [2.24, 0.14, 1.02], [2.48, 1.1, 1.04]];
    for (const [d, len, m] of notes) { nightTone(g, d, f * m * 0.97, f * m * 0.92, len, 0.016); nightTone(g, d, f * m * 1.94, f * m * 1.84, len, 0.002); }
    return 4;
  }
  if (kind === 'bird') {
    if (R() < 0.6) {
      // A far-off night bird: three notes, the last rising, again and again.
      const f = 1150 + R() * 250, n = 3 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) { const d = k * (0.72 + R() * 0.06); nightTone(g, d, f * 1.18, f, 0.08, 0.009, 'sine', 2600); nightTone(g, d + 0.13, f, f * 0.95, 0.1, 0.007, 'sine', 2600); nightTone(g, d + 0.3, f * 0.92, f * 1.6, 0.24, 0.01, 'sine', 2600); }
      return n * 0.75 + 0.6;
    }
    // ...or a nightjar's long churr, shifting pitch now and then.
    const ac = AUDIO.ctx, t0 = ac.currentTime, len = 2 + R() * 3, o = ac.createOscillator(), am = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), e = ac.createGain();
    o.frequency.setValueAtTime(1000 + R() * 150, t0); o.frequency.setValueAtTime(1180 + R() * 150, t0 + len * (0.4 + R() * 0.3));
    lfo.frequency.value = 26 + R() * 8; lg.gain.value = 0.5; am.gain.value = 0.5; lfo.connect(lg).connect(am.gain);
    e.gain.value = 0; e.gain.setValueAtTime(0, t0); e.gain.linearRampToValueAtTime(0.006, t0 + 0.4); e.gain.setValueAtTime(0.006, t0 + len - 0.5); e.gain.linearRampToValueAtTime(0, t0 + len);
    o.connect(am).connect(e).connect(g); o.start(t0); lfo.start(t0); o.stop(t0 + len + 0.05); lfo.stop(t0 + len + 0.05);
    return len;
  }
  if (kind === 'rustle') {
    // The leaves stirring in a breath of wind, a few of them pattering.
    const len = 1.6 + R() * 1.6;
    _noise(len, 0.014, { type: 'bandpass', freq: 3200 + R() * 1500, to: 2200, q: 0.7, attack: 0.5 + R() * 0.5, dest: g });
    for (let k = 0; k < 2 + Math.floor(R() * 4); k++) _noise(0.03, 0.006, { type: 'highpass', freq: 3500 + R() * 2000, delay: 0.3 + R() * len * 0.7, dest: g });
    return len;
  }
  if (kind === 'frog') {
    if (R() < 0.5) { const f = 210 + R() * 60; for (let k = 0; k < 1 + Math.floor(R() * 2); k++) { const d = k * (0.5 + R() * 0.4); nightTone(g, d, f, f * 0.86, 0.11, 0.03, 'triangle'); nightTone(g, d, f * 2, f * 1.7, 0.08, 0.008); } return 1.2; } // a green frog's "gunk"
    const f = 92 + R() * 22; // a bullfrog's "rumm, rumm"
    for (let k = 0; k < 2 + Math.floor(R() * 2); k++) nightTone(g, k * 0.62, f, f * 0.9, 0.42, 0.03, 'sawtooth', 340);
    return 2;
  }
  if (kind === 'splash') {
    // Something in the water: a plop and a splash, a drip after.
    nightTone(g, 0, 620 + R() * 200, 170, 0.08, 0.02);
    _noise(0.35, 0.028, { type: 'bandpass', freq: 1600, to: 480, q: 0.9, attack: 0.004, dest: g });
    if (R() < 0.6) nightTone(g, 0.3 + R() * 0.2, 1700 + R() * 500, 900, 0.05, 0.008);
    return 1;
  }
  return 0;
}

/**
 * The night out in the wilds (see NIGHT_SET), every quarter second from updateBeds: b the biome, wx the weather heard
 * (weatherSound), zl how near the view is (zoomLoud).
 */
function nightSounds(live, dt, b, wx, zl) {
  const ac = AUDIO.ctx, t = ac.currentTime, set = NIGHT_SET[b];
  const ok = live && set && !!S && !S.hollow && natureReady();
  const light = ok && typeof todNow === 'function' ? todNow().lights || 0 : 0;
  // (the chorus comes in as dusk deepens: nothing in the evening's first light, all of it in full night)
  const nk = Math.max(0, Math.min(1, (light - 0.2) / 0.7));
  // A fight on screen hushes it at once; it comes back slowly.
  const frayT = ok ? Math.min(1, WORLD.fray || 0) : 0;
  NIGHT.fray += (frayT - NIGHT.fray) * Math.min(1, dt * (frayT > NIGHT.fray ? 3 : 0.1));
  const W = ok ? WORLD.wild || 0 : 0, scar = typeof faunaScarred === 'function' ? faunaScarred() : 0;
  const level = ok ? nk * Math.min(1, W * 1.25) * (0.55 + 0.45 * zl) * (1 - NIGHT.fray) * (1 - 0.5 * scar) * (1 - 0.6 * (WORLD.nest || 0)) : 0;
  if (level < 0.002) {
    if (NIGHT.v) { NIGHT.v.bus.gain.setTargetAtTime(0, t, 0.8); NIGHT.idle += dt; if (NIGHT.idle > 30) nightDrop(); }
    return;
  }
  NIGHT.idle = 0;
  if (!NIGHT.v) NIGHT.v = nightBuild(ac);
  const V = NIGHT.v, kind = wx ? wx.kind : '', wk = wx ? wx.k : 0;
  V.bus.gain.setTargetAtTime(level, t, 1.2);
  // Rain hushes the insects (the frogs call on); a sandstorm or a gale, and fog a little.
  const hushK = kind === 'rain' ? 0.85 : kind === 'sand' || kind === 'leaves' ? 0.7 : kind === 'fog' ? 0.3 : kind === 'snow' ? 1 : 0;
  V.ins.gain.setTargetAtTime(1 - hushK * wk, t, 1.5);
  nightSchedule(V, set, t, t + 0.6, nk);
  // The dry wind (and in the autumn wood, the leaves' soft hiss), gusting.
  const A = set.air;
  if (A) {
    if (t >= V.air.next) { V.air.next = t + 3 + Math.random() * 5; V.air.f.frequency.setTargetAtTime(A[0] * (0.7 + Math.random() * 0.6), t, 1.5); V.air.f.Q.value = A[1]; V.air.g.gain.setTargetAtTime(A[2] * (0.35 + 0.65 * Math.random()), t, 1.6); }
  } else V.air.g.gain.setTargetAtTime(0, t, 1);
  // The calls, now and then (rarer the less wild the view, and in rain), at most NIGHT_SHOTS at once.
  if (nk < 0.5) return;
  NIGHT.shots = NIGHT.shots.filter((e) => e > t);
  const wet = kind === 'rain' ? 1 - 0.7 * wk : 1;
  for (const k of ['owl', 'bird', 'rustle', 'frog', 'splash']) {
    if (!set[k]) continue;
    if (NIGHT.next[k] == null) NIGHT.next[k] = t + Math.random() * 20;
    if (t < NIGHT.next[k]) continue;
    NIGHT.next[k] = t + ((30 + Math.random() * 60) / set[k]) / Math.max(0.3, W) / (k === 'frog' ? 1 : wet);
    if (NIGHT.shots.length >= NIGHT_SHOTS) continue;
    const len = nightCall(k, (0.5 + 0.5 * Math.random()) * (k === 'owl' || k === 'bird' ? wet : 1), V.bus);
    NIGHT.shots.push(t + len);
  }
}

/* ------------------------------------------------------------------ music */

/** Which mood the music should be in right now. */
function musicMood() {
  if (typeof UI === 'undefined' || !UI.inGame || !S) return MUSIC.lore ? 'campaign' : 'menu';
  if (S.winner >= 0) return 'end';
  if (S.missiles.some((m) => m.nuke)) return 'nuke';
  if (MUSIC.of !== S) { MUSIC.of = S; MUSIC.warUntil = 0; MUSIC.murmurUntil = 0; MUSIC.wars = 0; MUSIC.warAt = -Infinity; }
  // Under attack, raiders in your land, or your warbots in a fight: war, for at least 40 s after. The Murmur close to
  // your colony (MUSIC_MURMUR of them, in your land or near your buildings) bring in Night Murmurs instead, for at least
  // 35 s after: the war music comes in for them only when enemy robots are in your land too.
  let threat = 0, robots = 0, wild = 0, mine = null;
  for (const b of S.buildings) if (!b.dead && b.owner === ME && S.time - (b.lastHit ?? -99) < 8) threat += 2;
  for (const u of S.bots) {
    if (u.dead || u.inside) continue;
    if (BOTS[u.type] && BOTS[u.type].wild) {
      if (BOTS[u.type].behemoth && u.task && u.task.p === ME) { wild += MUSIC_MURMUR; continue; } // (a Harrow coming for you: Night Murmurs)
      if (S.owner[Math.floor(u.y) * S.W + Math.floor(u.x)] === ME) { wild++; continue; }
      mine = mine || S.buildings.filter((b) => !b.dead && b.owner === ME);
      if (mine.some((b) => dist2(b.x + 0.5, b.y + 0.5, u.x, u.y) < MUSIC_MURMUR_NEAR * MUSIC_MURMUR_NEAR)) wild++;
      continue;
    }
    if (!isArmy(u)) continue;
    if (u.owner !== ME && S.owner[Math.floor(u.y) * S.W + Math.floor(u.x)] === ME) { threat++; robots++; }
    else if (u.owner === ME && u.fight) threat++;
  }
  const murmur = wild >= MUSIC_MURMUR;
  if (murmur) MUSIC.murmurUntil = S.time + 35;
  if (threat >= 3 && (robots > 0 || !murmur)) MUSIC.warUntil = S.time + 40;
  if (S.time < MUSIC.warUntil) return warTheme();
  // (in the campaign, once it sets the story's level, its theme plays in place of the build themes)
  return S.time < (MUSIC.murmurUntil || 0) ? 'murmur' : MUSIC.story != null ? 'campaign' : BUILD_THEMES[Math.floor(S.time / MUSIC_ROTATE) % BUILD_THEMES.length];
}

/**
 * The war theme for this fight. The two take turns: a new fight (war music again after WAR_GAP s of game time without
 * it) takes the other one, and a game's first is Overdrive. Within a fight, it stays the same theme.
 */
function warTheme() {
  if (S.time - MUSIC.warAt > WAR_GAP) MUSIC.wars++;
  MUSIC.warAt = S.time;
  return WAR_THEMES[(Math.max(1, MUSIC.wars) - 1) % WAR_THEMES.length];
}

/** Night Murmurs comes in with this many of the Murmur in your land or within MUSIC_MURMUR_NEAR tiles of your buildings. */
const MUSIC_MURMUR = 2, MUSIC_MURMUR_NEAR = 9;

/** The build music's themes, taking turns every MUSIC_ROTATE seconds of play (a game starts on the first). */
const BUILD_THEMES = ['build', 'build2', 'build3'], MUSIC_ROTATE = 600;
/** The war music's themes, a new fight taking the next (warTheme): Overdrive, then Redline. */
const WAR_THEMES = ['war', 'war2'], WAR_GAP = 30;
/** Each theme's title, for the Now playing card (nowPlayingTick in ui.js); the menu plays a slow take on the main theme. */
const MUSIC_TITLES = { menu: 'Lost in a Dream', build: 'Lost in a Dream', build2: 'Night Drive', build3: 'Horizon', war: 'Overdrive', war2: 'Redline', nuke: 'Zero Hour', murmur: 'Night Murmurs', campaign: 'The Long Silence' };

/**
 * The campaign theme (The Long Silence) and how far into the story it is: `level` 0 (the landing) to 1 (the Silence)
 * picks its stage (`stages` in MOODS.campaign) and how much of the Murmur is in the mix. The campaign (planned:
 * CAMPAIGN.md) sets it chapter by chapter, (mission - 1) / 14 for its fifteen; set, the theme plays in a game in place
 * of the build themes (the war, the Murmur and a nuke still take over), and null ends it. Display only, like all the
 * music: nothing in the game depends on it.
 */
function musicStory(level) { MUSIC.story = level == null ? null : clampV(level); }
/** The Lore guide is open (openLore/closeLore in ui.js): the campaign theme plays at LORE_STORY while it is. */
function musicLore(open) {
  MUSIC.lore = !!open;
  if (AUDIO.ctx) MUSIC.want = musicMood();
}
/** The story's level the Lore guide plays the campaign theme at: the first murmur, quiet enough to read by. */
const LORE_STORY = 0.33;
/** The level the campaign theme plays at now (MUSIC.loreLevel: Contingency's globe sets its own, js/contingency-ui.js). */
function storyLevel() { return MUSIC.lore && !(typeof UI !== 'undefined' && UI.inGame) ? (MUSIC.loreLevel != null ? MUSIC.loreLevel : LORE_STORY) : MUSIC.story == null ? 0 : MUSIC.story; }

const MINOR = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10], DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11], MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10], HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const CHORD = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], dim: [0, 3, 6], sus2: [0, 2, 7], sus4: [0, 5, 7] };

/**
 * The campaign theme's tune, four bars in scale degrees (0: the key's root, an octave up), each note [step, degree,
 * length in steps]. It's the same tune in every stage, so it darkens as the stages walk the modes from the brightest to
 * the darkest: D A E D | C♯ A B | D A E F♯ E | D in Lydian, D A E♭ D | C A B♭ | D A E♭ F E♭ | D in Phrygian.
 */
const STORY_THEME = [
  [[0, 0, 6], [6, 4, 2], [8, 8, 6], [14, 7, 2]],
  [[0, 6, 4], [4, 4, 4], [8, 5, 8]],
  [[0, 0, 6], [6, 4, 2], [8, 8, 4], [12, 9, 2], [14, 8, 2]],
  [[0, 7, 12], [12, 4, 4]],
];
/**
 * Redline's grind (mGrind), four bars of straight eighths as semitones over the key's root: a pedal that ignores the
 * chords above it, but for the half step up (the minor second) at the end of the second bar and the tritone and the
 * half step at the end of the fourth.
 */
const GRIND = [[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 6, 6, 1, 1]];
/** Redline's cold lead ('toll', mCold), four bars of [step, semitones over the key, length in steps]: D, E♭ D, B♭ A♭ (the tritone), A. */
const TOLL = [[[0, 12, 15]], [[0, 13, 7], [8, 12, 7]], [[0, 8, 7], [8, 6, 7]], [[0, 7, 12]]];
/** The campaign's road lights (its 'lights' arpeggio, eight to a bar), in the order they go dark as the story goes on. */
const LIGHTS_OUT = [7, 3, 5, 1, 6, 2, 4, 0];
/** The Uplink's call in the campaign theme ('signal'), the steps of its bar; the ground answers in the same rhythm. */
const SIGNAL = [0, 3, 6, 8, 12];

/** Each mood: tempo, keys (MIDI note of the root, octave 3), scale, chord progressions, and its arrangements. */
const MOODS = {
  menu: {
    bpm: 84, keys: [57, 55], scale: MINOR, chordBars: 2,
    progs: [[[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], [[0, 'm7'], [5, 'm'], [8, 'M7'], [10, 'M']]],
    arrange: [['pad', 'arp8'], ['pad', 'arp8', 'bassW'], ['pad', 'arp8', 'bassW', 'shimmer'], ['pad', 'shimmer', 'bassW']],
  },
  // Lost in a Dream: the main theme (the menu plays it slowly, on the same chords).
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
  // Night Drive: a little quicker and brighter (Dorian), an octave-pumping bass, claps and a plucked lead.
  build2: {
    bpm: 102, keys: [55, 57, 53], scale: DORIAN, chordBars: 1, lead: 'pluck',
    progs: [[[0, 'm7'], [5, 'M'], [0, 'm7'], [5, 'M']], [[0, 'm'], [10, 'M'], [5, 'M'], [0, 'm']], [[0, 'm7'], [3, 'M'], [10, 'M'], [5, 'M']], [[5, 'M'], [10, 'M'], [0, 'm'], [0, 'm7']]],
    arrange: [
      ['pad', 'arp'],
      ['pad', 'arp', 'bassOct', 'hat8'],
      ['pad', 'arp', 'bassOct', 'kick', 'clap', 'hat8'],
      ['pad', 'arp', 'bassOct', 'kick', 'clap', 'hat8', 'lead'],
      ['pad', 'lead', 'hat8', 'bassW', 'shimmer'],
      ['pad', 'bassOct', 'kick', 'clap', 'hat8', 'lead'],
    ],
  },
  // Horizon: slower and dreamier: half-time drums, a chord every two bars, an arpeggio rolling in threes over the beat.
  build3: {
    bpm: 88, keys: [52, 54, 50], scale: MINOR, chordBars: 2, gain: 1.25,
    progs: [[[0, 'm'], [8, 'M'], [10, 'M'], [7, 'm']], [[0, 'm7'], [3, 'M7'], [8, 'M7'], [10, 'M']], [[5, 'm'], [0, 'm'], [8, 'M'], [10, 'M']]],
    arrange: [
      ['pad', 'arp3'],
      ['pad', 'arp3', 'bassW', 'shimmer'],
      ['pad', 'arp3', 'bassHalf', 'kickHalf', 'snareHalf', 'hat'],
      ['pad', 'arp3', 'bassHalf', 'kickHalf', 'snareHalf', 'hat', 'lead'],
      ['pad', 'shimmer', 'lead', 'bassW'],
      ['pad', 'arp3', 'bassHalf', 'kickHalf', 'snareHalf', 'lead'],
    ],
  },
  // Overdrive: the first war theme.
  war: {
    bpm: 112, keys: [52, 53, 55], scale: PHRYGIAN, chordBars: 1, crash: true,
    progs: [[[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M']], [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']], [[0, 'm'], [0, 'm'], [8, 'M'], [10, 'M']]],
    arrange: [
      ['pad', 'bass16', 'kick4', 'hat16', 'snare'],
      ['pad', 'bass16', 'kick4', 'hat16', 'snare', 'stab'],
      ['pad', 'bass16', 'kick4', 'hat16', 'snare', 'lead', 'arp'],
      ['bass16', 'kick4', 'tom', 'hat16', 'stab'],
    ],
  },
  // Redline: the second war theme, taking turns with Overdrive (warTheme): relentless and threatening, the machines
  // grinding forward. Built on the buzzy bass, lower and dirtier (mGrind): straight eighths on a pedal an octave under
  // the usual bass, the key's root whatever the chords above it do (GRIND: only a half step up and the tritone), driven
  // hard into the clipper, its filter opening slowly over each whole section from a growl to a snarl and shut again
  // with the impact that starts the next. D or C♯ Phrygian, slower than Overdrive, a chord every two bars over the
  // pedal (the flat second, the diminished chord on the tritone); a straight, heavy drive (four on the floor, or a
  // pounding half-time), a dry snare with an industrial clank (mClank), tight closed hats, no swing; a low brass swell
  // with a minor second in it (mBrass), dissonant stabs, a droning pedal, a cold low lead now and then (TOLL, mCold),
  // and a riser into a crash and an impact (mImpact) on each new section.
  war2: {
    bpm: 104, keys: [50, 49], scale: PHRYGIAN, chordBars: 2, crash: true, impact: true, gain: 0.97, kick: 0.17,
    progs: [[[0, 'm'], [1, 'M'], [0, 'm'], [6, 'dim']], [[0, 'm'], [0, 'm'], [1, 'M'], [1, 'M']], [[0, 'm'], [8, 'M'], [1, 'M'], [6, 'dim']], [[0, 'm'], [10, 'm'], [1, 'M'], [0, 'm']]],
    arrange: [
      ['grind', 'pedal', 'kick4h', 'clank', 'hatT', 'stabD', 'riser'],
      ['grind', 'kick4h', 'clank', 'hatT', 'brass', 'riser'],
      ['grind', 'kick4h', 'clank', 'hatT', 'brass', 'toll', 'tom', 'riser'],
      ['grind', 'pedal', 'kickPound', 'clankHalf', 'hatT', 'stabD', 'tom', 'riser'],
      ['grind', 'pedal', 'brass', 'hatT', 'riser'],
      ['grind', 'pedal', 'kick4h', 'clank', 'hatT', 'brass', 'stabD', 'toll', 'tom', 'riser'],
    ],
  },
  // Night Murmurs: the Murmur close by. Slow and low (Phrygian, a chord every two bars): a choir of whispers pitched on
  // the chord (filtered noise, the murmur itself), a slow heartbeat, a bass creeping a semitone up and back, and pale
  // crystal glints far off in the echo, like the geodes on their backs catching the light.
  murmur: {
    bpm: 70, keys: [50, 49, 52], scale: PHRYGIAN, chordBars: 2, gain: 0.7,
    progs: [[[0, 'm'], [1, 'M'], [0, 'm'], [8, 'M']], [[0, 'm'], [10, 'M'], [1, 'M'], [0, 'm']], [[0, 'm7'], [8, 'M'], [5, 'm'], [1, 'M']]],
    arrange: [
      ['whisper', 'drone'],
      ['whisper', 'drone', 'heart', 'glint'],
      ['whisper', 'pad', 'heart', 'glint', 'bassW'],
      ['whisper', 'pad', 'creep', 'heart', 'glint', 'tick3'],
      ['whisper', 'drone', 'creep', 'glint', 'lead'],
      ['pad', 'whisper', 'heart', 'creep', 'tick3'],
    ],
  },
  // The Long Silence: the campaign theme, the whole story in one piece. The story's level (storyLevel: 0, the landing,
  // to 1, the Silence; set by musicStory, or the Lore guide's LORE_STORY) picks the stage, the last whose `at` it has
  // reached, at each new section; the stage's settings stand over the theme's own (moodDef). One key, D, all through:
  // the stages walk the modes from the brightest to the darkest, and the same tune (STORY_THEME) darkens with them. The
  // level also sets, bar by bar, how much of the Murmur is heard: the whispering choir ('choir') grows from a breath to
  // a wall, crystal glints ('glints') come oftener, the heartbeat ('pulse') beats harder, the Uplink's call ('signal') is
  // answered by the ground more often, and the colony's road lights (the 'lights' arpeggio) go dark one by one.
  // (Its soundtrack export plays the whole arc in fifteen sections, five minutes: the level rising from 0 to 1 over the
  // first thirteen, then two more at 1 for the Silence.)
  campaign: {
    bpm: 96, keys: [50], scale: MINOR, chordBars: 2, theme: STORY_THEME,
    stages: [
      // Landfall (0, the first missions): hopeful and wide. D Lydian: a halo of high chords spread across the stereo,
      // the shimmer (the Ring in the sky), the arpeggio in threes, the soft buzzy bass and the bell playing the tune.
      { at: 0, scale: LYDIAN, gain: 1.15,
        progs: [[[0, 'M7'], [2, 'M'], [9, 'm'], [7, 'M']], [[0, 'M'], [2, 'M'], [4, 'm'], [2, 'M']], [[9, 'm'], [7, 'M'], [0, 'M7'], [2, 'M']]],
        arrange: [['pad', 'halo', 'shimmer'], ['pad', 'halo', 'arp3', 'bassW', 'lead'], ['pad', 'arp3', 'bassW', 'shimmer', 'lead']] },
      // The colony at work (0.1): D Mixolydian, half-time drums, the bass, the road lights all lit, the tune; now and then
      // a crystal glint far off.
      { at: 0.1, scale: MIXOLYDIAN, gain: 1,
        progs: [[[0, 'M'], [10, 'M'], [5, 'M'], [0, 'M']], [[0, 'M'], [7, 'm'], [10, 'M'], [5, 'M']], [[5, 'M'], [10, 'M'], [0, 'M'], [0, 'M']]],
        arrange: [['pad', 'lights', 'bassHalf', 'kickHalf', 'snareHalf', 'hat', 'glints'], ['pad', 'lights', 'bassHalf', 'kickHalf', 'snareHalf', 'hat', 'lead', 'glints'],
          ['pad', 'halo', 'lights', 'bassHalf', 'kickHalf', 'hat', 'lead', 'glints']] },
      // The first murmur (0.25; the Lore guide plays this one): D Dorian. The drums fall away and the sound in the ground
      // comes in: the choir, faint, a slow heartbeat, the Uplink's call (sometimes answered), the first lights out, the
      // tune breaking off after two bars.
      { at: 0.25, scale: DORIAN, gain: 1.05, themeBars: [0, 1, null, null],
        progs: [[[0, 'm7'], [5, 'M'], [0, 'm7'], [5, 'M']], [[0, 'm'], [10, 'M'], [5, 'M'], [0, 'm']], [[3, 'M'], [5, 'M'], [0, 'm'], [0, 'm7']]],
        arrange: [['pad', 'choir', 'lights', 'pulse', 'glints', 'signal'], ['pad', 'choir', 'lights', 'bassW', 'glints', 'lead'],
          ['pad', 'choir', 'lights', 'pulse', 'bassW', 'glints', 'signal', 'shimmer']] },
      // Contingency (0.4): D minor, a chord a bar. The war turns serious: the drums come back, the main theme's own chords,
      // the bass creeping a half step, the tune whole again but dark, the choir louder, more lights out.
      { at: 0.4, scale: MINOR, chordBars: 1, gain: 0.88,
        progs: [[[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'm']], [[0, 'm7'], [5, 'm'], [8, 'M7'], [10, 'M']]],
        arrange: [['pad', 'choir', 'creep', 'kick', 'snare', 'hat', 'lights', 'glints'], ['pad', 'choir', 'bass', 'kick', 'snare', 'hat', 'lead', 'glints', 'signal'],
          ['pad', 'choir', 'creep', 'kick', 'snare', 'hat8', 'lights', 'lead', 'glints']] },
      // The Murmur rise (0.68): D Phrygian, the climax. The choir is a wall, the lights are gone, glints swarm; Redline's
      // straight, pounding drums (four on the floor or the half-time, the dry snare and clank, tight hats), its low grind
      // on the pedal under the slow filter, a drone, the tune on the saw, and an impact on each new section.
      { at: 0.68, scale: PHRYGIAN, chordBars: 1, lead: 'saw', gain: 0.73, kick: 0.17, impact: true,
        progs: [[[0, 'm'], [1, 'M'], [0, 'm'], [1, 'M']], [[0, 'm'], [1, 'M'], [10, 'm'], [0, 'm']], [[0, 'm'], [8, 'M'], [1, 'M'], [0, 'm']]],
        arrange: [['choir', 'drone', 'grind', 'kick4h', 'clank', 'hatT', 'glints', 'riser'], ['choir', 'pad', 'grind', 'kickPound', 'clankHalf', 'hatT', 'lead', 'glints', 'tom', 'riser'],
          ['choir', 'drone', 'grind', 'kick4h', 'clank', 'hatT', 'lead', 'glints', 'tom', 'riser']] },
      // The Silence (0.96, the last mission): it all stops. Suspended chords, neither major nor minor, and every
      // progression ends away from home; the halo and the shimmer again, the Uplink calling, two lights left, the tune's
      // first bar alone; then the choir again, fainter and further off.
      { at: 0.96, scale: DORIAN, gain: 1.25, silence: true, themeBars: [null, null, 0, null],
        progs: [[[0, 'sus2'], [8, 'M7'], [3, 'M7'], [10, 'sus2']], [[8, 'M7'], [10, 'sus2'], [0, 'sus2'], [5, 'sus4']], [[0, 'sus2'], [5, 'sus4'], [8, 'M7'], [10, 'sus2']]],
        arrange: [['pad', 'halo', 'shimmer', 'signal', 'lead'], ['pad', 'choir', 'lights', 'pulse', 'signal', 'bassW'], ['pad', 'halo', 'choir', 'lights', 'shimmer', 'signal', 'lead']] },
    ],
  },
  nuke: {
    bpm: 120, keys: [53], scale: PHRYGIAN, chordBars: 2, crash: true,
    progs: [[[0, 'm'], [1, 'M']]],
    arrange: [['drone', 'alarm', 'heart', 'hat16']],
  },
  end: { bpm: 90, keys: [57], scale: MINOR, chordBars: 1, progs: [[[0, 'm']]], arrange: [[]] },
};

const MUSIC = { timer: 0, next: 0, step: 0, bar: 0, mood: '', want: 'menu', def: null, layers: new Set(), stepDur: 0.15, key: 57, prog: null, sect: 0, arr: 0, of: null, warUntil: 0, motif: null, arpMode: 0, color: false, lastDeg: 7,
  wars: 0, warAt: -Infinity, story: null, lore: false, lv: 0, stage: 0, rose: false, sawHz: 0 };

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

/**
 * A mood's settings. A theme told in stages (the campaign's) takes the stage for the story's level now, the last whose
 * `at` it has reached (MUSIC.stage), its settings standing over the theme's own.
 */
function moodDef(m) {
  const d = MOODS[m];
  if (!d.stages) return d;
  const lv = storyLevel();
  let k = 0;
  while (k + 1 < d.stages.length && lv >= d.stages[k + 1].at) k++;
  MUSIC.stage = k;
  return Object.assign({}, d, d.stages[k]);
}

/** Switch to a new mood: its tempo, a key, a progression, and the first arrangement. */
function musicSetMood(m, t) {
  const d = moodDef(m);
  MUSIC.mood = m; MUSIC.def = d;
  if (AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(musicLevel(), t, 0.4); // (each theme at its own trim)
  MUSIC.stepDur = 60 / d.bpm / 4;
  MUSIC.key = d.keys[rnd(d.keys.length)];
  MUSIC.prog = d.progs[rnd(d.progs.length)];
  MUSIC.bar = 0; MUSIC.sect = 0; MUSIC.arr = 0;
  MUSIC.layers = new Set(d.arrange[0]);
  MUSIC.arpMode = rnd(3);
  MUSIC.motif = makeMotif();
  MUSIC.rose = false; MUSIC.sawHz = 0;
  if (AUDIO.mEcho) AUDIO.mEcho.delayTime.setValueAtTime(MUSIC.stepDur * 3, t); // a dotted-eighth echo
  if (d.crash) mCrash(t);
  if (d.impact) mImpact(t);
}

/**
 * A new 8-bar section: bring parts in and out, and now and then a new progression. In a theme told in stages, a new
 * stage of the story brings its own first arrangement, a progression of its own and its trim.
 */
function musicSection(t) {
  let d = MUSIC.def;
  MUSIC.sect++;
  const was = MUSIC.stage;
  if (d.stages) MUSIC.def = d = moodDef(MUSIC.mood);
  if (d.stages && MUSIC.stage !== was) {
    MUSIC.arr = 0;
    MUSIC.prog = d.progs[rnd(d.progs.length)];
    if (AUDIO.musicBus) AUDIO.musicBus.gain.setTargetAtTime(musicLevel(), t, 0.6);
  } else {
    if (d.arrange.length > 1) {
      let a;
      do a = 1 + rnd(d.arrange.length - 1); while (a === MUSIC.arr && d.arrange.length > 2);
      MUSIC.arr = a;
    }
    if (MUSIC.sect % 2 === 0) MUSIC.prog = d.progs[rnd(d.progs.length)];
  }
  MUSIC.layers = new Set(d.arrange[MUSIC.arr]);
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
  if (L.has('kickHalf') && (s === 0 || (s === 10 && MUSIC.bar % 2 === 1))) mKick(t, 0.95);
  if (L.has('snareHalf') && s === 8) mSnare(t, 1.1);
  if (L.has('snareHalf') && fill && s >= 12 && s % 2 === 0) mSnare(t, 0.35 + (s - 12) * 0.12);
  if (L.has('clap') && (s === 4 || s === 12)) mClap(t, 1);
  if (L.has('clap') && fill && s === 15) mClap(t, 0.5);
  if (L.has('hat8') && s % 2 === 0) mHat(t, s % 4 === 2 ? 0.07 : 0.025, s % 4 === 2 ? 1 : 0.6);
  if (L.has('heart') && (s === 0 || s === 3)) mKick(t, s ? 0.5 : 0.7);
  if (L.has('snare') && (s === 4 || s === 12)) mSnare(t, 1);
  if (L.has('snare') && fill && s >= 13) mSnare(t, 0.4 + (s - 12) * 0.15);
  if (L.has('hat') && s % 4 === 2) mHat(t, s === 14 ? 0.12 : 0.04, 1);
  if (L.has('hat16')) mHat(t, 0.03, s % 2 ? 0.55 : 1);
  if (L.has('tom') && fill && s >= 8 && s % 2 === 0) mTom(t, 140 - (s - 8) * 9);
  // Redline's drums (and the campaign theme's climax's), all on the beat: four on the floor (kick4h) or a pounding
  // half-time (kick, kick, the snare on three, kick), the dry snare and clank on two and four (on three in half-time; a
  // straight roll into a new section), tight closed hats.
  if (L.has('kick4h') && s % 4 === 0) mKickHard(t, 1, d.kick);
  if (L.has('kickPound') && (s === 0 || s === 4 || s === 12)) mKickHard(t, s ? 0.9 : 1, d.kick);
  if (L.has('clank') && (s === 4 || s === 12)) mClank(t, 1);
  if (L.has('clankHalf') && s === 8) mClank(t, 1.1);
  if ((L.has('clank') || L.has('clankHalf')) && fill && s >= 13) mClank(t, 0.4 + (s - 13) * 0.2);
  if (L.has('hatT')) mHat(t, 0.014, s % 4 === 0 ? 0.9 : s % 2 === 0 ? 0.65 : 0.45);
  // A riser into the next section, and a crash on its downbeat (and an impact in Redline and the campaign's climax).
  if (s === 0 && MUSIC.rose && MUSIC.bar % 8 === 0) { MUSIC.rose = false; mCrash(t); if (d.impact) mImpact(t); }
  if (L.has('riser') && fill && s === 0) { mRiser(t, sd * 16); MUSIC.rose = true; }
  // Bass
  if (L.has('bass') && s % 2 === 0) mBass(t, root - 12 + (s % 8 === 6 ? 12 : 0), sd * 1.6);
  if (L.has('bassW') && s === 0) mBass(t, root - 12, sd * 15, true);
  if (L.has('bass16')) mBass(t, root - 12 + (s % 8 === 7 ? 12 : 0), sd * 0.8);
  if (L.has('bassOct') && s % 2 === 0) mBass(t, root - 12 + (s % 4 === 2 ? 12 : 0), sd * 1.5); // root and octave, eighth notes
  if (L.has('bassHalf') && (s === 0 || s === 6 || s === 10)) mBass(t, root - 12 + (s === 6 ? 7 : 0), sd * (s === 0 ? 5 : 3), true);
  // Redline's grind (the campaign theme's climax's too): straight eighths on the pedal (GRIND), its filter opening
  // slowly over the whole section, from 200 Hz to 1.8 kHz, and shut again on the next.
  if (L.has('grind') && s % 2 === 0) {
    const ph = ((MUSIC.bar % 8) * 16 + s) / 126;
    mGrind(t, MUSIC.key - 24 + GRIND[MUSIC.bar % 4][s / 2], sd * 1.85, 200 * Math.pow(9, ph), s % 4 === 0 ? 1 : 0.85);
  }
  // Arpeggio: chord tones across two octaves.
  if (L.has('arp') || (L.has('arp8') && s % 2 === 0)) {
    const notes = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
    const k = L.has('arp8') ? s / 2 : s;
    const i = MUSIC.arpMode === 0 ? k % notes.length : MUSIC.arpMode === 1 ? pingPong(k, notes.length) : (k * 5 + MUSIC.bar * 3) % notes.length;
    mArp(t, MUSIC.key + notes[i], s);
  }
  // In threes: six notes a bar against the four beats, carrying on from bar to bar.
  if (L.has('arp3') && s % 3 === 0) {
    const notes = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)], k = s / 3 + MUSIC.bar * 6;
    mArp(t, MUSIC.key + notes[MUSIC.arpMode === 1 ? pingPong(k, notes.length) : k % notes.length], s);
  }
  if (L.has('stab') && [0, 3, 6, 10].includes(s)) mStab(t, chord);
  // Redline: a dissonant stab on each bar's downbeat, and the cold lead's long notes.
  if (L.has('stabD') && s === 0) mStabD(t, chord, MUSIC.chordRoot);
  if (L.has('toll')) for (const [at, n, len] of TOLL[MUSIC.bar % 4]) if (at === s) mCold(t, MUSIC.key + n, len * sd);
  // Shimmer: a slow, high bell arpeggio drifting through the chord.
  if (L.has('shimmer') && s % 4 === 0) { const hi = chord.map((n) => n + 24); mLead(t, MUSIC.key + hi[(s / 4 + MUSIC.bar) % hi.length], sd * 6, 0.6); }
  if (L.has('alarm') && s % 4 === 0) mAlarm(t, MUSIC.key + 12 + (s % 8 === 0 ? 0 : 6));
  // Night Murmurs: the creeping bass (root, then a semitone up and back), a tick in threes, far-off crystal glints.
  if (L.has('creep') && (s === 0 || s === 8)) mBass(t, root - 12 + (s === 8 && MUSIC.bar % 2 === 1 ? 1 : 0), sd * 7, true);
  if (L.has('tick3') && s % 3 === 0) mHat(t, 0.018, s === 0 ? 0.5 : 0.3);
  if (L.has('glint') && (s === 6 || s === 13) && Math.random() < 0.45) mLead(t, MUSIC.key + 36 + chord[rnd(chord.length)], sd * 4, 0.3);
  // The campaign theme's Murmur, as much of it as the story's level (MUSIC.lv) says: glints oftener (a swarm at the
  // climax), the road lights going dark one by one (LIGHTS_OUT; two are left in the Silence), the heartbeat, and the
  // Uplink's call (SIGNAL), which the ground sometimes answers in the same rhythm the bar after.
  const lv = MUSIC.lv;
  if (L.has('glints') && (s === 6 || s === 13 || (lv >= 0.68 && !d.silence && (s === 2 || s === 10))) && Math.random() < (d.silence ? 0.25 : 0.12 + 0.6 * lv)) mLead(t, MUSIC.key + 36 + chord[rnd(chord.length)], sd * 4, 0.3 + 0.3 * lv);
  if (L.has('lights') && s % 2 === 0) {
    const k = s / 2, dark = d.silence ? 6 : Math.max(0, Math.min(8, Math.floor(((lv - 0.22) / 0.5) * 8)));
    if (LIGHTS_OUT.indexOf(k) >= dark) {
      const notes = [...chord.map((n) => n + 12), ...chord.map((n) => n + 24)];
      mArp(t, MUSIC.key + notes[MUSIC.arpMode === 1 ? pingPong(k, notes.length) : k % notes.length], s);
    }
  }
  if (L.has('pulse') && (s === 0 || s === 3)) mKick(t, (s ? 0.45 : 0.65) * (d.silence ? 0.6 : 0.55 + 0.5 * lv));
  if (L.has('signal') && SIGNAL.includes(s)) {
    const b = MUSIC.bar % 4;
    if (b === 0 && s === 0) MUSIC.answer = Math.random() < (d.silence ? 0.5 : Math.max(0, Math.min(0.8, (lv - 0.15) * 1.6)));
    if (b === 0) mBeacon(t, MUSIC.key + (s === 12 ? 31 : 36));
    else if (b === 1 && MUSIC.answer) mThud(t, s === 0 ? 1 : 0.75);
  }
  // Melody
  if (L.has('lead') && MUSIC.melody) {
    const n = MUSIC.melody[s];
    if (n) (d.lead === 'pluck' ? mPluck : d.lead === 'saw' ? mSaw : mLead)(t, n[0], n[1] * sd, d.silence ? 0.75 : 1);
  }
}

function pingPong(k, n) { const p = 2 * n - 2; const m = k % p; return m < n ? m : p - m; }

/**
 * Into Night Murmurs, and out of it at dawn (but not into war): the theme playing fades away over MUSIC_FADE_OUT s, then
 * the new one swells in from silence over MUSIC_FADE_IN s, rather than cutting over at the bar (the owner's call, Nov
 * 2026). War, a nuclear alarm and the end of the game still cut in at once.
 */
const MUSIC_FADE_OUT = 3, MUSIC_FADE_IN = 9;
function musicFades(from, to) {
  if (!from || WAR_THEMES.includes(to) || to === 'nuke' || to === 'end') return false;
  return (to === 'murmur') !== (from === 'murmur');
}

/** The music bus from where it is now to `v` in a straight line by time t1 (scheduled from t). */
function musicRamp(t, v, t1) {
  if (!AUDIO.musicBus) return;
  const g = AUDIO.musicBus.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(v, t1);
}

/** At the top of each bar: mood changes, sections, the chord, pads and the melody for the bar. */
function musicBar(t) {
  // (one build theme gives way to the next only at the end of an 8-bar section)
  const turn = BUILD_THEMES.includes(MUSIC.want) && BUILD_THEMES.includes(MUSIC.mood) && MUSIC.bar % 8 !== 7;
  let change = MUSIC.want !== MUSIC.mood && !turn;
  const fade = change && musicFades(MUSIC.mood, MUSIC.want);
  if (fade) {
    // The theme playing fades out first, and plays on meanwhile (see musicFades).
    if (MUSIC.fadeTo !== MUSIC.want) { MUSIC.fadeTo = MUSIC.want; MUSIC.fadeEnd = t + MUSIC_FADE_OUT; musicRamp(t, 0.0001, MUSIC.fadeEnd); }
    if (t < MUSIC.fadeEnd) change = false;
  } else if (MUSIC.fadeTo) {
    // Called off (the theme playing is wanted again) or overtaken (war cut in): back up to its level, or on at once.
    MUSIC.fadeTo = null;
    if (AUDIO.musicBus) { const g = AUDIO.musicBus.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); if (!change) g.setTargetAtTime(musicLevel(), t, 0.5); }
  }
  if (change) {
    MUSIC.fadeTo = null;
    musicSetMood(MUSIC.want, t);
    if (fade) musicRamp(t, musicLevel(), t + MUSIC_FADE_IN); // (from silence)
  } else {
    MUSIC.bar++;
    if (MUSIC.bar % 8 === 0) musicSection(t);
  }
  const d = MUSIC.def, prog = MUSIC.prog;
  MUSIC.lv = d.stages ? storyLevel() : 0;
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
  if (L.has('pedal')) mDrone(t, MUSIC.key - 12, barDur, MUSIC.bar, 0.45, 1000); // (Redline's: on the key's root whatever the chord, under the grind)
  if (L.has('brass') && MUSIC.bar % d.chordBars === 0) mBrass(t, c[0], MUSIC.chord, barDur * d.chordBars);
  if (L.has('whisper') && MUSIC.bar % d.chordBars === 0) mWhisper(t, MUSIC.chord.map((n) => MUSIC.key + n), barDur * d.chordBars);
  // The campaign theme: the halo, and the choir as loud as the story's level says (far off and faint in the Silence).
  if (L.has('halo') && MUSIC.bar % d.chordBars === 0) mHalo(t, MUSIC.chord.map((n) => MUSIC.key + n), barDur * d.chordBars);
  // (15 dB louder from the first murmur, 0.25, to the climax, 0.75: from a breath under the pads to a wall over them,
  // and from 0.6 an octave higher too)
  if (L.has('choir') && MUSIC.bar % d.chordBars === 0) {
    const lv = Math.max(0.25, Math.min(0.75, MUSIC.lv)), v = d.silence ? 2.6 : 1.8 * Math.pow(10, ((lv - 0.25) / 0.5) * 0.75);
    mWhisper(t, MUSIC.chord.map((n) => MUSIC.key + n), barDur * d.chordBars, v, d.silence ? 1 : 0, !d.silence && MUSIC.lv >= 0.6);
  }
  MUSIC.melody = !L.has('lead') ? null : d.theme ? realizeTheme(d) : realizeMotif(MUSIC.motif, MUSIC.chord);
}

/** The bar's notes of the campaign theme's tune (STORY_THEME) in the stage's scale; null in a bar the stage leaves out. */
function realizeTheme(d) {
  const bars = d.themeBars || [0, 1, 2, 3], k = bars[MUSIC.bar % bars.length];
  if (k == null) return null;
  const out = new Array(16).fill(null);
  for (const [s, deg, len] of d.theme[k]) out[s] = [MUSIC.key + 12 + Math.floor(deg / 7) * 12 + d.scale[deg % 7], len * 0.9];
  return out;
}

/** A short rhythmic idea (onsets and moves through the scale) that the lead repeats over the section's chords. */
function makeMotif() {
  const rhythms = (MUSIC.def && MUSIC.def.rhythms) || [[0, 3, 6, 10, 12], [0, 4, 8, 12], [0, 2, 4, 8, 11, 14], [0, 6, 8, 14], [0, 3, 8, 10, 12, 14], [0, 8, 10]];
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

/** Night Drive's lead: a plucked synth, two detuned saws through a filter that snaps shut, into the echo. */
function mPluck(t, n, dur, vol) {
  const ac = AUDIO.ctx, f = midiHz(n), lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.Q.value = 3;
  lp.frequency.setValueAtTime(4200, t); lp.frequency.exponentialRampToValueAtTime(520, t + 0.22);
  const ring = Math.min(0.9, Math.max(0.3, dur * 1.1));
  env(g, t, 0.003, 0.04 * (vol || 1), 0.01, ring);
  for (const det of [-6, 6]) { const o = mOsc('sawtooth', f, t); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + ring + 0.1); }
  lp.connect(g); sends(g, 1, 0.45, 0.55);
}

/** A hand clap: three quick bursts of band-passed noise and a short tail. */
function mClap(t, v) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 1.1;
  g.gain.setValueAtTime(0.0001, t);
  for (const k of [0, 0.011, 0.022]) { g.gain.setValueAtTime(0.15 * v, t + k); g.gain.exponentialRampToValueAtTime(0.02, t + k + 0.009); }
  g.gain.setValueAtTime(0.11 * v, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.21);
  src.connect(bp).connect(g); sends(g, 1, 0.4, 0);
  src.start(t, Math.random()); src.stop(t + 0.26);
}

/** A drone of saws on a note, its fifth and octave, its filter opening over the first bars of the theme (up to `top` Hz); `vol` scales it. */
function mDrone(t, n, dur, bar, vol = 1, top = 2000) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.Q.value = 6;
  const open = 200 + Math.min(top - 200, bar * 160);
  lp.frequency.setValueAtTime(open * 0.6, t); lp.frequency.linearRampToValueAtTime(open, t + dur);
  env(g, t, 0.05, 0.08 * vol, dur - 0.05, 0.2);
  for (const m of [n, n + 7, n + 12]) { const o = mOsc('sawtooth', midiHz(m), t); o.connect(lp); o.start(t); o.stop(t + dur + 0.3); }
  lp.connect(g); sends(g, 1, 0.3, 0);
}

/**
 * Night Murmurs' choir: noise through a narrow band-pass on each chord note (an octave down and as written), swelling
 * in and out over the chord like many low voices under the ground, the filters wandering a little sharp and flat.
 * `vol` scales it (the campaign theme's choir grows with the story); `far` (0..1) moves it off into the reverb and echo;
 * `high` adds the voices an octave up.
 */
function mWhisper(t, notes, dur, vol = 1, far = 0, high = false) {
  const ac = AUDIO.ctx, g = ac.createGain();
  env(g, t, dur * 0.45, 1, dur * 0.55, dur * 0.5);
  for (const n of notes) for (const oct of high ? [-12, 0, 12] : [-12, 0]) {
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), vg = ac.createGain(), f = midiHz(n + oct);
    src.buffer = AUDIO.noise; src.loop = true;
    bp.type = 'bandpass'; bp.Q.value = 28;
    bp.frequency.setValueAtTime(f * 0.985, t); bp.frequency.linearRampToValueAtTime(f * 1.015, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(f, t + dur);
    vg.gain.value = oct < 0 ? 0.55 : oct ? 0.22 : 0.32;
    src.connect(bp).connect(vg).connect(g);
    src.start(t, Math.random() * 1.5); src.stop(t + dur * 1.6);
  }
  sends(g, 0.9 * vol * (1 - 0.75 * far), 0.8 * vol * (1 + 0.4 * far), 0.15 * vol * (1 + 2 * far));
}

/** The hard kick (Redline, the campaign theme's climax): a higher, quicker pitch drop than mKick's, driven into the soft clipper, with the beater's click; `lvl` is its level after the clipper (a mood's `kick`). It pumps the pads too. */
function mKickHard(t, v, lvl = 0.22) {
  const ac = AUDIO.ctx, o = mOsc('sine', 210, t), g = ac.createGain(), ws = ac.createWaveShaper(), out = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(105, t + 0.03); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  env(g, t, 0.002, 1.2 * v, 0.04, 0.24);
  ws.curve = AUDIO.boomCurve; out.gain.value = lvl;
  o.connect(g).connect(ws).connect(out); sends(out, 1, 0, 0);
  o.start(t); o.stop(t + 0.36);
  const src = ac.createBufferSource(), hp = ac.createBiquadFilter(), cg = ac.createGain();
  src.buffer = AUDIO.noise; hp.type = 'highpass'; hp.frequency.value = 3000;
  env(cg, t, 0.001, 0.07 * v, 0.003, 0.02);
  src.connect(hp).connect(cg); sends(cg, 1, 0, 0);
  src.start(t, Math.random()); src.stop(t + 0.05);
  const pg = AUDIO.mPad.gain;
  pg.cancelScheduledValues(t); pg.setValueAtTime(0.4, t); pg.linearRampToValueAtTime(1, t + MUSIC.stepDur * 3);
}

/**
 * The campaign theme's lead at its climax, menacing: two detuned saws and a square an octave down through a low-pass that bites open and
 * settles, gliding up or down from the last note, a slow vibrato coming in late.
 */
function mSaw(t, n, dur, vol) {
  const ac = AUDIO.ctx, f = midiHz(n), lp = ac.createBiquadFilter(), g = ac.createGain(), lfo = mOsc('sine', 5.2, t), lg = ac.createGain();
  const from = MUSIC.sawHz || f, len = Math.max(0.2, dur);
  MUSIC.sawHz = f;
  lp.type = 'lowpass'; lp.Q.value = 2.5;
  lp.frequency.setValueAtTime(900, t); lp.frequency.exponentialRampToValueAtTime(2800, t + 0.06); lp.frequency.exponentialRampToValueAtTime(1300, t + 0.45);
  env(g, t, 0.01, 0.034 * (vol || 1), len * 0.8, 0.28);
  lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + Math.min(0.18, len * 0.5)); lg.gain.linearRampToValueAtTime(16, t + Math.min(0.6, len)); // (cents)
  lfo.connect(lg);
  for (const [type, mul, det, lvl] of [['sawtooth', 1, -8, 1], ['sawtooth', 1, 8, 1], ['square', 0.5, 0, 0.45]]) {
    const o = mOsc(type, from * mul, t), og = ac.createGain();
    o.frequency.exponentialRampToValueAtTime(f * mul, t + 0.07);
    o.detune.value = det; lg.connect(o.detune);
    og.gain.value = lvl; o.connect(og).connect(lp);
    o.start(t); o.stop(t + len + 0.35);
  }
  lfo.start(t); lfo.stop(t + len + 0.35);
  lp.connect(g); sends(g, 1, 0.35, 0.3);
}

/**
 * Redline's bass, the buzzy bass (mBass) lower and dirtier: two saws on the note (an octave under where mBass plays)
 * and a third an octave up for the edge, driven hard into the clipper (boomCurve), then through a resonant low-pass at
 * `cut`, so the filter shapes the distortion itself (each note only chugs a little open, it doesn't bounce), with a clean
 * sine on the note; all of it through a high-pass at 45 Hz (the note is heard from its harmonics, and the rumble under
 * them would only eat headroom). Played dry.
 */
function mGrind(t, n, dur, cut, v) {
  const ac = AUDIO.ctx, f = midiHz(n), pre = ac.createGain(), ws = ac.createWaveShaper(), lp = ac.createBiquadFilter(), hp = ac.createBiquadFilter(), g = ac.createGain(), sg = ac.createGain();
  const oscs = [];
  for (const [mul, det, lvl] of [[1, -7, 0.4], [1, 7, 0.4], [2, 0, 0.55]]) {
    const o = mOsc('sawtooth', f * mul, t), og = ac.createGain();
    o.detune.value = det; og.gain.value = lvl; o.connect(og).connect(pre); oscs.push(o);
  }
  pre.gain.value = 1.6;
  ws.curve = AUDIO.boomCurve; ws.oversample = '2x';
  lp.type = 'lowpass'; lp.Q.value = 4.5;
  lp.frequency.setValueAtTime(cut * 1.5, t); lp.frequency.exponentialRampToValueAtTime(cut, t + 0.09);
  hp.type = 'highpass'; hp.frequency.value = 45; hp.Q.value = 0.7;
  pre.connect(ws).connect(lp).connect(hp).connect(g);
  const sub = mOsc('sine', f, t); oscs.push(sub);
  sg.gain.value = 0.3; sub.connect(sg).connect(hp);
  env(g, t, 0.004, 0.14 * v, dur * 0.85, 0.06);
  sends(g, 1, 0, 0);
  for (const o of oscs) { o.start(t); o.stop(t + dur + 0.1); }
}

/** Redline's snare: dry and punchy (band-passed noise and a short tone, barely any room), with an industrial clank on it: a few square waves at clashing pitches, ringing briefly like struck plate. */
function mClank(t, v) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 0.7;
  env(g, t, 0.002, 0.2 * v, 0.01, 0.1);
  src.connect(bp).connect(g); sends(g, 1, 0.08, 0);
  src.start(t, Math.random()); src.stop(t + 0.15);
  const o = mOsc('triangle', 185, t), og = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(135, t + 0.05);
  env(og, t, 0.002, 0.12 * v, 0.01, 0.07);
  o.connect(og); sends(og, 1, 0, 0);
  o.start(t); o.stop(t + 0.12);
  const mg = ac.createGain(), mb = ac.createBiquadFilter();
  mb.type = 'bandpass'; mb.frequency.value = 3100; mb.Q.value = 1.2;
  env(mg, t, 0.001, 0.05 * v, 0.004, 0.16);
  for (const fq of [313, 457, 682, 1031]) { const m = mOsc('square', fq, t); m.connect(mb); m.start(t); m.stop(t + 0.2); }
  mb.connect(mg); sends(mg, 1, 0.15, 0);
}

/**
 * Redline's brass: a low swell under the chord (its root an octave down, then the chord), saws opening slowly as it
 * swells and closing as it fades, with a minor second over the root of the key's own chord. Not pumped by the kick.
 */
function mBrass(t, croot, chord, dur) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.Q.value = 1.5;
  lp.frequency.setValueAtTime(220, t); lp.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.7); lp.frequency.exponentialRampToValueAtTime(500, t + dur + 0.4);
  env(g, t, dur * 0.45, 1, dur * 0.85, 0.5);
  const notes = [MUSIC.key - 12 + croot, ...chord.map((n) => MUSIC.key + n)];
  if (croot === 0) notes.push(MUSIC.key + 13);
  for (const n of notes) for (const det of [-9, 9]) {
    const o = mOsc('sawtooth', midiHz(n), t), og = ac.createGain();
    o.detune.value = det; og.gain.value = n === MUSIC.key + 13 ? 0.01 : 0.02;
    o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.6);
  }
  lp.connect(g); sends(g, 0.8, 0.5, 0);
}

/** Redline's stab: the chord and a minor second over its root, a cold hit that shuts fast and rings on in the reverb. */
function mStabD(t, chord, croot) {
  const ac = AUDIO.ctx, lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(380, t + 0.25);
  env(g, t, 0.003, 1, 0.03, 0.28);
  for (const n of [...chord, croot + 1]) for (const det of [-6, 6]) {
    const o = mOsc('sawtooth', midiHz(MUSIC.key + 12 + n), t), og = ac.createGain();
    o.detune.value = det; og.gain.value = 0.016; o.connect(og).connect(lp); o.start(t); o.stop(t + 0.4);
  }
  lp.connect(g); sends(g, 1, 0.55, 0.25);
}

/** Redline's lead, cold and low: a square and a saw, a fixed filter, no vibrato and no glide, long notes into the echo. */
function mCold(t, n, dur) {
  const ac = AUDIO.ctx, f = midiHz(n), lp = ac.createBiquadFilter(), g = ac.createGain();
  lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.7;
  env(g, t, 0.05, 0.032, dur * 0.9, 0.35);
  for (const [type, det] of [['square', 0], ['sawtooth', 3]]) { const o = mOsc(type, f, t); o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + dur + 0.45); }
  lp.connect(g); sends(g, 0.9, 0.45, 0.35);
}

/** Redline's impact on a new section: a deep boom falling away, and a burst of dark noise into the reverb. */
function mImpact(t) {
  const ac = AUDIO.ctx, o = mOsc('sine', 90, t), g = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(30, t + 0.7);
  env(g, t, 0.003, 0.3, 0.05, 0.9);
  o.connect(g); sends(g, 1, 0.4, 0);
  o.start(t); o.stop(t + 1.1);
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), ng = ac.createGain();
  src.buffer = AUDIO.noise; src.loop = true; lp.type = 'lowpass'; lp.frequency.value = 600;
  env(ng, t, 0.002, 0.12, 0.02, 0.6);
  src.connect(lp).connect(ng); sends(ng, 1, 0.5, 0);
  src.start(t, Math.random()); src.stop(t + 0.8);
}

/** A noise riser over the bar before a new section: band-passed noise sweeping up and swelling, cut on the downbeat. */
function mRiser(t, dur) {
  const ac = AUDIO.ctx, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = AUDIO.noise; src.loop = true;
  bp.type = 'bandpass'; bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(350, t); bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.055, t + dur * 0.97); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  src.connect(bp).connect(g); sends(g, 1, 0.45, 0.2);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

/**
 * The campaign theme's halo: the chord an octave and two up in soft triangles spread across the stereo field, swelling
 * in slowly and left in the reverb (the Ring in the sky).
 */
function mHalo(t, notes, dur) {
  const ac = AUDIO.ctx, g = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3200;
  env(g, t, dur * 0.4, 1, dur * 0.7, dur * 0.6);
  notes.forEach((n, i) => {
    for (const oct of [12, 24]) {
      const o = mOsc('triangle', midiHz(n + oct), t), og = ac.createGain();
      o.detune.value = i % 2 ? 5 : -5;
      og.gain.value = oct === 12 ? 0.018 : 0.011;
      o.connect(og);
      if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = ((i + (oct === 24 ? 0.5 : 0)) / notes.length) * 1.6 - 0.8; og.connect(p).connect(lp); } else og.connect(lp);
      o.start(t); o.stop(t + dur * 1.3 + 0.1);
    }
  });
  lp.connect(g); sends(g, 0.6, 0.9, 0.25);
}

/** The Uplink's call in the campaign theme: a high, clean blip, out into the echo. Transmitting. */
function mBeacon(t, n) {
  const ac = AUDIO.ctx, f = midiHz(n), g = ac.createGain(), o = mOsc('sine', f, t), o2 = mOsc('square', f, t), g2 = ac.createGain(), lp = ac.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 3000; g2.gain.value = 0.15;
  env(g, t, 0.003, 0.03, 0.05, 0.09);
  o.connect(g); o2.connect(g2).connect(lp).connect(g);
  sends(g, 0.8, 0.4, 0.6);
  for (const x of [o, o2]) { x.start(t); x.stop(t + 0.2); }
}

/** The ground answering the Uplink in its own rhythm (LORE.md: the Murmur answer): a low knock and a breath of noise from under the ground. */
function mThud(t, v) {
  const ac = AUDIO.ctx, o = mOsc('sine', 88, t), g = ac.createGain();
  o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
  env(g, t, 0.006, 0.2 * v, 0.02, 0.28);
  o.connect(g); sends(g, 1, 0.35, 0);
  o.start(t); o.stop(t + 0.4);
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), ng = ac.createGain();
  src.buffer = AUDIO.noise; bp.type = 'bandpass'; bp.frequency.value = 220; bp.Q.value = 3;
  env(ng, t, 0.01, 0.09 * v, 0.03, 0.22);
  src.connect(bp).connect(ng); sends(ng, 1, 0.5, 0.2);
  src.start(t, Math.random()); src.stop(t + 0.35);
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
