import * as THREE from "three";
import { createCameraHand } from "../hand.js";
import { modelTools } from "./model-tools.js";
import { batchRigidParts } from "./batching.js";
export function makeCamera(parent, mats) {
  const { round, box, sign, cylinder, mesh } = modelTools(parent, mats);
  const g = new THREE.Group();
  parent.add(g);
  round(0.34, 0.22, 0.19, 0, 0, 0, mats.black, g, 0.025);
  round(0.32, 0.04, 0.22, 0, -0.12, 0.025, mats.metal, g, 0.012);
  round(0.29, 0.025, 0.13, 0, 0.124, 0.005, mats.ivory, g, 0.008);
  round(0.1, 0.09, 0.02, -0.08, 0.041, 0.105, mats.dark, g, 0.01);
  round(0.076, 0.065, 0.01, -0.08, 0.043, 0.118, mats.glass, g, 0.01);
  round(0.1, 0.07, 0.012, 0.09, 0.051, 0.112, mats.paper, g, 0.007);
  for (let i = 0; i < 7; i++)
    box(0.095, 0.002, 0.004, 0.09, 0.027 + i * 0.008, 0.12, mats.dark, g);
  sign(
    "POLAROID",
    0.02,
    -0.06,
    0.102,
    0.18,
    0.035,
    0,
    { bg: "#19251d", fg: "#a3b397", size: 40 },
    g,
  );
  for (let i = 0; i < 4; i++)
    box(
      0.013,
      0.05,
      0.004,
      -0.105 + i * 0.014,
      -0.06,
      0.103,
      [mats.red, mats.rust, mats.ivory, mats.fabric][i],
      g,
    );
  round(0.08, 0.045, 0.015, 0.095, -0.066, 0.115, mats.dark, g);
  cylinder(0.025, 0.02, 0.1, 0.139, 0.01, mats.red, g);
  const lens = cylinder(0.066, 0.065, 0, 0.01, -0.119, mats.dark, g);
  lens.rotation.x = Math.PI / 2;
  const rim = mesh(
    new THREE.TorusGeometry(0.068, 0.009, 7, 24),
    mats.metal,
    0,
    0.01,
    -0.152,
    g,
  );
  g.add(createCameraHand(mats));
  g.position.set(0.28, -0.28, -0.53);
  g.rotation.set(-0.13, -0.18, -0.05);
  batchRigidParts(g);
  return g;
}
