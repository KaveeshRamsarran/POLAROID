import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(60000);
await page.addInitScript(() => {
  const fixture = sessionStorage.getItem("cinema.fixture");
  if (fixture) {
    localStorage.setItem("polaroid.last-showing.v1", fixture);
    sessionStorage.removeItem("cinema.fixture");
  }
});
const diagnostics = () => page.evaluate(() => window.cinemaDiagnostics);
await page.goto(base + "/?chapter=last-showing");
async function fixture(s) {
  await page.evaluate(
    (s) => sessionStorage.setItem("cinema.fixture", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
}
try {
  let s = newStory();
  s.checkpoint = { x: 12, z: -2, yaw: Math.PI, pitch: -0.1 };
  s.items = { ticket: true, coat: true };
  s.events = { firstJam: true, jamRepaired: true };
  s.evidence = { first: "fixture" };
  s.patron = { x: 12, z: 10, awakened: true, distance: 0 };
  s.doors.booth = false;
  s.projector.status = "stopped";
  await fixture(s);
  await page.keyboard.press("c");
  await page.keyboard.press("r");
  await page.waitForFunction(() => window.cinemaDiagnostics.grace === 0);
  const before = (await diagnostics()).state.patron;
  await page.waitForFunction(() => window.cinemaDiagnostics.state.patron.z < 8);
  assert.equal((await diagnostics()).mode, "playing");
  assert((await diagnostics()).footfalls > 0);
  assert((await diagnostics()).state.patron.distance > before.distance);
  await page.keyboard.press("Escape");
  const paused = (await diagnostics()).state;
  await page.waitForTimeout(600);
  assert.deepEqual((await diagnostics()).state, paused);
  await page.click("#resume");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.mode === "dead",
    null,
    { timeout: 60000 },
  );
  assert(
    (await diagnostics()).state.doors.booth,
    "Patron must open the booth door",
  );
  await page.click("#retry");
  assert((await diagnostics()).grace > 15);
  assert((await diagnostics()).state.events.jamRepaired);
  console.log(
    "PASS: print inspection remains dangerous; patron walks stairs, opens booth door, kills; pause and safe retry.",
  );
  s = newStory();
  s.film = 0;
  s.checkpoint = { x: -7, z: 19, yaw: Math.PI, pitch: -0.2 };
  await fixture(s);
  await page.keyboard.press("e");
  assert.equal((await diagnostics()).state.film, 8);
  console.log("PASS: emergency film prevents a resource softlock.");
  s = newStory();
  s.projector.remaining = 0.1;
  await fixture(s);
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.projector.status === "exhausted",
  );
  await page.waitForTimeout(200);
  assert((await diagnostics()).motorGain < 0.01);
  console.log("PASS: exhaustion and audible motor silence agree.");
  s = newStory();
  s.items = { ticket: true, coat: true };
  s.events = { firstJam: true, jamRepaired: true };
  s.evidence = { first: "fixture", ada: "fixture", doorway: "fixture" };
  s.patron = { x: 0, z: 1, awakened: true, distance: 5 };
  s.projector.status = "power";
  s.events.powerFault = true;
  s.checkpoint = {
    x: -12,
    z: -22.3,
    yaw: Math.atan2(-0.3, 0.5),
    pitch: Math.atan2(-0.24, Math.hypot(0.3, 0.5)),
  };
  await fixture(s);
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.projector.status === "power",
  );
  await page.keyboard.press("e");
  assert.equal((await diagnostics()).state.projector.status, "stopped");
  assert((await diagnostics()).state.events.powerFault);
  console.log(
    "PASS: local breaker restores power without restarting the motor.",
  );
  await page.keyboard.press("Escape");
  await page.click("#stories");
  await page.locator(".chapter-grid").waitFor();
  assert.equal(
    await page.evaluate(() => typeof window.cinemaDiagnostics),
    "undefined",
  );
  assert.deepEqual(errors, []);
} catch (error) {
  console.error(error);
  console.error(JSON.stringify(await diagnostics(), null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
