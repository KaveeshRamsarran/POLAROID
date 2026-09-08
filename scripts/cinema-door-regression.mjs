import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory, floorAt } from "../src/cinema/logic.js";

const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.addInitScript(() => {
  const fixture = sessionStorage.getItem("cinema.door.regression");
  if (fixture) {
    localStorage.setItem("polaroid.last-showing.v1", fixture);
    sessionStorage.removeItem("cinema.door.regression");
  }
});
async function load(x, z, tx, tz, door, y = 1.2) {
  const s = newStory();
  s.tasks = { message: true, seats: true, equipment: true };
  s.events = { firstJam: true, jamRepaired: true, boothClosed: true };
  s.items = { ticket: true, coat: true };
  s.evidence = { first: "existing-photo" };
  s.film = 9;
  s.doors[door] = false;
  s.checkpoint = {
    x,
    z,
    yaw: Math.atan2(x - tx, z - tz),
    pitch: Math.atan2(y - floorAt(x, z) - 1.64, Math.hypot(tx - x, tz - z)),
  };
  await page.evaluate(
    (s) => sessionStorage.setItem("cinema.door.regression", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  const position = await page.evaluate(() => window.cinemaDiagnostics.player);
  assert(
    Math.hypot(position.x - x, position.z - z) < 0.05,
    "Fixture must be on clear floor",
  );
}
try {
  await page.goto(base + "/?chapter=last-showing");
  // The reported save: repaired projector, closed booth, player inside.
  await load(12, -1.1, 12, 0.1, "booth", 4.8);
  assert.match(
    await page.locator("#interaction").textContent(),
    /booth door/i,
    "The inside face must offer an interaction",
  );
  await page.keyboard.press("e");
  assert(await page.evaluate(() => window.cinemaDiagnostics.state.doors.booth));
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.player.z > 0.5);
  await page.keyboard.up("w");
  assert.equal(
    await page.evaluate(() => window.cinemaDiagnostics.state.film),
    9,
  );
  await page.keyboard.press("Escape");
  await page.reload();
  await page.click("#enter-story");
  assert(await page.evaluate(() => window.cinemaDiagnostics.state.doors.booth));
  assert(
    await page.evaluate(
      () => window.cinemaDiagnostics.state.events.jamRepaired,
    ),
  );
  console.log(
    "PASS: existing progress can open the booth, walk out, save and continue.",
  );
  for (const [name, x, z, tx, tz, id, y] of [
    ["stairs side", 12, 1.3, 12, 0.1, "booth", 4.8],
    ["inside oblique", 12.65, -0.7, 12, 0.1, "booth", 4.8],
    ["service side", -8.7, 11, -10, 11, "service", 1.2],
    ["archive inside", -15.3, -0.45, -14, -1, "archive", 1.2],
  ]) {
    await load(x, z, tx, tz, id, y);
    if (name === "stairs side")
      assert.equal(
        await page.evaluate(
          () => window.cinemaDiagnostics.targets.equipment.eligible,
        ),
        false,
        "The closed booth must still block photographs",
      );
    assert.match(
      await page.locator("#interaction").textContent(),
      /open.*close/i,
      name,
    );
    await page.keyboard.press("e");
    assert(
      await page.evaluate((id) => window.cinemaDiagnostics.state.doors[id], id),
      name,
    );
    if (name === "stairs side")
      await page.waitForFunction(
        () => window.cinemaDiagnostics.targets.equipment.eligible,
      );
  }
  await load(11, -5, 0, -12, "booth", 2);
  await page.screenshot({ path: "artifacts/cinema-mounted-lights.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: booth on both sides and at an angle, service and archive doors.",
  );
} catch (error) {
  await page.screenshot({
    path: "artifacts/cinema-door-regression-failure.png",
  });
  throw error;
} finally {
  await browser.close();
}
