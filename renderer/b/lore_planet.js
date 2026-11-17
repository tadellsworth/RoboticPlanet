// Ithaca I from orbit, for the Lore guide (art/lore/ithaca.webp): the coral-red world in its patchwork of regions,
// the bright Ring (what's left of a moon) with the planet's shadow across it and its own shadow on the planet, the
// grey moon Argos, and the orange star Corvane flaring in the top-left corner. The night side shows what the robots
// left there: colony lights in the four callsign colours, Cinderlands lava and the Bloom glowing violet.
// Not a sprite: a 16:9 illustration with its own camera, lights and shaders (no pad, no shared lights).
//   ?w=2560&h=1440          render size (composed down 2x by post/lore_planet.py)
//   ?view=wide|plate        wide: the cover (planet right of centre, room for Corvane); plate: planet centred
// Run from renderer/:  node run.js out/lore 'lore_planet:::ithaca:w=2560&h=1440'
//                      python3 post/lore_planet.py out/lore/ithaca.beauty.png ../art/lore/ithaca.webp --q 86
const P = new URLSearchParams(location.search);
const W = +(P.get('w') || 2560), H = +(P.get('h') || 1440), VIEW = P.get('view') || 'wide';
export const config = { pad: false, lights: false, w: W, h: H };

// ---- 3D value noise (seeded, smooth), sampled on the sphere so the map has no seam and no pinched poles ----
function makeNoise(seed) {
  const perm = new Uint8Array(512); const p = [...Array(256).keys()];
  let s = seed >>> 0; const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256); for (let i = 0; i < 256; i++) val[i] = rnd();
  const h = (x, y, z) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const sm = (t) => t * t * (3 - 2 * t);
  const n3 = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = sm(x - xi), yf = sm(y - yi), zf = sm(z - zi);
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(xi, yi, zi), h(xi + 1, yi, zi), xf), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
  const fbm = (x, y, z, oct = 5) => { let a = 0, f = 1, w = 0.5, t = 0; for (let i = 0; i < oct; i++) { a += w * n3(x * f, y * f, z * f); t += w; f *= 2.03; w *= 0.5; } return a / t; };
  return { n3, fbm, rnd };
}

const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// The regions as seen from orbit (sRGB albedo, and what glows on the night side). The Rust takes most of the world.
const REGIONS = {
  rust: { c: ['#b8402c', '#cc5238', '#8f3022'], w: 9 },
  green: { c: ['#3a5934', '#4b6a3a', '#2b4529'], w: 1.3 },
  ember: { c: ['#a65e2a', '#bb7434', '#82451f'], w: 1.2 },
  grass: { c: ['#a0794a', '#b28c58', '#80603a'], w: 1.1 },
  sump: { c: ['#484a34', '#585b3e', '#36382a'], w: 1 },
  cinder: { c: ['#3a3331', '#4a403b', '#2a2524'], w: 0.9, lava: true },
  bloom: { c: ['#533769', '#664380', '#3c284f'], w: 1, glow: true },
  sea: { c: ['#1d3343', '#244456', '#152836'], w: 1.1, sea: true },
};

function planetMaps(N) {
  const NZ = makeNoise(1817), W2 = N * 2, H2 = N;
  const alb = document.createElement('canvas'); alb.width = W2; alb.height = H2;
  const em = document.createElement('canvas'); em.width = W2; em.height = H2;
  const ag = alb.getContext('2d'), eg = em.getContext('2d');
  const A = ag.createImageData(W2, H2), E = eg.createImageData(W2, H2);
  // region cells: points on the sphere, each one region
  const cells = [], keys = Object.keys(REGIONS), wsum = keys.reduce((s, k) => s + REGIONS[k].w, 0);
  for (let i = 0; i < 150; i++) {
    const u = NZ.rnd() * 2 - 1, th = NZ.rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    let x = NZ.rnd() * wsum, k = keys[0]; for (const kk of keys) { x -= REGIONS[kk].w; if (x <= 0) { k = kk; break; } }
    cells.push([r * Math.cos(th), u, r * Math.sin(th), k]);
  }
  // strike sites: craters of every size (the biggest cracked the crust)
  const craters = [];
  for (let i = 0; i < 46; i++) {
    const u = NZ.rnd() * 2 - 1, th = NZ.rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    craters.push([r * Math.cos(th), u, r * Math.sin(th), 0.012 + Math.pow(NZ.rnd(), 3) * 0.075]);
  }
  // colony lights: a few clusters in each callsign colour, strung along short "roads"
  const lights = [], cols = [[56, 212, 255], [255, 90, 110], [91, 224, 108], [179, 107, 255]];
  for (let i = 0; i < 26; i++) {
    const u = (NZ.rnd() * 2 - 1) * 0.8, th = NZ.rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    lights.push([r * Math.cos(th), u, r * Math.sin(th), cols[i % 4], 0.012 + NZ.rnd() * 0.02]);
  }
  for (let y = 0; y < H2; y++) {
    const lat = (0.5 - (y + 0.5) / H2) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < W2; x++) {
      const lon = ((x + 0.5) / W2) * Math.PI * 2;
      const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
      // warped position: the patchwork's borders wander
      const wx = px + (NZ.fbm(px * 2.2 + 11, py * 2.2, pz * 2.2, 4) - 0.5) * 0.55;
      const wy = py + (NZ.fbm(px * 2.2, py * 2.2 + 23, pz * 2.2, 4) - 0.5) * 0.55;
      const wz = pz + (NZ.fbm(px * 2.2, py * 2.2, pz * 2.2 + 37, 4) - 0.5) * 0.55;
      let best = 9, second = 9, bk = 'rust', sk = 'rust';
      for (const c of cells) { const d = (wx - c[0]) ** 2 + (wy - c[1]) ** 2 + (wz - c[2]) ** 2; if (d < best) { second = best; sk = bk; best = d; bk = c[3]; } else if (d < second) { second = d; sk = c[3]; } }
      const R = REGIONS[bk];
      const n = NZ.fbm(px * 6, py * 6, pz * 6, 5), n2 = NZ.fbm(px * 18 + 5, py * 18, pz * 18, 3);
      const tone = (Q) => { let q = mix(hex(Q.c[2]), hex(Q.c[1]), Math.min(1, Math.max(0, (n - 0.3) * 2.2))); return mix(q, hex(Q.c[0]), 0.45); };
      // neighbouring regions blend across a soft border, as they would seen from orbit
      const bt = Math.min(1, (Math.sqrt(second) - Math.sqrt(best)) / 0.07);
      let c = mix(tone(REGIONS[sk]), tone(R), 0.5 + 0.5 * bt * bt * (3 - 2 * bt));
      c = c.map((v) => v * (0.86 + 0.28 * n2));
      // dust: every region carries some of the Rust's red
      c = mix(c, hex('#c4502f'), 0.12 + 0.18 * NZ.fbm(px * 3 + 50, py * 3, pz * 3, 3));
      // border seams (where two regions meet) a touch darker
      const edge = Math.sqrt(second) - Math.sqrt(best); if (edge < 0.012 && sk !== bk) c = c.map((v) => v * (0.93 + 6 * edge));
      // Hoarfell: polar caps with ragged edges
      const cap = Math.abs(py) + (NZ.fbm(px * 5, py * 5, pz * 5, 4) - 0.5) * 0.22;
      const ice = Math.min(1, Math.max(0, (cap - 0.87) / 0.05));
      let glow = [0, 0, 0];
      if (!R.sea || ice > 0.5) {
        // strike sites
        for (const k of craters) {
          const d = Math.sqrt((px - k[0]) ** 2 + (py - k[1]) ** 2 + (pz - k[2]) ** 2) / k[3];
          if (d < 1.25) { if (d < 0.85) c = c.map((v) => v * (0.8 + 0.16 * d)); else if (d < 1.1) c = mix(c, [226, 170, 130], 0.16 * (1 - Math.abs(d - 0.97) / 0.13)); }
        }
      }
      c = mix(c, hex('#e9eef0'), ice * (0.85 + 0.15 * n2));
      if (R.lava && ice < 0.5) { const v = NZ.fbm(px * 30, py * 30, pz * 30, 3); if (v > 0.58) { const k = (v - 0.58) * 9; glow = [255 * k, 90 * k, 20 * k]; c = mix(c, [200, 70, 30], Math.min(1, k)); } }
      if (R.glow && ice < 0.5) { const v = NZ.fbm(px * 24 + 3, py * 24, pz * 24, 3); const k = Math.max(0, (v - 0.5) * 4); glow = [170 * k, 80 * k, 255 * k]; }
      if (R.sea && ice < 0.5) { const v = n2; c = mix(c, [40, 90, 110], 0.15 * v); }
      const i = (y * W2 + x) * 4;
      A.data[i] = c[0]; A.data[i + 1] = c[1]; A.data[i + 2] = c[2]; A.data[i + 3] = 255; // (water is told by its colour in the shader: a canvas loses colour under alpha 0)
      E.data[i] = glow[0]; E.data[i + 1] = glow[1]; E.data[i + 2] = glow[2]; E.data[i + 3] = 255;
    }
  }
  ag.putImageData(A, 0, 0); eg.putImageData(E, 0, 0);
  // colony lights on the emissive map: short lit roads and a bright knot (the Command Base)
  eg.globalCompositeOperation = 'lighter';
  for (const [x, y, z, col, s] of lights) {
    const lon = Math.atan2(z, x), lat = Math.asin(y);
    const u = ((lon / (Math.PI * 2)) + 1) % 1 * W2, v = (0.5 - lat / Math.PI) * H2, k = 1 / Math.max(0.3, Math.cos(lat));
    const r = s * H2;
    for (let j = 0; j < 4; j++) {
      const a = NZ.rnd() * Math.PI * 2, l = r * (1 + NZ.rnd() * 1.5);
      eg.strokeStyle = `rgba(255,214,150,0.55)`; eg.lineWidth = 1.4;
      eg.beginPath(); eg.moveTo(u, v); eg.lineTo(u + Math.cos(a) * l * k, v + Math.sin(a) * l); eg.stroke();
    }
    const g = eg.createRadialGradient(u, v, 0, u, v, r * 0.7);
    g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},1)`); g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    eg.fillStyle = g; eg.beginPath(); eg.ellipse(u, v, r * 0.7 * k, r * 0.7, 0, 0, 7); eg.fill();
  }
  return { alb, em };
}

function moonMap(N) {
  const NZ = makeNoise(4404), c = document.createElement('canvas'); c.width = N * 2; c.height = N;
  const g = c.getContext('2d'), D = g.createImageData(N * 2, N);
  const craters = [];
  for (let i = 0; i < 90; i++) { const u = NZ.rnd() * 2 - 1, th = NZ.rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u); craters.push([r * Math.cos(th), u, r * Math.sin(th), 0.03 + Math.pow(NZ.rnd(), 2.5) * 0.22]); }
  for (let y = 0; y < N; y++) {
    const lat = (0.5 - (y + 0.5) / N) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < N * 2; x++) {
      const lon = ((x + 0.5) / (N * 2)) * Math.PI * 2, px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
      let v = 150 + (NZ.fbm(px * 4, py * 4, pz * 4, 5) - 0.5) * 120;
      for (const k of craters) { const d = Math.sqrt((px - k[0]) ** 2 + (py - k[1]) ** 2 + (pz - k[2]) ** 2) / k[3]; if (d < 0.85) v *= 0.8 + 0.1 * d; else if (d < 1.05) v *= 1.12; }
      const i = (y * N * 2 + x) * 4; D.data[i] = v * 0.98; D.data[i + 1] = v * 0.97; D.data[i + 2] = v; D.data[i + 3] = 255;
    }
  }
  g.putImageData(D, 0, 0); return c;
}

// The Ring's profile across its width: colour (cream, a breath of coral and violet Crystal dust) and density, with gaps.
function ringProfile(n) {
  const NZ = makeNoise(2212), c = document.createElement('canvas'); c.width = n; c.height = 1;
  const g = c.getContext('2d'), D = g.createImageData(n, 1);
  for (let x = 0; x < n; x++) {
    const u = x / (n - 1);
    let a = 0.25 + 0.75 * NZ.fbm(u * 9, 0.5, 0.5, 4);
    a *= Math.min(1, u / 0.06) * Math.min(1, (1 - u) / 0.04);           // soft inner and outer edges
    if (u > 0.47 && u < 0.52) a *= 0.08;                                 // the main gap
    if (u > 0.78 && u < 0.795) a *= 0.25;
    if (u < 0.2) a *= 0.35 + u * 3;                                      // the thin inner ring
    a = Math.pow(Math.min(1, a * 1.25), 1.1);
    const warm = NZ.fbm(u * 5 + 9, 0.3, 0.7, 3);
    let col = mix([222, 196, 164], [236, 150, 112], Math.max(0, warm - 0.4) * 1.5);
    if (u > 0.85) col = mix(col, [205, 190, 235], (u - 0.85) * 3);       // Crystal dust at the rim
    col = col.map((v) => v * (0.85 + 0.3 * NZ.n3(u * 120, 3, 3)));
    D.data[x * 4] = col[0]; D.data[x * 4 + 1] = col[1]; D.data[x * 4 + 2] = col[2]; D.data[x * 4 + 3] = a * 255;
  }
  g.putImageData(D, 0, 0); return c;
}

// Space behind it all: navy, faint violet haze, stars, and Corvane's corona in the top-left.
function sky(w, h) {
  const NZ = makeNoise(77), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(w * 0.62, h * 0.55, 0, w * 0.62, h * 0.55, w * 0.8);
  bg.addColorStop(0, '#16224a'); bg.addColorStop(0.55, '#0d1630'); bg.addColorStop(1, '#070b18');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) { // haze
    const x = NZ.rnd() * w, y = NZ.rnd() * h, r = (0.1 + NZ.rnd() * 0.25) * w, viol = NZ.rnd() < 0.5;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, viol ? 'rgba(90,60,150,0.07)' : 'rgba(40,70,140,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  const s = w / 2560;
  for (let i = 0; i < 1500; i++) { // stars
    const x = NZ.rnd() * w, y = NZ.rnd() * h, b = Math.pow(NZ.rnd(), 4), r = (0.6 + b * 2.2) * s;
    const tint = NZ.rnd(); const col = tint < 0.2 ? '255,214,180' : tint < 0.35 ? '190,210,255' : '241,236,226';
    g.fillStyle = `rgba(${col},${0.25 + 0.75 * b})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  }
  // Corvane: a restless orange star, half out of frame, with a flaring corona
  const cx = 0.025 * w, cy = 0.075 * h, R0 = 0.09 * h;
  let gr = g.createRadialGradient(cx, cy, 0, cx, cy, h * 0.95);
  gr.addColorStop(0, 'rgba(255,170,90,0.55)'); gr.addColorStop(0.18, 'rgba(255,120,60,0.22)'); gr.addColorStop(0.5, 'rgba(200,70,40,0.06)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.save(); g.translate(cx, cy); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) { // flare filaments
    const a = NZ.rnd() * Math.PI * 2, l = R0 * (1.15 + NZ.rnd() * (NZ.rnd() < 0.12 ? 2.2 : 0.7)), wd = R0 * (0.04 + NZ.rnd() * 0.12);
    const fg = g.createLinearGradient(0, 0, Math.cos(a) * l, Math.sin(a) * l);
    fg.addColorStop(0, 'rgba(255,190,110,0.0)'); fg.addColorStop(0.55, 'rgba(255,150,70,0.16)'); fg.addColorStop(1, 'rgba(255,110,50,0)');
    g.strokeStyle = fg; g.lineWidth = wd; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + 0.3) * l * 0.6, Math.sin(a + 0.3) * l * 0.6, Math.cos(a) * l, Math.sin(a) * l); g.stroke();
  }
  g.restore();
  gr = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.25);
  gr.addColorStop(0, '#fffaf0'); gr.addColorStop(0.55, '#ffe2a8'); gr.addColorStop(0.8, '#ffb060'); gr.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R0 * 1.25, 0, 7); g.fill();
  return c;
}

const VERT = `
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * w; }`;

// planet and moon: soft terminator, ring shadow, night-side lights, rim of atmosphere, sea glint
const BODY_FRAG = `
uniform sampler2D map; uniform sampler2D emis; uniform sampler2D ringTex;
uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 amb; uniform vec3 atmo; uniform float atmoK; uniform float emisK;
uniform vec3 ringC; uniform vec3 ringN; uniform float ringIn; uniform float ringOut; uniform float ringShadow; uniform float ringShine;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
  float ndl = dot(N, sunDir);
  vec4 t = texture2D(map, vUv); vec3 alb = pow(t.rgb, vec3(2.2));
  float sh = 1.0;
  if (ringShadow > 0.5) {
    float dn = dot(sunDir, ringN);
    if (abs(dn) > 1e-4) { float k = dot(ringC - vW, ringN) / dn; if (k > 0.0) { vec3 hp = vW + sunDir * k; float u = (length(hp - ringC) - ringIn) / (ringOut - ringIn);
      if (u > 0.0 && u < 1.0) sh = 1.0 - 0.8 * texture2D(ringTex, vec2(u, 0.5)).a; } }
  }
  float d = smoothstep(-0.08, 0.6, ndl) * 0.85 + max(ndl, 0.0) * 0.35;
  vec3 col = alb * (sunCol * d * sh + amb);
  // the lit Ring throws a little light on the night side
  col += alb * ringShine * vec3(0.9, 0.82, 0.75) * (1.0 - smoothstep(-0.2, 0.2, ndl)) * max(0.0, dot(N, ringN) * 0.5 + 0.5);
  // sea glint
  vec3 Hh = normalize(sunDir + V); float sea = smoothstep(0.02, 0.1, t.b - t.r);
  col += sea * sunCol * pow(max(dot(N, Hh), 0.0), 60.0) * 0.6 * sh;
  float night = 1.0 - smoothstep(-0.22, 0.06, ndl);
  col += pow(texture2D(emis, vUv).rgb, vec3(2.2)) * night * emisK;
  float fr = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  col += atmo * fr * atmoK * smoothstep(-0.4, 0.5, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

// the outer glow of the atmosphere (a shell seen from behind)
const HALO_FRAG = `
uniform vec3 sunDir; uniform vec3 atmo; uniform vec3 C; uniform float R;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
void main() {
  vec3 V = normalize(cameraPosition - vW);
  // how close the line of sight passes to the planet's limb
  vec3 oc = cameraPosition - C; float b = dot(-V, oc); float d2 = dot(oc, oc) - b * b; float dd = sqrt(max(d2, 0.0)) / R;
  float k = (1.0 - smoothstep(1.0, 1.075, dd)) * smoothstep(0.96, 1.0, dd);
  vec3 P = cameraPosition + V * b; float lit = smoothstep(-0.5, 0.6, dot(normalize(P - C), sunDir));
  gl_FragColor = vec4(atmo * k * (0.02 + 0.55 * lit * lit), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const RING_FRAG = `
uniform sampler2D ringTex; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 C; uniform vec3 ringN; uniform float R;
uniform float ringIn; uniform float ringOut;
varying vec3 vW; varying vec3 vN; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec3 pc = vW - C; float r = length(pc); float u = (r - ringIn) / (ringOut - ringIn);
  if (u < 0.0 || u > 1.0) discard;
  vec4 pr = texture2D(ringTex, vec2(u, 0.5));
  // clumps along the orbit: a broken moon, not a smooth disc
  float ang = atan(pc.z, pc.x);
  float cl = 0.94 + 0.06 * sin(ang * 5.0 + u * 9.0) + 0.05 * (hash(vec2(floor(ang * 1400.0), floor(u * 500.0))) - 0.5);
  // the planet's shadow
  float b = dot(pc, sunDir); float sh = 1.0;
  if (b < 0.0) { float dc = sqrt(max(dot(pc, pc) - b * b, 0.0)); sh = smoothstep(R * 0.985, R * 1.03, dc); }
  float lit = 0.3 + 0.7 * abs(dot(sunDir, ringN));
  vec3 col = pow(pr.rgb, vec3(2.2)) * sunCol * lit * sh * cl + pow(pr.rgb, vec3(2.2)) * 0.012;
  gl_FragColor = vec4(col, pr.a * clamp(cl, 0.0, 1.0));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export default function (L) {
  const THREE = L.THREE, r = L.getRenderer(), scene = L.getScene();
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.95; r.shadowMap.enabled = false;
  scene.environment = null;
  const bgTex = new THREE.CanvasTexture(sky(W, H)); bgTex.colorSpace = THREE.SRGBColorSpace; scene.background = bgTex;

  const sunDir = new THREE.Vector3(-0.62, 0.7, 0.36).normalize();
  const sunCol = new THREE.Color(1.0, 0.84, 0.7).multiplyScalar(1.4);
  const tilt = -0.36, ringN = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), tilt).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.06).normalize();
  const C = new THREE.Vector3(0, 0, 0), R = 1, ringIn = 1.36, ringOut = 2.2;

  const maps = planetMaps(1024);
  const albT = new THREE.CanvasTexture(maps.alb), emT = new THREE.CanvasTexture(maps.em);
  for (const t of [albT, emT]) { t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping; }
  const ringT = new THREE.CanvasTexture(ringProfile(1024)); ringT.minFilter = THREE.LinearFilter;

  const uni = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { value: v }]));
  const planet = new THREE.Mesh(new THREE.SphereGeometry(R, 192, 128), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: BODY_FRAG, uniforms: uni({ map: albT, emis: emT, ringTex: ringT, sunDir, sunCol, amb: new THREE.Color(0.012, 0.014, 0.03),
      atmo: new THREE.Color(1.0, 0.55, 0.42), atmoK: 0.5, emisK: 2.4, ringC: C, ringN, ringIn, ringOut, ringShadow: 1, ringShine: 0.05 }),
  }));
  planet.rotation.y = 2.2; // which face of the patchwork turns toward us
  L.getRoot().add(planet);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.09, 96, 64), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: HALO_FRAG, uniforms: uni({ sunDir, atmo: new THREE.Color(1.0, 0.5, 0.36), C, R }),
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  L.getRoot().add(halo);

  // the Ring: a flat annulus in its tilted plane
  const rg = new THREE.RingGeometry(ringIn, ringOut, 512, 8);
  rg.rotateX(-Math.PI / 2); // into the xz plane (normal +y), then tilt it like ringN
  const ring = new THREE.Mesh(rg, new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: RING_FRAG, uniforms: uni({ ringTex: ringT, sunDir, sunCol, C, ringN, R, ringIn, ringOut }),
    side: THREE.DoubleSide, transparent: true, depthWrite: false,
  }));
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ringN);
  ring.renderOrder = 2;
  L.getRoot().add(ring);

  // Argos, the surviving moon: grey, airless, cratered
  const moonT = new THREE.CanvasTexture(moonMap(256)); moonT.wrapS = THREE.RepeatWrapping;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.17, 96, 64), new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: BODY_FRAG, uniforms: uni({ map: moonT, emis: moonT, ringTex: ringT, sunDir, sunCol: sunCol.clone().multiplyScalar(0.95), amb: new THREE.Color(0.01, 0.011, 0.02),
      atmo: new THREE.Color(0, 0, 0), atmoK: 0, emisK: 0, ringC: C, ringN, ringIn, ringOut, ringShadow: 0, ringShine: 0 }),
  }));
  const wide = VIEW !== 'plate';
  moon.position.set(wide ? 2.2 : 2.75, wide ? 1.55 : 1.05, wide ? -1.8 : -1.2);
  L.getRoot().add(moon);
  L.mark('argos', moon.position.x, moon.position.y, moon.position.z);
  L.mark('planet', 0, 0, 0);

  const cam = new THREE.PerspectiveCamera(wide ? 27 : 30, W / H, 0.1, 100);
  cam.position.set(0.15, 1.05, 7.4);
  cam.lookAt(wide ? -0.55 : 0, wide ? 0.05 : 0.02, 0);
  cam.updateProjectionMatrix();
  L.useCamera(cam);
}
