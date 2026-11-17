// The Hollow (LORE.md, "The Hollow: the Murmur's lair") and the Murmur's tunnel exits, in the buildings' 57° view and
// the Murmur kit's materials (murmur_moleskit.js), so they sit with the Burrows (nest-1..3) and the Deep's mound
// (murmur_moles.js c=burrow&s=4). Always rendered with ?tod=night for the Hollow pieces: it is always night down there.
//   ?c=exit          a tunnel exit: a burrow mouth smaller than nest-1, soil heaved round a dark throat, the Bloom's
//                    root-veins breaking through the rim and running down into it (glowing at night). One version for
//                    every biome: the soil is thrown up from below, as the Burrows' is. ?state=collapsed: caved in by a
//                    warbot, the throat filled with rubble and loose soil, the veins torn and dark.
//   ?c=veins         a Bloom-vein node, the Hollow's Fiber: thick root-veins arching out of the floor round a swollen,
//                    pulsing bulb, lit violet. Harvesting it draws the Murmur.
//   ?c=floater       a floating Crystal mass: a raft of crystal-crusted stone (flat on top, so stations and taps can stand
//                    on it), ringed and bearded underneath with pale lilac Ring Crystal that glows, roots trailing into
//                    the chasm below and a few still tethered up into the dark.
//   ?c=pillar&v=1|2  a stone pillar rising into the dark, worn smooth in a spiral too regular to be natural; the Bloom's
//                    veins climb its grooves. v=2 a slimmer one with a five-start twist.
//   ?c=chamber       a side chamber's floor: robot parts laid out in rows (batteries, Chips, sensor heads, wheels, arms),
//                    sorted by size, from every colony. Drag marks lead in.
// Framing: exit and veins use the buildings' camera (the game's B3D, 1.4 tiles, anchor [0.5, 0.615]); floater, pillar
// and chamber frame a wider square (frameCompoundOpts), so their canvas covers more tiles: see HOLLOW_ART in
// renderer/preview/hollow_specs.json for the scale and anchor of each.
import { molekit } from './murmur_moleskit.js';

const P = new URLSearchParams(location.search);
const C = P.get('c') || 'exit';
const SIZES = { exit: 512, veins: 512, floater: 1536, pillar: 1024, chamber: 1024 };
export const config = { pad: false, size: SIZES[C] || 1024 };

export default function (L) {
  const K = molekit(L);
  L.seed({ exit: 9100, veins: 9200, floater: 9300, pillar: 9400, chamber: 9500 }[C] + (+(P.get('v') || 1)));
  if (C === 'exit') return exit(L, K, P.get('state') || 'open');
  if (C === 'veins') return veins(L, K);
  if (C === 'floater') { L.frameCompoundOpts({ half: 18, width: 0.74, cy: 0.4 }); return floater(L, K); }
  if (C === 'pillar') { L.frameCompoundOpts({ half: 8, width: 0.4, cy: 0.8 }); return pillar(L, K, +(P.get('v') || 1)); }
  if (C === 'chamber') { L.frameCompoundOpts({ half: 15, width: 0.94, cy: 0.52 }); return chamber(L, K); }
}

// ---------------------------------------------------------------------------------------------------------------
// shared bits
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mixc = (p, q, t) => p.map((v, k) => v + (q[k] - v) * Math.max(0, Math.min(1, t)));

// a lump of soil or stone (the Burrow's clods)
function clodGeo(L, K, s, k, sq = 0.7) {
  const { THREE } = K, g = new THREE.DodecahedronGeometry(1, 1), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = 1 + 0.3 * K.nz(p.getX(i) * 2 + k, p.getY(i) * 2, p.getZ(i) * 2); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * q); }
  g.scale(s, s * sq, s * (0.8 + 0.4 * L.rnd())); g.computeVertexNormals(); return g;
}
// a polar heightfield round the origin: h(r, a) and colour c(r, a, h) -> [r, g, b]
function polarField(L, K, rmax, h, c, mat, o = {}) {
  const { THREE } = K, NR = o.nr ?? 64, NA = o.na ?? 128, pos = [], col = [], idx = [];
  for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
    const a = i / NA * Math.PI * 2, r = 0.02 + (j / NR) * (rmax - 0.02), y = h(r, a);
    pos.push(Math.cos(a) * r, y, Math.sin(a) * r); col.push(...c(r, a, y));
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, cc = a + NA + 1, d = cc + 1; idx.push(a, b, cc, b, d, cc); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 2.5, pos[k + 2] / 2.5); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return L.mesh(g, mat, 0, 0, 0, o.parent ? { parent: o.parent } : {});
}
// a soft dark stain on the ground under a piece (fades into whatever ground it sits on)
function stain(L, K, R, rgb = [60, 48, 40], a0 = 0.75, hole = 0) {
  const { THREE } = K, n = 512;
  const tex = L.canvasTex(n, (g) => {
    const c = n / 2, img = g.createImageData(n, n), D = img.data;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = (x - c) / c, dy = (y - c) / c, rr = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
      const edge = 0.9 + 0.06 * K.nz(Math.cos(a) * 1.8, 0.2, Math.sin(a) * 1.8) + 0.03 * Math.sin(a * 9);
      const al = Math.min(1, Math.max(0, (edge - rr) / 0.25)) * a0 * (hole ? Math.min(1, Math.max(0, (rr - hole) / 0.04)) : 1), speck = K.nz(dx * 40, 7, dy * 40) > 0.55 ? 1.3 : 1;
      const i4 = (y * n + x) * 4; D[i4] = rgb[0] * speck; D[i4 + 1] = rgb[1] * speck; D[i4 + 2] = rgb[2] * speck; D[i4 + 3] = Math.round(al * 255);
    }
    g.putImageData(img, 0, 0);
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.95, depthWrite: false });
  const pg = new THREE.PlaneGeometry(R * 2, R * 2); pg.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(pg, m); pm.position.set(0, 0.005, 0); pm.receiveShadow = true; pm.userData.decal = true; L.getRoot().add(pm);
  return pm;
}
// the Bloom's root-vein material: dark and fleshy, lit violet from inside (as on the Burrows)
function veinMats(K, k = 1) {
  const { THREE } = K;
  const veinM = new THREE.MeshStandardMaterial({ color: '#3c2450', emissive: new THREE.Color('#8a3cff').multiplyScalar((K.NIGHTISH ? 0.35 + K.GLOW * 0.4 : 0.06 + K.GLOW * 0.3) * k), roughness: 0.7 });
  veinM.userData.glow = K.dimGlow('#9a4cff', 1.2 * k);
  const pulseM = K.glowMat('#d8b8ff', 1.1 * k, K.dimGlow('#b070ff', 2.6 * k));
  return { veinM, pulseM };
}

// ---------------------------------------------------------------------------------------------------------------
// TUNNEL EXIT. The mouth of a Murmur tunnel where it breaks the surface: smaller than nest-1 (about half a tile), no
// spires and no star: just heaved soil, a dark throat, and the Bloom's veins running down into it.
function exit(L, K, state) {
  const { THREE } = K, collapsed = state === 'collapsed';
  const RM = 2.6;
  // profile: an open throat dropping away inside a low rim of thrown-up soil; caved in, a shallow dish of rubble
  const prof = collapsed ? [[0, -0.32], [0.6, -0.26], [1.3, -0.05], [1.8, 0.2], [2.2, 0.12], [2.6, -0.02]]
    : [[0, -2.6], [0.45, -2.1], [0.85, -0.7], [1.1, 0.25], [1.35, 0.62], [1.7, 0.58], [2.1, 0.3], [2.6, -0.03]];
  const hP = (r) => { for (let i = 1; i < prof.length; i++) if (r <= prof[i][0]) { const [r0, h0] = prof[i - 1], [r1, h1] = prof[i], t = (r - r0) / (r1 - r0), s = t * t * (3 - 2 * t); return h0 + (h1 - h0) * s; } return prof[prof.length - 1][1]; };
  const soilM = K.crust('#ffffff', { rough: 0.95, ns: 0.8 });
  const fresh = [0.11, 0.085, 0.065], dry = [0.24, 0.19, 0.15], throat = [0.085, 0.07, 0.09], deep = [0.008, 0.006, 0.012];
  stain(L, K, 4.2, [62, 50, 42], 0.7, collapsed ? 0 : 1.0 / 4.2);
  polarField(L, K, RM, (r, a) => {
    const wob = 1 + 0.12 * K.nz(Math.cos(a) * 1.6, 0.4, Math.sin(a) * 1.6);
    let y = hP(r / wob);
    if (r > 0.9) y += 0.08 * K.nz(Math.cos(a) * r * 3, 2, Math.sin(a) * r * 3);
    return y;
  }, (r, a, y) => {
    let c = r > 1.2 ? mixc(fresh, dry, (r - 1.9) / 0.7) : collapsed ? mixc([0.13, 0.1, 0.08], fresh, r / 1.2) : mixc(deep, throat, (r - 0.3) / 0.8);
    const nn = 0.8 + 0.3 * K.nz(Math.cos(a) * r * 3, 5, Math.sin(a) * r * 3); return c.map(v => v * nn * 1.35);
  }, soilM, { nr: 48, na: 96 });
  // clods thrown out round it, more on one side (the way the tunnel came up)
  const clodM = [K.crust('#3e3026', { rough: 0.97 }), K.crust('#33271f', { rough: 0.97 }), K.crust('#4a3a2e', { rough: 0.97 })];
  const N = collapsed ? 90 : 150;
  for (let i = 0; i < N; i++) {
    const a = L.rnd() * Math.PI * 2, r = 1.0 + Math.pow(L.rnd(), 1.2) * 2.4 * (1 + 0.35 * Math.cos(a - 2.6)), s = 0.04 + Math.pow(L.rnd(), 2.2) * 0.16;
    if (r > 3.6) continue;
    L.mesh(clodGeo(L, K, s, i), clodM[i % 3], Math.cos(a) * r, hP(r) + s * 0.1, Math.sin(a) * r, { dirt: 0.1, dirtH: s, ry: L.rnd() * 6.28 });
  }
  if (collapsed) {
    // the cave-in: broken lumps of the rim tumbled into the throat, and a few stones of the ground above
    const stoneM = K.crust('#5c5650', { rough: 0.9 });
    for (let i = 0; i < 26; i++) {
      const a = L.rnd() * Math.PI * 2, r = Math.pow(L.rnd(), 0.8) * 1.3, s = 0.12 + L.rnd() * 0.22;
      L.mesh(clodGeo(L, K, s, i + 300, 0.6), i % 4 ? clodM[i % 3] : stoneM, Math.cos(a) * r, hP(r) + s * 0.25, Math.sin(a) * r, { dirt: 0.15, dirtH: s, ry: L.rnd() * 6.28 });
    }
  }
  // the Bloom's root-veins, breaking through the soil and running over the rim into the throat (torn and dark when it
  // has caved in); a pulse of light in each, running down
  const { veinM, pulseM } = veinMats(K, collapsed ? 0 : 0.6);
  const deadM = K.crust('#2a1e30', { rough: 0.8 });
  const vs = [[2.4, 0.04], [0.9, -0.05], [4.3, 0.06], [5.5, -0.03]];
  vs.forEach(([a0, bend], k) => {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6, r = 3.3 - t * (collapsed ? 1.4 : 3.0), a = a0 + bend * Math.sin(t * 4 + k) + 0.12 * t; pts.push([Math.cos(a) * r, hP(r) + 0.03, Math.sin(a) * r]); }
    if (collapsed) { K.tube(null, pts.slice(0, 4), t => 0.06 * (1 - 0.4 * t) + 0.015, deadM, { n: 40, radial: 7, dirt: 0 }); return; }
    K.tube(null, pts, t => 0.06 * (1 - 0.55 * t) + 0.012, veinM, { n: 60, radial: 7, dirt: 0 });
    const c = K.curve(pts, 40), p = c[22 + k * 3], q = c[24 + k * 3];
    const m = K.seg(null, p, 0.07, 0.035, 0.035, pulseM, { lump: 0 }); m.rotation.y = -Math.atan2(q[2] - p[2], q[0] - p[0]);
  });
  // a few chips of Crystal kicked up with the soil, and down in the throat the faint violet of the network below
  for (let i = 0; i < (collapsed ? 2 : 4); i++) { const a = L.rnd() * 6.28, r = 1.5 + L.rnd() * 1.2; K.shard(null, [Math.cos(a) * r, hP(r) - 0.02, Math.sin(a) * r], [L.rnd() - 0.5, 0.6, L.rnd() - 0.5], 0.22 + L.rnd() * 0.12, 0.06, K.XTAL, { collar: false }); }
  if (!collapsed) {
    L.mesh(new THREE.CircleGeometry(0.35, 20).rotateX(-Math.PI / 2), K.glowMat('#9c6cff', 0.6, K.dimGlow('#8a4cff', 1.0)), 0, -2.5, 0, { cast: false, dirt: 0 });
    L.pointLight('#9a70ff', 0.6 + K.GLOW * 2.2, 0, -1.6, 0, 2.6);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// BLOOM VEINS: the Hollow's Fiber. Not Crystal (no hexagonal points) and not a plant: a knot of the Bloom's own root-veins
// surfacing round a swollen bulb, where the charge the Murmur drain collects on its way down. Bright, so it reads as
// something to harvest from across the dark.
function veins(L, K) {
  const { THREE } = K;
  stain(L, K, 5.0, [48, 38, 56], 0.75);
  // the skin: dark plum, with the veins' glowing lines drawn into it (an emissive map)
  const lines = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      let x = (i + 0.3) / 7 * n, y = 0, a = (L.rnd() - 0.5) * 0.3, w = 5;
      for (let k = 0; k < 90; k++) { const nx = x + Math.sin(a) * 7, ny = y + 7; for (const ox of [-n, 0, n]) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.5 * w / 5})`; g.lineWidth = w; g.beginPath(); g.moveTo(x + ox, y); g.lineTo(nx + ox, ny); g.stroke(); } x = nx; y = ny; a += (L.rnd() - 0.5) * 0.5; w = Math.max(1.2, w * 0.985); }
    }
  });
  const skin = new THREE.MeshPhysicalMaterial({ color: '#3a2440', roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: new THREE.Color('#c8a0e0'),
    emissive: new THREE.Color('#a050ff'), emissiveMap: lines, emissiveIntensity: K.NIGHTISH ? 0.75 : 0.3 });
  skin.userData.glow = K.dimGlow('#a050ff', 0.7);
  skin.envMapIntensity = 0.4;
  const { veinM, pulseM } = veinMats(K, 1.4);
  // the roots: veins of every thickness heaving up out of the floor in low arches and diving back in, knotted round
  // the bulbs, branching as they go
  const arches = [];
  for (const [b0, n] of [[0.4, 4], [2.5, 3], [4.3, 4]]) for (let k = 0; k < n; k++) arches.push([b0 + (L.rnd() - 0.5) * 0.9, 1.4 + L.rnd() * 1.9, 0.2 + L.rnd() * 0.4, 0.13 + L.rnd() * 0.22]);
  arches.forEach(([a, len, h, r], k) => {
    const ca = Math.cos(a), sa = Math.sin(a), side = [-sa, ca], wob = 0.8 * (L.rnd() - 0.5);
    const pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8, d = 0.5 + t * len, y = -0.25 + Math.sin(Math.PI * Math.min(1, t * 1.25)) * (h + 0.25); pts.push([ca * d + side[0] * wob * Math.sin(t * 3), y, sa * d + side[1] * wob * Math.sin(t * 3)]); }
    K.tube(null, pts, t => r * (1 - 0.35 * t) * (0.85 + 0.15 * Math.sin(t * 9 + k)), skin, { n: 40, radial: 10, dirt: 0 });
    const c = K.curve(pts, 30);
    if (r > 0.26) { const p = c[12]; L.sphere(r * 0.38, pulseM, p[0], p[1] + r * 0.55, p[2], { cast: false, dirt: 0 }); }
    // and a thin vein carrying on through the soil beyond, forking
    const e = pts[8], tail = []; for (let i = 0; i <= 4; i++) tail.push([e[0] + ca * i * 0.45 + side[0] * 0.25 * Math.sin(i + k), 0.02, e[2] + sa * i * 0.45 + side[1] * 0.25 * Math.sin(i + k)]);
    K.tube(null, tail, t => 0.1 * (1 - 0.7 * t) + 0.015, veinM, { n: 24, radial: 6, dirt: 0 });
  });
  // the bulbs: three swollen nodes of thin, stretched skin with the charge glowing through, in a collar of torn soil
  const clodM = K.crust('#3a2e2a', { rough: 0.97 });
  for (let i = 0; i < 40; i++) { const a = L.rnd() * 6.28, r = 0.9 + L.rnd() * 0.8, s = 0.07 + L.rnd() * 0.12; L.mesh(clodGeo(L, K, s, i), clodM, Math.cos(a) * r, s * 0.2, Math.sin(a) * r, { dirt: 0.1, dirtH: s }); }
  const memb = new THREE.MeshPhysicalMaterial({ color: '#5a3478', emissive: new THREE.Color('#9c50f0'), emissiveIntensity: K.NIGHTISH ? 0.55 : 0.25, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15,
    transparent: true, opacity: 0.9 });
  memb.userData.glow = K.dimGlow('#a860ff', 1.4);
  const core = K.glowMat('#e0c8ff', 1.2, K.dimGlow('#c890ff', 2.2));
  for (const [x, z, r] of [[0, 0, 0.8], [0.75, -0.55, 0.52], [-0.6, -0.6, 0.45]]) {
    K.seg(null, [x, r * 0.45, z], r, r * 0.75, r * 0.9, memb, { lump: 0.1, flat: 0.5 });
    K.seg(null, [x + 0.04, r * 0.6, z], r * 0.45, r * 0.4, r * 0.42, core, { lump: 0.1 });
  }
  L.pointLight('#b47cff', 0.8 + K.GLOW * 3, 0, 1.6, 0, 5.5);
}

// ---------------------------------------------------------------------------------------------------------------
// FLOATING CRYSTAL. The Hollow's sky island: a raft of stone so rich in Ring Crystal that it floats (LORE.md: rock rich in
// it floats), hanging over a chasm. Flat on top (a crystal crust: the richest Crystal on the map is mined here), a rim of
// points round it, and underneath a great beard of pale lilac crystal glowing violet, with roots trailing into the dark
// below and a few still tethered up to the roof.
function floater(L, K) {
  const { THREE } = K, X = { ...K.XTAL, k: 1.25 }, XB = { ...K.XTAL, k: 1.7, opacity: 0.8 };
  const RX = 15, RZ = 11.5;
  const rim = (a) => 1 + 0.12 * K.nz(Math.cos(a) * 1.4, 0.3, Math.sin(a) * 1.4) + 0.05 * Math.sin(a * 5 + 1) + 0.03 * Math.sin(a * 11);
  // the top: a gently domed crust, pale crystal-grey, finely cracked
  const crustM = K.crust('#ffffff', { rough: 0.8, ns: 1.0 });
  const top = polarField(L, K, 1, () => 0, () => [1, 1, 1], crustM, { nr: 40, na: 120 });
  {
    const p = top.geometry.attributes.position, col = top.geometry.attributes.color;
    for (let i = 0; i < p.count; i++) {
      const x0 = p.getX(i), z0 = p.getZ(i), r = Math.hypot(x0, z0), a = Math.atan2(z0, x0), k = rim(a);
      const x = x0 * RX * k, z = z0 * RZ * k, y = 0.5 * (1 - r * r) + 0.15 * K.nz(x * 0.4, 1, z * 0.4) - 0.6 * smooth(0.85, 1, r);
      p.setXYZ(i, x, y, z);
      const veinish = Math.abs(K.nz(x * 0.7, 3, z * 0.7)) < 0.05 ? 1 : 0;
      const c = mixc([0.5, 0.47, 0.6], [0.7, 0.64, 0.82], 0.5 + 0.5 * K.nz(x * 0.25, 7, z * 0.25));
      const cc = veinish ? mixc(c, [0.9, 0.8, 1.0], 0.7) : c;
      col.setXYZ(i, cc[0], cc[1], cc[2]);
    }
    top.geometry.computeVertexNormals();
  }
  // the underside: an inverted, lumpy cone of stone, bulging and riddled with crystal, hanging down under the raft
  const stoneM = K.crust('#3a3444', { rough: 0.85, ns: 1.4 });
  {
    const NA = 120, NY = 40, pos = [], idx = [], col = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) {
      const t = j / NY, a = i / NA * Math.PI * 2, k = rim(a), s = Math.pow(1 - t, 0.75) * (1 + 0.18 * K.nz(Math.cos(a) * 2, t * 3, Math.sin(a) * 2));
      const depth = 12 + 4 * K.nz(Math.cos(a), 5, Math.sin(a));
      const off = [2.5 * t * t, 0, 6 * t * t];
      pos.push(Math.cos(a) * RX * k * s * 0.98 + off[0], -0.6 - t * depth, Math.sin(a) * RZ * k * s * 0.98 + off[2]);
      const b = 0.35 + 0.65 * (1 - t); col.push(b, b * 0.96, b * 1.05);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const uv = []; for (let k = 0; k < pos.length; k += 3) uv.push(pos[k] / 3, pos[k + 1] / 3); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); L.mesh(g, stoneM, 0, 0, 0, {});
  }
  // the beard: big crystal points hanging down and out from the underside, brightest at the bottom
  for (let i = 0; i < 46; i++) {
    const a = L.rnd() * Math.PI * 2, t = 0.15 + L.rnd() * 0.8, k = rim(a), s = Math.pow(1 - t, 0.75);
    const x = Math.cos(a) * RX * k * s * 0.9 + 2.5 * t * t, z = Math.sin(a) * RZ * k * s * 0.9 + 6 * t * t, y = -0.6 - t * 12;
    const out = 0.5 + 0.6 * (1 - t);
    K.shard(null, [x, y, z], [Math.cos(a) * out, -1, Math.sin(a) * out], 1.6 + L.rnd() * 3.2 * (0.6 + t), 0.3 + L.rnd() * 0.35, t > 0.6 ? XB : X, { collar: false });
  }
  K.cluster(null, [2.6, -13.5, 6.0], [0.1, -1, 0.35], 9, 8, 1.0, XB, 0.55, { collar: false });
  K.cluster(null, [-4, -9, 7.5], [-0.3, -1, 0.5], 5, 5, 0.7, XB, 0.5, { collar: false });
  // the rim: points jutting out and up round the edge of the raft
  for (let g = 0; g < 11; g++) {
    const a0 = L.rnd() * Math.PI * 2;
    for (let i = 0; i < 2 + Math.floor(L.rnd() * 3); i++) {
      const a = a0 + (L.rnd() - 0.5) * 0.35, k = rim(a), x = Math.cos(a) * RX * k * 0.96, z = Math.sin(a) * RZ * k * 0.96;
      K.shard(null, [x, -0.5, z], [Math.cos(a), 0.2 + L.rnd() * 0.6, Math.sin(a)], (0.8 + L.rnd() * 2.4) * (i ? 0.7 : 1.2), 0.22 + L.rnd() * 0.22, X, { collar: false });
    }
  }
  // the crust is crystal: a pavement of small, low points grown flat over the whole top (pale lilac, faintly lit)
  {
    const geos = [], up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < 900; i++) {
      const a = L.rnd() * Math.PI * 2, r = Math.sqrt(L.rnd()) * 0.95, k = rim(a), x = Math.cos(a) * RX * k * r, z = Math.sin(a) * RZ * k * r;
      const y = 0.5 * (1 - r * r) - 0.6 * smooth(0.85, 1, r), len = 0.25 + L.rnd() * 0.5 + 0.6 * smooth(0.7, 0.95, r);
      const cg = new THREE.ConeGeometry(len * 0.45, len, 6, 1); cg.translate(0, len / 2, 0);
      const cp = cg.attributes.position, cc = new Float32Array(cp.count * 3); for (let q = 0; q < cp.count; q++) { const b = 0.7 + 0.3 * cp.getY(q) / len; cc[q * 3] = cc[q * 3 + 1] = cc[q * 3 + 2] = b; }
      cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
      const d = new THREE.Vector3(Math.cos(a) * r * 0.8 + (L.rnd() - 0.5) * 0.5, 1, Math.sin(a) * r * 0.8 + (L.rnd() - 0.5) * 0.5).normalize();
      cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d)); cg.translate(x, y - 0.05, z);
      geos.push(cg.toNonIndexed());
    }
    const n = geos.reduce((s2, g) => s2 + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv', 'color']) { const sz = geos[0].attributes[name].itemSize, arr = new Float32Array(n * sz); let o = 0; for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
    L.mesh(out, K.druseMat({ ...K.XTAL, k: 0.45 }, 1), 0, 0, 0, { dirt: 0 });
  }
  // a few small druses in the crust, near the edge (where the robots would cut first)
  for (let i = 0; i < 7; i++) { const a = L.rnd() * 6.28, r = 0.62 + L.rnd() * 0.25, k = rim(a); K.cluster(null, [Math.cos(a) * RX * k * r, 0.2, Math.sin(a) * RZ * k * r], [0, 1, 0], 4, 0.9 + L.rnd() * 0.6, 0.2, X, 0.6, { collar: false }); }
  // roots: trailing from the underside into the chasm, and three still tethered up into the dark of the roof
  const rootM = K.crust('#2a1e30', { rough: 0.75 });
  const { veinM, pulseM } = veinMats(K, 1.1);
  for (let i = 0; i < 16; i++) {
    const a = L.rnd() * Math.PI * 2, t = 0.2 + L.rnd() * 0.6, k = rim(a), s = Math.pow(1 - t, 0.75);
    const x = Math.cos(a) * RX * k * s * 0.85 + 2.5 * t * t, z = Math.sin(a) * RZ * k * s * 0.85 + 6 * t * t, y = -0.6 - t * 12;
    const len = 8 + L.rnd() * 12, pts = [];
    for (let j = 0; j <= 6; j++) { const u = j / 6; pts.push([x + Math.cos(a) * u * 1.5 + 0.6 * Math.sin(u * 5 + i), y - u * len, z + Math.sin(a) * u * 1.5 + 0.6 * Math.cos(u * 4 + i)]); }
    K.tube(null, pts, u => (0.22 + 0.1 * L.rnd()) * (1 - 0.85 * u) + 0.02, i % 3 ? rootM : veinM, { n: 40, radial: 7, dirt: 0 });
  }
  for (const [a, h] of [[2.2, 30], [3.6, 26], [5.1, 34]]) {
    const k = rim(a), x = Math.cos(a) * RX * k * 0.9, z = Math.sin(a) * RZ * k * 0.9, pts = [];
    for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push([x + Math.cos(a) * u * 3 + Math.sin(u * 4) * 0.8, -0.2 + u * h, z + Math.sin(a) * u * 3 - u * 6]); }
    K.tube(null, pts, u => 0.75 * (1 - 0.5 * u), rootM, { n: 60, radial: 10, dirt: 0 });
    K.tube(null, pts.map(([px, py, pz]) => [px + 0.3, py + 0.2, pz + 0.55]), u => 0.16 * (1 - 0.4 * u), veinM, { n: 60, radial: 6, dirt: 0 });
    const c = K.curve(pts, 30); for (const ti of [6, 15]) L.sphere(0.24, pulseM, c[ti][0] + 0.3, c[ti][1] + 0.3, c[ti][2] + 0.6, { cast: false, dirt: 0 });
  }
  L.pointLight('#a070ff', 3 + K.GLOW * 8, 1.5, -10, 1.5, 22);
  L.mark('topCentre', 0, 0.5, 0);
}

// ---------------------------------------------------------------------------------------------------------------
// STONE PILLAR. Rising into the dark, worn smooth, a spiral cut round it with a pitch too even to be natural. The Bloom
// climbs it in the grooves, so at night the spiral shows as a coil of violet light going up into the black.
function pillar(L, K, v) {
  const { THREE } = K;
  const H = 46, R0 = v === 2 ? 3.4 : 4.6, starts = v === 2 ? 5 : 3, twist = v === 2 ? 0.16 : 0.12;
  const NA = 160, NY = 140, pos = [], col = [], idx = [], uv = [];
  const R = (y) => { const t = y / H; return R0 * (1 + 0.55 * Math.exp(-y / 2.2) + 0.08 * Math.sin(t * 9) * 0.3 - 0.12 * t) ; };
  const groove = (a, y) => { const ph = (a * starts - y * twist * starts) / (Math.PI * 2); const f = ph - Math.floor(ph); return Math.exp(-Math.pow((f - 0.5) / 0.12, 2)); };
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) {
    const y = (j / NY) * H, a = i / NA * Math.PI * 2, g = groove(a, y), r = R(y) * (1 - 0.13 * g) * (1 + 0.015 * K.nz(Math.cos(a) * 2, y * 0.2, Math.sin(a) * 2));
    pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(i / NA * 6, y / 4);
    // darkening up into the roof's dark; grooves a shade darker, the ridges between them polished pale
    const up = 1 - 0.92 * smooth(H * 0.18, H * 0.82, y), b = (0.95 - 0.35 * g) * up; col.push(b, b * 0.97, b * 1.06);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const stoneM = new THREE.MeshStandardMaterial({ color: '#a29cb2', map: K.crustMap, roughness: 0.38, metalness: 0.05, vertexColors: true }); stoneM.envMapIntensity = 1.1;
  L.mesh(g, stoneM, 0, 0, 0, {});
  stain(L, K, R0 * 2.6, [40, 34, 52], 0.7);
  // the Bloom's veins following the grooves up, fading into the dark with the stone
  const { veinM, pulseM } = veinMats(K, 1.0);
  for (let s = 0; s < starts; s++) {
    const pts = [], a0 = (s / starts) * Math.PI * 2 + Math.PI / starts;
    for (let k = 0; k <= 60; k++) { const y = 0.6 + k / 60 * H * 0.7, a = a0 + y * twist, r = R(y) * (1 - 0.13) + 0.08; pts.push([Math.cos(a) * r, y, Math.sin(a) * r]); }
    K.tube(null, pts, t => 0.22 * (1 - 0.7 * t) + 0.03, veinM, { n: 240, radial: 6, dirt: 0 });
    const c = K.curve(pts, 60); for (const ti of [8, 22, 37]) { const p = c[ti]; L.sphere(0.28 * (1 - ti / 70), pulseM, p[0], p[1], p[2], { cast: false, dirt: 0 }); }
  }
  // moss and grit round the foot
  const mossM = K.crust('#3e3060', { rough: 0.95 });
  for (let i = 0; i < 70; i++) { const a = L.rnd() * 6.28, r = R(0) * (0.95 + L.rnd() * 0.5), s = 0.15 + L.rnd() * 0.3; L.mesh(clodGeo(L, K, s, i, 0.5), mossM, Math.cos(a) * r, s * 0.1, Math.sin(a) * r, { dirt: 0.1, dirtH: s }); }
}

// ---------------------------------------------------------------------------------------------------------------
// SIDE CHAMBER. What the Murmur keep: robot parts dragged down from every colony and laid out in rows, each row one kind,
// sorted by size, every piece turned the same way. No log says why.
function chamber(L, K) {
  const { THREE } = K, M = L.M;
  stain(L, K, 15, [52, 46, 60], 0.65);
  const TEAMS = ['#38d4ff', '#ff5a6e', '#7ee06a', '#c27cff'];
  const dark = M.paint('#3a3e44', { rivets: false }), steel = M.steel, rubber = M.plain('#1c1c1e', 0.9), copper = M.plain('#b06a3a', 0.4, 0.8);
  const trim = TEAMS.map(c => M.plain(c, 0.5, 0.1));
  const dull = TEAMS.map(c => M.plain('#' + new THREE.Color(c).multiplyScalar(0.35).getHexString(), 0.6));
  const rowZ = [-9, -5.2, -1.4, 2.6, 6.8];
  const scuff = M.plain('#2a2630', 0.95);
  // row 1: battery cells, standing, tallest at the west end
  for (let i = 0; i < 9; i++) {
    const x = -12 + i * 3, h = 2.6 - i * 0.16, r = 0.9 - i * 0.03, t = i % 4;
    L.cyl(r, h, dark, x, 0, rowZ[0], { seg: 24 });
    L.cyl(r * 0.55, 0.25, copper, x, h, rowZ[0], { seg: 16, dirt: 0 });
    L.cyl(r * 1.01, 0.22, dull[t], x, h * 0.62, rowZ[0], { seg: 24, dirt: 0 });
  }
  // row 2: Chips, laid flat, square to the row
  const pcb = M.plain('#1e3a2a', 0.5, 0.2), gold = M.plain('#d4a84a', 0.3, 0.9);
  for (let i = 0; i < 11; i++) {
    const x = -12.5 + i * 2.5, s = 1.7 - i * 0.07;
    L.box(s, 0.12, s, pcb, x, 0, rowZ[1], { dirt: 0.3 });
    L.box(s * 0.55, 0.14, s * 0.55, M.plain('#121214', 0.4), x, 0.12, rowZ[1], { dirt: 0 });
    for (let k = -2; k <= 2; k++) for (const sd of [-1, 1]) L.box(0.08, 0.05, 0.22, gold, x + k * s * 0.17, 0.12, rowZ[1] + sd * s * 0.42, { dirt: 0, cast: false });
  }
  // one Chip at the end still holds a little charge: its status light is on
  L.lamp(-12.5 + 10 * 2.5 + 0.5, 0.26, rowZ[1] - 0.4, '#7cffb0', { size: 0.12, k: 3, intensity: 1.2, dist: 2 });
  // row 3: sensor heads, every one turned to face the same way (south, toward the way in), their lenses dark
  for (let i = 0; i < 7; i++) {
    const x = -11.5 + i * 3.8, s = 1.3 - i * 0.05, t = (i * 3) % 4;
    L.box(s * 1.6, s * 1.1, s * 1.3, M.paint('#5a5e64', { rivets: false }), x, 0, rowZ[2], {});
    L.box(s * 1.62, 0.18, s * 1.32, trim[t], x, s * 0.55, rowZ[2], { dirt: 0 });
    L.cyl(s * 0.32, 0.25, M.plain('#0a0c10', 0.15, 0.2), x, s * 0.35, rowZ[2] + s * 0.65, { seg: 20, dirt: 0 }).rotation.x = Math.PI / 2;
  }
  // row 4: wheels, laid flat
  for (let i = 0; i < 8; i++) {
    const x = -12 + i * 3.3, r = 1.25 - i * 0.05;
    L.cyl(r, 0.55, rubber, x, 0, rowZ[3], { seg: 28, dirt: 0.4 });
    L.cyl(r * 0.55, 0.6, steel, x, 0, rowZ[3], { seg: 20, dirt: 0 });
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; L.cyl(0.08, 0.64, M.chrome, x + Math.cos(a) * r * 0.35, 0, rowZ[3] + Math.sin(a) * r * 0.35, { seg: 8, dirt: 0, cast: false }); }
  }
  // row 5: arms, laid parallel, grippers to the south
  for (let i = 0; i < 6; i++) {
    const x = -11 + i * 4.4, l = 3.2 - i * 0.15, t = (i + 1) % 4;
    L.box(0.55, 0.5, l, M.paint('#6a6e72', { rivets: false }), x, 0, rowZ[4], {});
    L.box(0.6, 0.12, 0.5, trim[t], x, 0.5, rowZ[4] - l * 0.3, { dirt: 0 });
    L.hcyl(0.42, 0.7, steel, x, 0.4, rowZ[4] - l / 2, { axis: 'x' });
    for (const sd of [-1, 1]) L.box(0.14, 0.32, 0.9, steel, x + sd * 0.22, 0, rowZ[4] + l / 2 + 0.3, { dirt: 0 });
  }
  // a gap in the battery row: one taken back out, its ring in the dust
  L.mesh(new THREE.RingGeometry(0.55, 0.85, 24).rotateX(-Math.PI / 2), scuff, -12 + 9 * 3, 0.01, rowZ[0], { cast: false, dirt: 0 });
  // drag marks from the way in (south-east): pairs of furrows, and the scrape of something heavy
  const furrowM = K.crust('#241e2a', { rough: 0.95 });
  for (let k = 0; k < 5; k++) {
    const x0 = 3 + k * 1.3, pts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x0 + t * 5 + Math.sin(t * 4 + k) * 0.4, 0.02, 9.5 + t * 3.5]); }
    for (const sd of [-0.18, 0.18]) K.tube(null, pts.map(([x, y, z]) => [x + sd, y, z]), () => 0.07, furrowM, { n: 40, radial: 5, flat: 0.4, dirt: 0 });
  }
  // the Bloom's veins creeping in along the floor toward the rows
  const { veinM } = veinMats(K, 0.9);
  for (const [x0, z0, dx, dz] of [[14, -12, -4, 3], [-15, 12, 3, -2], [15, 4, -3, 1]]) {
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push([x0 + dx * t + Math.sin(t * 5) * 0.6, 0.03, z0 + dz * t + Math.cos(t * 4) * 0.6]); }
    K.tube(null, pts, t => 0.12 * (1 - 0.8 * t) + 0.02, veinM, { n: 40, radial: 6, dirt: 0 });
  }
}
