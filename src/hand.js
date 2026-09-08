import * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

const clamp = THREE.MathUtils.clamp;
function smoothUnion(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// Sculpt the grip as one continuous surface. Fingers wrap the camera's front,
// the thumb braces its back, and the index rests on the shutter release.
export function createCameraHand(materials) {
  const group = new THREE.Group();
  group.name = "player-hand";
  const bones = [];
  const digits = [
    {
      name: "index",
      radius: 0.014,
      points: [
        [0.211, 0.094, 0.012],
        [0.188, 0.138, 0.014],
        [0.14, 0.151, 0.011],
        [0.108, 0.15, 0.007],
      ],
    },
    {
      name: "middle",
      radius: 0.014,
      points: [
        [0.217, 0.031, 0.035],
        [0.216, 0.037, -0.048],
        [0.19, 0.03, -0.111],
        [0.14, 0.018, -0.113],
      ],
    },
    {
      name: "ring",
      radius: 0.013,
      points: [
        [0.221, -0.005, 0.035],
        [0.218, 0.003, -0.052],
        [0.19, -0.01, -0.112],
        [0.151, -0.022, -0.112],
      ],
    },
    {
      name: "little",
      radius: 0.011,
      points: [
        [0.218, -0.041, 0.038],
        [0.215, -0.035, -0.038],
        [0.19, -0.047, -0.106],
        [0.161, -0.053, -0.106],
      ],
    },
    {
      name: "thumb",
      radius: 0.015,
      points: [
        [0.202, -0.025, 0.067],
        [0.184, -0.016, 0.102],
        [0.162, 0.007, 0.125],
        [0.142, 0.032, 0.131],
      ],
    },
  ];
  for (const digit of digits) {
    const curve = new THREE.CatmullRomCurve3(
      digit.points.map((p) => new THREE.Vector3(...p)),
    );
    const points = curve.getPoints(15);
    for (let i = 0; i < 15; i++) {
      const a = points[i],
        b = points[i + 1],
        delta = b.clone().sub(a);
      bones.push({
        a,
        delta,
        length2: delta.lengthSq(),
        radius:
          digit.radius *
          (1 - (0.23 * i) / 15) *
          (1 +
            0.1 * Math.exp(-((i - 5) ** 2) / 3) +
            0.07 * Math.exp(-((i - 10) ** 2) / 3)),
      });
    }
  }
  const wristA = new THREE.Vector3(0.253, -0.192, 0.054),
    wristB = new THREE.Vector3(0.218, -0.045, 0.025);
  const wristDelta = wristB.clone().sub(wristA);
  bones.push({
    a: wristA,
    delta: wristDelta,
    length2: wristDelta.lengthSq(),
    radius: 0.028,
  });
  for (const bone of bones) {
    bone.min = [bone.a.x, bone.a.y, bone.a.z].map(
      (v, i) =>
        Math.min(v, v + bone.delta.getComponent(i)) - bone.radius - 0.012,
    );
    bone.max = [bone.a.x, bone.a.y, bone.a.z].map(
      (v, i) =>
        Math.max(v, v + bone.delta.getComponent(i)) + bone.radius + 0.012,
    );
  }
  const ellipsoid = (x, y, z, cx, cy, cz, rx, ry, rz) => {
    const a = (x - cx) / rx,
      b = (y - cy) / ry,
      c = (z - cz) / rz;
    const k0 = Math.hypot(a, b, c),
      k1 = Math.hypot(a / rx, b / ry, c / rz);
    return k1 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  };
  const skin = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.64,
    normalMap: materials.skin.normalMap,
    normalScale: new THREE.Vector2(0.2, 0.2),
  });
  const resolution = 88,
    half = 0.24,
    centre = new THREE.Vector3(0.18, -0.035, 0.02);
  const field = new MarchingCubes(resolution, skin, false, false, 45000);
  field.isolation = 0;
  for (let z = 0; z < resolution; z++)
    for (let y = 0; y < resolution; y++)
      for (let x = 0; x < resolution; x++) {
        const px = ((x / resolution) * 2 - 1) * half + centre.x;
        const py = ((y / resolution) * 2 - 1) * half + centre.y;
        const pz = ((z / resolution) * 2 - 1) * half + centre.z;
        let d = ellipsoid(px, py, pz, 0.214, 0.025, 0.018, 0.035, 0.082, 0.049);
        d = smoothUnion(
          d,
          ellipsoid(px, py, pz, 0.203, -0.02, 0.063, 0.024, 0.035, 0.024),
          0.012,
        );
        for (const ky of [0.052, 0.02, -0.012]) {
          d = smoothUnion(
            d,
            ellipsoid(px, py, pz, 0.237, ky, -0.004, 0.016, 0.015, 0.022),
            0.007,
          );
        }
        for (const bone of bones) {
          if (
            px < bone.min[0] ||
            px > bone.max[0] ||
            py < bone.min[1] ||
            py > bone.max[1] ||
            pz < bone.min[2] ||
            pz > bone.max[2]
          )
            continue;
          const dx = px - bone.a.x,
            dy = py - bone.a.y,
            dz = pz - bone.a.z;
          const t = clamp(
            (dx * bone.delta.x + dy * bone.delta.y + dz * bone.delta.z) /
              bone.length2,
            0,
            1,
          );
          const distance =
            Math.hypot(
              dx - bone.delta.x * t,
              dy - bone.delta.y * t,
              dz - bone.delta.z * t,
            ) - bone.radius;
          d = smoothUnion(d, distance, 0.006);
        }
        field.field[z * resolution * resolution + y * resolution + x] = -d;
      }
  field.update();
  const geometry = new THREE.BufferGeometry();
  const positions = field.geometry.attributes.position.array.slice(
    0,
    field.count * 3,
  );
  const normals = field.geometry.attributes.normal.array.slice(
    0,
    field.count * 3,
  );
  const colours = new Float32Array(field.count * 3),
    uv = new Float32Array(field.count * 2);
  const base = new THREE.Color("#c49a82"),
    blush = new THREE.Color("#b78070"),
    colour = new THREE.Color();
  for (let i = 0; i < field.count; i++) {
    const x = (positions[i * 3] = positions[i * 3] * half + centre.x);
    const y = (positions[i * 3 + 1] = positions[i * 3 + 1] * half + centre.y);
    const z = (positions[i * 3 + 2] = positions[i * 3 + 2] * half + centre.z);
    const mottling =
      (Math.sin(x * 271 + y * 117) * Math.sin(z * 213 - y * 189) + 1) * 0.055;
    const contact =
      Math.exp(-(((x - 0.197) / 0.027) ** 2) - ((y - 0.103) / 0.023) ** 2) *
      0.25;
    colour.copy(base).lerp(blush, mottling + contact);
    colours.set([colour.r, colour.g, colour.b], i * 3);
    uv[i * 2] = x * 4 + z * 3;
    uv[i * 2 + 1] = y * 4;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.computeBoundingSphere();
  field.geometry.dispose();
  const hand = new THREE.Mesh(geometry, skin);
  hand.name = "continuous-hand-skin";
  group.add(hand);
  const nailMaterial = new THREE.MeshStandardMaterial({
    color: "#c5aa96",
    roughness: 0.43,
  });
  const sphere = new THREE.SphereGeometry(1, 20, 12);
  for (const digit of digits) {
    const end = new THREE.Vector3(...digit.points.at(-1)),
      before = new THREE.Vector3(...digit.points.at(-2));
    const tangent = end.clone().sub(before).normalize();
    const outward =
      digit.name === "index"
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(0, 0, digit.name === "thumb" ? 1 : -1);
    const across = new THREE.Vector3()
      .crossVectors(tangent, outward)
      .normalize();
    const normal = new THREE.Vector3()
      .crossVectors(across, tangent)
      .normalize();
    const nail = new THREE.Mesh(sphere, nailMaterial);
    nail.name = `${digit.name}-nail`;
    nail.position
      .copy(end)
      .addScaledVector(tangent, -0.006)
      .addScaledVector(normal, digit.radius * 0.77);
    nail.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(across, tangent, normal),
    );
    nail.scale.set(
      digit.radius * 0.62,
      digit.name === "thumb" ? 0.011 : 0.009,
      0.0012,
    );
    group.add(nail);
  }
  // Fine folds on the visible thumb and wrist, kept flush and subdued.
  const crease = new THREE.MeshStandardMaterial({
    color: "#966e59",
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    roughness: 1,
  });
  for (const [x, y, z, w] of [
    [0.163, 0.004, 0.14, 0.009],
    [0.179, -0.018, 0.132, 0.01],
    [0.235, -0.133, 0.079, 0.023],
  ]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - w, y - 0.002, z - 0.002),
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + w, y + 0.001, z - 0.002),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 8, 0.0004, 3, false),
        crease,
      ),
    );
  }
  for (const [x, y, z] of [
    [0.188, 0.153, 0.014],
    [0.151, 0.164, 0.011],
  ]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x - 0.001, y - 0.001, z - 0.008),
      new THREE.Vector3(x, y, z),
      new THREE.Vector3(x + 0.001, y - 0.001, z + 0.008),
    ]);
    group.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 8, 0.00035, 3, false),
        crease,
      ),
    );
  }
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.039, 0.052, 0.19, 24, 4),
    materials.fabric,
  );
  sleeve.position.set(0.282, -0.247, 0.058);
  sleeve.rotation.z = 0.31;
  group.add(sleeve);
  const cuff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.041, 0.042, 0.027, 24, 1, true),
    materials.fabric,
  );
  cuff.position.set(0.254, -0.166, 0.058);
  cuff.rotation.z = 0.31;
  group.add(cuff);
  group.userData.digits = digits.map((d) => d.name);
  return group;
}
