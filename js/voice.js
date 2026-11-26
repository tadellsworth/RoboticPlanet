'use strict';
/*
 * Terrafall — the machine voice: a few spoken lines in the Accord machine tongue, with subtitles (owner, Nov 2026).
 *
 * Not text-to-speech: a small formant synthesizer made in Web Audio, like everything else the game sounds. A buzzy
 * glottal pulse (and a square an octave under it, for weight) goes through four band-pass formant filters that glide
 * from vowel to vowel; consonants are bursts and hisses of noise and crisp clicks; then the machine in it: a metallic
 * comb, an amplitude ring and a touch of bit-crush, band-limited like a radio, into a dark reverb (a little of it: the owner's call, Nov 26 2026), over a low drone.
 * The words are an invented language (VOX_*): each English word of a line is given its machine word, made from a fixed
 * syllable inventory and seeded from the English word itself, so the same word always comes out the same (the Accord is
 * always "the Accord") and the same line always sounds the same. Only the subtitles say what it means.
 *
 * Two timbres from the same synthesizer (VOICE_PRESETS): 'cinematic', slow, deep and measured, for the opening and the
 * ending; 'droid', a clipped, nasal, flat radio voice, quicker, for short callouts.
 *
 * Who speaks (LORE.md): at the start of a game, the vanguard's Carrier in orbit, dropping the reserve Command Base; at the
 * end, your own Command core. Lines: VOICE_LINES. Where they play: voiceOpening (from showBriefing) and voiceEnding (from
 * overFlare), both in js/ui.js. Local display only, like all the sound: nothing here touches the game.
 *
 * Settings → Voice lines (on by default, kept on this device); the subtitles always show while it speaks. It plays on the
 * Effects volume; a tap on the subtitle skips it.
 */

const VOICE = { on: true, cur: null, lvl: 1.4 };
try { if (localStorage.getItem('botfall.voice') === '0') VOICE.on = false; } catch (e) { /* storage unavailable */ }
function setVoiceOn(on) {
  VOICE.on = !!on;
  try { localStorage.setItem('botfall.voice', on ? '1' : '0'); } catch (e) { /* storage unavailable */ }
  if (!on) voiceStop();
}

/*
 * The Accord machine tongue. Syllables are (onset)(vowel)(coda); a word gets one syllable for a short English word and
 * up to three for a long one, the first stressed. Weighted lists: an entry repeated is likelier.
 */
const VOX_ONSET = ['k', 'k', 't', 't', 'v', 'v', 'r', 's', 'm', 'n', 'd', 'kh', 'kh', 'z', 'sh', 'g', 'kr', 'tr', 'vr', 'sk', ''];
const VOX_VOWEL = ['a', 'a', 'a', 'o', 'o', 'o', 'u', 'u', 'e', 'e', 'i', 'y'];
const VOX_CODA = ['', '', '', '', '', 'k', 't', 'n', 'n', 'r', 's', 'm', 'ks'];

/** A 32-bit hash of a string (FNV-1a), and a small seeded generator from it (mulberry32): the same text, the same words. */
function voxHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function voxRng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** An English word's machine word: its syllables, each [onset, vowel, coda]. */
function voxWord(en) {
  const w = en.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!w) return [];
  const r = voxRng(voxHash('tongue:' + w)), pick = (L) => L[Math.floor(r() * L.length)];
  const n = /\d/.test(w) ? 2 : Math.max(1, Math.min(3, Math.round(w.length / 3)));
  const out = [];
  for (let k = 0; k < n; k++) {
    let on = pick(VOX_ONSET);
    if (k > 0 && !on) on = pick(['r', 'n', 'k', 't']); // (no two vowels running together inside a word)
    const co = k === n - 1 ? pick(VOX_CODA) : pick(['', '', '', 'n', 'r', 's']);
    out.push([on, pick(VOX_VOWEL), co]);
  }
  return out;
}

/**
 * A line as the machine says it: its words (each with its English, its machine word and its syllables) and the pauses
 * the punctuation asks for ('comma', 'stop' at a full stop, colon, or the end).
 */
function voxParse(text) {
  const words = [];
  for (const tok of text.split(/\s+/)) {
    if (!tok) continue;
    const syl = voxWord(tok);
    const brk = /[.:!?…]$/.test(tok) ? 'stop' : /[,;—–-]$/.test(tok) ? 'comma' : '';
    if (!syl.length) { if (brk && words.length) words[words.length - 1].brk = brk; continue; }
    words.push({ en: tok, syl, alien: syl.map((s) => s.join('')).join(''), brk });
  }
  if (words.length) words[words.length - 1].brk = 'stop';
  return words;
}

/** The two timbres (see the top of the file). Times in seconds, pitch in Hz, `fall` and `stress` in semitones. */
const VOICE_PRESETS = {
  cinematic: { f0: 64, vowel: 0.2, cons: 0.062, stressMul: 1.4, gap: 0.1, comma: 0.42, stop: 0.78, stress: 2, fall: 4, drift: -1.5, glide: 0.035, gate: 0.016,
    q: 1, fscale: 0.86, sub: 0.55, ring: 0.16, ringHz: 43, comb: 0.0095, combFb: 0.24, crush: 0.1, hp: 70, subBody: 0.3, droneLvl: 0.04, lp: 5200, nasal: 3, wet: 0.3, verb: 3.3, drone: true, lvl: 0.72 },
  droid: { f0: 96, vowel: 0.085, cons: 0.036, stressMul: 1.15, gap: 0.045, comma: 0.18, stop: 0.32, stress: 1, fall: 1, drift: 0, glide: 0.008, gate: 0.005,
    q: 1.7, fscale: 0.95, sub: 0.3, ring: 0.3, ringHz: 31, comb: 0.0042, combFb: 0.42, crush: 0.22, hp: 290, subBody: 0.2, droneLvl: 0, lp: 3400, nasal: 9, wet: 0.1, verb: 1.2, drone: false, lvl: 1.25, squelch: true },
};

/** Vowel formants (Hz, F1 to F4), and the voiced consonants' (the nasals and liquids). */
const VOX_FORMANTS = {
  a: [730, 1090, 2440, 3400], o: [570, 840, 2410, 3300], u: [320, 870, 2240, 3200], e: [530, 1840, 2480, 3500], i: [290, 2200, 3010, 3700], y: [500, 1450, 2500, 3400],
  m: [260, 1000, 2200, 3300], n: [260, 1650, 2600, 3400], r: [440, 1200, 1650, 3200], v: [320, 1150, 2250, 3300], z: [320, 1500, 2550, 3400], d: [350, 1650, 2600, 3400], g: [330, 1300, 2300, 3300],
};
/** Each consonant's noise: [band-pass Hz, Q, level, voiced share (0: none), a stop's click]. */
const VOX_NOISE = {
  k: [1900, 2.2, 0.55, 0, true], t: [4300, 1.2, 0.6, 0, true], d: [3200, 1.4, 0.3, 0.35, true], g: [1500, 2, 0.3, 0.35, true], p: [900, 1.2, 0.45, 0, true],
  s: [6200, 0.9, 0.42, 0], sh: [2700, 1.6, 0.42, 0], kh: [1450, 3, 0.4, 0], z: [5600, 0.9, 0.22, 0.4], v: [1700, 0.7, 0.14, 0.5],
};

/** One glottal pulse wave a context: the harmonics falling gently, all in phase, so it buzzes (a narrow pulse, nasal). */
const VOX_CACHE = typeof WeakMap === 'function' ? new WeakMap() : null;
function voxKit(ac) {
  let k = VOX_CACHE && VOX_CACHE.get(ac);
  if (k) return k;
  const N = 48, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
  for (let n = 1; n <= N; n++) re[n] = Math.pow(n, -0.75) * (n > 30 ? 0.6 : 1);
  const sr = ac.sampleRate, noise = ac.createBuffer(1, sr * 2, sr), nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const verb = (secs) => { // a long, dark tail: low-passed noise decaying, a little different in each ear, a short pre-delay
    const len = Math.floor(sr * secs), buf = ac.createBuffer(2, len, sr), pre = Math.floor(sr * 0.03);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      let e = 0;
      for (let i = pre; i < len; i++) { const t = (i - pre) / sr; lp += 0.06 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.exp(-t * (6.5 / secs)) * Math.min(1, t / 0.08); e += d[i] * d[i]; }
      const k = 1 / Math.sqrt(e || 1); // (its energy held to one, whatever its length: the wet level is then the level)
      for (let i = 0; i < len; i++) d[i] *= k;
    }
    return buf;
  };
  const crush = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; crush[i] = Math.round(x * 14) / 14; }
  const clip = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; clip[i] = Math.tanh(x * 1.8) / Math.tanh(1.8); }
  k = { wave: ac.createPeriodicWave(re, im, { disableNormalization: false }), noise, verbs: {}, verb, crush, clip };
  if (VOX_CACHE) VOX_CACHE.set(ac, k);
  return k;
}

/**
 * Say `text` in the machine tongue into `dest` (any node of context `ac`: the game's, or an OfflineAudioContext to
 * record it), starting at `t0`, in preset `pn`. Returns { dur (until the last syllable), tail (with the reverb), words
 * (each with its start time, from t0), out (the line's gain, to fade it), stop() }.
 */
function voiceRender(ac, dest, text, pn, t0) {
  const P = typeof pn === 'object' ? Object.assign({}, VOICE_PRESETS.cinematic, pn) : VOICE_PRESETS[pn] || VOICE_PRESETS.cinematic, K = voxKit(ac), words = voxParse(text);
  t0 = t0 == null ? ac.currentTime + 0.05 : t0;
  const nodes = [], mk = (n) => { nodes.push(n); return n; };
  const osc = (type, f) => { const o = mk(ac.createOscillator()); if (type === 'pulse') o.setPeriodicWave(K.wave); else o.type = type; o.frequency.value = f; return o; };
  const gain = (v) => { const g = mk(ac.createGain()); g.gain.value = v; return g; };
  const filt = (type, f, q) => { const b = mk(ac.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; return b; };

  // The source: the pulse and a saw on the pitch, a square an octave down (the sub), gated by the voicing.
  const out = gain(0), voiced = gain(0), sub = gain(P.sub), body = gain(1);
  const src1 = osc('pulse', P.f0), src2 = osc('sawtooth', P.f0), src3 = osc('square', P.f0 / 2);
  const g2 = gain(0.35);
  src1.connect(voiced); src2.connect(g2).connect(voiced); src3.connect(sub).connect(voiced);
  // The formants, in parallel (F1 loudest), Q sharper for the nasal radio voice.
  const F = [0, 1, 2, 3].map((i) => filt('bandpass', VOX_FORMANTS.a[i] * P.fscale, [7, 9, 12, 14][i] * P.q));
  const FG = [1, 0.8, 0.5, 0.25].map((v) => gain(v * 3.2));
  F.forEach((f, i) => voiced.connect(f).connect(FG[i]).connect(body));
  // The sub's weight under it all (the deep layer), straight past the formants.
  const subLp = filt('lowpass', 220, 0.7), subG = gain(0);
  src3.connect(subLp).connect(subG).connect(body);
  // The noise: one band-pass for every consonant, set per consonant, gated.
  const ns = mk(ac.createBufferSource()); ns.buffer = K.noise; ns.loop = true;
  const nf = filt('bandpass', 3000, 1), ng = gain(0);
  ns.connect(nf).connect(ng).connect(body);

  // The machine in it: a short metallic comb, an amplitude ring, a little crush, band-limited, a soft clip.
  const nasal = filt('peaking', 1250, 3); nasal.gain.value = P.nasal;
  const hp = filt('highpass', P.hp, 0.7), lp = filt('lowpass', P.lp, 0.8);
  body.connect(nasal).connect(hp).connect(lp);
  const comb = mk(ac.createDelay(0.05)); comb.delayTime.value = P.comb;
  const cfb = gain(P.combFb), cmix = gain(0.55);
  lp.connect(comb).connect(cfb).connect(comb); comb.connect(cmix);
  const ring = gain(1 - P.ring), rOsc = osc('sine', P.ringHz), rDepth = gain(P.ring);
  rOsc.connect(rDepth).connect(ring.gain);
  lp.connect(ring); cmix.connect(ring);
  const crush = mk(ac.createWaveShaper()); crush.curve = K.crush;
  const cw = gain(P.crush), dw = gain(1 - P.crush * 0.5), sum = gain(1);
  ring.connect(dw).connect(sum); ring.connect(crush).connect(cw).connect(sum);
  const clip = mk(ac.createWaveShaper()); clip.curve = K.clip;
  const pre = gain(0.9), lvl = gain(P.lvl * 0.5);
  sum.connect(pre).connect(clip).connect(lvl).connect(out);
  // The room: a long dark reverb (the cinematic voice speaks into a cathedral; the droid's is a short metal room).
  const vb = mk(ac.createConvolver()); vb.buffer = K.verbs[P.verb] || (K.verbs[P.verb] = K.verb(P.verb));
  const wet = gain(P.wet);
  lvl.connect(wet).connect(vb).connect(out);
  out.connect(dest);

  // Schedule the line: a segment at a time, the pitch, the formants, the voicing and the noise.
  const fT = (p, t, v, tau) => p.setTargetAtTime(v, t, tau);
  let t = t0 + (P.drone ? 1.1 : P.squelch ? 0.12 : 0.05);
  const start = t, wordAt = [];
  let nSyl = 0;
  const sylTotal = words.reduce((n, w) => n + w.syl.length, 0);
  const pitch = (semi, at) => { const f = P.f0 * Math.pow(2, semi / 12); fT(src1.frequency, at, f, P.glide); fT(src2.frequency, at, f, P.glide); fT(src3.frequency, at, f / 2, P.glide); };
  const shape = (ph, at, tau) => { const fm = VOX_FORMANTS[ph]; if (fm) F.forEach((f, i) => fT(f.frequency, at, fm[i] * P.fscale, tau)); };
  const voice = (v, at) => { fT(voiced.gain, at, v, P.gate); fT(subG.gain, at, v * P.subBody, P.gate * 2); };
  const hiss = (ph, at, len) => {
    const N = VOX_NOISE[ph];
    nf.frequency.setValueAtTime(N[0], at); nf.Q.setValueAtTime(N[1], at);
    if (N[4]) { // a stop: closure (silence), then a crisp click and a short burst
      ng.gain.setValueAtTime(0, at);
      ng.gain.setValueAtTime(N[2] * 1.6, at + len * 0.62); ng.gain.setTargetAtTime(0, at + len * 0.62 + 0.004, 0.012);
    } else { ng.gain.setTargetAtTime(N[2], at, 0.008); ng.gain.setTargetAtTime(0, at + len * 0.9, 0.01); }
  };
  words.forEach((w, wi) => {
    wordAt.push(t - t0);
    w.syl.forEach((s, si) => {
      const stressed = si === 0 && w.syl.length > 1, last = si === w.syl.length - 1 && w.brk === 'stop';
      const semi = (stressed ? P.stress : 0) + P.drift * (nSyl / Math.max(1, sylTotal - 1));
      nSyl++;
      // (the clusters, kr tr vr sk, said as their two sounds; kh and sh are one)
      const onset = s[0] === 'ks' ? ['k', 's'] : s[0].length === 2 && s[0] !== 'kh' && s[0] !== 'sh' ? [s[0][0], s[0][1]] : s[0] ? [s[0]] : [];
      const coda = s[2] === 'ks' ? ['k', 's'] : s[2] ? [s[2]] : [];
      const cons = (c) => {
        const len = P.cons * (VOX_NOISE[c] && !VOX_NOISE[c][4] ? 1.15 : c === 'r' ? 0.55 : 1);
        if (VOX_NOISE[c]) { hiss(c, t, len); voice(VOX_NOISE[c][3], t); if (VOX_FORMANTS[c]) shape(c, t, P.glide * 0.6); }
        else { voice(c === 'r' ? 0.45 : 0.6, t); shape(c, t, P.glide * 0.6); } // (m, n, r: voiced, the formants low)
        pitch(semi, t);
        t += len;
      };
      onset.forEach(cons);
      // The vowel: the formants glide in, voiced full; the last of a sentence falls.
      const vlen = P.vowel * (stressed ? P.stressMul : 1) * (last ? 1.35 : 1);
      shape(s[1], t, P.glide);
      voice(1, t);
      pitch(semi, t);
      if (last) { const f = P.f0 * Math.pow(2, (semi - P.fall) / 12); for (const o of [src1, src2]) o.frequency.setTargetAtTime(f, t + vlen * 0.25, vlen * 0.45); src3.frequency.setTargetAtTime(f / 2, t + vlen * 0.25, vlen * 0.45); }
      t += vlen;
      coda.forEach(cons);
    });
    // Between words a breath of silence; at a comma or a full stop, longer.
    voice(0, t);
    t += w.brk === 'stop' ? (wi === words.length - 1 ? 0 : P.stop) : w.brk === 'comma' ? P.comma : P.gap;
  });
  voice(0, t);
  ng.gain.setTargetAtTime(0, t, 0.01);
  const dur = t - t0, tail = dur + P.verb * 0.7 + (P.drone ? 2.6 : 0.3);
  // The line swells in and stays; the whole of it (the reverb's tail too) fades at the end.
  out.gain.setValueAtTime(0, t0); out.gain.linearRampToValueAtTime(1, t0 + 0.05);
  out.gain.setValueAtTime(1, t0 + tail - 0.4); out.gain.linearRampToValueAtTime(0, t0 + tail);
  for (const o of [src1, src2, src3, rOsc, ns]) { o.start(t0); o.stop(t0 + dur + 0.4); }
  // The bed under the cinematic voice: a low drone (D, its fifth) swelling in before it speaks and dying after, and a
  // deep boom as it opens. The droid's: a radio squelch, in and out.
  if (P.drone) {
    const dg = gain(0), dl = filt('lowpass', 150, 1.2);
    for (const [f, v, type] of [[36.7, 0.5, 'sawtooth'], [55, 0.3, 'sawtooth'], [36.7, 0.8, 'sine'], [73.4, 0.18, 'triangle']]) {
      const o = osc(type, f), og = gain(v); o.detune.value = type === 'sawtooth' ? (f > 40 ? 6 : -6) : 0; o.connect(og).connect(dl); o.start(t0); o.stop(t0 + tail);
    }
    dl.connect(dg).connect(out);
    const dvb = gain(0.3); dg.connect(dvb).connect(vb);
    dg.gain.setValueAtTime(0, t0); dg.gain.linearRampToValueAtTime(P.droneLvl, t0 + 1.2); dg.gain.setValueAtTime(P.droneLvl, t0 + dur); dg.gain.linearRampToValueAtTime(0, t0 + tail - 0.2);
    const boom = osc('sine', 62), bg = gain(0);
    boom.frequency.setValueAtTime(62, start - 0.35); boom.frequency.exponentialRampToValueAtTime(28, start + 1.2);
    bg.gain.setValueAtTime(0, start - 0.35); bg.gain.linearRampToValueAtTime(0.32, start - 0.3); bg.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
    boom.connect(bg).connect(out); bg.connect(dvb);
    boom.start(start - 0.35); boom.stop(start + 1.7);
  }
  if (P.squelch) {
    for (const [at, f1, f2] of [[t0, 1800, 2600], [t0 + dur + 0.05, 2600, 1400]]) {
      const o = osc('square', f1), og = gain(0), bp = filt('bandpass', 2400, 2);
      o.frequency.setValueAtTime(f1, at); o.frequency.linearRampToValueAtTime(f2, at + 0.06);
      og.gain.setValueAtTime(0, at); og.gain.linearRampToValueAtTime(0.05, at + 0.005); og.gain.linearRampToValueAtTime(0, at + 0.07);
      o.connect(bp).connect(og).connect(out); o.start(at); o.stop(at + 0.08);
      const n = mk(ac.createBufferSource()), nG = gain(0), nb = filt('bandpass', 3000, 0.8);
      n.buffer = K.noise; nG.gain.setValueAtTime(0, at); nG.gain.linearRampToValueAtTime(0.12, at + 0.004); nG.gain.linearRampToValueAtTime(0, at + 0.09);
      n.connect(nb).connect(nG).connect(out); n.start(at, Math.random()); n.stop(at + 0.1);
    }
  }
  const stop = (fade) => {
    const now = ac.currentTime;
    out.gain.cancelScheduledValues(now); out.gain.setValueAtTime(out.gain.value, now); out.gain.linearRampToValueAtTime(0, now + (fade || 0.15));
    setTimeout(() => { try { out.disconnect(); } catch (e) { /* gone */ } }, ((fade || 0.15) + 0.1) * 1000);
  };
  return { dur, tail, words: words.map((w, i) => ({ en: w.en, alien: w.alien, at: wordAt[i] })), out, stop };
}

/*
 * The lines (LORE.md's voice: machines, logs and protocol; short; Earth's fate never said). `who` is the speaker the
 * subtitle names. The opening is the Carrier in orbit, dropping the reserve Command Base; the ending, your Command core.
 */
const VOICE_LINES = {
  // Openings
  versus: { who: 'Carrier', text: 'Terrafall confirmed. Rival landing detected. The Accord is void.' },
  many: { who: 'Carrier', text: 'Terrafall confirmed. Rival landings detected. Secure the region for the Sponsor.' },
  teams: { who: 'Carrier', text: 'Reserve lander away. Allied lander beside you. Two callsigns, one front.' },
  colony: { who: 'Carrier', text: 'Reserve lander away. No rival in range. Prepare the land for Arrival.' },
  argos: { who: 'Carrier', text: 'Terrafall on Argos. Silent ground. Hold it.' },
  hollow: { who: 'Carrier', text: 'Lander through the breach. No daylight below. The ground is listening.' },
  horde: { who: 'Carrier', text: 'Terrafall at the Maw. The ground is awake. Hold the line.' },
  mission: { who: 'Carrier', text: 'Training directive loaded. Command is yours.' },
  contingency: { who: 'Carrier', text: 'Contingency orders open. Reserve lander away. Take the territory.' },
  // Endings
  victory: { who: 'Command', text: 'Region secured. Report sent. No reply. Continuing current directive.' },
  defeat: { who: 'Command', text: 'Command core lost. Transferring authority. Hold position.' },
  held: { who: 'Command', text: 'The line held. The tunnels are quiet. Continuing current directive.' },
  overrun: { who: 'Command', text: 'Command core lost. The Murmur hold the region.' },
  complete: { who: 'Command', text: 'Directive complete. Awaiting further instructions.' },
  failed: { who: 'Command', text: 'Directive failed. Hold position.' },
  contWon: { who: 'Command', text: 'Territory secured. The Carrier is informed.' },
  contLost: { who: 'Command', text: 'Territory lost. Reserve landers remaining: fewer.' },
};
/** A droid-radio callout, for the in-game moments later on (the same synthesizer, the clipped voice). */
const VOICE_CALLOUTS = { ack: 'Directive acknowledged.', execute: 'Execute directives.' };

/** Whether a line may play now: on, the page in front, not under test automation (unless a test asks: BOTFALL_VOICE). */
function voiceAllowed() {
  if (!VOICE.on || typeof document === 'undefined' || document.hidden) return false;
  if (typeof navigator !== 'undefined' && navigator.webdriver && !window.BOTFALL_VOICE) return false;
  return !(typeof UI !== 'undefined' && UI.watch);
}

/**
 * Speak a line (a key of VOICE_LINES, or { who, text }) after `delay` seconds, with its subtitle; the music ducks under
 * it. opts: { preset ('cinematic' unless said), keep (true: it carries on off the game screen, as Contingency's ending
 * does on the globe), top (the subtitle at the top of the screen, clear of the end screen's buttons) }. A new line cuts off the one before.
 */
function voiceSay(key, delay, opts) {
  opts = opts || {};
  const line = typeof key === 'string' ? VOICE_LINES[key] : key;
  if (!line || !voiceAllowed()) return;
  voiceStop();
  const of = typeof S !== 'undefined' ? S : null, inGame = typeof UI !== 'undefined' && UI.inGame;
  const cur = VOICE.cur = { of, inGame, keep: !!opts.keep, top: !!opts.top, timers: [] };
  const go = () => {
    if (VOICE.cur !== cur) return;
    const ac = AUDIO.ctx, audible = ac && ac.state === 'running' && AUDIO.on && AUDIO.fx > 0 && AUDIO.master;
    let r = null;
    if (audible) {
      if (!VOICE.bus || VOICE.bus.context !== ac) { VOICE.bus = ac.createGain(); VOICE.bus.connect(AUDIO.master); }
      VOICE.bus.gain.setTargetAtTime(AUDIO.fx * VOICE.lvl, ac.currentTime, 0.02);
      r = voiceRender(ac, VOICE.bus, line.text, opts.preset || 'cinematic', ac.currentTime + 0.05);
      cur.r = r;
      // (the music down under it, back up as it ends)
      if (AUDIO.musicDuck) { const g = AUDIO.musicDuck.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(0.42, t, 0.25); g.setTargetAtTime(1, t + r.dur + 0.4, 0.9); }
    }
    // Without sound, the subtitle alone, timed as the voice would be.
    const words = r ? r.words : voxParse(line.text).map((w, i) => ({ en: w.en, alien: w.alien, at: 0.6 + i * 0.45 }));
    const dur = r ? r.dur : 0.6 + words.length * 0.45;
    voiceCaption(line, words, dur, cur);
  };
  cur.timers.push(setTimeout(go, Math.max(0, (delay || 0) * 1000)));
}

/** Cut the line short (a tap on its subtitle, a new game, Voice lines off): the voice fades, the subtitle goes. */
function voiceStop() {
  const cur = VOICE.cur;
  if (!cur) return;
  VOICE.cur = null;
  for (const id of cur.timers) clearTimeout(id);
  if (cur.r) cur.r.stop(0.25);
  if (AUDIO.musicDuck && AUDIO.ctx) { const g = AUDIO.musicDuck.gain, t = AUDIO.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(1, t, 0.4); }
  const el = typeof document !== 'undefined' && document.getElementById('voice-sub');
  if (el) { el.classList.remove('on'); setTimeout(() => { if (!VOICE.cur) el.hidden = true; }, 450); }
}

/**
 * The subtitle: who speaks, the machine words (lighting up as each is said) and the English under them, fading in with
 * the voice and out a moment after it. It goes if the game it belongs to does (unless `keep`).
 */
function voiceCaption(line, words, dur, cur) {
  const el = document.getElementById('voice-sub');
  if (!el) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  el.innerHTML = `<span class="vs-who">${esc(line.who === 'Carrier' ? 'Carrier · orbit' : 'Command core')}</span>`
    + `<span class="vs-alien" aria-hidden="true">${words.map((w) => `<i>${esc(w.alien)}</i>`).join(' ')}</span>`
    + `<span class="vs-en">${esc(line.text)}</span>`;
  el.classList.toggle('top', cur.top);
  el.hidden = false;
  void el.offsetWidth; // (so the fade runs)
  el.classList.add('on');
  const spans = el.querySelectorAll('.vs-alien i');
  words.forEach((w, i) => cur.timers.push(setTimeout(() => { if (VOICE.cur === cur && spans[i]) spans[i].classList.add('said'); }, w.at * 1000)));
  cur.timers.push(setTimeout(() => { if (VOICE.cur === cur) voiceStop(); }, (dur + 1.8) * 1000));
  // (gone with its game: quit to the menu, or another game started)
  const watch = () => {
    if (VOICE.cur !== cur) return;
    const now = typeof S !== 'undefined' ? S : null, inGame = typeof UI !== 'undefined' && UI.inGame;
    if (!cur.keep && cur.inGame && (!inGame || now !== cur.of)) { voiceStop(); return; }
    cur.timers.push(setTimeout(watch, 250));
  };
  watch();
}

/** The opening line for the game just started (the Carrier, dropping the lander), from showBriefing in js/ui.js. */
function voiceOpening() {
  if (typeof S === 'undefined' || !S || S.watch) return;
  const biome = S.settings && S.settings.biome, B = typeof BIOMES !== 'undefined' && BIOMES[biome];
  const key = S.contingency ? 'contingency' : S.mission ? 'mission' : S.horde ? 'horde' : S.hollow ? 'hollow' : B && B.silent ? 'argos'
    : S.mode === 'colony' ? 'colony' : S.teams ? 'teams' : typeof nColonies === 'function' && nColonies() > 2 ? 'many' : 'versus';
  voiceSay(key, 0.9);
}

/** The closing line, from overFlare in js/ui.js as the word comes in: tone 'win' or 'loss'; `word` is the word shown. */
function voiceEnding(tone, word, story) {
  if (tone !== 'win' && tone !== 'loss') return;
  const won = tone === 'win';
  const key = story ? (won ? 'contWon' : 'contLost') : word === 'Complete' ? 'complete' : word === 'Failed' ? 'failed'
    : word === 'Held' ? 'held' : word === 'Overrun' ? 'overrun' : won ? 'victory' : 'defeat';
  voiceSay(key, won ? 2.4 : 2.8, { keep: !!story, top: true });
}
