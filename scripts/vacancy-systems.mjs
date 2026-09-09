import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory, floorAt } from "../src/vacancy/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(90000);
// Fixture saves are installed explicitly; prevent the departing test scene
// from replacing the next fixture during its ordinary unload checkpoint.
await page.addInitScript(() =>
  window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), {
    capture: true,
  }),
);
const diag = () => page.evaluate(() => vacancyDiagnostics);
async function fixture(s) {
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.vacancy.v1", JSON.stringify(s)),
    s,
  );
  await page.goto(base + "/?chapter=vacancy&play=continue");
  await page.click("#enter-vacancy");
  await page.waitForFunction(() => vacancyDiagnostics.mode === "playing");
}
try {
  await page.goto(base);
  await page.evaluate(() =>
    localStorage.setItem(
      "polaroid.settings.v1",
      JSON.stringify({ quality: "low" }),
    ),
  );
  let s = newStory();
  s.items = { roomKey: true, family: true, bag: true, called: true };
  s.events.awake = true;
  s.checkpoint = { x: 5, z: -10.4, yaw: 0, pitch: -0.35 };
  Object.assign(s.clerk, { x: -4.5, z: 1, mode: "patrol", patrol: 3 });
  await fixture(s);
  await page.keyboard.press("p");
  const paused = await diag();
  await page.waitForTimeout(700);
  assert.equal((await diag()).state.elapsed, paused.state.elapsed);
  assert.deepEqual((await diag()).state.clerk, paused.state.clerk);
  assert.equal((await diag()).grace, paused.grace);
  await page.click("#panel-close");
  await page.waitForFunction(() => vacancyDiagnostics.grace === 0);
  await page.keyboard.press("c");
  await page.waitForFunction(() => vacancyDiagnostics.develop === 0);
  assert.equal(
    await page
      .locator("#develop-layer")
      .evaluate((e) => Number(getComputedStyle(e).opacity)),
    0,
  );
  await page.keyboard.press("r");
  const inspected = await diag();
  await page.waitForTimeout(900);
  assert(
    (await diag()).state.elapsed > inspected.state.elapsed + 0.4,
    "Inspecting a print must not pause",
  );
  await page.waitForFunction(() => vacancyDiagnostics.state.clerk.z < -6.4);
  const climbed = await diag();
  assert.equal(floorAt(climbed.state.clerk.x, climbed.state.clerk.z), 3.1);
  assert(climbed.footfalls > 2, "Walking must animate foot contacts");
  assert.equal(
    climbed.mode,
    "playing",
    "Closed room walls must conceal the player",
  );
  console.log(
    "PASS pause, active print inspection, physical stair patrol and closed-room concealment",
  );

  // A direct patrol route must knock and open a closed door, even without
  // intermediate path nodes at the doorway.
  s = newStory();
  s.items.roomKey = true;
  s.events.awake = true;
  s.checkpoint = { x: 5, z: -10.4, yaw: 0, pitch: 0 };
  s.doors.laundry = false;
  Object.assign(s.clerk, { x: -10, z: 6, mode: "patrol", patrol: 1 });
  await fixture(s);
  await page.waitForFunction(() => vacancyDiagnostics.grace === 0);
  assert(!(await diag()).state.doors.laundry);
  await page.waitForFunction(() => vacancyDiagnostics.state.doors.laundry);
  await page.waitForFunction(() => vacancyDiagnostics.state.clerk.z < 4.5);
  console.log("PASS closed-door knock, opening and physical passage");

  // Use a close, valid saved encounter to exercise flash, death and retry UI.
  s = newStory();
  s.items.roomKey = true;
  s.evidence.suitcase = true;
  s.events.awake = true;
  s.film = 1;
  s.checkpoint = { x: 0, z: 10, yaw: 0, pitch: 0 };
  Object.assign(s.clerk, { x: 0, z: 9.5, mode: "patrol", seen: 0 });
  await fixture(s);
  await page.waitForFunction(() => vacancyDiagnostics.grace === 0);
  await page.keyboard.press("c");
  assert((await diag()).state.clerk.stunned > 3);
  assert.equal((await diag()).state.film, 0);
  await page.waitForFunction(() => vacancyDiagnostics.mode === "dead");
  await page.click("#retry");
  const recovered = await diag();
  assert.equal(recovered.mode, "playing");
  assert(recovered.grace > 16);
  assert.equal(recovered.state.film, 4);
  assert(recovered.state.evidence.suitcase);
  assert(Math.hypot(recovered.state.clerk.x, recovered.state.clerk.z - 10) > 8);
  console.log(
    "PASS readable close encounter, death and safe checkpoint recovery",
  );

  s = newStory();
  s.film = 0;
  await fixture(s);
  const film = (await diag()).interactions.find((t) => t.id === "film");
  const x = -9,
    z = 9.6;
  s.checkpoint = {
    x,
    z,
    yaw: Math.atan2(x - film.x, z - film.z),
    pitch: Math.atan2(film.y - 1.64, Math.hypot(film.x - x, film.z - z)),
  };
  await fixture(s);
  await page.keyboard.press("e");
  assert.equal(
    (await diag()).state.film,
    6,
    "Emergency film is physically reachable",
  );
  console.log("PASS zero-film recovery");

  // Actual renderer eligibility must reject a clue through a closed door.
  s = newStory();
  s.items = { family: true, roomKey: true };
  s.checkpoint = { x: 1, z: -12, yaw: -Math.PI / 2, pitch: -0.3 };
  s.doors.connecting = false;
  await fixture(s);
  assert.equal((await diag()).targets.suitcase.eligible, false);
  await page.keyboard.press("c");
  assert(!(await diag()).state.evidence.suitcase);
  assert.equal((await diag()).state.photos.length, 1);
  assert.deepEqual(errors, []);
  console.log("VACANCY SYSTEMS PASSED");
} catch (e) {
  console.log(await diag().catch(() => null));
  await page.screenshot({ path: "artifacts/vacancy-systems-failure.png" });
  throw e;
} finally {
  await browser.close();
}
