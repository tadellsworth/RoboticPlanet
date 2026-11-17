// The Murmur (LORE.md, "Art brief: the Murmur"): the shared kit for murmur_moles.js. Burrowing mammals built from the
// star-nosed mole and the naked mole-rat: low, heavy, barrel-chested bodies (a mole crossed with a badger) in near-black
// velvet fur dusted with Crystal grit that glints violet; huge spade hands with five long fingers turned outward, a little
// too much like hands; no eyes, and in place of a nose a star of fleshy tendrils that senses charge (gathered while it
// walks, flared open and pulsing when it finds power); eaten Crystal hardened under the skin and split out through the
// shoulders and spine like broken geodes: pale lilac crystal that glows violet when they are full of charge and goes dull
// when they are hungry. Fur, skin, soil and stone only: no shells, mandibles, extra legs, wings or slime.
//   const K = molekit(L);
//   const body = K.loft(G, stations, K.fur('#19161b'));          // a body from cross-sections, tail to nose
//   K.forelimb(GL, { side, f, ... }); K.hindlimb(GL, { side, f, ... });
//   K.muzzle(G, ...); K.star(G, ...); K.tail(G, ...)
//   K.geode(G, ...) / K.geodeOn(G, body, ...); K.shard / K.cluster for loose crystal
//   K.camera(W, hero); K.centre(G, GL)
//   ?charge=0..1 (default 0.75, a raider well fed): how full of charge they are. The crystal glows with it.
// Every function is listed (with its options) in the comment above it.
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function molekit(L) {
  const { THREE } = L;
  const TOD = L.TOD;
  // how strongly the creatures' own lights burn: dim by day, bright at night (the game swaps in the night sprites)
  const GLOW = { day: 0.35, morning: 0.45, evening: 1.15, night: 1.7 }[TOD] ?? 0.35;
  const NIGHTISH = TOD === 'night' || TOD === 'evening';
  // how bright the grit in the fur glints (it catches the light, so it shows most by day)
  const GRIT = { day: 0.75, morning: 0.65, evening: 0.5, night: 0.38 }[TOD] ?? 0.75;
  const CHARGE = Math.max(0, Math.min(1, +(new URLSearchParams(location.search).get('charge') ?? 0.75)));
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

  // grit: chips of eaten Crystal caught in the coat, drawn as a sparse speck map. It lights the specks violet (emissive,
  // so they show on the near-black fur) and makes them smooth (a roughness map), so they glint where the light catches
  // them. gritSpecks(g, n, mode) draws the same specks onto any canvas: mode 'e' white on black, 'r' dark on white.
  function gritSpecks(g, n, mode) {
    const keep = s0; s0 = 4243;
    for (let i = 0; i < 1700; i++) {
      const x = r() * n, y = r() * n, s = 0.7 + r() * 1.5, a = r() * Math.PI, k = r();
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
        const X = x + ox, Y = y + oy; if (X < -5 || X > n + 5 || Y < -5 || Y > n + 5) continue;
        g.save(); g.translate(X, Y); g.rotate(a);
        if (mode === 'e') g.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * k})`; else { const v = Math.round(30 + 70 * (1 - k)); g.fillStyle = `rgb(${v},${v},${v})`; }
        g.beginPath(); g.moveTo(-s, 0); g.lineTo(0, -s * 0.55); g.lineTo(s, 0); g.lineTo(0, s * 0.55); g.closePath(); g.fill(); g.restore();
      }
    }
    s0 = keep;
  }
  const gritMap = L.canvasTex(512, (g, n) => { g.fillStyle = '#000'; g.fillRect(0, 0, n, n); gritSpecks(g, n, 'e'); });
  const gritRough = L.canvasTex(512, (g, n) => { g.fillStyle = '#fff'; g.fillRect(0, 0, n, n); gritSpecks(g, n, 'r'); }, false);

  // ---- materials (all matte: fur and skin never get the clear-coat gloss of chitin)
  const mats = {};
  // fur(hex, o): near-black velvet with the violet grit in it. o: { coarse (the Brute's shaggy coat), sheen 0..1,
  //   sheenColor (the velvet's soft rim light), rough, ns (normal strength), grit (0..1, default 1), gritColor,
  //   emissiveMap + emissive + glow + ek (glowing marks: the Bloom ones' veins; draw the grit into that map too) }
  function fur(hex, o = {}) {
    const key = 'f' + hex + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, map: o.coarse ? coarseMap : furMap, normalMap: o.coarse ? coarseNrm : furNrm, normalScale: new THREE.Vector2(o.ns ?? 0.8, o.ns ?? 0.8),
      roughness: o.rough ?? 0.86, roughnessMap: gritRough, metalness: 0, sheen: o.sheen ?? 1, sheenColor: new THREE.Color(o.sheenColor ?? '#6e6680'), sheenRoughness: o.sheenRough ?? 0.42, vertexColors: true });
    m.envMapIntensity = o.env ?? 0.3;
    const gk = o.grit ?? 1;
    // glowing marks: the brightness rides on the colour and the intensity stays low, so the night point lights lib.js hangs
    // on every glowing part stay soft (a whole glowing coat would otherwise floodlight itself)
    if (o.emissiveMap) { m.emissive = new THREE.Color(o.emissive).multiplyScalar((o.ek ?? 1) * GLOW / 0.08); m.emissiveMap = o.emissiveMap; m.emissiveIntensity = 0.08; m.userData.glow = o.glow; }
    else if (gk > 0) { m.emissive = new THREE.Color(o.gritColor ?? '#9a6cff'); m.emissiveMap = gritMap; m.emissiveIntensity = gk * GRIT; }
    return (mats[key] = m);
  }
  // hide(hex, o): wrinkled naked skin (the muzzle, the Leech's stretched back), matte with a faint sheen. Same options
  //   as fur (no grit).
  function hide(hex, o = {}) {
    const key = 'h' + hex + JSON.stringify(o, (k, v) => (v && v.isTexture ? v.uuid : v)); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, map: hideMap, normalMap: hideNrm, normalScale: new THREE.Vector2(o.ns ?? 0.9, o.ns ?? 0.9),
      roughness: o.rough ?? 0.74, metalness: 0, sheen: o.sheen ?? 0.35, sheenColor: new THREE.Color(o.sheenColor ?? '#9a8c96'), sheenRoughness: 0.55, vertexColors: true });
    m.envMapIntensity = o.env ?? 0.35;
    if (o.emissiveMap) { m.emissive = new THREE.Color(o.emissive); m.emissiveMap = o.emissiveMap; m.emissiveIntensity = (o.ek ?? 1) * GLOW; m.userData.glow = o.glow; }
    return (mats[key] = m);
  }
  // crust(hex, o): stone (the geodes' rind, the Brute's mantle, the Rust ones' ironstone plates, soil). o: { rough, ns, side }
  function crust(hex, o = {}) {
    const key = 'r' + hex + JSON.stringify(o); if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, map: crustMap, normalMap: crustNrm, normalScale: new THREE.Vector2(o.ns ?? 1.1, o.ns ?? 1.1), roughness: o.rough ?? 0.88, metalness: 0.02, vertexColors: true, side: o.side ?? THREE.FrontSide });
    m.envMapIntensity = 0.4; return (mats[key] = m);
  }
  // flesh(hex, o): naked skin (the hands, the star's hub): soft, a little damp, never glossy
  function flesh(hex, o = {}) {
    const key = 'l' + hex + JSON.stringify(o); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: o.rough ?? 0.58, metalness: 0,
      clearcoat: o.cc ?? 0.1, clearcoatRoughness: 0.5, sheen: 0.45, sheenColor: new THREE.Color(o.sheenColor ?? '#c8b8c4'), sheenRoughness: 0.45, vertexColors: true });
    m.envMapIntensity = 0.35; return (mats[key] = m);
  }
  // keratin(hex): nails and teeth. Pale, with a dark root (vertex colours from the claw geometry)
  function keratin(hex = '#d8ccb6', rough = 0.42) {
    const key = 'k' + hex + rough; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: 0, vertexColors: true }); m.envMapIntensity = 0.55; return (mats[key] = m);
  }
  const plain = (hex, rough = 0.6, metal = 0) => { const key = 'p' + hex + rough; if (mats[key]) return mats[key]; const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, vertexColors: true }); m.envMapIntensity = 0.45; return (mats[key] = m); };
  // the glow-pass colour sets how much bloom a part gets: kept low by day so the crystal only shimmers
  function dimGlow(hex, k = 1) { const c = new THREE.Color(hex); c.multiplyScalar(Math.min(1, (NIGHTISH ? 0.1 + GLOW * 0.5 : 0.008 + GLOW * 0.055) * k)); return '#' + c.getHexString(); }
  // glowMat(hex, k, glowHex): a glowing part (charge threads, the Burrow's vein pulses)
  function glowMat(hex, k = 1, glowHex) {
    const key = 'g' + hex + k + glowHex; if (mats[key]) return mats[key];
    const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k * GLOW * 2.2, roughness: 0.4 });
    m.userData.glow = glowHex || dimGlow(hex); return (mats[key] = m);
  }
  // crystalMats(pal): a free-standing crystal point (a geode's spire, a chip in the soil): a glass shell with a brighter
  // core glowing through. pal: { shell, core, glow, opacity, dayCore (how much of the core shows by day), k (brightness) }.
  function crystalMats(pal) {
    const key = 'x' + JSON.stringify(pal); if (mats[key]) return mats[key];
    // brightness rides on the emissive colour, not the intensity, so the night point lights lib.js hangs on every glowing
    // part stay soft and only tint the fur next to the crystal; by day the core is a soft light inside the glass
    const k = pal.k ?? 1, B = k * (NIGHTISH ? 0.3 + GLOW * 1.25 : 0.06 + GLOW * 0.55);
    const shell = new THREE.MeshPhysicalMaterial({ color: pal.shell, emissive: new THREE.Color(pal.core).multiplyScalar(k * (NIGHTISH ? 0.02 + GLOW * 0.32 : 0.01 + GLOW * 0.1)), emissiveIntensity: 1, roughness: 0.22, metalness: 0, flatShading: true,
      clearcoat: 0.6, clearcoatRoughness: 0.1, transparent: true, opacity: pal.opacity ?? 0.8, depthWrite: true, side: THREE.FrontSide, specularIntensity: 0.6 });
    shell.envMapIntensity = 0.55;
    const coreCol = NIGHTISH ? new THREE.Color(pal.core) : new THREE.Color(pal.shell).lerp(new THREE.Color(pal.core), pal.dayCore ?? 0.45);
    const core = new THREE.MeshStandardMaterial({ color: coreCol, emissive: new THREE.Color(pal.core).multiplyScalar(B / 0.3), emissiveIntensity: 0.3, roughness: 0.3, flatShading: true });
    if (k >= 0.12) core.userData.glow = dimGlow(NIGHTISH ? (pal.glow || pal.core) : '#' + new THREE.Color(pal.glow || pal.core).lerp(new THREE.Color(pal.shell), 0.35).getHexString(), k);
    return (mats[key] = { shell, core });
  }
  // the crystal palettes: pale lilac crystal with a violet glow (the brief's palette: near-black fur, violet glow and pale
  // lilac crystal against the robots' clean lights); the White's frosted and dim; the Bloom's deep violet and bright.
  const XTAL = { shell: '#c6b0f2', core: '#a06cff', glow: '#9658ff', opacity: 0.86, dayCore: 0.55 };
  const XTAL_WHITE = { shell: '#eceff5', core: '#c6bdec', glow: '#b3a8e2', opacity: 0.78, k: 0.5, dayCore: 0.35 };
  const XTAL_BLOOM = { shell: '#a982f2', core: '#c06aff', glow: '#b048ff', opacity: 0.68, k: 1.3, dayCore: 0.65 };
  // charged(pal, ch): the palette as full (1) or hungry (0) as the animal is: the glow scales with the charge
  const chargeK = (ch) => 0.03 + 0.97 * Math.pow(ch, 1.5);
  const charged = (pal, ch = CHARGE) => ({ ...pal, k: +((pal.k ?? 1) * chargeK(ch)).toFixed(3) });
  // druseMat(pal, ch): the crystal points lining a geode's hollow: faceted pale lilac, glowing violet with the charge
  function druseMat(pal, ch = CHARGE) {
    const key = 'd' + JSON.stringify(pal) + ch; if (mats[key]) return mats[key];
    const k = (pal.k ?? 1) * chargeK(ch), B = k * (NIGHTISH ? 0.2 + GLOW * 0.7 : 0.1 + GLOW * 0.8);
    const m = new THREE.MeshPhysicalMaterial({ color: pal.shell, emissive: new THREE.Color(pal.core).multiplyScalar(B / 0.3), emissiveIntensity: 0.3, roughness: 0.2, metalness: 0, flatShading: true,
      clearcoat: 0.5, clearcoatRoughness: 0.12, specularIntensity: 0.8, vertexColors: true });
    m.envMapIntensity = 0.6; if (k >= 0.12) m.userData.glow = dimGlow(pal.glow, k * 1.1);   // starved crystal throws no light at all
    return (mats[key] = m);
  }
  // starMat(hex, b): the star's flesh, pale grey-pink; b > 0 when it has found power: lit violet from inside
  function starMat(hex, b = 0) {
    const key = 's' + hex + b.toFixed(2); if (mats[key]) return mats[key];
    const m = new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.5, metalness: 0, clearcoat: 0.15, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#e4c4d4'), sheenRoughness: 0.4, vertexColors: true });
    m.envMapIntensity = 0.35;
    if (b > 0) { m.emissive = new THREE.Color('#b07aff'); m.emissiveIntensity = b * (NIGHTISH ? 0.5 + GLOW * 0.45 : 0.2 + GLOW * 0.9); m.userData.glow = dimGlow('#b07cff', b * 1.5); }
    return (mats[key] = m);
  }

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
  // ---- the spade hand: the Murmur's signature, and the part that should look a little too much like a hand. A fat furred
  // arm from the shoulder (inside the body) to the wrist and a cuff of fur; then a broad, thick palm of naked skin turned
  // outward (the back of the hand faces up and in toward the body, so the palm faces down and out, like a mole's), four
  // long fingers fanned across its front edge and a shorter thumb on the inner side, each finger knuckled at two joints
  // and tipped with a heavy digging nail. On the walk the hands row: forward and out, then back.
  //   forelimb(parent, { side (-1 left/-z, +1 right/+z), f, shoulder [x,y,z], wrist [x,y,z], hand (length, wrist to the
  //     fingertips), armR (arm radius at the shoulder), stride, lift, skin (hand material), arm (arm material), nailMat,
  //     splay (how far the hand points out from straight ahead, rad), swing (extra splay through the stroke), tilt (the
  //     back of the hand from flat, rad), fan (finger fan, rad), finger (finger length / hand length, 0.54), wide (palm
  //     half-width / hand length, 0.25), thick (palm thickness / hand length, 0.085), nail (nail length / hand length,
  //     0.17), fat (finger thickness factor), curl (bend at each joint, rad), droop, plant (feeding or bracing: no step,
  //     the fingers dug in) }) -> { wrist, hand (the hand's group: +x along the hand, +y its back) }
  function forelimb(parent, o) {
    const s = o.side, [fa, lift] = o.plant ? [0, 0] : gait(true, s, o.f ?? 0);
    const st = o.stride ?? 0.2, lf = o.lift ?? 0.12, P = o.hand;
    const W = [o.wrist[0] + fa * st, o.wrist[1] + lift * lf, o.wrist[2] + s * (lift * lf * 0.3 + Math.max(0, fa) * st * 0.35)];
    const sw = (o.splay ?? 0.5) + fa * (o.swing ?? 0.14);
    const fwd = [Math.cos(sw), -(o.droop ?? 0.06) + lift * 0.35, s * Math.sin(sw)];
    const tilt = o.tilt ?? 0.45, up = [0, Math.cos(tilt), -s * Math.sin(tilt)];
    limb(parent, o.shoulder, W, o.armR, o.armR * 0.78, o.arm, { bulge: 0.3, seg: 18 });
    const H = L.group(W[0], W[1], W[2], 0, parent); H.quaternion.copy(frame(fwd, up));
    seg(H, [0, 0, 0], o.armR * 0.8, o.armR * 0.55, o.armR * 0.8, o.arm, { lump: 0.06, flat: 0.2 });
    const PL = P * 0.46, PW = P * (o.wide ?? 0.25), FL = P * (o.finger ?? 0.54), curl = o.curl ?? 0.2, fan = o.fan ?? 0.34, NL = P * (o.nail ?? 0.17);
    paddle(H, PL, PW, P * (o.thick ?? 0.085), o.skin, { root: 0.74, cup: 0.12 });
    const r0 = P * 0.05 * (o.fat ?? 1);
    // one finger: three bones, each bent down a little more at its joint; a bulge at each knuckle; a nail on the tip
    const digit = (base, yaw, len, rad, bends) => {
      const segs = [0.42, 0.33, 0.25], dir = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
      let pitch = 0, p = V(base); const pts = [p.clone()];
      for (let j = 0; j < 3; j++) { pitch += bends[j]; const d = dir.clone().multiplyScalar(Math.cos(pitch)); d.y = -Math.sin(pitch); const q = p.clone().addScaledVector(d, len * segs[j]); pts.push(p.clone().lerp(q, 0.5), q); p = q; }
      const rf = (t) => rad * (1 - 0.36 * t) * (1 + 0.17 * Math.exp(-(((t - 0.42) / 0.06) ** 2)) + 0.13 * Math.exp(-(((t - 0.75) / 0.06) ** 2)));
      tube(H, pts.map(q => [q.x, q.y, q.z]), rf, o.skin, { n: 26, radial: 10, dirt: 0.04 });
      const a = pts[5], b = pts[6], d = b.clone().sub(a).normalize();
      claw(H, [b.x - d.x * rad * 1.0, b.y - d.y * rad + rad * 0.3, b.z - d.z * rad * 1.0], [d.x, d.y, d.z], [0, 1, 0], NL * Math.sqrt(len / FL), rad * 0.82, rad * 0.4, o.nailMat, 0.3);
    };
    const bends = o.plant ? [curl * 1.3, curl * 1.9, curl * 1.5] : [curl * 0.45, curl, curl * 0.8];
    // the four fingers: [across the hand (-1 the inner edge, toward the body; +1 the outer), length, thickness, set back]
    for (const [u, lk, rk, back] of [[-0.68, 0.9, 1, 0.03], [-0.23, 1, 1, 0], [0.23, 0.95, 0.95, 0.015], [0.68, 0.78, 0.86, 0.07]]) {
      const z = s * u * PW * 0.8, x = PL * (0.95 - back);
      digit([x - r0 * 0.8, P * 0.012, z], s * u * fan * 0.5, FL * lk, r0 * rk, bends);
    }
    // the thumb: shorter and thicker, from the inner edge of the palm, pointing forward and in
    digit([PL * 0.5, -P * 0.004, -s * PW * 0.86], -s * 0.6, FL * 0.6, r0 * 1.1, bends.map(b => b * 0.8));
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
  // ---- the face. No eyes. A short, thick, naked muzzle, and on its end, in place of a nose, the star.
  // muzzle(parent, { base, tip, r, skin }): wrinkled skin, thickest where the fur stops; returns the tip
  function muzzle(parent, o) {
    const B = o.base, T = o.tip, R = o.r, mid = [(B[0] + T[0]) / 2, (B[1] + T[1]) / 2 + R * 0.08, (B[2] + T[2]) / 2];
    tube(parent, [B, mid, T], t => R * (1 - 0.32 * t) * (1 + 0.05 * Math.sin(t * 40)), o.skin, { n: 22, radial: 16, flat: o.flat ?? 0.85 });
    return T;
  }
  // star(parent, o): the star of tendrils that senses electricity, the star-nosed mole's: 22 fleshy rays round a hub, the
  //   two under the hub short. o: { at [x,y,z], dir (the way it faces), r0 (hub radius), len (ray length), n (22),
  //   open (0 gathered shut into a pointed bud, 0.5 relaxed, 1 flared wide open with the tips hooked forward, gripping),
  //   glow (0 dark .. 1 it has found power: lit violet from inside, the light pulsing round the rays), phase (where the
  //   pulse is), skin (ray colour), hub (hub colour), seed } -> the star's group (+x the way it faces)
  function star(parent, o) {
    const n = o.n ?? 22, r0 = o.r0, len = o.len, op = o.open ?? 0.5, gl = o.glow ?? 0, skin = o.skin ?? '#b38f9a', sd = o.seed ?? 1;
    const D = L.group(o.at[0], o.at[1], o.at[2], 0, parent); D.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), V(o.dir).normalize());
    seg(D, [-r0 * 0.2, 0, 0], r0 * 0.62, r0 * 1.06, r0 * 1.06, starMat(o.hub ?? '#80606a', gl > 0 ? Math.min(1, gl * 1.2) : 0), { lump: 0.05, flat: 0 });
    const rr = Math.max(len * 0.1, r0 * 0.24);
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const short = Math.abs(sa) < 0.2 && ca < 0 ? 0.55 : 1;
      const l = len * short * (0.9 + 0.2 * Math.abs(Math.sin(k * 2.3 + sd)));
      const pts = [];
      for (const t of [0, 0.3, 0.65, 1]) {
        const Xc = l * t * 0.9, Rc = r0 * (1 - 0.82 * t);                       // shut: the rays meet in a point ahead
        const Xf = l * (0.04 * t + 0.32 * t * t * t), Rf = r0 + l * t * 0.94;   // flared: straight out, the tips hooked forward
        const X = Xc + (Xf - Xc) * op, Rr = Rc + (Rf - Rc) * op;
        pts.push([X + 0.03 * l * Math.sin(k * 1.7 + sd) * t, ca * Rr, sa * Rr]);
      }
      const pulse = gl > 0 ? gl * (0.4 + 0.6 * Math.pow(0.5 + 0.5 * Math.cos(a * 2 - (o.phase ?? 0.6)), 2)) : 0, b = Math.round(pulse * 4) / 4;
      tube(D, pts, t => rr * (1 - 0.55 * t) + rr * 0.12, starMat(skin, b), { n: 12, radial: 7, dirt: 0 });
      const e = pts[3]; L.sphere(rr * 0.72, starMat(skin, gl > 0 ? Math.min(1, b + 0.35) : 0), e[0], e[1], e[2], { parent: D, dirt: 0, cast: false });
    }
    return D;
  }
  // the tail: a short blunt stub of fur (or with a few stiff hairs) (tail(parent, { base, tip, r, mat, bristle }))
  function tail(parent, o) {
    const B = o.base, T = o.tip, m = [(B[0] + T[0]) / 2, (B[1] + T[1]) / 2 + o.r * 0.6, (B[2] + T[2]) / 2 + (o.bend ?? 0)];
    tube(parent, [B, m, T], t => o.r * (1 - 0.35 * t), o.mat, { n: 16, radial: 10 });   // a blunt stub
    if (o.bristle) for (let k = 0; k < 6; k++) { const p = curve([B, m, T], 6)[k + 1], a = k * 2.1; tube(parent, [p, [p[0] - o.r * 1.6, p[1] + o.r * 0.8 * Math.cos(a), p[2] + o.r * 1.4 * Math.sin(a)]], t => 0.01 * (1 - t) + 0.003, o.bristle, { n: 3, radial: 4 }); }
  }
  // ---- geodes: eaten Crystal hardened under the skin and split out through it like a broken geode. A rough stone rind
  // (grey outside, banded pale agate where it broke), its hollow lined with crystal points that glow violet with the
  // animal's charge (bright when full, dull when hungry); the biggest stand up out of the break as spires.
  //   geode(parent, at, dir, r, pal, o): at is the point on the skin it breaks through, dir the way it faces, r its size.
  //   o: { sx (stretched along the body, for a seam down the spine), hk (height / r), open (how wide the break is, rad),
  //     th (rind thickness / r), sink (how deep the stone sits under the skin), fwd (the body's forward, default +x),
  //     n (crystal points), spires (how many tall points stand out of it), spireLen, spireLean (swept back),
  //     charge (0..1, default ?charge), collarMat (a torn lip of fur or skin round it), seed } -> its group (+y out)
  function geode(parent, at, dir, r, pal, o = {}) {
    const sx = o.sx ?? 1, hk = o.hk ?? 1, open = o.open ?? 0.72, th = o.th ?? 0.24, ch = o.charge ?? CHARGE, sd = o.seed ?? (at[0] * 7.1 + at[2] * 13.3 + at[1] * 3.7);
    const D = V(dir).normalize(), F = V(o.fwd ?? [1, 0, 0]); F.addScaledVector(D, -F.dot(D)); if (F.lengthSq() < 1e-6) F.set(0, 0, 1); F.normalize();
    const sink = o.sink ?? r * 0.3;
    // the hollow's floor sits above the skin and the fur (or the body would fill it), so the crystal fills the break
    const floor = o.floor ?? sink + Math.max(0.15 * r, o.furLen ?? 0.055);
    const Gq = L.group(at[0] - D.x * sink, at[1] - D.y * sink, at[2] - D.z * sink, 0, parent); Gq.quaternion.copy(frame(F, D));
    const lump = (t, ph) => 1 + 0.14 * nz(Math.sin(t) * Math.cos(ph) * 2.4 + sd, Math.cos(t) * 2.4, Math.sin(t) * Math.sin(ph) * 2.4) + 0.05 * nz(Math.sin(t) * Math.cos(ph) * 7, Math.cos(t) * 7 + sd, Math.sin(t) * Math.sin(ph) * 7);
    const P = (t, ph, k) => { const q = lump(t, ph) * k, y = Math.cos(t) * r * hk * q; return [Math.sin(t) * Math.cos(ph) * r * sx * q, k < 0.99 ? Math.max(y, floor) : y, Math.sin(t) * Math.sin(ph) * r * q]; };
    // the break: a jagged, uneven edge, one side broken lower than the other
    const brk = (ph) => open * (1 + 0.16 * Math.cos(ph - sd) + 0.2 * Math.abs(Math.sin(ph * 3 + sd)) - 0.1 + 0.14 * Math.sin(ph * 7 + sd * 1.7) + 0.1 * Math.sin(ph * 13 + sd) + 0.12 * nz(Math.cos(ph) * 3, sd, Math.sin(ph) * 3));
    // the rind as rings from the bottom of the stone up its outside to the break, across the broken edge, and down the hollow
    const NPH = 44, NO = 9, NI = 7, rows = [];
    for (let i = 0; i <= NO; i++) rows.push((tb) => [Math.PI + (tb - Math.PI) * i / NO, 1, 0]);
    rows.push((tb) => [tb + 0.02, 1 - th * 0.4, 1]);
    rows.push((tb) => [tb + 0.035, 1 - th * 0.8, 2]);
    for (let i = 0; i <= NI; i++) rows.push((tb) => [tb + 0.06 + (Math.PI - tb - 0.06) * i / NI, 1 - th, 3]);
    const pos = [], col = [], uv = [], idx = [];
    const stone = [0.11, 0.1, 0.11], stoneL = [0.24, 0.215, 0.23], band = [0.95, 0.93, 1.05], lilac = [0.62, 0.52, 0.95], hollow = [0.6, 0.48, 0.98];
    for (const row of rows) for (let j = 0; j <= NPH; j++) {
      const ph = j / NPH * Math.PI * 2, tb = brk(ph), [t, k, kind] = row(tb);
      pos.push(...P(t, ph, k)); uv.push(j / NPH * 2 * sx, t * 0.8);
      let c;
      if (kind === 0) { const v = 0.5 + 0.5 * nz(Math.cos(ph) * 4 + sd, t * 3, Math.sin(ph) * 4); c = stone.map((q, m) => q + (stoneL[m] - q) * v); }
      else if (kind === 1) c = band; else if (kind === 2) c = lilac;
      else { const deep = (t - tb) / Math.max(0.01, Math.PI - tb); c = hollow.map(q => q * (1 - 0.35 * deep)); }
      col.push(...c);
    }
    const W = NPH + 1;
    for (let ri = 0; ri < rows.length - 1; ri++) for (let j = 0; j < NPH; j++) { const a = ri * W + j, b = a + W; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    L.mesh(g, crust('#ffffff', { side: THREE.DoubleSide, rough: 0.9 }), 0, 0, 0, { parent: Gq });
    // the crystal lining the hollow: small faceted points growing in from the walls, toward the middle and up
    const n = o.n ?? Math.round(24 + 150 * r * Math.sqrt(sx)), geos = [];
    for (let i = 0; i < n; i++) {
      const ph = L.rnd() * Math.PI * 2, tb = brk(ph), t = tb + 0.08 + Math.pow(L.rnd(), 0.7) * (Math.PI * 0.92 - tb - 0.08);
      const p = new THREE.Vector3(...P(t, ph, 1 - th));
      const d = new THREE.Vector3(-p.x / sx, 0, -p.z).normalize().multiplyScalar(0.55).add(new THREE.Vector3((L.rnd() - 0.5) * 0.6, 0.7 + L.rnd() * 0.6, (L.rnd() - 0.5) * 0.6)).normalize();
      const len = r * (0.22 + 0.3 * L.rnd()) * (1 - 0.25 * (t - tb) / (Math.PI - tb)), rad = len * (0.24 + 0.1 * L.rnd());
      const cg = new THREE.ConeGeometry(rad, len, 5, 1); cg.translate(0, len / 2, 0);
      const cp = cg.attributes.position, cc = new Float32Array(cp.count * 3);
      for (let k = 0; k < cp.count; k++) { const b = 0.6 + 0.4 * cp.getY(k) / len; cc[k * 3] = cc[k * 3 + 1] = cc[k * 3 + 2] = b; }
      cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d)); cg.translate(p.x - d.x * len * 0.15, p.y - d.y * len * 0.15, p.z - d.z * len * 0.15);
      geos.push(cg.toNonIndexed());
    }
    if (geos.length) L.mesh(mergeGeometries(geos), druseMat(pal, ch), 0, 0, 0, { parent: Gq, dirt: 0 }).receiveShadow = false;   // lit by its own light, never lost in the rind's shadow
    // spires: the biggest points, standing up out of the break
    const cpal = charged(pal, ch);
    for (let i = 0; i < (o.spires ?? 0); i++) {
      const a = i * 2.4 + sd, off = i ? r * 0.28 : 0, lean = o.spireLean ?? 0;
      shard(Gq, [Math.cos(a) * off * sx, -r * hk * 0.25, Math.sin(a) * off], [Math.cos(a) * (i ? 0.4 : 0.12) - lean, 1, Math.sin(a) * (i ? 0.4 : 0.12)],
        r * (i ? 0.85 + 0.35 * L.rnd() : 1.5) * (o.spireLen ?? 1), r * (i ? 0.17 : 0.24), cpal, { collar: false });
    }
    // a torn lip of fur pushed up round the stone where it broke out
    if (o.collarMat) {
      const R1 = r * 0.98, R2 = r * 1.18, hh = r * 0.22, cl = new THREE.CylinderGeometry(R1, R2, hh, 30, 2, true), p = cl.attributes.position;
      for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), top = p.getY(i) > 0, k = 1 + 0.12 * Math.sin(a * 5 + sd) * (top ? 1 : 0.3); p.setXYZ(i, p.getX(i) * k * sx, p.getY(i) + (top ? hh * 0.3 * Math.sin(a * 4 + sd * 2) : 0), p.getZ(i) * k); }
      cl.computeVertexNormals();
      const cm = o.collarMat.clone(); cm.side = THREE.DoubleSide;
      L.mesh(cl, cm, 0, sink - hh * 0.75, 0, { parent: Gq, dirt: 0.3, dirtH: hh });
    }
    return Gq;
  }
  // geodeOn(parent, body, x, a, r, pal, o): a geode breaking out of a loft at (x, a) (a: 0 the spine, +-PI/2 the flanks).
  //   o as geode, plus up (how far it turns from the skin's normal toward straight up, 0..1) and lean (swept back)
  function geodeOn(parent, body, x, a, r, pal, o = {}) {
    const { p, n } = onBody(body, x, a, 0);
    const u = o.up ?? 0.25, d = [n[0] * (1 - u) - (o.lean ?? 0), n[1] * (1 - u) + u, n[2] * (1 - u)];
    return geode(parent, p, d, r, pal, o);
  }

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
  //   (fn(x, a, inCrack) -> [r,g,b]), crackDepth (how deep the crack goes / thick, 1.3) }. Returns { mesh, top(x, a) -> point
  //   on the crust }.
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
      if (cw) { const w = cw * Math.max(0, 1 - Math.pow(Math.abs(t - 0.5) / 0.48, 3)) * (1 + 0.3 * nz(x * 5, 2, 0.5)), d = Math.abs(a - crackZ(x)) / Math.max(1e-3, w); if (d < 1) { inC = 1 - d; k -= T * (o.crackDepth ?? 1.3) * Math.pow(inC, 0.5); } }
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

  return { THREE, TOD, GLOW, NIGHTISH, CHARGE, V, nz, clamp, sstep, furMap, hideMap, crustMap, gritSpecks, fur, hide, crust, flesh, keratin, plain, glowMat, dimGlow,
    crystalMats, druseMat, starMat, charged, chargeK, XTAL, XTAL_WHITE, XTAL_BLOOM, loft, furShells, seg, limb, tube, curve, cone, frame, clawGeo, claw, gait, paddle,
    forelimb, hindlimb, muzzle, star, tail, shardGeo, shard, cluster, onBody, spineShards, geode, geodeOn, scales, crustSaddle, camera, centre, heroGround };
}
