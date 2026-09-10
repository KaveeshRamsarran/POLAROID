import * as THREE from "three";

// CC0 source maps are shipped locally, decoded once before world construction.
// Each material owns its texture transforms; the decoded pixels stay shared.
const ids = [
  "WoodFloor051",
  "Wood066",
  "Wallpaper001A",
  "Fabric030",
  "Asphalt033",
  "Plaster001",
];
const images = new Map(),
  sources = new Map();
export async function preloadPbr() {
  await Promise.all(
    ids.flatMap((id) =>
      ["Color", "NormalGL", "Roughness"].map(async (channel) => {
        const key = `${id}_${channel}`;
        const image = new Image();
        image.src = `/textures/pbr/${key}.jpg`;
        try {
          await image.decode();
          images.set(key, image);
          sources.set(key, new THREE.Source(image));
        } catch {
          console.warn(`Material fallback: ${key}`);
        }
      }),
    ),
  );
}
export function pbrSurface(id) {
  if (
    !["Color", "NormalGL", "Roughness"].every((channel) =>
      images.has(`${id}_${channel}`),
    )
  )
    return null;
  const maps = {};
  for (const [channel, slot] of [
    ["Color", "map"],
    ["NormalGL", "normalMap"],
    ["Roughness", "roughnessMap"],
  ]) {
    const texture = new THREE.Texture();
    // Separate repeats and offsets, shared Source: Three can reuse the GPU
    // allocation as well as decoded pixels across all uses of this material.
    texture.source = sources.get(`${id}_${channel}`);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    texture.colorSpace =
      channel === "Color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    maps[slot] = texture;
  }
  return maps;
}
export function applyPbr(
  material,
  id,
  { color = "#ffffff", normal = 0.35, roughness = 1, albedo = true } = {},
) {
  const maps = pbrSurface(id);
  if (!maps) return material;
  if (!albedo) {
    maps.map.dispose();
    delete maps.map;
  }
  Object.assign(material, maps);
  material.color.set(color);
  material.normalScale.setScalar(normal);
  material.roughness = roughness;
  // A colour map is pigment, not a height field.
  material.bumpMap = null;
  return material;
}
