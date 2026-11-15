// Bulwark, "Lancer" family: a heavy shield robot. Broad tracks under armoured skirts with team light strips, a blunt
// octagonal hull, and across the front a thick crescent shield-bow carrying three shield emitters (team colour) that
// throw the shield dome. Mid-deck, a raised generator housing with a violet Crystal core glowing through a ring of
// slots (Crystal powers the shield); on top, a small turret with twin short blasters. Radiator fins on the rear deck.
// Faces +x (east), top-down. Marks: core, emitters.
import { kit } from './robkit.js';
export const config = { pad: false, size: 512 };
export default function (L) {
  const { M, TEAM } = L;
  L.seed(1213);
  const R = kit(L, 4, 0), { rect, rr, poly, ext, disc, strip, track, brake, grime, eye } = R, k = R.k;
  const armor = M.paint('#3a4046'), top = M.paint('#4f565e'), roof = M.paint('#5e666f', { rivets: false });
  const dark = M.plain('#1a1c1f', 0.7, 0.3), black = M.plain('#08090a', 0.8), glow = M.emit(TEAM, 1.1);
  const steel = M.plain('#626970', 0.3, 0.85), seam = M.plain('#101214', 0.8), bow = M.paint('#454c54');
  const crystal = M.emit('#9a6cf0', 1.0);
  // wide tracks, mostly under the skirts
  for (const y of [-64, 64]) track(-86, 78, y, 34, 0.44, { pitch: 0.31 });
  for (const s of [-1, 1]) {
    ext(poly(s < 0 ? [[80, -54], [70, -78], [-84, -78], [-96, -70], [-96, -54]] : [[80, 54], [70, 78], [-84, 78], [-96, 70], [-96, 54]]), 0.55, 0.52, armor, { bevel: 0.06 });
    strip(-84, s * 66, 60, s * 66, 3, 1.08, 0.02, glow);
    for (const x of [-40, 14]) strip(x, s * 56, x, s * 76, 1.5, 1.08, 0.01, seam);
  }
  // the blunt hull
  ext(poly([[70, -46], [52, -56], [-86, -56], [-100, -42], [-100, 42], [-86, 56], [52, 56], [70, 46]]), 0.36, 0.78, armor, { bevel: 0.09 });
  ext(rr(-92, -46, 150, 92, 10), 1.14, 0.06, top, { bevel: 0.02 });
  grime(-96, -54, 166, 108, 1.21, 0.9, 77);
  // the shield-bow: a thick crescent across the front, three emitters along it
  const arc = (r, a0, a1, n) => { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([10 + Math.cos(a) * r, Math.sin(a) * r]); } return pts; };
  const A = 1.02;
  ext(poly([...arc(110, -A, A, 24), ...arc(90, A, -A, 24)]), 0.42, 0.98, bow, { bevel: 0.07 });
  ext(poly([...arc(108, -A + 0.04, A - 0.04, 24), ...arc(100, A - 0.04, -A + 0.04, 24)]), 1.4, 0.05, steel, { bevel: 0.015 });
  for (const a of [-0.62, 0, 0.62]) {
    const x = 10 + Math.cos(a) * 99, y = Math.sin(a) * 99;
    disc(x, y, 11, 1.38, 0.12, dark);
    disc(x, y, 7, 1.5, 0.06, eye(TEAM, 2.2, 0.55), { cast: false });
    L.mark && L.mark('emitter', x * k, 1.56, y * k);
  }
  // hazard chevrons on the bow's ends
  for (const s of [-1, 1]) { const a = s * 0.9; rect(10 + Math.cos(a) * 96 - 4, Math.sin(a) * 96 - 4, 8, 8, 1.4, 0.03, R.hazard('#f0a030'), { dirt: 0.2 }); }
  // generator housing: an octagonal block, a ring of slots showing the violet Crystal core, a cap
  const oct = (cx, cy, r) => poly(Array.from({ length: 8 }, (_, i) => { const a = (i + 0.5) * Math.PI / 4; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }));
  ext(oct(-24, 0, 38), 1.2, 0.34, top, { bevel: 0.05 });
  disc(-24, 0, 26, 1.54, 0.06, crystal, { cast: false });
  L.mark && L.mark('core', -24 * k, 1.62, 0);
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; strip(-24 + Math.cos(a) * 18, Math.sin(a) * 18, -24 + Math.cos(a) * 30, Math.sin(a) * 30, 4, 1.6, 0.05, roof); }
  ext(oct(-24, 0, 15), 1.6, 0.12, roof, { bevel: 0.03 });
  disc(-24, 0, 6, 1.72, 0.03, eye('#b48cff', 1.4, 0.4), { cast: false });
  // the turret: a small round head ahead of the core, twin short blasters
  disc(36, 0, 20, 1.2, 0.36, top, { seg: 40 });
  ext(rr(22, -14, 30, 28, 6), 1.56, 0.08, roof, { bevel: 0.02 });
  for (const s of [-1, 1]) {
    L.box(40 * k, 0.12, 6 * k, steel, (52 + 20) * k, 1.5, s * 8 * k, R.O({ dirt: 0 }));
    L.box(6 * k, 0.16, 8 * k, dark, 92 * k, 1.5, s * 8 * k, R.O({ dirt: 0 }));
    L.box(3 * k, 0.1, 5 * k, eye(TEAM, 1.6, 0.4), 96 * k, 1.52, s * 8 * k, R.O({ dirt: 0, cast: false }));
  }
  // rear deck: radiator fins, rear lights, brake lenses
  for (let y = -40; y <= 40; y += 8) rect(-94, y - 2, 22, 4, 1.18, 0.05, black, { dirt: 0, cast: false });
  for (const y of [-50, 42]) rect(-103, y, 4, 8, 0.5, 0.3, glow, { dirt: 0, cast: false });
  brake(-103, -34, 5, 7, 0.72); brake(-103, 27, 5, 7, 0.72);
  R.finish();
}
