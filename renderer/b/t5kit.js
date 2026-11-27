// Terraforming stage 5 kit: the shared look of the big projects (the Reservoir, the Leveller), framed and
// padded like the Deep Core (a 3 x 3 megastructure, 30 x 30 world units), and the build-stage helper.
//   ?site=1  foundations: only what stands below 1.3 units, formwork, rebar, a crawler crane, pallets, a site hut
//   ?site=2  half built: everything cut off at opts.cut2 (clipped), scaffolding round what is rising, the crane
export function setup(L) {
  const { M } = L;
  L.longPad(30, 30);
  L.frameCompoundOpts({ half: 15.12, width: 0.62, cy: 0.6 });
  const night = L.TOD === 'night', dark = night || L.TOD === 'evening', NB = night ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const T = {
    conc: M.rough('#a39b8e'), concD: M.rough('#857d71'), concL: M.rough('#b8b0a2'),
    steel: M.steel, dark: M.dark, white: M.paint('#d9d6cf', { rivets: false }), grey: M.paint('#5b6168', { metal: 0.4 }),
    greyD: M.paint('#41464c', { rivets: false, metal: 0.5 }), roof: M.plain('#4f5356', 0.85, 0.2), belt: M.plain('#24262a', 0.9, 0),
    rope: M.plain('#30302e', 0.5, 0.6), team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }), hole: M.plain('#07060a', 1, 0),
    yellow: M.paint('#c9962a', { rivets: false, rough: 0.55, metal: 0.3 }), yellowD: M.paint('#9a7020', { rivets: false, rough: 0.6, metal: 0.3 }),
    red: M.paint('#a8342a', { rivets: false, rough: 0.6, metal: 0.35 }), redD: M.paint('#7e2620', { rivets: false, rough: 0.6, metal: 0.35 }),
    spoil: M.rough('#7a6656'), spoilD: M.rough('#5e4e42'), nc: { dirt: 0, cast: false },
  };
  T.flood = dark ? M.emit('#f4f8ff', 3.2) : M.plain('#cfd6dc', 0.3, 0.3);
  T.beacon = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  T.amber = dark ? M.emit('#ffb347', 1.8) : M.plain('#3b4652', 0.2, 0.3);
  T.acc = M.emit(L.ACCENT, dark ? 2.6 : 1.6); T.accDim = M.emit(L.ACCENT, dark ? 1.2 : 0.6);
  T.teamL = M.emit(L.TEAM === '#ff5a6e' ? '#ff2a40' : L.TEAM, dark ? 2.6 : 1.4);
  return { T, night, dark, NB };
}

// The game's own water texture as a material (async: call with await)
export async function gameTextures(L) {
  const { THREE } = L, tl = new THREE.TextureLoader();
  const ld = async (u, r) => { const t = await tl.loadAsync(u); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(r[0], r[1]); t.anisotropy = 8; return t; };
  const waterT = await ld('/art/tiles/water.webp', [0.25, 0.25]);
  const groundT = await ld('/art/tiles/ground.webp', [0.25, 0.25]);
  const water = new THREE.MeshStandardMaterial({ map: waterT, color: '#7f98a4', roughness: 0.16, metalness: 0.15 }); water.envMapIntensity = 1.2;
  const earth = new THREE.MeshStandardMaterial({ map: groundT, color: '#c9b4a4', roughness: 0.96 });
  const foam = new THREE.MeshStandardMaterial({ color: '#f4f6f6', roughness: 0.6, transparent: true, opacity: 0.6, depthWrite: false });
  const mist = new THREE.MeshStandardMaterial({ color: '#f2f6f8', roughness: 1, transparent: true, opacity: 0.42, depthWrite: false });
  return { water, earth, foam, mist, waterT, groundT };
}

// a lumpy rock / earth mass: a displaced box, base at y
export function rock(L, w, h, d, mat, x, y, z, seed = 1, jag = 0.18) {
  const { THREE } = L;
  const geo = new THREE.BoxGeometry(w, h, d, 6, 4, 6); geo.translate(0, h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i);
    const n = Math.sin(vx * 1.7 + seed) * Math.cos(vz * 1.3 + seed * 2) + Math.sin(vy * 2.1 + vx * 0.7 + seed * 3);
    const k = vy > 0.02 ? 1 : 0;
    p.setX(i, vx * (1 + jag * 0.5 * n * k)); p.setZ(i, vz * (1 + jag * 0.5 * n * k)); p.setY(i, vy + k * jag * h * 0.25 * n);
  }
  geo.computeVertexNormals();
  return L.mesh(geo, mat, x, y, z, { dirt: 0.4, dirtH: h });
}

// puffs of steam or mist: n soft spheres up a column, phase f (0..3) moves them up
export function puffs(L, mat, x, y, z, n, f, rise = 1.4, r0 = 0.7, spread = 0.5) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = ((k + f / 4) / n);
    const r = r0 * (0.6 + 1.4 * t);
    out.push(L.sphere(r, mat, x + Math.sin(k * 2.3) * spread * t * 2, y + t * rise * n, z + Math.cos(k * 1.7) * spread * t, { cast: false, dirt: 0 }));
  }
  return out;
}

// crawler crane for the build stages (yellow, a lattice boom raised toward the work)
export function crane(L, T, x, z, ry, boomLen = 24, ang = 1.0, hookTo = null) {
  const { group, box, beam, cyl } = L;
  const g = group(x, 0, z, ry);
  for (const s of [-1, 1]) { box(7.2, 1.1, 1.3, T.dark, 0, 0, s * 2.0, { parent: g }); box(7.0, 0.16, 1.32, T.greyD, 0, 1.1, s * 2.0, { parent: g }); }
  box(5.2, 2.8, 3.8, T.yellow, -0.4, 1.2, 0, { parent: g });
  box(1.8, 1.7, 1.6, T.yellowD, 1.9, 4.0, 1.0, { parent: g });
  box(1.2, 0.8, 0.05, L.M.glass('#8fc8e8', 0.6), 2.81, 4.6, 1.0, { parent: g, ry: Math.PI / 2, cast: false });
  box(2.4, 2.2, 3.4, T.greyD, -2.8, 1.4, 0, { parent: g });   // counterweight
  const base = [1.6, 3.4, 0], tip = [1.6 + Math.cos(ang) * boomLen, 3.4 + Math.sin(ang) * boomLen, 0];
  // the lattice boom: two chords and lacing
  const pts = [];
  for (const s of [-0.55, 0.55]) beam([base[0], base[1], s], [tip[0], tip[1], s * 0.4], 0.22, 0.22, T.yellow, { parent: g, dirt: 0 });
  for (let k = 0; k < 12; k++) {
    const t0 = k / 12, t1 = (k + 1) / 12, P = (t, s) => [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t, s * (0.55 - 0.15 * t)];
    beam(P(t0, -1), P(t1, 1), 0.08, 0.08, T.yellowD, { parent: g, dirt: 0 }); pts.push(P(t1, 0));
  }
  beam([-2.6, 4.0, 0], [tip[0] - 1, tip[1] - 0.4, 0], 0.05, 0.05, T.rope, { parent: g, dirt: 0 }); // pendant
  const hy = hookTo ?? 3.0;
  beam([tip[0], tip[1], 0], [tip[0], hy, 0], 0.05, 0.05, T.rope, { parent: g, dirt: 0 });
  box(0.5, 0.6, 0.4, T.yellow, tip[0], hy - 0.6, 0, { parent: g });
  return g;
}

// scaffolding round a rising part: [x, z, w, d, h]
export function scaffold(L, T, x, z, w, d, h) {
  const { box } = L, tube = T.scaf || (T.scaf = L.M.plain('#8d9298', 0.5, 0.6)), plank = T.plank || (T.plank = L.M.wood);
  const nx = Math.max(2, Math.round(w / 1.6)), nz = Math.max(2, Math.round(d / 1.6));
  const x0 = x - w / 2, z0 = z - d / 2;
  for (let i = 0; i <= nx; i++) for (const zz of [z0, z0 + d]) box(0.09, h, 0.09, tube, x0 + i * w / nx, 0, zz, { dirt: 0 });
  for (let j = 1; j < nz; j++) for (const xx of [x0, x0 + w]) box(0.09, h, 0.09, tube, xx, 0, z0 + j * d / nz, { dirt: 0 });
  for (let y = 1.6; y <= h; y += 1.6) {
    for (const zz of [z0, z0 + d]) box(w, 0.07, 0.07, tube, x, y, zz, { dirt: 0 });
    for (const xx of [x0, x0 + w]) box(0.07, 0.07, d, tube, xx, y, z, { dirt: 0 });
    box(w, 0.06, 0.5, plank, x, y + 0.05, z0 - 0.3, { dirt: 0.3 }); box(w, 0.06, 0.5, plank, x, y + 0.05, z0 + d + 0.3, { dirt: 0.3 });
  }
}

// Build stages: call last. stage 1: foundations; stage 2: clipped at cut2. scaf: [[x,z,w,d,h],...], crane: [x,z,ry,len,ang]
export function site(L, T, stage, { cut2 = 8, scaf = [], craneAt = [10, 10, -2.4, 24, 1.0], props = true } = {}) {
  if (!stage) return;
  const { THREE } = L, root = L.getRoot();
  root.updateMatrixWorld(true);
  const cut = stage === 1 ? 1.3 : cut2;
  const plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), cut);
  L.getRenderer().localClippingEnabled = true;
  const meshes = []; root.traverse((o) => { if (o.isMesh && !o.userData.pad) meshes.push(o); });
  for (const o of meshes) {
    if (o.userData.decal) continue;
    const b = new THREE.Box3().setFromObject(o);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const glows = mats.some((m) => m.userData && m.userData.glow), transp = mats.some((m) => m.transparent);
    if (b.min.y > cut - 0.05 || transp) { o.visible = false; continue; }
    if (b.max.y > cut) {
      if (glows) { o.visible = false; continue; }
      o.material = Array.isArray(o.material) ? o.material.map((m) => { const c = m.clone(); c.clippingPlanes = [plane]; c.clipShadows = true; c.side = THREE.DoubleSide; return c; })
        : (() => { const c = o.material.clone(); c.clippingPlanes = [plane]; c.clipShadows = true; c.side = THREE.DoubleSide; return c; })();
    }
  }
  // (point lights left from the finished scene: drop them, a site is dark)
  const sc = L.getScene(); sc.children.filter((c) => c.isPointLight).forEach((c) => sc.remove(c));
  for (const s of scaf) scaffold(L, T, s[0], s[1], s[2], s[3], stage === 1 ? Math.min(3.2, s[4]) : Math.min(cut + 1.6, s[4]));
  const [cx, cz, tx, tz, cl, ca] = craneAt; crane(L, T, cx, cz, Math.atan2(-(tz - cz), tx - cx), cl, ca, stage === 1 ? 2.2 : cut + 1);
  if (props) {
    const { box } = L;
    // pallets of cement sacks and rebar bundles, a site hut, a fence of hazard barriers
    for (const [x, z] of [[-11.5, 11.8], [-9.6, 12.2], [-12.4, 9.8]]) { box(1.4, 0.18, 1.1, L.M.wood, x, 0, z, { dirt: 0.3 }); box(1.3, 0.6, 1.0, L.M.plain('#cfc8b6', 0.9, 0), x, 0.18, z, { dirt: 0.4 }); }
    for (let k = 0; k < 6; k++) box(5.2, 0.08, 0.08, L.M.plain('#6a3c26', 0.6, 0.5), -6 + (k % 3) * 0.15, 0.1 + Math.floor(k / 3) * 0.1, 13.0 + (k % 3) * 0.12, { dirt: 0 });
    box(3.4, 2.2, 2.2, L.M.paint('#c9962a', { rivets: false }), 11.6, 0, 12.0, { dirt: 0.5 });
    box(3.5, 0.12, 2.3, T.greyD, 11.6, 2.2, 12.0, { dirt: 0 });
    box(1.4, 0.6, 0.05, T.amber, 11.6, 1.1, 13.12, T.nc);
  }
}

// turn everything added to the root since index `from` about (cx, cz) by ang (radians, as rotation.y)
export function spin(L, from, cx, cz, ang) {
  const root = L.getRoot(), kids = root.children.slice(from), g = L.group(cx, 0, cz);
  for (const k of kids) { root.remove(k); k.position.x -= cx; k.position.z -= cz; g.add(k); }
  g.rotation.y = ang; return g;
}
export const rot = (x, z, cx, cz, a) => { const dx = x - cx, dz = z - cz; return [cx + dx * Math.cos(a) + dz * Math.sin(a), cz - dx * Math.sin(a) + dz * Math.cos(a)]; };
