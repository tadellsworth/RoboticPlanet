'use strict';
/*
 * Terrafall — a small QR code maker, for the cloud save's link (js/cloud.js). Written for the game (no outside code,
 * nothing fetched: it works offline). It makes the QR codes a phone's camera reads (ISO/IEC 18004, Model 2): byte mode
 * (the text as UTF-8), error correction level M (a code still reads with about 15% of it lost), the smallest version
 * (size) the text fits, and of the eight masks the one with the lowest penalty, as the standard scores them.
 *
 *   qrMatrix(text[, mask]) → { size, dark: Uint8Array of size × size (row by row, 1 = dark), version, mask }
 *   qrSvg(text)            → an SVG picture of it: black on white, with the 4-module quiet zone round it
 */

/** Level M, versions 1 to 40 (index 0 unused): error correction codewords per block, and blocks. */
const QR_ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
const QR_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

/** The eight masks: a module (x across, y down) is flipped where the mask is true. */
const QR_MASKS = [
  (x, y) => (x + y) % 2 === 0,
  (x, y) => y % 2 === 0,
  (x, y) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Modules left for data (and error correction) in version v, once the fixed patterns are drawn. */
function qrRawModules(v) {
  let n = (16 * v + 128) * v + 64;
  if (v >= 2) {
    const a = Math.floor(v / 7) + 2;
    n -= (25 * a - 10) * a - 55;
    if (v >= 7) n -= 36;
  }
  return n;
}

function qrDataCodewords(v) { return Math.floor(qrRawModules(v) / 8) - QR_ECC_M[v] * QR_BLOCKS_M[v]; }

/** The alignment patterns' centres along each side (every pairing of them, less the three by the finders). */
function qrAlign(v) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
  return out;
}

/** Reed-Solomon over GF(2^8) (modulo 0x11D): a product, the generator for `deg` codewords, and a remainder. */
function qrMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function qrDivisor(deg) {
  const r = new Array(deg).fill(0);
  r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) { r[j] = qrMul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
    root = qrMul(root, 2);
  }
  return r;
}
function qrRemainder(data, div) {
  const r = new Array(div.length).fill(0);
  for (const b of data) {
    const f = b ^ r.shift();
    r.push(0);
    for (let i = 0; i < div.length; i++) r[i] ^= qrMul(div[i], f);
  }
  return r;
}

/** The text's codewords for version v: its data (byte mode, the count, the bytes, padding), then the error correction. */
function qrCodewords(bytes, v) {
  const cap = qrDataCodewords(v) * 8, bits = [];
  const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4);
  put(bytes.length, v < 10 ? 8 : 16);
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // Split into blocks (the later ones a codeword longer), each with its own error correction, then interleaved.
  const nb = QR_BLOCKS_M[v], ecc = QR_ECC_M[v], raw = Math.floor(qrRawModules(v) / 8);
  const short = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = qrDivisor(ecc), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const d = data.slice(k, k + shortLen - ecc + (i < short ? 0 : 1));
    k += d.length;
    const e = qrRemainder(d, div);
    if (i < short) d.push(0); // (a gap, skipped below, so every block lines up)
    blocks.push(d.concat(e));
  }
  const out = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecc || j >= short) out.push(b[i]); });
  return out;
}

/** The standard's penalty for a finished grid (lower reads more easily): runs, 2×2 blocks, finder look-alikes, balance. */
function qrPenalty(dark, size) {
  let p = 0;
  const line = new Uint8Array(size);
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      for (let b = 0; b < size; b++) line[b] = pass ? dark[b * size + a] : dark[a * size + b];
      let run = 1;
      for (let b = 1; b <= size; b++) {
        if (b < size && line[b] === line[b - 1]) run++;
        else { if (run >= 5) p += run - 2; run = 1; }
      }
      const light = (s, e) => { for (let k = s; k < e; k++) if (k >= 0 && k < size && line[k]) return false; return true; };
      for (let b = 0; b + 7 <= size; b++) {
        if (line[b] && !line[b + 1] && line[b + 2] && line[b + 3] && line[b + 4] && !line[b + 5] && line[b + 6] && (light(b - 4, b) || light(b + 7, b + 11))) p += 40;
      }
    }
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = dark[y * size + x];
      if (c === dark[y * size + x + 1] && c === dark[(y + 1) * size + x] && c === dark[(y + 1) * size + x + 1]) p += 3;
    }
  }
  let n = 0;
  for (const d of dark) n += d;
  return p + Math.floor(Math.abs(n * 20 - size * size * 10) / (size * size)) * 10;
}

/** A QR code of `text`: its grid of modules. `mask` (0-7) picks the mask; left out, the best one is used. */
function qrMatrix(text, mask) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let v = 1;
  while (v <= 40 && 4 + (v < 10 ? 8 : 16) + bytes.length * 8 > qrDataCodewords(v) * 8) v++;
  if (v > 40) throw new Error('Too long for a QR code');
  const words = qrCodewords(bytes, v);
  const size = v * 4 + 17, dark = new Uint8Array(size * size), fixed = new Uint8Array(size * size);
  const set = (x, y, d) => { dark[y * size + x] = d ? 1 : 0; fixed[y * size + x] = 1; };
  // The fixed patterns: timing lines, the three finders (with their light borders), the alignment patterns.
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  }
  const al = qrAlign(v), last = al.length - 1;
  for (let i = 0; i <= last; i++) {
    for (let j = 0; j <= last; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  // The format (level M and the mask, twice over, with its own error correction) and, from version 7, the version.
  const format = (m) => {
    let r = m;
    for (let k = 0; k < 10; k++) r = (r << 1) ^ ((r >>> 9) * 0x537);
    const b = ((m << 10) | r) ^ 0x5412, bit = (k) => (b >>> k) & 1; // (level M's two bits are 00)
    for (let k = 0; k <= 5; k++) set(8, k, bit(k));
    set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
    for (let k = 9; k < 15; k++) set(14 - k, 8, bit(k));
    for (let k = 0; k < 8; k++) set(size - 1 - k, 8, bit(k));
    for (let k = 8; k < 15; k++) set(8, size - 15 + k, bit(k));
    set(8, size - 8, 1); // (the dark module)
  };
  format(0); // (keeps its place: drawn again once the mask is chosen)
  if (v >= 7) {
    let r = v;
    for (let k = 0; k < 12; k++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
    const b = (v << 12) | r;
    for (let k = 0; k < 18; k++) { const d = (b >>> k) & 1, a = size - 11 + (k % 3), c = Math.floor(k / 3); set(a, c, d); set(c, a, d); }
  }
  // The codewords, two columns at a time, zigzagging up and down from the bottom right (round the timing column).
  let n = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const up = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j, y = up ? size - 1 - vert : vert;
        if (!fixed[y * size + x] && n < words.length * 8) { dark[y * size + x] = (words[n >>> 3] >>> (7 - (n & 7))) & 1; n++; }
      }
    }
  }
  const flip = (m) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fixed[y * size + x] && QR_MASKS[m](x, y)) dark[y * size + x] ^= 1;
  };
  if (!(mask >= 0 && mask < 8)) {
    let low = Infinity;
    for (let m = 0; m < 8; m++) {
      flip(m); format(m);
      const p = qrPenalty(dark, size);
      if (p < low) { low = p; mask = m; }
      flip(m);
    }
  }
  flip(mask);
  format(mask);
  return { size, dark, version: v, mask };
}

/** A QR code of `text` as an SVG picture (black on white, quiet zone included): it scales to any size, crisply. */
function qrSvg(text) {
  const { size, dark } = qrMatrix(text), q = 4, n = size + q * 2;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!dark[y * size + x]) continue;
      let w = 1;
      while (x + w < size && dark[y * size + x + w]) w++;
      d += `M${x + q} ${y + q}h${w}v1h-${w}z`;
      x += w - 1;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" aria-hidden="true" focusable="false"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
