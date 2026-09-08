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
  const { box, round, ball, cylinder, sign, mesh, link } = modelTools(
    scene,
    mats,
  );
  const solids = [],
    occluders = [],
    targets = {},
    interactions = [],
    lights = [],
    reelWheels = [];
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
    return sign(text, x, y, z, w, h, rot, {
      bg: "#262724",
      fg: "#c9ba91",
      size: 34,
      ...opts,
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
      r.name === "Projection booth"
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
  wallZ(14, -14, 14);
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
  label("ARCHIVE  ←     PROJECTION  →", 0, 2.5, 13.85, 3, 0.25, Math.PI);
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
  const boothDoor = solid(1.85, 2.4, 0.1, 12, 4.8, 0, mats.wood, "booth");
  const exitDoor = solid(0.12, 2.5, 1.9, -14, 1.25, -18, mats.metal, "exit");
  const exitCover = box(0.03, 2.55, 2, -13.91, 1.275, -18, mats.wall);
  label("EXIT", -13.8, 2.85, -18, 1.1, 0.28, Math.PI / 2, {
    bg: "#4b231e",
    fg: "#f6b0a1",
  });
  label("EXIT", 0, 2.85, 4.13, 1, 0.28, 0, { bg: "#4b231e", fg: "#efb7a3" });
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
      round(0.7, 0.9, 0.16, 0, 0.85, 0.27, mats.fabric, seat, 0.045);
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
  // Lobby: counter, paperwork, printer, concession display, warm practicals.
  solid(5, 1.05, 1.25, -5, 0.525, 11, mats.wood);
  box(5.15, 0.09, 1.4, -5, 1.09, 11, mats.brass);
  round(0.6, 0.28, 0.45, -5.5, 1.27, 10.9, mats.dark);
  label("PLAY / MANAGER", -5.5, 1.28, 10.65, 0.55, 0.12, Math.PI);
  round(0.6, 0.35, 0.5, -3.3, 1.28, 11, mats.ivory);
  label("BELLWETHER", -5, 2.8, 13.86, 4.5, 0.65, Math.PI, {
    bg: "#3c2527",
    fg: "#dac99f",
  });
  const ticket = box(0.19, 0.009, 0.4, -3.3, 1.145, 10.53, mats.paper);
  ticket.visible = false;
  box(0.65, 0.009, 0.8, -6.5, 1.146, 10.9, mats.paper);
  interact("message", "Play the manager’s recording", -5.5, 1.3, 10.4);
  interact("ticket", "Take the printed ticket", -3.3, 1.3, 10.4);
  interact("film", "Emergency film supply", -7, 1.3, 10.4);
  box(0.45, 0.2, 0.35, -7, 1.24, 10.8, mats.paper);
  label("FILM", -7, 1.3, 10.6, 0.3, 0.13, Math.PI);
  solid(4, 1.1, 1.1, 6, 0.55, 11, mats.wood);
  box(4.2, 0.08, 1.3, 6, 1.14, 11, mats.brass);
  for (let i = 0; i < 7; i++)
    cylinder(0.12, 0.4, 4.6 + i * 0.4, 1.37, 11, mats.paper);
  label("LAST NIGHT / EVERYTHING MUST GO", 6, 2.7, 13.85, 4, 0.5, Math.PI);
  interact("belongings", "Catalogue lost belongings", 5.5, 1.3, 10.4);
  round(0.6, 0.18, 0.35, 6, 1.27, 10.8, mats.fabric);
  for (const x of [-8.5, 8.5]) {
    solid(0.65, 1.2, 0.65, x, 0.6, 7, mats.dark);
    label("BELLWETHER\nFINAL SEASON\n1998", x, 2, 13.84, 1.5, 2, Math.PI, {
      bg: "#533331",
      fg: "#d9c79d",
    });
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
  lens.rotation.z = Math.PI / 2;
  target("equipment", 13.3, 4.95, -4.5, { maxDistance: 7 });
  interact(
    "projector",
    "Operate projector / change reels",
    13.3,
    4.8,
    -3.6,
    2.5,
  );
  solid(1.2, 0.9, 5, 16.8, 4.05, -5, mats.wood);
  interact("assemble", "Inspect the splicing bench", 16, 4.7, -2.8);
  box(0.5, 0.05, 0.45, 16.75, 4.55, -2.8, mats.metal);
  label("THREAD → LOOP → MOTOR", 13.3, 4.8, -4.17, 0.65, 0.18);
  label("CAUTION / MOVING FILM", 16.6, 5.5, -8.85, 1.7, 0.35);
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
    solid(0.75, 2.4, 8, x, 1.2, -5, mats.wood);
    for (let y = 0.45; y < 2.5; y += 0.65)
      for (let z = -8.5; z < 0; z += 1) {
        const can = cylinder(0.3, 0.12, x, y, z, mats.metal);
        can.rotation.z = Math.PI / 2;
      }
  }
  solid(3, 0.9, 1, -18, 0.45, 0.8, mats.wood);
  interact("sorted", "Sort the labelled film cans", -18, 1, 0);
  interact("records", "Read maintenance and incident records", -20, 1, -1.2);
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
  interact("drawer", "Open the splice drawer", -18, 1, -8.8);
  solid(3, 1, 1, -18, 0.5, -9.2, mats.metal);
  label("SEAT / SPLICE", -18, 0.72, -8.68, 1, 0.2);
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
    view: { x: -11.6, z: -18, radius: 1.5 },
  });
  target("figure", -7, 1.45, -21.8, {
    requiredReel: "incident",
    maxDistance: 10,
    view: { x: -7, z: -18.5, radius: 1.8 },
  });
  target("ada", -7.19, 1.08, -22.13, {
    requiredReel: "incident",
    maxDistance: 5,
    view: { x: -8.9, z: -22.1, radius: 1.8 },
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
    boothDoor.visible = !s.doors.booth;
    exitDoor.visible = !s.doors.exit;
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
