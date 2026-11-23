// The Walking Factory (SHAPE_PRESETS walker; js/walker.js draws it): the owner's look A, "Foundry Crawler" (Nov 23 2026).
// A heavy industrial walking works: a gunmetal box-girder chassis on six hydraulic box-section legs, a foundry block with
// twin smokestacks and a refinery column at the back, a slewing Accord-yellow crane, the open tread-plate deck in the
// middle (the robots aboard stand there) and an open-roofed fabrication bay at the front whose hazard-striped chute lets
// the new Warbots down to the ground. Holder's colour: the flank bands, the bay's door lights, the corner lamps and the
// stack beacons. tools/render_walker.sh renders the game's set, tools/install_walker.py installs it (ART_GUIDE.md).
//
// Units: 1 map tile = 2 world units. The machine faces +x (right), +z is its right flank (image bottom when seen from
// above, as the game's v). The hull is 5.4 x 3.4 tiles = 10.8 x 6.8 units.
//
// Query:
//   view=hero|top    hero: the buildings' 57 degree camera, framed wide (review renders);
//                    top: orthographic straight down, W units across, facing right, centred on the deck (the game's
//                    sprite, which it turns to the factory's heading)
//   W=20             top view: world units across the frame (20 = 10 tiles)
//   f=k&n=N          gait frame k of N (a tripod gait: one leg cycle per 1.3 tiles walked)
//   rest=1           dormant in its cradle: every foot down, the hull lowered
//   dim=1            unclaimed and dormant: the work lights, furnace and bay out, the holder's lamps dull Accord amber
//   part=base|team   the game's layers: base, the holder's parts dark and unlit; team, the holder's parts alone in
//                    white with their glow (the game tints it), everything else depth only. Omitted: whole, in `team`
//   tod=...          lib.js time of day
//   team=#38d4ff     holder colour
const TILE = 2;
const HL = 5.4, HW = 3.4;           // half length / half width of the hull, units
const STRIDE = 1.3 * TILE;          // units walked per leg cycle
const DECK_U = 0.9;                 // the deck's middle along the hull (units): the top view is centred on it, where the
                                    // game's riders stand (its middle, w.x, w.y)
const SENT = '#01fe02';             // the holder's colour while building with part=base|team (swapped out by layer())

function setup(L, o = {}) {
  const { THREE } = L;
  const p = new URLSearchParams(location.search);
  const view = p.get('view') || 'hero', f = +(p.get('f') || 0), n = +(p.get('n') || 6), dim = p.get('dim') === '1';
  const rest = p.get('rest') === '1', part = p.get('part') || '';
  const scene = L.getScene();
  // a wide subject: widen the sun's shadow camera so the legs' shadows aren't cut off
  scene.traverse(s => { if (s.isDirectionalLight && s.castShadow) { const c = s.shadow.camera; const R0 = 18; c.left = -R0; c.right = R0; c.top = R0; c.bottom = -R0; c.far = 90; c.updateProjectionMatrix(); s.shadow.bias = -0.0003; } });
  if (view === 'top') {
    const W = +(p.get('W') || 20), cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
    cam.position.set(DECK_U, 50, 0); cam.up.set(0, 0, -1); cam.lookAt(DECK_U, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
    L.useCamera(cam);
    // the game rotates this sprite to its heading: put the sun nearly overhead so the baked shadow sits under it
    // whichever way it faces, and tone the light down as robkit does for top-down units
    scene.traverse(s => {
      if (s.isDirectionalLight && s.castShadow) { s.position.set(-2.2, 30, -2.6); s.intensity *= 0.62; }
      else if (s.isDirectionalLight) s.intensity *= 0.6;
      if (s.isHemisphereLight) s.intensity *= 0.72;
    });
  } else {
    L.frameCompoundOpts({ half: o.half ?? 8.2, width: o.width ?? 0.78, cy: o.cy ?? 0.6 });
  }
  // shadow catcher: keeps the machine's shadow on a transparent background
  const g = new THREE.PlaneGeometry(60, 60); g.rotateX(-Math.PI / 2);
  const sm = new THREE.Mesh(g, new THREE.ShadowMaterial({ opacity: view === 'top' ? 0.38 : 0.46, color: 0x120c08 }));
  sm.position.y = 0.002; sm.receiveShadow = true; sm.userData.decal = true; L.getRoot().add(sm);

  // the holder's colour, or dull Accord amber and nearly dark while no one holds it
  // (the game's layers: built in a stand-in colour that layer() swaps for dark plate or white light)
  const team = part ? SENT : dim ? '#4a3c22' : L.TEAM;   // (lamps in the holder's colour: dull and nearly dark)
  const teamK = dim ? 0.18 : 1;
  const teamEmit = (k = 2.2) => {
    if (!dim || part) return L.M.emit(team, k);
    const m = new THREE.MeshStandardMaterial({ color: '#6b5a36', emissive: '#c9a24e', emissiveIntensity: 0.22, roughness: 0.6 });
    m.userData.glow = '#2a2210'; return m;
  };
  const warm = (hex) => dim ? '#3a3020' : hex;          // work lights, furnace and bay glow: out while it lies dormant
  return { view, f, n, dim, rest, part, team, teamK, teamEmit, warm, p };
}

// The game's two layers (part=base|team): base, the holder's parts dark plate and their lamps off; team, the holder's
// parts alone in white with their glow, every other surface depth only (it hides what's behind it, draws nothing).
function layer(L, S) {
  if (!S.part) return;
  const { THREE } = L, scene = L.getScene();
  const isTeam = (m) => m && m.userData && m.userData.glow === SENT;
  const dark = L.M.plain('#26292d', 0.6, 0.45), white = L.M.emit('#ffffff', 2.4);
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const lights = []; scene.traverse(o => { if (o.isPointLight && o.color.getHexString() === SENT.slice(1)) lights.push(o); });
  for (const o of lights) if (S.part === 'base') o.intensity = 0;
  L.getRoot().traverse(o => {
    if (!o.isMesh) return;
    const team = Array.isArray(o.material) ? o.material.some(isTeam) : isTeam(o.material);
    if (S.part === 'base') { if (team) o.material = dark; return; }
    if (team) { o.material = white; o.castShadow = false; return; }
    if (o.userData.decal) { o.visible = false; return; }
    o.material = depthOnly; o.castShadow = false; o.renderOrder = -10;
  });
}

// ---- the gait: six legs, a tripod (front and back on one side with the middle on the other) ----
// returns, for leg k (0..2 left front..back, 3..5 right), the foot's offset along the body (u, units) and its lift (0..1)
function gait(k, f, n, amp) {
  const side = k < 3 ? -1 : 1, group = ((k % 3) + (side > 0 ? 1 : 0)) % 2;
  const ph = ((f / n) + group * 0.5) % 1;
  // stance for the first 55% of the cycle (the foot planted, sliding back as the body walks over it), swing after
  const duty = 0.55;
  let u, lift;
  if (ph < duty) { const t = ph / duty; u = amp - 2 * amp * t; lift = 0; }
  else { const t = (ph - duty) / (1 - duty), s = t * t * (3 - 2 * t); u = -amp + 2 * amp * s; lift = Math.sin(Math.PI * t); }
  return { side, group, u, lift };
}

// two-bone IK: the knee between hip H and foot F, bending toward `pole`
function knee(THREE, H, F, a, b, pole) {
  const d0 = H.distanceTo(F), d = Math.min(d0, (a + b) * 0.995), dir = F.clone().sub(H).normalize();
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  const pp = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return H.clone().add(dir.multiplyScalar(x)).add(pp.multiplyScalar(h));
}

// a tapered round segment from A to B (radius r0 at A, r1 at B)
function seg(L, A, B, r0, r1, mat, o = {}) {
  const { THREE } = L; const dir = B.clone().sub(A), len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, o.sides ?? 16, 1, false);
  const m = L.mesh(geo, mat, 0, 0, 0, { dirt: o.dirt ?? 0.15, dirtH: len });
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
// a box-section member from A to B, w wide x h deep, its h axis kept as near to `up` as it can
function bar(L, A, B, w, h, mat) {
  const { THREE } = L; const dir = B.clone().sub(A), len = dir.length();
  const geo = new THREE.BoxGeometry(w, h, len);
  const m = L.mesh(geo, mat, 0, 0, 0, { dirt: 0.2, dirtH: 1 });
  m.position.copy(A).add(B).multiplyScalar(0.5); m.up.set(0, 1, 0); m.lookAt(B);
  return m;
}
const V = (THREE, x, y, z) => new THREE.Vector3(x, y, z);

// an extruded plan shape (pts in x,z) from y0 to y1
function slab(L, pts, y0, y1, mat, o = {}) {
  const { THREE } = L; const s = new THREE.Shape();
  pts.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z));
  const bev = o.bevel ?? 0.06, h = y1 - y0;
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.01, h - 2 * bev), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bev, 0);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
  return L.mesh(g, mat, 0, 0, 0, { dirt: o.dirt ?? 0.4, dirtH: o.dirtH ?? 1.2, cast: o.cast });
}
// a hull plan: a rectangle with its corners cut
function cutRect(hl, hw, cut) {
  return [[-hl + cut, -hw], [hl - cut, -hw], [hl, -hw + cut], [hl, hw - cut], [hl - cut, hw], [-hl + cut, hw], [-hl, hw - cut], [-hl, -hw + cut]];
}
// a deck plate texture: worn non-slip tread plate with painted walkway lines and a landing ring
function deckMat(L, o = {}) {
  const { THREE } = L;
  const t = L.canvasTex(1024, (g, n) => {
    g.fillStyle = o.base || '#5d6268'; g.fillRect(0, 0, n, n);
    L.blotches(g, n, 160, 10, 90, 0.09); L.blotches(g, n, 60, 10, 60, 0.06, '255,250,240');
    // tread-plate diamonds
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 0; y < n; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < n; x += 16) { g.save(); g.translate(x, y); g.rotate(0.7); g.fillRect(-4, -1, 8, 2); g.restore(); }
    g.strokeStyle = 'rgba(15,12,10,0.55)'; g.lineWidth = 3;
    for (let k = 0; k <= n; k += n / 4) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k, n); g.stroke(); g.beginPath(); g.moveTo(0, k); g.lineTo(n, k); g.stroke(); }
    for (let i = 0; i < 40; i++) { const x = L.R(0, n), y = L.R(0, n), l = L.R(30, 120); const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, 'rgba(80,45,22,0.35)'); gr.addColorStop(1, 'rgba(80,45,22,0)'); g.fillStyle = gr; g.fillRect(x, y, L.R(2, 6), l); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(30,28,26,${L.R(0.1, 0.4)})`; g.fillRect(L.R(0, n), L.R(0, n), L.R(2, 10), L.R(1, 3)); }
    L.speckle(g, n, 12000, 0.14);
  });
  t.repeat.set(o.rep ?? 1, o.rep ?? 1);
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.78, metalness: 0.35, vertexColors: true }); m.envMapIntensity = 0.5;
  return m;
}
// a flat decal on a deck (painted lines, rings, chevrons) at height y, drawn with a 2D canvas over a w x d area
function decal(L, w, d, y, draw, x = 0, z = 0, op = 1) {
  const { THREE } = L;
  const c = document.createElement('canvas'); const px = 1024; c.width = px; c.height = Math.round(px * d / w);
  draw(c.getContext('2d'), c.width, c.height);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, transparent: true, opacity: op, roughness: 0.8, metalness: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.position.set(x, y + 0.004, z); m.receiveShadow = true; m.renderOrder = 2; L.getRoot().add(m); return m;
}
// a small Warbot shape (0.36 tiles long, ~0.72 units) for the assembly line and the hero renders' crew
function warbot(L, x, y, z, ry, team, stage = 3, parent) {
  const { THREE, M } = L; const G = L.group(x, y, z, ry, parent);
  const hull = M.paint('#3e444b', { rivets: false }), dark = M.plain('#1d1f22', 0.7, 0.3);
  const o = (e = {}) => ({ parent: G, ...e });
  // tracks
  L.box(0.62, 0.12, 0.13, dark, 0, 0, -0.2, o()); L.box(0.62, 0.12, 0.13, dark, 0, 0, 0.2, o());
  if (stage >= 1) L.box(0.5, 0.1, 0.3, M.steel, 0, 0.1, 0, o({ dirt: 0 }));
  if (stage >= 2) {
    const s = new THREE.Shape(); s.moveTo(-0.3, -0.2); s.lineTo(0.18, -0.17); s.lineTo(0.36, 0); s.lineTo(0.18, 0.17); s.lineTo(-0.3, 0.2); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, 0.18, 0);
    L.mesh(g, hull, 0, 0, 0, o({ dirt: 0 }));
  }
  if (stage >= 3) {
    L.box(0.2, 0.06, 0.03, M.emit(team, 2), 0.14, 0.3, 0, o({ dirt: 0, cast: false }));
    for (const s of [-1, 1]) L.hcyl(0.025, 0.3, M.dark, 0.38, 0.24, s * 0.07, o());
  }
  return G;
}

// ---------------------------------------------------------------- the scene
export const config = { pad: false, size: +(new URLSearchParams(location.search).get('size') || 2048) };
export default function (L) {
  const { THREE, M, box, cyl, hcyl, sphere, hoop, lamp, ladder, railing, pipe } = L;
  const S = setup(L, { half: 8.0, width: 0.84, cy: 0.6 });
  const V3 = (x, y, z) => V(THREE, x, y, z);
  L.seed(4411);
  const gun = M.paint('#4c5258'), gunD = M.paint('#33383d', { rivets: false }), gunL = M.paint('#6a7077');
  const yel = M.paint('#c99a2e'), rust = M.paint('#6e4a32', { rivets: false }), sootM = M.paint('#2a2826', { rivets: false });
  const dark = M.plain('#1b1c1e', 0.8, 0.3), team = S.teamEmit(2.4), warm = M.emit('#fff1d0', 2.4), fire = M.emit(S.warm('#ff8a1e'), 3.2);
  const glass = M.glass('#9fb6c4', 0.5);

  // ---------------- chassis ----------------
  const Y0 = S.rest ? 1.45 : 2.1, Y1 = Y0 + 0.9;      // hull bottom, deck top (settled lower in its cradle at rest)
  slab(L, cutRect(HL, HW, 0.9), Y0, Y1, gun, { dirt: 0.5, dirtH: 0.8 });
  slab(L, cutRect(HL - 0.5, HW - 0.6, 0.6), Y0 - 0.55, Y0 + 0.02, gunD);     // belly
  // flank bands in the holder's colour, with hazard caps at the corners
  for (const s of [-1, 1]) {
    box(HL * 2 - 2.2, 0.16, 0.05, team, 0, Y0 + 0.42, s * (HW + 0.005), { dirt: 0, cast: false });
    for (const u of [-HL + 1.0, HL - 1.0]) box(0.7, 0.5, 0.08, M.hazard, u, Y0 + 0.25, s * HW, { dirt: 0 });
    // the hip housings: heavy castings the legs swing from
    for (const hu of [-3.6, 0, 3.6]) {
      box(1.5, 1.2, 0.9, gunD, hu, Y0 - 0.4, s * (HW + 0.15), { dirt: 0.6, dirtH: 0.8 });
      hcyl(0.42, 1.7, M.steel, hu, Y0 + 0.1, s * (HW + 0.45), { axis: 'x' });
    }
  }
  // ---------------- the deck (open middle, u -1.6 .. 3.4) ----------------
  const dk = deckMat(L, { base: '#5a5f64', rep: 2 });
  box(5.4, 0.04, HW * 2 - 0.5, dk, 0.9, Y1, 0, { dirt: 0, cast: false });
  decal(L, 5.4, HW * 2 - 0.5, Y1 + 0.04, (g, w, h) => {
    // walkway edge lines and the landing ring where the crew gathers
    g.strokeStyle = 'rgba(214,170,60,0.85)'; g.lineWidth = 10; g.setLineDash([46, 26]);
    g.strokeRect(26, 26, w - 52, h - 52); g.setLineDash([]);
    g.lineWidth = 14; g.strokeStyle = 'rgba(214,170,60,0.7)'; g.beginPath(); g.arc(w * 0.5, h / 2, h * 0.36, 0, 7); g.stroke();
    g.lineWidth = 5; g.beginPath(); g.arc(w * 0.5, h / 2, h * 0.3, 0, 7); g.stroke();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.fillStyle = 'rgba(214,170,60,0.75)'; g.beginPath(); g.arc(w * 0.5 + Math.cos(a) * h * 0.36, h / 2 + Math.sin(a) * h * 0.36, 16, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(20,18,16,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(L.rnd() * w, L.rnd() * h, 40, 8);
  }, 0.9, 0, 0.95);
  L.mark('deck', 0.9, Y1, 0);
  for (const s of [-1, 1]) railing([[-1.6, s * (HW - 0.12)], [3.5, s * (HW - 0.12)]], Y1, { mat: yel, h: 0.5, spacing: 0.85 });
  // deck floodlights on posts at the four corners of the deck
  for (const [u, z] of [[-1.4, -HW + 0.3], [-1.4, HW - 0.3], [3.3, -HW + 0.3], [3.3, HW - 0.3]]) {
    cyl(0.06, 1.4, gunL, u, Y1, z, { seg: 10, dirt: 0 }); lamp(u, Y1 + 1.4, z, S.warm('#fff1d0'), { size: 0.18, intensity: S.p.get('tod') === 'night' ? 5 : 0, dist: 6 });
  }

  // ---------------- the works at the back (u -5.2 .. -1.7) ----------------
  const wx = -3.45;
  slab(L, cutRect(1.75, HW - 0.25, 0.5), Y1, Y1 + 2.3, gunL, { dirt: 0.5, dirtH: 1.6 });
  L.getRoot().children.at(-1).position.x = wx;
  slab(L, cutRect(1.5, HW - 0.5, 0.4), Y1 + 2.3, Y1 + 2.6, gunD); L.getRoot().children.at(-1).position.x = wx;
  // windows along both flanks of the works and its front face (they glow warm at night)
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) box(0.5, 0.36, 0.04, glass, wx - 1.2 + k * 0.8, Y1 + 1.5, s * (HW - 0.23), { dirt: 0, cast: false });
  // the furnace mouth facing the deck: the foundry's glow
  box(0.1, 0.9, 1.8, dark, wx + 1.76, Y1 + 0.25, -0.9, { dirt: 0 });
  box(0.06, 0.6, 1.4, fire, wx + 1.82, Y1 + 0.35, -0.9, { dirt: 0, cast: false });
  box(0.3, 0.12, 2.0, M.hazard, wx + 1.82, Y1 + 1.16, -0.9, { dirt: 0 });
  for (let k = 0; k < 3; k++) box(0.04, 0.34, 0.08, M.grille('#333'), wx + 1.86, Y1 + 1.4, 0.4 + k * 0.5, { dirt: 0 });
  // the crucible on the works' roof by the deck: a ladle of molten alloy, its pour channel running to the bay
  cyl(0.62, 0.45, gunD, wx + 0.95, Y1 + 2.6, -1.1, { rTop: 0.7, seg: 28 }); hoop(0.7, 0.07, M.steel, wx + 0.95, Y1 + 3.15, -1.1);
  cyl(0.6, 0.04, fire, wx + 0.95, Y1 + 3.04, -1.1, { seg: 28, dirt: 0, cast: false });
  box(0.9, 0.12, 0.26, gunD, wx + 1.65, Y1 + 2.75, -1.1); box(0.86, 0.03, 0.14, fire, wx + 1.65, Y1 + 2.87, -1.1, { dirt: 0, cast: false });
  L.mark('crucible', wx + 0.95, Y1 + 3.1, -1.1);
  // twin smokestacks
  for (const [sx, sz, h] of [[wx - 0.7, -1.6, 4.8], [wx - 0.7, -0.4, 4.1]]) {
    cyl(0.48, h, M.ribbed('#5d5a55'), sx, Y1 + 2.6, sz, { rTop: 0.4, soot: 1.6, seg: 28 });
    hoop(0.44, 0.06, M.steel, sx, Y1 + 2.6 + h * 0.45, sz); hoop(0.42, 0.07, gunD, sx, Y1 + 2.6 + h - 0.12, sz);
    cyl(0.32, 0.05, dark, sx, Y1 + 2.6 + h - 0.02, sz, { seg: 24, dirt: 0 });
    lamp(sx + 0.42, Y1 + 2.6 + h - 0.4, sz, S.team, { size: 0.12, intensity: S.dim ? 0 : 2, dist: 2 });
    L.mark('stack' + (sz < -1 ? 0 : 1), sx, Y1 + 2.6 + h, sz);
  }
  // the refinery column and its pipe run to the bay
  cyl(0.7, 3.6, M.paint('#8a8478'), wx + 0.4, Y1 + 2.6, 1.5, { rTop: 0.62, seg: 32 });
  for (const t of [0.8, 1.7, 2.6]) hoop(0.7, 0.05, M.steel, wx + 0.4, Y1 + 2.6 + t, 1.5);
  sphere(0.62, M.paint('#8a8478'), wx + 0.4, Y1 + 6.2, 1.5, { dome: true });
  ladder(wx + 0.4, Y1 + 2.6, Y1 + 6.1, 2.25, { mat: yel });
  pipe([[wx + 0.9, Y1 + 3.5, 1.1], [wx + 1.9, Y1 + 3.5, 1.1], [wx + 1.9, Y1 + 0.35, 2.85], [HL - 2.0, Y1 + 0.35, 2.85]], 0.13, M.steel);
  pipe([[wx + 0.9, Y1 + 3.1, 1.9], [wx + 2.2, Y1 + 3.1, 1.9], [wx + 2.2, Y1 + 0.25, 3.05], [HL - 2.0, Y1 + 0.25, 3.05]], 0.1, rust);
  box(1.2, 0.5, 1.6, gunD, wx - 0.6, Y1 + 2.6, 1.0); box(1.0, 0.08, 1.4, M.grille('#3d4247'), wx - 0.6, Y1 + 3.1, 1.0, { dirt: 0 });

  // ---------------- the crane (slewing, on the works' left corner, its jib over the deck) ----------------
  const cx = wx + 1.0, cz = -2.6, cy = Y1 + 2.6;
  cyl(0.55, 0.4, gunD, cx, cy, cz, { seg: 28 }); cyl(0.42, 0.5, yel, cx, cy + 0.4, cz, { seg: 28 });
  box(0.9, 0.8, 0.8, yel, cx - 0.2, cy + 0.9, cz); box(0.5, 0.4, 0.04, glass, cx + 0.0, cy + 1.25, cz + 0.42, { dirt: 0 });
  const jA = V3(cx, cy + 1.6, cz), jB = V3(cx + 5.2, cy + 2.9, cz + 2.2), jC = V3(cx - 1.4, cy + 1.3, cz - 0.6);
  for (const dz of [-0.12, 0.12]) { bar(L, V3(jA.x, jA.y, jA.z + dz), V3(jB.x, jB.y, jB.z + dz), 0.08, 0.08, yel); }
  bar(L, V3(jA.x, jA.y + 0.4, jA.z), V3(jB.x, jB.y, jB.z), 0.07, 0.07, yel);
  for (let k = 1; k < 8; k++) { const t = k / 8, P = jA.clone().lerp(jB, t); bar(L, P, V3(P.x - 0.25, P.y + 0.38 * (1 - t), P.z - 0.1), 0.05, 0.05, yel); }
  bar(L, jA, jC, 0.3, 0.3, gunD); box(0.6, 0.6, 0.6, M.paint('#3a3d40'), jC.x, jC.y - 0.5, jC.z);
  const hook = V3(jB.x - 0.3, Y1 + 1.6, jB.z - 0.1);
  seg(L, V3(jB.x - 0.3, jB.y, jB.z - 0.1), hook, 0.02, 0.02, M.dark, { sides: 6 });
  box(0.3, 0.3, 0.3, yel, hook.x, hook.y - 0.3, hook.z); box(0.9, 0.35, 0.6, M.paint('#6b5f4a'), hook.x, hook.y - 0.75, hook.z); // a slung ingot crate
  lamp(jB.x, jB.y + 0.05, jB.z, S.warm('#ff3a2a'), { size: 0.1, intensity: 1.5, dist: 2 });

  // ---------------- the fabrication bay at the front, and its chute ----------------
  const bx = HL - 1.0;
  slab(L, [[-1.0, -2.2], [0.9, -2.2], [1.0, -1.6], [1.0, 1.6], [0.9, 2.2], [-1.0, 2.2]], Y1, Y1 + 0.25, gunD); L.getRoot().children.at(-1).position.x = bx;
  // the hood: two side walls and a roof with a gap between them (the bay's mouth faces forward)
  for (const s of [-1, 1]) box(1.9, 1.6, 0.6, gun, bx, Y1 + 0.25, s * 1.6, { dirt: 0.5 });
  // open-roofed: two box girders across the walls carry the bay's arms, so the line inside shows from above
  for (const dx of [-0.75, 0.75]) box(0.3, 0.32, 3.8, gunL, bx + dx, Y1 + 1.85, 0);
  box(0.5, 0.2, 0.5, yel, bx - 0.1, Y1 + 1.65, 0);
  for (const s of [-1, 1]) { box(0.06, 1.5, 0.12, team, bx + 0.97, Y1 + 0.3, s * 1.28, { dirt: 0, cast: false }); box(0.3, 0.35, 0.06, M.hazard, bx + 0.8, Y1 + 1.4, s * 1.92, { dirt: 0 }); }
  box(0.06, 0.12, 2.5, team, bx + 0.97, Y1 + 1.78, 0, { dirt: 0, cast: false });
  box(1.6, 0.04, 2.4, M.emit(S.warm('#ffd7a0'), 0.6), bx - 0.15, Y1 + 0.25, 0, { dirt: 0, cast: false });      // the bay floor, lit
  // inside: a Warbot on the line, nearly done (the review renders only: the game draws its own robots)
  if (S.view === 'hero') warbot(L, bx + 0.1, Y1 + 0.3, 0, 0, S.team, 3);
  for (const s of [-1, 1]) { bar(L, V3(bx - 0.5, Y1 + 1.8, s * 0.6), V3(bx - 0.1, Y1 + 0.9, s * 0.35), 0.06, 0.06, yel); }
  // the chute: a hinged ramp let down to the ground ahead of it, hazard-striped edges
  const rA = V3(HL + 0.0, Y1 + 0.15, 0), rB = V3(HL + 2.6, 0.06, 0);
  const rm = bar(L, rA, rB, 2.3, 0.12, M.paint('#5b6066', { rivets: false }));
  for (const s of [-1, 1]) bar(L, V3(rA.x, rA.y + 0.1, s * 1.18), V3(rB.x, rB.y + 0.1, s * 1.18), 0.12, 0.14, M.hazard);
  for (const s of [-1, 1]) seg(L, V3(HL - 0.2, Y1 + 1.4, s * 1.5), V3(HL + 1.4, Y1 * 0.55, s * 1.18), 0.035, 0.035, M.dark, { sides: 6 });
  L.mark('exit', HL + 2.6, 0, 0);

  // corner lamps in the holder's colour
  for (const [u, z] of [[HL - 0.9, -HW], [HL - 0.9, HW], [-HL + 0.9, -HW], [-HL + 0.9, HW]]) lamp(u, Y0 + 0.8, z * 1.02, S.team, { size: 0.22, k: S.dim ? 0.3 : 4, intensity: S.dim ? 0 : 3, dist: 3 });

  // ---------------- the legs ----------------
  const amp = STRIDE * 0.28;
  for (let k = 0; k < 6; k++) {
    const g = S.rest ? { side: k < 3 ? -1 : 1, u: 0, lift: 0 } : gait(k, S.f, S.n, amp), s = g.side, hu = [-3.6, 0, 3.6][k % 3];
    const H = V3(hu, Y0 + 0.1, s * (HW + 0.8));
    const F = V3(hu * 1.12 + g.u, 0.35 + g.lift * 1.1, s * 6.7);
    const K = knee(THREE, H, F, 2.7, 3.6, V3(0, 0.75, s * 1));
    bar(L, H, K, 0.55, 0.62, gun); bar(L, K, F, 0.42, 0.48, gunL);
    hcyl(0.36, 0.75, yel, K.x, K.y, K.z, { axis: 'x' });
    // the hydraulic ram from the hull side to the thigh
    const r0 = V3(hu + 0.1, Y1 + 0.2, s * (HW - 0.1)), r1 = H.clone().lerp(K, 0.62).add(V3(0, 0.34, 0));
    seg(L, r0, r0.clone().lerp(r1, 0.55), 0.14, 0.14, gunD); seg(L, r0.clone().lerp(r1, 0.5), r1, 0.07, 0.07, M.chrome);
    // the shin's second ram and the foot: a wide pad on an ankle ball
    const a0 = K.clone().lerp(F, 0.15).add(V3(0, 0, s * 0.3)), a1 = K.clone().lerp(F, 0.78).add(V3(0, 0, s * 0.3));
    seg(L, a0, a1, 0.08, 0.08, M.chrome);
    sphere(0.3, M.steel, F.x, F.y, F.z);
    cyl(0.68, 0.28, gunD, F.x, F.y - 0.35, F.z, { rTop: 0.5, seg: 8 });
    box(0.5, 0.06, 0.14, M.hazard, F.x, F.y - 0.08, F.z + s * 0.45, { dirt: 0 });
  }

  // ---------------- a crew aboard (hero renders only; the game draws its own robots) ----------------
  if (S.view === 'hero' && S.p.get('crew') !== '0' && !S.dim) {
    warbot(L, 0.2, Y1 + 0.05, -1.0, 0.4, S.team, 3); warbot(L, 1.6, Y1 + 0.05, 0.8, -0.3, S.team, 3);
  }
  layer(L, S);
}
