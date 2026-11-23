'use strict';
/*
 * Terrafall: Contingency's globe, drawn (ART_GUIDE.md: The Contingency globe). The screens and what a tap does are
 * js/contingency-ui.js; this only draws Ithaca I as a planet seen from orbit, under them.
 *
 * Three layers in #screen-contingency: the stars (#cg-stars, drawn once a size), the planet (#cg-gl, a WebGL canvas just
 * round the globe: one fragment shader turns the surface picture into the sphere, with a soft terminator from the
 * upper-left light, the sea's glint, clouds, the haze at the limb and the halo of air round it) and, on top, the
 * screen's own canvas (#cg-globe, js/contingency-ui.js) with the territory borders (smooth lines from
 * js/contingency-globe.js), the owners' outlines, the markers, the arcs and Argos.
 *
 * The surface is art/globe/ithaca-2048.webp (colour with the relief baked in; alpha the land, for the glint), the clouds
 * art/globe/ithaca-clouds.webp, and on a big or sharp screen art/globe/ithaca-4096.webp once it comes; all made by
 * tools/atlas/globe_texture.py. In the one-file build they are bundles beside the page (globe.js, globe-hd.js). The
 * owners' tints are painted onto a small equirectangular picture of their own (cglTint) whenever the owners, the pick
 * or the move targets change, shared by both ways of drawing.
 *
 * Without WebGL (or when the picture can't be used, as on a page opened from a file) the globe is shaded per pixel into a
 * small image, as before (cgDraw2d), from the menu planet's face (art/lore/ithaca-map.webp, the same picture made small).
 * The planet is only drawn again when the view, its size or the tints change.
 */

const CGL = {
  art: { sd: 'art/globe/ithaca-2048.webp', hd: 'art/globe/ithaca-4096.webp', clouds: 'art/globe/ithaca-clouds.webp' },
  hdAt: 1100,        // device px across the globe from which the 4096 picture is fetched (if the GPU takes it)
  maxDpr: 2,         // the planet's canvas at most this many pixels a css px
  maxPx: 3072,       // ...and at most this many across
  moveDpr: 1,        // ...and at most this many while it turns (drawn sharp again once it stops)
  light: [-0.44, 0.48, 0.76], // towards the light (x right, y up, z out of the screen)
  cloudShift: 0.45,  // the clouds turned this much of the way round from the picture's own place
  stars: 1 / 500,    // stars a square css px
  tint: { fill: 0.13, edge: [[9, 0.05], [6, 0.05], [3.5, 0.06], [1.5, 0.07]] }, // an owner's tint, and its strokes in from the edge (texels, alpha)
};
const CGS = { gl: null, failed: false, tex: {}, hd: '', loaded: '', key: '', rings: null, borders: null, tint: null, tintKey: '', tintData: null, tintN: 0, moon: null, bundles: {} };

/* ------------------------------------------------------------------ the outlines (js/contingency-globe.js) */

/** Decode CONT_RINGS and CONT_BORDERS once: each line as unit vectors (xyz), and the rings' unwrapped lon/lat too. */
function cglShapes() {
  if (CGS.rings) return;
  const Q = 50, dec = (a, o) => {
    const lon = [], lat = [];
    let x = a[o] / Q, y = a[o + 1] / Q;
    lon.push(x); lat.push(y);
    for (let i = o + 2; i < a.length; i += 2) { x += a[i] / Q; y += a[i + 1] / Q; lon.push(x); lat.push(y); }
    const n = lon.length, xyz = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const lo = lon[i] * Math.PI / 180, la = lat[i] * Math.PI / 180;
      xyz[i * 3] = Math.cos(la) * Math.cos(lo); xyz[i * 3 + 1] = Math.cos(la) * Math.sin(lo); xyz[i * 3 + 2] = Math.sin(la);
    }
    // a ring that goes all the way round (a cap's) is closed through its pole
    const pole = Math.abs(lon[n - 1] - lon[0]) > 300 ? Math.sign(lat[0]) : 0;
    return { lon, lat, xyz, pole };
  };
  CGS.rings = (typeof CONT_RINGS === 'undefined' ? [] : CONT_RINGS).map((rs) => rs.map((r) => dec(r, 0)));
  CGS.borders = (typeof CONT_BORDERS === 'undefined' ? [] : CONT_BORDERS).map((b) => Object.assign(dec(b, 1), { kind: b[0] }));
}

/** The territory whose outline holds (lon, lat), or -1 (the sea). */
function cglPick(lon, lat) {
  cglShapes();
  const inside = (r, x, y) => {
    const X = r.lon, Y = r.lat, n = X.length;
    let c = false;
    const pts = r.pole ? n + 2 : n, px = (i) => (i < n ? X[i] : i === n ? X[n - 1] : X[0]), py = (i) => (i < n ? Y[i] : 90 * r.pole);
    for (let i = 0, j = pts - 1; i < pts; j = i++) {
      const xi = px(i), yi = py(i), xj = px(j), yj = py(j);
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let t = 0; t < CGS.rings.length; t++) for (const r of CGS.rings[t]) for (const m of [0, -360, 360]) if (inside(r, lon + m, lat)) return t;
  return -1;
}

/** Add line P (unit vectors) to g's path as it shows on the globe now, broken where it nears the limb (z < Z0) and goes round the back. */
function cglPath(g, P, closed) {
  const Z0 = 0.06, V = CG.v, cy = Math.cos(CG.yaw), sy = Math.sin(CG.yaw), cp = Math.cos(CG.pitch), sp = Math.sin(CG.pitch), n = P.length / 3, m = closed ? n + 1 : n;
  let px = 0, py = 0, pz = -1;
  for (let k = 0; k < m; k++) {
    const i = (k % n) * 3, X = P[i + 1] * cy - P[i] * sy, Zw = P[i] * cy + P[i + 1] * sy, Y = P[i + 2];
    const y = Y * cp - Zw * sp, z = Y * sp + Zw * cp - Z0, vis = z >= 0, sx = V.cx + X * V.r, sY = V.cy - y * V.r;
    if (k > 0 && vis !== pz >= 0) {
      const f = pz / (pz - z), ex = V.cx + (px + (X - px) * f) * V.r, ey = V.cy - (py + (y - py) * f) * V.r;
      if (vis) { g.moveTo(ex, ey); g.lineTo(sx, sY); } else g.lineTo(ex, ey);
    } else if (vis) { if (k === 0) g.moveTo(sx, sY); else g.lineTo(sx, sY); }
    px = X; py = y; pz = z;
  }
}

/** The borders on land, the owners' outlines, and the picked territory's and the move targets' (over the planet). */
function cglLines(g, run, targets) {
  cglShapes();
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round';
  // the borders everyone shares: thin and pale, a little stronger where two regions meet
  for (const [kind, w, a] of [[0, 1, 0.38], [2, 1.3, 0.4], [1, 1.7, 0.55]]) {
    g.beginPath();
    for (const b of CGS.borders) if (b.kind === kind) cglPath(g, b.xyz, false);
    g.lineWidth = w; g.strokeStyle = `rgba(248,240,224,${a})`; g.stroke();
  }
  const ring = (ts) => { g.beginPath(); for (const t of ts) for (const r of CGS.rings[t] || []) cglPath(g, r.xyz, true); };
  const stroke = (col, w) => { g.lineWidth = w + 1.4; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  if (run) {
    // each side's territories: a thin line of its colour with a dark casing
    const by = {};
    run.t.forEach((T, t) => { if (T.owner >= 0 && CGS.rings[t] && CGS.rings[t].length) (by[T.owner] = by[T.owner] || []).push(t); });
    for (const s of Object.keys(by)) { ring(by[s]); stroke(cgColor(+s), 1.8); }
    const tg = [...targets].filter((t) => t !== CG.sel);
    // (a weapon's targets dashed, a move's solid)
    if (tg.length) { ring(tg); if (CG.pick >= 0) g.setLineDash([7, 5]); stroke('#ffdc78', 2.2); g.setLineDash([]); }
    if (CG.sel >= 0) { ring([CG.sel]); stroke('#ffffff', 2.4); }
  }
  g.restore();
}

/* ------------------------------------------------------------------ the tints */

/** The owners' tints (and the Murmur's, the pick's and the move targets'), painted onto a picture of the whole globe
 * (longitude across, north up) when any of them change. Returns true if it changed. */
function cglTint(run, targets) {
  cglShapes();
  const parts = [];
  if (run) run.t.forEach((T, t) => {
    const c = T.owner >= 0 ? cgColor(T.owner) : T.murmur ? '#9a5adc' : '';
    const k = t === CG.sel ? 's' : targets.has(t) ? 'g' : '';
    if (c || k) parts.push(t + c + (T.owner >= 0 ? '' : 'm' + T.murmur) + k);
  });
  const key = parts.join('|');
  if (CGS.tint && key === CGS.tintKey) return false;
  CGS.tintKey = key;
  const W = 1024, H = 512;
  if (!CGS.tint) { CGS.tint = document.createElement('canvas'); CGS.tint.width = W; CGS.tint.height = H; }
  const g = CGS.tint.getContext('2d');
  g.clearRect(0, 0, W, H);
  const path = (t) => {
    g.beginPath();
    for (const r of CGS.rings[t] || []) for (const off of [-W, 0, W]) {
      const n = r.lon.length;
      for (let i = 0; i < n; i++) { const x = (r.lon[i] + 180) / 360 * W + off, y = (90 - r.lat[i]) / 180 * H; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
      if (r.pole) { g.lineTo((r.lon[n - 1] + 180) / 360 * W + off, r.pole > 0 ? -2 : H + 2); g.lineTo((r.lon[0] + 180) / 360 * W + off, r.pole > 0 ? -2 : H + 2); }
      g.closePath();
    }
  };
  const rgba = (hex, a) => { const c = cgRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  if (run) run.t.forEach((T, t) => {
    if (!CGS.rings[t] || !CGS.rings[t].length) return;
    const sel = t === CG.sel, tg = targets.has(t);
    if (T.owner < 0 && !T.murmur && !sel && !tg) return;
    path(t);
    g.save(); g.clip();
    if (T.owner >= 0) {
      const c = cgColor(T.owner);
      g.fillStyle = rgba(c, CGL.tint.fill); g.fill();
      for (const [w, a] of CGL.tint.edge) { g.lineWidth = w * 2; g.strokeStyle = rgba(c, a); g.stroke(); }
    } else if (T.murmur) { g.fillStyle = `rgba(150,90,220,${0.08 * T.murmur})`; g.fill(); }
    if (sel) { g.fillStyle = 'rgba(255,255,255,0.16)'; g.fill(); }
    else if (tg) { g.fillStyle = 'rgba(255,220,120,0.16)'; g.fill(); g.lineWidth = 8; g.strokeStyle = 'rgba(255,220,120,0.14)'; g.stroke(); }
    g.restore();
  });
  CGS.tintN++;
  CGS.tintData = null; // (the per-pixel way reads it again when it needs it)
  return true;
}

/* ------------------------------------------------------------------ the stars and the moon */

/** The stars behind (#cg-stars), drawn once for each size of the screen. */
function cglStars() {
  const c = $('cg-stars');
  if (!c) return;
  const V = CG.v, dpr = Math.min(2, V.dpr);
  c.width = Math.round(V.w * dpr); c.height = Math.round(V.h * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#03050a'; g.fillRect(0, 0, V.w, V.h);
  const n = Math.round(V.w * V.h * CGL.stars);
  for (let k = 0; k < n; k++) {
    const x = hash2(k, 1, 77) * V.w, y = hash2(k, 2, 77) * V.h, b = Math.pow(hash2(k, 3, 77), 3.2) * 0.9 + 0.05, blue = hash2(k, 4, 77) < 0.3;
    const r = 0.45 + b * 0.9;
    g.fillStyle = blue ? `rgba(205,225,255,${Math.min(1, b * 1.3)})` : `rgba(255,${Math.round(235 + 20 * hash2(k, 5, 77))},${Math.round(218 + 37 * hash2(k, 6, 77))},${Math.min(1, b * 1.3)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

/** Argos as a little moon: grey, cratered, lit from the same side as the planet (a sprite, made once for each size). */
function cglMoon(rCss, dpr) {
  const n = Math.max(8, Math.round(rCss * 2 * Math.min(2, dpr)));
  if (CGS.moon && CGS.moon.width === n) return CGS.moon;
  const c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), px = img.data;
  const L = cglLight(), cr = [];
  for (let k = 0; k < 60; k++) {
    const lo = (hash2(k, 1, 91) * 180 - 90) * Math.PI / 180, la = (hash2(k, 2, 91) * 160 - 80) * Math.PI / 180;
    cr.push([Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo), (2 + 12 * hash2(k, 3, 91)) * (hash2(k, 4, 91) < 0.1 ? 2.5 : 1) * Math.PI / 180]);
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) / n) * 2 - 1, v = 1 - ((j + 0.5) / n) * 2, rr = u * u + v * v, o = (j * n + i) * 4;
    if (rr > 1) continue;
    const z = Math.sqrt(1 - rr);
    let m = 0.62 + 0.25 * (mplFbm(u * 3 + 5, v * 3, z * 3, 2000, 4) - 0.5) - 0.18 * clamp((mplFbm(u * 1.6, v * 1.6 + 3, z * 1.6, 2010, 3) - 0.5) / 0.12, 0, 1);
    for (const [x, y, w, r] of cr) {
      const a = Math.acos(clamp(u * x + v * y + z * w, -1, 1)) / r;
      if (a < 1) m -= 0.1 * (1 - a * a); else if (a < 1.6) m += 0.08 * Math.exp(-(((a - 1) / 0.18) ** 2));
    }
    const nl = u * L[0] + v * L[1] + z * L[2], lit = 0.1 + 0.95 * (nl < -0.1 ? 0 : nl > 0.6 ? 1 : smoothstep01((nl + 0.1) / 0.7)) * (0.5 + 0.5 * Math.max(0, nl));
    const k = m * lit * 255;
    px[o] = k * 0.98; px[o + 1] = k * 0.97; px[o + 2] = k * 0.95; px[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5);
  }
  g.putImageData(img, 0, 0);
  CGS.moon = c;
  return c;
}
function cglLight() { const L = CGL.light, l = Math.hypot(L[0], L[1], L[2]); return [L[0] / l, L[1] / l, L[2] / l]; }

/* ------------------------------------------------------------------ the planet, in WebGL */

const CGL_VS = 'attribute vec2 aP; void main() { gl_Position = vec4(aP, 0.0, 1.0); }';
// (written for GLSL ES 1.00; for WebGL 2 the header below turns it into 3.00, and where the longitude wraps round (only
// ever seen past a pole) samples with gradients taken across the seam, so no line shows there)
const CGL_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex, uCloud, uTint;
uniform vec4 uView;   // the globe's centre and radius (device px, y down), the canvas's height
uniform vec3 uRot;    // yaw, cos and sin of the pitch
uniform vec3 uL;
uniform float uCloudS, uReady;
OUT_DECL
void main() {
  vec2 p = vec2(gl_FragCoord.x, uView.w - gl_FragCoord.y);
  float r = uView.z, u = (p.x - uView.x) / r, v = -(p.y - uView.y) / r, rr = u * u + v * v, rho = sqrt(rr);
  vec4 o = vec4(0.0);
  if (rho > 1.0 - 2.0 / r) {
    // the halo of air, brighter on the lit side
    float d = max(rho - 1.0, 0.0);
    float hf = clamp(0.2 + 1.1 * dot(vec2(u, v) / max(rho, 1e-4), uL.xy), 0.04, 1.2);
    float h = (exp(-d / 0.012) * 0.75 + exp(-d / 0.05) * 0.22 + exp(-d / 0.14) * 0.06) * hf;
    o = vec4(vec3(0.36, 0.62, 1.0) * h, clamp(h * 1.2, 0.0, 1.0));
  }
  if (rr < 1.0) {
    float z = sqrt(1.0 - rr);
    float Y = v * uRot.y + z * uRot.z, Z = -v * uRot.z + z * uRot.y;
    vec2 st = vec2((atan(u, Z) + uRot.x) / 6.2831853 + 0.5, 0.5 - asin(clamp(Y, -1.0, 1.0)) / 3.14159265);
    GRADS
    vec4 a = TEX(uTex, st);
    float land = clamp((a.a * 255.0 - 224.0) / 31.0, 0.0, 1.0);
    vec3 col = mix(vec3(0.03, 0.10, 0.22), a.rgb, uReady);
    vec4 ti = TEX(uTint, st);
    col = mix(col, ti.rgb, ti.a * max(land, 0.3));
    vec2 cs = st + vec2(uCloudS, 0.0);
    float cl = TEX(uCloud, cs).r * uReady;
    vec3 N = vec3(u, v, z);
    float ndl = dot(N, uL), day = smoothstep(-0.18, 0.55, ndl);
    float lit = 0.2 + 0.85 * day * (0.55 + 0.45 * max(ndl, 0.0));
    float ndh = max(dot(N, normalize(uL + vec3(0.0, 0.0, 1.0))), 0.0);
    float spec = (pow(ndh, 70.0) * 0.38 + pow(ndh, 12.0) * 0.10) * (1.0 - land) * (1.0 - cl) * day;
    vec3 s = col * (1.0 - 0.2 * cl);
    s = mix(s, vec3(0.97, 0.97, 0.98), cl * 0.92);
    vec3 c = s * lit + spec * vec3(1.0, 0.95, 0.85);
    float fres = pow(1.0 - z, 2.2);
    c = c * (1.0 - 0.35 * fres) + vec3(0.30, 0.55, 1.0) * (0.55 * fres * clamp(ndl + 0.35, 0.0, 1.0));
    float e = clamp((1.0 - rho) * r + 0.5, 0.0, 1.0);
    o = mix(o, vec4(clamp(c, 0.0, 1.0), 1.0), e);
  }
  OUT = o;
}`;

/** Set up WebGL on #cg-gl (once). False when there's none to be had: the globe is then drawn per pixel (cgDraw2d). */
function cglInit() {
  if (CGS.gl || CGS.failed) return !!CGS.gl;
  const c = $('cg-gl');
  const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
  let gl = null, v2 = false;
  try {
    gl = c && c.getContext('webgl2', opt); v2 = !!gl;
    if (!gl && c) gl = c.getContext('webgl', opt) || c.getContext('experimental-webgl', opt);
  } catch (e) { gl = null; }
  if (!gl) return cglFail();
  const fs = (v2 ? '#version 300 es\n#define OUT_DECL out vec4 fragColor;\n#define OUT fragColor\n#define GRADS vec2 dx = dFdx(st), dy = dFdy(st); bool seam = abs(dx.x) > 0.5 || abs(dy.x) > 0.5; dx.x -= floor(dx.x + 0.5); dy.x -= floor(dy.x + 0.5);\n#define TEX(s, q) (seam ? textureGrad(s, q, dx, dy) : texture(s, q))\n'
    : '#define OUT_DECL\n#define OUT gl_FragColor\n#define GRADS\n#define TEX(s, q) texture2D(s, q)\n') + CGL_FS;
  const vs = v2 ? '#version 300 es\nin vec2 aP; void main() { gl_Position = vec4(aP, 0.0, 1.0); }' : CGL_VS;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('globe shader:', gl.getShaderInfoLog(s)); return null; } return s; };
  const a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
  if (!a || !b) return cglFail();
  const prog = gl.createProgram();
  gl.attachShader(prog, a); gl.attachShader(prog, b); gl.bindAttribLocation(prog, 0, 'aP'); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return cglFail();
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const n of ['uTex', 'uCloud', 'uTint', 'uView', 'uRot', 'uL', 'uCloudS', 'uReady']) U[n] = gl.getUniformLocation(prog, n);
  gl.uniform1i(U.uTex, 0); gl.uniform1i(U.uCloud, 1); gl.uniform1i(U.uTint, 2);
  const L = cglLight(); gl.uniform3f(U.uL, L[0], L[1], L[2]);
  gl.uniform1f(U.uCloudS, CGL.cloudShift);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
  CGS.gl = { gl, v2, prog, U, aniso, max: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
  // a blank texel for each picture until it comes
  for (const [k, unit, px] of [['sd', 0, [8, 26, 56, 224]], ['clouds', 1, [0, 0, 0, 255]], ['tint', 2, [0, 0, 0, 0]]]) {
    const t = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(px));
    CGS.tex[k === 'sd' ? 'surf' : k] = t;
  }
  CGS.tintN = -1;
  c.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cglFail(); CG.dirty = true; });
  cglArt('sd'); cglArt('clouds');
  return true;
}
function cglFail() {
  CGS.gl = null; CGS.failed = true;
  const c = $('cg-gl'); if (c) c.hidden = true;
  return false;
}

/** Fetch picture `which` (sd, hd, clouds) and give it to the GPU when it comes. */
function cglArt(which) {
  const src = CGL.art[which], bundle = which === 'hd' ? 'globe-hd.js' : 'globe.js';
  const go = () => {
    const img = new Image();
    img.onload = () => {
      const G = CGS.gl;
      if (!G) return;
      const gl = G.gl, unit = which === 'clouds' ? 1 : 0, t = which === 'clouds' ? CGS.tex.clouds : gl.createTexture();
      try {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      } catch (e) { cglFail(); CG.dirty = true; return; } // (a page opened from a file: the picture can't go to the GPU)
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (G.aniso && unit === 0) gl.texParameterf(gl.TEXTURE_2D, G.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(G.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      if (unit === 0) {
        if (CGS.loaded === 'hd' && which === 'sd') { gl.deleteTexture(t); return; } // (the sharp one came first)
        if (CGS.tex.surf) gl.deleteTexture(CGS.tex.surf);
        CGS.tex.surf = t; CGS.loaded = which;
      } else CGS.cloudsReady = true;
      CGS.key = ''; CG.dirty = true;
    };
    img.onerror = () => { if (which !== 'hd') { cglFail(); CG.dirty = true; } };
    img.src = (window.GLOBE_DATA && window.GLOBE_DATA[src]) || src;
  };
  // (in the one-file build the pictures come in a bundle beside the page, fetched once)
  if (window.GLOBE_BUNDLE && !(window.GLOBE_DATA && window.GLOBE_DATA[src])) {
    if (!CGS.bundles[bundle]) {
      CGS.bundles[bundle] = [];
      const s = document.createElement('script');
      s.src = bundle;
      s.onload = s.onerror = () => { const q = CGS.bundles[bundle]; CGS.bundles[bundle] = 'done'; q.forEach((f) => f()); };
      document.head.appendChild(s);
    }
    if (CGS.bundles[bundle] === 'done') go(); else CGS.bundles[bundle].push(go);
  } else go();
}

/** Place #cg-gl round the globe (with room for the halo) at the screen's size now. */
function cglPlace() {
  const c = $('cg-gl'), V = CG.v;
  if (!c || !CGS.gl) return;
  const side = V.r * 2 * 1.32, k = Math.min(CGL.maxDpr, V.dpr, CGL.maxPx / side), x = V.cx - side / 2, y = V.cy - side / 2;
  Object.assign(c.style, { left: x + 'px', top: y + 'px', width: side + 'px', height: side + 'px' });
  CGS.place = { x, y, side, full: Math.round(side * k), move: Math.round(side * Math.min(k, CGL.moveDpr)) };
  cglSize(CGS.place.full);
  if (CGS.hd === '' && V.r * 2 * CGS.place.k >= CGL.hdAt && CGS.gl.max >= 4096) { CGS.hd = 'asked'; cglArt('hd'); }
  CGS.key = '';
}

function cglSize(n) { const c = $('cg-gl'); if (c.width !== n) { c.width = n; c.height = n; } CGS.place.k = n / CGS.place.side; }

/** Draw the planet in WebGL if anything it shows has changed. False when there's no WebGL (draw it per pixel instead). */
function cglRender(tintChanged) {
  const G = CGS.gl;
  if (!G || !CGS.place) return false;
  const gl = G.gl, P = CGS.place, V = CG.v;
  if (tintChanged || CGS.tintN < 0) {
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, CGS.tex.tint);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, CGS.tint);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    CGS.tintN = 0; CGS.key = '';
  }
  const yaw = ((CG.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), now = performance.now();
  // while it turns, fewer pixels (a turn is two changes of view close together); sharp again once it stops (cgLoop)
  const view = yaw + ',' + CG.pitch;
  if (view !== CGS.view) { CGS.view = view; CGS.turning = now - (CGS.viewAt || 0) < 200; CGS.viewAt = now; }
  cglSize(CGS.turning && now - CGS.viewAt < 150 ? P.move : P.full);
  const key = [view, V.cx, V.cy, V.r, P.k, CGS.loaded, CGS.cloudsReady].join();
  if (key === CGS.key) return true;
  CGS.key = key;
  const n = gl.canvas.width;
  gl.viewport(0, 0, n, n);
  gl.useProgram(G.prog);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, CGS.tex.surf);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, CGS.tex.clouds);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, CGS.tex.tint);
  gl.uniform4f(G.U.uView, (V.cx - P.x) * P.k, (V.cy - P.y) * P.k, V.r * P.k, n);
  gl.uniform3f(G.U.uRot, yaw, Math.cos(CG.pitch), Math.sin(CG.pitch));
  gl.uniform1f(G.U.uReady, CGS.loaded ? 1 : 0);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return true;
}

/** Each frame (cgLoop): once the globe has stopped turning, draw it sharp again. */
function cglTick() {
  if (CGS.gl && CGS.place && CGS.turning && performance.now() - CGS.viewAt > 160) { CGS.turning = false; CG.dirty = true; }
}

/* ------------------------------------------------------------------ the planet, per pixel (no WebGL) */

/** The globe shaded per pixel into a small image and drawn smoothly at its size (from the menu planet's face). */
function cgDraw2d(g) {
  const V = CG.v, dpr = V.dpr;
  if (!CG.map) CG.map = mplMakeMap();
  if (!CG.map.done) CG.map.step(6);
  const n = Math.max(64, Math.min(CGV.maxRes, Math.round(V.r * 2 * Math.min(dpr, 1.5))));
  if (!CG.off || CG.off.width !== n) { CG.off = document.createElement('canvas'); CG.off.width = CG.off.height = n; CG.img = CG.off.getContext('2d').createImageData(n, n); }
  if (!CGS.tintData && CGS.tint) CGS.tintData = CGS.tint.getContext('2d').getImageData(0, 0, CGS.tint.width, CGS.tint.height).data;
  const px = CG.img.data, M = CG.map, TW = M.W, TH = M.H, ti = CGS.tintData, KW = CGS.tint ? CGS.tint.width : 1, KH = CGS.tint ? CGS.tint.height : 1;
  const cp = Math.cos(CG.pitch), sp = Math.sin(CG.pitch), yaw = CG.yaw, PI = Math.PI, L = cglLight();
  for (let j = 0; j < n; j++) {
    const v = -(((j + 0.5) / n) * 2 - 1);
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) / n) * 2 - 1, rr = u * u + v * v, o = (j * n + i) * 4;
      if (rr > 1) { px[o + 3] = 0; continue; }
      const z = Math.sqrt(1 - rr), Y = v * cp + z * sp, Z = -v * sp + z * cp, lat = Math.asin(Y);
      let lon = (Math.atan2(u, Z) + yaw) / (2 * PI) + 0.5;
      lon %= 1; if (lon < 0) lon += 1;
      const fy = 0.5 - lat / PI, tt = Math.min(TH - 1, Math.max(0, (fy * TH) | 0)) * TW + ((lon * TW) | 0);
      let r = M.tex[tt * 3], gg = M.tex[tt * 3 + 1], b = M.tex[tt * 3 + 2];
      if (ti) {
        const k = (Math.min(KH - 1, Math.max(0, (fy * KH) | 0)) * KW + ((lon * KW) | 0)) * 4, a = ti[k + 3] / 255;
        if (a) { r += (ti[k] - r) * a; gg += (ti[k + 1] - gg) * a; b += (ti[k + 2] - b) * a; }
      }
      // light from the upper left with a soft terminator, the haze of air towards the limb
      const ndl = u * L[0] + v * L[1] + z * L[2], day = ndl < -0.18 ? 0 : ndl > 0.55 ? 1 : smoothstep01((ndl + 0.18) / 0.73);
      const lit = 0.2 + 0.85 * day * (0.55 + 0.45 * Math.max(0, ndl)), fres = Math.pow(1 - z, 2.2), air = 0.55 * fres * clamp(ndl + 0.35, 0, 1) * 255, k = lit * (1 - 0.35 * fres);
      px[o] = r * k + 0.3 * air; px[o + 1] = gg * k + 0.55 * air; px[o + 2] = b * k + air;
      px[o + 3] = 255 * Math.min(1, (1 - Math.sqrt(rr)) * n * 0.5);
    }
  }
  CG.off.getContext('2d').putImageData(CG.img, 0, 0);
  const glow = g.createRadialGradient(V.cx, V.cy, V.r * 0.98, V.cx, V.cy, V.r * 1.16);
  glow.addColorStop(0, 'rgba(92,158,255,0.5)'); glow.addColorStop(0.3, 'rgba(92,158,255,0.14)'); glow.addColorStop(1, 'rgba(92,158,255,0)');
  g.fillStyle = glow; g.beginPath(); g.arc(V.cx, V.cy, V.r * 1.16, 0, PI * 2); g.fill();
  g.imageSmoothingEnabled = true;
  g.drawImage(CG.off, V.cx - V.r, V.cy - V.r, V.r * 2, V.r * 2);
}
