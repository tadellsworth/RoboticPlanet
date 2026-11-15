'use strict';
/*
 * Terrafall — shared helpers: seeded RNG, value noise, a binary heap, small math utils.
 * Every script in js/ is a plain (non-module) script that shares the global scope,
 * so the game runs from file://, any static host, or bundled into one HTML file.
 */

/** Deterministic PRNG (mulberry32). Returns a function producing floats in [0, 1). */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/*
 * Exact math for the game itself (sim, AI, world). Math.sin, cos, atan2, hypot, exp and pow are only approximated by
 * the language, and Chrome, Safari and Firefox can differ in the last bit; in a multiplayer game every device runs
 * the same simulation, so one bit is enough to drift two games apart. These follow fdlibm (the reference C math
 * library) using only + - * / and Math.sqrt / Math.round, which every engine must compute exactly alike, so they give
 * the same answer everywhere. (Drawing, sound and the menus may use Math.* freely.)
 */
const _PIO2_HI = 1.57079632673412561417e+00, _PIO2_LO = 6.07710050650619224932e-11;
const _S1 = -1.66666666666666324348e-01, _S2 = 8.33333333332248946124e-03, _S3 = -1.98412698298579493134e-04,
  _S4 = 2.75573137070700676789e-06, _S5 = -2.50507602534068634195e-08, _S6 = 1.58969099521155010221e-10;
const _C1 = 4.16666666666666019037e-02, _C2 = -1.38888888888741095749e-03, _C3 = 2.48015872894767294178e-05,
  _C4 = -2.75573143513906633035e-07, _C5 = 2.08757232129817482790e-09, _C6 = -1.13596475577881948265e-11;
function _ksin(x) { const z = x * x, v = z * x; return x + v * (_S1 + z * (_S2 + z * (_S3 + z * (_S4 + z * (_S5 + z * _S6))))); }
function _kcos(x) { const z = x * x; return 1 - 0.5 * z + z * z * (_C1 + z * (_C2 + z * (_C3 + z * (_C4 + z * (_C5 + z * _C6))))); }
/** Reduce x to r in [-pi/4, pi/4] and its quadrant q (0..3). */
function _reduce(x) { const k = Math.round(x * 0.6366197723675814); const r = (x - k * _PIO2_HI) - k * _PIO2_LO; return [r, ((k % 4) + 4) % 4]; }
function dsin(x) {
  if (!(x > -Infinity && x < Infinity)) return NaN;
  const [r, q] = _reduce(x);
  return q === 0 ? _ksin(r) : q === 1 ? _kcos(r) : q === 2 ? -_ksin(r) : -_kcos(r);
}
function dcos(x) {
  if (!(x > -Infinity && x < Infinity)) return NaN;
  const [r, q] = _reduce(x);
  return q === 0 ? _kcos(r) : q === 1 ? -_ksin(r) : q === 2 ? -_kcos(r) : _ksin(r);
}
const _ATANHI = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const _ATANLO = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const _AT = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01,
  9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02,
  4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02];
function datan(x) {
  if (x !== x) return NaN;
  const neg = x < 0;
  let a = neg ? -x : x, id = -1;
  if (a >= 7.378697629483821e19) return neg ? -1.5707963267948966 : 1.5707963267948966;
  if (a < 0.4375) { if (a < 7.450580596923828e-9) return x; }
  else if (a < 1.1875) { if (a < 0.6875) { id = 0; a = (2 * a - 1) / (2 + a); } else { id = 1; a = (a - 1) / (a + 1); } }
  else if (a < 2.4375) { id = 2; a = (a - 1.5) / (1 + 1.5 * a); }
  else { id = 3; a = -1 / a; }
  const z = a * a, w = z * z;
  const s1 = z * (_AT[0] + w * (_AT[2] + w * (_AT[4] + w * (_AT[6] + w * (_AT[8] + w * _AT[10])))));
  const s2 = w * (_AT[1] + w * (_AT[3] + w * (_AT[5] + w * (_AT[7] + w * _AT[9]))));
  if (id < 0) { const r = a - a * (s1 + s2); return neg ? -r : r; }
  const r = _ATANHI[id] - ((a * (s1 + s2) - _ATANLO[id]) - a);
  return neg ? -r : r;
}
/** atan2(y, x), as Math.atan2 (atan2(0, 0) is 0). */
function datan2(y, x) {
  if (x !== x || y !== y) return NaN;
  if (x === 0) return y > 0 ? 1.5707963267948966 : y < 0 ? -1.5707963267948966 : 0;
  const z = datan((y < 0 ? -y : y) / (x < 0 ? -x : x)); // in [0, pi/2]
  if (x > 0) return y < 0 ? -z : z;
  const t = 3.141592653589793 - (z - 1.2246467991473532e-16);
  return y < 0 ? -t : t;
}
/** The length of (x, y): Math.sqrt is exact everywhere, unlike Math.hypot. */
function dhypot(x, y) { return Math.sqrt(x * x + y * y); }
function sq(x) { return x * x; }

/** Stable hash of integer coordinates to a float in [0, 1). */
function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smoothstep01(t) { return t * t * (3 - 2 * t); }

/** 2D value noise in [0, 1). */
function valueNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const u = smoothstep01(x - xi), v = smoothstep01(y - yi);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Fractal (multi-octave) value noise in [0, 1). */
function fbm(x, y, seed, octaves) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < (octaves || 4); i++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + i * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Min-heap of integer ids keyed by float priority (used by A*). */
class MinHeap {
  constructor() { this.ids = []; this.pri = []; }
  get size() { return this.ids.length; }
  clear() { this.ids.length = 0; this.pri.length = 0; }
  push(id, p) {
    const ids = this.ids, pri = this.pri;
    let i = ids.length;
    ids.push(id); pri.push(p);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (pri[parent] <= p) break;
      ids[i] = ids[parent]; pri[i] = pri[parent];
      i = parent;
    }
    ids[i] = id; pri[i] = p;
  }
  pop() {
    const ids = this.ids, pri = this.pri;
    const top = ids[0];
    const lastId = ids.pop(), lastP = pri.pop();
    const n = ids.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && pri[c + 1] < pri[c]) c++;
        if (pri[c] >= lastP) break;
        ids[i] = ids[c]; pri[i] = pri[c];
        i = c;
      }
      ids[i] = lastId; pri[i] = lastP;
    }
    return top;
  }
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }

/** Add n to a count dictionary entry (removes the key when it drops to 0). */
function bump(obj, key, n) {
  const v = (obj[key] || 0) + n;
  if (v <= 0) delete obj[key]; else obj[key] = v;
}

function sumValues(obj) { let s = 0; for (const k in obj) s += obj[k]; return s; }

function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/** Mix two #rrggbb colours. */
function mixColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
}

/** Every tile on a 4-connected line between two tiles (used when painting paths by dragging). */
function tileLine(x0, y0, x1, y1) {
  const out = [[x0, y0]];
  const nx = Math.abs(x1 - x0), ny = Math.abs(y1 - y0);
  const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
  let x = x0, y = y0, ix = 0, iy = 0;
  while (ix < nx || iy < ny) {
    if ((0.5 + ix) / nx < (0.5 + iy) / ny) { x += sx; ix++; } else { y += sy; iy++; }
    out.push([x, y]);
  }
  return out;
}
