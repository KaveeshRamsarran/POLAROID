import * as THREE from "three";
import { seededRandom } from "./logic.js";
import { pbrSurface } from "./shared/pbr.js";

// Every surface is authored to tile seamlessly at 3 world units, so a wall and a
// floor cut from the same map line up wherever they meet.
const SURFACES = {
  wall: { size: 1024, base: [137, 151, 130] },
  wood: { size: 1024, base: [105, 79, 51] },
  tile: { size: 1024, base: [118, 126, 113] },
  concrete: { size: 1024, base: [104, 110, 101] },
  metal: { size: 512, base: [108, 120, 111] },
  fabric: { size: 512, base: [111, 115, 96] },
  skin: { size: 512, base: [176, 171, 151] },
};
export const surfaceKinds = Object.keys(SURFACES);

// Tileable, multi-scale surfaces. Pigment, relief and roughness are independent:
// a stain changes the paint colour without turning into a raised lump of plaster.
export function createSurface(kind) {
  const authored = {
    wood: "WoodFloor051",
    wall: "Plaster001",
    fabric: "Fabric030",
    concrete: "Asphalt033",
  }[kind];
  const maps = authored && pbrSurface(authored);
  if (maps) return maps;
  const { size, base } = SURFACES[kind] || SURFACES.concrete;
  const random = seededRandom(1741 + kind.charCodeAt(0) * 97);
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
  // A stable value per cell index, for per-plank and per-tile colour variation.
  const variant = (i) => grids[4].data[(i * 2654435761) % grids[4].data.length];
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
  const PLANKS = 6,
    TILES = 8;
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
        // Mineral runs bleed downward from the middle of each course.
        const streak =
          Math.max(0, noise(x, 0, 1) - 0.52) *
          2.2 *
          (0.3 + 0.7 * (0.5 - 0.5 * Math.cos((y / size) * Math.PI * 2)));
        shade -= damp * 38 + streak * 24;
        const flake = Math.max(0, noise(x, y, 3) - 0.72) * 3;
        shade += flake * 12;
        h = 0.5 + fine * 0.018 + grain * 0.045 + flake * 0.035;
        r = 0.77 + damp * 0.18 + streak * 0.12 + fine * 0.08;
      } else if (kind === "wood") {
        // Six staggered boards, each with its own tint and grain phase.
        const boardHeight = size / PLANKS,
          board = Math.floor(y / boardHeight),
          inBoard = y - board * boardHeight;
        const stagger = (board % 2) * (size / 2),
          along = (x + stagger) % size;
        const tint = variant(board * 3 + 1) - 0.5;
        const phase = along / size + variant(board * 7 + 5) * 4;
        const grainLine =
          Math.sin(phase * Math.PI * 26 + noise(x, y, 2) * 7) * 0.6 +
          Math.sin(phase * Math.PI * 61 + noise(x, y, 3) * 4) * 0.4;
        const knot = Math.max(0, noise(x, y, 3) - 0.79) * 4.5;
        const edge = Math.min(inBoard, boardHeight - 1 - inBoard);
        const endJoint = Math.min(along % (size / 2), 3);
        const groove = Math.min(edge, endJoint);
        shade +=
          grainLine * 8 + tint * 22 - knot * 30 - (groove < 2.5 ? 32 : 0);
        h =
          0.5 +
          grain * 0.016 +
          grainLine * 0.01 -
          knot * 0.05 -
          (groove < 2.5 ? 0.16 : 0) +
          Math.min(1, groove / 7) * 0.014;
        r = 0.58 + cloud * 0.16 + knot * 0.12 + (groove < 2.5 ? 0.3 : 0);
      } else if (kind === "tile") {
        const cell = size / TILES,
          gx = Math.floor(x / cell),
          gy = Math.floor(y / cell);
        const ox = x - gx * cell,
          oy = y - gy * cell;
        const grout = Math.min(ox, cell - 1 - ox, oy, cell - 1 - oy);
        const tint = variant(gy * TILES + gx) - 0.5;
        if (grout < 3) {
          shade -= 36;
          h = 0.5 - 0.2 + grain * 0.02;
          r = 0.95;
        } else {
          // A short bevel rolls each tile edge into the grout line.
          const bevel = Math.min(1, (grout - 3) / 7);
          const crazing = Math.max(0, noise(x, y, 4) - 0.74) * 3;
          shade += tint * 15 - (1 - bevel) * 7 - crazing * 9;
          h = 0.5 + bevel * 0.07 + grain * 0.012;
          r = 0.4 + cloud * 0.18 + (1 - bevel) * 0.12 + crazing * 0.3;
        }
      } else if (kind === "concrete") {
        const pit = Math.max(0, noise(x, y, 3) - 0.66) * 3;
        const trowel =
          Math.sin(((x + y * 0.35) / size) * Math.PI * 6 + cloud * 6) * 0.5 +
          0.5;
        shade += trowel * 8 - pit * 26;
        h = 0.5 + grain * 0.03 + fine * 0.02 - pit * 0.11;
        r = 0.7 + cloud * 0.18 + pit * 0.12;
      } else if (kind === "metal") {
        const oxidised = Math.max(0, 0.43 - cloud) * 3;
        shade -= oxidised * 30;
        h += grain * 0.016;
        r = 0.37 + oxidised * 0.6;
      } else if (kind === "fabric") {
        const weave = (x % 4 < 2 ? 1 : -1) * (y % 4 < 2 ? 1 : -1);
        const slub = Math.max(0, noise(x, y, 4) - 0.7) * 2;
        shade += weave * 4 + slub * 7;
        h += weave * 0.04 + slub * 0.02;
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
  if (kind === "wall" || kind === "concrete")
    for (let i = 0; i < 24; i++) {
      let x = random() * size,
        y = random() * size;
      ctx.strokeStyle = i < 8 ? "rgba(44,53,41,.25)" : "rgba(64,79,52,.08)";
      ctx.lineWidth = i < 8 ? 0.65 : 2 + random() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 12; j++) {
        x += (random() - 0.5) * (i < 8 ? 7 : 1);
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
    t.anisotropy = 16;
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
