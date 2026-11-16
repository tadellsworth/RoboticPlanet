// The Murmur, direction B reworked as moles ("Crystal-backed moles"): the shared kit for murmur_moles.js.
// Burrowing animals with matte fur or leathery hide, huge outward-turned spade forepaws with long pale claws, small hind
// feet, a pointed fleshy snout and a stub of a tail; shards of eaten Ring Crystal erupt through the hide along the spine
// and shoulders (smoky glass by day, burning white at night). Use it for any further Murmur creature:
//   const K = molekit(L);
//   const body = K.loft(G, stations, K.fur('#38302e'));      // a body from cross-sections, tail to nose
//   K.forelimb(GL, body, { side, f, ... }); K.hindlimb(GL, body, { side, f, ... });
//   K.snout(G, ...); K.tail(G, ...); K.shard / K.cluster / K.spineShards(G, body, ...)
//   K.camera(W, hero); K.centre(G, GL)
// Every function is listed (with its options) in the comment above it.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function molekit(L) {
  const { THREE } = L;
  const TOD = L.TOD;
  // how strongly the creatures' own lights burn: dim by day, bright at night (the game swaps in the night sprites)
  const GLOW = { day: 0.35, morning: 0.45, evening: 1.15, night: 1.7 }[TOD] ?? 0.35;
  const NIGHTISH = TOD === 'night' || TOD === 'evening';
  const V = (a) => (a.isVector3 ? a.clone() : new THREE.Vector3(...a));
  const UP = new THREE.Vector3(0, 1, 0);
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---- deterministic smooth noise (random plane waves, as nest.js does)
  let s0 = 7331; const r = () => { s0 = (s0 * 16807) % 2147483647; return s0 / 2147483647; };
  const waves = []; for (let i = 0; i < 16; i++) { const th = r() * 6.283, ph = Math.acos(2 * r() - 1); waves.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), 1.3 + r() * 3.2, r() * 6.28]); }
  const nz = (x, y, z) => { let v = 0, w = 0; for (const [a, b, c, f, o] of waves) { const amp = 1 / f; v += Math.sin((a * x + b * y + c * z) * f + o) * amp; w += amp; } return v / w; };

  // ---- textures (a colour map + a normal map made from a height canvas)
  function heightToNormal(src, n, s) {
    const out = document.createElement('canvas'); out.width = out.height = n; const og = out.getContext('2d'), od = og.createImageData(n, n);
    const d = src.getContext('2d').getImageData(0, 0, n, n).data, H = (x, y) => d[((((y + n) % n) * n) + ((x + n) % n)) * 4] / 255;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const gx = (H(x + 1, y) - H(x - 1, y)) * s, gy = (H(x, y + 1) - H(x, y - 1)) * s; const a = -gx, b = gy, c = 1, l = Math.hypot(a, b, c);
      const i = (y * n + x) * 4; od.data[i] = (a / l * 0.5 + 0.5) * 255; od.data[i + 1] = (b / l * 0.5 + 0.5) * 255; od.data[i + 2] = (c / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
    }
    og.putImageData(od, 0, 0); const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
  }
  function texPair(n, draw, nscale) {
    const c = document.createElement('canvas'); c.width = c.height = n; const h = document.createElement('canvas'); h.width = h.height = n;
    draw(c.getContext('2d'), h.getContext('2d'), n);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return [t, heightToNormal(h, n, nscale)];
  }
  // a short stroke drawn on both canvases, repeated across the edges so the texture tiles
  function stroke2(g, hg, n, x, y, dx, dy, w, col, hcol) {
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
      const X = x + ox, Y = y + oy; if (Math.max(X, X + dx) < -2 || Math.min(X, X + dx) > n + 2 || Math.max(Y, Y + dy) < -2 || Math.min(Y, Y + dy) > n + 2) continue;
      for (const [c, k] of [[g, col], [hg, hcol]]) { if (!k) continue; c.strokeStyle = k; c.lineWidth = w; c.beginPath(); c.moveTo(X, Y); c.lineTo(X + dx, Y + dy); c.stroke(); }
    }
  }
  // fur: dense short strands combed along v (the body's length), mottled; the height map gives each strand a ridge
  function furTex(len, count, seed) {
    const keep = s0; s0 = seed;
    const out = texPair(512, (g, hg, n) => {
      g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, n, n); hg.fillStyle = '#707070'; hg.fillRect(0, 0, n, n); g.lineCap = hg.lineCap = 'round';
      L.blotches(g, n, 140, 18, 90, 0.14); L.blotches(g, n, 60, 12, 60, 0.1, '255,255,255');
      // strands grow in tufts: each tuft a little fan of strands combed the same way, light at the tips
      for (let i = 0; i < count / 6; i++) {
        const cx = r() * n, cy = r() * n, a0 = (r() - 0.5) * 0.45, dk = r() < 0.5, lum = r();
        for (let k = 0; k < 6; k++) {
          const x = cx + (r() - 0.5) * len * 0.5, y = cy + (r() - 0.5) * len * 0.3, l = len * (0.7 + r() * 0.6), a = a0 + (r() - 0.5) * 0.25;
          const col = dk ? `rgba(8,8,8,${0.2 + 0.3 * lum})` : `rgba(255,255,255,${0.12 + 0.26 * lum})`;
          stroke2(g, hg, n, x, y, Math.sin(a) * l, Math.cos(a) * l, 1 + r() * 1.2, col, `rgba(${dk ? '10,10,10' : '255,255,255'},${0.35 + 0.4 * r()})`);
        }
      }
    }, 2.4);
    s0 = keep; return out;
  }
  const [furMap, furNrm] = furTex(16, 26000, 911);
  const [coarseMap, coarseNrm] = furTex(28, 15000, 913);           // the Brute's longer, shaggier coat
  // leathery hide (the Swarmer, a mole-rat): folds across the body, pores, a few stiff bristles
  const [hideMap, hideNrm] = texPair(512, (g, hg, n) => {
    g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n); g.lineCap = hg.lineCap = 'round';
    L.blotches(g, n, 160, 14, 80, 0.16); L.blotches(g, n, 70, 10, 50, 0.12, '255,255,255');
    for (let i = 0; i < 70; i++) {          // wrinkles: wavy grooves across the body (along u), each with a lit ridge beside it
      const y0 = r() * n, amp = 2 + r() * 5, fr = 0.01 + r() * 0.03, ph = r() * 6.28, x0 = r() * n, l = 60 + r() * 220, w = 1.5 + r() * 2.5;
      for (const [c, col, dy] of [[hg, 'rgba(0,0,0,0.7)', 0], [hg, 'rgba(255,255,255,0.35)', w * 1.4], [g, 'rgba(0,0,0,0.22)', 0]]) {
        c.strokeStyle = col; c.lineWidth = w; c.beginPath();
        for (let x = 0; x <= l; x += 6) { const X = (x0 + x) % n, Y = (y0 + dy + Math.sin((x0 + x) * fr + ph) * amp + n) % n; if (x === 0 || X < 6) c.moveTo(X, Y); else c.lineTo(X, Y); }
        c.stroke();
      }
    }
    for (let i = 0; i < 3500; i++) { const x = r() * n, y = r() * n, rr = 0.6 + r() * 1.4; hg.fillStyle = `rgba(20,20,20,${0.3 + r() * 0.4})`; hg.beginPath(); hg.arc(x, y, rr, 0, 7); hg.fill(); g.fillStyle = `rgba(0,0,0,${0.08 + r() * 0.12})`; g.beginPath(); g.arc(x, y, rr * 0.8, 0, 7); g.fill(); }
    for (let i = 0; i < 900; i++) { const x = r() * n, y = r() * n, a = (r() - 0.5) * 0.6, l = 6 + r() * 10; stroke2(g, hg, n, x, y, Math.sin(a) * l, Math.cos(a) * l, 0.8, 'rgba(15,12,12,0.35)', 'rgba(255,255,255,0.4)'); }
    L.speckle(g, n, 6000, 0.12);
  }, 2.6);
  // stone crust (the Brute's geode back, the Rust ones' plates): lumpy, cracked, dusty
  const [crustMap, crustNrm] = texPair(512, (g, hg, n) => {
    g.fillStyle = '#c9c4bc'; g.fillRect(0, 0, n, n); hg.fillStyle = '#808080'; hg.fillRect(0, 0, n, n);
    for (let i = 0; i < 900; i++) { const x = r() * n, y = r() * n, rr = 3 + r() * 16, k = r();
      const gr = hg.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${k < 0.5 ? '255,255,255' : '0,0,0'},0.35)`); gr.addColorStop(1, 'rgba(128,128,128,0)'); hg.fillStyle = gr; hg.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    L.blotches(g, n, 200, 8, 60, 0.2); L.blotches(g, n, 90, 6, 40, 0.18, '255,250,240');
    for (let i = 0; i < 40; i++) { let x = r() * n, y = r() * n; hg.strokeStyle = 'rgba(0,0,0,0.9)'; g.strokeStyle = 'rgba(20,15,10,0.5)'; hg.lineWidth = 2; g.lineWidth = 1.5; hg.beginPath(); g.beginPath(); hg.moveTo(x, y); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; hg.lineTo(x, y); g.lineTo(x, y); } hg.stroke(); g.stroke(); }
    L.speckle(g, n, 16000, 0.22);
  }, 3.5);

  // ---- materials (all matte: fur and hide never get the clear-coat gloss of chitin)
  const mats = {};
  // fur(hex, o): velvety coat. o: { coarse (the Brute's shaggy coat), sheen 0..1, sheenColor, rough, ns (normal strength),
  //   emissiveMap + emissive + glow + ek (glowing spots: the Bloom ones) }
  function fur(hex, o = {}) {
    const key = 'f' + hex + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, map: o.coarse ? coarseMap : furMap, normalMap: o.coarse ? coarseNrm : furNrm, normalScale: new THREE.Vector2(o.ns ?? 0.8, o.ns ?? 0.8),
      roughness: o.rough ?? 0.86, metalness: 0, sheen: o.sheen ?? 0.9, sheenColor: new THREE.Color(o.sheenColor ?? '#8c8480'), sheenRoughness: o.sheenRough ?? 0.5, vertexColors: true });
    m.envMapIntensity = o.env ?? 0.3;
    if (o.emissiveMap) { m.emissive = new THREE.Color(o.emissive); m.emissiveMap = o.emissiveMap; m.emissiveIntensity = (o.ek ?? 1) * GLOW; m.userData.glow = o.glow; }
    return (mats[key] = m);
  }
  // hide(hex, o): wrinkled leather, matte with a faint sheen. Same options as fur.
  function hide(hex, o = {}) {
    const key = 'h' + hex + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, map: hideMap, normalMap: hideNrm, normalScale: new THREE.Vector2(o.ns ?? 0.9, o.ns ?? 0.9),
      roughness: o.rough ?? 0.74, metalness: 0, sheen: o.sheen ?? 0.35, sheenColor: new THREE.Color(o.sheenColor ?? '#9a8c86'), sheenRoughness: 0.55, vertexColors: true });
    m.envMapIntensity = o.env ?? 0.35;
    if (o.emissiveMap) { m.emissive = new THREE.Color(o.emissive); m.emissiveMap = o.emissiveMap; m.emissiveIntensity = (o.ek ?? 1) * GLOW; m.userData.glow = o.glow; }
    return (mats[key] = m);
  }
  // crust(hex, o): stone crust (rough, cracked). o: { rough, ns }
  function crust(hex, o = {}) {
    const key = 'r' + hex + JSON.stringify(o); if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, map: crustMap, normalMap: crustNrm, normalScale: new THREE.Vector2(o.ns ?? 1.1, o.ns ?? 1.1), roughness: o.rough ?? 0.88, metalness: 0.02, vertexColors: true });
    m.envMapIntensity = 0.4; return (mats[key] = m);
  }
  // flesh(hex, o): naked moist skin (snout, star rays, palms): soft, a little damp, never glossy
  function flesh(hex, o = {}) {
    const key = 'l' + hex + JSON.stringify(o); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: o.rough ?? 0.55, metalness: 0,
      clearcoat: o.cc ?? 0.12, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#d8b8b0'), sheenRoughness: 0.4, vertexColors: true });
    m.envMapIntensity = 0.35; return (mats[key] = m);
  }
  // keratin(hex): claws and teeth. Pale, with a dark root (vertex colours from the claw geometry)
  function keratin(hex = '#ddd0b4', rough = 0.42) {
    const key = 'k' + hex + rough; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, vertexColors: true }); m.envMapIntensity = 0.55; return (mats[key] = m);
  }
  const plain = (hex, rough = 0.6, metal = 0) => { const key = 'p' + hex + rough; if (mats[key]) return mats[key]; const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, vertexColors: true }); m.envMapIntensity = 0.45; return (mats[key] = m); };
  // a tiny wet black eye, mostly lost in the fur
  const eye = () => mats.eye || (mats.eye = (() => { const m = new THREE.MeshPhysicalMaterial({ color: '#0c0909', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }); m.envMapIntensity = 0.4; return m; })());
  // the glow-pass colour sets how much bloom a part gets: kept low by day so the shards only shimmer
  function dimGlow(hex, k = 1) { const c = new THREE.Color(hex); c.multiplyScalar(Math.min(1, (NIGHTISH ? 0.1 + GLOW * 0.5 : 0.008 + GLOW * 0.055) * k)); return '#' + c.getHexString(); }
  // glowMat(hex, k, glowHex): a glowing organ (star rays while feeding, Bloom spots, feeding threads)
  function glowMat(hex, k = 1, glowHex) {
    const key = 'g' + hex + k + glowHex; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k * GLOW * 2.2, roughness: 0.4 });
    m.userData.glow = glowHex || dimGlow(hex); return (mats[key] = m);
  }
  // crystalMats(pal): Ring Crystal as the Murmur grow it back: a smoky glass shell with a brighter core glowing through.
  // pal: { shell, core, glow, opacity, dayCore (how much of the core shows by day), k (brightness) }. Use XTAL or PAL[v].xtal.
  function crystalMats(pal) {
    const key = 'x' + JSON.stringify(pal); if (mats[key]) return mats[key];
    // brightness rides on the emissive colour, not the intensity, so the night point lights lib.js hangs on every glowing
    // part stay soft and only tint the fur next to the shards; by day the core is a soft light inside the glass
    const k = pal.k ?? 1, B = k * (NIGHTISH ? 0.3 + GLOW * 1.25 : 0.06 + GLOW * 0.55);
    const shell = new THREE.MeshPhysicalMaterial({ color: pal.shell, emissive: new THREE.Color(pal.core).multiplyScalar(k * (NIGHTISH ? 0.02 + GLOW * 0.32 : 0.01 + GLOW * 0.1)), emissiveIntensity: 1, roughness: 0.22, metalness: 0, flatShading: true,
      clearcoat: 0.6, clearcoatRoughness: 0.1, transparent: true, opacity: pal.opacity ?? 0.8, depthWrite: true, side: THREE.FrontSide, specularIntensity: 0.6 });
    shell.envMapIntensity = 0.55;
    const coreCol = NIGHTISH ? new THREE.Color(pal.core) : new THREE.Color(pal.shell).lerp(new THREE.Color(pal.core), pal.dayCore ?? 0.45);
    const core = new THREE.MeshStandardMaterial({ color: coreCol, emissive: new THREE.Color(pal.core).multiplyScalar(B / 0.3), emissiveIntensity: 0.3, roughness: 0.3, flatShading: true });
    core.userData.glow = dimGlow(NIGHTISH ? (pal.glow || pal.core) : '#' + new THREE.Color(pal.glow || pal.core).lerp(new THREE.Color(pal.shell), 0.35).getHexString(), k);
    return (mats[key] = { shell, core });
  }
  // the crystal palettes. White light (no team owns white: the robots' lights are cyan, red, green or purple) in
  // smoky glass with a breath of the Crystal's violet; the White's frosted and dim; the Bloom's violet.
  const XTAL = { shell: '#9a92b6', core: '#f7f5ff', glow: '#f1efff', opacity: 0.78, dayCore: 0.62 };
  const XTAL_WHITE = { shell: '#eef1f4', core: '#e9edf2', glow: '#e4e9ef', opacity: 0.75, k: 0.55, dayCore: 0.5 };
  const XTAL_BLOOM = { shell: '#a274ea', core: '#c48dff', glow: '#b67cff', opacity: 0.6, k: 1.15, dayCore: 0.6 };

  // ---- geometry helpers
  // loft(parent, stations, mat, o): a body built from elliptical cross-sections, tail (first) to nose (last).
  //   stations: [[x, w, h, b, cy], ...]: x along the body, w the half-width, h the height above the centre line, b the
  //   depth below it, cy the centre line's height. Smoothly interpolated; the first and last stations close the ends.
  //   o: { p (superellipse power, 2 round, 2.6 boxy), lump (noise bumps), nx, na (resolution), uv (texture tile in world
  //   units), shade (fn(x, side 0..1 top->belly) -> brightness, default soft belly shadow), col (fn(x, a, s) -> [r,g,b]) }
  //   Returns { mesh, at(x) -> {w,h,b,cy}, surf(x, a) -> [x,y,z] on the surface (a: 0 top, +-PI/2 the flanks: + is +z),
  //   top(x, z) -> y of the back above (x, z) }.
  function loft(parent, stations, mat, o = {}) {
    const n = stations.length, NX = o.nx ?? 110, NA = o.na ?? 72, p = o.p ?? 2.2, lump = o.lump ?? 0.03, uvs = o.uv ?? 1.6;
    const cat = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    const S = (k) => stations[Math.max(0, Math.min(n - 1, k))];
    const at_u = (u) => { const i = Math.min(n - 2, Math.floor(u)), t = u - i; return S(i).map((_, c) => cat(S(i - 1)[c], S(i)[c], S(i + 1)[c], S(i + 2)[c], t)); };
    // a dense table along x, to look the shape up by x
    const tab = []; for (let k = 0; k <= 400; k++) tab.push(at_u((n - 1) * k / 400));
    const at = (x) => {
      if (x <= tab[0][0]) return { w: 0, h: 0, b: 0, cy: tab[0][4] }; if (x >= tab[400][0]) return { w: 0, h: 0, b: 0, cy: tab[400][4] };
      let k = 0; while (k < 399 && tab[k + 1][0] < x) k++;
      const A = tab[k], B = tab[k + 1], t = (x - A[0]) / Math.max(1e-6, B[0] - A[0]);
      const m = (c) => Math.max(0, A[c] + (B[c] - A[c]) * t); return { w: m(1), h: m(2), b: m(3), cy: A[4] + (B[4] - A[4]) * t };
    };
    const se = (c) => Math.sign(c) * Math.pow(Math.abs(c), 2 / p);
    const pt = (x, w, h, b, cy, a, k = 1) => { const sa = Math.sin(a), ca = Math.cos(a); return [x, cy + (ca > 0 ? h : b) * se(ca) * k, w * se(sa) * k]; };
    const surf = (x, a) => { const s = at(x); return pt(x, s.w, s.h, s.b, s.cy, a); };
    const top = (x, z) => { const s = at(x); if (!s.w) return s.cy; const q = clamp(Math.abs(z) / s.w, 0, 1); return s.cy + s.h * Math.pow(Math.max(0, 1 - Math.pow(q, p)), 1 / p); };
    const pos = [], col = [], uv = [], idx = [];
    for (let i = 0; i <= NX; i++) {
      const s = 0.5 - 0.5 * Math.cos(Math.PI * i / NX);               // samples crowd the ends, so they close round
      const [x, w, h, b, cy] = at_u((n - 1) * s);
      for (let j = 0; j <= NA; j++) {
        const a = j / NA * Math.PI * 2;                                // a = 0 on top, PI/2 on the +z flank
        const sa = Math.sin(a), ca = Math.cos(a);
        const k = 1 + lump * nz(x * 2.2 + (o.seed ?? 0), ca * 2.2, sa * 2.2) + (o.bump ? o.bump(x, a) : 0);
        const P = pt(x, Math.max(0, w), Math.max(0, h), Math.max(0, b), cy, a, k);
        pos.push(...P);
        const side = (1 - ca) / 2;                                     // 0 on the back, 1 under the belly
        const sh = o.shade ? o.shade(x, side) : 1 - 0.5 * sstep(0.45, 0.95, side);
        const c = o.col ? o.col(x, a, side) : [1, 1, 1];
        col.push(c[0] * sh, c[1] * sh, c[2] * sh);
        uv.push(j / NA * (o.uvU ?? 2.5), x / uvs);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) {
      const A = i * (NA + 1) + j, B = A + NA + 1, C = A + 1, D = B + 1;
      // the angle runs from the back over the +z flank: (B - A) is +x and (C - A) heads to +z at the top, so wind A,C,B
      idx.push(A, C, B, C, D, B);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = L.mesh(g, mat, 0, 0, 0, { parent });
    return { mesh, at, surf, top, stations };
  }
  // furShells(body, mat, o): a soft coat over a loft: n thin shells pushed out along the normals, each cut out of a
  // strand pattern (alpha test), thinner toward the tips and combed back, so the outline goes fuzzy like fur instead of
  // hard like a shell. o: { n (5), len (coat depth, world units), comb (how far the tips lean back), density (0..1),
  //   tip (brightness of the tips), scale (strand pattern tiles per u unit), x0 / x1 (only between these x) }
  let strandTex = null;
  function furShells(body, mat, o = {}) {
    if (!strandTex) strandTex = L.canvasTex(256, (g, n) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 2600; i++) { const x = L.rnd() * n, y = L.rnd() * n, rr = 1.2 + L.rnd() * 1.6, k = 0.55 + 0.45 * L.rnd();
        for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr); gr.addColorStop(0, `rgba(255,255,255,${k})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x + ox - rr, y + oy - rr, rr * 2, rr * 2); } }
    }, false);
    const src = body.mesh.geometry, N = o.n ?? 5, len = o.len ?? 0.05, comb = o.comb ?? 0.6, dens = o.density ?? 1, out = [];
    const P = src.attributes.position, Nn = src.attributes.normal, C = src.attributes.color;
    for (let i = 1; i <= N; i++) {
      const t = i / N, g = src.clone(), p = g.attributes.position, c = g.attributes.color;
      for (let k = 0; k < p.count; k++) {
        const x = P.getX(k), keep = (o.x0 === undefined || x > o.x0) && (o.x1 === undefined || x < o.x1) ? 1 : 0;
        const d = len * t * keep;
        p.setXYZ(k, x + Nn.getX(k) * d - comb * d, P.getY(k) + Nn.getY(k) * d, P.getZ(k) + Nn.getZ(k) * d);
        const b = 1 + (o.tip ?? 0.35) * t; c.setXYZ(k, C.getX(k) * b, C.getY(k) * b, C.getZ(k) * b);
      }
      const m = mat.clone(); const a = strandTex.clone(); a.needsUpdate = true; a.repeat.set(o.scale ?? 7, (o.scale ?? 7) * 1.1);
      m.alphaMap = a; m.alphaTest = 0.08 + (0.62 + (1 - dens) * 0.3) * Math.pow(t, 0.8); m.transparent = false;
      const mesh = L.mesh(g, m, 0, 0, 0, { parent: body.mesh.parent }); mesh.castShadow = false; out.push(mesh);
    }
    return out;
  }
  // seg(parent, at, rx, ry, rz, mat, o): a plain lumpy ellipsoid (o: { lump, seed, flat (belly flattening), rot })
  function seg(parent, at, rx, ry, rz, mat, o = {}) {
    const g = new THREE.SphereGeometry(1, o.ws ?? 48, o.hs ?? 28), pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i); const k = 1 + (o.lump ?? 0.03) * nz(v.x * 2.5 + (o.seed ?? 0), v.y * 2.5, v.z * 2.5);
      let y = v.y * k; if (y < 0) y *= 1 - (o.flat ?? 0.3);
      pos.setXYZ(i, v.x * k * rx, y * ry, v.z * k * rz);
      const b = 0.55 + 0.45 * clamp((v.y + 0.4) / 0.9); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = L.mesh(g, mat, at[0], at[1], at[2], { parent }); if (o.rot) m.rotation.set(...o.rot); return m;
  }
  // limb(parent, a, b, r0, r1, mat, o): a tapered, slightly bulging limb piece from a to b (o: { bulge, seg })
  function limb(parent, a, b, r0, r1, mat, o = {}) {
    const A = V(a), B = V(b), len = A.distanceTo(B), pts = [], N = 10, bul = o.bulge ?? 0.15;
    pts.push(new THREE.Vector2(0.0001, -r0 * 0.6));
    for (let i = 0; i <= N; i++) { const t = i / N; const rr = (r0 + (r1 - r0) * t) * (1 + bul * Math.sin(Math.PI * t)); pts.push(new THREE.Vector2(rr, t * len)); }
    pts.push(new THREE.Vector2(0.0001, len + r1 * 0.6));
    const g = new THREE.LatheGeometry(pts, o.seg ?? 14);
    const m = L.mesh(g, mat, A.x, A.y, A.z, { parent, dirt: o.dirt ?? 0.12, dirtH: len });
    m.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
    return m;
  }
  // tube(parent, ctrl, rf, mat, o): a smooth tube along a curve through control points; rf(t) its radius (t 0..1);
  //   o: { n, radial, flat (squash the section: 1 round, 0.5 half as tall), dirt }. Round caps.
  function tube(parent, ctrl, rf, mat, o = {}) {
    const c = new THREE.CatmullRomCurve3(ctrl.map(V)), N = o.n ?? 24, R = o.radial ?? 10, fl = o.flat ?? 1;
    const fr = c.computeFrenetFrames(N, false), pos = [], idx = [], uv = [];
    const ring = (i, rr, p) => { for (let j = 0; j <= R; j++) { const a = j / R * Math.PI * 2, n = fr.normals[i].clone().multiplyScalar(Math.cos(a) * fl).add(fr.binormals[i].clone().multiplyScalar(Math.sin(a))); pos.push(p.x + n.x * rr, p.y + n.y * rr, p.z + n.z * rr); uv.push(j / R, i / N); } };
    for (let i = 0; i <= N; i++) ring(i, Math.max(0.0005, rf(i / N)), c.getPointAt(i / N));
    for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    for (const [i, sgn] of [[0, -1], [N, 1]]) { const p = c.getPointAt(i / N), t = fr.tangents[i].clone().multiplyScalar(sgn * rf(i / N) * 0.6), k = pos.length / 3; pos.push(p.x + t.x, p.y + t.y, p.z + t.z); uv.push(0.5, i / N); const base = i * (R + 1); for (let j = 0; j < R; j++) sgn < 0 ? idx.push(k, base + j + 1, base + j) : idx.push(k, base + j, base + j + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return L.mesh(g, mat, 0, 0, 0, { parent, dirt: o.dirt ?? 0.1, dirtH: 0.6 });
  }
  // curve(ctrl, n): a smooth curve through control points, resampled to n + 1 points
  function curve(ctrl, n) { const c = new THREE.CatmullRomCurve3(ctrl.map(V)); return c.getPoints(n).map(p => [p.x, p.y, p.z]); }
  // cone(parent, base, dir, len, rad, mat, o): a spike from base along dir
  function cone(parent, base, dir, len, rad, mat, o = {}) {
    const g = new THREE.ConeGeometry(rad, len, o.seg ?? 8, 1); g.translate(0, len / 2, 0);
    const m = L.mesh(g, mat, base[0], base[1], base[2], { parent, dirt: o.dirt ?? 0.1, dirtH: len });
    m.quaternion.setFromUnitVectors(UP, V(dir).normalize()); return m;
  }
  // frame(fwd, up): a quaternion turning local +x to fwd and local +y as near to up as it can
  function frame(fwd, up) {
    const F = V(fwd).normalize(), S = new THREE.Vector3().crossVectors(F, V(up)).normalize(), U = new THREE.Vector3().crossVectors(S, F);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(F, U, S));
  }

  // ---- claws and teeth: a flattened, tapering blade along local +x that curls down (-y) toward its point.
  // clawGeo(len, w, h, curl): w the half-width at the root (local z), h the half-thickness (local y). Vertex colours run
  // from a dark root to a pale tip.
  function clawGeo(len, w, h, curl = 0.35, root = [0.42, 0.36, 0.32]) {
    const N = 16, R = 12, pos = [], col = [], idx = [];
    const P = (t) => [t * len, -curl * len * t * t, 0];
    for (let i = 0; i <= N; i++) {
      const t = i / N, [x, y] = P(t), [x2, y2] = P(Math.min(1, t + 0.01)), [x1, y1] = P(Math.max(0, t - 0.01));
      const tx = x2 - x1, ty = y2 - y1, tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;     // in-plane normal
      const taper = Math.pow(1 - t, 0.75) * (1 + 0.15 * Math.sin(Math.PI * t)), ww = w * taper + 0.002, hh = h * taper + 0.002;
      const cb = t < 0.25 ? root.map((q, k) => q + (1 - q) * t / 0.25) : [1, 1, 1];
      for (let j = 0; j <= R; j++) {
        const a = j / R * Math.PI * 2, cy = Math.cos(a), sz = Math.sin(a);
        const keel = cy > 0 ? 1 : 0.55;                                 // a domed top, a flatter underside
        pos.push(x + nx * hh * cy * keel, y + ny * hh * cy * keel, ww * sz); col.push(...cb);
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < R; j++) { const a = i * (R + 1) + j, b = a + R + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const k = pos.length / 3; pos.push(-h * 0.5, 0, 0); col.push(...root); for (let j = 0; j < R; j++) idx.push(k, j + 1, j);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // claw(parent, at, fwd, up, len, w, h, mat, curl): one claw placed with its root at `at`
  function claw(parent, at, fwd, up, len, w, h, mat, curl) {
    const m = L.mesh(clawGeo(len, w, h, curl), mat, at[0], at[1], at[2], { parent }); m.quaternion.copy(frame(fwd, up)); return m;
  }

  // ---- gait: four limbs, diagonal pairs (left fore with right hind, then right fore with left hind). f = 0..3 steps a
  // quarter stride; returns [fore/aft -1..1, lift 0..1]. The foot swings forward while lifted.
  function gait(fore, side, f) {
    const grp = (fore ? 0 : 1) ^ (side < 0 ? 0 : 1);
    const ph = f * Math.PI / 2 + Math.PI / 4 + grp * Math.PI;
    return [Math.cos(ph), Math.max(0, -Math.sin(ph))];
  }

  // ---- paddle(parent, len, halfW, thick, skin): a broad, rounded, slightly cupped paddle along local +x (0..len), its back
  // facing local +y, with knuckle ridges near the front. The palm of a forepaw, or (narrow) a hind foot's sole.
  function paddle(parent, len, hw, th, skin, o = {}) {
    const g = new THREE.SphereGeometry(1, 44, 26), p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const front = (v.x + 1) / 2, wide = (o.root ?? 0.72) + (1 - (o.root ?? 0.72)) * Math.sin(Math.min(1, front * 1.3) * Math.PI / 2);
      let y = v.y * (v.y > 0 ? 1 : 0.6) - (o.cup ?? 0.25) * v.z * v.z + (v.y > 0 ? 0.18 * Math.max(0, Math.cos(v.z * 7.8)) * sstep(0.6, 0.92, front) : 0);
      p.setXYZ(i, (v.x * 0.5 + 0.5) * len, y * th, v.z * hw * wide);
      const b = v.y > 0 ? 0.88 + 0.12 * front : 0.55; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    return L.mesh(g, skin, 0, 0, 0, { parent });
  }
  // ---- the spade forepaw: the mole's signature. A fat furred arm from the shoulder (inside the body) out to the wrist,
  // where the fur stops in a cuff; then a huge rounded palm turned outward (its back faces up and leans in toward the
  // body, so from above it reads as a broad paddle), and five broad pale claws fanning forward and out from its front
  // edge, the middle ones longest. On the walk the hands row: forward and out, then back.
  //   forelimb(parent, { side (-1 left/-z, +1 right/+z), f, shoulder [x,y,z], wrist [x,y,z], palm (length), claw (length),
  //     armR (arm radius at the shoulder), stride, lift, skin (palm material), arm (arm material), clawMat, splay (how far
  //     the hand points out from straight ahead, rad), swing (extra splay through the stroke), tilt (back of the hand from
  //     flat, rad), fan (claw fan, rad), clawW (claw breadth factor), curl, droop, plant (feeding: claws dug in, no step) })
  function forelimb(parent, o) {
    const s = o.side, [fa, lift] = o.plant ? [0, 0] : gait(true, s, o.f ?? 0);
    const st = o.stride ?? 0.2, lf = o.lift ?? 0.12, P = o.palm;
    const W = [o.wrist[0] + fa * st, o.wrist[1] + lift * lf, o.wrist[2] + s * (lift * lf * 0.3 + Math.max(0, fa) * st * 0.35)];
    const sw = (o.splay ?? 0.5) + fa * (o.swing ?? 0.14);
    const fwd = [Math.cos(sw), -(o.droop ?? 0.06) + lift * 0.35, s * Math.sin(sw)];
    const tilt = o.tilt ?? 0.45;
    const up = [0, Math.cos(tilt), -s * Math.sin(tilt)];
    // the arm: one fat limb, fur to the wrist, a cuff of fur over the root of the hand
    limb(parent, o.shoulder, W, o.armR, o.armR * 0.78, o.arm, { bulge: 0.3, seg: 18 });
    const H = L.group(W[0], W[1], W[2], 0, parent); H.quaternion.copy(frame(fwd, up));
    seg(H, [0, 0, 0], o.armR * 0.8, o.armR * 0.55, o.armR * 0.8, o.arm, { lump: 0.06, flat: 0.2 });
    paddle(H, P, P * (o.wide ?? 0.48), P * 0.12, o.skin, { root: 0.5 });
    if (o.fringe) for (let k = 0; k < 16; k++) { const a = -1.3 + k / 15 * 2.6; tube(H, [[P * (0.52 + 0.4 * Math.cos(a)), 0, -P * 0.48 * Math.sin(a)], [P * (0.52 + 0.52 * Math.cos(a)), -0.02 * P, -P * 0.62 * Math.sin(a)]], t => 0.014 * P * (1 - t) + 0.002, o.fringe, { n: 3, radial: 4 }); }
    const nC = o.claws ?? 5, fan = o.fan ?? 0.6, CL = o.claw, cw = o.clawW ?? 1;
    for (let k = 0; k < nC; k++) {
      const u = nC === 1 ? 0 : (k / (nC - 1)) * 2 - 1;                             // -1..1 across the hand
      const z = u * P * 0.36, x = P * (0.84 - 0.16 * u * u), len = CL * (1 - 0.2 * u * u) * (u < -0.7 ? 0.8 : 1);
      const a = u * fan * 0.5;
      claw(H, [x, 0.015 * P, z], [Math.cos(a), -0.06, Math.sin(a)], [0, 1, 0], len, P * 0.11 * cw, P * 0.05 * cw, o.clawMat, o.curl ?? 0.25);
    }
    return { wrist: W, hand: H };
  }
  // the hind foot: a short thick leg from the hip (inside the body) to a small narrow foot with five toes and little
  // claws, pointing back and out (moles push with them), tucked in at the rump.
  //   hindlimb(parent, { side, f, hip, foot, len (foot length), r (leg radius), stride, lift, skin, leg, clawMat, out (rad,
  //     how far the foot points out), plant })
  function hindlimb(parent, o) {
    const s = o.side, [fa, lift] = o.plant ? [0, 0] : gait(false, s, o.f ?? 0), st = o.stride ?? 0.2, lf = o.lift ?? 0.12;
    const F = [o.foot[0] + fa * st, o.foot[1] + lift * lf, o.foot[2]];
    limb(parent, o.hip, F, o.r, o.r * 0.75, o.leg, { bulge: 0.35, seg: 16 });
    const out = (o.out ?? 0.5) - fa * 0.12, dir = [-Math.cos(out), -0.04 + lift * 0.35, s * Math.sin(out)];
    const Fq = L.group(F[0], F[1], F[2], 0, parent); Fq.quaternion.copy(frame(dir, [0, 1, 0]));
    const Ln = o.len;
    paddle(Fq, Ln, Ln * 0.32, Ln * 0.12, o.skin, { root: 0.65, cup: 0.1 });
    for (let k = 0; k < 5; k++) {
      const u = k / 4 * 2 - 1, z = u * Ln * 0.21, x = Ln * (0.86 - 0.12 * u * u);
      claw(Fq, [x, 0.01 * Ln, z], [1, -0.15, u * 0.35], [0, 1, 0], Ln * 0.3, Ln * 0.055, Ln * 0.03, o.clawMat, 0.35);
    }
    return { foot: F };
  }
  // the snout: a pointed fleshy nose running forward from the face, a damp nostril pad at its tip, a few whiskers.
  //   snout(parent, { base [x,y,z], tip [x,y,z], r (radius at the base), skin, nostril (true), whisker (material or null),
  //     droop }) -> the tip position
  function snout(parent, o) {
    const B = o.base, T = o.tip, R = o.r, mid = [(B[0] + T[0]) / 2, (B[1] + T[1]) / 2 + R * 0.12, (B[2] + T[2]) / 2];
    tube(parent, [B, mid, T], t => R * (1 - 0.72 * Math.pow(t, 0.9)) * (1 + 0.04 * Math.sin(t * 50)), o.skin, { n: 30, radial: 16, flat: 0.85 });
    if (o.nostril !== false) {
      const pad = seg(parent, [T[0], T[1], T[2]], R * 0.32, R * 0.3, R * 0.36, o.padMat || o.skin, { lump: 0.02 });
      for (const s of [-1, 1]) L.sphere(R * 0.09, plain('#120c0c', 0.5), T[0] + R * 0.26, T[1] + R * 0.04, T[2] + s * R * 0.13, { parent, dirt: 0 });
    }
    if (o.whisker) for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const x = B[0] + (T[0] - B[0]) * (0.45 + k * 0.1), y = B[1] + (T[1] - B[1]) * (0.5 + k * 0.1), z = s * R * (0.55 - k * 0.06);
      tube(parent, [[x, y, z], [x + 0.08 * R * 4, y + 0.02, z + s * R * (0.9 + k * 0.15)], [x - 0.02 + (0.05 + k * 0.03) * R * 4, y - 0.04, z + s * R * (1.7 + k * 0.25)]], t => 0.012 * R * 4 * (1 - t) + 0.003, o.whisker, { n: 8, radial: 4 });
    }
    return T;
  }
  // the tail: a short tapered stub with a few stiff hairs (tail(parent, { base, tip, r, mat, bristle }))
  function tail(parent, o) {
    const B = o.base, T = o.tip, m = [(B[0] + T[0]) / 2, (B[1] + T[1]) / 2 + o.r * 0.6, (B[2] + T[2]) / 2 + (o.bend ?? 0)];
    tube(parent, [B, m, T], t => o.r * (1 - 0.6 * t), o.mat, { n: 16, radial: 10 });
    if (o.bristle) for (let k = 0; k < 6; k++) { const p = curve([B, m, T], 6)[k + 1], a = k * 2.1; tube(parent, [p, [p[0] - o.r * 1.6, p[1] + o.r * 0.8 * Math.cos(a), p[2] + o.r * 1.4 * Math.sin(a)]], t => 0.01 * (1 - t) + 0.003, o.bristle, { n: 3, radial: 4 }); }
  }
  // eyes: tiny black beads half sunk in the fur either side of the face
  function eyes(parent, at, gap, rr) { for (const s of [-1, 1]) { const e = L.sphere(rr, eye(), at[0], at[1], at[2] + s * gap, { parent, dirt: 0 }); e.scale.set(1, 0.7, 0.8); } }

  // ---- Ring Crystal shards: an irregular hexagonal prism with a pointed tip; a glass shell over a glowing core; a torn
  // collar of skin where it breaks out through the hide. base is sunk into the body; dir is the way it grows.
  function shardGeo(len, rad, rs) {
    const body = new THREE.CylinderGeometry(rad * 0.86, rad, len * 0.66, 6, 1); body.translate(0, len * 0.33, 0);
    const tip = new THREE.ConeGeometry(rad * 0.86, len * 0.34, 6, 1); tip.translate(0, len * 0.66 + len * 0.17, 0);
    const g = mergeGeometries([body.toNonIndexed(), tip.toNonIndexed()]);
    const p = g.attributes.position, key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`, off = new Map();
    for (let i = 0; i < p.count; i++) { const k = key(p.getX(i), p.getY(i), p.getZ(i)); if (!off.has(k)) off.set(k, [(rs() - 0.5) * rad * 0.35, (rs() - 0.5) * len * 0.05, (rs() - 0.5) * rad * 0.35]); const d = off.get(k); p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]); }
    g.computeVertexNormals(); return g;
  }
  // shard(parent, base, dir, len, rad, pal, o): one shard. o: { collarMat (a torn ring of skin round its foot), collar: false }
  function shard(parent, base, dir, len, rad, pal, o = {}) {
    const { shell, core } = crystalMats(pal), q = new THREE.Quaternion().setFromUnitVectors(UP, V(dir).normalize());
    const g = shardGeo(len, rad, () => L.rnd()); g.rotateY(L.rnd() * 6.28);
    const m = L.mesh(g, shell, base[0], base[1], base[2], { parent, dirt: 0, cast: true }); m.quaternion.copy(q); m.renderOrder = 2;
    const cg = new THREE.CylinderGeometry(rad * 0.38, rad * 0.5, len * 0.78, 6, 1); cg.translate(0, len * 0.39, 0);
    const c = L.mesh(cg, core, base[0], base[1], base[2], { parent, dirt: 0, cast: false }); c.quaternion.copy(q);
    if (o.collar !== false && o.collarMat) {
      // a ragged lip of skin pushed up round the shard: a short flared ring, notched
      const cl = new THREE.CylinderGeometry(rad * 1.2, rad * 1.85, len * 0.14, 9, 2, true), p = cl.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), k = 1 + 0.18 * Math.sin(a * 5 + base[0] * 7) * (p.getY(i) > 0 ? 1 : 0.2); p.setXYZ(i, p.getX(i) * k, p.getY(i) + (p.getY(i) > 0 ? 0.25 * len * 0.14 * Math.sin(a * 3 + base[2] * 5) : 0), p.getZ(i) * k); }
      cl.translate(0, len * 0.05, 0); cl.computeVertexNormals();
      const k = L.mesh(cl, o.collarMat, base[0], base[1], base[2], { parent, dirt: 0.35, dirtH: len * 0.14 }); k.quaternion.copy(q); k.material.side = THREE.DoubleSide;
    }
    return m;
  }
  // cluster(parent, base, dir, n, len, rad, pal, spread, o): n shards fanning out of one spot, the first the biggest
  function cluster(parent, base, dir, n, len, rad, pal, spread = 0.45, o = {}) {
    const D = V(dir).normalize(), a = new THREE.Vector3().crossVectors(D, Math.abs(D.y) < 0.9 ? UP : new THREE.Vector3(1, 0, 0)).normalize(), b = new THREE.Vector3().crossVectors(D, a);
    for (let i = 0; i < n; i++) {
      const th = (i / n) * 6.283 + L.rnd() * 0.8, s = i === 0 ? 0 : spread * (0.6 + L.rnd() * 0.5);
      const d = D.clone().add(a.clone().multiplyScalar(Math.cos(th) * s)).add(b.clone().multiplyScalar(Math.sin(th) * s)).normalize();
      const k = i === 0 ? 1 : 0.55 + L.rnd() * 0.35;
      const off = rad * (i ? 1.1 : 0), bp = [base[0] + (Math.cos(th) * a.x + Math.sin(th) * b.x) * off, base[1] + (Math.cos(th) * a.y + Math.sin(th) * b.y) * off, base[2] + (Math.cos(th) * a.z + Math.sin(th) * b.z) * off];
      shard(parent, bp, [d.x, d.y, d.z], len * k, rad * (0.7 + 0.3 * k), pal, { ...o, collar: i === 0 && o.collar !== false });
    }
  }
  // onBody(body, x, a, sink): a point on a loft's surface (a: 0 the spine, +-PI/2 the flanks), sunk `sink` inward, and
  // the outward direction there. Use it to seat shards: shard(G, p, mix(n, back), ...)
  function onBody(body, x, a, sink = 0.04) {
    const P = body.surf(x, a), s = body.at(x), c = [x, s.cy, 0];
    const n = new THREE.Vector3(0, (P[1] - c[1]) / Math.max(0.01, s.h * s.h), P[2] / Math.max(0.01, s.w * s.w)).normalize();
    return { p: [P[0] - n.x * sink, P[1] - n.y * sink, P[2] - n.z * sink], n: [n.x, n.y, n.z] };
  }
  // spineShards(parent, body, list, pal, o): shards along the back. list: [[x, a, len, rad, lean], ...] where a is the
  // angle round the body (0 the spine) and lean how far it is swept back (0 upright, 1 lying back at 45 degrees).
  function spineShards(parent, body, list, pal, o = {}) {
    for (const [x, a, len, rad, lean = 0.6, out = 0.5] of list) {
      const { p, n } = onBody(body, x, a, o.sink ?? rad * 0.6);
      const d = [n[0] - lean, n[1], n[2] * (1 + out)];
      shard(parent, p, d, len, rad, pal, { collarMat: o.collarMat, collar: o.collar });
    }
  }
  // scales(parent, body, o): pangolin-like armour, rows of rounded plates laid on the back like roof tiles, their free
  //   edges lifted toward the tail, each row offset by half a plate. o: { x0, x1 (front of the last and first rows), rows,
  //   cols, amax (how far round the flanks, rad), size (plate length), width (plate width / length), mat, lift (rad),
  //   skip (fn(row, col) -> true to leave a gap, e.g. for a shard) }. Returns the plate centres.
  function scales(parent, body, o) {
    const out = [], R = o.rows, Cn = o.cols, Ls = o.size, wk = o.width ?? 0.85;
    for (let i = 0; i < R; i++) {
      const x = o.x1 - (o.x1 - o.x0) * i / Math.max(1, R - 1), odd = i % 2, nc = Cn - odd;
      for (let j = 0; j < nc; j++) {
        if (o.skip && o.skip(i, j)) continue;
        const a = (nc === 1 ? 0 : (j / (nc - 1) * 2 - 1)) * o.amax * (nc / Cn), { p, n } = onBody(body, x, a, Ls * 0.04);
        const S = L.group(p[0], p[1], p[2], 0, parent); S.quaternion.copy(frame([1, 0, 0].map((q, k) => q - n[0] * n[k]), n));
        const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), pp = g.attributes.position, col = new Float32Array(pp.count * 3), v = new THREE.Vector3();
        const tone = 0.8 + 0.4 * L.rnd();
        for (let k = 0; k < pp.count; k++) {
          v.fromBufferAttribute(pp, k);
          // a shield: rounded at the back, the front tucked under the row ahead; a keel down its middle
          const back = Math.max(0, -v.x), keel = 0.25 * Math.exp(-(v.z * v.z) / 0.05);
          pp.setXYZ(k, v.x * Ls * 0.5 - Ls * 0.22, v.y * Ls * 0.11 * (1 + keel) * (0.6 + 0.4 * back), v.z * Ls * 0.5 * wk * (1 - 0.4 * back * back));
          const b = tone * (0.7 + 0.3 * v.y) * (1 - 0.25 * Math.max(0, v.x)); col[k * 3] = b; col[k * 3 + 1] = b; col[k * 3 + 2] = b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
        const m = L.mesh(g, o.mat, 0, 0, 0, { parent: S }); m.rotation.z = -(o.lift ?? 0.22);
        out.push({ p, n, row: i, col: j });
      }
    }
    return out;
  }
  // crustSaddle(parent, body, o): a shell of stone crust grown over the back between x0 and x1, out to angle amax on each
  //   flank, thick in the middle and sinking into the fur at its edges; banded like an armadillo's plates (bands), cracked
  //   along the spine (crack: half-width in radians, 0 for none). o: { x0, x1, amax, thick, bands, crack, mat, colour
  //   (fn(x, a, inCrack) -> [r,g,b]) }. Returns { mesh, top(x, a) -> point on the crust }.
  function crustSaddle(parent, body, o) {
    const NX = 120, NA = 80, x0 = o.x0, x1 = o.x1, A = o.amax, T = o.thick, nb = o.bands ?? 0, cw = o.crack ?? 0;
    const pos = [], col = [], uv = [], idx = [];
    const crackZ = (x) => 0.06 * Math.sin(x * 4.2 + 0.6) + 0.035 * Math.sin(x * 11);
    const off = (x, a) => {
      // the saddle's outline is an oval with a ragged edge; outside it the crust dips under the fur
      const t = (x - x0) / (x1 - x0), Ax = A * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(2 * t - 1), 3)), 0.5) * (1 + 0.12 * nz(x * 3, 1.5, 0.3)) + 1e-3, ea = Math.abs(a) / Ax;
      // thick along the spine, thinning to nothing at the edge so it looks grown out of the hide, not laid on it
      const e2 = ea + 0.06 * nz(x * 9, a * 6, 2), edge = Math.pow(Math.max(0, 1 - e2 * e2), 1.3);
      let k = T * edge * (0.9 + 0.35 * nz(x * 3.2, a * 3.5, 1)) - 0.05;
      if (nb) { const u = (t * nb) % 1, wl = 0.16; k += T * 0.35 * (u < wl ? u / wl - 1 : -Math.pow((u - wl) / (1 - wl), 1.5)) * edge; }
      k += (T * 0.3 * nz(x * 2.4, a * 2, 3) + T * 0.2 * nz(x * 7, a * 6, 1)) * Math.min(1, edge * 2.5);
      let inC = 0;
      if (cw) { const w = cw * Math.max(0, 1 - Math.pow(Math.abs(t - 0.5) / 0.48, 3)) * (1 + 0.3 * nz(x * 5, 2, 0.5)), d = Math.abs(a - crackZ(x)) / Math.max(1e-3, w); if (d < 1) { inC = 1 - d; k -= T * 1.3 * Math.pow(inC, 0.5); } }
      return [k, inC];
    };
    const pt = (x, a) => { const s = body.at(x), [k, inC] = off(x, a), se = (c) => Math.sign(c) * Math.pow(Math.abs(c), 2 / 2.2), ca = Math.cos(a), sa = Math.sin(a);
      const P = [x, s.cy + s.h * se(ca), s.w * se(sa)], n = new THREE.Vector3(0, (P[1] - s.cy) / Math.max(0.01, s.h * s.h), P[2] / Math.max(0.01, s.w * s.w)).normalize();
      return [[P[0], P[1] + n.y * k, P[2] + n.z * k], inC]; };
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NA; j++) {
      const x = x0 + (x1 - x0) * i / NX, a = -A + 2 * A * j / NA, [P, inC] = pt(x, a);
      pos.push(...P); uv.push(x / 1.6, a * 0.8);
      const c = o.colour ? o.colour(x, a, inC) : [1, 1, 1]; col.push(...c);
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1, c = a + 1, d = b + 1; idx.push(a, c, b, c, d, b); }   // outward (up) facing
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = L.mesh(g, o.mat, 0, 0, 0, { parent }); mesh.material.side = THREE.DoubleSide;
    return { mesh, top: (x, a) => pt(x, a)[0], crackZ };
  }

  // ---- cameras
  // camera(W, hero): the top-down sprite camera (orthographic, facing +x, W world units across), toned like robkit.js;
  //   or, with hero = { pos, at, fov }, a perspective presentation shot
  function camera(W, hero) {
    let cam;
    if (hero) { cam = new THREE.PerspectiveCamera(hero.fov ?? 28, 1, 0.5, 200); cam.position.set(...hero.pos); cam.lookAt(...hero.at); }
    else { cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100); cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); }
    cam.updateMatrixWorld(); cam.updateProjectionMatrix(); L.useCamera(cam);
    if (!hero) L.getScene().traverse(o => { if (o.isDirectionalLight) o.intensity *= o.castShadow ? 0.58 : 0.6; if (o.isHemisphereLight) o.intensity *= 0.7; });
    return cam;
  }
  // centre(G, skip): slide G along x so its still parts (everything but the group `skip`, the moving limbs) sit in the
  // middle of the frame; walking frames then never jitter
  function centre(G, skip) {
    G.updateMatrixWorld(true);
    const b = new THREE.Box3(), tmp = new THREE.Box3();
    G.traverse(o => { if (!o.isMesh) return; for (let p = o; p; p = p.parent) if (p === skip) return; tmp.setFromObject(o); b.union(tmp); });
    G.position.x -= (b.min.x + b.max.x) / 2;
  }
  // heroGround(W): a patch of sand for the hero shot (catches the shadow, fades out at the edge)
  function heroGround(W) {
    const n = 512, tex = L.canvasTex(n, (g) => {
      const c = n / 2; g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
      const gr = g.createRadialGradient(c, c, 0, c, c, c); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, '#e0e0e0'); gr.addColorStop(0.42, '#303030'); gr.addColorStop(0.5, '#000000'); gr.addColorStop(1, '#000000');
      g.fillStyle = gr; g.fillRect(0, 0, n, n);
    }, false);
    const m = new THREE.MeshStandardMaterial({ map: L.M.rough('#b39470').map, color: '#ffffff', alphaMap: tex, transparent: true, roughness: 0.95, depthWrite: false });
    const pg = new THREE.PlaneGeometry(W * 2.2, W * 2.2); pg.rotateX(-Math.PI / 2);
    const pm = new THREE.Mesh(pg, m); pm.receiveShadow = true; pm.userData.decal = true; L.getRoot().add(pm);
  }

  return { THREE, TOD, GLOW, NIGHTISH, V, nz, clamp, sstep, furMap, hideMap, crustMap, fur, hide, crust, flesh, keratin, plain, eye, glowMat, dimGlow, crystalMats,
    XTAL, XTAL_WHITE, XTAL_BLOOM, loft, furShells, seg, limb, tube, curve, cone, frame, clawGeo, claw, gait, paddle, forelimb, hindlimb, snout, tail, eyes,
    shardGeo, shard, cluster, onBody, spineShards, scales, crustSaddle, camera, centre, heroGround };
}
