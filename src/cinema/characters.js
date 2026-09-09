import * as THREE from "three";
import { modelTools } from "../shared/model-tools.js";
import { floorAt } from "./logic.js";

export function cinemaCharacters(scene, mats, contactShadow, ground = floorAt) {
  const { mesh, box, round, ball, link, cylinder } = modelTools(scene, mats);
  const loader = new THREE.TextureLoader();
  let faceMap, castMap;
  const faceReady = new Promise((resolve, reject) => {
    faceMap = loader.load(
      new URL("cinema/patron-face.png", document.baseURI).href,
      resolve,
      undefined,
      reject,
    );
  });
  faceMap.colorSpace = THREE.SRGBColorSpace;
  faceMap.anisotropy = 8;
  const castReady = new Promise((resolve, reject) => {
    castMap = loader.load(
      new URL("cinema/cast-faces.png", document.baseURI).href,
      resolve,
      undefined,
      reject,
    );
  });
  castMap.colorSpace = THREE.SRGBColorSpace;
  castMap.anisotropy = 8;
  let audienceIndex = 0;
  const skinBase = new THREE.MeshStandardMaterial({
    color: "#ad8972",
    roughness: 0.9,
  });
  const create = function person(x, z, colour = "#4d4940", role = "audience") {
    const portrait =
      role === "ada" ? 0 : role === "manager" ? 1 : 2 + (audienceIndex++ % 2);
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, ground(x, z) || 0, z);
    g.userData.limbs = [];
    g.userData.hands = {};
    const cloth = mats.fabric.clone();
    cloth.color.set(colour);
    cloth.roughness = 0.97;
    const trousers = mats.fabric.clone();
    trousers.color.set("#373c3d");
    trousers.roughness = 1;
    const shirt = mats.fabric.clone();
    shirt.color.set("#a99f89");
    shirt.roughness = 0.96;
    contactShadow(0, 0, 0.7, 0.58, 0, g);
    const body = new THREE.Group();
    g.add(body);
    g.userData.body = body;
    const torso = mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.19, 0.85),
          new THREE.Vector2(0.2, 1.05),
          new THREE.Vector2(0.17, 1.3),
          new THREE.Vector2(0.24, 1.47),
          new THREE.Vector2(0.065, 1.58),
        ],
        16,
      ),
      cloth,
      0,
      0,
      0,
      body,
    );
    torso.scale.z = 0.72;
    // A worn civilian jacket, with a shirt, lapels, pockets and separate trousers.
    const shirtFront = new THREE.BufferGeometry();
    const shirtVertices = [],
      shirtIndices = [];
    for (const [i, [y, z, halfWidth]] of [
      [1.25, 0.133, 0.035],
      [1.3, 0.128, 0.035],
      [1.47, 0.177, 0.05],
      [1.56, 0.075, 0.04],
    ].entries()) {
      shirtVertices.push(-halfWidth, y, z, halfWidth, y, z);
      if (i)
        shirtIndices.push(
          i * 2 - 2,
          i * 2 - 1,
          i * 2,
          i * 2 - 1,
          i * 2 + 1,
          i * 2,
        );
    }
    shirtFront.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(shirtVertices, 3),
    );
    shirtFront.setIndex(shirtIndices);
    shirtFront.computeVertexNormals();
    mesh(shirtFront, shirt, 0, 0, 0, body);
    for (const side of [-1, 1]) {
      const lapel = new THREE.BufferGeometry();
      lapel.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [
            side * 0.065,
            1.54,
            0.102,
            side * 0.125,
            1.46,
            0.146,
            side * 0.045,
            1.3,
            0.138,
          ],
          3,
        ),
      );
      lapel.setIndex(side === -1 ? [0, 1, 2] : [2, 1, 0]);
      lapel.computeVertexNormals();
      mesh(lapel, cloth, 0, 0, 0, body);
      round(0.085, 0.105, 0.008, side * 0.125, 1.115, 0.14, cloth, body, 0.003);
      link(
        [side * 0.08, 1.17, 0.16],
        [side * 0.165, 1.17, 0.16],
        0.0025,
        mats.dark,
        body,
      );
      ball(0.083, 0.078, 0.09, side * 0.19, 1.425, 0, cloth, body);
    }
    for (const y of [1.16, 1.26, 1.36])
      ball(0.006, 0.006, 0.003, 0, y, 0.145, mats.dark, body);
    cylinder(0.054, 0.14, 0, 1.6, 0, skinBase, body);
    const head = new THREE.Group();
    head.position.y = 1.65;
    body.add(head);
    g.userData.head = head;
    // Shaped anatomy with an original front-projected albedo. The map blends
    // into the scalp at the temples, so no facial features repeat on the back.
    const faceGeometry = new THREE.SphereGeometry(1, 80, 64);
    const vertices = faceGeometry.attributes.position;
    const colours = [],
      weights = [],
      uv = [];
    const gaussian = (x, y, cx, cy, sx, sy) =>
      Math.exp(-(((x - cx) / sx) ** 2) - ((y - cy) / sy) ** 2);
    const verticalMap = (y) => {
      const stops = [
        [-0.09, 0.99],
        [0.005, 0.76],
        [0.05, 0.64],
        [0.1, 0.48],
        [0.22, 0.035],
      ];
      for (let i = 1; i < stops.length; i++)
        if (y <= stops[i][0])
          return (
            1 -
            THREE.MathUtils.lerp(
              stops[i - 1][1],
              stops[i][1],
              THREE.MathUtils.clamp(
                (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]),
                0,
                1,
              ),
            )
          );
      return 0.965;
    };
    for (let i = 0; i < vertices.count; i++) {
      const nx = vertices.getX(i),
        ny = vertices.getY(i),
        nz = vertices.getZ(i);
      const y = 0.065 + ny * 0.155;
      const x =
        nx * 0.104 * (1 + 0.12 * Math.exp(-(((ny + 0.55) / 0.25) ** 2)));
      const front = THREE.MathUtils.smoothstep(nz, 0.05, 0.72);
      const nose = gaussian(x, y, 0, 0.052, 0.014, 0.031);
      const sockets =
        gaussian(x, y, -0.039, 0.1, 0.025, 0.018) +
        gaussian(x, y, 0.039, 0.1, 0.025, 0.018);
      const cheek =
        gaussian(x, y, -0.065, 0.045, 0.031, 0.027) +
        gaussian(x, y, 0.065, 0.045, 0.031, 0.027);
      let z =
        nz * 0.105 + front * (0.044 * nose - 0.009 * sockets + 0.008 * cheek);
      const hairline = 0.005 + 0.16 * THREE.MathUtils.smoothstep(nz, -0.5, 0.5);
      const hair =
        THREE.MathUtils.smoothstep(y, hairline - 0.01, hairline + 0.006) *
        (1 - front);
      colours.push(1 - hair * 0.78, 1 - hair * 0.79, 1 - hair * 0.8);
      weights.push(front);
      const u = THREE.MathUtils.clamp(0.5 + x / 0.31, 0, 1),
        v = verticalMap(y);
      uv.push(
        role === "patron" ? u : u * 0.5 + (portrait % 2) * 0.5,
        role === "patron" ? v : v * 0.5 + (portrait < 2 ? 0.5 : 0),
      );
      vertices.setXYZ(i, x, y, z);
    }
    faceGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    faceGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colours, 3),
    );
    faceGeometry.setAttribute(
      "faceWeight",
      new THREE.Float32BufferAttribute(weights, 1),
    );
    faceGeometry.computeVertexNormals();
    const skin = new THREE.MeshStandardMaterial({
      map: role === "patron" ? faceMap : castMap,
      vertexColors: true,
      roughness: 0.94,
      color: "#d2c6b8",
    });
    skin.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float faceWeight; varying float vFaceWeight;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFaceWeight=faceWeight;",
      );
      shader.fragmentShader =
        "varying float vFaceWeight;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        "#ifdef USE_MAP\nvec4 faceTexel=texture2D(map,vMapUv);\ndiffuseColor.rgb*=mix(vec3(.43,.30,.22),faceTexel.rgb,vFaceWeight);\n#endif",
      );
    };
    skin.customProgramCacheKey = () => "cinema-face-v2";
    const face = mesh(faceGeometry, skin, 0, 0, 0, head);
    face.name = "human-face";
    if (role === "ada") {
      ball(0.065, 0.055, 0.052, 0, 0.115, -0.11, mats.dark, head);
      torso.scale.x = 0.94;
    }
    if (role === "manager") torso.scale.x = 1.12;
    for (const side of [-1, 1]) {
      const ear = ball(
        0.012,
        0.027,
        0.019,
        side * 0.103,
        0.065,
        -0.008,
        skinBase,
        head,
      );
      ball(0.005, 0.018, 0.01, side * 0.113, 0.065, -0.006, mats.rust, head);
      const arm = new THREE.Group();
      arm.position.set(side * 0.23, 1.43, 0);
      body.add(arm);
      link([0, 0, 0], [side * 0.04, -0.32, 0], 0.075, cloth, arm);
      const elbow = new THREE.Group();
      elbow.position.set(side * 0.04, -0.32, 0);
      arm.add(elbow);
      link([0, 0, 0], [side * 0.025, -0.3, 0.015], 0.059, cloth, elbow);
      const hand = new THREE.Group();
      g.userData.hands[side] = hand;
      elbow.add(hand);
      hand.position.set(side * 0.025, -0.34, 0.02);
      round(0.064, 0.082, 0.033, 0, 0, 0, skinBase, hand, 0.014);
      for (let finger = 0; finger < 4; finger++) {
        const fx = -0.024 + finger * 0.016,
          length = [0.047, 0.057, 0.052, 0.04][finger];
        link(
          [fx, -0.035, 0],
          [fx, -0.035 - length, 0.006],
          0.009,
          skinBase,
          hand,
        );
        link(
          [fx, -0.035 - length, 0.006],
          [fx, -0.04 - length, 0.026],
          0.008,
          skinBase,
          hand,
        );
        ball(0.009, 0.009, 0.009, fx, -0.039, 0, skinBase, hand);
      }
      link(
        [side * 0.028, 0.015, 0],
        [side * 0.046, -0.015, 0.013],
        0.012,
        skinBase,
        hand,
      );
      link(
        [side * 0.046, -0.015, 0.013],
        [side * 0.038, -0.035, 0.027],
        0.01,
        skinBase,
        hand,
      );
      if (side === 1 && role === "patron") {
        const strap = cylinder(
          0.052,
          0.035,
          side * 0.023,
          -0.265,
          0.014,
          mats.dark,
          elbow,
        );
        const watch = round(
          0.038,
          0.029,
          0.016,
          side * 0.023,
          -0.265,
          0.068,
          mats.brass,
          elbow,
          0.006,
        );
        round(
          0.029,
          0.021,
          0.004,
          side * 0.023,
          -0.265,
          0.078,
          mats.ivory,
          elbow,
          0.004,
        );
        link(
          [side * 0.023, -0.265, 0.082],
          [side * 0.028, -0.258, 0.082],
          0.0016,
          mats.black,
          elbow,
        );
        g.userData.watch = watch;
        for (let stitch = 0; stitch < 6; stitch++)
          link(
            [0.007 + stitch * 0.008, -0.22, 0.067],
            [0.01 + stitch * 0.008, -0.235, 0.067],
            0.0017,
            mats.ivory,
            elbow,
          );
      }
      cylinder(0.061, 0.06, side * 0.023, -0.29, 0.014, cloth, elbow);

      g.userData.limbs.push({ mesh: arm, joint: elbow, type: "arm", side });
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.93, 0);
      g.add(leg);
      link([0, 0, 0], [side * 0.02, -0.43, 0.06], 0.085, trousers, leg);
      const knee = new THREE.Group();
      knee.position.set(side * 0.02, -0.43, 0.06);
      leg.add(knee);
      link([0, 0, 0], [side * 0.03, -0.41, -0.06], 0.065, trousers, knee);
      const foot = new THREE.Group();
      foot.position.set(side * 0.03, -0.41, -0.06);
      knee.add(foot);
      ball(0.074, 0.058, 0.145, 0, -0.025, 0.06, mats.dark, foot);
      round(0.14, 0.025, 0.26, 0, -0.062, 0.06, mats.black, foot, 0.009);
      for (let i = 0; i < 3; i++)
        link(
          [-0.04, 0.016, 0.04 + i * 0.025],
          [0.04, 0.016, 0.04 + i * 0.025],
          0.003,
          mats.wood,
          foot,
        );
      g.userData.limbs.push({
        mesh: leg,
        joint: knee,
        foot,
        type: "leg",
        side,
      });
    }
    return g;
  };
  create.ready = Promise.all([faceReady, castReady]);
  return create;
}
