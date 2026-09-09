import * as THREE from "three";

// Local aging only: Blackwood's materials and collision layout are untouched.
export function ageCinemaMaterials(mats) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(mats.wall.map.image, 0, 0, 1024, 1024);
  let seed = 1978;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  // Overlapping repairs and old nicotine staining, with fine hairline cracks.
  for (let i = 0; i < 26; i++) {
    const x = random() * 1024,
      y = random() * 1024,
      r = 60 + random() * 170;
    const patch = ctx.createRadialGradient(x, y, 0, x, y, r);
    patch.addColorStop(
      0,
      i % 3 ? "rgba(85,68,35,.07)" : "rgba(243,229,196,.13)",
    );
    patch.addColorStop(1, "rgba(150,126,81,0)");
    ctx.fillStyle = patch;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.strokeStyle = "rgba(74,66,52,.2)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 7; i++) {
    let x = 100 + random() * 800,
      y = 80 + random() * 600;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      x += random() * 14 - 7;
      y += random() * 12 + 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  mats.wall.map.dispose();
  mats.wall.map = new THREE.CanvasTexture(canvas);
  mats.wall.map.colorSpace = THREE.SRGBColorSpace;
  mats.wall.map.wrapS = mats.wall.map.wrapT = THREE.RepeatWrapping;
  mats.wall.map.anisotropy = 16;
  mats.fabric.color.set("#bd8991");
  mats.fabric.roughness = 0.99;

  const carpet = document.createElement("canvas");
  carpet.width = carpet.height = 512;
  const c = carpet.getContext("2d");
  c.fillStyle = "#422f32";
  c.fillRect(0, 0, 512, 512);
  c.strokeStyle = "#635044";
  c.lineWidth = 1.5;
  for (let y = -64; y < 576; y += 64)
    for (let x = -64; x < 576; x += 64) {
      c.beginPath();
      c.moveTo(x, y - 22);
      c.lineTo(x + 22, y);
      c.lineTo(x, y + 22);
      c.lineTo(x - 22, y);
      c.closePath();
      c.stroke();
      c.fillStyle = "#7e6651";
      c.fillRect(x - 1, y - 1, 2, 2);
    }
  for (let i = 0; i < 23000; i++) {
    c.fillStyle =
      random() > 0.5 ? "rgba(189,165,124,.06)" : "rgba(12,14,13,.1)";
    c.fillRect(random() * 512, random() * 512, 1, 2);
  }
  const map = new THREE.CanvasTexture(carpet);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 16;
  mats.carpet = new THREE.MeshStandardMaterial({
    map,
    roughness: 1,
    color: "#ffffff",
  });
}

export function detailCinema(scene, mats, t) {
  const { box, round, cylinder, ball, link, label, interact, solid } = t;
  const paper = mats.paper.clone();
  paper.color.set("#c2aa7d");
  // Readable documents sit on actual counters/boards, with their own targets.
  function documentProp(
    id,
    heading,
    lines,
    x,
    y,
    z,
    rotation = 0,
    wall = false,
  ) {
    const group = new THREE.Group();
    scene.add(group);
    group.position.set(x, y, z);
    group.rotation.y = rotation;
    const backing = box(0.45, 0.012, 0.58, 0, 0, 0, paper, group);
    const c = document.createElement("canvas");
    c.width = 384;
    c.height = 512;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#c5b18b";
    ctx.fillRect(0, 0, 384, 512);
    ctx.fillStyle = "#493d2c";
    ctx.font = "bold 25px Georgia";
    ctx.textAlign = "center";
    ctx.fillText(heading, 192, 55, 350);
    ctx.font = "17px monospace";
    lines.forEach((line, i) => ctx.fillText(line, 192, 108 + i * 32, 346));
    ctx.strokeStyle = "#806b45";
    ctx.strokeRect(15, 15, 354, 482);
    ctx.fillStyle = "#8c4335";
    ctx.font = "16px monospace";
    ctx.fillText("BELLWETHER / FILE COPY", 192, 464);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(0.43, 0.56),
      new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    sheet.rotation.x = -Math.PI / 2;
    sheet.position.y = 0.007;
    group.add(sheet);
    if (wall) {
      group.rotation.x = Math.PI / 2;
      backing.name = "mounted-lore-record";
    }
    interact(
      "lore:" + id,
      "Read / " + heading.toLowerCase(),
      x,
      y + (wall ? 0 : 0.12),
      z,
      2.35,
    );
    group.name = "lore-prop-" + id;
    return group;
  }
  documentProp(
    "closing",
    "THE FINAL WEEK",
    [
      "1959 — 1998",
      "LAST PUBLIC SHOW: SUNDAY",
      "SURVEY: TOMORROW",
      "KEEP LOST PROPERTY",
      "Someone still calls.",
    ],
    -2.85,
    1.16,
    20.65,
    -0.08,
  );
  documentProp(
    "register",
    "RESERVATIONS",
    [
      "FRIDAY LATE SHOW",
      "F7 / R. AVERY",
      "F8 / T. AVERY",
      "Paid for both seats.",
      "14 NOV: STILL INSIDE",
    ],
    -6.65,
    1.16,
    20.6,
    0.13,
  );
  documentProp(
    "booth",
    "A. BELL / SHIFT",
    [
      "14 NOVEMBER 1978",
      "AMPLIFIER RUNNING HOT",
      "SERVICE KEY TAKEN",
      "Hale says finish reel.",
      "USE THE SIDE PASSAGE",
    ],
    16.55,
    4.57,
    -6.65,
    0.1,
  );
  documentProp(
    "letter",
    "FOR THE SURVEYOR",
    [
      "3 DECEMBER 1998",
      "Please leave the",
      "side door open.",
      "I know how that sounds.",
      "— Ruth Avery",
    ],
    -16.95,
    0.965,
    0.55,
    -0.16,
  );
  // A screwed-down maintenance board on the eastern passage wall.
  box(0.055, 1.05, 1.25, -10.15, 1.65, -15, mats.wood);
  const witness = documentProp(
    "witness",
    "WITNESS / COPY",
    [
      "16 NOVEMBER 1978",
      "She carried a key.",
      "He went back for them.",
      "A girl was outside.",
      "NOT IN FINAL REPORT",
    ],
    -10.193,
    1.65,
    -15,
    0,
    true,
  );
  witness.rotation.set(Math.PI / 2, 0, Math.PI / 2);
  for (const z of [-15.54, -14.46])
    for (const y of [1.22, 2.08])
      ball(0.012, 0.013, 0.013, -10.184, y, z, mats.brass);

  // Clock repaired by the regular in F8; aged face beneath protective glass.
  const clock = new THREE.Group();
  scene.add(clock);
  clock.position.set(9.79, 2.85, 17);
  clock.rotation.y = -Math.PI / 2;
  const rim = cylinder(0.35, 0.085, 0, 0, 0, mats.brass, clock);
  rim.rotation.x = Math.PI / 2;
  const dial = cylinder(0.31, 0.011, 0, 0, 0.05, paper, clock);
  dial.rotation.x = Math.PI / 2;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const tick = box(
      0.015,
      0.04,
      0.006,
      Math.sin(a) * 0.265,
      Math.cos(a) * 0.265,
      0.058,
      mats.dark,
      clock,
    );
    tick.rotation.z = -a;
  }
  link([0, 0, 0.064], [-0.1, 0.13, 0.064], 0.012, mats.dark, clock);
  link([0, 0, 0.066], [-0.21, -0.07, 0.066], 0.007, mats.dark, clock);
  ball(0.022, 0.022, 0.012, 0, 0, 0.073, mats.brass, clock);
  label("REPAIRED / T. AVERY / 1977", 9.78, 2.39, 17, 1.2, 0.14, -Math.PI / 2, {
    bg: "#ae9974",
    fg: "#453e30",
    size: 23,
  });

  // Radiator, valves and clipped pipes remain against solid wall, clear of doors.
  solid(0.36, 0.8, 2.2, -9.57, 0.4, 7, mats.metal);
  for (let i = 0; i < 12; i++)
    round(
      0.3,
      0.72,
      0.11,
      -9.34,
      0.43,
      6.02 + i * 0.175,
      mats.ivory,
      scene,
      0.025,
    );
  link([-9.62, 0.12, 5.8], [-9.62, 1.22, 5.8], 0.025, mats.rust);
  link([-9.62, 0.12, 8.25], [-9.62, 0.12, 9.5], 0.025, mats.rust);
  cylinder(0.07, 0.035, -9.6, 1.24, 5.8, mats.brass);
  // Faded acoustic ceiling seams and vent housings, all flush with enclosure.
  for (const z of [6, 10, 14, 18, 21])
    box(19.6, 0.014, 0.025, 0, 3.79, z, mats.wood);
  for (const x of [-6, 6]) {
    box(1.45, 0.06, 0.8, x, 3.765, 11, mats.metal);
    for (let i = 0; i < 10; i++)
      box(0.07, 0.008, 0.64, x - 0.57 + i * 0.125, 3.731, 11, mats.dark);
  }
  // Patched armrests and floor-mounted seat feet give each row a little history.
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 8; col++) {
      const x = [-6.5, -5.2, -3.9, -2.6, 2.6, 3.9, 5.2, 6.5][col],
        z = -13 + row * 2.2;
      for (const side of [-1, 1]) {
        box(0.19, 0.03, 0.26, x + side * 0.41, 0.035, z + 0.08, mats.metal);
        for (const dz of [-0.08, 0.08])
          ball(
            0.024,
            0.012,
            0.024,
            x + side * 0.41,
            0.056,
            z + 0.08 + dz,
            mats.brass,
          );
      }
      if ((row * 8 + col) % 5 === 0) {
        box(0.112, 0.004, 0.2, x + 0.4, 0.76, z - 0.08, paper);
        for (let j = 0; j < 3; j++)
          box(
            0.002,
            0.005,
            0.12,
            x + 0.37 + j * 0.025,
            0.763,
            z - 0.08,
            mats.dark,
          );
      }
    }
  // Booth equipment: loose leader, rewind crank, repair tools and coffee stains.
  for (let i = 0; i < 5; i++)
    box(0.025, 0.003, 0.44, 16.4 + i * 0.065, 4.563, -4.7, mats.black);
  link([16.4, 4.57, -3.5], [16.9, 4.57, -3.5], 0.014, mats.metal);
  round(0.13, 0.05, 0.055, 16.97, 4.58, -3.5, mats.rust);
  cylinder(0.085, 0.13, 16.8, 4.64, -7.1, mats.ivory);
  cylinder(0.07, 0.002, 16.8, 4.708, -7.1, mats.dark);
  // Archive cartons, filing labels, old inspection stickers and tied cables.
  for (let i = 0; i < 3; i++) {
    box(0.55, 0.24, 0.46, -20.1 + i * 0.64, 0.13, -9.48, paper);
    box(0.56, 0.025, 0.47, -20.1 + i * 0.64, 0.265, -9.48, mats.wood);
    label(
      ["1959 / OPENING", "1978 / RETAIN", "1979 / REOPEN"][i],
      -20.1 + i * 0.64,
      0.15,
      -9.242,
      0.42,
      0.1,
    );
  }
  for (const z of [-5, -9, -13, -20]) {
    box(0.025, 0.2, 0.32, -10.13, 2.85, z, mats.rust);
    label("INSPECTED\n11 / 1978", -10.15, 2.85, z, 0.29, 0.18, -Math.PI / 2, {
      bg: "#a49165",
      fg: "#413b2b",
      size: 28,
    });
  }
  link([-13.78, 3.15, 9], [-13.78, 3.15, -16.8], 0.018, mats.black);
  for (let z = 8; z > -16; z -= 2)
    box(0.1, 0.05, 0.09, -13.78, 3.15, z, mats.metal);
}
