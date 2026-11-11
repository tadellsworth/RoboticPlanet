// The Keep: a fortified modern concrete base with a heavy twin pulse cannon on its roof, in the dark wired style
// of the Walls (razor wire on insulator posts, live arcs). Rendered in layers on the shared pad framing (the same
// scheme as the Pulse Turret, Mortar Pit and Flak Gun):
//   ?part=base            the base: a battered reinforced-concrete outer wall with horizontal gun slots on every
//                         face, a low hexagonal pillbox at each corner, a recessed steel blast door at the front, a
//                         raised blockhouse in the middle with its own slots and team light strips, razor wire coiled
//                         on insulator posts round the top of the outer wall, floodlights, an antenna mast with the
//                         team beacon, and an EMPTY turntable on the blockhouse roof
//   ?part=head&rot=k&n=N  the cannon alone: an armoured turret with twin coil barrels ending in violet emitters,
//                         turned to direction k of N (0 = right, then clockwise seen from above). No team colour.
//   ?part=spark&f=k       frame k of the live wire: two or three crackling arcs between the insulator posts (only
//                         the arcs: the game lays them over the base now and then)
export default function (L) {
  const { box, cyl, hcyl, mesh, sphere, group, mark, pointLight, ao, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), part = p.get('part') || 'base', rot = +(p.get('rot') || 0), n = +(p.get('n') || 16), frame = +(p.get('f') || 0);
  L.seed(919);
  const conc = M.paint('#5d6164', { rivets: false, panelW: 256, panelH: 128, rough: 0.9, metal: 0.04 });
  const concD = M.paint('#45494c', { rivets: false, panelW: 256, panelH: 128, rough: 0.9, metal: 0.04 });
  const concL = M.paint('#6b6f72', { rivets: false, panelW: 512, panelH: 256, rough: 0.9, metal: 0.04 });
  const steel = M.paint('#3c4146', { panelW: 128, panelH: 170 }), rib = M.paint('#2c3034', { rivets: false });
  const team = M.paint(TEAM, { rivets: false }), glow = M.emit(TEAM, 2.6), flood = M.emit('#fff4e0', 3), slitGlow = M.emit('#ff9a50', 0.7);
  const iron = M.plain('#2c2e30', 0.55, 0.7), wire = M.plain('#8a8f94', 0.35, 0.85), ins = M.plain('#e8e4d8', 0.3, 0.05);
  const armor = M.paint('#4a4f55'), armorD = M.paint('#33373b', { rivets: false }), violet = M.emit('#b48cff', 3.2);
  const cz = -0.25;
  const frustum = (b0, b1, h, mat, y, o) => { const g = new THREE.CylinderGeometry(b1 * Math.SQRT2, b0 * Math.SQRT2, h, 4, 1); g.rotateY(Math.PI / 4); g.translate(0, h / 2, 0); return mesh(g, mat, 0, y, cz, o); };
  // A horizontal gun slot on a wall face: a dark recess with a steel lip above and a faint glow inside.
  const slot = (x, y, z, w, ry, P) => {
    const g = group(x, y, cz + z, ry, P.parent);
    box(w, 0.26, 0.2, M.dark, 0, 0, 0, { parent: g, dirt: 0, cast: false });
    box(w * 0.9, 0.12, 0.05, slitGlow, 0, 0.07, -0.06, { parent: g, dirt: 0, cast: false });
    box(w + 0.24, 0.08, 0.32, steel, 0, 0.26, 0.04, { parent: g, dirt: 0.2 });
  };
  const H1 = 2.1, OUT = 4.05; // the outer wall's height and half-size at its foot

  // ---- base layer
  const base = group(0, 0, 0, 0);
  const B = { parent: base };
  ao(0, cz, 9.6, 9.6, 0.55);
  box(9.2, 0.18, 9.2, concD, 0, 0, cz, { dirt: 0.5, ...B });                                  // the slab it stands on
  frustum(OUT, OUT - 0.42, H1, conc, 0.18, { dirt: 0.4, dirtH: 1.0, ...B });                   // the battered outer wall
  box(2 * (OUT - 0.42) + 0.1, 0.16, 2 * (OUT - 0.42) + 0.1, concL, 0, 0.18 + H1, cz, { dirt: 0.15, ...B }); // its coping
  // gun slots round the outer wall: two each side of the door at the front, three on the other faces
  const sy = 1.25, f = OUT - 0.23;
  for (const u of [-2.55, -1.55, 1.55, 2.55]) slot(u, sy, f, 0.7, 0, B);
  for (const u of [-2.0, 0, 2.0]) { slot(u, sy, -f, 0.75, Math.PI, B); slot(f, sy, u, 0.75, -Math.PI / 2, B); slot(-f, sy, u, 0.75, Math.PI / 2, B); }
  // the recessed steel blast door at the front
  const dz = cz + OUT - 0.3;
  box(2.4, 1.95, 0.5, concD, 0, 0.18, dz - 0.05, { dirt: 0.25, ...B });
  for (const s of [-1, 1]) {
    box(1.0, 1.75, 0.16, steel, s * 0.52, 0.2, dz + 0.16, { dirt: 0.3, dirtH: 0.9, ...B });
    for (const y of [0.4, 1.0, 1.55]) box(0.88, 0.12, 0.05, rib, s * 0.52, 0.2 + y, dz + 0.26, { dirt: 0.2, ...B });
    box(0.88, 0.2, 0.05, M.hazard, s * 0.52, 0.22, dz + 0.27, { dirt: 0, ...B });
  }
  box(0.05, 1.55, 0.04, glow, 0, 0.3, dz + 0.27, { dirt: 0, cast: false, ...B });
  // hexagonal pillboxes at the corners, each with slots facing out
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * 3.55, z = sz * 3.55;
    cyl(1.25, 2.7, conc, x, 0.18, cz + z, { seg: 6, dirt: 0.4, dirtH: 1, ...B });
    cyl(1.33, 0.16, concL, x, 2.88, cz + z, { seg: 6, dirt: 0.1, ...B });
    cyl(1.27, 0.08, glow, x, 2.62, cz + z, { seg: 6, dirt: 0, cast: false, ...B });
    const a0 = Math.atan2(sz, sx);
    for (const a of [a0 - 0.55, a0 + 0.55]) slot(x + Math.cos(a) * 1.12, 1.6, z + Math.sin(a) * 1.12, 0.55, -a + Math.PI / 2, B);
    // a floodlight on each pillbox, angled out
    box(0.4, 0.28, 0.3, iron, x - sx * 0.4, 3.04, cz + z - sz * 0.4, { dirt: 0, ...B });
    box(0.32, 0.2, 0.05, flood, x - sx * 0.4 + sx * 0.1, 3.08, cz + z - sz * 0.4 + sz * 0.17, { ry: -a0 + Math.PI / 2, dirt: 0, cast: false, ...B });
  }
  // razor wire round the top of the outer wall, on insulator posts
  const WY = 0.18 + H1 + 0.16, WI = OUT - 0.55, posts = [];
  const coil = (a, b, axis, at) => {
    const turns = Math.max(3, Math.round(Math.abs(b - a) / 0.28)), pts = [];
    for (let i = 0; i <= turns * 12; i++) {
      const t = i / (turns * 12), ang = t * turns * Math.PI * 2, u = a + (b - a) * t;
      pts.push(axis === 'x' ? new THREE.Vector3(u, WY + 0.42 + Math.sin(ang) * 0.24, cz + at + Math.cos(ang) * 0.24) : new THREE.Vector3(at + Math.cos(ang) * 0.24, WY + 0.42 + Math.sin(ang) * 0.24, cz + u));
    }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 12, 0.022, 4, false), wire, 0, 0, 0, { dirt: 0, ...B });
  };
  for (const s of [-1, 1]) {
    coil(-2.3, 2.3, 'x', s * WI); coil(-2.3, 2.3, 'z', s * WI);
    for (const u of [-2.3, -0.75, 0.75, 2.3]) for (const [x, z] of [[u, s * WI], [s * WI, u]]) {
      box(0.1, 0.75, 0.1, iron, x, WY, cz + z, { dirt: 0, ...B });
      cyl(0.07, 0.15, ins, x, WY + 0.72, cz + z, { seg: 10, dirt: 0, ...B });
      posts.push([x, WY + 0.86, z]);
    }
  }
  // the raised blockhouse in the middle: its own slots, team light strips under the parapet, vents
  const H2 = 0.18 + H1 + 0.16, BH = 1.55, BS = 2.45;
  frustum(BS, BS - 0.2, BH, concD, H2, { dirt: 0.3, ...B });
  for (const [x, z, ry] of [[0, BS - 0.12, 0], [0, -BS + 0.12, Math.PI], [BS - 0.12, 0, -Math.PI / 2], [-BS + 0.12, 0, Math.PI / 2]]) {
    for (const u of [-1.2, 1.2]) slot(x + (ry === 0 || ry === Math.PI ? u : 0), H2 + 0.75, z + (ry === 0 || ry === Math.PI ? 0 : u), 0.6, ry, B);
  }
  const RY = H2 + BH;
  box(2 * BS - 0.2, 0.3, 2 * BS - 0.2, concL, 0, RY, cz, { dirt: 0.1, ...B });                // the roof parapet slab
  for (const [w, d, x, z] of [[2 * BS - 0.6, 0.06, 0, BS - 0.12], [2 * BS - 0.6, 0.06, 0, -BS + 0.12], [0.06, 2 * BS - 0.6, BS - 0.12, 0], [0.06, 2 * BS - 0.6, -BS + 0.12, 0]]) box(w, 0.12, d, glow, x, RY - 0.3, cz + z, { dirt: 0, cast: false, ...B });
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7]]) { box(0.6, 0.35, 0.45, armorD, x, RY + 0.3, cz + z, { dirt: 0.2, ...B }); box(0.5, 0.05, 0.36, M.dark, x, RY + 0.66, cz + z, { dirt: 0, ...B }); }
  // the turntable for the cannon
  const RT = RY + 0.3;
  const ring = new THREE.RingGeometry(1.45, 1.72, 48); ring.rotateX(-Math.PI / 2);
  mesh(ring, M.hazard, 0, RT + 0.006, cz, { dirt: 0, cast: false, ...B });
  cyl(1.4, 0.14, M.steel, 0, RT, cz, { seg: 48, dirt: 0, ...B });
  // the antenna mast with the team beacon, and a small radome, at the back right
  cyl(0.07, 2.4, M.steel, 1.85, RT, cz - 1.85, { seg: 10, ...B });
  for (const y of [0.9, 1.6]) box(0.6, 0.04, 0.04, M.steel, 1.85, RT + y, cz - 1.85, { dirt: 0, ...B });
  sphere(0.2, glow, 1.85, RT + 2.5, cz - 1.85, { cast: false, ...B });
  sphere(0.42, M.paint('#c9c5ba', { rivets: false }), -1.85, RT + 0.42, cz - 1.85, { ...B });

  // ---- spark layer: crackling arcs between neighbouring insulator posts
  const sparkG = group(0, 0, 0, 0);
  if (part === 'spark') {
    L.seed(4100 + frame * 97);
    const live = M.emit('#9fe4ff', 4), core = M.emit('#ffffff', 5);
    const jag = (a, b, r) => {
      const pts = [], k = 9;
      for (let i = 0; i <= k; i++) {
        const t = i / k, j = i === 0 || i === k ? 0 : r;
        pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t + (L.rnd() - 0.5) * j, a[1] + (b[1] - a[1]) * t + (L.rnd() - 0.3) * j, cz + a[2] + (b[2] - a[2]) * t + (L.rnd() - 0.5) * j));
      }
      const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
      mesh(new THREE.TubeGeometry(c, 40, 0.035, 5, false), live, 0, 0, 0, { parent: sparkG, dirt: 0, cast: false });
      mesh(new THREE.TubeGeometry(c, 40, 0.014, 4, false), core, 0, 0, 0, { parent: sparkG, dirt: 0, cast: false });
    };
    const runs = 2 + (frame % 2);
    for (let r = 0; r < runs; r++) {
      const i = Math.floor(L.rnd() * posts.length), a = posts[i];
      const near = posts.filter((q) => q !== a && Math.hypot(q[0] - a[0], q[2] - a[2]) < 1.7);
      const b = near.length ? near[Math.floor(L.rnd() * near.length)] : posts[(i + 1) % posts.length];
      jag(a, b, 0.35);
      if (L.rnd() < 0.6) jag(a, [a[0] + (L.rnd() - 0.5) * 0.8, a[1] + 0.5, a[2] + (L.rnd() - 0.5) * 0.8], 0.25); // a spur flicking up
      sphere(0.09, core, a[0], a[1], cz + a[2], { parent: sparkG, cast: false });
      sphere(0.07, live, b[0], b[1], cz + b[2], { parent: sparkG, cast: false });
    }
  }

  // ---- head layer: the cannon, built at the origin facing +x, then set on the turntable
  const head = group(0, 0, 0, 0);
  const H = { parent: head };
  cyl(1.3, 0.22, armorD, 0, 0, 0, { seg: 8, ry: Math.PI / 8, dirt: 0.2, ...H });
  box(2.3, 0.95, 2.0, armor, -0.25, 0.22, 0, { dirt: 0.2, ...H });
  { const g = new THREE.BoxGeometry(0.9, 0.95, 2.0); g.translate(0, 0.475, 0); const m = mesh(g, armor, 1.0, 0.22, 0, { dirt: 0.2, ...H }); m.rotation.z = 0.55; }
  box(1.05, 0.33, 1.15, armorD, -0.55, 1.17, 0, { dirt: 0.1, ...H });
  hcyl(0.12, 0.5, M.dark, -0.05, 1.36, 0.33, { ...H });
  sphere(0.09, violet, 0.2, 1.36, 0.33, { cast: false, ...H });
  for (const s of [-0.46, 0.46]) {
    hcyl(0.25, 0.7, armorD, 1.25, 0.7, s, { ...H });
    hcyl(0.15, 2.8, M.paint('#2f3338', { rivets: false, metal: 0.5, rough: 0.45 }), 2.65, 0.7, s, { ...H });
    for (let k = 0; k < 5; k++) hcyl(0.21, 0.09, M.chrome, 1.85 + k * 0.43, 0.7, s, { ...H });
    hcyl(0.23, 0.17, armorD, 4.0, 0.7, s, { ...H });
    hcyl(0.16, 0.05, violet, 4.1, 0.7, s, { cast: false, ...H });
  }
  head.position.set(0, RT + 0.14, cz); head.scale.setScalar(0.85); head.rotation.y = -rot * (Math.PI * 2 / n);
  mark('muzzle', 4.15, 0.7, 0, head); mark('plate', 0, 0, 0, head);

  if (part === 'base') {
    head.visible = false;
    pointLight(TEAM, 3.0, 0, RT + 1.0, cz, 4);
    pointLight('#fff1d8', 2.2, 0, 2.8, cz + 5, 4);
  } else {
    base.visible = false;
    if (part !== 'head') head.visible = false;
    L.hidePad(); L.getRoot().traverse((o) => { if (o.userData.decal) o.visible = false; });
  }
}
