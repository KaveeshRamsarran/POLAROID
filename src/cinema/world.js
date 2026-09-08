import * as THREE from "three";
import { createSurface, repeatMaterial, surfaceKinds } from "../materials.js";
import { modelTools } from "../shared/model-tools.js";
import { makeCamera } from "../shared/camera-model.js";
import { updateObserverAnimation } from "../observer-animation.js";
import { REGIONS, floorAt, navigation } from "./logic.js";

export function buildCinema(scene, state) {
  const mats = {};
  const colours = {
    wall: "#b5aa8e",
    wood: "#665039",
    fabric: "#763e40",
    metal: "#6e736d",
    skin: "#b8a18a",
    concrete: "#858d83",
    tile: "#a6987d",
    dark: "#242421",
    black: "#121412",
    paper: "#ded3b0",
    ivory: "#c6bd9e",
    glass: "#253d38",
    red: "#883c32",
    rust: "#644330",
    brass: "#a18a52",
  };
  for (const [key, color] of Object.entries(colours))
    mats[key] = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.84,
      metalness: ["metal", "brass"].includes(key) ? 0.6 : 0,
    });
  for (const kind of surfaceKinds) {
    Object.assign(mats[kind], createSurface(kind));
    mats[kind].normalScale.setScalar(0.45);
  }
  // Bellwether's maintained foyer uses cream paint with subtle aging. The
  // shared green, damp Blackwood textures remain untouched.
  const paintCanvas = document.createElement("canvas");
  paintCanvas.width = paintCanvas.height = 1024;
  const paintContext = paintCanvas.getContext("2d");
  paintContext.drawImage(mats.wall.map.image, 0, 0);
  const paintPixels = paintContext.getImageData(0, 0, 1024, 1024);
  for (let i = 0; i < paintPixels.data.length; i += 4) {
    paintPixels.data[i] = 196 + (paintPixels.data[i] - 137) * 0.35;
    paintPixels.data[i + 1] = 184 + (paintPixels.data[i + 1] - 151) * 0.35;
    paintPixels.data[i + 2] = 162 + (paintPixels.data[i + 2] - 130) * 0.35;
  }
  paintContext.putImageData(paintPixels, 0, 0);
  mats.wall.map.dispose();
  mats.wall.map = new THREE.CanvasTexture(paintCanvas);
  mats.wall.map.colorSpace = THREE.SRGBColorSpace;
  mats.wall.map.wrapS = mats.wall.map.wrapT = THREE.RepeatWrapping;
  mats.wall.map.anisotropy = 16;
  mats.wall.color.set("#ffffff");
  mats.wall.normalScale.setScalar(0.22);
  const { box, round, ball, cylinder, sign, mesh, link } = modelTools(
    scene,
    mats,
  );
  const solids = [],
    occluders = [],
    targets = {},
    interactions = [],
    lights = [],
    reelWheels = [],
    doors = [];
  const nav = navigation(solids, state.doors);
  function solid(w, h, d, x, y, z, mat = mats.wall, door) {
    const m = box(w, h, d, x, y, z, mat);
    solids.push({
      x1: x - w / 2,
      x2: x + w / 2,
      z1: z - d / 2,
      z2: z + d / 2,
      y1: y - h / 2,
      y2: y + h / 2,
      door,
    });
    occluders.push(m);
    return m;
  }
  function wallX(x, z1, z2, h = 6.2, base = 0) {
    return solid(
      0.22,
      h,
      z2 - z1,
      x,
      base + h / 2,
      (z1 + z2) / 2,
      repeatMaterial(mats.wall, (z2 - z1) / 3, h / 3),
    );
  }
  function wallZ(z, x1, x2, h = 6.2, base = 0) {
    return solid(
      x2 - x1,
      h,
      0.22,
      (x1 + x2) / 2,
      base + h / 2,
      z,
      repeatMaterial(mats.wall, (x2 - x1) / 3, h / 3),
    );
  }
  function lintelX(x, z1, z2, base = 2.5, top = 6.2) {
    wallX(x, z1, z2, top - base, base);
  }
  function lintelZ(z, x1, x2, base = 2.5, top = 6.2) {
    wallZ(z, x1, x2, top - base, base);
  }
  function light(x, y, z, color = "#ffe2aa", power = 12, distance = 11) {
    const l = new THREE.PointLight(color, power, distance, 1.8);
    l.position.set(x, y, z);
    scene.add(l);
    lights.push(l);
    ball(
      0.13,
      0.1,
      0.13,
      x,
      y + 0.08,
      z,
      new THREE.MeshBasicMaterial({ color }),
    );
    return l;
  }
  function label(text, x, y, z, w = 1.1, h = 0.25, rot = 0, opts = {}) {
    const lines = text.split("\n"),
      height = Math.max(128, Math.round((1024 * h) / w));
    const size = Math.floor(
      Math.min(
        height / (lines.length * 1.5 + 0.5),
        900 / (Math.max(...lines.map((l) => l.length)) * 0.62),
      ),
    );
    return sign(text, x, y, z, w, h, rot, {
      bg: "#262724",
      fg: "#dfd2ac",
      ...opts,
      w: 1024,
      h: height,
      size,
    });
  }
  function interact(id, labelText, x, y, z, range = 2.5) {
    interactions.push({
      id,
      label: labelText,
      position: new THREE.Vector3(x, y, z),
      range,
    });
  }
  function target(id, x, y, z, options = {}) {
    targets[id] = { id, position: new THREE.Vector3(x, y, z), ...options };
  }
  // Interior footprints have complete floors and roofs. The final loading
  // court opens to the night behind a solid perimeter and iron fence.
  for (const r of REGIONS) {
    if (r.ramp) continue;
    const y = r.y,
      w = r.x2 - r.x1,
      d = r.z2 - r.z1,
      cx = (r.x1 + r.x2) / 2,
      cz = (r.z1 + r.z2) / 2;
    const floor = ["Auditorium", "Lobby"].includes(r.name)
      ? mats.fabric
      : mats.concrete;
    box(w, 0.2, d, cx, y - 0.1, cz, repeatMaterial(floor, w / 2, d / 2));
    const roof =
      r.name === "Lobby"
        ? 3.8
        : r.name === "Projection booth"
          ? 6.8
          : r.name === "Stair landing"
            ? 7
            : r.name === "Outside"
              ? 5
              : 6.2;
    if (r.name !== "Outside")
      box(
        w,
        0.2,
        d,
        cx,
        roof + 0.1,
        cz,
        repeatMaterial(mats.dark, w / 3, d / 3),
      );
  }
  wallZ(22, -10, 10);
  wallZ(14, -14, -10);
  wallZ(14, 10, 14);
  wallX(-10, 14, 22);
  wallX(10, 14, 22);
  wallX(-10, -24, -23);
  wallX(-10, -21, 10);
  wallX(-10, 12, 14);
  lintelX(-10, 10, 12);
  lintelX(-10, -23, -21);
  wallZ(-24, -14, 10);
  wallX(10, -24, -9);
  wallZ(-20, -10, -8);
  wallZ(-20, -6, 10);
  lintelZ(-20, -8, -6);
  wallZ(4, -10, -1.3);
  wallZ(4, 1.3, 10);
  lintelZ(4, -1.3, 1.3);
  wallX(10, -9, 0, 4.05);
  wallX(10, -9, 0, 0.8, 6); // booth window: true opening
  wallX(10, 0, 12, 7);
  lintelX(10, 12, 14, 2.6, 7);
  wallX(14, 0, 14, 7);
  wallZ(0, 13, 18, 3.2, 3.6);
  wallZ(0, 10, 11, 3.2, 3.6);
  lintelZ(0, 11, 13, 6.1, 6.8);
  wallX(18, -9, 0, 6.8);
  wallZ(-9, 10, 18, 6.8);
  wallX(-14, -24, -19);
  wallX(-14, -17, -2);
  wallX(-14, 0, 14);
  lintelX(-14, -19, -17);
  lintelX(-14, -2, 0);
  wallX(-22, -10, 2);
  wallZ(-10, -22, -14);
  wallZ(2, -22, -14);
  wallX(-20, -22, -14, 1.2);
  wallZ(-22, -20, -14, 3.2);
  wallZ(-14, -20, -14, 3.2);
  for (let z = -21.8; z < -14; z += 0.3)
    box(0.07, 1.7, 0.035, -19.9, 2.03, z, mats.metal);
  for (const y of [1.3, 2.7]) box(0.07, 0.04, 7.8, -19.9, y, -18, mats.metal);
  // Distant silhouettes stay below the sightline of the surrounding cinema.
  for (let i = 0; i < 5; i++)
    box(1.1, 2.5 + (i % 2), 2.2, -24 - i * 0.8, 1.2, -23 + i * 2.8, mats.dark);
  const wet = mats.concrete.clone();
  wet.roughness = 0.18;
  wet.metalness = 0.2;
  box(3.4, 0.012, 2.5, -17, 0.016, -18, wet);
  // Dado rails, pilasters and poster cases break up broad plaster surfaces.
  for (const side of [-1, 1]) {
    box(0.055, 0.11, 23.6, side * 9.85, 1.35, -8, mats.brass);
    box(
      0.055,
      1.15,
      23.6,
      side * 9.86,
      0.59,
      -8,
      repeatMaterial(mats.wood, 8, 1),
    );
    for (const z of [-17, -11, -5, 1]) {
      box(0.32, 4.6, 0.46, side * 9.7, 2.3, z, mats.wood);
      box(0.36, 0.16, 0.52, side * 9.7, 3.6, z, mats.brass);
      box(
        0.09,
        0.65,
        0.23,
        side * 9.46,
        2.8,
        z,
        new THREE.MeshBasicMaterial({ color: "#c29969" }),
      );
    }
    box(
      8.4,
      1.1,
      0.055,
      side * 5.6,
      0.58,
      4.15,
      repeatMaterial(mats.wood, 3, 1),
    );
    box(8.4, 0.06, 0.08, side * 5.6, 1.18, 4.17, mats.brass);
    label(
      side < 0
        ? "THE BLUE HOUR\nA FILM BY E. WARD\nONE WEEK ONLY"
        : "THE LONG WAY HOME\nBELLWETHER CINEMA\nFINAL ENGAGEMENT",
      side * 5.5,
      2.55,
      4.16,
      1.8,
      2.2,
      0,
      { bg: side < 0 ? "#33474d" : "#694236", fg: "#ccb88e", size: 29 },
    );
    box(2, 0.075, 0.08, side * 5.5, 3.71, 4.22, mats.brass);
    box(2, 0.075, 0.08, side * 5.5, 1.39, 4.22, mats.brass);
  }
  for (const x of [-2.3, 2.3]) {
    box(0.32, 3, 0.4, x, 1.5, 4.15, mats.wood);
    box(0.38, 0.12, 0.45, x, 3.05, 4.15, mats.brass);
  }
  label("SCREEN ONE", 0, 3.45, 4.17, 2.6, 0.38, 0, {
    bg: "#322d25",
    fg: "#bcaa7b",
  });
  for (let i = 0; i < 24; i++) {
    const x = Math.sin(i * 17) * 8,
      z = 5 + (i % 9) * 0.8;
    const stub = box(0.08, 0.006, 0.15, x, 0.015, z, mats.paper);
    stub.rotation.y = i;
  }
  // Stair risers meet the landing; their upper enclosure cannot expose the map.
  for (let i = 0; i < 24; i++)
    box(
      4,
      (i + 1) * 0.15,
      0.5,
      12,
      (i + 1) * 0.075,
      11.75 - i * 0.5,
      mats.concrete,
    );
  box(4, 0.2, 12, 12, 7.1, 6, mats.dark);
  for (const x of [10.25, 13.75]) {
    link([x, 0.9, 12], [x, 4.5, 0], 0.035, mats.brass);
    for (let i = 0; i < 7; i++)
      cylinder(0.025, 0.9, x, 3.6 - i * 0.6 + 0.45, i * 2, mats.brass);
  }
  // Hinged leaves stay in the room when open. Unlocked doors are usable by both actors.
  function door(
    id,
    text,
    x,
    z,
    width,
    rotation = 0,
    base = 0,
    rightHinge = false,
  ) {
    const hinge = new THREE.Group();
    hinge.position.set(x, base, z);
    hinge.rotation.y = rotation;
    scene.add(hinge);
    const leaf = new THREE.Group();
    hinge.add(leaf);
    round(
      width - 0.012,
      2.46,
      0.105,
      width / 2,
      1.25,
      0,
      id === "exit" ? mats.metal : mats.wood,
      leaf,
      0.018,
    );
    for (const face of [-1, 1]) {
      box(
        width - 0.22,
        0.5,
        0.024,
        width / 2,
        0.35,
        face * 0.07,
        mats.brass,
        leaf,
      );
      round(
        width - 0.3,
        0.75,
        0.023,
        width / 2,
        1.67,
        face * 0.066,
        mats.dark,
        leaf,
        0.02,
      );
      sign(
        text,
        width / 2,
        1.68,
        face * 0.084,
        width - 0.35,
        0.35,
        face < 0 ? Math.PI : 0,
        { size: 36, bg: "#242b28", fg: "#e3d2a7" },
        leaf,
      );
      box(0.07, 0.32, 0.05, width - 0.22, 1.03, face * 0.087, mats.brass, leaf);
      round(
        0.23,
        0.04,
        0.055,
        width - 0.29,
        1.1,
        face * 0.14,
        mats.brass,
        leaf,
        0.012,
      );
    }
    for (const h of [0.35, 1.2, 2.1])
      cylinder(0.035, 0.14, 0.025, h, 0.06, mats.brass, leaf);
    for (const edge of [0, width].filter(
      (edge) =>
        id !== "auditorium" || (rightHinge ? edge === width : edge === 0),
    ))
      box(0.085, 2.5, 0.2, edge, 1.25, 0, mats.wood, hinge);
    box(width + 0.08, 0.1, 0.2, width / 2, 2.5, 0, mats.wood, hinge);
    const alongX = Math.abs(rotation) < 0.1;
    const cx = x + (alongX ? width / 2 : 0),
      cz = z + (alongX ? 0 : width / 2);
    solids.push({
      x1: cx - (alongX ? width / 2 : 0.055),
      x2: cx + (alongX ? width / 2 : 0.055),
      z1: cz - (alongX ? 0.055 : width / 2),
      z2: cz + (alongX ? 0.055 : width / 2),
      y1: base,
      y2: base + 2.4,
      door: id,
    });
    leaf.traverse((o) => {
      if (o.isMesh) occluders.push(o);
    });
    if (rightHinge) {
      leaf.position.x = width;
      leaf.children.forEach((child) => (child.position.x = -child.position.x));
    }
    const angle =
      id === "auditorium" && !rightHinge ? -Math.PI / 2 : Math.PI / 2;
    const pivotX = x + (rightHinge ? width : 0);
    const openX =
      pivotX +
      ((Math.cos(rotation + angle) * width) / 2) * (rightHinge ? -1 : 1);
    const openZ =
      z - ((Math.sin(rotation + angle) * width) / 2) * (rightHinge ? -1 : 1);
    const openW = alongX ? 0.105 : width,
      openD = alongX ? width : 0.105;
    solids.push({
      x1: openX - openW / 2,
      x2: openX + openW / 2,
      z1: openZ - openD / 2,
      z2: openZ + openD / 2,
      y1: base,
      y2: base + 2.4,
      door: id,
      openLeaf: true,
    });
    doors.push({
      id,
      leaf,
      x: cx,
      z: cz,
      y: base,
      angle,
    });
    if (!["exit", "booth"].includes(id) && !rightHinge)
      interact(
        "door:" + id,
        "Open / close " + text.toLowerCase(),
        cx,
        base + 1.2,
        cz,
        2.6,
      );
  }
  door("booth", "PROJECTION", 11, 0, 2, 0, 3.6);
  door("auditorium", "SCREEN ONE", -1.3, 4, 1.3);
  door("auditorium", "SCREEN ONE", 0, 4, 1.3, 0, 0, true);
  door("archive", "FILM ARCHIVE", -14, -2, 2, -Math.PI / 2);
  door("service", "STAFF ONLY", -10, 10, 2, -Math.PI / 2);
  door("backstage", "BACKSTAGE", -8, -20, 2);
  door("exit", "PUSH TO EXIT", -14, -19, 2, -Math.PI / 2);
  label("FILM ARCHIVE", -13.85, 2.9, -1, 1.8, 0.3, Math.PI / 2);
  label("STAFF ONLY / ARCHIVE", -9.83, 2.95, 11, 2.3, 0.32, Math.PI / 2);
  label("PROJECTION / UPSTAIRS", 9.82, 2.95, 13, 2.4, 0.32, -Math.PI / 2);
  label("BACKSTAGE", -7, 3.2, -19.83, 1.8, 0.3);
  label("SERVICE EXIT  >", -11.98, 2.3, -2.8, 1.8, 0.28);
  label("LOBBY  >", -13.83, 2.6, 11, 1.5, 0.28, Math.PI / 2);
  const exitCover = box(0.03, 2.55, 2, -13.91, 1.275, -18, mats.wall);
  label("EXIT", -13.8, 2.85, -18, 1.1, 0.28, Math.PI / 2, {
    bg: "#4b231e",
    fg: "#f6b0a1",
  });
  label("EXIT", 0, 2.85, 3.83, 1, 0.28, Math.PI, {
    bg: "#4b231e",
    fg: "#efb7a3",
  });
  label("EXIT", -7, 2.8, -19.85, 1, 0.25, 0, { bg: "#4b231e", fg: "#efb7a3" });
  // Screen and curtains. The frame is generated in-world, never pasted into a photograph.
  const screenCanvas = document.createElement("canvas");
  screenCanvas.width = 1024;
  screenCanvas.height = 512;
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  const screen = box(
    13.4,
    4.4,
    0.06,
    0,
    3.15,
    -19.78,
    new THREE.MeshBasicMaterial({ map: screenTexture }),
  );
  for (const side of [-1, 1])
    for (let i = 0; i < 9; i++)
      cylinder(0.16, 5.7, side * (7 + i * 0.23), 2.9, -19.4, mats.fabric);
  box(17, 0.4, 0.6, 0, 5.8, -19.45, mats.fabric);
  // Burgundy seats look toward -Z. Both armrests and numbered backs are readable.
  const xs = [-6.5, -5.2, -3.9, -2.6, 2.6, 3.9, 5.2, 6.5],
    zs = [-13, -10.8, -8.6, -6.4, -4.2, -2];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 8; col++) {
      const x = xs[col],
        z = zs[row],
        seat = new THREE.Group();
      scene.add(seat);
      seat.position.set(x, 0, z);
      const back = round(
        0.72,
        0.9,
        0.18,
        0,
        0.85,
        0.27,
        mats.wood,
        seat,
        0.065,
      );
      back.rotation.x = -0.07;
      round(0.65, 0.78, 0.11, 0, 0.86, 0.155, mats.fabric, seat, 0.05);
      for (const side of [-1, 1])
        link(
          [side * 0.29, 0.54, 0.098],
          [side * 0.29, 1.16, 0.14],
          0.008,
          mats.red,
          seat,
        );
      for (const x of [-0.18, 0.18])
        ball(0.024, 0.018, 0.013, x, 0.93, 0.089, mats.red, seat);
      box(0.5, 0.045, 0.4, 0, 0.34, 0, mats.metal, seat);
      round(0.7, 0.15, 0.65, 0, 0.47, 0, mats.fabric, seat, 0.04);
      for (const side of [-1, 1]) {
        box(0.07, 0.5, 0.08, side * 0.41, 0.28, 0.08, mats.metal, seat);
        round(0.11, 0.075, 0.62, side * 0.4, 0.72, 0, mats.wood, seat, 0.025);
      }
      label(
        `${String.fromCharCode(65 + row)}${col + 1}`,
        x,
        0.9,
        z + 0.365,
        0.25,
        0.13,
      );
      solids.push({
        x1: x - 0.44,
        x2: x + 0.44,
        z1: z - 0.35,
        z2: z + 0.4,
        y1: 0,
        y2: 1.3,
      });
      seat.traverse((o) => {
        if (o.isMesh) occluders.push(o);
      });
      if (row === 3 && col === 2) {
        box(0.33, 0.012, 0.25, x, 0.554, z, mats.black);
        target("seats", x, 0.56, z, { maxDistance: 7 });
      }
    }
  for (let row = 0; row < 6; row++) {
    const z = zs[row];
    label(String.fromCharCode(65 + row), -9.85, 1, z, 0.32, 0.42, Math.PI / 2);
    label(String.fromCharCode(65 + row), 9.85, 1, z, 0.32, 0.42, -Math.PI / 2);
  }
  for (const x of [-8.8, 8.8, 0])
    for (let z = -15; z < 4; z += 3)
      box(
        0.05,
        0.01,
        0.34,
        x,
        0.015,
        z,
        new THREE.MeshBasicMaterial({ color: "#9e7846" }),
      );
  // The larger foyer has separate ticketing, concessions and a waiting lounge.
  // All large furniture contributes to the same collision map as the architecture.
  solid(5, 1.05, 1.25, -5, 0.525, 20.8, mats.wood);
  round(5.15, 0.09, 1.4, -5, 1.09, 20.8, mats.brass);
  round(0.6, 0.28, 0.45, -5.5, 1.27, 20.7, mats.dark);
  label("PLAY / MANAGER", -5.5, 1.28, 20.45, 0.55, 0.12, Math.PI);
  for (let i = 0; i < 6; i++)
    box(0.045, 0.018, 0.05, -5.7 + i * 0.075, 1.42, 20.65, mats.ivory);
  round(0.6, 0.35, 0.5, -3.3, 1.28, 20.8, mats.ivory);
  box(0.43, 0.05, 0.025, -3.3, 1.25, 20.535, mats.black);
  label("TICKETS / BELLWETHER", -5, 2.8, 21.84, 4.5, 0.6, Math.PI, {
    bg: "#3c2527",
    fg: "#dac99f",
  });
  const ticket = box(0.19, 0.009, 0.4, -3.3, 1.145, 20.33, mats.paper);
  ticket.visible = false;
  box(0.65, 0.009, 0.8, -6.5, 1.146, 20.7, mats.paper);
  interact("message", "Play the manager recording", -5.5, 1.3, 20.2);
  interact("ticket", "Take the printed ticket", -3.3, 1.3, 20.2);
  interact("film", "Emergency film supply", -7, 1.3, 20.2);
  box(0.45, 0.2, 0.35, -7, 1.24, 20.6, mats.paper);
  label("FILM", -7, 1.3, 20.4, 0.3, 0.13, Math.PI);
  // Panelled concession counter faces the centre of the lobby.
  solid(1.25, 1.05, 6, 8.25, 0.525, 16.9, mats.wood);
  round(1.45, 0.09, 6.2, 8.25, 1.1, 16.9, mats.brass);
  for (let z = 14.25; z < 19.7; z += 0.6)
    box(0.026, 0.76, 0.035, 7.61, 0.55, z, mats.brass);
  label("CONCESSIONS", 9.84, 3.1, 16.9, 3, 0.45, -Math.PI / 2);
  label(
    "POPCORN  1.50\nCOLA  .75\nCOFFEE  1.00",
    9.83,
    2.1,
    15.1,
    1.3,
    1.1,
    -Math.PI / 2,
    { bg: "#3c2527", fg: "#e0c7a0" },
  );
  const clearGlass = new THREE.MeshStandardMaterial({
    color: "#a7bcac",
    transparent: true,
    opacity: 0.18,
    roughness: 0.15,
    metalness: 0.15,
    depthWrite: false,
  });
  box(0.8, 0.1, 1.05, 8.2, 1.23, 18.4, mats.red);
  box(0.8, 0.12, 1.05, 8.2, 2.18, 18.4, mats.red);
  for (const x of [7.84, 8.56])
    for (const z of [17.92, 18.88]) cylinder(0.025, 0.9, x, 1.7, z, mats.brass);
  box(0.78, 0.84, 1, 8.2, 1.7, 18.4, clearGlass);
  for (let i = 0; i < 120; i++)
    ball(
      0.022,
      0.017 + (i % 3) * 0.003,
      0.02,
      7.92 + (Math.sin(i * 14.3) + 1) * 0.27,
      1.31 + (Math.sin(i * 2.2) + 1) * 0.035,
      18.02 + (Math.sin(i * 19.9) + 1) * 0.38,
      mats.ivory,
    );
  cylinder(0.22, 0.18, 8.2, 1.92, 18.4, mats.metal);
  label("FRESH POPCORN", 7.79, 2.18, 18.4, 0.95, 0.18, -Math.PI / 2, {
    bg: "#652b2a",
    fg: "#f1dfba",
  });
  for (let i = 0; i < 5; i++) {
    cylinder(0.085, 0.27, 8.2, 1.28, 14.4 + i * 0.25, mats.paper);
    box(0.015, 0.15, 0.015, 8.2, 1.48, 14.4 + i * 0.25, mats.red);
  }
  round(0.6, 0.3, 0.7, 8.2, 1.32, 16.3, mats.dark);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 4; col++)
      box(
        0.055,
        0.025,
        0.055,
        8.07 + row * 0.085,
        1.485,
        16.17 + col * 0.083,
        mats.ivory,
      );
  box(0.03, 0.18, 0.37, 8.36, 1.52, 16.3, mats.black);
  label("0.00", 8.335, 1.53, 16.3, 0.3, 0.12, -Math.PI / 2, { fg: "#9cab76" });
  round(0.6, 0.18, 0.35, 8.15, 1.28, 17.2, mats.fabric);
  interact("belongings", "Inspect lost property", 7.6, 1.3, 17.2);
  // Upholstered waiting bench, individual cushions, seams and turned feet.
  solid(1.2, 0.8, 3.5, -8.8, 0.4, 16.5, mats.wood);
  round(0.22, 1.1, 3.6, -9.28, 0.76, 16.5, mats.fabric);
  for (let i = 0; i < 3; i++) {
    round(0.9, 0.2, 1.08, -8.7, 0.61, 15.35 + i * 1.15, mats.fabric);
    round(0.16, 0.72, 1.07, -9.13, 0.95, 15.35 + i * 1.15, mats.fabric);
    box(0.78, 0.012, 0.015, -8.66, 0.71, 14.84 + i * 1.15, mats.brass);
  }
  for (const z of [14.66, 18.34])
    round(1.2, 0.17, 0.17, -8.8, 0.95, z, mats.wood);
  solid(1.05, 0.48, 2.2, -6.7, 0.24, 16.5, mats.wood);
  round(1.12, 0.065, 2.28, -6.7, 0.51, 16.5, mats.wood);
  for (let i = 0; i < 3; i++) {
    const magazine = box(
      0.35,
      0.015,
      0.48,
      -6.7 + i * 0.05,
      0.555 + i * 0.016,
      16.2 + i * 0.15,
      i % 2 ? mats.paper : mats.red,
    );
    magazine.rotation.y = i * 0.22;
  }
  // Entrance doors, brass glazing bars, push plates and a closing notice.
  for (const x of [-0.85, 0.85]) {
    box(1.6, 2.8, 0.12, x, 1.4, 21.79, mats.wood);
    box(1.38, 1.75, 0.035, x, 1.73, 21.7, mats.glass);
    for (const dx of [-0.74, 0.74])
      box(0.045, 2.7, 0.035, x + dx, 1.4, 21.67, mats.brass);
    box(1.38, 0.055, 0.07, x, 1.17, 21.64, mats.brass);
    label("CLOSED", x, 1.8, 21.665, 0.62, 0.22, Math.PI);
  }
  label("BELLWETHER CINEMA / 1936", 0, 3.25, 21.82, 3.7, 0.4, Math.PI);
  // Low queue ropes leave the central entrance-to-screen route unobstructed.
  for (const x of [-7.4, -3])
    for (const z of [18.1, 19.4]) {
      cylinder(0.2, 0.06, x, 0.04, z, mats.brass);
      cylinder(0.027, 0.9, x, 0.51, z, mats.brass);
      ball(0.065, 0.065, 0.065, x, 1, z, mats.brass);
    }
  for (const x of [-7.4, -3])
    for (let i = 0; i < 8; i++)
      link(
        [x, 0.96 - Math.sin((i / 8) * Math.PI) * 0.13, 18.1 + i * 0.1625],
        [
          x,
          0.96 - Math.sin(((i + 1) / 8) * Math.PI) * 0.13,
          18.1 + (i + 1) * 0.1625,
        ],
        0.025,
        mats.fabric,
      );
  // Framed original programme artwork, painted directly onto canvas textures.
  function poster(title, subtitle, x, z, hue) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 768;
    const g = c.getContext("2d"),
      bg = g.createLinearGradient(0, 0, 512, 768);
    bg.addColorStop(0, hue);
    bg.addColorStop(1, "#171d23");
    g.fillStyle = bg;
    g.fillRect(0, 0, 512, 768);
    g.fillStyle = "#d4bd85";
    g.beginPath();
    g.arc(256, 270, 126, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#16292c";
    g.beginPath();
    g.moveTo(0, 500);
    for (let i = 0; i <= 12; i++)
      g.lineTo(i * 45, 380 + Math.sin(i * 2.2) * 70);
    g.lineTo(512, 768);
    g.lineTo(0, 768);
    g.fill();
    g.fillStyle = "#daceb1";
    g.textAlign = "center";
    g.font = "20px monospace";
    g.fillText("BELLWETHER PICTURES PRESENTS", 256, 65);
    g.font = "bold 47px Georgia";
    title.split("\n").forEach((line, i) => g.fillText(line, 256, 555 + i * 57));
    g.font = "20px monospace";
    g.fillText(subtitle, 256, 714);
    g.strokeStyle = "#b49b6a";
    g.lineWidth = 5;
    g.strokeRect(18, 18, 476, 732);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    box(0.13, 2.44, 1.67, x, 2.3, z, mats.brass);
    const art = mesh(
      new THREE.PlaneGeometry(1.55, 2.32),
      new THREE.MeshStandardMaterial({
        map: t,
        roughness: 0.8,
        side: THREE.DoubleSide,
      }),
      x + 0.075,
      2.3,
      z,
    );
    art.rotation.y = Math.PI / 2;
  }
  poster("THE LONG\nWAY HOME", "ONE FINAL SCREENING", -9.82, 8, "#45606a");
  poster("AFTER\nTHE RAIN", "A BELLWETHER CLASSIC", -9.82, 19.8, "#824942");
  for (const [x, z] of [
    [6.8, 6.3],
    [-8.5, 6.3],
    [8.8, 21],
  ]) {
    solid(0.55, 0.8, 0.55, x, 0.4, z, mats.dark);
    cylinder(0.31, 0.06, x, 0.83, z, mats.brass);
  }
  for (const z of [8, 16, 20]) {
    cylinder(0.48, 0.08, 0, 3.66, z, mats.brass);
    cylinder(0.38, 0.4, 0, 3.41, z, mats.ivory);
    light(0, 3.13, z, "#f6d7a2", 20, 13);
  }
  for (const x of [-9.83, 9.83]) {
    box(0.035, 1.05, 17.6, x, 0.55, 13, mats.wood);
    box(0.05, 0.055, 17.6, x, 1.13, 13, mats.brass);
  }

  // Booth, reels and maintenance bench, with space around the actual equipment.
  solid(1.3, 0.9, 1.1, 13.3, 4.05, -4.5, mats.metal);
  round(0.8, 0.9, 0.6, 13.3, 4.95, -4.5, mats.dark);
  for (const z of [-4.95, -4.05]) {
    const wheel = cylinder(0.47, 0.1, 13.3, 5.8, z, mats.metal);
    wheel.rotation.x = Math.PI / 2;
    reelWheels.push(wheel);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ball(
        0.08,
        0.08,
        0.012,
        Math.sin(a) * 0.3,
        Math.cos(a) * 0.3,
        0,
        mats.black,
        wheel,
      );
    }
  }
  const lens = cylinder(0.16, 0.65, 12.9, 4.95, -4.5, mats.brass);
  lens.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-12.9, -1.8, -15.2).normalize(),
  );
  for (let i = 0; i < 8; i++)
    box(0.53, 0.018, 0.025, 13.3, 4.64 + i * 0.052, -4.183, mats.metal);
  for (const x of [13.06, 13.54])
    for (const y of [4.58, 5.32])
      ball(0.022, 0.022, 0.015, x, y, -4.181, mats.brass);
  cylinder(0.055, 0.8, 13.7, 4.93, -4.5, mats.metal);
  link([13.7, 4.55, -4.4], [14.2, 3.65, -4.7], 0.022, mats.black);
  link([14.2, 3.65, -4.7], [17.8, 3.65, -4.7], 0.022, mats.black);
  target("equipment", 13.3, 4.95, -4.5, { maxDistance: 7 });
  interact("projector", "Use projector", 13.3, 4.8, -3.6, 2.5);
  solid(1.2, 0.9, 5, 16.8, 4.05, -5, mats.wood);
  interact("assemble", "Inspect the splicing bench", 16, 4.7, -2.8);
  box(0.5, 0.05, 0.45, 16.75, 4.55, -2.8, mats.metal);
  label("THREAD → LOOP → MOTOR", 13.3, 4.8, -4.17, 0.65, 0.18);
  label("CAUTION / MOVING FILM", 16.6, 5.5, -8.85, 1.7, 0.35);
  for (const z of [-5.5, -7]) {
    cylinder(0.33, 0.1, 16.8, 4.6, z, mats.metal);
    cylinder(0.1, 0.11, 16.8, 4.61, z, mats.black);
  }
  box(0.5, 0.01, 0.7, 16.8, 4.56, -4, mats.paper);
  cylinder(0.12, 0.035, 16.8, 4.56, -2, mats.brass);
  link([16.8, 4.58, -2], [16.85, 5.05, -2.05], 0.025, mats.brass);
  light(16.8, 5.05, -2.1, "#f6d9a6", 3, 3);
  interact("boothDoor", "Open / close booth door", 12, 4.8, 0.1);
  // Projector beam is restrained, ends at the cinema screen, and follows power.
  const beamGeometry = new THREE.ConeGeometry(3.8, 22, 4, 1, true);
  beamGeometry.translate(0, -11, 0);
  const beam = new THREE.Mesh(
    beamGeometry,
    new THREE.MeshBasicMaterial({
      color: "#d8cfa8",
      transparent: true,
      opacity: 0.025,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  beam.position.set(12.9, 4.95, -4.5);
  beam.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(-12.9, -1.8, -15.2).normalize(),
  );
  scene.add(beam);
  // Archive: physically separate records, seating chart and numbered drawers.
  for (const x of [-21.4, -15.2]) {
    const facing = x < -18 ? 1 : -1;
    solids.push({
      x1: x - 0.375,
      x2: x + 0.375,
      z1: -9,
      z2: -1,
      y1: 0,
      y2: 2.7,
    });
    box(0.055, 2.7, 8, x - facing * 0.35, 1.35, -5, mats.wood);
    for (const z of [-8.96, -1.04])
      box(0.75, 2.7, 0.065, x, 1.35, z, mats.wood);
    for (let level = 0; level < 4; level++) {
      const shelf = 0.12 + level * 0.65;
      box(0.75, 0.06, 8, x, shelf, -5, mats.wood);
      for (let i = 0; i < 8; i++) {
        const z = -8.5 + i;
        const can = cylinder(0.27, 0.14, x, shelf + 0.3, z, mats.metal);
        can.rotation.z = Math.PI / 2;
        const rim = cylinder(
          0.28,
          0.012,
          x + facing * 0.075,
          shelf + 0.3,
          z,
          mats.brass,
        );
        rim.rotation.z = Math.PI / 2;
        label(
          String(1951 + level * 8 + i),
          x + facing * 0.085,
          shelf + 0.3,
          z,
          0.32,
          0.14,
          (facing * Math.PI) / 2,
          { bg: "#b7ad8e", fg: "#363b31" },
        );
      }
    }
  }
  solid(3, 0.9, 1, -18, 0.45, 0.8, mats.wood);
  interact("sorted", "Collect the 1978 reel and records", -18, 1, 0);
  interact("records", "Read maintenance and incident records", -19.3, 1, 0.05);
  cylinder(0.32, 0.12, -18, 1, 0.55, mats.metal);
  const reelLabel = label("1978 / INCIDENT", -18, 1.068, 0.55, 0.5, 0.22, 0, {
    bg: "#c8bf9c",
    fg: "#33372c",
  });
  reelLabel.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 4; i++)
    box(0.48, 0.009, 0.62, -19.3 + i * 0.01, 0.96 + i * 0.01, 0.55, mats.paper);
  for (let i = 0; i < 5; i++)
    box(0.3, 0.004, 0.006, -19.3, 1.001, 0.38 + i * 0.06, mats.dark);
  label("STAFF / 1978\nADA BELL", -21.85, 1.8, -2, 1.1, 0.8, Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const scratch = box(
      0.012,
      0.65,
      0.015,
      -21.8,
      1.85,
      -2 + (i - 2) * 0.13,
      mats.dark,
    );
    scratch.rotation.x = 0.6;
  }
  const staffPhoto = box(
    0.02,
    0.8,
    1.1,
    -21.82,
    1.8,
    -2,
    new THREE.MeshBasicMaterial({ color: "#b4ac8d" }),
  );
  label(
    "SCREEN\nA  1 2 3 4 | 5 6 7 8\nB  1 2 3 4 | 5 6 7 8\nC  1 2 3 4 | 5 6 7 8\nD  1 2 3 4 | 5 6 7 8\nE  1 2 3 4 | 5 6 7 8\nF  1 2 3 4 | 5 6 7 8",
    -18,
    1.8,
    1.85,
    2.5,
    1.4,
    Math.PI,
    { bg: "#b9af8e", fg: "#373b32", size: 25 },
  );
  interact("drawer", "Take the missing film / A. Bell", -18, 1, -8.8);
  solid(3, 1, 1, -18, 0.5, -9.2, mats.metal);
  label("A. BELL / REMOVED FILM", -18, 0.72, -8.615, 0.87, 0.2);
  for (const x of [-19, -18, -17]) {
    round(0.94, 0.72, 0.06, x, 0.51, -8.66, mats.metal);
    box(0.34, 0.07, 0.07, x, 0.42, -8.59, mats.brass);
    for (const dx of [-0.35, 0.35])
      ball(0.017, 0.017, 0.01, x + dx, 0.77, -8.621, mats.dark);
  }
  // Service exit and cues to an old photograph’s position.
  interact("exits", "Check the sealed emergency exit", -13.4, 1.3, -18);
  interact("reference", "Examine the old survey photograph", -11.7, 1.2, -12.5);
  label(
    "SURVEY / 1978\nCAMERA ON BRASS MARK\nFACE THE SEALED WALL",
    -10.15,
    1.6,
    -12.5,
    1.3,
    0.65,
    -Math.PI / 2,
  );
  box(0.4, 0.013, 0.4, -11.6, 0.016, -18, mats.brass);
  interact("breaker", "Reset the service breaker", -11.7, 1.4, -22.8);
  box(0.2, 0.7, 0.6, -10.2, 1.5, -22.8, mats.metal);
  interact("exit", "Release the service exit", -13.1, 1.2, -18);
  // Figures use the shared terrain-aware gait, but ordinary cinema clothing and
  // a restrained face, with no Observer AI or Blackwood story dependencies.
  function person(x, z, colour = "#4d4940") {
    const g = new THREE.Group();
    scene.add(g);
    g.position.set(x, floorAt(x, z) || 0, z);
    g.userData.limbs = [];
    const cloth = mats.fabric.clone();
    cloth.color.set(colour);
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
          new THREE.Vector2(0.12, 1.58),
        ],
        16,
      ),
      cloth,
      0,
      0,
      0,
      body,
    );
    torso.scale.z = 0.65;
    const head = new THREE.Group();
    head.position.y = 1.65;
    body.add(head);
    g.userData.head = head;
    ball(0.125, 0.19, 0.13, 0, 0.09, 0, mats.skin, head);
    ball(0.13, 0.1, 0.13, 0, 0.22, -0.015, mats.dark, head);
    ball(0.024, 0.04, 0.035, 0, 0.085, 0.115, mats.skin, head);
    for (const side of [-1, 1]) {
      ball(0.015, 0.009, 0.012, side * 0.047, 0.12, 0.116, mats.dark, head);
      const arm = new THREE.Group();
      arm.position.set(side * 0.23, 1.43, 0);
      body.add(arm);
      link([0, 0, 0], [side * 0.04, -0.32, 0], 0.055, cloth, arm);
      const elbow = new THREE.Group();
      elbow.position.set(side * 0.04, -0.32, 0);
      arm.add(elbow);
      link([0, 0, 0], [side * 0.025, -0.3, 0.015], 0.043, cloth, elbow);
      ball(0.045, 0.09, 0.024, side * 0.025, -0.34, 0.02, mats.skin, elbow);
      g.userData.limbs.push({ mesh: arm, joint: elbow, type: "arm", side });
      const leg = new THREE.Group();
      leg.position.set(side * 0.12, 0.93, 0);
      g.add(leg);
      link([0, 0, 0], [side * 0.02, -0.43, 0.06], 0.075, cloth, leg);
      const knee = new THREE.Group();
      knee.position.set(side * 0.02, -0.43, 0.06);
      leg.add(knee);
      link([0, 0, 0], [side * 0.03, -0.41, -0.06], 0.053, cloth, knee);
      const foot = new THREE.Group();
      foot.position.set(side * 0.03, -0.41, -0.06);
      knee.add(foot);
      ball(0.07, 0.06, 0.14, 0, -0.025, 0.06, mats.dark, foot);
      g.userData.limbs.push({
        mesh: leg,
        joint: knee,
        foot,
        type: "leg",
        side,
      });
    }
    return g;
  }
  const patron = person(state.patron.x, state.patron.z);
  patron.rotation.y = Math.PI;
  const memories = { opening: [], return: [], incident: [], complete: [] };
  for (const [reel, positions] of Object.entries({
    opening: [
      [-5.2, -10.8],
      [3.9, -6.4],
      [-6.5, -2],
    ],
    return: [
      [2.6, -13],
      [-3.9, -4.2],
      [5.2, -8.6],
    ],
  }))
    for (const [x, z] of positions) {
      const p = person(x, z, reel === "opening" ? "#796b56" : "#4c6170");
      p.rotation.y = Math.PI;
      p.position.y = -0.3;
      memories[reel].push(p);
    }
  const ada = person(-7, -21.8, "#506674");
  ada.rotation.y = -Math.PI / 2;
  const key = box(0.035, 0.18, 0.08, -0.33, 1.08, 0.19, mats.brass, ada);
  box(0.12, 0.11, 0.015, -0.33, 0.96, 0.2, mats.paper, ada);
  ada.userData.limbs.find(
    (l) => l.type === "arm" && l.side === -1,
  ).mesh.rotation.x = -0.8;
  memories.incident.push(ada);
  memories.complete.push(ada);
  const manager = person(-12.3, -17, "#564130");
  manager.rotation.y = Math.PI / 2;
  memories.incident.push(manager);
  const obstruction = box(0.65, 1.15, 1.7, -13.1, 0.575, -18, mats.wood);
  memories.incident.push(obstruction);
  const doorMemory = box(
    0.025,
    2.5,
    1.85,
    -13.86,
    1.25,
    -18,
    new THREE.MeshBasicMaterial({ color: "#b8b8a5", wireframe: true }),
  );
  memories.incident.push(doorMemory);
  const evacuees = [
    person(-9, -22, "#786052"),
    person(-11.5, -22.3, "#595f62"),
  ];
  for (const p of evacuees) p.rotation.y = -Math.PI / 2;
  memories.complete.push(...evacuees);
  const coat = round(0.57, 0.15, 0.45, 6.5, 0.64, -2, mats.fabric);
  interact("coat", "Examine the folded coat / F8", 6.5, 1, -1.7);
  target("patron", state.patron.x, 1.2, state.patron.z, { maxDistance: 26 });
  target("doorway", -13.85, 1.5, -18, {
    requiredReel: "incident",
    maxDistance: 6,
    view: { x: -11.6, z: -18, radius: 3 },
  });
  target("figure", -7, 1.45, -21.8, {
    requiredReel: "incident",
    maxDistance: 10,
    view: { x: -7, z: -18.5, radius: 1.8 },
  });
  target("ada", -7.19, 1.08, -22.13, {
    requiredReel: "incident",
    maxDistance: 5,
    view: { x: -8.9, z: -22.1, radius: 3.2 },
  });
  target("frame", 0, 3.15, -19.7, {
    requiredReel: "incident",
    maxDistance: 27,
  });
  target("evacuation", -11.5, 1.25, -22.3, {
    requiredReel: "complete",
    maxDistance: 12,
  });
  target("final", -17, 1.35, -18, { maxDistance: 12 });
  for (const position of [
    [-5, 3.5, 9],
    [5, 3.5, 9],
    [0, 4, 2],
    [-8.5, 3.5, -4],
    [8.5, 3.5, -4],
    [-8.5, 3.5, -13],
    [8.5, 3.5, -13],
    [14, 6, -4],
    [-18, 3, -4],
    [-12, 3, 8],
    [-12, 3, -7],
    [-12, 3, -18],
    [-7, 3, -22],
    [12, 5.8, 6],
    [-17, 3, -18],
  ])
    light(
      ...position,
      position[0] < -10 ? "#b4d2c8" : "#f6c18d",
      position[0] === 14 ? 18 : 12,
      12,
    );
  scene.add(new THREE.HemisphereLight("#b4b6a2", "#36272a", 0.4));
  const dustGeometry = new THREE.BufferGeometry(),
    dustPositions = [];
  for (let i = 0; i < 160; i++)
    dustPositions.push(
      Math.sin(i * 29) * 8,
      1 + (i % 43) / 10,
      -17 + (i % 61) / 3,
    );
  dustGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(dustPositions, 3),
  );
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: "#d3c8a0",
      size: 0.017,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const echo = person(0, 8, "#424a40");
  echo.visible = false;
  let lastFrame = "";
  function update(s, dt, time, player, photo = false) {
    for (const d of doors) {
      const angle = s.doors[d.id] ? d.angle : 0;
      d.leaf.rotation.y =
        dt > 0 ? THREE.MathUtils.damp(d.leaf.rotation.y, angle, 8, dt) : angle;
    }
    exitCover.visible = !s.evidence.doorway;
    ticket.visible = !!s.events.ticket && !s.items.ticket;
    coat.visible = !!s.evidence.first && !s.items.coat;
    for (const list of Object.values(memories))
      for (const o of list) o.visible = false;
    if (photo && s.events.jamRepaired && s.projector.status === "running")
      for (const o of memories[s.activeReel] || []) o.visible = true;
    if (s.events.audienceTurn && photo)
      for (const o of memories[s.activeReel] || [])
        if (o.userData.head)
          o.rotation.y = Math.atan2(
            player.x - o.position.x,
            player.z - o.position.z,
          );
    patron.position.set(
      s.patron.x,
      floorAt(s.patron.x, s.patron.z) || 0,
      s.patron.z,
    );
    patron.visible =
      !!s.items.ticket &&
      (photo ||
        s.events.released ||
        (s.patron.awakened &&
          Math.hypot(player.x - s.patron.x, player.z - s.patron.z) < 7));
    if (!s.patron.awakened) {
      patron.position.y = -0.32;
      for (const l of patron.userData.limbs)
        if (l.type === "leg") {
          l.mesh.rotation.x = -1.3;
          l.joint.rotation.x = 1.4;
        }
    } else if (dt > 0)
      updateObserverAnimation(patron, dt, time, player, floorAt);
    targets.patron.position.set(
      s.patron.x,
      1.5 + (floorAt(s.patron.x, s.patron.z) || 0),
      s.patron.z,
    );
    beam.visible = s.projector.status === "running";
    dust.visible = beam.visible;
    if (beam.visible)
      for (const wheel of reelWheels) wheel.rotation.z += dt * 2.7;
    const fleeting =
      s.activeReel === "incident" &&
      s.projector.status === "running" &&
      s.elapsed % 14 > 10;
    const frame = s.projector.status + ":" + s.activeReel + ":" + fleeting;
    if (frame !== lastFrame) {
      lastFrame = frame;
      const ctx = screenCanvas.getContext("2d");
      ctx.fillStyle = beam.visible ? "#b7b5a0" : "#292b29";
      ctx.fillRect(0, 0, 1024, 512);
      if (beam.visible) {
        ctx.fillStyle = "#464a43";
        ctx.textAlign = "center";
        ctx.font = "22px monospace";
        ctx.fillText("BELLWETHER / ARCHIVE LEADER", 512, 95);
        ctx.font = "66px Georgia";
        ctx.fillText(
          fleeting
            ? "SPLICE 17"
            : s.activeReel === "complete"
              ? "THE LAST SHOWING"
              : "A PLACE TO REMEMBER",
          512,
          265,
        );
        ctx.font = "23px monospace";
        ctx.fillText(
          fleeting
            ? "REFERENCE FRAME / REPEATS IN 14 SECONDS"
            : s.activeReel === "incident"
              ? "1978 / SECTION MISSING"
              : s.activeReel === "opening"
                ? "1959"
                : "1979",
          512,
          390,
        );
      }
      screenTexture.needsUpdate = true;
    }
    return { fleeting };
  }
  return {
    mats,
    doors,
    nav,
    solids,
    occluders,
    interactions,
    targets,
    patron,
    echo,
    staffPhoto,
    memories,
    screen,
    update,
    makeCamera: (parent) => makeCamera(parent, mats),
    lights,
  };
}
