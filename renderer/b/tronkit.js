// The "Tron line" for buildings (to match the Lancer warbot and the restyled units): a shared kit so every
// building gets the same look. Dark gunmetal armour with thin dark seams, and light used generously but
// structured: team-colour lines tracing edges (roof outlines, corner posts, the base skirt), glowing panel
// inlays and windows, cool white accents. The foundation pad is a dark armoured plate (instead of the
// concrete-and-hazard pad) with a glowing inset edge line, panel seams and corner light blocks.
//
// Use: export const config = { pad: false };  then in the scene:
//   const T = tron(L);  T.pad();
//   L.box(w, h, d, T.armor, ...);  T.edges(points, y);  T.posts(points, y0, y1);  T.outline(w, d, x, y, z);
// Materials: armor, armorD (darker), armorL (lighter), roof, seam, black, glow, glowHi, glowSoft (dim panels),
// glass (glowing team-tinted windows), white (cool white accents), amber (warning lamps).
// opts.color: the glow colour (defaults to the team colour).
export function tron(L, opts = {}) {
  const { box, beam, M } = L;
  const C = opts.color || L.TEAM;
  const P = {
    armor: M.paint('#3a4046'), armorD: M.paint('#2c3137', { rivets: false }), armorL: M.paint('#4f565e'),
    roof: M.paint('#5e666f', { rivets: false }), seam: M.plain('#101214', 0.8), black: M.plain('#08090a', 0.8),
    glow: M.emit(C, 2.2), glowHi: M.emit(C, 3.4), glowSoft: M.emit(C, 0.7), glass: M.emit(C, 0.5),
    white: M.emit('#e8fbff', 1.6), amber: M.emit('#ffb347', 2.4),
  };
  const nc = { dirt: 0, cast: false };

  /** The dark armoured foundation pad, 10 x 10 (top at y = 0), glowing inset edge line and corner lights. */
  function pad() {
    const plate = M.paint('#24282d', { rivets: false, panelW: 256, panelH: 256, rough: 0.85, metal: 0.25 });
    const rim = M.paint('#33383e', { rivets: false });
    box(10, 0.6, 10, plate, 0, -0.6, 0, { dirt: 0.5, dirtH: 0.6 });
    // a bevelled rim round the top edge
    for (const s of [-1, 1]) {
      box(10.06, 0.12, 0.3, rim, 0, -0.08, s * 4.86, { dirt: 0.2, cast: false });
      box(0.3, 0.12, 10.06, rim, s * 4.86, -0.08, 0, { dirt: 0.2, cast: false });
    }
    // panel seams: a 3 x 3 grid of plates
    for (const t of [-5 / 3, 5 / 3]) {
      box(9.4, 0.012, 0.05, P.seam, 0, 0.001, t, nc);
      box(0.05, 0.012, 9.4, P.seam, t, 0.001, 0, nc);
    }
    // the glowing inset edge line, broken at the corners by the light blocks
    for (const s of [-1, 1]) {
      box(8.0, 0.02, 0.07, P.glow, 0, 0.004, s * 4.45, nc);
      box(0.07, 0.02, 8.0, P.glow, s * 4.45, 0.004, 0, nc);
    }
    for (const [x, z] of [[-4.45, -4.45], [4.45, -4.45], [-4.45, 4.45], [4.45, 4.45]]) {
      box(0.55, 0.08, 0.55, rim, x, 0, z, { dirt: 0 });
      box(0.3, 0.03, 0.3, P.glowHi, x, 0.08, z, nc);
    }
  }

  /** A glowing line along a closed polygon's edges ([[x, z], ...]) at height y. */
  function edges(pts, y, w = 0.06, mat = P.glow, closed = true) {
    for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      beam([a[0], y, a[1]], [b[0], y, b[1]], w, w, mat, nc);
    }
  }

  /** Glowing vertical lines at a polygon's corners, from y0 to y1. */
  function posts(pts, y0, y1, w = 0.06, mat = P.glow) {
    for (const [x, z] of pts) box(w, y1 - y0, w, mat, x, y0, z, nc);
  }

  /** A glowing outline round the top of a w x d box centred at (x, z), at height y (inset a hair). */
  function outline(w, d, x, y, z, lw = 0.06, mat = P.glow) {
    const hx = w / 2 - lw / 2, hz = d / 2 - lw / 2;
    edges([[x - hx, z - hz], [x + hx, z - hz], [x + hx, z + hz], [x - hx, z + hz]], y, lw, mat);
  }

  return { ...P, P, pad, edges, posts, outline };
}
