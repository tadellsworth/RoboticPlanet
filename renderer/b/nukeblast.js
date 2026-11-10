// Nuclear detonation, one frame of an animation: ?f=k&n=N (frame k of N).
// White flash -> fireball with a ground shockwave ring -> rising fireball pulls up a stem and rolls into a mushroom
// cap, while a dust skirt (base surge) races out along the ground -> the cloud cools from orange to dusty grey.
// (The final fade-out is done on the frames afterwards.) Same camera elevation and sun as the buildings; no pad.
export const config = { pad: false };
export default function (L) {
  const { mesh, pointLight, M, THREE } = L;
  const p = new URLSearchParams(location.search), f = +(p.get('f') || 0), n = +(p.get('n') || 24);
  const t = Math.pow(f / (n - 1), 1.35);                 // spend more frames on the fast early phase
  L.frameCompoundOpts({ half: 7.5, width: 0.9, cy: 0.7 });
  const S = (a, b, x) => { const u = Math.min(1, Math.max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const col = h => new THREE.Color(h);

  // ---- lumpy puff shapes (a few variants, displaced icospheres)
  L.seed(777);
  const shapes = [];
  for (let v = 0; v < 6; v++) {
    const g = new THREE.SphereGeometry(1, 28, 18), pos = g.attributes.position, w = [];
    for (let k = 0; k < 4; k++) w.push([L.rnd() * 2 - 1, L.rnd() * 2 - 1, L.rnd() * 2 - 1, 2.5 + L.rnd() * 3, L.rnd() * 6]);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); let d = 0;
      for (const [a, b, c, fr, ph] of w) d += Math.sin((a * x + b * y + c * z) * fr + ph);
      const s = 1 + 0.07 * d; pos.setXYZ(i, x * s, y * s, z * s);
    }
    g.computeVertexNormals(); shapes.push(g);
  }
  // puff parameters drawn once, in a fixed order, so every frame uses the same cloud
  const R = () => L.rnd();
  const capP = Array.from({ length: 72 }, (_, i) => ({ th: i / 72 * Math.PI * 2 + (R() - 0.5) * 0.25, ph: R() * Math.PI * 2, s: 0.8 + R() * 0.45, v: Math.floor(R() * 6) }));
  const domeP = Array.from({ length: 26 }, () => ({ r: Math.sqrt(R()) * 0.85, a: R() * Math.PI * 2, s: 0.75 + R() * 0.35, v: Math.floor(R() * 6) }));
  const coreP = Array.from({ length: 9 }, () => ({ x: R() * 2 - 1, y: R() * 2 - 1, z: R() * 2 - 1, s: 0.55 + R() * 0.3, v: Math.floor(R() * 6) }));
  const stemP = Array.from({ length: 60 }, () => ({ u: R(), a: R() * Math.PI * 2, s: 0.8 + R() * 0.35, w: R(), v: Math.floor(R() * 6) }));
  const skirtP = Array.from({ length: 70 }, (_, i) => ({ th: i / 70 * Math.PI * 2 + (R() - 0.5) * 0.15, dr: (R() - 0.5) * 0.9, h: R(), s: 0.75 + R() * 0.5, v: Math.floor(R() * 6) }));

  // ---- timeline
  const heat = Math.pow(Math.max(0, 1 - t / 0.38), 2.0);                       // fireball heat, 1 -> 0 by t = 0.5
  const ember = 0.45 * S(0.05, 0.2, t) * (1 - S(0.5, 0.9, t));            // lingering inner glow in the cap
  const hc = 9.6 * Math.pow(S(0.0, 0.62, t), 0.85) + 0.8 * S(0.62, 1.0, t) + 0.8 * (1 - S(0, 0.05, t));
  const Rc = 0.3 + 1.05 * S(0.08, 0.75, t) + 0.2 * S(0.75, 1, t);              // cap ring radius
  const rt = 0.65 + 0.4 * S(0.04, 0.6, t) + 0.1 * S(0.6, 1, t);               // cap tube radius
  const rf = 0.9 + 0.8 * S(0, 0.08, t);                                        // early fireball radius
  const stemW = S(0.07, 0.3, t);                                               // stem grows in
  const Rs = 0.5 + 3.8 * easeOut((t - 0.02) / 0.65);                           // base surge radius
  const skirtK = S(0.02, 0.12, t) * (1 - 0.35 * S(0.6, 1, t));

  const smoke = (y, k) => col('#5c5046').lerp(col('#c4b8a6'), Math.min(1, Math.max(0, y / 10)) * 0.85 + k * 0.15);
  const hot = col('#ff5a12'), amber = col('#ffa632'), white = col('#fff3c8');
  function puff(v, x, y, z, r, base, h) {
    const m = new THREE.MeshStandardMaterial({ color: base, roughness: 1, metalness: 0 });
    m.envMapIntensity = 0.35;
    if (h > 0.02) {
      const e = h > 0.7 ? amber.clone().lerp(white, (h - 0.7) / 0.3) : hot.clone().lerp(amber, h / 0.7);
      m.emissive = e; m.emissiveIntensity = 0.25 + 2.4 * h;
      m.userData.glow = '#' + e.clone().multiplyScalar(Math.min(1, 0.25 + h)).getHexString();
    }
    const o = mesh(shapes[v].clone(), m, x, y, z, { dirt: 0 });
    o.scale.setScalar(r); o.rotation.set(v * 1.3, v * 2.1, v * 0.7);
    return o;
  }

  // ---- fireball core (early) and mushroom cap
  for (const c of coreP) {
    const k = 1 - S(0.15, 0.4, t);                                             // core puffs merge into the cap
    if (k <= 0.01) continue;
    puff(c.v, c.x * rf * 0.55, hc + c.y * rf * 0.45, c.z * rf * 0.55, rf * c.s * k, smoke(hc, 0.4), Math.min(1, heat * 1.15));
  }
  for (const c of capP) {
    const ph = c.ph - 2.2 * t;                                                 // the cap rolls over itself
    const rr = Rc + rt * Math.cos(ph) * 0.9, y = hc + rt * Math.sin(ph) * 0.62;
    const under = Math.max(0, -Math.sin(ph)) * 0.6 + Math.max(0, -Math.cos(ph)) * 0.4;
    const h = Math.min(1, heat * (0.55 + 0.6 * under) + ember * under);
    puff(c.v, Math.cos(c.th) * rr, y, Math.sin(c.th) * rr, (0.3 + 0.38 * rt) * c.s * S(0.0, 0.06, t + 0.02), smoke(y + 1.5, 0.5), h);
  }
  for (const c of domeP) {
    const rr = c.r * Rc, y = hc + rt * 0.55 + (1 - c.r) * rt * 0.35;
    puff(c.v, Math.cos(c.a) * rr, y, Math.sin(c.a) * rr, rt * 0.62 * c.s * S(0.02, 0.12, t), smoke(y + 2, 0.8), heat * 0.5);
  }
  // ---- stem
  if (stemW > 0.01) for (const c of stemP) {
    const top = Math.max(0.6, hc - rt * 0.7), y = 0.3 + c.u * top;
    const flare = 1 + 1.6 * Math.pow(1 - c.u, 4);                              // flares out where it meets the ground
    const rad = (0.36 + 0.22 * c.u) * flare * stemW;
    const wob = 0.18 * Math.sin(c.u * 9 + c.w * 6);
    puff(c.v, Math.cos(c.a) * rad + wob, y, Math.sin(c.a) * rad, (0.5 + 0.18 * c.u) * c.s * stemW * Math.sqrt(flare) * 0.85, smoke(2.5 + y * 0.55, 0.3),
      Math.min(1, heat * S(0.5, 1, c.u) * 0.8 + ember * 0.3 * S(0.7, 1, c.u)));
  }
  // ---- base surge: a ring of dust racing out along the ground
  if (skirtK > 0.01) for (const c of skirtP) {
    const rr = Rs + c.dr * (0.4 + 0.6 * S(0.05, 0.5, t)), y = 0.25 + c.h * 0.45 * (0.6 + 0.4 * S(0.1, 0.6, t));
    const o = puff(c.v, Math.cos(c.th) * rr, y * 0.7, Math.sin(c.th) * rr, (0.4 + 0.32 * S(0.05, 0.7, t)) * c.s * skirtK, col('#a8916f').lerp(col('#cdbb9b'), c.h * 0.6), heat * 0.2);
    o.scale.y *= 0.65;
  }
  // ---- ground shockwave ring and scorched ground disc
  if (t < 0.34) {
    const Rw = 0.6 + 5.0 * easeOut(t / 0.3), wdt = 0.16 + 0.35 * t;
    const g = new THREE.RingGeometry(Math.max(0.01, Rw - wdt), Rw, 96, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.MeshBasicMaterial({ color: '#fff1d0', transparent: true, opacity: 0.8 * (1 - S(0.03, 0.3, t)), depthWrite: false, side: THREE.DoubleSide });
    const o = new THREE.Mesh(g, m); o.position.y = 0.02; L.getRoot().add(o);
    const g2 = new THREE.RingGeometry(Math.max(0.01, Rw - wdt * 3.5), Math.max(0.02, Rw - wdt), 96, 1); g2.rotateX(-Math.PI / 2);
    const o2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: '#d9c7a4', transparent: true, opacity: 0.35 * (1 - S(0.05, 0.34, t)), depthWrite: false, side: THREE.DoubleSide }));
    o2.position.y = 0.015; L.getRoot().add(o2);
  }
  // ---- the flash
  const flash = Math.exp(-t / 0.02);
  if (flash > 0.05) {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: col('#fff8e6'), emissiveIntensity: 6 * flash });
    m.userData.glow = '#' + col('#fff4d6').multiplyScalar(Math.min(1, flash)).getHexString();
    const o = mesh(new THREE.SphereGeometry(1, 32, 16), m, 0, 0.8 + t * 12, 0, { dirt: 0, cast: false });
    o.scale.setScalar(1.6 + 30 * t);
  }
  // ---- light from the fireball onto the cloud
  if (heat > 0.02) pointLight('#ff8a3a', 60 * heat, 0, hc - rt * 0.4, 0.5, 14);
  if (ember > 0.02) pointLight('#ff7a2a', 18 * ember, 0, hc - rt * 0.8, 0, 6);
}
