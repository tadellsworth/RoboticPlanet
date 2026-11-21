// The Atmosphere Engine (IDEAS.md "Megastructures", the owner's look A from the design sheet, "Rain Tower", Nov 21 2026):
// a 4 x 4 megastructure (40 x 40 world units, the middle of its sixteen tiles at the origin), rendered on one wide frame
// like Arrival City (the pad's 40 units across 0.64 of it).
//   One great concrete cooling-tower shell, wider at the foot (a hyperboloid turned on a lathe), standing on a ring of
//   raking X-braced columns with the air intakes between them; a band round its waist (blue-grey paint by day, lit cyan
//   at night) with the team colour in a thin stripe under it; a dark throat at the top with a walkway rim, and two red
//   lamps on the rim. Six intake fan housings round its foot on the pad, a low control house at the front left (a team
//   band, lit windows at night), pipes from the fans, a few crates. The plume, its night light and the rain are drawn
//   by the game (drawAtmosPlumes), so nothing here moves.
// Marks: 'throat' (the middle of the top, where the plume rises), 'band' (the front of the waist band), 'bandL' and
// 'bandR' (its two ends as seen), 'rimL' and 'rimR' (the red lamps).
const PI = Math.PI;
export const config = { pad: false };

export default function (L) {
  const { box, cyl, mesh, group, mark, ao, pointLight, pipe, M, THREE } = L;
  L.seed(7321);
  L.longPad(40, 40);
  L.frameCompoundOpts({ half: 20.12, width: 0.62, cy: 0.66 });
  L.getScene().traverse((o) => {
    if (!o.isDirectionalLight || !o.castShadow) return;
    o.position.multiplyScalar(3);
    const c = o.shadow.camera; c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 220; c.updateProjectionMatrix();
  });
  const R = L.rnd, RR = (a, b) => a + (b - a) * R();
  const dark = L.TOD === 'night' || L.TOD === 'evening', NB = L.TOD === 'night' ? 2.2 : L.TOD === 'evening' ? 1.5 : 1;
  const nc = { dirt: 0, cast: false };
  const T = {
    conc: M.rough('#bcb6aa'), concD: M.rough('#8e887d'), concL: M.rough('#cfc9bd'), steel: M.steel, dark: M.dark,
    grey: M.paint('#5b6168', { metal: 0.4 }), greyD: M.paint('#41464c', { rivets: false, metal: 0.5 }), white: M.paint('#d9d6cf', { rivets: false }),
    team: M.paint(L.TEAM, { rivets: false, rough: 0.5 }), roof: M.plain('#4f5356', 0.85, 0.2), hole: M.plain('#0a0c0f', 1, 0), grille: M.plain('#1b1e22', 0.6, 0.5),
    pipe: M.paint('#8a9198', { rivets: false, metal: 0.5 }),
  };
  const band = dark ? M.emit('#7fe0ff', 2.4) : M.paint('#3a8cb8', { rivets: false, rough: 0.4 });
  const red = dark ? M.emit('#ff3a22', 3) : M.plain('#a0281c', 0.4, 0.1);
  const amber = dark ? M.emit('#ffb347', 1.8) : M.plain('#3b4652', 0.2, 0.3);

  ao(0, 0, 38, 38, 0.35);
  // ---- the shell: a hyperboloid on a lathe, from its foot ring (on the columns) up to the throat
  const CX = 1.2, CZ = -2.0, Y0 = 3.2, H = 30, rFoot = 14.2, rWaist = 9.2, rTop = 10.2, kW = 0.68;
  const rAt = (f) => { const a = f / kW; return f <= kW ? rWaist + (rFoot - rWaist) * Math.pow(1 - a, 1.7) : rWaist + (rTop - rWaist) * Math.pow((f - kW) / (1 - kW), 1.6); };
  const prof = []; const N = 40;
  for (let k = 0; k <= N; k++) { const f = k / N; prof.push(new THREE.Vector2(rAt(f), Y0 + f * H)); }
  // concrete with pour lines and rain streaks
  const shellTex = L.canvasTex(1024, (g, n) => {
    g.fillStyle = '#bdb7ab'; g.fillRect(0, 0, n, n);
    for (let k = 0; k < 900; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,250,240' : '70,64,56'},${RR(0.02, 0.06)})`; const x = R() * n, y = R() * n; g.fillRect(x, y, RR(4, 30), RR(4, 30)); }
    g.strokeStyle = 'rgba(80,74,66,0.35)'; g.lineWidth = 2;
    for (let y = 0; y < n; y += n / 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(n, y); g.stroke(); }
    for (let k = 0; k < 140; k++) { const x = R() * n, l = RR(60, 420), gr = g.createLinearGradient(x, 0, x, l); gr.addColorStop(0, 'rgba(70,66,60,0.32)'); gr.addColorStop(1, 'rgba(70,66,60,0)'); g.fillStyle = gr; g.fillRect(x, 0, RR(3, 10), l); }
  });
  shellTex.wrapS = shellTex.wrapT = THREE.RepeatWrapping; shellTex.repeat.set(3, 1);
  const shellM = new THREE.MeshStandardMaterial({ map: shellTex, roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const shellGeo = new THREE.LatheGeometry(prof, 72);
  mesh(shellGeo, shellM, CX, 0, CZ, { dirt: 0 });
  // the inside of the throat dark: a disc a little way down, and a darker inner lathe
  const inner = prof.slice(Math.floor(N * 0.8)).map((v) => new THREE.Vector2(v.x - 0.35, v.y));
  mesh(new THREE.LatheGeometry(inner, 48), new THREE.MeshStandardMaterial({ color: '#2b2e32', roughness: 1, side: THREE.BackSide }), CX, 0, CZ, nc);
  const dg = new THREE.CircleGeometry(rAt(0.8) - 0.4, 48); dg.rotateX(-PI / 2); mesh(dg, T.hole, CX, Y0 + 0.8 * H, CZ, nc);
  // the rim: a walkway ring, a railing, two red lamps
  const rim = new THREE.TorusGeometry(rTop + 0.05, 0.22, 8, 72); rim.rotateX(PI / 2); mesh(rim, T.concL, CX, Y0 + H, CZ, { dirt: 0 });
  for (const [s, n] of [[-1, 'rimL'], [1, 'rimR']]) {
    const x = CX + s * (rTop - 0.2), z = CZ + 1.6;
    cyl(0.12, 0.9, T.greyD, x, Y0 + H, z, { seg: 8 }); L.sphere(0.28, red, x, Y0 + H + 1.0, z, { cast: false });
    mark(n, x, Y0 + H + 1.0, z);
    if (dark) pointLight('#ff4a30', 1.6 * NB, x, Y0 + H + 1.4, z, 4);
  }
  mark('throat', CX, Y0 + H, CZ);
  // the waist band, and a thin team stripe under it
  const yb = Y0 + kW * H, rb = rWaist + 0.08;
  const bg = new THREE.CylinderGeometry(rb, rb, 1.0, 72, 1, true); mesh(bg, band, CX, yb - 0.5, CZ, nc);
  const tg = new THREE.CylinderGeometry(rb + 0.02, rb + 0.02 + 0.08, 0.35, 72, 1, true); mesh(tg, T.team, CX, yb - 1.1, CZ, nc);
  mark('band', CX, yb, CZ + rb); mark('bandL', CX - rb, yb, CZ); mark('bandR', CX + rb, yb, CZ);
  if (dark) pointLight('#8fe8ff', 3 * NB, CX, yb, CZ + rb + 3, 9);
  // ---- the foot: a ring of raking columns in X's, the air intakes dark between them, and a ring beam over them
  const NC = 28;
  for (let k = 0; k < NC; k++) {
    const a0 = (k / NC) * 2 * PI, a1 = ((k + 1) / NC) * 2 * PI, r0 = rFoot + 0.2;
    L.beam([CX + Math.cos(a0) * r0, 0, CZ + Math.sin(a0) * r0], [CX + Math.cos(a1) * rFoot, Y0, CZ + Math.sin(a1) * rFoot], 0.36, 0.36, T.concD, { dirt: 0.3 });
    L.beam([CX + Math.cos(a1) * r0, 0, CZ + Math.sin(a1) * r0], [CX + Math.cos(a0) * rFoot, Y0, CZ + Math.sin(a0) * rFoot], 0.36, 0.36, T.concD, { dirt: 0.3 });
  }
  const ringG = new THREE.TorusGeometry(rFoot, 0.45, 8, 72); ringG.rotateX(PI / 2); mesh(ringG, T.concD, CX, Y0, CZ, { dirt: 0.4 });
  const intake = new THREE.CylinderGeometry(rFoot - 0.3, rFoot - 0.1, Y0, 72, 1, true); mesh(intake, new THREE.MeshStandardMaterial({ color: '#1a1c1f', roughness: 1, side: THREE.DoubleSide }), CX, 0, CZ, nc);
  // ---- six intake fan housings round its foot: squat drums with dark grilles and a fan hub
  const fans = [[-15.6, 10.4], [-16.4, -2.6], [-12.8, -15.4], [16.6, 9.2], [17.0, -5.0], [6.8, 15.4]];
  for (const [x, z] of fans) {
    cyl(2.0, 1.6, T.grey, x, 0, z, { seg: 24, dirt: 0.4 });
    cyl(2.05, 0.18, T.greyD, x, 1.6, z, { seg: 24, dirt: 0.2 });
    const gr = new THREE.CircleGeometry(1.75, 24); gr.rotateX(-PI / 2); mesh(gr, T.grille, x, 1.79, z, nc);
    cyl(0.32, 0.25, T.steel, x, 1.7, z, { seg: 12, dirt: 0 });
    for (let k = 0; k < 4; k++) { const a = k * PI / 2 + 0.4; L.beam([x, 1.84, z], [x + Math.cos(a) * 1.6, 1.84, z + Math.sin(a) * 1.6], 0.1, 0.06, T.greyD, nc); }
    const dx = CX - x, dz = CZ - z, l = Math.hypot(dx, dz);
    pipe([[x + dx / l * 1.9, 0.7, z + dz / l * 1.9], [CX - dx / l * (rFoot + 0.6), 0.7, CZ - dz / l * (rFoot + 0.6)]], 0.38, T.pipe);
  }
  // ---- the control house at the front left: a low block, a team band, lit windows at night, a door to the pad
  {
    const hx = -13.4, hz = 15.2;
    box(8.4, 3.6, 5.6, T.white, hx, 0, hz, { dirt: 0.5, dirtH: 3.6 });
    box(8.6, 0.24, 5.8, T.concL, hx, 3.6, hz, { dirt: 0.3 });
    box(8.44, 0.4, 5.64, T.team, hx, 3.0, hz, nc);
    box(6.4, 0.7, 0.05, amber, hx, 1.7, hz + 2.82, nc);
    box(1.0, 2.0, 0.06, T.greyD, hx + 3.2, 0, hz + 2.83, nc);
    cyl(0.3, 2.4, T.steel, hx - 3.0, 3.8, hz - 1.4, { seg: 12 });
    box(1.4, 0.8, 1.4, T.grey, hx + 2.6, 3.84, hz - 1.2, { dirt: 0.3 }); // (an air-con unit)
    if (dark) pointLight('#ffcf8a', 2.4 * NB, hx, 2.2, hz + 4.2, 6);
  }
  // ---- small things: a fuel line in from the pad's east edge, a power cabinet, crates, a light mast at the corners
  pipe([[19.6, 0.35, 2.0], [16.0, 0.35, 2.0], [CX + rFoot + 0.4, 0.35, CZ + 2.4]], 0.24, M.paint('#b8452e', { rivets: false }));
  box(1.4, 1.8, 1.0, T.grey, 16.8, 0, 16.6, { dirt: 0.4 }); box(1.42, 0.2, 1.02, M.hazard, 16.8, 1.5, 16.6, nc);
  for (const [x, z] of [[12.8, 17.2], [14.0, 16.8], [13.4, 18.0]]) box(1.0, 0.8, 1.0, M.wood || T.concD, x, 0, z, { ry: RR(0, 0.4), dirt: 0.4 });
  for (const [x, z] of [[-18.4, -18.4], [18.4, -18.4]]) {
    cyl(0.18, 7, T.greyD, x, 0, z, { seg: 10 });
    box(1.2, 0.5, 0.5, T.greyD, x, 7, z, { dirt: 0 }); box(1.0, 0.36, 0.06, dark ? M.emit('#f4f8ff', 3) : M.plain('#cfd6dc', 0.3, 0.3), x, 7.06, z + 0.26, nc);
    if (dark) pointLight('#eef4ff', 4 * NB, x, 6.5, z + 2, 10);
  }
}
