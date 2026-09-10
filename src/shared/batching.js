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
      child.userData.keepMesh ||
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

export function batchStaticScene(scene, excluded = []) {
  const keep = new Set(excluded),
    batches = new Map();
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (
      !o.isMesh ||
      o.isInstancedMesh ||
      o.name ||
      Array.isArray(o.material) ||
      o.material.transparent ||
      !o.visible
    )
      return;
    for (let p = o; p; p = p.parent)
      if (keep.has(p) || p.userData.limbs || p.userData.keepMesh) return;
    const position = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    const key = [
      o.material.uuid,
      Math.floor(position.x / 8),
      Math.floor(position.z / 8),
      Math.floor(position.y / 4),
      Object.keys(o.geometry.attributes).sort().join(),
    ].join("/");
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(o);
  });
  for (const objects of batches.values()) {
    if (objects.length < 2) continue;
    const geometries = objects.map((o) =>
      (o.geometry.index
        ? o.geometry.toNonIndexed()
        : o.geometry.clone()
      ).applyMatrix4(o.matrixWorld),
    );
    const geometry = mergeGeometries(geometries);
    if (geometry) {
      const merged = new THREE.Mesh(geometry, objects[0].material);
      merged.castShadow = objects.some((o) => o.castShadow);
      merged.receiveShadow = true;
      scene.add(merged);
      objects.forEach((o) => o.removeFromParent());
    }
    geometries.forEach((g) => g.dispose());
  }
}
