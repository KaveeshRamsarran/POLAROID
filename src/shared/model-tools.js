import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
export function modelTools(scene, mats) {
  const boxGeo = new THREE.BoxGeometry(1, 1, 1),
    sphereGeo = new THREE.SphereGeometry(1, 18, 14),
    roundedCache = new Map();
  function mesh(geometry, mat, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, x, y, z, mat = mats.wood, parent = scene) {
    const m = mesh(boxGeo, mat, x, y, z, parent);
    m.scale.set(w, h, d);
    return m;
  }
  function round(w, h, d, x, y, z, mat = mats.wood, parent = scene, r = 0.05) {
    const key = [w, h, d, r].join();
    if (!roundedCache.has(key))
      roundedCache.set(key, new RoundedBoxGeometry(w, h, d, 2, r));
    return mesh(roundedCache.get(key), mat, x, y, z, parent);
  }
  function ball(w, h, d, x, y, z, mat = mats.skin, parent = scene) {
    const m = mesh(sphereGeo, mat, x, y, z, parent);
    m.scale.set(w, h, d);
    return m;
  }
  function cylinder(r, h, x, y, z, mat = mats.metal, parent = scene, r2 = r) {
    return mesh(new THREE.CylinderGeometry(r2, r, h, 16), mat, x, y, z, parent);
  }
  function link(a, b, r, mat, parent = scene) {
    const va = new THREE.Vector3(...a),
      vb = new THREE.Vector3(...b),
      m = cylinder(r, va.distanceTo(vb), 0, 0, 0, mat, parent);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      vb.sub(va).normalize(),
    );
    return m;
  }
  function textTexture(
    lines,
    { bg = "#273b2d", fg = "#b5c3a6", size = 40, w = 512, h = 256 } = {},
  ) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = fg;
    ctx.globalAlpha = 0.35;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size}px monospace`;
    lines
      .split("\n")
      .forEach((l, i, arr) =>
        ctx.fillText(
          l,
          w / 2,
          h / 2 + (i - (arr.length - 1) / 2) * (size * 1.6),
        ),
      );
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function sign(
    text,
    x,
    y,
    z,
    w = 0.8,
    h = 0.35,
    rot = 0,
    opts = {},
    parent = scene,
  ) {
    const mat = new THREE.MeshStandardMaterial({
      map: textTexture(text, opts),
      roughness: 0.9,
      side: THREE.DoubleSide,
    });
    const m = mesh(new THREE.PlaneGeometry(w, h), mat, x, y, z, parent);
    m.rotation.y = rot;
    return m;
  }
  return { mesh, box, round, ball, cylinder, link, sign, textTexture };
}
