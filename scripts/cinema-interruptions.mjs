import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { newStory } from "../src/cinema/logic.js";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.setDefaultTimeout(90000);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() =>
  window.addEventListener("beforeunload", (e) => e.stopImmediatePropagation(), {
    capture: true,
  }),
);
const diag = () => page.evaluate(() => cinemaDiagnostics);
try {
  await page.goto(base);
  const s = newStory();
  s.events = {
    ticket: true,
    firstJam: true,
    jamRepaired: true,
    boothClosed: true,
  };
  s.items = { coat: true };
  s.patron = { x: 6.5, z: -1.08, awakened: true, distance: 0 };
  s.projector.faultIn = 13;
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.last-showing.v1", JSON.stringify(s)),
    s,
  );
  await page.goto(base + "/?chapter=last-showing&play=continue");
  await page.click("#enter-story");
  await page.waitForFunction(
    () => cinemaDiagnostics.state.projector.faultWarning,
  );
  assert.match(
    await page.locator(".projector-status").textContent(),
    /FILM SLIPPING/,
  );
  await page.keyboard.press("p");
  const paused = (await diag()).state;
  await page.waitForTimeout(700);
  assert.deepEqual((await diag()).state, paused);
  await page.click("#resume");
  await page.waitForFunction(
    () => cinemaDiagnostics.state.projector.status === "stopped",
  );
  await page.waitForTimeout(500);
  assert((await diag()).motorGain < 0.01, "A stopped projector must be silent");
  await page.waitForFunction(() => cinemaDiagnostics.state.patron.distance > 1);
  await page.keyboard.press("p");
  const stopped = (await diag()).state;
  const raw = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("polaroid.last-showing.v1")),
  );
  raw.checkpoint = { x: 13.3, z: -2.5, yaw: 0, pitch: -0.2 };
  raw.doors.booth = true;
  await page.evaluate(
    (s) => localStorage.setItem("polaroid.last-showing.v1", JSON.stringify(s)),
    raw,
  );
  await page.reload();
  await page.click("#enter-story");
  await page.keyboard.press("e");
  await page.click("#motor");
  assert.equal((await diag()).state.projector.status, "running");
  assert.deepEqual((await diag()).state.patron, stopped.patron);
  await page.waitForTimeout(500);
  assert((await diag()).motorGain > 0.5);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: warned random stop, frozen pause, motor silence, actual patron movement and in-place restart",
  );
} catch (e) {
  console.log(await diag().catch(() => null));
  await page.screenshot({ path: "artifacts/cinema-interruption-failure.png" });
  throw e;
} finally {
  await browser.close();
}
