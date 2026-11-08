'use strict';
/*
 * Botfall — tiny synthesized sound effects (Web Audio, no audio files needed).
 */

const AUDIO = { ctx: null, on: true, last: {} };

function audioUnlock() {
  if (AUDIO.ctx) { if (AUDIO.ctx.state === 'suspended') AUDIO.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) AUDIO.ctx = new AC();
  } catch (e) { AUDIO.ctx = null; }
}

function _tone(freq, dur, type, vol, slideTo, delay) {
  const ac = AUDIO.ctx;
  const t0 = ac.currentTime + (delay || 0);
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.1, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function _noise(dur, vol, cutoff) {
  const ac = AUDIO.ctx;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff || 900;
  const g = ac.createGain();
  g.gain.value = vol || 0.2;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}

const SFX_GAP = { launch: 0.3, boom: 0.12, laser: 0.08, hit: 0.07, produce: 0.25, alert: 1.5, complete: 0.3 };

function sfx(name) {
  if (!AUDIO.on || AUDIO.suppress || !AUDIO.ctx || AUDIO.ctx.state !== 'running') return;
  const now = AUDIO.ctx.currentTime;
  if (now - (AUDIO.last[name] || -9) < (SFX_GAP[name] || 0.05)) return;
  AUDIO.last[name] = now;
  switch (name) {
    case 'click': _tone(720, 0.06, 'triangle', 0.06); break;
    case 'place': _tone(440, 0.08, 'triangle', 0.08); _tone(660, 0.1, 'triangle', 0.08, null, 0.07); break;
    case 'complete': _tone(523, 0.1, 'sine', 0.08); _tone(659, 0.1, 'sine', 0.08, null, 0.08); _tone(784, 0.16, 'sine', 0.08, null, 0.16); break;
    case 'produce': _tone(980, 0.05, 'sine', 0.035); break;
    case 'laser': _tone(1400, 0.14, 'sawtooth', 0.035, 300); break;
    case 'hit': _tone(220, 0.05, 'square', 0.03, 120); break;
    case 'boom': _noise(0.35, 0.18, 700); break;
    case 'alert': _tone(880, 0.12, 'square', 0.05); _tone(660, 0.12, 'square', 0.05, null, 0.15); break;
    case 'launch': _noise(0.6, 0.12, 2200); _tone(180, 0.6, 'sawtooth', 0.05, 520); break;
    case 'capture': _tone(392, 0.12, 'triangle', 0.09); _tone(587, 0.2, 'triangle', 0.09, null, 0.1); break;
    case 'error': _tone(200, 0.12, 'square', 0.05, 150); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => _tone(f, 0.25, 'triangle', 0.09, null, i * 0.14)); break;
    case 'lose': [392, 330, 262, 196].forEach((f, i) => _tone(f, 0.3, 'triangle', 0.09, null, i * 0.18)); break;
  }
}
