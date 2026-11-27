// Terraforming stage 4 concepts: your own tunnel.
//   c=sap    Tunnel Bore A, "Sap Head": a building on the shared pad. A steel-arched adit ramps down into the ground under
//            a small headframe; skips run out on rails and tip spoil onto a conveyor to a heap; a vent fan; a winch house.
//            f = the work loop (0..3): the skip's run, the fan, the conveyor's spoil.
//   c=entry  the mouth a Mole leaves where it dives (no pad): a shaft collar of ring segments in fresh spoil, shoring
//   c=exit   the break-out: the ground burst open, slabs heaved up, the Mole's ring segments showing, lights rigged
//            f=0 just broken (dust), 1 settled
//   c=collapsed  a tunnel mouth caved in (ours or a Murmur exit after the Dozer's charge): a slumped pit, broken ring
import { power } from './powerkit.js';
const Q = new URLSearchParams(location.search);
const C = Q.get('c') || 'sap', F = +(Q.get('f') || 0);
export const config = C === 'sap' ? {} : { pad: false };

export default async function (L) {
  const { THREE, M, box, cyl, beam, sphere, hcyl, mesh, ACCENT, TEAM } = L;
  L.seed(6200 + C.length * 3);
  const night = L.TOD === 'night' || L.TOD === 'evening';
  const P = power(L);
  const tl = new THREE.TextureLoader();
  const gt = await tl.loadAsync('/art/tiles/ground.webp'); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.colorSpace = THREE.SRGBColorSpace; gt.repeat.set(0.6, 0.6);
  const gt2 = gt.clone(); gt2.repeat.set(0.08, 0.08); gt2.needsUpdate = true; const slab = new THREE.MeshStandardMaterial({ map: gt2, color: '#a07e68', roughness: 0.97 });
  const earth = new THREE.MeshStandardMaterial({ map: gt, color: '#a5826c', roughness: 0.97 }), earthD = new THREE.MeshStandardMaterial({ map: gt, color: '#6e5444', roughness: 0.97 });
  const steel = M.paint('#5a6066'), steelD = M.paint('#3f4449', { rivets: false }), ochre = M.paint('#9c7a3c', { rivets: false }), hole = M.plain('#060507', 1, 0);
  const acc = M.emit(ACCENT, 2.4), nc = { dirt: 0, cast: false };
  const lumps = (x, z, r, n, mat, h = 0.35) => { for (let i = 0; i < n; i++) { const a = L.rnd() * 6.28, d = r * Math.sqrt(L.rnd()); if (d < r * 0.5) continue; const g = new THREE.DodecahedronGeometry(0.1 + L.rnd() * 0.22, 0); g.scale(1, 0.55, 1); mesh(g, mat, x + Math.cos(a) * d, h * L.rnd() * 0.3, z + Math.sin(a) * d * 0.9, { dirt: 0, ry: L.rnd() * 6 }); } };
  function mound(x, z, r, h, mat, seg = 28) {   // a low dome of spoil
    const g = new THREE.SphereGeometry(1, seg, 12, 0, Math.PI * 2, 0, Math.PI / 2); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), n = 1 + 0.12 * Math.sin(a * 3 + x) + 0.07 * Math.sin(a * 7 + z); p.setXYZ(i, p.getX(i) * r * n, p.getY(i) * h, p.getZ(i) * r * n); }
    g.computeVertexNormals(); return mesh(g, mat, x, 0, z, { dirt: 0 });
  }
  function ring(x, y, z, r, mat, ry = 0, tube = 0.22) { const g = new THREE.TorusGeometry(r, tube, 8, 28); return mesh(g, mat, x, y, z, { ry, dirt: 0.2 }); }
  function catcher() { const g = new THREE.PlaneGeometry(40, 40); g.rotateX(-Math.PI / 2); const m = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: 0.45, color: 0x1a0f08 })); m.receiveShadow = true; m.userData.decal = true; L.getRoot().add(m); }
  function occluder(holes) {    // the ground's depth only: hides what is below it, draws nothing, except in the holes
    const s = new THREE.Shape(); s.moveTo(-20, -20); s.lineTo(20, -20); s.lineTo(20, 20); s.lineTo(-20, 20); s.closePath();
    for (const [x, z, r] of holes) { const h = new THREE.Path(); h.absellipse(x, -z, r, r, 0, Math.PI * 2, true); s.holes.push(h); }
    const g = new THREE.ShapeGeometry(s, 32); g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false })); m.renderOrder = -1; m.userData.decal = true; L.getRoot().add(m);
  }

  if (C === 'sap') {
    // the adit: a cut ramping down to the north-west, lined with steel arch sets, a dark mouth lit salmon inside
    const AX = -1.6, AZ = -0.6;
    box(4.4, 0.05, 6.2, M.rough('#6f6457'), AX, -0.02, AZ + 0.4, { dirt: 0.3 });
    const ramp = new THREE.BoxGeometry(3.0, 0.1, 5.2); ramp.rotateX(-0.28); mesh(ramp, earthD, AX, -0.75, AZ + 0.2, { dirt: 0 });
    for (const s of [-1, 1]) { const wall = new THREE.BoxGeometry(0.3, 1.6, 5.4); wall.rotateX(-0.28); mesh(wall, M.ribbed('#5f584f'), AX + s * 1.6, -0.2, AZ + 0.2, { dirt: 0.5 }); }
    for (let k = 0; k < 4; k++) { const z = AZ + 2.0 - k * 1.2, y = 0.15 - k * 0.0; ring(AX, y, z, 1.45, steel, 0, 0.14).scale.set(1, 1.05, 1); }
    box(3.0, 2.4, 0.4, hole, AX, -1.2, AZ - 2.4, { dirt: 0 });
    box(3.4, 0.5, 0.5, M.hazard, AX, 1.45, AZ + 2.3, { dirt: 0 });
    for (let k = 0; k < 3; k++) { box(0.4, 0.06, 0.06, acc, AX - 0.9 + k * 0.9, 1.05, AZ + 1.9, nc); }
    if (night) L.pointLight(ACCENT, 7, AX, 0.4, AZ + 0.8, 5);
    // a small A-frame headframe over the adit with a sheave and the hoist rope down into it
    for (const s of [-1, 1]) { beam([AX + s * 1.8, 0, AZ + 1.0], [AX, 4.0, AZ + 0.2], 0.22, 0.22, ochre); beam([AX + s * 1.8, 0, AZ - 0.8], [AX, 4.0, AZ + 0.2], 0.18, 0.18, ochre); }
    hcyl(0.45, 0.25, M.paint('#d2a326', { rivets: false }), AX, 4.0, AZ + 0.2, { axis: 'x' });
    beam([AX, 3.6, AZ + 0.4], [AX, -0.6, AZ - 1.6], 0.04, 0.04, M.plain('#222', 0.5, 0.6), nc);
    // rails out of the adit to a tipple; a skip on them (f: up the ramp, at the tipple tipping, back)
    for (const s of [-0.45, 0.45]) beam([AX + s, -0.9, AZ - 1.4], [AX + s, 0.12, AZ + 3.2], 0.08, 0.06, M.chrome);
    const t = [0.0, 0.55, 1.0, 0.45][F % 4], sz = AZ - 1.0 + t * 4.0, sy = -0.75 + t * 0.95, tip = F % 4 === 2 ? 0.7 : 0;
    const sk = L.group(AX, sy, sz); sk.rotation.x = -0.28 * (1 - t) - tip;
    L.box(1.2, 0.7, 1.4, M.paint('#7e2620', { rivets: false }), 0, 0.15, 0, { parent: sk, dirt: 0.5 });
    L.box(1.0, 0.1, 1.2, earthD, 0, 0.82, 0, { parent: sk, dirt: 0 });
    // conveyor from the tipple to the spoil heap (east), lumps riding it, the heap
    beam([AX + 0.4, 0.6, AZ + 3.3], [3.0, 2.2, 2.0], 0.7, 0.12, steelD); beam([AX + 0.4, 0.68, AZ + 3.3], [3.0, 2.28, 2.0], 0.6, 0.04, M.plain('#151515', 0.8));
    for (let k = 0; k < 5; k++) { const u = ((k + F * 0.25) % 5) / 5, x = AX + 0.4 + (3.0 - AX - 0.4) * u, y = 0.75 + 1.6 * u, z = AZ + 3.3 + (2.0 - AZ - 3.3) * u; sphere(0.16, earthD, x, y, z, { dirt: 0 }); }
    for (const [x, z] of [[1.4, 2.8], [2.6, 1.9]]) box(0.12, 1.6, 0.12, steelD, x, 0, z);
    mound(3.4, 2.6, 1.6, 1.4, earthD);
    if (F % 4 === 2) for (let i = 0; i < 6; i++) sphere(0.12, earth, 3.1 + L.rnd() * 0.4, 1.5 + L.rnd() * 0.8, 2.1 + L.rnd() * 0.3, { dirt: 0 });
    // the winch house (team strip, lit windows), the vent fan with its duct into the adit, cable drums
    box(2.4, 1.7, 1.6, M.paint('#c9c5ba', { rivets: false }), 2.6, 0, -2.6, { dirtH: 1 }); box(2.5, 0.14, 1.7, steelD, 2.6, 1.7, -2.6, { dirt: 0 });
    P.windows(1.6, 0.4, 2.6, 1.1, -1.79, 0, 3); P.strip(2.2, 2.6, 1.55, -1.77);
    cyl(0.8, 0.5, steelD, 0.9, 0, -3.6, { seg: 24 }); const fan = L.group(0.9, 0.52, -3.6, (F % 4) * Math.PI / 8);
    for (let b = 0; b < 5; b++) L.box(0.7, 0.04, 0.2, steel, 0.35 * Math.cos(b * 1.257), 0, 0.35 * Math.sin(b * 1.257), { parent: fan, ry: -b * 1.257, dirt: 0 });
    L.pipe([[0.9, 0.3, -3.0], [0.9, 0.3, -2.4], [AX + 1.0, 0.3, AZ - 1.0]], 0.28, M.paint('#d2a326', { rivets: false }));
    for (const x of [3.6, 4.2]) hcyl(0.38, 0.5, M.wood, x, 0.38, 0.6, { axis: 'z' });
    P.flood(-4.3, 3.4, 2.2, 0.5); P.beacon(2.6, 1.95, -2.2); P.junction(4.2, -0.8, 0);
  }
  if (C === 'entry') {
    // the Mole's dive hole: a ring-segment collar sunk at a slant, fresh spoil thrown out round it, a team-lit stake
    catcher(); occluder([[0, -0.3, 2.1]]);
    for (let k = 0; k < 4; k++) { const r = ring(0, -0.5 - k * 0.9, -0.3 - k * 0.7, 1.95, k ? steelD : steel, 0, 0.28); r.rotation.x = Math.PI / 2 - 0.55; }
    const pit = new THREE.CylinderGeometry(1.9, 1.6, 4.2, 28, 1, true); pit.rotateX(-0.55); mesh(pit, earthD, 0, -2.0, -1.4, { dirt: 0 }).material.side = THREE.BackSide;
    cyl(1.6, 0.1, hole, 0, -4.0, -2.8, { seg: 24, dirt: 0 });
    // spoil ring
    for (let k = 0; k < 10; k++) { const a = k / 10 * 6.28 + 0.3; mound(Math.cos(a) * 2.6, -0.3 + Math.sin(a) * 2.4, 0.6 + L.rnd() * 0.3, 0.28 + L.rnd() * 0.15, k % 2 ? earth : earthD, 16); }
    lumps(0, -0.3, 4.0, 40, earthD); mound(3.0, 1.4, 0.8, 0.45, earth); mound(-3.1, 0.9, 0.7, 0.35, earth);
    // track marks leading in (from the south), and the cable reel and stake
    for (const s of [-1, 1]) box(0.9, 0.03, 4.5, earthD, s * 1.3, 0.0, 3.6, { dirt: 0 });
    for (const [x, z] of [[-2.6, -2.2], [2.6, -2.2]]) { cyl(0.1, 1.4, M.paint('#d8d2c2', { rivets: false }), x, 0, z, { seg: 8 }); cyl(0.17, 0.24, M.emit(TEAM, night ? 2.6 : 1.4), x, 1.4, z, { seg: 10, ...nc }); }
    box(0.5, 0.2, 0.5, steelD, 2.2, 0, -2.6); sphere(0.12, acc, 2.2, 0.35, -2.6, { cast: false });
    if (night) { L.pointLight(ACCENT, 6, 0, 0.2, 0.3, 5); L.pointLight(TEAM, 3, -2.6, 1.8, -2.0, 4); }
  }
  if (C === 'exit' || C === 'collapsed') {
    catcher();
    const caved = C === 'collapsed';
    occluder([[0, 0, caved ? 1.4 : 2.0]]);
    // heaved ground slabs round a ragged hole, tipped outward
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28 + L.rnd() * 0.3, d = 2.6 + L.rnd() * 0.6; const g = new THREE.DodecahedronGeometry(0.75 + L.rnd() * 0.35, 0); g.scale(1.2, 0.32, 1);
      const m = mesh(g, slab, Math.cos(a) * d, caved ? -0.05 : 0.15, Math.sin(a) * d, { dirt: 0, ry: -a }); m.rotation.z = caved ? 0.05 : 0.35 + L.rnd() * 0.3; m.rotation.order = 'YZX'; }
    lumps(0, 0, 4.5, 55, earthD);
    if (!caved) {
      const r = ring(0, -0.9, 0, 1.85, steel, 0, 0.3); r.rotation.x = Math.PI / 2 - 0.15;
      const pit = new THREE.CylinderGeometry(1.9, 1.7, 4, 28, 1, true); mesh(pit, earthD, 0, -2.0, 0, { dirt: 0 }).material.side = THREE.BackSide;
      cyl(1.7, 0.1, hole, 0, -3.9, 0, { seg: 24, dirt: 0 });
      // rigged lights on two posts, team strip, accent lamp at the lip
      for (const s of [-1, 1]) { cyl(0.08, 2.0, steelD, s * 2.9, 0, -1.6, { seg: 8 }); box(0.4, 0.22, 0.2, steel, s * 2.9, 2.0, -1.5, { dirt: 0 }); box(0.32, 0.14, 0.04, P.white, s * 2.9, 2.04, -1.38, nc); }
      box(1.8, 0.08, 0.08, M.emit(TEAM, 2.4), 0, 0.3, 2.0, nc); sphere(0.14, acc, 1.6, 0.45, 1.7, { cast: false });
      if (night) { L.pointLight('#fff1d6', 5, 0, 1.6, 0.2, 6); L.pointLight(ACCENT, 5, 0, -0.4, 0.4, 4); }
      if (F === 0) { const dm = new THREE.MeshStandardMaterial({ color: '#b8743f', roughness: 1, transparent: true, opacity: 0.38, depthWrite: false });
        for (let i = 0; i < 12; i++) sphere(0.6 + L.rnd() * 0.9, dm, (L.rnd() - 0.5) * 6, 0.6 + L.rnd() * 3.2, (L.rnd() - 0.5) * 5, nc); }
    } else {
      // caved in: a slumped funnel of loose earth, a buckled ring segment, no light
      const g = new THREE.ConeGeometry(2.2, 1.4, 28, 1, true); g.rotateX(Math.PI); mesh(g, earthD, 0, -0.7, 0, { dirt: 0 }).material.side = THREE.DoubleSide;
      const r = ring(0.4, -0.4, 0.3, 1.5, M.paint('#6b4a36', { rivets: false }), 0, 0.2); r.rotation.x = Math.PI / 2 - 0.5; r.rotation.y = 0.4; r.scale.set(1, 0.6, 1);
      lumps(0, 0, 1.6, 20, earth, 0.1);
    }
  }
}
