// The Murmur's tunnel ridges, drawn procedurally in Canvas 2D, the way the game would draw them (a reference for
// js/render.js, not game code). LORE.md, Art brief: moles leave raised ridges where they tunnel, so the Bloom follows
// those ridges: heaved lines of earth branching toward power, violet root-veins breaking through along them; at night
// pulses of light run along the veins back to the nest, a dark mirror of the road network.
//
//   drawRidges(ctx, ridges, o)
//     ridges: [{ pts: [[x, y], ...] (tile coordinates, from the nest end outward), w: 1 (thickness), age: 0..1
//              (how fresh: 1 just dug tonight, 0 old and settled) }]
//     o: { tile (px per tile), ground: [r, g, b] (the biome ground's average colour, as the minimap takes it),
//          layer: 'base' | 'glow', t (seconds, moves the pulses), seed, veins: 0..1 (how much of the vein shows) }
//   'base' is the heaved earth, the crack and the dark veins: bake it with the ground (it is graded for the time of
//   day with the ground). 'glow' is the veins' own light and the pulses: add it at night ('lighter'), like the
//   biomes' glow maps; the pulses move, so draw that layer live (it is cheap: a few strokes and dots per ridge).
//
// Each ridge is a smooth curve through its points (Catmull-Rom). The earth is the ground's own colour, heaved: lit
// on the side toward the light (top-left), shaded on the far side, with clods along both flanks and a crack down the
// middle where the root-veins break through. It tapers to nothing at the far end (where the digging is) and joins the
// network smoothly at the other.
(function (root) {
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function spline(pts, step) {
    // Catmull-Rom through the points, resampled about every `step` tiles
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1].slice());
    // the arc length along it, and the normal at each point
    let L = 0; out[0].s = 0;
    for (let i = 1; i < out.length; i++) { L += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); out[i].s = L; }
    for (let i = 0; i < out.length; i++) { const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; out[i].nx = -dy / l; out[i].ny = dx / l; }
    out.L = L; return out;
  }
  const rgb = (c, k = 1, a = 1) => `rgba(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))},${a})`;
  const mixc = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

  // a stroke of varying width along the curve: w(s) in tiles
  function band(ctx, c, T, wf, col, dx = 0, dy = 0) {
    ctx.fillStyle = col;
    for (let i = 0; i < c.length - 1; i++) {
      const w0 = wf(c[i].s, c), w1 = wf(c[i + 1].s, c);
      if (w0 <= 0.002 && w1 <= 0.002) continue;
      ctx.beginPath();
      ctx.moveTo((c[i][0] + c[i].nx * w0 + dx) * T, (c[i][1] + c[i].ny * w0 + dy) * T);
      ctx.lineTo((c[i + 1][0] + c[i + 1].nx * w1 + dx) * T, (c[i + 1][1] + c[i + 1].ny * w1 + dy) * T);
      ctx.lineTo((c[i + 1][0] - c[i + 1].nx * w1 + dx) * T, (c[i + 1][1] - c[i + 1].ny * w1 + dy) * T);
      ctx.lineTo((c[i][0] - c[i].nx * w0 + dx) * T, (c[i][1] - c[i].ny * w0 + dy) * T);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc((c[i][0] + dx) * T, (c[i][1] + dy) * T, w0 * T, 0, Math.PI * 2); ctx.fill();
    }
  }
  function line(ctx, c, T, s0, s1, off, wpx) {
    ctx.lineWidth = wpx; ctx.beginPath(); let on = false;
    for (let i = 0; i < c.length; i++) {
      if (c[i].s < s0 || c[i].s > s1) continue;
      const o = off(c[i].s), x = (c[i][0] + c[i].nx * o) * T, y = (c[i][1] + c[i].ny * o) * T;
      if (!on) { ctx.moveTo(x, y); on = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // draw with fn on a scratch canvas, then lay it on ctx once through a blur (a filter on every small fill is slow)
  function blurred(ctx, px, alpha, fn) {
    const c = document.createElement('canvas'); c.width = ctx.canvas.width; c.height = ctx.canvas.height;
    const g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round'; fn(g);
    ctx.save(); ctx.filter = `blur(${px}px)`; ctx.globalAlpha = alpha; ctx.drawImage(c, 0, 0); ctx.restore();
  }

  function drawRidges(ctx, ridges, o) {
    const T = o.tile, G = o.ground || [120, 90, 70], layer = o.layer || 'base', R = rng(o.seed || 7), t = o.t || 0, VK = o.veins ?? 1;
    // the heaved earth: the ground's colour, a little darker and warmer (fresh soil from below), lit and shaded
    const soil = mixc(G, [86, 64, 50], 0.2), lit = mixc(G, [255, 246, 230], 0.2), shade = mixc(G, [20, 14, 20], 0.5);
    const curves = ridges.map(r => ({ r, c: spline(r.pts, 0.12) }));
    const W = (r) => (s, c) => { const L = c.L, end = Math.min(1, (L - s) / 0.9), start = Math.min(1, s / 0.25 + 0.6); return 0.15 * (r.w || 1) * Math.max(0, end) ** 0.6 * start * (0.9 + 0.1 * Math.sin(s * 9)); };
    if (layer === 'base') {
      // 1 the shadow the ridge casts down-right, soft
      blurred(ctx, Math.max(0.8, T * 0.05), 0.32, (g) => { for (const { r, c } of curves) band(g, c, T, (s, cc) => W(r)(s, cc) * 1.05, rgb(shade, 0.7), 0.05, 0.06); });
      // 2 the body (soft-edged, no outline: it is the ground itself, heaved), its shaded flank and its lit flank
      blurred(ctx, Math.max(0.4, T * 0.012), 1, (g) => {
        for (const { r, c } of curves) band(g, c, T, (s, cc) => W(r)(s, cc) * 0.95, rgb(mixc(soil, shade, 0.35)), 0.012, 0.015);
        for (const { r, c } of curves) band(g, c, T, (s, cc) => W(r)(s, cc) * 0.82, rgb(soil), -0.012, -0.014);
        g.globalAlpha = 0.4;
        for (const { r, c } of curves) band(g, c, T, (s, cc) => W(r)(s, cc) * 0.42, rgb(lit), -0.04, -0.045);
      });
      // 3 clods along both flanks: broken lumps of the heaved crust, lit top-left
      for (const { r, c } of curves) {
        for (let i = 0; i < c.length; i += 1) {
          const w = W(r)(c[i].s, c); if (w < 0.03) continue;
          for (const sd of [-1, 1]) {
            if (R() < 0.6) continue;
            const off = sd * w * (0.55 + 0.4 * R()), x = (c[i][0] + c[i].nx * off) * T, y = (c[i][1] + c[i].ny * off) * T, rr = Math.max(0.6, (0.018 + 0.03 * R()) * T * (r.w || 1));
            ctx.fillStyle = rgb(shade, 0.9, 0.55); ctx.beginPath(); ctx.ellipse(x + rr * 0.35, y + rr * 0.4, rr, rr * 0.8, R() * 3, 0, 7); ctx.fill();
            ctx.fillStyle = rgb(mixc(soil, lit, R() * 0.6)); ctx.beginPath(); ctx.ellipse(x, y, rr * 0.85, rr * 0.7, R() * 3, 0, 7); ctx.fill();
          }
        }
      }
      // 4 the crack down the crest, and in it the root-veins, dark by day: broken through in stretches
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const { r, c } of curves) {
        const jit = (s) => 0.02 * Math.sin(s * 13 + (r.w || 1) * 3) + 0.012 * Math.sin(s * 31);
        ctx.strokeStyle = rgb(shade, 0.6, 0.75); line(ctx, c, T, 0.05, c.L - 0.25, jit, Math.max(0.7, T * 0.024 * (r.w || 1)));
        ctx.strokeStyle = 'rgba(96,52,130,0.75)';
        for (let s = 0.1; s < c.L - 0.3; s += 0.35 + R() * 0.5) { const l = (0.2 + R() * 0.6) * VK; line(ctx, c, T, s, s + l, jit, Math.max(0.7, T * 0.022 * (r.w || 1))); }
      }
    } else {
      // the glow: the veins' light along the crack (brighter where the ridge is fresh) and pulses running home
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const { r, c } of curves) {
        const jit = (s) => 0.02 * Math.sin(s * 13 + (r.w || 1) * 3) + 0.012 * Math.sin(s * 31), k = 0.45 + 0.55 * (r.age ?? 0.5);
        blurred(ctx, Math.max(1, T * 0.07), 1, (g) => { g.strokeStyle = `rgba(150,70,255,${0.38 * k})`; line(g, c, T, 0.05, c.L - 0.25, jit, Math.max(2, T * 0.1 * (r.w || 1))); });
        ctx.strokeStyle = `rgba(170,96,255,${0.85 * k})`; line(ctx, c, T, 0.05, c.L - 0.25, jit, Math.max(0.8, T * 0.025 * (r.w || 1)));
        // pulses: short bright dashes travelling from the far end back to the nest (s decreasing), one every ~2.5 tiles
        const sp = 1.6, gap = 2.5;
        for (let s0 = ((c.L - (t * sp) % gap) % gap); s0 < c.L - 0.3; s0 += gap) {
          blurred(ctx, Math.max(1, T * 0.05), 1, (g) => { g.strokeStyle = 'rgba(200,150,255,0.9)'; line(g, c, T, s0, s0 + 0.35, jit, Math.max(2, T * 0.09)); });
          ctx.strokeStyle = 'rgba(236,220,255,1)'; line(ctx, c, T, s0 + 0.05, s0 + 0.28, jit, Math.max(1, T * 0.035));
        }
      }
    }
  }
  root.drawRidges = drawRidges;
})(typeof window !== 'undefined' ? window : globalThis);
