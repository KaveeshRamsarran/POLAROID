import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { regions, evidenceDefs, seededRandom, floorAt } from "./logic.js";

const rnd = seededRandom(971017);
function surface(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d"),
    p = x.createImageData(512, 512);
  const base =
    kind === "wall"
      ? [104, 125, 108]
      : kind === "wood"
        ? [69, 55, 39]
        : kind === "metal"
          ? [64, 77, 66]
          : kind === "fabric"
            ? [62, 69, 49]
            : [77, 84, 72];
  for (let j = 0; j < 512; j++)
    for (let i = 0; i < 512; i++) {
      let n =
        (rnd() - 0.5) * 34 + Math.sin(i * 0.034) * Math.cos(j * 0.023) * 9;
      if (kind === "wood")
        n +=
          Math.sin(i * 0.24 + Math.sin(j * 0.017) * 2) * 10 +
          Math.sin(i * 0.7) * 5;
      if (kind === "fabric") n += (i % 3 === 0 ? 9 : 0) + (j % 3 === 0 ? 7 : 0);
      const k = (j * 512 + i) * 4;
      for (let a = 0; a < 3; a++) p.data[k + a] = base[a] + n;
      p.data[k + 3] = 255;
    }
  x.putImageData(p, 0, 0);
  for (let i = 0; i < 240; i++) {
    const xx = rnd() * 512,
      yy = rnd() * 512,
      r = 4 + rnd() * 48;
    x.fillStyle = `rgba(${kind === "wall" ? "27,42,30" : "13,20,14"},${rnd() * 0.12})`;
    x.beginPath();
    x.ellipse(xx, yy, r, r * (0.3 + rnd()), rnd() * 3, 0, Math.PI * 2);
    x.fill();
  }
  if (kind === "wall") {
    for (let i = 0; i < 45; i++) {
      const xx = rnd() * 512,
        yy = rnd() * 512;
      x.fillStyle = `rgba(26,44,32,${0.08 + rnd() * 0.15})`;
      x.fillRect(xx, yy, 1 + rnd() * 6, 20 + rnd() * 200);
    }
    for (let i = 0; i < 15; i++) {
      let xx = rnd() * 512,
        yy = rnd() * 512;
      x.strokeStyle = "rgba(29,44,31,.36)";
      x.lineWidth = 0.6;
      x.beginPath();
      x.moveTo(xx, yy);
      for (let j = 0; j < 12; j++) {
        xx += (rnd() - 0.5) * 13;
        yy += rnd() * 13;
        x.lineTo(xx, yy);
      }
      x.stroke();
    }
    for (let i = 0; i < 300; i++) {
      const xx = rnd() * 512,
        yy = rnd() * 512;
      x.fillStyle = "rgba(183,182,151,.19)";
      x.fillRect(xx, yy, rnd() * 10, rnd() * 5);
    }
  }
  if (kind === "floor") {
    x.strokeStyle = "#222d2460";
    x.lineWidth = 2;
    for (let i = 0; i < 512; i += 128) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 512);
      x.moveTo(0, i);
      x.lineTo(512, i);
      x.stroke();
    }
  }
  if (kind === "wood") {
    x.strokeStyle = "#151d1670";
    for (let i = 0; i < 512; i += 85) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i, 512);
      x.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function buildWorld(scene) {
  const solids = [],
    doors = [],
    interactables = [],
    fixtures = [],
    photoOnly = [],
    animated = [],
    windows = [],
    frames = [];
  const textures = Object.fromEntries(
    ["wall", "wood", "metal", "fabric", "floor"].map((k) => [k, surface(k)]),
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
    wall: material("#bcc6ab"),
    floor: material("#9ca68e", 0.76),
    wood: material("#c1ad85"),
    metal: material("#859785", 0.6, 0.65),
    fabric: material("#8a9071"),
    dark: material("#19251d"),
    rust: material("#603b29", 0.9, 0.4),
    paper: material("#b9b697"),
    ivory: material("#bfc3a8"),
    black: material("#101711"),
    glass: material("#263e39", 0.17, 0.8),
    skin: material("#b5bbaa", 0.72),
    red: material("#743729", 0.6, 0.2),
  };
  for (const k of Object.keys(textures)) {
    mats[k].map = textures[k];
    mats[k].bumpMap = textures[k];
    mats[k].bumpScale = k === "wall" ? 0.045 : 0.024;
  }
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
    const key = `${Math.max(w, d).toFixed(2)},${h.toFixed(2)}`;
    if (!wallMaterials.has(key)) {
      const mat = mats.wall.clone(),
        tex = textures.wall.clone();
      tex.repeat.set(Math.max(w, d) / 3, h / 3);
      mat.map = tex;
      mat.bumpMap = tex;
      wallMaterials.set(key, mat);
    }
    box(w, h, d, x, y + h / 2, z, wallMaterials.get(key));
    box(w, 0.14, d + 0.045, x, y + 0.07, z, mats.dark);
    box(w, 0.045, d + 0.025, x, y + 1.08, z, mats.metal);
    solid(x, z, w, d, undefined, y, h);
  }
  function wallX(z, a, b, y = 0, gaps = []) {
    let p = a;
    for (const [g1, g2] of gaps) {
      if (g1 > p) wallSegment((p + g1) / 2, z, g1 - p, 0.2, y);
      box(g2 - g1, 1, 0.2, (g1 + g2) / 2, y + 2.75, z, mats.wall);
      p = g2;
    }
    if (p < b) wallSegment((p + b) / 2, z, b - p, 0.2, y);
  }
  function wallZ(x, a, b, y = 0, gaps = []) {
    let p = a;
    for (const [g1, g2] of gaps) {
      if (g1 > p) wallSegment(x, (p + g1) / 2, 0.2, g1 - p, y);
      box(0.2, 1, g2 - g1, x, y + 2.75, (g1 + g2) / 2, mats.wall);
      p = g2;
    }
    if (p < b) wallSegment(x, (p + b) / 2, 0.2, b - p, y);
  }
  for (const r of regions) {
    if (r.ramp) continue;
    const w = r.x2 - r.x1,
      d = r.z2 - r.z1,
      mat = (r.y > 0 ? mats.wood : mats.floor).clone(),
      tex = (r.y > 0 ? textures.wood : textures.floor).clone();
    tex.repeat.set(w / 3, d / 3);
    mat.map = tex;
    mat.bumpMap = tex;
    box(w, 0.18, d, (r.x1 + r.x2) / 2, r.y - 0.1, (r.z1 + r.z2) / 2, mat);
    if (r.name !== "FRONT PORCH")
      box(
        w,
        0.12,
        d,
        (r.x1 + r.x2) / 2,
        r.y + 3.26,
        (r.z1 + r.z2) / 2,
        mats.dark,
      );
  }
  wallX(14, -10, 10, 0, [[-0.8, 0.8]]);
  wallX(-17, -10, 10, 0, [[-2.2, 2.2]]);
  wallZ(-10, -17, 14);
  wallZ(10, -17, 14, 0, [[-16, -12]]);
  for (const x of [-2.2, 2.2])
    wallZ(x, -17, 14, 0, [
      [-13, -11],
      [-2, 0],
      [8, 10],
    ]);
  for (const z of [-6, 4]) {
    wallX(z, -10, -2.2, 0, [[-7, -5]]);
    wallX(z, 2.2, 10, 0, [[5, 7]]);
  }
  wallX(-29, -10, 10, 3.6, [[-2.2, 2.2]]);
  wallX(-18, -10, -2.2, 3.6);
  wallX(-18, 2.2, 10, 3.6);
  wallZ(-10, -29, -18, 3.6);
  wallZ(10, -29, -18, 3.6);
  wallZ(-2.2, -29, -18, 3.6, [[-27, -25]]);
  wallZ(2.2, -29, -18, 3.6, [[-27, -25]]);
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
          mats.floor,
        );
        box(width, 0.024, 0.05, x, y + 0.01, z - (i * length) / n, mats.metal);
      } else {
        box(
          length / n + 0.015,
          0.2,
          width,
          x + ((i + 0.5) * length) / n,
          y - 0.1,
          z,
          mats.floor,
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
          mats.metal,
        );
        for (let i = 0; i <= 5; i++)
          link(
            [
              x + side * (width / 2 - 0.18),
              start + (rise * i) / 5,
              z - (length * i) / 5,
            ],
            [
              x + side * (width / 2 - 0.18),
              start + (rise * i) / 5 + 1,
              z - (length * i) / 5,
            ],
            0.025,
            mats.metal,
          );
      }
    }
  }
  stairs(0, -17, 4.4, 6, 0, 3.6);
  stairs(0, -29, 4.4, 6, 3.6, 3.2);
  stairs(10, -14, 4, 6, 0, -3.6, "x");
  // Stairwell side walls follow the slope while collision remains continuous.
  for (const [z, y, rise] of [
    [-17, 0, 3.6],
    [-29, 3.6, 3.2],
  ])
    for (let i = 0; i < 6; i++)
      for (const x of [-2.2, 2.2])
        wallSegment(x, z - i - 0.5, 0.2, 1, y + (rise * i) / 6, 3.5);
  for (let i = 0; i < 6; i++)
    for (const z of [-16, -12])
      wallSegment(10 + i + 0.5, z, 1, 0.2, (-3.6 * (i + 1)) / 6, 3.5);
  wallX(-43, -6, 6, 6.8);
  wallX(-35, -6, 6, 6.8, [[-2.2, 2.2]]);
  wallZ(-6, -43, -35, 6.8);
  wallZ(6, -43, -35, 6.8);
  wallX(-22, 16, 28, -3.6);
  wallX(-6, 16, 28, -3.6);
  wallZ(28, -22, -6, -3.6);
  wallZ(16, -22, -6, -3.6, [[-16, -12]]);
  function door(x, z, rotation, label, y = 0, locked = null, width = 1.7) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotation;
    scene.add(g);
    const pivot = new THREE.Group();
    pivot.position.x = -width / 2;
    g.add(pivot);
    round(width, 2.22, 0.105, width / 2, 1.11, 0, mats.metal, pivot, 0.025);
    round(
      width - 0.16,
      1.18,
      0.04,
      width / 2,
      1.33,
      0.063,
      mats.wall,
      pivot,
      0.015,
    );
    box(width - 0.14, 0.48, 0.05, width / 2, 0.4, 0.067, mats.dark, pivot);
    for (let i = 0; i < 5; i++)
      box(
        width - 0.24,
        0.025,
        0.025,
        width / 2,
        0.23 + i * 0.07,
        0.1,
        mats.metal,
        pivot,
      );
    sign(
      label,
      width / 2,
      1.82,
      0.098,
      width - 0.3,
      0.25,
      0,
      { size: 29 },
      pivot,
    );
    cylinder(
      0.032,
      0.22,
      width - 0.16,
      1.05,
      0.11,
      mats.rust,
      pivot,
    ).rotation.z = Math.PI / 2;
    for (const sx of [-width / 2 - 0.05, width / 2 + 0.05])
      box(0.08, 2.35, 0.18, sx, 1.17, 0, mats.rust, g);
    box(width + 0.17, 0.09, 0.18, 0, 2.34, 0, mats.rust, g);
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
  ])
    door(x, z, rot, label);
  door(-2.2, -26, Math.PI / 2, "NURSERY", 3.6);
  door(2.2, -26, -Math.PI / 2, "BEDROOM", 3.6);
  const atticDoor = door(0, -29, 0, "PRIVATE / ARCHIVE", 3.6, "attic", 2);
  const frontDoor = door(0, 14, Math.PI, "FRONT ENTRANCE", 0, "exit", 1.5);
  door(15.7, -14, -Math.PI / 2, "CELLAR", -3.6, "basement", 2);
  function fixture(x, y, z, w = 1.5, warm = false) {
    box(w + 0.12, 0.12, 0.4, x, y, z, mats.metal);
    const glow = new THREE.MeshStandardMaterial({
      color: warm ? "#c89d61" : "#c4e1bc",
      emissive: warm ? "#ddb37b" : "#d3f4cc",
      emissiveIntensity: 2.7,
    });
    for (const dz of [-0.115, 0.115]) {
      const tube = cylinder(0.035, w, x, y - 0.085, z + dz, glow);
      tube.rotation.z = Math.PI / 2;
    }
    for (const dx of [-w / 2, w / 2])
      box(0.04, 0.15, 0.43, x + dx, y - 0.035, z, mats.dark);
    fixtures.push({
      x,
      y: y - 0.25,
      z,
      color: warm ? 0xffc38a : 0xb9eac7,
      power: warm ? 15 : 25,
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
  for (const x of [-0.9, -0.48, 0.48, 0.9]) {
    link(
      [x, 2.88, 13.7],
      [x, 2.88, -16.8],
      x === -0.48 ? 0.13 : 0.085,
      mats.metal,
    );
    for (let z = -16; z < 14; z += 1.9) {
      const ring = mesh(
        new THREE.TorusGeometry(x === -0.48 ? 0.138 : 0.09, 0.018, 6, 16),
        mats.dark,
        x,
        2.88,
        z,
      );
      ring.rotation.y = 0;
    }
  }
  for (const z of [-13, -5, 3, 11])
    box(3.6, 0.055, 0.08, 0, 2.77, z, mats.rust);
  function vent(x, y, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    box(1.6, 0.65, 0.08, 0, 0, 0, mats.dark, g);
    for (let i = 0; i < 9; i++)
      box(1.5, 0.034, 0.1, 0, -0.27 + i * 0.068, 0.055, mats.metal, g);
  }
  vent(0, 2.4, -16.88);
  vent(-2.07, 2.5, 5, Math.PI / 2);
  vent(2.07, 2.5, -8, -Math.PI / 2);
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
  function chair(x, z, rot = 0, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
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
    const m = round(w, 0.018, d, x, y + 0.016, z, mats.fabric, scene, 0.008);
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
  function windowAt(x, z, rot, y = 0) {
    const g = new THREE.Group();
    g.position.set(x, y + 1.7, z);
    g.rotation.y = rot;
    scene.add(g);
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
  windowAt(-9.87, 10, Math.PI / 2);
  windowAt(9.87, 11, -Math.PI / 2);
  windowAt(9.87, -2, -Math.PI / 2);
  windowAt(-9.87, -22, Math.PI / 2, 3.6);
  windowAt(9.87, -23, -Math.PI / 2, 3.6);
  // Living room: upholstered couch, timber legs, piping, stacked books and a dead radio.
  const couch = new THREE.Group();
  couch.position.set(-7.8, 0, 11.6);
  scene.add(couch);
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
  solid(-7.8, 11.6, 3, 1.2);
  rug(-6, 9, 4, 3.6);
  const coffee = table(-6, 8.5, 1.8, 0.9);
  coffee.scale.y = 0.6;
  books(coffee, -0.6, 0.93, 0, 4);
  paper(-5.8, 0.57, 8.6);
  table(-3.5, 12.8, 0.7, 0.7);
  lamp(-3.5, 0.92, 12.8);
  bookshelf(-9.5, 6, 0, Math.PI / 2);
  cabinet(-3.2, 5.1, 0, 0, true);
  const radio = round(0.5, 0.24, 0.18, -6.2, 0.65, 8.4, mats.metal);
  sign("FM  88  108", -6.2, 0.7, 8.502, 0.37, 0.07, 0, { size: 20 });
  for (let i = 0; i < 8; i++)
    box(0.27, 0.008, 0.025, -6.24, 0.57 + i * 0.014, 8.51, mats.dark);
  cylinder(0.035, 0.025, -6, 0.63, 8.51, mats.dark).rotation.x = Math.PI / 2;
  // Study and family documents.
  const desk = table(-8.7, -1, 2.8, 1.1, 0, Math.PI / 2);
  chair(-7.4, -1, Math.PI / 2);
  lamp(-8.8, 0.92, -2);
  paper(-8.65, 0.925, -0.4, "MARA\n17 OCT 97");
  books(desk, -1, 0.93, 0, 6);
  bookshelf(-6, -5.4);
  cabinet(-3.3, 2.8, 0, 0, true);
  rug(-6, -1, 3, 4);
  sign("DO NOT TRUST\nAN EMPTY ROOM", -9.87, 1.8, 1.4, 1.1, 0.7, Math.PI / 2, {
    bg: "#b5b399",
    fg: "#494a36",
    size: 35,
  });
  // Kitchen cabinets with inset doors, taps, stove coils and enamel sink.
  for (const z of [5.2, 6.4, 7.6]) {
    round(0.68, 0.9, 1.15, 9.4, 0.46, z, mats.metal);
    round(0.025, 0.68, 0.99, 9.04, 0.48, z, mats.wood);
    link([9, 0.72, z - 0.2], [9, 0.72, z + 0.2], 0.018, mats.rust);
    round(0.85, 0.08, 1.18, 9.35, 0.94, z, mats.ivory);
    solid(9.4, z, 0.8, 1.2);
  }
  round(0.57, 0.05, 0.74, 9.31, 0.99, 6.4, mats.dark);
  round(0.46, 0.025, 0.63, 9.3, 1.015, 6.4, mats.metal);
  link([9.55, 1, 6.7], [9.55, 1.35, 6.7], 0.025, mats.metal);
  link([9.55, 1.35, 6.7], [9.25, 1.35, 6.7], 0.025, mats.metal);
  for (const z of [5, 5.5])
    for (const x of [9.13, 9.55]) {
      const coil = mesh(
        new THREE.TorusGeometry(0.14, 0.023, 7, 20),
        mats.dark,
        x,
        1.0,
        z,
      );
      coil.rotation.x = Math.PI / 2;
    }
  cabinet(8, 13.5);
  const kt = table(5.7, 10, 1.6, 1.2);
  chair(5.7, 11.1);
  chair(4.4, 10, -Math.PI / 2);
  bottle(5.4, 0.93, 10);
  paper(6, 0.925, 10.2, "FILM\nKEEP DRY");
  // Dining room and storage.
  table(6, -1, 3, 1.5);
  rug(6, -1, 4.2, 3);
  for (const x of [5, 6.7]) {
    chair(x, 0.3);
    chair(x, -2.3, Math.PI);
  }
  for (const x of [5, 6, 7]) {
    cylinder(0.2, 0.025, x, 0.94, -1, mats.ivory);
    bottle(x, 0.96, -1.5);
  }
  bookshelf(9.5, 1, 0, -Math.PI / 2);
  cabinet(3.2, -4.6, 0, 0, true);
  for (let i = 0; i < 10; i++) {
    const x = -9 + rnd() * 4,
      z = -16 + rnd() * 3,
      s = 0.45 + rnd() * 0.5;
    round(s, s, s, x, s / 2, z, mats.wood);
    box(s * 0.15, 0.01, s + 0.01, x, s + 0.01, z, mats.paper);
    solid(x, z, s, s);
  }
  bookshelf(-9.4, -9, 0, Math.PI / 2);
  cabinet(-3.4, -15.8, 0, 0, true);
  // Washroom mirror and cracked ceramic basin.
  round(1.65, 0.22, 0.7, 7, 0.86, -16.2, mats.ivory, scene, 0.11);
  ball(0.6, 0.08, 0.24, 7, 0.99, -16.17, mats.dark);
  cylinder(0.13, 0.7, 7, 0.37, -16.2, mats.ivory);
  link([7.55, 1, -16.45], [7.55, 1.28, -16.45], 0.026, mats.metal);
  link([7.55, 1.28, -16.45], [7.3, 1.28, -16.45], 0.026, mats.metal);
  round(1.7, 1.25, 0.06, 7, 1.95, -16.75, mats.rust);
  round(1.56, 1.12, 0.015, 7, 1.95, -16.71, mats.glass);
  solid(7, -16.25, 1.7, 0.75);
  cabinet(9.35, -8.1, 0, -Math.PI / 2, true);
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
  bed(-7, -25.5, 3.6, true);
  table(-8.8, -27.9, 0.7, 0.7, 3.6);
  lamp(-8.8, 4.52, -27.9);
  cabinet(-3.4, -19, 3.6, 0, true);
  rug(-6, -23, 3, 3, 3.6);
  ball(0.11, 0.13, 0.1, -5, 3.89, -22, mats.wood);
  ball(0.14, 0.17, 0.09, -5, 3.71, -22, mats.wood);
  for (const a of [-0.1, 0.1])
    ball(0.06, 0.06, 0.04, -5 + a, 3.99, -22, mats.wood);
  sign("ME + MUM\n+ THE TALL MAN", -9.87, 4.95, -26.7, 0.7, 0.6, Math.PI / 2, {
    bg: "#b4b599",
    fg: "#3f4c34",
    size: 28,
  });
  bed(7, -25, 3.6);
  cabinet(3.3, -19, 3.6, 0, true);
  table(9, -27.5, 0.8, 0.8, 3.6);
  lamp(9, 4.52, -27.5);
  bookshelf(9.5, -20, 3.6, -Math.PI / 2);
  // Attic rafters and archive.
  for (const z of [-36, -39, -42]) {
    link([-5.8, 9.35, z], [0, 10.05, z], 0.12, mats.wood);
    link([0, 10.05, z], [5.8, 9.35, z], 0.12, mats.wood);
  }
  table(0, -41.7, 2.8, 0.8, 6.8);
  for (const x of [-4, 4]) {
    cabinet(x, -40, 6.8);
    round(1, 0.7, 0.8, x, 7.15, -37, mats.wood);
  }
  paper(0.5, 7.72, -41.7, "I REMEMBER\nTHE CAMERA");
  // Boiler and workshop occupy the lower chamber's outer edge.
  cylinder(0.7, 2.1, 26, -2.45, -9, mats.metal);
  for (const yy of [-3.3, -1.6]) {
    const ring = mesh(
      new THREE.TorusGeometry(0.71, 0.045, 6, 24),
      mats.rust,
      26,
      yy,
      -9,
    );
    ring.rotation.x = Math.PI / 2;
  }
  link([26, -1.4, -9], [26, -0.5, -9], 0.17, mats.metal);
  link([26, -0.5, -9], [27.8, -0.5, -9], 0.17, mats.metal);
  solid(26, -9, 1.4, 1.4);
  table(26, -20, 2.4, 0.85, -3.6);
  bottle(25.7, -2.65, -20);
  cabinet(17.5, -7, -3.6, 0, true);
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
      z = -21.5;
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
  // Environmental signposting, floor grime, conduits and fuse boxes.
  sign(
    "← STUDY     DINING →\nNURSERY / ATTIC ↑",
    0,
    2.45,
    -16.83,
    2.8,
    0.37,
    0,
    { size: 28 },
  );
  sign("CELLAR →", 9.86, 1.7, -11.5, 1, 0.35, -Math.PI / 2, { size: 40 });
  sign(
    "BLACKWOOD\n17 OCTOBER 1997",
    -2.07,
    1.55,
    12.2,
    0.65,
    0.7,
    Math.PI / 2,
    { bg: "#a7a98d", fg: "#394734", size: 27 },
  );
  round(0.48, 0.76, 0.18, -2.02, 1.56, 6, mats.red);
  sign("FIRE", -1.915, 1.8, 6, 0.24, 0.2, Math.PI / 2, {
    bg: "#60362a",
    size: 40,
  });
  link([-1.96, 0.2, 6.9], [-1.96, 3.15, 6.9], 0.015, mats.dark);
  round(0.28, 0.33, 0.12, -2, 1.17, 6.9, mats.ivory);
  for (const z of [-8, 1]) {
    round(0.12, 0.22, 0.04, 2.06, 1.3, z, mats.ivory);
    interactables.push({
      type: "switch",
      position: new THREE.Vector3(2.02, 1.3, z),
      label: "Light switch",
    });
  }
  for (let i = 0; i < 100; i++) {
    const x = (rnd() - 0.5) * 3.9,
      z = -16 + rnd() * 29,
      y = 0.004;
    const p = mesh(
      new THREE.CircleGeometry(0.05 + rnd() * 0.35, 9),
      new THREE.MeshStandardMaterial({
        color: "#17281e",
        roughness: 0.19,
        metalness: 0.3,
        transparent: true,
        opacity: 0.45,
      }),
      x,
      y,
      z,
    );
    p.rotation.x = -Math.PI / 2;
    p.scale.y = 0.4 + rnd();
  }
  for (let i = 0; i < 25; i++) {
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
    [-5.5, 0.96, 8.5],
    [-8.7, 0.97, -1.1],
    [5.7, 0.97, 10.3],
    [9, 4.57, -27.5],
    [26, -2.63, -20],
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
    -15.95,
  );
  key.rotation.x = Math.PI / 2;
  link([7, 0.22, -15.95], [7.17, 0.22, -15.95], 0.015, mats.rust);
  interactables.push({
    type: "key",
    position: key.position.clone(),
    mesh: key,
    label: "Take the brass cellar key",
  });
  function apparition(kind = "observer") {
    const g = new THREE.Group(),
      skin = mats.skin.clone();
    skin.color.set(kind === "woman" ? "#869384" : "#929783");
    skin.map = textures.wall;
    skin.bumpMap = textures.wall;
    skin.bumpScale = 0.008;
    g.userData.limbs = [];
    const cloth = mats.fabric.clone();
    cloth.color.set("#424d40");
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
    ball(0.07, 0.14, 0.065, 0, 1.71, 0, skin, g);
    ball(0.135, 0.21, 0.12, 0, 1.94, 0, skin, g);
    ball(0.095, 0.12, 0.092, 0, 1.82, 0.04, skin, g);
    for (const a of [-1, 1]) {
      ball(0.033, 0.021, 0.018, a * 0.053, 1.96, 0.108, mats.black, g);
      ball(0.003, 0.003, 0.004, a * 0.053, 1.961, 0.127, mats.ivory, g);
      ball(0.052, 0.032, 0.025, a * 0.072, 1.905, 0.09, skin, g);
      ball(0.022, 0.04, 0.02, a * 0.132, 1.935, 0, skin, g);
      const armStart = g.children.length;
      ball(0.08, 0.07, 0.09, a * 0.18, 1.57, 0, cloth, g);
      link([a * 0.22, 1.55, 0], [a * 0.32, 1.16, 0.035], 0.058, cloth, g);
      ball(0.06, 0.065, 0.06, a * 0.32, 1.16, 0.035, skin, g);
      link([a * 0.32, 1.16, 0.035], [a * 0.39, 0.72, 0.1], 0.043, skin, g);
      ball(0.045, 0.095, 0.023, a * 0.4, 0.67, 0.1, skin, g);
      for (let f = 0; f < 4; f++)
        link(
          [a * 0.4 + (f - 1.5) * 0.018, 0.64, 0.1],
          [a * 0.4 + (f - 1.5) * 0.023, 0.48 - f * 0.006, 0.12],
          0.009,
          skin,
          g,
        );
      link([a * 0.37, 0.7, 0.105], [a * 0.335, 0.63, 0.13], 0.012, skin, g);
      const arm = new THREE.Group();
      arm.position.set(a * 0.22, 1.55, 0);
      for (const part of g.children.slice(armStart)) {
        part.position.sub(arm.position);
        arm.add(part);
      }
      g.add(arm);
      g.userData.limbs.push({ mesh: arm, side: a, type: "arm" });
      const legStart = g.children.length;
      link([a * 0.12, 0.93, 0], [a * 0.14, 0.5, 0.06], 0.073, cloth, g);
      ball(0.07, 0.065, 0.065, a * 0.14, 0.5, 0.06, cloth, g);
      link([a * 0.14, 0.5, 0.06], [a * 0.17, 0.09, 0], 0.055, cloth, g);
      ball(0.066, 0.06, 0.14, a * 0.17, 0.065, 0.06, mats.dark, g);
      const leg = new THREE.Group();
      leg.position.set(a * 0.12, 0.93, 0);
      for (const part of g.children.slice(legStart)) {
        part.position.sub(leg.position);
        leg.add(part);
      }
      g.add(leg);
      g.userData.limbs.push({ mesh: leg, side: a, type: "leg" });
    }
    ball(0.022, 0.06, 0.038, 0, 1.89, 0.124, skin, g);
    ball(0.031, 0.009, 0.009, 0, 1.83, 0.129, mats.black, g);
    link([-0.025, 1.99, 0.116], [0.015, 1.92, 0.13], 0.002, mats.rust, g);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2,
        xx = Math.sin(a) * 0.12,
        zz = Math.cos(a) * 0.1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xx * 0.5, 2.11, zz * 0.5),
        new THREE.Vector3(xx, 2.01, zz),
        new THREE.Vector3(xx * 1.12, 1.77 + (i % 3) * 0.04, zz - 0.01),
      ]);
      mesh(
        new THREE.TubeGeometry(curve, 7, 0.004, 3, false),
        mats.dark,
        0,
        0,
        0,
        g,
      );
    }
    g.scale.set(1, 1.11, 1);
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
    scene.add(g);
    return g;
  }
  const observer = apparition();
  observer.visible = false;
  const child = apparition("child");
  child.position.set(-6, 3.6, -26);
  child.visible = false;
  photoOnly.push(child);
  const woman = apparition("woman");
  woman.position.set(7, 0.72, -16.62);
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
  crawler.position.set(-7.8, 0.13, 11.6);
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
  function makeCamera(parent) {
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
    ball(0.074, 0.11, 0.05, 0.18, -0.025, 0.025, mats.skin, g);
    for (let i = 0; i < 4; i++) {
      ball(0.065, 0.016, 0.018, 0.12, -0.04 + i * 0.029, 0.116, mats.skin, g);
    }
    link([0.21, -0.09, 0.06], [0.34, -0.3, 0.12], 0.075, mats.fabric, g);
    g.position.set(0.28, -0.28, -0.53);
    g.rotation.set(-0.13, -0.18, -0.05);
    return g;
  }
  const lights = [];
  for (let i = 0; i < 7; i++) {
    const l = new THREE.PointLight(0xbce2c2, 0, 12, 2);
    scene.add(l);
    lights.push(l);
  }
  const ambient = new THREE.HemisphereLight(0x7e9b91, 0x1a231a, 0.52);
  scene.add(ambient);

  // The front entrance opens onto a covered porch and wet ground beneath bare trees.
  box(9, 0.16, 3.5, 0, 3.15, 15.7, mats.wood);
  for (const x of [-4.2, 4.2]) {
    cylinder(0.09, 3.1, x, 1.55, 17, mats.wood);
    link([x, 2.5, 17], [x * 0.75, 3.1, 17], 0.065, mats.wood);
  }
  box(45, 0.1, 26, 0, -0.2, 24, mats.dark);
  for (let i = 0; i < 18; i++) {
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
  return {
    solids,
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
      for (const limb of observer.userData.limbs)
        limb.mesh.rotation.x =
          Math.sin(t * 5 + (limb.side * Math.PI) / 2) *
          (limb.type === "arm" ? -0.12 : 0.16) *
          (observer.userData.walking ? 1 : 0.1);
      rain.position.y = -((t * 6) % 3);
      for (const d of doors) {
        d.open = THREE.MathUtils.damp(d.open, d.target, 5, dt);
        d.pivot.rotation.y = -d.open * Math.PI * 0.49;
      }
      const nearest = [...fixtures]
        .sort(
          (a, b) =>
            (a.x - position.x) ** 2 +
            (a.y - position.y) ** 2 +
            (a.z - position.z) ** 2 -
            ((b.x - position.x) ** 2 +
              (b.y - position.y) ** 2 +
              (b.z - position.z) ** 2),
        )
        .slice(0, 7);
      for (let i = 0; i < 7; i++) {
        const f = nearest[i],
          l = lights[i];
        if (!f) continue;
        l.position.set(f.x, f.y, f.z);
        l.color.setHex(f.color);
        const flicker = Math.sin(t * 39 + i * 2) > 0.975 ? 0.5 : 1;
        l.intensity = f.power * (power ? flicker : 0.025);
        if (f.glow) f.glow.emissiveIntensity = power ? 2.7 * flicker : 0.08;
      }
      ambient.intensity = 0.42 + storm * 0.8;
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
