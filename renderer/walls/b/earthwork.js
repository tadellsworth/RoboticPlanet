// Terraforming stage 4's earthworks as per-tile pieces that join like the Walls (the owner's picks from the stage 4
// canvas: Earth Bank = Berm concept A, Fire Trench = Revetted concept A, Dragon's Teeth = Tank traps concept B).
//   k = bank | trench | teeth        piece = post | n | e | s | w | hub        d = 0 intact | 1 worn | 2 breached
//   (hub: a bank's middle on a straight run, where its arms already make the bank: the stake alone, no mound)
// The orthographic walls camera: a tile is 10 world units across (x) and 2 * TILE_NS deep (z), so the pieces of
// neighbouring tiles meet on screen. The ground is left out (transparent, shadows only): the game draws the pieces
// over its own ground, baked with the map. A Fire Trench is cut below the ground: an invisible occluder stands for the
// ground round the cut, so only what shows through the cut is drawn. The team's colour is on the post only (a bank's
// stake, a trench's lamp post, a tooth's cat's-eyes): the arms are the same for every team.
// Seamless along a line: an arm's bumps repeat every tile (sines of whole periods), so an arm's end meets the next
// tile's arm. The scene for the concepts (renderer/walls/b/ew.js on the design canvas) rendered dioramas; this one
// renders the game's pieces.
const Q = new URLSearchParams(location.search);
const K = Q.get('k') || 'bank', P0 = Q.get('piece') || 'post', HUB = P0 === 'hub', P = HUB ? 'post' : P0, D = +(Q.get('d') || 0);

export default function (L) {
  const { THREE, M, TEAM, TILE_NS, box, cyl, mesh } = L;
  L.seed(7100 + K.length * 31 + P.charCodeAt(0) * 7 + D * 3);
  const ZT = 2 * TILE_NS;                         // a tile's depth in world z
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  // bumps that repeat every tile along x and z (so pieces join): u, v in tiles
  const bump = (u, v) => 0.5 * Math.sin(TAU * 2 * u + 1.3) * Math.cos(TAU * v + 0.4) + 0.3 * Math.sin(TAU * 3 * v + 2.1) * Math.sin(TAU * u * 1 + 0.7) + 0.2 * Math.sin(TAU * 5 * (u + v) + 0.2);
  const glowM = M.emit(/^#ff5a6e$/i.test(TEAM) ? '#ff2a40' : TEAM, 2.6);
  const earthHex = '#8a6246';
  // the region of this piece, in tiles: [u0, u1] x [v0, v1] (u across = x / 10, v down = z / ZT), and how far along its arm a point is
  const arm = P !== 'post';
  const reg = { post: [-0.5, 0.5, -0.5, 0.5], e: [0, 0.5, -0.5, 0.5], w: [-0.5, 0, -0.5, 0.5], n: [-0.5, 0.5, -0.5, 0], s: [-0.5, 0.5, 0, 0.5] }[P];
  const across = (u, v) => (P === 'e' || P === 'w' ? Math.abs(v) : P === 'n' || P === 's' ? Math.abs(u) : Math.hypot(u, v));
  const along = (u, v) => (P === 'e' || P === 'w' ? Math.abs(u) : Math.abs(v));
  // craters for a worn or breached piece
  const craters = [];
  if (D) for (let k = 0; k < (D === 1 ? 2 : 3); k++) craters.push([(L.rnd() - 0.5) * 0.6 * (reg[1] - reg[0]) + (reg[0] + reg[1]) / 2, (L.rnd() - 0.5) * 0.6 * (reg[3] - reg[2]) + (reg[2] + reg[3]) / 2, 0.08 + L.rnd() * 0.06]);

  /** A heightfield patch over the piece's region: h(u, v) world height; its alpha fades out where it meets the ground. */
  function field(h, mat, o = {}) {
    const n = 64, w = (reg[1] - reg[0]) * 10, dz = (reg[3] - reg[2]) * ZT;
    const geo = new THREE.PlaneGeometry(w, dz, n, n); geo.rotateX(-Math.PI / 2);
    geo.translate(((reg[0] + reg[1]) / 2) * 10, 0, ((reg[2] + reg[3]) / 2) * ZT);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / 10, v = pos.getZ(i) / ZT, y = h(u, v);
      pos.setY(i, y);
      const a = o.solid ? 1 : sm(0.02, 0.35, Math.abs(y)), sh = 0.86 + 0.14 * Math.sin(across(u, v) * 80 + bump(u, v) * 3); // (blade furrows along it)
      col[i * 4] = sh; col[i * 4 + 1] = sh * 0.97; col[i * 4 + 2] = sh * 0.94; col[i * 4 + 3] = a;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ map: mat.map, color: '#ffffff', vertexColors: true, transparent: !o.solid, roughness: 0.95, metalness: 0, depthWrite: true });
    m.envMapIntensity = 0.3;
    return mesh(geo, m);
  }
  const crat = (u, v, h) => { for (const [cu, cv, r] of craters) { const d = Math.hypot(u - cu, v - cv) / r; if (d < 1) h -= 0.8 * (1 - d * d) * Math.max(0.3, h / 3); else if (d < 1.6) h += 0.15 * Math.sin((d - 1) / 0.6 * Math.PI); } return h; };

  if (K === 'bank') {
    // a broad, rounded bank of turned earth, stones on its slopes, the team's survey stake on the crest (the post)
    const H = 3.4 * (D === 1 ? 0.72 : 1);
    const prof = (d) => H * (1 - sm(0.07, 0.46, d));
    const earth = M.rough(earthHex);
    if (!HUB) field((u, v) => {
      let h = prof(across(u, v));
      if (h > 0.05) h += 0.35 * bump(u, v) * Math.min(1, h);
      if (D === 2) h *= arm ? sm(0.14, 0.44, along(u, v)) * 0.85 : 0.08; // (breached: the middle gone, slumped ends)
      return Math.max(0, crat(u, v, h));
    }, earth);
    const stones = [M.rough('#8a8174'), M.rough('#5a4232')];
    for (let k = 0; k < (arm ? 4 : HUB ? 0 : 6); k++) {
      const u = reg[0] + L.rnd() * (reg[1] - reg[0]), v = reg[2] + L.rnd() * (reg[3] - reg[2]), d = across(u, v);
      if (d < 0.14 || d > 0.4 || (D === 2 && (!arm || along(u, v) < 0.2))) continue;
      const g = new THREE.DodecahedronGeometry(0.22 + L.rnd() * 0.3, 0); g.scale(1, 0.6, 1);
      mesh(g, stones[k % 2], u * 10, prof(d) * (D === 2 ? 0.5 : 1) - 0.1, v * ZT, { dirt: 0, ry: L.rnd() * 6 });
    }
    if (D === 2 && !arm) for (let k = 0; k < 9; k++) { const g = new THREE.DodecahedronGeometry(0.3 + L.rnd() * 0.45, 1); g.scale(1, 0.55, 1); mesh(g, earth, (L.rnd() - 0.5) * 5, 0, (L.rnd() - 0.5) * 5, { dirt: 0, ry: L.rnd() * 6 }); }
    if (!arm && D < 2) { // the stake
      const y = prof(0) - 0.3, h = 2.0;
      cyl(0.12, h, M.paint('#d8d2c2', { rivets: false }), 0.6, y, -0.4, { seg: 8 });
      cyl(0.13, 0.22, M.paint('#d0741e', { rivets: false }), 0.6, y + h * 0.55, -0.4, { seg: 8, dirt: 0 });
      cyl(0.22, 0.3, glowM, 0.6, y + h, -0.4, { seg: 10, dirt: 0, cast: false });
    }
  }

  if (K === 'trench') {
    // a revetted cut: corrugated steel on both walls, a duckboard floor, sandbag parapets on both lips, a team lamp post
    const w = 0.17, depth = 2.1, sheet = M.ribbed('#6d6458', { period: 18 }), bag = M.rough('#9a8763'), earthD = M.rough('#5a4232');
    // the ground round the cut, as an occluder (only the cut shows)
    const big = 40, cut = new THREE.Shape();
    cut.moveTo(-big, -big); cut.lineTo(big, -big); cut.lineTo(big, big); cut.lineTo(-big, big); cut.closePath();
    const hole = new THREE.Path(), hx = w * 10, hz = w * ZT;
    const rx0 = P === 'e' ? -hx : P === 'w' ? -5.02 : -hx, rx1 = P === 'e' ? 5.02 : P === 'w' ? hx : hx;
    const rz0 = P === 'n' ? -TILE_NS - 0.02 : -hz, rz1 = P === 's' ? TILE_NS + 0.02 : hz;
    const [x0, x1, z0, z1] = P === 'post' ? [-hx, hx, -hz, hz] : P === 'n' || P === 's' ? [-hx, hx, rz0, rz1] : [rx0, rx1, -hz, hz];
    hole.moveTo(x0, z0); hole.lineTo(x0, z1); hole.lineTo(x1, z1); hole.lineTo(x1, z0); hole.closePath();
    cut.holes.push(hole);
    L.asOccluder(() => { const g = new THREE.ShapeGeometry(cut); g.rotateX(Math.PI / 2); mesh(g, M.dark, 0, 0.001, 0, { dirt: 0 }); });
    const filled = D === 2;
    // the cut's walls and floor
    const along2 = P === 'n' || P === 's';
    const len = along2 ? z1 - z0 : x1 - x0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wid = along2 ? x1 - x0 : z1 - z0;
    const fl = filled ? -0.6 : -depth;
    box(along2 ? wid : len, 0.1, along2 ? len : wid, M.rough('#3a332c'), cx, fl, cz, { dirt: 0.2 });
    if (!filled) for (const s of [-1, 1]) { // steel sheets on the two long walls (and the end walls of a post)
      if (D === 1 && L.rnd() < 0.3) continue;
      if (along2) box(0.08, depth, len, sheet, cx + s * (wid / 2 - 0.04), -depth, cz, { dirt: 0.6, dirtH: 1 });
      else box(len, depth, 0.08, sheet, cx, -depth, cz + s * (wid / 2 - 0.04), { dirt: 0.6, dirtH: 1 });
    }
    if (!filled) for (let k = 0; k < Math.max(1, Math.round(len / 0.8)); k++) { // duckboards
      const t = (k + 0.5) / Math.max(1, Math.round(len / 0.8)), px = along2 ? cx : x0 + t * len, pz = along2 ? z0 + t * len : cz;
      box(along2 ? wid * 0.8 : 0.5, 0.07, along2 ? 0.5 : wid * 0.8, M.wood, px, -depth + 0.1, pz, { dirt: 0.5 });
    }
    // slumped earth in a worn cut; spoil heaped in a breached one
    for (let k = 0; k < (D === 1 ? 3 : D === 2 ? 7 : 0); k++) { const g = new THREE.DodecahedronGeometry(0.5 + L.rnd() * 0.6, 1); g.scale(1, 0.5, 1); mesh(g, D === 2 ? M.rough(earthHex) : earthD, cx + (L.rnd() - 0.5) * (along2 ? wid : len) * 0.8, fl + 0.2, cz + (L.rnd() - 0.5) * (along2 ? len : wid) * 0.8, { dirt: 0, ry: L.rnd() * 6 }); }
    // sandbags on both lips
    const bagAt = (x, z, ry) => mesh(new THREE.BoxGeometry(1.1, 0.42, 0.66, 2, 1, 1), bag, x, 0, z, { ry, dirt: 0.4 });
    const n = Math.max(1, Math.round(len / 1.15));
    for (const s of [-1, 1]) for (let k = 0; k < n; k++) {
      if (D === 1 && L.rnd() < 0.35) continue;
      if (D === 2 && L.rnd() < 0.75) continue;
      const t = (k + 0.5) / n, off = wid / 2 + 0.45;
      if (along2) bagAt(cx + s * off, z0 + t * len, Math.PI / 2); else bagAt(x0 + t * len, cz + s * off, 0);
      if (D === 0 && k % 2 === 0) { if (along2) bagAt(cx + s * off, z0 + t * len + 0.2, Math.PI / 2).position.y = 0.4; else bagAt(x0 + t * len + 0.2, cz + s * off, 0).position.y = 0.4; }
    }
    if (!arm && D < 2) { // the lamp post at the far lip
      const x = 1.6, z = -hz - 1.0;
      box(0.22, 2.6, 0.22, M.paint('#4c4f52'), x, 0, z, {});
      box(0.4, 0.22, 0.3, M.dark, x, 2.5, z + 0.1, { dirt: 0 });
      box(0.3, 0.08, 0.1, glowM, x, 2.54, z + 0.27, { cast: false, dirt: 0 });
    }
  }

  if (K === 'teeth') {
    // cast concrete pyramids on footings, two staggered rows; a cat's-eye in the team's colour on the post's tooth
    const conc = M.rough('#a69e90'), concD = M.rough('#7e776c');
    const spots = [];
    if (!arm) spots.push([0, 0, true]);
    else for (const [a, o] of [[0.28, -0.13], [0.43, 0.13]]) {
      const sg = P === 'n' || P === 'w' ? -1 : 1;
      spots.push(P === 'e' || P === 'w' ? [sg * a, o * 1.0, false] : [o, sg * a, false]);
    }
    spots.forEach(([u, v, eye], k) => {
      const x = u * 10, z = v * ZT, r = L.rnd();
      if (D === 2 && (r < 0.7 || !arm)) { for (let q = 0; q < 5; q++) { const g = new THREE.DodecahedronGeometry(0.25 + L.rnd() * 0.4, 0); mesh(g, L.rnd() < 0.5 ? conc : concD, x + (L.rnd() - 0.5) * 2.4, 0, z + (L.rnd() - 0.5) * 2.4, { ry: L.rnd() * 6, dirt: 0.3 }); } return; }
      const chip = D === 1 && r < 0.5, hh = chip ? 1.5 : 2.2;
      const m = cyl(1.05, hh, conc, x, 0.15, z, { seg: 4, rTop: chip ? 0.5 : 0.2, ry: Math.PI / 4, dirt: 0.7, dirtH: 0.8 });
      if (D === 1) { m.rotation.z = (L.rnd() - 0.5) * 0.35; m.rotation.x = (L.rnd() - 0.5) * 0.25; }
      box(1.6, 0.25, 1.6, concD, x, -0.05, z, { ry: Math.PI / 4, dirt: 0.8 });
      if (eye && D < 2 && !chip) box(0.34, 0.1, 0.06, glowM, x, 1.2, z + 0.58, { cast: false, dirt: 0 });
    });
  }
}
