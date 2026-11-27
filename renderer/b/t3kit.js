// Shared parts for Terraforming stage 3's scenes (seamdrill.js, seedmast.js, thermal.js, seedbed.js; ART_GUIDE Batch 37):
// lava, steam, labelled hoppers like the Deep Core's, a red lattice mast in the Deep Core's steel, crystal clusters
// (Ring Crystal as the Crystal Tap has it, and grown Crystal in rows: a lighter lilac than Ring Crystal, toned down by
// day so it still reads as Crystal, its tips lit at night).
export function t3(L) {
  const { THREE, M, mesh, box, cyl, sphere, beam, rnd } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), nf = +(p.get('n') || 8);
  const ph = (f / nf) * Math.PI * 2;
  const night = L.TOD === 'night' || L.TOD === 'evening';
  // Deep Core red steel, so the drills read as its family
  const red = M.paint('#a8342a', { rivets: false, rough: 0.6, metal: 0.35 }), redD = M.paint('#7e2620', { rivets: false, rough: 0.6, metal: 0.35 });
  const gun = M.paint('#50565c'), gunD = M.paint('#3f4449', { rivets: false }), off = M.paint('#c9c5ba'), hole = M.plain('#07060a', 1, 0);
  const steamMat = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 1, transparent: true, opacity: 0.16, depthWrite: false });
  const steamMatD = new THREE.MeshStandardMaterial({ color: '#f6f6f2', roughness: 1, transparent: true, opacity: 0.26, depthWrite: false });
  function puff(x, y, z, r, mat = steamMat) { for (let i = 0; i < 5; i++) sphere(r * (0.5 + 0.18 * i), mat, x + (rnd() - 0.5) * r * 0.9, y + (rnd() - 0.5) * r * 0.7, z + (rnd() - 0.5) * r * 0.9, { cast: false, dirt: 0 }); }
  // a rising plume: k puffs climbing and widening from (x, y, z), phase t (0..1) shifts them up the column
  function plume(x, y, z, r, k = 5, t = 0, drift = 0.35, mat = steamMat, h = 4.2) {
    for (let i = 0; i < k; i++) { const s = (i + t) / k; puff(x + drift * s * 3, y + s * h, z - drift * s * 1.5, r * (0.7 + 1.6 * s), mat); }
  }
  // lava: an emissive cracked-crust texture (orange veins in black crust)
  const lavaTex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#ff7a12'; g.fillRect(0, 0, n, n);
    for (let i = 0; i < 600; i++) { const x = rnd() * n, y = rnd() * n, r = 4 + rnd() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,230,120,0.5)'); gr.addColorStop(1, 'rgba(255,230,120,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    for (let i = 0; i < 70; i++) { const x = rnd() * n, y = rnd() * n, r = 12 + rnd() * 46; g.fillStyle = `rgba(${18 + rnd() * 20},${10 + rnd() * 10},8,0.97)`; g.beginPath(); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28, rr = r * (0.6 + rnd() * 0.5); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill(); }
  });
  lavaTex.wrapS = lavaTex.wrapT = THREE.RepeatWrapping;
  const lavaMat = new THREE.MeshStandardMaterial({ color: '#2a120a', emissive: '#ffffff', emissiveMap: lavaTex, emissiveIntensity: 1.25, roughness: 0.7 });
  lavaMat.userData.glow = '#ff6a1a';
  function lava(x, z, w, d, ry = 0) {
    const g = new THREE.PlaneGeometry(w, d, 1, 1); g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 6, uv.getY(i) * d / 6);
    return mesh(g, lavaMat, x, 0.05, z, { dirt: 0, cast: false, ry });
  }
  // a basalt rim: lumpy dark rocks along a line
  const basalt = M.rough('#2b2826'), basaltL = M.rough('#46403b');
  function rocks(x0, z0, x1, z1, n = 8, s = 0.45) {
    for (let i = 0; i < n; i++) { const t = i / (n - 1); const g = new THREE.DodecahedronGeometry(s * (0.6 + rnd() * 0.7), 0); g.scale(1, 0.55, 1); mesh(g, rnd() < 0.5 ? basalt : basaltL, x0 + (x1 - x0) * t + (rnd() - 0.5) * 0.3, 0.1, z0 + (z1 - z0) * t + (rnd() - 0.5) * 0.3, { dirt: 0, ry: rnd() * 6 }); }
  }
  // a labelled hopper like the Deep Core's (ORE rust, CRY violet), team rim
  function hopper(x, z, txt, c0, c1, s = 1) {
    for (const dx of [-0.55, 0.55]) for (const dz of [-0.5, 0.5]) box(0.12 * s, 1.1 * s, 0.12 * s, M.paint('#5b6168', { metal: 0.4 }), x + dx * s, 0, z + dz * s, { dirt: 0.3 });
    const fg = new THREE.CylinderGeometry(0.95 * s, 0.32 * s, 1.0 * s, 4, 1); fg.rotateY(Math.PI / 4); fg.scale(1, 1, 0.86); fg.translate(0, 0.5 * s, 0);
    mesh(fg, M.paint(c0, { rivets: false, rough: 0.6 }), x, 1.1 * s, z, { dirt: 0.4, dirtH: 1 });
    const tm = M.emit(L.TEAM === '#ff5a6e' ? '#ff2a40' : L.TEAM, 1.6), W = 1.36 * s, D = 1.18 * s, y = 2.1 * s;
    box(W - 0.1, 0.04, D - 0.1, M.plain('#151313', 0.9), x, y - 0.02, z, { dirt: 0, cast: false });
    box(W, 0.08, 0.07, tm, x, y, z + D / 2, { dirt: 0, cast: false }); box(W, 0.08, 0.07, tm, x, y, z - D / 2, { dirt: 0, cast: false });
    box(0.07, 0.08, D, tm, x + W / 2, y, z, { dirt: 0, cast: false }); box(0.07, 0.08, D, tm, x - W / 2, y, z, { dirt: 0, cast: false });
    // its load showing in the mouth: ore lumps or crystal shards
    for (let i = 0; i < 7; i++) { const g = new THREE.DodecahedronGeometry(0.13 * s, 0); mesh(g, txt === 'CRY' ? M.crystal('#6b4fe0', '#2f22a0', 0.4) : M.plain('#5a3a28', 0.85), x + (rnd() - 0.5) * W * 0.6, y, z + (rnd() - 0.5) * D * 0.6, { dirt: 0, cast: false }); }
    const tex = L.canvasTex(256, (g, n) => { g.fillStyle = c0; g.fillRect(0, 0, n, n); g.fillStyle = '#f2eee4'; g.font = 'bold 110px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, n / 2, n / 2 + 6); g.strokeStyle = c1; g.lineWidth = 12; g.strokeRect(12, 12, n - 24, n - 24); });
    const lm = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const pl = new THREE.PlaneGeometry(0.8 * s, 0.6 * s); mesh(pl, lm, x, 1.55 * s, z + 0.64 * s, { dirt: 0, cast: false, rx: -0.35 });
  }
  // a lattice mast in the Deep Core's red: four legs from base half-width b0 to top b1 over height h, braced in X's
  function mast(x, z, h, b0, b1, tiers = 5, o = {}) {
    const at = (sx, sz, y) => { const k = y / h, b = b0 + (b1 - b0) * k; return [x + sx * b, (o.y ?? 0) + y, z + sz * b]; };
    const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    for (const [sx, sz] of legs) beam(at(sx, sz, 0), at(sx, sz, h), 0.16, 0.16, red, { dirt: 0 });
    for (let k = 0; k < tiers; k++) {
      const y0 = h * k / tiers, y1 = h * (k + 1) / tiers;
      for (const [a, b] of [[[-1, -1], [1, -1]], [[-1, 1], [1, 1]], [[-1, -1], [-1, 1]], [[1, -1], [1, 1]]]) {
        beam(at(a[0], a[1], y1), at(b[0], b[1], y1), 0.09, 0.09, redD, { dirt: 0 });
        beam(at(a[0], a[1], y0), at(b[0], b[1], y1), 0.06, 0.06, red, { dirt: 0 });
      }
    }
  }
  // Ring Crystal as the Crystal Tap shows it (deep blue-violet), and grown Crystal: paler, lilac, lit tips, in rows
  const cryNat = M.crystal('#5440e6', '#2f22a0', 0.3);
  const cryGrown = night ? M.crystal('#7b5cf0', '#3a2a8a', 0.55) : M.crystal('#6a50d8', '#1c1448', 0.04).clone();
  if (!night) { cryGrown.envMapIntensity = 0.7; cryGrown.roughness = 0.3; cryGrown.userData.glow = '#1c1448'; } // (by day: a lighter lilac than Ring Crystal, not white)
  const cryTip = M.emit(night ? '#d9c4ff' : '#c2acf6', night ? 2.2 : 0.7); cryTip.userData.glow = '#6f55c8';
  function cluster(x, z, s, mat = cryNat, n = 5, y = 0) {
    L.crystal(0.3 * s, 1.5 * s, 0.5 * s, mat, x, y, z, 0, 0);
    for (let i = 1; i < n; i++) { const a = i / (n - 1) * 6.28 + rnd(); L.crystal((0.14 + rnd() * 0.1) * s, (0.6 + rnd() * 0.6) * s, 0.3 * s, mat, x + Math.cos(a) * 0.22 * s, y, z + Math.sin(a) * 0.22 * s, Math.sin(a) * 0.5, -Math.cos(a) * 0.5); }
  }
  // grown crystal sprig at stage s (0..1): a short hex prism with a glowing tip, on a seed pin
  function sprig(x, z, s, y = 0) {
    if (s <= 0) return;
    const h = 0.15 + 1.1 * s, r = 0.05 + 0.13 * s;
    L.crystal(r, h, r * 2.2, cryGrown, x, y, z, (rnd() - 0.5) * 0.25, (rnd() - 0.5) * 0.25);
    if (s > 0.3) for (let i = 0; i < 2; i++) { const a = rnd() * 6.28; L.crystal(r * 0.6, h * 0.55, r * 1.3, cryGrown, x + Math.cos(a) * r * 1.4, y, z + Math.sin(a) * r * 1.4, Math.sin(a) * 0.6, -Math.cos(a) * 0.6); }
    sphere(r * 0.45, cryTip, x, y + h + r * 1.4, z, { cast: false, dirt: 0 });
  }
  return { f, nf, ph, night, red, redD, gun, gunD, off, hole, steamMat, steamMatD, puff, plume, lava, lavaMat, rocks, basalt, hopper, mast, cryNat, cryGrown, cryTip, cluster, sprig };
}
