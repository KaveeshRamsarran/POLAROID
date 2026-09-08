import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await fs.mkdir("artifacts", { recursive: true });
try {
  await page.goto(process.argv[2] || "http://127.0.0.1:3000");
  await page.locator("#loading").waitFor({ state: "hidden" });
  const geometry = await page.evaluate(async () => {
    const { THREE } = await import("/scripts/polish-fixture.js");
    const { buildWorld } = await import("/src/world.js");
    const { blocked, floorAt } = await import("/src/logic.js");
    const scene = new THREE.Scene(),
      world = buildWorld(scene);
    scene.updateMatrixWorld(true);
    const chairs = world.chairs.map(
      (c) =>
        (Math.sin(c.yaw) * (c.tableX - c.x) +
          Math.cos(c.yaw) * (c.tableZ - c.z)) /
        Math.hypot(c.tableX - c.x, c.tableZ - c.z),
    );
    const walls = world.architecture.filter((w) => w.type === "wall"),
      overlaps = [];
    const overlap = (a, b, c, d) => Math.min(b, d) - Math.max(a, c) > 0.001;
    for (let i = 0; i < walls.length; i++)
      for (let j = i + 1; j < walls.length; j++) {
        const a = walls[i],
          b = walls[j],
          alongX = a.w > a.d;
        if (alongX !== b.w > b.d) continue;
        const coplanar = alongX
          ? Math.abs(a.z - b.z) < 0.001
          : Math.abs(a.x - b.x) < 0.001;
        if (
          coplanar &&
          overlap(a.x - a.w / 2, a.x + a.w / 2, b.x - b.w / 2, b.x + b.w / 2) &&
          overlap(a.z - a.d / 2, a.z + a.d / 2, b.z - b.d / 2, b.z + b.d / 2) &&
          overlap(a.y, a.y + a.h, b.y, b.y + b.h)
        )
          overlaps.push([a, b]);
      }
    const rays = [];
    // Rays looking back over the landing roof must strike the new wall first.
    for (const [z, y] of [
      [-32.5, 7.1],
      [-34.5, 8.2],
      [-21, 4.8],
    ])
      for (const dx of [-0.4, 0, 0.4]) {
        const origin = new THREE.Vector3(0, y, z),
          direction = new THREE.Vector3(dx, 0.05, 1).normalize();
        const hit = new THREE.Raycaster(
          origin,
          direction,
          0.01,
          10,
        ).intersectObjects(scene.children, true)[0];
        rays.push(hit ? { distance: hit.distance, z: hit.point.z } : null);
      }
    const closedDoorBypasses = [];
    for (let x = -1.9; x <= 1.9; x += 0.1)
      if (!blocked(x, -29, world.solids, 0.23))
        closedDoorBypasses.push([x, -29]);
    for (let z = -15.7; z <= -12.3; z += 0.1)
      if (!blocked(16, z, world.solids, 0.23)) closedDoorBypasses.push([16, z]);
    for (const door of world.doors) {
      door.open = door.target = 1;
      door.pivot.rotation.y = -Math.PI * 0.49;
    }
    const stairObstructions = [];
    for (let z = -17.1; z > -35; z -= 0.1)
      if (blocked(0, z, world.solids, 0.23)) stairObstructions.push(z);
    // Independent review renderer: no game-state mutation or normal-browser save access.
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1280, 800);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    renderer.domElement.style.cssText = "position:fixed;inset:0;z-index:99999";
    renderer.domElement.id = "polish-review";
    document.body.append(renderer.domElement);
    const camera = new THREE.PerspectiveCamera(65, 1280 / 800, 0.05, 100);
    const lamp = new THREE.PointLight(0xd6e2d0, 24, 12, 2);
    scene.add(lamp);
    scene.background = new THREE.Color("#08120e");
    scene.fog = new THREE.FogExp2("#13251c", 0.025);
    window.reviewPolish = (view) => {
      world.observer.visible = view === "observer";
      const views = {
        attic: [0, 8.1, -34.2, 0, 7.5, -29],
        chairs: [8.4, 1.9, 2.7, 5.9, 0.6, -0.6],
        observer: [0, 1.65, 10.2, 0, 1.5, 7],
      };
      const [x, y, z, tx, ty, tz] = views[view];
      camera.position.set(x, y, z);
      camera.lookAt(tx, ty, tz);
      lamp.position.set(x - 0.35, y + 0.35, z - 0.2);
      world.observer.position.set(0, 0, 7);
      world.observer.rotation.y = 0;
      world.update(0.016, 4, camera.position, true, 0);
      renderer.render(scene, camera);
    };
    return { chairs, overlaps, rays, stairObstructions, closedDoorBypasses };
  });
  assert.equal(geometry.chairs.length, 7);
  assert.ok(
    geometry.chairs.every((dot) => dot > 0.999),
    "Every chair faces its table",
  );
  assert.deepEqual(
    geometry.overlaps,
    [],
    "No coincident parallel wall surfaces",
  );
  assert.ok(
    geometry.rays.every((hit) => hit && hit.distance < 7),
    "Stairs have a back enclosure",
  );
  assert.deepEqual(
    geometry.stairObstructions,
    [],
    "Open stair flights remain walkable",
  );
  assert.deepEqual(
    geometry.closedDoorBypasses,
    [],
    "Door frames close the sides of locked doors",
  );
  console.log("ARCHITECTURE", JSON.stringify(geometry));
  for (const view of ["attic", "chairs", "observer"]) {
    await page.evaluate((view) => window.reviewPolish(view), view);
    await page
      .locator("#polish-review")
      .screenshot({ path: `artifacts/polish-${view}.png` });
  }
  const audio = await page.evaluate(async () => {
    const { Soundscape, footSurface } = await import("/src/audio.js");
    const rms = (data, a, b) =>
      Math.sqrt(data.slice(a, b).reduce((sum, v) => sum + v * v, 0) / (b - a));
    async function render(material, crouched = false) {
      const context = new OfflineAudioContext(2, 48000 * 2, 48000),
        sound = new Soundscape();
      sound.start(context);
      if (material) sound.foot({ x: 0, y: 0, z: 0 }, material, false, crouched);
      const output = await context.startRendering(),
        data = output.getChannelData(0);
      return {
        rms: rms(data, 0, 24000),
        tail: rms(data, 60000, 90000),
        signature: Array.from(data.slice(1000, 1020)),
      };
    }
    const idle = await render(),
      walking = {};
    for (const material of ["wood", "tile", "concrete", "metal"])
      walking[material] = await render(material);
    const crouch = await render("wood", true);
    return {
      idle,
      walking,
      crouch,
      surfaces: [
        footSurface(0, -32),
        footSurface(7, 10),
        footSurface(-6, -1),
        footSurface(0, 8),
      ],
    };
  });
  assert.equal(audio.idle.rms, 0, "Idle soundscape is silent");
  assert.deepEqual(audio.surfaces, ["metal", "tile", "wood", "concrete"]);
  for (const [material, result] of Object.entries(audio.walking)) {
    assert.ok(result.rms > 0.005, `${material} footstep is audible`);
    assert.ok(
      result.tail < 0.00001,
      `${material} footstep ends without a noise loop`,
    );
  }
  assert.ok(
    audio.crouch.rms < audio.walking.wood.rms * 0.5,
    "Crouching is quieter",
  );
  assert.equal(
    new Set(
      Object.values(audio.walking).map((v) => JSON.stringify(v.signature)),
    ).size,
    4,
    "Each surface has distinct audio",
  );
  console.log("AUDIO", JSON.stringify(audio));
  assert.deepEqual(errors, []);
  console.log("POLISH REGRESSIONS PASSED");
} finally {
  await browser.close();
}
