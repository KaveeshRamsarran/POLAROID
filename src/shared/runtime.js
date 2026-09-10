import * as THREE from "three";
export { SETTINGS_KEY, readSettings } from "./settings.js";
export function createRenderer(canvas, options = {}) {
  const r = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    ...options,
  });
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.setSize(innerWidth, innerHeight);
  return r;
}
export function movementIntent(keys, yaw, crouched = false, hidden = false) {
  let x = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0),
    z = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const length = Math.hypot(x, z);
  if (length) {
    x /= length;
    z /= length;
  }
  const sprint = !!(
    (keys.ShiftLeft || keys.ShiftRight) &&
    !crouched &&
    length &&
    !hidden
  );
  const speed = hidden ? 0 : crouched ? 1.1 : sprint ? 4.3 : 2.35;
  return {
    sprint,
    vx: (x * Math.cos(yaw) - z * Math.sin(yaw)) * speed,
    vz: (-x * Math.sin(yaw) - z * Math.cos(yaw)) * speed,
  };
}
export function photograph(canvas, size = 600) {
  const image = document.createElement("canvas");
  image.width = image.height = size;
  const crop = Math.min(canvas.width, canvas.height);
  image
    .getContext("2d")
    .drawImage(
      canvas,
      (canvas.width - crop) / 2,
      (canvas.height - crop) / 2,
      crop,
      crop,
      0,
      0,
      size,
      size,
    );
  return image.toDataURL("image/jpeg", 0.78);
}
export function releaseScene(scene) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  scene.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m) {
        materials.add(m);
        for (const v of Object.values(m)) if (v?.isTexture) textures.add(v);
      }
  });
  geometries.forEach((g) => g.dispose());
  textures.forEach((t) => t.dispose());
  materials.forEach((m) => m.dispose());
  scene.clear();
}
