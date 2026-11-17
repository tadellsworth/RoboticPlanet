// Proposed new map resources (IDEAS.md: "Redesign the Fiber and Oil resources on the map"): three directions for
// Fiber's Stalk grove and three for the Oil seep's pump spot, for the owner to choose from. Not shipped.
// Resources are drawn one tile across, centred on the tile (drawResource in js/render.js), and graded for the time of
// day in code, so each is one day render; its glow pass becomes the night glow map (post/resource_post.py).
//   ?c=fiber&v=1|2|3&g=0.25..1   Fiber, at a growth stage g (1 = full; the game draws regrowing stalks smaller)
//       v=1 reedcane: a clump of jointed canes, sage-teal, banded at the joints, mint plumes on the tallest
//       v=2 flaxfan:  a rosette of long strap leaves whose tips fray into fine mint fibres
//       v=3 flosspod: a low woody shrub hung with husks split open on balls of mint-white floss
//   ?c=vent&v=1|2|3               the spot on an oil seep where a Pump goes (the seep itself is a texture the game
//                                 draws across all the seep's tiles, see terrain/oil_seeps.py)
//       v=1 tar blister: a glossy black dome of tar, burst at the top, ringed with ripples
//       v=2 pitch well:  a ring of broken crust slabs round a black mouth where fresh oil wells up
//       v=3 survey stake: an old Pathfinder survey stake in a pool of crude, banded orange and white, its lamp still lit
// Framing: one tile is 9.52 world units (the buildings' scale); the canvas is one tile, the base at 60% down.
const P = new URLSearchParams(location.search);
const C = P.get('c') || 'fiber', V = +(P.get('v') || 1), G = Math.max(0.15, Math.min(1, +(P.get('g') || 1)));
export const config = { pad: false, size: 512 };
const TILE = 9.52;

export default function (L) {
  const { THREE } = L;
  L.seed(7000 + V * 100 + (C === 'vent' ? 50 : 0));
  L.frameCompoundOpts({ half: TILE / 2, width: 1.0, cy: 0.6 });
  const R = () => L.rnd();
  const mats = mk(L);
  if (C === 'fiber') { contactShadow(L, 3.4 * (0.5 + 0.5 * G)); [reedcane, flaxfan, flosspod][V - 1](L, mats, G, R); }
  else [tarBlister, pitchWell, surveyStake][V - 1](L, mats, R);
}

// ---------------------------------------------------------------------------------------------------- kit
function mk(L) {
  const { THREE } = L;
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.envMapIntensity = o.env ?? 0.5; return m; };
  const glowM = (hex, k, glow) => { const m = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: k, roughness: 0.6 }); m.userData.glow = glow || hex; return m; };
  return {
    std, glowM,
    oil: () => { const m = new THREE.MeshPhysicalMaterial({ color: '#040302', roughness: 0.1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, specularIntensity: 0.7 }); m.envMapIntensity = 0.42; return m; },
  };
}
function contactShadow(L, r, a = 0.42) {
  const { THREE } = L, n = 128;
  const tex = L.canvasTex(n, (g) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.5})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const pg = new THREE.PlaneGeometry(r * 2.4, r * 1.9); pg.rotateX(-Math.PI / 2);
  const pm = new THREE.Mesh(pg, m); pm.position.set(0.5, 0.01, 0.4); pm.userData.decal = true; L.getRoot().add(pm);
}
// a smooth tube through points, radius r(t)
function tube(L, pts, rf, mat, seg = 40, radial = 8) {
  const { THREE } = L;
  const c = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(c, seg, 1, radial, false), pos = g.attributes.position, nrm = g.attributes.normal;
  // scale each ring to rf(t)
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = c.getPointAt(t), rr = rf(t);
    for (let j = 0; j <= radial; j++) { const k = i * (radial + 1) + j; pos.setXYZ(k, p.x + nrm.getX(k) * rr, p.y + nrm.getY(k) * rr, p.z + nrm.getZ(k) * rr); }
  }
  g.computeVertexNormals();
  return L.mesh(g, mat, 0, 0, 0, { dirt: 0 });
}
// a strap leaf along a spine: width w(t), lying flat-ish (its face turned up), slightly folded along the midrib
function leaf(L, spine, wf, mat, fold = 0.25) {
  const { THREE } = L;
  const c = new THREE.CatmullRomCurve3(spine.map(p => new THREE.Vector3(...p))), N = 24, pos = [], uv = [], idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = c.getPointAt(t), tg = c.getTangentAt(t), side = new THREE.Vector3().crossVectors(tg, up).normalize(), nup = new THREE.Vector3().crossVectors(side, tg).normalize(), w = wf(t);
    for (const s of [-1, 0, 1]) { const q = p.clone().addScaledVector(side, s * w).addScaledVector(nup, Math.abs(s) * w * fold); pos.push(q.x, q.y, q.z); uv.push(t, s * 0.5 + 0.5); }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = L.mesh(g, mat, 0, 0, 0, { dirt: 0.2, dirtH: 2 }); m.material.side = THREE.DoubleSide; return m;
}
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------- FIBER
// 1 REEDCANE. Tall jointed canes in a tight clump: the stalk as a stalk. Sage-teal, a darker teal band at every joint,
// narrow leaves drooping from the joints, and mint plumes of seed-floss on the tallest canes (they glow faintly at
// night, the only light it gives). Its upright silhouette is unlike anything else on the map.
function reedcane(L, M, g, R) {
  const caneM = M.std({ color: '#62c4a2', roughness: 0.45, vertexColors: true, env: 0.7 });
  const jointM = M.std({ color: '#0f5446', roughness: 0.45 });
  const leafM = M.std({ color: '#2f9a78', roughness: 0.6 });
  const plumeM = M.glowM('#b4f6de', 0.22, '#3fe0b0');
  const n = Math.round(lerp(5, 12, g));
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + R() * 0.5, r0 = 0.25 + R() * 1.0, H = (3.2 + R() * 2.4) * lerp(0.35, 1, g), lean = 0.14 + R() * 0.12;
    const bx = Math.cos(a) * r0, bz = Math.sin(a) * r0, tx = bx + Math.cos(a) * H * lean, tz = bz + Math.sin(a) * H * lean;
    const pts = [[bx, 0, bz], [lerp(bx, tx, 0.35), H * 0.35, lerp(bz, tz, 0.35)], [lerp(bx, tx, 0.7), H * 0.7, lerp(bz, tz, 0.7)], [tx, H, tz]];
    const rr = (0.2 + R() * 0.07) * lerp(0.7, 1, g);
    tube(L, pts, t => rr * (1 - 0.35 * t), caneM, 24, 8);
    const nj = Math.max(1, Math.floor(H / 1.3));
    for (let j = 1; j <= nj; j++) {
      const t = j / (nj + 0.6), p = [lerp(bx, tx, t), H * t, lerp(bz, tz, t)];
      const ring = new L.THREE.TorusGeometry(rr * (1 - 0.35 * t) * 1.05, rr * 0.32, 6, 16); ring.rotateX(Math.PI / 2);
      L.mesh(ring, jointM, p[0], p[1], p[2], { dirt: 0, cast: false });
      if (R() < 0.5 && g > 0.3) {   // a leaf from the joint, arching out and down
        const la = a + (R() - 0.5) * 1.6, ll = 1.6 + R() * 1.4;
        leaf(L, [p, [p[0] + Math.cos(la) * ll * 0.5, p[1] + 0.35, p[2] + Math.sin(la) * ll * 0.5], [p[0] + Math.cos(la) * ll, p[1] - 0.5, p[2] + Math.sin(la) * ll]], t2 => 0.22 * Math.sin(Math.PI * Math.min(1, t2 * 1.1)) + 0.02, leafM, 0.15);
      }
    }
    if (g >= 0.7 && H > 3.9 * lerp(0.35, 1, g)) {   // the plume: a soft spray of floss at the top
      for (let q = 0; q < 6; q++) {
        const qa = R() * Math.PI * 2, ql = 0.35 + R() * 0.45;
        tube(L, [[tx, H - 0.1, tz], [tx + Math.cos(qa) * ql * 0.5, H + 0.45 + R() * 0.3, tz + Math.sin(qa) * ql * 0.5], [tx + Math.cos(qa) * ql, H + 0.15, tz + Math.sin(qa) * ql]], t => 0.11 * (1 - 0.6 * t) + 0.02, plumeM, 10, 5);
      }
    }
  }
}

// 2 FLAXFAN. A rosette of long, stiff strap leaves arching out from the centre, dark teal with a pale stripe, each tip
// splitting into fine mint fibres: you can see the fibre in it. Two flower spikes rise from the centre when it is full.
function flaxfan(L, M, g, R) {
  const leafM = M.std({ color: '#1c9a7a', roughness: 0.5 });
  const leafM2 = M.std({ color: '#2cb38e', roughness: 0.5 });
  const fibreM = M.glowM('#c4fae6', 0.28, '#3fe8b4');
  const n = Math.round(lerp(7, 16, g));
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + (k % 2) * 0.2 + R() * 0.15, len = (2.3 + R() * 1.1) * lerp(0.45, 1, g), rise = 1.3 + R() * 0.8;
    const ca = Math.cos(a), sa = Math.sin(a);
    const spine = [[ca * 0.2, 0.15, sa * 0.2], [ca * len * 0.35, rise * 0.9, sa * len * 0.35], [ca * len * 0.7, rise * 0.85, sa * len * 0.7], [ca * len, rise * 0.35, sa * len]];
    leaf(L, spine, t => 0.38 * (1 - 0.65 * t) * lerp(0.75, 1, g) + 0.03, k % 2 ? leafM : leafM2, 0.35);
    if (g >= 0.55) {   // the frayed tip: fine fibres splaying from the end of the leaf
      const e = spine[3];
      for (let q = 0; q < 4; q++) {
        const fa = a + (q - 1.5) * 0.12, fl = 0.35 + R() * 0.3;
        tube(L, [e, [e[0] + Math.cos(fa) * fl * 0.6, e[1] + 0.05, e[2] + Math.sin(fa) * fl * 0.6], [e[0] + Math.cos(fa) * fl, e[1] - 0.25, e[2] + Math.sin(fa) * fl]], t => 0.035 * (1 - 0.5 * t) + 0.01, fibreM, 8, 4);
      }
    }
  }
  if (g >= 0.85) for (const [x, z, h] of [[0.2, -0.1, 4.2], [-0.3, 0.25, 3.5]]) {
    tube(L, [[x, 0.2, z], [x + 0.1, h * 0.5, z], [x + 0.25, h, z + 0.1]], t => 0.09 * (1 - 0.4 * t), leafM, 16, 6);
    for (let q = 0; q < 7; q++) { const t = 0.6 + q * 0.06, a2 = q * 2.4; tube(L, [[x + 0.25 * t, h * t, z], [x + 0.25 * t + Math.cos(a2) * 0.35, h * t + 0.25, z + Math.sin(a2) * 0.35]], () => 0.07, fibreM, 4, 4); }
  }
}

// 3 FLOSSPOD. A low, woody shrub hung with husks split open on balls of mint-white floss, like cotton. Unripe (regrowing)
// the husks are shut and green; ripe they open and the floss shows, glowing faintly at night.
function flosspod(L, M, g, R) {
  const { THREE } = L;
  const woodM = M.std({ color: '#3a463e', roughness: 0.85 });
  const huskM = M.std({ color: '#25735a', roughness: 0.65 });
  const leafM = M.std({ color: '#26a07c', roughness: 0.55 });
  const flossM = M.std({ color: '#cffbe9', roughness: 0.95, emissive: '#6ff0c0', emissiveIntensity: 0.16 }); flossM.userData.glow = '#2fc896';
  const pods = [];
  const nb = Math.round(lerp(5, 9, g));
  for (let k = 0; k < nb; k++) {   // twisted branches out from the base
    const a = k / nb * Math.PI * 2 + R() * 0.4, len = (2.0 + R() * 1.2) * lerp(0.5, 1, g), h = (1.6 + R() * 1.0) * lerp(0.5, 1, g);
    const pts = [[0, 0, 0], [Math.cos(a) * len * 0.3, h * 0.6, Math.sin(a) * len * 0.3], [Math.cos(a + 0.3) * len * 0.75, h, Math.sin(a + 0.3) * len * 0.75], [Math.cos(a + 0.2) * len, h * 0.9, Math.sin(a + 0.2) * len]];
    tube(L, pts, t => 0.22 * (1 - 0.7 * t) + 0.03, woodM, 20, 6);
    pods.push(pts[3], pts[2]);
    for (let q = 0; q < 3; q++) { const p = pts[1 + q % 3], la = a + (R() - 0.5) * 2, ll = 0.9 + R() * 0.6; leaf(L, [p, [p[0] + Math.cos(la) * ll * 0.5, p[1] + 0.2, p[2] + Math.sin(la) * ll * 0.5], [p[0] + Math.cos(la) * ll, p[1] - 0.1, p[2] + Math.sin(la) * ll]], t2 => 0.3 * Math.sin(Math.PI * t2) + 0.02, leafM, 0.2); }
  }
  const ripe = g >= 0.75;
  pods.forEach((p, k) => {
    if (k % 2 && !ripe) return;
    const s = (0.36 + R() * 0.16) * lerp(0.6, 1, g), y = p[1] + 0.15;
    if (!ripe) { const m = L.sphere(s * 0.6, huskM, p[0], y, p[2], { dirt: 0 }); m.scale.set(1, 1.4, 1); return; }
    // the husk split into four petals, curled back, and the floss bursting out of it
    for (let q = 0; q < 4; q++) {
      const a = q / 4 * Math.PI * 2 + k, ca = Math.cos(a), sa = Math.sin(a);
      leaf(L, [[p[0], y - 0.1, p[2]], [p[0] + ca * s * 0.7, y + 0.1, p[2] + sa * s * 0.7], [p[0] + ca * s * 1.1, y - 0.25, p[2] + sa * s * 1.1]], t => 0.25 * s * Math.sin(Math.PI * Math.min(1, t * 1.05)) + 0.02, huskM, -0.3);
    }
    const geo = new THREE.IcosahedronGeometry(s, 3), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), yy = pos.getY(i), z = pos.getZ(i), q = 1 + 0.18 * Math.sin(x * 7 + k) * Math.sin(yy * 6) * Math.sin(z * 8 + k); pos.setXYZ(i, x * q, yy * q * 0.85, z * q); }
    geo.computeVertexNormals();
    L.mesh(geo, flossM, p[0], y + s * 0.45, p[2], { dirt: 0 });
  });
}

// ---------------------------------------------------------------------------------------------------- OIL: the pump spot
// 1 TAR BLISTER. Crude pushes up under the tar and swells into a glossy blister; the newest has burst. Ripple rings show
// the oil still moving. Black with a warm brown where it is thin, no rainbow.
function tarBlister(L, M, R) {
  const { THREE } = L, oil = M.oil();
  const brown = new THREE.MeshPhysicalMaterial({ color: '#2a1608', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1 }); brown.envMapIntensity = 1.2;
  // the dome, burst at the top: a lathe of the profile, with a collar of thin brown tar where it spreads
  const prof = [[0.001, 0.5], [0.55, 0.66], [1.0, 0.62], [1.6, 0.46], [2.1, 0.28], [2.6, 0.11], [3.0, 0.03], [3.3, 0.0]];
  const lg = new THREE.LatheGeometry(prof.slice().reverse().map(([r, y]) => new THREE.Vector2(r, y)), 64); L.mesh(lg, oil, 0, 0, 0, { dirt: 0 });
  const crater = new THREE.TorusGeometry(0.65, 0.16, 10, 32); crater.rotateX(Math.PI / 2); L.mesh(crater, oil, 0, 0.66, 0, { dirt: 0 });
  L.mesh(new THREE.CircleGeometry(0.6, 32).rotateX(-Math.PI / 2), M.std({ color: '#020101', roughness: 0.05 }), 0, 0.55, 0, { dirt: 0 });
  for (const [r, w] of [[3.55, 0.08]]) { const t = new THREE.TorusGeometry(r, w, 8, 72); t.rotateX(Math.PI / 2); t.scale(1, 0.4, 1); L.mesh(t, brown, 0, 0.0, 0, { dirt: 0, cast: false }); }
  for (let k = 0; k < 7; k++) { const a = R() * 6.28, r = 1.2 + R() * 2.6, s = 0.12 + R() * 0.25; const m = L.sphere(s, oil, Math.cos(a) * r, 0.05, Math.sin(a) * r, { dome: true, dirt: 0 }); }
}

// 2 PITCH WELL. The seep has dried to a crust of pitch; at the pump spot the crust has broken into slabs round a black
// mouth where fresh oil wells up and spills. The slabs make a clear socket for the Pump's footing.
function pitchWell(L, M, R) {
  const { THREE } = L, oil = M.oil();
  const crustM = M.std({ color: '#3a302a', roughness: 0.9, vertexColors: true, env: 0.3 });
  L.mesh(new THREE.CircleGeometry(2.0, 40).rotateX(-Math.PI / 2), oil, 0, 0.18, 0, { dirt: 0 });
  const dome = new THREE.SphereGeometry(1.25, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.35, 1); L.mesh(dome, oil, 0, 0.18, 0, { dirt: 0 });
  const n = 11;
  for (let k = 0; k < n; k++) {
    const a = k / n * Math.PI * 2 + R() * 0.2, r = 2.6 + R() * 0.35, w = 1.3 + R() * 0.5, d = 1.3 + R() * 0.6, th = 0.4 + R() * 0.15;
    const g = new THREE.BoxGeometry(w, th, d, 3, 1, 3), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + 0.15 * Math.sin(p.getZ(i) * 5 + k)), p.getY(i), p.getZ(i) * (1 + 0.12 * Math.sin(p.getX(i) * 4 + k)));
    g.computeVertexNormals();
    const m = L.mesh(g, crustM, Math.cos(a) * r, 0.18 + th * 0.3, Math.sin(a) * r, { dirt: 0.5, dirtH: th });
    m.rotation.y = -a; m.rotation.z = 0.0; m.rotateX((R() - 0.5) * 0.2); m.rotateZ(0.18 + R() * 0.2);   // tipped up toward the mouth
  }
  // oil spilling out between two slabs, running off down-right
  const sp = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2); sp.scale(1.9, 1, 0.7); L.mesh(sp, oil, 2.7, 0.1, 1.6, { dirt: 0, ry: -0.6 });
}

// 3 SURVEY STAKE. A pool of crude and, in it, the Pathfinder's survey stake: the joint lander marked every seep it
// found before the vanguards came. A pole banded hazard orange and white, a cap with a small amber lamp that still
// blinks at night, a tag plate at its foot. Put a Pump here: the stake says so.
function surveyStake(L, M, R) {
  const { THREE } = L, oil = M.oil();
  const pool = new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2), p = pool.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + 0.12 * Math.sin(a * 3 + 1) + 0.07 * Math.sin(a * 7); p.setXYZ(i, x * 2.6 * k, 0, z * 2.1 * k); }
  L.mesh(pool, oil, 0, 0.04, 0, { dirt: 0 });
  const orange = M.std({ color: '#e0661c', roughness: 0.6 }), white = M.std({ color: '#e6e2d8', roughness: 0.6 }), steel = L.M.steel;
  const g = L.group(0.3, 0, -0.2); g.rotation.z = -0.12; g.rotation.x = 0.08;   // leaning a little, after years
  const H = 4.6, n = 6;
  for (let k = 0; k < n; k++) L.cyl(0.24, H / n, k % 2 ? white : orange, 0, k * H / n, 0, { parent: g, seg: 16, dirt: 0.2 });
  L.cyl(0.42, 0.3, steel, 0, H, 0, { parent: g, seg: 16, dirt: 0 });
  const lampM = new THREE.MeshStandardMaterial({ color: '#ffb547', emissive: '#ffb547', emissiveIntensity: 1.6, roughness: 0.3 }); lampM.userData.glow = '#ffa030';
  L.sphere(0.26, lampM, 0, H + 0.42, 0, { parent: g, cast: false, dirt: 0 });
  L.box(1.1, 0.7, 0.06, white, 0.0, 0.6, 0.27, { parent: g, dirt: 0.4 });
  L.box(1.0, 0.12, 0.07, orange, 0.0, 1.1, 0.28, { parent: g, dirt: 0 });
  for (let k = 0; k < 5; k++) { const a = R() * 6.28, r = 1.3 + R() * 1.2; L.sphere(0.1 + R() * 0.15, oil, Math.cos(a) * r, 0.04, Math.sin(a) * r, { dome: true, dirt: 0 }); }
}
