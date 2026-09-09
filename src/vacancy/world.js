import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { modelTools } from "../shared/model-tools.js";
import { makeCamera } from "../shared/camera-model.js";
import { createSurface, repeatMaterial, surfaceKinds } from "../materials.js";
import { createHouseFinishes, createHousePicture } from "../house-finishes.js";
import { cinemaCharacters } from "../cinema/characters.js";
import { updateObserverAnimation } from "../observer-animation.js";
import { createNavigation } from "../shared/navigation.js";
import { seededRandom } from "../logic.js";
import { floorAt, REGIONS, doorUnlocked } from "./logic.js";

export function buildMotel(scene, getState) {
  const rnd = seededRandom(741999),
    mats = {};
  for (const [key, color] of Object.entries({
    wall: "#dbd0b9",
    wood: "#c0a58c",
    fabric: "#849893",
    metal: "#9d9b90",
    skin: "#b8a18a",
    concrete: "#b3b6b0",
    tile: "#ccd5c8",
    dark: "#24292a",
    black: "#111719",
    paper: "#ded3b0",
    ivory: "#c6bd9e",
    glass: "#273e45",
    red: "#7c3630",
    rust: "#75513b",
    brass: "#a18a52",
  }))
    mats[key] = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      metalness: key === "metal" ? 0.4 : key === "brass" ? 0.45 : 0,
    });
  for (const kind of surfaceKinds) {
    Object.assign(mats[kind], createSurface(kind));
    mats[kind].normalScale.setScalar(0.3);
  }
  const finishes = createHouseFinishes();
  mats.wall = finishes.plaster;
  mats.trim = finishes.trim;
  mats.rug = finishes.rug;
  mats.joinery = finishes.joinery;
  const { box, round, ball, cylinder, mesh, link, sign } = modelTools(
    scene,
    mats,
  );
  const solids = [],
    occluders = [],
    doors = [],
    interactions = [],
    targets = {},
    memories = [],
    lamps = [],
    architecture = [];
  const doorState = new Proxy({}, { get: (_, id) => getState().doors[id] });
  const nav = createNavigation({
    solids,
    doors: doorState,
    floorAt,
    canOpen: (id) => doorUnlocked(getState(), id),
  });
  function bounds(w, h, d, x, y, z, extra = {}) {
    const b = {
      x1: x - w / 2,
      x2: x + w / 2,
      z1: z - d / 2,
      z2: z + d / 2,
      y1: y - h / 2,
      y2: y + h / 2,
      ...extra,
    };
    solids.push(b);
    return b;
  }
  function solid(w, h, d, x, y, z, mat = mats.wall) {
    const o = box(w, h, d, x, y, z, mat);
    bounds(w, h, d, x, y, z);
    occluders.push(o);
    return o;
  }
  function wall(x, z, w, d, base = 0, h = 2.9) {
    solid(
      w,
      h,
      d,
      x,
      base + h / 2,
      z,
      repeatMaterial(mats.wall, Math.max(w, d) / 3, h / 3),
    );
    box(
      w + (w > d ? 0 : 0.03),
      0.1,
      d + (w > d ? 0.03 : 0),
      x,
      base + 0.05,
      z,
      mats.joinery,
    );
    box(
      w + (w > d ? 0 : 0.02),
      0.04,
      d + (w > d ? 0.02 : 0),
      x,
      base + 2.77,
      z,
      mats.trim,
    );
    architecture.push({ x, z, w, d, base, h });
  }
  function wallWithDoor(
    id,
    x,
    z,
    width,
    rotation,
    base = 0,
    total = 6,
    label = id,
  ) {
    const alongX = Math.abs(Math.cos(rotation)) > 0.5,
      half = width / 2 + 0.09;
    for (const side of [-1, 1]) {
      const len = total / 2 - half,
        offset = side * (half + len / 2);
      wall(
        x + (alongX ? offset : 0),
        z + (alongX ? 0 : offset),
        alongX ? len : 0.2,
        alongX ? 0.2 : len,
        base,
      );
    }
    solid(
      alongX ? width + 0.18 : 0.2,
      0.63,
      alongX ? 0.2 : width + 0.18,
      x,
      base + 2.585,
      z,
    );
    addDoor(id, x, z, rotation, base, width, label);
  }
  function addDoor(id, x, z, rotation, y, width, label) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    scene.add(group);
    const pivot = new THREE.Group();
    pivot.position.x = -width / 2;
    group.add(pivot);
    const leaf = round(
      width,
      2.24,
      0.1,
      width / 2,
      1.12,
      0,
      mats.joinery,
      pivot,
      0.014,
    );
    leaf.userData.interactionDoor = id;
    occluders.push(leaf);
    for (const side of [-1, 1]) {
      round(
        width - 0.16,
        1.25,
        0.02,
        width / 2,
        1.47,
        side * 0.058,
        mats.wood,
        pivot,
        0.01,
      );
      round(
        width - 0.2,
        0.45,
        0.02,
        width / 2,
        0.42,
        side * 0.058,
        mats.wood,
        pivot,
        0.01,
      );
      round(
        0.06,
        0.22,
        0.025,
        width - 0.14,
        1.07,
        side * 0.075,
        mats.brass,
        pivot,
        0.009,
      );
      ball(0.04, 0.04, 0.04, width - 0.14, 1.1, side * 0.12, mats.brass, pivot);
      sign(
        label,
        width / 2,
        1.87,
        side * 0.073,
        0.45,
        0.16,
        side === 1 ? 0 : Math.PI,
        { bg: "#504334", fg: "#d7c59b", size: 45 },
        pivot,
      );
    }
    for (const dx of [-width / 2 - 0.06, width / 2 + 0.06])
      box(0.12, 2.35, 0.24, dx, 1.175, 0, mats.trim, group);
    box(width + 0.24, 0.1, 0.24, 0, 2.35, 0, mats.trim, group);
    const alongX = Math.abs(Math.cos(rotation)) > 0.5;
    bounds(alongX ? width : 0.12, 2.24, alongX ? 0.12 : width, x, y + 1.12, z, {
      door: id,
    });
    const opened = bounds(0.1, 2.24, 0.1, x, y + 1.12, z, {
      door: id,
      openLeaf: true,
    });
    const data = {
      id,
      group,
      pivot,
      leaf,
      opened,
      amount: doorState[id] ? 1 : 0,
    };
    doors.push(data);
    interactions.push({
      id: "door:" + id,
      label: "Open / close " + label,
      position: new THREE.Vector3(x, y + 1.1, z),
      range: 2.6,
      door: id,
    });
    return data;
  }
  function interact(id, label, x, y, z, range = 2.4, when = () => true) {
    interactions.push({
      id,
      label,
      position: new THREE.Vector3(x, y, z),
      range,
      when,
    });
  }
  function target(id, x, y, z, maxDistance = 8, facing = null) {
    targets[id] = { position: new THREE.Vector3(x, y, z), maxDistance, facing };
  }
  function groupAt(x, y, z, rot = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rot;
    scene.add(g);
    return g;
  }
  const warmGlow = new THREE.MeshStandardMaterial({
    color: "#f0d5a1",
    emissive: "#ffd29a",
    emissiveIntensity: 1.7,
  });
  const coldGlow = new THREE.MeshStandardMaterial({
    color: "#a6c5c2",
    emissive: "#b0dcdd",
    emissiveIntensity: 1.25,
  });
  function light(x, y, z, power = 12, cold = false) {
    lamps.push({ x, y, z, power, color: cold ? 0xa5c9d5 : 0xffd3a0 });
  }
  function ceilingLamp(x, base, z) {
    cylinder(0.16, 0.06, x, base + 2.88, z, mats.brass);
    ball(0.18, 0.08, 0.18, x, base + 2.81, z, warmGlow);
    light(x, base + 2.57, z, 16);
  }
  // Continuous slabs, fully enclosed rooms, and an exterior with a distant tree
  // line. The upper walkway has one entrance, at the top of the real stairs.
  box(150, 0.2, 150, 0, -1.2, 5, mats.dark);
  for (const r of REGIONS) {
    if (r.ramp) continue;
    const w = r.x2 - r.x1,
      d = r.z2 - r.z1,
      x = (r.x1 + r.x2) / 2,
      z = (r.z1 + r.z2) / 2;
    if (r.name !== "Courtyard")
      box(
        w,
        0.16,
        d,
        x,
        r.y - 0.08,
        z,
        repeatMaterial(
          r.name.startsWith("Room")
            ? mats.fabric
            : r.name === "Laundry"
              ? mats.tile
              : mats.concrete,
          w / 3,
          d / 3,
        ),
      );
    if (!["Courtyard", "Upper walkway"].includes(r.name))
      box(w, 0.12, d, x, r.y + 2.96, z, mats.wall);
  }
  for (const [x, z, w, d] of [
    [-2.15, 7, 7.7, 26],
    [12.15, 7, 3.7, 26],
    [6, -2.85, 8.6, 6.3],
    [6, 14.4, 8.6, 11.2],
  ])
    box(w, 0.16, d, x, -0.08, z, repeatMaterial(mats.concrete, w / 3, d / 3));
  wall(-14, 9.5, 0.2, 9);
  wall(-10, 14, 8, 0.2);
  wallWithDoor("reception", -6, 10, 1.35, Math.PI / 2, 0, 8, "RECEPTION");
  // The front wall spans z=6..14; its small return closes z=5..6.
  wall(-6, 5.5, 0.2, 1);
  wallWithDoor("laundry", -10, 5, 1.25, 0, 0, 8, "LAUNDRY");
  wall(-14, 0, 0.2, 10);
  wall(-10, -5, 8, 0.2);
  wall(-6, 0, 0.2, 10);
  wall(4, -15, 20, 0.2, 3.1);
  wall(-6, -12, 0.2, 6, 3.1);
  wall(14, -12, 0.2, 6, 3.1);
  wallWithDoor("room5", -2, -9, 1.2, 0, 3.1, 8, "5");
  wallWithDoor("room6", 5, -9, 1.2, 0, 3.1, 6, "6");
  wall(11, -9, 6, 0.2, 3.1);
  wallWithDoor("connecting", 2, -12, 1.15, Math.PI / 2, 3.1, 6, "BATH");
  wallWithDoor("room7", 8, -12, 1.15, Math.PI / 2, 3.1, 6, "7");
  const paintCover = box(0.025, 2.23, 1.15, 7.92, 4.22, -12, mats.wall);
  paintCover.userData.interactionDoor = "room7";
  occluders.push(paintCover);
  const memoryDoor = groupAt(7.9, 4.25, -12, Math.PI / 2);
  box(1.16, 2.23, 0.028, 0, 0, 0, mats.joinery, memoryDoor);
  sign(
    "7",
    0,
    0.75,
    0.019,
    0.3,
    0.26,
    0,
    { bg: "#594d36", fg: "#e5d2a6", size: 60 },
    memoryDoor,
  );
  ball(0.045, 0.045, 0.045, -0.4, -0.1, 0.04, mats.brass, memoryDoor);
  memories.push(memoryDoor);
  target("doorway", 7.88, 4.3, -12, 5, new THREE.Vector3(-1, 0, 0));
  wall(4, -9, 20, 0.24, 0, 3.1);
  // Closed ground-floor rooms give the lodge a believable two-storey frontage.
  // Their solid wall sits beneath the balcony and cannot cut its upper route.
  solid(17, 3.02, 0.2, 5.5, 1.51, -6.25, mats.wall);
  for (const [number, x] of [
    [1, -1.7],
    [2, 2.6],
    [3, 6.9],
    [4, 11.2],
  ]) {
    round(1.02, 2.23, 0.06, x, 1.115, -6.11, mats.joinery, scene, 0.01);
    for (const dx of [-0.57, 0.57])
      box(0.11, 2.32, 0.12, x + dx, 1.16, -6.07, mats.trim);
    box(1.25, 0.1, 0.12, x, 2.32, -6.07, mats.trim);
    ball(0.04, 0.04, 0.04, x + 0.37, 1.05, -6.02, mats.brass);
    sign(String(number), x, 1.93, -6.065, 0.22, 0.17, 0, {
      bg: "#514c3c",
      fg: "#d8c49c",
      size: 56,
    });
    sign("CLOSED FOR SEASON", x, 1.48, -6.065, 0.78, 0.17, 0, {
      bg: "#bbae8e",
      fg: "#443e33",
      size: 30,
    });
    // Recessed-looking glazing with faded curtains behind a timber frame.
    const wx = x + 1.9;
    box(1.58, 1.12, 0.09, wx, 1.55, -6.105, mats.joinery);
    box(1.4, 0.94, 0.025, wx, 1.55, -6.045, mats.fabric);
    for (const dx of [-0.48, -0.24, 0, 0.24, 0.48])
      box(0.035, 0.91, 0.03, wx + dx, 1.55, -6.025, mats.wood);
    box(0.04, 1, 0.035, wx, 1.55, -5.99, mats.joinery);
    box(1.68, 0.07, 0.2, wx, 0.96, -6.04, mats.trim);
  }
  box(17, 0.08, 0.12, 5.5, 2.8, -6.11, mats.trim);
  box(20, 0.13, 3, 4, 6.07, -7.5, mats.wall);
  // Balcony rail includes physical collision and wide clear landings.
  for (const [a, b] of [[-3, 14]]) {
    bounds(b - a, 1.15, 0.12, (a + b) / 2, 3.65, -6.05);
    link([a, 4.12, -6.05], [b, 4.12, -6.05], 0.035, mats.metal);
    for (let x = a; x <= b; x += 0.55)
      link([x, 3.16, -6.05], [x, 4.1, -6.05], 0.018, mats.metal);
  }
  for (const x of [-6, 14]) {
    bounds(0.12, 1.15, 3, x, 3.65, -7.5);
    link([x, 4.12, -9], [x, 4.12, -6], 0.035, mats.metal);
  }
  for (let i = 0; i < 24; i++) {
    const y = ((i + 1) * 3.1) / 24;
    box(
      3,
      0.16,
      9 / 24 + 0.01,
      -4.5,
      y - 0.08,
      3 - ((i + 0.5) * 9) / 24,
      mats.concrete,
    );
  }
  for (const x of [-5.94, -3.06]) {
    link([x, 1.04, 3], [x, 4.14, -6], 0.035, mats.metal);
    for (let i = 0; i <= 12; i++)
      link(
        [x, (i * 3.1) / 12, 3 - (i * 9) / 12],
        [x, (i * 3.1) / 12 + 1.04, 3 - (i * 9) / 12],
        0.022,
        mats.metal,
      );
    // Tall invisible bounds accompany the visible balusters, preventing a
    // lateral step onto another floor without sealing the stair entrance.
    bounds(0.12, 4.4, 8.8, x, 2.2, -1.5);
  }
  for (const x of [-5.9, 1.9, 8.1, 13.9]) {
    box(0.14, 3, 0.14, x, 4.6, -6.1, mats.joinery);
  }
  // Wall-mounted exterior lamps, their housings touch the facade.
  for (const x of [-3, 3, 10.6]) {
    box(0.24, 0.36, 0.15, x, 5.55, -8.84, mats.dark);
    box(0.17, 0.26, 0.08, x, 5.55, -8.72, warmGlow);
    light(x, 5.3, -8.3, 15);
  }
  const canopy = box(8.7, 0.18, 1.6, -5.25, 3, 10, mats.joinery);
  canopy.rotation.y = Math.PI / 2;
  sign("BRIAR GLEN\nMOTOR LODGE", -5.855, 2.28, 12.1, 2.2, 0.85, Math.PI / 2, {
    bg: "#1e3536",
    fg: "#d0bea1",
    size: 37,
  });
  sign("RECEPTION", -5.84, 2.58, 10, 1.35, 0.23, Math.PI / 2, {
    bg: "#242c2a",
    fg: "#d0bea1",
    size: 42,
  });
  light(-5.2, 2.4, 10, 12);
  // Pool is genuinely recessed, with a raised coping keeping the walkway safe.
  const pool = { x: 6, z: 4.5, w: 8, d: 8 };
  bounds(pool.w + 0.4, 1.1, pool.d + 0.4, pool.x, 0.45, pool.z);
  const waterless = new THREE.MeshStandardMaterial({
    color: "#405f5d",
    roughness: 0.91,
    map: mats.tile.map,
    normalMap: mats.tile.normalMap,
  });
  box(8, 0.08, 8, 6, -1, 4.5, waterless);
  for (const x of [2, 10]) box(0.12, 1.2, 8, x, -0.4, 4.5, waterless);
  for (const z of [0.5, 8.5]) box(8, 1.2, 0.12, 6, -0.4, z, waterless);
  for (const x of [1.85, 10.15])
    solid(0.25, 0.36, 8.55, x, 0.18, 4.5, mats.tile);
  for (const z of [0.35, 8.65]) solid(8.55, 0.36, 0.25, 6, 0.18, z, mats.tile);
  box(0.65, 0.1, 1.7, 6, 0.45, 0.5, mats.ivory);
  box(0.48, 0.3, 0.5, 6, 0.22, -0.1, mats.metal);
  for (const x of [8.6, 9]) {
    link([x, 0.08, 8.45], [x, 0.9, 8.45], 0.025, mats.metal);
    link([x, 0.9, 8.45], [x, 0.9, 8.85], 0.025, mats.metal);
  }
  sign("POOL CLOSED\nNO LIFEGUARD", 10.28, 1.5, 7, 1.2, 0.65, -Math.PI / 2, {
    bg: "#929582",
    fg: "#293832",
    size: 35,
  });
  const keyMemory = groupAt(6, 0.56, 0.2);
  round(0.6, 0.07, 0.42, 0, 0, 0, mats.red, keyMemory, 0.02);
  sign(
    "E. ELLIS / 7",
    0,
    0.043,
    0,
    0.5,
    0.25,
    0,
    { bg: "#b6a387", fg: "#30271e", size: 40 },
    keyMemory,
  ).rotation.x = -Math.PI / 2;
  memories.push(keyMemory);
  target("pool", 6, 0.58, 0.2, 7);
  const key = groupAt(6, 0.53, 0.2);
  const ring = mesh(
    new THREE.TorusGeometry(0.055, 0.011, 7, 20),
    mats.brass,
    0,
    0,
    0,
    key,
  );
  ring.rotation.x = Math.PI / 2;
  box(0.018, 0.02, 0.16, 0, 0, 0.11, mats.brass, key);
  box(0.07, 0.02, 0.026, 0.025, 0, 0.17, mats.brass, key);
  interact(
    "key",
    "Take the brass room key",
    6,
    0.55,
    0.2,
    2.8,
    (s) => !!s.evidence.pool && !s.items.key,
  );
  // Reception: old laminate, mail slots, upholstered chairs, register and bell.
  solid(4, 0.94, 0.76, -10, 0.47, 8, mats.joinery);
  round(4.12, 0.08, 0.85, -10, 0.98, 8, mats.ivory);
  for (let i = 0; i < 6; i++) {
    box(0.12, 0.6, 0.5, -13.8, 1.65, 7 + i * 0.8, mats.joinery);
    sign(String(i + 1), -13.71, 1.68, 7 + i * 0.8, 0.16, 0.16, Math.PI / 2, {
      bg: "#3a3530",
      fg: "#d8c9a2",
      size: 52,
    });
  }
  const bell = ball(0.11, 0.065, 0.11, -9.5, 1.075, 8, mats.brass);
  cylinder(0.025, 0.07, -9.5, 1.16, 8, mats.dark);
  interact(
    "bell",
    "Ring the reception bell",
    -9.5,
    1.17,
    8,
    2.5,
    (s) => !s.items.roomKey,
  );
  const ledger = sign(
    "GUEST REGISTER\nELLIS / ROOM 6",
    -11,
    1.029,
    8,
    0.65,
    0.45,
    0,
    { bg: "#c2b495", fg: "#3b3027", size: 30 },
  );
  ledger.rotation.x = -Math.PI / 2;
  interact(
    "page",
    "Read the loose register page",
    -11,
    1.04,
    8,
    2.4,
    (s) => !!s.items.key,
  );
  const supplies = round(0.4, 0.2, 0.32, -8.3, 1.12, 8, mats.paper);
  sign("600 / FILM", -8.3, 1.12, 8.17, 0.33, 0.12, 0, {
    bg: "#bbae8c",
    fg: "#30362a",
    size: 35,
  });
  interact("film", "Take spare film", -8.3, 1.13, 8, 2.5);
  sign(
    "NIGHT PORTER\nRECEPTION · LAUNDRY\nUPSTAIRS · POOL",
    -13.86,
    2.4,
    9.4,
    1.1,
    0.55,
    Math.PI / 2,
    { bg: "#bcb095", fg: "#303b33", size: 27 },
  );
  interact("rules", "Read the porter's route", -13.8, 2.4, 9.4, 2.5);
  ceilingLamp(-10, 0, 11.5);
  ceilingLamp(-10, 0, 6.4);
  function chair(x, z, rot = 0, y = 0) {
    const g = groupAt(x, y, z, rot);
    round(0.7, 0.18, 0.7, 0, 0.5, 0, mats.fabric, g, 0.08);
    round(0.72, 0.66, 0.16, 0, 0.8, -0.28, mats.fabric, g, 0.08);
    for (const a of [-0.27, 0.27])
      for (const b of [-0.24, 0.24])
        cylinder(0.025, 0.43, a, 0.22, b, mats.metal, g);
    bounds(0.76, 1, 0.76, x, y + 0.5, z);
    return g;
  }
  chair(-12.8, 12.8, Math.PI);
  chair(-11.6, 12.8, Math.PI);
  const tv = round(0.74, 0.57, 0.52, -7, 1.45, 13.4, mats.joinery);
  box(0.62, 0.43, 0.02, -7, 1.46, 13.125, mats.glass);
  solid(1.1, 0.93, 0.58, -7, 0.47, 13.4, mats.joinery);
  // Laundry appliances, folded towels and a tagged lost-property shelf.
  for (const z of [-3, -1, 1]) {
    solid(1.05, 1, 1.25, -13.3, 0.5, z, mats.ivory);
    const drum = cylinder(0.29, 0.06, -12.745, 0.52, z, mats.dark);
    drum.rotation.z = Math.PI / 2;
    const rim = mesh(
      new THREE.TorusGeometry(0.31, 0.028, 8, 32),
      mats.metal,
      -12.7,
      0.52,
      z,
    );
    rim.rotation.y = Math.PI / 2;
    for (const offset of [-0.3, 0.15])
      ball(0.04, 0.04, 0.04, -12.72, 0.86, z + offset, mats.brass);
  }
  solid(2, 0.86, 0.75, -9, 0.43, -3.8, mats.joinery);
  box(2.05, 0.05, 0.8, -9, 0.89, -3.8, mats.ivory);
  for (let i = 0; i < 5; i++)
    round(0.65, 0.055, 0.43, -9.5, 0.95 + i * 0.06, -3.8, mats.paper);
  box(1.8, 0.06, 0.42, -7.4, 1.2, 0, mats.joinery);
  box(1.8, 0.06, 0.42, -7.4, 1.9, 0, mats.joinery);
  for (const x of [-8.15, -6.65])
    box(0.06, 1.75, 0.38, x, 1.06, 0, mats.joinery);
  const washMemory = groupAt(-7.4, 1.4, 0.03);
  round(0.68, 0.3, 0.3, 0, 0, 0, mats.fabric, washMemory, 0.04);
  sign(
    "EVELYN ELLIS\nROOM 7 · POOL",
    0,
    0.02,
    0.16,
    0.55,
    0.22,
    0,
    { bg: "#c8b78e", fg: "#283937", size: 32 },
    washMemory,
  );
  memories.push(washMemory);
  target("laundry", -7.4, 1.42, 0.2, 6, new THREE.Vector3(0, 0, 1));
  sign("LOST PROPERTY", -7.4, 2.18, -0.03, 1.6, 0.24, 0, {
    bg: "#29433f",
    fg: "#d7c59b",
    size: 39,
  });
  box(1.68, 0.3, 0.045, -7.4, 2.18, -0.06, mats.joinery);
  for (const x of [-8.08, -6.72])
    box(0.035, 0.4, 0.035, x, 1.99, -0.08, mats.metal);
  interact(
    "wash",
    "Read the lost-property book",
    -9,
    0.95,
    -3.5,
    2.5,
    (s) => !!s.evidence.suitcase,
  );
  const washbook = sign(
    "LOST PROPERTY\n1974 – 1999",
    -9,
    0.93,
    -3.6,
    0.6,
    0.4,
    0,
    { bg: "#b9ae91", fg: "#2c3a32", size: 30 },
  );
  washbook.rotation.x = -Math.PI / 2;
  ceilingLamp(-10, 0, 1.5);
  ceilingLamp(-10, 0, -3);
  // Furnished guestrooms. Room 5 supplies a second route through the bathroom.
  function bed(x, z) {
    solid(2, 0.45, 2.25, x, 3.325, z, mats.joinery);
    round(1.96, 0.24, 2.18, x, 3.66, z, mats.ivory);
    round(1.98, 0.13, 1.4, x, 3.79, z + 0.27, mats.fabric);
    round(0.72, 0.14, 0.43, x - 0.48, 3.83, z - 0.73, mats.paper);
    round(0.72, 0.14, 0.43, x + 0.48, 3.83, z - 0.73, mats.paper);
    round(2.16, 0.9, 0.13, x, 3.95, z - 1.14, mats.joinery);
  }
  bed(5, -13.65);
  bed(-3.5, -13.55);
  bed(11, -13.55);
  for (const x of [-1, 6.7, 12.8]) {
    solid(0.6, 0.65, 0.65, x, 3.425, -13.7, mats.joinery);
    cylinder(0.13, 0.03, x, 3.79, -13.7, mats.brass);
    cylinder(0.018, 0.31, x, 3.95, -13.7, mats.brass);
    const shade = mesh(
      new THREE.CylinderGeometry(0.11, 0.23, 0.28, 24, 1, true),
      mats.paper,
      x,
      4.16,
      -13.7,
    );
    shade.material = mats.paper.clone();
    shade.material.side = THREE.DoubleSide;
    ball(0.06, 0.08, 0.06, x, 4.07, -13.7, warmGlow);
    light(x, 4.05, -13.6, 7);
  }
  for (const [x, w] of [
    [-4, 1.5],
    [3.1, 1.2],
    [12.4, 1.25],
  ]) {
    box(w, 1.2, 0.07, x, 4.66, -8.88, mats.glass);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const c = cylinder(
          0.055,
          1.45,
          x + side * (w / 2 + 0.04 + i * 0.05),
          4.56,
          -8.81,
          mats.fabric,
        );
        c.scale.z = 0.4;
      }
    link(
      [x - w / 2 - 0.36, 5.34, -8.79],
      [x + w / 2 + 0.36, 5.34, -8.79],
      0.02,
      mats.brass,
    );
    for (const a of [-w / 2, 0, w / 2])
      box(0.04, 1.22, 0.08, x + a, 4.66, -8.77, mats.trim);
  }
  ceilingLamp(5, 3.1, -11);
  ceilingLamp(-2.5, 3.1, -11);
  ceilingLamp(11, 3.1, -11);
  for (const x of [-4, 4.6, 11]) {
    const art = groupAt(x, 4.85, -14.86);
    box(0.9, 0.6, 0.05, 0, 0, 0, mats.joinery, art);
    mesh(
      new THREE.PlaneGeometry(0.79, 0.49),
      new THREE.MeshStandardMaterial({
        map: createHousePicture("BRIAR GLEN / SUMMER"),
        roughness: 0.95,
      }),
      0,
      0,
      0.035,
      art,
    );
  }
  solid(0.8, 0.65, 0.48, 3, 3.425, -10.2, mats.joinery);
  interact(
    "bag",
    "Put your bag on the luggage stand",
    3,
    3.87,
    -10.2,
    2.5,
    (s) => !!s.items.roomKey && !s.items.bag,
  );
  const bag = round(0.62, 0.4, 0.34, 3, 3.96, -10.2, mats.fabric);
  box(0.3, 0.07, 0.09, 3, 4.18, -10.2, mats.joinery);
  const phone = round(0.29, 0.09, 0.2, 6.7, 3.83, -13.65, mats.ivory);
  round(0.31, 0.055, 0.08, 6.7, 3.9, -13.65, mats.dark);
  interact(
    "phone",
    "Call home",
    6.7,
    3.94,
    -13.65,
    2.4,
    (s) => !!s.items.bag && !s.items.called,
  );
  const familyPhoto = sign(
    "SUMMER 1974\nLENA + EVELYN",
    6.7,
    3.79,
    -13.35,
    0.25,
    0.31,
    0,
    { bg: "#b4a082", fg: "#4c4434", size: 26 },
  );
  familyPhoto.rotation.x = -Math.PI / 2;
  interact(
    "family",
    "Examine the family photograph",
    6.7,
    3.79,
    -13.3,
    2.5,
    (s) => !!s.items.called,
  );
  const suitcase = groupAt(4.5, 3.32, -12.45);
  round(0.75, 0.33, 0.44, 0, 0, 0, mats.fabric, suitcase, 0.06);
  round(0.2, 0.065, 0.06, 0, 0.18, 0.03, mats.brass, suitcase, 0.01);
  sign(
    "E. ELLIS",
    0,
    0.02,
    0.23,
    0.4,
    0.12,
    0,
    { bg: "#c4b292", fg: "#32372d", size: 32 },
    suitcase,
  );
  memories.push(suitcase);
  target("suitcase", 4.5, 3.38, -12.2, 5, new THREE.Vector3(0, 0, 1));
  // Tiny bathroom at the connecting door, with a tub and a wall-mounted basin.
  solid(0.75, 0.75, 0.5, 0.4, 3.475, -14.5, mats.ivory);
  round(0.64, 0.08, 0.38, 0.4, 3.91, -14.5, mats.paper);
  box(0.62, 0.65, 0.025, 0.4, 4.7, -14.85, mats.glass);
  link([0.5, 3.94, -14.7], [0.5, 4.17, -14.7], 0.018, mats.metal);
  // Locket is an ordinary physical object, not another photographed gate.
  const locket = groupAt(12.8, 3.8, -13.6);
  ball(0.07, 0.065, 0.015, 0, 0, 0, mats.brass, locket);
  const letter = sign(
    "FOR LENA\nREMEMBER ME",
    12.8,
    3.79,
    -13.3,
    0.37,
    0.3,
    0,
    { bg: "#cbbba0", fg: "#352d27", size: 31 },
  );
  letter.rotation.x = -Math.PI / 2;
  interact(
    "locket",
    "Read Evelyn's letter / take her locket",
    12.8,
    3.84,
    -13.5,
    2.5,
    (s) => !!s.doors.room7,
  );
  // A weathered estate car: curved bodywork, glazed cabin, wheels and roof rack.
  function car(x, z, mat = mats.fabric, parent = scene) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    round(1.8, 0.54, 3.65, 0, 0.65, 0, mat, g, 0.16);
    round(1.58, 0.66, 1.92, 0, 1.19, -0.05, mats.glass, g, 0.16);
    round(1.65, 0.08, 1.98, 0, 1.54, -0.05, mat, g, 0.04);
    box(0.07, 0.62, 1.94, -0.8, 1.18, -0.05, mat, g);
    box(0.07, 0.62, 1.94, 0.8, 1.18, -0.05, mat, g);
    for (const a of [-0.88, 0.88])
      for (const b of [-1.12, 1.12]) {
        const wheel = cylinder(0.34, 0.18, a, 0.36, b, mats.black, g);
        wheel.rotation.z = Math.PI / 2;
        const hub = cylinder(0.16, 0.19, a, 0.36, b, mats.metal, g);
        hub.rotation.z = Math.PI / 2;
      }
    for (const a of [-0.59, 0.59]) {
      round(0.35, 0.17, 0.06, a, 0.71, -1.84, mats.ivory, g, 0.025);
      round(0.31, 0.12, 0.06, a, 0.7, 1.84, mats.red, g, 0.015);
    }
    box(1.64, 0.09, 0.12, 0, 0.41, -1.86, mats.metal, g);
    box(1.64, 0.09, 0.12, 0, 0.41, 1.86, mats.metal, g);
    return g;
  }
  const playerCar = car(2, 16);
  bounds(1.9, 1.7, 3.9, 2, 0.85, 16);
  interact("car", "Get into your car", 0.95, 1.1, 16, 2.5);
  const memoryCar = car(7, 16, mats.wood);
  memories.push(memoryCar);
  for (const x of [0.2, 3.8, 5.2, 8.8])
    box(0.07, 0.008, 4.8, x, 0.012, 16, mats.ivory);
  // The original summer photograph is rendered from these same family models
  // during setup; the game never awards evidence for this supplied print.
  const shadowMat = new THREE.MeshBasicMaterial({
    color: "#10191b",
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  function contact(x, z, w, d, y = 0, parent = scene) {
    const m = mesh(
      new THREE.CircleGeometry(0.5, 24),
      shadowMat,
      x,
      y + 0.012,
      z,
      parent,
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(w, d, 1);
    m.castShadow = false;
    return m;
  }
  const people = cinemaCharacters(scene, mats, contact, floorAt);
  const clerk = people(-11, 10.9, "#58645a", "manager");
  cylinder(0.125, 0.085, 0, 0.175, 0, mats.dark, clerk.userData.head);
  round(
    0.23,
    0.018,
    0.16,
    0,
    0.14,
    0.105,
    mats.dark,
    clerk.userData.head,
    0.015,
  );
  clerk.rotation.y = Math.PI;
  const badge = sign(
    "NIGHT PORTER",
    -0.12,
    1.38,
    0.15,
    0.12,
    0.06,
    0,
    { bg: "#b8a178", fg: "#292b23", size: 26 },
    clerk.userData.body,
  );
  const keyring =
    clerk.userData.hands.right || Object.values(clerk.userData.hands)[0];
  if (keyring)
    for (let i = 0; i < 3; i++)
      box(0.025, 0.15, 0.015, -0.03 + i * 0.027, -0.14, 0, mats.brass, keyring);
  const mother = people(11, -7.55, "#89928b", "ada");
  mother.rotation.y = 0;
  mother.visible = false;
  target("final", 11, 4.55, -7.55, 30, new THREE.Vector3(0, 0, 1));
  const memoryLight = new THREE.PointLight(0xd5dfdd, 0, 6, 2);
  memoryLight.position.set(11, 5.1, -5.6);
  scene.add(memoryLight);
  const father = people(6, -0.5, "#776856", "manager");
  father.visible = false;
  const child = people(6.8, -0.5, "#9e776d", "audience");
  child.scale.setScalar(0.58);
  child.visible = false;
  // Original motel identity, attached lettering, practical lights and details.
  const neon = new THREE.MeshStandardMaterial({
    color: "#dca788",
    emissive: "#d64d34",
    emissiveIntensity: 1.5,
  });
  box(0.17, 4.9, 0.17, 12.7, 2.45, 17.9, mats.metal);
  box(2.2, 1.45, 0.18, 12.7, 4.3, 17.9, mats.dark);
  sign("BRIAR GLEN\nVACANCY", 12.7, 4.3, 18.005, 2, 1.23, 0, {
    bg: "#283d3b",
    fg: "#e6aa88",
    size: 44,
  });
  for (const x of [11.64, 13.76]) box(0.025, 1.4, 0.02, x, 4.3, 18.01, neon);
  light(12.4, 3.8, 17.6, 13);
  for (const x of [-5.7, 13.7])
    for (const z of [5, 13]) {
      box(0.12, 2.8, 0.12, x, 1.4, z, mats.metal);
      ball(0.16, 0.18, 0.16, x, 2.75, z, coldGlow);
      light(x, 2.5, z, 9, true);
    }
  for (const z of [10.8, 12]) chair(12.8, z, -Math.PI / 2);
  for (let i = 0; i < 40; i++) {
    const angle = rnd() * Math.PI * 2,
      radius = 24 + rnd() * 35,
      x = Math.cos(angle) * radius,
      z = 5 + Math.sin(angle) * radius,
      h = 6 + rnd() * 7;
    cylinder(0.2, h, x, h / 2, z, mats.dark, scene, 0.07);
    for (let j = 0; j < 6; j++) {
      const a = angle + j * 2.4,
        y = h * (0.35 + j * 0.075),
        reach = 1.5 + rnd() * 2,
        tip = [x + Math.cos(a) * reach, y + 1.5, z + Math.sin(a) * reach];
      link([x, y, z], tip, 0.055, mats.dark);
      link(
        tip,
        [tip[0] + Math.cos(a + 0.5), tip[1] + 1.3, tip[2] + Math.sin(a + 0.5)],
        0.022,
        mats.dark,
      );
      link(
        [tip[0] * 0.4 + x * 0.6, y + 0.6, tip[2] * 0.4 + z * 0.6],
        [tip[0] + Math.cos(a - 0.8), tip[1] + 0.6, tip[2] + Math.sin(a - 0.8)],
        0.025,
        mats.dark,
      );
    }
  }
  // Rain is confined outdoors and has no full-screen static component.
  const rainPositions = new Float32Array(420 * 6);
  for (let i = 0; i < 420; i++) {
    const x = -5.5 + rnd() * 19,
      y = rnd() * 9,
      z = -5.5 + rnd() * 25;
    rainPositions.set([x, y, z, x - 0.025, y - 0.2, z + 0.035], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({
      color: "#adc3c6",
      transparent: true,
      opacity: 0.22,
    }),
  );
  scene.add(rain);
  scene.add(new THREE.HemisphereLight(0x7796ad, 0x302c22, 0.5));
  const liveLights = Array.from({ length: 10 }, () => {
    const l = new THREE.PointLight(0xffd3a0, 0, 11, 2);
    scene.add(l);
    return l;
  });
  const moon = new THREE.DirectionalLight(0x819eae, 0.52);
  moon.position.set(15, 20, 4);
  scene.add(moon);
  function syncDoors(dt = 0) {
    for (const d of doors) {
      d.amount = dt
        ? THREE.MathUtils.damp(d.amount, doorState[d.id] ? 1 : 0, 8, dt)
        : doorState[d.id]
          ? 1
          : 0;
      d.pivot.rotation.y = -d.amount * Math.PI * 0.49;
      d.group.visible = d.id !== "room7" || !!getState().evidence.doorway;
      d.group.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(d.leaf);
      Object.assign(d.opened, {
        x1: b.min.x,
        x2: b.max.x,
        z1: b.min.z,
        z2: b.max.z,
        y1: b.min.y,
        y2: b.max.y,
      });
    }
  }
  syncDoors();
  // Batch only immutable objects; articulated actors, door leaves, photographic
  // layers and collected props remain independently controlled.
  const dynamic = new Set([
    clerk,
    mother,
    father,
    child,
    ...memories,
    ...doors.map((d) => d.group),
    paintCover,
    key,
    bag,
    locket,
    rain,
    familyPhoto,
  ]);
  scene.updateMatrixWorld(true);
  const batches = new Map(),
    remove = [];
  scene.traverse((o) => {
    if (!o.isMesh || occluders.includes(o)) return;
    for (let p = o; p; p = p.parent) if (dynamic.has(p)) return;
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
      id = `${o.material.uuid}/${Math.floor(p.x / 10)}/${Math.floor(p.z / 10)}`;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    if (!batches.has(id)) batches.set(id, { mat: o.material, geometries: [] });
    batches.get(id).geometries.push(g);
    remove.push(o);
  });
  remove.forEach((o) => o.removeFromParent());
  for (const { mat, geometries } of batches.values()) {
    const g = mergeGeometries(geometries, false);
    if (g) {
      const m = new THREE.Mesh(g, mat);
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }
    geometries.forEach((g) => g.dispose());
  }
  function update(s, dt, t, player, photo = false) {
    syncDoors(dt);
    paintCover.visible = !s.evidence.doorway;
    for (const m of memories) m.visible = photo;
    memoryDoor.visible = photo && !s.evidence.doorway;
    key.visible = !!s.evidence.pool && !s.items.key;
    bag.visible = !!s.items.bag;
    locket.visible = !s.items.locket;
    clerk.position.set(
      s.clerk.x,
      floorAt(s.clerk.x, s.clerk.z) || 0,
      s.clerk.z,
    );
    updateObserverAnimation(clerk, dt, t, player, floorAt);
    if (!s.events.awake) clerk.rotation.y = Math.PI;
    mother.visible = photo && !!s.events.departure;
    memoryLight.intensity = mother.visible ? 18 : 0;
    rain.position.y = -((t * 5) % 3);
    const nearest = [...lamps]
      .sort(
        (a, b) =>
          (a.x - player.x) ** 2 +
          (a.z - player.z) ** 2 +
          (a.y - (floorAt(player.x, player.z) || 0) - 1.6) ** 2 -
          ((b.x - player.x) ** 2 +
            (b.z - player.z) ** 2 +
            (b.y - (floorAt(player.x, player.z) || 0) - 1.6) ** 2),
      )
      .slice(0, 10);
    for (let i = 0; i < 10; i++) {
      const f = nearest[i],
        l = liveLights[i];
      l.position.set(f.x, f.y, f.z);
      l.color.setHex(f.color);
      l.intensity = f.power;
    }
  }
  return {
    nav,
    solids,
    occluders,
    doors,
    targets,
    interactions,
    clerk,
    mother,
    father,
    child,
    familyPhoto,
    memories,
    architecture,
    ready: people.ready,
    update,
    syncDoors,
    makeCamera: (parent) => makeCamera(parent, mats),
  };
}
