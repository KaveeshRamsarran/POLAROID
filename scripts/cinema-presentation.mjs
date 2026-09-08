import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/cinema/logic.js";

const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  const fixture = sessionStorage.getItem("cinema.presentation");
  if (fixture) {
    localStorage.setItem("polaroid.last-showing.v1", fixture);
    sessionStorage.removeItem("cinema.presentation");
  }
});
async function view(x, z, tx, tz, doors = {}) {
  const s = newStory();
  s.checkpoint = { x, z, yaw: Math.atan2(x - tx, z - tz), pitch: -0.04 };
  Object.assign(s.doors, doors);
  await page.evaluate(
    (s) => sessionStorage.setItem("cinema.presentation", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  await page.waitForTimeout(400);
}
try {
  await page.goto(base + "/?chapter=last-showing");
  await view(0, 20, 0, 4);
  assert.equal(
    await page.locator("#grain").evaluate((e) => getComputedStyle(e).opacity),
    "0.015",
  );
  await page.screenshot({ path: "artifacts/cinema-lobby.png" });
  await view(3.5, 18, 8.3, 16.7);
  await page.screenshot({ path: "artifacts/cinema-concessions.png" });
  await view(0, 6, 0, 4, { auditorium: false });
  assert(await page.evaluate(() => window.cinemaNavigation.blocked(0, 4)));
  await page.screenshot({ path: "artifacts/cinema-doors.png" });
  await page.keyboard.press("e");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.doors.auditorium,
  );
  await page.waitForTimeout(500);
  assert.equal(
    await page.evaluate(() => window.cinemaNavigation.blocked(0, 4)),
    false,
  );
  assert(
    await page.evaluate(() => window.cinemaNavigation.blocked(-1.3, 4.7)),
    "Open leaf must have collision",
  );
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.player.z < 3.5);
  await page.keyboard.up("w");
  await view(-18, -2, -20.5, -6);
  await page.screenshot({ path: "artifacts/cinema-archive.png" });
  await view(0, 1, 0, -19);
  await page.screenshot({ path: "artifacts/cinema-auditorium.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS: reduced grain, furnished foyer views, closed/open door collision and walking through the double doors.",
  );
} finally {
  await browser.close();
}
