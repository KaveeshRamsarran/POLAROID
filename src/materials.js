import * as THREE from "three";
import { seededRandom } from "./logic.js";

// Tileable, multi-scale surfaces. Pigment, relief and roughness are independent:
// a stain changes the paint colour without turning into a raised lump of plaster.
export function createSurface(kind) {
  const size = kind === "wall" || kind === "wood" ? 1024 : 512,
    random = seededRandom(1741 + kind.charCodeAt(0) * 97);
  const grids = [4, 8, 16, 32, 128].map((n) => ({
    n,
    data: Float32Array.from({ length: n * n }, random),
  }));
  function noise(x, y, level) {
    const { n, data } = grids[level];
    const px = (x / size) * n,
      py = (y / size) * n;
    const ix = Math.floor(px),
      iy = Math.floor(py);
    const tx = px - ix,
      ty = py - iy;
    const u = tx * tx * (3 - 2 * tx),
      v = ty * ty * (3 - 2 * ty);
    const at = (a, b) => data[((b + n) % n) * n + ((a + n) % n)];
    return (
      (at(ix, iy) * (1 - u) + at(ix + 1, iy) * u) * (1 - v) +
      (at(ix, iy + 1) * (1 - u) + at(ix + 1, iy + 1) * u) * v
    );
  }
  const base = {
    wall: [137, 151, 130],
    floor: [108, 115, 104],
    wood: [105, 79, 51],
    metal: [108, 120, 111],
    fabric: [111, 115, 96],
    skin: [176, 171, 151],
  }[kind];
  const height = new Float32Array(size * size);
  const canvas = () => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    return c;
  };
  const albedo = canvas(),
    roughness = canvas(),
    normal = canvas();
  const ctx = albedo.getContext("2d"),
    rc = roughness.getContext("2d"),
    nc = normal.getContext("2d");
  const pixels = ctx.createImageData(size, size),
    rough = rc.createImageData(size, size),
    normals = nc.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x,
        k = i * 4;
      const cloud =
        noise(x, y, 0) * 0.6 + noise(x, y, 1) * 0.25 + noise(x, y, 2) * 0.15;
      const fine = noise(x, y, 4) - 0.5,
        grain = random() - 0.5;
      let shade = (cloud - 0.5) * 32 + fine * 8 + grain * 5;
      let h = 0.5 + fine * 0.1 + grain * 0.035,
        r = 0.84;
      if (kind === "wall") {
        const damp = Math.max(0, 0.48 - cloud) * 2;
        shade -= damp * 42;
        const flake = Math.max(0, noise(x, y, 3) - 0.72) * 3;
        shade += flake * 12;
        h = 0.5 + fine * 0.018 + grain * 0.045 + flake * 0.035;
        r = 0.77 + damp * 0.2 + fine * 0.08;
      } else if (kind === "wood") {
        const wave =
          Math.sin((y / size) * Math.PI * 4) * 1.7 + noise(x, y, 3) * 12;
        const fibre = Math.sin((x / size) * Math.PI * 320 + wave);
        const seam =
          x % 128 < 2 || (y + (Math.floor(x / 128) % 2) * 256) % 512 < 2;
        shade += fibre * 3 + (noise(x, y, 2) - 0.5) * 21 - (seam ? 33 : 0);
        h = 0.5 + grain * 0.018 + fibre * 0.004 - (seam ? 0.15 : 0);
        r = 0.61 + cloud * 0.15 + fine * 0.08;
      } else if (kind === "floor") {
        const joint = x % 128 < 3 || y % 128 < 3;
        shade -= joint ? 37 : 0;
        h -= joint ? 0.2 : 0;
        r = joint ? 0.97 : 0.56 + cloud * 0.26;
      } else if (kind === "metal") {
        const oxidised = Math.max(0, 0.43 - cloud) * 3;
        shade -= oxidised * 30;
        h += grain * 0.016;
        r = 0.37 + oxidised * 0.6;
      } else if (kind === "fabric") {
        const weave = (x % 4 < 2 ? 1 : -1) * (y % 4 < 2 ? 1 : -1);
        shade += weave * 4;
        h += weave * 0.04;
        r = 0.96;
      } else if (kind === "skin") {
        shade = (cloud - 0.5) * 19 + grain * 2;
        h = 0.5 + grain * 0.025;
        r = 0.7 + cloud * 0.1;
      }
      height[i] = h;
      for (let a = 0; a < 3; a++) pixels.data[k + a] = base[a] + shade;
      pixels.data[k + 3] = 255;
      for (let a = 0; a < 3; a++) rough.data[k + a] = Math.min(1, r) * 255;
      rough.data[k + 3] = 255;
    }
  ctx.putImageData(pixels, 0, 0);
  // Fine cracks and mineral runs remain subtle at normal viewing distance.
  if (kind === "wall")
    for (let i = 0; i < 22; i++) {
      let x = random() * size,
        y = random() * size;
      ctx.strokeStyle = i < 7 ? "rgba(44,53,41,.25)" : "rgba(64,79,52,.08)";
      ctx.lineWidth = i < 7 ? 0.65 : 2 + random() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 12; j++) {
        x += (random() - 0.5) * (i < 7 ? 7 : 1);
        y += random() * 8;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const k = (y * size + x) * 4;
      const dx =
        (height[y * size + ((x + 1) % size)] -
          height[y * size + ((x + size - 1) % size)]) *
        1.9;
      const dy =
        (height[((y + 1) % size) * size + x] -
          height[((y + size - 1) % size) * size + x]) *
        1.9;
      const length = Math.hypot(dx, dy, 1);
      normals.data[k] = ((-dx / length) * 0.5 + 0.5) * 255;
      normals.data[k + 1] = ((dy / length) * 0.5 + 0.5) * 255;
      normals.data[k + 2] = ((1 / length) * 0.5 + 0.5) * 255;
      normals.data[k + 3] = 255;
    }
  rc.putImageData(rough, 0, 0);
  nc.putImageData(normals, 0, 0);
  const texture = (c, colour = false) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (colour) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  return {
    map: texture(albedo, true),
    roughnessMap: texture(roughness),
    normalMap: texture(normal),
  };
}

export function repeatMaterial(material, u, v) {
  const result = material.clone();
  for (const key of ["map", "normalMap", "roughnessMap"])
    if (material[key]) {
      result[key] = material[key].clone();
      result[key].repeat.set(u, v);
    }
  return result;
}
