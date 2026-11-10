// Bridge kit, three styles, seen from above with the south faces showing (oblique projection, like the map's cliffs).
//   ?style = water | sky | rail      ?piece = ew | ns | end-w|e|n|s | ramp-w|e|n|s | pier | tower | lamp | cable
// One tile = 10 world units = 256 px. The deck top is at y = 0, centred, 56 % of the tile wide (z = ±2.8).
// Projection: screen_x = x - KX*y, screen_y(down) = z - KY*y, so things below the deck appear lower on screen.
const P = new URLSearchParams(location.search);
const STYLE = P.get('style') || 'water', PIECE = P.get('piece') || 'ew';
export const config = PIECE === 'pier' || PIECE === 'tower' || PIECE === 'lamp' ? { pad: false, w: 512, h: 1024 }
  : PIECE === 'cable' ? { pad: false, w: 2048, h: 512 } : { pad: false, size: 512 };
const KY = 1.0;
const NSP = /^(ns|end-n|end-s|ramp-n|ramp-s)$/.test(PIECE);
const KX = NSP ? 0.14 : 0;
const HW = 2.8, RW = 2.3;                              // deck half-width, road half-width

export default function (L) {
  const { box, cyl, hcyl, mesh, beam, group, sphere, lamp, M, THREE, R } = L;
  L.seed(7070 + STYLE.length * 13);

  // ---- oblique orthographic camera
  function cam(x0, x1, ys0, ys1, kx = KX, ky = KY) {
    const c = new THREE.OrthographicCamera(x0, x1, -ys0, -ys1, 0.1, 200);
    c.position.set(0, 60, 0); c.up.set(0, 0, -1); c.lookAt(0, 0, 0); c.updateMatrixWorld(); c.updateProjectionMatrix();
    const sh = new THREE.Matrix4().set(1, 0, -kx, -60 * kx, 0, 1, ky, 60 * ky, 0, 0, 1, 0, 0, 0, 0, 1);
    c.projectionMatrix.multiply(sh); c.projectionMatrixInverse.copy(c.projectionMatrix).invert();
    L.useCamera(c);
  }

  // ---- materials
  const concPale = M.rough('#b8b1a5'), conc = M.rough('#9a9387'), asphalt = M.plain('#353638', 0.85, 0);
  const white = M.plain('#e2dfd8', 0.6, 0), yellowLine = M.plain('#d4ae3a', 0.6, 0);
  const girder = M.paint('#5d6872', { panelW: 128, rivets: false }), girderD = M.paint('#4a535c', { rivets: false });
  const skySteel = M.paint('#6c737b', { panelW: 128 }), skyDeck = M.paint('#555b62', { panelW: 128, panelH: 128 });
  const railSteel = M.paint('#4d545b', { panelW: 64 }), grip = M.ribbed('#45494e', { period: 8 });
  const railingMat = STYLE === 'rail' ? M.paint('#c49a2c', { rivets: false }) : M.paint('#8a939b', { rivets: false });
  const gravelTex = L.canvasTex(512, (g, n) => {
    g.fillStyle = '#4f4841'; g.fillRect(0, 0, n, n);
    const cols = ['#6f675e', '#5d554d', '#7b7268', '#4d4640', '#6a5c50', '#746a60', '#847b70', '#463f39'];
    for (let i = 0; i < 5200; i++) { const x = R(0, n), y = R(0, n), rx = R(3.5, 8), ry = rx * R(0.6, 1), a = R(0, 3.14), c = cols[Math.floor(R(0, cols.length))];
      for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { const X = x + ox, Y = y + oy; if (X < -20 || X > n + 20 || Y < -20 || Y > n + 20) continue;
        g.fillStyle = 'rgba(25,20,16,0.55)'; g.beginPath(); g.ellipse(X + 2, Y + 2, rx, ry, a, 0, 7); g.fill(); g.fillStyle = c; g.beginPath(); g.ellipse(X, Y, rx, ry, a, 0, 7); g.fill(); } }
  });
  gravelTex.repeat.set(1, 1);
  const gravel = new THREE.MeshStandardMaterial({ map: gravelTex, color: '#8a8580', roughness: 0.95, vertexColors: true });

  // a beam between two points given in a (possibly rotated) group's own coordinates
  function lbeam(g, a, b, w, h, mat) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    const m = mesh(new THREE.BoxGeometry(w, h, len), mat, (A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2, { parent: g, dirt: 0 });
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); return m;
  }
  // grid positions so every tile's posts, dashes and truss nodes line up with its neighbours
  const grid = (xa, xb, step, off = 0) => { const out = []; for (let x = -15 + off; x <= 15 + 1e-6; x += step) if (x >= xa - 1e-6 && x <= xb + 1e-6) out.push(x); return out; };

  function railings(g, xa, xb, endBollards) {
    const posts = grid(xa, xb, 1.25, 0.625);
    for (const s of [-1, 1]) {
      const z = s * (HW - 0.12);
      for (const x of posts) box(0.12, 0.95, 0.12, railingMat, x, 0.14, z, { parent: g, dirt: 0 });
      for (const y of [0.55, 1.05]) { const r = mesh(new THREE.CylinderGeometry(0.05, 0.05, xb - xa, 10).rotateZ(Math.PI / 2), railingMat, (xa + xb) / 2, y, z, { parent: g, dirt: 0 }); }
      for (const x of endBollards || []) { cyl(0.26, 0.55, conc, x, 0.12, z, { parent: g, seg: 16, dirt: 0.3 }); cyl(0.27, 0.1, M.hazard, x, 0.42, z, { parent: g, seg: 16, dirt: 0 }); }
    }
  }

  // ---- one style's deck span from local xa to xb (deck along local x)
  function span(g, xa, xb, o = {}) {
    const len = xb - xa, cx = (xa + xb) / 2;
    if (STYLE === 'water') {
      box(len, 0.55, HW * 2, concPale, cx, -0.55, 0, { parent: g, dirtH: 0.3 });
      box(len, 0.04, RW * 2, asphalt, cx, 0, 0, { parent: g, dirt: 0 });
      for (const s of [-1, 1]) { box(len, 0.16, HW - RW, concPale, cx, 0, s * (RW + (HW - RW) / 2), { parent: g, dirt: 0.2 }); box(len, 0.012, 0.1, white, cx, 0.04, s * (RW - 0.25), { parent: g, dirt: 0, cast: false }); }
      for (const x of grid(xa, xb, 1.25, 0.625)) if (x - 0.3 >= xa && x + 0.3 <= xb) box(0.6, 0.012, 0.1, white, x, 0.04, 0, { parent: g, dirt: 0, cast: false });
      for (const z of [-1.9, 0, 1.9]) {
        box(len, 1.0, 0.14, girder, cx, -1.55, z, { parent: g, dirt: 0.3 });
        box(len, 0.08, 0.55, girderD, cx, -1.63, z, { parent: g, dirt: 0 });
      }
      for (const x of grid(xa, xb, 1.25, 0.625)) box(0.08, 1.0, 0.36, girderD, x, -1.55, 1.9 + 0.12, { parent: g, dirt: 0 });
      for (const x of grid(xa, xb, 2.5, 1.25)) box(0.16, 0.7, 3.8, girderD, x, -1.35, 0, { parent: g, dirt: 0 });
    } else if (STYLE === 'sky') {
      box(len, 0.36, HW * 2, skyDeck, cx, -0.36, 0, { parent: g, dirt: 0 });
      box(len, 0.03, RW * 2, grip, cx, 0, 0, { parent: g, dirt: 0 });
      for (const s of [-1, 1]) { box(len, 0.14, HW - RW, skySteel, cx, 0, s * (RW + (HW - RW) / 2), { parent: g, dirt: 0 }); box(len, 0.012, 0.09, yellowLine, cx, 0.03, s * (RW - 0.22), { parent: g, dirt: 0, cast: false }); }
      for (const x of grid(xa, xb, 1.25, 0.625)) if (x - 0.3 >= xa && x + 0.3 <= xb) box(0.6, 0.012, 0.09, white, x, 0.03, 0, { parent: g, dirt: 0, cast: false });
      truss(g, xa, xb, 2.15, skySteel, 'warren', o);
    } else {
      box(len, 0.32, HW * 2, railSteel, cx, -0.32, 0, { parent: g, dirt: 0.3 });
      for (const s of [-1, 1]) box(len, 0.5, 0.14, railSteel, cx, -0.3, s * 2.12, { parent: g, dirt: 0 });       // ballast trough walls
      const bg = new THREE.BoxGeometry(len, 0.28, 4.1); bg.translate(cx, 0.14 - 0.02, 0);
      const uv = bg.attributes.uv, pos = bg.attributes.position;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 5, -pos.getZ(i) / 5);
      mesh(bg, gravel, 0, 0, 0, { parent: g, dirt: 0 });
      for (const s of [-1, 1]) box(len, 0.06, 0.6, M.grating, cx, 0.02, s * 2.5, { parent: g, dirt: 0 });
      truss(g, xa, xb, 2.15, railSteel, 'pratt', o);
    }
    railings(g, xa, xb, o.bollards);
  }

  // truss under both deck edges; nodes on the shared 1.25 grid so spans join
  function truss(g, xa, xb, depth, mat, kind, o) {
    const nodes = grid(xa, xb, 1.25);
    if (nodes[0] > xa + 0.05) nodes.unshift(xa); if (nodes[nodes.length - 1] < xb - 0.05) nodes.push(xb);
    const top = -0.5, bot = -depth;
    for (const z of [-HW + 0.18, HW - 0.18]) {
      box(xb - xa, 0.24, 0.26, mat, (xa + xb) / 2, top - 0.24, z, { parent: g, dirt: 0 });
      box(xb - xa, 0.26, 0.3, mat, (xa + xb) / 2, bot, z, { parent: g, dirt: 0 });
      for (let i = 0; i < nodes.length - 1; i++) {
        const xA = nodes[i], xB = nodes[i + 1];
        const kA = Math.round((xA + 5) / 1.25), up = kind === 'warren' ? (kA % 2 === 0) : true;
        if (kind === 'warren') {
          const yA = up ? top - 0.12 : bot + 0.13, yB = up ? bot + 0.13 : top - 0.12;
          lbeam(g, [xA, yA, z], [xB, yB, z], 0.2, 0.2, mat);
        } else {
          const toward = (xA + xB) / 2 < 0 ? 1 : -1;     // Pratt: diagonals lean toward the middle of the tile
          if (toward > 0) lbeam(g, [xA, top - 0.12, z], [xB, bot + 0.13, z], 0.18, 0.18, mat);
          else lbeam(g, [xA, bot + 0.13, z], [xB, top - 0.12, z], 0.18, 0.18, mat);
        }
      }
      for (const x of grid(xa, xb, 1.25)) {
        if (kind === 'pratt' || STYLE === 'sky') box(0.16, top - bot - 0.24, 0.2, mat, x, bot + 0.13, z, { parent: g, dirt: 0 });
        if (kind === 'pratt') for (const y of [top - 0.2, bot + 0.1]) box(0.42, 0.34, 0.06, mat, x, y - 0.17, z + Math.sign(z) * 0.14, { parent: g, dirt: 0 });   // gusset plates
      }
    }
    for (const x of grid(xa, xb, 2.5, 0.625)) box(0.14, 0.14, HW * 2 - 0.4, mat, x, bot + 0.06, 0, { parent: g, dirt: 0 });
  }

  // abutment where the deck meets land at local x = xe .. 5
  function abutment(g, xe) {
    const len = 5 - xe, cx = (xe + 5) / 2;
    box(len, 1.2, HW * 2 + 0.9, conc, cx, -1.2, 0, { parent: g, dirtH: 0.6 });                       // the abutment block
    box(0.5, 1.6, HW * 2 + 1.0, M.rough('#857e72'), xe + 0.25, -1.6, 0, { parent: g, dirtH: 0.6 });   // bearing shelf facing the gap
    for (const s of [-1, 1]) {                                                                         // angled wing walls
      const wg = new THREE.BoxGeometry(len * 1.05, 1.0, 0.4); wg.translate(len * 0.52, -0.6, 0);
      const w = mesh(wg, conc, xe, 0, s * (HW + 0.35), { parent: g, dirtH: 0.5 }); w.rotation.y = -s * 0.22;
    }
    box(len, 0.05, RW * 2, STYLE === 'water' ? asphalt : (STYLE === 'sky' ? grip : conc), cx, 0, 0, { parent: g, dirt: 0 });
    if (STYLE === 'rail') { const bg = new THREE.BoxGeometry(len, 0.28, 4.1); bg.translate(cx, 0.12, 0); const uv = bg.attributes.uv, pos = bg.attributes.position; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 5, -pos.getZ(i) / 5); mesh(bg, gravel, 0, 0, 0, { parent: g, dirt: 0 }); }
    for (const s of [-1, 1]) box(len, 0.16, HW - RW + 0.45, concPale, cx, 0, s * (RW + (HW - RW + 0.45) / 2), { parent: g, dirt: 0.2 });
  }

  const ROT = { e: 0, w: Math.PI, s: -Math.PI / 2, n: Math.PI / 2 };   // local +x (toward the land/low end) -> world direction
  const NSROT = -Math.PI / 2;                                         // deck along world z for the straight ns piece

  if (PIECE === 'ew' || PIECE === 'ns') {
    cam(-5, 5, -5, 5);
    const g = group(0, 0, 0, PIECE === 'ns' ? NSROT : 0);
    if (PIECE === 'ns') span(g, -7.6, 5.7); else span(g, -5, 5);        // ns: extend north so the structure below still fills the top of the tile
  } else if (PIECE.startsWith('end-')) {
    cam(-5, 5, -5, 5);
    const dir = PIECE.slice(4), g = group(0, 0, 0, ROT[dir]);
    span(g, dir === 's' ? -7.6 : dir === 'n' ? -5.7 : -5, 0.9, { bollards: [0.9] });
    abutment(g, 0.9);
  } else if (PIECE.startsWith('ramp-')) {
    cam(-5, 5, -5, 5);
    const dir = PIECE.slice(5), g = group(0, 0, 0, ROT[dir]);
    span(g, dir === 's' ? -7.6 : dir === 'n' ? -5.7 : -5, 5, { bollards: [4.75] });
    for (let x = -4.4; x < 4.8; x += 0.55) box(0.09, 0.02, RW * 2 - 0.4, M.dark, x, STYLE === 'rail' ? 0.27 : 0.045, 0, { parent: g, dirt: 0, cast: false });   // grip grooves
    // bake transforms, then slope the deck down toward the land side and shrink the structure below it;
    // shift x/z so the deck top still sits on its tile on screen
    const D = 2.2;
    g.updateMatrixWorld(true);
    const tOf = (X, Z) => ({ e: (X + 5) / 10, w: (5 - X) / 10, s: (Z + 5) / 10, n: (5 - Z) / 10 }[dir]);
    g.traverse(o => {
      if (!o.isMesh) return;
      o.geometry = o.geometry.clone(); o.geometry.applyMatrix4(o.matrixWorld);
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const X = p.getX(i), Z = p.getZ(i); let Y = p.getY(i);
        const t = Math.min(1, Math.max(0, tOf(X, Z)));
        const Y0 = Y; if (Y < 0) Y = Y * (1 - 0.92 * t); Y -= D * t;
        p.setXYZ(i, X + KX * (Y - Y0), Y, Z + KY * (Y - Y0));
      }
      o.geometry.computeVertexNormals();
      o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1);
    });
    const meshes = []; g.traverse(o => { if (o.isMesh) meshes.push(o); });
    for (const m of meshes) { L.getRoot().attach(m); m.position.set(0, 0, 0); m.rotation.set(0, 0, 0); m.scale.set(1, 1, 1); m.updateMatrix(); }
  } else if (PIECE === 'pier') {
    // image top = the deck tile's centre line; the pier hangs from the deck's underside downward, 2 tiles tall
    cam(-5, 5, 0, 20, 0, KY);
    if (STYLE === 'water') {
      const wl = -5.0;                                                                         // water line, a quarter of the way down
      const sh = new THREE.Shape(); sh.absarc(0, -1.5, 0.75, Math.PI, 0, false); sh.lineTo(0.75, 1.5); sh.absarc(0, 1.5, 0.75, 0, Math.PI, false); sh.closePath();
      const pg = new THREE.ExtrudeGeometry(sh, { depth: -wl - 0.4, bevelEnabled: false, curveSegments: 16 }); pg.rotateX(Math.PI / 2); pg.translate(0, -0.4, 0);
      mesh(pg, conc, 0, 0, 0, { dirtH: 2.0 });
      box(1.9, 0.5, 4.4, concPale, 0, -0.95, 0, { dirt: 0.2 });                                  // pier cap under the girders
      const rip = M.plain('#e8f4f2', 0.3, 0);
      for (const [r, op] of [[1.25, 0.8], [1.75, 0.5], [2.3, 0.28]]) {
        const tg = new THREE.TorusGeometry(1, 0.05, 6, 48); tg.rotateX(Math.PI / 2); tg.scale(r * 0.9, 1, r * 1.35);
        const m = mesh(tg, new THREE.MeshStandardMaterial({ color: '#e8f4f2', transparent: true, opacity: op, roughness: 0.3 }), 0, wl + 0.02, 0, { dirt: 0, cast: false });
      }
      box(1.6, 0.02, 3.2, M.plain('#2b4a55', 0.2, 0), 0, wl - 0.01, 0.0, { dirt: 0, cast: false });
    } else if (STYLE === 'sky') {
      for (const z of [-1.9, 1.9]) {
        box(0.75, 24, 0.75, skySteel, 0, -25, z, { dirt: 0 });
        box(0.9, 0.3, 0.9, skySteel, 0, -0.9, z, { dirt: 0 });
      }
      for (let y = -2.5; y > -24; y -= 3.2) {
        L.beam([0, y, -1.9], [0, y - 3.2, 1.9], 0.22, 0.22, skySteel); L.beam([0, y, 1.9], [0, y - 3.2, -1.9], 0.22, 0.22, skySteel);
        box(0.3, 0.3, 3.8, skySteel, 0, y - 3.2, 0, { dirt: 0 });
      }
      box(1.4, 0.45, 4.6, skySteel, 0, -0.95, 0, { dirt: 0 });
    } else {
      // lattice trestle tower, battered (wider toward the bottom)
      const leg = (zt, zb, x) => L.beam([x, -0.8, zt], [x * 1.6, -24, zb], 0.3, 0.3, railSteel);
      for (const s of [-1, 1]) for (const xs of [-0.55, 0.55]) leg(s * 1.9, s * 2.7, xs);
      for (let k = 0; k < 7; k++) {
        const y0 = -0.8 - k * 3.3, y1 = y0 - 3.3, f0 = 1 + 0.6 * (k * 3.3) / 23.2, f1 = 1 + 0.6 * ((k + 1) * 3.3) / 23.2;
        for (const xs of [-0.55, 0.55]) { L.beam([xs * f0, y0, -1.9 - 0.8 * (k / 7)], [xs * f1, y1, 1.9 + 0.8 * ((k + 1) / 7)], 0.14, 0.14, railSteel); L.beam([xs * f0, y0, 1.9 + 0.8 * (k / 7)], [xs * f1, y1, -1.9 - 0.8 * ((k + 1) / 7)], 0.14, 0.14, railSteel); }
        box(1.2 * f1, 0.2, (1.9 + 0.8 * ((k + 1) / 7)) * 2, railSteel, 0, y1, 0, { dirt: 0 });
      }
      box(1.6, 0.4, 4.6, railSteel, 0, -1.0, 0, { dirt: 0 });
    }
  } else if (PIECE === 'tower' || PIECE === 'lamp') {
    // suspension tower: two legs at the deck edges, two cross beams, cable saddles, a red lamp on each leg; base at the image bottom = the deck tile's bottom edge
    cam(-5, 5, -15, 5, 0, KY);
    const lamps = [];
    for (const z of [-HW - 0.1, HW + 0.1]) {
      const leg = new THREE.BoxGeometry(0.9, 10, 0.9); leg.translate(0, 5, 0);
      const lp = leg.attributes.position; for (let i = 0; i < lp.count; i++) if (lp.getY(i) > 5) { lp.setX(i, lp.getX(i) * 0.75); lp.setZ(i, lp.getZ(i) * 0.75); }
      leg.computeVertexNormals();
      mesh(leg, skySteel, 0, 0, z, { dirtH: 3 });
      box(1.3, 0.5, 1.3, skySteel, 0, 0, z, { dirt: 0.3 });
      box(1.0, 0.45, 0.9, skySteel, 0, 10, z, { dirt: 0 });                                     // cable saddle
      hcyl(0.32, 1.2, M.dark, 0, 10.5, z, { axis: 'x' });
      lamps.push(sphere(0.2, M.plain('#5a1414', 0.35), 0, 10.85, z, { cast: false }));
    }
    for (const y of [4.5, 8.6]) box(0.7, 0.75, HW * 2 + 0.4, skySteel, 0, y, 0, { dirt: 0 });
    for (const y of [4.5, 8.6]) box(0.72, 0.12, HW * 2, M.hazard, 0, y + 0.75, 0, { dirt: 0 });
    if (PIECE === 'lamp') { L.getRoot().traverse(o => { if (o.isMesh) o.visible = false; }); for (const m of lamps) { m.visible = true; m.material = M.emit('#ff2a1e', 4); } }
  } else if (PIECE === 'cable') {
    // one main cable sagging from the top corners to near the bottom in the middle, vertical hangers down to the deck-edge line
    cam(-20, 20, -10, 0, 0, KY);
    const cable = M.paint('#3b4046', { rivets: false });
    const Y = x => 0.6 + 9.4 * (x / 20) ** 2;
    const pts = []; for (let i = 0; i <= 80; i++) { const x = -20 + i * 0.5; pts.push(new THREE.Vector3(x, Y(x), 0)); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.16, 8, false), cable, 0, 0, 0, { dirt: 0 });
    for (let x = -18.75; x <= 18.76; x += 1.25) { box(0.05, Y(x) - 0.1, 0.05, cable, x, 0.1, 0, { dirt: 0 }); box(0.16, 0.14, 0.16, M.steel, x, Y(x) - 0.1, 0, { dirt: 0 }); }
    box(40, 0.1, 0.1, M.steel, 0, 0, 0, { dirt: 0 });
  }
}
