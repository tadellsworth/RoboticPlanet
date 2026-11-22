// The atlas's landmarks (LORE.md, The atlas; js/landmarks.js), set pieces on a Contingency battle's map, in the
// buildings' 57-degree view at true scale (10 world units a map tile), or straight down for the ones that lie flat.
//   ?c=hull          the Pathfinder's hull: the long white joint lander lying half-buried in the dunes, its Accord stripe
//                    faded, its seed-vault hatch open, drift sand banked along it. 5 x 2 tiles.
//   ?c=spire         the Ring Shard Spire: a slab of the Ring, curved, driven into the ground, a tall lilac crystal spire
//                    grown up out of it, crystals round its foot. 3 x 3 tiles, about 4 tall.
//   ?c=pillar&v=1..3 a pillar of the Stone Forest: banded red sandstone worn into a column (v=3 with a cap: a hoodoo).
//   ?c=falls         the Long Falls: the river going over the lip of the cliff into its plunge pool, 3 tiles wide.
//                    (The cliff itself is the map's rock; the game animates streaks and spray over this.)
//   ?c=geyser        the Clock Geyser's sinter cone and terraces, cream and rust, warm pools stepping down. 3 x 3 tiles.
//   ?c=house&v=1..3  a house of Passenger Town: a small bungalow, porch, windows (lit at night), one tile.
//   ?c=sign          Passenger Town's welcome sign: "WELCOME TO ITHACA", lit at night.
//   ?c=town&s=0|1    the town's ground, straight down: lawns, the street, sidewalks and driveways (s=1: one street row).
//   ?c=lake          Glass Lake, straight down: clear ice over the deep, cracks, snow drifted at its rim.
//   ?c=crater        Silent Crater on Argos, straight down: the bowl, its rim and its central peak, lit low.
//   ?c=shaft         a shaft of the Breach Fields: a hole straight down into the Hollow, rimmed with violet crystal.
//   ?c=wreck&w=kestrel|survey|halvard  a failed landing, half-buried: the Kestrel (a boxy cargo lander broken in the
//                    Blackwater mud), the Ninth Survey (a slim survey craft, its antenna mast and dish, under ash) and the
//                    Halvard (a relay tender nose-down, red-gold leaves in its open bay). 3 x 2 tiles, hatch toward you.
// The ground isn't drawn (the game's is under it): an invisible floor hides what's buried; soft stains blend the foot.
const P = new URLSearchParams(location.search);
const C = P.get('c') || 'hull', V = +(P.get('v') || 1), W = P.get('w') || 'kestrel';
const SIZES = { hull: 1536, spire: 1536, pillar: 512, falls: 1024, geyser: 1024, house: 512, sign: 512, town: 2048, lake: 2048, crater: 1536, shaft: 512, wreck: 1024 };
export const config = { pad: false, size: SIZES[C] || 1024 };
// straight-down frames: world units across
const FLAT = { town: 90, lake: 120, crater: 80 };

let L, THREE;
export default function (lib) {
  L = lib; THREE = L.THREE;
  L.seed({ hull: 11, spire: 12, pillar: 13 + V, falls: 17, geyser: 18, house: 20 + V, sign: 24, town: 25, lake: 26, crater: 27, shaft: 28, wreck: 30 + W.length }[C] || 9);
  if (FLAT[C]) {
    const h = FLAT[C] / 2, cam = new THREE.OrthographicCamera(-h, h, h, -h, 1, 400);
    cam.position.set(0, 150, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
  }
  const frames = { hull: [32, 0.86, 0.6], spire: [16, 0.6, 0.8], pillar: [5, 0.42, 0.8], falls: [16, 0.78, 0.62], geyser: [16, 0.84, 0.58], house: [5, 0.58, 0.68], sign: [5, 0.55, 0.68], shaft: [5, 0.62, 0.55], wreck: [20, 0.86, 0.58] };
  if (frames[C]) L.frameCompoundOpts({ half: frames[C][0], width: frames[C][1], cy: frames[C][2] });
  ({ hull, spire, pillar, falls, geyser, house, sign, town, lake, crater, shaft, wreck })[C]();
}

// ------------------------------------------------------------------ shared
const nz = (() => { const w = []; let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647); for (let k = 0; k < 6; k++) w.push([r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, 0.7 + k * 0.9, r() * 6.3]); return (x, y, z) => { let v = 0, n = 0; for (const [a, b, c, f, o] of w) { v += Math.sin((a * x + b * y + c * z) * f + o) / f; n += 1 / f; } return v / n; }; })();
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const night = () => L.TOD === 'night' || L.TOD === 'evening';
/** A glowing material that glows (in the glow pass) only after dark: by day it's lit like anything else. */
function dayDim(m) { if (!night()) delete m.userData.glow; return m; }
function mat(hex, rough = 0.85, metal = 0, o = {}) { const m = new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal, vertexColors: !!o.vc, flatShading: !!o.flat }); m.envMapIntensity = o.env ?? 0.4; return m; }
/** An invisible floor at y = 0: it hides whatever is buried (with a hole of radius `hole`, for a shaft). */
function floor(r = 80, hole = 0) {
  const g = hole ? new THREE.RingGeometry(hole, r, 64, 1) : new THREE.PlaneGeometry(r * 2, r * 2); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false })); m.userData.decal = true; m.renderOrder = -1; L.getRoot().add(m);
}
/** A soft stain on the ground under a piece (sand, mud, ash), w x d units, fading at its edge. */
function stain(w, d, rgb, a0 = 0.7, y = 0.02) {
  const n = 512, tex = L.canvasTex(n, (g) => {
    const img = g.createImageData(n, n), D = img.data;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const dx = (i / n - 0.5) * 2, dy = (j / n - 0.5) * 2, r = Math.hypot(dx, dy), e = 0.82 + 0.1 * nz(dx * 3, 1, dy * 3);
      const al = smooth(e, e - 0.35, r) * a0, sp = 0.85 + 0.3 * (nz(dx * 40, 3, dy * 40) * 0.5 + 0.5), k = (j * n + i) * 4;
      D[k] = rgb[0] * sp; D[k + 1] = rgb[1] * sp; D[k + 2] = rgb[2] * sp; D[k + 3] = al * 255;
    }
    g.putImageData(img, 0, 0);
  });
  const pg = new THREE.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 })); m.position.y = y; m.receiveShadow = true; m.userData.decal = true; L.getRoot().add(m);
}
/** A lump (a rock, a drift, a clod): a sphere pushed about by noise, flattened by sq, with its base at y. */
function lump(r, x, y, z, m, o = {}) {
  const g = new THREE.IcosahedronGeometry(1, o.detail ?? 3), p = g.attributes.position, k0 = o.k ?? 0.3, sd = o.seed ?? L.rnd() * 50;
  for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), q = 1 + k0 * nz(vx * 1.7 + sd, vy * 1.7, vz * 1.7); p.setXYZ(i, vx * q * r * (o.sx ?? 1), vy * q * r * (o.sq ?? 0.6), vz * q * r * (o.sz ?? 1)); }
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z); if (o.ry) mesh.rotation.y = o.ry; mesh.castShadow = true; mesh.receiveShadow = true; L.getRoot().add(mesh); return mesh;
}
/** A flat canvas-textured disc or rectangle lying on the ground (for the straight-down pieces). */
function flat(w, d, draw, n = 1024, o = {}) {
  const tex = L.canvasTex(n, draw), pg = new THREE.PlaneGeometry(w, d); pg.rotateX(-Math.PI / 2);
  // (painted as it is to be seen: unlit and not tone-mapped, so the game's ground light grades it like the ground)
  const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  m.position.y = o.y ?? 0; m.receiveShadow = true; L.getRoot().add(m); return m;
}

// ------------------------------------------------------------------ the Pathfinder's hull
function hull() {
  floor();
  stain(64, 34, [180, 128, 92], 0.7);
  const g = L.group(0, -2.2, -1, 0); g.rotation.set(0.0, -0.12, 0.06);
  const white = L.M.paint('#e6e2d8', { panelW: 128, panelH: 256 }), grey = L.M.paint('#a9a59b', { rivets: false }), dark = L.M.dark;
  // the body: a long cylinder with a blunt rounded nose and a flared engine end
  const body = new THREE.CylinderGeometry(7, 7, 38, 48, 8); body.rotateZ(Math.PI / 2); L.mesh(body, white, 0, 6.2, 0, { parent: g });
  const nose = new THREE.SphereGeometry(7, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); nose.rotateZ(-Math.PI / 2); nose.scale(1.2, 1, 1); L.mesh(nose, white, 19, 6.2, 0, { parent: g });
  const flare = new THREE.CylinderGeometry(7, 8.4, 5, 48, 1); flare.rotateZ(Math.PI / 2); L.mesh(flare, grey, -21.5, 6.2, 0, { parent: g });
  for (const dz of [-3.6, 0, 3.6]) { const b = new THREE.CylinderGeometry(1.6, 2.2, 2.4, 20, 1, true); b.rotateZ(Math.PI / 2); L.mesh(b, dark, -25, 6.2 + dz * 0.6, dz, { parent: g }); }
  // the faded Accord stripe and the panel ribs
  const stripe = new THREE.CylinderGeometry(7.06, 7.06, 30, 48, 1, true, 0.2, 1.2); stripe.rotateZ(Math.PI / 2);
  L.mesh(stripe, mat('#7d8fa8', 0.9), -2, 6.2, 0, { parent: g });
  for (const x of [-15, -8, 1, 10]) { const r = new THREE.TorusGeometry(7.08, 0.18, 6, 48); r.rotateY(Math.PI / 2); L.mesh(r, grey, x, 6.2, 0, { parent: g }); }
  // the seed vault's hatch, open: a dark doorway in the flank, its door hanging down
  L.box(5, 4.6, 1.2, mat('#1c1a18', 0.95), 4, 5.2, 6.4, { parent: g });
  const door = L.box(5, 0.4, 4, white, 4, 3.0, 9.0, { parent: g }); door.rotation.x = 0.5;
  // antenna stubs and a broken fin
  L.cyl(0.25, 4, grey, -8, 13, 0, { parent: g }); L.cyl(0.18, 2.6, grey, 6, 12.8, -1.5, { parent: g });
  const fin = L.box(7, 0.5, 4, grey, -17, 12.6, 0, { parent: g }); fin.rotation.z = 0.35;
  // drift sand banked against it on both sides, burying its belly
  const sand = mat('#c4936a', 0.98);
  for (let k = 0; k < 9; k++) lump(4 + L.rnd() * 3, -24 + k * 6 + L.rnd() * 2, 0, 7.5 + L.rnd() * 2, sand, { sq: 0.45, sx: 1.4 });
  for (let k = 0; k < 7; k++) lump(4 + L.rnd() * 3, -20 + k * 7, 0, -7 - L.rnd() * 2, sand, { sq: 0.55, sx: 1.4 });
  lump(6, 25, 0, 0, sand, { sq: 0.5, sx: 1.2 });
}

// ------------------------------------------------------------------ the Ring Shard Spire
function spire() {
  floor();
  stain(42, 42, [70, 60, 72], 0.75);
  const rock = mat('#5d5560', 0.85, 0.2, { flat: true }), xtal = dayDim(L.M.crystal('#b38fec', '#b48cff', night() ? 1.1 : 0.12)), xtal2 = dayDim(L.M.crystal('#d2c0f4', '#cdb4ff', night() ? 1.3 : 0.15));
  // the shard: a thick curved slab of the Ring, driven in at a slant, its broken face jagged
  const arc = new THREE.TorusGeometry(26, 3.2, 8, 24, 1.0); const p = arc.attributes.position;
  for (let i = 0; i < p.count; i++) { const q = 1 + 0.08 * nz(p.getX(i) * 0.4, p.getY(i) * 0.4, p.getZ(i) * 0.4); p.setXYZ(i, p.getX(i) * q, p.getY(i) * q, p.getZ(i) * 1.6); }
  arc.computeVertexNormals();
  const sh = L.mesh(arc, rock, -6, -20, -2, { dirt: 0.4 }); sh.rotation.set(0.1, 0.5, 0.75);
  // the spire, and the crystals grown out of the shard and round its foot
  L.crystal(3.2, 30, 7, xtal, 0, 0, -1, -0.04, 0.05);
  L.crystal(1.8, 18, 4, xtal2, 3.2, 0, 1.2, 0.1, -0.22);
  L.crystal(1.6, 14, 4, xtal, -3.4, 0, 0.6, -0.08, 0.3);
  for (let k = 0; k < 16; k++) { const a = L.rnd() * 6.3, r = 5 + L.rnd() * 7; L.crystal(0.6 + L.rnd() * 0.9, 1.5 + L.rnd() * 4, 1 + L.rnd() * 1.5, k % 3 ? xtal : xtal2, Math.cos(a) * r, 0, Math.sin(a) * r * 0.9, (L.rnd() - 0.5) * 0.9, (L.rnd() - 0.5) * 0.9); }
  for (let k = 0; k < 14; k++) { const a = L.rnd() * 6.3, r = 6 + L.rnd() * 8; lump(1 + L.rnd() * 1.8, Math.cos(a) * r, 0, Math.sin(a) * r, rock, { sq: 0.7, detail: 1 }); }
  L.mark('top', 0, 36, -1);
}

// ------------------------------------------------------------------ a pillar of the Stone Forest
function pillar() {
  floor();
  stain(9, 9, [120, 60, 40], 0.5);
  const H = [0, 15, 19, 13][V] || 15, R0 = [0, 3.0, 2.4, 2.6][V] || 3;
  const g = new THREE.CylinderGeometry(1, 1, H, 14, 22), p = g.attributes.position, col = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i) + H / 2, z = p.getZ(i), a = Math.atan2(z, x), t = y / H;
    const band = Math.sin(y * 1.7 + nz(a, y * 0.3, 0) * 2) * 0.5 + 0.5;
    const r = R0 * (1 - 0.22 * t + 0.07 * Math.sin(y * 1.1) + 0.22 * nz(Math.cos(a) * 2.5, y * 0.45, Math.sin(a) * 2.5) - 0.08 * band) * (1 + 0.25 * smooth(2, 0, y));
    p.setXYZ(i, Math.cos(a) * r, y, Math.sin(a) * r);
    const c = 0.75 + 0.25 * band, dk = 0.75 + 0.25 * t;
    col.push(0.62 * c * dk, 0.3 * c * dk, 0.2 * c * dk);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  L.mesh(g, mat('#ffffff', 0.95, 0, { vc: true, flat: true }), 0, 0, 0);
  if (V === 3) lump(R0 * 1.5, 0, H - 0.6, 0, mat('#8a5a44', 0.9), { sq: 0.45, detail: 2 }); // (a hoodoo's cap)
  for (let k = 0; k < 4; k++) lump(0.6 + L.rnd() * 0.7, (L.rnd() - 0.5) * 7, 0, (L.rnd() - 0.2) * 5, mat('#a05a3c', 0.9), { detail: 1 });
}

// ------------------------------------------------------------------ the Long Falls
function falls() {
  floor();
  // the lip: rocks along the cliff top (the cliff is the map's rock behind), the water pouring between them
  const rock = mat('#6a6258', 0.9, 0, { flat: true });
  for (let k = 0; k < 9; k++) lump(2.4 + L.rnd() * 1.5, -15 + k * 3.7, 3.5 + L.rnd(), -2.5 - L.rnd() * 2, rock, { sq: 0.9, detail: 1 });
  for (const s of [-1, 1]) { lump(3.4, s * 16.5, 0, -1.5, rock, { sq: 1.3, detail: 1 }); lump(2.5, s * 15.5, 0, 2, rock, { sq: 0.8, detail: 1 }); }
  // the falling sheet: a curved ribbon from the lip to the pool, streaked
  const tex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#cfe6f2'; g.fillRect(0, 0, n, n);
    for (let k = 0; k < 220; k++) { const x = L.rnd() * n; g.fillStyle = `rgba(${L.rnd() < 0.6 ? '255,255,255' : '120,170,200'},${0.2 + L.rnd() * 0.5})`; g.fillRect(x, 0, 1 + L.rnd() * 4, n); }
  });
  const sheet = new THREE.PlaneGeometry(28, 1, 24, 16), sp = sheet.attributes.position;
  for (let i = 0; i < sp.count; i++) { const u = sp.getY(i) + 0.5; sp.setXYZ(i, sp.getX(i) * (1 - 0.08 * u), 7.2 * (1 - u) - 0.3, -3.2 + 3.4 * u * u + 0.15 * Math.sin(sp.getX(i) * 1.3)); }
  sheet.computeVertexNormals();
  const wm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0, side: THREE.DoubleSide, emissive: '#8fb8cc', emissiveIntensity: 0.15 }); wm.envMapIntensity = 1.2;
  const sm = new THREE.Mesh(sheet, wm); sm.castShadow = false; sm.receiveShadow = true; L.getRoot().add(sm);
  // the foam where it lands
  const foam = mat('#f4f8fa', 0.6);
  for (let k = 0; k < 22; k++) lump(1 + L.rnd() * 1.6, -13 + L.rnd() * 26, -0.4, 0.4 + L.rnd() * 2.2, foam, { sq: 0.45, detail: 2, k: 0.45 });
  L.mark('lip', 0, 7, -3.2);
}

// ------------------------------------------------------------------ the Clock Geyser
function geyser() {
  floor();
  stain(34, 34, [214, 196, 160], 0.6);
  const tiers = [[13, 0.9, '#e6d6b4'], [10.5, 1.9, '#dcc79c'], [8, 2.8, '#e8dcc0'], [5.2, 3.7, '#d9b57e'], [2.6, 4.6, '#c99a5c']];
  for (const [r, h, c] of tiers) {
    const g = new THREE.CylinderGeometry(r * 0.96, r, h, 64, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), q = 1 + 0.1 * nz(Math.cos(a) * 2 + r, 0, Math.sin(a) * 2) + 0.05 * Math.sin(a * 9 + r); p.setX(i, x * q); p.setZ(i, z * q); }
    g.translate(0, h / 2, 0); g.computeVertexNormals();
    L.mesh(g, mat(c, 0.75), 0, 0, 0, { dirt: 0.3 });
    // a warm pool on the tier (blue-green, its rim rust)
    if (r > 5) { const a = L.rnd() * 6.3, pr = r * 0.82; const pool = new THREE.CircleGeometry(1.6 + L.rnd(), 24); pool.rotateX(-Math.PI / 2); const pm = new THREE.Mesh(pool, (() => { const m = new THREE.MeshStandardMaterial({ color: ['#4fb6b8', '#6ac0a8', '#3f9fc4'][Math.floor(L.rnd() * 3)], roughness: 0.08, metalness: 0.1 }); m.envMapIntensity = 1.4; return m; })()); pm.position.set(Math.cos(a) * pr, h + 0.02, Math.sin(a) * pr * 0.95); L.getRoot().add(pm); }
  }
  // the vent: a dark throat in the cone's crown, wet sinter round it
  const throat = new THREE.CircleGeometry(1.1, 24); throat.rotateX(-Math.PI / 2); const tm = new THREE.Mesh(throat, mat('#1a1410', 0.4)); tm.position.y = 4.62; L.getRoot().add(tm);
  L.mark('vent', 0, 4.6, 0);
}

// ------------------------------------------------------------------ Passenger Town
function house() {
  floor();
  const body = ['#f2ede2', '#efe3c2', '#e6ece8'][V - 1], roofC = ['#a04a36', '#4c5e74', '#55704e'][V - 1];
  const wall = L.M.paint(body, { panelW: 512, panelH: 64, rivets: false, rough: 0.85, metal: 0 });
  L.ao(0, 0, 7, 6, 0.4);
  L.box(6.8, 3.6, 5.4, wall, 0, 0, 0);
  // a gable roof, overhanging
  const s = new THREE.Shape(); s.moveTo(-4, 0); s.lineTo(0, 2.6); s.lineTo(4, 0); s.closePath();
  const rg = new THREE.ExtrudeGeometry(s, { depth: 6.4, bevelEnabled: false }); rg.translate(0, 0, -3.2);
  L.mesh(rg, L.M.ribbed(roofC, { period: 12 }), 0, 3.6, 0, { dirt: 0.2 });
  L.box(0.8, 2.2, 0.8, L.M.rough('#8b7f72'), 2, 4.6, -1); // (the chimney)
  // windows (the night render lights them) and the door, the porch and its step
  const glass = L.M.glass('#8fb2c8', 0.85);
  for (const x of [-2.2, 2.2]) { L.box(1.4, 1.2, 0.1, glass, x, 1.4, 2.72, { cast: false }); L.box(1.6, 0.14, 0.2, L.M.plain('#ffffff'), x, 1.3, 2.75, { cast: false }); }
  L.box(1.1, 2.1, 0.12, L.M.plain(['#3f6d8c', '#8c3f3f', '#3f7a52'][V - 1]), 0, 0, 2.74);
  L.box(3, 0.25, 1.6, L.M.wood, 0, 0, 3.4); L.box(3.2, 0.2, 1.8, L.M.plain('#d8d2c4'), 0, 2.6, 3.4);
  for (const x of [-1.4, 1.4]) L.box(0.18, 2.6, 0.18, L.M.plain('#f4f1ea'), x, 0, 4.1);
  // a hedge and a mailbox by the walk
  for (let k = 0; k < 4; k++) lump(0.8, -3.4 + k * 0.6, 0, 4.2, mat('#4f7a3a', 0.9), { sq: 0.8, detail: 1 });
  L.cyl(0.08, 1.1, L.M.plain('#3a3a3a'), 3.6, 0, 4.4); L.box(0.6, 0.45, 0.4, L.M.plain('#3a5a7a'), 3.6, 1.1, 4.4);
}
function sign() {
  floor();
  const lit = night();
  const face = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#e9e3d0'; g.fillRect(0, 0, n, n);
    g.strokeStyle = '#2f5d86'; g.lineWidth = 18; g.strokeRect(14, 14, n - 28, n - 28);
    g.fillStyle = '#2f5d86'; g.textAlign = 'center'; g.font = 'bold 86px sans-serif'; g.fillText('WELCOME', n / 2, 190); g.font = 'bold 62px sans-serif'; g.fillText('TO ITHACA', n / 2, 280);
    g.font = '40px sans-serif'; g.fillStyle = '#6b6658'; g.fillText('PASSENGER TOWN', n / 2, 380);
  });
  const glowMap = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, n, n); g.fillStyle = '#fff'; g.textAlign = 'center';
    g.font = 'bold 86px sans-serif'; g.fillText('WELCOME', n / 2, 190); g.font = 'bold 62px sans-serif'; g.fillText('TO ITHACA', n / 2, 280);
  });
  const m = new THREE.MeshStandardMaterial({ map: face, roughness: 0.6, emissive: lit ? '#ffd27a' : '#000000', emissiveMap: glowMap, emissiveIntensity: lit ? 1.6 : 0 });
  if (lit) m.userData.glow = '#ffd27a';
  const pg = new THREE.PlaneGeometry(7.2, 3.6); const pm = new THREE.Mesh(pg, m); pm.position.set(0, 3.6, 0.2); pm.castShadow = true; L.getRoot().add(pm);
  L.box(7.6, 4, 0.3, L.M.plain('#2b3a48'), 0, 1.6, 0); // (its frame behind)
  for (const x of [-3.2, 3.2]) L.box(0.35, 1.8, 0.35, L.M.plain('#3a3530'), x, 0, 0);
  for (let k = 0; k < 6; k++) lump(0.5 + L.rnd() * 0.4, -3.4 + k * 1.35, 0, 0.9, mat(['#c84a6a', '#e8c24a', '#7a4ac8'][k % 3], 0.8), { sq: 0.6, detail: 1 }); // (a flower bed)
  if (lit) for (const x of [-2.4, 2.4]) L.lamp(x, 6.0, 1.0, '#ffe0a0', { size: 0.3, intensity: 8, dist: 6 });
}
function town() {
  const small = P.get('s') === '1', U = 10, ox = -45, oy = -45; // (the frame: 9 x 9 tiles, the town's middle tile at the centre)
  flat(90, 90, (g, n) => {
    const k = n / 90, px = (x) => (x - ox) * k, py = (y) => (y - oy) * k;
    const rows = small ? [-2, 0] : [-3, 3];
    // lawns: mown stripes, worn patches
    const y0 = py((rows[0] - 0.5) * U), y1 = py((rows[1] + 0.5) * U);
    g.fillStyle = '#4c6636'; g.fillRect(0, y0, n, y1 - y0);
    for (let x = 0; x < n; x += 22) { g.fillStyle = x / 22 % 2 ? 'rgba(255,255,230,0.07)' : 'rgba(0,30,0,0.06)'; g.fillRect(x, y0, 22, y1 - y0); }
    for (let i = 0; i < 70; i++) { const x = L.rnd() * n, y = y0 + L.rnd() * (y1 - y0), r = 6 + L.rnd() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${L.rnd() < 0.5 ? '160,150,90' : '60,100,40'},0.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // the street (the middle row; the bottom row in the small town), sidewalks either side, its centre line faded
    const sy = py(-0.35 * U), sh = 0.7 * U * k;
    g.fillStyle = '#8f8a7e'; g.fillRect(0, sy - 0.16 * U * k, n, sh + 0.32 * U * k);
    g.fillStyle = '#3b3b3d'; g.fillRect(0, sy, n, sh);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${L.rnd() < 0.5 ? '0,0,0' : '255,255,255'},0.08)`; g.fillRect(L.rnd() * n, sy + L.rnd() * sh, 2, 2); }
    g.strokeStyle = 'rgba(230,200,90,0.65)'; g.lineWidth = 0.08 * U * k; g.setLineDash([1.2 * U * k, 0.9 * U * k]); g.beginPath(); g.moveTo(0, sy + sh / 2); g.lineTo(n, sy + sh / 2); g.stroke(); g.setLineDash([]);
    // grass pushing through the cracks
    g.strokeStyle = 'rgba(90,130,60,0.6)'; g.lineWidth = 2;
    for (let i = 0; i < 26; i++) { const x = L.rnd() * n, y = sy + L.rnd() * sh; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (L.rnd() - 0.5) * 50, y + (L.rnd() - 0.5) * 14); g.stroke(); }
    // walks and driveways from each house to the street
    for (const r of small ? [-2] : [-2, 2]) for (const cx of [-3, -1, 1, 3]) {
      const x = px(cx * U), yH = py(r * U + (r < 0 ? 2.5 : -2.5)), yS = r < 0 ? sy - 0.16 * U * k : sy + sh + 0.16 * U * k;
      g.fillStyle = 'rgba(150,143,128,0.85)'; g.fillRect(x - 0.07 * U * k, Math.min(yH, yS), 0.14 * U * k, Math.abs(yS - yH));
    }
    // flower beds and a bus shelter's pad at the end of the street
    for (let i = 0; i < 18; i++) { g.fillStyle = ['#c84a6a', '#e8c24a', '#7a4ac8', '#e87a3a'][i % 4]; const x = L.rnd() * n, y = y0 + L.rnd() * (y1 - y0); if (Math.abs(y - sy - sh / 2) < sh) continue; for (let j = 0; j < 8; j++) { g.beginPath(); g.arc(x + (L.rnd() - 0.5) * 18, y + (L.rnd() - 0.5) * 8, 2.4, 0, 7); g.fill(); } }
    // the edge: the lawn's top and bottom fade into the land round it
    g.globalCompositeOperation = 'destination-out';
    for (const [y, dir] of [[y0, 1], [y1, -1]]) { const gr = g.createLinearGradient(0, y, 0, y + dir * 0.35 * U * k); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, Math.min(y, y + dir * 0.35 * U * k), n, 0.35 * U * k); }
    for (const [x, dir] of [[0, 1], [n, -1]]) { const gr = g.createLinearGradient(x, 0, x + dir * 0.35 * U * k, 0); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(Math.min(x, x + dir * 0.35 * U * k), 0, 0.35 * U * k, n); }
    g.globalCompositeOperation = 'source-over';
  }, 2048, { rough: 0.95 });
}

// ------------------------------------------------------------------ Glass Lake
function lake() {
  const U = 10, n = 2048;
  flat(120, 120, (g) => {
    const k = n / 120, cx = n / 2, cy = n / 2, rx = 4.95 * U * k, ry = 3.45 * U * k;
    // the ice: clear over the deep (dark green-blue in the middle), milky at the shallows
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, '#2f6f86'); gr.addColorStop(0.45, '#4f97ad'); gr.addColorStop(0.8, '#9cc9d8'); gr.addColorStop(1, '#d9eef4');
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rx, 0, 7); g.fill();
    // bubbles frozen in, and the pale sheets of old freezes
    for (let i = 0; i < 900; i++) { const a = L.rnd() * 6.3, r = Math.sqrt(L.rnd()) * rx * 0.95; g.fillStyle = `rgba(235,250,255,${0.15 + L.rnd() * 0.35})`; g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1 + L.rnd() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 40; i++) { const a = L.rnd() * 6.3, r = L.rnd() * rx * 0.8, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, s = 30 + L.rnd() * 120; const q = g.createRadialGradient(x, y, 0, x, y, s); q.addColorStop(0, 'rgba(220,240,248,0.18)'); q.addColorStop(1, 'rgba(220,240,248,0)'); g.fillStyle = q; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
    // cracks: long white lines branching across
    g.strokeStyle = 'rgba(245,252,255,0.75)';
    for (let i = 0; i < 14; i++) {
      let a = L.rnd() * 6.3, r = L.rnd() * rx * 0.6, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, d = L.rnd() * 6.3;
      g.lineWidth = 1 + L.rnd() * 2.5; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 18; s++) { d += (L.rnd() - 0.5) * 0.8; x += Math.cos(d) * 22; y += Math.sin(d) * 22; if (Math.hypot(x - cx, y - cy) > rx * 0.97) break; g.lineTo(x, y); }
      g.stroke();
    }
    // the rim: snow drifted onto the ice's edge
    for (let i = 0; i < 260; i++) { const a = L.rnd() * 6.3, r = rx * (0.93 + L.rnd() * 0.09), s = 14 + L.rnd() * 40; const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, q = g.createRadialGradient(x, y, 0, x, y, s); q.addColorStop(0, 'rgba(250,252,255,0.85)'); q.addColorStop(1, 'rgba(250,252,255,0)'); g.fillStyle = q; g.fillRect(x - s, y - s, 2 * s, 2 * s); }
    g.restore();
  }, n, { rough: 0.55, env: 0.25 });
}

// ------------------------------------------------------------------ Silent Crater
function crater() {
  const R = 33, NR = 90, NA = 180, pos = [], col = [], idx = [];
  const h = (r, a) => { const t = r / R, rim = Math.exp(-((t - 0.78) ** 2) / 0.012) * 3.2, bowl = -4.2 * smooth(0.82, 0.1, t), peak = 2.4 * Math.exp(-(t * t) / 0.006); return (rim + bowl + peak) * (1 + 0.15 * nz(Math.cos(a) * 3, t * 4, Math.sin(a) * 3)) * smooth(1, 0.9, t) + 0.3 * nz(Math.cos(a) * r * 0.4, 2, Math.sin(a) * r * 0.4) * smooth(1, 0.85, t); };
  for (let j = 0; j <= NR; j++) for (let i = 0; i <= NA; i++) {
    const a = (i / NA) * Math.PI * 2, r = (j / NR) * R, y = h(r, a);
    pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
    const v = 0.52 + 0.06 * nz(Math.cos(a) * r * 0.5, 9, Math.sin(a) * r * 0.5) + (r / R > 0.7 && r / R < 0.86 ? 0.06 : 0) - (r / R < 0.6 ? 0.04 : 0);
    col.push(v * 0.92, v * 0.92, v * 0.95, smooth(R, R * 0.86, r)); // (its outer slope fading into the ground round it)
  }
  for (let j = 0; j < NR; j++) for (let i = 0; i < NA; i++) { const a = j * (NA + 1) + i, b = a + 1, c = a + NA + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // shaded here, unlit in the render (the moon's grey as it is, the game's light grading it): a low sun from the upper
  // left, as the map's own craters are lit
  const nrm = g.attributes.normal, sun = new THREE.Vector3(-0.55, 0.62, -0.56).normalize();
  for (let i = 0; i < nrm.count; i++) { const d = Math.max(0, nrm.getX(i) * sun.x + nrm.getY(i) * sun.y + nrm.getZ(i) * sun.z), k = 0.45 + 0.75 * d; col[i * 4] *= k; col[i * 4 + 1] *= k; col[i * 4 + 2] *= k; }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  const cm = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const m = new THREE.Mesh(g, cm); L.getRoot().add(m);
  for (let k = 0; k < 40; k++) { const a = L.rnd() * 6.3, r = R * (0.3 + L.rnd() * 0.65); lump(0.3 + L.rnd() * 0.9, Math.cos(a) * r, h(r, a) - 0.2, Math.sin(a) * r, new THREE.MeshBasicMaterial({ color: '#6c6c70', toneMapped: false }), { detail: 1, sq: 0.7 }); }
}

// ------------------------------------------------------------------ a shaft of the Breach Fields
function shaft() {
  floor(40, 3.6);
  stain(10, 10, [70, 40, 90], 0.6);
  // the throat going down, dark, faint violet far below
  const t = new THREE.CylinderGeometry(3.6, 3.2, 30, 32, 6, true); t.translate(0, -15, 0);
  const tm = new THREE.MeshStandardMaterial({ color: '#1a1222', roughness: 0.9, side: THREE.BackSide }); L.getRoot().add(new THREE.Mesh(t, tm));
  const deep = new THREE.CircleGeometry(3.2, 24); deep.rotateX(-Math.PI / 2); const dm = new THREE.Mesh(deep, dayDim(L.M.emit('#4a2a78', night() ? 1.2 : 0.3))); dm.position.y = -29; L.getRoot().add(dm);
  // the lip: heaved earth and violet crystal crusting the rim, root-veins running over the edge
  const lip = new THREE.TorusGeometry(3.9, 0.9, 10, 40), lp = lip.attributes.position;
  for (let i = 0; i < lp.count; i++) { const q = 1 + 0.12 * nz(lp.getX(i), lp.getY(i), lp.getZ(i)); lp.setXYZ(i, lp.getX(i) * q, lp.getY(i) * q, lp.getZ(i) * q); }
  lip.rotateX(Math.PI / 2); lip.computeVertexNormals(); L.mesh(lip, mat('#5a4a52', 0.95), 0, 0.15, 0);
  const xt = dayDim(L.M.crystal('#a983e8', '#a46cff', night() ? 1.4 : 0.15));
  for (let k = 0; k < 11; k++) { const a = L.rnd() * 6.3, r = 4 + L.rnd() * 0.8; L.crystal(0.25 + L.rnd() * 0.35, 0.6 + L.rnd() * 1.4, 0.5, xt, Math.cos(a) * r, 0.2, Math.sin(a) * r, Math.sin(a) * 0.7, -Math.cos(a) * 0.7); }
  const vein = dayDim(L.M.emit('#6a3a9a', night() ? 1.0 : 0.1));
  for (let k = 0; k < 5; k++) { const a = L.rnd() * 6.3; L.pipe([[Math.cos(a) * 7.5, 0.05, Math.sin(a) * 7.5], [Math.cos(a + 0.2) * 5.5, 0.25, Math.sin(a + 0.2) * 5.5], [Math.cos(a + 0.3) * 3.8, 0.35, Math.sin(a + 0.3) * 3.8]], 0.09, vein); }
}

// ------------------------------------------------------------------ the wrecks of failed landings
function wreck() {
  floor();
  const look = {
    kestrel: { stain: [60, 54, 40], paint: '#8f8a7c', tilt: [0.05, 0.25, -0.08] },
    survey: { stain: [70, 66, 64], paint: '#b7b8b6', tilt: [0.12, -0.18, 0.05] },
    halvard: { stain: [120, 70, 38], paint: '#a3584a', tilt: [-0.1, 0.1, 0.32] },
  }[W];
  stain(40, 26, look.stain, 0.8);
  const hullM = L.M.paint(look.paint, { panelW: 128, panelH: 128 }), dark = L.M.dark, steel = L.M.steel, soot = mat('#2a2622', 0.95);
  const g = L.group(0, -1.6, -2, 0); g.rotation.set(...look.tilt);
  if (W === 'kestrel') {
    // a boxy cargo lander broken across the middle, the halves sagging into the mud
    const a = L.box(13, 7, 10, hullM, -7.5, 0, 0, { parent: g }); a.rotation.z = 0.08;
    const b = L.box(12, 6.4, 9.6, hullM, 6.8, -0.6, 0.6, { parent: g }); b.rotation.set(0.05, -0.18, -0.12);
    L.box(2.4, 6, 9, soot, -0.4, 0, 0.2, { parent: g }); // (the break, burned)
    for (const x of [-11, -6]) L.box(1.4, 3, 1.4, steel, x, 7, 3, { parent: g });
    L.box(4.2, 4, 0.6, mat('#121110', 0.95), -6, 1.2, 5.05, { parent: g }); // (the cargo door, open)
    const reed = mat('#6f7a3a', 0.9);
    for (let k = 0; k < 60; k++) { const x = -18 + L.rnd() * 36, z = (L.rnd() < 0.5 ? -1 : 1) * (6 + L.rnd() * 5); L.cyl(0.08, 1.5 + L.rnd() * 2.2, reed, x, 0, z, { seg: 5 }); }
  } else if (W === 'survey') {
    // a slim survey craft, its mast and dish still standing, ash drifted over it
    const body = new THREE.CylinderGeometry(3.6, 3.6, 24, 32, 4); body.rotateZ(Math.PI / 2); L.mesh(body, hullM, 0, 3.4, 0, { parent: g });
    const nose = new THREE.ConeGeometry(3.6, 7, 32); nose.rotateZ(-Math.PI / 2); L.mesh(nose, hullM, 15.5, 3.4, 0, { parent: g });
    L.cyl(0.3, 9, steel, -4, 6.5, 0, { parent: g });
    const dish = new THREE.SphereGeometry(3, 24, 8, 0, Math.PI * 2, 0, 0.9); const dm = L.mesh(dish, L.M.plain('#dcdcd6'), -4, 15, 0, { parent: g }); dm.rotation.set(Math.PI - 0.6, 0, 0.4);
    L.box(3.4, 3.8, 0.6, mat('#121110', 0.95), 3, 1.6, 3.4, { parent: g });
    const ash = mat('#8e8a86', 0.98);
    for (let k = 0; k < 10; k++) lump(2.5 + L.rnd() * 2, -14 + k * 3.2, 0, (k % 2 ? 1 : -1) * (4 + L.rnd() * 1.5), ash, { sq: 0.45, sx: 1.3 });
  } else {
    // a relay tender nose-down, its fins up, its bay open and full of leaves
    const body = new THREE.CylinderGeometry(4.2, 4.6, 22, 32, 4); body.rotateZ(Math.PI / 2); L.mesh(body, hullM, 0, 4, 0, { parent: g });
    for (const s of [-1, 1]) { const f = L.box(6, 0.5, 5, hullM, -10, 6, s * 4.8, { parent: g }); f.rotation.x = s * 0.5; }
    L.box(6, 0.4, 5.2, mat('#121110', 0.95), 1, 7.6, 0, { parent: g }); // (the open bay)
    L.box(1, 3, 1, steel, -6, 8, 0, { parent: g });
    const leaf = [mat('#d8632a', 0.9), mat('#e0a030', 0.9), mat('#b8402a', 0.9)];
    for (let k = 0; k < 140; k++) { const x = -18 + L.rnd() * 36, z = -10 + L.rnd() * 20, pg = new THREE.CircleGeometry(0.35 + L.rnd() * 0.25, 5); pg.rotateX(-Math.PI / 2 + (L.rnd() - 0.5) * 0.6); const m = new THREE.Mesh(pg, leaf[k % 3]); m.position.set(x, 0.05 + (Math.abs(z) < 5 && Math.abs(x) < 10 ? 7.8 : 0), z); m.rotation.y = L.rnd() * 6; m.receiveShadow = true; L.getRoot().add(m); }
  }
  // the hatch, toward the camera: a dark doorway with its door fallen open onto the ground
  L.box(3, 3.4, 1, mat('#0f0e0d', 0.95), 0, 0.4, 6.4);
  const door = L.box(3, 0.3, 3, hullM, 0, 0, 8.4); door.rotation.x = -0.12;
  for (let k = 0; k < 8; k++) lump(1.2 + L.rnd() * 1.4, -14 + L.rnd() * 28, 0, (L.rnd() < 0.5 ? -1 : 1) * (5 + L.rnd() * 3), mat(W === 'halvard' ? '#7a5a3a' : W === 'survey' ? '#7c7874' : '#4a4232', 0.98), { sq: 0.5, sx: 1.4, detail: 2 });
}
