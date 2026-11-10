// Working-loop layers: keep only the parts that move or change, in exactly their place on the building image.
//   moving: Set of meshes/groups to keep.
//   shadows: true -> every other surface (pad included) becomes a shadow catcher, so the moving parts' shadows land
//            on the building; static parts stop casting (their shadows are already in the base image).
//   otherwise every other surface is depth only (it hides what it should hide, draws nothing).
export function workLayer(L, moving, { shadows = false, shadowOpacity = 0.5 } = {}) {
  const { THREE } = L;
  const keep = new Set();
  for (const o of moving) o.traverse(c => keep.add(c));
  const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
  const catcher = new THREE.ShadowMaterial({ opacity: shadowOpacity });
  L.getRoot().traverse(o => {
    if (!o.isMesh || keep.has(o)) return;
    if (o.userData.decal) { o.visible = false; return; }
    if (shadows && o.visible) { o.material = catcher; o.castShadow = false; o.receiveShadow = true; }
    else { o.material = depthOnly; o.renderOrder = -10; }
  });
  if (!shadows) L.hidePad();
}
// hide the moving parts (for <building>-base)
export function hideParts(moving) { for (const o of moving) o.visible = false; }
// an emissive material at strength k*f whose bloom (glow pass colour) also scales with f
export function litMat(L, hex, k, f, fmax = 1.4) {
  const m = L.M.emit(hex, k * f).clone(), c = new L.THREE.Color(hex).multiplyScalar(Math.min(1, f / fmax));
  m.userData = { glow: '#' + c.getHexString() }; return m;
}
