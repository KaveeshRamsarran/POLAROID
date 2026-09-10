import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Merge meshes local to a rigid group. Child groups remain intact, so elbows,
// knees, head and hands retain their independent animation transforms.
export function batchRigidParts(root) {
  for (const child of [...root.children])
    if (child.isGroup) batchRigidParts(child);
  root.updateMatrix();
  const groups = new Map();
  for (const child of [...root.children]) {
    if (
      !child.isMesh ||
      Array.isArray(child.material) ||
      child.material.transparent ||
      !child.visible
    )
      continue;
    const signature =
      child.material.uuid +
      "/" +
      Object.keys(child.geometry.attributes).sort().join(",");
    if (!groups.has(signature)) groups.set(signature, []);
    groups.get(signature).push(child);
  }
  for (const children of groups.values()) {
    if (children.length < 2) continue;
    const geometries = children.map((o) => {
      o.updateMatrix();
      const g = o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone();
      return g.applyMatrix4(o.matrix);
    });
    const merged = mergeGeometries(geometries);
    if (merged) {
      const m = new THREE.Mesh(merged, children[0].material);
      m.castShadow = children.some((o) => o.castShadow);
      m.receiveShadow = true;
      root.add(m);
      children.forEach((o) => o.removeFromParent());
    }
    geometries.forEach((g) => g.dispose());
  }
}
