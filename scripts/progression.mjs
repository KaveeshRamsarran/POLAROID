import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { findPath } from "../src/logic.js";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.addInitScript(() =>
  window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), {
    capture: true,
  }),
);
await fs.mkdir("artifacts", { recursive: true });
const diag = () => page.evaluate(() => window.polaroidDiagnostics);
async function ready() {
  await page.locator("#loading").waitFor({ state: "hidden", timeout: 30000 });
}
async function checkpoint(x, z, yaw, patch = {}) {
  await page.evaluate(
    ({ x, z, yaw, patch }) => {
      const state = JSON.parse(localStorage.getItem("polaroid.save.v1"));
      Object.assign(state, patch);
      state.checkpoint = { x, z, yaw };
      localStorage.setItem("polaroid.save.v1", JSON.stringify(state));
    },
    { x, z, yaw, patch },
  );
  await page.reload();
  await ready();
  await page.getByRole("button", { name: "02 CONTINUE" }).click();
  await page.waitForFunction(
    () => window.polaroidDiagnostics.mode === "playing",
  );
}
async function shoot(id) {
  const before = (await diag()).film;
  await page.keyboard.press("c");
  await page.waitForFunction(
    (before) =>
      window.polaroidDiagnostics.film === before - 1 &&
      !window.polaroidDiagnostics.photoBusy,
    before,
    { timeout: 45000 },
  );
  if (id)
    assert.ok((await diag()).evidence.includes(id), `Missing evidence: ${id}`);
  console.log("capture", id, await diag());
}
try {
  await page.goto(process.argv[2] || "http://127.0.0.1:3000");
  await ready();
  const solids = await page.evaluate(() => window.polaroidNavigation);
  for (const [x, z] of [
    [-5, 6],
    [-6, 0],
    [-5, -9],
    [6, 12],
    [6, -4],
    [5, -9],
    [-5, -21],
    [5, -21],
    [0, -38],
    [20, -12],
    [0, 18],
    [-14.5, 9],
    [-14.5, -1],
    [-14.5, -12],
    [14.5, 9],
    [14.5, -1],
    [-6, -32],
    [6, -32],
    [22, -26],
  ])
    assert.ok(
      findPath({ x: 0, z: 11 }, { x, z }, solids).length,
      `Unreachable room ${x},${z}`,
    );
  console.log("All rooms connected");
  await page.getByRole("button", { name: "01 NEW GAME" }).click();
  // Real keyboard movement must change position and stop against a closed door.
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.polaroidDiagnostics.position.z < 9.3);
  await page.keyboard.up("w");
  assert.ok((await diag()).position.z < 10);
  await checkpoint(-0.6, 9, Math.PI / 2);
  await page.keyboard.press("e");
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.polaroidDiagnostics.position.x < -3,
    {},
    { timeout: 15000 },
  );
  await page.keyboard.up("w");
  console.log("door and collision passed");
  // Fixture checkpoints isolate each story interaction while retaining collected evidence.
  await checkpoint(-6.7, -1, Math.PI / 2);
  await shoot("writing");
  await page.screenshot({ path: "artifacts/evidence-study.png" });
  await page.keyboard.press("j");
  await page.getByRole("button", { name: "CLUES", exact: true }).click();
  const clues = await page.locator("#overlay").innerText();
  assert.match(clues, /combination/);
  await page.getByRole("button", { name: "ESC / CLOSE" }).click();
  await checkpoint(7, -13, 0);
  await shoot("mirror");
  await page.screenshot({ path: "artifacts/evidence-mirror.png" });
  // Crouch to reach the key below the basin.
  await checkpoint(7, -15.1, 0);
  await page.keyboard.press("x");
  await page.mouse.move(640, 600);
  await page.mouse.move(640, 800);
  await page.keyboard.press("e");
  console.log("key attempt", await page.locator("#subtitle").innerText());
  // Look down precisely through native pointer movement when needed.
  if (
    !(await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.save.v1")).key,
    ))
  ) {
    await page.keyboard.down("ArrowDown");
    await page.waitForFunction(() => window.polaroidDiagnostics.pitch < -0.65);
    await page.keyboard.up("ArrowDown");
    await page.keyboard.press("e");
  }
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("polaroid.save.v1")).key,
    ),
    true,
    "Cellar key pickup",
  );
  await checkpoint(-5.5, -23.5, Math.atan2(-(-7 + 5.5), -(-27.3 + 23.5)));
  await shoot("child");
  await checkpoint(0, -27.4, 0);
  await page.keyboard.press("e");
  await page.getByLabel("Four-digit combination").fill("0000");
  await page.getByRole("button", { name: "UNLOCK", exact: true }).click();
  assert.match(await page.locator("#lock-result").innerText(), /resist/);
  const code = await page.evaluate(
    () => JSON.parse(localStorage.getItem("polaroid.save.v1")).code,
  );
  await page.getByLabel("Four-digit combination").fill(code);
  await page.getByRole("button", { name: "UNLOCK", exact: true }).click();
  assert.equal((await diag()).mode, "playing");
  await checkpoint(0, -39.3, 0);
  await shoot("family");
  await page.screenshot({ path: "artifacts/evidence-attic.png" });
  // Place each actual captured image into its corresponding world frame.
  for (const [i, id, name] of [
    [0, "writing", "I / THE PROMISE"],
    [1, "mirror", "II / THE MOTHER"],
    [2, "child", "III / THE CHILD"],
    [3, "family", "IV / THE WITNESS"],
  ]) {
    await checkpoint(19.75 + i * 1.5, -19.7, 0);
    await page.keyboard.press("e");
    await page.getByRole("button", { name }).click();
    assert.equal((await diag()).ritual[i], id);
  }
  await checkpoint(22, -13.2, 0);
  await page.keyboard.press("e");
  assert.equal((await diag()).ritualComplete, true);
  await page.screenshot({ path: "artifacts/ritual.png" });
  await checkpoint(0, 12, Math.PI);
  await shoot();
  assert.equal((await diag()).finalPhoto, true);
  await page.screenshot({ path: "artifacts/final-photo.png" });
  await page.keyboard.press("e");
  await page.keyboard.down("w");
  await page.keyboard.down("Shift");
  await page
    .getByRole("button", { name: "RETURN TO MENU", exact: true })
    .waitFor({ state: "visible", timeout: 20000 });
  await page.keyboard.up("w");
  await page.keyboard.up("Shift");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: "artifacts/ending.png" });
  console.log("FULL PROGRESSION PASSED");
  console.log("errors", errors);
  assert.deepEqual(errors, []);
} catch (e) {
  console.log("FAILED STATE", await diag());
  console.log("PROMPT", await page.locator("#interaction").innerText());
  console.log("ERRORS", errors);
  await page.screenshot({ path: "artifacts/failure.png" });
  throw e;
} finally {
  await browser.close();
}
