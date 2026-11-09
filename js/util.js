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
