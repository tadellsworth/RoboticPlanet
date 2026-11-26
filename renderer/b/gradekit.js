// The Grader's helpers (b/rob_grader.js): the game's ground texture as fresh earth, a lumpy heap of it, headlamp
// lenses that light up at evening and night, and the amber work beacon. From the Grader concept canvas (concept A,
// "Dozer"); the camera and the rest are robkit.js's.
import { K } from './robkit.js';

/** The game's own ground texture (run.js serves the game's art/ folder at /art/). */
export async function tex(L, url, rep = 1) {
  const t = await new L.THREE.TextureLoader().loadAsync(url);
  t.wrapS = t.wrapT = L.THREE.RepeatWrapping; t.colorSpace = L.THREE.SRGBColorSpace; t.repeat.set(rep, rep); t.anisotropy = 8; return t;
}

/** Fresh earth: the Rust's ground darkened and reddened (moist, turned soil). */
export async function earthMat(L, tint = '#8c7468') {
  const t = await tex(L, '/art/tiles/ground.webp', 2.2);
  return new L.THREE.MeshStandardMaterial({ map: t, color: tint, roughness: 0.97, metalness: 0 });
}

/** A heap of earth (a lumpy dome) at world x, z: radius r, height h, clods round its foot; o.sx / o.sz squash it. */
export function heap(L, mat, x, z, r, h, seed = 1, o = {}) {
  const { THREE } = L; let s = seed * 7919;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const geo = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2);
  const pos = geo.attributes.position, sx = o.sx ?? 1, sz = o.sz ?? 1;
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i), a = Math.atan2(vz, vx);
    const n = 1 + 0.13 * Math.sin(a * 3 + ph[0]) + 0.08 * Math.sin(a * 7 + ph[1]) + 0.05 * Math.sin(vy * 9 + a * 5 + ph[2]) + 0.06 * Math.sin(a * 17 + vy * 13) * vy + 0.04 * Math.sin(a * 29 + vy * 21 + ph[0]);
    pos.setXYZ(i, vx * r * n * sx, Math.pow(vy, 0.85) * h * (0.92 + 0.12 * Math.sin(a * 2 + ph[1]) + 0.07 * Math.sin(a * 11 + ph[2]) * (1 - vy)), vz * r * n * sz);
  }
  geo.computeVertexNormals();
  const out = [];
  const m = new THREE.Mesh(geo, mat.clone()); m.material.flatShading = true; m.material.needsUpdate = true; m.position.set(x, o.y ?? 0, z); m.castShadow = true; m.receiveShadow = true; L.getRoot().add(m); out.push(m);
  const clods = o.clods ?? Math.round(r * 9);
  for (let i = 0; i < clods; i++) {
    const a = rnd() * Math.PI * 2, d = r * (0.9 + rnd() * 0.6), cs = 0.05 + rnd() * 0.12;
    const c = new THREE.Mesh(new THREE.DodecahedronGeometry(cs, 0), mat); c.position.set(x + Math.cos(a) * d * sx, (o.y ?? 0) + cs * 0.4, z + Math.sin(a) * d * sz);
    c.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); c.castShadow = true; L.getRoot().add(c); out.push(c);
  }
  return out;
}

/** A headlamp at px (x, y), height h: a dark housing and a lens, lit at evening and night. */
export function lamp(L, R, x, y, h, o = {}) {
  const { M } = L, k = K, night = L.TOD === 'night' || L.TOD === 'evening';
  const lens = night ? M.emit(o.color || '#fff1c8', 3.2) : M.plain('#d8d4c6', 0.25, 0.3);
  R.disc(x, y, o.r || 3.2, h, 0.06, M.plain('#1a1c1f', 0.6, 0.4), { cast: false });
  return L.box(1.6 * k, (o.r || 3.2) * 1.5 * k, (o.r || 3.2) * 1.7 * k, lens, (x + 1) * k, h + 0.06, y * k, R.O({ dirt: 0, cast: false }));
}

/** The amber work beacon on the cab roof (brighter after dark). */
export function beacon(L, R, x, y, h) {
  const { M } = L, night = L.TOD === 'night' || L.TOD === 'evening';
  R.disc(x, y, 4.5, h, 0.12, M.plain('#22262a', 0.6, 0.5));
  R.disc(x, y, 3, h + 0.12, 0.08, M.emit('#ffb340', night ? 2.2 : 0.6), { cast: false });
}
