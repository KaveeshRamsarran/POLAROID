import { makeCamera as sharedCamera } from "./shared/camera-model.js";
import { createFigure } from "./shared/figure.js";
import { updateObserverAnimation } from "./observer-animation.js";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  regions,
  evidenceDefs,
  seededRandom,
  floorAt,
  tiledRooms,
  boardedRooms,
} from "./logic.js";

import { createSurface, repeatMaterial, surfaceKinds } from "./materials.js";
import { createHouseFinishes, createHousePicture } from "./house-finishes.js";
import { nightEnvironment } from "./shared/night-environment.js";

const rnd = seededRandom(971017);
export function buildWorld(scene) {
  const solids = [],
    doors = [],
    interactables = [],
    fixtures = [],
    photoOnly = [],
    animated = [],
    windows = [],
    frames = [],
    architecture = [],
    chairs = [];
  const textures = Object.fromEntries(
    surfaceKinds.map((k) => [k, createSurface(k)]),
  );
  const materialCache = new Map();
  const material = (color, roughness = 0.85, metalness = 0) => {
    const key = [color, roughness, metalness].join();
    if (!materialCache.has(key))
      materialCache.set(
        key,
        new THREE.MeshStandardMaterial({ color, roughness, metalness }),
      );
    return materialCache.get(key);
  };
  const mats = {
    wall: material("#dbcdb5"),
    tile: material("#e4d9bf", 0.68),
    concrete: material("#b7afa0", 0.8),
    wood: material("#eee0cb"),
    metal: material("#aca496", 0.6, 0.65),
    fabric: material("#9b786e"),
    dark: material("#241e19"),
    rust: material("#603b29", 0.9, 0.4),
    paper: material("#b9b697"),
    ivory: material("#bfc3a8"),
    black: material("#101711"),
    glass: material("#263e39", 0.17, 0.8),
    skin: material("#b5bbaa", 0.72),
    red: material("#743729", 0.6, 0.2),
    brass: material("#8a7442", 0.45, 0.7),
    leaf: material("#4e6440", 0.86),
  };
  for (const k of Object.keys(textures)) {
    Object.assign(mats[k], textures[k]);
    mats[k].roughness = 1;
    mats[k].normalScale.setScalar(k === "wall" ? 0.55 : 0.7);
  }
  const house = createHouseFinishes();
  // Keep shared camera/character materials and cinema surfaces independent.
  Object.assign(mats, house);
  mats.wall = house.plaster;
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
  function solid(x, z, w, d, door, y1 = floorAt(x, z) ?? 0, h = 1.15) {
    solids.push({
      x1: x - w / 2,
      x2: x + w / 2,
      z1: z - d / 2,
      z2: z + d / 2,
      y1,
      y2: y1 + h,
      door,
    });
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
  const wallMaterials = new Map();
  function wallSegment(x, z, w, d, y = 0, h = 3.25) {
    const finish = y < 0 || y >= 6.8 ? mats.plaster : mats.wallpaper;
    const key = `${finish.uuid},${Math.max(w, d).toFixed(2)},${h.toFixed(2)}`;
    if (!wallMaterials.has(key)) {
      wallMaterials.set(key, repeatMaterial(finish, Math.max(w, d) / 2, h / 2));
    }
    box(w, h, d, x, y + h / 2, z, wallMaterials.get(key));
    // Trim protrudes along the wall thickness, whichever axis the wall follows.
    const alongX = w > d;
    box(
      w + (alongX ? 0 : 0.045),
      0.14,
      d + (alongX ? 0.045 : 0),
      x,
      y + 0.07,
      z,
      mats.joinery,
    );
    box(
      w + (alongX ? 0 : 0.025),
      0.045,
      d + (alongX ? 0.025 : 0),
      x,
      y + 1.08,
      z,
      mats.trim,
    );
    // Wainscot and stepped cornice follow each solid segment, stopping at every
    // doorway. They never form a decorative barrier across an opening.
    if (y >= 0 && y < 6.8) {
      box(
        w + (alongX ? 0 : 0.028),
        0.86,
        d + (alongX ? 0.028 : 0),
        x,
        y + 0.57,
        z,
        mats.joinery,
      );
      for (const [drop, height, depth] of [
        [0.09, 0.12, 0.08],
        [0.19, 0.045, 0.045],
      ])
        box(
          w + (alongX ? 0 : depth),
          height,
          d + (alongX ? depth : 0),
          x,
          y + h - drop,
          z,
          mats.trim,
        );
      const length = alongX ? w : d;
      const count = Math.floor(length / 0.8);
      for (let i = 1; i < count; i++) {
        const offset = -length / 2 + (i * length) / count;
        box(
          alongX ? 0.035 : w + 0.045,
          0.84,
          alongX ? d + 0.045 : 0.035,
          x + (alongX ? offset : 0),
          y + 0.57,
          z + (alongX ? 0 : offset),
          mats.joinery,
        );
      }
    }
    architecture.push({ type: "wall", x, z, w, d, y, h });
    solid(x, z, w, d, undefined, y, h);
  }
  // Openings are always 2.25 m tall; the lintel takes up whatever is left, so a
  // storey can be shortened where another storey's wall sits directly above it.
  function lintel(x, z, w, d, y, h) {
    const finish = y < 0 || y >= 6.8 ? mats.plaster : mats.wallpaper;
    const mat = repeatMaterial(finish, Math.max(w, d) / 2, (h - 2.25) / 2);
    mat.map.offset.y = 2.25 / 2;
    box(w, h - 2.25, d, x, y + (h + 2.25) / 2, z, mat);
    if (y >= 0 && y < 6.8)
      for (const [drop, height, depth] of [
        [0.09, 0.12, 0.08],
        [0.19, 0.045, 0.045],
      ])
        box(
          w + (w > d ? 0 : depth),
          height,
          d + (w > d ? depth : 0),
          x,
          y + h - drop,
          z,
          mats.trim,
        );
  }
  function wallX(z, a, b, y = 0, gaps = [], h = 3.25) {
    let p = a;
    for (const [g1, g2] of gaps) {
      if (g1 > p) wallSegment((p + g1) / 2, z, g1 - p, 0.2, y, h);
      lintel((g1 + g2) / 2, z, g2 - g1, 0.2, y, h);
      p = g2;
    }
    if (p < b) wallSegment((p + b) / 2, z, b - p, 0.2, y, h);
  }
  function wallZ(x, a, b, y = 0, gaps = [], h = 3.25) {
    let p = a;
    for (const [g1, g2] of gaps) {
      if (g1 > p) wallSegment(x, (p + g1) / 2, 0.2, g1 - p, y, h);
      lintel(x, (g1 + g2) / 2, 0.2, g2 - g1, y, h);
      p = g2;
    }
    if (p < b) wallSegment(x, (p + b) / 2, 0.2, b - p, y, h);
  }
  // Floor finish follows the same room lists the footstep audio reads, so a tiled
  // room always sounds tiled.
  const floorMaterials = new Map();
  function floorFinish(name, y) {
    if (tiledRooms.includes(name)) return mats.tile;
    if (y > 0 || boardedRooms.includes(name)) return mats.wood;
    return mats.concrete;
  }
  for (const r of regions) {
    if (r.ramp) continue;
    const w = r.x2 - r.x1,
      d = r.z2 - r.z1,
      finish = floorFinish(r.name, r.y),
      key = `${finish.uuid},${w},${d}`;
    if (!floorMaterials.has(key))
      floorMaterials.set(key, repeatMaterial(finish, w / 3, d / 3));
    box(
      w,
      0.18,
      d,
      (r.x1 + r.x2) / 2,
      r.y - 0.1,
      (r.z1 + r.z2) / 2,
      floorMaterials.get(key),
    );
    if (r.name !== "FRONT PORCH")
      box(
        w,
        0.12,
        d,
        (r.x1 + r.x2) / 2,
        r.y + 3.26,
        (r.z1 + r.z2) / 2,
        r.y < 0 ? mats.concrete : mats.plaster,
      );
  }
  // Openings are sized to their leaf: a 1.05 m door needs a 1.25 m reveal.
  const LEAF = 1.05,
    HEAVY = 1.15,
    DOORWAY = LEAF + 0.2,
    PORTAL = HEAVY + 0.2,
    ARCH = 1.5;
  const gap = (centre, width) => [centre - width / 2, centre + width / 2];
  // Ground floor: front and rear elevations, then the west and east wings.
  wallX(14, -19, 19, 0, [gap(0, PORTAL)]);
  wallX(-17, -19, -10, 0);
  wallX(-17, -10, 10, 0, [[-2.2, 2.2]]);
  wallZ(-19, -17, 14);
  wallZ(19, -6, 14);
  wallZ(-10, -17, 14, 0, [
    gap(-14, DOORWAY),
    gap(-4, DOORWAY),
    gap(6, DOORWAY),
  ]);
  wallZ(10, -17, 14, 0, [[-16, -12], gap(1, DOORWAY), gap(11.5, DOORWAY)]);
  for (const x of [-2.2, 2.2])
    wallZ(x, -17, 14, 0, [
      gap(-12, DOORWAY),
      gap(-1, DOORWAY),
      gap(9, DOORWAY),
    ]);
  for (const z of [-6, 4]) {
    wallX(z, -19, -10, 0, [gap(-14.5, ARCH)]);
    wallX(z, -10, -2.2, 0, [gap(-6, ARCH)]);
    wallX(z, 2.2, 10, 0, [gap(6, ARCH)]);
  }
  wallX(4, 10, 19, 0, [gap(14.5, ARCH)]);
  wallX(-6, 10, 19, 0);
  // Upper floor: bedrooms, and the guest room and bathroom behind them.
  wallX(-29, -10, 10, 3.6, [
    gap(-8.5, DOORWAY),
    gap(0, PORTAL),
    gap(8.5, DOORWAY),
  ]);
  wallX(-18, -10, -2.2, 3.6);
  wallX(-18, 2.2, 10, 3.6);
  // Stops at 6.8, exactly where the attic's own south wall begins.
  wallX(-35, -10, -2.2, 3.6, [], 3.2);
  wallX(-35, 2.2, 10, 3.6, [], 3.2);
  wallZ(-10, -35, -18, 3.6);
  wallZ(10, -35, -18, 3.6);
  wallZ(-2.2, -29, -23, 3.6, [gap(-26, DOORWAY)]);
  wallZ(2.2, -29, -23, 3.6, [gap(-26, DOORWAY)]);
  function stairs(x, z, width, length, start, rise, axis = "z") {
    const n = 18;
    for (let i = 0; i < n; i++) {
      const y = start + (rise * (i + 1)) / n;
      if (axis === "z") {
        box(
          width,
          0.2,
          length / n + 0.015,
          x,
          y - 0.1,
          z - ((i + 0.5) * length) / n,
          mats.wood,
        );
        box(
          width,
          0.024,
          0.05,
          x,
          y + 0.01,
          z - (i * length) / n,
          mats.joinery,
        );
      } else {
        box(
          length / n + 0.015,
          0.2,
          width,
          x + ((i + 0.5) * length) / n,
          y - 0.1,
          z,
          mats.concrete,
        );
        box(0.05, 0.024, width, x + (i * length) / n, y + 0.01, z, mats.metal);
      }
    }
    if (axis === "z") {
      for (const side of [-1, 1]) {
        link(
          [x + side * (width / 2 - 0.18), start + 1, z],
          [x + side * (width / 2 - 0.18), start + rise + 1, z - length],
          0.045,
          mats.joinery,
        );
        for (let i = 0; i <= 18; i++)
          link(
            [
              x + side * (width / 2 - 0.18),
              start + (rise * i) / 18,
              z - (length * i) / 18,
            ],
            [
              x + side * (width / 2 - 0.18),
              start + (rise * i) / 18 + 1,
              z - (length * i) / 18,
            ],
            0.025,
            mats.trim,
          );
      }
    }
  }
  stairs(0, -17, 4.4, 6, 0, 3.6);
  stairs(0, -29, 4.4, 6, 3.6, 3.2);
  stairs(10, -14, 4, 6, 0, -3.6, "x");
  // A single shell per flight removes coincident upstairs / stair wall faces.
  for (const [z, y, rise] of [
    [-17, 0, 3.6],
    [-29, 3.6, 3.2],
  ]) {
    for (const x of [-2.2, 2.2]) wallSegment(x, z - 3, 0.2, 6, y, rise + 3.25);
    box(4.4, 0.12, 6, 0, y + rise + 3.26, z - 3, mats.plaster);
    // Close the view above the lower roof, leaving the lower doorway clear.
    const h = rise + 0.07;
    box(
      4.4,
      h,
      0.2,
      0,
      y + 3.25 + h / 2,
      z,
      repeatMaterial(mats.wall, 4.4 / 3, h / 3),
    );
    architecture.push({
      type: "stair-back",
      x: 0,
      z,
      w: 4.4,
      d: 0.2,
      y: y + 3.25,
      h,
    });
  }
  for (const z of [-16, -12]) wallSegment(13, z, 6, 0.2, -3.6, 6.85);
  box(6, 0.12, 4, 13, 3.26, -14, mats.dark);
  box(0.2, 3.6, 4, 16, 1.45, -14, mats.wall);
  wallX(-43, -6, 6, 6.8);
  wallX(-35, -6, 6, 6.8, [[-2.2, 2.2]]);
  wallZ(-6, -43, -35, 6.8);
  wallZ(6, -43, -35, 6.8);
  wallX(-22, 16, 28, -3.6, [gap(17.5, PORTAL)]);
  wallX(-30, 16, 28, -3.6);
  wallX(-6, 16, 28, -3.6);
  wallZ(28, -30, -6, -3.6);
  wallZ(16, -30, -22, -3.6);
  wallZ(16, -22, -6, -3.6, [gap(-14, PORTAL)]);
  function door(x, z, rotation, label, y = 0, locked = null, width = LEAF) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    scene.add(g);
    const pivot = new THREE.Group();
    pivot.position.x = -width / 2;
    g.add(pivot);
    round(width, 2.22, 0.105, width / 2, 1.11, 0, mats.joinery, pivot, 0.012);
    for (const side of [-1, 1]) {
      for (const [py, ph] of [
        [0.52, 0.66],
        [1.53, 1.04],
      ]) {
        for (const px of [width * 0.28, width * 0.72]) {
          const pw = width * 0.34;
          round(pw, ph, 0.025, px, py, side * 0.06, mats.wood, pivot, 0.01);
          round(
            pw - 0.055,
            ph - 0.065,
            0.02,
            px,
            py,
            side * 0.075,
            mats.joinery,
            pivot,
            0.012,
          );
        }
      }
      round(
        0.065,
        0.24,
        0.025,
        width - 0.14,
        1.04,
        side * 0.067,
        mats.brass,
        pivot,
        0.015,
      );
      ball(
        0.045,
        0.045,
        0.035,
        width - 0.14,
        1.07,
        side * 0.113,
        mats.brass,
        pivot,
      );
      box(
        0.016,
        0.036,
        0.004,
        width - 0.14,
        0.975,
        side * 0.082,
        mats.dark,
        pivot,
      );
      for (const py of [0.3, 1.91])
        cylinder(0.018, 0.12, 0.015, py, side * 0.065, mats.brass, pivot);
    }
    // The casing laps onto the reveal so a narrow leaf leaves no open slot.
    for (const sx of [-width / 2 - 0.09, width / 2 + 0.09])
      box(0.19, 2.36, 0.19, sx, 1.18, 0, mats.trim, g);
    box(width + 0.38, 0.1, 0.19, 0, 2.36, 0, mats.trim, g);
    box(width + 0.43, 0.055, 0.23, 0, 2.425, 0, mats.trim, g);
    const d = {
      group: g,
      pivot,
      position: { x, z },
      open: 0,
      target: 0,
      locked,
      label,
      y,
    };
    doors.push(d);
    solid(
      x,
      z,
      Math.abs(Math.cos(rotation)) * width + 0.12,
      Math.abs(Math.sin(rotation)) * width + 0.12,
      d,
      y,
      2.35,
    );
    interactables.push({
      type: "door",
      position: new THREE.Vector3(x, y + 1.1, z),
      door: d,
      label,
    });
    return d;
  }
  for (const [x, z, rot, label] of [
    [-2.2, 9, Math.PI / 2, "LIVING ROOM"],
    [2.2, 9, -Math.PI / 2, "KITCHEN"],
    [-2.2, -1, Math.PI / 2, "STUDY"],
    [2.2, -1, -Math.PI / 2, "DINING"],
    [-2.2, -12, Math.PI / 2, "STORE"],
    [2.2, -12, -Math.PI / 2, "WASHROOM"],
    [-10, 6, Math.PI / 2, "CONSERVATORY"],
    [-10, -4, Math.PI / 2, "LIBRARY"],
    [-10, -14, Math.PI / 2, "LAUNDRY"],
    [10, 11.5, -Math.PI / 2, "PARLOUR"],
    [10, 1, -Math.PI / 2, "GALLERY"],
  ])
    door(x, z, rot, label);
  door(-2.2, -26, Math.PI / 2, "NURSERY", 3.6);
  door(2.2, -26, -Math.PI / 2, "BEDROOM", 3.6);
  door(-8.5, -29, 0, "GUEST ROOM", 3.6);
  door(8.5, -29, 0, "BATHROOM", 3.6);
  door(17.5, -22, 0, "COLD STORE", -3.6);
  const atticDoor = door(0, -29, 0, "PRIVATE / ARCHIVE", 3.6, "attic", HEAVY);
  const frontDoor = door(0, 14, Math.PI, "FRONT ENTRANCE", 0, "exit", HEAVY);
  door(16, -14, -Math.PI / 2, "CELLAR", -3.6, "basement", HEAVY);
  function fixture(x, y, z, w = 1.5, warm = false) {
    const base = floorAt(x, z) ?? 0;
    const ceiling = z > 14 ? 3.07 : base + 3.2;
    const utility = base < 0;
    const radius = utility ? 0.14 : 0.18 + w * 0.095;
    const bulbY = Math.min(y - 0.3, ceiling - 0.42);
    cylinder(radius * 0.7, 0.035, x, ceiling - 0.015, z, mats.trim);
    cylinder(radius * 0.45, 0.05, x, ceiling - 0.054, z, mats.brass);
    link([x, ceiling - 0.07, z], [x, bulbY + 0.12, z], 0.016, mats.dark);
    const glow = new THREE.MeshStandardMaterial({
      color: "#ede0c3",
      emissive: utility ? "#d7d3b9" : "#ffcf91",
      emissiveIntensity: 1.35,
    });
    cylinder(0.055, 0.11, x, bulbY + 0.14, z, mats.brass);
    if (utility) ball(0.075, 0.11, 0.075, x, bulbY, z, glow);
    else {
      // Opaque opal bowl, brass lip and central finial: attached to the plaster
      // ceiling rather than suspended at the former fluorescent coordinates.
      const bowl = mesh(
        new THREE.SphereGeometry(
          radius,
          32,
          16,
          0,
          Math.PI * 2,
          Math.PI / 2,
          Math.PI / 2,
        ),
        glow,
        x,
        bulbY + 0.07,
        z,
      );
      bowl.scale.y = 0.58;
      const lip = mesh(
        new THREE.TorusGeometry(radius, 0.012, 8, 32),
        mats.brass,
        x,
        bulbY + 0.07,
        z,
      );
      lip.rotation.x = Math.PI / 2;
      ball(0.027, 0.04, 0.027, x, bulbY - radius * 0.58, z, mats.brass);
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        link(
          [x, bulbY + 0.19, z],
          [
            x + Math.cos(angle) * radius,
            bulbY + 0.08,
            z + Math.sin(angle) * radius,
          ],
          0.008,
          mats.brass,
        );
      }
    }
    architecture.push({ type: "pendant", x, z, ceiling, base, bulbY });
    fixtures.push({
      x,
      y: bulbY - 0.15,
      z,
      color: utility ? 0xddd4bb : warm ? 0xffd09b : 0xffdfb4,
      power: utility ? 18 : 21,
      glow,
    });
  }
  for (const z of [10, 3, -5, -13]) fixture(0, 3.04, z, 1.6);
  fixture(0, 6.45, -25, 1.4);
  fixture(0, 9.8, -38, 1.2, true);
  fixture(-5, 2.95, 8, 1.1, true);
  fixture(6, 3, 8, 1.5);
  fixture(-6, 3, -2, 1.1, true);
  fixture(6, 3, -2, 1.1, true);
  fixture(6, 3, -12, 1.2);
  fixture(-6, 6.6, -24, 1, true);
  fixture(6, 6.6, -23, 1, true);
  fixture(20, -0.6, -14, 1.2);
  fixture(-6, 3, -12, 1.1);
  fixture(-14.5, 3, 9.4, 1.4, true);
  fixture(-14.5, 3, -1, 1.4);
  fixture(-14.5, 3, -12, 1.3);
  fixture(14.5, 3, 9.4, 1.4, true);
  fixture(14.5, 3, -1, 1.4);
  fixture(-6.4, 6.6, -32, 1.1, true);
  fixture(6, 6.6, -32, 1.2);
  fixture(22, -0.6, -26, 1.2);
  function cabinet(x, z, y = 0, rot = 0, hide = false) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    round(1.5, 2.25, 0.6, 0, 1.125, 0, mats.wood, g);
    for (const a of [-0.37, 0.37]) {
      round(0.7, 2.1, 0.045, a, 1.13, 0.325, mats.metal, g, 0.015);
      for (const h of [0.55, 1.6])
        round(0.55, 0.8, 0.025, a, h, 0.352, mats.wood, g, 0.01);
      cylinder(
        0.025,
        0.14,
        a + (a < 0 ? 0.22 : -0.22),
        1.14,
        0.39,
        mats.rust,
        g,
      );
    }
    for (const a of [-0.55, 0.55])
      for (const b of [-0.2, 0.2])
        cylinder(0.055, 0.2, a, 0.05, b, mats.wood, g);
    solid(
      x,
      z,
      Math.abs(Math.cos(rot)) * 1.5 + Math.abs(Math.sin(rot)) * 0.6,
      Math.abs(Math.sin(rot)) * 1.5 + Math.abs(Math.cos(rot)) * 0.6,
      undefined,
      y,
      2.25,
    );
    if (hide)
      interactables.push({
        type: "hide",
        position: new THREE.Vector3(x, y + 1.2, z),
        label: "Hide in wardrobe",
      });
    return g;
  }
  function table(x, z, w = 2.1, d = 1.1, y = 0, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    round(w, 0.12, d, 0, 0.85, 0, mats.wood, g, 0.035);
    for (const a of [-w / 2 + 0.16, w / 2 - 0.16])
      for (const b of [-d / 2 + 0.13, d / 2 - 0.13]) {
        cylinder(0.055, 0.8, a, 0.4, b, mats.wood, g, 0.04);
        ball(0.075, 0.07, 0.075, a, 0.69, b, mats.wood, g);
      }
    solid(
      x,
      z,
      Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d,
      Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d,
      undefined,
      y,
      0.92,
    );
    return g;
  }
  function chair(x, z, tableX, tableZ, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = Math.atan2(tableX - x, tableZ - z);
    chairs.push({ x, z, yaw: g.rotation.y, tableX, tableZ });
    scene.add(g);
    round(0.55, 0.1, 0.56, 0, 0.48, 0, mats.wood, g, 0.04);
    for (const a of [-0.22, 0.22])
      for (const b of [-0.22, 0.22])
        link([a, 0.05, b], [a * 0.8, 0.45, b * 0.9], 0.035, mats.wood, g);
    for (const a of [-0.23, 0.23])
      link([a, 0.45, -0.22], [a, 1.12, -0.28], 0.033, mats.wood, g);
    round(0.51, 0.1, 0.06, 0, 1.08, -0.28, mats.wood, g, 0.025);
    for (const a of [-0.14, 0, 0.14])
      link([a, 0.55, -0.22], [a, 1.05, -0.28], 0.018, mats.wood, g);
    return g;
  }
  function books(parent, x, y, z, n = 7) {
    for (let i = 0; i < n; i++) {
      const color = material(
        ["#423b2b", "#343f31", "#603d2b", "#72715c"][i % 4],
      );
      const h = 0.2 + rnd() * 0.14;
      const b = round(
        0.04 + rnd() * 0.025,
        h,
        0.18,
        x + i * 0.07,
        y + h / 2,
        z,
        color,
        parent,
        0.008,
      );
      b.rotation.z = (rnd() - 0.5) * 0.15;
      box(
        0.006,
        h - 0.03,
        0.155,
        x + i * 0.07 + 0.025,
        y + h / 2,
        z,
        mats.paper,
        parent,
      );
    }
  }
  function bookshelf(x, z, y = 0, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    box(1.75, 2.2, 0.08, 0, 1.1, -0.2, mats.wood, g);
    for (const a of [-0.85, 0.85])
      round(0.09, 2.2, 0.5, a, 1.1, 0, mats.wood, g);
    for (let i = 0; i < 5; i++) {
      round(1.7, 0.07, 0.5, 0, 0.1 + i * 0.48, 0, mats.wood, g, 0.015);
      books(g, -0.65, 0.14 + i * 0.48, 0, 6 + Math.floor(rnd() * 9));
    }
    solid(
      x,
      z,
      Math.abs(Math.cos(rot)) * 1.8 + 0.5 * Math.abs(Math.sin(rot)),
      Math.abs(Math.sin(rot)) * 1.8 + 0.5 * Math.abs(Math.cos(rot)),
      undefined,
      y,
      2.2,
    );
  }
  function lamp(x, y, z) {
    cylinder(0.18, 0.04, x, y, z, mats.dark);
    cylinder(0.023, 0.5, x, y + 0.26, z, mats.rust);
    const shade = mesh(
      new THREE.CylinderGeometry(0.17, 0.3, 0.34, 24, 1, true),
      mats.paper,
      x,
      y + 0.58,
      z,
    );
    shade.material = mats.paper.clone();
    shade.material.side = THREE.DoubleSide;
    ball(
      0.07,
      0.08,
      0.07,
      x,
      y + 0.51,
      z,
      new THREE.MeshStandardMaterial({
        color: 0xffcf8b,
        emissive: 0xffc977,
        emissiveIntensity: 2,
      }),
    );
    fixtures.push({ x, y: y + 0.4, z, color: 0xffba79, power: 8 });
  }
  function rug(x, z, w, d, y = 0) {
    const m = round(w, 0.018, d, x, y + 0.016, z, mats.rug, scene, 0.008);
    for (const a of [-1, 1])
      box(
        w - 0.15,
        0.005,
        0.045,
        x,
        y + 0.028,
        z + a * (d / 2 - 0.1),
        mats.rust,
      );
    return m;
  }
  function paper(x, y, z, text = "BLACKWOOD\nMISSING", rot = -Math.PI / 2) {
    const m = sign(text, x, y, z, 0.29, 0.4, 0, {
      bg: "#b5b297",
      fg: "#414b38",
      size: 30,
    });
    m.rotation.x = rot;
    m.rotation.z = rnd() * 0.7;
    return m;
  }
  function bottle(x, y, z) {
    cylinder(0.065, 0.25, x, y + 0.125, z, mats.glass);
    cylinder(0.025, 0.12, x, y + 0.3, z, mats.glass);
    cylinder(0.029, 0.035, x, y + 0.36, z, mats.rust);
  }
  // A group whose local +Z is the piece's front, so callers only ever say which
  // way it faces. `depth` is how far the piece reaches back from its front face.
  function furniture(x, z, y, rot) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    return g;
  }
  function footprint(x, z, w, d, y, h, rot) {
    solid(
      x,
      z,
      Math.abs(Math.cos(rot)) * w + Math.abs(Math.sin(rot)) * d,
      Math.abs(Math.sin(rot)) * w + Math.abs(Math.cos(rot)) * d,
      undefined,
      y,
      h,
    );
  }
  function armchair(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    round(0.95, 0.4, 0.88, 0, 0.42, 0, mats.fabric, g, 0.11);
    round(0.95, 0.86, 0.24, 0, 0.79, -0.38, mats.fabric, g, 0.1);
    for (const a of [-0.42, 0.42])
      round(0.24, 0.58, 0.9, a, 0.66, 0.01, mats.fabric, g, 0.1);
    round(0.68, 0.16, 0.64, 0, 0.66, 0.06, mats.fabric, g, 0.08);
    for (const a of [-0.38, 0.38])
      for (const b of [-0.32, 0.32])
        cylinder(0.05, 0.24, a, 0.11, b, mats.wood, g);
    footprint(x, z, 1.05, 1, y, 0.9, rot);
    return g;
  }
  function sideboard(x, z, rot = 0, y = 0, w = 1.7) {
    const g = furniture(x, z, y, rot);
    round(w, 0.86, 0.52, 0, 0.5, 0, mats.wood, g, 0.03);
    round(w + 0.06, 0.05, 0.58, 0, 0.95, 0, mats.wood, g, 0.02);
    for (let i = 0; i < 3; i++)
      for (const a of [-w / 4, w / 4]) {
        round(w / 2 - 0.1, 0.2, 0.03, a, 0.26 + i * 0.26, 0.27, mats.wood, g);
        cylinder(
          0.02,
          0.09,
          a,
          0.26 + i * 0.26,
          0.31,
          mats.brass,
          g,
        ).rotation.z = Math.PI / 2;
      }
    for (const a of [-w / 2 + 0.1, w / 2 - 0.1])
      for (const b of [-0.18, 0.18])
        cylinder(0.045, 0.16, a, 0.08, b, mats.wood, g);
    footprint(x, z, w, 0.58, y, 0.95, rot);
    return g;
  }
  function shelfUnit(x, z, rot = 0, y = 0, w = 1.8) {
    const g = furniture(x, z, y, rot);
    for (const a of [-w / 2 + 0.06, w / 2 - 0.06])
      for (const b of [-0.19, 0.19])
        box(0.07, 2.05, 0.07, a, 1.02, b, mats.rust, g);
    for (let i = 0; i < 4; i++) {
      round(w, 0.05, 0.46, 0, 0.28 + i * 0.55, 0, mats.metal, g, 0.012);
      box(w, 0.09, 0.03, 0, 0.34 + i * 0.55, -0.22, mats.rust, g);
    }
    footprint(x, z, w, 0.5, y, 2.05, rot);
    return g;
  }
  function crate(x, z, s = 0.7, y = 0, rot = 0) {
    const g = furniture(x, z, y, rot);
    round(s, s * 0.86, s * 0.78, 0, (s * 0.86) / 2, 0, mats.wood, g, 0.02);
    for (const b of [-1, 1])
      box(s + 0.015, 0.05, 0.05, 0, s * 0.2, (b * s * 0.78) / 2, mats.rust, g);
    box(s * 0.16, 0.01, s * 0.79, 0, s * 0.86 + 0.01, 0, mats.paper, g);
    footprint(x, z, s, s * 0.78, y, s * 0.86, rot);
    return g;
  }
  function plant(x, z, y = 0, scale = 1) {
    const g = furniture(x, z, y, rnd() * 6.28);
    cylinder(
      0.24 * scale,
      0.34 * scale,
      0,
      0.17 * scale,
      0,
      mats.rust,
      g,
      0.18 * scale,
    );
    cylinder(0.2 * scale, 0.04 * scale, 0, 0.34 * scale, 0, mats.dark, g);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + rnd(),
        lean = 0.5 + rnd() * 0.55;
      const leaf = link(
        [0, 0.34 * scale, 0],
        [
          Math.cos(a) * lean * scale,
          (0.5 + rnd() * 0.85) * scale,
          Math.sin(a) * lean * scale,
        ],
        0.02 * scale,
        mats.leaf,
        g,
      );
      leaf.scale.x = 5;
      leaf.scale.z = 1.4;
    }
    footprint(x, z, 0.5 * scale, 0.5 * scale, y, 0.4 * scale, 0);
    return g;
  }
  // A bricked hearth with a timber mantel; the flue reads as a dark recess.
  function fireplace(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    for (const a of [-0.85, 0.85])
      box(0.5, 1.5, 0.42, a, 0.75, 0, mats.wall, g);
    box(2.2, 0.42, 0.42, 0, 1.71, 0, mats.wall, g);
    box(1.2, 1.5, 0.36, 0, 0.75, -0.06, mats.black, g);
    round(2.5, 0.14, 0.56, 0, 2, 0.02, mats.wood, g, 0.03);
    box(1.34, 0.1, 0.44, 0, 1.48, 0.02, mats.rust, g);
    for (let i = 0; i < 5; i++)
      cylinder(
        0.05 + rnd() * 0.03,
        0.5,
        -0.3 + i * 0.15,
        0.22,
        0.02,
        mats.dark,
        g,
      ).rotation.set(0, rnd(), Math.PI / 2 + (rnd() - 0.5) * 0.5);
    box(1.5, 0.06, 0.5, 0, 0.03, 0.06, mats.dark, g);
    footprint(x, z, 2.5, 0.56, y, 2.05, rot);
    fixtures.push({
      x: x - Math.sin(rot) * -0.2,
      y: y + 0.45,
      z: z + Math.cos(rot) * -0.2,
      color: 0xe09a52,
      power: 6,
    });
    return g;
  }
  function pictureFrame(x, y, z, rot, text, w = 0.72, h = 0.9) {
    const g = furniture(x, z, y, rot);
    round(w, h, 0.06, 0, 0, 0, mats.wood, g, 0.015);
    round(w - 0.13, h - 0.13, 0.02, 0, 0, 0.035, mats.dark, g, 0.008);
    mesh(
      new THREE.PlaneGeometry(w - 0.17, h - 0.17),
      new THREE.MeshStandardMaterial({
        map: createHousePicture(text),
        roughness: 0.93,
      }),
      0,
      0,
      0.05,
      g,
    );
    return g;
  }
  function radiator(x, z, rot = 0, y = 0, w = 1.1) {
    const g = furniture(x, z, y, rot);
    const n = Math.round(w / 0.09);
    for (let i = 0; i < n; i++)
      round(
        0.06,
        0.62,
        0.14,
        -w / 2 + i * 0.09 + 0.045,
        0.42,
        0,
        mats.rust,
        g,
        0.02,
      );
    for (const b of [0.15, 0.69])
      cylinder(0.035, w, 0, b, 0, mats.rust, g).rotation.z = Math.PI / 2;
    cylinder(0.028, 0.24, -w / 2 + 0.02, 0.12, 0, mats.metal, g);
    footprint(x, z, w, 0.2, y, 0.75, rot);
    return g;
  }
  function tub(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    round(1.75, 0.62, 0.82, 0, 0.44, 0, mats.ivory, g, 0.14);
    round(1.55, 0.5, 0.64, 0, 0.56, 0, mats.dark, g, 0.1);
    for (const a of [-0.72, 0.72])
      for (const b of [-0.28, 0.28])
        cylinder(0.055, 0.2, a, 0.11, b, mats.brass, g, 0.09);
    link([0.78, 0.66, 0], [0.78, 0.92, 0], 0.026, mats.brass, g);
    link([0.78, 0.92, 0], [0.56, 0.92, 0], 0.026, mats.brass, g);
    for (const a of [0.66, 0.9])
      cylinder(0.018, 0.11, a, 0.72, 0, mats.brass, g);
    footprint(x, z, 1.8, 0.86, y, 0.78, rot);
    return g;
  }
  function toilet(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    round(0.4, 0.68, 0.34, 0, 0.34, -0.32, mats.ivory, g, 0.05);
    round(0.36, 0.3, 0.5, 0, 0.24, 0.06, mats.ivory, g, 0.13);
    round(0.42, 0.07, 0.52, 0, 0.42, 0.07, mats.ivory, g, 0.12);
    round(0.44, 0.05, 0.5, 0, 0.47, 0.09, mats.paper, g, 0.12);
    cylinder(0.02, 0.08, 0.16, 0.66, -0.32, mats.brass, g);
    footprint(x, z, 0.46, 0.92, y, 0.75, rot);
    return g;
  }
  function trunk(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    round(1.1, 0.5, 0.62, 0, 0.25, 0, mats.wood, g, 0.03);
    const lid = mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 1.1, 16, 1, false, 0, Math.PI),
      mats.wood,
      0,
      0.5,
      0,
      g,
    );
    lid.rotation.z = Math.PI / 2;
    for (const a of [-0.36, 0.36])
      box(0.06, 0.58, 0.67, a, 0.27, 0, mats.rust, g);
    round(0.16, 0.14, 0.05, 0, 0.44, 0.32, mats.brass, g, 0.01);
    footprint(x, z, 1.14, 0.66, y, 0.8, rot);
    return g;
  }
  // Deep glazed tub on cast legs, used in pairs along the laundry wall.
  function washTub(x, z, rot = 0, y = 0) {
    const g = furniture(x, z, y, rot);
    round(0.92, 0.6, 0.66, 0, 0.66, 0, mats.ivory, g, 0.05);
    round(0.76, 0.46, 0.5, 0, 0.78, 0, mats.dark, g, 0.03);
    for (const a of [-0.36, 0.36])
      for (const b of [-0.24, 0.24])
        box(0.07, 0.38, 0.07, a, 0.19, b, mats.rust, g);
    link([0, 0.96, -0.24], [0, 1.26, -0.24], 0.024, mats.brass, g);
    link([0, 1.26, -0.24], [0, 1.26, -0.04], 0.024, mats.brass, g);
    footprint(x, z, 0.96, 0.7, y, 1, rot);
    return g;
  }
  function windowAt(x, z, rot, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y + 1.7, z);
    g.rotation.y = rot;
    scene.add(g);
    link([-1.49, 1.12, 0.22], [1.49, 1.12, 0.22], 0.025, mats.brass, g);
    for (const side of [-1, 1]) {
      ball(0.045, 0.045, 0.045, side * 1.53, 1.12, 0.22, mats.wood, g);
      link(
        [side * 1.4, 1.12, 0],
        [side * 1.4, 1.12, 0.22],
        0.022,
        mats.brass,
        g,
      );
    }
    round(2.18, 0.065, 0.26, 0, -0.94, 0.09, mats.trim, g, 0.012);
    box(2, 1.8, 0.04, 0, 0, 0, mats.dark, g);
    const glass = new THREE.MeshStandardMaterial({
      color: "#405963",
      emissive: "#203c46",
      emissiveIntensity: 0.55,
      roughness: 0.17,
      metalness: 0.7,
    });
    box(1.78, 1.57, 0.025, 0, 0, 0.035, glass, g);
    for (const a of [-0.97, 0, 0.97])
      box(0.07, 1.86, 0.1, a, 0, 0.08, mats.wood, g);
    for (const a of [-0.88, 0, 0.88])
      box(2, 0.065, 0.1, 0, a, 0.08, mats.wood, g);
    for (let i = 0; i < 33; i++) {
      const line = link(
        [rnd() * 1.7 - 0.85, rnd() * 1.5 - 0.75, 0.1],
        [rnd() * 1.7 - 0.85, rnd() * 1.5 - 0.75, 0.1],
        0.002,
        mats.glass,
        g,
      );
      line.scale.x = 0.1;
    }
    for (const a of [-1.13, 1.13]) {
      for (let i = 0; i < 6; i++) {
        const cloth = cylinder(
          0.06,
          2,
          a + i * 0.045 * (a > 0 ? 1 : -1),
          -0.12,
          0.2,
          mats.fabric,
          g,
        );
        cloth.scale.z = 0.45;
        animated.push({ mesh: cloth, base: cloth.position.x, type: "curtain" });
      }
    }
    windows.push(glass);
    fixtures.push({
      x: x - Math.sin(rot) * 0.5,
      y: y + 1.8,
      z: z + Math.cos(rot) * 0.5,
      color: 0x7398bd,
      power: 10,
    });
  }
  // Glazing sits on the outer elevations only; the wings took over x = ±10.
  windowAt(-18.87, 9, Math.PI / 2);
  windowAt(-18.87, -1, Math.PI / 2);
  windowAt(-18.87, -12, Math.PI / 2);
  windowAt(18.87, 9, -Math.PI / 2);
  windowAt(18.87, -1, -Math.PI / 2);
  windowAt(-9.87, -22, Math.PI / 2, 3.6);
  windowAt(9.87, -23, -Math.PI / 2, 3.6);
  windowAt(-6.5, -34.87, 0, 3.6);
  windowAt(6.5, -34.87, 0, 3.6);
  // Living room: the couch stands back to the front elevation, facing the hearth.
  const couch = furniture(-6.5, 13.31, 0, Math.PI);
  round(2.9, 0.45, 1.04, 0, 0.4, 0, mats.fabric, couch, 0.13);
  round(2.9, 0.95, 0.26, 0, 0.88, -0.46, mats.fabric, couch, 0.12);
  for (const a of [-1.38, 1.38])
    round(0.3, 0.67, 1.12, a, 0.71, 0, mats.fabric, couch, 0.11);
  for (const a of [-0.86, 0, 0.86]) {
    round(0.79, 0.19, 0.78, a, 0.71, 0.08, mats.fabric, couch, 0.085);
    round(0.8, 0.6, 0.17, a, 0.98, -0.28, mats.fabric, couch, 0.08);
  }
  for (const a of [-1.15, 1.15])
    for (const b of [-0.35, 0.35])
      cylinder(0.055, 0.22, a, 0.1, b, mats.wood, couch);
  solid(-6.5, 13.31, 3, 1.2);
  rug(-6.5, 10.9, 4.2, 3.6);
  const coffee = table(-6.5, 11.4, 1.8, 0.9);
  coffee.scale.y = 0.6;
  books(coffee, -0.6, 0.93, 0, 4);
  paper(-6.3, 0.57, 11.5);
  table(-4.3, 13.55, 0.7, 0.7);
  lamp(-4.3, 0.92, 13.55);
  bookshelf(-9.65, 12, 0, Math.PI / 2);
  cabinet(-2.6, 5.6, 0, -Math.PI / 2, true);
  fireplace(-9.62, 8.6, Math.PI / 2);
  armchair(-6.9, 8.3, -Math.PI / 2);
  armchair(-6.9, 5.9, -Math.PI / 2);
  sideboard(-8.6, 4.39, 0);
  plant(-3.4, 12.6);
  radiator(-2.42, 11.4, -Math.PI / 2);
  for (const [z, text] of [
    [7.2, "BLACKWOOD\n1961"],
    [10.1, "THE ORCHARD"],
  ])
    pictureFrame(-2.34, 1.85, z, -Math.PI / 2, text);
  const radio = round(0.5, 0.24, 0.18, -6.7, 0.65, 11.2, mats.metal);
  sign("FM  88  108", -6.7, 0.7, 11.302, 0.37, 0.07, 0, { size: 20 });
  for (let i = 0; i < 8; i++)
    box(0.27, 0.008, 0.025, -6.74, 0.57 + i * 0.014, 11.31, mats.dark);
  cylinder(0.035, 0.025, -6.5, 0.63, 11.31, mats.dark).rotation.x = Math.PI / 2;
  // Study: the desk is pushed under the empty frame it belongs to.
  const desk = table(-9.35, -1, 2.8, 1.1, 0, Math.PI / 2);
  chair(-8.05, -1, -9.35, -1);
  lamp(-9.35, 0.92, -2);
  paper(-9.3, 0.925, -0.4, "MARA\n17 OCT 97");
  books(desk, -1, 0.93, 0, 6);
  bookshelf(-8.5, -5.65);
  bookshelf(-4.4, -5.65);
  cabinet(-2.6, 2.6, 0, -Math.PI / 2, true);
  sideboard(-8.7, 3.61, Math.PI, 0, 1.4);
  armchair(-5.2, -2.6, -Math.PI / 2);
  shelfUnit(-9.6, 2.4, Math.PI / 2, 0, 1.5);
  radiator(-2.42, -3.4, -Math.PI / 2);
  rug(-6.2, -1, 3.2, 4);
  sign("DO NOT TRUST\nAN EMPTY ROOM", -9.87, 1.8, 1.4, 1.1, 0.7, Math.PI / 2, {
    bg: "#b5b399",
    fg: "#494a36",
    size: 35,
  });
  // Kitchen: a run of cabinets tight against the east wall, taps, coils and sink.
  for (const z of [5.2, 6.4, 7.6]) {
    round(0.68, 0.9, 1.15, 9.56, 0.46, z, mats.metal);
    round(0.025, 0.68, 0.99, 9.2, 0.48, z, mats.wood);
    link([9.16, 0.72, z - 0.2], [9.16, 0.72, z + 0.2], 0.018, mats.rust);
    round(0.85, 0.08, 1.18, 9.47, 0.94, z, mats.ivory);
    solid(9.56, z, 0.72, 1.2);
    round(0.34, 0.62, 1.1, 9.73, 2.14, z, mats.wood);
    round(0.025, 0.5, 0.96, 9.55, 2.14, z, mats.metal);
  }
  round(0.57, 0.05, 0.74, 9.43, 0.99, 6.4, mats.dark);
  round(0.46, 0.025, 0.63, 9.42, 1.015, 6.4, mats.metal);
  link([9.71, 1, 6.7], [9.71, 1.35, 6.7], 0.025, mats.metal);
  link([9.71, 1.35, 6.7], [9.41, 1.35, 6.7], 0.025, mats.metal);
  for (const z of [5, 5.5])
    for (const x of [9.29, 9.71]) {
      const coil = mesh(
        new THREE.TorusGeometry(0.14, 0.023, 7, 20),
        mats.dark,
        x,
        1.0,
        z,
      );
      coil.rotation.x = Math.PI / 2;
    }
  // Enamel refrigerator in the corner.
  round(0.86, 1.72, 0.74, 9.45, 0.86, 12.9, mats.ivory);
  round(0.05, 1.5, 0.62, 9, 0.94, 12.9, mats.metal);
  cylinder(0.03, 0.42, 8.97, 1.2, 12.62, mats.brass).rotation.z = Math.PI / 2;
  solid(9.45, 12.9, 0.9, 0.78, undefined, 0, 1.72);
  cabinet(8, 13.6, 0, Math.PI);
  const kt = table(5.7, 10, 1.6, 1.2);
  chair(5.7, 11.1, 5.7, 10);
  chair(4.4, 10, 5.7, 10);
  chair(5.7, 8.9, 5.7, 10);
  chair(7, 10, 5.7, 10);
  bottle(5.4, 0.93, 10);
  paper(6, 0.925, 10.2, "FILM\nKEEP DRY");
  radiator(2.42, 6.6, Math.PI / 2);
  shelfUnit(2.55, 12.9, Math.PI / 2, 0, 1.6);
  // Dining room: table in the middle, storage on the walls.
  table(6, -1, 3, 1.5);
  rug(6, -1, 4.2, 3);
  for (const x of [5, 6.7]) {
    chair(x, 0.3, x, -1);
    chair(x, -2.3, x, -1);
  }
  for (const x of [5, 6, 7]) {
    cylinder(0.2, 0.025, x, 0.94, -1, mats.ivory);
    bottle(x, 0.96, -1.5);
  }
  bookshelf(9.65, -3.6, 0, -Math.PI / 2);
  cabinet(2.6, -4.4, 0, Math.PI / 2, true);
  sideboard(8.4, 3.61, Math.PI);
  for (const x of [8.05, 8.75])
    cylinder(0.035, 0.3, x, 1.1, 3.61, mats.brass, scene, 0.05);
  pictureFrame(2.34, 1.85, -3, Math.PI / 2, "THE LONG TABLE", 0.8, 0.62);
  plant(9.5, 2);
  // Storage: shelving and stacked crates.
  shelfUnit(-9.6, -12.2, Math.PI / 2);
  shelfUnit(-2.55, -8.4, -Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const x = -8.6 + rnd() * 3.4,
      z = -16.4 + rnd() * 3.2,
      s = 0.45 + rnd() * 0.5;
    round(s, s, s, x, s / 2, z, mats.wood);
    box(s * 0.15, 0.01, s + 0.01, x, s + 0.01, z, mats.paper);
    solid(x, z, s, s);
  }
  crate(-4.6, -11.4, 0.8, 0, 0.3);
  crate(-4.4, -12.6, 0.62);
  bookshelf(-9.65, -7.6, 0, Math.PI / 2);
  cabinet(-2.6, -15.6, 0, -Math.PI / 2, true);
  // Washroom: basin and mirror set flush to the rear wall, tub and WC opposite.
  round(1.65, 0.22, 0.7, 7, 0.86, -16.55, mats.ivory, scene, 0.11);
  ball(0.6, 0.08, 0.24, 7, 0.99, -16.52, mats.dark);
  cylinder(0.13, 0.7, 7, 0.37, -16.55, mats.ivory);
  link([7.55, 1, -16.78], [7.55, 1.28, -16.78], 0.026, mats.metal);
  link([7.55, 1.28, -16.78], [7.3, 1.28, -16.78], 0.026, mats.metal);
  round(1.7, 1.25, 0.06, 7, 1.95, -16.87, mats.rust);
  round(1.56, 1.12, 0.015, 7, 1.95, -16.83, mats.glass);
  solid(7, -16.55, 1.7, 0.7);
  tub(2.73, -15.9, Math.PI / 2);
  toilet(4.6, -16.4, 0);
  cabinet(9.6, -8.1, 0, -Math.PI / 2, true);
  radiator(9.83, -10.6, -Math.PI / 2);
  shelfUnit(2.55, -7.1, Math.PI / 2, 0, 1.5);
  // Bedroom bedframes, folded covers, pillows and toys.
  function bed(x, z, y, child = false) {
    const w = child ? 1.35 : 2;
    round(w, 0.24, 2.3, x, y + 0.43, z, mats.ivory, scene, 0.13);
    round(w + 0.1, 0.7, 0.12, x, y + 0.7, z - 1.2, mats.wood);
    round(w + 0.1, 0.35, 0.12, x, y + 0.45, z + 1.2, mats.wood);
    round(w - 0.03, 0.12, 1.55, x, y + 0.59, z + 0.3, mats.fabric, scene, 0.05);
    for (const a of [-w / 2 + 0.12, w / 2 - 0.12])
      for (const b of [-1, 1])
        cylinder(0.05, 0.35, x + a, y + 0.18, z + b, mats.wood);
    round(w * 0.65, 0.15, 0.45, x, y + 0.63, z - 0.78, mats.paper, scene, 0.1);
    for (let i = 0; i < 12; i++)
      box(w - 0.1, 0.007, 0.008, x, y + 0.655, z - 0.4 + i * 0.11, mats.dark);
    solid(x, z, w + 0.1, 2.4);
  }
  // Nursery: the child's bed headboard meets the rear wall.
  bed(-7, -27.64, 3.6, true);
  table(-9.55, -27.9, 0.7, 0.7, 3.6);
  lamp(-9.55, 4.52, -27.9);
  cabinet(-4.5, -18.4, 3.6, Math.PI, true);
  rug(-6.4, -24, 3, 3, 3.6);
  ball(0.11, 0.13, 0.1, -5, 3.89, -22, mats.wood);
  ball(0.14, 0.17, 0.09, -5, 3.71, -22, mats.wood);
  for (const a of [-0.1, 0.1])
    ball(0.06, 0.06, 0.04, -5 + a, 3.99, -22, mats.wood);
  trunk(-9.57, -20.6, Math.PI / 2, 3.6);
  shelfUnit(-7.5, -18.35, Math.PI, 3.6, 1.4);
  radiator(-2.42, -20.4, -Math.PI / 2, 3.6);
  sign("ME + MUM\n+ THE TALL MAN", -9.87, 4.95, -26.4, 0.7, 0.6, Math.PI / 2, {
    bg: "#b4b599",
    fg: "#3f4c34",
    size: 28,
  });
  // Master bedroom.
  bed(5, -27.64, 3.6);
  cabinet(4.5, -18.4, 3.6, Math.PI, true);
  table(6.9, -28.4, 0.8, 0.8, 3.6);
  lamp(6.9, 4.52, -28.4);
  table(3.1, -28.4, 0.8, 0.8, 3.6);
  bookshelf(9.65, -20, 3.6, -Math.PI / 2);
  sideboard(9.61, -26.5, -Math.PI / 2, 3.6, 1.6);
  round(0.06, 1.35, 1.1, 9.85, 5.65, -26.5, mats.rust);
  round(0.015, 1.22, 0.98, 9.81, 5.65, -26.5, mats.glass);
  armchair(3.1, -21.4, 0, 3.6);
  radiator(2.42, -26.6, Math.PI / 2, 3.6);
  // Attic rafters and archive.
  for (const z of [-36, -39, -42]) {
    link([-5.8, 9.35, z], [0, 10.05, z], 0.12, mats.wood);
    link([0, 10.05, z], [5.8, 9.35, z], 0.12, mats.wood);
  }
  table(0, -41.7, 2.8, 0.8, 6.8);
  cabinet(-5.6, -40, 6.8, Math.PI / 2);
  cabinet(5.6, -40, 6.8, -Math.PI / 2);
  for (const x of [-4, 4]) {
    round(1, 0.7, 0.8, x, 7.15, -37, mats.wood);
    solid(x, -37, 1, 0.8, undefined, 6.8, 0.7);
  }
  trunk(-3.9, -42.59, 0, 6.8);
  trunk(3.9, -42.59, 0, 6.8);
  for (const [x, z, s] of [
    [-2.6, -37.4, 0.66],
    [2.5, -37.6, 0.78],
    [4.8, -41.2, 0.6],
  ])
    crate(x, z, s, 6.8, rnd());
  shelfUnit(-5.55, -36.6, Math.PI / 2, 6.8, 1.4);
  paper(0.5, 7.72, -41.7, "I REMEMBER\nTHE CAMERA");
  // Boiler and workshop occupy the lower chamber's outer edge.
  cylinder(0.7, 2.1, 27.2, -2.45, -9, mats.metal);
  for (const yy of [-3.3, -1.6]) {
    const ring = mesh(
      new THREE.TorusGeometry(0.71, 0.045, 6, 24),
      mats.rust,
      27.2,
      yy,
      -9,
    );
    ring.rotation.x = Math.PI / 2;
  }
  link([27.2, -1.4, -9], [27.2, -0.5, -9], 0.17, mats.metal);
  link([27.2, -0.5, -9], [27.2, -0.5, -11.6], 0.17, mats.metal);
  solid(27.2, -9, 1.4, 1.4);
  table(27.45, -20, 2.4, 0.85, -3.6, Math.PI / 2);
  bottle(27.3, -2.65, -20);
  cabinet(16.4, -7, -3.6, Math.PI / 2, true);
  shelfUnit(16.35, -11, Math.PI / 2, -3.6);
  crate(18.6, -19.6, 0.75, -3.6, 0.4);
  crate(18.4, -18.4, 0.6, -3.6);
  // West wing — conservatory.
  table(-14.5, 9.4, 2.4, 1.1);
  for (const x of [-15.5, -13.5]) {
    chair(x, 10.6, x, 9.4);
    chair(x, 8.2, x, 9.4);
  }
  for (const [x, z, s] of [
    [-11.2, 13, 1.15],
    [-17.6, 13.1, 0.95],
    [-11.4, 5.4, 1],
    [-17.4, 6.2, 1.1],
  ])
    plant(x, z, 0, s);
  sideboard(-14.5, 13.61, Math.PI);
  bottle(-14.9, 0.99, 13.5);
  armchair(-17.2, 9.6, Math.PI / 2);
  radiator(-18.83, 12.4, Math.PI / 2);
  rug(-14.5, 9.4, 3.6, 3);
  pictureFrame(-10.13, 1.85, 11.4, -Math.PI / 2, "THE GLASSHOUSE", 0.85, 0.66);
  // West wing — library.
  for (const [x, z, rot] of [
    [-11.5, 3.65, Math.PI],
    [-17.5, 3.65, Math.PI],
    [-11.5, -5.65, 0],
    [-17.5, -5.65, 0],
    [-18.65, -3.6, Math.PI / 2],
    [-18.65, 1.6, Math.PI / 2],
  ])
    bookshelf(x, z, 0, rot);
  const reading = table(-14.5, -1, 2.2, 1.2);
  books(reading, -0.8, 0.93, 0, 7);
  lamp(-13.6, 0.92, -1);
  chair(-14.5, 0.3, -14.5, -1);
  chair(-14.5, -2.3, -14.5, -1);
  armchair(-11.6, -1.4, -Math.PI / 2);
  rug(-14.5, -1, 4, 3.4);
  paper(-15.2, 0.925, -0.7, "17 OCT\nDO NOT LOOK");
  // West wing — laundry.
  for (const x of [-12.2, -13.3, -14.4]) washTub(x, -16.55, 0);
  shelfUnit(-18.65, -8.6, Math.PI / 2, 0, 1.7);
  shelfUnit(-18.65, -14.6, Math.PI / 2, 0, 1.7);
  cabinet(-10.4, -12.4, 0, -Math.PI / 2, true);
  crate(-16.6, -7.2, 0.7);
  radiator(-11.5, -6.17, Math.PI);
  for (let i = 0; i < 4; i++)
    link(
      [-18.5, 2.5, -13.4 + i * 1.7],
      [-10.5, 2.5, -13.4 + i * 1.7],
      0.012,
      mats.rust,
    );
  // East wing — parlour.
  fireplace(14.5, 13.62, Math.PI);
  armchair(13.4, 12.2, 0);
  armchair(15.6, 12.2, 0);
  rug(14.5, 10.9, 4.2, 3.4);
  const parlourTable = table(14.5, 10.9, 1.6, 0.9);
  parlourTable.scale.y = 0.6;
  books(parlourTable, -0.5, 0.93, 0, 3);
  sideboard(18.61, 6.4, -Math.PI / 2, 0, 1.8);
  plant(11, 13);
  plant(18.2, 12.8);
  radiator(10.17, 8, Math.PI / 2);
  pictureFrame(10.13, 1.85, 6.2, Math.PI / 2, "BLACKWOOD HOUSE", 0.9, 0.7);
  // East wing — gallery of the family's own photographs.
  for (const [z, text] of [
    [-4.6, "I / THE ORCHARD"],
    [-2.4, "II / THE STAIR"],
    [2.2, "III / THE LANDING"],
  ])
    pictureFrame(10.13, 1.85, z, Math.PI / 2, text);
  for (const [z, text] of [
    [-4.6, "IV / THE CELLAR"],
    [2.2, "V / NO FACE AT ALL"],
  ])
    pictureFrame(18.87, 1.85, z, -Math.PI / 2, text);
  for (const [x, z, bust] of [
    [13, -3.6, true],
    [16, -3.6, false],
    [13, 1.6, false],
    [16, 1.6, true],
  ]) {
    round(0.5, 1.05, 0.5, x, 0.52, z, mats.wall);
    round(0.62, 0.06, 0.62, x, 1.07, z, mats.dark);
    solid(x, z, 0.62, 0.62, undefined, 0, 1.1);
    if (bust) {
      ball(0.15, 0.2, 0.15, x, 1.3, z, mats.ivory);
      ball(0.11, 0.09, 0.11, x, 1.15, z, mats.ivory);
    } else round(0.34, 0.26, 0.22, x, 1.23, z, mats.rust, scene, 0.03);
  }
  round(1.6, 0.12, 0.5, 14.5, 0.46, -1, mats.wood);
  for (const a of [-0.6, 0.6])
    box(0.12, 0.4, 0.44, 14.5 + a, 0.2, -1, mats.wood);
  solid(14.5, -1, 1.7, 0.55, undefined, 0, 0.55);
  plant(18.3, -5.2, 0, 1.1);
  // Upper floor — guest room.
  bed(-8.6, -33.64, 3.6);
  table(-6.9, -34.55, 0.7, 0.7, 3.6);
  lamp(-6.9, 4.52, -34.55);
  cabinet(-2.6, -32.4, 3.6, -Math.PI / 2, true);
  armchair(-4.4, -32.2, 0, 3.6);
  sideboard(-4.6, -29.39, Math.PI, 3.6, 1.5);
  rug(-6.6, -31.6, 3, 2.6, 3.6);
  radiator(-3.2, -34.73, 0, 3.6);
  // Upper floor — bathroom.
  tub(2.73, -31.6, Math.PI / 2, 3.6);
  round(1.2, 0.2, 0.6, 8.5, 4.46, -34.6, mats.ivory, scene, 0.09);
  ball(0.44, 0.07, 0.2, 8.5, 4.58, -34.58, mats.dark);
  cylinder(0.12, 0.62, 8.5, 4.01, -34.6, mats.ivory);
  link([8.5, 4.58, -34.82], [8.5, 4.84, -34.82], 0.024, mats.brass);
  link([8.5, 4.84, -34.82], [8.5, 4.84, -34.62], 0.024, mats.brass);
  round(1.05, 1.15, 0.06, 8.5, 5.5, -34.87, mats.rust);
  round(0.93, 1.03, 0.015, 8.5, 5.5, -34.83, mats.glass);
  solid(8.5, -34.6, 1.25, 0.62, undefined, 3.6, 1.1);
  toilet(9.41, -32.6, -Math.PI / 2, 3.6);
  cabinet(2.6, -33.6, 3.6, Math.PI / 2, true);
  shelfUnit(4.5, -29.35, Math.PI, 3.6, 1.4);
  radiator(6, -29.17, Math.PI, 3.6);
  // Cellar — cold store behind the ritual chamber.
  for (const z of [-24, -26, -28]) {
    shelfUnit(16.35, z, Math.PI / 2, -3.6);
    shelfUnit(27.65, z, -Math.PI / 2, -3.6);
  }
  for (const [x, z, s] of [
    [20, -28.6, 0.85],
    [21.4, -28.4, 0.7],
    [24.6, -28.8, 0.9],
    [19.4, -24.2, 0.75],
  ])
    crate(x, z, s, -3.6, rnd());
  cabinet(22, -29.6, -3.6, 0, true);
  table(25.5, -25, 2.2, 0.9, -3.6);
  link([19, -0.7, -26], [26, -0.7, -26], 0.035, mats.metal);
  for (let i = 0; i < 7; i++) {
    const hx = 19.4 + i;
    link([hx, -0.72, -26], [hx, -1.24, -26], 0.018, mats.metal);
    const hook = mesh(
      new THREE.TorusGeometry(0.09, 0.017, 6, 14),
      mats.metal,
      hx,
      -1.3,
      -26,
    );
    hook.rotation.y = Math.PI / 2;
  }
  // Circular ritual seal is a drawn world surface, never a navigation overlay.
  const seal = document.createElement("canvas");
  seal.width = seal.height = 1024;
  const sc = seal.getContext("2d");
  sc.translate(512, 512);
  sc.strokeStyle = "#918267";
  sc.lineWidth = 4;
  for (const r of [320, 355, 390]) {
    sc.beginPath();
    sc.arc(0, 0, r, 0, Math.PI * 2);
    sc.stroke();
  }
  sc.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = (i * Math.PI * 4) / 5 - Math.PI / 2;
    sc.lineTo(Math.cos(a) * 320, Math.sin(a) * 320);
  }
  sc.stroke();
  sc.font = "44px serif";
  sc.fillStyle = "#918267";
  for (let i = 0; i < 12; i++) {
    sc.save();
    sc.rotate((i * Math.PI) / 6);
    sc.fillText(["I", "III", "IV", "II"][i % 4], -20, -360);
    sc.restore();
  }
  const sealTex = new THREE.CanvasTexture(seal);
  const sealMesh = mesh(
    new THREE.PlaneGeometry(5.4, 5.4),
    new THREE.MeshStandardMaterial({
      map: sealTex,
      transparent: true,
      roughness: 1,
    }),
    22,
    -3.585,
    -15,
  );
  sealMesh.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const x = 19.75 + i * 1.5,
      z = -21.84;
    round(1.05, 1.25, 0.13, x, -1.95, z, mats.wood);
    round(0.84, 1.04, 0.025, x, -1.95, z + 0.08, mats.dark);
    sign(["I", "II", "III", "IV"][i], x, -2.83, z + 0.04, 0.4, 0.25, 0, {
      size: 50,
      bg: "#19271e",
    });
    const position = new THREE.Vector3(x, -1.95, z + 0.1);
    frames.push({ position, mesh: null });
    interactables.push({
      type: "frame",
      index: i,
      position,
      label: `Ritual frame ${i + 1}`,
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2,
      x = 22 + Math.sin(a) * 2.5,
      z = -15 + Math.cos(a) * 2.5;
    const h = 0.16 + rnd() * 0.19;
    cylinder(0.045, h, x, -3.6 + h / 2, z, mats.paper);
    const flame = ball(
      0.018,
      0.06,
      0.018,
      x,
      -3.55 + h,
      z,
      new THREE.MeshBasicMaterial({ color: 0xffc371 }),
    );
    animated.push({ mesh: flame, type: "flame", base: flame.position.y });
  }
  fixtures.push({ x: 22, y: -2.7, z: -15, color: 0xeaae66, power: 15 });
  interactables.push({
    type: "ritual",
    position: new THREE.Vector3(22, -2.6, -15),
    label: "Complete the ritual",
  });
  // A family entrance hall: furnishings hug the solid wall stretches, leaving
  // the central escape route, every door and Mara's original note accessible.
  for (const [z, length] of [
    [8.5, 7.5],
    [-1.5, 8.5],
    [-11.4, 7],
  ])
    rug(0, z, 1.72, length);
  sideboard(-1.79, 6, Math.PI / 2, 0, 1.45);
  lamp(-1.79, 0.98, 6.35);
  const letters = paper(-1.68, 0.99, 5.75, "MARA\nBLACKWOOD HOUSE");
  letters.rotation.z = 0.15;
  pictureFrame(-2.055, 1.95, 5.8, Math.PI / 2, "THE ORCHARD · 1961", 1.05, 0.8);
  pictureFrame(
    2.055,
    1.94,
    5.6,
    -Math.PI / 2,
    "SUMMER AT BLACKWOOD",
    0.82,
    1.02,
  );
  pictureFrame(-2.055, 1.92, -5.4, Math.PI / 2, "THE OLD GARDEN", 0.88, 0.7);
  pictureFrame(
    2.055,
    1.94,
    -6,
    -Math.PI / 2,
    "THE ORCHARD IN OCTOBER",
    0.75,
    0.95,
  );
  pictureFrame(-2.055, 1.92, 12.2, Math.PI / 2, "HOME · 1961", 0.65, 0.82);
  const bench = furniture(1.78, 3.2, 0, -Math.PI / 2);
  round(1.38, 0.12, 0.43, 0, 0.49, 0, mats.joinery, bench, 0.03);
  round(1.18, 0.09, 0.37, 0, 0.58, 0, mats.fabric, bench, 0.045);
  for (const a of [-0.55, 0.55])
    for (const b of [-0.14, 0.14])
      cylinder(0.035, 0.45, a, 0.24, b, mats.joinery, bench);
  footprint(1.78, 3.2, 1.38, 0.43, 0, 0.63, -Math.PI / 2);
  const hooks = furniture(2.045, 12, 1.7, -Math.PI / 2);
  round(0.88, 0.15, 0.07, 0, 0, 0, mats.joinery, hooks, 0.012);
  for (const a of [-0.3, 0, 0.3]) {
    link([a, -0.025, 0.05], [a, 0.02, 0.16], 0.018, mats.brass, hooks);
    ball(0.025, 0.025, 0.025, a, 0.025, 0.16, mats.brass, hooks);
  }
  // A stopped pendulum clock, replacing the hall's utility box.
  const clock = furniture(-2.015, 2.4, 1.92, Math.PI / 2);
  round(0.44, 0.83, 0.16, 0, 0, 0, mats.joinery, clock, 0.035);
  round(0.25, 0.27, 0.01, 0, -0.22, 0.087, mats.dark, clock, 0.02);
  link([0, -0.09, 0.098], [0, -0.27, 0.098], 0.012, mats.brass, clock);
  ball(0.065, 0.065, 0.012, 0, -0.28, 0.103, mats.brass, clock);
  const dial = cylinder(0.185, 0.012, 0, 0.16, 0.092, mats.ivory, clock);
  dial.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tick = box(
      0.009,
      0.025,
      0.005,
      Math.sin(a) * 0.155,
      0.16 + Math.cos(a) * 0.155,
      0.102,
      mats.dark,
      clock,
    );
    tick.rotation.z = -a;
  }
  link([0, 0.16, 0.108], [0.09, 0.2, 0.108], 0.009, mats.dark, clock);
  link([0, 0.16, 0.11], [-0.04, 0.29, 0.11], 0.006, mats.dark, clock);
  sign("CELLAR →", 9.86, 1.7, -11.5, 1, 0.35, -Math.PI / 2, { size: 40 });
  for (const z of [-8, 1]) {
    round(0.12, 0.22, 0.04, 2.06, 1.3, z, mats.ivory);
    interactables.push({
      type: "switch",
      position: new THREE.Vector3(2.02, 1.3, z),
      label: "Light switch",
    });
  }
  for (let i = 0; i < 22; i++) {
    const x = (rnd() - 0.5) * 3.9,
      z = -16 + rnd() * 29,
      y = 0.004;
    const p = mesh(
      new THREE.CircleGeometry(0.05 + rnd() * 0.35, 48),
      new THREE.MeshStandardMaterial({
        color: "#30251d",
        roughness: 0.88,
        metalness: 0,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
      x,
      y,
      z,
    );
    p.rotation.x = -Math.PI / 2;
    const edge = p.geometry.attributes.position;
    for (let j = 1; j < edge.count; j++) {
      const angle = Math.atan2(edge.getY(j), edge.getX(j));
      const irregular =
        1 + Math.sin(angle * 5 + i) * 0.1 + Math.cos(angle * 9) * 0.04;
      edge.setXY(j, edge.getX(j) * irregular, edge.getY(j) * irregular);
    }
    p.scale.y = 0.4 + rnd();
  }
  for (let i = 0; i < 8; i++) {
    const x = (rnd() - 0.5) * 3.5,
      z = -15 + rnd() * 27;
    paper(x, 0.014, z, i % 2 ? "17 OCT\nDO NOT LOOK" : "BLACKWOOD\nMISSING");
  }
  const note = sign(
    "MARA —\nThe study. The mirror.\nThe nursery. The attic.\nFour photographs.\nBring them downstairs.",
    -2.065,
    1.55,
    10.6,
    0.7,
    0.92,
    Math.PI / 2,
    { bg: "#b7b398", fg: "#35422e", size: 24 },
  );
  interactables.push({
    type: "note",
    position: note.position.clone(),
    label: "Read Mara’s note",
    title: "A NOTE IN YOUR HANDWRITING",
    text: "The study. The mirror. The nursery. The attic. Four photographs. Bring them downstairs. If you hear breathing, turn off the light and hide. — Mara",
  });
  // Supplies vary within safe rooms. An emergency cache prevents a film softlock.
  const supplies = [
    [-4.3, 0.96, 13.55],
    [-9.35, 0.97, -1.1],
    [5.7, 0.97, 10.3],
    [6.9, 4.57, -28.4],
    [27.4, -2.63, -20.6],
    [-14.5, 0.97, -0.6],
    [14.5, 0.57, -1],
  ];
  for (let i = 0; i < supplies.length; i++) {
    const [x, y, z] = supplies[i],
      g = round(0.22, 0.08, 0.28, x, y, z, mats.paper);
    const label = sign("600\n4 EXP", x, y + 0.045, z, 0.2, 0.24, 0, {
      bg: "#b7b39a",
      fg: "#404b35",
      size: 47,
    });
    label.rotation.x = -Math.PI / 2;
    g.userData.label = label;
    interactables.push({
      type: "film",
      id: `film${i}`,
      position: new THREE.Vector3(x, y, z),
      mesh: g,
      label: "Take film · +4 exposures",
    });
  }
  const reserve = round(0.36, 0.22, 0.3, 0.75, 0.2, 13.5, mats.metal);
  interactables.push({
    type: "reserve",
    position: reserve.position,
    label: "Emergency film tin",
  });
  const key = mesh(
    new THREE.TorusGeometry(0.045, 0.012, 7, 16),
    mats.rust,
    7,
    0.22,
    -16.1,
  );
  key.rotation.x = Math.PI / 2;
  link([7, 0.22, -16.1], [7.17, 0.22, -16.1], 0.015, mats.rust);
  interactables.push({
    type: "key",
    position: key.position.clone(),
    mesh: key,
    label: "Take the brass cellar key",
  });
  const apparition = (kind) => createFigure(scene, mats, kind);
  const observer = apparition();
  observer.visible = false;
  const child = apparition("child");
  child.position.set(-6.1, 3.6, -27.1);
  child.visible = false;
  photoOnly.push(child);
  const woman = apparition("woman");
  woman.position.set(7, 0.72, -16.78);
  woman.scale.setScalar(0.7);
  woman.visible = false;
  photoOnly.push(woman);
  const falseObserver = apparition();
  falseObserver.position.set(0.4, 0, -15);
  falseObserver.visible = false;
  photoOnly.push(falseObserver);
  const crawler = apparition();
  crawler.scale.set(0.55, 0.38, 0.55);
  crawler.rotation.x = -0.6;
  crawler.position.set(-6.5, 0.13, 12.5);
  crawler.visible = false;
  photoOnly.push(crawler);
  // Photo-only writing is rendered in the same camera projection as the actual photograph.
  const writing = sign("I REMEMBER", -9.68, 1.7, -1, 1.1, 0.8, Math.PI / 2, {
    bg: "#13271b",
    fg: "#d0dbb7",
    size: 43,
  });
  writing.visible = false;
  photoOnly.push(writing);
  round(0.08, 1.05, 1.5, -9.81, 1.7, -1, mats.wood);
  box(0.1, 0.88, 1.31, -9.75, 1.7, -1, mats.dark);
  const family = sign("MARA\nSTILL HERE", 0, 8.2, -42.76, 1.5, 1.4, 0, {
    bg: "#223329",
    fg: "#9ead90",
    size: 39,
  });
  round(1.68, 1.6, 0.08, 0, 8.2, -42.83, mats.wood);
  const familyGhost = apparition("woman");
  familyGhost.position.set(0.1, 6.95, -42.35);
  familyGhost.scale.setScalar(0.77);
  familyGhost.visible = false;
  photoOnly.push(familyGhost);
  for (const def of evidenceDefs) {
    interactables.push({
      type: "evidence",
      id: def.id,
      position: new THREE.Vector3(def.x, def.y, def.z),
      label: def.look,
    });
  }
  const dustCount = 150,
    positions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    positions[i * 3] = (rnd() - 0.5) * 4;
    positions[i * 3 + 1] = rnd() * 3;
    positions[i * 3 + 2] = -17 + rnd() * 31;
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const dust = new THREE.Points(
    dg,
    new THREE.PointsMaterial({
      color: 0xc7d1b2,
      size: 0.018,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const makeCamera = (parent) => sharedCamera(parent, mats);
  // The wings added rooms without adding lamps, so a few more live sources
  // follow the player around the larger plan.
  const LIVE_LIGHTS = 6,
    lights = [];
  for (let i = 0; i < LIVE_LIGHTS; i++) {
    const l = new THREE.PointLight(0xffd4a4, 0, 12, 2);
    scene.add(l);
    lights.push(l);
  }
  const ambient = new THREE.HemisphereLight(0xa1a5ac, 0x302319, 0.52);
  scene.add(ambient);

  // The front entrance opens onto a covered porch and wet ground beneath bare trees.
  box(9, 0.16, 3.5, 0, 3.15, 15.7, mats.wood);
  for (const x of [-4.2, 4.2]) {
    cylinder(0.09, 3.1, x, 1.55, 17, mats.wood);
    link([x, 2.5, 17], [x * 0.75, 3.1, 17], 0.065, mats.wood);
  }
  box(45, 0.1, 26, 0, -0.2, 24, mats.dark);
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1,
      x = side * (7 + rnd() * 13),
      z = 15 + rnd() * 19,
      h = 5 + rnd() * 5;
    cylinder(0.12, h, x, h / 2, z, mats.dark, scene, 0.06);
    for (let j = 0; j < 5; j++) {
      const y = h * (0.3 + j * 0.12),
        a = rnd() * 6.28;
      link(
        [x, y, z],
        [x + Math.cos(a) * (1.2 + rnd()), y + 1.4, z + Math.sin(a) * 1.8],
        0.035,
        mats.dark,
      );
    }
  }
  fixture(0, 2.65, 14.6, 0.65, true);
  const rainPos = new Float32Array(500 * 6);
  for (let i = 0; i < 500; i++) {
    const x = (rnd() - 0.5) * 25,
      y = rnd() * 10,
      z = 14 + rnd() * 20;
    rainPos.set([x, y, z, x - 0.05, y - 0.3, z + 0.015], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({
      color: 0x719589,
      transparent: true,
      opacity: 0.24,
    }),
  );
  scene.add(rain);
  const selfPortrait = apparition("human");
  selfPortrait.visible = false;
  selfPortrait.scale.set(0.95, 0.88, 0.95);
  // Batch immovable details by material and spatial cell, preserving frustum culling.
  scene.updateMatrixWorld(true);
  const dynamic = new Set([
    observer,
    selfPortrait,
    ...photoOnly,
    ...doors.map((d) => d.group),
    ...animated.map((a) => a.mesh),
    ...interactables.filter((i) => i.mesh).map((i) => i.mesh),
    ...interactables
      .filter((i) => i.mesh?.userData.label)
      .map((i) => i.mesh.userData.label),
  ]);
  const batches = new Map(),
    staticMeshes = [];
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    let p = obj;
    while (p) {
      if (dynamic.has(p)) return;
      p = p.parent;
    }
    const pos = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld),
      key = `${obj.material.uuid}/${Math.floor(pos.x / 12)}/${Math.floor(pos.z / 12)}/${Math.floor(pos.y / 4)}`;
    if (!batches.has(key))
      batches.set(key, { mat: obj.material, geometries: [] });
    const geometry = obj.geometry.index
      ? obj.geometry.toNonIndexed()
      : obj.geometry.clone();
    geometry.applyMatrix4(obj.matrixWorld);
    batches.get(key).geometries.push(geometry);
    staticMeshes.push(obj);
  });
  for (const obj of staticMeshes) obj.removeFromParent();
  for (const { mat, geometries } of batches.values()) {
    const merged = mergeGeometries(geometries, false);
    if (merged) {
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = true;
      m.receiveShadow = true;
      scene.add(m);
    }
    for (const g of geometries) g.dispose();
  }
  nightEnvironment(scene, {
    centre: [0, 20],
    radius: 25,
    count: 42,
    arc: Math.PI,
  });
  let lightClock = 0,
    nearestLights = [];
  return {
    solids,
    architecture,
    chairs,
    doors,
    interactables,
    fixtures,
    selfPortrait,
    rain,
    photoOnly,
    animated,
    windows,
    frames,
    observer,
    dust,
    lights,
    ambient,
    makeCamera,
    textTexture,
    mats,
    sign,
    setCode(code) {
      writing.material.map?.dispose();
      writing.material.map = textTexture(`I REMEMBER\n${code}`, {
        bg: "#1d2c20",
        fg: "#d5ddb5",
        size: 55,
      });
    },
    update(dt, t, position, power, storm) {
      updateObserverAnimation(observer, dt, t, position, floorAt);
      rain.position.y = -((t * 6) % 3);
      for (const d of doors) {
        d.open = THREE.MathUtils.damp(d.open, d.target, 5, dt);
        d.pivot.rotation.y = -d.open * Math.PI * 0.49;
      }
      lightClock -= dt;
      if (lightClock <= 0 || !nearestLights.length) {
        lightClock = 0.2;
        nearestLights = [...fixtures]
          .sort(
            (a, b) =>
              (a.x - position.x) ** 2 +
              (a.y - position.y) ** 2 +
              (a.z - position.z) ** 2 -
              ((b.x - position.x) ** 2 +
                (b.y - position.y) ** 2 +
                (b.z - position.z) ** 2),
          )
          .slice(0, LIVE_LIGHTS);
      }
      for (let i = 0; i < LIVE_LIGHTS; i++) {
        const f = nearestLights[i],
          l = lights[i];
        if (!f) continue;
        l.position.set(f.x, f.y, f.z);
        l.color.setHex(f.color);
        const faulty = Math.sin(t * 0.63 + f.x * 2 + f.z) > 0.992;
        const flicker = faulty && Math.sin(t * 43) > 0 ? 0.65 : 1;
        l.intensity = f.power * (power ? flicker : 0.025);
        if (f.glow) f.glow.emissiveIntensity = power ? 1.35 * flicker : 0.08;
      }
      ambient.intensity = 0.28 + storm * 0.65;
      for (const w of windows) w.emissiveIntensity = 0.6 + storm * 4;
      for (const a of animated) {
        if (a.type === "curtain")
          a.mesh.position.x = a.base + Math.sin(t * 1.1 + a.base) * 0.018;
        else a.mesh.scale.y = 0.052 + Math.sin(t * 13 + a.base) * 0.008;
      }
      dust.rotation.y = Math.sin(t * 0.04) * 0.05;
    },
    setFrame(index, url) {
      const frame = frames[index];
      if (frame.mesh) {
        frame.mesh.material.map?.dispose();
        scene.remove(frame.mesh);
        frame.mesh.geometry.dispose();
        frame.mesh.material.dispose();
      }
      const tex = new THREE.TextureLoader().load(url);
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
      frame.mesh = mesh(
        new THREE.PlaneGeometry(0.78, 0.92),
        mat,
        frame.position.x,
        frame.position.y,
        frame.position.z + 0.015,
      );
    },
  };
}
