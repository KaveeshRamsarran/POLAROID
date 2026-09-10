import * as THREE from "three";
import { repeatMaterial } from "../materials.js";

export function dressMotel({
  scene,
  mats,
  box,
  round,
  ball,
  cylinder,
  mesh,
  link,
  sign,
  solid,
  light,
  chair,
}) {
  function pot(x, y, z, scale = 1) {
    cylinder(
      0.19 * scale,
      0.38 * scale,
      x,
      y + 0.19 * scale,
      z,
      mats.rust,
      scene,
      0.24 * scale,
    );
    cylinder(0.22 * scale, 0.025, x, y + 0.39 * scale, z, mats.dark);
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4;
      link(
        [x, y + 0.38 * scale, z],
        [
          x + Math.cos(a) * 0.3 * scale,
          y + (0.55 + (i % 3) * 0.13) * scale,
          z + Math.sin(a) * 0.3 * scale,
        ],
        0.018 * scale,
        mats.fabric,
      );
      const leaf = ball(
        0.075 * scale,
        0.19 * scale,
        0.025 * scale,
        x + Math.cos(a) * 0.25 * scale,
        y + 0.66 * scale,
        z + Math.sin(a) * 0.25 * scale,
        mats.fabric,
      );
      leaf.rotation.set(0.6, a, 0.7);
    }
  }
  function lamp(x, y, z) {
    cylinder(0.16, 0.035, x, y, z, mats.brass);
    cylinder(0.028, 0.35, x, y + 0.18, z, mats.brass);
    const shade = mesh(
      new THREE.CylinderGeometry(0.12, 0.24, 0.32, 16, 1, true),
      mats.ivory,
      x,
      y + 0.5,
      z,
    );
    shade.material = mats.ivory.clone();
    shade.material.side = THREE.DoubleSide;
    const glow = new THREE.MeshStandardMaterial({
      color: "#ead7a7",
      emissive: "#edcc83",
      emissiveIntensity: 0.8,
    });
    ball(0.065, 0.08, 0.065, x, y + 0.42, z, glow);
    light(x, y + 0.46, z + 0.12, 5);
  }
  function desk(x, z, y = 3.1) {
    solid(1.85, 0.72, 0.66, x, y + 0.36, z, mats.joinery);
    round(1.96, 0.08, 0.73, x, y + 0.77, z, mats.wood, scene, 0.018);
    for (const side of [-1, 1]) {
      round(
        0.69,
        0.18,
        0.035,
        x + side * 0.47,
        y + 0.58,
        z - 0.35,
        mats.joinery,
        scene,
        0.008,
      );
      link(
        [x + side * 0.47 - 0.1, y + 0.58, z - 0.38],
        [x + side * 0.47 + 0.1, y + 0.58, z - 0.38],
        0.012,
        mats.brass,
      );
    }
  }
  // Room 7 has an obvious, reachable writing desk and a dedicated reading light.
  desk(11.5, -10.05);
  lamp(12.12, 3.94, -9.99);
  chair(13.1, -11.15, -0.5, 3.1);
  const blotter = box(0.9, 0.012, 0.5, 11.48, 3.918, -10.08, mats.dark);
  // Separate guest-room furniture and domestic clutter, outside the door paths.
  for (const [x, z] of [
    [3, -11.55],
    [-4.6, -10.05],
  ]) {
    solid(0.62, 1.05, 0.46, x, 3.625, z, mats.joinery);
    for (let j = 0; j < 3; j++) {
      box(0.57, 0.26, 0.022, x, 3.37 + j * 0.3, z + 0.25, mats.wood);
      ball(0.025, 0.02, 0.026, x, 3.37 + j * 0.3, z + 0.28, mats.brass);
    }
    round(0.57, 0.47, 0.43, x, 4.4, z, mats.joinery, scene, 0.06);
    round(
      0.43,
      0.32,
      0.03,
      x - 0.025,
      4.42,
      z + 0.23,
      mats.glass,
      scene,
      0.045,
    );
    for (const dy of [-0.08, 0.08])
      cylinder(
        0.023,
        0.025,
        x + 0.23,
        4.42 + dy,
        z + 0.23,
        mats.brass,
      ).rotation.x = Math.PI / 2;
    link([x, 4.68, z], [x - 0.16, 5.1, z], 0.008, mats.metal);
    link([x, 4.68, z], [x + 0.2, 5.04, z], 0.008, mats.metal);
  }
  // Coat racks, hangers, suitcases and wastebaskets complete the arrival spaces.
  for (const [x, z] of [
    [7.8, -10.25],
    [-5.8, -11.5],
    [13.8, -12.2],
  ]) {
    box(0.07, 0.13, 1.3, x, 5.15, z, mats.joinery);
    for (let i = 0; i < 4; i++) {
      link(
        [x - 0.06, 5.14, z - 0.45 + i * 0.3],
        [x - 0.16, 5.04, z - 0.45 + i * 0.3],
        0.012,
        mats.brass,
      );
    }
    const coat = round(
      0.13,
      0.82,
      0.43,
      x - 0.13,
      4.6,
      z,
      mats.fabric,
      scene,
      0.06,
    );
    for (const dz of [-0.26, 0.26])
      round(0.1, 0.58, 0.12, x - 0.16, 4.68, z + dz, mats.fabric, scene, 0.04);
  }
  for (const [x, z] of [
    [7.2, -14.35],
    [-1.35, -14.5],
    [13.25, -14.3],
  ]) {
    cylinder(0.13, 0.3, x, 3.25, z, mats.metal, scene, 0.17);
    cylinder(0.155, 0.01, x, 3.405, z, mats.dark);
    for (const dz of [0, 0.15])
      round(0.09, 0.07, 0.23, x - 0.35, 3.145, z + dz, mats.dark, scene, 0.035);
  }
  box(0.68, 0.06, 0.5, 7.55, 4.38, -14.3, mats.joinery);
  round(0.6, 0.12, 0.43, 7.55, 4.46, -14.3, mats.paper, scene, 0.025);
  round(0.58, 0.1, 0.4, 7.55, 4.57, -14.3, mats.ivory, scene, 0.025);
  for (const z of [-14.48, -14.12])
    link([7.83, 4.35, z], [7.83, 4.12, z], 0.02, mats.brass);
  // Basin accessories and a curtained shower recess in the shared bathroom.
  solid(1.05, 0.44, 0.62, 0.7, 3.32, -13.35, mats.ivory);
  box(0.87, 0.04, 0.45, 0.7, 3.56, -13.35, mats.glass);
  link([0.15, 5.6, -13.45], [1.3, 5.6, -13.45], 0.017, mats.metal);
  for (let i = 0; i < 6; i++) {
    const curtain = cylinder(
      0.048,
      1.9,
      0.24 + i * 0.1,
      4.59,
      -13.43,
      mats.ivory,
    );
    curtain.scale.z = 0.4;
  }
  cylinder(0.035, 0.11, 0.1, 3.99, -14.35, mats.glass);
  // Reception details tell guests how the place worked before the storm.
  box(1.5, 0.012, 1.05, -7.35, 0.012, 10, repeatMaterial(mats.carpet, 1, 1));
  pot(-7, 0, 6, 1.2);
  pot(-13.1, 0, 13.45, 0.8);
  const clock = cylinder(0.23, 0.05, -10, 2.35, 13.86, mats.brass);
  clock.rotation.x = Math.PI / 2;
  sign("12\n9     3\n6", -10, 2.35, 13.81, 0.4, 0.4, Math.PI, {
    bg: "#c1b898",
    fg: "#433d30",
    size: 45,
  });
  link([-10, 2.35, 13.79], [-10.14, 2.46, 13.79], 0.008, mats.dark);
  link([-10, 2.35, 13.78], [-9.99, 2.51, 13.78], 0.006, mats.dark);
  sign(
    "BRIAR GLEN\nRIVER ROAD\nBRIDGE CLOSED · DETOUR EAST",
    -8.65,
    2.05,
    13.85,
    1.4,
    0.7,
    Math.PI,
    { bg: "#a89e81", fg: "#3a443a", size: 32 },
  );
  for (let i = 0; i < 6; i++) {
    box(0.03, 0.035, 0.28, -13.69, 1.52, 7 + i * 0.8, mats.dark);
    ball(0.01, 0.035, 0.055, -13.66, 1.53, 7 + i * 0.8, mats.brass);
  }
  for (let i = 0; i < 5; i++) {
    const leaflet = box(
      0.27,
      0.012,
      0.36,
      -10.1,
      1.039 + i * 0.014,
      8.05,
      mats.paper,
    );
    leaflet.rotation.y = i * 0.06;
  }
  sign("LOCAL CALLS 25¢\nCHECK OUT 10 AM", -9.05, 1.04, 8, 0.42, 0.23, 0, {
    bg: "#b1a78c",
    fg: "#383b30",
    size: 33,
  }).rotation.x = -Math.PI / 2;
  // Laundry equipment: feed pipes, valves, detergent, basket and a wall broom.
  for (const z of [-3, -1, 1]) {
    link([-13.82, 0.4, z], [-13.82, 1.55, z], 0.024, mats.metal);
    link([-13.82, 1.55, z], [-13.2, 1.55, z], 0.024, mats.metal);
    cylinder(0.06, 0.03, -13.82, 1.3, z, mats.red).rotation.z = Math.PI / 2;
    sign("WASH · 50¢", -12.74, 0.86, z, 0.36, 0.11, Math.PI / 2, {
      bg: "#c0b99e",
      fg: "#454535",
      size: 32,
    });
  }
  for (let i = 0; i < 3; i++) {
    round(
      0.18,
      0.31,
      0.16,
      -9.6 + i * 0.25,
      1.08,
      -3.8,
      i % 2 ? mats.rust : mats.paper,
      scene,
      0.018,
    );
    cylinder(0.045, 0.06, -9.6 + i * 0.25, 1.26, -3.8, mats.dark);
  }
  link([-6.22, 0.2, -2.6], [-6.22, 1.85, -2.8], 0.019, mats.wood);
  box(0.13, 0.16, 0.5, -6.22, 0.13, -2.6, mats.fabric);
  round(0.7, 0.35, 0.55, -7, 0.21, -4.3, mats.ivory, scene, 0.06);
  for (let i = 0; i < 5; i++)
    box(0.08, 0.22, 0.012, -7.28 + i * 0.14, 0.24, -4.015, mats.dark);
  round(0.55, 0.15, 0.4, -7, 0.43, -4.3, mats.paper, scene, 0.045);
  // Low planters, curb stones, fence and utility fittings enclose the grounds.
  for (const z of [1, 11, 18]) {
    box(0.24, 0.24, 4.4, 14.15, 0.12, z, mats.concrete);
  }
  for (let z = -14.5; z < 20; z += 0.55)
    box(0.13, 1.45, 0.16, 14.55, 0.725, z, mats.wood);
  for (const y of [0.35, 1.12]) box(0.13, 0.1, 35, 14.63, y, 2.5, mats.joinery);
  for (let x = -5; x < 14; x += 0.6)
    box(0.14, 1.25, 0.13, x, 0.625, 20.5, mats.joinery);
  for (const y of [0.3, 1]) box(20, 0.1, 0.12, 4.5, y, 20.55, mats.wood);
  // Lodge facade: an overhang, fascia, gutter/downpipes and foundation piers.
  box(20.45, 0.14, 6.6, 4, 6.19, -12, mats.dark);
  box(20.6, 0.21, 0.13, 4, 6.1, -5.9, mats.joinery);
  link([-6.2, 6.08, -5.78], [14.2, 6.08, -5.78], 0.075, mats.metal);
  for (const x of [-2.75, 13.8]) {
    box(0.22, 3.05, 0.22, x, 1.525, -6.05, mats.joinery);
    link([x, 6.03, -5.76], [x, 0.18, -5.76], 0.045, mats.metal);
    link([x, 0.18, -5.76], [x, 0.08, -5.35], 0.045, mats.metal);
  }
  for (const x of [-1.7, 2.6, 6.9, 11.2])
    box(1.05, 0.035, 0.55, x, 0.03, -5.76, mats.carpet);
  for (const x of [-4, 3.15, 12.4]) {
    box(1.1, 0.12, 0.32, x, 3.72, -8.73, mats.joinery);
    for (let i = 0; i < 5; i++) {
      link(
        [x - 0.4 + i * 0.2, 3.79, -8.72],
        [x - 0.43 + i * 0.2, 4.04, -8.66],
        0.013,
        mats.fabric,
      );
    }
  }
  pot(-5.5, 0, 14.9, 0.9);
  pot(13.2, 0, 17.15, 0.8);
  // Pool deck: slatted loungers, attached depth markers and dark water stains.
  for (const z of [2.1, 4.6]) {
    for (const dx of [-0.3, 0.3])
      link(
        [12.5 + dx, 0.15, z - 0.7],
        [12.5 + dx, 0.65, z + 0.7],
        0.02,
        mats.metal,
      );
    for (let i = 0; i < 8; i++) {
      const plank = box(
        0.68,
        0.04,
        0.12,
        12.5,
        0.3 + i * 0.04,
        z - 0.55 + i * 0.16,
        mats.ivory,
      );
      plank.rotation.x = -0.24;
    }
  }
  sign("3 FT", 6, 0.2, 8.79, 0.55, 0.18, 0, {
    bg: "#b1b59f",
    fg: "#3e534e",
    size: 52,
  });
  box(7.8, 0.1, 0.015, 6, -0.27, 8.42, mats.fabric);
  box(0.015, 0.1, 7.8, 2.08, -0.27, 4.5, mats.fabric);
  cylinder(0.22, 0.01, 6, -0.949, 4.5, mats.dark);
}
