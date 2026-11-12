'use strict';
/*
 * Terrafall — small chart helpers for the statistics screen and building panels.
 *
 * Line charts are drawn on a canvas with one y-axis, 2px lines, an end dot and a direct label per
 * series, recessive hairline gridlines, and a crosshair + tooltip that follows a finger or mouse.
 * Bar charts are plain HTML (ranked horizontal bars, one colour, value at the tip).
 * Series colours are the players' colours stepped for the dark chart surface (validated for
 * colour-blind separation and contrast); all text uses the UI's text tokens, never a series colour.
 */

const CHART = {
  series: ['#1d9fcc', '#e0475c', '#3fb854', '#9452e0'],   // you, rival (red), green rival, purple rival
  surface: '#161820',
  grid: 'rgba(255,255,255,0.08)',
  axis: 'rgba(255,255,255,0.18)',
  text: '#eef1f5',
  muted: '#9ba4b4',
  font: '600 12px system-ui, -apple-system, "Segoe UI", sans-serif',
};

/** A clean axis maximum (1, 2, 4, 6 or 8 × a power of ten) at or above v, so its half is clean too. */
function niceMax(v) {
  if (!(v > 0)) return 2;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 4, 6, 8, 10]) if (m * p >= v && (m * p) / 2 >= 1) return m * p;
  return 10 * p;
}

function fmtMin(sec) { return Math.round(sec / 60) + 'm'; }

/**
 * Draw a line chart into `canvas` (sized to its CSS box).
 *   opts.xs      sample times in seconds
 *   opts.series  [{ name, color, values }] — values may contain null gaps
 *   opts.unit    suffix for values ('%', '')
 *   opts.max     fixed y maximum (otherwise a nice maximum of the data)
 */
function lineChart(canvas, opts) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 300, h = canvas.clientHeight || 170;
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  const xs = opts.xs || [], series = opts.series.filter((s) => s.values && s.values.length);
  const unit = opts.unit || '';
  let top = 0;
  for (const s of series) for (const v of s.values) if (v != null && v > top) top = v;
  const yMax = opts.max || niceMax(top);
  const L = 34, Rm = 62, T = 10, B = 22;
  const pw = Math.max(10, w - L - Rm), ph = Math.max(10, h - T - B);
  const x0 = xs[0] || 0, x1 = xs[xs.length - 1] || 1;
  const X = (t) => L + (x1 > x0 ? ((t - x0) / (x1 - x0)) * pw : pw);
  const Y = (v) => T + ph - (v / yMax) * ph;
  const fmt = (v) => (v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString() + unit);

  const draw = (hover) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = CHART.font;
    // Gridlines and y ticks
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const v = (yMax / 4) * k, y = Math.round(Y(v)) + 0.5;
      ctx.strokeStyle = k === 0 ? CHART.axis : CHART.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(L + pw, y); ctx.stroke();
      if (k % 2 === 0) { ctx.fillStyle = CHART.muted; ctx.fillText((Math.round(v * 10) / 10).toLocaleString() + unit, L - 6, y); }
    }
    // x ticks: start, middle, end
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = CHART.muted;
    if (xs.length) for (const t of [x0, (x0 + x1) / 2, x1]) ctx.fillText(fmtMin(t), Math.min(L + pw - 8, Math.max(L + 8, X(t))), T + ph + 6);
    if (!xs.length) { ctx.fillText('Not enough game time yet', L + pw / 2, T + ph / 2); return; }
    // Lines
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let pen = false;
      s.values.forEach((v, k) => {
        if (v == null || xs[k] == null) { pen = false; return; }
        if (pen) ctx.lineTo(X(xs[k]), Y(v)); else { ctx.moveTo(X(xs[k]), Y(v)); pen = true; }
      });
      ctx.stroke();
    }
    // End dots and direct labels (spread apart so they never overlap)
    const ends = [];
    for (const s of series) {
      let k = s.values.length - 1;
      while (k >= 0 && s.values[k] == null) k--;
      if (k < 0) continue;
      ends.push({ s, k, x: X(xs[k]), y: Y(s.values[k]), ly: Y(s.values[k]) });
    }
    ends.sort((a, b) => a.ly - b.ly);
    for (let k = 1; k < ends.length; k++) if (ends[k].ly - ends[k - 1].ly < 14) ends[k].ly = ends[k - 1].ly + 14;
    for (const e of ends) {
      dot(ctx, e.x, e.y, e.s.color);
      ctx.fillStyle = CHART.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(e.s.values[e.k]), e.x + 8, Math.min(T + ph, Math.max(T + 4, e.ly)));
    }
    // Crosshair and tooltip
    if (hover != null) {
      const hx = X(xs[hover]);
      ctx.strokeStyle = CHART.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(Math.round(hx) + 0.5, T); ctx.lineTo(Math.round(hx) + 0.5, T + ph); ctx.stroke();
      const rows = series.map((s) => ({ s, v: s.values[hover] }));
      for (const r of rows) if (r.v != null) dot(ctx, hx, Y(r.v), r.s.color);
      const lines = [`${fmtMin(xs[hover])} in`].concat(rows.map((r) => `${r.s.name}  ${fmt(r.v)}`));
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 30, th = lines.length * 17 + 10;
      let bx = hx + 10;
      if (bx + tw > w - 4) bx = hx - tw - 10;
      const by = T + 2;
      ctx.fillStyle = 'rgba(12,13,18,0.94)'; ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      roundRectPath(ctx, bx, by, tw, th, 8); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      lines.forEach((l, k) => {
        const ly = by + 13 + k * 17;
        if (k > 0) { ctx.fillStyle = rows[k - 1].s.color; ctx.fillRect(bx + 10, ly - 4, 10, 8); }
        ctx.fillStyle = k === 0 ? CHART.muted : CHART.text;
        ctx.fillText(l, bx + (k > 0 ? 26 : 10), ly);
      });
    }
  };
  const pick = (e) => {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0, bd = Infinity;
    xs.forEach((t, k) => { const d = Math.abs(X(t) - px); if (d < bd) { bd = d; best = k; } });
    draw(xs.length ? best : null);
  };
  canvas.onpointerdown = (e) => { canvas.setPointerCapture(e.pointerId); pick(e); };
  canvas.onpointermove = (e) => { if (e.pointerType === 'mouse' || e.buttons) pick(e); };
  canvas.onpointerleave = () => draw(null);
  draw(null);
}

function dot(ctx, x, y, color) {
  ctx.fillStyle = CHART.surface;
  ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Legend for two or more series (identity never rests on colour alone). */
function chartLegend(series) {
  if (series.length < 2) return '';
  return `<div class="chart-legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${s.name}</span>`).join('')}</div>`;
}

/**
 * Ranked horizontal bars (HTML). rows: [{ key, label, note, value (0..100) }]. The selected row is
 * marked; tapping a row calls onPick(key).
 */
function barChartHTML(rows, selected) {
  if (!rows.length) return '<p class="desc">Nothing to show yet.</p>';
  return `<div class="hbars">${rows.map((r) => `<button class="hbar${r.key === selected ? ' on' : ''}" data-k="${r.key}">
    <span class="hb-label">${r.label}${r.note ? ` <small>${r.note}</small>` : ''}</span>
    <span class="hb-track"><i style="width:${Math.max(1, r.value)}%;background:${CHART.series[0]}"></i><b style="left:${Math.min(r.value, 82)}%">${r.value}%</b></span>
  </button>`).join('')}</div>`;
}

/** A tiny trend line (inline SVG) of 0..100 values, for a building's busy time. */
function sparkline(values) {
  if (!values || values.length < 2) return '';
  const w = 100, h = 24, n = values.length;
  const pts = values.map((v, k) => `${((k / (n - 1)) * w).toFixed(1)},${(h - 2 - (v / 100) * (h - 4)).toFixed(1)}`).join(' ');
  const mins = Math.round((n * HIST_STEP) / 60);
  return `<div class="spark"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}" stroke="rgba(255,255,255,0.18)" stroke-width="1" vector-effect="non-scaling-stroke"/>
    <polyline points="${pts}" fill="none" stroke="${CHART.series[0]}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  </svg><span>Busy time, last ${mins} min</span></div>`;
}
