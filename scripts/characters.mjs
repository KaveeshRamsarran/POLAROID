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
  await page.locator("#loading").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByRole("button", { name: "01 NEW GAME" }).click();
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/hand-viewfinder.png" });
  await page.mouse.up({ button: "right" });
  await page.keyboard.press("p");
  const result = await page.evaluate(async () => {
    const { THREE } = await import("/scripts/polish-fixture.js");
    const { buildWorld } = await import("/src/world.js");
    const { updateObserverAnimation } = await import(
      "/src/observer-animation.js"
    );
    const scene = new THREE.Scene(),
      world = buildWorld(scene),
      actor = world.observer;
    const labelPlanes = world.doors.flatMap((d) =>
      d.pivot.children.filter((m) => m.geometry?.type === "PlaneGeometry"),
    );
    const player = { x: 0, y: 1.64, z: 20 };
    actor.position.set(0, 0, 0);
    actor.rotation.set(0, 0, 0);
    const knees = [],
      heights = [],
      steps = [];
    for (let i = 0; i < 240; i++) {
      actor.position.z = (i / 60) * 1.1;
      updateObserverAnimation(actor, 1 / 60, i / 60, player, () => 0);
      actor.updateMatrixWorld(true);
      for (const leg of actor.userData.limbs.filter((l) => l.type === "leg")) {
        knees.push(leg.joint.rotation.x);
        heights.push(leg.foot.getWorldPosition(new THREE.Vector3()).y);
      }
      steps.push(actor.userData.footfallCount || 0);
    }
    const walkSteps = actor.userData.footfallCount;
    for (let i = 0; i < 120; i++)
      updateObserverAnimation(actor, 1 / 60, 4 + i / 60, player, () => 0);
    const stopped = actor.userData.gait.blend;
    const stoppedSteps = actor.userData.footfallCount;
    for (let i = 0; i < 180; i++) {
      actor.position.z += 2.4 / 60;
      updateObserverAnimation(actor, 1 / 60, 6 + i / 60, player, () => 0);
    }
    const chaseSteps = actor.userData.footfallCount - stoppedSteps;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(1280, 800);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.id = "character-review";
    renderer.domElement.style.cssText = "position:fixed;inset:0;z-index:99999";
    document.body.append(renderer.domElement);
    const view = new THREE.PerspectiveCamera(48, 1.6, 0.01, 50);
    const handScene = new THREE.Scene();
    handScene.background = new THREE.Color("#23292a");
    handScene.add(new THREE.HemisphereLight(0xffffff, 0x554638, 2));
    const light = new THREE.DirectionalLight(0xffeee1, 3);
    light.position.set(-1, 2, 3);
    handScene.add(light);
    const model = world.makeCamera(handScene);
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    const hand = model.getObjectByName("player-hand");
    const handSurface = hand.getObjectByName("continuous-hand-skin");
    view.position.set(0.34, 0.17, 0.76);
    view.lookAt(0.075, -0.015, 0);
    renderer.render(handScene, view);
    window.reviewGait = (frame) => {
      const isolated = new THREE.Scene();
      isolated.background = new THREE.Color("#202728");
      isolated.add(new THREE.HemisphereLight(0xc8d1c6, 0x394039, 2));
      const key = new THREE.DirectionalLight(0xe2e8dc, 3);
      key.position.set(2, 4, 3);
      isolated.add(key);
      isolated.add(actor);
      actor.visible = true;
      actor.position.set(0, 0, 0);
      actor.rotation.set(0, 0, 0);
      delete actor.userData.gait;
      for (let i = 0; i <= frame; i++) {
        actor.position.z = (i / 60) * 1.1;
        updateObserverAnimation(
          actor,
          1 / 60,
          i / 60,
          { x: 0, z: 10 },
          () => 0,
        );
      }
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: 0x394340, roughness: 1 }),
      );
      ground.rotation.x = -Math.PI / 2;
      isolated.add(ground);
      view.position.set(3, 1.6, actor.position.z + 3);
      view.lookAt(0, 1.2, actor.position.z);
      renderer.render(isolated, view);
    };
    return {
      doorCount: world.doors.length,
      labelPlanes: labelPlanes.length,
      digits: hand.userData.digits,
      handVertices: handSurface.geometry.attributes.position.count,
      knees: [Math.min(...knees), Math.max(...knees)],
      ankles: [Math.min(...heights), Math.max(...heights)],
      walkSteps,
      chaseSteps,
      stopped,
      stoppedSteps,
    };
  });
  console.log("CHARACTERS", result);
  assert.equal(result.labelPlanes, 0, "No lettering planes on any door");
  assert.deepEqual(result.digits, [
    "index",
    "middle",
    "ring",
    "little",
    "thumb",
  ]);
  assert.ok(
    result.handVertices > 1000 && result.handVertices < 135000,
    "Hand surface fits geometry budget",
  );
  assert.ok(
    result.knees[1] - result.knees[0] > 0.25,
    "Knees articulate through the stride",
  );
  assert.ok(
    result.ankles[0] > 0.075 && result.ankles[1] > 0.17,
    "Feet clear the floor and lift during swing",
  );
  assert.ok(
    result.walkSteps >= 6 && result.chaseSteps > result.walkSteps * 0.75,
    "Walking and chasing produce alternating foot contacts",
  );
  assert.ok(
    result.stopped < 0.001,
    "Stationary Observer settles out of the walk cycle",
  );
  assert.ok(
    result.stoppedSteps - result.walkSteps <= 1,
    "Stopping cannot keep generating footsteps",
  );
  await page
    .locator("#character-review")
    .screenshot({ path: "artifacts/hand-detail.png" });
  for (const frame of [65, 77, 89]) {
    await page.evaluate((frame) => window.reviewGait(frame), frame);
    await page
      .locator("#character-review")
      .screenshot({ path: `artifacts/gait-${frame}.png` });
  }
  assert.deepEqual(errors, []);
  console.log("CHARACTER REGRESSIONS PASSED");
} finally {
  await browser.close();
}
