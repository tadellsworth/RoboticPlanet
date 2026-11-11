// Ships, "powered realism" restyle (design study for b/ship.js). Same camera, frame, hulls and parameters:
// top-down, facing +x, orthographic camera straight down, no ground and no shadow plane (the game draws them on the
// water, with their wake), 20 world units across the 1024-px frame.
//   ?kind=cargo  Container Ship: a long hull, the bridge aft, coloured containers stacked in bays (the same stacks
//                as before), lashing bridges between the bays carrying deck floodlights
//   ?kind=tank   Tanker Ship: a long hull, the bridge aft, a pipe deck with manifolds, hatches and a lit catwalk
//   ?kind=ferry  Ferry: a short beamy hull, an open vehicle deck with lane marks and a bow ramp, a two-deck
//                passenger cabin over the stern with lit window bands and a wheelhouse
// Real, weathered steel: a charcoal hull with rust-streaked plating, painted decks (grey-green on the container
// ship, green on the tanker, asphalt grey on the ferry), a white superstructure. Powered on top: a team-colour light
// strip runs round the whole deck edge on the bulwark, lit bridge windows (a slanted band across the bridge front),
// lit window lines round each deck of the superstructure, navigation lights (red to port, green to starboard, white
// masthead and stern lights), an amber beacon on the mast, deck floodlights, the team band on the funnel. The
// 'funnel' mark stays where it was.
import { power } from './powerkit.js';
export const config = { pad: false, size: 1024 };
export default function (L) {
  const { box, cyl, hcyl, beam, pipe, mesh, sphere, M, THREE, TEAM } = L;
  const p = new URLSearchParams(location.search), kind = p.get('kind') || 'cargo';
  L.seed(kind === 'cargo' ? 811 : kind === 'tank' ? 822 : 833);
  const W = 20, cam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, 100);
  cam.position.set(0, 40, 0); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  L.useCamera(cam);

  const P = power(L), nc = { dirt: 0, cast: false };
  const hullM = M.paint('#30373d', { panelW: 512 });
  const deckM = M.paint(kind === 'ferry' ? '#4b4f53' : kind === 'tank' ? '#4a5c4e' : '#56605a', { panelW: 256, panelH: 256, rivets: false });
  const off = M.paint('#d9d5ca', { panelW: 128, panelH: 512, rivets: false }), offD = M.paint('#b3afa5', { rivets: false });
  const dark = M.paint('#2a2f34', { rivets: false }), roofM = M.paint('#8c9196', { panelW: 128, rivets: false });
  const team = M.paint('#' + new THREE.Color(TEAM).multiplyScalar(0.7).getHexString(), { rivets: false });
  // the team light (as the powered buildings': the red team's runs deeper so it doesn't wash out to pink)
  const red = /^#ff5a6e$/i.test(TEAM), glow = M.emit(red ? '#ff2a40' : TEAM, red ? 1.4 : 1.1);
  const warm = M.emit('#ffc27a', 0.85), mull = M.plain('#1c2024', 0.6, 0.3), steel = M.plain('#6a7178', 0.35, 0.8);
  const lit = { day: 0.35, morning: 0.55, evening: 1, night: 1 }[L.TOD] ?? 0.35;
  const len = kind === 'ferry' ? 12.4 : 17.2, half = kind === 'ferry' ? 2.35 : 1.95, bow = kind === 'ferry' ? 1.8 : 3.4;
  const XS = -len / 2, XB = len / 2, HH = 1.1, BH = kind === 'ferry' ? 0.45 : 0.2;

  // ---- hull: a flat stern with rounded corners, straight sides, a pointed bow (the ferry's is blunt)
  const hullShape = (inset) => {
    const s = new THREE.Shape(), h = half - inset, xs = XS + inset, xb = XB - inset * 1.8, r = 0.5;
    s.moveTo(xs + r, -h); s.lineTo(xb - bow, -h);
    s.quadraticCurveTo(xb - bow * 0.25, -h * (kind === 'ferry' ? 0.98 : 0.8), xb, kind === 'ferry' ? -h * 0.55 : 0);
    if (kind === 'ferry') s.lineTo(xb, h * 0.55);
    s.quadraticCurveTo(xb - bow * 0.25, h * (kind === 'ferry' ? 0.98 : 0.8), xb - bow, h);
    s.lineTo(xs + r, h); s.quadraticCurveTo(xs, h, xs, h - r); s.lineTo(xs, -h + r); s.quadraticCurveTo(xs, -h, xs + r, -h);
    return s;
  };
  const ext = (shape, depth, mat, y, o = {}) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 }); g.rotateX(-Math.PI / 2); return mesh(g, mat, 0, y, 0, o); };
  ext(hullShape(0), HH, hullM, 0, { dirt: 0.2 });
  ext(hullShape(0.12), 0.04, deckM, HH, { dirt: 0.15 });
  // the bulwark: a steel rim round the whole deck edge, and the team light strip along its top
  {
    const s = hullShape(0); s.holes.push(new THREE.Path(hullShape(0.12).getPoints(24)));
    ext(s, BH, hullM, HH, { dirt: 0 });
    const pts = hullShape(0.06).getSpacedPoints(160);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (Math.hypot(b.x - a.x, b.y - a.y) < 1e-4) continue;
      beam([a.x, HH + BH + 0.012, -a.y], [b.x, HH + BH + 0.012, -b.y], 0.07, 0.025, glow, nc);
    }
  }
  // fittings round the deck edge: bollards fore and aft, the stern light
  for (const s of [-1, 1]) for (const x of [XS + 0.45, XB - bow * 0.95]) for (const dx of [0, 0.22]) cyl(0.06, 0.16, dark, x + dx, HH + 0.04, s * (half - 0.3), { seg: 12, dirt: 0 });
  sphere(0.08, P.white, XS + 0.14, HH + BH + 0.08, 0, { cast: false });

  // a deck floodlight: a small steel housing with a lit lens, casting a warm-white pool toward (ax, az)
  function flood(x, y, z, ax, az, d = 3.2, k = 2.6) {
    box(0.18, 0.08, 0.18, P.steelD, x, y, z, { dirt: 0 });
    box(0.12, 0.03, 0.12, P.white, x, y + 0.08, z, nc);
    L.pointLight('#fff1d6', k * lit, x + (ax - x) * 0.45, y + 0.5, z + (az - z) * 0.45, d);
  }
  // a band of lit window panes on a wall facing +-z (sz) or +x (sx), just proud of the wall so its top edge shows
  function winZ(x0, x1, y, z, sz, n) {
    const w = (x1 - x0) / n;
    box(x1 - x0, 0.2, 0.05, mull, (x0 + x1) / 2, y - 0.02, z + sz * 0.02, nc);
    for (let k = 0; k < n; k++) box(w * 0.78, 0.16, 0.06, warm, x0 + w * (k + 0.5), y, z + sz * 0.025, nc);
  }
  function winX(z0, z1, y, x, n) {
    const w = (z1 - z0) / n;
    box(0.05, 0.2, z1 - z0, mull, x + 0.02, y - 0.02, (z0 + z1) / 2, nc);
    for (let k = 0; k < n; k++) box(0.06, 0.16, w * 0.78, warm, x + 0.025, y, z0 + w * (k + 0.5), nc);
  }
  // the bridge's forward windows: a band of lit panes slanting out at the top, so it shows from above
  function bridgeGlass(x, y0, y1, zh, n) {
    const w = (2 * zh) / n;
    beam([x, y0, -zh], [x, y0, zh], 0.06, 0.06, mull, nc);
    for (let k = 0; k < n; k++) {
      const z = -zh + w * (k + 0.5);
      beam([x, y0, z], [x + 0.2, y1, z], w * 0.8, 0.05, warm, nc);
    }
    beam([x + 0.2, y1, -zh], [x + 0.2, y1, zh], 0.05, 0.05, mull, nc);
  }

  // ---- the superstructure: the bridge aft (cargo, tank) or the passenger cabin (ferry)
  const nav = (x, z, hex) => { sphere(0.12, M.emit(hex, 3.2), x, HH + 2.5, z, { cast: false }); L.pointLight(hex, 1.2 * lit, x, HH + 2.7, z, 1.6); };
  if (kind !== 'ferry') {
    const bx0 = XS + 0.5, bx1 = XS + 3.0, zh1 = half - 0.25, zh2 = half - 0.45;
    box(bx1 - bx0, 1.3, zh1 * 2, off, (bx0 + bx1) / 2, HH, 0, { dirtH: 0.6 });
    box(bx1 - bx0 - 0.4, 0.9, zh2 * 2, off, (bx0 + bx1) / 2 - 0.1, HH + 1.3, 0, { dirt: 0.2 });
    // lit window lines round both decks
    for (const s of [-1, 1]) { winZ(bx0 + 0.2, bx1 - 0.2, HH + 0.95, s * zh1, s, 7); winZ(bx0 + 0.15, bx1 - 0.6, HH + 1.95, s * zh2, s, 6); }
    winX(-zh1 + 0.2, zh1 - 0.2, HH + 0.95, bx1, 8); winX(-zh2 + 0.15, zh2 - 0.15, HH + 1.95, bx1 - 0.3, 6);
    // the bridge deck with wings out over the sides; the lit forward windows; a dark roof
    const brx = bx1 - 0.45;
    box(0.7, 0.55, half * 2 + 0.5, off, brx, HH + 2.2, 0, { dirt: 0.1 });
    bridgeGlass(bx1 - 0.12, HH + 2.28, HH + 2.68, half + 0.2, 12);
    box(0.72, 0.06, half * 2 + 0.6, dark, brx - 0.06, HH + 2.75, 0, { dirt: 0 });
    for (const s of [-1, 1]) winZ(brx - 0.3, brx + 0.25, HH + 2.42, s * (half + 0.25), s, 2);
    // the funnel with the team band, a glowing ring at the band's top edge, sooted top
    cyl(0.42, 1.2, off, bx0 + 0.55, HH + 2.2, 0, { seg: 28, dirt: 0.2, soot: 0.8 });
    cyl(0.43, 0.25, team, bx0 + 0.55, HH + 2.95, 0, { seg: 28, dirt: 0 });
    cyl(0.44, 0.06, team, bx0 + 0.55, HH + 3.36, 0, { seg: 28, dirt: 0 });                                         // team rim round the top
    L.hoop(0.43, 0.02, glow, bx0 + 0.55, HH + 3.2, 0, nc);
    cyl(0.3, 0.05, M.plain('#0b0b0c', 0.9), bx0 + 0.55, HH + 3.4, 0, { seg: 24, dirt: 0 });
    L.mark('funnel', bx0 + 0.55, HH + 3.45, 0);
    // roof clutter: AC units and a liferaft rack on the upper deck, radar scanners on the bridge roof
    box(0.45, 0.18, 0.5, roofM, bx0 + 1.45, HH + 2.2, -0.7, { dirt: 0.2 }); box(0.36, 0.02, 0.4, M.grille('#4a5056'), bx0 + 1.45, HH + 2.38, -0.7, { dirt: 0 });
    for (const z of [0.55, 0.85]) hcyl(0.1, 0.4, M.plain('#e9e6dc', 0.5), bx0 + 1.45, HH + 2.3, z, { axis: 'x', dirt: 0 });
    // the mast forward of the bridge: radar bars, a white masthead light and an amber beacon
    cyl(0.05, 1.1, steel, bx1 - 0.2, HH + 2.8, 0, { seg: 10 });
    box(0.08, 0.04, 1.0, dark, bx1 - 0.2, HH + 3.35, 0, { dirt: 0 });
    box(0.06, 0.03, 0.7, dark, brx - 0.15, HH + 2.95, -0.6, { dirt: 0, ry: 0.5 });
    cyl(0.03, 0.15, steel, brx - 0.15, HH + 2.81, -0.6, { seg: 8 });
    sphere(0.12, M.emit('#ffffff', 3.2), bx1 - 0.2, HH + 3.9, 0, { cast: false });
    P.beacon(bx1 - 0.2, HH + 3.62, 0.18, '#ffb347');
    nav(bx1 - 0.45, -half - 0.22, '#ff2a22'); nav(bx1 - 0.45, half + 0.22, '#22ff6a');
    // enclosed lifeboats in davits on both sides
    for (const s of [-1, 1]) {
      hcyl(0.24, 1.3, M.paint('#e8701e', { rivets: false }), bx0 + 1.2, HH + 1.5, s * (half - 0.15), { axis: 'x', dirt: 0 });
      box(1.0, 0.04, 0.2, M.paint('#e8701e', { rivets: false }), bx0 + 1.2, HH + 1.72, s * (half - 0.15), { dirt: 0 });
    }
    // floodlights at the front corners of the house, lighting the deck ahead
    for (const s of [-1, 1]) flood(bx1 + 0.05, HH + 1.32, s * (zh1 - 0.15), bx1 + 2.5, s * 0.8);
  } else {
    const cx0 = XS + 0.6, cx1 = XS + 5.4, zh1 = half - 0.15, zh2 = half - 0.4;
    box(cx1 - cx0, 1.0, zh1 * 2, off, (cx0 + cx1) / 2, HH, 0, { dirtH: 0.5 });
    box(cx1 - cx0 - 0.5, 0.9, zh2 * 2, off, (cx0 + cx1) / 2 - 0.2, HH + 1.0, 0, { dirt: 0.2 });
    // continuous lit window bands down both decks, the saloon front windows
    for (const s of [-1, 1]) { winZ(cx0 + 0.25, cx1 - 0.25, HH + 0.6, s * zh1, s, 12); winZ(cx0 + 0.2, cx1 - 0.75, HH + 1.5, s * zh2, s, 10); }
    winX(-zh1 + 0.2, zh1 - 0.2, HH + 0.6, cx1, 10);
    // the wheelhouse across the beam: lit slanted windows, a dark roof with the team light strip
    box(1.2, 0.5, half * 2 + 0.3, off, cx1 - 0.85, HH + 1.9, 0, { dirt: 0.1 });
    bridgeGlass(cx1 - 0.27, HH + 1.96, HH + 2.36, half + 0.1, 14);
    box(1.15, 0.06, half * 2 + 0.5, dark, cx1 - 0.9, HH + 2.4, 0, { dirt: 0 });
    for (const s of [-1, 1]) winZ(cx1 - 1.35, cx1 - 0.4, HH + 2.1, s * (half + 0.15), s, 3);
    // the sun deck on the cabin roof: a team light strip down the middle, benches, a skylight
    box(cx1 - cx0 - 1.6, 0.04, 0.32, team, (cx0 + cx1) / 2 - 0.9, HH + 1.9, 0, { dirt: 0 });
    box(cx1 - cx0 - 1.8, 0.02, 0.07, glow, (cx0 + cx1) / 2 - 0.9, HH + 1.94, 0, nc);
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) box(0.5, 0.08, 0.14, M.wood, cx0 + 1.6 + k * 0.7, HH + 1.9, s * 0.55, { dirt: 0 });
    for (const s of [-1, 1]) { cyl(0.26, 0.9, off, cx0 + 0.7, HH + 1.9, s * 0.9, { seg: 24, dirt: 0.2, soot: 0.8 }); cyl(0.27, 0.2, team, cx0 + 0.7, HH + 2.5, s * 0.9, { seg: 24, dirt: 0 }); cyl(0.28, 0.05, team, cx0 + 0.7, HH + 2.78, s * 0.9, { seg: 24, dirt: 0 }); cyl(0.18, 0.04, M.plain('#0b0b0c', 0.9), cx0 + 0.7, HH + 2.8, s * 0.9, { seg: 20, dirt: 0 }); L.hoop(0.27, 0.016, glow, cx0 + 0.7, HH + 2.7, s * 0.9, nc); }
    cyl(0.05, 0.9, steel, cx1 - 0.6, HH + 2.45, 0, { seg: 10 });
    box(0.06, 0.04, 0.8, dark, cx1 - 0.6, HH + 2.95, 0, { dirt: 0 });
    sphere(0.12, M.emit('#ffffff', 3.2), cx1 - 0.6, HH + 3.4, 0, { cast: false });
    P.beacon(cx1 - 0.6, HH + 3.12, 0.16, '#ffb347');
    nav(cx1 - 0.85, -half - 0.22, '#ff2a22'); nav(cx1 - 0.85, half + 0.22, '#22ff6a');
    L.mark('funnel', cx0 + 0.7, HH + 2.85, -0.9);
    // the vehicle deck: lane marks, chevrons toward the ramp, and the bow ramp (raised, hinged at the bow)
    const dx0 = cx1 + 0.2, dx1 = XB - 0.9;
    for (const z of [-1.0, 0, 1.0]) box(dx1 - dx0, 0.01, 0.06, M.paint('#d8b53a', { rivets: false }), (dx0 + dx1) / 2, HH + 0.04, z, { dirt: 0 });
    for (const z of [-1.5, -0.5, 0.5, 1.5]) for (const x of [dx0 + 0.5, dx1 - 0.6]) for (const s of [-1, 1]) {
      const m = box(0.36, 0.01, 0.05, M.plain('#e4e2da', 0.7), x, HH + 0.045, z + s * 0.11, { dirt: 0 }); m.rotation.y = s * 0.55;
    }
    box(0.25, 0.9, half * 2 - 0.6, M.paint('#4b5157', { panelW: 64 }), XB - 0.75, HH, 0, { dirt: 0.2 });
    box(0.24, 0.04, half * 2 - 0.8, M.hazard, XB - 0.75, HH + 0.9, 0, { dirt: 0 });
    // floodlights on the ramp frame and at the cabin front, lighting the vehicle deck
    for (const s of [-1, 1]) { flood(XB - 0.75, HH + 0.94, s * (half - 0.45), XB - 3, s * 0.8); flood(cx1 + 0.05, HH + 1.02, s * (zh1 - 0.2), cx1 + 2.5, s * 0.6); }
  }

  // ---- the cargo: container bays (cargo) or the pipe deck (tank)
  if (kind === 'cargo') {
    const cols = ['#4f6f86', '#a24a32', '#c9c5ba', '#6d7148', '#8a5a2e', '#2f5a5a', '#b88a2a'];
    // the same stacks as the shipped art (bay by bay, north row first; colour indices bottom tier up)
    const STACKS = [[5, 4, 0], [6], [5, 2], [6, 1, 2], [5, 2, 2], [5, 6, 3], [6, 3, 5], [5, 2, 4], [2], [5, 6, 1], [2, 0], [4, 4], [2], [0, 6, 3], [1, 2], [2, 4, 0], [1], [3, 0], [5], [5, 6]];
    const bx0 = XS + 3.4, bx1 = XB - bow + 0.6, n = 5, bw = (bx1 - bx0) / n;
    let q = 0;
    for (let b = 0; b < n; b++) {
      const x = bx0 + bw * (b + 0.5);
      box(bw - 0.12, 0.06, 3.2, dark, x, HH + 0.02, 0, { dirt: 0.3 });                                      // hatch cover under the stack
      for (const z of [-1.15, -0.38, 0.38, 1.15]) {
        const st = STACKS[q++];
        for (let t = 0; t < st.length; t++) box(bw - 0.22, 0.7, 0.72, M.ribbed(cols[st[t]], { period: 12 }), x, HH + 0.08 + t * 0.72, z, { dirtH: 0.5 });
      }
    }
    // lashing bridges between the bays, each with a floodlight at both ends
    for (let b = 1; b < n; b++) {
      const x = bx0 + bw * b;
      box(0.1, 1.5, 0.1, steel, x, HH, -1.62, { dirt: 0 }); box(0.1, 1.5, 0.1, steel, x, HH, 1.62, { dirt: 0 });
      box(0.12, 0.05, 3.3, M.grating, x, HH + 1.5, 0, { dirt: 0 });
      for (const s of [-1, 1]) flood(x, HH + 1.55, s * 1.7, x, s * 0.3, 2.6, 1.6);
    }
    box(0.5, 0.9, half * 2 - 0.4, M.paint('#4b5157', { panelW: 64 }), XB - bow + 0.7, HH, 0, { dirt: 0.2 });           // forecastle breakwater
    box(0.52, 0.03, half * 2 - 0.5, M.plain('#d9d5ca', 0.7), XB - bow + 0.7, HH + 0.9, 0, { dirt: 0 });
    cyl(0.18, 0.25, dark, XB - 1.4, HH, -0.5, { seg: 16 }); cyl(0.18, 0.25, dark, XB - 1.4, HH, 0.5, { seg: 16 });    // windlasses
    cyl(0.04, 0.9, steel, XB - 2.2, HH, 0, { seg: 8 }); sphere(0.08, M.emit('#ffffff', 2.4), XB - 2.2, HH + 0.95, 0, { cast: false });  // foremast light
    flood(XB - bow + 0.7, HH + 0.95, 0, XB - bow - 1.5, 0, 3, 1.8);
  } else if (kind === 'tank') {
    const px0 = XS + 3.4, px1 = XB - bow + 0.4;
    box(px1 - px0, 0.06, 0.55, M.grating, (px0 + px1) / 2, HH + 0.7, 0, { dirt: 0 });                                  // catwalk on posts
    for (const s of [-1, 1]) box(px1 - px0, 0.04, 0.04, M.paint('#d0a536', { rivets: false }), (px0 + px1) / 2, HH + 1.0, s * 0.27, { dirt: 0 });
    let kk = 0;
    for (let x = px0 + 0.3; x < px1; x += 1.2, kk++) {
      box(0.08, 0.7, 0.08, steel, x, HH, 0, { dirt: 0 });
      if (kk % 2 === 1) { cyl(0.025, 0.4, steel, x, HH + 0.76, 0.3, { seg: 8 }); flood(x, HH + 1.16, 0.3, x, 1.2, 2.4, 1.4); }
    }
    for (const z of [-0.6, 0.6, -0.95, 0.95]) pipe([[px0, HH + 0.22, z], [px1, HH + 0.22, z]], z * z > 0.5 ? 0.09 : 0.12, z < 0 ? M.paint('#a58a46', { rivets: false }) : M.paint('#6d8a99', { rivets: false }));
    for (let k = 0; k < 6; k++) {                                                                                        // tank hatches and vents
      const x = px0 + 0.8 + k * (px1 - px0 - 1.4) / 5;
      for (const s of [-1, 1]) { cyl(0.28, 0.12, dark, x, HH, s * 1.35, { seg: 20, dirt: 0.1 }); L.hoop(0.28, 0.02, steel, x, HH + 0.12, s * 1.35); cyl(0.07, 0.4, steel, x + 0.4, HH, s * 1.4, { seg: 10 }); }
    }
    const mx = (px0 + px1) / 2;                                                                                           // the cargo manifold amidships
    box(0.9, 0.35, half * 2 - 0.4, M.paint('#4b5157', { panelW: 64 }), mx, HH, 0, { dirt: 0.2 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) hcyl(0.1, 0.5, M.paint('#c43b2a', { rivets: false }), mx - 0.25 + k * 0.25, HH + 0.45, s * (half - 0.35), { axis: 'z', dirt: 0 });
    // the hose-handling crane by the manifold: a pedestal and a jib laid fore and aft
    cyl(0.2, 0.9, M.paint('#d0a536', { rivets: false }), mx + 0.75, HH, -1.15, { seg: 18, dirt: 0.2 });
    beam([mx + 0.75, HH + 1.0, -1.15], [mx + 2.6, HH + 1.25, -1.0], 0.14, 0.14, M.paint('#d0a536', { rivets: false }));
    flood(mx + 0.75, HH + 0.95, -1.15, mx, -0.3, 2.6, 1.6);
    const plac = L.canvasTex(128, (g, n) => { g.fillStyle = '#e8541c'; g.fillRect(0, 0, n, n); g.strokeStyle = '#1b1b1b'; g.lineWidth = 6; g.strokeRect(10, 10, n - 20, n - 20);
      g.fillStyle = '#1b1b1b'; g.beginPath(); g.moveTo(n / 2, 26); g.bezierCurveTo(n * 0.78, n * 0.45, n * 0.7, n * 0.66, n / 2, n * 0.7); g.bezierCurveTo(n * 0.3, n * 0.66, n * 0.24, n * 0.48, n * 0.4, n * 0.36);
      g.bezierCurveTo(n * 0.42, n * 0.48, n * 0.5, n * 0.5, n / 2, 26); g.fill(); });
    const placM = new THREE.MeshStandardMaterial({ map: plac, roughness: 0.6, vertexColors: true });
    for (const x of [mx - 2.2, mx + 2.2]) { const pl = box(0.6, 0.02, 0.6, placM, x, HH + 0.05, 0, { dirt: 0, cast: false }); pl.rotation.y = Math.PI / 4; }
    cyl(0.18, 0.25, dark, XB - 1.6, HH, -0.5, { seg: 16 }); cyl(0.18, 0.25, dark, XB - 1.6, HH, 0.5, { seg: 16 });
    cyl(0.04, 0.9, steel, XB - 2.3, HH, 0, { seg: 8 }); sphere(0.08, M.emit('#ffffff', 2.4), XB - 2.3, HH + 0.95, 0, { cast: false });
  }
  // a fuel-amber working light at the bow
  sphere(0.1, M.emit('#ffd9a0', 2), XB - (kind === 'ferry' ? 0.5 : 1.0), HH + 0.4, 0, { cast: false });
}
