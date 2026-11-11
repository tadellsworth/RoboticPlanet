// Strike Bomber: a big, flat twin-engine high-speed bomber in the manner of a Foxbat, top-down, facing +x,
// orthographic camera straight down, no ground (the game draws its shadow). 20 world units across the frame; it is
// 18.6 long (19.3 with the nose probe) with an 11.5 span. Its planform follows a three-view: a long black radome on
// a slim nose, a light-blue tandem canopy, big box intakes either side running back into a broad, flat body with a
// spine down the middle, a thin wing swept about 43 degrees with a straight trailing edge and anti-flutter pods on
// the tips, swept stabilators reaching past the tail, twin fins canted out, and two big nozzles side by side.
// Light grey with darker engine bays. Team colour: stars on the wings, the fin caps and the bands on the bombs
// hung under the wings (their noses show ahead of the leading edge). At night: navigation lights and the engines.
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, hcyl, mesh, sphere, M, THREE, TEAM } = L;
  L.seed(3131);
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  // ---- materials: a clean aircraft skin (white texture with panel lines, tinted per part)
  const skinTex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, n, n);
    L.blotches(g, n, 50, 30, 110, 0.035); L.blotches(g, n, 30, 20, 80, 0.05, '255,255,255');
    g.strokeStyle = 'rgba(28,32,36,0.42)'; g.lineWidth = 1.6;
    const ln = (a, b, c, d) => { g.beginPath(); g.moveTo(a, b); g.lineTo(c, d); g.stroke(); };
    for (let x = 0; x <= n; x += 128) ln(x, 0, x, n);                        // frames across the body
    for (let y = 0; y <= n; y += 128) for (let x = 0; x < n; x += 128) ln(x, y + ((x / 128) % 2) * 40, x + 128, y + ((x / 128) % 2) * 40);
    g.strokeStyle = 'rgba(28,32,36,0.28)'; g.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const x = Math.floor(L.R(0, 4)) * 128 + 20, y = L.R(10, n - 60), w = L.R(30, 70), h = L.R(20, 45); g.strokeRect(x, y, w, h); }
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(30,30,30,0.35)'; g.fillRect(L.R(0, n), L.R(0, n), 1.6, 1.6); } // fasteners
    L.speckle(g, n, 1500, 0.05);
  });
  skinTex.repeat.set(0.25, 0.25); // UVs are in world units: one texture every 4 units, a panel every 1
  const skinMat = (hex, rough = 0.55) => { const m = new THREE.MeshStandardMaterial({ color: hex, map: skinTex, roughness: rough, metalness: 0.25, vertexColors: true }); m.envMapIntensity = 0.55; return m; };
  const skin = skinMat('#969da1'), skinD = skinMat('#80878b'), bay = skinMat('#6a7074', 0.6);
  const radome = M.plain('#26292c', 0.45, 0.15), dark = M.plain('#16181a', 0.6, 0.3);
  const metal = M.plain('#55585a', 0.38, 0.85), metalD = M.plain('#3a3c3e', 0.45, 0.8);
  const glass = M.plain('#7fc2da', 0.1, 0.15), frame = M.plain('#8b9195', 0.5, 0.3);
  const teamHex = '#' + new THREE.Color(TEAM).multiplyScalar(0.9).getHexString();
  const team = M.plain(teamHex, 0.55, 0.1), white = M.plain('#e4e6e2', 0.6, 0);
  const Y0 = 1.0;

  // a lofted body: superellipse rings (half-width w, half-height h, centre y/z, roundness n) from the front back
  function loft(st, o = {}) {
    const seg = o.seg ?? 40, ring = seg + 1, pos = [], uv = [], idx = [];
    for (const s of st) {
      const e = 2 / (s.n ?? 2), per = Math.PI * (s.w + s.h);
      for (let j = 0; j <= seg; j++) {
        const t = -Math.PI / 2 + (j / seg) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t);
        pos.push(s.x, (s.y ?? Y0) + s.h * Math.sign(sn) * Math.abs(sn) ** e, (s.z ?? 0) + s.w * Math.sign(c) * Math.abs(c) ** e);
        uv.push(s.x, (j / seg) * per);
      }
    }
    for (let i = 0; i < st.length - 1; i++) for (let j = 0; j < seg; j++) { const a = i * ring + j, b = a + ring; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const cap = (i, back) => { const s = st[i], c = pos.length / 3, base = i * ring; pos.push(s.x, s.y ?? Y0, s.z ?? 0); uv.push(s.x, 0);
      for (let j = 0; j < seg; j++) back ? idx.push(c, base + j, base + j + 1) : idx.push(c, base + j + 1, base + j); };
    if (o.capFront) cap(0, false);
    if (o.capBack !== false) cap(st.length - 1, true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // a flat plan shape [x, z] points, extruded down from its top at height y
  function slab(pts, thick, mat, y, bevel = 0.04) {
    const sh = new THREE.Shape(); pts.forEach(([x, z], i) => (i ? sh.lineTo(x, z) : sh.moveTo(x, z))); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
    g.rotateX(Math.PI / 2); // shape y -> world z, the extrude goes down
    return mesh(g, mat, 0, y - bevel, 0, { dirt: 0 });
  }
  function star(r, mat, x, y, z) {
    const sh = new THREE.Shape();
    for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5, rr = k % 2 ? r * 0.4 : r; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(rr, 0); }
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.015, bevelEnabled: false }); g.rotateX(Math.PI / 2);
    return mesh(g, mat, x, y, z, { dirt: 0, cast: false });
  }

  // ---- the nose: the long black radome and the slim forward fuselage, which runs on back as the spine
  const R0 = [[8.96, 0.02], [8.75, 0.12], [8.35, 0.23], [7.75, 0.33], [7.0, 0.41], [6.16, 0.47]];
  mesh(loft(R0.map(([x, w]) => ({ x, w, h: w, y: Y0 + 0.02 })), { capBack: false }), radome, 0, 0, 0, { dirt: 0 });
  const F0 = [[6.16, 0.47, 0.47, 0.02], [5.4, 0.53, 0.53, 0.03], [4.4, 0.56, 0.56, 0.04], [3.4, 0.55, 0.6, 0.04], [2.6, 0.48, 0.68, 0.02],
    [1.6, 0.4, 0.72, 0], [0.6, 0.36, 0.71, 0], [-1.5, 0.34, 0.7, 0], [-4.5, 0.32, 0.68, 0], [-6.5, 0.3, 0.6, 0], [-8.2, 0.24, 0.42, 0], [-8.7, 0.16, 0.26, 0]];
  mesh(loft(F0.map(([x, w, h, dy]) => ({ x, w, h, y: Y0 + dy, n: 2.3 }))), skin, 0, 0, 0, { dirt: 0 });
  hcyl(0.03, 0.75, metal, 9.3, Y0 + 0.02, 0, { seg: 8, dirt: 0, cast: false }); // the nose probe
  // the canopy: windscreen and the long glazed hood, framed, faired into the spine behind
  { const g = new THREE.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.0, 0.36, 0.42); mesh(g, glass, 3.74, Y0 + 0.47, 0, { dirt: 0 }); }
  for (const [x, w] of [[4.3, 0.62], [3.75, 0.8], [3.15, 0.66]]) box(0.06, 0.05, w, frame, x, Y0 + 0.8 - Math.abs(x - 3.74) * 0.3, 0, { dirt: 0, cast: false });
  box(1.9, 0.04, 0.05, frame, 3.74, Y0 + 0.82, 0, { dirt: 0, cast: false });

  // ---- the intakes: big rounded boxes either side of the nose, opening into the broad body behind
  for (const s of [-1, 1]) {
    const st = [[3.41, 0.5, 0.56], [3.36, 0.555, 0.62], [1.2, 0.555, 0.62]].map(([x, w, h]) => ({ x, w, h, z: s * 0.76, y: Y0 - 0.05, n: 4 }));
    mesh(loft(st, { capFront: true }), skin, 0, 0, 0, { dirt: 0 });
    box(0.07, 0.03, 1.08, metal, 3.39, Y0 + 0.55, s * 0.76, { dirt: 0, cast: false }); // the lip
    box(0.6, 0.02, 0.9, skinD, 2.9, Y0 + 0.565, s * 0.78, { dirt: 0, cast: false });   // the ramp panel behind it
  }
  // ---- the broad, flat body over the engines, to the engine bays
  mesh(loft([[1.42, 1.3, 0.62], [1.2, 1.44, 0.66], [-5.5, 1.44, 0.66], [-5.85, 1.3, 0.62], [-6.6, 1.22, 0.6]].map(([x, w, h]) => ({ x, w, h, y: Y0 - 0.1, n: 4.5 })), { capFront: true }), skin, 0, 0, 0, { dirt: 0 });
  // the engine bays and the two big nozzles behind, a tail boom between them
  for (const s of [-1, 1]) {
    hcyl(0.62, 2.75, bay, -7.15, Y0 - 0.12, s * 0.62, { seg: 32, dirt: 0 });
    hcyl(0.64, 0.42, metal, -8.3, Y0 - 0.12, s * 0.62, { seg: 32, dirt: 0 });
    hcyl(0.5, 0.04, dark, -8.52, Y0 - 0.12, s * 0.62, { seg: 28, dirt: 0 });
    hcyl(0.36, 0.03, M.emit('#ff8a3a', 1.2), -8.55, Y0 - 0.12, s * 0.62, { seg: 24, dirt: 0, cast: false });
    for (let k = 0; k < 4; k++) box(0.03, 0.02, 0.5, metalD, -6.2 - k * 0.55, Y0 + 0.5, s * 0.62, { dirt: 0, cast: false }); // bay panel joints
  }

  // ---- the wing: thin, swept 43 degrees at the leading edge, a straight trailing edge, pods on the tips
  const RZ = 1.3, TZ = 5.68, LE = (z) => -0.48 - (Math.abs(z) - RZ) * (3.92 / 4.38), TE = (z) => -6.16 - (Math.abs(z) - RZ) * (0.08 / 4.38);
  for (const s of [-1, 1]) {
    slab([[LE(RZ), s * RZ], [LE(TZ), s * TZ], [TE(TZ), s * TZ], [TE(RZ), s * RZ]], 0.12, skin, Y0 + 0.34);
    // flaps and ailerons along the trailing edge, two pylon lines, the tip pod
    const fl = (z0, z1) => { const zc = (z0 + z1) / 2; box(0.03, 0.02, z1 - z0, skinD, TE(zc) + 0.75, Y0 + 0.35, s * zc, { dirt: 0, cast: false }); };
    fl(1.5, 3.3); fl(3.4, 5.4);
    for (const z of [2.8, 4.2]) box(Math.abs(LE(z) - TE(z)) - 0.5, 0.02, 0.025, skinD, (LE(z) + TE(z)) / 2, Y0 + 0.35, s * z, { dirt: 0, cast: false });
    hcyl(0.12, 3.5, skin, -4.8, Y0 + 0.28, s * (TZ + 0.06), { seg: 14, dirt: 0 });
    { const g = new THREE.ConeGeometry(0.12, 0.5, 14); g.rotateZ(-Math.PI / 2); mesh(g, skinD, -2.8, Y0 + 0.28, s * (TZ + 0.06), { dirt: 0 }); }
    // the star, in team colour on a white star
    star(0.66, white, -4.35, Y0 + 0.355, s * 4.45); star(0.52, team, -4.35, Y0 + 0.37, s * 4.45);
    // a bomb under the wing, its nose ahead of the leading edge; a team band behind the fuze
    const bz = s * 2.85, bx = -1.75;
    hcyl(0.21, 2.3, M.plain('#4f5741', 0.7, 0.1), bx, Y0 + 0.02, bz, { seg: 16, dirt: 0 });
    { const g = new THREE.ConeGeometry(0.21, 0.55, 16); g.rotateZ(-Math.PI / 2); mesh(g, M.plain('#4f5741', 0.7, 0.1), bx + 1.42, Y0 + 0.02, bz, { dirt: 0 }); }
    hcyl(0.215, 0.14, team, bx + 0.85, Y0 + 0.02, bz, { seg: 16, dirt: 0 });
    // the stabilator: swept, reaching back past the nozzles
    slab([[-6.32, s * 1.25], [-9.12, s * 3.79], [-9.62, s * 3.4], [-8.48, s * 1.25]], 0.1, skin, Y0 + 0.08);
    // the fin: tall and swept, canted out, its cap in team colour
    const fin = new THREE.Group(); fin.position.set(0, Y0 + 0.52, s * 1.12); fin.rotation.x = s * 0.14; L.getRoot().add(fin);
    { const sh = new THREE.Shape(); sh.moveTo(-3.7, 0); sh.lineTo(-5.0, 0.42); sh.lineTo(-8.2, 2.4); sh.lineTo(-8.85, 2.4); sh.lineTo(-8.6, 0); sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: false }); g.translate(0, 0, -0.05); mesh(g, skin, 0, 0, 0, { dirt: 0, parent: fin }); }
    box(0.75, 0.16, 0.13, team, -8.5, 2.28, 0, { dirt: 0, parent: fin });
  }

  // ---- lights: navigation (red left, green right) on the tip pods, white on the tail boom, the beacon on the spine
  sphere(0.12, M.emit('#ff3a2a', 3.4), -3.2, Y0 + 0.32, -TZ - 0.12, { cast: false });
  sphere(0.12, M.emit('#3aff6a', 3.4), -3.2, Y0 + 0.32, TZ + 0.12, { cast: false });
  sphere(0.11, M.emit('#ffffff', 3.0), -8.75, Y0 + 0.05, 0, { cast: false });
  sphere(0.08, M.emit('#ff3a2a', 3.0), -2.2, Y0 + 0.72, 0, { cast: false });
}
