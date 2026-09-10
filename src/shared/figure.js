import * as THREE from "three";
import { modelTools } from "./model-tools.js";
import { batchRigidParts } from "./batching.js";
export function createFigure(scene, mats, kind = "observer") {
  const { mesh, box, round, ball, cylinder, link } = modelTools(scene, mats);
  const g = new THREE.Group(),
    skin = mats.skin.clone();
  skin.color.set(kind === "woman" ? "#afa796" : "#b1a796");
  skin.normalScale.setScalar(0.3);
  g.userData.limbs = [];
  const cloth = mats.fabric.clone();
  cloth.color.set("#393637");
  cloth.normalScale.setScalar(0.35);
  const torso = mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.21, 0.63),
        new THREE.Vector2(0.17, 0.83),
        new THREE.Vector2(0.19, 1),
        new THREE.Vector2(0.14, 1.2),
        new THREE.Vector2(0.21, 1.47),
        new THREE.Vector2(0.26, 1.6),
        new THREE.Vector2(0.14, 1.68),
      ],
      24,
    ),
    cloth,
    0,
    0,
    0,
    g,
  );
  torso.scale.z = 0.56;
  const coatVertices = torso.geometry.attributes.position;
  for (let i = 0; i < coatVertices.count; i++) {
    const angle = Math.atan2(coatVertices.getZ(i), coatVertices.getX(i));
    const fold = 1 + Math.sin(angle * 11 + coatVertices.getY(i) * 2) * 0.035;
    coatVertices.setX(i, coatVertices.getX(i) * fold);
    coatVertices.setZ(i, coatVertices.getZ(i) * fold);
    if (coatVertices.getY(i) < 0.7)
      coatVertices.setY(i, 0.62 + Math.sin(i * 2.37) * 0.055);
  }
  torso.geometry.computeVertexNormals();
  // Narrow coat lapels, a broken seam and tarnished buttons break the silhouette.
  for (const side of [-1, 1])
    link(
      [side * 0.1, 1.64, 0.08],
      [side * 0.025, 1.31, 0.1],
      0.023,
      mats.dark,
      g,
    );
  for (let i = 0; i < 5; i++)
    ball(0.013, 0.013, 0.009, 0.018, 1.32 - i * 0.115, 0.108, mats.rust, g);
  ball(0.065, 0.17, 0.07, 0, 1.73, 0.025, skin, g);
  const head = new THREE.Group();
  head.position.set(0, 1.76, 0.035);
  g.add(head);
  g.userData.head = head;
  const skullGeometry = new THREE.SphereGeometry(1, 40, 32);
  const vertices = skullGeometry.attributes.position;
  const faceColours = [];
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i) * 0.14,
      y = vertices.getY(i) * 0.225 + 0.18;
    let z = vertices.getZ(i) * 0.125;
    if (z > 0) {
      const orbit = Math.exp(
        -(((Math.abs(x) - 0.054) / 0.033) ** 2) - ((y - 0.205) / 0.038) ** 2,
      );
      z -= orbit * 0.035;
      z -=
        Math.exp(
          -(((Math.abs(x) - 0.076) / 0.025) ** 2) - ((y - 0.13) / 0.04) ** 2,
        ) * 0.02;
      z += Math.exp(-(((y - 0.258) / 0.018) ** 2)) * 0.012;
      // Fine forehead folds and sunken temples change the surface itself.
      z += Math.sin(y * 280) * 0.0014 * Math.exp(-(((y - 0.285) / 0.035) ** 2));
    }
    vertices.setXYZ(i, x, y, z);
    const sockets =
      z > 0
        ? Math.exp(
            -(((Math.abs(x) - 0.054) / 0.037) ** 2) - ((y - 0.205) / 0.04) ** 2,
          )
        : 0;
    const mottling =
      (Math.sin(x * 173 + y * 91) * Math.sin(z * 137 - y * 76) + 1) * 0.025;
    faceColours.push(
      1 - sockets * 0.36 - mottling,
      1 - sockets * 0.42 - mottling,
      1 - sockets * 0.4 - mottling,
    );
  }
  skullGeometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(faceColours, 3),
  );
  skullGeometry.computeVertexNormals();
  const faceSkin = skin.clone();
  faceSkin.vertexColors = true;
  faceSkin.color.set("#c4b5a7");
  mesh(skullGeometry, faceSkin, 0, 0, 0, head);
  const bruised = skin.clone();
  bruised.color.set("#807975");
  for (const side of [-1, 1]) {
    ball(0.03, 0.018, 0.012, side * 0.054, 0.214, 0.098, mats.black, head);

    link(
      [side * 0.029, 0.247, 0.117],
      [side * 0.088, 0.245, 0.085],
      0.011,
      skin,
      head,
    );
    ball(0.018, 0.035, 0.016, side * 0.133, 0.18, 0, skin, head);
    // Thin cheek tendons hold the expression taut around the open jaw.
    link(
      [side * 0.068, 0.13, 0.102],
      [side * 0.04, 0.016, 0.1],
      0.013,
      skin,
      head,
    );
  }
  ball(0.027, 0.058, 0.032, 0.003, 0.16, 0.126, skin, head);
  ball(0.063, 0.065, 0.06, 0.009, 0.025, 0.07, skin, head);
  ball(0.045, 0.011, 0.012, 0.007, 0.075, 0.137, mats.black, head);
  for (let i = 0; i < 5; i++) {
    ball(
      0.004,
      0.005 + (i % 2) * 0.002,
      0.005,
      (i - 2) * 0.012 + 0.004,
      0.082 - Math.abs(i - 2) * 0.002,
      0.148,
      mats.ivory,
      head,
    );
  }
  link([-0.027, 0.03, 0.146], [-0.018, -0.025, 0.13], 0.002, bruised, head);
  for (const a of [-1, 1]) {
    const armStart = g.children.length;
    ball(0.08, 0.07, 0.09, a * 0.18, 1.57, 0, cloth, g);
    link([a * 0.22, 1.55, 0], [a * 0.32, 1.16, 0.035], 0.058, cloth, g);
    ball(0.06, 0.065, 0.06, a * 0.32, 1.16, 0.035, skin, g);
    const forearmStart = g.children.length;
    link([a * 0.32, 1.16, 0.035], [a * 0.39, 0.72, 0.1], 0.043, skin, g);
    ball(0.045, 0.095, 0.023, a * 0.4, 0.67, 0.1, skin, g);
    for (let f = 0; f < 4; f++) {
      const x = a * 0.4 + (f - 1.5) * 0.018;
      const joint = [x + a * 0.012, 0.49 - f * 0.009, 0.12];
      link([x, 0.64, 0.1], joint, 0.009, skin, g);
      link(joint, [x + a * 0.008, 0.45 - f * 0.008, 0.17], 0.006, skin, g);
      ball(0.008, 0.011, 0.009, ...joint, skin, g);
    }
    link([a * 0.37, 0.7, 0.105], [a * 0.335, 0.63, 0.13], 0.012, skin, g);
    const forearm = new THREE.Group();
    forearm.position.set(a * 0.32, 1.16, 0.035);
    for (const part of g.children.slice(forearmStart)) {
      part.position.sub(forearm.position);
      forearm.add(part);
    }
    g.add(forearm);
    const arm = new THREE.Group();
    arm.position.set(a * 0.22, 1.55, 0);
    for (const part of g.children.slice(armStart)) {
      part.position.sub(arm.position);
      arm.add(part);
    }
    g.add(arm);
    g.userData.limbs.push({
      mesh: arm,
      joint: forearm,
      side: a,
      type: "arm",
    });
    const legStart = g.children.length;
    link([a * 0.12, 0.93, 0], [a * 0.14, 0.5, 0.06], 0.073, cloth, g);
    ball(0.07, 0.065, 0.065, a * 0.14, 0.5, 0.06, cloth, g);
    const shinStart = g.children.length;
    link([a * 0.14, 0.5, 0.06], [a * 0.17, 0.09, 0], 0.055, cloth, g);
    const foot = new THREE.Group();
    foot.position.set(a * 0.17, 0.09, 0);
    g.add(foot);
    ball(0.066, 0.06, 0.14, 0, -0.025, 0.06, mats.dark, foot);
    const shin = new THREE.Group();
    shin.position.set(a * 0.14, 0.5, 0.06);
    for (const part of g.children.slice(shinStart)) {
      part.position.sub(shin.position);
      shin.add(part);
    }
    g.add(shin);
    const leg = new THREE.Group();
    leg.position.set(a * 0.12, 0.93, 0);
    for (const part of g.children.slice(legStart)) {
      part.position.sub(leg.position);
      leg.add(part);
    }
    g.add(leg);
    g.userData.limbs.push({
      mesh: leg,
      joint: shin,
      foot,
      side: a,
      type: "leg",
    });
  }
  // Hair follows the sculpted skull with a broken hairline, avoiding a separate
  // hemispherical cap. Strands lie along the scalp before falling at the sides.
  const scalp = skullGeometry.clone(),
    hairIndices = [],
    indices = scalp.index.array;
  const scalpPosition = scalp.attributes.position;
  for (let i = 0; i < indices.length; i += 3) {
    const triangle = Array.from(indices.slice(i, i + 3));
    if (
      triangle.every(
        (v) =>
          scalpPosition.getY(v) >
          (scalpPosition.getZ(v) > 0.03 ? 0.306 : 0.18) +
            Math.sin(scalpPosition.getX(v) * 160) * 0.008,
      )
    )
      hairIndices.push(...triangle);
  }
  scalp.setIndex(hairIndices);
  scalp.scale(1.015, 1.012, 1.02);
  const hair = mats.dark.clone();
  hair.color.set("#282321");
  hair.roughness = 0.94;
  mesh(scalp, hair, 0, 0, 0, head);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2,
      xx = Math.sin(a) * 0.12,
      zz = Math.cos(a) * 0.1;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(xx * 0.5, 0.389, zz * 0.5),
      new THREE.Vector3(xx, 0.289, zz),
      new THREE.Vector3(xx * 1.12, 0.025 + (i % 3) * 0.04, zz - 0.01),
    ]);
    mesh(
      new THREE.TubeGeometry(curve, 9, 0.0017, 4, false),
      hair,
      0,
      0,
      0,
      head,
    );
  }
  g.scale.set(0.92, 1.17, 1);
  head.rotation.z = -0.24;
  head.rotation.x = 0.1;
  if (kind === "child") g.scale.setScalar(0.6);
  if (kind === "woman") {
    const skirt = mesh(
      new THREE.ConeGeometry(0.28, 0.85, 24, 1, true),
      cloth,
      0,
      0.62,
      0,
      g,
    );
    skirt.scale.z = 0.65;
    ball(0.15, 0.22, 0.13, 0, 1.99, -0.02, mats.dark, g);
  }
  const body = new THREE.Group();
  const legs = g.userData.limbs
    .filter((l) => l.type === "leg")
    .map((l) => l.mesh);
  for (const part of [...g.children]) if (!legs.includes(part)) body.add(part);
  g.add(body);
  g.userData.body = body;
  scene.add(g);
  batchRigidParts(g);
  return g;
}
