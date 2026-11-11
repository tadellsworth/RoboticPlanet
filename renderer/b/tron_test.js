import { tron } from './tronkit.js';
export const config = { pad: false };
export default function (L) {
  const T = tron(L); T.pad();
  L.box(4, 2, 4, T.armor, 0, 0, 0, { dirt: 0.4 });
  L.box(3.4, 0.3, 3.4, T.roof, 0, 2, 0, { dirt: 0.2 });
  T.outline(4, 4, 0, 2.0, 0); T.outline(3.4, 3.4, 0, 2.3, 0, 0.05, T.glowHi);
  T.posts([[-1.97, -1.97], [1.97, -1.97], [1.97, 1.97], [-1.97, 1.97]], 0, 2);
  L.box(2.2, 0.5, 0.05, T.glass, 0, 0.8, 2.01, { dirt: 0, cast: false });
}
