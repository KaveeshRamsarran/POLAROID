import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const base = process.argv[2] || "http://127.0.0.1:3001";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
  errors = [];
await page.addInitScript(() => {
  const fixture = sessionStorage.getItem("cinema.test.checkpoint");
  if (fixture) {
    localStorage.setItem("polaroid.last-showing.v1", fixture);
    sessionStorage.removeItem("cinema.test.checkpoint");
  }
});
page.on("pageerror", (e) => errors.push(e.message));
page.setDefaultTimeout(60000);
await fs.mkdir("artifacts", { recursive: true });
const d = () => page.evaluate(() => window.cinemaDiagnostics);
async function enter() {
  await page.locator("#enter-story").click();
  await page.waitForFunction(() => window.cinemaDiagnostics.mode === "playing");
  await page.waitForTimeout(150);
}
async function checkpoint(x, z, target, patch = {}) {
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.waitForTimeout(120);
  await page.evaluate(
    ({ x, z, target, patch }) => {
      const s = JSON.parse(localStorage.getItem("polaroid.last-showing.v1"));
      const dx = target.x - x,
        dz = target.z - z,
        y = window.cinemaNavigation.floorAt(x, z) + 1.64;
      s.checkpoint = {
        x,
        z,
        yaw: Math.atan2(-dx, -dz),
        pitch: Math.atan2((target.y ?? 1.3) - y, Math.hypot(dx, dz)),
      };
      Object.assign(s, patch);
      sessionStorage.setItem("cinema.test.checkpoint", JSON.stringify(s));
      window.addEventListener(
        "beforeunload",
        (e) => e.stopImmediatePropagation(),
        { capture: true, once: true },
      );
    },
    { x, z, target, patch },
  );
  await page.reload();
  await enter();
}
async function interaction(id, x, z) {
  const t = (await d()).interactions.find((t) => t.id === id);
  await checkpoint(x, z, t);
  const hint = await page.locator("#interaction").textContent();
  assert(hint, `No interaction at ${id}: ${JSON.stringify(await d())}`);
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  console.log(
    "interact",
    id,
    (await d()).physical || (await page.locator("#subtitle").textContent()),
  );
}
async function close() {
  if (await page.locator("#panel-close").isVisible())
    await page.click("#panel-close");
}
async function photo(id, x, z, patch = {}) {
  const t = (await d()).targets[id];
  await checkpoint(x, z, t, patch);
  assert(
    (await d()).targets[id].eligible,
    `Photo ${id} not framed/visible at ${x},${z}`,
  );
  await page.keyboard.press("c");
  await page.waitForTimeout(150);
  assert((await d()).state.photos.length > 0);
  console.log("photo", id, Object.keys((await d()).state.evidence));
}
try {
  await page.goto(base);
  assert.equal(await page.locator(".chapter-card").count(), 2);
  await page.evaluate(() =>
    localStorage.setItem(
      "polaroid.save.v1",
      JSON.stringify({ compatibilitySentinel: "unchanged" }),
    ),
  );
  await page.goto(base + "/?chapter=last-showing&play=new");
  await enter();
  await interaction("message", -5.5, 19);
  await close();
  await photo("seats", -3.9, -7.5);
  await photo("equipment", 13.3, -2.6);
  assert((await d()).state.events.ticket);
  await interaction("ticket", -3.3, 19);
  await close();
  await photo("patron", 6.5, 0.2);
  assert((await d()).state.evidence.first);
  await page.waitForFunction(() => window.cinemaDiagnostics.develop === 0);
  await page.keyboard.press("r");
  await page.screenshot({ path: "artifacts/cinema-first-print.png" });
  await interaction("coat", 6.5, -0.6);
  await interaction("projector", 13.3, -2.6);
  assert.equal((await d()).state.projector.status, "jammed");
  await page.click("#unjam");
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.events.jamRepaired,
  );
  let state = (await d()).state;
  assert.equal(state.projector.status, "running");
  assert(state.patron.distance > 0);
  const frozen = { ...state.patron };
  await page.waitForTimeout(700);
  assert.deepEqual((await d()).state.patron, frozen);
  await page.keyboard.press("Escape");
  const paused = (await d()).state;
  await page.waitForTimeout(700);
  assert.deepEqual((await d()).state, paused);
  await page.click("#resume");
  await interaction("sorted", -18, -1);
  await close();
  await interaction("projector", 13.3, -2.6);
  await page.click('[data-reel="incident"]');
  await page.waitForFunction(
    () => window.cinemaDiagnostics.state.projector.status === "running",
  );
  await photo("doorway", -11.6, -18);
  assert((await d()).state.evidence.doorway);
  await photo("ada", -8.8, -22.1);
  assert((await d()).state.evidence.ada);
  await interaction("drawer", -18, -7.8);
  assert((await d()).state.items.splice);
  await interaction("assemble", 15.5, -2.8);
  await page.click("#final-start");
  assert.equal((await d()).state.activeReel, "complete");
  await interaction("exit", -11.6, -18);
  assert((await d()).state.events.released);
  await page.waitForFunction(
    () =>
      Math.hypot(
        window.cinemaDiagnostics.state.patron.x + 17,
        window.cinemaDiagnostics.state.patron.z + 18,
      ) < 0.5,
    null,
    { timeout: 90000 },
  );
  await photo("final", -11.6, -18);
  assert((await d()).state.evidence.final);
  await page.keyboard.press("q");
  await page.keyboard.down("w");
  await page.waitForFunction(() => window.cinemaDiagnostics.state.completed);
  await page.keyboard.up("w");
  assert.equal((await d()).mode, "ending");
  await page.screenshot({ path: "artifacts/cinema-ending.png" });
  await page.click("#ending-stories");
  await page.locator(".chapter-card.cinema").waitFor();
  assert.match(
    await page.locator(".chapter-card.cinema").innerText(),
    /STORY COMPLETED/,
  );
  assert.deepEqual(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("polaroid.save.v1")),
    ),
    { compatibilitySentinel: "unchanged" },
  );
  assert.equal(
    await page.evaluate(() => typeof window.cinemaDiagnostics),
    "undefined",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: three survey tasks, first print, jam repair, one investigation reel, two photo clues, missing film, exit and ending; pause and save isolation.",
  );
} catch (error) {
  await page.screenshot({ path: "artifacts/cinema-failure.png" });
  console.error(error);
  console.error(JSON.stringify(await d(), null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
